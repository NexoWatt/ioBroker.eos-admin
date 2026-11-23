/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { encryptFile, archiveInfo, decryptFile } from './files';
import { fail, num, type JobContext, type ArchiveInfo } from './types';
export const LEGACY_NAME =
    /^(?:iobroker|nexowattEOS|influxDB|mysql|pgsql|sqlite|redis|historyDB|zigbee|zigbee2mqtt|nodered|yahka|jarvis|javascripts|esphome|homematic|grafana)_[A-Za-z0-9_. -]{1,190}\.(?:tar\.gz|tar\.sbk|zip)$/;
export async function legacyList(ctx: JobContext): Promise<Record<string, unknown>> {
    const root = join(ctx.installationDir, 'backups');
    let entries;
    try {
        const s = await lstat(root);
        if (!s.isDirectory() || s.isSymbolicLink()) throw fail('EOS_BACKUP_LEGACY_DIRECTORY');
        entries = await readdir(root, { withFileTypes: true });
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
            return { provider: 'legacy', entries: [] };
        throw error;
    }
    if (entries.length > 10000) throw fail('EOS_BACKUP_LEGACY_COUNT');
    const result = [];
    for (const item of entries) {
        if (!item.isFile() || item.isSymbolicLink() || !LEGACY_NAME.test(item.name)) continue;
        const s = await lstat(join(root, item.name));
        if (!s.isFile() || s.isSymbolicLink()) continue;
        result.push({ name: item.name, size: s.size, mtime: s.mtime.toISOString() });
        if (result.length >= 1000) break;
    }
    return { provider: 'legacy', entries: result.sort((a, b) => b.mtime.localeCompare(a.mtime)) };
}
export async function legacyImport(ctx: JobContext, name: string): Promise<ArchiveInfo> {
    if (!LEGACY_NAME.test(name)) throw fail('EOS_BACKUP_LEGACY_NAME');
    const root = join(ctx.installationDir, 'backups'),
        dir = await lstat(root);
    if (!dir.isDirectory() || dir.isSymbolicLink()) throw fail('EOS_BACKUP_LEGACY_DIRECTORY');
    const source = join(root, name);
    const kind = name.split('_')[0]?.replace(/[^A-Za-z0-9]/g, '') ?? 'archive';
    const dest = join(ctx.dataDir, 'archives', `eos-backup-${ctx.jobId}-legacy-${kind}-0.nwb`),
        key = Buffer.from(ctx.key, 'base64'),
        max = num(ctx.config, 'maxArchiveGiB', 10) * 1024 ** 3;
    await encryptFile(source, dest, key, max);
    await decryptFile(dest, undefined, key, max);
    return archiveInfo(dest, 'legacy-' + kind);
}
