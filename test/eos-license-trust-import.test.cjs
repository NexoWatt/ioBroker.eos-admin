'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { EosLicenseTrust, MANUFACTURER_KEYS, MANUFACTURER_FINGERPRINTS } = require('../src/lib/eosLicenseTrust');
const { EosLicenseService } = require('../src/lib/eosLicenseService');

function publicIssuer(kid = 'ephemeral_issuer') {
    const pair = crypto.generateKeyPairSync('ed25519');
    return { pair, keys: { [kid]: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() } };
}

function trustFixture({ manufacturerKeys, osKeys = null, explicit = false } = {}) {
    const state = { bytes: null, osKeys, explicit, readError: null, writeError: null, writes: 0 };
    const store = {
        readImportedTrust: async () => state.bytes && Buffer.from(state.bytes),
        writeImportedTrust: async bytes => {
            if (state.writeError) throw state.writeError;
            state.bytes = Buffer.from(bytes); state.writes++;
        },
    };
    const readOsTrust = async () => {
        if (state.readError) throw state.readError;
        return { keys: state.osKeys, explicit: state.explicit };
    };
    const create = pins => new EosLicenseTrust({ store, readOsTrust, manufacturerKeys: pins });
    return { state, create, trust: create(manufacturerKeys) };
}

test('release public metadata alone never activates trust; exact manufacturer import persists canonically', async () => {
    const f = trustFixture();
    await assert.rejects(f.trust.load(), { code: 'TRUST_MISSING' });
    assert.equal(f.state.bytes, null);
    assert.deepEqual(f.trust.statusView(), {
        v: 1, ready: false, code: 'TRUST_MISSING', canImport: true, source: 'none', keys: [],
        allowedKeys: Object.keys(MANUFACTURER_KEYS).map(kid => ({ kid, fingerprint: MANUFACTURER_FINGERPRINTS[kid], source: 'release' })),
    });
    const crlf = Object.fromEntries(Object.entries(MANUFACTURER_KEYS).map(([kid, pem]) => [kid, pem.replaceAll('\n', '\r\n')]));
    await f.trust.importKeys(crlf);
    assert.deepEqual(f.trust.exportKeys(), MANUFACTURER_KEYS);
    const restarted = f.create();
    await restarted.load();
    assert.equal(restarted.statusView().source, 'restored');
    assert.equal(restarted.statusView().ready, true);
    assert.ok(!JSON.stringify(restarted.statusView()).includes('BEGIN PUBLIC KEY'));
    await restarted.importKeys(MANUFACTURER_KEYS);
    assert.equal(f.state.writes, 1, 'canonical repeated import is idempotent');
});

test('unknown issuer, wrong key under known ID, malformed and private input preserve valid imported trust', async () => {
    const f = trustFixture();
    await f.trust.importKeys(MANUFACTURER_KEYS);
    const before = Buffer.from(f.state.bytes);
    const alternate = publicIssuer('unknown_issuer');
    await assert.rejects(f.trust.importKeys(alternate.keys), { code: 'TRUST_IMPORT_UNKNOWN_KEY' });
    await assert.rejects(f.trust.importKeys({ [Object.keys(MANUFACTURER_KEYS)[0]]: Object.values(alternate.keys)[0] }), { code: 'TRUST_KEY_CONFLICT' });
    const secret = alternate.pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    for (const candidate of [null, [], {}, { vaultVersion: 1 }, { bad: secret }, { bad: 'x'.repeat(32769) }, { '../bad': Object.values(MANUFACTURER_KEYS)[0] }]) {
        await assert.rejects(f.trust.importKeys(candidate), { code: 'TRUST_INVALID' });
        assert.deepEqual(f.state.bytes, before);
    }
    assert.equal(f.trust.statusView().ready, true);
});

test('valid OS trust combines additively; explicit OS override is the sole allowed authority', async () => {
    const issuer = publicIssuer('os_issuer');
    const f = trustFixture({ osKeys: issuer.keys });
    await f.trust.load();
    await f.trust.importKeys(MANUFACTURER_KEYS);
    assert.equal(f.trust.statusView().source, 'combined');
    assert.equal(Object.keys(f.trust.exportKeys()).length, 2);
    const g = trustFixture({ osKeys: issuer.keys, explicit: true });
    await g.trust.load();
    assert.deepEqual(g.trust.statusView().allowedKeys.map(key => key.kid), ['os_issuer']);
    await assert.rejects(g.trust.importKeys(MANUFACTURER_KEYS), { code: 'TRUST_IMPORT_UNKNOWN_KEY' });
    await g.trust.importKeys(issuer.keys);
    assert.equal(g.trust.statusView().keys[0].source, 'os+restored');
    assert.equal(g.trust.statusView().source, 'combined');
});

test('invalid present OS authority or conflicting manufacturer ID fails closed without file changes', async () => {
    const f = trustFixture();
    await f.trust.importKeys(MANUFACTURER_KEYS);
    const before = Buffer.from(f.state.bytes);
    for (const code of ['TRUST_PERMISSIONS', 'TRUST_INVALID', 'ENOENT', 'EACCES']) {
        f.state.readError = Object.assign(new Error(code), { code });
        await assert.rejects(f.trust.load());
        assert.equal(f.trust.statusView().ready, false);
        assert.equal(f.trust.statusView().canImport, false);
        await assert.rejects(f.trust.importKeys(MANUFACTURER_KEYS));
        assert.deepEqual(f.state.bytes, before);
    }
    f.state.readError = null;
    f.state.osKeys = { [Object.keys(MANUFACTURER_KEYS)[0]]: Object.values(publicIssuer().keys)[0] };
    await assert.rejects(f.trust.load(), { code: 'TRUST_KEY_CONFLICT' });
    assert.deepEqual(f.state.bytes, before);
});

test('OS-only revocation and release-pin withdrawal invalidate restored keys on every reload', async () => {
    const issuer = publicIssuer('os_issuer');
    const f = trustFixture({ osKeys: issuer.keys });
    await f.trust.importKeys(issuer.keys);
    f.state.osKeys = null;
    await assert.rejects(f.trust.load(), { code: 'TRUST_IMPORT_UNKNOWN_KEY' });
    assert.equal(f.trust.statusView().ready, false);
    f.state.osKeys = issuer.keys;
    await f.trust.load();
    assert.equal(f.trust.statusView().ready, true);
    const g = trustFixture();
    await g.trust.importKeys(MANUFACTURER_KEYS);
    const changedRelease = g.create(issuer.keys);
    await assert.rejects(changedRelease.load(), { code: 'TRUST_IMPORT_UNKNOWN_KEY' });
});

test('authoritative override applied after a release import revokes the no-longer-allowed local authority', async () => {
    const f = trustFixture();
    await f.trust.importKeys(MANUFACTURER_KEYS);
    f.state.osKeys = publicIssuer('other_os_issuer').keys;
    f.state.explicit = true;
    await assert.rejects(f.trust.load(), { code: 'TRUST_IMPORT_UNKNOWN_KEY' });
    assert.equal(f.trust.statusView().keys.length, 0);
});

test('withdrawing the final release pin leaves valid OS authority available', async () => {
    const issuer = publicIssuer('os_issuer');
    const f = trustFixture({ manufacturerKeys: {}, osKeys: issuer.keys });
    await f.trust.load();
    assert.deepEqual(f.trust.exportKeys(), issuer.keys);
    assert.equal(f.trust.statusView().allowedKeys.length, 1);
    assert.equal(f.trust.statusView().allowedKeys[0].source, 'os');
    const noAuthority = trustFixture({ manufacturerKeys: {} });
    await assert.rejects(noAuthority.trust.load(), { code: 'TRUST_MISSING' });
    assert.equal(noAuthority.trust.statusView().canImport, false);
});

test('32 existing OS keys remain valid beside unused release pins; effective map still caps at 32', async () => {
    const keys = Object.fromEntries(Array.from({ length: 32 }, (_, i) => [`os_${i}`, Object.values(MANUFACTURER_KEYS)[0]]));
    const f = trustFixture({ osKeys: keys });
    await f.trust.load();
    assert.equal(f.trust.statusView().keys.length, 32);
    assert.equal(f.trust.statusView().allowedKeys.length, 33);
    await assert.rejects(f.trust.importKeys(MANUFACTURER_KEYS), { code: 'TRUST_KEY_LIMIT' });
    assert.equal(f.state.bytes, null);
    assert.equal(f.trust.statusView().ready, true);
    assert.equal(Object.keys(f.trust.exportKeys()).length, 32);
});

test('malformed local cache, size limits and write failure deny without silently replacing existing data', async () => {
    const f = trustFixture();
    await f.trust.importKeys(MANUFACTURER_KEYS);
    const good = Buffer.from(f.state.bytes);
    for (const bytes of [Buffer.from('{}'), Buffer.from('{'), Buffer.from([0xff]), Buffer.alloc(32769, 32)]) {
        f.state.bytes = bytes;
        await assert.rejects(f.trust.load());
        await assert.rejects(f.trust.importKeys(MANUFACTURER_KEYS));
        assert.deepEqual(f.state.bytes, bytes);
    }
    f.state.bytes = good;
    const issuer = publicIssuer('os_issuer'); f.state.osKeys = issuer.keys;
    f.state.writeError = Object.assign(new Error('fixture failure'), { code: 'STORAGE_IO_ERROR' });
    await assert.rejects(f.trust.importKeys(issuer.keys), { code: 'STORAGE_IO_ERROR' });
    assert.deepEqual(f.state.bytes, good);
    const tooMany = Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`issuer_${i}`, Object.values(issuer.keys)[0]]));
    await assert.rejects(f.trust.importKeys(tooMany), { code: 'TRUST_INVALID' });
});

const UUID = '12345678-1234-4234-8234-123456789abc';
async function serviceFixture(t) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'eos-license-import-'));
    const issuer = publicIssuer('service_issuer');
    const state = { wall: Date.now(), mono: 1000, osKeys: null, explicit: false, osError: null };
    const adapter = { getForeignObjectAsync: async () => ({ native: { uuid: UUID } }), log: { info: () => {} } };
    const services = [];
    function create() {
        const service = new EosLicenseService(adapter, {
            directory, manufacturerKeys: issuer.keys, now: () => state.wall, monotonic: () => state.mono,
        });
        service.readOsTrust = async () => {
            if (state.osError) throw state.osError;
            return { keys: state.osKeys, explicit: state.explicit };
        };
        services.push(service); return service;
    }
    function token() {
        const payload = {
            v: 3, kid: 'service_issuer', licenseId: 'temporary-test-license', uuid: UUID, edition: 'home',
            issuedAt: state.wall - 1000, notBefore: state.wall - 1000, expiresAt: null, scope: 'system',
        };
        const body = `NWL3.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
        return `${body}.${crypto.sign(null, Buffer.from(body), issuer.pair.privateKey).toString('base64url')}`;
    }
    t.after(async () => { services.forEach(service => service.stop()); await fs.rm(directory, { recursive: true, force: true }); });
    return { directory, state, issuer, create, token };
}

test('service recovers failed first trust initialization, activates once and persists across restart', async t => {
    const f = await serviceFixture(t); const service = f.create();
    assert.equal((await service.start()).code, 'TRUST_MISSING');
    const imported = await service.importTrust(f.issuer.keys);
    assert.equal(imported.ready, true); assert.equal(imported.licenseStatus.code, 'LICENSE_MISSING');
    assert.ok(Number.isFinite(service.clockWallAnchor) && Number.isFinite(service.clockMonoAnchor));
    assert.equal((await service.activate(f.token())).coreEnabled, true);
    const before = await fs.readFile(path.join(f.directory, 'license.enc'));
    await assert.rejects(service.importTrust(publicIssuer('unapproved').keys), { code: 'TRUST_IMPORT_UNKNOWN_KEY' });
    assert.deepEqual(await fs.readFile(path.join(f.directory, 'license.enc')), before);
    assert.equal((await service.status()).valid, true);
    service.stop();
    const restarted = f.create();
    assert.equal((await restarted.start()).valid, true);
    assert.deepEqual(await restarted.exportTrust(), f.issuer.keys);
});

test('trust recheck repairs a failed OS startup without resetting the license or clock latch', async t => {
    const f = await serviceFixture(t); const service = f.create();
    f.state.osError = Object.assign(new Error('fixture trust permissions'), { code: 'TRUST_PERMISSIONS' });
    assert.equal((await service.start()).code, 'TRUST_PERMISSIONS');
    f.state.osError = null;
    await service.importTrust(f.issuer.keys);
    await service.activate(f.token());
    const savedHighWater = service.highWaterMark;
    f.state.wall -= 5000; f.state.mono += 1000;
    assert.equal((await service.status()).code, 'LICENSE_CLOCK_ROLLBACK');
    const recovered = await service.recheckTrust();
    assert.equal(recovered.licenseStatus.valid, false);
    assert.equal(recovered.licenseStatus.code, 'LICENSE_CLOCK_ROLLBACK');
    f.state.wall += 6000;
    await assert.rejects(service.importTrust(f.issuer.keys), { code: 'LICENSE_CLOCK_ROLLBACK' });
    assert.ok(service.highWaterMark >= savedHighWater);
});

test('fresh service status observes OS-only authority removal instead of retaining cached grants', async t => {
    const f = await serviceFixture(t); const service = f.create();
    // Use a distinct OS-only issuer; the release pin is not the authority here.
    const other = publicIssuer('os_only');
    f.state.osKeys = other.keys;
    await service.start(); await service.importTrust(other.keys);
    const payload = { v: 3, kid: 'os_only', licenseId: 'temporary-os-license', uuid: UUID, edition: 'home', issuedAt: f.state.wall - 1, notBefore: f.state.wall - 1, expiresAt: null, scope: 'system' };
    const signed = `NWL3.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
    const token = `${signed}.${crypto.sign(null, Buffer.from(signed), other.pair.privateKey).toString('base64url')}`;
    assert.equal((await service.activate(token)).valid, true);
    f.state.osKeys = null;
    const status = await service.status();
    assert.equal(status.valid, false); assert.equal(status.code, 'TRUST_IMPORT_UNKNOWN_KEY');
    f.state.osKeys = other.keys;
    assert.equal((await service.recheckTrust()).licenseStatus.valid, true);
});

test('failed storage refresh clears public readiness and prevents export of a stale authority', async t => {
    const f = await serviceFixture(t); const service = f.create();
    await service.start(); await service.importTrust(f.issuer.keys);
    await service.activate(f.token());
    assert.equal((await service.trustStatus()).ready, true);
    await fs.chmod(f.directory, 0o755);
    const status = await service.trustStatus();
    assert.equal(status.ready, false); assert.equal(status.code, 'STORAGE_UNSAFE_PATH');
    assert.equal(status.keys.length, 0); assert.equal(status.canImport, false);
    await assert.rejects(service.exportTrust(), { code: 'STORAGE_UNSAFE_PATH' });
    assert.equal(service.statusView().valid, false);
    await fs.chmod(f.directory, 0o700);
    assert.equal((await service.recheckTrust()).licenseStatus.valid, true);
});

test('authority failure observed during import or activation immediately clears the synchronous license view', async t => {
    const f = await serviceFixture(t); const service = f.create();
    await service.start(); await service.importTrust(f.issuer.keys); await service.activate(f.token());
    f.state.osError = Object.assign(new Error('fixture invalid root authority'), { code: 'TRUST_PERMISSIONS' });
    await assert.rejects(service.importTrust(f.issuer.keys), { code: 'TRUST_PERMISSIONS' });
    assert.equal(service.statusView().valid, false);
    f.state.osError = null;
    assert.equal((await service.recheckTrust()).licenseStatus.valid, true);
    f.state.osError = Object.assign(new Error('fixture invalid root authority'), { code: 'TRUST_PERMISSIONS' });
    await assert.rejects(service.activate(f.token()), { code: 'TRUST_PERMISSIONS' });
    assert.equal(service.statusView().valid, false);
});
