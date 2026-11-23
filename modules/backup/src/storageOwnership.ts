/** Copyright (c) 2026 NexoWatt. Proprietary. Shared targets never imply ownership. */
import { createHmac, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, rm, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { ARCHIVE_NAME, encryptFile, decryptFile, privateDir } from './files';
import { str, flag, fail, type JobContext } from './types';
const MAXIMUM = 8 * 1024 * 1024;
function file(ctx: JobContext, provider: string): string {
    const c = ctx.config;
    const directory = flag(c, provider + 'OwnDir')
        ? str(c, provider + (ctx.kind === 'ccu' ? 'CcuDir' : 'MinimalDir'))
        : str(c, provider + 'Dir');
    const target = [
        provider,
        directory,
        str(c, provider + 'Host'),
        str(c, provider + 'Port'),
        str(c, provider + 'User'),
        str(c, provider + 'URL'),
        str(c, provider + 'Username'),
        str(c, 'mountedBackupPath'),
        str(c, 'sdCardMountPath'),
        str(c, 'sdCardBackupSubDir'),
    ];
    // Original OAuth credentials identify the configured account without retaining
    // any secret in the path; refreshed token cache does not change this scope.
    if (provider === 'googledrive') target.push(str(c, 'googledriveAccessTokens') || str(c, 'googledriveAccessJson'));
    if (provider === 'dropbox')
        target.push(str(c, 'dropboxAccessTokens') || str(c, 'dropboxAccessJson') || str(c, 'dropboxAccessToken'));
    if (provider === 'onedrive') target.push(str(c, 'onedriveAccessJson'));
    const scope = createHmac('sha256', Buffer.from(ctx.key, 'base64')).update(JSON.stringify(target)).digest('hex');
    return join(ctx.dataDir, 'retention', provider + '-' + scope + '.nwb');
}
export async function ownedArchives(ctx: JobContext, provider: string): Promise<Set<string>> {
    const source = file(ctx, provider),
        temporary = join(ctx.workDir, 'ownership-' + randomUUID() + '.json');
    try {
        await lstat(source);
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return new Set();
        throw error;
    }
    try {
        await decryptFile(source, temporary, Buffer.from(ctx.key, 'base64'), MAXIMUM);
        const value: unknown = JSON.parse(await readFile(temporary, 'utf8'));
        if (
            !Array.isArray(value) ||
            value.length > 50000 ||
            value.some(name => typeof name !== 'string' || !ARCHIVE_NAME.test(name))
        )
            throw fail('EOS_BACKUP_RETENTION_OWNERSHIP');
        return new Set(value as string[]);
    } finally {
        await rm(temporary, { force: true });
    }
}
export async function saveOwnedArchives(ctx: JobContext, provider: string, names: ReadonlySet<string>): Promise<void> {
    if (names.size > 50000 || [...names].some(name => !ARCHIVE_NAME.test(name)))
        throw fail('EOS_BACKUP_RETENTION_OWNERSHIP');
    await privateDir(join(ctx.dataDir, 'retention'));
    const plaintext = join(ctx.workDir, 'ownership-' + randomUUID() + '.json'),
        encrypted = file(ctx, provider) + '.' + randomUUID();
    try {
        await writeFile(plaintext, JSON.stringify([...names]), { flag: 'wx', mode: 0o600 });
        await encryptFile(plaintext, encrypted, Buffer.from(ctx.key, 'base64'), MAXIMUM);
        await rename(encrypted, file(ctx, provider));
    } finally {
        await rm(plaintext, { force: true });
        await rm(encrypted, { force: true });
    }
}
