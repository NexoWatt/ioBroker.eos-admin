/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
// Independent kiosk review using real Web.mountUnifiedRuntime, UnifiedSessions, OAuth model and session-security
// boundary with an in-memory controller. The UI process factory is an explicit
// in-process test seam: actual hosted routes/SSE remain real, while fake controller
// sessions and the deterministic idle clock stay in this fixture. Child isolation
// is covered by eos-ui-process*.test.cjs. No live controller or device is contacted.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const http = require('node:http');
const { createRequire, stripTypeScriptTypes } = require('node:module');
const express = require('express');
const emitted = process.env.EOS_TEST_RUNTIME === 'build';
const { EosSessionSecurity } = require(emitted ? '../build/lib/eosSessionSecurity' : '../src/lib/eosSessionSecurity');
const { UnifiedSessions } = require(emitted ? '../build/lib/eosUnifiedBoundary' : '../src/lib/eosUnifiedBoundary');
const root = path.resolve(__dirname, '..');
const clone = value => structuredClone(value);
const modelSource = fs.readFileSync(path.join(__dirname, 'fixtures/oauth2-model-v1.4.0.ts'), 'utf8');
const upstream = import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(modelSource, { mode: 'transform' })
    .replace("import 'oauth2-server';", '')).toString('base64')}`);

function loadWeb(dataDir) {
    const file = path.join(root, emitted ? 'build/lib/web.js' : 'src/lib/web.ts');
    const localRequire = createRequire(file);
    const source = fs.readFileSync(file, 'utf8');
    const code = emitted ? source : require('typescript').transpileModule(source, {
        compilerOptions: { target: 9, module: 1, esModuleInterop: true },
    }).outputText;
    const exportsValue = {};
    vm.runInNewContext(code, {
        exports: exportsValue, module: { exports: exportsValue }, __dirname: path.dirname(file), __filename: file,
        Buffer, URL, Error, console, process, setTimeout, clearTimeout,
        require(name) {
            if (name === './eosSplitRuntime') return {
                createEosSplitRuntime(adapter, bridge) {
                    const runtime = localRequire(path.join(root, 'ui/main.js')).createHostedRuntime(adapter, bridge);
                    // The real hosted shell deduplicates both in-process fixture starts.
                    return Object.assign(runtime, { startEms: () => runtime.start() });
                },
            };
            if (name === '@iobroker/adapter-core') return {
                EXIT_CODES: { ADAPTER_REQUESTED_TERMINATION: 11 }, I18n: {},
                controllerDir: path.join(root, 'node_modules/iobroker.js-controller'), getAbsoluteInstanceDataDir: () => dataDir,
            };
            if (!emitted && name.startsWith('.') && fs.existsSync(path.resolve(path.dirname(file), `${name}.ts`))) {
                return require('tsx/cjs/api').require(path.resolve(path.dirname(file), `${name}.ts`), file);
            }
            return localRequire(name);
        },
    }, { filename: file, timeout: 5000 });
    return exportsValue.default;
}

async function fixture(t) {
    const configuration = new Map();
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-idle-http-'));
    let clock = 0;
    let issued = 0;
    const writes = [];
    const sessions = new Map();
    const user = { _id: 'system.user.operator', type: 'user',
        common: { enabled: true, password: 'fixture-password-hash' },
        native: { nexowattEosAccount: { passwordInitialized: true } } };
    const group = { _id: 'system.group.administrator', type: 'group',
        common: { name: 'Administrators', members: [user._id], acl: {} } };
    const instance = { _id: 'system.adapter.eos-admin.0', type: 'instance',
        common: { enabled: true }, native: { auth: true, secure: false, port: 8188, eosUi: {} } };
    const owner = {
        namespace: 'eos-admin.0', instance: 0, config: instance.native,
        log: { error() {}, warn() {}, info() {}, debug() {} }, setTimeout, clearTimeout,
        getSession(id, callback) { callback(sessions.has(id) ? clone(sessions.get(id)) : null); },
        setSession(id, _ttl, value, callback) { sessions.set(id, clone(value)); callback?.(null); },
        destroySession(id, callback) { sessions.delete(id); callback?.(); return Promise.resolve(); },
        checkPassword(name, pass, callback) { callback(name === 'operator' && pass === 'fixture-passphrase', `system.user.${name}`); },
        getForeignObjectAsync: async id => clone(id === instance._id ? instance : id === user._id ? user : configuration.get(id) || null),
        setForeignObjectAsync: async (id, value) => { configuration.set(id, clone(value)); },
        getObjectViewAsync: async (_design, type) => ({ rows: type === 'group' ? [{ id: group.common.name, value: clone(group) }] : [] }),
        getForeignStateAsync: async () => null,
        setForeignStateAsync: async (...args) => { writes.push(args); },
        eosLicenseService: { statusView: () => ({ valid: true, coreEnabled: true,
            edition: 'pro', features: [], limits: { chargePoints: 50, batteries: 10 } }) },
        eosOwnership: { canWrite: () => false, status: () => ({ allowed: false }) },
    };
    const security = new EosSessionSecurity(owner, { now: () => clock });
    owner.eosSessionSecurity = security;
    const model = new (await upstream).OAuth2Model(owner, { noBasicAuth: true });
    security.bindOAuthModel(model);
    const Web = loadWeb(dataDir);
    const app = express();
    app.use(express.json({ limit: '4kb' }));
    const web = Object.assign(Object.create(Web.prototype), {
        baseDir: root, server: { app }, adapter: owner,
        settings: { secure: false, auth: true }, systemRequests: new WeakSet(),
    });
    const unified = new UnifiedSessions(owner, {
        secure: false, externalOrigin: '',
        resolveAccess: req => web.getEosRequestAccess(req),
        firstLogin: (id, role) => web.getEosFirstLoginPasswordState(id, role),
        getLicense: () => owner.eosLicenseService.statusView(),
    });
    web.unified = unified;
    await web.mountUnifiedRuntime();
    app.use((_req, res) => res.status(404).end());
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    t.after(async () => {
        security.stop();
        await owner.eosHostedRuntime.stop();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        fs.rmSync(dataDir, { recursive: true, force: true });
    });
    const issue = async () => {
        const identity = await model.getUser('operator', 'fixture-passphrase');
        assert.ok(identity);
        const n = String(++issued).padStart(4, '0');
        const token = { accessToken: `access-${n}-${'a'.repeat(40)}`, refreshToken: `refresh-${n}-${'r'.repeat(40)}`,
            accessTokenExpiresAt: new Date(Date.now() + 3_600_000), refreshTokenExpiresAt: new Date(Date.now() + 7_200_000) };
        await model.saveToken(token, { id: 'ioBroker' }, identity);
        return token;
    };
    const request = async (url, token, options = {}) => {
        const response = await fetch(origin + url, { redirect: 'manual', signal: AbortSignal.timeout(5000),
            ...options, headers: {
                ...(token ? { Cookie: `access_token=${token.accessToken}` } : {}),
                ...(options.body !== undefined ? { Origin: origin, 'Content-Type': 'application/json' } : {}),
                ...options.headers,
            } });
        const text = await response.text();
        return { response, text, json: response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : null };
    };
    return { owner, security, web, unified, model, writes, sessions, origin, issue, request, configuration, user,
        setClock(value) { clock = value; } };
}

async function activate(x) {
    const admin = await x.issue();
    const status = (await x.request('/api/auth/status', admin)).json;
    const enabled = await x.request('/api/eos/kiosk', admin, { method: 'PUT', body: JSON.stringify({ enabled: true, revision: 0 }),
        headers: { 'X-NW-CSRF': status.csrfToken } });
    assert.equal(enabled.response.status, 200, enabled.text);
    const anon = await x.request('/api/auth/status');
    const setCookie = anon.response.headers.getSetCookie().find(value => value.startsWith('nw_kiosk_'));
    assert.ok(setCookie, 'first kiosk request gets its separate opaque cookie');
    return { admin, cookie: setCookie.split(';')[0], access: anon.json };
}
async function kioskRequest(x, cookie, url, options = {}) {
    return x.request(url, undefined, { ...options, headers: { Cookie: cookie, ...options.headers } });
}

test('actual HTTP kiosk cannot inherit admin authority, expose protected settings or mutate module/token configuration', async t => {
    const x = await fixture(t);
    const { admin, cookie, access } = await activate(x);
    assert.equal(access.kiosk, true);
    assert.equal(access.userId, null);
    assert.equal(access.role, 'customer');
    assert.deepEqual(access.capabilities, ['frontend.open']);
    assert.equal(access.idleTimeoutMs, 0);
    const revoked = (await x.request('/api/auth/status?admin=1', admin)).json;
    assert.equal(revoked.authenticated, false, 'enabling kiosk revokes the ambient admin login');
    assert.equal(await x.model.getRefreshToken(admin.refreshToken), null, 'old refresh token cannot restore admin authority');
    const allowed = await kioskRequest(x, cookie, '/api/state');
    assert.equal(allowed.response.status, 200, allowed.text);
    for (const url of ['/api/eos/kiosk', '/api/eos/runtime', '/api/eos/modules/ocpp', '/api/installer/config', '/api/license/info']) {
        const response = await kioskRequest(x, cookie, url);
        assert.ok([401, 403].includes(response.response.status), url + ': ' + response.response.status);
    }
    for (const [url, method, value] of [
        ['/api/eos/kiosk', 'PUT', { enabled: false, revision: 1 }],
        ['/api/eos/modules/ocpp', 'PUT', { config: { enabled: true }, expectedConfigurationRevision: '00000000-0000-4000-8000-000000000001' }],
        ['/api/installer/config', 'POST', { chargeKiosk: { enabled: true, stations: [{ token: 'forged' }] } }],
        ['/api/set', 'POST', { scope: 'settings', key: 'installerEnabled', value: true }],
        ['/api/set', 'POST', { scope: 'ems', key: 'chargingManagement.wallboxes.lp1.maxCurrentA', value: 100 }],
    ]) {
        const response = await kioskRequest(x, cookie, url, { method, body: JSON.stringify(value), headers: { 'X-NW-CSRF': access.csrfToken } });
        assert.ok([401, 403].includes(response.response.status), url + ': ' + response.response.status + ' ' + response.text);
    }
    assert.deepEqual(x.writes, [], 'kiosk probes cannot issue controller state writes');
    assert.equal(x.configuration.get('eos-admin.0.kiosk.configuration').native.enabled, true);
});

test('actual HTTP kiosk requires its own same-origin CSRF and disable revokes old cookies immediately', async t => {
    const x = await fixture(t);
    const { cookie, access } = await activate(x);
    const body = JSON.stringify({ scope: 'settings', key: 'evcsActive', value: false });
    for (const headers of [{}, { 'X-NW-CSRF': '0'.repeat(64) }, { 'X-NW-CSRF': access.csrfToken, Origin: 'https://foreign.invalid' }]) {
        const denied = await kioskRequest(x, cookie, '/api/set', { method: 'POST', body, headers });
        assert.equal(denied.response.status, 403, denied.text);
    }
    const admin = await x.issue();
    const auth = (await x.request('/api/auth/status?admin=1', admin)).json;
    assert.equal(auth.role, 'admin');
    const disabled = await x.request('/api/eos/kiosk', admin, { method: 'PUT', body: JSON.stringify({ enabled: false, revision: 1 }),
        headers: { 'X-NW-CSRF': auth.csrfToken } });
    assert.equal(disabled.response.status, 200, disabled.text);
    assert.equal((await kioskRequest(x, cookie, '/api/auth/status')).json.authenticated, false);
    const after = await kioskRequest(x, cookie, '/api/set', { method: 'POST', body, headers: { 'X-NW-CSRF': access.csrfToken } });
    assert.ok([401, 403].includes(after.response.status));
    assert.deepEqual(x.writes, []);
});

test('pending kiosk readiness cannot revive a bootstrap request after token rotation or account revocation', async t => {
    const x = await fixture(t);
    await activate(x);
    const kiosk = x.unified.kiosk;
    const req = { method: 'GET', url: '/api/state', headers: {}, socket: { remoteAddress: '127.0.0.1' } };
    kiosk.bootstrap(req, { cookie() {} });
    const before = kiosk.token(req);
    assert.ok(before);
    assert.equal((await kiosk.access(req)).kiosk, true);
    const read = x.owner.getForeignObjectAsync;
    let release;
    let entered;
    const reading = new Promise(resolve => { entered = resolve; });
    const held = new Promise(resolve => { release = resolve; });
    x.owner.getForeignObjectAsync = async id => {
        if (id === x.user._id) { entered(); await held; }
        return read(id);
    };
    const pending = kiosk.access(req);
    await reading;
    await kiosk.save({ enabled: false, revision: 1 }, x.user._id, async () => true);
    release();
    assert.equal(await pending, null, 'an in-flight account read cannot authorize a request after disable');
    x.owner.getForeignObjectAsync = read;
    await kiosk.save({ enabled: true, revision: 2 }, x.user._id, async () => true);
    assert.equal(kiosk.token(req), '', 'same bootstrap Request cannot retain a revoked signature');
    assert.equal(await kiosk.access(req), null);
    assert.equal(kiosk.csrf(req), '');
    const replacement = { ...req, headers: {} };
    kiosk.bootstrap(replacement, { cookie() {} });
    x.user.common.enabled = false;
    assert.equal(await kiosk.access(replacement), null, 'disabled enabling account cannot authorize the kiosk');
});

