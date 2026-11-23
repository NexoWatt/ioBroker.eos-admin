/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const http = require('node:http');
const { createHarness } = require('./http-harness.cjs');

function isolatedRuntime() {
    const filename = path.resolve(__dirname, '../../main.js');
    const isolated = new Module(filename, module);
    isolated.filename = filename; isolated.paths = Module._nodeModulePaths(path.dirname(filename));
    isolated._compile(fs.readFileSync(filename, 'utf8') + '\nmodule.exports.TestRuntime = NexoWattVis;\n', filename);
    return isolated.exports;
}

for (const phase of ['TRANSFERRED', 'COMMITTED']) {
    test(`preserved-state corruption fails closed in full startup during ${phase}; recovery listener survives`, async () => {
        const h = await createHarness({ legacyNamespace: 'nexowatt-ui.0' });
        const logs = [];
        h.owner.log.warn = h.owner.log.error = message => logs.push(message);
        const timers = new Set();
        const fakeTimer = () => { const timer = { unref() {}, ref() {} }; timers.add(timer); return timer; };
        h.owner.setTimeout = h.owner.setInterval = fakeTimer;
        h.owner.clearTimeout = h.owner.clearInterval = timer => timers.delete(timer);
        h.owner.delObjectAsync = async () => {};
        h.owner.delForeignObjectAsync = async id => { h.objects.delete(id); };
        h.owner.setForeignObjectNotExistsAsync = async (id, object) => {
            if (!h.objects.has(id)) h.objects.set(id, structuredClone(object));
        };
        h.owner.subscribeForeignStates = h.owner.subscribeForeignObjects = h.owner.unsubscribeForeignStates = () => {};
        h.owner.unsubscribeForeignStatesAsync = async () => {};
        h.owner.getObjectListAsync = async () => ({ rows: [] });
        h.owner.decrypt = h.owner.encrypt = value => value;
        h.owner.host = 'fixture';
        h.owner.eosMigration = { phase };
        h.owner.config.eosUiMigration.requiredStates = ['installer.configJson'];
        h.owner.config.eosUi = {
            smartHome: { enabled: true },
            smartHomeConfig: { version: 3, rooms: [], floors: [], functions: [], scenes: [], pages: [],
                devices: [{ id: 'lamp', type: 'switch', io: { switch: { readId: 'knx.0.light', writeId: 'knx.0.light' } } }] },
        };
        h.states.set('nexowatt-ui.0.installer.configJson', { val: '{private-corruption-marker', ack: true });
        const { TestRuntime, createHostedRuntime } = isolatedRuntime();
        let engineStarts = 0;
        TestRuntime.prototype.initEmsEngine = async () => { engineStarts++; throw new Error('must not reach EMS'); };
        const runtime = createHostedRuntime(h.owner, h.bridge);
        const originalLoad = Module._load;
        Module._load = function (name, ...args) {
            if (name === '@iobroker/adapter-core') return { getAbsoluteInstanceDataDir: () => '/tmp/nexowatt-preserved-startup-test' };
            return originalLoad.call(this, name, ...args);
        };
        const server = http.createServer((req, res) => runtime.handle(req, res, () => { res.statusCode = 404; res.end(); }));
        try {
            await runtime.start();
            await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
            const base = `http://127.0.0.1:${server.address().port}`;
            await runtime.startOperational();
            assert.equal(runtime.status().state, 'degraded');
            assert.equal(runtime.status().error, 'EOS_MIGRATION_UI_STATE_INVALID', logs.join('\n'));
            assert.equal(runtime.status().emsReady, false);
            assert.equal(runtime.status().canWrite, false, 'independent of migration monitor or journal phase');
            assert.equal(engineStarts, 0);
            assert.equal(h.objects.has('nexowatt-ui.0.installer.configJson'), false, 'must not seed or replace damaged state');
            assert.equal(h.states.get('nexowatt-ui.0.installer.configJson').val, '{private-corruption-marker');
            assert.equal((await fetch(base + '/static/login.js')).status, 200, 'owner listener and login remain available');
            const token = await h.login('admin');
            const response = await fetch(base + '/api/smarthome/toggle', { method: 'POST', headers: {
                Origin: base, Cookie: `fixture=${token}`, 'Content-Type': 'application/json', 'X-NW-CSRF': token,
            }, body: JSON.stringify({ id: 'lamp', value: true }) });
            assert.ok(response.status >= 400, `late write returned ${response.status}`);
            assert.equal(h.states.has('knx.0.light'), false);
            await runtime.startOperational();
            assert.equal(engineStarts, 0, 'repair requires explicit restart, not HTTP auto-retry');
            assert.equal(runtime.status().canWrite, false);
        } finally {
            Module._load = originalLoad;
            await runtime.stop();
            server.closeAllConnections();
            await new Promise(resolve => server.close(resolve));
            await h.close();
        }
    });
}

test('timer and logic-clock saves wait for complete preserved startup hydration instead of losing a confirmed edit', async () => {
    const h = await createHarness({ legacyNamespace: 'nexowatt-ui.0' });
    const timers = new Set();
    const fakeTimer = () => { const timer = { unref() {}, ref() {} }; timers.add(timer); return timer; };
    h.owner.setTimeout = h.owner.setInterval = fakeTimer;
    h.owner.clearTimeout = h.owner.clearInterval = timer => timers.delete(timer);
    h.owner.delForeignObjectAsync = async id => { h.objects.delete(id); };
    h.owner.setForeignObjectNotExistsAsync = async (id, object) => {
        if (!h.objects.has(id)) h.objects.set(id, structuredClone(object));
    };
    h.owner.setForeignStateChangedAsync = h.owner.setForeignStateAsync;
    h.owner.subscribeForeignStates = h.owner.subscribeForeignObjects = h.owner.unsubscribeForeignStates = () => {};
    h.owner.unsubscribeForeignStatesAsync = async () => {};
    h.owner.getObjectListAsync = async () => ({ rows: [] });
    h.owner.decrypt = h.owner.encrypt = value => value;
    h.owner.host = 'fixture';
    h.states.set('nexowatt-ui.0.installer.configJson', { val: '{}', ack: true });
    const oldTimers = { version: 1, updatedAt: 1, timers: [{ deviceId: 'lamp', enabled: true, days: [1], onTime: '12:00', offTime: '13:00' }] };
    const oldClocks = { version: 1, updatedAt: 1, clocks: [{ id: 'old', name: 'Old', enabled: true, days: [1], fromTime: '12:00', toTime: '13:00' }] };
    h.states.set('nexowatt-ui.0.smarthome.timersJson', { val: JSON.stringify(oldTimers), ack: true });
    h.states.set('nexowatt-ui.0.smarthome.logicClocksJson', { val: JSON.stringify(oldClocks), ack: true });
    let releaseRead; let reachedRead;
    const suspended = new Promise(resolve => { releaseRead = resolve; });
    const atRead = new Promise(resolve => { reachedRead = resolve; });
    h.adapter.updateEnergyTotalsFromInflux = async () => { reachedRead(); await suspended; };
    const originalLoad = Module._load;
    Module._load = function (name, ...args) {
        if (name === '@iobroker/adapter-core') return { getAbsoluteInstanceDataDir: () => '/tmp/nexowatt-preserved-startup-test' };
        return originalLoad.call(this, name, ...args);
    };
    const startup = h.adapter.onReady();
    let timeout;
    try {
        await Promise.race([atRead, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(`startup did not reach hydration pause: ${JSON.stringify(h.adapter._hostedStartup)}`)), 2000); })]);
        clearTimeout(timeout);
        const token = await h.login('admin');
        for (const url of ['/api/smarthome/timers', '/api/smarthome/logic-clocks']) {
            const loading = await h.request(url, { token });
            assert.equal(loading.status, 503);
            assert.equal(loading.data.error, 'EOS_SMARTHOME_INITIALIZING');
            assert.equal(loading.data.config, undefined, 'do not present an empty replacement configuration');
            const response = await h.request(url, { token, method: 'POST', body: { config: { version: 1, timers: [], clocks: [] } } });
            assert.equal(response.status, 503);
            assert.equal(response.data.error, 'EOS_UI_STARTING', 'existing global startup mutation gate remains authoritative');
        }
        assert.deepEqual(JSON.parse(h.states.get('nexowatt-ui.0.smarthome.timersJson').val), oldTimers);
        assert.deepEqual(JSON.parse(h.states.get('nexowatt-ui.0.smarthome.logicClocksJson').val), oldClocks);
        releaseRead(); await startup;
        assert.equal(h.adapter._nwSmartHomeHydrating, false);
        assert.equal(h.adapter.getSmartHomeTimersConfig().timers[0].deviceId, 'lamp');
        assert.equal(h.adapter.getSmartHomeLogicClocksConfig().clocks[0].id, 'old');
        assert.equal((await h.request('/api/smarthome/timers', { token, method: 'POST', body: { deviceId: 'new-lamp', timer: { enabled: false, days: [2], onTime: '14:00', offTime: '15:00' } } })).status, 200);
        assert.equal((await h.request('/api/smarthome/logic-clocks', { token, method: 'POST', body: { id: 'new_clock', clock: { enabled: false, days: [2], fromTime: '14:00', toTime: '15:00' } } })).status, 200);
        assert.equal(h.adapter.getSmartHomeTimersConfig().timers.some(row => row.deviceId === 'new-lamp'), true);
        assert.equal(JSON.parse(h.states.get('nexowatt-ui.0.smarthome.timersJson').val).timers.some(row => row.deviceId === 'new-lamp'), true);
        assert.equal(JSON.parse(h.states.get('nexowatt-ui.0.smarthome.logicClocksJson').val).clocks.some(row => row.id === 'new_clock'), true);
    } finally {
        clearTimeout(timeout); releaseRead(); await startup;
        Module._load = originalLoad;
        await new Promise(resolve => h.adapter.onUnload(resolve));
        assert.equal(h.adapter._nwSmartHomeHydrating, false);
        assert.equal(h.adapter._nwPreservedUiStates, null);
        await h.close();
    }
});
