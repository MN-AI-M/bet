(() => {
  const completedKey = 'skill-tac-tutorial-completed';

  function applyTutorialState() {
    document.getElementById('btn-tutorial-open')?.remove();
    if (localStorage.getItem(completedKey) === '1') {
      document.getElementById('tutorial-overlay')?.classList.add('hidden');
      if (typeof state !== 'undefined') state.isTutorial = false;
      document.getElementById('screen-title')?.classList.add('active');
      document.getElementById('screen-game')?.classList.remove('active');
    } else if (typeof startTutorial === 'function' && typeof state !== 'undefined' && !state.isTutorial) {
      startTutorial();
    }
  }

  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(applyTutorialState, 0));
  else setTimeout(applyTutorialState, 0);
  const overlay = document.getElementById('tutorial-overlay');
  if (overlay) {
    let wasVisible = false;
    new MutationObserver(() => {
      const visible = !overlay.classList.contains('hidden');
      if (visible) wasVisible = true;
      if (wasVisible && !visible && typeof state !== 'undefined' && !state.isTutorial) {
        localStorage.setItem(completedKey, '1');
      }
    }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
  }
})();
