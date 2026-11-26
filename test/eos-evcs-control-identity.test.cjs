'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { synchronizeChargingPointIdentity: synchronize, bindChargingPointIdentityBaseline: bindBaseline,
    publicChargingControlIdentity: snapshot, assertChargingControlIdentity: admit,
    chargingPointLayout, remapChargingPointDefaultModes, CHARGING_IDENTITY_STATE } = require('../ui/lib/charging-point-identity');
const { EMS_CONTROL_FIELDS } = require('../ui/lib/ems-control-values');
const { EmsEngine } = require('../ui/ems/engine');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const { makeHarness } = require('../ui/scripts/verify-rc60-universal-auto-wallbox');

const row = (name, userMode = 'pv') => ({ enabled: true, name, powerId: `test.${name}.power`,
    setCurrentAId: `test.${name}.set`, minCurrentA: 6, maxCurrentA: 16, phases: 3, userMode });
const A = row('A', 'boost'), B = row('B', 'pv'), C = row('C', 'pv');
const ch = slot => `chargingManagement.wallboxes.lp${slot}`;
function fixture(states = new Map()) {
    const calls = [], objects = new Map();
    const adapter = { namespace: 'eos-admin.0', stateCache: {},
        async getStateAsync(id) { calls.push(['get', id]); return states.get(id) || null; },
        async setStateAsync(id, value) { calls.push(['set', id, value.val]); states.set(id, { ...value, ts: Date.now() }); },
        async setObjectNotExistsAsync(id, value) { if (!objects.has(id)) objects.set(id, value); },
    };
    return { adapter, states, calls, objects, read: id => states.get(id)?.val,
        put(id, val) { states.set(id, { val, ack: true, ts: Date.now() }); } };
}
function wishes(f, slot, mode, offset = 0) {
    const now = Date.now();
    const values = { userMode: mode, userStationEnabled: true, userEnabled: true, userAutoSource: 'strategy',
        userPhaseMode: 'fixed-1p', userStorageAssistEnabled: false, goalEnabled: true,
        goalTargetSocPct: 60 + offset, goalFinishTs: now + 3600000 + offset, goalBatteryKwh: 45 + offset,
        chargingSince: now - 60000 - offset, boostSince: mode === 'boost' ? now - 120000 - offset : 0,
        boostUntil: mode === 'boost' ? now + 600000 : 0, boostRemainingMin: mode === 'boost' ? 10 : 0,
        boostActive: mode === 'boost' };
    for (const [key, value] of Object.entries(values)) f.put(`${ch(slot)}.${key}`, value);
    f.put(`evcs.${slot}.mode`, mode === 'boost' ? 1 : mode === 'minpv' ? 2 : mode === 'pv' ? 3 : 0);
    return values;
}

for (const modes of [['boost', 'pv'], ['pv', 'boost']]) {
    test(`deleting first point preserves every B wish and timer (${modes.join(' / ')}) across restart`, async () => {
        const f = fixture(); wishes(f, 1, modes[0]); const b = wishes(f, 2, modes[1], 5);
        await synchronize(f.adapter, [A, B]);
        const old = snapshot(f.adapter);
        await synchronize(f.adapter, [B]);
        for (const [field, value] of Object.entries(b)) assert.equal(f.read(`${ch(1)}.${field}`), value, field);
        assert.equal(f.read(`${ch(2)}.userStationEnabled`), false, 'retired index is disabled');
        assert.equal(f.read(`${ch(2)}.boostSince`), 0);
        assert.equal(f.adapter.stateCache[`${ch(1)}.userMode`].value, modes[1], 'old cache cannot win over transferred DB value');
        assert.throws(() => admit(f.adapter, 'lp1', { expectedChargingIdentity: old.slots.lp1 }), /IDENTITY_CHANGED/);
        assert.throws(() => admit(f.adapter, 'lp1', {}), /IDENTITY_CHANGED/);
        const current = snapshot(f.adapter);
        admit(f.adapter, 'lp1', { expectedChargingIdentity: current.slots.lp1 });
        const restarted = fixture(f.states);
        await synchronize(restarted.adapter, [B]);
        assert.deepEqual(snapshot(restarted.adapter), current, 'incarnation tokens persist over process restart');
        for (const field of EMS_CONTROL_FIELDS) assert.equal(restarted.read(`${ch(1)}.${field}`), b[field]);
        assert.throws(() => admit(restarted.adapter, 'lp1', {}), /IDENTITY_CHANGED/);
        assert.throws(() => admit(restarted.adapter, 'lp2', { expectedChargingIdentity: old.slots.lp2 }), /IDENTITY_CHANGED/);
    });
}

test('delete-last leaves A untouched; reorder uses a complete snapshot before any copy', async () => {
    const f = fixture(); const a = wishes(f, 1, 'boost', 1), b = wishes(f, 2, 'pv', 2);
    await synchronize(f.adapter, [A, B]); const first = snapshot(f.adapter);
    await synchronize(f.adapter, [B, A]);
    for (const [field, value] of Object.entries(b)) assert.equal(f.read(`${ch(1)}.${field}`), value);
    for (const [field, value] of Object.entries(a)) assert.equal(f.read(`${ch(2)}.${field}`), value);
    await synchronize(f.adapter, [B]);
    for (const [field, value] of Object.entries(b)) assert.equal(f.read(`${ch(1)}.${field}`), value);
    assert.throws(() => admit(f.adapter, null, { expectedChargingLayoutRevision: first.revision }), /IDENTITY_CHANGED/);
    assert.throws(() => admit(f.adapter, null, {}), /IDENTITY_CHANGED/);
    admit(f.adapter, null, { expectedChargingLayoutRevision: snapshot(f.adapter).revision });
});

test('empty configuration and reused indices cannot inherit old boost or regain an old incarnation token', async () => {
    const f = fixture(); wishes(f, 1, 'boost'); await synchronize(f.adapter, [A]);
    const first = snapshot(f.adapter);
    await synchronize(f.adapter, []);
    assert.equal(f.read(`${ch(1)}.userStationEnabled`), false);
    await synchronize(f.adapter, [C]);
    assert.equal(f.read(`${ch(1)}.userMode`), 'pv');
    assert.equal(f.read(`${ch(1)}.goalEnabled`), false);
    assert.equal(f.read(`${ch(1)}.boostSince`), 0);
    await synchronize(f.adapter, [A]);
    assert.notEqual(snapshot(f.adapter).slots.lp1, first.slots.lp1);
    assert.throws(() => admit(f.adapter, 'lp1', { expectedChargingIdentity: first.slots.lp1 }), /IDENTITY_CHANGED/);
    assert.throws(() => admit(f.adapter, 'lp1', {}), /IDENTITY_CHANGED/);
});

test('metadata and measurement edits preserve tokens; a changed secondary actuator rotates the token without erasing wishes', async () => {
    const f = fixture(); const a = { ...A, modeId: 'test.A.mode' }; const values = wishes(f, 1, 'boost');
    await synchronize(f.adapter, [a]); const first = snapshot(f.adapter);
    await synchronize(f.adapter, [{ ...a, name: 'Renamed A', maxCurrentA: 10, statusId: 'test.A.newStatus' }]);
    assert.deepEqual(snapshot(f.adapter), first);
    await synchronize(f.adapter, [{ ...a, modeId: 'test.B.mode' }]);
    assert.notEqual(snapshot(f.adapter).slots.lp1, first.slots.lp1);
    assert.throws(() => admit(f.adapter, 'lp1', { expectedChargingIdentity: first.slots.lp1 }), /IDENTITY_CHANGED/);
    for (const [field, value] of Object.entries(values)) assert.equal(f.read(`${ch(1)}.${field}`), value);
});

test('a crash after configuration commit but before copying recovers from the durable previous layout', async () => {
    const f = fixture(); wishes(f, 1, 'boost'); const b = wishes(f, 2, 'pv');
    await synchronize(f.adapter, [A, B]);
    const reboot = fixture(f.states); // persisted configuration now contains only B
    await synchronize(reboot.adapter, [B]);
    for (const [field, value] of Object.entries(b)) assert.equal(reboot.read(`${ch(1)}.${field}`), value);
});

async function interrupted() {
    const f = fixture(); wishes(f, 1, 'boost'); const b = wishes(f, 2, 'pv');
    await synchronize(f.adapter, [A, B]);
    const original = f.adapter.setStateAsync;
    let writes = 0;
    f.adapter.setStateAsync = async (id, value) => {
        if (id !== CHARGING_IDENTITY_STATE && ++writes === 5) throw new Error('fixture-copy-failed');
        return original(id, value);
    };
    await assert.rejects(synchronize(f.adapter, [B]), /fixture-copy-failed/);
    assert.equal(f.adapter._nwEvcsIdentityTransitionPending, true);
    assert.ok(JSON.parse(f.read(CHARGING_IDENTITY_STATE)).journal);
    return { ...f, b, restore: () => { f.adapter.setStateAsync = original; } };
}

test('partial copy failure keeps the fence and recovers the exact original snapshot after restart', async () => {
    const f = await interrupted(); const reboot = fixture(f.states);
    await synchronize(reboot.adapter, [B]);
    for (const [field, value] of Object.entries(f.b)) assert.equal(reboot.read(`${ch(1)}.${field}`), value);
    assert.equal(JSON.parse(reboot.read(CHARGING_IDENTITY_STATE)).journal, undefined);
    assert.equal(reboot.adapter._nwEvcsIdentityTransitionPending, false);
});

test('another desired layout is rejected before config commit while an interrupted transfer remains recoverable', async () => {
    const f = await interrupted(); f.restore();
    await assert.rejects(bindBaseline(f.adapter, [A, B], [C]), /RECOVERY_LAYOUT_MISMATCH/);
    await bindBaseline(f.adapter, [A, B], [B]);
    assert.equal(f.adapter._nwEvcsIdentityTransitionPending, true, 'baseline must not pretend a pending copy is complete');
    const reboot = fixture(f.states); await synchronize(reboot.adapter, [B]);
    assert.equal(reboot.read(`${ch(1)}.userMode`), 'pv');
});

test('a malformed or incomplete journal never skips its mandatory transfer writes', async () => {
    for (const mutate of [j => { j.journal.writes = []; }, j => { j.journal.target[0].token = j.layout[0].token; },
        j => { delete j.journal.writes[0].values.userMode; }, j => { j.layoutChanged = false; j.protectedSlots = [1]; }]) {
        const f = await interrupted(); const value = JSON.parse(f.read(CHARGING_IDENTITY_STATE)); mutate(value);
        f.put(CHARGING_IDENTITY_STATE, JSON.stringify(value)); const reboot = fixture(f.states);
        await assert.rejects(synchronize(reboot.adapter, [B]), /IDENTITY_(JOURNAL|REGISTRY)_INVALID/);
        assert.equal(reboot.calls.some(call => call[0] === 'set'), false);
        assert.equal(reboot.adapter._nwEvcsIdentityTransitionPending, true);
    }
});

test('Engine.init cannot initialize modules after a failed identity transfer', async () => {
    const f = await interrupted(); f.adapter.evcsList = [B];
    f.adapter.setStateAsync = async () => { throw new Error('fixture-store-unavailable'); };
    const engine = new EmsEngine(f.adapter); let objects = 0;
    engine._ensureInternalStates = async () => { objects++; };
    await assert.rejects(engine.init(), /fixture-store-unavailable/);
    assert.equal(objects, 0); assert.equal(engine._timer, null);
    assert.equal(f.adapter._nwEvcsIdentityTransitionPending, true);
});

test('real settings normalization -> Engine charging config -> actual charging tick retains B PV after deleting boosted A', async t => {
    const http = await createHarness(); t.after(() => http.close()); const adapter = http.adapter;
    adapter.config.settingsConfig = { evcsCount: 2, evcsList: [A, B] };
    await adapter.syncSettingsConfigToStates();
    await adapter.setStateAsync(`${ch(1)}.userMode`, { val: 'boost', ack: true });
    await adapter.setStateAsync(`${ch(2)}.userMode`, { val: 'pv', ack: true });
    await synchronize(adapter, adapter.evcsList);
    adapter.config.settingsConfig = { evcsCount: 1, evcsList: [B] };
    await adapter.syncSettingsConfigToStates(); await synchronize(adapter, adapter.evcsList);
    const built = EmsEngine.prototype._buildChargingConfig.call({ adapter }).chargingCfg.wallboxes[0];
    assert.equal(built.key, 'lp1');
    const mode = (await adapter.getStateAsync(`${ch(1)}.userMode`)).val;
    const h = makeHarness({ userMode: mode, wallbox: built }); t.after(() => h.stop());
    const tick = await h.tick(); assert.equal(tick.effectiveMode, 'pv');
});

test('registry is bounded and administrator-only; ambiguous physical identities fail before binding', async () => {
    const f = fixture(); await synchronize(f.adapter, [A]);
    assert.equal(f.objects.get(CHARGING_IDENTITY_STATE).common.write, false);
    assert.equal(f.objects.get(CHARGING_IDENTITY_STATE).acl.state, 0x600);
    const encoded = f.read(CHARGING_IDENTITY_STATE);
    assert.equal(encoded.includes('test.A.set'), false, 'registry contains hashes, not endpoint strings');
    assert.throws(() => chargingPointLayout([A, A]), /AMBIGUOUS/);
    assert.throws(() => chargingPointLayout(Array.from({ length: 51 }, (_, index) => row(`p${index}`))), /LAYOUT_INVALID/);
    assert.deepEqual(snapshot(f.adapter, [B]), { revision: '', slots: {} });
});


test('raw and normalized legacy connector/default mirror forms describe the same point', () => {
    assert.deepEqual(chargingPointLayout([A]), chargingPointLayout([{ ...A, connectorNo: 0, modeId: 'eos-admin.0.evcs.1.mode' }]));
    assert.deepEqual(chargingPointLayout([A], undefined, 'eos-admin.3'), chargingPointLayout([{ ...A, connectorNo: 0, modeId: 'eos-admin.3.evcs.1.mode' }], undefined, 'eos-admin.3'));
});

test('own default mirror travels with a verified point while deliberate cross-slot and external mappings remain unchanged', () => {
    const oldA = { ...A, modeId: 'eos-admin.3.evcs.1.mode' }, oldB = { ...B, modeId: 'eos-admin.3.evcs.2.mode' };
    const moved = remapChargingPointDefaultModes([oldA, oldB], [oldB], 'eos-admin.3');
    assert.equal(moved[0].modeId, 'eos-admin.3.evcs.1.mode');
    assert.equal(oldB.modeId, 'eos-admin.3.evcs.2.mode', 'input is not mutated');
    for (const modeId of ['eos-admin.3.evcs.1.mode', 'eos-admin.0.evcs.2.mode', 'test.B.mode']) {
        const custom = { ...B, modeId };
        const desired = [custom];
        assert.equal(remapChargingPointDefaultModes([oldA, custom], desired, 'eos-admin.3'), desired);
    }
});

test('cross-slot and foreign-instance mode targets rotate tokens; only the exact own default mirror is implicit', async () => {
    for (const modeId of ['eos-admin.0.evcs.2.mode', 'eos-admin.7.evcs.1.mode']) {
        const f = fixture();
        await synchronize(f.adapter, [{ ...A, modeId: 'eos-admin.0.evcs.1.mode' }]);
        const old = snapshot(f.adapter);
        await synchronize(f.adapter, [{ ...A, modeId }]);
        assert.notEqual(snapshot(f.adapter).slots.lp1, old.slots.lp1);
        assert.throws(() => admit(f.adapter, 'lp1', { expectedChargingIdentity: old.slots.lp1 }), /IDENTITY_CHANGED/);
    }
});

test('an explicitly bound custom command bridge is compatible while missing or changed destinations fail closed', async () => {
    const f = fixture(), external = { name: 'Extern', enabled: true };
    f.adapter.config = { chargeKiosk: { stations: [{ id: 'outside', assignmentMode: 'manual', assignedChargepoints: ['lp1'],
        controlProfile: 'commandState', commandStateId: 'fixture.command.{lp}', writeChargingManagementMirror: false }] } };
    await synchronize(f.adapter, [external]); const old = snapshot(f.adapter);
    assert.ok(old.slots.lp1); admit(f.adapter, 'lp1', {});
    assert.deepEqual(snapshot(f.adapter, [{ ...external, connectorNo: 0, modeId: 'eos-admin.0.evcs.1.mode' }]), old);
    f.adapter.config.chargeKiosk.stations[0].commandStateId = 'fixture.other.{lp}';
    assert.deepEqual(snapshot(f.adapter, [external]), { revision: '', slots: {} });
    await synchronize(f.adapter, [external]);
    assert.throws(() => admit(f.adapter, 'lp1', { expectedChargingIdentity: old.slots.lp1 }), /IDENTITY_CHANGED/);
    admit(f.adapter, 'lp1', { expectedChargingIdentity: snapshot(f.adapter).slots.lp1 });
    const unbound = fixture(); await synchronize(unbound.adapter, [external]);
    assert.throws(() => admit(unbound.adapter, 'lp1', {}), /IDENTITY_CHANGED/);
});

test('failed config persistence after a confirmed drain keeps controls fenced and permits a safe retry', async t => {
    const h = await createHarness(); t.after(() => h.close()); const a = h.adapter;
    a.persistInstallerConfigToState = Object.getPrototypeOf(a).persistInstallerConfigToState.bind(a);
    a.config.settingsConfig = { evcsCount: 2, evcsList: [A, B] };
    await a.syncSettingsConfigToStates();
    await synchronize(a, a.evcsList);
    let stops = 0;
    a.emsEngine = { async stopForReconfigure() { stops++; } };
    const next = { ...a.config, settingsConfig: { evcsCount: 1, evcsList: [B] } };
    assert.equal(await a._nwPrepareChargingPointReconfigure(next, true), true);
    assert.equal(stops, 1); assert.equal(a.emsEngine, null);
    const original = a.setStateAsync.bind(a);
    a.setStateAsync = async (id, ...rest) => { if (id === 'installer.configJson') throw new Error('fixture-config-store-down'); return original(id, ...rest); };
    assert.equal(await a.persistInstallerConfigToState({ settingsConfig: next.settingsConfig }), false);
    assert.equal(a._nwEvcsIdentityTransitionPending, true);
    assert.throws(() => admit(a, 'lp1', {}), /IDENTITY_CHANGED/);
    assert.equal(a.config.settingsConfig.evcsList.length, 2);
    a.setStateAsync = original;
    assert.equal(await a._nwPrepareChargingPointReconfigure(a.config, false), true, 'saving the unchanged old config after a failed commit still requires a restart');
    assert.equal(a._nwEvcsIdentityTransitionPending, true);
    await a._nwPrepareChargingPointReconfigure(next, true);
    assert.equal(await a.persistInstallerConfigToState({ settingsConfig: next.settingsConfig }), true);
    a.config = next; await a.syncSettingsConfigToStates(); await synchronize(a, a.evcsList);
    assert.equal(a._nwEvcsIdentityTransitionPending, false);
    assert.equal(stops, 1, 'the already drained engine is not stopped again');
});
