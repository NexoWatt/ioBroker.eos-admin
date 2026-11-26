/* Real Chromium and production tariff controller/settings fragment.
 * The API is a deterministic startup/error fixture, not a provider or controller DB.
 * No customer data, tariff provider requests or actuator commands are used. */
'use strict';
/* global document, window */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const express = require('express');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const sourceFiles = ['ui/www/customer-tariff.js', 'ui/src-ts/runtime-executables/www/customer-tariff.ts',
    'ui/www/settings.html', 'ui/www/customer-tariff.css', 'test/eos-customer-tariff-startup-browser.cjs'];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async (predicate, timeout = 5000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { if (predicate()) return; await pause(20); }
    throw new Error('Tariff browser fixture condition timed out');
};
const confirmedView = () => ({ ok: true, scope: 'system', revision: 'confirmed-fixture-revision',
    config: { providerId: 'tibber', sourceId: 'tibber', providerProfileId: 'local-provider', country: 'DE',
        enabled: true, useForTariff: true, homeId: 'fixture-home', formula: {} },
    providers: [{ id: 'manual-dp', name: 'Manuell', countries: ['DE', 'NL'] }, { id: 'tibber', name: 'Tibber', countries: ['DE'] }],
    profiles: [], credentialsPresent: { accessToken: true, securityToken: false }, configuredExternally: false,
    status: { state: 'pending' },
});

async function main() {
    const sourceHashes = {};
    for (const file of sourceFiles) sourceHashes[file] = crypto.createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex');
    const html = await fs.readFile(path.join(root, 'ui/www/settings.html'), 'utf8');
    const start = html.indexOf('<details class="nw-customer-tariff" id="customerTariffPanel">');
    const end = html.indexOf('<label class="row"><span>Dynamischer Zeittarif', start);
    assert.ok(start >= 0 && end > start, 'production tariff settings fragment must exist');
    const fixtureHtml = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/customer-tariff.css"><script src="/customer-tariff.js" defer></script></head><body>${html.slice(start, end)}</body></html>`;
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'eos-tariff-startup-browser-'));
    const cases = new Map(), checks = [], pageErrors = [];
    let server, browser, origin;
    const app = express(); app.use(express.json());
    app.get('/settings.html', (_req, res) => {
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'");
        res.type('html').send(fixtureHtml);
    });
    for (const name of ['customer-tariff.js', 'customer-tariff.css']) app.get('/' + name, (_req, res) => res.sendFile(path.join(root, 'ui/www', name)));
    app.all('/api/customer/tariff-provider', (req, res) => {
        const key = new URL(req.headers.referer).searchParams.get('case');
        const state = cases.get(key); assert.ok(state, 'request must belong to a fixture scenario');
        if (req.method === 'PUT') {
            state.puts.push({ at: Date.now(), body: structuredClone(req.body) });
            return res.status(503).json({ ok: false, error: 'EOS_TARIFF_CONFIG_LOADING' });
        }
        assert.equal(req.method, 'GET'); state.gets.push(Date.now());
        if (state.mode === 'ready') return res.json(confirmedView());
        if (state.mode === 'unavailable') return res.status(503).json({ ok: false, error: 'EOS_TARIFF_CONFIG_UNAVAILABLE' });
        if (state.mode === 'unauthorized') return res.status(401).json({ ok: false, error: 'authentication_required' });
        if (state.mode === 'forbidden') return res.status(403).json({ ok: false, error: 'forbidden' });
        return res.status(503).json({ ok: false, error: 'EOS_TARIFF_CONFIG_LOADING' });
    });
    try {
        server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
        origin = `http://127.0.0.1:${server.address().port}`;
        browser = await puppeteer.launch({ executablePath: process.env.EOS_CHROMIUM_PATH || await puppeteer.executablePath(),
            headless: true, userDataDir: path.join(temp, 'profile'), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
        const openCase = async (name, mode = 'loading') => {
            const state = { mode, gets: [], puts: [] }; cases.set(name, state);
            const page = await browser.newPage(); page.on('pageerror', error => pageErrors.push(error.message));
            await page.setViewport({ width: 1024, height: 900 });
            await page.goto(`${origin}/settings.html?case=${name}`);
            await page.click('#customerTariffPanel > summary'); await until(() => state.gets.length === 1);
            return { page, state };
        };
        const controls = page => page.evaluate(() => ({
            disabled: document.getElementById('customerTariffFields').disabled,
            saveDisabled: document.getElementById('customerTariffSave').disabled,
            provider: document.getElementById('customerTariffProvider').value,
            enabled: document.getElementById('customerTariffEnabled').checked,
            status: document.getElementById('customerTariffStatus').textContent,
            error: document.getElementById('customerTariffStatus').dataset.error,
        }));
        const initial = await openCase('automatic');
        await initial.page.waitForFunction(() => /geladen|start|wart/i.test(document.getElementById('customerTariffStatus').textContent));
        const before = await controls(initial.page);
        assert.equal(before.disabled, true); assert.equal(before.saveDisabled, true); assert.equal(before.provider, '');
        assert.doesNotMatch(before.status, /Tarifanbindung gespeichert|Tarifanbindung geladen\./);
        initial.state.mode = 'ready';
        await initial.page.waitForFunction(() => document.getElementById('customerTariffProvider').value === 'tibber'
            && document.getElementById('customerTariffFields').disabled === false, { timeout: 4000 });
        assert.equal(initial.state.gets.length, 2);
        const retryDelay = initial.state.gets[1] - initial.state.gets[0];
        assert.ok(retryDelay >= 1500 && retryDelay <= 3000, `initial retry delay ${retryDelay}ms`);
        assert.equal((await controls(initial.page)).enabled, true);
        checks.push({ name: 'startup keeps unconfirmed form disabled and empty; next bounded GET confirms Tibber automatically', result: 'passed', retryDelayMs: retryDelay });

        // Remaining cases run independently so the real 10-second retry budget
        // is observed without a serial wall-clock delay for every error case.
        const bounded = await openCase('bounded');
        const closed = await openCase('closed');
        await closed.page.click('#customerTariffPanel > summary');
        const hidden = await openCase('pagehide');
        await hidden.page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
        const permanent = await Promise.all(['unavailable', 'unauthorized', 'forbidden'].map(mode => openCase(mode, mode)));

        await initial.page.$eval('#customerTariffHome', node => { node.value = 'draft-home'; node.dispatchEvent(new Event('input', { bubbles: true })); });
        await initial.page.$eval('#customerTariffCredential', node => { node.value = 'synthetic-unsaved-token'; node.dispatchEvent(new Event('input', { bubbles: true })); });
        initial.state.mode = 'loading';
        await pause(2200);
        assert.equal(initial.state.gets.length, 2, 'ready view must not continue background polling or replace the draft');
        assert.equal(await initial.page.$eval('#customerTariffHome', node => node.value), 'draft-home');
        assert.equal(await initial.page.$eval('#customerTariffCredential', node => node.value), 'synthetic-unsaved-token');
        assert.equal(await initial.page.$eval('#customerTariffSave', node => node.disabled), false);
        checks.push({ name: 'confirmed view stops startup retries; unsaved settings and secret draft remain intact', result: 'passed' });
        await initial.page.click('#customerTariffSave'); await until(() => initial.state.puts.length === 1);
        await initial.page.waitForFunction(() => document.getElementById('customerTariffStatus').dataset.error === 'true');
        await pause(2200);
        assert.equal(initial.state.puts.length, 1, 'a failed PUT is never automatically repeated');
        assert.equal(initial.state.gets.length, 2, 'a failed PUT does not replace the current draft with a GET');
        assert.equal(initial.state.puts[0].body.expectedRevision, 'confirmed-fixture-revision');
        assert.equal(initial.state.puts[0].body.config.homeId, 'draft-home');
        assert.equal(await initial.page.$eval('#customerTariffHome', node => node.value), 'draft-home');
        assert.equal(await initial.page.$eval('#customerTariffCredential', node => node.value), 'synthetic-unsaved-token');
        checks.push({ name: '503 on PUT sends exactly once, retains CAS revision and preserves all input including secret draft', result: 'passed' });

        assert.equal(closed.state.gets.length, 1, 'closing panel cancels scheduled startup GET');
        assert.equal(hidden.state.gets.length, 1, 'pagehide cancels scheduled startup GET');
        for (const item of permanent) {
            assert.equal(item.state.gets.length, 1, 'unavailable and authorization errors must not retry');
            assert.equal((await controls(item.page)).disabled, true);
        }
        checks.push({ name: 'panel close and pagehide cancel retries; unavailable, 401 and 403 fail once with locked form', result: 'passed' });

        closed.state.mode = 'ready';
        await closed.page.click('#customerTariffPanel > summary');
        await closed.page.waitForFunction(() => document.getElementById('customerTariffProvider').value === 'tibber');
        assert.equal(closed.state.gets.length, 2, 'reopening retries a fresh initial read');
        checks.push({ name: 'reopening after canceled startup loads the confirmed tariff', result: 'passed' });

        await until(() => bounded.state.gets.length === 6, 15000);
        await bounded.page.waitForFunction(() => document.getElementById('customerTariffStatus').dataset.error === 'true');
        await pause(2200);
        assert.equal(bounded.state.gets.length, 6, 'initial attempt plus five repeats, never an unbounded loop');
        assert.equal((await controls(bounded.page)).disabled, true);
        assert.equal(await bounded.page.$eval('#customerTariffReload', node => node.disabled), false);
        bounded.state.mode = 'ready';
        await bounded.page.click('#customerTariffReload');
        await bounded.page.waitForFunction(() => document.getElementById('customerTariffProvider').value === 'tibber');
        assert.equal(bounded.state.gets.length, 7);
        checks.push({ name: 'loading stops after six attempts; manual reload remains available and succeeds', result: 'passed', maximumAutomaticAttempts: 6 });
        assert.deepEqual(pageErrors, []);
        for (const file of sourceFiles) assert.equal(crypto.createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex'),
            sourceHashes[file], `source changed during browser run: ${file}`);
        console.log(JSON.stringify({ result: 'passed', runAt: new Date().toISOString(), node: process.version, browser: await browser.version(),
            scope: 'Real Chromium, production customer-tariff JS and unmodified tariff fragment from settings.html. Startup/error API fixture. No provider network, controller DB, real secrets or hardware.',
            checks, pageErrors, sourceHashes }, null, 2));
    } finally {
        if (browser) await browser.close();
        if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
        await fs.rm(temp, { recursive: true, force: true });
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
