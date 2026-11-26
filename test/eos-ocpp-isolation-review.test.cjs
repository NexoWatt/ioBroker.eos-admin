/* Copyright (c) 2026 NexoWatt. Independent hosted-OCPP boundary review.
 * Real module host/facade; only the controller database is an in-memory fixture.
 * No live controller, station, network listener or electrical effect is claimed. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { join } = require('node:path');
const { EosModuleHost } = require('../src/lib/eosModuleHost');
const { EosModuleProcess } = require('../src/lib/eosModuleProcess');

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

async function fixture(t, preserved = false) {
    const calls = [];
    const owner = {
        namespace: 'eos-admin.2', instance: 2, log: { warn() {} },
        config: {eosModules:{ocpp:{v:1, encrypted:'fixture-ocpp-configuration',
            ...(preserved ? {migration:{preserveNamespace:true,source:'ocpp21.4'}} : {})}}},
        decrypt(ciphertext) { assert.equal(ciphertext,'fixture-ocpp-configuration'); return JSON.stringify({enabled:true}); },
        eosMigration: {allowsStartup:id=>id==='ocpp'},
        eosLicenseService: { allowsEmbeddedModule: () => true },
        eosOwnership: { canWrite: () => true },
        async getForeignStateAsync(id) { calls.push(['get', id]); return { val: 0, ack: true, ts: Date.now() }; },
        async getForeignObjectAsync(id) { if (id === 'eos-admin.2.modules.ocpp.configuration') return null; calls.push(['object', id]); return { _id: id, type: 'state', common: { read: true } }; },
        async getForeignStatesAsync(pattern) { calls.push(['states', pattern]); return {}; },
        async getObjectViewAsync(design, kind, range) { calls.push(['view', design, kind, range]); return { rows: [] }; },
        async setForeignStateAsync(id, value) { calls.push(['set', id, value]); },
        async setForeignStateChangedAsync(id, value) { calls.push(['changed', id, value]); },
        async setForeignObjectNotExistsAsync(id, value) { calls.push(['create', id, value]); },
        async extendForeignObjectAsync(id, value) { calls.push(['extend', id, value]); },
        async delForeignObjectAsync(id, options) { calls.push(['delete', id, options]); },
    };
    const host = new EosModuleHost(owner, { baseDir: join(__dirname, '..'), dataDir: '/tmp/eos-review-no-files' });
    host.running = true; host.initialized = true;
    const entry = host.entries.get('ocpp');
    assert.ok(entry, 'integrated OCPP is a managed module');
    entry.generation = 7;
    const api = host.facade(entry,7);
    await assert.rejects(api.setStateAsync('station_01.control.chargeLimit',{val:0,ack:false}), /INACTIVE/);
    assert.deepEqual(calls, [], 'unconfirmed configuration cannot write even inside its own namespace');
    await host.loadForEditing('ocpp',true);
    assert.equal(entry.configLoaded,true);
    await host.renewOwnershipLeases();
    assert.equal(host.canOperate('ocpp',7),true,'only the validated owner becomes operational');
    calls.length=0; // The isolation assertions below cover requests through the facade.
    t.after(() => { host.stopped = true; entry.lease = 0; });
    const namespace = preserved ? 'ocpp21.4' : 'eos-admin.2.ocpp';
    return { host, owner, entry, calls, namespace, api };
}

test('hosted OCPP facade writes local states in only its current or explicitly preserved namespace', async t => {
    for (const preserved of [false, true]) await t.test(preserved ? 'preserved standalone namespace' : 'embedded namespace', async child => {
        const x = await fixture(child, preserved);
        await x.api.setStateAsync('station_01.control.chargeLimit', { val: 0, ack: false });
        await x.api.setStateChangedAsync(`${x.namespace}.station_01.info.status`, { val: 'SuspendedEVSE', ack: true });
        await x.api.getStateAsync('station_01.control.chargeLimit');
        await x.api.delObjectAsync('station_01.connectors', { recursive: true });
        assert.deepEqual(x.calls.map(call => call[1]), [
            `${x.namespace}.station_01.control.chargeLimit`, `${x.namespace}.station_01.info.status`,
            `${x.namespace}.station_01.control.chargeLimit`, `${x.namespace}.station_01.connectors`,
        ]);
        for (const id of ['', '*', '../station', 'station..control', `${x.namespace}.`, 'station\0.control']) {
            await assert.rejects(Promise.resolve().then(() => x.api.delObjectAsync(id, { recursive: true })), /STATE_SCOPE|STATE_ID/, id);
        }
        await assert.rejects(Promise.resolve().then(() => x.api.delObjectAsync('station_01', { recursive: true, foreign: true })), /STATE_SCOPE/);
        assert.equal(x.calls.length, 4, 'invalid paths never reach the controller');
    });
});

test('hosted OCPP scans reject foreign, oversized and malformed controller inventories without partial success', async t => {
    const x = await fixture(t);
    await x.api.getStatesAsync('*.health.online');
    assert.deepEqual(x.calls.at(-1), ['states', `${x.namespace}.*.health.online`]);
    for (const inventory of [
        { 'system.adapter.admin.0.alive': { val: true } },
        { [`${x.namespace}evil.station.health.online`]: { val: true } },
        { [`${x.namespace}.station.health.online`]: { val: 'x'.repeat(1024 * 1024) } },
        Object.fromEntries(Array.from({ length: 10001 }, (_, i) => [`${x.namespace}.s${i}.health.online`, { val: false }])),
        [], null,
    ]) {
        x.owner.getForeignStatesAsync = async () => inventory;
        await assert.rejects(x.api.getStatesAsync('*'), /RESULT_SCOPE|RESULT_SIZE/);
    }
});

test('hosted OCPP configuration views accept only bounded own-station ranges and validate both value and doc identifiers', async t => {
    const x = await fixture(t);
    const prefix = `${x.namespace}.station_01.configuration.`;
    const range = { startkey: prefix, endkey: `${prefix}\u9999` };
    await x.api.getObjectViewAsync('system', 'state', range);
    assert.equal(x.calls.at(-1)[3].limit, 10001, 'the controller query itself is bounded');
    for (const [design, type, value] of [
        ['system', 'instance', range], ['custom', 'state', range],
        ['system', 'state', { ...range, include_docs: true }],
        ['system', 'state', { startkey: 'system.', endkey: 'system.\u9999' }],
        ['system', 'state', { ...range, endkey: `${x.namespace}.\u9999` }],
    ]) await assert.rejects(x.api.getObjectViewAsync(design, type, value), /STATE_SCOPE/);
    const ownId = `${prefix}MeterValueSampleInterval`;
    for (const row of [
        { id: 'system.config', value: { _id: 'system.config' } },
        { id: ownId, value: { _id: 'system.config' } },
        { id: ownId, doc: { _id: 'system.config', native: { confidential: 'fixture-only' } } },
        { id: ownId, value: { _id: ownId }, doc: { _id: 'system.config' } },
    ]) {
        x.owner.getObjectViewAsync = async () => ({ rows: [row] });
        await assert.rejects(x.api.getObjectViewAsync('system', 'state', range), /RESULT_SCOPE/);
    }
});

test('hosted OCPP cannot publish a late inventory or dispatch a queued write after its generation is revoked', async t => {
    const x = await fixture(t);
    const held = deferred();
    x.owner.getForeignStatesAsync = async () => held.promise;
    const read = x.api.getStatesAsync('*.info.connection');
    const write = x.api.setStateAsync('station_01.control.chargeLimit', { val: 11000, ack: false });
    x.entry.generation++;
    held.resolve({ [`${x.namespace}.station_01.info.connection`]: { val: true } });
    await assert.rejects(read, /INACTIVE/);
    await assert.rejects(write, /STOPPED|INACTIVE/);
    assert.equal(x.calls.some(call => call[0] === 'set'), false);
    await x.api.setStateAsync('station_01.info.connection', { val: false, ack: true });
    assert.equal(x.calls.some(call => call[0] === 'set'), false, 'old-generation cleanup telemetry cannot overwrite a replacement');
});

test('OCPP acknowledged telemetry bursts never re-enter IPC, while the original command event is preserved', async () => {
    const received = [];
    const worker = new EosModuleProcess({ id: 'ocpp', baseDir: join(__dirname, '..'), generation: 2,
        canOperate: () => true, onFailure() {}, moduleOptions: { config: { enabled: true }, dataDir: '/tmp/eos-review-no-files',
            adapter: { namespace: 'eos-admin.2.ocpp', instance: 2, config: {}, log: {} } } });
    // This case isolates admission BEFORE an IPC request is allocated. Actual
    // child generation/transport behavior is exercised by the process suites.
    worker.request = async (method, args) => { received.push({ method, args }); };
    await Promise.all(Array.from({ length: 1500 }, (_, index) =>
        worker.onStateChange(`eos-admin.2.ocpp.station.measurements.m${index}`, { val: index, ack: true, q: 0, ts: Date.now() })));
    await worker.onStateChange('eos-admin.2.ocpp.station.info.connection', null);
    assert.equal(received.length, 0, 'own acknowledged publications cannot consume the bounded command IPC queue');
    const event = { val: Date.now() + 15000, ack: false, q: 0, ts: Date.now(), from: 'system.adapter.eos-admin.2' };
    await worker.onStateChange('eos-admin.2.ocpp.station.control.eosLeaseUntilMs', event);
    assert.deepEqual(received, [{ method: 'onStateChange', args: ['eos-admin.2.ocpp.station.control.eosLeaseUntilMs', event] }]);
});
