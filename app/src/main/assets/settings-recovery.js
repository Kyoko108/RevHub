(() => {
  const gate = document.getElementById('studyGate');
  if (gate) {
    // Do not let the full-screen lock backdrop intercept app navigation taps.
    const style = document.createElement('style');
    style.id = 'studyGateNavigationRecovery';
    style.textContent = `
      #studyGate { pointer-events: none !important; }
      #studyGate .gate-card { pointer-events: auto !important; }
    `;
    if (!document.getElementById(style.id)) document.head.appendChild(style);

    const actions = gate.querySelector('.gate-card .row');
    if (actions && !document.getElementById('gateSettings')) {
      const button = document.createElement('button');
      button.id = 'gateSettings';
      button.className = 'secondary';
      button.textContent = 'Open Settings';
      button.addEventListener('click', () => openPage('settings'));
      actions.appendChild(button);
    }
  }

  function openPage(page) {
    // Selecting a tab is an explicit request to continue using the app. Clear
    // any stale study lock so navigation doesn't silently appear unresponsive.
    localStorage.setItem('rh-study-gate-locked', 'false');
    gate?.classList.add('hidden');
    if (typeof show === 'function') show(page);
  }

  // Run in capture phase so this still works if another injected script or a
  // stale lock handler interferes with the normal data-go click listeners.
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('[data-go]') : null;
    if (!target) return;
    const page = target.getAttribute('data-go');
    if (!page) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openPage(page);
  }, true);
})();
