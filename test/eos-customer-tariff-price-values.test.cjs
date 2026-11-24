'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EnergyWalletModule } = require('../ui/ems/modules/energy-wallet');
const { CoreLimitsModule } = require('../ui/ems/modules/core-limits');
const { tariffPriceNumber, readTariffPriceState, tariffDisplayConfig } = require('../ui/lib/tariff-price');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const budgetKey = 'ems.budget.tariff.currentPriceEurKwh';
const directKey = 'tarif.preisAktuellEurProKwh';
const now = Date.now();
const sample = (value, age = 0) => ({ value, ts: now - age });
function wallet(extra = {}, config = {}) {
  return new EnergyWalletModule({ namespace: 'eos-admin.0', config, stateCache: {
    'settings.dynamicTariff': sample(true), 'settings.energyWalletFixedImportEurPerKwh': sample(0.35), ...extra,
  }, log: { warn() {}, debug() {} } }, null);
}

test('strict price reader rejects missing/status data and preserves genuine zero and negative prices', async () => {
  for (const value of [null, undefined, '', ' ', false, true, [], {}, NaN, Infinity]) {
    assert.equal(tariffPriceNumber(value), null);
    assert.equal(await readTariffPriceState({ getStateAsync: async () => ({ val: value }) }, 'price'), null);
  }
  for (const value of [0, '0', -0.24, '-0.24', 0.2531]) assert.equal(tariffPriceNumber(value), Number(value));
  assert.equal(await readTariffPriceState({ getStateAsync: async () => ({ val: 0.4, q: 64 }) }, 'price'), null);
  assert.equal(await readTariffPriceState({ getStateAsync: async () => { throw new Error('db'); } }, 'price'), null);
});

test('wallet skips null, status and stale budget candidates in favour of the real fresh canonical price', () => {
  for (const value of [null, undefined, '', ' ', false, true]) {
    const prices = wallet({ [budgetKey]: sample(value), [directKey]: sample(0.2531) })._prices();
    assert.equal(prices.gridImportEurPerKwh, 0.2531);
    assert.equal(prices.currentDynamicPriceSource, directKey);
    assert.equal(prices.dynamicTariffAvailable, true);
  }
  const stale = wallet({ [budgetKey]: sample(0.9, 8000000), [directKey]: sample(-0.12) })._prices();
  assert.equal(stale.gridImportEurPerKwh, -0.12); assert.equal(stale.currentDynamicPriceSource, directKey);
  const knownEur = wallet({ [directKey]: sample(3.25) })._prices();
  assert.equal(knownEur.gridImportEurPerKwh, 3.25, 'known EUR/kWh canonical prices never use a magnitude-based cents heuristic');
});

test('wallet missing, invalid timestamp and stale-only tariffs use the configured fixed fallback; real zero remains dynamic', () => {
  for (const extra of [{}, { [directKey]: sample(null) }, { [directKey]: { value: 0.2 } }, { [directKey]: 0.2 },
    { [directKey]: sample(0.2, 8000000) }, { [directKey]: { value: 0.2, ts: now + 86400000 } }]) {
    const prices = wallet(extra)._prices(); assert.equal(prices.gridImportEurPerKwh, 0.35);
    assert.equal(prices.dynamicTariffAvailable, false); assert.ok(prices.dynamicTariffWarning);
  }
  const zero = wallet({ [directKey]: sample(0) })._prices(); assert.equal(zero.gridImportEurPerKwh, 0); assert.equal(zero.dynamicTariffAvailable, true);
});

test('real CoreLimits tick keeps missing tariff prices null and respects explicit stale flag without changing physical limits', async t => {
  const h = await createHarness(); t.after(() => h.close()); const a = h.adapter;
  a.config = { installerConfig: { gridConnectionPower: 15000 }, settings: {}, chargingManagement: {}, storage: {} };
  const module = new CoreLimitsModule(a, null);
  for (const val of [null, undefined, '', false, true, 0, -0.2, 0.2531]) {
    h.states.set(`eos-admin.0.${directKey}`, { val, ts: Date.now(), ack: true });
    await module.tick();
    assert.equal(h.states.get(`eos-admin.0.${budgetKey}`).val, tariffPriceNumber(val));
    assert.equal(a._emsCaps.grid.gridImportLimitW_physical, 15000);
  }
  h.states.set('eos-admin.0.tarif.currentPriceFresh', { val: false, ts: Date.now(), ack: true });
  await module.tick(); assert.equal(h.states.get(`eos-admin.0.${budgetKey}`).val, null);
});

test('customer /config only exposes source kinds and safe price units, with no object IDs or credentials', async t => {
  const h = await createHarness(); t.after(() => h.close());
  h.adapter.config.datapoints = { priceCurrent: 'eos-admin.0.tariffProvider.currentPriceEurPerKwh', priceAverage: 'alias.0.secret.average' };
  h.adapter.config.units = { priceAverage: 'ct/kWh' };
  const token = await h.login('customer'); const res = await h.request('/config', { token });
  assert.equal(res.status, 200);
  assert.deepEqual(res.data.tariffDisplay, { currentSource: 'provider', averageSource: 'mapped', currentUnit: 'EUR/kWh', averageUnit: 'ct/kWh' });
  assert.equal(res.text.includes('alias.0.secret.average'), false);
  assert.equal(res.text.includes('eos-admin.0.tariffProvider.currentPriceEurPerKwh'), false);
  assert.equal(tariffDisplayConfig({}, 'eos-admin.0').currentSource, 'none');
});

test('explicit customer Tibber save replaces legacy hourly resolution and retains credentials and unrelated settings', async t => {
  const h = await createHarness(); t.after(() => h.close()); const a = h.adapter;
  const original = { tariffProvider: { enabled: true, providerId: 'tibber', sourceId: 'tibber', resolutionMinutes: 60,
    credentials: { accessToken: 'fixture-secret-kept' }, homeId: 'home', country: 'DE', activateTariffLogic: false, automaticMode: false, autoCoupleDatapoints: false,
    refreshMinutes: 45, maxStaleMinutes: 120, formula: { supplierMarkupEurPerKwh: 0.04 } },
    settingsConfig: { evcsList: [{ name: 'Existing', enabled: false, maxCurrentA: 13 }] }, settings: { dynamicTariff: false, price: 0.35 } };
  a.config = { ...a.config, ...structuredClone(original) }; a._nwInstallerConfigPatch = structuredClone(original); a._nwInstallerConfigRawPatch = structuredClone(original);
  a._hostedStartup = { state: 'ready' }; a.persistInstallerConfigToState = Object.getPrototypeOf(a).persistInstallerConfigToState;
  await a.persistInstallerConfigToState(original); a.subscribeConfiguredStates = async () => {};
  const token = await h.login('customer'); const view = await h.request('/api/customer/tariff-provider', { token });
  const res = await h.request('/api/customer/tariff-provider', { token, method: 'PUT', body: { expectedRevision: view.data.revision, config: { homeId: 'changed-home', credentials: { accessToken: '' } } } });
  assert.equal(res.status, 200, res.text);
  const saved = JSON.parse(h.states.get('eos-admin.0.installer.configJson').val);
  assert.equal(saved.tariffProvider.resolutionMinutes, 15); assert.equal(saved.tariffProvider.credentials.accessToken, 'fixture-secret-kept');
  assert.equal(saved.tariffProvider.refreshMinutes, 45); assert.equal(saved.tariffProvider.formula.supplierMarkupEurPerKwh, 0.04);
  assert.deepEqual(saved.settings, original.settings); assert.deepEqual(saved.settingsConfig, original.settingsConfig);
  assert.equal(res.text.includes('fixture-secret-kept'), false);
});
