/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
import { validateExtraConfig } from './extras';
import { influxTargets } from './databaseTargets';
import { validateNotificationConfig } from './notifications';
import { readFileSync } from 'node:fs';
import { join, isAbsolute, resolve } from 'node:path';
import { record, fail, str, num, flag, type Config } from './types';
import { backupCronExpression, nextCronInvocation } from './scheduler';
const defaults: unknown = JSON.parse(readFileSync(join(__dirname, '../defaults.json'), 'utf8'));
const BOOL_FIELDS = [
    'minimalEnabled',
    'ccuEnabled',
    'iobrokerCron',
    'ccuCron',
    'eosProfileEnabled',
    'eosIncludeVendorFile',
    'eosIncludeVendorSecret',
    'cifsEnabled',
    'ftpEnabled',
    'webdavEnabled',
    'dropboxEnabled',
    'googledriveEnabled',
    'onedriveEnabled',
    'mySqlEnabled',
    'pgSqlEnabled',
    'sqliteEnabled',
    'influxDBEnabled',
    'redisEnabled',
    'historyEnabled',
    'zigbeeEnabled',
    'zigbee2mqttEnabled',
    'noderedEnabled',
    'yahkaEnabled',
    'jarvisEnabled',
    'esphomeEnabled',
    'javascriptsEnabled',
    'grafanaEnabled',
    'notificationEnabled',
];
const unsafeSources = ['/proc', '/sys', '/dev', '/root'];
export function safeSourcePath(value: unknown): string {
    if (typeof value !== 'string' || !isAbsolute(value) || value.includes('\0') || value.includes('\n'))
        throw fail('EOS_BACKUP_SOURCE_PATH');
    const full = resolve(value);
    if (full === '/' || unsafeSources.some(p => full === p || full.startsWith(p + '/')))
        throw fail('EOS_BACKUP_SOURCE_PATH');
    return full;
}
export function validateConfig(input: unknown): Config {
    if (!record(input) || !record(defaults)) throw fail('EOS_BACKUP_CONFIG');
    const text = JSON.stringify(input);
    if (Buffer.byteLength(text) > 512 * 1024) throw fail('EOS_BACKUP_CONFIG_SIZE');
    const walk = (v: unknown, depth = 0): void => {
        if (depth > 12) throw fail('EOS_BACKUP_CONFIG_DEPTH');
        if (Array.isArray(v)) {
            if (v.length > 128) throw fail('EOS_BACKUP_CONFIG_ARRAY');
            v.forEach(x => walk(x, depth + 1));
        } else if (record(v)) {
            for (const [key, value] of Object.entries(v)) {
                if (['__proto__', 'prototype', 'constructor'].includes(key)) throw fail('EOS_BACKUP_CONFIG_KEY');
                walk(value, depth + 1);
            }
        } else if (typeof v === 'string' && v.length > 65536) throw fail('EOS_BACKUP_CONFIG_VALUE');
    };
    walk(input);
    const copied: unknown = JSON.parse(text);
    if (!record(copied)) throw fail('EOS_BACKUP_CONFIG');
    const c: Config = { ...defaults, ...copied, enabled: input.enabled === true };
    for (const key of BOOL_FIELDS) if (typeof c[key] !== 'boolean') throw fail('EOS_BACKUP_CONFIG_BOOLEAN');
    for (const key of ['minimalTime', 'ccuTime'])
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(str(c, key))) throw fail('EOS_BACKUP_CONFIG_TIME');
    for (const key of ['minimalDeleteAfter', 'ccuDeleteAfter', 'historyEntriesNumber']) {
        const n = num(c, key, NaN);
        if (!Number.isInteger(n) || n < 0 || n > 3650) throw fail('EOS_BACKUP_CONFIG_RETENTION');
        c[key] = n;
    }
    for (const key of ['minimalEveryXDays', 'ccuEveryXDays']) {
        const n = num(c, key, NaN);
        if (!Number.isInteger(n) || n < 1 || n > 365) throw fail('EOS_BACKUP_CONFIG_INTERVAL');
        c[key] = n;
    }
    for (const key of ['minimalNameSuffix', 'ccuNameSuffix', 'slaveNameSuffix'])
        if (!/^[\p{L}\p{N}_. -]{0,80}$/u.test(str(c, key))) throw fail('EOS_BACKUP_CONFIG_NAME');
    const deadline = num(c, 'jobTimeoutMinutes', 30);
    if (!Number.isInteger(deadline) || deadline < 1 || deadline > 120) throw fail('EOS_BACKUP_CONFIG_DEADLINE');
    c.jobTimeoutMinutes = deadline;
    c.maxArchiveGiB = num(c, 'maxArchiveGiB', 10);
    if (!Number.isInteger(c.maxArchiveGiB) || Number(c.maxArchiveGiB) < 1 || Number(c.maxArchiveGiB) > 100)
        throw fail('EOS_BACKUP_CONFIG_LIMIT');
    if (c.enabled) preflight(c);
    return c;
}
/** Fail before changing a legacy instance when its operating mode cannot be preserved safely. */
export function preflight(c: Config): void {
    influxTargets(c);
    for (const kind of ['iobroker', 'ccu'] as const) {
        if (flag(c, kind === 'iobroker' ? 'minimalEnabled' : 'ccuEnabled'))
            nextCronInvocation(backupCronExpression(c, kind), Date.now());
    }
    if (!['Single'].includes(str(c, 'hostType', 'Single'))) throw fail('EOS_BACKUP_MIGRATION_MULTIHOST_REVIEW');
    if (flag(c, 'mysqlSkipSSL') && flag(c, 'mySqlEnabled')) throw fail('EOS_BACKUP_MYSQL_TLS_REVIEW');
    if (flag(c, 'ignoreErrors')) throw fail('EOS_BACKUP_PARTIAL_SUCCESS_REVIEW');
    validateExtraConfig(c);
    validateNotificationConfig(c);
    if (flag(c, 'ccuEnabled') && flag(c, 'ccuUsehttps') && c.ccuSignedCertificates === false)
        throw fail('EOS_BACKUP_TLS_REQUIRED');
    if (flag(c, 'cifsEnabled')) {
        const type = str(c, 'connectType');
        if (!['Copy', 'SDCard', 'CIFS', 'NFS'].includes(type)) throw fail('EOS_BACKUP_MIGRATION_MOUNT_REVIEW');
        if (flag(c, 'cifsOwnDir') && !['Copy', 'SDCard'].includes(type))
            throw fail('EOS_BACKUP_PREMOUNT_PER_KIND_REQUIRED');
        if (type === 'SDCard') safeSourcePath(str(c, 'sdCardMountPath'));
        else {
            if (type === 'Copy' && flag(c, 'cifsOwnDir')) {
                safeSourcePath(str(c, 'cifsMinimalDir'));
                safeSourcePath(str(c, 'cifsCcuDir'));
            }
            const target =
                type === 'Copy' && flag(c, 'cifsOwnDir')
                    ? str(c, 'cifsMinimalDir')
                    : str(c, 'mountedBackupPath', str(c, 'cifsDir'));
            safeSourcePath(target);
            if (!['Copy'].includes(type) && !str(c, 'mountedBackupPath')) throw fail('EOS_BACKUP_PREMOUNT_REQUIRED');
        }
    }
    for (const [enabled, key] of [['webdavEnabled', 'webdavURL']] as const) {
        if (flag(c, enabled)) {
            const u = new URL(str(c, key));
            if (u.protocol !== 'https:' || u.username || u.password || u.hash) throw fail('EOS_BACKUP_TLS_REQUIRED');
        }
    }
    if (flag(c, 'webdavEnabled') && c.webdavSignedCertificates === false) throw fail('EOS_BACKUP_TLS_REQUIRED');
    if (flag(c, 'ftpEnabled') && (c.ftpSecure !== true || c.ftpSignedCertificates === false))
        throw fail('EOS_BACKUP_FTPS_REQUIRED');
    if (
        flag(c, 'dropboxEnabled') &&
        (str(c, 'dropboxTokenType') === 'custom'
            ? !str(c, 'dropboxAccessToken')
            : !str(c, 'dropboxAccessTokens') && !str(c, 'dropboxAccessJson'))
    )
        throw fail('EOS_BACKUP_DROPBOX_TOKEN_REQUIRED');
    if (flag(c, 'googledriveEnabled') && !str(c, 'googledriveAccessTokens') && !str(c, 'googledriveAccessJson'))
        throw fail('EOS_BACKUP_GOOGLE_TOKEN_REQUIRED');
    if (flag(c, 'onedriveEnabled') && !str(c, 'onedriveAccessJson')) throw fail('EOS_BACKUP_ONEDRIVE_TOKEN_REQUIRED');
    for (const [enabled, key, base] of [
        ['pgSqlEnabled', 'pgSqlDumpExe', 'pg_dump'],
        ['mySqlEnabled', 'mySqlDumpExe', 'mysqldump'],
        ['sqliteEnabled', 'sqliteDumpExe', 'sqlite3'],
        ['influxDBEnabled', 'influxDBDumpExe', str(c, 'influxDBVersion') === '2.x' ? 'influx' : 'influxd'],
    ] as const) {
        const path = str(c, key);
        if (
            flag(c, enabled) &&
            path &&
            !['/usr/bin/' + base, '/usr/local/bin/' + base, '/bin/' + base, base].includes(path)
        )
            throw fail('EOS_BACKUP_EXECUTABLE_REVIEW');
    }
}
export async function preflightLegacyConfig(
    input: unknown,
    context?: unknown,
): Promise<{ config: Config; omittedFields: string[] }> {
    const c = validateConfig({ ...(record(input) ? input : {}), enabled: false });
    const active = !record(context) || context.sourceEnabled !== false;
    if (
        record(context) &&
        record(context.owner) &&
        typeof context.owner.getForeignStateAsync === 'function' &&
        typeof context.source === 'string' &&
        /^(?:system\.adapter\.)?nexowatt-backup\.\d+$/.test(context.source)
    ) {
        for (const [provider, field] of [
            ['dropbox', 'dropboxAccessTokens'],
            ['googledrive', 'googledriveAccessTokens'],
        ] as const) {
            if (!flag(c, provider + 'Enabled') || str(c, field)) continue;
            const state: unknown = await (context.owner.getForeignStateAsync as (id: string) => Promise<unknown>)(
                context.source.replace(/^system\.adapter\./, '') + '.info.' + provider + 'Tokens',
            );
            if (record(state) && state.ack === true && typeof state.val === 'string' && state.val.length <= 65536) {
                let parsed: unknown;
                try {
                    parsed = JSON.parse(state.val);
                } catch {
                    throw fail('EOS_BACKUP_LEGACY_OAUTH_FORMAT');
                }
                if (!record(parsed)) throw fail('EOS_BACKUP_LEGACY_OAUTH_FORMAT');
                c[field] = state.val;
            }
        }
    }
    if (active) preflight(c);
    const keys = ['ccu', 'mySql', 'pgSql'];
    const encrypted = keys.some(
        key =>
            flag(c, key + 'Multi') &&
            Array.isArray(c[key + 'Events']) &&
            (c[key + 'Events'] as unknown[]).some(v => record(v) && typeof v.pass === 'string' && v.pass !== ''),
    );
    if (encrypted) {
        if (!record(context) || !record(context.owner) || typeof context.owner.getForeignObjectAsync !== 'function')
            throw fail('EOS_BACKUP_LEGACY_SECRET_UNAVAILABLE');
        const object: unknown = await (context.owner.getForeignObjectAsync as (id: string) => Promise<unknown>)(
            'system.config',
        );
        if (
            !record(object) ||
            !record(object.native) ||
            typeof object.native.secret !== 'string' ||
            object.native.secret.length === 0
        )
            throw fail('EOS_BACKUP_LEGACY_SECRET_UNAVAILABLE');
        const secret = object.native.secret;
        for (const key of keys) {
            if (!flag(c, key + 'Multi') || !Array.isArray(c[key + 'Events'])) continue;
            for (const item of c[key + 'Events'] as unknown[]) {
                if (record(item) && typeof item.pass === 'string' && item.pass) {
                    const encryptedPass = item.pass;
                    let decoded = '';
                    for (let i = 0; i < encryptedPass.length; i++)
                        decoded += String.fromCharCode(
                            encryptedPass.charCodeAt(i) ^ secret.charCodeAt(i % secret.length),
                        );
                    item.pass = decoded;
                }
            }
        }
    }
    if (active && record(context) && context.sourceEnabled === true) {
        if (typeof context.installationDir !== 'string' || typeof context.eosDataDir !== 'string')
            throw fail('EOS_BACKUP_INSTALLATION_CONTEXT');
        const { preflightInstallation, assertControllerDataFolders } = await import('./preflight.js');
        await preflightInstallation(c, context.installationDir, context.eosDataDir);
        if (
            !record(context.owner) ||
            typeof context.owner.getObjectViewAsync !== 'function' ||
            typeof context.dataDir !== 'string'
        )
            throw fail('EOS_BACKUP_CONTROLLER_PREFLIGHT_UNAVAILABLE');
        const view: unknown = await (
            context.owner.getObjectViewAsync as (
                design: string,
                search: string,
                options: Record<string, unknown>,
            ) => Promise<unknown>
        )('system', 'instance', { startkey: 'system.adapter.', endkey: 'system.adapter.\u9999' });
        if (!record(view) || !Array.isArray(view.rows) || view.rows.length > 20000)
            throw fail('EOS_BACKUP_DATA_FOLDERS');
        const folders: string[] = [];
        for (const row of view.rows) {
            if (
                record(row) &&
                record(row.value) &&
                record(row.value.common) &&
                typeof row.value.common.dataFolder === 'string'
            )
                folders.push(row.value.common.dataFolder);
        }
        await assertControllerDataFolders(folders, join(context.eosDataDir, '..'), context.dataDir);
    }
    return { config: c, omittedFields: [] };
}
export const migrateLegacyConfig = preflightLegacyConfig;
