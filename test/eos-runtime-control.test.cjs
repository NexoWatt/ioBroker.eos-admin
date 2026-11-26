'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EosRuntimeControl } = require('../src/lib/eosRuntimeControl');
const { EosModuleConfigStore } = require('../src/lib/eosModuleConfigStore');

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
  const host = { view: async () => ({ config: { enabled: configured } }),
    enableProcessModule: async id => { calls.push([id, 'configure']); configured = true; },
    controlProcess: async (...args) => { calls.push(args); }, ...options.host };
  const runtime = {
    pause: async () => { calls.push(['ui', 'stop']); }, resume: async () => { calls.push(['ui', 'start']); },
    pauseEms: async () => { calls.push(['ems', 'stop']); }, resumeEms: async () => { calls.push(['ems', 'start']); },
    status: () => ({}), ...options.runtime,
  };
  const control = new EosRuntimeControl({ owner, host, runtime, readTimeoutMs: options.readTimeoutMs });
  return { control, owner, host, runtime, calls, writes, objects,
    migration: value => { migration = value; }, ownership: value => { ownership = value; },
    licensed: value => { licensed = value; }, configured: value => { configured = value; } };
}
const request = (f, id, action) => f.control.request(id, action, f.control.revision);

test('default permits existing startup without writes; pause survives a fresh service and preserves device configuration', async () => {
  const f = fixture(); await f.control.initialize();
  for (const id of ['ui', 'ems', 'devices', 'eebus', 'backup', 'ocpp']) assert.equal(f.control.isEnabled(id), true, id);
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

test('legacy combined pause stays in force on upgrade and new selections persist separately', async () => {
  const f = fixture();
  const store = new EosModuleConfigStore(f.owner, { moduleIds: ['runtime'] });
  const legacy = { v: 1, enabled: { ui: false, devices: true, eebus: true, backup: false, ocpp: true } };
  await store.save('runtime', { v: 1, encrypted: f.owner.encrypt(JSON.stringify(legacy)) });
  f.writes.length = 0;
  await f.control.initialize();
  assert.equal(f.control.isEnabled('ui'), false);
  assert.equal(f.control.isEnabled('ems'), false);
  assert.deepEqual(f.writes, [], 'upgrade does not rewrite the legacy record at initialization');
  f.owner.eosLicenseService.allowsEmbeddedModule = () => false;
  f.host.view = async () => assert.fail('EMS is not a module host operation');
  request(f, 'ems', 'enable'); await settled(f.control);
  assert.deepEqual(f.calls, [['ems', 'stop'], ['ems', 'start']]);
  const persisted = fixture(f.objects);
  await persisted.control.initialize();
  assert.equal(persisted.control.isEnabled('ems'), true);
  assert.equal(persisted.control.isEnabled('ui'), false);
  assert.equal(persisted.control.isEnabled('backup'), false);
  const stored = await new EosModuleConfigStore(f.owner, { moduleIds: ['runtime'] }).load('runtime');
  assert.deepEqual(JSON.parse(f.owner.decrypt(stored.encrypted)), { v: 2, enabled: { ...legacy.enabled, ems: true } });
  request(persisted, 'ui', 'enable'); await settled(persisted.control);
  request(persisted, 'ems', 'disable'); await settled(persisted.control);
  assert.deepEqual(persisted.calls, [['ui', 'stop'], ['ui', 'start'], ['ems', 'stop']]);
  assert.equal(persisted.control.isEnabled('ui'), true);
  assert.equal(persisted.control.isEnabled('ems'), false);
});

test('an unconfirmed EMS stop leaves the UI and other process permissions intact', async () => {
  const f = fixture(new Map(), { runtime: {
    pauseEms: async () => { throw Object.assign(new Error('fixture'), { code: 'EOS_RUNTIME_STOP_UNCONFIRMED' }); },
  } });
  await f.control.initialize(); request(f, 'ems', 'restart'); await settled(f.control);
  assert.deepEqual(f.calls, []);
  assert.equal(f.control.view('ems').reason, 'EOS_RUNTIME_STOP_UNCONFIRMED');
  assert.equal(f.control.isEnabled('ems'), false);
  assert.equal(f.control.isEnabled('ui'), true);
  assert.equal(f.control.isEnabled('devices'), true);
  const restored = fixture(f.objects); await restored.control.initialize();
  assert.equal(restored.control.isEnabled('ems'), false);
  assert.equal(restored.control.isEnabled('ui'), true);
});

test('an incomplete new-format process configuration never defaults the EMS to enabled', async () => {
  const f = fixture();
  const store = new EosModuleConfigStore(f.owner, { moduleIds: ['runtime'] });
  const enabled = { ui: true, devices: true, eebus: true, backup: true, ocpp: true };
  await store.save('runtime', { v: 1, encrypted: f.owner.encrypt(JSON.stringify({ v: 2, enabled })) });
  await f.control.initialize();
  assert.equal(f.control.isEnabled('ems'), false);
  assert.equal(f.control.isEnabled('ui'), false);
  assert.equal(f.control.view('ems').reason, 'EOS_RUNTIME_CONFIG_INVALID');
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

test('one enable action activates a disabled module even when process permission was already on', async () => {
  const f = fixture(); await f.control.initialize(); f.configured(false);
  assert.equal(f.control.view('ocpp', false).canEnable, true);
  assert.equal(f.control.view('ocpp', false).canRestart, false);
  request(f, 'ocpp', 'enable'); await settled(f.control);
  assert.equal(f.writes.length, 2);
  assert.deepEqual(f.calls, [['ocpp', 'stop'], ['ocpp', 'configure'], ['ocpp', 'start']]);
  assert.equal(f.control.isEnabled('ocpp'), true);
  assert.equal(f.control.view('ocpp', true).reason, '');
});

test('a disabled module can be enabled after a saved process pause; restart cannot activate it implicitly', async () => {
  const f = fixture(); await f.control.initialize(); f.configured(false);
  request(f, 'eebus', 'restart'); await settled(f.control);
  assert.equal(f.control.view('eebus', false).reason, 'EOS_RUNTIME_MODULE_DISABLED');
  assert.deepEqual(f.calls, []);
  request(f, 'eebus', 'disable'); await settled(f.control);
  assert.equal(f.control.view('eebus', false).canEnable, true);
  request(f, 'eebus', 'enable'); await settled(f.control);
  assert.equal(f.control.isEnabled('eebus'), true);
  assert.deepEqual(f.calls, [['eebus', 'stop'], ['eebus', 'stop'], ['eebus', 'configure'], ['eebus', 'start']]);
});

test('failed module activation remains durably paused and retains the concrete validation error', async () => {
  const f = fixture(new Map(), { host: { enableProcessModule: async () => {
    throw Object.assign(new Error('private detail'), { code: 'EOS_MODULE_LEGACY_RUNNING' });
  } } });
  await f.control.initialize(); f.configured(false);
  request(f, 'ocpp', 'enable'); await settled(f.control);
  assert.deepEqual(f.calls, [['ocpp', 'stop']]);
  assert.equal(f.control.isEnabled('ocpp'), false);
  assert.equal(f.control.view('ocpp', false).reason, 'EOS_MODULE_LEGACY_RUNNING');
  const next = fixture(f.objects); await next.control.initialize();
  assert.equal(next.control.isEnabled('ocpp'), false);
});

test('slow module commit keeps activation locked and paused until settled, including shutdown', async () => {
  let entered = false, release;
  const pending = new Promise(resolve => { release = resolve; });
  const f = fixture(new Map(), { host: { enableProcessModule: async () => { entered = true; await pending; } } });
  await f.control.initialize(); f.configured(false);
  request(f, 'backup', 'enable');
  while (!entered) await delay(1);
  assert.equal(f.control.isEnabled('backup'), false);
  assert.equal(f.control.view('backup', false).busy, true);
  assert.throws(() => request(f, 'ui', 'disable'), /EOS_RUNTIME_BUSY/);
  const shutdown = f.control.close(); release(); await shutdown;
  assert.deepEqual(f.calls, [['backup', 'stop']]);
  const next = fixture(f.objects); await next.control.initialize();
  assert.equal(next.control.isEnabled('backup'), false);
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
