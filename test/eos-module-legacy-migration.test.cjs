'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EosLegacyMigration } = require('../src/lib/eosLegacyMigration');
const { EosModuleHost } = require('../src/lib/eosModuleHost');
const { EosModuleConfigStore } = require('../src/lib/eosModuleConfigStore');
const { randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');
const defaults = require('../io-package.json').native.eosUi;
function fixture(sources = [{ id: 'devices', source: 'nexowatt-devices.0', version: '0.5.176', native: { devices: [], pollIntervalMs: 2500 } }]) {
    const objects = new Map(); const states = new Map(); const mutations = []; const logs = [];
    const secret = randomBytes(32);
    const owner = {
        namespace: 'eos-admin.1', instance: 1, config: { eosModules: {}, eosUi: structuredClone(defaults) },
        log: { info: value => logs.push(value), warn: value => logs.push(value), error: value => logs.push(value) },
        eosLicenseService: { statusView: () => ({ valid: true, coreEnabled: true }), allowsEmbeddedModule: () => true },
        eosOwnership: { canWrite: () => true },
        encrypt(value) { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', secret, iv); return Buffer.concat([iv, cipher.update(value), cipher.final(), cipher.getAuthTag()]).toString('base64'); },
        decrypt(value) { const bytes = Buffer.from(value, 'base64'), decipher = createDecipheriv('aes-256-gcm', secret, bytes.subarray(0, 12)); decipher.setAuthTag(bytes.subarray(-16)); return Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString(); },
        async getForeignObjectAsync(id) { return objects.has(id) ? structuredClone(objects.get(id)) : null; },
        async getForeignStateAsync(id) { return states.get(id) || null; },
        async getObjectViewAsync(_d, _s, range) { return { rows: [...objects.values()].filter(object => object._id >= range.startkey && object._id <= range.endkey).map(value => ({ value: structuredClone(value) })) }; },
        async setForeignObjectAsync(id, object) { mutations.push({ id, object: structuredClone(object) }); objects.set(id, structuredClone(object)); },
        async extendForeignObjectAsync(id, patch) { const current = objects.get(id); const updated = { ...current, ...patch, common: { ...current.common, ...patch.common }, ts: Date.now() }; mutations.push({ id, patch }); objects.set(id, updated); if (patch.common?.enabled !== undefined) states.set(`${id}.alive`, { val: patch.common.enabled, ack: true, ts: updated.ts + 1 }); },
        async setObjectNotExistsAsync(id, object) { if (!objects.has(`${owner.namespace}.${id}`)) objects.set(`${owner.namespace}.${id}`, { ...object, _id: `${owner.namespace}.${id}` }); },
        async setStateAsync(id, state) { states.set(`${owner.namespace}.${id}`, state); },
        async setForeignObjectNotExistsAsync(id, object) { if (!objects.has(id)) objects.set(id, { ...object, _id: id }); },
        async setForeignStateAsync(id, state) { states.set(id, state); },
        async subscribeForeignObjectsAsync() {}, async subscribeForeignStatesAsync() {}, async unsubscribeForeignStatesAsync() {},
    };
    objects.set(`system.adapter.${owner.namespace}`, { _id: `system.adapter.${owner.namespace}`, type: 'instance', native: owner.config, common: { host: 'host', enabled: true } });
    states.set('system.host.host.alive', { val: true, ack: true, ts: Date.now() });
    for (const row of sources) {
        const object = { _id: `system.adapter.${row.source}`, type: 'instance', ts: Date.now() - 100, native: row.native, common: { version: row.version, host: row.host || 'host', enabled: row.enabled !== false }, ...(row.protectedNative ? { protectedNative: row.protectedNative } : {}), ...(row.encryptedNative ? { encryptedNative: row.encryptedNative } : {}) };
        objects.set(object._id, object); states.set(`${object._id}.alive`, { val: object.common.enabled, ack: true, ts: Date.now() });
    }
    const factories = { devices: { validateConfig: value => ({ ...value, enabled: value.enabled === true }), createHostedModule: ({ adapter }) => ({ async start() { await adapter.setStateAsync('devices.ess1.power', { val: 10, ack: true }); }, async stop() {}, getStatus: () => ({}) }) } };
    const migration = new EosLegacyMigration(owner, { baseDir: path.resolve(__dirname, '..'), dataDir: '/tmp/eos-migration-test-unused', factories, stopTimeoutMs: 150, startTimeoutMs: 200 });
    owner.eosMigration = migration;
    return { owner, migration, objects, states, mutations, factories, logs };
}

test('automatic handover preserves namespace, custom/history objects and settings including credentials', async t => {
    const x = fixture(); const source = x.objects.get('system.adapter.nexowatt-devices.0');
    source.native.devices = [{ id: 'ess1', password: 'synthetic-test-secret' }];
    const oldObject = { _id: 'nexowatt-devices.0.devices.ess1.power', type: 'state', common: { type: 'number', unit: 'W', custom: { 'influxdb.0': { enabled: true } } }, native: {} };
    x.objects.set(oldObject._id, structuredClone(oldObject));
    await x.migration.start();
    assert.equal(x.migration.phase, 'TRANSFERRED'); assert.equal(x.objects.get(source._id).common.enabled, false);
    const envelope = x.owner.config.eosModules.devices;
    assert.equal(envelope.migration.source, 'nexowatt-devices.0'); assert.equal(envelope.migration.preserveNamespace, true);
    assert.deepEqual(x.migration.decode(envelope), { ...source.native, enabled: true });
    assert.equal(JSON.stringify(x.mutations).includes('synthetic-test-secret'), false);
    const host = new EosModuleHost(x.owner, { baseDir: '.', dataDir: '/tmp/eos-migration-test-unused', factories: x.factories });
    x.owner.eosModuleHost = host; t.after(() => host.stop()); await host.start();
    assert.equal(host.namespace('devices'), 'nexowatt-devices.0'); assert.equal(host.facade(host.entries.get('devices'), 0).instance, 0);
    assert.equal((await host.status('devices')).active, true);
    assert.equal(x.states.get(oldObject._id).val, 10); assert.deepEqual(x.objects.get(oldObject._id), oldObject);
    await x.migration.verifyRuntime(); assert.equal(x.migration.phase, 'COMMITTED');
    await host.save('devices', { ...host.readConfig('devices'), pollIntervalMs: 3000 });
    await host.reconcile();
    const again = new EosLegacyMigration(x.owner, { baseDir: path.resolve(__dirname, '..'), dataDir: '/tmp/unused', factories: x.factories });
    const before = x.mutations.filter(row => row.id.startsWith('system.adapter.')).length;
    await again.start(); assert.equal(again.phase, 'COMMITTED');
    assert.equal(again.decode(x.owner.config.eosModules.devices).pollIntervalMs, 3000);
    assert.equal(x.mutations.filter(row => row.id.startsWith('system.adapter.')).length, before);
});

test('preflight ambiguity, unknown version, remote host, missing license and existing destination never stop a source', async () => {
    const scenarios = [
        x => { const other = structuredClone(x.objects.get('system.adapter.nexowatt-devices.0')); other._id = 'system.adapter.nexowatt-devices.2'; x.objects.set(other._id, other); },
        x => { x.objects.get('system.adapter.nexowatt-devices.0').common.version = '99.0.0'; },
        x => { x.objects.get('system.adapter.nexowatt-devices.0').common.host = 'remote'; },
        x => { x.owner.eosLicenseService.allowsEmbeddedModule = () => false; },
        x => { x.owner.config.eosModules.devices = x.migration.envelope({ enabled: false }); },
    ];
    for (const change of scenarios) {
        const x = fixture(); change(x); await x.migration.start();
        assert.equal(x.migration.phase, 'BLOCKED');
        assert.equal(x.mutations.some(row => row.id.startsWith('system.adapter.')), false);
        assert.equal(x.objects.get('system.adapter.nexowatt-devices.0').common.enabled, true);
    }
});

test('failed target persistence restores confirmed legacy runtime; journal prevents repeated interruption', async () => {
    const x = fixture(); const save = x.owner.setForeignObjectAsync;
    x.owner.setForeignObjectAsync = async (id, object) => { if (id.endsWith('.devices.configuration')) throw new Error('disk failure'); return save(id, object); };
    await x.migration.start(); assert.equal(x.migration.phase, 'ROLLED_BACK');
    assert.equal(x.objects.get('system.adapter.nexowatt-devices.0').common.enabled, true);
    assert.equal(x.states.get('system.adapter.nexowatt-devices.0.alive').val, true);
    const again = new EosLegacyMigration(x.owner, { baseDir: path.resolve(__dirname, '..'), dataDir: '/tmp/unused', factories: x.factories });
    const stops = x.mutations.filter(row => row.patch?.common?.enabled === false).length;
    await again.start(); assert.equal(again.phase, 'ROLLED_BACK');
    assert.equal(x.mutations.filter(row => row.patch?.common?.enabled === false).length, stops);
});

test('crash while stopping is rolled back before new runtime gains write ownership', async () => {
    const x = fixture(); const row = await x.migration.candidate('devices', x.objects.get('system.adapter.nexowatt-devices.0'));
    x.migration.journal = { sources: [{ id: row.id, source: row.source, enabled: row.enabled, nativeHash: row.nativeHash, host: row.host, sourceVersion: row.sourceVersion }] };
    await x.migration.persist('STOPPING'); await x.owner.extendForeignObjectAsync(`system.adapter.${row.source}`, { common: { enabled: false } });
    const recovered = new EosLegacyMigration(x.owner, { baseDir: path.resolve(__dirname, '..'), dataDir: '/tmp/unused', stopTimeoutMs: 150 });
    await recovered.start(); assert.equal(recovered.phase, 'ROLLED_BACK');
    assert.equal(x.objects.get('system.adapter.nexowatt-devices.0').common.enabled, true);
});

test('failed new runtime with uncertain transport stop never re-enables legacy writer', async () => {
    const x = fixture(); await x.migration.start();
    x.owner.eosModuleHost = { status: async () => ({ active: false, reason: 'START_FAILED' }), entries: new Map([['devices', { stopFailed: true }]]), async stop() {} };
    await x.migration.verifyRuntime(); assert.equal(x.migration.phase, 'ROLLBACK_REQUIRED');
    assert.equal(x.migration.allowsWrites(), false);
    assert.equal(x.objects.get('system.adapter.nexowatt-devices.0').common.enabled, false);
});

test('encrypted native credentials decrypt exactly once; missing protected fields block all source changes', async () => {
    const x = fixture(); const object = x.objects.get('system.adapter.nexowatt-devices.0');
    object.encryptedNative = ['password']; object.protectedNative = ['password']; object.native.password = x.owner.encrypt('synthetic-password');
    await x.migration.start(); assert.equal(x.migration.decode(x.owner.config.eosModules.devices).password, 'synthetic-password');
    const y = fixture(); y.objects.get('system.adapter.nexowatt-devices.0').protectedNative = ['password'];
    await y.migration.start(); assert.equal(y.migration.status().code, 'EOS_MIGRATION_PROTECTED_FIELDS_UNAVAILABLE');
    assert.equal(y.mutations.some(row => row.id.startsWith('system.adapter.')), false);
});

test('UI native settings move to protected config; two successive saves read current values and preserve old source', async () => {
    const x = fixture([{ id: 'ui', source: 'nexowatt-ui.0', version: '1.0.38', native: { siteName: 'retained', installerConfig: { nvp: { stateId: 'meter.0.power', watts: 70000 } }, password: 'synthetic-mail', port: 8082, licenseKey: 'legacy-token' } }]);
    const original = structuredClone(x.objects.get('system.adapter.nexowatt-ui.0').native);
    await x.migration.start(); assert.equal(x.migration.phase, 'TRANSFERRED');
    assert.deepEqual(x.owner.config.eosUi.installerConfig, original.installerConfig); assert.equal(x.owner.config.eosUi.password, original.password);
    assert.equal(x.owner.config.eosUi.port, undefined); assert.equal(x.owner.config.eosUi.licenseKey, undefined);
    await x.migration.saveUi({ ...x.owner.config.eosUi, siteName: 'first' });
    await x.migration.saveUi({ ...x.owner.config.eosUi, second: true });
    const store = new EosModuleConfigStore(x.owner, { moduleIds: ['ui'] });
    assert.equal(x.migration.decode(await store.load('ui')).siteName, 'first');
    assert.equal(x.migration.decode(await store.load('ui')).second, true);
    assert.deepEqual(x.objects.get('system.adapter.nexowatt-ui.0').native, original);
    assert.equal(x.mutations.some(row => row.id === 'system.adapter.eos-admin.1'), false);
});

for (const enabled of [true, false]) {
    test(`SmartHome migration preserves explicit ${enabled ? 'enabled' : 'disabled'} setting and existing customer configuration states`, async () => {
        const data = require('./fixtures/smarthome-legacy.cjs')(enabled);
        const x = fixture([{ id: 'ui', source: 'nexowatt-ui.0', version: '1.0.38', native: data.native }]);
        const originalNative = structuredClone(data.native);
        const preserved = new Map([
            ['nexowatt-ui.0.installer.configJson', { val: JSON.stringify(data.patch), ack: true }],
            ['nexowatt-ui.0.smarthome.timersJson', { val: JSON.stringify(data.timers), ack: true }],
            ['nexowatt-ui.0.smarthome.logicClocksJson', { val: JSON.stringify(data.clocks), ack: true }],
            ['nexowatt-ui.0.smarthome.logicClocks.evening.active', { val: true, ack: true }],
            ['knx.0.living.light.command', { val: false, ack: false }],
        ]);
        for (const [id, state] of preserved) {
            x.states.set(id, structuredClone(state));
            x.objects.set(id, { _id: id, type: 'state', common: { type: typeof state.val, read: true, write: true,
                custom: { 'history.0': { enabled: true } } }, native: {} });
        }
        const originalObjects = [...preserved.keys()].map(id => structuredClone(x.objects.get(id)));
        await x.migration.start();
        assert.equal(x.migration.phase, 'TRANSFERRED');
        assert.deepEqual(x.owner.config.eosUi, originalNative);
        assert.equal(x.owner.config.eosUiMigration.source, 'nexowatt-ui.0');
        assert.equal(x.owner.config.eosUiMigration.preserveNamespace, true);
        for (const [id, state] of preserved) assert.deepEqual(x.states.get(id), state, id);
        assert.deepEqual([...preserved.keys()].map(id => x.objects.get(id)), originalObjects);
        assert.equal([...x.states.keys()].some(id => id.startsWith('eos-admin.1.smarthome.')), false);
        assert.deepEqual(x.objects.get('system.adapter.nexowatt-ui.0').native, originalNative);
        // Restart loading must use the stored customer configuration, not package defaults.
        x.owner.config.eosUi = structuredClone(defaults);
        const again = new EosLegacyMigration(x.owner, { baseDir: path.resolve(__dirname, '..'), dataDir: '/tmp/unused' });
        await again.loadDestinations();
        assert.deepEqual(x.owner.config.eosUi, originalNative);
    });
}

test('UI preflight blocks corrupt or unreadable existing customer states before stopping the old writer', async () => {
    for (const defect of ['json', 'shape', 'unavailable', 'rejected', 'timers', 'clocks']) {
        const x = fixture([{ id: 'ui', source: 'nexowatt-ui.0', version: '1.0.38', native: { smartHome: { enabled: true } } }]);
        const id = defect === 'timers' ? 'nexowatt-ui.0.smarthome.timersJson'
            : defect === 'clocks' ? 'nexowatt-ui.0.smarthome.logicClocksJson' : 'nexowatt-ui.0.installer.configJson';
        x.objects.set(id, { _id: id, type: 'state', common: { type: 'string', read: false }, native: {} });
        if (defect !== 'unavailable') x.states.set(id, { val: defect === 'shape' ? '{"smartHomeConfig":{"devices":{}}}' : '{broken', ack: true });
        if (defect === 'rejected') {
            const read = x.owner.getForeignStateAsync;
            x.owner.getForeignStateAsync = async key => { if (key === id) throw new Error('not authorized'); return read(key); };
        }
        await x.migration.start();
        assert.equal(x.migration.phase, 'BLOCKED', defect);
        assert.match(x.migration.status().code, /^EOS_MIGRATION_UI_STATE_/);
        assert.equal(x.objects.get('system.adapter.nexowatt-ui.0').common.enabled, true);
        assert.equal(x.mutations.some(row => row.id.startsWith('system.adapter.')), false);
    }
});

test('UI state lost between preflight and stopped cutover causes rollback instead of default activation', async () => {
    const x = fixture([{ id: 'ui', source: 'nexowatt-ui.0', version: '1.0.38', native: { smartHome: { enabled: true } } }]);
    x.states.set('nexowatt-ui.0.smarthome.timersJson', { val: '{"timers":[{"deviceId":"light","enabled":true}]}', ack: true });
    const change = x.owner.extendForeignObjectAsync;
    x.owner.extendForeignObjectAsync = async (id, patch) => {
        await change(id, patch);
        if (patch.common?.enabled === false) x.states.delete('nexowatt-ui.0.smarthome.timersJson');
    };
    await x.migration.start();
    assert.equal(x.migration.phase, 'ROLLED_BACK');
    assert.equal(x.objects.get('system.adapter.nexowatt-ui.0').common.enabled, true);
    assert.equal(x.owner.config.eosUiMigration, undefined);
});

test('known old-instance RPC consumers block cutover while full datapoint references stay valid', async () => {
    for (const mode of ['adapter', 'script']) {
        const x = fixture();
        if (mode === 'adapter') x.objects.set('system.adapter.consumer.0', { _id: 'system.adapter.consumer.0', type: 'instance', common: { enabled: true }, native: { targetInstance: 'nexowatt-devices.0' } });
        else x.objects.set('script.js.oldRpc', { _id: 'script.js.oldRpc', type: 'script', common: { enabled: true, source: 'sendTo("nexowatt-devices.0", "probe", {});' }, native: {} });
        await x.migration.start(); assert.equal(x.migration.status().code, 'EOS_MIGRATION_EXTERNAL_RPC_REFERENCE');
        assert.equal(x.mutations.some(row => row.id.startsWith('system.adapter.')), false);
    }
    const x = fixture();
    x.objects.set('system.adapter.consumer.0', { _id: 'system.adapter.consumer.0', type: 'instance', common: { enabled: true }, native: { measurement: 'nexowatt-devices.0.devices.ess1.power' } });
    await x.migration.start(); assert.equal(x.migration.phase, 'TRANSFERRED');
});

test('changed source host/version during preflight never resumes an unreviewed original adapter', async () => {
    const x = fixture(); const originalSave = x.owner.setForeignObjectAsync;
    x.owner.setForeignObjectAsync = async (id, object) => {
        await originalSave(id, object);
        if (id.endsWith('.migration.configuration')) {
            const envelope = JSON.parse(x.owner.decrypt(object.native.encrypted));
            const journal = JSON.parse(x.owner.decrypt(envelope.encrypted));
            if (journal.phase === 'STOPPING') x.objects.get('system.adapter.nexowatt-devices.0').common.version = '99.0.0';
        }
    };
    await assert.rejects(x.migration.start(), /SOURCE_CHANGED/);
    assert.equal(x.migration.phase, 'ROLLBACK_REQUIRED'); assert.equal(x.migration.allowsWrites(), false);
    assert.equal(x.mutations.some(row => row.id.startsWith('system.adapter.')), false);
});

test('a bounded database read cannot hold startup or stop legacy writers indefinitely', async () => {
    const x = fixture(); x.migration.options.readTimeoutMs = 20;
    const get = x.owner.getForeignObjectAsync;
    x.owner.getForeignObjectAsync = id => id === 'system.adapter.nexowatt-devices.0' ? new Promise(() => {}) : get(id);
    const started = performance.now(); await x.migration.start();
    assert.equal(x.migration.status().code, 'EOS_MIGRATION_DATABASE_TIMEOUT');
    assert.ok(performance.now() - started < 1000); assert.equal(x.migration.phase, 'BLOCKED');
    assert.equal(x.mutations.some(row => row.id.startsWith('system.adapter.')), false);
});

test('another active EOS instance blocks automatic takeover before disabling old sources', async () => {
    const x = fixture();
    x.objects.set('system.adapter.eos-admin.0', { _id: 'system.adapter.eos-admin.0', type: 'instance', ts: Date.now(), native: {}, common: { enabled: true, host: 'host', version: '9.0.7' } });
    await x.migration.start(); assert.equal(x.migration.status().code, 'EOS_MIGRATION_PARALLEL_EOS');
    assert.equal(x.mutations.some(row => row.id.startsWith('system.adapter.')), false);
});

test('transferred module destination must persist with its original namespace binding on restart', async () => {
    for (const defect of ['missing', 'source-version', 'namespace']) {
        const x = fixture(); await x.migration.start();
        const store = new EosModuleConfigStore(x.owner, { moduleIds: ['devices'] });
        if (defect === 'missing') x.objects.delete(store.objectId('devices'));
        else {
            const envelope = await store.load('devices');
            if (defect === 'source-version') envelope.migration.sourceVersion = '0.0.0';
            else envelope.migration.preserveNamespace = false;
            await store.save('devices', envelope);
        }
        // Retaining even the prior process's in-memory envelope cannot replace
        // the missing persistent record after a transferred handover.
        const restart = new EosLegacyMigration(x.owner, x.migration.options);
        await assert.rejects(restart.start(), /EOS_MIGRATION_DESTINATION_/);
        assert.equal(restart.allowsWrites(), false);
        assert.equal(x.objects.get('system.adapter.nexowatt-devices.0').common.enabled, false);
    }
});

test('committed UI accepts legitimate later configuration edits on a fresh process restart', async () => {
    const x = fixture([{ id: 'ui', source: 'nexowatt-ui.0', version: '1.0.38', native: { siteName: 'before' } }]);
    await x.migration.start();
    x.owner.eosHostedRuntime = { status: () => ({ emsReady: true, canWrite: true }) };
    await x.migration.verifyRuntime(); assert.equal(x.migration.phase, 'COMMITTED');
    await x.migration.saveUi({ ...x.owner.config.eosUi, siteName: 'after', installerConfig: { meter: 'meter.0.power' } });
    x.owner.config = { eosModules: {}, eosUi: structuredClone(defaults) };
    const restart = new EosLegacyMigration(x.owner, x.migration.options);
    await restart.start();
    assert.equal(restart.phase, 'COMMITTED'); assert.equal(restart.allowsWrites(), true);
    assert.equal(x.owner.config.eosUi.siteName, 'after');
    assert.deepEqual(x.owner.config.eosUi.installerConfig, { meter: 'meter.0.power' });
});
