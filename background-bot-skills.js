(() => {
  const normalBotSkills = document.createElement('script');
  normalBotSkills.src = 'normal-bot-skills.js?v=1';
  document.head.appendChild(normalBotSkills);
  const tutorialStateFix = document.createElement('script');
  tutorialStateFix.src = 'tutorial-state-fix.js?v=2';
  document.head.appendChild(tutorialStateFix);
  let demoTimer = null;
  let demoBoard = [];
  let demoPlayer = 1;
  let demoHands = { 1: [], 2: [] };

  const skillNames = {
    2: '一手消去',
    4: '一列消去',
    5: '追加設置',
    7: '浸食'
  };

  function resetDemo() {
    demoBoard = Array.from({ length: 9 }, () => Array(9).fill(0));
    demoPlayer = 1;
    demoHands = { 1: [], 2: [] };
    drawCards(1);
    drawCards(2);
    renderDemo();
  }

  function drawCards(player) {
    while (demoHands[player].length < 3) {
      const ids = [2, 4, 5, 7];
      demoHands[player].push(ids[Math.floor(Math.random() * ids.length)]);
    }
  }

  function emptyCells() {
    const cells = [];
    for (let r = 0; r < 9; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        if (!demoBoard[r][c]) cells.push({ r, c });
      }
    }
    return cells;
  }

  function useSkill(player, skillId) {
    const opponent = player === 1 ? 2 : 1;
    const cells = emptyCells();
    const action = document.getElementById('bg-bot-action');
    if (action) {
      action.textContent = `Bot ${player}: ${skillNames[skillId] || 'カード使用'}`;
      action.classList.remove('hidden');
      clearTimeout(action.hideTimer);
      action.hideTimer = setTimeout(() => action.classList.add('hidden'), 900);
    }
    if (skillId === 2) {
      const owned = [];
      for (let r = 0; r < 9; r += 1) for (let c = 0; c < 9; c += 1) if (demoBoard[r][c] === opponent) owned.push({ r, c });
      if (owned.length) {
        const target = owned[Math.floor(Math.random() * owned.length)];
        demoBoard[target.r][target.c] = 0;
      }
    } else if (skillId === 4) {
      const line = Math.floor(Math.random() * 9);
      for (let i = 0; i < 9; i += 1) {
        if (Math.random() < 0.5) demoBoard[line][i] = 0;
        else demoBoard[i][line] = 0;
      }
    } else if (skillId === 5 && cells.length) {
      const target = cells[Math.floor(Math.random() * cells.length)];
      demoBoard[target.r][target.c] = player;
    } else if (skillId === 7 && cells.length) {
      const target = cells[Math.floor(Math.random() * cells.length)];
      demoBoard[target.r][target.c] = player;
    }
  }

  function renderDemo() {
    const board = document.getElementById('bg-board');
    if (!board) return;
    const cells = board.children;
    for (let r = 0; r < 9; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        const cell = cells[r * 9 + c];
        if (!cell) continue;
        cell.className = 'cell';
        cell.textContent = demoBoard[r][c] === 1 ? '〇' : demoBoard[r][c] === 2 ? '✕' : '';
        if (demoBoard[r][c] === 1) cell.classList.add('p1');
        if (demoBoard[r][c] === 2) cell.classList.add('p2');
      }
    }
  }

  function stepDemo() {
    const title = document.getElementById('screen-title');
    if (!title || !title.classList.contains('active')) return;
    if (typeof stopBgDemo === 'function') stopBgDemo();
    const hand = demoHands[demoPlayer];
    if (!hand.length) drawCards(demoPlayer);
    if (Math.random() < 0.65) {
      const cardIndex = Math.floor(Math.random() * demoHands[demoPlayer].length);
      useSkill(demoPlayer, demoHands[demoPlayer].splice(cardIndex, 1)[0]);
    } else {
      const cells = emptyCells();
      if (!cells.length) return resetDemo();
      const move = cells[Math.floor(Math.random() * cells.length)];
      demoBoard[move.r][move.c] = demoPlayer;
    }
    drawCards(demoPlayer);
    demoPlayer = demoPlayer === 1 ? 2 : 1;
    renderDemo();
  }

  function startDemo() {
    if (typeof stopBgDemo === 'function') stopBgDemo();
    if (demoTimer) clearInterval(demoTimer);
    resetDemo();
    let action = document.getElementById('bg-bot-action');
    if (!action) {
      action = document.createElement('div');
      action.id = 'bg-bot-action';
      action.className = 'hidden';
      action.style.cssText = 'position:absolute;left:50%;top:12%;transform:translateX(-50%);z-index:5;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.9);color:#1a202c;font-size:.75rem;font-weight:700;pointer-events:none;';
      document.getElementById('screen-title')?.appendChild(action);
    }
    demoTimer = setInterval(stepDemo, 650);
  }

  window.addEventListener('DOMContentLoaded', () => setTimeout(startDemo, 0));
})();
