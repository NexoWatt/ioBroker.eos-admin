'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EmsEngine } = require('../ui/ems/engine');
const { DatapointRegistry } = require('../ui/ems/datapoints');
const { ChargingManagementModule } = require('../ui/ems/modules/charging-management');
const { buildNvpSnapshotFromRegistry, resolveCurrentNvpSnapshot } = require('../ui/ems/services/measurement-freshness');
const { beginSafetyCycle, buildSafetyEnvelope, evaluateFlexibleLoadRequest } = require('../ui/ems/services/safety-envelope');

async function fixture() {
    const writes = [];
    const adapter = {
        config: {
            installerConfig: { gridConnectionPower: 10000, safetyMeterTimeoutSec: 30 },
            chargingManagement: { staleTimeoutSec: 300 },
        },
        setStateAsync: async () => {}, getStateAsync: async () => null,
        setForeignStateAsync: async (id, value, ack) => { writes.push({ id, value, ack }); },
        log: { debug() {}, info() {}, warn() {}, error() {} },
    };
    const dp = new DatapointRegistry(adapter, []);
    const engine = new EmsEngine(adapter);
    engine.dp = dp;
    engine.mm = { tick: async () => {} };
    const cm = new ChargingManagementModule(adapter, dp);
    const station = {
        safe: 'wb1', ch: 'chargingManagement.wallboxes.wb1', online: true, controlAvailable: true, controlBasis: 'powerW',
        setWKey: 'wb.setW', enableKey: '', name: 'WB1', cfgEnabled: true, userStationEnabled: true, userEnabled: true,
        operationalBlocked: false, enabled: true, maxPW: 11000, phases: 3, meterStale: false, actualPowerW: 0,
        consumer: { type: 'evcs', key: 'wb1', controlBasis: 'powerW', setWKey: 'wb.setW' },
    };
    async function mapInput(key, objectId) {
        await dp.upsert({ key, objectId, dataType: 'number', direction: 'in', useAliveForStale: false });
    }
    function sample(id, val, ts, extra = {}) {
        dp.handleStateChange(id, { val, ts, q: 0, ack: true, ...extra }, true);
    }
    await dp.upsert({ key: 'wb.setW', objectId: 'charger.targetW', dataType: 'number', unit: 'W', direction: 'out' });
    let generation = 0;
    function release(now = Date.now(), gridOverrides = {}) {
        adapter._emsCaps = { grid: { gridImportLimitW_effective: 10000, gridImportLimitW_physical: 10000, ...gridOverrides } };
        beginSafetyCycle(adapter, ++generation, now);
        return buildSafetyEnvelope({ adapter, dp, coreSnapshot: adapter._emsCaps, now, generation });
    }
    async function apply() {
        await engine.tick();
        release();
        await cm._executeChargingSetpointEntries([{
            safe: station.safe, targetPowerW: 5000, targetCurrentA: 0, basis: 'powerW',
            setpointKey: station.setWKey, writeRequired: true, reason: 'requested',
        }], [station], [], 'nvp-test', '');
        return writes.at(-1);
    }
    return {adapter, dp, mapInput, sample, release, apply};
}

for (const [name, invalid] of Object.entries({
    'bad quality': () => ({ q: 64 }),
    'command instead of measurement': () => ({ ack: false }),
    'missing original timestamp on startup': () => ({ ts: undefined }),
    'future observation': () => ({ ts: Date.now() + 3600000 }),
    'exceeded hard meter timeout inside 300-second telemetry window': () => ({ ts: Date.now() - 65000 }),
})) {
    test('final EVCS writer blocks and recovers after ' + name, async () => {
        const f = await fixture();
        await f.mapInput('vis.gridNetW', 'meter.site');
        f.sample('meter.site', 0, Date.now(), invalid());
        assert.deepEqual(await f.apply(), { id: 'charger.targetW', value: 0, ack: false });
        f.sample('meter.site', 0, Date.now());
        assert.deepEqual(await f.apply(), { id: 'charger.targetW', value: 5000, ack: false });
    });
}

test('a new tick or a genuine watchdog heartbeat does not renew original NVP measurement age', async () => {
    const f = await fixture();
    await f.mapInput('vis.gridNetW', 'meter.site');
    await f.mapInput('cm.gridWatchdog', 'meter.lastSeenMs');
    const now = Date.now();
    f.sample('meter.site', 0, now - 29800);
    f.sample('meter.lastSeenMs', now, now);
    const snapshot = buildNvpSnapshotFromRegistry({registry: f.dp, now, staleMs: 5000, maxHeartbeatHoldMs: 60000});
    assert.equal(snapshot.usable, true);
    assert.equal(snapshot.reason, 'heartbeat-confirmed');
    assert.equal(resolveCurrentNvpSnapshot(snapshot, now + 200, 30000).usable, true);
    assert.equal(resolveCurrentNvpSnapshot(snapshot, now + 201, 30000).usable, false);
    const next = buildNvpSnapshotFromRegistry({registry: f.dp, now: now + 500, staleMs: 5000, maxHeartbeatHoldMs: 60000});
    assert.equal(next.measurementAgeMs, 30300);
    assert.equal(resolveCurrentNvpSnapshot(next, now + 500, 30000).usable, false);
});

test('coherent split NVP uses the oldest contributing sample and rejects a corrupt configured direction', async () => {
    const f = await fixture();
    await f.mapInput('vis.gridBuyW', 'meter.buy');
    await f.mapInput('vis.gridSellW', 'meter.sell');
    const now = Date.now();
    f.sample('meter.buy', 1000, now - 28000);
    f.sample('meter.sell', 0, now - 30500);
    const snapshot = () => buildNvpSnapshotFromRegistry({ registry: f.dp, now, staleMs: 300000 });
    assert.equal(snapshot().netW, 1000);
    assert.equal(snapshot().measurementAgeMs, 30500);
    assert.equal(resolveCurrentNvpSnapshot(snapshot(), now, 30000).usable, false);
    f.sample('meter.buy', 0, now, { q: 64 });
    f.sample('meter.sell', 0, now);
    assert.equal(snapshot().usable, false);
    f.sample('meter.buy', 0, now);
    assert.equal(resolveCurrentNvpSnapshot(snapshot(), now, 30000).usable, true);
});

test('phase measurements require valid metadata and the oldest phase limits the lifetime of the issued envelope', async () => {
    const f = await fixture();
    const now = Date.now();
    f.adapter._nvpFreshnessSnapshot = { ts: now, usable: true, netW: 0, measurementAgeMs: 0 };
    for (const phase of ['l1A', 'l2A', 'l3A']) {
        await f.mapInput('ps.' + phase, 'meter.' + phase);
        f.sample('meter.' + phase, 3, now);
    }
    f.sample('meter.l2A', 3, now, { q: 64 });
    assert.equal(f.release(now, {gridMaxPhaseA_cfg: 16}).valid, false);
    f.sample('meter.l2A', 3, now - 29900);
    const envelope = f.release(now, {gridMaxPhaseA_cfg: 16});
    assert.equal(envelope.valid, true);
    assert.equal(envelope.expiresAt, now + 100);
    const request = {key: 'evcs:a', app: 'evcs', requestedW: 5000, currentActualW: 0};
    assert.equal(evaluateFlexibleLoadRequest(f.adapter, {...request, now}).allowedW, 5000);
    assert.equal(evaluateFlexibleLoadRequest(f.adapter, {...request, now: now + 101}).allowedW, 0);
});
