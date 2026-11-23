'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EosModuleHost, redact, restoreSecrets, assertJson } = require('../src/lib/eosModuleHost');

function setup(configs = { devices: { enabled: true }, eebus: { enabled: false } }) {
    const objects = new Map(); const states = new Map(); const instances = []; const writes = [];
    const encrypt = value => `encrypted:${Buffer.from(value).toString('base64')}`;
    const owner = {
        namespace: 'eos-admin.0', instance: 0, config: { eosModules: Object.fromEntries(Object.entries(configs).map(([id, config]) => [id, { v: 1, encrypted: encrypt(JSON.stringify(config)) }])) },
        log: { warn() {} }, licensed: true, owned: true,
        eosLicenseService: { allowsEmbeddedModule: () => owner.licensed }, eosOwnership: { canWrite: () => owner.owned },
        encrypt, decrypt: value => Buffer.from(value.slice(10), 'base64').toString(),
        async getObjectViewAsync(_design, _type, range) { return { rows: [...objects.values()].filter(item => item._id >= range.startkey && item._id <= range.endkey).map(value => ({ value })) }; },
        async getForeignObjectAsync(id) { return id === 'system.adapter.eos-admin.0' ? { native: { ...owner.config } } : objects.get(id); },
        async getForeignStateAsync(id) { return states.get(id); },
        async extendForeignObjectAsync(id, object) { writes.push({ type: 'object', id, object }); },
        async setForeignObjectNotExistsAsync(id, object) { writes.push({ type: 'object', id, object }); },
        async setForeignStateAsync(id, value, ack) { writes.push({ type: 'state', id, value, ack }); },
        async subscribeForeignObjectsAsync() {}, async subscribeForeignStatesAsync() {}, async unsubscribeForeignStatesAsync() {},
    };
    const factory = {
        validateConfig: value => ({ ...value, enabled: value.enabled === true }),
        command: async (name, payload) => { if (name !== 'getCatalog') throw new Error('unsupported'); return { templates: [] }; },
        createHostedModule(options) {
            const instance = { options, starts: 0, stops: 0, async start() { this.starts++; }, async stop() {
                this.stops++;
                await options.adapter.setStateAsync(options.adapter.namespace.endsWith('.eebus') ? 'info.connection' : 'modules.devices.info.connection', { val: false, ack: true });
            }, async getStatus() { return { healthy: true }; }, command: async () => ({ accepted: true }) };
            instances.push(instance); return instance;
        },
    };
    const host = new EosModuleHost(owner, { baseDir: '.', dataDir: '/tmp/eos-module-unit-only', factories: { devices: factory, eebus: factory } });
    return { host, owner, objects, states, instances, writes, factory };
}

test('one central entitlement starts the integrated module without a second adapter or license', async t => {
    const x = setup(); t.after(() => x.host.stop()); await x.host.start();
    assert.equal(x.instances.length, 1); assert.equal(x.instances[0].options.adapter.namespace, 'eos-admin.0');
    assert.equal(x.instances[0].options.canOperate(), true);
    assert.equal((await x.host.view('devices')).status.active, true);
    assert.deepEqual((await x.host.view('devices')).status.details, { healthy: true });
});

test('disabled and unlicensed modules create no runtime; metadata remains available', async t => {
    const x = setup(); x.owner.licensed = false; t.after(() => x.host.stop()); await x.host.start();
    assert.equal(x.instances.length, 0);
    assert.deepEqual(await x.host.command('devices', 'getCatalog', {}), { templates: [] });
    await assert.rejects(x.host.command('eebus', 'pairing.approve', { deviceId: 'a'.repeat(40) }), /INACTIVE/);
});

test('license loss denies existing operation closures synchronously and stops transports', async t => {
    const x = setup(); t.after(() => x.host.stop()); await x.host.start(); const old = x.instances[0];
    x.owner.licensed = false; assert.equal(old.options.canOperate(), false); await x.host.reconcile();
    assert.equal(old.stops, 1); assert.equal(x.host.entries.get('devices').failed, false);
    x.owner.licensed = true; x.host.nextOwnershipCheck = 0; await x.host.reconcile();
    assert.equal(x.instances.length, 2); assert.equal(old.options.canOperate(), false); assert.equal(x.instances[1].options.canOperate(), true);
});

test('normal host heartbeat preserves a running module and generation', async t => {
    const x = setup(); t.after(() => x.host.stop()); await x.host.start();
    x.host.onStateChange('system.host.controller.alive', { val: true, ack: true, ts: Date.now() });
    await x.host.reconcile(); assert.equal(x.instances.length, 1); assert.equal(x.instances[0].options.canOperate(), true);
});

test('legacy enable revokes immediately; confirmed stop creates a new valid generation', async t => {
    const x = setup(); t.after(() => x.host.stop()); await x.host.start(); const old = x.instances[0];
    const id = 'system.adapter.nexowatt-devices.0'; const now = Date.now();
    x.objects.set(id, { _id: id, type: 'instance', ts: now - 100, common: { enabled: true, host: 'other' } });
    x.host.onObjectChange(id); assert.equal(old.options.canOperate(), false); await x.host.reconcile();
    assert.equal(old.stops, 1); assert.equal((await x.host.status('devices')).active, false);
    x.objects.get(id).common.enabled = false;
    x.states.set(`${id}.alive`, { val: false, ack: true, ts: now });
    x.states.set('system.host.other.alive', { val: true, ack: true, ts: now });
    x.host.onObjectChange(id); await x.host.reconcile();
    assert.equal(x.instances.length, 2); assert.equal(x.instances[1].options.canOperate(), true);
    assert.equal(old.options.canOperate(), false);
});

test('a race during legacy inventory cannot renew an invalidated operation lease', async t => {
    const x = setup(); t.after(() => x.host.stop()); await x.host.start(); const old = x.instances[0];
    let release; const waiting = new Promise(resolve => { release = resolve; });
    x.owner.getObjectViewAsync = async () => { await waiting; return { rows: [] }; };
    x.host.nextOwnershipCheck = 0; const pending = x.host.reconcile();
    x.host.onObjectChange('system.adapter.nexowatt-devices.9'); release(); await pending;
    assert.equal(old.options.canOperate(), false); assert.equal((await x.host.status('devices')).active, false);
});

test('facade constrains namespaces and suppresses stale telemetry after lifecycle end', async t => {
    const x = setup(); t.after(() => x.host.stop()); await x.host.start(); const adapter = x.instances[0].options.adapter;
    assert.throws(() => adapter.setStateAsync('chargingManagement.control.command', 3, false), /SCOPE/);
    await adapter.setStateAsync('devices.meter.power', 7, true);
    assert.equal(x.writes.at(-1).id, 'eos-admin.0.devices.meter.power');
    const oldCount = x.writes.length; await x.host.stop();
    await adapter.setStateAsync('devices.meter.power', 99, true); assert.equal(x.writes.length, oldCount);
    await assert.rejects(adapter.setStateAsync('devices.meter.power', 99, false), /STOPPED/);
});

test('secret masking and restoration follow device IDs when rows move', () => {
    const old = { devices: [{ id: 'one', connection: { password: 'one-secret', headers: { Authorization: 'Bearer hidden' }, baseUrl: 'https://u:p@device.invalid/' } }, { id: 'two', connection: { password: 'two-secret' } }] };
    const masked = redact(old); assert.equal(JSON.stringify(masked).includes('secret'), false);
    assert.equal(JSON.stringify(masked).includes('Bearer hidden'), false); assert.equal(JSON.stringify(masked).includes('u:p@'), false);
    masked.devices.reverse(); const restored = restoreSecrets(masked, old);
    assert.equal(restored.devices[0].connection.password, 'two-secret');
    assert.equal(restored.devices[1].connection.password, 'one-secret');
    masked.devices[0].id = 'new-device'; assert.throws(() => restoreSecrets(masked, old), /SECRET_MISSING/);
});

test('saved configurations are encrypted and API views never return device credentials', async t => {
    const x = setup({ devices: { enabled: false }, eebus: { enabled: false } }); t.after(() => x.host.stop()); await x.host.start();
    const view = await x.host.save('devices', { enabled: false, devices: [{ id: 'one', connection: { password: 'sensitive-config' } }] });
    assert.equal(JSON.stringify(view).includes('sensitive-config'), false);
    const stored = x.writes.find(write => write.id === 'system.adapter.eos-admin.0').object.native;
    assert.equal(JSON.stringify(stored).includes('sensitive-config'), false);
    assert.equal(x.host.readConfig('devices').devices[0].connection.password, 'sensitive-config');
});

test('configuration cannot reopen a runtime after failed transport shutdown', async t => {
    const x = setup(); t.after(() => x.host.stop()); await x.host.start();
    x.instances[0].stop = async () => { throw new Error('transport did not stop'); };
    await x.host.save('devices', { enabled: true }); await x.host.reconcile();
    await x.host.save('devices', { enabled: true }); await x.host.reconcile();
    assert.equal(x.instances.length, 1); assert.equal((await x.host.status('devices')).reason, 'STOP_FAILED_RESTART_REQUIRED');
});

test('config rejects prototype keys and excessive depth before persistence', () => {
    assert.throws(() => assertJson(JSON.parse('{"__proto__":{"polluted":true}}')), /CONFIG_KEY/);
    let deep = {}; for (let i = 0; i < 20; i++) deep = { child: deep };
    assert.throws(() => assertJson(deep), /CONFIG_DEPTH/);
});

test('integrated licenses preserve NWL2 adapter scope and fail closed on expired core entitlement', () => {
    const { EosLicenseService } = require('../src/lib/eosLicenseService');
    const allows = EosLicenseService.prototype.allowsEmbeddedModule;
    const service = { statusView: () => ({ valid: true, coreEnabled: true }), claims: { scope: 'system', adapters: [] } };
    assert.equal(allows.call(service, 'devices'), true); assert.equal(allows.call(service, 'eebus'), true);
    assert.equal(allows.call(service, 'constructor'), false);
    service.claims = { scope: 'adapters', adapters: ['nexowatt-ui'] };
    assert.equal(allows.call(service, 'devices'), false); assert.equal(allows.call(service, 'eebus'), false);
    service.claims.adapters.push('nexowatt-devices'); assert.equal(allows.call(service, 'devices'), true);
    service.statusView = () => ({ valid: false, coreEnabled: false });
    assert.equal(allows.call(service, 'devices'), false);
});

test('concurrent HTTP-close and adapter-unload share transport cleanup, and late startup never installs a timer', async () => {
    const x = setup(); await x.host.start();
    await Promise.all([x.host.stop(), x.host.stop()]); assert.equal(x.instances[0].stops, 1);
    const y = setup(); let release;
    y.owner.subscribeForeignObjectsAsync = () => new Promise(resolve => { release = resolve; });
    const starting = y.host.start(); await y.host.stop(); release(); await starting;
    assert.equal(y.host.timer, null); assert.equal(y.instances.length, 0);
});
