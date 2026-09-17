(() => {
    let observedConnection = null;
    let modeHelloSent = !1;
    let dedicatedPeer = null;
    let dedicatedConnection = null;
    let switching = !1;

    function currentModeKey() {
        return state.scoreMode ? 'score' : 'normal'
    }

    function detachConnection(connection) {
        if (!connection || typeof connection.removeAllListeners !== 'function') return;
        connection.removeAllListeners('data');
        connection.removeAllListeners('close');
        connection.removeAllListeners('error')
    }

    function attachDedicatedConnection(connection, peerInstance) {
        if (!connection || switching) return;
        switching = !0;
        const oldConnection = typeof conn !== 'undefined' ? conn : null;
        const oldPeer = typeof peer !== 'undefined' ? peer : null;
        detachConnection(oldConnection);
        if (oldConnection && oldConnection !== connection && typeof oldConnection.close === 'function') oldConnection.close();
        if (oldPeer && oldPeer !== peerInstance && typeof oldPeer.destroy === 'function') oldPeer.destroy();
        conn = connection;
        peer = peerInstance;
        dedicatedConnection = connection;
        state.onlinePeerReady = !0;
        connection.on('data', (message) => {
            if (message && message.type === 'SCORE_PLACE') {
                window.dispatchEvent(new CustomEvent('skill-tac-score-message', {
                    detail: message
                }));
                return
            }
            if (typeof window.handleP2PData === 'function') window.handleP2PData(message)
        });
        connection.on('close', () => {
            if (conn !== connection) return;
            alert('対戦相手の通信が切断されました。');
            showTitleScreen()
        });
        connection.on('error', () => {});
        switching = !1
    }

    function createDedicatedPeer() {
        if (dedicatedPeer) return;
        const peerId = `gomoku_match_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        dedicatedPeer = new Peer(peerId, PEER_CONFIG);
        dedicatedPeer.on('open', () => {
            if (conn) conn.send({
                type: 'DEDICATED_PEER',
                peerId,
                mode: currentModeKey()
            })
        });
        dedicatedPeer.on('connection', (connection) => {
            if (connection.metadata && connection.metadata.mode !== currentModeKey()) return connection.close();
            connection.on('open', () => attachDedicatedConnection(connection, dedicatedPeer))
        });
        dedicatedPeer.on('error', () => {})
    }

    function connectToDedicatedPeer(peerId, mode) {
        if (mode !== currentModeKey() || dedicatedPeer) return;
        dedicatedPeer = new Peer(undefined, PEER_CONFIG);
        dedicatedPeer.on('open', () => {
            const connection = dedicatedPeer.connect(peerId, {
                metadata: {
                    mode: currentModeKey()
                }
            });
            connection.on('open', () => attachDedicatedConnection(connection, dedicatedPeer))
        });
        dedicatedPeer.on('error', () => {})
    }

    function handleIsolationMessage(message) {
        if (!message || !message.type) return !1;
        if (message.type === 'MODE_HELLO') {
            if (message.mode !== currentModeKey()) {
                alert('対戦モードが一致しないため、接続を終了しました。');
                if (typeof window.skillTacResetOnlineConnection === 'function') window.skillTacResetOnlineConnection();
                showTitleScreen();
                return !0
            }
            if (state.myOnlinePlayer === 1) createDedicatedPeer();
            return !0
        }
        if (message.type === 'DEDICATED_PEER') {
            connectToDedicatedPeer(message.peerId, message.mode);
            return !0
        }
        return !1
    }

    function observeConnection() {
        if (state.mode !== 'pvp_online' || !conn || conn === dedicatedConnection) return;
        if (conn !== observedConnection) {
            observedConnection = conn;
            modeHelloSent = !1
        }
        if (!modeHelloSent && conn.open) {
            modeHelloSent = !0;
            setTimeout(() => {
                if (conn === observedConnection && state.mode === 'pvp_online') {
                    conn.send({
                        type: 'MODE_HELLO',
                        mode: currentModeKey()
                    })
                }
            }, 200)
        }
        if (!conn.__skillTacIsolationListener) {
            conn.__skillTacIsolationListener = !0;
            conn.on('data', handleIsolationMessage)
        }
    }
    const isolationTimer = setInterval(observeConnection, 50);
    window.addEventListener('skill-tac-reset-online', () => {
        clearInterval(isolationTimer);
        if (dedicatedPeer && typeof dedicatedPeer.destroy === 'function') dedicatedPeer.destroy()
    }, {
        once: !0
    })
})()