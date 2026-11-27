(() => {
  const gate = document.getElementById('studyGate');

  // A stale saved lock must never leave the app's full-screen gate covering
  // navigation. This recovery script runs after the main app and its add-ons.
  localStorage.setItem('rh-study-gate-locked', 'false');
  localStorage.setItem('rh-study-gate-enabled', 'false');
  gate?.classList.add('hidden');

  if (gate) {
    const style = document.createElement('style');
    style.id = 'studyGateNavigationRecovery';
    style.textContent = `
      #studyGate, #breakScreen { display: none !important; pointer-events: none !important; }
      #studyGate .gate-card { pointer-events: auto !important; }
    `;
    if (!document.getElementById(style.id)) document.head.appendChild(style);
  }

  function openPage(page) {
    // Clear the lock before calling the app router, then use a DOM fallback if
    // a stale injected wrapper prevents the page from switching.
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

  // Capture navigation taps before older or injected handlers can swallow them.
  document.addEventListener('click', event => {
    const element = event.target instanceof Element ? event.target.closest('[data-go]') : null;
    if (!element) return;
    const page = element.getAttribute('data-go');
    if (!page) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openPage(page);
  }, true);

  // Also keep the main nav reachable if WebView touch synthesis is inconsistent.
  document.querySelectorAll('.nav [data-go]').forEach(button => {
    button.addEventListener('touchend', event => {
      const page = button.getAttribute('data-go');
      if (!page) return;
      event.preventDefault();
      openPage(page);
    }, { passive: false });
  });
})();
