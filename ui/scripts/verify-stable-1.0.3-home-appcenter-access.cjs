#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';

/**
 * Stable 1.0.3 regression contract
 *
 * Reproduces the Home-license AppCenter relock reported in the field:
 * an authenticated admin opens the protected AppCenter, a stale Pro app flag
 * would normally request a Pro-only API, and the API answers with a legitimate
 * business/license 403 (`eos_required`). That response must never be confused
 * with a lost login session. A genuine 401 plus an unauthenticated status must
 * still lock the page fail-closed.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const http = require('node:http');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const CHROMIUM = [
  process.env.CHROMIUM_BIN,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].find((candidate) => candidate && fs.existsSync(candidate));

const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(test, timeoutMs, label) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeoutMs) {
    try {
      last = await test();
      if (last) return last;
    } catch (error) {
      last = error;
    }
    await wait(60);
  }
  throw new Error(`Timeout bei ${label}: ${last && last.message ? last.message : JSON.stringify(last)}`);
}

class CdpClient {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data || '{}'));
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${message.error.code}: ${message.error.message}`));
        else pending.resolve(message.result || {});
      } else if (message.method) {
        this.events.push(message);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      const description = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
      throw new Error(description || 'Browser-Auswertung fehlgeschlagen');
    }
    return result.result ? result.result.value : undefined;
  }

  close() {
    try { this.ws.close(); } catch (_) {}
  }
}

function inlineStaticScripts(html) {
  return html.replace(/<script([^>]*)\ssrc="\/static\/([^"]+)"([^>]*)><\/script>/gi, (full, before, source, after) => {
    const absolute = path.join(ROOT, 'www', source);
    if (!fs.existsSync(absolute)) return '';
    const code = fs.readFileSync(absolute, 'utf8').replace(/<\/script/gi, '<\\/script');
    return `<script${before}${after}>\n${code}\n</script>`;
  });
}

function buildHomeAppCenterHtml() {
  let html = read('www/ems-apps.html');
  const css = read('www/styles.css').replace(/<\/style/gi, '<\\/style');

  const homeLicense = {
    valid: true,
    ok: true,
    type: 'full',
    edition: 'hems',
    editionLabel: 'Home',
    maxWallboxes: 3,
    maxStoragePowerW: 50_000,
    storagePowerProfile: { id: 'home', label: 'Home', maxCommandW: 50_000, unrestricted: false },
    features: {
      dashboard: true,
      history: true,
      chargingManagement: true,
      storageControl: true,
      thermalControl: true,
      heatingRodControl: true,
      thresholdControl: true,
      relayControl: true,
      gridConstraints: true,
      aiAdvisor: true,
      dynamicTariffs: true,
      para14a: true,
      energyWallet: true,
      energyLedger: true,
    },
    homeIncludedApps: ['charging', 'storage', 'thermal', 'heatingrod', 'threshold', 'relay', 'grid', 'aiAdvisor', 'tariff', 'para14a', 'energyWallet', 'energyLedger'],
  };

  // Intentionally retain stale Pro flags. Stable 1.0.3 must mask them before
  // rendering and must not request a Pro-only endpoint under a Home license.
  const config = {
    // Entspricht dem Installer-GET: auch vor Erstinstallation liegt der CAS-Vertrag vor.
    dynamicGridConnection: require('../ems/services/dynamic-grid-config').dynamicGridDefaults(),
    license: homeLicense,
    emsApps: {
      apps: {
        grid: { installed: true, enabled: true },
        charging: { installed: true, enabled: true },
        storage: { installed: true, enabled: true },
        netOperator: { installed: true, enabled: true },
        meshMicrogrid: { installed: true, enabled: true },
        operatingStrategies: { installed: true, enabled: true },
      },
    },
    settingsConfig: { evcsCount: 0, evcsList: [], stationGroups: [] },
    installerConfig: { gridConnectionPower: 30 },
    datapoints: {},
    storage: {},
    storageFarm: { storages: [] },
    countryProfile: { country: 'DE' },
    gridConstraints: {},
    chargingManagement: {},
    netOperatorInterface: { enabled: true, mode: 'active' },
    operatingStrategies: { enabled: true, mode: 'active' },
    meshMicrogrid: { enabled: true, nodes: [] },
  };

  const observeErrors = `<script>
window.__nwErrors = [];
window.addEventListener('error', event => window.__nwErrors.push(String(event.message || 'window error')));
window.addEventListener('unhandledrejection', event => window.__nwErrors.push(String(event.reason?.message || event.reason)));
</script>`;
  html = html.replace(/<link[^>]+href="\/static\/styles\.css"[^>]*>/i, `<style>${css}</style>`);
  html = html.replace(/<link[^>]+(?:rel="manifest"|href="\/assets\/)[^>]*>/gi, '');
  html = html.replace(/<script[^>]+src="\/static\/admin-guard\.js"[^>]*><\/script>/i, '');
  html = html.replace('<script src="/static/auth.js"></script>', `${observeErrors}<script src="/static/auth.js"></script>`);
  return { html: inlineStaticScripts(html), homeLicense, config };
}

/** Eine echte Loopback-Origin und ein HttpOnly-Testcookie ersetzen about:blank
 * und den alten globalen fetch-Stub. Dies prüft den Browservertrag, keinen
 * ioBroker-Controller oder produktiven Authentifizierungsserver. */
async function createBrowserFixture() {
  const content = buildHomeAppCenterHtml(); const requests = [];
  const token = crypto.randomBytes(32).toString('hex');
  const session = crypto.randomBytes(32).toString('hex');
  const password = crypto.randomBytes(24).toString('base64url');
  const cookieName = 'nw_ui_home_browser_fixture';
  let active = false; let loginCount = 0;
  const hasSession = request => active && String(request.headers.cookie || '').split(';').some(part => part.trim() === cookieName + '=' + session);
  const status = authed => ({ mode: 'iobroker', configured: true, enabled: true, protectWrites: true,
    authed, authenticated: authed, user: authed ? 'system.user.admin' : null,
    role: authed ? 'admin' : 'none', capabilities: authed ? ['*'] : [],
    isAdmin: authed, isInstaller: false, isCustomer: false,
    csrfToken: authed ? token : null, loginUrl: '/login.html', logoutUrl: '' });
  const assets = new Map([
    ['/login.html', ['text/html', 'www/login.html']],
    ['/static/login.js', ['application/javascript', 'www/login.js']],
    ['/static/runtime-base.js', ['application/javascript', 'www/runtime-base.js']],
    ['/static/login.css', ['text/css', 'www/login.css']],
  ]);
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
      const authed = hasSession(request); const csrfValid = request.headers['x-nw-csrf'] === token;
      const record = { path: pathname, method: request.method || 'GET', authed, csrfValid, status: 0 }; requests.push(record);
      const send = (code, value, headers = {}) => {
        record.status = code;
        response.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
        response.end(JSON.stringify(value));
      };
      if (pathname === '/api/auth/status') { send(200, status(authed)); return; }
      if (pathname === '/api/auth/login' && request.method === 'POST') {
        let body = ''; for await (const part of request) { body += part; if (body.length > 4096) { send(413, { error: 'too_large' }); return; } }
        let input; try { input = JSON.parse(body); } catch (_) { send(400, { error: 'invalid_json' }); return; }
        loginCount += 1;
        if (input.user !== 'admin' || input.password !== password) { send(401, { error: 'invalid_credentials' }); return; }
        active = true;
        send(200, status(true), { 'Set-Cookie': cookieName + '=' + session + '; Path=/; HttpOnly; SameSite=Lax' }); return;
      }
      if (pathname.startsWith('/api/') || pathname === '/config') {
        if (!authed) { send(401, { error: 'authentication_required' }); return; }
        if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method || 'GET') && !csrfValid) { send(403, { error: 'csrf_invalid' }); return; }
        if (pathname === '/api/netoperator/drivers' || pathname === '/api/pro-only-fixture') { send(403, { error: 'eos_required' }); return; }
        if (pathname === '/api/protected-fixture') { send(401, { error: 'unauthorized' }); return; }
        if (pathname === '/api/installer/config') { send(200, { ok: true, license: content.homeLicense, config: content.config }); return; }
        if (pathname === '/api/license/features') { send(200, { ok: true, ...content.homeLicense }); return; }
        if (pathname === '/api/installer/backup/userdata') { send(200, { ok: true, available: false }); return; }
        if (pathname === '/api/installer/tariff-provider/providers') { send(200, { ok: true, providers: [] }); return; }
        if (pathname === '/api/ems/status') { send(200, { ok: true, status: {} }); return; }
        if (pathname === '/api/ems/charging/diagnostics') { send(200, { ok: true, wallboxes: [], stations: [], summary: {} }); return; }
        if (pathname === '/api/ems/charging/audit') { send(200, { ok: true, summary: {}, wallboxes: [], events: [] }); return; }
        if (pathname === '/api/state') { send(200, { ok: true, states: {} }); return; }
        if (pathname === '/config') { send(200, { license: content.homeLicense, featureVisibility: {} }); return; }
        send(200, { ok: true }); return;
      }
      if (pathname === '/ems-apps.html') {
        if (!authed) { response.writeHead(302, { Location: '/login.html', 'Cache-Control': 'no-store' }); response.end(); return; }
        response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' }); response.end(content.html); return;
      }
      const asset = assets.get(pathname);
      if (asset) { response.writeHead(200, { 'Content-Type': asset[0], 'Cache-Control': 'no-store' }); response.end(read(asset[1])); return; }
      response.writeHead(404, { 'Cache-Control': 'no-store' }); response.end();
    } catch (_) { if (!response.headersSent) response.writeHead(500); response.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  return { origin: 'http://127.0.0.1:' + address.port, requests, password, cookieName,
    loseSession: () => { active = false; }, loginCount: () => loginCount,
    close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }) };
}

function staticContracts() {
  const pkg = JSON.parse(read('package.json'));
  const appCenter = read('src-ts/runtime-executables/www/ems-apps.ts');
  const netOperator = read('src-ts/runtime-executables/www/netoperator-appcenter.ts');
  const main = read('src-ts/runtime-executables/main.ts');

  // This regression is a retained baseline, not a restriction to one release.
  const version = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z.-]+)?$/.exec(pkg.version);
  assert(version, 'Home-AppCenter regression requires a valid stable SemVer');
  const [major, minor, patch] = version.slice(1, 4).map(Number);
  assert(major > 1 || (major === 1 && (minor > 0 || (minor === 0 && patch >= 3))),
    'Home-AppCenter baseline must be retained on Stable 1.0.3 and later');
  assert.equal(JSON.parse(read('io-package.json')).common.version, pkg.version,
    'Adapter manifests must agree for the retained Home regression');
  // Der Auth-Vertrag wird unten am tatsächlichen Login, Cookie, 403 und
  // Sitzungsverlust geprüft; keine Bindung an entfernte interne Variablennamen.
  assert.match(appCenter, /_isAppLicensed\('netOperator'\) && \(\(\) =>/);
  assert.match(appCenter, /_isAppLicensed\('operatingStrategies'\) && \(\(\) =>/);
  assert.match(appCenter, /if \(_isAppLicensed\('netOperator'\) && window\.NexoWattNetOperatorAppCenter\)/);
  assert.match(appCenter, /if \(_isAppLicensed\('operatingStrategies'\) && window\.NexoWattOperatingStrategiesAppCenter\)/);
  assert.match(main, /cfgOut\.emsApps = this\._nwApplyLicenseLimitsToEmsApps\(cfgOut\.emsApps\)/);

  const editionCheck = netOperator.indexOf("const eos = String(getEdition() || '').toLowerCase() === 'eos';");
  const homeReturn = netOperator.indexOf('if (!eos) {', editionCheck);
  const driverLoad = netOperator.indexOf('if (!driverRows.length) await loadDrivers();', editionCheck);
  assert(editionCheck >= 0 && homeReturn > editionCheck && driverLoad > homeReturn,
    'Netzbetreiber-AppCenter must return for Home before loading Pro-only drivers.');
}

async function runFixtureContracts() {
  const fixture = await createBrowserFixture();
  try {
    const anonymous = await fetch(fixture.origin + '/api/auth/status').then(response => response.json());
    assert.equal(anonymous.mode, 'iobroker'); assert.equal(anonymous.configured, true);
    assert.equal(anonymous.authed, false); assert.equal(anonymous.authenticated, false); assert.equal(anonymous.csrfToken, null);
    const failed = await fetch(fixture.origin + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: 'admin', password: 'wrong' }) });
    assert.equal(failed.status, 401); assert.equal(failed.headers.get('set-cookie'), null);
    const signedIn = await fetch(fixture.origin + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: 'admin', password: fixture.password }) });
    assert.equal(signedIn.status, 200);
    const cookie = signedIn.headers.get('set-cookie'); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/);
    const sessionCookie = cookie.split(';')[0];
    assert.equal((await fetch(fixture.origin + '/api/auth/status').then(response => response.json())).authed, false);
    const status = await fetch(fixture.origin + '/api/auth/status', { headers: { Cookie: sessionCookie } }).then(response => response.json());
    assert.equal(status.role, 'admin'); assert.equal(status.user, 'system.user.admin'); assert.equal(status.authenticated, true);
    assert.match(status.csrfToken, /^[a-f0-9]{64}$/);
    assert.equal((await fetch(fixture.origin + '/api/mutation-fixture', { method: 'POST', headers: { Cookie: sessionCookie } })).status, 403);
    assert.equal((await fetch(fixture.origin + '/api/mutation-fixture', { method: 'POST', headers: { Cookie: sessionCookie, 'X-NW-CSRF': status.csrfToken } })).status, 200);
    fixture.loseSession();
    assert.equal((await fetch(fixture.origin + '/api/auth/status', { headers: { Cookie: sessionCookie } }).then(response => response.json())).authed, false);
  } finally { await fixture.close(); }
}

async function runBrowserRegression() {
  assert.ok(CHROMIUM, 'Chromium/Chrome für den Home-AppCenter-Regressionsstest wurde nicht gefunden.');
  const fixture = await createBrowserFixture();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-home-appcenter-'));
  const browserLog = [];
  const browser = spawn(CHROMIUM, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--disable-background-networking', '--disable-component-update', '--disable-default-apps',
    '--disable-extensions', '--no-first-run', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  browser.stdout.on('data', chunk => browserLog.push(String(chunk)));
  browser.stderr.on('data', chunk => browserLog.push(String(chunk)));
  browser.on('error', error => browserLog.push(error.message));
  let cdp;
  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    await waitFor(() => fs.existsSync(portFile), 15_000, 'DevToolsActivePort');
    const port = Number(fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0]);
    const target = await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      return (await response.json()).find(entry => entry.type === 'page');
    }, 15_000, 'Browser-Target');
    cdp = new CdpClient(target.webSocketDebuggerUrl); await cdp.open();
    await cdp.send('Runtime.enable'); await cdp.send('Page.enable'); await cdp.send('Network.enable');
    await cdp.send('Page.navigate', { url: fixture.origin + '/login.html' });
    await waitFor(() => cdp.evaluate("!!document.getElementById('loginForm') && !document.getElementById('loginForm').hidden"), 10000, 'Standalone-Anmeldeformular');
    await cdp.evaluate(`(() => {
      document.getElementById('loginUser').value = 'admin';
      document.getElementById('loginPassword').value = ${JSON.stringify(fixture.password)};
      document.getElementById('loginForm').requestSubmit(); return true;
    })()`);
    const initial = await waitFor(() => cdp.evaluate(`(() => {
      const auth = window.NW_AUTH?.getState();
      const status = document.getElementById('nw-emsapps-status');
      if (!auth?._loaded || !status || !/Konfiguration geladen/i.test(status.textContent || '')) return null;
      const apps = document.getElementById('appsList');
      return { auth, path: location.pathname, gateVisible: !!document.getElementById('nwAuthGate') && !document.getElementById('nwAuthGate').hidden,
        appCenterVisible: !!apps && apps.getClientRects().length > 0,
        homeVisible: /Lizenz:\\s*Home/i.test(document.body.innerText || ''), errors: window.__nwErrors || [],
        exposedCookie: document.cookie.includes(${JSON.stringify(fixture.cookieName)}) };
    })()`), 20000, 'Home-AppCenter vollständig geladen');
    assert.equal(initial.path, '/ems-apps.html'); assert.equal(initial.auth.authed, true); assert.equal(initial.auth.role, 'admin');
    assert.deepEqual(initial.auth.capabilities, ['*']); assert.equal(initial.gateVisible, false);
    assert.equal(initial.appCenterVisible, true); assert.equal(initial.homeVisible, true); assert.equal(initial.exposedCookie, false);
    assert.equal(fixture.loginCount(), 1, 'Die Anmeldung wird genau einmal gesendet');
    const cookies = await cdp.send('Network.getCookies', { urls: [fixture.origin] });
    assert.equal(cookies.cookies.find(cookie => cookie.name === fixture.cookieName)?.httpOnly, true);
    assert.equal(fixture.requests.some(request => request.path === '/api/netoperator/drivers'), false,
      'Home darf auch bei veralteten Pro-Flags keine Pro-Treiber-API aufrufen');
    assert.deepEqual(initial.errors, []);

    // Eine authentifizierte Mutation erhält den CSRF-Header des Statusvertrags.
    const mutation = await cdp.evaluate("fetch('/api/mutation-fixture', { method: 'POST', body: '{}' }).then(response => response.status)");
    assert.equal(mutation, 200);
    assert.equal(fixture.requests.filter(request => request.path === '/api/mutation-fixture' && request.authed && request.csrfValid).length, 1);

    // Eine fachliche 403-Antwort bleibt erhalten; Sitzung und Fachoberfläche bleiben nutzbar.
    const business = await cdp.evaluate(`(async () => {
      const response = await fetch('/api/pro-only-fixture');
      const apps = document.getElementById('appsList');
      return { status: response.status, auth: window.NW_AUTH.getState(), path: location.pathname,
        gateVisible: !!document.getElementById('nwAuthGate') && !document.getElementById('nwAuthGate').hidden,
        appCenterVisible: !!apps && apps.getClientRects().length > 0 };
    })()`);
    assert.equal(business.status, 403); assert.equal(business.auth.authed, true); assert.equal(business.path, '/ems-apps.html');
    assert.equal(business.gateVisible, false); assert.equal(business.appCenterVisible, true);

    // Der Server widerruft die Sitzung. Nach 401 und negativer Statusprüfung
    // öffnet das aktuelle Produkt die separate Loginseite, kein Passwortoverlay.
    fixture.loseSession();
    await cdp.evaluate("void fetch('/api/protected-fixture'); true");
    const lost = await waitFor(() => cdp.evaluate(`(() => {
      const form = document.getElementById('loginForm');
      return location.pathname === '/login.html' && form && !form.hidden
        ? { appCenterPresent: !!document.getElementById('appsList'), returnTo: new URL(location.href).searchParams.get('returnTo') } : null;
    })()`), 10000, 'Sitzungsverlust führt zur separaten Standalone-Anmeldung');
    assert.equal(lost.appCenterPresent, false); assert.equal(lost.returnTo, '/ems-apps.html');
    assert.ok(fixture.requests.some(request => request.path === '/api/protected-fixture' && request.status === 401));
    assert.equal(cdp.events.filter(event => event.method === 'Runtime.exceptionThrown').length, 0, 'Keine Browser-Laufzeitfehler');
  } catch (error) {
    const tail = browserLog.join('').split(/\r?\n/).slice(-30).join('\n'); if (tail) console.error(tail);
    throw error;
  } finally {
    if (cdp) cdp.close(); try { browser.kill('SIGKILL'); } catch (_) {}
    await wait(250); try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
    await fixture.close();
  }
}

async function main() {
  staticContracts();
  if (process.argv.includes('--fixture-contracts')) {
    await runFixtureContracts();
    console.log('[Stable 1.0.3] Fixture-/Quellverträge PASS; kein Browserlauf ausgeführt.'); return;
  }
  if (process.argv.includes('--contracts-only')) {
    console.log('[Stable 1.0.3] Quellverträge PASS; kein Browserlauf ausgeführt.'); return;
  }
  await runBrowserRegression();
  console.log('[Stable 1.0.3] Browser PASS: Home-AppCenter bleibt bei Lizenz-403 offen; Cookie/CSRF geprüft; Sitzungsverlust führt zum Login.');
}
module.exports = { staticContracts, buildHomeAppCenterHtml, createBrowserFixture };
if (require.main === module) main().catch(error => { console.error(error && error.stack ? error.stack : error); process.exitCode = 1; });
