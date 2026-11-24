/** Copyright (c) 2026 NexoWatt. Confidential and Proprietary; see LICENSE. */
'use strict';
// Actual migration coordinator, virtual monotonic clock, in-memory controller.
// Transport status is controlled; no real old adapter or physical device is stopped.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { createHash } = require('node:crypto');
const source = process.env.EOS_MIGRATION_AUDIT_SOURCE || path.resolve(__dirname,
    process.env.EOS_TEST_RUNTIME === 'build' ? '../build/lib/eosLegacyMigration.js' : '../src/lib/eosLegacyMigration.js');
function fixture(status) {
    let elapsed = 0;
    let stoppedAt = null;
    const localRequire = createRequire(source);
    const moduleValue = { exports: {} };
    vm.runInNewContext(fs.readFileSync(source, 'utf8'), {
        module: moduleValue, exports: moduleValue.exports, Buffer, setTimeout, clearTimeout,
        require(name) {
            if (name === 'node:perf_hooks') return { performance: { now: () => elapsed } };
            if (name === 'node:timers/promises') return { setTimeout: async ms => { elapsed += ms; } };
            return localRequire(name);
        },
    }, { filename: source });
    const objects = new Map();
    const states = new Map();
    const native = { devices: [{ id: 'retained-device' }] };
    const previous = { _id: 'system.adapter.nexowatt-devices.0', type: 'instance', native,
        common: { host: 'fixture', version: '0.5.176', enabled: false }, ts: Date.now() - 10 };
    objects.set(previous._id, previous);
    states.set(previous._id + '.alive', { val: false, ack: true, ts: Date.now() });
    const owner = {
        namespace: 'eos-admin.0', config: {},
        log: { info() {}, warn() {}, error() {} },
        // Serialization fixture, deliberately not a cryptography test.
        encrypt: text => 'fixture-envelope:' + text, decrypt: text => text.slice('fixture-envelope:'.length),
        eosLicenseService: { statusView: () => ({ valid: true, coreEnabled: true }) },
        eosOwnership: { canWrite: () => true },
        eosModuleHost: {
            status: async () => status(elapsed), entries: new Map(),
            stop: async () => { stoppedAt = elapsed; },
        },
        async getForeignObjectAsync(id) { return structuredClone(objects.get(id) || null); },
        async getForeignStateAsync(id) {
            return id === 'system.host.fixture.alive' ? { val: true, ack: true, ts: Date.now() } : states.get(id) || null;
        },
        async setForeignObjectAsync(id, object) { objects.set(id, structuredClone(object)); },
        async extendForeignObjectAsync(id, patch) {
            const object = objects.get(id);
            const updated = { ...object, common: { ...object.common, ...patch.common }, ts: Date.now() };
            objects.set(id, updated);
            states.set(id + '.alive', { val: updated.common.enabled, ack: true, ts: updated.ts + 1 });
        },
        async setObjectNotExistsAsync() {}, async setStateAsync() {},
    };
    const migration = new moduleValue.exports.EosLegacyMigration(owner, {});
    migration.phase = 'TRANSFERRED';
    migration.journal = { sources: [{ id: 'devices', source: 'nexowatt-devices.0', enabled: true,
        host: 'fixture', sourceVersion: '0.5.176', nativeHash: createHash('sha256').update(JSON.stringify(native)).digest('hex') }] };
    owner.eosMigration = migration;
    return { owner, migration, objects, states, elapsed: () => elapsed, stoppedAt: () => stoppedAt };
}
function starting(completedObjects, extra = {}) {
    return { id: 'devices', active: false, reason: 'STARTING',
        details: { startup: { pending: true, completedObjects } }, ...extra };
}
const running = () => ({ id: 'devices', active: true, reason: 'RUNNING' });

test('slow Devices metadata progress commits at 60 seconds without the old 45-second rollback', async () => {
    const f = fixture(ms => ms >= 60000 ? running() : starting(Math.floor(ms / 30)));
    await f.migration.verifyRuntime();
    assert.equal(f.migration.phase, 'COMMITTED');
    assert.equal(f.elapsed(), 60000);
    assert.equal(f.stoppedAt(), null);
    assert.equal(f.objects.get('system.adapter.nexowatt-devices.0').common.enabled, false);
});

test('confirmed progress has a fixed 165-second migration ceiling even if a faulty host never completes', async () => {
    const f = fixture(ms => starting(Math.floor(ms / 30)));
    await f.migration.verifyRuntime();
    assert.equal(f.elapsed(), 165000);
    assert.equal(f.stoppedAt(), 165000);
    assert.equal(f.migration.phase, 'ROLLED_BACK');
    assert.equal(f.objects.get('system.adapter.nexowatt-devices.0').common.enabled, true);
});

for (const [name, status] of [
    ['no progress', () => starting(0)],
    ['READY transport status', ms => starting(ms, { reason: 'READY' })],
    ['unconfirmed metadata counter', ms => ({ id: 'devices', active: false, reason: 'STARTING', details: { startup: { completedObjects: ms, pending: false } } })],
    ['constant historical count', () => starting(900)],
    ['invalid counter', () => starting(Infinity)],
]) {
    test(`${name} cannot extend the ordinary 45-second limit`, async () => {
        const f = fixture(status);
        await f.migration.verifyRuntime();
        assert.equal(f.elapsed(), 45000);
        assert.equal(f.stoppedAt(), 45000);
        assert.equal(f.migration.phase, 'ROLLED_BACK');
    });
}

test('progress does not conceal a module failure or defer confirmed rollback', async () => {
    const f = fixture(ms => ms >= 12000 ? { id: 'devices', active: false, reason: 'START_FAILED_RESTART_REQUIRED' }
        : starting(Math.floor(ms / 30)));
    await f.migration.verifyRuntime();
    assert.equal(f.elapsed(), 12000);
    assert.equal(f.stoppedAt(), 12000);
    assert.equal(f.migration.phase, 'ROLLED_BACK');
});

test('intentional stop during extended startup does not resurrect old writers', async () => {
    const f = fixture(ms => {
        if (ms >= 50000) f.migration.stop();
        return starting(Math.floor(ms / 30));
    });
    await f.migration.verifyRuntime();
    assert.equal(f.elapsed(), 50000);
    assert.equal(f.stoppedAt(), null);
    assert.equal(f.migration.phase, 'TRANSFERRED');
    assert.equal(f.objects.get('system.adapter.nexowatt-devices.0').common.enabled, false);
});
