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

async function fixture(t) {
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
        getForeignObjectAsync: async id => clone(id === instance._id ? instance : id === user._id ? user : null),
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
    return { owner, security, web, unified, model, writes, sessions, origin, issue, request,
        setClock(value) { clock = value; } };
}

test('actual owner HTTP routes: idle polls/new page loads never extend ten minutes; another browser stays active', async t => {
    const x = await fixture(t);
    const first = await x.issue();
    const initial = await x.request('/api/auth/idle', first);
    assert.equal(initial.response.status, 200);
    assert.equal(initial.json.authenticated, true);
    assert.equal(initial.json.idleTimeoutMs, 600000);
    assert.match(initial.json.csrfToken, /^[a-f0-9]{64}$/);
    const remaining = status => status.idleExpiresAt - status.serverNow;
    assert.equal(remaining(initial.json), 600000);
    for (const now of [60000, 120000, 300000, 540000]) {
        x.setClock(now);
        const polled = await x.request('/api/auth/idle', first);
        assert.equal(remaining(polled.json), 600000 - now, 'read-only heartbeat must not renew');
        assert.equal((await x.request('/api/auth/status', first)).json.authenticated, true);
    }
    const newTab = await x.request('/migration/', first);
    assert.equal(newTab.response.status, 200, 'a new protected tab remains available before expiry');
    assert.equal(remaining((await x.request('/api/auth/idle', first)).json), 60000,
        'opening a new tab at minute nine must not silently count as a click');
    const second = await x.issue();
    assert.notEqual((await x.request('/api/auth/idle', second)).json.sessionKey, initial.json.sessionKey,
        'independent login has its own idle clock');
    x.setClock(600000);
    assert.equal((await x.request('/api/auth/status', first)).json.authenticated, false);
    assert.equal((await x.request('/api/auth/status', second)).json.authenticated, true);
    assert.match((await x.request('/migration/', first)).response.headers.get('location'), /^\/login\.html/);
    assert.equal((await x.request('/migration/', second)).response.status, 200);
    assert.deepEqual(x.writes, [], 'web expiry must not issue device or EMS state writes');
});

test('actual owner activity HTTP requires same-origin CSRF and cannot revive an expired family', async t => {
    const x = await fixture(t);
    const token = await x.issue();
    const initial = (await x.request('/api/auth/idle', token)).json;
    x.setClock(599999);
    const missingCsrf = await x.request('/api/auth/activity', token, { method: 'POST', body: '{}' });
    assert.equal(missingCsrf.response.status, 403);
    const foreign = await x.request('/api/auth/activity', token, { method: 'POST', body: '{}',
        headers: { Origin: 'https://outside.invalid', 'X-NW-CSRF': initial.csrfToken } });
    assert.equal(foreign.response.status, 403);
    const active = await x.request('/api/auth/activity', token, { method: 'POST', body: '{}',
        headers: { 'X-NW-CSRF': initial.csrfToken } });
    assert.equal(active.response.status, 200);
    assert.equal(active.json.idleExpiresAt - active.json.serverNow, 600000);
    x.setClock(600000);
    const premature = await x.request('/api/auth/expire', token, { method: 'POST', body: '{}',
        headers: { 'X-NW-CSRF': initial.csrfToken } });
    assert.equal(premature.response.status, 200);
    assert.equal(premature.json.expired, false, 'another active tab prevents premature expiry');
    x.setClock(1199999);
    const late = await x.request('/api/auth/activity', token, { method: 'POST', body: '{}',
        headers: { 'X-NW-CSRF': initial.csrfToken } });
    assert.equal(late.response.status, 401);
    assert.equal((await x.request('/api/auth/idle', token)).json.authenticated, false);
    assert.ok(!await x.model.getRefreshToken(token.refreshToken), 'refresh cannot resurrect idle authority');
    assert.deepEqual(x.writes, []);
});

test('a cached upstream req.user cannot retain EOS authority after idle expiry', async t => {
    const x = await fixture(t);
    const token = await x.issue();
    const req = { method: 'GET', url: '/api/auth/status', headers: {
        host: new URL(x.origin).host, cookie: `access_token=${token.accessToken}`,
    }, socket: { remoteAddress: '127.0.0.1' }, user: 'operator' };
    assert.equal((await x.unified.status(req)).authenticated, true);
    x.setClock(600000);
    assert.equal((await x.unified.status(req)).authenticated, false,
        'long-lived HTTP/SSE requests must not reuse the initial identity after expiry');
    assert.equal((await x.web.getEosRequestAccess(req)).userId, null,
        'technical routes also revalidate instead of trusting upstream request identity');
});

test('actual hosted SSE is closed at idle expiry even without a new data frame, independently per login', async t => {
    const x = await fixture(t);
    const first = await x.issue();
    const controls = [];
    const open = async token => {
        const controller = new AbortController(); controls.push(controller);
        const response = await fetch(x.origin + '/events', {
            headers: { Cookie: `access_token=${token.accessToken}` }, signal: controller.signal,
        });
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), /^text\/event-stream/);
        const reader = response.body.getReader();
        const initial = await reader.read();
        assert.equal(initial.done, false);
        assert.match(Buffer.from(initial.value).toString('utf8'), /data:/);
        return reader;
    };
    t.after(() => { for (const controller of controls) controller.abort(); });
    const firstReader = await open(first);
    x.setClock(300000);
    const second = await x.issue();
    await open(second);
    assert.equal(x.security.streams.size, 2);
    x.setClock(600000);
    x.security.pruneFamilies();
    const ended = await firstReader.read();
    assert.equal(ended.done, true, 'a quiet SSE channel must close without waiting for another publish');
    assert.equal(x.security.streams.size, 1, 'the independently active browser keeps its existing SSE response');
    assert.equal((await x.request('/api/auth/status', second)).json.authenticated, true);
    assert.deepEqual(x.writes, []);
});

test('pinned upstream log and instance publications cannot send after idle expiry before the prune timer', async t => {
    const x = await fixture(t);
    const base = path.join(root, 'node_modules/@iobroker/socket-classes/build/lib');
    const load = (name, dependencies) => {
        const exportsValue = {};
        vm.runInNewContext(fs.readFileSync(path.join(base, `${name}.js`), 'utf8'), {
            exports: exportsValue, module: { exports: exportsValue }, Buffer, console,
            setTimeout, clearTimeout, setInterval, clearInterval, setImmediate,
            require(id) { assert.ok(Object.hasOwn(dependencies, id), `unexpected pinned import ${id}`); return dependencies[id]; },
        }, { filename: name, timeout: 5000 });
        return exportsValue;
    };
    const upstreamCommands = load('socketCommands', { '@iobroker/adapter-core': {
        commonTools: { pattern2RegEx() { assert.fail('pattern lookup is outside this publication fixture'); } },
    } });
    const upstreamCommon = load('socketCommon', { './socketCommands': upstreamCommands });
    const deliveries = [];
    const clients = [];
    x.owner.sendTo = (_target, _command, _data, callback) => { callback?.({ accepted: true }); };
    const commands = new upstreamCommands.SocketCommands(x.owner, client => x.security.isSocketAllowed(client), { language: 'de' });
    const handlers = {};
    const socketAdmin = {
        commands,
        getSocketsList: () => clients,
        sendLog: upstreamCommon.SocketCommon.prototype.sendLog,
        addEventHandler(name, handler) { handlers[name] = handler; },
        __updateSession() { return true; },
        __getUserFromSocket(_client, callback) { callback(null, 'system.user.operator', Date.now() + 3600000); },
        unsubscribeSocket(client) { client.subscribe = {}; },
    };
    x.security.bindSockets(socketAdmin);
    const connect = async token => {
        const client = new EventEmitter();
        client.id = token.accessToken;
        client._acl = { user: 'system.user.operator', other: { sendto: true } };
        client.subscribe = { log: ['*'] };
        client.conn = { request: { headers: { cookie: `access_token=${token.accessToken}` } } };
        client.on('log', value => deliveries.push({ id: client.id, type: 'log', value }));
        client.on('im', (_type, _source, value) => deliveries.push({ id: client.id, type: 'im', value }));
        client.disconnect = () => { client.closed = true; client.emit('disconnect'); };
        clients.push(client); handlers.connect(client);
        await new Promise((resolve, reject) => socketAdmin.__getUserFromSocket(client, error => error ? reject(Error(error)) : resolve()));
        await new Promise((resolve, reject) => commands.commands.clientSubscribe(client, 'fixture.0', 'status', {}, error => error ? reject(Error(error)) : resolve()));
        return client;
    };
    const first = await connect(await x.issue());
    x.setClock(300000);
    const second = await connect(await x.issue());
    socketAdmin.sendLog({ message: 'before-expiry' });
    commands.publishInstanceMessage(first, 'system.adapter.fixture.0', 'status', 'before-expiry');
    assert.equal(deliveries.length, 3);
    deliveries.length = 0;
    x.setClock(600000);
    // Deliberately do not call pruneFamilies: every outbound path must enforce
    // its own deadline before the next one-second cleanup callback runs.
    socketAdmin.sendLog({ message: 'after-expiry' });
    commands.publishInstanceMessage(first, 'system.adapter.fixture.0', 'status', 'after-expiry');
    commands.publishInstanceMessage(second, 'system.adapter.fixture.0', 'status', 'after-expiry');
    assert.equal(deliveries.length, 2);
    assert.ok(deliveries.every(row => row.id === second.id));
    assert.equal(first.closed, true);
    assert.notEqual(second.closed, true);
});
