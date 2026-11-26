/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';

// Actual authenticated HTTP routes, Host and production Backup worker. The
// controller database/history declaration are fixtures; no physical backup,
// external filesystem, database connection or mount is performed.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { mkdtemp, mkdir, readdir, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { EosModuleHost } = require('../src/lib/eosModuleHost');
const { registerEosModuleRoutes } = require('../src/lib/eosModuleHttp');
const { UnifiedSessions } = require('../src/lib/eosUnifiedBoundary');
const { installIdleSession } = require('./fixtures/eos-idle-session.cjs');

async function fixture(t, overrides = {}) {
    const root = await mkdtemp(join(tmpdir(), 'eos-backup-readiness-'));
    const installationDir = join(root, 'iobroker');
    const eosDataDir = join(installationDir, 'iobroker-data', 'eos-admin.0');
    const dataDir = join(eosDataDir, 'modules');
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    const objects = new Map(), states = new Map(), configWrites = [], logs = [];
    const clone = value => value == null ? value : structuredClone(value);
    const encrypt = text => `fixture:${Buffer.from(text).toString('base64')}`;
    const backup = { enabled: true, minimalEnabled: false, ccuEnabled: false, eosProfileEnabled: true,
        cifsEnabled: false, cifsPassword: 'fixture-preserved-storage-secret', futureBackupOption: 'preserve-customer-value', ...overrides };
    const owner = {
        namespace: 'eos-admin.0', instance: 0,
        config: { eosModules: Object.fromEntries(['devices', 'eebus', 'backup', 'ocpp'].map(id => [id,
            { v: 1, encrypted: encrypt(JSON.stringify(id === 'backup' ? backup : { enabled: false })) }])) },
        encrypt, decrypt: text => Buffer.from(text.slice(8), 'base64').toString(),
        log: Object.fromEntries(['warn', 'error', 'info', 'debug'].map(level => [level, message => logs.push({ level, message })])),
        eosOwnership: { canWrite: () => true }, eosLicenseService: { allowsEmbeddedModule: () => true },
        eosMigration: { allowsStartup: () => true },
        eosHostedRuntime: { async getHistoryBackupRequirement() {
            return { provider: 'influxdb2', url: 'http://127.0.0.1:8086', bucket: 'EOS', org: 'EOS' };
        } },
        async getForeignObjectAsync(id) { return clone(objects.get(id)); },
        async getForeignStateAsync(id) { return clone(states.get(id)); },
        async getObjectViewAsync(_design, type, range) {
            return { rows: [...objects.values()].filter(value => value.type === type &&
                value._id >= range.startkey && value._id <= range.endkey).map(value => ({ value: clone(value) })) };
        },
        async setForeignObjectAsync(id, value) {
            objects.set(id, { ...clone(value), _id: id });
            if (id === 'eos-admin.0.modules.backup.configuration') configWrites.push(clone(value));
        },
        async setForeignObjectNotExistsAsync(id, value) { if (!objects.has(id)) await owner.setForeignObjectAsync(id, value); },
        async setForeignStateAsync(id, value, ack) { states.set(id, typeof value === 'object' ? clone(value) : { val: value, ack }); },
        async subscribeForeignObjectsAsync() {}, async subscribeForeignStatesAsync() {}, async unsubscribeForeignStatesAsync() {},
    };
    const host = new EosModuleHost(owner, { baseDir: resolve(__dirname, '..'), dataDir, eosDataDir, installationDir });
    const session = await installIdleSession(owner);
    const authority = new UnifiedSessions(owner, { secure: false, externalOrigin: '',
        resolveAccess: async req => req.headers.cookie === `access_token=${session.token}`
            ? { userId: session.userId, role: 'admin', groups: [] } : { userId: null, role: 'enduser', groups: [] },
        firstLogin: async () => ({ required: false }), getLicense: () => ({ valid: true, coreEnabled: true }) });
    const app = express();
    registerEosModuleRoutes({ app, host, baseDir: resolve(__dirname, '..'), jsonParser: express.json(),
        authorize: req => authority.status(req), csrfAllowed: req => authority.csrfAllowed(req), requestAllowed: req => authority.requestAllowed(req) });
    const server = app.listen(0, '127.0.0.1');
    await new Promise(done => server.once('listening', done));
    const origin = `http://127.0.0.1:${server.address().port}`;
    t.after(async () => {
        await host.stop(); session.cleanup(); server.closeAllConnections();
        await new Promise(done => server.close(done));
        await rm(root, { recursive: true, force: true });
    });
    await host.start();
    let csrf = '';
    const request = async (path = '', method = 'GET', body) => {
        const response = await fetch(`${origin}/api/eos/modules/backup${path}`, { method,
            headers: { cookie: `access_token=${session.token}`, origin, 'content-type': 'application/json', 'x-nw-csrf': csrf },
            ...(body ? { body: JSON.stringify(body) } : {}) });
        const value = await response.json();
        if (value.csrfToken) csrf = value.csrfToken;
        return { status: response.status, body: value };
    };
    return { host, owner, root, dataDir, configWrites, logs, request };
}

test('invalid local backup targets are rejected over real HTTP without replacing the running configuration', { timeout: 15000 }, async t => {
    const f = await fixture(t);
    const first = await f.request();
    assert.equal(first.status, 200);
    assert.equal(first.body.status.active, true);
    const pid = first.body.status.details.process.pid;
    assert.ok(Number.isSafeInteger(pid) && pid !== process.pid);
    const previousConfig = structuredClone(f.owner.config);
    const rejected = [
        { cifsEnabled: true, connectType: 'CIFS' }, // Retained upstream relative share placeholder.
        ...['', 'relative/backup', '/', '/root/private', '/proc/1', '/sys/kernel', '/dev/null', '/tmp/line\nbreak', '/tmp/null\0byte']
            .map(mountedBackupPath => ({ cifsEnabled: true, connectType: 'Copy', mountedBackupPath })),
    ];
    for (const draft of rejected) {
        const saved = await f.request('', 'PUT', { config: { ...first.body.config, ...draft },
            expectedConfigurationRevision: first.body.configurationRevision });
        assert.equal(saved.status, 400);
        assert.equal(saved.body.error, 'EOS_BACKUP_SOURCE_PATH');
        const current = await f.request();
        assert.equal(current.body.status.active, true, 'rejected draft must retain the previous working module');
        assert.equal(current.body.status.details.process.pid, pid);
        assert.equal(current.body.configurationRevision, first.body.configurationRevision);
        assert.deepEqual(current.body.config, first.body.config);
    }
    assert.deepEqual(f.owner.config, previousConfig);
    assert.equal(f.configWrites.length, 0);
    assert.equal(f.host.readConfig('backup').cifsPassword, 'fixture-preserved-storage-secret');
    assert.equal(f.host.readConfig('backup').futureBackupOption, 'preserve-customer-value');
    assert.deepEqual(await readdir(join(f.dataDir, 'backup', 'jobs')), []);
});

test('an active Backup process with uncovered Influx history refuses a total backup before starting a job', { timeout: 15000 }, async t => {
    const f = await fixture(t);
    const first = (await f.request()).body;
    assert.equal(first.status.active, true);
    assert.equal(first.status.details.coverage.complete, false);
    assert.deepEqual(first.status.details.coverage.missing, ['EOS_BACKUP_ACTIVE_INFLUX_NOT_COVERED']);
    assert.equal(first.status.details.encrypted, true);
    assert.equal(first.status.details.recoveryKeyAvailable, true);
    const started = await f.request('/command', 'POST', { command: 'start', payload: {} });
    assert.equal(started.status, 400);
    assert.equal(started.body.error, 'EOS_BACKUP_ACTIVE_INFLUX_NOT_COVERED');
    const current = (await f.request()).body;
    assert.equal(current.status.active, true);
    assert.equal(current.status.details.process.pid, first.status.details.process.pid);
    assert.equal(current.status.details.current, null);
    assert.deepEqual(current.status.details.history, []);
    assert.deepEqual(await readdir(join(f.dataDir, 'backup', 'jobs')), []);
    assert.equal(f.configWrites.length, 0);
});

test('a corrected explicit local target can be saved without losing masked credentials or bypassing history coverage', { timeout: 15000 }, async t => {
    const f = await fixture(t);
    const first = (await f.request()).body;
    const invalid = { ...first.config, cifsEnabled: true, connectType: 'Copy', mountedBackupPath: 'relative/backup' };
    const rejected = await f.request('', 'PUT', { config: invalid, expectedConfigurationRevision: first.configurationRevision });
    assert.equal(rejected.body.error, 'EOS_BACKUP_SOURCE_PATH');
    const destination = join(f.root, 'configured-local-target');
    await mkdir(destination, { mode: 0o700 });
    const saved = await f.request('', 'PUT', { config: { ...invalid, mountedBackupPath: destination },
        expectedConfigurationRevision: first.configurationRevision });
    assert.equal(saved.status, 200);
    await f.host.reconcile();
    const current = (await f.request()).body;
    assert.equal(current.configurationReady, true);
    assert.equal(current.status.active, true);
    assert.notEqual(current.status.details.process.pid, first.status.details.process.pid);
    assert.equal(current.config.mountedBackupPath, destination);
    assert.equal(f.host.readConfig('backup').cifsPassword, 'fixture-preserved-storage-secret');
    assert.equal(f.host.readConfig('backup').futureBackupOption, 'preserve-customer-value');
    assert.equal(f.configWrites.length, 1);
    assert.equal(JSON.stringify(f.configWrites).includes('fixture-preserved-storage-secret'), false);
    assert.equal(current.status.details.coverage.complete, false);
    assert.deepEqual(current.status.details.coverage.missing, ['EOS_BACKUP_ACTIVE_INFLUX_NOT_COVERED']);
    assert.deepEqual(await readdir(destination), [], 'saving a target never starts a backup or mounts a filesystem');
});

test('an invalid saved target reports a configuration error and cannot advertise an active Backup worker', async t => {
    const f = await fixture(t, { cifsEnabled: true, connectType: 'Copy', mountedBackupPath: 'relative/backup' });
    const view = (await f.request()).body;
    assert.equal(view.configurationReady, false);
    assert.equal(view.configurationReason, 'EOS_BACKUP_SOURCE_PATH');
    assert.equal(view.status.active, false);
    assert.equal(view.status.reason, 'CONFIG_INVALID');
    assert.equal(view.status.details.process.pid, null);
    assert.equal(view.status.details.process.lastError, 'EOS_BACKUP_SOURCE_PATH');
    assert.equal(f.configWrites.length, 0);
    assert.deepEqual(await readdir(f.dataDir), []);
});
