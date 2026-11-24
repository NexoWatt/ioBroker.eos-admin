'use strict';
// Integration of the real module host, device alias generator, inventory service,
// planner and hosted AppCenter persistence. Only controller I/O and physical
// transports are fixtures; this is not a hardware or real-controller test.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const { EosModuleHost } = require('../src/lib/eosModuleHost');
const devicesModule = require('../modules/devices');
const { DeviceRuntime } = require('../modules/devices/lib/deviceRuntime');
const { planDeviceEms, getDeviceEmsReferences } = require('../src/lib/eosDeviceEmsPlan');
const { resolveDeviceEmsTargets } = require('../src/lib/eosDeviceEmsService');

const templateId = 'evcs.abl.emh1.evcc2_3.modbusAscii';
const device = (id = 'wallbox.entrance') => ({ id, name: 'Wallbox Eingang', templateId,
  protocol: 'modbusAscii', enabled: true, connection: {}, ems: { mode: 'auto' } });
const manual = { name: 'Bestehender Ladepunkt', enabled: false, powerId: 'alias.0.customer.power',
  setCurrentAId: 'alias.0.customer.current', maxA: 13, customCustomerSetting: 'retain' };

function merged(old, patch, id) {
  return { ...old, ...structuredClone(patch), _id: id,
    common: { ...old?.common, ...patch.common }, native: { ...old?.native, ...patch.native } };
}

async function fixture(t, options = {}) {
  const h = await createHarness();
  const writes = []; const objectWrites = []; const logs = []; const transports = []; const hosts = [];
  const { owner, objects, states, adapter } = h;
  const namespace = options.namespace || 'eos-admin.0';
  const envelope = value => ({ v: 1, encrypted: owner.encrypt(JSON.stringify(value)),
    ...(namespace === 'eos-admin.0' ? {} : { migration: { preserveNamespace: true, source: namespace } }) });
  owner.encrypt = value => `test-encrypted:${Buffer.from(value).toString('base64')}`;
  owner.decrypt = value => Buffer.from(value.slice('test-encrypted:'.length), 'base64').toString();
  owner.config.eosModules = { devices: envelope({ enabled: false, devices: [] }) };
  owner.eosLicenseService = { allowsEmbeddedModule: () => true };
  owner.eosOwnership = { canWrite: () => true };
  owner.log = Object.fromEntries(['info', 'warn', 'error', 'debug'].map(level => [level, message => logs.push({ level, message })]));
  owner.getObjectViewAsync = async (_design, type, range) => ({ rows: [...objects.values()]
    .filter(obj => obj.type === type && obj._id >= range.startkey && obj._id <= range.endkey).map(value => ({ value })) });
  owner.getForeignObjectsAsync = async (pattern, type) => {
    const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
    return Object.fromEntries([...objects].filter(([id, obj]) => id.startsWith(prefix) && (!type || obj.type === type)));
  };
  // ioBroker returns _id on every object, including objects created through its
  // local API. The shared HTTP fixture omits that database decoration.
  owner.getForeignObjectAsync = async id => objects.has(id) ? { ...objects.get(id), _id: id } : null;
  owner.setForeignObjectAsync = async (id, obj) => {
    objectWrites.push(id); objects.set(id, { ...structuredClone(obj), _id: id });
  };
  owner.setForeignObjectNotExistsAsync = async (id, obj) => {
    if (!objects.has(id)) await owner.setForeignObjectAsync(id, obj);
  };
  owner.extendForeignObjectAsync = async (id, patch) => {
    objectWrites.push(id); objects.set(id, merged(objects.get(id), patch, id));
  };
  owner.setForeignStateAsync = async (id, state, ack) => {
    const value = state && typeof state === 'object' && Object.hasOwn(state, 'val') ? state : { val: state, ack: !!ack };
    const saved = { ...structuredClone(value), ts: Date.now(), lc: Date.now() };
    states.set(id, saved); writes.push({ id, state: saved });
  };
  owner.unsubscribeForeignStatesAsync = async () => {};
  owner.unsubscribeForeignObjectsAsync = async () => {};
  adapter._hostedStartup = { state: 'ready' };
  adapter._bridge.deviceEmsPlan = async input => {
    const targets = await resolveDeviceEmsTargets({ owner, references: getDeviceEmsReferences(input.config),
      devices: input.devices, canRun: () => owner.eosOwnership.canWrite() });
    return planDeviceEms({ ...input, ...targets, limits: { chargePoints: 12, batteries: 4 } });
  };
  adapter._bridge.resolveDeviceProfileReferences = config => resolveDeviceEmsTargets({ owner,
    references: getDeviceEmsReferences(config), devices: [], canRun: () => owner.eosOwnership.canWrite() });
  adapter.config.settingsConfig = { evcsCount: 1, evcsList: [structuredClone(manual)] };
  adapter.config.settings = { customCustomerPreference: 'retain' };
  adapter._nwInstallerConfigPatch = { settingsConfig: structuredClone(adapter.config.settingsConfig),
    settings: structuredClone(adapter.config.settings) };
  // The shared HTTP fixture normally substitutes persistence. Restore the real
  // credential-protected state commit for this cross-module regression test.
  adapter.persistInstallerConfigToState = Object.getPrototypeOf(adapter).persistInstallerConfigToState;
  const applied = [];
  adapter._nwApplyInstallerRuntime = async function (_restart, reason) {
    // Exercise real charging-point settings/state synchronization without starting
    // background EMS dispatch against fixture hardware.
    await this.syncSettingsConfigToStates();
    applied.push(reason);
  };
  const factory = { ...devicesModule, createHostedModule: options => devicesModule.createHostedModule({
    ...options, runtimeFactory: (config, template) => {
      const runtime = new DeviceRuntime(options.adapter, config, template, options.config);
      runtime._createDriver = () => { throw new Error('physical transport must not open in commissioning test'); };
      runtime.start = async () => { runtime.started = true; transports.push(runtime); };
      runtime.stop = async () => { runtime.started = false; };
      return runtime;
    },
  }) };
  const inactive = { validateConfig: input => ({ ...input, enabled: false }) };
  function newHost() {
    const host = new EosModuleHost(owner, { baseDir: path.resolve(__dirname, '..'),
      dataDir: '/tmp/eos-device-ems-test-only', factories: { devices: factory, eebus: inactive, backup: inactive } });
    host.bindDeviceEms(devices => adapter.reconcileDeviceEms(devices), request => adapter.reserveDeviceProfileChange(request));
    hosts.push(host); return host;
  }
  t.after(async () => { for (const host of hosts) await host.stop(); await h.close(); });
  const host = newHost();
  await host.start();
  async function save(config, target = host) {
    await target.save('devices', config);
    await target.reconcile();
    await target.flushDeviceEms();
  }
  function persisted() {
    const value = states.get('eos-admin.0.installer.configJson');
    assert.equal(value?.ack, true, `AppCenter commit missing; ${JSON.stringify(logs.slice(-4))}`);
    return JSON.parse(value.val);
  }
  return { ...h, host, newHost, save, persisted, writes, objectWrites, logs, transports, applied, namespace };
}

test('saving a real supported wallbox creates a persisted disabled charging point and retains manual configuration', async t => {
  const x = await fixture(t);
  await x.save({ enabled: true, devices: [device()] });
  const saved = x.persisted();
  const list = saved.settingsConfig.evcsList;
  assert.equal(list.length, 2);
  assert.deepEqual(list[0], manual);
  const row = list[1];
  assert.equal(row.enabled, false, 'automatic assignment must not authorize physical dispatch');
  assert.equal(row.powerId, 'eos-admin.0.devices.wallbox.entrance.aliases.v1.r.power');
  assert.equal(row.setCurrentAId, 'eos-admin.0.devices.wallbox.entrance.aliases.v1.ctrl.currentLimitA');
  assert.equal(row._eosDevice.baseId, 'eos-admin.0.devices.wallbox.entrance');
  assert.equal(saved.settingsConfig.evcsCount, 2);
  assert.equal(saved.settings.customCustomerPreference, 'retain');
  assert.equal(x.adapter.config.settingsConfig.evcsList[1].setCurrentAId, row.setCurrentAId);
  assert.ok(x.objects.has(row.setCurrentAId), 'mapping references an actual profile-generated alias');
  assert.equal(x.objects.get(row.setCurrentAId).native.aliasContractVersion, 1);
  assert.ok(x.objects.has('eos-admin.0.evcs.2.powerW'), 'normal EMS objects are provisioned');
  assert.equal(x.adapter.evcsList[1].enabled, false, 'runtime charging-point view retains the inactive assignment');
  assert.ok(x.applied.includes('device-commissioning'));
  const view = await x.host.view('devices');
  assert.equal(view.emsCommissioning.state, 'ready');
  assert.equal(view.emsCommissioning.statuses[0].code, 'COMMISSIONING_REQUIRED');
  assert.equal(x.writes.filter(item => item.id.includes('.devices.') && item.state.ack === false).length, 0);
  assert.deepEqual([...x.objectWrites, ...x.writes.map(item => item.id)].filter(id =>
    !id.startsWith('eos-admin.0.') && id !== '0_userdata.0.nexowattVis' && !id.startsWith('0_userdata.0.nexowattVis.')), [],
  'commissioning must not mutate ioBroker Admin, its users/groups, or unrelated adapter objects');
});

test('repeat save, disable, re-enable and host restart keep one charging point, IDs and customer edits', async t => {
  const x = await fixture(t);
  const config = { enabled: true, devices: [device()] };
  await x.save(config);
  x.adapter._nwInstallerConfigPatch.settingsConfig.evcsList[1].name = 'Kundenname';
  x.adapter._nwInstallerConfigPatch.settingsConfig.evcsList[1].maxA = 12;
  await x.adapter.persistInstallerConfigToState(x.adapter._nwInstallerConfigPatch);
  await x.save(config);
  assert.equal((await x.host.view('devices')).emsCommissioning.state, 'ready');
  const before = x.persisted();
  assert.equal(before.settingsConfig.evcsList.length, 2);
  assert.equal(before.settingsConfig.evcsList[1].name, 'Kundenname');
  assert.equal(before.settingsConfig.evcsList[1].maxA, 12);
  await x.save({ ...config, enabled: false });
  assert.equal((await x.host.view('devices')).emsCommissioning.state, 'ready');
  assert.deepEqual(x.persisted(), before);
  await x.save(config);
  assert.equal((await x.host.view('devices')).emsCommissioning.state, 'ready');
  assert.deepEqual(x.persisted(), before);
  await x.host.stop();
  // Rehydrate the hosted runtime through its real startup reader, rather than
  // letting the previous in-memory installer patch hide a persistence defect.
  x.adapter.config = { auth: {}, accessControl: {} };
  x.adapter._nwInstallerConfigPatch = {};
  await x.adapter.loadInstallerConfigFromState();
  assert.deepEqual(x.adapter.config.settingsConfig.evcsList, before.settingsConfig.evcsList);
  assert.deepEqual(x.persisted(), before);
  const restart = x.newHost();
  await restart.start(); await restart.flushDeviceEms();
  assert.deepEqual(x.persisted(), before);
  assert.deepEqual(restart.readConfig('devices').devices, config.devices);
  const restartView = await restart.view('devices');
  assert.equal(restartView.emsCommissioning.statuses.length, 1, JSON.stringify(restartView.emsCommissioning));
});

test('preserved legacy namespace keeps the real dotted alias IDs through automatic commissioning', async t => {
  const x = await fixture(t, { namespace: 'nexowatt-devices.0' });
  await x.save({ enabled: true, devices: [device('customer.carport')] });
  const row = x.persisted().settingsConfig.evcsList[1];
  assert.equal(row.powerId, 'nexowatt-devices.0.devices.customer.carport.aliases.v1.r.power');
  assert.equal(row.setCurrentAId, 'nexowatt-devices.0.devices.customer.carport.aliases.v1.ctrl.currentLimitA');
  assert.ok(x.objects.has(row.powerId));
  assert.equal([...x.objects.keys()].some(id => id.startsWith('eos-admin.0.devices.customer.carport.')), false);
});

test('device edits cannot race an in-flight AppCenter commit or replace the saved configuration', async t => {
  const x = await fixture(t);
  await x.save({ enabled: true, devices: [device()] });
  let release; let reached;
  const waiting = new Promise(resolve => { reached = resolve; });
  const releasePromise = new Promise(resolve => { release = resolve; });
  const apply = x.host.deviceEms.options.apply;
  // The original host callback must acquire the actual mutation lock before
  // entering the blocked runtime handler.
  const reconcile = x.adapter.reconcileDeviceEms.bind(x.adapter);
  x.adapter.reconcileDeviceEms = async inventory => { reached(); await releasePromise; return reconcile(inventory); };
  x.host.requestDeviceEms();
  const flushing = x.host.flushDeviceEms();
  await waiting;
  assert.equal(typeof apply, 'function');
  await assert.rejects(x.host.save('devices', { enabled: true, devices: [device('different')] }), /EOS_MODULE_BUSY/);
  assert.equal(x.host.readConfig('devices').devices[0].id, 'wallbox.entrance');
  release(); await flushing;
  assert.equal(x.persisted().settingsConfig.evcsList.length, 2);
});

test('existing manual alias command resolves through the actual bridge and prevents a duplicate automatic controller', async t => {
  const x = await fixture(t);
  const aliasId = 'alias.0.customer.current';
  x.objects.set(aliasId, { _id: aliasId, type: 'state', common: { type: 'number', read: true, write: true,
    alias: { id: { read: 'alias.0.customer.feedback',
      write: 'eos-admin.0.devices.wallbox.entrance.aliases.v1.ctrl.currentLimitA' } } }, native: {} });
  await x.adapter.persistInstallerConfigToState(x.adapter._nwInstallerConfigPatch);
  const before = x.persisted();
  await x.save({ enabled: true, devices: [device()] });
  const view = await x.host.view('devices');
  assert.equal(view.emsCommissioning.state, 'error');
  assert.equal(view.emsCommissioning.statuses[0].code, 'CONTROL_TARGET_ALREADY_ASSIGNED');
  assert.deepEqual(x.persisted(), before);
  assert.deepEqual(x.adapter.config.settingsConfig.evcsList, [manual]);
  assert.equal(x.writes.filter(item => item.id.includes('.devices.') && item.state.ack === false).length, 0);
});

test('real FENECON Home profile fills actual farm feedback, native grid and optional measurements without dispatch', async t => {
  const x = await fixture(t);
  const config = { enabled: true, devices: [{ id: 'storage.home', name: 'FENECON Keller',
    templateId: 'ess.fenecon.FeneconHomeEssImpl', protocol: 'modbusTcp', enabled: true,
    connection: {}, ems: { mode: 'storageFarm', scope: 'M0' } }] };
  await x.save(config);
  const row = x.persisted().storageFarm.storages[0];
  const runtime = x.transports.find(item => item.cfg.id === 'storage.home');
  const base = 'eos-admin.0.devices.storage.home';
  assert.equal(row.enabled, false);
  assert.equal(row.vendorProfile, 'fenecon-openems');
  assert.equal(row.feneconControlMode, 'direct-ess');
  assert.equal(row.coupling, 'dc');
  const mapping = {
    signedPowerId: ['r.essActivePower', 'eSS0_ACTIVE_POWER', 604],
    feneconEssActualPowerId: ['r.essActivePower', 'eSS0_ACTIVE_POWER', 604],
    feneconNvpPowerId: ['r.nvpPower', 'gRID_POWER', 315],
    feneconConsumptionTotalId: ['r.consumptionTotal', 'lOAD_POWER', 343],
    feneconMinPowerId: ['r.minPowerSetpointW', 'mIN_POWER_SETPOINT', 702],
    feneconMaxPowerId: ['r.maxPowerSetpointW', 'mAX_POWER_SETPOINT', 704],
    feneconPvDcId: ['r.pvPowerDc', 'pV_DC_POWER', 339],
    feneconPvAcId: ['r.pvPowerAc', 'pV_AC_POWER', 331],
    feneconPvTotalId: ['r.pvPowerTotal', 'pV_POWER_SUM', 327],
    pvPowerId: ['r.pvPowerDc', 'pV_DC_POWER', 339],
  };
  for (const [field, [alias, source, register]] of Object.entries(mapping)) {
    assert.equal(row[field], `${base}.aliases.v1.${alias}`, field);
    const object = x.objects.get(row[field]);
    assert.equal(object?.native.dpId, source, field);
    assert.equal(object?.common.unit, 'W', field);
    assert.equal(object?.common.write, false, field);
    const read = runtime.dpById.get(source).source;
    assert.equal((read.read || read).address, register, field);
    const definition = runtime.aliasDefs.find(item => item.aliasContractPath === alias);
    assert.equal(definition.fromDevice(1.5), 1500, `${field} converts actual kW to canonical W`);
  }
  assert.equal(row.setSignedPowerId, `${base}.aliases.v1.ctrl.powerSetpointW`);
  assert.equal(row.feneconGridSetpointId, `${base}.aliases.v1.ctrl.gridSetpointW`);
  assert.notEqual(row.setSignedPowerId, row.feneconGridSetpointId);
  const direct = runtime.dpById.get('sET_ACTIVE_POWER');
  const grid = runtime.dpById.get('sET_GRID_ACTIVE_POWER');
  assert.equal((direct.source.write || direct.source).address, 706);
  assert.equal((grid.source.write || grid.source).address, 992);
  assert.equal(grid.source.write.requireComponentId.expected, 'ctrlBalancing0');
  assert.equal(row.feneconActualSetpointId, undefined, 'write-only register 706 is not an applied readback');
  assert.equal(x.objects.has(`${base}.aliases.v1.r.powerSetpointReadbackW`), false);
  assert.equal((await x.host.view('devices')).emsCommissioning.state, 'ready');
  x.adapter._nwInstallerConfigPatch.storageFarm.storages[0].maxChargeW = 7654;
  await x.adapter.persistInstallerConfigToState(x.adapter._nwInstallerConfigPatch);
  await x.save(config);
  assert.equal(x.persisted().storageFarm.storages.length, 1);
  assert.equal(x.persisted().storageFarm.storages[0].maxChargeW, 7654);
  assert.equal(x.writes.filter(item => item.id.includes('.devices.') && item.state.ack === false).length, 0);
});

test('real SolaX Hybrid profile uses common storage aliases and exposes only genuine optional telemetry', async t => {
  const x = await fixture(t);
  const config = { enabled: true, devices: [{ id: 'storage.solax', name: 'SolaX Haus',
    templateId: 'ess.solax.SolaXHybridX1X3Ess', protocol: 'modbusTcp', enabled: true,
    connection: {}, ems: { mode: 'storageFarm', scope: 'M0' } }] };
  await x.save(config);
  const row = x.persisted().storageFarm.storages[0];
  const runtime = x.transports.find(item => item.cfg.id === 'storage.solax');
  const base = 'eos-admin.0.devices.storage.solax';
  assert.equal(row.enabled, false);
  assert.ok(row.socId.startsWith(`${base}.aliases.v1.`));
  assert.equal(row.signedPowerId, `${base}.aliases.v1.r.power`);
  assert.equal(row.setSignedPowerId, `${base}.aliases.v1.ctrl.powerSetpointW`);
  assert.equal(Object.keys(row).some(key => key.startsWith('fenecon')), false);
  assert.equal(row.pvPowerId, undefined, 'a hybrid balance is not a guessed AC/DC PV split');
  const expected = {
    'r.minPowerSetpointW': ['aLLOWED_CHARGE_POWER', 162],
    'r.maxPowerSetpointW': ['aLLOWED_DISCHARGE_POWER', 164],
    'r.powerSetpointReadbackW': ['sET_ACTIVE_POWER', 417],
  };
  for (const [alias, [source, register]] of Object.entries(expected)) {
    const object = x.objects.get(`${base}.aliases.v1.${alias}`);
    assert.equal(object?.native.dpId, source, alias);
    assert.equal(object?.common.unit, 'W', alias);
    assert.equal(object?.common.write, false, alias);
    const definition = runtime.dpById.get(source);
    assert.equal((definition.source.read || definition.source).address, register, alias);
  }
  const signed = runtime.aliasDefs.find(item => item.aliasContractPath === 'ctrl.powerSetpointW');
  assert.equal((runtime.dpById.get(signed.writeDpId).source.write).address, 161);
  const limit = runtime.aliasDefs.find(item => item.aliasContractPath === 'r.minPowerSetpointW');
  assert.equal(limit.fromDevice(2500), -2500);
  assert.equal(limit.fromDevice(null), null);
  assert.equal(x.objects.has(`${base}.aliases.v1.ctrl.gridSetpointW`), false);
  assert.equal(x.objects.has(`${base}.aliases.v1.r.nvpPower`), false,
    'a grid register with unverified sign is not promoted to a canonical NVP input');
  assert.equal(x.objects.has(`${base}.aliases.v1.r.pvPowerDc`), false);
  assert.equal(x.objects.has(`${base}.aliases.v1.r.pvPowerAc`), false);
  const before = x.persisted();
  await x.save(config);
  assert.deepEqual(x.persisted(), before);
  assert.equal(x.writes.filter(item => item.id.includes('.devices.') && item.state.ack === false).length, 0);
});
