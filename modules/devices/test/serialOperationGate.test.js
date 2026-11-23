'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { acquireBus, releaseBus } = require('../lib/drivers/modbusRtuBus');
const { acquireBus: acquireAscii, releaseBus: releaseAscii } = require('../lib/drivers/modbusAsciiBus');
const { runWithOperationGate } = require('../lib/operationContext');
const log = { info() {}, debug() {}, warn() {}, error() {} };
function bounded(promise) { return Promise.race([promise, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Queue deadlock')), 1000); timer.unref(); })]); }
test('disconnected RTU request reconnects without enqueueing behind itself', async () => {
    const { key, bus } = acquireBus({ log }, { path: '/dev/eos-test-rtu-a' });
    bus.client = { connectRTUBuffered(_path, _options, callback) { callback(); }, setID() {}, setTimeout() {}, async readHoldingRegisters() { return { data: [17] }; }, close(callback) { callback(); } };
    try { assert.deepEqual(await bounded(bus.readHoldingRegisters(1, 100, 0, 1)), { data: [17] }); }
    finally { releaseBus(key); }
});
test('shared RTU bus retains each queued device capability and rejects revoked commands at dispatch', async () => {
    const { key, bus } = acquireBus({ log }, { path: '/dev/eos-test-rtu-b' });
    const same = acquireBus({ log }, { path: '/dev/eos-test-rtu-b' });
    assert.equal(bus, same.bus);
    bus.connected = true;
    let release; const lock = new Promise(resolve => { release = resolve; });
    const writes = [];
    bus.client = { setID(id) { this.id = id; }, setTimeout() {}, async writeRegister(_addr, value) { writes.push({ id: this.id, value }); if (value === 1) await lock; }, close(callback) { callback(); } };
    let secondAllowed = true;
    try {
        const first = runWithOperationGate(() => true, () => bus.writeRegister(1, 100, 0, 1));
        const second = runWithOperationGate(() => secondAllowed, () => bus.writeRegister(2, 100, 0, 2));
        const third = runWithOperationGate(() => true, () => bus.writeRegister(3, 100, 0, 3));
        await new Promise(resolve => setImmediate(resolve));
        secondAllowed = false; release();
        await first;
        await assert.rejects(second, /NOT_AUTHORIZED/);
        await third;
        assert.deepEqual(writes, [{ id: 1, value: 1 }, { id: 3, value: 3 }]);
    } finally { releaseBus(key); releaseBus(same.key); }
});
test('ASCII transport rejects a queued frame after gate closure without touching serial port', async () => {
    const { key, bus } = acquireAscii({ log }, { path: '/dev/eos-test-ascii' });
    let release; bus._queue = new Promise(resolve => { release = resolve; });
    bus.connected = true;
    let writes = 0; let allowed = true;
    bus.port = { write() { writes++; }, close(callback) { callback?.(); }, removeAllListeners() {} };
    try {
        const request = runWithOperationGate(() => allowed, () => bus.writeRegister(1, 100, 0, 12));
        await new Promise(resolve => setImmediate(resolve));
        allowed = false; release();
        await assert.rejects(request, /NOT_AUTHORIZED/);
        assert.equal(writes, 0);
    } finally { releaseAscii(key); }
});
