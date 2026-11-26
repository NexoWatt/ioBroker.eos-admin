"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ownedArchives = ownedArchives;
exports.saveOwnedArchives = saveOwnedArchives;
/** Copyright (c) 2026 NexoWatt. Proprietary. Shared targets never imply ownership. */
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const files_1 = require("./files");
const types_1 = require("./types");
const MAXIMUM = 8 * 1024 * 1024;
function file(ctx, provider) {
    const c = ctx.config;
    const directory = (0, types_1.flag)(c, provider + 'OwnDir')
        ? (0, types_1.str)(c, provider + (ctx.kind === 'ccu' ? 'CcuDir' : 'MinimalDir'))
        : (0, types_1.str)(c, provider + 'Dir');
    const target = [
        provider,
        directory,
        (0, types_1.str)(c, provider + 'Host'),
        (0, types_1.str)(c, provider + 'Port'),
        (0, types_1.str)(c, provider + 'User'),
        (0, types_1.str)(c, provider + 'URL'),
        (0, types_1.str)(c, provider + 'Username'),
        (0, types_1.str)(c, 'mountedBackupPath'),
        (0, types_1.str)(c, 'sdCardMountPath'),
        (0, types_1.str)(c, 'sdCardBackupSubDir'),
    ];
    // Original OAuth credentials identify the configured account without retaining
    // any secret in the path; refreshed token cache does not change this scope.
    if (provider === 'googledrive')
        target.push((0, types_1.str)(c, 'googledriveAccessTokens') || (0, types_1.str)(c, 'googledriveAccessJson'));
    if (provider === 'dropbox')
        target.push((0, types_1.str)(c, 'dropboxAccessTokens') || (0, types_1.str)(c, 'dropboxAccessJson') || (0, types_1.str)(c, 'dropboxAccessToken'));
    if (provider === 'onedrive')
        target.push((0, types_1.str)(c, 'onedriveAccessJson'));
    const scope = (0, node_crypto_1.createHmac)('sha256', Buffer.from(ctx.key, 'base64')).update(JSON.stringify(target)).digest('hex');
    return (0, node_path_1.join)(ctx.dataDir, 'retention', provider + '-' + scope + '.nwb');
}
async function ownedArchives(ctx, provider) {
    const source = file(ctx, provider), temporary = (0, node_path_1.join)(ctx.workDir, 'ownership-' + (0, node_crypto_1.randomUUID)() + '.json');
    try {
        await (0, promises_1.lstat)(source);
    }
    catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
            return new Set();
        throw error;
    }
    try {
        await (0, files_1.decryptFile)(source, temporary, Buffer.from(ctx.key, 'base64'), MAXIMUM);
        const value = JSON.parse(await (0, promises_1.readFile)(temporary, 'utf8'));
        if (!Array.isArray(value) ||
            value.length > 50000 ||
            value.some(name => typeof name !== 'string' || !files_1.ARCHIVE_NAME.test(name)))
            throw (0, types_1.fail)('EOS_BACKUP_RETENTION_OWNERSHIP');
        return new Set(value);
    }
    finally {
        await (0, promises_1.rm)(temporary, { force: true });
    }
}
async function saveOwnedArchives(ctx, provider, names) {
    if (names.size > 50000 || [...names].some(name => !files_1.ARCHIVE_NAME.test(name)))
        throw (0, types_1.fail)('EOS_BACKUP_RETENTION_OWNERSHIP');
    await (0, files_1.privateDir)((0, node_path_1.join)(ctx.dataDir, 'retention'));
    const plaintext = (0, node_path_1.join)(ctx.workDir, 'ownership-' + (0, node_crypto_1.randomUUID)() + '.json'), encrypted = file(ctx, provider) + '.' + (0, node_crypto_1.randomUUID)();
    try {
        await (0, promises_1.writeFile)(plaintext, JSON.stringify([...names]), { flag: 'wx', mode: 0o600 });
        await (0, files_1.encryptFile)(plaintext, encrypted, Buffer.from(ctx.key, 'base64'), MAXIMUM);
        await (0, promises_1.rename)(encrypted, file(ctx, provider));
    }
    finally {
        await (0, promises_1.rm)(plaintext, { force: true });
        await (0, promises_1.rm)(encrypted, { force: true });
    }
}
