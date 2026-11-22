'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
require('./fixtures/socket-library-bootstrap.cjs');

function clock() {
    let now = 0; let nextId = 1;
    const timers = new Map();
    const add = (callback, delay, interval) => {
        const id = nextId++;
        timers.set(id, { callback, at: now + delay, interval });
        return id;
    };
    return {
        now: () => now,
        setTimeout: (callback, delay) => add(callback, delay, 0),
        setInterval: (callback, delay) => add(callback, delay, delay),
        clearTimeout: id => timers.delete(id),
        clearInterval: id => timers.delete(id),
        count: () => timers.size,
        async tick(duration) {
            const end = now + duration;
            while (true) {
                const entry = [...timers.entries()].filter(([, item]) => item.at <= end)
                    .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
                if (!entry) break;
                const [id, item] = entry;
                now = item.at;
                if (item.interval) item.at += item.interval; else timers.delete(id);
                item.callback();
                for (let i = 0; i < 12; i++) await Promise.resolve();
            }
            now = end;
            for (let i = 0; i < 12; i++) await Promise.resolve();
        },
    };
}

function load(time) {
    const built = process.env.EOS_TEST_RUNTIME === 'build';
    const file = path.resolve(__dirname, built ? '../build/lib/eosSocketAdmin.js' : '../src/lib/eosSocketAdmin.ts');
    const req = createRequire(file);
    const source = fs.readFileSync(file, 'utf8');
    const js = built ? source : require('typescript').transpileModule(source, {
        compilerOptions: { target: 9, module: 1, esModuleInterop: true },
    }).outputText;
    const exports = {};
    vm.runInNewContext(js, {
        exports, module: { exports }, Date,
        setInterval: time.setInterval, clearInterval: time.clearInterval,
        setTimeout: time.setTimeout, clearTimeout: time.clearTimeout,
        require: name => name === 'node:perf_hooks' ? { performance: { now: time.now } } : req(name),
    }, { filename: file });
    return exports.EosSocketAdmin;
}

function fixture(overrides = {}) {
    const time = clock();
    const EosSocketAdmin = load(time);
    const calls = []; const logs = []; const notifications = [];
    const adapter = {
        name: 'eos-admin', namespace: 'eos-admin.0', config: { thresholdValue: 200 },
        log: Object.fromEntries(['debug', 'info', 'warn', 'error', 'silly'].map(level => [level, line => logs.push([level, line])])),
        subscribeForeignStatesAsync: async pattern => { calls.push(['subscribe', pattern]); },
        unsubscribeForeignStatesAsync: async pattern => { calls.push(['unsubscribe', pattern]); },
        subscribeForeignObjectsAsync: async () => undefined,
        getForeignObjectAsync: async () => null,
        ...overrides,
    };
    const socket = new EosSocketAdmin({ language: 'de', defaultUser: 'admin', ttl: 3600 }, adapter, {});
    socket.commands.start(enabled => notifications.push(enabled));
    return { socket, time, adapter, calls, logs, notifications };
}

async function burst(f, seconds = 3) {
    for (let second = 0; second < seconds; second++) {
        for (let index = 0; index < 201; index++) f.socket.stateChange(`fixture.${index}`, { val: index, ack: true });
        await f.time.tick(1000);
    }
}

test('original socket-classes 2.10.0 reproduces the reported unhandled rejection before any browser subscription', () => {
    const result = spawnSync(process.execPath, [path.join(__dirname, 'fixtures/socket-threshold-original.cjs')], {
        encoding: 'utf8', timeout: 5000,
    });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /TypeError: Cannot convert undefined or null to object/);
    assert.match(result.stderr, /Object.keys/);
    assert.match(result.stderr, /socketCommandsAdmin\.js/);
});

test('startup burst without browser enters and recovers threshold without exception', async () => {
    const f = fixture();
    try {
        assert.equal(Object.keys(f.socket.commands.subscribes.stateChange).length, 0);
        await burst(f);
        await f.time.tick(100);
        assert.deepEqual(f.notifications, [true]);
        assert.deepEqual(f.calls, [['subscribe', 'system.adapter.*']]);
        assert.ok(f.logs.some(([, line]) => line.startsWith('Unsubscribe from all states')));
        await f.time.tick(60_950);
        assert.deepEqual(f.notifications, [true, false]);
        assert.deepEqual(f.calls.at(-1), ['unsubscribe', 'system.adapter.*']);
        assert.ok(f.logs.some(([, line]) => line === 'Subscribe to all states again'));
    } finally { f.socket.close(); }
    assert.equal(f.time.count(), 0);
});

test('the configured threshold and three consecutive intervals remain enforced', async () => {
    const f = fixture({ config: { thresholdValue: 250 } });
    try {
        await burst(f, 4);
        await f.time.tick(100);
        assert.deepEqual(f.notifications, []);
        for (let second = 0; second < 3; second++) {
            for (let index = 0; index < 251; index++) f.socket.stateChange('fixture.value', null);
            await f.time.tick(1000);
        }
        await f.time.tick(100);
        assert.deepEqual(f.notifications, [true]);
    } finally { f.socket.close(); }
});

test('browser unsubscribe and recovery use the current subscription map, including a newly connected client', async () => {
    const f = fixture();
    try {
        const client = { subscribe: {}, _acl: { user: 'system.user.admin' } };
        f.socket.commands.subscribe(client, 'stateChange', 'meter.*');
        await burst(f); await f.time.tick(100);
        assert.deepEqual(f.calls.slice(0, 3), [['subscribe', 'meter.*'], ['unsubscribe', 'meter.*'], ['subscribe', 'system.adapter.*']]);
        f.socket.commands.unsubscribe(client, 'stateChange', 'meter.*');
        f.socket.commands.subscribe(client, 'stateChange', 'new-meter.*');
        f.socket.commands.disableEventThreshold();
        await f.time.tick(50);
        assert.deepEqual(f.notifications, [true, false]);
        assert.deepEqual(f.calls.at(-1), ['subscribe', 'new-meter.*']);
        assert.equal(f.calls.filter(([command, pattern]) => command === 'subscribe' && pattern === 'meter.*').length, 1);
    } finally { f.socket.close(); }
});

test('threshold suppresses browser traffic still delivered to EMS while keeping system events under upstream ACLs', async () => {
    let aclReads = 0;
    const f = fixture({ mayRead: async () => { aclReads++; return false; } });
    const emitted = [];
    const admin = { _acl: { user: 'system.user.admin' }, subscribe: { stateChange: [{ pattern: '*', regex: /.*/ }] }, emit: (...args) => emitted.push(args) };
    const denied = { _acl: { user: 'system.user.denied' }, subscribe: { stateChange: [{ pattern: '*', regex: /.*/ }] }, emit: () => assert.fail('ACL-denied data exposed') };
    f.socket.getSocketsList = () => [admin, denied];
    try {
        await burst(f); await f.time.tick(100);
        emitted.length = 0;
        f.socket.stateChange('meter.power', { val: 123, ack: true });
        assert.equal(emitted.length, 0);
        f.socket.stateChange('system.adapter.fixture.0.alive', { val: true, ack: true });
        await f.time.tick(0);
        assert.equal(emitted.length, 1);
        assert.equal(emitted[0][1], 'system.adapter.fixture.0.alive');
        assert.ok(aclReads > 0);
        f.socket.commands.disableEventThreshold(); await f.time.tick(50);
        f.socket.stateChange('meter.power', { val: 124, ack: true });
        await f.time.tick(0);
        assert.equal(emitted.length, 2);
    } finally { f.socket.close(); }
});

test('closing before either delayed threshold transition cancels all work and repeated close is safe', async () => {
    for (const recovering of [false, true]) {
        const f = fixture();
        await burst(f);
        if (recovering) {
            await f.time.tick(100);
            f.socket.commands.disableEventThreshold();
        }
        const before = f.calls.length;
        f.socket.close(); f.socket.close();
        await f.time.tick(70_000);
        assert.equal(f.calls.length, before);
        assert.equal(f.time.count(), 0);
        f.socket.stateChange('fixture.late', null);
        assert.equal(f.calls.length, before);
    }
});

test('stop during an awaited unsubscribe prevents subsequent transition requests', async () => {
    let release;
    const f = fixture({ unsubscribeForeignStatesAsync: () => new Promise(resolve => { release = resolve; }) });
    f.socket.commands.subscribe(null, 'stateChange', 'meter.*');
    await burst(f); await f.time.tick(100);
    assert.equal(typeof release, 'function');
    f.socket.close(); release(); await f.time.tick(0);
    assert.deepEqual(f.calls, [['subscribe', 'meter.*']]);
    assert.equal(f.time.count(), 0);
});

test('explicit browser threshold command preserves permission checks and uses the cancellable lifecycle', async () => {
    const f = fixture();
    const permissionErrors = [];
    const denied = { _acl: { user: 'system.user.viewer', other: { execute: false } }, emit: (...args) => permissionErrors.push(args) };
    const admin = { _acl: { user: 'system.user.admin' }, emit() {} };
    const command = f.socket.commands.getCommandHandler('eventsThreshold');
    command(denied, true);
    for (const invalid of ['true', 1, null, {}, undefined]) command(admin, invalid);
    await f.time.tick(100);
    assert.equal(f.calls.length, 0);
    assert.equal(permissionErrors[0][0], 'permissionError');
    command(admin, true);
    await f.time.tick(100);
    assert.deepEqual(f.notifications, [true]);
    command(admin, false);
    await f.time.tick(50);
    assert.deepEqual(f.notifications, [true, false]);
    command(admin, true);
    const before = f.calls.length;
    f.socket.close();
    await f.time.tick(2000);
    assert.equal(f.calls.length, before);
    assert.equal(f.time.count(), 0);
    command(admin, true);
    assert.equal(f.time.count(), 0);
});

test('subscription rejection and notification exceptions are handled locally without process-level suppression', async () => {
    const f = fixture({ subscribeForeignStatesAsync: async () => { throw new Error('fixture failure'); } });
    try {
        await burst(f); await f.time.tick(100);
        assert.ok(f.logs.some(([, line]) => line.startsWith('EOS_SOCKET_THRESHOLD_SUBSCRIBE_FAILED')));
        f.socket.commands.disableEventThreshold(); await f.time.tick(50);
        f.socket.thresholdChanged = () => { throw new Error('fixture notification error'); };
        await burst(f); await f.time.tick(100);
        assert.ok(f.logs.some(([, line]) => line.startsWith('EOS_SOCKET_THRESHOLD_FAILED')));
    } finally { f.socket.close(); }
});
