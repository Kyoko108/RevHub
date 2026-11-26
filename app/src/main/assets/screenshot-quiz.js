(() => {
  if (window.__revHubScreenshotQuizLoaded) return;
  window.__revHubScreenshotQuizLoaded = true;

  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const DUPLICATE_MODE_KEY = 'rh-screenshot-duplicate-mode';
  const mode = () => localStorage.getItem(DUPLICATE_MODE_KEY) || 'manual';
  const cleanQuestion = text => String(text || '').toLowerCase()
    .replace(/^[\s\d.)-]+/, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
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
    #screenshotQuizDialog[hidden] { display:none; }
    #screenshotQuizDialog .sq-card { width:min(620px,100%); max-height:90vh; overflow:auto; padding:22px; border:1px solid var(--line,#39445a); border-radius:18px; background:var(--panel,#171e2c); color:var(--text,#f3f5fa); }
    #screenshotQuizDialog textarea,#screenshotQuizDialog input[type=text] { width:100%; margin:7px 0 14px; padding:12px; border-radius:10px; border:1px solid var(--line,#39445a); background:var(--bg,#0d111b); color:var(--text,#f3f5fa); font:inherit; }
    #screenshotQuizDialog .sq-choice { display:flex; gap:10px; align-items:flex-start; padding:9px; border-radius:9px; background:var(--panel2,#202a3b); margin:6px 0; }
    #screenshotQuizDialog .sq-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:16px; }
    #screenshotQuizDialog .sq-hint { color:var(--muted,#9ba8bb); font-size:.9em; }
    #practiceCard .quiz-choice { display:flex; gap:10px; align-items:flex-start; padding:12px; margin:8px 0; border:1px solid var(--line,#2b3548); border-radius:12px; cursor:pointer; }
    #practiceCard .quiz-choice:has(input:checked) { border-color:var(--accent,#a78bfa); background:#a78bfa18; }
  `;
  document.head.appendChild(style);

  const settings = $('settings');
  if (settings && !$('screenshotSettings')) {
    settings.insertAdjacentHTML('beforeend', `<div class="section" id="screenshotSettings"><h3>Screenshot question import</h3><p class="muted small">Choose whether matching question screenshots are rejected automatically or reviewed each time.</p><label class="row"><input type="radio" name="duplicateMode" value="auto"> Automatically reject duplicate questions</label><label class="row"><input type="radio" name="duplicateMode" value="manual"> Ask me to keep or reject duplicates</label></div>`);
    document.querySelectorAll('input[name="duplicateMode"]').forEach(input => {
      input.checked = input.value === mode();
      input.addEventListener('change', () => {
        if (input.checked) {
          localStorage.setItem(DUPLICATE_MODE_KEY, input.value);
          toast(input.value === 'auto' ? 'Duplicate screenshots will be rejected automatically.' : 'You will review duplicate screenshots.');
        }
      });
    });
  }

  const subjectButton = $('addSubject');
  if (subjectButton) subjectButton.onclick = () => {
    const group = prompt('Topic group: TS, GS, VLSI, or Other', 'Other');
    if (group === null) return;
    const name = prompt(`Subject name inside ${group.trim() || 'Other'}`);
    if (name === null || !name.trim()) return;
    const subject = name.trim();
    if (!data.subjects.includes(subject)) data.subjects.push(subject);
    if (!data.subjectGroups || typeof data.subjectGroups !== 'object') data.subjectGroups = {};
    data.subjectGroups[subject] = group.trim() || 'Other';
    save(); renderLibrary(); toast(`Subject added under ${data.subjectGroups[subject]}.`);
  };

  const addImage = $('addImage');
  if (addImage) {
    addImage.textContent = '＋ Choose screenshots';
    addImage.onclick = () => {
      toast('Choose screenshots from your device when the file picker opens.');
      $('imageInput')?.click();
    };
  }

  function parseScreenshotText(text) {
    const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const optionPattern = /^\s*([A-Da-d]|[1-4])\s*[).:\-]\s*(.+?)\s*$/;
    const options = [];
    const stems = [];
    let foundOption = false;
    let detectedAnswer = '';
    const explicit = String(text || '').match(/(?:correct\s+answer|answer\s+key|\bans(?:wer)?\b)\s*[:\-]?\s*([A-D1-4])\b/i);
    for (const line of lines) {
      const match = line.match(optionPattern);
      if (match) {
        foundOption = true;
        let value = match[2].trim();
        if (/[✓✔☑]|\bcorrect\b/i.test(value)) detectedAnswer = value.replace(/[✓✔☑]/g, '').replace(/\bcorrect\b/ig, '').trim();
        options.push(value.replace(/[✓✔☑]/g, '').replace(/\s*\(correct\)\s*/ig, '').trim());
      } else if (!foundOption && !/^(?:correct\s+answer|answer\s+key|ans(?:wer)?)\s*[:\-]/i.test(line)) {
        stems.push(line);
      } else if (foundOption && options.length) {
        options[options.length - 1] += ` ${line}`;
      }
    }
    let answerIndex = -1;
    if (explicit && options.length) {
      const index = 'ABCD'.indexOf(explicit[1].toUpperCase());
      answerIndex = index >= 0 ? index : Number(explicit[1]) - 1;
    } else if (detectedAnswer) {
      answerIndex = options.findIndex(option => option === detectedAnswer || option.toLowerCase().includes(detectedAnswer.toLowerCase()));
    }
    if (answerIndex < 0 || answerIndex >= options.length) answerIndex = -1;
    return { question: stems.join(' ').replace(/\s+/g, ' ').trim(), options, answerIndex };
  }

  function reviewScreenshot(parsed, rawText) {
    return new Promise(resolve => {
      const old = $('screenshotQuizDialog');
      if (old) old.remove();
      const dialog = document.createElement('div');
      dialog.id = 'screenshotQuizDialog';
      dialog.innerHTML = `<div class="sq-card" role="dialog" aria-modal="true" aria-labelledby="sqTitle"><h2 id="sqTitle">Review screenshot question</h2><p class="sq-hint">OCR can misread text. Confirm the question, choices and correct answer before saving. Correct-answer detection is only suggested when the screenshot contains a readable answer key or check mark.</p><label>Question<textarea id="sqQuestion" rows="3"></textarea></label><label>Answer choices <span class="sq-hint">(one choice per line; use at least two)</span><textarea id="sqOptions" rows="5"></textarea></label><div id="sqAnswerChoices"></div><p id="sqAnswerHint" class="sq-hint"></p><div class="sq-actions"><button type="button" class="secondary" id="sqCancel">Cancel</button><button type="button" id="sqSave">Save question</button></div></div>`;
      document.body.appendChild(dialog);
      $('sqQuestion').value = parsed.question || rawText.trim();
      $('sqOptions').value = parsed.options.join('\n');
      const refreshAnswers = () => {
        const choices = $('sqOptions').value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
        const prior = dialog.querySelector('input[name="sqAnswer"]:checked');
        let selected = prior ? Number(prior.value) : parsed.answerIndex;
        $('sqAnswerChoices').innerHTML = choices.map((choice, index) => `<label class="sq-choice"><input type="radio" name="sqAnswer" value="${index}" ${index === selected ? 'checked' : ''}><span>${escapeHtml(choice)}</span></label>`).join('');
        $('sqAnswerHint').textContent = parsed.answerIndex >= 0 ? 'OCR found a possible marked/keyed answer. Please verify it.' : 'OCR did not reliably identify the correct answer. Select it from the screenshot.';
      };
      $('sqOptions').addEventListener('input', refreshAnswers);
      refreshAnswers();
      $('sqCancel').onclick = () => { dialog.remove(); resolve(null); };
      $('sqSave').onclick = () => {
        const question = $('sqQuestion').value.trim();
        const options = $('sqOptions').value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
        const selected = dialog.querySelector('input[name="sqAnswer"]:checked');
        if (!question || options.length < 2 || !selected) {
          toast('Enter a question, at least two choices, and select the correct answer.');
          return;
        }
        dialog.remove();
        resolve({ question, options, answerIndex: Number(selected.value) });
      };
    });
  }

  const imageInput = $('imageInput');
  if (imageInput) imageInput.onchange = async event => {
    const files = Array.from(event.target.files || []);
    let saved = 0;
    for (const file of files) {
      let subject = prompt(`Subject for this screenshot:\n${data.subjects.join(', ')}`, data.subjects[0] || 'General');
      if (!subject) continue;
      subject = subject.trim();
      if (!subject) continue;
      if (!data.subjects.includes(subject)) data.subjects.push(subject);
      toast(`Reading screenshot: ${file.name}`);
      const rawText = await extractOCR(file);
      if (!rawText) {
        if (!confirm('OCR could not read this image. Continue and enter the question and choices manually?')) continue;
      }
      const parsed = parseScreenshotText(rawText);
      const reviewed = await reviewScreenshot(parsed, rawText || '');
      if (!reviewed) continue;
      const duplicate = data.questions.find(question => similarity(question.text, reviewed.question) >= 0.86);
      if (duplicate) {
        const duplicateMessage = `This question appears to match an existing question in ${duplicate.subject}.`;
        if (mode() === 'auto') {
          toast(`Duplicate rejected: ${duplicateMessage}`);
          continue;
        }
        if (!confirm(`${duplicateMessage}\n\nKeep this screenshot as another copy? Choose Cancel to reject it.`)) {
          toast('Duplicate screenshot rejected.');
          continue;
        }
      }
      const answer = reviewed.options[reviewed.answerIndex];
      const id = crypto.randomUUID();
      await assetPut(id, file);
      data.questions.push({ id, subject, text: reviewed.question, answer, options: reviewed.options, image: true, duplicateOf: duplicate?.id || null });
      saved++;
    }
    save(); renderLibrary();
    if (saved) toast(`${saved} screenshot question${saved === 1 ? '' : 's'} added as radio-button quiz${saved === 1 ? '' : 'zes'}.`);
    event.target.value = '';
  };

  // Radio-button answer rendering uses the app's existing question data and checker.
  renderPractice = function () {
    if (!$('practiceFilter').options.length) $('practiceFilter').innerHTML = subjectsOptions();
    const questions = filteredQuestions();
    $('qCount').textContent = `${questions.length} questions`;
    const card = $('practiceCard');
    if (!questions.length) {
      card.innerHTML = '<p class="muted">No questions yet. Choose a screenshot in My Library or add a manual question.</p>';
      return;
    }
    practiceIndex = Math.max(0, Math.min(practiceIndex, questions.length - 1));
    const question = questions[practiceIndex];
    selectedChoice = null;
    questionStarted = Date.now();
    card.innerHTML = `<div class="row between"><span class="pill">${escapeHtml(question.subject)}</span><span class="muted small">${practiceIndex + 1} of ${questions.length}</span></div>${question.image ? '<p class="muted small">Screenshot question · OCR reviewed</p>' : ''}<div class="question">${escapeHtml(question.text)}</div>${question.options?.length ? question.options.map((option, index) => `<label class="quiz-choice"><input type="radio" name="practiceChoice" value="${index}"><span>${escapeHtml(option)}</span></label>`).join('') : '<input id="typedAnswer" class="field" placeholder="Type your answer">'}<div id="feedback"></div>`;
    card.querySelectorAll('input[name="practiceChoice"]').forEach(input => input.addEventListener('change', () => { selectedChoice = Number(input.value); }));
    $('submitQ').disabled = false;
  };

  // Keep the new subject topic group visible and retain compatibility with saved data.
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
        label.className = 'pill topic-group';
        label.textContent = group;
        row.firstElementChild?.append(label);
      }
    });
  };

  try { renderLibrary(); } catch (_) { /* page may still be initializing */ }
})();
