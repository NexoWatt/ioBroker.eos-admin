'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHostedModule, validateConfig, preflightLegacyConfig, migrateLegacyConfig, command } = require('../index');
const { guardDriver } = require('../operation-guard');
const templateId = 'battery.bmw.BatteryBmwImpl';
const device = { id: 'battery1', templateId, protocol: 'modbusTcp', connection: { host: '127.0.0.1', port: 502 } };
function harness(overrides = {}) {
    const objects = new Map(); const states = new Map(); const events = [];
    let allowed = true;
    const adapter = { namespace: 'eos-admin.0', instance: 0,
        log: { debug() {}, info() {}, warn() {}, error() {} },
        async setObjectNotExistsAsync(id, object) { objects.set(id, object); },
        async setStateAsync(id, state) { assert.ok(objects.has(id), `Missing object ${id}`); states.set(id, state); },
    };
    const module = createHostedModule({ adapter, canOperate: () => allowed, config: { enabled: true, devices: [device] },
        runtimeFactory(config) {
            return { cfg: config, started: false, _hbOnline: false,
                _createDriver() { return { async connect() { events.push('connect'); }, async disconnect() { events.push('disconnect'); }, async writeDatapoint() { events.push('write'); } }; },
                async initObjects() { events.push('objects'); },
                async start() { this.started = true; this.driver = this._createDriver(); await this.driver.connect(); },
                async stop() { this.started = false; if (this.driver) await this.driver.disconnect(); },
                async handleStateChange() { await this.driver.writeDatapoint(); },
            };
        }, ...overrides });
    return { module, objects, states, events, revoke() { allowed = false; } };
}
test('configuration rejects invalid identifiers, duplicate IDs, dangerous keys and CAN binary overrides', () => {
    assert.equal(validateConfig({}).enabled, false);
    assert.throws(() => validateConfig({ devices: [{ ...device, id: '../escape' }] }), /CONFIG_ID/);
    assert.throws(() => validateConfig({ devices: [device, device] }), /DUPLICATE_ID/);
    assert.throws(() => validateConfig(JSON.parse('{"__proto__":{}}')), /CONFIG_KEY/);
    assert.throws(() => validateConfig({ devicesJson: '[{"id":"valid","templateId":"a","protocol":"http","connection":{"constructor":{}}}]' }), /CONFIG_KEY/);
    assert.throws(() => validateConfig({ devices: [{ ...device, protocol: 'canbus', connection: { cansendPath: '/tmp/helper' } }] }), /CAN_BINARY/);
    assert.throws(() => validateConfig({ devices: [{ ...device, protocol: 'onewire', connection: { basePath: '/sys/bus/w1/devices-evil' } }] }), /ONEWIRE_PATH/);
    assert.throws(() => validateConfig({ devices: [{ ...device, connection: { insecureTls: true } }] }), /TLS_VERIFICATION_REQUIRED/);
});
test('legacy JSON config imports without changing per-device IDs/settings or activating', () => {
    const previous = { ...device, id: 'old.device-01', connection: { host: '192.0.2.1', password: 'private', option: 3 } };
    const migrated = validateConfig({ devicesJson: JSON.stringify([previous]) });
    assert.equal(migrated.enabled, false);
    assert.deepEqual(migrated.devices, [previous]);
    assert.equal(migrated.devicesJson, undefined);
});
test('disabled module never creates objects, runtimes, transport, or root connection state', async () => {
    const h = harness({ config: { enabled: false, devices: [device] }, runtimeFactory() { throw new Error('Must not initialize'); } });
    await h.module.start();
    assert.equal(h.objects.size, 0);
    assert.equal(h.module.getStatus().state, 'disabled');
    await h.module.stop();
});
test('one hosted runtime routes only its namespace and unacknowledged commands; stop is idempotent', async () => {
    const h = harness();
    await h.module.start();
    await h.module.start();
    assert.deepEqual(h.events, ['objects', 'connect']);
    assert.equal(h.objects.has('info.connection'), false);
    assert.equal(h.states.get('modules.devices.info.connection').val, false);
    await h.module.onStateChange('other.0.devices.battery1.power', { ack: false, val: 2 });
    await h.module.onStateChange('eos-admin.0.devices.battery1.power', { ack: true, val: 2 });
    await h.module.onStateChange('eos-admin.0.devices.battery1.power', { ack: false, val: 2 });
    assert.equal(h.events.filter(event => event === 'write').length, 1);
    await h.module.stop();
    await h.module.stop();
    await h.module.onStateChange('eos-admin.0.devices.battery1.power', { ack: false, val: 3 });
    assert.equal(h.events.filter(event => event === 'write').length, 1);
    assert.equal(h.events.filter(event => event === 'disconnect').length, 1);
});
test('central license refusal prevents transport; revocation blocks all subsequent writes', async () => {
    const h = harness();
    await h.module.start();
    h.revoke();
    await h.module.onStateChange('eos-admin.0.devices.battery1.power', { ack: false, val: 2 });
    assert.equal(h.events.includes('write'), false);
    await h.module.stop();
    await assert.rejects(h.module.start(), /NOT_AUTHORIZED/);
});
test('unknown profile and incompatible protocol fail before any I/O', async () => {
    for (const bad of [{ ...device, templateId: 'missing' }, { ...device, protocol: 'mqtt' }]) {
        const h = harness({ config: { enabled: true, devices: [bad] } });
        await assert.rejects(h.module.start(), /UNKNOWN_TEMPLATE|TEMPLATE_PROTOCOL/);
        assert.equal(h.events.includes('connect'), false);
        assert.equal(h.module.getStatus().state, 'error');
    }
});
test('queued Modbus and periodic MQTT publish recheck ownership at the final dispatch', async () => {
    let allowed = true; let dispatched = 0; let release;
    const waiting = new Promise(resolve => { release = resolve; });
    const driver = guardDriver({ async _withIoLock(callback) { await waiting; return callback(); }, async _publish() { dispatched++; } }, () => allowed);
    const queued = driver._withIoLock(() => { dispatched++; });
    allowed = false; release();
    await assert.rejects(queued, /NOT_AUTHORIZED/);
    await assert.rejects(driver._publish(), /NOT_AUTHORIZED/);
    assert.equal(dispatched, 0);
});
test('metadata commands work while runtime is disabled and reject unknown commands', async () => {
    const categories = await command('getCategories');
    assert.ok(categories.length > 0);
    const protocols = await command('getProtocols', { templateId });
    assert.ok(protocols.some(protocol => protocol.value === 'modbusTcp'));
    await assert.rejects(command('exec', { command: 'unexpected' }), /COMMAND_UNKNOWN/);
    assert.deepEqual(await command('getTemplates', {}), []);
});
test('startup failure cleans a partially initialized runtime without exposing error secrets', async () => {
    let stopped = 0;
    const h = harness({ runtimeFactory() { return { _createDriver() {}, async initObjects() { throw new Error('password=private'); }, async stop() { stopped++; } }; } });
    await assert.rejects(h.module.start(), /EOS_DEVICES_START_FAILED/);
    assert.equal(stopped, 1);
    assert.equal(JSON.stringify(h.module.getStatus()).includes('private'), false);
});

test('state cleanup failure still closes the captured driver; a failed close remains visible to the host', async () => {
    for (const closeFails of [false, true]) {
        let closed = 0;
        const h = harness({ runtimeFactory() { return {
            _createDriver() { return { async disconnect() { closed++; if (closeFails) throw new Error('transport stuck'); } }; },
            async initObjects() {}, async start() { this.driver = this._createDriver(); },
            async stop() { throw new Error('EOS_MODULE_STOPPED'); },
        }; } });
        await h.module.start();
        if (closeFails) await assert.rejects(h.module.stop(), /STOP_FAILED/);
        else await h.module.stop();
        assert.equal(closed, 1);
    }
});


test('legacy preflight preserves 0.5.176 devicesJson when the native array is only its empty default', async () => {
    const previous = { ...device, id: 'old.device-01', enabled: true, connection: { host: '192.0.2.1', port: 502, password: 'fixture-device-password', clientId: 'retained-client' } };
    const original = { enabled: false, devices: [], devicesJson: JSON.stringify([previous]), pollIntervalMs: 1234, customSetting: 'retained' };
    const before = structuredClone(original);
    for (const migrate of [preflightLegacyConfig, migrateLegacyConfig]) {
        const migrated = await migrate(original);
        assert.deepEqual(migrated.config.devices, [previous]);
        assert.equal(migrated.config.pollIntervalMs, 1234);
        assert.equal(migrated.config.customSetting, 'retained');
        assert.equal(migrated.config.enabled, false);
        assert.equal(migrated.config.devicesJson, undefined);
        assert.deepEqual(original, before, 'source object remains untouched');
    }
});

test('two filled legacy sources must agree and neither conflicting source is silently selected', async () => {
    const original = { devices: [device], devicesJson: JSON.stringify([{ ...device, connection: { ...device.connection, host: '192.0.2.2' } }]) };
    const before = structuredClone(original);
    await assert.rejects(preflightLegacyConfig(original), /EOS_DEVICES_LEGACY_CONFIG_CONFLICT/);
    assert.deepEqual(original, before);
    const same = await preflightLegacyConfig({ devices: [device], devicesJson: JSON.stringify([device]) });
    assert.deepEqual(same.config.devices, [device]);
    const modern = await preflightLegacyConfig({ devices: [device], devicesJson: '[]' });
    assert.deepEqual(modern.config.devices, [device]);
});

test('normal explicit empty-device save never resurrects a leftover legacy JSON list', () => {
    const saved = validateConfig({ devices: [], devicesJson: JSON.stringify([device]) });
    assert.deepEqual(saved.devices, []);
    assert.equal(saved.devicesJson, undefined);
});

test('legacy preflight rejects malformed, unsafe and unknown JSON devices before any hosted runtime', async () => {
    for (const raw of ['{broken', '{}', '[{"id":"valid","templateId":"a","protocol":"http","connection":{"constructor":{}}}]']) {
        await assert.rejects(preflightLegacyConfig({ devices: [], devicesJson: raw }), /EOS_DEVICES_CONFIG_/);
    }
    await assert.rejects(preflightLegacyConfig({ devices: [], devicesJson: JSON.stringify([{ ...device, templateId: 'missing-template' }]) }), /EOS_DEVICES_UNKNOWN_TEMPLATE/);
    const empty = await preflightLegacyConfig({ devices: [], devicesJson: '[]' });
    assert.deepEqual(empty.config.devices, []);
});
