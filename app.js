/**
 * 9x9 スキルまる罰ゲーム - メインロジック & Bot AI
 */

const BOARD_SIZE = 9;
const WIN_COUNT = 5;

// 12種類のスキルデータ
const SKILLS = [
  { id: 1, name: "ハズレ", desc: "何も起きない。" },
  { id: 2, name: "一手消去", desc: "相手の石を1個ランダム消去。" },
  { id: 3, name: "視界潰し", desc: "相手の次の手番、盤面の一部が見えなくなる。" },
  { id: 4, name: "一列消去", desc: "相手の石が最も並ぶ行・列を1本消去。" },
  { id: 5, name: "追加ターン", desc: "もう一度自分の番になる。" },
  { id: 6, name: "強制リセット(5%)", desc: "5%の確率で発動！相手の石を2個消去。" },
  { id: 7, name: "浸食", desc: "指定マスを自分の色に変える。" },
  { id: 8, name: "確約", desc: "指定マスに自分以外配置不可（上書き・破壊は可）。" },
  { id: 9, name: "爆弾(5%)", desc: "5%の確率で発動！指定マスの周囲3x3範囲を消去。" },
  { id: 10, name: "幻影", desc: "3マス分の偽配置。3ターンで消滅する（勝利判定除外）。" },
  { id: 11, name: "すり替え", desc: "相手の次のスキルカードを強制的に「ハズレ」にする。" },
  { id: 12, name: "罠", desc: "指定マスに罠を設置（相手には非表示）。踏んだ石は消滅。" }
];

// ゲーム状態
const state = {
  mode: 'pvp',
  currentPlayer: 1,
  phase: 'PLACE', // 'PLACE', 'SKILL', 'TARGET_SELECT'
  board: [],
  drawnCard: null,
  targetCallback: null,
  
  fogForPlayer: null,
  fogArea: null,
  overrideNextCard: {},
  phantomStones: []
};

// DOM要素の保持
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
  cardDisplay: document.getElementById('card-display'),
  skillActions: document.getElementById('skill-actions'),
  btnUseSkill: document.getElementById('btn-use-skill'),
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

  elements.btnUseSkill.addEventListener('click', handleUseSkill);
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

  // 9x9データ構築
  state.board = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => ({
      owner: 0,
      isPhantom: false,
      promisedOwner: 0,
      trapOwner: 0
    }))
  );

  state.currentPlayer = 1;
  state.phase = 'PLACE';
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
    const cellSize = 52 + 4;
    elements.fogOverlay.style.top = `${r * cellSize + 16 + 4}px`;
    elements.fogOverlay.style.left = `${c * cellSize + 16 + 4}px`;
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
    elements.statusPhase.textContent = '2. 引いた技を使うか選択してください';
    elements.skillActions.classList.remove('hidden');
    elements.targetPrompt.classList.add('hidden');
  } else if (state.phase === 'TARGET_SELECT') {
    elements.statusPhase.textContent = '対象のマスを選択中...';
    elements.skillActions.classList.add('hidden');
    elements.targetPrompt.classList.remove('hidden');
  }

  if (state.drawnCard) {
    elements.cardDisplay.classList.remove('empty');
    elements.cardDisplay.innerHTML = `
      <div class="card-inner">
        <span class="card-id">技 ${state.drawnCard.id}</span>
        <div class="card-title">${state.drawnCard.name}</div>
        <div class="card-desc">${state.drawnCard.desc}</div>
      </div>
    `;
  } else {
    elements.cardDisplay.classList.add('empty');
    elements.cardDisplay.innerHTML = `
      <div class="card-inner">
        <span class="card-id">?</span>
        <div class="card-title">石を置くとカードが引かれます</div>
        <div class="card-desc">-</div>
      </div>
    `;
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

  // 罠発動処理
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

  if (state.overrideNextCard[state.currentPlayer]) {
    const cardId = state.overrideNextCard[state.currentPlayer];
    state.drawnCard = SKILLS.find(s => s.id === cardId);
    delete state.overrideNextCard[state.currentPlayer];
    addLog(`すり替え効果で「${state.drawnCard.name}」を引かされました！`);
  } else {
    const randomSkill = SKILLS[Math.floor(Math.random() * SKILLS.length)];
    state.drawnCard = randomSkill;
    addLog(`P${state.currentPlayer} は「${state.drawnCard.name}」を引きました。`);
  }

  updateUI();

  if (state.mode === 'pve' && state.currentPlayer === 2) {
    setTimeout(() => botDecideSkill(), 800);
  }
}

function handleUseSkill() {
  if (state.phase !== 'SKILL' || !state.drawnCard) return;
  executeSkill(state.drawnCard.id);
}

function handleSkipSkill() {
  addLog(`P${state.currentPlayer} は技を使用しませんでした。`);
  endTurn();
}

function endTurn() {
  // 幻影消滅カウント down
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
    setTimeout(() => botPlaceStone(), 600);
  }
}

// 12種の技処理
function executeSkill(skillId) {
  const opponent = state.currentPlayer === 1 ? 2 : 1;

  switch (skillId) {
    case 1:
      addLog('ハズレ！何も起きませんでした。');
      endTurn();
      break;

    case 2:
      {
        const oppStones = getPlayerStones(opponent);
        if (oppStones.length > 0) {
          const target = oppStones[Math.floor(Math.random() * oppStones.length)];
          state.board[target.r][target.c].owner = 0;
          addLog(`相手の (${target.r + 1}, ${target.c + 1}) を消去！`);
        } else {
          addLog('消去可能な相手の石がありません。');
        }
        endTurn();
      }
      break;

    case 3:
      state.fogForPlayer = opponent;
      state.fogArea = {
        r: Math.floor(Math.random() * (BOARD_SIZE - 3)),
        c: Math.floor(Math.random() * (BOARD_SIZE - 3)),
        size: 4
      };
      addLog(`相手の視界の一部を奪いました！`);
      endTurn();
      break;

    case 4:
      {
        let maxCount = -1;
        let bestLine = null;

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
            for (let c = 0; c < BOARD_SIZE; c++) {
              if (state.board[bestLine.index][c].owner === opponent) state.board[bestLine.index][c].owner = 0;
            }
            addLog(`${bestLine.index + 1} 行目の相手の石を一列消去！`);
          } else {
            for (let r = 0; r < BOARD_SIZE; r++) {
              if (state.board[r][bestLine.index].owner === opponent) state.board[r][bestLine.index].owner = 0;
            }
            addLog(`${bestLine.index + 1} 列目の相手の石を一列消去！`);
          }
        } else {
          addLog('消去できる列がありませんでした。');
        }
        endTurn();
      }
      break;

    case 5:
      addLog(`追加ターン！もう一度自分の番です。`);
      state.drawnCard = null;
      state.phase = 'PLACE';
      renderBoard();
      updateUI();
      if (state.mode === 'pve' && state.currentPlayer === 2) {
        setTimeout(() => botPlaceStone(), 600);
      }
      break;

    case 6:
      if (Math.random() < 0.05) {
        const oppStones = getPlayerStones(opponent);
        for (let i = 0; i < 2 && oppStones.length > 0; i++) {
          const idx = Math.floor(Math.random() * oppStones.length);
          const target = oppStones.splice(idx, 1)[0];
          state.board[target.r][target.c].owner = 0;
        }
        addLog(`✨ 5%の発動成功！相手の石を2個消去！`);
      } else {
        addLog(`強制リセット失敗... (5%を外しました)`);
      }
      endTurn();
      break;

    case 7:
      selectTarget((r, c) => {
        state.board[r][c].owner = state.currentPlayer;
        state.board[r][c].isPhantom = false;
        addLog(`(${r + 1}, ${c + 1}) を自分の色に浸食！`);
        if (checkWin(state.currentPlayer)) {
          endGame(`Player ${state.currentPlayer} の勝利！`);
        } else {
          endTurn();
        }
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
        selectTarget((centerR, centerC) => {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const tr = centerR + dr, tc = centerC + dc;
              if (tr >= 0 && tr < BOARD_SIZE && tc >= 0 && tc < BOARD_SIZE) {
                state.board[tr][tc].owner = 0;
              }
            }
          }
          addLog(`💣 爆弾発動！(${centerR + 1}, ${centerC + 1}) の周囲3x3を消去！`);
          endTurn();
        });
      } else {
        addLog(`爆弾不発... (5%を外しました)`);
        endTurn();
      }
      break;

    case 10:
      {
        let placed = 0;
        for (let i = 0; i < 20 && placed < 3; i++) {
          const r = Math.floor(Math.random() * BOARD_SIZE);
          const c = Math.floor(Math.random() * BOARD_SIZE);
          if (state.board[r][c].owner === 0) {
            state.board[r][c].owner = state.currentPlayer;
            state.board[r][c].isPhantom = true;
            state.phantomStones.push({ r, c, owner: state.currentPlayer, remainingTurns: 3 });
            placed++;
          }
        }
        addLog(`3マスの「幻影」を配置しました。`);
        endTurn();
      }
      break;

    case 11:
      state.overrideNextCard[opponent] = 1;
      addLog(`相手の次のカードを「ハズレ」にすり替えました！`);
      endTurn();
      break;

    case 12:
      selectTarget((r, c) => {
        if (state.board[r][c].owner !== 0) {
          addLog('空きマス以外には罠を置けません。');
          return;
        }
        state.board[r][c].trapOwner = state.currentPlayer;
        addLog(`(${r + 1}, ${c + 1}) に秘匿罠を設置しました。`);
        endTurn();
      });
      break;

    default:
      endTurn();
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

function cancelTargetSelection() {
  state.phase = 'SKILL';
  state.targetCallback = null;
  const cells = elements.board.querySelectorAll('.cell');
  cells.forEach(cell => cell.classList.remove('target-selectable'));
  updateUI();
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

// 5連勝利判定 (実体のある石のみで評価)
function checkWin(player) {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (state.board[r][c].owner !== player || state.board[r][c].isPhantom) continue;

      for (let [dr, dc] of directions) {
        let count = 1;
        for (let step = 1; step < WIN_COUNT; step++) {
          const tr = r + dr * step;
          const tc = c + dc * step;
          if (
            tr >= 0 && tr < BOARD_SIZE &&
            tc >= 0 && tc < BOARD_SIZE &&
            state.board[tr][tc].owner === player &&
            !state.board[tr][tc].isPhantom
          ) {
            count++;
          } else {
            break;
          }
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

// Bot (AI) 思考アルゴリズム
function botPlaceStone() {
  const bestMove = evaluateBestMove(2);
  placeStone(bestMove.r, bestMove.c);
}

function botDecideSkill() {
  if (!state.drawnCard) return;
  // Botは引いた技を即座に活用するロジック
  handleUseSkill();
}

function getBotBestTargetCell() {
  let bestScore = -Infinity;
  let bestCell = { r: 4, c: 4 };

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const score = evaluateCellImpact(r, c, 2);
      if (score > bestScore) {
        bestScore = score;
        bestCell = { r, c };
      }
    }
  }
  return bestCell;
}

function evaluateBestMove(botPlayer) {
  const oppPlayer = botPlayer === 1 ? 2 : 1;
  let bestScore = -Infinity;
  let bestMoves = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = state.board[r][c];
      if (cell.owner !== 0 && !cell.isPhantom) continue;
      if (cell.promisedOwner !== 0 && cell.promisedOwner !== botPlayer) continue;

      // 自分の即勝利チェック
      cell.owner = botPlayer;
      if (checkWin(botPlayer)) {
        cell.owner = 0;
        return { r, c };
      }

      // 相手の即勝利阻止チェック
      cell.owner = oppPlayer;
      let blockOppWin = checkWin(oppPlayer);
      cell.owner = 0;

      if (blockOppWin) return { r, c };

      // 評価関数による加重計算
      let score = evaluateCellImpact(r, c, botPlayer) + evaluateCellImpact(r, c, oppPlayer) * 0.9;
      const distFromCenter = Math.abs(r - 4) + Math.abs(c - 4);
      score += (10 - distFromCenter);

      if (score > bestScore) {
        bestScore = score;
        bestMoves = [{ r, c }];
      } else if (score === bestScore) {
        bestMoves.push({ r, c });
      }
    }
  }

  return bestMoves[Math.floor(Math.random() * bestMoves.length)] || { r: 4, c: 4 };
}

function evaluateCellImpact(r, c, player) {
  const directions = [[0,1], [1,0], [1,1], [1,-1]];
  let totalScore = 0;

  for (let [dr, dc] of directions) {
    let count = 1;
    let openEnds = 0;

    for (let i = 1; i < WIN_COUNT; i++) {
      const tr = r + dr * i, tc = c + dc * i;
      if (tr < 0 || tr >= BOARD_SIZE || tc < 0 || tc >= BOARD_SIZE) break;
      if (state.board[tr][tc].owner === player && !state.board[tr][tc].isPhantom) count++;
      else {
        if (state.board[tr][tc].owner === 0) openEnds++;
        break;
      }
    }

    for (let i = 1; i < WIN_COUNT; i++) {
      const tr = r - dr * i, tc = c - dc * i;
      if (tr < 0 || tr >= BOARD_SIZE || tc < 0 || tc >= BOARD_SIZE) break;
      if (state.board[tr][tc].owner === player && !state.board[tr][tc].isPhantom) count++;
      else {
        if (state.board[tr][tc].owner === 0) openEnds++;
        break;
      }
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
