'use strict';
// Real UDP datagrams, real Speedwire parser/hub, real Devices runtime and host.
// Only the ioBroker persistence/ownership API is represented by an in-memory DB.
const test = require('node:test');
const assert = require('node:assert/strict');
const dgram = require('node:dgram');
const path = require('node:path');
const sourceRoot = process.env.EOS_UDP_SOURCE_ROOT || path.resolve(__dirname, '..');
const { EosModuleHost } = require(path.join(sourceRoot, 'src/lib/eosModuleHost'));
const deviceModule = require(path.join(sourceRoot, 'modules/devices'));
const { DeviceRuntime } = require(path.join(sourceRoot, 'modules/devices/lib/deviceRuntime'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitUntil(predicate, message, timeout = 5000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { if (predicate()) return; await sleep(30); }
    assert.fail(typeof message === 'function' ? await message() : message);
}

function telegram(importW, exportW = 0) {
    const buffer = Buffer.alloc(52);
    buffer.write('SMA\0', 0, 'ascii'); buffer.writeUInt16BE(0x6069, 16);
    buffer.writeUInt16BE(349, 18); buffer.writeUInt32BE(12345678, 20);
    buffer.writeUInt32BE(Date.now() >>> 0, 24);
    for (const [offset, obis, watts] of [[28, 1, importW], [36, 2, exportW]]) {
        buffer[offset] = 0; buffer[offset + 1] = obis; buffer[offset + 2] = 4; buffer[offset + 3] = 0;
        buffer.writeInt32BE(Math.round(watts * 10), offset + 4);
    }
    return buffer;
}

async function fixture(t) {
    const reservation = dgram.createSocket('udp4');
    await new Promise(resolve => reservation.bind(0, '127.0.0.1', resolve));
    const port = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
    const sender = dgram.createSocket('udp4');
    await new Promise(resolve => sender.bind(0, '127.0.0.1', resolve));
    const objects = new Map(), states = new Map(), logs = [], runtimes = [];
    const encode = value => `fixture:${Buffer.from(value).toString('base64')}`;
    let licensed = true, holdOwnership = null, queryStarted = false, watts = 12440, ownershipDelayMs = 0;
    const device = { id: 'meter1', name: 'SMA actual UDP', enabled: true, pollIntervalMs: 250,
        templateId: 'meter.sma.SmaEnergyMeterSpeedwireImpl', protocol: 'speedwire',
        connection: { port, multicastGroup: '127.0.0.1', host: '127.0.0.1', staleTimeoutMs: 1000 }, ems: { mode: 'manual' } };
    const config = { enabled: true, pollIntervalMs: 250, devices: [device] };
    const owner = { namespace: 'eos-admin.0', instance: 0,
        config: { eosModules: { devices: { v: 1, encrypted: encode(JSON.stringify(config)) } } },
        encrypt: encode, decrypt: value => Buffer.from(value.slice(8), 'base64').toString(),
        log: Object.fromEntries(['debug', 'warn', 'error', 'info'].map(level => [level, message => logs.push({ level, message })])),
        eosLicenseService: { allowsEmbeddedModule: () => licensed }, eosOwnership: { canWrite: () => true },
        async getObjectViewAsync() { if (holdOwnership) { queryStarted = true; await holdOwnership; } if (ownershipDelayMs) await sleep(ownershipDelayMs); return { rows: [] }; },
        async getForeignObjectAsync(id) { return objects.get(id) || null; },
        async getForeignStateAsync(id) { return states.get(id) || null; },
        async getForeignObjectsAsync(pattern) { return Object.fromEntries([...objects].filter(([id]) => id.startsWith(pattern.replace(/\*$/, '')))); },
        async setForeignObjectAsync(id, object) { objects.set(id, { ...structuredClone(object), _id: id }); },
        async setForeignObjectNotExistsAsync(id, object) { if (!objects.has(id)) objects.set(id, { ...structuredClone(object), _id: id }); },
        async extendForeignObjectAsync(id, object) { objects.set(id, { ...objects.get(id), ...structuredClone(object), _id: id }); },
        async setForeignStateAsync(id, value, ack) { states.set(id, { ...(value && typeof value === 'object' ? value : { val: value, ack }), ts: Date.now() }); },
        async subscribeForeignObjectsAsync() {}, async subscribeForeignStatesAsync() {}, async unsubscribeForeignStatesAsync() {},
    };
    const factory = { ...deviceModule, createHostedModule: options => deviceModule.createHostedModule({ ...options,
        runtimeFactory: (cfg, template) => { const runtime = new DeviceRuntime(options.adapter, cfg, template, options.config); runtimes.push(runtime); return runtime; },
    }) };
    const host = new EosModuleHost(owner, { baseDir: sourceRoot, dataDir: '/tmp/eos-real-udp-test', factories: { devices: factory } });
    let sending = true;
    const timer = setInterval(() => { if (sending) sender.send(telegram(watts), port, '127.0.0.1', () => {}); }, 40);
    let releaseOwnership = () => {};
    t.after(async () => { releaseOwnership(); clearInterval(timer); await host.stop(); await new Promise(resolve => sender.close(resolve)); });
    const raw = name => states.get(`eos-admin.0.devices.meter1.${name}`);
    return { host, config, logs, runtimes, raw, states,
        watts(value) { watts = value; }, licensed(value) { licensed = value; }, sending(value) { sending = value; },
        delayOwnership() { holdOwnership = new Promise(resolve => { releaseOwnership = () => { holdOwnership = null; resolve(); }; }); },
        ownershipStarted: () => queryStarted, releaseOwnership: () => releaseOwnership(),
        ownershipDelay(value) { ownershipDelayMs = value; },
    };
}

test('real Speedwire UDP keeps raw values changing after device save and hosted driver replacement', async t => {
    const x = await fixture(t); await x.host.start();
    await waitUntil(() => x.raw('aCTIVE_POWER')?.val === 12.44, JSON.stringify(x.logs));
    const first = x.runtimes[0]; const socket = first.driver.hub.socket;
    await x.host.save('devices', { ...x.config, devices: [{ ...x.config.devices[0], name: 'Renamed SMA' }] });
    x.watts(2230);
    await waitUntil(() => x.runtimes.length === 2 && x.raw('aCTIVE_POWER')?.val === 2.23, JSON.stringify(x.logs));
    assert.equal(first.started, false); assert.equal(first.driver, null);
    assert.notEqual(x.runtimes[1].driver.hub.socket, socket);
    assert.equal(x.runtimes[1].driver.hub.handlers.size, 1, 'replacement must have exactly one UDP consumer');
    x.watts(3100);
    await waitUntil(() => x.raw('aCTIVE_POWER')?.val === 3.1, JSON.stringify(x.logs));
});

test('ownership query timeout closes and then restarts the real UDP runtime after verified ownership recovers', async t => {
    const x = await fixture(t); await x.host.start();
    await waitUntil(() => x.raw('aCTIVE_POWER')?.val === 12.44, JSON.stringify(x.logs));
    x.delayOwnership();
    await waitUntil(x.ownershipStarted, 'next real host ownership query did not start', 5000);
    // The query exceeds the unchanged 5s ownership timeout. The host must close
    // its old generation, then restart only after the ownership read recovers.
    await sleep(8700);
    const before = x.raw('lAST_SEEN_UNIX_MS')?.val;
    x.watts(7310); x.releaseOwnership();
    await waitUntil(() => x.raw('aCTIVE_POWER')?.val === 7.31 && x.raw('lAST_SEEN_UNIX_MS')?.val > before,
        JSON.stringify({ status: await x.host.status('devices'), logs: x.logs.slice(-8), started: x.runtimes.map(runtime => runtime.started) }), 5000);
    assert.equal((await x.host.status('devices')).active, true);
});

test('real UDP polling resumes after actual temporary lease expiry without a misleading active but stopped module', async t => {
    const x = await fixture(t); await x.host.start();
    await waitUntil(() => x.raw('aCTIVE_POWER')?.val === 12.44, JSON.stringify(x.logs));
    const before = x.raw('lAST_SEEN_UNIX_MS')?.val;
    x.ownershipDelay(200);
    // Real event-loop suspension expires the monotonic 12s lease. On resume the
    // ownership query takes200ms, so Devices' refresh observes the expired gate.
    // No clock, lease or canOperate implementation is replaced.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 12500);
    assert.equal(x.host.canOperate('devices', x.host.entries.get('devices').generation), false,
        'the test must observe actual expired authority, not merely a delayed ownership query');
    x.watts(7310);
    await waitUntil(() => x.raw('aCTIVE_POWER')?.val === 7.31 && x.raw('lAST_SEEN_UNIX_MS')?.val > before,
        async () => JSON.stringify({ status: await x.host.status('devices'), logs: x.logs.slice(-8), started: x.runtimes.map(runtime => runtime.started) }), 6000);
    assert.equal((await x.host.status('devices')).active, true);
});

test('actual entitlement revocation stops the UDP runtime and prevents old-generation publication until a confirmed restart', async t => {
    const x = await fixture(t); await x.host.start();
    await waitUntil(() => x.raw('aCTIVE_POWER')?.val === 12.44, JSON.stringify(x.logs));
    const first = x.runtimes[0]; x.licensed(false);
    await waitUntil(() => first.started === false && first.driver === null, JSON.stringify(x.logs));
    const old = x.raw('aCTIVE_POWER'); x.watts(8880); await sleep(600);
    assert.equal(x.raw('aCTIVE_POWER'), old, 'revoked generation cannot publish incoming packets');
    x.licensed(true);
    await waitUntil(() => x.runtimes.length > 1 && x.raw('aCTIVE_POWER')?.val === 8.88, JSON.stringify(x.logs), 6000);
    assert.equal(first.started, false);
    assert.equal(x.runtimes.at(-1).driver.hub.handlers.size, 1);
});
