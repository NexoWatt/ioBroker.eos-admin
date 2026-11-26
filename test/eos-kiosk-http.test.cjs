/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
// Real Web.mountUnifiedRuntime, UnifiedSessions, OAuth model and session-security
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
const { EventEmitter } = require('node:events');
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

async function enable(x) {
    const admin = await x.issue();
    const auth = (await x.request('/api/auth/status', admin)).json;
    const result = await x.request('/api/eos/kiosk', admin, { method: 'PUT',
        headers: { 'X-NW-CSRF': auth.csrfToken }, body: JSON.stringify({ enabled: true, revision: 0 }) });
    assert.equal(result.response.status, 200, result.text);
    assert.equal(result.json.reauthenticate, true);
    const publicStatus = await x.request('/api/auth/status');
    const cookie = publicStatus.response.headers.getSetCookie().find(v => v.startsWith('nw_kiosk_')).split(';')[0];
    return { admin, cookie, status: publicStatus.json };
}

test('kiosk configuration defaults closed, requires admin Origin/CSRF, persists outside instance and revokes existing admin', async t => {
    const x = await fixture(t);
    assert.equal((await x.request('/api/state')).response.status, 401);
    assert.equal((await x.request('/api/eos/kiosk')).response.status, 403);
    const admin = await x.issue();
    assert.deepEqual((await x.request('/api/eos/kiosk', admin)).json, { enabled: false, revision: 0, available: true });
    for (const headers of [{}, { 'X-NW-CSRF': 'a'.repeat(64) }, { Origin: 'https://evil.invalid', 'X-NW-CSRF': 'a'.repeat(64) }]) {
        assert.equal((await x.request('/api/eos/kiosk', admin, { method: 'PUT', body: '{"enabled":true,"revision":0}', headers })).response.status, 403);
    }
    const e = await enable(x);
    const stored = x.objects.get('eos-admin.0.kiosk.configuration');
    assert.equal(stored.native.enabled, true);
    assert.equal(stored.acl.object, 0x600);
    assert.equal(x.objects.has('system.adapter.eos-admin.0'), false);
    assert.equal((await x.request('/api/auth/status?admin=1', e.admin)).json.authenticated, false);
    assert.equal((await x.request('/api/eos/kiosk', e.admin)).response.status, 403);
    assert.equal(e.status.kiosk, true);
    assert.equal(e.status.user, null);
    assert.deepEqual(e.status.capabilities, ['frontend.open']);
    assert.equal(e.status.idleTimeoutMs, 0);
    assert.equal(e.status.idleExpiresAt, null);
    assert.match(e.status.csrfToken, /^[a-f0-9]{64}$/);
    assert.match(e.status.sessionKey, /^kiosk:[a-f0-9]{48}$/);
});

test('anonymous kiosk can read dashboard indefinitely but never obtains settings, arbitrary DP or forged admin authority', async t => {
    const x = await fixture(t);
    const e = await enable(x);
    const headers = { Cookie: e.cookie, 'X-NW-CSRF': e.status.csrfToken };
    x.setClock(30 * 24 * 60 * 60 * 1000);
    const idle = (await x.request('/api/auth/idle', null, { headers })).json;
    assert.equal(idle.kiosk, true);
    assert.equal(idle.idleTimeoutMs, 0);
    assert.equal((await x.request('/api/state', null, { headers })).response.status, 200);
    const customerHealth = await x.request('/api/eos/dashboard/process-status', null, { headers });
    assert.equal(customerHealth.response.status, 200, customerHealth.text);
    assert.equal(customerHealth.response.headers.get('cache-control'), 'no-store');
    assert.ok(Number.isSafeInteger(customerHealth.json.observedAt));
    assert.doesNotMatch(customerHealth.text, /lastError|Heartbeat|pid|generation|csrf|command|PRIVATE/i);
    assert.notEqual((await x.request('/api/eos/runtime', null, { headers })).response.status, 200);
    assert.notEqual((await x.request('/api/eos/dashboard/process-status', null, { method:'POST', headers })).response.status, 200);

    const configuration = await x.request('/config', null, { headers });
    assert.equal(configuration.response.status, 200);
    for (const secret of ['PRIVATE_DP_GRID', 'PRIVATE_WEATHER_KEY', 'PRIVATE_EMAIL_ADDRESS', 'PRIVATE_DP_CHARGER', 'PRIVATE_INSTALLER_SECRET']) {
        assert.equal(configuration.text.includes(secret), false, `customer config exposed ${secret}`);
    }
    assert.equal(configuration.json.datapoints.gridPower, 'configured');
    assert.equal((await x.request('/api/auth/status?admin=1', null, { headers })).json.authenticated, false);
    for (const url of ['/api/eos/kiosk', '/api/eos/modules', '/api/installer/config', '/api/license/info']) {
        const result = await x.request(url, null, { headers: { ...headers, 'x-user': 'system.user.admin', 'x-role': 'admin', 'x-eos-process-context': 'a'.repeat(48) } });
        assert.ok(result.response.status >= 400, `${url}: ${result.response.status} ${result.text}`);
    }
    for (const body of [
        { scope: 'installer', key: 'gridPower', value: 'system.adapter.admin.0' },
        { scope: 'settings', key: 'weatherApiKey', value: 'evil' },
        { scope: 'settings', key: 'peakShavingEnabled', value: false },
        { scope: 'ems', key: 'evcs.1.stationEnabled', value: true, id: 'system.adapter.admin.0' },
        { scope: 'ems', key: 'evcs.1.stationEnabled', value: 'yes' },
    ]) {
        const result = await x.request('/api/set', null, { method: 'POST', headers, body: JSON.stringify(body) });
        assert.equal(result.response.status, 403, result.text);
        assert.equal(result.json.error, 'KIOSK_CONTROL_FORBIDDEN');
    }
    for (const bad of [{ Cookie: e.cookie }, { ...headers, Origin: 'https://evil.invalid' }]) {
        assert.equal((await x.request('/api/set', null, { method: 'POST', headers: bad,
            body: '{"scope":"ems","key":"evcs.1.userMode","value":"pv"}' })).response.status, 403);
    }
    // Valid command passes the parent boundary and reaches the real UI readiness gate.
    const valid = await x.request('/api/set', null, { method: 'POST', headers,
        body: '{"scope":"ems","key":"evcs.1.userMode","value":"pv"}' });
    assert.equal(valid.response.status, 503, valid.text);
    assert.notEqual(valid.json.error, 'KIOSK_CONTROL_FORBIDDEN');
    assert.deepEqual(x.writes, []);
});

test('fresh password proof unlocks admin with ordinary idle limit; logout and disable revoke capabilities immediately', async t => {
    const x = await fixture(t);
    const e = await enable(x);
    const badLogin = await x.request('/api/auth/login', null, { method: 'POST', body: '{"user":"operator","password":"wrong-password"}' });
    assert.equal(badLogin.response.status, 401);
    const login = await x.request('/api/auth/login', null, { method: 'POST', body: '{"user":"operator","password":"fixture-passphrase"}' });
    assert.equal(login.response.status, 200);
    assert.deepEqual(login.json, { ok: true });
    const admin = { accessToken: login.response.headers.getSetCookie().find(v => v.startsWith('access_token=')).split(';')[0].slice(13) };
    const normal = (await x.request('/api/auth/status?admin=1', admin)).json;
    assert.equal(normal.kiosk, false);
    assert.equal(normal.role, 'admin');
    assert.equal(normal.idleTimeoutMs, 600000);
    const logout = await x.request('/api/auth/logout', admin, { method: 'POST', body: '{}', headers: { 'X-NW-CSRF': normal.csrfToken } });
    assert.equal(logout.response.status, 200);
    assert.equal((await x.request('/api/auth/status?admin=1', admin)).json.authenticated, false);
    const second = await x.issue();
    const status = (await x.request('/api/auth/status', second)).json;
    const disabled = await x.request('/api/eos/kiosk', second, { method: 'PUT',
        headers: { 'X-NW-CSRF': status.csrfToken }, body: '{"enabled":false,"revision":1}' });
    assert.equal(disabled.response.status, 200, disabled.text);
    const headers = { Cookie: e.cookie, 'X-NW-CSRF': e.status.csrfToken };
    assert.equal((await x.request('/api/state', null, { headers })).response.status, 401);
    assert.equal((await x.request('/api/auth/status', null, { headers })).json.authenticated, false);
    assert.equal((await x.request('/api/set', null, { method: 'POST', headers,
        body: '{"scope":"ems","key":"evcs.1.userMode","value":"pv"}' })).response.status, 401);
    x.setClock(600000);
    assert.equal((await x.request('/api/auth/status?admin=1', second)).json.authenticated, false);
});

test('kiosk cannot bypass license or first password gates; station token URLs retain their independent capability checks', async t => {
    const x = await fixture(t);
    const e = await enable(x);
    const headers = { Cookie: e.cookie };
    x.setLicense(false);
    assert.equal((await x.request('/api/auth/status', null, { headers })).json.authenticated, false);
    assert.ok((await x.request('/api/state', null, { headers })).response.status >= 400);
    x.setLicense(true);
    x.user.native.nexowattEosAccount.forcePasswordChange = true;
    assert.equal((await x.request('/api/auth/status', null, { headers })).json.authenticated, false);
    delete x.user.native.nexowattEosAccount.forcePasswordChange;
    const page = await x.request('/display/station/not-a-valid-station');
    assert.equal(page.response.status, 200, page.text);
    const station = await x.request('/api/display/station/not-a-valid-station');
    assert.ok([403, 404].includes(station.response.status), station.text);
    assert.notEqual(station.json.error, 'authentication_required');
    assert.equal((await x.request('/api/auth/status?admin=1')).json.authenticated, false);
});

async function fixture(t) {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-kiosk-http-'));
    const objects = new Map();
    let licensed = true;
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
        common: { enabled: true }, native: { auth: true, secure: false, port: 8188, eosUi: { datapoints: { gridPower: 'PRIVATE_DP_GRID' }, settings: { weatherApiKey: 'PRIVATE_WEATHER_KEY', email: 'PRIVATE_EMAIL_ADDRESS' }, settingsConfig: { evcsList: [{ name: 'Fixture Charger', powerId: 'PRIVATE_DP_CHARGER' }] }, installer: { credential: 'PRIVATE_INSTALLER_SECRET' } } } };
    const owner = {
        namespace: 'eos-admin.0', instance: 0, config: instance.native,
        log: { error() {}, warn() {}, info() {}, debug() {} }, setTimeout, clearTimeout,
        getSession(id, callback) { callback(sessions.has(id) ? clone(sessions.get(id)) : null); },
        setSession(id, _ttl, value, callback) { sessions.set(id, clone(value)); callback?.(null); },
        destroySession(id, callback) { sessions.delete(id); callback?.(); return Promise.resolve(); },
        checkPassword(name, pass, callback) { callback(name === 'operator' && pass === 'fixture-passphrase', `system.user.${name}`); },
        getForeignObjectAsync: async id => clone(objects.get(id) || (id === instance._id ? instance : id === user._id ? user : null)),
        setForeignObjectAsync: async (id, object) => { objects.set(id, clone(object)); },
        getObjectViewAsync: async (_design, type) => ({ rows: type === 'group' ? [{ id: group.common.name, value: clone(group) }] : [] }),
        getForeignStateAsync: async () => null,
        setForeignStateAsync: async (...args) => { writes.push(args); },
        eosLicenseService: { statusView: () => ({ valid: licensed, coreEnabled: licensed,
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
    app.post('/api/auth/login', (req, res, next) => unified.prepareLogin(req, res, next));
    app.post('/oauth/token', async (req, res) => {
        try {
            const token = await issue(req.body.username, req.body.password);
            res.cookie('access_token', token.accessToken, { httpOnly: true, sameSite: 'strict' });
            res.cookie('refresh_token', token.refreshToken, { httpOnly: true, sameSite: 'strict' });
            res.json({ access_token: token.accessToken });
        } catch { res.status(401).json({ error: 'invalid_grant' }); }
    });
    app.post('/api/auth/logout', (req, res) => unified.logout(req, res));
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
    const issue = async (name = 'operator', password = 'fixture-passphrase') => {
        const identity = await model.getUser(name, password);
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
    return { owner, security, web, unified, model, writes, sessions, origin, issue, request, objects, user,
        setLicense(value) { licensed = value; },
        setClock(value) { clock = value; } };
}

