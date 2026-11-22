/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: scripts/verify-rc66-station-display-stable.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * scripts/verify-rc66-station-display-stable.js
 *
 * Zusammenhang:
 * Der Spiegel hilft uns, die JS-Datei später schrittweise zu typisieren, zu testen und
 * kontrolliert auf TypeScript umzustellen. Produktive Originalquellen liegen unter
 * src-ts/runtime-executables/ bzw. den im generierten JS genannten TS-Pfaden.
 * Dort ändern, Laufzeit erzeugen und danach die Spiegel synchronisieren.
 * Build-/Prüfskripte ohne TS-Original werden weiterhin unter scripts/ gepflegt.
 *
 * Wichtig für die Migration:
 * - Diese Datei enthält vorübergehend @ts-nocheck.
 * - Der nächste Schritt ist pro Modul echte Typisierung statt pauschalem No-Check.
 * - Fachliche Kommentare markieren die Abschnitte, die später einzeln migriert werden.
 *
 * Original-Hash: b1be1ff30ea488ebb48af17d4dbb5f575c9bcc0275661e5a1f48388243ec9c63
 */

/**
 * Code-Teil: Runtime-Spiegel der kompletten Datei
 *
 * Zweck:
 * Dieser Abschnitt enthält den ursprünglichen JavaScript-Code als TypeScript-Parallelkopie.
 * Einzelne Funktionen werden später pro Modul weiter typisiert; Dateien ohne eigene
 * Funktionsdeklarationen bleiben trotzdem über diesen Dateikommentar dokumentiert.
 */

/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
/**
 * Code-Teil: read
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
/**
 * Code-Teil: fail
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const fail = message => {
  console.error(`[rc66-station-display] FEHLER: ${message}`);
  process.exit(1);
};
/**
 * Code-Teil: mustContain
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const mustContain = (rel, needle, message) => {
  if (!read(rel).includes(needle)) fail(`${message || needle} fehlt in ${rel}`);
};
/**
 * Code-Teil: mustNotContain
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const mustNotContain = (rel, needle, message) => {
  if (read(rel).includes(needle)) fail(`${message || needle} darf in ${rel} nicht enthalten sein`);
};

const pkg = JSON.parse(read('package.json'));
/**
 * Code-Teil: parseSemver
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const parseSemver = value => {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(String(value || '').trim());
  return match ? match.slice(1).map(Number) : null;
};
/**
 * Code-Teil: isVersionAtLeast
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const isVersionAtLeast = (actualValue, minimumValue) => {
  const actual = parseSemver(actualValue);
  const minimum = parseSemver(minimumValue);
  if (!actual || !minimum) return false;
  for (let index = 0; index < 3; index += 1) {
    if (actual[index] === minimum[index]) continue;
    return actual[index] > minimum[index];
  }
  return true;
};
if (!isVersionAtLeast(pkg.version, '0.8.191')) {
  fail(`Paketversion muss mindestens 0.8.191 sein, ist aber ${pkg.version || 'unbekannt'}`);
}

const logoRel = 'www/assets/nexowatt-eos-logo-wide.png';
const logoPath = path.join(root, logoRel);
if (!fs.existsSync(logoPath)) fail(`Logo fehlt: ${logoRel}`);
const logo = fs.readFileSync(logoPath);
if (logo.length < 20000 || logo.length > 500000) fail(`Logo-Dateigröße unplausibel: ${logo.length} Byte`);
if (logo.toString('hex', 1, 4) !== '504e47') fail('Logo ist keine PNG-Datei');
const width = logo.readUInt32BE(16);
const height = logo.readUInt32BE(20);
if (width < 600 || height < 250 || width <= height) fail(`Logo-Abmessungen unplausibel: ${width}x${height}`);

mustContain('www/dc-station-display.html', '/static/assets/nexowatt-eos-logo-wide.png', 'Logo im Ladebildschirm');
mustContain('www/dc-station-display.html', 'rel="preload" as="image"', 'Logo-Preload');
mustContain('src-ts/runtime-executables/www/dc-station-display.ts', '/static/assets/nexowatt-eos-logo-wide.png', 'Logo in der Runtime');
// Logo-Caching wird am tatsächlichen Fetch-Handler funktional geprüft.
const swSource = read('src-ts/runtime-executables/www/sw.ts');
const cacheVersionMatch = /nexowatt-cache-v(\d+)/.exec(swSource);
if (!cacheVersionMatch || Number(cacheVersionMatch[1]) < 481) {
  fail(`Service-Worker-Cachekennung muss mindestens v481 sein, gefunden: ${cacheVersionMatch ? cacheVersionMatch[0] : 'keine'}`);
}

mustNotContain('www/dc-station-display.html', 'CSV', 'CSV-Schaltfläche im HTML');
mustNotContain('src-ts/runtime-executables/www/dc-station-display.ts', 'operator.csv', 'CSV-Link in der Stationsoberfläche');
mustNotContain('src-ts/runtime-executables/www/dc-station-display.ts', 'csvExport', 'CSV-Bedienelement in der Stationsoberfläche');
// Der Service-/Adminexport bleibt ausdrücklich erhalten.
mustContain('src-ts/runtime-executables/main.ts', "app.get('/api/display/station/:token/operator.csv'", 'CSV-Service-Route');

for (const [needle, message] of [
  ['derivePresentationModel', 'abgeleitete Entscheidung/Warnung'],
  ['withPresentationModel', 'sicheres View-Modell'],
  ['renderStatusStrip', 'kompakte Statusleiste'],
  ['renderSummary', 'Stationszusammenfassung'],
  ['renderDecisionPanel', 'EOS-Entscheidungsbereich'],
  ['renderWarningsPanel', 'Warnungs-/Fehlerbereich'],
  ['connectorLayout', 'dynamisches Mehr-LP-Layout'],
  ['--lp-columns', 'dynamische Spaltenzahl'],
  ['vehicleSocPct', 'Fahrzeug-SoC auf der Stationsseite'],
  ['hardwareCommandConfirmed', 'Aktorbestätigung in der Diagnose'],
  ['mappingIssues', 'Zuordnungsfehler in der Diagnose'],
  ['directHardwareWrite', 'Single-Writer-Hinweis'],
]) mustContain('src-ts/runtime-executables/www/dc-station-display.ts', needle, message);

for (const [needle, message] of [
  ['body{overflow:hidden}', 'kein Desktop-Seitenscrollen'],
  ['grid-template-columns:repeat(var(--lp-columns,1)', 'dynamisches LP-Raster'],
  ['data-density="dense"', 'kompakte Darstellung großer Stationen'],
  ['max-height:840px', 'kurzer 16:9-Kioskmodus'],
  ['nw-status-strip', 'Statusleisten-Design'],
  ['nw-summary-grid', 'Übersichtskarten'],
  ['nw-insights-grid', 'Entscheidung und Warnungen'],
  ['nw-energy-split', 'Solar-/Netzanteil pro Session'],
]) mustContain('www/dc-station-display.css', needle, message);

for (const needle of [
  'stationMaxPowerW',
  'tariffActive',
  'gridCapBinding',
  'phaseCapBinding',
  'para14aBinding',
  'storageAssistActive',
  'staleMeter',
  'staleBudget',
  'goalTariffOverride',
  'availabilityOwner',
]) mustContain('src-ts/runtime-executables/main.ts', needle, `Display-Payload ${needle}`);

mustContain('src-ts/runtime-executables/main.ts', "require('./lib/station-display-presentation')", 'typisierter Stationsdisplay-Präsentationshelfer');
mustContain('src-ts/runtime-executables/main.ts', 'summary: presentation.summary', 'typisierte Stationszusammenfassung im Backend-Payload');
mustContain('src-ts/runtime-executables/main.ts', 'decisionLines: presentation.decisionLines', 'typisierte EOS-Entscheidungsgründe im Backend-Payload');
mustContain('src-ts/runtime-executables/main.ts', 'warnings: presentation.warnings', 'typisierte Warnungen im Backend-Payload');
mustContain('src-ts/runtime-executables/main.ts', 'vehicleStateNormalized', 'normalisierter Fahrzeugzustand im LP-Diagnosepayload');
for (const [needle, message] of [
  ['shortDecision', 'verständliche Kurzentscheidung'],
  ['decisionLines: decisionLines.slice(0, 8)', 'strukturierte EOS-Entscheidungsgründe'],
  ['warnings: warnings.slice(0, 12)', 'strukturierte Warnungen'],
  ['never\n * writes states', 'read-only Präsentationsvertrag'],
]) mustContain('src-ts/runtime-executables/lib/station-display-presentation.ts', needle, message);

if (pkg.scripts?.['test:rc66-station-display-browser'] !== 'node scripts/verify-rc66-station-display-browser.js') {
  fail('RC66-Browsertest ist nicht im Paket-Skriptvertrag registriert.');
}
if (!fs.existsSync(path.join(root, 'scripts/verify-rc66-station-display-browser.js'))) {
  fail('RC66-Browsertestdatei fehlt.');
}

if (!(pkg.files || []).includes(logoRel)) fail(`${logoRel} fehlt in package.json.files`);
if (!(pkg.files || []).includes('lib/station-display-presentation.js')) fail('typisierter Präsentationshelfer fehlt in package.json.files');

// Browser-Runtime muss als JavaScript parsebar sein; dabei wird sie nicht ausgeführt.
try {
  new vm.Script(read('www/dc-station-display.js'), { filename: 'www/dc-station-display.js' });
} catch (error) {
  fail(`Stations-Runtime ist syntaktisch ungültig: ${error.message}`);
}

/** Der reale SW-Handler muss das öffentliche PNG nach Abruf zwischenspeichern,
 * darf aber weder private/fehlerhafte Antworten noch Stationsdaten übernehmen.
 * VM-/Fetch-/Cache-Doubles, kein Browser- oder Offline-Inbetriebnahmenachweis. */
async function verifyServiceWorkerLogoCache(swSource, logo) {
  const handlers = {}, stored = new Map();
  const calls = { fetch: [], match: [], put: [] };
  let responseSpec = {}, offline = false;
  const origin = 'https://station.fixture.invalid';
  const publicPath = '/static/assets/nexowatt-eos-logo-wide.png';
/**
 * Code-Teil: flush
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const context = vm.createContext({
    URL, Response,
    self: { location: { origin }, addEventListener: (type, fn) => { handlers[type] = fn; }, skipWaiting() {}, clients: { claim() {} } },
    caches: {
      match: async req => { calls.match.push(req.url); return stored.get(req.url)?.clone(); },
      open: async () => ({ put: async (req, response) => { calls.put.push(req.url); stored.set(req.url, response.clone()); } }),
      keys: async () => [], delete: async () => true,
    },
    fetch: async (req, options) => {
      calls.fetch.push({ url: req.url, options });
      if (offline) throw new Error('fixture-offline');
      const response = new Response(logo, { status: responseSpec.status || 200,
        headers: { 'Content-Type': 'image/png', ...(responseSpec.cacheControl ? { 'Cache-Control': responseSpec.cacheControl } : {}) } });
      if (responseSpec.redirected) Object.defineProperty(response, 'redirected', { value: true });
      return response;
    },
  });
  vm.runInContext(swSource, context, { filename: 'actual-www-sw.ts' });
  assert.equal(typeof handlers.fetch, 'function', 'actual service-worker fetch handler');
/**
 * Code-Teil: request
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
  const request = async (pathname, options = {}) => {
    let pending;
    handlers.fetch({ request: { url: (options.origin || origin) + pathname,
      method: options.method || 'GET', mode: options.mode || 'cors' }, respondWith(value) { pending = value; } });
    if (!pending) return undefined;
    const result = await pending; await flush(); return result;
  };

  const fetched = await request(publicPath);
  assert.equal(fetched.status, 200);
  assert.deepEqual(Buffer.from(await fetched.arrayBuffer()), logo, 'actual shipped PNG reaches the client unchanged');
  assert.deepEqual(calls.put, [origin + publicPath], 'public logo is stored after its successful network request');
  assert.equal(calls.fetch.length, 1);
  offline = true;
  const cached = await request(publicPath);
  assert.deepEqual(Buffer.from(await cached.arrayBuffer()), logo, 'previously fetched public logo can be read from cache');
  assert.equal(calls.fetch.length, 1, 'cache hit does not need the network');
  offline = false;

  for (const [name, spec] of [['no-store', { cacheControl: 'no-store' }], ['private', { cacheControl: 'private, max-age=60' }],
    ['unauthorized', { status: 401 }], ['redirected', { redirected: true }]]) {
    responseSpec = spec;
    const before = calls.put.length;
    await request(publicPath + '?fixture=' + name);
    assert.equal(calls.put.length, before, name + ' response must not enter the public asset cache');
  }
  responseSpec = {};
  for (const pathname of ['/api/assets/nexowatt-eos-logo-wide.png', '/api/display/station/fixture-token/logo.png', '/dc-station-display.html']) {
    const beforeMatch = calls.match.length, beforePut = calls.put.length;
    await request(pathname, { mode: pathname.endsWith('.html') ? 'navigate' : 'cors' });
    assert.equal(calls.fetch.at(-1).options.cache, 'no-store', 'private/page paths always reach the server');
    assert.equal(calls.match.length, beforeMatch, 'private/page path never reads an old cache');
    assert.equal(calls.put.length, beforePut, 'private/page response is never persisted');
  }
  offline = true;
  const locked = await request('/dc-station-display.html', { mode: 'navigate' });
  assert.equal(locked.status, 503, 'offline station page never reuses a cached private page');
  assert.match(await locked.text(), /Verbindung erforderlich/);
  assert.equal(await request(publicPath, { origin: 'https://foreign.fixture.invalid' }), undefined, 'foreign-origin assets are not intercepted');
  assert.equal(await request(publicPath, { method: 'POST' }), undefined, 'mutations never use the asset cache');
};

verifyServiceWorkerLogoCache(swSource, logo).then(() => {
  console.log(`[rc66-station-display] OK: modernes Vollbildlayout, NexoWatt-Branding, Mehr-LP-Raster, Status-/Entscheidungsdiagnose, kein CSV-UI und Single-Writer-Vertrag sind abgesichert (${width}x${height}, ${logo.length} Byte).`);
}, error => fail(`Service-Worker-Logo/Public-Asset-Vertrag: ${error.message}`));
