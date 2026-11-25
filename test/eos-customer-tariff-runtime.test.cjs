'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const registry = require('../ui/ems/services/tariff-provider-registry');
const { DatapointRegistry } = require('../ui/ems/datapoints');

const fields = [
  ['tarif.preisAktuellEurProKwh', 'currentPriceEurPerKwh', 'number'],
  ['tarif.preisDurchschnittEurProKwh', 'averagePriceEurPerKwh', 'number'],
  ['tarif.pricesTodayJson', 'pricesTodayJson', 'string'],
  ['tarif.pricesTomorrowJson', 'pricesTomorrowJson', 'string'],
];
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function result(price) { const now = Date.now(); return { intervals: [{ startsAt: new Date(now - 60000).toISOString(),
  endsAt: new Date(now + 3600000).toISOString(), total: price, quality: 'provider-all-in' }] }; }

// Positive-result assertions await the separate background fetch; tick itself must remain local.
async function settledTick(mod) { await mod.tick(); await mod._fetchPromise; }

async function fixture(t) {
  let fetch = async () => result(0.23);
  let beforeWrite = async () => {};
  const calls = [], writes = [], states = new Map(), stateCache = {};
  const filename = path.join(__dirname, '../ui/src-ts/runtime-executables/ems/modules/tariff-provider.ts');
  const generatedRequire = createRequire(path.join(__dirname, '../ui/ems/modules/tariff-provider.js'));
  const moduleObject = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module: moduleObject, exports: moduleObject.exports,
    require: id => id === '../services/tariff-provider-registry' ? { ...registry, fetchProvider: cfg => {
      calls.push(cfg); return fetch(cfg);
    } } : generatedRequire(id), Date, Math, Number, String, Object, Array, JSON, Promise, Map, Set, Intl, AbortController,
  }, { filename });
  const adapter = {
    namespace: 'eos-admin.0', config: { tariffProvider: { enabled: true, providerId: 'entsoe', sourceId: 'entsoe',
      maxStaleMinutes: 30, timeZone: 'UTC', activateTariffLogic: false, credentials: { apiToken: 'fixture-token-A' } } },
    stateCache, log: { warn() {}, debug() {} }, async setObjectNotExistsAsync() {},
    async subscribeForeignStatesAsync() {}, async getForeignObjectAsync() { return null; },
    async getForeignStateAsync(id) { return states.get(id) || null; },
    keyFromId(id) { return fields.find(row => id === `eos-admin.0.tariffProvider.${row[1]}`)?.[0]; },
    updateValue(key, value, ts) { stateCache[key] = { value, ts }; },
    async setStateAsync(id, state) {
      await beforeWrite(id, state);
      const fullId = `eos-admin.0.${id}`;
      const stored = { ...state, ts: Date.now(), lc: Date.now() };
      states.set(fullId, stored); writes.push([id, state.val]);
      dp.handleStateChange(fullId, stored);
      const key = adapter.keyFromId(fullId);
      if (key) adapter.updateValue(key, state.val, stored.ts);
    },
  };
  const dp = new DatapointRegistry(adapter, fields.map(([key, name, type]) => ({ key,
    objectId: `eos-admin.0.tariffProvider.${name}`, dataType: type, direction: 'in' })));
  await dp.init();
  const mod = new moduleObject.exports.TariffProviderModule(adapter, dp);
  t.after(() => mod.stop());
  return { adapter, dp, mod, states, stateCache, calls, writes,
    fetch: fn => { fetch = fn; }, beforeWrite: fn => { beforeWrite = fn; },
    price: () => states.get('eos-admin.0.tariffProvider.currentPriceEurPerKwh')?.val,
    change: patch => { adapter.config.tariffProvider = { ...adapter.config.tariffProvider, ...patch }; return mod.invalidateConfiguration(); },
  };
}

test('provider switch invalidates actual EMS numbers and curves before new provider metadata', async t => {
  const x = await fixture(t); await settledTick(x.mod);
  assert.equal(x.dp.getNumberFresh(fields[0][0], 60000, null), 0.23);
  assert.notEqual(x.dp.getRaw(fields[2][0]), '[]');
  x.writes.length = 0;
  const switched = x.change({ providerId: 'energyzero', sourceId: 'energyzero' });
  assert.equal(x.dp.getNumberFresh(fields[0][0], 60000, null), null);
  assert.equal(x.dp.getNumberFresh(fields[1][0], 60000, null), null);
  assert.equal(x.dp.getRaw(fields[2][0]), null);
  assert.equal(x.dp.getRaw(fields[3][0]), null);
  assert.equal(x.stateCache[fields[0][0]].value, null);
  assert.equal(x.adapter._tariffProviderSnapshot.fresh, false);
  await switched;
  assert.equal(x.price(), null);
  const label = x.writes.findIndex(([id, value]) => id === 'tariffProvider.providerId' && value === 'energyzero');
  for (const [, name, type] of fields) assert(x.writes.findIndex(([id, value]) => id === `tariffProvider.${name}`
    && value === (type === 'number' ? null : '[]')) < label);
  x.fetch(async () => result(0.41)); await settledTick(x.mod);
  assert.equal(x.price(), 0.41);
  assert.equal(x.dp.getNumberFresh(fields[0][0], 60000, null), 0.41);
});

test('late old-provider reply cannot repopulate price, success, retry timer or provider label', async t => {
  const x = await fixture(t); const late = deferred(); const started = deferred();
  x.fetch(() => { started.resolve(); return late.promise; });
  const tick = x.mod.tick(); await started.promise;
  await x.change({ providerId: 'energyzero', sourceId: 'energyzero' });
  x.writes.length = 0;
  late.resolve(result(0.01)); await tick; await x.mod._fetchPromise;
  assert.equal(x.price(), null); assert.equal(x.mod._lastSuccessMs, 0); assert.equal(x.mod._nextFetchMs, 0);
  assert.equal(x.writes.some(([id, value]) => id === 'tariffProvider.providerId' && value === 'entsoe'), false);
  assert.equal(x.writes.some(([, value]) => value === 0.01), false);
  x.fetch(async () => result(0.36)); await settledTick(x.mod);
  assert.equal(x.price(), 0.36); assert.equal(x.calls.at(-1).providerId, 'energyzero');
});

test('credential change fences failed old fetch and new provider failure never reuses prior forecast', async t => {
  const x = await fixture(t); await settledTick(x.mod); const late = deferred();
  x.fetch(() => late.promise);
  const fetching = x.mod._refresh(x.mod._configuration, Date.now());
  await x.change({ credentials: { apiToken: 'fixture-token-B' } });
  late.reject(new Error('old provider failure')); await fetching;
  assert.equal(x.mod._lastError, ''); assert.equal(x.mod._consecutiveErrors, 0);
  x.fetch(async () => { throw new Error('provider_unavailable'); }); await settledTick(x.mod);
  assert.equal(x.price(), null); assert.equal(x.dp.getNumberFresh(fields[0][0], 60000, null), null);
  assert.equal(x.dp.getRaw(fields[2][0]), '[]');
  assert.equal(x.adapter._tariffProviderSnapshot.fresh, false);
  assert.equal(JSON.stringify(x.adapter._tariffProviderSnapshot).includes('fixture-token'), false);
});

test('configuration clearing waits behind an old in-flight state write and finishes with unavailable prices', async t => {
  const x = await fixture(t); const release = deferred(); const writing = deferred();
  const clearing = deferred(); const finishClearing = deferred();
  let blocked = false;
  x.beforeWrite(async (id, state) => {
    if (!blocked && id === 'tariffProvider.currentPriceEurPerKwh' && state.val === 0.23) {
      blocked = true; writing.resolve(); await release.promise;
    }
    if (blocked && id === 'tariffProvider.currentPriceEurPerKwh' && state.val === null) {
      clearing.resolve(); await finishClearing.promise;
    }
  });
  const tick = x.mod.tick(); await writing.promise;
  const changed = x.change({ providerId: 'energyzero', sourceId: 'energyzero' });
  release.resolve(); await clearing.promise;
  assert.equal(x.dp.cacheByObjectId.get('eos-admin.0.tariffProvider.currentPriceEurPerKwh').val, 0.23);
  assert.equal(x.dp.getNumberFresh(fields[0][0], 60000, null), null, 'late old event is quarantined during invalidation');
  assert.equal(x.dp.getRaw(fields[2][0]), null);
  finishClearing.resolve(); await Promise.all([tick, changed, x.mod._fetchPromise]);
  assert.equal(x.price(), null); assert.equal(x.dp.getNumberFresh(fields[0][0], 60000, null), null);
  assert.equal(x.adapter._tariffProviderSnapshot.providerId, 'energyzero');
  assert.equal(x.states.get('eos-admin.0.tariffProvider.lastSuccess').val, 0);
});

test('failed clearing rejects the save hook, retains pending fence, and retries before a new fetch', async t => {
  const x = await fixture(t); await settledTick(x.mod);
  x.beforeWrite(async () => { throw new Error('DB unavailable'); });
  await assert.rejects(x.change({ providerId: 'energyzero', sourceId: 'energyzero' }), /TARIFF_STATE_WRITE_FAILED/);
  assert.equal(x.mod._invalidationPending, true);
  assert.equal(x.dp.getNumberFresh(fields[0][0], 60000, null), null);
  await assert.rejects(x.mod.tick(), /TARIFF_STATE_WRITE_FAILED/);
  assert.equal(x.calls.length, 1);
  x.beforeWrite(async () => {}); x.fetch(async () => result(0.39)); await settledTick(x.mod);
  assert.equal(x.mod._invalidationPending, false); assert.equal(x.price(), 0.39);
});

test('equivalent config and unchanged ticks retain cache and fetch schedule without repeatedly hashing secrets', async t => {
  const x = await fixture(t); await settledTick(x.mod); const next = x.mod._nextFetchMs, generation = x.mod._generation;
  const cfg = x.adapter.config.tariffProvider;
  x.adapter.config.tariffProvider = Object.fromEntries(Object.entries(cfg).reverse());
  assert.equal(await x.mod.invalidateConfiguration(), false);
  let captures = 0; const original = x.mod._captureConfiguration;
  x.mod._captureConfiguration = function () { captures++; return original.call(this); };
  await settledTick(x.mod); await settledTick(x.mod);
  assert.equal(captures, 0); assert.equal(x.calls.length, 1);
  assert.equal(x.mod._generation, generation); assert.equal(x.mod._nextFetchMs, next); assert.equal(x.price(), 0.23);
});

test('disable and stop prevent an outstanding provider response from publishing again', async t => {
  const x = await fixture(t); const late = deferred(); const started = deferred();
  x.fetch(() => { started.resolve(); return late.promise; });
  const tick = x.mod.tick(); await started.promise; await x.change({ enabled: false });
  x.mod.stop(); const writes = x.writes.length; late.resolve(result(0.04)); await tick; await x.mod._fetchPromise;
  assert.equal(x.writes.length, writes); assert.equal(x.price(), null);
});

test('live source rebind drops all six old readers before awaits, resets conversion and preserves shared sources', async t => {
  const x = await fixture(t); await settledTick(x.mod);
  const six = [...fields, ['priceCurrent', 'currentPriceEurPerKwh', 'number'], ['priceAverage', 'averagePriceEurPerKwh', 'number']];
  for (const [key, name, type] of six) {
    x.dp.remove(key);
    x.states.set(`manual.0.${name}`, { val: type === 'number' ? 23 : '[{"price":0.23}]', ts: Date.now(), ack: true });
    await x.dp.upsert({ key, objectId: `manual.0.${name}`, dataType: type, scale: 0.01 });
  }
  await x.dp.upsert({ key: 'shared.customer.reader', objectId: 'manual.0.currentPriceEurPerKwh' });
  x.adapter.config.datapoints = { priceCurrent: 'eos-admin.0.tariffProvider.currentPriceEurPerKwh',
    priceAverage: 'eos-admin.0.tariffProvider.averagePriceEurPerKwh', priceTodayJson: 'eos-admin.0.tariffProvider.pricesTodayJson',
    priceTomorrowJson: 'eos-admin.0.tariffProvider.pricesTomorrowJson' };
  for (const [, name, type] of fields) x.states.set(`eos-admin.0.tariffProvider.${name}`,
    { val: type === 'number' ? 0.38 : '[]', ts: Date.now(), ack: true });
  const release = deferred(); const upsert = x.dp.upsert.bind(x.dp); let first = true;
  x.dp.upsert = async entry => { if (first) { first = false; await release.promise; } return upsert(entry); };
  const pending = x.mod.applyTariffMappings();
  for (const [key] of six) assert.equal(x.dp.getEntry(key), null);
  assert.equal(x.dp.getNumberFresh('shared.customer.reader', 60000, null), 23);
  release.resolve(); await pending;
  assert.equal(x.dp.getNumberFresh('priceCurrent', 60000, null), 0.38);
  assert.equal(x.dp.getNumberFresh(fields[0][0], 60000, null), 0.38);
  assert.equal(x.dp.getEntry('priceCurrent').scale, 1);
  assert.equal(x.dp.getEntry(fields[0][0]).objectId, x.adapter.config.datapoints.priceCurrent);
  x.adapter.config.datapoints = {};
  await x.mod.applyTariffMappings();
  for (const [key] of six) assert.equal(x.dp.getEntry(key), null);
  assert.equal(x.dp.getNumberFresh('shared.customer.reader', 60000, null), 23);
});

test('removing a tariff mapping fences a delayed old prime without affecting replacement mapping', async t => {
  const x = await fixture(t); const started = deferred(); const release = deferred();
  const original = x.adapter.getForeignStateAsync;
  x.adapter.getForeignStateAsync = async id => {
    if (id === 'manual.0.old') { started.resolve(); await release.promise; return { val: 0.01, ts: Date.now(), ack: true }; }
    return original(id);
  };
  const pending = x.dp.upsert({ key: 'priceCurrent', objectId: 'manual.0.old' }); await started.promise;
  assert.equal(x.dp.remove('priceCurrent'), true);
  x.states.set('manual.0.new', { val: 0.42, ts: Date.now(), ack: true });
  await x.dp.upsert({ key: 'priceCurrent', objectId: 'manual.0.new' });
  release.resolve(); await pending;
  assert.equal(x.dp.getNumberFresh('priceCurrent', 60000, null), 0.42);
  assert.equal(x.dp.cacheByObjectId.has('manual.0.old'), false);
});
