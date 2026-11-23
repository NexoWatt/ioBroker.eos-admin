/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
import { constants } from 'node:fs';
import { access, lstat, realpath, statfs } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute, sep } from 'node:path';
import { controllerCli, executable } from './command';
import { safeSourcePath } from './config';
import { fail, flag, str, record, type Config } from './types';

async function source(path: string, directory = true): Promise<void> {
    const full = safeSourcePath(path),
        s = await lstat(full);
    if (s.isSymbolicLink() || (directory ? !s.isDirectory() : !s.isFile())) throw fail('EOS_BACKUP_SOURCE_TYPE');
    await access(full, constants.R_OK | (directory ? constants.X_OK : 0));
}
/** Read-only compatibility gate: no CLI invocation, mount, directory creation or write probe. */
export async function preflightInstallation(c: Config, installationDir: string, eosDataDir: string): Promise<void> {
    await controllerCli(installationDir);
    await source(join(installationDir, 'iobroker-data'));
    await source(eosDataDir);
    for (const [field, program] of [
        ['mySqlEnabled', 'mysqldump'],
        ['pgSqlEnabled', 'pg_dump'],
        ['sqliteEnabled', 'sqlite3'],
        ['redisEnabled', 'redis-cli'],
    ] as const)
        if (flag(c, field)) await executable(program);
    if (flag(c, 'influxDBEnabled')) {
        const targets = flag(c, 'influxDBMulti') && Array.isArray(c.influxDBEvents) ? c.influxDBEvents : [c];
        for (const target of targets) {
            if (!record(target)) throw fail('EOS_BACKUP_EVENTS');
            await executable(
                str(target, target === c ? 'influxDBVersion' : 'dbversion', '1.x') === '2.x' ? 'influx' : 'influxd',
            );
        }
    }
    if (flag(c, 'historyEnabled')) await source(str(c, 'historyPath'));
    if (flag(c, 'sqliteEnabled')) await source(str(c, 'sqlitePath'), false);
    if (flag(c, 'zigbee2mqttEnabled') && str(c, 'zigbee2mqttType') === 'local') await source(str(c, 'zigbee2mqttPath'));
    if (flag(c, 'redisEnabled') && str(c, 'redisType') === 'local') await source(str(c, 'redisPath'));
    if (flag(c, 'cifsEnabled')) {
        let target: string;
        if (str(c, 'connectType') === 'SDCard') {
            const sd = require('../upstream/build/lib/sdCard.js') as {
                validateSdCardTarget: (
                    mount: string,
                    sub: string,
                    options: Record<string, unknown>,
                ) => Promise<{ backupDir: string }>;
            };
            target = (
                await sd.validateSdCardTarget(str(c, 'sdCardMountPath'), str(c, 'sdCardBackupSubDir'), {
                    createDirectory: false,
                    writeTest: false,
                })
            ).backupDir;
        } else
            target =
                str(c, 'connectType') === 'Copy' && flag(c, 'cifsOwnDir')
                    ? str(c, 'cifsMinimalDir')
                    : str(c, 'mountedBackupPath', str(c, 'cifsDir'));
        if (str(c, 'connectType') === 'Copy' && flag(c, 'cifsOwnDir') && flag(c, 'ccuEnabled')) {
            await source(str(c, 'cifsCcuDir'));
            await access(str(c, 'cifsCcuDir'), constants.R_OK | constants.W_OK | constants.X_OK);
        }
        const full = safeSourcePath(target);
        if ((await realpath(full)) !== full) throw fail('EOS_BACKUP_TARGET_SYMLINK');
        await source(full);
        await access(full, constants.R_OK | constants.W_OK | constants.X_OK);
    }
    await assertFreeSpace(eosDataDir, 64 * 1024 ** 2);
}
export async function assertFreeSpace(path: string, minimum: number): Promise<void> {
    const s = await statfs(path);
    if (s.bavail * s.bsize < minimum) throw fail('EOS_BACKUP_DISK_SPACE');
}

/** Match controller dataFolder semantics; prevent recursive inclusion of archives, work files or key. */
export async function assertControllerDataFolders(
    values: unknown,
    configDir: string,
    backupDir: string,
): Promise<void> {
    if (
        !Array.isArray(values) ||
        values.length > 20000 ||
        values.some(v => typeof v !== 'string' || v.length > 4096 || v.includes('\0'))
    )
        throw fail('EOS_BACKUP_DATA_FOLDERS');
    const actualBackup = await realpath(backupDir).catch((error: unknown) => {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return resolve(backupDir);
        throw error;
    });
    const inside = (parent: string, child: string): boolean => {
        const rel = relative(parent, child);
        return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel));
    };
    for (const value of values) {
        const configured = resolve(configDir, String(value));
        let actual: string;
        try {
            actual = await realpath(configured);
        } catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') continue;
            throw error;
        }
        if (inside(actual, actualBackup) || inside(actualBackup, actual))
            throw fail('EOS_BACKUP_CONTROLLER_DATA_FOLDER_OVERLAP');
    }
}
