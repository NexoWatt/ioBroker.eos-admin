/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, realpath, link, rm, stat, type FileHandle } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Transform, Writable, Readable } from 'node:stream';
import { createGzip } from 'node:zlib';
import { fail, type ArchiveInfo } from './types';
const MAGIC = Buffer.from('NWEOSBK1');
export const ARCHIVE_NAME = /^eos-backup-[0-9a-f-]{36}-[a-zA-Z0-9_-]{1,80}\.nwb$/;
const MAX_FILE = 100 * 1024 ** 3;
function boundedBytes(limit: number): Transform {
    let bytes = 0;
    return new Transform({
        transform(chunk: Buffer, _encoding, done) {
            bytes += chunk.length;
            done(bytes > limit ? fail('EOS_BACKUP_ARCHIVE_LIMIT') : null, chunk);
        },
    });
}
/** Validate the opened inode, not a pathname checked before a possible replacement. */
async function regularInput(file: string, maximum = MAX_FILE): Promise<FileHandle> {
    const fd = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const st = await fd.stat();
        if (!st.isFile() || st.size > maximum) throw fail('EOS_BACKUP_FILE_INVALID');
        return fd;
    } catch (error) {
        await fd.close();
        throw error;
    }
}
export async function privateDir(dir: string): Promise<void> {
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const st = await lstat(dir);
    if (!st.isDirectory() || st.isSymbolicLink() || (st.mode & 0o077) !== 0)
        throw fail('EOS_BACKUP_DIRECTORY_PERMISSIONS');
}
export async function assertRegular(file: string, maximum = MAX_FILE): Promise<number> {
    const fd = await regularInput(file, maximum);
    try {
        return (await fd.stat()).size;
    } finally {
        await fd.close();
    }
}
export async function hashFile(file: string): Promise<string> {
    const fd = await regularInput(file),
        hash = createHash('sha256');
    const input = fd.createReadStream({ autoClose: false });
    try {
        await pipeline(
            input,
            boundedBytes(MAX_FILE),
            new Writable({
                write(chunk: Buffer, _encoding, callback) {
                    hash.update(chunk);
                    callback();
                },
            }),
        );
        return hash.digest('hex');
    } finally {
        input.destroy();
        await fd.close();
    }
}
export async function keyFile(dataDir: string): Promise<Buffer> {
    await privateDir(dataDir);
    const p = join(dataDir, 'recovery.key');
    let handle;
    try {
        handle = await open(p, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        await handle.writeFile(randomBytes(32));
        await handle.sync();
    } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
    } finally {
        await handle?.close();
    }
    const fd = await open(p, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const st = await fd.stat();
        if (!st.isFile() || st.size !== 32 || (st.mode & 0o077) !== 0) throw fail('EOS_BACKUP_KEY_INVALID');
        return await fd.readFile();
    } finally {
        await fd.close();
    }
}
export async function encryptFile(source: string, dest: string, key: Buffer, limit: number): Promise<void> {
    if (key.length !== 32) throw fail('EOS_BACKUP_KEY_INVALID');
    const inputFile = await regularInput(source, limit);
    let out: FileHandle | undefined, input: Readable | undefined, output: Writable | undefined;
    const tmp = dest + '.partial';
    let created = false;
    try {
        const iv = randomBytes(12),
            cipher = createCipheriv('aes-256-gcm', key, iv),
            header = Buffer.concat([MAGIC, iv]);
        cipher.setAAD(header);
        out = await open(tmp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        created = true;
        await out.writeFile(header);
        input = inputFile.createReadStream({ autoClose: false });
        output = out.createWriteStream({ autoClose: false, start: header.length });
        await pipeline(input, boundedBytes(limit), cipher, output);
        await out.write(cipher.getAuthTag(), 0, 16, (await out.stat()).size);
        await out.sync();
        // FileHandle streams with autoClose:false retain the descriptor until destroyed.
        input.destroy();
        output.destroy();
        await out.close();
        out = undefined;
        // Atomic no-replace publication: an existing archive must never be overwritten.
        await link(tmp, dest);
        await rm(tmp);
        created = false;
    } catch (error) {
        if (created) await rm(tmp, { force: true });
        throw error;
    } finally {
        input?.destroy();
        output?.destroy();
        await out?.close();
        await inputFile.close();
    }
}
export async function decryptFile(source: string, dest: string | undefined, key: Buffer, limit: number): Promise<void> {
    if (key.length !== 32) throw fail('EOS_BACKUP_KEY_INVALID');
    const fd = await regularInput(source, limit + 36);
    let out: FileHandle | undefined, input: Readable | undefined, output: Writable | undefined;
    let created = false;
    try {
        const size = (await fd.stat()).size;
        if (size < 36) throw fail('EOS_BACKUP_ARCHIVE_INVALID');
        const header = Buffer.alloc(20),
            tag = Buffer.alloc(16);
        const h = await fd.read(header, 0, 20, 0),
            t = await fd.read(tag, 0, 16, size - 16);
        if (h.bytesRead !== 20 || t.bytesRead !== 16 || !header.subarray(0, 8).equals(MAGIC))
            throw fail('EOS_BACKUP_ARCHIVE_FORMAT');
        const cipher = createDecipheriv('aes-256-gcm', key, header.subarray(8));
        cipher.setAAD(header);
        cipher.setAuthTag(tag);
        if (dest) {
            out = await open(
                dest,
                constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
                0o600,
            );
            created = true;
        }
        output = out
            ? out.createWriteStream({ autoClose: false })
            : new Writable({
                  write(_chunk, _encoding, cb) {
                      cb();
                  },
              });
        input = size === 36 ? Readable.from([]) : fd.createReadStream({ start: 20, end: size - 17, autoClose: false });
        await pipeline(input, cipher, boundedBytes(limit), output);
        await out?.sync();
    } catch (error) {
        if (created && dest) await rm(dest, { force: true });
        if (error instanceof Error && 'code' in error && error.code === 'EEXIST') throw error;
        throw fail('EOS_BACKUP_ARCHIVE_AUTHENTICATION');
    } finally {
        input?.destroy();
        output?.destroy();
        await out?.close();
        await fd.close();
    }
}
export async function collectFiles(root: string, exclude: readonly string[] = []): Promise<string[]> {
    const base = await realpath(root);
    const files: string[] = [];
    let total = 0;
    const walk = async (dir: string): Promise<void> => {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
            const path = join(dir, entry.name),
                rel = relative(base, path).replaceAll('\\', '/');
            if (exclude.some(x => rel === x || rel.startsWith(x + '/'))) continue;
            if (entry.isSymbolicLink()) throw fail('EOS_BACKUP_SOURCE_SYMLINK');
            if (entry.isDirectory()) await walk(path);
            else if (entry.isFile()) {
                const s = await lstat(path);
                if (!s.isFile() || s.isSymbolicLink()) throw fail('EOS_BACKUP_SOURCE_SYMLINK');
                total += s.size;
                if (total > MAX_FILE || files.length >= 100000) throw fail('EOS_BACKUP_SOURCE_LIMIT');
                files.push(rel);
            } else throw fail('EOS_BACKUP_SOURCE_TYPE');
        }
    };
    await walk(base);
    return files;
}
/** Existing tar-fs component; no link dereferencing, fixed list, bounded compressed output. */
export async function archiveDirectory(
    root: string,
    dest: string,
    exclude: readonly string[] = [],
    limit = 10 * 1024 ** 3,
): Promise<void> {
    const entries = await collectFiles(root, exclude);
    const tar = require('tar-fs') as {
        pack: (root: string, options: { entries: string[]; dereference: boolean; strict: boolean }) => Readable;
    };
    const out = await open(
        dest,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o600,
    );
    let output: Writable | undefined, input: Readable | undefined;
    try {
        input = tar.pack(root, { entries, dereference: false, strict: true });
        output = out.createWriteStream({ autoClose: false });
        await pipeline(input, createGzip({ level: 3 }), boundedBytes(limit), output);
        await out.sync();
    } catch (error) {
        await rm(dest, { force: true });
        throw error;
    } finally {
        input?.destroy();
        output?.destroy();
        await out.close();
    }
}
export async function archiveInfo(file: string, kind: string): Promise<ArchiveInfo> {
    const size = await assertRegular(file),
        st = await stat(file);
    return { name: basename(file), size, mtime: st.mtime.toISOString(), sha256: await hashFile(file), kind };
}
export function contained(root: string, file: string): boolean {
    const rel = relative(resolve(root), resolve(file));
    return rel !== '' && !rel.startsWith('..' + sep) && rel !== '..' && !rel.startsWith(sep);
}
export async function copyPrivate(source: string, dest: string): Promise<void> {
    const inputFile = await regularInput(source);
    let outFile: FileHandle | undefined, input: Readable | undefined, output: Writable | undefined;
    let created = false;
    try {
        await mkdir(dirname(dest), { recursive: true, mode: 0o700 });
        outFile = await open(
            dest,
            constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
            0o600,
        );
        created = true;
        input = inputFile.createReadStream({ autoClose: false });
        output = outFile.createWriteStream({ autoClose: false });
        await pipeline(input, boundedBytes(MAX_FILE), output);
        await outFile.sync();
    } catch (error) {
        if (created) await rm(dest, { force: true });
        throw error;
    } finally {
        input?.destroy();
        output?.destroy();
        await outFile?.close();
        await inputFile.close();
    }
}
