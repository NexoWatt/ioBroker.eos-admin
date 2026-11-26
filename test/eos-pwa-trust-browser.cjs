/* Real Chromium and production parent routes/assets. Controller identity/storage
 * and public CA fixture are synthetic. HTTPS validation is covered separately by
 * eos-tls-management; this does not emulate iOS installation or certificate trust. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const puppeteer = require('puppeteer');
const { fixture } = require('./fixtures/eos-kiosk-browser.cjs');
const root = path.resolve(__dirname, '..');
const files = ['src/lib/web.ts', 'src/lib/eosTlsHttp.ts', 'public/eos-tls/trust.html', 'public/eos-tls/trust.css', 'ui/www/login.html'];
const hashes = () => Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
function certificate() {
    const forge = createRequire(require.resolve('@iobroker/js-controller-common-db'))('node-forge');
    const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const cert = forge.pki.createCertificate();
    cert.publicKey = forge.pki.publicKeyFromPem(pair.publicKey.export({ format: 'pem', type: 'spki' }));
    cert.serialNumber = '01' + crypto.randomBytes(16).toString('hex');
    cert.validity.notBefore = new Date(Date.now() - 60000); cert.validity.notAfter = new Date(Date.now() + 3600000);
    const name = [{ name: 'commonName', value: 'Synthetic EOS browser CA' }]; cert.setSubject(name); cert.setIssuer(name);
    cert.setExtensions([{ name: 'basicConstraints', cA: true }, { name: 'keyUsage', keyCertSign: true }]);
    cert.sign(forge.pki.privateKeyFromPem(pair.privateKey.export({ format: 'pem', type: 'pkcs1' })), forge.md.sha256.create());
    return new crypto.X509Certificate(forge.pki.certificateToPem(cert));
}
async function main() {
    const cleanups = []; const checks = []; const errors = []; const logins = [];
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-pwa-trust-browser-'));
    const initialHashes = hashes(); let browser;
    const x = await fixture({ after: fn => cleanups.push(fn) });
    try {
        await x.owner.eosHostedRuntime.stop();
        const writesBefore = x.writes.length;
        browser = await puppeteer.launch({ executablePath: process.env.EOS_CHROMIUM_PATH || await puppeteer.executablePath(),
            headless: true, userDataDir: path.join(temp, 'profile'), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
        const page = await browser.newPage(); page.setDefaultTimeout(10000);
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => { if (new URL(request.url()).pathname === '/api/auth/login') logins.push(request.method()); });
        await page.setViewport({ width: 390, height: 844 });
        await page.goto(x.origin + '/login.html'); await page.waitForSelector('#loginForm:not([hidden])');
        await page.click('a[href="/security/trust/"]'); await page.waitForSelector('h1');
        assert.equal(new URL(page.url()).pathname, '/security/trust/');
        assert.match(await page.$eval('h1', node => node.textContent), /HTTPS auf diesem Gerät/);
        assert.equal(await page.$$eval('section:not([hidden]) .button', nodes => nodes.length), 0);
        assert.match(await page.$eval('section:not([hidden]) h2', node => node.textContent), /noch nicht bereitgestellt/);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.equal(await page.$eval('header img', node => node.complete && node.naturalWidth === 192), true);
        checks.push({ name: 'anonymous login reaches mobile trust setup with UI stopped; missing CA shows administrator guidance and no download button', result: 'passed' });
        if (process.env.EOS_BROWSER_SCREENSHOT_DIR) {
            fs.mkdirSync(process.env.EOS_BROWSER_SCREENSHOT_DIR, { recursive: true });
            await page.screenshot({ path: path.join(process.env.EOS_BROWSER_SCREENSHOT_DIR, 'trust-unconfigured-mobile.png'), fullPage: true });
        }
        const ca = certificate(); x.web.tlsManager.publicRoot = () => ca.raw;
        await page.reload();
        const visible = await page.$eval('section:not([hidden]) code', node => node.textContent);
        assert.equal(visible, ca.fingerprint256);
        assert.equal(await page.$eval('section:not([hidden]) .button', node => node.getAttribute('href')), '/security/trust/root.cer');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        checks.push({ name: 'configured public CA shows exact SHA-256 and manual download; 390px layout has no horizontal overflow', result: 'passed' });
        if (process.env.EOS_BROWSER_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.EOS_BROWSER_SCREENSHOT_DIR, 'trust-configured-mobile.png'), fullPage: true });
        await page.setViewport({ width: 1440, height: 1050 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (process.env.EOS_BROWSER_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.EOS_BROWSER_SCREENSHOT_DIR, 'trust-configured-desktop.png'), fullPage: true });
        const downloadPath = path.join(temp, 'downloads'); fs.mkdirSync(downloadPath);
        const session = await browser.target().createCDPSession();
        await session.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath, eventsEnabled: true });
        let downloadTimer;
        const downloaded = new Promise((resolve, reject) => {
            downloadTimer = setTimeout(() => reject(new Error('CA download timeout')), 8000);
            session.on('Browser.downloadProgress', event => {
                if (event.state === 'completed') resolve();
                if (event.state === 'canceled') reject(new Error('CA download canceled'));
            });
        });
        try { await page.click('section:not([hidden]) .button'); await downloaded; }
        finally { clearTimeout(downloadTimer); await session.detach(); }
        assert.deepEqual(fs.readFileSync(path.join(downloadPath, 'NexoWatt-Root-CA.cer')), ca.raw);
        checks.push({ name: 'desktop layout and actual anonymous download preserve only the public DER certificate bytes', result: 'passed' });
        await page.click('footer a'); await page.waitForSelector('#loginForm:not([hidden])');
        const transport = await page.evaluate(async () => {
            const result = [];
            for (const url of ['/apple-touch-icon.png', '/apple-touch-icon-precomposed.png', '/apple-touch-icon-180x180.png', '/apple-touch-icon-180x180-precomposed.png']) {
                const response = await fetch(url, { credentials: 'omit' });
                result.push({ status: response.status, type: response.headers.get('content-type'), size: (await response.arrayBuffer()).byteLength });
            }
            return result;
        });
        assert.ok(transport.every(row => row.status === 200 && row.type.startsWith('image/png') && row.size > 1000));
        assert.equal(await page.evaluate(async () => (await fetch('/api/eos/tls', { credentials: 'omit' })).status), 401);
        assert.equal(await page.evaluate(async () => (await fetch('/api/eos/runtime', { credentials: 'omit' })).status), 401);
        assert.deepEqual(logins, []); assert.equal(x.writes.length, writesBefore); assert.deepEqual(errors, []);
        checks.push({ name: 'root icon probes work without UI; trust setup neither logs in nor writes device states and protected APIs stay denied', result: 'passed' });
        const sourceHashes = hashes(); assert.deepEqual(sourceHashes, initialHashes);
        console.log(JSON.stringify({ result: 'passed', runAt: new Date().toISOString(), node: process.version, browser: await browser.version(),
            scope: 'Real Chromium, production Web mount and login/trust/icon routes on loopback HTTP; synthetic controller and public CA, stopped in-process UI. No iOS installation, plant TLS trust or physical-device claim.',
            checks, pageErrors: errors, sourceHashes }, null, 2));
    } finally {
        if (browser) await browser.close();
        for (const close of cleanups.reverse()) await close();
        fs.rmSync(temp, { recursive: true, force: true });
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
