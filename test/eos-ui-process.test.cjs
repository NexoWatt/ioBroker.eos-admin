'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const ts = require('typescript');
const express = require('express');
const baseDir = path.resolve(__dirname, '..');
const compiled = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-ui-process-test-'));
for (const name of ['eosUiProcess', 'eosUiProcessWorker', 'eosUiProcessRpc', 'eosUiSecretCodec']) {
  const source = fs.readFileSync(path.join(baseDir, 'src/lib', `${name}.ts`), 'utf8');
  fs.writeFileSync(path.join(compiled, `${name}.js`), ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText);
}
const { createEosUiProcess } = require(path.join(compiled, 'eosUiProcess'));
test.after(() => fs.rmSync(compiled, { recursive: true, force: true }));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function eventually(check, timeout = 8000) { const until = Date.now() + timeout; while (!check()) { if (Date.now() > until) throw new Error('condition not reached'); await delay(25); } }
async function fixture(t, actual = false, extra = {}) {
  const writes = [], leases = new Set(); let allowed = true, origin = true, access = { authenticated: false };
  const owner = { namespace: 'eos-admin.0', instance: 0, config: { eosUi: {}, port: 443, secure: true },
    log: { info() {}, warn() {}, error() {}, debug() {} },
    getForeignObjectAsync: async id => id === 'system.config' ? { native: { secret: '' } } : { native: {} },
    getForeignStateAsync: async () => ({ val: 22, ts: 123456, q: 64 }),
    setForeignStateAsync: async (...args) => { writes.push(args); },
    eosStateSubscriptions: { async acquireHost(pattern) { const lease = { pattern }; leases.add(lease); return async () => { leases.delete(lease); }; } },
    ...extra,
  };
  const bridge = { canWrite: () => allowed, originAllowed: () => origin, machineRequestAllowed: () => false,
    isListening: () => true, getLicense: () => ({ valid: true, coreEnabled: true, edition: 'home', limits: { chargePoints: 3, batteries: 2 }, features: ['energy'] }), resolveAccess: async () => access };
  const runtime = createEosUiProcess(owner, bridge, { baseDir, workerPath: path.join(compiled, 'eosUiProcessWorker.js'),
    runtimePath: actual ? path.join(baseDir, 'ui/main.js') : path.join(__dirname, 'fixtures/eos-ui-process-runtime.cjs'), restartDelayMs: 25 });
  t.after(() => runtime.stop());
  await runtime.start();
  const app = express(); app.use((req, res, next) => runtime.handle(req, res, next)); app.use((_req, res) => res.status(404).end());
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { runtime, writes, leases, base, owner, denyWrites() { allowed = false; }, denyOrigin() { origin = false; }, setAccess(value) { access = value; } };
}
test('actual OS child preserves source timestamps/quality and HTTP identity is parent-bound', async t => {
  const f = await fixture(t);
  const identity = await (await fetch(f.base + '/identity', { headers: { 'x-eos-process-context': 'a'.repeat(48), 'x-user': 'system.user.admin' } })).json();
  assert.notEqual(identity.pid, process.pid); assert.equal(identity.pid, f.runtime.status().process.pid);
  assert.deepEqual(identity.access, { authenticated: false }); assert.equal(identity.remote, '127.0.0.1');
  assert.deepEqual(await (await fetch(f.base + '/state')).json(), { val: 22, ts: 123456, q: 64 });
  const state = { val: null, ts: 123, q: 64, ack: true }; f.runtime.onStateChange('device.0.power', state);
  assert.deepEqual((await f.runtime.reconcileDeviceEms([])).last, { id: 'device.0.power', state });
  assert.deepEqual(await (await fetch(f.base + '/forbidden')).json(), { canSendToHost: false, canExec: false });
  assert.deepEqual(await f.runtime.getHistoryBackupRequirement(), { provider: 'adapter', instance: 'history.0' });
  assert.equal(f.leases.size, 1);
});
test('each write rechecks live parent ownership; shutdown releases only owned subscriptions', async t => {
  const f = await fixture(t); await f.runtime.startOperational();
  assert.equal((await fetch(f.base + '/write')).status, 200); assert.equal(f.writes.length, 1);
  f.denyWrites(); assert.equal((await fetch(f.base + '/write')).status, 503); assert.equal(f.writes.length, 1);
  await f.runtime.stop(); assert.equal(f.leases.size, 0); assert.equal(f.runtime.status().process.pid, null);
});
test('child exit is contained and restart uses new PID/generation without replaying measurements', async t => {
  const f = await fixture(t); const old = f.runtime.status().process;
  f.runtime.onStateChange('device.0.power', { val: 99, ts: 1, q: 0 });
  await fetch(f.base + '/crash').catch(() => undefined);
  await eventually(() => f.runtime.status().process.state === 'running' && f.runtime.status().process.generation > old.generation);
  assert.notEqual(f.runtime.status().process.pid, old.pid); assert.equal(f.runtime.status().process.restarts, 1);
  assert.deepEqual(await (await fetch(f.base + '/state')).json(), { val: 22, ts: 123456, q: 64 });
  assert.equal(f.leases.size, 1);
});
test('blocked child event loop does not block parent and is killed before restart', async t => {
  const f = await fixture(t); const oldPid = f.runtime.status().process.pid; let parentTicks = 0;
  const timer = setInterval(() => parentTicks++, 20); t.after(() => clearInterval(timer));
  const busy = fetch(f.base + '/busy').catch(() => undefined);
  await delay(150); assert.ok(parentTicks >= 3);
  await eventually(() => f.runtime.status().process.state === 'running' && f.runtime.status().process.pid !== oldPid, 9000);
  await busy; assert.ok(parentTicks > 50); assert.throws(() => process.kill(oldPid, 0), /ESRCH/);
});
test('real hosted UI shell retains login, origin and CSRF/role admission across private HTTP bridge', async t => {
  const f = await fixture(t, true);
  assert.equal((await fetch(f.base + '/static/login.js')).status, 200);
  assert.equal((await fetch(f.base + '/api/state')).status, 401);
  f.setAccess({ authenticated: true, user: 'system.user.customer', role: 'customer', capabilities: ['frontend.open'], csrfToken: 'x'.repeat(32), credentialKey: 'revision-1' });
  const response = await fetch(f.base + '/api/state'); assert.equal(response.status, 200, await response.text());
  assert.equal((await fetch(f.base + '/api/set', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 403);
  f.denyOrigin(); assert.equal((await fetch(f.base + '/api/state')).status, 403);
});
test('HTTP body streaming, fallthrough and SSE disconnect keep the public connection usable', async t => {
  const f = await fixture(t); const payload = 'x'.repeat(100000);
  assert.equal(await (await fetch(f.base + '/echo', { method: 'POST', body: payload })).text(), payload);
  assert.equal((await fetch(f.base + '/unknown')).status, 404);
  const abort = new AbortController(); const response = await fetch(f.base + '/events', { signal: abort.signal });
  const reader = response.body.getReader(); assert.match(Buffer.from((await reader.read()).value).toString(), /connected/);
  abort.abort(); await reader.cancel().catch(() => undefined);
  assert.equal((await fetch(f.base + '/identity')).status, 200);
});
test('private loopback rejects direct requests, spoofed capabilities and replay while a legitimate stream stays open', async t => {
  const f = await fixture(t); let captured;
  const original = http.request;
  http.request = function (options, ...args) {
    if (options?.headers?.['x-eos-process-context']) captured = { port: options.port, nonce: options.headers['x-eos-process-context'] };
    return Reflect.apply(original, this, [options, ...args]);
  };
  t.after(() => { http.request = original; });
  const controller = new AbortController(); const stream = await fetch(f.base + '/events', { signal: controller.signal });
  const reader = stream.body.getReader(); await reader.read(); assert.ok(captured);
  const privateBase = `http://127.0.0.1:${captured.port}`;
  assert.equal((await fetch(privateBase + '/identity')).status, 403);
  assert.equal((await fetch(privateBase + '/identity', { headers: { 'x-eos-process-context': 'a'.repeat(48), 'x-user': 'system.user.admin' } })).status, 403);
  assert.equal((await fetch(privateBase + '/events', { headers: { 'x-eos-process-context': captured.nonce } })).status, 403);
  assert.equal((await fetch(privateBase + '/write', { method: 'POST', headers: { 'x-eos-process-context': captured.nonce } })).status, 403);
  assert.equal(f.writes.length, 0); controller.abort(); await reader.cancel().catch(() => undefined);
});
test('process diagnostics remove complete configured secrets before shortening', () => {
  const { sanitizeUiProcessLog } = require(path.join(compiled, 'eosUiProcessRpc'));
  const token = 'private-credential-value';
  const value = sanitizeUiProcessLog('x'.repeat(1000) + token + ' completed', { eosUi: { apiToken: token } });
  assert.ok(!value.includes('private-credential')); assert.ok(value.length <= 1024);
  assert.equal(sanitizeUiProcessLog('x'.repeat(4090) + token, { eosUi: { apiToken: token } }), 'EOS_UI_PROCESS_LOG_REDACTED');
  assert.ok(!sanitizeUiProcessLog('target=https://operator:secret@host Bearer abc123', {}).includes('secret'));
});

test('explicit pause and resume use a new OS child while terminal stop cannot resurrect it', async t => {
  const f = await fixture(t); await f.runtime.startOperational();
  const first = f.runtime.status().process;
  await f.runtime.pause();
  assert.equal(f.runtime.status().process.state, 'stopped');
  assert.equal(f.runtime.status().process.pid, null); assert.equal(f.leases.size, 0);
  assert.throws(() => process.kill(first.pid, 0), { code: 'ESRCH' });
  await f.runtime.start(); await f.runtime.startOperational(); await delay(150);
  assert.equal(f.runtime.status().process.pid, null, 'normal startup callbacks cannot undo an explicit pause');
  await f.runtime.resume();
  const second = f.runtime.status().process;
  assert.equal(second.state, 'running'); assert.notEqual(second.pid, first.pid);
  assert.ok(second.generation > first.generation); assert.equal(f.leases.size, 1);
  assert.equal((await fetch(f.base + '/identity')).status, 200);
  await f.runtime.stop();
  await assert.rejects(f.runtime.resume(), /EOS_UI_PROCESS_STOPPED/);
});

test('pause drains an accepted controller write before an explicit resume may create another child', async t => {
  let release; let entered = false;
  const pending = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, false, { setForeignStateAsync: async () => { entered = true; await pending; } });
  await f.runtime.startOperational(); const first = f.runtime.status().process;
  const request = fetch(f.base + '/write').catch(() => undefined);
  await eventually(() => entered);
  let stopped = false; let resumed = false;
  const pause = f.runtime.pause().then(() => { stopped = true; });
  const resume = f.runtime.resume().then(() => { resumed = true; });
  await eventually(() => f.runtime.status().process.pid === null);
  await delay(100);
  assert.equal(stopped, false); assert.equal(resumed, false);
  assert.equal(f.runtime.status().process.generation, first.generation);
  release(); await pause; await resume; await request;
  assert.notEqual(f.runtime.status().process.pid, first.pid);
  assert.equal(f.leases.size, 1);
});

test('after a crash every accepted write must finish before a single generation regains ownership', async t => {
  const releases = [];
  const f = await fixture(t, false, { setForeignStateAsync() {
    return new Promise(resolve => releases.push(resolve));
  } });
  await f.runtime.startOperational();
  const old = f.runtime.status().process;
  const requests = Array.from({ length: 2 }, () => fetch(f.base + '/write').catch(() => undefined));
  try {
    await eventually(() => releases.length === 2);
    process.kill(old.pid, 'SIGKILL');
    await eventually(() => f.runtime.status().process.lastError === 'EOS_UI_PROCESS_WRITE_COMPLETION_UNKNOWN');
    releases[0]();
    await delay(100);
    assert.equal(f.runtime.status().process.pid, null);
    await assert.rejects(f.runtime.start(), /EOS_UI_PROCESS_STOP_UNCONFIRMED/);
    releases[1]();
    await eventually(() => f.runtime.status().emsReady === true);
    assert.equal(f.runtime.status().process.generation, old.generation + 1);
    assert.equal(f.runtime.status().process.restarts, 1);
    assert.equal(f.leases.size, 1);
    assert.equal(releases.length, 2, 'the replacement must not replay either write');
  } finally {
    for (const release of releases) release();
    await Promise.all(requests);
  }
});

test('pause during initialization drains a late subscription acquisition before creating the next child', async t => {
  let release, entered = false, acquisitions = 0;
  const leases = new Set();
  const pending = new Promise(resolve => { release = resolve; });
  const owner = { namespace: 'eos-admin.0', instance: 0, config: { eosUi: {} },
    log: { info() {}, warn() {}, error() {}, debug() {} },
    getForeignObjectAsync: async () => ({ native: {} }),
    getForeignStateAsync: async () => ({ val: 20, ts: 123, q: 0 }),
    eosStateSubscriptions: { async acquireHost(pattern) {
      acquisitions++; if (acquisitions === 1) { entered = true; await pending; }
      const lease = { pattern }; leases.add(lease); return async () => { leases.delete(lease); };
    } } };
  const bridge = { canWrite: () => true, originAllowed: () => true, isListening: () => true,
    getLicense: () => ({ valid: true, coreEnabled: true }), resolveAccess: async () => ({ authenticated: false }) };
  const runtime = createEosUiProcess(owner, bridge, { baseDir, workerPath: path.join(compiled, 'eosUiProcessWorker.js'),
    runtimePath: path.join(__dirname, 'fixtures/eos-ui-process-runtime.cjs'), restartDelayMs: 25 });
  t.after(async () => { release(); await runtime.stop(); });
  const initialization = runtime.start().catch(error => error);
  await eventually(() => entered);
  const first = runtime.status().process;
  let stopped = false, resumed = false;
  const pause = runtime.pause().then(() => { stopped = true; });
  const resume = runtime.resume().then(() => { resumed = true; });
  await eventually(() => runtime.status().process.pid === null);
  await delay(100);
  assert.equal(stopped, false); assert.equal(resumed, false);
  assert.equal(runtime.status().process.generation, first.generation);
  release(); await initialization; await pause; await resume;
  assert.notEqual(runtime.status().process.pid, first.pid);
  assert.ok(runtime.status().process.generation > first.generation);
  assert.equal(leases.size, 1, 'late old lease is released before the replacement subscribes');
});
