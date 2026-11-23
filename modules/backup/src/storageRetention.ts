/** Copyright (c) 2026 NexoWatt. Proprietary. Retention is a count, never an age. */
import { ARCHIVE_NAME } from './files';
import { flag, num, str, fail, type Config } from './types';
export interface RemoteEntry {
    name: string;
    id: string;
    size: number;
    mtime: number;
}
export function archiveKind(name: string): string | null {
    if (!ARCHIVE_NAME.test(name)) return null;
    const matched = /^eos-backup-[0-9a-f-]{36}-(.+)-\d+\.nwb$/.exec(name);
    return matched?.[1] ?? null;
}
export function retentionCount(
    config: Config,
    provider: string,
    runKind: string,
    type: string,
    enabled = true,
): number {
    if (!enabled || !flag(config, provider + 'DeleteOldBackup')) return 0;
    let count =
        flag(config, 'advancedDelete') && provider !== 'cifs'
            ? num(config, provider + 'DeleteAfter', NaN)
            : num(config, runKind === 'ccu' ? 'ccuDeleteAfter' : 'minimalDeleteAfter', NaN);
    if (provider === 'cifs' && str(config, 'connectType') === 'SDCard' && type === 'influxDB')
        count = num(config, 'sdCardInfluxRetention', 3);
    if (!Number.isSafeInteger(count) || count < 0 || count > 3650) throw fail('EOS_BACKUP_CONFIG_RETENTION');
    const prefix =
        type === 'mysql'
            ? 'mySql'
            : type === 'pgsql'
              ? 'pgSql'
              : type === 'ccu'
                ? 'ccu'
                : type === 'influxDB'
                  ? 'influxDB'
                  : null;
    if (prefix && flag(config, prefix + 'Multi')) {
        const events = config[prefix + 'Events'];
        if (!Array.isArray(events) || events.length < 1 || events.length > 128) throw fail('EOS_BACKUP_EVENTS');
        count *= events.length;
    }
    return count;
}
/** Unknown/legacy archives are preserved; only types produced by this successful job may be pruned. */
export function retentionCandidates(
    config: Config,
    provider: string,
    runKind: string,
    entries: readonly RemoteEntry[],
    currentNames: readonly string[],
    enabled = true,
): RemoteEntry[] {
    if (entries.length > 10000) throw fail('EOS_BACKUP_REMOTE_COUNT');
    const types = new Set(
        currentNames.map(archiveKind).filter((type): type is string => type !== null && !type.startsWith('legacy-')),
    );
    const current = new Set(currentNames),
        selected: RemoteEntry[] = [];
    for (const type of types) {
        const count = retentionCount(config, provider, runKind, type, enabled);
        if (!count) continue;
        if (currentNames.some(name => !entries.some(entry => entry.name === name)))
            throw fail('EOS_BACKUP_RETENTION_INCOMPLETE');
        const files = entries.filter(entry => archiveKind(entry.name) === type);
        // Partial listings, duplicate names, or invalid timestamps cannot prove which copies are old.
        if (
            files.some(entry => !Number.isFinite(entry.mtime) || entry.mtime <= 0) ||
            new Set(files.map(entry => entry.name)).size !== files.length
        )
            throw fail('EOS_BACKUP_RETENTION_METADATA');
        files.sort((a, b) => b.mtime - a.mtime || b.name.localeCompare(a.name));
        for (const entry of files.slice(count)) if (!current.has(entry.name)) selected.push(entry);
    }
    return selected;
}
