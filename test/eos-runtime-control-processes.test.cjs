'use strict';
// Real production Devices/OCPP workers and RuntimeControl/ModuleHost; only the
// controller database and loopback charging station are fixtures. No hardware.
const test = require('node:test');
const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { once } = require('node:events');
const WebSocket = require('ws');
const { EosModuleHost } = require('../src/lib/eosModuleHost');
const { EosRuntimeControl } = require('../src/lib/eosRuntimeControl');
const { EosModuleConfigStore } = require('../src/lib/eosModuleConfigStore');
const baseDir = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const clone = value => value == null ? value : structuredClone(value);
const matches = (pattern, id) => new RegExp('^' + pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(id);
async function until(check, label, timeout = 10000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { if (await check()) return; await delay(20); }
    assert.fail(`Timed out: ${label}`);
}
async function unusedPort() {
    const server = net.createServer();
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    return port;
}
function assertExited(pid) { assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' }); }

async function fixture(t, { devicesEnabled = true, preservedNamespace = false } = {}) {
    const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'eos-runtime-control-processes-'));
    const port = await unusedPort();
    const namespace = preservedNamespace ? 'ocpp21.2' : 'eos-admin.0.ocpp';
    const station = `${namespace}.fixture-station`;
    const encode = text => `fixture:${Buffer.from(text).toString('base64')}`;
    const decode = text => { assert.ok(text.startsWith('fixture:')); return Buffer.from(text.slice(8), 'base64').toString(); };
    const moduleConfig = {
        devices: { enabled: devicesEnabled, devices: [] }, eebus: { enabled: false }, backup: { enabled: false },
        ocpp: { enabled: true, port, identityAllowlist: ['fixture-station'], callTimeoutSec: 5, activeRefresh: false, smartChargingMinIntervalMs: 1000 },
    };
    const config = { eosUi: {}, eosModules: Object.fromEntries(Object.entries(moduleConfig).map(([id, value]) => [id, { v: 1, encrypted: encode(JSON.stringify(value)) }])) };
    if (preservedNamespace) config.eosModules.ocpp.migration = { source: namespace, preserveNamespace: true, sourceVersion: '0.4.3' };
    const objects = new Map(), states = new Map(), subscriptions = new Map(), logs = [], clients = [], generations = [], heldReads = [];
    let currentHost, currentControl, holdRead;
    const select = (values, pattern) => Object.fromEntries([...values].filter(([id]) => Array.isArray(pattern) ? pattern.includes(id) : matches(pattern || '*', id)).map(([id, value]) => [id, clone(value)]));
    const subscribe = pattern => subscriptions.set(pattern, (subscriptions.get(pattern) || 0) + 1);
    const unsubscribe = pattern => { const count = subscriptions.get(pattern) || 0; if (count <= 1) subscriptions.delete(pattern); else subscriptions.set(pattern, count - 1); };
    const owner = {
        namespace: 'eos-admin.0', instance: 0, config, encrypt: encode, decrypt: decode,
        log: Object.fromEntries(['info', 'warn', 'error', 'debug'].map(level => [level, message => logs.push({ level, message })])),
        eosLicenseService: { allowsEmbeddedModule: () => true, statusView: () => ({ valid: true, coreEnabled: true }) },
        eosOwnership: { canWrite: () => true }, eosMigration: { allowsStartup: () => true },
        async getForeignObjectAsync(id) {
            if (id === 'system.adapter.eos-admin.0') return { _id: id, type: 'instance', common: { enabled: true, host: 'fixture' }, native: clone(config) };
            return clone(objects.get(id) || null);
        },
        async getForeignObjectsAsync(pattern) { return select(objects, pattern); },
        async getObjectViewAsync(_design, type, range = {}) { return { rows: [...objects].filter(([id, object]) =>
            (!range.startkey || id >= range.startkey) && (!range.endkey || id <= range.endkey) && (type !== 'instance' || object.type === 'instance'))
            .map(([id, value]) => ({ id, value: clone(value) })) }; },
        async getForeignStateAsync(id) {
            if (holdRead?.id === id) { const hold = holdRead; holdRead = null; hold.entered = true; await hold.wait; }
            return clone(states.get(id) || null);
        },
        async getForeignStatesAsync(pattern) { return select(states, pattern); },
        async setForeignObjectAsync(id, value) { objects.set(id, { ...clone(value), _id: id }); },
        async setForeignObjectNotExistsAsync(id, value) {
            if (objects.has(id)) return;
            objects.set(id, { ...clone(value), _id: id });
            if (value.common?.def !== undefined && !states.has(id)) await owner.setForeignStateAsync(id, { val: value.common.def, ack: true });
        },
        async extendForeignObjectAsync(id, patch) { const previous = objects.get(id) || {}; objects.set(id, { ...previous, ...clone(patch), _id: id,
            common: { ...previous.common, ...patch.common }, native: { ...previous.native, ...patch.native } }); },
        async delForeignObjectAsync(id) { objects.delete(id); }, async delForeignStateAsync(id) { states.delete(id); },
        async setForeignStateAsync(id, value, ack) {
            const state = { ...(value && typeof value === 'object' ? clone(value) : { val: value, ack: ack === true }),
                ts: Date.now(), lc: Date.now(), from: 'system.adapter.eos-admin.0', q: 0 };
            states.set(id, state);
            queueMicrotask(() => currentHost?.onStateChange(id, clone(state)));
        },
        async setForeignStateChangedAsync(id, value, ack) {
            const val = value && typeof value === 'object' ? value.val : value;
            if (!states.has(id) || JSON.stringify(states.get(id).val) !== JSON.stringify(val)) await owner.setForeignStateAsync(id, value, ack);
        },
        async subscribeForeignStatesAsync(pattern) { subscribe(pattern); }, async unsubscribeForeignStatesAsync(pattern) { unsubscribe(pattern); },
        async subscribeForeignObjectsAsync() {}, async unsubscribeForeignObjectsAsync() {},
        eosStateSubscriptions: { async acquireHost(pattern) { subscribe(pattern); let active = true; return async () => { if (active) { active = false; unsubscribe(pattern); } }; } },
    };
    if (preservedNamespace) {
        const ts = Date.now() - 100;
        objects.set(`system.adapter.${namespace}`, { _id: `system.adapter.${namespace}`, type: 'instance', ts, common: { enabled: false, host: 'fixture', version: '0.4.3' }, native: {} });
        states.set(`system.adapter.${namespace}.alive`, { val: false, ack: true, ts: ts + 1 });
        states.set('system.host.fixture.alive', { val: true, ack: true, ts: Date.now() });
    }
    const untouchedModuleConfig = clone(config.eosModules);
    const newGeneration = async () => {
        let control;
        const host = new EosModuleHost(owner, { baseDir, dataDir: path.join(root, 'modules'), eosDataDir: root, installationDir: root,
            processEnabled: id => control?.isEnabled(id) === true });
        control = new EosRuntimeControl({ owner, host, runtime: {
            async pause() { assert.fail('module action must not pause UI'); }, async resume() { assert.fail('module action must not resume UI'); }, status() { return {}; },
        } });
        generations.push({ host, control }); currentHost = host; currentControl = control;
        await control.initialize(); await host.start();
        return { host, control };
    };
    t.after(async () => {
        for (const hold of heldReads) hold.release();
        for (const item of [...generations].reverse()) { await item.control.close(); await item.host.stop(); }
        for (const client of clients) client.socket.terminate();
        await fsp.rm(root, { recursive: true, force: true });
    });
    await newGeneration();
    const health = id => currentHost.entries.get(id).module?.health() || null;
    const action = async (id, operation) => {
        const accepted = currentControl.request(id, operation, currentControl.view(id).revision);
        assert.deepEqual(accepted, { ok: true, accepted: true });
        await currentControl.whenIdle();
        return currentControl.view(id, currentHost.entries.get(id).config.enabled);
    };
    const connect = async () => {
        const socket = new WebSocket(`ws://127.0.0.1:${port}/fixture-station`, 'ocpp1.6');
        const client = { socket, limits: [], calls: [], closed: false }; clients.push(client);
        const pending = new Map(); let sequence = 0;
        socket.on('close', () => { client.closed = true; for (const operation of pending.values()) operation.reject(new Error('fixture station closed')); pending.clear(); });
        socket.on('error', () => {});
        socket.on('message', raw => {
            const message = JSON.parse(raw.toString());
            if (message[0] === 2) {
                client.calls.push(message[2]);
                if (message[2] === 'SetChargingProfile') client.limits.push(message[3].csChargingProfiles.chargingSchedule.chargingSchedulePeriod[0].limit);
                const response = message[2] === 'GetConfiguration' ? { configurationKey: [], unknownKey: [] } : { status: 'Accepted' };
                socket.send(JSON.stringify([3, message[1], response]));
            } else pending.get(message[1])?.resolve(message);
        });
        await once(socket, 'open');
        client.call = (method, payload) => new Promise((resolve, reject) => {
            const id = `runtime-control-${++sequence}`;
            const timer = setTimeout(() => { pending.delete(id); reject(new Error(`fixture call timeout: ${method}`)); }, 5000);
            const finish = () => { clearTimeout(timer); pending.delete(id); };
            pending.set(id, { resolve(value) { finish(); if (value[0] === 3) resolve(value[2]); else reject(new Error(JSON.stringify(value))); }, reject(error) { finish(); reject(error); } });
            socket.send(JSON.stringify([2, id, method, payload]));
        });
        assert.equal((await client.call('BootNotification', { chargePointVendor: 'Fixture', chargePointModel: 'NoHardware' })).status, 'Accepted');
        await until(() => states.get(`${station}.info.socketConnected`)?.val === true, 'station connected state');
        return client;
    };
    return { owner, objects, states, logs, port, namespace, station, untouchedModuleConfig, health, action, connect, newGeneration,
        get host() { return currentHost; }, get control() { return currentControl; },
        write: (id, val) => owner.setForeignStateAsync(id, { val, ack: false }),
        blockRead(id) { let release; const wait = new Promise(resolve => { release = resolve; }); const hold = { id, wait, release, entered: false }; holdRead = hold; heldReads.push(hold); return hold; },
    };
}

test('actual Devices disable, enable and restart replace only its PID/generation and preserve the OCPP socket', { timeout: 45000 }, async t => {
    const f = await fixture(t), client = await f.connect();
    const devices = f.health('devices'), ocpp = f.health('ocpp');
    assert.ok(devices.pid > 0 && ocpp.pid > 0); assert.notEqual(devices.pid, ocpp.pid);
    assert.equal((await f.action('devices', 'disable')).enabled, false);
    assert.equal(f.health('devices'), null); assertExited(devices.pid);
    assert.equal(f.health('ocpp').pid, ocpp.pid); assert.equal(client.closed, false);
    assert.equal(typeof (await client.call('Heartbeat', {})).currentTime, 'string');
    assert.equal((await f.action('devices', 'enable')).reason, '');
    const enabled = f.health('devices');
    assert.ok(enabled.pid > 0); assert.notEqual(enabled.pid, devices.pid); assert.ok(enabled.generation > devices.generation);
    assert.equal((await f.action('devices', 'restart')).reason, '');
    const restarted = f.health('devices');
    assert.notEqual(restarted.pid, enabled.pid); assert.ok(restarted.generation > enabled.generation); assertExited(enabled.pid);
    assert.equal(f.health('ocpp').pid, ocpp.pid); assert.equal(f.health('ocpp').generation, ocpp.generation); assert.equal(client.closed, false);
    assert.equal(typeof (await client.call('Heartbeat', {})).currentTime, 'string');
    assert.deepEqual(f.owner.config.eosModules, f.untouchedModuleConfig);
});

for (const preservedNamespace of [false, true]) {
    test(`actual OCPP process controls preserve ${preservedNamespace ? 'imported' : 'native'} namespace and never replay a command from the old child`, { timeout: 45000 }, async t => {
        const f = await fixture(t, { preservedNamespace }), firstClient = await f.connect();
        const devices = f.health('devices'), firstOcpp = f.health('ocpp');
        assert.equal((await f.host.status('ocpp')).namespace, f.namespace);
        const hold = f.blockRead(`${f.station}.control.chargeLimitType`);
        t.after(() => hold.release());
        await f.write(`${f.station}.control.chargeLimit`, 7100);
        await until(() => hold.entered, 'old positive command waiting on actual parent state read');
        const accepted = f.control.request('ocpp', 'disable', f.control.view('ocpp').revision);
        assert.equal(accepted.accepted, true);
        await until(() => f.host.entries.get('ocpp').generation > firstOcpp.generation, 'old OCPP generation revoked');
        hold.release(); await f.control.whenIdle();
        await until(() => firstClient.closed, 'old station socket closed');
        assertExited(firstOcpp.pid); assert.deepEqual(firstClient.limits, []);
        assert.equal(f.health('devices').pid, devices.pid); assert.equal(f.health('devices').generation, devices.generation);
        assert.equal(f.states.get(`${f.station}.control.chargeLimit`).val, 7100, 'the old stored command remains as a replay trap');
        assert.equal((await f.action('ocpp', 'enable')).reason, '');
        const secondOcpp = f.health('ocpp'), secondClient = await f.connect();
        assert.notEqual(secondOcpp.pid, firstOcpp.pid); assert.ok(secondOcpp.generation > firstOcpp.generation);
        assert.deepEqual(secondClient.limits, [], 'connection must not replay the stored old positive command');
        const wrongRoot = preservedNamespace ? 'eos-admin.0.ocpp' : 'ocpp21.2';
        await f.write(`${wrongRoot}.fixture-station.control.chargeLimit`, 9900);
        await f.write(`${f.station}.control.chargeLimit`, 4200);
        await until(() => secondClient.limits.length > 0, 'fresh command reaches new child');
        await until(() => {
            try { const value = JSON.parse(f.states.get(`${f.station}.control.chargeLimitStatus`)?.val); return value.valid === true && value.appliedW === 4200; }
            catch { return false; }
        }, 'fresh accepted profile published');
        assert.deepEqual(secondClient.limits, [4200], 'only the fresh correctly scoped command is transmitted');
        assert.equal((await f.action('ocpp', 'restart')).reason, '');
        await until(() => secondClient.closed, 'restart closes previous station session'); assertExited(secondOcpp.pid);
        const thirdOcpp = f.health('ocpp'), thirdClient = await f.connect();
        assert.notEqual(thirdOcpp.pid, secondOcpp.pid); assert.ok(thirdOcpp.generation > secondOcpp.generation);
        assert.equal(typeof (await thirdClient.call('Heartbeat', {})).currentTime, 'string');
        assert.deepEqual(thirdClient.limits, [], 'restart must not restore the last positive target');
        assert.equal(f.health('devices').pid, devices.pid); assert.equal(f.health('devices').generation, devices.generation);
        assert.equal((await f.host.status('ocpp')).namespace, f.namespace);
        assert.deepEqual(f.owner.config.eosModules, f.untouchedModuleConfig);
    });
}

test('persisted Devices process disable survives a fresh Host and RuntimeControl without altering module configuration', { timeout: 45000 }, async t => {
    const f = await fixture(t);
    const devices = f.health('devices'), ocpp = f.health('ocpp');
    await f.action('devices', 'disable');
    const store = new EosModuleConfigStore(f.owner, { moduleIds: ['runtime'] });
    const envelope = await store.load('runtime');
    const saved = JSON.parse(f.owner.decrypt(envelope.encrypted));
    assert.equal(saved.enabled.devices, false); assert.equal(saved.enabled.ocpp, true);
    await f.control.close(); await f.host.stop(); assertExited(devices.pid); assertExited(ocpp.pid);
    await f.newGeneration();
    assert.equal(f.control.isEnabled('devices'), false); assert.equal(f.health('devices'), null);
    assert.equal(f.host.entries.get('devices').generation, 0, 'disabled child must never be constructed after reload');
    assert.equal((await f.host.status('devices')).reason, 'EOS_RUNTIME_DISABLED');
    assert.ok(f.health('ocpp').pid > 0); assert.notEqual(f.health('ocpp').pid, ocpp.pid);
    const client = await f.connect(); assert.equal(typeof (await client.call('Heartbeat', {})).currentTime, 'string');
    assert.equal((await f.action('devices', 'enable')).reason, ''); assert.ok(f.health('devices').pid > 0);
    assert.deepEqual(f.owner.config.eosModules, f.untouchedModuleConfig);
});

test('process enable cannot activate a Devices module whose own configuration is disabled', { timeout: 30000 }, async t => {
    const f = await fixture(t, { devicesEnabled: false }), client = await f.connect();
    const ocpp = f.health('ocpp'); assert.equal(f.health('devices'), null);
    await f.action('devices', 'disable');
    const result = await f.action('devices', 'enable');
    assert.equal(result.enabled, false); assert.equal(result.reason, 'EOS_RUNTIME_MODULE_DISABLED'); assert.equal(result.canEnable, false);
    assert.equal(f.health('devices'), null); assert.equal(f.host.entries.get('devices').config.enabled, false);
    assert.equal(f.health('ocpp').pid, ocpp.pid); assert.equal(client.closed, false);
    assert.equal(typeof (await client.call('Heartbeat', {})).currentTime, 'string');
    assert.deepEqual(f.owner.config.eosModules, f.untouchedModuleConfig);
});
