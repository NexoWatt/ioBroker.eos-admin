'use strict';
/**
 * Chromium → ausgeliefertes AppCenter/React → echte Express-Routen → echte
 * Installer-Persistenz. Nur ioBroker, Geräte und Engine-Neustart sind Fixtures.
 * Keine API-Interception und keine nachgebildeten Save-Antworten.
 * Aufruf: NW_PLAYWRIGHT_MODULE=<Modul> CHROMIUM_BIN=<Browser> node test/browser-dynamic-grid-save.cjs
 * Optional --expect-prefixed-conflict: dokumentiert den ursprünglichen 409 vor dem Fix.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.NW_PLAYWRIGHT_MODULE || 'playwright');
const { createHarness } = require('../scripts/verify-stable-1.0.9-access.cjs');
const root = path.resolve(__dirname, '..');
const report = process.env.NW_DYNAMIC_GRID_SAVE_REPORT || path.join(root, 'docs/reports/dynamic-grid-ui-2026-10-23/browser-real-save.log');
const expectOriginalConflict = process.argv.includes('--expect-prefixed-conflict');
const checks = [];
const log = value => { const line = JSON.stringify({ ts: new Date().toISOString(), version: require('../package.json').version, ...value }); fs.mkdirSync(path.dirname(report), { recursive: true }); fs.appendFileSync(report, line + '\n'); console.log(line); };

async function harness() {
  const h = await createHarness(); const a = h.adapter;
  const readObject = a.getForeignObjectAsync.bind(a); const objects = new Map();
  a.getForeignObjectAsync = async id => {
    if (['fixture.root', 'fixture.changedRoot', 'fixture.pendingRoot', 'fixture.staleRoot'].includes(id)) return { type: 'state', common: { type: 'number', unit: 'W', read: true, write: false } };
    if (id === `${a.namespace}.installer.configJson`) return objects.get(id) || null;
    return readObject(id);
  };
  a.setForeignObjectAsync = async (id, value) => { objects.set(id, value); };
  a.extendForeignObjectAsync = async (id, value) => { const old = objects.get(id) || {}; objects.set(id, { ...old, ...value, common: { ...old.common, ...value.common } }); };
  // Der Basisharness ersetzt diese Methode. Hier ausdrücklich den realen
  // zentralen CAS-/Persistenzpfad wieder einsetzen, nicht nur den HTTP-Handler.
  a.persistInstallerConfigToState = Object.getPrototypeOf(a).persistInstallerConfigToState.bind(a);
  a.config.datapoints = { gridPointPower: 'fixture.root' };
  a.nwWriteUserdataBackup = async () => {};
  a._nwPrepareDynamicGridTransition = async () => ({ ok: true });
  a._nwCommitDynamicGridConfig = () => {};
  a._nwCancelDynamicGridTransition = () => {};
  a._nwInitLicense = async () => {};
  let restarts = 0;
  a.initEmsEngine = async force => { assert.equal(force, true); restarts++; };
  for (const key of ['syncInstallerConfigToStates', 'syncSettingsToStates', 'syncSettingsConfigToStates', 'ensureEvcsStates', 'ensureRfidStates', 'subscribeEvcsMappedStates', 'subscribeConfiguredStates', 'ensureHistorieExportStates', 'updateHistorieExportStates', 'startHistorieExportTimer']) a[key] = async () => {};
  return { ...h, restarts: () => restarts };
}

(async () => {
  const h = await harness(); let browser;
  try {
    const token = await h.login('installer');
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || process.env.NW_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers: 'block' });
    await context.addCookies([{ name: 'nw_session', value: token, url: h.base }]);
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const mutations = [];
    page.on('request', request => {
      if (request.method() !== 'POST' || !new URL(request.url()).pathname.startsWith('/api/')) return;
      mutations.push({ path: new URL(request.url()).pathname, body: request.postDataJSON() });
    });
    const appStatus = page.locator('#nw-emsapps-status');
    const loaded = () => appStatus.filter({ hasText: 'Konfiguration geladen' }).waitFor();
    const saveParent = async () => {
      const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/installer/config' && response.request().method() === 'POST');
      await page.locator('#nw-emsapps-save').click();
      const result = await response; return { status: result.status(), data: await result.json() };
    };
    const globalPosts = () => mutations.filter(row => row.path === '/api/installer/config');
    const stored = async () => JSON.parse((await h.adapter.getStateAsync('installer.configJson')).val);
    const openChild = async () => {
      await page.locator('.nw-tab[data-tab="dynamicgrid"]').click();
      const frame = page.frameLocator('#dynamicGridConfigSlot iframe');
      await frame.getByRole('heading', { name: 'App und Betrieb', exact: true }).waitFor();
      return frame;
    };
    const fillParentM0 = async value => {
      await page.locator('.nw-tab[data-tab="mapping"]').click();
      await page.locator('#gridPointPowerId').fill(value);
      await page.locator('#gridPointPowerId').dispatchEvent('change');
    };
    await page.goto(`${h.base}/ems-apps.html?nwAdmin=1`);
    await loaded();
    assert.equal(h.adapter.config.dynamicGridConnection, undefined, 'Ein GET darf einen fehlenden gespeicherten Vertrag nicht anlegen.');
    await page.locator('[data-app="dynamicGrid"] [data-toggle-kind="installed"]').getByRole('button', { name: 'Ja', exact: true }).click();
    const installed = await saveParent();
    if (expectOriginalConflict) {
      assert.equal(installed.status, 409);
      assert.equal(installed.data.error, 'DYNAMIC_GRID_VERSION_CONFLICT');
      assert.equal(globalPosts().length, 1);
      assert.equal(Object.hasOwn(globalPosts()[0].body, 'expectedDynamicGridConfigVersion'), false);
      assert.equal(h.adapter.config.dynamicGridConnection, undefined);
      log({ result: 'EXPECTED_PRE_FIX_FAILURE', route: '/api/installer/config', status: 409, error: installed.data.error, missingExpectedVersion: true, source: 'shipped JavaScript, real Express and persistence', limitation: 'Local ioBroker fixtures, no hardware.' });
      return;
    }
    assert.equal(installed.status, 200, installed.data.error || installed.data.message);
    assert.equal(globalPosts()[0].body.expectedDynamicGridConfigVersion, 1);
    assert.equal(globalPosts()[0].body.restartEms, true);
    assert.equal(Object.hasOwn(globalPosts()[0].body.patch, 'dynamicGridConnection'), false, 'Der Parent sendet keinen ungeprüften zweiten Topologieentwurf.');
    assert.equal(installed.data.config.dynamicGridConnection.configVersion, 2);
    assert.equal(installed.data.config.emsApps.apps.dynamicGrid.installed, true);
    assert.equal(installed.data.config.emsApps.apps.dynamicGrid.enabled, false);
    assert.equal((await stored()).dynamicGridConnection.configVersion, 2);
    assert.equal((await stored()).emsApps.apps.dynamicGrid.enabled, false);
    await appStatus.filter({ hasText: 'Gespeichert.' }).waitFor();
    checks.push('actual-install-toggle-global-save-read-CAS-1-persisted-inactive-draft-2');
    const repeated = await saveParent();
    assert.equal(repeated.status, 200, repeated.data.error || repeated.data.message);
    assert.equal(globalPosts().at(-1).body.expectedDynamicGridConfigVersion, 2);
    assert.equal(repeated.data.config.dynamicGridConnection.configVersion, 2);
    assert.equal((await stored()).dynamicGridConnection.configVersion, 2);
    checks.push('unchanged-global-repeat-retains-version-2');

    let frame = await openChild();
    await frame.getByLabel(/^Höchste zeitliche Abweichung/).fill('777');
    await fillParentM0('fixture.pendingRoot');
    frame = await openChild();
    assert.equal(await frame.getByLabel(/^Höchste zeitliche Abweichung/).inputValue(), '777');
    const childResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/dynamic-grid/config' && response.request().method() === 'POST');
    await frame.getByRole('button', { name: 'Entwurf speichern', exact: true }).click();
    const childSaved = await childResponse;
    assert.equal(childSaved.status(), 200);
    assert.equal((await childSaved.json()).config.configVersion, 3);
    await appStatus.filter({ hasText: 'wurde inzwischen geändert' }).waitFor();
    assert.equal(await page.locator('#gridPointPowerId').inputValue(), 'fixture.pendingRoot', 'Kindmeldung überschreibt den Parent-Entwurf nicht.');
    const beforeBlocked = globalPosts().length;
    await page.locator('#nw-emsapps-save').click();
    await appStatus.filter({ hasText: 'Speichern fehlgeschlagen' }).waitFor();
    assert.equal(globalPosts().length, beforeBlocked, 'Bekannte veraltete Parent-Version erzeugt keinen POST.');
    assert.equal(h.adapter.config.datapoints.gridPointPower, 'fixture.root');
    assert.equal((await stored()).dynamicGridConnection.configVersion, 3);
    checks.push('real-child-save-2-to-3-postMessage-preserves-parent-draft-and-blocks-global-POST');

    await page.locator('#nw-emsapps-reload').click(); await loaded();
    assert.equal(await page.locator('#gridPointPowerId').inputValue(), 'fixture.root');
    frame = await openChild();
    await frame.getByLabel(/^Höchste zeitliche Abweichung/).fill('666');
    await fillParentM0('fixture.changedRoot');
    const general = await saveParent();
    assert.equal(general.status, 200, general.data.error || general.data.message);
    assert.equal(globalPosts().at(-1).body.expectedDynamicGridConfigVersion, 3);
    assert.equal(general.data.config.dynamicGridConnection.configVersion, 4);
    assert.equal((await stored()).datapoints.gridPointPower, 'fixture.changedRoot');
    frame = await openChild();
    assert.equal(await frame.getByLabel(/^Höchste zeitliche Abweichung/).inputValue(), '666', 'Parent-Save überschreibt den Kindentwurf nicht.');
    assert.equal(await frame.getByRole('button', { name: 'Entwurf speichern', exact: true }).isDisabled(), true);
    await frame.getByRole('button', { name: 'Entwurf verwerfen und neu laden', exact: true }).click();
    await frame.getByText('fixture.changedRoot', { exact: true }).waitFor();
    assert.equal(await frame.getByLabel(/^Höchste zeitliche Abweichung/).inputValue(), '777');
    assert.equal(await frame.getByRole('button', { name: 'Entwurf speichern', exact: true }).isEnabled(), true);
    checks.push('real-global-M0-save-3-to-4-preserves-child-draft-until-explicit-reload');

    // Neuer Parent ohne iframe: Eine echte konkurrierende Speicherung kann
    // diesen Tab nicht über postMessage warnen; der Server muss CAS abweisen.
    await page.goto(`${h.base}/ems-apps.html?nwAdmin=1`); await loaded();
    const concurrentRead = await h.request('/api/dynamic-grid', { token });
    const concurrent = await h.request('/api/dynamic-grid/config', { token, method: 'POST', body: { config: { ...concurrentRead.data.config, maxSkewMs: 555 }, expectedConfigVersion: 4 } });
    assert.equal(concurrent.status, 200, concurrent.data.error || concurrent.data.message);
    assert.equal(concurrent.data.config.configVersion, 5);
    await fillParentM0('fixture.staleRoot');
    const beforeStale = globalPosts().length;
    const stale = await saveParent();
    assert.equal(stale.status, 409); assert.equal(stale.data.error, 'DYNAMIC_GRID_VERSION_CONFLICT');
    await appStatus.filter({ hasText: 'Speichern fehlgeschlagen' }).waitFor();
    assert.equal(globalPosts().length, beforeStale + 1, 'Kein automatisches Refresh-und-Retry bei 409.');
    assert.equal(globalPosts().at(-1).body.expectedDynamicGridConfigVersion, 4);
    assert.equal(await page.locator('#gridPointPowerId').inputValue(), 'fixture.staleRoot');
    assert.equal((await stored()).dynamicGridConnection.configVersion, 5);
    assert.equal((await stored()).datapoints.gridPointPower, 'fixture.changedRoot');
    checks.push('real-concurrent-save-4-to-5-stale-browser-POST-409-no-retry-no-overwrite');

    await page.locator('#nw-emsapps-reload').click(); await loaded();
    const exported = await h.request('/api/installer/backup/export', { token });
    assert.equal(exported.status, 200);
    const backup = exported.data.backup;
    assert.ok(backup.configPatch && backup.configPatch.dynamicGridConnection, 'Der Import verwendet das reale Backupformat.');
    backup.configPatch.dynamicGridConnection.configVersion = 1;
    backup.configPatch.dynamicGridConnection.maxSkewMs = 444;
    const importedResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/installer/backup/import' && response.request().method() === 'POST');
    await page.locator('#nw-backup-file').setInputFiles({ name: 'dynamic-grid-fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    const imported = await importedResponse;
    assert.equal(imported.status(), 200);
    assert.equal(mutations.filter(row => row.path === '/api/installer/backup/import').at(-1).body.expectedDynamicGridConfigVersion, 5);
    assert.equal((await stored()).dynamicGridConnection.configVersion, 6);
    assert.equal((await stored()).dynamicGridConnection.maxSkewMs, 444);
    checks.push('real-backup-file-import-content-version-1-with-loaded-CAS-5-persists-version-6');
    assert.ok(h.restarts() >= 4, 'Globale Saves und Import erreichen den Engine-Neustartaufruf.');
    assert.deepEqual(errors, []);
    log({ result: 'PASS', checks, finalVersion: 6, globalPosts: globalPosts().length, restartCalls: h.restarts(), source: 'shipped main.js, www/ems-apps.js and built React, actual Express routes and installer persistence', limitation: 'ioBroker objects/states, transition hooks and engine restart are local fixtures; no hardware or field certification.' });
  } catch (error) {
    log({ result: 'FAIL', checks, error: error.stack || String(error) });
    process.exitCode = 1;
  } finally { if (browser) await browser.close(); await h.close(); }
})().catch(error => { log({ result: 'FAIL', error: error.stack || String(error) }); process.exitCode = 1; });
