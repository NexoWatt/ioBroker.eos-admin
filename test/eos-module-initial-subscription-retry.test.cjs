'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EosModuleHost } = require(path.join(process.env.EOS_STARTUP_BASELINE || path.join(__dirname, '..'), 'src/lib/eosModuleHost'));

const turn = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate) {
    for (let count = 0; count < 100 && !predicate(); count++) await turn();
    assert.ok(predicate(), 'expected asynchronous startup boundary');
}

function fixture(t, configuration = {}, processEnabled = () => true) {
    const calls = [], modules = [], warnings = [], objects = new Map();
    const configs = Object.fromEntries(['devices', 'eebus', 'backup', 'ocpp'].map(id => [id,
        { enabled: id === 'devices', ...configuration[id] }]));
    const encrypt = value => `fixture:${Buffer.from(value).toString('base64')}`;
    const owner = {
        namespace: 'eos-admin.0', instance: 0,
        config: { eosModules: Object.fromEntries(Object.entries(configs).map(([id, config]) =>
            [id, { v: 1, encrypted: encrypt(JSON.stringify(config)) }])) },
        encrypt, decrypt: value => Buffer.from(value.slice(8), 'base64').toString(),
        log: { warn: message => warnings.push(message) },
        eosLicenseService: { allowsEmbeddedModule: () => true }, eosOwnership: { canWrite: () => true },
        async getForeignObjectAsync(id) { return objects.get(id); },
        async getObjectViewAsync() { return { rows: [] }; },
        async getForeignStateAsync() { return null; },
        async setForeignObjectAsync(id, value) { objects.set(id, structuredClone(value)); },
        async setForeignObjectNotExistsAsync() {}, async setForeignStateAsync() {},
        async subscribeForeignObjectsAsync(pattern) { calls.push(['objects', pattern]); },
        async subscribeForeignStatesAsync(pattern) { calls.push(['states', pattern]); },
        async unsubscribeForeignStatesAsync() {},
    };
    const factory = {
        validateConfig(config) { if (config.invalid) throw new Error('SYNTHETIC_CONFIG_INVALID'); return config; },
        createHostedModule(options) {
            const runtime = { options, starts: 0, stops: 0,
                async start() { this.starts++; }, async stop() { this.stops++; } };
            modules.push(runtime); return runtime;
        },
    };
    const host = new EosModuleHost(owner, { baseDir: '.', dataDir: '/tmp/unused-eos-subscription-fixture',
        factories: Object.fromEntries(Object.keys(configs).map(id => [id, factory])), processEnabled });
    t.after(() => host.stop());
    return { host, owner, calls, modules, warnings };
}

test('one startup automatically recovers a transient controller subscription failure', async t => {
    const x = fixture(t); const original = structuredClone(x.owner.config);
    let attempts = 0;
    const subscribe = x.owner.subscribeForeignStatesAsync;
    x.owner.subscribeForeignStatesAsync = async pattern => {
        if (pattern === 'system.adapter.nexowatt-devices.*.alive' && ++attempts === 1) {
            throw new Error('SYNTHETIC_DB_UNAVAILABLE');
        }
        await subscribe(pattern);
    };
    await x.host.start();
    assert.equal(attempts, 2);
    assert.equal(x.host.initialized, true);
    assert.equal(x.modules.length, 1);
    assert.equal(x.modules[0].starts, 1);
    assert.equal(x.calls.filter(([kind]) => kind === 'objects').length, 4);
    assert.equal(new Set(x.calls.map(JSON.stringify)).size, x.calls.length);
    assert.deepEqual(x.owner.config, original);
});

test('parallel initial starts share subscriptions, one runtime and one reconcile timer', async t => {
    const x = fixture(t); let release;
    const gate = new Promise(resolve => { release = resolve; });
    const subscribe = x.owner.subscribeForeignObjectsAsync;
    x.owner.subscribeForeignObjectsAsync = async pattern => { await gate; await subscribe(pattern); };
    const starts = [x.host.start(), x.host.start(), x.host.start()];
    release(); await Promise.all(starts);
    const timer = x.host.timer;
    await x.host.start();
    assert.equal(x.host.timer, timer);
    assert.equal(x.modules.length, 1);
    assert.equal(x.modules[0].starts, 1);
    assert.equal(x.calls.filter(([kind]) => kind === 'objects').length, 4);
});

test('exhausted startup retries are bounded and a later explicit start can recover', async t => {
    const x = fixture(t); let attempts = 0, unavailable = true;
    const subscribe = x.owner.subscribeForeignStatesAsync;
    x.owner.subscribeForeignStatesAsync = async pattern => {
        if (pattern === 'system.adapter.nexowatt-devices.*.alive') {
            attempts++;
            if (unavailable) throw new Error('SYNTHETIC_DB_UNAVAILABLE');
        }
        await subscribe(pattern);
    };
    await assert.rejects(x.host.start(), /SYNTHETIC_DB_UNAVAILABLE/);
    assert.equal(attempts, 3);
    assert.equal(x.host.startPromise, null);
    assert.equal(x.host.running, false);
    assert.equal(x.host.timer, null);
    assert.equal(x.modules.length, 0);
    unavailable = false;
    await x.host.start();
    assert.equal(attempts, 4);
    assert.equal(x.modules.length, 1);
    assert.equal(x.calls.filter(([kind, pattern]) => kind === 'objects' && pattern === 'system.adapter.nexowatt-devices.*').length, 1);
});

test('stop during retry delay cancels further attempts and never starts a module', async t => {
    const x = fixture(t); let attempts = 0;
    x.owner.subscribeForeignObjectsAsync = async () => { attempts++; throw new Error('SYNTHETIC_DB_UNAVAILABLE'); };
    const starting = x.host.start(); void starting.catch(() => undefined);
    await until(() => x.warnings.length > 0);
    await x.host.stop(); await starting;
    assert.equal(attempts, 1);
    assert.equal(x.host.timer, null);
    assert.equal(x.host.startupWaits.size, 0);
    assert.equal(x.host.startupSubscriptions.size, 0);
    assert.equal(x.modules.length, 0);
});

test('a timeout waits again for the same pending subscription instead of issuing a duplicate', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const x = fixture(t); let release, attempts = 0;
    const subscribe = x.owner.subscribeForeignObjectsAsync;
    x.owner.subscribeForeignObjectsAsync = async pattern => {
        attempts++;
        if (pattern === 'system.adapter.nexowatt-devices.*') await new Promise(resolve => { release = resolve; });
        await subscribe(pattern);
    };
    const starting = x.host.start(); void starting.catch(() => undefined);
    await until(() => typeof release === 'function');
    t.mock.timers.tick(5000);
    await until(() => x.warnings.length > 0);
    t.mock.timers.tick(1000); await turn();
    assert.equal(attempts, 1);
    release(); await starting;
    assert.equal(attempts, 4);
    assert.equal(x.modules.length, 1);
});

test('stop during a pending initial subscription fences its late completion', async t => {
    const x = fixture(t); let release;
    x.owner.subscribeForeignObjectsAsync = () => new Promise(resolve => { release = resolve; });
    const starting = x.host.start();
    await until(() => typeof release === 'function');
    await x.host.stop(); release(); await starting;
    assert.equal(x.host.initialized, false);
    assert.equal(x.host.timer, null);
    assert.equal(x.modules.length, 0);
});

test('subscription recovery preserves explicit module/process disables and invalid configuration fences', async t => {
    const x = fixture(t, { devices: { enabled: true }, eebus: { enabled: true, invalid: true },
        backup: { enabled: false }, ocpp: { enabled: true } }, id => id !== 'ocpp');
    const original = structuredClone(x.owner.config);
    let attempts = 0;
    const subscribe = x.owner.subscribeForeignObjectsAsync;
    x.owner.subscribeForeignObjectsAsync = async pattern => {
        if (++attempts === 1) throw new Error('SYNTHETIC_DB_UNAVAILABLE');
        await subscribe(pattern);
    };
    await x.host.start();
    assert.equal(x.modules.length, 1);
    assert.equal(x.host.entries.get('devices').started, true);
    assert.equal(x.host.entries.get('eebus').configLoaded, false);
    assert.equal(x.host.entries.get('backup').config.enabled, false);
    assert.equal(x.host.entries.get('ocpp').started, false);
    assert.deepEqual(x.owner.config, original);
});
