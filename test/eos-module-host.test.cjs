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
        async setForeignObjectAsync(id, object) { objects.set(id, structuredClone(object)); writes.push({ type: 'object', id, object }); },
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
    const stored = x.writes.find(write => write.id === 'eos-admin.0.modules.devices.configuration').object.native;
    assert.equal(JSON.stringify(stored).includes('sensitive-config'), false);
    assert.equal(x.host.readConfig('devices').devices[0].connection.password, 'sensitive-config');
});

test('configuration cannot reopen a runtime after failed transport shutdown', async t => {
    const x = setup(); t.after(() => assert.rejects(x.host.stop(), /EOS_MODULE_STOP_UNCONFIRMED/)); await x.host.start();
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
    assert.equal(allows.call(service, 'backup'), true);
    assert.equal(allows.call(service, 'constructor'), false);
    service.claims = { scope: 'adapters', adapters: ['nexowatt-ui'] };
    assert.equal(allows.call(service, 'devices'), false); assert.equal(allows.call(service, 'eebus'), false);
    assert.equal(allows.call(service, 'backup'), false);
    service.claims.adapters.push('nexowatt-backup'); assert.equal(allows.call(service, 'backup'), true);
    service.claims.adapters.push('nexowatt-devices'); assert.equal(allows.call(service, 'devices'), true);
    service.statusView = () => ({ valid: false, coreEnabled: false });
    assert.equal(allows.call(service, 'devices'), false);
});

test('concurrent HTTP-close and adapter-unload share transport cleanup, and late startup never installs a timer', async () => {
    const x = setup(); await x.host.start();
    await Promise.all([x.host.stop(), x.host.stop()]); assert.equal(x.instances[0].stops, 1);
    const y = setup(); let release;
    y.owner.subscribeForeignObjectsAsync = () => new Promise(resolve => { release = resolve; });
    const starting = y.host.start();
    while (!release) await new Promise(resolve => setImmediate(resolve));
    await y.host.stop(); release(); await starting;
    assert.equal(y.host.timer, null); assert.equal(y.instances.length, 0);
});

test('preserved legacy EEBus namespace keeps state IDs while private bridge remains tied to EOS owner', async t => {
    const x = setup({ devices: { enabled: false }, eebus: { enabled: true } }); t.after(() => x.host.stop());
    x.owner.config.eosModules.eebus.migration = { preserveNamespace: true, source: 'eebus.0' };
    x.owner.config.eosUiMigration = { preserveNamespace: true, source: 'nexowatt-ui.0' };
    let received, feedback;
    const create = x.factory.createHostedModule;
    x.factory.createHostedModule = options => { const module = create(options); module.onMessage = value => { feedback = value; }; return module; };
    x.host.bindBridge(async packet => { received = packet; return { accepted: true }; });
    await x.host.start();
    const facade = x.instances[0].options.adapter;
    assert.equal(facade.namespace, 'eebus.0'); assert.equal(facade.eosTargetNamespace, 'nexowatt-ui.0');
    await facade.setStateAsync('devices.peer.power', { val: 42, ack: true });
    assert.equal(x.writes.at(-1).id, 'eebus.0.devices.peer.power');
    const answer = await new Promise(resolve => facade.sendTo('nexowatt-ui.0', 'nexowatt.para14a.hello.v1', { sourceInstance: 'eebus.0' }, resolve));
    assert.equal(answer.accepted, true); assert.equal(received.from, 'eos-admin.0.eebus');
    assert.equal(received.message.sourceInstance, 'eos-admin.0.eebus');
    assert.equal(x.host.receiveBridge({ command: 'nexowatt.para14a.implementation.v1', message: { sourceInstance: 'nexowatt-ui.0', targetInstance: 'eos-admin.0.eebus' } }), true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(feedback.from, 'nexowatt-ui.0'); assert.equal(feedback.message.targetInstance, 'eebus.0');
});

test('backup secret fields stay redacted and restored by unique endpoint rather than row index', () => {
    const original = { mySqlEvents: [{ host: 'db-a', port: 3306, dbName: 'one', pass: 'first' }, { host: 'db-b', port: 3306, dbName: 'two', pass: 'second' }],
        onedriveAccessJson: 'opaque-oauth', expertMount: 'opaque-mount' };
    const masked = redact(original); masked.mySqlEvents.reverse();
    assert.equal(JSON.stringify(masked).includes('first'), false); assert.equal(JSON.stringify(masked).includes('opaque-'), false);
    const restored = restoreSecrets(masked, original);
    assert.equal(restored.mySqlEvents[0].pass, 'second'); assert.equal(restored.mySqlEvents[1].pass, 'first');
    masked.mySqlEvents[0].host = 'new-host'; assert.throws(() => restoreSecrets(masked, original), /SECRET_MISSING/);
});

test('backup notifications use only configured validated target and lose authority on revocation', async t => {
    const x = setup({ devices: { enabled: false }, eebus: { enabled: false }, backup: { enabled: true } });
    x.host.options.factories.backup = x.factory;
    x.factory.validateNotificationPlan = (_config, plan) => plan.target === 'email.0' && plan.command === 'send' && typeof plan.message.text === 'string';
    const sent = []; x.owner.sendTo = (...args) => { sent.push(args.slice(0, 3)); args[3]({}); };
    await x.host.start(); t.after(() => x.host.stop());
    const adapter = x.instances[0].options.adapter;
    const plan = { target: 'email.0', command: 'send', message: { text: 'Synthetic backup test' }, delayMs: 0 };
    await adapter.sendBackupNotification(plan); assert.equal(sent.length, 1);
    await assert.rejects(adapter.sendBackupNotification({ ...plan, target: 'other.0' }), /SCOPE/);
    x.owner.licensed = false; await assert.rejects(adapter.sendBackupNotification(plan), /INACTIVE/);
    assert.equal(sent.length, 1);
});

test('backup downloads clean late file streams after timeout or stop and bound concurrent opens', async t => {
    const { PassThrough } = require('node:stream');
    const x = setup({ devices: { enabled: false }, eebus: { enabled: false }, backup: { enabled: true } });
    x.host.options.factories.backup = x.factory;
    x.host.options.downloadTimeoutMs = 20;
    x.owner.config.eosUiMigration = { preserveNamespace: true, source: 'nexowatt-ui.0' };
    await x.host.start(); t.after(() => x.host.stop());
    assert.equal(x.instances[0].options.preservedUiNamespace, 'nexowatt-ui.0');
    const module = x.instances[0];
    let release;
    module.getDownload = () => new Promise(resolve => { release = resolve; });
    const timedOut = x.host.download('backup', 'test.nwb');
    await assert.rejects(timedOut, /TIMEOUT/);
    const late = new PassThrough(); release({ stream: late, filename: 'test.nwb' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(late.destroyed, true);
    assert.equal(x.host.entries.get('backup').downloads.size, 0);
    x.host.options.downloadTimeoutMs = 1000;
    const streams = Array.from({ length: 4 }, () => new PassThrough());
    let opened = 0;
    module.getDownload = async () => ({ stream: streams[opened++], filename: 'test.nwb' });
    await Promise.all(streams.map(() => x.host.download('backup', 'test.nwb')));
    await assert.rejects(x.host.download('backup', 'test.nwb'), /RATE_LIMIT/);
    assert.equal(opened, 4);
    streams[0].destroy(); await new Promise(resolve => setImmediate(resolve));
    module.getDownload = () => new Promise(resolve => { release = resolve; });
    const stopped = x.host.download('backup', 'test.nwb');
    const rejected = assert.rejects(stopped, /INACTIVE/);
    await new Promise(resolve => setImmediate(resolve));
    await x.host.stop();
    const lateStopped = new PassThrough(); release({ stream: lateStopped, filename: 'test.nwb' });
    await rejected;
    assert.equal(lateStopped.destroyed, true);
    assert.ok(streams.every(stream => stream.destroyed));
});

test('backup data-folder inventory exposes only bounded paths and rejects revoked or malformed reads', async t => {
    const x = setup({ devices: { enabled: false }, eebus: { enabled: false }, backup: { enabled: true } });
    x.host.options.factories.backup = x.factory;
    await x.host.start(); t.after(() => x.host.stop());
    const adapter = x.instances[0].options.adapter;
    x.objects.set('system.adapter.sample.0', { _id: 'system.adapter.sample.0', type: 'instance',
        common: { dataFolder: 'sample.0' }, native: { password: 'must-not-cross-capability' } });
    assert.deepEqual(await adapter.getBackupDataFolders(), ['sample.0']);
    x.objects.get('system.adapter.sample.0').common.dataFolder = 'a'.repeat(4097);
    await assert.rejects(adapter.getBackupDataFolders(), /DATA_FOLDER_INVENTORY/);
    x.objects.get('system.adapter.sample.0').common.dataFolder = 'sample.0';
    const get = x.owner.getObjectViewAsync;
    x.owner.getObjectViewAsync = async (...args) => { const result = await get(...args); x.owner.owned = false; return result; };
    await assert.rejects(adapter.getBackupDataFolders(), /INACTIVE/);
});
