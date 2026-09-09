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
  phase: 'PLACE', // 'PLACE', 'ACTION', 'TARGET_SELECT'
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
  handCards: document.getElementById('hand-cards'),
  skillActions: document.getElementById('skill-actions'),
  btnDrawCard: document.getElementById('btn-draw-card'),
  btnSkipAction: document.getElementById('btn-skip-action'),
  targetPrompt: document.getElementById('target-prompt'),
  btnCancelTarget: document.getElementById('btn-cancel-target'),
  gameLog: document.getElementById('game-log'),
  modalResult: document.getElementById('modal-result'),
  resultTitle: document.getElementById('result-title'),
  resultMessage: document.getElementById('result-message')
};

function init() {
  elements.btnPvp.addEventListener('click', () => setMode('pvp'));
  elements.btnPve.addEventListener('click', () => setMode('pve'));
  elements.btnStart.addEventListener('click', startGame);
  elements.btnDrawCard.addEventListener('click', handleDrawCard);
  elements.btnSkipAction.addEventListener('click', handleSkipAction);
  elements.btnCancelTarget.addEventListener('click', cancelTargetSelection);
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
    const cellSize = 56;
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
  } else if (state.phase === 'ACTION') {
    elements.statusPhase.textContent = '2. 技を使うか、カードを引いてください';
    elements.skillActions.classList.remove('hidden');
    elements.targetPrompt.classList.add('hidden');
    
    // 手札が3枚なら「引く」を隠し「何もしない」を表示
    if (state.hands[state.currentPlayer].length >= 3) {
      elements.btnDrawCard.classList.add('hidden');
      elements.btnSkipAction.classList.remove('hidden');
    } else {
      elements.btnDrawCard.classList.remove('hidden');
      elements.btnSkipAction.classList.add('hidden');
    }
  } else if (state.phase === 'TARGET_SELECT') {
    elements.statusPhase.textContent = '対象のマスを選択中...';
    elements.skillActions.classList.add('hidden');
    elements.targetPrompt.classList.remove('hidden');
  }

  // 手札の描画
  elements.handCards.innerHTML = '';
  const currentHand = state.hands[state.currentPlayer];
  
  if (currentHand.length === 0) {
    elements.handCards.innerHTML = `<div class="empty-hand-msg">手札はありません</div>`;
  } else {
    currentHand.forEach((card, index) => {
      const cardEl = document.createElement('div');
      cardEl.className = 'hand-card';
      if (state.phase === 'ACTION') cardEl.classList.add('clickable');
      else cardEl.classList.add('disabled');
      
      cardEl.innerHTML = `
        <span class="card-id">技 ${card.id}</span>
        <div class="card-title">${card.name}</div>
        <div class="card-desc">${card.desc}</div>
      `;
      
      cardEl.addEventListener('click', () => {
        if (state.phase === 'ACTION' && (state.mode === 'pvp' || state.currentPlayer === 1)) {
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
  if (state.phase === 'PLACE') placeStone(r, c);
  else if (state.phase === 'TARGET_SELECT' && state.targetCallback) state.targetCallback(r, c);
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

  actionPhase();
}

function actionPhase() {
  state.phase = 'ACTION';
  updateUI();

  if (state.mode === 'pve' && state.currentPlayer === 2) {
    setTimeout(() => botDecideAction(), 800);
  }
}

function handleDrawCard() {
  if (state.hands[state.currentPlayer].length >= 3) return;

  let drawn = null;
  if (state.overrideNextCard[state.currentPlayer]) {
    const cardId = state.overrideNextCard[state.currentPlayer];
    drawn = SKILLS.find(s => s.id === cardId);
    delete state.overrideNextCard[state.currentPlayer];
    addLog(`すり替え効果で「${drawn.name}」を引かされました！`);
  } else {
    drawn = SKILLS[Math.floor(Math.random() * SKILLS.length)];
    addLog(`P${state.currentPlayer} はカードを引き「${drawn.name}」を手に入れた。`);
  }

  state.hands[state.currentPlayer].push(drawn);
  endTurn(); // 引いたらターン終了
}

function handleSkipAction() {
  addLog(`P${state.currentPlayer} は何もしませんでした。`);
  endTurn();
}

function handleCardClick(index) {
  if (state.phase !== 'ACTION') return;
  const card = state.hands[state.currentPlayer][index];
  
  // 技を使う場合はカードを消費
  state.hands[state.currentPlayer].splice(index, 1);
  state.drawnCard = card;
  updateUI(); 
  
  addLog(`P${state.currentPlayer} は「${card.name}」を発動！`);
  executeSkill(card.id);
}

function cancelTargetSelection() {
  if (state.drawnCard) {
    state.hands[state.currentPlayer].push(state.drawnCard);
    state.drawnCard = null;
  }
  state.phase = 'ACTION';
  state.targetCallback = null;
  
  const cells = elements.board.querySelectorAll('.cell');
  cells.forEach(cell => cell.classList.remove('target-selectable'));
  updateUI();
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
    addLog(`P${state.currentPlayer} の視界妨害が晴れた！`);
  }

  state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
  state.phase = 'PLACE';
  state.drawnCard = null;

  renderBoard();
  updateUI();

  if (state.mode === 'pve' && state.currentPlayer === 2) {
    setTimeout(() => botPlaceStone(), 800);
  }
}

/* =======================================
   スキル実行処理
======================================= */
function executeSkill(skillId) {
  const targetOpponent = state.currentPlayer === 1 ? 2 : 1;

  switch (skillId) {
    case 1:
      addLog(`ハズレ... 何も起こりません。`);
      endTurn();
      break;
    case 2:
      startTargetSelection('相手の石を選んでください', (r, c) => {
        if (state.board[r][c].owner === targetOpponent) {
          state.board[r][c].owner = 0;
          addLog(`(${r + 1}, ${c + 1}) の相手の石を消去！`);
          renderBoard();
          endTurn();
        } else {
          addLog('相手の石を選択してください。');
        }
      }, c => c.owner === targetOpponent);
      break;
    case 3:
      const tr = Math.floor(Math.random() * (BOARD_SIZE - 2));
      const tc = Math.floor(Math.random() * (BOARD_SIZE - 2));
      state.fogForPlayer = targetOpponent;
      state.fogArea = { r: tr, c: tc, size: 3 };
      addLog(`相手の視界の一部を奪いました！`);
      endTurn();
      break;
    case 4:
      startTargetSelection('相手の石を選んでください（その行または列を消去）', (r, c) => {
        if (state.board[r][c].owner === targetOpponent) {
          const isRow = Math.random() < 0.5;
          let count = 0;
          for (let i = 0; i < BOARD_SIZE; i++) {
            if (isRow && state.board[r][i].owner === targetOpponent) { state.board[r][i].owner = 0; count++; }
            if (!isRow && state.board[i][c].owner === targetOpponent) { state.board[i][c].owner = 0; count++; }
          }
          addLog(`${isRow ? '行' : '列'}を消去！相手の石が ${count} 個消えた！`);
          renderBoard();
          endTurn();
        } else {
          addLog('相手の石を選択してください。');
        }
      }, c => c.owner === targetOpponent);
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
        let removed = 0;
        for (let i = 0; i < 100 && removed < 2; i++) {
          let rr = Math.floor(Math.random() * BOARD_SIZE);
          let cc = Math.floor(Math.random() * BOARD_SIZE);
          if (state.board[rr][cc].owner === targetOpponent) {
            state.board[rr][cc].owner = 0;
            removed++;
          }
        }
        addLog(`強制リセット成功(5%)！相手の石を ${removed} 個消去！`);
      } else {
        addLog(`強制リセット失敗... 何も起こらない。`);
      }
      renderBoard();
      endTurn();
      break;
    case 7:
      startTargetSelection('色を変えるマスを選んでください', (r, c) => {
        state.board[r][c].owner = state.currentPlayer;
        state.board[r][c].isPhantom = false;
        addLog(`(${r + 1}, ${c + 1}) を自色に浸食！`);
        renderBoard();
        if (checkWin(state.currentPlayer)) endGame(`Player ${state.currentPlayer} の勝利！`);
        else endTurn();
      });
      break;
    case 8:
      startTargetSelection('確約する空きマスを選んでください', (r, c) => {
        if (state.board[r][c].owner === 0) {
          state.board[r][c].promisedOwner = state.currentPlayer;
          addLog(`(${r + 1}, ${c + 1}) に相手は置けなくなりました！`);
          renderBoard();
          endTurn();
        } else {
          addLog('空いているマスを選んでください。');
        }
      }, c => c.owner === 0);
      break;
    case 9:
      startTargetSelection('爆弾を落とす中心マスを選んでください', (r, c) => {
        if (Math.random() < 0.05) {
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              let nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && state.board[nr][nc].owner !== 0) {
                state.board[nr][nc].owner = 0;
                count++;
              }
            }
          }
          addLog(`💥 爆弾成功(5%)！ 3x3の範囲から ${count} 個の石を吹き飛ばした！`);
        } else {
          addLog(`不発... 爆弾は作動しなかった(95%)。`);
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
      addLog(`幻影の石を ${phantoms} 個配置しました(3ターンで消滅)。`);
      renderBoard();
      endTurn();
      break;
    case 11:
      state.overrideNextCard[targetOpponent] = 1; // ハズレ
      addLog(`相手の次回のドローを「ハズレ」にすり替えた！`);
      endTurn();
      break;
    case 12:
      startTargetSelection('罠を仕掛ける空きマスを選んでください', (r, c) => {
        if (state.board[r][c].owner === 0) {
          state.board[r][c].trapOwner = state.currentPlayer;
          addLog(`(${r + 1}, ${c + 1}) に罠を仕掛けました！`);
          renderBoard();
          endTurn();
        } else {
          addLog('空いているマスを選んでください。');
        }
      }, c => c.owner === 0);
      break;
  }
}

function startTargetSelection(promptText, callback, filterFn = null) {
  state.phase = 'TARGET_SELECT';
  state.targetCallback = callback;
  elements.targetPrompt.querySelector('span').textContent = promptText;
  
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


/* =======================================
   勝利判定
======================================= */
function checkWin(player) {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (state.board[r][c].owner === player && !state.board[r][c].isPhantom) {
        for (let [dr, dc] of directions) {
          let count = 1;
          for (let i = 1; i < WIN_COUNT; i++) {
            let nr = r + dr * i, nc = c + dc * i;
            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && state.board[nr][nc].owner === player && !state.board[nr][nc].isPhantom) {
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
   AI (ガチBot) 改修：評価関数の大幅強化
======================================= */

// 石を置くフェーズ
function botPlaceStone() {
  if (state.phase !== 'PLACE') return;
  const move = getBotBestMove();
  placeStone(move.r, move.c);
}

// 候補手（石があるマスの周囲2マスのみに絞ることで高速化）
function getCandidateMoves(botPlayer) {
  const moves = [];
  const hasStone = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(false));
  let emptyCount = 0;
  
  for(let r=0; r<BOARD_SIZE; r++){
    for(let c=0; c<BOARD_SIZE; c++){
      if(state.board[r][c].owner !== 0 && !state.board[r][c].isPhantom){
        for(let dr=-2; dr<=2; dr++){
          for(let dc=-2; dc<=2; dc++){
            const nr = r+dr, nc = c+dc;
            if(nr>=0 && nr<BOARD_SIZE && nc>=0 && nc<BOARD_SIZE){
              hasStone[nr][nc] = true;
            }
          }
        }
      } else if (state.board[r][c].owner === 0) {
        emptyCount++;
      }
    }
  }
  
  if(emptyCount === BOARD_SIZE*BOARD_SIZE) return [{r:4, c:4}];

  for(let r=0; r<BOARD_SIZE; r++){
    for(let c=0; c<BOARD_SIZE; c++){
      if(state.board[r][c].owner === 0 && hasStone[r][c] && state.board[r][c].promisedOwner !== 1){
         moves.push({r, c});
      }
    }
  }
  return moves;
}

// 五目並べに特化した超強力な評価関数（指定マスに置いた時の価値）
function evaluateCellImpact(r, c, player) {
  const directions = [[0,1], [1,0], [1,1], [1,-1]];
  let totalScore = 0;
  
  for (let [dr, dc] of directions) {
    let count = 1;
    let openEnds = 0;
    
    // 正方向の確認
    let i = 1;
    for (; i < WIN_COUNT; i++) {
      const tr = r + dr * i, tc = c + dc * i;
      if (tr < 0 || tr >= BOARD_SIZE || tc < 0 || tc >= BOARD_SIZE) break;
      if (state.board[tr][tc].owner === player && !state.board[tr][tc].isPhantom) count++;
      else break;
    }
    // 遮られていなければ端は開いているとみなす
    if (i < WIN_COUNT) {
      const tr = r + dr * i, tc = c + dc * i;
      if (tr >= 0 && tr < BOARD_SIZE && tc >= 0 && tc < BOARD_SIZE && state.board[tr][tc].owner === 0) {
        openEnds++;
      }
    } else { openEnds++; }

    // 負方向の確認
    let j = 1;
    for (; j < WIN_COUNT; j++) {
      const tr = r - dr * j, tc = c - dc * j;
      if (tr < 0 || tr >= BOARD_SIZE || tc < 0 || tc >= BOARD_SIZE) break;
      if (state.board[tr][tc].owner === player && !state.board[tr][tc].isPhantom) count++;
      else break;
    }
    if (j < WIN_COUNT) {
      const tr = r - dr * j, tc = c - dc * j;
      if (tr >= 0 && tr < BOARD_SIZE && tc >= 0 && tc < BOARD_SIZE && state.board[tr][tc].owner === 0) {
        openEnds++;
      }
    } else { openEnds++; }

    // 【リーチの厳密なスコアリング】
    if (count >= 5) totalScore += 1000000;         // 5連：勝ち確
    else if (count === 4 && openEnds >= 1) totalScore += 100000;  // 片側でも開いた4連：実質勝ち確（相手なら即死）
    else if (count === 3 && openEnds === 2) totalScore += 50000;  // 両端空きの3連：次で止められない両端空き4連になる
    else if (count === 3 && openEnds === 1) totalScore += 500;
    else if (count === 2 && openEnds === 2) totalScore += 300;
    else if (count === 2 && openEnds === 1) totalScore += 50;
    else if (count === 1 && openEnds === 2) totalScore += 10;
  }
  return totalScore;
}

// 候補手の中で最善手を探す
function getBotBestMove() {
  const botPlayer = 2;
  const oppPlayer = 1;
  const moves = getCandidateMoves(botPlayer);
  
  let bestScore = -Infinity;
  let bestMoves = [];

  for (let m of moves) {
    // 相手が置いたら勝つ場所（両端空きの3連や開いた4連など）を防ぐため、
    // 自分が置いたときのスコアだけでなく、相手が置いたときのスコアも重視(1.2倍)して加算
    let score = evaluateCellImpact(m.r, m.c, botPlayer) + evaluateCellImpact(m.r, m.c, oppPlayer) * 1.2;
    
    // 中央付近への軽いボーナス
    score += (10 - (Math.abs(m.r - 4) + Math.abs(m.c - 4)));

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [m];
    } else if (score === bestScore) {
      bestMoves.push(m);
    }
  }

  return bestMoves[Math.floor(Math.random() * bestMoves.length)] || {r: 4, c: 4};
}

// アクション（技を使うかカードを引くか）の思考
function botDecideAction() {
  if (state.phase !== 'ACTION') return;
  const hand = state.hands[2];
  
  let useIndex = -1;

  // 手札を評価
  for (let i = 0; i < hand.length; i++) {
    const cardId = hand[i].id;
    // 追加ターンは最強なので即使用
    if (cardId === 5) { useIndex = i; break; }
    
    // 盤面に相手の石が多いほど使いやすい技を優先
    if (Math.random() < 0.3) {
      if ([2, 4, 7, 8, 12].includes(cardId)) {
        useIndex = i; break;
      }
    }
  }

  // 手札が一杯(3枚)なら適当なものを必ず使う
  if (useIndex === -1 && hand.length >= 3) {
    useIndex = Math.floor(Math.random() * hand.length);
  }

  if (useIndex !== -1) {
    const card = hand[useIndex];
    state.hands[2].splice(useIndex, 1);
    state.drawnCard = card;
    updateUI();
    addLog(`P2 は「${card.name}」を発動！`);
    
    setTimeout(() => {
      // ターゲット指定が必要な技のBotの自動選択ロジック
      const needsTarget = [2, 4, 7, 8, 9, 12].includes(card.id);
      if (needsTarget) {
        executeSkill(card.id); 
        // startTargetSelectionをフックしてランダムに選ばせる
        setTimeout(() => {
            const cells = Array.from(elements.board.querySelectorAll('.target-selectable'));
            if (cells.length > 0) {
              const target = cells[Math.floor(Math.random() * cells.length)];
              state.targetCallback(parseInt(target.dataset.row), parseInt(target.dataset.col));
            } else {
              cancelTargetSelection();
              endTurn();
            }
        }, 500);
      } else {
        executeSkill(card.id);
      }
    }, 600);
  } else {
    // 技を使わない場合はカードを引く
    handleDrawCard();
  }
}

init();
