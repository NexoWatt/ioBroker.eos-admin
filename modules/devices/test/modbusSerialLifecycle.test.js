/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { createRequire } = require('node:module');
const tick = () => new Promise(resolve => setImmediate(resolve));
let nextPath = 0;
function fixture() {
    const instances = [], logs = [];
    class Port extends EventEmitter {
        constructor() { super(); this.isOpen = false; this.openCallback = null; this.closeCallback = null; instances.push(this); }
        open(callback) { this.openCallback = callback; }
        connectRTUBuffered(_path, _options, callback) { this.open(callback); }
        close(callback) { this.closeCallback = callback; }
        finishOpen() { this.isOpen = true; const callback = this.openCallback; this.openCallback = null; callback(); }
        finishClose(error) { if (!error) this.isOpen = false; const callback = this.closeCallback; this.closeCallback = null; callback(error); }
    }
    function load(name) {
        const file = path.resolve(__dirname, '../lib/drivers', name + '.js');
        const localRequire = createRequire(file), moduleValue = { exports: {} };
        vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
            module: moduleValue, exports: moduleValue.exports, Buffer, setTimeout, clearTimeout,
            require(id) {
                if (id === 'modbus-serial') return Port;
                if (id === 'serialport') return { SerialPort: Port };
                return localRequire(id);
            },
        }, { filename: file });
        return moduleValue.exports;
    }
    return { rtu: load('modbusRtuBus'), ascii: load('modbusAsciiBus'), instances,
        opts: { path: '/fixture/serial-review-' + ++nextPath, baudRate: 9600 },
        adapter: { log: { info() {}, warn: value => logs.push(value) } }, logs };
}
for (const type of ['rtu', 'ascii']) {
    test(`${type}: identical device settings share one bus and an intermediate release cannot close it`, async () => {
        const f = fixture(), api = f[type];
        const a = api.acquireBus(f.adapter, f.opts), b = api.acquireBus(f.adapter, f.opts);
        assert.equal(a.bus, b.bus);
        const starting = a.bus.ensureConnected(); await tick(); f.instances[0].finishOpen(); await starting;
        await api.releaseBus(a.key); assert.equal(f.instances[0].closeCallback, null);
        assert.equal(b.bus.connected, true);
        const stopping = api.releaseBus(b.key); await tick();
        f.instances[0].finishClose(); await stopping;
    });
    test(`${type}: final release waits for a pending open and close callback; replacement stays fenced`, async () => {
        const f = fixture(), api = f[type];
        const first = api.acquireBus(f.adapter, f.opts);
        const opening = first.bus.ensureConnected();
        const cancelled = assert.rejects(opening, { code: 'E_MODBUS_SERIAL_CLOSING' });
        await tick(); let stopped = false;
        const closing = api.releaseBus(first.key).then(() => { stopped = true; });
        assert.throws(() => api.acquireBus(f.adapter, f.opts), { code: 'E_MODBUS_SERIAL_CLOSING' });
        assert.throws(() => api.acquireBus(f.adapter, { ...f.opts, baudRate: 19200 }), { code: 'E_MODBUS_SERIAL_PORT_BUSY' });
        assert.equal(stopped, false); assert.equal(f.instances[0].closeCallback, null);
        f.instances[0].finishOpen(); await cancelled; await tick();
        assert.equal(stopped, false); assert.ok(f.instances[0].closeCallback);
        f.instances[0].finishClose(); await closing;
        const next = api.acquireBus(f.adapter, f.opts); assert.notEqual(next.bus, first.bus);
        await api.releaseBus(next.key);
    });
    test(`${type}: close failure cannot release the port or start a second bus`, async () => {
        const f = fixture(), api = f[type], first = api.acquireBus(f.adapter, f.opts);
        const opening = first.bus.ensureConnected(); await tick(); f.instances[0].finishOpen(); await opening;
        const rejected = assert.rejects(api.releaseBus(first.key), /fixture close failure/); await tick();
        f.instances[0].finishClose(new Error('fixture close failure')); await rejected;
        assert.throws(() => api.acquireBus(f.adapter, f.opts), { code: 'E_MODBUS_SERIAL_CLOSING' });
        assert.throws(() => f[type === 'rtu' ? 'ascii' : 'rtu'].acquireBus(f.adapter, f.opts), { code: 'E_MODBUS_SERIAL_PORT_BUSY' });
        assert.deepEqual(f.logs, ['EOS_MODBUS_SERIAL_STOP_UNCONFIRMED']);
        assert.equal(f.instances.length, 1);
    });
    test(`${type}: stalled close times out but the lease remains until genuine late confirmation`, async () => {
        const f = fixture(), api = f[type], first = api.acquireBus(f.adapter, f.opts);
        const opening = first.bus.ensureConnected(); await tick(); f.instances[0].finishOpen(); await opening;
        await assert.rejects(api.releaseBus(first.key), { code: 'E_MODBUS_SERIAL_STOP_TIMEOUT' });
        assert.throws(() => api.acquireBus(f.adapter, f.opts), { code: 'E_MODBUS_SERIAL_CLOSING' });
        f.instances[0].finishClose(); await tick();
        const next = api.acquireBus(f.adapter, f.opts); await api.releaseBus(next.key);
    });
}
test('RTU and ASCII or different baud rates cannot own one configured path concurrently', async () => {
    const f = fixture(), first = f.rtu.acquireBus(f.adapter, f.opts);
    assert.throws(() => f.ascii.acquireBus(f.adapter, f.opts), { code: 'E_MODBUS_SERIAL_PORT_BUSY' });
    assert.throws(() => f.rtu.acquireBus(f.adapter, { ...f.opts, baudRate: 19200 }), { code: 'E_MODBUS_SERIAL_PORT_BUSY' });
    await f.rtu.releaseBus(first.key);
    const second = f.ascii.acquireBus(f.adapter, f.opts); await f.ascii.releaseBus(second.key);
});
