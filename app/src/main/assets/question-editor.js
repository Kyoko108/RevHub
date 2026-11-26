(() => {
  if (window.__revHubQuestionEditorLoaded) return;
  window.__revHubQuestionEditorLoaded = true;

  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const style = document.createElement('style');
  style.textContent = `
    #rhQuestionEditor { position:fixed; inset:0; z-index:10002; display:grid; place-items:center; overflow-y:auto; padding:16px; background:rgba(5,9,18,.78); backdrop-filter:blur(8px); }
    #rhQuestionEditor .rh-editor-card { position:relative; isolation:isolate; width:min(620px,100%); max-height:calc(100dvh - 32px); overflow-y:auto; padding:22px; border:1px solid rgba(255,255,255,.62); border-radius:20px; background:rgba(248,250,255,.96); color:#111827; box-shadow:0 24px 80px rgba(0,0,0,.38); }
    #rhQuestionEditor .rh-editor-card::before { content:''; position:absolute; z-index:-1; inset:-45%; pointer-events:none; background:conic-gradient(from 0deg,rgba(59,130,246,.23),rgba(168,85,247,.18),rgba(236,72,153,.22),rgba(96,165,250,.2),rgba(59,130,246,.23)); filter:blur(42px); animation:rh-editor-gradient-flow 14s linear infinite; }
    @keyframes rh-editor-gradient-flow { to { transform:rotate(360deg); } }
    #rhQuestionEditor h2 { margin:0 0 8px; color:#111827; }
    #rhQuestionEditor label { display:block; margin-top:13px; color:#374151; font-weight:650; }
    #rhQuestionEditor textarea,#rhQuestionEditor input { width:100%; margin-top:7px; padding:11px 12px; border:1px solid rgba(31,41,55,.22); border-radius:11px; background:rgba(255,255,255,.94); color:#111827; font:inherit; }
    #rhOptionOrder { display:grid; gap:7px; margin-top:8px; }
    #rhOptionOrder .rh-option-row { display:grid; grid-template-columns:34px 1fr auto auto; gap:6px; align-items:center; padding:7px; border:1px solid rgba(31,41,55,.13); border-radius:10px; background:rgba(255,255,255,.84); }
    #rhOptionOrder input { margin:0; }
    #rhOptionOrder button { min-width:34px; padding:8px; }
    #rhOptionOrder .rh-option-image-tools{grid-column:2/-1;display:flex;align-items:center;gap:7px;flex-wrap:wrap}
    #rhOptionOrder .rh-option-image-tools img,#rhQuestionImagePreview img{max-width:100px;max-height:72px;object-fit:contain;border-radius:7px}
    #rhQuestionImagePreview{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px}
    #practiceEditActions{display:flex;flex-wrap:nowrap;gap:9px}#practiceEditActions>button{flex:1;min-width:0;font-size:13px;padding:10px 8px}
    #rhQuestionEditor .rh-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:18px; }
    #rhQuestionEditor .rh-hint { color:#4b5563; font-size:.9rem; }
    #rhQuestionEditor button { color:#fff; }
    #rhQuestionEditor button.secondary { color:#111827; background:rgba(255,255,255,.85); border:1px solid rgba(17,24,39,.2); }
    #rhQuestionOrder { position:fixed; inset:0; z-index:10003; display:grid; place-items:center; padding:16px; background:rgba(5,9,18,.8); }
    #rhQuestionOrder .rh-order-card { width:min(620px,100%); max-height:calc(100dvh - 32px); overflow:auto; padding:20px; border-radius:18px; background:#f4f1ff; color:#172033; }
    #rhQuestionOrderList { display:grid; gap:8px; margin-top:12px; }
    #rhQuestionOrderList .rh-order-row { display:flex; gap:10px; align-items:center; padding:12px; border:1px solid #d7d4e8; border-radius:12px; background:#fff; cursor:grab; }
    #rhQuestionOrderList .dragging { opacity:.4; }
    #rhQuestionOrder .rh-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:16px; }
    #rhPracticeImages img,.rh-option-image img { display:block; max-width:100%; max-height:260px; object-fit:contain; margin:8px auto; border-radius:10px; }
    #rhSolutionReveal { display:none; margin-top:12px; padding:14px; border-left:4px solid #22c55e; border-radius:10px; background:rgba(34,197,94,.10); color:var(--text,#f3f5fa); white-space:pre-wrap; overflow-wrap:anywhere; max-height:min(65vh,680px); overflow:auto; line-height:1.55; }
    @media(prefers-reduced-motion:reduce) { #rhQuestionEditor .rh-editor-card::before { animation:none; } }
  `;
  document.head.appendChild(style);

  function openQuestionEditor(question) {
    $('rhQuestionEditor')?.remove();
    const dialog = document.createElement('div');
    dialog.id = 'rhQuestionEditor';
    dialog.innerHTML = `<section class="rh-editor-card" role="dialog" aria-modal="true"><h2>Edit screenshot question</h2><p class="rh-hint">Edit the question and solution text, then use the arrows to arrange options in the desired order.</p><label>Question<textarea id="rhEditQuestion" rows="4"></textarea></label><div class="rh-actions" style="justify-content:flex-start"><button type="button" class="secondary" id="rhQuestionCrop">Crop / replace question diagram</button><button type="button" class="secondary" id="rhQuestionClearImage">Remove diagram</button></div><div id="rhQuestionImagePreview" class="rh-hint"></div><label>Answer options, images and order</label><div id="rhOptionOrder"></div><label>Solution<textarea id="rhEditSolution" rows="7"></textarea></label><div class="rh-actions"><button type="button" class="secondary" id="rhCancelEdit">Cancel</button><button type="button" id="rhSaveEdit">Save changes</button></div></section>`;
    document.body.appendChild(dialog);
    $('rhEditQuestion').value = question.text || '';
    $('rhEditSolution').value = question.solution || '';

    let options = [...(question.options || [])];
    let optionImageIds = [...(question.optionImageIds || [])];
    while (optionImageIds.length < options.length) optionImageIds.push(null);
    let questionImageId = question.questionImageId || null;
    let correctIndex = options.findIndex(option => option === question.answer);
    const previewImage = async (id, target) => { target.replaceChildren(); if(!id)return; const blob=await assetGet(id); if(!blob||!target.isConnected)return; const img=document.createElement('img');img.src=URL.createObjectURL(blob);target.append(img); };
    async function cropImageFile(file, done) {
      const url=URL.createObjectURL(file), img=new Image(); img.onload=()=>{
        const layer=document.createElement('div');layer.className='rh-modal';layer.style.zIndex='10006';
        layer.innerHTML='<section class="rh-modal-card" style="width:min(760px,100%)"><h3>Crop diagram</h3><p class="rh-hint">Drag around only the diagram or figure, then choose Use crop.</p><canvas id="rhEditCropCanvas" style="display:block;width:100%;max-height:55dvh;touch-action:none;border:1px solid #9ca3af;border-radius:10px;background:#fff"></canvas><div class="rh-actions"><button type="button" class="secondary" id="rhEditCropCancel">Cancel</button><button type="button" id="rhEditCropApply">Use crop</button></div></section>';
        document.body.append(layer); const canvas=layer.querySelector('canvas'),ctx=canvas.getContext('2d');let start=null,rect=null;
        const scale=Math.min(1,1100/img.naturalWidth);canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);ctx.drawImage(img,0,0,canvas.width,canvas.height);
        const pos=ev=>{const b=canvas.getBoundingClientRect();return{x:(ev.clientX-b.left)*canvas.width/b.width,y:(ev.clientY-b.top)*canvas.height/b.height};};
        canvas.onpointerdown=ev=>{start=pos(ev);canvas.setPointerCapture(ev.pointerId);};canvas.onpointermove=ev=>{if(!start)return;const p=pos(ev);rect={x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.abs(start.x-p.x),h:Math.abs(start.y-p.y)};ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);ctx.strokeStyle='#f97316';ctx.lineWidth=3;ctx.strokeRect(rect.x,rect.y,rect.w,rect.h);};canvas.onpointerup=()=>{start=null;};
        layer.querySelector('#rhEditCropCancel').onclick=()=>{URL.revokeObjectURL(url);layer.remove();};
        layer.querySelector('#rhEditCropApply').onclick=()=>{if(!rect||rect.w<8||rect.h<8){toast('Select the diagram area first.');return;}const ratio=img.naturalWidth/canvas.width,out=document.createElement('canvas');out.width=Math.round(rect.w*ratio);out.height=Math.round(rect.h*ratio);out.getContext('2d').drawImage(img,Math.round(rect.x*ratio),Math.round(rect.y*ratio),out.width,out.height,0,0,out.width,out.height);out.toBlob(blob=>{if(blob){done(new File([blob],'cropped-diagram.png',{type:'image/png'}));layer.remove();}URL.revokeObjectURL(url);},'image/png');};
      }; img.src=url;
    }
    function chooseCrop(done) { const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=()=>{const file=input.files?.[0];if(file)cropImageFile(file,done);};input.click(); }
    $('rhQuestionCrop').onclick=()=>chooseCrop(async file=>{questionImageId=crypto.randomUUID();await assetPut(questionImageId,file);previewImage(questionImageId,$('rhQuestionImagePreview'));});
    $('rhQuestionClearImage').onclick=()=>{questionImageId=null;$('rhQuestionImagePreview').textContent='No question diagram attached';};
    previewImage(questionImageId,$('rhQuestionImagePreview'));

    function renderOptions() {
      const container=$('rhOptionOrder');container.replaceChildren();
      options.forEach((option,index)=>{
        const row=document.createElement('div');row.className='rh-option-row';
        const radio=document.createElement('input');radio.type='radio';radio.name='rhCorrectOption';radio.checked=index===correctIndex;radio.setAttribute('aria-label',`Mark option ${index+1} as correct`);radio.onchange=()=>{correctIndex=index;};
        const field=document.createElement('input');field.type='text';field.value=option;field.setAttribute('aria-label',`Option ${index+1}`);field.oninput=()=>{options[index]=field.value;};
        const up=document.createElement('button');up.type='button';up.className='secondary';up.textContent='↑';up.disabled=index===0;up.onclick=()=>moveOption(index,-1);
        const down=document.createElement('button');down.type='button';down.className='secondary';down.textContent='↓';down.disabled=index===options.length-1;down.onclick=()=>moveOption(index,1);
        const tools=document.createElement('div');tools.className='rh-option-image-tools';
        const crop=document.createElement('button');crop.type='button';crop.className='secondary';crop.textContent=optionImageIds[index]?'Replace / recrop image':'＋ Crop option image';crop.onclick=()=>chooseCrop(async file=>{optionImageIds[index]=crypto.randomUUID();await assetPut(optionImageIds[index],file);renderOptions();});
        const clear=document.createElement('button');clear.type='button';clear.className='secondary';clear.textContent='Remove image';clear.disabled=!optionImageIds[index];clear.onclick=()=>{optionImageIds[index]=null;renderOptions();};
        tools.append(crop,clear);if(optionImageIds[index]){const img=document.createElement('img');tools.append(img);assetGet(optionImageIds[index]).then(blob=>{if(blob&&img.isConnected)img.src=URL.createObjectURL(blob);});}
        row.append(radio,field,up,down,tools);container.append(row);
      });
    }

    function moveOption(index, delta) {
      const target = index + delta;
      if (target < 0 || target >= options.length) return;
      [options[index], options[target]] = [options[target], options[index]];
      [optionImageIds[index], optionImageIds[target]] = [optionImageIds[target], optionImageIds[index]];
      if (correctIndex === index) correctIndex = target;
      else if (correctIndex === target) correctIndex = index;
      renderOptions();
    }
    renderOptions();

    $('rhCancelEdit').onclick = () => dialog.remove();
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.remove(); });
    dialog.addEventListener('keydown', event => { if (event.key === 'Escape') dialog.remove(); });
    $('rhSaveEdit').onclick = () => {
      const text = $('rhEditQuestion').value.trim();
      const solution = $('rhEditSolution').value;
      const editedOptions = [...options].map(option => String(option).trim()).filter(Boolean);
      if (!text) { toast('The question cannot be empty.'); return; }
      if (editedOptions.length < 2) { toast('A question needs at least two options.'); return; }
      if (correctIndex < 0 || correctIndex >= editedOptions.length) { toast('Select the correct option.'); return; }
      question.text = text;
      if (options.some(option => !String(option).trim())) { toast('Remove empty options or fill them in.'); return; }
      question.options = editedOptions;
      question.optionImageIds = optionImageIds;
      question.questionImageId = questionImageId;
      question.answer = editedOptions[correctIndex];
      question.solution = solution;
      save();
      renderPractice(); renderLibrary();
      dialog.remove();
      toast('Question, option order and solution updated.');
    };
  }

  function showSolution(question, card) {
    if (!question.solution) return;
    let panel = card.querySelector('#rhSolutionReveal');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'rhSolutionReveal';
      panel.setAttribute('aria-live', 'polite');
      card.appendChild(panel);
    }
    panel.textContent = `Solution:\n${question.solution}`;
    panel.style.display = 'block';
  }

  const originalRenderPractice = renderPractice;
  renderPractice = function () {
    originalRenderPractice();
    const questions = filteredQuestions();
    const question = questions[practiceIndex];
    if (!question) return;
    const card = $('practiceCard');
    const editButton = $('rhEditQuestionButton');
    if (editButton) editButton.onclick = () => openQuestionEditor(question);
    // Reveal the entire corrected OCR solution only after an answer is selected.
    card.querySelectorAll('input[name="practiceChoice"], [data-choice]').forEach(control => {
      control.addEventListener('change', () => showSolution(question, card));
      if (control.tagName === 'BUTTON') control.addEventListener('click', () => setTimeout(() => showSolution(question, card), 0));
    });
  };

  function openQuestionOrder() {
    $('rhQuestionOrder')?.remove();
    const questions = filteredQuestions().slice();
    if (questions.length < 2) { toast('Add at least two questions to change their order.'); return; }
    const dialog = document.createElement('div'); dialog.id = 'rhQuestionOrder';
    dialog.innerHTML = '<section class="rh-order-card" role="dialog" aria-modal="true"><h2>Reorder questions</h2><p>Drag questions up or down, then save the new order.</p><div id="rhQuestionOrderList"></div><div class="rh-actions"><button type="button" class="secondary" id="rhOrderCancel">Cancel</button><button type="button" id="rhOrderSave">Save order</button></div></section>';
    document.body.appendChild(dialog); const list = $('rhQuestionOrderList'); let dragged = null;
    function draw() { list.replaceChildren(); questions.forEach((q,i) => { const row=document.createElement('div'); row.className='rh-order-row'; row.draggable=true; const grip=document.createElement('b'); grip.textContent='⠿'; const num=document.createElement('span'); num.textContent=(i+1)+'.'; const title=document.createElement('span'); title.textContent=q.text||'Untitled question'; row.append(grip,num,title); row.addEventListener('dragstart',e=>{dragged=q.id;row.classList.add('dragging');e.dataTransfer.effectAllowed='move';}); row.addEventListener('dragend',()=>{dragged=null;row.classList.remove('dragging');}); row.addEventListener('dragover',e=>e.preventDefault()); row.addEventListener('drop',e=>{e.preventDefault();const from=questions.findIndex(x=>x.id===dragged),to=questions.indexOf(q);if(from<0||to<0||from===to)return;const moved=questions.splice(from,1)[0];questions.splice(to,0,moved);draw();}); list.append(row); }); }
    draw(); $('rhOrderCancel').onclick=()=>dialog.remove();
    $('rhOrderSave').onclick=()=>{const ids=new Set(questions.map(q=>q.id));let i=0;data.questions=data.questions.map(q=>ids.has(q.id)?questions[i++]:q);save();practiceIndex=0;renderPractice();dialog.remove();toast('Question order saved.');};
  }
  function ensureOrderButton() { const b=$('rhReorderQuestionsButton'); if(b) b.onclick=openQuestionOrder; }
  const priorRenderPractice = renderPractice;
  renderPractice = function() { priorRenderPractice(); ensureOrderButton(); const q=filteredQuestions()[practiceIndex],card=$('practiceCard'); if(!q||!card)return; let holder=$('rhPracticeImages'); if(!holder){holder=document.createElement('div');holder.id='rhPracticeImages';card.querySelector('.question')?.insertAdjacentElement('afterend',holder);} holder.replaceChildren();
    function showImage(id,target,alt){if(!id)return;assetGet(id).then(blob=>{if(!blob||!target.isConnected)return;const img=document.createElement('img');img.alt=alt;img.src=URL.createObjectURL(blob);target.append(img);});}
    showImage(q.questionImageId,holder,'Cropped question diagram');
    card.querySelectorAll('[name="practiceChoice"]').forEach((input,index)=>{const id=q.optionImageIds&&q.optionImageIds[index];if(!id)return;const wrap=input.parentElement;let box=wrap.querySelector('.rh-option-image');if(!box){box=document.createElement('div');box.className='rh-option-image';wrap.append(box);}showImage(id,box,'Cropped diagram for this option');});
  };
  try { renderPractice(); } catch (_) { /* app data may still be initializing */ }
})();
