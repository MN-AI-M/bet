(() => {
  const originalExecuteSkill = window.executeSkill;
  if (typeof originalExecuteSkill !== 'function') return;

  function destroyBestLine(target) {
    const row = Number(target.dataset.row);
    const col = Number(target.dataset.col);
    const opponent = getOpponentPlayer(state.currentPlayer);
    let rowCount = 0;
    let colCount = 0;

    for (let index = 0; index < 9; index += 1) {
      if (state.board[row][index].owner === opponent) rowCount += 1;
      if (state.board[index][col].owner === opponent) colCount += 1;
    }

    const destroyRow = rowCount >= colCount;
    for (let index = 0; index < 9; index += 1) {
      const cell = destroyRow ? state.board[row][index] : state.board[index][col];
      if (cell.owner === opponent) {
        cell.owner = 0;
        cell.isPhantom = false;
      }
    }

    if (state.mode === 'pvp_online' && conn && state.currentPlayer === state.myOnlinePlayer && !state.isApplyingRemoteP2PAction) {
      conn.send({ type: 'USE_SKILL', skillId: 4, target: { r: row, c: col } });
    }
    clearTargetSelection();
    renderBoard();
    renderHandUI();
    state.phase = 'ACTION_OR_PLACE';
    updateUI();
  }

  window.executeSkill = (skillId, target = null) => {
    if (skillId === 4 && target) {
      destroyBestLine(target);
      return;
    }
    originalExecuteSkill(skillId, target);
  };
})();
