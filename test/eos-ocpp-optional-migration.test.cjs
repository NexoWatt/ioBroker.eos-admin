'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { EosLegacyMigration } = require('../src/lib/eosLegacyMigration');
const { EosModuleHost } = require('../src/lib/eosModuleHost');
const { EosModuleConfigStore } = require('../src/lib/eosModuleConfigStore');

// Actual migration/config store/host and, in the integration case, actual Devices
// child. The controller DB is synthetic; no hardware, controller or Pi is claimed.
async function setup(t, { version = '0.2.2', count = 1, ocppLicensed = true, coreLicensed = true } = {}) {
    const directory = await mkdtemp(path.join(tmpdir(), 'eos-optional-ocpp-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const objects = new Map(), states = new Map(), events = [], logs = [];
    const clone = value => value == null ? value : structuredClone(value);
    const owner = {
        namespace: 'eos-admin.0', instance: 0, config: { eosUi: {}, eosModules: {} },
        encrypt: value => `fixture:${Buffer.from(value).toString('base64')}`,
        decrypt: value => Buffer.from(value.slice(8), 'base64').toString(),
        log: Object.fromEntries(['info', 'warn', 'error', 'debug'].map(level => [level, value => logs.push({ level, value })])),
        eosLicenseService: {
            statusView: () => ({ valid: coreLicensed, coreEnabled: coreLicensed }),
            allowsEmbeddedModule: id => coreLicensed && (id !== 'ocpp' || ocppLicensed),
        },
        eosOwnership: { canWrite: () => owner.eosMigration.allowsWrites() },
        async getForeignObjectAsync(id) { return clone(objects.get(id)); },
        async getForeignStateAsync(id) { return clone(states.get(id)); },
        async getForeignStatesAsync(pattern) { const prefix = pattern.split('*')[0]; return Object.fromEntries([...states].filter(([id]) => id.startsWith(prefix)).map(([id, state]) => [id, clone(state)])); },
        async getObjectViewAsync(design, type, range) {
            events.push(`view:${design}:${type}:${range.startkey}`);
            return { rows: [...objects.values()].filter(value => value._id >= range.startkey && value._id <= range.endkey).map(value => ({ id: value._id, value: clone(value) })) };
        },
        async setForeignObjectAsync(id, value) { objects.set(id, { ...clone(value), _id: id }); events.push(`object:${id}`); },
        async setForeignObjectNotExistsAsync(id, value) { if (!objects.has(id)) await owner.setForeignObjectAsync(id, value); },
        async extendForeignObjectAsync(id, value) {
            events.push(`extend:${id}`);
            const previous = objects.get(id) || {};
            objects.set(id, { ...previous, ...clone(value), _id: id, common: { ...previous.common, ...value.common }, ts: Date.now() });
        },
        async setForeignStateAsync(id, value, ack) { states.set(id, typeof value === 'object' ? clone(value) : { val: value, ack }); },
        async setStateAsync(id, value) { await owner.setForeignStateAsync(`${owner.namespace}.${id}`, value); },
        async setObjectNotExistsAsync(id, value) { await owner.setForeignObjectNotExistsAsync(`${owner.namespace}.${id}`, value); },
        async subscribeForeignObjectsAsync(pattern) { events.push(`subscribeObjects:${pattern}`); },
        async subscribeForeignStatesAsync(pattern) { events.push(`subscribeStates:${pattern}`); },
        async unsubscribeForeignObjectsAsync() {}, async unsubscribeForeignStatesAsync() {},
    };
    // This integration case exercises the real Devices child and optional
    // external OCPP ownership. Unrelated services are explicitly disabled;
    // OCPP intentionally retains an absent envelope to exercise new defaults.
    for (const id of ['eebus', 'backup']) owner.config.eosModules[id] = {
        v: 1, encrypted: owner.encrypt(JSON.stringify({ enabled: false })),
    };
    objects.set('system.adapter.eos-admin.0', { _id: 'system.adapter.eos-admin.0', type: 'instance', common: { enabled: true, host: 'fixture' }, native: owner.config });
    states.set('system.host.fixture.alive', { val: true, ack: true, ts: Date.now() });
    for (let i = 0; i < count; i++) {
        const id = `system.adapter.ocpp21.${i}`;
        objects.set(id, { _id: id, type: 'instance', common: { enabled: true, version, host: 'fixture' }, native: { port: 9220 + i }, ts: Date.now() - 10 });
        states.set(`${id}.alive`, { val: true, ack: true, ts: Date.now() });
        states.set(`ocpp21.${i}.DOUSIDA.connector1.power`, { val: 5700, ack: true, ts: Date.now(), q: 0 });
    }
    const deviceConfig = { enabled: true, devices: [], pollIntervalMs: 5000 };
    const store = new EosModuleConfigStore(owner);
    await store.save('devices', { v: 1, encrypted: owner.encrypt(JSON.stringify(deviceConfig)) });
    const originalDevices = clone(objects.get(store.objectId('devices')));
    const originalOcpp = { objects: clone([...objects].filter(([id]) => id.startsWith('system.adapter.ocpp21.'))), states: clone([...states].filter(([id]) => id.includes('ocpp21.'))) };
    const options = { baseDir: path.resolve(__dirname, '..'), dataDir: directory };
    const migration = new EosLegacyMigration(owner, options); owner.eosMigration = migration;
    t.after(() => migration.stop());
    return { owner, objects, states, events, logs, migration, options, store, originalDevices, originalOcpp };
}
function assertExternalRetained(f) {
    assert.deepEqual([...f.objects].filter(([id]) => id.startsWith('system.adapter.ocpp21.')), f.originalOcpp.objects);
    assert.deepEqual([...f.states].filter(([id]) => id.includes('ocpp21.')), f.originalOcpp.states);
    assert.deepEqual(f.objects.get(f.store.objectId('devices')), f.originalDevices);
    assert.equal(f.owner.config.eosModules.ocpp, undefined);
    assert.equal(f.events.some(value => value.startsWith('extend:system.adapter.ocpp21.')), false);
}

for (const [name, options] of [
    ['unsupported external OCPP version', { version: '0.2.2' }],
    ['supported external OCPP version', { version: '0.4.3' }],
    ['multiple external OCPP instances', { version: '0.4.3', count: 2 }],
    ['external OCPP outside embedded module grant', { version: '0.4.3', ocppLicensed: false }],
]) {
    test(`configured Devices remain startable with ${name} and no prior migration journal`, async t => {
        const f = await setup(t, options);
        await f.migration.start();
        assert.equal(f.migration.phase, 'NOT_NEEDED');
        assert.equal(f.migration.allowsStartup(), true);
        assert.equal(f.migration.allowsWrites(), true);
        assert.equal(f.events.some(value => value === 'view:system:instance:system.adapter.ocpp21.'), false);
        assertExternalRetained(f);
    });
}

test('previously blocked optional OCPP inventory recovers on startup and actual Devices child runs', { timeout: 15000 }, async t => {
    const f = await setup(t);
    // 9.0.24 publishes BLOCKED for this inventory but does not persist a cutover
    // journal. A process restart must replace this diagnostic with the new result.
    await f.owner.setStateAsync('info.legacyMigration', { val: JSON.stringify({ phase: 'BLOCKED', code: 'EOS_MIGRATION_SOURCE_VERSION', sources: [{ id: 'ocpp', source: 'ocpp21.0', namespacePreserved: false }], updatedAt: null }), ack: true });
    await f.migration.start();
    assert.equal(f.migration.allowsStartup(), true);
    assert.equal(JSON.parse(f.states.get('eos-admin.0.info.legacyMigration').val).phase, 'NOT_NEEDED');
    assert.equal(JSON.parse(f.states.get('eos-admin.0.info.legacyMigration').val).code, '');
    const host = new EosModuleHost(f.owner, f.options); f.owner.eosModuleHost = host;
    t.after(() => host.stop());
    await host.start();
    const devices = await host.status('devices');
    assert.equal(devices.active, true);
    assert.equal(devices.reason, 'RUNNING');
    assert.equal(devices.details.process.state, 'running');
    assert.ok(Number.isSafeInteger(devices.details.process.pid));
    assert.notEqual(devices.details.process.pid, process.pid);
    const ocpp = await host.status('ocpp');
    assert.equal(ocpp.enabled, true, 'missing configuration enables commissioning without taking over the external adapter');
    assert.equal(ocpp.active, false);
    assert.equal(ocpp.reason, 'WAITING_FOR_OWNERSHIP');
    assert.equal(ocpp.details.waitingReason, 'LEGACY_CONFLICT');
    assert.equal(ocpp.details.process.standby, true);
    assert.equal(ocpp.details.process.state, 'running');
    assert.ok(Number.isSafeInteger(ocpp.details.process.pid) && ocpp.details.process.pid > 0);
    assert.notEqual(ocpp.details.process.pid, process.pid);
    assert.notEqual(ocpp.details.process.pid, devices.details.process.pid);
    assert.deepEqual(ocpp.blockers, [{ instance: 'ocpp21.0', reason: 'LEGACY_ENABLED_OR_UNKNOWN' }]);
    assertExternalRetained(f);
});

test('optional OCPP handling does not bypass the core license gate', async t => {
    const f = await setup(t, { coreLicensed: false });
    await f.migration.start();
    assert.equal(f.migration.phase, 'LICENSE_REQUIRED');
    assert.equal(f.migration.allowsStartup(), false);
    assertExternalRetained(f);
});

test('a configured Devices target and an incompatible source cannot overwrite an unrelated external OCPP', async t => {
    const f = await setup(t);
    const id = 'system.adapter.nexowatt-devices.0';
    f.objects.set(id, { _id: id, type: 'instance', common: { enabled: true, host: 'fixture', version: 'unknown' }, native: { unknownDeviceInventory: ['retained'] } });
    await f.migration.start();
    assert.equal(f.migration.phase, 'BLOCKED');
    assert.equal(f.migration.status().code, 'EOS_MIGRATION_DESTINATION_CONFIGURED');
    assert.deepEqual(f.migration.status().sources.map(row => row.id), ['devices']);
    assert.equal(f.migration.allowsStartup(), false);
    assertExternalRetained(f);
});
