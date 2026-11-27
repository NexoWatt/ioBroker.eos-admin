'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const productRoot = path.resolve(process.env.EOS_MIGRATION_PACKAGE_ROOT || path.join(__dirname,'..'));
const libraries = path.join(productRoot,process.env.EOS_MIGRATION_PACKAGE_ROOT ? 'build/lib' : 'src/lib');
const { EosLegacyMigration } = require(path.join(libraries,'eosLegacyMigration'));
const { EosModuleHost } = require(path.join(libraries,'eosModuleHost'));
const { EosModuleConfigStore } = require(path.join(libraries,'eosModuleConfigStore'));
const { randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');
const defaults = require(path.join(productRoot,'io-package.json')).native.eosUi;
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
    const migration = new EosLegacyMigration(owner, { baseDir: productRoot, dataDir: '/tmp/eos-migration-test-unused', factories, stopTimeoutMs: 150, startTimeoutMs: 200 });
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

test('preflight ambiguity, incompatible device shape, remote host, missing license and existing destination never stop a source', async () => {
    const scenarios = [
        x => { const other = structuredClone(x.objects.get('system.adapter.nexowatt-devices.0')); other._id = 'system.adapter.nexowatt-devices.2'; x.objects.set(other._id, other); },
        x => { x.objects.get('system.adapter.nexowatt-devices.0').native = { unrecognizedDeviceInventory: [{ id: 'retained' }] }; },
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

test('confirmed stopped UI transfers unchanged with no source enable write and waits for both split processes', async () => {
    const x = fixture([{ id: 'ui', source: 'nexowatt-ui.0', version: '1.0.38', native: { siteName: 'Retained', installerConfig: { nvp: { stateId: 'meter.0.power' } } }, enabled: false }]);
    const id = 'system.adapter.nexowatt-ui.0';
    const before = structuredClone(x.objects.get(id));
    const mapping = { val: '{"timers":[{"deviceId":"light","enabled":true}]}', ack: true };
    x.states.set('nexowatt-ui.0.smarthome.timersJson', mapping);
    await x.migration.start(); assert.equal(x.migration.phase, 'TRANSFERRED');
    assert.equal(x.owner.config.eosUiMigration.source, 'nexowatt-ui.0');
    assert.deepEqual(x.owner.config.eosUi, before.native);
    assert.deepEqual(x.states.get('nexowatt-ui.0.smarthome.timersJson'), mapping);
    assert.ok(x.owner.config.eosUiMigration.requiredStates.includes('smarthome.timersJson'));
    x.migration.options.startTimeoutMs = 1500;
    const ui = { active: false, process: { state: 'starting', pid: 14001 } };
    const ems = { state: 'degraded', active: false, emsReady: false, canWrite: false, process: { state: 'starting', pid: 14002 } };
    x.owner.eosHostedRuntime = { status: () => ({ ...ems, ui, ems }) };
    const monitoring = x.migration.verifyRuntime();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(x.migration.phase, 'TRANSFERRED', 'starting children are pending');
    Object.assign(ems, { emsReady: true, canWrite: true, active: true, state: 'ready', process: { state: 'running', pid: 14002 } });
    assert.equal((await x.migration.readiness(x.migration.journal.sources, performance.now() + 1000)).ready, false, 'the GUI is still starting');
    ui.active = true; ui.process.state = 'running';
    await monitoring;
    assert.equal(x.migration.phase, 'COMMITTED');
    assert.deepEqual(x.objects.get(id), before);
    assert.equal(x.mutations.some(row => row.id === id), false);
});

test('restoring after failed cutover never enables an originally disabled UI', async () => {
    const x = fixture([{ id: 'ui', source: 'nexowatt-ui.0', version: '1.0.38', native: { siteName: 'Retained' }, enabled: false }]);
    await x.migration.start();
    x.owner.eosHostedRuntime = { status: () => ({ state: 'degraded', emsReady: false, canWrite: false, process: { state: 'failed' } }), async stop() {} };
    await x.migration.verifyRuntime();
    assert.equal(x.migration.phase, 'ROLLED_BACK');
    assert.equal(x.objects.get('system.adapter.nexowatt-ui.0').common.enabled, false);
    assert.equal(x.mutations.some(row => row.id.startsWith('system.adapter.')), false);
});

test('explicit target pause requires loaded saved intent and a stopped EMS', async () => {
    const x = fixture([{ id: 'ui', source: 'nexowatt-ui.0', version: '1.0.37', native: { siteName: 'Retained' }, enabled: false }]);
    await x.migration.start(); assert.equal(x.migration.phase, 'TRANSFERRED');
    const ui = { active: true, process: { state: 'running', pid: 13000 } };
    const ems = { active: false, canWrite: false, emsReady: false, process: { state: 'stopped', pid: null } };
    x.owner.eosHostedRuntime = { status: () => ({ ui, ems }) };
    let enabled = null;
    x.owner.eosRuntimeControl = { dashboardIntent: id => ({ enabled: id === 'ems' ? enabled : true, error: '' }) };
    const ready = async () => (await x.migration.readiness(x.migration.journal.sources, performance.now() + 500)).ready;
    assert.equal(await ready(), false);
    enabled = false; ems.process.pid = 13001;
    assert.equal(await ready(), false);
    ems.process.pid = null;
    await x.migration.verifyRuntime();
    assert.equal(x.migration.phase, 'COMMITTED');
    assert.equal(x.mutations.some(row => row.id.startsWith('system.adapter.')), false);
});

test('unrelated failed EMS and initial module status never cause premature rollback of Devices', async () => {
    const x = fixture();
    await x.migration.start();
    const state = { id: 'devices', enabled: null, active: false, reason: 'CONFIG_INVALID',
        details: { configuration: { ready: false, error: 'EOS_MODULE_CONFIG_UNAVAILABLE' } } };
    x.owner.eosHostedRuntime = { status: () => ({ state: 'degraded', process: { state: 'failed' } }) };
    x.owner.eosModuleHost = { status: () => state };
    const read = () => x.migration.readiness(x.migration.journal.sources, performance.now() + 1000);
    assert.deepEqual(await read(), { ready: false, failed: false, devicesProgress: 0 });
    state.details.configuration.error = 'EOS_MODULE_CONFIG_STORE_INVALID';
    assert.equal((await read()).failed, true);
    state.reason = 'WAITING_FOR_OWNERSHIP';
    assert.deepEqual(await read(), { ready: false, failed: false, devicesProgress: 0 });
    state.reason = 'RUNNING'; state.active = true; state.enabled = true;
    await x.migration.verifyRuntime(); assert.equal(x.migration.phase, 'COMMITTED');
});

test('unconfirmed source stop only fences that process family and can retry after correction', async () => {
    const x = fixture([{ id: 'ui', source: 'nexowatt-ui.0', version: '1.0.38', native: { siteName: 'Retained' }, enabled: false }]);
    const aliveId = 'system.adapter.nexowatt-ui.0.alive';
    x.states.set(aliveId, { val: true, ack: true, ts: Date.now() });
    await x.migration.start(); assert.equal(x.migration.phase, 'BLOCKED');
    assert.equal(x.migration.status().code, 'EOS_MIGRATION_STOP_UNCONFIRMED');
    assert.deepEqual(x.migration.status().issues, [{ id: 'ui', source: 'nexowatt-ui.0', code: 'EOS_MIGRATION_STOP_UNCONFIRMED' }]);
    for (const id of ['ui', 'ems']) assert.equal(x.migration.allowsWrites(id), false);
    for (const id of ['devices', 'backup', 'ocpp', 'eebus']) assert.equal(x.migration.allowsWrites(id), true);
    assert.equal(x.migration.allowsSupervisorStartup(), true);
    assert.equal(x.mutations.some(row => row.id.startsWith('system.adapter.')), false);
    x.states.set(aliveId, { val: false, ack: true, ts: Date.now() });
    const again = new EosLegacyMigration(x.owner, x.migration.options); await again.start();
    assert.equal(again.phase, 'TRANSFERRED');
});

test('older confirmed stop is accepted only with same local controller lifecycle order on a noncompact UI', async () => {
    const { hasConfirmedLegacyStop } = require('../src/lib/eosLegacyMigration');
    const t = Date.now(); const from = 'system.host.host';
    const base = { _id: 'system.adapter.nexowatt-ui.0', ts: t, common: { enabled: false, mode: 'daemon', host: 'host' } };
    const stopped = { val: false, ack: true, ts: t - 1000, from };
    const started = { val: 14589, ack: true, ts: t - 4000, from };
    for (const marker of [started, { ...started, val: -1, ack: false }]) {
        assert.equal(await hasConfirmedLegacyStop({ host: 'host', getForeignStateAsync: async () => marker }, base, stopped), true);
    }
    for (const marker of [null, { ...started, val: 0, ack: false }, { ...started, ts: t - 500 }, { ...started, ts: stopped.ts },
        { ...started, from: 'system.adapter.admin.0' }, { ...started, ack: false }, { ...started, q: 32 }]) {
        assert.equal(await hasConfirmedLegacyStop({ host: 'host', getForeignStateAsync: async () => marker }, base, stopped), false);
    }
    const reader = { host: 'host', getForeignStateAsync: async () => started };
    for (const common of [{ ...base.common, enabled: true }, { ...base.common, runAsCompactMode: true },
        { ...base.common, mode: 'schedule' }, { ...base.common, host: 'remote' }]) {
        assert.equal(await hasConfirmedLegacyStop(reader, { ...base, common }, stopped), false);
    }
    assert.equal(await hasConfirmedLegacyStop(reader, base, { ...stopped, from: 'system.adapter.admin.0' }), false);
});

test('atomic mixed group leaves retained legacy devices live and permits unrelated EOS modules', async () => {
    const x = fixture([{ id: 'devices', source: 'nexowatt-devices.0', version: '0.5.176', native: { devices: [] } },
        { id: 'backup', source: 'nexowatt-backup.0', version: '99.9.9', native: {} }]);
    await x.migration.start();
    assert.equal(x.migration.phase, 'BLOCKED');
    assert.deepEqual(x.migration.status().issues, [{ id: 'backup', source: 'nexowatt-backup.0', code: 'EOS_MIGRATION_MODULE_FORMAT_UNVERIFIED' }]);
    assert.equal(x.migration.allowsWrites(), false); assert.equal(x.migration.allowsSupervisorStartup(), true);
    for (const id of ['backup', 'devices']) assert.equal(x.migration.allowsWrites(id), false);
    for (const id of ['ui', 'ems', 'eebus', 'ocpp']) assert.equal(x.migration.allowsWrites(id), true);
    for (const row of x.migration.status().sources) assert.equal(x.objects.get(`system.adapter.${row.source}`).common.enabled, true);
    assert.equal(x.mutations.some(row => row.id.startsWith('system.adapter.')), false);
    x.objects.set('system.adapter.eos-admin.0', { _id: 'system.adapter.eos-admin.0', type: 'instance', common: { enabled: true }, native: {} });
    const again = new EosLegacyMigration(x.owner, x.migration.options); await again.start();
    assert.equal(again.status().code, 'EOS_MIGRATION_PARALLEL_EOS');
    assert.equal(again.allowsSupervisorStartup(), false);
    for (const id of ['backup', 'devices', 'ui', 'ems', 'eebus', 'ocpp']) assert.equal(again.allowsWrites(id), false);
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

test('source versions describe the source; accepted Devices semantics decide compatibility across releases', async () => {
    const devices = require('../modules/devices');
    const catalog = await devices.getCatalog();
    const template = catalog.templates.find(row => Array.isArray(row.protocols) && row.protocols.includes('modbusTcp'));
    assert.ok(template, 'released Modbus profile');
    const device = { id: 'meter-main', templateId: template.id, protocol: 'modbusTcp', enabled: true };
    for (const [version, native] of [
        ['0.5.172', { devices: [], devicesJson: JSON.stringify([device]) }],
        ['0.5.143', { devices: [device] }],
        ['37.0.199', { devicesJson: JSON.stringify([device]) }],
        [undefined, { devices: [device] }]
    ]) {
        const f = fixture([{ id: 'devices', source:'nexowatt-devices.0', version, native, enabled:false }]);
        f.migration.options.factories = { devices };
        const object = f.objects.get('system.adapter.nexowatt-devices.0');
        const row = await f.migration.candidate('devices', object, true);
        const config = f.migration.decode(row.envelope);
        assert.equal(row.sourceVersion, version ?? null);
        assert.equal(row.schemaVerified,true);
        assert.equal(row.enabled,false);
        assert.equal(row.targetEnabled,true);
        assert.equal(config.enabled,true);
        assert.deepEqual(config.devices.map(v=>v.id),['meter-main']);
        assert.equal(f.objects.get(object._id).common.enabled,false);
        assert.equal(f.mutations.length,0);
        if (!version) assert.equal(row.versionCode,'EOS_MIGRATION_VERSION_MISSING');
    }
});

test('UI and Devices stopped source migration retains source namespaces with missing, alternate and differing version metadata', async () => {
    const f=fixture([
        { id:'ui',source:'nexowatt-ui.0',version:'1.0.35',enabled:false,native:{history:{instance:'influxdb.0'},datapoints:{gridPointPower:'meter.0.w'}} },
        { id:'devices',source:'nexowatt-devices.0',version:undefined,enabled:false,native:{devices:[],devicesJson:'[]'} }
    ]);
    f.migration.options.factories.devices = require('../modules/devices');
    for (const [name,version] of [['nexowatt-ui','1.0.38'],['nexowatt-devices','0.5.172']]) {
        const id='system.adapter.'+name;
        f.objects.set(id,{_id:id,type:'adapter',common:{name,version},native:{}});
    }
    await f.migration.start();
    assert.equal(f.migration.phase,'TRANSFERRED');
    const sources=f.migration.status().sources;
    assert.equal(sources.find(s=>s.id==='ui').versionCode,'EOS_MIGRATION_VERSION_DIFFERENT');
    const ds=sources.find(s=>s.id==='devices');
    assert.equal(ds.sourceVersion,'0.5.172');assert.equal(ds.instanceVersion,null);
    assert.equal(f.owner.config.eosUi.history.instance,'influxdb.0');
    assert.ok(sources.every(s=>s.namespacePreserved));
    assert.ok(f.mutations.every(ev=>!ev.patch?.common?.enabled));
    const restarted=new EosLegacyMigration(f.owner,f.migration.options);
    await restarted.start();assert.equal(restarted.phase,'TRANSFERRED');
    assert.deepEqual(restarted.status().sources.map(s=>s.sourceVersion),sources.map(s=>s.sourceVersion));
});

test('a recognizable source version never substitutes for compatible source identity or configuration',async()=>{
    const scenarios=[
        ['EOS_MIGRATION_SOURCE_IDENTITY', f=>{f.objects.get('system.adapter.nexowatt-ui.0').common.name='foreign-ui';}],
        ['EOS_MIGRATION_SOURCE_IDENTITY', f=>{const id='system.adapter.nexowatt-ui';f.objects.set(id,{_id:id,type:'adapter',common:{name:'wrong',version:'1.0.35'},native:{}});}],
        ['EOS_MIGRATION_UI_CONFIG_SHAPE', f=>{f.objects.get('system.adapter.nexowatt-ui.0').native.datapoints={gridPointPower:{id:'a'}};}],
        ['EOS_MIGRATION_UI_CONFIG_SHAPE', f=>{f.objects.get('system.adapter.nexowatt-ui.0').native.history={instance: {server:'other'}};}],
        ['EOS_MIGRATION_DEVICES_CONFIG_SHAPE', f=>{f.objects.get('system.adapter.nexowatt-devices.0').native={hardwareMap:[{}]};}],
        ['EOS_DEVICES_UNKNOWN_TEMPLATE', f=>{f.objects.get('system.adapter.nexowatt-devices.0').native.devices=[{id:'a',templateId:'nonexistent-qa-profile',protocol:'modbusTcp'}];}],
    ];
    for(const [code,alter] of scenarios){
        const f=fixture([{id:'ui',source:'nexowatt-ui.0',version:'1.0.35',native:{siteName:'Customer'}},
            {id:'devices',source:'nexowatt-devices.0',version:'0.5.172',native:{devices:[]}}]);
        f.migration.options.factories.devices=require('../modules/devices');alter(f);
        await f.migration.start();assert.equal(f.migration.phase,'BLOCKED');
        assert.equal(f.migration.status().code,code);
        assert.ok(f.mutations.every(ev=>!ev.id.startsWith('system.adapter.')));
    }
});

test('stopped UI 1.0.35 and Devices 0.5.172 keep old Influx history readable over HTTP, restart and rollback', async t => {
    const { createHarness } = require('../ui/test/unified/http-harness.cjs');
    const oldUi = 'nexowatt-ui.0', oldDevices = 'nexowatt-devices.0', historian = 'influxdb.1';
    // UI 1.0.35 uses this exact ID for its historian export and stores the
    // separately assigned consumption source in native.history.datapoints.
    const pvId = oldUi + '.historie.core.pv.totalW';
    const loadId = oldDevices + '.devices.meter1.activePower';
    const x = fixture([
        { source: oldUi, version: '1.0.35', enabled: false, native: {
            siteName: 'Legacy test site', history: { instance: historian, datapoints: { consumptionTotal: loadId } },
        } },
        { source: oldDevices, version: '0.5.172', enabled: false,
            native: { pollIntervalMs: 2500, modbusTimeoutMs: 2000, registerAddressOffset: 0, devicesJson: '[]', devices: [] } },
    ]);
    // Production module validation, independent of an active device connection.
    x.factories.devices = require(path.join(productRoot,'modules/devices'));
    const from = Math.floor((Date.now() - 86400000) / 600000) * 600000;
    const oldPointAt = from + 600000;
    const alias = 'site-historical-house-power';
    const oldRecord = (id, custom) => ({ _id:id,type:'state',common:{type:'number',role:'value.power',unit:'W',custom:{[historian]:custom}},native:{} });
    x.objects.set(pvId,oldRecord(pvId,{enabled:true}));
    x.objects.set(loadId,oldRecord(loadId,{enabled:true,aliasId:alias}));
    for (const id of [pvId,loadId]) x.states.set(id,{val:null,ack:true,ts:from-1000});
    const original = [oldUi,oldDevices].map(id => structuredClone(x.objects.get('system.adapter.'+id)));
    const metadata = [pvId,loadId].map(id => structuredClone(x.objects.get(id)));
    const archive = new Map([[pvId,[[oldPointAt,1731]]],[alias,[[oldPointAt,642]]],
        [x.owner.namespace+'.historie.core.pv.totalW',[[oldPointAt,9999]]]]);
    const realEnabled = !!process.env.EOS_TEST_IOBROKER_INFLUXDB;
    if (realEnabled) assert.ok(process.env.EOS_TEST_INFLUXD,'an isolated InfluxDB binary is required');
    const database = realEnabled ? await require('./fixtures/legacy-influx-provider.cjs').realHistorian(t,archive,{[loadId]:alias}) : null;
    const reads = [];
    const historyResponse = (instance, command, body, callback) => {
        assert.equal(instance,historian); assert.equal(command,'getHistory');
        const key = x.objects.get(body.id)?.common.custom?.[instance]?.aliasId || body.id;
        reads.push(key);
        if (database) return database.query(body,callback);
        const result = (archive.get(key) || []).filter(([ts])=>ts>=body.options.start && ts<=body.options.end)
            .map(([ts,val])=>({ts,val}));
        callback({result});
    };
    const originalReadings = new Map([...archive].map(([k,v])=>[k,structuredClone(v)]));
    // Verify original storage, not just the current state's last numeric value.
    let newPointAt;
    async function readArchivedHttp(owner, recordNewSample = false) {
        const retained = owner.config.eosUiMigration;
        assert.equal(retained?.preserveNamespace,true);
        const h = await createHarness({legacyNamespace:retained.source});
        try {
            Object.assign(h.adapter.config,owner.config.eosUi);
            for (const [id,obj] of x.objects) h.objects.set(id,obj);
            for (const [id,state] of x.states) h.states.set(id,state);
            h.owner.sendTo = historyResponse;
            assert.equal(h.adapter.namespace,oldUi);
            const token = await h.login('admin');
            const response = await h.request('/api/history?from='+from+'&to='+(from+1200000)+'&step=600',{token});
            assert.equal(response.status,200,response.text);
            assert.equal(response.data.ok,true,response.text);
            // ioBroker.influxdb returns the Flux aggregateWindow end timestamp.
            const bucketAt = database ? oldPointAt+600000 : oldPointAt;
            assert.ok(response.data.series.pv.values.some(([ts,val])=>ts===bucketAt && val===1731),JSON.stringify(response.data.series.pv));
            assert.ok(response.data.series.load.values.some(([ts,val])=>ts===bucketAt && val===642),JSON.stringify(response.data.series.load));
            assert.ok(reads.includes(pvId) && reads.includes(alias));
            if (recordNewSample) {
                newPointAt = Date.now();
                let success, failure;
                const recorded = new Promise((resolve,reject)=>{success=resolve;failure=reject;});
                const timeout = setTimeout(()=>failure(new Error('retained PV recorder never received the new sample')),3000);
                const persist = h.owner.setForeignStateAsync;
                h.owner.setForeignStateAsync = async (id,state,...args) => {
                    try {
                        await persist(id,state,...args);
                        assert.equal(id,pvId);
                        assert.equal(state.ack,true);
                        assert.equal(state.ts,newPointAt);
                        assert.ok(x.objects.get(id)?.common.custom?.[historian]?.enabled);
                        if (database) await database.append(id,state.ts,state.val);
                        archive.get(id).push([state.ts,state.val]);
                        x.states.set(id,structuredClone(state)); success();
                    } catch (error) { failure(error); throw error; }
                };
                // Real EOS publisher/hosted namespace, fixture ioBroker state-change
                // delivery, real SDK/database when the acceptance harness is enabled.
                try {
                    h.adapter._nwSetHistorieValue('historie.core.pv.totalW',1902,newPointAt,0);
                    await recorded;
                } finally { clearTimeout(timeout); }
            }
        } finally { await h.close(); }
    }
    await x.migration.start();
    assert.equal(x.migration.phase,'TRANSFERRED',JSON.stringify(x.migration.status()));
    x.owner.eosHostedRuntime = {status:()=>({emsReady:true,canWrite:true})};
    await x.migration.verifyRuntime();
    assert.equal(x.migration.phase,'COMMITTED',JSON.stringify(x.migration.status()));
    await readArchivedHttp(x.owner);
    // Replace runtime and config memory while retaining only controller objects
    // and states. A second start must restore the migrated destination itself.
    await x.migration.stop();
    x.owner.config = {eosUi:structuredClone(defaults),eosModules:{}};
    const restarted = new EosLegacyMigration(x.owner,x.migration.options);
    t.after(()=>restarted.stop());
    await restarted.start();
    assert.equal(restarted.phase,'COMMITTED',JSON.stringify(restarted.status()));
    await readArchivedHttp(x.owner,true);
    const mutationsBeforeRepeat = x.mutations.length;
    await restarted.start();
    assert.equal(restarted.phase,'COMMITTED');
    assert.equal(x.mutations.length,mutationsBeforeRepeat,'committed resume must not start another transfer');
    await restarted.rollback('EOS_MIGRATION_FIXTURE_ROLLBACK',true);
    assert.equal(restarted.phase,'ROLLED_BACK');
    for (const [i,id] of [oldUi,oldDevices].entries()) assert.deepEqual(x.objects.get('system.adapter.'+id),original[i]);
    for (const [i,id] of [pvId,loadId].entries()) {
        assert.deepEqual(x.objects.get(id),metadata[i]);
        assert.equal(x.states.get(id).val,id === pvId ? 1902 : null);
    }
    assert.ok(newPointAt > oldPointAt);
    originalReadings.get(pvId).push([newPointAt,1902]);
    assert.deepEqual(archive,originalReadings,'old archive and exactly one new sample coexist under the retained series');
    if (database) await database.verify();
    assert.equal(x.mutations.some(row => row.patch?.common?.enabled === true),false);
});

test('installer history settings changed to an unsupported form while stopping trigger rollback', async () => {
    const f=fixture([{id:'ui',source:'nexowatt-ui.0',version:'1.0.35',native:{history:{instance:'influxdb.0'}}}]);
    const id='nexowatt-ui.0.installer.configJson';
    f.states.set(id,{val:'{"history":{"instance":"influxdb.0"}}',ack:true});
    const update=f.owner.extendForeignObjectAsync;
    f.owner.extendForeignObjectAsync=async (object,patch)=>{
        await update(object,patch);
        if(patch.common?.enabled===false) f.states.set(id,{val:'{"history":{"instance":7}}',ack:true});
    };
    await f.migration.start();assert.equal(f.migration.phase,'ROLLED_BACK');
    assert.equal(f.migration.status().code,'EOS_MIGRATION_UI_CONFIG_SHAPE');
    assert.equal(f.objects.get('system.adapter.nexowatt-ui.0').common.enabled,true);
    assert.equal(f.states.get(id).val,'{"history":{"instance":7}}');
    assert.equal(f.owner.config.eosUiMigration,undefined);
});

test('fallback binding changes after preflight cannot authorize stopping or transferring a different source',async()=>{
    const f=fixture([{id:'devices',source:'nexowatt-devices.0',version:undefined,native:{devices:[]}}]);
    const device=f.objects.get('system.adapter.nexowatt-devices.0');
    const id='system.adapter.nexowatt-devices';
    f.objects.set(id,{_id:id,type:'adapter',common:{name:'nexowatt-devices',version:'0.5.172'},native:{}});
    const row=await f.migration.candidate('devices',device);
    assert.equal(await f.migration.matchesSource(device,row),true);
    f.objects.get(id).common.version='0.5.173';
    assert.equal(await f.migration.matchesSource(device,row),false);
    f.objects.delete(id);
    assert.equal(await f.migration.matchesSource(device,row),false);
});

function manualFixture(t, { enabled = false, pauseEms = async () => {}, paused = '' } = {}) {
    const x = fixture([
        { source:'nexowatt-ui.0', version:'1.0.35', enabled, native:{siteName:'Kundenanlage',installerConfig:{}} },
        { source:'nexowatt-devices.0', version:'0.5.172', enabled, native:{devices:[{id:'meter',enabled:false}],pollIntervalMs:2500} },
    ]);
    x.migration.options.startTimeoutMs = 5000;
    x.owner.config.eosAutoMigrate = false;
    const lifecycle=[];
    const host = new EosModuleHost(x.owner, { ...x.migration.options,
        processEnabled:id=>id==='devices' && paused!==id, standbyRequested:()=>false });
    x.owner.eosModuleHost = host;
    x.owner.eosRuntimeControl = {isEnabled:id=>paused!==id,dashboardIntent:id=>({enabled:paused!==id,error:''})};
    x.owner.eosOwnership = { canWrite:id=>x.migration.allowsWrites(id),refresh:async()=>{} };
    const stopped={active:false,canWrite:false,process:{state:'stopped',pid:null}};
    x.owner.eosHostedRuntime = {
        pause:async()=>{lifecycle.push('pause UI');}, pauseEms:async()=>{lifecycle.push('pause EMS');await pauseEms();},
        resume:async()=>{lifecycle.push('start UI '+x.owner.config.eosUiMigration?.source);},
        resumeEms:async()=>{lifecycle.push('start EMS '+x.owner.config.eosUiMigration?.source);},
        status:()=>({ ui:paused==='ui'?stopped:{active:true},
            ems:paused==='ems'?stopped:{active:true,emsReady:true,canWrite:x.migration.allowsWrites('ems')} }),
        async stop(){lifecycle.push('stop');},
    };
    t.after(async()=>{x.migration.stop();await host.stop();});
    return { ...x,host,lifecycle };
}

test('live manual takeover of stopped UI 1.0.35 and Devices 0.5.172 keeps device switches, old identity, and independent writer scopes', async t=>{
    let release; const barrier=new Promise(resolve=>{release=resolve;});
    let entered; const holding=new Promise(resolve=>{entered=resolve;});
    const x=manualFixture(t,{pauseEms:async()=>{entered();await barrier;}});
    await x.migration.start(); await x.host.start();
    const original=structuredClone(x.objects.get('system.adapter.nexowatt-devices.0'));
    const before=x.mutations.length;
    const preview=await x.migration.manualReview();
    assert.equal(preview.phase,'DISABLED');
    assert.deepEqual(preview.sources.map(row=>row.sourceVersion).sort(),['0.5.172','1.0.35']);
    assert.equal(x.mutations.length,before);
    const view=x.migration.manualView();
    assert.equal(view.canActivateDevices,true);
    assert.throws(()=>x.migration.requestManual(true,'old',async()=>true),{code:'EOS_MIGRATION_REVISION_CONFLICT'});
    x.migration.requestManual(true,view.revision,async()=>true);
    try {
        assert.equal(x.migration.manualView().operation.state,'running');
        assert.throws(()=>x.migration.requestManual(true,view.revision,async()=>true),{code:'EOS_MIGRATION_BUSY'});
        await holding;
        for(const id of ['ui','ems','devices']) assert.equal(x.migration.allowsWrites(id),false,id);
        for(const id of ['eebus','backup','ocpp']) assert.equal(x.migration.allowsWrites(id),true,id);
        await assert.rejects(x.migration.saveUi({siteName:'competing UI save'}),{code:'EOS_MIGRATION_BUSY'});
        assert.equal(x.mutations.slice(before).some(item=>item.id.endsWith('.configuration')),false);
    } finally {release();}
    await x.migration.whenManualIdle();
    assert.deepEqual(x.migration.manualView().operation,{state:'complete',code:''},JSON.stringify(x.logs));
    assert.equal(x.migration.phase,'COMMITTED');
    assert.equal(x.migration.manualView().canStart,false);
    assert.deepEqual(x.lifecycle,['pause UI','pause EMS','start UI nexowatt-ui.0','start EMS nexowatt-ui.0']);
    assert.equal(x.host.namespace('devices'),'nexowatt-devices.0');
    assert.equal((await x.host.status('devices')).active,true);
    assert.equal(x.host.readConfig('devices').enabled,true);
    assert.equal(x.host.readConfig('devices').devices[0].enabled,false);
    assert.deepEqual(x.objects.get(original._id),original);
    assert.equal(x.owner.config.eosUi.siteName,'Kundenanlage');
    assert.equal(x.mutations.slice(before).some(row=>row.id.startsWith('system.adapter.')),false);
});

test('manual action honors disabled Devices without opt-in and a deliberately paused EMS on rebind',async t=>{
    const x=manualFixture(t,{paused:'ems'});
    await x.migration.start();await x.host.start();await x.migration.manualReview();
    x.migration.requestManual(false,x.migration.manualView().revision,async()=>true);
    await x.migration.whenManualIdle();
    assert.deepEqual(x.migration.manualView().operation,{state:'complete',code:''},JSON.stringify(x.logs));
    assert.equal(x.host.readConfig('devices').enabled,false);
    assert.equal((await x.host.status('devices')).active,false);
    assert.equal(x.lifecycle.includes('start EMS nexowatt-ui.0'),false);
});

test('changed inventory or withdrawn administrator authority cannot start a stale manual takeover',async t=>{
    const x=manualFixture(t);
    await x.migration.start();await x.host.start();await x.migration.manualReview();
    x.objects.get('system.adapter.nexowatt-devices.0').native.pollIntervalMs=4000;
    const base=x.mutations.length;
    x.migration.requestManual(true,x.migration.manualView().revision,async()=>true);
    await x.migration.whenManualIdle();
    assert.equal(x.migration.manualView().operation.code,'EOS_MIGRATION_INVENTORY_CHANGED');
    await x.migration.manualReview();
    x.migration.requestManual(true,x.migration.manualView().revision,async()=>false);
    await x.migration.whenManualIdle();
    assert.equal(x.migration.manualView().operation.code,'EOS_MIGRATION_AUTHORIZATION_CHANGED');
    assert.deepEqual(x.lifecycle,[]);
    assert.equal(x.mutations.length,base);
});

test('live migration checks the second authorization after stopping target processes and refuses an unconfirmed stop',async t=>{
    for(const failure of ['authorization','stop']){
        const x=manualFixture(t,{pauseEms:async()=>{if(failure==='stop')throw new Error('test stop failed');}});
        await x.migration.start();await x.host.start();await x.migration.manualReview();
        const base=x.mutations.length;
        let permits=0;
        x.migration.requestManual(true,x.migration.manualView().revision,async()=>++permits===1);
        await x.migration.whenManualIdle();
        const code=failure==='stop'?'EOS_MIGRATION_STOP_UNCONFIRMED':'EOS_MIGRATION_AUTHORIZATION_CHANGED';
        assert.equal(x.migration.manualView().operation.code,code);
        assert.equal(x.migration.phase,'BLOCKED');
        assert.equal(x.mutations.length,base);
        assert.equal(x.migration.allowsWrites('eebus'),true);
        assert.equal(x.migration.allowsWrites('devices'),false);
        assert.equal(x.migration.allowsWrites('ems'),false);
    }
});

test('source namespace handover preserves existing customer settings and active historian targets, including late target changes', async () => {
    for (const mode of ['installer','historian','empty','default','late']) {
        const f=fixture([{id:'ui',source:'nexowatt-ui.0',version:'1.0.35',native:{history:{instance:'influxdb.0'}}}]);
        const prefix=f.owner.namespace, key=prefix+'.installer.configJson';
        const patch={datapoints:{gridPointPower:'target.0.existing-grid'},history:{instance:'influxdb.5'}};
        const putPatch=p=>f.states.set(key,{val:JSON.stringify(p),ack:true});
        f.objects.set(key,{_id:key,type:'state',common:{type:'string'},native:{}});
        putPatch(mode==='installer'?patch:mode==='default'?{history:defaults.history}:{});
        const historian=prefix+'.historie';
        f.objects.set(historian,{_id:historian,type:'channel',common:{name:'Historie (Influx)'},native:{},from:'system.adapter.'+prefix});
        const counter=historian+'.core.pv.totalW';
        f.objects.set(counter,{_id:counter,type:'state',common:{type:'number',custom:mode==='historian'?{'influxdb.5':{enabled:true}}:{}},native:{}});
        if(mode==='late') {
            const update=f.owner.extendForeignObjectAsync;
            f.owner.extendForeignObjectAsync=async (id,p)=>{
                await update(id,p);if(p.common?.enabled===false)putPatch(patch);
            };
        }
        await f.migration.start();
        if(mode==='empty'||mode==='default') assert.equal(f.migration.phase,'TRANSFERRED',mode);
        else {
            assert.equal(f.migration.phase,mode==='late'?'ROLLED_BACK':'BLOCKED',mode);
            assert.equal(f.migration.status().code,'EOS_MIGRATION_DESTINATION_STATES');
            assert.equal(f.objects.get('system.adapter.nexowatt-ui.0').common.enabled,true);
            assert.equal(f.owner.config.eosUiMigration,undefined);
            if(mode!=='historian') assert.deepEqual(JSON.parse(f.states.get(key).val),patch);
        }
    }
});


test('only exact controller-attributed EOS provisioning can leave an empty root channel available to migration',async()=>{
    const cases=[
        ['historie','Historie (Influx)','self',true], ['historie','EOS Historie','self',true],
        ['smarthome','SmartHome','self',true], ['ems','EMS (intern)','self',true],
        ['energyFlow','local commissioning','self',false], ['chargepoints','Ladestationen','self',false],
        ['smarthome','SmartHome','system.adapter.admin.0',false], ['ems','EMS',undefined,false],
        ['historie','Customer archive','self',false], ['smarthome','Other site','self',false],
    ];
    for(const [branch,name,from,permitted] of cases){
        const f=fixture([{id:'ui',source:'nexowatt-ui.0',version:'1.0.35',native:{siteName:'Customer'}}]);
        const key=f.owner.namespace+'.'+branch;
        f.objects.set(key,{_id:key,type:'channel',common:{name},native:{},from:from==='self'?'system.adapter.'+f.owner.namespace:from});
        await f.migration.start();
        if(permitted) assert.equal(f.migration.phase,'TRANSFERRED',key);
        else{
            assert.equal(f.migration.status().code,'EOS_MIGRATION_DESTINATION_STATES',key);
            assert.equal(f.mutations.some(ev=>ev.patch?.common?.enabled===false),false);
        }
    }
});
