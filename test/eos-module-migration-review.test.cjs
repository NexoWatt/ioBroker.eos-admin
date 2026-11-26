'use strict';
// Independent failure-boundary review: simulate the documented controller API
// difference between an instance view and protectedNative-aware object reads.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EosLegacyMigration } = require('../src/lib/eosLegacyMigration');
const { EosModuleConfigStore } = require('../src/lib/eosModuleConfigStore');
const defaults = require('../io-package.json').native.eosUi;
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function fixture() {
    const now = Date.now(); const objects = new Map(); const enabledWrites = []; const writes = [];
    const ownId = 'system.adapter.eos-admin.0';
    objects.set(ownId, { _id: ownId, type: 'instance', common: { enabled: true, host: 'fixture-host', version: '9.0.7' }, native: {} });
    const owner = { namespace: 'eos-admin.0', config: { eosUi: clone(defaults), eosModules: {} },
        log: { info() {}, warn() {}, error() {} },
        encrypt: text => `test-cipher:${Buffer.from(text).toString('base64')}`,
        decrypt: text => Buffer.from(text.slice('test-cipher:'.length), 'base64').toString(),
        eosLicenseService: { statusView: () => ({ valid: true, coreEnabled: true }), allowsEmbeddedModule: () => true },
        eosOwnership: { canWrite: () => true },
        async getObjectViewAsync(_design, _view, range) {
            return { rows: [...objects.values()].filter(object => object._id >= range.startkey && object._id <= range.endkey).map(value => ({ value: clone(value) })) };
        },
        async getForeignObjectAsync(id) {
            const object = clone(objects.get(id));
            // ioBroker adapter-core returns the field list but removes its values
            // when another adapter reads an instance's protectedNative fields.
            if (object?.protectedNative && id !== ownId) for (const field of object.protectedNative) delete object.native[field];
            return object;
        },
        async getForeignStateAsync(id) {
            if (id === 'system.host.fixture-host.alive') return { val: true, ack: true, ts: now };
            if (id.endsWith('.alive')) return { val: objects.get(id.slice(0, -6))?.common.enabled === true, ack: true, ts: Date.now() };
            return null;
        },
        async setForeignObjectAsync(id, object) { writes.push(id); objects.set(id, clone(object)); },
        async extendForeignObjectAsync(id, update) {
            if (typeof update.common?.enabled === 'boolean') enabledWrites.push({ id, enabled: update.common.enabled });
            const old = objects.get(id); objects.set(id, { ...old, common: { ...old.common, ...update.common }, ts: Date.now() });
        },
        async setObjectNotExistsAsync() {}, async setStateAsync() {},
    };
    const options = { baseDir: path.resolve(__dirname, '..'), dataDir: '/tmp/eos-review-no-files', stopTimeoutMs: 10,
        factories: { eebus: { preflightLegacyConfig: async config => ({ config }), validateConfig: config => config } } };
    return { owner, objects, enabledWrites, writes, options, migration: new EosLegacyMigration(owner, options) };
}

test('protected fields hidden by getForeignObject block every source before any earlier adapter is disabled', async () => {
    const f = fixture(); const ts = Date.now() - 1000;
    const ui = { _id: 'system.adapter.nexowatt-ui.0', type: 'instance', ts,
        common: { enabled: true, host: 'fixture-host', version: '1.0.38' }, native: { settings: { selectedMeter: 'meter.0.power' } } };
    const eebus = { _id: 'system.adapter.eebus.0', type: 'instance', ts,
        common: { enabled: true, host: 'fixture-host', version: '0.3.0' },
        protectedNative: ['certificate', 'privateKey', 'pairingPin'], encryptedNative: ['privateKey', 'pairingPin'],
        native: { certificate: 'fixture-public', privateKey: f.owner.encrypt('fixture-private'), pairingPin: f.owner.encrypt('1234') } };
    f.objects.set(ui._id, ui); f.objects.set(eebus._id, eebus);
    await f.migration.start();
    assert.equal(f.migration.status().phase, 'BLOCKED');
    assert.equal(f.migration.status().code, 'EOS_MIGRATION_PROTECTED_FIELDS_UNAVAILABLE');
    assert.deepEqual(f.enabledWrites, []); assert.deepEqual(f.writes, []);
    assert.equal(f.objects.get(ui._id).common.enabled, true);
    assert.equal(f.objects.get(eebus._id).common.enabled, true);
    assert.deepEqual(f.objects.get(eebus._id).native, eebus.native);
});

test('invalid encrypted migration journal fences ownership rather than continuing from IDLE', async () => {
    const f = fixture(); const store = new EosModuleConfigStore(f.owner, { moduleIds: ['migration'] });
    await store.save('migration', { v: 1, encrypted: f.owner.encrypt(JSON.stringify({ v: 999, owner: f.owner.namespace, phase: 'TRANSFERRED', sources: [] })) });
    await assert.rejects(f.migration.start(), /EOS_MIGRATION_JOURNAL_INVALID/);
    assert.equal(f.migration.status().phase, 'ROLLBACK_REQUIRED');
    assert.equal(f.migration.allowsWrites(), false); assert.deepEqual(f.enabledWrites, []);
});

test('unreadable UI destination before journal recovery keeps migration write authority fenced', async () => {
    const f = fixture(); const store = new EosModuleConfigStore(f.owner, { moduleIds: ['ui'] });
    await store.save('ui', { v: 1, encrypted: f.owner.encrypt('not-json') });
    await assert.rejects(f.migration.start(), /EOS_MIGRATION_DECRYPTION/);
    assert.equal(f.migration.allowsWrites(), false); assert.deepEqual(f.enabledWrites, []);
});

test('committed migration cannot resume with a missing or foreign-namespace UI destination', async () => {
    for (const defect of ['missing', 'foreign-namespace']) {
        const f = fixture();
        const ui = { _id: 'system.adapter.nexowatt-ui.0', type: 'instance', ts: Date.now() - 1000,
            common: { enabled: true, host: 'fixture-host', version: '1.0.38' },
            native: { siteName: 'Customer site', installerConfig: { nvp: { stateId: 'meter.0.power', limitW: 70000 } } } };
        f.objects.set(ui._id, ui);
        await f.migration.start();
        assert.equal(f.migration.phase, 'TRANSFERRED');
        f.owner.eosHostedRuntime = { status: () => ({ emsReady: true, canWrite: true }) };
        await f.migration.verifyRuntime();
        assert.equal(f.migration.phase, 'COMMITTED');
        const store = new EosModuleConfigStore(f.owner, { moduleIds: ['ui'] });
        if (defect === 'missing') f.objects.delete(store.objectId('ui'));
        else {
            const envelope = await store.load('ui');
            envelope.migration.source = 'nexowatt-ui.9';
            await store.save('ui', envelope);
        }
        // A fresh adapter process starts with package defaults, not the previous
        // process's in-memory migrated configuration.
        f.owner.config = { eosUi: clone(defaults), eosModules: {} };
        const restart = new EosLegacyMigration(f.owner, f.options);
        await assert.rejects(restart.start(), /EOS_MIGRATION_/, defect);
        assert.equal(restart.allowsWrites(), false, defect);
        assert.equal(f.objects.get(ui._id).common.enabled, false, defect);
    }
});

test('ready UI with revoked ownership cannot commit the legacy handover', async () => {
    const f = fixture();
    const ui = { _id: 'system.adapter.nexowatt-ui.0', type: 'instance', ts: Date.now() - 1000,
        common: { enabled: true, host: 'fixture-host', version: '1.0.38' }, native: { siteName: 'Customer site' } };
    f.objects.set(ui._id, ui);
    await f.migration.start();
    assert.equal(f.migration.phase, 'TRANSFERRED');
    // Controller/user restarts the legacy UI while the new EMS has already
    // initialized. Readiness stays true, but its live write authority is revoked.
    await f.owner.extendForeignObjectAsync(ui._id, { common: { enabled: true } });
    f.migration.options.startTimeoutMs = 10;
    f.owner.eosHostedRuntime = { status: () => ({ emsReady: true, canWrite: false }), async stop() {} };
    await f.migration.verifyRuntime();
    assert.notEqual(f.migration.phase, 'COMMITTED');
    assert.equal(f.objects.get(ui._id).common.enabled, true);
});

test('a stopped source transfers configuration and retains its disabled state without reactivation', async () => {
    const f = fixture();
    const ui = { _id: 'system.adapter.nexowatt-ui.0', type: 'instance', ts: Date.now() - 1000,
        common: { enabled: false, host: 'fixture-host', version: '1.0.38' }, native: { siteName: 'Customer site' } };
    f.objects.set(ui._id, ui);
    await f.migration.start();
    assert.equal(f.migration.phase, 'TRANSFERRED');
    assert.equal(f.owner.config.eosUi.siteName, 'Customer site');
    f.owner.eosHostedRuntime = { status: () => ({ emsReady: true, canWrite: true }) };
    await f.migration.verifyRuntime();
    assert.equal(f.migration.phase, 'COMMITTED');
    assert.deepEqual(f.enabledWrites, []);
    assert.equal(f.objects.get(ui._id).common.enabled, false);
});
