/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EosModuleHost } = require('../src/lib/eosModuleHost');
const realDevices = require('../modules/devices');
const sourceId = 'system.adapter.nexowatt-devices.0';
const fixtureDevice = { id: 'legacy.fixture', templateId: 'battery.bmw.BatteryBmwImpl', protocol: 'modbusTcp',
    connection: { host: '192.0.2.1', port: 502, password: 'fixture-device-secret', option: 'retained' } };

async function setup(t, factory = { validateConfig: input => ({ ...input, enabled: input.enabled === true }) }, start = true) {
    const objects = new Map(); const states = new Map(); const writes = []; let runtimeStarts = 0;
    const now = Date.now();
    const source = { _id: sourceId, type: 'instance', ts: now - 1000,
        common: { enabled: false, host: 'controller', version: '0.5.176' },
        native: { devices: [], devicesJson: JSON.stringify([fixtureDevice]), pollIntervalMs: 1234 } };
    objects.set(sourceId, source);
    states.set(`${sourceId}.alive`, { val: false, ack: true, ts: now });
    states.set('system.host.controller.alive', { val: true, ack: true, ts: now });
    const encrypt = value => `encrypted:${Buffer.from(value).toString('base64')}`;
    const owner = { namespace: 'eos-admin.0', instance: 0, config: {}, log: { warn() {} }, encrypt,
        decrypt: value => Buffer.from(value.slice(10), 'base64').toString(),
        eosLicenseService: { allowsEmbeddedModule: () => true }, eosOwnership: { canWrite: () => true },
        async getObjectViewAsync(_design, _type, range) { return { rows: [...objects.values()].filter(item => item._id >= range.startkey && item._id <= range.endkey).map(value => ({ value })) }; },
        async getForeignObjectAsync(id) { return objects.get(id); },
        async getForeignStateAsync(id) { return states.get(id); },
        async setForeignObjectAsync(id, object) { objects.set(id, structuredClone(object)); writes.push({ type: 'object', id, object }); },
        async setForeignStateAsync(id, value) { writes.push({ type: 'state', id, value }); },
        async subscribeForeignObjectsAsync() {}, async subscribeForeignStatesAsync() {}, async unsubscribeForeignStatesAsync() {},
    };
    const factories = { devices: { ...factory, createHostedModule() { runtimeStarts++; throw new Error('Import must not start a runtime'); } },
        eebus: { validateConfig: input => input }, backup: { validateConfig: input => input } };
    const host = new EosModuleHost(owner, { baseDir: process.cwd(), dataDir: '/tmp/eos-import-test-only', factories });
    // Import-store isolation uses no EMS controller; real controller admission is
    // separately exercised through the production Web/HTTP pipeline.
    host.bindDeviceEms(async () => ({ statuses: [] }), async () => () => {});
    t.after(async () => {
        if ([...host.entries.values()].some(entry => entry.stopFailed)) await assert.rejects(host.stop(), /EOS_MODULE_STOP_UNCONFIRMED/);
        else await host.stop();
    });
    if (start) await host.start();
    return { host, owner, source, states, objects, writes, factory: factories.devices, runtimeStarts: () => runtimeStarts };
}

function gate() {
    let release; let reached;
    const waiting = new Promise(resolve => { release = resolve; });
    const entered = new Promise(resolve => { reached = resolve; });
    return { entered, release, async wait() { reached(); await waiting; } };
}

test('enabled target and unconfirmed target stop refuse manual import without mutation', async t => {
    for (const condition of ['enabled', 'stopFailed']) {
        const f = await setup(t);
        if (condition === 'enabled') f.host.entries.get('devices').config.enabled = true;
        else f.host.entries.get('devices').stopFailed = true;
        const reason = condition === 'enabled' ? 'EOS_MODULE_IMPORT_REQUIRES_DISABLED' : 'EOS_MODULE_STOP_UNCONFIRMED';
        assert.deepEqual((await f.host.view('devices')).manualImport, { allowed: false, reason });
        await assert.rejects(f.host.importLegacy('devices', 'nexowatt-devices.0'), { code: reason });
        assert.equal(f.writes.length, 0);
        assert.equal(f.runtimeStarts(), 0);
        assert.equal(f.source.common.enabled, false);
    }
});

test('manual reimport cannot remove an established legacy namespace binding', async t => {
    const f = await setup(t);
    f.owner.config.eosModules = { devices: { v: 1, encrypted: f.owner.encrypt('{"enabled":false}'),
        migration: { preserveNamespace: true, source: 'nexowatt-devices.0' } } };
    const before = structuredClone(f.owner.config);
    await assert.rejects(f.host.importLegacy('devices', 'nexowatt-devices.0'), /EOS_MODULE_IMPORT_ALREADY_MIGRATED/);
    assert.deepEqual(f.owner.config, before);
    assert.equal(f.host.namespace('devices'), 'nexowatt-devices.0');
    assert.equal(f.writes.length, 0);
});

test('manual import reserves the full conversion: concurrent enable and imports cannot overwrite it', async t => {
    const f = await setup(t); const pause = gate();
    f.factory.migrateLegacyConfig = async input => { await pause.wait(); return { config: input }; };
    const importing = f.host.importLegacy('devices', 'nexowatt-devices.0');
    await pause.entered;
    await assert.rejects(f.host.save('devices', { enabled: true, devices: [] }), /EOS_MODULE_BUSY/);
    await assert.rejects(f.host.importLegacy('devices', 'nexowatt-devices.0'), /EOS_MODULE_BUSY/);
    assert.equal(f.writes.length, 0);
    pause.release(); const result = await importing;
    assert.equal(result.config.enabled, false);
    assert.equal(f.host.readConfig('devices').enabled, false);
    assert.equal(f.runtimeStarts(), 0);
    assert.ok(f.writes.every(write => write.type === 'object' && write.id === 'eos-admin.0.modules.devices.configuration'));
    await f.host.save('devices', { enabled: false, marker: 'later-save' });
    assert.equal(f.host.readConfig('devices').marker, 'later-save', 'completed import releases the operation lock');
});

test('source reactivation during conversion is rejected before persistence', async t => {
    const f = await setup(t); const pause = gate();
    f.factory.migrateLegacyConfig = async input => { await pause.wait(); return { config: input }; };
    const importing = f.host.importLegacy('devices', 'nexowatt-devices.0');
    await pause.entered; f.source.common.enabled = true; pause.release();
    await assert.rejects(importing, /EOS_MODULE_LEGACY_RUNNING/);
    assert.equal(f.writes.length, 0);
    assert.equal(f.runtimeStarts(), 0);
});

test('host shutdown during conversion prevents an import commit', async t => {
    const f = await setup(t); const pause = gate();
    f.factory.migrateLegacyConfig = async input => { await pause.wait(); return { config: input }; };
    const importing = f.host.importLegacy('devices', 'nexowatt-devices.0');
    await pause.entered; await f.host.stop(); pause.release();
    await assert.rejects(importing, /EOS_MODULE_BUSY/);
    assert.equal(f.writes.length, 0);
});

test('real manual Devices import preserves old JSON-only devices and credentials without activating', async t => {
    const f = await setup(t, realDevices); const before = structuredClone(f.source);
    const result = await f.host.importLegacy('devices', 'nexowatt-devices.0');
    assert.deepEqual(f.host.readConfig('devices').devices, [fixtureDevice]);
    assert.equal(f.host.readConfig('devices').pollIntervalMs, 1234);
    assert.equal(f.host.readConfig('devices').enabled, false);
    assert.deepEqual(f.source, before);
    assert.equal(f.runtimeStarts(), 0);
    assert.equal(result.config.devices.length, 1);
    assert.equal(JSON.stringify(result).includes('fixture-device-secret'), false);
    assert.equal(JSON.stringify(f.writes).includes('fixture-device-secret'), false);
    assert.equal(result.migration.statesCopied, false);
    assert.equal(result.migration.mappingsRewritten, false);
    assert.equal(f.writes.length, 1);
    assert.equal(f.writes[0].id, 'eos-admin.0.modules.devices.configuration');
});

test('real manual Devices import rejects conflicting arrays before persisting', async t => {
    const f = await setup(t, realDevices);
    f.source.native.devices = [{ ...fixtureDevice, id: 'conflicting-device' }];
    const before = structuredClone(f.source);
    await assert.rejects(f.host.importLegacy('devices', 'nexowatt-devices.0'), /EOS_DEVICES_LEGACY_CONFIG_CONFLICT/);
    assert.deepEqual(f.source, before);
    assert.equal(f.writes.length, 0);
    assert.equal(f.runtimeStarts(), 0);
});

test('unstarted migration-blocked host never treats a default empty entry as loaded target configuration', async t => {
    const f = await setup(t, undefined, false);
    f.owner.config.eosModules = { devices: { v: 1, encrypted: f.owner.encrypt(JSON.stringify({ enabled: true, customerSetting: 'preserve' })) } };
    const before = structuredClone(f.owner.config);
    assert.equal((await f.host.view('devices')).configurationReady, false);
    assert.equal((await f.host.view('devices')).manualImport.reason, 'EOS_MODULE_NOT_READY');
    await assert.rejects(f.host.importLegacy('devices', 'nexowatt-devices.0'), /EOS_MODULE_NOT_READY/);
    await assert.rejects(f.host.save('devices', { enabled: false, devices: [] }), /EOS_MODULE_NOT_READY/);
    assert.deepEqual(f.owner.config, before);
    assert.equal(f.writes.length, 0);
});

test('startup configuration load excludes import and save, and concurrent start waits for the same initialization', async t => {
    const f = await setup(t, undefined, false); const pause = gate();
    const envelope = { v: 1, encrypted: f.owner.encrypt(JSON.stringify({ enabled: true, customerSetting: 'preserve' })) };
    f.host.configStore.load = async id => { if (id === 'devices') { await pause.wait(); return envelope; } return undefined; };
    const starting = f.host.start(); await pause.entered;
    let secondCompleted = false;
    const second = f.host.start().then(() => { secondCompleted = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(secondCompleted, false, 'second start must not signal ready before persisted configuration loads');
    await f.host.reconcile();
    assert.equal(f.runtimeStarts(), 0);
    await assert.rejects(f.host.importLegacy('devices', 'nexowatt-devices.0'), /EOS_MODULE_NOT_READY/);
    await assert.rejects(f.host.save('devices', { enabled: false }), /EOS_MODULE_NOT_READY/);
    pause.release(); await Promise.all([starting, second]);
    assert.equal(f.host.initialized, true);
    assert.equal(f.host.entries.get('devices').config.customerSetting, 'preserve');
    assert.equal(f.host.entries.get('devices').config.enabled, true);
    await assert.rejects(f.host.importLegacy('devices', 'nexowatt-devices.0'), /EOS_MODULE_IMPORT_REQUIRES_DISABLED/);
    assert.equal(f.writes.length, 0);
});

test('unreadable persisted target is not replaceable through default config or manual import', async t => {
    const f = await setup(t, undefined, false);
    f.host.configStore.load = async id => { if (id === 'devices') throw new Error('synthetic read failed'); return undefined; };
    await f.host.start();
    assert.equal(f.host.initialized, true);
    assert.equal(f.host.entries.get('devices').configLoaded, false);
    assert.equal((await f.host.status('devices')).active, false);
    assert.equal((await f.host.view('devices')).configurationReady, false);
    await assert.rejects(f.host.importLegacy('devices', 'nexowatt-devices.0'), /EOS_MODULE_NOT_READY/);
    await assert.rejects(f.host.save('devices', { enabled: false }), { code: 'EOS_MODULE_CONFIG_UNAVAILABLE' });
    assert.equal(f.writes.length, 0);
});

test('manual backup import reports its actual backup target prefix', async t => {
    const f = await setup(t); const now = Date.now();
    const id = 'system.adapter.nexowatt-backup.0';
    f.objects.set(id, { _id: id, type: 'instance', ts: now - 1000, common: { enabled: false, host: 'controller' }, native: { enabled: false } });
    f.states.set(`${id}.alive`, { val: false, ack: true, ts: now });
    const imported = await f.host.importLegacy('backup', 'nexowatt-backup.0');
    assert.equal(imported.migration.oldPrefix, 'nexowatt-backup.0.');
    assert.equal(imported.migration.newPrefix, 'eos-admin.0.backup.');
    assert.equal(imported.config.enabled, false);
});
