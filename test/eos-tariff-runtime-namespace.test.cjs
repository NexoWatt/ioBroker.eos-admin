/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatapointRegistry } = require('../ui/ems/datapoints');
const { TarifVisModule } = require('../ui/ems/modules/tarif-vis');
const { TariffStatusModule } = require('../ui/ems/modules/tariff-status');

async function fixture(namespace, vis) {
  const states = new Map(), objects = new Map(), logs = [];
  let dp;
  const full = id => id.startsWith(`${namespace}.`) ? id : `${namespace}.${id}`;
  const adapter = {
    namespace, instance: Number(namespace.split('.').at(-1)), config: { ...(vis ? { vis } : {}),
      datapoints: { priceCurrent: 'provider.0.current' }, storage: { allowGridCharge: true } },
    log: Object.fromEntries(['warn', 'debug', 'info', 'error'].map(level => [level, message => logs.push([level, message])])),
    async setObjectNotExistsAsync(id, object) { objects.set(full(id), object); },
    async getForeignObjectAsync(id) { return objects.get(id) || null; },
    async getForeignStateAsync(id) { return states.get(id) || null; },
    async getStateAsync(id) { return states.get(full(id)) || null; },
    async subscribeForeignStatesAsync() {},
    async setStateAsync(id, input, ack) {
      const state = input && typeof input === 'object' ? input : { val: input, ack };
      const sample = { ...state, ts: Date.now(), lc: Date.now() };
      states.set(full(id), sample); dp?.handleStateChange(full(id), sample);
    },
  };
  dp = new DatapointRegistry(adapter, []);
  const policy = new TarifVisModule(adapter, dp), status = new TariffStatusModule(adapter, dp);
  await policy.init(); await status.init();
  policy._getStorageControlAuthority = () => ({ selectedTopology: 'single', writerActive: true });
  for (const [key, val] of Object.entries({ dynamicTariff: true, tariffMode: 1, price: 0.30, priority: 2, storagePower: 2000, evcsMaxPower: 11000, netFeeEnabled: false })) {
    await adapter.setStateAsync(`settings.${key}`, { val, ack: true });
  }
  dp.handleStateChange('provider.0.current', { val: 0.20, ack: true, ts: Date.now() });
  return { adapter, dp, policy, status, states, full, logs };
}

test('new EOS installations read active tariff settings from their actual runtime and produce a live status', async () => {
  for (const namespace of ['eos-admin.0', 'eos-admin.3', 'nexowatt-ui.2']) {
    const x = await fixture(namespace);
    assert.equal(x.dp.getEntry('vis.settings.dynamicTariff').objectId, `${namespace}.settings.dynamicTariff`);
    await x.policy.tick(); await x.status.tick();
    assert.equal(x.states.get(x.full('tarif.aktiv'))?.val, true, JSON.stringify(x.logs));
    assert.equal(x.states.get(x.full('tarif.currentPriceFresh'))?.val, true);
    assert.equal(x.states.get(x.full('tarif.state'))?.val, 'guenstig');
    assert.equal(x.states.get(x.full('tarif.speicherNetzLadenErlaubt'))?.val, true);
    assert.equal(x.states.get(x.full('tarif.speicherSollW'))?.val, -2000);
    assert.match(x.states.get(x.full('tarif.statusText'))?.val, /Tarif Manuell günstig/);
    await x.adapter.setStateAsync('settings.dynamicTariff', { val: false, ack: true });
    await x.policy.tick();
    assert.equal(x.states.get(x.full('tarif.speicherNetzLadenErlaubt'))?.val, false);
    assert.equal(x.states.get(x.full('tarif.speicherSollW'))?.val, 0);
  }
});

test('explicit legacy VIS namespace remains authoritative and cannot be overridden by local settings', async () => {
  const x = await fixture('eos-admin.2', { instance: 'nexowatt-ui.4' });
  assert.equal(x.dp.getEntry('vis.settings.dynamicTariff').objectId, 'nexowatt-ui.4.settings.dynamicTariff');
  await x.policy.tick();
  assert.equal(x.states.get(x.full('tarif.aktiv'))?.val, false);
});

test('runtime namespace default preserves tariff freshness and AppCenter blocking', async () => {
  const x = await fixture('eos-admin.0');
  await x.policy.tick();
  assert.equal(x.states.get(x.full('tarif.speicherNetzLadenErlaubt'))?.val, true);
  x.adapter.config.storage.allowGridCharge = false;
  await x.policy.tick();
  assert.equal(x.states.get(x.full('tarif.speicherNetzLadenErlaubt'))?.val, false);
  x.adapter.config.storage.allowGridCharge = true;
  x.dp.handleStateChange('provider.0.current', { val: 0.20, ack: true, ts: Date.now() - 86400000 });
  await x.policy.tick();
  assert.equal(x.states.get(x.full('tarif.currentPriceFresh'))?.val, false);
  assert.equal(x.states.get(x.full('tarif.speicherNetzLadenErlaubt'))?.val, false);
});


test('tariff status preserves a constant PV reserve through fresh storage policy and invalidates a stopped writer', async () => {
  const x = await fixture('eos-admin.0'); await x.policy.tick();
  const now = Date.now(), policy = { ts: now, pvAwareTarifNetzladen: { blocked: true, capSocPct: 75, reason: 'Reserve für PV-Erzeugung' } };
  x.states.set(x.full('speicher.regelung.tarifPvBlock'), { val: true, ts: now - 86400000, q: 0 });
  x.states.set(x.full('speicher.regelung.policyJson'), { val: JSON.stringify(policy), ts: now, q: 0 });
  await x.status.tick();
  const read = () => JSON.parse(x.states.get(x.full('tarif.statusJson')).val).pvReserve;
  assert.equal(read().blocked, true); assert.equal(read().fresh, true); assert.equal(read().capSocPct, 75);
  x.states.set(x.full('speicher.regelung.policyJson'), { val: JSON.stringify(policy), ts: now, q: 128 });
  await x.status.tick(); assert.equal(read().blocked, false); assert.equal(read().fresh, false);
  policy.ts = now - 30001;
  x.states.set(x.full('speicher.regelung.policyJson'), { val: JSON.stringify(policy), ts: now, q: 0 });
  await x.status.tick(); assert.equal(read().blocked, false); assert.equal(read().fresh, false);
});

test('persistent tariff settings still control storage and EVs after more than one year', async () => {
  const x = await fixture('eos-admin.0');
  const old = Date.now() - 366 * 86400000;
  for (const key of ['dynamicTariff', 'tariffMode', 'price', 'priority', 'storagePower', 'evcsMaxPower']) {
    const id = x.full('settings.' + key);
    x.dp.handleStateChange(id, { ...x.states.get(id), ts: old }, true);
  }
  const read = key => x.states.get(x.full('tarif.' + key)).val;
  await x.policy.tick();
  assert.equal(read('aktiv'), true);
  assert.equal(read('speicherSollW'), -2000);
  x.dp.handleStateChange('provider.0.current', { val: 0.48, ack: true, ts: Date.now() });
  // The same running policy uses a hysteresis transition when crossing its threshold.
  await x.policy.tick();
  await x.policy.tick();
  assert.equal(read('state'), 'teuer');
  assert.equal(read('netzLadenErlaubt'), false);
  assert.equal(read('speicherSollW'), 0);
});

test('current verified price has priority over a conflicting negative curve; valid curves can replace an unavailable price', async () => {
  const x = await fixture('eos-admin.0');
  const now = Date.now();
  await x.adapter.setStateAsync('settings.tariffMode', { val: 2, ack: true });
  await x.dp.upsert({ key: 'tarif.pricesTodayJson', objectId: 'provider.0.today', dataType: 'string' });
  await x.dp.upsert({ key: 'tarif.preisDurchschnittEurProKwh', objectId: 'provider.0.average' });
  const row = { startsAt: new Date(now - 60000).toISOString(), endsAt: new Date(now + 840000).toISOString(), total: -0.10, currency: 'EUR' };
  const curve = { val: JSON.stringify([row]), ts: now - 1000, ack: true };
  const direct = { val: 0.48, ts: now, ack: true };
  x.dp.handleStateChange('provider.0.average', { val: 0.30, ts: now, ack: true });
  x.dp.handleStateChange('provider.0.today', curve);
  x.dp.handleStateChange('provider.0.current', direct);
  const read = key => x.states.get(x.full('tarif.' + key)).val;
  await x.policy.tick();
  assert.equal(read('preisAktuellEurProKwh'), 0.48);
  assert.equal(read('negativpreisAktiv'), false);
  assert.equal(read('state'), 'teuer');
  assert.equal(read('speicherSollW'), 0);
  assert.equal(read('netzLadenErlaubt'), false);
  x.dp.handleStateChange('provider.0.current', { ...direct, q: 0x82 });
  await x.policy.tick();
  assert.equal(read('currentPriceSource'), 'curve-current');
  assert.equal(read('preisAktuellEurProKwh'), -0.10);
  assert.equal(read('negativpreisAktiv'), true);
  assert.equal(read('speicherSollW'), -2000);
  for (const invalid of [{ q: 0x82 }, { ack: false }, { ts: now + 86400000 }, { ts: 0 }]) {
    x.dp.handleStateChange('provider.0.today', { ...curve, ...invalid });
    x.dp.handleStateChange('provider.0.current', { ...direct, val: -0.10, ...invalid });
    await x.policy.tick();
    assert.equal(read('currentPriceFresh'), false, JSON.stringify(invalid));
    assert.equal(read('negativpreisAktiv'), false);
    assert.equal(read('speicherSollW'), 0);
    assert.equal(read('netzLadenErlaubt'), false);
  }
});

test('EV departure planner uses the verified live gate for the current slot and discards unverified forecast inputs', async t => {
  const bridge = require('../ui/ems/services/forecast-target-runtime-bridge');
  let forecast;
  const plan = bridge.buildRuntimeGoalPlanMap;
  t.mock.method(bridge, 'buildRuntimeGoalPlanMap', function (parameters) {
    forecast = parameters.tariffForecast;
    return plan(parameters);
  });
  const { makeHarness } = require('../ui/scripts/verify-rc60-universal-auto-wallbox.js');
  const now = Date.now();
  const h = makeHarness({ goalEnabled: true, goalTargetSocPct: 60, vehicleSoc: 50, deadlineHours: 4,
    priceCurrent: 0.48, tariffState: 'teuer', gridAllowed: false, userMode: 'auto' });
  t.after(() => h.stop());
  h.adapter._tarifVis = { curveMaxAgeMs: 36 * 3600000 };
  for (const [id, value] of Object.entries({ aktiv: true, modus: 2, prioritaet: 2, currentPriceFresh: true,
    dynamicTariffStale: false, preisRefEurProKwh: 0.30, preisGrenzeEurProKwh: 0.32, preisSchwelleGuensigEurProKwh: 0.12 })) h.setLocal('tarif.' + id, value);
  const curveKey = 'tarif.pricesTodayJson';
  const rows = [[-60000, 600000], [600000, 1500000]].map(([start, end]) => ({
    startsAt: new Date(now + start).toISOString(), endsAt: new Date(now + end).toISOString(), total: -0.10, currency: 'EUR',
  }));
  const raw = h.dp.getRaw.bind(h.dp);
  h.dp.getRaw = (key, fallback) => key === curveKey ? rows : raw(key, fallback);
  h.dp.getVerifiedMeasurementTimestampMs = key => key === curveKey ? now : null;
  await h.tick();
  assert.equal(forecast.segments.length, 2);
  assert.equal(forecast.segments[0].priceEurKwh, 0.48);
  assert.equal(forecast.segments[0].allowGrid, false);
  assert.equal(forecast.segments[1].priceEurKwh, -0.10);
  for (const invalid of [null, now - 37 * 3600000]) {
    h.dp.getVerifiedMeasurementTimestampMs = () => invalid;
    await h.tick();
    assert.equal(forecast.segments.length, 1);
    assert.equal(forecast.segments[0].priceEurKwh, 0.48);
    assert.equal(forecast.segments[0].allowGrid, false);
  }
});
