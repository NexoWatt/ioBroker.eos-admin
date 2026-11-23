/** Copyright (c) 2026 NexoWatt. Proprietary. Remote files never become executable restore commands. */
import { constants } from 'node:fs';
import { open, link, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { request } from 'node:https';
import { pipeline } from 'node:stream/promises';
import { Transform, type Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { archiveInfo, copyPrivate, decryptFile, encryptFile, privateDir, ARCHIVE_NAME } from './files';
import { LEGACY_NAME } from './legacy';
import { openStorage, providerName, remoteName, type RemoteDownload } from './storageRemote';
import { num, fail, type JobContext, type ArchiveInfo } from './types';

async function remoteStream(source: RemoteDownload): Promise<Readable> {
    if (source.stream) return source.stream;
    const url = source.url;
    if (!url || url.protocol !== 'https:' || url.username || url.password) throw fail('EOS_BACKUP_TLS_REQUIRED');
    return new Promise((resolve, reject) => {
        const req = request(
            url,
            {
                method: source.method || 'GET',
                headers: source.headers || {},
                rejectUnauthorized: true,
                minVersion: 'TLSv1.2',
            },
            res => {
                clearTimeout(timer);
                if (res.statusCode !== 200) {
                    res.destroy();
                    req.destroy();
                    reject(fail('EOS_BACKUP_REMOTE_DOWNLOAD'));
                    return;
                }
                res.once('close', () => req.destroy());
                resolve(res);
            },
        );
        const timer = setTimeout(() => {
            req.destroy();
            reject(fail('EOS_BACKUP_TRANSFER_TIMEOUT'));
        }, 5000);
        req.on('error', () => {
            clearTimeout(timer);
            reject(fail('EOS_BACKUP_REMOTE_DOWNLOAD'));
        });
        req.end();
    });
}
export async function receiveRemote(
    source: RemoteDownload,
    destination: string,
    size: number,
    maximum: number,
): Promise<void> {
    if (!Number.isSafeInteger(size) || size < 0 || size > maximum) throw fail('EOS_BACKUP_ARCHIVE_LIMIT');
    if (source.localPath) {
        await copyPrivate(source.localPath, destination);
        try {
            const fd = await open(destination, constants.O_RDONLY | constants.O_NOFOLLOW);
            try {
                if ((await fd.stat()).size !== size) throw fail('EOS_BACKUP_REMOTE_CHANGED');
            } finally {
                await fd.close();
            }
        } catch (error) {
            await rm(destination, { force: true });
            throw error;
        }
        return;
    }
    const fd = await open(
        destination,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o600,
    );
    let stream: Readable | undefined;
    const output = fd.createWriteStream({ autoClose: false });
    let bytes = 0;
    let created = true;
    const bound = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
            bytes += chunk.length;
            callback(bytes > maximum || bytes > size ? fail('EOS_BACKUP_ARCHIVE_LIMIT') : null, chunk);
        },
    });
    const timer = setTimeout(
        () => {
            stream?.destroy(fail('EOS_BACKUP_TRANSFER_TIMEOUT'));
            output.destroy(fail('EOS_BACKUP_TRANSFER_TIMEOUT'));
        },
        30 * 60 * 1000,
    );
    try {
        stream = await remoteStream(source);
        await pipeline(stream, bound, output);
        if (bytes !== size) throw fail('EOS_BACKUP_REMOTE_CHANGED');
        await fd.sync();
        created = false;
    } finally {
        clearTimeout(timer);
        stream?.destroy();
        bound.destroy();
        output.destroy();
        await fd.close();
        if (created) await rm(destination, { force: true });
    }
}
export async function storageList(ctx: JobContext, provider: string): Promise<Record<string, unknown>> {
    const client = await openStorage(ctx, provider);
    try {
        const entries = await client.list();
        if (entries.length > 1000) throw fail('EOS_BACKUP_BROWSER_COUNT');
        return {
            provider: providerName(provider),
            entries: entries
                .sort((a, b) => b.mtime - a.mtime)
                .map(({ name, size, mtime }) => ({
                    name,
                    size,
                    mtime: new Date(mtime).toISOString(),
                    format: LEGACY_NAME.test(name) ? 'legacy' : 'nexowatt-encrypted',
                })),
        };
    } finally {
        client.close();
    }
}
export async function storageFetch(
    ctx: JobContext,
    provider: string,
    name: string,
): Promise<ArchiveInfo & { sourceName: string; authentication: string }> {
    if (!remoteName(name)) throw fail('EOS_BACKUP_REMOTE_NAME');
    const client = await openStorage(ctx, provider),
        tmp = join(ctx.workDir, 'download-' + randomUUID());
    const maximum = num(ctx.config, 'maxArchiveGiB', 10) * 1024 ** 3,
        archives = join(ctx.dataDir, 'archives');
    try {
        await privateDir(ctx.workDir);
        await privateDir(archives);
        const matches = (await client.list()).filter(entry => entry.name === name);
        if (matches.length !== 1) throw fail('EOS_BACKUP_REMOTE_AMBIGUOUS');
        const entry = matches[0];
        if (!entry) throw fail('EOS_BACKUP_REMOTE_MISSING');
        await receiveRemote(await client.download(entry), tmp, entry.size, maximum + 36);
        if (LEGACY_NAME.test(name)) {
            const kind = 'legacy-' + (name.split('_')[0] || 'archive'),
                dest = join(archives, `eos-backup-${ctx.jobId}-${kind}-0.nwb`);
            await encryptFile(tmp, dest, Buffer.from(ctx.key, 'base64'), maximum);
            await decryptFile(dest, undefined, Buffer.from(ctx.key, 'base64'), maximum);
            return {
                ...(await archiveInfo(dest, kind)),
                sourceName: name,
                authentication: 'encrypted-and-verified-local-copy; legacy-content-not-trusted',
            };
        }
        if (!ARCHIVE_NAME.test(name)) throw fail('EOS_BACKUP_REMOTE_NAME');
        const fd = await open(tmp, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
            const magic = Buffer.alloc(8);
            await fd.read(magic, 0, 8, 0);
            if (!magic.equals(Buffer.from('NWEOSBK1')) || entry.size < 36) throw fail('EOS_BACKUP_ARCHIVE_FORMAT');
        } finally {
            await fd.close();
        }
        let authentication = 'verified-with-current-recovery-key';
        try {
            await decryptFile(tmp, undefined, Buffer.from(ctx.key, 'base64'), maximum);
        } catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'EOS_BACKUP_ARCHIVE_AUTHENTICATION')
                authentication = 'recovery-key-required-or-damaged';
            else throw error;
        }
        const dest = join(archives, name);
        await link(tmp, dest);
        return { ...(await archiveInfo(dest, 'remote')), sourceName: name, authentication };
    } finally {
        client.close();
        await rm(tmp, { force: true });
    }
}
