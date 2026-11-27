(() => {
  const gate = document.getElementById('studyGate');
  if (!gate) return;

  // Keep the lock card interactive without letting its full-screen backdrop
  // swallow taps on the app navigation underneath it. The show() guard still
  // controls which pages can be opened while the study gate is locked.
  const style = document.createElement('style');
  style.id = 'studyGateNavigationRecovery';
  style.textContent = `
    #studyGate { pointer-events: none !important; }
    #studyGate .gate-card { pointer-events: auto !important; }
  `;
  if (!document.getElementById(style.id)) document.head.appendChild(style);

  const actions = gate.querySelector('.gate-card .row');
  if (!actions || document.getElementById('gateSettings')) return;

  const button = document.createElement('button');
  button.id = 'gateSettings';
  button.className = 'secondary';
  button.textContent = 'Open Settings';
  button.addEventListener('click', () => {
    gate.classList.add('hidden');
    show('settings');
  });
  actions.appendChild(button);
})();
