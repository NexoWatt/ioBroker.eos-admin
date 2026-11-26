'use strict';
/** Real farm aggregation plus pure display contract; state database is an isolated fixture. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const { buildFarmOverview } = require('../ui/lib/storage-farm-overview');
const member = (key, batteryPowerW, socPct, capacityKWh, fresh = true) => ({ key, fresh, batteryPowerW, socPct, capacityKWh });

test('farm overview retains both physical gross directions, zero net and arithmetic rather than capacity-weighted SoC', () => {
  const result = buildFarmOverview([member('a', -5000, 20, 10), member('b', 5000, 80, 30)], [{ key: 'pv1', powerW: 4000 }], 123);
  assert.deepEqual(result.battery, { valid: 2, total: 2, complete: true, netW: 0, chargeW: 5000, dischargeW: 5000 });
  assert.equal(result.soc.meanPct, 50); assert.equal(result.capacity.totalKWh, 40);
  assert.equal(result.pv.powerW, 4000); assert.equal(result.updatedAt, 123);
});

test('partial measurements never masquerade as full sums, while fresh SoC subset and known configured capacity stay explicitly labelled', () => {
  const result = buildFarmOverview([member('a', 1000, 80, 10), member('b', 2000, null, null, false)], [{ key: 'pv1', powerW: 2000 }, { key: 'pv2', powerW: null }], 1);
  assert.deepEqual(result.members, { total: 2, fresh: 1 });
  assert.deepEqual(result.battery, { valid: 1, total: 2, complete: false, netW: null, chargeW: null, dischargeW: null });
  assert.deepEqual(result.soc, { valid: 1, total: 2, complete: false, meanPct: 80 });
  assert.deepEqual(result.capacity, { valid: 1, total: 2, complete: false, totalKWh: null, knownKWh: 10 });
  assert.deepEqual(result.pv, { valid: 1, total: 2, complete: false, powerW: null });
  const empty = buildFarmOverview([], [], 1);
  assert.equal(empty.battery.netW, null); assert.equal(empty.soc.meanPct, null); assert.equal(empty.capacity.totalKWh, null); assert.equal(empty.pv.powerW, null);
});

test('identical duplicate sources count once and conflicting duplicate readings are unavailable', () => {
  const a = member('a', -2000, 0, 10);
  const same = buildFarmOverview([a, { ...a }], [{ key: 'p', powerW: 0 }, { key: 'p', powerW: 0 }], 1);
  assert.equal(same.members.total, 1); assert.equal(same.capacity.totalKWh, 10); assert.equal(same.battery.chargeW, 2000);
  assert.equal(same.pv.powerW, 0); assert.equal(same.pv.total, 1); assert.equal(same.soc.meanPct, 0);
  const conflict = buildFarmOverview([a, { ...a, batteryPowerW: 1000 }], [{ key: 'p', powerW: 0 }, { key: 'p', powerW: 10 }], 1);
  assert.equal(conflict.battery.netW, null); assert.equal(conflict.pv.powerW, null);
});

test('real farm state/API snapshot excludes stale SoC and power, preserves existing controller semantics and never seeds display telemetry', async t => {
  const h = await createHarness(); const a = h.adapter;
  t.after(async () => { await new Promise(resolve => a.onUnload(resolve)); await h.close(); });
  a.config = structuredClone(require('../ui/io-package.json').native);
  a.config.port = 8188;
  await a.migrateNativeConfig();
  await a.loadInstallerConfigFromState();
  a.config.emsApps.apps.storagefarm = { installed: true, enabled: true };
  a.config.enableStorageFarm = true;
  a.config.storageFarm = { enabled: true, storages: [
    { enabled: true, name: 'A', signedPowerId: 'alias.0.a.power', socId: 'alias.0.a.soc', pvPowerId: 'alias.0.a.pv', capacityKWh: 10 },
    { enabled: true, name: 'B', signedPowerId: 'alias.0.b.power', socId: 'alias.0.b.soc', pvPowerId: 'alias.0.b.pv', capacityKWh: 30 },
  ] };
  await a.ensureStorageFarmStates();
  for (const key of ['overviewJson', 'displayMeanSoc', 'totalCapacityKWh', 'totalBatteryChargePowerW', 'totalBatteryDischargePowerW']) {
    assert.ok(h.objects.has(`eos-admin.0.storageFarm.${key}`));
    assert.equal(h.states.has(`eos-admin.0.storageFarm.${key}`), false, 'object creation cannot fabricate measurements');
  }
  const now = Date.now();
  for (const [id, val, unit] of [['a.power', -5000, 'W'], ['b.power', 5000, 'W'], ['a.soc', 20, '%'], ['b.soc', 80, '%'], ['a.pv', 2000, 'W'], ['b.pv', 1000, 'W']]) {
    h.states.set(`alias.0.${id}`, { val, ts: now, ack: true });
    h.objects.set(`alias.0.${id}`, { type: 'state', common: { type: 'number', unit }, native: {} });
  }
  h.states.get('alias.0.a.power').ts = now-2000;
  h.states.get('alias.0.a.pv').ts = now-3000;
  await a.updateStorageFarmDerived('overview-fixture');
  assert.equal(a.stateCache['storageFarm.totalBatteryPowerW'].ts,now-2000);
  assert.equal(a.stateCache['storageFarm.totalPvPowerW'].ts,now-3000);
  const value = key => h.states.get(`eos-admin.0.storageFarm.${key}`).val;
  let overview = JSON.parse(value('overviewJson'));
  assert.equal(overview.battery.netW, 0); assert.equal(overview.battery.chargeW, 5000); assert.equal(overview.battery.dischargeW, 5000);
  assert.equal(value('totalBatteryChargePowerW'), 5000); assert.equal(value('totalBatteryDischargePowerW'), 5000);
  assert.equal(value('displayMeanSoc'), 50); assert.equal(value('totalCapacityKWh'), 40); assert.equal(overview.pv.powerW, 3000);
  assert.equal(a.stateCache['storageFarm.overviewJson'].value, value('overviewJson'), 'same atomic snapshot serves /api/state');
  h.states.set('alias.0.b.soc', { val: 80, ts: now - 600000, ack: true });
  h.states.set('alias.0.b.power', { val: 5000, ts: now - 600000, ack: true });
  h.states.set('alias.0.b.pv', { val: 1000, ts: now - 600000, ack: true });
  await a.updateStorageFarmDerived('overview-stale');
  overview = JSON.parse(value('overviewJson'));
  assert.equal(overview.battery.netW, null); assert.equal(overview.battery.chargeW, null); assert.equal(overview.battery.valid, 1);
  assert.equal(overview.soc.meanPct, 20); assert.equal(overview.soc.complete, false);
  assert.equal(overview.capacity.totalKWh, 40, 'configured capacity is independent of live sample freshness');
  assert.equal(overview.pv.powerW, null); assert.equal(value('totalSoc'), 50, 'existing retained controller SoC semantics are not redefined');
  assert.equal(value('totalPvPowerW'),null, 'lost member PV prevents a usable partial sum');
  // An invalid status flag must not become 1 W or a fresh 0% sample.
  h.states.set('alias.0.a.soc', { val: false, ts: now, ack: true });
  h.states.set('alias.0.a.power', { val: 0, ts: now, q: 0x40, ack: true });
  await a.updateStorageFarmDerived('overview-invalid');
  overview = JSON.parse(value('overviewJson'));
  assert.equal(overview.soc.meanPct, null); assert.equal(overview.battery.valid, 0);
});

test('license normalization preserves absent optional limits and explicit zero/null without poisoning next device plan', async t => {
  const h = await createHarness(); t.after(() => h.close());
  const patch = { storage: { maxChargeW: 0, maxDischargeW: null, selfMaxChargeW: undefined } };
  h.adapter._nwApplyLicenseLimitsToInstallerPatch(patch);
  assert.deepEqual(patch.storage, { maxChargeW: 0, maxDischargeW: null });
  h.adapter._nwApplyLicenseLimitsToInstallerPatch(patch);
  assert.deepEqual(patch.storage, { maxChargeW: 0, maxDischargeW: null });
});
