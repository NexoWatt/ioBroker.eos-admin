"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGACY_NAME = void 0;
exports.legacyList = legacyList;
exports.legacyImport = legacyImport;
/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const files_1 = require("./files");
const types_1 = require("./types");
exports.LEGACY_NAME = /^(?:iobroker|nexowattEOS|influxDB|mysql|pgsql|sqlite|redis|historyDB|zigbee|zigbee2mqtt|nodered|yahka|jarvis|javascripts|esphome|homematic|grafana)_[A-Za-z0-9_. -]{1,190}\.(?:tar\.gz|tar\.sbk|zip)$/;
async function legacyList(ctx) {
    const root = (0, node_path_1.join)(ctx.installationDir, 'backups');
    let entries;
    try {
        const s = await (0, promises_1.lstat)(root);
        if (!s.isDirectory() || s.isSymbolicLink())
            throw (0, types_1.fail)('EOS_BACKUP_LEGACY_DIRECTORY');
        entries = await (0, promises_1.readdir)(root, { withFileTypes: true });
    }
    catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
            return { provider: 'legacy', entries: [] };
        throw error;
    }
    if (entries.length > 10000)
        throw (0, types_1.fail)('EOS_BACKUP_LEGACY_COUNT');
    const result = [];
    for (const item of entries) {
        if (!item.isFile() || item.isSymbolicLink() || !exports.LEGACY_NAME.test(item.name))
            continue;
        const s = await (0, promises_1.lstat)((0, node_path_1.join)(root, item.name));
        if (!s.isFile() || s.isSymbolicLink())
            continue;
        result.push({ name: item.name, size: s.size, mtime: s.mtime.toISOString() });
        if (result.length >= 1000)
            break;
    }
    return { provider: 'legacy', entries: result.sort((a, b) => b.mtime.localeCompare(a.mtime)) };
}
async function legacyImport(ctx, name) {
    if (!exports.LEGACY_NAME.test(name))
        throw (0, types_1.fail)('EOS_BACKUP_LEGACY_NAME');
    const root = (0, node_path_1.join)(ctx.installationDir, 'backups'), dir = await (0, promises_1.lstat)(root);
    if (!dir.isDirectory() || dir.isSymbolicLink())
        throw (0, types_1.fail)('EOS_BACKUP_LEGACY_DIRECTORY');
    const source = (0, node_path_1.join)(root, name);
    const kind = name.split('_')[0]?.replace(/[^A-Za-z0-9]/g, '') ?? 'archive';
    const dest = (0, node_path_1.join)(ctx.dataDir, 'archives', `eos-backup-${ctx.jobId}-legacy-${kind}-0.nwb`), key = Buffer.from(ctx.key, 'base64'), max = (0, types_1.num)(ctx.config, 'maxArchiveGiB', 10) * 1024 ** 3;
    await (0, files_1.encryptFile)(source, dest, key, max);
    await (0, files_1.decryptFile)(dest, undefined, key, max);
    return (0, files_1.archiveInfo)(dest, 'legacy-' + kind);
}
