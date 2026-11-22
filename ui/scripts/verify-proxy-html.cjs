#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * Prüft den ausgelieferten HTML-Proxy-Adapter mit temporären lokalen Dateien und
 * dem echten HTTP-Server. Ausschließlich ioBroker-Konten/-Speicher sind Fixtures;
 * keine reale Anlage, keine Zugangsdaten, kein Gerätezugriff und kein Mailversand.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { runtimeProxyPrefix, isHttpsRuntimeProxy, rewriteRuntimeProxyHtml, createRuntimeFileSender } = require('../lib/runtime-proxy-html');
const namespace = 'nexowatt-ui.0';
const prefix = '/admin/proxy/' + namespace;
const req = { headers: { 'x-forwarded-prefix': prefix } };
const checks = [];
function pass(label) { checks.push(label); }

function send(sender, request, filePath) {
  return new Promise(resolve => {
    const result = { status: 200, headers: {}, body: '', delegated: '' };
    const response = {
      sendFile(file) { result.delegated = file; resolve(result); },
      status(code) { result.status = code; return response; },
      type(value) { result.type = value; return response; },
      setHeader(key, value) { result.headers[key] = value; },
      send(body) { result.body = body; resolve(result); },
    };
    sender(request, response, filePath);
  });
}

async function verifyHelper() {
  for (const value of ['/proxy/nexowatt-ui.0', prefix, '/admin.v8/~safe-prefix/proxy/nexowatt-ui.0']) {
    assert.equal(runtimeProxyPrefix({ headers: { 'x-forwarded-prefix': value } }, namespace), value);
  }
  for (const value of [undefined, [prefix], '/admin/proxy/nexowatt-ui.1', '/admin/proxy/nexowatt-ui.00', '//admin/proxy/nexowatt-ui.0', '/./proxy/nexowatt-ui.0', '/../proxy/nexowatt-ui.0', '/a//b/proxy/nexowatt-ui.0', '/a%2fb/proxy/nexowatt-ui.0', '/a\\b/proxy/nexowatt-ui.0', '/a?b/proxy/nexowatt-ui.0', '/a#b/proxy/nexowatt-ui.0', '/a\nb/proxy/nexowatt-ui.0', '/a"b/proxy/nexowatt-ui.0', '/' + 'a'.repeat(129) + '/proxy/nexowatt-ui.0', '/' + 'a/'.repeat(17) + 'proxy/nexowatt-ui.0', '/' + 'a'.repeat(120) + '/' + 'b'.repeat(120) + '/proxy/nexowatt-ui.0']) {
    assert.equal(runtimeProxyPrefix({ headers: { 'x-forwarded-prefix': value } }, namespace), null, JSON.stringify(value));
  }
  assert.equal(isHttpsRuntimeProxy({ headers: { ...req.headers, 'x-forwarded-proto': 'https' } }, namespace), true);
  assert.equal(runtimeProxyPrefix({ headers: { 'x-forwarded-prefix': '/proxy/nexowatt-ui.1/nest/proxy/nexowatt-ui.0' } }, namespace), null);
  for (const value of ['http', 'https,http', 'HTTPS', ['https']]) assert.equal(isHttpsRuntimeProxy({ headers: { ...req.headers, 'x-forwarded-proto': value } }, namespace), false);
  assert.equal(isHttpsRuntimeProxy({ headers: { 'x-forwarded-proto': 'https' } }, namespace), false);
  pass('strict instance-bound prefix and HTTPS presentation-only hint');

  const rawScript = '<script>const x = `<a href="/unchanged">`; fetch("/api/auth");</script>';
  const rawStyle = '<style>.a{background:url("/unchanged")}</style>';
  const rawComment = '<!-- <a href="/unchanged"> -->';
  const html = '<!doctype html><html><head><link href="/static/a.css">' + rawScript + rawStyle + rawComment + '</head><body><form action="/api/login"><img src="/static/a.png"><use xlink:href="/static/s.svg#x"></use><a href="https://example.invalid/a">x</a><a href="//example.invalid/a">x</a><a href="#local">x</a><a href="/#tab-nexowatt-ui-0">Admin</a><a href="' + prefix + '/index.html">same</a></form></body></html>';
  const rewritten = rewriteRuntimeProxyHtml(html, prefix);
  for (const value of [rawScript, rawStyle, rawComment, 'href="https://example.invalid/a"', 'href="//example.invalid/a"', 'href="#local"', 'href="/admin/#tab-nexowatt-ui-0"', 'href="' + prefix + '/index.html"', 'action="' + prefix + '/api/login"', 'xlink:href="' + prefix + '/static/s.svg#x"']) assert.ok(rewritten.includes(value), value);
  assert.ok(rewritten.indexOf('/static/runtime-base.js') < rewritten.indexOf('/static/a.css'));
  assert.ok(rewritten.includes('<base href="' + prefix + '/">'));
  assert.ok(!rewriteRuntimeProxyHtml(html, prefix, false).includes('<base'));
  assert.ok(rewriteRuntimeProxyHtml('<html><link href="/first.css"></html>', prefix).indexOf('/static/runtime-base.js') < rewriteRuntimeProxyHtml('<html><link href="/first.css"></html>', prefix).indexOf('/first.css'));
  assert.throws(() => rewriteRuntimeProxyHtml(html, '/bad"/proxy/' + namespace));
  assert.throws(() => rewriteRuntimeProxyHtml('x'.repeat(2 * 1024 * 1024 + 1), prefix));
  pass('attribute-only rewriting, raw script/style/comment preservation, first bootstrap, WWW-only base');

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nw-proxy-html-'));
  try {
    const www = path.join(root, 'www');
    const react = path.join(root, 'admin', 'react');
    await fs.mkdir(www); await fs.mkdir(react, { recursive: true });
    const file = path.join(www, 'index.html');
    await fs.writeFile(file, html);
    await fs.writeFile(path.join(react, 'index.html'), '<html><head><script src="./assets/a.js"></script></head></html>');
    await fs.writeFile(path.join(root, 'outside.html'), html);
    await fs.symlink(path.join(root, 'outside.html'), path.join(www, 'outside.html'));
    await fs.writeFile(path.join(www, 'oversize.html'), 'x'.repeat(2 * 1024 * 1024 + 1));
    await fs.mkdir(path.join(www, 'directory.html'));
    const sender = createRuntimeFileSender(root, namespace);
    const direct = await send(sender, { headers: {} }, file);
    assert.equal(direct.delegated, file);
    assert.equal((await send(sender, req, path.join(www, 'asset.js'))).delegated, path.join(www, 'asset.js'));
    const result = await send(sender, req, file);
    assert.equal(result.status, 200); assert.equal(result.body, rewritten);
    assert.equal(result.headers['Cache-Control'], 'no-store');
    assert.equal(result.headers.Vary, 'X-Forwarded-Prefix');
    assert.ok(!(await send(sender, req, path.join(react, 'index.html'))).body.includes('<base'));
    for (const rejected of [path.join(root, 'outside.html'), path.join(www, 'outside.html'), path.join(www, 'oversize.html'), path.join(www, 'missing.html'), path.join(www, 'directory.html')]) {
      const failure = await send(sender, req, rejected);
      assert.equal(failure.status, 500); assert.equal(failure.body, 'HTML-Auslieferung nicht verfügbar.');
    }
    const burst = Array.from({ length: 17 }, () => send(sender, req, file));
    const results = await Promise.all(burst);
    assert.equal(results.filter(value => value.status === 503).length, 1);
    assert.equal(results.filter(value => value.status === 200).length, 16);
    pass('bounded actual file reads, canonical path containment, symlink/directory rejection, concurrency cap and direct delivery');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}

async function verifyHttp() {
  const { createHarness } = require('./verify-stable-1.0.9-access.cjs');
  const h = await createHarness();
  const request = async (url, { token, headers = {}, method = 'GET', body, proxy = true } = {}) => {
    const response = await fetch(h.base + url, { method, redirect: 'manual', signal: AbortSignal.timeout(5000), headers: {
      ...(proxy ? req.headers : {}), ...(token ? { Cookie: h.cookieHeader(token) } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers,
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const text = await response.text(); let data; try { data = JSON.parse(text); } catch {}
    return { response, status: response.status, text, data };
  };
  try {
    for (const url of ['/ems-apps.html', '/ems/dynamic-grid/', '/mail-setup/']) {
      const denied = await request(url);
      assert.equal(denied.status, 303, url);
      assert.equal(denied.response.headers.get('location'), prefix + '/login.html?returnTo=' + encodeURIComponent(prefix + url.replace(/\/$/, '')), url);
      assert.ok(!denied.text.includes('private-fixture-'));
    }
    const loginPage = await request('/login.html');
    assert.equal(loginPage.status, 200); assert.ok(loginPage.text.includes(prefix + '/static/runtime-base.js'));
    assert.ok(!loginPage.text.includes('private-fixture-'));
    pass('real HTTP protected WWW and React pages stay locked without EOS session');
    const proxyLogin = await request('/api/strict-auth/login', { method: 'POST', headers: { 'x-forwarded-proto': 'https' }, body: { user: 'admin', password: h.testPassword } });
    assert.equal(proxyLogin.status, 200, proxyLogin.text);
    const cookie = proxyLogin.response.headers.get('set-cookie');
    assert.match(cookie, /;\s*Secure(?:;|$)/i); assert.match(cookie, /;\s*HttpOnly(?:;|$)/i);
    const token = h.tokenOf(proxyLogin);
    const directLogin = await request('/api/strict-auth/login', { proxy: false, method: 'POST', body: { user: 'admin', password: h.testPassword } });
    assert.equal(directLogin.status, 200); assert.doesNotMatch(directLogin.response.headers.get('set-cookie'), /;\s*Secure(?:;|$)/i);
    const forgedIdentity = await request('/api/strict-auth/status', { headers: { 'x-forwarded-user': 'admin', 'x-forwarded-proto': 'https' } });
    assert.equal(JSON.parse(forgedIdentity.text).authed, false);
    pass('proxied HTTPS adds Secure/HttpOnly; direct HTTP preserved; forwarded identity grants nothing');
    const page = await request('/ems-apps.html', { token });
    assert.equal(page.status, 200); assert.ok(page.text.includes(prefix + '/static/runtime-base.js'));
    const direct = await request('/ems-apps.html', { token, proxy: false });
    assert.equal(direct.status, 200); assert.ok(!direct.text.includes(prefix));
    const react = await request('/ems/dynamic-grid/', { token });
    assert.equal(react.status, 200); assert.ok(react.text.includes(prefix + '/static/runtime-base.js')); assert.ok(!react.text.includes('<base'));
    assert.equal((await request('/ems/dynamic-grid', { token })).status, 301);
    for (const url of ['/static/ems-apps.html', '/static/%65ms-apps.html']) {
      const anonymous = await request(url);
      assert.equal(anonymous.status, 303, url);
      assert.equal(anonymous.response.headers.get('location'), prefix + '/login.html?returnTo=' + encodeURIComponent(prefix + '/static/ems-apps.html'));
      const redirect = await request(url, { token });
      assert.equal(redirect.status, 302, url); assert.equal(redirect.response.headers.get('location'), '/ems-apps.html');
    }
    pass('authorized WWW/React rendering, direct route regression, canonical slash and protected static redirect');
    h.adapter._nwLicenseOk = false;
    h.adapter._nwLicenseInfo = { ok: false };
    const bootstrap = await request('/static/runtime-base.js');
    assert.equal(bootstrap.status, 200); assert.ok(bootstrap.text.includes('NW_RUNTIME'));
    const licensedData = await request('/api/license/info');
    assert.equal(licensedData.status, 401); assert.ok(!licensedData.text.includes('private-fixture-'));
    pass('unlicensed setup loads only public path bootstrap and still denies license data');
  } finally { await h.close(); }
}

/** Echter Login-Returnhandler: Instanzpräfix erhalten, Fremdziel/Fachrolle abweisen. */
async function verifyLoginReturnTargets() {
  const ts = require('typescript');
  const vm = require('node:vm');
  const filename = path.join(__dirname, '../src-ts/runtime-executables/www/login.ts');
  const source = await fs.readFile(filename, 'utf8');
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.ES2022, true);
  let handler;
  const visit = node => { if (ts.isFunctionDeclaration(node) && node.name?.text === 'returnTarget') handler = node.getText(ast); ts.forEachChild(node, visit); };
  visit(ast); assert.ok(handler, 'actual login return-target handler');
  const compiled = ts.transpileModule(handler, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const location = { origin: 'https://fixture.invalid', search: '' };
  const context = vm.createContext({ URL, URLSearchParams, window: { location }, rootPath: () => prefix + '/' });
  vm.runInContext(compiled, context);
  const target = (requested, role = 'admin', capabilities = ['*']) => {
    location.search = '?returnTo=' + encodeURIComponent(requested);
    return context.returnTarget({ role, capabilities });
  };
  assert.equal(target(prefix + '/ems/dynamic-grid'), prefix + '/ems/dynamic-grid');
  assert.equal(target(prefix + '/ems/dynamic-grid/', 'installer'), prefix + '/ems/dynamic-grid/');
  assert.equal(target(prefix + '/mail-setup/#/notification-mail'), prefix + '/mail-setup/#/notification-mail');
  assert.equal(target(prefix + '/smarthome.html?external=https://foreign.invalid/', 'customer', ['frontend.open']), prefix + '/smarthome.html');
  for (const requested of [prefix + '/api/set', '/admin/proxy/nexowatt-ui.1/smarthome.html', '//foreign.invalid/', prefix + '/%2f%2fforeign.invalid/']) {
    assert.equal(target(requested, 'customer', ['frontend.open']), prefix + '/', requested);
  }
  assert.equal(target(prefix + '/smarthome-config.html', 'customer', ['*']), prefix + '/');
  assert.equal(target(prefix + '/license.html', 'installer', ['*']), prefix + '/ems-apps.html');
  pass('actual login handler preserves proxy deep links, strips free queries and denies foreign instances/API/forbidden roles');
}

(async () => {
  await verifyHelper();
  await verifyHttp();
  await verifyLoginReturnTargets();
  console.log('[proxy HTML] PASS ' + checks.length + ' groups: ' + checks.join('; '));
})().catch(error => { console.error(error); process.exitCode = 1; });
