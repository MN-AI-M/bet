(() => {
  function canUseOnlineTurn() {
    return state.mode !== 'pvp_online' || state.currentPlayer === state.myOnlinePlayer;
  }

  window.handleCellClick = function (row, col) {
    if (state.mode === 'matching' || state.mode === 'menu' || isAiThinking || state.isGameOver ||
        (state.mode === 'pve' && state.currentPlayer === 2) || !canUseOnlineTurn()) return;
    if (state.isTutorial && state.tutorialStep === 1) {
      if (row !== 4 || col !== 4) return;
      clearTutorialHighlights();
    }
    if (state.phase !== 'ACTION_OR_PLACE') {
      if (state.phase === 'TARGET_SELECT' && state.targetCallback) {
        const callback = state.targetCallback;
        clearTargetSelection();
        callback(row, col);
      }
    } else {
      placeStone(row, col);
    }
  };

  window.sendPeerAction = function (type, payload = {}) {
    if (state.mode !== 'pvp_online' || !conn || state.currentPlayer !== state.myOnlinePlayer) return;
    conn.send({ type, player: state.myOnlinePlayer, ...payload });
  };

  window.handleP2PData = function (message) {
    if (!message || !message.type) return;
    if (message.type === 'HELLO') {
      state.onlinePeerReady = true;
      if (conn) conn.send({ type: 'SYNC_STATE', currentPlayer: state.currentPlayer, board: state.board, hands: state.hands, phase: state.phase });
      return;
    }
    if (message.type === 'SYNC_STATE') {
      state.currentPlayer = message.currentPlayer || state.currentPlayer;
      state.board = message.board || state.board;
      state.hands = message.hands || state.hands;
      state.phase = message.phase || state.phase;
      state.onlinePeerReady = true;
      renderBoard();
      renderHandUI();
      updateUI();
      return;
    }
    if (message.player !== getOpponentPlayer(state.myOnlinePlayer) || state.currentPlayer !== message.player) return;
    state.isApplyingRemoteP2PAction = true;
    try {
      if (message.type === 'PLACE_STONE') placeStone(message.r, message.c);
      if (message.type === 'USE_SKILL') executeSkill(message.skillId, message.target ? { dataset: { row: message.target.r, col: message.target.c } } : null);
    } finally {
      state.isApplyingRemoteP2PAction = false;
    }
  };

  const resultModal = document.getElementById('modal-result');
  if (resultModal) {
    new MutationObserver(() => {
      if (resultModal.classList.contains('hidden')) {
        return;
      }
      const resultMessage = document.getElementById('result-message');
      const winnerMatch = resultMessage && resultMessage.textContent.match(/Player\s+(1|2)/);
      const winner = winnerMatch ? Number(winnerMatch[1]) : 0;
      if (state.mode === 'pvp_online' && winner && winner !== state.myOnlinePlayer) {
        const title = document.getElementById('result-title');
        if (title) title.textContent = 'GAME OVER';
        if (resultMessage) resultMessage.textContent = '相手の勝利です';
      }
    }).observe(resultModal, { attributes: true, attributeFilter: ['class'] });
  }
})();
