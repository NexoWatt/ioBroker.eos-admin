'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const corePath = path.resolve(__dirname, '../src/lib/eosLicenseCore.js');
const { EncryptedLicenseStore } = require(corePath);
const uuid = '550e8400-e29b-41d4-a716-446655440000';
// Storage-only data, deliberately not a signed or valid activation token.
const record = { token: 'NWL3.test-only-not-a-valid-license', highWaterMark: 1790784000000 };
const posix = { skip: process.platform === 'win32' };

async function fixture(t, mode = 0o2775) {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'eos-storage-compat-'));
    t.after(() => fs.rm(base, { recursive: true, force: true }));
    const runtime = path.join(base, 'iobroker');
    const data = path.join(runtime, 'iobroker-data');
    const instance = path.join(data, 'eos-admin.0');
    for (const directory of [runtime, data, instance]) {
        await fs.mkdir(directory, { mode });
        await fs.chmod(directory, mode); // Exact fixture mode independent of the test runner's umask.
    }
    const directory = path.join(instance, 'licensing');
    const options = { directory, uuid, trustedRuntimeRoot: runtime };
    return { base, runtime, data, instance, directory, options, store: new EncryptedLicenseStore(options) };
}

async function unsafe(promise) {
    await assert.rejects(promise, { code: 'STORAGE_UNSAFE_PATH' });
}

function withFilesystemOverrides(overrides) {
    // Exercise the real module with one deterministic stat result. No chown/root
    // permission is required and no global filesystem mock affects parallel tests.
    const localRequire = createRequire(corePath);
    const sandbox = {
        module: { exports: {} },
        Buffer,
        process,
        require(name) {
            if (name !== 'node:fs/promises') {
                return localRequire(name);
            }
            return { ...fs, ...overrides };
        },
    };
    vm.runInNewContext(fsSync.readFileSync(corePath, 'utf8'), sandbox, { filename: corePath, timeout: 1000 });
    return sandbox.module.exports.EncryptedLicenseStore;
}

function withStatOverride(filename, overrides) {
    return withFilesystemOverrides({
        async lstat(candidate) {
            const stat = await fs.lstat(candidate);
            return candidate === filename
                ? Object.assign(Object.create(Object.getPrototypeOf(stat)), stat, overrides)
                : stat;
        },
    });
}

test(
    'explicit runtime scope accepts normal 0775/2775 parents and preserves private storage across restart',
    posix,
    async t => {
        for (const mode of [0o775, 0o2775]) {
            const f = await fixture(t, mode);
            assert.equal(await f.store.load(), null);
            await f.store.save(record);
            for (const directory of [f.runtime, f.data, f.instance]) {
                assert.equal(
                    (await fs.lstat(directory)).mode & 0o7777,
                    mode,
                    'Existing ancestor permissions must not change',
                );
            }
            assert.equal((await fs.lstat(f.directory)).mode & 0o777, 0o700);
            for (const name of ['storage.key', 'license.enc']) {
                assert.equal((await fs.lstat(path.join(f.directory, name))).mode & 0o777, 0o600);
            }
            const restarted = new EncryptedLicenseStore(f.options);
            assert.deepEqual(await restarted.load(), record);
            assert.ok(!(await fs.readFile(path.join(f.directory, 'license.enc'), 'utf8')).includes(record.token));
            await restarted.save({ ...record, highWaterMark: record.highWaterMark + 1 });
            assert.equal((await new EncryptedLicenseStore(f.options).load()).highWaterMark, record.highWaterMark + 1);
        }
    },
);

test('omitting the explicit root retains strict group-write rejection without creating a leaf', posix, async t => {
    const f = await fixture(t);
    await unsafe(new EncryptedLicenseStore({ directory: f.directory, uuid }).load());
    assert.equal(await fs.lstat(f.directory).catch(() => null), null);
    assert.equal((await fs.lstat(f.runtime)).mode & 0o7777, 0o2775);
});

test('trusted runtime root must be absolute, canonical and narrower than the filesystem root', posix, async t => {
    const f = await fixture(t);
    for (const trustedRuntimeRoot of [
        '',
        null,
        1,
        'relative',
        '/',
        `${f.runtime}/`,
        `${f.runtime}/..`,
        `${f.runtime}\0`,
    ]) {
        assert.throws(() => new EncryptedLicenseStore({ ...f.options, trustedRuntimeRoot }), {
            code: 'STORAGE_RUNTIME_ROOT_INVALID',
        });
    }
});

test('parents above the trusted runtime and unrelated or prefix-sibling trees remain strict', posix, async t => {
    const f = await fixture(t);
    await fs.chmod(f.base, 0o775);
    await unsafe(f.store.load());
    await fs.chmod(f.base, 0o700);
    for (const name of ['unrelated', 'iobroker-other']) {
        const outside = path.join(f.base, name);
        await fs.mkdir(outside, { mode: 0o775 });
        await fs.chmod(outside, 0o775);
        await unsafe(new EncryptedLicenseStore({ ...f.options, directory: path.join(outside, 'licensing') }).load());
        assert.equal(await fs.lstat(path.join(outside, 'licensing')).catch(() => null), null);
    }
});

test('group-writable runtime ancestors require the service UID and exact primary GID', posix, async t => {
    const f = await fixture(t);
    for (const override of [{ uid: process.getuid() + 1 }, { gid: process.getgid() + 1 }]) {
        const Store = withStatOverride(f.runtime, override);
        await unsafe(new Store(f.options).load());
    }
    assert.equal(await fs.lstat(f.directory).catch(() => null), null);
});

test('trusted runtime scope does not admit non-sticky world-writable ancestors', posix, async t => {
    const f = await fixture(t);
    for (const mode of [0o777, 0o2777, 0o707]) {
        await fs.chmod(f.data, mode);
        await unsafe(f.store.load());
    }
    assert.equal(await fs.lstat(f.directory).catch(() => null), null);
});

test('existing sticky temporary ancestors remain compatible without broadening the private leaf', posix, async t => {
    const f = await fixture(t);
    await fs.chmod(f.base, 0o1777);
    await f.store.save(record);
    assert.deepEqual(await f.store.load(), record);
    await fs.chmod(f.directory, 0o1777);
    await unsafe(f.store.load());
});

test('runtime root, intermediate and leaf symlinks are rejected without touching their targets', posix, async t => {
    for (const position of ['runtime', 'data', 'directory']) {
        const f = await fixture(t);
        const original = f[position];
        const target = path.join(f.base, `target-${position}`);
        if (position === 'directory') {
            await fs.mkdir(target, { mode: 0o700 });
        } else {
            await fs.rename(original, target);
        }
        await fs.symlink(target, original);
        await unsafe(f.store.load());
        assert.equal(await fs.lstat(path.join(target, 'storage.key')).catch(() => null), null);
    }
});

test('the compatibility option never relaxes leaf, storage-key or encrypted-file modes', posix, async t => {
    const f = await fixture(t);
    await f.store.save(record);
    for (const [filename, invalidMode, validMode] of [
        [f.directory, 0o750, 0o700],
        [f.directory, 0o2770, 0o700],
        [path.join(f.directory, 'storage.key'), 0o640, 0o600],
        [path.join(f.directory, 'license.enc'), 0o660, 0o600],
    ]) {
        await fs.chmod(filename, invalidMode);
        await unsafe(f.store.load());
        assert.equal(
            (await fs.lstat(filename)).mode & 0o7777,
            invalidMode,
            'Unsafe files must not be silently chmodded',
        );
        await fs.chmod(filename, validMode);
    }
    assert.deepEqual(await f.store.load(), record);
});

test('inherited ioBroker group ACLs keep newly created license leaf and files private', posix, async t => {
    try {
        execFileSync('setfacl', ['--version'], { stdio: 'pipe', timeout: 2000 });
    } catch (error) {
        if (error.code === 'ENOENT') {
            t.skip('setfacl is not installed; inherited POSIX ACL check requires the official installer ACL tool');
            return;
        }
        throw error;
    }
    const f = await fixture(t);
    execFileSync('setfacl', ['-m', `d:g:${process.getgid()}:rwx,g:${process.getgid()}:rwx`, f.instance], {
        stdio: 'pipe',
        timeout: 2000,
    });
    await f.store.save(record);
    assert.equal((await fs.lstat(f.directory)).mode & 0o777, 0o700);
    for (const name of ['storage.key', 'license.enc']) {
        assert.equal((await fs.lstat(path.join(f.directory, name))).mode & 0o777, 0o600);
    }
    assert.deepEqual(await new EncryptedLicenseStore(f.options).load(), record);
});

test(
    'fixed public trust storage is bounded, private, serialized and survives restart independently of a license',
    posix,
    async t => {
        const f = await fixture(t);
        const bytes = Buffer.from('{"publicKeys":{"test":"public-only-fixture"}}');
        assert.equal(await f.store.readImportedTrust(), null);
        const snapshot = Buffer.from(bytes);
        const pending = f.store.writeImportedTrust(bytes);
        bytes.fill(0);
        await pending;
        const filename = path.join(f.directory, 'imported-public-keys.json');
        assert.deepEqual(await fs.readFile(filename), snapshot);
        assert.equal((await fs.lstat(filename)).mode & 0o777, 0o600);
        assert.equal((await fs.lstat(f.directory)).mode & 0o777, 0o700);
        const restarted = new EncryptedLicenseStore(f.options);
        assert.deepEqual(await restarted.readImportedTrust(), snapshot);
        assert.equal(await restarted.load(), null);
        assert.equal(await fs.lstat(path.join(f.directory, 'storage.key')).catch(() => null), null);
        const second = Buffer.from('{"publicKeys":{"test2":"public-only-fixture"}}');
        await Promise.all([restarted.writeImportedTrust(snapshot), restarted.writeImportedTrust(second)]);
        assert.deepEqual(await restarted.readImportedTrust(), second);
        await restarted.clear();
        assert.deepEqual(
            await restarted.readImportedTrust(),
            second,
            'Removing a license must preserve imported public trust',
        );
    },
);

test(
    'public trust writes accept only a bounded Buffer and never mutate an existing record on invalid input',
    posix,
    async t => {
        const f = await fixture(t);
        const original = Buffer.from('{"publicKeys":{}}');
        await f.store.writeImportedTrust(original);
        for (const invalid of [
            undefined,
            null,
            '{}',
            new Uint8Array([123, 125]),
            Buffer.alloc(0),
            Buffer.alloc(1),
            Buffer.alloc(32769),
        ]) {
            await assert.rejects(f.store.writeImportedTrust(invalid), { code: 'STORAGE_TRUST_DATA_INVALID' });
            assert.deepEqual(await f.store.readImportedTrust(), original);
        }
    },
);

test('public trust rejects unsafe modes, symlinks, hardlinks and oversized existing records', posix, async t => {
    const f = await fixture(t);
    const original = Buffer.from('{"publicKeys":{}}');
    const filename = path.join(f.directory, 'imported-public-keys.json');
    await f.store.writeImportedTrust(original);
    await fs.chmod(filename, 0o640);
    await unsafe(f.store.readImportedTrust());
    await unsafe(f.store.writeImportedTrust(original));
    assert.equal((await fs.lstat(filename)).mode & 0o777, 0o640);
    await fs.chmod(filename, 0o600);
    const hardlink = path.join(f.base, 'public-trust-hardlink');
    await fs.link(filename, hardlink);
    await unsafe(f.store.readImportedTrust());
    await unsafe(f.store.writeImportedTrust(original));
    await fs.unlink(hardlink);
    await fs.unlink(filename);
    const outside = path.join(f.base, 'outside-public-trust');
    await fs.writeFile(outside, original, { mode: 0o600 });
    await fs.symlink(outside, filename);
    await unsafe(f.store.readImportedTrust());
    await unsafe(f.store.writeImportedTrust(Buffer.from('{"replacement":true}')));
    assert.deepEqual(await fs.readFile(outside), original);
    await fs.unlink(filename);
    const oversized = Buffer.alloc(32769, 120);
    await fs.writeFile(filename, oversized, { mode: 0o600 });
    await assert.rejects(f.store.readImportedTrust(), { code: 'STORAGE_SIZE_INVALID' });
    await assert.rejects(f.store.writeImportedTrust(original), { code: 'STORAGE_SIZE_INVALID' });
    assert.equal((await fs.stat(filename)).size, oversized.length);
});

test(
    'a failed atomic public trust replacement preserves the old record and removes its private temporary file',
    posix,
    async t => {
        const f = await fixture(t);
        const original = Buffer.from('{"publicKeys":{"old":"fixture"}}');
        await f.store.writeImportedTrust(original);
        const Store = withFilesystemOverrides({
            async rename() {
                throw Object.assign(new Error('fixture rename failure'), { code: 'EIO' });
            },
        });
        await assert.rejects(new Store(f.options).writeImportedTrust(Buffer.from('{"publicKeys":{"new":"fixture"}}')), {
            code: 'STORAGE_IO_ERROR',
        });
        assert.deepEqual(await f.store.readImportedTrust(), original);
        assert.deepEqual(await fs.readdir(f.directory), ['imported-public-keys.json']);
    },
);
