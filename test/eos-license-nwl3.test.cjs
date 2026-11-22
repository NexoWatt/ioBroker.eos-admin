'use strict';

// Real Node crypto/filesystem with an in-memory ioBroker object boundary.
// Matches the published Keygen 1.0.4 claim/signature contract; no real key,
// customer UUID or production activation code is stored in this repository.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { verifyLicense } = require('../src/lib/eosLicenseCore');
const { EosLicenseService, LEASE_MS } = require('../src/lib/eosLicenseService');
const { createLicenseGuard } = require('../packages/eos-license-client');

const keys = crypto.generateKeyPairSync('ed25519');
const uuid = crypto.randomUUID();
const now = 1795305600000;
const kid = 'ephemeral-nwl3-contract';
const publicKeys = { [kid]: keys.publicKey.export({ format: 'pem', type: 'spki' }).toString() };
const base = () => ({ v: 3, kid, licenseId: crypto.randomUUID(), uuid, edition: 'home', issuedAt: now,
    notBefore: now, expiresAt: null, scope: 'system' });
function sign(payload, prefix = 'NWL3', key = keys.privateKey) {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const message = `${prefix}.${encoded}`;
    return `${message}.${crypto.sign(null, Buffer.from(message, 'ascii'), key).toString('base64url')}`;
}
const verify = (token, options = {}) => verifyLicense(token, { uuid, now, publicKeys, ...options });

test('NWL3 Home/Pro derive exact system policy from verified edition', () => {
    for (const [edition, limits] of [['home', { chargePoints: 3, batteries: 2 }], ['pro', { chargePoints: 50, batteries: 10 }]]) {
        const claims = verify(sign({ ...base(), edition }));
        assert.equal(claims.v, 3);
        assert.equal(claims.scope, 'system');
        assert.equal(claims.expiresAt, null);
        assert.deepEqual(claims.adapters, []);
        assert.deepEqual(claims.limits, limits);
        assert.equal(claims.features.includes('billing'), edition === 'pro');
        assert.ok(Object.isFrozen(claims) && Object.isFrozen(claims.limits) && Object.isFrozen(claims.features));
        assert.throws(() => { claims.limits.chargePoints = 1000; }, TypeError);
    }
});

test('NWL3 cannot carry entitlements, adapter names, configurable expiry or delayed start', () => {
    for (const override of [{ adapters: ['eos-admin'] }, { limits: { chargePoints: 1000, batteries: 1000 } },
        { features: ['billing'] }, { scope: 'adapters' }, { v: 2 }, { expiresAt: now + 1000 },
        { notBefore: now + 1 }, { issuedAt: now - 1 }, { edition: 'enterprise' }]) {
        assert.throws(() => verify(sign({ ...base(), ...override })), { code: 'LICENSE_CLAIMS_INVALID' });
    }
});

test('NWL3 rejects tampering, foreign UUID/key, unknown issuer and prefix substitution', () => {
    const payload = base();
    const token = sign(payload);
    const parts = token.split('.');
    parts[1] = Buffer.from(JSON.stringify({ ...payload, edition: 'pro' })).toString('base64url');
    assert.throws(() => verify(parts.join('.')), { code: 'LICENSE_SIGNATURE_INVALID' });
    assert.throws(() => verify(token, { uuid: crypto.randomUUID() }), { code: 'LICENSE_UUID_MISMATCH' });
    assert.throws(() => verify(token, { now: now - 1 }), { code: 'LICENSE_NOT_YET_VALID' });
    assert.throws(() => verify(sign({ ...payload, kid: 'unknown' })), { code: 'LICENSE_KEY_UNKNOWN' });
    assert.throws(() => verify(sign(payload, 'NWL3', crypto.generateKeyPairSync('ed25519').privateKey)), { code: 'LICENSE_SIGNATURE_INVALID' });
    assert.throws(() => verify(token.replace('NWL3.', 'NWL2.')), { code: 'LICENSE_SIGNATURE_INVALID' });
    assert.throws(() => verify(sign(payload, 'NWL2')), { code: 'LICENSE_CLAIMS_INVALID' });
    assert.throws(() => verify(`${token}.extra`), { code: 'LICENSE_FORMAT_INVALID' });
});

async function fixture(t) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'eos-nwl3-'));
    let offset = 0;
    const sender = 'system.adapter.nexowatt-devices.0';
    const logs = [];
    const adapter = {
        log: { info: text => logs.push(text), warn() {}, error() {} },
        getForeignObjectAsync: async id => id === 'system.meta.uuid' ? { native: { uuid } } :
            id === sender ? { type: 'instance', common: { enabled: true, name: 'nexowatt-devices' } } : null,
    };
    const services = [];
    const make = () => {
        const service = new EosLicenseService(adapter, { directory, publicKeys,
            now: () => now + offset, monotonic: () => offset });
        services.push(service);
        return service;
    };
    t.after(async () => { services.forEach(service => service.stop()); await fs.rm(directory, { recursive: true, force: true }); });
    return { directory, sender, logs, make, advance: milliseconds => { offset += milliseconds; },
        request: required => ({ v: 1, nonce: crypto.randomBytes(16).toString('hex'), adapter: 'nexowatt-devices', feature: 'energy', required }) };
}

test('one NWL3 activation persists encrypted across service restart; failed imports preserve it', async t => {
    const f = await fixture(t);
    const service = f.make();
    await service.start();
    assert.equal(service.statusView().coreEnabled, false);
    const token = sign(base());
    const activated = await service.activate(token);
    assert.equal(activated.coreEnabled, true);
    assert.equal(activated.tokenVersion, 3);
    assert.equal(activated.scope, 'system');
    const ciphertext = await fs.readFile(path.join(f.directory, 'license.enc'), 'utf8');
    assert.ok(!ciphertext.includes(token) && !ciphertext.includes(uuid));
    await assert.rejects(service.activate(sign({ ...base(), uuid: crypto.randomUUID() })), { code: 'LICENSE_UUID_MISMATCH' });
    assert.equal((await service.status()).coreEnabled, true);
    assert.equal(await fs.readFile(path.join(f.directory, 'license.enc'), 'utf8'), ciphertext);
    service.stop();
    const restarted = f.make();
    assert.equal((await restarted.start()).coreEnabled, true);
    const outward = JSON.stringify({ status: restarted.statusView(), logs: f.logs });
    assert.ok(!outward.includes(token) && !outward.includes('PRIVATE KEY'));
});

test('central system license reaches enabled extension via real SDK with feature/quantity checks', async t => {
    t.mock.method(Date, 'now', () => now);
    const f = await fixture(t);
    const service = f.make();
    await service.start();
    await service.activate(sign(base()));
    const consumer = { name: 'nexowatt-devices', namespace: 'nexowatt-devices.0', log: { info() {}, warn() {}, error() {} },
        sendTo(instance, command, request, callback) {
            assert.equal(instance, 'eos-admin.0'); assert.equal(command, 'eos.license.check');
            void service.check(f.sender, request).then(callback);
        } };
    let losses = 0;
    const guard = createLicenseGuard(consumer, { required: { chargePoints: 3, batteries: 2 }, onLost() { losses++; } });
    t.after(() => guard.stop());
    assert.equal(await guard.refresh(), true);
    guard.assertAllowed();
    assert.equal(guard.isFeatureAllowed('billing'), false);
    assert.equal((await service.check(f.sender, f.request({ chargePoints: 4 }))).code, 'LICENSE_LIMIT');
    await service.activate(sign({ ...base(), edition: 'pro' }));
    assert.equal(await guard.refresh(), true);
    guard.assertFeatureAllowed('billing');
    assert.equal((await service.check(f.sender, f.request({ chargePoints: 50, batteries: 10 }))).valid, true);
    assert.equal((await service.check(f.sender, f.request({ chargePoints: 51 }))).code, 'LICENSE_LIMIT');
    await service.remove();
    assert.equal(await guard.refresh(), false);
    assert.throws(() => guard.assertAllowed());
    assert.ok(losses > 0);
});

test('NWL2 does not gain system scope or core access from unrelated extension activation', async t => {
    const f = await fixture(t);
    const service = f.make();
    await service.start();
    const payload = { ...base(), v: 2, adapters: ['nexowatt-devices'], limits: { chargePoints: 1, batteries: 0 }, expiresAt: now + 60000 };
    delete payload.scope;
    const status = await service.activate(sign(payload, 'NWL2'));
    assert.equal(status.valid, true);
    assert.equal(status.tokenVersion, 2);
    assert.equal(status.scope, 'adapters');
    assert.equal(status.coreEnabled, false);
    assert.deepEqual(status.limits, { chargePoints: 1, batteries: 0 });
    assert.equal((await service.check(f.sender, f.request({ chargePoints: 1 }))).valid, true);
    assert.equal((await service.check(f.sender, f.request({ chargePoints: 2 }))).code, 'LICENSE_LIMIT');
    assert.equal((await service.activate(sign({ ...payload, adapters: ['eos-admin'] }, 'NWL2'))).coreEnabled, false);
    const coreStatus = await service.activate(sign({ ...payload, adapters: ['nexowatt-ui'] }, 'NWL2'));
    assert.equal(coreStatus.coreEnabled, true);
    assert.equal((await service.check(f.sender, f.request({}))).code, 'LICENSE_ADAPTER');
});

test('synchronous hosted snapshot cannot retain expired or stale grants', async t => {
    const f = await fixture(t);
    const service = f.make();
    await service.start();
    await service.activate(sign(base()));
    f.advance(LEASE_MS);
    assert.equal(service.statusView().coreEnabled, false);
    assert.equal(service.statusView().code, 'SERVICE_STALE');
    assert.equal((await service.status()).coreEnabled, true, 'fresh successful verification renews snapshot');
    const payload = { ...base(), v: 2, adapters: ['nexowatt-ui'], limits: { chargePoints: 1, batteries: 0 }, expiresAt: now + LEASE_MS + 10 };
    delete payload.scope;
    await service.activate(sign(payload, 'NWL2'));
    f.advance(10);
    assert.equal(service.statusView().valid, false);
    assert.equal(service.statusView().code, 'LICENSE_EXPIRED');
});
