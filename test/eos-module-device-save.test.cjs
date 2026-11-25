/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
// Real HTTP boundary, OAuth session, module host/config store and Devices validator.
// The controller database and device transport are isolated doubles: no hardware IO.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const auditedRoot = process.env.EOS_PERSISTENCE_BASELINE || path.resolve(__dirname, '..');
const { EosModuleHost } = require(path.join(auditedRoot, 'src/lib/eosModuleHost'));
const { registerEosModuleRoutes } = require(path.join(auditedRoot, 'src/lib/eosModuleHttp'));
const { UnifiedSessions } = require('../src/lib/eosUnifiedBoundary');
const { installIdleSession } = require('./fixtures/eos-idle-session.cjs');
const realDevices = require('../modules/devices');
const configurationId = 'eos-admin.0.modules.devices.configuration';
const meter = { id: 'meter1', name: 'SMA EnergyMeter / SHM', templateId: 'meter.sma.SmaEnergyMeterSpeedwireImpl',
    enabled: true, protocol: 'speedwire', connection: { host: '192.0.2.15', serial: 'test-meter', password: 'fixture-only-secret', futureConnectionOption: 41 },
    futureDeviceOption: { value: 'retain' } };

async function fixture(t, initial = {}, allowed = true) {
    const objects = new Map(); const writes = []; const runtimes = [];
    let allowStartup = allowed, failRead = false;
    const encrypt = text => `fixture-encrypted:${Buffer.from(text).toString('base64')}`;
    const owner = {
        namespace: 'eos-admin.0', instance: 0, config: { eosModules: { devices: { v: 1, encrypted: encrypt(JSON.stringify({ enabled: false, ...initial })) } } },
        encrypt, decrypt: text => Buffer.from(text.slice('fixture-encrypted:'.length), 'base64').toString(),
        log: { warn() {}, info() {}, debug() {}, error() {} },
        eosLicenseService: { allowsEmbeddedModule: () => true }, eosOwnership: { canWrite: () => true },
        eosMigration: { allowsStartup: () => allowStartup, status: () => ({ phase: allowStartup ? 'NOT_NEEDED' : 'BLOCKED' }) },
        async getObjectViewAsync() { return { rows: [] }; },
        async getForeignObjectAsync(id) { if (failRead && id === configurationId) throw new Error('fixture read unavailable'); return structuredClone(objects.get(id)); },
        async setForeignObjectAsync(id, value) { objects.set(id, structuredClone(value)); writes.push(id); },
        async getForeignStateAsync() { return null; },
        async subscribeForeignObjectsAsync() {}, async subscribeForeignStatesAsync() {}, async unsubscribeForeignStatesAsync() {},
    };
    const factory = { ...realDevices, createHostedModule(options) {
        const runtime = { config: structuredClone(options.config), starts: 0, stops: 0,
            async start() { this.starts++; }, async stop() { this.stops++; }, async getStatus() { return { state: 'fixture' }; } };
        runtimes.push(runtime); return runtime;
    } };
    const options = { baseDir: path.resolve(__dirname, '..'), dataDir: '/tmp/eos-device-save-fixture',
        factories: { devices: factory, eebus: { validateConfig: input => input }, backup: { validateConfig: input => input } } };
    const newHost = () => {
        const instance = new EosModuleHost(owner, options);
        // This persistence/authentication fixture has no EMS controller. Supply
        // its explicit empty-controller admission; production is covered by Web.
        instance.bindDeviceEms(async () => ({ statuses: [] }), async () => () => {});
        return instance;
    };
    let host = newHost();
    const session = await installIdleSession(owner);
    const authority = new UnifiedSessions(owner, { secure: false, externalOrigin: '',
        resolveAccess: async req => req.headers.cookie === `access_token=${session.token}`
            ? { userId: session.userId, role: 'admin', groups: [] } : { userId: null, role: 'enduser', groups: [] },
        firstLogin: async () => ({ required: false }), getLicense: () => ({ valid: true, coreEnabled: true }) });
    const app = express();
    const proxyHost = Object.fromEntries(['view', 'save', 'command', 'importLegacy', 'migrationStatus'].map(method => [method, (...args) => host[method](...args)]));
    registerEosModuleRoutes({ app, host: proxyHost, baseDir: options.baseDir, jsonParser: express.json(),
        authorize: req => authority.status(req), csrfAllowed: req => authority.csrfAllowed(req), requestAllowed: req => authority.requestAllowed(req) });
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    t.after(async () => { await host.stop(); session.cleanup(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    let loadedRevision;
    const get = async () => {
        const response = await fetch(`${origin}/api/eos/modules/devices`, { headers: { cookie: `access_token=${session.token}` } });
        assert.equal(response.status, 200); const view = await response.json(); loadedRevision = view.configurationRevision; return view;
    };
    const put = async (config, csrfToken, expectedConfigurationRevision = loadedRevision) => {
        const response = await fetch(`${origin}/api/eos/modules/devices`, { method: 'PUT',
            headers: { cookie: `access_token=${session.token}`, origin, 'content-type': 'application/json', 'x-nw-csrf': csrfToken }, body: JSON.stringify({ config, expectedConfigurationRevision }) });
        return { status: response.status, body: await response.json() };
    };
    return { owner, objects, writes, runtimes, get, put, host: () => host,
        browserFetch(url, options = {}) { return fetch(origin + url, { ...options, headers: { ...options.headers, cookie: `access_token=${session.token}`, origin } }); },
        allowed(value) { allowStartup = value; }, failRead(value) { failRead = value; },
        async restart() { await host.stop(); owner.config = { eosModules: {} }; host = newHost(); return host; } };
}

test('two browser drafts cannot silently overwrite a newer module configuration through real HTTP', async t => {
    const f = await fixture(t, { devices: [meter], futureModuleOption: 'initial' });
    const firstDraft = await f.get(); const secondDraft = await f.get();
    assert.equal(firstDraft.configurationRevision, secondDraft.configurationRevision);
    const changed = { ...firstDraft.config, futureModuleOption: 'confirmed-newer-value' };
    assert.equal((await f.put(changed, firstDraft.csrfToken, firstDraft.configurationRevision)).status, 200);
    const stale = await f.put({ ...secondDraft.config, pollIntervalMs: 2500 }, secondDraft.csrfToken, secondDraft.configurationRevision);
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error, 'EOS_MODULE_CONFIG_CONFLICT');
    const loaded = await f.get();
    assert.equal(loaded.config.futureModuleOption, 'confirmed-newer-value');
    assert.notEqual(loaded.configurationRevision, firstDraft.configurationRevision);
    assert.equal(f.writes.length, 1);
    await f.restart();
    assert.equal((await f.get()).config.futureModuleOption, 'confirmed-newer-value');
});

test('missing or malformed HTTP draft revision cannot authorize a replacement', async t => {
    const f = await fixture(t, { devices: [meter] }); const view = await f.get();
    for (const expected of [null, '', [], {}, 'not-a-revision']) {
        const response = await f.put({ enabled: false, devices: [] }, view.csrfToken, expected);
        assert.equal(response.status, 409);
        assert.equal(response.body.error, 'EOS_MODULE_CONFIG_CONFLICT');
    }
    const missing = await f.browserFetch('/api/eos/modules/devices', { method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-nw-csrf': view.csrfToken }, body: JSON.stringify({ config: { enabled: false, devices: [] } }) });
    assert.equal(missing.status, 409);
    assert.equal((await missing.json()).error, 'EOS_MODULE_CONFIG_CONFLICT');
    assert.equal(f.writes.length, 0);
    assert.equal((await f.get()).config.devices[0].id, meter.id);
});

test('SMA device create/save/reload and enable toggle survive a new host with packaged defaults', async t => {
    const f = await fixture(t, { futureModuleOption: { retain: true } });
    let view = await f.get();
    assert.equal(view.configurationReady, true, 'editing does not depend on running device transports');
    assert.equal(view.configurationLoaded, true);
    assert.equal(f.host().initialized, false);
    assert.equal(f.runtimes.length, 0);
    const saved = await f.put({ ...view.config, enabled: true, devices: [meter] }, view.csrfToken);
    assert.equal(saved.status, 200);
    view = await f.get();
    assert.equal(view.config.enabled, true);
    assert.equal(view.config.devices[0].id, 'meter1');
    assert.equal(view.config.devices[0].connection.password, '__EOS_SECRET_UNCHANGED__');
    assert.equal(f.runtimes.length, 0, 'saving before operational startup never starts hardware');
    assert.deepEqual(f.writes, [configurationId]);
    assert.equal(JSON.stringify(f.objects.get(configurationId)).includes('fixture-only-secret'), false);
    const migration = { preserveNamespace: true, source: 'nexowatt-devices.0', sourceVersion: '0.5.176' };
    await f.host().save('devices', view.config, migration);
    await f.restart();
    view = await f.get();
    assert.equal(view.status.namespace, 'nexowatt-devices.0.devices');
    assert.deepEqual(view.migration, migration);
    assert.deepEqual(view.config.futureModuleOption, { retain: true });
    assert.deepEqual(view.config.devices[0].futureDeviceOption, { value: 'retain' });
    assert.equal(view.config.devices[0].connection.futureConnectionOption, 41);
    assert.equal((await f.put({ ...view.config, enabled: false }, view.csrfToken)).status, 200);
    view = await f.get(); assert.equal(view.config.enabled, false);
    assert.equal((await f.put({ ...view.config, enabled: true }, view.csrfToken)).status, 200);
    const restarted = await f.restart(); await restarted.start();
    assert.equal(f.runtimes.length, 1);
    assert.deepEqual(f.runtimes[0].config.devices, [meter]);
    assert.equal(f.runtimes[0].config.enabled, true);
    assert.deepEqual(f.runtimes[0].config.futureModuleOption, { retain: true });
    assert.equal(restarted.namespace('devices'), 'nexowatt-devices.0');
    assert.ok(f.writes.every(id => id === configurationId), 'no adapter-instance write/restart or source mutation');
});

test('blocked handover displays the saved devices and rejects replacement until explicit coordinator release', async t => {
    const f = await fixture(t, { devices: [meter], futureModuleOption: 'original' }, false);
    const before = structuredClone(f.owner.config);
    let view = await f.get();
    assert.equal(view.configurationReady, false);
    assert.equal(view.configurationReason, 'EOS_MODULE_MIGRATION_BLOCKED');
    assert.equal(view.config.devices[0].id, 'meter1', 'the editor receives saved settings instead of empty defaults');
    assert.deepEqual(f.owner.config, before, 'read-only loading does not rewrite migration targets');
    assert.deepEqual(await f.put({ enabled: true, devices: [] }, view.csrfToken), { status: 400, body: { error: 'EOS_MODULE_MIGRATION_BLOCKED' } });
    assert.equal(f.writes.length, 0); assert.equal(f.runtimes.length, 0);
    f.owner.config.eosModules.devices.encrypted = f.owner.encrypt(JSON.stringify({ enabled: false, devices: [{ ...meter, name: 'Migrated original' }], futureModuleOption: 'migrated' }));
    f.allowed(true); view = await f.get();
    assert.equal(view.configurationReady, true);
    assert.equal(view.config.devices[0].name, 'Migrated original');
    assert.equal(view.config.futureModuleOption, 'migrated');
    assert.equal((await f.put(view.config, view.csrfToken)).status, 200);
    assert.equal(f.runtimes.length, 0);
});

test('read failure on handover release cannot make a previously loaded stale configuration writable', async t => {
    const f = await fixture(t, { devices: [meter] }, false);
    let view = await f.get(); assert.equal(view.configurationLoaded, true);
    const before = structuredClone(f.owner.config);
    f.allowed(true); f.failRead(true); view = await f.get();
    assert.equal(view.configurationReady, false); assert.equal(view.configurationLoaded, false);
    assert.equal(view.configurationReason, 'EOS_MODULE_CONFIG_UNAVAILABLE');
    assert.deepEqual(await f.put({ enabled: false, devices: [] }, view.csrfToken), { status: 400, body: { error: 'EOS_MODULE_CONFIG_UNAVAILABLE' } });
    assert.deepEqual(f.owner.config, before); assert.equal(f.writes.length, 0);
    f.failRead(false); view = await f.get();
    assert.equal(view.configurationReady, true); assert.equal(view.config.devices[0].id, 'meter1');
});

test('operational start joins a concurrent editor read and stopping during that read never activates a module', async t => {
    for (const stopping of [false, true]) {
        const f = await fixture(t, { enabled: true, devices: [meter] });
        let release, entered;
        const gate = new Promise(resolve => { release = resolve; });
        const reached = new Promise(resolve => { entered = resolve; });
        const load = f.host().configStore.load.bind(f.host().configStore);
        let first = true;
        f.host().configStore.load = async id => { if (first) { first = false; entered(); await gate; } return load(id); };
        const viewing = f.host().view('devices'); await reached;
        const starting = f.host().start();
        if (stopping) await f.host().stop();
        release(); await Promise.all([viewing, starting]);
        assert.equal(f.runtimes.length, stopping ? 0 : 1);
        assert.equal(f.writes.length, 0);
        if (!stopping) assert.deepEqual(f.runtimes[0].config.devices, [meter]);
    }
});

test('operational start joins an accepted pre-start save, preserving commit errors and shutdown fencing', async t => {
    for (const outcome of ['commit', 'error', 'stop']) {
        const f = await fixture(t, { enabled: true, devices: [meter] });
        await f.get();
        let release, entered;
        const gate = new Promise(resolve => { release = resolve; });
        const reached = new Promise(resolve => { entered = resolve; });
        const save = f.host().configStore.save.bind(f.host().configStore);
        f.host().configStore.save = async (...args) => {
            entered(); await gate;
            if (outcome === 'error') throw new Error('fixture commit failed');
            return save(...args);
        };
        const edited = { ...meter, name: 'Saved during startup' };
        const saving = f.host().save('devices', { enabled: true, devices: [edited] }).then(value => ({ value }), error => ({ error }));
        await reached;
        let startSettled = false;
        const starting = f.host().start().then(() => { startSettled = true; return null; }, error => { startSettled = true; return error; });
        await new Promise(resolve => setImmediate(resolve));
        const settledBeforeCommit = startSettled;
        const stopping = outcome === 'stop' ? f.host().stop() : Promise.resolve();
        release();
        const [saveResult, startError] = await Promise.all([saving, starting]);
        await stopping;
        assert.equal(settledBeforeCommit, false, 'startup must join the accepted configuration mutation instead of returning BUSY');
        assert.equal(startError, null);
        if (outcome === 'error') {
            assert.match(saveResult.error.message, /fixture commit failed/);
            assert.equal(f.writes.length, 0);
            assert.equal(f.runtimes.length, 1);
            assert.deepEqual(f.runtimes[0].config.devices, [meter], 'startup uses the retained authoritative configuration after the rejected save');
        } else if (outcome === 'stop') {
            assert.equal(saveResult.error?.code, 'EOS_MODULE_STOPPED');
            assert.equal(f.writes.length, 0, 'a paused pre-write must not issue a persistent write after shutdown');
            assert.equal(f.runtimes.length, 0);
        } else {
            assert.equal(saveResult.error, undefined);
            assert.deepEqual(f.writes, [configurationId]);
            assert.equal(f.runtimes.length, outcome === 'stop' ? 0 : 1);
            if (outcome === 'commit') assert.deepEqual(f.runtimes[0].config.devices, [edited]);
        }
    }
});

test('actual Devices HTTP response drives the browser bridge through one global Save, CSRF and automatic per-device status', async t => {
    const vm = require('node:vm');
    const fs = require('node:fs');
    const device = { ...meter, category: 'METER', ems: { mode: 'gridMeter', scope: 'M0' } };
    const f = await fixture(t, { devices: [device], futureModuleOption: { retain: true } });
    const nodes = new Map(), timers = new Map(), events = new Map();
    let draft, loads = 0, writes = 0, timerId = 0;
    class Element {
        constructor() { this.textContent = ''; this.dataset = {}; this.events = {}; this.disabled = false; this.checked = false; }
        addEventListener(type, fn) { this.events[type] = fn; }
    }
    const node = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
    const row = new Element(); row.dataset = { eosEmsId: 'meter1', eosEmsEnabled: 'true', eosEmsMode: 'gridMeter' };
    const window = { setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
        addEventListener(type, fn) { events.set(type, fn); } };
    const context = vm.createContext({ window, HTMLElement: Element, crypto: require('node:crypto').webcrypto, AbortSignal, Error,
        document: { hidden: false, getElementById: node, querySelectorAll: selector => selector === '[data-eos-ems-id]' ? [row] : [],
            addEventListener(type, fn) { events.set(type, fn); } },
        async fetch(url, options) { if (options?.method === 'PUT') writes++; return f.browserFetch(url, options); },
        async load(config) { loads++; draft = structuredClone(config); }, save(callback) { callback(draft); } });
    for (const file of ['ems-assignment.js', 'host-bridge.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../modules/devices/admin', file), 'utf8'), context);
    const settle = async predicate => {
        for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 2)); }
        assert.fail('HTTP-driven browser operation did not settle');
    };
    events.get('DOMContentLoaded')(); await settle(() => node('eosModuleSave').disabled === false && loads === 1);
    assert.match(node('eosEmsStatus').textContent, /nicht verfügbar|gestartet|Rückmeldung|vorbereitet|fehlgeschlagen/);
    assert.doesNotMatch(row.textContent, /Status nach dem Speichern verfügbar/);
    node('eosModuleSave').events.click(); await settle(() => writes === 1 && loads === 2 && node('eosModuleSave').disabled === false);
    const stored = await f.get();
    assert.equal(stored.config.devices[0].ems.activation.requested, true);
    assert.match(stored.config.devices[0].ems.activation.requestId, /^[0-9a-f-]{36}$/);
    assert.deepEqual(stored.config.futureModuleOption, { retain: true });
    assert.equal(stored.config.devices[0].connection.password, '__EOS_SECRET_UNCHANGED__');
    assert.equal(f.writes.length, 1, 'one global Save persists one authoritative Devices configuration');
    assert.equal(f.runtimes.length, 0, 'the isolated pre-start HTTP test never opens a hardware transport');
    // Real host/routes keep a concrete service error visible, instead of an absent optional field.
    assert.ok(stored.emsCommissioning, 'host view always provides its commissioning contract');
    assert.ok(row.textContent.length > 20);
    const token = stored.config.devices[0].ems.activation.requestId;
    draft.devices[0].name = 'Renamed safely';
    node('eosModuleSave').events.click(); await settle(() => writes === 2 && loads === 3 && node('eosModuleSave').disabled === false);
    assert.equal((await f.get()).config.devices[0].ems.activation.requestId, token, 'an unrelated edit cannot replay an activation');
    let simulatedService = { state: 'pending', code: 'EOS_EMS_CONFIGURATION_PENDING', statuses: [] };
    f.host().deviceEms = { view: () => simulatedService, stop() {} }; // EMS transport is deliberately isolated; HTTP/host contract stays real.
    node('eosEmsRefresh').events.click(); await settle(() => timers.size === 1);
    const currentLoads = loads; draft.devices[0].name = 'Unsaved remains';
    simulatedService = { state: 'ready', statuses: [{ deviceId: 'meter1', status: 'mapped', code: 'ACTIVATION_APPLIED', activationApplied: true, activationRequestId: token }] };
    const pending = timers.entries().next().value; timers.delete(pending[0]); pending[1]();
    await settle(() => row.textContent.includes('EMS eingerichtet'));
    assert.equal(loads, currentLoads); assert.equal(draft.devices[0].name, 'Unsaved remains');
    assert.match(row.textContent, /wartet auf gültige Messwerte/);
    assert.equal(timers.size, 0, 'completed status stops polling');
    events.get('pagehide')(); assert.equal(timers.size, 0);
});

test('real module HTTP status advances READY to failure and recovery without replacing the dirty browser draft', async t => {
    const vm = require('node:vm'), fs = require('node:fs');
    const f = await fixture(t, { enabled: true, devices: [meter] }); await f.get();
    f.host().entries.get('devices').reason = 'READY';
    f.host().deviceEms = { view: () => ({ state: 'ready', statuses: [{ deviceId: 'meter1', status: 'mapped', code: 'MAPPED' }] }), stop() {}, request() {} };
    const nodes = new Map(), timers = new Map(), events = new Map(); let draft, changed, loads = 0, timerId = 0, reads = 0;
    class Element { constructor() { this.textContent = ''; this.dataset = {}; this.events = {}; } addEventListener(type, fn) { this.events[type] = fn; } }
    const node = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
    const document = { hidden: false, getElementById: node, querySelectorAll: () => [], addEventListener(type, fn) { events.set(type, fn); } };
    const window = { setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; }, clearTimeout(id) { timers.delete(id); }, addEventListener(type, fn) { events.set(type, fn); } };
    const context = vm.createContext({ window, document, HTMLElement: Element, crypto: require('node:crypto').webcrypto, AbortSignal, Error,
        async fetch(url, options) { assert.equal(options.method, undefined, 'runtime refresh performs no mutation'); reads++; return f.browserFetch(url, options); },
        async load(config, onChange) { loads++; draft = structuredClone(config); changed = onChange; }, save(callback) { callback(draft); } });
    for (const file of ['ems-assignment.js', 'host-bridge.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../modules/devices/admin', file), 'utf8'), context);
    const settle = async predicate => { for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 2)); } assert.fail('Runtime status did not settle'); };
    const tick = async () => { const [id, timer] = timers.entries().next().value; timers.delete(id); timer.fn(); await settle(() => timers.size > 0); };
    events.get('DOMContentLoaded')(); await settle(() => loads === 1 && timers.size === 1);
    assert.match(node('eosModuleRuntimeStatus').textContent, /Startfreigabe bestätigt noch keine/);
    draft.devices[0].name = 'Customer unsaved'; changed(true);
    f.host().entries.get('devices').reason = 'START_FAILED_RESTART_REQUIRED';
    await tick(); assert.match(node('eosModuleRuntimeStatus').textContent, /konnte nicht starten/);
    assert.equal(node('eosModuleRuntimeStatus').dataset.error, 'true');
    assert.equal(node('eosModuleStatus').textContent, 'Ungespeicherte Änderungen.');
    assert.equal(timers.values().next().value.delay, 10000, 'stable status monitor uses a bounded ten-second cadence');
    await f.host().start(); f.runtimes[0].getStatus = async () => ({ state: 'running', connected: false });
    await tick(); assert.match(node('eosModuleRuntimeStatus').textContent, /Noch keine aktuellen Gerätedaten bestätigt/);
    f.runtimes[0].getStatus = async () => ({ state: 'running', connected: true });
    await tick(); assert.match(node('eosModuleRuntimeStatus').textContent, /Messwertfrische je Gerät prüfen/);
    assert.equal(loads, 1); assert.equal(draft.devices[0].name, 'Customer unsaved'); assert.equal(f.writes.length, 0);
    document.hidden = true; events.get('visibilitychange')(); assert.equal(timers.size, 0, 'hiding the page cancels its scheduled poll');
    const previousReads = reads; document.hidden = false; events.get('visibilitychange')(); await settle(() => timers.size === 1 && reads > previousReads);
    assert.equal(loads, 1); events.get('pagehide')(); assert.equal(timers.size, 0);
});
