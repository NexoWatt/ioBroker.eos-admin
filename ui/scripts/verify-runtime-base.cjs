/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft den echten Browser-Bootstrap ohne Netzwerk oder Kundenzugangsdaten.
 * Wirkung: Kompiliert die strikte TS-Quelle und führt sie isoliert mit nativen
 * Request-/URL-Objekten aus; prüft Proxygrenzen, Body/Signal und Navigationsverträge.
 * Grenze: Der separate HTTPS-Browsertest prüft zusätzlich Original-Admin-Proxy,
 * HTML-Reihenfolge und reale Seiten. Diese Prüfung ersetzt keinen Anlagenbetrieb.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'src-ts/runtime-executables/www/runtime-base.ts');
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.runtime-base.json'], { cwd: root, stdio: 'pipe' });
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
let checks = 0;
function check(name, fn) { fn(); checks += 1; }
function boot(pathname, options = {}) {
  const origin = options.origin || 'https://eos.example.test:8443';
  const calls = [];
  const nativeFetch = async (input, init) => { calls.push({ input, init }); return new Response('{}'); };
  const location = { pathname, origin, href: origin + pathname + (options.search || ''), search: options.search || '' };
  const window = { location, fetch: nativeFetch };
  const document = { baseURI: options.baseURI || location.href };
  const context = vm.createContext({ window, document, Request, Response, URL });
  vm.runInContext(compiled, context, { filename: 'runtime-base.js', timeout: 1000 });
  return { window, calls, nativeFetch, api: window.NW_RUNTIME, reload: () => vm.runInContext(compiled, context, { timeout: 1000 }) };
}
function functionBody(file, name) {
  const code = fs.readFileSync(path.join(root, file), 'utf8');
  const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
  let found;
  const visit = node => { if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(sf); ts.forEachChild(node, visit); };
  visit(sf); assert.ok(found, 'Missing real source function: ' + name);
  return ts.transpileModule(found + '\nresult = ' + name + '();', { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
}
async function main() {
  check('Every actual WWW TypeScript source emits syntactically valid JavaScript', () => {
    for (const file of fs.readdirSync(path.join(root, 'src-ts/runtime-executables/www')).filter(f => f.endsWith('.ts'))) {
      const text = fs.readFileSync(path.join(root, 'src-ts/runtime-executables/www', file), 'utf8');
      const javascript = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
      new vm.Script(javascript, { filename: file });
    }
  });
  const b = boot('/admin/proxy/nexowatt-ui.2/ems-apps.html', { search: '?instance=9&adminUrl=https://foreign.example' });
  const p = '/admin/proxy/nexowatt-ui.2';
  check('Proxy context comes from actual path', () => {
    assert.equal(b.api.isProxy, true); assert.equal(b.api.instance, '2');
    assert.equal(b.api.adminBase(), 'https://eos.example.test:8443/admin/');
    assert.equal(b.api.pathname(), '/ems-apps.html');
  });
  check('Known runtime navigation/assets/API keep prefix and query/hash', () => {
    for (const value of ['/', '/api/auth/login', '/api/state', '/config', '/events', '/static/styles.css', '/static/assets/logo.svg', '/assets/logo.svg', '/ems-apps.html?nwAdmin=1', '/simulation.html', '/smarthome-config.html', '/ledger/energy-origin', '/ems/arbitrage/?instance=2#/arbitrage', '/ems/dynamic-grid/?instance=2#/dynamic-grid', '/ems/microgrid/?instance=2#/mesh-coordinator']) {
      assert.equal(b.api.url(value), p + value, value);
    }
    assert.equal(b.api.url('https://eos.example.test:8443/api/auth/me'), 'https://eos.example.test:8443' + p + '/api/auth/me');
  });
  check('Already scoped, relative and foreign URLs remain unchanged', () => {
    for (const value of [p + '/api/auth/me', 'history.html', './static/app.js', '#overview', '/admin/adapter/nexowatt-ui/tab.html', '/oauth/token', '/api-foreign', '//foreign.example/api/auth/login', 'https://foreign.example/api/auth/login', 'https://user@eos.example.test:8443/api/auth/login', 'http://eos.example.test:8443/api/auth/login', 'https://eos.example.test/api/auth/login', 'data:text/plain,test', 'blob:https://eos.example.test:8443/test', '/\\foreign.example/api/auth/login']) assert.equal(b.api.url(value), value, value);
  });
  check('Admin hash uses public prefix and TLS port', () => assert.equal(b.api.url('/#tab-nexowatt-ui-2'), 'https://eos.example.test:8443/admin/#tab-nexowatt-ui-2'));
  check('Helper is immutable and second execution does not wrap twice', () => {
    assert.equal(Object.isFrozen(b.api), true);
    const fetch = b.window.fetch; b.reload(); assert.equal(b.window.fetch, fetch);
    assert.equal(Object.getOwnPropertyDescriptor(b.window, 'NW_RUNTIME').writable, false);
  });
  check('Root and nested public mounts support bounded punctuation', () => {
    for (const mount of ['', '/admin', '/eos.v1/~tenant/a_b-c', '/' + Array(16).fill('a').join('/')]) {
      const x = boot(mount + '/proxy/nexowatt-ui.999999/'); assert.equal(x.api.isProxy, true);
      assert.equal(x.api.pathname(), '/'); assert.equal(x.api.adminBase(), 'https://eos.example.test:8443' + mount + '/');
    }
  });
  check('Malformed and oversized prefixes cannot activate transport', () => {
    for (const pathname of ['/api/state', '//admin/proxy/nexowatt-ui.0/', '/./proxy/nexowatt-ui.0/', '/../proxy/nexowatt-ui.0/', '/%61dmin/proxy/nexowatt-ui.0/', '/admin\\test/proxy/nexowatt-ui.0/', '/admin/proxy/nexowatt-ui.01/', '/admin/proxy/nexowatt-ui.-1/', '/admin/proxy/nexowatt-ui.1000000/', '/admin/proxy/nexowatt-ui.2evil/', '/' + 'a'.repeat(129) + '/proxy/nexowatt-ui.0/', '/' + 'a'.repeat(125) + '/' + 'b'.repeat(125) + '/proxy/nexowatt-ui.0/', '/' + Array(17).fill('a').join('/') + '/proxy/nexowatt-ui.0/', '/' + 'a'.repeat(4097)]) {
      const x = boot(pathname, { search: '?nwRuntimeBase=https://foreign.example&instance=9' }); assert.equal(x.api.isProxy, false, pathname); assert.equal(x.window.fetch, x.nativeFetch); assert.equal(x.api.url('/api/auth/login'), '/api/auth/login');
    }
  });
  check('Direct runtime stays byte-for-byte transport compatible', () => {
    const x = boot('/settings.html', { origin: 'http://localhost:8188' }); assert.equal(x.window.fetch, x.nativeFetch); assert.equal(x.api.url('/'), '/'); assert.equal(x.api.instance, null);
  });
  check('Repeated namespace markers cannot select a different proxy instance', () => {
    const x = boot('/proxy/nexowatt-ui.1/nest/proxy/nexowatt-ui.2/index.html');
    assert.equal(x.api.isProxy, false); assert.equal(x.api.instance, null); assert.equal(x.window.fetch, x.nativeFetch);
  });
  const controller = new AbortController();
  const init = { method: 'POST', body: JSON.stringify({ fixture: 'synthetic' }), credentials: 'same-origin', headers: { 'content-type': 'application/json' }, signal: controller.signal };
  await b.window.fetch('/api/auth/login', init);
  check('Fetch string preserves init identity, body, credentials and signal', () => { assert.equal(b.calls.at(-1).input, p + '/api/auth/login'); assert.equal(b.calls.at(-1).init, init); });
  const url = new URL('https://eos.example.test:8443/api/auth/me');
  await b.window.fetch(url);
  check('Fetch URL maps same-origin runtime only', () => assert.equal(b.calls.at(-1).input, 'https://eos.example.test:8443' + p + '/api/auth/me'));
  const original = new Request('https://eos.example.test:8443/api/auth/login', init);
  const originalBody = await original.clone().text();
  const overrides = { cache: 'no-store' };
  await b.window.fetch(original, overrides);
  const mapped = b.calls.at(-1).input;
  check('Fetch Request keeps all original request options and explicit overrides', () => {
    assert.ok(mapped instanceof Request); assert.equal(mapped.url, 'https://eos.example.test:8443' + p + '/api/auth/login');
    assert.equal(mapped.method, 'POST'); assert.equal(mapped.headers.get('content-type'), 'application/json'); assert.equal(mapped.credentials, 'same-origin'); assert.equal(b.calls.at(-1).init, overrides);
  });
  assert.equal(await mapped.text(), originalBody); checks += 1;
  controller.abort(); assert.equal(mapped.signal.aborted, true); checks += 1;
  for (const input of [new Request('https://foreign.example/api/auth/login'), new URL('https://foreign.example/api/auth/login'), 'https://foreign.example/api/auth/login']) {
    await b.window.fetch(input, overrides); assert.equal(b.calls.at(-1).input, input); assert.equal(b.calls.at(-1).init, overrides);
  } checks += 1;
  check('Real frontend Admin-back functions choose validated path instance, not query host', () => {
    for (const [file, name] of [['admin-guard.ts', 'adminUrl'], ['license.ts', 'resolveAdminBackUrl'], ['ems-apps.ts', 'getInstallerAdminUrl']]) {
      const ctx = { window: b.window, result: undefined, URLSearchParams, URL }; vm.runInNewContext(functionBody('src-ts/runtime-executables/www/' + file, name), ctx); assert.equal(ctx.result, 'https://eos.example.test:8443/admin/#tab-nexowatt-ui-2', file);
    }
  });
  check('Actual auth gateway opens only the path-bound login page; query host never selects its destination', () => {
    const redirects = [], links = [];
    const window = { ...b.window, location: { ...b.window.location, hash: '', replace: value => redirects.push(value) } };
    window.self = window; window.top = window;
    const ctx = { window, result: undefined, URL, state: { _loaded: true, statusError: false, mode: 'iobroker' }, redirecting: false,
      runtimeRoot: () => b.api.url('/'), lockCount: 0, lockPage() { ctx.lockCount++; },
      document: { createElement: tag => ({ tag }), querySelector: () => ({ appendChild: node => links.push(node) }) } };
    const gateway = functionBody('src-ts/runtime-executables/www/auth.ts', 'showLogin');
    vm.runInNewContext(gateway, ctx);
    assert.equal(ctx.lockCount, 1); assert.equal(redirects.length, 1);
    const target = new URL(redirects[0]);
    assert.equal(target.origin, window.location.origin); assert.equal(target.pathname, p + '/login.html');
    assert.equal(target.searchParams.get('returnTo'), window.location.pathname + window.location.search);
    assert.equal(links.length, 0);
    redirects.length = 0; ctx.redirecting = false; window.top = {};
    vm.runInNewContext(gateway, ctx);
    assert.equal(redirects.length, 0); assert.equal(links.length, 1);
    assert.equal(new URL(links[0].href).pathname, p + '/login.html');
    assert.equal(links[0].target, '_blank'); assert.equal(links[0].rel, 'noopener noreferrer');
    for (const bad of [{ _loaded: false }, { statusError: true }, { mode: null }]) {
      Object.assign(ctx.state, { _loaded: true, statusError: false, mode: 'iobroker' }, bad);
      ctx.redirecting = false; const count = links.length;
      vm.runInNewContext(gateway, ctx);
      assert.equal(links.length, count); assert.equal(redirects.length, 0, 'unconfirmed status must not navigate');
    }
  });
  check('All seven real EventSource constructors use mapped URL explicitly', () => {
    let eventSources = 0;
    for (const file of fs.readdirSync(path.join(root, 'src-ts/runtime-executables/www')).filter(f => f.endsWith('.ts'))) {
      const text = fs.readFileSync(path.join(root, 'src-ts/runtime-executables/www', file), 'utf8');
      const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      const visit = node => { if (ts.isNewExpression(node) && node.expression.getText(sf) === 'EventSource') { eventSources += 1; const arg = node.arguments[0].getText(sf); const value = vm.runInNewContext(arg, { window: b.window }); assert.equal(value, p + '/events', file); } ts.forEachChild(node, visit); }; visit(sf);
    }
    assert.equal(eventSources, 7);
  });
  check('Six shared PWA entries preserve the real direct/proxy/iframe boundary', () => {
    const entries = [];
    for (const file of fs.readdirSync(path.join(root, 'www')).filter(f => f.endsWith('.html'))) {
      const html = fs.readFileSync(path.join(root, 'www', file), 'utf8');
      assert.ok(!html.includes('serviceWorker.register('), file + ': no bypass of shared PWA policy');
      if (html.includes('src="/static/pwa.js"')) {
        entries.push(file);
        const runtime = html.indexOf('src="/static/runtime-base.js"');
        assert.ok(runtime >= 0 && runtime < html.indexOf('src="/static/pwa.js"'), file);
      }
    }
    assert.deepEqual(entries.sort(), ['energy-ledger.html', 'history.html', 'index.html', 'login.html', 'settings.html', 'storagefarm.html']);
    const text = fs.readFileSync(path.join(root, 'src-ts/runtime-executables/www/pwa.ts'), 'utf8');
    const javascript = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
    const run = (pathname, options = {}) => {
      const direct = boot(pathname, { origin: options.origin || 'https://eos.example.test:8443' });
      const calls = [];
      const window = Object.assign(direct.window, { isSecureContext: true, addEventListener() {}, setTimeout() { return 1; }, clearTimeout() {} });
      window.self = window; window.top = options.iframe ? {} : window;
      const navigator = { onLine: true, serviceWorker: { register(url, config) { calls.push({ url, config }); return Promise.resolve({ update: async () => {} }); } } };
      vm.runInNewContext(javascript, { window, navigator, document: { hidden: false, addEventListener() {} }, URL, performance: { now: () => 0 } }, { timeout: 1000 });
      return calls;
    };
    const calls = run('/login.html');
    assert.equal(calls.length, 1); assert.equal(calls[0].url, 'https://eos.example.test:8443/sw.js');
    assert.equal(calls[0].config.scope, 'https://eos.example.test:8443/'); assert.equal(calls[0].config.updateViaCache, 'none');
    for (const pathname of ['/proxy/nexowatt-ui.0/login.html', '/admin/proxy/nexowatt-ui.2/index.html']) assert.equal(run(pathname).length, 0);
    assert.equal(run('/login.html', { iframe: true }).length, 0);
    assert.equal(run('/login.html', { origin: 'http://eos.example.test:8188' }).length, 0);
  });
  console.log('[runtime-base] PASS ' + checks + ' groups: strict TS, prefix bounds, navigation, native Request/body/signal, 7 EventSource, 6 shared PWA entries with executed origin boundaries.');
}
main().catch(error => { console.error('[runtime-base] FAIL:', error.message); process.exitCode = 1; });
