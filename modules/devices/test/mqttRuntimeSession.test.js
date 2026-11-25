'use strict';
/** Independent review regression: actual DeviceRuntime callbacks and queue;
 * database completion and driver transport shutdown are controlled fixtures. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const req = createRequire(path.join(process.env.EOS_MQTT_RUNTIME_ROOT || root, 'package.json'));
const { DeviceRuntime } = req('./modules/devices/lib/deviceRuntime');
const { MqttCallbackQueue, runMqttMessageSession } = require('../lib/drivers/mqttPendingOperations');
const template = req('./modules/devices/lib/templates.json').templates.find(row => row.id === 'ess.tesvolt.iotGateway.mqttV2');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function fixture() {
    const held = deferred(); const entered = deferred(); const writes = [];
    let first = true; let current = true;
    const adapter = { log: { debug() {}, info() {}, warn() {}, error() {} }, async setStateAsync(id, state) {
        if (id.endsWith('.info.connection') && state.val === true && first) {
            first = false; entered.resolve(); await held.promise;
        }
        writes.push({ id, ...state });
    } };
    const runtime = new DeviceRuntime(adapter, { id: 'session-review', category: template.category, protocol: 'mqtt', connection: {} }, template, {});
    for (const dp of template.datapoints) runtime.dpById.set(dp.id, dp);
    runtime.aliasDefs = runtime._buildAliasDefinitions();
    return { runtime, writes, held, entered, current: () => current, invalidate: () => { current = false; },
        last: suffix => writes.findLast(row => row.id.endsWith(suffix))?.val };
}

for (const reconnect of [false, true]) test(`old MQTT callback cannot publish aliases beyond offline${reconnect ? ' and a following connection' : ''}`, { timeout: 2000 }, async t => {
    const f = fixture(); t.after(() => f.held.resolve());
    const old = runMqttMessageSession(f.current, () => f.runtime._handleMqttSnapshot({ aCTIVE_POWER: 12, bATTERY_SOC: 80 }, { connected: true }));
    const oldResult = old.then(() => 'completed', error => error.message);
    await f.entered.promise; f.invalidate();
    let offlineFinished = false;
    const offline = f.runtime._handleMqttConnectionState(false, 'test disconnect').then(() => { offlineFinished = true; });
    const newConnection = reconnect ? f.runtime._handleMqttConnectionState(true, '') : Promise.resolve();
    await new Promise(resolve => setImmediate(resolve));
    const offlineFinishedBeforeOldWrite = offlineFinished;
    f.held.resolve();
    const result = await oldResult; await Promise.all([offline, newConnection]);
    assert.equal(offlineFinishedBeforeOldWrite, false, 'offline completion must wait for already-submitted old DB write');
    assert.equal(result, 'E_MQTT_MESSAGE_SESSION_ENDED');
    assert.equal(f.last('.info.connection'), reconnect);
    assert.equal(f.last('.aliases.v1.comm.connected'), reconnect);
    assert.equal(f.writes.some(row => row.id.endsWith('.aliases.v1.r.power') && row.val === 12), false);
    assert.equal(f.writes.some(row => row.id.endsWith('.aliases.v1.r.soc') && row.val === 80), false);
    assert.equal(f.runtime._mqttCallbacks.pendingCount, 0);
});

test('nested offline callback can publish diagnostic aliases without a FIFO deadlock', { timeout: 2000 }, async () => {
    const f = fixture();
    f.runtime.driver = { handleOffline: async () => f.runtime._handleMqttSnapshot({}, { connected: false, diagnosticsOnly: true }) };
    await f.runtime._handleMqttConnectionState(false, 'test nested offline');
    await f.runtime._mqttCallbacks.drain();
    assert.equal(f.last('.aliases.v1.comm.connected'), false);
    assert.equal(f.runtime._mqttCallbacks.pendingCount, 0);
});

test('telemetry backlog is bounded while the final offline barrier remains ordered and observable', { timeout: 2000 }, async t => {
    const queue = new MqttCallbackQueue(); const held = deferred(); const order = [];
    t.after(() => held.resolve());
    const actions = [queue.run(async () => { await held.promise; order.push('first'); })];
    for (let i = 1; i < 32; i++) actions.push(queue.run(async () => { order.push(i); }));
    await assert.rejects(queue.run(async () => { order.push('overflow'); }), /E_MQTT_CALLBACK_BACKLOG/);
    const offline = queue.run(async () => { order.push('offline'); }, 'barrier');
    assert.equal(queue.pendingCount, 33);
    held.resolve(); await Promise.all([...actions, offline]); await queue.drain();
    assert.equal(order.length, 33); assert.equal(order.at(-1), 'offline');
    assert.equal(queue.pendingCount, 0);
});

test('an inherited async context from a completed callback cannot bypass the current FIFO owner', { timeout: 2000 }, async t => {
    const queue = new MqttCallbackQueue(); const held = deferred(); const entered = deferred(); const scheduled = deferred();
    const order = []; let inherited;
    t.after(() => held.resolve());
    await queue.run(async () => {
        setTimeout(() => {
            inherited = queue.run(async () => { order.push('inherited'); });
            scheduled.resolve();
        }, 0);
    });
    const active = queue.run(async () => { entered.resolve(); await held.promise; order.push('current'); });
    await entered.promise; await scheduled.promise;
    await new Promise(resolve => setImmediate(resolve));
    const bypassed = order.includes('inherited');
    held.resolve(); await Promise.all([active, inherited]); await queue.drain();
    assert.equal(bypassed, false, 'a stale ALS token must not admit concurrent callbacks');
    assert.deepEqual(order, ['current', 'inherited']);
});

test('runtime stop invalidates MQTT first and awaits the callback DB write before reporting stopped', { timeout: 2000 }, async t => {
    const f = fixture(); t.after(() => f.held.resolve()); f.runtime.started = true;
    f.runtime.driver = { disconnect: async () => { f.invalidate(); await f.runtime._handleMqttConnectionState(false, 'test stop'); } };
    const old = runMqttMessageSession(f.current, () => f.runtime._handleMqttSnapshot({ aCTIVE_POWER: 12 }, { connected: true }));
    const oldResult = old.then(() => 'completed', error => error.message);
    await f.entered.promise;
    let stopped = false;
    const stopping = f.runtime.stop().then(() => { stopped = true; });
    await new Promise(resolve => setImmediate(resolve));
    const stoppedBeforeWriteSettled = stopped;
    f.held.resolve(); await stopping;
    assert.equal(stoppedBeforeWriteSettled, false);
    assert.equal(await oldResult, 'E_MQTT_MESSAGE_SESSION_ENDED');
    assert.equal(f.runtime.driver, null); assert.equal(f.runtime.started, false);
    assert.equal(f.last('.info.connection'), false); assert.equal(f.last('.aliases.v1.comm.connected'), false);
    assert.equal(f.writes.some(row => row.id.endsWith('.aliases.v1.r.power') && row.val === 12), false);
});
