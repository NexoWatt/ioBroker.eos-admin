/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
import { influxTargets, type InfluxTarget } from './databaseTargets';
import { fail, flag, record, type Config } from './types';
export type HistoryBackupRequirement =
    | { provider: 'influxdb2'; url: string; bucket: string; org: string }
    | { provider: 'postgresql'; namespace: string }
    | { provider: 'adapter'; instance: string }
    | { provider: 'none' | 'unknown' };
export interface BackupCoverage { schema: 'nexowatt-backup-coverage/v1'; complete: boolean; required: string[]; missing: string[]; historyProvider: string; externalTargetConfigured: boolean }
export function historyRequirement(value: unknown): HistoryBackupRequirement {
    if (!record(value)) return { provider: 'unknown' };
    if (value.provider === 'none' || value.provider === 'unknown') return { provider: value.provider };
    if (value.provider === 'adapter' && typeof value.instance === 'string' && /^[a-z][a-z0-9_-]*\.\d+$/.test(value.instance)) return { provider: 'adapter', instance: value.instance };
    if (value.provider === 'postgresql' && typeof value.namespace === 'string' && /^eos-admin\.\d+$/.test(value.namespace)) return { provider: 'postgresql', namespace: value.namespace };
    if (value.provider === 'influxdb2' && typeof value.url === 'string' && typeof value.bucket === 'string' && typeof value.org === 'string' && value.bucket.length > 0 && value.bucket.length <= 256 && value.org.length > 0 && value.org.length <= 256) {
        try {
            const url = new URL(value.url);
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !['/', ''].includes(url.pathname)) return { provider: 'unknown' };
            return { provider: 'influxdb2', url: url.origin, bucket: value.bucket, org: value.org };
        } catch { return { provider: 'unknown' }; }
    }
    return { provider: 'unknown' };
}
function endpoint(value: string): string {
    const url = new URL(value);
    // Loopback aliases target the same local server; all remote hosts stay exact.
    const host = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? 'loopback' : url.hostname.toLowerCase();
    return `${url.protocol}//${host}:${url.port || (url.protocol === 'https:' ? '443' : '80')}`;
}
export function coversInfluxTarget(item: InfluxTarget, requirement: HistoryBackupRequirement): boolean {
    return requirement.provider === 'influxdb2' && item.version === '2.x' && endpoint(item.url) === endpoint(requirement.url) &&
        (!item.bucket || item.bucket === requirement.bucket) && (!item.org || item.org === requirement.org);
}
export function backupCoverage(c: Config, requirement: HistoryBackupRequirement): BackupCoverage {
    const required = ['iobroker', 'eos-profile'], missing: string[] = [];
    if (!flag(c, 'eosProfileEnabled')) missing.push('EOS_BACKUP_EOS_PROFILE_REQUIRED');
    if (requirement.provider === 'influxdb2') {
        required.push('influxDB');
        const target = influxTargets(c).find(item => coversInfluxTarget(item, requirement));
        if (!target) missing.push('EOS_BACKUP_ACTIVE_INFLUX_NOT_COVERED');
    } else if (requirement.provider === 'postgresql') required.push('postgresql-history');
    else if (requirement.provider !== 'none') missing.push('EOS_BACKUP_HISTORY_SCOPE_UNRESOLVED');
    return { schema: 'nexowatt-backup-coverage/v1', complete: missing.length === 0, required, missing, historyProvider: requirement.provider,
        externalTargetConfigured: ['cifs', 'ftp', 'webdav', 'dropbox', 'googledrive', 'onedrive'].some(prefix => flag(c, prefix + 'Enabled')) };
}
export function assertBackupCoverage(c: Config, requirement: HistoryBackupRequirement): BackupCoverage {
    const coverage = backupCoverage(c, requirement);
    if (!coverage.complete) throw fail(coverage.missing[0] ?? 'EOS_BACKUP_INCOMPLETE');
    return coverage;
}
