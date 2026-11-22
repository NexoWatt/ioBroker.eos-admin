'use strict';
/**
 * Echter Chromium-Formtest der gebauten App Dynamischer Netzanschluss gegen lokale Mock-API.
 * Reale Domainvalidierung und Messwertsammlung; keine Hardware, keine Produktionseingriffe.
 * Optional separat ausführen: NODE_PATH=<Playwright-Module> CHROMIUM_BIN=<Chromium> node test/browser-nvp-topology.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.NW_PLAYWRIGHT_MODULE || 'playwright');
const { validateDynamicGridConfig, collectDynamicSnapshot, dynamicGridDefaults } = require('../ems/services/dynamic-grid-config');
const root = path.resolve(__dirname, '..');
const artifacts = process.env.NVP_UI_QA_DIR || path.resolve(root, '../../dynamic-grid-ui-qa');
fs.mkdirSync(artifacts, { recursive: true });
const rootMeasurement = { stateId: 'fixture.m0', unit: 'W', sign: 1, maxAgeMs: 5000 };
let config = dynamicGridDefaults();
let appState = { installed: false, enabled: false, active: false };
let role = 'installer';
let conflictNextSave = false;
const requests = [];
const validate = (draft, active = false) => validateDynamicGridConfig(draft, { active, generalMeasurement: rootMeasurement });
const live = (draft, preview = false) => {
  const validation = validate(draft, true), now = Date.now();
  if (!validation.valid) return { active: false, status: 'config_invalid', errors: validation.errors, ts: now };
  const sample = val => ({ val, ts: now, q: 0, ack: true });
  const measurements = { 'fixture.m0': sample(20000), 'fixture.m1': sample(5000), 'fixture.ess': sample(2000), 'fixture.soc': sample(50), 'fixture.target': sample(8500), 'fixture.applied': sample(8500) };
  return { active: !preview && appState.active, status: preview ? 'preview' : appState.active ? 'active' : 'inactive', configVersion: draft.configVersion, ts: now,
    snapshot: collectDynamicSnapshot(validation.topology, measurements, now), groups: [], budget: { safe: true, status: 'active', reason: 'Mock-Anschlussbudget eingehalten.' },
    storageResults: [{ id: draft.storages[0]?.id, requestedW: 10000, targetW: 8500, actualW: 2000, accepted: !preview, commandConfirmed: !preview, appliedConfirmed: false, writes: [] }],
    pendingIntervals: [{ id: draft.storages[0]?.id, targetW: 8500, appliedConfirmed: false }], writesPerformed: preview ? 0 : 1 };
};
const state = () => ({ ok: true, config, app: appState, rootSource: { measurement: rootMeasurement, valid: true, reason: '' }, status: live(config), locked: false, maxStorages: 10, validation: validate(config) });
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  if (url.pathname === '/api/strict-auth/status') return json(200, { enabled: true, authed: true, role, user: 'test', capabilities: role === 'installer' ? ['appcenter.open'] : ['*'] });
  if (url.pathname.startsWith('/api/dynamic-grid')) {
    if (role !== 'installer') return json(403, { ok: false, message: 'Installer erforderlich.' });
    if (req.method === 'GET') return json(200, state());
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    requests.push({ path: url.pathname, body });
    if (url.pathname.endsWith('/preview')) { const validation = validate(body.config, true); return json(200, { ok: true, preview: true, validation, status: validation.valid ? live(body.config, true) : null, previewAvailable: validation.valid }); }
    if (conflictNextSave) { conflictNextSave = false; return json(409, { ok: false, message: 'Version geändert.', details: [] }); }
    if (body.expectedConfigVersion !== config.configVersion) return json(409, { ok: false, message: 'Version geändert.', details: [] });
    const desiredApp = body.app || appState;
    const active = desiredApp.installed && desiredApp.enabled;
    const validation = validate(body.config, active);
    if (!validation.valid) return json(422, { ok: false, message: 'Die Konfiguration ist nicht gültig.', details: validation.errors });
    config = { ...validation.config, configVersion: config.configVersion + 1 };
    appState = { installed: desiredApp.installed === true, enabled: !!active, active: !!active };
    return json(200, state());
  }
  const file = url.pathname.startsWith('/ems/dynamic-grid/assets/') ? path.join(root, 'admin/react/assets', path.basename(url.pathname)) : path.join(root, 'admin/react/index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html' });
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/ems/dynamic-grid/#/dynamic-grid`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || process.env.NW_CHROMIUM_EXECUTABLE || undefined, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(base);
    await page.getByRole('heading', { level: 1, name: 'Dynamischer Netzanschluss' }).waitFor();
    await page.getByText('fixture.m0', { exact: true }).waitFor();
    assert.equal(await page.locator('.nw-dynamic-root-source input').count(), 0, 'M0 source must be read-only');
    assert.match(await page.getByRole('link', { name: 'Zuordnung → Allgemein öffnen' }).getAttribute('href'), /tab=mapping/);
    assert.equal(await page.getByRole('button', { name: 'Speichern und aktivieren', exact: true }).isEnabled(), true, 'activation is available, not globally gated');
    const beforeInvalid = config.configVersion;
    await page.getByRole('button', { name: 'Speichern und aktivieren', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Konfiguration ist nicht gültig' }).waitFor();
    assert.equal(config.configVersion, beforeInvalid); assert.equal(appState.active, false, 'invalid activation must be atomic');
    await page.getByRole('button', { name: 'Speicher hinzufügen', exact: true }).click();
    await page.getByRole('button', { name: 'Entwurf speichern', exact: true }).click();
    await page.getByText('Einrichtung als inaktiver Entwurf gespeichert.', { exact: true }).waitFor();
    assert.equal(config.storages.length, 1); assert.equal(config.storages[0].id, ''); assert.equal(appState.active, false);
    const m0 = page.locator('.nw-nvp-point').nth(0), m1 = page.locator('.nw-nvp-point').nth(1);
    await m0.getByLabel(/^Bezug · Anschlussgrenze/).fill('100000');
    await m0.getByLabel(/^Einspeisung · Anschlussgrenze/).fill('100000');
    await m0.getByLabel(/^Bezug · feste Reserve/).fill('1000');
    await m1.getByLabel(/^M1-Nettoleistung · Datenpunkt/).fill('fixture.m1');
    await m1.getByLabel(/^\s*Einspeisung lokal begrenzen/).check();
    await m1.getByLabel(/^Einspeisung · Anschlussgrenze/).fill('0');
    await m1.getByLabel(/^Einspeisung · Anschlussgrenze/).fill('');
    assert.equal(await m1.getByLabel(/^\s*Einspeisung lokal begrenzen/).isChecked(), true);
    await page.getByRole('button', { name: 'Einrichtung prüfen', exact: true }).click();
    await page.getByText('Einrichtung prüfen', { exact: true }).last().waitFor();
    assert.equal(requests.at(-1).body.config.points[1].exportLimitW, '', 'empty limit is never silently zero or absent');
    await m1.getByLabel(/^Einspeisung · Anschlussgrenze/).fill('0');
    await page.getByLabel(/^Speicherkennung/).fill('my-free-battery');
    await page.getByLabel(/^Speichername/).fill('Eigener Speicher');
    assert.equal(await page.getByLabel(/^Physischer Anschlussbereich/).inputValue(), '');
    await page.getByLabel(/^Physischer Anschlussbereich/).selectOption('M1');
    await page.getByLabel(/^Regelmesspunkt/).selectOption('M1');
    await page.getByLabel(/^Regel-\/Dispatchgruppe/).fill('house');
    const modes = await page.getByLabel(/^Betriebsaufgabe/).locator('option').evaluateAll(rows => rows.map(row => row.value));
    assert.deepEqual(modes, ['selfConsumption', 'zeroExport', 'peakShaving', 'arbitrage', 'tariff']);
    await page.getByLabel(/^Betriebsaufgabe/).selectOption('arbitrage');
    assert.equal(await page.getByLabel(/^Stellhoheit/).inputValue(), 'eos');
    await page.getByLabel(/^Betriebsaufgabe/).selectOption('selfConsumption');
    await page.getByLabel(/^Batterie-Istleistung · Datenpunkt/).fill('fixture.ess');
    await page.getByLabel(/^SoC · Datenpunkt/).fill('fixture.soc');
    await page.getByLabel(/^Maximale Ladeleistung/).fill('50000');
    await page.getByLabel(/^Maximale Entladeleistung/).fill('50000');
    await page.getByLabel(/^Höchste Leistungsänderung/).fill('10000');
    await page.getByLabel(/^Leistungssollwert · Schreib-Datenpunkt/).fill('fixture.target');
    await page.getByLabel(/^Leistungssollwert · Rücklese-Datenpunkt/).fill('fixture.applied');
    await page.getByRole('button', { name: 'Einrichtung prüfen', exact: true }).click();
    await page.getByText('Einrichtung geprüft', { exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Vorschau der Einrichtung', exact: true }).waitFor();
    const draft = requests.at(-1).body.config;
    assert.equal(Object.hasOwn(draft.points[0], 'measurement'), false);
    assert.equal(draft.points[1].exportLimitW, 0); assert.equal(draft.points[1].importLimitW, null);
    assert.equal(draft.storages[0].id, 'my-free-battery');
    await page.getByRole('button', { name: 'Speichern und aktivieren', exact: true }).click();
    await page.getByText('Dynamischer Netzanschluss aktiviert. Die Laufzeit prüft Messqualität und Bestätigungen vor der Stellwertausgabe.', { exact: true }).waitFor();
    assert.equal(appState.active, true);
    assert.deepEqual(requests.at(-1).body.app, { installed: true, enabled: true });
    const status = page.getByRole('table', { name: 'Sollwerte, Bestätigung und Messung' });
    assert.match(await status.innerText(), /10 kW/); assert.match(await status.innerText(), /8,5 kW/); assert.match(await status.innerText(), /2 kW/);
    assert.match(await status.innerText(), /Rücklesung bestätigt/); assert.match(await status.innerText(), /Noch nicht bestätigt/);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(artifacts, 'dynamic-grid-desktop.png') });
    await status.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, 'dynamic-grid-status.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(artifacts, 'dynamic-grid-mobile-top.png') });
    await m1.getByLabel(/^M1-Nettoleistung · Datenpunkt/).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, 'dynamic-grid-mobile-m1.png') });
    await page.getByLabel(/^Batterie-Istleistung · Datenpunkt/).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, 'dynamic-grid-mobile-storage.png') });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'mobile form must not overflow horizontally');
    conflictNextSave = true;
    const beforeConflict = requests.filter(row => row.path.endsWith('/config')).length;
    await page.getByLabel(/^Höchste zeitliche Abweichung/).fill('900');
    await page.getByRole('button', { name: 'Änderungen speichern', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'gespeicherte Stand wurde geändert' }).waitFor();
    assert.equal(requests.filter(row => row.path.endsWith('/config')).length, beforeConflict + 1);
    assert.equal(await page.getByLabel(/^Höchste zeitliche Abweichung/).inputValue(), '900');
    await page.getByRole('button', { name: 'App deaktivieren', exact: true }).click();
    await page.getByText('App installiert und inaktiv. Die Einrichtung bleibt erhalten.', { exact: true }).waitFor();
    assert.equal(appState.active, false); assert.equal(config.maxSkewMs, 1000, 'deactivate uses saved config, not unsaved edits');
    assert.equal(await page.getByLabel(/^Höchste zeitliche Abweichung/).inputValue(), '900', 'lifecycle preserves unsaved draft');
    role = 'user';
    const customer = await browser.newPage(); await customer.goto(base);
    await customer.getByRole('heading', { name: 'Zugriff geschützt' }).waitFor();
    assert.equal(await customer.getByRole('heading', { name: 'Speicher und Betriebsaufgaben' }).count(), 0);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ result: 'PASS', scenarios: ['separate-app-route', 'M0-general-readonly', 'activation-available', 'invalid-activation-atomic', 'incomplete-free-draft', 'zero-versus-empty-and-unknown', 'generic-storage-five-purposes', 'explicit-area-and-authority', 'domain-preview', 'atomic-save-and-activate', 'requested-target-confirmed-measured-distinct', 'CAS-no-retry-draft-preserved', 'deactivate-retains-unsaved-draft', 'mobile-no-overflow', 'customer-wildcard-denied'], screenshots: artifacts }, null, 2));
  } catch (error) {
    await page.screenshot({ path: path.join(artifacts, 'dynamic-grid-failure.png') }).catch(() => {});
    fs.writeFileSync(path.join(artifacts, 'dynamic-grid-failure.txt'), await page.locator('body').innerText().catch(() => ''));
    throw error;
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; server.close(); });
