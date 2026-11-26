'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createOwnershipGuard } = require('../src/lib/eosUnifiedOwnership');

const ownId = 'system.adapter.eos-admin.0';
const oldId = 'system.adapter.nexowatt-ui.0';
function setup() {
    const now = Date.now();
    const objects = new Map([[ownId, { _id: ownId, type: 'instance', ts: now - 2000, common: { enabled: true, host: 'host-a' } }]]);
    const states = new Map();
    let readHook;
    let subscribeFails = false;
    const writes = [];
    const owner = {
        namespace: 'eos-admin.0',
        log: { warn() {} },
        async getObjectViewAsync(_design, _type, options) {
            if (readHook) await readHook();
            return { rows: [...objects.values()].filter(object => object._id >= options.startkey && object._id <= options.endkey).map(value => ({ id: value._id, value: structuredClone(value) })) };
        },
        async getForeignStateAsync(id) { return structuredClone(states.get(id)); },
        async subscribeForeignObjectsAsync() { if (subscribeFails) throw new Error('offline'); },
        async subscribeForeignStatesAsync() { if (subscribeFails) throw new Error('offline'); },
        async setObjectNotExistsAsync() {},
        async setStateAsync(id, value) { writes.push({ id, value }); },
    };
    const guard = createOwnershipGuard(owner);
    function addOld(id = oldId, host = 'host-b') {
        objects.set(id, { _id: id, type: 'instance', ts: now - 2000, common: { enabled: false, host } });
        states.set(`${id}.alive`, { val: false, ack: true, ts: now - 1000 });
        states.set(`system.host.${host}.alive`, { val: true, ack: true, ts: now });
    }
    return { owner, objects, states, guard, writes, addOld, now,
        hook(fn) { readHook = fn; }, failSubscriptions() { subscribeFails = true; } };
}

test('fresh installation permits exactly the enabled owner after controller inventory', async t => {
    const x = setup(); t.after(() => x.guard.stop());
    assert.equal(x.guard.canWrite(), false);
    assert.equal(await x.guard.start(), true);
    assert.equal(x.guard.canWrite(), true);
    assert.equal(x.guard.status().reason, 'CONTROLLER_HANDOVER_CONFIRMED');
});

test('fresh controller evidence reports the actual migration fence without granting writes', async t => {
    const x = setup(); t.after(() => x.guard.stop());
    let blocked = true;
    x.owner.eosMigration = {
        allowsWrites: () => !blocked,
        status: () => ({ phase: 'LICENSE_REQUIRED', code: 'EOS_MIGRATION_RESTART_REQUIRED', encrypted: 'private-journal', sources: [{ config: 'private-config' }] }),
    };
    assert.equal(await x.guard.start(), true, 'the controller inventory itself is valid');
    assert.equal(x.guard.canWrite(), false);
    const status = x.guard.status();
    assert.equal(status.reason, 'MIGRATION_BLOCKED');
    assert.deepEqual(status.migration, { phase: 'LICENSE_REQUIRED', code: 'EOS_MIGRATION_RESTART_REQUIRED' });
    assert.equal(status.allowed, false);
    assert.equal(JSON.stringify(status).includes('private-'), false);
    assert.equal(JSON.stringify(x.writes).includes('private-'), false);
    blocked = false;
    assert.equal(x.guard.canWrite(), true);
    assert.equal(x.guard.status().reason, 'CONTROLLER_HANDOVER_CONFIRMED');
    assert.equal(Object.hasOwn(x.guard.status(), 'migration'), false);
});

test('a module-local migration fence keeps other scopes operational only under confirmed single ownership', async t => {
    const x = setup(); t.after(() => x.guard.stop());
    x.addOld();
    x.owner.eosMigration = { allowsWrites: scope => Boolean(scope) && scope !== 'devices' };
    assert.equal(await x.guard.start(), true);
    for (const scope of ['ui', 'ems', 'backup', 'eebus', 'ocpp']) {
        assert.equal(x.guard.canWrite(scope), true, scope);
    }
    assert.equal(x.guard.status('devices').reason, 'MIGRATION_BLOCKED');
    assert.equal(x.guard.canWrite('devices'), false);
    x.objects.get(oldId).common.enabled = true;
    x.guard.onObjectChange(oldId, x.objects.get(oldId));
    assert.equal(await x.guard.refresh(), false);
    for (const scope of ['ui', 'ems', 'backup', 'eebus', 'ocpp', 'devices']) {
        assert.equal(x.guard.canWrite(scope), false, scope);
    }
});

test('migration diagnostics reject untrusted fields and failed reads without changing ownership', async t => {
    const x = setup(); t.after(() => x.guard.stop());
    x.owner.eosMigration = { allowsWrites: () => false, status: () => ({ phase: '<private>', code: 'private detail / secret' }) };
    await x.guard.start();
    assert.deepEqual(x.guard.status().migration, { phase: 'NOT_AVAILABLE', code: '' });
    x.owner.eosMigration.status = () => { throw new Error('private diagnostic exception'); };
    const status = x.guard.status();
    assert.deepEqual(status.migration, { phase: 'NOT_AVAILABLE', code: 'EOS_MIGRATION_STATUS_UNAVAILABLE' });
    assert.equal(status.reason, 'MIGRATION_BLOCKED');
    assert.equal(status.allowed, false);
    assert.equal(JSON.stringify(status).includes('private'), false);
});

test('a competing writer keeps its controller reason while a migration fence is also visible', async t => {
    const x = setup(); t.after(() => x.guard.stop()); x.addOld();
    x.objects.get(oldId).common.enabled = true;
    x.owner.eosMigration = { allowsWrites: () => false, status: () => ({ phase: 'BLOCKED', code: 'EOS_MIGRATION_DISABLED_UI_REVIEW' }) };
    assert.equal(await x.guard.start(), false);
    assert.equal(x.guard.status().reason, 'LEGACY_OR_PARALLEL_WRITER');
    assert.equal(x.guard.status().blockers[0].reason, 'INSTANCE_ENABLED');
    assert.equal(x.guard.status().migration.phase, 'BLOCKED');
    assert.equal(x.guard.canWrite(), false);
});

test('enabled old writer on another host denies startup even when alive is false', async t => {
    const x = setup(); t.after(() => x.guard.stop()); x.addOld();
    x.objects.get(oldId).common.enabled = true;
    assert.equal(await x.guard.start(), false);
    assert.equal(x.guard.status().blockers[0].reason, 'INSTANCE_ENABLED');
});

test('disabled and confirmed stopped old controller permits handover', async t => {
    const x = setup(); t.after(() => x.guard.stop()); x.addOld();
    assert.equal(await x.guard.start(), true);
});

for (const [name, mutate, reason] of [
    ['live old process', x => { x.states.get(`${oldId}.alive`).val = true; }, 'STOP_NOT_CONFIRMED'],
    ['missing stop acknowledgement', x => { x.states.delete(`${oldId}.alive`); }, 'STOP_NOT_CONFIRMED'],
    ['unacknowledged stop request', x => { x.states.get(`${oldId}.alive`).ack = false; }, 'STOP_NOT_CONFIRMED'],
    ['stop predates disable edit', x => { x.states.get(`${oldId}.alive`).ts = x.now - 3000; }, 'STOP_NOT_CONFIRMED'],
    ['offline foreign controller', x => { x.states.get('system.host.host-b.alive').val = false; }, 'CONTROLLER_NOT_CONFIRMED'],
    ['stale foreign controller', x => { x.states.get('system.host.host-b.alive').ts = x.now - 70000; }, 'CONTROLLER_NOT_CONFIRMED'],
    ['future-dated foreign controller', x => { x.states.get('system.host.host-b.alive').ts = x.now + 70000; }, 'CONTROLLER_NOT_CONFIRMED'],
]) {
    test(`${name} fails closed`, async t => {
        const x = setup(); t.after(() => x.guard.stop()); x.addOld(); mutate(x);
        assert.equal(await x.guard.start(), false);
        assert.equal(x.guard.canWrite(), false);
        assert.equal(x.guard.status().blockers[0].reason, reason);
    });
}

test('another enabled EOS instance is also a competing writer', async t => {
    const x = setup(); t.after(() => x.guard.stop()); x.addOld('system.adapter.eos-admin.1');
    x.objects.get('system.adapter.eos-admin.1').common.enabled = true;
    assert.equal(await x.guard.start(), false);
});

test('local daemon lifecycle confirms an older stop after metadata edit and a new controller start signal revokes every lease', async t => {
    const x=setup(); t.after(()=>x.guard.stop()); x.owner.host='host-a'; x.addOld(oldId,'host-a');
    const old=x.objects.get(oldId);
    Object.assign(old.common,{mode:'daemon',runAsCompactMode:false}); old.ts=x.now;
    const by='system.host.host-a';
    x.states.set(oldId+'.alive',{val:false,ack:true,ts:x.now-1000,q:0,from:by});
    x.states.set(oldId+'.sigKill',{val:-1,ack:false,ts:x.now-5000,q:0,from:by});
    assert.equal(await x.guard.start(),true);
    assert.equal(x.guard.canWrite('ems'),true);
    const marker={val:0,ack:false,ts:x.now,q:0,from:by};
    x.states.set(oldId+'.sigKill',marker); x.guard.onStateChange(oldId+'.sigKill',marker);
    assert.equal(x.guard.canWrite('ems'),false);assert.equal(x.guard.canWrite('devices'),false);
    assert.equal(await x.guard.refresh(),false);
    assert.equal(x.guard.status().blockers[0].reason,'STOP_NOT_CONFIRMED');
});

test('old instance enable event revokes synchronously before next database poll', async t => {
    const x = setup(); t.after(() => x.guard.stop()); x.addOld();
    await x.guard.start();
    x.objects.get(oldId).common.enabled = true;
    x.guard.onObjectChange(oldId, x.objects.get(oldId));
    assert.equal(x.guard.canWrite(), false);
    assert.equal(await x.guard.refresh(), false);
});

test('controller loss and own disable revoke without waiting for async work', async t => {
    const x = setup(); t.after(() => x.guard.stop());
    await x.guard.start();
    x.guard.onStateChange('system.host.remote.alive', { val: false, ack: true });
    assert.equal(x.guard.canWrite(), false);
    await x.guard.refresh();
    x.guard.onObjectChange(ownId, { common: { enabled: false } });
    assert.equal(x.guard.canWrite(), false);
});

test('an event racing a database snapshot prevents stale permission restoration', async t => {
    const x = setup(); t.after(() => x.guard.stop()); await x.guard.start();
    let release;
    const wait = new Promise(resolve => { release = resolve; });
    x.hook(() => wait);
    const refresh = x.guard.refresh();
    x.guard.onStateChange(`${oldId}.alive`, { val: true, ack: true });
    release();
    assert.equal(await refresh, false);
    assert.equal(x.guard.canWrite(), false);
});

test('database failures revoke existing permission and never expose exception content', async t => {
    const x = setup(); t.after(() => x.guard.stop()); await x.guard.start();
    x.hook(() => { throw new Error('internal private connection details'); });
    assert.equal(await x.guard.refresh(), false);
    assert.equal(x.guard.canWrite(), false);
    assert.equal(x.guard.status().reason, 'INVENTORY_UNAVAILABLE');
    assert.equal(JSON.stringify(x.writes).includes('private connection'), false);
});

test('missing owner or invalid controller inventory cannot yield permission', async t => {
    const x = setup(); t.after(() => x.guard.stop()); x.objects.delete(ownId);
    assert.equal(await x.guard.start(), false);
    assert.equal(x.guard.status().reason, 'INVENTORY_UNAVAILABLE');
});

test('subscription failure cannot be bypassed by refresh', async t => {
    const x = setup(); t.after(() => x.guard.stop()); x.failSubscriptions();
    assert.equal(await x.guard.start(), false);
    assert.equal(await x.guard.refresh(), false);
    assert.equal(x.guard.canWrite(), false);
});

test('stop wins over an in-flight inventory refresh', async () => {
    const x = setup(); await x.guard.start();
    let release;
    const wait = new Promise(resolve => { release = resolve; });
    x.hook(() => wait);
    const pending = x.guard.refresh(); x.guard.stop(); release();
    assert.equal(await pending, false);
    assert.equal(x.guard.canWrite(), false);
    assert.equal(x.guard.status().reason, 'STOPPED');
});

const { createMigrationPlan } = require('../tools/eos-migration-plan.cjs');
function migrationInput() {
    return {
        objects: {
            'system.adapter.nexowatt-ui.0': {
                _id: 'system.adapter.nexowatt-ui.0', type: 'instance', common: { version: '1.0.38', enabled: false },
                native: { port: 8188, auth: { mode: 'old' }, licenseKey: 'synthetic-license-not-real',
                    installerConfig: { grid: 'nexowatt-ui.0.grid.power', apiToken: 'synthetic-token-not-real' },
                    settings: { tariff: 'manual' } },
            },
            'nexowatt-ui.0.grid.power': { _id: 'nexowatt-ui.0.grid.power', type: 'state', common: { type: 'number', unit: 'W', read: true, write: false }, native: {} },
            'nexowatt-ui.0.installer.configJson': { _id: 'nexowatt-ui.0.installer.configJson', type: 'state', common: { type: 'string', read: true, write: false }, native: {} },
            'nexowatt-ui.0.control.mode': { _id: 'nexowatt-ui.0.control.mode', type: 'state', common: { type: 'string', read: true, write: true }, native: {} },
            'script.js.external': { _id: 'script.js.external', type: 'script', common: { source: 'getState("nexowatt-ui.0.grid.power")' }, native: {} },
        },
        states: {
            'nexowatt-ui.0.grid.power': { val: 2200, ack: true, ts: 1 },
            'nexowatt-ui.0.installer.configJson': { val: JSON.stringify({ state: 'nexowatt-ui.0.grid.power', password: 'synthetic-password-not-real' }), ack: true, ts: 1 },
            'nexowatt-ui.0.control.mode': { val: 'boost', ack: false, ts: 1 },
        },
    };
}

test('offline migration preserves mapped values and records external refs without replaying commands or credentials', () => {
    const input = migrationInput();
    const before = structuredClone(input);
    const plan = createMigrationPlan(input, 'nexowatt-ui.0', 'eos-admin.0');
    assert.deepEqual(input, before);
    assert.equal(plan.applied, false);
    assert.equal(plan.instancePatch.native.eosUi.installerConfig.grid, 'eos-admin.0.grid.power');
    assert.equal(plan.instancePatch.native.eosUi.settings.tariff, 'manual');
    assert.equal(plan.stateProposals['eos-admin.0.grid.power'].val, 2200);
    assert.equal(plan.stateProposals['eos-admin.0.control.mode'], undefined);
    assert.equal(JSON.parse(plan.stateProposals['eos-admin.0.installer.configJson'].val).state, 'eos-admin.0.grid.power');
    assert.deepEqual(plan.externalReferences, ['script.js.external']);
    assert.equal(JSON.stringify(plan).includes('synthetic-'), false);
    assert.equal(plan.credentialReentry.length, 2);
});

test('migration refuses conflicting target IDs and malformed configuration JSON', () => {
    const input = migrationInput();
    input.objects['eos-admin.0.grid.power'] = { _id: 'eos-admin.0.grid.power', type: 'state' };
    assert.throws(() => createMigrationPlan(input, 'nexowatt-ui.0', 'eos-admin.0'), /TARGET_COLLISION/);
    delete input.objects['eos-admin.0.grid.power'];
    input.states['nexowatt-ui.0.installer.configJson'].val = '{';
    assert.throws(() => createMigrationPlan(input, 'nexowatt-ui.0', 'eos-admin.0'), /CONFIG_JSON_INVALID/);
});

test('migration refuses prototype keys and non-EOS namespace targets', () => {
    const input = migrationInput();
    input.objects['system.adapter.nexowatt-ui.0'].native.settings = JSON.parse('{"__proto__":{"admin":true}}');
    assert.throws(() => createMigrationPlan(input, 'nexowatt-ui.0', 'eos-admin.0'), /UNSAFE_PROPERTY/);
    assert.throws(() => createMigrationPlan(migrationInput(), 'nexowatt-ui.0', 'admin.0'), /NAMESPACE_INVALID/);
});

