(() => {
  if (window.__revHubStudyFeedbackLoaded) return;
  window.__revHubStudyFeedbackLoaded = true;

  const $ = id => document.getElementById(id);
  const style = document.createElement('style');
  style.textContent = `
    #rhFeedbackWave { position:fixed; inset:0; z-index:2000; pointer-events:none; opacity:0; }
    #rhFeedbackWave.play { animation:rh-feedback-spread 850ms ease-out forwards; }
    #rhFeedbackWave.good { background:radial-gradient(circle at center,rgba(34,197,94,.42),rgba(34,197,94,.18) 30%,transparent 72%); }
    #rhFeedbackWave.bad { background:radial-gradient(circle at center,rgba(239,68,68,.42),rgba(239,68,68,.18) 30%,transparent 72%); }
    @keyframes rh-feedback-spread { from { opacity:.9; transform:scale(.08); } to { opacity:0; transform:scale(2.4); } }
    #revisionRegistry .registry-item { display:flex; flex-direction:column; gap:8px; padding:13px 0; border-top:1px solid var(--line,#2b3548); }
    #revisionRegistry .registry-title { font-weight:650; overflow-wrap:anywhere; }
    #revisionRegistry .registry-actions { display:flex; flex-wrap:wrap; gap:7px; }
    #revisionRegistry .registry-status { color:var(--muted,#9ba8bb); font-size:.85em; }
    #quizTimingSummary { line-height:1.55; }
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

  const done = $('conceptDone');
  if (done) {
    done.textContent = '✓ This concept is revised';
    done.addEventListener('click', () => {
      const reel = typeof filteredReels === 'function' ? filteredReels()[revIndex] : null;
      if (reel) { reel.revised = true; save(); }
      window.revHubFeedback(true);
    });
    const notDone = document.createElement('button');
    notDone.id = 'conceptNotDone';
    notDone.className = 'secondary';
    notDone.textContent = '✕ This concept is not revised';
    notDone.addEventListener('click', () => {
      const reel = typeof filteredReels === 'function' ? filteredReels()[revIndex] : null;
      if (reel) { reel.revised = false; save(); }
      window.revHubFeedback(false);
      toast('Marked as not revised.');
    });
    done.insertAdjacentElement('afterend', notDone);
  }

  const submit = $('submitQ');
  if (submit) submit.addEventListener('click', () => setTimeout(() => {
    const latest = data.attempts?.[data.attempts.length - 1];
    if (latest?.result === 'right' || latest?.result === 'wrong') window.revHubFeedback(latest.result === 'right');
  }, 0));

  function openItem(item, type) {
    if (type === 'reel') {
      $('revFilter').value = item.subject;
      revIndex = Math.max(0, filteredReels().findIndex(reel => reel.id === item.id));
      show('revision');
      renderRevision();
    } else {
      $('practiceFilter').value = item.subject;
      practiceIndex = Math.max(0, filteredQuestions().findIndex(question => question.id === item.id));
      show('practice');
      renderPractice();
    }
  }

  function renderRegistry() {
    const parent = $('subjectList');
    if (!parent) return;
    let registry = $('revisionRegistry');
    if (!registry) {
      registry = document.createElement('section');
      registry.id = 'revisionRegistry';
      registry.className = 'section';
      parent.appendChild(registry);
    }
    registry.replaceChildren();
    const heading = document.createElement('h3');
    heading.textContent = 'Revision registry';
    registry.appendChild(heading);
    const entries = [
      ...(data.reels || []).map(item => ({ item, type: 'reel', title: item.name || 'Revision video' })),
      ...(data.questions || []).map(item => ({ item, type: 'question', title: item.text || 'Untitled question' }))
    ];
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'muted small';
      empty.textContent = 'Saved revision videos and quiz questions will appear here.';
      registry.appendChild(empty);
      return;
    }
    entries.forEach(({ item, type, title }) => {
      const row = document.createElement('article');
      row.className = 'registry-item';
      const name = document.createElement('div');
      name.className = 'registry-title';
      name.textContent = title;
      const status = document.createElement('div');
      status.className = 'registry-status';
      status.textContent = `${item.subject || 'General'} · ${item.revised === true ? 'Revised' : item.revised === false ? 'Not revised' : 'Not marked'}`;
      const actions = document.createElement('div');
      actions.className = 'registry-actions';
      const open = document.createElement('button');
      open.textContent = type === 'reel' ? 'Open revision video' : 'Open quiz question';
      open.addEventListener('click', () => openItem(item, type));
      const mark = (value, label) => {
        const button = document.createElement('button');
        button.className = 'secondary';
        button.textContent = label;
        button.addEventListener('click', () => {
          item.revised = value;
          save();
          window.revHubFeedback(value);
          renderLibrary();
        });
        return button;
      };
      actions.append(open, mark(true, 'Mark revised'), mark(false, 'Mark not revised'));
      row.append(name, status, actions);
      registry.appendChild(row);
    });
  }

  function renderQuizTimingSummary() {
    const performance = $('performance');
    if (!performance) return;
    let summary = $('quizTimingSummary');
    if (!summary) {
      summary = document.createElement('div');
      summary.id = 'quizTimingSummary';
      summary.className = 'section';
      summary.innerHTML = '<h3>Quiz timing & mistakes</h3><p class="muted small"></p>';
      const history = $('historyList')?.parentElement;
      history?.insertAdjacentElement('beforebegin', summary);
    }
    const attempts = (data.attempts || []).filter(attempt => attempt.result === 'right' || attempt.result === 'wrong');
    const wrong = attempts.filter(attempt => attempt.result === 'wrong').length;
    const average = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + (Number(attempt.seconds) || 0), 0) / attempts.length) : 0;
    summary.querySelector('p').textContent = attempts.length
      ? `${attempts.length} answered · ${wrong} wrong · average ${fmt(average)} per question. Individual times are listed in Question history.`
      : 'Answer quiz questions to see your total wrong answers and average time per question.';
  }

  const priorRenderLibrary = renderLibrary;
  renderLibrary = function () {
    priorRenderLibrary();
    renderRegistry();
  };
  const priorRenderPerformance = renderPerformance;
  renderPerformance = function () {
    priorRenderPerformance();
    renderQuizTimingSummary();
  };
  try { renderLibrary(); renderQuizTimingSummary(); } catch (_) { /* app data may still be loading */ }
})();
