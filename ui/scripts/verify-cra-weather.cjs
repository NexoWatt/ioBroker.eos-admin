#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft Wettertransport, das gemeinsame 5-s-Budget und JSON-Triage vor ioBroker-States.
 * Daten und Wirkung: Isolierte Transport-/Adapterfixtures, echte kurze Timer, keine Provideranfragen oder echten Zugangsdaten.
 * Bei Änderungen: DNS-/Body-Abbruch, Schemafehler, gültige Nullproduktion und letzten gültigen Stand getrennt prüfen.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { EventEmitter } = require('node:events');
const { performance } = require('node:perf_hooks');
const root = path.resolve(__dirname, '..');
const sourceMode = process.argv.includes('--source');
const filename = path.join(root, sourceMode ? 'src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts' : 'ems/services/open-meteo-pv-forecast.js');
const mainFilename = path.join(root, sourceMode ? 'src-ts/runtime-executables/main.ts' : 'main.js');
const localRequire = createRequire(filename);
const checks = [];
let scenario;
const network = [];
const configuredTimers = [];
let clockOffset = 0;
const fakeHttps = {
  get(url, options, callback) {
    assert.equal(url.protocol, 'https:');
    assert.equal(options.rejectUnauthorized, true);
    assert.equal(options.headers['Accept-Encoding'], 'identity');
    const request = new EventEmitter();
    request.destroyed = false;
    request.destroy = () => { request.destroyed = true; };
    network.push({ url: new URL(url), options, request });
    setImmediate(() => scenario(request, callback));
    return request;
  },
};
let code = fs.readFileSync(filename, 'utf8');
if (sourceMode) code = localRequire('typescript').transpileModule(code, { compilerOptions: { target: 9, module: 1 } }).outputText;
const mod = { exports: {} };
const context = {
  module: mod, exports: mod.exports, URL, Buffer, process, console,
  setTimeout: (fn, ms) => { configuredTimers.push(ms); return setTimeout(fn, ms); }, clearTimeout,
  require: (id) => id === 'node:https' ? fakeHttps : id === 'node:perf_hooks' ? { performance: { now: () => performance.now() + clockOffset } } : localRequire(id),
};
vm.runInNewContext(code + '\nmodule.exports.__testMergePvCurves = mergePvCurves; module.exports.__testAssertCompletePvCurve = assertCompletePvCurve;', context, { filename });
const service = mod.exports;
const url = 'https://api.open-meteo.com/v1/forecast?apikey=TEST_ONLY_MUST_NOT_ESCAPE';
function response(callback, body, status = 200, headers = {}) {
  const res = new EventEmitter();
  res.headers = { 'content-type': 'application/json', ...headers };
  res.statusCode = status;
  res.destroyed = false;
  res.destroy = () => { res.destroyed = true; };
  callback(res);
  if (!res.destroyed && body !== null) { res.emit('data', Buffer.from(body)); res.emit('end'); }
  return res;
}
async function check(name, fn) { await fn(); checks.push(name); }
const fail = (pattern, budget = 50) => assert.rejects(service.requestOpenMeteoJson(url, budget), pattern);
function weatherFixture() {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return { utc_offset_seconds: 0, current: { time: new Date().toISOString().slice(0, 16), temperature_2m: 18.2, weather_code: 0, cloud_cover: 10, wind_speed_10m: 15, is_day: 1 }, daily: {
    time: [today, tomorrow], temperature_2m_min: [12, 11], temperature_2m_max: [21, 22],
    precipitation_probability_max: [5, 15], weather_code: [0, 2],
  } };
}
function pvFixture(value = 600) {
  const start = Math.floor(Date.now() / 900000) * 900000;
  return { minutely_15: { time: Array.from({ length: 26 }, (_, i) => (start + i * 900000) / 1000), global_tilted_irradiance: Array(26).fill(value), temperature_2m: Array(26).fill(20) } };
}
const pvSettings = { horizonHours: 6, arrays: [{ name: 'Testfläche', kwp: 10, tiltDeg: 30, azimuthDeg: 0, lossPercent: 14, inverterLimitW: 10000 }] };
function makeAdapter(handler, previous) {
  const writes = new Map();
  const messages = [];
  const settings = { weatherEnabled: true, openMeteoPvEnabled: true, forecastSourceMode: 'auto', pvForecastInstalledKwp: 10, forecastHorizonHours: 6 };
  const adapter = {
    stateCache: Object.fromEntries(Object.entries(settings).map(([k, value]) => [`settings.${k}`, { value }])),
    _openMeteoPvForecast: previous,
    _nwGetSystemGeo: async () => ({ lat: 51, lon: 7, locName: 'Testanlage' }),
    getForeignObjectAsync: async () => ({ common: { latitude: 51, longitude: 7 } }),
    getStateAsync: async () => null,
    setObjectNotExistsAsync: async () => {},
    setStateAsync: async (id, state) => { writes.set(id, state.val); },
    setTimeout: () => ({ fixture: true }), clearTimeout() {},
    _nwHttpsGetJson: handler,
    log: { debug: value => messages.push(value), warn: value => messages.push(value) },
  };
  return { adapter, writes, messages };
}
async function runPv(handler, previous) {
  const fixture = makeAdapter(handler, previous);
  const runtime = service.startOpenMeteoPvForecastRuntime(fixture.adapter);
  const result = await runtime.refresh();
  runtime.stop();
  return { ...fixture, result };
}

(async () => {
  await check('https-positive-and-max-5000-ms-even-if-caller-requests-longer', async () => {
    scenario = (_, cb) => response(cb, '{"ok":true}');
    const before = configuredTimers.length;
    assert.equal((await service.requestOpenMeteoJson(url, 12000)).ok, true);
    assert.equal(configuredTimers[before], 5000);
  });
  await check('reject-http-userinfo-unknown-host-before-network', async () => {
    const before = network.length;
    for (const invalid of ['http://api.open-meteo.com/', 'https://user:secret@api.open-meteo.com/', 'https://api.open-meteo.com.evil.invalid/', 'https://api.open-meteo.com:444/']) {
      await assert.rejects(service.requestOpenMeteoJson(invalid), /open-meteo-url/);
    }
    assert.equal(network.length, before);
  });
  await check('dns-connect-stall-aborted-by-independent-real-timer', async () => {
    scenario = () => {};
    const start = performance.now();
    await fail(/open-meteo-timeout/, 45);
    assert(performance.now() - start < 500);
    assert.equal(network.at(-1).request.destroyed, true);
  });
  await check('trickling-body-cannot-reset-overall-timeout', async () => {
    let incoming;
    let interval;
    scenario = (_, cb) => { incoming = response(cb, null); interval = setInterval(() => incoming.emit('data', Buffer.from(' ')), 4); };
    try { await fail(/open-meteo-timeout/, 55); } finally { clearInterval(interval); }
    assert.equal(incoming.destroyed, true);
    assert.equal(network.at(-1).request.destroyed, true);
  });
  await check('connection-error-never-exposes-url-or-token', async () => {
    scenario = request => request.emit('error', new Error(url));
    await fail(/^Error: open-meteo-network$/);
  });
  await check('redirect-and-http-error-body-never-exposed', async () => {
    for (const status of [302, 401, 503]) {
      scenario = (_, cb) => response(cb, 'TEST_ONLY_MUST_NOT_ESCAPE', status);
      await fail(new RegExp(`^Error: open-meteo-http-${status}$`));
    }
  });
  await check('declared-and-streamed-response-size-limits', async () => {
    scenario = (_, cb) => response(cb, 'x', 200, { 'content-length': String(1024 * 1024 + 1) });
    await fail(/open-meteo-response-too-large/);
    scenario = (_, cb) => response(cb, 'x'.repeat(1024 * 1024 + 1));
    await fail(/open-meteo-response-too-large/);
  });
  await check('json-content-type-encoding-and-truncated-body', async () => {
    scenario = (_, cb) => response(cb, '{}', 200, { 'content-type': 'text/html' }); await fail(/open-meteo-content-type/);
    scenario = (_, cb) => response(cb, '{}', 200, { 'content-encoding': 'gzip' }); await fail(/open-meteo-encoding/);
    scenario = (_, cb) => response(cb, 'TEST_ONLY_MUST_NOT_ESCAPE'); await fail(/^Error: open-meteo-invalid-json$/);
    scenario = (_, cb) => { const res = response(cb, null); res.emit('aborted'); }; await fail(/open-meteo-aborted/);
    for (const body of ['null', '0', '[]']) { scenario = (_, cb) => response(cb, body); await fail(/open-meteo-invalid-data/); }
  });
  await check('weather-full-schema-rejects-missing-null-string-nan-and-ranges', async () => {
    service.validateOpenMeteoWeather(weatherFixture());
    for (const invalid of [null, undefined, '18.2', Number.NaN, Number.POSITIVE_INFINITY, {}, true, 101]) {
      const data = weatherFixture(); data.current.cloud_cover = invalid;
      assert.throws(() => service.validateOpenMeteoWeather(data), /open-meteo-invalid-data/);
    }
    for (const mutation of [d => d.daily.temperature_2m_min.pop(), d => d.daily.weather_code[1] = '2', d => d.daily.temperature_2m_min[1] = 40, d => delete d.daily.time, d => d.current.time = null, d => d.current.time = '2026-02-30T12:00', d => d.daily.time[0] = '2020-01-01', d => d.utc_offset_seconds = '0']) {
      const data = weatherFixture(); mutation(data); assert.throws(() => service.validateOpenMeteoWeather(data), /open-meteo-invalid-data/);
    }
  });
  await check('weather-invalid-response-never-partially-writes-provider-values', async () => {
    const ts = localRequire('typescript');
    const main = fs.readFileSync(mainFilename, 'utf8');
    const ast = ts.createSourceFile(mainFilename, main, ts.ScriptTarget.Latest, true);
    const wanted = new Set(['nwUpdateWeather', '_nwWeatherTextDe', 'ensureSettingsStates']);
    const methods = [];
    function visit(node) { if (ts.isMethodDeclaration(node) && wanted.has(node.name.getText(ast))) methods.push(node.getText(ast)); ts.forEachChild(node, visit); }
    visit(ast); assert.equal(methods.length, 3);
    const instance = vm.runInNewContext(`new class { ${methods.join('\n')} }()`, { ...service });
    const writes = new Map(); const logs = []; const extended = new Map(); const created = new Map();
    Object.assign(instance, {
      _notifyGetSettingBool: () => true, _notifyGetSettingString: (_, fallback) => fallback,
      _nwHasMappedDatapoint: () => false, _nwGetSystemGeo: async () => ({ lat: 51, lon: 7 }),
      setObjectNotExistsAsync: async (id, object) => created.set(id, object),
      extendObjectAsync: async (id, object) => extended.set(id, object),
      getStateAsync: async () => ({ val: 'existing-credential-fixture' }),
      setStateAsync: async (id, state) => writes.set(id, state.val), log: { debug: x => logs.push(x) },
      _nwHttpsGetJson: async (_, budget) => { assert.equal(budget, 5000); const data = weatherFixture(); data.daily.weather_code[1] = null; return data; },
    });
    await instance.ensureSettingsStates();
    assert.equal(created.get('settings.weatherApiKey').common.read, false);
    assert.equal(extended.get('settings.weatherApiKey').acl.state, 0x600);
    assert.equal(extended.get('settings.weatherApiKey').acl.object, 0x600);
    assert.equal(extended.get('settings.weatherApiKey').acl.owner, 'system.user.admin');
    assert.equal(writes.size, 0, 'Existing credentials are retained without rewriting or exposing values');
    await instance.nwUpdateWeather();
    assert.equal(instance._nwWeatherUpdating, false);
    assert.deepEqual([...writes.keys()].filter(key => key !== 'weatherLocation'), []);
    assert(logs.every(message => !message.includes('TEST_ONLY')));
    instance._nwHttpsGetJson = async () => weatherFixture();
    await instance.nwUpdateWeather(); assert.equal(writes.get('weatherTempC'), 18.2); assert.equal(writes.get('weatherTomorrowCode'), 2);
  });
  await check('pv-strict-series-rejects-malformed-values-and-partial-lengths', async () => {
    for (const invalid of [null, '600', Number.NaN, false, -1, 3000]) {
      const data = pvFixture(); data.minutely_15.global_tilted_irradiance[2] = invalid;
      assert.throws(() => service.buildOpenMeteoTiltedPvCurve([{ array: pvSettings.arrays[0], data }], pvSettings, Date.now()), /open-meteo-invalid-data/);
    }
    const data = pvFixture(); data.minutely_15.temperature_2m.pop();
    assert.throws(() => service.buildOpenMeteoTiltedPvCurve([{ array: pvSettings.arrays[0], data }], pvSettings, Date.now()), /open-meteo-invalid-data/);
    const missingComponents = { hourly: { time: data.minutely_15.time } };
    assert.throws(() => service.buildOpenMeteoPvCurve(missingComponents, pvSettings, { latitude: 51, longitude: 7 }, Date.now()), /open-meteo-invalid-data/);
  });
  await check('valid-night-zero-production-is-distinct-from-invalid-response', async () => {
    const valid = await runPv(async () => pvFixture(0));
    assert.equal(valid.result.valid, true); assert.equal(valid.result.requestStatus, 'ok-zero-production');
    const invalid = await runPv(async () => ({ minutely_15: { time: [], global_tilted_irradiance: [] } }));
    assert.equal(invalid.result.valid, false); assert.equal(invalid.writes.get('forecast.openMeteoPv.valid'), false);
  });
  await check('pv-incomplete-plane-and-mixed-time-grid-cannot-be-published-as-full-forecast', async () => {
    const complete = pvFixture(); const partial = pvFixture();
    for (const key of Object.keys(partial.minutely_15)) partial.minutely_15[key] = partial.minutely_15[key].slice(0, 2);
    assert.throws(() => service.buildOpenMeteoTiltedPvCurve([
      { array: pvSettings.arrays[0], data: complete }, { array: pvSettings.arrays[0], data: partial },
    ], pvSettings, Date.now()), /open-meteo-invalid-data/);
    const irregular = pvFixture(); irregular.minutely_15.time[2] += 2700;
    assert.throws(() => service.buildOpenMeteoTiltedPvCurve([{ array: pvSettings.arrays[0], data: irregular }], pvSettings, Date.now()), /open-meteo-invalid-data/);
    const failed = await runPv(async () => partial);
    assert.equal(failed.result.valid, false);
    const merged = service.__testMergePvCurves([
      [{ t: 1, dtMs: 900000, w: 500 }, { t: 2, dtMs: 900000, w: 500 }],
      [{ t: 2, dtMs: 900000, w: 700 }],
    ]);
    assert.equal(merged.length, 1); assert.equal(merged[0].t, 2); assert.equal(merged[0].w, 1200);
    assert.throws(() => service.__testAssertCompletePvCurve(merged, pvSettings, Date.now()), /open-meteo-invalid-data/);
  });
  await check('failed-refresh-keeps-last-good-timestamp-and-explicit-stale-status', async () => {
    const valid = await runPv(async () => pvFixture());
    valid.result.ts -= 1000; valid.result.lastSuccessAt -= 1000;
    const invalid = await runPv(async () => { throw new Error(url); }, valid.result);
    assert.equal(invalid.result.requestStatus, 'stale-error');
    assert.equal(invalid.result.lastSuccessAt, valid.result.lastSuccessAt);
    assert(invalid.result.ageMs >= 1000);
    assert(!JSON.stringify(invalid.result).includes('TEST_ONLY_MUST_NOT_ESCAPE'));
  });
  await check('provider-fallbacks-share-one-monotone-deadline-with-no-reset', async () => {
    const budgets = [];
    clockOffset = 0;
    try {
      const failed = await runPv(async (_, budget) => { budgets.push(budget); clockOffset += 5100; throw new Error('timeout fixture'); });
      assert.equal(budgets.length, 1, 'No new network request after the overall deadline');
      assert(budgets[0] > 0 && budgets[0] <= 5000);
      assert.equal(failed.result.valid, false);
      assert.equal(failed.result.error, 'open-meteo-timeout');
    } finally { clockOffset = 0; }
  });
  await check('credential-source-priority-without-hardcoded-key', async () => {
    const previous = process.env.NEXOWATT_OPEN_METEO_API_KEY;
    try {
      delete process.env.NEXOWATT_OPEN_METEO_API_KEY;
      assert.equal(service.configuredOpenMeteoApiKey({ config: { weatherApiKey: 'native-test' } }, 'legacy-test'), 'native-test');
      process.env.NEXOWATT_OPEN_METEO_API_KEY = 'env-test';
      assert.equal(service.configuredOpenMeteoApiKey({ config: { weatherApiKey: 'native-test' } }, 'legacy-test'), 'env-test');
    } finally { if (previous === undefined) delete process.env.NEXOWATT_OPEN_METEO_API_KEY; else process.env.NEXOWATT_OPEN_METEO_API_KEY = previous; }
  });
  console.log(JSON.stringify({ suite: 'UI-CRA-NET-05', source: path.relative(root, filename), node: process.version, environment: 'isolated HTTPS/adapter fixtures; real short deadline timers; no Pi5/provider/TLS-certificate integration', passed: checks.length, checks }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
