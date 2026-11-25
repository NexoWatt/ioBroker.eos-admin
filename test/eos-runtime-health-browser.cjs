/* Real Chromium renders production /runtime/ HTML, CSS, script and guarded routes.
 * Controller/module health and auth roles are simulated. No plant, relay or external service is accessed. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const express = require('express');
const puppeteer = require('puppeteer');
const { registerEosModuleRoutes } = require('../src/lib/eosModuleHttp');
const root = path.resolve(__dirname, '..');
async function main() {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'eos-runtime-browser-')); let browser; let server;
    const checks = []; const pageErrors = []; let apiMode = 'normal'; let held = null;
    try {
        const processHealth = state => ({ mode: 'process', state, pid: state === 'running' ? 32123 : null,
            generation: 2, restarts: 0, lastError: state === 'backoff' ? 'EOS_MODULE_PROCESS_EXIT' : '', lastHeartbeatAt: Date.now(), nextRestartAt: 0 });
        const host = { status: async id => ({ enabled: id !== 'backup', active: id === 'devices', config: { secret: 'NEVER_EXPOSE_THIS' },
            details: { process: processHealth(id === 'backup' ? 'stopped' : id === 'eebus' ? 'backoff' : 'running') } }),
        owner: { getObjectViewAsync: async () => ({ rows: [{ id: 'system.adapter.ocpp21.0' }] }),
            getForeignStateAsync: async id => ({ val: id.endsWith('.pid') ? 23456 : true, ts: Date.now(), lc: Date.now() - 10000, ack: true, q: 0 }) } };
        const app = express();
        app.use('/api/eos/runtime', (_req, res, next) => {
            if (apiMode === 'error') { res.status(503).json({ error: 'EOS_RUNTIME_STATUS_UNAVAILABLE' }); return; }
            if (apiMode === 'denied') { res.status(403).json({ error: 'ADMIN_REQUIRED' }); return; }
            if (apiMode === 'hold') { held = res; return; }
            next();
        });
        // Session idle integration is tested separately; this fixture has no login session.
        app.get('/eos-session-idle.js', (_req, res) => res.type('text/javascript').send(''));
        app.get('/system/img/eos/nexowatt-eos-brand-wide.png', (_req, res) => res.status(204).end());
        registerEosModuleRoutes({ app, host, baseDir: root, jsonParser: express.json(),
            authorize: async () => ({ authenticated: true, role: 'admin' }), requestAllowed: () => true, csrfAllowed: () => false,
            runtimeStatus: () => ({ active: true, emsReady: false, process: processHealth('running') }) });
        server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
        browser = await puppeteer.launch({ executablePath: process.env.EOS_CHROMIUM_PATH || await puppeteer.executablePath(),
            headless: true, userDataDir: path.join(temp, 'profile'), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
        const page = await browser.newPage(); page.on('pageerror', error => pageErrors.push(error.message));
        await page.evaluateOnNewDocument(() => {
            const originalFetch = window.fetch; const probe = window.__probe = { starts: [], pending: 0, maxPending: 0, aborted: 0, hidden: false };
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => probe.hidden });
            window.fetch = async (...args) => {
                probe.starts.push(performance.now()); probe.pending++; probe.maxPending = Math.max(probe.maxPending, probe.pending);
                try { return await originalFetch(...args); }
                catch (error) { if (error.name === 'AbortError') probe.aborted++; throw error; }
                finally { probe.pending--; }
            };
        });
        await page.setViewport({ width: 1440, height: 1050 });
        await page.goto(`http://127.0.0.1:${server.address().port}/runtime/`);
        await page.waitForSelector('[data-process="ocpp21.0"]');
        const initial = await page.evaluate(() => ({ text: document.getElementById('processes').textContent,
            cards: document.querySelectorAll('.runtime-card').length, overflow: document.documentElement.scrollWidth > window.innerWidth }));
        assert.equal(initial.cards, 7); assert.equal(initial.overflow, false); assert.doesNotMatch(initial.text, /NEVER_EXPOSE_THIS/);
        assert.match(initial.text, /EMS bereitNein/); assert.match(initial.text, /Neustart wartet/); assert.match(initial.text, /Deaktiviert/);
        assert.match(initial.text, /23456/); checks.push({ name: 'desktop production markup, seven distinct processes including hosted and external OCPP, explicit EMS not ready', result: 'passed' });
        if (process.env.EOS_BROWSER_SCREENSHOT_DIR) {
            await fs.mkdir(process.env.EOS_BROWSER_SCREENSHOT_DIR, { recursive: true });
            await page.screenshot({ path: path.join(process.env.EOS_BROWSER_SCREENSHOT_DIR, 'runtime-desktop.png'), fullPage: true });
        }
        await page.setViewport({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
        if (process.env.EOS_BROWSER_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.EOS_BROWSER_SCREENSHOT_DIR, 'runtime-mobile.png'), fullPage: true });
        checks.push({ name: 'mobile 390px, no horizontal page overflow', result: 'passed' });
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10200)));
        const cadence = await page.evaluate(() => ({ starts: window.__probe.starts.slice(), maxPending: window.__probe.maxPending }));
        assert.equal(cadence.starts.length, 3); assert.equal(cadence.maxPending, 1);
        const gaps = cadence.starts.slice(1).map((value, index) => value - cadence.starts[index]);
        assert.ok(gaps.every(ms => ms >= 4800 && ms <= 5700));
        checks.push({ name: 'single request and five-second cadence with real timers', result: 'passed', gapsMs: gaps });
        apiMode = 'error'; await page.click('#refresh'); await page.waitForSelector('.runtime-empty');
        assert.equal(await page.$$eval('.is-running', nodes => nodes.length), 0);
        checks.push({ name: 'HTTP failure removes previously green process state', result: 'passed' });
        apiMode = 'normal'; await page.click('#refresh'); await page.waitForSelector('[data-process="devices"]');
        checks.push({ name: 'recovery restores confirmed process snapshot', result: 'passed' });
        apiMode = 'hold'; await page.click('#refresh');
        await page.waitForFunction(() => window.__probe.pending === 1);
        await page.evaluate(() => { window.__probe.hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
        await page.waitForFunction(() => window.__probe.pending === 0);
        const beforeHidden = await page.evaluate(() => window.__probe.starts.length);
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 5200)));
        assert.equal(await page.evaluate(() => window.__probe.starts.length), beforeHidden);
        assert.ok(await page.evaluate(() => window.__probe.aborted >= 1));
        apiMode = 'normal'; if (held && !held.destroyed) held.end(); held = null;
        await page.evaluate(() => { window.__probe.hidden = false; document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
        await page.waitForSelector('[data-process="devices"]');
        assert.equal(await page.evaluate(() => window.__probe.starts.length), beforeHidden + 1);
        checks.push({ name: 'hidden aborts fetch and polling; visible/BFcache events produce one immediate refresh', result: 'passed' });
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
        const beforePagehide = await page.evaluate(() => window.__probe.starts.length);
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));
        assert.equal(await page.evaluate(() => window.__probe.starts.length), beforePagehide);
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
        await page.waitForSelector('[data-process="devices"]');
        assert.equal(await page.evaluate(() => window.__probe.starts.length), beforePagehide + 1);
        apiMode = 'denied'; await page.click('#refresh'); await page.waitForSelector('.runtime-empty');
        const beforeDenied = await page.evaluate(() => window.__probe.starts.length);
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 5200)));
        assert.equal(await page.evaluate(() => window.__probe.starts.length), beforeDenied);
        assert.match(await page.$eval('#request-message', element => element.textContent), /nur für die EOS-Administration/);
        checks.push({ name: 'permission loss clears status and stops automatic polling', result: 'passed' });
        assert.deepEqual(pageErrors, []);
        const sourceHashes = {};
        for (const file of ['src/lib/eosRuntimeHealth.js', 'src/lib/eosModuleHttp.js', 'public/eos-runtime/index.js', 'public/eos-runtime/index.html', 'public/eos-runtime/style.css']) {
            sourceHashes[file] = crypto.createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex');
        }
        console.log(JSON.stringify({ runAt: new Date().toISOString(), result: 'passed', node: process.version, browser: await browser.version(),
            scope: 'Real Chromium, production runtime diagnostic page and HTTP routes; simulated controller/module status and admin role; no real ioBroker plant or physical device. Visibility and BFcache events simulated.',
            checks, pageErrors, sourceHashes }, null, 2));
    } finally {
        if (held && !held.destroyed) held.end();
        if (browser) await browser.close();
        if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
        await fs.rm(temp, { recursive: true, force: true });
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
