/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft gebaute Partner-React-Oberflächen im lokalen Chromium mit Mock-API.
 * Daten und Wirkung: Startet nur einen Loopback-Testserver, erzeugt Screenshots und bereinigte Prüfbelege.
 * Bei Änderungen: Formularrollen, Konflikte, Request-Anzahl, Viewports und Buildbezug mitprüfen.
 * Verknüpfungen: docs/reports/partner-arbitrage-2026-10-28/UI_PRUEFVERMERK_DE.md
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium } = require(process.env.NEXOWATT_PLAYWRIGHT_PATH || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs/reports/partner-arbitrage-2026-10-28');
fs.mkdirSync(output, { recursive: true });
let scenario = 'normal'; let mutations = 0; const errors = [];
const initial = () => ({ ok: true, config: { configVersion: 1, enabled: false, partnerId: '', endpoint: '', credentialRef: '', grants: [{ appId: 'arbitrage', resourceId: 'single', permissions: ['telemetry.read'] }], arbitrage: { profile: 'household', resources: [{ id: 'single', maxChargeW: 5000, maxDischargeW: 5000, maxImportW: 12000, maxExportW: 8000, minSocPct: 20, maxSocPct: 90, allowGridCharge: false, allowGridExport: false, commissioned: false }], maxCommandSeconds: 60 } }, app: { installed: true, enabled: false, active: false }, status: { connection: 'disabled', reason: 'DISABLED', controlAvailable: false, revision: 1 }, validation: { valid: true, errors: [] } });
let snapshot = initial();
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
  if (url.pathname === '/api/strict-auth/status') return send(200, { enabled: true, authed: true, role: 'admin', user: 'test-admin', capabilities: ['*'] });
  if (url.pathname.startsWith('/api/installer/partner-integrations')) {
    if (scenario === 'forbidden') return send(403, { ok: false, error: 'FORBIDDEN', message: 'Installateur- oder Administratorrolle erforderlich.' });
    if (req.method === 'GET') return send(200, snapshot);
    let bytes = ''; for await (const chunk of req) bytes += chunk;
    const body = JSON.parse(bytes || '{}');
    if (url.pathname.endsWith('/preview')) return send(200, { ...snapshot, config: null, preview: true, validation: { valid: false, errors: [{ path: 'grants.0', code: 'INVALID_CONFIG', message: 'Testhinweis: Freigabe der Ressource prüfen.' }] } });
    mutations++;
    if (scenario === 'conflict') return send(409, { ok: false, error: 'CONFIG_VERSION_CONFLICT', message: 'Partnerkonfiguration wurde zwischenzeitlich geändert.' });
    if (scenario === 'disconnect') return req.socket.destroy();
    if (url.pathname.endsWith('/revoke')) snapshot = { ...snapshot, config: { ...snapshot.config, enabled: false, grants: [], configVersion: snapshot.config.configVersion + 1 } };
    else snapshot = { ...snapshot, config: { ...body.config, configVersion: snapshot.config.configVersion + 1 }, app: body.app ? { ...body.app, active: body.app.installed && body.app.enabled } : snapshot.app };
    return send(200, snapshot);
  }
  if (url.pathname === '/host') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<!doctype html><html lang="de"><body style="margin:0;padding:12px;background:#10141a"><iframe title="Test EMS" style="width:100%;height:4000px;border:0" src="/ems/arbitrage/?embedded=1#/arbitrage"></iframe></body></html>'); }
  let file;
  if (url.pathname === '/static/styles.css') file = path.join(root, 'www/styles.css');
  else {
    const relative = url.pathname.replace(/^\/ems\/(?:arbitrage|partner-integrations)\//, '');
    file = path.join(root, 'admin/react', relative === '' ? 'index.html' : relative);
    if (!file.startsWith(path.join(root, 'admin/react') + path.sep)) { res.writeHead(403); return res.end(); }
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.NEXOWATT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.NEXOWATT_CHROMIUM_EXECUTABLE, args: ['--no-sandbox', '--disable-dev-shm-usage', '--in-process-gpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  const loadedAssets = new Set();
  page.on('response', response => {
    const pathname = new URL(response.url()).pathname;
    const match = pathname.match(/\/assets\/([A-Za-z0-9_.-]+\.(?:js|css))$/);
    if (match) loadedAssets.add(`admin/react/assets/${match[1]}`);
    if (pathname === '/static/styles.css') loadedAssets.add('www/styles.css');
  });
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.__partnerMutationCalls = 0;
    window.fetch = (input, init) => {
      if (init?.method === 'POST' && String(input).includes('/api/installer/partner-integrations/') && !String(input).endsWith('/preview')) window.__partnerMutationCalls++;
      return original(input, init);
    };
  });
  const checks = [];
  const navigate = async (hash = 'arbitrage') => { await page.goto(`${base}/ems/${hash === 'arbitrage' ? 'arbitrage' : 'partner-integrations'}/#/${hash}`); await page.getByText('Gespeicherter Stand geladen.', { exact: true }).waitFor(); };
  const overflow = async () => { const metric = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth })); assert.ok(metric.scroll <= metric.client + 1, JSON.stringify(metric)); return metric; };
  try {
    await navigate(); await page.getByText('Diagnose / Steuerung gesperrt', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, 'arbitrage-desktop.png') });
    checks.push({ name: 'Arbitrage Desktop / gesperrter Standard', result: 'PASS', viewport: '1440x1000', overflow: await overflow() });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: path.join(output, 'arbitrage-mobil.png') });
    checks.push({ name: 'Arbitrage Mobil / kein horizontaler Überlauf', result: 'PASS', viewport: '390x844', overflow: await overflow() });
    await page.getByRole('heading', { name: 'Gemeinsame Partnerverbindung', exact: true }).scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: path.join(output, 'arbitrage-einrichtung-mobil.png') });
    await page.getByRole('button', { name: 'Freigaben prüfen', exact: true }).click();
    await page.getByText('Testhinweis: Freigabe der Ressource prüfen.').waitFor();
    checks.push({ name: 'Ungültige Vorschau mit config:null zeigt Validierung', result: 'PASS' });
    scenario = 'conflict'; mutations = 0;
    await page.getByLabel('Partnerkennung', { exact: true }).fill('partner_test');
    await page.getByRole('button', { name: 'Konfiguration speichern', exact: true }).click();
    await page.getByText('Der gespeicherte Stand wurde geändert. Ihr Entwurf bleibt erhalten. Vor dem nächsten Speichern bitte neu laden.', { exact: true }).first().waitFor();
    await page.getByRole('button', { name: 'Konfiguration speichern', exact: true }).evaluate(button => { if (!button.disabled) throw new Error('Speichern nicht gesperrt'); });
    assert.equal(await page.getByLabel('Partnerkennung', { exact: true }).inputValue(), 'partner_test'); assert.equal(mutations, 1);
    checks.push({ name: 'HTTP409: Entwurf erhalten, weitere Speicherung gesperrt, ein Request', result: 'PASS' });
    scenario = 'normal'; await page.getByRole('button', { name: 'Entwurf verwerfen und neu laden', exact: true }).click();
    await page.getByText('Gespeicherter Stand geladen.', { exact: true }).waitFor();
    scenario = 'disconnect'; mutations = 0; await page.evaluate(() => { window.__partnerMutationCalls = 0; });
    await page.getByRole('button', { name: 'Arbitrage-App einschalten', exact: true }).click();
    await page.getByText('Das Ergebnis der letzten Änderung ist unklar. Vor weiteren Änderungen den Serverstand neu laden.', { exact: true }).waitFor();
    const mutationFetchCalls = await page.evaluate(() => window.__partnerMutationCalls);
    assert.equal(mutationFetchCalls, 1); assert.equal(await page.getByRole('button', { name: 'Konfiguration speichern', exact: true }).isDisabled(), true);
    checks.push({ name: 'Abgebrochene Mutation: ein JavaScript-Aufruf, Freigabe unbestätigt, Reload erforderlich', result: 'PASS', mutationFetchCalls, observedBrowserTransportRequests: mutations, note: 'Chromium kann bei Socket-Abbruch vor HTTP-Headern auf Transportebene wiederholen. Serverseitiges CAS bleibt erforderlich.' });
    scenario = 'normal'; await navigate('partner-integrations/energyLedger');
    assert.equal(await page.getByRole('button', { name: 'Arbitrage-App einschalten', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Ressource freigeben', exact: true }).click();
    assert.equal(await page.getByLabel('Bilanzdaten lesen', { exact: true }).count(), 1); assert.equal(await page.getByLabel('Laden anfragen', { exact: true }).count(), 0);
    checks.push({ name: 'Bilanz getrennt: nur Datenrecht, kein Arbitrage-Appschalter', result: 'PASS', overflow: await overflow() });
    await navigate('partner-integrations/directMarketing');
    await page.getByRole('button', { name: 'Ressource freigeben', exact: true }).click();
    assert.equal(await page.getByLabel('Begrenzung anfragen', { exact: true }).count(), 1); assert.equal(await page.getByLabel('Laden anfragen', { exact: true }).count(), 0);
    checks.push({ name: 'Direktvermarktung getrennt: Begrenzungsrecht, keine Speicherrechte', result: 'PASS', overflow: await overflow() });
    scenario = 'forbidden'; await page.reload();
    await page.getByText('Installateur- oder Administratorrolle erforderlich.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Konfiguration speichern', exact: true }).count(), 0);
    checks.push({ name: 'HTTP403 zeigt Fehler ohne beschreibbares Formular', result: 'PASS' });
    scenario = 'normal'; await page.goto(`${base}/host`);
    const frame = page.frameLocator('iframe'); await frame.getByText('Gespeicherter Stand geladen.', { exact: true }).waitFor();
    const metric = await frame.locator('html').evaluate(node => ({ scroll: node.scrollWidth, client: node.clientWidth }));
    assert.ok(metric.scroll <= metric.client + 1); checks.push({ name: 'Eingebettete EMS-Oberfläche lädt im lokalen Rahmen', result: 'PASS', overflow: metric });
    assert.deepEqual(errors, []); checks.push({ name: 'Keine JavaScript-Seitenfehler', result: 'PASS' });
    const assets = [...loadedAssets].sort().map(relative => ({ path: relative, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex') }));
    const screenshots = ['arbitrage-desktop.png', 'arbitrage-mobil.png', 'arbitrage-einrichtung-mobil.png'].map(name => { const bytes = fs.readFileSync(path.join(output, name)); return { path: name, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), sha256: crypto.createHash('sha256').update(bytes).digest('hex') }; });
    const report = { result: 'PASS', date: new Date().toISOString(), node: process.version, chromium: browser.version(), checks, assets, screenshots, limitation: 'Lokaler Chromium mit Mock-API; keine reale Händlerverbindung, Gerätewirkung oder Anlagenabnahme.' };
    fs.writeFileSync(path.join(output, 'ui-browser-report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error.stack); server.close(); process.exitCode = 1; });
