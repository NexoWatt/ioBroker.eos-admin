'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ThermalControlModule } = require('../ui/ems/modules/thermal-control');
const { DatapointRegistry } = require('../ui/ems/datapoints');
const { EmsEngine } = require('../ui/ems/engine');
const { beginSafetyCycle } = require('../ui/ems/services/safety-envelope');

async function fixture(t, mutate) {
    let now = Date.now();
    t.mock.method(Date, 'now', () => now);
    const base = 'eos-admin.0.devices.hsm', meter = 'eos-admin.0.devices.wpm';
    const m = base + '.aliases.v1.', power = meter + '.aliases.v1.r.power';
    const row = {
        slot: 1, mode: 'pvAuto', type: 'power', enabled: true, ovumMira: true, miraSourcesConfirmed: true,
        minOffSec: 0, minOnSec: 0, maxPowerW: 3300, _eosDevice: { baseId: base, mode: 'mira' },
        miraPowerTargetId: m + 'ctrl.pvPowerTargetW', miraPowerTargetReadId: m + 'r.pvPowerTargetW',
        miraPvStatusId: m + 'ctrl.pvStatus', miraPvStatusReadId: m + 'r.pvStatus',
    };
    const writes = [], states = {};
    const config = {
        enableThermalControl: true, thermal: {devices: [row]}, datapoints: { consumer1Power: power },
        vis: {flowSlots: {consumers: [{consumerType: 'heatPump'}]}},
        installerConfig: { gridConnectionPower: 11000, safetyMeterTimeoutSec: 30 }, chargingManagement: {staleTimeoutSec: 300},
        eosDeviceEms: {bindings: {
            [base]: { activationRequested: true, deviceTemplateId: 'heat.ovum.mira.hsm', miraCommissionedMaxW: 2300 },
            [meter]: {target: 'consumer1Power'},
        }},
    };
    mutate?.(config, row);
    const adapter = {
        namespace: 'eos-admin.0', config, setObjectNotExistsAsync: async () => {},
        getStateAsync: async id => Object.hasOwn(states, id) ? {val: states[id]} : null,
        setStateAsync: async (id, value) => { states[id] = value; },
        setForeignStateAsync: async (id, value, ack) => { assert.equal(ack, false); writes.push([id, value]); },
        log: {debug(){}, info(){}, warn(){}, error(){}},
    };
    const dp = new DatapointRegistry(adapter, []);
    const engine = new EmsEngine(adapter);
    engine.dp = dp;
    engine.mm = {tick: async () => {}};
    const thermal = new ThermalControlModule(adapter, dp);
    await thermal.init();
    await dp.upsert({ key: 'vis.gridNetW', objectId: 'meter.grid', dataType: 'number', direction: 'in', unit: 'W' });
    let generation = 0, available = 4200, gridW = -4200;
    const sample = (id, val, extra = {}) => dp.handleStateChange(id, {val, ts: now, q: 0, ack: true, ...extra}, true);
    sample(power, 0);
    sample(row.miraPvStatusReadId, 0);
    sample(row.miraPowerTargetReadId, 12000);
    sample('eos-admin.0.thermal.user.c1.regEnabled', true);
    sample('eos-admin.0.thermal.user.c1.mode', 'inherit');
    async function tick({expiredGrid = false, grid = gridW, budget = available, para14a = false} = {}) {
        now += 100;
        gridW = grid; available = budget;
        sample('meter.grid', grid, expiredGrid ? {ts: now - 40000} : {});
        await engine.tick();
        adapter._emsCaps = { grid: { gridImportLimitW_effective: 11000, gridImportLimitW_physical: 11000 } };
        adapter._emsBudget = {ts: now, peek: () => ({remainingPvW: budget, remainingTotalW: budget, ts: now}),
            getPvGrant: () => ({grantW: budget}), getTotalGrant: () => ({grantW: budget}), reserve() {}};
        adapter._para14a = {active: para14a};
        beginSafetyCycle(adapter, ++generation, now);
        await thermal.tick();
    }
    return {base, meter, row, power, writes, adapter, thermal, states, sample, tick, advance: () => {now++;}};
}

test('MIRA uses commissioned watt ceiling, genuine register feedback, and neutral return under §14a', async t => {
    const f = await fixture(t);
    await f.tick();
    assert.deepEqual(f.writes, [[f.row.miraPowerTargetId, 2300]]);
    f.sample(f.row.miraPowerTargetId, 2300, {ack: false});
    await f.tick();
    assert.equal(f.writes.length, 1, 'writing the command state does not confirm a physical target');
    f.sample(f.row.miraPowerTargetReadId, 2300);
    await f.tick();
    assert.deepEqual(f.writes.at(-1), [f.row.miraPvStatusId, 1]);
    assert.equal(f.states['thermal.devices.c1.applied'], false);
    f.sample(f.row.miraPvStatusReadId, 1);
    await f.tick();
    assert.equal(f.states['thermal.devices.c1.applied'], true);
    assert.equal(f.writes.length, 2, 'stable verified target produces no write');
    await f.tick({para14a: true});
    assert.deepEqual(f.writes.at(-1), [f.row.miraPvStatusId, 0]);
    assert.equal(f.writes.length, 3);
    assert.equal(f.adapter._zeroExportPvOwnedThermal.c1.owned, false);
    f.sample(f.row.miraPvStatusReadId, 0);
    f.sample(f.power, 820);
    await f.tick({para14a:true});
    assert.equal(f.states['thermal.summary.appliedTotalW'], 820, 'the autonomous heat demand remains measured after release');
});

test('late watt echo and absent physical inputs cannot start MIRA; fresh data recovers', async t => {
    const f = await fixture(t);
    await f.tick();
    f.sample(f.row.miraPowerTargetReadId, 2300, {ts: Date.now() - 1000});
    await f.tick();
    assert.equal(f.writes.length,1);
    f.sample(f.row.miraPowerTargetReadId, 2300);
    f.sample(f.power, 0, {q: 64});
    await f.tick();
    assert.ok(f.writes.every(([key, value]) => !(key === f.row.miraPvStatusId && value === 1)));
    f.sample(f.power, 0);
    await f.tick({expiredGrid: true});
    assert.ok(f.writes.every(([key, value]) => !(key === f.row.miraPvStatusId && value === 1)));
    await f.tick();
    assert.deepEqual(f.writes.at(-1), [f.row.miraPvStatusId, 1]);
    f.sample(f.row.miraPvStatusReadId, 1);
    f.sample(f.row.miraPowerTargetReadId, 2300, {ack:false});
    await f.tick();
    assert.deepEqual(f.writes.at(-1), [f.row.miraPvStatusId, 0]);
});

test('no actuator writes until explicit commissioning and no generic switch fallback', async t => {
    const f = await fixture(t, (cfg, r) => {
        cfg.eosDeviceEms.bindings[r._eosDevice.baseId].activationRequested = false;
        cfg.vis.flowSlots.consumers[0].ctrl = {switchWriteId: 'unit.unsafe.switch', setpointWriteId: 'unit.unsafe.temperature'};
    });
    await f.tick();
    await f.thermal.deactivate();
    assert.deepEqual(f.writes, []);
});

test('invalid or crossed HSM command/readback mapping is not controllable', async t => {
    const f = await fixture(t, (cfg, r) => { r.miraPowerTargetReadId = 'eos-admin.0.devices.other.aliases.v1.r.pvPowerTargetW'; });
    await f.tick();
    assert.deepEqual(f.writes, []);
});

test('MIRA manual handoff releases own boost once and preserves subsequent local operation', async t => {
    const f = await fixture(t);
    await f.tick();
    f.sample(f.row.miraPowerTargetReadId, 2300);
    await f.tick();
    f.sample(f.row.miraPvStatusReadId,1);
    f.sample('eos-admin.0.thermal.user.c1.mode','manual');
    await f.tick();
    assert.deepEqual(f.writes.at(-1), [f.row.miraPvStatusId, 0]);
    f.sample(f.row.miraPvStatusReadId,0);
    await f.tick();
    f.sample(f.row.miraPvStatusReadId,2);
    await f.tick();
    assert.equal(f.writes.length,3);
});

test('restart adopts active MIRA only from fresh measurements and neutralizes an unverified old boost', async t => {
    const f = await fixture(t);
    f.sample(f.row.miraPvStatusReadId, 1);
    f.sample(f.row.miraPowerTargetReadId, 8000);
    f.sample(f.power, 950, {ts:Date.now()-31000});
    await f.tick();
    assert.deepEqual(f.writes, [[f.row.miraPvStatusId,0]]);
    assert.equal(f.states['thermal.devices.c1.applied'], false);
    f.sample(f.row.miraPvStatusReadId, 0);
    await f.tick();
    assert.equal(f.writes.length, 1);
    f.sample(f.power, 950);
    await f.tick();
    assert.deepEqual(f.writes.at(-1), [f.row.miraPowerTargetId,2300]);
});

test('turning MIRA off sends neutral even if a previous raise is queued and feedback is still zero', async t => {
    const f = await fixture(t);
    await f.tick();
    f.sample(f.row.miraPowerTargetReadId, 2300);
    await f.tick();
    f.sample(f.row.miraPvStatusReadId,0);
    await f.tick({budget:0});
    assert.deepEqual(f.writes, [[f.row.miraPowerTargetId,2300],[f.row.miraPvStatusId,1],[f.row.miraPvStatusId,0]]);
});

test('a different WPM slot or missing numerical commission cannot actuate a hydraulic module', async t => {
    const f = await fixture(t, (cfg, r) => {
        cfg.eosDeviceEms.bindings['eos-admin.0.devices.wpm'].target = 'consumer3Power';
        delete cfg.eosDeviceEms.bindings[r._eosDevice.baseId].miraCommissionedMaxW;
    });
    await f.tick();
    assert.deepEqual(f.writes, []);
});

test('falling grant neutralizes active boost before staging a smaller request', async t => {
    const f = await fixture(t);
    assert.equal(f.thermal._devices.length, 1);
    await f.tick();
    f.sample(f.row.miraPowerTargetReadId, 2300);
    await f.tick();
    f.sample(f.row.miraPvStatusReadId, 1);
    await f.tick({budget: 1100});
    assert.deepEqual(f.writes.at(-1), [f.row.miraPvStatusId, 0]);
    f.sample(f.row.miraPvStatusReadId, 0);
    await f.tick({budget: 1100});
    assert.deepEqual(f.writes.at(-1), [f.row.miraPowerTargetId, 1100]);
    f.sample(f.row.miraPowerTargetReadId, 1100);
    await f.tick({budget: 1400});
    assert.deepEqual(f.writes.at(-1), [f.row.miraPvStatusId, 1], 'slightly rising surplus does not starve the feedback handshake');
});

test('module deactivation waits for HSM neutral readback and reports autonomous heating separately', async t => {
    const f = await fixture(t);
    await f.tick();
    f.sample(f.row.miraPowerTargetReadId, 2300);
    await f.tick();
    f.sample(f.row.miraPvStatusReadId, 1);
    f.sample(f.power, 820);
    await assert.rejects(f.thermal.deactivate(), /thermal-safe-stop-failed/);
    assert.equal(f.states['thermal.summary.status'], 'module-disabled-release-pending');
    assert.deepEqual(f.writes.at(-1), [f.row.miraPvStatusId, 0]);
    f.advance();
    f.sample(f.row.miraPvStatusReadId, 0);
    assert.deepEqual(await f.thermal.deactivate(), {ok:true, attempted:1, stopped:0, miraNeutral:1});
    assert.equal(f.states['thermal.summary.appliedTotalW'], 820);
    assert.equal(f.writes.length, 3);
    f.sample('eos-admin.0.thermal.user.c1.mode', 'manual');
    f.sample(f.row.miraPvStatusReadId, 2);
    await f.thermal.deactivate();
    assert.equal(f.writes.length, 3);
});
