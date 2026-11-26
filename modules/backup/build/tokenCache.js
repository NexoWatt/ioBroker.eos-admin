"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cachedToken = cachedToken;
exports.saveToken = saveToken;
/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const files_1 = require("./files");
const types_1 = require("./types");
const NAMES = new Set(['google', 'onedrive', 'dropbox']);
async function read(ctx) {
    const source = (0, node_path_1.join)(ctx.dataDir, 'provider-tokens.nwb'), tmp = (0, node_path_1.join)(ctx.workDir, 'tokens-' + (0, node_crypto_1.randomUUID)() + '.json');
    try {
        await (0, promises_1.lstat)(source);
    }
    catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
            return {};
        throw error;
    }
    try {
        await (0, files_1.decryptFile)(source, tmp, Buffer.from(ctx.key, 'base64'), 128 * 1024);
        const value = JSON.parse(await (0, promises_1.readFile)(tmp, 'utf8'));
        if (!(0, types_1.record)(value))
            throw (0, types_1.fail)('EOS_BACKUP_TOKEN_CACHE');
        const result = {};
        for (const [name, item] of Object.entries(value)) {
            if (!NAMES.has(name) ||
                !(0, types_1.record)(item) ||
                typeof item.source !== 'string' ||
                typeof item.value !== 'string' ||
                item.value.length > 65536 ||
                !/^([a-f0-9]{64})$/.test(item.source))
                throw (0, types_1.fail)('EOS_BACKUP_TOKEN_CACHE');
            result[name] = { source: item.source, value: item.value };
        }
        return result;
    }
    finally {
        await (0, promises_1.rm)(tmp, { force: true });
    }
}
function fingerprint(source) {
    return (0, node_crypto_1.createHash)('sha256').update(source).digest('hex');
}
async function cachedToken(ctx, name, original) {
    if (!NAMES.has(name))
        throw (0, types_1.fail)('EOS_BACKUP_TOKEN_CACHE');
    const item = (await read(ctx))[name];
    return item && item.source === fingerprint(original) ? item.value : original;
}
async function saveToken(ctx, name, original, value) {
    if (!NAMES.has(name))
        throw (0, types_1.fail)('EOS_BACKUP_TOKEN_CACHE');
    const cache = await read(ctx);
    cache[name] = { source: fingerprint(original), value: JSON.stringify(value) };
    const tmp = (0, node_path_1.join)(ctx.workDir, 'tokens-' + (0, node_crypto_1.randomUUID)() + '.json'), encrypted = (0, node_path_1.join)(ctx.dataDir, 'tokens-' + (0, node_crypto_1.randomUUID)() + '.nwb');
    try {
        await (0, promises_1.writeFile)(tmp, JSON.stringify(cache), { flag: 'wx', mode: 0o600 });
        await (0, files_1.encryptFile)(tmp, encrypted, Buffer.from(ctx.key, 'base64'), 128 * 1024);
        await (0, promises_1.rename)(encrypted, (0, node_path_1.join)(ctx.dataDir, 'provider-tokens.nwb'));
    }
    finally {
        await (0, promises_1.rm)(tmp, { force: true });
        await (0, promises_1.rm)(encrypted, { force: true });
    }
}
