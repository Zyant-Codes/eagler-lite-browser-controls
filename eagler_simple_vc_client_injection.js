/* EAGLER_SIMPLE_VC_V1
 * Standalone Eagler Simple VC browser connector.
 * This is not the Java Simple Voice Chat protocol or client mod.
 */
(() => {
  'use strict';

  if (window.__eaglerSimpleVCV1) return;
  window.__eaglerSimpleVCV1 = true;

  const STORAGE_KEY = 'eagler-simple-vc-v1';
  const state = {
    panel: null,
    socket: null,
    stream: null,
    peers: new Map(),
    remoteAudio: new Map(),
    iceServers: [],
    connected: false,
    settings: { url: '', room: 'lobby', name: 'Eagler Player' }
  };

  function loadSettings() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      state.settings = { ...state.settings, ...value };
    } catch (_) {
      // Ignore malformed local settings; no network or game state is touched.
    }
  }

  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings)); } catch (_) { /* optional */ }
  }

  function setStatus(text, kind = '') {
    const node = state.panel?.querySelector('[data-esvc-status]');
    if (!node) return;
    node.textContent = text;
    node.className = `esvc-status ${kind}`;
  }

  function setConnectedUi(connected) {
    state.connected = connected;
    const connect = state.panel?.querySelector('[data-esvc-connect]');
    const disconnect = state.panel?.querySelector('[data-esvc-disconnect]');
    const fields = state.panel?.querySelectorAll('[data-esvc-field]') || [];
    if (connect) connect.disabled = connected;
    if (disconnect) disconnect.disabled = !connected;
    fields.forEach((field) => { field.disabled = connected; });
  }

  function sanitizeRoom(value) {
    return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
  }

  function sanitizeName(value) {
    return String(value || '').trim().replace(/[<>]/g, '').slice(0, 24) || 'Eagler Player';
  }

  function readSettings() {
    const url = state.panel.querySelector('[data-esvc-url]').value.trim();
    const token = state.panel.querySelector('[data-esvc-token]').value.trim();
    const room = sanitizeRoom(state.panel.querySelector('[data-esvc-room]').value) || 'lobby';
    const name = sanitizeName(state.panel.querySelector('[data-esvc-name]').value);
    state.settings = { url, room, name };
    saveSettings();
    // Tokens deliberately stay in memory and are never persisted to localStorage.
    return { ...state.settings, token };
  }

  function send(message) {
    if (state.socket?.readyState === WebSocket.OPEN) {
      state.socket.send(JSON.stringify(message));
    }
  }

  async function createPeer(peerId) {
    if (state.peers.has(peerId)) return state.peers.get(peerId);
    const pc = new RTCPeerConnection({ iceServers: state.iceServers });
    state.peers.set(peerId, pc);

    state.stream.getTracks().forEach((track) => pc.addTrack(track, state.stream));
    pc.onicecandidate = (event) => {
      if (event.candidate) send({ type: 'signal', to: peerId, data: { candidate: event.candidate } });
    };
    pc.ontrack = (event) => {
      let audio = state.remoteAudio.get(peerId);
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.playsInline = true;
        audio.dataset.esvcRemote = peerId;
        state.panel.querySelector('[data-esvc-audio]').appendChild(audio);
        state.remoteAudio.set(peerId, audio);
      }
      audio.srcObject = event.streams[0];
      audio.play().catch(() => setStatus('Connected — tap the panel if remote audio is blocked', 'warn'));
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) closePeer(peerId);
    };
    return pc;
  }

  function closePeer(peerId) {
    const pc = state.peers.get(peerId);
    if (pc) {
      try { pc.close(); } catch (_) { /* no-op */ }
      state.peers.delete(peerId);
    }
    const audio = state.remoteAudio.get(peerId);
    if (audio) {
      audio.remove();
      state.remoteAudio.delete(peerId);
    }
  }

  async function offerPeer(peerId) {
    const pc = await createPeer(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ type: 'signal', to: peerId, data: { description: pc.localDescription } });
  }

  async function handleSignal(from, data) {
    if (!data || typeof data !== 'object') return;
    const pc = await createPeer(from);
    if (data.description) {
      await pc.setRemoteDescription(data.description);
      if (data.description.type === 'offer') {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({ type: 'signal', to: from, data: { description: pc.localDescription } });
      }
    } else if (data.candidate) {
      await pc.addIceCandidate(data.candidate);
    }
  }

  function handleSocketMessage(event) {
    let message;
    try { message = JSON.parse(event.data); } catch (_) { return; }
    if (!message || typeof message.type !== 'string') return;

    if (message.type === 'welcome') {
      if (Array.isArray(message.iceServers)) state.iceServers = message.iceServers;
      setStatus(`Connected to room “${state.settings.room}”`, 'ok');
      if (Array.isArray(message.peers)) {
        message.peers.forEach((peer) => {
          if (peer?.id) offerPeer(peer.id).catch(() => setStatus('Could not start peer voice session', 'error'));
        });
      }
    } else if (message.type === 'peer-joined' && message.id) {
      offerPeer(message.id).catch(() => setStatus('Could not start peer voice session', 'error'));
    } else if (message.type === 'peer-left' && message.id) {
      closePeer(message.id);
    } else if (message.type === 'signal' && message.from) {
      handleSignal(message.from, message.data).catch(() => setStatus('Voice signaling error', 'error'));
    } else if (message.type === 'error') {
      setStatus(message.message || 'Voice server rejected the connection', 'error');
      disconnect();
    }
  }

  async function connect() {
    if (state.connected) return;
    const settings = readSettings();
    let voiceUrl;
    try {
      voiceUrl = new URL(settings.url);
      if (voiceUrl.protocol !== 'wss:') throw new Error('insecure');
      if (!settings.token) throw new Error('missing-token');
      voiceUrl.searchParams.set('token', settings.token);
    } catch (_) {
      setStatus('Enter a secure wss:// server URL and a server-issued token', 'error');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Microphone access requires a supported secure browser context', 'error');
      return;
    }

    setStatus('Requesting microphone permission…', 'warn');
    try {
      // This is invoked only from the explicit Connect & Enable Mic button.
      state.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      });
    } catch (error) {
      setStatus(error?.name === 'NotAllowedError' ? 'Microphone permission was not granted' : 'Microphone could not be started', 'error');
      return;
    }

    setStatus('Connecting to the voice server…', 'warn');
    const socket = new WebSocket(voiceUrl.toString());
    state.socket = socket;
    socket.onopen = () => {
      setConnectedUi(true);
      send({ type: 'join', protocol: 'eagler-simple-vc/1', room: settings.room, name: settings.name });
    };
    socket.onmessage = handleSocketMessage;
    socket.onerror = () => setStatus('Could not reach the voice server', 'error');
    socket.onclose = () => {
      if (state.connected) setStatus('Voice server disconnected', 'warn');
      setConnectedUi(false);
    };
  }

  function disconnect() {
    [...state.peers.keys()].forEach(closePeer);
    if (state.socket) {
      const socket = state.socket;
      state.socket = null;
      try { socket.close(1000, 'User disconnected'); } catch (_) { /* no-op */ }
    }
    if (state.stream) {
      state.stream.getTracks().forEach((track) => track.stop());
      state.stream = null;
    }
    setConnectedUi(false);
    setStatus('Voice disconnected');
  }

  function ensurePanel() {
    if (state.panel) return state.panel;
    loadSettings();
    const style = document.createElement('style');
    style.textContent = `
      .esvc-panel{position:fixed;z-index:2147483000;right:18px;top:64px;width:min(340px,calc(100vw - 36px));background:#0d1521;color:#eaf6ff;border:1px solid #4e8eb5;border-radius:10px;box-shadow:0 18px 50px #000b;font:13px/1.35 Arial,sans-serif;user-select:none}
      .esvc-head{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#10263a;border-radius:10px 10px 0 0;font-weight:700;color:#9fe5ff}.esvc-panel button{font:inherit;cursor:pointer}.esvc-x{color:#d8f1ff;background:transparent;border:0;font-size:17px}.esvc-body{padding:12px}.esvc-note{margin:0 0 10px;color:#adc9d9}.esvc-label{display:block;margin:8px 0 4px;color:#9fc2d5;font-size:11px;font-weight:700;text-transform:uppercase}.esvc-input{box-sizing:border-box;width:100%;padding:8px;color:#eefaff;background:#071019;border:1px solid #386780;border-radius:5px;outline:none}.esvc-input:focus{border-color:#63c9ee}.esvc-actions{display:flex;gap:8px;margin-top:12px}.esvc-actions button{padding:8px 9px;border:1px solid #4f9ec1;border-radius:5px;background:#15769d;color:white;font-weight:700}.esvc-actions button[disabled]{opacity:.45;cursor:default}.esvc-actions .esvc-disconnect{background:#492331;border-color:#9c5367}.esvc-status{min-height:18px;margin-top:10px;color:#aac4d2}.esvc-status.ok{color:#7de3a3}.esvc-status.warn{color:#ffd777}.esvc-status.error{color:#ff9c9c}.esvc-foot{margin-top:8px;color:#7895a5;font-size:11px}.esvc-audio{display:none}
    `;
    document.head.appendChild(style);

    const panel = document.createElement('section');
    panel.className = 'esvc-panel';
    panel.setAttribute('aria-label', 'Eagler Simple VC');
    panel.innerHTML = `
      <div class="esvc-head"><span>Eagler Simple VC</span><button class="esvc-x" type="button" aria-label="Close">×</button></div>
      <div class="esvc-body">
        <p class="esvc-note">Standalone WebRTC voice. This is not the Java Simple Voice Chat mod.</p>
        <label class="esvc-label" for="esvc-url">Secure voice server</label><input id="esvc-url" class="esvc-input" data-esvc-url data-esvc-field placeholder="wss://voice.example.com" value="${state.settings.url.replace(/"/g, '&quot;')}">
        <label class="esvc-label" for="esvc-token">Session token</label><input id="esvc-token" class="esvc-input" data-esvc-token data-esvc-field type="password" autocomplete="off" placeholder="Server-issued token (not saved)">
        <label class="esvc-label" for="esvc-room">Voice room</label><input id="esvc-room" class="esvc-input" data-esvc-room data-esvc-field maxlength="32" value="${state.settings.room.replace(/"/g, '&quot;')}">
        <label class="esvc-label" for="esvc-name">Display name</label><input id="esvc-name" class="esvc-input" data-esvc-name data-esvc-field maxlength="24" value="${state.settings.name.replace(/"/g, '&quot;')}">
        <div class="esvc-actions"><button type="button" data-esvc-connect>Connect &amp; Enable Mic</button><button type="button" class="esvc-disconnect" data-esvc-disconnect disabled>Disconnect</button></div>
        <div class="esvc-status" data-esvc-status>Voice disconnected</div>
        <div class="esvc-foot">Microphone access is requested only after you press Connect. Your session token is not saved. Right Shift toggles this panel.</div>
        <div class="esvc-audio" data-esvc-audio></div>
      </div>`;
    panel.hidden = true;
    document.body.appendChild(panel);
    state.panel = panel;
    panel.querySelector('.esvc-x').addEventListener('click', () => { panel.hidden = true; });
    panel.querySelector('[data-esvc-connect]').addEventListener('click', connect);
    panel.querySelector('[data-esvc-disconnect]').addEventListener('click', disconnect);
    return panel;
  }

  function togglePanel() {
    const panel = ensurePanel();
    panel.hidden = !panel.hidden;
    if (!panel.hidden) panel.querySelector('[data-esvc-url]').focus();
  }

  window.addEventListener('keydown', (event) => {
    if (event.code !== 'ShiftRight' || event.repeat) return;
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    togglePanel();
  }, { passive: true });

  window.EaglerSimpleVC = { version: '1.0.0-prototype', disconnect, toggle: togglePanel };
})();
