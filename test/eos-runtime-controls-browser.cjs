/* Real Chromium + production HTTP routes, runtime-control service and config store.
 * The ioBroker DB, authentication source and process lifecycle are synthetic fixtures.
 * No controller, physical device, customer configuration or external service is accessed. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const express = require('express');
const puppeteer = require('puppeteer');
const { EosRuntimeControl } = require('../src/lib/eosRuntimeControl');
const { EosModuleConfigStore } = require('../src/lib/eosModuleConfigStore');
const { registerEosModuleRoutes } = require('../src/lib/eosModuleHttp');
const root = path.resolve(__dirname, '..');
const card = id => `section[data-process="${id}"]`;
const button = (id, action) => `${card(id)} button[data-action="${action}"]`;
const until = async predicate => {
    for (let attempt = 0; attempt < 100; attempt++) {
        if (predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('fixture condition timed out');
};
async function main() {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'eos-runtime-controls-browser-'));
    let browser; let server; let service; let origin = ''; let role = 'admin'; let migrationAllowed = true;
    let responseMode = ''; let heldResponse; let heldLifecycle; let holdLifecycle = ''; let failLifecycle = '';
    const checks = []; const pageErrors = []; const calls = []; const writes = []; const requests = [];
    const objects = new Map(); const csrf = 'fixture-csrf-'.repeat(4);
    const processHealth = state => ({ mode: 'process', state, pid: state === 'running' ? 32123 : null,
        generation: state === 'running' ? 1 : 0, restarts: 0, lastError: '', lastHeartbeatAt: Date.now(), nextRestartAt: 0 });
    const status = { ui: processHealth('running'), ems: { ...processHealth('running'), pid: 32125 }, devices: processHealth('running'), eebus: processHealth('running'), backup: processHealth('stopped'), ocpp: processHealth('stopped') };
    status.ocpp.state = 'error'; status.ocpp.lastError = 'EOS_MODULE_DEPENDENCY_MISSING';
    const configured = { devices: true, eebus: false, backup: false, ocpp: false };
    const owner = { namespace: 'eos-admin.0', config: {}, log: { warn: () => undefined },
        encrypt: text => `fixture:${Buffer.from(text).toString('base64')}`,
        decrypt: text => { if (!text.startsWith('fixture:')) throw new Error('fixture ciphertext'); return Buffer.from(text.slice(8), 'base64').toString(); },
        getForeignObjectAsync: async id => structuredClone(objects.get(id)),
        setForeignObjectAsync: async (id, value) => { writes.push(id); objects.set(id, structuredClone(value)); },
        getObjectViewAsync: async () => ({ rows: [{ id: 'system.adapter.ocpp21.0' }] }),
        getForeignStateAsync: async id => ({ val: id.endsWith('.pid') ? 23456 : true, ack: true, q: 0, ts: Date.now(), lc: Date.now() - 1000 }),
        eosMigration: { allowsStartup: () => migrationAllowed }, eosOwnership: { canWrite: () => true },
        eosLicenseService: { statusView: () => ({ valid: true, coreEnabled: true }), allowsEmbeddedModule: () => true },
    };
    const change = async (id, action) => {
        calls.push({ id, action });
        status[id].state = action === 'stop' ? 'stopping' : 'starting';
        if (holdLifecycle === `${id}:${action}`) await new Promise(resolve => { heldLifecycle = resolve; });
        if (failLifecycle === `${id}:${action}`) throw Object.assign(new Error('synthetic stop failure'), { code: 'EOS_RUNTIME_STOP_UNCONFIRMED' });
        status[id].state = action === 'stop' ? 'stopped' : 'running';
        status[id].pid = action === 'stop' ? null : id === 'ems' ? 32126 : 32124;
        if (action === 'start') status[id].generation++;
        status[id].lastHeartbeatAt = Date.now();
    };
    const moduleStore = new EosModuleConfigStore(owner);
    const host = { owner, view: async id => ({ config: { enabled: configured[id] } }),
        enableProcessModule: async id => {
            const config = { enabled: true, retainedSetting: `fixture-${id}`, secret: 'fixture-private-setting' };
            await moduleStore.load(id);
            await moduleStore.save(id, { v: 1, encrypted: owner.encrypt(JSON.stringify(config)) });
            configured[id] = true;
        },
        status: async id => ({ enabled: configured[id], active: status[id].state === 'running', reason: configured[id] ? 'RUNNING' : 'DISABLED', details: { process: { ...status[id] } } }),
        controlProcess: (id, action) => change(id, action) };
    const runtime = { status: () => ({
        ui: { active: status.ui.state === 'running', process: { ...status.ui } },
        ems: { active: status.ems.state === 'running', emsReady: status.ems.state === 'running', process: { ...status.ems } },
    }), pause: () => change('ui', 'stop'), resume: () => change('ui', 'start'),
        pauseEms: () => change('ems', 'stop'), resumeEms: () => change('ems', 'start') };
    try {
        service = new EosRuntimeControl({ owner, host, runtime }); await service.initialize();
        service.request('eebus', 'disable', service.revision); await service.whenIdle();
        calls.length = 0; writes.length = 0;
        const app = express();
        app.use('/api/eos/runtime', (req, res, next) => {
            if (req.method === 'POST') {
                requests.push({ method: req.method, path: req.path });
                if (responseMode === 'drop') { heldResponse = res; return; }
            }
            next();
        });
        app.get('/eos-session-idle.js', (_req, res) => res.type('text/javascript').send(''));
        app.get('/system/img/eos/nexowatt-eos-brand-wide.png', (_req, res) => res.status(204).end());
        registerEosModuleRoutes({ app, host, baseDir: root, runtimeControl: service, runtimeStatus: () => runtime.status(), jsonParser: express.json(),
            authorize: async req => ({ authenticated: req.headers.cookie?.includes('runtime_fixture=yes') === true, role, csrfToken: csrf }),
            requestAllowed: req => !req.headers.origin || req.headers.origin === origin,
            csrfAllowed: req => req.headers.origin === origin && req.headers['x-nw-csrf'] === csrf });
        server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
        origin = `http://127.0.0.1:${server.address().port}`;
        browser = await puppeteer.launch({ executablePath: process.env.EOS_CHROMIUM_PATH || await puppeteer.executablePath(),
            headless: true, userDataDir: path.join(temp, 'profile'), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
        const page = await browser.newPage(); page.on('pageerror', error => pageErrors.push(error.message));
        await page.setCookie({ name: 'runtime_fixture', value: 'yes', url: origin });
        await page.setViewport({ width: 1440, height: 1050 });
        await page.goto(`${origin}/runtime/`); await page.waitForSelector(button('devices', 'restart'));
        await page.waitForFunction(selector => !document.querySelector(selector).disabled, {}, button('devices', 'restart'));
        assert.equal(await page.$$eval('.runtime-controls button', nodes => nodes.length), 18);
        assert.equal(await page.$$eval(`${card('admin')} button,${card('ocpp21.0')} button`, nodes => nodes.length), 0);
        assert.equal(await page.$eval(button('backup', 'enable'), node => node.disabled), false);
        assert.equal(await page.$eval(`${card('backup')} .runtime-badge`, node => node.textContent), 'Modul deaktiviert');
        assert.match(await page.$eval(card('backup'), node => node.textContent), /Modul und Prozess gemeinsam/);
        assert.equal(await page.$eval(button('eebus', 'enable'), node => node.disabled), false);
        assert.equal(await page.$eval(`${card('eebus')} .runtime-badge`, node => node.textContent), 'Deaktiviert');
        assert.equal(await page.$eval(`${card('backup')} .runtime-config-link`, node => node.getAttribute('href')), '/modules/backup/');
        assert.match(await page.$eval(card('ocpp'), node => node.textContent), /Eine benötigte Moduldatei oder Abhängigkeit fehlt/);
        checks.push({ name: 'six hosted controls; parent/external OCPP read-only; module-off and both-off screenshot states both offer enable', result: 'passed' });
        for (const id of ['backup', 'eebus']) {
            const previous = calls.length;
            await page.locator(button(id, 'enable')).click();
            await until(() => service.pending === null && calls.length > previous);
            await page.waitForFunction(selector => document.querySelector(selector)?.textContent === 'Läuft', {}, `${card(id)} .runtime-badge`);
            assert.deepEqual(calls.slice(previous), [{ id, action: 'stop' }, { id, action: 'start' }]);
            const saved = await moduleStore.load(id);
            assert.deepEqual(JSON.parse(owner.decrypt(saved.encrypted)), { enabled: true, retainedSetting: `fixture-${id}`, secret: 'fixture-private-setting' });
        }
        const restoredActivation = new EosRuntimeControl({ owner, host, runtime }); await restoredActivation.initialize();
        assert.equal(restoredActivation.isEnabled('backup'), true); assert.equal(restoredActivation.isEnabled('eebus'), true);
        await restoredActivation.close();
        await page.reload(); await page.waitForFunction(selector => document.querySelector(selector)?.textContent === 'Läuft', {}, `${card('eebus')} .runtime-badge`);
        checks.push({ name: 'single browser action enables both gates with protected persistence; confirmed starts and page reload preserve activation', result: 'passed' });
        calls.length = 0; writes.length = 0; requests.length = 0;
        const beforeCsrf = calls.length;
        const csrfDenied = await page.evaluate(async () => {
            const state = await (await fetch('/api/eos/runtime')).json();
            const revision = state.processes.find(row => row.id === 'devices').controls.revision;
            const response = await fetch('/api/eos/runtime/devices/control', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'disable', expectedRevision: revision }) });
            return response.status;
        });
        assert.equal(csrfDenied, 403); assert.equal(calls.length, beforeCsrf); requests.length = 0;
        checks.push({ name: 'production mutation route rejects missing CSRF without touching lifecycle', result: 'passed' });

        // The service persists desired state first, then waits for the actual lifecycle.
        holdLifecycle = 'devices:stop'; await page.locator(button('devices', 'disable')).click();
        await until(() => typeof heldLifecycle === 'function');
        await page.waitForFunction(selector => document.querySelector(selector)?.textContent?.includes('Steuerauftrag läuft'), {}, card('devices'));
        assert.match(await page.$eval(`${card('devices')} .runtime-badge`, node => node.textContent), /Wird beendet/);
        assert.equal(await page.$$eval('.runtime-controls button', nodes => nodes.every(node => node.disabled)), true);
        assert.equal(requests.length, 1); assert.equal(calls.length, 1);
        assert.deepEqual(writes, ['eos-admin.0.modules.runtime.configuration']);
        checks.push({ name: 'disable persists desired state; accepted job stays busy until confirmed stop; no early stopped badge', result: 'passed' });
        holdLifecycle = ''; heldLifecycle(); heldLifecycle = null; await until(() => service.pending === null);
        await page.click('#refresh'); await page.waitForFunction(selector => !document.querySelector(selector).disabled, {}, button('devices', 'enable'));
        assert.equal(await page.$eval(`${card('devices')} .runtime-badge`, node => node.textContent), 'Deaktiviert');
        const restored = new EosRuntimeControl({ owner, host, runtime }); await restored.initialize();
        assert.equal(restored.isEnabled('devices'), false); assert.equal(restored.isEnabled('ui'), true); restored.close();
        await page.reload(); await page.waitForFunction(selector => !document.querySelector(selector)?.disabled, {}, button('devices', 'enable'));
        assert.match(await page.$eval(card('devices'), node => node.textContent), /ProzessfreigabeDeaktiviert/);
        checks.push({ name: 'disabled choice survives page reload and a fresh production config-service read', result: 'passed' });

        holdLifecycle = 'devices:start'; await page.locator(button('devices', 'enable')).click();
        await until(() => typeof heldLifecycle === 'function');
        await page.waitForFunction(selector => document.querySelector(selector)?.textContent === 'Startet', {}, `${card('devices')} .runtime-badge`);
        assert.equal(await page.$eval(`${card('devices')} .runtime-badge`, node => node.classList.contains('is-running')), false);
        holdLifecycle = ''; heldLifecycle(); heldLifecycle = null; await until(() => service.pending === null);
        await page.click('#refresh'); await page.waitForFunction(selector => document.querySelector(selector)?.textContent === 'Läuft', {}, `${card('devices')} .runtime-badge`);
        checks.push({ name: 'enable waits for lifecycle readiness and displays green only after confirmed running state', result: 'passed' });

        const beforeRestart = calls.length;
        await page.locator(button('devices', 'restart')).click(); await until(() => service.pending === null && calls.length > beforeRestart);
        assert.deepEqual(calls.slice(beforeRestart), [{ id: 'devices', action: 'stop' }, { id: 'devices', action: 'start' }]);
        await page.waitForFunction(selector => !document.querySelector(selector)?.disabled, {}, button('devices', 'restart'));
        checks.push({ name: 'restart uses confirmed stop before start through the production control service', result: 'passed' });

        migrationAllowed = false; await page.click('#refresh');
        await page.waitForFunction(selector => document.querySelector(selector)?.textContent?.includes('nicht abgeschlossene Geräteübernahme'), {}, card('devices'));
        assert.equal(await page.$eval(button('devices', 'restart'), node => node.disabled), true);
        assert.equal(await page.$eval(button('devices', 'disable'), node => node.disabled), false);
        assert.equal(await page.$eval(`${card('devices')} a[href="/migration/"]`, node => !!node), true);
        checks.push({ name: 'migration blocks starts with explanation and status link while stop remains available', result: 'passed' });
        migrationAllowed = true; await page.click('#refresh');
        await page.waitForFunction(selector => !document.querySelector(selector)?.disabled, {}, button('devices', 'restart'));

        // A separate admin tab changed the desired state after this page's snapshot.
        service.revision = crypto.randomUUID(); const beforeConflict = calls.length;
        await page.locator(button('devices', 'restart')).click();
        await page.waitForFunction(() => document.getElementById('control-message').textContent.includes('zwischenzeitlich geändert'));
        assert.equal(calls.length, beforeConflict);
        await page.waitForFunction(selector => !document.querySelector(selector)?.disabled, {}, button('devices', 'restart'));
        checks.push({ name: 'stale revision fails without lifecycle change and refreshes current controls', result: 'passed' });

        failLifecycle = 'eebus:stop'; const beforeFailedStop = calls.length;
        await page.locator(button('eebus', 'disable')).click(); await until(() => service.pending === null && calls.length > beforeFailedStop);
        await page.waitForFunction(selector => document.querySelector(selector)?.textContent?.includes('Ende des bisherigen Prozesses ist nicht bestätigt'), {}, card('eebus'));
        assert.notEqual(await page.$eval(`${card('eebus')} .runtime-badge`, node => node.textContent), 'Deaktiviert');
        assert.equal(await page.$eval(button('eebus', 'enable'), node => node.disabled), true);
        assert.equal(await page.$eval(button('eebus', 'restart'), node => node.disabled), true);
        assert.deepEqual(calls.slice(beforeFailedStop), [{ id: 'eebus', action: 'stop' }]);
        checks.push({ name: 'unconfirmed stop remains visibly unconfirmed and never claims successful deactivation', result: 'passed' });
        failLifecycle = '';

        const beforeUi = calls.length; await page.locator(button('ui', 'disable')).click();
        await until(() => service.pending === null && calls.length > beforeUi);
        await page.waitForFunction(selector => !document.querySelector(selector)?.disabled, {}, button('ui', 'enable'));
        assert.equal(await page.$eval(`${card('admin')} .runtime-badge`, node => node.textContent), 'Läuft');
        await page.reload(); await page.waitForFunction(selector => !document.querySelector(selector)?.disabled, {}, button('ui', 'enable'));
        assert.doesNotMatch(await page.$eval(card('ui'), node => node.textContent), /EMS bereit/);
        assert.match(await page.$eval(card('ems'), node => node.textContent), /EMS bereitJa/);
        await page.locator(button('ui', 'enable')).click(); await until(() => service.pending === null && status.ui.state === 'running');
        await page.waitForFunction(selector => document.querySelector(selector)?.textContent?.includes('EMS bereitJa'), {}, card('ems'));
        assert.equal(status.ems.pid, 32125);
        checks.push({ name: 'UI pause remains controllable from parent runtime page while EMS readiness and PID stay stable', result: 'passed' });

        const beforeEms = calls.length; await page.locator(button('ems', 'disable')).click();
        await until(() => service.pending === null && calls.length > beforeEms);
        await page.waitForFunction(selector => document.querySelector(selector)?.textContent?.includes('EMS bereitNein'), {}, card('ems'));
        assert.equal(await page.$eval(`${card('ui')} .runtime-badge`, node => node.textContent), 'Läuft');
        assert.deepEqual(calls.slice(beforeEms), [{ id: 'ems', action: 'stop' }]);
        checks.push({ name: 'EMS pause is separate from the UI lifecycle', result: 'passed' });

        // The response is deliberately lost before the request reaches the service.
        responseMode = 'drop'; const requestsBeforeDrop = requests.length; const callsBeforeDrop = calls.length;
        await page.locator(button('devices', 'restart')).click();
        await page.waitForFunction(() => document.getElementById('control-message').textContent.includes('Bestätigung des Steuerauftrags fehlt'), { timeout: 10000 });
        assert.equal(requests.length, requestsBeforeDrop + 1); assert.equal(calls.length, callsBeforeDrop);
        responseMode = ''; if (heldResponse && !heldResponse.destroyed) heldResponse.end(); heldResponse = null;
        await page.waitForFunction(selector => !document.querySelector(selector)?.disabled, {}, button('devices', 'restart'));
        checks.push({ name: 'missing command response is reported as unconfirmed; no automatic command replay', result: 'passed' });

        await page.setViewport({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
        assert.equal(await page.$eval(button('devices', 'restart'), node => node.getBoundingClientRect().height >= 40), true);
        checks.push({ name: 'mobile 390px has usable buttons without horizontal overflow', result: 'passed' });
        if (process.env.EOS_BROWSER_SCREENSHOT_DIR) {
            await fs.mkdir(process.env.EOS_BROWSER_SCREENSHOT_DIR, { recursive: true });
            await page.screenshot({ path: path.join(process.env.EOS_BROWSER_SCREENSHOT_DIR, 'runtime-controls-mobile.png'), fullPage: true });
            await page.setViewport({ width: 1440, height: 1050 });
            await page.screenshot({ path: path.join(process.env.EOS_BROWSER_SCREENSHOT_DIR, 'runtime-controls-desktop.png'), fullPage: true });
        }
        role = 'enduser'; const callsBeforeDenied = calls.length;
        await page.locator(button('devices', 'restart')).click(); await page.waitForSelector('.runtime-empty');
        assert.equal(calls.length, callsBeforeDenied);
        assert.equal(await page.$$eval('.runtime-controls button', nodes => nodes.length), 0);
        assert.match(await page.$eval('#control-message', node => node.textContent), /Administratoranmeldung/);
        checks.push({ name: 'lost administrator role denies mutation and removes all actionable status', result: 'passed' });
        assert.deepEqual(pageErrors, []);
        const sourceHashes = {};
        for (const file of ['src/lib/eosRuntimeControl.js', 'src/lib/eosModuleHttp.js', 'src/lib/eosRuntimeHealth.js', 'public/eos-runtime/index.js', 'public/eos-runtime/index.html', 'public/eos-runtime/style.css']) {
            sourceHashes[file] = crypto.createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex');
        }
        console.log(JSON.stringify({ result: 'passed', runAt: new Date().toISOString(), node: process.version, browser: await browser.version(),
            scope: 'Real Chromium, production runtime UI, routes, control service and protected config-store logic. Synthetic DB, auth source and process lifecycle; no live ioBroker controller or physical devices.',
            checks, pageErrors, sourceHashes }, null, 2));
    } finally {
        holdLifecycle = ''; heldLifecycle?.();
        if (heldResponse && !heldResponse.destroyed) heldResponse.end();
        service?.close();
        if (service?.pending) await service.pending;
        if (browser) await browser.close();
        if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
        await fs.rm(temp, { recursive: true, force: true });
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
