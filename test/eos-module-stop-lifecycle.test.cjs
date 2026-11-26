/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EosModuleHost } = require('../src/lib/eosModuleHost');

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
const turn = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate) {
    for (let i = 0; i < 100; i++) { if (predicate()) return; await turn(); }
    assert.fail('fixture did not reach requested lifecycle point');
}
function fixture({ pendingStart = true, stopTimeoutMs = 1000, stopFailure = 0 } = {}) {
    const start = deferred(); const objects = new Map(); const writes = []; const subscriptions = [];
    const encrypt = value => `encrypted:${Buffer.from(value).toString('base64')}`;
    const owner = {
        namespace: 'eos-admin.0', instance: 0,
        // This fixture isolates Devices; absent module configuration now means
        // enabled for commissioning, so unrelated runtimes are explicitly off.
        config: { eosModules: Object.fromEntries(['devices', 'eebus', 'backup', 'ocpp']
            .map(id => [id, { v: 1, encrypted: encrypt(JSON.stringify({ enabled: id === 'devices' })) }])) },
        log: { warn() {} }, eosLicenseService: { allowsEmbeddedModule: () => true }, eosOwnership: { canWrite: () => true },
        encrypt, decrypt: value => Buffer.from(value.slice(10), 'base64').toString(),
        async getForeignObjectAsync(id) { return id === 'system.adapter.eos-admin.0' ? { native: owner.config } : objects.get(id); },
        async getForeignStateAsync() {}, async getObjectViewAsync() { return { rows: [] }; },
        async setForeignObjectAsync(id, value) { objects.set(id, value); },
        async setForeignObjectNotExistsAsync() {}, async extendForeignObjectAsync() {},
        async setForeignStateAsync(...args) { writes.push(args); },
        async subscribeForeignObjectsAsync() {}, async subscribeForeignStatesAsync(id) { subscriptions.push(['sub', id]); },
        async unsubscribeForeignStatesAsync(id) { subscriptions.push(['unsub', id]); },
    };
    let created = 0, module;
    const factory = { validateConfig: value => ({ ...value, enabled: value.enabled === true }), createHostedModule(options) {
        created++;
        module = { options, opened: false, starts: 0, stops: 0,
            async start() { this.starts++; if (pendingStart) await start.promise; this.opened = true; },
            async stop() { this.stops++; if (stopFailure === this.stops) throw new Error('synthetic cleanup failure'); this.opened = false; },
            getStatus: () => ({}),
        };
        return module;
    } };
    const host = new EosModuleHost(owner, { baseDir: '.', dataDir: '/tmp/synthetic-eos-module-stop', stopTimeoutMs, factories: { devices: factory, eebus: factory, backup: factory } });
    return { host, owner, start, writes, subscriptions, module: () => module, created: () => created };
}

test('stop during command subscription acquisition never opens hardware and drains coverage', async () => {
    const f = fixture({ pendingStart: false }); const acquired = deferred(); const active = new Set();
    let waiting = false;
    f.owner.subscribeForeignStatesAsync = async pattern => {
        if (pattern === 'eos-admin.0.devices.*') { waiting = true; await acquired.promise; }
        active.add(pattern);
    };
    f.owner.unsubscribeForeignStatesAsync = async pattern => { active.delete(pattern); };
    const { installEosStateSubscriptions } = require('tsx/cjs/api').require(require('node:path').resolve(__dirname, '../src/lib/eosStateSubscriptions.ts'), __filename);
    f.owner.eosStateSubscriptions = installEosStateSubscriptions(f.owner);
    const starting = f.host.start(); await until(() => waiting);
    assert.equal(f.created(), 0, 'subscription must precede module construction and driver start');
    let stopped = false; const stopping = f.host.stop().then(() => { stopped = true; });
    await turn(); assert.equal(stopped, false);
    acquired.resolve(); await Promise.all([starting, stopping]);
    assert.equal(f.created(), 0); assert.equal(active.has('eos-admin.0.devices.*'), false);
    await f.owner.eosStateSubscriptions.close(); assert.equal(active.size, 0);
});

test('a later factory failure after a successful stop releases its new command subscription', async () => {
    const f = fixture({ pendingStart: false });
    await f.host.start();
    const entry = f.host.entries.get('devices');
    await f.host.stopEntry(entry);
    assert.equal(f.subscriptions.filter(([op, pattern]) => op === 'unsub' && pattern === 'eos-admin.0.devices.*').length, 1);
    f.host.options.factories.devices.createHostedModule = () => { throw new Error('fixture factory failure'); };
    f.host.nextOwnershipCheck = 0;
    await f.host.reconcile();
    assert.equal(f.subscriptions.filter(([op, pattern]) => op === 'sub' && pattern === 'eos-admin.0.devices.*').length, 2);
    assert.equal(f.subscriptions.filter(([op, pattern]) => op === 'unsub' && pattern === 'eos-admin.0.devices.*').length, 2,
        'previous resolved stop promise must not skip cleanup of a new acquisition');
    await f.host.stop();
});

test('failed command subscription prevents factory creation and device writes', async () => {
    const f = fixture({ pendingStart: false });
    f.owner.subscribeForeignStatesAsync = async pattern => {
        if (pattern === 'eos-admin.0.devices.*') throw new Error('fixture denied subscription');
    };
    await f.host.start();
    assert.equal(f.created(), 0); assert.equal(f.writes.length, 0);
    assert.equal((await f.host.status('devices')).active, false);
    assert.equal(f.host.entries.get('devices').failed, true);
    await f.host.stop();
});

test('hung command subscription times out fail-closed and late completion is drained', async t => {
    const f = fixture({ pendingStart: false, stopTimeoutMs: 1000 });
    const acquired = deferred(); const active = new Set(); let waiting = false;
    f.owner.subscribeForeignStatesAsync = async pattern => {
        if (pattern === 'eos-admin.0.devices.*') { waiting = true; await acquired.promise; }
        active.add(pattern);
    };
    f.owner.unsubscribeForeignStatesAsync = async pattern => { active.delete(pattern); };
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const starting = f.host.start(); await until(() => waiting);
    // The original acquisition remains pending, while its public startup deadline
    // and then cleanup deadline expire. No successful stop is invented.
    t.mock.timers.tick(10001);
    await until(() => f.host.entries.get('devices').stopEntryPromise);
    t.mock.timers.tick(1001); await starting;
    assert.equal(f.created(), 0); assert.equal(f.host.entries.get('devices').stopFailed, true);
    await assert.rejects(f.host.stop(), /EOS_MODULE_STOP_UNCONFIRMED/);
    acquired.resolve(); await until(() => !f.host.entries.get('devices').commandSubscriptionPending);
    assert.equal(active.has('eos-admin.0.devices.*'), false);
    assert.equal(f.created(), 0, 'late subscription never opens a revoked hardware generation');
    assert.equal(f.host.entries.get('devices').stopFailed, true, 'late cleanup cannot promote uncertain stop');
});

test('module presence does not report active until its original start promise succeeds', async () => {
    const f = fixture(); const starting = f.host.start(); await until(() => f.module()?.starts === 1);
    assert.equal((await f.host.status('devices')).active, false);
    f.start.resolve(); await starting;
    assert.equal((await f.host.status('devices')).active, true);
    assert.equal((await f.host.status('devices')).reason, 'RUNNING');
    f.host.nextOwnershipCheck = 0; await f.host.reconcile();
    assert.equal((await f.host.status('devices')).reason, 'RUNNING', 'lease refresh preserves readiness');
    await f.host.stop(); assert.equal(f.module().stops, 1);
});

test('concurrent stop waits for late startup and closes newly opened transports before resolving', async () => {
    const f = fixture(); const starting = f.host.start(); await until(() => f.module()?.starts === 1);
    const adapter = f.module().options.adapter;
    let completed = false;
    const stopped = f.host.stop().then(() => { completed = true; });
    const stoppedAgain = f.host.stop();
    assert.equal(f.module().options.canOperate(), false, 'operation permission revoked synchronously');
    await until(() => f.module().stops === 1);
    assert.equal(completed, false); assert.equal((await f.host.status('devices')).active, false);
    await assert.rejects(adapter.setStateAsync('devices.light.set', { val: true, ack: false }), /EOS_MODULE_STOPPED/);
    assert.throws(() => adapter.setInterval(() => {}, 5), /EOS_MODULE_TIMER/);
    f.start.resolve(); await Promise.all([starting, stopped, stoppedAgain]);
    assert.equal(f.module().opened, false); assert.equal(f.module().stops, 2);
    assert.equal(f.host.timer, null); assert.equal(f.created(), 1);
    await f.host.start(); assert.equal(f.created(), 1);
});

test('a rejected pending startup still receives final cleanup before stop confirmation', async () => {
    const f = fixture(); const starting = f.host.start(); await until(() => f.module()?.starts === 1);
    const stopped = f.host.stop(); await until(() => f.module().stops === 1);
    f.start.reject(new Error('synthetic startup failure'));
    await Promise.all([starting, stopped]);
    assert.equal(f.module().stops, 2); assert.equal(f.module().opened, false);
    assert.equal(f.host.entries.get('devices').stopFailed, undefined);
});

test('timeout is sticky unconfirmed shutdown; late startup cleanup cannot authorize a rollback', async () => {
    const f = fixture({ stopTimeoutMs: 20 }); const starting = f.host.start(); await until(() => f.module()?.starts === 1);
    await assert.rejects(f.host.stop(), /EOS_MODULE_STOP_UNCONFIRMED/);
    assert.equal(f.host.entries.get('devices').stopFailed, true);
    assert.equal(f.module().options.canOperate(), false);
    f.start.resolve(); await starting; await until(() => f.module().stops === 2);
    assert.equal(f.module().opened, false);
    await assert.rejects(f.host.stop(), /EOS_MODULE_STOP_UNCONFIRMED/);
    assert.equal((await f.host.status('devices')).active, false);
    assert.equal((await f.host.status('devices')).reason, 'STOP_FAILED_RESTART_REQUIRED');
});

test('a failing final cleanup remains unconfirmed even when the first cleanup succeeded', async () => {
    const f = fixture({ stopFailure: 2 }); const starting = f.host.start(); await until(() => f.module()?.starts === 1);
    const rejected = assert.rejects(f.host.stop(), /EOS_MODULE_STOP_UNCONFIRMED/);
    await until(() => f.module().stops === 1); f.start.resolve(); await Promise.all([starting, rejected]);
    assert.equal(f.module().stops, 2); assert.equal(f.host.entries.get('devices').stopFailed, true);
    assert.equal(f.module().options.canOperate(), false); assert.equal((await f.host.status('devices')).active, false);
});

test('a failed running transport shutdown cannot be hidden by host stop or reconfiguration', async () => {
    const f = fixture({ pendingStart: false, stopFailure: 1 }); await f.host.start();
    await assert.rejects(f.host.stop(), /EOS_MODULE_STOP_UNCONFIRMED/);
    await assert.rejects(f.host.save('devices', { enabled: true }), /EOS_MODULE_BUSY/);
    assert.equal(f.host.entries.get('devices').stopFailed, true); assert.equal(f.created(), 1);
});

test('shutdown during configuration read cannot create a delayed module or subscription', async () => {
    const f = fixture(); const loaded = deferred();
    f.host.configStore.load = () => loaded.promise;
    const starting = f.host.start(); await f.host.stop(); loaded.resolve(null); await starting;
    assert.equal(f.created(), 0); assert.equal(f.host.timer, null); assert.deepEqual(f.subscriptions, []);
});

test('a late facade subscription is immediately removed after its generation was revoked', async () => {
    const f = fixture({ pendingStart: false }); await f.host.start();
    const adapter = f.module().options.adapter; const pending = deferred();
    f.owner.subscribeForeignStatesAsync = () => pending.promise;
    const subscribing = assert.rejects(adapter.subscribeStatesAsync('devices.light.*'), /EOS_MODULE_SUBSCRIPTION/);
    await f.host.stop(); pending.resolve(); await subscribing;
    assert.deepEqual(f.subscriptions.at(-1), ['unsub', 'eos-admin.0.devices.light.*']);
    assert.equal(f.host.entries.get('devices').subscriptions.size, 0);
});


test('confirmed stop waits for every accepted state/create/extend mutation to settle', async () => {
    const f = fixture({ pendingStart: false }); await f.host.start();
    const adapter = f.module().options.adapter;
    const state = deferred(), create = deferred(), extend = deferred();
    const passed = [];
    f.owner.setForeignStateAsync = () => { passed.push('state'); return state.promise; };
    f.owner.setForeignObjectNotExistsAsync = () => { passed.push('create'); return create.promise; };
    f.owner.extendForeignObjectAsync = () => { passed.push('extend'); return extend.promise; };
    const stateWrite = adapter.setStateAsync('devices.light.set', { val: true, ack: false });
    const createWrite = adapter.setObjectNotExistsAsync('devices.light.set', { type: 'state' });
    const extendWrite = assert.rejects(adapter.extendObjectAsync('devices.light.set', { common: { name: 'Light' } }), /synthetic rejected write/);
    await until(() => passed.length === 3);
    let stopped = false;
    const stopping = f.host.stop().then(() => { stopped = true; });
    await until(() => f.module().stops === 1);
    assert.equal(stopped, false); assert.equal(f.host.entries.get('devices').pendingWrites.size, 3);
    state.resolve(); create.resolve(); await Promise.all([stateWrite, createWrite]); await turn();
    assert.equal(stopped, false, 'last controller mutation still unsettled');
    extend.reject(new Error('synthetic rejected write')); await Promise.all([extendWrite, stopping]);
    assert.equal(f.host.entries.get('devices').pendingWrites.size, 0);
});

test('pending mutation timeout stays unconfirmed; bounded capacity and revoked calls never forward or retry', async () => {
    const f = fixture({ pendingStart: false, stopTimeoutMs: 20 }); await f.host.start();
    const adapter = f.module().options.adapter; const pending = deferred(); let forwarded = 0;
    f.owner.setForeignStateAsync = () => { forwarded++; return pending.promise; };
    const writes = Array.from({ length: 4096 }, () => adapter.setStateAsync('devices.light.set', { val: true, ack: false }));
    await assert.rejects(adapter.setStateAsync('devices.light.set', { val: false, ack: false }), /EOS_MODULE_WRITE_LIMIT/);
    assert.equal(f.host.entries.get('devices').pendingWrites.size, 4096);
    await until(() => forwarded === 4096);
    await assert.rejects(f.host.stop(), /EOS_MODULE_STOP_UNCONFIRMED/);
    await assert.rejects(adapter.setStateAsync('devices.light.set', { val: false, ack: false }), /EOS_MODULE_STOPPED/);
    await assert.rejects(adapter.setObjectNotExistsAsync('devices.light.set', {}), /EOS_MODULE_STOPPED/);
    await assert.rejects(adapter.extendObjectAsync('devices.light.set', {}), /EOS_MODULE_STOPPED/);
    await adapter.setStateAsync('devices.light.actual', { val: false, ack: true }); // stale cleanup telemetry is discarded.
    assert.equal(forwarded, 4096);
    pending.resolve(); await Promise.all(writes); await turn();
    assert.equal(f.host.entries.get('devices').pendingWrites.size, 0);
    await assert.rejects(f.host.stop(), /EOS_MODULE_STOP_UNCONFIRMED/);
    assert.equal(forwarded, 4096, 'no automatic replay after a late controller completion');
});
