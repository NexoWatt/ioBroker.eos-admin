'use strict';
// Independent real-process contract tests: the owner/controller and attached plant are fixtures.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');
const ts = require('typescript');
const baseDir = path.resolve(__dirname, '..');
const compiled = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-ui-review-'));
for (const name of ['eosUiProcess', 'eosUiProcessWorker', 'eosUiProcessRpc', 'eosUiSecretCodec']) {
  const source = fs.readFileSync(path.join(baseDir, 'src/lib', `${name}.ts`), 'utf8');
  fs.writeFileSync(path.join(compiled, `${name}.js`), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText);
}
const runtimePath = path.join(compiled, 'fixture.cjs');
fs.writeFileSync(runtimePath, `'use strict';
exports.createHostedRuntime = (owner, bridge) => {
  let outcome;
  return {
    async start() {}, async startOperational() {}, async stop() {},
    status() { return { state: 'ready', active: true, emsReady: true, canWrite: bridge.canWrite() }; },
    handle(req, res, next) { next(); },
    getHistoryBackupRequirement() { return { provider: 'none' }; },
    async reserveDeviceProfileChange() { return () => {}; },
    async onHostedEebusMessage(value) { return value; }, onMessage() { return false; },
    async reconcileDeviceEms([command]) {
      if (command === 'password') return new Promise(resolve => owner.checkPassword('system.user.operator', 'fixture-password', (...values) => resolve(values)));
      if (command === 'history') return new Promise(resolve => owner.sendTo('history.0', 'getHistory', { id: 'fixture.power' }, value => resolve(value)));
      if (command === 'slowRead') return owner.getForeignStateAsync('fixture.slow');
      if (command === 'largeRead') return owner.getForeignStateAsync('fixture.large');
      if (command === 'delayedWrite') { owner.setTimeout(() => { owner.setForeignStateAsync('fixture.setpoint', { val: 1200, ack: false }).then(() => { outcome = 'written'; }, error => { outcome = error.message; }); }, 80); return true; }
      if (command === 'outcome') return outcome || null;
      return { pid: process.pid };
    },
  };
};
`);
const { createEosUiProcess } = require(path.join(compiled, 'eosUiProcess.js'));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function eventually(check, timeout = 8000) {
  const until = Date.now() + timeout;
  while (!check()) { if (Date.now() > until) throw new Error('process condition not reached'); await delay(25); }
}
const bridge = () => ({ canWrite: () => true, originAllowed: () => false, getLicense: () => ({ valid: false }), resolveAccess: async () => null, isListening: () => true });
const owner = extra => ({ namespace: 'eos-admin.0', instance: 0, config: { eosUi: {} },
  log: { info() {}, warn() {}, error() {}, debug() {} },
  getForeignObjectAsync: async () => ({ native: {} }), ...extra });
async function fixture(t, extra = {}) {
  const runtime = createEosUiProcess(owner(extra), bridge(), { baseDir, runtimePath,
    workerPath: path.join(compiled, 'eosUiProcessWorker.js'), restartDelayMs: 25 });
  t.after(() => runtime.stop()); await runtime.start(); return runtime;
}
function alive(pid) {
  try {
    process.kill(pid, 0);
    if (process.platform === 'linux') return fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1]?.[0] !== 'Z';
    return true;
  } catch { return false; }
}
test.after(() => fs.rmSync(compiled, { recursive: true, force: true }));

test('controller checkPassword callback preserves the canonical returned user', async t => {
  const runtime = await fixture(t, { checkPassword(user, _password, callback) { callback(true, user); } });
  assert.deepEqual(await runtime.reconcileDeviceEms(['password']), [true, 'system.user.operator']);
});

test('history adapter responses beyond physical-command TTL retain their read-only callback', async t => {
  const response = { result: [{ ts: 1234, val: 23 }], error: null };
  const runtime = await fixture(t, { sendTo(_instance, command, _request, callback) {
    assert.equal(command, 'getHistory'); setTimeout(() => callback(response), 2300);
  } });
  assert.deepEqual(await runtime.reconcileDeviceEms(['history']), response);
});

test('an expired physical command is not replayed when the parent event loop recovers', async t => {
  const writes = [];
  const runtime = await fixture(t, { async setForeignStateAsync(...args) { writes.push(args); } });
  assert.equal(await runtime.reconcileDeviceEms(['delayedWrite']), true);
  // Only the fixture parent is deliberately stalled; the actual fork continues and its call expires.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2400);
  await delay(150);
  assert.equal(writes.length, 0);
  assert.match(await runtime.reconcileDeviceEms(['outcome']), /EOS_UI_PROCESS_(?:TIMEOUT|CALL_EXPIRED|WRITE_FENCED)/);
});

test('completion from an old RPC generation cannot kill its replacement process', async t => {
  let completeRead; let readStarted = false;
  const runtime = await fixture(t, { getForeignStateAsync() { readStarted = true; return new Promise(resolve => { completeRead = resolve; }); } });
  const old = runtime.status().process;
  const read = runtime.reconcileDeviceEms(['slowRead']).catch(() => undefined);
  await eventually(() => readStarted);
  process.kill(old.pid, 'SIGKILL');
  await eventually(() => runtime.status().process.state === 'running' && runtime.status().process.generation > old.generation);
  const replacement = runtime.status().process;
  completeRead({ val: 1, ts: Date.now(), q: 0 }); await read; await delay(200);
  assert.equal(runtime.status().process.pid, replacement.pid);
  assert.equal(runtime.status().process.generation, replacement.generation);
  assert.equal(runtime.status().process.state, 'running');
});

test('oversized controller response fails its read without killing the control process', async t => {
  const runtime = await fixture(t, { async getForeignStateAsync() { return { val: 'x'.repeat(17 * 1024 * 1024), ts: Date.now(), q: 0 }; } });
  const before = runtime.status().process;
  await assert.rejects(runtime.reconcileDeviceEms(['largeRead']), /EOS_UI_PROCESS_RESPONSE_LIMIT/);
  await delay(100);
  assert.equal(runtime.status().process.pid, before.pid);
  assert.equal(runtime.status().process.generation, before.generation);
  assert.equal(runtime.status().process.state, 'running');
});

test('SIGKILL of the supervising parent terminates the real runtime child', async t => {
  const helper = path.join(compiled, 'supervisor.cjs');
  fs.writeFileSync(helper, `'use strict';
const { createEosUiProcess } = require('./eosUiProcess.js');
const owner = { namespace: 'eos-admin.0', instance: 0, config: { eosUi: {} }, getForeignObjectAsync: async () => ({ native: {} }) };
const bridge = { canWrite: () => true, originAllowed: () => false, getLicense: () => ({ valid: false }), resolveAccess: async () => null };
const runtime = createEosUiProcess(owner, bridge, { baseDir: ${JSON.stringify(baseDir)}, runtimePath: ${JSON.stringify(runtimePath)}, workerPath: ${JSON.stringify(path.join(compiled, 'eosUiProcessWorker.js'))} });
runtime.start().then(() => process.send({ pid: runtime.status().process.pid }), error => { process.send({ error: error.message }); process.exitCode = 1; });
`);
  const supervisor = fork(helper, [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: [] });
  let childPid;
  t.after(() => { supervisor.kill('SIGKILL'); if (childPid && alive(childPid)) process.kill(childPid, 'SIGKILL'); });
  const message = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('supervisor startup timeout')), 8000);
    supervisor.once('message', value => { clearTimeout(timer); resolve(value); });
    supervisor.once('error', reject);
  });
  assert.equal(message.error, undefined); childPid = message.pid; assert.ok(alive(childPid));
  supervisor.kill('SIGKILL');
  await eventually(() => !alive(childPid), 4000);
});
