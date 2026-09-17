(() => {
  const BOT = 2;
  const HUMAN = 1;

  function legalMoves(board, player) {
    const moves = [];
    for (let r = 0; r < 9; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        const cell = board[r][c];
        if (cell.owner === 0 && cell.promisedOwner !== player) moves.push({ r, c });
      }
    }
    return moves;
  }

  function winsAfter(board, move, player) {
    const cell = board[move.r][move.c];
    if (cell.owner !== 0 || cell.promisedOwner === player) return false;
    cell.owner = player;
    const wins = checkWinBoard(board, player);
    cell.owner = 0;
    return wins;
  }

  function winningMoves(board, player) {
    return legalMoves(board, player).filter((move) => winsAfter(board, move, player));
  }

  function threatCount(board, move, player) {
    const cell = board[move.r][move.c];
    if (cell.owner !== 0 || cell.promisedOwner === player) return -1;
    cell.owner = player;
    const threats = winningMoves(board, player).length;
    cell.owner = 0;
    return threats;
  }

  function chooseTacticalMove() {
    const board = state.board;
    const legal = legalMoves(board, BOT);
    if (!legal.length) return null;

    const winning = winningMoves(board, BOT);
    if (winning.length) return winning[0];

    const opponentWinning = winningMoves(board, HUMAN);
    if (opponentWinning.length) {
      const forcedBlocks = legal.filter((move) =>
        opponentWinning.some((threat) => threat.r === move.r && threat.c === move.c)
      );
      if (opponentWinning.length === 1 && forcedBlocks.length) return forcedBlocks[0];

      let bestDefense = legal[0];
      let bestDefenseScore = -Infinity;
      for (const move of legal) {
        const ownThreats = threatCount(board, move, BOT);
        const remainingThreats = threatCount(board, move, HUMAN);
        const score = ownThreats * 100000 - remainingThreats * 10000;
        if (score > bestDefenseScore) {
          bestDefenseScore = score;
          bestDefense = move;
        }
      }
      return bestDefense;
    }

    let best = legal[0];
    let bestScore = -Infinity;
    let foundFork = false;
    for (const move of legal) {
      const ownThreats = threatCount(board, move, BOT);
      if (ownThreats < 2) continue;
      const opponentThreats = threatCount(board, move, HUMAN);
      const centerBonus = 8 - Math.abs(4 - move.r) - Math.abs(4 - move.c);
      const lineScore = typeof evaluateCellImpact === 'function'
        ? evaluateCellImpact(board, move.r, move.c, BOT)
        : 0;
      const score = ownThreats * 100000 - opponentThreats * 50000 + lineScore + centerBonus;
      if (score > bestScore) {
        bestScore = score;
        best = move;
        foundFork = true;
      }
    }

    return foundFork ? best : null;
  }

  const originalSearch = window.getBotBestMoveTreeSearch;
  window.getBotBestMoveTreeSearch = () => {
    const tactical = chooseTacticalMove();
    if (tactical) return tactical;
    return typeof originalSearch === 'function' ? originalSearch() : { r: 4, c: 4 };
  };
})();
