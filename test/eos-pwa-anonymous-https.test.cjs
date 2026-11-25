'use strict';
/** Actual EOS owner mount and TLS creator; only controller identity/database are fixtures.
 * The UI factory explicitly stays in-process for this controller fixture; actual
 * hosted assets and auth routes remain real. Child isolation has separate tests.
 * Verifies anonymous metadata transport, not iOS installation or customer CA trust. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const https = require('node:https');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const express = require('express');
const { UnifiedSessions } = require('../src/lib/eosUnifiedBoundary');
const { installIdleSession } = require('./fixtures/eos-idle-session.cjs');
const root = path.resolve(__dirname, '..');

function loadWeb(dataDir) {
    const emitted = process.env.EOS_TEST_RUNTIME === 'build';
    const file = path.join(root, emitted ? 'build/lib/web.js' : 'src/lib/web.ts');
    const localRequire = createRequire(file); const source = fs.readFileSync(file, 'utf8');
    const code = emitted ? source : require('typescript').transpileModule(source, { compilerOptions: { target: 9, module: 1, esModuleInterop: true } }).outputText;
    const exports = {};
    vm.runInNewContext(code, { exports, module: { exports }, __dirname: path.dirname(file), __filename: file,
        Buffer, URL, Error, console, process, setTimeout, clearTimeout,
        require(name) {
            if (name === './eosUiProcess') return {
                createEosUiProcess: (adapter, bridge) => localRequire(path.join(root, 'ui/main.js')).createHostedRuntime(adapter, bridge),
            };
            if (name === '@iobroker/adapter-core') return { EXIT_CODES: { ADAPTER_REQUESTED_TERMINATION: 11 }, I18n: {}, controllerDir: path.join(root, 'node_modules/iobroker.js-controller'), getAbsoluteInstanceDataDir: () => dataDir };
            if (!emitted && name.startsWith('.') && fs.existsSync(path.resolve(path.dirname(file), `${name}.ts`))) return require('tsx/cjs/api').require(path.resolve(path.dirname(file), `${name}.ts`), file);
            return localRequire(name);
        },
    }, { filename: file, timeout: 5000 });
    return exports;
}
function certificate() {
    const forge = createRequire(require.resolve('@iobroker/js-controller-common-db'))('node-forge');
    const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const key = pair.privateKey.export({ format: 'pem', type: 'pkcs1' });
    const cert = forge.pki.createCertificate(); cert.publicKey = forge.pki.publicKeyFromPem(pair.publicKey.export({ format: 'pem', type: 'spki' }));
    cert.serialNumber = '01' + crypto.randomBytes(15).toString('hex');
    cert.validity.notBefore = new Date(Date.now() - 60000); cert.validity.notAfter = new Date(Date.now() + 3600000);
    const subject = [{ name: 'commonName', value: 'EOS PWA test' }]; cert.setSubject(subject); cert.setIssuer(subject);
    cert.setExtensions([{ name: 'basicConstraints', cA: true }, { name: 'subjectAltName', altNames: [{ type: 7, ip: '127.0.0.1' }] }, { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, keyCertSign: true }]);
    cert.sign(forge.pki.privateKeyFromPem(key), forge.md.sha256.create()); return { key, cert: forge.pki.certificateToPem(cert) };
}
function attributes(html, tag) {
    return [...html.matchAll(new RegExp('<' + tag + '\\b[^>]*>', 'gi'))].map(match => Object.fromEntries([...match[0].matchAll(/([a-z-]+)\s*=\s*["']([^"']*)["']/gi)].map(value => [value[1].toLowerCase(), value[2]])));
}
function pngSize(bytes) {
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

test('fresh anonymous HTTPS launch exposes actual login branding and PWA icons while configuration remains protected', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-pwa-tls-')); t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const { default: Web, createEosServer } = loadWeb(directory); const tls = certificate();
    let licensed = false, passwordRequired = false;
    const token = 'a'.repeat(40);
    const instance = { _id: 'system.adapter.eos-admin.0', type: 'instance', common: { enabled: true }, native: { auth: true, secure: true, port: 8188, eosUi: {}, leCollection: false } };
    const owner = { namespace: 'eos-admin.0', instance: 0, config: instance.native,
        log: { error() {}, warn() {}, info() {}, debug() {} }, setTimeout, clearTimeout,
        getCertificatesAsync: async () => [tls, false],
        getForeignObjectAsync: async id => id === instance._id ? structuredClone(instance) : null,
        getForeignStateAsync: async () => null,
        setForeignStateAsync: async () => assert.fail('anonymous assets cannot write device states'),
        eosLicenseService: { statusView: () => ({ valid: licensed, coreEnabled: licensed }) },
        eosOwnership: { canWrite: () => false, status: () => ({ allowed: false }) },
    };
    const session = await installIdleSession(owner, { token }); t.after(() => session.cleanup());
    const unified = new UnifiedSessions(owner, { secure: true, externalOrigin: '', resolveAccess: async req => req.headers.cookie === `access_token=${token}` ? { userId: 'system.user.operator', role: 'admin', groups: [] } : { userId: null, role: 'enduser', groups: [] }, firstLogin: async () => ({ required: passwordRequired }), getLicense: () => owner.eosLicenseService.statusView() });
    const app = express(); const web = Object.assign(Object.create(Web.prototype), { baseDir: root, server: { app }, adapter: owner, settings: { secure: true }, systemRequests: new WeakSet(), unified });
    await web.mountUnifiedRuntime(); app.use((_req, res) => res.status(404).end());
    const server = await createEosServer(app, owner, { secure: true, acmeChallenge: false });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { await owner.eosHostedRuntime.stop(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const origin = `https://127.0.0.1:${server.address().port}`;
    const request = (pathname, method = 'GET', authenticated = false) => new Promise((resolve, reject) => {
        const req = https.request(origin + pathname, { method, headers: authenticated ? { Cookie: `access_token=${token}` } : {}, ca: tls.cert, rejectUnauthorized: true, agent: false, timeout: 3000 }, res => {
            const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks) }));
        }); req.on('error', reject); req.on('timeout', () => req.destroy(new Error('PWA request timeout'))); req.end();
    });
    const launch = await request('/'); assert.equal(launch.status, 303); assert.equal(launch.headers.location, '/login.html?returnTo=%2F');
    const login = await request(launch.headers.location); assert.equal(login.status, 200); assert.match(login.headers['content-type'], /^text\/html/);
    const html = login.bytes.toString('utf8'); assert.match(html, /id="loginForm"/);
    const images = attributes(html, 'img'); assert.ok(images.length >= 1);
    for (const image of images) {
        const url = new URL(image.src, origin); assert.equal(url.origin, origin);
        const loaded = await request(url.pathname + url.search); assert.equal(loaded.status, 200, image.src);
        assert.equal(loaded.headers.location, undefined); assert.match(loaded.headers['content-type'], /^image\/png/); pngSize(loaded.bytes);
    }
    const links = attributes(html, 'link'); const apple = links.find(link => link.rel === 'apple-touch-icon'); assert.ok(apple);
    const icon = await request(apple.href); assert.equal(icon.status, 200); assert.match(icon.headers['content-type'], /^image\/png/);
    assert.equal(pngSize(icon.bytes), apple.sizes, 'declared touch dimensions match actual image');
    assert.equal(pngSize(icon.bytes), '180x180', 'iPhone receives the dedicated existing180px icon');
    for (const alias of ['/apple-touch-icon-precomposed.png', '/apple-touch-icon-180x180.png', '/apple-touch-icon-180x180-precomposed.png']) {
        const fallback = await request(alias); assert.equal(fallback.status, 200, alias); assert.match(fallback.headers['content-type'], /^image\/png/);
        assert.deepEqual(fallback.bytes, icon.bytes);
    }
    const legacyIcon = await request('/apple-touch-icon.png'); assert.equal(legacyIcon.status, 200);
    assert.equal(pngSize(legacyIcon.bytes), '1024x1024', 'uploaded root icon remains compatible and byte-for-byte unchanged');
    assert.deepEqual(legacyIcon.bytes, fs.readFileSync(path.join(root, 'ui/www/assets/icons/nexowatt-1024.png')));
    const manifestLink = links.find(link => link.rel === 'manifest'); assert.ok(manifestLink);
    const manifestResponse = await request(manifestLink.href); assert.equal(manifestResponse.status, 200); assert.match(manifestResponse.headers['content-type'], /^application\/manifest\+json/);
    const manifest = JSON.parse(manifestResponse.bytes); const manifestUrl = new URL(manifestLink.href, origin);
    assert.equal(new URL(manifest.start_url, manifestUrl).href, origin + '/'); assert.equal(new URL(manifest.scope, manifestUrl).href, origin + '/');
    for (const image of manifest.icons) {
        const url = new URL(image.src, manifestUrl); assert.equal(url.origin, origin);
        const loaded = await request(url.pathname); assert.equal(loaded.status, 200); assert.match(loaded.headers['content-type'], /^image\/png/); assert.equal(pngSize(loaded.bytes), image.sizes);
    }
    for (const protectedPath of ['/api/ems/status', '/api/installer/config', '/config', '/static/ems-apps.html']) {
        const response = await request(protectedPath); assert.ok([401, 303].includes(response.status), `${protectedPath} must remain protected`);
        assert.ok(!response.bytes.toString().includes('configPatch'));
    }
    assert.ok([401, 403].includes((await request('/apple-touch-icon-180x180.png', 'POST')).status));
    const head = await request(apple.href, 'HEAD'); assert.equal(head.status, 200); assert.match(head.headers['content-type'], /^image\/png/); assert.equal(head.bytes.length, 0);
    const publicAssets = [apple.href, manifestLink.href, '/static/nexowatt-eos-logo.png', '/apple-touch-icon-precomposed.png', '/apple-touch-icon-180x180.png', '/apple-touch-icon-180x180-precomposed.png'];
    const activation = await request('/', 'GET', true); assert.equal(activation.status, 302); assert.equal(activation.headers.location, '/nexowatt/license');
    assert.equal((await request('/api/ems/status', 'GET', true)).status, 402);
    for (const pathname of publicAssets) assert.equal((await request(pathname, 'GET', true)).status, 200, `activation: ${pathname}`);
    licensed = true; passwordRequired = true;
    const password = await request('/', 'GET', true); assert.equal(password.status, 302); assert.equal(password.headers.location, '/system/?passwordSetup');
    assert.equal((await request('/api/installer/config', 'GET', true)).status, 403);
    for (const pathname of publicAssets) assert.equal((await request(pathname, 'GET', true)).status, 200, `password setup: ${pathname}`);

});
