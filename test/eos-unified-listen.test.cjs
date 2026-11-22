'use strict';
// Execute the production Web startup helpers, using real HTTP/TLS sockets.
// Only controller bootstrap/database calls are fixtures. No adapter objects are mutated.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { once } = require('node:events');
const express = require('express');
const { UnifiedSessions } = require('../src/lib/eosUnifiedBoundary');
const { registerLicenseRoutes } = require('../src/lib/eosLicenseHttp');

const emitted = process.env.EOS_TEST_RUNTIME === 'build';
const webFile = path.resolve(__dirname, emitted ? '../build/lib/web.js' : '../src/lib/web.ts');
const webRequire = createRequire(webFile);
const source = fs.readFileSync(webFile, 'utf8');
const compiled = emitted ? source : require('typescript').transpileModule(source, {
    compilerOptions: { target: 9, module: 1, esModuleInterop: true },
}).outputText;
const exportsValue = {};
vm.runInNewContext(compiled, {
    exports: exportsValue, module: { exports: exportsValue }, __dirname: path.dirname(webFile), __filename: webFile,
    Buffer, URL, Error, console, process, setTimeout, clearTimeout,
    require: name => {
        if (name === '@iobroker/adapter-core') return { EXIT_CODES: { ADAPTER_REQUESTED_TERMINATION: 11 }, I18n: {} };
        if (!emitted && name.startsWith('.') && fs.existsSync(path.resolve(path.dirname(webFile), `${name}.ts`))) {
            return require('tsx/cjs/api').require(path.resolve(path.dirname(webFile), `${name}.ts`), webFile);
        }
        return webRequire(name);
    },
}, { filename: webFile, timeout: 5000 });
const { default: Web, eosListenAddress, listenEosServer, createEosServer } = exportsValue;
const quiet = { debug() {}, info() {}, warn() {}, error() {}, silly() {} };

async function freePort() {
    const server = http.createServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    return port;
}
async function close(server) {
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(() => resolve()));
}
function certificate(altNames = [
    { type: 7, ip: '127.0.0.1' }, { type: 7, ip: '192.168.10.192' },
    { type: 2, value: 'localhost' }, { type: 2, value: 'nexowatteos' },
], issuer = null, isCa = true, commonName = 'localhost') {
    const controllerRequire = createRequire(require.resolve('@iobroker/js-controller-common-db'));
    const forge = controllerRequire('node-forge');
    const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const key = pair.privateKey.export({ format: 'pem', type: 'pkcs1' });
    const cert = forge.pki.createCertificate();
    cert.publicKey = forge.pki.publicKeyFromPem(pair.publicKey.export({ format: 'pem', type: 'spki' }));
    cert.serialNumber = `01${crypto.randomBytes(15).toString('hex')}`;
    cert.validity.notBefore = new Date(Date.now() - 60000);
    cert.validity.notAfter = new Date(Date.now() + 3600000);
    const subject = [{ name: 'commonName', value: commonName }];
    cert.setSubject(subject);
    cert.setIssuer(issuer ? forge.pki.certificateFromPem(issuer.cert).subject.attributes : subject);
    cert.setExtensions([{ name: 'basicConstraints', cA: isCa }, { name: 'subjectAltName', altNames },
        { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, keyCertSign: isCa }]);
    cert.sign(forge.pki.privateKeyFromPem(issuer?.key || key), forge.md.sha256.create());
    return { key, cert: forge.pki.certificateToPem(cert) };
}
function collectionAdapter(defaultCertificate, collectionCertificate, config = {}) {
    const calls = []; const logs = []; const listeners = new Map();
    const collections = { configured: { ...collectionCertificate, domains: ['nexowatteos'] } };
    const adapter = {
        config: { leCollection: true, ...config },
        log: Object.fromEntries(Object.keys(quiet).map(level => [level, value => logs.push(String(value))])),
        getCertificatesAsync: async (...args) => { calls.push(args); return defaultCertificate ? [defaultCertificate, false] : null; },
        getForeignObjectAsync: async id => id === 'system.certificates' ? { native: { collections } } : null,
        subscribeForeignObjects() {}, on(event, listener) { listeners.set(event, listener); },
        setForeignObjectAsync() { assert.fail('TLS startup must never replace global certificates'); },
        extendForeignObjectAsync() { assert.fail('TLS startup must never replace global certificates'); },
    };
    return { adapter, calls, logs, collections, update() { listeners.get('objectChange')?.('system.certificates', { native: { collections } }); } };
}
function tlsRequest(server, cert, headers, method = 'GET', requestPath = '/', body, servername) {
    return new Promise((resolve, reject) => {
        const req = https.request({ host: '127.0.0.1', port: server.address().port, ca: cert,
            rejectUnauthorized: true, method, path: requestPath, headers, servername, agent: false, timeout: 3000 }, res => {
            res.resume(); res.on('end', () => resolve(res.statusCode));
        });
        req.on('timeout', () => req.destroy(new Error('test request timeout')));
        req.on('error', reject); req.end(body === undefined ? undefined : JSON.stringify(body));
    });
}

test('only a complete configured port is accepted, without a fallback or ephemeral port', () => {
    for (const port of [undefined, null, '', 0, -1, 65536, 8188.5, '8188oops', '0', ' 8188']) {
        assert.throws(() => eosListenAddress({ port, bind: '127.0.0.1' }), /EOS_LISTEN_PORT_INVALID/);
    }
    assert.equal(eosListenAddress({ port: '8188', bind: '127.0.0.1' }).port, 8188);
});

test('configured port is used exactly once and readiness follows successful bind', async t => {
    const server = http.createServer((_req, res) => res.end('EOS'));
    t.after(() => close(server));
    const port = await freePort();
    let calls = 0;
    const listen = server.listen.bind(server);
    server.listen = (...args) => { calls++; return listen(...args); };
    await listenEosServer(server, { port, bind: '127.0.0.1' });
    assert.equal(calls, 1); assert.equal(server.address().port, port);
    assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), 'EOS');
});

test('occupied port fails once with EADDRINUSE and leaves the existing service intact', async t => {
    const existing = http.createServer((_req, res) => res.end('existing admin'));
    existing.listen(0, '127.0.0.1'); await once(existing, 'listening');
    t.after(() => close(existing));
    const port = existing.address().port;
    const candidate = http.createServer(); t.after(() => close(candidate));
    let calls = 0; const listen = candidate.listen.bind(candidate);
    candidate.listen = (...args) => { calls++; return listen(...args); };
    await assert.rejects(listenEosServer(candidate, { port, bind: '127.0.0.1' }), error =>
        error.code === 'EADDRINUSE' && error.message.includes(`127.0.0.1:${port}`));
    assert.equal(calls, 1); assert.equal(candidate.listening, false);
    assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), 'existing admin');
});

test('unavailable local interface fails once with EADDRNOTAVAIL instead of searching ports', async t => {
    const server = http.createServer(); t.after(() => close(server));
    let calls = 0; const listen = server.listen.bind(server);
    server.listen = (...args) => { calls++; return listen(...args); };
    await assert.rejects(listenEosServer(server, { port: await freePort(), bind: '192.0.2.254' }), error =>
        error.code === 'EADDRNOTAVAIL' && error.message.includes('192.0.2.254'));
    assert.equal(calls, 1); assert.equal(server.listening, false);
});

test('TLS configuration cannot silently become a cleartext listener when certificates are absent', async () => {
    const adapter = { config: { leCollection: false }, log: quiet, getCertificatesAsync: async () => null };
    await assert.rejects(createEosServer((_req, res) => res.end(), adapter, { secure: true, acmeChallenge: false }),
        /EOS_TLS_CERTIFICATE_REQUIRED/);
});

test('controller certificate read failures remain diagnosed TLS startup failures', async () => {
    const adapter = { config: { leCollection: false }, log: quiet,
        getCertificatesAsync: async () => { throw new Error('fixture certificate read unavailable'); } };
    await assert.rejects(createEosServer((_req, res) => res.end(), adapter, { secure: true, acmeChallenge: false }),
        /EOS_TLS_INITIALIZATION_FAILED/);
});

test('collection TLS uses configured default for IP without SNI and retains a distinct hostname collection', async t => {
    const fallback = certificate([{ type: 7, ip: '127.0.0.1' }], null, true, 'EOS IP default');
    const named = certificate([{ type: 2, value: 'nexowatteos' }], null, true, 'EOS named collection');
    const fixture = collectionAdapter(fallback, named, { certPublic: 'sitePublic', certPrivate: 'sitePrivate', certChained: '' });
    const server = await createEosServer((_req, res) => res.end('EOS TLS'), fixture.adapter, { secure: true, acmeChallenge: false });
    t.after(() => close(server));
    assert.deepEqual(fixture.calls, [['sitePublic', 'sitePrivate', '']], 'one controller read, exact configured selectors');
    const names = []; server.on('secureConnection', socket => names.push(socket.servername || ''));
    await listenEosServer(server, { port: await freePort(), bind: '127.0.0.1' });
    assert.equal(await tlsRequest(server, fallback.cert, { host: '127.0.0.1' }, 'GET', '/', undefined, ''), 200);
    assert.equal(await tlsRequest(server, named.cert, { host: 'nexowatteos' }, 'GET', '/', undefined, 'nexowatteos'), 200);
    assert.deepEqual(names, ['', 'nexowatteos']);
    await assert.rejects(tlsRequest(server, named.cert, { host: '127.0.0.1' }, 'GET', '/', undefined, ''));
    await assert.rejects(tlsRequest(server, fallback.cert, { host: 'nexowatteos' }, 'GET', '/', undefined, 'nexowatteos'));
    fixture.update();
    assert.equal(await tlsRequest(server, named.cert, { host: 'nexowatteos' }, 'GET', '/', undefined, 'nexowatteos'), 200);
    const logText = fixture.logs.join('\n');
    assert.doesNotMatch(logText, /-----BEGIN (?:RSA |EC )?(?:PRIVATE KEY|CERTIFICATE)-----/);
    assert.ok(!logText.includes(fallback.key.split('\n')[1]));
    assert.ok(!logText.includes(named.key.split('\n')[1]));
    assert.match(logText, /Certificate collections updated: 1/);
});

test('collection IP context sends the configured intermediate chain and accepts only the explicit root CA', async t => {
    const root = certificate([], null, true, 'EOS test root');
    const intermediate = certificate([], root, true, 'EOS test intermediate');
    const leaf = certificate([{ type: 7, ip: '127.0.0.1' }], intermediate, false, 'EOS IP leaf');
    const named = certificate([{ type: 2, value: 'nexowatteos' }], null, true, 'EOS separate SNI');
    const fixture = collectionAdapter({ ...leaf, ca: intermediate.cert }, named, { leCollection: 'configured', certChained: 'siteChain' });
    const server = await createEosServer((_req, res) => res.end('EOS TLS'), fixture.adapter, { secure: true, acmeChallenge: false });
    t.after(() => close(server));
    assert.deepEqual(fixture.calls, [['defaultPublic', 'defaultPrivate', 'siteChain']]);
    await listenEosServer(server, { port: await freePort(), bind: '127.0.0.1' });
    assert.equal(await tlsRequest(server, root.cert, { host: '127.0.0.1' }, 'GET', '/', undefined, ''), 200);
    await assert.rejects(tlsRequest(server, named.cert, { host: '127.0.0.1' }, 'GET', '/', undefined, ''));
});

test('a valid named collection cannot hide the absence of a default certificate for IP access', async () => {
    const named = certificate([{ type: 2, value: 'nexowatteos' }]);
    const fixture = collectionAdapter(null, named);
    await assert.rejects(createEosServer((_req, res) => res.end(), fixture.adapter, { secure: true, acmeChallenge: false }),
        /EOS_TLS_DEFAULT_CERTIFICATE_REQUIRED/);
});

test('native TLS without a fixed origin serves IP/8188 and HTTPS/443 alias Host contracts', async t => {
    const cert = certificate();
    const adapter = { config: { leCollection: false }, log: quiet, getCertificatesAsync: async () => [cert] };
    const authority = new UnifiedSessions(adapter, { secure: true, externalOrigin: '' });
    const server = await createEosServer((req, res) => {
        res.statusCode = authority.requestAllowed(req) ? 200 : 403; res.end();
    }, adapter, { secure: true, acmeChallenge: false });
    assert.ok(server instanceof https.Server);
    t.after(() => close(server));
    await listenEosServer(server, { port: await freePort(), bind: '127.0.0.1' });
    // No SNI is sent to the IP fixture. TLS verification stays enabled with its explicit test CA.
    // Public Host values model the direct address and preserved Host on a verified TLS proxy hop.
    for (const host of ['192.168.10.192:8188', '192.168.10.192', '192.168.10.192:443', 'nexowatteos', 'nexowatteos:443']) {
        assert.equal(await tlsRequest(server, cert.cert, { host }), 200, host);
        assert.equal(await tlsRequest(server, cert.cert, { host, origin: new URL(`https://${host}`).origin, 'sec-fetch-site': 'same-origin' }, 'POST'), 200, host);
        assert.equal(await tlsRequest(server, cert.cert, { host, origin: 'https://foreign.invalid' }, 'POST'), 403, host);
    }
    assert.equal(await tlsRequest(server, cert.cert, { host: 'nexowatteos' }, 'POST'), 403);
    const legacyAdminLink = { host: 'nexowatteos', 'sec-fetch-site': 'cross-site',
        'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document', referer: 'http://192.168.10.192:8081/' };
    assert.equal(await tlsRequest(server, cert.cert, legacyAdminLink), 200);
    assert.equal(await tlsRequest(server, cert.cert, legacyAdminLink, 'GET', '/system/'), 200);
    assert.equal(await tlsRequest(server, cert.cert, legacyAdminLink, 'GET', '/api/auth/status'), 403);
    assert.equal(await tlsRequest(server, cert.cert, legacyAdminLink, 'POST'), 403);
});

test('invalid external origin is caught by Web startup and terminates once without controller mutations', async () => {
    const errors = []; let terminated = 0; let ready = false;
    let finish; const done = new Promise(resolve => { finish = resolve; });
    const adapter = { config: {}, log: { ...quiet, error(value) { errors.push(value); } },
        terminate() { terminated++; finish(); },
        setForeignObjectAsync() { assert.fail('startup must not change legacy adapter objects'); },
    };
    assert.doesNotThrow(() => new Web({ secure: true, eosExternalOrigin: 'https://device.invalid/path', port: 8188 },
        adapter, () => { ready = true; }, { systemLanguage: 'en' }));
    await done;
    assert.equal(terminated, 1); assert.equal(ready, false);
    assert.match(errors.join('\n'), /EOS_PUBLIC_ORIGIN_INVALID/);
});

test('password/setup write guard uses canonical browser Origin and preserves explicit bearer compatibility', () => {
    const web = Object.assign(Object.create(Web.prototype), { settings: { secure: true },
        unified: new UnifiedSessions({}, { secure: true, externalOrigin: '' }) });
    const request = { method: 'POST', headers: { host: 'NexoWattEOS:443', origin: 'https://nexowatteos',
        'sec-fetch-site': 'same-origin' }, socket: { remoteAddress: '192.168.10.20' } };
    assert.equal(web.isEosSameOriginWrite(request), true);
    request.headers.origin = 'https://foreign.invalid'; assert.equal(web.isEosSameOriginWrite(request), false);
    delete request.headers.origin; assert.equal(web.isEosSameOriginWrite(request), false);
    request.headers.authorization = 'Bearer explicit-client-credential'; assert.equal(web.isEosSameOriginWrite(request), true);
    request.headers.cookie = 'access_token=ambient-cookie'; assert.equal(web.isEosSameOriginWrite(request), false);
});

test('actual TLS activation accepts Host443 normalization and rejects malformed Host before its service', async t => {
    const cert = certificate(); const app = express(); let activations = 0;
    registerLicenseRoutes(app, { secure: true, publicOrigin: '',
        authorize: async req => req.headers.cookie === 'fixture_session=admin',
        jsonParser: express.json({ limit: '20kb' }),
        service: { activate: async () => { activations++; return { valid: true }; } },
        pagePath: '/unused', scriptPath: '/unused',
    });
    const adapter = { config: { leCollection: false }, log: quiet, getCertificatesAsync: async () => [cert] };
    const server = await createEosServer(app, adapter, { secure: true, acmeChallenge: false });
    t.after(() => close(server));
    await listenEosServer(server, { port: await freePort(), bind: '127.0.0.1' });
    const headers = { host: 'NexoWattEOS:443', origin: 'https://nexowatteos',
        cookie: 'fixture_session=admin', 'content-type': 'application/json', 'x-eos-license': '1' };
    const activate = overrides => tlsRequest(server, cert.cert, { ...headers, ...overrides }, 'POST',
        '/nexowatt/license/activate', { token: 'NWL3.test.signature' }, 'localhost');
    assert.equal(await activate({}), 200); assert.equal(activations, 1);
    for (const host of ['user@nexowatteos', 'nexowatteos/path', 'nexowatteos,foreign.invalid', 'nexowatteos:65536']) {
        assert.equal(await activate({ host }), 403, host);
    }
    assert.equal(await activate({ origin: 'https://foreign.invalid' }), 403);
    assert.equal(await activate({ cookie: 'fixture_session=customer' }), 403);
    assert.equal(activations, 1);
});

test('startup abort closes a bound listener and never mutates another adapter', async t => {
    const server = http.createServer(); t.after(() => close(server));
    await listenEosServer(server, { port: await freePort(), bind: '127.0.0.1' });
    let terminated = 0; const errors = [];
    const web = Object.assign(Object.create(Web.prototype), {
        startupFailed: false, server: { server }, adapter: {
            log: { ...quiet, error(value) { errors.push(value); } }, terminate() { terminated++; },
            setForeignObjectAsync() { assert.fail('startup abort must not change legacy adapter objects'); },
        },
    });
    web.failStartup(new Error('EOS_TEST_STARTUP_FAILURE'));
    web.failStartup(new Error('duplicate failure'));
    assert.equal(terminated, 1); assert.equal(server.listening, false);
    assert.match(errors.join('\n'), /EOS_TEST_STARTUP_FAILURE/);
});
