'use strict';
// Actual publication/consumer/registry/core/wallet chain; simulated database only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatapointRegistry } = require('../ui/ems/datapoints');
const { TariffProviderModule } = require('../ui/ems/modules/tariff-provider');
const { TarifVisModule } = require('../ui/ems/modules/tarif-vis');
const { CoreLimitsModule } = require('../ui/ems/modules/core-limits');
const { EnergyWalletModule } = require('../ui/ems/modules/energy-wallet');
const { normalizeRows } = require('../ui/ems/services/tariff-provider-registry');
async function fixture(t) {
  const namespace = 'eos-admin.0';
  const full = id => id.startsWith(`${namespace}.`) ? id : `${namespace}.${id}`;
  const states = new Map(); const objects = new Map(); const logs = [];
  let dp; let blockClear = false; let release;
  const blocked = new Promise(resolve => { release = resolve; });
  t.after(() => release());
  const adapter = {
    namespace, instance: 0, stateCache: {},
    config: { vis: { instance: namespace }, tariffProvider: { enabled: true, providerId: 'tibber', sourceId: 'tibber', timeZone: 'UTC',
      activateTariffLogic: false, automaticMode: false, maxStaleMinutes: 180 },
    datapoints: { priceCurrent: full('tariffProvider.currentPriceEurPerKwh'),
      priceAverage: full('tariffProvider.averagePriceEurPerKwh'),
      priceTodayJson: full('tariffProvider.pricesTodayJson'), priceTomorrowJson: full('tariffProvider.pricesTomorrowJson') } },
    log: Object.fromEntries(['info', 'warn', 'debug', 'error'].map(level => [level, message => logs.push({ level, message })])),
    keyFromId: id => id.startsWith(`${namespace}.`) ? id.slice(namespace.length + 1) : '',
    updateValue(key, value, ts) { this.stateCache[key] = { value, ts }; },
    async setObjectNotExistsAsync(id, obj) { if (!objects.has(full(id))) objects.set(full(id), { ...obj, _id: full(id) }); },
    async getForeignObjectAsync(id) { return objects.get(id) || null; },
    async getForeignStateAsync(id) { return states.get(id) || null; },
    async getStateAsync(id) { return states.get(full(id)) || null; },
    async subscribeForeignStatesAsync() {},
    async setStateAsync(id, input, ack) {
      const value = input && typeof input === 'object' && Object.hasOwn(input, 'val') ? input : { val: input, ack };
      if (blockClear && id === 'tariffProvider.currentPriceEurPerKwh' && value.val === null) await blocked;
      const state = { ...value, ts: Date.now(), lc: Date.now() };
      states.set(full(id), state); this.stateCache[this.keyFromId(full(id))] = { value: state.val, ts: state.ts }; dp?.handleStateChange(full(id), state);
    },
    async setForeignStateAsync() { throw new Error('physical or foreign setting writes are not authorized in this test'); },
  };
  dp = new DatapointRegistry(adapter, []);
  await dp.upsert({ key: 'priceCurrent', objectId: adapter.config.datapoints.priceCurrent });
  await dp.upsert({ key: 'priceAverage', objectId: adapter.config.datapoints.priceAverage });
  const provider = new TariffProviderModule(adapter, dp);
  const consumer = new TarifVisModule(adapter, dp);
  await provider.init(); await consumer.init();
  await adapter.setStateAsync('settings.dynamicTariff', { val: true, ack: true });
  await adapter.setStateAsync('settings.tariffMode', { val: 2, ack: true });
  await adapter.setStateAsync('settings.price', { val: 0.30, ack: true });
  return { adapter, provider, consumer, dp, states, full, logs,
    delayClear() { blockClear = true; return release; } };
}


test('actual provider publication → TarifVis → CoreLimits → Wallet keeps EUR/kWh including high, zero and negative prices', async t => {
  const { adapter, provider, consumer, states, full, logs } = await fixture(t);
  const core = new CoreLimitsModule(adapter, null); const wallet = new EnergyWalletModule(adapter, null);
  for (const price of [3.25, 0, -0.24, 8.5, -3.25]) {
    const now = Date.now();
    provider._intervals = normalizeRows([{ startsAt: new Date(now - 60_000).toISOString(),
      endsAt: new Date(now + 900_000).toISOString(), total: price, currency: 'EUR' }], { unit: 'EUR/kWh', source: 'tibber' });
    provider._lastSuccessMs = now;
    await provider._publish(provider._cfg(), now, 'ok');
    await consumer.tick();
    assert.equal(states.get(full('tarif.preisAktuellEurProKwh'))?.val, price, JSON.stringify(logs));
    assert.equal(states.get(full('tarif.preisDurchschnittEurProKwh'))?.val, price);
    assert.equal(states.get(full('tarif.currentPriceFresh'))?.val, true);
    await core.tick();
    assert.equal(states.get(full('ems.budget.tariff.currentPriceEurKwh'))?.val, price);
    assert.equal(wallet._prices().gridImportEurPerKwh, price);
    assert.equal(wallet._prices().dynamicTariffAvailable, true);
  }
});

test('structured EUR curves keep their prices while untyped legacy cents and explicit units retain their conversions', () => {
  const consumer = new TarifVisModule({ namespace: 'eos-admin.0', config: {} }, null);
  const row = { startsAt: '2026-11-24T12:00:00Z', endsAt: '2026-11-24T12:15:00Z', total: 3.25, currency: 'EUR', source: 'tibber' };
  assert.equal(consumer._parsePriceCurve([row])[0].priceEurKwh, 3.25);
  assert.equal(consumer._parsePriceCurve([{ ...row, total: -3.25 }])[0].priceEurKwh, -3.25);
  assert.equal(consumer._parsePriceCurve([{ ...row, total: 325, unit: 'ct/kWh' }])[0].priceEurKwh, 3.25);
  assert.equal(consumer._parsePriceCurve([{ startsAt: row.startsAt, endsAt: row.endsAt, total: 32.5 }])[0].priceEurKwh, 0.325);
  assert.equal(consumer._normalizePriceEurPerKwh('31,5'), 0.315);
  assert.equal(consumer._normalizePriceEurPerKwh(3250, null, 'EUR/MWh'), 3.25);
  for (const value of [false, true, null, undefined, '', [], {}]) assert.equal(consumer._normalizePriceEurPerKwh(value), null);
});

test('actual manual mapping preserves cent conversion and supports explicit EUR unit without changing freshness', async t => {
  const { adapter, consumer, dp, objects, states, full } = await fixture(t);
  for (const [unit, value, expected] of [['ct/kWh', 325, 3.25], ['EUR/kWh', 3.25, 3.25], ['', 32.5, 0.325]]) {
    const id = `manual.0.price-${unit || 'legacy'}`;
    adapter.config.datapoints.priceCurrent = id;
    // Explicit configured units are a supported manual mapping contract.
    adapter.config.units = { priceCurrent: unit };
    await dp.upsert({ key: 'tarif.preisAktuellEurProKwh', objectId: id });
    dp.handleStateChange(id, { val: value, ts: Date.now(), ack: true });
    await consumer.tick();
    assert.equal(states.get(full('tarif.preisAktuellEurProKwh'))?.val, expected);
    assert.equal(states.get(full('tarif.currentPriceFresh'))?.val, true);
    dp.handleStateChange(id, { val: value, ts: Date.now() - 86400000, ack: true });
    await consumer.tick();
    assert.equal(states.get(full('tarif.currentPriceFresh'))?.val, false);
  }
});
