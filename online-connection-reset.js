(() => {
  let cleanupInProgress = false;

  function removeConnectionListeners(connection) {
    if (!connection) return;
    if (typeof connection.removeAllListeners === 'function') {
      connection.removeAllListeners('data');
      connection.removeAllListeners('close');
      connection.removeAllListeners('error');
    }
  }

  function resetOnlineConnection() {
    if (cleanupInProgress) return;
    cleanupInProgress = true;
    const oldConnection = typeof conn !== 'undefined' ? conn : null;
    const oldPeer = typeof peer !== 'undefined' ? peer : null;
    conn = null;
    peer = null;
    if (typeof state !== 'undefined') {
      state.onlinePeerReady = false;
    }
    removeConnectionListeners(oldConnection);
    if (oldConnection && typeof oldConnection.close === 'function') oldConnection.close();
    if (oldPeer && typeof oldPeer.removeAllListeners === 'function') oldPeer.removeAllListeners();
    if (oldPeer && typeof oldPeer.destroy === 'function' && !oldPeer.destroyed) oldPeer.destroy();
    cleanupInProgress = false;
  }

  const originalStartOnlineMatchSearch = window.startOnlineMatchSearch;
  if (typeof originalStartOnlineMatchSearch === 'function') {
    window.startOnlineMatchSearch = (...args) => {
      resetOnlineConnection();
      return originalStartOnlineMatchSearch(...args);
    };
  }

  const originalShowTitleScreen = window.showTitleScreen;
  if (typeof originalShowTitleScreen === 'function') {
    window.showTitleScreen = (...args) => {
      resetOnlineConnection();
      return originalShowTitleScreen(...args);
    };
  }

  window.skillTacResetOnlineConnection = resetOnlineConnection;
})();
