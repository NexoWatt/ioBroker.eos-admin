'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const { activeDeviceProfileReferences } = require('../ui/lib/installer-lifecycle');
const active = { installed: true, enabled: true };
const inactive = { installed: true, enabled: false };
const base = 'eos-admin.0.devices.storage.home';
const request = { namespace: 'eos-admin.0', changes: [{ deviceId: 'storage.home', previousTemplateId: 'old', templateId: 'new', previousProtocol: 'modbusTcp', protocol: 'modbusTcp' }] };

function cfg() { return { emsApps: { apps: { storage: active, storagefarm: inactive, charging: inactive } }, storage: { datapoints: { targetPowerObjectId: `${base}.aliases.v1.w.setPower` } } }; }

test('profile admission sees enabled controllers but excludes disabled rows and pure display mappings', () => {
  const config = cfg();
  config.datapoints = { batteryPower: `${base}.aliases.v1.r.power` };
  config.settingsConfig = { evcsList: [{ enabled: true, setCurrentAId: 'eos-admin.0.devices.wallbox.aliases.v1.w.setCurrent' }] };
  assert.deepEqual(activeDeviceProfileReferences(config), { read: [`${base}.aliases.v1.r.power`], write: [`${base}.aliases.v1.w.setPower`] });
  config.emsApps.apps.storage = inactive;
  assert.deepEqual(activeDeviceProfileReferences(config), { read: [], write: [] });
  config.emsApps.apps.charging = active;
  assert.equal(activeDeviceProfileReferences(config).write.length, 1);
  config.settingsConfig.evcsList[0].enabled = false;
  assert.equal(activeDeviceProfileReferences(config).write.length, 0);
  config.datapoints.gridPointPower = `${base}.aliases.v1.r.power`;
  assert.deepEqual(activeDeviceProfileReferences(config).read, [`${base}.aliases.v1.r.power`], 'mandatory protection measurement must remain protected');
});

test('profile guard shares installer reservation and rejects active dotted-device readers/writers before any profile commit', async t => {
  const h = await createHarness(); t.after(() => h.close()); const a = h.adapter;
  a._hostedStartup = { state: 'ready' }; a.config = cfg(); a._nwInstallerConfigPatch = {};
  await assert.rejects(a.reserveDeviceProfileChange(request), { code: 'EOS_DEVICES_PROFILE_IN_USE' });
  assert.equal(a._nwMeshAppSaveInProgress, false, 'failed check releases its reservation');
  a.config.emsApps.apps.storage = inactive;
  const release = await a.reserveDeviceProfileChange(request);
  assert.equal(typeof release, 'function'); assert.equal(a._nwBeginInstallerConfigMutation(), null);
  await assert.rejects(a.reserveDeviceProfileChange(request), { code: 'EOS_DEVICE_EMS_BUSY' });
  release(); release();
  const next = a._nwBeginInstallerConfigMutation(); assert.ok(next); a._nwEndInstallerConfigMutation(next);
});

test('profile guard resolves manual alias chains under the same reservation and fails closed on unavailable checks or lost ownership', async t => {
  const h = await createHarness(); t.after(() => h.close()); const a = h.adapter;
  a._hostedStartup = { state: 'ready' }; a.config = cfg(); a._nwInstallerConfigPatch = {};
  a.config.storage.datapoints.targetPowerObjectId = 'alias.0.customer.storageTarget';
  let inspected;
  a._bridge.resolveDeviceProfileReferences = async selected => {
    inspected = selected;
    assert.equal(a._nwBeginInstallerConfigMutation(), null, 'concurrent AppCenter enable/edit cannot race alias read');
    return { readTargets: {}, writeTargets: { 'alias.0.customer.storageTarget': `${base}.raw.targetRegister` } };
  };
  await assert.rejects(a.reserveDeviceProfileChange(request), { code: 'EOS_DEVICES_PROFILE_IN_USE' });
  assert.deepEqual(inspected, { storage: { profileReferences: [{ writeObjectId: 'alias.0.customer.storageTarget' }] } });
  a._bridge.resolveDeviceProfileReferences = undefined;
  await assert.rejects(a.reserveDeviceProfileChange(request), { code: 'EOS_DEVICES_PROFILE_CHECK_UNAVAILABLE' });
  a._bridge.resolveDeviceProfileReferences = async () => undefined;
  await assert.rejects(a.reserveDeviceProfileChange(request), { code: 'EOS_DEVICES_PROFILE_CHECK_UNAVAILABLE' });
  a._bridge.resolveDeviceProfileReferences = async () => { a._nwShuttingDown = true; return { readTargets: {}, writeTargets: {} }; };
  await assert.rejects(a.reserveDeviceProfileChange(request), { code: 'EOS_DEVICES_PROFILE_CHECK_UNAVAILABLE' });
  assert.equal(a._nwMeshAppSaveInProgress, false);
});


test('profile admission includes actual split NVP and legacy peak/atypical actuator references', () => {
  const buy = `${base}.aliases.v1.r.importPower`; const sell = `${base}.aliases.v1.r.exportPower`;
  const target = `${base}.aliases.v1.w.setPower`;
  const input = { emsApps: { apps: { peak: inactive } }, datapoints: { gridBuyPower: buy, gridSellPower: sell },
    peakShaving: { atypical: { enabled: true }, gridPointPowerId: buy, actuators: [{ enabled: true, setpointId: target }] } };
  const refs = activeDeviceProfileReferences(input);
  assert.deepEqual(new Set(refs.read), new Set([buy, sell]));
  assert.deepEqual(refs.write, [target]);
  input.peakShaving.atypical.enabled = false;
  assert.deepEqual(activeDeviceProfileReferences(input).write, []);
});
