import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

const MAX_TEXT_BYTES = 8 * 1024;
const MAX_AUDIO_BYTES = 8 * 1024;
const MAX_AUDIO_BYTES_PER_SECOND = 128 * 1024;
const MAX_ROOM_PEERS = 16;
const ROOM_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const NAME_PATTERN = /^[^<>\r\n]{1,24}$/;
const OUTBOUND_AUDIO = 0x01;
const INBOUND_AUDIO = 0x41;

function parseCsv(value) {
  return (value || '').split(',').map((part) => part.trim()).filter(Boolean);
}

function sendJson(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function rejectUpgrade(socket, statusCode, message) {
  socket.write(`HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function safeJson(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > MAX_TEXT_BYTES) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

function normalizeJoin(message) {
  if (!message || message.type !== 'join' || message.protocol !== 'eagler-simple-vc-wss-relay/1') return null;
  const room = typeof message.room === 'string' ? message.room : '';
  const name = typeof message.name === 'string' ? message.name.trim() : '';
  const sampleRate = Number(message.sampleRate);
  if (!ROOM_PATTERN.test(room) || !NAME_PATTERN.test(name) || !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000) return null;
  return { room, name, sampleRate };
}

/**
 * Creates a standalone WSS voice relay. The server receives one WebSocket from
 * each client and forwards bounded PCM frames only to authenticated peers in
 * the same room. There is no WebRTC, ICE exchange, or direct peer connection.
 */
export function createVoiceService({ tokens, allowedOrigins, logger = console, maxRoomPeers = MAX_ROOM_PEERS } = {}) {
  if (!tokens || tokens.size === 0) throw new Error('At least one EAGLER_SVC token is required.');
  if (!allowedOrigins || allowedOrigins.size === 0) throw new Error('At least one allowed Origin is required.');

  const rooms = new Map();
  const httpServer = createServer((request, response) => {
    if (request.url === '/healthz') {
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ ok: true, service: 'eagler-simple-vc-wss-relay', rooms: rooms.size }));
      return;
    }
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('Not found');
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_AUDIO_BYTES, perMessageDeflate: false });
  httpServer.on('upgrade', (request, socket, head) => {
    const host = request.headers.host || 'localhost';
    let url;
    try { url = new URL(request.url, `https://${host}`); } catch (_) { rejectUpgrade(socket, 400, 'Bad Request'); return; }
    const origin = request.headers.origin || 'null';
    const token = url.searchParams.get('token') || '';
    if (!allowedOrigins.has(origin)) { rejectUpgrade(socket, 403, 'Forbidden'); return; }
    if (!tokens.has(token)) { rejectUpgrade(socket, 401, 'Unauthorized'); return; }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
  });

  function leave(client) {
    if (!client.room) return;
    const peers = rooms.get(client.room);
    if (peers) {
      peers.delete(client.id);
      if (peers.size === 0) rooms.delete(client.room);
    }
    client.room = null;
  }

  function relayAudio(client, raw) {
    if (!client.room) { client.socket.close(1008, 'Join a room first'); return; }
    const input = Buffer.from(raw);
    if (input.length < 3 || input.length > MAX_AUDIO_BYTES || input[0] !== OUTBOUND_AUDIO || (input.length - 1) % 2 !== 0) {
      client.socket.close(1003, 'Invalid audio frame');
      return;
    }
    const now = Date.now();
    if (now - client.rateWindowStart >= 1000) {
      client.rateWindowStart = now;
      client.rateBytes = 0;
    }
    client.rateBytes += input.length;
    if (client.rateBytes > MAX_AUDIO_BYTES_PER_SECOND) {
      client.socket.close(1008, 'Audio rate limit exceeded');
      return;
    }

    const output = Buffer.allocUnsafe(9 + input.length - 1);
    output[0] = INBOUND_AUDIO;
    output.writeUInt32BE(client.numericId, 1);
    output.writeUInt32BE(client.sampleRate, 5);
    input.copy(output, 9, 1);
    for (const peer of rooms.get(client.room)?.values() || []) {
      if (peer.id !== client.id && peer.socket.readyState === WebSocket.OPEN) peer.socket.send(output, { binary: true });
    }
  }

  let nextNumericId = 1;
  wss.on('connection', (socket) => {
    const client = {
      id: randomUUID(),
      numericId: nextNumericId++,
      room: null,
      name: null,
      sampleRate: null,
      socket,
      rateWindowStart: Date.now(),
      rateBytes: 0
    };
    if (nextNumericId > 0xFFFFFFFF) nextNumericId = 1;

    socket.on('message', (raw, isBinary) => {
      if (isBinary) { relayAudio(client, raw); return; }
      const message = safeJson(raw.toString());
      if (!message) { sendJson(socket, { type: 'error', message: 'Invalid or oversized control message' }); return; }

      if (!client.room) {
        const join = normalizeJoin(message);
        if (!join) { sendJson(socket, { type: 'error', message: 'Send a valid join message first' }); return; }
        const room = rooms.get(join.room) || new Map();
        if (room.size >= maxRoomPeers) { sendJson(socket, { type: 'error', message: 'Voice room is full' }); socket.close(1008, 'Room full'); return; }
        client.room = join.room;
        client.name = join.name;
        client.sampleRate = join.sampleRate;
        room.set(client.id, client);
        rooms.set(client.room, room);
        sendJson(socket, { type: 'welcome', id: client.numericId, room: client.room, relay: true });
        return;
      }

      if (message.type === 'leave') {
        leave(client);
        socket.close(1000, 'Client left');
        return;
      }
      sendJson(socket, { type: 'error', message: 'Unsupported control message' });
    });

    socket.on('close', () => leave(client));
    socket.on('error', () => leave(client));
  });

  return {
    async listen(port, host = '127.0.0.1') {
      await new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(port, host, () => {
          httpServer.off('error', reject);
          resolve();
        });
      });
      return httpServer.address();
    },
    async close() {
      for (const room of rooms.values()) {
        for (const client of room.values()) client.socket.close(1001, 'Server stopping');
      }
      await new Promise((resolve) => httpServer.close(resolve));
    },
    roomCount: () => rooms.size,
    httpServer
  };
}

function startFromEnvironment() {
  const devMode = process.env.EAGLER_SVC_DEV_MODE === 'true';
  const tokens = new Set(parseCsv(process.env.EAGLER_SVC_TOKENS));
  const origins = new Set(parseCsv(process.env.EAGLER_SVC_ALLOWED_ORIGINS));
  if (devMode) {
    if (tokens.size === 0) tokens.add('change-me-before-production');
    if (origins.size === 0) origins.add('null');
  }
  const service = createVoiceService({ tokens, allowedOrigins: origins });
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || '127.0.0.1';
  service.listen(port, host).then((address) => {
    console.log(`Eagler Simple VC WSS relay listening on ${address.address}:${address.port}`);
    if (devMode) console.warn('Development mode is active. Configure HTTPS/WSS, fixed allowed origins, and strong tokens before production.');
  }).catch((error) => {
    console.error('Could not start Eagler Simple VC relay:', error.message);
    process.exitCode = 1;
  });
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) startFromEnvironment();
