/**
 * Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Aufgabe: Offiziellen Admin-8.3.5-Proxy mit echten lokalen EOS-HTTP-Routen verbinden.
 * Grenze: Synthetische Admin-/ioBroker-Sitzungen; keine laufende Admininstallation.
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
const { createHarness } = fromRepo('./scripts/verify-stable-1.0.9-access.cjs');
const upstreamPath = process.env.NEXOWATT_ADMIN_PROXY_SOURCE || path.join(__dirname, 'admin8-v8.3.5-instanceProxy.ts');
const upstream = fs.readFileSync(upstreamPath, 'utf8');
const upstreamSha256 = crypto.createHash('sha256').update(upstream).digest('hex');
assert.equal(upstreamSha256, 'ccfd3fcab5466e24166e938dca305a67d8741a0bb85eea027a4b328b9f9b35d2');
const compiled = ts.transpileModule(upstream, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const proxyModule = new Module(upstreamPath, module);
proxyModule.filename = upstreamPath;
proxyModule.paths = Module._nodeModulePaths(root);
proxyModule._compile(compiled, upstreamPath);
const { InstanceProxy } = proxyModule.exports;
const checks = [];
const pass = name => { checks.push(name); console.log('PASS ' + name); };

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-proxy-tls-'));
  let server;
  let h;
  try {
    fs.chmodSync(tmp, 0o700);
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(tmp, 'key.pem'), '-out', path.join(tmp, 'cert.pem'), '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' });
    const cert = fs.readFileSync(path.join(tmp, 'cert.pem'));
    h = await createHarness();
    const password = h.addAccount('nexowatt');
    h.groups.get('system.group.administrator').common.members.push('system.user.nexowatt');
    const backendPort = h.adapter.server.address().port;
    const adminToken = crypto.randomBytes(32).toString('hex');
    const nonAdminToken = crypto.randomBytes(32).toString('hex');
    const adminCookies = `access_token=${adminToken}`;
    const fixtureAdapter = {
      host: 'test-host', config: { auth: true, defaultUser: 'system.user.none', secure: true },
      log: { debug() {}, warn() {} },
      getSession(key, callback) {
        callback(key === `a:${adminToken}` ? { user: 'system.user.proxy_operator', aExp: Date.now() + 60000 }
          : key === `a:${nonAdminToken}` ? { user: 'system.user.proxy_customer', aExp: Date.now() + 60000 } : null);
      },
      async getForeignObjectAsync(id) {
        if (id === 'system.group.administrator') return { common: { members: ['system.user.proxy_operator'] } };
        if (id === 'system.adapter.nexowatt-ui.0') return { type: 'instance', common: { host: 'test-host', adminTab: { proxy: true } }, native: { bind: '127.0.0.1', port: backendPort, secure: false } };
        if (id === 'system.adapter.nexowatt-ui.1') return { type: 'instance', common: { host: 'test-host', adminTab: { proxy: false } }, native: { bind: '127.0.0.1', port: backendPort, secure: false } };
        return null;
      },
    };
    const officialProxy = new InstanceProxy(fixtureAdapter, '/admin/');
    const app = express();
    app.use(officialProxy.hideAuthorization);
    app.use(officialProxy.handleRequest);
    app.use((_req, res) => res.status(404).send('Not Found'));
    server = https.createServer({ key: fs.readFileSync(path.join(tmp, 'key.pem')), cert }, app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `https://127.0.0.1:${server.address().port}`;
    const prefix = '/admin/proxy/nexowatt-ui.0';
    const request = (pathname, { method = 'GET', body, cookie = adminCookies, testOrigin = origin } = {}) => new Promise((resolve, reject) => {
      const data = body === undefined ? undefined : JSON.stringify(body);
      const req = https.request(origin + pathname, { method, ca: cert, rejectUnauthorized: true, agent: false, headers: { ...(cookie ? { Cookie: cookie } : {}), Origin: testOrigin, ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}) } }, res => {
        const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8'); let json; try { json = JSON.parse(text); } catch {}
          resolve({ status: res.statusCode, headers: res.headers, json, text });
        });
      });
      req.setTimeout(5000, () => req.destroy(new Error('fixture request timeout'))); req.on('error', reject); req.end(data);
    });
    let result = await request(prefix + '/api/strict-auth/status');
    assert.equal(result.status, 200); assert.equal(result.json.authed, false);
    pass('HTTPS Admin proxy reaches HTTP EOS status on configured backend port and public subpath');
    result = await request(prefix + '/api/strict-auth/login', { method: 'POST', body: { user: 'nexowatt', password } });
    assert.equal(result.status, 200, result.text); assert.equal(result.json.user, 'nexowatt'); assert.equal(result.json.role, 'admin');
    const cookies = result.headers['set-cookie']; assert.equal(cookies.length, 2);
    for (const cookie of cookies) { assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/); assert.match(cookie, /; Secure(?:;|$)/); assert.ok(cookie.includes(`Path=${prefix}/`)); }
    const sessionCookie = adminCookies + '; ' + cookies.map(cookie => cookie.split(';')[0]).join('; ');
    pass('Own-account password produces canonical EOS admin session and path-isolated HttpOnly Secure SameSite cookies');
    result = await request(prefix + '/api/strict-auth/status', { cookie: sessionCookie });
    assert.equal(result.status, 200); assert.equal(result.json.authed, true); assert.equal(result.json.user, 'nexowatt');
    result = await request(prefix + '/api/license/info', { cookie: sessionCookie });
    assert.equal(result.status, 200);
    pass('Same proxy cookie remains valid for status and protected license API');
    result = await request(prefix + '/api/strict-auth/login', { method: 'POST', body: { user: 'nexowatt', password: crypto.randomBytes(32).toString('hex') } });
    assert.equal(result.status, 401); assert.equal(result.json.error, 'unauthorized'); assert.equal(result.headers['set-cookie'], undefined);
    pass('Wrong EOS password remains JSON 401 and creates no session');
    result = await request(prefix + '/api/strict-auth/status', { cookie: '' });
    assert.equal(result.status, 401); assert.equal(result.text, 'Unauthorized'); assert.equal(result.json, undefined);
    pass('Missing Admin session is separate proxy text 401');
    result = await request(prefix + '/api/strict-auth/status', { cookie: `access_token=${nonAdminToken}` });
    assert.equal(result.status, 403); assert.equal(result.text, 'Forbidden'); assert.equal(result.json, undefined);
    pass('Admin proxy denies non-Administrator independently of EOS login');
    result = await request('/admin/proxy/nexowatt-ui.1/api/strict-auth/status');
    assert.equal(result.status, 404); assert.equal(result.text, 'Not Found');
    pass('Instance without explicit adminTab.proxy opt-in remains inaccessible');
    result = await request(prefix + '/api/strict-auth/login', { method: 'POST', body: { user: 'nexowatt', password }, testOrigin: 'https://foreign.invalid' });
    assert.equal(result.status, 403); assert.equal(result.json.error, 'origin_forbidden');
    pass('EOS rejects foreign Origin even when request passes authenticated Admin proxy');
    h.groups.get('system.group.administrator').common.members = ['system.user.admin'];
    result = await request(prefix + '/api/strict-auth/status', { cookie: sessionCookie });
    assert.equal(result.status, 200); assert.equal(result.json.authed, false);
    pass('EOS role removal revokes session while separate Admin proxy session remains valid');
    const report = { result: 'PASS', checks: checks.length, cases: checks, node: process.version, officialProxyVersion: '8.3.5', officialProxySha256: upstreamSha256, tls: 'TLS certificate verified against explicit ephemeral test CA; no rejectUnauthorized bypass', scope: 'Official InstanceProxy source with synthetic Admin DB/session, actual EOS runtime HTTP routes; no complete Admin installation or customer hardware' };
    fs.writeFileSync(path.join(__dirname, 'official-admin-proxy-results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (h) await h.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
main().catch(error => {
  fs.writeFileSync(path.join(__dirname, 'official-admin-proxy-results.json'), JSON.stringify({ result: 'FAIL', checks: checks.length, cases: checks, node: process.version, officialProxyVersion: '8.3.5', officialProxySha256: upstreamSha256, failure: String(error.message || error).slice(0, 600) }, null, 2) + '\n');
  console.error(error); process.exitCode = 1;
});
