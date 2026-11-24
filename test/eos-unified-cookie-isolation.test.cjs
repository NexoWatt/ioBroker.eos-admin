/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
// Real TLS listeners and the bundled upstream OAuth routes, with an in-memory
// controller and a deliberately port-independent cookie jar. This checks parallel
// browser authentication; it is not a complete standard Admin/Backitup deployment.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const https = require('node:https');
const tls = require('node:tls');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const express = require('express');
const emitted = process.env.EOS_TEST_RUNTIME === 'build';
const { createEosCookieNamespace } = require(emitted
    ? '../build/lib/eosCookieNamespace' : '../src/lib/eosCookieNamespace');
const { EosSessionSecurity } = require(emitted
    ? '../build/lib/eosSessionSecurity' : '../src/lib/eosSessionSecurity');
const { createOAuth2Server } = require(emitted
    ? '../build/lib/vendor/webserver' : '../src/lib/vendor/webserver');
const clone = value => value == null ? value : structuredClone(value);
const log = { debug() {}, info() {}, warn() {}, error() {} };

function certificate() {
    const controllerRequire = createRequire(require.resolve('@iobroker/js-controller-common-db'));
    const forge = controllerRequire('node-forge');
    const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const key = pair.privateKey.export({ format: 'pem', type: 'pkcs1' });
    const cert = forge.pki.createCertificate();
    cert.publicKey = forge.pki.publicKeyFromPem(pair.publicKey.export({ format: 'pem', type: 'spki' }));
    cert.serialNumber = `01${crypto.randomBytes(15).toString('hex')}`;
    cert.validity.notBefore = new Date(Date.now() - 60000);
    cert.validity.notAfter = new Date(Date.now() + 3600000);
    const subject = [{ name: 'commonName', value: 'localhost' }];
    cert.setSubject(subject);
    cert.setIssuer(subject);
    cert.setExtensions([{ name: 'basicConstraints', cA: true },
        { name: 'subjectAltName', altNames: [{ type: 7, ip: '127.0.0.1' }, { type: 2, value: 'localhost' }] }]);
    cert.sign(forge.pki.privateKeyFromPem(key), forge.md.sha256.create());
    return { key, cert: forge.pki.certificateToPem(cert) };
}

// Host+path+name, intentionally without a port. Only the attributes used by these
// fixture cookies are supported; this is not a general-purpose browser library.
class BrowserCookies {
    constructor() { this.rows = new Map(); }
    accept(url, lines = []) {
        const target = new URL(url);
        for (const line of lines) {
            const [pair, ...attributes] = line.split(';').map(value => value.trim());
            const split = pair.indexOf('=');
            assert.ok(split > 0);
            const name = pair.slice(0, split);
            const value = pair.slice(split + 1);
            const flags = new Map(attributes.map(attribute => {
                const index = attribute.indexOf('=');
                return index < 0 ? [attribute.toLowerCase(), true]
                    : [attribute.slice(0, index).toLowerCase(), attribute.slice(index + 1)];
            }));
            const host = flags.get('domain') || target.hostname;
            const path = flags.get('path') || '/';
            const key = JSON.stringify([host, path, name]);
            const maxAge = flags.get('max-age');
            if ((maxAge !== undefined && Number(maxAge) <= 0)
                || (flags.has('expires') && Date.parse(flags.get('expires')) <= Date.now())) {
                this.rows.delete(key);
            } else {
                this.rows.set(key, { name, value, host, path, secure: flags.has('secure') });
            }
        }
    }
    header(url) {
        const target = new URL(url);
        return [...this.rows.values()]
            .filter(row => row.host === target.hostname && target.pathname.startsWith(row.path)
                && (!row.secure || target.protocol === 'https:'))
            .map(row => `${row.name}=${row.value}`).join('; ');
    }
    value(name) { return [...this.rows.values()].find(row => row.name === name)?.value; }
}

function request(url, cert, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            ca: cert, method: options.method || 'GET', headers: options.headers || {},
        }, res => {
            const chunks = [];
            res.on('data', bytes => chunks.push(bytes));
            res.on('error', reject);
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString();
                resolve({ status: res.statusCode, headers: res.headers, body,
                    json: res.headers['content-type']?.includes('json') ? JSON.parse(body) : null });
            });
        });
        req.setTimeout(5000, () => req.destroy(new Error('cookie fixture request deadline')));
        req.on('error', reject);
        req.end(options.body);
    });
}

async function fixture(t) {
    const cert = certificate();
    const sessions = new Map();
    const users = {
        'system.user.operator': { type: 'user', common: { enabled: true, password: 'fixture-password-hash' }, native: {} },
    };
    const group = { _id: 'system.group.administrator', type: 'group',
        common: { name: 'Administrators', members: ['system.user.operator'], acl: {} } };
    const services = [];
    const jar = new BrowserCookies();
    t.after(async () => {
        for (const service of services) {
            service.security?.stop();
            service.detach?.();
            service.server.closeAllConnections();
        }
        await Promise.all(services.map(service => new Promise(resolve => service.server.close(resolve))));
    });
    async function service(namespace, isolated) {
        const adapter = { namespace, config: { auth: true, secure: true }, log,
            getSession(id, callback) { callback(clone(sessions.get(id))); },
            setSession(id, _ttl, value, callback) { sessions.set(id, clone(value)); callback?.(null); },
            async destroySession(id) { sessions.delete(id); },
            async getForeignObjectAsync(id) { return clone(users[id]); },
            async getObjectViewAsync() { return { rows: [{ id: group._id, value: clone(group) }] }; },
            checkPassword(name, password, callback) {
                callback(name === 'operator' && password === 'fixture-passphrase', `system.user.${name}`);
            },
        };
        const boundary = isolated ? createEosCookieNamespace(namespace) : null;
        const security = isolated ? new EosSessionSecurity(adapter) : null;
        const app = express();
        if (boundary) app.use(boundary.middleware);
        app.use(express.urlencoded({ extended: false, limit: '20kb' }));
        // Exercise the raw Set-Cookie writer too, not only Express res.cookie.
        app.get('/fixture/session-cookies', (_req, res) => {
            res.setHeader('Set-Cookie', [
                'refresh_token=fixture-refresh; HttpOnly; Secure; SameSite=Strict; Path=/',
                'connect.sid=fixture-session; HttpOnly; Secure; SameSite=Strict; Path=/',
            ]);
            res.end('fixture');
        });
        app.get('/fixture/clear-session', (_req, res) => {
            for (const name of ['access_token', 'refresh_token', 'connect.sid']) {
                res.clearCookie(name, { secure: true, httpOnly: true, sameSite: 'strict', path: '/' });
            }
            res.end('cleared');
        });
        app.get('/fixture/write-head', (req, res) => {
            const headers = req.query.raw === 'yes'
                ? ['Set-Cookie', 'access_token=direct-header; HttpOnly; Secure; Path=/',
                    'Set-Cookie', 'refresh_token=direct-refresh; HttpOnly; Secure; Path=/']
                : { 'Set-Cookie': ['access_token=direct-header; HttpOnly; Secure; Path=/',
                    'refresh_token=direct-refresh; HttpOnly; Secure; Path=/'] };
            res.writeHead(200, headers);
            res.end('direct');
        });
        const model = createOAuth2Server(adapter, { app, secure: true, accessLifetime: 60,
            refreshLifetime: 120, noBasicAuth: true, authorizationCode: false,
            dynamicClientRegistration: false, loginPage: '/login.html' });
        security?.bindOAuthModel(model);
        app.get('/identity', (req, res) => req.user
            ? res.json({ user: req.user }) : res.status(401).json({ error: 'notAuthenticated' }));
        const server = https.createServer(cert, app);
        const detach = boundary?.attach(server);
        const result = { app, adapter, server, boundary, security, detach, model, origin: '' };
        services.push(result);
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', resolve);
        });
        result.origin = `https://127.0.0.1:${server.address().port}`;
        return result;
    }
    const standard = await service('admin.0', false);
    const eos = await service('eos-admin.0', true);
    const browser = async (target, pathname, options = {}) => {
        const url = target.origin + pathname;
        const response = await request(url, cert.cert, {
            ...options, headers: { Cookie: jar.header(url), ...options.headers },
        });
        jar.accept(url, response.headers['set-cookie']);
        return response;
    };
    const token = (target, values) => browser(target, '/oauth/token', { method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: 'ioBroker', ...values }).toString() });
    const login = target => token(target, {
        grant_type: 'password', username: 'operator', password: 'fixture-passphrase',
    });
    return { cert, sessions, jar, standard, eos, service, browser, token, login };
}

test('parallel HTTPS ports keep standard Admin login, refresh and session cookies through EOS login/logout', async t => {
    const f = await fixture(t);
    const adminLogin = await f.login(f.standard);
    assert.equal(adminLogin.status, 200, adminLogin.body);
    const original = adminLogin.json.access_token;
    await f.browser(f.standard, '/fixture/session-cookies');
    assert.equal(f.jar.value('access_token'), original);
    assert.equal((await f.browser(f.standard, '/identity')).status, 200);
    assert.equal((await f.browser(f.eos, '/identity')).status, 401, 'an Admin cookie is not an EOS login');

    const eosLogin = await f.login(f.eos);
    assert.equal(eosLogin.status, 200, eosLogin.body);
    const name = f.eos.boundary.names.accessToken;
    assert.equal(name, 'nexowatt_eos_admin_0_access_token');
    assert.equal(f.jar.value(name), eosLogin.json.access_token);
    assert.equal(f.jar.value('access_token'), original, 'EOS login must not overwrite the host-wide Admin cookie');
    assert.equal((await f.browser(f.standard, '/identity')).status, 200);
    assert.equal((await f.browser(f.eos, '/identity')).status, 200);
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict']) {
        assert.ok(eosLogin.headers['set-cookie'].some(line => line.includes(flag)));
    }
    await f.browser(f.eos, '/fixture/session-cookies');
    assert.equal(f.jar.value(f.eos.boundary.names.refreshToken), 'fixture-refresh');
    assert.equal(f.jar.value(f.eos.boundary.names.session), 'fixture-session');
    const refreshed = await f.token(f.eos, {
        grant_type: 'refresh_token', refresh_token: eosLogin.json.refresh_token,
    });
    assert.equal(refreshed.status, 200, refreshed.body);
    assert.notEqual(refreshed.json.access_token, eosLogin.json.access_token);
    assert.equal(f.jar.value(name), refreshed.json.access_token);
    assert.equal(f.jar.value('access_token'), original);

    const logout = await f.browser(f.eos, '/logout');
    assert.equal(logout.status, 302);
    await f.browser(f.eos, '/fixture/clear-session');
    assert.equal(f.jar.value(name), undefined);
    assert.equal(f.jar.value(f.eos.boundary.names.refreshToken), undefined);
    assert.equal(f.jar.value(f.eos.boundary.names.session), undefined);
    assert.equal(f.jar.value('access_token'), original);
    assert.equal(f.jar.value('refresh_token'), 'fixture-refresh');
    assert.equal(f.jar.value('connect.sid'), 'fixture-session');
    assert.equal((await f.browser(f.standard, '/identity')).status, 200, 'Admin still works after EOS logout');
    assert.equal((await f.browser(f.eos, '/identity')).status, 401);
    assert.ok(f.sessions.has(`a:${original}`), 'EOS logout must not delete the Admin server session');
});

test('EOS ignores generic and foreign-instance cookies; duplicate own credentials are rejected before OAuth', async t => {
    const f = await fixture(t);
    const login = await f.login(f.eos);
    assert.equal(login.status, 200, login.body);
    const own = f.eos.boundary.names.accessToken;
    const token = login.json.access_token;
    const endpoint = f.eos.origin + '/identity';
    for (const cookie of [`access_token=${token}`, `nexowatt_eos_admin_1_access_token=${token}`]) {
        assert.equal((await request(endpoint, f.cert.cert, { headers: { Cookie: cookie } })).status, 401);
    }
    const duplicate = await request(endpoint, f.cert.cert, {
        headers: { Cookie: `${own}=${token}; ${own}=${token}` },
    });
    assert.equal(duplicate.status, 400);
    assert.match(duplicate.body, /EOS_COOKIE_INVALID/);
    const genericAlongside = await request(endpoint, f.cert.cert, {
        headers: { Cookie: `access_token=foreign-admin; ${own}=${token}; theme=dark` },
    });
    assert.equal(genericAlongside.status, 200, 'unrelated host cookies cannot displace an EOS credential');
    const second = await f.service('eos-admin.1', true);
    const secondLogin = await f.login(second);
    assert.equal(secondLogin.status, 200, secondLogin.body);
    assert.equal(f.jar.value(own), token);
    assert.equal((await f.browser(f.eos, '/identity')).status, 200);
    assert.equal((await f.browser(second, '/identity')).status, 200);
    await f.browser(second, '/logout');
    assert.equal((await f.browser(f.eos, '/identity')).status, 200, 'second EOS instance logout is isolated');
});

function upgrade(origin, cert, cookie, pathname = '/socket.io/?EIO=4&transport=websocket') {
    return new Promise((resolve, reject) => {
        const url = new URL(origin);
        const socket = tls.connect({ host: url.hostname, port: Number(url.port), ca: cert });
        const chunks = [];
        socket.setTimeout(5000, () => socket.destroy(new Error('upgrade fixture deadline')));
        socket.on('error', reject);
        socket.on('data', value => chunks.push(value));
        socket.on('end', () => resolve(Buffer.concat(chunks).toString()));
        socket.once('secureConnect', () => socket.write(
            `GET ${pathname} HTTP/1.1\r\nHost: ${url.host}\r\n`
            + `Origin: ${origin}\r\nCookie: ${cookie}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n`));
    });
}

test('raw WebSocket upgrades normalize before later generic-cookie auth listeners and reject duplicates', async t => {
    const f = await fixture(t);
    const login = await f.login(f.eos);
    assert.equal(login.status, 200, login.body);
    let seen;
    let calls = 0;
    // Installed after attach(), as socket libraries can replace HTTP listeners
    // while being initialized. No Express middleware runs for an upgrade.
    f.eos.server.on('upgrade', (req, socket) => {
        calls++;
        seen = req.headers.cookie;
        const token = seen?.split(';').map(value => value.trim())
            .find(value => value.startsWith('access_token='))?.slice(13);
        f.eos.adapter.getSession(`a:${token}`, session => {
            socket.end(session ? 'HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n'
                : 'HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
        });
    });
    const name = f.eos.boundary.names.accessToken;
    const token = login.json.access_token;
    const accepted = await upgrade(f.eos.origin, f.cert.cert, `access_token=admin-session; ${name}=${token}; theme=dark`);
    assert.match(accepted, /^HTTP\/1.1 101 /);
    assert.deepEqual(seen.split(';').map(value => value.trim()).sort(),
        [`theme=dark`, `access_token=${token}`].sort());
    const foreign = await upgrade(f.eos.origin, f.cert.cert, `access_token=${token}`);
    assert.match(foreign, /^HTTP\/1.1 401 /);
    const beforeDuplicate = calls;
    const duplicated = await upgrade(f.eos.origin, f.cert.cert, `${name}=${token}; ${name}=${token}`);
    assert.match(duplicated, /^HTTP\/1.1 400 /);
    assert.equal(calls, beforeDuplicate, 'ambiguous credentials must not reach the upgrade listener');
});

test('direct writeHead Set-Cookie object and raw-array forms cannot overwrite Admin credentials', async t => {
    const f = await fixture(t);
    const login = await f.login(f.standard);
    assert.equal(login.status, 200, login.body);
    const original = f.jar.value('access_token');
    for (const path of ['/fixture/write-head', '/fixture/write-head?raw=yes']) {
        const response = await f.browser(f.eos, path);
        assert.equal(response.status, 200);
        assert.equal(response.headers['set-cookie'].length, 2);
        assert.ok(response.headers['set-cookie'].every(value => value.startsWith('nexowatt_eos_admin_0_')));
        assert.equal(f.jar.value('access_token'), original);
        assert.equal(f.jar.value(f.eos.boundary.names.accessToken), 'direct-header');
        assert.equal(f.jar.value(f.eos.boundary.names.refreshToken), 'direct-refresh');
        assert.equal((await f.browser(f.standard, '/identity')).status, 200);
    }
});

test('actual instance proxy strips EOS/Admin credentials in both directions while retaining adapter cookies', async t => {
    const f = await fixture(t);
    const login = await f.login(f.eos);
    assert.equal(login.status, 200, login.body);
    const original = f.jar.value(f.eos.boundary.names.accessToken);
    let received;
    const target = http.createServer((req, res) => {
        received = req.headers.cookie;
        res.setHeader('Set-Cookie', [
            'access_token=untrusted; Path=/',
            'nexowatt_eos_admin_0_access_token=untrusted; Path=/',
            'nexowatt_eos_admin_1_refresh_token=untrusted; Path=/',
            'device_ui=accepted; HttpOnly; Path=/',
        ]);
        res.end('proxied');
    });
    await new Promise(resolve => target.listen(0, '127.0.0.1', resolve));
    const { InstanceProxy } = emitted ? require('../build/lib/instanceProxy')
        : require('tsx/cjs/api').require(path.resolve(__dirname, '../src/lib/instanceProxy.ts'), __filename);
    const lookup = f.eos.adapter.getForeignObjectAsync;
    f.eos.adapter.host = 'fixture-host';
    f.eos.adapter.getForeignObjectAsync = async id => {
        if (id === 'system.group.administrator') return { type: 'group', common: { members: ['system.user.operator'] } };
        if (id === 'system.adapter.fixture.0') return { type: 'instance',
            common: { host: 'fixture-host', enabled: true, adminTab: { proxy: true } },
            native: { bind: '127.0.0.1', port: target.address().port, secure: false } };
        return lookup(id);
    };
    const proxy = new InstanceProxy(f.eos.adapter, '/admin/');
    f.eos.app.use(proxy.hideAuthorization);
    f.eos.app.use(proxy.handleRequest);
    // Keep the same order as Web.initWebServer: the cookie boundary must wrap
    // the proxy's emit interceptor, which consumes its own upgrade events.
    f.eos.detach();
    proxy.attach(f.eos.server);
    f.eos.detach = f.eos.boundary.attach(f.eos.server);
    t.after(async () => {
        proxy.close();
        target.closeAllConnections();
        await new Promise(resolve => target.close(resolve));
    });
    const response = await f.browser(f.eos, '/admin/proxy/fixture.0/', { headers: {
        Cookie: `${f.jar.header(f.eos.origin)}; access_token=admin; refresh_token=admin-refresh; `
            + 'nexowatt_eos_admin_1_access_token=other-eos; device_ui=original',
    } });
    assert.equal(response.status, 200, response.body);
    assert.equal(received, 'device_ui=original');
    assert.equal(f.jar.value(f.eos.boundary.names.accessToken), original);
    assert.equal(response.headers['set-cookie'].length, 1);
    assert.match(response.headers['set-cookie'][0], /^device_ui=accepted;/);
    assert.match(response.headers['set-cookie'][0], /Path=\/admin\/proxy\/fixture\.0\//);
    assert.equal((await f.browser(f.eos, '/identity')).status, 200);
    let upgradeCookie;
    let upgradeCalls = 0;
    target.on('upgrade', (req, socket) => {
        upgradeCalls++;
        upgradeCookie = req.headers.cookie;
        socket.end('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
    });
    const accepted = await upgrade(f.eos.origin, f.cert.cert,
        `${f.eos.boundary.names.accessToken}=${original}; access_token=admin; device_ui=original`,
        '/admin/proxy/fixture.0/socket');
    assert.match(accepted, /^HTTP\/1.1 101 /);
    assert.equal(upgradeCookie, 'device_ui=original');
    const rejected = await upgrade(f.eos.origin, f.cert.cert,
        `access_token=${original}`, '/admin/proxy/fixture.0/socket');
    assert.match(rejected, /^HTTP\/1.1 401 /);
    assert.equal(upgradeCalls, 1, 'generic Admin credentials must not open a proxied websocket');
});

test('production Web registration keeps cookie isolation outside the proxy upgrade interceptor', () => {
    const web = fs.readFileSync(path.join(__dirname, emitted ? '../build/lib/web.js' : '../src/lib/web.ts'), 'utf8');
    const proxy = web.indexOf('this.instanceProxy.attach(this.server.server)');
    const cookies = web.indexOf('eosCookies.attach(this.server.server)');
    assert.ok(proxy >= 0 && cookies > proxy,
        'normalization must run before the proxy consumes a WebSocket upgrade event');
});

test('response cookie mapping is idempotent and preserves application cookies and security attributes', () => {
    const boundary = createEosCookieNamespace('eos-admin.0');
    const headers = new Map();
    const res = { setHeader(name, value) { headers.set(name.toLowerCase(), value); return this; } };
    boundary.wrapResponse(res);
    boundary.wrapResponse(res);
    const own = boundary.names.accessToken;
    res.setHeader('Set-Cookie', [
        'access_token=one; HttpOnly; Secure; SameSite=Strict; Path=/',
        `${own}=two; HttpOnly; Secure; SameSite=Strict; Path=/`,
        'device_ui=three; HttpOnly; Secure; Path=/admin/proxy/example.0/',
    ]);
    assert.deepEqual(headers.get('set-cookie'), [
        `${own}=one; HttpOnly; Secure; SameSite=Strict; Path=/`,
        `${own}=two; HttpOnly; Secure; SameSite=Strict; Path=/`,
        'device_ui=three; HttpOnly; Secure; Path=/admin/proxy/example.0/',
    ]);
    const req = { headers: { cookie: `access_token=admin; ${own}=eos; theme=dark` } };
    assert.equal(boundary.normalizeRequest(req), true);
    const once = req.headers.cookie;
    assert.equal(boundary.normalizeRequest(req), true);
    assert.equal(req.headers.cookie, once, 'Express must not strip its already-normalized EOS credential');
});

test('cookie-name whitespace cannot smuggle Admin credentials past downstream tolerant cookie parsers', () => {
    const boundary = createEosCookieNamespace('eos-admin.0');
    const req = { headers: { cookie: 'access_token =admin; refresh_token =admin-refresh; connect.sid =admin-session; '
        + 'io =admin-io; ioBroker.sid =legacy-admin; eos-admin.sid =legacy-eos; '
        + 'nexowatt_eos_admin_1_access_token =other-instance; theme=dark' },
    cookies: { access_token: 'admin', refresh_token: 'admin-refresh', 'connect.sid': 'admin-session', theme: 'dark' } };
    assert.equal(boundary.normalizeRequest(req), true);
    assert.equal(req.headers.cookie, 'theme=dark');
    assert.deepEqual(req.cookies, { theme: 'dark' });
    const own = boundary.names.accessToken;
    const named = { headers: { cookie: `${own} =scoped; access_token =admin` } };
    assert.equal(boundary.normalizeRequest(named), true);
    assert.equal(named.headers.cookie, 'access_token=scoped');
    const duplicate = { headers: { cookie: `${own}=first; ${own} =second` } };
    assert.equal(boundary.normalizeRequest(duplicate), false);
    assert.equal(duplicate.headers.cookie, undefined);
});
