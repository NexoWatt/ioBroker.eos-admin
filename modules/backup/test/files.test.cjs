'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { createGunzip } = require('node:zlib');
const { encryptFile, decryptFile, archiveDirectory, hashFile, keyFile, copyPrivate, contained } = require('../build/files.js');
const { run } = require('../build/command.js');
async function directory(t) { const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eos-backup-files-')); t.after(() => fs.rm(dir, { recursive: true, force: true })); return dir; }
async function deadline(promise, ms = 4000) { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('TEST_DEADLINE')), ms); })]); } finally { clearTimeout(timer); } }

test('encrypted backup roundtrips, authentication failure removes only newly created plaintext', async t => {
    const dir = await directory(t); const key = await keyFile(dir);
    const source = path.join(dir, 'source'); const encrypted = path.join(dir, 'archive.nwb'); const target = path.join(dir, 'target');
    const content = randomBytes(262144); await fs.writeFile(source, content);
    await deadline(encryptFile(source, encrypted, key, 1024 ** 2));
    assert.equal((await fs.stat(encrypted)).mode & 0o077, 0);
    await deadline(decryptFile(encrypted, undefined, key, 1024 ** 2));
    await deadline(decryptFile(encrypted, target, key, 1024 ** 2));
    assert.deepEqual(await fs.readFile(target), content);
    await assert.rejects(deadline(decryptFile(encrypted, target, key, 1024 ** 2)), /EEXIST/);
    assert.deepEqual(await fs.readFile(target), content, 'preexisting target is never deleted');
    const fd = await fs.open(encrypted, 'r+'); await fd.write(Buffer.from('bad'), 0, 3, 25); await fd.close();
    const failed = path.join(dir, 'failed');
    await assert.rejects(deadline(decryptFile(encrypted, failed, key, 1024 ** 2)), /EOS_BACKUP_ARCHIVE_AUTHENTICATION/);
    await assert.rejects(fs.stat(failed), { code: 'ENOENT' });
});
test('empty encrypted file authenticates, duplicate publication and symlink sources preserve originals', async t => {
    const dir = await directory(t); const source = path.join(dir, 'empty'); const archive = path.join(dir, 'backup'); const key = randomBytes(32);
    await fs.writeFile(source, ''); await deadline(encryptFile(source, archive, key, 100)); await deadline(decryptFile(archive, undefined, key, 100));
    const hash = await hashFile(archive);
    await assert.rejects(deadline(encryptFile(source, archive, key, 100)), /EEXIST/); assert.equal(await hashFile(archive), hash);
    await assert.rejects(fs.stat(archive + '.partial'), { code: 'ENOENT' });
    await fs.symlink(source, path.join(dir, 'link'));
    await assert.rejects(deadline(encryptFile(path.join(dir, 'link'), path.join(dir, 'bad'), key, 100)));
    await assert.rejects(hashFile(path.join(dir, 'link')));
});
test('private copy closes the source after destination-open failure and preserves previous content', async t => {
    const dir = await directory(t); const source = path.join(dir, 'source'); const dest = path.join(dir, 'dest');
    await fs.writeFile(source, 'source'); await fs.writeFile(dest, 'keep');
    const before = process.platform === 'linux' ? (await fs.readdir('/proc/self/fd')).length : 0;
    for (let i = 0; i < 30; i++) await assert.rejects(deadline(copyPrivate(source, dest)), /EEXIST/);
    if (before) assert.ok((await fs.readdir('/proc/self/fd')).length <= before + 2, 'failed copies do not leak descriptors');
    assert.equal(await fs.readFile(dest, 'utf8'), 'keep');
    await deadline(copyPrivate(source, path.join(dir, 'copy'))); assert.equal(await fs.readFile(path.join(dir, 'copy'), 'utf8'), 'source');
});
test('directory archive preserves allowed files and excludes backup recursion; symlinks are rejected', async t => {
    const dir = await directory(t); const root = path.join(dir, 'data'); await fs.mkdir(path.join(root, 'modules/backup'), { recursive: true });
    await fs.writeFile(path.join(root, 'config.json'), '{"fixture":true}'); await fs.writeFile(path.join(root, 'modules/backup/secret'), 'excluded');
    const archive = path.join(dir, 'data.tar.gz'); await deadline(archiveDirectory(root, archive, ['modules/backup']));
    const tar = require('tar-stream').extract(); const names = [];
    tar.on('entry', (header, stream, next) => { names.push(header.name); stream.resume(); stream.once('end', next); });
    await pipeline(createReadStream(archive), createGunzip(), tar); assert.deepEqual(names, ['config.json']);
    await fs.symlink('/etc/passwd', path.join(root, 'outside'));
    await assert.rejects(archiveDirectory(root, path.join(dir, 'rejected'), []), /EOS_BACKUP_SOURCE_SYMLINK/);
    assert.equal(contained(root, path.join(root, 'ok')), true); assert.equal(contained(root, root + '-other/a'), false); assert.equal(contained(root, path.join(root, '../outside')), false);
});
test('64 MiB encryption/decryption streams with bounded JavaScript heap and exact restored bytes', { timeout: 20000 }, async t => {
    const dir = await directory(t); const source = path.join(dir, 'large'); const archive = path.join(dir, 'large.nwb'); const restored = path.join(dir, 'restored'); const key = randomBytes(32);
    const chunk = randomBytes(1024 ** 2); const fd = await fs.open(source, 'wx', 0o600);
    try { for (let i = 0; i < 64; i++) await fd.write(chunk); } finally { await fd.close(); }
    const before = process.memoryUsage(); let maximumHeap = before.heapUsed, maximumRss = before.rss;
    const sample = setInterval(() => { const m = process.memoryUsage(); maximumHeap = Math.max(maximumHeap, m.heapUsed); maximumRss = Math.max(maximumRss, m.rss); }, 5);
    try { await deadline(encryptFile(source, archive, key, 65 * 1024 ** 2), 10000); await deadline(decryptFile(archive, restored, key, 65 * 1024 ** 2), 10000); }
    finally { clearInterval(sample); }
    assert.equal(await hashFile(source), await hashFile(restored));
    assert.ok(maximumHeap - before.heapUsed < 32 * 1024 ** 2, 'no whole-archive JavaScript buffering');
    t.diagnostic(JSON.stringify({ sourceBytes: 64 * 1024 ** 2, maximumHeapDelta: maximumHeap - before.heapUsed, maximumRssDelta: maximumRss - before.rss, scope: 'isolated backup stream test; not customer RSS' }));
});
test('commands handle spawn errors/nonzero exit/output limit/timeout without leaking partial output', async t => {
    const dir = await directory(t);
    for (const [name, exe, args, options] of [
        ['missing', path.join(dir, 'no-program'), [], {}],
        ['nonzero', process.execPath, ['-e', 'process.stdout.write("partial");process.exit(7)'], {}],
        ['limit', process.execPath, ['-e', 'setInterval(()=>process.stdout.write(Buffer.alloc(1024)),1)'], { maxBytes: 128 }],
        ['timeout', process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeout: 100 }],
    ]) {
        const output = path.join(dir, name);
        await assert.rejects(deadline(run(exe, args, { cwd: dir, output, ...options })), /EOS_BACKUP_COMMAND_FAILED/);
        await assert.rejects(fs.stat(output), { code: 'ENOENT' });
    }
});
test('output-open failure cannot start the command; successful output closes and remains private', async t => {
    const dir = await directory(t); const output = path.join(dir, 'existing'); const marker = path.join(dir, 'must-not-run');
    await fs.writeFile(output, 'keep');
    await assert.rejects(run(process.execPath, ['-e', `require('fs').writeFileSync(${JSON.stringify(marker)},'bad')`], { cwd: dir, output }), /EEXIST/);
    await assert.rejects(fs.stat(marker), { code: 'ENOENT' }); assert.equal(await fs.readFile(output, 'utf8'), 'keep');
    const success = path.join(dir, 'success'); await deadline(run(process.execPath, ['-e', 'process.stdout.write("ok")'], { cwd: dir, output: success }));
    assert.equal(await fs.readFile(success, 'utf8'), 'ok'); assert.equal((await fs.stat(success)).mode & 0o077, 0);
});
