'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { generateKeyPairSync, randomBytes, randomUUID } = require('node:crypto');
const { validateConfig } = require('../build/config');
const { influxTargets } = require('../build/databaseTargets');
const { backupCoverage, historyRequirement, assertBackupCoverage } = require('../build/coverage');
const { validateInfluxExport, inventoryInflux, exportInflux2 } = require('../build/influxIntegrity');
const { validatePublicTrust, archivePublicTrust, capturePublicTrust } = require('../build/publicTrust');
const { validatePostgresProfile } = require('../build/postgresHistory');
const { encryptFile, hashFile } = require('../build/files');
const { prepareRestoreSet } = require('../build/restore-cli');
const command = require('../build/command');
const temp = () => fs.mkdtemp(path.join(os.tmpdir(), 'eos-backup-completeness-'));
const required = { provider: 'influxdb2', url: 'http://127.0.0.1:8086', bucket: 'EOS', org: 'NexoWatt' };
const config = () => validateConfig({ enabled: true, influxDBEnabled: true, influxDBVersion: '2.x', influxDBPort: '8086', influxDBName: 'EOS', influxDBOrganization: 'NexoWatt' });
const identity = { id: '1234567890abcdef', orgId: 'abcdef1234567890', name: 'EOS' };
const bucket = () => ({ bucketID: identity.id, organizationID: identity.orgId, organizationName: 'NexoWatt', bucketName: 'EOS', retentionPolicies: [] });
async function manifest(dir, change = () => {}) {
    const value = { manifestVersion: 2, kv: { fileName: 'snapshot.kv', size: 4, compression: 1 }, buckets: [bucket()] };
    await fs.writeFile(path.join(dir, 'snapshot.kv'), 'data');
    change(value);
    await fs.writeFile(path.join(dir, 'snapshot.manifest'), JSON.stringify(value));
}
test('complete coverage follows the actual historian and refuses disabled/other/missing sources', () => {
    assert.equal(backupCoverage(config(), required).complete, true);
    for (const patch of [{ influxDBEnabled: false }, { influxDBHost: 'otherhost' }, { influxDBName: 'another' }, { influxDBOrganization: 'otherorg' }, { influxDBVersion: '1.x' }]) {
        assert.throws(() => assertBackupCoverage({ ...config(), ...patch }, required), /ACTIVE_INFLUX_NOT_COVERED/);
    }
    assert.throws(() => assertBackupCoverage({ ...config(), eosProfileEnabled: false }, { provider: 'none' }), /EOS_PROFILE_REQUIRED/);
    assert.throws(() => assertBackupCoverage(config(), historyRequirement(undefined)), /SCOPE_UNRESOLVED/);
    assert.throws(() => assertBackupCoverage(config(), { provider: 'adapter', instance: 'sql.0' }), /SCOPE_UNRESOLVED/);
    assert.equal(backupCoverage(config(), { provider: 'none' }).complete, true);
    assert.deepEqual(backupCoverage(config(), { provider: 'postgresql', namespace: 'eos-admin.0' }).required, ['iobroker', 'eos-profile', 'postgresql-history']);
    assert.equal(backupCoverage(config(), required).externalTargetConfigured, false);
    assert.deepEqual(historyRequirement({ ...required, url: 'https://token@example.test' }), { provider: 'unknown' });
});
test('multi target normalization uses the same inherited v2 version and fails invalid modes before running', () => {
    const input = { ...config(), influxDBMulti: true, influxDBEvents: [{ dbName: 'EOS', host: '127.0.0.1' }, { dbName: 'other', dbversion: '1.x', port: '8088' }] };
    const before = JSON.stringify(input), targets = influxTargets(input);
    assert.equal(targets[0].version, '2.x'); assert.equal(targets[0].url, 'http://127.0.0.1:8086');
    assert.equal(targets[1].version, '1.x'); assert.equal(JSON.stringify(input), before);
    assert.throws(() => validateConfig({ ...input, influxDBEvents: [{ dbversion: '3.x' }] }), /INFLUX_VERSION/);
    assert.throws(() => influxTargets({ ...input, influxDBEvents: [] }), /EVENTS/);
    assert.throws(() => influxTargets({ ...input, influxDBEvents: [{ host: 'host; echo x' }] }), /HOST/);
});
test('existing empty Influx bucket is a valid snapshot, with exact files and active organization proof', async () => {
    const dir = await temp();
    try {
        await manifest(dir);
        const proof = await validateInfluxExport(dir, [identity], required);
        assert.deepEqual(proof.buckets, [identity]); assert.equal(proof.files[0].size, 4);
        assert.match(proof.files[0].sha256, /^[a-f0-9]{64}$/);
        assert.equal((await fs.stat(path.join(dir, 'eos-export-proof.json'))).mode & 0o777, 0o600);
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('Influx zero-exit metadata-only, wrong organization, damaged/missing shard and unreferenced files cannot prove completion', async t => {
    const cases = [
        ['missing active bucket', v => { v.buckets = []; }, /BUCKET_CONTENT_MISSING/],
        ['wrong organization id', v => { v.buckets[0].organizationID = 'ffffffffffffffff'; }, /BUCKET_CONTENT_MISSING/],
        ['wrong organization name', v => { v.buckets[0].organizationName = 'Wrong'; }, /ACTIVE_INFLUX_CONTENT_MISSING/],
        ['changed bucket name', v => { v.buckets[0].bucketName = 'Wrong'; }, /BUCKET_CONTENT_MISSING/],
        ['wrong size', v => { v.kv.size = 5; }, /FILE_SIZE/],
        ['unsafe path', v => { v.kv.fileName = '../escape'; }, /FILE_ENTRY/],
        ['coercible compression', v => { v.kv.compression = null; }, /FILE_ENTRY/],
        ['missing shard', v => { v.buckets[0].retentionPolicies = [{ shardGroups: [{ shards: [{ fileName: 'missing.tar.gz', size: 9, compression: 1 }] }] }]; }, /ENOENT/],
    ];
    for (const [name, mutate, error] of cases) await t.test(name, async () => {
        const dir = await temp(); try { await manifest(dir, mutate); await assert.rejects(() => validateInfluxExport(dir, [identity], required), error); }
        finally { await fs.rm(dir, { recursive: true, force: true }); }
    });
    const dir = await temp(); try {
        await manifest(dir); await fs.writeFile(path.join(dir, 'unreferenced'), 'extra');
        await assert.rejects(() => validateInfluxExport(dir, [identity], required), /UNREFERENCED_FILE/);
        await fs.rm(path.join(dir, 'unreferenced')); await fs.symlink('snapshot.kv', path.join(dir, 'link'));
        await assert.rejects(() => validateInfluxExport(dir, [identity], required), /INFLUX_FILES/);
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('Influx inventory and actual backup bind IDs, propagate token only via environment and verify the result', async () => {
    const dir = await temp(), folder = path.join(dir, 'snapshot'); await fs.mkdir(folder);
    const oldRun = command.run, oldExe = command.executable, calls = [];
    const target = { ...influxTargets(config())[0], token: 'fixture-only-secret' };
    command.executable = async name => { assert.equal(name, 'influx'); return '/fixed/influx'; };
    command.run = async (exe, args, options) => {
        calls.push(args); assert.equal(exe, '/fixed/influx'); assert.equal(options.environment.INFLUX_TOKEN, target.token); assert(!args.includes(target.token));
        if (args[0] === 'bucket') await fs.writeFile(options.output, JSON.stringify([{ id: identity.id, orgID: identity.orgId, name: identity.name }]));
        else { assert.deepEqual(args.slice(-3), ['--bucket-id', identity.id, folder]); await manifest(folder); }
    };
    try {
        await exportInflux2(target, folder, dir, 0, required);
        assert.equal(calls.length, 2); assert.equal((await fs.readdir(dir)).includes('influx-inventory-0.json'), false);
        await fs.rm(folder, { recursive: true }); await fs.mkdir(folder);
        command.run = async (exe, args, options) => fs.writeFile(options.output, '[]');
        await assert.rejects(() => inventoryInflux(target, dir, 0), /BUCKET_MISSING_OR_AMBIGUOUS/);
        command.run = async (exe, args, options) => fs.writeFile(options.output, JSON.stringify([
            { id: identity.id, orgID: identity.orgId, name: identity.name }, { id: 'aaaaaaaaaaaaaaaa', orgID: identity.orgId, name: identity.name }
        ]));
        await assert.rejects(() => inventoryInflux(target, dir, 0), /AMBIGUOUS/);
    } finally { command.run = oldRun; command.executable = oldExe; await fs.rm(dir, { recursive: true, force: true }); }
});
test('public trust is backed up as public evidence only and invalid/private material cannot become recovery authority', async () => {
    const dir = await temp(), pair = generateKeyPairSync('ed25519');
    const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    try {
        assert.deepEqual(validatePublicTrust({ manufacturer: publicKey }), { manufacturer: publicKey });
        await archivePublicTrust(dir, { manufacturer: publicKey });
        const instructions = JSON.parse(await fs.readFile(path.join(dir, 'recovery-public-trust-instructions.json')));
        assert.equal(instructions.automaticTrustInstallation, false);
        assert.match(instructions.fingerprints.manufacturer, /^[a-f0-9]{64}$/);
        assert.throws(() => validatePublicTrust({ manufacturer: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() }), /PUBLIC_TRUST_INVALID/);
        assert.throws(() => validatePublicTrust({}), /PUBLIC_TRUST_INVALID/);
        const service = require('../../../build/lib/eosLicenseService'), old = service.readProductTrust;
        try {
            service.readProductTrust = async () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }); };
            assert.equal(await capturePublicTrust(), null);
            service.readProductTrust = async () => { throw Object.assign(new Error('permissions'), { code: 'TRUST_PERMISSIONS' }); };
            await assert.rejects(capturePublicTrust, /PUBLIC_TRUST_UNAVAILABLE/);
        } finally { service.readProductTrust = old; }
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('managed PostgreSQL backup accepts only provisioned local separate role and fixed TLS profile', () => {
    const profile = { schemaVersion: 1, provider: 'postgresql', provisioned: true, newInstallation: true, host: '127.0.0.1', port: 55432, database: 'eos_history_0', user: 'eos_history_0_backup', password: 'x'.repeat(40), caFile: '/etc/nexowatt-eos/postgresql/ca.crt', servername: 'localhost', schema: 'eos_history' };
    assert.equal(validatePostgresProfile(profile, 'eos-admin.0').user, 'eos_history_0_backup');
    for (const patch of [{ host: 'remote.test' }, { port: 5432 }, { user: 'postgres' }, { newInstallation: false }, { caFile: '/tmp/ca' }, { password: 'weak' }]) assert.throws(() => validatePostgresProfile({ ...profile, ...patch }, 'eos-admin.0'), /POSTGRES_PROFILE/);
    assert.throws(() => validatePostgresProfile(profile, '../escape'), /NAMESPACE/);
});
async function recoveryFixture(dir) {
    const key = randomBytes(32), jobId = randomUUID(), keyfile = path.join(dir, 'key.json');
    await fs.writeFile(keyfile, JSON.stringify({ format: 'nexowatt-eos-recovery-key/v1', key: key.toString('base64') }));
    const files = [];
    for (const kind of ['iobroker', 'eos-profile', 'influxDB']) {
        const source = path.join(dir, kind); await fs.writeFile(source, 'restored ' + kind);
        const name = `eos-backup-${jobId}-${kind}-${files.length}.nwb`;
        await encryptFile(source, path.join(dir, name), key, 1024);
        files.push({ kind, name, size: (await fs.stat(path.join(dir, name))).size, sha256: await hashFile(path.join(dir, name)) });
    }
    const value = { format: 'nexowatt-eos-recovery-set/v1', jobId, coverage: backupCoverage(config(), required), files };
    const setPath = path.join(dir, `eos-backup-${jobId}-recovery-set-3.nwb`);
    const seal = async () => { const source = path.join(dir, 'set.json'); await fs.writeFile(source, JSON.stringify(value)); await fs.rm(setPath, { force: true }); await encryptFile(source, setPath, key, 1024 ** 2); };
    await seal(); return { keyfile, files, value, setPath, seal };
}
test('offline recovery prepares every verified member of one set without changing active data', async () => {
    const dir = await temp(); try {
        const fixture = await recoveryFixture(dir), output = path.join(dir, 'prepared');
        const planPath = await prepareRestoreSet(fixture.setPath, fixture.keyfile, output);
        const plan = JSON.parse(await fs.readFile(planPath));
        assert.equal(plan.verified, true); assert.equal(plan.automaticRestore, false); assert.equal(plan.controllerMustBeStopped, true);
        for (const file of plan.files) assert.equal(await fs.readFile(path.join(output, file.file), 'utf8'), 'restored ' + file.kind);
        await assert.rejects(() => prepareRestoreSet(fixture.setPath, fixture.keyfile, output), /EEXIST/);
        assert.equal(JSON.parse(await fs.readFile(planPath)).jobId, fixture.value.jobId);
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('offline recovery rejects incomplete, mixed-job and damaged sets and cleans only new staging', async t => {
    for (const scenario of ['missing', 'tampered', 'mixed-job', 'required-missing', 'wrong-key']) await t.test(scenario, async () => {
        const dir = await temp(); try {
            const f = await recoveryFixture(dir), output = path.join(dir, 'failed');
            if (scenario === 'missing') await fs.rm(path.join(dir, f.files[1].name));
            if (scenario === 'tampered') await fs.appendFile(path.join(dir, f.files[1].name), 'damaged');
            if (scenario === 'mixed-job') { f.value.files[0].name = f.value.files[0].name.replace(f.value.jobId, randomUUID()); await f.seal(); }
            if (scenario === 'required-missing') { f.value.files.pop(); await f.seal(); }
            if (scenario === 'wrong-key') await fs.writeFile(f.keyfile, JSON.stringify({ format: 'nexowatt-eos-recovery-key/v1', key: randomBytes(32).toString('base64') }));
            await assert.rejects(() => prepareRestoreSet(f.setPath, f.keyfile, output));
            await assert.rejects(() => fs.stat(output), /ENOENT/);
            assert.equal((await fs.stat(f.setPath)).isFile(), true);
        } finally { await fs.rm(dir, { recursive: true, force: true }); }
    });
});
test('retention removes complete sets together even with shorter SD-card Influx retention', () => {
    const { retentionCandidates } = require('../build/storageRetention');
    const entries = [], groups = [];
    for (let n = 0; n < 5; n++) {
        const id = randomUUID(), names = ['iobroker', 'eos-profile', 'influxDB', 'postgresql-history', 'recovery-set'].map((kind, i) => `eos-backup-${id}-${kind}-${i}.nwb`);
        groups.push(names); entries.push(...names.map(name => ({ name, id: name, size: 100, mtime: 1000 + n })));
    }
    const settings = { ...config(), cifsDeleteOldBackup: true, connectType: 'SDCard', minimalDeleteAfter: 30, sdCardInfluxRetention: 3 };
    const selected = retentionCandidates(settings, 'cifs', 'iobroker', entries, groups[4]);
    assert.deepEqual(new Set(selected.map(e => e.name)), new Set([...groups[0], ...groups[1]]));
    assert.deepEqual(retentionCandidates({ ...settings, sdCardInfluxRetention: 0 }, 'cifs', 'iobroker', entries, groups[4]), []);
    assert.throws(() => retentionCandidates(settings, 'cifs', 'iobroker', entries.slice(0, -1), groups[4]), /INCOMPLETE/);
});
test('offline recovery refuses insufficient free space before writing component data', async () => {
    const dir = await temp(), preflight = require('../build/preflight'), original = preflight.assertFreeSpace;
    try {
        const f = await recoveryFixture(dir), output = path.join(dir, 'no-space');
        preflight.assertFreeSpace = async () => { throw new Error('EOS_BACKUP_DISK_SPACE'); };
        await assert.rejects(() => prepareRestoreSet(f.setPath, f.keyfile, output), /DISK_SPACE/);
        await assert.rejects(() => fs.stat(output), /ENOENT/);
        assert.equal((await fs.stat(f.setPath)).isFile(), true);
    } finally { preflight.assertFreeSpace = original; await fs.rm(dir, { recursive: true, force: true }); }
});
