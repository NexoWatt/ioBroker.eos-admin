'use strict';
/**
 * Echte Navigation: EMS-App-Katalog → installabhängiger Reiter → geschützte
 * React-Detailansicht. Nutzt den vorhandenen AppCenter-Mock und aktuelle
 * kanonische TS-Quellen (isoliert transpiliert), ohne globale Runtime-Synchronisation.
 * Browserartefakte liegen ausschließlich außerhalb des Repositorys.
 * Aufruf: NW_PLAYWRIGHT_MODULE=<Modul> CHROMIUM_BIN=<Browser> node test/browser-ems-navigation.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const { chromium } = require(process.env.NW_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const artifacts = process.env.NW_NAVIGATION_QA_DIR || path.resolve(root, '../../ems-navigation-qa');
assert.ok(!path.resolve(artifacts).startsWith(root + path.sep), 'Interne Screenshots müssen außerhalb des Repositorys liegen.');
fs.mkdirSync(artifacts, { recursive: true });
const fixtureFile = path.join(root, 'scripts/verify-stable-1.0.3-home-appcenter-access.cjs');
const original = fs.readFileSync(fixtureFile, 'utf8');
const fixture = new Module(fixtureFile, module);
fixture.filename = fixtureFile; fixture.paths = Module._nodeModulePaths(path.dirname(fixtureFile));
const canonical = fs.readFileSync(path.join(root, 'src-ts/runtime-executables/www/ems-apps.ts'), 'utf8');
const compiled = ts.transpileModule(canonical, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
const fixtureRequire = fixture.require.bind(fixture);
fixture.require = id => id === 'node:fs' ? {
  ...fs,
  readFileSync: (file, ...args) => path.resolve(String(file)) === path.join(root, 'www/ems-apps.js') ? compiled : fs.readFileSync(file, ...args),
} : fixtureRequire(id);
fixture._compile(original.slice(0, original.indexOf('function staticContracts()')) + '\nmodule.exports = { buildHomeAppCenterHtml };', fixtureFile);
let role = 'installer';
let persistedInstalled = false;
const config = { schemaVersion: 1, configVersion: 1, maxSkewMs: 1000, points: [
  { id: 'M0', source: 'general', importLimitW: null, exportLimitW: null, importReserveW: 0, exportReserveW: 0 },
  { id: 'M1', source: 'mapped', measurement: { stateId: '', unit: 'W', sign: 1, maxAgeMs: 5000 }, importLimitW: null, exportLimitW: null, importReserveW: 0, exportReserveW: 0 },
], storages: [], pvAssignments: [] };
function appCenterFixture() {
  const html = fixture.exports.buildHomeAppCenterHtml()
    .replace('window.fetch = async function(input, init) {', `
window.__nwAuthStatus.role = ${JSON.stringify(role)};
window.__nwHomeLicense.homeIncludedApps.push('dynamicGrid');
for (const key of Object.keys(window.__nwConfig.emsApps.apps)) {
  window.__nwConfig.emsApps.apps[key] = { installed: key === 'grid', enabled: key === 'grid' };
}
window.__nwConfig.emsApps.apps.dynamicGrid = { installed: ${persistedInstalled}, enabled: false };
window.__nwConfig.dynamicGridConnection.configVersion = ${persistedInstalled ? 2 : 1};
window.__nwWrites = [];
window.fetch = async function(input, init) {`)
    .replace('data = { ok: true, license: window.__nwHomeLicense, config: window.__nwConfig };', `
if (init && init.method === 'POST') {
  const payload = JSON.parse(init.body);
  window.__nwWrites.push(payload);
  if (payload.expectedDynamicGridConfigVersion !== window.__nwConfig.dynamicGridConnection.configVersion) return new Response(JSON.stringify({ ok: false, error: 'DYNAMIC_GRID_VERSION_CONFLICT' }), { status: 409 });
  window.__nwConfig = Object.assign({}, window.__nwConfig, payload.patch, { dynamicGridConnection: Object.assign({}, window.__nwConfig.dynamicGridConnection, { configVersion: payload.expectedDynamicGridConfigVersion + 1 }) });
}
data = { ok: true, license: window.__nwHomeLicense, config: window.__nwConfig };`);
  return html;
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (status, payload) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(payload)); };
  if (url.pathname === '/ems-apps.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(appCenterFixture()); }
  if (url.pathname === '/api/strict-auth/status') return json(200, { enabled: true, authed: true, role, user: 'test', capabilities: role === 'installer' ? ['appcenter.open'] : ['*'] });
  if (url.pathname.startsWith('/api/dynamic-grid')) return role === 'user' ? json(403, { ok: false }) : json(200, { ok: true, config: { ...config, configVersion: 2 }, app: { installed: true, enabled: false, active: false }, rootSource: { valid: true, measurement: { stateId: 'fixture.general.grid', unit: 'W', sign: 1, maxAgeMs: 5000 } }, status: { status: 'inactive', active: false, ts: Date.now() }, maxStorages: 2, locked: false, validation: { valid: true, errors: [], activationErrors: [], activeEligible: false } });
  const file = url.pathname.startsWith('/ems/dynamic-grid/assets/') ? path.join(root, 'admin/react/assets', path.basename(url.pathname)) : url.pathname.startsWith('/static/') ? path.join(root, 'www', path.basename(url.pathname)) : url.pathname === '/ems/dynamic-grid/' ? path.join(root, 'admin/react/index.html') : null;
  if (!file || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || process.env.NW_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, serviceWorkers: 'block' });
  const errors = []; page.on('pageerror', e => errors.push({ message: e.message, stack: e.stack }));
  const checks = [];
  const appCenter = async () => {
    await page.goto(`${base}/ems-apps.html?nwAdmin=1&instance=2`);
    await page.locator('#nw-emsapps-status').filter({ hasText: 'Konfiguration geladen' }).waitFor();
  };
  try {
    for (const testRole of ['installer', 'admin']) {
      role = testRole;
      await page.goto(`${base}/ems/dynamic-grid/?testRole=${testRole}#/installer`);
      await page.getByRole('button', { name: 'EMS Apps öffnen', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Dynamischer Netzanschluss', exact: true }).count(), 0);
      for (const label of ['VIS öffnen', 'Simulation', 'SmartHome VIS', 'SmartHome Config']) assert.ok(await page.getByRole('button', { name: label, exact: true }).isVisible());
      for (const label of ['Lizenz', 'E-Mail-Versand']) assert.equal(await page.getByRole('button', { name: label, exact: true }).count(), testRole === 'admin' ? 1 : 0);
      checks.push(`${testRole}-start-only-EMS-hub-and-preserved-tools`);
    }
    role = 'installer';
    await appCenter();
    const tab = page.locator('.nw-tab[data-tab="dynamicgrid"]');
    const card = page.locator('[data-app="dynamicGrid"]');
    assert.equal(await tab.isVisible(), false);
    assert.equal(await page.locator('#dynamicGridConfigSlot iframe').count(), 0);
    await card.locator('[data-toggle-kind="installed"]').getByRole('button', { name: 'Ja', exact: true }).click();
    assert.equal(await tab.isVisible(), true);
    await tab.click();
    await page.getByText('Installation zuerst mit Speichern übernehmen.', { exact: false }).waitFor();
    assert.equal(await page.locator('#dynamicGridConfigSlot iframe').count(), 0);
    await page.locator('#nw-emsapps-save').click();
    await page.locator('#nw-emsapps-status').filter({ hasText: 'Gespeichert.' }).waitFor();
    assert.equal(await page.evaluate(() => window.__nwWrites.at(-1).patch.emsApps.apps.dynamicGrid.installed), true);
    checks.push('pending-install-cannot-open-frame-before-successful-save');
    persistedInstalled = true;
    await page.locator('.nw-tab[data-tab="apps"]').click();
    const nav = page.locator('[data-app-config-nav="dynamicGrid"] button');
    assert.equal(await nav.getAttribute('data-app-config-target'), 'dynamicgrid');
    await nav.click();
    assert.equal(await page.locator('#nw-tabpanel-dynamicgrid').isVisible(), true);
    assert.ok(page.url().startsWith(base + '/ems-apps.html'));
    const frame = page.frameLocator('#dynamicGridConfigSlot iframe');
    await frame.getByRole('heading', { name: 'App und Betrieb', exact: true }).waitFor();
    assert.equal(await frame.locator('.nw-hero, .nw-instance-badge, .nw-header-card').count(), 0);
    assert.equal(await frame.getByRole('link', { name: 'Zu EMS Apps', exact: true }).count(), 0);
    assert.equal(await frame.locator('.nw-dynamic-root-source input').count(), 0);
    assert.match(await page.locator('#dynamicGridConfigSlot iframe').getAttribute('src'), /instance=2/);
    await frame.getByLabel(/^Höchste zeitliche Abweichung/).fill('777');
    await page.locator('.nw-tab[data-tab="apps"]').click();
    await page.locator('[data-app="thermal"] [data-toggle-kind="installed"]').getByRole('button', { name: 'Ja', exact: true }).click();
    await nav.click();
    assert.equal(await frame.getByLabel(/^Höchste zeitliche Abweichung/).inputValue(), '777');
    checks.push('catalog-opens-internal-tab-and-keeps-form-during-unrelated-toggle');
    await page.screenshot({ path: path.join(artifacts, 'ems-apps-dynamic-grid-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#dynamicGridConfigSlot').scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'AppCenter has no horizontal overflow');
    assert.ok(await frame.locator('html').evaluate(el => el.scrollWidth <= el.ownerDocument.defaultView.innerWidth + 1), 'embedded form has no horizontal overflow');
    await page.screenshot({ path: path.join(artifacts, 'ems-apps-dynamic-grid-mobile.png') });
    checks.push('embedded-mobile-no-horizontal-overflow');
    const general = frame.getByRole('link', { name: 'Zuordnung → Allgemein öffnen', exact: true });
    assert.equal(await general.getAttribute('target'), '_parent');
    await general.click();
    await page.waitForURL('**/ems-apps.html?nwAdmin=1&tab=mapping');
    await page.locator('#nw-emsapps-status').filter({ hasText: 'Konfiguration geladen' }).waitFor();
    assert.equal(await page.locator('#nw-tabpanel-mapping').isVisible(), true);
    checks.push('M0-General-link-escapes-iframe-to-existing-mapping');
    await page.setViewportSize({ width: 1440, height: 1100 });
    await appCenter();
    await page.locator('[data-app-config-nav="dynamicGrid"] button').click();
    await page.frameLocator('#dynamicGridConfigSlot iframe').getByRole('heading', { name: 'App und Betrieb', exact: true }).waitFor();
    await page.locator('.nw-tab[data-tab="apps"]').click();
    assert.equal(await page.locator('#nw-tabpanel-apps').isVisible(), true);
    checks.push('host-tabs-provide-navigation-without-duplicate-child-header');
    await page.goto(`${base}/ems/dynamic-grid/#/dynamic-grid`);
    await page.getByText('fixture.general.grid', { exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Zu EMS Apps', exact: true }).getAttribute('target'), '_self');
    checks.push('existing-direct-route-remains-reachable');
    role = 'user';
    await page.reload();
    await page.getByRole('heading', { name: 'Zugriff geschützt', exact: true }).waitFor();
    assert.equal(await page.locator('.nw-dynamic-root-source').count(), 0);
    checks.push('customer-even-with-wildcard-cannot-open-detail');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ result: 'PASS', checks, artifacts, limitation: 'Actual built React and actual AppCenter source; local API fixtures, no hardware validation.' }, null, 2));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; server.close(); });
