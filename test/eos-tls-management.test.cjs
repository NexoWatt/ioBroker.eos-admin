'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const syncFs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const https = require('node:https');
const http = require('node:http');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const { createRequire } = require('node:module');
const vm = require('node:vm');
const express = require('express');
const emitted = process.env.EOS_TEST_RUNTIME === 'build';
const load = name => emitted ? require(`../build/lib/${name}`) : require('tsx/cjs/api').require(path.resolve(__dirname, `../src/lib/${name}.ts`), __filename);
const { EosTlsManager, tlsNames } = load('eosTlsManager');
const { registerEosTlsRoutes } = load('eosTlsHttp');
const { UnifiedSessions } = require('../src/lib/eosUnifiedBoundary');
const run = promisify(execFile);
const issuer = path.resolve(__dirname, '../tools/eos-tls-issuer.cjs');
const names = ['nexowatt', 'nexowatt.local', '127.0.0.1'];
function webHelpers() {
    const file = path.resolve(__dirname, emitted ? '../build/lib/web.js' : '../src/lib/web.ts');
    const req = createRequire(file);
    const source = syncFs.readFileSync(file, 'utf8');
    const compiled = emitted ? source : require('typescript').transpileModule(source, { compilerOptions: { target: 9, module: 1, esModuleInterop: true } }).outputText;
    const exports = {};
    vm.runInNewContext(compiled, { exports, module: { exports }, __dirname: path.dirname(file), __filename: file, Buffer, URL, Error, console, process, setTimeout, clearTimeout,
        require: name => {
            if (name === '@iobroker/adapter-core') return { EXIT_CODES: {}, I18n: {} };
            if (!emitted && name.startsWith('.') && syncFs.existsSync(path.resolve(path.dirname(file), `${name}.ts`))) return require('tsx/cjs/api').require(path.resolve(path.dirname(file), `${name}.ts`), file);
            return req(name);
        },
    }, { filename: file, timeout: 5000 });
    return exports;
}
async function fixture(t) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'eos-tls-test-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const passphraseFile = path.join(directory, 'ephemeral-passphrase');
    await fs.writeFile(passphraseFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
    const caDir = path.join(directory, 'ca');
    await run(process.execPath, [issuer, 'init', '--directory', caDir, '--passphrase-file', passphraseFile]);
    const root = await fs.readFile(path.join(caDir, 'root.pem'), 'utf8');
    const rootFingerprint = new crypto.X509Certificate(root).fingerprint256;
    const storage = path.join(directory, 'device');
    const manager = new EosTlsManager(storage);
    await manager.initialize();
    let sequence = 0;
    async function signed(managerValue = manager, approvedNames = names) {
        const state = await managerValue.createRequest({ names, replace: true });
        const csr = path.join(directory, `request-${sequence}.pem`);
        const output = path.join(directory, `issued-${sequence++}`);
        await fs.writeFile(csr, managerValue.publicRequest(), { mode: 0o600 });
        await run(process.execPath, [issuer, 'issue', '--directory', caDir, '--request', csr, '--names', approvedNames.join(','), '--output', output, '--passphrase-file', passphraseFile]);
        return { requestId: state.pending.requestId, certificate: await fs.readFile(path.join(output, 'certificate.pem'), 'utf8'), rootCertificate: root, rootFingerprint };
    }
    return { directory, storage, manager, signed, root, rootFingerprint, caDir, passphraseFile };
}
async function listen(server) { server.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); return server.address().port; }
async function close(server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
function tlsRequest(server, root, servername = 'nexowatt') {
    return new Promise((resolve, reject) => {
        https.get({ host: '127.0.0.1', port: server.address().port, servername, ca: root, agent: false }, response => {
            const fingerprint = response.socket.getPeerCertificate().fingerprint256;
            let body = ''; response.on('data', data => { body += data; }); response.on('end', () => resolve({ body, fingerprint }));
        }).on('error', reject);
    });
}

test('issuer creates encrypted offline CA; device CSR and public downloads never reveal either private key', async t => {
    const f = await fixture(t);
    assert.match(await fs.readFile(path.join(f.caDir, 'issuer-private.pem'), 'utf8'), /BEGIN ENCRYPTED PRIVATE KEY/);
    const issued = await f.signed();
    assert.match(f.manager.publicRequest(), /BEGIN CERTIFICATE REQUEST/);
    assert.doesNotMatch(JSON.stringify(f.manager.status()), /PRIVATE KEY/);
    const activated = await f.manager.importCertificate(issued);
    assert.equal(activated.restartRequired, true);
    assert.equal(activated.valid, true);
    assert.equal(activated.issuer, 'O=NexoWatt\nCN=NexoWatt EOS Local Root CA');
    assert.equal(new crypto.X509Certificate(f.manager.publicRoot()).fingerprint256, f.rootFingerprint);
    assert.equal((await fs.stat(path.join(f.storage, 'active.json'))).mode & 0o777, 0o600);
    assert.equal((await fs.stat(f.storage)).mode & 0o777, 0o700);
    assert.equal(await fs.readFile(path.join(f.storage, 'active.json'), 'utf8').then(value => value.includes('ENCRYPTED PRIVATE KEY')), false);
    assert.equal(activated.pending, null);
});

test('actual EOS HTTPS startup, SNI and IP use trusted identity; renewal preserves listener and survives restart', async t => {
    const f = await fixture(t);
    await f.manager.importCertificate(await f.signed());
    const reloaded = new EosTlsManager(f.storage); await reloaded.initialize();
    const { createEosServer } = webHelpers();
    const server = await createEosServer((_req, res) => res.end('EOS TLS active'), {}, { secure: true }, reloaded);
    await listen(server); t.after(() => close(server));
    const first = await tlsRequest(server, f.root);
    assert.equal(first.body, 'EOS TLS active');
    assert.equal((await tlsRequest(server, f.root, '')).fingerprint, first.fingerprint);
    assert.equal(reloaded.status().restartRequired, false);
    const port = server.address().port;
    const renewed = await f.signed(reloaded);
    assert.equal((await reloaded.importCertificate(renewed)).restartRequired, false);
    assert.equal(server.address().port, port);
    const second = await tlsRequest(server, f.root);
    assert.notEqual(second.fingerprint, first.fingerprint);
    assert.equal((await tlsRequest(server, f.root, '')).fingerprint, second.fingerprint);
    const again = new EosTlsManager(f.storage); await again.initialize();
    assert.equal(new crypto.X509Certificate(again.material().cert).fingerprint256, second.fingerprint);
});

test('wrong SAN, root fingerprint, request ID, key, expiry and CA are refused without changing active certificate', async t => {
    const f = await fixture(t);
    await f.manager.importCertificate(await f.signed());
    const baseline = await fs.readFile(path.join(f.storage, 'active.json'), 'utf8');
    const wrongNames = await f.signed(f.manager, ['other.example']);
    await assert.rejects(f.manager.importCertificate(wrongNames), /EOS_TLS_SAN_MISMATCH/);
    const correct = await f.signed();
    await assert.rejects(f.manager.importCertificate({ ...correct, requestId: '0'.repeat(32) }), /EOS_TLS_REQUEST_MISMATCH/);
    await assert.rejects(f.manager.importCertificate({ ...correct, rootFingerprint: '0'.repeat(64) }), /EOS_TLS_ROOT_FINGERPRINT_MISMATCH/);
    await assert.rejects(f.manager.importCertificate({ ...correct, certificate: JSON.parse(baseline).cert }), /EOS_TLS_KEY_OR_CA_MISMATCH/);
    await assert.rejects(f.manager.importCertificate({ ...correct, rootCertificate: correct.certificate, rootFingerprint: new crypto.X509Certificate(correct.certificate).fingerprint256 }), /EOS_TLS_KEY_OR_CA_MISMATCH/);
    const pending = JSON.parse(await fs.readFile(path.join(f.storage, 'pending.json'), 'utf8'));
    const csr = path.join(f.directory, 'expired-request.pem'); const keyFile = path.join(f.directory, 'expired-key.pem'); const cert = path.join(f.directory, 'expired.pem'); const extensions = path.join(f.directory, 'expired.cnf');
    await fs.writeFile(csr, pending.csr); await fs.writeFile(keyFile, pending.key, { mode: 0o600 });
    await fs.writeFile(extensions, '[server]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid,issuer\nsubjectAltName=DNS:nexowatt,DNS:nexowatt.local,IP:127.0.0.1\n');
    await run('/usr/bin/openssl', ['x509', '-req', '-in', csr, '-CA', path.join(f.caDir, 'root.pem'), '-CAkey', path.join(f.caDir, 'issuer-private.pem'), '-passin', `file:${f.passphraseFile}`, '-set_serial', '91', '-days', '0', '-extfile', extensions, '-extensions', 'server', '-out', cert]);
    await assert.rejects(f.manager.importCertificate({ ...correct, certificate: await fs.readFile(cert, 'utf8') }), /EOS_TLS_LIFETIME_INVALID/);
    const expiredRoot = path.join(f.directory, 'expired-root.pem');
    await run('/usr/bin/openssl', ['x509', '-in', path.join(f.caDir, 'root.pem'), '-signkey', path.join(f.caDir, 'issuer-private.pem'), '-passin', `file:${f.passphraseFile}`, '-days', '0', '-out', expiredRoot]);
    const expiredRootPem = await fs.readFile(expiredRoot, 'utf8');
    await assert.rejects(f.manager.importCertificate({ ...correct, rootCertificate: expiredRootPem, rootFingerprint: new crypto.X509Certificate(expiredRootPem).fingerprint256 }), /EOS_TLS_OPENSSL_FAILED/);
    assert.equal(await fs.readFile(path.join(f.storage, 'active.json'), 'utf8'), baseline);
    assert.equal(f.manager.status().pending.requestId, correct.requestId);
});

test('failed atomic activation and failed live context retain the previous identity and pending request', async t => {
    const f = await fixture(t);
    await f.manager.importCertificate(await f.signed());
    const baseline = await fs.readFile(path.join(f.storage, 'active.json'), 'utf8');
    const next = await f.signed();
    f.manager.attachManagedServer({ setSecureContext() { throw new Error('injected TLS context failure'); } });
    await assert.rejects(f.manager.importCertificate(next), /injected TLS context failure/);
    assert.equal(await fs.readFile(path.join(f.storage, 'active.json'), 'utf8'), baseline);
    assert.equal(f.manager.status().pending.requestId, next.requestId);
    f.manager.detach();
    await fs.rename(path.join(f.storage, 'active.json'), path.join(f.storage, 'saved-active.json'));
    await fs.mkdir(path.join(f.storage, 'active.json'), { mode: 0o700 });
    await assert.rejects(f.manager.importCertificate(next));
    assert.equal(new crypto.X509Certificate(f.manager.material().cert).fingerprint256, new crypto.X509Certificate(JSON.parse(baseline).cert).fingerprint256);
    assert.equal(f.manager.status().pending.requestId, next.requestId);
    await fs.rm(path.join(f.storage, 'active.json'), { recursive: true });
    await fs.rename(path.join(f.storage, 'saved-active.json'), path.join(f.storage, 'active.json'));
    assert.equal(await fs.readFile(path.join(f.storage, 'active.json'), 'utf8'), baseline);
});

test('concurrent requests are bounded; pending requests require explicit replacement and consumed requests cannot replay', async t => {
    const f = await fixture(t);
    const first = f.manager.createRequest({ names });
    await assert.rejects(f.manager.createRequest({ names }), /EOS_TLS_BUSY/);
    const state = await first;
    assert.equal((await f.manager.createRequest({ names })).pending.requestId, state.pending.requestId);
    await assert.rejects(f.manager.createRequest({ names: ['other'] }), /EOS_TLS_PENDING_REQUEST_EXISTS/);
    const signed = await f.signed();
    const pendingBytes = await fs.readFile(path.join(f.storage, 'pending.json'));
    await f.manager.importCertificate(signed);
    await assert.rejects(f.manager.importCertificate(signed), /EOS_TLS_REQUEST_MISMATCH/);
    // Simulate power loss after active rename but before stale pending cleanup.
    await fs.writeFile(path.join(f.storage, 'pending.json'), pendingBytes, { mode: 0o600 });
    const restarted = new EosTlsManager(f.storage); await restarted.initialize();
    assert.equal(restarted.status().pending, null);
    await assert.rejects(restarted.importCertificate(signed), /EOS_TLS_REQUEST_MISMATCH/);
});

test('committed certificate reports cleanup and directory-sync warnings without claiming a failed activation', async t => {
    const f = await fixture(t);
    const signed = await f.signed();
    const pendingPath = path.join(f.storage, 'pending.json');
    await fs.rename(pendingPath, path.join(f.storage, 'pending-before-import.json'));
    await fs.mkdir(pendingPath, { mode: 0o700 });
    const actualOpen = fs.open;
    const mocked = t.mock.method(fs, 'open', async (...args) => {
        const handle = await actualOpen(...args);
        if (args[0] === f.storage) handle.sync = async () => { throw new Error('injected directory fsync failure'); };
        return handle;
    });
    const result = await f.manager.importCertificate(signed);
    mocked.mock.restore();
    assert.equal(result.pending, null);
    assert.equal(result.restartRequired, true);
    assert.deepEqual(result.warnings.sort(), ['EOS_TLS_PENDING_CLEANUP_WARNING', 'EOS_TLS_STORAGE_SYNC_WARNING'].sort());
    assert.equal(JSON.parse(await fs.readFile(path.join(f.storage, 'active.json'), 'utf8')).requestId, signed.requestId);
    await assert.rejects(f.manager.importCertificate(signed), /EOS_TLS_REQUEST_MISMATCH/);
});

test('chain status and renewal warning include an intermediate that expires before the leaf', async t => {
    const f = await fixture(t);
    const pendingState = await f.manager.createRequest({ names });
    const p = name => path.join(f.directory, name);
    await run('/usr/bin/openssl', ['req', '-new', '-x509', '-sha384', '-days', '3650', '-key', path.join(f.caDir, 'issuer-private.pem'), '-passin', `file:${f.passphraseFile}`, '-out', p('root-with-intermediates.pem'), '-subj', '/O=NexoWatt/CN=NexoWatt EOS Local Root CA', '-addext', 'basicConstraints=critical,CA:TRUE,pathlen:1', '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-addext', 'subjectKeyIdentifier=hash', '-addext', 'authorityKeyIdentifier=keyid:always']);
    await run('/usr/bin/openssl', ['genpkey', '-algorithm', 'EC', '-pkeyopt', 'ec_paramgen_curve:secp384r1', '-out', p('intermediate-key.pem')]);
    await run('/usr/bin/openssl', ['req', '-new', '-key', p('intermediate-key.pem'), '-subj', '/O=NexoWatt/CN=Ephemeral Intermediate', '-out', p('intermediate.csr')]);
    await fs.writeFile(p('extensions.cnf'), '[ca]\nbasicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid,issuer\n[server]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid,issuer\nsubjectAltName=DNS:nexowatt,DNS:nexowatt.local,IP:127.0.0.1\n');
    await run('/usr/bin/openssl', ['x509', '-req', '-in', p('intermediate.csr'), '-CA', p('root-with-intermediates.pem'), '-CAkey', path.join(f.caDir, 'issuer-private.pem'), '-passin', `file:${f.passphraseFile}`, '-set_serial', '123', '-days', '2', '-extfile', p('extensions.cnf'), '-extensions', 'ca', '-out', p('intermediate.pem')]);
    await fs.writeFile(p('device.csr'), f.manager.publicRequest());
    await run('/usr/bin/openssl', ['x509', '-req', '-in', p('device.csr'), '-CA', p('intermediate.pem'), '-CAkey', p('intermediate-key.pem'), '-set_serial', '124', '-days', '90', '-extfile', p('extensions.cnf'), '-extensions', 'server', '-out', p('device.pem')]);
    const root = await fs.readFile(p('root-with-intermediates.pem'), 'utf8');
    const intermediate = await fs.readFile(p('intermediate.pem'), 'utf8');
    await f.manager.importCertificate({ requestId: pendingState.pending.requestId, certificate: `${await fs.readFile(p('device.pem'), 'utf8')}\n${intermediate}`, rootCertificate: root, rootFingerprint: new crypto.X509Certificate(root).fingerprint256 });
    const expiration = Date.parse(new crypto.X509Certificate(intermediate).validTo);
    assert.equal(Date.parse(f.manager.status().effectiveValidTo), expiration);
    assert.equal(f.manager.status().expiresSoon, true);
    const realNow = Date.now();
    t.mock.method(Date, 'now', () => realNow + 3 * 86400000);
    assert.equal(f.manager.status().valid, false);
});

test('invalid names and unsafe storage are rejected, not used as command/config fragments', async t => {
    for (const value of [[], ['*.local'], ['name\n[bad]'], ['name,IP:evil'], ['-abc'], ['a..b'], ['a'.repeat(64)], Array(33).fill('a')]) assert.throws(() => tlsNames(value));
    const f = await fixture(t);
    await fs.chmod(f.storage, 0o777);
    await assert.rejects(new EosTlsManager(f.storage).initialize(), /EOS_TLS_STORAGE_PERMISSIONS/);
    await fs.chmod(f.storage, 0o700);
    const target = path.join(f.directory, 'external.json'); await fs.writeFile(target, '{}', { mode: 0o600 });
    await fs.symlink(target, path.join(f.storage, 'active.json'));
    await assert.rejects(new EosTlsManager(f.storage).initialize());
    assert.equal(await fs.readFile(target, 'utf8'), '{}');
});

test('HTTP routes enforce real unified session, role, CSRF and same-origin for certificate actions', async t => {
    const f = await fixture(t); let role = 'admin'; let authenticated = true;
    const token = 'b'.repeat(40);
    const adapter = {};
    const session = await require('./fixtures/eos-idle-session.cjs').installIdleSession(adapter, { token, user: 'admin' });
    t.after(() => session.cleanup());
    const authority = new UnifiedSessions(adapter, { secure: true, externalOrigin: '',
        resolveAccess: async req => authenticated && req.headers.cookie === `access_token=${token}` ? { userId: 'system.user.admin', role, groups: [] } : { userId: null, role: 'enduser', groups: [] },
        firstLogin: async () => ({ required: false }), getLicense: () => ({ valid: true, coreEnabled: true }) });
    const app = express(); registerEosTlsRoutes({ app, manager: f.manager, baseDir: path.resolve(__dirname, '..'), authorize: req => authority.status(req), csrfAllowed: req => authority.csrfAllowed(req), requestAllowed: req => authority.requestAllowed(req) });
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); t.after(() => close(server));
    const request = (url, options = {}) => new Promise((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port: server.address().port, path: url, method: options.method || 'GET', headers: { host: 'nexowatt', cookie: `access_token=${token}`, ...options.headers } }, response => {
            const chunks = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8'), headers: response.headers }));
        }); req.on('error', reject); req.end(options.body);
    });
    assert.equal((await request('/security/tls/')).status, 200);
    const status = JSON.parse((await request('/api/eos/tls')).body);
    const options = { method: 'POST', headers: { origin: 'https://nexowatt', 'content-type': 'application/json', 'x-nw-csrf': status.csrfToken }, body: JSON.stringify({ names }) };
    assert.equal((await request('/api/eos/tls/request', { ...options, headers: { ...options.headers, 'x-nw-csrf': '' } })).status, 403);
    assert.equal((await request('/api/eos/tls/request', { ...options, headers: { ...options.headers, origin: 'https://evil.invalid' } })).status, 403);
    role = 'installer'; assert.equal((await request('/api/eos/tls/request', options)).status, 403);
    role = 'admin'; authenticated = false; assert.equal((await request('/api/eos/tls/request', options)).status, 401);
    authenticated = true; assert.equal((await request('/api/eos/tls/request', options)).status, 200);
    const csr = await request('/api/eos/tls/request.pem'); assert.equal(csr.status, 200); assert.match(csr.body, /CERTIFICATE REQUEST/); assert.doesNotMatch(csr.body, /PRIVATE KEY/);
    assert.equal((await request('/api/eos/tls/root.cer')).status, 404);
    const signed = await f.signed();
    const imported = await request('/api/eos/tls/certificate', { ...options, body: JSON.stringify(signed) });
    assert.equal(imported.status, 200);
    assert.equal(JSON.parse(imported.body).restartRequired, true);
    const publicRoot = await request('/api/eos/tls/root.cer');
    assert.equal(publicRoot.status, 200); assert.match(publicRoot.headers['content-type'], /application\/pkix-cert/);
    assert.equal((await request('/security/tls/../../package.json')).status, 404);
    assert.equal((await request('/api/eos/tls/request', { ...options, body: '{' })).status, 400);
    assert.equal((await request('/api/eos/tls/request', { ...options, body: JSON.stringify({ names, pad: 'x'.repeat(140000) }) })).status, 413);
});
