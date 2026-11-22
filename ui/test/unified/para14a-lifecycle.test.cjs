'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Para14aEebusDirectApi } = require('../../ems/services/para14a-eebus-api');

function fixture() {
  const objects = new Map(), writes = [], cleared = [];
  const adapter = {
    setObjectNotExistsAsync: async (id, object) => objects.set(id, object),
    setStateAsync: async (id, state) => { writes.push({ id, state, defined: objects.has(id) }); },
    clearTimeout: timer => cleared.push(timer),
    log: { debug() {} },
  };
  return { api: new Para14aEebusDirectApi(adapter), objects, writes, cleared };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('uninitialized §14a stop cleans resources without creating undefined diagnostic states', async () => {
  const { api, objects, writes, cleared } = fixture();
  const hello = {}, pending = {};
  api.helloWatchdog = hello;
  api.pending.set('pending', { timeout: pending });
  api.recentAcceptances.set('old', { expiresAtMs: Date.now() + 1000 });
  api.ingress = { commandId: 'old' };
  api.sourceInstance = 'eebus.0';
  api.stop(); api.stop(); await flush();
  assert.equal(api.initialized, false);
  assert.equal(api.helloWatchdog, null);
  assert.equal(api.pending.size, 0);
  assert.equal(api.recentAcceptances.size, 0);
  assert.equal(api.ingress, null);
  assert.equal(api.sourceInstance, '');
  assert.deepEqual(cleared, [hello, pending]);
  assert.equal(objects.size, 0);
  assert.deepEqual(writes, []);
});

test('initialized §14a stop publishes one final status only after its objects exist', async () => {
  const { api, writes } = fixture();
  await api.init();
  writes.length = 0;
  api.stop(); api.stop(); await flush();
  assert.deepEqual(writes.map(entry => entry.id).sort(), ['para14a.api.connected', 'para14a.api.pendingCount', 'para14a.api.status']);
  assert.equal(writes.every(entry => entry.defined && entry.state.ack === true), true);
  assert.equal(writes.find(entry => entry.id === 'para14a.api.status').state.val, 'stopped');
});
