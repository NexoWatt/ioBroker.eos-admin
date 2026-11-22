/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/* Isolierter Browsertest: ausschließlich abgefangene Test-URLs, keine Anlage.
 * Benötigt separat verfügbare Playwright-/Chromium-Testwerkzeuge. Keine Installation
 * und kein Produktbuild; die drei TS-Dateien werden für die Fixture im RAM transpiliert. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const reports = path.join(root, 'docs/reports/auth-profiles-2026-11-19');
const writeReport = process.argv.includes('--report');
const origin = 'https://nexowatt.test';
const sessionValue = crypto.randomBytes(32).toString('hex');
const cookieName = () => status.mode === 'eos' ? 'access_token' : 'nw_ui_browser_fixture';
const compiled = new Map(['runtime-base', 'auth', 'login', 'pwa'].map(name => [name, ts.transpileModule(
  fs.readFileSync(path.join(root, 'src-ts/runtime-executables/www', name + '.ts'), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText]));
const token = crypto.randomBytes(32).toString('hex');
const baseStatus = (mode = 'iobroker') => ({ mode, configured: true, enabled: true, protectWrites: true,
  authed: false, authenticated: false, role: 'none', user: null, capabilities: [], csrfToken: null,
  loginUrl: mode === 'eos' ? origin + '/index.html?login' : origin + '/login.html', logoutUrl: mode === 'eos' ? origin + '/logout' : '' });
const signedIn = (role, mode = 'iobroker') => ({ ...baseStatus(mode), authed: true, authenticated: true, role,
  user: 'system.user.browser_test', capabilities: role === 'customer' ? ['ui.read', 'ui.write'] : ['*'], csrfToken: token });
let status = baseStatus();
let loginCalls = 0;
let submittedExactly = false;
let expectedPassword = '';
const requests = [];
const errors = [];
const results = [];
const dashboard = '<!doctype html><html><head><script src="/static/runtime-base.js"></script><script src="/static/auth.js" defer></script></head><body><header class="topbar"></header><main id="privateData">Vertrauliche Testdaten</main></body></html>';

/** Browser-Routen verwenden denselben expliziten Profilvertrag. Eine
 * vorbereitete Sitzung wird nur mit dem zugehörigen HttpOnly-Fixturecookie
 * bestätigt; Cookie-/CSRF-Werte werden nicht in Belegen protokolliert. */
async function handleRoute(route) {
  const request = route.request(); const url = new URL(request.url());
  const headers = await request.allHeaders();
  const hasCookie = String(headers.cookie || '').split(';').some(part => part.trim() === cookieName() + '=' + sessionValue);
  const authed = status.authed && hasCookie;
  requests.push({ origin: url.origin, path: url.pathname, method: request.method(), csrfPresent: !!headers['x-nw-csrf'],
    csrfValid: headers['x-nw-csrf'] === token, hasCookie });
  // Keine fremde API darf anhand eines gleichen Pfadnamens Auth-JSON erhalten.
  if (url.origin !== origin) {
    if (url.origin === 'https://camera.test' && url.pathname === '/api/set') return route.fulfill({ json: { ok: true }, headers: { 'Access-Control-Allow-Origin': origin } });
    return route.fulfill({ status: 404, body: '' });
  }
  if (url.pathname === '/api/auth/status') return route.fulfill({ json: authed ? status : { ...status, authed: false, authenticated: false,
    role: 'none', user: null, capabilities: [], csrfToken: null } });
  if (url.pathname === '/api/auth/login') {
    loginCalls += 1;
    if (status.mode !== 'iobroker') return route.fulfill({ status: 409, json: { error: 'central_login_required' } });
    const data = request.postDataJSON();
    submittedExactly = data.user === 'browser_test' && data.password === expectedPassword && !!expectedPassword;
    if (!submittedExactly) return route.fulfill({ status: 401, json: { error: 'invalid_credentials' } });
    status = signedIn('customer');
    return route.fulfill({ json: status, headers: { 'Set-Cookie': cookieName() + '=' + sessionValue + '; Path=/; HttpOnly; Secure; SameSite=Lax' } });
  }
  if (url.pathname.startsWith('/api/')) {
    if (!authed) return route.fulfill({ status: 401, json: { error: 'authentication_required' } });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && headers['x-nw-csrf'] !== token) return route.fulfill({ status: 403, json: { error: 'csrf_invalid' } });
    if (url.pathname === '/api/auth/logout') {
      const previousCookie = cookieName(); status = baseStatus(status.mode);
      return route.fulfill({ json: { ok: true }, headers: { 'Set-Cookie': previousCookie + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' } });
    }
    if (url.pathname === '/api/business-denied') return route.fulfill({ status: 403, json: { error: 'feature_not_licensed' } });
    return route.fulfill({ json: { ok: true } });
  }
  if (url.pathname.startsWith('/static/')) {
    const name = path.basename(url.pathname);
    if (name.endsWith('.js') && compiled.has(name.slice(0, -3))) return route.fulfill({ contentType: 'application/javascript', body: compiled.get(name.slice(0, -3)) });
    if (name === 'login.css') return route.fulfill({ contentType: 'text/css', body: fs.readFileSync(path.join(root, 'www/login.css'), 'utf8') });
    if (name === 'nexowatt-eos-logo.png') return route.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join(root, 'www', name)) });
  }
  if (url.pathname === '/manifest.webmanifest') return route.fulfill({ contentType: 'application/manifest+json', body: fs.readFileSync(path.join(root, 'www/manifest.webmanifest'), 'utf8') });
  if (url.pathname === '/sw.js') return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(root, 'www/sw.js'), 'utf8') });
  if (url.pathname === '/apple-touch-icon.png' || /^\/assets\/icons\/nexowatt-[0-9]+(?:-maskable)?\.png$/.test(url.pathname)) return route.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join(root, 'www', url.pathname.slice(1))) });
  if (url.pathname === '/login.html') return route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(root, 'www/login.html'), 'utf8') });
  if (url.pathname === '/frame-test') return route.fulfill({ contentType: 'text/html', body: '<iframe src="/login.html" title="Anmeldung"></iframe>' });
  if (url.pathname === '/logout' || (url.pathname === '/index.html' && url.searchParams.has('login'))) {
    return route.fulfill({ contentType: 'text/html', body: '<p>Zentrale Testseite</p>' });
  }
  if (!authed) return route.fulfill({ status: 302, headers: { Location: origin + '/login.html' }, body: '' });
  return route.fulfill({ contentType: 'text/html', body: dashboard });
}

async function runFixtureContracts() {
  const call = async (pathname, headers = {}, method = 'GET', body = {}) => {
    let output;
    await handleRoute({ request: () => ({ url: () => origin + pathname, allHeaders: async () => headers, method: () => method, postDataJSON: () => body }),
      fulfill: async value => { output = value; } }); return output;
  };
  status = signedIn('admin');
  assert.equal((await call('/api/auth/status')).json.authed, false, 'Ein Statusobjekt ersetzt kein Cookie');
  const authenticated = await call('/api/auth/status', { cookie: cookieName() + '=' + sessionValue });
  assert.equal(authenticated.json.mode, 'iobroker'); assert.equal(authenticated.json.configured, true);
  assert.equal(authenticated.json.role, 'admin'); assert.equal(authenticated.json.csrfToken, token);
  assert.equal((await call('/api/set', { cookie: cookieName() + '=' + sessionValue }, 'POST')).status, 403);
  assert.equal((await call('/api/set', { cookie: cookieName() + '=' + sessionValue, 'x-nw-csrf': token }, 'POST')).json.ok, true);
  status = baseStatus(); expectedPassword = crypto.randomBytes(24).toString('base64url');
  assert.equal((await call('/api/auth/login', {}, 'POST', { user: 'browser_test', password: 'wrong' })).status, 401);
  const login = await call('/api/auth/login', {}, 'POST', { user: 'browser_test', password: expectedPassword });
  assert.match(login.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Lax/);
  const logout = await call('/api/auth/logout', { cookie: cookieName() + '=' + sessionValue, 'x-nw-csrf': token }, 'POST');
  assert.match(logout.headers['Set-Cookie'], /Max-Age=0/); assert.equal(status.authed, false);
  status = baseStatus('eos');
  assert.equal((await call('/api/auth/login', {}, 'POST')).status, 409);
  assert.equal((await call('/api/auth/status')).json.csrfToken, null);
  expectedPassword = '';
  console.log('Auth-Browserfixture-Verträge PASS (HTTP-Doubles; kein Browserlauf).');
}

async function main() {
  if (process.argv.includes('--fixture-contracts')) { await runFixtureContracts(); return; }
  const { chromium } = require('playwright');
  if (writeReport) fs.mkdirSync(reports, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.NW_BROWSER_EXECUTABLE ? { executablePath: process.env.NW_BROWSER_EXECUTABLE } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.route('**/*', handleRoute);
  const seedSession = async value => {
    status = value; await context.clearCookies();
    if (value.authed) await context.addCookies([{ name: cookieName(), value: sessionValue, url: origin, httpOnly: true, secure: true, sameSite: 'Lax' }]);
  };
  const page = await context.newPage(); page.setDefaultTimeout(5000);
  page.on('pageerror', error => errors.push(error.message));
  const passed = name => { results.push({ name, result: 'PASS' }); console.log('PASS ' + name); };
  try {
    await page.goto('https://nexowatt.test/login.html');
    await page.locator('#loginForm').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#centralLogin').isVisible(), false);
    if (writeReport) await page.screenshot({ path: path.join(reports, 'login-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    if (writeReport) await page.screenshot({ path: path.join(reports, 'login-mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    passed('ioBroker-Login, mobile Breite und getrennte Profile');

    expectedPassword = ' ' + crypto.randomBytes(24).toString('base64url') + ' ';
    await page.locator('#loginUser').fill('browser_test'); await page.locator('#loginPassword').fill(expectedPassword);
    await page.locator('#loginSubmit').click(); await page.waitForURL('https://nexowatt.test/');
    await page.locator('#privateData').waitFor({ state: 'visible' });
    assert.equal(loginCalls, 1); assert.ok(submittedExactly);
    const cookie = (await context.cookies(origin)).find(value => value.name === cookieName());
    assert.equal(cookie?.httpOnly, true); assert.equal(cookie?.secure, true); assert.equal(cookie?.sameSite, 'Lax');
    assert.equal(await page.evaluate(() => document.cookie.includes('nw_ui_browser_fixture=')), false);
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    expectedPassword = '';
    passed('Passwort unverändert einmal gesendet, keine Browser-Persistenz');

    await page.evaluate(async () => { await fetch('/api/set', { method: 'POST', body: '{}' }); await fetch('https://camera.test/api/set', { method: 'POST', body: '{}' }); });
    assert.ok(requests.some(r => r.origin === 'https://nexowatt.test' && r.path === '/api/set' && r.csrfValid));
    assert.ok(requests.some(r => r.origin === 'https://camera.test' && r.path === '/api/set' && !r.csrfPresent));
    await page.evaluate(() => fetch('/api/business-denied'));
    assert.equal(await page.locator('#privateData').isVisible(), true);
    passed('CSRF nur eigene Runtime; fachliches 403 sperrt gültige Sitzung nicht');

    await context.setOffline(true); await page.locator('#nwAuthGate').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#privateData').isVisible(), false);
    await context.setOffline(false); await page.locator('#privateData').waitFor({ state: 'visible' });
    status = { ...signedIn('customer'), configured: false };
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await page.locator('#nwAuthGate').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#privateData').isVisible(), false);
    passed('Offline-/BFCache-Rückkehr bleibt ohne gültige Prüfung geschlossen');

    await seedSession(baseStatus('eos'));
    await page.goto('https://nexowatt.test/login.html'); await page.locator('#centralLogin').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#loginForm').isVisible(), false);
    assert.equal(await page.locator('#centralLogin').getAttribute('href'), status.loginUrl);
    assert.equal(loginCalls, 1);
    passed('EOS ausschließlich Zentralanmeldung ohne lokalen Passwortversuch');

    status = { ...baseStatus(), configured: false };
    await page.goto('https://nexowatt.test/login.html'); await page.locator('#loginRetry').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#loginForm').isVisible(), false);
    status = baseStatus(); await page.goto('https://nexowatt.test/frame-test');
    const child = page.frameLocator('iframe'); await child.locator('#frameLogin').waitFor({ state: 'visible' });
    assert.equal(await child.locator('#loginForm').isVisible(), false);
    passed('Fehlkonfiguration und Frames zeigen keine Passwortmaske');

    for (const target of ['//foreign.test/', '/api/set', '/smarthome-config.html', '/%2f%2fforeign.test/']) {
      await seedSession(signedIn('customer'));
      await page.goto('https://nexowatt.test/login.html?returnTo=' + encodeURIComponent(target));
      await page.waitForURL('https://nexowatt.test/');
    }
    await seedSession(signedIn('installer'));
    await page.goto('https://nexowatt.test/login.html'); await page.waitForURL('https://nexowatt.test/ems-apps.html');
    passed('Lokale Rollenweiterleitung; externe/API-/Kunden-Setup-Rücksprünge verworfen');

    await seedSession(signedIn('admin', 'eos'));
    const logoutTarget = status.logoutUrl;
    await page.goto('https://nexowatt.test/'); await page.locator('#privateData').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
    await page.waitForURL(logoutTarget);
    assert.ok(requests.some(r => r.path === '/api/auth/logout' && r.csrfValid));
    passed('EOS-Abmeldung mit CSRF und zentralem Abmeldeziel');
    assert.deepEqual(errors, []);
    if (writeReport) fs.writeFileSync(path.join(reports, 'browser-evidence.json'), JSON.stringify({ timestamp: new Date().toISOString(), environment: { node: process.version, browser: browser.version(), fixtureOnly: true, cookieModel: 'HttpOnly/Secure/SameSite Fixturecookie; kein produktiver ioBroker-Server' }, results, runtimeErrors: errors }, null, 2) + '\n');
  } finally { await browser.close(); }
}
module.exports = { handleRoute, runFixtureContracts };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
