import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

const MAX_MESSAGE_BYTES = 32 * 1024;
const MAX_ROOM_PEERS = 16;
const ROOM_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const NAME_PATTERN = /^[^<>\r\n]{1,24}$/;

function parseCsv(value) {
  return (value || '').split(',').map((part) => part.trim()).filter(Boolean);
}

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function rejectUpgrade(socket, statusCode, message) {
  socket.write(`HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function safeJson(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > MAX_MESSAGE_BYTES) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

function normalizeJoin(message) {
  if (!message || message.type !== 'join' || message.protocol !== 'eagler-simple-vc/1') return null;
  const room = typeof message.room === 'string' ? message.room : '';
  const name = typeof message.name === 'string' ? message.name.trim() : '';
  if (!ROOM_PATTERN.test(room) || !NAME_PATTERN.test(name)) return null;
  return { room, name };
}

/**
 * Creates an authenticated WebRTC signaling service for standalone Eagler Simple VC.
 * It routes only signaling metadata; browser-to-browser WebRTC carries the audio.
 */
export function createVoiceService({ tokens, allowedOrigins, iceServers = [], logger = console, maxRoomPeers = MAX_ROOM_PEERS } = {}) {
  if (!tokens || tokens.size === 0) throw new Error('At least one EAGLER_SVC token is required.');
  if (!allowedOrigins || allowedOrigins.size === 0) throw new Error('At least one allowed Origin is required.');

  const rooms = new Map();
  const httpServer = createServer((request, response) => {
    if (request.url === '/healthz') {
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ ok: true, service: 'eagler-simple-vc', rooms: rooms.size }));
      return;
    }
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('Not found');
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES, perMessageDeflate: false });
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
      for (const peer of peers.values()) send(peer.socket, { type: 'peer-left', id: client.id });
      if (peers.size === 0) rooms.delete(client.room);
    }
    client.room = null;
  }

  wss.on('connection', (socket) => {
    const client = { id: randomUUID(), room: null, name: null, socket };

    socket.on('message', (raw, isBinary) => {
      if (isBinary) { socket.close(1003, 'Text signaling only'); return; }
      const message = safeJson(raw.toString());
      if (!message) { send(socket, { type: 'error', message: 'Invalid or oversized signaling message' }); return; }

      if (!client.room) {
        const join = normalizeJoin(message);
        if (!join) { send(socket, { type: 'error', message: 'Send a valid join message first' }); return; }
        const room = rooms.get(join.room) || new Map();
        if (room.size >= maxRoomPeers) { send(socket, { type: 'error', message: 'Voice room is full' }); socket.close(1008, 'Room full'); return; }
        const existingPeers = [...room.values()].map((peer) => ({ id: peer.id, name: peer.name }));
        client.room = join.room;
        client.name = join.name;
        room.set(client.id, client);
        rooms.set(client.room, room);
        send(socket, { type: 'welcome', id: client.id, room: client.room, peers: existingPeers, iceServers });
        for (const peer of room.values()) {
          if (peer.id !== client.id) send(peer.socket, { type: 'peer-joined', id: client.id, name: client.name });
        }
        return;
      }

      if (message.type === 'signal' && typeof message.to === 'string' && message.data && typeof message.data === 'object') {
        const recipient = rooms.get(client.room)?.get(message.to);
        if (recipient) send(recipient.socket, { type: 'signal', from: client.id, data: message.data });
        return;
      }

      if (message.type === 'leave') {
        leave(client);
        socket.close(1000, 'Client left');
        return;
      }

      send(socket, { type: 'error', message: 'Unsupported signaling message' });
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

function parseIceServers(value) {
  if (!value) return [];
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error('EAGLER_SVC_ICE_SERVERS_JSON must be a JSON array.');
  return parsed;
}

function startFromEnvironment() {
  const devMode = process.env.EAGLER_SVC_DEV_MODE === 'true';
  const tokens = new Set(parseCsv(process.env.EAGLER_SVC_TOKENS));
  const origins = new Set(parseCsv(process.env.EAGLER_SVC_ALLOWED_ORIGINS));
  if (devMode) {
    if (tokens.size === 0) tokens.add('change-me-before-production');
    if (origins.size === 0) origins.add('null');
  }
  let iceServers;
  try { iceServers = parseIceServers(process.env.EAGLER_SVC_ICE_SERVERS_JSON); } catch (error) {
    console.error('Invalid ICE configuration:', error.message);
    process.exitCode = 1;
    return;
  }
  const service = createVoiceService({ tokens, allowedOrigins: origins, iceServers });
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || '127.0.0.1';
  service.listen(port, host).then((address) => {
    console.log(`Eagler Simple VC signaling service listening on ${address.address}:${address.port}`);
    if (devMode) console.warn('Development mode is active. Configure HTTPS/WSS, fixed allowed origins, and strong tokens before production.');
  }).catch((error) => {
    console.error('Could not start Eagler Simple VC signaling service:', error.message);
    process.exitCode = 1;
  });
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) startFromEnvironment();
