(() => {
  if (window.__revHubEnhancementsLoaded) return;
  window.__revHubEnhancementsLoaded = true;

  const SESSION_SECONDS = 90 * 60;
  const GATE_ENABLED_KEY = 'rh-study-gate-enabled';
  const GATE_LOCKED_KEY = 'rh-study-gate-locked';
  let gateLocked = localStorage.getItem(GATE_LOCKED_KEY) === 'true';
  let completionHandled = false;

  if (!data.daily) data.daily = { date: new Date().toLocaleDateString(), seconds: 0 };
  if (!Number.isFinite(data.daily.sessions)) data.daily.sessions = 0;

  const style = document.createElement('style');
  style.textContent = `
    #studyGate { position:fixed; inset:0; z-index:9999; display:grid; place-items:center; padding:24px; background:#0d111bf2; text-align:center; }
    #studyGate.hidden { display:none !important; }
    #studyGate .gate-card { width:min(440px,100%); padding:26px; border:1px solid #39445a; border-radius:22px; background:#171e2c; box-shadow:0 18px 50px #0008; }
    #studyGate h2 { margin:8px 0; color:#f3f5fa; }
    #studyGate p { color:#b5c0d0; line-height:1.5; }
    #studyGate .row { justify-content:center; }
    #studyGate button { margin:5px; }
    #conceptDone { margin-top:12px; width:100%; }
  `;
  document.head.appendChild(style);

  const gate = document.createElement('div');
  gate.id = 'studyGate';
  gate.className = 'hidden';
  gate.innerHTML = `<div class="gate-card"><div class="eyebrow">Study break-through</div><h2>Complete a quick revision</h2><p>Your 90-minute work session is complete. Revise a concept or answer a quiz question correctly to unlock RevHub.</p><div class="row"><button id="gateRevision">Revise a concept</button><button class="secondary" id="gateQuiz">Answer a quiz</button></div><p class="small">This gate applies inside RevHub only; it cannot lock or unlock other phone apps.</p></div>`;
  document.body.appendChild(gate);

  function gateEnabled() { return localStorage.getItem(GATE_ENABLED_KEY) === 'true'; }
  function showGate() { gate.classList.remove('hidden'); }
  function hideGate() { gate.classList.add('hidden'); }
  function unlock(reason) {
    if (!gateLocked) return;
    gateLocked = false;
    localStorage.setItem(GATE_LOCKED_KEY, 'false');
    hideGate();
    toast(reason || 'RevHub unlocked. Nice work!');
    show('home');
  }
  function openStudy(page) {
    hideGate();
    show(page);
  }

  document.getElementById('gateRevision').addEventListener('click', () => openStudy('revision'));
  document.getElementById('gateQuiz').addEventListener('click', () => openStudy('practice'));

  const originalShow = show;
  show = function (page) {
    if (gateLocked && !['revision', 'practice', 'settings'].includes(page)) {
      toast('Revise a concept or answer a quiz correctly to unlock RevHub.');
      return;
    }
    originalShow(page);
  };

  canUse = function () {
    if (!timeAllowed()) {
      toast('RevHub is available between 6 AM and 4 PM.');
      return false;
    }
    return true;
  };

  function refreshSessionUI() {
    const home = document.getElementById('home');
    if (home) {
      const stats = home.querySelectorAll('.stat');
      if (stats.length > 1) {
        const value = stats[1].querySelector('b');
        const label = stats[1].querySelector('span');
        const sessions = String(data.daily.sessions || 0);
        const labelText = 'NO. OF 90-MINUTE SESSIONS';
        if (value && value.textContent !== sessions) value.textContent = sessions;
        if (label && label.textContent !== labelText) label.textContent = labelText;
      }
    }
    const progress = document.getElementById('dailyBar');
    if (progress) {
      const width = `${Math.min(100, (data.daily.seconds / SESSION_SECONDS) * 100)}%`;
      if (progress.style.width !== width) progress.style.width = width;
    }
    const settingsPage = document.getElementById('settings');
    if (settingsPage) {
      const heading = [...settingsPage.querySelectorAll('h3')].find(item => item.textContent.includes('Study limits'));
      if (heading) {
        const firstParagraph = heading.parentElement.querySelector('p') || heading.nextElementSibling;
        const text = `No. of 90-minute sessions completed today: ${data.daily.sessions || 0}. Each session is 90 minutes.`;
        if (firstParagraph && firstParagraph.textContent !== text) firstParagraph.textContent = text;
      }
    }
  }

  const originalRenderHome = renderHome;
  renderHome = function () {
    originalRenderHome();
    refreshSessionUI();
  };

  const settings = document.getElementById('settings');
  settings.insertAdjacentHTML('beforeend', `<div class="section" id="studyGateSettings"><h3>Study-to-unlock</h3><label><input id="studyGateToggle" type="checkbox"> Require a revision or a correct quiz answer after each 90-minute session</label><p class="muted small">This only gates access inside RevHub. Android does not allow this app to control the whole phone lock screen.</p></div>`);
  const gateToggle = document.getElementById('studyGateToggle');
  gateToggle.checked = gateEnabled();
  gateToggle.addEventListener('change', () => {
    localStorage.setItem(GATE_ENABLED_KEY, gateToggle.checked ? 'true' : 'false');
    if (!gateToggle.checked) {
      gateLocked = false;
      localStorage.setItem(GATE_LOCKED_KEY, 'false');
      hideGate();
    }
    toast(gateToggle.checked ? 'Study-to-unlock enabled for RevHub.' : 'Study-to-unlock disabled.');
  });

  const conceptButton = document.createElement('button');
  conceptButton.id = 'conceptDone';
  conceptButton.textContent = 'I revised this concept — unlock RevHub';
  conceptButton.className = 'secondary';
  conceptButton.addEventListener('click', () => unlock('Concept revision confirmed. RevHub is unlocked.'));
  const reelBox = document.getElementById('reelBox');
  if (reelBox) reelBox.insertAdjacentElement('afterend', conceptButton);
  document.addEventListener('ended', event => {
    if (event.target && event.target.tagName === 'VIDEO' && gateLocked) unlock('Revision video completed. RevHub is unlocked.');
  }, true);

  const submitButton = document.getElementById('submitQ');
  if (submitButton && submitButton.onclick) {
    const originalSubmit = submitButton.onclick;
    submitButton.onclick = function (event) {
      originalSubmit.call(this, event);
      setTimeout(() => {
        const latest = data.attempts[data.attempts.length - 1];
        if (latest && latest.result === 'right') unlock('Correct answer! RevHub is unlocked.');
      }, 0);
    };
  }

  const resetButton = document.getElementById('resetToday');
  if (resetButton) resetButton.addEventListener('click', () => setTimeout(() => {
    data.daily.sessions = 0;
    save();
    refreshSessionUI();
  }, 0));

  setInterval(() => {
    if (data.daily.seconds >= SESSION_SECONDS && !completionHandled) {
      completionHandled = true;
      data.daily.sessions = (data.daily.sessions || 0) + 1;
      data.daily.seconds = 0;
      appActive = true;
      save();
      toast(`90-minute work session complete. Sessions today: ${data.daily.sessions}.`);
      if (gateEnabled()) {
        gateLocked = true;
        localStorage.setItem(GATE_LOCKED_KEY, 'true');
        showGate();
      }
    } else if (data.daily.seconds < SESSION_SECONDS) {
      completionHandled = false;
    }
    refreshSessionUI();
  }, 1000);

  if (gateLocked && gateEnabled()) showGate();
  else if (!gateEnabled()) {
    gateLocked = false;
    localStorage.setItem(GATE_LOCKED_KEY, 'false');
  }
  refreshSessionUI();
})();
