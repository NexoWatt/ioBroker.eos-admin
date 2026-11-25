'use strict';
/** Browser fixtures exercise actual TS and settings markup; no installation service or live controller is called. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const ts = require('typescript');
const root = process.env.EOS_UPDATE_UI_ROOT || process.cwd();
const www = path.join(root, 'ui/www');
const sourceFile = process.env.EOS_UPDATE_UI_SOURCE || path.join(root, 'ui/src-ts/runtime-executables/www/eos-updates.ts');
const source = ts.transpileModule(fs.readFileSync(sourceFile, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const csrf = 'a'.repeat(64);
const planId = '01234567-89ab-4def-89ab-0123456789ab';
const responseView = (state = 'available', extra = {}) => ({ installedVersion: '9.0.21', availableVersion: '9.0.22',
    checkedAt: Date.now(), source: 'npm-latest', state, canStart: state === 'prepared', reason: null,
    ...(state === 'prepared' ? { planId, expiresAt: Date.now() + 300000 } : {}), ...extra });
let browser, server, origin;
function fixtureHtml() {
    return fs.readFileSync(path.join(www, 'settings.html'), 'utf8')
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace('data-settings-page="general"', 'data-settings-page="updates"')
        .replace('class="card nw-settings-page hidden" data-settings-panel="updates"', 'class="card nw-settings-page" data-settings-panel="updates"')
        .replace('class="card nw-settings-page" data-settings-panel="general"', 'class="card nw-settings-page hidden" data-settings-panel="general"')
        .replace('nw-settings-nav__item is-active', 'nw-settings-nav__item')
        .replace('class="nw-settings-nav__item" type="button" data-settings-page-target="updates"', 'class="nw-settings-nav__item is-active" type="button" data-settings-page-target="updates"')
        .replace('<h2>Einstellungen</h2>', '<h2>Einstellungen</h2><p id="fixture-label">PRÜFANSICHT · synthetischer Updatestatus · keine Installation</p>')
        .replace('</head>', '<script src="/fixture-ui.js" defer></script></head>');
}
test.before(async () => {
    browser = await chromium.launch({ headless: true, executablePath: process.env.EOS_TEST_CHROMIUM || '/usr/bin/chromium' });
    server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/settings.html') { res.setHeader('content-type', 'text/html'); return res.end(fixtureHtml()); }
        if (url.pathname === '/fixture-ui.js') { res.setHeader('content-type', 'application/javascript'); return res.end(source); }
        if (url.pathname.startsWith('/static/')) {
            const file = path.join(www, url.pathname.slice('/static/'.length));
            if (!file.startsWith(www + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.statusCode = 404; return res.end(); }
            const ext = path.extname(file); res.setHeader('content-type', ext === '.css' ? 'text/css' : ext === '.png' ? 'image/png' : ext === '.svg' ? 'image/svg+xml' : 'application/octet-stream'); return res.end(fs.readFileSync(file));
        }
        res.statusCode = 404; res.end();
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => { await browser?.close(); if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } });
async function fixture(t, options = {}) {
    const context = await browser.newContext({ viewport: options.viewport || { width: 1365, height: 900 } });
    t.after(() => context.close());
    const page = await context.newPage();
    let status = responseView(); let handler;
    const calls = []; const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
        const req = route.request(); const url = new URL(req.url());
        const call = { path: url.pathname, method: req.method(), body: req.postDataJSON(), headers: req.headers() }; calls.push(call);
        if (handler && await handler(route, call)) return;
        await route.fulfill({ json: call.path === '/api/auth/status' ? { authenticated: true, mustChangePassword: false, csrfToken: csrf } : status });
    });
    if (options.handler) handler = options.handler;
    await page.goto(origin + '/settings.html');
    return { page, calls, errors, setStatus: value => { status = value; }, handle: fn => { handler = fn; },
        refresh: () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))) };
}
async function ready(x) { await x.page.waitForFunction(() => document.getElementById('eosUpdateInstalled').textContent === '9.0.21'); }
async function prepare(x) {
    x.handle(async (route, call) => {
        if (call.path === '/api/eos-update/prepare') { x.setStatus(responseView('prepared')); await route.fulfill({ json: responseView('prepared') }); return true; }
        return false;
    });
    await x.page.click('#eosUpdatePrepare'); await x.page.waitForFunction(() => document.getElementById('eosUpdateConfirm').open);
}
const startCalls = x => x.calls.filter(call => call.path === '/api/eos-update/start');

test('UI update notice reads status only, links directly to updates and never starts on boot', async t => {
    const x = await fixture(t); await ready(x);
    assert.equal(x.calls.some(call => call.method !== 'GET'), false);
    assert.equal(await x.page.locator('.nw-update-badge').count(), 1);
    assert.match(await x.page.locator('a.topbar-gear').getAttribute('href'), /settings\.html#updates$/);
    assert.equal(await x.page.locator('#eosUpdateInstalled').textContent(), '9.0.21');
    assert.equal(await x.page.locator('#eosUpdateAvailable').textContent(), '9.0.22');
    assert.equal(await x.page.locator('#eosUpdateConfirm').evaluate(el => el.open), false);
    assert.deepEqual(x.errors, []);
});
test('UI failed check retains its error message and restores explicit retry controls', async t => {
    const x = await fixture(t); await ready(x);
    x.handle(async (route, call) => { if (call.path === '/api/eos-update/check') { await route.abort('failed'); return true; } return false; });
    await x.page.click('#eosUpdateCheck');
    await x.page.waitForFunction(() => document.getElementById('eosUpdateStatus').dataset.error === 'true');
    assert.equal(await x.page.locator('#eosUpdateCheck').isEnabled(), true);
    assert.match(await x.page.locator('#eosUpdateStatus').textContent(), /nicht erreichbar|erneut/i);
    assert.equal(startCalls(x).length, 0);
    x.handle(undefined); await x.page.click('#eosUpdateCheck');
    await x.page.waitForFunction(() => document.getElementById('eosUpdateStatus').dataset.error === 'false');
    assert.equal(x.calls.filter(call => call.path === '/api/eos-update/check').length, 2);
});
test('UI prepare and start require separate clicks, fresh CSRF and exactly the reviewed version/plan', async t => {
    const x = await fixture(t); await ready(x); await prepare(x);
    assert.equal(startCalls(x).length, 0);
    const prepared = x.calls.find(call => call.path === '/api/eos-update/prepare');
    assert.deepEqual(prepared.body, { version: '9.0.22' }); assert.equal(prepared.headers['x-nw-csrf'], csrf);
    assert.equal(await x.page.locator('#eosUpdateConfirmVersion').textContent(), '9.0.22');
    x.handle(async (route, call) => { if (call.path === '/api/eos-update/start') { await route.fulfill({ json: responseView('installing') }); return true; } return false; });
    await x.page.locator('#eosUpdateStart').dispatchEvent('click'); await x.page.locator('#eosUpdateStart').dispatchEvent('click');
    await x.page.waitForFunction(() => document.getElementById('eosUpdateStatus').textContent.includes('Update läuft'));
    assert.equal(startCalls(x).length, 1); assert.deepEqual(startCalls(x)[0].body, { planId, confirm: true });
    assert.equal(startCalls(x)[0].headers['x-nw-csrf'], csrf);
    assert.equal(await x.page.locator('#eosUpdateInstalled').textContent(), '9.0.21', 'start acknowledgement is not confirmed installation');
});
test('UI lost start response remains indeterminate, blocks duplicate starts and recovers by status only', async t => {
    const x = await fixture(t); await ready(x); await prepare(x);
    x.handle(async (route, call) => { if (call.path === '/api/eos-update/start') { await route.abort('failed'); return true; } return false; });
    await x.page.click('#eosUpdateStart'); await x.page.waitForFunction(() => document.getElementById('eosUpdateStatus').textContent.includes('noch aus'));
    await x.page.locator('#eosUpdateStart').dispatchEvent('click');
    await x.page.waitForTimeout(30); assert.equal(startCalls(x).length, 1);
    assert.equal(await x.page.locator('#eosUpdateStart').isDisabled(), true);
    x.handle(undefined); x.setStatus(responseView('prepared')); await x.refresh();
    await x.page.waitForFunction(() => document.getElementById('eosUpdateCheck').disabled === false);
    assert.equal(startCalls(x).length, 1, 'authoritative response never resends a command');
    x.setStatus(responseView('installed', { installedVersion: '9.0.22' })); await x.refresh();
    await x.page.waitForFunction(() => document.getElementById('eosUpdateInstalled').textContent === '9.0.22');
    assert.equal(await x.page.locator('.nw-update-badge').count(), 0);
});
test('UI expired authentication before start issues no update POST and keeps a clear sign-in notice', async t => {
    const x = await fixture(t); await ready(x); await prepare(x);
    x.handle(async (route, call) => { if (call.path === '/api/auth/status') { await route.fulfill({ json: { authenticated: false } }); return true; } return false; });
    await x.page.click('#eosUpdateStart'); await x.page.waitForFunction(() => document.getElementById('eosUpdateStatus').textContent.includes('anmelden'));
    assert.equal(startCalls(x).length, 0); assert.equal(await x.page.locator('#eosUpdateStart').isDisabled(), true);
    assert.equal(await x.page.locator('#eosUpdateCheck').isEnabled(), true);
});
test('UI an expired session after lost start does not falsely declare the order unissued', async t => {
    const x = await fixture(t); await ready(x); await prepare(x);
    x.handle(async (route, call) => { if (call.path === '/api/eos-update/start') { await route.abort('failed'); return true; } return false; });
    await x.page.click('#eosUpdateStart'); await x.page.waitForFunction(() => document.getElementById('eosUpdateStatus').textContent.includes('noch aus'));
    x.handle(async (route, call) => { if (call.path === '/api/eos-update/status') { await route.fulfill({ status: 401, json: {} }); return true; } return false; });
    await x.refresh(); await x.page.waitForFunction(() => document.getElementById('eosUpdateStatus').textContent.includes('anmelden'));
    assert.doesNotMatch(await x.page.locator('#eosUpdateStatus').textContent(), /kein.*Auftrag.*erteilt/i);
    await x.page.locator('#eosUpdateStart').dispatchEvent('click'); await x.page.waitForTimeout(30);
    assert.equal(startCalls(x).length, 1);
});
test('UI overlapping visibility events cannot create simultaneous status reads', async t => {
    let release; let count = 0; const gate = new Promise(resolve => { release = resolve; });
    const x = await fixture(t, { handler: async (route, call) => {
        if (call.path !== '/api/eos-update/status') return false;
        count++; await gate; await route.fulfill({ json: responseView() }); return true;
    } });
    for (let i = 0; i < 8; i++) await x.refresh();
    await x.page.waitForTimeout(30); assert.equal(count, 1);
    assert.equal(await x.page.locator('#eosUpdateCheck').isDisabled(), true);
    release(); await ready(x); assert.deepEqual(x.errors, []);
});
test('UI malformed metadata is rejected without HTML insertion or automatic commands', async t => {
    const x = await fixture(t, { handler: async (route, call) => {
        if (call.path !== '/api/eos-update/status') return false;
        await route.fulfill({ json: responseView('available', { installedVersion: '<img src=x onerror=alert(1)>' }) }); return true;
    } });
    await x.page.waitForFunction(() => document.getElementById('eosUpdateStatus').dataset.error === 'true');
    assert.equal(await x.page.locator('#eosUpdateInstalled img').count(), 0);
    assert.equal(x.calls.some(call => call.method !== 'GET'), false);
    assert.equal(await x.page.locator('#eosUpdateCheck').isEnabled(), true);
});
test('UI prepared confirmation stays within a narrow viewport and supports explicit cancellation', async t => {
    const x = await fixture(t, { viewport: { width: 360, height: 740 } }); await ready(x); await prepare(x);
    const geometry = await x.page.locator('#eosUpdateConfirm').evaluate(el => { const rect = el.getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight }; });
    assert.ok(geometry.left >= 8 && geometry.right <= geometry.viewportWidth - 8);
    assert.ok(geometry.top >= 8 && geometry.bottom <= geometry.viewportHeight - 8);
    assert.equal(await x.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.EOS_UPDATE_UI_SCREENSHOT_DIR) { fs.mkdirSync(process.env.EOS_UPDATE_UI_SCREENSHOT_DIR, { recursive: true }); await x.page.screenshot({ path: path.join(process.env.EOS_UPDATE_UI_SCREENSHOT_DIR, 'updates-mobile-dialog-mock.png'), fullPage: true }); }
    await x.page.click('#eosUpdateCancel'); assert.equal(await x.page.locator('#eosUpdateConfirm').evaluate(el => el.open), false); assert.equal(startCalls(x).length, 0);
});
