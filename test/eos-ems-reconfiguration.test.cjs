'use strict';
/** Real engine/module registry and hosted apply; database and devices are fixtures. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const { EmsEngine } = require('../ui/ems/engine');
const { awaitEmsTransition, numericMeasurement } = require('../ui/lib/installer-lifecycle');

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
async function fullRuntime(t) {
  const h = await createHarness();
  const a = h.adapter;
  a.config = structuredClone(require('../ui/io-package.json').native);
  a.config.port = 8188;
  a._hostedStartup = { state: 'ready' };
  a.startHistorieExportTimer = () => {};
  h.owner.subscribeForeignStates = () => {};
  h.owner.unsubscribeForeignStates = () => {};
  await a.migrateNativeConfig();
  await a.loadInstallerConfigFromState();
  await a.syncSettingsConfigToStates();
  t.after(async () => {
    await new Promise(resolve => a.onUnload(resolve));
    await h.close();
  });
  return h;
}

test('real apply waits old tick and async module stop before config replacement, then rebinds all engine readers without losing session', async t => {
  const h = await fullRuntime(t); const a = h.adapter;
  a.config.datapoints.gridPointPower = 'alias.0.old.grid';
  a.config.storage.datapoints = { ...(a.config.storage.datapoints || {}), batteryPowerObjectId: 'alias.0.old.battery' };
  await a.initEmsEngine();
  const old = a.emsEngine; const oldRegistry = old.dp;
  const cycle = deferred(); const reached = deferred(); const stopped = deferred(); const stopReached = deferred();
  old.mm.tick = async () => { reached.resolve(); await cycle.promise; };
  old.mm.modules.push({ key: 'test-cleanup', instance: { stop: async () => { stopReached.resolve(); await stopped.promise; } }, enabledFn: () => false });
  const running = old.tick(); await reached.promise;
  const patch = { datapoints: { ...a.config.datapoints, gridPointPower: 'alias.0.new.grid' },
    storage: { ...a.config.storage, datapoints: { ...a.config.storage.datapoints, batteryPowerObjectId: 'alias.0.new.battery' } },
    settingsConfig: { ...a.config.settingsConfig, evcsCount: 1, evcsList: [{ enabled: true, name: 'New', maxCurrentA: 16, minCurrentA: 6,
      powerId: 'alias.0.new.wallbox.power', setCurrentAId: 'alias.0.new.wallbox.set' }] },
    emsApps: { ...a.config.emsApps, apps: { ...a.config.emsApps.apps, charging: { installed: true, enabled: true } } } };
  a._bridge.deviceEmsPlan = async () => ({ changed: true, patch, statuses: [{ code: 'APPLIED' }] });
  const token = await h.login('installer');
  let complete = false;
  const applying = a.reconcileDeviceEms([]).then(result => { complete = true; return result; });
  t.after(async () => { cycle.resolve(); stopped.resolve(); await Promise.allSettled([running, applying]); });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(a.config.datapoints.gridPointPower, 'alias.0.old.grid');
  assert.equal(a.emsEngine, old);
  assert.equal(complete, false);
  cycle.resolve(); await running; await stopReached.promise;
  assert.equal(a.config.datapoints.gridPointPower, 'alias.0.old.grid', 'async old stop still sees its own mapping');
  assert.equal(complete, false);
  assert.equal((await h.request('/api/installer/config', { token })).status, 200, 'same session stays valid');
  stopped.resolve(); await applying;
  assert.notEqual(a.emsEngine, old);
  assert.notEqual(a.emsEngine.dp, oldRegistry);
  assert.equal(a.emsEngine.dp.getEntry('vis.gridNetW').objectId, 'alias.0.new.grid');
  assert.equal(a.emsEngine.dp.getEntry('st.batteryPowerW').objectId, 'alias.0.new.battery');
  await a.emsEngine.tick();
  assert.ok([...a.emsEngine.dp.byKey.values()].some(row => row.objectId === 'alias.0.new.wallbox.set'), JSON.stringify({ evcs: a.evcsList, cfg: a.config.chargingManagement.wallboxes, cm: a.emsEngine.mm.modules.find(row => row.key === 'chargingManagement')?.initError }));
  assert.equal(a.emsEngine.mm.modules.find(row => row.key === 'chargingManagement').enabledFn(), true);
  assert.equal((await h.request('/api/installer/config', { token })).status, 200);
});

test('bounded reconfiguration timeout leaves old engine fenced and cannot create another actuator cycle', async t => {
  const h = await fullRuntime(t); const a = h.adapter;
  const engine = new EmsEngine(a); a.emsEngine = engine;
  const cycle = deferred(); const reached = deferred(); let ticks = 0;
  engine.dp = { getRaw: () => null, getNumber: () => null, getBoolean: () => null, getEntry: () => null };
  engine.mm = { tick: async () => { ticks++; reached.resolve(); await cycle.promise; }, stop() {} };
  const running = engine.tick(); await reached.promise;
  await assert.rejects(engine.prepareReconfigure(5), /EOS_EMS_CONFIG_WAIT_TIMEOUT/);
  assert.equal(engine._reconfiguring, true);
  await engine.tick(); assert.equal(ticks, 1);
  cycle.resolve(); await running;
  await engine.stopForReconfigure(20);
  await assert.rejects(awaitEmsTransition(Promise.reject(new Error('stop-failed')), 20), /stop-failed/);
});

test('numeric cache readers reject boolean, missing and collection values while retaining real zero', async t => {
  const h = await fullRuntime(t); const a = h.adapter; const now = Date.now();
  for (const value of [true, false, null, undefined, '', ' ', [], [1], {}, NaN, Infinity]) {
    a.stateCache.consumptionEvcs = { value, ts: now };
    a._nwRawValueCache.consumptionEvcs = { value, ts: now };
    assert.equal(numericMeasurement(value), null);
    assert.equal(a._nwGetNumberFromCache('consumptionEvcs'), null);
    assert.equal(a._nwGetNumberFromCacheFresh('consumptionEvcs', 5000), null);
    assert.equal(a._nwGetRawNumberFromCache('consumptionEvcs', 5000), null);
  }
  for (const value of [0, '0', 1200, '1200.5']) {
    a.stateCache.consumptionEvcs = { value, ts: now };
    assert.equal(a._nwGetNumberFromCacheFresh('consumptionEvcs', 5000), Number(value));
  }
});

test('one configured active storage-farm member contributes real farm metrics to energy flow', async t => {
  const h = await fullRuntime(t); const a = h.adapter;
  a.config.emsApps.apps.storagefarm = { installed: true, enabled: true };
  a.config.enableStorageFarm = true;
  a.config.storageFarm = { enabled: true, storages: [{ enabled: true, name: 'One', signedPowerId: 'alias.0.battery.power', socId: 'alias.0.battery.soc' }] };
  const now = Date.now();
  for (const [key, value] of Object.entries({ 'storageFarm.totalPowerW': -1500, 'storageFarm.totalChargePowerW': 1500,
    'storageFarm.totalDischargePowerW': 0, 'storageFarm.powerSourcesTotal': 1, 'storageFarm.totalSoc': 60 })) a.stateCache[key] = { value, ts: now };
  assert.equal(a._nwStorageFarmIsActiveFromCache(), true);
  const metrics = a._nwResolveStorageFarmMetricsFromCache();
  assert.equal(metrics.active, true); assert.equal(metrics.totalPowerW, -1500); assert.equal(metrics.chargeW, 1500);
  a.config.emsApps.apps.storagefarm.enabled = false;
  assert.equal(a._nwStorageFarmIsActiveFromCache(), false);
});

test('FENECON farm keeps converter feedback for control while flow shows only battery power and separate DC PV', async t => {
  const h = await fullRuntime(t); const a = h.adapter;
  a.config.emsApps.apps.storagefarm = { installed: true, enabled: true };
  a.config.enableStorageFarm = true;
  a.config.storageFarm = { enabled: true, storages: [{ enabled: true, name: 'Home', vendorProfile: 'fenecon-openems', coupling: 'dc',
    feneconControlMode: 'direct-ess', signedPowerId: 'alias.0.home.converter604', feneconEssActualPowerId: 'alias.0.home.converter604',
    batteryFlowPowerId: 'alias.0.home.battery415', socId: 'alias.0.home.soc', feneconPvDcId: 'alias.0.home.pv339' }] };
  for (const [id, unit] of [['converter604', 'W'], ['battery415', 'W'], ['soc', '%'], ['pv339', 'W']]) {
    h.objects.set(`alias.0.home.${id}`, { type: 'state', common: { type: 'number', unit, read: true, write: false }, native: {} });
  }
  await a.ensureStorageFarmStates();
  for (const [battery, converter] of [[-2000, 1000], [0, 3000]]) {
    const now = Date.now();
    for (const [id, val] of [['converter604', converter], ['battery415', battery], ['soc', 60], ['pv339', 3000]]) {
      h.states.set(`alias.0.home.${id}`, { val, ts: now, ack: true });
    }
    await a.updateStorageFarmDerived('fixture');
    assert.equal(h.states.get('eos-admin.0.storageFarm.totalPowerW').val, converter, 'control feedback remains complete ESS converter output');
    assert.equal(h.states.get('eos-admin.0.storageFarm.totalBatteryPowerW').val, battery);
    const metrics = a._nwResolveStorageFarmMetricsFromCache();
    assert.equal(metrics.totalPowerW, battery);
    assert.equal(metrics.dischargeW, 0, 'DC PV must not be reported as battery discharge');
    assert.equal(metrics.chargeW, Math.max(0, -battery));
    assert.equal(metrics.pvDcW, 3000);
    assert.equal(a.config.storageFarm.storages[0].signedPowerId, 'alias.0.home.converter604');
  }
  h.states.set('alias.0.home.battery415', { val: true, ts: Date.now(), ack: true });
  await a.updateStorageFarmDerived('fixture-invalid');
  assert.equal(h.states.get('eos-admin.0.storageFarm.totalBatteryPowerW').val, null, 'bad battery sample must not be replaced by converter output or fake zero');
  assert.equal(a._nwResolveStorageFarmMetricsFromCache().totalPowerW, null);
});

test('energy-flow shadow comparison produces a result rather than referencing undefined unrelated UI variables', async t => {
  const h = await fullRuntime(t);
  const result = h.adapter._nwRunEnergyFlowTsShadowComparison({ mode: 'js', gridBuyW: 1200, gridSellW: 0, chargeW: 0, dischargeW: 0, loadTotalW: 1200 });
  assert.equal(result.source, 'js-mode');
  assert.equal(result.runtime.gridBuyW, 1200);
  assert.equal(result.ok, true);
});

test('a module task that timed out remains awaited before engine replacement and its late write uses only the old mapping', async t => {
  const h = await fullRuntime(t); const a = h.adapter;
  a.config.datapoints.gridPointPower = 'alias.0.old.grid';
  a.config.diagnostics.emsModuleTimeoutMs = 2000;
  await a.initEmsEngine();
  const engine = a.emsEngine;
  // Stop optional observers/normal modules before inserting a deterministic slow
  // module into the real manager/isolated-watchdog path.
  await engine.prepareReconfigure();
  engine.mm._nvpTopologyModule?.stop?.();
  engine.mm._nvpTopologyModule = undefined;
  const originalRows = engine.mm.modules;
  const release = deferred(); const reached = deferred(); const writes = [];
  engine.mm.modules = [{ key: 'fixture-late-writer', initialized: true, instance: { tick: async () => {
    reached.resolve(); await release.promise; writes.push(a.config.datapoints.gridPointPower);
  } }, enabledFn: () => true }];
  const cycle = engine.mm.tick(); await reached.promise; await cycle;
  assert.match(engine.mm.lastTickDiag.results[0].error, /module-timeout/);
  await assert.rejects(engine.stopForReconfigure(10), /EOS_EMS_CONFIG_WAIT_TIMEOUT/);
  assert.equal(a.config.datapoints.gridPointPower, 'alias.0.old.grid');
  assert.equal(a.emsEngine, engine);
  assert.equal(engine._reconfiguring, true);
  release.resolve(); await engine.mm.waitForPendingWork();
  assert.deepEqual(writes, ['alias.0.old.grid']);
  engine.mm.modules = originalRows;
  await engine.stopForReconfigure();
});


test('a disabled commissioned single-storage row cannot acquire authority from an otherwise enabled app', async t => {
  const h = await fullRuntime(t); const a = h.adapter;
  const { SpeicherRegelungModule } = require('../ui/ems/modules/storage-control');
  a.config.emsApps.apps.storage = { installed: true, enabled: true };
  a.config.storage = { enabled: false, _eosDevice: { v: 1, baseId: 'eos-admin.0.devices.storage' } };
  assert.equal(a._nwGetStorageControlAuthority().selectedTopology, 'none');
  const fallback = new SpeicherRegelungModule({ config: a.config }, null);
  assert.equal(fallback._getStorageControlAuthority().selectedTopology, 'none');
  a.config.storage.enabled = true;
  assert.equal(a._nwGetStorageControlAuthority().selectedTopology, 'single');
  assert.equal(fallback._getStorageControlAuthority().selectedTopology, 'single');
  delete a.config.storage._eosDevice;
  a.config.storage.enabled = false;
  assert.equal(a._nwGetStorageControlAuthority().selectedTopology, 'single', 'unchanged legacy manual configuration keeps its existing app semantics');
});
