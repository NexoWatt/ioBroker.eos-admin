/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function compile(source, filename, intercept) {
    const compiled = new Module(filename, module);
    compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename));
    const original = compiled.require.bind(compiled);
    compiled.require = name => intercept && name === './lib/hosted-runtime-stop' ? intercept
        : intercept && name === './lib/hosted-adapter' ? adapterExports : original(name);
    compiled._compile(ts.transpileModule(source, { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
    } }).outputText, filename);
    return compiled.exports;
}
const helper = compile(fs.readFileSync(path.resolve(__dirname, '../../src-ts/runtime-executables/lib/hosted-runtime-stop.ts'), 'utf8'),
    path.resolve(__dirname, '../../lib/hosted-runtime-stop.js'));
const adapterExports = compile(fs.readFileSync(path.resolve(__dirname, '../../src-ts/runtime-executables/lib/hosted-adapter.ts'), 'utf8'),
    path.resolve(__dirname, '../../lib/hosted-adapter.js'));
function deferred() {
    let resolve; let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
const turn = () => new Promise(resolve => setImmediate(resolve));

function fixture(timeout = 1000) {
    const source = fs.readFileSync(path.resolve(__dirname, '../../src-ts/runtime-executables/main.ts'), 'utf8');
    const exported = compile(source + '\nmodule.exports.TestRuntime = NexoWattVis;\n', path.resolve(__dirname, '../../main.js'),
        { ...helper, stopHostedRuntime: (pending, cleanup) => helper.stopHostedRuntime(pending, cleanup, timeout) });
    const actualOnUnload = exported.TestRuntime.prototype.onUnload;
    let instance;
    const events = [];
    exported.TestRuntime.prototype.startServer = async function () { instance = this; this._hostedApp = () => {}; events.push('shell'); };
    exported.TestRuntime.prototype.onReady = async function () { this._hostedStartup = { state: 'ready', error: '' }; this.emsEngine = {}; events.push('ready'); };
    exported.TestRuntime.prototype.onUnload = function (done) {
        events.push('cleanup'); this._nwShuttingDown = true; this._hostedOperational = false;
        this._hostedStartup = { state: 'stopped', error: '' }; done();
    };
    const writes = [];
    const owner = { namespace: 'eos-admin.0', instance: 0, config: { eosUi: {} },
        log: { error() {}, warn() {}, info() {}, debug() {} },
        setForeignStateAsync: async (...args) => writes.push(args) };
    const bridge = { canWrite: () => true, originAllowed: () => true,
        getLicense: () => ({ valid: true, coreEnabled: true, edition: 'home', features: ['energy'], limits: { chargePoints: 2, batteries: 1 } }), resolveAccess: async () => null };
    const runtime = exported.createHostedRuntime(owner, bridge);
    return { runtime, Runtime: exported.TestRuntime, events, writes, owner, actualOnUnload, instance: () => instance };
}

test('stop coordinator waits every pending startup and final cleanup before confirming quiescence', async () => {
    const shell = deferred(); const operation = deferred(); const cleanupDone = deferred(); const events = [];
    let cleanups = 0;
    const stop = helper.stopHostedRuntime([shell.promise, operation.promise], () => {
        events.push('cleanup-' + ++cleanups);
        return cleanups === 2 ? cleanupDone.promise : Promise.resolve();
    }, 1000);
    let stopped = false; void stop.then(() => { stopped = true; });
    shell.resolve(); await turn(); assert.equal(stopped, false); assert.equal(cleanups, 1);
    operation.resolve(); await turn(); assert.equal(stopped, false); assert.equal(cleanups, 2);
    cleanupDone.resolve(); await stop; assert.equal(stopped, true); assert.deepEqual(events, ['cleanup-1', 'cleanup-2']);
});

test('failed startup is drained and cleaned rather than reported as failed shutdown', async () => {
    const startup = deferred(); let cleanups = 0;
    const stop = helper.stopHostedRuntime([startup.promise], () => { cleanups++; return Promise.resolve(); }, 1000);
    startup.reject(new Error('startup failed'));
    await stop; assert.equal(cleanups, 2);
});

test('timeout is unconfirmed and late startup still gets final cleanup without changing its rejected result', async () => {
    const startup = deferred(); let cleanups = 0;
    const stop = helper.stopHostedRuntime([startup.promise], () => { cleanups++; return Promise.resolve(); }, 20);
    await assert.rejects(stop, { code: 'EOS_UI_STOP_UNCONFIRMED' });
    assert.equal(cleanups, 1); startup.resolve(); await turn(); assert.equal(cleanups, 2);
    await assert.rejects(stop, { code: 'EOS_UI_STOP_UNCONFIRMED' });
});

test('cleanup throws, rejects or never confirms never produce a successful stop', async () => {
    let attempts = 0;
    await assert.rejects(helper.stopHostedRuntime([], () => {
        if (++attempts === 1) throw new Error('cleanup failed'); return Promise.resolve();
    }, 1000), { code: 'EOS_UI_STOP_UNCONFIRMED' });
    assert.equal(attempts, 2, 'final cleanup is still attempted after initial failure');
    await assert.rejects(helper.stopHostedRuntime([], () => Promise.reject(new Error('cleanup failed')), 1000), { code: 'EOS_UI_STOP_UNCONFIRMED' });
    await assert.rejects(helper.stopHostedRuntime([], () => new Promise(() => {}), 20), { code: 'EOS_UI_STOP_UNCONFIRMED' });
});

test('shell scheduled in a microtask cannot start after stop has already fenced the runtime', async () => {
    const f = fixture(); const start = f.runtime.start();
    const rejected = assert.rejects(start, /EOS_UI_STOPPING/);
    const stop = f.runtime.stop(); assert.equal(f.runtime.stop(), stop);
    assert.equal(f.runtime.status().canWrite, false);
    await stop; await rejected;
    assert.equal(f.events.includes('shell'), false);
    assert.equal(f.runtime.status().active, false);
    await assert.rejects(f.runtime.start(), /EOS_UI_STOPPING/);
});

test('operational start cannot outlive a successful stop or revive writes/readiness', async () => {
    const f = fixture(); const startDone = deferred();
    f.Runtime.prototype.onReady = async function () {
        await startDone.promise; f.events.push('late-resource'); this._hostedStartup = { state: 'ready', error: '' };
        this.emsEngine = {}; await assert.rejects(this.setForeignStateAsync('physical.0.command', 1), /OWNERSHIP_LOST/);
    };
    await f.runtime.start(); const operation = f.runtime.startOperational(); await turn();
    const stop = f.runtime.stop(); let stopped = false; void stop.then(() => { stopped = true; });
    assert.equal(f.runtime.status().canWrite, false); await turn(); assert.equal(stopped, false);
    const result = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    f.runtime.handle({}, result, () => assert.fail('stopped router executed')); assert.equal(result.code, 503);
    startDone.resolve(); await operation; await stop;
    assert.equal(f.events.at(-1), 'cleanup'); assert.equal(f.events.filter(event => event === 'cleanup').length, 2);
    assert.equal(f.writes.length, 0); assert.equal(f.runtime.status().emsReady, false);
    assert.equal(f.runtime.status().state, 'stopped');
    await f.runtime.startOperational(); assert.equal(f.events.filter(event => event === 'late-resource').length, 1);
});

test('active shell bootstrap is joined and its late resource receives final cleanup', async () => {
    const f = fixture(); const shell = deferred();
    f.Runtime.prototype.startServer = async function () { await shell.promise; f.events.push('late-shell'); this._hostedApp = () => {}; };
    const start = f.runtime.start(); const rejected = assert.rejects(start, /EOS_UI_STOPPING/); await turn();
    const stop = f.runtime.stop(); let stopped = false; void stop.then(() => { stopped = true; });
    await turn(); assert.equal(stopped, false); shell.resolve(); await rejected; await stop;
    assert.deepEqual(f.events, ['cleanup', 'late-shell', 'cleanup']); assert.equal(f.runtime.status().active, false);
});

test('actual hosted stop rejects a hung startup and keeps rejection/status after late cleanup', async () => {
    const f = fixture(20); const startDone = deferred();
    f.Runtime.prototype.onReady = async function () { await startDone.promise; this._hostedStartup = { state: 'ready', error: '' }; };
    await f.runtime.start(); const operation = f.runtime.startOperational(); await turn();
    const stop = f.runtime.stop(); await assert.rejects(stop, { code: 'EOS_UI_STOP_UNCONFIRMED' });
    assert.equal(f.runtime.status().state, 'stop-unconfirmed'); assert.equal(f.runtime.status().canWrite, false);
    startDone.resolve(); await operation; await turn();
    assert.equal(f.events.at(-1), 'cleanup'); assert.equal(f.runtime.stop(), stop);
    await assert.rejects(stop, { code: 'EOS_UI_STOP_UNCONFIRMED' });
    assert.equal(f.runtime.status().state, 'stop-unconfirmed'); assert.equal(f.runtime.status().emsReady, false);
});

test('actual runtime stop joins accepted host writes before confirming shutdown', async () => {
    const f = fixture(); const written = deferred(); f.owner.setForeignStateAsync = () => written.promise;
    await f.runtime.start();
    const write = f.instance().setStateAsync('actuator.command', 1);
    const stop = f.runtime.stop(); let stopped = false; void stop.then(() => { stopped = true; });
    await turn(); assert.equal(stopped, false); assert.equal(f.runtime.status().state, 'stopping');
    await assert.rejects(f.instance().setForeignStateChangedAsync('physical.command', 2), /OWNERSHIP_LOST/);
    written.resolve('stored'); assert.equal(await write, 'stored'); await stop;
    assert.equal(f.runtime.status().state, 'stopped');
});

test('real onUnload waits returned service-stop promises and propagates stop failure', async () => {
    const f = fixture(); f.Runtime.prototype.onUnload = f.actualOnUnload;
    await f.runtime.start(); const service = deferred(); const runtime = f.instance(); let stopped = false;
    runtime._partnerRuntime = { stop: () => service.promise }; runtime._nwCloseServer = done => done();
    const stop = f.runtime.stop(); void stop.then(() => { stopped = true; });
    await turn(); assert.equal(stopped, false); service.resolve(); await stop; assert.equal(stopped, true);

    const failing = fixture(); failing.Runtime.prototype.onUnload = failing.actualOnUnload;
    await failing.runtime.start(); failing.instance()._meshCoordinator = { stop: () => Promise.reject(new Error('transport stop failed')) };
    failing.instance()._nwCloseServer = done => done();
    await assert.rejects(failing.runtime.stop(), { code: 'EOS_UI_STOP_UNCONFIRMED' });
    assert.equal(failing.runtime.status().state, 'stop-unconfirmed');
});

test('hung actual service stop and hung host write both keep shutdown unconfirmed', async () => {
    const f = fixture(20); f.Runtime.prototype.onUnload = f.actualOnUnload;
    await f.runtime.start(); f.instance()._partnerRuntime = { stop: () => new Promise(() => {}) };
    f.instance()._nwCloseServer = done => done();
    await assert.rejects(f.runtime.stop(), { code: 'EOS_UI_STOP_UNCONFIRMED' });
    const g = fixture(20); await g.runtime.start(); g.owner.setForeignStateAsync = () => new Promise(() => {});
    void g.instance().setForeignStateAsync('physical.command', true);
    await assert.rejects(g.runtime.stop(), { code: 'EOS_UI_STOP_UNCONFIRMED' });
});
