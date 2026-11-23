'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm, readdir } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createHostedModule, validateConfig, migrateLegacyConfig } = require('../index');

test('configuration rejects trust bypasses, privileged/colliding ports, invalid types and private key import', () => {
    for (const value of [{ autoAcceptNewDevices: true }, { allowCommandsToUntrustedDevices: true }, { privateKey: 'not-a-key' },
        { shipPort: 443 }, { shipPort: 8081 }, { shipPort: 8188 }, { shipPort: NaN }, { shipPort: '4712' }, { enabled: 'true' }, { shipPath: '/ship/?redirect=x' }]) {
        assert.throws(() => validateConfig(value));
    }
    assert.equal(validateConfig({}).enabled, false);
    assert.equal(validateConfig({}).commandDryRun, true);
    assert.equal(validateConfig({}).autoApplyClsLimits, false);
});

test('legacy import preserves supported settings, stays disabled and requires new certificate pairing', () => {
    const imported = migrateLegacyConfig({ shipPort: 4720, serviceName: 'Site EOS', autoAcceptNewDevices: true,
        allowCommandsToUntrustedDevices: true, commandDryRun: false, autoApplyClsLimits: true, certificate: 'old', privateKey: 'not-a-key', pairingPin: '12345' });
    assert.equal(imported.config.shipPort, 4720);
    assert.equal(imported.config.serviceName, 'Site EOS');
    assert.equal(imported.config.enabled, false);
    assert.equal(imported.config.commandDryRun, true);
    assert.equal(imported.config.autoApplyClsLimits, false);
    for (const field of ['privateKey', 'certificate', 'pairingPin', 'autoAcceptNewDevices', 'allowCommandsToUntrustedDevices']) assert.equal(field in imported.config, false);
    assert.equal(imported.requiresPairing, true);
});

class Adapter {
    namespace = 'eos-admin.0.eebus';
    log = { info() {}, debug() {}, warn() {}, error() {} };
    states = new Map(); subscriptions = new Set(); timers = new Set(); objects = new Set();
    writesAllowed = true;
    async setObjectNotExistsAsync(id) { this.objects.add(id); }
    async setStateAsync(id, state) { if (!this.writesAllowed) throw new Error('HOST_STOPPED'); this.states.set(id, state); }
    async getStateAsync(id) { return this.states.get(id); }
    async subscribeStatesAsync(id) { this.subscriptions.add(id); }
    async unsubscribeStatesAsync(id) { this.subscriptions.delete(id); }
    setInterval(fn, delay) { const timer = setInterval(fn, delay); this.timers.add(timer); return timer; }
    clearInterval(timer) { clearInterval(timer); this.timers.delete(timer); }
    setTimeout(fn, delay) { const timer = setTimeout(fn, delay); this.timers.add(timer); return timer; }
    clearTimeout(timer) { clearTimeout(timer); this.timers.delete(timer); }
    sendTo() { throw new Error('NETWORK_NOT_EXPECTED'); }
}

test('central license denies startup before file/network work; no second license required', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'eos-hosted-eebus-'));
    try {
        const module = createHostedModule({ adapter: new Adapter(), canOperate: () => false, dataDir: dir, config: {} });
        await assert.rejects(module.start(), /LICENSE_REQUIRED/);
        assert.deepEqual(await readdir(dir), []);
        await assert.rejects(module.command('pairing.approve', { deviceId: 'A'.repeat(40) }), /NOT_RUNNING/);
    } finally { await rm(dir, { recursive: true, force: true }); }
});

test('hosted lifecycle uses async scoped subscriptions and cleans all timers even if host rejects stop telemetry', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'eos-hosted-eebus-'));
    const adapter = new Adapter();
    let licensed = true;
    const module = createHostedModule({ adapter, canOperate: () => licensed, dataDir: dir,
        config: { enabled: true, shipServerEnabled: false, discoveryEnabled: false, nexowattBridgeEnabled: false } });
    try {
        await module.start();
        assert.equal((await module.getStatus()).running, true);
        assert.equal(adapter.subscriptions.size, 4);
        assert.equal(adapter.objects.has('info.connection'), true);
        await assert.rejects(module.command('device.connect', { deviceId: '../other' }), /DEVICE_UNKNOWN/);
        licensed = false; adapter.writesAllowed = false;
        await module.stop();
        assert.equal((await module.getStatus()).running, false);
        assert.equal(adapter.subscriptions.size, 0);
        assert.equal(adapter.timers.size, 0);
        await module.stop();
    } finally { await module.stop(); await rm(dir, { recursive: true, force: true }); }
});
