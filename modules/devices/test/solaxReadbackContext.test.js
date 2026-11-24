/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const root = require('node:path').resolve(__dirname, '../../..');
const { DeviceRuntime } = require(root + '/modules/devices/lib/deviceRuntime');
const { ModbusDriver } = require(root + '/modules/devices/lib/drivers/modbus');
const { guardDriver } = require(root + '/modules/devices/operation-guard');
const { recordReadResponse } = require('../lib/modbusReadEvidence');
function coRead(values) {
    recordReadResponse(values, Object.keys(values));
    return values;
}
function deferred() {
    let resolve;
    const promise = new Promise(done => {
        resolve = done;
    });
    return { promise, resolve };
}
const template = require(root + '/modules/devices/lib/templates.json').templates.find(
    t => t.id === 'ess.solax.SolaXHybridX1X3Ess',
);
async function fixture(t, connection = {}) {
    const requests = [],
        sockets = new Set(),
        states = new Map(),
        objects = new Map(),
        logs = [],
        holding = { 416: 4, 417: 600, 418: 0, 419: 600, 420: 160 },
        input = { 28: 98, 56: 64936, 57: 65535, 162: 5000, 163: 0, 164: 0, 165: 0 };
    let allowed = true;
    let failCapReads = false;
    let rejectCombined = false;
    let onReply = () => {};
    const server = net.createServer(socket => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
        let buffered = Buffer.alloc(0);
        socket.on('data', data => {
            buffered = Buffer.concat([buffered, data]);
            while (buffered.length >= 7) {
                const size = 6 + buffered.readUInt16BE(4);
                if (buffered.length < size) break;
                const p = buffered.subarray(0, size);
                buffered = buffered.subarray(size);
                const fc = p[7],
                    addr = p.readUInt16BE(8);
                requests.push({
                    fc,
                    addr,
                    ...(fc === 3 || fc === 4 ? { quantity: p.readUInt16BE(10) } : {}),
                    regs:
                        fc === 16
                            ? Array.from({ length: p.readUInt16BE(10) }, (_, i) => p.readUInt16BE(13 + 2 * i))
                            : fc === 6
                              ? [p.readUInt16BE(10)]
                              : [],
                });
                let out;
                if (fc === 6) {
                    out = Buffer.from(p);
                } else if (fc === 16) {
                    out = Buffer.from(p.subarray(0, 12));
                    out.writeUInt16BE(6, 4);
                } else if (
                    (fc === 4 && addr >= 162 && addr <= 165 && failCapReads) ||
                    (fc === 3 && addr === 416 && p.readUInt16BE(10) > 1 && rejectCombined)
                ) {
                    out = Buffer.alloc(9);
                    p.copy(out, 0, 0, 7);
                    out.writeUInt16BE(3, 4);
                    out[7] = fc | 0x80;
                    out[8] = 2;
                } else if (fc === 4 || fc === 3) {
                    const count = p.readUInt16BE(10);
                    out = Buffer.alloc(9 + 2 * count);
                    p.copy(out, 0, 0, 7);
                    out.writeUInt16BE(3 + 2 * count, 4);
                    out[7] = fc;
                    out[8] = count * 2;
                    const words = fc === 3 ? holding : input;
                    for (let i = 0; i < count; i++) out.writeUInt16BE(words[addr + i] || 0, 9 + 2 * i);
                } else throw Error('Unexpected function ' + fc);
                onReply(requests.at(-1));
                socket.write(out);
            }
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const adapter = {
        namespace: 'eos-admin.0',
        log: Object.fromEntries(
            ['debug', 'info', 'warn', 'error'].map(level => [level, msg => logs.push({ level, msg })]),
        ),
        setObjectNotExistsAsync: async (id, v) => {
            if (!objects.has(id)) objects.set(id, v);
        },
        extendObjectAsync: async (id, v) => objects.set(id, { ...objects.get(id), ...v }),
        getStateAsync: async id => states.get(id) || null,
        setStateAsync: async (id, v) => states.set(id, { ...v, ts: Date.now() }),
    };
    const cfg = {
        id: 'solax',
        templateId: template.id,
        protocol: 'modbusTcp',
        connection: {
            host: '127.0.0.1',
            port: server.address().port,
            unitId: 1,
            minCommandIntervalMs: 0,
            ...connection,
        },
    };
    const runtime = new DeviceRuntime(adapter, cfg, template, {});
    await runtime.initObjects();
    const driver = guardDriver(new ModbusDriver(adapter, cfg, template, {}), () => allowed);
    runtime.driver = driver;
    t.after(async () => {
        await runtime.stop();
        for (const s of sockets) s.destroy();
        await new Promise(resolve => server.close(resolve));
    });
    return {
        runtime,
        driver,
        adapter,
        cfg,
        states,
        requests,
        logs,
        holding,
        input,
        failCaps: value => {
            failCapReads = value;
        },
        rejectCombined: value => {
            rejectCombined = value;
        },
        onReply: callback => {
            onReply = callback;
        },
        allow: v => {
            allowed = v;
        },
    };
}
test('actual SolaX AliasV1 dispatch reaches real loopback Modbus TCP as complete Mode4 block with signed W', async t => {
    const h = await fixture(t);
    const alias = 'devices.solax.aliases.v1.ctrl.powerSetpointW';
    for (const [val, words] of [
        [600, [4, 600, 0, 600, 160]],
        [-600, [4, 64936, 65535, 600, 160]],
        [0, [4, 0, 0, 600, 160]],
    ]) {
        await h.runtime.handleStateChange('eos-admin.0.' + alias, { val, ack: false });
        await h.runtime._flushWriteQueueOnce();
        assert.deepEqual(h.requests.filter(x => x.fc === 16).at(-1), { fc: 16, addr: 160, regs: words });
        assert.equal(h.states.get(alias).val, val);
        assert.equal(h.states.get(alias).ack, true);
    }
    assert.equal(h.requests[0].fc, 6);
    assert.equal(h.requests[0].addr, 0);
    // Revoke hosted capability after the valid connection; no new control packet or success ack allowed.
    const count = h.requests.length;
    h.allow(false);
    await h.runtime.handleStateChange('eos-admin.0.' + alias, { val: 700, ack: false });
    await h.runtime._flushWriteQueueOnce();
    assert.equal(h.requests.length, count);
    assert.notEqual(h.states.get(alias).val, 700);
    assert.ok(h.logs.some(x => String(x.msg).includes('EOS_DEVICES_NOT_AUTHORIZED')));
    console.log(
        JSON.stringify({
            runtime: process.version,
            wireBlocks: h.requests.filter(x => x.fc === 16),
            deniedWritePackets: 0,
        }),
    );
});
test('actual read path preserves positive discharge, 98% SoC and valid zero BMS discharge capability', async t => {
    const h = await fixture(t);
    const dp = template.datapoints.filter(x =>
        ['sOC', 'bATTERY_POWER', 'aLLOWED_CHARGE_POWER', 'aLLOWED_DISCHARGE_POWER'].includes(x.id),
    );
    const values = await h.driver.readDatapoints(dp);
    await h.runtime._updateAliases(values, { connected: true });
    assert.equal(values.bATTERY_POWER, 600);
    assert.equal(values.sOC, 98);
    assert.equal(values.aLLOWED_DISCHARGE_POWER, 0);
    assert.equal(h.states.get('devices.solax.aliases.v1.r.power').val, 600);
    assert.equal(h.states.get('devices.solax.aliases.v1.r.allowedDischargePower').val, 0);
    assert.equal(h.runtime.aliasByStateRelId.has('devices.solax.aliases.v1.r.allowDischarge'), false);
    console.log(JSON.stringify({ runtime: process.version, measured: values, zeroCapabilityPreserved: true }));
});

test('SolaX readback uses actual mode4 poll and becomes unknown after mode8 or missing current mode', async t => {
    const h = await fixture(t);
    const readback = 'devices.solax.aliases.v1.r.powerSetpointReadbackW';
    await h.runtime.handleStateChange('eos-admin.0.devices.solax.aliases.v1.ctrl.powerSetpointW', {
        val: 700,
        ack: false,
    });
    await h.runtime._flushWriteQueueOnce();
    assert.equal(h.states.get('devices.solax.sET_ACTIVE_POWER').val, 700, 'raw RW object is command-ack optimistic');
    assert.equal(h.states.has(readback), false, 'semantic readback never created by write ack');
    const dp = template.datapoints.filter(x =>
        ['sET_CONTROL_MODE', 'sET_ACTIVE_POWER', 'vPP_WAIT_TIMEOUT', 'vPP_NEXT_MOTION'].includes(x.id),
    );
    const values = await h.driver.readDatapoints(dp);
    await h.runtime._updateAliases(values, { connected: true });
    assert.equal(values.sET_CONTROL_MODE, 4);
    assert.ok(
        h.requests.some(request => request.fc === 3 && request.addr === 416 && request.quantity === 5),
        'mode and target are co-read in the same actual contiguous Modbus response',
    );
    assert.equal(h.states.get(readback).val, 600, 'readback reflects different actual wire reply');
    h.holding[416] = 8;
    h.holding[417] = 1;
    h.holding[418] = 500;
    const otherMode = await h.driver.readDatapoints(dp);
    await h.runtime._updateAliases(otherMode, { connected: true });
    assert.equal(otherMode.sET_CONTROL_MODE, 8);
    assert.equal(h.states.get(readback).val, null, 'mode8 words are not a Mode4 power target');
    await h.runtime._updateAliases({ sET_ACTIVE_POWER: 900 }, { connected: true });
    assert.equal(h.states.get(readback).val, null, 'old cached mode cannot qualify current target');
    console.log(
        JSON.stringify({
            runtime: process.version,
            rawCommandAck: 700,
            actualMode4Readback: 600,
            mode8Interpretation: null,
            interpretationRequiresMode4: true,
        }),
    );
});

test('unknown, invalid, disconnected and expired mode context never keeps a usable target or fabricates freshness', async t => {
    const h = await fixture(t),
        id = 'devices.solax.aliases.v1.r.powerSetpointReadbackW';
    let now = 1000000;
    t.mock.method(Date, 'now', () => now);
    h.runtime._liveAliasRefreshMs = 5000;
    await h.runtime._updateAliases(coRead({ sET_CONTROL_MODE: 4, sET_ACTIVE_POWER: 0 }), { connected: true });
    assert.equal(h.states.get(id).val, 0, 'actual zero is valid');
    const pairedAt = h.states.get(id).ts;
    now += 5000;
    await h.runtime._updateAliases({ bATTERY_POWER: 2 }, { connected: true });
    assert.equal(h.states.get(id).ts, pairedAt, 'unrelated live poll never refreshes readback');
    await h.runtime._ackWrittenValue(h.runtime.dpById.get('sET_CONTROL_MODE'), 4);
    await h.runtime._updateAliases({ sET_ACTIVE_POWER: 500 }, { connected: true });
    assert.equal(h.states.get(id).val, null, 'optimistic mode ack cannot qualify the target');
    for (const mode of [null, NaN, undefined, '4', 0, 8]) {
        await h.runtime._updateAliases(coRead({ sET_CONTROL_MODE: 4, sET_ACTIVE_POWER: 600 }), { connected: true });
        await h.runtime._updateAliases({ sET_CONTROL_MODE: mode, sET_ACTIVE_POWER: 600 }, { connected: true });
        assert.equal(h.states.get(id).val, null);
    }
    for (const target of [null, NaN, undefined, '600', Infinity]) {
        await h.runtime._updateAliases({ sET_CONTROL_MODE: 4, sET_ACTIVE_POWER: target }, { connected: true });
        assert.equal(h.states.get(id).val, null);
    }
    await h.runtime._updateAliases(coRead({ sET_CONTROL_MODE: 4, sET_ACTIVE_POWER: 600 }), { connected: true });
    now += h.runtime._qualifiedAliasMaxAgeMs + 1;
    await h.runtime._updateAliases({ sOC: 98 }, { connected: true });
    assert.equal(h.states.get(id).val, null, 'existing poll invalidates expired paired sample');
    await h.runtime._updateAliases(coRead({ sET_CONTROL_MODE: 4, sET_ACTIVE_POWER: 600 }), { connected: true });
    await h.runtime._updateAliases({}, { connected: false });
    assert.equal(h.states.get(id).val, null);
    await h.runtime._updateAliases(
        { sET_CONTROL_MODE: 4, sET_ACTIVE_POWER: 600 },
        { connected: true, diagnosticsOnly: true },
    );
    assert.equal(h.states.get(id).val, null, 'diagnostic cached snapshots cannot create evidence');
    await h.runtime._updateAliases(coRead({ sET_CONTROL_MODE: 4, sET_ACTIVE_POWER: 600 }), { connected: true });
    await h.runtime.stop();
    assert.equal(h.states.get(id).val, null, 'confirmed stop clears prior readback evidence');
});

test('only the exact verified mode descriptor enables contextual readback; the existing slow poll includes both fields', () => {
    const { buildSemanticAliasDefinitions } = require(root + '/modules/devices/lib/deviceAliasSemantics');
    const paths = ['sET_CONTROL_MODE', 'sET_ACTIVE_POWER'];
    const polling = template.driverHints.polling;
    assert.equal(polling.fastDpIds.includes(paths[0]), polling.fastDpIds.includes(paths[1]));
    const slow = polling.slowDpIds || template.datapoints.map(dp => dp.id);
    for (const id of paths) assert.ok(slow.includes(id));
    for (const mutation of [
        t =>
            t.datapoints.splice(
                t.datapoints.findIndex(dp => dp.id === 'sET_CONTROL_MODE'),
                1,
            ),
        t => {
            t.datapoints.find(dp => dp.id === 'sET_CONTROL_MODE').source.read.address = 123;
        },
        t => {
            t.datapoints.find(dp => dp.id === 'sET_CONTROL_MODE').type = 'string';
        },
    ]) {
        const copy = structuredClone(template);
        mutation(copy);
        const result = buildSemanticAliasDefinitions({ baseId: 'devices.solax', template: copy });
        assert.equal(result.coverage['r.powerSetpointReadbackW'].status, 'unavailable');
        assert.equal(result.coverage['r.powerSetpointReadbackW'].reason, 'readContextDescriptorChanged');
    }
});

for (const split of ['isolated', 'adaptive', 'maxReadRegs']) {
    test(`separate ${split} register replies cannot combine old mode4 with mode8 target words`, async t => {
        const h = await fixture(
            t,
            split === 'isolated' ? { isolateReadDatapoints: true } : split === 'maxReadRegs' ? { maxReadRegs: 2 } : {},
        );
        if (split === 'adaptive') h.rejectCombined(true);
        h.onReply(request => {
            if (request.fc === 3 && request.addr === 416 && request.quantity === 1) {
                h.holding[416] = 8;
                h.holding[417] = 1;
                h.holding[418] = 500;
            }
        });
        const dp = template.datapoints.filter(x => ['sET_CONTROL_MODE', 'sET_ACTIVE_POWER'].includes(x.id));
        const values = await h.driver.readDatapoints(dp);
        assert.equal(values.sET_CONTROL_MODE, 4);
        assert.equal(values.sET_ACTIVE_POWER, 32768001, 'raw words expose the conflicting layout');
        await h.runtime._updateAliases(values, { connected: true });
        assert.equal(h.states.get('devices.solax.aliases.v1.r.powerSetpointReadbackW').val, null);
        assert.ok(h.requests.some(request => request.fc === 3 && request.addr === 417 && request.quantity === 2));
        assert.equal(
            h.requests.some(request => request.fc === 6 || request.fc === 16),
            false,
        );
    });
}

test('even a full cached copy cannot manufacture the actual response provenance', async t => {
    const h = await fixture(t);
    const values = await h.driver.readDatapoints(
        template.datapoints.filter(x => ['sET_CONTROL_MODE', 'sET_ACTIVE_POWER'].includes(x.id)),
    );
    const readback = 'devices.solax.aliases.v1.r.powerSetpointReadbackW';
    await h.runtime._updateAliases(values, { connected: true });
    assert.equal(h.states.get(readback).val, 600);
    await h.runtime._updateAliases({ ...values }, { connected: true });
    assert.equal(h.states.get(readback).val, null);
});

for (const pauseAtReadback of [false, true]) {
    test(`stop drains ${pauseAtReadback ? 'submitted readback' : 'earlier alias'} work without reviving an old sample`, async t => {
        const h = await fixture(t);
        const readback = 'devices.solax.aliases.v1.r.powerSetpointReadbackW';
        const reached = deferred(),
            resume = deferred();
        const original = h.adapter.setStateAsync;
        let once = true;
        h.adapter.setStateAsync = async (id, state) => {
            if (once && (pauseAtReadback ? id === readback : id !== readback)) {
                once = false;
                reached.resolve();
                await resume.promise;
            }
            return original(id, state);
        };
        const update = h.runtime._updateAliases(coRead({ sET_CONTROL_MODE: 4, sET_ACTIVE_POWER: 600, sOC: 98 }), {
            connected: true,
        });
        await reached.promise;
        let stopFinished = false;
        const stop = h.runtime.stop().then(() => {
            stopFinished = true;
        });
        if (pauseAtReadback) {
            await new Promise(resolve => setImmediate(resolve));
            assert.equal(stopFinished, false, 'confirmed stop waits for the submitted readback DB write');
        } else {
            await stop;
        }
        resume.resolve();
        await Promise.all([update, stop]);
        assert.equal(
            h.states.get(readback).val,
            null,
            'old operation cannot restore a fresh numeric target after stop',
        );
    });
}

test('real unchanged BMS caps stay fresh beyond 60s, while failed/skipped/unrelated polls do not renew them', async t => {
    const h = await fixture(t);
    h.input[164] = 9566;
    let now = 1000000;
    t.mock.method(Date, 'now', () => now);
    h.runtime._liveAliasRefreshMs = 3000;
    const ids = ['sOC', 'aLLOWED_CHARGE_POWER', 'aLLOWED_DISCHARGE_POWER'];
    const dp = template.datapoints.filter(x => ids.includes(x.id));
    const path = 'devices.solax.aliases.v1.r.allowedDischargePower';
    for (let i = 0; i <= 25; i++) {
        const values = await h.driver.readDatapoints(dp);
        await h.runtime._updateAliases(values, { connected: true });
        assert.equal(h.states.get(path).val, 9566, 'healthy constant numeric limit remains available');
        assert.equal(h.states.get('devices.solax.aliases.v1.r.allowedChargePower').val, 5000);
        assert.equal(h.states.get('devices.solax.aliases.v1.r.allowedChargePower').ts, now);
        assert.equal(h.states.get(path).ts, now, 'real constant samples renew freshness at the existing cadence');
        now += 3000;
    }
    const sampleAt = h.states.get(path).ts;
    const capsRequests = h.requests.filter(request => request.fc === 4 && request.addr === 162);
    assert.equal(capsRequests.length, 26);
    assert.ok(
        capsRequests.every(request => request.quantity === 4),
        'one contiguous cap read per cycle',
    );
    h.failCaps(true);
    await h.runtime._updateAliases(await h.driver.readDatapoints(dp), { connected: true });
    assert.equal(h.states.get(path).ts, sampleAt, 'failed optional response must not renew the cap');
    const failedRequests = h.requests.length;
    now += 3000;
    await h.runtime._updateAliases(await h.driver.readDatapoints(dp), { connected: true });
    assert.equal(h.states.get(path).ts, sampleAt, 'skipped optional response must not renew the cap');
    assert.ok(h.requests.slice(failedRequests).every(request => request.addr !== 162));
    now += 3000;
    await h.runtime._updateAliases({ sOC: 98 }, { connected: true });
    assert.equal(h.states.get(path).ts, sampleAt);
});

test('runtime fast scheduler includes only the two existing numeric cap sources without speeding up the full map', async t => {
    const h = await fixture(t);
    const polled = [];
    const timeouts = new Map();
    let now = 1000000;
    t.mock.method(Date, 'now', () => now);
    // Exercise production scheduling while the transport is controlled separately
    // by the real TCP test above. No real time, socket, or physical write is needed.
    t.mock.method(global, 'setTimeout', (fn, delay) => {
        const token = {};
        timeouts.set(token, { fn, delay });
        return token;
    });
    t.mock.method(global, 'clearTimeout', token => timeouts.delete(token));
    h.runtime._startHeartbeatChecker = () => {};
    h.runtime._createDriver = () => ({
        async disconnect() {},
        async readDatapoints(dps) {
            polled.push(dps.map(dp => dp.id));
            return { sOC: 98, aLLOWED_CHARGE_POWER: 5000, aLLOWED_DISCHARGE_POWER: 9566 };
        },
    });
    await h.runtime.start();
    assert.deepEqual(
        polled[0],
        template.datapoints.map(dp => dp.id),
        'startup retains the full initial poll',
    );
    for (let i = 0; i < 3; i++) {
        const timer = timeouts.get(h.runtime.pollTimer);
        assert.ok(timer);
        assert.equal(timer.delay, 1000, 'existing command cadence is unchanged');
        timeouts.delete(h.runtime.pollTimer);
        now += timer.delay;
        timer.fn();
        await new Promise(resolve => setImmediate(resolve));
    }
    assert.equal(polled.length, 2, 'fast read remains every 3s; no added loop or extra full poll');
    const expected = new Set([
        ...template.driverHints.polling.fastDpIds,
        'aLLOWED_CHARGE_POWER',
        'aLLOWED_DISCHARGE_POWER',
    ]);
    assert.deepEqual(new Set(polled[1]), expected);
    assert.equal(polled[1].includes('sET_CONTROL_MODE'), false, 'unrelated slow mode polling stays slow');
    await h.runtime.stop();
    assert.equal(timeouts.size, 0);
});
