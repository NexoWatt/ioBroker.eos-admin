#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft UI-CRA-NET-04 / NW-HTTPS-5S gegen Tarifregistry und State-Publisher.
 * Daten und Wirkung: Lokaler HTTP-Server hinter ausdrücklich simuliertem HTTPS-
 * URL-Transport, HTTPS-Provider-Mocks und Test-States. Keine Produktivverbindungen,
 * echten Token oder TLS-Ausnahmen im Produkt; kein Hersteller-TLS-Zertifikatstest.
 * Bei Änderungen: Gesamtabrufbudget (einschließlich OAuth), atomare Datentriage,
 * Ausfall/Body-Limits und Schutz des letzten gültigen State-Stands nachprüfen.
 */
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { createRequire } = require('node:module');
const fs = require('node:fs');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const root = path.resolve(__dirname, '..');
const sourceMode = process.argv.includes('--source');
const filename = path.join(root, sourceMode ? 'src-ts/runtime-executables/ems/services/tariff-provider-registry.ts' : 'ems/services/tariff-provider-registry.js');
const source = fs.readFileSync(filename, 'utf8');
const mod = { exports: {} };
const context = { module: mod, exports: mod.exports, require: createRequire(filename), Buffer, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, fetch: (...args) => globalThis.fetch(...args) };
vm.runInNewContext(source, context, { filename });
const registry = mod.exports;
const realFetch = globalThis.fetch;
const counts = new Map();
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  counts.set(pathname, (counts.get(pathname) || 0) + 1);
  if (pathname === '/redirect') { res.writeHead(302, { Location: '/sink' }); return res.end(); }
  if (pathname === '/oversized') { res.writeHead(200); return res.end('x'.repeat(2 * 1024 * 1024 + 1)); }
  if (pathname === '/declared') { res.writeHead(200, { 'Content-Length': 3 * 1024 * 1024 }); return res.end('x'); }
  if (pathname === '/wait') { res.writeHead(200); res.write('['); return; }
  if (pathname === '/error') { res.writeHead(502); return res.end('PRIVATE_PROVIDER_RESPONSE_MUST_NOT_ESCAPE'); }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify([{ startsAt: '2026-09-29T12:00:00Z', price: 0.31 }]));
});
const checks = [];
const timings = {};
async function check(name, fn) { await fn(); checks.push(name); }
async function rejected(config, pattern) { await assert.rejects(registry.fetchProvider(config), pattern); }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `https://loopback.invalid:${server.address().port}`;
  globalThis.fetch = (url, options) => {
    // Test-only HTTPS simulation routes to a real, local HTTP stream. Product
    // validates HTTPS before reaching this test substitution; no TLS bypass.
    assert.equal(url.protocol, 'https:'); assert.equal(url.hostname, 'loopback.invalid');
    const loopback = new URL(url); loopback.protocol = 'http:'; loopback.hostname = '127.0.0.1';
    return realFetch(loopback, options);
  };
  const config = (suffix = '', custom = {}) => ({ providerId: 'custom-rest', customRest: { url: `${base}${suffix}`, pricePath: 'price', ...custom } });
  await check('bounded-stream-positive-via-simulated-https', async () => {
    const result = await registry.fetchProvider(config('/normal'));
    assert.equal(result.intervals.length, 1); assert.equal(result.intervals[0].total, 0.31);
  });
  await check('redirect-never-reaches-target', async () => {
    await rejected(config('/redirect'), /provider_request_failed/); assert.equal(counts.get('/sink') || 0, 0);
  });
  await check('streamed-response-limit', () => rejected(config('/oversized'), /provider_response_too_large/));
  await check('declared-response-limit', () => rejected(config('/declared'), /provider_response_too_large/));
  await check('body-total-timeout', () => rejected({ ...config('/wait'), timeoutMs: 50 }, /provider_timeout/));
  await check('provider-error-redacted', () => rejected(config('/error'), /^Error: provider_http_502$/));
  await check('all-http-rejected-before-network', async () => {
    const httpUrl = `http://127.0.0.1:${server.address().port}/blocked`;
    for (const authMode of ['none', 'bearer', 'basic', 'api-key']) await rejected({ ...config('', { url: httpUrl, authMode }), credentials: { bearerToken: 'fixture', username: 'fixture', password: 'fixture', apiKey: 'fixture' } }, /provider_https_required/);
    await rejected({ providerId: 'energyzero', endpoint: httpUrl }, /provider_https_required/);
    await rejected({ providerId: 'tibber', endpoint: httpUrl, credentials: { accessToken: 'fixture' } }, /provider_https_required/);
    await rejected({ providerId: 'entsoe', endpoint: httpUrl, credentials: { securityToken: 'fixture' } }, /provider_https_required/);
    await rejected({ providerId: 'ostrom', credentials: { tokenUrl: httpUrl, clientId: 'fixture', clientSecret: 'fixture' } }, /provider_https_required/);
    assert.equal(counts.get('/blocked') || 0, 0);
  });
  await check('invalid-url-and-userinfo-rejected', async () => {
    for (const url of ['file:///etc/passwd', 'data:application/json,[]', 'ftp://example.invalid/data', 'https://fixture:fixture@example.invalid/', 'https://example.invalid/#fragment']) await rejected(config('', { url }), /provider_url_invalid/);
  });
  await check('https-custom-credential-contract-mock', async () => {
    let called = 0;
    globalThis.fetch = async (url, options) => {
      called++; assert.equal(url.protocol, 'https:'); assert.equal(options.redirect, 'error'); assert.equal(options.headers.Authorization, 'Bearer fixture');
      assert.equal(Object.hasOwn(options, 'sensitive'), false); assert.equal(Object.hasOwn(options, 'timeoutMs'), false);
      return new Response('[{"startsAt":"2026-09-29T12:00:00Z","price":0.21}]');
    };
    const result = await registry.fetchProvider({ ...config('', { url: 'https://provider.invalid/prices', authMode: 'bearer' }), credentials: { bearerToken: 'fixture' } });
    assert.equal(called, 1); assert.equal(result.intervals[0].total, 0.21);
  });
  const oauth = { providerId: 'ostrom', pricesUrl: 'https://provider.invalid/prices', credentials: { tokenUrl: 'https://provider.invalid/token', clientId: 'fixture', clientSecret: 'fixture' }, customRest: { pricePath: 'price' } };
  await check('https-oauth-one-signal-positive', async () => {
    let called = 0; let tokenSignal;
    globalThis.fetch = async (url, options) => {
      called++; assert.equal(options.redirect, 'error'); assert.equal(url.protocol, 'https:');
      if (url.pathname === '/token') { tokenSignal = options.signal; assert.match(options.headers.Authorization, /^Basic /); return new Response('{"access_token":"fixture-access"}'); }
      assert.equal(options.signal, tokenSignal); assert.equal(options.headers.Authorization, 'Bearer fixture-access');
      return new Response('[{"startsAt":"2026-09-29T12:00:00Z","price":0.22}]');
    };
    const result = await registry.fetchProvider(oauth);
    assert.equal(called, 2); assert.equal(result.intervals[0].total, 0.22);
  });
  await check('oauth-chain-shares-one-short-budget', async () => {
    let calls = 0; let signal;
    globalThis.fetch = async (url, options) => {
      calls++; signal = options.signal;
      await sleep(80);
      return url.pathname === '/token' ? new Response('{"access_token":"fixture-access"}') : new Response('[{"startsAt":"2026-09-29T12:00:00Z","price":0.22}]');
    };
    const start = performance.now();
    await rejected({ ...oauth, timeoutMs: 130 }, /provider_timeout/);
    timings.oauthSharedBudgetMs = Math.round(performance.now() - start);
    assert.equal(calls, 2); assert.equal(signal.aborted, true); assert.ok(timings.oauthSharedBudgetMs < 300);
    await sleep(60); // Let deliberately non-cooperative mock settle; no unhandled rejection.
  });
  await check('five-second-cap-includes-oauth-and-noncooperative-dns-mock', async () => {
    let calls = 0; let signal; let otherWorkRan = false;
    globalThis.fetch = async (url, options) => {
      calls++; signal = options.signal;
      if (url.pathname === '/token') { await sleep(100); return new Response('{"access_token":"fixture-access"}'); }
      return new Promise(() => {}); // Models unresolved DNS/transport ignoring AbortSignal.
    };
    const progress = setTimeout(() => { otherWorkRan = true; }, 30);
    const start = performance.now();
    await rejected({ ...oauth, timeoutMs: 60000 }, /provider_timeout/);
    timings.maximumConfiguredBudgetMs = Math.round(performance.now() - start);
    clearTimeout(progress);
    assert.equal(calls, 2); assert.equal(signal.aborted, true); assert.equal(otherWorkRan, true);
    assert.ok(timings.maximumConfiguredBudgetMs >= 4900 && timings.maximumConfiguredBudgetMs < 5500, '5 s timer plus test scheduler tolerance');
  });
  await check('offline-error-redacted', async () => {
    globalThis.fetch = async () => { throw new Error('DNS ENOTFOUND PRIVATE_PROVIDER_TOKEN'); };
    await rejected(config('', { url: 'https://provider.invalid/' }), /^Error: provider_request_failed$/);
  });
  await check('request-size-limit-before-network', async () => {
    globalThis.fetch = async () => { throw new Error('unexpected_network_call'); };
    await rejected(config('', { url: 'https://provider.invalid/prices', method: 'POST', body: 'x'.repeat(65537) }), /provider_request_too_large/);
  });
  const start = '2026-09-29T12:00:00Z';
  const valid = { startsAt: start, price: 0.21 };
  await check('json-types-completeness-bounds-atomic-rejection', async () => {
    const invalidRows = [null, [], {}, { ...valid, price: null }, { ...valid, price: '0.21' }, { ...valid, price: true }, { ...valid, price: { value: 0.21 } }, { ...valid, price: 101 }, { ...valid, startsAt: false }, { ...valid, startsAt: '2026-02-30T12:00:00Z' }, { ...valid, startsAt: '2026-09-29T12:00:00' }, { ...valid, endsAt: null }, { ...valid, endsAt: '2026-09-29T11:00:00Z' }, { ...valid, currency: 'USD' }, { ...valid, currency: 42 }];
    for (const row of invalidRows) {
      globalThis.fetch = async () => new Response(JSON.stringify([valid, row]));
      await rejected(config('', { url: 'https://provider.invalid/prices' }), /provider_prices_invalid/);
    }
    globalThis.fetch = async () => new Response('[{"startsAt":"2026-09-29T12:00:00Z","price":1e400}]');
    await rejected(config('', { url: 'https://provider.invalid/prices' }), /provider_prices_invalid/);
    for (const payload of ['null', '{}', '[]', '"not-an-array"', '{broken']) {
      globalThis.fetch = async () => new Response(payload);
      await rejected(config('', { url: 'https://provider.invalid/prices' }), /provider_prices_invalid|invalid_json_response/);
    }
  });
  await check('negative-prices-and-epoch-types-positive', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify([{ startsAt: Date.parse(start), price: -0.15, currency: 'EUR' }]));
    const result = await registry.fetchProvider(config('', { url: 'https://provider.invalid/prices' }));
    assert.equal(result.intervals[0].total, -0.15);
  });
  await check('interval-count-and-overlap-rejected', () => {
    assert.throws(() => registry.normalizeRows(Array.from({ length: 4097 }, () => ({ startsAt: start, total: 0.2 }))), /provider_prices_invalid/);
    assert.throws(() => registry.normalizeRows([{ startsAt: start, total: 0.2 }, { startsAt: start, total: 0.3 }]), /provider_prices_invalid/);
  });
  await check('tibber-and-energyzero-complete-envelope-check', () => {
    const tibberPayload = { data: { viewer: { homes: [{ id: 'fixture-home', currentSubscription: { priceInfo: { today: [{ startsAt: start, total: 0.1, currency: 'EUR' }], tomorrow: [] } } }] } } };
    assert.equal(registry.normalizeTibber(tibberPayload).intervals[0].total, 0.1);
    assert.equal(registry.normalizeEnergyZero({ Prices: [{ readingDate: start, allInPriceIncludingVat: 0.3 }] }).intervals[0].total, 0.3);
    assert.throws(() => registry.normalizeTibber({ data: { viewer: { homes: [{ id: 'fixture-home', currentSubscription: { priceInfo: { today: 'invalid', tomorrow: [] } } }] } } }), /tibber_no_price_info/);
    assert.throws(() => registry.normalizeTibber({ data: { viewer: { homes: [{ id: 'fixture-home', currentSubscription: { priceInfo: { today: [{ startsAt: start, total: 0.1 }], tomorrow: [] } } }] } } }, { homeId: 'other-home' }), /tibber_home_invalid/);
    assert.throws(() => registry.normalizeEnergyZero({ Prices: [{ readingDate: start, allInPriceIncludingVat: null, price: 0.2 }] }), /provider_prices_invalid/);
  });
  const xml = '<Publication_MarketDocument><TimeSeries><Period><timeInterval><start>2026-09-29T12:00Z</start></timeInterval><resolution>PT15M</resolution><Point><position>1</position><price.amount>100</price.amount></Point><Point><position>2</position><price.amount>-50</price.amount></Point></Period></TimeSeries></Publication_MarketDocument>';
  await check('entsoe-explicit-xml-decimal-positive-and-malformed-rejection', () => {
    assert.equal(registry.normalizeEntsoe(xml).intervals[1].total, -0.05);
    for (const bad of [xml.replace('>100<', '><'), xml.replace('>100<', '>false<'), xml.replace('<position>2', '<position>3'), xml.replace('<resolution>PT15M</resolution>', ''), '<Reason><text>PRIVATE_PROVIDER_TOKEN</text></Reason>', '<!DOCTYPE fixture>' + xml]) assert.throws(() => registry.normalizeEntsoe(bad), /^Error: entsoe_invalid_response$/);
  });
  async function publisherFixture() {
    const moduleFilename = path.join(root, sourceMode ? 'src-ts/runtime-executables/ems/modules/tariff-provider.ts' : 'ems/modules/tariff-provider.js');
    const moduleObject = { exports: {} };
    const generatedRequire = createRequire(path.join(root, 'ems/modules/tariff-provider.js'));
    vm.runInNewContext(fs.readFileSync(moduleFilename, 'utf8'), { module: moduleObject, exports: moduleObject.exports, require: id => id === '../services/tariff-provider-registry' ? registry : generatedRequire(id), Date, Math, Number, String, Object, Array, JSON, Promise, setTimeout, clearTimeout }, { filename: moduleFilename });
    const states = new Map(); const stateWrites = [];
    const adapter = { namespace: 'nexowatt-ui.0', instance: 0, config: { tariffProvider: { ...config('', { url: 'https://provider.invalid/prices' }), enabled: true, timeoutMs: 60000, maxStaleMinutes: 30, timeZone: 'UTC' } }, log: { debug() {}, warn() {} }, async setObjectNotExistsAsync() {}, async setStateAsync(id, obj) { states.set(id, obj.val); stateWrites.push(id); } };
    const publisher = new moduleObject.exports.TariffProviderModule(adapter, null);
    assert.equal(publisher._cfg().timeoutMs, 5000);
    const now = Date.now();
    const row = { startsAt: new Date(now - 60000).toISOString(), endsAt: new Date(now + 600000).toISOString(), total: 0.27, market: 0.27, quality: 'market-only' };
    publisher._intervals = [row]; publisher._lastSuccessMs = now - 1000;
    await publisher._publish(publisher._cfg(), now, 'ok');
    stateWrites.length = 0;
    const protectedIds = new Set(['currentPriceEurPerKwh', 'averagePriceEurPerKwh', 'pricesTodayJson', 'pricesTomorrowJson', 'normalizedJson', 'lastSuccess'].map(id => `tariffProvider.${id}`));
    return { publisher, states, stateWrites, protectedIds, row, now };
  }
  await check('invalid-provider-response-does-not-refresh-states-or-timestamps', async () => {
    const { publisher, states, stateWrites, protectedIds, row, now } = await publisherFixture();
    globalThis.fetch = async () => new Response(JSON.stringify([{ startsAt: row.startsAt, endsAt: row.endsAt, price: null }]));
    await publisher._refresh(publisher._cfg(), now);
    assert.equal(publisher._intervals[0], row); assert.equal(publisher._lastSuccessMs, now - 1000);
    assert.equal(states.get('tariffProvider.currentPriceEurPerKwh'), 0.27); assert.equal(states.get('tariffProvider.status'), 'degraded');
    assert.equal(states.get('tariffProvider.error'), 'provider_prices_invalid');
    assert.equal(stateWrites.some(id => protectedIds.has(id)), false, 'failed fetch must not rewrite price, curve or success state timestamps');
    publisher._lastSuccessMs = now - 31 * 60000;
    await publisher._refresh(publisher._cfg(), now);
    assert.equal(states.get('tariffProvider.currentPriceEurPerKwh'), null); assert.equal(states.get('tariffProvider.fresh'), false);
    assert.equal(states.get('tariffProvider.normalizedJson'), '[]');
  });
  await check('expired-and-future-only-responses-keep-good-cache-and-success-time', async () => {
    const { publisher, states, stateWrites, protectedIds, row, now } = await publisherFixture();
    for (const offset of [-3600000, 86400000 * 365]) {
      const invalidWindow = { startsAt: new Date(now + offset).toISOString(), endsAt: new Date(now + offset + 1800000).toISOString(), price: 0.05 };
      globalThis.fetch = async () => new Response(JSON.stringify([invalidWindow]));
      await publisher._refresh(publisher._cfg(), now);
      assert.equal(publisher._intervals[0], row); assert.equal(publisher._lastSuccessMs, now - 1000);
      assert.equal(states.get('tariffProvider.error'), 'provider_prices_not_current'); assert.equal(states.get('tariffProvider.status'), 'degraded');
      assert.equal(stateWrites.some(id => protectedIds.has(id)), false);
    }
  });
  await check('valid-current-provider-result-commits-new-price-and-success', async () => {
    const { publisher, states, stateWrites, protectedIds, row, now } = await publisherFixture();
    globalThis.fetch = async () => new Response(JSON.stringify([{ startsAt: row.startsAt, endsAt: row.endsAt, price: 0.31 }]));
    await publisher._refresh(publisher._cfg(), now);
    assert.equal(states.get('tariffProvider.currentPriceEurPerKwh'), 0.31); assert.equal(states.get('tariffProvider.status'), 'ok');
    assert.ok(publisher._lastSuccessMs >= now); assert.equal(states.get('tariffProvider.fresh'), true);
    for (const id of protectedIds) assert.ok(stateWrites.includes(id), `successful fetch must publish ${id}`);
  });
  await check('unchanged-ticks-preserve-data-timestamps-and-expiry-clears-once', async () => {
    const { publisher, states, stateWrites, protectedIds, now } = await publisherFixture();
    await publisher._publish(publisher._cfg(), now + 10);
    assert.equal(stateWrites.some(id => protectedIds.has(id)), false);
    await publisher._publish(publisher._cfg(), now + 31 * 60000);
    assert.equal(states.get('tariffProvider.currentPriceEurPerKwh'), null); assert.equal(states.get('tariffProvider.pricesTodayJson'), '[]');
    assert.equal(states.get('tariffProvider.normalizedJson'), '[]');
    stateWrites.length = 0;
    await publisher._publish(publisher._cfg(), now + 32 * 60000);
    assert.equal(stateWrites.some(id => protectedIds.has(id)), false);
  });
  console.log(JSON.stringify({ suite: 'UI-CRA-NET-04 / NW-HTTPS-5S', source: path.relative(root, filename), node: process.version, environment: 'real loopback HTTP stream behind simulated HTTPS URL; mocked HTTPS providers/DNS; no production or real TLS access', passed: checks.length, timings, checks }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  globalThis.fetch = realFetch;
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});
