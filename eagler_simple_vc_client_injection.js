/* EAGLER_SIMPLE_VC_WSS_RELAY_V1
 * Standalone Eagler Simple VC browser connector.
 * Voice media is relayed through the configured WSS server. No WebRTC,
 * peer discovery, ICE exchange, or direct peer connection is used.
 */
(() => {
  'use strict';

  if (window.__eaglerSimpleVCRelayV1) return;
  window.__eaglerSimpleVCRelayV1 = true;

  const STORAGE_KEY = 'eagler-simple-vc-wss-relay-v1';
  const OUTBOUND_AUDIO = 0x01;
  const INBOUND_AUDIO = 0x41;
  const MAX_SOCKET_BACKLOG = 64 * 1024;
  const state = {
    panel: null,
    socket: null,
    stream: null,
    audioContext: null,
    sourceNode: null,
    processorNode: null,
    silentGain: null,
    speakers: new Map(),
    connected: false,
    settings: { url: '', room: 'lobby', name: 'Eagler Player' }
  };

  function loadSettings() {
    try { state.settings = { ...state.settings, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; } catch (_) { /* optional */ }
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
    return String(value || '').trim().replace(/[<>\r\n]/g, '').slice(0, 24) || 'Eagler Player';
  }

  function readSettings() {
    const url = state.panel.querySelector('[data-esvc-url]').value.trim();
    const token = state.panel.querySelector('[data-esvc-token]').value.trim();
    const room = sanitizeRoom(state.panel.querySelector('[data-esvc-room]').value) || 'lobby';
    const name = sanitizeName(state.panel.querySelector('[data-esvc-name]').value);
    state.settings = { url, room, name };
    saveSettings();
    // Session tokens remain only in memory and are not persisted to localStorage.
    return { ...state.settings, token };
  }

  function sendText(message) {
    if (state.socket?.readyState === WebSocket.OPEN) state.socket.send(JSON.stringify(message));
  }

  function clampSample(value) {
    return Math.max(-1, Math.min(1, value));
  }

  function sendAudio(floatSamples) {
    const socket = state.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN || socket.bufferedAmount > MAX_SOCKET_BACKLOG) return;
    const frame = new ArrayBuffer(1 + floatSamples.length * 2);
    const view = new DataView(frame);
    view.setUint8(0, OUTBOUND_AUDIO);
    for (let index = 0; index < floatSamples.length; index += 1) {
      view.setInt16(1 + index * 2, Math.round(clampSample(floatSamples[index]) * 32767), false);
    }
    socket.send(frame);
  }

  function getSpeaker(id) {
    let speaker = state.speakers.get(id);
    if (!speaker) {
      speaker = { nextTime: 0 };
      state.speakers.set(id, speaker);
    }
    return speaker;
  }

  function playAudioFrame(buffer) {
    if (!state.audioContext || !(buffer instanceof ArrayBuffer) || buffer.byteLength <= 9) return;
    const view = new DataView(buffer);
    if (view.getUint8(0) !== INBOUND_AUDIO) return;
    const speakerId = view.getUint32(1, false);
    const sampleRate = view.getUint32(5, false);
    if (sampleRate < 8000 || sampleRate > 96000 || (buffer.byteLength - 9) % 2 !== 0) return;
    const sampleCount = (buffer.byteLength - 9) / 2;
    if (sampleCount === 0 || sampleCount > 4096) return;

    const audioBuffer = state.audioContext.createBuffer(1, sampleCount, sampleRate);
    const channel = audioBuffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index += 1) channel[index] = view.getInt16(9 + index * 2, false) / 32768;

    const speaker = getSpeaker(speakerId);
    const source = state.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(state.audioContext.destination);
    const startAt = Math.max(state.audioContext.currentTime + 0.08, speaker.nextTime || 0);
    source.start(startAt);
    speaker.nextTime = startAt + audioBuffer.duration;
  }

  async function startCapture() {
    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      video: false
    });
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) throw new Error('Web Audio is unavailable');
    state.audioContext = new AudioContextCtor();
    await state.audioContext.resume();
    state.sourceNode = state.audioContext.createMediaStreamSource(state.stream);
    // ScriptProcessor is deliberately used for broad Chromium/Chromebook compatibility.
    state.processorNode = state.audioContext.createScriptProcessor(2048, 1, 1);
    state.silentGain = state.audioContext.createGain();
    state.silentGain.gain.value = 0;
    state.processorNode.onaudioprocess = (event) => sendAudio(event.inputBuffer.getChannelData(0));
    state.sourceNode.connect(state.processorNode);
    state.processorNode.connect(state.silentGain);
    state.silentGain.connect(state.audioContext.destination);
  }

  function stopCapture() {
    try { state.sourceNode?.disconnect(); } catch (_) { /* no-op */ }
    try { state.processorNode?.disconnect(); } catch (_) { /* no-op */ }
    try { state.silentGain?.disconnect(); } catch (_) { /* no-op */ }
    if (state.processorNode) state.processorNode.onaudioprocess = null;
    state.sourceNode = null;
    state.processorNode = null;
    state.silentGain = null;
    if (state.stream) state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
    if (state.audioContext) state.audioContext.close().catch(() => {});
    state.audioContext = null;
    state.speakers.clear();
  }

  function handleMessage(event) {
    if (event.data instanceof ArrayBuffer) {
      playAudioFrame(event.data);
      return;
    }
    let message;
    try { message = JSON.parse(event.data); } catch (_) { return; }
    if (!message || typeof message.type !== 'string') return;
    if (message.type === 'welcome') {
      setStatus(`Connected to relayed room “${state.settings.room}” — direct peer links are disabled`, 'ok');
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
      // Called only by the explicit Connect & Enable Mic button.
      await startCapture();
    } catch (error) {
      stopCapture();
      setStatus(error?.name === 'NotAllowedError' ? 'Microphone permission was not granted' : 'Microphone could not be started', 'error');
      return;
    }

    setStatus('Connecting to the relay server…', 'warn');
    const socket = new WebSocket(voiceUrl.toString());
    socket.binaryType = 'arraybuffer';
    state.socket = socket;
    socket.onopen = () => {
      setConnectedUi(true);
      sendText({ type: 'join', protocol: 'eagler-simple-vc-wss-relay/1', room: settings.room, name: settings.name, sampleRate: Math.round(state.audioContext.sampleRate) });
    };
    socket.onmessage = handleMessage;
    socket.onerror = () => setStatus('Could not reach the relay server', 'error');
    socket.onclose = () => {
      const wasConnected = state.connected;
      state.socket = null;
      stopCapture();
      setConnectedUi(false);
      if (wasConnected) setStatus('Voice relay disconnected', 'warn');
    };
  }

  function disconnect() {
    const socket = state.socket;
    state.socket = null;
    if (socket) {
      try { socket.send(JSON.stringify({ type: 'leave' })); } catch (_) { /* no-op */ }
      try { socket.close(1000, 'User disconnected'); } catch (_) { /* no-op */ }
    }
    stopCapture();
    setConnectedUi(false);
    setStatus('Voice disconnected');
  }

  function ensurePanel() {
    if (state.panel) return state.panel;
    loadSettings();
    const style = document.createElement('style');
    style.textContent = `
      .esvc-panel{position:fixed;z-index:2147483000;right:18px;top:64px;width:min(340px,calc(100vw - 36px));background:#0d1521;color:#eaf6ff;border:1px solid #4e8eb5;border-radius:10px;box-shadow:0 18px 50px #000b;font:13px/1.35 Arial,sans-serif;user-select:none}.esvc-head{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#10263a;border-radius:10px 10px 0 0;font-weight:700;color:#9fe5ff}.esvc-panel button{font:inherit;cursor:pointer}.esvc-x{color:#d8f1ff;background:transparent;border:0;font-size:17px}.esvc-body{padding:12px}.esvc-note{margin:0 0 10px;color:#adc9d9}.esvc-label{display:block;margin:8px 0 4px;color:#9fc2d5;font-size:11px;font-weight:700;text-transform:uppercase}.esvc-input{box-sizing:border-box;width:100%;padding:8px;color:#eefaff;background:#071019;border:1px solid #386780;border-radius:5px;outline:none}.esvc-input:focus{border-color:#63c9ee}.esvc-actions{display:flex;gap:8px;margin-top:12px}.esvc-actions button{padding:8px 9px;border:1px solid #4f9ec1;border-radius:5px;background:#15769d;color:white;font-weight:700}.esvc-actions button[disabled]{opacity:.45;cursor:default}.esvc-actions .esvc-disconnect{background:#492331;border-color:#9c5367}.esvc-status{min-height:18px;margin-top:10px;color:#aac4d2}.esvc-status.ok{color:#7de3a3}.esvc-status.warn{color:#ffd777}.esvc-status.error{color:#ff9c9c}.esvc-foot{margin-top:8px;color:#7895a5;font-size:11px}
    `;
    document.head.appendChild(style);

    const panel = document.createElement('section');
    panel.className = 'esvc-panel';
    panel.setAttribute('aria-label', 'Eagler Simple VC');
    panel.innerHTML = `
      <div class="esvc-head"><span>Eagler Simple VC</span><button class="esvc-x" type="button" aria-label="Close">×</button></div>
      <div class="esvc-body">
        <p class="esvc-note">Server-relayed WSS voice. No WebRTC or direct player-to-player links.</p>
        <label class="esvc-label" for="esvc-url">Secure voice relay</label><input id="esvc-url" class="esvc-input" data-esvc-url data-esvc-field placeholder="wss://voice.example.com" value="${state.settings.url.replace(/"/g, '&quot;')}">
        <label class="esvc-label" for="esvc-token">Session token</label><input id="esvc-token" class="esvc-input" data-esvc-token data-esvc-field type="password" autocomplete="off" placeholder="Server-issued token (not saved)">
        <label class="esvc-label" for="esvc-room">Voice room</label><input id="esvc-room" class="esvc-input" data-esvc-room data-esvc-field maxlength="32" value="${state.settings.room.replace(/"/g, '&quot;')}">
        <label class="esvc-label" for="esvc-name">Display name</label><input id="esvc-name" class="esvc-input" data-esvc-name data-esvc-field maxlength="24" value="${state.settings.name.replace(/"/g, '&quot;')}">
        <div class="esvc-actions"><button type="button" data-esvc-connect>Connect &amp; Enable Mic</button><button type="button" class="esvc-disconnect" data-esvc-disconnect disabled>Disconnect</button></div>
        <div class="esvc-status" data-esvc-status>Voice disconnected</div>
        <div class="esvc-foot">Microphone access is requested only after you press Connect. Your token is not saved. Right Shift toggles this panel.</div>
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

  window.EaglerSimpleVC = { version: '2.0.0-wss-relay-prototype', disconnect, toggle: togglePanel };
})();
