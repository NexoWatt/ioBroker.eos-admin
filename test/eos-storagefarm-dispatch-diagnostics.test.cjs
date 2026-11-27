'use strict';
// Copyright (c) 2026 NexoWatt. Confidential and proprietary.
// Exercise the real aggregation/dispatcher against isolated ioBroker states.
// A confirmed command state is not a physical battery response.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');

async function fixture(t, socs, options = {}) {
    const h = await createHarness();
    const a = h.adapter;
    t.after(async () => { await new Promise(resolve => a.onUnload(resolve)); await h.close(); });
    a.config = structuredClone(require('../ui/io-package.json').native);
    a.config.port = 8188;
    await a.migrateNativeConfig();
    await a.loadInstallerConfigFromState();
    a.config.emsApps.apps.storagefarm = { installed: true, enabled: true };
    a.config.enableStorageFarm = true;
    a.config.storageFarm = { enabled: true, mode: 'pool', selfMinSocPct: 10, storages: [] };
    a.config.storage = { ...a.config.storage, selfEnabled: true, selfMinSocPct: 10 };
    const set = (id, val, unit = 'W') => {
        h.states.set(id, { val, ts: Date.now(), ack: true });
        h.objects.set(id, { type: 'state', common: { type: typeof val === 'boolean' ? 'boolean' : 'number',
            unit, read: true, write: id.endsWith('.set') }, native: {} });
    };
    for (const [index, name] of ['empty', 'full'].entries()) {
        const prefix = `alias.0.${name}`;
        const row = { enabled: true, name, vendorProfile: 'generic', capacityKWh: 10,
            signedPowerId: `${prefix}.power`, socId: `${prefix}.soc`, setSignedPowerId: `${prefix}.set`,
            maxChargeW: 5000, maxDischargeW: index === 1 && options.zeroLimit ? 0 : 5000 };
        a.config.storageFarm.storages.push(row);
        set(row.signedPowerId, 0); set(row.setSignedPowerId, 0);
        if (socs[index] !== undefined) set(row.socId, socs[index], '%');
        if (index === 1 && options.dischargeDenied) {
            row.dischargeAllowedId = `${prefix}.allowed`;
            set(row.dischargeAllowedId, false, '');
        }
    }
    await a.ensureStorageFarmStates();
    await a.updateStorageFarmDerived('dispatch-diagnostics-test');
    if (options.reverseStatus) {
        const key = 'eos-admin.0.storageFarm.storagesStatusJson';
        const state = h.states.get(key);
        h.states.set(key, { ...state, val: JSON.stringify(JSON.parse(state.val).reverse()) });
    }
    const dispatch = async target => {
        const result = await a.applyStorageFarmTargetW(target, { source: 'eigenverbrauch' });
        const diagnostic = JSON.parse(h.states.get('eos-admin.0.storageFarm.lastDispatchJson').val);
        const writes = a.config.storageFarm.storages.map(row => h.states.get(row.setSignedPowerId).val);
        return { result, diagnostic, writes };
    };
    return { ...h, dispatch };
}

test('1%/98% pool dispatch preserves redistribution and explains only the actual per-member floor exclusion', async t => {
    for (const [socs, expected] of [[[1, 98], [0, 600]], [[98, 1], [600, 0]]]) {
        await t.test(socs.join('/'), async t => {
            const h = await fixture(t, socs, { reverseStatus: true });
            const { result, diagnostic, writes } = await h.dispatch(600);
            assert.deepEqual(writes, expected);
            assert.equal(result.acceptedDeliveredW, 600);
            assert.equal(diagnostic.availableDischargePowerW, 5000);
            assert.equal(diagnostic.dispatchStorages, 1);
            for (const [index, row] of diagnostic.results.entries()) {
                assert.equal(row.dispatchKey, `set-signed:alias.0.${index === 0 ? 'empty' : 'full'}.set`);
                assert.equal(row.statusMatch, 'dispatch-key');
                assert.equal(row.dischargeDispatchAvailable, true, 'original status capability remains separate');
                assert.equal(row.directionDispatchAvailable, socs[index] > 10);
                assert.equal(row.dischargeFloorSocPct, 10);
                assert.equal(row.effectiveMaxDischargeW, socs[index] > 10 ? 5000 : 0);
                assert.deepEqual(row.blockedReasons, socs[index] > 10 ? [] : ['soc_at_or_below_discharge_floor']);
                assert.equal(row.dischargeW, expected[index]);
            }
        });
    }
});

test('missing member SoC remains unknown in diagnostics and does not block the other member', async t => {
    const h = await fixture(t, [undefined, 98]);
    const { diagnostic, writes } = await h.dispatch(600);
    assert.deepEqual(writes, [0, 600]);
    assert.equal(diagnostic.results[0].soc, null);
    assert.deepEqual(diagnostic.results[0].blockedReasons, ['soc_missing']);
    assert.equal(diagnostic.availableDischargePowerW, 5000);
});

test('explicit zero limit and discharge prohibition remain blocking and are not relabelled as a SoC error', async t => {
    for (const [options, reason] of [[{ zeroLimit: true }, 'discharge_limit_zero'], [{ dischargeDenied: true }, 'discharge_not_allowed']]) {
        await t.test(reason, async t => {
            const h = await fixture(t, [1, 98], options);
            const { result, diagnostic, writes } = await h.dispatch(600);
            assert.deepEqual(writes, [0, 0]);
            assert.equal(result.reason, 'no-discharge-dispatchable-storage');
            assert.equal(diagnostic.availableDischargePowerW, 0);
            assert.equal(diagnostic.results[1].directionDispatchAvailable, false);
            assert.equal(diagnostic.results[1].effectiveMaxDischargeW, 0);
            assert.deepEqual(diagnostic.results[1].blockedReasons, [reason]);
        });
    }
});

test('idle and charge reports do not pretend that a discharge floor was applied to the current request', async t => {
    const h = await fixture(t, [1, 98]);
    for (const target of [0, -600]) {
        const { diagnostic, writes } = await h.dispatch(target);
        assert.equal(writes.reduce((sum, value) => sum + value, 0), target);
        for (const row of diagnostic.results) {
            assert.equal(row.dischargeFloorSocPct, null);
            assert.equal(row.effectiveMaxDischargeW, null);
            assert.deepEqual(row.blockedReasons, []);
        }
    }
});

test('member tracking keeps the original reading and unchanged command phase, expires, and resets on reversal', async t => {
    let clock = Date.now();
    t.mock.method(Date, 'now', () => clock);
    const h = await fixture(t, [1, 98]);
    const a = h.adapter;
    const power = 'alias.0.full.power';
    const snapshot = async () => {
        await a.updateStorageFarmDerived('compare-phase');
        return JSON.parse(h.states.get('eos-admin.0.storageFarm.storagesStatusJson').val)[1];
    };
    const meter = (val, extra = {}) => h.states.set(power, { val, ts: clock, ack: true, ...extra });
    assert.equal((await snapshot()).powerComparison, null, 'a valid meter alone is not a zero request');
    const run = async w => (await h.dispatch(w)).diagnostic.results[1].trackingCommand;
    const initial = await run(600);
    assert.equal(initial.signedW, 600);
    assert.equal((await snapshot()).powerComparison, null, 'pre-command or same-ms reading');
    clock += 100;
    meter(400);
    let row = await snapshot();
    assert.equal(row.powerComparison.differenceW, 200);
    assert.equal(row.powerComparison.warning, false);
    const measuredAt = row.powerComparison.sampledAt;
    clock += 100;
    const skipped = await run(600);
    assert.deepEqual(skipped, initial, 'suppressed keepalive does not renew proof');
    clock += 1000;
    const repeated = await run(600);
    assert.equal(repeated.acceptedSince, initial.acceptedSince);
    assert.equal(repeated.acceptedAt, clock);
    assert.equal((await snapshot()).powerComparison.sampledAt, measuredAt);
    clock += 2;
    meter(399);
    assert.equal((await snapshot()).powerComparison.warning, true);
    clock += 1;
    const reversed = await run(-600);
    assert.ok(reversed.signedW < 0);
    assert.equal(reversed.acceptedSince, clock);
    assert.equal((await snapshot()).powerComparison, null, 'previous discharge sample cannot confirm charging');
    clock += 10;
    meter(reversed.signedW);
    assert.equal((await snapshot()).powerComparison.differenceW, 0);
    clock += 1;
    const stopped = await run(0);
    assert.equal(stopped.signedW, 0);
    assert.equal((await snapshot()).powerComparison, null);
    clock += 10;
    meter(300);
    assert.equal((await snapshot()).powerComparison.warning, true, 'explicit stop compared with fresh measured flow');
    clock += 31000;
    meter(0);
    assert.equal((await snapshot()).powerComparison, null, 'new physical meter does not renew command');
});

test('member comparison excludes invalid, stale, aliased, partial and wrong-scope feedback', async t => {
    let clock = Date.now();
    t.mock.method(Date, 'now', () => clock);
    const h = await fixture(t, [1, 98]);
    const a = h.adapter;
    const [other, member] = a.config.storageFarm.storages;
    const snapshot = async () => {
        await a.updateStorageFarmDerived('tracking-input-quality');
        return JSON.parse(h.states.get('eos-admin.0.storageFarm.storagesStatusJson').val);
    };
    const meter = (id, val, extra = {}) => {
        h.states.set(id, { val, ts: clock, ack: true, ...extra });
        if (!h.objects.has(id)) h.objects.set(id, { type: 'state', common: { type: 'number', unit: 'W' }, native: {} });
    };
    await h.dispatch(800);
    clock += 20;
    const signed = member.signedPowerId;
    for (const [val, extra] of [[0,{ack:false}],[100,{q:0x40}],[null,{}],[false,{}],['fault 5',{}],[10,{ts:clock-30001}],[0,{ts:clock+1}]]) {
        meter(signed, val, extra);
        assert.equal((await snapshot())[1].powerComparison, null);
    }
    meter(signed, 0);
    assert.equal((await snapshot())[1].powerComparison.warning, true);
    member.batteryFlowPowerId = other.setSignedPowerId;
    assert.equal((await snapshot())[1].trackingMeasurement, undefined, 'another member command must never be a meter');
    delete member.batteryFlowPowerId;
    other.signedPowerId = signed;
    let rows = await snapshot();
    assert.ok(rows.every(row => !row.trackingMeasurement), 'neither duplicate can claim the shared meter');
    other.signedPowerId = 'alias.0.empty.power';
    member.batteryFlowPowerId = 'alias.0.full.rewiredPower';
    meter(member.batteryFlowPowerId, 210);
    assert.equal((await snapshot())[1].powerComparison, null, 'same member key and equal watts cannot carry a command across remapping');
    delete member.batteryFlowPowerId;
    member.vendorProfile = 'fenecon-openems'; member.coupling = 'dc';
    assert.equal((await snapshot())[1].trackingMeasurement, undefined, 'direct ESS target can include DC PV');
    member.vendorProfile = 'generic'; member.coupling = '';
    member.signedPowerId = ''; member.chargePowerId = 'alias.0.full.charge';
    meter(member.chargePowerId, 0);
    assert.equal((await snapshot())[1].trackingMeasurement, undefined, 'single directional register is not net power');
    member.dischargePowerId = 'alias.0.full.discharge';
    meter(member.dischargePowerId, 690);
    clock += 1000;
    await snapshot();
    await h.dispatch(800);
    clock += 20;
    meter(member.chargePowerId, 0); meter(member.dischargePowerId, 690, {ack: false});
    assert.equal((await snapshot())[1].powerComparison, null);
    meter(member.dischargePowerId, 690); meter(member.chargePowerId, 0, {ts:clock-10});
    const complete = (await snapshot())[1].powerComparison;
    assert.equal(complete.sampledAt, clock-10);
    assert.equal(complete.measuredW, 690);
    meter(member.chargePowerId, 1);
    assert.equal((await snapshot())[1].powerComparison, null, 'conflicting simultaneous directional readings');
});

test('stable direct commands remain monitored after 100 seconds and a later physical drift', async t => {
    let clock = Date.now();
    t.mock.method(Date, 'now', () => clock);
    const h = await fixture(t, [1, 98]);
    const {adapter: a, states} = h;
    const initial = (await h.dispatch(600)).diagnostic.results[1].trackingCommand;
    const power = 'alias.0.full.power';
    for (let i=1; i<=10; i++) {
        clock += 10000;
        states.set(power, {val:600,ack:true,ts:clock-500});
        await a.updateStorageFarmDerived('fresh-inputs');
        const command = (await h.dispatch(600)).diagnostic.results[1].trackingCommand;
        assert.equal(command.acceptedSince, initial.acceptedSince);
        assert.equal(command.acceptedAt, clock);
    }
    clock += 1;
    states.set(power, {val:300,ack:true,ts:clock});
    await a.updateStorageFarmDerived('late-drift');
    const [first,second] = JSON.parse(states.get('eos-admin.0.storageFarm.storagesStatusJson').val);
    assert.equal(first.powerComparison, null, 'recent command does not renew a quiet member meter');
    assert.equal(second.powerComparison.differenceW, 300);
    assert.equal(second.powerComparison.warning, true);
});

test('verified FENECON Home direct 706/604 compares AC power independently from the battery and PV', async t => {
    let clock = Date.now();
    t.mock.method(Date, 'now', () => clock);
    const h = await fixture(t, [1, 98]);
    const a = h.adapter;
    const row = a.config.storageFarm.storages[1];
    const base = 'eos-admin.0.devices.home';
    const template = 'ess.fenecon.FeneconHomeEssImpl';
    const points = [
        ['ctrl.powerSetpointW','sET_ACTIVE_POWER',0,true],
        ['r.essActivePower','eSS0_ACTIVE_POWER',320,false],
        ['r.power','bATTERY_AC_POWER',-500,false],
    ];
    for (const [alias, dp, val, write] of points) {
        for (const [id, native, unit] of [
            [base+'.'+dp,{deviceId:'home',templateId:template,datapointId:dp},'kW'],
            [base+'.aliases.v1.'+alias,{deviceId:'home',templateId:template,isAlias:true,dpId:dp},'W'],
        ]) {
            h.objects.set(id,{type:'state',common:{unit,type:'number',read:true,write},native});
            h.states.set(id,{val,ts:clock,ack:true});
        }
    }
    Object.assign(row,{vendorProfile:'fenecon-openems',coupling:'dc',feneconControlMode:'direct-ess',
        signedPowerId:base+'.aliases.v1.r.essActivePower',feneconEssActualPowerId:base+'.aliases.v1.r.essActivePower',
        setSignedPowerId:base+'.aliases.v1.ctrl.powerSetpointW',batteryFlowPowerId:base+'.aliases.v1.r.power',
        _eosDevice:{v:1,baseId:base,devId:'home'}});
    const snapshot = async () => {
        await a.updateStorageFarmDerived('compare-ess-ac');
        return JSON.parse(h.states.get('eos-admin.0.storageFarm.storagesStatusJson').val)[1];
    };
    await snapshot();
    const res = await a.applyStorageFarmTargetW(600,{source:'eigenverbrauch'});
    const command = res.results[1].trackingCommand;
    assert.equal(command?.signedW,600);
    clock += 1;
    h.states.set(row.signedPowerId,{val:399,ts:clock,ack:true});
    h.states.set(row.batteryFlowPowerId,{val:-500,ts:clock,ack:true});
    let item = await snapshot();
    assert.equal(item.batteryFlowPowerW,-500);
    assert.equal(item.powerComparison.domain,'ess-ac');
    assert.equal(item.powerComparison.measuredW,399);
    assert.equal(item.powerComparison.differenceW,201);
    assert.equal(item.powerComparison.warning,true);
    h.states.set(row.signedPowerId,{val:399,ts:clock,ack:false});
    assert.equal((await snapshot()).powerComparison,null,'battery reading cannot substitute for missing converter feedback');
    row.setSignedPowerId = base+'.sET_ACTIVE_POWER';
    assert.equal((await snapshot()).trackingMeasurement,undefined,'kW on raw 706 is not a verified W handoff');
    row.setSignedPowerId = base+'.aliases.v1.ctrl.powerSetpointW';
    row.feneconEssActualPowerId = row.batteryFlowPowerId;
    assert.equal((await snapshot()).trackingMeasurement,undefined,'register 415 cannot be used as the AC actor response');
});

test('No-Write immediately withdraws the comparison until a new complete physical command phase', async t => {
    let clock = Date.now();
    t.mock.method(Date,'now',()=>clock);
    const { SpeicherRegelungModule } = require('../ui/ems/modules/storage-control');
    const h = await fixture(t,[1,98]);
    const a = h.adapter;
    const controller = new SpeicherRegelungModule(a, {});
    const meter = () => h.states.set('alias.0.full.power',{val:300,ts:clock,ack:true});
    const compare = async () => {
        await a.updateStorageFarmDerived('watch-transition');
        return JSON.parse(h.states.get('eos-admin.0.storageFarm.storagesStatusJson').val)[1].powerComparison;
    };
    await h.dispatch(700);
    clock += 10; meter();
    assert.equal((await compare()).differenceW,400);
    await controller._setHoldNoWriteTargetDiag(700,'Regelübergabe','idle','no-write');
    assert.equal(await compare(),null);
    clock += 10;
    let row = (await h.dispatch(700)).diagnostic.results[1];
    assert.equal(row.trackingCommand,undefined,'unchanged short-circuited setpoint cannot establish authority');
    assert.equal(await compare(),null);
    clock += 1000;
    row = (await h.dispatch(700)).diagnostic.results[1];
    assert.equal(row.trackingCommand.acceptedSince,clock);
    assert.equal(await compare(),null,'old measurement predates new authority');
    clock += 1; meter();
    assert.equal((await compare()).warning,true);
    await controller._setNoWriteTargetDiag(700,'Übergabe','idle','no-write');
    assert.equal(await compare(),null);
});

test('aliases of the same physical terminal cannot report a command echo or claim another member meter', async t => {
    let clock = Date.now();
    t.mock.method(Date,'now',()=>clock);
    const h = await fixture(t,[1,98]);
    const a = h.adapter;
    const [other,member] = a.config.storageFarm.storages;
    const redirect = (id,target) => {
        h.objects.set(id,{type:'state',common:{type:'number',read:true,write:false,unit:'W',alias:{id:target}},native:{}});
        h.states.set(id,{ack:true,ts:clock,val:300});
    };
    const snapshot = async () => {
        await a.updateStorageFarmDerived('compare-canonical-identity');
        return JSON.parse(h.states.get('eos-admin.0.storageFarm.storagesStatusJson').val);
    };
    member.batteryFlowPowerId = 'alias.0.fake.readback';
    redirect(member.batteryFlowPowerId,other.setSignedPowerId);
    assert.equal((await snapshot())[1].trackingMeasurement,undefined);
    member.batteryFlowPowerId = 'alias.0.duplicate.physical';
    redirect(member.batteryFlowPowerId,other.signedPowerId);
    assert.ok((await snapshot()).every(row => row.trackingMeasurement === undefined));
});
