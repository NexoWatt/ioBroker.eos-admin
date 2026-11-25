'use strict';
// Real Chromium + production page and guarded HTTP routes; controller/module data are simulated.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const puppeteer = require('puppeteer');
const { createFixture } = require('./fixtures/eos-ocpp-admin.cjs');

async function main() {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'eos-ocpp-admin-')); const f = await createFixture(); let browser;
    const checks = []; const errors = [];
    try {
        browser = await puppeteer.launch({ executablePath: process.env.EOS_CHROMIUM_PATH || puppeteer.executablePath(), headless: true,
            userDataDir: path.join(temp, 'profile'), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
        const page = await browser.newPage(); page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => void dialog.accept());
        await page.setCookie({ name: 'access_token', value: f.token, url: f.origin });
        await page.evaluateOnNewDocument(() => {
            const original = fetch; const probe = window.__probe = { starts: [], pending: 0, maxPending: 0, aborted: 0, hidden: false };
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => probe.hidden });
            window.fetch = async (...args) => {
                if (String(args[0]).startsWith('/api/eos/modules/ocpp') && (!args[1]?.method || args[1].method === 'GET')) {
                    probe.starts.push(performance.now()); probe.pending++; probe.maxPending = Math.max(probe.maxPending, probe.pending);
                    try { return await original(...args); } catch (error) { if (error.name === 'AbortError') probe.aborted++; throw error; } finally { probe.pending--; }
                }
                return original(...args);
            };
        });
        const waitIdle = () => page.waitForFunction(() => !document.getElementById('refresh').disabled);
        const edit = (key, value) => page.$eval(`#field-${key}`, (node, value) => {
            if (node.type === 'checkbox') node.checked = value; else node.value = value;
            node.dispatchEvent(new Event('input', { bubbles: true }));
        }, value);
        const save = async () => { await page.click('#save'); await waitIdle(); };
        const snapshot = async name => {
            if (!process.env.EOS_BROWSER_SCREENSHOT_DIR) return;
            await fs.mkdir(process.env.EOS_BROWSER_SCREENSHOT_DIR, { recursive: true });
            await page.screenshot({ path: path.join(process.env.EOS_BROWSER_SCREENSHOT_DIR, name), fullPage: true });
        };
        await page.setViewport({ width: 1440, height: 1100 }); await page.goto(`${f.origin}/modules/ocpp/`);
        await page.waitForFunction(() => !document.getElementById('save').disabled);
        assert.equal(await page.$eval('#field-port', node => node.value), '9220');
        assert.match(await page.$eval('#status', node => node.textContent), /Aktiv.*eos-admin\.0\.ocpp.*9220.*12345/s);
        assert.match(await page.$eval('#connection-address', node => node.textContent), /ws:\/\/127\.0\.0\.1:9220\//);
        assert.equal(await page.$$eval('#stations img', nodes => nodes.length), 0);
        assert.match(await page.$eval('#stations', node => node.textContent), /Station <img/);
        assert.match(await page.$eval('#stations', node => node.textContent), /eos-admin\.0\.ocpp\.CP_1\.control\.chargeLimit/);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await snapshot('ocpp-admin-desktop.png');
        checks.push({ name: 'desktop production page, exact hosted namespace/PID/port, station text escaped, known datapoints', result: 'passed' });
        await page.setViewport({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await snapshot('ocpp-admin-mobile.png'); checks.push({ name: 'mobile 390px without horizontal overflow', result: 'passed' });
        await edit('port', '9334');
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10300)));
        const cadence = await page.evaluate(() => ({ ...window.__probe }));
        assert.equal(cadence.starts.length, 3); assert.equal(cadence.maxPending, 1);
        const gaps = cadence.starts.slice(1).map((value, i) => value - cadence.starts[i]); assert.ok(gaps.every(ms => ms >= 4800 && ms <= 6000));
        assert.equal(await page.$eval('#field-port', node => node.value), '9334');
        checks.push({ name: 'five-second real timer refresh, one in-flight GET, edited draft preserved', result: 'passed', gapsMs: gaps });

        await save(); await page.waitForFunction(() => document.getElementById('message').textContent.includes('gespeichert'));
        assert.equal(f.state.saves.length, 1); assert.equal(f.state.saves[0].config.port, 9334);
        assert.equal(f.state.saves[0].config.zeroLimitBehavior, 'keepLast'); assert.equal(f.state.saves[0].config.createTechnicalAliases, true);
        assert.match(await page.$eval('#connection-address', node => node.textContent), /:9334\//);
        checks.push({ name: 'real CSRF/revision protected save preserves hidden imported compatibility values', result: 'passed' });

        await edit('port', '80'); await save(); assert.equal(f.state.saves.length, 1);
        assert.match(await page.$eval('#message', node => node.textContent), /WebSocket-Port/);
        await edit('port', '9335'); for (const key of ['enable16', 'enable201', 'enable21']) await edit(key, false);
        await save(); assert.equal(f.state.saves.length, 1); assert.match(await page.$eval('#message', node => node.textContent), /Mindestens eine/);
        await edit('enable21', true); await edit('identityAllowlist', 'CP/invalid'); await save(); assert.equal(f.state.saves.length, 1);
        assert.match(await page.$eval('#message', node => node.textContent), /Stationskennungen prüfen/);
        await edit('identityAllowlist', 'CP_1\nCP_2');
        checks.push({ name: 'invalid privileged port, no protocol and malformed station identity blocked before write', result: 'passed' });

        f.state.revision = crypto.randomUUID(); await save();
        await page.waitForFunction(() => document.getElementById('message').textContent.includes('inzwischen geändert'));
        assert.equal(f.state.saves.length, 1); assert.equal(await page.$eval('#field-port', node => node.value), '9335');
        await page.click('#reload'); await waitIdle();
        assert.equal(await page.$eval('#field-port', node => node.value), '9334');
        checks.push({ name: '409 concurrent change retains draft; explicit reload restores stored revision', result: 'passed' });

        assert.equal(await page.$eval('#import', node => node.disabled), true);
        assert.match(await page.$eval('#import-status', node => node.textContent), /deaktivieren, speichern/);
        await edit('enabled', false); await save(); await page.waitForFunction(() => !document.getElementById('import').disabled);
        await page.click('#import'); await waitIdle();
        await page.waitForFunction(() => document.getElementById('message').textContent.includes('deaktiviert übernommen'));
        assert.deepEqual(f.state.imports, ['ocpp21.0']); assert.equal(await page.$eval('#field-enabled', node => node.checked), false);
        assert.match(await page.$eval('#status', node => node.textContent), /ocpp21\.0/);
        assert.equal(await page.$eval('#field-port', node => node.value), '9333');
        assert.equal(await page.$eval('#import', node => node.disabled), true);
        checks.push({ name: 'legacy import through guarded API retains legacy namespace and stays disabled until reviewed', result: 'passed' });
        await edit('enabled', true); await save(); await page.waitForSelector('.is-online');

        f.mode('error'); await page.click('#refresh'); await waitIdle();
        assert.equal(await page.$$eval('.is-online', nodes => nodes.length), 0); assert.match(await page.$eval('#status', node => node.textContent), /Status nicht bestätigt/);
        f.mode('normal'); await page.click('#refresh'); await waitIdle(); assert.equal(await page.$$eval('.is-online', nodes => nodes.length), 1);
        checks.push({ name: 'failed health request removes green state; successful request restores confirmed snapshot', result: 'passed' });
        f.state.statusUnavailable = true; await page.click('#refresh'); await waitIdle();
        assert.equal(await page.$$eval('.is-online', nodes => nodes.length), 0); assert.match(await page.$eval('#status', node => node.textContent), /Status nicht bestätigt/);
        f.state.statusUnavailable = false; await page.click('#refresh'); await waitIdle();
        checks.push({ name: 'unavailable child status cannot turn cached station values into a confirmed active module', result: 'passed' });

        // Visibility and BFcache events are simulated, network/timers are real.
        f.mode('hold'); await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 5100)));
        await page.waitForFunction(() => window.__probe.pending === 1);
        await page.evaluate(() => { window.__probe.hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
        await page.waitForFunction(() => window.__probe.pending === 0);
        const hiddenStarts = await page.evaluate(() => window.__probe.starts.length);
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 5200)));
        assert.equal(await page.evaluate(() => window.__probe.starts.length), hiddenStarts); assert.ok(await page.evaluate(() => window.__probe.aborted >= 1));
        f.mode('normal'); f.release();
        await page.evaluate(() => { window.__probe.hidden = false; document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
        await page.waitForFunction(() => window.__probe.pending === 0 && window.__probe.starts.length > 0);
        assert.equal(await page.evaluate(() => window.__probe.starts.length), hiddenStarts + 1);
        checks.push({ name: 'hidden tab aborts active poll; resume and BFcache produce one immediate refresh', result: 'passed' });
        await edit('port', '9444');
        f.role('installer'); await page.click('#refresh'); await waitIdle();
        assert.match(await page.$eval('#message', node => node.textContent), /nur für die EOS-Administration/);
        assert.equal(await page.$eval('#save', node => node.disabled), true); assert.equal(await page.$$eval('.is-online', nodes => nodes.length), 0);
        const deniedStarts = await page.evaluate(() => window.__probe.starts.length);
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 5200)));
        assert.equal(await page.evaluate(() => window.__probe.starts.length), deniedStarts);
        checks.push({ name: 'fresh permission loss disables writes, clears confirmed status and stops polling', result: 'passed' });
        f.role('admin'); await page.click('#refresh'); await waitIdle();
        assert.equal(await page.$eval('#save', node => node.disabled), false); assert.equal(await page.$eval('#field-port', node => node.value), '9444');
        checks.push({ name: 'explicit refresh after renewed administrator access retains edited draft and restores guarded save', result: 'passed' });
        assert.deepEqual(errors, []);
        const sourceHashes = {};
        for (const file of ['modules/ocpp/admin/index.html', 'modules/ocpp/admin/index.js', 'modules/ocpp/admin/style.css', 'modules/ocpp/admin/config-fields.json', 'src/lib/eosModuleHttp.js']) {
            sourceHashes[file] = crypto.createHash('sha256').update(await fs.readFile(path.resolve(__dirname, '..', file))).digest('hex');
        }
        console.log(JSON.stringify({ runAt: new Date().toISOString(), result: 'passed', node: process.version, browser: await browser.version(),
            scope: 'Actual Chromium and production OCPP page, HTTP guards, real authenticated idle session and CSRF; controller persistence and OCPP module status are doubles. No physical station or plant. Visibility/BFcache events simulated.',
            checks, pageErrors: errors, sourceHashes }, null, 2));
    } finally { if (browser) await browser.close(); await f.close(); await fs.rm(temp, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
