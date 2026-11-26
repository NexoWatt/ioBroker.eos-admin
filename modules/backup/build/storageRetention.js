"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.archiveKind = archiveKind;
exports.retentionCount = retentionCount;
exports.retentionCandidates = retentionCandidates;
/** Copyright (c) 2026 NexoWatt. Proprietary. Retention is a count, never an age. */
const files_1 = require("./files");
const types_1 = require("./types");
function archiveKind(name) {
    if (!files_1.ARCHIVE_NAME.test(name))
        return null;
    const matched = /^eos-backup-[0-9a-f-]{36}-(.+)-\d+\.nwb$/.exec(name);
    return matched?.[1] ?? null;
}
function retentionCount(config, provider, runKind, type, enabled = true) {
    if (!enabled || !(0, types_1.flag)(config, provider + 'DeleteOldBackup'))
        return 0;
    let count = (0, types_1.flag)(config, 'advancedDelete') && provider !== 'cifs'
        ? (0, types_1.num)(config, provider + 'DeleteAfter', NaN)
        : (0, types_1.num)(config, runKind === 'ccu' ? 'ccuDeleteAfter' : 'minimalDeleteAfter', NaN);
    if (provider === 'cifs' && (0, types_1.str)(config, 'connectType') === 'SDCard' && type === 'influxDB')
        count = (0, types_1.num)(config, 'sdCardInfluxRetention', 3);
    if (!Number.isSafeInteger(count) || count < 0 || count > 3650)
        throw (0, types_1.fail)('EOS_BACKUP_CONFIG_RETENTION');
    const prefix = type === 'mysql'
        ? 'mySql'
        : type === 'pgsql'
            ? 'pgSql'
            : type === 'ccu'
                ? 'ccu'
                : type === 'influxDB'
                    ? 'influxDB'
                    : null;
    if (prefix && (0, types_1.flag)(config, prefix + 'Multi')) {
        const events = config[prefix + 'Events'];
        if (!Array.isArray(events) || events.length < 1 || events.length > 128)
            throw (0, types_1.fail)('EOS_BACKUP_EVENTS');
        count *= events.length;
    }
    return count;
}
/** Unknown/legacy archives are preserved; only types produced by this successful job may be pruned. */
function retentionCandidates(config, provider, runKind, entries, currentNames, enabled = true) {
    if (entries.length > 10000)
        throw (0, types_1.fail)('EOS_BACKUP_REMOTE_COUNT');
    const types = new Set(currentNames.map(archiveKind).filter((type) => type !== null && !type.startsWith('legacy-')));
    const current = new Set(currentNames), selected = [];
    // A recovery set is indivisible: keeping its descriptor while pruning an older
    // database component would turn a listed full backup into an unusable set.
    if (types.has('recovery-set')) {
        const count = retentionCount(config, provider, runKind, 'recovery-set', enabled);
        if (!count)
            return [];
        let keep = count;
        if (provider === 'cifs' && (0, types_1.str)(config, 'connectType') === 'SDCard' && types.has('influxDB')) {
            const databaseKeep = (0, types_1.num)(config, 'sdCardInfluxRetention', 3);
            if (!Number.isSafeInteger(databaseKeep) || databaseKeep < 0 || databaseKeep > 3650)
                throw (0, types_1.fail)('EOS_BACKUP_CONFIG_RETENTION');
            if (!databaseKeep)
                return [];
            keep = Math.min(keep, databaseKeep);
        }
        if (currentNames.some(name => !entries.some(entry => entry.name === name)))
            throw (0, types_1.fail)('EOS_BACKUP_RETENTION_INCOMPLETE');
        if (new Set(entries.map(entry => entry.name)).size !== entries.length)
            throw (0, types_1.fail)('EOS_BACKUP_RETENTION_METADATA');
        const descriptors = entries.filter(entry => archiveKind(entry.name) === 'recovery-set');
        if (descriptors.some(entry => !Number.isFinite(entry.mtime) || entry.mtime <= 0))
            throw (0, types_1.fail)('EOS_BACKUP_RETENTION_METADATA');
        descriptors.sort((a, b) => b.mtime - a.mtime || b.name.localeCompare(a.name));
        const oldJobs = new Set(descriptors.slice(keep).filter(entry => !current.has(entry.name)).map(entry => entry.name.slice(0, 48)));
        return entries.filter(entry => archiveKind(entry.name) !== null && oldJobs.has(entry.name.slice(0, 48)) && !current.has(entry.name));
    }
    for (const type of types) {
        const count = retentionCount(config, provider, runKind, type, enabled);
        if (!count)
            continue;
        if (currentNames.some(name => !entries.some(entry => entry.name === name)))
            throw (0, types_1.fail)('EOS_BACKUP_RETENTION_INCOMPLETE');
        const files = entries.filter(entry => archiveKind(entry.name) === type);
        // Partial listings, duplicate names, or invalid timestamps cannot prove which copies are old.
        if (files.some(entry => !Number.isFinite(entry.mtime) || entry.mtime <= 0) ||
            new Set(files.map(entry => entry.name)).size !== files.length)
            throw (0, types_1.fail)('EOS_BACKUP_RETENTION_METADATA');
        files.sort((a, b) => b.mtime - a.mtime || b.name.localeCompare(a.name));
        for (const entry of files.slice(count))
            if (!current.has(entry.name))
                selected.push(entry);
    }
    return selected;
}
