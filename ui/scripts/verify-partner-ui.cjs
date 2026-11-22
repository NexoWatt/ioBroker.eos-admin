/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft echte Partner-Frontend-Verträge gegen Backend-Snapshots und Transportfehler.
 * Daten und Wirkung: Führt TypeScript isoliert mit lokalen Testantworten aus; keine Partner-/Gerätekontakte.
 * Bei Änderungen: Preview-Nullvertrag, Ressourcengrenzen, aktuelle Origin und CAS-Fehler mitprüfen.
 * Verknüpfungen: docs/quellcode/src-admin-tab/src/lib/partnerContracts.md
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(relative) {
  const absolute = path.resolve(root, relative);
  if (cache.has(absolute)) return cache.get(absolute);
  const module = { exports: {} };
  const source = fs.readFileSync(absolute, 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
  assert.equal(result.diagnostics.filter(issue => issue.category === ts.DiagnosticCategory.Error).length, 0);
  vm.runInThisContext('(function(module,exports,require){' + result.outputText + '\n})', { filename: absolute })(module, module.exports, id => load(path.relative(root, path.resolve(path.dirname(absolute), `${id}.ts`))));
  cache.set(absolute, module.exports); return module.exports;
}
const ui = load('src-admin-tab/src/lib/partnerContracts.ts');
const contracts = load('src-ts/runtime-executables/lib/partner-contracts.ts');
const backend = load('src-ts/runtime-executables/lib/partner-config-api.ts');
const status = { connection: 'disabled', reason: 'DISABLED', controlAvailable: false, revision: 1 };
const clone = value => JSON.parse(JSON.stringify(value));
let checks = 0;
async function check(name, run) { await run(); checks++; console.log('PASS', name); }
const csrfToken = crypto.randomBytes(32).toString('base64url');
const activeSession = () => ({ mode: 'iobroker', configured: true, enabled: true, protectWrites: true,
  authed: true, authenticated: true, role: 'admin', user: 'system.user.fixture', capabilities: ['*'], csrfToken,
  loginUrl: '/login.html', logoutUrl: '' });
function connection(fetchImpl, overrides = {}, session = activeSession()) {
  const exports = {};
  const window = { location: new URL('https://eos.test:9443/ems/arbitrage/') };
  window.top = window; window.parent = window;
  const source = fs.readFileSync(path.join(root, 'src-admin-tab/src/lib/adminConnection.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  // Der neue Schreibvertrag prüft zuerst die eigene Sitzung. Die aufrufenden
  // Fachtests zählen danach ausschließlich tatsächliche Fachanforderungen.
  const fetchWithSession = async (url, options) => {
    const target = new URL(url);
    assert.equal(target.origin, window.location.origin);
    if (target.pathname === '/api/auth/status') {
      assert.equal(options.method, 'GET');
      assert.equal(options.credentials, 'include');
      return Response.json(session);
    }
    if (options.method === 'POST') assert.equal(new Headers(options.headers).get('X-NW-CSRF'), csrfToken);
    return fetchImpl(url, options);
  };
  vm.runInNewContext(output, { exports, window, URL, URLSearchParams, AbortController, TextDecoder, fetch: fetchWithSession, setTimeout, clearTimeout, ...overrides });
  return exports;
}
(async () => {
  await check('Realer gesperrter Backend-Standard bleibt ohne zusätzliche App editierbar', () => {
    const parsed = ui.parsePartnerResponse(backend.partnerIntegrationSnapshot({}, status));
    assert.equal(parsed.config.configVersion, 1); assert.equal(parsed.config.enabled, false);
    assert.equal(parsed.app.installed, false); assert.equal(parsed.status.controlAvailable, false);
  });
  const config = contracts.defaultPartnerConfig();
  config.arbitrage.resources = [{ id: 'storage_1', maxChargeW: 4000, maxDischargeW: 5000, maxImportW: 12000, maxExportW: 8000, minSocPct: 20, maxSocPct: 90, allowGridCharge: false, allowGridExport: false, commissioned: false }];
  config.grants = [{ appId: 'arbitrage', resourceId: 'storage_1', permissions: ['telemetry.read'] }, { appId: 'energyLedger', resourceId: 'site', permissions: ['balance.read'] }];
  await check('Alle Netz-/Speichergrenzen und getrennte Bilanzrechte bleiben unverändert', () => {
    assert.equal(contracts.validatePartnerConfig(config).valid, true);
    assert.deepEqual(ui.parsePartnerConfig(config), config);
  });
  await check('Falsche Datentypen, leere Leistungen, unendliche Zahlen und TTL>60 scheitern', () => {
    for (const mutate of [value => { value.arbitrage.resources[0].maxImportW = ''; }, value => { value.arbitrage.resources[0].commissioned = 'false'; }, value => { value.arbitrage.resources[0].maxChargeW = Infinity; }, value => { value.arbitrage.resources[0].maxDischargeW = 0.5; }, value => { value.arbitrage.maxCommandSeconds = 61; }, value => { value.arbitrage.resources[0].minSocPct = 91; }]) {
      const bad = clone(config); mutate(bad); assert.throws(() => ui.parsePartnerConfig(bad));
    }
  });
  await check('Ungeprüfte Bereitschaft und beschädigte API-Antworten können nicht freischalten', () => {
    for (const flag of ['true', 1, null, undefined]) {
      const raw = backend.partnerIntegrationSnapshot({}, { ...status, controlAvailable: flag });
      assert.throws(() => ui.parsePartnerResponse(raw));
    }
    const poisoned = JSON.parse(JSON.stringify(config));
    poisoned.extra = JSON.parse('{"__proto__":{"polluted":true}}');
    assert.throws(() => ui.parsePartnerConfig(poisoned)); assert.equal({}.polluted, undefined);
  });
  await check('Ungültige Vorschau zeigt Prüfhinweise ohne erfundene Konfiguration', () => {
    const raw = { ...backend.partnerIntegrationSnapshot({}, status), config: null, preview: true, validation: { valid: false, errors: [{ path: 'grants.0', code: 'INVALID_CONFIG', message: 'Freigabe prüfen.' }] } };
    const result = ui.parsePartnerResponse(raw, true);
    assert.equal(result.config, null); assert.equal(result.validation.errors[0].message, 'Freigabe prüfen.');
    assert.throws(() => ui.parsePartnerResponse(raw));
    assert.throws(() => ui.parsePartnerResponse({ ...raw, validation: { valid: true, errors: [] } }, true));
  });
  await check('Partner- und Authaufrufe bleiben am tatsächlichen HTTPS-Runtime-Port', async () => {
    const calls = [];
    const api = connection(async (url, options) => { calls.push({ url, options }); return Response.json(backend.partnerIntegrationSnapshot({}, status)); });
    await api.partnerIntegrationsRequest();
    assert.equal(calls[0].url, 'https://eos.test:9443/api/installer/partner-integrations');
    assert.equal(calls[0].options.credentials, 'include'); assert.equal(calls.length, 1);
  });
  await check('CAS409 und HTTP403 werden genau einmal angefragt, nie erneut geschrieben', async () => {
    for (const httpStatus of [409, 403]) {
      let calls = 0;
      const api = connection(async () => { calls++; return Response.json({ ok: false, error: 'CONFIG_VERSION_CONFLICT' }, { status: httpStatus }); });
      await assert.rejects(api.partnerIntegrationsRequest('/config', { config, expectedConfigVersion: 1 }), error => error.status === httpStatus);
      assert.equal(calls, 1);
    }
  });
  await check('Transportfehler nach Mutation erzeugt keine automatische Wiederholung', async () => {
    let calls = 0; const api = connection(async () => { calls++; throw new Error('Verbindung abgebrochen'); });
    await assert.rejects(api.partnerIntegrationsRequest('/revoke', { expectedConfigVersion: 1 }));
    assert.equal(calls, 1);
  });
  await check('Ohne bestätigte Sitzung und CSRF erreicht kein Auftrag die Partner-API', async () => {
    for (const session of [{ ...activeSession(), authed: false, authenticated: false, role: 'none', user: null, csrfToken: '' },
      { ...activeSession(), configured: false }, { ...activeSession(), csrfToken: undefined }]) {
      let calls = 0;
      const api = connection(async () => { calls++; return Response.json({ ok: true }); }, {}, session);
      await assert.rejects(api.partnerIntegrationsRequest('/revoke', { expectedConfigVersion: 1 }));
      assert.equal(calls, 0);
    }
  });
  await check('Das Gesamtbudget bricht auch einen hängenden Antwortkörper ab', async () => {
    let cancel; let aborted = false;
    const api = connection(async (_url, options) => {
      options.signal.addEventListener('abort', () => { aborted = true; }, { once: true });
      return new Response(new ReadableStream({ cancel() {} }));
    }, { setTimeout(fn, delay) { assert.ok(delay <= 5000); cancel = fn; return 1; }, clearTimeout() {} });
    const pending = api.partnerIntegrationsRequest('/config', { config, expectedConfigVersion: 1 });
    await new Promise(resolve => setImmediate(resolve)); cancel();
    await assert.rejects(pending); assert.equal(aborted, true);
  });
  console.log(JSON.stringify({ result: 'PASS', checks, node: process.version, limitation: 'Echter TypeScript-Code mit lokalen Vertrags-/Transporttests. Keine Hardware-, Händler- oder Browserabnahme.' }));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
