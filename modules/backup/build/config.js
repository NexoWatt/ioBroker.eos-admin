"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateLegacyConfig = void 0;
exports.safeSourcePath = safeSourcePath;
exports.validateConfig = validateConfig;
exports.preflight = preflight;
exports.preflightLegacyConfig = preflightLegacyConfig;
/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
const extras_1 = require("./extras");
const databaseTargets_1 = require("./databaseTargets");
const notifications_1 = require("./notifications");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const types_1 = require("./types");
const scheduler_1 = require("./scheduler");
const defaults = JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '../defaults.json'), 'utf8'));
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
function safeSourcePath(value) {
    if (typeof value !== 'string' || !(0, node_path_1.isAbsolute)(value) || value.includes('\0') || value.includes('\n'))
        throw (0, types_1.fail)('EOS_BACKUP_SOURCE_PATH');
    const full = (0, node_path_1.resolve)(value);
    if (full === '/' || unsafeSources.some(p => full === p || full.startsWith(p + '/')))
        throw (0, types_1.fail)('EOS_BACKUP_SOURCE_PATH');
    return full;
}
function validateConfig(input) {
    if (!(0, types_1.record)(input) || !(0, types_1.record)(defaults))
        throw (0, types_1.fail)('EOS_BACKUP_CONFIG');
    const text = JSON.stringify(input);
    if (Buffer.byteLength(text) > 512 * 1024)
        throw (0, types_1.fail)('EOS_BACKUP_CONFIG_SIZE');
    const walk = (v, depth = 0) => {
        if (depth > 12)
            throw (0, types_1.fail)('EOS_BACKUP_CONFIG_DEPTH');
        if (Array.isArray(v)) {
            if (v.length > 128)
                throw (0, types_1.fail)('EOS_BACKUP_CONFIG_ARRAY');
            v.forEach(x => walk(x, depth + 1));
        }
        else if ((0, types_1.record)(v)) {
            for (const [key, value] of Object.entries(v)) {
                if (['__proto__', 'prototype', 'constructor'].includes(key))
                    throw (0, types_1.fail)('EOS_BACKUP_CONFIG_KEY');
                walk(value, depth + 1);
            }
        }
        else if (typeof v === 'string' && v.length > 65536)
            throw (0, types_1.fail)('EOS_BACKUP_CONFIG_VALUE');
    };
    walk(input);
    const copied = JSON.parse(text);
    if (!(0, types_1.record)(copied))
        throw (0, types_1.fail)('EOS_BACKUP_CONFIG');
    const c = { ...defaults, ...copied, enabled: input.enabled === true };
    for (const key of BOOL_FIELDS)
        if (typeof c[key] !== 'boolean')
            throw (0, types_1.fail)('EOS_BACKUP_CONFIG_BOOLEAN');
    for (const key of ['minimalTime', 'ccuTime'])
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test((0, types_1.str)(c, key)))
            throw (0, types_1.fail)('EOS_BACKUP_CONFIG_TIME');
    for (const key of ['minimalDeleteAfter', 'ccuDeleteAfter', 'historyEntriesNumber']) {
        const n = (0, types_1.num)(c, key, NaN);
        if (!Number.isInteger(n) || n < 0 || n > 3650)
            throw (0, types_1.fail)('EOS_BACKUP_CONFIG_RETENTION');
        c[key] = n;
    }
    for (const key of ['minimalEveryXDays', 'ccuEveryXDays']) {
        const n = (0, types_1.num)(c, key, NaN);
        if (!Number.isInteger(n) || n < 1 || n > 365)
            throw (0, types_1.fail)('EOS_BACKUP_CONFIG_INTERVAL');
        c[key] = n;
    }
    for (const key of ['minimalNameSuffix', 'ccuNameSuffix', 'slaveNameSuffix'])
        if (!/^[\p{L}\p{N}_. -]{0,80}$/u.test((0, types_1.str)(c, key)))
            throw (0, types_1.fail)('EOS_BACKUP_CONFIG_NAME');
    const deadline = (0, types_1.num)(c, 'jobTimeoutMinutes', 30);
    if (!Number.isInteger(deadline) || deadline < 1 || deadline > 120)
        throw (0, types_1.fail)('EOS_BACKUP_CONFIG_DEADLINE');
    c.jobTimeoutMinutes = deadline;
    c.maxArchiveGiB = (0, types_1.num)(c, 'maxArchiveGiB', 10);
    if (!Number.isInteger(c.maxArchiveGiB) || Number(c.maxArchiveGiB) < 1 || Number(c.maxArchiveGiB) > 100)
        throw (0, types_1.fail)('EOS_BACKUP_CONFIG_LIMIT');
    if (c.enabled)
        preflight(c);
    return c;
}
/** Fail before changing a legacy instance when its operating mode cannot be preserved safely. */
function preflight(c) {
    (0, databaseTargets_1.influxTargets)(c);
    for (const kind of ['iobroker', 'ccu']) {
        if ((0, types_1.flag)(c, kind === 'iobroker' ? 'minimalEnabled' : 'ccuEnabled'))
            (0, scheduler_1.nextCronInvocation)((0, scheduler_1.backupCronExpression)(c, kind), Date.now());
    }
    if (!['Single'].includes((0, types_1.str)(c, 'hostType', 'Single')))
        throw (0, types_1.fail)('EOS_BACKUP_MIGRATION_MULTIHOST_REVIEW');
    if ((0, types_1.flag)(c, 'mysqlSkipSSL') && (0, types_1.flag)(c, 'mySqlEnabled'))
        throw (0, types_1.fail)('EOS_BACKUP_MYSQL_TLS_REVIEW');
    if ((0, types_1.flag)(c, 'ignoreErrors'))
        throw (0, types_1.fail)('EOS_BACKUP_PARTIAL_SUCCESS_REVIEW');
    (0, extras_1.validateExtraConfig)(c);
    (0, notifications_1.validateNotificationConfig)(c);
    if ((0, types_1.flag)(c, 'ccuEnabled') && (0, types_1.flag)(c, 'ccuUsehttps') && c.ccuSignedCertificates === false)
        throw (0, types_1.fail)('EOS_BACKUP_TLS_REQUIRED');
    if ((0, types_1.flag)(c, 'cifsEnabled')) {
        const type = (0, types_1.str)(c, 'connectType');
        if (!['Copy', 'SDCard', 'CIFS', 'NFS'].includes(type))
            throw (0, types_1.fail)('EOS_BACKUP_MIGRATION_MOUNT_REVIEW');
        if ((0, types_1.flag)(c, 'cifsOwnDir') && !['Copy', 'SDCard'].includes(type))
            throw (0, types_1.fail)('EOS_BACKUP_PREMOUNT_PER_KIND_REQUIRED');
        if (type === 'SDCard')
            safeSourcePath((0, types_1.str)(c, 'sdCardMountPath'));
        else {
            if (type === 'Copy' && (0, types_1.flag)(c, 'cifsOwnDir')) {
                safeSourcePath((0, types_1.str)(c, 'cifsMinimalDir'));
                safeSourcePath((0, types_1.str)(c, 'cifsCcuDir'));
            }
            const target = type === 'Copy' && (0, types_1.flag)(c, 'cifsOwnDir')
                ? (0, types_1.str)(c, 'cifsMinimalDir')
                : (0, types_1.str)(c, 'mountedBackupPath', (0, types_1.str)(c, 'cifsDir'));
            safeSourcePath(target);
            if (!['Copy'].includes(type) && !(0, types_1.str)(c, 'mountedBackupPath'))
                throw (0, types_1.fail)('EOS_BACKUP_PREMOUNT_REQUIRED');
        }
    }
    for (const [enabled, key] of [['webdavEnabled', 'webdavURL']]) {
        if ((0, types_1.flag)(c, enabled)) {
            const u = new URL((0, types_1.str)(c, key));
            if (u.protocol !== 'https:' || u.username || u.password || u.hash)
                throw (0, types_1.fail)('EOS_BACKUP_TLS_REQUIRED');
        }
    }
    if ((0, types_1.flag)(c, 'webdavEnabled') && c.webdavSignedCertificates === false)
        throw (0, types_1.fail)('EOS_BACKUP_TLS_REQUIRED');
    if ((0, types_1.flag)(c, 'ftpEnabled') && (c.ftpSecure !== true || c.ftpSignedCertificates === false))
        throw (0, types_1.fail)('EOS_BACKUP_FTPS_REQUIRED');
    if ((0, types_1.flag)(c, 'dropboxEnabled') &&
        ((0, types_1.str)(c, 'dropboxTokenType') === 'custom'
            ? !(0, types_1.str)(c, 'dropboxAccessToken')
            : !(0, types_1.str)(c, 'dropboxAccessTokens') && !(0, types_1.str)(c, 'dropboxAccessJson')))
        throw (0, types_1.fail)('EOS_BACKUP_DROPBOX_TOKEN_REQUIRED');
    if ((0, types_1.flag)(c, 'googledriveEnabled') && !(0, types_1.str)(c, 'googledriveAccessTokens') && !(0, types_1.str)(c, 'googledriveAccessJson'))
        throw (0, types_1.fail)('EOS_BACKUP_GOOGLE_TOKEN_REQUIRED');
    if ((0, types_1.flag)(c, 'onedriveEnabled') && !(0, types_1.str)(c, 'onedriveAccessJson'))
        throw (0, types_1.fail)('EOS_BACKUP_ONEDRIVE_TOKEN_REQUIRED');
    for (const [enabled, key, base] of [
        ['pgSqlEnabled', 'pgSqlDumpExe', 'pg_dump'],
        ['mySqlEnabled', 'mySqlDumpExe', 'mysqldump'],
        ['sqliteEnabled', 'sqliteDumpExe', 'sqlite3'],
        ['influxDBEnabled', 'influxDBDumpExe', (0, types_1.str)(c, 'influxDBVersion') === '2.x' ? 'influx' : 'influxd'],
    ]) {
        const path = (0, types_1.str)(c, key);
        if ((0, types_1.flag)(c, enabled) &&
            path &&
            !['/usr/bin/' + base, '/usr/local/bin/' + base, '/bin/' + base, base].includes(path))
            throw (0, types_1.fail)('EOS_BACKUP_EXECUTABLE_REVIEW');
    }
}
async function preflightLegacyConfig(input, context) {
    const c = validateConfig({ ...((0, types_1.record)(input) ? input : {}), enabled: false });
    const active = !(0, types_1.record)(context) || context.sourceEnabled !== false;
    if ((0, types_1.record)(context) &&
        (0, types_1.record)(context.owner) &&
        typeof context.owner.getForeignStateAsync === 'function' &&
        typeof context.source === 'string' &&
        /^(?:system\.adapter\.)?nexowatt-backup\.\d+$/.test(context.source)) {
        for (const [provider, field] of [
            ['dropbox', 'dropboxAccessTokens'],
            ['googledrive', 'googledriveAccessTokens'],
        ]) {
            if (!(0, types_1.flag)(c, provider + 'Enabled') || (0, types_1.str)(c, field))
                continue;
            const state = await context.owner.getForeignStateAsync(context.source.replace(/^system\.adapter\./, '') + '.info.' + provider + 'Tokens');
            if ((0, types_1.record)(state) && state.ack === true && typeof state.val === 'string' && state.val.length <= 65536) {
                let parsed;
                try {
                    parsed = JSON.parse(state.val);
                }
                catch {
                    throw (0, types_1.fail)('EOS_BACKUP_LEGACY_OAUTH_FORMAT');
                }
                if (!(0, types_1.record)(parsed))
                    throw (0, types_1.fail)('EOS_BACKUP_LEGACY_OAUTH_FORMAT');
                c[field] = state.val;
            }
        }
    }
    if (active)
        preflight(c);
    const keys = ['ccu', 'mySql', 'pgSql'];
    const encrypted = keys.some(key => (0, types_1.flag)(c, key + 'Multi') &&
        Array.isArray(c[key + 'Events']) &&
        c[key + 'Events'].some(v => (0, types_1.record)(v) && typeof v.pass === 'string' && v.pass !== ''));
    if (encrypted) {
        if (!(0, types_1.record)(context) || !(0, types_1.record)(context.owner) || typeof context.owner.getForeignObjectAsync !== 'function')
            throw (0, types_1.fail)('EOS_BACKUP_LEGACY_SECRET_UNAVAILABLE');
        const object = await context.owner.getForeignObjectAsync('system.config');
        if (!(0, types_1.record)(object) ||
            !(0, types_1.record)(object.native) ||
            typeof object.native.secret !== 'string' ||
            object.native.secret.length === 0)
            throw (0, types_1.fail)('EOS_BACKUP_LEGACY_SECRET_UNAVAILABLE');
        const secret = object.native.secret;
        for (const key of keys) {
            if (!(0, types_1.flag)(c, key + 'Multi') || !Array.isArray(c[key + 'Events']))
                continue;
            for (const item of c[key + 'Events']) {
                if ((0, types_1.record)(item) && typeof item.pass === 'string' && item.pass) {
                    const encryptedPass = item.pass;
                    let decoded = '';
                    for (let i = 0; i < encryptedPass.length; i++)
                        decoded += String.fromCharCode(encryptedPass.charCodeAt(i) ^ secret.charCodeAt(i % secret.length));
                    item.pass = decoded;
                }
            }
        }
    }
    if (active && (0, types_1.record)(context) && context.sourceEnabled === true) {
        if (typeof context.installationDir !== 'string' || typeof context.eosDataDir !== 'string')
            throw (0, types_1.fail)('EOS_BACKUP_INSTALLATION_CONTEXT');
        const { preflightInstallation, assertControllerDataFolders } = await import('./preflight.js');
        await preflightInstallation(c, context.installationDir, context.eosDataDir);
        if (!(0, types_1.record)(context.owner) ||
            typeof context.owner.getObjectViewAsync !== 'function' ||
            typeof context.dataDir !== 'string')
            throw (0, types_1.fail)('EOS_BACKUP_CONTROLLER_PREFLIGHT_UNAVAILABLE');
        const view = await context.owner.getObjectViewAsync('system', 'instance', { startkey: 'system.adapter.', endkey: 'system.adapter.\u9999' });
        if (!(0, types_1.record)(view) || !Array.isArray(view.rows) || view.rows.length > 20000)
            throw (0, types_1.fail)('EOS_BACKUP_DATA_FOLDERS');
        const folders = [];
        for (const row of view.rows) {
            if ((0, types_1.record)(row) &&
                (0, types_1.record)(row.value) &&
                (0, types_1.record)(row.value.common) &&
                typeof row.value.common.dataFolder === 'string')
                folders.push(row.value.common.dataFolder);
        }
        await assertControllerDataFolders(folders, (0, node_path_1.join)(context.eosDataDir, '..'), context.dataDir);
    }
    return { config: c, omittedFields: [] };
}
exports.migrateLegacyConfig = preflightLegacyConfig;
