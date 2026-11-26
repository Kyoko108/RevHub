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
    #screenshotQuizDialog { position:fixed; inset:0; z-index:10001; display:grid; place-items:center; padding:16px; background:#080b12dd; }
    #screenshotQuizDialog .sq-card { width:min(620px,100%); max-height:90vh; overflow:auto; padding:22px; border:1px solid var(--line,#39445a); border-radius:18px; background:var(--panel,#171e2c); }
    #screenshotQuizDialog textarea,#screenshotQuizDialog select { width:100%; margin:7px 0 14px; padding:12px; border-radius:10px; border:1px solid var(--line,#39445a); background:var(--bg,#0d111b); color:var(--text,#f3f5fa); font:inherit; }
    #screenshotQuizDialog .sq-choice { display:flex; gap:10px; align-items:flex-start; padding:9px; border-radius:9px; background:var(--panel2,#202a3b); margin:6px 0; }
    #screenshotQuizDialog .sq-actions { display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-end; margin-top:16px; }
    #screenshotQuizDialog .sq-hint { color:var(--muted,#9ba8bb); font-size:.9em; }
    #subjectFolderDialog { position:fixed; inset:0; z-index:10002; display:grid; place-items:center; padding:20px; background:rgba(5,9,18,.62); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }
    #subjectFolderDialog .folder-card { position:relative; isolation:isolate; overflow:hidden; width:min(460px,100%); padding:26px; border:1px solid rgba(255,255,255,.72); border-radius:24px; background:rgba(255,255,255,.88); box-shadow:0 24px 80px rgba(0,0,0,.32); color:#111827; }
    #subjectFolderDialog .folder-card::before { content:''; position:absolute; z-index:-1; inset:-45%; background:conic-gradient(from 0deg,rgba(45,212,191,.45),rgba(99,102,241,.3),rgba(236,72,153,.22),rgba(250,204,21,.34),rgba(45,212,191,.45)); filter:blur(38px); animation:folder-gradient-flow 12s linear infinite; }
    @keyframes folder-gradient-flow { to { transform:rotate(360deg); } }
    #subjectFolderDialog h2 { margin:0 0 7px; color:#111827; }
    #subjectFolderDialog p,#subjectFolderDialog label { color:#374151; }
    #subjectFolderDialog label { display:block; margin-top:14px; font-size:.92rem; font-weight:650; }
    #subjectFolderDialog input,#subjectFolderDialog select { display:block; width:100%; margin-top:7px; padding:12px 13px; border:1px solid rgba(31,41,55,.2); border-radius:12px; background:rgba(255,255,255,.9); color:#111827; font:inherit; outline-color:#6366f1; }
    #subjectFolderDialog .folder-actions { display:flex; justify-content:flex-end; gap:9px; margin-top:20px; }
    #subjectFolderDialog button { color:#fff; }
    #subjectFolderDialog button.secondary { color:#111827; background:rgba(255,255,255,.82); border-color:rgba(17,24,39,.2); }
    #practiceCard .quiz-choice { display:flex; gap:10px; align-items:flex-start; padding:12px; margin:8px 0; border:1px solid var(--line,#2b3548); border-radius:12px; cursor:pointer; }
    #practiceCard .quiz-choice:has(input:checked) { border-color:var(--accent,#a78bfa); background:#a78bfa18; }
    @media(prefers-reduced-motion:reduce) { #subjectFolderDialog .folder-card::before { animation:none; } }
  `;
  document.head.appendChild(style);

  const settings = $('settings');
  if (settings && !$('screenshotSettings')) {
    settings.insertAdjacentHTML('beforeend', `<div class="section" id="screenshotSettings"><h3>Screenshot question import</h3><p class="muted small">Select screenshots using Android's system photo picker. RevHub only receives the images you choose.</p><label class="row"><input type="radio" name="duplicateMode" value="auto"> Automatically reject duplicate questions</label><label class="row"><input type="radio" name="duplicateMode" value="manual"> Ask me to keep or reject duplicates</label></div>`);
    document.querySelectorAll('input[name="duplicateMode"]').forEach(input => {
      input.checked = input.value === mode();
      input.addEventListener('change', () => { if (input.checked) localStorage.setItem(DUPLICATE_MODE_KEY, input.value); });
    });
  }

  function createSubjectDialog() {
    return new Promise(resolve => {
      $('subjectFolderDialog')?.remove();
      const dialog = document.createElement('div');
      dialog.id = 'subjectFolderDialog';
      dialog.innerHTML = `<section class="folder-card" role="dialog" aria-modal="true" aria-labelledby="folderTitle"><div class="eyebrow">Organise your study library</div><h2 id="folderTitle">Create a subject folder</h2><p>Choose a topic group and give this subject a clear name.</p><label for="folderGroup">Topic group<select id="folderGroup"><option>TS</option><option>GS</option><option>VLSI</option><option selected>Other</option></select></label><label for="folderName">Subject name<input id="folderName" type="text" maxlength="60" placeholder="e.g. Digital Logic" autocomplete="off"></label><div class="folder-actions"><button type="button" class="secondary" id="folderCancel">Cancel</button><button type="button" id="folderCreate">Create folder</button></div></section>`;
      document.body.appendChild(dialog);
      const finish = value => { dialog.remove(); resolve(value); };
      $('folderCancel').onclick = () => finish(null);
      dialog.addEventListener('click', event => { if (event.target === dialog) finish(null); });
      dialog.addEventListener('keydown', event => { if (event.key === 'Escape') finish(null); });
      $('folderCreate').onclick = () => {
        const name = $('folderName').value.trim();
        if (!name) { $('folderName').focus(); toast('Enter a subject name first.'); return; }
        finish({ name, group: $('folderGroup').value });
      };
      $('folderName').addEventListener('keydown', event => { if (event.key === 'Enter') $('folderCreate').click(); });
      $('folderName').focus();
    });
  }

  const subjectButton = $('addSubject');
  if (subjectButton) subjectButton.onclick = async () => {
    const result = await createSubjectDialog();
    if (!result) return;
    if (!data.subjects.includes(result.name)) data.subjects.push(result.name);
    if (!data.subjectGroups || typeof data.subjectGroups !== 'object') data.subjectGroups = {};
    data.subjectGroups[result.name] = result.group;
    save(); renderLibrary(); toast(`Subject folder “${result.name}” created.`);
  };

  const addImage = $('addImage');
  if (addImage) {
    addImage.textContent = '＋ Choose screenshots';
    addImage.onclick = () => {
      if (!confirm('RevHub will open the system photo picker. You choose which screenshots the app can access. Continue?')) return;
      $('imageInput')?.click();
    };
  }

  function parseScreenshotText(text) {
    const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const optionPattern = /^\s*([A-Da-d]|[1-4])[).:\-]\s*(.+?)\s*$/;
    const options = [], stems = [];
    let foundOption = false, markedAnswer = '';
    const answerMatch = String(text || '').match(/(?:correct\s+answer|answer\s+key|\bans(?:wer)?\b)\s*[:\-]?\s*([A-D1-4])\b/i);
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
    return { question: stems.join(' ').replace(/\s+/g, ' ').trim(), options, answerIndex };
  }

  function reviewScreenshot(parsed, rawText, fileName) {
    return new Promise(resolve => {
      $('screenshotQuizDialog')?.remove();
      const dialog = document.createElement('div');
      dialog.id = 'screenshotQuizDialog';
      dialog.innerHTML = `<div class="sq-card" role="dialog" aria-modal="true" aria-labelledby="sqTitle"><h2 id="sqTitle">Review screenshot question</h2><p class="sq-hint">${escapeHtml(fileName)} · OCR may misread text. Confirm the question, choices and answer before saving. If the screenshot does not show an answer key or marked choice, select the correct answer yourself.</p><label>Question<textarea id="sqQuestion" rows="3"></textarea></label><label>Answer choices <span class="sq-hint">(one choice per line; enter at least two)</span><textarea id="sqOptions" rows="5"></textarea></label><div id="sqAnswerChoices"></div><p id="sqAnswerHint" class="sq-hint"></p><div class="sq-actions"><button type="button" class="secondary" id="sqCancel">Cancel screenshot</button><button type="button" id="sqSave">Save quiz question</button></div></div>`;
      document.body.appendChild(dialog);
      $('sqQuestion').value = parsed.question || String(rawText || '').trim();
      $('sqOptions').value = parsed.options.join('\n');
      const refreshAnswers = () => {
        const choices = $('sqOptions').value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
        const prior = dialog.querySelector('input[name="sqAnswer"]:checked');
        const selected = prior ? Number(prior.value) : parsed.answerIndex;
        $('sqAnswerChoices').innerHTML = choices.map((choice, index) => `<label class="sq-choice"><input type="radio" name="sqAnswer" value="${index}" ${index === selected ? 'checked' : ''}><span>${escapeHtml(choice)}</span></label>`).join('');
        $('sqAnswerHint').textContent = parsed.answerIndex >= 0 ? 'OCR detected a possible answer key or marked choice. Verify it against the screenshot.' : 'OCR did not reliably identify the correct answer. Please select it using the screenshot.';
      };
      $('sqOptions').addEventListener('input', refreshAnswers);
      refreshAnswers();
      $('sqCancel').onclick = () => { dialog.remove(); resolve(null); };
      $('sqSave').onclick = () => {
        const question = $('sqQuestion').value.trim();
        const options = $('sqOptions').value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
        const selected = dialog.querySelector('input[name="sqAnswer"]:checked');
        if (!question || options.length < 2 || !selected || Number(selected.value) >= options.length) { toast('Enter a question, at least two answer choices, and select the correct answer.'); return; }
        dialog.remove(); resolve({ question, options, answerIndex: Number(selected.value) });
      };
    });
  }

  function chooseSubject() {
    const choices = [...new Set([...(data.subjects || []), '＋ Add a new subject'])];
    const selected = prompt(`Choose a subject for the selected screenshot(s) by entering its number:\n${choices.map((name, index) => `${index + 1}. ${name}`).join('\n')}`, '1');
    if (selected === null) return null;
    const index = Number(selected) - 1;
    if (Number.isInteger(index) && index >= 0 && index < choices.length - 1) return choices[index];
    if (Number.isInteger(index) && index === choices.length - 1) {
      const result = prompt('Enter the new subject name');
      if (!result?.trim()) return null;
      const subject = result.trim();
      if (!data.subjects.includes(subject)) data.subjects.push(subject);
      return subject;
    }
    toast('Enter a valid subject number.');
    return null;
  }

  async function extractScreenshotOCR(file) {
    try {
      if (!window.Tesseract) await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
      });
      const result = await Tesseract.recognize(file, 'eng');
      return result.data.text.trim();
    } catch (error) { console.warn('Screenshot OCR failed', error); return ''; }
  }

  const imageInput = $('imageInput');
  if (imageInput) imageInput.onchange = async event => {
    const input = event.target;
    const files = Array.from(input.files || []).filter(file => file.type.startsWith('image/'));
    if (!files.length) { input.value = ''; return; }
    const subject = chooseSubject();
    if (!subject) { input.value = ''; return; }
    let saved = 0;
    try {
      for (const file of files) {
        toast(`Reading screenshot ${saved + 1} of ${files.length}: ${file.name}`);
        const rawText = await extractScreenshotOCR(file);
        if (!rawText) toast('OCR could not read this image. You can enter the question and choices manually.');
        const reviewed = await reviewScreenshot(parseScreenshotText(rawText), rawText, file.name);
        if (!reviewed) continue;
        const duplicate = data.questions.find(question => similarity(question.text, reviewed.question) >= 0.86);
        if (duplicate) {
          const message = `This question may duplicate one already saved under ${duplicate.subject}.`;
          if (mode() === 'auto' || !confirm(`${message}\n\nKeep another copy?`)) { toast(mode() === 'auto' ? `Duplicate skipped: ${message}` : 'Duplicate screenshot skipped.'); continue; }
        }
        const id = crypto.randomUUID();
        await assetPut(id, file);
        data.questions.push({ id, subject, text: reviewed.question, answer: reviewed.options[reviewed.answerIndex], options: reviewed.options, image: true, sourceName: file.name, duplicateOf: duplicate?.id || null });
        saved++; save();
      }
      renderLibrary();
      if (saved) toast(`${saved} screenshot${saved === 1 ? '' : 's'} saved as ${saved === 1 ? 'a quiz question' : 'quiz questions'} in ${subject}.`);
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
        const label = document.createElement('span');
        label.className = 'pill topic-group'; label.textContent = group;
        row.firstElementChild?.append(label);
      }
    });
  };
  try { renderLibrary(); } catch (_) { /* app data may still be initializing */ }
})();
