/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft Partnerprotokoll und Installateurgrenze mit echtem streng kompiliertem Runtimecode.
 * Daten und Wirkung: Isolierte temporäre Kompilierung und simulierte Persistenz, keine Netzwerk-/Geräteschreibzugriffe.
 * Bei Änderungen: Rechte-, Replay-, Widerruf-, Reihenfolge- und Datenminimierungsfälle erhalten.
 * Verknüpfungen: partner-contracts.ts, partner-service.ts, partner-config-api.ts.
 */
'use strict';
const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const built = fs.mkdtempSync(path.join(os.tmpdir(), 'nexowatt-partner-test-'));
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.partner-integration.json', '--noEmit', 'false', '--outDir', built], { cwd: root, stdio: 'pipe' });
const { defaultPartnerConfig, validatePartnerConfig, PARTNER_PROTOCOL, currentPartnerConfig } = require(path.join(built, 'partner-contracts.js'));
const { PartnerIntegrationService, projectPartnerData } = require(path.join(built, 'partner-service.js'));
const { registerPartnerIntegrationApi, assertPartnerPersistence } = require(path.join(built, 'partner-config-api.js'));
after(() => fs.rmSync(built, { recursive: true, force: true }));
/** Vollständiges, explizit freigegebenes Testprofil; keine realen Geheimnisse. */
function config() {
  return { ...defaultPartnerConfig(), enabled: true, partnerId: 'partner1', endpoint: 'wss://trade.example.org/eos', credentialRef: 'NEXOWATT_PARTNER_TEST', grants: [{ appId: 'arbitrage', resourceId: 'battery1', permissions: ['storage.charge.request', 'storage.discharge.request', 'dispatch.cancel', 'dispatch.status.read', 'telemetry.read'] }, { appId: 'energyLedger', resourceId: 'site', permissions: ['balance.read'] }], arbitrage: { profile: 'tradingOnly', maxCommandSeconds: 60, resources: [{ id: 'battery1', maxChargeW: 5000, maxDischargeW: 5000, maxImportW: 10000, maxExportW: 10000, allowGridCharge: true, allowGridExport: true, commissioned: true, minSocPct: 20, maxSocPct: 90 }] } };
}
/** Zeit, Journal und lokale Freigaben sind deterministisch steuerbar; Servicecode bleibt unverändert. */
async function service(overrides = {}, candidate = config()) {
  const state = { now: 1000000, monotonic: 0, writes: 0, journal: [], active: true, control: true };
  const hooks = { loadJournal: async () => state.journal, persistJournal: async entries => { state.writes++; state.journal = structuredClone(entries); }, isAppActive: () => state.active, controlAvailable: () => state.control, isResourceAvailable: () => true, readData: async () => ({}), now: () => state.now, monotonicNow: () => state.monotonic, ...overrides };
  const instance = new PartnerIntegrationService(candidate, hooks); await instance.initialize();
  return { instance, state, hooks };
}
function command(overrides = {}) { return { protocol: PARTNER_PROTOCOL, id: 'command1', type: 'storage.dispatch', appId: 'arbitrage', resourceId: 'battery1', action: 'charge', powerW: 3000, issuedAt: 999000, expiresAt: 1020000, configVersion: 1, ...overrides }; }
async function send(instance, message, partner = 'partner1') { return JSON.parse(await instance.handleMessage(partner, JSON.stringify(message))); }
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
const tick = () => new Promise(resolve => setImmediate(resolve));

test('Standardprofil bleibt ausgeschaltet; Handelsprofil benötigt keine PV/NVP-Konfiguration', () => {
  assert.equal(defaultPartnerConfig().enabled, false); assert.deepEqual(defaultPartnerConfig().grants, []);
  assert.equal(validatePartnerConfig(config()).valid, true);
});
test('Unbekannte Felder, Geheimnisse, freie State-IDs und unverschlüsselte Endpunkte werden verworfen', () => {
  for (const patch of [{ token: 'forbidden' }, { enabled: 'true' }, { endpoint: 'ws://host' }, { endpoint: 'wss://user:password@host' }, { endpoint: 'wss://host?token=x' }, { credentialRef: 'HOME' }, { partnerId: '../other' }]) assert.equal(validatePartnerConfig({ ...config(), ...patch }).valid, false);
  const c = config(); c.arbitrage.resources[0].id = 'modbus.0.holdingRegisters.1'; assert.equal(validatePartnerConfig(c).valid, false);
});
test('Bilanz kann kein Schreibrecht erhalten; Rechte sind nach App und Ressource getrennt', () => {
  const c = config(); c.grants[1].permissions.push('storage.charge.request'); assert.equal(validatePartnerConfig(c).valid, false);
  const d = config(); d.grants.push(structuredClone(d.grants[0])); assert.equal(validatePartnerConfig(d).valid, false);
});
test('Grenzen schließen unbekannte Ressourcen, >60s, NaN und ungültigen SoC aus', () => {
  const a = config(); a.arbitrage.maxCommandSeconds = 61; assert.equal(validatePartnerConfig(a).valid, false);
  const b = config(); b.arbitrage.resources[0].maxChargeW = NaN; assert.equal(validatePartnerConfig(b).valid, false);
  const c = config(); c.arbitrage.resources[0].minSocPct = 95; assert.equal(validatePartnerConfig(c).valid, false);
  const d = config(); d.grants[0].resourceId = 'unknown'; assert.equal(validatePartnerConfig(d).valid, false);
});
test('Partnerbindung, lokale Appfreigabe, Inbetriebnahme und zentraler Writer sind unabhängige Pflichten', async () => {
  const { instance, state } = await service();
  assert.equal((await send(instance, command(), 'intruder')).code, 'NOT_AUTHORIZED');
  state.active = false; assert.equal((await send(instance, command())).code, 'NOT_AUTHORIZED');
  state.active = true; state.control = false; assert.equal((await send(instance, command())).code, 'CONTROL_UNAVAILABLE');
  const c = config(); c.arbitrage.resources[0].commissioned = false;
  assert.equal((await send((await service({}, c)).instance, command())).code, 'LIMIT_EXCEEDED');
  assert.equal(state.writes, 0);
  const unavailable = await service({ isResourceAvailable: () => false });
  assert.equal((await send(unavailable.instance, command())).code, 'RESOURCE_UNAVAILABLE');
  assert.equal(unavailable.state.writes, 0);
});
test('Journal wird vor Annahme gespeichert; Quittung behauptet keine Gerätebestätigung', async () => {
  const wait = deferred(); const { instance } = await service({ persistJournal: () => wait.promise });
  const pending = send(instance, command()); await tick(); assert.equal(instance.getCurrentRequest('battery1'), null);
  wait.resolve(); const result = await pending; assert.equal(result.code, 'ACCEPTED'); assert.equal(result.deviceAcknowledged, false);
  assert.equal(instance.getCurrentRequest('battery1').powerW, 3000);
});
test('Identische Wiederholung wirkt nicht erneut; widersprechende Wiederverwendung wird abgewiesen', async () => {
  const { instance, state } = await service(); assert.equal((await send(instance, command())).code, 'ACCEPTED');
  assert.equal((await send(instance, command())).code, 'DUPLICATE'); assert.equal(state.writes, 1);
  assert.equal((await send(instance, command({ powerW: 4000 }))).code, 'ID_CONFLICT'); assert.equal(state.writes, 1);
});
test('Ältere neue Kennung darf neueren Wunsch nicht ersetzen, auch nach Neustart', async () => {
  const { instance, state } = await service(); await send(instance, command());
  assert.equal((await send(instance, command({ id: 'older', issuedAt: 998000, powerW: 4000 }))).code, 'OUT_OF_ORDER');
  assert.equal(instance.getCurrentRequest('battery1').id, 'command1');
  const restarted = (await service({ loadJournal: async () => state.journal })).instance;
  assert.equal(restarted.getCurrentRequest('battery1'), null);
  assert.equal((await send(restarted, command({ id: 'older', issuedAt: 998000 }))).code, 'OUT_OF_ORDER');
  assert.equal((await send(restarted, command())).code, 'DUPLICATE'); assert.equal(restarted.getCurrentRequest('battery1'), null);
});
test('Journalfehler sperren Verbindung und alle Wünsche ohne Geräteschreiben', async () => {
  const a = (await service({ loadJournal: async () => ({ corrupt: true }) })).instance;
  assert.equal(a.authorize(), false); assert.equal((await send(a, command())).code, 'NOT_AUTHORIZED');
  for (const missing of [null, undefined]) assert.equal((await service({ loadJournal: async () => missing })).instance.authorize(), false);
  const b = (await service({ persistJournal: async () => { throw new Error('secret filesystem detail'); } })).instance;
  const result = await send(b, command()); assert.equal(result.code, 'JOURNAL_UNAVAILABLE'); assert.equal(b.authorize(), false); assert.equal(b.getCurrentRequest('battery1'), null); assert.equal(JSON.stringify(result).includes('filesystem'), false);
});
test('Widerruf während Journal-Commit kann keinen Wunsch nachträglich aktivieren', async () => {
  const wait = deferred(); const { instance } = await service({ persistJournal: () => wait.promise });
  const pending = send(instance, command()); await tick(); instance.invalidate(); wait.resolve();
  assert.equal((await pending).code, 'REVOKED'); assert.equal(instance.getCurrentRequest('battery1'), null);
});
test('Lease endet bei Ablauf und auch nach rückwärts springender Wanduhr monoton', async () => {
  const { instance, state } = await service(); await send(instance, command()); state.now = 990000; state.monotonic = 20001;
  assert.equal(instance.getCurrentRequest('battery1'), null);
  const b = await service(); await send(b.instance, command()); b.state.now = 1020000; assert.equal(b.instance.getCurrentRequest('battery1'), null);
});
test('Abgelaufene, zu lange, zukünftige, übergroße und rohe Schreibaufträge wirken nicht', async () => {
  const { instance, state } = await service();
  for (const patch of [{ expiresAt: 1000000 }, { expiresAt: 1060001 }, { issuedAt: 1010001 }, { powerW: 5001 }, { stateId: 'raw.0.secret' }, { configVersion: 0 }, { type: 'schedule.submit' }]) assert.equal((await send(instance, command(patch))).ok, false);
  assert.equal(state.writes, 0);
});
test('Verbindungsverlust, lokale Appabschaltung und Konfigurationswechsel löschen aktuelle Wünsche', async () => {
  for (const action of [(i, s) => i.setConnection('disconnected', 'NETWORK_LOST'), (i, s) => { s.active = false; }, (i, s) => i.updateConfig({ ...config(), configVersion: 2 })]) {
    const { instance, state } = await service(); await send(instance, command()); action(instance, state); assert.equal(instance.getCurrentRequest('battery1'), null);
  }
});
test('Cancel ist ressourcenbezogen und Wiederholung reaktiviert den Auftrag nicht', async () => {
  const { instance, state } = await service(); await send(instance, command());
  const request = { protocol: PARTNER_PROTOCOL, id: 'cancel1', type: 'dispatch.cancel', appId: 'arbitrage', resourceId: 'battery1', commandId: 'command1' };
  assert.equal((await send(instance, request)).code, 'CANCELLED'); assert.equal(instance.getCurrentRequest('battery1'), null); assert.equal(state.journal[0].status, 'cancelled');
  assert.equal((await send(instance, command())).code, 'DUPLICATE'); assert.equal(instance.getCurrentRequest('battery1'), null);
});
test('Bilanz- und Telemetrieprojektionen enthalten niemals Konfiguration, Inventar oder Rohwerte', () => {
  assert.deepEqual({ ...projectPartnerData('balance', { summary: { pvDirectKwh: 2, gridDirectKwh: 4, token: 'hidden' }, config: { secret: true }, inventory: {}, intervals: ['raw'] }) }, { pvDirectKwh: 2, gridDirectKwh: 4 });
  assert.deepEqual({ ...projectPartnerData('telemetry', { powerW: -200, socPct: 40, stateId: 'raw', available: true, config: {} }) }, { powerW: -200, socPct: 40, available: true });
});
test('Datenfreigabe wird nach asynchroner Abfrage erneut geprüft', async () => {
  const wait = deferred(); const { instance } = await service({ readData: () => wait.promise });
  const pending = send(instance, { protocol: PARTNER_PROTOCOL, id: 'read1', type: 'data.read', appId: 'energyLedger', resourceId: 'site', kind: 'balance' });
  await tick(); instance.invalidate(); wait.resolve({ summary: { pvDirectKwh: 999 } }); const result = await pending;
  assert.equal(result.code, 'REVOKED'); assert.equal(result.data, undefined);
});
test('Leserecht ist an die freigegebene App und Ressource gebunden', async () => {
  const { instance } = await service({ readData: async () => ({ summary: { pvDirectKwh: 2 } }) });
  const message = { protocol: PARTNER_PROTOCOL, id: 'read1', type: 'data.read', appId: 'energyLedger', resourceId: 'site', kind: 'balance' };
  assert.equal((await send(instance, message)).data.pvDirectKwh, 2);
  assert.equal((await send(instance, { ...message, resourceId: 'battery1' })).code, 'NOT_AUTHORIZED');
  assert.equal((await send(instance, { ...message, kind: 'telemetry' })).code, 'NOT_AUTHORIZED');
});
test('Hängende Datenabfrage endet nach fünf Sekunden und abortiert den Provider', async () => {
  let signal; const { instance } = await service({ readData: (_app, _resource, _kind, value) => { signal = value; return new Promise(() => {}); } });
  const started = performance.now();
  const result = await send(instance, { protocol: PARTNER_PROTOCOL, id: 'read1', type: 'data.read', appId: 'energyLedger', resourceId: 'site', kind: 'balance' });
  assert.equal(result.code, 'OPERATION_UNAVAILABLE'); assert.equal(signal.aborted, true); assert.ok(performance.now() - started < 5500);
  assert.equal((await send(instance, command())).code, 'ACCEPTED');
});
test('Größen- und Nachrichtenquoten begrenzen untrusted Eingaben', async () => {
  const { instance } = await service(); assert.equal(JSON.parse(await instance.handleMessage('partner1', 'x'.repeat(65537))).code, 'MESSAGE_TOO_LARGE');
  for (let i = 0; i < 60; i++) await instance.handleMessage('partner1', '{}');
  assert.equal(JSON.parse(await instance.handleMessage('partner1', '{}')).code, 'RATE_LIMITED');
});

/** Kleiner HTTP-Harness führt alle real registrierten Middleware-Schritte aus. */
function api(overrides = {}) {
  const routes = new Map(); let rootConfig = { partnerIntegrations: config(), emsApps: { apps: { arbitrage: { installed: true, enabled: true } } } }; let busy = false; let invalidations = 0;
  const status = { connection: 'disconnected', reason: 'NOT_CONNECTED', controlAvailable: false, revision: 1 };
  const app = { get: (route, ...handlers) => routes.set(`GET ${route}`, handlers), post: (route, ...handlers) => routes.set(`POST ${route}`, handlers) };
  registerPartnerIntegrationApi(app, (_req, _res, next) => next(), { getRoot: () => rootConfig, getStatus: () => status, beginSave: () => busy ? null : (busy = true), endSave: () => { busy = false; }, invalidate: () => { invalidations++; }, commit: async (next, appState, expected) => { assert.equal(rootConfig.partnerIntegrations.configVersion, expected); rootConfig.partnerIntegrations = next; if (appState) rootConfig.emsApps.apps.arbitrage = { installed: appState.installed, enabled: appState.enabled }; status.revision = next.configVersion; }, ...overrides });
  return { root: () => rootConfig, invalidations: () => invalidations, request: async (method, suffix, body, role = 'installer') => { const res = { code: 200, headers: {}, body: null, status(code) { this.code = code; return this; }, setHeader(name, value) { this.headers[name] = value; }, json(value) { this.body = value; return this; } }; const req = { body, nwSession: { role, capabilities: ['*'] } }; const handlers = routes.get(`${method} /api/installer/partner-integrations${suffix}`); const run = async index => { if (handlers[index]) { let pending; await handlers[index](req, res, () => { pending = run(index + 1); }); if (pending) await pending; } }; await run(0); return res; } };
}
test('Echte Installer-/Adminrolle erforderlich trotz alter Customer-Wildcard', async () => {
  const a = api(); assert.equal((await a.request('GET', '', undefined, 'customer')).code, 403); assert.equal((await a.request('GET', '', undefined, 'none')).code, 403);
  const response = await a.request('GET', '', undefined, 'admin'); assert.equal(response.code, 200); assert.equal(response.headers['Cache-Control'], 'no-store'); assert.equal(JSON.stringify(response.body).includes('bearerToken'), false);
});
test('Config CAS erhöht genau einmal und alte Browserrevision erhält Konflikt', async () => {
  const a = api(); const candidate = config(); candidate.arbitrage.profile = 'household';
  const first = await a.request('POST', '/config', { config: candidate, expectedConfigVersion: 1 }); assert.equal(first.code, 200); assert.equal(first.body.config.configVersion, 2); assert.equal(a.invalidations(), 1);
  const second = await a.request('POST', '/config', { config: candidate, expectedConfigVersion: 1 }); assert.equal(second.code, 409); assert.equal(a.root().partnerIntegrations.configVersion, 2);
});
test('Vorschau persistiert nichts; globale Sperre widerruft alle Freigaben', async () => {
  const a = api(); assert.equal((await a.request('POST', '/preview', { config: config() })).body.preview, true); assert.equal(a.invalidations(), 0);
  const result = await a.request('POST', '/revoke', { expectedConfigVersion: 1 }); assert.equal(result.code, 200); assert.equal(result.body.config.enabled, false); assert.deepEqual(result.body.config.grants, []); assert.equal(result.body.config.configVersion, 2);
});
test('Generische Persistenzgrenze erkennt Manipulation ohne korrekte Folgeversion', () => {
  const current = { partnerIntegrations: config() }; const changed = structuredClone(current); changed.partnerIntegrations.enabled = false;
  assert.throws(() => assertPartnerPersistence(current, changed)); changed.partnerIntegrations.configVersion++; assert.doesNotThrow(() => assertPartnerPersistence(current, changed));
  assert.throws(() => currentPartnerConfig({ partnerIntegrations: { ...config(), secret: 'forbidden' } }));
});

test('Vor Verbindungswechsel eingereihter Auftrag bleibt nach Reconnect widerrufen', async () => {
  const wait = deferred(); const { instance, state } = await service({ readData: () => wait.promise });
  const first = send(instance, { protocol: PARTNER_PROTOCOL, id: 'read1', type: 'data.read', appId: 'energyLedger', resourceId: 'site', kind: 'balance' });
  await tick(); const queued = send(instance, command());
  instance.setConnection('disconnected', 'NETWORK_LOST'); instance.setConnection('connected', 'CONNECTED');
  wait.resolve({ pvDirectKwh: 1 }); assert.equal((await first).code, 'REVOKED'); assert.equal((await queued).code, 'REVOKED');
  assert.equal(state.writes, 0); assert.equal(instance.getCurrentRequest('battery1'), null);
});
test('CAS-Commit wartet auf dauerhafte Widerrufsgrenze und bleibt bei deren Fehler aus', async () => {
  const wait = deferred(); let commits = 0;
  const a = api({ invalidate: () => wait.promise, commit: async () => { commits++; } });
  const pending = a.request('POST', '/revoke', { expectedConfigVersion: 1 }); await tick(); assert.equal(commits, 0);
  wait.resolve(); assert.equal((await pending).code, 200); assert.equal(commits, 1);
  const b = api({ invalidate: async () => { throw new Error('sensitive path'); }, commit: async () => { commits++; } });
  const rejected = await b.request('POST', '/revoke', { expectedConfigVersion: 1 }); assert.equal(rejected.code, 500); assert.equal(commits, 1); assert.equal(JSON.stringify(rejected.body).includes('sensitive'), false);
});

test('Nur registrierte interne Fehler behalten ihren öffentlichen HTTP-Status', async () => {
  const { createPublicHttpError } = require(path.join(built, 'http-error-boundary.js'));
  const a = api({ commit: async () => { throw createPublicHttpError(403, 'PARTNER_LICENSE_REQUIRED', 'Lizenz fehlt.'); } });
  const known = await a.request('POST', '/config', { config: config(), expectedConfigVersion: 1 }); assert.equal(known.code, 403); assert.equal(known.body.error, 'PARTNER_LICENSE_REQUIRED');
  const b = api({ commit: async () => { throw { status: 403, code: 'FAKE', message: 'secret content' }; } });
  const unknown = await b.request('POST', '/config', { config: config(), expectedConfigVersion: 1 }); assert.equal(unknown.code, 500); assert.equal(JSON.stringify(unknown.body).includes('secret content'), false);
});
