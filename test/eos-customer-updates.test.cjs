'use strict';
/** Service/transport tests exercise signatures and real private files. No host install is invoked here. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(name, overrides = {}) {
    const filename = path.join(root, 'src/lib', name + '.ts');
    const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
    const original = mod.require.bind(mod);
    mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : original(name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText, filename);
    return mod.exports;
}
const transport = load('eosCustomerUpdateTransport');
const { UPDATE_METADATA_URL, UPDATE_KEYS_URL } = transport;
const keypair = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const keyid = 'SHA256:' + crypto.randomBytes(32).toString('base64').replace(/=$/, '');
const publicKey = keypair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const keys = Buffer.from(JSON.stringify({ keys: [{ keyid, key: publicKey, keytype: 'ecdsa-sha2-nistp256', scheme: 'ecdsa-sha2-nistp256', expires: null }] }));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function tarEntry(name, data, type = '0') {
    const content = Buffer.from(data), header = Buffer.alloc(512);
    header.write(name, 0, 100); header.write('0000644\0', 100); header.write('0000000\0', 108); header.write('0000000\0', 116);
    header.write(content.length.toString(8).padStart(11, '0') + '\0', 124); header.write('00000000000\0', 136);
    header.fill(32, 148, 156); header.write(type, 156); header.write('ustar\0', 257); header.write('00', 263);
    const checksum = header.reduce((total, value) => total + value, 0); header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148);
    return Buffer.concat([header, content, Buffer.alloc((512 - content.length % 512) % 512)]);
}
function release(version = '9.0.22', extra = [], manifestOverride = {}, ioOverride = {}) {
    const packageJson = { name: 'iobroker.eos-admin', version, engines: { node: '>=22.23.4 <23 || >=24.22.1 <25' }, ...manifestOverride };
    const archive = zlib.gzipSync(Buffer.concat([
        tarEntry('package/package.json', JSON.stringify(packageJson)),
        tarEntry('package/io-package.json', JSON.stringify({ common: { name: 'eos-admin', version, ...ioOverride } })),
        tarEntry('package/build/main.js', '"use strict";\nmodule.exports = {};\n'), ...extra, Buffer.alloc(1024),
    ]));
    const integrity = 'sha512-' + crypto.createHash('sha512').update(archive).digest('base64');
    const sig = crypto.sign('sha256', Buffer.from(`iobroker.eos-admin@${version}:${integrity}`), keypair.privateKey).toString('base64');
    const metadata = { name: 'iobroker.eos-admin', version, engines: packageJson.engines,
        dist: { integrity, tarball: `https://registry.npmjs.org/iobroker.eos-admin/-/iobroker.eos-admin-${version}.tgz`, signatures: [{ keyid, sig }] } };
    return { archive, metadata, encoded: Buffer.from(JSON.stringify(metadata)), integrity };
}
async function fixture(t, custom = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-customer-update-'));
    fs.chmodSync(directory, 0o700); t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const packageDir = path.join(directory, 'node_modules/iobroker.eos-admin'), controllerDir = path.join(directory, 'node_modules/iobroker.js-controller');
    fs.mkdirSync(path.join(packageDir, 'build/lib'), { recursive: true }); fs.mkdirSync(controllerDir, { recursive: true });
    fs.writeFileSync(path.join(controllerDir, 'package.json'), JSON.stringify({ name: 'iobroker.js-controller', version: '7.2.5' }));
    fs.writeFileSync(path.join(packageDir, 'build/lib/eosCustomerUpdateWorker.js'), '/* Fixture worker; process spawn is intercepted in service tests. */\n' + ' '.repeat(100));
    const calls = [], spawned = [];
    let snapshot = { instanceNative: { port: 8188, token: 'private-test-credential' }, modules: { devices: [{ id: 'ess1' }] }, settings: { minSoc: 10 } };
    const item = custom.release || release();
    const encryptSnapshot = plain => Buffer.from(plain).toString('base64');
    const options = { namespace: 'eos-admin.0', currentVersion: '9.0.21', nodeVersion: process.versions.node, packageDir, controllerDir, dataDir: directory,
        readHostInstances: async () => [{ namespace: 'eos-admin.0', enabled: true }], readConfigurationSnapshot: async () => snapshot,
        encryptSnapshot, decryptSnapshot: cipher => Buffer.from(cipher, 'base64').toString('utf8'),
        fetchResource: async (url, maximum, signal) => {
            calls.push({ url, maximum, signal });
            if (url === UPDATE_METADATA_URL) return item.encoded;
            if (url === UPDATE_KEYS_URL) return keys;
            if (url === item.metadata.dist.tarball) return item.archive;
            throw new Error('unexpected URL');
        }, ...custom.options };
    const childProcess = { spawn: (...args) => {
        spawned.push(args); const child = new EventEmitter(); child.unref = () => {}; process.nextTick(() => child.emit('spawn')); return child;
    } };
    const serviceModule = load('eosCustomerUpdates', { './eosCustomerUpdateTransport': transport, 'node:child_process': childProcess });
    const service = new serviceModule.EosCustomerUpdates(options); t.after(() => service.stop());
    return { directory, packageDir, controllerDir, options, service, serviceModule, calls, spawned, item,
        setSnapshot(value) { snapshot = value; }, snapshot: () => snapshot };
}

test('metadata and registry signatures accept the exact stable package and reject tampering', () => {
    const item = release(), parsed = transport.parseCandidate(item.encoded, '9.0.21', process.versions.node);
    transport.verifyRegistrySignature(parsed, keys, Date.now());
    assert.throws(() => transport.verifyRegistrySignature({ ...parsed, integrity: 'sha512-' + Buffer.alloc(64, 1).toString('base64') }, keys, Date.now()), /EOS_UPDATE_SIGNATURE/);
    for (const patch of [{ name: 'other' }, { version: '9.0.22-beta.1' }, { version: '10.0.0' }, { deprecated: 'withdrawn' }, { engines: { node: '<1' } }]) {
        assert.throws(() => transport.parseCandidate(Buffer.from(JSON.stringify({ ...item.metadata, ...patch })), '9.0.21', process.versions.node), /EOS_UPDATE_/);
    }
    assert.throws(() => transport.parseCandidate(Buffer.from(JSON.stringify({ ...item.metadata, dist: { ...item.metadata.dist, tarball: 'https://evil.example/a.tgz' } })), '9.0.21', process.versions.node), /SIGNATURE_METADATA/);
});

test('expired, wrong-curve, missing and malformed registry keys fail closed', () => {
    const parsed = transport.parseCandidate(release().encoded, '9.0.21', process.versions.node);
    for (const item of [{ keys: [] }, { keys: [{ keyid, key: publicKey, keytype: 'rsa', scheme: 'rsa', expires: null }] },
        { keys: [{ keyid, key: publicKey, keytype: 'ecdsa-sha2-nistp256', scheme: 'ecdsa-sha2-nistp256', expires: '2000-01-01T00:00:00Z' }] }]) {
        assert.throws(() => transport.verifyRegistrySignature(parsed, Buffer.from(JSON.stringify(item)), Date.now()), /EOS_UPDATE_/);
    }
});

test('archive identity, member hashes, path traversal, links, duplicate and incomplete streams', async t => {
    const f = await fixture(t);
    const file = path.join(f.directory, 'verify.tgz');
    fs.writeFileSync(file, f.item.archive);
    const parsed = transport.parseCandidate(f.item.encoded, '9.0.21', process.versions.node);
    const result = await transport.inspectUpdateArchive(file, parsed);
    assert.equal(result.files.length, 3); assert.equal(result.files.find(row => row.path === 'build/main.js').sha256, hash('"use strict";\nmodule.exports = {};\n'));
    const bad = [release('9.0.22', [tarEntry('package/../../escape.js', 'a')]), release('9.0.22', [tarEntry('package/link', '', '2')]),
        release('9.0.22', [tarEntry('package/package.json', '{}')]), release('9.0.22', [], { name: 'iobroker.other' }),
        release('9.0.22', [], {}, { name: 'admin' }), release('9.0.22', [], {}, { version: '9.0.23' }),
        release('9.0.22', [tarEntry('package/a//b', 'x')])];
    for (const item of bad) { fs.writeFileSync(file, item.archive); await assert.rejects(transport.inspectUpdateArchive(file, parsed), /EOS_UPDATE_/); }
    fs.writeFileSync(file, zlib.gzipSync(tarEntry('package/package.json', '{}')));
    await assert.rejects(transport.inspectUpdateArchive(file, parsed), /EOS_UPDATE_/);
});

test('npm PAX long paths and matching sizes are supported, dangling or conflicting overrides rejected', async t => {
    const f = await fixture(t), filename = path.join(f.directory, 'pax.tgz');
    const row = (key, value) => {
        const body = `${key}=${value}\n`; let size = Buffer.byteLength(body) + 2;
        while (size !== Buffer.byteLength(body) + String(size).length + 1) size = Buffer.byteLength(body) + String(size).length + 1;
        return `${size} ${body}`;
    };
    const fullPath = 'package/admin/assets/' + 'x'.repeat(130) + '.js';
    for (const [size, expected] of [['4', true], ['5', false]]) {
        const item = release('9.0.22', [tarEntry('PaxHeader/asset', row('path', fullPath) + row('size', size), 'x'), tarEntry(fullPath, 'code')]);
        fs.writeFileSync(filename, item.archive); const parsed = transport.parseCandidate(item.encoded, '9.0.21', process.versions.node);
        if (expected) assert.ok((await transport.inspectUpdateArchive(filename, parsed)).files.some(file => file.path === fullPath.slice(8)));
        else await assert.rejects(transport.inspectUpdateArchive(filename, parsed), /ARCHIVE_PAX/);
    }
    const dangling = release('9.0.22', [tarEntry('PaxHeader/end', row('path', fullPath), 'x')]);
    fs.writeFileSync(filename, dangling.archive); await assert.rejects(transport.inspectUpdateArchive(filename, transport.parseCandidate(dangling.encoded, '9.0.21', process.versions.node)), /ARCHIVE_INCOMPLETE/);
});

test('archive read errors and cancellation reject without leaving source streams running', async t => {
    const f = await fixture(t), parsed = transport.parseCandidate(f.item.encoded, '9.0.21', process.versions.node);
    await assert.rejects(transport.inspectUpdateArchive(path.join(f.directory, 'absent.tgz'), parsed), /ARCHIVE_READ/);
    const stopped = new AbortController(); stopped.abort();
    await assert.rejects(transport.inspectUpdateArchive('not-opened', parsed, stopped.signal), /ABORTED/);
    const { PassThrough } = require('node:stream'); const input = new PassThrough();
    const stalled = load('eosCustomerUpdateTransport', { 'node:fs': { createReadStream: () => input } });
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30);
    try { await assert.rejects(stalled.inspectUpdateArchive('stalled', parsed, controller.signal), /ABORTED/); }
    finally { clearTimeout(timer); }
    assert.equal(input.destroyed, true);
});

test('availability is cached, preparation verifies and encrypts without starting a process', async t => {
    const f = await fixture(t);
    const first = await f.service.status(); assert.equal(first.state, 'available'); assert.equal(first.availableVersion, '9.0.22');
    await f.service.status(); await f.service.check(); assert.equal(f.calls.length, 1);
    const prepared = await f.service.prepare('9.0.22', async () => true);
    assert.equal(prepared.state, 'prepared'); assert.equal(prepared.canStart, true); assert.equal(f.spawned.length, 0);
    const directory = path.join(f.directory, 'customer-updates', prepared.planId);
    const snapshot = fs.readFileSync(path.join(directory, 'configuration.enc.json'), 'utf8');
    assert.ok(!snapshot.includes('private-test-credential')); assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
    assert.equal(fs.statSync(path.join(directory, 'release.tgz')).mode & 0o777, 0o600);
    const externalSignals = f.calls.slice(1).map(row => row.signal); assert.ok(externalSignals.every(signal => signal === externalSignals[0]), 'one shared five-second budget covers metadata, keys and archive');
});

test('signature and integrity failures cannot produce an installable plan', async t => {
    for (const mode of ['signature', 'integrity']) {
        const item = release();
        if (mode === 'signature') { item.metadata.dist.signatures[0].sig = Buffer.alloc(72).toString('base64'); item.encoded = Buffer.from(JSON.stringify(item.metadata)); }
        else item.archive = Buffer.from('corrupted release');
        const f = await fixture(t, { release: item }); await f.service.status();
        await assert.rejects(f.service.prepare('9.0.22', async () => true), /EOS_UPDATE_(SIGNATURE|INTEGRITY)/);
        assert.equal((await f.service.status()).canStart, false); assert.equal(f.spawned.length, 0);
        assert.ok(!fs.existsSync(path.join(f.directory, 'customer-updates/active.json')));
    }
});

test('published metadata with a missing npm tarball cannot stop EOS; a later download needs an explicit start', async t => {
    const item = release('9.0.26');
    let unavailable = true;
    const f = await fixture(t, { release: item, options: {
        fetchResource: async url => {
            if (url === UPDATE_METADATA_URL) return item.encoded;
            if (url === UPDATE_KEYS_URL) return keys;
            assert.equal(url, item.metadata.dist.tarball);
            if (unavailable) throw new Error('EOS_UPDATE_HTTP_404');
            return item.archive;
        },
    } });
    const originalConfiguration = structuredClone(f.snapshot());
    assert.equal((await f.service.status()).state, 'available');
    await assert.rejects(f.service.prepare('9.0.26', async () => true), /EOS_UPDATE_HTTP_404/);
    const failed = await f.service.status();
    assert.equal(failed.state, 'failed');
    assert.equal(failed.canStart, false);
    assert.equal(f.spawned.length, 0, 'no maintenance worker can stop or install the adapter');
    assert.deepEqual(f.snapshot(), originalConfiguration);
    assert.ok(!fs.existsSync(path.join(f.directory, 'customer-updates/active.json')));
    await assert.rejects(f.service.start(crypto.randomUUID(), async () => true), /PLAN_EXPIRED/);
    unavailable = false;
    const prepared = await f.service.prepare('9.0.26', async () => true);
    assert.equal(prepared.state, 'prepared');
    assert.equal(f.spawned.length, 0, 'a successful retry still does not authorize a stop');
    await f.service.start(prepared.planId, async () => true);
    assert.equal(f.spawned.length, 1);
    assert.deepEqual(f.snapshot(), originalConfiguration);
});

test('authorization, one host instance, controller contract and configuration changes are enforced before launch', async t => {
    const f = await fixture(t); await f.service.status();
    await assert.rejects(f.service.prepare('9.0.22', async () => false), /AUTHORIZATION/);
    const prepared = await f.service.prepare('9.0.22', async () => true);
    f.setSnapshot({ ...f.snapshot(), settings: { minSoc: 15 } });
    await assert.rejects(f.service.start(prepared.planId, async () => true), /CONFIGURATION_CHANGED/);
    assert.equal(f.spawned.length, 0);
    for (const instances of [[], [{ namespace: 'eos-admin.0', enabled: false }], [{ namespace: 'eos-admin.0', enabled: true }, { namespace: 'eos-admin.1', enabled: false }]]) {
        const other = await fixture(t, { options: { readHostInstances: async () => instances } }); await other.service.status();
        await assert.rejects(other.service.prepare('9.0.22', async () => true), /MULTI_INSTANCE/);
    }
});

test('one-use start launches only the fixed worker, survives loss of response and never replays after restart', async t => {
    const f = await fixture(t); await f.service.status();
    const prepared = await f.service.prepare('9.0.22', async () => true);
    const started = await f.service.start(prepared.planId, async () => true);
    assert.equal(started.state, 'installing'); assert.equal(f.spawned.length, 1);
    const [executable, args, options] = f.spawned[0];
    assert.equal(executable, process.execPath); assert.equal(args.length, 2); assert.ok(args[0].endsWith('/worker.cjs')); assert.equal(options.shell, false);
    assert.equal(options.detached, true); assert.equal(options.env.NODE_OPTIONS, undefined);
    const job = JSON.parse(fs.readFileSync(path.join(args[1], 'job.json'), 'utf8'));
    const acceptedJob = load('eosCustomerUpdateWorker').parseEosCustomerUpdateJob(job, args[1]);
    assert.deepEqual(acceptedJob.files, job.files, 'service emits the actual worker contract');
    assert.equal(acceptedJob.snapshotSha256, hash(fs.readFileSync(path.join(args[1], 'configuration.enc.json'))));
    assert.equal(acceptedJob.archiveIntegrity, 'sha512-' + crypto.createHash('sha512').update(fs.readFileSync(path.join(args[1], 'release.tgz'))).digest('base64'));
    await assert.rejects(f.service.start(prepared.planId, async () => true), /PLAN_EXPIRED/);
    const again = new f.serviceModule.EosCustomerUpdates(f.options); t.after(() => again.stop());
    assert.equal((await again.status()).state, 'installing');
    await assert.rejects(again.prepare('9.0.22', async () => true), /BUSY/);
    assert.equal((await again.check()).state, 'installing'); assert.equal(f.spawned.length, 1);
});

test('only known pre-install failures allow a new explicit preparation; uncertainty stays locked across restart', async t => {
    for (const [status, phase, recovery, allowed] of [
        ['failed', 'validate', 'not-needed', true],
        ['failed', 'stopping', 'restored-old', true],
        ['failed', 'installing', 'not-restored', false],
        ['uncertain', 'starting', 'not-restored', false],
    ]) {
        const f = await fixture(t); await f.service.status(); const prepared = await f.service.prepare('9.0.22', async () => true);
        await f.service.start(prepared.planId, async () => true);
        const directory = path.join(f.directory, 'customer-updates', prepared.planId);
        fs.writeFileSync(path.join(directory, 'result.json'), JSON.stringify({ schema: 1, id: prepared.planId, namespace: 'eos-admin.0',
            fromVersion: '9.0.21', toVersion: '9.0.22', status, phase, recovery, updatedAt: Date.now(), error: 'EOS_UPDATE_TEST_FAILURE' }), { mode: 0o600 });
        assert.ok(['failed', 'interrupted'].includes((await f.service.status()).state));
        assert.equal(f.spawned.length, 1, 'reading a result never replays the worker');
        const restarted = new f.serviceModule.EosCustomerUpdates(f.options); t.after(() => restarted.stop());
        assert.ok(['failed', 'interrupted'].includes((await restarted.status()).state));
        if (allowed) {
            const next = await f.service.prepare('9.0.22', async () => true);
            assert.equal(next.state, 'prepared'); assert.notEqual(next.planId, prepared.planId);
            assert.equal(f.spawned.length, 1, 'explicit re-prepare is still not permission to install');
        } else {
            await assert.rejects(f.service.prepare('9.0.22', async () => true), /BUSY/);
            await assert.rejects(restarted.prepare('9.0.22', async () => true), /BUSY/);
        }
    }
});

test('revocation at final start fence does not spawn or leave an executable retry marker', async t => {
    const f = await fixture(t); await f.service.status(); const prepared = await f.service.prepare('9.0.22', async () => true);
    let calls = 0; await assert.rejects(f.service.start(prepared.planId, async () => ++calls < 2), /AUTHORIZATION/);
    assert.equal(f.spawned.length, 0);
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.directory, 'customer-updates/active.json'), 'utf8')).phase, 'prepared');
});

test('slow snapshot keeps a single admission slot; stop prevents a late preparation from becoming executable', async t => {
    let releaseSnapshot, entered;
    const barrier = new Promise(resolve => { releaseSnapshot = resolve; }), started = new Promise(resolve => { entered = resolve; });
    const f = await fixture(t, { options: { readConfigurationSnapshot: async () => { entered(); await barrier; return { a: 1 }; } } });
    await f.service.status(); const pending = f.service.prepare('9.0.22', async () => true); const failure = assert.rejects(pending, /STOPPED/);
    await started; await assert.rejects(f.service.prepare('9.0.22', async () => true), /BUSY/);
    f.service.stop(); releaseSnapshot(); await failure; assert.equal(f.spawned.length, 0);
});

test('configuration comparison preserves existing values while allowing added defaults only', () => {
    const { preservesUpdateConfiguration: preserves } = load('eosCustomerUpdates', { './eosCustomerUpdateTransport': transport });
    const before = { native: { tls: true }, devices: [{ id: 'ess1', min: 10 }], empty: null };
    assert.equal(preserves(before, { ...before, new: 1, native: { tls: true, added: 'default' } }), true);
    assert.equal(preserves(before, { ...before, devices: [{ id: 'ess1', min: 5 }] }), false);
    assert.equal(preserves(before, { ...before, devices: [] }), false);
    assert.equal(preserves(before, { ...before, empty: 0 }), false);
});

test('a verified worker result requires new running version and preserved configuration before success', async t => {
    const f = await fixture(t); await f.service.status(); const prepared = await f.service.prepare('9.0.22', async () => true);
    await f.service.start(prepared.planId, async () => true);
    const resultFile = path.join(f.directory, 'customer-updates', prepared.planId, 'result.json');
    fs.writeFileSync(resultFile, JSON.stringify({ schema: 1, id: prepared.planId, namespace: 'eos-admin.0', fromVersion: '9.0.21', toVersion: '9.0.22', status: 'succeeded', phase: 'finished' }), { mode: 0o600 });
    assert.equal((await f.service.status()).reason, 'EOS_UPDATE_RESTART_PENDING');
    const updated = new f.serviceModule.EosCustomerUpdates({ ...f.options, currentVersion: '9.0.22' }); t.after(() => updated.stop());
    const view = await updated.status(); assert.ok(['installed', 'current'].includes(view.state));
    f.setSnapshot({ devices: [] });
    const later = new f.serviceModule.EosCustomerUpdates({ ...f.options, currentVersion: '9.0.22' }); t.after(() => later.stop());
    assert.notEqual((await later.status()).reason, 'EOS_UPDATE_CONFIGURATION_CHANGED', 'legitimate edits after the completed check must not be called update damage');
    const g = await fixture(t); await g.service.status(); const plan = await g.service.prepare('9.0.22', async () => true);
    await g.service.start(plan.planId, async () => true);
    fs.writeFileSync(path.join(g.directory, 'customer-updates', plan.planId, 'result.json'), JSON.stringify({ schema: 1, id: plan.planId, namespace: 'eos-admin.0', fromVersion: '9.0.21', toVersion: '9.0.22', status: 'succeeded', phase: 'finished' }), { mode: 0o600 });
    g.setSnapshot({ devices: [] });
    const damaged = new g.serviceModule.EosCustomerUpdates({ ...g.options, currentVersion: '9.0.22' }); t.after(() => damaged.stop());
    assert.equal((await damaged.status()).reason, 'EOS_UPDATE_CONFIGURATION_CHANGED');
});

test('failed private storage remains closed and does not turn into an apparently available update', async t => {
    const f = await fixture(t); await f.service.status(); f.service.stop();
    const directory = path.join(f.directory, 'customer-updates');
    fs.chmodSync(directory, 0o755);
    const again = new f.serviceModule.EosCustomerUpdates(f.options); t.after(() => again.stop());
    const calls = f.calls.length;
    assert.equal((await again.status()).state, 'failed');
    await assert.rejects(again.check(), /PRIVATE_STORAGE/);
    assert.equal(f.calls.length, calls);
});

test('real HTTPS transport rejects redirects, invalid TLS and oversized bodies and aborts a stalled body', async t => {
    const https = require('node:https');
    const forge = Module.createRequire(require.resolve('@iobroker/js-controller-common-db'))('node-forge');
    const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const key = pair.privateKey.export({ format: 'pem', type: 'pkcs1' });
    const cert = forge.pki.createCertificate(); cert.publicKey = forge.pki.publicKeyFromPem(pair.publicKey.export({ format: 'pem', type: 'spki' }));
    cert.serialNumber = '01' + crypto.randomBytes(15).toString('hex'); cert.validity.notBefore = new Date(Date.now() - 60000); cert.validity.notAfter = new Date(Date.now() + 3600000);
    const subject = [{ name: 'commonName', value: 'EOS update test' }]; cert.setSubject(subject); cert.setIssuer(subject);
    cert.setExtensions([{ name: 'basicConstraints', cA: true }, { name: 'subjectAltName', altNames: [{ type: 7, ip: '127.0.0.1' }] }, { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, keyCertSign: true }]);
    cert.sign(forge.pki.privateKeyFromPem(key), forge.md.sha256.create()); const pem = forge.pki.certificateToPem(cert);
    let mode = 'good', count = 0;
    const server = https.createServer({ key, cert: pem }, (req, res) => {
        count++;
        if (mode === 'redirect') { res.writeHead(302, { Location: 'https://evil.example/' }); res.end(); }
        else if (mode === 'large') { res.writeHead(200); res.end(Buffer.alloc(5000)); }
        else if (mode === 'stall') { res.writeHead(200); res.write('first'); }
        else res.end('{"ok":true}');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => { server.closeAllConnections(); server.close(); });
    const adapted = load('eosCustomerUpdateTransport', { 'node:https': { get(url, options, callback) {
        assert.equal(url, UPDATE_METADATA_URL); assert.equal(options.rejectUnauthorized, true);
        return https.get({ ...options, hostname: '127.0.0.1', port: server.address().port, path: '/', ca: mode === 'bad-tls' ? undefined : pem }, callback);
    } } });
    assert.equal((await adapted.fetchUpdateResource(UPDATE_METADATA_URL, 2000, AbortSignal.timeout(1000))).toString(), '{"ok":true}');
    for (const failure of ['redirect', 'large', 'bad-tls', 'stall']) {
        mode = failure;
        await assert.rejects(adapted.fetchUpdateResource(UPDATE_METADATA_URL, 2000, AbortSignal.timeout(100)), /EOS_UPDATE_/);
    }
    const before = count;
    await assert.rejects(adapted.fetchUpdateResource('http://127.0.0.1/admin', 1000, AbortSignal.timeout(100)), /SOURCE/);
    assert.equal(count, before);
});
