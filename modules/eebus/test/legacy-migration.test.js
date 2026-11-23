'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, stat, rm, mkdir } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { IdentityManager } = require('../build/lib/identityManager');
const { getConfig } = require('../build/lib/config');
const { preflightLegacyConfig } = require('../index');

async function fixture(t) {
    const root = await mkdtemp(join(tmpdir(), 'eos-eebus-migration-')); t.after(() => rm(root, { recursive: true, force: true }));
    const identity = await new IdentityManager(join(root, 'old'), getConfig({})).ensureIdentity();
    const native = { ...getConfig({ commandDryRun: false, autoApplyClsLimits: true, pairingPin: 'synthetic-pin' }), ...identity };
    delete native.createdAt;
    const pins = new Map();
    const context = { source: 'eebus.0', sourceVersion: '0.3.0', sourceEnabled: true, dataDir: join(root, 'new'), owner: {
        getForeignStatesAsync: async () => Object.fromEntries([...pins].filter(([key]) => key.endsWith('.trusted'))),
        getForeignStateAsync: async id => pins.get(id),
    } };
    return { root, identity, native, context, pins };
}

test('eligible EEBus migration retains SHIP identity, PIN, dryrun/CLS settings and verified peer pins', async t => {
    const x = await fixture(t);
    const peer = 'A'.repeat(40);
    x.pins.set(`eebus.0.devices.${peer}.pairing.trusted`, { val: true, ack: true });
    x.pins.set(`eebus.0.devices.${peer}.pairing.pinnedFingerprint`, { val: 'B'.repeat(64), ack: true });
    const prepared = await preflightLegacyConfig(x.native, x.context);
    assert.equal(prepared.config.pairingPin, 'synthetic-pin'); assert.equal(prepared.config.commandDryRun, false); assert.equal(prepared.config.autoApplyClsLimits, true);
    assert.equal(prepared.identityImported, true);
    await assert.rejects(readFile(join(x.context.dataDir, 'ship-identity.json')), { code: 'ENOENT' });
    await prepared.prepareFiles();
    const saved = JSON.parse(await readFile(join(x.context.dataDir, 'ship-identity.json'), 'utf8'));
    assert.equal(saved.privateKey, x.identity.privateKey); assert.equal(saved.certificate, x.identity.certificate);
    assert.equal(saved.localSki, x.identity.localSki); assert.equal(saved.shipId, x.identity.shipId);
    assert.equal((await stat(join(x.context.dataDir, 'ship-identity.json'))).mode & 0o777, 0o600);
    await prepared.prepareFiles();
});

test('unverified legacy pairing, mismatching identity and unsafe settings fail before identity writes', async t => {
    const x = await fixture(t); const peer = 'A'.repeat(40);
    x.pins.set(`eebus.0.devices.${peer}.pairing.trusted`, { val: true, ack: true });
    await assert.rejects(preflightLegacyConfig(x.native, x.context), /REPAIR_REQUIRED/);
    x.pins.clear();
    await assert.rejects(preflightLegacyConfig({ ...x.native, localSki: '0'.repeat(40) }, x.context), /IDENTITY_MISMATCH/);
    await assert.rejects(preflightLegacyConfig({ ...x.native, allowCommandsToUntrustedDevices: true }, x.context), /SECURITY_PROFILE/);
    await assert.rejects(preflightLegacyConfig({ ...x.native, unknownActiveMode: true }, x.context), /UNKNOWN_SETTING/);
    await assert.rejects(readFile(join(x.context.dataDir, 'ship-identity.json')), { code: 'ENOENT' });
});

test('existing identity is never replaced and a permissive target directory is rejected', async t => {
    const x = await fixture(t);
    await new IdentityManager(x.context.dataDir, getConfig({})).ensureIdentity();
    const original = await readFile(join(x.context.dataDir, 'ship-identity.json'), 'utf8');
    await assert.rejects(preflightLegacyConfig(x.native, x.context), /IDENTITY_EXISTS/);
    assert.equal(await readFile(join(x.context.dataDir, 'ship-identity.json'), 'utf8'), original);
    const unsafe = join(x.root, 'unsafe'); await mkdir(unsafe, { mode: 0o755 });
    await assert.rejects(preflightLegacyConfig(x.native, { ...x.context, dataDir: unsafe }), /PERMISSIONS/);
});
