/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
// Browser test fixture copied from eos-kiosk-http.test.cjs to avoid executing its tests.
// Real Web.mountUnifiedRuntime, UnifiedSessions, OAuth model and session-security
// boundary with an in-memory controller. The UI process factory is an explicit
// in-process test seam: actual hosted routes/SSE remain real, while fake controller
// sessions and the deterministic idle clock stay in this fixture. Child isolation
// is covered by eos-ui-process*.test.cjs. No live controller or device is contacted.
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
const { EosSessionSecurity } = require(emitted ? '../../build/lib/eosSessionSecurity' : '../../src/lib/eosSessionSecurity');
const { UnifiedSessions } = require(emitted ? '../../build/lib/eosUnifiedBoundary' : '../../src/lib/eosUnifiedBoundary');
const root = path.resolve(__dirname, '../..');
const clone = value => structuredClone(value);
const modelSource = fs.readFileSync(path.join(__dirname, 'oauth2-model-v1.4.0.ts'), 'utf8');
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
            if (name === './eosUiProcess') return {
                createEosUiProcess: (adapter, bridge) => localRequire(path.join(root, 'ui/main.js')).createHostedRuntime(adapter, bridge),
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

async function fixture(t, options = {}) {
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
        common: { enabled: true }, native: { auth: true, secure: false, port: 8188, eosUi: {} } };
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
    if (options.beforeMount) await options.beforeMount(app);
    await web.mountUnifiedRuntime();
    if (options.afterMount) await options.afterMount(app);
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
        setRole(role) { group.common.members = role === 'admin' ? [user._id] : []; },
        setLicense(value) { licensed = value; },
        setClock(value) { clock = value; } };
}


module.exports = { fixture };
