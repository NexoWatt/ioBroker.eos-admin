/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Execute the canonical production sources, resolving their unchanged services
// from the runtime tree. This test must also run before the final runtime build.
function loadSource(relative, overrides = {}) {
    const file = path.join(__dirname, '../ui', `${relative}.js`);
    const source = fs.readFileSync(path.join(__dirname, '../ui/src-ts/runtime-executables', `${relative}.ts`), 'utf8');
    const subject = new Module(file, module);
    subject.filename = file;
    subject.paths = Module._nodeModulePaths(path.dirname(file));
    const originalRequire = subject.require.bind(subject);
    subject.require = id => Object.hasOwn(overrides, id) ? overrides[id] : originalRequire(id);
    subject._compile(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, file);
    return subject.exports;
}
const { DatapointRegistry } = loadSource('ems/datapoints');
const { applySetpoint } = loadSource('ems/consumers/index', { './evcs': loadSource('ems/consumers/evcs') });
const setId = 'ocpp21.0.CP_01.control.chargeLimit';
const enableId = 'ocpp21.0.CP_01.control.availability';

async function fixture({ current = false, min, max = 11000, rawUnit = 'W', dispatch } = {}) {
    const writes = [];
    const adapter = {
        log: { debug() {}, warn() {}, info() {}, error() {} },
        async getForeignObjectAsync(id) { return { common: { type: id === enableId ? 'boolean' : 'number', unit: id === enableId ? '' : rawUnit } }; },
        async getForeignStateAsync() { return null; },
        async subscribeForeignStatesAsync() {},
        async setForeignStateAsync(id, val, ack) {
            writes.push({ id, val, ack });
            if (dispatch) return dispatch(id, val, ack);
        },
    };
    const key = current ? 'cm.wb.lp1.setA' : 'cm.wb.lp1.setW';
    const dp = new DatapointRegistry(adapter, [
        { key, objectId: setId, direction: 'out', unit: current ? 'A' : 'W', min, max, deadband: current ? 0.1 : 25, maxWriteIntervalMs: 45000 },
        { key: 'cm.wb.lp1.enable', objectId: enableId, direction: 'out', dataType: 'boolean', maxWriteIntervalMs: 45000 },
    ]);
    await dp.init();
    const consumer = { type: 'evcs', key: 'lp1', controlBasis: current ? 'currentA' : 'powerW',
        setAKey: current ? key : '', setWKey: current ? '' : key, enableKey: 'cm.wb.lp1.enable' };
    return { writes, adapter, dp, key, apply: value => applySetpoint({ adapter, dp }, consumer,
        { targetW: current ? value * 690 : value, targetA: current ? value : value / 690, enable: true }) };
}

test('OCPP power commands go through the real consumer and registry: 5700W, stop, keepalive, resume', async t => {
    let now = 1795608000000;
    t.mock.method(Date, 'now', () => now);
    const h = await fixture();
    assert.equal((await h.apply(5700)).applied, true);
    assert.equal((await h.apply(0)).applied, true);
    assert.deepEqual(h.writes.filter(w => w.id === setId).map(w => w.val), [5700, 0]);
    assert.equal((await h.apply(0)).status, 'unchanged', 'identical stop stays deduplicated until keepalive');
    now += 45001;
    assert.equal((await h.apply(0)).applied, true);
    assert.equal((await h.apply(5700)).applied, true);
    assert.deepEqual(h.writes.filter(w => w.id === setId).map(w => w.val), [5700, 0, 0, 5700]);
    assert.ok(h.writes.every(w => w.ack === false));
    assert.ok(h.writes.filter(w => w.id === enableId).every(w => w.val === true), 'PV pause preserves station availability');
});

test('explicit EVCS stop bypasses a configured minimum in W and A, retaining positive minimum and maximum', async () => {
    for (const current of [false, true]) {
        const min = current ? 6 : 4140;
        const max = current ? 16 : 11000;
        const h = await fixture({ current, min, max, rawUnit: current ? 'A' : 'W' });
        await h.apply(current ? 8 : 5700);
        await h.apply(0);
        assert.equal(h.writes.filter(w => w.id === setId).at(-1).val, 0, 'technical running minimum must never turn stop into charging');
        await h.apply(current ? 2 : 1000);
        assert.equal(h.writes.filter(w => w.id === setId).at(-1).val, min);
        await h.apply(max * 2);
        assert.equal(h.writes.filter(w => w.id === setId).at(-1).val, max);
        await h.dp.writeNumber(h.key, 0, false);
        assert.equal(h.writes.filter(w => w.id === setId).at(-1).val, min, 'generic numeric writes retain their original clamp contract');
    }
});

test('EVCS zero transitions are not swallowed by deadband in either direction', async () => {
    for (const current of [false, true]) {
        const h = await fixture({ current, rawUnit: current ? 'A' : 'W' });
        const small = current ? 0.05 : 20;
        await h.apply(small); await h.apply(0); await h.apply(small);
        assert.deepEqual(h.writes.filter(w => w.id === setId).map(w => w.val), [small, 0, small]);
    }
});

test('a failed stop is retried, and W-to-kW conversion preserves zero', async () => {
    let fail = true;
    const h = await fixture({ rawUnit: 'kW', dispatch: async (id, val) => { if (id === setId && val === 0 && fail) throw new Error('simulated write failure'); } });
    await h.apply(5700);
    assert.equal((await h.apply(0)).applied, false);
    fail = false;
    assert.equal((await h.apply(0)).applied, true);
    assert.deepEqual(h.writes.filter(w => w.id === setId).map(w => w.val), [5.7, 0, 0]);
});

// Optional integration against the separately supplied historical OCPP21 source.
// No server/network/hardware is created; only the actual onStateChange is run.
test('provided OCPP21 source receives zero unchanged; RPC acceptance remains separate from local ack',
    { skip: !process.env.EOS_TEST_OCPP21_MAIN }, async () => {
        const file = path.resolve(process.env.EOS_TEST_OCPP21_MAIN);
        const subject = new Module(file, module);
        subject.filename = file;
        subject.require = id => {
            if (id === '@iobroker/adapter-core') return { Adapter: class { on() {} } };
            if (id === './ocpp/server') return { OcppRpcServer: class {} };
            throw new Error(`Unexpected OCPP21 source dependency: ${id}`);
        };
        subject._compile(fs.readFileSync(file, 'utf8'), file);
        for (const proto of ['ocpp1.6', 'ocpp2.0.1', 'ocpp2.1']) {
            const device = subject.exports({});
            const commands = [], acknowledgements = [];
            device.namespace = 'ocpp21.0';
            device.log = { info() {}, warn() {}, error() {} };
            device.captureOcppPayload = async () => {};
            device.getStateAsync = async id => ({ val: id.endsWith('chargeLimitType') ? 'W' : 3 });
            device.setStateAsync = async (id, state) => acknowledgements.push({ id, state });
            device.runtimeIndex.set('CP_01', { proto, client: { async call(method, payload) { commands.push({ method, payload }); return { status: 'Rejected' }; } } });
            const h = await fixture({ dispatch: (id, val, ack) => device.onStateChange(id, { val, ack }) });
            await h.apply(5700); await h.apply(0);
            const profiles = commands.filter(c => c.method === 'SetChargingProfile');
            assert.equal(profiles.length, 2);
            const limits = profiles.map(c => proto === 'ocpp1.6'
                ? c.payload.csChargingProfiles.chargingSchedule.chargingSchedulePeriod[0].limit
                : c.payload.chargingProfile.chargingSchedule[0].chargingSchedulePeriod[0].limit);
            assert.deepEqual(limits, [5700, 0]);
            assert.ok(acknowledgements.some(a => a.id === setId && a.state.val === 0 && a.state.ack === true),
                'historical 0.2.2 acks the state despite Rejected: this is not hardware confirmation');
        }
    });
