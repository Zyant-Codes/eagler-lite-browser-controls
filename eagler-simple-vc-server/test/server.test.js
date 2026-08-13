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

function nextMessage(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for signaling message')), 1500);
    socket.once('message', (raw) => {
      clearTimeout(timeout);
      resolve(JSON.parse(raw.toString()));
    });
  });
}

async function startService() {
  const service = createVoiceService({
    tokens: new Set(['test-token']),
    allowedOrigins: new Set(['https://client.example']),
    iceServers: [{ urls: 'stun:stun.example:3478' }],
    logger: { log() {}, warn() {}, error() {} }
  });
  const address = await service.listen(0, '127.0.0.1');
  return { service, url: `ws://127.0.0.1:${address.port}/?token=test-token` };
}

test('authenticated clients can join a room and relay signaling only to room peers', async (t) => {
  const { service, url } = await startService();
  t.after(() => service.close());

  const first = await open(url);
  t.after(() => first.close());
  first.send(JSON.stringify({ type: 'join', protocol: 'eagler-simple-vc/1', room: 'lobby', name: 'Alpha' }));
  const firstWelcome = await nextMessage(first);
  assert.equal(firstWelcome.type, 'welcome');
  assert.deepEqual(firstWelcome.peers, []);
  assert.deepEqual(firstWelcome.iceServers, [{ urls: 'stun:stun.example:3478' }]);

  const joinedNotice = nextMessage(first);
  const second = await open(url);
  t.after(() => second.close());
  second.send(JSON.stringify({ type: 'join', protocol: 'eagler-simple-vc/1', room: 'lobby', name: 'Bravo' }));
  const secondWelcome = await nextMessage(second);
  const firstNotice = await joinedNotice;
  assert.equal(secondWelcome.type, 'welcome');
  assert.equal(secondWelcome.peers.length, 1);
  assert.equal(firstNotice.type, 'peer-joined');

  const signalAtSecond = nextMessage(second);
  first.send(JSON.stringify({ type: 'signal', to: secondWelcome.id, data: { description: { type: 'offer', sdp: 'test' } } }));
  const received = await signalAtSecond;
  assert.equal(received.type, 'signal');
  assert.equal(received.from, firstWelcome.id);
  assert.equal(received.data.description.type, 'offer');
});

test('connections without a valid token are rejected before room access', async (t) => {
  const { service, url } = await startService();
  t.after(() => service.close());
  const invalidUrl = url.replace('test-token', 'wrong-token');
  await assert.rejects(() => open(invalidUrl), /Unexpected server response|WebSocket/);
});

test('connections from an unapproved Origin are rejected before room access', async (t) => {
  const { service, url } = await startService();
  t.after(() => service.close());
  await assert.rejects(() => open(url, 'https://unapproved.example'), /Unexpected server response|WebSocket/);
});
