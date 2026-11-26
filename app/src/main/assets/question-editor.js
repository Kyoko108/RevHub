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
    dialog.innerHTML = `<section class="rh-editor-card" role="dialog" aria-modal="true"><h2>Edit screenshot question</h2><p class="rh-hint">Edit the question and solution text, then use the arrows to arrange options in the desired order.</p><label>Question<textarea id="rhEditQuestion" rows="4"></textarea></label><label>Answer options and order</label><div id="rhOptionOrder"></div><label>Solution<textarea id="rhEditSolution" rows="7"></textarea></label><div class="rh-actions"><button type="button" class="secondary" id="rhCancelEdit">Cancel</button><button type="button" id="rhSaveEdit">Save changes</button></div></section>`;
    document.body.appendChild(dialog);
    $('rhEditQuestion').value = question.text || '';
    $('rhEditSolution').value = question.solution || '';

    let options = [...(question.options || [])];
    let correctIndex = options.findIndex(option => option === question.answer);

    function renderOptions() {
      const container = $('rhOptionOrder');
      container.replaceChildren();
      options.forEach((option, index) => {
        const row = document.createElement('div');
        row.className = 'rh-option-row';
        const radio = document.createElement('input');
        radio.type = 'radio'; radio.name = 'rhCorrectOption'; radio.checked = index === correctIndex;
        radio.setAttribute('aria-label', `Mark option ${index + 1} as correct`);
        radio.addEventListener('change', () => { correctIndex = index; });
        const field = document.createElement('input');
        field.type = 'text'; field.value = option; field.setAttribute('aria-label', `Option ${index + 1}`);
        field.addEventListener('input', () => { options[index] = field.value; });
        const up = document.createElement('button'); up.type = 'button'; up.className = 'secondary'; up.textContent = '↑'; up.disabled = index === 0; up.setAttribute('aria-label', `Move option ${index + 1} up`);
        up.addEventListener('click', () => moveOption(index, -1));
        const down = document.createElement('button'); down.type = 'button'; down.className = 'secondary'; down.textContent = '↓'; down.disabled = index === options.length - 1; down.setAttribute('aria-label', `Move option ${index + 1} down`);
        down.addEventListener('click', () => moveOption(index, 1));
        row.append(radio, field, up, down);
        container.appendChild(row);
      });
    }

    function moveOption(index, delta) {
      const target = index + delta;
      if (target < 0 || target >= options.length) return;
      [options[index], options[target]] = [options[target], options[index]];
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
      question.options = editedOptions;
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
    let editButton = $('rhEditQuestionButton');
    if (!editButton) {
      editButton = document.createElement('button');
      editButton.id = 'rhEditQuestionButton';
      editButton.className = 'secondary';
      editButton.textContent = 'Edit question / option order';
      card.insertAdjacentElement('afterend', editButton);
    }
    editButton.onclick = () => openQuestionEditor(question);
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
  function ensureOrderButton() { if ($('rhReorderQuestionsButton')) return; const b=document.createElement('button'); b.id='rhReorderQuestionsButton'; b.className='secondary'; b.textContent='↕ Reorder questions'; $('practiceCard').insertAdjacentElement('afterend',b); b.onclick=openQuestionOrder; }
  const priorRenderPractice = renderPractice;
  renderPractice = function() { priorRenderPractice(); ensureOrderButton(); const q=filteredQuestions()[practiceIndex],card=$('practiceCard'); if(!q||!card)return; let holder=$('rhPracticeImages'); if(!holder){holder=document.createElement('div');holder.id='rhPracticeImages';card.querySelector('.question')?.insertAdjacentElement('afterend',holder);} holder.replaceChildren();
    function showImage(id,target,alt){if(!id)return;assetGet(id).then(blob=>{if(!blob||!target.isConnected)return;const img=document.createElement('img');img.alt=alt;img.src=URL.createObjectURL(blob);target.append(img);});}
    showImage(q.sourceScreenshotId,holder,'Original full question screenshot');
    if (q.questionImageId && q.questionImageId !== q.sourceScreenshotId) showImage(q.questionImageId,holder,'Separate question illustration');
    card.querySelectorAll('[name="practiceChoice"]').forEach((input,index)=>{const id=q.optionImageIds&&q.optionImageIds[index];if(!id)return;const wrap=input.parentElement;let box=wrap.querySelector('.rh-option-image');if(!box){box=document.createElement('div');box.className='rh-option-image';wrap.append(box);}showImage(id,box,'Option illustration');});
  };
  try { renderPractice(); } catch (_) { /* app data may still be initializing */ }
})();
