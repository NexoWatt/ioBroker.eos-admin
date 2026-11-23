'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { HostedAdapter } = require('../../lib/hosted-adapter');
const { Para14aEebusDirectApi, HELLO_COMMAND } = require('../../ems/services/para14a-eebus-api');

test('migrated UI keeps original name/instance0 and state IDs; revoked localwrites cannot bypass shared ownership', async () => {
  const writes = [];
  let allowed = true;
  const owner = { namespace: 'eos-admin.2', instance: 2, config: { eosUi: { siteName: 'old' }, eosUiMigration: { source: 'nexowatt-ui.0', preserveNamespace: true } },
    getForeignStateAsync: async id => ({ id }), setForeignStateAsync: async (...args) => writes.push(args),
    setForeignStateChangedAsync: async (...args) => writes.push(args), setForeignState: (...args) => writes.push(args), setForeignStateChanged: (...args) => writes.push(args),
    getForeignObjectAsync: async id => ({ _id: id, type: 'instance', native: { eosUi: { siteName: 'stale-native' } } }),
    eosMigration: { async saveUi(value) { owner.config.eosUi = structuredClone(value); } },
  };
  const bridge = { canWrite: () => allowed, getLicense: () => ({}), originAllowed: () => true, resolveAccess: async () => null };
  const adapter = new HostedAdapter({ owner, bridge });
  assert.equal(adapter.name, 'nexowatt-ui'); assert.equal(adapter.instance, 0); assert.equal(adapter.hostNamespace, 'eos-admin.2');
  assert.deepEqual(await adapter.getStateAsync('ems.status'), { id: 'nexowatt-ui.0.ems.status' });
  await adapter.setStateAsync('ems.status', { val: 'ready', ack: true });
  assert.equal(writes[0][0], 'nexowatt-ui.0.ems.status');
  allowed = false;
  await assert.rejects(adapter.setStateAsync('ems.command', 1), /OWNERSHIP_LOST/);
  await assert.rejects(adapter.setStateChangedAsync('ems.command', 1), /OWNERSHIP_LOST/);
  assert.throws(() => adapter.setState('ems.command', 1), /OWNERSHIP_LOST/);
  assert.throws(() => adapter.setStateChanged('ems.command', 1), /OWNERSHIP_LOST/);
  assert.equal(writes.length, 1);
  const first = await adapter.getForeignObjectAsync('system.adapter.nexowatt-ui.0');
  assert.equal(first.native.siteName, 'old'); first.native.siteName = 'first-save';
  await adapter.setForeignObjectAsync('system.adapter.nexowatt-ui.0', first);
  const second = await adapter.getForeignObjectAsync('system.adapter.nexowatt-ui.0');
  assert.equal(second.native.siteName, 'first-save'); second.native.additional = true;
  await adapter.setForeignObjectAsync('system.adapter.nexowatt-ui.0', second);
  assert.equal(owner.config.eosUi.siteName, 'first-save'); assert.equal(owner.config.eosUi.additional, true);
});

test('migrated UI protects original credential states without widening its exact ID allowlist', async () => {
  const { createHarness } = require('./http-harness.cjs');
  const h = await createHarness({ legacyNamespace: 'nexowatt-ui.0' });
  try {
    await h.adapter._nwProtectCredentialState('installer.configJson');
    assert.equal(h.objects.get('nexowatt-ui.0.installer.configJson').acl.state, 0x600);
    assert.equal(h.objects.has('eos-admin.0.installer.configJson'), false);
    await assert.rejects(h.adapter._nwProtectCredentialState('system.config'), /protection-failed/);
  } finally { await h.close(); }
});

for (const enabled of [true, false]) {
  test(`migrated SmartHome hydrates current building, assignments, scenes, timers and logic without changing native ${enabled ? 'enabled' : 'disabled'}`, async t => {
    const { createHarness } = require('./http-harness.cjs');
    const data = require('../../../test/fixtures/smarthome-legacy.cjs')(enabled);
    const h = await createHarness({ legacyNamespace: 'nexowatt-ui.0' });
    t.after(() => h.close());
    h.adapter.config = structuredClone(data.native);
    // Only suppress the real-time scheduler: this regression proves hydration and IDs,
    // not timer execution on a physical actuator or a wall-clock-dependent schedule.
    h.adapter._nwScheduleNextSmartHomeTimer = () => {};
    h.adapter._nwScheduleNextSmartHomeLogicClock = () => {};
    h.adapter._nwRefreshLogicClockStatesNow = async () => {};
    h.states.set('nexowatt-ui.0.installer.configJson', { val: JSON.stringify(data.patch), ack: true });
    h.states.set('nexowatt-ui.0.smarthome.timersJson', { val: JSON.stringify(data.timers), ack: true });
    h.states.set('nexowatt-ui.0.smarthome.logicClocksJson', { val: JSON.stringify(data.clocks), ack: true });
    h.states.set('knx.0.living.light.command', { val: false, ack: false });
    await h.adapter.loadInstallerConfigFromState();
    assert.equal(h.adapter.config.smartHome.enabled, enabled);
    assert.equal(h.adapter._nwNativeConfigBase.smartHome.enabled, enabled);
    assert.deepEqual(h.adapter.config.smartHomeConfig, data.patch.smartHomeConfig);
    assert.deepEqual(h.adapter.config.logicEditor, data.patch.logicEditor);
    assert.equal(h.adapter.config.smartHome.datapoints.roomTemp, 'knx.0.living.temperature');
    assert.equal(h.adapter.config.smartHome.datapoints.blindPosition, 'knx.0.living.blind.position');
    await h.adapter.loadSmartHomeTimersFromState();
    await h.adapter.loadSmartHomeLogicClocksFromState();
    assert.deepEqual(h.adapter.getSmartHomeTimersConfig(), data.timers);
    assert.deepEqual(h.adapter.getSmartHomeLogicClocksConfig(), data.clocks);
    const config = h.adapter.getSmartHomeConfig();
    assert.equal(config.rooms[0].name, 'Wohnzimmer');
    assert.equal(config.rooms[0].floorId, 'eg');
    assert.equal(config.devices[0].roomId, 'living');
    assert.equal(config.devices[0].io.switch.readId, 'knx.0.living.light.status');
    assert.equal(config.devices[0].io.switch.writeId, 'knx.0.living.light.command');
    assert.equal(config.scenes[0].id, 'evening');
    assert.equal(config.pages[0].id, 'living_page');
    assert.deepEqual(h.states.get('knx.0.living.light.command'), { val: false, ack: false });
    assert.equal(h.states.has('eos-admin.0.installer.configJson'), false);
    assert.equal([...h.states.keys()].some(id => id.startsWith('eos-admin.0.smarthome.')), false);
  });
}

test('migrated UI accepts only its owner private EEBus capability, never a foreign owner source', async t => {
  const adapter = { namespace: 'nexowatt-ui.0', hostNamespace: 'eos-admin.2', config: { installerConfig: { para14a: true }, countryProfile: { country: 'DE' } },
    emsEngine: { mm: {} }, _nwLicenseOk: true, _nwLicenseAllowsAppId: () => true,
    setObjectNotExistsAsync: async () => {}, setStateAsync: async () => {}, log: { debug() {}, warn() {}, error() {} } };
  const api = new Para14aEebusDirectApi(adapter); t.after(() => api.stop());
  assert.throws(() => api.attachHostedBridge({ sourceInstance: 'eos-admin.9.eebus', canOperate: () => true, sendFeedback: () => true }), /BRIDGE_INVALID/);
  api.attachHostedBridge({ sourceInstance: 'eos-admin.2.eebus', canOperate: () => true, sendFeedback: () => true });
  await api.init();
  assert.equal((await api.handleHostedMessage({ from: 'eos-admin.2.eebus', command: HELLO_COMMAND,
    message: { apiVersion: 1, sourceInstance: 'eos-admin.2.eebus', bridgeHeartbeatSec: 30 } })).accepted, true);
});
