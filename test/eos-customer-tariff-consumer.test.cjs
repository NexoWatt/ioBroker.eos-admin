'use strict';
// Real provider invalidation, DatapointRegistry and tariff consumer. Database
// delivery is delayed deliberately; there are no provider network requests.
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatapointRegistry } = require('../ui/ems/datapoints');
const { TariffProviderModule } = require('../ui/ems/modules/tariff-provider');
const { TarifVisModule } = require('../ui/ems/modules/tarif-vis');

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
      states.set(full(id), state); dp?.handleStateChange(full(id), state);
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

test('changing tariff provider invalidates old direct and curve inputs before delayed database writes finish', async t => {
  const { adapter, provider, consumer, dp, states, full, logs, delayClear } = await fixture(t);
  const now = Date.now();
  provider._intervals = [{ startsAt: new Date(now - 60_000).toISOString(), endsAt: new Date(now + 900_000).toISOString(),
    total: 0.02, market: 0.01, currency: 'EUR', quality: 'provider-all-in' }];
  provider._lastSuccessMs = now;
  await provider._publish(provider._cfg(), now, 'ok');
  await consumer.tick();
  assert.equal(dp.getNumberFresh('priceCurrent', 120_000, null), 0.02);
  assert.equal(states.get(full('tarif.currentPriceFresh'))?.val, true, JSON.stringify(logs));
  assert.equal(states.get(full('tarif.curveFresh'))?.val, true);

  const release = delayClear();
  adapter.config.tariffProvider = { ...adapter.config.tariffProvider, providerId: 'entsoe', sourceId: 'entsoe' };
  const invalidate = provider.invalidateConfiguration();
  // These checks happen synchronously before controller delivery is released.
  assert.equal(dp.getNumberFresh('priceCurrent', 120_000, null), null);
  assert.equal(dp.getNumberFresh('priceAverage', 120_000, null), null);
  assert.equal(dp.getRaw('tarif.pricesTodayJson') == null, true);
  assert.equal(dp.getRaw('tarif.pricesTomorrowJson') == null, true);
  await consumer.tick();
  assert.equal(states.get(full('tarif.currentPriceFresh'))?.val, false);
  assert.equal(states.get(full('tarif.curveFresh'))?.val, false);
  assert.equal(states.get(full('tarif.speicherPreisGuensig'))?.val, false);
  assert.equal(states.get(full('tarif.netzLadenErlaubt'))?.val, false);
  release(); await invalidate;
  assert.equal(states.get(full('tariffProvider.currentPriceEurPerKwh')).val, null);
  assert.equal(states.get(full('tariffProvider.averagePriceEurPerKwh')).val, null);
  assert.equal(states.get(full('tariffProvider.pricesTodayJson')).val, '[]');
  assert.equal(states.get(full('tariffProvider.pricesTomorrowJson')).val, '[]');
  assert.equal(states.get(full('tariffProvider.providerId')).val, 'entsoe');
});

test('late old-provider database write cannot revive tariff control while replacement clearing is pending', async t => {
  const { adapter, provider, consumer, dp, states, full, delayClear } = await fixture(t);
  let oldWriteStarted; let releaseOldWrite; let clearStarted;
  const writing = new Promise(resolve => { oldWriteStarted = resolve; });
  const oldBlocked = new Promise(resolve => { releaseOldWrite = resolve; });
  const clearing = new Promise(resolve => { clearStarted = resolve; });
  t.after(() => releaseOldWrite());
  const setState = adapter.setStateAsync.bind(adapter);
  adapter.setStateAsync = async (id, state, ack) => {
    if (id === 'tariffProvider.currentPriceEurPerKwh' && state.val === 0.02) {
      oldWriteStarted(); await oldBlocked;
    }
    if (id === 'tariffProvider.currentPriceEurPerKwh' && state.val === null) clearStarted();
    return setState(id, state, ack);
  };
  const now = Date.now();
  provider._intervals = [{ startsAt: new Date(now - 60_000).toISOString(), endsAt: new Date(now + 900_000).toISOString(),
    total: 0.02, currency: 'EUR', quality: 'provider-all-in' }];
  provider._lastSuccessMs = now;
  const oldPublication = provider._publish(provider._cfg(), now, 'ok');
  await writing;
  const releaseClear = delayClear();
  adapter.config.tariffProvider = { ...adapter.config.tariffProvider, providerId: 'entsoe', sourceId: 'entsoe' };
  const invalidation = provider.invalidateConfiguration();
  assert.equal(dp.getNumberFresh('priceCurrent', 120_000, null), null);
  releaseOldWrite();
  await clearing;
  assert.equal(dp.getNumberFresh('priceCurrent', 120_000, null), null,
    'a late old write must not re-prime a control input while new provider clearing is pending');
  await consumer.tick();
  assert.equal(states.get(full('tarif.currentPriceFresh'))?.val, false);
  assert.equal(states.get(full('tarif.speicherPreisGuensig'))?.val, false);
  assert.equal(states.get(full('tarif.netzLadenErlaubt'))?.val, false);
  releaseClear(); await Promise.all([oldPublication, invalidation]);
});
