const BOARD_SIZE = 9;
const WIN_COUNT = 5;

const SKILLS = [
  { id: 1, name: "ハズレ", desc: "何も起きない。" },
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
  phase: 'PLACE', // 'PLACE', 'SKILL', 'TARGET_SELECT'
  board: [],
  hands: { 1: [], 2: [] }, // 最大3個スタック
  drawnCard: null,         // 現在発動中のカード
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
  handCards: document.getElementById('hand-cards'),
  skillActions: document.getElementById('skill-actions'),
  btnSkipSkill: document.getElementById('btn-skip-skill'),
  targetPrompt: document.getElementById('target-prompt'),
  btnCancelTarget: document.getElementById('btn-cancel-target'),
  gameLog: document.getElementById('game-log'),
  modalResult: document.getElementById('modal-result'),
  resultTitle: document.getElementById('result-title'),
  resultMessage: document.getElementById('result-message'),
  btnRestart: document.getElementById('btn-restart'),
  btnToTitle: document.getElementById('btn-to-title')
};

function init() {
  elements.btnPvp.addEventListener('click', () => setMode('pvp'));
  elements.btnPve.addEventListener('click', () => setMode('pve'));
  elements.btnStart.addEventListener('click', startGame);
  elements.btnSkipSkill.addEventListener('click', handleSkipSkill);
  elements.btnCancelTarget.addEventListener('click', cancelTargetSelection);
  elements.btnRestart.addEventListener('click', startGame);
  elements.btnToTitle.addEventListener('click', showTitleScreen);
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
}

function startGame() {
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

  elements.gameLog.innerHTML = '';
  addLog('ゲーム開始！5個並べたプレイヤーの勝ちです。');

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
    const cellSize = 56; // 52px + gap 4px
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
    elements.skillActions.classList.add('hidden');
    elements.targetPrompt.classList.add('hidden');
  } else if (state.phase === 'SKILL') {
    elements.statusPhase.textContent = '2. 技を使うか、ターンを終了してください';
    elements.skillActions.classList.remove('hidden');
    elements.targetPrompt.classList.add('hidden');
  } else if (state.phase === 'TARGET_SELECT') {
    elements.statusPhase.textContent = '対象のマスを選択中...';
    elements.skillActions.classList.add('hidden');
    elements.targetPrompt.classList.remove('hidden');
  }

  // 手札（スタック）の描画
  elements.handCards.innerHTML = '';
  const currentHand = state.hands[state.currentPlayer];
  
  if (currentHand.length === 0) {
    elements.handCards.innerHTML = `<div class="empty-hand-msg">手札はありません</div>`;
  } else {
    currentHand.forEach((card, index) => {
      const cardEl = document.createElement('div');
      cardEl.className = 'hand-card';
      if (state.phase !== 'SKILL') cardEl.classList.add('disabled');
      
      cardEl.innerHTML = `
        <span class="card-id">技 ${card.id}</span>
        <div class="card-title">${card.name}</div>
        <div class="card-desc">${card.desc}</div>
      `;
      
      cardEl.addEventListener('click', () => {
        if (state.phase === 'SKILL' && (state.mode === 'pvp' || state.currentPlayer === 1)) {
          handleCardClick(index);
        }
      });
      elements.handCards.appendChild(cardEl);
    });
  }
}

function addLog(text) {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = text;
  elements.gameLog.prepend(entry);
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

  if (cell.owner !== 0 && !cell.isPhantom) {
    addLog('そこには既に石が存在します。');
    return;
  }
  if (cell.promisedOwner !== 0 && cell.promisedOwner !== state.currentPlayer) {
    addLog('相手の確約マスのため配置できません！');
    return;
  }

  cell.owner = state.currentPlayer;
  cell.isPhantom = false;
  addLog(`P${state.currentPlayer} が (${r + 1}, ${c + 1}) に石を配置。`);

  if (cell.trapOwner !== 0 && cell.trapOwner !== state.currentPlayer) {
    cell.owner = 0;
    cell.trapOwner = 0;
    addLog(`💥 罠発動！ (${r + 1}, ${c + 1}) の石は消滅しました！`);
  }

  renderBoard();

  if (checkWin(state.currentPlayer)) {
    endGame(`Player ${state.currentPlayer} の勝利！`);
    return;
  }

  drawCardPhase();
}

function drawCardPhase() {
  state.phase = 'SKILL';

  let drawn = null;
  if (state.overrideNextCard[state.currentPlayer]) {
    const cardId = state.overrideNextCard[state.currentPlayer];
    drawn = SKILLS.find(s => s.id === cardId);
    delete state.overrideNextCard[state.currentPlayer];
    addLog(`すり替え効果で「${drawn.name}」を引かされました！`);
  } else {
    drawn = SKILLS[Math.floor(Math.random() * SKILLS.length)];
    addLog(`P${state.currentPlayer} は「${drawn.name}」を引きました。`);
  }

  // 手札追加（上限3）
  if (state.hands[state.currentPlayer].length < 3) {
    state.hands[state.currentPlayer].push(drawn);
  } else {
    addLog(`手札が一杯のため、引いたカードは破棄されました！`);
  }

  updateUI();

  if (state.mode === 'pve' && state.currentPlayer === 2) {
    setTimeout(() => botDecideSkill(), 1000);
  }
}

function handleCardClick(index) {
  if (state.phase !== 'SKILL') return;
  const card = state.hands[state.currentPlayer][index];
  
  // 手札から抜き取り発動
  state.hands[state.currentPlayer].splice(index, 1);
  state.drawnCard = card;
  updateUI(); 
  
  executeSkill(card.id);
}

function cancelTargetSelection() {
  // キャンセル時はカードを手札に復元
  if (state.drawnCard) {
    state.hands[state.currentPlayer].push(state.drawnCard);
    state.drawnCard = null;
  }
  state.phase = 'SKILL';
  state.targetCallback = null;
  
  const cells = elements.board.querySelectorAll('.cell');
  cells.forEach(cell => cell.classList.remove('target-selectable'));
  updateUI();
}

function handleSkipSkill() {
  if (state.phase !== 'SKILL') return;
  addLog(`P${state.currentPlayer} はターンを終了しました。`);
  endTurn();
}

function endTurn() {
  state.phantomStones = state.phantomStones.filter(p => {
    p.remainingTurns--;
    if (p.remainingTurns <= 0) {
      if (state.board[p.r][p.c].isPhantom) {
        state.board[p.r][p.c].owner = 0;
        state.board[p.r][p.c].isPhantom = false;
        addLog(`(${p.r + 1}, ${p.c + 1}) の幻影が消滅しました。`);
      }
      return false;
    }
    return true;
  });

  if (state.fogForPlayer === state.currentPlayer) {
    state.fogForPlayer = null;
    state.fogArea = null;
  }

  state.drawnCard = null;
  state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
  state.phase = 'PLACE';

  renderBoard();
  updateUI();

  if (state.mode === 'pve' && state.currentPlayer === 2) {
    setTimeout(() => botPlaceStone(), 800);
  }
}

// ---- 12種の技処理 ----
function executeSkill(skillId) {
  const opponent = state.currentPlayer === 1 ? 2 : 1;

  switch (skillId) {
    case 1:
      addLog('ハズレ！何も起きませんでした。');
      endTurn();
      break;
    case 2:
      const oppStones = getPlayerStones(opponent);
      if (oppStones.length > 0) {
        const target = oppStones[Math.floor(Math.random() * oppStones.length)];
        state.board[target.r][target.c].owner = 0;
        addLog(`相手の (${target.r + 1}, ${target.c + 1}) を消去！`);
      } else { addLog('消去可能な相手の石がありません。'); }
      endTurn();
      break;
    case 3:
      state.fogForPlayer = opponent;
      state.fogArea = { r: Math.floor(Math.random() * 5), c: Math.floor(Math.random() * 5), size: 4 };
      addLog(`相手の視界の一部を奪いました！`);
      endTurn();
      break;
    case 4:
      let maxCount = -1, bestLine = null;
      for (let i = 0; i < BOARD_SIZE; i++) {
        let rowCount = 0, colCount = 0;
        for (let j = 0; j < BOARD_SIZE; j++) {
          if (state.board[i][j].owner === opponent) rowCount++;
          if (state.board[j][i].owner === opponent) colCount++;
        }
        if (rowCount > maxCount) { maxCount = rowCount; bestLine = { type: 'row', index: i }; }
        if (colCount > maxCount) { maxCount = colCount; bestLine = { type: 'col', index: i }; }
      }
      if (bestLine && maxCount > 0) {
        if (bestLine.type === 'row') {
          for (let c = 0; c < BOARD_SIZE; c++) if (state.board[bestLine.index][c].owner === opponent) state.board[bestLine.index][c].owner = 0;
          addLog(`${bestLine.index + 1} 行目の相手の石を一列消去！`);
        } else {
          for (let r = 0; r < BOARD_SIZE; r++) if (state.board[r][bestLine.index].owner === opponent) state.board[r][bestLine.index].owner = 0;
          addLog(`${bestLine.index + 1} 列目の相手の石を一列消去！`);
        }
      } else { addLog('消去できる列がありません。'); }
      endTurn();
      break;
    case 5:
      addLog(`追加ターン！もう一度自分の番です。`);
      state.drawnCard = null;
      state.phase = 'PLACE';
      renderBoard(); updateUI();
      if (state.mode === 'pve' && state.currentPlayer === 2) setTimeout(() => botPlaceStone(), 600);
      break;
    case 6:
      if (Math.random() < 0.05) {
        const stones = getPlayerStones(opponent);
        for (let i = 0; i < 2 && stones.length > 0; i++) {
          const tgt = stones.splice(Math.floor(Math.random() * stones.length), 1)[0];
          state.board[tgt.r][tgt.c].owner = 0;
        }
        addLog(`✨ 5%の発動成功！相手の石を2個消去！`);
      } else { addLog(`強制リセット失敗... (5%を外しました)`); }
      endTurn();
      break;
    case 7:
      selectTarget((r, c) => {
        state.board[r][c].owner = state.currentPlayer;
        state.board[r][c].isPhantom = false;
        addLog(`(${r + 1}, ${c + 1}) を自分の色に浸食！`);
        if (checkWin(state.currentPlayer)) endGame(`Player ${state.currentPlayer} の勝利！`);
        else endTurn();
      });
      break;
    case 8:
      selectTarget((r, c) => {
        state.board[r][c].promisedOwner = state.currentPlayer;
        addLog(`(${r + 1}, ${c + 1}) を確約マスに設定。`);
        endTurn();
      });
      break;
    case 9:
      if (Math.random() < 0.05) {
        selectTarget((cr, cc) => {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const tr = cr + dr, tc = cc + dc;
              if (tr >= 0 && tr < BOARD_SIZE && tc >= 0 && tc < BOARD_SIZE) state.board[tr][tc].owner = 0;
            }
          }
          addLog(`💣 爆弾発動！(${cr + 1}, cc + 1}) 周囲3x3を消去！`);
          endTurn();
        });
      } else {
        addLog(`爆弾不発... (5%を外しました)`);
        endTurn();
      }
      break;
    case 10:
      let placed = 0;
      for (let i = 0; i < 20 && placed < 3; i++) {
        const r = Math.floor(Math.random() * BOARD_SIZE), c = Math.floor(Math.random() * BOARD_SIZE);
        if (state.board[r][c].owner === 0) {
          state.board[r][c].owner = state.currentPlayer;
          state.board[r][c].isPhantom = true;
          state.phantomStones.push({ r, c, owner: state.currentPlayer, remainingTurns: 3 });
          placed++;
        }
      }
      addLog(`3マスの「幻影」を配置しました。`);
      endTurn();
      break;
    case 11:
      state.overrideNextCard[opponent] = 1;
      addLog(`相手の次のカードを「ハズレ」にすり替えました！`);
      endTurn();
      break;
    case 12:
      selectTarget((r, c) => {
        if (state.board[r][c].owner !== 0) { addLog('空きマス以外には罠を置けません。'); return; }
        state.board[r][c].trapOwner = state.currentPlayer;
        addLog(`(${r + 1}, ${c + 1}) に秘匿罠を設置しました。`);
        endTurn();
      });
      break;
  }
}

function selectTarget(callback) {
  if (state.mode === 'pve' && state.currentPlayer === 2) {
    const bestCell = getBotBestTargetCell();
    callback(bestCell.r, bestCell.c);
    return;
  }
  state.phase = 'TARGET_SELECT';
  state.targetCallback = callback;
  updateUI();
  const cells = elements.board.querySelectorAll('.cell');
  cells.forEach(cell => cell.classList.add('target-selectable'));
}

function getPlayerStones(player) {
  const list = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (state.board[r][c].owner === player) list.push({ r, c });
    }
  }
  return list;
}

function checkWin(player) {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (state.board[r][c].owner !== player || state.board[r][c].isPhantom) continue;
      for (let [dr, dc] of directions) {
        let count = 1;
        for (let step = 1; step < WIN_COUNT; step++) {
          const tr = r + dr * step, tc = c + dc * step;
          if (tr >= 0 && tr < BOARD_SIZE && tc >= 0 && tc < BOARD_SIZE &&
              state.board[tr][tc].owner === player && !state.board[tr][tc].isPhantom) { count++; }
          else break;
        }
        if (count >= WIN_COUNT) return true;
      }
    }
  }
  return false;
}

function endGame(message) {
  elements.resultTitle.textContent = "GAME OVER";
  elements.resultMessage.textContent = message;
  elements.modalResult.classList.remove('hidden');
}

// ---- Bot(AI) 思考ロジック ----
function botPlaceStone() {
  const bestMove = evaluateBestMove(2);
  placeStone(bestMove.r, bestMove.c);
}

function botDecideSkill() {
  if (state.phase !== 'SKILL') return;
  const hand = state.hands[2];
  
  if (hand.length === 0) {
    handleSkipSkill();
    return;
  }

  let useIndex = -1;
  // 手札評価: 強力な技は優先して使う
  for (let i = 0; i < hand.length; i++) {
    const id = hand[i].id;
    if ([4, 5, 7, 8, 12, 2, 3].includes(id)) {
      useIndex = i;
      break;
    }
  }
  // 手札が3枚で溢れそうな場合は何かしら使う。それ以外は30%の確率で温存せずに使う。
  if (useIndex === -1 && hand.length === 3) useIndex = 0;
  else if (useIndex === -1 && Math.random() < 0.3) useIndex = 0;

  if (useIndex !== -1) {
    const card = hand[useIndex];
    state.hands[2].splice(useIndex, 1);
    state.drawnCard = card;
    updateUI();
    setTimeout(() => executeSkill(card.id), 600);
  } else {
    handleSkipSkill();
  }
}

function getBotBestTargetCell() {
  let bestScore = -Infinity;
  let bestCell = { r: 4, c: 4 };
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const score = evaluateCellImpact(r, c, 2);
      if (score > bestScore) { bestScore = score; bestCell = { r, c }; }
    }
  }
  return bestCell;
}

function evaluateBestMove(botPlayer) {
  const oppPlayer = botPlayer === 1 ? 2 : 1;
  let bestScore = -Infinity, bestMoves = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = state.board[r][c];
      if (cell.owner !== 0 && !cell.isPhantom) continue;
      if (cell.promisedOwner !== 0 && cell.promisedOwner !== botPlayer) continue;

      cell.owner = botPlayer;
      if (checkWin(botPlayer)) { cell.owner = 0; return { r, c }; }
      
      cell.owner = oppPlayer;
      let blockOppWin = checkWin(oppPlayer);
      cell.owner = 0;
      if (blockOppWin) return { r, c };

      let score = evaluateCellImpact(r, c, botPlayer) + evaluateCellImpact(r, c, oppPlayer) * 0.9;
      score += (10 - (Math.abs(r - 4) + Math.abs(c - 4)));

      if (score > bestScore) { bestScore = score; bestMoves = [{ r, c }]; }
      else if (score === bestScore) { bestMoves.push({ r, c }); }
    }
  }
  return bestMoves[Math.floor(Math.random() * bestMoves.length)] || { r: 4, c: 4 };
}

function evaluateCellImpact(r, c, player) {
  const directions = [[0,1], [1,0], [1,1], [1,-1]];
  let totalScore = 0;
  for (let [dr, dc] of directions) {
    let count = 1, openEnds = 0;
    for (let i = 1; i < WIN_COUNT; i++) {
      const tr = r + dr * i, tc = c + dc * i;
      if (tr < 0 || tr >= BOARD_SIZE || tc < 0 || tc >= BOARD_SIZE) break;
      if (state.board[tr][tc].owner === player && !state.board[tr][tc].isPhantom) count++;
      else { if (state.board[tr][tc].owner === 0) openEnds++; break; }
    }
    for (let i = 1; i < WIN_COUNT; i++) {
      const tr = r - dr * i, tc = c - dc * i;
      if (tr < 0 || tr >= BOARD_SIZE || tc < 0 || tc >= BOARD_SIZE) break;
      if (state.board[tr][tc].owner === player && !state.board[tr][tc].isPhantom) count++;
      else { if (state.board[tr][tc].owner === 0) openEnds++; break; }
    }
    if (count >= 5) totalScore += 10000;
    else if (count === 4 && openEnds >= 1) totalScore += 1000;
    else if (count === 3 && openEnds >= 2) totalScore += 200;
    else if (count === 3 && openEnds === 1) totalScore += 50;
    else if (count === 2 && openEnds >= 2) totalScore += 20;
  }
  return totalScore;
}

window.addEventListener('DOMContentLoaded', init);
