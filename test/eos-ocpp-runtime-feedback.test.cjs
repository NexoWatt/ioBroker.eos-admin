/* Actual CM allocation and final writer with simulated ioBroker source states.
 * Only telemetry, storage and transport are fixtures; no physical charger is asserted. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeHarness } = require('../ui/scripts/verify-rc60-universal-auto-wallbox');
const { makeBudgetRuntime } = require('../ui/ems/modules/core-limits');
const { buildPvSurplusAllocation } = require('../ui/ems/services/pv-surplus-allocation');
const station = 'ocpp21.0.CP_01';
const sid = '11111111-2222-4333-8444-555555555555';
const wallbox = {
    chargerType: 'AC', controlBasis: 'powerW', phases: 3, phaseMode: 'fixed-3p', minPowerW: 4200,
    actualPowerWId: `${station}.measurements.powerW`, statusId: `${station}.info.status`,
    chargingStateId: `${station}.transactions.chargingState`, transactionActiveId: `${station}.transactions.transactionActive`,
    vehicleConnectedId: '', chargeDemandId: '', onlineId: `${station}.info.socketConnected`,
    dataFreshId: `${station}.health.dataFresh`, heartbeatId: `${station}.health.lastSeenMs`,
    setCurrentAId: '', setPowerWId: `${station}.control.chargeLimit`, enableId: `${station}.control.availability`,
    telemetryProfile: 'ocpp-1.6-event-driven',
};
function fixture(t, options = {}) {
    const nativeStation = options.station || station;
    const mappedWallbox = Object.fromEntries(Object.entries(wallbox).map(([key, value]) => [key, typeof value === 'string' ? value.replace(station, nativeStation) : value]));
    const h = makeHarness({ userMode: 'pv', wallbox: mappedWallbox, status: 'Charging', chargingState: 'Charging',
        transactionActive: true, actualPowerW: 5700, gridAllowed: true, ...options });
    for (const key of ['_publishChargingAllocationTsShadow', '_publishChargingPhaseSelectionRuntimeStates',
        '_publishChargingStationDiagnosticsFromAllocationPlan']) delete h.module[key];
    const availableW = options.totalBudgetW || 11000;
    h.refreshBudget = () => {
        h.adapter._nvpFreshnessSnapshot = { ...h.adapter._nvpFreshnessSnapshot, ts: Date.now(), netW: 5700 - availableW,
            measurementAgeMs: 0, heartbeatAgeMs: 0 };
        h.adapter._emsBudget = makeBudgetRuntime(h.adapter, { ts: Date.now(), raw: {}, gates: {
            total: { effectiveW: availableW }, pv: { rawW: availableW, effectiveW: availableW },
            pvAllocation: buildPvSurplusAllocation(availableW, 'emobility', 100, { storageEligible: false }),
        } });
    };
    h.refreshBudget();
    h.station = nativeStation; h.adapter.hostNamespace = 'eos-admin.0';
    // The old harness only stores values. Add the actual Datapoints metadata
    // shape without treating receive time as a known original source timestamp.
    const rawStates = new Map(); const originalRead = h.adapter.getForeignStateAsync.bind(h.adapter);
    h.adapter.getForeignStateAsync = async id => rawStates.has(id) ? rawStates.get(id) : originalRead(id);
    h.dp.cacheByObjectId = new Map();
    const originalUpsert = h.dp.upsert.bind(h.dp);
    h.dp.upsert = async entry => {
        const result = await originalUpsert(entry);
        if (entry.direction === 'in') {
            const state = await h.adapter.getForeignStateAsync(entry.srcObjectId || entry.objectId);
            const id = entry.srcObjectId || entry.objectId;
            if (state) {
                const sourceTs = Number(state.ts);
                h.dp.cacheByObjectId.set(id, { val: state.val, ack: state.ack === true, q: state.q,
                    sourceTs: Number.isFinite(sourceTs) && sourceTs > 0 ? sourceTs : 0,
                    ts: Number.isFinite(sourceTs) && sourceTs > 0 ? sourceTs : Date.now(), lc: state.lc, receivedTs: Date.now() });
            } else h.dp.cacheByObjectId.delete(id);
        }
        return result;
    };
    h.source = (id, value, ts = Date.now(), metadata = {}) => {
        h.setObject(id, value, ts);
        rawStates.set(id, { val: value, ts, lc: ts, ack: true, q: 0, ...metadata });
    };
    h.diagnostic = (name, key = 'lp1') => h.localStates.get(`chargingManagement.wallboxes.${key}.${name}`);
    h.source('system.adapter.ocpp21.0.alive', true);
    h.source(`${nativeStation}.info.socketConnected`, true);
    if (nativeStation.startsWith('eos-admin.')) {
        h.source('eos-admin.0.ocpp.info.eosHostedRuntime', true);
        h.source('eos-admin.0.ocpp.info.runtimeAlive', true);
    }
    t.after(() => h.stop());
    return h;
}
function atomic(h, patch = {}, metadata = {}) {
    const station = h.station;
    const now = Date.now();
    h.source(`${station}.info.eosControlLeaseSupported`, true, now - 10000);
    h.source(`${station}.info.sessionId`, sid, now - 10000);
    h.source(`${station}.control.chargeLimitStatus`, JSON.stringify({ schema: 1, valid: true, sessionId: sid,
        requestedW: 11000, appliedW: 10929.6, appliedAtMs: now - 2000, updatedAtMs: now - 1000,
        reason: 'watt-to-ampere-conservative', error: '', ...patch }), now - 1000, metadata);
    // Older individually published values intentionally look successful. They
    // must never override an atomic pending/rejected or mismatched-session result.
    h.source(`${station}.control.requestedChargeLimit`, 11000, now - 1000);
    h.source(`${station}.control.appliedChargeLimit`, 14.4, now - 1000);
    h.source(`${station}.control.appliedChargeLimitUnit`, 'A', now - 1000);
    h.source(`${station}.control.lastCommand`, 'SetChargingProfile', now - 1000);
    h.source(`${station}.control.lastCommandAt`, new Date(now - 2000).toISOString(), now - 1000);
    h.source(`${station}.control.lastSuccess`, true, now - 1000);
    h.source(`${station}.control.lastError`, '', now - 1000);
}

test('real CM reads atomic 0.4.3 feedback through source-metadata cache and writes native watts only', async t => {
    const h = fixture(t); atomic(h);
    const out = await h.tick();
    assert.ok(out.targetPowerW >= 4200 && out.targetPowerW <= 11000, JSON.stringify(out));
    assert.equal(h.diagnostic('ocppAppliedChargeLimitW'), 10929.6, '14.4 wire amperes must not be presented as applied watts');
    assert.equal(h.diagnostic('ocppAppliedChargeLimitValid'), true);
    assert.equal(h.diagnostic('ocppFeedbackState'), 'confirmed:atomic');
    const positive = h.writes.filter(write => /\.setW$/.test(write.key) && write.value > 0);
    assert.ok(positive.length >= 1);
    assert.ok(positive.every(write => h.dp.getEntry(write.key).objectId === `${station}.control.chargeLimit` && write.value >= 4200));
    assert.equal(h.writes.some(write => /\.setA$/.test(write.key)), false);
    const leaseIndex = h.writes.findIndex(write => write.key === 'cm.wb.lp1.ocppLeaseUntil');
    assert.ok(leaseIndex >= 0 && leaseIndex < h.writes.findIndex(write => /\.setW$/.test(write.key) && write.value > 0));
    assert.equal(h.dp.getEntry('cm.wb.lp1.ocppLeaseUntil').objectId, `${station}.control.eosLeaseUntilMs`);
    assert.ok(h.writes[leaseIndex].value - h.writes[leaseIndex].ts >= 14900 && h.writes[leaseIndex].value - h.writes[leaseIndex].ts <= 15000);
    assert.equal(h.diagnostic('ocppControlLeaseReady'), true);
});

test('real CM atomic pending/rejected feedback cannot be confirmed by old command-success fields', async t => {
    for (const error of ['pending', 'rejected']) {
        const h = fixture(t); atomic(h, { valid: false, error });
        await h.tick();
        assert.equal(h.diagnostic('ocppAppliedChargeLimitW'), null);
        assert.equal(h.diagnostic('ocppAppliedChargeLimitValid'), false);
        assert.equal(h.diagnostic('hardwareCommandConfirmed'), false);
        assert.equal(h.diagnostic('ocppFeedbackState'), error);
    }
});

test('real CM rejects old-session, stale, bad quality and missing-source-timestamp feedback', async t => {
    for (const kind of ['reconnect', 'stale', 'quality', 'unacknowledged', 'missing-ts']) {
        const h = fixture(t); atomic(h);
        if (kind === 'reconnect') h.source(`${station}.info.sessionId`, 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', Date.now() - 500);
        const snapshot = await h.adapter.getForeignStateAsync(`${station}.control.chargeLimitStatus`);
        if (kind === 'stale') h.source(`${station}.control.chargeLimitStatus`, snapshot.val, Date.now() - 120001);
        if (kind === 'quality') h.source(`${station}.control.chargeLimitStatus`, snapshot.val, snapshot.ts, { q: 64 });
        if (kind === 'unacknowledged') h.source(`${station}.control.chargeLimitStatus`, snapshot.val, snapshot.ts, { ack: false });
        if (kind === 'missing-ts') h.source(`${station}.control.chargeLimitStatus`, snapshot.val, snapshot.ts, { ts: undefined });
        await h.tick();
        assert.equal(h.diagnostic('ocppAppliedChargeLimitValid'), false, kind);
        assert.equal(h.diagnostic('ocppAppliedChargeLimitW'), null, kind);
        assert.equal(h.diagnostic('hardwareCommandConfirmed'), false, kind);
        if (kind === 'missing-ts') assert.equal(h.dp.cacheByObjectId.get(`${station}.control.chargeLimitStatus`).sourceTs, 0);
    }
});

test('real CM treats valid zero as a confirmed requested profile and keeps measured charging power separate', async t => {
    const h = fixture(t, { userMode: 'off' }); atomic(h, { requestedW: 0, appliedW: 0 });
    const out = await h.tick();
    assert.equal(out.targetPowerW, 0); assert.equal(out.actualPowerW, 5700);
    assert.equal(h.diagnostic('ocppAppliedChargeLimitW'), 0);
    assert.equal(h.diagnostic('ocppAppliedChargeLimitValid'), true);
    assert.equal(h.diagnostic('hardwareCommandConfirmed'), true, 'profile response is confirmed; physical power remains independent telemetry');
    assert.equal(h.writes.some(write => /\.setW$/.test(write.key) && write.value > 0), false);
});

test('duplicate native station rows cannot send positive limits or race the single conservative zero writer', async t => {
    const h = fixture(t); atomic(h);
    h.adapter.config.chargingManagement.wallboxes.push({ ...h.wallbox, key: 'lp2', evcsIndex: 2 });
    h.adapter.config.settingsConfig.evcsCount = 2;
    for (const key of ['lp1', 'lp2']) h.setLocal(`chargingManagement.wallboxes.${key}.userMode`, 'pv');
    await h.tick();
    assert.equal(h.diagnostic('ocppControlConflict'), true); assert.equal(h.diagnostic('ocppControlConflict', 'lp2'), true);
    assert.equal(h.diagnostic('mappingOk'), false); assert.equal(h.diagnostic('mappingOk', 'lp2'), false);
    const limits = h.writes.filter(write => /\.set[WA]$/.test(write.key));
    assert.ok(limits.length > 0, JSON.stringify(h.writes));
    assert.ok(limits.every(write => write.value === 0));
    assert.deepEqual([...new Set(limits.map(write => write.key))], ['cm.wb.lp1.setW']);
    assert.equal(h.writes.some(write => write.key.startsWith('cm.wb.lp2.')), false, 'duplicate row never competes with the designated stop owner');
    assert.equal(h.writes.some(write => write.key.endsWith('.ocppLeaseUntil')), false, 'conflicting station is not given a renewed positive-control lease');
});

test('incomplete native commissioning contract blocks positive power at the actual CM writer', async t => {
    const h = fixture(t, { wallbox: { ...wallbox, ocppDiscovery: { source: 'nexowatt-ocpp21', stationRoot: station, code: 'CONTRACT_INCOMPLETE' } } });
    atomic(h); const out = await h.tick();
    assert.equal(out.targetPowerW, 0); assert.equal(h.diagnostic('mappingOk'), false);
    assert.match(h.diagnostic('mappingIssues'), /ocpp_station_contract_incomplete/);
    assert.equal(h.writes.some(write => /\.set[WA]$/.test(write.key) && write.value > 0), false);
});

test('two independently controlled legacy OCPP connectors are not mistaken for a native station aggregate', async t => {
    const legacy = connector => ({ ...wallbox, key: `lp${connector}`, evcsIndex: connector,
        actualPowerWId: `ocpp.0.Legacy.${connector}.power`, statusId: `ocpp.0.Legacy.${connector}.status`,
        chargingStateId: '', transactionActiveId: `ocpp.0.Legacy.${connector}.transactionActive`,
        onlineId: 'ocpp.0.Legacy.connected', dataFreshId: '', heartbeatId: '',
        setPowerWId: `ocpp.0.Legacy.${connector}.setPower`, enableId: `ocpp.0.Legacy.${connector}.enabled`, connectorNo: connector });
    const h = fixture(t, { wallbox: legacy(1), totalBudgetW: 22000 });
    h.adapter.config.chargingManagement.wallboxes.push(legacy(2)); h.adapter.config.settingsConfig.evcsCount = 2;
    h.source('system.adapter.ocpp.0.alive', true); h.source('ocpp.0.Legacy.connected', true);
    for (const i of [1, 2]) {
        h.source(`ocpp.0.Legacy.${i}.power`, 5700); h.source(`ocpp.0.Legacy.${i}.status`, 'Charging');
        h.source(`ocpp.0.Legacy.${i}.transactionActive`, true); h.setLocal(`chargingManagement.wallboxes.lp${i}.userMode`, 'pv');
    }
    await h.tick();
    for (const key of ['lp1', 'lp2']) {
        assert.equal(h.diagnostic('ocppControlConflict', key), false, key);
        assert.equal(h.diagnostic('ocppFeedbackState', key), 'legacy', key);
        assert.equal(h.diagnostic('mappingOk', key), true, key);
        assert.ok(h.writes.some(write => write.key === `cm.wb.${key}.setW`), `${key} retains its independent actuator: ${JSON.stringify(h.writes)}`);
    }
    assert.equal([...h.dp.entries.values()].some(entry => entry.objectId.startsWith('ocpp.0.Legacy.control.')), false);
    assert.equal(h.writes.some(write => write.key.endsWith('.ocppLeaseUntil')), false, 'legacy connector control has no native process lease');
});

test('native lease write failure or rejection blocks positive power in the real CM final writer', async t => {
    for (const mode of ['false', 'reject']) {
        const h = fixture(t); atomic(h); const originalWrite = h.dp.writeNumber.bind(h.dp); let attempts = 0;
        h.dp.writeNumber = async (key, value) => {
            if (key.endsWith('.ocppLeaseUntil')) {
                attempts++; if (mode === 'reject') throw new Error('SIMULATED_LEASE_TRANSPORT_FAILURE'); return false;
            }
            return originalWrite(key, value);
        };
        const out = await h.tick();
        assert.ok(attempts >= 1, mode); assert.equal(out.targetPowerW, 0, mode);
        assert.equal(h.diagnostic('ocppControlLeaseReady'), false, mode);
        assert.equal(h.writes.some(write => /\.set[WA]$/.test(write.key) && write.value > 0), false, mode);
    }
});

test('native positive command awaits the lease transport promise, not just an attempted write', async t => {
    const h = fixture(t); atomic(h); const originalWrite = h.dp.writeNumber.bind(h.dp);
    let release; let attempted = false;
    const pending = new Promise(resolve => { release = resolve; });
    h.dp.writeNumber = async (key, value) => {
        if (key.endsWith('.ocppLeaseUntil')) { attempted = true; await pending; }
        return originalWrite(key, value);
    };
    const tick = h.tick();
    for (let i = 0; i < 100 && !attempted; i++) await new Promise(resolve => setImmediate(resolve));
    try {
        assert.equal(attempted, true); assert.equal(h.writes.some(write => /\.set[WA]$/.test(write.key) && write.value > 0), false);
    } finally { release(); }
    await tick;
    const leaseAt = h.writes.findIndex(write => write.key.endsWith('.ocppLeaseUntil'));
    const positiveAt = h.writes.findIndex(write => /\.setW$/.test(write.key) && write.value > 0);
    assert.ok(leaseAt >= 0 && positiveAt > leaseAt);
});

test('atomic native contract cannot bypass its lease using missing, false or invalid support metadata', async t => {
    for (const variant of ['missing', 'false', 'quality', 'timestamp']) {
        const h = fixture(t); atomic(h);
        if (variant === 'missing') h.source(`${station}.info.eosControlLeaseSupported`, null);
        if (variant === 'false') h.source(`${station}.info.eosControlLeaseSupported`, false);
        if (variant === 'quality') h.source(`${station}.info.eosControlLeaseSupported`, true, Date.now(), { q: 64 });
        if (variant === 'timestamp') h.source(`${station}.info.eosControlLeaseSupported`, true, Date.now(), { ts: undefined });
        const out = await h.tick();
        assert.equal(out.targetPowerW, 0, variant); assert.equal(h.diagnostic('ocppControlLeaseReady'), false, variant);
        assert.equal(h.writes.some(write => /\.set[WA]$/.test(write.key) && write.value > 0), false, variant);
    }
});

test('real CM renews its station lease after five seconds and immediately after an OCPP session change', async t => {
    let now = Date.now(); const originalNow = Date.now; Date.now = () => now; t.after(() => { Date.now = originalNow; });
    const h = fixture(t); atomic(h);
    const leases = () => h.writes.filter(write => write.key.endsWith('.ocppLeaseUntil'));
    await h.tick(); assert.equal(leases().length, 1);
    now += 2000; h.refreshBudget(); await h.tick(); assert.equal(leases().length, 1, 'no redundant renewal inside five seconds');
    now += 3000; h.refreshBudget(); await h.tick(); assert.equal(leases().length, 2, 'fresh controller cycle renews at five seconds');
    assert.equal(leases()[1].value, now + 15000);
    now += 1; h.source(`${station}.info.sessionId`, 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', now); h.refreshBudget();
    await h.tick(); assert.equal(leases().length, 3, 'old session renewal cache cannot authorise a new OCPP session');
    assert.equal(h.diagnostic('hardwareCommandConfirmed'), false, 'new lease alone never turns an old-session profile response into a confirmation');
});

for (const nativeStation of ['eos-admin.0.ocpp.CP_01', 'ocpp21.0.CP_01']) {
    test(`hosted runtime ${nativeStation} retains native watts, atomic feedback, zero and ordered leases`, async t => {
        const h = fixture(t, { station: nativeStation }); atomic(h);
        const namespace = nativeStation.slice(0, nativeStation.lastIndexOf('.'));
        h.source(`${namespace}.info.eosHostedRuntime`, true);
        h.source(`${namespace}.info.runtimeAlive`, true);
        h.source('system.adapter.ocpp21.0.alive', false); h.source('system.adapter.eos-admin.0.alive', false);
        const active = await h.tick(); assert.ok(active.targetPowerW > 0);
        assert.equal(h.diagnostic('ocppAdapterAliveSourceId'), `${namespace}.info.runtimeAlive`);
        assert.equal(h.diagnostic('ocppAppliedChargeLimitValid'), true);
        assert.equal(h.dp.getEntry('cm.wb.lp1.setW').objectId, `${nativeStation}.control.chargeLimit`);
        assert.equal(h.dp.getEntry('cm.wb.lp1.ocppLeaseUntil').objectId, `${nativeStation}.control.eosLeaseUntilMs`);
        const positive = h.writes.findIndex(w => w.key.endsWith('.setW') && w.value > 0);
        assert.ok(h.writes.findIndex(w => w.key.endsWith('.ocppLeaseUntil')) < positive);
        h.setLocal('chargingManagement.wallboxes.lp1.userMode', 'off');
        atomic(h, { requestedW: 0, appliedW: 0 }); h.refreshBudget(); const stopped = await h.tick();
        assert.equal(stopped.targetPowerW, 0); assert.equal(h.diagnostic('ocppAppliedChargeLimitW'), 0);
        assert.ok(h.writes.some(w => w.key.endsWith('.setW') && w.value === 0));
    });
}

test('live Admin parent never replaces missing, stale, future, bad-quality or unacknowledged OCPP worker heartbeat', async t => {
    for (const variant of ['false', 'missing', 'stale', 'future', 'quality', 'ack', 'timestamp']) {
        const h = fixture(t, { station: 'eos-admin.0.ocpp.CP_01' }); atomic(h);
        h.source('system.adapter.eos-admin.0.alive', true);
        const heartbeat = 'eos-admin.0.ocpp.info.runtimeAlive';
        if (variant === 'false') h.source(heartbeat, false);
        if (variant === 'missing') h.source(heartbeat, null);
        if (variant === 'stale') h.source(heartbeat, true, Date.now() - 16000);
        if (variant === 'future') h.source(heartbeat, true, Date.now() + 30000);
        if (variant === 'quality') h.source(heartbeat, true, Date.now(), { q: 64 });
        if (variant === 'ack') h.source(heartbeat, true, Date.now(), { ack: false });
        if (variant === 'timestamp') h.source(heartbeat, true, Date.now(), { ts: undefined });
        const out = await h.tick(); assert.equal(out.targetPowerW, 0, variant);
        assert.equal(h.diagnostic('ocppAppliedChargeLimitValid'), false, variant);
        assert.equal(h.writes.some(w => w.key.endsWith('.ocppLeaseUntil')), false, variant);
        assert.equal(h.writes.some(w => w.key.endsWith('.setW') && w.value > 0), false, variant);
    }
});

test('invalid migrated hosted marker cannot fall back to live legacy adapter', async t => {
    const h = fixture(t); atomic(h);
    h.source('ocpp21.0.info.eosHostedRuntime', true, Date.now(), { q: 64 });
    h.source('ocpp21.0.info.runtimeAlive', true);
    const out = await h.tick(); assert.equal(out.targetPowerW, 0);
    assert.equal(h.diagnostic('ocppAdapterAliveSourceId'), 'ocpp21.0.info.runtimeAlive');
    assert.equal(h.diagnostic('ocppAppliedChargeLimitValid'), false);
});

test('another EOS owner cannot become a reader or writer through manual native mapping', async t => {
    const h = fixture(t, { station: 'eos-admin.1.ocpp.CP_01' }); atomic(h);
    h.source('eos-admin.1.ocpp.info.runtimeAlive', true);
    await h.tick();
    assert.equal(h.diagnostic('mappingOk'), false);
    assert.match(h.diagnostic('mappingIssues'), /ocpp_host_namespace_mismatch/);
    assert.equal([...h.dp.entries.values()].some(entry => entry.objectId.startsWith('eos-admin.1.')), false);
    assert.equal(h.writes.some(w => w.key.startsWith('cm.wb.lp1.')), false);
});

test('hosted aggregate duplicates still have only one conservative zero writer and no lease', async t => {
    const h = fixture(t, { station: 'eos-admin.0.ocpp.CP_01' }); atomic(h);
    h.adapter.config.chargingManagement.wallboxes.push({ ...h.wallbox, key: 'lp2', evcsIndex: 2 });
    h.adapter.config.settingsConfig.evcsCount = 2;
    h.setLocal('chargingManagement.wallboxes.lp2.userMode', 'pv');
    await h.tick();
    assert.equal(h.diagnostic('ocppControlConflict'), true);
    const limits = h.writes.filter(w => /\.set[WA]$/.test(w.key));
    assert.ok(limits.length > 0); assert.ok(limits.every(w => w.value === 0 && w.key === 'cm.wb.lp1.setW'));
    assert.equal(h.writes.some(w => w.key.endsWith('.ocppLeaseUntil')), false);
});

test('hosted connection flags with invalid source metadata cannot authorize loading via fresh status or meter fallback', async t => {
    for (const metadata of [{ q: 64 }, { ack: false }, { ts: undefined }]) {
        const h = fixture(t, { station: 'eos-admin.0.ocpp.CP_01' }); atomic(h);
        h.source(`${h.station}.info.socketConnected`, true, Date.now(), metadata);
        const out = await h.tick(); assert.equal(out.targetPowerW, 0);
        assert.equal(h.diagnostic('ocppAppliedChargeLimitValid'), false);
        assert.equal(h.writes.some(w => w.key.endsWith('.ocppLeaseUntil')), false);
        assert.equal(h.writes.some(w => w.key.endsWith('.setW') && w.value > 0), false);
    }
});

test('manual mixed native stations cannot pair one station lease with another station actuator', async t => {
    const h = fixture(t, { station: 'eos-admin.0.ocpp.CP_01' }); atomic(h);
    h.adapter.config.chargingManagement.wallboxes[0].setPowerWId = 'eos-admin.0.ocpp.CP_02.control.chargeLimit';
    await h.tick();
    assert.equal(h.diagnostic('mappingOk'), false);
    assert.match(h.diagnostic('mappingIssues'), /ocpp_mixed_station_mapping/);
    assert.equal(h.writes.some(w => w.key.startsWith('cm.wb.lp1.')), false);
    assert.equal([...h.dp.entries.values()].some(entry => /^eos-admin\.0\.ocpp\./.test(entry.objectId)), false);
});

test('only an explicitly valid false migration marker restores external adapter liveness after confirmed rollback', async t => {
    for (const variant of ['confirmed', 'quality', 'ack', 'timestamp', 'future']) {
        const h = fixture(t); atomic(h);
        h.source('ocpp21.0.info.runtimeAlive', false);
        const metadata = variant === 'quality' ? { q: 64 } : variant === 'ack' ? { ack: false } : variant === 'timestamp' ? { ts: undefined } : {};
        h.source('ocpp21.0.info.eosHostedRuntime', false, Date.now() + (variant === 'future' ? 30000 : -86400000), metadata);
        const out = await h.tick();
        if (variant === 'confirmed') {
            assert.ok(out.targetPowerW > 0); assert.equal(h.diagnostic('ocppAdapterAliveSourceId'), 'system.adapter.ocpp21.0.alive');
        } else {
            assert.equal(out.targetPowerW, 0, variant); assert.equal(h.diagnostic('ocppAdapterAliveSourceId'), 'ocpp21.0.info.runtimeAlive', variant);
        }
    }
});

test('hosted OCPP never sends a first positive profile before lease capability arrives in the source cache', async t => {
    for (const nativeStation of ['eos-admin.0.ocpp.CP_01', 'ocpp21.0.CP_01']) {
        const h = fixture(t, { station: nativeStation }); atomic(h);
        const namespace = nativeStation.slice(0, nativeStation.lastIndexOf('.'));
        h.source(`${namespace}.info.eosHostedRuntime`, true);
        h.source(`${namespace}.info.runtimeAlive`, true);
        // Actual registration/cache interleaving: the worker, socket and session
        // are visible before both capability/atomic state reads have arrived.
        const absent = new Set([`${nativeStation}.info.eosControlLeaseSupported`, `${nativeStation}.control.chargeLimitStatus`]);
        const read = h.adapter.getForeignStateAsync.bind(h.adapter);
        h.adapter.getForeignStateAsync = async id => absent.has(id) ? null : read(id);
        const out = await h.tick();
        assert.equal(out.targetPowerW, 0, nativeStation);
        assert.equal(h.writes.some(write => write.key.endsWith('.setW') && write.value > 0), false, nativeStation);
        assert.equal(h.writes.some(write => write.key.endsWith('.ocppLeaseUntil')), false, 'missing capability cannot acknowledge a lease');
    }
});

test('external pre-lease OCPP retains its confirmed adapter path without inventing a hosted capability', async t => {
    const h = fixture(t); atomic(h);
    const absent = new Set([`${h.station}.info.eosControlLeaseSupported`, `${h.station}.control.chargeLimitStatus`, `${h.station}.info.sessionId`]);
    const read = h.adapter.getForeignStateAsync.bind(h.adapter);
    h.adapter.getForeignStateAsync = async id => absent.has(id) ? null : read(id);
    const out = await h.tick();
    assert.ok(out.targetPowerW > 0, 'external legacy station remains supported');
    assert.equal(h.diagnostic('ocppAdapterAliveSourceId'), 'system.adapter.ocpp21.0.alive');
    assert.equal(h.writes.some(write => write.key.endsWith('.ocppLeaseUntil')), false, 'old external contract is not sent a nonexistent lease datapoint');
});

test('generic telemetry selection cannot bypass the native hosted OCPP process and lease contract', async t => {
    for (const nativeStation of ['eos-admin.0.ocpp.CP_01', 'ocpp21.0.CP_01']) for (const profile of ['generic', 'polling', 'modbus', 'http', 'mqtt', 'udp']) for (const runtimeAlive of [true, false]) {
        const h = fixture(t, { station: nativeStation }); atomic(h);
        const namespace = nativeStation.slice(0, nativeStation.lastIndexOf('.'));
        h.adapter.config.chargingManagement.wallboxes[0].telemetryProfile = profile;
        h.source(`${namespace}.info.eosHostedRuntime`, true);
        h.source(`${namespace}.info.runtimeAlive`, runtimeAlive);
        const out = await h.tick();
        const positiveIndex = h.writes.findIndex(write => write.key.endsWith('.setW') && write.value > 0);
        const leaseIndex = h.writes.findIndex(write => write.key.endsWith('.ocppLeaseUntil'));
        if (runtimeAlive) {
            assert.ok(out.targetPowerW > 0, nativeStation);
            assert.ok(leaseIndex >= 0 && leaseIndex < positiveIndex, `${nativeStation}: native contract must write lease before positive power even with generic profile`);
        } else {
            assert.equal(out.targetPowerW, 0, nativeStation);
            assert.equal(positiveIndex, -1, nativeStation);
            assert.equal(leaseIndex, -1, 'stopped worker cannot receive a renewed lease');
        }
    }
});

test('PV-only uses verified storage and NVP through the central budget and the hosted OCPP writer', async t => {
    const { CoreLimitsModule } = require('../ui/ems/modules/core-limits');
    // Load the shipped class without starting a real adapter. Its meter methods
    // run unchanged against the fixture's physical input cache.
    const fs = require('node:fs');
    const path = require('node:path');
    const Module = require('node:module');
    const adapterFile = require.resolve('../ui/main.js');
    const implementation = new Module(adapterFile, module);
    implementation.filename = adapterFile;
    implementation.paths = Module._nodeModulePaths(path.dirname(adapterFile));
    implementation._compile(fs.readFileSync(adapterFile, 'utf8') + '\nmodule.exports = NexoWattVis;', adapterFile);
    const physical = implementation.exports.prototype;
    const cases = [
        { name: 'import despite wrong house zero', house: 0, watts: 0 },
        { name: 'charging measurement with ioBroker error', battery: -5200, quality: 64, watts: 0 },
        { name: 'charging measurement without source time', battery: -5200, age: null, watts: 0 },
        { name: 'charging measurement in future', battery: -5200, age: -60000, watts: 0 },
        { name: 'discharge 90 seconds old', pv: 6600, grid: 0, battery: 5200, age: 90000, watts: 0 },
        { name: 'fresh discharge excluded', pv: 6600, grid: 0, battery: 5200, watts: 0 },
        { name: 'live export despite erroneous house import', pv: 8500, grid: -7500, actual: 0, house: 10000, watts: 4200 },
        { name: 'live export with no house meter', pv: 8500, grid: -7500, actual: 0, watts: 4200 },
        { name: 'missing central budget', house: 0, budget: 'missing', watts: 0 },
        { name: 'stale central budget', pv: 8500, grid: -7500, actual: 0, budget: 'stale', watts: 0 },
        { name: 'invalid central budget power', pv: 8500, grid: -7500, actual: 0, budget: 'invalid', watts: 0 },
        { name: 'future central budget', pv: 8500, grid: -7500, actual: 0, budget: 'future', watts: 0 },
        { name: 'Boost respects connection limit', mode: 'boost', grid: 8500, limit: 6500, watts: 0 },
        { name: 'Boost respects §14a', mode: 'boost', pv: 0, grid: 8000, actual: 0, para14a: 4200, watts: 4200 },
        { name: 'Min+PV keeps grid minimum', mode: 'minpv', watts: 4200 },
    ];
    for (const row of cases) await t.test(row.name, async t => {
        const station = 'eos-admin.0.ocpp.CP_TEST';
        const ev = row.actual ?? 5700;
        const h = fixture(t, { station, userMode: row.mode ?? 'pv', actualPowerW: ev, gridImportPreferred: true, negativeActive: true });
        atomic(h);
        const a = h.adapter;
        const now = Date.now();
        const sample = value => ({ value, q: 0, ts: now });
        a.config.datapoints = { batteryPower: 'meter.battery.power' };
        a.config.enableStorageControl = true;
        a.config.installerConfig.gridConnectionPower = row.limit ?? 30000;
        a.stateCache = {
            'derived.core.pv.totalW': sample(row.pv ?? 6000),
            'chargingManagement.control.actualW': sample(ev),
            'chargingManagement.control.usedW': sample(ev),
            'chargingManagement.control.pvEvcsPhysicalPvManagedW': sample(ev),
            'settings.pvSurplusPriority': sample('emobility'),
            batteryPower: { value: row.battery ?? 0, ts: row.age === null ? undefined : now - (row.age ?? 0), q: row.quality ?? 0 },
        };
        a._nwRawValueCache = { batteryPower: a.stateCache.batteryPower };
        for (const key of ['_nwResolveBatteryFlowFromCache', '_nwGetRawNumberFromCache', '_nwIsBatterySignInverted', '_nwGetCacheAgeMs']) {
            a[key] = physical[key];
        }
        a._nvpFreshnessSnapshot = { ...a._nvpFreshnessSnapshot, ts: now, netW: row.grid ?? 4500 };
        if (row.house !== undefined) {
            a.stateCache['derived.core.building.loadTotalW'] = sample(row.house);
            h.setLocal('derived.core.building.loadTotalW', row.house, now);
        }
        if (row.para14a) a._para14a = { active: true, evcsTotalCapW: row.para14a, totalCapW: row.para14a };

        const core = new CoreLimitsModule(a, h.dp);
        await core.tick();
        if (row.quality || row.age !== undefined) {
            assert.equal(a._emsBudget.raw.pvBudgetPhysicalSource, 'storage-flow-unverified');
            assert.equal(a._emsBudget.gates.pv.effectiveW, 0);
        }
        if (row.budget === 'missing') delete a._emsBudget;
        if (row.budget === 'invalid') a._emsBudget.gates.pv.effectiveW = Infinity;
        if (row.budget === 'stale') a._emsBudget.ts = now - 120000;
        if (row.budget === 'future') a._emsBudget.ts = now + 120000;
        const out = await h.tick();
        assert.equal(out.targetPowerW, row.watts);
        const issued = h.writes.filter(write => write.key === 'cm.wb.lp1.setW');
        assert.equal(h.dp.getEntry('cm.wb.lp1.setW').objectId, station + '.control.chargeLimit');
        assert.deepEqual(issued.map(write => write.value), [row.watts]);
    });
});

test('running PV budget follows original EV meters through rising and falling load in consecutive core cycles', async t => {
    const { CoreLimitsModule } = require('../ui/ems/modules/core-limits');
    const { DatapointRegistry } = require('../ui/ems/datapoints');
    let clock = Date.now();
    t.mock.method(Date, 'now', () => clock);
    const adapter = {
        config: { chargingManagement: { pvChargeReserveW: 500 } }, stateCache: {},
        async getForeignStateAsync() { return null; }, async getForeignObjectAsync() { return null; },
        async subscribeForeignStatesAsync() {}, log: { warn() {}, error() {}, debug() {} },
    };
    const key = 'cm.wb.lp1.pW';
    const evId = 'eos-admin.0.ocpp.cp.measurements.powerW';
    const dp = new DatapointRegistry(adapter, []);
    await dp.upsert({ key, objectId: evId, direction: 'in', unit: 'W' });
    const core = new CoreLimitsModule(adapter, dp);
    const base = new Map([[key, { id: evId, baseW: 0 }]]);
    adapter._zeroExportEvcsMeters = { ts: clock, keys: [key], pvBaseByKey: base };
    let lastEvW = 0;
    for (const evW of [0, 4200, 6300, 0, 6300]) {
        clock += 5000;
        adapter._zeroExportEvcsMeters.ts = clock - 5000;
        const sample = value => ({ value, ts: clock, q: 0 });
        adapter.stateCache['derived.core.pv.totalW'] = sample(12000);
        adapter.stateCache['chargingManagement.control.pvEvcsPhysicalPvManagedW'] = sample(lastEvW);
        adapter._nvpFreshnessSnapshot = { ts: clock, usable: true, fresh: true, connected: true,
            netW: 1000 + evW - 12000, status: 'ok', measurementAgeMs: 0, heartbeatAgeMs: 0 };
        dp.handleStateChange(evId, { val: evW, ts: clock, ack: true, q: 0 });
        const budget = core._makeBudgetSnapshot(clock, {});
        assert.equal(budget.raw.evcsActualW, evW);
        assert.equal(budget.raw.evcsPvUsedW, evW);
        assert.equal(budget.gates.pv.effectiveW, 10500);
        lastEvW = evW;
    }
    base.set(key, { id: evId, baseW: 4200 });
    assert.equal(core._currentEvMeterPowers(clock, 15000).pvManagedW, 2100, 'Min+PV only contributes measured power above its minimum');
    base.clear();
    assert.equal(core._currentEvMeterPowers(clock, 15000).pvManagedW, 0, 'Boost does not become a PV source');
    base.set(key, { id: 'replaced.meter', baseW: 0 });
    assert.equal(core._currentEvMeterPowers(clock, 15000).pvManagedW, 0, 'a changed identity requires reclassification');
    base.set(key, { id: evId, baseW: 0 });
    const second = 'cm.wb.lp2.pW';
    await dp.upsert({ key: second, objectId: evId, direction: 'in', unit: 'W' });
    adapter._zeroExportEvcsMeters.keys.push(second);
    assert.deepEqual(core._currentEvMeterPowers(clock, 15000), { actualW: 6300, pvManagedW: 0 });
    for (const metadata of [{q: 64}, {ts: undefined}, {ts: clock - 90000}, {ack:false}]) {
        dp.handleStateChange(evId, { val: 6300, ts: clock, ack: true, q: 0, ...metadata });
        assert.deepEqual(core._currentEvMeterPowers(clock, 15000), { actualW: 0, pvManagedW: 0 });
    }
});
