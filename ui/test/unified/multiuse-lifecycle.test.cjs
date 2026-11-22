'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { MultiUseModule } = require('../../ems/modules/multi-use');
const { ModuleManager } = require('../../ems/module-manager');

function fixture({ failObject = '', consumers = [], legacy = false } = {}) {
  const objects = new Map(), states = new Map(), writes = [], missingObjects = [], hardwareWrites = [];
  const adapter = {
    namespace: 'eos-admin.0',
    config: { enableMultiUse: false, multiUse: { legacyFlexibleConsumersEnabled: legacy, consumers }, storage: {}, installerConfig: {} },
    log: { debug() {}, info() {}, warn() {}, error() {} },
    async setObjectNotExistsAsync(id, object) {
      if (id === failObject) throw new Error('fixture-object-create-failed');
      if (!objects.has(id)) objects.set(id, structuredClone(object));
    },
    async setStateAsync(id, value, ack) {
      if (!objects.has(id)) missingObjects.push(id);
      writes.push({ id, value, ack });
      states.set(id, { val: value, ack, ts: Date.now(), lc: Date.now() });
    },
    async getStateAsync(id) { return states.get(id) || null; },
  };
  const entries = new Map();
  const dp = {
    async upsert(entry) { entries.set(entry.key, { ...entry }); },
    getEntry(key) { return entries.get(key) || null; },
    async writeNumber(key, value) { hardwareWrites.push({ key, value }); return true; },
    async writeBoolean(key, value) { hardwareWrites.push({ key, value }); return true; },
  };
  const instance = new MultiUseModule(adapter, dp);
  const row = { key: 'multiUse', instance, enabledFn: () => adapter.config.enableMultiUse };
  const manager = new ModuleManager(adapter, dp);
  manager.modules = [row];
  return { adapter, instance, manager, row, objects, states, writes, missingObjects, hardwareWrites, entries };
}

test('disabled MultiUse cold start defines control states before the safe-stop diagnostics', async t => {
  const h = fixture();
  t.after(() => h.manager.stop());
  const configBefore = structuredClone(h.adapter.config);
  assert.equal(await h.manager._deactivateModule(h.row, 'cold-start'), true);
  assert.deepEqual(h.missingObjects, [], 'ioBroker must never receive MultiUse states without their object definitions');
  assert.equal(h.states.get('multiUse.control.active').val, false);
  assert.equal(h.states.get('multiUse.control.requestW').val, 0);
  assert.equal(h.states.get('multiUse.control.budgetW').val, 0);
  assert.equal(h.states.get('multiUse.control.status').val, 'module-disabled-no-actuators');
  assert.equal(h.objects.get('multiUse.control.requestW').common.unit, 'W');
  assert.equal(h.objects.get('multiUse.control.active').common.type, 'boolean');
  assert.deepEqual(h.hardwareWrites, [], 'diagnostic initialization must not dispatch hardware commands');
  assert.deepEqual(h.adapter.config, configBefore, 'initialization must not enable the app or reset its settings');
  const writeCount = h.writes.length;
  await h.instance.tick();
  await h.manager._deactivateModule(h.row, 'next-cycle');
  assert.equal(h.writes.length, writeCount, 'disabled ticks and already completed stops stay idle');
});

test('disabled MultiUse initialization preserves legacy targets and can later activate the existing policy', async t => {
  const h = fixture({ consumers: [{ key: 'existing', setWId: 'device.0.target', defaultTargetW: 321 }], legacy: true });
  t.after(() => h.manager.stop());
  h.states.set('multiUse.consumers.existing.targetW', { val: 1234, ts: Date.now(), lc: Date.now() });
  await h.instance.init();
  assert.deepEqual(h.missingObjects, []);
  assert.equal(h.states.get('multiUse.consumers.existing.targetW').val, 1234);
  assert.equal(h.instance._last.get('existing').reqTargetW, 1234);
  assert.equal(h.entries.get('mu.existing.setW').objectId, 'device.0.target');
  assert.deepEqual(h.hardwareWrites, []);
  assert.equal(h.states.get('multiUse.policy.active').val, false);

  h.adapter.config.enableMultiUse = true;
  h.adapter.config.multiUse.legacyFlexibleConsumersEnabled = false;
  h.adapter.config.installerConfig.storageMultiUse = { enabled: true };
  await h.instance.init();
  await h.instance.tick();
  assert.deepEqual(h.missingObjects, []);
  assert.equal(h.states.get('multiUse.control.status').val, 'storage-policy-only');
  assert.equal(h.states.get('multiUse.policy.active').val, true);
  assert.equal(h.states.get('multiUse.consumers.existing.targetW').val, 1234);
  assert.deepEqual(h.hardwareWrites, [], 'activating storage policy must not create a second battery/consumer writer');
});

test('failed MultiUse object creation cannot be acknowledged as a successful disabled lifecycle', async t => {
  const h = fixture({ failObject: 'multiUse.control.active' });
  t.after(() => h.manager.stop());
  assert.equal(await h.manager._deactivateModule(h.row, 'cold-start'), false);
  assert.equal(h.row.deactivated, false);
  assert.match(h.row.deactivateError, /fixture-object-create-failed/);
  assert.deepEqual(h.missingObjects, []);
  assert.deepEqual(h.hardwareWrites, []);
  assert.ok(h.adapter._nwSafetyCriticalFaults.multiUse, 'the existing safety fault remains visible');
});
