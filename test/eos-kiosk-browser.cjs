/** Real Chromium executes canonical frontend TS and the real EOS kiosk/session HTTP boundary.
 * Controller storage and identity/group lookup are fixtures. OAuth proof, CSRF, kiosk cookies,
 * role guards, configuration persistence and frontend behavior use production code. No device IO. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const ts = require('typescript');
const puppeteer = require('puppeteer');
const { fixture } = require('./fixtures/eos-kiosk-browser.cjs');
const root = path.resolve(__dirname, '..');
const sources = ['runtime-base', 'auth', 'login', 'eos-session-idle', 'eos-kiosk-settings'];
const evidenceFiles = sources.map(name => `ui/src-ts/runtime-executables/www/${name}.ts`).concat(['ui/www/settings.html', 'ui/www/login.html', 'src/lib/web.ts', 'src/lib/eosKiosk.ts', 'src/lib/eosUnifiedBoundary.js', 'src/lib/eosSessionSecurity.js', 'ui/main.js', 'ui/lib/hosted-adapter.js']);
const sourceHashes = () => Object.fromEntries(evidenceFiles.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
const initialHashes = sourceHashes();
const compiled = new Map(sources.map(name => [name, ts.transpileModule(fs.readFileSync(path.join(root, 'ui/src-ts/runtime-executables/www', name + '.ts'), 'utf8'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText]));
const dashboard = '<!doctype html><html><head><script src="/static/runtime-base.js"></script><script src="/static/auth.js" defer></script><script src="/eos-session-idle.js" defer></script></head><body><header class="topbar"></header><main id="testDashboard">Energie-Dashboard</main><a data-nw-admin-link href="/system/">System</a></body></html>';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
    const cleanup = [], checks = [], errors = [], writes = [];
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-kiosk-browser-')); let browser;
    const x = await fixture({ after: fn => cleanup.push(fn) }, {
        beforeMount(app) {
            app.use((req, _res, next) => { if (req.method === 'PUT' && req.path === '/api/eos/kiosk') writes.push({ body: req.body, csrf: /^[a-f0-9]{64}$/.test(req.headers['x-nw-csrf'] || '') }); next(); });
            app.get('/eos-session-idle.js', (_req, res) => res.type('text/javascript').send(compiled.get('eos-session-idle')));
            app.get('/static/:file', (req, res, next) => {
                const name = req.params.file.replace(/\.js$/, '');
                if (compiled.has(name)) return res.type('text/javascript').send(compiled.get(name));
                // Settings controller is isolated from unrelated tariff/update/telemetry scripts;
                // production settings markup, auth and kiosk settings controller remain unchanged.
                if (/\.js$/.test(req.params.file)) return res.type('text/javascript').send('');
                next();
            });
            app.get('/', (_req, res) => res.type('html').send(dashboard));
        },
    });
    try {
        browser = await puppeteer.launch({ executablePath: process.env.EOS_CHROMIUM_PATH || puppeteer.executablePath(), headless: true,
            userDataDir: path.join(temp, 'profile'), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
        let page = await browser.newPage(); page.setDefaultTimeout(7000); page.on('pageerror', error => errors.push(error.message));
        await page.setViewport({ width: 1440, height: 1000 });
        const loginAs = async role => { x.setRole(role); const token = await x.issue(); await page.setCookie({ name: 'access_token', value: token.accessToken, url: x.origin }); return token; };
        const waitAuth = expected => page.waitForFunction(expected => window.NW_AUTH?.getState()?.authed === true && window.NW_AUTH?.getState()?.kiosk === expected, {}, expected);
        const admin = await loginAs('admin');
        await page.goto(x.origin + '/settings.html', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.getElementById('eosKioskToggle')?.disabled === false);
        assert.match(await page.$eval('#eosKioskStatus', e => e.textContent), /ausgeschaltet/);
        const legacyLinks = await page.$$eval('a', nodes => nodes.filter(n => /migration|bestandsübernahme|übernahme/i.test(n.href + ' ' + n.textContent)).map(n => ({ href: n.getAttribute('href'), text: n.textContent.trim() })));
        assert.deepEqual(legacyLinks, [], 'obsolete Bestand/Migration entry must remain absent from Settings');
        checks.push({ name: 'settings initial persisted status, enabled admin button and obsolete migration entry absent', result: 'passed' });
        await page.click('#eosKioskToggle'); await page.waitForFunction(() => location.pathname === '/'); await waitAuth(true);
        assert.equal(writes.length, 1); assert.deepEqual(writes[0].body, { enabled: true, revision: 0 }); assert.equal(writes[0].csrf, true);
        assert.equal(x.objects.get('eos-admin.0.kiosk.configuration').native.enabled, true);
        assert.equal((await x.request('/api/auth/status?admin=1', admin)).json.authenticated, false);
        assert.equal(await page.$eval('#testDashboard', e => getComputedStyle(e).visibility), 'visible');
        assert.equal(await page.$eval('[data-nw-admin-link]', e => getComputedStyle(e).display), 'none');
        checks.push({ name: 'settings toggle persists revision with CSRF, revokes admin and returns into restricted kiosk', result: 'passed' });
        const cdp = await page.createCDPSession();
        await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' });
        let exhausted = false; cdp.once('Emulation.virtualTimeBudgetExpired', () => { exhausted = true; });
        await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pauseIfNetworkFetchesPending', budget: 660001 });
        for (let i = 0; i < 1000 && !exhausted; i++) await delay(10);
        assert.equal(exhausted, true, 'Chromium must execute more than ten minutes of virtual time');
        await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' });
        await waitAuth(true); assert.equal(new URL(page.url()).pathname, '/');
        assert.equal(await page.$eval('#testDashboard', e => getComputedStyle(e).visibility), 'visible');
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('nw-session-idle-locked')), false);
        checks.push({ name: '660001ms Chromium virtual time: kiosk stays open without user input or idle renewal', result: 'passed' });
        await cdp.detach(); await page.close(); page = await browser.newPage(); page.setDefaultTimeout(7000); page.on('pageerror', error => errors.push(error.message));
        await page.goto(x.origin + '/', { waitUntil: 'domcontentloaded' }); await waitAuth(true);
        await page.setViewport({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.click('.nw-auth-btn'); await page.waitForSelector('#loginForm:not([hidden])');
        assert.equal(new URL(page.url()).searchParams.get('admin'), '1');
        assert.equal(new URL(page.url()).searchParams.get('returnTo'), '/system/');
        await delay(100); assert.equal(new URL(page.url()).pathname, '/login.html');
        assert.equal(await page.$eval('#centralLogin', e => e.hidden), true);
        checks.push({ name: 'mobile Admin öffnen opens real credential form with admin intent, no kiosk redirect loop', result: 'passed' });
        await loginAs('customer');
        await page.goto(x.origin + '/login.html?admin=1&returnTo=/system/', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#loginForm:not([hidden])');
        assert.match(await page.$eval('#loginStatus', e => e.textContent), /keine Administratorrechte/);
        const denied = await page.evaluate(async () => (await fetch('/api/eos/kiosk', { redirect: 'manual' })).status);
        assert.equal(denied, 403);
        checks.push({ name: 'normal customer remains at admin credential form and cannot read admin-only kiosk configuration', result: 'passed' });
        const tabletContext = await browser.createBrowserContext(); const tablet = await tabletContext.newPage();
        tablet.setDefaultTimeout(7000); tablet.on('pageerror', error => errors.push(error.message));
        await tablet.goto(x.origin + '/', { waitUntil: 'domcontentloaded' });
        await tablet.waitForFunction(() => window.NW_AUTH?.getState()?.kiosk === true);
        await loginAs('admin');
        await page.goto(x.origin + '/settings.html', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.getElementById('eosKioskToggle')?.disabled === false);
        assert.match(await page.$eval('#eosKioskStatus', e => e.textContent), /ist aktiv/);
        await page.click('#eosKioskToggle');
        await page.waitForFunction(() => document.getElementById('eosKioskStatus')?.textContent.includes('ausgeschaltet'));
        assert.deepEqual(writes[1].body, { enabled: false, revision: 1 }); assert.equal(writes[1].csrf, true);
        assert.equal(x.objects.get('eos-admin.0.kiosk.configuration').native.enabled, false);
        checks.push({ name: 'settings disable persists false with next revision and displays confirmed disabled status', result: 'passed' });
        await tablet.evaluate(() => { window.dispatchEvent(new Event('focus')); });
        await tablet.waitForFunction(() => location.pathname === '/login.html');
        await tablet.waitForSelector('#loginForm:not([hidden])');
        assert.equal(await tablet.evaluate(async () => (await fetch('/api/state')).status), 401);
        checks.push({ name: 'already open independent kiosk tablet locks on the next server recheck after disable', result: 'passed' });
        await tabletContext.close();
        await page.deleteCookie({ name: 'access_token', url: x.origin });
        await page.goto(x.origin + '/', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => location.pathname === '/login.html');
        await page.waitForSelector('#loginForm:not([hidden])');
        const blocked = await page.evaluate(async () => (await fetch('/api/state')).status); assert.equal(blocked, 401);
        checks.push({ name: 'disabled kiosk cookie cannot reopen dashboard API and user is returned to login', result: 'passed' });
        assert.deepEqual(errors, []);
        const hashes = sourceHashes(); assert.deepEqual(hashes, initialHashes, 'tested product sources must not change during the browser run');
        console.log(JSON.stringify({ result: 'passed', runAt: new Date().toISOString(), node: process.version, browser: await browser.version(),
            scope: 'Real Chromium, canonical TS transpiled in memory, real Web/EosKiosk/UnifiedSessions/OAuth model/CSRF/persistence; controller lookup/storage mocked. Dashboard markup is a small fixture; settings/login markup is production. Unrelated settings scripts omitted. 11 minutes are Chromium virtual time, not elapsed wall time.', checks, pageErrors: errors, hashes }, null, 2));
    } finally {
        if (browser) await browser.close(); for (const close of cleanup.reverse()) await close(); fs.rmSync(temp, { recursive: true, force: true });
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
