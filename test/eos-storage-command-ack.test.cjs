'use strict';
// Actual farm write helper and storage controller; the state/driver boundary is
// controlled. DP acknowledgment does not simulate measured battery response.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const { SpeicherRegelungModule } = require('../ui/ems/modules/storage-control');
async function farm(t) {
    const h = await createHarness();
    t.after(async () => { await new Promise(resolve => h.adapter.onUnload(resolve)); await h.close(); });
    const writes = []; const write = h.owner.setForeignStateAsync;
    h.owner.setForeignStateAsync = async (...args) => { writes.push(args); return write(...args); };
    return { ...h, writes };
}
test('farm own ack:false echo stays pending and idempotent; later ack only confirms the driver', async t => {
    const h = await farm(t); const id = 'alias.0.storage.command';
    const first = await h.adapter._sfWriteIfChanged(id, 681);
    assert.equal(first.ok, true); assert.equal(first.readbackOk, false);
    assert.equal(first.pending, true); assert.equal(first.readback.status, 'pending-ack');
    assert.equal(first.readback.attempts, 1); assert.equal(first.confirmationLevel, 'requested');
    const second = await h.adapter._sfWriteIfChanged(id, 681);
    assert.equal(second.skipped, true); assert.equal(second.readbackOk, false); assert.equal(h.writes.length, 1);
    h.states.set(id, { val: 681, ack: true, q: 0, ts: Date.now() });
    const acknowledged = await h.adapter._sfWriteIfChanged(id, 681);
    assert.equal(acknowledged.skipped, true); assert.equal(acknowledged.readbackOk, true);
    assert.equal(acknowledged.confirmationLevel, 'driver-acknowledged'); assert.equal(h.writes.length, 1);
});
test('farm delayed acknowledgment cannot confirm a newer request; invalid quality remains a failure', async t => {
    const h = await farm(t); const id = 'alias.0.storage.command';
    await h.adapter._sfWriteIfChanged(id, 681);
    const since = h.adapter._sfLastSetpointsTs.get(id);
    h.states.set(id, { val: 681, ack: true, ts: since - 1 });
    const old = await h.adapter._sfWriteIfChanged(id, 681);
    assert.equal(old.pending, true); assert.equal(old.readbackOk, false); assert.equal(h.writes.length, 1);
    h.states.set(id, { val: 681, ack: true, ts: Date.now(), q: 0x40 });
    const invalid = await h.adapter._sfReadbackNumber(id, 681, { attempts: 1 });
    assert.equal(invalid.ok, false); assert.equal(invalid.pending, false); assert.equal(invalid.status, 'quality-invalid');
});
test('farm missing/null/blank/boolean values never confirm a zero command', async t => {
    const h = await farm(t); const id = 'alias.0.storage.command';
    for (const val of [null, undefined, '', false]) {
        h.states.set(id, { val, ack: true, ts: Date.now() });
        const result = await h.adapter._sfReadbackNumber(id, 0, { attempts: 1 });
        assert.equal(result.ok, false); assert.equal(result.pending, false);
    }
});
test('farm real mismatch, write failure and authority revocation are not pending successes', async t => {
    const h = await farm(t); const id = 'alias.0.storage.command';
    h.owner.setForeignStateAsync = async () => {};
    h.states.set(id, { val: 20, ack: true, ts: Date.now() });
    const mismatch = await h.adapter._sfWriteIfChanged(id, 681);
    assert.equal(mismatch.ok, false); assert.equal(mismatch.reason, 'command_dp_mismatch');
    h.owner.setForeignStateAsync = async () => { throw new Error('driver rejected'); };
    assert.equal((await h.adapter._sfWriteIfChanged(id, 681)).ok, false);
    h.owner.setForeignStateAsync = async () => ({ __nexowattActuatorAuthorityBlocked: true, blockedByOwner: 'fixture-revoked' });
    const denied = await h.adapter._sfWriteIfChanged(id, 681);
    assert.equal(denied.ok, false); assert.equal(denied.blocked, true);
    assert.equal(h.adapter._sfLastSetpoints.has(id), false);
});
function single() {
    const internal = new Map(), foreign = new Map(), writes = [], entries = new Map();
    for (const [key, id] of [['st.targetPowerW', 'signed'], ['st.targetChargePowerW', 'charge'], ['st.targetDischargePowerW', 'discharge'], ['st.run', 'run']]) {
        entries.set(key, { objectId: id, scale: 1, offset: 0, unitScale: 1, invert: false });
        foreign.set(id, { val: id === 'run' ? false : 0, ack: true, ts: Date.now() });
    }
    const adapter = { config: { enableStorageControl: true, enableStorageFarm: false,
        emsApps: { apps: { storagefarm: { installed: false, enabled: false } } }, storageFarm: { storages: [] },
        storage: { controlMode: 'targetPower', reserveMinSocPct: 10 } }, log: { warn() {}, info() {}, debug() {}, error() {} },
        getStateAsync: async id => internal.get(id) || null,
        setStateAsync: async (id, state) => internal.set(id, { ...(typeof state === 'object' ? state : { val: state }), ack: true, ts: Date.now() }),
        setObjectNotExistsAsync: async () => {}, getForeignStateAsync: async id => foreign.get(id) || null };
    let reject = false, swallow = '';
    const dp = { getEntry: key => entries.get(key) || null, getRaw: key => foreign.get(entries.get(key)?.objectId)?.val,
        lastWriteByObjectId: new Map() };
    const write = async (key, value) => {
        const entry = entries.get(key); if (!entry || reject) return false;
        const id = entry.objectId; const cached = dp.lastWriteByObjectId.get(id);
        if (cached && cached.val === value && Date.now() - cached.ts < 900) return null;
        writes.push({ id, val: value });
        if (id !== swallow) foreign.set(id, { val: value, ack: false, ts: Date.now() });
        dp.lastWriteByObjectId.set(id, { val: value, ts: Date.now() }); return true;
    };
    dp.writeNumber = write; dp.writeBoolean = write;
    return { adapter, dp, controller: new SpeicherRegelungModule(adapter, dp), internal, foreign, writes, entries,
        reject: () => { reject = true; }, swallow: id => { swallow = id; }, value: id => internal.get(id)?.val };
}
test('actual single-storage command path keeps run enabled while matching command acknowledgments are pending', async () => {
    const h = single(); await h.controller._applyTargetW(681, 'ack fixture', 'eigenverbrauch');
    assert.equal(h.value('speicher.regelung.commandDpReadbackOk'), false);
    assert.equal(h.value('speicher.regelung.commandDpReadbackStatus'), 'pending-ack');
    assert.equal(h.value('speicher.regelung.acceptedSollW'), 681);
    assert.equal(h.value('speicher.regelung.schreibOk'), true);
    assert.equal(h.foreign.get('run').val, true); assert.ok(!h.writes.some(row => row.id === 'run' && row.val === false));
    const diag = JSON.parse(h.value('speicher.regelung.commandDpReadbackJson'));
    assert.equal(diag.readback.pending, true); assert.equal(diag.readback.attempts, 1);
    assert.equal(diag.readback.confirmationLevel, 'requested');
    const before = h.writes.length;
    await h.controller._writeStorageCommandNumber('st.targetDischargePowerW', 681);
    assert.equal(h.writes.length, before, 'pending did not clear the idempotency cache');
});
test('single-storage real mismatch still clears run; pending cannot hide a rejected primary write', async () => {
    const h = single(); h.swallow('discharge');
    await h.controller._applyTargetW(681, 'mismatch fixture', 'eigenverbrauch');
    assert.equal(h.value('speicher.regelung.schreibOk'), false);
    assert.equal(h.value('speicher.regelung.acceptedSollW'), 0);
    assert.equal(h.foreign.get('run').val, false);
    const denied = single(); denied.reject();
    await denied.controller._applyTargetW(681, 'revoked fixture', 'eigenverbrauch');
    assert.equal(denied.value('speicher.regelung.schreibOk'), false); assert.equal(denied.writes.length, 0);
});
test('single-storage actual ack is driver-only and late/invalid acknowledgment is not confirmed', async () => {
    const h = single(); const entry = h.entries.get('st.targetPowerW');
    await h.controller._writeStorageCommandNumber('st.targetPowerW', 681);
    const expectation = [{ key: 'st.targetPowerW', entry, value: 681, type: 'number' }];
    const since = h.controller._storageCommandRequests.get('st.targetPowerW').ts;
    h.foreign.set('signed', { val: 681, ack: true, ts: since - 1 });
    let result = await h.controller._verifyStorageCommandDatapoints(expectation);
    assert.equal(result.pending, true); assert.equal(result.ok, false);
    h.foreign.set('signed', { val: 681, ack: true, ts: Date.now(), q: 0 });
    result = await h.controller._verifyStorageCommandDatapoints(expectation);
    assert.equal(result.ok, true); assert.equal(result.confirmationLevel, 'driver-acknowledged');
    h.foreign.get('signed').q = 0x40;
    result = await h.controller._verifyStorageCommandDatapoints(expectation, { attempts: 1 });
    assert.equal(result.ok, false); assert.equal(result.pending, false); assert.equal(result.rows[0].reason, 'quality-invalid');
});


test('farm keepalive renews a pending request without inventing confirmation or writing zero', async t => {
    const h = await farm(t); let now = Date.now(); t.mock.method(Date, 'now', () => now);
    const id = 'alias.0.storage.command'; await h.adapter._sfWriteIfChanged(id, 681);
    now += 901; const renewal = await h.adapter._sfWriteIfChanged(id, 681);
    assert.equal(renewal.ok, true); assert.equal(renewal.keepalive, true); assert.equal(renewal.pending, true);
    assert.equal(renewal.readbackOk, false); assert.equal(h.writes.length, 2);
    assert.ok(h.writes.every(row => row[1] === 681));
});
test('pending neutralization reports requested and retains the native FEMS watchdog handoff', async () => {
    const h = single();
    h.foreign.set('signed', { val: 200, ack: true, ts: Date.now() });
    const release = await h.controller._releaseDirectStorageTargetForFenecon('fixture');
    assert.equal(release.ok, true); assert.equal(release.pending, true); assert.equal(release.status, 'neutral-requested');
    assert.match(h.value('speicher.regelung.feneconGridReleaseStatus'), /angefordert.*ausstehend/);
    const entry = { objectId: 'gridTarget', scale: 1, offset: 0, unitScale: 1, invert: false };
    h.entries.set('st.feneconGridSetpointW', entry);
    const result = await h.controller._applyFeneconGridSetpointW(50, 'fixture', 'eigenverbrauch');
    assert.equal(result.ok, true); assert.equal(result.status, 'pending-ack');
    assert.equal(result.verify.ok, false); assert.equal(result.verify.pending, true);
    assert.ok(h.controller._feneconGridLastWriteMs > 0);
});

test('actual farm diagnostic projection preserves missing command readback as null instead of zero', async t => {
    const h = await farm(t), a = h.adapter;
    a.config = structuredClone(require('../ui/io-package.json').native);
    await a.migrateNativeConfig(); await a.loadInstallerConfigFromState();
    a.config.emsApps.apps.storagefarm = { installed: true, enabled: true }; a.config.enableStorageFarm = true;
    a.config.storageFarm = { enabled: true, mode: 'pool', storages: [
        { enabled: true, name: 'writer', socId: 'farm.writer.soc', signedPowerId: 'farm.writer.actual',
            setSignedPowerId: 'farm.writer.set', capacityKWh: 10, maxDischargeW: 5000, maxChargeW: 5000 },
        { enabled: true, name: 'monitor', socId: 'farm.monitor.soc', signedPowerId: 'farm.monitor.actual', capacityKWh: 10 },
    ] };
    for (const [id, val] of [['farm.writer.soc', 98], ['farm.writer.actual', 31], ['farm.writer.set', 0], ['farm.monitor.soc', 1], ['farm.monitor.actual', 0]]) {
        h.states.set(id, { val, ack: true, ts: Date.now() });
        h.objects.set(id, { type: 'state', common: { type: 'number', unit: id.endsWith('.soc') ? '%' : 'W', read: true, write: id.endsWith('.set') }, native: {} });
    }
    await a.ensureStorageFarmStates(); await a.updateStorageFarmDerived('missing-ack-projection');
    const original = h.owner.setForeignStateAsync;
    h.owner.setForeignStateAsync = async (id, value, ack) => {
        if (id === 'farm.writer.set') return h.states.set(id, { val: null, ack: true, ts: Date.now() });
        return original(id, value, ack);
    };
    const result = await a.applyStorageFarmTargetW(681, { source: 'eigenverbrauch' });
    const projected = result.commandDpReadbackRows.find(row => row.objectId === 'farm.writer.set');
    assert.equal(projected.actual, null); assert.equal(projected.ok, false);
    assert.equal(projected.status, 'value-missing'); assert.equal(result.writeOk, false);
    const diag = JSON.parse(h.states.get('eos-admin.0.storageFarm.lastDispatchJson').val);
    assert.equal(diag.commandDpReadbackRows.find(row => row.objectId === 'farm.writer.set').actual, null);
});
