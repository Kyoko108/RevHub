(() => {
  const gate = document.getElementById('studyGate');

  // Recovery from a persisted study lock that could otherwise cover the UI.
  localStorage.setItem('rh-study-gate-locked', 'false');
  localStorage.setItem('rh-study-gate-enabled', 'false');
  gate?.classList.add('hidden');

  const recoveryStyle = document.createElement('style');
  recoveryStyle.id = 'revHubInteractionRecovery';
  recoveryStyle.textContent = `
    #studyGate, #breakScreen { display:none !important; pointer-events:none !important; }
    #studyGate .gate-card { pointer-events:auto !important; }
    #revision #markRevised, #revision #markNeedsRevision,
    #revision #conceptDone, #revision #conceptNotDone { display:none !important; }
    #revision .reel-actions { display:none !important; }
  `;
  if (!document.getElementById(recoveryStyle.id)) document.head.appendChild(recoveryStyle);

  function openPage(page) {
    localStorage.setItem('rh-study-gate-locked', 'false');
    gate?.classList.add('hidden');
    if (typeof show === 'function') {
      try { show(page); } catch (error) { console.error('Navigation failed', error); }
    }
    const selected = document.getElementById(page);
    if (!selected) return;
    if (selected.classList.contains('hidden')) {
      document.querySelectorAll('.page').forEach(section => section.classList.toggle('hidden', section !== selected));
      document.querySelectorAll('.nav [data-go]').forEach(button => button.classList.toggle('active', button.getAttribute('data-go') === page));
    }
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', event => {
    const element = event.target instanceof Element ? event.target.closest('[data-go]') : null;
    if (!element) return;
    const page = element.getAttribute('data-go');
    if (!page) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openPage(page);
  }, true);

  document.querySelectorAll('.nav [data-go]').forEach(button => {
    button.addEventListener('touchend', event => {
      const page = button.getAttribute('data-go');
      if (!page) return;
      event.preventDefault();
      openPage(page);
    }, { passive: false });
  });

  // Route both reel-upload controls through the native WebView file chooser.
  const videoInput = document.getElementById('videoInput');
  for (const id of ['quickVideo', 'addVideo']) {
    const button = document.getElementById(id);
    if (!button || !videoInput) continue;
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      videoInput.accept = 'video/*';
      videoInput.multiple = true;
      videoInput.click();
    }, true);
  }

  // Keep the practice timer visibly live; reset its starting point when a new
  // question is rendered by the app's existing renderer.
  const practiceCard = document.getElementById('practiceCard');
  if (practiceCard && typeof MutationObserver !== 'undefined') {
    let lastQuestion = '';
    new MutationObserver(() => {
      const question = practiceCard.querySelector('.question')?.textContent?.trim() || '';
      if (question && question !== lastQuestion) {
        lastQuestion = question;
        questionStarted = Date.now();
      }
    }).observe(practiceCard, { childList: true, subtree: true, characterData: true });
  }

  setInterval(() => {
    const timer = document.getElementById('questionTimer');
    const practice = document.getElementById('practice');
    if (!timer || !practice || practice.classList.contains('hidden')) return;
    if (!Number.isFinite(questionStarted) || questionStarted <= 0) questionStarted = Date.now();
    const elapsed = Math.max(0, Math.floor((Date.now() - questionStarted) / 1000));
    timer.textContent = typeof fmt === 'function' ? fmt(elapsed) : `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  }, 1000);
})();
