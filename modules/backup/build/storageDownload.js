"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.receiveRemote = receiveRemote;
exports.storageList = storageList;
exports.storageFetch = storageFetch;
/** Copyright (c) 2026 NexoWatt. Proprietary. Remote files never become executable restore commands. */
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_https_1 = require("node:https");
const promises_2 = require("node:stream/promises");
const node_stream_1 = require("node:stream");
const node_crypto_1 = require("node:crypto");
const files_1 = require("./files");
const legacy_1 = require("./legacy");
const storageRemote_1 = require("./storageRemote");
const types_1 = require("./types");
async function remoteStream(source) {
    if (source.stream)
        return source.stream;
    const url = source.url;
    if (!url || url.protocol !== 'https:' || url.username || url.password)
        throw (0, types_1.fail)('EOS_BACKUP_TLS_REQUIRED');
    return new Promise((resolve, reject) => {
        const req = (0, node_https_1.request)(url, {
            method: source.method || 'GET',
            headers: source.headers || {},
            rejectUnauthorized: true,
            minVersion: 'TLSv1.2',
        }, res => {
            clearTimeout(timer);
            if (res.statusCode !== 200) {
                res.destroy();
                req.destroy();
                reject((0, types_1.fail)('EOS_BACKUP_REMOTE_DOWNLOAD'));
                return;
            }
            res.once('close', () => req.destroy());
            resolve(res);
        });
        const timer = setTimeout(() => {
            req.destroy();
            reject((0, types_1.fail)('EOS_BACKUP_TRANSFER_TIMEOUT'));
        }, 5000);
        req.on('error', () => {
            clearTimeout(timer);
            reject((0, types_1.fail)('EOS_BACKUP_REMOTE_DOWNLOAD'));
        });
        req.end();
    });
}
async function receiveRemote(source, destination, size, maximum) {
    if (!Number.isSafeInteger(size) || size < 0 || size > maximum)
        throw (0, types_1.fail)('EOS_BACKUP_ARCHIVE_LIMIT');
    if (source.localPath) {
        await (0, files_1.copyPrivate)(source.localPath, destination);
        try {
            const fd = await (0, promises_1.open)(destination, node_fs_1.constants.O_RDONLY | node_fs_1.constants.O_NOFOLLOW);
            try {
                if ((await fd.stat()).size !== size)
                    throw (0, types_1.fail)('EOS_BACKUP_REMOTE_CHANGED');
            }
            finally {
                await fd.close();
            }
        }
        catch (error) {
            await (0, promises_1.rm)(destination, { force: true });
            throw error;
        }
        return;
    }
    const fd = await (0, promises_1.open)(destination, node_fs_1.constants.O_WRONLY | node_fs_1.constants.O_CREAT | node_fs_1.constants.O_EXCL | node_fs_1.constants.O_NOFOLLOW, 0o600);
    let stream;
    const output = fd.createWriteStream({ autoClose: false });
    let bytes = 0;
    let created = true;
    const bound = new node_stream_1.Transform({
        transform(chunk, _encoding, callback) {
            bytes += chunk.length;
            callback(bytes > maximum || bytes > size ? (0, types_1.fail)('EOS_BACKUP_ARCHIVE_LIMIT') : null, chunk);
        },
    });
    const timer = setTimeout(() => {
        stream?.destroy((0, types_1.fail)('EOS_BACKUP_TRANSFER_TIMEOUT'));
        output.destroy((0, types_1.fail)('EOS_BACKUP_TRANSFER_TIMEOUT'));
    }, 30 * 60 * 1000);
    try {
        stream = await remoteStream(source);
        await (0, promises_2.pipeline)(stream, bound, output);
        if (bytes !== size)
            throw (0, types_1.fail)('EOS_BACKUP_REMOTE_CHANGED');
        await fd.sync();
        created = false;
    }
    finally {
        clearTimeout(timer);
        stream?.destroy();
        bound.destroy();
        output.destroy();
        await fd.close();
        if (created)
            await (0, promises_1.rm)(destination, { force: true });
    }
}
async function storageList(ctx, provider) {
    const client = await (0, storageRemote_1.openStorage)(ctx, provider);
    try {
        const entries = await client.list();
        if (entries.length > 1000)
            throw (0, types_1.fail)('EOS_BACKUP_BROWSER_COUNT');
        return {
            provider: (0, storageRemote_1.providerName)(provider),
            entries: entries
                .sort((a, b) => b.mtime - a.mtime)
                .map(({ name, size, mtime }) => ({
                name,
                size,
                mtime: new Date(mtime).toISOString(),
                format: legacy_1.LEGACY_NAME.test(name) ? 'legacy' : 'nexowatt-encrypted',
            })),
        };
    }
    finally {
        client.close();
    }
}
async function storageFetch(ctx, provider, name) {
    if (!(0, storageRemote_1.remoteName)(name))
        throw (0, types_1.fail)('EOS_BACKUP_REMOTE_NAME');
    const client = await (0, storageRemote_1.openStorage)(ctx, provider), tmp = (0, node_path_1.join)(ctx.workDir, 'download-' + (0, node_crypto_1.randomUUID)());
    const maximum = (0, types_1.num)(ctx.config, 'maxArchiveGiB', 10) * 1024 ** 3, archives = (0, node_path_1.join)(ctx.dataDir, 'archives');
    try {
        await (0, files_1.privateDir)(ctx.workDir);
        await (0, files_1.privateDir)(archives);
        const matches = (await client.list()).filter(entry => entry.name === name);
        if (matches.length !== 1)
            throw (0, types_1.fail)('EOS_BACKUP_REMOTE_AMBIGUOUS');
        const entry = matches[0];
        if (!entry)
            throw (0, types_1.fail)('EOS_BACKUP_REMOTE_MISSING');
        await receiveRemote(await client.download(entry), tmp, entry.size, maximum + 36);
        if (legacy_1.LEGACY_NAME.test(name)) {
            const kind = 'legacy-' + (name.split('_')[0] || 'archive'), dest = (0, node_path_1.join)(archives, `eos-backup-${ctx.jobId}-${kind}-0.nwb`);
            await (0, files_1.encryptFile)(tmp, dest, Buffer.from(ctx.key, 'base64'), maximum);
            await (0, files_1.decryptFile)(dest, undefined, Buffer.from(ctx.key, 'base64'), maximum);
            return {
                ...(await (0, files_1.archiveInfo)(dest, kind)),
                sourceName: name,
                authentication: 'encrypted-and-verified-local-copy; legacy-content-not-trusted',
            };
        }
        if (!files_1.ARCHIVE_NAME.test(name))
            throw (0, types_1.fail)('EOS_BACKUP_REMOTE_NAME');
        const fd = await (0, promises_1.open)(tmp, node_fs_1.constants.O_RDONLY | node_fs_1.constants.O_NOFOLLOW);
        try {
            const magic = Buffer.alloc(8);
            await fd.read(magic, 0, 8, 0);
            if (!magic.equals(Buffer.from('NWEOSBK1')) || entry.size < 36)
                throw (0, types_1.fail)('EOS_BACKUP_ARCHIVE_FORMAT');
        }
        finally {
            await fd.close();
        }
        let authentication = 'verified-with-current-recovery-key';
        try {
            await (0, files_1.decryptFile)(tmp, undefined, Buffer.from(ctx.key, 'base64'), maximum);
        }
        catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'EOS_BACKUP_ARCHIVE_AUTHENTICATION')
                authentication = 'recovery-key-required-or-damaged';
            else
                throw error;
        }
        const dest = (0, node_path_1.join)(archives, name);
        await (0, promises_1.link)(tmp, dest);
        return { ...(await (0, files_1.archiveInfo)(dest, 'remote')), sourceName: name, authentication };
    }
    finally {
        client.close();
        await (0, promises_1.rm)(tmp, { force: true });
    }
}
