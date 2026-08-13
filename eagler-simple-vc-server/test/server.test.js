import assert from 'node:assert/strict';
import test from 'node:test';
import { WebSocket } from 'ws';
import { createVoiceService } from '../server.js';

function open(url, origin = 'https://client.example') {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { origin });
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

function nextText(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for control message')), 1500);
    socket.once('message', (raw, isBinary) => {
      clearTimeout(timeout);
      if (isBinary) reject(new Error('Expected a text control message'));
      else resolve(JSON.parse(raw.toString()));
    });
  });
}

function nextBinary(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for relayed audio')), 1500);
    socket.once('message', (raw, isBinary) => {
      clearTimeout(timeout);
      if (!isBinary) reject(new Error('Expected a binary audio frame'));
      else resolve(Buffer.from(raw));
    });
  });
}

async function startService() {
  const service = createVoiceService({
    tokens: new Set(['test-token']),
    allowedOrigins: new Set(['https://client.example']),
    logger: { log() {}, warn() {}, error() {} }
  });
  const address = await service.listen(0, '127.0.0.1');
  return { service, url: `ws://127.0.0.1:${address.port}/?token=test-token` };
}

async function join(socket, room, name, sampleRate) {
  socket.send(JSON.stringify({ type: 'join', protocol: 'eagler-simple-vc-wss-relay/1', room, name, sampleRate }));
  return nextText(socket);
}

test('authenticated room members receive server-relayed audio without peer signaling', async (t) => {
  const { service, url } = await startService();
  t.after(() => service.close());

  const first = await open(url);
  const second = await open(url);
  t.after(() => first.close());
  t.after(() => second.close());
  const firstWelcome = await join(first, 'lobby', 'Alpha', 48000);
  const secondWelcome = await join(second, 'lobby', 'Bravo', 16000);
  assert.equal(firstWelcome.type, 'welcome');
  assert.equal(firstWelcome.relay, true);
  assert.equal(secondWelcome.type, 'welcome');

  const audioAtSecond = nextBinary(second);
  const inbound = Buffer.from([0x01, 0x00, 0x01, 0xFF, 0xFE]);
  first.send(inbound, { binary: true });
  const received = await audioAtSecond;
  assert.equal(received[0], 0x41);
  assert.equal(received.readUInt32BE(1), firstWelcome.id);
  assert.equal(received.readUInt32BE(5), 48000);
  assert.deepEqual(received.subarray(9), inbound.subarray(1));
});

test('connections without a valid token are rejected before room access', async (t) => {
  const { service, url } = await startService();
  t.after(() => service.close());
  await assert.rejects(() => open(url.replace('test-token', 'wrong-token')), /Unexpected server response|WebSocket/);
});

test('connections from an unapproved Origin are rejected before room access', async (t) => {
  const { service, url } = await startService();
  t.after(() => service.close());
  await assert.rejects(() => open(url, 'https://unapproved.example'), /Unexpected server response|WebSocket/);
});

test('a client cannot send audio before joining an authenticated room', async (t) => {
  const { service, url } = await startService();
  t.after(() => service.close());
  const socket = await open(url);
  t.after(() => socket.close());
  const closed = new Promise((resolve) => socket.once('close', (code) => resolve(code)));
  socket.send(Buffer.from([0x01, 0x00, 0x00]), { binary: true });
  assert.equal(await closed, 1008);
});
