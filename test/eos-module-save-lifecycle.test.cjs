/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EosModuleHost } = require(path.join(process.env.EOS_PERSISTENCE_BASELINE || path.join(__dirname, '..'), 'src/lib/eosModuleHost'));
const configurationId = 'eos-admin.0.modules.devices.configuration';
const clone = value => value === undefined ? undefined : structuredClone(value);
const turn = () => new Promise(resolve => setImmediate(resolve));
function gate() {
    let release; let entered;
    const waiting = new Promise(resolve => { release = resolve; });
    const reached = new Promise(resolve => { entered = resolve; });
    return { release, reached, async wait() { entered(); await waiting; } };
}

async function setup(t) {
    const objects = new Map(); const states = new Map(); const writes = [];
    const encrypt = value => `fixture:${Buffer.from(value).toString('base64')}`;
    const initial = { enabled: false, devices: [], customerMarker: 'before' };
    const owner = {
        namespace: 'eos-admin.0', instance: 0,
        config: { eosModules: { devices: { v: 1, encrypted: encrypt(JSON.stringify(initial)) } } },
        log: { warn() {} }, encrypt, decrypt: value => Buffer.from(value.slice(8), 'base64').toString(),
        eosLicenseService: { allowsEmbeddedModule: () => true }, eosOwnership: { canWrite: () => true },
        async getObjectViewAsync(_design, _type, range) { return { rows: [...objects.values()].filter(object => object._id >= range.startkey && object._id <= range.endkey).map(value => ({ value: clone(value) })) }; },
        async getForeignObjectAsync(id) { return clone(objects.get(id)); },
        async getForeignStateAsync(id) { return clone(states.get(id)); },
        async setForeignObjectAsync(id, object) { objects.set(id, clone(object)); writes.push({ id, object: clone(object) }); },
        async setForeignStateAsync() {}, async subscribeForeignObjectsAsync() {}, async subscribeForeignStatesAsync() {}, async unsubscribeForeignStatesAsync() {},
    };
    const factory = { validateConfig: value => ({ ...value, enabled: value.enabled === true }),
        createHostedModule() { throw new Error('Disabled configuration must not start a hardware runtime'); } };
    const options = { baseDir: process.cwd(), dataDir: '/tmp/eos-save-lifecycle-fixture', factories: { devices: factory, eebus: factory, backup: factory } };
    const host = new EosModuleHost(owner, options);
    let stopFailureExpected = false;
    let profileReservations = 0;
    host.bindDeviceEms(async () => ({ statuses: [] }), async () => { profileReservations++; return () => { profileReservations--; }; });
    t.after(async () => { if (stopFailureExpected) await assert.rejects(host.stop(), /EOS_MODULE_STOP_UNCONFIRMED/); else await host.stop(); });
    await host.start();
    return { host, owner, objects, states, writes, options, initial, reservations: () => profileReservations,
        expectUnconfirmedStop() { stopFailureExpected = true; },
        async reboot() { await host.stop(); const next = new EosModuleHost(owner, options); t.after(() => next.stop()); await next.start(); return next; } };
}

test('timed-out save keeps one transaction until actual commit and exposes the saved customer configuration after late completion', async t => {
    const f = await setup(t); const pause = gate();
    const write = f.owner.setForeignObjectAsync;
    f.owner.setForeignObjectAsync = async (id, object) => { if (id === configurationId) await pause.wait(); return write(id, object); };
    t.after(() => pause.release());
    const desired = { enabled: false, customerMarker: 'accepted-late', devices: [{ id: 'meter1', templateId: 'fixture.meter', protocol: 'speedwire' }] };
    const saving = f.host.save('devices', desired);
    const timedOut = assert.rejects(saving, { code: 'EOS_MODULE_TIMEOUT' });
    await pause.reached; await timedOut;
    assert.equal(f.host.mutation, true, 'an HTTP deadline must not release an unfinished configuration transaction');
    assert.equal(f.reservations(), 1, 'profile reservation stays owned until the database outcome is known');
    await assert.rejects(f.host.save('devices', { ...f.initial, customerMarker: 'stale-browser-draft' }), /EOS_MODULE_BUSY/);
    const pending = f.host.configurationSavePromise;
    pause.release(); await pending; await turn();
    assert.equal(f.host.mutation, false);
    assert.equal(f.reservations(), 0);
    assert.deepEqual((await f.host.view('devices')).config, desired, 'view must expose the commit before another save is admitted');
    const rebooted = await f.reboot();
    assert.deepEqual((await rebooted.view('devices')).config, desired, 'restart loads the same durable customer data');
    assert.deepEqual(f.writes.map(row => row.id), [configurationId]);
});

test('a later edit cannot restore an old customer setting after a timed-out save eventually committed', async t => {
    const f = await setup(t); const pause = gate(); const write = f.owner.setForeignObjectAsync;
    f.owner.setForeignObjectAsync = async (id, object) => { if (id === configurationId) await pause.wait(); return write(id, object); };
    t.after(() => pause.release());
    const desired = { ...f.initial, customerMarker: 'keep-this-confirmed-customer-value' };
    const saving = f.host.save('devices', desired);
    const timeout = assert.rejects(saving, /EOS_MODULE_TIMEOUT/);
    await pause.reached; await timeout;
    const transaction = f.host.configurationSavePromise;
    pause.release();
    if (transaction) await transaction;
    // The old implementation has dropped the transaction reference. Let its
    // actual store/readback settle before exercising the next real API save.
    for (let i = 0; i < 5; i++) await turn();
    assert.equal(f.writes.length, 1);
    const shown = await f.host.view('devices');
    await f.host.save('devices', { ...shown.config, unrelatedSetting: 'edited-later' }, undefined, shown.configurationRevision);
    const rebooted = await f.reboot();
    assert.equal((await rebooted.view('devices')).config.customerMarker, desired.customerMarker,
        'a completed durable setting must survive a later edit of an unrelated field');
});

test('stop during the last database read prevents a new module configuration write', async t => {
    const f = await setup(t); const pause = gate();
    const read = f.owner.getForeignObjectAsync;
    f.owner.getForeignObjectAsync = async id => { if (id === configurationId) await pause.wait(); return read(id); };
    t.after(() => pause.release());
    const saving = f.host.save('devices', { ...f.initial, customerMarker: 'must-not-start-after-stop' });
    const rejected = assert.rejects(saving, /EOS_MODULE_(BUSY|STOPPED)/);
    await pause.reached; const stopping = f.host.stop(); pause.release(); await stopping; await rejected;
    assert.equal(f.writes.length, 0, 'no persistent write may begin after confirmed host stop');
});

test('rejected persistent write preserves old settings and releases admission for a corrected retry', async t => {
    const f = await setup(t); const write = f.owner.setForeignObjectAsync;
    f.owner.setForeignObjectAsync = async () => { throw new Error('fixture database rejected write'); };
    await assert.rejects(f.host.save('devices', { ...f.initial, customerMarker: 'rejected' }), /fixture database rejected write/);
    assert.deepEqual((await f.host.view('devices')).config, f.initial);
    assert.equal(f.objects.has(configurationId), false);
    assert.equal(f.host.mutation, false);
    f.owner.setForeignObjectAsync = write;
    const desired = { ...f.initial, customerMarker: 'retry-confirmed' };
    await f.host.save('devices', desired);
    assert.deepEqual((await (await f.reboot()).view('devices')).config, desired);
});

test('shutdown during an already-issued write retains the accepted durable settings without reopening the stopped runtime', async t => {
    const f = await setup(t); const pause = gate(); const write = f.owner.setForeignObjectAsync;
    f.owner.setForeignObjectAsync = async (id, object) => { if (id === configurationId) await pause.wait(); return write(id, object); };
    t.after(() => pause.release());
    const desired = { ...f.initial, customerMarker: 'committed-during-shutdown' };
    const saving = f.host.save('devices', desired);
    const rejected = assert.rejects(saving, /EOS_MODULE_(BUSY|STOPPED)/);
    await pause.reached;
    let stopSettled = false;
    const stopping = f.host.stop().then(() => { stopSettled = true; });
    await turn();
    assert.equal(stopSettled, false, 'confirmed stop must drain an already-issued persistent write');
    pause.release(); await stopping; await rejected;
    assert.equal(f.host.entries.get('devices').reason, 'STOPPED');
    assert.equal(f.host.entries.get('devices').module, null);
    assert.deepEqual((await (await f.reboot()).view('devices')).config, desired, 'an already-issued DB write cannot be declared cancelled or replaced by defaults');
});

test('timed-out manual import retains its mutation and profile reservations until actual completion', async t => {
    const f = await setup(t); const pause = gate(); const now = Date.now();
    const sourceId = 'system.adapter.nexowatt-devices.0';
    const importedConfig = { enabled: false, customerMarker: 'legacy-preserved', devices: [{ id: 'legacy-meter', templateId: 'fixture.meter', protocol: 'speedwire' }] };
    const source = { _id: sourceId, type: 'instance', ts: now - 1000, common: { enabled: false, host: 'controller', version: '0.5.176' }, native: importedConfig };
    f.objects.set(sourceId, clone(source));
    f.states.set(`${sourceId}.alive`, { val: false, ack: true, ts: now });
    f.states.set('system.host.controller.alive', { val: true, ack: true, ts: now });
    const write = f.owner.setForeignObjectAsync;
    f.owner.setForeignObjectAsync = async (id, object) => { if (id === configurationId) await pause.wait(); return write(id, object); };
    t.after(() => pause.release());
    const importing = f.host.importLegacy('devices', 'nexowatt-devices.0');
    const timedOut = assert.rejects(importing, { code: 'EOS_MODULE_TIMEOUT' });
    await pause.reached; await timedOut;
    assert.equal(f.host.mutation, true);
    assert.equal(f.reservations(), 1);
    await assert.rejects(f.host.importLegacy('devices', 'nexowatt-devices.0'), /EOS_MODULE_BUSY/);
    await assert.rejects(f.host.save('devices', f.initial), /EOS_MODULE_BUSY/);
    const pending = f.host.configurationSavePromise;
    pause.release(); await pending; await turn();
    assert.deepEqual((await f.host.view('devices')).config, importedConfig);
    assert.deepEqual(f.objects.get(sourceId), source, 'legacy native data and enabled state stay unchanged');
    assert.deepEqual((await (await f.reboot()).view('devices')).config, importedConfig);
    assert.equal(f.reservations(), 0);
});

test('a delayed rejected commit releases the transaction only after rejection and preserves the old settings', async t => {
    const f = await setup(t); const pause = gate();
    f.owner.setForeignObjectAsync = async () => { await pause.wait(); throw new Error('fixture late database rejection'); };
    t.after(() => pause.release());
    const saving = f.host.save('devices', { ...f.initial, customerMarker: 'never-committed' });
    const timedOut = assert.rejects(saving, { code: 'EOS_MODULE_TIMEOUT' });
    await pause.reached; await timedOut;
    assert.equal(f.host.mutation, true);
    const actualFailure = assert.rejects(f.host.configurationSavePromise, /fixture late database rejection/);
    pause.release(); await actualFailure;
    assert.equal(f.host.mutation, false);
    assert.deepEqual((await f.host.view('devices')).config, f.initial);
    assert.equal(f.objects.has(configurationId), false);
});

test('an unresolved issued configuration write makes shutdown explicitly unconfirmed within the stop deadline', async t => {
    const f = await setup(t); const pause = gate(); const write = f.owner.setForeignObjectAsync;
    f.owner.setForeignObjectAsync = async (id, object) => { await pause.wait(); return write(id, object); };
    t.after(() => pause.release());
    const saving = f.host.save('devices', { ...f.initial, customerMarker: 'pending-at-stop' });
    const response = assert.rejects(saving, /EOS_MODULE_TIMEOUT/);
    await pause.reached;
    f.expectUnconfirmedStop();
    await Promise.all([response, assert.rejects(f.host.stop(), /EOS_MODULE_STOP_UNCONFIRMED/)]);
    assert.equal(f.host.mutation, true, 'an unresolved write stays reserved after an unconfirmed stop');
    const drained = assert.rejects(f.host.configurationSavePromise, /EOS_MODULE_STOPPED/);
    pause.release(); await drained;
    assert.equal(f.host.mutation, false);
    assert.equal(f.writes.length, 1, 'the admitted write is neither replayed nor assumed cancelled');
});

test('a failed readback after a durable write rejects success and prevents an older draft from overwriting it', async t => {
    const f = await setup(t); const read = f.owner.getForeignObjectAsync; let failReadback = false;
    const write = f.owner.setForeignObjectAsync;
    f.owner.setForeignObjectAsync = async (id, object) => { await write(id, object); failReadback = true; };
    f.owner.getForeignObjectAsync = async id => { if (id === configurationId && failReadback) throw new Error('fixture readback unavailable'); return read(id); };
    const desired = { ...f.initial, customerMarker: 'durable-before-readback-failure' };
    await assert.rejects(f.host.save('devices', desired), /fixture readback unavailable/);
    failReadback = false; f.owner.setForeignObjectAsync = write;
    await assert.rejects(f.host.save('devices', f.initial), /EOS_MODULE_CONFIG_CONFLICT/);
    assert.equal(f.writes.length, 1);
    assert.deepEqual((await (await f.reboot()).view('devices')).config, desired);
});
