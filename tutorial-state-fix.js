(() => {
    const completedKey = 'skill-tac-tutorial-completed';
    if (new URLSearchParams(location.search).get('reset-tutorial') === '1') {
        localStorage.removeItem(completedKey);
        history.replaceState(null, '', location.pathname)
    }
    const originalStartTutorial = window.startTutorial;
    if (typeof originalStartTutorial === 'function') {
        window.startTutorial = () => {
            if (localStorage.getItem(completedKey) === '1' || state.isTutorial) return;
            originalStartTutorial()
        }
    }

    function addTutorialCardClickFallback() {
        const card = document.querySelector('#skills-list .skill-card-item');
        if (!card || card.dataset.tutorialClickFallback === '1') return;
        card.dataset.tutorialClickFallback = '1';
        card.addEventListener('click', () => {
            if (!state.isTutorial || state.tutorialStep !== 2 || state.phase !== 'ACTION_OR_PLACE') return;
            state.hands[1].splice(0, 1);
            executeSkill(2);
            renderHandUI()
        })
    }
    const originalAdvanceTutorialStep2 = window.advanceTutorialStep2;
    if (typeof originalAdvanceTutorialStep2 === 'function') {
        window.advanceTutorialStep2 = () => {
            originalAdvanceTutorialStep2();
            if (state.isTutorial && state.tutorialStep === 2 && state.hands[1].length > 1) {
                state.hands[1] = state.hands[1].slice(0, 1);
                renderHandUI();
                addTutorialCardClickFallback()
            }
        }
    }

    function applyTutorialState() {
        document.getElementById('btn-tutorial-open')?.remove();
        if (localStorage.getItem(completedKey) === '1') {
            document.getElementById('tutorial-overlay')?.classList.add('hidden');
            if (typeof state !== 'undefined') state.isTutorial = !1;
            document.getElementById('screen-title')?.classList.add('active');
            document.getElementById('screen-game')?.classList.remove('active')
        } else if (typeof window.startTutorial === 'function' && typeof state !== 'undefined' && !state.isTutorial) {
            startTutorial()
        }
    }
    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(applyTutorialState, 0));
    else setTimeout(applyTutorialState, 0);
    const overlay = document.getElementById('tutorial-overlay');
    if (overlay) {
        let wasVisible = !1;
        new MutationObserver(() => {
            const visible = !overlay.classList.contains('hidden');
            if (visible) wasVisible = !0;
            if (wasVisible && !visible && typeof state !== 'undefined' && !state.isTutorial) {
                localStorage.setItem(completedKey, '1')
            }
        }).observe(overlay, {
            attributes: !0,
            attributeFilter: ['class']
        })
    }
})()