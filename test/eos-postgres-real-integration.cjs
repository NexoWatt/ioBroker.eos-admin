'use strict';
// Opt-in real PostgreSQL acceptance test. No root, package installation,
// production profile, system service or external device is used.
// EOS_TEST_PG_BIN points to a PostgreSQL 17 bin directory; EOS_TEST_PG_SHARE
// optionally points to the matching share directory for an extracted package.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const net = require('node:net');
const { createRequire, Module } = require('node:module');
const { Client } = require('pg');
const ts = require('typescript');
const setup = require('../tools/system/eos-postgresql-setup.cjs');
const bin = process.env.EOS_TEST_PG_BIN;

function loadHistorian() {
    const file = path.resolve(__dirname, '../ui/src-ts/runtime-executables/lib/postgres-history.ts');
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const loaded = new Module(file, module);
    loaded.filename = file;
    loaded.paths = module.paths;
    loaded.require = createRequire(file);
    loaded._compile(compiled, file);
    return loaded.exports;
}

test('real PostgreSQL: protected role/schema templates, TLS, historian and dump/restore', {
    skip: !bin ? 'Set EOS_TEST_PG_BIN to run against an isolated PostgreSQL 17 server' : false,
    timeout: 90000,
}, async t => {
    assert.notEqual(process.getuid?.(), 0, 'Run the isolated cluster as an ordinary user');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-pg-test-'));
    const data = path.join(root, 'data'), socket = path.join(root, 'socket');
    fs.mkdirSync(socket, { mode: 0o700 });
    const user = os.userInfo().username;
    const runtimePassword = crypto.randomBytes(32).toString('hex');
    const backupPassword = crypto.randomBytes(32).toString('hex');
    const maintenancePassword = crypto.randomBytes(32).toString('hex');
    const tlsEnvironment = { PGPASSWORD: maintenancePassword, PGSSLMODE: 'verify-full', PGSSLROOTCERT: path.join(root, 'ca.crt'), PGCONNECT_TIMEOUT: '5' };
    let started = false;
    const clients = new Set();
    const histories = new Set();
    function run(program, args, input, env = {}) {
        return execFileSync(program, args, { cwd: root, input, encoding: 'utf8', timeout: 20000,
            stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 4 * 1024 * 1024, env: { ...process.env, ...env } });
    }
    function pg(program, args, input, env) { return run(path.join(bin, program), args, input, env); }
    function sql(text, database = 'postgres') {
        return pg('psql', ['--no-psqlrc', '--no-password', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1',
            '-p', '55432', '-U', user, '-d', database, '-tA'], text, tlsEnvironment);
    }
    async function connect(config) {
        const client = new Client(config);
        clients.add(client);
        await client.connect();
        return client;
    }
    const { PostgresHistoryClient, postgresPoolConfig, validatePostgresProfile } = loadHistorian();
    try {
        t.diagnostic(pg('postgres', ['--version']).trim());
        fs.writeFileSync(path.join(root, 'maintenance-password'), maintenancePassword + '\n', { mode: 0o600 });
        const init = ['-D', data, '--no-locale', '--encoding=UTF8', '--auth-local=peer', '--auth-host=scram-sha-256', '-U', user,
            '--pwfile', path.join(root, 'maintenance-password')];
        if (process.env.EOS_TEST_PG_SHARE) init.push('-L', process.env.EOS_TEST_PG_SHARE);
        pg('initdb', init);
        for (const name of ['ca', 'other-ca']) {
            run('openssl', ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes',
                '-keyout', `${name}.key`, '-out', `${name}.crt`, '-days', '2', '-subj', `/CN=${name}`,
                '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign']);
        }
        run('openssl', ['req', '-new', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes',
            '-keyout', 'server.key', '-out', 'server.csr', '-subj', '/CN=localhost']);
        fs.chmodSync(path.join(root, 'server.key'), 0o600);
        fs.writeFileSync(path.join(root, 'server.ext'), 'subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n');
        run('openssl', ['x509', '-req', '-in', 'server.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-set_serial', '1',
            '-out', 'server.crt', '-days', '2', '-sha256', '-extfile', 'server.ext']);
        const config = setup.postgresConfig()
            .replaceAll('/var/lib/nexowatt-postgresql/data', data)
            .replaceAll('/etc/nexowatt-postgresql', root)
            // This workspace prohibits AF_UNIX sockets. Only test maintenance
            // transport changes to verified TLS/SCRAM; product hba is unchanged.
            .replaceAll("unix_socket_directories = '/run/nexowatt-postgresql'", "unix_socket_directories = ''");
        fs.writeFileSync(path.join(root, 'postgresql.conf'), config);
        fs.writeFileSync(path.join(root, 'pg_hba.conf'), setup.hbaConfig().replaceAll('nexowatt-pg', user));
        fs.writeFileSync(path.join(root, 'pg_ident.conf'), '');
        try {
            pg('pg_ctl', ['-D', data, '-l', path.join(root, 'server.log'), '-o', `-c config_file=${root}/postgresql.conf`, '-w', 'start']);
        } catch (error) {
            t.diagnostic(fs.readFileSync(path.join(root, 'server.log'), 'utf8'));
            throw error;
        }
        started = true;
        sql(setup.rolesSql('eos-admin.0', runtimePassword, backupPassword));
        sql(setup.schemaSql('eos-admin.0'), 'eos_history_0');
        sql(setup.rolesSql('eos-admin.1', crypto.randomBytes(32).toString('hex'), crypto.randomBytes(32).toString('hex')));
        sql(setup.schemaSql('eos-admin.1'), 'eos_history_1');
        const profile = validatePostgresProfile(setup.profile('eos-admin.0', 'runtime', runtimePassword), 'eos-admin.0');
        const connection = { profile, caCertificate: fs.readFileSync(path.join(root, 'ca.crt'), 'utf8') };
        const runtimeConfig = postgresPoolConfig(connection);
        const runtime = await connect(runtimeConfig);
        let admin = await connect({ ...runtimeConfig, user, password: maintenancePassword });
        const historian = new PostgresHistoryClient('eos-admin.0', async () => connection);
        histories.add(historian);
        const time = Math.floor((Date.now() - 10000) / 4000) * 4000;
        const points = [
            { id: 'eos-admin.0.test.power', ts: time, val: -12.5 },
            { id: 'eos-admin.0.test.power', ts: time + 1000, val: 0 },
            { id: 'eos-admin.0.test.power', ts: time + 2000, val: 40 },
            { id: 'eos-admin.0.test.flag', ts: time, val: false },
            { id: 'eos-admin.0.test.text', ts: time, val: "ÄÖ value '; DROP TABLE eos_history.samples; --" },
        ];
        await t.test('runtime negotiates verified TLS and has no administrative privilege', async () => {
            const row = (await runtime.query('SELECT ssl, version FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows[0];
            assert.equal(row.ssl, true); assert.equal(row.version, 'TLSv1.3');
            assert.equal((await admin.query('SHOW listen_addresses')).rows[0].listen_addresses, '127.0.0.1');
            let ownAddress;
            try { ownAddress = Object.values(os.networkInterfaces()).flat().find(address => address && !address.internal && address.family === 'IPv4'); }
            catch { t.diagnostic('Workspace prohibits interface inventory; no external-interface connection probe performed.'); }
            if (ownAddress) await assert.rejects(new Promise((resolve, reject) => {
                const probe = net.connect({ host: ownAddress.address, port: 55432 });
                probe.once('connect', () => { probe.destroy(); resolve(); });
                probe.once('error', reject);
                probe.setTimeout(1000, () => { probe.destroy(); reject(new Error('local-interface-connect-timeout')); });
            }), error => error.code === 'ECONNREFUSED');
            else t.diagnostic('No non-loopback local IPv4 available; bind policy verified by SHOW only.');
            const role = (await runtime.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication FROM pg_roles WHERE rolname=current_user')).rows[0];
            assert.deepEqual(role, { rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false });
            for (const text of ['CREATE SCHEMA forbidden', 'CREATE TEMP TABLE forbidden(x int)', 'CREATE TABLE eos_history.forbidden(x int)',
                'DELETE FROM eos_history.samples', 'DROP TABLE eos_history.samples', 'CREATE ROLE forbidden', 'SET ROLE eos_history_0_owner']) {
                await assert.rejects(runtime.query(text), error => error.code === '42501');
            }
        });
        await t.test('plaintext, untrusted CA, wrong hostname, bad password and other instance are rejected', async () => {
            for (const changed of [
                { ...runtimeConfig, ssl: false },
                postgresPoolConfig({ ...connection, caCertificate: fs.readFileSync(path.join(root, 'other-ca.crt'), 'utf8') }),
                postgresPoolConfig({ ...connection, profile: { ...profile, servername: 'not-this-server.invalid' } }),
                { ...runtimeConfig, password: 'wrong-password' },
                { ...runtimeConfig, database: 'eos_history_1' },
                { ...runtimeConfig, database: 'postgres' },
                { ...runtimeConfig, database: 'postgres', user: 'eos_history_0_backup', password: backupPassword },
            ]) {
                const client = new Client(changed);
                try { await assert.rejects(client.connect()); } finally { await client.end().catch(() => {}); }
            }
        });
        await t.test('historian writes/query values, extrema, aggregates and upsert without injection', async () => {
            await historian.write(points);
            assert.deepEqual(await historian.check(), { reachable: true, readable: true });
            const options = { start: time, end: time + 4000, limit: 100 };
            assert.deepEqual((await historian.query(points[0].id, options)).result, points.slice(0, 3).map(({ts,val}) => ({ts,val})));
            assert.deepEqual((await historian.query(points[3].id, options)).result, [{ ts: time, val: false }]);
            assert.deepEqual((await historian.query(points[4].id, options)).result, [{ ts: time, val: points[4].val }]);
            assert.deepEqual((await historian.query(points[0].id, { ...options, aggregate: 'average', step: 4000 })).result,
                [{ ts: time, val: 27.5 / 3 }]);
            assert.deepEqual((await historian.query(points[0].id, { ...options, aggregate: 'minmax', limit: 2 })).result,
                [{ ts: time, val: -12.5 }, { ts: time + 2000, val: 40 }]);
            assert.deepEqual((await historian.query(points[0].id, { ...options, aggregate: 'count', step: 4000 })).result,
                [{ ts: time, val: 3 }]);
            await historian.write([{ ...points[0], val: -15 }]);
            assert.equal((await historian.query(points[0].id, options)).result[0].val, -15);
            await historian.write([{ ...points[0], val: -16 }, { ...points[0], val: -15 }]);
            assert.equal((await historian.query(points[0].id, options)).result[0].val, -15,
                'two captured events at the same millisecond preserve the latest value without losing the batch');
            assert.equal((await runtime.query('SELECT count(*)::int AS n FROM eos_history.samples')).rows[0].n, 5);
        });
        await t.test('query deadline destroys blocked connection and subsequent requests recover', async () => {
            await admin.query('BEGIN');
            await admin.query('LOCK TABLE eos_history.samples IN ACCESS EXCLUSIVE MODE');
            const began = performance.now();
            try {
                await assert.rejects(historian.query(points[0].id, { start: time, end: time + 4000 }, 80),
                    error => error.code === 'EOS_POSTGRES_TIMEOUT');
                assert.ok(performance.now() - began < 800, 'deadline returned promptly');
            } finally { await admin.query('ROLLBACK'); }
            assert.equal((await historian.query(points[0].id, { start: time, end: time + 4000 })).result.length, 3);
        });
        await t.test('backup role is read-only; verified TLS dump restores actual typed samples', async () => {
            const backup = await connect({ ...runtimeConfig, user: 'eos_history_0_backup', password: backupPassword });
            assert.equal((await backup.query('SELECT count(*)::int AS n FROM eos_history.samples')).rows[0].n, 5);
            await assert.rejects(backup.query('INSERT INTO eos_history.samples(id,ts,value_type,value_number) VALUES ($1,1,0,1)', ['forbidden']),
                error => error.code === '25006' || error.code === '42501');
            await backup.query('SET default_transaction_read_only = off');
            await assert.rejects(backup.query('UPDATE eos_history.samples SET value_number=99 WHERE value_type=0'), error => error.code === '42501');
            const folder = path.join(root, 'backup');
            fs.mkdirSync(folder, { mode: 0o700 });
            const command = require('../modules/backup/build/command.js');
            const { exportVerifiedPostgresProfile } = require('../modules/backup/build/postgresHistory.js');
            const realRun = command.run, realExecutable = command.executable;
            // Only the fixed binary installation and CA path are adapted for the
            // unprivileged extracted-package fixture. Argument generation,
            // bounded process runner, TLS flags and archive validation are real.
            command.executable = async name => { assert.equal(name, 'pg_dump'); return path.join(bin, name); };
            command.run = (exe, args, opts) => realRun(exe, args, { ...opts,
                environment: { ...opts.environment, LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH || '' } });
            const backupProfile = { ...setup.profile('eos-admin.0', 'backup', backupPassword), caFile: path.join(root, 'ca.crt') };
            try {
                await exportVerifiedPostgresProfile(backupProfile, 'eos-admin.0', folder);
                const rejected = path.join(root, 'rejected-backup');
                fs.mkdirSync(rejected, { mode: 0o700 });
                await assert.rejects(exportVerifiedPostgresProfile({ ...backupProfile, caFile: path.join(root, 'other-ca.crt') },
                    'eos-admin.0', rejected));
                assert.equal(fs.existsSync(path.join(rejected, 'database.dump')), false, 'rejected TLS removes incomplete dump');
            } finally { command.run = realRun; command.executable = realExecutable; }
            const dump = path.join(folder, 'database.dump');
            assert.ok(fs.statSync(dump).size > 1000);
            const requirements = JSON.parse(fs.readFileSync(path.join(folder, 'restore-requirements.json'), 'utf8'));
            assert.equal(requirements.tls, 'verify-full');
            assert.equal(requirements.containsRolePasswords, false);
            assert.equal(fs.statSync(dump).mode & 0o777, 0o600);
            assert.match(pg('pg_restore', ['--list', dump]), /TABLE DATA eos_history samples/);
            sql('CREATE DATABASE eos_history_restore OWNER eos_history_0_owner;');
            sql(setup.schemaSql('eos-admin.0'), 'eos_history_restore');
            const restorePassword = crypto.randomBytes(32).toString('hex');
            sql(`CREATE ROLE eos_restore_login LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT PASSWORD '${restorePassword}';
REVOKE ALL ON DATABASE eos_history_restore FROM PUBLIC;
GRANT CONNECT ON DATABASE eos_history_restore TO eos_restore_login;`);
            sql('GRANT USAGE ON SCHEMA eos_history TO eos_restore_login; GRANT SELECT, INSERT ON eos_history.samples TO eos_restore_login;', 'eos_history_restore');
            pg('pg_restore', ['--host', '127.0.0.1', '--port', '55432', '--username', 'eos_restore_login', '--dbname', 'eos_history_restore',
                '--no-password', '--exit-on-error', '--data-only', '--no-owner', '--no-acl', '--schema=eos_history', '--table=samples',
                dump], undefined, { ...tlsEnvironment, PGPASSWORD: restorePassword });
            const expected = sql('SELECT row_to_json(s) FROM eos_history.samples s ORDER BY id, ts;', 'eos_history_0');
            const restored = sql('SELECT row_to_json(s) FROM eos_history.samples s ORDER BY id, ts;', 'eos_history_restore');
            assert.equal(restored, expected);
        });
        await t.test('reapplying schema templates preserves saved measurements and runtime grants', async () => {
            sql(setup.schemaSql('eos-admin.0'), 'eos_history_0');
            assert.equal((await runtime.query('SELECT count(*)::int AS n FROM eos_history.samples')).rows[0].n, 5);
            await historian.write([{ id: 'eos-admin.0.test.after-update', ts: time, val: 7 }]);
            assert.equal((await runtime.query('SELECT count(*)::int AS n FROM eos_history.samples')).rows[0].n, 6);
        });
        await t.test('database restart preserves historian points and fresh clients can continue recording', async () => {
            for (const previous of histories) previous.close();
            histories.clear();
            await Promise.all([...clients].map(client => client.end()));
            clients.clear();
            pg('pg_ctl', ['-D', data, '-l', path.join(root, 'server.log'), '-m', 'fast', '-w', 'restart']);
            admin = await connect({ ...runtimeConfig, user, password: maintenancePassword });
            const fresh = new PostgresHistoryClient('eos-admin.0', async () => connection);
            histories.add(fresh);
            assert.deepEqual((await fresh.query('eos-admin.0.test.after-update', { start: time, end: time + 4000 })).result,
                [{ ts: time, val: 7 }]);
            await fresh.write([{ id: 'eos-admin.0.test.after-restart', ts: time, val: true }]);
            assert.deepEqual((await fresh.query('eos-admin.0.test.after-restart', { start: time, end: time + 4000 })).result,
                [{ ts: time, val: true }]);
            assert.equal((await admin.query('SELECT count(*)::int AS n FROM eos_history.samples')).rows[0].n, 7);
            assert.equal((await admin.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=$1', ['nexowatt-eos-history'])).rows[0].n, 2);
        });
        await t.test('an expired server certificate is rejected by the actual PostgreSQL TLS connection', async () => {
            run('openssl', ['x509', '-req', '-in', 'server.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-set_serial', '2',
                '-out', 'server.crt', '-not_before', '20200101000000Z', '-not_after', '20210101000000Z', '-sha256', '-extfile', 'server.ext']);
            await admin.query('SELECT pg_reload_conf()');
            let rejected = false;
            for (let attempt = 0; attempt < 20 && !rejected; attempt++) {
                const probe = new Client(runtimeConfig);
                try { await probe.connect(); }
                catch (error) { assert.equal(error.code, 'CERT_HAS_EXPIRED'); rejected = true; }
                finally { await probe.end().catch(() => {}); }
                if (!rejected) await new Promise(resolve => setTimeout(resolve, 20));
            }
            assert.equal(rejected, true);
        });
    } finally {
        for (const historian of histories) historian.close();
        await Promise.allSettled([...clients].map(client => client.end()));
        if (started) pg('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
        fs.rmSync(root, { recursive: true, force: true });
    }
});
