"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preflightInstallation = preflightInstallation;
exports.assertFreeSpace = assertFreeSpace;
exports.assertControllerDataFolders = assertControllerDataFolders;
/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const command_1 = require("./command");
const databaseTargets_1 = require("./databaseTargets");
const config_1 = require("./config");
const types_1 = require("./types");
async function source(path, directory = true) {
    const full = (0, config_1.safeSourcePath)(path), s = await (0, promises_1.lstat)(full);
    if (s.isSymbolicLink() || (directory ? !s.isDirectory() : !s.isFile()))
        throw (0, types_1.fail)('EOS_BACKUP_SOURCE_TYPE');
    await (0, promises_1.access)(full, node_fs_1.constants.R_OK | (directory ? node_fs_1.constants.X_OK : 0));
}
/** Read-only compatibility gate: no CLI invocation, mount, directory creation or write probe. */
async function preflightInstallation(c, installationDir, eosDataDir) {
    await (0, command_1.controllerCli)(installationDir);
    await source((0, node_path_1.join)(installationDir, 'iobroker-data'));
    await source(eosDataDir);
    for (const [field, program] of [
        ['mySqlEnabled', 'mysqldump'],
        ['pgSqlEnabled', 'pg_dump'],
        ['sqliteEnabled', 'sqlite3'],
        ['redisEnabled', 'redis-cli'],
    ])
        if ((0, types_1.flag)(c, field))
            await (0, command_1.executable)(program);
    for (const target of (0, databaseTargets_1.influxTargets)(c))
        await (0, command_1.executable)(target.version === '2.x' ? 'influx' : 'influxd');
    if ((0, types_1.flag)(c, 'historyEnabled'))
        await source((0, types_1.str)(c, 'historyPath'));
    if ((0, types_1.flag)(c, 'sqliteEnabled'))
        await source((0, types_1.str)(c, 'sqlitePath'), false);
    if ((0, types_1.flag)(c, 'zigbee2mqttEnabled') && (0, types_1.str)(c, 'zigbee2mqttType') === 'local')
        await source((0, types_1.str)(c, 'zigbee2mqttPath'));
    if ((0, types_1.flag)(c, 'redisEnabled') && (0, types_1.str)(c, 'redisType') === 'local')
        await source((0, types_1.str)(c, 'redisPath'));
    if ((0, types_1.flag)(c, 'cifsEnabled')) {
        let target;
        if ((0, types_1.str)(c, 'connectType') === 'SDCard') {
            const sd = require('../upstream/build/lib/sdCard.js');
            target = (await sd.validateSdCardTarget((0, types_1.str)(c, 'sdCardMountPath'), (0, types_1.str)(c, 'sdCardBackupSubDir'), {
                createDirectory: false,
                writeTest: false,
            })).backupDir;
        }
        else
            target =
                (0, types_1.str)(c, 'connectType') === 'Copy' && (0, types_1.flag)(c, 'cifsOwnDir')
                    ? (0, types_1.str)(c, 'cifsMinimalDir')
                    : (0, types_1.str)(c, 'mountedBackupPath', (0, types_1.str)(c, 'cifsDir'));
        if ((0, types_1.str)(c, 'connectType') === 'Copy' && (0, types_1.flag)(c, 'cifsOwnDir') && (0, types_1.flag)(c, 'ccuEnabled')) {
            await source((0, types_1.str)(c, 'cifsCcuDir'));
            await (0, promises_1.access)((0, types_1.str)(c, 'cifsCcuDir'), node_fs_1.constants.R_OK | node_fs_1.constants.W_OK | node_fs_1.constants.X_OK);
        }
        const full = (0, config_1.safeSourcePath)(target);
        if ((await (0, promises_1.realpath)(full)) !== full)
            throw (0, types_1.fail)('EOS_BACKUP_TARGET_SYMLINK');
        await source(full);
        await (0, promises_1.access)(full, node_fs_1.constants.R_OK | node_fs_1.constants.W_OK | node_fs_1.constants.X_OK);
    }
    await assertFreeSpace(eosDataDir, 64 * 1024 ** 2);
}
async function assertFreeSpace(path, minimum) {
    const s = await (0, promises_1.statfs)(path);
    if (s.bavail * s.bsize < minimum)
        throw (0, types_1.fail)('EOS_BACKUP_DISK_SPACE');
}
/** Match controller dataFolder semantics; prevent recursive inclusion of archives, work files or key. */
async function assertControllerDataFolders(values, configDir, backupDir) {
    if (!Array.isArray(values) ||
        values.length > 20000 ||
        values.some(v => typeof v !== 'string' || v.length > 4096 || v.includes('\0')))
        throw (0, types_1.fail)('EOS_BACKUP_DATA_FOLDERS');
    const actualBackup = await (0, promises_1.realpath)(backupDir).catch((error) => {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
            return (0, node_path_1.resolve)(backupDir);
        throw error;
    });
    const inside = (parent, child) => {
        const rel = (0, node_path_1.relative)(parent, child);
        return rel === '' || (!rel.startsWith('..' + node_path_1.sep) && rel !== '..' && !(0, node_path_1.isAbsolute)(rel));
    };
    for (const value of values) {
        const configured = (0, node_path_1.resolve)(configDir, String(value));
        let actual;
        try {
            actual = await (0, promises_1.realpath)(configured);
        }
        catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
                continue;
            throw error;
        }
        if (inside(actual, actualBackup) || inside(actualBackup, actual))
            throw (0, types_1.fail)('EOS_BACKUP_CONTROLLER_DATA_FOLDER_OVERLAP');
    }
}
