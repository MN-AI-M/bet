(() => {
    const SCORE_MODE = 'score_select';
    const SCORE_MATCH = 'score_matching';
    const SCORE_BOT = 'score_bot';
    const SCORE_TARGET = 4;
    let scoreSelected = !1;
    let scoreTimer = null;
    let scoreCountdown = null;
    let scoreConnection = null;
    let boardCaptureInstalled = !1;
    let skillDragInstalled = !1;

    function bindScoreConnection(connection) {
        if (!connection || connection === scoreConnection) return;
        scoreConnection = connection;
        connection.on('data', (message) => {
            if (message.type !== 'SCORE_PLACE' || message.player === state.myOnlinePlayer) return;
            if (state.mode !== 'pvp_online' || !state.scoreMode || state.currentPlayer !== message.player) return;
            applyScoreMove({
                r: message.r,
                c: message.c
            }, !0);
            if (message.scores) {
                state.scores = message.scores
            }
            if (message.lineCounts) state.lineCounts = message.lineCounts;
            updateScoreUI()
        })
    }
    window.addEventListener('skill-tac-score-message', (event) => {
        const message = event.detail;
        if (!message || message.type !== 'SCORE_PLACE' || message.player === state.myOnlinePlayer) return;
        if (state.mode !== 'pvp_online' || !state.scoreMode || state.currentPlayer !== message.player) return;
        applyScoreMove({
            r: message.r,
            c: message.c
        }, !0);
        if (message.scores) state.scores = message.scores;
        if (message.lineCounts) state.lineCounts = message.lineCounts;
        updateScoreUI()
    });

    function ensureState() {
        state.scoreMode = !0;
        state.scores = state.scores || {
            1: 0,
            2: 0
        };
        state.lineCounts = state.lineCounts || {
            1: 0,
            2: 0
        };
        state.scoredLines = state.scoredLines || {
            1: {},
            2: {}
        };
        state.scoreGameOver = !1
    }

    function lineKey(cells) {
        return cells.map(({
            r,
            c
        }) => `${r},${c}`).sort().join('|')
    }

    function getCompletedLines(player, move) {
        const lines = [];
        const directions = [
            [0, 1],
            [1, 0],
            [1, 1],
            [1, -1]
        ];
        for (const [dr, dc] of directions) {
            for (let offset = -4; offset <= 0; offset += 1) {
                const cells = [];
                for (let i = 0; i < 5; i += 1) {
                    const r = move.r + (offset + i) * dr;
                    const c = move.c + (offset + i) * dc;
                    if (r < 0 || r >= 9 || c < 0 || c >= 9 || state.board[r][c].owner !== player || state.board[r][c].isPhantom) {
                        cells.length = 0;
                        break
                    }
                    cells.push({
                        r,
                        c
                    })
                }
                if (cells.length === 5) lines.push(cells)
            }
        }
        return lines
    }

    function updateScoreUI() {
        const scores = state.scores || {
            1: 0,
            2: 0
        };
        const lines = state.lineCounts || {
            1: 0,
            2: 0
        };
        [1, 2].forEach((player) => {
            const info = document.getElementById(`p${player}-info`);
            if (!info) return;
            info.style.flexDirection = 'column';
            info.style.alignItems = 'center';
            info.style.gap = '2px';
            let score = info.querySelector('.player-score');
            if (!score) {
                score = document.createElement('span');
                score.className = 'player-score';
                score.style.cssText = 'display:block;font-size:.78em;font-weight:700;margin-top:2px;';
                info.appendChild(score)
            }
            score.textContent = state.scoreMode ? `${scores[player]}pt (${lines[player]}/${SCORE_TARGET})` : '';
            score.classList.toggle('hidden', !state.scoreMode)
        });
        const oldPanel = document.getElementById('score-panel');
        if (oldPanel) oldPanel.remove()
    }

    function finishScoreGame(winner) {
        if (state.scoreGameOver) return;
        state.scoreGameOver = !0;
        state.isGameOver = !0;
        const winnerName = winner === state.myOnlinePlayer && typeof window.skillTacPlayerName === 'function' ? window.skillTacPlayerName() : winner === 2 && state.mode === 'pve' ? 'Bot' : `Player ${winner}`;
        const title = document.getElementById('result-title');
        const message = document.getElementById('result-message');
        const localWon = state.mode === SCORE_BOT ? winner === 1 : winner === state.myOnlinePlayer;
        if (title) title.textContent = localWon ? 'GAME WIN' : 'GAME OVER';
        if (message) message.textContent = `${winnerName} の勝利！ Final Scores: Player 1 - ${state.scores[1]}, Player 2 - ${state.scores[2]}`;
        const modal = document.getElementById('modal-result');
        if (modal) modal.classList.remove('hidden')
    }

    function collectLine(player, move) {
        const collected = collectAllCompletedLines(player);
        updateScoreUI();
        return collected
    }

    function collectAllCompletedLines(player) {
        const lines = [];
        const directions = [
            [0, 1],
            [1, 0],
            [1, 1],
            [1, -1]
        ];
        for (const [dr, dc] of directions) {
            for (let r = 0; r < 9; r += 1) {
                for (let c = 0; c < 9; c += 1) {
                    const cells = [];
                    for (let i = 0; i < 5; i += 1) {
                        const row = r + dr * i;
                        const col = c + dc * i;
                        if (row < 0 || row >= 9 || col < 0 || col >= 9 || state.board[row][col].owner !== player || state.board[row][col].isPhantom) {
                            cells.length = 0;
                            break
                        }
                        cells.push({
                            r: row,
                            c: col
                        })
                    }
                    if (cells.length === 5) lines.push(cells)
                }
            }
        }
        let collected = 0;
        for (const cells of lines) {
            const opponent = player === 1 ? 2 : 1;
            const fee = 100 + Math.floor(state.scores[opponent] * 0.05);
            state.scores[player] += fee;
            state.scores[opponent] -= fee;
            state.lineCounts[player] += 1;
            cells.forEach(({
                r,
                c
            }) => {
                state.board[r][c].owner = 0;
                state.board[r][c].isPhantom = !1
            });
            collected += 1
        }
        return collected
    }

    function resolveSkillLines() {
        if (!state.scoreMode || state.scoreGameOver) return;
        const player = state.currentPlayer;
        if (collectAllCompletedLines(player) > 0) {
            renderBoard();
            updateScoreUI();
            if (state.lineCounts[player] >= SCORE_TARGET) finishScoreGame(player)
        }
    }

    function sendScoreMove(move) {
        if (state.mode === 'pvp_online' && conn && state.currentPlayer === state.myOnlinePlayer) {
            conn.send({
                type: 'SCORE_PLACE',
                player: state.myOnlinePlayer,
                r: move.r,
                c: move.c,
                scores: state.scores,
                lineCounts: state.lineCounts
            })
        }
    }

    function applyScoreMove(move, remote = !1) {
        if (state.scoreGameOver || !state.board[move.r] || !state.board[move.r][move.c]) return;
        const cell = state.board[move.r][move.c];
        const player = state.currentPlayer;
        if (state.mode === SCORE_BOT && player !== state.scoreTurnPlayer) return;
        if (cell.owner !== 0 || cell.isPhantom || (cell.promisedOwner && cell.promisedOwner !== player)) return;
        cell.owner = player;
        cell.isPhantom = !1;
        collectLine(player, move);
        renderBoard();
        if (!remote) sendScoreMove(move);
        if (state.lineCounts[player] >= SCORE_TARGET) {
            finishScoreGame(player);
            return
        }
        state.currentPlayer = player === 1 ? 2 : 1;
        state.scoreTurnPlayer = state.currentPlayer;
        if (typeof drawCardForCurrentPlayer === 'function') drawCardForCurrentPlayer();
        if (typeof renderHandUI === 'function') renderHandUI();
        updateUI();
        updateScoreUI();
        if (state.mode === SCORE_BOT && state.currentPlayer === 2) {
            setTimeout(botScoreTurn, 500)
        }
    }

    function botScoreTurn() {
        if (state.scoreGameOver || state.currentPlayer !== 2) return;
        if (state.hands[2].length < 3 && typeof drawCardForCurrentPlayer === 'function') drawCardForCurrentPlayer();
        const skillIndex = state.hands[2].findIndex((skill) => [2, 4, 5, 7, 8, 9, 12].includes(skill.id));
        if (skillIndex >= 0 && typeof executeSkill === 'function') {
            const skill = state.hands[2].splice(skillIndex, 1)[0];
            executeSkill(skill.id);
            if (state.phase === 'TARGET_SELECT' && typeof getBestSkillTarget === 'function') {
                setTimeout(() => {
                    const target = getBestSkillTarget(skill.id, 2, 1);
                    if (target && state.targetCallback) state.targetCallback(target.r, target.c);
                    setTimeout(botScorePlaceStone, 350)
                }, 250);
                return
            }
        }
        botScorePlaceStone()
    }

    function botScorePlaceStone() {
        if (state.scoreGameOver || state.currentPlayer !== 2) return;
        let move = typeof getBotBestMoveTreeSearch === 'function' ? getBotBestMoveTreeSearch() : null;
        if (!move || !state.board[move.r] || !state.board[move.r][move.c] || state.board[move.r][move.c].owner !== 0) {
            move = null;
            for (let r = 0; r < 9 && !move; r += 1) {
                for (let c = 0; c < 9; c += 1) {
                    if (state.board[r][c].owner === 0 && state.board[r][c].promisedOwner !== 2) {
                        move = {
                            r,
                            c
                        };
                        break
                    }
                }
            }
        }
        if (move) applyScoreMove(move)
    }

    function installBoardCapture() {
        if (boardCaptureInstalled || !elements.board) return;
        boardCaptureInstalled = !0;
        elements.board.addEventListener('click', (event) => {
            if (!state.scoreMode || state.scoreGameOver) return;
            event.stopImmediatePropagation();
            const cell = event.target.closest('.cell');
            if (!cell || state.currentPlayer !== (state.mode === 'pvp_online' ? state.myOnlinePlayer : 1)) return;
            applyScoreMove({
                r: Number(cell.dataset.row),
                c: Number(cell.dataset.col)
            })
        }, !0)
    }

    function installScoreSkillDrag() {
        if (skillDragInstalled || !elements.skillsList) return;
        skillDragInstalled = !0;
        let draggedCard = null;
        let draggedSkill = null;
        let dragCursor = null;
        let dragTarget = null;
        const clearDragVisuals = () => {
            if (dragCursor) dragCursor.remove();
            if (dragTarget) dragTarget.classList.remove('drag-over');
            dragCursor = null;
            dragTarget = null;
            if (draggedCard) draggedCard.classList.remove('drag-over')
        };
        const updateDragVisuals = (event) => {
            if (!dragCursor) return;
            dragCursor.style.left = `${event.clientX}px`;
            dragCursor.style.top = `${event.clientY}px`;
            const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.cell');
            if (dragTarget && dragTarget !== target) dragTarget.classList.remove('drag-over');
            dragTarget = target || null;
            if (dragTarget) dragTarget.classList.add('drag-over')
        };
        elements.skillsList.addEventListener('pointerdown', (event) => {
            if (!state.scoreMode || state.scoreGameOver || state.currentPlayer !== (state.mode === SCORE_BOT ? 1 : state.myOnlinePlayer) || isAiThinking) return;
            const card = event.target.closest('.skill-card-item');
            if (!card) return;
            const index = Array.from(elements.skillsList.children).indexOf(card);
            const skill = state.hands[state.currentPlayer][index];
            if (!skill) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            draggedCard = card;
            draggedSkill = skill;
            dragCursor = document.createElement('div');
            dragCursor.className = 'skill-drag-cursor';
            dragCursor.textContent = '✦';
            document.body.appendChild(dragCursor);
            card.setPointerCapture(event.pointerId);
            card.classList.add('drag-over');
            updateDragVisuals(event)
        }, !0);
        elements.skillsList.addEventListener('pointermove', updateDragVisuals, !0);
        elements.skillsList.addEventListener('pointerup', (event) => {
            if (!draggedCard || !draggedSkill) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.cell');
            const skillIndex = state.hands[state.currentPlayer].indexOf(draggedSkill);
            if (target && skillIndex >= 0) {
                state.hands[state.currentPlayer].splice(skillIndex, 1);
                executeSkill(draggedSkill.id, target);
                renderHandUI()
            }
            clearDragVisuals();
            draggedCard = null;
            draggedSkill = null
        }, !0);
        elements.skillsList.addEventListener('pointercancel', () => {
            clearDragVisuals();
            draggedCard = null;
            draggedSkill = null
        }, !0)
    }

    function setScoreBot() {
        if (scoreTimer) clearTimeout(scoreTimer);
        if (scoreCountdown) clearInterval(scoreCountdown);
        if (peer) peer.destroy();
        if (typeof hideMatchingOverlay === 'function') hideMatchingOverlay();
        state.mode = SCORE_BOT;
        ensureState();
        state.scoreTurnPlayer = 1;
        state.scores = {
            1: 0,
            2: Math.floor(Math.random() * 501)
        };
        state.lineCounts = {
            1: 0,
            2: 0
        };
        startGame();
        installBoardCapture();
        installScoreSkillDrag();
        updateScoreUI()
    }

    function startScoreMatch() {
        ensureState();
        state.scores = {
            1: 0,
            2: 0
        };
        state.lineCounts = {
            1: 0,
            2: 0
        };
        state.scoredLines = {
            1: {},
            2: {}
        };
        scoreConnection = null;
        state.mode = 'pvp';
        scoreSelected = !0;
        startOnlineMatchSearch();
        if (typeof cleanupMatchingTimers === 'function') cleanupMatchingTimers();
        if (typeof cleanupP2PTimers === 'function') cleanupP2PTimers();
        state.scoreMode = !0;
        state.mode = 'matching';
        state.scoreTurnPlayer = 1;
        let remaining = 5;
        updateMatchingCountdownUI(remaining);
        scoreCountdown = setInterval(() => {
            if (state.mode !== 'matching') {
                clearInterval(scoreCountdown);
                scoreCountdown = null;
                return
            }
            remaining = Math.max(0, remaining - 1);
            updateMatchingCountdownUI(remaining)
        }, 1000);
        scoreTimer = setTimeout(() => {
            if (state.mode === 'matching') setScoreBot()
        }, 5000);
        const waitForConnection = setInterval(() => {
            bindScoreConnection(conn);
            if (scoreConnection) clearInterval(waitForConnection)
        }, 50);
        setTimeout(() => clearInterval(waitForConnection), 5500)
    }

    function leaveScoreMode() {
        scoreSelected = !1;
        state.scoreMode = !1;
        state.scoreGameOver = !1;
        const panel = document.getElementById('score-panel');
        if (panel) panel.classList.add('hidden')
    }
    window.addEventListener('DOMContentLoaded', () => {
        const title = document.querySelector('.mode-select');
        const start = document.getElementById('btn-start');
        if (!title || !start) return;
        ['btn-pvp', 'btn-pve'].forEach((id) => {
            const button = document.getElementById(id);
            if (button) button.addEventListener('click', () => {
                leaveScoreMode();
            })
        });
        start.addEventListener('click', (event) => {
            if (!scoreSelected) {
                leaveScoreMode();
                return
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            startScoreMatch()
        }, !0);
        const titleButton = document.getElementById('btn-to-title');
        if (titleButton) titleButton.addEventListener('click', leaveScoreMode);
        installBoardCapture();
        installScoreSkillDrag()
    });
    const originalEndGame = window.endGame;
    if (typeof originalEndGame === 'function') {
        window.endGame = (...args) => {
            if (state.scoreMode) return;
            originalEndGame(...args)
        }
    }
    const originalExecuteSkill = window.executeSkill;
    if (typeof originalExecuteSkill === 'function') {
        window.executeSkill = (...args) => {
            originalExecuteSkill(...args);
            if (!state.scoreMode) return;
            let attempts = 0;
            const resolve = setInterval(() => {
                attempts += 1;
                if (state.phase !== 'TARGET_SELECT') resolveSkillLines();
                if (attempts >= 20 || state.scoreGameOver) clearInterval(resolve)
            }, 50)
        }
    }
    const originalUpdateUI = window.updateUI;
    window.updateUI = (...args) => {
        if (typeof originalUpdateUI === 'function') originalUpdateUI(...args);
        updateScoreUI()
    }
})()