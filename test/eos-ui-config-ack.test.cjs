'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const ts = require('typescript');
const baseDir = path.resolve(__dirname, '..');
const compiled = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-config-ack-'));
for (const name of ['eosUiProcess', 'eosUiProcessWorker', 'eosUiProcessRpc', 'eosUiSecretCodec']) {
  fs.writeFileSync(path.join(compiled, name + '.js'), ts.transpileModule(fs.readFileSync(path.join(baseDir, 'src/lib', name + '.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText);
}
const { createEosUiProcess } = require(path.join(compiled, 'eosUiProcess'));
test.after(() => fs.rmSync(compiled, { recursive: true, force: true }));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function until(check, timeout = 5000) { const deadline = Date.now() + timeout; while (!check()) { if (Date.now() > deadline) throw new Error('condition not reached'); await delay(20); } }

async function fixture(t, options = {}) {
  const entered = deferred(), released = deferred(); let committed = false, calls = 0;
  const namespace = options.legacy ? 'nexowatt-ui.3' : 'eos-admin.0';
  const id = `${namespace}.installer.configJson`;
  let state = { val: JSON.stringify({ tariffProvider: { enabled: false, providerId: 'manual-dp', autoCoupleDatapoints: false } }), ack: true };
  const object = { _id: id, type: 'state', common: { type: 'string', read: false }, native: {},
    acl: { owner: 'system.user.admin', ownerGroup: 'system.group.administrator', object: 0x600, state: 0x600 } };
  const owner = { namespace: 'eos-admin.0', instance: 0, config: { eosUi: {}, ...(options.legacy ? { eosUiMigration: { preserveNamespace: true, source: namespace, requiredStates: ['installer.configJson'] } } : {}) },
    log: { info() {}, warn() {}, error() {}, debug() {} },
    getForeignObjectAsync: async key => key === 'system.config' ? { native: {} } : key === id ? structuredClone(object) : null,
    getForeignStateAsync: async key => key === id ? structuredClone(state) : null,
    getForeignStatesAsync: async () => ({}), getForeignObjectsAsync: async () => ({}),
    getObjectViewAsync: async () => ({ rows: [] }),
    extendForeignObjectAsync: async () => undefined,
    setForeignStateAsync: async (key, value) => {
      assert.equal(key, id); calls++; entered.resolve();
      if (options.error) throw new Error('synthetic controller write rejected');
      if (options.hold) await released.promise;
      else await delay(2200);
      state = structuredClone(value); committed = true;
    },
  };
  const bridge = { canWrite: () => true, originAllowed: () => false, isListening: () => true,
    getLicense: () => ({ valid: true, coreEnabled: true, edition: 'home', features: ['energy'] }), resolveAccess: async () => null };
  const runtime = createEosUiProcess(owner, bridge, { baseDir, workerPath: path.join(compiled, 'eosUiProcessWorker.js'),
    runtimePath: path.join(__dirname, 'fixtures/eos-ui-config-commit-runtime.cjs'), restartDelayMs: 25 });
  t.after(async () => { released.resolve(); await runtime.stop(); });
  await runtime.start();
  return { runtime, entered, release: released.resolve, committed: () => committed, calls: () => calls,
    storedEnabled: () => JSON.parse(state.val).tariffProvider.enabled };
}

for (const legacy of [false, true]) test(`real child awaits 2.2s config ACK before runtime commit (preserved namespace=${legacy})`, async t => {
  const f = await fixture(t, { legacy });
  const before = f.runtime.status().process;
  const saving = f.runtime.reconcileDeviceEms(['persist']);
  await f.entered.promise;
  let answered = false; void saving.then(() => { answered = true; });
  await delay(2050);
  assert.equal(answered, false); assert.equal(f.committed(), false);
  assert.deepEqual(await saving, { persisted: true, runtimeEnabled: true });
  assert.equal(f.committed(), true); assert.equal(f.storedEnabled(), true); assert.equal(f.calls(), 1);
  assert.equal(f.runtime.status().process.pid, before.pid);
});

test('a definite controller rejection reports failure without restarting or changing saved config', async t => {
  const f = await fixture(t, { error: true }); const before = f.runtime.status().process;
  assert.deepEqual(await f.runtime.reconcileDeviceEms(['persist']), { persisted: false, runtimeEnabled: false });
  assert.equal(f.storedEnabled(), false); assert.equal(f.calls(), 1);
  assert.equal(f.runtime.status().process.pid, before.pid); assert.equal(f.runtime.status().process.state, 'running');
});

test('pause drains a late accepted config ACK and resume reloads the committed state without replay', async t => {
  const f = await fixture(t, { hold: true }); const before = f.runtime.status().process;
  const saving = f.runtime.reconcileDeviceEms(['persist']).catch(() => undefined);
  await f.entered.promise;
  let stopped = false; const pause = f.runtime.pause().then(() => { stopped = true; });
  await delay(200); assert.equal(stopped, false); assert.equal(f.committed(), false);
  f.release(); await pause; await saving;
  assert.equal(f.committed(), true); assert.equal(f.calls(), 1);
  await f.runtime.resume();
  assert.notEqual(f.runtime.status().process.pid, before.pid);
  assert.deepEqual(await f.runtime.reconcileDeviceEms(['read']), { runtimeEnabled: true });
  assert.equal(f.calls(), 1);
});

test('unknown config completion at the real 30s deadline fences the child until drain and explicit recovery', { timeout: 45000 }, async t => {
  const f = await fixture(t, { hold: true }); const before = f.runtime.status().process;
  const saving = f.runtime.reconcileDeviceEms(['persist']).catch(() => undefined);
  await f.entered.promise;
  await until(() => f.runtime.status().process.state === 'failed', 35000);
  const failed = f.runtime.status().process;
  assert.equal(failed.pid, null); assert.equal(failed.lastError, 'EOS_UI_PROCESS_WRITE_COMPLETION_UNKNOWN');
  assert.equal(failed.generation, before.generation); assert.equal(f.committed(), false);
  await assert.rejects(f.runtime.resume(), { message: 'EOS_UI_PROCESS_STOP_UNCONFIRMED' });
  f.release(); await until(f.committed); await saving; await delay(50);
  assert.equal(f.runtime.status().process.pid, null, 'a late ACK does not silently replay or revive the old child');
  await f.runtime.resume();
  assert.notEqual(f.runtime.status().process.pid, before.pid);
  assert.deepEqual(await f.runtime.reconcileDeviceEms(['read']), { runtimeEnabled: true });
  assert.equal(f.calls(), 1);
});
