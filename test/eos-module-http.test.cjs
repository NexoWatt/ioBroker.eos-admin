'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { Readable } = require('node:stream');
const { UnifiedSessions } = require('../src/lib/eosUnifiedBoundary');
const { registerEosModuleRoutes } = require('../src/lib/eosModuleHttp');
const { installIdleSession } = require('./fixtures/eos-idle-session.cjs');

async function fixture(t) {
    const token = 'a'.repeat(40); let role = 'admin'; let active = true; let first = false; let writes = 0; let downloads = 0;
    let archiveName = 'eos-backup-fixture.nwb';
    let holdDownloads = false; let archiveSize = 14; const streams = [];
    let migration = { phase: 'NOT_NEEDED', code: '', sources: [], updatedAt: null };
    const adapter = {};
    const session = await installIdleSession(adapter, { token, user: 'operator' });
    t.after(() => session.cleanup());
    const authority = new UnifiedSessions(adapter, { secure: true, externalOrigin: '',
        resolveAccess: async req => active && req.headers.cookie === `access_token=${token}`
            ? { userId: 'system.user.operator', role, groups: [] } : { userId: null, role: 'enduser', groups: [] },
        firstLogin: async () => ({ required: first }), getLicense: () => ({ valid: true, coreEnabled: true }) });
    const app = express(); const host = {
        migrationStatus: () => migration,
        view: async id => ({ id, config: { enabled: false }, configurationRevision: '00000000-0000-4000-8000-000000000001', status: { active: false } }),
        save: async () => { writes++; return { ok: true }; }, importLegacy: async () => { writes++; return { ok: true }; },
        command: async (_id, command) => { if (command === 'error') throw new Error('PRIVATE_CONFIGURATION'); writes++; return { ok: true }; },
        download: async (id, name) => {
            if (id !== 'backup' || name !== 'eos-backup-fixture.nwb') throw new Error('PRIVATE_ARCHIVE_PATH');
            downloads++;
            const stream = holdDownloads ? new Readable({ read() { if (!this.started) { this.started = true; this.push('a'); } } })
                : Readable.from([Buffer.from('fixture-backup')]);
            streams.push(stream);
            return { stream, filename: archiveName, contentType: 'application/octet-stream', size: archiveSize };
        },
    };
    registerEosModuleRoutes({ app, host, baseDir: path.resolve(__dirname, '..'), jsonParser: express.json({ limit: '1kb' }),
        authorize: req => authority.status(req), csrfAllowed: req => authority.csrfAllowed(req), requestAllowed: req => authority.requestAllowed(req) });
    app.use((_req, res) => res.status(404).end());
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    // Node fetch rewrites Host to the URL authority; raw HTTP preserves the actual
    // named-host request needed to exercise the production origin comparison.
    const request = (url, options = {}) => new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: url,
            method: options.method || 'GET', headers: { host: 'nexowatt', cookie: `access_token=${token}`, ...options.headers } }, response => {
            response.once('aborted', () => reject(new Error('DOWNLOAD_ABORTED')));
            const chunks = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => {
                const body = Buffer.concat(chunks);
                resolve({ status: response.statusCode, headers: { get: name => response.headers[name.toLowerCase()] },
                    text: async () => body.toString(), json: async () => JSON.parse(body.toString()), arrayBuffer: async () => body });
            });
        });
        req.on('error', reject); req.end(options.body);
    });
    return { request, adapter, token, revoke: () => { active = false; }, role: value => { role = value; }, first: value => { first = value; }, writes: () => writes,
        downloads: () => downloads, archiveName: value => { archiveName = value; },
        holdDownloads: value => { holdDownloads = value; }, archiveSize: value => { archiveSize = value; }, streams,
        migration: value => { migration = value; },
        openDownload: () => new Promise((resolve, reject) => {
            const req = http.get({ hostname: '127.0.0.1', port: server.address().port,
                path: '/api/eos/modules/backup/download/eos-backup-fixture.nwb', headers: { host: 'nexowatt', cookie: `access_token=${token}` } }, response => {
                response.on('error', () => {}); response.once('data', () => resolve(response));
            }); req.on('error', reject);
        }),
    };
}

test('real module pages and vendor assets are available through the guarded same-origin routes', async t => {
    const f = await fixture(t);
    for (const url of ['/modules/devices/', '/modules/eebus/', '/modules/devices/vendor/jquery.js', '/modules/devices/templates.json', '/modules/shared/eos-module.css']) {
        const response = await f.request(url); assert.equal(response.status, 200, url); await response.arrayBuffer();
    }
    for (const id of ['devices', 'eebus']) {
        const response = await f.request(`/modules/${id}`);
        assert.equal(response.status, 308); assert.equal(response.headers.get('location'), `/modules/${id}/`);
    }
    const forbidden = await f.request('/modules/eebus/../../package.json'); assert.equal(forbidden.status, 404);
    const anonymous = await f.request('/modules/devices/', { headers: { cookie: '' } });
    assert.equal(anonymous.status, 302); assert.equal(anonymous.headers.get('location'), '/login.html');
});

test('backup download uses authenticated bounded binary streaming and refuses untrusted names', async t => {
    const f = await fixture(t);
    const download = await f.request('/api/eos/modules/backup/download/eos-backup-fixture.nwb');
    assert.equal(download.status, 200); assert.equal(await download.text(), 'fixture-backup');
    assert.equal(download.headers.get('content-length'), '14');
    assert.equal(download.headers.get('content-type'), 'application/octet-stream');
    assert.equal(download.headers.get('cache-control'), 'no-store');
    assert.equal(download.headers.get('content-disposition'), 'attachment; filename="eos-backup-fixture.nwb"');
    const missing = await f.request('/api/eos/modules/backup/download/unknown');
    assert.equal(missing.status, 404); assert.doesNotMatch(await missing.text(), /PRIVATE/);
    f.archiveName('bad\r\nX-Injected: yes');
    assert.equal((await f.request('/api/eos/modules/backup/download/eos-backup-fixture.nwb')).status, 503);
    const before = f.downloads(); f.role('installer');
    assert.equal((await f.request('/api/eos/modules/backup/download/eos-backup-fixture.nwb')).status, 403);
    f.role('admin'); f.revoke();
    assert.equal((await f.request('/api/eos/modules/backup/download/eos-backup-fixture.nwb')).status, 401);
    assert.equal(f.downloads(), before);
});

test('slow backup downloads have bounded admission and release their stream after client disconnect', async t => {
    const f = await fixture(t); f.holdDownloads(true);
    const first = await f.openDownload(); const second = await f.openDownload();
    t.after(() => { first.destroy(); second.destroy(); });
    assert.equal((await f.request('/api/eos/modules/backup/download/eos-backup-fixture.nwb')).status, 429);
    assert.equal(f.downloads(), 2);
    first.destroy();
    for (let i = 0; i < 100 && !f.streams[0].destroyed; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(f.streams[0].destroyed, true);
    f.holdDownloads(false);
    assert.equal((await f.request('/api/eos/modules/backup/download/eos-backup-fixture.nwb')).status, 200);
});

test('backup byte-count mismatches abort the response without exposing an unbounded stream', async t => {
    const f = await fixture(t);
    for (const size of [5, 20]) {
        f.archiveSize(size);
        await assert.rejects(f.request('/api/eos/modules/backup/download/eos-backup-fixture.nwb'));
        assert.equal(f.streams.at(-1).destroyed, true);
    }
    assert.equal((await f.request('/api/eos/modules/devices')).status, 200);
});

test('read-only migration page and status require fresh administrator authentication and expose no private journal fields', async t => {
    const f = await fixture(t);
    f.migration({ phase: 'BLOCKED', code: 'EOS_MIGRATION_PROTECTED_FIELDS_UNAVAILABLE', updatedAt: Date.now(),
        native: { privateKey: 'DO_NOT_EXPOSE' }, config: { password: 'DO_NOT_EXPOSE' },
        sources: [{ id: 'eebus', source: 'eebus.0', namespacePreserved: true, nativeHash: 'DO_NOT_EXPOSE', native: { privateKey: 'DO_NOT_EXPOSE' } },
            { id: 'devices', source: '<img src=x onerror=DO_NOT_EXPOSE>' }] });
    const response = await f.request('/api/eos/migration'); assert.equal(response.status, 200);
    const value = await response.json();
    assert.deepEqual(Object.keys(value).sort(), ['code', 'existingAdaptersUnchanged', 'phase', 'sources', 'updatedAt']);
    assert.deepEqual(value.sources, [{ id: 'eebus', source: 'eebus.0', namespacePreserved: false }]);
    assert.equal(value.existingAdaptersUnchanged, true); assert.doesNotMatch(JSON.stringify(value), /DO_NOT_EXPOSE|privateKey|nativeHash/);
    const redirect = await f.request('/migration'); assert.equal(redirect.status, 308); assert.equal(redirect.headers.get('location'), '/migration/');
    const page = await f.request('/migration/'); assert.equal(page.status, 200);
    assert.match(await page.text(), /Bestandsübernahme/); assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal((await f.request('/migration/index.js')).status, 200);
    assert.equal((await f.request('/api/eos/migration', { method: 'POST', headers: { origin: 'https://nexowatt' } })).status, 405);
    assert.equal((await f.request('/api/eos/migration', { headers: { origin: 'https://foreign.invalid' } })).status, 403);
    f.role('installer'); assert.equal((await f.request('/api/eos/migration')).status, 403);
    f.role('admin'); f.first(true); assert.equal((await f.request('/api/eos/migration')).status, 403);
    f.first(false); f.revoke();
    assert.equal((await f.request('/api/eos/migration')).status, 401);
    assert.equal((await f.request('/migration/')).headers.get('location'), '/login.html');
    assert.equal((await f.request('/migration/index.js')).headers.get('location'), '/login.html');
    assert.equal(f.writes(), 0, 'status UI cannot trigger writes/import/retry');
});

test('fresh admin role, same origin and session-bound CSRF are required for every module mutation', async t => {
    const f = await fixture(t); const status = await (await f.request('/api/eos/modules/devices')).json();
    const options = { method: 'PUT', headers: { 'content-type': 'application/json', origin: 'https://nexowatt', 'x-nw-csrf': status.csrfToken }, body: JSON.stringify({ config: { enabled: false }, expectedConfigurationRevision: status.configurationRevision }) };
    assert.equal((await f.request('/api/eos/modules/devices', options)).status, 200); assert.equal(f.writes(), 1);
    assert.equal((await f.request('/api/eos/modules/devices', { ...options, headers: { ...options.headers, origin: 'https://foreign.invalid' } })).status, 403);
    f.role('installer'); assert.equal((await f.request('/api/eos/modules/devices', options)).status, 403);
    f.role('admin'); f.adapter.eosSessionSecurity.epoch = 'revoked-csrf';
    assert.equal((await f.request('/api/eos/modules/devices', options)).status, 401,
        'epoch change invalidates the actual session before the later CSRF check');
    f.revoke(); assert.equal((await f.request('/api/eos/modules/devices', options)).status, 401); assert.equal(f.writes(), 1);
});

test('first-login password requirement and invalid expired sessions do not expose configuration', async t => {
    const f = await fixture(t); f.first(true);
    assert.equal((await f.request('/api/eos/modules/eebus')).status, 403);
    const page = await f.request('/modules/eebus/'); assert.equal(page.headers.get('location'), '/system/?passwordSetup');
    f.first(false); f.revoke(); assert.equal((await f.request('/api/eos/modules/eebus')).status, 401);
});

test('invalid and oversized module JSON and internal exceptions are contained without leaking bodies', async t => {
    const f = await fixture(t); const status = await (await f.request('/api/eos/modules/devices')).json();
    const headers = { 'content-type': 'application/json', origin: 'https://nexowatt', 'x-nw-csrf': status.csrfToken };
    for (const [body, code] of [['{ "password": "PRIVATE', 400], [JSON.stringify({ config: 'PRIVATE'.repeat(1000) }), 413]]) {
        const response = await f.request('/api/eos/modules/devices', { method: 'PUT', headers, body });
        assert.equal(response.status, code); assert.doesNotMatch(await response.text(), /PRIVATE|SyntaxError|node_modules/);
    }
    const response = await f.request('/api/eos/modules/devices/command', { method: 'POST', headers, body: '{"command":"error"}' });
    assert.equal(response.status, 400); assert.doesNotMatch(await response.text(), /PRIVATE/);
    assert.equal((await f.request('/api/eos/modules/devices')).status, 200);
});
