'use strict';
// Real HTTPS, Express parsers, public routes, license service and protected files.
// The ioBroker UUID/session boundary and OS-trust reader are explicit fixtures;
// this suite does not claim a running controller or production issuer private key.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const https = require('node:https');
const crypto = require('node:crypto');
const { once } = require('node:events');
const { createRequire } = require('node:module');
const express = require('express');
const runtime = process.env.EOS_TEST_RUNTIME === 'build' ? '../build/lib' : '../src/lib';
const { registerLicenseRoutes } = require(`${runtime}/eosLicenseHttp`);
const { EosLicenseService } = require(`${runtime}/eosLicenseService`);
const { publicKeyFingerprint } = require(`${runtime}/eosLicenseTrust`);
const keygenDirectory = process.env.NEXOWATT_KEYGEN_SOURCE;
const missingIssuer = keygenDirectory ? false : 'Set NEXOWATT_KEYGEN_SOURCE to the reviewed Keygen 1.0.4 source directory';

function publicKeys(kid = 'fixture-manufacturer') {
    const pair = crypto.generateKeyPairSync('ed25519');
    return { [kid]: pair.publicKey.export({ format: 'pem', type: 'spki' }).toString() };
}

function tlsCertificate() {
    const forge = createRequire(require.resolve('@iobroker/js-controller-common-db'))('node-forge');
    const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const key = pair.privateKey.export({ format: 'pem', type: 'pkcs1' });
    const cert = forge.pki.createCertificate();
    cert.publicKey = forge.pki.publicKeyFromPem(pair.publicKey.export({ format: 'pem', type: 'spki' }));
    cert.serialNumber = `01${crypto.randomBytes(15).toString('hex')}`;
    cert.validity.notBefore = new Date(Date.now() - 60000);
    cert.validity.notAfter = new Date(Date.now() + 3600000);
    const subject = [{ name: 'commonName', value: 'localhost' }];
    cert.setSubject(subject); cert.setIssuer(subject);
    cert.setExtensions([{ name: 'basicConstraints', cA: true },
        { name: 'subjectAltName', altNames: [{ type: 7, ip: '127.0.0.1' }] },
        { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, keyCertSign: true }]);
    cert.sign(forge.pki.privateKeyFromPem(key), forge.md.sha256.create());
    return { key, cert: forge.pki.certificateToPem(cert) };
}

async function fixture(t, options = {}) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'eos-license-https-'));
    await fs.chmod(root, 0o700);
    const trustedRuntimeRoot = path.join(root, 'iobroker');
    await fs.mkdir(trustedRuntimeRoot, { mode: 0o775 });
    await fs.chmod(trustedRuntimeRoot, 0o2775);
    const directory = path.join(trustedRuntimeRoot, 'iobroker-data', 'eos-admin.0', 'licensing');
    const uuid = options.uuid || crypto.randomUUID();
    const manufacturerKeys = options.manufacturerKeys || publicKeys();
    const logs = [];
    const adapter = {
        getForeignObjectAsync: async id => id === 'system.meta.uuid' ? { native: { uuid } } : null,
        log: { info: value => logs.push(String(value)) },
    };
    let service;
    const readOsTrust = options.readOsTrust || (async () => ({ keys: null, explicit: false }));
    async function startService() {
        service = new EosLicenseService(adapter, { directory, trustedRuntimeRoot, manufacturerKeys });
        // Fixture dependency only: never an environment/config/state trust bypass.
        service.readOsTrust = readOsTrust;
        await service.start();
    }
    await startService();
    const app = express();
    const session = crypto.randomBytes(24).toString('base64url');
    const api = Object.fromEntries(['status', 'activate', 'remove', 'trustStatus', 'importTrust', 'recheckTrust', 'exportTrust']
        .map(name => [name, (...args) => service[name](...args)]));
    registerLicenseRoutes(app, { service: api, secure: true, publicOrigin: '',
        authorize: async req => req.headers.cookie === `fixture_admin=${session}`,
        jsonParser: express.json({ limit: '20kb', strict: true }),
        trustJsonParser: express.json({ limit: '40kb', strict: true }),
        pagePath: path.resolve(__dirname, '../public/nexowatt-license.html'),
        scriptPath: path.resolve(__dirname, '../public/nexowatt-license.js'),
    });
    const certificate = tlsCertificate();
    const server = https.createServer(certificate, app);
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    t.after(async () => {
        service.stop(); server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await fs.rm(root, { recursive: true, force: true });
    });
    const origin = `https://127.0.0.1:${server.address().port}`;
    const request = (route, { method = 'GET', body, raw, headers = {}, ca = certificate.cert } = {}) => new Promise((resolve, reject) => {
        const bytes = raw === undefined ? body === undefined ? undefined : JSON.stringify(body) : raw;
        const requestHeaders = { cookie: `fixture_admin=${session}`, origin, 'x-eos-license': '1',
            'sec-fetch-site': 'same-origin', ...headers };
        if (bytes !== undefined) {
            requestHeaders['content-type'] = 'application/json';
            requestHeaders['content-length'] = Buffer.byteLength(bytes);
        }
        const req = https.request({ host: '127.0.0.1', port: server.address().port,
            path: `/nexowatt/license${route}`, method, headers: requestHeaders, ca,
            rejectUnauthorized: true, agent: false, timeout: 5000, servername: '' }, res => {
            const chunks = []; let size = 0;
            res.on('data', chunk => {
                size += chunk.length;
                if (size > 65536) req.destroy(Error('TEST_RESPONSE_LIMIT'));
                else chunks.push(chunk);
            });
            res.on('error', reject);
            res.on('end', () => {
                try {
                    assert.equal(res.socket.authorized, true);
                    const text = Buffer.concat(chunks).toString('utf8');
                    resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(text) });
                } catch (error) { reject(error); }
            });
        });
        req.on('error', reject); req.on('timeout', () => req.destroy(Error('TEST_REQUEST_TIMEOUT'))); req.end(bytes);
    });
    return { root, trustedRuntimeRoot, directory, uuid, manufacturerKeys, request, logs,
        restart: async () => { service.stop(); await startService(); },
        get service() { return service; },
    };
}

function assertError(result, status, code) {
    assert.equal(result.status, status);
    assert.deepEqual(result.body, { error: code });
    assert.equal(result.headers['cache-control'], 'no-store');
}

async function snapshot(directory) {
    const result = {};
    for (const name of (await fs.readdir(directory)).sort()) {
        const filename = path.join(directory, name);
        const stat = await fs.lstat(filename);
        if (stat.isFile()) result[name] = (await fs.readFile(filename)).toString('base64');
    }
    return result;
}

test('real HTTPS rejects unauthorized/cross-origin trust requests and applies separate body bounds', async t => {
    const f = await fixture(t);
    const paths = ['/trust/status', '/trust/export', '/trust/import', '/trust/recheck'];
    for (const route of paths) {
        assertError(await f.request(route, { method: route.endsWith('import') || route.endsWith('recheck') ? 'POST' : 'GET',
            body: {}, headers: { cookie: 'fixture_user=installer' } }), 403, 'LICENSE_ADMIN_REQUIRED');
    }
    assertError(await f.request('/trust/import', { method: 'POST', body: { keys: f.manufacturerKeys },
        headers: { origin: 'https://foreign.invalid' } }), 403, 'LICENSE_ORIGIN');
    assertError(await f.request('/trust/import', { method: 'POST', raw: ' '.repeat(40961) }), 413, 'LICENSE_REQUEST');
    assertError(await f.request('/activate', { method: 'POST', raw: ' '.repeat(20481) }), 413, 'LICENSE_REQUEST');
    assertError(await f.request('/trust/import', { method: 'POST', raw: '{"keys":' }), 400, 'LICENSE_REQUEST');
    // Whitespace outside the file's map may exceed the old 20-KiB activation limit.
    const imported = await f.request('/trust/import', { method: 'POST',
        raw: `${' '.repeat(22000)}${JSON.stringify({ keys: f.manufacturerKeys })}` });
    assert.equal(imported.status, 200); assert.equal(imported.body.ready, true);
    await assert.rejects(f.request('/trust/status', { ca: null }), error => /SELF_SIGNED|CERT/.test(error.code || ''));
});

test('real public import rejects unknown, conflicting and private keys while preserving trusted files', async t => {
    const f = await fixture(t);
    assert.equal((await f.request('/trust/import', { method: 'POST', body: { keys: f.manufacturerKeys } })).status, 200);
    const before = await snapshot(f.directory);
    const foreign = publicKeys('unapproved');
    const conflicting = publicKeys(Object.keys(f.manufacturerKeys)[0]);
    const privatePem = crypto.generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    for (const keys of [foreign, { ...f.manufacturerKeys, ...foreign }, conflicting,
        { [Object.keys(f.manufacturerKeys)[0]]: privatePem }]) {
        const rejected = await f.request('/trust/import', { method: 'POST', body: { keys } });
        assert.equal(rejected.status, 400);
        assert.match(rejected.body.error, /^TRUST_/);
        assert.equal(Object.keys(rejected.body).length, 1);
        assert.deepEqual(await snapshot(f.directory), before);
    }
    const exported = await f.request('/trust/export');
    assert.deepEqual(exported.body, f.manufacturerKeys);
    assert.match(exported.headers['content-disposition'], /nexowatt-license-public-trust\.json/);
    assert.equal((await f.request('/trust/status')).body.ready, true);
});

test('invalid OS policy fails closed and explicit OS policy is the sole upload authority', async t => {
    const invalid = await fixture(t, { readOsTrust: async () => {
        throw Object.assign(Error('PRIVATE_OS_PATH'), { code: 'TRUST_READ_DENIED' });
    } });
    const status = await invalid.request('/trust/status');
    assert.equal(status.body.ready, false); assert.equal(status.body.canImport, false);
    assertError(await invalid.request('/trust/import', { method: 'POST', body: { keys: invalid.manufacturerKeys } }), 503, 'TRUST_READ_DENIED');
    assertError(await invalid.request('/trust/export'), 503, 'TRUST_READ_DENIED');
    const osKeys = publicKeys('os-exclusive');
    const explicit = await fixture(t, { readOsTrust: async () => ({ keys: osKeys, explicit: true }) });
    const policyBefore = JSON.stringify(osKeys);
    assertError(await explicit.request('/trust/import', { method: 'POST', body: { keys: explicit.manufacturerKeys } }),
        400, 'TRUST_IMPORT_UNKNOWN_KEY');
    assert.equal((await explicit.request('/trust/import', { method: 'POST', body: { keys: osKeys } })).status, 200);
    assert.deepEqual((await explicit.request('/trust/export')).body, osKeys);
    assert.equal(JSON.stringify(osKeys), policyBefore);
    assert.equal((await explicit.request('/trust/status')).body.source, 'combined');
});

test('unsafe imported-trust permissions produce a bounded storage error without overwriting the file', async t => {
    if (process.platform === 'win32') return t.skip('POSIX permission semantics required');
    const f = await fixture(t);
    assert.equal((await f.request('/trust/import', { method: 'POST', body: { keys: f.manufacturerKeys } })).status, 200);
    const filename = path.join(f.directory, 'imported-public-keys.json');
    const before = await fs.readFile(filename);
    await fs.chmod(filename, 0o644);
    assertError(await f.request('/trust/import', { method: 'POST', body: { keys: f.manufacturerKeys } }), 503, 'STORAGE_UNSAFE_PATH');
    assert.deepEqual(await fs.readFile(filename), before);
    assert.equal((await f.request('/trust/recheck', { method: 'POST', body: {} })).body.ready, false);
});

test('Keygen 1.0.4 → HTTPS import → activation → encrypted persistence → restart works under service-owned 2775 runtime',
    { skip: missingIssuer, timeout: 30000 }, async t => {
        assert.ok(path.isAbsolute(keygenDirectory), 'Keygen source must be an explicit absolute directory');
        const pkg = JSON.parse(await fs.readFile(path.join(keygenDirectory, 'package.json'), 'utf8'));
        assert.equal(pkg.name, 'nexowatt-eos-offline-keygen'); assert.equal(pkg.version, '1.0.4');
        const issuerFile = path.join(keygenDirectory, 'lib/issuer.js');
        assert.equal(crypto.createHash('sha256').update(await fs.readFile(issuerFile)).digest('hex'),
            '6f7711e2995e5e7167776a20fb0c9250386923ddabc6177e81cd1d1f27d82c7f', 'reviewed issuer source');
        const issuer = require(issuerFile);
        const passphrase = crypto.randomBytes(24).toString('base64url');
        const vault = await issuer.createVaultRecord({ kid: 'ephemeral-https-issuer', passphrase });
        const manufacturerKeys = issuer.publicTrust(vault);
        const f = await fixture(t, { manufacturerKeys });
        if (process.platform !== 'win32') {
            assert.equal((await fs.stat(f.trustedRuntimeRoot)).mode & 0o7777, 0o2775);
            assert.equal((await fs.stat(f.trustedRuntimeRoot)).uid, process.getuid());
        }
        const initial = await f.request('/trust/status');
        assert.equal(initial.body.ready, false); assert.equal(initial.body.canImport, true);
        assert.equal(initial.body.code, 'TRUST_MISSING');
        const imported = await f.request('/trust/import', { method: 'POST', body: { keys: manufacturerKeys } });
        assert.equal(imported.status, 200); assert.equal(imported.body.ready, true);
        assert.equal(imported.body.source, 'restored'); assert.equal(imported.body.licenseStatus.valid, false);
        assert.equal(imported.body.keys[0].fingerprint, publicKeyFingerprint(vault.publicKey));
        const { token } = await issuer.issue(vault, passphrase, { uuid: f.uuid, edition: 'pro' });
        assert.match(token, /^NWL3\./);
        const activated = await f.request('/activate', { method: 'POST', body: { token } });
        assert.equal(activated.status, 200); assert.equal(activated.body.valid, true);
        assert.equal(activated.body.coreEnabled, true); assert.equal(activated.body.scope, 'system');
        assert.equal(activated.body.edition, 'pro'); assert.equal(activated.body.tokenVersion, 3);
        const before = await snapshot(f.directory);
        assert.ok(before['license.enc']);
        for (const encoded of Object.values(before)) {
            assert.equal(Buffer.from(encoded, 'base64').includes(Buffer.from(token)), false);
        }
        if (process.platform !== 'win32') {
            assert.equal((await fs.stat(f.directory)).mode & 0o777, 0o700);
            for (const name of Object.keys(before)) assert.equal((await fs.stat(path.join(f.directory, name))).mode & 0o777, 0o600);
        }
        assertError(await f.request('/trust/import', { method: 'POST', body: { keys: publicKeys('unapproved') } }),
            400, 'TRUST_IMPORT_UNKNOWN_KEY');
        assert.deepEqual(await snapshot(f.directory), before);
        assert.equal((await f.request('/status')).body.valid, true);
        await f.restart();
        const restored = await f.request('/trust/recheck', { method: 'POST', body: {} });
        assert.equal(restored.status, 200); assert.equal(restored.body.ready, true);
        assert.equal(restored.body.source, 'restored'); assert.equal(restored.body.licenseStatus.valid, true);
        assert.equal(restored.body.licenseStatus.coreEnabled, true);
        assert.equal(restored.body.licenseStatus.uuid, f.uuid);
        assert.deepEqual((await f.request('/trust/export')).body, manufacturerKeys);
        assert.ok(!f.logs.join('\n').includes(token));
        assert.doesNotMatch(f.logs.join('\n'), /PRIVATE KEY|ciphertext|passphrase/);
    });
