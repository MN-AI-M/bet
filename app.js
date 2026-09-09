const BOARD_SIZE = 9;
const WIN_COUNT = 5;

const SKILLS = [
  { id: 1, name: "ハズレ", desc: "何も起きない" },
  { id: 2, name: "一手消去", desc: "相手の石1個消去" },
  { id: 3, name: "視界潰し", desc: "相手の視界妨害" },
  { id: 4, name: "一列消去", desc: "相手が並ぶ1列消去" },
  { id: 5, name: "追加ターン", desc: "もう一度自分の番" },
  { id: 6, name: "強制リセット", desc: "5%で相手石2個消去" },
  { id: 7, name: "浸食", desc: "指定マスを自分の色に" },
  { id: 8, name: "確約", desc: "指定マスに相手配置不可" },
  { id: 9, name: "爆弾(5%)", desc: "3x3強制消去(5%)" },
  { id: 10, name: "幻影", desc: "偽石を3個配置(3T)" },
  { id: 11, name: "すり替え", desc: "相手の次カードをハズレに" },
  { id: 12, name: "罠", desc: "見えない罠を設置" }
];

const state = {
  mode: 'pvp',
  currentPlayer: 1,
  phase: 'PLACE',
  board: [],
  hands: { 1: [], 2: [] }, 
  drawnCard: null,         
  targetCallback: null,
  fogForPlayer: null,
  fogArea: null,
  overrideNextCard: {},
  phantomStones: []
};

const elements = {
  screenTitle: document.getElementById('screen-title'),
  screenGame: document.getElementById('screen-game'),
  btnPvp: document.getElementById('btn-pvp'),
  btnPve: document.getElementById('btn-pve'),
  btnStart: document.getElementById('btn-start'),
  board: document.getElementById('board'),
  fogOverlay: document.getElementById('fog-overlay'),
  statusTurn: document.getElementById('status-turn'),
  statusPhase: document.getElementById('status-phase'),
  p1Info: document.getElementById('p1-info'),
  p2Info: document.getElementById('p2-info'),
  modalResult: document.getElementById('modal-result'),
  resultTitle: document.getElementById('result-title'),
  resultMessage: document.getElementById('result-message'),
  modalGetCard: document.getElementById('modal-get-card'),
  getCardTitle: document.getElementById('get-card-title'),
  getCardDesc: document.getElementById('get-card-desc'),
  modalSkills: document.getElementById('modal-skills'),
  skillsList: document.getElementById('skills-list'),
  btnSkipSkill: document.getElementById('btn-skip-skill')
};

/* =======================================
   背景デモ対戦 (Bot vs Bot) ロジック
======================================= */
let bgDemoInterval = null;
let bgBoardState = [];
let bgCurrentPlayer = 1;

function initBgDemo() {
  const bgBoardEl = document.getElementById('bg-board');
  if (!bgBoardEl) return;

  bgBoardEl.innerHTML = '';
  bgBoardState = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => ({ owner: 0, isPhantom: false, promisedOwner: 0, trapOwner: 0 }))
  );
  bgCurrentPlayer = 1;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      bgBoardEl.appendChild(cell);
    }
  }

  if (bgDemoInterval) clearInterval(bgDemoInterval);
  bgDemoInterval = setInterval(stepBgDemo, 500);
}

function renderBgBoard() {
  const bgBoardEl = document.getElementById('bg-board');
  if (!bgBoardEl) return;
  const cells = bgBoardEl.children;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const idx = r * BOARD_SIZE + c;
      const cellData = bgBoardState[r][c];
      const cell = cells[idx];
      
      cell.className = 'cell';
      cell.textContent = '';
      if (cellData.owner === 1) {
        cell.textContent = '〇';
        cell.classList.add('p1');
      } else if (cellData.owner === 2) {
        cell.textContent = '✕';
        cell.classList.add('p2');
      }
    }
  }
}

function stepBgDemo() {
  const candidates = getTopCandidateMoves(bgBoardState, bgCurrentPlayer, 5);
  if (candidates.length === 0 || checkWinBoard(bgBoardState, 1) || checkWinBoard(bgBoardState, 2)) {
    initBgDemo();
    return;
  }

  const move = candidates[Math.floor(Math.random() * Math.min(2, candidates.length))];
  bgBoardState[move.r][move.c].owner = bgCurrentPlayer;

  renderBgBoard();

  if (checkWinBoard(bgBoardState, bgCurrentPlayer)) {
    setTimeout(initBgDemo, 1500);
  } else {
    bgCurrentPlayer = bgCurrentPlayer === 1 ? 2 : 1;
  }
}

function stopBgDemo() {
  if (bgDemoInterval) {
    clearInterval(bgDemoInterval);
    bgDemoInterval = null;
  }
}

/* =======================================
   メインゲーム ロジック
======================================= */

window.addEventListener('DOMContentLoaded', () => {
  init();
  initBgDemo();
  initDraggableScroll();
});

function init() {
  elements.btnPvp.addEventListener('click', () => setMode('pvp'));
  elements.btnPve.addEventListener('click', () => setMode('pve'));
  elements.btnStart.addEventListener('click', startGame);
  elements.btnSkipSkill.addEventListener('click', handleSkipAction);
  document.getElementById('btn-restart').addEventListener('click', startGame);
  document.getElementById('btn-to-title').addEventListener('click', showTitleScreen);

  elements.modalGetCard.addEventListener('click', () => {
    elements.modalGetCard.classList.add('hidden');
    openSkillModal();
  });
}

// マウスドラッグで横スクロール（スワイプ）できるようにする設定
function initDraggableScroll() {
  const slider = elements.skillsList;
  if (!slider) return;

  let isDown = false;
  let startX;
  let scrollLeft;

  // --- マウス操作 ---
  slider.addEventListener('mousedown', (e) => {
    isDown = true;
    slider.classList.add('active');
    startX = e.pageX - slider.offsetLeft;
    scrollLeft = slider.scrollLeft;
  });

  slider.addEventListener('mouseleave', () => {
    isDown = false;
    slider.classList.remove('active');
  });

  slider.addEventListener('mouseup', () => {
    isDown = false;
    slider.classList.remove('active');
  });

  slider.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - slider.offsetLeft;
    const walk = (x - startX) * 1.5; // スクロール感度
    slider.scrollLeft = scrollLeft - walk;
  });

  // --- タッチ操作（スマホ・タブレット用） ---
  slider.addEventListener('touchstart', (e) => {
    isDown = true;
    startX = e.touches[0].pageX - slider.offsetLeft;
    scrollLeft = slider.scrollLeft;
  }, { passive: true });

  slider.addEventListener('touchend', () => {
    isDown = false;
  });

  slider.addEventListener('touchmove', (e) => {
    if (!isDown) return;
    const x = e.touches[0].pageX - slider.offsetLeft;
    const walk = (x - startX) * 1.5;
    slider.scrollLeft = scrollLeft - walk;
  }, { passive: true });
}
function setMode(mode) {
  state.mode = mode;
  elements.btnPvp.classList.toggle('active', mode === 'pvp');
  elements.btnPve.classList.toggle('active', mode === 'pve');
}

function showTitleScreen() {
  elements.modalResult.classList.add('hidden');
  elements.modalSkills.classList.remove('show');
  elements.modalSkills.classList.add('hidden');
  elements.modalGetCard.classList.add('hidden');
  elements.screenGame.classList.remove('active');
  elements.screenTitle.classList.add('active');
  initBgDemo();
}

function startGame() {
  stopBgDemo();

  elements.screenTitle.classList.remove('active');
  elements.modalResult.classList.add('hidden');
  elements.screenGame.classList.add('active');

  state.board = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => ({
      owner: 0, isPhantom: false, promisedOwner: 0, trapOwner: 0
    }))
  );

  state.currentPlayer = 1;
  state.phase = 'PLACE';
  state.hands = { 1: [], 2: [] };
  state.drawnCard = null;
  state.fogForPlayer = null;
  state.fogArea = null;
  state.overrideNextCard = {};
  state.phantomStones = [];

  renderBoard();
  updateUI();
}

function renderBoard() {
  elements.board.innerHTML = '';
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cellData = state.board[r][c];
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;

      if (cellData.owner === 1) {
        cell.textContent = '〇';
        cell.classList.add('p1');
      } else if (cellData.owner === 2) {
        cell.textContent = '✕';
        cell.classList.add('p2');
      }

      if (cellData.isPhantom) cell.classList.add('phantom');
      if (cellData.promisedOwner) cell.classList.add('promised');
      if (cellData.trapOwner === state.currentPlayer) cell.classList.add('trap-visible');

      cell.addEventListener('click', () => handleCellClick(r, c));
      elements.board.appendChild(cell);
    }
  }
  updateFogOverlay();
}

function updateFogOverlay() {
  if (state.fogForPlayer === state.currentPlayer && state.fogArea) {
    const { r, c, size } = state.fogArea;
    const cellSize = 42; 
    elements.fogOverlay.style.top = `${r * cellSize + 20}px`;
    elements.fogOverlay.style.left = `${c * cellSize + 20}px`;
    elements.fogOverlay.style.width = `${size * cellSize - 4}px`;
    elements.fogOverlay.style.height = `${size * cellSize - 4}px`;
    elements.fogOverlay.classList.remove('hidden');
  } else {
    elements.fogOverlay.classList.add('hidden');
  }
}

function updateUI() {
  elements.statusTurn.textContent = `Player ${state.currentPlayer} の番`;
  elements.p1Info.classList.toggle('active', state.currentPlayer === 1);
  elements.p2Info.classList.toggle('active', state.currentPlayer === 2);

  if (state.phase === 'PLACE') {
    elements.statusPhase.textContent = '1. マスを選んで石を置いてください';
  } else if (state.phase === 'ACTION') {
    elements.statusPhase.textContent = '2. スキルを使用・確認してください';
  } else if (state.phase === 'TARGET_SELECT') {
    elements.statusPhase.textContent = '対象のマスを選択してください';
  }
}

function handleCellClick(r, c) {
  if (state.phase === 'PLACE') {
    placeStone(r, c);
  } else if (state.phase === 'TARGET_SELECT' && state.targetCallback) {
    state.targetCallback(r, c);
  }
}

function placeStone(r, c) {
  const cell = state.board[r][c];

  if (cell.owner !== 0 && !cell.isPhantom) return;
  if (cell.promisedOwner !== 0 && cell.promisedOwner !== state.currentPlayer) return;

  cell.owner = state.currentPlayer;
  cell.isPhantom = false;

  if (cell.trapOwner !== 0 && cell.trapOwner !== state.currentPlayer) {
    cell.owner = 0;
    cell.trapOwner = 0;
  }

  renderBoard();

  if (checkWin(state.currentPlayer)) {
    endGame(`Player ${state.currentPlayer} の勝利！`);
    return;
  }

  actionPhase();
}

function actionPhase() {
  state.phase = 'ACTION';
  updateUI();

  if (state.mode === 'pve' && state.currentPlayer === 2) {
    setTimeout(() => botDecideAction(), 600);
  } else {
    handleDrawCard();
  }
}

function handleDrawCard() {
  let drawn = null;
  if (state.overrideNextCard[state.currentPlayer]) {
    const cardId = state.overrideNextCard[state.currentPlayer];
    drawn = SKILLS.find(s => s.id === cardId);
    delete state.overrideNextCard[state.currentPlayer];
  } else {
    drawn = SKILLS[Math.floor(Math.random() * SKILLS.length)];
  }

  state.drawnCard = drawn;
  if (state.hands[state.currentPlayer].length < 3) {
    state.hands[state.currentPlayer].push(drawn);
  }

  elements.getCardTitle.textContent = drawn.name;
  elements.getCardDesc.textContent = drawn.desc;
  elements.modalGetCard.classList.remove('hidden');
}

function openSkillModal() {
  elements.modalGetCard.classList.add('hidden');
  elements.skillsList.innerHTML = '';

  const currentHand = state.hands[state.currentPlayer];
  if (currentHand.length === 0) {
    endTurn();
    return;
  }

  currentHand.forEach((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'skill-card-item';
    cardEl.innerHTML = `
      <div class="card-title">${card.name}</div>
      <div class="card-desc">${card.desc}</div>
    `;
    cardEl.addEventListener('click', () => {
      closeSkillModalSmooth(() => {
        state.hands[state.currentPlayer].splice(index, 1);
        executeSkill(card.id);
      });
    });
    elements.skillsList.appendChild(cardEl);
  });

  elements.modalSkills.classList.remove('hidden');
  requestAnimationFrame(() => {
    elements.modalSkills.classList.add('show');
  });
}

function closeSkillModalSmooth(callback) {
  elements.modalSkills.classList.remove('show');
  setTimeout(() => {
    elements.modalSkills.classList.add('hidden');
    if (callback) callback();
  }, 300);
}

function handleSkipAction() {
  closeSkillModalSmooth(() => {
    elements.modalGetCard.classList.add('hidden');
    endTurn();
  });
}

function cancelTargetSelection() {
  state.phase = 'ACTION';
  state.targetCallback = null;
  const cells = elements.board.querySelectorAll('.cell');
  cells.forEach(cell => cell.classList.remove('target-selectable'));
  updateUI();
  openSkillModal();
}

function endTurn() {
  elements.modalSkills.classList.remove('show');
  elements.modalSkills.classList.add('hidden');
  elements.modalGetCard.classList.add('hidden');

  state.phantomStones = state.phantomStones.filter(p => {
    p.remainingTurns--;
    if (p.remainingTurns <= 0) {
      if (state.board[p.r][p.c].isPhantom) {
        state.board[p.r][p.c].owner = 0;
        state.board[p.r][p.c].isPhantom = false;
      }
      return false;
    }
    return true;
  });

  if (state.fogForPlayer === state.currentPlayer) {
    state.fogForPlayer = null;
    state.fogArea = null;
  }

  state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
  state.phase = 'PLACE';
  state.drawnCard = null;

  renderBoard();
  updateUI();

  if (state.mode === 'pve' && state.currentPlayer === 2) {
    setTimeout(() => botPlaceStone(), 100);
  }
}

/* =======================================
   スキル処理
======================================= */
function executeSkill(skillId) {
  const targetOpponent = state.currentPlayer === 1 ? 2 : 1;

  switch (skillId) {
    case 1:
      endTurn();
      break;
    case 2:
      startTargetSelection('相手の石を選んでください', (r, c) => {
        if (state.board[r][c].owner === targetOpponent) {
          state.board[r][c].owner = 0;
          renderBoard();
          endTurn();
        }
      }, c => c.owner === targetOpponent);
      break;
    case 3:
      const tr = Math.floor(Math.random() * (BOARD_SIZE - 2));
      const tc = Math.floor(Math.random() * (BOARD_SIZE - 2));
      state.fogForPlayer = targetOpponent;
      state.fogArea = { r: tr, c: tc, size: 3 };
      endTurn();
      break;
    case 4:
      startTargetSelection('相手の石を選んでください', (r, c) => {
        if (state.board[r][c].owner === targetOpponent) {
          const isRow = Math.random() < 0.5;
          for (let i = 0; i < BOARD_SIZE; i++) {
            if (isRow && state.board[r][i].owner === targetOpponent) state.board[r][i].owner = 0;
            if (!isRow && state.board[i][c].owner === targetOpponent) state.board[i][c].owner = 0;
          }
          renderBoard();
          endTurn();
        }
      }, c => c.owner === targetOpponent);
      break;
    case 5:
      state.phase = 'PLACE';
      renderBoard(); 
      updateUI();
      if (state.mode === 'pve' && state.currentPlayer === 2) {
        setTimeout(() => botPlaceStone(), 100);
      }
      break;
    case 6:
      if (Math.random() < 0.05) {
        let removed = 0;
        for (let i = 0; i < 100 && removed < 2; i++) {
          let rr = Math.floor(Math.random() * BOARD_SIZE);
          let cc = Math.floor(Math.random() * BOARD_SIZE);
          if (state.board[rr][cc].owner === targetOpponent) {
            state.board[rr][cc].owner = 0;
            removed++;
          }
        }
      }
      renderBoard();
      endTurn();
      break;
    case 7:
      startTargetSelection('マスを選んでください', (r, c) => {
        state.board[r][c].owner = state.currentPlayer;
        state.board[r][c].isPhantom = false;
        renderBoard();
        if (checkWin(state.currentPlayer)) endGame(`Player ${state.currentPlayer} の勝利！`);
        else endTurn();
      });
      break;
    case 8:
      startTargetSelection('マスを選んでください', (r, c) => {
        if (state.board[r][c].owner === 0) {
          state.board[r][c].promisedOwner = state.currentPlayer;
          renderBoard();
          endTurn();
        }
      }, c => c.owner === 0);
      break;
    case 9:
      startTargetSelection('爆弾の中心マスを選んでください', (r, c) => {
        if (Math.random() < 0.05) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              let nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && state.board[nr][nc].owner !== 0) {
                state.board[nr][nc].owner = 0;
              }
            }
          }
        }
        renderBoard();
        endTurn();
      });
      break;
    case 10:
      let phantoms = 0;
      for (let i = 0; i < 50 && phantoms < 3; i++) {
        let rr = Math.floor(Math.random() * BOARD_SIZE);
        let cc = Math.floor(Math.random() * BOARD_SIZE);
        if (state.board[rr][cc].owner === 0) {
          state.board[rr][cc].owner = state.currentPlayer;
          state.board[rr][cc].isPhantom = true;
          state.phantomStones.push({ r: rr, c: cc, remainingTurns: 3 });
          phantoms++;
        }
      }
      renderBoard();
      endTurn();
      break;
    case 11:
      state.overrideNextCard[targetOpponent] = 1;
      endTurn();
      break;
    case 12:
      startTargetSelection('罠を仕掛けるマスを選んでください', (r, c) => {
        if (state.board[r][c].owner === 0) {
          state.board[r][c].trapOwner = state.currentPlayer;
          renderBoard();
          endTurn();
        }
      }, c => c.owner === 0);
      break;
  }
}

function startTargetSelection(promptText, callback, filterFn = null) {
  state.phase = 'TARGET_SELECT';
  state.targetCallback = callback;
  elements.statusPhase.textContent = promptText;
  
  const cells = elements.board.querySelectorAll('.cell');
  cells.forEach(cell => {
    const r = parseInt(cell.dataset.row);
    const c = parseInt(cell.dataset.col);
    if (!filterFn || filterFn(state.board[r][c])) {
      cell.classList.add('target-selectable');
    }
  });
  updateUI();
}

function checkWin(player) {
  return checkWinBoard(state.board, player);
}

function checkWinBoard(board, player) {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c].owner === player && !board[r][c].isPhantom) {
        for (let [dr, dc] of directions) {
          let count = 1;
          for (let i = 1; i < WIN_COUNT; i++) {
            let nr = r + dr * i, nc = c + dc * i;
            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc].owner === player && !board[nr][nc].isPhantom) {
              count++;
            } else break;
          }
          if (count >= WIN_COUNT) return true;
        }
      }
    }
  }
  return false;
}

function endGame(msg) {
  elements.resultTitle.textContent = "GAME OVER";
  elements.resultMessage.textContent = msg;
  elements.modalResult.classList.remove('hidden');
}

/* =======================================
   AI (Bot) ロジック
======================================= */
function botPlaceStone() {
  if (state.phase !== 'PLACE') return;
  const move = getBotBestMoveTreeSearch();
  placeStone(move.r, move.c);
}

function evaluateCellImpact(board, r, c, player) {
  const directions = [[0,1], [1,0], [1,1], [1,-1]];
  let totalScore = 0;
  
  for (let [dr, dc] of directions) {
    let count = 1;
    let openEnds = 0;
    
    let i = 1;
    for (; i < WIN_COUNT; i++) {
      const tr = r + dr * i, tc = c + dc * i;
      if (tr < 0 || tr >= BOARD_SIZE || tc < 0 || tc >= BOARD_SIZE) break;
      if (board[tr][tc].owner === player && !board[tr][tc].isPhantom) count++;
      else break;
    }
    if (i < WIN_COUNT) {
      const tr = r + dr * i, tc = c + dc * i;
      if (tr >= 0 && tr < BOARD_SIZE && tc >= 0 && tc < BOARD_SIZE && board[tr][tc].owner === 0) openEnds++;
    } else { openEnds++; }

    let j = 1;
    for (; j < WIN_COUNT; j++) {
      const tr = r - dr * j, tc = c - dc * j;
      if (tr < 0 || tr >= BOARD_SIZE || tc < 0 || tc >= BOARD_SIZE) break;
      if (board[tr][tc].owner === player && !board[tr][tc].isPhantom) count++;
      else break;
    }
    if (j < WIN_COUNT) {
      const tr = r - dr * j, tc = c - dc * j;
      if (tr >= 0 && tr < BOARD_SIZE && tc >= 0 && tc < BOARD_SIZE && board[tr][tc].owner === 0) openEnds++;
    } else { openEnds++; }

    if (count >= 5) totalScore += 1000000;
    else if (count === 4 && openEnds >= 1) totalScore += 100000;
    else if (count === 3 && openEnds === 2) totalScore += 10000;
    else if (count === 3 && openEnds === 1) totalScore += 500;
    else if (count === 2 && openEnds === 2) totalScore += 200;
    else if (count === 2 && openEnds === 1) totalScore += 30;
  }
  return totalScore;
}

function evaluateBoardState(board, botPlayer) {
  const oppPlayer = botPlayer === 1 ? 2 : 1;
  let botScore = 0;
  let oppScore = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c].owner === botPlayer) botScore += evaluateCellImpact(board, r, c, botPlayer);
      else if (board[r][c].owner === oppPlayer) oppScore += evaluateCellImpact(board, r, c, oppPlayer);
    }
  }
  return botScore - oppScore * 1.2;
}

function getTopCandidateMoves(board, currentPlayer, topK = 8) {
  const moves = [];
  const oppPlayer = currentPlayer === 1 ? 2 : 1;
  const hasStone = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(false));
  let emptyCount = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c].owner !== 0 && !board[r][c].isPhantom) {
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
              hasStone[nr][nc] = true;
            }
          }
        }
      } else if (board[r][c].owner === 0) emptyCount++;
    }
  }

  if (emptyCount === BOARD_SIZE * BOARD_SIZE) return [{ r: 4, c: 4 }];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c].owner === 0 && hasStone[r][c] && board[r][c].promisedOwner !== currentPlayer) {
        const score = evaluateCellImpact(board, r, c, currentPlayer) + evaluateCellImpact(board, r, c, oppPlayer) * 1.2;
        moves.push({ r, c, score });
      }
    }
  }

  moves.sort((a, b) => b.score - a.score);
  return moves.slice(0, topK);
}

function minimax(board, depth, alpha, beta, isMaximizing, botPlayer) {
  const oppPlayer = botPlayer === 1 ? 2 : 1;

  if (checkWinBoard(board, botPlayer)) return 10000000 + depth * 10000;
  if (checkWinBoard(board, oppPlayer)) return -10000000 - depth * 10000;
  if (depth === 0) return evaluateBoardState(board, botPlayer);

  const candidates = getTopCandidateMoves(board, isMaximizing ? botPlayer : oppPlayer, 8);
  if (candidates.length === 0) return 0;

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (let move of candidates) {
      board[move.r][move.c].owner = botPlayer;
      const evaluation = minimax(board, depth - 1, alpha, beta, false, botPlayer);
      board[move.r][move.c].owner = 0;

      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (let move of candidates) {
      board[move.r][move.c].owner = oppPlayer;
      const evaluation = minimax(board, depth - 1, alpha, beta, true, botPlayer);
      board[move.r][move.c].owner = 0;

      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function getBotBestMoveTreeSearch() {
  const botPlayer = 2;
  const candidates = getTopCandidateMoves(state.board, botPlayer, 8);
  
  let bestScore = -Infinity;
  let bestMove = candidates[0] || { r: 4, c: 4 };

  const MAX_DEPTH = 7;

  for (let move of candidates) {
    state.board[move.r][move.c].owner = botPlayer;
    const score = minimax(state.board, MAX_DEPTH - 1, -Infinity, Infinity, false, botPlayer);
    state.board[move.r][move.c].owner = 0;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

function botDecideAction() {
  if (state.phase !== 'ACTION') return;
  const hand = state.hands[2];
  let useIndex = -1;

  for (let i = 0; i < hand.length; i++) {
    if (hand[i].id === 5) { useIndex = i; break; }
    if (Math.random() < 0.3 && [2, 4, 7, 8, 12].includes(hand[i].id)) {
      useIndex = i; break;
    }
  }

  if (useIndex === -1 && hand.length >= 3) {
    useIndex = Math.floor(Math.random() * hand.length);
  }

  if (useIndex !== -1) {
    const card = hand[useIndex];
    state.hands[2].splice(useIndex, 1);
    
    setTimeout(() => {
      const needsTarget = [2, 4, 7, 8, 9, 12].includes(card.id);
      if (needsTarget) {
        executeSkill(card.id); 
        setTimeout(() => {
            const cells = Array.from(elements.board.querySelectorAll('.target-selectable'));
            if (cells.length > 0) {
              const target = cells[Math.floor(Math.random() * cells.length)];
              state.targetCallback(parseInt(target.dataset.row), parseInt(target.dataset.col));
            } else {
              cancelTargetSelection();
              endTurn();
            }
        }, 300);
      } else {
        executeSkill(card.id);
      }
    }, 400);
  } else {
    endTurn();
  }
}
