#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/** NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Isolierter Strict-Build und risikobezogene Transporttests ohne Gerätewirkung.
 * Daten und Wirkung: Prüft DNS/TLS, Widerruf, Generationen und Quoten. Echte lokale
 * TLS-Negativtests ergänzen kontrollierte Sockettests; kein Partner-/Hardwaretest.
 * Bei Änderungen: Mit Transportvertrag aktualisieren. Testschlüssel werden zur Laufzeit
 * im temporären Verzeichnis erzeugt und anschließend gelöscht, niemals ausgegeben.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const tls = require('node:tls');
const https = require('node:https');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { execFileSync } = require('node:child_process');
const WebSocket = require('ws');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(root, '.partner-ws-test-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let checks = 0;
const clients = [];
const servers = [];
const sockets = [];
const done = label => { checks++; console.log(`PASS ${label}`); };
async function waitFor(predicate, timeout = 1500) {
  const until = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > until) throw new Error('test_wait_timeout');
    await pause(5);
  }
}

(async () => {
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'),
    '--strict', '--noUncheckedIndexedAccess', '--exactOptionalPropertyTypes', '--noImplicitOverride',
    '--noImplicitReturns', '--noFallthroughCasesInSwitch', '--skipLibCheck', '--module', 'NodeNext',
    '--moduleResolution', 'NodeNext', '--target', 'ES2022', '--esModuleInterop', '--outDir', temporary,
    'src-ts/runtime-executables/lib/partner-websocket.ts'], { cwd: root, stdio: 'pipe' });
  const { PartnerWebSocketClient, isPartnerAddressAllowed, validatePartnerEndpoint, PARTNER_WS_LIMITS } = require(path.join(temporary, 'partner-websocket.js'));
  done('TypeScript strict without any/nocheck');
  const token = crypto.randomBytes(32).toString('base64url');
  function config(extra = {}) {
    return { partnerId: 'partner-test', endpoint: 'wss://partner.example/ws',
      allowedEndpoint: { hostname: 'partner.example', port: 443, path: '/ws' },
      credentials: { expiresAtMs: Date.now() + 60000, bearerToken: token }, ...extra };
  }
  for (const address of ['127.0.0.1', '0.0.0.0', '169.254.169.254', '10.0.0.1', '192.168.1.1',
    '100.100.100.200', '224.0.0.1', '::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', 'fc00::1', 'fe80::1', '2001:db8::1']) {
    assert.equal(isPartnerAddressAllowed(address), false, address);
  }
  assert.equal(isPartnerAddressAllowed('8.8.8.8'), true);
  assert.equal(isPartnerAddressAllowed('2606:4700:4700::1111'), true);
  assert.equal(isPartnerAddressAllowed('10.7.0.4', ['10.7.0.4']), true);
  assert.equal(isPartnerAddressAllowed('127.0.0.1', ['127.0.0.1']), false);
  assert.equal(isPartnerAddressAllowed('169.254.169.254', ['169.254.169.254']), false);
  assert.equal(isPartnerAddressAllowed('100.100.100.200', ['100.100.100.200']), false);
  assert.equal(isPartnerAddressAllowed('168.63.129.16'), false);
  done('Public addresses only; exact VPN exception never opens loopback/metadata');
  for (const endpoint of ['ws://partner.example/ws', 'wss://other.example/ws', 'wss://partner.example/other',
    'wss://partner.example:8443/ws', 'wss://user:pass@partner.example/ws', 'wss://partner.example/ws?token=x',
    'wss://partner.example/ws#x', 'wss://127.0.0.1/ws', 'wss://partner.example./ws']) {
    assert.throws(() => validatePartnerEndpoint(config({ endpoint })), /invalid_config/);
  }
  done('Exact endpoint profile; no URL credentials/query/fragment or alternate ports');

  class FakeSocket extends EventEmitter {
    constructor() { super(); this.readyState = WebSocket.CONNECTING; this.bufferedAmount = 0; this.protocol = 'nexowatt.partner.v1'; this.sent = []; this.terminated = false; }
    open() {
      this.peer = new tls.TLSSocket(new net.Socket());
      Object.defineProperty(this.peer, 'remoteAddress', { value: '8.8.8.8' });
      this.peer.authorized = true;
      this.peer.getPeerCertificate = () => ({ subjectaltname: 'DNS:partner.example', valid_to: new Date(Date.now() + 120000).toUTCString() });
      this.emit('upgrade', { socket: this.peer });
      if (this.terminated) return;
      this.readyState = WebSocket.OPEN; this.emit('open');
    }
    send(text, _options, callback) { this.sent.push(text); if (callback) callback(); }
    ping() { this.emit('pong'); }
    terminate() { this.terminated = true; this.readyState = WebSocket.CLOSED; this.peer?.destroy(); this.emit('close'); }
  }
  function harness(customHooks = {}, dependencies = {}, selectedConfig = config()) {
    const state = []; const received = []; const made = []; let allowed = true;
    const client = new PartnerWebSocketClient(selectedConfig, {
      isAuthorized: () => allowed,
      onMessage: (id, text) => { received.push([id, text]); },
      onState: (status, code) => { state.push([status, code]); }, ...customHooks,
    }, { resolve: async () => [{ address: '8.8.8.8', family: 4 }], random: () => 0,
      socketFactory: (_url, _protocol, options) => { const socket = new FakeSocket(); socket.options = options; made.push(socket); return socket; }, ...dependencies });
    clients.push(client);
    return { client, state, received, made, revoke: () => { allowed = false; } };
  }
  const first = harness(); first.client.start(); await waitFor(() => first.made.length);
  const firstSocket = first.made[0]; firstSocket.open();
  assert.equal(firstSocket.options.rejectUnauthorized, true);
  assert.equal(firstSocket.options.followRedirects, false);
  assert.equal(firstSocket.options.perMessageDeflate, false);
  assert.equal(firstSocket.options.maxPayload, 65536);
  assert.equal(firstSocket.options.maxFragments, 128);
  assert.equal(firstSocket.options.maxBufferedChunks, 128);
  assert.equal(firstSocket.options.headers.Authorization, `Bearer ${token}`);
  const pinned = await new Promise((resolve, reject) => firstSocket.options.lookup('changed.example', {}, (err, address) => err ? reject(err) : resolve(address)));
  assert.equal(pinned, '8.8.8.8');
  firstSocket.emit('message', Buffer.from('{"partnerId":"forged"}'), false);
  await waitFor(() => first.received.length);
  assert.equal(first.received[0][0], 'partner-test');
  assert.equal(first.client.send('{}'), true);
  first.revoke(); assert.equal(first.client.send('{}'), false);
  assert.equal(firstSocket.terminated, true);
  assert.deepEqual(first.state.at(-1), ['blocked', 'authorization_revoked']);
  assert.equal(JSON.stringify(first.state).includes(token), false);
  done('Pinned target, TLS/quotas, configured identity and immediate send revocation');

  let release; let activeContext; let consumed = 0;
  const queued = harness({ onMessage: async (_id, _text, context) => {
    consumed++; activeContext = context;
    await new Promise(resolve => { release = resolve; });
    assert.equal(context.isCurrent(), false); assert.equal(context.send('old-response'), false);
    assert.equal(context.signal.aborted, true);
  } });
  queued.client.start(); await waitFor(() => queued.made.length); queued.made[0].open();
  queued.made[0].emit('message', Buffer.from('one'), false);
  queued.made[0].emit('message', Buffer.from('two'), false);
  await waitFor(() => activeContext); queued.client.stop(); release(); await pause(10);
  assert.equal(consumed, 1); assert.equal(queued.made[0].sent.length, 0);
  done('Revocation aborts session context; queued messages discarded, delayed reply blocked');

  let openedAfterStop = false; let lifecycle;
  lifecycle = harness({ onState: state => { if (state === 'open') lifecycle.client.stop(); },
    onOpen: () => { openedAfterStop = true; } });
  lifecycle.client.start(); await waitFor(() => lifecycle.made.length); lifecycle.made[0].open();
  assert.equal(openedAfterStop, false); assert.equal(lifecycle.made[0].terminated, true);
  done('Synchronous stop from status callback prevents later onOpen/timer activation');
  const brokenState = harness({ onState: state => { if (state === 'open') throw new Error('SYNTHETIC_PRIVATE_STATE'); } });
  brokenState.client.start(); await waitFor(() => brokenState.made.length); brokenState.made[0].open();
  assert.equal(brokenState.made[0].terminated, true);
  assert.equal(brokenState.client.send('{}'), false);
  done('Broken lifecycle receiver fails closed');

  const brokenHandler = harness({ onMessage: () => { throw new Error('SYNTHETIC_PRIVATE_HANDLER'); } });
  brokenHandler.client.start(); await waitFor(() => brokenHandler.made.length); brokenHandler.made[0].open();
  brokenHandler.made[0].emit('message', Buffer.from('{}'), false);
  await waitFor(() => brokenHandler.state.some(s => s[1] === 'handler_error'));
  assert.equal(JSON.stringify(brokenHandler.state).includes('SYNTHETIC_PRIVATE_HANDLER'), false); brokenHandler.client.stop();
  done('Handler exception is isolated and redacted');

  for (const mode of ['binary', 'large', 'flood', 'backpressure']) {
    const h = harness(); h.client.start(); await waitFor(() => h.made.length); h.made[0].open();
    if (mode === 'binary') h.made[0].emit('message', Buffer.from('{}'), true);
    if (mode === 'large') h.made[0].emit('message', Buffer.alloc(65537), false);
    if (mode === 'flood') for (let i = 0; i < 101; i++) h.made[0].emit('ping');
    if (mode === 'backpressure') { h.made[0].bufferedAmount = 131072; assert.equal(h.client.send('x'), false); }
    assert.equal(h.made[0].terminated, true, mode); h.client.stop();
  }
  done('Binary/oversized messages, control flood and outbound backpressure terminate');
  const forbidden = harness({}, { resolve: async () => [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }] });
  forbidden.client.start(); await waitFor(() => forbidden.state.some(s => s[1] === 'target_forbidden'));
  assert.equal(forbidden.made.length, 0); done('Mixed public/private DNS answers fail closed before connecting');

  let monotonic = 1000;
  const expiry = harness({}, { monotonicNow: () => monotonic, wallNow: () => 100000 },
    config({ credentials: { expiresAtMs: 101000, bearerToken: token } }));
  expiry.client.start(); await waitFor(() => expiry.made.length); expiry.made[0].open();
  monotonic = 2001; assert.equal(expiry.client.send('{}'), false);
  assert.equal(expiry.state.at(-1)[1], 'authentication_expired');
  done('Monotonic credential expiry survives frozen/backward wall clock');

  let aborted = false;
  const hanging = harness({}, { resolve: (_hostname, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new Error('SYNTHETIC_PRIVATE')); });
  }) });
  const started = performance.now(); hanging.client.start();
  await waitFor(() => hanging.state.some(s => s[1] === 'attempt_timeout'), 6500);
  assert.equal(aborted, true); assert.equal(hanging.made.length, 0);
  assert.ok(performance.now() - started < 6000); hanging.client.stop();
  done('Five-second total attempt cancels hanging DNS and exposes only fixed error code');

  // Echte TLS-Tests verbinden nur Loopback. Ein injizierter Dialer verändert absichtlich
  // das gepinnte Ziel; Produktprüfung muss diesen Unterschied anschließend ablehnen.
  const key = path.join(temporary, 'test-key.pem'); const cert = path.join(temporary, 'test-cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key,
    '-out', cert, '-days', '1', '-subj', '/CN=partner.example', '-addext', 'subjectAltName=DNS:partner.example'], { stdio: 'ignore' });
  fs.chmodSync(key, 0o600);
  const certificate = fs.readFileSync(cert, 'utf8');
  const server = https.createServer({ key: fs.readFileSync(key), cert: certificate }); servers.push(server);
  const wss = new WebSocket.WebSocketServer({ server, perMessageDeflate: false });
  server.on('connection', socket => { sockets.push(socket); });
  wss.on('connection', socket => { socket.on('error', () => {}); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const localConfig = config({ endpoint: `wss://partner.example:${port}/ws`,
    allowedEndpoint: { hostname: 'partner.example', port, path: '/ws' },
    credentials: { expiresAtMs: Date.now() + 60000, bearerToken: token, caPem: certificate } });
  const actualFactory = (url, subprotocol, options) => new WebSocket(url, subprotocol,
    { ...options, lookup: (_host, opts, cb) => opts.all ? cb(null, [{ address: '127.0.0.1', family: 4 }]) : cb(null, '127.0.0.1', 4) });
  const actual = harness({}, { socketFactory: actualFactory }, localConfig);
  actual.client.start(); await waitFor(() => actual.state.some(s => s[1] === 'target_forbidden'));
  assert.equal(actual.state.some(s => s[0] === 'open'), false); actual.client.stop();
  done('Real TLS+WebSocket handshake: changed actual remote address rejected');
  const untrusted = harness({}, { socketFactory: actualFactory }, { ...localConfig,
    credentials: { expiresAtMs: Date.now() + 60000, bearerToken: token } });
  untrusted.client.start(); await waitFor(() => untrusted.state.some(s => s[1] === 'network_error'));
  assert.equal(untrusted.state.some(s => s[0] === 'open'), false); untrusted.client.stop();
  done('Real TLS rejects untrusted certificate with no insecure fallback');
  const wrongHostname = harness({}, { socketFactory: actualFactory }, { ...localConfig,
    endpoint: `wss://wrong.example:${port}/ws`, allowedEndpoint: { hostname: 'wrong.example', port, path: '/ws' } });
  wrongHostname.client.start(); await waitFor(() => wrongHostname.state.some(s => s[1] === 'network_error'));
  assert.equal(wrongHostname.state.some(s => s[0] === 'open'), false); wrongHostname.client.stop();
  done('Real TLS rejects trusted certificate with wrong hostname');
  console.log(JSON.stringify({ ok: true, checks, scope: 'strict build, controlled transport tests, real TLS negative tests; no partner or hardware approval' }));
})().catch(error => {
  console.error(error instanceof Error ? error.stack : 'test_failed'); process.exitCode = 1;
}).finally(async () => {
  for (const client of clients) client.stop();
  for (const socket of sockets) socket.destroy();
  await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
  fs.rmSync(temporary, { recursive: true, force: true });
});
