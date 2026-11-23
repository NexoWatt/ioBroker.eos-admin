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
