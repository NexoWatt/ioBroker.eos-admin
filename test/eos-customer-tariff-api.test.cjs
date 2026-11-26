'use strict';
// Real hosted HTTP boundary and protected config persistence; no external tariff
// server, controller daemon or physical energy device is contacted.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const { DatapointRegistry } = require('../ui/ems/datapoints');
const { TariffProviderModule } = require('../ui/ems/modules/tariff-provider');

const route = '/api/customer/tariff-provider';
const tokenCanary = 'fixture-tibber-secret-never-return';
const archiveCanary = 'fixture-retained-secret-never-return';
const oldEntsoeCanary = 'fixture-old-entsoe-secret-never-reuse';

async function fixture(t) {
  const h = await createHarness();
  t.after(() => h.close());
  const config = {
    tariffProvider: { enabled: true, providerId: 'tibber', sourceId: 'tibber', providerProfileId: 'local-provider',
      country: 'DE', timeZone: 'Europe/Berlin', homeId: 'customer-home', priceComponent: 'total',
      activateTariffLogic: false, automaticMode: false, autoCoupleDatapoints: false,
      resolutionMinutes: 15, refreshMinutes: 45, maxStaleMinutes: 120,
      credentials: { accessToken: tokenCanary, securityToken: oldEntsoeCanary },
      retainedProviderCredentials: { previous: { accessToken: archiveCanary } },
      formula: { marketMultiplier: 1, supplierMarkupEurPerKwh: 0.04, taxEurPerKwh: 0.02,
        gridVariableEurPerKwh: 0.05, otherVariableEurPerKwh: 0, vatPct: 19, priceIncludesVat: true } },
    datapoints: { priceCurrent: 'alias.0.manual.current', priceAverage: 'alias.0.manual.average',
      priceTodayJson: 'alias.0.manual.today', priceTomorrowJson: 'alias.0.manual.tomorrow', gridPointPower: 'alias.0.grid.power' },
    settingsConfig: { evcsCount: 1, evcsList: [{ name: 'Kundenwallbox', enabled: false, powerId: 'alias.0.car.power', maxCurrentA: 13 }] },
    storage: { enabled: false, datapoints: { socObjectId: 'alias.0.storage.soc' }, customerLimit: 2500 },
    emsApps: { tariff: { installed: false, enabled: false }, chargingManagement: { installed: true, enabled: false } },
    settings: { dynamicTariff: false, tariffMode: 0, price: 0.32 },
  };
  h.adapter.config = { ...h.adapter.config, ...structuredClone(config) };
  h.adapter._nwInstallerConfigPatch = structuredClone(config);
  h.adapter._nwInstallerConfigRawPatch = structuredClone(config);
  h.adapter._hostedStartup = { state: 'ready' };
  h.adapter._nwInstallerConfigHydrated = true;
  h.adapter.persistInstallerConfigToState = Object.getPrototypeOf(h.adapter).persistInstallerConfigToState;
  await h.adapter.persistInstallerConfigToState(config);
  const invalidations = [];
  h.owner.subscribeForeignStates = () => {};
  h.owner.unsubscribeForeignStates = () => {};
  const dp = new DatapointRegistry(h.adapter, []);
  const tariffReaders = { priceCurrent: ['priceCurrent', 'tarif.preisAktuellEurProKwh'],
    priceAverage: ['priceAverage', 'tarif.preisDurchschnittEurProKwh'],
    priceTodayJson: ['tarif.pricesTodayJson'], priceTomorrowJson: ['tarif.pricesTomorrowJson'] };
  for (const [field, keys] of Object.entries(tariffReaders)) {
    for (const key of keys) await dp.upsert({ key, objectId: config.datapoints[field], direction: 'in' });
  }
  const provider = new TariffProviderModule(h.adapter, dp);
  await provider.init();
  const invalidate = provider.invalidateConfiguration.bind(provider);
  provider.invalidateConfiguration = (...args) => {
    invalidations.push(structuredClone(h.adapter.config.tariffProvider));
    return invalidate(...args);
  };
  h.adapter.emsEngine = { dp, mm: { modules: [{ key: 'tariffProvider', instance: provider }] } };
  h.adapter.subscribeConfiguredStates = async () => {};
  h.adapter.scheduleDerivedFlowUpdate = () => {};
  const customer = await h.login('customer');
  const stored = () => JSON.parse(h.states.get('eos-admin.0.installer.configJson').val);
  const get = async token => h.request(route, { token: token || customer });
  const put = async (config, revision, options = {}) => h.request(route, {
    token: customer, method: 'PUT', body: { expectedRevision: revision, config }, ...options,
  });
  return { ...h, customer, stored, get, put, initial: config, invalidations, dp, tariffReaders };
}

function noSecrets(response) {
  for (const secret of [tokenCanary, archiveCanary, oldEntsoeCanary]) assert.equal(response.text.includes(secret), false);
  assert.equal(response.text.includes('retainedProviderCredentials'), false);
}

test('an unrelated tariff save preserves unchanged ambiguous legacy points while real point changes retain identity guards', async t => {
  const x = await fixture(t);
  const rows = [
    { enabled: false, name: 'Legacy A', powerId: 'fixture.shared.power', setPowerWId: 'fixture.shared.target' },
    { enabled: false, name: 'Legacy B', powerId: 'fixture.shared.power', setPowerWId: 'fixture.shared.target' },
  ];
  x.adapter.config.settingsConfig = { evcsCount: 2, evcsList: structuredClone(rows) };
  x.adapter._nwInstallerConfigPatch.settingsConfig = structuredClone(x.adapter.config.settingsConfig);
  x.adapter.config.settingsConfig.evcsList[0].controlMappingAutoResolved = true;
  const view = await x.get();
  assert.equal(view.status, 200, view.text);
  const saved = await x.put({ homeId: 'updated-customer-home' }, view.data.revision);
  assert.equal(saved.status, 200, saved.text);
  assert.equal(x.stored().tariffProvider.homeId, 'updated-customer-home');
  assert.equal(x.stored().tariffProvider.credentials.accessToken, tokenCanary);
  assert.deepEqual(x.stored().settingsConfig.evcsList, rows);
  noSecrets(saved);
  const durableBefore = structuredClone(x.stored());
  const changed = structuredClone(x.adapter._nwInstallerConfigPatch);
  changed.settingsConfig.evcsList[1].powerId = 'fixture.changed.power';
  await assert.rejects(x.adapter.persistInstallerConfigToState(changed), { code: 'EOS_EVCS_IDENTITY_AMBIGUOUS' });
  assert.deepEqual(x.stored(), durableBefore, 'a genuine layout mutation remains fenced before persistence');
});

test('customer tariff GET is authenticated, exposes only supported choices and no current or retained secrets', async t => {
  const x = await fixture(t);
  assert.equal((await x.request(route)).status, 401);
  const view = await x.get();
  assert.equal(view.status, 200);
  assert.equal(view.data.scope, 'system');
  assert.equal(view.data.config.providerId, 'tibber');
  assert.equal(view.data.credentialsPresent.accessToken, true);
  assert.ok(typeof view.data.revision === 'string' && view.data.revision.length > 0);
  const ids = view.data.providers.map(row => typeof row === 'string' ? row : row.id);
  assert.deepEqual(ids.slice().sort(), ['manual-dp', 'tibber', 'energyzero', 'entsoe', 'market-profile'].sort());
  assert.match(view.headers.get('cache-control') || '', /no-store/);
  noSecrets(view);
  assert.equal((await x.request('/api/installer/config', { token: x.customer })).status, 403,
    'the customer capability must not open the broader installer API');
  const observer = await x.login('observer');
  assert.ok([401, 403].includes((await x.get(observer)).status), 'unsupported roles cannot open the customer tariff API');
  x.bridge.getLicense = () => ({ valid: true, coreEnabled: true, edition: 'home', features: ['smartHome'] });
  assert.equal((await x.get()).status, 403, 'a customer session cannot bypass the energy feature license');
  assert.equal((await x.put({ homeId: 'unlicensed-edit' }, view.data.revision)).status, 403);
});

test('CSRF, origin and unsupported endpoint or actuator fields cannot change customer tariff settings', async t => {
  const x = await fixture(t); const before = x.stored(); const view = await x.get();
  assert.equal((await x.put({ homeId: 'changed' }, view.data.revision, { csrf: false })).status, 403);
  assert.equal((await x.put({ homeId: 'changed' }, view.data.revision, { headers: { Origin: 'https://untrusted.example' } })).status, 403);
  for (const config of [
    { endpoint: 'https://untrusted.example/steal' },
    { providerId: 'custom-rest', customRest: { url: 'https://untrusted.example' } },
    { tokenUrl: 'https://untrusted.example/oauth' },
    { activateTariffLogic: true },
    { automaticMode: true },
    { autoCoupleDatapoints: true },
    { datapoints: { priceCurrent: 'system.adapter.admin.0.alive' } },
    { emsApps: { chargingManagement: { installed: true, enabled: true } } },
  ]) {
    const answer = await x.put(config, view.data.revision);
    assert.equal(answer.status, 422, JSON.stringify({ config, status: answer.status, response: answer.data }));
    noSecrets(answer);
  }
  assert.deepEqual(x.stored(), before);
  assert.equal(x.invalidations.length, 0);
});

test('partial customer tariff edit preserves blank credentials, manual mappings, EMS apps and customer device values', async t => {
  const x = await fixture(t); const before = x.stored(); const view = await x.get();
  const answer = await x.put({ homeId: 'new-home', credentials: { accessToken: '' },
    formula: { supplierMarkupEurPerKwh: 0.06 } }, view.data.revision);
  assert.equal(answer.status, 200, answer.text); noSecrets(answer);
  const after = x.stored();
  assert.equal(after.tariffProvider.homeId, 'new-home');
  assert.equal(after.tariffProvider.credentials.accessToken, tokenCanary);
  assert.equal(after.tariffProvider.formula.supplierMarkupEurPerKwh, 0.06);
  assert.equal(after.tariffProvider.formula.gridVariableEurPerKwh, 0.05);
  assert.equal(after.tariffProvider.refreshMinutes, 45);
  for (const key of ['datapoints', 'settingsConfig', 'storage', 'emsApps', 'settings']) assert.deepEqual(after[key], before[key], key);
  assert.equal(after.tariffProvider.activateTariffLogic, false);
  assert.equal(after.tariffProvider.automaticMode, false);
  assert.equal(after.tariffProvider.autoCoupleDatapoints, false);
  assert.equal(x.invalidations.length, 1);
});

test('explicit tariff mapping consent changes only four tariff inputs and never enables an app or dispatch', async t => {
  const x = await fixture(t); const before = x.stored(); const view = await x.get();
  const answer = await x.put({ useForTariff: true }, view.data.revision);
  assert.equal(answer.status, 200, answer.text);
  const after = x.stored();
  assert.deepEqual(after.datapoints, { ...before.datapoints,
    priceCurrent: 'eos-admin.0.tariffProvider.currentPriceEurPerKwh',
    priceAverage: 'eos-admin.0.tariffProvider.averagePriceEurPerKwh',
    priceTodayJson: 'eos-admin.0.tariffProvider.pricesTodayJson',
    priceTomorrowJson: 'eos-admin.0.tariffProvider.pricesTomorrowJson' });
  for (const key of ['settingsConfig', 'storage', 'emsApps', 'settings']) assert.deepEqual(after[key], before[key], key);
  assert.equal(after.tariffProvider.activateTariffLogic, false);
  assert.equal(after.tariffProvider.automaticMode, false);
  assert.equal(x.states.has('eos-admin.0.settings.dynamicTariff'), false);
  for (const [field, keys] of Object.entries(x.tariffReaders)) {
    for (const key of keys) assert.equal(x.dp.getEntry(key)?.objectId, after.datapoints[field], key);
  }
  const restored = await x.put({ useForTariff: false }, answer.data.revision);
  assert.equal(restored.status, 200, restored.text);
  assert.deepEqual(x.stored().datapoints, before.datapoints);
  for (const [field, keys] of Object.entries(x.tariffReaders)) {
    for (const key of keys) assert.equal(x.dp.getEntry(key)?.objectId, before.datapoints[field], key);
  }
});

test('provider switch requires fresh source credentials and preserves old credentials without reusing them', async t => {
  const x = await fixture(t); const before = x.stored(); const view = await x.get();
  const denied = await x.put({ providerId: 'entsoe', sourceId: 'entsoe' }, view.data.revision);
  assert.equal(denied.status, 422, denied.text);
  assert.deepEqual(x.stored(), before);
  const fresh = 'fixture-fresh-entsoe-token';
  const accepted = await x.put({ providerId: 'entsoe', sourceId: 'entsoe', credentials: { securityToken: fresh } }, view.data.revision);
  assert.equal(accepted.status, 200, accepted.text);
  const after = x.stored();
  assert.equal(after.tariffProvider.providerId, 'entsoe');
  assert.equal(after.tariffProvider.credentials.securityToken, fresh);
  assert.notEqual(after.tariffProvider.credentials.securityToken, oldEntsoeCanary);
  assert.ok(JSON.stringify(after.tariffProvider).includes(tokenCanary), 'the previous source credential remains recoverable in protected storage');
  assert.deepEqual(after.datapoints, before.datapoints);
  const publicView = await x.get(); noSecrets(publicView);
  assert.equal(publicView.text.includes(fresh), false);
  const profileSwitch = await x.put({ providerId: 'market-profile', sourceId: 'entsoe' }, publicView.data.revision);
  assert.equal(profileSwitch.status, 422, 'a different provider connection must not silently inherit even the same-source token');
  assert.deepEqual(x.stored(), after);
  const explicitProfile = await x.put({ providerId: 'market-profile', sourceId: 'entsoe',
    credentials: { securityToken: 'fixture-explicit-profile-token' } }, publicView.data.revision);
  assert.equal(explicitProfile.status, 200, explicitProfile.text);
  assert.equal(x.stored().tariffProvider.providerId, 'market-profile');
  assert.equal(x.stored().tariffProvider.credentials.securityToken, 'fixture-explicit-profile-token');
  assert.equal(explicitProfile.text.includes('fixture-explicit-profile-token'), false);
});

test('stale customer editor and failed persistence leave confirmed settings unchanged', async t => {
  const x = await fixture(t); const view = await x.get();
  const saved = await x.put({ homeId: 'first-change' }, view.data.revision);
  assert.equal(saved.status, 200, saved.text);
  const confirmed = x.stored();
  const stale = await x.put({ homeId: 'stale-change' }, view.data.revision);
  assert.equal(stale.status, 409, stale.text);
  assert.deepEqual(x.stored(), confirmed);
  const latest = await x.get();
  x.adapter.persistInstallerConfigToState = async () => false;
  const failed = await x.put({ homeId: 'must-not-commit' }, latest.data.revision);
  assert.ok(failed.status >= 500, failed.text);
  assert.deepEqual(x.stored(), confirmed);
  assert.equal(x.adapter.config.tariffProvider.homeId, 'first-change');
});

test('editing or reconnecting a disabled provider preserves its explicit coupling settings; a fresh provider gets no grant', async t => {
  for (const coupling of [true, false]) {
    const x = await fixture(t);
    const source = { ...x.initial.tariffProvider, enabled: false,
      activateTariffLogic: coupling, automaticMode: coupling };
    x.adapter.config.tariffProvider = structuredClone(source);
    x.adapter._nwInstallerConfigPatch.tariffProvider = structuredClone(source);
    x.adapter._nwInstallerConfigRawPatch.tariffProvider = structuredClone(source);
    await x.adapter.persistInstallerConfigToState(x.adapter._nwInstallerConfigPatch);
    const view = await x.get();
    const answer = await x.put({ enabled: true }, view.data.revision);
    assert.equal(answer.status, 200, answer.text);
    assert.equal(x.stored().tariffProvider.activateTariffLogic, coupling);
    assert.equal(x.stored().tariffProvider.automaticMode, coupling);
  }
  const x = await fixture(t);
  x.adapter.config.tariffProvider = {};
  x.adapter._nwInstallerConfigPatch.tariffProvider = {};
  x.adapter._nwInstallerConfigRawPatch.tariffProvider = {};
  await x.adapter.persistInstallerConfigToState(x.adapter._nwInstallerConfigPatch);
  const view = await x.get();
  const answer = await x.put({ enabled: true, providerId: 'energyzero', sourceId: 'energyzero', country: 'NL' }, view.data.revision);
  assert.equal(answer.status, 200, answer.text);
  assert.equal(x.stored().tariffProvider.activateTariffLogic, false);
  assert.equal(x.stored().tariffProvider.automaticMode, false);
  assert.deepEqual(x.stored().datapoints, x.initial.datapoints);
});

test('retained source credentials remain in protected recovery data and are omitted from every installer HTTP view', async t => {
  const x = await fixture(t);
  await x.adapter.nwWriteUserdataBackup(x.stored(), 'qa-private-retention');
  assert.ok(JSON.stringify(await x.adapter.nwReadUserdataBackup()).includes(archiveCanary));
  const installer = await x.login('installer');
  for (const endpoint of ['/api/installer/config', '/api/installer/backup/export', '/api/installer/backup/userdata']) {
    const answer = await x.request(endpoint, { token: installer });
    assert.equal(answer.status, 200, answer.text);
    assert.equal(answer.text.includes('retainedProviderCredentials'), false, endpoint);
    assert.equal(answer.text.includes(archiveCanary), false, endpoint);
  }
  assert.ok(JSON.stringify(x.stored()).includes(archiveCanary));
});


test('unhydrated tariff reads never confirm native defaults; loaded tariffs remain available when unrelated EMS readiness degrades', async t => {
  const x = await fixture(t);
  x.adapter._nwInstallerConfigHydrated = false; x.adapter._hostedStartup = { state: 'starting' };
  const loading = await x.get(); assert.equal(loading.status, 503); assert.equal(loading.data.error, 'EOS_TARIFF_CONFIG_LOADING');
  x.adapter._hostedStartup = { state: 'ready' };
  const unhydratedSave = await x.put({ providerId: 'manual-dp', enabled: false }, x.adapter._nwInstallerConfigRevision());
  assert.equal(unhydratedSave.status, 503); assert.equal(unhydratedSave.data.error, 'EOS_TARIFF_CONFIG_UNAVAILABLE');
  assert.equal(loading.data.config, undefined); assert.match(loading.headers.get('cache-control') || '', /no-store/); noSecrets(loading);
  x.adapter._hostedStartup = { state: 'degraded', error: 'EOS_UI_CONFIG_LOAD_FAILED' };
  const failed = await x.get(); assert.equal(failed.status, 503); assert.equal(failed.data.error, 'EOS_TARIFF_CONFIG_UNAVAILABLE'); assert.equal(failed.data.config, undefined);
  x.adapter._nwInstallerConfigHydrated = true; x.adapter._hostedStartup = { state: 'degraded', error: 'EOS_EMS_INIT_FAILED' };
  const loaded = await x.get(); assert.equal(loaded.status, 200); assert.equal(loaded.data.config.providerId, 'tibber'); noSecrets(loaded);
  assert.equal(x.stored().tariffProvider.providerId, 'tibber');
});
