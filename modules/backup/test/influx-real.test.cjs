'use strict';
// Opt-in disposable servers only. Never contacts a configured customer database.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { openSync, closeSync } = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomBytes } = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const command = require('../build/command');
const { exportInflux2 } = require('../build/influxIntegrity');
const serverBinary = process.env.EOS_TEST_INFLUXD, cliBinary = process.env.EOS_TEST_INFLUX;
test('real InfluxDB2: actual export, active bucket proof, isolated restore, empty and missing buckets', {
    skip: !serverBinary || !cliBinary ? 'Set EOS_TEST_INFLUXD and EOS_TEST_INFLUX for isolated real-server acceptance' : false,
    timeout: 120000,
}, async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'eos-influx-real-'));
    const token = randomBytes(48).toString('hex'), targetToken = randomBytes(48).toString('hex');
    const source = 'http://127.0.0.1:19086', destination = 'http://127.0.0.1:19087';
    const children = [], oldExecutable = command.executable;
    async function api(base, url, auth, method = 'GET', body) {
        const response = await fetch(base + url, { method, headers: { Authorization: `Token ${auth}`, 'Content-Type': typeof body === 'string' ? 'text/plain' : 'application/json' }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
        const text = await response.text(); assert(response.ok, `${method} ${url}: HTTP ${response.status}: ${text}`);
        return text ? (text.startsWith('{') ? JSON.parse(text) : text) : null;
    }
    async function start(name, port) {
        const folder = path.join(root, name); await fs.mkdir(folder, { mode: 0o700 });
        const fd = openSync(path.join(folder, 'server.log'), 'wx', 0o600);
        const child = spawn(serverBinary, ['--http-bind-address', `127.0.0.1:${port}`, '--bolt-path', path.join(folder, 'influxd.bolt'), '--sqlite-path', path.join(folder, 'influxd.sqlite'), '--engine-path', path.join(folder, 'engine'), '--reporting-disabled', '--log-level', 'error'], { cwd: folder, stdio: ['ignore', fd, fd], env: { PATH: '/usr/bin:/bin', HOME: folder } });
        closeSync(fd); children.push(child);
        for (let i = 0; i < 200; i++) {
            try { const r = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(300) }); if (r.ok) return; } catch {}
            if (child.exitCode !== null) throw new Error(await fs.readFile(path.join(folder, 'server.log'), 'utf8'));
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        throw new Error('isolated server startup timeout');
    }
    try {
        t.diagnostic((await promisify(execFile)(serverBinary, ['version'])).stdout.trim());
        await start('source', 19086); await start('target', 19087);
        const sourceSetup = await api(source, '/api/v2/setup', token, 'POST', { username: 'fixtureuser', password: 'fixture-only-password-123', org: 'NexoWatt', bucket: 'EOS', token });
        await api(destination, '/api/v2/setup', targetToken, 'POST', { username: 'restoreuser', password: 'fixture-only-password-456', org: 'Restored', bucket: 'initial', token: targetToken });
        const samples = 'meter,device=one watts=611.5,online=true,label="known" 1700000000000000000\nmeter,device=two watts=673.25,online=false,label="second" 1700000001000000000';
        await api(source, '/api/v2/write?org=NexoWatt&bucket=EOS&precision=ns', token, 'POST', samples);
        await api(source, '/api/v2/buckets', token, 'POST', { name: 'Empty', orgID: sourceSetup.org.id, retentionRules: [] });
        const target = { version: '2.x', host: '127.0.0.1', port: '19086', protocol: 'http', url: source, bucket: 'EOS', bucketId: '', org: 'NexoWatt', orgId: '', token };
        command.executable = async name => { assert.equal(name, 'influx'); return cliBinary; };
        const snapshot = path.join(root, 'snapshot'); await fs.mkdir(snapshot);
        await exportInflux2(target, snapshot, root, 0, { provider: 'influxdb2', url: source, bucket: 'EOS', org: 'NexoWatt' });
        const proof = JSON.parse(await fs.readFile(path.join(snapshot, 'eos-export-proof.json')));
        assert.equal(proof.buckets.length, 1); assert.equal(proof.buckets[0].name, 'EOS'); assert(proof.files.length >= 3, 'real metadata and shard files');
        await promisify(execFile)(cliBinary, ['restore', '--host', destination, '--org', 'NexoWatt', '--bucket', 'EOS', '--new-org', 'Restored', '--new-bucket', 'EOS', snapshot], { cwd: root, env: { PATH: '/usr/bin:/bin', HOME: root, INFLUX_TOKEN: targetToken }, timeout: 20000 });
        const query = 'from(bucket: "EOS") |> range(start: 2023-01-01T00:00:00Z, stop: 2024-01-01T00:00:00Z) |> sort(columns:["_time"])';
        const original = await api(source, '/api/v2/query?org=NexoWatt', token, 'POST', { query, type: 'flux' });
        const restored = await api(destination, '/api/v2/query?org=Restored', targetToken, 'POST', { query, type: 'flux' });
        assert.equal(restored, original); assert.match(restored, /611.5/); assert.match(restored, /673.25/); assert.match(restored, /known/);
        const empty = path.join(root, 'empty'); await fs.mkdir(empty);
        await exportInflux2({ ...target, bucket: 'Empty' }, empty, root, 1);
        assert.equal(JSON.parse(await fs.readFile(path.join(empty, 'eos-export-proof.json'))).buckets[0].name, 'Empty');
        const missing = path.join(root, 'missing'); await fs.mkdir(missing);
        await assert.rejects(() => exportInflux2({ ...target, bucket: 'Deleted' }, missing, root, 2), /BUCKET_MISSING_OR_AMBIGUOUS/);
        assert.deepEqual(await fs.readdir(missing), []);
        const whole = path.join(root, 'whole'); await fs.mkdir(whole);
        await exportInflux2({ ...target, bucket: '', org: '' }, whole, root, 3, { provider: 'influxdb2', url: source, bucket: 'EOS', org: 'NexoWatt' });
        assert.equal(JSON.parse(await fs.readFile(path.join(whole, 'eos-export-proof.json'))).buckets.some(b => b.name === 'Empty'), true);
        t.diagnostic('Actual source/target services, real CLI, exact six typed field rows after isolated restore; existing empty bucket accepted, nonexistent rejected before backup; full-server inventory checked.');
    } finally {
        command.executable = oldExecutable;
        for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
        await Promise.all(children.map(child => child.exitCode !== null ? undefined : new Promise(resolve => { child.once('exit', resolve); const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000); timer.unref(); })));
        await fs.rm(root, { recursive: true, force: true });
    }
});
