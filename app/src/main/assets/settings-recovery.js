(() => {
  const gate = document.getElementById('studyGate');
  const actions = gate?.querySelector('.gate-card .row');
  if (!gate || !actions || document.getElementById('gateSettings')) return;

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
