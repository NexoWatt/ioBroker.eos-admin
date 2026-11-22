/**
 * Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * 1.0.28: tatsächliches Chromium + ausgeliefertes AppCenter/React + Express.
 * Der gemeinsame DP-Dialog lädt echte Tree-/Search-Routen aus lokalen
 * ioBroker-Objektfixtures. Kein Routing-Mock und keine simulierten Save-Antworten.
 * CHROMIUM_BIN=<Browser> NW_PLAYWRIGHT_MODULE=<Modul> node test/browser-dynamic-grid-ui.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.NW_PLAYWRIGHT_MODULE || 'playwright');
const { createHarness } = require('../scripts/verify-stable-1.0.9-access.cjs');
const { dynamicGridDefaults } = require('../ems/services/dynamic-grid-config');
const root = path.resolve(__dirname, '..');
const artifacts = process.env.NW_DYNAMIC_GRID_UI_QA_DIR || path.resolve(root, '../../dynamic-grid-ui-128-qa');
assert.ok(!path.resolve(artifacts).startsWith(root + path.sep), 'Interne Screenshots liegen außerhalb des Repositorys.');
const report = path.join(root, 'docs/reports/dynamic-grid-ui-2026-10-23/browser-real-ui.log');
const checks = [], layouts = [];
const log = value => { fs.mkdirSync(path.dirname(report), { recursive: true }); const line = JSON.stringify({ ts: new Date().toISOString(), ...value }); fs.appendFileSync(report, line + '\n'); console.log(line); };
const ids = {
  root: 'alias.0.fixture.grid.m0', local: 'alias.0.fixture.grid.m1',
  actual: 'alias.0.fixture.ess.actual', soc: 'alias.0.fixture.ess.soc',
  target: 'alias.0.fixture.ess.target', applied: 'alias.0.fixture.ess.applied',
  available: 'alias.0.fixture.ess.available', request: 'alias.0.fixture.ess.request',
  pvActual: 'alias.0.fixture.pv.actual', pvLimit: 'alias.0.fixture.pv.limit', pvApplied: 'alias.0.fixture.pv.applied',
};

async function harness() {
  const h = await createHarness(); const a = h.adapter;
  const originalRead = a.getForeignObjectAsync.bind(a); const configObjects = new Map();
  const objects = Object.fromEntries(Object.entries(ids).map(([key, id]) => [id, { _id: id, type: 'state', common: {
    name: `UI-Test ${key}`, type: key === 'available' ? 'boolean' : 'number',
    read: true, write: ['target', 'pvLimit'].includes(key), role: key === 'soc' ? 'value.battery' : key === 'available' ? 'indicator' : 'value.power',
    unit: key === 'soc' ? '%' : key === 'available' ? '' : 'W',
  } }]));
  a.getForeignObjectsAsync = async () => structuredClone(objects);
  a.getForeignObjectAsync = async id => objects[id] || (id === `${a.namespace}.installer.configJson` ? configObjects.get(id) || null : originalRead(id));
  a.setForeignObjectAsync = async (id, value) => { configObjects.set(id, value); };
  a.extendForeignObjectAsync = async (id, value) => { const old = configObjects.get(id) || {}; configObjects.set(id, { ...old, ...value, common: { ...old.common, ...value.common } }); };
  a.persistInstallerConfigToState = Object.getPrototypeOf(a).persistInstallerConfigToState.bind(a);
  a.config.datapoints = { gridPointPower: ids.root };
  a.config.dynamicGridConnection = dynamicGridDefaults();
  a.config.emsApps = { schemaVersion: 1, apps: { dynamicGrid: { installed: true, enabled: false }, storage: { installed: true, enabled: false } } };
  a._nwInstallerConfigPatch = { datapoints: structuredClone(a.config.datapoints), dynamicGridConnection: structuredClone(a.config.dynamicGridConnection), emsApps: structuredClone(a.config.emsApps) };
  a.nwWriteUserdataBackup = async () => {};
  a._nwPrepareDynamicGridTransition = async () => ({ ok: true });
  a._nwCommitDynamicGridConfig = () => {}; a._nwCancelDynamicGridTransition = () => {};
  a._nwInitLicense = async () => {}; a.initEmsEngine = async () => {};
  for (const key of ['syncInstallerConfigToStates', 'syncSettingsToStates', 'syncSettingsConfigToStates', 'ensureEvcsStates', 'ensureRfidStates', 'subscribeEvcsMappedStates', 'subscribeConfiguredStates', 'ensureHistorieExportStates', 'updateHistorieExportStates', 'startHistorieExportTimer']) a[key] = async () => {};
  return h;
}

(async () => {
  const h = await harness(); let browser, page;
  try {
    fs.mkdirSync(artifacts, { recursive: true });
    const token = await h.login('installer');
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || process.env.NW_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers: 'block' });
    await context.addCookies([{ name: 'nw_session', value: token, url: h.base }]);
    page = await context.newPage(); page.setDefaultTimeout(15000);
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) requests.push({ path: url.pathname, query: url.search, method: request.method(), body: request.method() === 'POST' ? request.postDataJSON() : null });
    });
    await page.goto(`${h.base}/ems-apps.html?nwAdmin=1`);
    await page.locator('#nw-emsapps-status').filter({ hasText: 'Konfiguration geladen' }).waitFor();
    await page.locator('[data-app-config-nav="storage"] button').click();
    await page.locator('#st_socObjectId').locator('..').getByRole('button', { name: 'Auswählen…', exact: true }).click();
    await page.getByRole('dialog', { name: 'Datenpunkt auswählen', exact: true }).waitFor();
    await page.locator('#dpSearch').fill(ids.soc); await page.locator('#dpSearchBtn').click();
    await page.locator('#dpResults .nw-dp-result').filter({ hasText: ids.soc }).click();
    await page.getByRole('dialog', { name: 'Datenpunkt auswählen', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#st_socObjectId').inputValue(), ids.soc);
    assert.equal(requests.filter(row => row.method === 'POST' && row.path !== '/api/object/validate').length, 0);
    checks.push('existing-single-storage-native-DP-picker-remains-functional');
    await page.locator('.nw-tab[data-tab="apps"]').click();
    await page.locator('[data-app-config-nav="dynamicGrid"] button').click();
    const frame = page.frameLocator('#dynamicGridConfigSlot iframe');
    await frame.getByRole('heading', { name: 'App und Betrieb', exact: true }).waitFor();
    assert.ok(page.url().includes('/ems-apps.html'));
    assert.equal(await frame.locator('h1, .nw-hero, .nw-instance-badge, .nw-header-card').count(), 0, 'Kein zweiter Seitenkopf innerhalb der EMS-App.');
    assert.equal(await frame.locator('.nw-dynamic-root-source input').count(), 0, 'M0 bleibt die schreibgeschützte Allgemein-Zuordnung.');
    assert.equal(await frame.getByRole('link', { name: 'Zu EMS Apps', exact: true }).count(), 0);
    checks.push('catalog-opens-embedded-detail-with-single-parent-header-and-readonly-M0');

    async function measureLayout(width) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 });
      await page.waitForFunction(() => {
        const frame = document.querySelector('#dynamicGridConfigSlot iframe');
        const doc = frame?.contentDocument;
        const content = doc?.querySelector('.nw-embedded-ems-content');
        return content && Math.abs(content.getBoundingClientRect().height - frame.clientHeight) <= 3 && doc.documentElement.scrollHeight <= frame.clientHeight + 2;
      });
      const geometry = await page.evaluate(() => {
        const f = document.querySelector('#dynamicGridConfigSlot iframe'), d = f.contentDocument;
        const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, width: r.width, height: r.height }; };
        const slot = document.querySelector('#dynamicGridConfigSlot');
        return { viewport: innerWidth, main: rect(document.querySelector('main.nw-appcenter-page')), slot: rect(slot), frame: rect(f),
          inner: rect(d.querySelector('.nw-embedded-ems-page')), outerScrollWidth: document.documentElement.scrollWidth,
          innerScrollWidth: d.documentElement.scrollWidth, innerViewport: f.contentWindow.innerWidth,
          innerScrollHeight: d.documentElement.scrollHeight, innerClientHeight: d.documentElement.clientHeight,
          innerScrollY: f.contentWindow.scrollY,
          sharedStylesheet: [...d.querySelectorAll('link[rel="stylesheet"]')].some(link => new URL(link.href).pathname === '/static/styles.css'),
        };
      });
      assert.ok(Math.abs(geometry.slot.width - geometry.frame.width) <= 2, 'Der Rahmen nutzt die gesamte untere Kachel.');
      assert.ok(Math.abs(geometry.frame.width - geometry.inner.width) <= 2, 'Kein zusätzlicher innerer Maximalbreitenrahmen.');
      assert.ok(Math.abs(geometry.frame.height - geometry.inner.height) <= 3, 'Rahmenhöhe folgt dem Inhalt ohne leeren Überstand.');
      assert.ok(geometry.outerScrollWidth <= width + 1, 'Keine horizontale Gesamtseiten-Scrollleiste.');
      assert.ok(geometry.innerScrollWidth <= geometry.innerViewport + 1, 'Keine horizontale Formular-Scrollleiste.');
      assert.ok(geometry.innerScrollHeight <= geometry.innerClientHeight + 2, 'Die äußere Seite scrollt, der iframe nicht.');
      assert.equal(geometry.innerScrollY, 0);
      assert.equal(geometry.sharedStylesheet, true, 'Die eingebettete App lädt das echte EMS-AppCenter-Stylesheet.');
      layouts.push(geometry);
      await page.locator('#nw-tabpanel-dynamicgrid').evaluate(element => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 175));
      await page.screenshot({ path: path.join(artifacts, `dynamic-grid-${width}-top.png`) });
    }
    for (const width of [1440, 1920, 390]) await measureLayout(width);
    checks.push('full-slot-width-shared-EMS-style-no-nested-scroll-at-1440-1920-390');
    await page.setViewportSize({ width: 1440, height: 1100 });

    const pickerButton = expression => frame.getByLabel(expression).locator('xpath=ancestor::*[@data-dp-field][1]').locator('[data-dp-pick]');
    const modal = page.getByRole('dialog', { name: 'Datenpunkt auswählen', exact: true });
    async function pick(expression, id, tree = false) {
      await pickerButton(expression).click();
      await modal.waitFor();
      if (tree) {
        if (await page.locator('#dpRootBtn').isEnabled()) await page.locator('#dpRootBtn').click();
        const parts = id.split('.'); let prefix = '';
        for (let index = 0; index < parts.length; index++) {
          prefix = prefix ? prefix + '.' + parts[index] : parts[index];
          await page.locator('#dpTree .nw-dp-result').filter({ has: page.locator('.nw-dp-result__id', { hasText: new RegExp('^' + prefix.replaceAll('.', '\\.') + '$') }) }).click();
        }
      } else {
        await page.locator('#dpSearch').fill(id);
        await page.locator('#dpSearchBtn').click();
        await page.locator('#dpResults .nw-dp-result').filter({ hasText: id }).click();
      }
      await modal.waitFor({ state: 'hidden' });
      // Modal closure precedes the asynchronous postMessage + React state update.
      // Wait for the asserted value, not for an unrelated fixed delay; retain the
      // exact-value assertion and fail after a bounded two-second handoff window.
      const selectedField = frame.getByLabel(expression);
      const handoffDeadline = Date.now() + 2000;
      while (await selectedField.inputValue() !== id && Date.now() < handoffDeadline) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert.equal(await selectedField.inputValue(), id);
    }
    await frame.getByLabel(/^Höchste zeitliche Abweichung/).fill('777');
    await pick(/^M1-Nettoleistung · Datenpunkt/, ids.local, true);
    await frame.getByRole('button', { name: 'Speicher hinzufügen', exact: true }).click();
    await frame.getByLabel(/^Speicherkennung/).fill('ui-storage');
    await frame.getByLabel(/^Speichername/).fill('Freier Test-Speicher');
    await frame.getByLabel(/^Physischer Anschlussbereich/).selectOption('M1');
    await frame.getByLabel(/^Regelmesspunkt/).selectOption('M1');
    await frame.getByLabel(/^Regel-\/Dispatchgruppe/).fill('house');
    await frame.getByLabel(/^Maximale Ladeleistung/).fill('5000');
    await frame.getByLabel(/^Maximale Entladeleistung/).fill('5000');
    await frame.getByLabel(/^Höchste Leistungsänderung/).fill('1000');
    await pick(/^Batterie-Istleistung · Datenpunkt/, ids.actual);
    await pick(/^SoC · Datenpunkt/, ids.soc);
    await pick(/^Leistungssollwert · Schreib-Datenpunkt/, ids.target);
    await pick(/^Leistungssollwert · Rücklese-Datenpunkt/, ids.applied);
    await frame.getByLabel(/Zusätzliches Verfügbarkeitssignal verwenden/).check();
    await pick(/^Verfügbarkeit · Datenpunkt/, ids.available);
    await frame.getByLabel(/^Betriebsaufgabe/).selectOption('arbitrage');
    await pick(/^Arbitrage-Leistungswunsch · Datenpunkt/, ids.request);
    await frame.getByRole('button', { name: 'PV hinzufügen', exact: true }).click();
    await frame.getByLabel(/^PV-Kennung/).fill('ui-pv');
    await frame.getByLabel(/^PV-Anschlussbereich/).selectOption('M1');
    await frame.getByLabel(/^AC-Bezugsleistung/).fill('5000');
    await pick(/^PV-Istleistung · Datenpunkt/, ids.pvActual);
    await pick(/^PV-Erzeugungsgrenze · Schreib-Datenpunkt/, ids.pvLimit);
    await pick(/^PV-Erzeugungsgrenze · Rücklese-Datenpunkt/, ids.pvApplied);
    assert.equal(await frame.getByLabel(/^Höchste zeitliche Abweichung/).inputValue(), '777');
    assert.equal(h.adapter.config.dynamicGridConnection.configVersion, 1);
    assert.equal(requests.filter(row => row.method === 'POST' && row.path !== '/api/object/validate').length, 0, 'Datenpunktauswahl speichert und aktiviert nichts.');
    assert.ok(requests.some(row => row.path === '/api/object/tree' && row.query.includes('alias.0.fixture.grid')));
    assert.ok(requests.some(row => row.path === '/api/smarthome/dpsearch' && row.query.includes(encodeURIComponent(ids.soc))));
    checks.push('real-tree-M1-and-real-search-storage-SoC-target-readback-availability-arbitrage-PV');

    await pickerButton(/^SoC · Datenpunkt/).click(); await modal.waitFor();
    await page.locator('#dpSearch').fill('keine-solche-kennung'); await page.locator('#dpSearchBtn').click();
    await page.locator('#dpResults').getByText('Keine Treffer.', { exact: true }).waitFor();
    await page.locator('#dpClose').click(); await modal.waitFor({ state: 'hidden' });
    assert.equal(await frame.getByLabel(/^SoC · Datenpunkt/).inputValue(), ids.soc);
    assert.equal(await frame.getByLabel(/^Höchste zeitliche Abweichung/).inputValue(), '777');
    checks.push('empty-search-and-cancel-preserve-existing-selection-and-unsaved-form');

    // Echte verzögerte Objekt-DB-Antwort: Nach Abbruch darf der alte Baum
    // den inzwischen geöffneten Picker eines anderen Feldes nicht ersetzen.
    const readObjects = h.adapter.getForeignObjectsAsync.bind(h.adapter);
    let releaseObjects, enteredObjects;
    const held = new Promise(resolve => { releaseObjects = resolve; });
    const entered = new Promise(resolve => { enteredObjects = resolve; });
    let holdNext = true;
    delete h.adapter._nwDpCache;
    h.adapter.getForeignObjectsAsync = async (...args) => {
      if (holdNext) { holdNext = false; enteredObjects(); await held; }
      return readObjects(...args);
    };
    try {
      const delayedResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/object/tree' && new URL(response.url()).searchParams.get('prefix') === 'alias.0.fixture.ess');
      await pickerButton(/^SoC · Datenpunkt/).click();
      let entryTimeout;
      try { await Promise.race([entered, new Promise((_, reject) => { entryTimeout = setTimeout(() => reject(new Error('Objekt-DB-Barriere nicht erreicht.')), 5000); })]); }
      finally { clearTimeout(entryTimeout); }
      await page.locator('#dpClose').click(); await modal.waitFor({ state: 'hidden' });
      await pickerButton(/^PV-Istleistung · Datenpunkt/).click(); await modal.waitFor();
      await page.locator('#dpBreadcrumb .nw-dp-crumb--active').filter({ hasText: /^pv$/ }).waitFor();
      releaseObjects(); await delayedResponse;
      assert.equal(await page.locator('#dpBreadcrumb .nw-dp-crumb--active').innerText(), 'pv');
      await page.locator('#dpTree .nw-dp-result').filter({ hasText: ids.pvActual }).click();
      await modal.waitFor({ state: 'hidden' });
      assert.equal(await frame.getByLabel(/^PV-Istleistung · Datenpunkt/).inputValue(), ids.pvActual);
      assert.equal(await frame.getByLabel(/^SoC · Datenpunkt/).inputValue(), ids.soc);
    } finally { releaseObjects(); h.adapter.getForeignObjectsAsync = readObjects; }
    checks.push('late-real-object-tree-response-cannot-replace-new-field-picker-after-cancel');

    // Alle optionalen Schnittstellen müssen ebenfalls sichtbare Picker besitzen.
    await frame.getByLabel(/^Befehlsschnittstelle/).selectOption('splitTarget');
    for (const label of [/^Ladesollwert · Schreib-Datenpunkt/, /^Ladesollwert · Rücklese-Datenpunkt/, /^Entladesollwert · Schreib-Datenpunkt/, /^Entladesollwert · Rücklese-Datenpunkt/]) assert.equal(await pickerButton(label).isVisible(), true);
    await frame.getByLabel(/^Befehlsschnittstelle/).selectOption('externalLimits');
    for (const label of [/^Maximale Ladefreigabe · Schreib-Datenpunkt/, /^Maximale Ladefreigabe · Rücklese-Datenpunkt/, /^Maximale Entladefreigabe · Schreib-Datenpunkt/, /^Maximale Entladefreigabe · Rücklese-Datenpunkt/, /^Angewandte Ladegrenze · Datenpunkt/, /^Angewandte Entladegrenze · Datenpunkt/, /^Watchdog · Schreib-Datenpunkt/, /^Watchdog · Rücklese-Datenpunkt/]) assert.equal(await pickerButton(label).isVisible(), true);
    await frame.getByText('Optionale Betriebs- und Richtungsfreigaben', { exact: true }).click();
    for (const label of ['Betriebsfreigabe', 'Ladefreigabe', 'Entladefreigabe']) {
      await frame.getByLabel(`${label} zuordnen`, { exact: true }).check();
      assert.equal(await pickerButton(new RegExp('^' + label + ' · Schreib-Datenpunkt')).isVisible(), true);
      assert.equal(await pickerButton(new RegExp('^' + label + ' · Rücklese-Datenpunkt')).isVisible(), true);
    }
    checks.push('visible-pickers-cover-split-limits-watchdog-and-all-optional-switch-fields');
    await page.setViewportSize({ width: 390, height: 844 });
    await frame.getByLabel(/^Watchdog · Schreib-Datenpunkt/).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, 'dynamic-grid-390-picker-fields.png') });
    await pick(/^SoC · Datenpunkt/, ids.soc);
    await measureLayout(390);
    checks.push('mobile-picker-selection-and-expanded-form-without-horizontal-or-nested-scroll');

    await page.setViewportSize({ width: 1440, height: 1100 });
    await frame.getByLabel(/^Befehlsschnittstelle/).selectOption('signedTarget');
    await pick(/^Leistungssollwert · Schreib-Datenpunkt/, ids.target);
    await pick(/^Leistungssollwert · Rücklese-Datenpunkt/, ids.applied);
    const saveResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/dynamic-grid/config' && response.request().method() === 'POST');
    await frame.getByRole('button', { name: 'Entwurf speichern', exact: true }).click();
    const saved = await saveResponse; const data = await saved.json();
    assert.equal(saved.status(), 200, JSON.stringify({ error: data.error, details: data.details }));
    assert.equal(data.config.configVersion, 2);
    const mutation = requests.filter(row => row.path === '/api/dynamic-grid/config' && row.method === 'POST').at(-1);
    assert.equal(mutation.body.expectedConfigVersion, 1);
    const stored = JSON.parse((await h.adapter.getStateAsync('installer.configJson')).val);
    assert.equal(stored.dynamicGridConnection.points[1].measurement.stateId, ids.local);
    assert.equal(stored.dynamicGridConnection.storages[0].socMeasurement.stateId, ids.soc);
    assert.equal(stored.dynamicGridConnection.storages[0].command.signedTarget.stateId, ids.target);
    assert.equal(stored.dynamicGridConnection.storages[0].command.signedTarget.readbackStateId, ids.applied);
    assert.equal(stored.dynamicGridConnection.pvAssignments[0].command.readbackStateId, ids.pvApplied);
    assert.equal(stored.emsApps.apps.dynamicGrid.enabled, false);
    assert.equal(await page.locator('#st_socObjectId').inputValue(), ids.soc, 'Kind-Save erhält auch den ungespeicherten Entwurf einer anderen EMS-App.');
    checks.push('real-draft-save-uses-original-CAS-and-persists-picker-selected-IDs-inactive');

    await frame.getByLabel(/^Höchste zeitliche Abweichung/).fill('666');
    await pickerButton(/^SoC · Datenpunkt/).click(); await modal.waitFor();
    const concurrent = await h.request('/api/dynamic-grid/config', { token, method: 'POST', body: { config: { ...data.config, maxSkewMs: 555 }, expectedConfigVersion: 2 } });
    assert.equal(concurrent.status, 200);
    await frame.getByRole('button', { name: 'Entwurf speichern', exact: true }).waitFor();
    await page.waitForFunction(() => {
      const d = document.querySelector('#dynamicGridConfigSlot iframe')?.contentDocument;
      return [...(d?.querySelectorAll('button') || [])].some(button => button.textContent === 'Entwurf speichern' && button.disabled);
    });
    await modal.waitFor({ state: 'hidden' });
    assert.equal(await pickerButton(/^SoC · Datenpunkt/).isDisabled(), true);
    assert.equal(await frame.getByLabel(/^SoC · Datenpunkt/).inputValue(), ids.soc);
    assert.equal(await frame.getByLabel(/^Höchste zeitliche Abweichung/).inputValue(), '666');
    assert.equal(h.adapter.config.dynamicGridConnection.configVersion, 3);
    checks.push('concurrent-real-save-CAS-conflict-cancels-open-picker-preserves-draft-and-blocks-DP-and-save');

    const standalone = await context.newPage(); standalone.setDefaultTimeout(15000);
    await standalone.goto(`${h.base}/ems/dynamic-grid/#/dynamic-grid`);
    await standalone.getByRole('heading', { level: 1, name: 'Dynamischer Netzanschluss', exact: true }).waitFor();
    assert.equal(await standalone.getByRole('link', { name: 'Zu EMS Apps', exact: true }).getAttribute('target'), '_self');
    const popupEvent = standalone.waitForEvent('popup');
    await standalone.getByLabel(/^M1-Nettoleistung · Datenpunkt/).locator('xpath=ancestor::*[@data-dp-field][1]').locator('[data-dp-pick]').click();
    const popup = await popupEvent;
    await popup.getByRole('dialog', { name: 'Datenpunkt auswählen', exact: true }).waitFor();
    assert.equal(new URL(popup.url()).searchParams.get('dpPicker'), '1');
    await popup.locator('#dpSearch').fill(ids.local); await popup.locator('#dpSearchBtn').click();
    const closed = popup.waitForEvent('close');
    await popup.locator('#dpResults .nw-dp-result').filter({ hasText: ids.local }).click();
    await closed;
    assert.equal(await standalone.getByLabel(/^M1-Nettoleistung · Datenpunkt/).inputValue(), ids.local);
    assert.equal(h.adapter.config.dynamicGridConnection.configVersion, 3);
    await standalone.close();
    checks.push('standalone-retains-header-and-opens-same-real-picker-as-popup-without-saving');

    const customerToken = await h.login('kunde');
    for (const url of ['/api/object/tree?prefix=alias.0', '/api/smarthome/dpsearch?q=fixture', '/api/dynamic-grid']) assert.equal((await h.request(url, { token: customerToken })).status, 403);
    const customerContext = await browser.newContext({ serviceWorkers: 'block' });
    await customerContext.addCookies([{ name: 'nw_session', value: customerToken, url: h.base }]);
    const customer = await customerContext.newPage();
    const deniedPage = await customer.goto(`${h.base}/ems/dynamic-grid/?embedded=1#/dynamic-grid`);
    assert.equal(deniedPage.status(), 403, 'Der echte Server sperrt bereits das HTML vor dem React-Bootstrap.');
    assert.equal(await customer.title(), 'NexoWatt EOS – Zugriff geschützt');
    await customer.locator('body[data-nw-required-capability="appcenter.open"]').waitFor();
    assert.equal(await customer.locator('.nw-embedded-ems-page').count(), 0);
    await customerContext.close();
    checks.push('customer-denied-real-DP-tree-search-and-dynamic-grid-UI');
    assert.deepEqual(errors, []);
    log({ result: 'PASS', checks, layouts, artifacts, limitation: 'Actual shipped UI, Express DP discovery and installer persistence; local ioBroker fixtures and no hardware/field claim.' });
  } catch (error) {
    if (page) {
      await page.screenshot({ path: path.join(artifacts, 'dynamic-grid-ui-failure.png'), fullPage: false }).catch(() => {});
      fs.writeFileSync(path.join(artifacts, 'dynamic-grid-ui-failure.txt'), await page.locator('body').innerText().catch(() => ''));
    }
    log({ result: 'FAIL', checks, layouts, error: error.stack || String(error), artifacts });
    process.exitCode = 1;
  } finally { if (browser) await browser.close(); await h.close(); }
})().catch(error => { log({ result: 'FAIL', error: error.stack || String(error) }); process.exitCode = 1; });
