/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DeviceRuntime } = require('../modules/devices/lib/deviceRuntime');
const templates = require('../modules/devices/lib/templates.json').templates;
const turn = () => new Promise(resolve => setImmediate(resolve));
async function settle() { for (let i = 0; i < 20; i++) await turn(); }

test('real SolaX cadence alternates due reads with continuous EMS writes and prioritizes a new stop once', async t => {
    t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 100000 });
    const template = templates.find(value => value.id === 'ess.solax.SolaXHybridX1X3Ess');
    const objects = new Map(), states = new Map(), events = [];
    const adapter = { namespace: 'eos-admin.0', log: { debug() {}, info() {}, warn() {}, error() {} },
        setObjectNotExistsAsync: async (id, value) => { if (!objects.has(id)) objects.set(id, value); },
        extendObjectAsync: async (id, value) => objects.set(id, { ...objects.get(id), ...value }),
        getStateAsync: async id => states.get(id) || null,
        setStateAsync: async (id, value) => states.set(id, { ...value, ts: Date.now() }),
    };
    const runtime = new DeviceRuntime(adapter, { id: 'solax', templateId: template.id, protocol: 'modbusTcp', pollIntervalMs: 250, connection: {} }, template, {});
    let power = 0, inFlight = 0;
    runtime._createDriver = () => ({
        async readDatapoints() {
            assert.equal(inFlight++, 0, 'read/write operations cannot overlap');
            events.push({ kind: 'read', ts: Date.now(), value: power }); await turn(); inFlight--;
            return { bATTERY_POWER: power, sOC: 60, pV_POWER: 0 };
        },
        async writeDatapoint(dp, value) {
            assert.equal(inFlight++, 0, 'read/write operations cannot overlap');
            events.push({ kind: 'write', ts: Date.now(), dp: dp.id, value }); await turn(); inFlight--;
        },
        async disconnect() {},
    });
    t.after(async () => { await runtime.stop(); t.mock.timers.reset(); });
    await runtime.initObjects(); await runtime.start();
    const write = value => runtime.handleStateChange('eos-admin.0.devices.solax.aliases.v1.ctrl.powerSetpointW', { val: value, ack: false });
    await write(1000); t.mock.timers.tick(1000); await settle();
    assert.equal(events.at(-1).kind, 'write'); assert.equal(events.at(-1).value, 1000);
    await write(0); t.mock.timers.tick(1000); await settle();
    assert.equal(events.at(-1).kind, 'write', 'new stop keeps priority over one overdue read');
    assert.equal(events.at(-1).value, 0);
    power = -500;
    await write(0); t.mock.timers.tick(1000); await settle();
    assert.equal(events.at(-1).kind, 'read', 'repeated stop cannot starve telemetry');
    assert.equal(states.get('devices.solax.aliases.v1.r.power').val, -500);
    power = 500;
    for (let i = 0; i < 6; i++) { await write(0); t.mock.timers.tick(1000); await settle(); }
    assert.equal(states.get('devices.solax.aliases.v1.r.power').val, 500);
    assert.ok(Date.now() - states.get('devices.solax.aliases.v1.r.power').ts <= 2000);
    const cycleEvents = events.slice(1);
    for (let i = 1; i < cycleEvents.length; i++) assert.ok(cycleEvents[i].ts - cycleEvents[i - 1].ts >= 1000);
    assert.ok(cycleEvents.filter(event => event.kind === 'read').length >= 3);
    assert.ok(cycleEvents.filter(event => event.kind === 'write').length >= 4);
});
