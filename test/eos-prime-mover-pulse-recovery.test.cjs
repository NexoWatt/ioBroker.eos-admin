/** Copyright (c) 2026 NexoWatt. All rights reserved. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { GeneratorControlModule } = require('../ui/ems/modules/generator-control');
const { BhkwControlModule } = require('../ui/ems/modules/bhkw-control');

function plant(kind, command, config = {}) {
    const id = kind === 'bhkw' ? 'b1' : 'g1';
    const base = `${kind}.devices.${id}`;
    const user = `${kind}.user.${id}`;
    const journal = `${base}.pulseResetPending`;
    const local = new Map(), foreign = new Map(), writes = [], timers = [];
    const state = val => ({ val, ts: Date.now(), lc: Date.now(), ack: true });
    local.set(`${user}.mode`, state('manual'));
    local.set(`${user}.command`, state(command));
    foreign.set('motor.running', state(command === 'stop'));
    const row = { enabled: true, idx: 1, commandType: 'pulse', startWriteId: 'motor.start', stopWriteId: 'motor.stop',
        runningReadId: 'motor.running', requireReadback: false, retryDelaySec: 1, commandTimeoutSec: 30, ...config };
    const adapter = {
        config: { [kind]: { devices: [row] } }, log: { warn() {} },
        async setObjectNotExistsAsync() {},
        async setStateAsync(key, value) { local.set(key, state(value)); },
        async getStateAsync(key) { return local.get(key) ?? null; },
        async getForeignStateAsync(key) { return foreign.get(key) ?? null; },
        async setForeignStateAsync(key, value) { writes.push([key, value]); foreign.set(key, state(value)); },
        _nwSetTimeout(callback) { timers.push(callback); },
    };
    const Module = kind === 'bhkw' ? BhkwControlModule : GeneratorControlModule;
    return { adapter, row, local, foreign, writes, timers, base, user, journal, state,
        async init() { const module = new Module(adapter, null); await module.init(); return module; } };
}

for (const kind of ['generator', 'bhkw']) {
    for (const command of ['start', 'stop']) {
        test(`${kind}: a restart during the ${command} pulse releases only that relay and does not replay the request`, async () => {
            const p = plant(kind, command);
            const originalRequest = p.local.get(`${p.user}.command`);
            const module = await p.init();
            assert.deepEqual(p.writes, []);
            await module.tick();
            assert.deepEqual(p.writes, [[`motor.${command}`, true]]);
            assert.equal(JSON.parse(p.local.get(p.journal).val).command, command);
            p.local.set(`${p.user}.command`, originalRequest); // Process died before acknowledging the request.
            p.adapter._nwShuttingDown = true;
            p.timers.shift()();
            await new Promise(resolve => setImmediate(resolve));
            p.adapter._nwShuttingDown = false;
            const restarted = await p.init();
            await restarted.tick();
            assert.deepEqual(p.writes, [[`motor.${command}`, true], [`motor.${command}`, false]]);
            assert.equal(p.local.get(p.journal).val, '');
            assert.equal(p.local.get(`${p.user}.command`).val, '');
            await p.init();
            assert.equal(p.writes.length, 2);
        });
    }
}
test('failed pulse persistence never energises the relay', async () => {
    const p = plant('generator', 'start');
    const module = await p.init();
    const store = p.adapter.setStateAsync.bind(p.adapter);
    p.adapter.setStateAsync = async (key, value) => {
        if (key === p.journal) throw new Error('state store unavailable');
        return store(key, value);
    };
    await module.tick();
    assert.deepEqual(p.writes, []);
});
test('a failed pulse reset is retried after restart and never energises a new mapping', async () => {
    const p = plant('generator', 'start');
    const original = await p.init(); await original.tick();
    const write = p.adapter.setForeignStateAsync.bind(p.adapter);
    p.adapter.setForeignStateAsync = async (key, value) => value === false ? false : write(key, value);
    p.timers.shift()();
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(p.local.get(p.journal).val);
    p.row.startWriteId = 'different.device'; await p.init();
    assert.equal(p.writes.length, 1);
    p.row.startWriteId = 'motor.start'; p.adapter.setForeignStateAsync = write; await p.init();
    assert.deepEqual(p.writes, [['motor.start', true], ['motor.start', false]]);
    assert.equal(p.local.get(p.journal).val, '');
});
test('completed pulse leaves no restart write and preserves automatic settling while feedback catches up', async () => {
    const p = plant('bhkw', 'start', { requireReadback: true });
    const module = await p.init();
    await module.tick();
    p.timers.shift()();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(p.local.get(p.journal).val, '');
    const restarted = await p.init();
    const device = restarted.devices[0];
    const feedback = await restarted.operationalFeedback(device);
    await restarted.requestState(device, true, 'auto:low_soc', false, feedback.running);
    assert.equal(p.local.get(p.base+'.writeContractStatus').val, 'command-settle-wait');
    assert.deepEqual(p.writes, [['motor.start', true], ['motor.start', false]]);
});

test('an unsuccessful falling edge is retried in a later tick without restarting', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
    const p = plant('generator', 'stop');
    const module = await p.init();
    await module.tick();
    const write = p.adapter.setForeignStateAsync.bind(p.adapter);
    let rejected = 0;
    p.adapter.setForeignStateAsync = async (key, value) => {
        if (!value && !rejected++) throw new Error('temporary transport outage');
        return write(key, value);
    };
    p.timers.shift()();
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(p.local.get(p.journal).val);
    await module.tick();
    assert.deepEqual(p.writes, [['motor.stop', true]]);
    t.mock.timers.tick(1100);
    await module.tick();
    assert.deepEqual(p.writes, [['motor.stop', true], ['motor.stop', false]]);
    assert.equal(p.local.get(p.journal).val, '');
    assert.equal(p.local.get(p.base+'.writeContractStatus').val, 'pulse-reset-complete');
});
