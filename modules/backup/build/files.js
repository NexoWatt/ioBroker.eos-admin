"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ARCHIVE_NAME = void 0;
exports.privateDir = privateDir;
exports.assertRegular = assertRegular;
exports.hashFile = hashFile;
exports.keyFile = keyFile;
exports.encryptFile = encryptFile;
exports.decryptFile = decryptFile;
exports.collectFiles = collectFiles;
exports.archiveDirectory = archiveDirectory;
exports.archiveInfo = archiveInfo;
exports.contained = contained;
exports.copyPrivate = copyPrivate;
/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_crypto_1 = require("node:crypto");
const promises_2 = require("node:stream/promises");
const node_stream_1 = require("node:stream");
const node_zlib_1 = require("node:zlib");
const types_1 = require("./types");
const MAGIC = Buffer.from('NWEOSBK1');
exports.ARCHIVE_NAME = /^eos-backup-[0-9a-f-]{36}-[a-zA-Z0-9_-]{1,80}\.nwb$/;
const MAX_FILE = 100 * 1024 ** 3;
function boundedBytes(limit) {
    let bytes = 0;
    return new node_stream_1.Transform({
        transform(chunk, _encoding, done) {
            bytes += chunk.length;
            done(bytes > limit ? (0, types_1.fail)('EOS_BACKUP_ARCHIVE_LIMIT') : null, chunk);
        },
    });
}
/** Validate the opened inode, not a pathname checked before a possible replacement. */
async function regularInput(file, maximum = MAX_FILE) {
    const fd = await (0, promises_1.open)(file, node_fs_1.constants.O_RDONLY | node_fs_1.constants.O_NOFOLLOW);
    try {
        const st = await fd.stat();
        if (!st.isFile() || st.size > maximum)
            throw (0, types_1.fail)('EOS_BACKUP_FILE_INVALID');
        return fd;
    }
    catch (error) {
        await fd.close();
        throw error;
    }
}
async function privateDir(dir) {
    await (0, promises_1.mkdir)(dir, { recursive: true, mode: 0o700 });
    const st = await (0, promises_1.lstat)(dir);
    if (!st.isDirectory() || st.isSymbolicLink() || (st.mode & 0o077) !== 0)
        throw (0, types_1.fail)('EOS_BACKUP_DIRECTORY_PERMISSIONS');
}
async function assertRegular(file, maximum = MAX_FILE) {
    const fd = await regularInput(file, maximum);
    try {
        return (await fd.stat()).size;
    }
    finally {
        await fd.close();
    }
}
async function hashFile(file) {
    const fd = await regularInput(file), hash = (0, node_crypto_1.createHash)('sha256');
    const input = fd.createReadStream({ autoClose: false });
    try {
        await (0, promises_2.pipeline)(input, boundedBytes(MAX_FILE), new node_stream_1.Writable({
            write(chunk, _encoding, callback) {
                hash.update(chunk);
                callback();
            },
        }));
        return hash.digest('hex');
    }
    finally {
        input.destroy();
        await fd.close();
    }
}
async function keyFile(dataDir) {
    await privateDir(dataDir);
    const p = (0, node_path_1.join)(dataDir, 'recovery.key');
    let handle;
    try {
        handle = await (0, promises_1.open)(p, node_fs_1.constants.O_WRONLY | node_fs_1.constants.O_CREAT | node_fs_1.constants.O_EXCL | node_fs_1.constants.O_NOFOLLOW, 0o600);
        await handle.writeFile((0, node_crypto_1.randomBytes)(32));
        await handle.sync();
    }
    catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST')
            throw error;
    }
    finally {
        await handle?.close();
    }
    const fd = await (0, promises_1.open)(p, node_fs_1.constants.O_RDONLY | node_fs_1.constants.O_NOFOLLOW);
    try {
        const st = await fd.stat();
        if (!st.isFile() || st.size !== 32 || (st.mode & 0o077) !== 0)
            throw (0, types_1.fail)('EOS_BACKUP_KEY_INVALID');
        return await fd.readFile();
    }
    finally {
        await fd.close();
    }
}
async function encryptFile(source, dest, key, limit) {
    if (key.length !== 32)
        throw (0, types_1.fail)('EOS_BACKUP_KEY_INVALID');
    const inputFile = await regularInput(source, limit);
    let out, input, output;
    const tmp = dest + '.partial';
    let created = false;
    try {
        const iv = (0, node_crypto_1.randomBytes)(12), cipher = (0, node_crypto_1.createCipheriv)('aes-256-gcm', key, iv), header = Buffer.concat([MAGIC, iv]);
        cipher.setAAD(header);
        out = await (0, promises_1.open)(tmp, node_fs_1.constants.O_WRONLY | node_fs_1.constants.O_CREAT | node_fs_1.constants.O_EXCL | node_fs_1.constants.O_NOFOLLOW, 0o600);
        created = true;
        await out.writeFile(header);
        input = inputFile.createReadStream({ autoClose: false });
        output = out.createWriteStream({ autoClose: false, start: header.length });
        await (0, promises_2.pipeline)(input, boundedBytes(limit), cipher, output);
        await out.write(cipher.getAuthTag(), 0, 16, (await out.stat()).size);
        await out.sync();
        // FileHandle streams with autoClose:false retain the descriptor until destroyed.
        input.destroy();
        output.destroy();
        await out.close();
        out = undefined;
        // Atomic no-replace publication: an existing archive must never be overwritten.
        await (0, promises_1.link)(tmp, dest);
        await (0, promises_1.rm)(tmp);
        created = false;
    }
    catch (error) {
        if (created)
            await (0, promises_1.rm)(tmp, { force: true });
        throw error;
    }
    finally {
        input?.destroy();
        output?.destroy();
        await out?.close();
        await inputFile.close();
    }
}
async function decryptFile(source, dest, key, limit) {
    if (key.length !== 32)
        throw (0, types_1.fail)('EOS_BACKUP_KEY_INVALID');
    const fd = await regularInput(source, limit + 36);
    let out, input, output;
    let created = false;
    try {
        const size = (await fd.stat()).size;
        if (size < 36)
            throw (0, types_1.fail)('EOS_BACKUP_ARCHIVE_INVALID');
        const header = Buffer.alloc(20), tag = Buffer.alloc(16);
        const h = await fd.read(header, 0, 20, 0), t = await fd.read(tag, 0, 16, size - 16);
        if (h.bytesRead !== 20 || t.bytesRead !== 16 || !header.subarray(0, 8).equals(MAGIC))
            throw (0, types_1.fail)('EOS_BACKUP_ARCHIVE_FORMAT');
        const cipher = (0, node_crypto_1.createDecipheriv)('aes-256-gcm', key, header.subarray(8));
        cipher.setAAD(header);
        cipher.setAuthTag(tag);
        if (dest) {
            out = await (0, promises_1.open)(dest, node_fs_1.constants.O_WRONLY | node_fs_1.constants.O_CREAT | node_fs_1.constants.O_EXCL | node_fs_1.constants.O_NOFOLLOW, 0o600);
            created = true;
        }
        output = out
            ? out.createWriteStream({ autoClose: false })
            : new node_stream_1.Writable({
                write(_chunk, _encoding, cb) {
                    cb();
                },
            });
        input = size === 36 ? node_stream_1.Readable.from([]) : fd.createReadStream({ start: 20, end: size - 17, autoClose: false });
        await (0, promises_2.pipeline)(input, cipher, boundedBytes(limit), output);
        await out?.sync();
    }
    catch (error) {
        if (created && dest)
            await (0, promises_1.rm)(dest, { force: true });
        if (error instanceof Error && 'code' in error && error.code === 'EEXIST')
            throw error;
        throw (0, types_1.fail)('EOS_BACKUP_ARCHIVE_AUTHENTICATION');
    }
    finally {
        input?.destroy();
        output?.destroy();
        await out?.close();
        await fd.close();
    }
}
async function collectFiles(root, exclude = []) {
    const base = await (0, promises_1.realpath)(root);
    const files = [];
    let total = 0;
    const walk = async (dir) => {
        for (const entry of await (0, promises_1.readdir)(dir, { withFileTypes: true })) {
            const path = (0, node_path_1.join)(dir, entry.name), rel = (0, node_path_1.relative)(base, path).replaceAll('\\', '/');
            if (exclude.some(x => rel === x || rel.startsWith(x + '/')))
                continue;
            if (entry.isSymbolicLink())
                throw (0, types_1.fail)('EOS_BACKUP_SOURCE_SYMLINK');
            if (entry.isDirectory())
                await walk(path);
            else if (entry.isFile()) {
                const s = await (0, promises_1.lstat)(path);
                if (!s.isFile() || s.isSymbolicLink())
                    throw (0, types_1.fail)('EOS_BACKUP_SOURCE_SYMLINK');
                total += s.size;
                if (total > MAX_FILE || files.length >= 100000)
                    throw (0, types_1.fail)('EOS_BACKUP_SOURCE_LIMIT');
                files.push(rel);
            }
            else
                throw (0, types_1.fail)('EOS_BACKUP_SOURCE_TYPE');
        }
    };
    await walk(base);
    return files;
}
/** Existing tar-fs component; no link dereferencing, fixed list, bounded compressed output. */
async function archiveDirectory(root, dest, exclude = [], limit = 10 * 1024 ** 3) {
    const entries = await collectFiles(root, exclude);
    const tar = require('tar-fs');
    const out = await (0, promises_1.open)(dest, node_fs_1.constants.O_WRONLY | node_fs_1.constants.O_CREAT | node_fs_1.constants.O_EXCL | node_fs_1.constants.O_NOFOLLOW, 0o600);
    let output, input;
    try {
        input = tar.pack(root, { entries, dereference: false, strict: true });
        output = out.createWriteStream({ autoClose: false });
        await (0, promises_2.pipeline)(input, (0, node_zlib_1.createGzip)({ level: 3 }), boundedBytes(limit), output);
        await out.sync();
    }
    catch (error) {
        await (0, promises_1.rm)(dest, { force: true });
        throw error;
    }
    finally {
        input?.destroy();
        output?.destroy();
        await out.close();
    }
}
async function archiveInfo(file, kind) {
    const size = await assertRegular(file), st = await (0, promises_1.stat)(file);
    return { name: (0, node_path_1.basename)(file), size, mtime: st.mtime.toISOString(), sha256: await hashFile(file), kind };
}
function contained(root, file) {
    const rel = (0, node_path_1.relative)((0, node_path_1.resolve)(root), (0, node_path_1.resolve)(file));
    return rel !== '' && !rel.startsWith('..' + node_path_1.sep) && rel !== '..' && !rel.startsWith(node_path_1.sep);
}
async function copyPrivate(source, dest) {
    const inputFile = await regularInput(source);
    let outFile, input, output;
    let created = false;
    try {
        await (0, promises_1.mkdir)((0, node_path_1.dirname)(dest), { recursive: true, mode: 0o700 });
        outFile = await (0, promises_1.open)(dest, node_fs_1.constants.O_WRONLY | node_fs_1.constants.O_CREAT | node_fs_1.constants.O_EXCL | node_fs_1.constants.O_NOFOLLOW, 0o600);
        created = true;
        input = inputFile.createReadStream({ autoClose: false });
        output = outFile.createWriteStream({ autoClose: false });
        await (0, promises_2.pipeline)(input, boundedBytes(MAX_FILE), output);
        await outFile.sync();
    }
    catch (error) {
        if (created)
            await (0, promises_1.rm)(dest, { force: true });
        throw error;
    }
    finally {
        input?.destroy();
        output?.destroy();
        await outFile?.close();
        await inputFile.close();
    }
}
