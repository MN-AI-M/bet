(() => {
    let cleanupInProgress = !1;

    function removeConnectionListeners(connection) {
        if (!connection) return;
        if (typeof connection.removeAllListeners === 'function') {
            connection.removeAllListeners('data');
            connection.removeAllListeners('close');
            connection.removeAllListeners('error')
        }
    }

    function resetOnlineConnection() {
        if (cleanupInProgress) return;
        cleanupInProgress = !0;
        const oldConnection = typeof conn !== 'undefined' ? conn : null;
        const oldPeer = typeof peer !== 'undefined' ? peer : null;
        conn = null;
        peer = null;
        if (typeof state !== 'undefined') {
            state.onlinePeerReady = !1
        }
        removeConnectionListeners(oldConnection);
        if (oldConnection && typeof oldConnection.close === 'function') oldConnection.close();
        if (oldPeer && typeof oldPeer.removeAllListeners === 'function') oldPeer.removeAllListeners();
        if (oldPeer && typeof oldPeer.destroy === 'function' && !oldPeer.destroyed) oldPeer.destroy();
        cleanupInProgress = !1
    }
    const originalStartOnlineMatchSearch = window.startOnlineMatchSearch;
    if (typeof originalStartOnlineMatchSearch === 'function') {
        window.startOnlineMatchSearch = (...args) => {
            resetOnlineConnection();
            return originalStartOnlineMatchSearch(...args)
        }
    }
    const originalShowTitleScreen = window.showTitleScreen;
    if (typeof originalShowTitleScreen === 'function') {
        window.showTitleScreen = (...args) => {
            resetOnlineConnection();
            return originalShowTitleScreen(...args)
        }
    }
    window.skillTacResetOnlineConnection = resetOnlineConnection
})()