'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EosRuntimeControl } = require('../src/lib/eosRuntimeControl');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function settled(control) { await control.whenIdle(); }
function fixture(objects = new Map(), options = {}) {
  const calls = [], writes = [];
  let migration = true, ownership = true, licensed = true, configured = true;
  const owner = { namespace: 'eos-admin.0', config: {},
    encrypt: text => 'fixture:' + Buffer.from(text).toString('base64'),
    decrypt: text => { if (!text.startsWith('fixture:')) throw Error('invalid fixture encryption'); return Buffer.from(text.slice(8), 'base64').toString(); },
    async getForeignObjectAsync(id) { return objects.has(id) ? structuredClone(objects.get(id)) : null; },
    async setForeignObjectAsync(id, value) { writes.push(id); objects.set(id, structuredClone(value)); },
    eosMigration: { allowsStartup: () => migration }, eosOwnership: { canWrite: () => ownership },
    eosLicenseService: { statusView: () => ({ valid: licensed, coreEnabled: licensed }), allowsEmbeddedModule: () => licensed },
    log: { warn() {} }, ...options.owner };
  const host = { view: async () => ({ config: { enabled: configured } }), controlProcess: async (...args) => { calls.push(args); }, ...options.host };
  const runtime = { pause: async () => { calls.push(['ui', 'stop']); }, resume: async () => { calls.push(['ui', 'start']); }, status: () => ({}), ...options.runtime };
  const control = new EosRuntimeControl({ owner, host, runtime, readTimeoutMs: options.readTimeoutMs });
  return { control, owner, host, runtime, calls, writes, objects,
    migration: value => { migration = value; }, ownership: value => { ownership = value; },
    licensed: value => { licensed = value; }, configured: value => { configured = value; } };
}
const request = (f, id, action) => f.control.request(id, action, f.control.revision);

test('default permits existing startup without writes; pause survives a fresh service and preserves device configuration', async () => {
  const f = fixture(); await f.control.initialize();
  for (const id of ['ui', 'devices', 'eebus', 'backup', 'ocpp']) assert.equal(f.control.isEnabled(id), true, id);
  assert.equal(f.writes.length, 0);
  const beforeConfig = structuredClone(f.owner.config);
  assert.deepEqual(request(f, 'devices', 'disable'), { ok: true, accepted: true });
  await settled(f.control);
  assert.deepEqual(f.calls, [['devices', 'stop']]);
  assert.equal(f.control.isEnabled('devices'), false);
  assert.deepEqual(f.owner.config, beforeConfig);
  assert.deepEqual([...f.objects.keys()], ['eos-admin.0.modules.runtime.configuration']);
  const stored = f.objects.values().next().value;
  assert.equal(stored.acl.object, 0x600); assert.equal(stored.type, 'config');
  const next = fixture(f.objects); await next.control.initialize();
  assert.equal(next.control.isEnabled('devices'), false); assert.equal(next.control.isEnabled('ocpp'), true);
  request(next, 'devices', 'enable'); await settled(next.control);
  assert.deepEqual(next.calls, [['devices', 'stop'], ['devices', 'start']]);
  assert.equal(next.control.isEnabled('devices'), true);
});

test('restart commits a durable pause before confirmed shutdown and only then persists enable', async () => {
  let release; const stop = new Promise(resolve => { release = resolve; });
  const f = fixture(new Map(), { host: { controlProcess: async (id, action) => { if (action === 'stop') await stop; } } });
  await f.control.initialize(); const old = f.control.revision;
  request(f, 'ocpp', 'restart');
  while (!f.writes.length) await delay(1);
  await delay(1);
  assert.equal(f.control.isEnabled('ocpp'), false);
  const fresh = fixture(f.objects); await fresh.control.initialize();
  assert.equal(fresh.control.isEnabled('ocpp'), false, 'parent death during shutdown must not restore activation');
  assert.throws(() => f.control.request('ui', 'disable', old), /EOS_RUNTIME_BUSY/);
  release(); await settled(f.control);
  assert.equal(f.control.isEnabled('ocpp'), true); assert.notEqual(f.control.revision, old);
  assert.equal(f.writes.length, 2);
});

test('an unconfirmed stop remains durably disabled and never starts a replacement', async () => {
  let starts = 0;
  const f = fixture(new Map(), { host: { controlProcess: async (_id, action) => {
    if (action === 'stop') throw Object.assign(Error('unconfirmed'), { code: 'EOS_RUNTIME_STOP_UNCONFIRMED' });
    starts++;
  } } });
  await f.control.initialize(); request(f, 'devices', 'restart'); await settled(f.control);
  assert.equal(starts, 0); assert.equal(f.control.isEnabled('devices'), false);
  assert.equal(f.control.view('devices').reason, 'EOS_RUNTIME_STOP_UNCONFIRMED');
  assert.equal(f.control.view('devices').canEnable, false);
  assert.throws(() => request(f, 'devices', 'enable'), /EOS_RUNTIME_STOP_UNCONFIRMED/);
  const fresh = fixture(f.objects); await fresh.control.initialize();
  assert.equal(fresh.control.isEnabled('devices'), false);
});

test('disable remains available behind startup gates, while enable and restart cannot bypass them', async () => {
  for (const gate of ['migration', 'ownership', 'licensed']) {
    const f = fixture(); await f.control.initialize(); f[gate](false);
    assert.equal(f.control.view('devices').canDisable, true);
    assert.equal(f.control.view('devices').canRestart, false);
    assert.throws(() => request(f, 'devices', 'restart'), /EOS_RUNTIME_(?:MIGRATION_BLOCKED|OWNERSHIP_REQUIRED|LICENSE_REQUIRED)/);
    request(f, 'devices', 'disable'); await settled(f.control);
    assert.deepEqual(f.calls, [['devices', 'stop']]);
    assert.throws(() => request(f, 'devices', 'enable'), /EOS_RUNTIME_(?:MIGRATION_BLOCKED|OWNERSHIP_REQUIRED|LICENSE_REQUIRED)/);
  }
});

test('paused process cannot be enabled while its module configuration is disabled', async () => {
  const f = fixture(); await f.control.initialize(); f.configured(false);
  request(f, 'ocpp', 'enable'); await settled(f.control);
  assert.equal(f.writes.length, 0); assert.deepEqual(f.calls, []);
  assert.equal(f.control.view('ocpp', false).canEnable, false);
  assert.equal(f.control.view('ocpp', false).reason, 'EOS_RUNTIME_MODULE_DISABLED');
});

test('persistence failure does not stop a live process or falsely claim its activation changed', async () => {
  const f = fixture(new Map(), { owner: { setForeignObjectAsync: async () => { throw Error('PRIVATE fixture failure'); } } });
  await f.control.initialize(); const revision = f.control.revision;
  request(f, 'devices', 'disable'); await settled(f.control);
  assert.equal(f.control.isEnabled('devices'), true); assert.deepEqual(f.calls, []);
  assert.equal(f.control.revision, revision);
  assert.equal(f.control.view('devices').reason, 'EOS_RUNTIME_CONTROL_FAILED');
  assert.doesNotMatch(JSON.stringify(f.control.view('devices')), /PRIVATE/);
});

test('invalid IDs, arbitrary commands, stale revision and replay do not change process state', async () => {
  const f = fixture(); await f.control.initialize();
  for (const id of ['admin', 'ocpp21.0', '__proto__', '../../ui']) assert.throws(() => request(f, id, 'disable'), /EOS_RUNTIME_PROCESS_INVALID/);
  assert.throws(() => request(f, 'ui', 'kill'), /EOS_RUNTIME_ACTION_INVALID/);
  assert.throws(() => f.control.request('ui', 'disable', 'old'), /EOS_RUNTIME_CONFIG_CONFLICT/);
  const revision = f.control.revision;
  request(f, 'ui', 'disable'); await settled(f.control);
  assert.throws(() => f.control.request('ui', 'enable', revision), /EOS_RUNTIME_CONFIG_CONFLICT/);
  assert.deepEqual(f.calls, [['ui', 'stop']]);
});

test('a hanging startup configuration read is bounded and its late completion cannot activate processes', async () => {
  let release; const pending = new Promise(resolve => { release = resolve; });
  const f = fixture(new Map(), { readTimeoutMs: 20, owner: { getForeignObjectAsync: () => pending } });
  const before = Date.now(); await f.control.initialize();
  assert.ok(Date.now() - before < 1000); assert.equal(f.control.isEnabled('ui'), false);
  assert.equal(f.control.view('devices').reason, 'EOS_RUNTIME_CONFIG_TIMEOUT');
  release(null); await delay(20);
  assert.equal(f.control.isEnabled('ui'), false);
  assert.throws(() => request(f, 'ui', 'enable'), /EOS_RUNTIME_CONFIG_TIMEOUT/);
});

test('invalid stored configuration never silently falls back to all enabled', async () => {
  const f = fixture(); await f.control.initialize(); request(f, 'ui', 'disable'); await settled(f.control);
  const id = 'eos-admin.0.modules.runtime.configuration'; const object = f.objects.get(id);
  object.acl.object = 0x644;
  const next = fixture(f.objects); await next.control.initialize();
  assert.equal(next.control.isEnabled('devices'), false);
  assert.equal(next.control.view('ui').reason, 'EOS_MODULE_CONFIG_STORE_INVALID');
});

test('shutdown during an accepted restart never starts a replacement even if stop settles later', async () => {
  let release, entered = false, starts = 0;
  const stop = new Promise(resolve => { release = resolve; });
  const f = fixture(new Map(), { runtime: { pause: async () => { entered = true; await stop; }, resume: async () => { starts++; } } });
  await f.control.initialize(); request(f, 'ui', 'restart');
  while (!entered) await delay(1);
  f.control.close(); release(); await settled(f.control);
  assert.equal(starts, 0);
  const next = fixture(f.objects); await next.control.initialize(); assert.equal(next.control.isEnabled('ui'), false);
});

test('close immediately revokes authority but drains an already-issued configuration write', async () => {
  const f = fixture(); await f.control.initialize();
  let entered = false, release, closed = false;
  const pending = new Promise(resolve => { release = resolve; });
  const save = f.owner.setForeignObjectAsync;
  f.owner.setForeignObjectAsync = async (...args) => { entered = true; await pending; return save(...args); };
  request(f, 'ui', 'restart'); while (!entered) await delay(1);
  const shutdown = f.control.close().then(() => { closed = true; });
  await delay(10); assert.equal(closed, false); assert.equal(f.control.isEnabled('ui'), false);
  assert.throws(() => request(f, 'devices', 'disable'), /EOS_RUNTIME_NOT_READY/);
  release(); await shutdown;
  assert.equal(closed, true); assert.deepEqual(f.calls, []);
  const next = fixture(f.objects); await next.control.initialize(); assert.equal(next.control.isEnabled('ui'), false);
});
