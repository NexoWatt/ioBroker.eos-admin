/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
// Actual shared-origin Web mount and hosted router. Controller identity/database
// are fixtures, with an explicit in-process UI factory seam so the actual router
// sees those fixture identities. Child isolation is tested separately. This is
// not a smartphone install or certificate-trust claim.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const http = require('node:http');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const express = require('express');
const { UnifiedSessions } = require('../src/lib/eosUnifiedBoundary');
const { installIdleSession } = require('./fixtures/eos-idle-session.cjs');
const root = path.resolve(__dirname, '..');
const sourceLogoSha256 = '952ceb9cef3f7f22a150dd8ea396285f70b9d8c19de8e7c1452bf2ff983ae6bd';
const touchLogoSha256 = '083e11ab28ec00b37d3d47776946c5fad4d79277fdc440cdbb20181a7f064f76';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => fs.readFileSync(path.join(root, file));
const manifest = () => JSON.parse(read('ui/www/manifest.webmanifest'));
function pngSize(bytes) {
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}
function links(html, rel) {
    return [...html.matchAll(/<link\b[^>]*>/gi)].map(match => {
        const attributes = Object.fromEntries([...match[0].matchAll(/([a-z-]+)\s*=\s*["']([^"']*)["']/gi)]
            .map(value => [value[1].toLowerCase(), value[2]]));
        return attributes;
    }).filter(attributes => attributes.rel?.split(/\s+/).includes(rel));
}

test('one root app identity and the exact uploaded icon are shared by dashboard, login and system console', () => {
    const app = manifest();
    const origin = 'https://nexowatt.example:8188';
    const rootManifest = new URL('/manifest.webmanifest', origin);
    assert.equal(new URL(app.id, rootManifest).href, `${origin}/`);
    assert.equal(new URL(app.start_url, rootManifest).href, `${origin}/`);
    assert.equal(new URL(app.scope, rootManifest).href, `${origin}/`);
    assert.equal(app.display, 'standalone');
    assert.equal(app.name, 'NexoWatt EOS');
    for (const file of ['src-admin/public/manifest.json', 'adminWww/manifest.json']) {
        const compat = JSON.parse(read(file));
        const compatUrl = new URL('/system/manifest.json', origin);
        for (const field of ['id', 'start_url', 'scope']) assert.equal(new URL(compat[field], compatUrl).href, `${origin}/`, `${file}: ${field}`);
        for (const icon of compat.icons) assert.equal(new URL(icon.src, compatUrl).origin, origin);
        assert.ok(compat.icons.every(icon => icon.src.startsWith('/')), 'compatibility icons must not resolve into the protected system path');
    }
    const uploaded = read('ui/www/assets/icons/nexowatt-1024.png');
    assert.equal(sha256(uploaded), sourceLogoSha256, 'uploaded branding must remain byte-for-byte unchanged');
    assert.equal(pngSize(uploaded), '1024x1024');
    assert.deepEqual(read('ui/www/apple-touch-icon.png'), uploaded);
    const touchLogo = read('ui/www/assets/icons/nexowatt-180.png');
    assert.equal(sha256(touchLogo), touchLogoSha256, 'existing 180-pixel branding remains byte-for-byte unchanged');
    assert.equal(pngSize(touchLogo), '180x180');
    assert.deepEqual(read('src-admin/public/assets/icons/nexowatt-180.png'), touchLogo);
    assert.deepEqual(read('adminWww/assets/icons/nexowatt-180.png'), touchLogo);
    assert.ok(app.icons.some(icon => icon.sizes === '1024x1024' && (icon.purpose || 'any') === 'any'));
    for (const size of ['192x192', '512x512']) {
        assert.ok(app.icons.some(icon => icon.sizes === size && (icon.purpose || 'any') === 'any'));
        assert.ok(app.icons.some(icon => icon.sizes === size && icon.purpose === 'maskable'));
    }
    for (const icon of app.icons) {
        const url = new URL(icon.src, rootManifest);
        assert.equal(url.origin, origin); assert.match(url.pathname, /^\/assets\/icons\/[a-z0-9-]+\.png$/);
        assert.equal(icon.type, 'image/png'); assert.equal(pngSize(read(`ui/www${url.pathname}`)), icon.sizes);
    }
    const pages = ['login', 'index', 'history', 'settings', 'smarthome', 'smarthome-config', 'storagefarm', 'ems-apps', 'evcs', 'energy-ledger', 'logic', 'simulation']
        .map(name => `ui/www/${name}.html`).concat(['src-admin/index.html', 'adminWww/index.html']);
    for (const file of pages) {
        const html = read(file).toString('utf8');
        const charsets = [...html.matchAll(/<meta\b[^>]*\bcharset\s*=\s*["']([^"']+)["'][^>]*>/gi)];
        assert.ok(charsets.length === 1 && charsets[0][1].toLowerCase() === 'utf-8' &&
            Buffer.byteLength(html.slice(0, charsets[0].index + charsets[0][0].length), 'utf8') <= 1024,
            `${file}: one complete UTF-8 declaration within the first 1024 bytes`);
        const statusBars = [...html.matchAll(/<meta\b[^>]*>/gi)]
            .filter(tag => /\bname\s*=\s*["']apple-mobile-web-app-status-bar-style["']/i.test(tag[0]));
        assert.ok(statusBars.length === 1 && /\bcontent\s*=\s*["']black["']/i.test(statusBars[0][0]),
            `${file}: non-overlay Apple status bar keeps the header below system controls`);
        const declarations = links(html, 'manifest');
        assert.equal(declarations.length, 1, `${file}: one manifest declaration`);
        const apple = links(html, 'apple-touch-icon');
        assert.equal(apple.length, 1, `${file}: one Apple icon declaration`);
        assert.equal(apple[0].sizes, '180x180');
        assert.equal(apple[0].type, 'image/png');
        for (const page of ['/', '/system/', '/static/index.html', '/login.html']) {
            assert.equal(new URL(declarations[0].href, origin + page).href, rootManifest.href, `${file} from ${page}`);
            const iconUrl = new URL(apple[0].href, origin + page);
            assert.equal(iconUrl.origin, origin); assert.equal(iconUrl.pathname, '/assets/icons/nexowatt-180.png');
            assert.equal(iconUrl.searchParams.get('v'), touchLogoSha256.slice(0, 12), 'cache key follows exact 180-pixel branding content');
        }
    }
});

function loadWeb(dataDir) {
    const emitted = process.env.EOS_TEST_RUNTIME === 'build';
    const file = path.join(root, emitted ? 'build/lib/web.js' : 'src/lib/web.ts');
    const localRequire = createRequire(file);
    const source = fs.readFileSync(file, 'utf8');
    const code = emitted ? source : require('typescript').transpileModule(source, {
        compilerOptions: { target: 9, module: 1, esModuleInterop: true },
    }).outputText;
    const exportsValue = {};
    vm.runInNewContext(code, {
        exports: exportsValue, module: { exports: exportsValue }, __dirname: path.dirname(file), __filename: file,
        Buffer, URL, Error, console, process, setTimeout, clearTimeout,
        require(name) {
            if (name === './eosUiProcess') return {
                createEosUiProcess: (adapter, bridge) => localRequire(path.join(root, 'ui/main.js')).createHostedRuntime(adapter, bridge),
            };
            if (name === '@iobroker/adapter-core') return {
                EXIT_CODES: { ADAPTER_REQUESTED_TERMINATION: 11 }, I18n: {},
                controllerDir: path.join(root, 'node_modules/iobroker.js-controller'), getAbsoluteInstanceDataDir: () => dataDir,
            };
            if (!emitted && name.startsWith('.') && fs.existsSync(path.resolve(path.dirname(file), `${name}.ts`))) {
                return require('tsx/cjs/api').require(path.resolve(path.dirname(file), `${name}.ts`), file);
            }
            return localRequire(name);
        },
    }, { filename: file, timeout: 5000 });
    return exportsValue.default;
}

test('actual owner mount serves install metadata publicly while root launch retains session, password and license gates', async t => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-pwa-'));
    t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
    const Web = loadWeb(dataDir);
    let licensed = false, passwordRequired = false;
    const token = 'a'.repeat(40);
    const fixtureObject = { _id: 'system.adapter.eos-admin.0', type: 'instance', common: { enabled: true }, native: { auth: true, secure: false, port: 8188, eosUi: {} } };
    const owner = {
        namespace: 'eos-admin.0', instance: 0, config: fixtureObject.native,
        log: { error() {}, warn() {}, info() {}, debug() {} },
        getForeignObjectAsync: async id => id === fixtureObject._id ? structuredClone(fixtureObject) : null,
        getForeignStateAsync: async () => null,
        setForeignStateAsync: async () => assert.fail('install metadata must not write device states'),
        setTimeout, clearTimeout,
        eosLicenseService: { statusView: () => licensed
            ? { valid: true, coreEnabled: true, edition: 'pro', features: [], limits: { chargePoints: 50, batteries: 10 } }
            : { valid: false, coreEnabled: false } },
        eosOwnership: { canWrite: () => false, status: () => ({ allowed: false }) },
    };
    const sessionFixture = await installIdleSession(owner, { token, user: 'operator' });
    t.after(() => sessionFixture.cleanup());
    const unified = new UnifiedSessions(owner, {
        secure: false, externalOrigin: '',
        resolveAccess: async req => req.headers.cookie === `access_token=${token}`
            ? { userId: 'system.user.operator', role: 'admin', groups: [] }
            : { userId: null, role: 'enduser', groups: [] },
        firstLogin: async () => ({ required: passwordRequired }), getLicense: () => owner.eosLicenseService.statusView(),
    });
    const app = express();
    const web = Object.assign(Object.create(Web.prototype), {
        baseDir: root, server: { app }, adapter: owner, settings: { secure: false }, systemRequests: new WeakSet(), unified,
    });
    await web.mountUnifiedRuntime();
    app.use((_req, res) => res.status(404).end());
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => {
        await owner.eosHostedRuntime.stop(); server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const request = async (url, auth = false, extra = {}) => {
        const response = await fetch(origin + url, { redirect: 'manual', headers: { ...(auth ? { Cookie: `access_token=${token}` } : {}), ...extra } });
        return { response, bytes: Buffer.from(await response.arrayBuffer()) };
    };
    const assets = ['/manifest.webmanifest', '/apple-touch-icon.png?v=' + sourceLogoSha256.slice(0, 12), '/assets/icons/nexowatt-180.png?v=' + touchLogoSha256.slice(0, 12), '/assets/icons/nexowatt-1024.png', '/assets/icons/nexowatt-192.png', '/assets/icons/nexowatt-512.png'];
    for (const auth of [false, true]) {
        for (const url of assets) {
            const { response, bytes } = await request(url, auth, { Referer: origin + '/system/' });
            assert.equal(response.status, 200, `${url}: authenticated=${auth}, licensed=false`);
            assert.equal(response.headers.get('location'), null);
            if (url === '/manifest.webmanifest') {
                assert.match(response.headers.get('content-type'), /^application\/manifest\+json/);
                assert.deepEqual(bytes, read('ui/www/manifest.webmanifest'));
            } else {
                assert.match(response.headers.get('content-type'), /^image\/png/);
                assert.deepEqual(bytes, read('ui/www' + url.split('?')[0]));
                if (url.includes('1024') || url.includes('apple-touch')) assert.equal(sha256(bytes), sourceLogoSha256);
                if (url.includes('180')) { assert.equal(sha256(bytes), touchLogoSha256); assert.equal(pngSize(bytes), '180x180'); }
            }
        }
    }
    const anon = await request('/');
    assert.equal(anon.response.status, 303); assert.equal(anon.response.headers.get('location'), '/login.html?returnTo=%2F');
    const login = await request('/login.html'); assert.equal(login.response.status, 200); assert.match(login.bytes.toString(), /id="loginForm"/);
    const activation = await request('/', true);
    assert.equal(activation.response.status, 302); assert.equal(activation.response.headers.get('location'), '/nexowatt/license');
    licensed = true;
    const dashboard = await request('/', true);
    assert.equal(dashboard.response.status, 200); assert.match(dashboard.response.headers.get('content-type'), /^text\/html/);
    assert.deepEqual(dashboard.bytes, read('ui/www/index.html'));
    passwordRequired = true;
    const password = await request('/', true);
    assert.equal(password.response.status, 302); assert.equal(password.response.headers.get('location'), '/system/?passwordSetup');
    assert.equal((await request('/manifest.webmanifest', true)).response.status, 200, 'first-password requirement does not block public installation metadata');
    assert.equal((await request('/api/ems/status')).response.status, 401, 'public metadata does not expose protected APIs');
    assert.equal((await request('/assets/icons/nexowatt-1024.png', false, { Origin: 'https://outside.invalid' })).response.status, 403);
});
