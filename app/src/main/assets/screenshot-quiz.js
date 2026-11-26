(() => {
  if (window.__revHubScreenshotQuizLoaded) return;
  window.__revHubScreenshotQuizLoaded = true;

  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const DUPLICATE_MODE_KEY = 'rh-screenshot-duplicate-mode';
  const mode = () => localStorage.getItem(DUPLICATE_MODE_KEY) || 'manual';
  const cleanQuestion = text => String(text || '').toLowerCase().replace(/^[\s\d.)-]+/, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const similarity = (a, b) => {
    const left = new Set(cleanQuestion(a).split(' ').filter(Boolean));
    const right = new Set(cleanQuestion(b).split(' ').filter(Boolean));
    if (!left.size || !right.size) return 0;
    let common = 0;
    left.forEach(word => { if (right.has(word)) common++; });
    return common / (left.size + right.size - common);
  };

  const style = document.createElement('style');
  style.textContent = `
    .rh-modal { position:fixed; inset:0; z-index:10001; display:grid; place-items:center; overflow-y:auto; padding:max(16px,env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) max(16px,env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px)); background:rgba(5,9,18,.78); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }
    .rh-modal-card { position:relative; isolation:isolate; overflow:hidden; width:min(620px,100%); max-height:calc(100dvh - 32px); overflow-y:auto; overscroll-behavior:contain; padding:clamp(18px,5vw,26px); border:1px solid rgba(255,255,255,.62); border-radius:22px; background:linear-gradient(125deg,#f4e2f4 0%,#d8eff0 56%,#cbd8ff 100%); color:#111827; box-shadow:0 24px 80px rgba(0,0,0,.4); }
    .rh-modal-card::before { content:''; position:absolute; z-index:-1; inset:-45%; pointer-events:none; background:conic-gradient(from 0deg,rgba(45,212,191,.20),rgba(99,102,241,.16),rgba(236,72,153,.12),rgba(250,204,21,.18),rgba(45,212,191,.20)); filter:blur(44px); animation:rh-modal-flow 16s linear infinite; }
    @keyframes rh-modal-flow { to { transform:rotate(360deg); } }
    .rh-modal-card h2 { margin:0 0 8px; color:#111827; font-size:1.45rem; }
    .rh-modal-card p,.rh-modal-card label { color:#374151; }
    .rh-modal-card label { display:block; margin-top:14px; font-size:.92rem; font-weight:650; }
    .rh-modal-card textarea,.rh-modal-card input[type=text],.rh-modal-card select { display:block; width:100%; min-height:46px; margin-top:7px; padding:12px 13px; border:1px solid rgba(31,41,55,.22); border-radius:12px; background:rgba(255,255,255,.94); color:#111827; font:inherit; line-height:1.45; outline-color:#6366f1; }
    .rh-modal-card textarea { resize:vertical; }
    .rh-modal-card .rh-hint { color:#4b5563; font-size:.9rem; line-height:1.5; }
    .rh-modal-card .rh-choice { display:flex; gap:10px; align-items:flex-start; margin:7px 0; padding:10px; border:1px solid rgba(31,41,55,.12); border-radius:12px; background:rgba(255,255,255,.66); color:#111827; }
    .rh-modal-card .rh-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:9px; margin-top:18px; }
    .rh-modal-card button { color:#fff; }
    #rhSubjectContinue { background:#f97316; color:#fff; box-shadow:0 5px 14px rgba(249,115,22,.22); }
    #rhSubjectContinue:active { background:#ea580c; }
    .rh-modal-card button.secondary { color:#111827; background:rgba(255,255,255,.84); border:1px solid rgba(17,24,39,.2); }
    #sqSourcePreview { display:block; width:100%; height:auto; max-height:42dvh; object-fit:contain; object-position:top center; border:1px solid rgba(31,41,55,.2); border-radius:12px; background:#e5e7eb; }
    #sqAnswerChoices { margin-top:6px; }
    @media(prefers-reduced-motion:reduce) { .rh-modal-card::before { animation:none; } }
  `;
  document.head.appendChild(style);

  const settings = $('settings');
  if (settings && !$('screenshotSettings')) {
    settings.insertAdjacentHTML('beforeend', `<div class="section" id="screenshotSettings"><h3>Screenshot question import</h3><p class="muted small">Choose screenshots with the system photo picker. RevHub only receives the images you select.</p><label class="row"><input type="radio" name="duplicateMode" value="auto"> Automatically reject duplicate questions</label><label class="row"><input type="radio" name="duplicateMode" value="manual"> Ask me to keep or reject duplicates</label></div>`);
    document.querySelectorAll('input[name="duplicateMode"]').forEach(input => {
      input.checked = input.value === mode();
      input.addEventListener('change', () => { if (input.checked) localStorage.setItem(DUPLICATE_MODE_KEY, input.value); });
    });
  }

  function subjectPicker() {
    return new Promise(resolve => {
      $('rhSubjectPicker')?.remove();
      const dialog = document.createElement('div');
      dialog.id = 'rhSubjectPicker'; dialog.className = 'rh-modal';
      dialog.innerHTML = `<section class="rh-modal-card" role="dialog" aria-modal="true" aria-labelledby="rhSubjectTitle"><div class="eyebrow">Organise your study library</div><h2 id="rhSubjectTitle">Choose a subject</h2><p class="rh-hint">Select the subject folder for the screenshots you picked.</p><label for="rhSubjectSelect">Subject folder<select id="rhSubjectSelect"></select></label><div id="rhNewSubjectFields" hidden><label for="rhNewSubjectName">New subject name<input id="rhNewSubjectName" type="text" maxlength="60" placeholder="e.g. Control Systems" autocomplete="off"></label><label for="rhNewSubjectGroup">Topic group<select id="rhNewSubjectGroup"><option>TS</option><option>GS</option><option>VLSI</option><option selected>Other</option></select></label></div><div class="rh-actions"><button type="button" class="secondary" id="rhSubjectCancel">Cancel</button><button type="button" id="rhSubjectContinue">Continue</button></div></section>`;
      document.body.appendChild(dialog);
      const select = $('rhSubjectSelect');
      [...new Set(data.subjects || [])].forEach(subject => select.add(new Option(subject, subject)));
      select.add(new Option('＋ Create a subject folder', '__new__'));
      $('rhSubjectSelect').addEventListener('change', () => {
        $('rhNewSubjectFields').hidden = select.value !== '__new__';
        if (select.value === '__new__') $('rhNewSubjectName').focus();
      });
      const finish = result => { dialog.remove(); resolve(result); };
      $('rhSubjectCancel').onclick = () => finish(null);
      dialog.addEventListener('click', event => { if (event.target === dialog) finish(null); });
      dialog.addEventListener('keydown', event => { if (event.key === 'Escape') finish(null); });
      $('rhSubjectContinue').onclick = () => {
        if (select.value === '__new__') {
          const name = $('rhNewSubjectName').value.trim();
          if (!name) { $('rhNewSubjectName').focus(); toast('Enter a subject name.'); return; }
          if (!data.subjects.includes(name)) data.subjects.push(name);
          if (!data.subjectGroups || typeof data.subjectGroups !== 'object') data.subjectGroups = {};
          data.subjectGroups[name] = $('rhNewSubjectGroup').value;
          save();
          finish(name);
        } else if (select.value) finish(select.value);
        else toast('Create or select a subject folder first.');
      };
      $('rhNewSubjectName').addEventListener('keydown', event => { if (event.key === 'Enter') $('rhSubjectContinue').click(); });
      select.focus();
    });
  }

  async function createSubjectFolder() {
    return new Promise(resolve => {
      $('rhCreateSubjectDialog')?.remove();
      const dialog = document.createElement('div'); dialog.id = 'rhCreateSubjectDialog'; dialog.className = 'rh-modal';
      dialog.innerHTML = `<section class="rh-modal-card" role="dialog" aria-modal="true" aria-labelledby="rhCreateSubjectTitle"><div class="eyebrow">Organise your study library</div><h2 id="rhCreateSubjectTitle">Create a subject folder</h2><p class="rh-hint">Choose a topic group and give this subject a clear name.</p><label for="rhFolderGroup">Topic group<select id="rhFolderGroup"><option>TS</option><option>GS</option><option>VLSI</option><option selected>Other</option></select></label><label for="rhFolderName">Subject name<input id="rhFolderName" type="text" maxlength="60" placeholder="e.g. Digital Logic" autocomplete="off"></label><div class="rh-actions"><button type="button" class="secondary" id="rhFolderCancel">Cancel</button><button type="button" id="rhFolderCreate">Create folder</button></div></section>`;
      document.body.appendChild(dialog);
      const finish = result => { dialog.remove(); resolve(result); };
      $('rhFolderCancel').onclick = () => finish(null);
      dialog.addEventListener('click', event => { if (event.target === dialog) finish(null); });
      dialog.addEventListener('keydown', event => { if (event.key === 'Escape') finish(null); });
      $('rhFolderCreate').onclick = () => {
        const name = $('rhFolderName').value.trim();
        if (!name) { $('rhFolderName').focus(); toast('Enter a subject name first.'); return; }
        finish({ name, group: $('rhFolderGroup').value });
      };
      $('rhFolderName').addEventListener('keydown', event => { if (event.key === 'Enter') $('rhFolderCreate').click(); });
      $('rhFolderName').focus();
    });
  }

  const subjectButton = $('addSubject');
  if (subjectButton) subjectButton.onclick = async () => {
    const result = await createSubjectFolder();
    if (!result) return;
    if (!data.subjects.includes(result.name)) data.subjects.push(result.name);
    if (!data.subjectGroups || typeof data.subjectGroups !== 'object') data.subjectGroups = {};
    data.subjectGroups[result.name] = result.group;
    save(); renderLibrary(); toast(`Subject folder “${result.name}” created.`);
  };

  const addImage = $('addImage');
  if (addImage) {
    addImage.textContent = '＋ Choose screenshots';
    // Use the native system photo picker directly; no browser confirm() alert.
    addImage.onclick = () => $('imageInput')?.click();
  }

  function parseScreenshotText(text) {
    const source = String(text || '').replace(/\r/g, '');
    const solutionMatch = source.match(/(?:^|\n)\s*(?:worked\s+)?solution\s*[:\-]?\s*/i);
    const beforeSolution = solutionMatch ? source.slice(0, solutionMatch.index) : source;
    const solution = solutionMatch ? source.slice(solutionMatch.index + solutionMatch[0].length).trim() : '';
    const lines = beforeSolution.split(/\n/).map(line => line.trim()).filter(Boolean);
    const optionPattern = /^\s*([A-Da-d]|[1-4])[).:\-]\s*(.+?)\s*$/;
    const options = [], stems = [];
    let foundOption = false, markedAnswer = '';
    const answerMatch = beforeSolution.match(/(?:correct\s+answer|answer\s+key|\bans(?:wer)?\b)\s*[:\-]?\s*([A-D1-4])\b/i);
    for (const line of lines) {
      const match = line.match(optionPattern);
      if (match) {
        foundOption = true;
        const value = match[2].trim();
        if (/[✓✔☑]|\bcorrect\b/i.test(value)) markedAnswer = value.replace(/[✓✔☑]/g, '').replace(/\bcorrect\b/ig, '').replace(/\s*\(correct\)\s*/ig, '').trim();
        options.push(value.replace(/[✓✔☑]/g, '').replace(/\s*\(correct\)\s*/ig, '').replace(/\s+correct\s*$/ig, '').trim());
      } else if (!foundOption && !/^(?:correct\s+answer|answer\s+key|ans(?:wer)?)\s*[:\-]/i.test(line)) stems.push(line);
      else if (foundOption && options.length && !/^(?:correct\s+answer|answer\s+key|ans(?:wer)?)\s*[:\-]/i.test(line)) options[options.length - 1] += ` ${line}`;
    }
    let answerIndex = -1;
    if (answerMatch && options.length) {
      const key = answerMatch[1].toUpperCase();
      answerIndex = key >= '1' && key <= '4' ? Number(key) - 1 : key.charCodeAt(0) - 65;
    } else if (markedAnswer) answerIndex = options.findIndex(option => option.toLowerCase() === markedAnswer.toLowerCase() || option.toLowerCase().includes(markedAnswer.toLowerCase()));
    if (answerIndex < 0 || answerIndex >= options.length) answerIndex = -1;
    return { question: stems.join('\n').trim(), options, answerIndex, solution };
  }

  function reviewScreenshot(parsed, rawText, file) {
    return new Promise(resolve => {
      $('screenshotQuizDialog')?.remove();
      const dialog = document.createElement('div'); dialog.id = 'screenshotQuizDialog'; dialog.className = 'rh-modal';
      dialog.innerHTML = `<section class="rh-modal-card" role="dialog" aria-modal="true" aria-labelledby="sqTitle"><h2 id="sqTitle">Review screenshot question</h2><p class="rh-hint" id="sqFileHint"></p><p class="rh-hint">Review OCR and fill the question, answer choices, correct option, and solution. The complete original screenshot is kept, so solution diagrams are not cropped or discarded.</p><details><summary>View full original screenshot (including solution/diagram)</summary><img id="sqSourcePreview" alt="Full selected screenshot, including the solution region"></details><label for="sqQuestion">Question<textarea id="sqQuestion" rows="4" placeholder="Paste or edit the question"></textarea></label><label for="sqOptions">Answer choices <span class="rh-hint">(paste one option per line)</span><textarea id="sqOptions" rows="5" placeholder="A. First option&#10;B. Second option"></textarea></label><label for="sqCorrectOption">Correct option <span class="rh-hint">(paste the exact correct option or answer)</span><input id="sqCorrectOption" type="text" placeholder="Paste the correct option"></label><div id="sqAnswerChoices"></div><p id="sqAnswerHint" class="rh-hint"></p><label for="sqSolution">Solution <span class="rh-hint">(OCR text after “Solution”; edit or paste as needed)</span><textarea id="sqSolution" rows="6" placeholder="Paste or edit the solution text. The original screenshot is retained in full for any diagram."></textarea></label><div class="rh-actions"><button type="button" class="secondary" id="sqCancel">Cancel screenshot</button><button type="button" id="sqSave">Save quiz question</button></div></section>`;
      document.body.appendChild(dialog);
      $('sqFileHint').textContent = `${file.name} · OCR can misread text; check each field against the screenshot.`;
      const previewUrl = URL.createObjectURL(file);
      $('sqSourcePreview').src = previewUrl;
      $('sqQuestion').value = parsed.question || String(rawText || '').trim();
      $('sqOptions').value = parsed.options.join('\n');
      $('sqSolution').value = parsed.solution || '';
      const currentAnswerIndex = () => {
        const exactAnswer = $('sqCorrectOption').value.trim().toLowerCase();
        const options = $('sqOptions').value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
        if (exactAnswer) return options.findIndex(option => option.replace(/^[A-D1-4][).:\-]\s*/i, '').toLowerCase() === exactAnswer.replace(/^[A-D1-4][).:\-]\s*/i, '').toLowerCase() || option.toLowerCase() === exactAnswer);
        return parsed.answerIndex;
      };
      const refreshAnswers = () => {
        const choices = $('sqOptions').value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
        const prior = dialog.querySelector('input[name="sqAnswer"]:checked');
        const selected = prior ? Number(prior.value) : currentAnswerIndex();
        $('sqAnswerChoices').innerHTML = choices.map((choice, index) => `<label class="rh-choice"><input type="radio" name="sqAnswer" value="${index}" ${index === selected ? 'checked' : ''}><span>${escapeHtml(choice)}</span></label>`).join('');
        const answerField = $('sqCorrectOption');
        if (!answerField.value.trim() && parsed.answerIndex >= 0 && choices[parsed.answerIndex]) answerField.value = choices[parsed.answerIndex];
        $('sqAnswerHint').textContent = parsed.answerIndex >= 0 ? 'OCR detected a possible marked/keyed choice. Verify it; use the field above to enter or correct the answer.' : 'Select the correct choice here, or paste it into the Correct option field above. Check it against the screenshot.';
      };
      $('sqOptions').addEventListener('input', refreshAnswers);
      $('sqCorrectOption').addEventListener('input', refreshAnswers);
      refreshAnswers();
      const finish = value => { URL.revokeObjectURL(previewUrl); dialog.remove(); resolve(value); };
      $('sqCancel').onclick = () => finish(null);
      $('sqSave').onclick = () => {
        const question = $('sqQuestion').value.trim();
        const options = $('sqOptions').value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
        const selected = dialog.querySelector('input[name="sqAnswer"]:checked');
        let answerIndex = selected ? Number(selected.value) : currentAnswerIndex();
        const typedAnswer = $('sqCorrectOption').value.trim();
        if (answerIndex < 0 && typedAnswer) answerIndex = options.findIndex(option => option.toLowerCase() === typedAnswer.toLowerCase() || option.replace(/^[A-D1-4][).:\-]\s*/i, '').toLowerCase() === typedAnswer.replace(/^[A-D1-4][).:\-]\s*/i, '').toLowerCase());
        if (!question || options.length < 2) { toast('Enter a question and at least two answer choices.'); return; }
        if (answerIndex < 0 || answerIndex >= options.length) { toast('Select the correct choice or enter a Correct option that matches one of the choices.'); $('sqCorrectOption').focus(); return; }
        finish({ question, options, answerIndex, solution: $('sqSolution').value.trim() });
      };
      $('sqQuestion').focus();
    });
  }

  const imageInput = $('imageInput');
  if (imageInput) imageInput.onchange = async event => {
    const input = event.target;
    const files = Array.from(input.files || []).filter(file => file.type.startsWith('image/'));
    if (!files.length) { input.value = ''; return; }
    const subject = await subjectPicker();
    if (!subject) { input.value = ''; return; }
    let saved = 0;
    try {
      for (const file of files) {
        toast(`Reading screenshot ${saved + 1} of ${files.length}: ${file.name}`);
        const rawText = await extractOCR(file);
        if (!rawText) toast('OCR could not read this image. You can enter the question, choices, correct option and solution manually.');
        const reviewed = await reviewScreenshot(parseScreenshotText(rawText), rawText, file);
        if (!reviewed) continue;
        const duplicate = data.questions.find(question => similarity(question.text, reviewed.question) >= 0.86);
        if (duplicate && mode() === 'auto') { toast(`Duplicate skipped: this may match a question in ${duplicate.subject}.`); continue; }
        const id = crypto.randomUUID();
        // Save the unmodified complete screenshot. It includes all content below
        // the Solution heading, including any diagram, without cropping.
        await assetPut(id, file);
        data.questions.push({ id, subject, text: reviewed.question, answer: reviewed.options[reviewed.answerIndex], options: reviewed.options, solution: reviewed.solution, image: true, sourceName: file.name, fullSolutionImage: true, duplicateOf: duplicate?.id || null });
        saved++; save();
      }
      renderLibrary();
      if (saved) toast(`${saved} screenshot${saved === 1 ? '' : 's'} saved as quiz question${saved === 1 ? '' : 's'} in ${subject}.`);
    } catch (error) { console.error('Screenshot import failed', error); toast('Could not import this screenshot. Please try selecting it again.'); }
    finally { input.value = ''; }
  };

  renderPractice = function () {
    if (!$('practiceFilter').options.length) $('practiceFilter').innerHTML = subjectsOptions();
    const questions = filteredQuestions();
    $('qCount').textContent = `${questions.length} questions`;
    const card = $('practiceCard');
    if (!questions.length) { card.innerHTML = '<p class="muted">No questions yet. Choose a screenshot in My Library or add a manual question.</p>'; return; }
    practiceIndex = Math.max(0, Math.min(practiceIndex, questions.length - 1));
    const question = questions[practiceIndex];
    selectedChoice = null;
    questionStarted = Date.now();
    card.innerHTML = `<div class="row between"><span class="pill">${escapeHtml(question.subject)}</span><span class="muted small">${practiceIndex + 1} of ${questions.length}</span></div>${question.image ? '<p class="muted small">Screenshot question · OCR reviewed</p>' : ''}<div class="question">${escapeHtml(question.text)}</div>${question.options?.length ? question.options.map((option, index) => `<label class="quiz-choice"><input type="radio" name="practiceChoice" value="${index}"><span>${escapeHtml(option)}</span></label>`).join('') : '<input id="typedAnswer" class="field" placeholder="Type your answer">'}<div id="feedback"></div>`;
    card.querySelectorAll('input[name="practiceChoice"]').forEach(input => input.addEventListener('change', () => { selectedChoice = Number(input.value); }));
    $('submitQ').disabled = false;
  };

  const oldRenderLibrary = renderLibrary;
  renderLibrary = function () {
    if (typeof oldRenderLibrary === 'function') oldRenderLibrary();
    const list = $('subjectList');
    if (!list || !data.subjectGroups) return;
    list.querySelectorAll('.subject').forEach(row => {
      const name = row.querySelector('b')?.textContent;
      const group = data.subjectGroups[name];
      if (group && !row.querySelector('.topic-group')) {
        const label = document.createElement('span'); label.className = 'pill topic-group'; label.textContent = group;
        row.firstElementChild?.append(label);
      }
    });
  };
  try { renderLibrary(); } catch (_) { /* app data may still be initializing */ }
})();
