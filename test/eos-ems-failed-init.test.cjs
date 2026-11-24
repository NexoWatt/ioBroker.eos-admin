'use strict';
/** Actual hosted runtime + actual Engine/ModuleManager; synthetic module stop models asynchronous cleanup. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const { ModuleManager } = require('../ui/ems/module-manager');
const { EmsEngine } = require('../ui/ems/engine');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fixture(t, stop) {
    const h = await createHarness(); const a = h.adapter;
    a.config = structuredClone(require('../ui/io-package.json').native);
    a.config.port = 8188; a._hostedStartup = { state: 'ready' };
    a.startHistorieExportTimer = () => {};
    h.owner.subscribeForeignStates = () => {}; h.owner.unsubscribeForeignStates = () => {};
    await a.migrateNativeConfig(); await a.loadInstallerConfigFromState(); await a.syncSettingsConfigToStates();
    const init = ModuleManager.prototype.init; let calls = 0; let failedEngine;
    ModuleManager.prototype.init = async function () {
        await init.call(this); calls++;
        if (calls === 1) {
            failedEngine = a.emsEngine;
            this.modules.push({ key: 'fixtureAsyncStop', instance: { stop } });
            throw new Error('TEST_PARTIAL_INIT_FAILURE');
        }
    };
    t.after(async () => {
        ModuleManager.prototype.init = init;
        await a.emsEngine?.stopForReconfigure?.().catch(() => {});
        await new Promise(resolve => a.onUnload(resolve)); await h.close();
    });
    return { a, calls: () => calls, failed: () => failedEngine };
}

test('failed startup waits for actual module drain, and concurrent callers cannot create a replacement', async t => {
    let release; let stopCalled = false;
    const drain = new Promise(resolve => { release = resolve; });
    t.after(() => release());
    const x = await fixture(t, () => { stopCalled = true; return drain; });
    let firstFinished = false;
    const first = assert.rejects(x.a.initEmsEngine(), /TEST_PARTIAL_INIT_FAILURE/).then(() => { firstFinished = true; });
    for (let count = 0; count < 50 && !stopCalled; count++) await pause(5);
    assert.equal(stopCalled, true);
    assert.equal(firstFinished, false);
    assert.equal(x.a.emsEngine, x.failed());
    const second = assert.rejects(x.a.initEmsEngine(), /TEST_PARTIAL_INIT_FAILURE/);
    await pause(20); assert.equal(x.calls(), 1);
    release(); await Promise.all([first, second]);
    assert.equal(x.a.emsEngine, null);
    assert.equal(x.a._nwEmsInitError, 'TEST_PARTIAL_INIT_FAILURE');
    x.a._hostedStartup = { state: 'degraded', error: 'EOS_EMS_INIT_FAILED' };
    await x.a.initEmsEngine();
    assert.equal(x.calls(), 2); assert.ok(x.a.emsEngine); assert.equal(x.a._nwEmsInitError, '');
    assert.equal(x.a._nwIsEmsReady(), true);
    assert.deepEqual(x.a._hostedStartup, { state: 'ready', error: '' });
});

test('rejected failed-start cleanup retains the fenced engine and blocks nonforced and forced replacements', async t => {
    const x = await fixture(t, async () => { throw new Error('TEST_STOP_REJECTED'); });
    await assert.rejects(x.a.initEmsEngine(), /TEST_PARTIAL_INIT_FAILURE/);
    assert.equal(x.a.emsEngine, x.failed());
    assert.equal(x.a._nwEmsInitError, 'TEST_PARTIAL_INIT_FAILURE');
    assert.deepEqual(x.a._hostedStartup, { state: 'degraded', error: 'EOS_EMS_INIT_FAILED' });
    for (const force of [false, true]) {
        await assert.rejects(x.a.initEmsEngine(force), /EOS_EMS_MODULE_STOP_FAILED/);
        assert.equal(x.a.emsEngine, x.failed()); assert.equal(x.calls(), 1);
    }
});

test('bounded failed-start drain timeout retains ownership and allows a later confirmed cleanup to recover', async t => {
    let release;
    const drain = new Promise(resolve => { release = resolve; });
    const original = EmsEngine.prototype.stopForReconfigure;
    // Exercise the actual shared deadline with a short test budget.
    EmsEngine.prototype.stopForReconfigure = function () { return original.call(this, 20); };
    t.after(() => { release(); EmsEngine.prototype.stopForReconfigure = original; });
    const x = await fixture(t, () => drain);
    await assert.rejects(x.a.initEmsEngine(), /TEST_PARTIAL_INIT_FAILURE/);
    assert.equal(x.a.emsEngine, x.failed()); assert.equal(x.calls(), 1);
    await assert.rejects(x.a.initEmsEngine(), /EOS_EMS_CONFIG_WAIT_TIMEOUT/);
    assert.equal(x.a.emsEngine, x.failed()); assert.equal(x.calls(), 1);
    release(); await pause(0);
    x.a._hostedStartup = { state: 'degraded', error: 'EOS_UI_OWNERSHIP_LOST' };
    await x.a.initEmsEngine();
    assert.equal(x.calls(), 2); assert.notEqual(x.a.emsEngine, x.failed());
    assert.equal(x.a._nwEmsInitError, '');
    assert.deepEqual(x.a._hostedStartup, { state: 'degraded', error: 'EOS_UI_OWNERSHIP_LOST' }, 'an unrelated startup blocker must not be erased');
});

test('retained or stopped engine references cannot admit immediate EMS work or advertise running', async t => {
    const h = await createHarness(); t.after(() => h.close());
    const a = h.adapter; let requests = 0;
    a.emsEngine = { _timer: {}, _reconfiguring: false, requestImmediateTick: () => { requests++; return true; } };
    a._nwEmsInitError = ''; a._hostedStartup = { state: 'ready', error: '' };
    assert.equal(a._nwIsEmsReady(), true);
    assert.equal(a._nwRequestImmediateEmsTick(), true);
    const token = await h.login('admin');
    for (const reason of ['initError', 'fenced', 'stopped', 'shuttingDown']) {
        a._nwEmsInitError = reason === 'initError' ? 'TEST_PARTIAL_INIT_FAILURE' : '';
        a._nwShuttingDown = reason === 'shuttingDown';
        a.emsEngine._reconfiguring = reason === 'fenced';
        a.emsEngine._timer = reason === 'stopped' ? null : {};
        assert.equal(a._nwIsEmsReady(), false, reason);
        assert.equal(a._nwRequestImmediateEmsTick(), false, reason);
        assert.equal((await h.request('/api/ems/status', { token })).data.engine.running, false, reason);
    }
    assert.equal(requests, 1);
});
