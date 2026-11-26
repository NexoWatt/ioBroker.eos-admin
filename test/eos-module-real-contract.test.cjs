'use strict';

// Integration contract: actual packaged module factories and EEBus runtime,
// with a controlled ioBroker database/entitlement fixture. This is not a
// controller, physical device, multicast interoperability or electrical test.
const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { EosModuleHost } = require('../src/lib/eosModuleHost');

async function setup(t) {
    const dataDir = await mkdtemp(join(tmpdir(), 'eos-real-module-contract-'));
    const objects = new Map();
    const states = new Map();
    const subscriptions = new Set();
    const logs = [];
    const config = { enabled: true, discoveryEnabled: false, shipServerEnabled: false,
        autoConnectEnabled: false, nexowattBridgeEnabled: false, commandDryRun: true, autoApplyClsLimits: false };
    // This substitutes the controller's encrypt/decrypt contract; it is not a
    // claim about ioBroker's cryptography or a production credential store.
    const encrypt = text => `fixture:${Buffer.from(text).toString('base64')}`;
    const owner = {
        namespace: 'eos-admin.0', instance: 0,
        // This contract runs EEBus and explicitly keeps the other modules off.
        // An absent envelope now means enabled for initial commissioning.
        config: { eosModules: Object.fromEntries(['devices', 'eebus', 'backup', 'ocpp']
            .map(id => [id, { v: 1, encrypted: encrypt(JSON.stringify(id === 'eebus' ? config : { enabled: false })) }])) },
        log: Object.fromEntries(['info', 'warn', 'debug', 'error'].map(level => [level, text => logs.push({ level, text })])),
        licensed: true, owned: true,
        eosLicenseService: { allowsEmbeddedModule: () => owner.licensed },
        eosOwnership: { canWrite: () => owner.owned },
        encrypt, decrypt: value => Buffer.from(value.slice('fixture:'.length), 'base64').toString(),
        async getObjectViewAsync(_design, _type, range) {
            return { rows: [...objects.values()].filter(row => row._id >= range.startkey && row._id <= range.endkey).map(value => ({ value })) };
        },
        async getForeignObjectAsync(id) { return id === `system.adapter.${owner.namespace}` ? { native: structuredClone(owner.config) } : objects.get(id); },
        async getForeignStateAsync(id) { return states.get(id) || null; },
        async setForeignObjectAsync(id, object) {
            assert.notEqual(id, `system.adapter.${owner.namespace}`, 'module saves must not restart their owning adapter');
            objects.set(id, { ...structuredClone(object), _id: id });
        },
        async extendForeignObjectAsync(id, object) {
            if (id === `system.adapter.${owner.namespace}`) Object.assign(owner.config, object.native);
            else objects.set(id, { ...objects.get(id), ...structuredClone(object), _id: id });
        },
        async setForeignObjectNotExistsAsync(id, object) { if (!objects.has(id)) objects.set(id, { ...structuredClone(object), _id: id }); },
        async setForeignStateAsync(id, value, ack) { states.set(id, typeof value === 'object' && value !== null ? { ...value } : { val: value, ack }); },
        async subscribeForeignObjectsAsync() {},
        async subscribeForeignStatesAsync(pattern) { subscriptions.add(pattern); },
        async unsubscribeForeignStatesAsync(pattern) { subscriptions.delete(pattern); },
    };
    const host = new EosModuleHost(owner, { baseDir: resolve(__dirname, '..'), dataDir });
    t.after(async () => { await host.stop(); await rm(dataDir, { recursive: true, force: true }); });
    await host.start();
    return { host, owner, objects, states, subscriptions, logs, config };
}

test('actual hosted EEBus runtime starts with scoped objects/subscriptions and preserves identity over module restart', { timeout: 15000 }, async t => {
    const f = await setup(t);
    const initial = await f.host.view('eebus');
    assert.equal(initial.status.active, true, JSON.stringify({ status: initial.status, logs: f.logs }));
    assert.equal(initial.status.details.running, true);
    assert.match(initial.status.details.localSki, /^[A-F0-9]{40}$/);
    assert.ok(f.objects.has('eos-admin.0.eebus.discovery.enabled'));
    assert.ok(f.objects.has('eos-admin.0.eebus.pairing.autoAcceptNewDevices'));
    assert.ok(f.objects.has('eos-admin.0.eebus.cls.active'));
    assert.ok(f.subscriptions.has('eos-admin.0.eebus.devices.*.pairing.*'), 'security state changes remain subscribed independently from Admin event throttling');

    await f.host.save('eebus', { ...f.config, enabled: false });
    await f.host.reconcile();
    assert.equal((await f.host.status('eebus')).active, false);
    assert.equal(f.host.entries.get('eebus').failed, false, 'normal stop is not a transport failure');
    await f.host.save('eebus', f.config);
    await f.host.reconcile();
    const restarted = await f.host.status('eebus');
    assert.equal(restarted.active, true, JSON.stringify(restarted));
    assert.equal(restarted.details.localSki, initial.status.details.localSki);
    assert.equal(restarted.details.certificateFingerprint, initial.status.details.certificateFingerprint);
});

test('actual Devices catalogue remains configurable while module is disabled and no device runtime is started', { timeout: 15000 }, async t => {
    const f = await setup(t);
    const state = await f.host.status('devices');
    assert.equal(state.enabled, false);
    assert.equal(state.active, false);
    assert.equal(state.reason, 'DISABLED');
    assert.equal(state.details.process.pid, null);
    const categories = await f.host.command('devices', 'getCategories', {});
    assert.ok(Array.isArray(categories) && categories.length > 0, 'actual local template categories are available before enabling');
    assert.equal(f.host.entries.get('devices').module, null);
});

test('legacy EEBus settings import remains disabled, reports changed boundaries and retains the original instance', { timeout: 15000 }, async t => {
    const f = await setup(t);
    await f.host.save('eebus', { ...f.config, enabled: false });
    await f.host.reconcile();
    const legacyId = 'system.adapter.eebus.0';
    const now = Date.now();
    // Representative 0.3.0 native schema, including encryptedNative values and
    // obsolete trust switches. These strings are test sentinels, not secrets.
    const original = { _id: legacyId, type: 'instance', ts: now - 1000, common: { enabled: false, host: 'controller' }, native: {
        discoveryEnabled: true, measurementIntervalSec: 15, metadataIntervalSec: 60, shipServerEnabled: true,
        announceShipService: true, shipPort: 4713, shipPath: '/ship/', serviceName: 'EOS Betrieb', brand: 'NexoWatt', model: 'EOS',
        deviceType: 'EnergyManagementSystem', deviceCategories: '2', ianaPen: '999999',
        pairingPin: 'encrypted-test-pin', privateKey: 'encrypted-test-private-key', certificate: 'legacy-test-certificate',
        shipId: 'old-id', localSki: 'old-ski', certificateFingerprint: 'old-fingerprint',
        allowCommandsToUntrustedDevices: false, autoAcceptNewDevices: false, debugRawMessages: false,
        commandDryRun: true, autoConnectEnabled: true, shipHandshakeEnabled: true, spineDiscoveryEnabled: true,
        nexowattBridgeEnabled: true, nexowattUiInstance: 'auto', nexowattBridgeHeartbeatSec: 5,
        nexowattBridgeRequestTimeoutMs: 2000, autoApplyClsLimits: true, sendImplementationResultToCls: true,
    } };
    f.objects.set(legacyId, structuredClone(original));
    f.states.set(`${legacyId}.alive`, { val: false, ack: true, ts: now });
    f.states.set('system.host.controller.alive', { val: true, ack: true, ts: now });
    const imported = await f.host.importLegacy('eebus', 'eebus.0');
    assert.equal(imported.config.enabled, false);
    assert.equal(imported.config.shipPort, 4713);
    assert.equal(imported.config.measurementIntervalSec, 15);
    assert.equal(imported.migration.requiresPairing, true);
    assert.equal(imported.migration.identityImported, false);
    assert.equal(imported.migration.statesCopied, false);
    assert.ok(imported.migration.omittedFields.includes('allowCommandsToUntrustedDevices'));
    assert.equal(JSON.stringify(imported).includes('encrypted-test-'), false);
    assert.deepEqual(f.objects.get(legacyId), original);
    assert.equal((await f.host.status('eebus')).active, false);
});

