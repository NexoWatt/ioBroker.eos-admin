'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { createHarness } = require('./http-harness.cjs');

async function startupFixture(failEms) {
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
