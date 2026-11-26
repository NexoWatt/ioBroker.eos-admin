'use strict';

// Actual hosted HTTP handlers and charging identity migration. Controller state
// storage is a fixture; no charging station or physical command is involved.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const { synchronizeChargingPointIdentity } = require('../ui/lib/charging-point-identity');

const modeState = index => `chargingManagement.wallboxes.lp${index}.userMode`;
const row = name => ({ enabled: true, name, powerId: `test.${name}.power`, setCurrentAId: `test.${name}.set`,
    modeId: `test.${name}.mode`, minCurrentA: 6, maxCurrentA: 16, phases: 3, userMode: name === 'A' ? 'boost' : 'pv' });
function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

async function fixture(t, { initialRows, persistedStates } = {}) {
    const h = await createHarness();
    const a = h.adapter, rows = initialRows || [row('A'), row('B')];
    h.bridge.getLicense = () => ({ valid: true, coreEnabled: true, edition: 'pro',
        limits: { chargePoints: 50, batteries: 10 }, features: ['energy', 'wallet', 'smartHome'] });
    a.config.enableChargingManagement = true;
    a.config.settingsConfig = { evcsCount: rows.length, evcsList: rows };
    a.evcsList = rows.map((value, index) => ({ ...value, index: index + 1 }));
    a.config.chargeKiosk = { enabled: true, stations: [{ id: 'fixture', token: 'fixture-station-token-long-enough',
        enabled: true, assignmentMode: 'manual', assignedChargepoints: ['lp1', 'lp2'],
        allowedModes: ['solar', 'fast', 'auto'], allowStartStop: true, controlProfile: 'chargingManagement' }] };
    const stationUrl = '/api/display/station/fixture-station-token-long-enough/command';
    if (persistedStates) for (const [id, state] of persistedStates) h.states.set(id, structuredClone(state));
    await synchronizeChargingPointIdentity(a, rows);
    if (!persistedStates) for (let index = 0; index < rows.length; index++) await a.setStateAsync(modeState(index + 1), rows[index].userMode, true);
    const token = await h.login('kunde');
    const writes = [];
    const originalLocal = a.setStateAsync.bind(a), originalForeign = a.setForeignStateAsync.bind(a);
    a.setStateAsync = async (id, ...args) => { writes.push({ kind: 'local', id, args }); return originalLocal(id, ...args); };
    a.setForeignStateAsync = async (id, ...args) => { writes.push({ kind: 'foreign', id, args }); return originalForeign(id, ...args); };
    t.after(async () => { a._nwShuttingDown = false; a._nwEvcsIdentityTransitionPending = false; a._nwMeshAppSaveInProgress = false; await h.close(); });
    return { ...h, a, rows, token, writes, stationUrl,
        set: body => h.request('/api/set', { token, method: 'POST', body }),
        station: body => h.request(stationUrl, { method: 'POST', body }),
        mode: index => h.states.get(`eos-admin.0.${modeState(index)}`)?.val };
}

// The fixture has no running EMS engine. Apply the real drained identity
// transition, then expose its committed rows exactly as installer reconfigure does.
async function replaceRows(h, rows) {
    await synchronizeChargingPointIdentity(h.a, rows);
    h.a.config.settingsConfig = { ...h.a.config.settingsConfig, evcsCount: rows.length, evcsList: rows };
    h.a.evcsList = rows.map((value, index) => ({ ...value, index: index + 1 }));
}
async function identity(h) {
    const response = await h.request('/config', { token: h.token });
    assert.equal(response.status, 200, response.text);
    const value = response.data.chargingControlIdentity;
    assert.ok(value && value.revision && value.slots, 'configuration publishes a confirmed charging identity');
    return value;
}
async function deniedIdentity(h, command) {
    h.writes.length = 0;
    const response = await command();
    assert.equal(response.status, 409, response.text);
    assert.equal(response.data.error, 'EOS_EVCS_IDENTITY_CHANGED');
    assert.deepEqual(h.writes, [], 'a stale identity must be rejected before diagnostics and physical writes');
}

test('EMS and legacy EVCS writes are rejected before diagnostics during save, identity migration and shutdown', async t => {
    const h = await fixture(t);
    for (const flag of ['_nwMeshAppSaveInProgress', '_nwEvcsIdentityTransitionPending', '_nwShuttingDown']) {
        h.a[flag] = true;
        for (const body of [{ scope: 'ems', key: 'evcs.1.userMode', value: 'pv' },
            { scope: 'evcs', key: '1.mode', value: 2 }]) {
            h.writes.length = 0;
            const response = await h.set(body);
            assert.equal(response.status, 409, `${flag}: ${response.text}`);
            assert.equal(response.data.error, 'EOS_EVCS_IDENTITY_BUSY');
            assert.deepEqual(h.writes, [], 'rejected command must produce no local diagnostic or foreign write');
        }
        h.a[flag] = false;
    }
    assert.equal(h.mode(1), 'boost');
    assert.equal(h.mode(2), 'pv');
});

for (const route of ['EMS', 'station', 'legacy EVCS']) {
test(`accepted asynchronous ${route} write finishes before identity snapshot and cannot target the replacement slot`, async t => {
    const h = await fixture(t);
    const entered = deferred(), release = deferred();
    let writeCompleted = false, transitionCompleted = false;
    const method = route === 'legacy EVCS' ? 'setForeignStateAsync' : 'setStateAsync';
    const originalSet = h.a[method].bind(h.a), originalGet = h.a.getStateAsync.bind(h.a);
    const target = route === 'legacy EVCS' ? 'test.B.mode' : modeState(2);
    h.a[method] = async (id, ...args) => {
        const value = args[0] && typeof args[0] === 'object' ? args[0].val : args[0];
        if (id === target && value === (route === 'legacy EVCS' ? 2 : 'auto')) {
            entered.resolve();
            await release.promise;
            const result = await originalSet(id, ...args);
            writeCompleted = true;
            return result;
        }
        return originalSet(id, ...args);
    };
    const accepted = route === 'station' ? h.station({ lp: 'lp2', action: 'set-mode', mode: 'auto' })
        : route === 'legacy EVCS' ? h.set({ scope: 'evcs', key: '2.mode', value: 2 })
            : h.set({ scope: 'ems', key: 'evcs.2.userMode', value: 'auto' });
    t.after(() => release.resolve());
    await entered.promise;
    const snapshotReads = [];
    h.a.getStateAsync = async id => { snapshotReads.push({ id, writeCompleted }); return originalGet(id); };
    const transition = synchronizeChargingPointIdentity(h.a, [h.rows[1]]).then(() => { transitionCompleted = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.a._nwEvcsIdentityTransitionPending, true);
    assert.equal(transitionCompleted, false);
    assert.deepEqual(snapshotReads, [], 'the migration cannot read an older snapshot while an accepted control is outstanding');
    const denied = await h.set({ scope: 'ems', key: 'evcs.1.userMode', value: 'pv' });
    assert.equal(denied.status, 409);
    assert.equal(denied.data.error, 'EOS_EVCS_IDENTITY_BUSY');
    release.resolve();
    assert.equal((await accepted).status, 200);
    await transition;
    assert.ok(snapshotReads.length > 0);
    assert.ok(snapshotReads.every(read => read.writeCompleted));
    assert.equal(h.mode(1), route === 'legacy EVCS' ? 'pv' : 'auto', 'B keeps its accepted EMS wish when it moves from lp2 to lp1');
    if (route === 'legacy EVCS') {
        assert.deepEqual(h.writes.filter(write => write.kind === 'foreign' && write.id.startsWith('test.')),
            [{ kind: 'foreign', id: 'test.B.mode', args: [2] }], 'accepted legacy command completes once on B; migration does not replay it on A or another slot');
    }
    assert.equal(h.a._nwEvcsIdentityTransitionPending, false);
});
}

test('validation and failed writes release the accepted control so subsequent identity changes do not remain blocked', async t => {
    const h = await fixture(t);
    for (const body of [{ scope: 'ems', key: 'unsupported.control', value: true },
        { scope: 'evcs', key: 'unsupported.control', value: true }]) {
        const response = await h.set(body);
        assert.equal(response.status, 400);
        await synchronizeChargingPointIdentity(h.a, h.rows);
        assert.equal(h.a._nwEvcsIdentityTransitionPending, false);
    }
    const original = h.a.setStateAsync.bind(h.a);
    h.a.setStateAsync = async (id, ...args) => {
        if (id === modeState(2)) throw new Error('fixture write failure');
        return original(id, ...args);
    };
    assert.equal((await h.set({ scope: 'ems', key: 'evcs.2.userMode', value: 'auto' })).status, 409);
    h.a.setStateAsync = original;
    await synchronizeChargingPointIdentity(h.a, [h.rows[1]]);
    assert.equal(h.a._nwEvcsIdentityTransitionPending, false);
    assert.equal(h.mode(1), 'pv', 'failed writes cannot replace B’s saved wish');
});

test('valid unauthenticated station command is fenced before both station diagnostics and control writes', async t => {
    const h = await fixture(t);
    for (const flag of ['_nwMeshAppSaveInProgress', '_nwEvcsIdentityTransitionPending', '_nwShuttingDown']) {
        h.a[flag] = true;
        h.writes.length = 0;
        const response = await h.station({ lp: 'lp2', action: 'set-mode', mode: 'pv' });
        assert.equal(response.status, 409, `${flag}: ${response.text}`);
        assert.equal(response.data.error, 'EOS_EVCS_IDENTITY_BUSY');
        assert.deepEqual(h.writes, []);
        h.a[flag] = false;
    }
    const accepted = await h.station({ lp: 'lp2', action: 'set-mode', mode: 'auto' });
    assert.equal(accepted.status, 200, accepted.text);
    assert.equal(accepted.data.accepted, true);
    assert.equal(h.mode(2), 'auto');
    assert.ok(h.writes.some(write => write.id.includes('chargeKiosk.stations.fixture.lastCommand')));
    assert.equal(h.writes.some(write => write.kind === 'foreign' && write.id.startsWith('test.')), false);
});

test('failed station bridge releases its control admission before the next identity transition', async t => {
    const h = await fixture(t);
    h.a.config.chargeKiosk.stations[0].controlProfile = 'readonly';
    const failed = await h.station({ lp: 'lp2', action: 'set-mode', mode: 'pv' });
    assert.equal(failed.status, 500, failed.text);
    await synchronizeChargingPointIdentity(h.a, [h.rows[1]]);
    assert.equal(h.a._nwEvcsIdentityTransitionPending, false);
    assert.equal(h.mode(1), 'pv');
});

test('configuration tokens reject stale and missing browser identity after deleting a preceding charging point', async t => {
    const h = await fixture(t), before = await identity(h);
    assert.deepEqual(Object.keys(before.slots), ['lp1', 'lp2']);
    assert.notEqual(before.slots.lp1, before.slots.lp2);
    await replaceRows(h, [h.rows[1]]);
    const current = await identity(h);
    assert.notEqual(current.revision, before.revision);
    assert.deepEqual(Object.keys(current.slots), ['lp1']);
    assert.notEqual(current.slots.lp1, before.slots.lp1);
    assert.notEqual(current.slots.lp1, before.slots.lp2, 'the moved connector receives a new binding for its new slot');
    for (const expectedChargingIdentity of [undefined, before.slots.lp1, before.slots.lp2]) {
        for (const body of [{ scope: 'ems', key: 'evcs.1.userMode', value: 'boost' },
            { scope: 'evcs', key: '1.mode', value: 1 }]) {
            await deniedIdentity(h, () => h.set({ ...body, expectedChargingIdentity }));
        }
    }
    assert.equal(h.mode(1), 'pv');
    const accepted = await h.set({ scope: 'ems', key: 'evcs.1.userMode', value: 'auto', expectedChargingIdentity: current.slots.lp1 });
    assert.equal(accepted.status, 200, accepted.text);
    assert.equal(h.mode(1), 'auto');
    const legacy = await h.set({ scope: 'evcs', key: '1.mode', value: 2, expectedChargingIdentity: current.slots.lp1 });
    assert.equal(legacy.status, 200, legacy.text);
    assert.equal(h.writes.some(write => write.kind === 'foreign' && write.id === 'test.B.mode' && write.args[0] === 2), true);
    assert.equal(h.writes.some(write => write.kind === 'foreign' && write.id === 'test.A.mode'), false);
});

test('unchanged charging slots retain tokenless compatibility while reused slots require the current identity', async t => {
    const h = await fixture(t), before = await identity(h);
    await replaceRows(h, [h.rows[0], row('C')]);
    const current = await identity(h);
    assert.equal(current.slots.lp1, before.slots.lp1);
    assert.notEqual(current.slots.lp2, before.slots.lp2);
    const accepted = await h.set({ scope: 'ems', key: 'evcs.1.userMode', value: 'auto' });
    assert.equal(accepted.status, 200, accepted.text);
    assert.equal(h.mode(1), 'auto');
    await deniedIdentity(h, () => h.set({ scope: 'ems', key: 'evcs.2.userMode', value: 'boost' }));
    const updated = await h.set({ scope: 'ems', key: 'evcs.2.userMode', value: 'auto', expectedChargingIdentity: current.slots.lp2 });
    assert.equal(updated.status, 200, updated.text);
    assert.equal(h.mode(2), 'auto');
});

test('global EMS and EVCS settings reject stale or missing layout revision after a layout change', async t => {
    const h = await fixture(t), before = await identity(h);
    await replaceRows(h, [h.rows[1]]);
    const current = await identity(h);
    for (const expectedChargingLayoutRevision of [undefined, before.revision]) {
        for (const body of [{ scope: 'ems', key: 'evcs.global.storageAssistEnabled', value: true },
            { scope: 'settings', key: 'evcsActive', value: false },
            { scope: 'settings', key: 'evcsMode', value: 1 }]) {
            await deniedIdentity(h, () => h.set({ ...body, expectedChargingLayoutRevision }));
        }
    }
    const accepted = await h.set({ scope: 'settings', key: 'evcsActive', value: false, expectedChargingLayoutRevision: current.revision });
    assert.equal(accepted.status, 200, accepted.text);
    assert.ok(h.writes.length > 0, 'a current layout revision allows the requested global setting');
});

test('persisted charging registry keeps reused slots protected across a fresh runtime', async t => {
    const h = await fixture(t), before = await identity(h);
    await replaceRows(h, [h.rows[1]]);
    const committed = await identity(h);
    const restarted = await fixture(t, { initialRows: [row('B')], persistedStates: h.states });
    const restored = await identity(restarted);
    assert.deepEqual(restored, committed);
    for (const expectedChargingIdentity of [undefined, before.slots.lp1]) {
        await deniedIdentity(restarted, () => restarted.set({ scope: 'ems', key: 'evcs.1.userMode', value: 'boost', expectedChargingIdentity }));
    }
    const accepted = await restarted.set({ scope: 'ems', key: 'evcs.1.userMode', value: 'auto', expectedChargingIdentity: restored.slots.lp1 });
    assert.equal(accepted.status, 200, accepted.text);
    assert.equal(restarted.mode(1), 'auto');
});

test('station payload exposes only assigned identities and rejects stale commands before station diagnostics', async t => {
    const h = await fixture(t), before = await identity(h);
    h.a.config.chargeKiosk.stations[0].assignedChargepoints = ['lp1'];
    const stationUrl = h.stationUrl.replace(/\/command$/, '');
    const initial = await h.request(stationUrl);
    assert.equal(initial.status, 200, initial.text);
    assert.deepEqual(initial.data.chargingControlIdentity, { revision: before.revision, slots: { lp1: before.slots.lp1 } });
    await replaceRows(h, [h.rows[1]]);
    const updated = await h.request(stationUrl);
    assert.equal(updated.status, 200, updated.text);
    const current = updated.data.chargingControlIdentity;
    assert.deepEqual(Object.keys(current.slots), ['lp1']);
    assert.notEqual(current.slots.lp1, before.slots.lp1);
    for (const expectedChargingIdentity of [undefined, before.slots.lp1]) {
        await deniedIdentity(h, () => h.station({ lp: 'lp1', action: 'set-mode', mode: 'fast', expectedChargingIdentity }));
    }
    const accepted = await h.station({ lp: 'lp1', action: 'set-mode', mode: 'auto', expectedChargingIdentity: current.slots.lp1 });
    assert.equal(accepted.status, 200, accepted.text);
    assert.equal(h.mode(1), 'auto');
    assert.ok(h.writes.some(write => write.id.includes('chargeKiosk.stations.fixture.lastCommand')));
});

test('returning a previously removed charger to the same slot cannot revive its old browser token', async t => {
    const h = await fixture(t), before = await identity(h);
    await replaceRows(h, [h.rows[1]]);
    await replaceRows(h, [h.rows[0]]);
    const restored = await identity(h);
    assert.notEqual(restored.slots.lp1, before.slots.lp1);
    await deniedIdentity(h, () => h.set({ scope: 'ems', key: 'evcs.1.userMode', value: 'boost', expectedChargingIdentity: before.slots.lp1 }));
    const accepted = await h.set({ scope: 'ems', key: 'evcs.1.userMode', value: 'pv', expectedChargingIdentity: restored.slots.lp1 });
    assert.equal(accepted.status, 200, accepted.text);
    assert.equal(h.mode(1), 'pv');
});
