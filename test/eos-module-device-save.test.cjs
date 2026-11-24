/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
// Real HTTP boundary, OAuth session, module host/config store and Devices validator.
// The controller database and device transport are isolated doubles: no hardware IO.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const { EosModuleHost } = require('../src/lib/eosModuleHost');
const { registerEosModuleRoutes } = require('../src/lib/eosModuleHttp');
const { UnifiedSessions } = require('../src/lib/eosUnifiedBoundary');
const { installIdleSession } = require('./fixtures/eos-idle-session.cjs');
const realDevices = require('../modules/devices');
const configurationId = 'eos-admin.0.modules.devices.configuration';
const meter = { id: 'meter1', name: 'SMA EnergyMeter / SHM', templateId: 'meter.sma.SmaEnergyMeterSpeedwireImpl',
    enabled: true, protocol: 'speedwire', connection: { host: '192.0.2.15', serial: 'test-meter', password: 'fixture-only-secret', futureConnectionOption: 41 },
    futureDeviceOption: { value: 'retain' } };

async function fixture(t, initial = {}, allowed = true) {
    const objects = new Map(); const writes = []; const runtimes = [];
    let allowStartup = allowed, failRead = false;
    const encrypt = text => `fixture-encrypted:${Buffer.from(text).toString('base64')}`;
    const owner = {
        namespace: 'eos-admin.0', instance: 0, config: { eosModules: { devices: { v: 1, encrypted: encrypt(JSON.stringify({ enabled: false, ...initial })) } } },
        encrypt, decrypt: text => Buffer.from(text.slice('fixture-encrypted:'.length), 'base64').toString(),
        log: { warn() {}, info() {}, debug() {}, error() {} },
        eosLicenseService: { allowsEmbeddedModule: () => true }, eosOwnership: { canWrite: () => true },
        eosMigration: { allowsStartup: () => allowStartup, status: () => ({ phase: allowStartup ? 'NOT_NEEDED' : 'BLOCKED' }) },
        async getObjectViewAsync() { return { rows: [] }; },
        async getForeignObjectAsync(id) { if (failRead && id === configurationId) throw new Error('fixture read unavailable'); return structuredClone(objects.get(id)); },
        async setForeignObjectAsync(id, value) { objects.set(id, structuredClone(value)); writes.push(id); },
        async getForeignStateAsync() { return null; },
        async subscribeForeignObjectsAsync() {}, async subscribeForeignStatesAsync() {}, async unsubscribeForeignStatesAsync() {},
    };
    const factory = { ...realDevices, createHostedModule(options) {
        const runtime = { config: structuredClone(options.config), starts: 0, stops: 0,
            async start() { this.starts++; }, async stop() { this.stops++; }, async getStatus() { return { state: 'fixture' }; } };
        runtimes.push(runtime); return runtime;
    } };
    const options = { baseDir: path.resolve(__dirname, '..'), dataDir: '/tmp/eos-device-save-fixture',
        factories: { devices: factory, eebus: { validateConfig: input => input }, backup: { validateConfig: input => input } } };
    let host = new EosModuleHost(owner, options);
    const session = await installIdleSession(owner);
    const authority = new UnifiedSessions(owner, { secure: false, externalOrigin: '',
        resolveAccess: async req => req.headers.cookie === `access_token=${session.token}`
            ? { userId: session.userId, role: 'admin', groups: [] } : { userId: null, role: 'enduser', groups: [] },
        firstLogin: async () => ({ required: false }), getLicense: () => ({ valid: true, coreEnabled: true }) });
    const app = express();
    const proxyHost = Object.fromEntries(['view', 'save', 'command', 'importLegacy', 'migrationStatus'].map(method => [method, (...args) => host[method](...args)]));
    registerEosModuleRoutes({ app, host: proxyHost, baseDir: options.baseDir, jsonParser: express.json(),
        authorize: req => authority.status(req), csrfAllowed: req => authority.csrfAllowed(req), requestAllowed: req => authority.requestAllowed(req) });
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    t.after(async () => { await host.stop(); session.cleanup(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const get = async () => {
        const response = await fetch(`${origin}/api/eos/modules/devices`, { headers: { cookie: `access_token=${session.token}` } });
        assert.equal(response.status, 200); return response.json();
    };
    const put = async (config, csrfToken) => {
        const response = await fetch(`${origin}/api/eos/modules/devices`, { method: 'PUT',
            headers: { cookie: `access_token=${session.token}`, origin, 'content-type': 'application/json', 'x-nw-csrf': csrfToken }, body: JSON.stringify({ config }) });
        return { status: response.status, body: await response.json() };
    };
    return { owner, objects, writes, runtimes, get, put, host: () => host,
        allowed(value) { allowStartup = value; }, failRead(value) { failRead = value; },
        async restart() { await host.stop(); owner.config = { eosModules: {} }; host = new EosModuleHost(owner, options); return host; } };
}

test('SMA device create/save/reload and enable toggle survive a new host with packaged defaults', async t => {
    const f = await fixture(t, { futureModuleOption: { retain: true } });
    let view = await f.get();
    assert.equal(view.configurationReady, true, 'editing does not depend on running device transports');
    assert.equal(view.configurationLoaded, true);
    assert.equal(f.host().initialized, false);
    assert.equal(f.runtimes.length, 0);
    const saved = await f.put({ ...view.config, enabled: true, devices: [meter] }, view.csrfToken);
    assert.equal(saved.status, 200);
    view = await f.get();
    assert.equal(view.config.enabled, true);
    assert.equal(view.config.devices[0].id, 'meter1');
    assert.equal(view.config.devices[0].connection.password, '__EOS_SECRET_UNCHANGED__');
    assert.equal(f.runtimes.length, 0, 'saving before operational startup never starts hardware');
    assert.deepEqual(f.writes, [configurationId]);
    assert.equal(JSON.stringify(f.objects.get(configurationId)).includes('fixture-only-secret'), false);
    const migration = { preserveNamespace: true, source: 'nexowatt-devices.0', sourceVersion: '0.5.176' };
    await f.host().save('devices', view.config, migration);
    await f.restart();
    view = await f.get();
    assert.equal(view.status.namespace, 'nexowatt-devices.0.devices');
    assert.deepEqual(view.migration, migration);
    assert.deepEqual(view.config.futureModuleOption, { retain: true });
    assert.deepEqual(view.config.devices[0].futureDeviceOption, { value: 'retain' });
    assert.equal(view.config.devices[0].connection.futureConnectionOption, 41);
    assert.equal((await f.put({ ...view.config, enabled: false }, view.csrfToken)).status, 200);
    view = await f.get(); assert.equal(view.config.enabled, false);
    assert.equal((await f.put({ ...view.config, enabled: true }, view.csrfToken)).status, 200);
    const restarted = await f.restart(); await restarted.start();
    assert.equal(f.runtimes.length, 1);
    assert.deepEqual(f.runtimes[0].config.devices, [meter]);
    assert.equal(f.runtimes[0].config.enabled, true);
    assert.deepEqual(f.runtimes[0].config.futureModuleOption, { retain: true });
    assert.equal(restarted.namespace('devices'), 'nexowatt-devices.0');
    assert.ok(f.writes.every(id => id === configurationId), 'no adapter-instance write/restart or source mutation');
});

test('blocked handover displays the saved devices and rejects replacement until explicit coordinator release', async t => {
    const f = await fixture(t, { devices: [meter], futureModuleOption: 'original' }, false);
    const before = structuredClone(f.owner.config);
    let view = await f.get();
    assert.equal(view.configurationReady, false);
    assert.equal(view.configurationReason, 'EOS_MODULE_MIGRATION_BLOCKED');
    assert.equal(view.config.devices[0].id, 'meter1', 'the editor receives saved settings instead of empty defaults');
    assert.deepEqual(f.owner.config, before, 'read-only loading does not rewrite migration targets');
    assert.deepEqual(await f.put({ enabled: true, devices: [] }, view.csrfToken), { status: 400, body: { error: 'EOS_MODULE_MIGRATION_BLOCKED' } });
    assert.equal(f.writes.length, 0); assert.equal(f.runtimes.length, 0);
    f.owner.config.eosModules.devices.encrypted = f.owner.encrypt(JSON.stringify({ enabled: false, devices: [{ ...meter, name: 'Migrated original' }], futureModuleOption: 'migrated' }));
    f.allowed(true); view = await f.get();
    assert.equal(view.configurationReady, true);
    assert.equal(view.config.devices[0].name, 'Migrated original');
    assert.equal(view.config.futureModuleOption, 'migrated');
    assert.equal((await f.put(view.config, view.csrfToken)).status, 200);
    assert.equal(f.runtimes.length, 0);
});

test('read failure on handover release cannot make a previously loaded stale configuration writable', async t => {
    const f = await fixture(t, { devices: [meter] }, false);
    let view = await f.get(); assert.equal(view.configurationLoaded, true);
    const before = structuredClone(f.owner.config);
    f.allowed(true); f.failRead(true); view = await f.get();
    assert.equal(view.configurationReady, false); assert.equal(view.configurationLoaded, false);
    assert.equal(view.configurationReason, 'EOS_MODULE_CONFIG_UNAVAILABLE');
    assert.deepEqual(await f.put({ enabled: false, devices: [] }, view.csrfToken), { status: 400, body: { error: 'EOS_MODULE_CONFIG_UNAVAILABLE' } });
    assert.deepEqual(f.owner.config, before); assert.equal(f.writes.length, 0);
    f.failRead(false); view = await f.get();
    assert.equal(view.configurationReady, true); assert.equal(view.config.devices[0].id, 'meter1');
});

test('operational start joins a concurrent editor read and stopping during that read never activates a module', async t => {
    for (const stopping of [false, true]) {
        const f = await fixture(t, { enabled: true, devices: [meter] });
        let release, entered;
        const gate = new Promise(resolve => { release = resolve; });
        const reached = new Promise(resolve => { entered = resolve; });
        const load = f.host().configStore.load.bind(f.host().configStore);
        let first = true;
        f.host().configStore.load = async id => { if (first) { first = false; entered(); await gate; } return load(id); };
        const viewing = f.host().view('devices'); await reached;
        const starting = f.host().start();
        if (stopping) await f.host().stop();
        release(); await Promise.all([viewing, starting]);
        assert.equal(f.runtimes.length, stopping ? 0 : 1);
        assert.equal(f.writes.length, 0);
        if (!stopping) assert.deepEqual(f.runtimes[0].config.devices, [meter]);
    }
});

test('operational start joins an accepted pre-start save, preserving commit errors and shutdown fencing', async t => {
    for (const outcome of ['commit', 'error', 'stop']) {
        const f = await fixture(t, { enabled: true, devices: [meter] });
        await f.get();
        let release, entered;
        const gate = new Promise(resolve => { release = resolve; });
        const reached = new Promise(resolve => { entered = resolve; });
        const save = f.host().configStore.save.bind(f.host().configStore);
        f.host().configStore.save = async (...args) => {
            entered(); await gate;
            if (outcome === 'error') throw new Error('fixture commit failed');
            return save(...args);
        };
        const edited = { ...meter, name: 'Saved during startup' };
        const saving = f.host().save('devices', { enabled: true, devices: [edited] }).then(value => ({ value }), error => ({ error }));
        await reached;
        let startSettled = false;
        const starting = f.host().start().then(() => { startSettled = true; return null; }, error => { startSettled = true; return error; });
        await new Promise(resolve => setImmediate(resolve));
        const settledBeforeCommit = startSettled;
        if (outcome === 'stop') await f.host().stop();
        release();
        const [saveResult, startError] = await Promise.all([saving, starting]);
        assert.equal(settledBeforeCommit, false, 'startup must join the accepted configuration mutation instead of returning BUSY');
        assert.equal(startError, null);
        if (outcome === 'error') {
            assert.match(saveResult.error.message, /fixture commit failed/);
            assert.equal(f.writes.length, 0);
            assert.equal(f.runtimes.length, 1);
            assert.deepEqual(f.runtimes[0].config.devices, [meter], 'startup uses the retained authoritative configuration after the rejected save');
        } else {
            assert.equal(saveResult.error, undefined);
            assert.deepEqual(f.writes, [configurationId]);
            assert.equal(f.runtimes.length, outcome === 'stop' ? 0 : 1);
            if (outcome === 'commit') assert.deepEqual(f.runtimes[0].config.devices, [edited]);
        }
    }
});
