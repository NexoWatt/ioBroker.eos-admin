'use strict';
/** Real hosted routes with in-memory ioBroker database; no physical actuators. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const { installerRevision, assertInstallerRevision, provisionInstallerObjects } = require('../ui/lib/installer-lifecycle');
const { safeConfigurationFailure } = require('../ui/lib/http-error-boundary');
const oldPatch = () => ({ settingsConfig: { evcsCount: 1, evcsList: [{ name: 'Existing', powerId: 'alias.0.old.power' }] } });
const newPatch = () => ({ settingsConfig: { evcsCount: 2, evcsList: [...oldPatch().settingsConfig.evcsList,
  { name: 'New', enabled: false, powerId: 'eos-admin.0.devices.wallbox.aliases.v1.evcs.power' }] },
  eosDeviceEms: { v: 1, bindings: { 'eos-admin.0.devices.wallbox': { target: 'evcs', mode: 'auto' } } } });

test('revision is key-order independent and detects nonempty replacement lists', () => {
  assert.equal(installerRevision({ a: 1, b: { y: 2, x: 3 } }), installerRevision({ b: { x: 3, y: 2 }, a: 1 }));
  assert.doesNotThrow(() => assertInstallerRevision(undefined, oldPatch()));
  for (const token of [undefined, null, 'bad', installerRevision(oldPatch())]) {
    assert.throws(() => assertInstallerRevision(token, newPatch()), error => safeConfigurationFailure(error).body.error === 'EOS_INSTALLER_CONFIG_CHANGED');
  }
  assert.doesNotThrow(() => assertInstallerRevision(installerRevision(newPatch()), newPatch()));
});

test('stale AppCenter HTTP save/import cannot overwrite new automatic rows or persist anything', async t => {
  const h = await createHarness(); t.after(() => h.close()); const token = await h.login('admin');
  h.adapter._nwInstallerConfigPatch = oldPatch();
  const original = await h.request('/api/installer/config', { token });
  assert.equal(original.status, 200);
  assert.equal(original.data.configurationRevision, installerRevision(oldPatch()));
  h.adapter._nwInstallerConfigPatch = newPatch(); h.adapter.config = structuredClone(newPatch());
  for (const endpoint of ['/api/installer/config', '/api/installer/backup/import']) {
    for (const revision of [original.data.configurationRevision, undefined]) {
      const result = await h.request(endpoint, { token, method: 'POST', body: {
        patch: oldPatch(), expectedConfigurationRevision: revision, restartEms: false,
      } });
      assert.equal(result.status, 409); assert.equal(result.data.error, 'EOS_INSTALLER_CONFIG_CHANGED');
      assert.match(result.data.message, /Eingaben bleiben erhalten/);
    }
  }
  assert.equal(h.saved.length, 0);
  assert.deepEqual(h.adapter._nwInstallerConfigPatch, newPatch());
});

test('object preparation retries once, fails visibly and stops on ownership loss', async () => {
  let attempts = 0; let next = 0;
  await provisionInstallerObjects({ canWrite: () => true, steps: [async () => { if (++attempts === 1) throw Error('transient'); }, async () => { next++; }] });
  assert.equal(attempts, 2); assert.equal(next, 1);
  attempts = 0;
  await assert.rejects(provisionInstallerObjects({ canWrite: () => true, steps: [async () => { attempts++; throw Error('offline'); }, async () => { next++; }] }),
    error => safeConfigurationFailure(error).body.error === 'EOS_EMS_OBJECT_PROVISION_FAILED');
  assert.equal(attempts, 2); assert.equal(next, 1);
  await assert.rejects(provisionInstallerObjects({ canWrite: () => false, steps: [async () => { attempts++; }] }),
    error => safeConfigurationFailure(error).body.error === 'EOS_UI_OWNERSHIP_REQUIRED');
  assert.equal(attempts, 2);
});

test('new EVCS objects are provisioned without fabricated measurements or resetting existing values', async t => {
  const h = await createHarness(); t.after(() => h.close());
  h.states.set('eos-admin.0.evcs.1.energyTotalKwh', { val: 1234, ack: true });
  h.states.set('eos-admin.0.evcs.rfid.whitelistJson', { val: '["retained"]', ack: true });
  await h.adapter._nwProvisionInstallerObjects(newPatch());
  for (const id of ['evcs.2.powerW', 'evcs.2.energyTotalKwh', 'evcs.2.vehicleSoc']) {
    assert.equal(h.objects.get(`eos-admin.0.${id}`).type, 'state');
    assert.equal(h.states.has(`eos-admin.0.${id}`), false);
  }
  assert.equal(h.states.get('eos-admin.0.evcs.1.energyTotalKwh').val, 1234);
  assert.equal(h.states.get('eos-admin.0.evcs.rfid.whitelistJson').val, '["retained"]');
});

test('an RFID database read error cannot clear saved whitelist', async t => {
  const h = await createHarness(); t.after(() => h.close());
  h.states.set('eos-admin.0.evcs.rfid.whitelistJson', { val: '["retained"]', ack: true });
  const read = h.adapter.getStateAsync.bind(h.adapter);
  h.adapter.getStateAsync = async id => { if (id === 'evcs.rfid.whitelistJson') throw Error('offline'); return read(id); };
  await assert.rejects(h.adapter.ensureRfidStates(), /offline/);
  assert.equal(h.states.get('eos-admin.0.evcs.rfid.whitelistJson').val, '["retained"]');
});

test('startup does not delete device/history objects and UI deep links match existing panels', () => {
  const source = fs.readFileSync(require.resolve('../ui/main.js'), 'utf8');
  assert.doesNotMatch(source, /startupStep\(\(\) => this\.cleanupOrphanedObjects\(\)\)/);
  const frontend = fs.readFileSync(require.resolve('../ui/www/ems-apps.js'), 'utf8');
  for (const id of ['evcs', 'storageconfig', 'storagefarm', 'mapping', 'flow']) assert.ok(frontend.includes(`'${id}'`));
  assert.match(frontend, /expectedConfigurationRevision: configurationRevision/);
});

test('app activate/deactivate/re-enable provisions before engine init and preserves existing telemetry and mappings', async t => {
  const h = await createHarness(); t.after(async () => { await new Promise(resolve => h.adapter.onUnload(resolve)); await h.close(); });
  h.adapter.config = newPatch();
  h.adapter.config.emsApps = { apps: { charging: { installed: true, enabled: true } } };
  h.states.set('eos-admin.0.evcs.1.energyTotalKwh', { val: 1234, ack: true });
  h.states.set('eos-admin.0.settings.flowInvertGrid', { val: true, ack: true });
  h.adapter.startHistorieExportTimer = () => {};
  h.adapter.scheduleDerivedFlowUpdate = () => {};
  h.owner.subscribeForeignStates = () => {};
  h.owner.unsubscribeForeignStates = () => {};
  let initialized = 0;
  h.adapter.initEmsEngine = async () => {
    assert.equal(h.objects.get('eos-admin.0.evcs.2.powerW').type, 'state');
    assert.equal(h.adapter.evcsCount, 2);
    initialized++;
  };
  const rows = structuredClone(h.adapter.config.settingsConfig.evcsList);
  for (const enabled of [true, false, true]) {
    h.adapter.config.emsApps.apps.charging.enabled = enabled;
    await h.adapter._nwApplyInstallerRuntime(true, 'device-commissioning');
    assert.equal(h.states.get('eos-admin.0.evcs.1.energyTotalKwh').val, 1234);
    assert.equal(h.states.get('eos-admin.0.settings.flowInvertGrid').val, true);
    assert.deepEqual(h.adapter.config.settingsConfig.evcsList, rows);
    assert.equal(h.states.has('eos-admin.0.evcs.2.powerW'), false);
  }
  assert.equal(initialized, 3);
});

test('AppCenter discovery includes integrated and retained dotted IDs without alias-group phantom devices', async t => {
  const h = await createHarness(); t.after(() => h.close()); const token = await h.login('installer');
  const bases = ['eos-admin.0.devices.wallbox.entrance', 'nexowatt-devices.4.devices.meter.grid'];
  const fixtures = new Map(); const manifests = {};
  for (const base of bases) {
    fixtures.set(base, { type: 'channel', common: { name: base }, native: { category: base.includes('wallbox') ? 'EVCS' : 'METER' } });
    fixtures.set(`${base}.aliases`, { type: 'channel', common: {}, native: {} });
    fixtures.set(`${base}.aliases.v1`, { type: 'channel', common: {}, native: {} });
    fixtures.set(`${base}.aliases.v1.r.power`, { type: 'state', common: { type: 'number', unit: 'W', read: true, write: false }, native: {} });
    fixtures.set(`${base}.aliases.v1.ctrl.currentLimitA`, { type: 'state', common: { type: 'number', unit: 'A', read: true, write: true }, native: {} });
    manifests[`${base}.aliases.meta.manifest`] = { ack: true, val: JSON.stringify({ schemaVersion: 1, deviceClass: base.includes('wallbox') ? 'evCharger' : 'meter' }) };
  }
  const calls = [];
  const matches = (pattern, id) => pattern.startsWith('nexowatt-devices.') ? id.startsWith('nexowatt-devices.') : id.startsWith('eos-admin.0.');
  h.adapter.getForeignObjectsAsync = async (pattern, type) => {
    calls.push(pattern);
    return Object.fromEntries([...fixtures].filter(([id, object]) => object.type === type && matches(pattern, id)));
  };
  h.adapter.getForeignStatesAsync = async pattern => Object.fromEntries(Object.entries(manifests).filter(([id]) => matches(pattern, id)));
  const result = await h.request('/api/nwdevices/discover', { token });
  assert.equal(result.status, 200);
  assert.equal(result.data.deviceCount, 2);
  for (const base of bases) {
    const device = result.data.devices.find(row => row.baseId === base);
    assert.ok(device, base);
    assert.equal(device.dp.powerW, `${base}.aliases.v1.r.power`);
    assert.equal(device.aliases['ctrl.currentLimitA'], `${base}.aliases.v1.ctrl.currentLimitA`);
  }
  assert.ok(calls.includes('eos-admin.0.devices.*'));
  assert.equal(result.data.hardwareWrites, 0);
  assert.equal(h.saved.length, 0);
});
