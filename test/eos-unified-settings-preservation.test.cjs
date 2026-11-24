'use strict';
/** Update regressions against the actual hosted runtime and in-memory controller
 * fixtures. No actuator commands, real adapter stop or production database. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const key = 'eos-admin.0.installer.configJson';

for (const patch of [
  {},
  { datapoints: {}, settingsConfig: { evcsCount: 0, evcsList: [] }, smartHomeConfig: { version: 3, floors: [], rooms: [], devices: [] } },
  { datapoints: { gridPower: 'alias.0.site.newGrid', storagePower: '' }, settingsConfig: { evcsCount: 0, evcsList: [] }, storageFarm: { storages: [], groups: [] } },
]) {
  test(`restart/update preserves valid saved assignments including intentional empty values: ${Object.keys(patch).join(',') || '{}'}`, async t => {
    const h = await createHarness(); t.after(() => h.close());
    const serialized = JSON.stringify(patch, null, 2);
    h.states.set(key, { val: serialized, ack: true });
    h.adapter.config.datapoints = { gridPower: 'old.adapter.0.grid', storagePower: 'old.adapter.0.storage' };
    h.adapter.config.settingsConfig = { evcsCount: 2, evcsList: [{ id: 'stale' }] };
    let backupReads = 0; let backupWrites = 0;
    h.adapter.nwReadUserdataBackup = async () => { backupReads++; return { instance: 0, configPatch: { datapoints: { a: 'old.a', b: 'old.b', c: 'old.c' } } }; };
    h.adapter.nwWriteUserdataBackup = async () => { backupWrites++; };
    await h.adapter.loadInstallerConfigFromState();
    assert.equal(h.states.get(key).val, serialized, 'the saved JSON is byte-for-byte unchanged');
    assert.equal(h.saved.length, 0, 'normalization remains in memory');
    assert.equal(backupReads, 0, 'an older larger backup is never consulted for a valid state');
    assert.equal(backupWrites, 0);
    if (patch.datapoints) assert.deepEqual(h.adapter.config.datapoints, patch.datapoints);
    if (patch.settingsConfig) assert.deepEqual(h.adapter.config.settingsConfig, patch.settingsConfig);
    if (patch.smartHomeConfig) assert.deepEqual(h.adapter.config.smartHomeConfig, patch.smartHomeConfig);
  });
}

test('unavailable or invalid saved installer data cannot become defaults or overwrite a backup', async t => {
  const h = await createHarness(); t.after(() => h.close());
  const original = h.adapter.config;
  const oldPatch = { datapoints: { gridPower: 'alias.0.valid.grid' } };
  h.adapter._nwInstallerConfigPatch = oldPatch;
  let backups = 0;
  h.adapter.nwReadUserdataBackup = async () => { backups++; return null; };
  h.adapter.nwWriteUserdataBackup = async () => { backups++; };
  for (const val of ['{broken-private-marker', '[]', 'null', '', null, '{"smartHomeConfig":{"devices":{}}}', '{"__proto__":{"polluted":true}}']) {
    h.states.set(key, { val, ack: true });
    await assert.rejects(h.adapter.loadInstallerConfigFromState(), error => error.message === 'EOS_UI_CONFIG_INVALID');
    assert.equal(h.adapter.config, original);
    assert.equal(h.adapter._nwInstallerConfigPatch, oldPatch);
    assert.equal(h.states.get(key).val, val);
  }
  h.adapter.getStateAsync = async () => { throw new Error('private database fragment'); };
  await assert.rejects(h.adapter.loadInstallerConfigFromState(), error => error.message === 'EOS_UI_CONFIG_LOAD_FAILED');
  assert.equal(h.saved.length, 0); assert.equal(backups, 0); assert.equal(h.adapter.config, original);
});

test('only a confirmed missing installer state permits matching-instance recovery; failed writes do not update backups', async t => {
  const h = await createHarness(); t.after(() => h.close());
  h.adapter.nwReadUserdataBackup = async options => {
    assert.equal(options.strict, true);
    return { instance: 0, configPatch: { datapoints: { gridPower: 'alias.0.saved.grid' } } };
  };
  let backups = 0; h.adapter.nwWriteUserdataBackup = async () => { backups++; };
  await h.adapter.loadInstallerConfigFromState();
  assert.equal(h.saved.length, 1); assert.equal(backups, 1);
  assert.equal(h.adapter.config.datapoints.gridPower, 'alias.0.saved.grid');
  const before = h.adapter.config;
  h.adapter.persistInstallerConfigToState = async () => false;
  await assert.rejects(h.adapter.loadInstallerConfigFromState(), /EOS_UI_CONFIG_WRITE_FAILED/);
  assert.equal(backups, 1); assert.equal(h.adapter.config, before);
  h.adapter.nwReadUserdataBackup = async () => { throw new Error('EOS_UI_BACKUP_READ_FAILED'); };
  await assert.rejects(h.adapter.loadInstallerConfigFromState(), /EOS_UI_BACKUP_READ_FAILED/);
  assert.equal(backups, 1);
});

test('customer flow settings and disabled PV AI survive startup defaults; explicit settings saves still apply', async t => {
  const h = await createHarness(); t.after(() => h.close());
  h.adapter.config.settings = { flowInvertGrid: false, flowGridShowNet: true, flowInvertBattery: true };
  h.states.set('eos-admin.0.settings.flowInvertGrid', { val: true, ack: true });
  h.states.set('eos-admin.0.settings.flowGridShowNet', { val: false, ack: true });
  h.states.set('eos-admin.0.settings.tariffPvSeasonAiEnabled', { val: false, ack: true });
  await h.adapter.ensureSettingsStates();
  await h.adapter.syncSettingsToStates(true);
  assert.equal(h.states.get('eos-admin.0.settings.flowInvertGrid').val, true);
  assert.equal(h.states.get('eos-admin.0.settings.flowGridShowNet').val, false);
  assert.equal(h.states.get('eos-admin.0.settings.flowInvertBattery').val, true, 'new state honors the explicit native setting');
  assert.equal(h.states.get('eos-admin.0.settings.tariffPvSeasonAiEnabled').val, false);
  await h.adapter.syncSettingsToStates();
  assert.equal(h.states.get('eos-admin.0.settings.flowInvertGrid').val, false);
  assert.equal(h.states.get('eos-admin.0.settings.flowGridShowNet').val, true);
});

test('unreadable StorageFarm assignments never get replaced by empty defaults', async t => {
  const h = await createHarness(); t.after(() => h.close());
  const rows = JSON.stringify([{ id: 'existing-battery', powerId: 'alias.0.storage.power' }]);
  h.states.set('eos-admin.0.storageFarm.configJson', { val: rows, ack: true });
  h.adapter.getStateAsync = async id => {
    if (id === 'storageFarm.configJson') throw new Error('unavailable');
    return { val: false, ack: true };
  };
  await assert.rejects(h.adapter.syncStorageFarmDefaultsToStates(), /EOS_STORAGE_FARM_STATE_INIT_FAILED/);
  assert.equal(h.states.get('eos-admin.0.storageFarm.configJson').val, rows);
  h.adapter.config.storageFarm = { storages: [] };
  h.adapter._nwGetStorageFarmRuntimeInfo = () => ({ active: false, rows: [] });
  await h.adapter.syncStorageFarmConfigFromAdmin();
  assert.equal(h.states.get('eos-admin.0.storageFarm.configJson').val, rows);
});


test('automatic missing-state recovery prefers current backup and rejects corrupt existing backups or unreadable storage', async t => {
  const h = await createHarness(); t.after(() => h.close());
  h.adapter.nwEnsureUserdataBackupObjects = async () => true;
  const base = '0_userdata.0.nexowattVis.';
  const current = { instance: 0, configPatch: { datapoints: {} } };
  h.states.set(base + 'backupJson', { val: JSON.stringify(current) });
  h.states.set(base + 'backupJsonPrev', { val: JSON.stringify({ instance: 0, configPatch: { datapoints: { old1: 'old.dp.1', old2: 'old.dp.2' } } }) });
  assert.deepEqual(await h.adapter.nwReadUserdataBackup({ strict: true }), current);
  for (const val of ['[]', 'null', '{broken', '{"instance":0}', '{"instance":0,"configPatch":[]}', '{"instance":-1,"configPatch":{}}', null, '']) {
    h.states.set(base + 'backupJson', { val });
    await assert.rejects(h.adapter.nwReadUserdataBackup({ strict: true }), /EOS_UI_BACKUP_READ_FAILED/);
  }
  h.states.set(base + 'backupJson', { val: '{}' });
  h.states.set(base + 'backupJsonPrev', { val: '{}' });
  assert.equal(await h.adapter.nwReadUserdataBackup({ strict: true }), null, 'historical empty backup defaults are uninitialized');
  h.adapter.getForeignStateAsync = async () => { throw new Error('private database fragment'); };
  await assert.rejects(h.adapter.nwReadUserdataBackup({ strict: true }), error => error.message === 'EOS_UI_BACKUP_READ_FAILED');
  assert.equal(h.saved.length, 0);
});


test('configuration startup failures close the hosted runtime rather than leave writable default configuration', async t => {
  const h = await createHarness(); t.after(() => h.close());
  for (const code of ['EOS_UI_CONFIG_INVALID', 'EOS_UI_CONFIG_LOAD_FAILED', 'EOS_UI_CONFIG_WRITE_FAILED', 'EOS_UI_BACKUP_READ_FAILED', 'EOS_STORAGE_FARM_STATE_INIT_FAILED']) {
    let closed = false;
    // Inject at the first async step to exercise the real startup error boundary
    // without starting network/device engines. Loader behavior is covered above.
    h.adapter.migrateNativeConfig = async () => { throw new Error(code); };
    h.adapter.onUnload = callback => { closed = true; callback(); };
    await h.adapter.onReady();
    assert.equal(closed, true, code);
    assert.deepEqual(h.adapter._hostedStartup, { state: 'degraded', error: code });
  }
});


test('new flow states initialize from the saved installer settings after hydration, not earlier package defaults', async t => {
  const h = await createHarness(); t.after(() => h.close());
  h.adapter.config.settings = { flowInvertBattery: false };
  h.states.set(key, { val: JSON.stringify({ settings: { flowInvertBattery: true } }), ack: true });
  await h.adapter.ensureSettingsStates();
  assert.equal(h.states.has('eos-admin.0.settings.flowInvertBattery'), false);
  await h.adapter.loadInstallerConfigFromState();
  await h.adapter.syncSettingsToStates(true);
  assert.equal(h.states.get('eos-admin.0.settings.flowInvertBattery').val, true);
  assert.equal(h.saved.length, 0);
});
