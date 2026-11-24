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

test('late license activation cannot start defaults before a new complete legacy preflight', async () => {
    const x = fixture([{ id: 'ui', source: 'nexowatt-ui.0', version: '1.0.37', native: { siteName: 'retained-live-site', installerConfig: { meter: 'meter.0.power' } } }]);
    const original = structuredClone(x.objects.get('system.adapter.nexowatt-ui.0'));
    let licensed = false;
    x.owner.eosLicenseService.statusView = () => ({ valid: licensed, coreEnabled: licensed });
    await x.migration.start();
    assert.equal(x.migration.phase, 'LICENSE_REQUIRED');
    assert.equal(x.migration.allowsStartup(), false);
    assert.equal(x.migration.allowsWrites(), false);
    assert.equal(x.migration.status().code, 'EOS_MIGRATION_LICENSE_REQUIRED');
    assert.deepEqual(x.objects.get(original._id), original);
    assert.equal(x.mutations.length, 0);
    licensed = true;
    assert.equal(x.migration.status().code, 'EOS_MIGRATION_RESTART_REQUIRED');
    assert.equal(x.migration.allowsStartup(), false, 'activation is not a completed inventory');
    assert.equal(x.migration.allowsWrites(), false, 'new writers stay fenced even if ownership becomes available');
    assert.equal(x.owner.config.eosUi.siteName, defaults.siteName, 'old settings are not silently treated as imported');
    const restarted = new EosLegacyMigration(x.owner, x.migration.options);
    x.owner.eosMigration = restarted;
    await restarted.start();
    assert.equal(restarted.phase, 'TRANSFERRED');
    assert.equal(restarted.allowsStartup(), true);
    assert.equal(x.owner.config.eosUi.siteName, 'retained-live-site');
    assert.deepEqual(x.owner.config.eosUi.installerConfig, original.native.installerConfig);
    assert.equal(x.objects.get(original._id).common.enabled, false);
    assert.equal(x.states.get(`${original._id}.alive`).val, false);
    assert.equal(x.owner.config.eosUiMigration.source, 'nexowatt-ui.0');
    assert.equal(x.owner.config.eosUiMigration.preserveNamespace, true);
});

test('unlicensed fresh installation remains fenced until licensed startup checks an empty inventory', async () => {
    const x = fixture([]);
    x.owner.eosLicenseService.statusView = () => ({ valid: false, coreEnabled: false });
    await x.migration.start();
    assert.equal(x.migration.allowsStartup(), false);
    assert.equal(x.migration.allowsWrites(), false);
    x.owner.eosLicenseService.statusView = () => { throw new Error('private license detail'); };
    assert.equal(x.migration.status().code, 'EOS_MIGRATION_LICENSE_REQUIRED');
    assert.equal(JSON.stringify(x.migration.status()).includes('private license detail'), false);
    x.owner.eosLicenseService.statusView = () => ({ valid: true, coreEnabled: true });
    const restarted = new EosLegacyMigration(x.owner, x.migration.options);
    await restarted.start();
    assert.equal(restarted.phase, 'NOT_NEEDED');
    assert.equal(restarted.allowsStartup(), true);
    assert.equal(restarted.allowsWrites(), true);
    assert.equal(x.mutations.length, 0);
});

test('standard Backitup instances are not legacy EOS backup migration sources', async t => {
    const x = fixture([
        { source: 'backitup.0', version: '4.0.1', native: { minimalEnabled: true, iobrokerCronJob: '0 3 * * *', customerSetting: { retention: 7 } } },
        { source: 'backitup.2', version: '4.0.1', enabled: false, native: { minimalEnabled: false, customerSetting: { retention: 14 } } },
    ]);
    t.after(() => x.migration.stop());
    const originals = new Map(structuredClone([...x.objects].filter(([id]) => id.startsWith('system.adapter.backitup.'))));
    const alive = new Map(structuredClone([...x.states].filter(([id]) => id.startsWith('system.adapter.backitup.'))));
    await x.migration.start();
    assert.equal(x.migration.phase, 'NOT_NEEDED');
    assert.equal(x.mutations.length, 0, 'standard Backitup causes no migration writes');
    assert.equal(x.owner.config.eosModules.backup, undefined);
    for (const [id, object] of originals) assert.deepEqual(x.objects.get(id), object, 'enabled state and customer configuration remain unchanged');
    for (const [id, state] of alive) assert.deepEqual(x.states.get(id), state);
});

test('legacy Devices cutover preserves standard Backitup configuration, ACL, history and running state', async t => {
    const x = fixture([
        { source: 'backitup.0', version: '4.0.1', native: { minimalEnabled: true, iobrokerCronJob: '0 3 * * *', customerSetting: { retention: 7 } } },
        { source: 'nexowatt-devices.0', version: '0.5.176', native: { devices: [], pollIntervalMs: 2500 } },
    ]);
    t.after(() => x.migration.stop());
    const backup = x.objects.get('system.adapter.backitup.0');
    backup.acl = { owner: 'system.user.admin', ownerGroup: 'system.group.administrator', object: 0x664 };
    const previousBackup = structuredClone(backup);
    const historyId = 'backitup.0.history.html';
    const historyObject = { _id: historyId, type: 'state', common: { type: 'string', role: 'html', read: true, write: false }, native: {} };
    const historyState = { val: 'existing backup history', ack: true, ts: Date.now() };
    const alive = structuredClone(x.states.get('system.adapter.backitup.0.alive'));
    x.objects.set(historyId, historyObject);
    x.states.set(historyId, historyState);
    await x.migration.start();
    assert.equal(x.migration.phase, 'TRANSFERRED');
    assert.equal(x.objects.get('system.adapter.nexowatt-devices.0').common.enabled, false);
    assert.deepEqual(x.objects.get(backup._id), previousBackup);
    assert.deepEqual(x.states.get('system.adapter.backitup.0.alive'), alive);
    assert.deepEqual(x.objects.get(historyId), historyObject);
    assert.deepEqual(x.states.get(historyId), historyState);
    assert.equal(x.owner.config.eosModules.backup, undefined);
    assert.equal(x.mutations.some(row => /^(?:system\.adapter\.)?backitup\./.test(row.id)), false);
});

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

test('TLS or listener failure before any hosted runtime exists restores old sources and fences late startup', async () => {
    const x = fixture(); await x.migration.start();
    assert.equal(x.migration.phase, 'TRANSFERRED');
    await x.migration.failStartup('EOS_MIGRATION_WEB_STARTUP_FAILED');
    assert.equal(x.migration.phase, 'ROLLED_BACK');
    assert.equal(x.objects.get('system.adapter.nexowatt-devices.0').common.enabled, true);
    assert.equal(x.migration.allowsStartup(), false);
    assert.equal(x.migration.allowsWrites(), false);
    const starts = x.mutations.filter(row => row.patch?.common?.enabled === true).length;
    await x.migration.failStartup('EOS_MIGRATION_WEB_STARTUP_FAILED');
    assert.equal(x.mutations.filter(row => row.patch?.common?.enabled === true).length, starts);
});

test('early verification times out even when the web constructor is never reached', async () => {
    const x = fixture(); await x.migration.start(); x.migration.options.startTimeoutMs = 1;
    await x.migration.verifyRuntime();
    assert.equal(x.migration.phase, 'ROLLED_BACK');
    assert.equal(x.objects.get('system.adapter.nexowatt-devices.0').common.enabled, true);
    assert.equal(x.migration.allowsStartup(), false);
});

test('active module with a pending start cannot commit until RUNNING is confirmed', async () => {
    const x = fixture(); await x.migration.start(); let ready = false;
    x.owner.eosModuleHost = { status: async () => ({ active: true, reason: ready ? 'RUNNING' : 'READY' }), async stop() {} };
    x.migration.options.startTimeoutMs = 1000;
    const monitoring = x.migration.verifyRuntime();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(x.migration.phase, 'TRANSFERRED');
    ready = true; await monitoring;
    assert.equal(x.migration.phase, 'COMMITTED');
});

test('concurrent startup failure has one recovery and never restores old writers before all stop promises settle', async () => {
    const x = fixture(); await x.migration.start(); let release; let uiStops = 0; let moduleStops = 0;
    x.owner.eosHostedRuntime = { stop: () => { uiStops++; return new Promise(resolve => { release = resolve; }); } };
    x.owner.eosModuleHost = { async stop() { moduleStops++; } };
    const a = x.migration.failStartup('EOS_MIGRATION_WEB_STARTUP_FAILED');
    const b = x.migration.failStartup('EOS_MIGRATION_NEW_RUNTIME_FAILED');
    assert.equal(a, b); assert.equal(x.migration.allowsWrites(), false); assert.equal(x.migration.allowsStartup(), false);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(x.objects.get('system.adapter.nexowatt-devices.0').common.enabled, false);
    release(); await Promise.all([a, b]);
    assert.equal(uiStops, 1); assert.equal(moduleStops, 1);
    assert.equal(x.migration.phase, 'ROLLED_BACK');
    assert.equal(x.mutations.filter(row => row.patch?.common?.enabled === true).length, 1);
});

test('a pending stop timeout remains fenced even if that stop settles later', async () => {
    const x = fixture(); await x.migration.start(); let release;
    x.migration.options.runtimeStopTimeoutMs = 10;
    x.owner.eosHostedRuntime = { stop: () => new Promise(resolve => { release = resolve; }) };
    await x.migration.failStartup('EOS_MIGRATION_WEB_STARTUP_FAILED');
    assert.equal(x.migration.phase, 'ROLLBACK_REQUIRED');
    assert.equal(x.objects.get('system.adapter.nexowatt-devices.0').common.enabled, false);
    release(); await new Promise(resolve => setImmediate(resolve));
    await x.migration.failStartup('EOS_MIGRATION_WEB_STARTUP_FAILED');
    assert.equal(x.migration.phase, 'ROLLBACK_REQUIRED');
    assert.equal(x.migration.allowsWrites(), false);
    assert.equal(x.mutations.some(row => row.patch?.common?.enabled === true), false);
});

test('rejected runtime stop and sticky module stop failure never reactivate old sources', async () => {
    for (const sticky of [false, true]) {
        const x = fixture(); await x.migration.start();
        x.owner.eosModuleHost = sticky
            ? { entries: new Map([['devices', { stopFailed: true }]]), async stop() {} }
            : { async stop() { throw new Error('transport still opening'); } };
        await x.migration.failStartup('EOS_MIGRATION_WEB_STARTUP_FAILED');
        assert.equal(x.migration.phase, 'ROLLBACK_REQUIRED');
        assert.equal(x.migration.allowsStartup(), false);
        assert.equal(x.objects.get('system.adapter.nexowatt-devices.0').common.enabled, false);
    }
});

test('source identity is checked again immediately before rollback re-enable', async () => {
    const x = fixture(); await x.migration.start(); const original = x.owner.getForeignObjectAsync; let reads = 0;
    x.owner.getForeignObjectAsync = async id => {
        if (id === 'system.adapter.nexowatt-devices.0' && ++reads === 2) {
            x.objects.get(id).common.version = '99.0.0';
        }
        return original(id);
    };
    await x.migration.failStartup('EOS_MIGRATION_WEB_STARTUP_FAILED');
    assert.equal(x.migration.phase, 'ROLLBACK_REQUIRED');
    assert.equal(x.migration.status().code, 'EOS_MIGRATION_SOURCE_CHANGED');
    assert.equal(x.mutations.some(row => row.patch?.common?.enabled === true), false);
});

test('rejected commit persistence recovers without leaving a false COMMITTED state', async () => {
    const x = fixture(); await x.migration.start(); const save = x.migration.store.save.bind(x.migration.store);
    x.owner.eosModuleHost = { status: async () => ({ active: true, reason: 'RUNNING' }), async stop() {} };
    x.migration.store.save = async (id, envelope) => {
        if (id === 'migration' && x.migration.decode(envelope).phase === 'COMMITTED') throw new Error('commit refused');
        return save(id, envelope);
    };
    await x.migration.verifyRuntime();
    assert.equal(x.migration.phase, 'ROLLED_BACK');
    assert.equal(x.objects.get('system.adapter.nexowatt-devices.0').common.enabled, true);
    assert.equal(x.migration.allowsWrites(), false);
});

test('concurrent commit persistence cannot overwrite a later startup recovery decision', async () => {
    const x = fixture(); await x.migration.start(); const save = x.migration.store.save.bind(x.migration.store);
    let releaseCommit; let enteredCommit;
    const entered = new Promise(resolve => { enteredCommit = resolve; });
    x.owner.eosModuleHost = { status: async () => ({ active: true, reason: 'RUNNING' }), async stop() {} };
    x.migration.store.save = async (id, envelope) => {
        if (id === 'migration' && x.migration.decode(envelope).phase === 'COMMITTED') {
            enteredCommit(); await new Promise(resolve => { releaseCommit = resolve; });
        }
        return save(id, envelope);
    };
    const monitor = x.migration.verifyRuntime(); await entered;
    const recovery = x.migration.failStartup('EOS_MIGRATION_WEB_STARTUP_FAILED');
    assert.equal(x.migration.allowsWrites(), false);
    releaseCommit(); await Promise.all([monitor, recovery]);
    assert.equal(x.migration.phase, 'ROLLED_BACK');
    assert.equal(x.migration.decode(await x.migration.store.load('migration')).phase, 'ROLLED_BACK');
    assert.equal(x.logs.some(message => message.startsWith('EOS_MIGRATION_COMMITTED:')), false);
});

test('intentional shutdown fences monitoring; the transferred journal is verified on next startup', async () => {
    const x = fixture(); await x.migration.start();
    const monitoring = x.migration.verifyRuntime(); x.migration.stop(); await monitoring;
    assert.equal(x.migration.phase, 'TRANSFERRED');
    assert.equal(x.migration.allowsStartup(), false); assert.equal(x.migration.allowsWrites(), false);
    assert.equal(x.objects.get('system.adapter.nexowatt-devices.0').common.enabled, false);
    const resumed = new EosLegacyMigration(x.owner, { ...x.migration.options, startTimeoutMs: 1 });
    x.owner.eosMigration = resumed; await resumed.start();
    assert.equal(resumed.phase, 'TRANSFERRED'); await resumed.verifyRuntime();
    assert.equal(resumed.phase, 'ROLLED_BACK');
    assert.equal(x.objects.get('system.adapter.nexowatt-devices.0').common.enabled, true);
});

test('preflight BLOCKED prevents operational starts while the original disabled UI remains unchanged', async () => {
    const x = fixture([{ id: 'ui', source: 'nexowatt-ui.0', version: '1.0.38', native: {}, enabled: false }]);
    await x.migration.start();
    assert.equal(x.migration.phase, 'BLOCKED');
    assert.equal(x.migration.allowsStartup(), false); assert.equal(x.migration.allowsWrites(), false);
    assert.equal(x.mutations.some(row => row.id.startsWith('system.adapter.')), false);
});

test('uncertain stop remains ROLLBACK_REQUIRED across restart without automatically re-enabling sources', async () => {
    const x = fixture(); await x.migration.start();
    x.owner.eosModuleHost = { async stop() { throw new Error('child remains unconfirmed'); } };
    await x.migration.failStartup('EOS_MIGRATION_WEB_STARTUP_FAILED');
    assert.equal(x.migration.phase, 'ROLLBACK_REQUIRED');
    const resumed = new EosLegacyMigration(x.owner, x.migration.options);
    x.owner.eosMigration = resumed; await resumed.start();
    assert.equal(resumed.phase, 'ROLLBACK_REQUIRED'); assert.equal(resumed.allowsWrites(), false);
    assert.equal(x.objects.get('system.adapter.nexowatt-devices.0').common.enabled, false);
    assert.equal(x.mutations.some(row => row.patch?.common?.enabled === true), false);
});

test('interrupted ROLLING_BACK needs persisted completed-stop proof; absent or false proof stays fenced', async () => {
    for (const proof of [undefined, false, true]) {
        const x = fixture(); await x.migration.start();
        if (proof !== undefined) x.migration.journal.runtimeStopConfirmed = proof;
        await x.migration.persist('ROLLING_BACK');
        const resumed = new EosLegacyMigration(x.owner, x.migration.options);
        x.owner.eosMigration = resumed; await resumed.start();
        assert.equal(resumed.phase, proof === true ? 'ROLLED_BACK' : 'ROLLBACK_REQUIRED');
        assert.equal(x.objects.get('system.adapter.nexowatt-devices.0').common.enabled, proof === true);
        assert.equal(resumed.allowsStartup(), false);
    }
});

test('revoked license, ownership or runtime readiness during source verification cannot commit', async () => {
    for (const revoked of ['license', 'ownership', 'runtime']) {
        const x = fixture(); await x.migration.start(); x.migration.options.startTimeoutMs = 20; let ready = true;
        x.owner.eosModuleHost = { status: async () => ({ active: ready, reason: ready ? 'RUNNING' : 'STOPPING' }), async stop() {} };
        x.migration.stoppedSource = async () => {
            if (revoked === 'license') x.owner.eosLicenseService.statusView = () => ({ valid: false, coreEnabled: false });
            else if (revoked === 'ownership') x.owner.eosOwnership.canWrite = () => false;
            else ready = false;
            return true;
        };
        await x.migration.verifyRuntime();
        assert.equal(x.migration.phase, 'ROLLED_BACK');
        assert.equal(x.logs.some(message => message.startsWith('EOS_MIGRATION_COMMITTED:')), false);
        assert.equal(x.objects.get('system.adapter.nexowatt-devices.0').common.enabled, true);
    }
});

test('the early monitor deadline also covers an unresolved asynchronous readiness observation', async () => {
    const x = fixture(); await x.migration.start(); x.migration.options.startTimeoutMs = 10;
    x.owner.eosModuleHost = { status: () => new Promise(() => {}), async stop() {} };
    await x.migration.verifyRuntime();
    assert.equal(x.migration.phase, 'ROLLED_BACK');
    assert.equal(x.migration.status().code, 'EOS_MIGRATION_NEW_RUNTIME_TIMEOUT');
    assert.equal(x.objects.get('system.adapter.nexowatt-devices.0').common.enabled, true);
});

test('a late readiness rejection after intentional shutdown does not begin rollback or re-enable old writers', async () => {
    const x = fixture(); await x.migration.start(); let rejectRead;
    x.owner.eosModuleHost = { status: () => new Promise((_resolve, reject) => { rejectRead = reject; }), async stop() {} };
    const monitoring = x.migration.verifyRuntime();
    await new Promise(resolve => setImmediate(resolve));
    x.migration.stop(); rejectRead(new Error('late status failure')); await monitoring;
    assert.equal(x.migration.phase, 'TRANSFERRED');
    assert.equal(x.migration.allowsWrites(), false);
    assert.equal(x.objects.get('system.adapter.nexowatt-devices.0').common.enabled, false);
    assert.equal(x.mutations.some(row => row.patch?.common?.enabled === true), false);
});
