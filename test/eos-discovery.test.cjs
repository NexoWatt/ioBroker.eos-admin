/** Copyright (c) 2026 NexoWatt. Proprietary; see LICENSE. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const { createRequire } = require('node:module');
const { createEosDiscovery } = process.env.EOS_TEST_RUNTIME === 'build'
    ? require('../build/lib/eosDiscovery')
    : require('tsx/cjs/api').require(path.resolve(__dirname, '../src/lib/eosDiscovery.ts'), __filename);

function fixture(options = {}) {
    let time = 0;
    let interfaces = { eth0: [
        { address: '192.168.10.153', family: 'IPv4', internal: false },
        { address: 'fe80::1', family: 'IPv6', internal: false },
    ], lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }] };
    const scheduled = new Set();
    const calls = { factory: [], query: [], respond: [], destroy: 0, logs: [], warnings: [] };
    const socket = new EventEmitter();
    socket.query = (packet, callback) => { calls.query.push(packet); callback?.(); };
    socket.respond = (packet, callback) => { calls.respond.push(packet); callback?.(); };
    socket.destroy = () => { calls.destroy++; };
    const dependencies = {
        interfaces: () => interfaces,
        createTransport: settings => {
            calls.factory.push(settings);
            if (options.emitReady !== false) scheduled.add({ callback: () => socket.emit('ready'), at: time });
            return socket;
        },
        now: () => time,
        random: () => 0,
        schedule: (callback, delay) => {
            const timer = { callback, at: time + delay };
            scheduled.add(timer);
            return () => scheduled.delete(timer);
        },
    };
    const discovery = createEosDiscovery({ enabled: true, hostname: 'nexowatt', port: 8188,
        adapter: { log: { info: message => calls.logs.push(message), warn: message => calls.warnings.push(message) } },
        ...options }, dependencies);
    function advance(delta) {
        const until = time + delta;
        for (let guard = 0; guard < 1000; guard++) {
            const next = [...scheduled].sort((a, b) => a.at - b.at)[0];
            if (!next || next.at > until) { time = until; return; }
            scheduled.delete(next);
            time = next.at;
            next.callback();
        }
        throw new Error('unbounded timer scheduling');
    }
    return { discovery, calls, socket, advance, scheduled, setInterfaces: value => { interfaces = value; } };
}

test('announces only its own https service after three targeted probes and excludes private metadata', () => {
    const f = fixture();
    f.discovery.start(); f.discovery.start();
    f.advance(749);
    assert.equal(f.calls.factory.length, 1);
    assert.equal(f.calls.query.length, 3);
    assert.equal(f.calls.respond.length, 0);
    assert.deepEqual(f.calls.query[0].questions.map(record => record.name), ['nexowatt.local', 'nexowatt._https._tcp.local']);
    f.advance(1);
    const records = f.calls.respond[0].answers;
    assert.deepEqual(records.filter(record => record.type === 'A').map(record => record.data), ['192.168.10.153']);
    assert.equal(records.some(record => record.type === 'AAAA'), false, 'IPv4 bind cannot advertise unreachable IPv6 listener');
    assert.deepEqual(records.find(record => record.type === 'SRV').data,
        { port: 8188, target: 'nexowatt.local', priority: 0, weight: 0 });
    assert.deepEqual(records.find(record => record.type === 'TXT').data.map(value => value.toString()), ['path=/']);
    assert.match(f.calls.logs[0], /EOS_MDNS_READY/);
    assert.equal(f.calls.logs.some(line => line.includes(':443/')), false);
    f.discovery.stop(); f.discovery.stop();
    assert.equal(f.calls.destroy, 1);
    assert.ok(f.calls.respond.at(-1).answers.every(record => record.ttl === 0));
    f.advance(120000);
    assert.equal(f.scheduled.size, 0);
});

test('generated probes and announcements round-trip through the shipped DNS packet codec', () => {
    const codec = createRequire(require.resolve('multicast-dns'))('dns-packet');
    const f = fixture(); f.discovery.start(); f.advance(750);
    for (const [type, packets] of [['query', f.calls.query], ['response', f.calls.respond]]) {
        for (const packet of packets) {
            const encoded = codec.encode({ ...packet, type });
            assert.ok(encoded.length < 2048);
            const decoded = codec.decode(encoded);
            assert.equal(decoded.type, type);
            if (type === 'query') assert.equal(decoded.authorities.length, 3);
            else assert.equal(decoded.answers.find(record => record.type === 'SRV').data.target, 'nexowatt.local');
        }
    }
    f.discovery.stop();
});

test('disabled/invalid configuration does not open a socket or throw', () => {
    for (const options of [{ enabled: false }, { hostname: 'nexowatt.local' }, { hostname: 'bad;name' },
        { hostname: '' }, { hostname: 'a'.repeat(64) }, { port: 0 }, { port: 65536 }, { port: 8188.5 }, { bind: 'external.example' }]) {
        const f = fixture(options);
        assert.doesNotThrow(() => f.discovery.start());
        assert.equal(f.calls.factory.length, 0);
        f.discovery.stop();
    }
});

test('host collision during probing stops publication without changing hostname or EOS', () => {
    const f = fixture(); f.discovery.start(); f.advance(0);
    f.socket.emit('response', { answers: [{ name: 'NexoWatt.local.', type: 'A', ttl: 120, data: '192.168.10.154' }] });
    f.advance(10000);
    assert.equal(f.calls.respond.length, 0);
    assert.equal(f.calls.destroy, 1);
    assert.match(f.calls.warnings[0], /EOS_MDNS_NAME_CONFLICT/);
    assert.equal(f.scheduled.size, 0);
});

test('different simultaneous host claim and incompatible service identity fail closed', () => {
    for (const record of [
        { name: 'nexowatt.local', type: 'AAAA', data: 'fe80::2' },
        { name: 'nexowatt._https._tcp.local', type: 'SRV', data: { target: 'other.local', port: 8188 } },
        { name: 'nexowatt._https._tcp.local', type: 'SRV', data: { target: 'nexowatt.local', port: 1234 } },
    ]) {
        const f = fixture(); f.discovery.start(); f.advance(0);
        f.socket.emit('query', { authorities: [{ ...record, ttl: 120 }] });
        f.advance(1000);
        assert.equal(f.calls.destroy, 1);
        assert.equal(f.calls.respond.length, 0);
    }
});

test('own addresses, IPv6 textual variants and expired foreign answers do not conflict', () => {
    const f = fixture(); f.discovery.start();
    for (const record of [
        { name: 'nexowatt.local', type: 'A', ttl: 120, data: '192.168.10.153' },
        { name: 'nexowatt.local', type: 'AAAA', ttl: 120, data: 'fe80:0:0:0:0:0:0:1' },
        { name: 'nexowatt.local', type: 'A', ttl: 0, data: '192.168.10.199' },
    ]) f.socket.emit('response', { answers: [record] });
    f.advance(750);
    assert.equal(f.calls.warnings.length, 0);
    assert.equal(f.calls.respond.length, 1);
    f.discovery.stop();
});

test('post-publication conflict withdraws records and closes discovery', () => {
    const f = fixture(); f.discovery.start(); f.advance(750);
    f.socket.emit('response', { answers: [{ name: 'nexowatt.local', type: 'A', ttl: 120, data: '192.168.10.154' }] });
    assert.equal(f.calls.destroy, 1);
    assert.ok(f.calls.respond.at(-1).answers.every(record => record.ttl === 0));
    f.advance(120000);
    assert.equal(f.calls.query.length, 3);
});

test('responses are bounded to own names and one per second; malformed data is ignored', () => {
    const f = fixture(); f.discovery.start(); f.advance(1750);
    const initial = f.calls.respond.length;
    for (const packet of [null, [], { questions: null }, { questions: [null, 3, { name: 'other.local', type: 'ANY' }] }]) {
        f.socket.emit('query', packet);
    }
    assert.equal(f.calls.respond.length, initial);
    for (let count = 0; count < 100; count++) {
        f.socket.emit('query', { questions: [{ name: 'nexowatt.local', type: 'A' }] });
    }
    assert.equal(f.calls.respond.length, initial + 1);
    assert.equal(f.calls.respond.at(-1).answers.length, 1);
    f.advance(1000);
    f.socket.emit('query', { questions: [{ name: '_https._tcp.local', type: 'PTR' }] });
    assert.ok(f.calls.respond.at(-1).answers.some(record => record.type === 'SRV'));
    assert.equal(f.calls.warnings.length, 0);
    f.discovery.stop();
});

test('no addresses, UDP errors and probe failures are nonfatal and leave no retry storm', () => {
    const absent = fixture(); absent.setInterfaces({}); absent.discovery.start();
    assert.equal(absent.calls.factory.length, 0);
    assert.match(absent.calls.warnings[0], /NO_LOCAL_ADDRESS/);
    const failed = fixture(); failed.discovery.start(); failed.socket.emit('error', new Error('secret socket details'));
    failed.advance(120000);
    assert.equal(failed.calls.destroy, 1);
    assert.equal(failed.calls.warnings.length, 1);
    assert.equal(failed.calls.warnings[0].includes('secret'), false);
    const probe = fixture();
    probe.socket.query = (_packet, callback) => callback(new Error('send failed'));
    probe.discovery.start(); probe.advance(10000);
    assert.equal(probe.calls.destroy, 1);
    assert.equal(probe.scheduled.size, 0);
});

test('stopping during probe and a missing goodbye callback both close within bounds', () => {
    const probing = fixture(); probing.discovery.start(); probing.advance(250); probing.discovery.stop();
    probing.advance(120000);
    assert.equal(probing.calls.destroy, 1);
    assert.equal(probing.calls.respond.length, 0);
    const ready = fixture(); ready.discovery.start(); ready.advance(750);
    ready.socket.respond = packet => ready.calls.respond.push(packet);
    ready.discovery.stop();
    assert.equal(ready.calls.destroy, 0);
    ready.advance(100);
    assert.equal(ready.calls.destroy, 1);
    assert.equal(ready.scheduled.size, 0);
});

test('UDP readiness and first publication callbacks have a bounded startup deadline', () => {
    const unbound = fixture({ emitReady: false }); unbound.discovery.start(); unbound.advance(4000);
    assert.equal(unbound.calls.query.length, 0);
    assert.equal(unbound.calls.destroy, 1);
    assert.match(unbound.calls.warnings[0], /START_TIMEOUT/);
    const unsent = fixture();
    unsent.socket.respond = packet => unsent.calls.respond.push(packet);
    unsent.discovery.start(); unsent.advance(4000);
    assert.equal(unsent.calls.logs.length, 0, 'no READY claim without the first successful UDP send callback');
    assert.match(unsent.calls.warnings[0], /START_TIMEOUT/);
    unsent.advance(100);
    assert.equal(unsent.calls.destroy, 1);
    assert.equal(unsent.scheduled.size, 0);
});

test('address changes withdraw old records and reprobe; specific bind and IPv6 follow listener', () => {
    const f = fixture(); f.discovery.start(); f.advance(750);
    f.setInterfaces({ eth0: [{ address: '192.168.10.154', family: 'IPv4', internal: false }] });
    f.advance(60000);
    assert.ok(f.calls.respond.at(-1).answers.every(record => record.ttl === 0));
    f.advance(750);
    assert.equal(f.calls.query.length, 6);
    assert.deepEqual(f.calls.respond.at(-1).answers.filter(record => record.type === 'A').map(record => record.data), ['192.168.10.154']);
    f.discovery.stop();
    const specific = fixture({ bind: '192.168.10.153' }); specific.discovery.start(); specific.advance(750);
    assert.equal(specific.calls.factory[0].interface, '192.168.10.153'); specific.discovery.stop();
    const ipv6 = fixture({ bind: '::' }); ipv6.discovery.start(); ipv6.advance(750);
    assert.equal(ipv6.calls.respond[0].answers.some(record => record.type === 'A'), false);
    assert.equal(ipv6.calls.respond[0].answers.find(record => record.type === 'AAAA').data, 'fe80::1'); ipv6.discovery.stop();
});
