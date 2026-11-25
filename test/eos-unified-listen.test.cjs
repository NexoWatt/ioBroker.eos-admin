'use strict';
// Execute the production Web startup helpers, using real HTTP/TLS sockets.
// Controller bootstrap/database calls are fixtures. Deep hosted-startup cases
// explicitly retain an in-process factory seam; a separate TLS case below uses
// the real UI/EMS child and only public HTTP/status observations.
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
const processOwners = new WeakSet();
vm.runInNewContext(compiled, {
    exports: exportsValue, module: { exports: exportsValue }, __dirname: path.dirname(webFile), __filename: webFile,
    Buffer, URL, Error, console, process, setTimeout, clearTimeout,
    require: name => {
        if (name === '@iobroker/adapter-core') return {
            EXIT_CODES: { ADAPTER_REQUESTED_TERMINATION: 11 }, I18n: {},
            controllerDir: path.resolve(__dirname, '..', 'node_modules', 'iobroker.js-controller'),
            getAbsoluteInstanceDataDir: () => path.join(require('node:os').tmpdir(), 'eos-listen-module-fixture'),
        };
        if (name === './eosUiProcess') return {
            createEosUiProcess(owner, bridge, options) {
                if (processOwners.has(owner)) return require('../build/lib/eosUiProcess').createEosUiProcess(owner, bridge, options);
                // Test-only preservation of the existing deep startup/failure assertions.
                // The dynamically cached module is the fixture's original hosted runtime.
                return webRequire(path.resolve(__dirname, '../ui/main.js')).createHostedRuntime(owner, bridge);
            },
        };
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
    { type: 2, value: 'nexowatt' }, { type: 2, value: 'nexowatt.local' },
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
    await Promise.all([web.failStartup(new Error('EOS_TEST_STARTUP_FAILURE')),
        web.failStartup(new Error('duplicate failure'))]);
    assert.equal(terminated, 1); assert.equal(server.listening, false);
    assert.match(errors.join('\n'), /EOS_TEST_STARTUP_FAILURE/);
});

test('startup failure closes admission immediately and awaits migration recovery before terminating once', async t => {
    const server = http.createServer(); t.after(() => close(server));
    await listenEosServer(server, { port: await freePort(), bind: '127.0.0.1' });
    const recovery = deferred(); const events = [];
    const web = Object.assign(Object.create(Web.prototype), {
        startupFailed: false, server: { server }, adapter: {
            log: quiet,
            eosMigration: {
                failStartup(code) { events.push(code); return recovery.promise.then(() => events.push('recovery-confirmed')); },
                block() { assert.fail('confirmed recovery must not become blocked'); },
            },
            terminate(code) { events.push(`terminate:${code}`); },
            setForeignObjectAsync() { assert.fail('Web must delegate recovery, not directly revive old owners'); },
        },
    });
    let settled = false;
    const first = web.failStartup(new Error('fixture bind failed')).then(() => { settled = true; });
    await web.failStartup(new Error('simultaneous failure'));
    assert.equal(web.startupFailed, true); assert.equal(server.listening, false);
    assert.equal(settled, false);
    assert.deepEqual(events, ['EOS_MIGRATION_WEB_START_FAILED']);
    recovery.resolve(); await first;
    await web.failStartup(new Error('late duplicate failure'));
    assert.deepEqual(events, ['EOS_MIGRATION_WEB_START_FAILED', 'recovery-confirmed', 'terminate:11']);
});

test('startup recovery rejection fences migration before termination and does not leak its promise', async () => {
    const events = []; const errors = [];
    const web = Object.assign(Object.create(Web.prototype), {
        startupFailed: false, server: {}, adapter: {
            log: { ...quiet, error(value) { errors.push(String(value)); } },
            eosMigration: {
                async failStartup(code) { events.push(code); throw new Error('fixture database unavailable'); },
                block(code) { events.push(code); },
            },
            terminate(code) { events.push(`terminate:${code}`); },
        },
    });
    await assert.doesNotReject(web.failStartup(new Error('fixture TLS failure')));
    await web.failStartup(new Error('duplicate failure'));
    assert.deepEqual(events, ['EOS_MIGRATION_WEB_START_FAILED', 'EOS_MIGRATION_RECOVERY_REQUIRED', 'terminate:11']);
    assert.match(errors.join('\n'), /Startup recovery remains unconfirmed/);
    assert.doesNotMatch(errors.join('\n'), /fixture database unavailable/);
});

test('already closed Web cannot initiate another migration recovery or terminate again', async () => {
    const web = Object.assign(Object.create(Web.prototype), {
        closed: true, startupFailed: false, server: {}, adapter: {
            log: quiet,
            eosMigration: { failStartup() { assert.fail('closed Web cannot request recovery'); } },
            terminate() { assert.fail('closed Web cannot terminate again'); },
        },
    });
    await web.failStartup(new Error('late shutdown error'));
    assert.equal(web.startupFailed, false);
});

// Real HTTPS and Web mount/router. Legacy cases inject the original in-process
// hosted factory to observe/mutate startup dependencies; realProcess opts into
// the actual process supervisor and exposes no mutable runtime instance.
async function hostedTlsFixture(t, migrate, options = {}) {
    const Module = require('node:module');
    const { createHarness } = require('../ui/test/unified/http-harness.cjs');
    const harness = await createHarness();
    await harness.close();
    const owner = harness.owner;
    if (options.realProcess) processOwners.add(owner);
    owner.config.secure = true;
    if (options.migration) owner.eosMigration = { status: () => ({ phase: 'TEST_BLOCKED' }), ...options.migration };
    const logs = [];
    owner.log = Object.fromEntries(Object.keys(quiet).map(level => [level, value => logs.push(String(value))]));
    let licensed = true; let writable = options.writable !== false; let runtimeObject; let migrationCalls = 0;
    const validLicense = harness.bridge.getLicense();
    owner.eosLicenseService = { statusView: () => licensed ? validLicense : { valid: false, coreEnabled: false } };
    owner.eosOwnership = { canWrite: () => writable, status: () => ({ state: writable ? 'owned' : 'blocked' }) };
    const foreignWriteCalls = [];
    owner.setForeignStateAsync = async (...args) => { foreignWriteCalls.push(args); };
    const filename = path.resolve(__dirname, '../ui/main.js');
    const isolated = new Module(filename, module);
    isolated.filename = filename; isolated.paths = Module._nodeModulePaths(path.dirname(filename));
    isolated._compile(fs.readFileSync(filename, 'utf8') + '\nmodule.exports.TestRuntime = NexoWattVis;\n', filename);
    const Runtime = isolated.exports.TestRuntime;
    const startServer = Runtime.prototype.startServer;
    Runtime.prototype.startServer = async function () { runtimeObject = this; return startServer.call(this); };
    Runtime.prototype.migrateNativeConfig = async function () { migrationCalls++; return migrate.call(this); };
    const app = express();
    const systemRequests = new WeakSet();
    app.use((req, _res, next) => { if (req.path.startsWith('/system/')) systemRequests.add(req); next(); });
    const boundary = new UnifiedSessions(owner, { secure: true, externalOrigin: '' });
    let sessionActive = true; let sessionRole = 'admin';
    const status = async req => sessionActive && req.headers.cookie === 'fixture=admin' ? {
        authenticated: true, authed: true, user: 'system.user.admin', role: sessionRole, groups: ['system.group.administrator'],
        capabilities: ['*'], csrfToken: 'c'.repeat(32), credentialKey: 'credential-fixture', mustChangePassword: false,
        activationRequired: false,
    } : { authenticated: false, authed: false, role: 'none', mustChangePassword: false, activationRequired: false };
    const web = Object.assign(Object.create(Web.prototype), {
        baseDir: path.resolve(__dirname, '..'), server: { app }, adapter: owner, settings: { secure: true }, systemRequests,
        unified: { status, requestAllowed: req => boundary.requestAllowed(req), machineRequestAllowed: req => boundary.machineRequestAllowed(req) },
        isUnifiedRequest: req => !req.path.startsWith('/system/'),
    });
    const oldCached = require.cache[filename];
    require.cache[filename] = isolated;
    let mountTimer;
    try {
        await Promise.race([web.mountUnifiedRuntime(), new Promise((_, reject) => {
            mountTimer = setTimeout(() => reject(new Error('licensed runtime held HTTPS mount hostage')), 1500);
        })]);
    } finally {
        clearTimeout(mountTimer);
        if (oldCached) require.cache[filename] = oldCached; else delete require.cache[filename];
    }
    app.get('/system/recovery', (_req, res) => res.json({ ok: true }));
    app.use((_req, res) => res.status(404).end());
    const cert = certificate();
    owner.getCertificatesAsync = async () => [cert];
    owner.config.leCollection = false;
    const server = await createEosServer(app, owner, { secure: true, acmeChallenge: false });
    web.server.server = server;
    await listenEosServer(server, { port: await freePort(), bind: '127.0.0.1' });
    const runtime = owner.eosHostedRuntime;
    t.after(async () => { try { await runtime?.stop(); } finally { await close(server); } });
    const host = `127.0.0.1:${server.address().port}`;
    const request = (url, { method = 'GET', auth = true, csrf = true, origin = `https://${host}` } = {}) =>
        tlsRequest(server, cert.cert, { host, origin, ...(auth ? { cookie: 'fixture=admin' } : {}),
            ...(csrf ? { 'x-nw-csrf': 'c'.repeat(32) } : {}), 'content-type': 'application/json' }, method, url,
        method === 'POST' ? { id: 'device.0.control', value: true } : undefined);
    return { runtime, request, logs, server, owner, cert: cert.cert, instance: () => runtimeObject,
        migrationCalls: () => migrationCalls, foreignWrites: () => foreignWriteCalls.length, foreignWriteCalls: () => foreignWriteCalls,
        setSessionActive(value) { sessionActive = value; }, setSessionRole(value) { sessionRole = value; },
        setLicensed(value) { licensed = value; }, setWritable(value) { writable = value; } };
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

test('real UI child preserves HTTPS session/origin checks and leaves recovery outside its process', { timeout: 15000 }, async t => {
    const h = await hostedTlsFixture(t, async () => {}, { realProcess: true });
    assert.equal(h.runtime.status().process.mode, 'process');
    assert.notEqual(h.runtime.status().process.pid, process.pid);
    assert.equal(h.instance(), undefined, 'child runtime internals are not exposed to the parent fixture');
    assert.equal(await h.request('/login.html', { auth: false }), 200);
    assert.equal(await h.request('/api/state'), 200);
    assert.equal(await h.request('/api/state', { auth: false }), 401);
    assert.equal(await h.request('/api/state', { origin: 'https://foreign.invalid' }), 403);
    assert.equal(await h.request('/api/smarthome/toggle', { method: 'POST', csrf: false }), 403);
    h.setSessionActive(false);
    assert.equal(await h.request('/api/state'), 401);
    h.setSessionActive(true);
    await h.runtime.stop();
    assert.equal(h.runtime.status().process.pid, null);
    assert.equal(await h.request('/system/recovery'), 200);
    assert.equal(h.server.listening, true);
});

test('migration startup fence keeps login and authenticated recovery reachable without operational startup', async t => {
    const h = await hostedTlsFixture(t, async () => assert.fail('blocked migration must not initialize devices'), {
        migration: { allowsStartup: () => false, allowsWrites: () => false }, writable: false,
    });
    assert.equal(h.runtime.status().state, 'blocked');
    assert.equal(h.runtime.status().emsReady, false);
    assert.equal(h.owner.eosModuleHost.running, false);
    assert.equal(h.migrationCalls(), 0); assert.equal(h.foreignWrites(), 0, JSON.stringify(h.foreignWriteCalls()));
    assert.equal(await h.request('/login.html', { auth: false }), 200);
    assert.equal(await h.request('/system/recovery'), 200);
    assert.equal(await h.request('/system/recovery', { auth: false }), 302);
    assert.notEqual(await h.request('/api/smarthome/toggle', { method: 'POST' }), 200);
    // Even a late explicit attempt cannot override the coordinator's revoked ownership.
    await h.runtime.startOperational();
    assert.equal(h.runtime.status().state, 'blocked');
    assert.equal(h.migrationCalls(), 0); assert.equal(h.foreignWrites(), 0, JSON.stringify(h.foreignWriteCalls()));
    assert.equal(h.owner.eosModuleHost.running, false);
});


test('verified nexowatt TLS authority opens login for anonymous/expired sessions and dashboard for an active session', async t => {
    const h = await hostedTlsFixture(t, async () => {});
    const named = (url, cookie) => tlsRequest(h.server, h.cert, { host: 'nexowatt',
        ...(cookie ? { cookie } : {}) }, 'GET', url, undefined, 'nexowatt');
    assert.equal(await named('/', undefined), 303);
    assert.equal(await named('/login.html', undefined), 200);
    assert.equal(await named('/', 'fixture=admin'), 200);
    assert.equal(await named('/api/eos/modules/devices', 'fixture=admin'), 200);
    h.setSessionRole('installer');
    assert.equal(await named('/api/eos/modules/devices', 'fixture=admin'), 403);
    h.setSessionActive(false);
    assert.equal(await named('/', 'fixture=admin'), 303);
    assert.equal(await named('/api/eos/modules/devices', 'fixture=admin'), 401);
    assert.equal(await named('/', 'fixture=expired-invalid'), 303);
});

test('module host crosses the actual private hosted UI bridge and returns implementation feedback', async t => {
    const h = await hostedTlsFixture(t, async () => {});
    const host = h.owner.eosModuleHost;
    const feedback = []; let facade;
    const moduleFactory = { validateConfig: value => ({ ...value, enabled: value.enabled === true }),
        createHostedModule(options) { facade = options.adapter; return {
            start: async () => {}, stop: async () => {}, getStatus: () => ({}),
            onMessage: message => feedback.push(message),
        }; } };
    host.options.factories = { devices: moduleFactory, eebus: moduleFactory };
    h.owner.decrypt = value => JSON.parse(value).content;
    h.owner.config.eosModules = { eebus: { v: 1, encrypted: JSON.stringify({ content: '{"enabled":true}' }) } };
    h.owner.eosLicenseService.allowsEmbeddedModule = () => h.owner.eosLicenseService.statusView().valid;
    h.owner.unsubscribeForeignStatesAsync = async () => {};
    await host.start(); t.after(() => host.stop());
    // Hardware/EMS readiness is a fixture. Host routing, runtime entry method,
    // capability proof, API validation and reverse feedback are production code.
    const instance = h.instance(); instance._hostedOperational = true; instance._nwLicenseOk = true;
    instance.config.installerConfig = { para14a: true }; instance.config.countryProfile = { country: 'DE' };
    instance.emsEngine = { mm: {}, stop() {} }; instance._nwLicenseAllowsAppId = () => true;
    instance._nwRequestImmediateEmsTick = () => true;
    const api = instance._para14aEebusApi; await api.init();
    const source = 'eos-admin.0.eebus';
    const send = (command, message) => new Promise(resolve => facade.sendTo('eos-admin.0', command, message, resolve));
    const hello = await send('nexowatt.para14a.hello.v1', { apiVersion: 1, sourceInstance: source, bridgeHeartbeatSec: 30 });
    assert.equal(hello.accepted, true);
    const accepted = await send('nexowatt.para14a.command.v1', {
        schema: 'nexowatt.para14a.command.v1', apiVersion: 1, sourceInstance: source, commandId: 'full-host-contract',
        operation: 'limitConsumption', active: true, limitW: 4200, receivedAtMs: Date.now(),
        validUntilMs: Date.now() + 60000, heartbeatAtMs: Date.now(), heartbeatTimeoutMs: 60000,
    });
    assert.equal(accepted.accepted, true); assert.equal(api.ingress.limitW, 4200);
    assert.equal(api._sendImplementationFeedback(source, { status: 'applied' }), true);
    assert.equal(feedback.length, 1); assert.equal(feedback[0].command, 'nexowatt.para14a.implementation.v1');
    h.setLicensed(false);
    assert.equal((await send('nexowatt.para14a.hello.v1', { apiVersion: 1, sourceInstance: source })).accepted, false);
    assert.equal(api._sendImplementationFeedback(source, { status: 'applied' }), false);
    assert.equal(feedback.length, 1);
});

test('valid license and stalled operational startup cannot hold the HTTPS login or recovery console hostage', async t => {
    const pending = deferred();
    const h = await hostedTlsFixture(t, function () { return pending.promise; });
    assert.equal(h.runtime.status().state, 'idle');
    assert.equal(h.migrationCalls(), 0, 'shell construction must not initialize devices');
    assert.equal(await h.request('/login.html', { auth: false }), 200);
    assert.equal(await h.request('/api/auth/status'), 200);
    assert.equal(h.migrationCalls(), 0, 'a request before the owner readiness signal must not arm operational startup');
    const starting = h.runtime.startOperational();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.migrationCalls(), 1);
    assert.equal(h.runtime.status().state, 'starting');
    h.instance().emsEngine = { stop() {} }; // mere allocation is deliberately not readiness
    assert.equal(h.runtime.status().emsReady, false);
    assert.equal(await h.request('/login.html', { auth: false }), 200);
    assert.equal(await h.request('/system/recovery'), 200);
    assert.equal(await h.request('/system/recovery', { auth: false }), 302);
    assert.equal(await h.request('/api/smarthome/toggle', { method: 'POST' }), 503);
    assert.equal(await h.request('/api/smarthome/toggle', { method: 'POST', csrf: false }), 403);
    assert.equal(await h.request('/api/smarthome/toggle', { method: 'POST', auth: false }), 401);
    assert.equal(h.foreignWrites(), 0, JSON.stringify(h.foreignWriteCalls()));
    // Stop fences immediately and may confirm only after the startup dependency settles.
    // Its late answer must not resume the next setup operation or report EMS-ready.
    let laterSteps = 0;
    h.instance().ensureInfoConnectionState = async () => { laterSteps++; };
    let stopSettled = false;
    const stopping = h.runtime.stop().then(() => { stopSettled = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(stopSettled, false);
    assert.equal(h.runtime.status().state, 'stopping');
    assert.equal(h.runtime.status().canWrite, false);
    pending.resolve(); await Promise.all([starting, stopping]);
    assert.equal(laterSteps, 0);
    assert.equal(h.runtime.status().state, 'stopped');
    assert.equal(h.runtime.status().emsReady, false);
    await h.runtime.startOperational();
    await assert.rejects(h.runtime.start(), /EOS_UI_STOPPING/);
    assert.equal(h.migrationCalls(), 1);
});

test('operational initialization failure leaves HTTPS recovery up and refuses real UI commands', async t => {
    const h = await hostedTlsFixture(t, async function () { throw new Error('fixture configuration read failed'); });
    await h.runtime.startOperational();
    h.instance().emsEngine = { stop() {} };
    assert.equal(h.runtime.status().state, 'degraded');
    assert.equal(h.runtime.status().emsReady, false);
    assert.equal(await h.request('/login.html', { auth: false }), 200);
    assert.equal(await h.request('/system/recovery'), 200);
    assert.equal(await h.request('/api/smarthome/toggle', { method: 'POST' }), 503);
    // Local status now uses the same namespace-qualified write guard as actuator writes.
    // Permit only the exact pre-abort connection report; no physical/control target escaped.
    assert.deepEqual(h.foreignWriteCalls(), [['eos-admin.0.info.connection', { val: true, ack: true }]]);
    await h.runtime.startOperational();
    assert.equal(h.migrationCalls(), 1, 'failed partial startup must not duplicate configuration/timers on requests');
    assert.equal(h.server.listening, true);
});

test('hosted EMS readiness rejects retained failed, fenced or unscheduled engine references', async t => {
    const h = await hostedTlsFixture(t, async () => {});
    const instance = h.instance();
    instance._hostedStartup = { state: 'ready', error: '' };
    instance.emsEngine = { _timer: {}, _reconfiguring: false, stop() {} };
    instance._nwEmsInitError = '';
    assert.equal(h.runtime.status().emsReady, true);
    instance._nwEmsInitError = 'TEST_PARTIAL_INIT_FAILURE';
    assert.equal(h.runtime.status().emsReady, false);
    instance._nwEmsInitError = '';
    instance.emsEngine._reconfiguring = true;
    assert.equal(h.runtime.status().emsReady, false);
    instance.emsEngine._reconfiguring = false;
    instance.emsEngine._timer = null;
    assert.equal(h.runtime.status().emsReady, false);
});

for (const lost of ['license', 'ownership']) {
    test(`late startup completion after ${lost} loss cannot revive control`, async t => {
        const pending = deferred();
        const h = await hostedTlsFixture(t, function () { return pending.promise; });
        const starting = h.runtime.startOperational();
        await new Promise(resolve => setImmediate(resolve));
        let laterSteps = 0;
        h.instance().ensureInfoConnectionState = async () => { laterSteps++; };
        if (lost === 'license') h.setLicensed(false); else h.setWritable(false);
        pending.resolve(); await starting;
        assert.equal(laterSteps, 0);
        assert.equal(h.runtime.status().state, 'degraded');
        assert.equal(h.runtime.status().emsReady, false);
        assert.equal(await h.request('/login.html', { auth: false }), 200);
        assert.equal(await h.request('/system/recovery'), 200);
        assert.equal(await h.request('/api/smarthome/toggle', { method: 'POST' }), 503);
        assert.equal(h.foreignWrites(), 0, JSON.stringify(h.foreignWriteCalls()));
        h.setLicensed(true); h.setWritable(true);
        await assert.rejects(h.instance().setForeignStateAsync('device.0.control', true), /EOS_UI_OWNERSHIP_LOST/);
        assert.equal(h.foreignWrites(), 0, JSON.stringify(h.foreignWriteCalls()));
        await h.runtime.startOperational();
        assert.equal(h.migrationCalls(), 1, 'lost admission requires operator restart, not an automatic partial retry');
    });
}

test('an unexpected operational promise rejection is contained without closing HTTPS', async t => {
    const h = await hostedTlsFixture(t, async function () {});
    h.instance().onReady = async () => { throw new Error('fixture unexpected operational rejection'); };
    await assert.rejects(h.runtime.startOperational(), /fixture unexpected operational rejection/);
    assert.equal(h.runtime.status().state, 'degraded');
    assert.equal(h.runtime.status().emsReady, false);
    assert.equal(await h.request('/login.html', { auth: false }), 200);
    assert.equal(await h.request('/system/recovery'), 200);
    assert.equal(await h.request('/api/smarthome/toggle', { method: 'POST' }), 503);
    assert.equal(h.server.listening, true);
    assert.ok(h.logs.some(value => value.startsWith('EOS_UI_STARTUP_FAILED:')));
});


for (const [lost, rejectedOperation] of [['license', false], ['ownership', false], ['ownership', true]]) {
    test(`optional startup catch cannot erase observed ${lost} loss after authority returns${rejectedOperation ? ' (rejected operation)' : ''}`, async t => {
        const h = await hostedTlsFixture(t, async function () {});
        const instance = h.instance();
        for (const method of ['ensureInfoConnectionState', 'ensureLicenseStates', '_nwInitLicense', 'ensureInstallerStates']) {
            instance[method] = async () => {};
        }
        let optionalEntered = false; let deniedReads = 0; let laterSteps = 0;
        const grant = h.owner.eosLicenseService.statusView();
        instance.delObjectAsync = async () => {
            optionalEntered = true;
            if (rejectedOperation) {
                deniedReads++;
                h.setWritable(false);
                try { await instance.setForeignStateAsync('device.0.control', true); }
                finally { h.setWritable(true); }
                return;
            }
            // The post-await authority check observes one denial. Every subsequent
            // read succeeds, modelling restoration before the next startup step.
            if (lost === 'license') {
                h.owner.eosLicenseService.statusView = () => ++deniedReads === 1
                    ? { valid: false, coreEnabled: false } : grant;
            } else {
                h.owner.eosOwnership.canWrite = () => ++deniedReads !== 1;
            }
        };
        instance.ensureSettingsStates = async () => {
            laterSteps++;
            throw new Error('fixture: revoked startup reached a later non-optional operation');
        };
        const Module = require('node:module');
        const originalLoad = Module._load;
        Module._load = function (name, ...args) {
            if (name === '@iobroker/adapter-core') return { getAbsoluteInstanceDataDir: () => '/tmp/nexowatt-startup-admission-test' };
            return originalLoad.call(this, name, ...args);
        };
        try { await h.runtime.startOperational(); }
        finally { Module._load = originalLoad; }
        assert.equal(optionalEntered, true, 'fault must occur inside the genuinely caught optional cleanup step');
        assert.ok(deniedReads >= 1);
        assert.equal(laterSteps, 0, 'an optional catch may not grant a new admission to the same startup');
        assert.equal(h.runtime.status().state, 'degraded');
        assert.equal(h.runtime.status().error, lost === 'license' ? 'EOS_UI_LICENSE_LOST' : 'EOS_UI_OWNERSHIP_LOST');
        assert.equal(h.runtime.status().emsReady, false);
        assert.equal(instance._nwShuttingDown, true, 'runtime resources must be cleaned after the latched abort');
        assert.equal(await h.request('/login.html', { auth: false }), 200);
        assert.equal(await h.request('/system/recovery'), 200);
        await assert.rejects(instance.setForeignStateAsync('device.0.control', true), /EOS_UI_OWNERSHIP_LOST/);
        // Initial shell/start heartbeat reports are local, acknowledged telemetry.
        // Compare all dispatched writes exactly so control targets or ack:false cannot hide.
        assert.deepEqual(h.foreignWriteCalls(), [
            ['eos-admin.0.info.connection', { val: true, ack: true }],
            ['eos-admin.0.info.connection', { val: true, ack: true }],
        ]);
    });
}

test('the explicit HTTPS-ready diagnostic requires a live listener and is suppressed after close', async t => {
    const logs = [];
    const server = https.createServer(certificate(), (_req, res) => res.end());
    t.after(() => close(server));
    const web = Object.assign(Object.create(Web.prototype), {
        settings: { secure: true }, server: { server }, adapter: { log: { info: value => logs.push(value) } },
    });
    const address = { host: '127.0.0.1', port: await freePort() };
    assert.equal(web.logListenerReady(address), false);
    assert.equal(logs.length, 0);
    await listenEosServer(server, { bind: address.host, port: address.port });
    assert.equal(web.logListenerReady(address), true);
    assert.deepEqual(logs, [`EOS_HTTPS_READY: https server listening on 127.0.0.1:${address.port}; login and system console available`]);
    web.closed = true;
    assert.equal(web.logListenerReady(address), false);
    assert.equal(logs.length, 1);
});
