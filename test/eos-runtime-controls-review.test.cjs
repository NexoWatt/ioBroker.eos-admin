'use strict';
// Independent transaction review: real control service/config store, synthetic DB
// and lifecycle endpoints. Actual worker/PID behavior is tested separately.
const test = require('node:test');
const assert = require('node:assert/strict');
const { EosRuntimeControl } = require('../src/lib/eosRuntimeControl');
const { EosModuleConfigStore } = require('../src/lib/eosModuleConfigStore');
const express = require('express');
const http = require('node:http');
const { registerEosModuleRoutes } = require('../src/lib/eosModuleHttp');

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}
function fixture() {
    const objects = new Map(), events = [];
    const clone = value => value == null ? value : structuredClone(value);
    const owner = {
        namespace: 'eos-admin.0', config: {}, log: { warn() {} },
        encrypt: value => `encrypted:${Buffer.from(value).toString('base64')}`,
        decrypt: value => Buffer.from(value.slice(10), 'base64').toString(),
        async getForeignObjectAsync(id) { return clone(objects.get(id)); },
        async setForeignObjectAsync(id, value) { objects.set(id, clone(value)); },
        eosMigration: { allowsStartup: () => true },
        eosOwnership: { canWrite: () => true },
        eosLicenseService: { statusView: () => ({ valid: true, coreEnabled: true }), allowsEmbeddedModule: () => true },
    };
    const host = {
        async view() { return { config: { enabled: true } }; },
        async controlProcess(id, action) { events.push(`${id}:${action}`); },
    };
    const runtime = {
        async pause() { events.push('ui:stop'); },
        async resume() { events.push('ui:start'); },
        status() { return {}; },
    };
    const create = options => new EosRuntimeControl({ owner, host, runtime, ...options });
    return { owner, host, runtime, events, objects, create };
}

test('unconfirmed stop cannot become enabled again by reconstructing the control service', async () => {
    const f = fixture(), control = f.create();
    await control.initialize();
    f.host.controlProcess = async (id, action) => {
        f.events.push(`${id}:${action}`);
        if (action === 'stop') throw Object.assign(new Error('stop pending'), { code: 'EOS_RUNTIME_STOP_UNCONFIRMED' });
    };
    control.request('devices', 'restart', control.view('devices').revision);
    await control.pending;
    assert.equal(control.isEnabled('devices'), false);
    assert.equal(control.view('devices').reason, 'EOS_RUNTIME_STOP_UNCONFIRMED');
    assert.deepEqual(f.events, ['devices:stop']);
    control.close();
    const restored = f.create(); await restored.initialize();
    assert.equal(restored.isEnabled('devices'), false);
    assert.equal(restored.view('devices').enabled, false);
    assert.equal(restored.isEnabled('ui'), true, 'unrelated desired process state is retained');
    restored.close();
});

test('accepted restart stays busy until stop really settles and does not resume after close', async () => {
    const f = fixture(), control = f.create(), entered = deferred(), stopped = deferred();
    await control.initialize();
    f.host.controlProcess = async (id, action) => {
        f.events.push(`${id}:${action}`);
        if (action === 'stop') { entered.resolve(); await stopped.promise; }
    };
    const revision = control.view('devices').revision;
    control.request('devices', 'restart', revision);
    await entered.promise;
    assert.equal(control.view('devices').busy, true);
    assert.throws(() => control.request('ui', 'disable', revision), { code: 'EOS_RUNTIME_BUSY' });
    control.close(); stopped.resolve(); await control.pending;
    assert.deepEqual(f.events, ['devices:stop']);
    const restored = f.create(); await restored.initialize();
    assert.equal(restored.isEnabled('devices'), false);
    restored.close();
});

test('late database write after close cannot dispatch stop or start into a replacement lifecycle', async () => {
    const f = fixture(), control = f.create(), entered = deferred(), finish = deferred();
    await control.initialize();
    const write = f.owner.setForeignObjectAsync;
    f.owner.setForeignObjectAsync = async (id, value) => {
        entered.resolve(); await finish.promise; await write(id, value);
    };
    control.request('ui', 'restart', control.view('ui').revision);
    await entered.promise;
    control.close(); finish.resolve(); await control.pending;
    assert.deepEqual(f.events, []);
    const restored = f.create(); await restored.initialize();
    assert.equal(restored.isEnabled('ui'), false);
    restored.close();
});

test('persisted UI pause survives initialization while other process flags remain separate', async () => {
    const f = fixture();
    const enabled = { ui: false, devices: true, eebus: false, backup: true, ocpp: true };
    const store = new EosModuleConfigStore(f.owner, { moduleIds: ['runtime'] });
    await store.save('runtime', { v: 1, encrypted: f.owner.encrypt(JSON.stringify({ v: 1, enabled })) });
    const control = f.create(); await control.initialize();
    for (const [id, expected] of Object.entries(enabled)) assert.equal(control.isEnabled(id), expected);
    assert.equal(control.view('ui').canEnable, true);
    assert.equal(control.view('ui').canRestart, false);
    assert.deepEqual(f.events, []);
    control.close();
});

test('closing initialization before a late database response cannot grant process authority', async () => {
    const f = fixture(), result = deferred();
    f.owner.getForeignObjectAsync = () => result.promise;
    const control = f.create(), initialization = control.initialize();
    control.close(); result.resolve(null); await initialization;
    assert.equal(control.isEnabled('ui'), false);
    assert.equal(control.isEnabled('devices'), false);
    assert.deepEqual(f.events, []);
});

test('bounded initialization returns a visible blocker and a late read cannot reopen process gates', async () => {
    const f = fixture(), result = deferred();
    f.owner.getForeignObjectAsync = () => result.promise;
    const control = f.create({ readTimeoutMs: 20 });
    await control.initialize();
    assert.equal(control.view('ui').reason, 'EOS_RUNTIME_CONFIG_TIMEOUT');
    assert.equal(control.isEnabled('ui'), false);
    assert.equal(control.isEnabled('devices'), false);
    result.resolve(null);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(control.view('ui').reason, 'EOS_RUNTIME_CONFIG_TIMEOUT');
    assert.equal(control.isEnabled('ui'), false);
    assert.equal(control.isEnabled('devices'), false);
    assert.deepEqual(f.events, []);
    control.close();
});

for (const revoked of ['session', 'role', 'csrf']) {
    test(`slow HTTP body cannot retain control authority after ${revoked} revocation`, async t => {
        const firstBodyAdmission = deferred();
        let revokedNow = false, calls = 0, checks = 0;
        const app = express();
        const parser = express.json({ limit: '512kb' });
        registerEosModuleRoutes({
            app, host: { status: async () => ({}) }, baseDir: process.cwd(),
            jsonParser: (req, res, next) => { firstBodyAdmission.resolve(); parser(req, res, next); },
            authorize: async () => {
                checks++;
                const value = { authenticated: !(revokedNow && revoked === 'session'),
                    role: revokedNow && revoked === 'role' ? 'enduser' : 'admin', csrfToken: 'fixture-csrf' };
                return value;
            },
            requestAllowed: () => true,
            csrfAllowed: () => !(revokedNow && revoked === 'csrf'),
            runtimeControl: { request() { calls++; return { accepted: true }; } },
        });
        const server = http.createServer(app);
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
        const body = JSON.stringify({ action: 'restart', expectedRevision: 'fixture-revision' });
        let outgoing;
        const response = new Promise((resolve, reject) => {
            outgoing = http.request({ host: '127.0.0.1', port: server.address().port,
                path: '/api/eos/runtime/devices/control', method: 'POST',
                headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } }, incoming => {
                const chunks = [];
                incoming.on('data', chunk => chunks.push(chunk));
                incoming.on('end', () => resolve({ status: incoming.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }));
            });
            outgoing.on('error', reject);
            outgoing.setTimeout(2000, () => outgoing.destroy(new Error('review HTTP timeout')));
            outgoing.write(body.slice(0, 1));
        });
        await firstBodyAdmission.promise;
        revokedNow = true;
        outgoing.end(body.slice(1));
        const result = await response;
        assert.equal(result.status, revoked === 'session' ? 401 : 403);
        assert.equal(checks, 2, 'authorization is re-evaluated after body admission');
        assert.equal(calls, 0, 'no lifecycle job is accepted from the old authority');
    });
}
