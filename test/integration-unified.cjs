'use strict';
/* global before, after, it */
// Real controller DBs, installed tarball, adapter process and verified TLS endpoints.
// admin.0 is an enabled DB recovery fixture only: no legacy Admin server is started.
// Host/:443 cases exercise authority handling on the real 8188 TLS listener, not a 443 proxy.
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const https = require('node:https');
const assert = require('node:assert/strict');
const { stripVTControlCharacters } = require('node:util');
const { execFileSync, spawn } = require('node:child_process');
const { randomBytes, X509Certificate, createPrivateKey, generateKeyPairSync } = require('node:crypto');
const { MANUFACTURER_KEYS, MANUFACTURER_FINGERPRINTS } = require('../src/lib/eosLicenseTrust');
const { tests } = require('@iobroker/testing');
const { password } = require(
    path.join(path.dirname(require.resolve('@iobroker/js-controller-common-db')), 'lib/common/password.js'),
);
const port = 8188;
const base = `https://127.0.0.1:${port}`;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/** A small fetch-like client with explicit test CA trust and normal hostname verification. */
function requestTls(certificate, requestPath, options = {}) {
    return new Promise((resolve, reject) => {
        let complete = false;
        let deadline;
        const done = (error, result) => {
            if (complete) {
                return;
            }
            complete = true;
            clearTimeout(deadline);
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        };
        const headers = { host: `127.0.0.1:${port}`, ...options.headers };
        if (options.body !== undefined) {
            headers['content-length'] = Buffer.byteLength(options.body);
        }
        const request = https.request(
            {
                hostname: '127.0.0.1',
                port,
                path: requestPath,
                method: options.method || 'GET',
                headers,
                agent: false,
                // Empty SNI for IP access; named requests must verify that exact DNS SAN.
                servername: options.servername || '',
                ...(certificate ? { ca: certificate } : {}),
            },
            response => {
                if (response.socket.authorized !== true) {
                    request.destroy(new Error('TLS peer was not authenticated'));
                    return;
                }
                const parts = [];
                let bytes = 0;
                response.on('data', chunk => {
                    bytes += chunk.length;
                    if (bytes > 4 * 1024 * 1024) {
                        request.destroy(new Error('TLS test response too large'));
                    } else {
                        parts.push(chunk);
                    }
                });
                response.on('error', error => done(error));
                response.on('end', () => {
                    const body = Buffer.concat(parts).toString('utf8');
                    done(null, {
                        status: response.statusCode,
                        headers: {
                            get(name) {
                                const value = response.headers[name.toLowerCase()];
                                return Array.isArray(value) ? value.join(', ') : value || null;
                            },
                            getSetCookie() {
                                return response.headers['set-cookie'] || [];
                            },
                        },
                        async text() {
                            return body;
                        },
                        async json() {
                            return JSON.parse(body);
                        },
                    });
                });
            },
        );
        request.on('error', error => done(error));
        deadline = setTimeout(
            () => request.destroy(new Error('TLS test request deadline exceeded')),
            options.timeoutMs || 5000,
        );
        if (options.body !== undefined) {
            request.write(options.body);
        }
        request.end();
    });
}

function accessSettings(object) {
    return {
        enabled: object?.common?.enabled,
        port: object?.native?.port,
        bind: object?.native?.bind,
        auth: object?.native?.auth,
        secure: object?.native?.secure,
        certPublic: object?.native?.certPublic,
        certPrivate: object?.native?.certPrivate,
    };
}

async function responseErrorCode(response) {
    try {
        const body = await response.json();
        const code = typeof body?.error === 'string' ? body.error : body?.code;
        // Never include response messages, tokens, cookies, passwords or an arbitrary response body.
        return typeof code === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(code) ? code : 'NO_SAFE_ERROR_CODE';
    } catch {
        return 'NON_JSON_RESPONSE';
    }
}

tests.integration(path.resolve(__dirname, '..'), {
    controllerVersion: '7.2.5',
    loglevel: 'info',
    defineAdditionalTests({ suite }) {
        suite('Unified real HTTPS onboarding and existing Admin preservation', getHarness => {
            let harness;
            let certificate;
            let certificateDirectory;
            let expectedAdminSettings;
            const runtimeRoot = path.join(os.tmpdir(), 'test-iobroker.eos-admin');
            const licenseDirectory = path.join(runtimeRoot, 'iobroker-data', 'eos-admin.0', 'licensing');
            let originalRuntimeMode;
            let importedManufacturerKeys;
            let missingOsRootOwnership = [];
            let firstProcessConfirmedStopped = false;
            let restartedChild;
            let restartClosed;
            let restartExit;
            let restartSpawnError;
            let restartLogTail = '';
            const restartLogPending = { stdout: '', stderr: '' };
            const secret = randomBytes(24).toString('base64url');
            let cookie = '';
            const request = (requestPath, options) => requestTls(certificate, requestPath, options);
            const assertAdminPreserved = async () => {
                const current = await harness.objects.getObjectAsync('system.adapter.admin.0');
                assert.deepEqual(
                    accessSettings(current),
                    expectedAdminSettings,
                    'EOS must preserve the existing Admin recovery endpoint',
                );
            };
            const captureRestartOutput = (chunk, stream) => {
                // Keep bounded standard adapter log lines only; never print credentials or PEM data.
                const lines = (restartLogPending[stream] + chunk.toString('utf8')).split(/\r?\n/);
                restartLogPending[stream] = lines.pop().slice(-2048);
                for (const rawLine of lines) {
                    const line = stripVTControlCharacters(rawLine);
                    if (
                        /\b(?:info|warn|error): eos-admin\.0\b/.test(line) &&
                        !/password|token|cookie|authorization|secret|private|certificate|-----/.test(
                            line.toLowerCase(),
                        ) &&
                        !line.includes(secret)
                    ) {
                        restartLogTail = `${restartLogTail}${line.slice(0, 2048)}\n`.slice(-8192);
                    }
                }
            };
            const waitForRestartClose = milliseconds =>
                new Promise(resolve => {
                    const timer = setTimeout(() => resolve(false), milliseconds);
                    void restartClosed.then(() => {
                        clearTimeout(timer);
                        resolve(true);
                    });
                });
            const stopRestartedChild = async () => {
                const child = restartedChild;
                if (!child) {
                    return;
                }
                if (!restartExit) {
                    child.kill('SIGTERM');
                    if (!(await waitForRestartClose(5000))) {
                        // This handle is exclusively the process spawned by this test, never a PID lookup.
                        child.kill('SIGKILL');
                        assert.ok(
                            await waitForRestartClose(5000),
                            'The owned restart process must close after SIGKILL',
                        );
                    }
                }
                restartedChild = undefined;
            };
            before(async function () {
                this.timeout(90000);
                harness = getHarness();
                // Some managed containers remap / or /etc to an unprivileged
                // UID. This cannot model the production root-owned trust path.
                // Detect only that exact limitation; every other import failure
                // still fails the test and the production check is unchanged.
                missingOsRootOwnership =
                    process.platform === 'win32'
                        ? []
                        : ['/', '/etc'].filter(directory => {
                              const stat = fs.lstatSync(directory);
                              return stat.isDirectory() && !stat.isSymbolicLink() && stat.uid !== 0;
                          });
                // The real installer grants the runtime's service group write access.
                // This is the harness-owned runtime only; no OS trust policy is changed.
                const runtimeStat = fs.lstatSync(runtimeRoot);
                assert.ok(runtimeStat.isDirectory() && !runtimeStat.isSymbolicLink());
                assert.equal(runtimeStat.uid, process.getuid());
                originalRuntimeMode = runtimeStat.mode & 0o7777;
                fs.chmodSync(runtimeRoot, 0o2775);
                certificateDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-unified-tls-'));
                fs.chmodSync(certificateDirectory, 0o700);
                const keyPath = path.join(certificateDirectory, 'ephemeral-key.pem');
                const certPath = path.join(certificateDirectory, 'ephemeral-cert.pem');
                execFileSync(
                    'openssl',
                    [
                        'req',
                        '-x509',
                        '-newkey',
                        'rsa:2048',
                        '-sha256',
                        '-nodes',
                        '-keyout',
                        keyPath,
                        '-out',
                        certPath,
                        '-days',
                        '1',
                        '-subj',
                        '/CN=nexowatteos',
                        '-addext',
                        'subjectAltName=IP:127.0.0.1,DNS:localhost,DNS:nexowatteos,DNS:nexowatt,DNS:nexowatt.local',
                    ],
                    { stdio: 'pipe', timeout: 15000 },
                );
                fs.chmodSync(keyPath, 0o600);
                certificate = fs.readFileSync(certPath, 'utf8');
                const certificates = await harness.objects.getObjectAsync('system.certificates');
                const defaults = certificates?.native?.certificates;
                assert.ok(
                    typeof defaults?.defaultPublic === 'string' && defaults.defaultPublic.trim(),
                    'Fresh controller setup must provide its default public certificate',
                );
                assert.ok(
                    typeof defaults?.defaultPrivate === 'string' && defaults.defaultPrivate.trim(),
                    'Fresh controller setup must provide its default private key',
                );
                assert.ok(
                    new X509Certificate(defaults.defaultPublic).checkPrivateKey(
                        createPrivateKey(defaults.defaultPrivate),
                    ),
                    'The controller default certificate and private key must match',
                );
                certificates.native.certificates = {
                    ...certificates.native.certificates,
                    defaultPublic: certificate,
                    defaultPrivate: fs.readFileSync(keyPath, 'utf8'),
                };
                await harness.objects.setObjectAsync(certificates._id, certificates);

                const hash = await new Promise((resolve, reject) =>
                    password(secret).hash(null, null, (error, value) => (error ? reject(error) : resolve(value))),
                );
                await harness.objects.setObjectAsync('system.user.eosintegration', {
                    _id: 'system.user.eosintegration',
                    type: 'user',
                    common: { name: 'EOS integration', enabled: true, password: hash },
                    native: { nexowattEosAccount: { passwordInitialized: true, passwordSetupVersion: 1 } },
                });
                const group = await harness.objects.getObjectAsync('system.group.administrator');
                group.common.members = [...new Set([...(group.common.members || []), 'system.user.eosintegration'])];
                await harness.objects.setObjectAsync(group._id, group);

                const legacyAdmin = (await harness.objects.getObjectAsync('system.adapter.admin.0')) || {
                    _id: 'system.adapter.admin.0',
                    type: 'instance',
                    common: { name: 'admin', host: 'testing' },
                    native: {},
                };
                legacyAdmin.common.enabled = true;
                legacyAdmin.native = { ...legacyAdmin.native, port: 8081, bind: '0.0.0.0', auth: true, secure: false };
                expectedAdminSettings = accessSettings(legacyAdmin);
                await harness.objects.setObjectAsync(legacyAdmin._id, legacyAdmin);
                // This suite models fresh, manual setup before activation, not a
                // licensed cutover. Prove that no legacy instance could be bypassed.
                for (const name of ['nexowatt-ui', 'nexowatt-devices', 'eebus', 'nexowatt-backup']) {
                    const inventory = await harness.objects.getObjectViewAsync('system', 'instance', {
                        startkey: `system.adapter.${name}.`, endkey: `system.adapter.${name}.\u9999`,
                    });
                    assert.ok(Array.isArray(inventory?.rows), 'Legacy inventory must be available');
                    assert.equal(inventory.rows.length, 0, `Fresh setup unexpectedly contains ${name}`);
                }
                await harness.changeAdapterConfig('eos-admin', {
                    native: {
                        port,
                        bind: '0.0.0.0',
                        secure: true,
                        auth: true,
                        certPublic: 'defaultPublic',
                        certPrivate: 'defaultPrivate',
                        certChained: '',
                        eosExternalOrigin: '',
                        eosMdnsEnabled: false,
                        // Explicit manual setup; the production default and license
                        // prerequisite for automatic migration remain unchanged.
                        eosAutoMigrate: false,
                        eosLockLegacyAdmin: true,
                        eosLegacyAdminLockPort: 18081,
                        eosLegacyAdminLockBind: '127.0.0.1',
                    },
                });
                await harness.startAdapterAndWait();
                const readinessDeadline = Date.now() + 45000;
                while (Date.now() < readinessDeadline) {
                    try {
                        if ((await request('/api/auth/status')).status === 200) {
                            await assertAdminPreserved();
                            return;
                        }
                    } catch {
                        /* bounded readiness poll; TLS verification is never disabled */
                    }
                    await wait(100);
                }
                throw new Error('Unified verified HTTPS did not become ready on port 8188');
            });
            after(async function () {
                this.timeout(12000);
                try {
                    await stopRestartedChild();
                } finally {
                    if (originalRuntimeMode !== undefined) fs.chmodSync(runtimeRoot, originalRuntimeMode);
                    if (certificateDirectory) {
                        fs.rmSync(certificateDirectory, { recursive: true, force: true });
                    }
                }
            });
            it('survives a real state burst before any socket client connects and recovers its threshold', async function () {
                this.timeout(90000);
                // This synthetic heartbeat belongs to no configured host or adapter. It is
                // already covered by the ownership monitor's real DB subscription, yet a
                // true heartbeat does not grant ownership or alter a physical device.
                const trafficId = 'system.host.eos-socket-integration.alive';
                const processAtStart = harness.adapterProcess;
                const logStart = harness.getLogs().length;
                const logSinceStart = pattern => harness.getLogs().slice(logStart).some(log => pattern.test(log.message));
                const assertSameProcess = () => {
                    assert.equal(harness.didAdapterStop(), false, 'The state burst must not terminate the adapter');
                    assert.equal(harness.adapterProcess, processAtStart, 'No replacement process may hide a crash');
                    assert.equal(processAtStart.exitCode, null, 'The original EOS process must still be alive');
                };
                assert.ok(processAtStart?.pid, 'The test must own a running EOS adapter process');
                assert.equal(await harness.objects.getObjectAsync(trafficId), null);
                assert.equal(await harness.states.getStateAsync(trafficId), null);
                await harness.objects.setObjectAsync(trafficId, {
                    _id: trafficId,
                    type: 'state',
                    common: { name: 'Isolated EOS socket burst fixture', type: 'boolean', role: 'indicator', read: true, write: false },
                    native: {},
                });
                try {
                    // 50 writes every 100 ms for up to 12 seconds. The actual production
                    // 200-event/second, three-consecutive-second threshold is unchanged.
                    // No socket client has connected, so no client state subscription exists.
                    const burstDeadline = Date.now() + 12000;
                    let writes = 0;
                    while (Date.now() < burstDeadline && !logSinceStart(/Unsubscribe from all states, except system's/)) {
                        assertSameProcess();
                        await Promise.all(Array.from({ length: 50 }, () => harness.states.setStateAsync(trafficId, {
                            val: true,
                            ack: true,
                            ts: Date.now(),
                            c: `EOS isolated burst ${writes++}`,
                        })));
                        await wait(100);
                    }
                    assert.ok(logSinceStart(/Unsubscribe from all states, except system's/), 'The real threshold must activate');
                    // The old fault occurs after the activation log, in its asynchronous
                    // callback. Give that callback time to complete before checking TLS.
                    await wait(300);
                    assert.equal(
                        logSinceStart(/Cannot convert undefined or null to object|unhandled promise rejection/i),
                        false,
                        'Threshold activation must not trigger the reported unhandled rejection',
                    );
                    assertSameProcess();
                    assert.equal((await request('/api/auth/status')).status, 200);
                    await assertAdminPreserved();

                    // Exercise the unmodified automatic recovery deadline, without using
                    // a private API, modifying production clocks or adding a test hook.
                    const recoveryDeadline = Date.now() + 65000;
                    while (Date.now() < recoveryDeadline && !logSinceStart(/Subscribe to all states again/)) {
                        assertSameProcess();
                        await wait(250);
                    }
                    assert.ok(logSinceStart(/Subscribe to all states again/), 'The real threshold must recover automatically');
                    await wait(150); // recovery performs its own asynchronous subscription work
                    assertSameProcess();
                    assert.equal((await request('/api/auth/status')).status, 200);
                    assert.equal(logSinceStart(/Cannot convert undefined or null to object|unhandled promise rejection/i), false);
                    await assertAdminPreserved();
                } finally {
                    await harness.states.delState(trafficId);
                    await harness.objects.delObjectAsync(trafficId);
                }
            });
            it('requires a trusted certificate and verifies the requested hostname', async () => {
                await assert.rejects(requestTls(null, '/login.html'), error =>
                    /SELF_SIGNED|UNABLE_TO_VERIFY|CERT_UNTRUSTED/.test(error.code || ''),
                );
                await assert.rejects(
                    request('/login.html', { servername: 'not-covered.invalid' }),
                    error => error.code === 'ERR_TLS_CERT_ALTNAME_INVALID',
                );
            });
            it('serves the single login and its actual script over verified TLS without an Origin header', async () => {
                const response = await request('/login.html');
                assert.equal(response.status, 200);
                assert.match(await response.text(), /NexoWatt/);
                const script = await request('/static/login.js');
                assert.equal(script.status, 200);
                assert.match(script.headers.get('content-type'), /javascript/);
            });
            it('accepts SAN-covered IP and hostname authorities including normalized HTTPS default ports', async function () {
                this.timeout(10000);
                for (const entry of [
                    { host: '127.0.0.1:8188', servername: '' },
                    { host: 'localhost:8188', servername: 'localhost' },
                    { host: 'NexoWattEOS:8188', servername: 'nexowatteos' },
                    { host: 'NexoWattEOS:443', servername: 'nexowatteos' },
                    { host: 'nexowatteos', servername: 'nexowatteos' },
                    { host: 'nexowatt', servername: 'nexowatt' },
                    { host: 'nexowatt.local:443', servername: 'nexowatt.local' },
                    { host: '127.0.0.1:443', servername: '' },
                ]) {
                    const response = await request('/login.html', {
                        headers: { host: entry.host },
                        servername: entry.servername,
                    });
                    assert.equal(response.status, 200, `Login authority rejected: ${entry.host}`);
                }
                // Exact-Origin writes must normalize Host :443 to the browser's canonical origin.
                for (const entry of [
                    { host: 'NexoWattEOS:443', origin: 'https://nexowatteos', servername: 'nexowatteos' },
                    { host: '127.0.0.1:443', origin: 'https://127.0.0.1', servername: '' },
                ]) {
                    const response = await request('/api/auth/login', {
                        method: 'POST',
                        servername: entry.servername,
                        headers: { 'content-type': 'application/json', host: entry.host, origin: entry.origin },
                        body: JSON.stringify({ user: 'eosintegration', password: secret }),
                    });
                    assert.equal(
                        response.status,
                        200,
                        `Normalized Origin rejected: ${entry.host}; error=${await responseErrorCode(response)}`,
                    );
                    assert.ok(response.headers.getSetCookie().some(value => /;\s*Secure(?:;|$)/i.test(value)));
                }
            });
            it('permits only top-level entry navigation from an HTTP Admin while rejecting cross-site APIs', async () => {
                const navigation = {
                    referer: 'http://127.0.0.1:8081/',
                    'sec-fetch-site': 'cross-site',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-dest': 'document',
                };
                assert.equal((await request('/login.html', { headers: navigation })).status, 200);
                assert.equal((await request('/login.html', { method: 'HEAD', headers: navigation })).status, 200);
                assert.equal((await request('/api/auth/status', { headers: navigation })).status, 403);
                assert.equal(
                    (await request('/login.html', { headers: { ...navigation, origin: 'http://127.0.0.1:8081' } }))
                        .status,
                    403,
                );
                assert.equal(
                    (
                        await request('/api/auth/login', {
                            method: 'POST',
                            headers: { ...navigation, 'content-type': 'application/json' },
                            body: JSON.stringify({ user: 'eosintegration', password: secret }),
                        })
                    ).status,
                    403,
                );
            });
            it('preserves enabled Admin port 8081 and all-interface bind across startup and repeated object events', async function () {
                this.timeout(10000);
                await assertAdminPreserved();
                for (let index = 0; index < 3; index++) {
                    const legacyAdmin = await harness.objects.getObjectAsync('system.adapter.admin.0');
                    legacyAdmin.common.desc = `EOS integration recovery event ${index}`;
                    await harness.objects.setObjectAsync(legacyAdmin._id, legacyAdmin);
                    await wait(1100); // actual 750 ms security debounce, not a mocked callback
                    await assertAdminPreserved();
                }
                const config = await harness.getAdapterConfig('eos-admin');
                assert.equal(
                    config.native.eosLockLegacyAdmin,
                    true,
                    'the stale stored flag must be harmless without silently rewriting it',
                );
                assert.equal(config.native.port, 8188);
                assert.equal(config.native.bind, '0.0.0.0');
                assert.equal(config.native.secure, true);
            });
            it('denies anonymous APIs and rejects cross-origin authentication', async () => {
                assert.equal((await request('/api/state')).status, 401);
                const response = await request('/api/auth/login', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', origin: 'https://untrusted.invalid' },
                    body: JSON.stringify({ user: 'eosintegration', password: secret }),
                });
                assert.equal(response.status, 403);
            });
            it('authenticates once using a Secure HttpOnly cookie and directs the administrator to central activation', async () => {
                const response = await request('/api/auth/login', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', origin: base },
                    body: JSON.stringify({ user: 'eosintegration', password: secret }),
                });
                const body = await response.json();
                assert.equal(response.status, 200, `Login failed; error=${await responseErrorCode(response)}`);
                assert.ok(!body.access_token && !body.refresh_token, 'no bearer tokens in JSON');
                const cookieHeaders = response.headers.getSetCookie();
                const accessCookie = cookieHeaders.find(value => value.startsWith('nexowatt_eos_admin_0_access_token='));
                assert.ok(accessCookie, 'login must issue an access cookie');
                assert.ok(!cookieHeaders.some(value => /^(access_token|refresh_token|connect\.sid)=/.test(value)),
                    'EOS must not overwrite standard Admin cookies on another port');
                assert.match(accessCookie, /;\s*Secure(?:;|$)/i);
                assert.match(accessCookie, /;\s*HttpOnly(?:;|$)/i);
                cookie = cookieHeaders.map(value => value.split(';')[0]).join('; ');
                const status = await (await request('/api/auth/status', { headers: { cookie } })).json();
                assert.equal(status.authenticated, true);
                assert.equal(status.role, 'admin');
                assert.equal(status.activationRequired, true);
                assert.equal(status.nextUrl, '/nexowatt/license');
                assert.equal((await request('/nexowatt/license', { headers: { cookie } })).status, 200);
                assert.equal((await request('/system/', { headers: { cookie } })).status, 200);
                await assertAdminPreserved();
            });
            it('serves integrated module editors and protects their APIs before activation', async () => {
                for (const id of ['devices', 'eebus', 'backup']) {
                    assert.equal((await request(`/api/eos/modules/${id}`)).status, 401);
                    assert.equal((await request(`/modules/${id}/`)).status, 302);
                    const page = await request(`/modules/${id}/`, { headers: { cookie } });
                    assert.equal(page.status, 200);
                    assert.match(await page.text(), /NexoWatt EOS/);
                    const view = await request(`/api/eos/modules/${id}`, { headers: { cookie } });
                    assert.equal(view.status, 200);
                    const body = await view.json();
                    assert.equal(body.config.enabled, false);
                    assert.ok(typeof body.csrfToken === 'string' && body.csrfToken.length >= 16);
                    const write = await request(`/api/eos/modules/${id}`, { method: 'PUT',
                        headers: { cookie, origin: base, 'content-type': 'application/json' },
                        body: JSON.stringify({ config: { enabled: true } }) });
                    assert.equal(write.status, 403, 'Module configuration requires the session CSRF token');
                }
                assert.equal((await request('/modules/devices/vendor/jquery.js', { headers: { cookie } })).status, 200);
                assert.equal((await request('/modules/eebus/index.js', { headers: { cookie } })).status, 200);
                await assertAdminPreserved();
            });
            it('persists device settings without restarting EOS or invalidating the active login', async function () {
                this.timeout(10000);
                const before = await harness.objects.getObjectAsync('system.adapter.eos-admin.0');
                assert.equal(before.native.eosAutoMigrate, false, 'Only explicit fresh manual setup permits this draft');
                const migrationResponse = await request('/api/eos/migration', { headers: { cookie } });
                assert.equal(migrationResponse.status, 200);
                const migration = await migrationResponse.json();
                assert.equal(migration.phase, 'DISABLED');
                assert.deepEqual(migration.sources, []);
                const licenseResponse = await request('/api/license/info', { headers: { cookie } });
                assert.equal(licenseResponse.status, 200);
                const license = await licenseResponse.json();
                assert.equal(license.valid, false, 'Manual configuration must not grant a license');
                assert.equal(license.coreEnabled, false, 'The unlicensed runtime must remain fenced');
                const view = await (await request('/api/eos/modules/devices', { headers: { cookie } })).json();
                assert.equal(view.status.active, false, 'The device runtime must remain nonoperational');
                const configuration = { ...view.config, enabled: false, devices: [] };
                const saved = await request('/api/eos/modules/devices', {
                    method: 'PUT',
                    headers: { cookie, origin: base, 'content-type': 'application/json', 'x-nw-csrf': view.csrfToken },
                    body: JSON.stringify({ config: configuration }),
                });
                assert.equal(saved.status, 200, `Configuration save failed; error=${await responseErrorCode(saved)}`);
                // Controller7.2.5 schedules an instance restart after2500ms on instance-object changes.
                // Checking beyond that boundary catches the original customer regression.
                await wait(3500);
                const status = await (await request('/api/auth/status', { headers: { cookie } })).json();
                assert.equal(status.authenticated, true, 'ordinary device saves must preserve the existing session');
                const after = await harness.objects.getObjectAsync('system.adapter.eos-admin.0');
                assert.deepEqual(after.native, before.native, 'module settings must not trigger instance object changes');
                const persisted = await (await request('/api/eos/modules/devices', { headers: { cookie } })).json();
                assert.equal(persisted.config.enabled, false);
                assert.deepEqual(persisted.config.devices, []);
                assert.equal(persisted.status.active, false, 'Saving a disabled draft must not arm device operation');
                assert.equal(status.activationRequired, true, 'Saving a draft must not bypass central activation');
                await assertAdminPreserved();
            });
            it('protects the installed migration and certificate pages and creates a private device CSR', async () => {
                for (const endpoint of ['/api/eos/migration', '/api/eos/tls']) {
                    assert.equal((await request(endpoint)).status, 401);
                    assert.equal((await request(endpoint, { headers: { cookie } })).status, 200);
                }
                for (const endpoint of ['/migration/', '/security/tls/', '/modules/shared/eos-module.css']) {
                    assert.equal((await request(endpoint, { headers: { cookie } })).status, 200);
                }
                const before = await (await request('/api/eos/tls', { headers: { cookie } })).json();
                assert.equal(before.mode, 'existing-iobroker-certificate');
                const denied = await request('/api/eos/tls/request', {
                    method: 'POST', headers: { cookie, origin: base, 'content-type': 'application/json' },
                    body: JSON.stringify({ names: ['nexowatt', 'nexowatt.local', '127.0.0.1'] }),
                });
                assert.equal(denied.status, 403);
                const created = await request('/api/eos/tls/request', {
                    method: 'POST',
                    headers: { cookie, origin: base, 'content-type': 'application/json', 'x-nw-csrf': before.csrfToken },
                    body: JSON.stringify({ names: ['nexowatt', 'nexowatt.local', '127.0.0.1'] }),
                });
                assert.equal(created.status, 200, `CSR creation failed; error=${await responseErrorCode(created)}`);
                const status = await created.json();
                assert.ok(status.pending.requestId);
                assert.equal(status.restartRequired, false, 'a CSR alone must not change the active TLS identity');
                assert.doesNotMatch(JSON.stringify(status), /PRIVATE KEY|"key"\s*:/);
                const publicRequest = await request('/api/eos/tls/request.pem', { headers: { cookie } });
                assert.equal(publicRequest.status, 200);
                assert.match(await publicRequest.text(), /BEGIN CERTIFICATE REQUEST/);
                assert.equal((await request('/api/eos/tls/root.cer', { headers: { cookie } })).status, 404);
                await assertAdminPreserved();
            });
            it('imports the release-pinned manufacturer public key through the real authenticated HTTPS route', async function () {
                const before = await request('/nexowatt/license/trust/status', { headers: { cookie } });
                assert.equal(before.status, 200);
                const trustBefore = await before.json();
                if (missingOsRootOwnership.length) {
                    assert.equal(trustBefore.ready, false);
                    assert.equal(trustBefore.canImport, false);
                    assert.equal(trustBefore.code, 'TRUST_PERMISSIONS');
                    assert.deepEqual(trustBefore.keys, []);
                    this.test.title += ` [environment skip: ${missingOsRootOwnership.join(', ')} lack POSIX root ownership; TRUST_PERMISSIONS verified]`;
                    this.skip();
                }
                assert.equal(trustBefore.canImport, true);
                for (const [kid, fingerprint] of Object.entries(MANUFACTURER_FINGERPRINTS)) {
                    assert.ok(trustBefore.allowedKeys.some(key => key.kid === kid && key.fingerprint === fingerprint));
                }
                const response = await request('/nexowatt/license/trust/import', {
                    method: 'POST',
                    headers: { cookie, origin: base, 'x-eos-license': '1', 'content-type': 'application/json' },
                    body: JSON.stringify({ keys: MANUFACTURER_KEYS }),
                });
                assert.equal(
                    response.status,
                    200,
                    `Public trust import failed; error=${await responseErrorCode(response)}`,
                );
                const imported = await response.json();
                assert.equal(imported.ready, true);
                assert.equal(imported.licenseStatus.valid, false, 'A public key is not a license');
                assert.equal(imported.licenseStatus.coreEnabled, false);
                importedManufacturerKeys = imported.keys;
                for (const [kid, fingerprint] of Object.entries(MANUFACTURER_FINGERPRINTS)) {
                    assert.ok(imported.keys.some(key => key.kid === kid && key.fingerprint === fingerprint));
                }
                const exported = await request('/nexowatt/license/trust/export', { headers: { cookie } });
                assert.equal(exported.status, 200);
                const exportedKeys = await exported.json();
                for (const [kid, pem] of Object.entries(MANUFACTURER_KEYS)) assert.equal(exportedKeys[kid], pem);
                assert.equal(fs.statSync(runtimeRoot).mode & 0o7777, 0o2775);
                assert.equal(fs.statSync(licenseDirectory).mode & 0o777, 0o700);
                assert.equal(fs.statSync(path.join(licenseDirectory, 'imported-public-keys.json')).mode & 0o777, 0o600);
                await assertAdminPreserved();
            });
            it('rejects an unapproved public key and preserves the previously imported manufacturer authority', async function () {
                if (missingOsRootOwnership.length) {
                    this.test.title += ` [environment skip: ${missingOsRootOwnership.join(', ')} lack POSIX root ownership; no manufacturer import possible]`;
                    this.skip();
                }
                const filename = path.join(licenseDirectory, 'imported-public-keys.json');
                const before = fs.readFileSync(filename);
                const unapproved = generateKeyPairSync('ed25519')
                    .publicKey.export({ type: 'spki', format: 'pem' })
                    .toString();
                const response = await request('/nexowatt/license/trust/import', {
                    method: 'POST',
                    headers: { cookie, origin: base, 'x-eos-license': '1', 'content-type': 'application/json' },
                    body: JSON.stringify({ keys: { 'unapproved-controller-fixture': unapproved } }),
                });
                assert.equal(response.status, 400);
                assert.equal(await responseErrorCode(response), 'TRUST_IMPORT_UNKNOWN_KEY');
                assert.deepEqual(fs.readFileSync(filename), before);
                const status = await (await request('/nexowatt/license/trust/status', { headers: { cookie } })).json();
                assert.equal(status.ready, true);
                assert.deepEqual(status.keys, importedManufacturerKeys);
            });
            it('requires CSRF for logout and revokes the authenticated session', async () => {
                const headers = { cookie, origin: base };
                assert.equal((await request('/api/auth/logout', { method: 'POST', headers })).status, 403);
                const status = await (await request('/api/auth/status', { headers: { cookie } })).json();
                const response = await request('/api/auth/logout', {
                    method: 'POST',
                    headers: { ...headers, 'x-nw-csrf': status.csrfToken },
                });
                assert.equal(response.status, 200);
                const after = await (await request('/api/auth/status', { headers: { cookie } })).json();
                assert.equal(after.authenticated, false);
            });
            it('leaves the existing Admin recovery endpoint unchanged when EOS is stopped', async function () {
                this.timeout(10000);
                const originalProcess = harness.adapterProcess;
                assert.ok(originalProcess?.pid, 'The harness must own the original EOS child process');
                await harness.stopAdapter();
                assert.ok(
                    originalProcess.exitCode !== null || originalProcess.signalCode !== null,
                    'The exact original EOS child process must have exited',
                );
                await assertAdminPreserved();
                await assert.rejects(
                    request('/api/auth/status'),
                    error => error.code === 'ECONNREFUSED',
                    'The stopped adapter must release its HTTPS endpoint',
                );
                firstProcessConfirmedStopped = true;
            });
            it('restarts the installed package against the same database and preserves HTTPS login and Admin access', async function () {
                this.timeout(65000);
                assert.equal(harness.isAdapterRunning(), false, 'The first EOS process must already be stopped');
                assert.equal(harness.didAdapterStop(), true, 'Restart must follow an actual adapter stop');
                assert.equal(
                    firstProcessConfirmedStopped,
                    true,
                    'Original child exit and closed port must be verified',
                );
                await assert.rejects(
                    request('/api/auth/status'),
                    error => error.code === 'ECONNREFUSED',
                    'The EOS port must remain closed before any restart fixture state is changed',
                );
                const installedDirectory = path.join(
                    os.tmpdir(),
                    'test-iobroker.eos-admin',
                    'node_modules',
                    'iobroker.eos-admin',
                );
                const installedPackage = JSON.parse(
                    fs.readFileSync(path.join(installedDirectory, 'package.json'), 'utf8'),
                );
                const expectedPackage = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
                assert.equal(installedPackage.name, expectedPackage.name);
                assert.equal(
                    installedPackage.version,
                    expectedPackage.version,
                    'Restart must use the release under test',
                );
                assert.equal(installedPackage.main, 'build/main.js');
                const aliveId = 'system.adapter.eos-admin.0.alive';
                const alive = await harness.states.getStateAsync(aliveId);
                if (alive?.val === true) {
                    // Controller 7.2.5 handles host sigKill with updateAliveState:false. The DB-only
                    // harness has no host supervisor to clear the old alive lease after child exit.
                    // Only after proving that our exact child exited AND its port is closed, emulate
                    // that supervisor cleanup for this one instance; never bypass a live process.
                    await harness.states.setStateAsync(aliveId, {
                        val: false,
                        ack: true,
                        from: 'system.host.testing',
                    });
                }
                const signalId = 'system.adapter.eos-admin.0.sigKill';
                const oldSignal = await harness.states.getStateAsync(signalId);
                if (oldSignal && (oldSignal.val !== 0 || oldSignal.ack)) {
                    await harness.states.setStateAsync(signalId, {
                        val: 0,
                        ack: false,
                        from: 'system.host.testing',
                    });
                }
                restartedChild = spawn(process.execPath, ['build/main.js', '--console', '--loglevel', 'info'], {
                    cwd: installedDirectory,
                    stdio: ['ignore', 'pipe', 'pipe'],
                    env: { ...process.env },
                });
                restartedChild.once('error', error => {
                    restartSpawnError = error;
                });
                restartClosed = new Promise(resolve => {
                    restartedChild.once('close', (code, signal) => {
                        restartExit = { code, signal };
                        resolve(restartExit);
                    });
                });
                restartedChild.stdout.on('data', chunk => captureRestartOutput(chunk, 'stdout'));
                restartedChild.stderr.on('data', chunk => captureRestartOutput(chunk, 'stderr'));
                try {
                    const readinessDeadline = Date.now() + 45000;
                    let ready = false;
                    while (Date.now() < readinessDeadline) {
                        assert.ok(!restartSpawnError, 'The installed EOS process must spawn successfully');
                        assert.ok(!restartExit, 'The restarted EOS process must stay alive');
                        try {
                            const response = await request('/api/auth/status', {
                                timeoutMs: Math.min(5000, Math.max(1, readinessDeadline - Date.now())),
                            });
                            if (response.status === 200) {
                                ready = true;
                                break;
                            }
                        } catch {
                            // Allow startup to complete; each request retains CA and hostname verification.
                        }
                        await wait(Math.min(100, Math.max(0, readinessDeadline - Date.now())));
                    }
                    assert.ok(ready, 'Restarted EOS must expose verified HTTPS within 45 seconds');
                    const response = await request('/api/auth/login', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json', origin: base },
                        body: JSON.stringify({ user: 'eosintegration', password: secret }),
                    });
                    assert.equal(
                        response.status,
                        200,
                        `The persisted account must authenticate after restart; error=${await responseErrorCode(response)}`,
                    );
                    const body = await response.json();
                    assert.ok(
                        !body.access_token && !body.refresh_token,
                        'Restart must not expose bearer tokens in JSON',
                    );
                    const newCookies = response.headers.getSetCookie();
                    const accessCookie = newCookies.find(value => value.startsWith('nexowatt_eos_admin_0_access_token='));
                    assert.ok(accessCookie, 'Restart login must issue a new access cookie');
                    assert.match(accessCookie, /;\s*Secure(?:;|$)/i);
                    assert.match(accessCookie, /;\s*HttpOnly(?:;|$)/i);
                    const newCookie = newCookies.map(value => value.split(';')[0]).join('; ');
                    const status = await (await request('/api/auth/status', { headers: { cookie: newCookie } })).json();
                    assert.equal(status.authenticated, true);
                    assert.equal(status.role, 'admin');
                    assert.equal(status.activationRequired, true);
                    assert.equal(status.nextUrl, '/nexowatt/license');
                    const recoveredTrust = await (
                        await request('/nexowatt/license/trust/status', {
                            headers: { cookie: newCookie },
                        })
                    ).json();
                    if (importedManufacturerKeys) {
                        assert.equal(recoveredTrust.ready, true);
                        assert.deepEqual(recoveredTrust.keys, importedManufacturerKeys);
                    } else {
                        assert.ok(
                            missingOsRootOwnership.length,
                            'Only the detected OS ownership limitation may skip import',
                        );
                        assert.equal(recoveredTrust.ready, false);
                        assert.equal(recoveredTrust.canImport, false);
                        assert.equal(recoveredTrust.code, 'TRUST_PERMISSIONS');
                        assert.deepEqual(recoveredTrust.keys, []);
                    }
                    const recheck = await request('/nexowatt/license/trust/recheck', {
                        method: 'POST',
                        headers: {
                            cookie: newCookie,
                            origin: base,
                            'x-eos-license': '1',
                            'content-type': 'application/json',
                        },
                        body: '{}',
                    });
                    assert.equal(recheck.status, 200);
                    const checkedTrust = await recheck.json();
                    if (importedManufacturerKeys) {
                        assert.equal(checkedTrust.ready, true);
                        assert.deepEqual(checkedTrust.keys, importedManufacturerKeys);
                    } else {
                        assert.equal(checkedTrust.ready, false);
                        assert.equal(checkedTrust.canImport, false);
                        assert.equal(checkedTrust.code, 'TRUST_PERMISSIONS');
                        assert.deepEqual(checkedTrust.keys, []);
                    }
                    assert.equal(
                        checkedTrust.licenseStatus.valid,
                        false,
                        'Trust recovery cannot grant an unsigned license',
                    );
                    assert.equal(checkedTrust.licenseStatus.coreEnabled, false);
                    await assertAdminPreserved();
                    const config = await harness.getAdapterConfig('eos-admin');
                    assert.equal(config.native.port, 8188);
                    assert.equal(config.native.bind, '0.0.0.0');
                    assert.equal(config.native.secure, true);
                    assert.equal(config.native.auth, true);
                    assert.equal(config.native.eosLockLegacyAdmin, true);
                    assert.ok(!restartExit, 'Restarted EOS must remain running through the access checks');
                } catch (error) {
                    if (restartLogTail) {
                        console.error(`Restart diagnostics (bounded, credential-filtered):\n${restartLogTail}`);
                    }
                    throw error;
                } finally {
                    await stopRestartedChild();
                }
                await assertAdminPreserved();
            });
        });
    },
});
