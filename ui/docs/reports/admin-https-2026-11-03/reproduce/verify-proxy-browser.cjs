/**
 * Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Browservertrag: gebauter Admin-Tab -> unveränderter Admin-8.3.5-Proxy -> echte EOS-Routen.
 * Ausschließlich lokale synthetische Konten, Admin-Datenbank und ioBroker-Gerätefixtures.
 * Keine Screenshots, Produktivzugriffe, Gerätebefehle oder HTTP-Antwortinterzeption.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const https = require('node:https');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const Module = require('node:module');
const assert = require('node:assert/strict');
const root = process.env.NEXOWATT_PROXY_TEST_ROOT || path.resolve(__dirname, '../../../..');
const fromRepo = Module.createRequire(path.join(root, 'package.json'));
const ts = fromRepo('typescript');
const express = fromRepo('express');
const { chromium } = require(process.env.NW_PLAYWRIGHT_MODULE || 'playwright');
const { createHarness } = fromRepo('./scripts/verify-stable-1.0.9-access.cjs');
const upstreamPath = process.env.NEXOWATT_ADMIN_PROXY_SOURCE || path.join(__dirname, 'admin8-v8.3.5-instanceProxy.ts');
const upstream = fs.readFileSync(upstreamPath, 'utf8');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const upstreamSha256 = sha(upstream);
assert.equal(upstreamSha256, 'ccfd3fcab5466e24166e938dca305a67d8741a0bb85eea027a4b328b9f9b35d2');
const proxyModule = new Module(upstreamPath, module);
proxyModule.filename = upstreamPath;
proxyModule.paths = Module._nodeModulePaths(root);
proxyModule._compile(ts.transpileModule(upstream, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, upstreamPath);
const { InstanceProxy } = proxyModule.exports;
const checks = [];
const network = [];
const pageErrors = [];
const failures = [];
const sensitiveValues = [];
const redact = value => sensitiveValues.reduce((text, secret) => text.split(secret).join('[redacted]'), String(value)).slice(0, 1200);
const pass = name => { checks.push(name); console.log('PASS ' + name); };
const reportFile = path.join(__dirname, 'proxy-browser-results.json');
let currentStage = 'setup';
let browserVersion = '';
let testedHashes = {};
function sourceSnapshot() {
  const names = ['main.js', 'lib/runtime-proxy-html.js', 'admin/react/index.html', 'www/runtime-base.js', 'www/ems-apps.js', 'www/app.js', 'www/auth.js'];
  const assets = path.join(root, 'admin/react/assets');
  if (fs.existsSync(assets)) names.push(...fs.readdirSync(assets).filter(name => /\.(?:js|css)$/.test(name)).sort().map(name => 'admin/react/assets/' + name));
  return Object.fromEntries(names.filter(file => fs.existsSync(path.join(root, file))).map(file => [file, sha(fs.readFileSync(path.join(root, file)))]));
}
function report(result, extra = {}) {
  const entry = { result, checks: checks.length, cases: checks, node: process.version, browser: browserVersion,
    officialProxyVersion: '8.3.5', officialProxySha256: upstreamSha256,
    sourceHashes: testedHashes,
    tls: 'Chromium trusts only the ephemeral local certificate SPKI pin; ignoreHTTPSErrors false. No global TLS bypass or production change.',
    scope: 'Actual Chromium, built product assets, original Admin InstanceProxy and actual EOS routes. Synthetic Admin DB/session/window socket metadata and ioBroker account/device storage; no full Admin process or customer system. No HTTP response interception.',
    network: { requests: network.length, paths: [...new Set(network.map(item => item.path))].slice(0, 200), failures: failures.slice(0, 30) },
    pageErrors: pageErrors.slice(0, 20), ...extra };
  fs.writeFileSync(reportFile, redactReport(JSON.stringify(entry, null, 2)) + '\n');
  return entry;
}
function redactReport(value) { return sensitiveValues.reduce((text, secret) => text.split(secret).join('[redacted]'), value); }

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-proxy-browser-'));
  let server;
  let h;
  let browser;
  try {
    fs.chmodSync(tmp, 0o700);
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(tmp, 'key.pem'), '-out', path.join(tmp, 'cert.pem'), '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' });
    const cert = fs.readFileSync(path.join(tmp, 'cert.pem'));
    const spki = crypto.createHash('sha256').update(new crypto.X509Certificate(cert).publicKey.export({ format: 'der', type: 'spki' })).digest('base64');
    testedHashes = sourceSnapshot();
    h = await createHarness();
    const password = h.addAccount('nexowatt');
    sensitiveValues.push(password);
    h.groups.get('system.group.administrator').common.members.push('system.user.nexowatt');
    h.adapter.config.emsApps = { apps: { dynamicGrid: { installed: true, enabled: false }, arbitrage: { installed: true, enabled: false } } };
    const backendPort = h.adapter.server.address().port;
    const adminToken = crypto.randomBytes(32).toString('hex');
    sensitiveValues.push(adminToken);
    const fixtureAdapter = {
      host: 'test-host', config: { auth: true, defaultUser: 'system.user.none', secure: true },
      log: { debug() {}, warn() {} },
      getSession(key, callback) { callback(key === `a:${adminToken}` ? { user: 'system.user.proxy_operator', aExp: Date.now() + 600000 } : null); },
      async getForeignObjectAsync(id) {
        if (id === 'system.group.administrator') return { common: { members: ['system.user.proxy_operator'] } };
        if (id === 'system.adapter.nexowatt-ui.0') return { type: 'instance', common: { host: 'test-host', adminTab: { proxy: true } }, native: { bind: '127.0.0.1', port: backendPort, secure: false } };
        return null;
      },
    };
    const officialProxy = new InstanceProxy(fixtureAdapter, '/admin/');
    const app = express();
    app.use(officialProxy.hideAuthorization);
    app.use(officialProxy.handleRequest);
    app.use('/admin/adapter/nexowatt-ui/react', express.static(path.join(root, 'admin/react')));
    app.get('/admin/', (_req, res) => res.type('html').send('<!doctype html><title>Admin fixture landing</title><p>Admin fixture landing</p>'));
    app.use((_req, res) => res.status(404).send('Not Found'));
    server = https.createServer({ key: fs.readFileSync(path.join(tmp, 'key.pem')), cert }, app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `https://127.0.0.1:${server.address().port}`;
    const prefix = '/admin/proxy/nexowatt-ui.0';
    browser = await chromium.launch({ executablePath: process.env.NW_CHROMIUM_EXECUTABLE || undefined, headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', `--ignore-certificate-errors-spki-list=${spki}`] });
    browserVersion = browser.version();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', ignoreHTTPSErrors: false });
    context.setDefaultTimeout(15000);
    // The real Admin host provides these same-origin socket metadata surfaces.
    // Only its metadata fixture is supplied; EOS fetch and HTTP responses remain real.
    await context.addInitScript(({ port }) => {
      if (!location.pathname.startsWith('/admin/adapter/nexowatt-ui/react/')) return;
      window.socketPath = '/admin/';
      const getObject = (id, callback) => callback(null, { _id: id, type: 'instance', native: { port } });
      window.servConn = { getObject, getState: (_id, callback) => callback(null, null), setObject: (_id, _value, callback) => callback(new Error('read-only Admin fixture')) };
      window.socket = { emit(event, id, callback) { if (event === 'getObject') getObject(id, callback); else if (typeof callback === 'function') callback(null, null); } };
    }, { port: backendPort });
    await context.addCookies([{ name: 'access_token', value: adminToken, url: origin, httpOnly: true, secure: true, sameSite: 'Lax' }]);
    const watch = page => {
      page.on('pageerror', error => pageErrors.push({ stage: currentStage, name: error.name, message: redact(error.message).slice(0, 220) }));
      page.on('dialog', dialog => dialog.dismiss());
    };
    context.on('page', watch);
    context.on('request', request => {
      const url = new URL(request.url());
      network.push({ stage: currentStage, path: url.pathname, method: request.method(), type: request.resourceType() });
      if (url.origin !== origin && /^https?:$/.test(url.protocol)) failures.push({ stage: currentStage, reason: 'foreign origin request', type: request.resourceType() });
      if (url.origin === origin && /^\/(?:api|static)(?:\/|$)|^\/events(?:\/|$)/.test(url.pathname)) failures.push({ stage: currentStage, path: url.pathname, reason: 'escaped public prefix' });
    });
    context.on('response', response => {
      const request = response.request();
      const url = new URL(response.url());
      if (response.status() >= 400 && ['script', 'stylesheet', 'image', 'font', 'document'].includes(request.resourceType())) {
        failures.push({ stage: currentStage, path: url.pathname, status: response.status(), type: request.resourceType() });
      }
    });
    context.on('requestfailed', request => {
      const reason = request.failure()?.errorText || 'network failure';
      if (reason.includes('ERR_ABORTED')) return;
      if (['script', 'stylesheet', 'image', 'font', 'document'].includes(request.resourceType())) {
        failures.push({ stage: currentStage, path: new URL(request.url()).pathname, type: request.resourceType(), reason: redact(reason) });
      }
    });
    const page = await context.newPage();
    currentStage = 'Admin login';
    await page.goto(origin + '/admin/adapter/nexowatt-ui/react/index.html?instance=0#/installer');
    await page.locator('#nwAuthUser').waitFor();
    await page.locator('#nwAuthUser').fill('nexowatt');
    await page.locator('#nwAuthPassword').fill(password);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await page.getByRole('button', { name: 'EMS Apps öffnen', exact: true }).waitFor();
    assert.equal(network.filter(item => item.path === prefix + '/api/strict-auth/login' && item.method === 'POST').length, 1);
    assert.match(await page.locator('.nw-protected-route__session').innerText(), /nexowatt/);
    const cookies = await context.cookies();
    const sessionCookies = cookies.filter(cookie => ['nw_session', 'nw_strict_session'].includes(cookie.name));
    assert(sessionCookies.length >= 1);
    assert(sessionCookies.every(cookie => cookie.httpOnly && cookie.secure && cookie.sameSite === 'Lax' && cookie.path === prefix + '/'));
    pass('Actual Admin React login accepts arbitrary account own password once and unlocks Installer with proxy-scoped HttpOnly Secure SameSite session');
    const logo = page.locator('.nw-brand__logo');
    await logo.evaluate(image => image.decode());
    assert((await logo.evaluate(image => image.naturalWidth)) > 0);
    pass('Built Admin React module, stylesheet and decoded logo load below public Admin prefix');
    currentStage = 'Installer to EMS Apps';
    await page.getByRole('button', { name: 'EMS Apps öffnen', exact: true }).click();
    // Product navigation intentionally replaces the current top-level page.
    await page.waitForURL(url => url.pathname === prefix + '/ems-apps.html');
    const apps = page;
    await apps.waitForLoadState('domcontentloaded');
    assert(new URL(apps.url()).pathname === prefix + '/ems-apps.html');
    await apps.waitForFunction(() => window.NW_AUTH?.getState()?.authed === true);
    await apps.locator('#nw-emsapps-status').filter({ hasText: 'Konfiguration geladen' }).waitFor();
    assert.equal(await apps.evaluate(() => window.NW_RUNTIME?.isProxy), true);
    const auth = await apps.evaluate(async () => {
      const response = await fetch(window.NW_RUNTIME.url('/api/strict-auth/status'));
      const value = await response.json(); return { status: response.status, authed: value.authed, user: value.user };
    });
    assert.deepEqual(auth, { status: 200, authed: true, user: 'nexowatt' });
    const styleCount = await apps.evaluate(() => [...document.styleSheets].filter(sheet => sheet.href && sheet.cssRules.length).length);
    assert(styleCount > 0);
    const backUrl = await apps.locator('#nw-emsapps-back-installer').getAttribute('href');
    assert.equal(new URL(backUrl, apps.url()).href, origin + '/admin/#tab-nexowatt-ui-0');
    pass('Installer opens real EMS App-Center with working styles, shared EOS session and correct Admin-prefix backlink');
    currentStage = 'Nested dynamic-grid React';
    await apps.locator('.nw-tab[data-tab="dynamicgrid"]').click();
    const frameElement = apps.locator('#dynamicGridConfigSlot iframe');
    await frameElement.waitFor();
    const iframeSource = await frameElement.getAttribute('src');
    assert(new URL(iframeSource, apps.url()).pathname.startsWith(prefix + '/ems/dynamic-grid/'));
    const frame = apps.frameLocator('#dynamicGridConfigSlot iframe');
    await frame.getByRole('heading', { name: 'App und Betrieb', exact: true }).waitFor();
    assert.equal(await frame.locator('#nwAuthPassword').count(), 0);
    await apps.waitForFunction(() => {
      const document = window.document.querySelector('#dynamicGridConfigSlot iframe')?.contentDocument;
      const sheet = document?.querySelector('link[data-nw-embedded-ems]')?.sheet;
      return !!sheet && sheet.cssRules.length > 0;
    });
    assert.equal(new URL(await frame.locator('link[data-nw-embedded-ems]').getAttribute('href'), apps.url()).pathname, prefix + '/static/styles.css');
    pass('Real App-Center nested dynamic-grid React iframe loads and reuses authenticated proxy session');
    currentStage = 'VIS stream';
    const visit = await context.newPage();
    const events = visit.waitForResponse(response => new URL(response.url()).pathname === prefix + '/events' && response.status() === 200)
      .then(response => ({ response }), error => ({ error }));
    await visit.goto(origin + prefix + '/');
    const eventResult = await events;
    if (eventResult.error) throw eventResult.error;
    assert.equal(new URL(await visit.evaluate(() => window.NW_RUNTIME?.url('/events')), origin).pathname, prefix + '/events');
    assert((await visit.evaluate(() => [...document.styleSheets].filter(sheet => sheet.href && sheet.cssRules.length).length)) > 0);
    const loadedImages = await visit.evaluate(async () => {
      const images = [...document.images].filter(image => image.currentSrc && !image.currentSrc.startsWith('data:'));
      for (const image of images) { try { await image.decode(); } catch {} }
      return images.filter(image => image.naturalWidth > 0).length;
    });
    assert(loadedImages > 0);
    pass('Real VIS loads styles and decoded images and establishes EventSource below proxy prefix');
    currentStage = 'Simulation';
    await visit.goto(origin + prefix + '/simulation.html?nwAdmin=1&instance=0');
    await visit.waitForFunction(() => window.NW_AUTH?.getState()?.authed === true);
    assert((await visit.locator('body').innerText()).includes('Simulation'));
    assert((await visit.evaluate(() => [...document.styleSheets].filter(sheet => sheet.href && sheet.cssRules.length).length)) > 0);
    pass('Simulation opens with real proxied scripts, styles and authenticated status');
    currentStage = 'SmartHome configuration';
    await visit.goto(origin + prefix + '/smarthome-config.html?nwAdmin=1&instance=0');
    await visit.locator('#nw-shcfg-tile-building').waitFor();
    await visit.waitForFunction(() => window.NW_AUTH?.getState()?.authed === true);
    assert((await visit.evaluate(() => [...document.styleSheets].filter(sheet => sheet.href && sheet.cssRules.length).length)) > 0);
    pass('SmartHome configuration renders protected real page and styles without writes');
    currentStage = 'Final boundary checks';
    assert.equal(h.saved.length, 0, 'browser smoke must not persist configuration');
    assert.equal(h.mailWrites.length, 0, 'browser smoke must not send or modify mail');
    assert.deepEqual(failures, [], 'all asset/document requests stay reachable and API/static/EventSource keep prefix');
    assert.deepEqual(pageErrors, [], 'no uncaught browser errors');
    assert.deepEqual(sourceSnapshot(), testedHashes, 'tested product source/build files stayed unchanged during browser run');
    pass('No root API/static/EventSource escape, failed assets, uncaught browser errors or configuration writes');
    console.log(redactReport(JSON.stringify(report('PASS'))));
  } catch (error) {
    report('FAIL', { stage: currentStage, failure: redact(error.message || error) });
    throw new Error(`Browser integration failed during ${currentStage}: ${redact(error.message || error)}`);
  } finally {
    if (browser) await browser.close();
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (h) await h.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
