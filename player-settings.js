(() => {
    const storageKey = 'skill-tac-player-name';
    const tutorialCompletedKey = 'skill-tac-tutorial-completed';
    const defaultName = 'Player';
    let name = defaultName;
    let remoteName = '相手';
    try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            const parsed = saved.trim().startsWith('{') ? JSON.parse(saved) : saved;
            const migrated = typeof parsed === 'string' ? parsed : parsed[1];
            name = migrated && migrated.trim() ? migrated.trim() : defaultName
        } else {
            const oldSaved = JSON.parse(localStorage.getItem('skill-tac-player-names') || '{}');
            name = oldSaved[1] && oldSaved[1].trim() ? oldSaved[1].trim() : defaultName
        }
    } catch {
        name = defaultName
    }

    function saveNames() {
        localStorage.setItem(storageKey, name);
        refreshNames()
    }

    function refreshNames() {
        const playerOne = document.querySelector('#p1-info .p-name');
        const playerTwo = document.querySelector('#p2-info .p-name');
        const status = document.getElementById('status-turn');
        const online = typeof state !== 'undefined' && state.mode === 'pvp_online';
        const localPlayer = online ? state.myOnlinePlayer : 1;
        const playerNames = {
            1: localPlayer === 1 ? name : remoteName,
            2: localPlayer === 2 ? name : remoteName
        };
        if (playerOne && playerOne.textContent !== playerNames[1]) playerOne.textContent = playerNames[1];
        if (playerTwo && playerTwo.textContent !== playerNames[2]) playerTwo.textContent = playerNames[2];
        if (status && typeof state !== 'undefined') {
            const nextStatus = `${playerNames[state.currentPlayer] || remoteName} の番`;
            if (status.textContent !== nextStatus) status.textContent = nextStatus
        }
    }

    function createNameSettings() {
        const titleContent = document.querySelector('.title-content');
        const startButton = document.getElementById('btn-start');
        if (!titleContent || !startButton || document.getElementById('player-name-settings')) return;
        const settings = document.createElement('div');
        settings.id = 'player-name-settings';
        settings.style.cssText = 'display:grid;gap:8px;margin:14px 0;text-align:left;';
        settings.innerHTML = `
      <label style="display:flex;align-items:center;justify-content:space-between;gap:10px">name <input id="player-name" maxlength="20" autocomplete="off" style="min-width:0;flex:1;padding:6px;border:1px solid #cbd5e0;border-radius:6px"></label>
    `;
        titleContent.insertBefore(settings, startButton);
        const input = document.getElementById('player-name');
        input.value = name;
        input.addEventListener('input', () => {
            name = input.value.trim() || defaultName;
            saveNames()
        });
        refreshNames()
    }

    function disableAutoTutorial() {
        if (localStorage.getItem(tutorialCompletedKey) !== '1') return;
        const overlay = document.getElementById('tutorial-overlay');
        if (overlay) overlay.classList.add('hidden');
        if (typeof state !== 'undefined') state.isTutorial = !1;
        if (typeof setMode === 'function') setMode('pvp');
        const title = document.getElementById('screen-title');
        const game = document.getElementById('screen-game');
        if (title) title.classList.add('active');
        if (game) game.classList.remove('active');
        if (typeof initBgDemo === 'function') initBgDemo();
        refreshNames()
    }
    window.addEventListener('DOMContentLoaded', () => {
        createNameSettings();
        setTimeout(disableAutoTutorial, 0)
    });
    const tutorialOverlay = document.getElementById('tutorial-overlay');
    if (tutorialOverlay) {
        let wasVisible = !1;
        new MutationObserver(() => {
            const visible = !tutorialOverlay.classList.contains('hidden');
            if (visible) wasVisible = !0;
            if (wasVisible && !visible && typeof state !== 'undefined' && !state.isTutorial) {
                localStorage.setItem(tutorialCompletedKey, '1')
            }
        }).observe(tutorialOverlay, {
            attributes: !0,
            attributeFilter: ['class']
        })
    }
    const status = document.getElementById('status-turn');
    if (status) new MutationObserver(refreshNames).observe(status, {
        childList: !0,
        characterData: !0,
        subtree: !0
    });
    window.skillTacPlayerName = () => name;
    window.skillTacSetRemoteName = (value) => {
        remoteName = typeof value === 'string' && value.trim() ? value.trim() : '相手';
        refreshNames()
    };
    const originalHandleP2PData = window.handleP2PData;
    window.handleP2PData = (message) => {
        if (message && message.type === 'HELLO' && typeof conn !== 'undefined' && conn) {
            conn.send({
                type: 'PLAYER_NAME',
                name
            })
        }
        if (message && message.type === 'PLAYER_NAME') {
            window.skillTacSetRemoteName(message.name);
            return
        }
        if (message && message.type === 'SYNC_STATE' && message.name) {
            window.skillTacSetRemoteName(message.name)
        }
        if (typeof originalHandleP2PData === 'function') originalHandleP2PData(message);
        refreshNames()
    }
})()