/* Actual Chromium, production login assets, Web mount, runtime routes and OAuth/session boundary.
 * The existing fixture supplies an in-memory controller, identity and an in-process UI runtime.
 * Stopping that runtime tests parent-held recovery access; no physical device or live controller. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const puppeteer = require('puppeteer');
const { fixture } = require('./fixtures/eos-kiosk-browser.cjs');
const root = path.resolve(__dirname, '..');
const files = ['src/lib/web.ts', 'src/lib/eosModuleHttp.js', 'ui/src-ts/runtime-executables/www/login.ts', 'ui/www/login.js'];
const hashes = () => Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
async function main() {
    const cleanups = []; const checks = []; const errors = []; const logins = [];
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-runtime-login-browser-'));
    const initialHashes = hashes(); let browser;
    const x = await fixture({ after: fn => cleanups.push(fn) });
    try {
        await x.owner.eosHostedRuntime.stop();
        browser = await puppeteer.launch({ executablePath: process.env.EOS_CHROMIUM_PATH || await puppeteer.executablePath(),
            headless: true, userDataDir: path.join(temp, 'profile'), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
        const page = await browser.newPage(); page.setDefaultTimeout(10000);
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => { if (new URL(request.url()).pathname === '/api/auth/login') logins.push(request.method()); });
        await page.goto(x.origin + '/runtime/'); await page.waitForSelector('#loginForm:not([hidden])');
        assert.equal(new URL(page.url()).pathname, '/login.html');
        assert.equal(new URL(page.url()).searchParams.get('admin'), '1');
        assert.equal(new URL(page.url()).searchParams.get('returnTo'), '/runtime/');
        assert.equal(logins.length, 0);
        checks.push({ name: 'stopped UI runtime: anonymous process-page request reaches parent-held credential form with exact admin return target', result: 'passed' });

        await page.type('#loginUser', 'operator'); await page.type('#loginPassword', 'fixture-passphrase');
        await page.click('#loginSubmit'); await page.waitForSelector('section[data-process="admin"]');
        assert.equal(new URL(page.url()).pathname, '/runtime/'); assert.deepEqual(logins, ['POST']);
        assert.equal(await page.$eval('section[data-process="admin"] .runtime-badge', node => node.textContent), 'Läuft');
        const status = await page.evaluate(async () => (await fetch('/api/eos/runtime')).status);
        assert.equal(status, 200);
        checks.push({ name: 'actual password login and session confirmation return administrator to live parent process page while UI remains stopped', result: 'passed' });

        await page.goto(x.origin + '/login.html?admin=1&returnTo=%2Fruntime%2F');
        await page.waitForSelector('#loginForm:not([hidden])');
        assert.equal(new URL(page.url()).pathname, '/login.html');
        assert.equal(logins.length, 1);
        checks.push({ name: 'explicit admin intent still requires credentials even with an existing administrator session', result: 'passed' });

        x.setRole('customer');
        await page.type('#loginUser', 'operator'); await page.type('#loginPassword', 'fixture-passphrase');
        await page.click('#loginSubmit');
        await page.waitForFunction(() => document.getElementById('loginStatus')?.textContent.includes('keine Administratorrechte'));
        assert.equal(new URL(page.url()).pathname, '/login.html'); assert.deepEqual(logins, ['POST', 'POST']);
        assert.equal(await page.evaluate(async () => (await fetch('/api/eos/runtime')).status), 403);
        assert.equal(await page.$eval('#loginPassword', node => node.value), '');
        checks.push({ name: 'successful customer password cannot enter runtime administration and protected status API returns 403', result: 'passed' });
        assert.deepEqual(errors, []);
        const sourceHashes = hashes(); assert.deepEqual(sourceHashes, initialHashes, 'product sources must remain unchanged during the run');
        console.log(JSON.stringify({ result: 'passed', runAt: new Date().toISOString(), node: process.version,
            browser: await browser.version(), scope: 'Real Chromium, production login artifacts, Web mount, runtime routes and OAuth/session model; synthetic controller identity/storage and explicitly stopped in-process hosted UI. No OS child stop or physical-device claim.',
            checks, pageErrors: errors, sourceHashes }, null, 2));
    } finally {
        if (browser) await browser.close();
        for (const close of cleanups.reverse()) await close();
        fs.rmSync(temp, { recursive: true, force: true });
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
