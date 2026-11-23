/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, rm, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { encryptFile, decryptFile } from './files';
import { fail, record, type JobContext } from './types';
interface Entry {
    source: string;
    value: string;
}
type Cache = Record<string, Entry>;
const NAMES = new Set(['google', 'onedrive', 'dropbox']);
async function read(ctx: JobContext): Promise<Cache> {
    const source = join(ctx.dataDir, 'provider-tokens.nwb'),
        tmp = join(ctx.workDir, 'tokens-' + randomUUID() + '.json');
    try {
        await lstat(source);
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {};
        throw error;
    }
    try {
        await decryptFile(source, tmp, Buffer.from(ctx.key, 'base64'), 128 * 1024);
        const value: unknown = JSON.parse(await readFile(tmp, 'utf8'));
        if (!record(value)) throw fail('EOS_BACKUP_TOKEN_CACHE');
        const result: Cache = {};
        for (const [name, item] of Object.entries(value)) {
            if (
                !NAMES.has(name) ||
                !record(item) ||
                typeof item.source !== 'string' ||
                typeof item.value !== 'string' ||
                item.value.length > 65536 ||
                !/^([a-f0-9]{64})$/.test(item.source)
            )
                throw fail('EOS_BACKUP_TOKEN_CACHE');
            result[name] = { source: item.source, value: item.value };
        }
        return result;
    } finally {
        await rm(tmp, { force: true });
    }
}
function fingerprint(source: string): string {
    return createHash('sha256').update(source).digest('hex');
}
export async function cachedToken(ctx: JobContext, name: string, original: string): Promise<string> {
    if (!NAMES.has(name)) throw fail('EOS_BACKUP_TOKEN_CACHE');
    const item = (await read(ctx))[name];
    return item && item.source === fingerprint(original) ? item.value : original;
}
export async function saveToken(
    ctx: JobContext,
    name: string,
    original: string,
    value: Record<string, unknown>,
): Promise<void> {
    if (!NAMES.has(name)) throw fail('EOS_BACKUP_TOKEN_CACHE');
    const cache = await read(ctx);
    cache[name] = { source: fingerprint(original), value: JSON.stringify(value) };
    const tmp = join(ctx.workDir, 'tokens-' + randomUUID() + '.json'),
        encrypted = join(ctx.dataDir, 'tokens-' + randomUUID() + '.nwb');
    try {
        await writeFile(tmp, JSON.stringify(cache), { flag: 'wx', mode: 0o600 });
        await encryptFile(tmp, encrypted, Buffer.from(ctx.key, 'base64'), 128 * 1024);
        await rename(encrypted, join(ctx.dataDir, 'provider-tokens.nwb'));
    } finally {
        await rm(tmp, { force: true });
        await rm(encrypted, { force: true });
    }
}
