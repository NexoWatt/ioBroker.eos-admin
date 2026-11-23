/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/* Vertragstest am vollständigen transpilierten Frontend mit isolierten
 * DOM-/HTTP-Doubles. Kein Browser-, TLS-, Layout- oder Anlagenabnahmenachweis. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const compiled = name => ts.transpileModule(fs.readFileSync(path.join(root, 'src-ts/runtime-executables/www', name + '.ts'), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const token = crypto.randomBytes(32).toString('hex');
const signedOut = () => ({ mode: 'iobroker', configured: true, enabled: true, protectWrites: true,
  authed: false, authenticated: false, role: 'none', user: null, capabilities: [], csrfToken: null,
  loginUrl: 'https://portal.test/index.html?login', logoutUrl: 'https://portal.test/logout' });
const signedIn = role => ({ ...signedOut(), authed: true, authenticated: true, role, user: 'system.user.fixture',
  capabilities: role === 'customer' ? ['ui.read', 'ui.write'] : ['*'], csrfToken: token });
const results = [];

function fixture(name, initialStatus, options = {}) {
  const nodes = new Map(); const events = new Map(); const redirects = []; const calls = []; const messages = [];
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.children = []; this.attributes = new Map(); this.handlers = new Map();
      this.hidden = false; this.inert = false; this.value = ''; this.type = ''; this.disabled = false;
      this.style = { display: '', removeProperty() {} }; this.classes = new Set();
      this.classList = { add: value => this.classes.add(value), remove: value => this.classes.delete(value),
        contains: value => this.classes.has(value), toggle: (value, active) => active ? this.classes.add(value) : this.classes.delete(value) };
    }
    set id(value) { this._id = value; nodes.set(value, this); }
    get id() { return this._id; }
    set innerHTML(value) {
      this._html = value;
      if (value.includes('nw-auth-actions')) { this.paragraph = new Element('p'); this.actions = new Element(); }
    }
    appendChild(node) { this.children.push(node); return node; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(key, value) { this.attributes.set(key, value); }
    getAttribute(key) { return this.attributes.has(key) ? this.attributes.get(key) : null; }
    removeAttribute(key) { this.attributes.delete(key); }
    querySelector(selector) { return selector === 'p' ? this.paragraph : selector === '.nw-auth-actions' ? this.actions : null; }
    addEventListener(type, fn) { this.handlers.set(type, fn); }
    focus() {}
  }
  const body = new Element('body'); const header = new Element('header'); const content = new Element('main');
  body.append(header, content);
  const document = { body, head: new Element('head'), documentElement: new Element('html'), hidden: false, readyState: 'complete',
    getElementById: id => nodes.get(id) || null, createElement: tag => new Element(tag),
    querySelector: selector => selector === 'header.topbar' ? header : selector === '#nwAuthGate .nw-auth-actions' ? nodes.get('nwAuthGate')?.actions : null,
    querySelectorAll: () => [], addEventListener: (type, fn) => events.set('document:' + type, fn) };
  for (const id of ['loginForm', 'loginUser', 'loginPassword', 'loginSubmit', 'loginPasswordToggle', 'loginStatus', 'loginDescription', 'centralLogin', 'frameLogin', 'loginRetry']) {
    const element = new Element(); element.id = id; if (['loginForm', 'centralLogin', 'frameLogin', 'loginRetry'].includes(id)) element.hidden = true;
  }
  const location = new URL(options.url || 'https://nexowatt.test/' + (name === 'login' ? 'login.html' : ''));
  location.replace = target => redirects.push(String(target));
  const env = { status: initialStatus, fail: false, businessDenied: false };
  const nativeFetch = async (input, init = {}) => {
    const raw = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
    const target = new URL(raw, location.href); const headers = new Headers(init.headers);
    calls.push({ path: target.pathname, origin: target.origin, method: init.method || 'GET', csrf: headers.get('X-NW-CSRF'), body: init.body });
    if (env.fail) throw new Error('fixture_unavailable');
    if (target.pathname.endsWith('/api/auth/status')) return Response.json(env.status);
    if (target.pathname.endsWith('/api/auth/login')) { env.status = signedIn('customer'); return Response.json(env.status); }
    return Response.json({ ok: !env.businessDenied }, { status: env.businessDenied ? 403 : 200 });
  };
  const navigator = { onLine: true, serviceWorker: { controller: { postMessage: value => messages.push(value) } } };
  const window = { location, navigator, fetch: nativeFetch, setTimeout, clearTimeout, setInterval: () => 1,
    addEventListener: (type, fn) => events.set('window:' + type, fn), dispatchEvent() {},
    NW_RUNTIME: options.proxy ? { url: value => '/admin/proxy/nexowatt-ui.2' + value, pathname: () => '/' } : undefined };
  window.self = window; window.top = options.frame ? {} : window;
  const context = vm.createContext({ window, document, navigator, fetch: nativeFetch, HTMLElement: Element, URL, URLSearchParams, Request, Response,
    Headers, AbortController, TextDecoder, CustomEvent, Uint8Array, console });
  vm.runInContext(compiled(name), context);
  return { window, document, content, nodes, events, redirects, calls, messages, env,
    settle: async () => { for (let i = 0; i < 20; i += 1) await new Promise(resolve => setImmediate(resolve)); } };
}

async function check(name, fn) { await fn(); results.push({ name, result: 'PASS' }); console.log('PASS ' + name); }
async function main() {
  await check('Statusprofil/CSRF erforderlich; fehlender Status sperrt die UI', async () => {
    for (const status of [{ ...signedIn('customer'), configured: false }, { ...signedIn('customer'), mode: undefined }, { ...signedIn('customer'), csrfToken: undefined }]) {
      const f = fixture('auth', status); await f.settle(); assert.equal(f.window.NW_AUTH.getState().authed, false); assert.equal(f.content.inert, true);
    }
  });
  await check('Eigene Mutationen mit CSRF, fremde Kamera unverändert, kein Replay', async () => {
    const f = fixture('auth', signedIn('customer')); await f.settle();
    await f.window.fetch('/api/set', { method: 'POST', body: '{}' }); await f.window.fetch('https://camera.test/api/set', { method: 'POST', body: '{}' });
    assert.equal(f.calls.find(call => call.path === '/api/set' && call.origin === 'https://nexowatt.test').csrf, token);
    assert.equal(f.calls.find(call => call.origin === 'https://camera.test').csrf, null);
    assert.equal(f.calls.filter(call => call.path === '/api/set').length, 2);
  });
  await check('Fachlicher 403 erhält bestätigten Zugang; echter Sitzungsverlust sperrt', async () => {
    const f = fixture('auth', signedIn('admin')); await f.settle(); f.env.businessDenied = true;
    await f.window.fetch('/api/licensed-feature'); assert.equal(f.content.inert, false);
    f.env.status = signedOut(); await f.window.NW_AUTH.refreshStatus(); assert.equal(f.content.inert, true);
    assert.ok(f.redirects[0].includes('/login.html?returnTo='));
  });
  await check('Offline und BFCache sperren vor erneuter Bestätigung', async () => {
    const f = fixture('auth', signedIn('customer')); await f.settle();
    f.window.navigator.onLine = false; f.events.get('window:offline')(); assert.equal(f.content.inert, true);
    f.window.navigator.onLine = true; f.env.fail = true; f.events.get('window:pageshow')({ persisted: true }); await f.settle();
    assert.equal(f.content.inert, true); assert.equal(f.window.NW_AUTH.getState().statusError, true);
  });
  await check('EOS-Logout trägt CSRF und öffnet das zentrale Ziel', async () => {
    const f = fixture('auth', { ...signedIn('admin'), mode: 'eos' }); await f.settle(); await f.window.NW_AUTH.logout();
    assert.equal(f.calls.find(call => call.path === '/api/auth/logout').csrf, token); assert.equal(f.redirects.at(-1), 'https://portal.test/logout');
    assert.equal(f.messages[0].type, 'NW_AUTH_LOGOUT');
  });
  await check('EOS/Frame/HTTP/Fehlkonfiguration ohne Passwortmaske', async () => {
    const eos = fixture('login', { ...signedOut(), mode: 'eos' }); await eos.settle();
    assert.equal(eos.nodes.get('loginForm').hidden, true); assert.equal(eos.nodes.get('centralLogin').hidden, false);
    for (const options of [{ frame: true }, { url: 'http://nexowatt.test/login.html' }]) {
      const f = fixture('login', signedOut(), options); await f.settle(); assert.equal(f.nodes.get('loginForm').hidden, true);
    }
    const invalid = fixture('login', { ...signedOut(), configured: false }); await invalid.settle(); assert.equal(invalid.nodes.get('loginForm').hidden, true);
  });
  await check('Passwort exakt einmal gesendet und Formular danach geleert', async () => {
    const f = fixture('login', signedOut()); await f.settle(); const password = ' ' + crypto.randomBytes(24).toString('base64url') + ' ';
    f.nodes.get('loginUser').value = 'fixture'; f.nodes.get('loginPassword').value = password;
    await f.nodes.get('loginForm').handlers.get('submit')({ preventDefault() {} }); await f.settle();
    const logins = f.calls.filter(call => call.path === '/api/auth/login'); assert.equal(logins.length, 1);
    assert.ok(JSON.parse(logins[0].body).password === password); assert.equal(f.nodes.get('loginPassword').value, '');
  });
  await check('Sichere Rücksprünge und rollenabhängiger Einstieg', async () => {
    for (const target of ['//foreign.test/', '/api/set', '/smarthome-config.html', '/%2f%2fforeign.test/']) {
      const f = fixture('login', signedIn('customer'), { url: 'https://nexowatt.test/login.html?returnTo=' + encodeURIComponent(target) }); await f.settle(); assert.equal(f.redirects[0], '/');
    }
    // Gemeinsamer EOS-Einstieg ist für alle Rollen das Dashboard. Explizite,
    // berechtigte Installer-Rücksprünge bleiben weiterhin erhalten.
    for (const role of ['customer', 'installer', 'admin']) {
      const f = fixture('login', signedIn(role)); await f.settle(); assert.equal(f.redirects[0], '/');
    }
    const installerReturn = fixture('login', signedIn('installer'), { url: 'https://nexowatt.test/login.html?returnTo=%2Fems-apps.html' });
    await installerReturn.settle(); assert.equal(installerReturn.redirects[0], '/ems-apps.html');
    const proxy = fixture('login', signedIn('customer'), { proxy: true, url: 'https://nexowatt.test/admin/proxy/nexowatt-ui.2/login.html?returnTo=%2Fadmin%2Fproxy%2Fnexowatt-ui.3%2Fsmarthome.html' });
    await proxy.settle(); assert.equal(proxy.redirects[0], '/admin/proxy/nexowatt-ui.2/');
  });
  await check('Alle geschützten HTML-Einstiege laden Runtime und Auth vor ihrer Bedienlogik', async () => {
    const publicPages = new Set(['login.html', 'dc-station-display.html']);
    const protectedPages = fs.readdirSync(path.join(root, 'www')).filter(name => name.endsWith('.html') && !publicPages.has(name));
    assert.equal(protectedPages.length, 19, 'Neue Seiten ausdrücklich in den Seitengrenzen prüfen');
    for (const name of protectedPages) {
      const html = fs.readFileSync(path.join(root, 'www', name), 'utf8');
      const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)];
      assert.equal(scripts.filter(row => row[1] === '/static/runtime-base.js').length, 1, name + ': ein Runtime-Bootstrap');
      assert.equal(scripts.filter(row => row[1] === '/static/auth.js').length, 1, name + ': eine Sitzungsschranke');
      assert.equal(scripts[0]?.[1], '/static/runtime-base.js', name + ': Runtime zuerst');
      assert.equal(scripts[1]?.[1], '/static/auth.js', name + ': Auth vor Bedienlogik');
      assert.doesNotMatch(scripts[0][0] + scripts[1][0], /\s(?:defer|async)(?:\s|=|>)/i, name + ': Reihenfolge nicht verzögern');
    }
    const kiosk = fs.readFileSync(path.join(root, 'www/dc-station-display.html'), 'utf8');
    assert.doesNotMatch(kiosk, /src=["'][^"']*\/auth\.js["']/, 'Maschinen-/Display-Tokenvertrag bleibt unabhängig');
    const login = fs.readFileSync(path.join(root, 'www/login.html'), 'utf8');
    assert.doesNotMatch(login, /src=["'][^"']*\/auth\.js["']/, 'Login darf keine eigene Sitzungsweiterleitung auslösen');
  });
  // Normale Regressionstests verändern keine versiegelten Release-Nachweise.
  // Ein neuer Nachweis entsteht nur beim ausdrücklich angeforderten Prüflauf.
  if (process.argv.includes('--report')) {
    const directory = path.join(root, 'docs/reports/auth-profiles-2026-11-19'); fs.mkdirSync(directory, { recursive: true });
    const sources = Object.fromEntries(['scripts/verify-auth-profiles-ui.cjs', ...['auth', 'login', 'runtime-base'].map(name => `src-ts/runtime-executables/www/${name}.ts`)]
      .map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
    fs.writeFileSync(path.join(directory, 'ui-contract-evidence.json'), JSON.stringify({ timestamp: new Date().toISOString(), node: process.version, kind: 'VM/DOM/HTTP-Vertragstest, kein Browser', sources, results }, null, 2) + '\n');
  }
  console.log(`[auth-profiles-ui] ${results.length} Prüfgruppen bestanden; kein Browser-/Anlagenversuch.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
