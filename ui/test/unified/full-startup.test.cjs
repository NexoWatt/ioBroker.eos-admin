'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { createHarness } = require('./http-harness.cjs');
const { ModuleManager } = require('../../ems/module-manager');

async function startupFixture(failEms, configure) {
  const h = await createHarness(), timers = new Set();
  const fakeTimer = () => { const value = { unref() {}, ref() {} }; timers.add(value); return value; };
  h.owner.setTimeout = h.owner.setInterval = fakeTimer;
  h.owner.clearTimeout = h.owner.clearInterval = value => timers.delete(value);
  h.owner.delObjectAsync = async () => {};
  h.owner.subscribeForeignStates = h.owner.subscribeForeignObjects = h.owner.unsubscribeForeignStates = () => {};
  h.owner.unsubscribeForeignStatesAsync = async () => {};
  h.owner.getObjectListAsync = async () => ({ rows: [] });
  h.owner.decrypt = h.owner.encrypt = value => value;
  h.owner.host = 'fixture';
  if (failEms) h.adapter.initEmsEngine = async () => { throw new Error('fixture EMS startup error'); };
  if (configure) await configure(h);
  const original = Module._load;
  Module._load = function(name, ...args) {
    if (name === '@iobroker/adapter-core') return { getAbsoluteInstanceDataDir: () => '/tmp/nexowatt-hosted-startup-test' };
    return original.call(this, name, ...args);
  };
  try { await h.adapter.onReady(); }
  finally { Module._load = original; }
  return { ...h, timers, dispose: async () => { await new Promise(resolve => h.adapter.onUnload(resolve)); await h.close(); } };
}
test('full hosted onReady initializes EMS with controller-shaped fixture and no device mappings', async () => {
  const h = await startupFixture(false);
  try {
    assert.deepEqual(h.adapter._hostedStartup, { state: 'ready', error: '' });
    assert.ok(h.adapter.emsEngine);
    assert.equal(h.adapter.server, null);
    assert.ok(h.states.size > 700);
    assert.ok(h.objects.size > 2000);
    assert.ok(h.timers.size > 0);
    assert.deepEqual([...h.states.keys()].filter(id => !id.startsWith('eos-admin.0.')).sort(), [
      '0_userdata.0.nexowattVis.backupJson', '0_userdata.0.nexowattVis.backupJsonPrev',
      '0_userdata.0.nexowattVis.backupTs', '0_userdata.0.nexowattVis.backupTsPrev',
    ]);
  } finally { await h.dispose(); }
});
test('EMS startup failure remains visible as degraded while authenticated shell survives', async () => {
  const h = await startupFixture(true);
  try {
    assert.deepEqual(h.adapter._hostedStartup, { state: 'degraded', error: 'EOS_EMS_INIT_FAILED' });
    assert.equal(h.adapter.emsEngine, null);
    assert.equal((await h.request('/static/login.js')).status, 200);
    assert.equal((await h.request('/api/state')).status, 401);
  } finally { await h.dispose(); }
});

test('full startup with rejected partial-engine cleanup retains its fence and never advertises ready', async () => {
  const init = ModuleManager.prototype.init;
  const logs = []; let calls = 0;
  ModuleManager.prototype.init = async function () {
    await init.call(this); calls++;
    this.modules.push({ key: 'fixtureRejectedCleanup', instance: { stop: async () => { throw new Error('TEST_STOP_REJECTED'); } } });
    throw new Error('TEST_PARTIAL_INIT_FAILURE');
  };
  let h;
  try {
    h = await startupFixture(false, fixture => {
      fixture.owner.log.info = value => logs.push(value);
    });
    assert.ok(h.adapter.emsEngine, 'failed engine remains reachable for confirmed cleanup');
    assert.equal(h.adapter.emsEngine._reconfiguring, true);
    assert.equal(h.adapter._nwEmsInitError, 'TEST_PARTIAL_INIT_FAILURE');
    assert.deepEqual(h.adapter._hostedStartup, { state: 'degraded', error: 'EOS_EMS_INIT_FAILED' });
    assert.equal(h.adapter._nwIsEmsReady(), false);
    assert.equal(logs.includes('NexoWatt EOS ist bereit.'), false);
    const token = await h.login('admin');
    const response = await h.request('/api/ems/status', { token });
    assert.equal(response.status, 200);
    assert.equal(response.data.startup.state, 'degraded');
    assert.equal(response.data.engine.running, false);
    assert.equal(response.data.engine.initError, 'TEST_PARTIAL_INIT_FAILURE');
    await assert.rejects(h.adapter.initEmsEngine(), /EOS_EMS_MODULE_STOP_FAILED/);
    assert.equal(calls, 1, 'failed cleanup must block a replacement even with nonforced init');
    assert.equal((await h.request('/static/login.js')).status, 200);
  } finally {
    ModuleManager.prototype.init = init;
    if (h) await h.dispose();
  }
});
