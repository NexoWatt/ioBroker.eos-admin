'use strict';
/* Chromium -> shipped AppCenter -> actual hosted HTTP/CAS and state persistence.
 * ioBroker database/session and EMS hardware loop are fixtures; no live actuator IO. */
/* global document, chargingControlFetch, chargingControlSnapshot */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const puppeteer = require('puppeteer');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const { synchronizeChargingPointIdentity } = require('../ui/lib/charging-point-identity');
const root = path.resolve(__dirname, '..');
const clone = value => structuredClone(value);
const sourceHashes = async () => Object.fromEntries(await Promise.all([
    'ui/src-ts/runtime-executables/www/ems-apps.ts', 'ui/www/ems-apps.js',
    'ui/src-ts/runtime-executables/main.ts', 'ui/main.js',
    'ui/src-ts/runtime-executables/lib/installer-lifecycle.ts', 'ui/lib/installer-lifecycle.js',
    'ui/src-ts/runtime-executables/lib/charging-point-identity.ts', 'ui/lib/charging-point-identity.js',
    'ui/src-ts/runtime-executables/www/evcs.ts', 'ui/www/evcs.js',
    'test/eos-evcs-delete-browser.cjs',
].map(async name => [name, crypto.createHash('sha256').update(await fs.readFile(path.join(root, name))).digest('hex')])));
const originalRows = [
    { name: 'Alter entfernter Adapter', enabled: true, stationKey: 'ocpp21.0.OLD',
        powerId: 'ocpp21.0.OLD.measurements.powerW', setPowerWId: 'ocpp21.0.OLD.control.chargeLimit',
        chargerType: 'ac', phases: 3, voltageV: 230, minCurrentA: 6, maxCurrentA: 16,
        minPowerW: 4140, maxPowerW: 11040 },
    { name: 'Aktive Station bleibt', enabled: true, stationKey: 'fixture.active',
        powerId: 'fixture.active.power', setCurrentAId: 'fixture.active.current',
        chargerType: 'ac', phases: 1, voltageV: 230, minCurrentA: 6, maxCurrentA: 16,
        minPowerW: 1380, maxPowerW: 3680, boostMaxPowerW: 777, unknownCustomer: { preserve: true } },
];

async function main() {
    const before = await sourceHashes();
    const h = await createHarness(); const a = h.adapter;
    let browser, server; const checks = [], errors = [], posts = [];
    const transitions = [];
    try {
        // Real persistence and runtime apply; only the hardware-driving EMS engine is replaced.
        a.persistInstallerConfigToState = Object.getPrototypeOf(a).persistInstallerConfigToState.bind(a);
        a.nwWriteUserdataBackup = async () => {};
        a._nwInitLicense = async () => {};
        a.startHistorieExportTimer = () => {};
        h.owner.subscribeForeignStates = () => {};
        h.owner.unsubscribeForeignStates = () => {};
        a.initEmsEngine = async force => {
            assert.equal(force, true);
            // The production engine invokes this before constructing its modules.
            await synchronizeChargingPointIdentity(a, a.config.settingsConfig.evcsList);
            transitions.push(clone(a.config.settingsConfig.evcsList));
        };
        for (const id of ['fixture.active.power', 'fixture.active.current']) h.objects.set(id,
            { type: 'state', common: { type: 'number', role: id.endsWith('power') ? 'value.power' : 'level',
                unit: id.endsWith('power') ? 'W' : 'A', read: true, write: id.endsWith('current') } });
        h.states.set('fixture.active.power', { val: 2000, ack: true, ts: Date.now() });
        // The removed adapter and all its datapoints deliberately do not exist.
        const initial = { settingsConfig: { evcsCount: 2, evcsList: clone(originalRows), stationGroups: [] },
            emsApps: { apps: { charging: { installed: true, enabled: true } } } };
        a._nwInstallerConfigPatch = clone(initial);
        a.config = a.nwApplyInstallerPatchToRuntimeConfig(a.config, clone(initial));
        assert.equal(await a.persistInstallerConfigToState(initial), true);
        await synchronizeChargingPointIdentity(a, originalRows);
        await a._nwApplyInstallerRuntime(true, 'browser-delete-initial-owner');
        const token = await h.login('installer');
        // Unified auth normally belongs to the parent process. This test's hosted
        // runtime harness supplies that boundary as the same session fixture used
        // by its real configuration routes; authentication itself is not under test.
        server = http.createServer(async (req, res) => {
            if (['/api/auth/status', '/api/session/me'].includes(new URL(req.url, 'http://fixture').pathname)) {
                const access = await h.bridge.resolveAccess(req);
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Cache-Control', 'no-store');
                res.end(JSON.stringify({ enabled: true, configured: true, mode: 'iobroker', protectWrites: true,
                    authed: !!access?.authenticated, authenticated: !!access?.authenticated,
                    user: access?.user || null, role: access?.role || 'none', capabilities: access?.capabilities || [],
                    csrfToken: access?.csrfToken || '' }));
                return;
            }
            a._hostedApp(req, res);
        });
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const browserBase = `http://127.0.0.1:${server.address().port}`;
        browser = await puppeteer.launch({ executablePath: process.env.EOS_CHROMIUM_PATH || await puppeteer.executablePath(),
            headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
        const page = await browser.newPage();
        page.setDefaultTimeout(15000);
        await page.setViewport({ width: 1440, height: 1050 });
        await page.setCookie({ name: 'fixture', value: token, url: browserBase });
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => {
            if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/installer/config') posts.push(JSON.parse(request.postData()));
        });
        const waitStatus = async text => {
            try { await page.waitForFunction(expected => document.getElementById('nw-emsapps-status')?.textContent.includes(expected), {}, text); }
            catch (cause) { throw new Error(JSON.stringify({ expected: text, url: page.url(), errors,
                status: await page.evaluate(() => document.getElementById('nw-emsapps-status')?.textContent || document.body.textContent.slice(0, 1000)) }), { cause }); }
        };
        const stored = () => JSON.parse(h.states.get(`${h.owner.namespace}.installer.configJson`).val);
        const restartFromPersisted = async expectedRows => {
            const freshOwner = await createHarness();
            try {
                for (const [id, state] of h.states) freshOwner.states.set(id, clone(state));
                for (const [id, object] of h.objects) freshOwner.objects.set(id, clone(object));
                freshOwner.owner.subscribeForeignStates = () => {};
                freshOwner.owner.unsubscribeForeignStates = () => {};
                freshOwner.adapter.startHistorieExportTimer = () => {};
                let applied = false;
                freshOwner.adapter.initEmsEngine = async force => {
                    assert.equal(force, true);
                    await synchronizeChargingPointIdentity(freshOwner.adapter, freshOwner.adapter.config.settingsConfig.evcsList);
                    assert.deepEqual(freshOwner.adapter.config.settingsConfig.evcsList, expectedRows);
                    applied = true;
                };
                assert.equal(freshOwner.adapter._nwInstallerConfigPatch, undefined);
                await freshOwner.adapter.loadInstallerConfigFromState();
                assert.deepEqual(freshOwner.adapter._nwInstallerConfigPatch.settingsConfig.evcsList, expectedRows);
                await freshOwner.adapter._nwApplyInstallerRuntime(true, 'browser-delete-fresh-owner');
                assert.equal(applied, true, 'a new runtime owner reloads and applies the persisted deletion');
            } finally {
                await new Promise(resolve => freshOwner.adapter.onUnload(resolve));
                await freshOwner.close();
            }
        };
        const open = async () => {
            await page.goto(`${browserBase}/ems-apps.html?nwAdmin=1#evcs`);
            await waitStatus('Konfiguration geladen');
            await page.click('[data-tab="evcs"]');
        };
        const reload = async () => {
            await page.click('#nw-emsapps-reload'); await waitStatus('Konfiguration geladen');
        };
        const save = async () => {
            const next = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/installer/config');
            await page.click('#nw-emsapps-save');
            const response = await next; const data = await response.json();
            await waitStatus(response.status() === 200 ? 'Gespeichert.' : 'Speichern fehlgeschlagen');
            return { status: response.status(), data };
        };
        const remove = async index => {
            await page.$eval(`[data-evcs-remove="${index}"]`, el => el.scrollIntoView({ block: 'center' }));
            await page.click(`[data-evcs-remove="${index}"]`);
            await waitStatus('Ladepunkt im Entwurf entfernt');
        };
        await open();
        const oldChargingPage = await browser.newPage();
        oldChargingPage.on('pageerror', error => errors.push(error.message));
        await oldChargingPage.goto(`${browserBase}/evcs.html`);
        await oldChargingPage.waitForFunction(() => typeof chargingControlFetch === 'function' && chargingControlSnapshot?.slots?.lp1);
        await page.bringToFront();
        const firstRead = await h.request('/api/installer/config', { token });
        await remove(1);
        assert.equal(await page.$eval('#evcsCount', el => el.value), '1');
        assert.equal(stored().settingsConfig.evcsList.length, 2, 'remove only changes the draft before save');
        const first = await save();
        assert.equal(first.status, 200, JSON.stringify(first.data));
        assert.equal(posts.at(-1).expectedConfigurationRevision, firstRead.data.configurationRevision);
        assert.equal(posts.at(-1).restartEms, true);
        assert.equal(Object.hasOwn(posts.at(-1).patch.settingsConfig, '__allowEmptyEvcsList'), false);
        const remaining = stored().settingsConfig.evcsList;
        assert.equal(remaining.length, 1);
        for (const [key, value] of Object.entries(originalRows[1])) assert.deepEqual(remaining[0][key], value, `remaining row preserves ${key}`);
        assert.deepEqual(transitions.at(-1), remaining, 'EMS restart receives only the retained mapping');
        const modeBefore = clone(h.states.get(`${h.owner.namespace}.chargingManagement.wallboxes.lp1.userMode`));
        await oldChargingPage.bringToFront();
        const rejectedResponse = oldChargingPage.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/set');
        const staleResult = await oldChargingPage.evaluate(async () => {
            try {
                await chargingControlFetch('/api/set', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ scope: 'ems', key: 'evcs.1.userMode', value: 'boost' }) });
                return 'unexpected-success';
            } catch (error) { return error.message; }
        });
        const staleResponse = await rejectedResponse;
        assert.equal(staleResponse.status(), 409);
        assert.equal(staleResult, 'EOS_EVCS_IDENTITY_CHANGED');
        assert.equal((await staleResponse.json()).error, 'EOS_EVCS_IDENTITY_CHANGED');
        assert.deepEqual(h.states.get(`${h.owner.namespace}.chargingManagement.wallboxes.lp1.userMode`), modeBefore);
        assert.match(await oldChargingPage.$eval('#nw-charging-identity-notice', el => el.textContent), /neu laden/);
        await oldChargingPage.close();
        await page.bringToFront();
        checks.push('real-old-EVCS-browser-A-boost-after-B-reindex-409-without-B-mode-write');
        await reload();
        assert.equal(await page.$$eval('[data-evcs-remove]', nodes => nodes.length), 1);
        await restartFromPersisted(remaining);
        checks.push('missing-adapter-first-row-delete-real-persist-restart-reload-retains-active-second-row');

        // A real second writer changes the persisted baseline after this tab loaded it.
        const fresh = await h.request('/api/installer/config', { token });
        const otherRows = clone(stored().settingsConfig.evcsList); otherRows[0].name = 'Änderung anderer Installer';
        const foreign = await h.request('/api/installer/config', { token, method: 'POST', body: {
            patch: { settingsConfig: { evcsCount: 1, evcsList: otherRows } }, restartEms: false,
            expectedConfigurationRevision: fresh.data.configurationRevision,
            expectedDynamicGridConfigVersion: fresh.data.config.dynamicGridConnection?.configVersion,
        } });
        assert.equal(foreign.status, 200, foreign.text);
        await remove(1);
        const beforeConflict = clone(stored()); const beforeTransitions = transitions.length;
        const conflict = await save();
        assert.equal(conflict.status, 409);
        assert.equal(conflict.data.error, 'EOS_INSTALLER_CONFIG_CHANGED');
        assert.deepEqual(stored(), beforeConflict);
        assert.equal(transitions.length, beforeTransitions);
        assert.equal(await page.$eval('#evcsCount', el => el.value), '0', 'conflict retains local delete draft');
        checks.push('real-second-writer-409-preserves-persisted-config-and-unsaved-delete-draft');

        await reload();
        assert.equal(await page.$eval('#evcsCount', el => el.value), '1');
        await remove(1);
        const last = await save();
        assert.equal(last.status, 200, JSON.stringify(last.data));
        assert.equal(posts.at(-1).patch.settingsConfig.__allowEmptyEvcsList, true);
        assert.deepEqual(stored().settingsConfig.evcsList, []);
        assert.equal(stored().settingsConfig.evcsCount, 0);
        assert.equal(Object.hasOwn(stored().settingsConfig, '__allowEmptyEvcsList'), false, 'delete intent is not persisted');
        assert.deepEqual(transitions.at(-1), []);
        await restartFromPersisted([]);
        await reload();
        assert.equal(await page.$eval('#evcsCount', el => el.value), '0');
        assert.equal((await save()).status, 200);
        assert.equal(Object.hasOwn(posts.at(-1).patch.settingsConfig, '__allowEmptyEvcsList'), false, 'reload consumes delete intent');
        checks.push('last-row-explicit-empty-real-persist-restart-reload-intent-consumed');

        const emptyConfig = await h.request('/api/installer/config', { token });
        const readd = await h.request('/api/installer/config', { token, method: 'POST', body: {
            patch: { settingsConfig: { evcsCount: 1, evcsList: [clone(originalRows[1])] } }, restartEms: false,
            expectedConfigurationRevision: emptyConfig.data.configurationRevision,
            expectedDynamicGridConfigVersion: emptyConfig.data.config.dynamicGridConnection?.configVersion,
        } });
        assert.equal(readd.status, 200, readd.text);
        await reload();
        await page.$eval('#evcsCount', el => { el.value = '0'; el.dispatchEvent(new Event('change', { bubbles: true })); });
        assert.equal((await save()).status, 200);
        assert.equal(posts.at(-1).patch.settingsConfig.__allowEmptyEvcsList, true);
        assert.deepEqual(stored().settingsConfig.evcsList, []);
        await reload();
        checks.push('explicit-count-zero-persists-empty-without-stored-permission-marker');

        // Hold an actual asynchronous backend read. Even a queued keyboard/click
        // event may not save the old form while a replacement snapshot is loading.
        let enterRead, releaseRead;
        const entered = new Promise(resolve => { enterRead = resolve; });
        const release = new Promise(resolve => { releaseRead = resolve; });
        const originalLicenseRefresh = a._nwRefreshLicenseFromConfiguredKey;
        a._nwLicenseInfo = null;
        a._nwRefreshLicenseFromConfiguredKey = async () => { enterRead(); await release; };
        try {
            const beforeLoad = posts.length;
            await page.click('#nw-emsapps-reload');
            await Promise.race([entered, new Promise((_, reject) => setTimeout(() => reject(new Error('pending read did not start')), 5000).unref())]);
            assert.equal(await page.$eval('main', el => el.inert), true);
            await page.$eval('#nw-emsapps-save', el => el.dispatchEvent(new Event('click', { bubbles: true })));
            await waitStatus('Laden, Speichern oder Import läuft bereits');
            assert.equal(posts.length, beforeLoad);
            releaseRead();
            await waitStatus('Konfiguration geladen');
            assert.equal(await page.$eval('main', el => el.inert), false);
        } finally { releaseRead(); a._nwRefreshLicenseFromConfiguredKey = originalLicenseRefresh; }
        checks.push('pending-real-config-read-blocks-save-and-restores-editing-after-complete-snapshot');

        assert.deepEqual(errors, []);
        const after = await sourceHashes();
        assert.deepEqual(after, before, 'source and shipped runtime bytes stay unchanged during the browser run');
        const report = { result: 'PASS', node: process.version, browser: await browser.version(), checks,
            at: new Date().toISOString(), hashes: after,
            scope: 'Production AppCenter/HTTP/CAS/persistence/runtime apply; in-memory ioBroker and engine/session fixtures; no hardware.' };
        if (process.env.EOS_EVCS_DELETE_REPORT) {
            await fs.mkdir(path.dirname(process.env.EOS_EVCS_DELETE_REPORT), { recursive: true });
            await fs.writeFile(process.env.EOS_EVCS_DELETE_REPORT, JSON.stringify(report, null, 2) + '\n');
        }
        if (process.env.EOS_EVCS_DELETE_SCREENSHOT) await page.screenshot({ path: process.env.EOS_EVCS_DELETE_SCREENSHOT, fullPage: false });
        console.log(JSON.stringify(report));
    } finally {
        if (browser) await browser.close();
        if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
        await new Promise(resolve => a.onUnload(resolve));
        await h.close();
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
