'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const express = require('express');

const baseDir = path.resolve(__dirname, '..');
const namespace = 'eos-admin.0';
const inputId = 'sim.0.meter.power';
const outputId = 'sim.0.relay.state';
const operatorSignalId = 'sim.0.gridOperator.active';
const heartbeatId = `${namespace}.ems.core.schedulerHeartbeatSequence`;

async function eventually(condition, diagnosis, timeoutMs = 8000) {
    const deadline = performance.now() + timeoutMs;
    do {
        if (condition()) return;
        await delay(25);
    } while (performance.now() < deadline);
    assert.fail(JSON.stringify(diagnosis()));
}

function stateValue(value, ack = true) {
    const state = value && typeof value === 'object' ? { ...value } : { val: value, ack };
    const now = Date.now();
    return { ts: now, lc: now, q: 0, ...state };
}

function matches(pattern, id) {
    if (Array.isArray(pattern)) return pattern.includes(id);
    const source = String(pattern || '*').split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp(`^${source}$`).test(id);
}

async function fixture(t, createRuntime, { startGui = true, startEms = true } = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-ems-process-'));
    const runtimePath = path.join(directory, 'runtime.cjs');
    const core = require.resolve('@iobroker/adapter-core');
    // Only the physical controller, filesystem data location and server identity
    // are synthetic. The normal packaged runtime creates its actual EMS engine.
    fs.writeFileSync(runtimePath, `const id = ${JSON.stringify(core)};
require.cache[id] = { id, filename: id, loaded: true,
    exports: { getAbsoluteInstanceDataDir: () => ${JSON.stringify(directory)} } };
module.exports = require(${JSON.stringify(path.join(baseDir, 'ui/main.js'))});\n`);
    const objects = new Map([
        [inputId, { _id: inputId, type: 'state', common: { type: 'number', unit: 'W', read: true, write: false }, native: {} }],
        [outputId, { _id: outputId, type: 'state', common: { type: 'boolean', role: 'switch', read: true, write: true }, native: {} }],
        [operatorSignalId, { _id: operatorSignalId, type: 'state', common: { type: 'boolean', read: true, write: false }, native: {} }],
    ]);
    const states = new Map([[inputId, stateValue(0)], [outputId, stateValue(false)], [operatorSignalId, stateValue(false)]]);
    const leases = new Map();
    const output = [];
    const logs = [];
    let allowed = true;
    let access = { authenticated: false };
    let outputBarrier;
    let runtime;

    const config = {
        eosUi: {
            enableChargingManagement: true,
            enableThresholdControl: true,
            schedulerIntervalMs: 1000,
            history: { enabled: false },
            chargingManagement: { enabled: true, wallboxes: [] },
            emsApps: { schemaVersion: 1, apps: {
                charging: { installed: true, enabled: true }, threshold: { installed: true, enabled: true },
                para14a: { installed: true, enabled: true },
            } },
            installerConfig: { para14a: true, para14aMode: 'direct', para14aActiveId: operatorSignalId,
                para14aSignalMaxAgeSec: 60, para14aLegacyDirectWritesEnabled: false },
            threshold: { rules: [{ enabled: true, name: 'Simulated relay', compare: 'above', threshold: 100,
                inputId, outputId, outputType: 'boolean', onValue: true, offValue: false,
                // A low-voltage test indicator, not a controllable electrical load.
                safetyRelevant: false, userCanToggle: false, userCanSetThreshold: false, maxAgeMs: 10000 }] },
        },
        port: 443,
        secure: true,
    };
    function writeState(id, state, source) {
        const previous = states.get(id);
        states.set(id, state);
        if (id === outputId && source === 'controller') output.push({ value: state.val, ack: state.ack });
        if (runtime && [...leases.values()].some(pattern => matches(pattern, id)) &&
            (!previous || !Object.is(previous.val, state.val) || previous.ack !== state.ack || previous.q !== state.q || source === 'fixture')) {
            runtime.onStateChange(id, state);
        }
    }
    const owner = {
        namespace, instance: 0, config,
        log: Object.fromEntries(['info', 'warn', 'error', 'debug', 'silly'].map(level => [level, message => logs.push({ level, message })])),
        async getForeignObjectAsync(id) {
            if (id === 'system.config') return { _id: id, type: 'config', common: { language: 'de' }, native: { secret: 'no-real-credentials' } };
            if (id === `system.adapter.${namespace}`) return { _id: id, type: 'instance', common: { enabled: true }, native: config };
            return objects.get(id) || null;
        },
        async getForeignObjectsAsync(pattern) { return Object.fromEntries([...objects].filter(([id]) => matches(pattern, id))); },
        async getObjectViewAsync(_design, type, range = {}) {
            return { rows: [...objects].filter(([id, obj]) => (!range.startkey || id >= range.startkey) &&
                (!range.endkey || id <= range.endkey) && (type !== 'instance' || obj.type === 'instance'))
                .map(([id, value]) => ({ id, value })) };
        },
        async getForeignStateAsync(id) { return states.get(id) || null; },
        async getForeignStatesAsync(pattern) { return Object.fromEntries([...states].filter(([id]) => matches(pattern, id))); },
        async setForeignObjectAsync(id, value) { objects.set(id, { ...value, _id: id }); },
        async setForeignObjectNotExistsAsync(id, value) { if (!objects.has(id)) await owner.setForeignObjectAsync(id, value); },
        async extendForeignObjectAsync(id, value) { await owner.setForeignObjectAsync(id, { ...objects.get(id), ...value }); },
        async delForeignObjectAsync(id) { objects.delete(id); },
        async delForeignStateAsync(id) { states.delete(id); },
        async setForeignStateAsync(id, value, ack) {
            if (id === outputId && outputBarrier) await outputBarrier();
            writeState(id, stateValue(value, ack), 'controller');
        },
        async setForeignStateChangedAsync(id, value, ack) {
            if (!Object.is(states.get(id)?.val, stateValue(value, ack).val)) await owner.setForeignStateAsync(id, value, ack);
        },
        async subscribeForeignObjectsAsync() {},
        async unsubscribeForeignObjectsAsync() {},
        async subscribeForeignStatesAsync() {},
        async unsubscribeForeignStatesAsync() {},
        async getUserID(user) { return user; },
        sendTo(_target, _command, _message, callback) {
            if (typeof callback === 'function') callback({ result: [], error: 'FIXTURE_ADAPTER_UNAVAILABLE' });
        },
        eosMigration: { async saveUi(value) { config.eosUi = value; } },
        eosStateSubscriptions: { async acquireHost(pattern) {
            const lease = Symbol(pattern);
            leases.set(lease, pattern);
            return async () => { leases.delete(lease); };
        } },
    };
    const bridge = {
        canWrite: () => allowed,
        originAllowed: () => true,
        isListening: () => true,
        getLicense: () => ({ valid: true, coreEnabled: true, edition: 'home', limits: { chargePoints: 3, batteries: 2 }, features: ['energy', 'smartHome'] }),
        resolveAccess: async () => access,
        deviceEmsConfigChanged() {},
        deviceEmsPlan: async () => ({ statuses: [], config: {} }),
    };
    runtime = createRuntime(owner, bridge, { baseDir, runtimePath, restartDelayMs: 25 });
    t.after(async () => {
        try { await runtime.stop(); } finally { fs.rmSync(directory, { recursive: true, force: true }); }
    });
    const diagnosis = () => ({ status: runtime.status(), subscriptions: [...leases.values()].slice(-20),
        heartbeat: states.get(heartbeatId)?.val, threshold: states.get(`${namespace}.threshold.rules.r1.status`)?.val,
        operatorSignal: states.get(`${namespace}.para14a.signalStatus`)?.val,
        output: output.slice(-10), logs: logs.slice(-12) });
    try {
        if (startGui) await runtime.start();
        if (startEms) await runtime.startEms?.();
        await runtime.startOperational();
    } catch (error) {
        assert.fail(JSON.stringify({ error: error.message, ...diagnosis() }));
    }
    const app = express();
    app.use((request, response, next) => runtime.handle(request, response, next));
    app.use((_request, response) => response.status(404).end());
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const url = `http://127.0.0.1:${server.address().port}`;
    return { runtime, leases, states, objects, output, diagnosis,
        request(pathname, options = {}) { return fetch(`${url}${pathname}`, { redirect: 'manual', signal: AbortSignal.timeout(3500), ...options }); },
        authorize(role, capabilities) {
            access = { authenticated: true, role, capabilities, user: `system.user.${role}`,
                csrfToken: '0'.repeat(64), credentialKey: 'fixture-revision' };
        },
        pauseOutput(barrier) { outputBarrier = barrier; },
        denyWrites() { allowed = false; },
        injectInput(value, overrides = {}) { writeState(inputId, stateValue({ val: value, ack: true, ...overrides }), 'fixture'); },
        injectOperatorSignal(active) { writeState(operatorSignalId, stateValue(active), 'fixture'); },
    };
}

const createSplitRuntime = (...args) => require('../build/lib/eosSplitRuntime').createEosSplitRuntime(...args);
const guiProcess = fixture => fixture.runtime.status().ui.process;
const emsProcess = fixture => fixture.runtime.status().ems.process;
const heartbeat = fixture => Number(fixture.states.get(heartbeatId)?.val ?? 0);
const inputLeases = fixture => [...fixture.leases.values()].filter(pattern => matches(pattern, inputId)).length;

test('real EMS ticks and drives one simulated relay while the GUI is frozen, stopped, and crashed',
    { skip: process.platform === 'win32' ? 'POSIX process stop and continue are required' : false, timeout: 45000 }, async t => {
        const f = await fixture(t, createSplitRuntime, { startGui: false, startEms: false });
        await eventually(() => f.runtime.status().emsReady === true && heartbeat(f) > 0, f.diagnosis);
        const ems = emsProcess(f);
        assert.equal(guiProcess(f).pid, null, 'EMS boot completes before the GUI has ever started');
        await f.runtime.start();
        const gui = guiProcess(f);
        assert.ok(gui.pid > 0 && ems.pid > 0);
        assert.equal(new Set([process.pid, gui.pid, ems.pid]).size, 3);
        assert.equal(inputLeases(f), 1, 'only the EMS takes the subscribed simulated meter');
        assert.equal((await f.request('/static/login.js')).status, 200);

        const before = heartbeat(f);
        process.kill(gui.pid, 'SIGSTOP');
        try {
            f.injectInput(200);
            await eventually(() => heartbeat(f) > before && f.output.some(row => row.value === true && row.ack === false),
                f.diagnosis, 4000);
            assert.equal(guiProcess(f).pid, gui.pid, 'the old GUI still exists and is frozen');
            assert.equal(emsProcess(f).pid, ems.pid);
            assert.equal(emsProcess(f).generation, ems.generation);
        } finally {
            try { process.kill(gui.pid, 'SIGCONT'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
        }

        await f.runtime.pause();
        assert.equal(guiProcess(f).pid, null);
        assert.equal(emsProcess(f).pid, ems.pid);
        assert.equal(inputLeases(f), 1, 'GUI shutdown may release only its own subscriptions');
        assert.equal((await f.request('/static/login.js')).status, 503);
        f.authorize('installer', ['frontend.open', 'mapping.edit']);
        assert.equal((await f.request('/api/state')).status, 200, 'the operational HTTP contract is still served by the EMS');
        const whileStopped = heartbeat(f);
        f.injectInput(40);
        f.injectOperatorSignal(true);
        await eventually(() => heartbeat(f) > whileStopped && f.output.at(-1)?.value === false &&
            f.states.get(`${namespace}.para14a.active`)?.val === true &&
            f.states.get(`${namespace}.para14a.signalFresh`)?.val === true, f.diagnosis);

        await f.runtime.resume();
        const restarted = guiProcess(f);
        assert.notEqual(restarted.pid, gui.pid);
        assert.ok(restarted.generation > gui.generation);
        assert.equal(emsProcess(f).pid, ems.pid);
        assert.equal(emsProcess(f).generation, ems.generation);
        assert.equal(inputLeases(f), 1);
        assert.equal((await f.request('/static/login.js')).status, 200);

        const beforeCrash = heartbeat(f);
        process.kill(restarted.pid, 'SIGKILL');
        f.injectInput(200);
        await eventually(() => guiProcess(f).state === 'running' && guiProcess(f).generation > restarted.generation &&
            heartbeat(f) > beforeCrash && f.output.at(-1)?.value === true, f.diagnosis);
        assert.notEqual(guiProcess(f).pid, restarted.pid);
        assert.equal(emsProcess(f).pid, ems.pid);
        assert.equal(emsProcess(f).generation, ems.generation);
        f.injectInput(40);
        await eventually(() => f.output.at(-1)?.value === false, f.diagnosis);
        assert.deepEqual(f.output, [true, false, true, false].map(value => ({ value, ack: false })));

        // The current parent authority matters, even while a ready EMS worker still
        // holds its last issued lease. No admitted actuator write follows revocation.
        f.denyWrites();
        f.injectInput(200);
        await delay(1500);
        assert.equal(f.runtime.status().ems.canWrite, false);
        assert.equal(f.output.length, 4);
    });

test('stopping only EMS drains an accepted write before restarting, while the authorized GUI picker stays available',
    { timeout: 45000 }, async t => {
        const f = await fixture(t, createSplitRuntime);
        await eventually(() => f.runtime.status().emsReady === true && heartbeat(f) > 0, f.diagnosis);
        const oldGui = guiProcess(f);
        const oldEms = emsProcess(f);
        let admitted = 0;
        let release;
        const pending = new Promise(resolve => { release = resolve; });
        f.pauseOutput(() => { admitted++; return pending; });
        let paused, resumed;
        try {
            f.injectInput(200);
            await eventually(() => admitted === 1, f.diagnosis);
            let resumeFinished = false;
            paused = f.runtime.pauseEms();
            resumed = f.runtime.resumeEms().then(() => { resumeFinished = true; });
            // Attach handlers before other awaits, surfacing any error after cleanup.
            void paused.catch(() => undefined);
            void resumed.catch(() => undefined);
            f.injectInput(40);
            await eventually(() => f.runtime.status().ems.canWrite === false, f.diagnosis);
            assert.equal(resumeFinished, false);
            assert.equal(emsProcess(f).generation, oldEms.generation);
            assert.equal(guiProcess(f).pid, oldGui.pid);

            const picker = '/api/smarthome/dpsearch?q=sim.0.meter.power';
            assert.equal((await f.request(picker)).status, 401);
            f.authorize('customer', ['frontend.open']);
            assert.equal((await f.request(picker)).status, 403);
            f.authorize('installer', ['frontend.open', 'mapping.edit']);
            const response = await f.request(picker);
            assert.equal(response.status, 200, await response.clone().text());
            assert.deepEqual((await response.json()).results.map(result => result.id), [inputId]);
            assert.equal((await f.request('/static/login.js')).status, 200);
            assert.equal(resumeFinished, false, 'new generation waits behind the controller write');
            assert.equal(admitted, 1, 'no duplicate old relay command is admitted');
        } finally {
            f.pauseOutput(undefined);
            release();
            await Promise.all([paused, resumed]);
        }

        await eventually(() => f.runtime.status().emsReady === true, f.diagnosis);
        const next = emsProcess(f);
        assert.ok(next.generation > oldEms.generation);
        assert.notEqual(next.pid, oldEms.pid);
        assert.throws(() => process.kill(oldEms.pid, 0), { code: 'ESRCH' });
        assert.equal(guiProcess(f).pid, oldGui.pid);
        assert.equal(inputLeases(f), 1);
        // The tester supplied a fresh low input before restart. New generation
        // receives that measurement and only sends the required off command.
        await eventually(() => f.output.at(-1)?.value === false, f.diagnosis);
        assert.deepEqual(f.output, [{ value: true, ack: false }, { value: false, ack: false }]);

        f.injectInput(200);
        await eventually(() => f.output.at(-1)?.value === true, f.diagnosis);
        const stale = Date.now() - 60000;
        f.injectInput(200, { ts: stale, lc: stale });
        await eventually(() => f.output.at(-1)?.value === false &&
            f.states.get(`${namespace}.threshold.rules.r1.status`)?.val === 'stale-safe-stop', f.diagnosis);
    });

test('an EMS crash blocks manual starts until its accepted write completes, then recovers automatically',
    { timeout: 45000 }, async t => {
        const f = await fixture(t, createSplitRuntime);
        await eventually(() => f.runtime.status().emsReady === true && heartbeat(f) > 0, f.diagnosis);
        const oldEms = emsProcess(f);
        const guiPid = guiProcess(f).pid;
        let admitted = 0;
        let release;
        const pending = new Promise(resolve => { release = resolve; });
        f.pauseOutput(() => { admitted++; return pending; });
        try {
            f.injectInput(200);
            await eventually(() => admitted === 1, f.diagnosis);
            process.kill(oldEms.pid, 'SIGKILL');
            // The parent's subscription cleanup has already finished here. The
            // outstanding write itself must still stop the explicit launch.
            await eventually(() => emsProcess(f).pid === null &&
                emsProcess(f).lastError === 'EOS_UI_PROCESS_WRITE_COMPLETION_UNKNOWN', f.diagnosis);
            await assert.rejects(f.runtime.startEms(), { message: 'EOS_UI_PROCESS_STOP_UNCONFIRMED' });
            assert.equal(emsProcess(f).pid, null);
            assert.equal(emsProcess(f).generation, oldEms.generation);
            assert.equal(guiProcess(f).pid, guiPid);
            assert.equal(admitted, 1);
            assert.deepEqual(f.output, []);
            f.injectInput(40);
        } finally {
            f.pauseOutput(undefined);
            release();
        }

        await eventually(() => f.runtime.status().emsReady === true && f.output.at(-1)?.value === false, f.diagnosis);
        assert.equal(emsProcess(f).generation, oldEms.generation + 1);
        assert.equal(emsProcess(f).restarts, 1);
        assert.equal(inputLeases(f), 1);
        assert.equal(guiProcess(f).pid, guiPid);
        assert.deepEqual(f.output, [{ value: true, ack: false }, { value: false, ack: false }]);
    });

for (const outcome of ['paused', 'rejected']) {
    test(`automatic EMS recovery remains fenced when the outstanding write is ${outcome === 'paused' ? 'completed after an operator pause' : 'rejected by the controller'}`,
        { timeout: 45000 }, async t => {
            const f = await fixture(t, createSplitRuntime);
            await eventually(() => f.runtime.status().emsReady && heartbeat(f) > 0, f.diagnosis);
            const old = emsProcess(f);
            const guiPid = guiProcess(f).pid;
            let release;
            let reject;
            let admitted = 0;
            const pending = new Promise((resolve, refuse) => { release = resolve; reject = refuse; });
            f.pauseOutput(() => { admitted++; return pending; });
            try {
                f.injectInput(200);
                await eventually(() => admitted === 1, f.diagnosis);
                process.kill(old.pid, 'SIGKILL');
                await eventually(() => emsProcess(f).pid === null &&
                    emsProcess(f).lastError === 'EOS_UI_PROCESS_WRITE_COMPLETION_UNKNOWN', f.diagnosis);
                f.injectInput(40);
                if (outcome === 'paused') {
                    const paused = f.runtime.pauseEms();
                    release();
                    await paused;
                } else {
                    reject(new Error('Controller write timed out'));
                }
                // The fixture uses a 25 ms first restart delay.
                await delay(200);
                assert.equal(emsProcess(f).pid, null);
                assert.equal(emsProcess(f).generation, old.generation);
                assert.equal(emsProcess(f).restarts, 0);
                assert.equal(emsProcess(f).nextRestartAt, 0);
                assert.equal(emsProcess(f).state, outcome === 'paused' ? 'stopped' : 'failed');
                assert.equal(guiProcess(f).pid, guiPid);
                assert.deepEqual(f.output, outcome === 'paused' ? [{ value: true, ack: false }] : []);
            } finally {
                release();
                f.pauseOutput(undefined);
            }
        });
}
