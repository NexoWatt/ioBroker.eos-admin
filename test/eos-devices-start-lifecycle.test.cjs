/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { EosModuleHost } = require('../src/lib/eosModuleHost');
const deviceModule = require('../modules/devices');
const { DeviceRuntime } = require('../modules/devices/lib/deviceRuntime');

function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
const turn = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate) { for (let i = 0; i < 200; i++) { if (predicate()) return; await turn(); } assert.fail('lifecycle milestone missing'); }

function fixture(t, options = {}) {
    const profiles = options.profiles || [
        ['ess1', 'ess.fenecon.FeneconHomeEssImpl', 'modbusTcp'],
        ['ess2', 'ess.solax.Ems1000ModbusTcp', 'modbusTcp'],
        ['meter1', 'meter.sma.SmaEnergyMeterSpeedwireImpl', 'speedwire'],
    ];
    const objects = new Map(), states = new Map(), runtimes = [], reads = [], closes = [], logs = [];
    let objectOperations = 0;
    const objectOperation = async (operation, id) => {
        objectOperations++;
        await options.beforeObjectWrite?.(id);
        if (options.objectDelayMs) await new Promise(resolve => setTimeout(resolve, options.objectDelayMs));
        return operation();
    };
    const gates = new Map(profiles.map(([id]) => [id, deferred()]));
    const encrypt = value => `encrypted:${Buffer.from(value).toString('base64')}`;
    const config = { enabled: true, devices: profiles.map(([id, templateId, protocol]) => ({ id, templateId, protocol, connection: {} })) };
    const owner = {
        namespace: 'eos-admin.0', instance: 0,
        config: { eosModules: { devices: { v: 1, encrypted: encrypt(JSON.stringify(config)) } } },
        encrypt, decrypt: value => Buffer.from(value.slice(10), 'base64').toString(),
        log: Object.fromEntries(['warn', 'info', 'debug', 'error'].map(level => [level, message => logs.push({ level, message })])),
        eosLicenseService: { allowsEmbeddedModule: () => true }, eosOwnership: { canWrite: () => true },
        getObjectViewAsync: async () => ({ rows: [] }),
        getForeignObjectAsync: async id => objects.get(id) || null,
        getForeignStateAsync: async id => states.get(id) || null,
        getForeignObjectsAsync: async pattern => Object.fromEntries([...objects].filter(([id]) => id.startsWith(pattern.replace(/\*$/, '')))),
        setForeignObjectAsync: async (id, value) => objectOperation(() => objects.set(id, { ...structuredClone(value), _id: id }), id),
        setForeignObjectNotExistsAsync: async (id, value) => objectOperation(() => { if (!objects.has(id)) objects.set(id, { ...structuredClone(value), _id: id }); }, id),
        extendForeignObjectAsync: async (id, value) => objectOperation(() => objects.set(id, { ...objects.get(id), ...structuredClone(value), _id: id }), id),
        setForeignStateAsync: async (id, value, ack) => states.set(id, { ...(value && typeof value === 'object' ? value : { val: value, ack }), ts: Date.now() }),
        subscribeForeignObjectsAsync: async () => {}, subscribeForeignStatesAsync: async () => {}, unsubscribeForeignStatesAsync: async () => {},
    };
    const factory = { ...deviceModule, createHostedModule: options => deviceModule.createHostedModule({ ...options,
        runtimeFactory: (device, template) => {
            const runtime = new DeviceRuntime(options.adapter, device, template, options.config);
            // Only the physical driver is replaced. Alias provisioning, start,
            // first-read handling, scheduler and stop are production runtime code.
            runtime._createDriver = () => ({ lastSeen: 0,
                async readDatapoints() { reads.push(device.id); return gates.get(device.id).promise; },
                async disconnect() { closes.push(device.id); },
            });
            runtimes.push(runtime); return runtime;
        },
    }) };
    const host = new EosModuleHost(owner, { baseDir: path.resolve(__dirname, '..'), dataDir: '/tmp/eos-start-regression', factories: { devices: factory } });
    t.after(async () => { for (const gate of gates.values()) gate.resolve({});
        if (options.expectedStopFailure) await assert.rejects(host.stop(), { code: 'EOS_MODULE_STOP_UNCONFIRMED' });
        else await host.stop();
    });
    return { host, states, objects, runtimes, reads, closes, gates, logs, objectOperations: () => objectOperations };
}

test('real host starts three real device profiles while their first physical responses are still pending', async t => {
    const f = fixture(t);
    const started = f.host.start();
    let timer;
    try {
        await Promise.race([started, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('First network responses blocked module startup')), 2000); })]);
    } finally { clearTimeout(timer); }
    assert.equal((await f.host.status('devices')).active, true);
    assert.equal(f.runtimes.length, 3);
    await until(() => f.reads.length === 3);
    assert.deepEqual([...new Set(f.reads)].sort(), ['ess1', 'ess2', 'meter1']);
    for (const runtime of f.runtimes) {
        assert.equal(runtime._hbOnline, false, 'metadata readiness must not manufacture telemetry');
        assert.equal(runtime.pollTimer, null, 'no second read while first is pending');
        assert.ok(f.objects.has(`eos-admin.0.devices.${runtime.cfg.id}.aliases.meta.manifest`));
    }
    f.gates.get('ess1').resolve({ bATTERY_AC_POWER: 0, eSS_SOC_IN: 60 });
    f.gates.get('ess2').resolve({ bATTERY_POWER: 0, sOC: 50 });
    f.gates.get('meter1').resolve({});
    await Promise.all(f.runtimes.map(runtime => runtime._initialPollPromise));
    assert.equal(f.runtimes.find(runtime => runtime.cfg.id === 'ess1')._hbOnline, true);
    assert.equal(f.runtimes.find(runtime => runtime.cfg.id === 'meter1')._hbOnline, false);
    assert.equal(f.reads.length, 3);
});

test('stop drains a pending first read after disconnect and discards its late values without reopening timers', async t => {
    const f = fixture(t);
    await f.host.start(); await until(() => f.reads.length === 3);
    let completed = false;
    const stopped = f.host.stop().then(() => { completed = true; });
    await until(() => f.closes.length === 3);
    assert.equal(completed, false, 'shutdown must retain the original pending read');
    for (const gate of f.gates.values()) gate.resolve({ bATTERY_AC_POWER: 900, aCTIVE_POWER: 900 });
    await stopped;
    for (const runtime of f.runtimes) {
        assert.equal(runtime.started, false);
        assert.equal(runtime._hbOnline, false);
        assert.equal(runtime.pollTimer, null);
        assert.equal(runtime.watchdogTimer, null);
        assert.equal(runtime._initialPollPromise, null);
    }
    assert.equal(f.reads.length, 3, 'late first read must not schedule another poll');
    assert.equal([...f.states.values()].some(state => state.val === 900 || state.val === 900000), false);
});

test('three customer profiles finish bounded slow controller metadata preparation without losing the hosted start', async t => {
    const f = fixture(t, { objectDelayMs: 30, profiles: [
        ['ess1', 'ess.fenecon.FeneconHomeEssImpl', 'modbusTcp'],
        ['ess2', 'ess.solax.SolaXHybridX1X3Ess', 'modbusTcp'],
        ['meter1', 'meter.sma.SmaEnergyMeterSpeedwireImpl', 'speedwire'],
    ] });
    const start = f.host.start();
    await new Promise(resolve => setTimeout(resolve, 11000));
    const pending = await f.host.status('devices');
    assert.equal(pending.reason, 'STARTING');
    assert.equal(pending.active, false);
    assert.equal(pending.details.startup.pending, true);
    assert.ok(pending.details.startup.completedObjects > 100);
    await start;
    assert.equal((await f.host.status('devices')).active, true,
        JSON.stringify({ status: await f.host.status('devices'), operations: f.objectOperations(), logs: f.logs.slice(-8) }));
    for (const gate of f.gates.values()) gate.resolve({});
    assert.equal(f.reads.length, 3, 'all initial device reads are independently observed after metadata exists');
});

test('hung metadata IO expires after10s without progress; late completion cannot start a second controller', async t => {
    const held = deferred();
    let entered = false;
    const f = fixture(t, { expectedStopFailure: true, beforeObjectWrite: async id => {
        if (id === 'eos-admin.0.modules.devices') { entered = true; await held.promise; }
    } });
    t.after(() => held.resolve());
    const start = f.host.start();
    await until(() => entered);
    const startedAt = performance.now();
    await start;
    const failed = await f.host.status('devices');
    assert.equal(failed.active, false);
    assert.equal(failed.reason, 'STOP_FAILED_RESTART_REQUIRED');
    assert.equal(failed.details.startup.error, 'EOS_MODULE_START_IDLE_TIMEOUT');
    assert.ok(performance.now() - startedAt >= 10000);
    assert.ok(performance.now() - startedAt < 15500, 'unchanged3.5s stop deadline bounds hung accepted IO');
    held.resolve();
    await new Promise(resolve => setTimeout(resolve, 300));
    await f.host.reconcile();
    assert.equal(f.runtimes.length, 0);
    assert.equal((await f.host.status('devices')).active, false);
});

test('continuous successful metadata progress cannot exceed the fixed120s total startup limit', async t => {
    // Unit-level monotonic-clock injection proves the hard cap without making
    // every suite wait two minutes. Actual host idle/cancel paths are separate.
    let now = 1000;
    t.mock.method(performance, 'now', () => now);
    const pending = deferred();
    const startup = { generation: 7, startedAt: now, lastProgressAt: now, promise: pending.promise };
    const wait = EosModuleHost.prototype.waitForDevicesStart.call({ canOperate: () => true }, { id: 'devices' }, startup);
    now += 120001; startup.lastProgressAt = now;
    await assert.rejects(wait, { code: 'EOS_MODULE_START_TOTAL_TIMEOUT' });
    assert.equal(startup.cancel, null);
    pending.resolve();
});

test('cancelling metadata preparation retains the fixed stop deadline and never opens a late transport', async t => {
    const held = deferred(); let entered = false;
    const f = fixture(t, { expectedStopFailure: true, beforeObjectWrite: async id => {
        if (id === 'eos-admin.0.modules.devices') { entered = true; await held.promise; }
    } });
    t.after(() => held.resolve());
    const start = f.host.start(); await until(() => entered);
    const begin = performance.now();
    await assert.rejects(f.host.stop(), { code: 'EOS_MODULE_STOP_UNCONFIRMED' });
    assert.ok(performance.now() - begin < 4500);
    held.resolve(); await start; await turn();
    assert.equal(f.runtimes.length, 0);
    assert.equal((await f.host.status('devices')).active, false);
});
