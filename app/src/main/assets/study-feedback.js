(() => {
  if (window.__revHubStudyFeedbackLoaded) return;
  window.__revHubStudyFeedbackLoaded = true;

  const $ = id => document.getElementById(id);
  const style = document.createElement('style');
  style.textContent = `
    #rhFeedbackWave { position:fixed; inset:0; z-index:2000; pointer-events:none; opacity:0; }
    #rhFeedbackWave.play { animation:rh-feedback-spread 850ms ease-out forwards; }
    #rhFeedbackWave.good { background:radial-gradient(circle at center,rgba(34,197,94,.48),rgba(34,197,94,.22) 34%,transparent 74%); }
    #rhFeedbackWave.bad { background:radial-gradient(circle at center,rgba(239,68,68,.48),rgba(239,68,68,.22) 34%,transparent 74%); }
    @keyframes rh-feedback-spread { from { opacity:.95; transform:scale(.06); } to { opacity:0; transform:scale(2.5); } }
    #revisionRegistry .registry-item,#rhReviewQueue .registry-item { display:flex; flex-direction:column; gap:8px; padding:13px 0; border-top:1px solid var(--line,#2b3548); }
    #revisionRegistry .registry-title,#rhReviewQueue .registry-title { font-weight:650; overflow-wrap:anywhere; }
    #revisionRegistry .registry-actions,#rhReviewQueue .registry-actions { display:flex; flex-wrap:wrap; gap:7px; }
    #revisionRegistry .registry-status,#rhReviewQueue .registry-status { color:var(--muted,#9ba8bb); font-size:.85em; }
    #quizTimingSummary { line-height:1.55; }
    #rhFlashcardList { display:grid; gap:12px; }
    .rh-flashcard { border:1px solid var(--line,#2b3548); border-radius:16px; background:var(--panel2,#202a3b); padding:16px; }
    .rh-flashcard[data-reviewed="true"] { opacity:.68; }
    .rh-flashcard .flashcard-label { color:var(--muted,#9ba8bb); font-size:.78rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
    .rh-flashcard .flashcard-question { margin:8px 0; font-size:1.05rem; font-weight:700; white-space:pre-wrap; overflow-wrap:anywhere; }
    .rh-flashcard .flashcard-missed { color:var(--danger,#fb7185); margin:8px 0; overflow-wrap:anywhere; }
    .rh-flashcard .flashcard-answer { margin:10px 0; white-space:pre-wrap; overflow-wrap:anywhere; }
    .rh-flashcard .flashcard-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
    @media(prefers-reduced-motion:reduce) { #rhFeedbackWave.play { animation-duration:1ms; } }
  `;
  document.head.appendChild(style);

  const wave = document.createElement('div');
  wave.id = 'rhFeedbackWave';
  wave.setAttribute('aria-hidden', 'true');
  document.body.appendChild(wave);
  window.revHubFeedback = good => {
    wave.classList.remove('play', 'good', 'bad');
    void wave.offsetWidth;
    wave.classList.add(good ? 'good' : 'bad', 'play');
  };

  function recordConceptStatus(revised) {
    const reels = typeof filteredReels === 'function' ? filteredReels() : [];
    const reel = reels[typeof revIndex === 'number' ? revIndex : 0];
    if (!reel) { toast('Open a revision concept first, then mark its status.'); return; }
    reel.revised = revised;
    reel.revisedAt = new Date().toISOString();
    save(); window.revHubFeedback(revised);
    toast(revised ? 'Concept marked revised.' : 'Concept saved to your not-revised review list.');
    renderLibrary();
  }

  const done = $('conceptDone');
  if (done) {
    done.textContent = '✓ This concept has been revised';
    done.addEventListener('click', () => recordConceptStatus(true));
    let notDone = $('conceptNotDone');
    if (!notDone) {
      notDone = document.createElement('button'); notDone.id = 'conceptNotDone'; notDone.className = 'secondary';
      notDone.textContent = '✕ This concept has not been revised'; done.insertAdjacentElement('afterend', notDone);
    }
    notDone.addEventListener('click', () => recordConceptStatus(false));
  }

  function makeFlashcard(attempt) {
    if (!attempt || attempt.result !== 'wrong') return false;
    if (!Array.isArray(data.flashcards)) data.flashcards = [];
    const key = attempt.id || `${attempt.questionId || ''}|${attempt.at || ''}|${attempt.given || ''}`;
    if (data.flashcards.some(card => card.attemptKey === key)) return false;
    data.flashcards.unshift({ id: `fc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, attemptKey: key, questionId: attempt.questionId || '', subject: attempt.subject || (data.questions || []).find(question => question.id === attempt.questionId)?.subject || 'General', question: attempt.text || 'Question unavailable', missedAnswer: attempt.given || '(no answer recorded)', correctAnswer: attempt.answer || '(correct answer unavailable)', createdAt: attempt.at || new Date().toISOString(), reviewed: false });
    return true;
  }
  if (!Array.isArray(data.flashcards)) data.flashcards = [];
  (data.attempts || []).filter(attempt => attempt.result === 'wrong').forEach(makeFlashcard);

  function openItem(item, type) {
    if (type === 'reel') { $('revFilter').value = item.subject; revIndex = Math.max(0, filteredReels().findIndex(reel => reel.id === item.id)); show('revision'); renderRevision(); }
    else { $('practiceFilter').value = item.subject; practiceIndex = Math.max(0, filteredQuestions().findIndex(question => question.id === item.id)); show('practice'); renderPractice(); }
  }
  function addActionButton(parent, text, callback, className = '') { const button = document.createElement('button'); button.className = className; button.textContent = text; button.addEventListener('click', callback); parent.appendChild(button); return button; }

  function renderRegistry() {
    const parent = $('subjectList'); if (!parent) return;
    let registry = $('revisionRegistry');
    if (!registry) { registry = document.createElement('section'); registry.id = 'revisionRegistry'; registry.className = 'section'; parent.appendChild(registry); }
    registry.replaceChildren();
    const heading = document.createElement('h3'); heading.textContent = 'Revision registry'; registry.appendChild(heading);
    const entries = [...(data.reels || []).map(item => ({ item, type: 'reel', title: item.name || 'Revision video' })), ...(data.questions || []).map(item => ({ item, type: 'question', title: item.text || 'Untitled question' }))];
    if (!entries.length) { const empty = document.createElement('p'); empty.className = 'muted small'; empty.textContent = 'Saved revision videos and quiz questions will appear here.'; registry.appendChild(empty); return; }
    entries.forEach(({ item, type, title }) => {
      const row = document.createElement('article'); row.className = 'registry-item';
      const name = document.createElement('div'); name.className = 'registry-title'; name.textContent = title;
      const status = document.createElement('div'); status.className = 'registry-status'; status.textContent = `${item.subject || 'General'} · ${item.revised === true ? 'Revised' : item.revised === false ? 'Not revised · needs review' : 'Not marked'}`;
      const actions = document.createElement('div'); actions.className = 'registry-actions';
      addActionButton(actions, type === 'reel' ? 'Open revision video' : 'Open quiz question', () => openItem(item, type));
      if (type === 'reel') {
        addActionButton(actions, 'Mark revised', () => { item.revised = true; item.revisedAt = new Date().toISOString(); save(); window.revHubFeedback(true); renderLibrary(); }, 'secondary');
        addActionButton(actions, 'Mark not revised', () => { item.revised = false; item.revisedAt = new Date().toISOString(); save(); window.revHubFeedback(false); renderLibrary(); }, 'secondary');
      }
      row.append(name, status, actions); registry.appendChild(row);
    });
  }

  function renderReviewQueue() {
    const performance = $('performance'); if (!performance) return;
    let queue = $('rhReviewQueue');
    if (!queue) { queue = document.createElement('section'); queue.id = 'rhReviewQueue'; queue.className = 'section'; const historySection = $('historyList')?.parentElement; (historySection || performance).insertAdjacentElement('beforebegin', queue); }
    queue.replaceChildren();
    const title = document.createElement('h3'); title.textContent = 'Needs another review'; queue.appendChild(title);
    const wrongAttempts = (data.attempts || []).filter(attempt => attempt.result === 'wrong');
    const wrongByQuestion = new Map();
    wrongAttempts.forEach(attempt => { const key = attempt.questionId || attempt.text || `attempt-${wrongByQuestion.size}`; if (!wrongByQuestion.has(key)) wrongByQuestion.set(key, attempt); });
    const notRevised = (data.reels || []).filter(reel => reel.revised === false);
    const pending = [...[...wrongByQuestion.values()].map(item => ({ type: 'question', item })), ...notRevised.map(item => ({ type: 'reel', item }))];
    if (!pending.length) { const empty = document.createElement('p'); empty.className = 'muted small'; empty.textContent = 'No wrong answers or concepts marked not revised. They will be listed here when recorded.'; queue.appendChild(empty); return; }
    pending.forEach(({ type, item }) => {
      const row = document.createElement('article'); row.className = 'registry-item';
      const name = document.createElement('div'); name.className = 'registry-title'; name.textContent = type === 'question' ? item.text || 'Wrong answer' : item.name || 'Revision concept';
      const status = document.createElement('div'); status.className = 'registry-status'; status.textContent = type === 'question' ? `Wrong answer · ${item.subject || 'General'} · your answer: ${item.given || '—'} · correct: ${item.answer || '—'}` : `${item.subject || 'General'} · Marked not revised${item.revisedAt ? ` · ${new Date(item.revisedAt).toLocaleString()}` : ''}`;
      const actions = document.createElement('div'); actions.className = 'registry-actions';
      if (type === 'question') { const question = (data.questions || []).find(candidate => candidate.id === item.questionId); if (question) addActionButton(actions, 'Retry question', () => openItem(question, 'question')); }
      else { addActionButton(actions, 'Open concept', () => openItem(item, 'reel')); addActionButton(actions, 'Mark revised', () => { item.revised = true; item.revisedAt = new Date().toISOString(); save(); window.revHubFeedback(true); renderLibrary(); renderReviewQueue(); }, 'secondary'); }
      row.append(name, status, actions); queue.appendChild(row);
    });
  }

  function renderFlashcards() {
    const performance = $('performance'); if (!performance) return;
    let section = $('rhFlashcards');
    if (!section) { section = document.createElement('section'); section.id = 'rhFlashcards'; section.className = 'section'; const queue = $('rhReviewQueue'); (queue || $('historyList')?.parentElement || performance).insertAdjacentElement('afterend', section); }
    section.replaceChildren();
    const heading = document.createElement('h3'); heading.textContent = 'Wrong-answer flashcards'; section.appendChild(heading);
    const cards = Array.isArray(data.flashcards) ? data.flashcards : [];
    const list = document.createElement('div'); list.id = 'rhFlashcardList'; section.appendChild(list);
    if (!cards.length) { const empty = document.createElement('p'); empty.className = 'muted small'; empty.textContent = 'Flashcards are created automatically when you submit a wrong answer.'; list.appendChild(empty); return; }
    cards.forEach(card => {
      const article = document.createElement('article'); article.className = 'rh-flashcard'; article.dataset.reviewed = String(card.reviewed === true);
      const label = document.createElement('div'); label.className = 'flashcard-label'; label.textContent = `${card.subject || 'General'} · ${card.reviewed ? 'Reviewed' : 'Tap to reveal'}`;
      const question = document.createElement('div'); question.className = 'flashcard-question'; question.textContent = card.question;
      const missed = document.createElement('div'); missed.className = 'flashcard-missed'; missed.textContent = `Your answer: ${card.missedAnswer}`;
      const answer = document.createElement('div'); answer.className = 'flashcard-answer'; answer.hidden = true; answer.textContent = `Correct answer: ${card.correctAnswer}`;
      const actions = document.createElement('div'); actions.className = 'flashcard-actions';
      const reveal = document.createElement('button'); reveal.className = 'secondary'; reveal.textContent = 'Show answer'; reveal.addEventListener('click', () => { answer.hidden = !answer.hidden; reveal.textContent = answer.hidden ? 'Show answer' : 'Hide answer'; }); actions.appendChild(reveal);
      const reviewed = document.createElement('button'); reviewed.className = 'secondary'; reviewed.textContent = card.reviewed ? 'Mark to review again' : 'Mark reviewed'; reviewed.addEventListener('click', () => { card.reviewed = !card.reviewed; card.reviewedAt = card.reviewed ? new Date().toISOString() : null; save(); renderFlashcards(); }); actions.appendChild(reviewed);
      article.append(label, question, missed, answer, actions); list.appendChild(article);
    });
  }

  function renderQuizTimingSummary() {
    const performance = $('performance'); if (!performance) return;
    let summary = $('quizTimingSummary');
    if (!summary) { summary = document.createElement('div'); summary.id = 'quizTimingSummary'; summary.className = 'section'; summary.innerHTML = '<h3>Quiz timing & mistakes</h3><p class="muted small"></p>'; const history = $('historyList')?.parentElement; history?.insertAdjacentElement('beforebegin', summary); }
    const attempts = (data.attempts || []).filter(attempt => attempt.result === 'right' || attempt.result === 'wrong');
    const wrong = attempts.filter(attempt => attempt.result === 'wrong').length;
    const average = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + (Number(attempt.seconds) || 0), 0) / attempts.length) : 0;
    summary.querySelector('p').textContent = attempts.length ? `${attempts.length} answered · ${wrong} wrong · average ${fmt(average)} per question. Individual times are listed in Question history.` : 'Answer quiz questions to see your total wrong answers and average time per question.';
  }

  const submit = $('submitQ');
  if (submit) submit.addEventListener('click', () => setTimeout(() => {
    const latest = data.attempts?.[data.attempts.length - 1];
    if (latest?.result === 'right' || latest?.result === 'wrong') { if (latest.result === 'wrong') { makeFlashcard(latest); save(); } window.revHubFeedback(latest.result === 'right'); renderReviewQueue(); renderQuizTimingSummary(); renderFlashcards(); }
  }, 0));

  const priorRenderLibrary = renderLibrary;
  renderLibrary = function () { priorRenderLibrary(); renderRegistry(); renderReviewQueue(); };
  const priorRenderPerformance = renderPerformance;
  renderPerformance = function () { priorRenderPerformance(); renderQuizTimingSummary(); renderReviewQueue(); renderFlashcards(); };
  try { if ((data.attempts || []).some(attempt => attempt.result === 'wrong')) save(); renderLibrary(); renderQuizTimingSummary(); renderReviewQueue(); renderFlashcards(); } catch (_) { /* app data may still be loading */ }
})();
