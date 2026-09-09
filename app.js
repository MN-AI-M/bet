const BOARD_SIZE = 9;
const WIN_COUNT = 5;
const MAX_HAND_SIZE = 3;

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
  phase: 'MAIN', // スキル使用＆石配置フェーズ
  board: [],
  hands: { 1: [], 2: [] }, 
  targetCallback: null,
  fogForPlayer: null,
  fogArea: null,
  overrideNextCard: {},
  phantomStones: [],
  extraTurn: false
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
  skillsList: document.getElementById('skills-list')
};

/* =======================================
   デザイン強制初期化（ホワイトテーマ）
======================================= */
function applyWhiteTheme() {
  document.body.style.backgroundColor = '#ffffff';
  document.body.style.color = '#000000';
  document.body.style.fontFamily = 'sans-serif';
  
  // 既存の不要なモーダルを強制非表示
  const modals = ['modal-get-card', 'modal-skills'];
  modals.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

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
      cell.style.border = '1px solid #000';
      cell.style.backgroundColor = '#fff';
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
      
      cell.textContent = '';
      if (cellData.owner === 1) {
        cell.textContent = '〇';
        cell.style.color = '#000';
      } else if (cellData.owner === 2) {
        cell.textContent = '✕';
        cell.style.color = '#000';
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
  applyWhiteTheme();
  init();
  initBgDemo();
});

function init() {
  elements.btnPvp.addEventListener('click', () => setMode('pvp'));
  elements.btnPve.addEventListener('click', () => setMode('pve'));
  elements.btnStart.addEventListener('click', startGame);
  document.getElementById('btn-restart').addEventListener('click', startGame);
  document.getElementById('btn-to-title').addEventListener('click', showTitleScreen);
}

function setMode(mode) {
  state.mode = mode;
  elements.btnPvp.classList.toggle('active', mode === 'pvp');
  elements.btnPve.classList.toggle('active', mode === 'pve');
}

function showTitleScreen() {
  elements.modalResult.classList.add('hidden');
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

  state.hands = { 1: [], 2: [] };
  state.overrideNextCard = {};
  state.phantomStones = [];
  state.extraTurn = false;

  startTurn(1);
}

function startTurn(player) {
  state.currentPlayer = player;
  state.phase = 'MAIN';

  drawCardSilent();
  
  renderBoard();
  renderHand();
  updateUI();

  if (state.mode === 'pve' && state.currentPlayer === 2) {
    botTurn();
  }
}

function drawCardSilent() {
  const currentHand = state.hands[state.currentPlayer];
  if (currentHand.length >= MAX_HAND_SIZE) return;

  let drawn = null;
  if (state.overrideNextCard[state.currentPlayer]) {
    const cardId = state.overrideNextCard[state.currentPlayer];
    drawn = SKILLS.find(s => s.id === cardId);
    delete state.overrideNextCard[state.currentPlayer];
  } else {
    drawn = SKILLS[Math.floor(Math.random() * SKILLS.length)];
  }

  // ハズレ(id:1)は保存しない
  if (drawn.id !== 1) {
    currentHand.push(drawn);
  }
}

function renderBoard() {
  elements.board.innerHTML = '';
  // ボード自体のスタイルも白黒に
  elements.board.style.backgroundColor = '#fff';
  elements.board.style.border = '2px solid #000';

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cellData = state.board[r][c];
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;

      // セルも完全白黒デザイン
      cell.style.border = '1px solid #000';
      cell.style.backgroundColor = '#fff';
      cell.style.display = 'flex';
      cell.style.alignItems = 'center';
      cell.style.justifyContent = 'center';
      cell.style.fontSize = '24px';
      cell.style.fontWeight = 'bold';

      if (cellData.owner === 1) {
        cell.textContent = '〇';
        cell.style.color = '#000';
      } else if (cellData.owner === 2) {
        cell.textContent = '✕';
        cell.style.color = '#000';
      }

      if (cellData.isPhantom) cell.style.opacity = '0.5';
      if (cellData.promisedOwner) cell.style.boxShadow = 'inset 0 0 5px #000';
      if (cellData.trapOwner === state.currentPlayer) cell.textContent += '!?';

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
    elements.fogOverlay.style.backgroundColor = '#000'; // 黒ベタ塗り
    elements.fogOverlay.classList.remove('hidden');
  } else {
    elements.fogOverlay.classList.add('hidden');
  }
}

// 盤面の下に手札を展開する
function renderHand() {
  const listEl = elements.skillsList;
  if (!listEl) return;
  
  listEl.innerHTML = '';
  listEl.style.display = 'flex';
  listEl.style.justifyContent = 'center';
  listEl.style.flexWrap = 'wrap';
  listEl.style.gap = '10px';
  listEl.style.marginTop = '20px';

  const currentHand = state.hands[state.currentPlayer];
  if (!currentHand || state.mode === 'pve' && state.currentPlayer === 2) return; // Botの手札は隠す

  currentHand.forEach((card, index) => {
    const cardEl = document.createElement('div');
    // 白黒カードデザイン
    cardEl.style.border = '2px solid #000';
    cardEl.style.backgroundColor = '#fff';
    cardEl.style.color = '#000';
    cardEl.style.padding = '8px 12px';
    cardEl.style.cursor = 'grab';
    cardEl.style.userSelect = 'none';
    cardEl.style.textAlign = 'center';
    cardEl.style.minWidth = '100px';

    cardEl.innerHTML = `
      <div style="font-weight:bold; font-size:14px; margin-bottom:4px; border-bottom:1px solid #000;">${card.name}</div>
      <div style="font-size:11px;">${card.desc}</div>
    `;

    setupSkillDragAndDrop(cardEl, card, index);
    listEl.appendChild(cardEl);
  });
}

function setupSkillDragAndDrop(cardEl, card, index) {
  let cursorEl = null;
  let startX = 0;
  let startY = 0;

  cardEl.addEventListener('pointerdown', (e) => {
    if (state.phase !== 'MAIN') return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    startX = e.clientX;
    startY = e.clientY;
    cardEl.setPointerCapture(e.pointerId);

    const onPointerMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (!cursorEl && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        cursorEl = document.createElement('div');
        cursorEl.style.position = 'fixed';
        cursorEl.style.pointerEvents = 'none';
        cursorEl.style.zIndex = '9999';
        cursorEl.style.border = '2px dashed #000';
        cursorEl.style.backgroundColor = '#fff';
        cursorEl.style.color = '#000';
        cursorEl.style.padding = '5px 10px';
        cursorEl.style.fontWeight = 'bold';
        cursorEl.style.transform = 'translate(-50%, -50%)';
        cursorEl.textContent = card.name;
        document.body.appendChild(cursorEl);
        
        // 消える（透明化）処理は削除
      }

      if (cursorEl) {
        cursorEl.style.left = `${moveEvent.clientX}px`;
        cursorEl.style.top = `${moveEvent.clientY}px`;

        cursorEl.style.visibility = 'hidden';
        const targetElement = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        cursorEl.style.visibility = 'visible';

        const boardCell = targetElement ? targetElement.closest('.cell') : null;
        document.querySelectorAll('.cell').forEach(cell => cell.style.backgroundColor = '#fff');
        
        if (boardCell) {
          boardCell.style.backgroundColor = '#e0e0e0'; // 対象ハイライト（薄いグレー）
        }
      }
    };

    const onPointerUp = (upEvent) => {
      cardEl.removeEventListener('pointermove', onPointerMove);
      cardEl.removeEventListener('pointerup', onPointerUp);

      document.querySelectorAll('.cell').forEach(cell => cell.style.backgroundColor = '#fff');

      if (cursorEl) {
        cursorEl.style.visibility = 'hidden';
        const targetElement = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
        cursorEl.remove();
        cursorEl = null;

        const boardCell = targetElement ? targetElement.closest('.cell') : null;

        if (boardCell) {
          state.hands[state.currentPlayer].splice(index, 1);
          executeSkill(card.id, boardCell);
        }
      }
    };

    cardEl.addEventListener('pointermove', onPointerMove);
    cardEl.addEventListener('pointerup', onPointerUp);
  });
}

function updateUI() {
  const p1Name = "Player 1";
  const p2Name = state.mode === 'pve' ? "Bot" : "Player 2";
  const currentName = state.currentPlayer === 1 ? p1Name : p2Name;
  
  elements.statusTurn.textContent = `${currentName} の番`;

  if (elements.p1Info) elements.p1Info.querySelector('.player-name')?.replaceChildren(p1Name);
  if (elements.p2Info) elements.p2Info.querySelector('.player-name')?.replaceChildren(p2Name);

  if (state.phase === 'MAIN') {
    elements.statusPhase.textContent = '石を配置してください（スキル使用可）';
  } else if (state.phase === 'TARGET_SELECT') {
    elements.statusPhase.textContent = '対象のマスを選択してください';
  }
}

function handleCellClick(r, c) {
  if (state.phase === 'MAIN') {
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

  if (checkWinAfterAction()) return;
  
  endTurn();
}

function endTurn() {
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

  let nextPlayer = state.currentPlayer === 1 ? 2 : 1;
  if (state.extraTurn) {
    nextPlayer = state.currentPlayer;
    state.extraTurn = false;
  }

  startTurn(nextPlayer);
}

/* =======================================
   スキル処理
======================================= */
function checkWinAfterAction() {
  if (checkWin(1)) {
    endGame("Player 1 の勝利！");
    return true;
  }
  if (checkWin(2)) {
    const pName = state.mode === 'pve' ? "Bot" : "Player 2";
    endGame(`${pName} の勝利！`);
    return true;
  }
  return false;
}

function finishSkill() {
  if (checkWinAfterAction()) return;
  state.phase = 'MAIN';
  renderBoard();
  renderHand();
  updateUI();
}

function executeSkill(skillId, targetCell = null) {
  const targetOpponent = state.currentPlayer === 1 ? 2 : 1;
  const dropR = targetCell ? parseInt(targetCell.dataset.row, 10) : null;
  const dropC = targetCell ? parseInt(targetCell.dataset.col, 10) : null;

  switch (skillId) {
    case 1: 
      finishSkill(); 
      break;

    case 2:
      if (dropR !== null && state.board[dropR][dropC].owner === targetOpponent) {
        state.board[dropR][dropC].owner = 0;
        finishSkill();
      } else {
        startTargetSelection('相手の石を選んでください', (r, c) => {
          if (state.board[r][c].owner === targetOpponent) {
            state.board[r][c].owner = 0;
            finishSkill();
          }
        }, c => c.owner === targetOpponent);
      }
      break;

    case 3:
      const tr = Math.floor(Math.random() * (BOARD_SIZE - 2));
      const tc = Math.floor(Math.random() * (BOARD_SIZE - 2));
      state.fogForPlayer = targetOpponent;
      state.fogArea = { r: tr, c: tc, size: 3 };
      finishSkill();
      break;

    case 4:
      const applyRowColErase = (r, c) => {
        const isRow = Math.random() < 0.5;
        for (let i = 0; i < BOARD_SIZE; i++) {
          if (isRow && state.board[r][i].owner === targetOpponent) state.board[r][i].owner = 0;
          if (!isRow && state.board[i][c].owner === targetOpponent) state.board[i][c].owner = 0;
        }
        finishSkill();
      };
      if (dropR !== null && state.board[dropR][dropC].owner === targetOpponent) {
        applyRowColErase(dropR, dropC);
      } else {
        startTargetSelection('相手の石を選んでください', (r, c) => {
          if (state.board[r][c].owner === targetOpponent) applyRowColErase(r, c);
        }, c => c.owner === targetOpponent);
      }
      break;

    case 5:
      state.extraTurn = true;
      finishSkill();
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
      finishSkill();
      break;

    case 7:
      const applyErosion = (r, c) => {
        state.board[r][c].owner = state.currentPlayer;
        state.board[r][c].isPhantom = false;
        finishSkill();
      };
      if (dropR !== null) applyErosion(dropR, dropC);
      else {
        startTargetSelection('マスを選んでください', (r, c) => applyErosion(r, c));
      }
      break;

    case 8:
      if (dropR !== null && state.board[dropR][dropC].owner === 0) {
        state.board[dropR][dropC].promisedOwner = state.currentPlayer;
        finishSkill();
      } else {
        startTargetSelection('マスを選んでください', (r, c) => {
          if (state.board[r][c].owner === 0) {
            state.board[r][c].promisedOwner = state.currentPlayer;
            finishSkill();
          }
        }, c => c.owner === 0);
      }
      break;

    case 9:
      const applyBomb = (r, c) => {
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
        finishSkill();
      };
      if (dropR !== null) applyBomb(dropR, dropC);
      else {
        startTargetSelection('爆弾の中心マスを選んでください', (r, c) => applyBomb(r, c));
      }
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
      finishSkill();
      break;

    case 11:
      state.overrideNextCard[targetOpponent] = 1;
      finishSkill();
      break;

    case 12:
      if (dropR !== null && state.board[dropR][dropC].owner === 0) {
        state.board[dropR][dropC].trapOwner = state.currentPlayer;
        finishSkill();
      } else {
        startTargetSelection('罠を仕掛けるマスを選んでください', (r, c) => {
          if (state.board[r][c].owner === 0) {
            state.board[r][c].trapOwner = state.currentPlayer;
            finishSkill();
          }
        }, c => c.owner === 0);
      }
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
      cell.style.backgroundColor = '#f0f0f0'; // 選択可能なマスを微かに強調
    }
  });
  updateUI();
}

function cancelTargetSelection() {
  state.phase = 'MAIN';
  state.targetCallback = null;
  finishSkill();
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
  elements.resultTitle.style.color = "#000";
  elements.resultMessage.textContent = msg;
  elements.resultMessage.style.color = "#000";
  elements.modalResult.style.backgroundColor = "rgba(255,255,255,0.95)";
  elements.modalResult.style.border = "2px solid #000";
  elements.modalResult.classList.remove('hidden');
  elements.modalResult.style.display = "flex";
}

/* =======================================
   AI (Bot) ロジック
======================================= */
function botTurn() {
  setTimeout(() => {
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
      
      const needsTarget = [2, 4, 7, 8, 9, 12].includes(card.id);
      if (needsTarget) {
        executeSkill(card.id); 
        setTimeout(() => {
          const cells = [];
          for(let r=0; r<BOARD_SIZE; r++){
            for(let c=0; c<BOARD_SIZE; c++){
              // 簡易的に選択可能なものを抽出
              if(state.board[r][c].owner !== 2) cells.push({r,c}); 
            }
          }
          if (cells.length > 0) {
            const target = cells[Math.floor(Math.random() * cells.length)];
            if(state.targetCallback) state.targetCallback(target.r, target.c);
          } else {
            cancelTargetSelection();
          }
          setTimeout(botPlaceStone, 600);
        }, 400);
      } else {
        executeSkill(card.id);
        setTimeout(botPlaceStone, 600);
      }
    } else {
      botPlaceStone();
    }
  }, 600);
}

function botPlaceStone() {
  if (state.phase !== 'MAIN' && state.phase !== 'TARGET_SELECT') return;
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
