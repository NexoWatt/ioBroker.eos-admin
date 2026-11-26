"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createArchives = createArchives;
/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
const preflight_1 = require("./preflight");
const extras_1 = require("./extras");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_fs_1 = require("node:fs");
const promises_2 = require("node:stream/promises");
const node_stream_1 = require("node:stream");
const files_1 = require("./files");
const command_1 = require("./command");
const types_1 = require("./types");
const config_1 = require("./config");
const databaseTargets_1 = require("./databaseTargets");
const influxIntegrity_1 = require("./influxIntegrity");
const coverage_1 = require("./coverage");
const publicTrust_1 = require("./publicTrust");
const postgresHistory_1 = require("./postgresHistory");
const mappings = [
    ['zigbeeEnabled', 'zigbee', 'zigbee.'],
    ['noderedEnabled', 'nodered', 'node-red.'],
    ['yahkaEnabled', 'yahka', 'yahka.'],
    ['jarvisEnabled', 'jarvis', 'jarvis.'],
    ['esphomeEnabled', 'esphome', 'esphome.'],
];
function records(value) {
    if (!Array.isArray(value) || value.length > 64 || value.some(v => !(0, types_1.record)(v)))
        throw (0, types_1.fail)('EOS_BACKUP_EVENTS');
    return value.filter(types_1.record);
}
async function directory(ctx, path, name, exclude = []) {
    (0, config_1.safeSourcePath)(path);
    const dest = (0, node_path_1.join)(ctx.workDir, name + '.tar.gz');
    await (0, files_1.archiveDirectory)(path, dest, exclude, (0, types_1.num)(ctx.config, 'maxArchiveGiB', 10) * 1024 ** 3);
    return dest;
}
async function createArchives(ctx) {
    const c = ctx.config, files = [];
    const dataDir = (0, node_path_1.join)(ctx.installationDir, 'iobroker-data');
    if (ctx.kind === 'ccu')
        return createCcu(ctx);
    const cli = await (0, command_1.controllerCli)(ctx.installationDir), base = (0, node_path_1.join)(ctx.workDir, 'iobroker.tar.gz');
    await (0, command_1.run)(process.execPath, [cli, 'backup', base], { cwd: ctx.installationDir });
    const st = await (0, promises_1.lstat)(base);
    if (!st.isFile() || st.size === 0)
        throw (0, types_1.fail)('EOS_BACKUP_CONTROLLER_EMPTY');
    files.push({ file: base, kind: 'iobroker' });
    if ((0, types_1.flag)(c, 'eosProfileEnabled')) {
        const privateProfile = (0, node_path_1.join)(ctx.workDir, 'eos-profile');
        await (0, promises_1.mkdir)(privateProfile, { mode: 0o700 });
        // All EOS private runtime identity files are copied. The recovery key and the archives themselves stay separate.
        const eosFiles = await (0, files_1.collectFiles)(ctx.eosDataDir, ['modules/backup']);
        for (const rel of eosFiles)
            await (0, files_1.copyPrivate)((0, node_path_1.join)(ctx.eosDataDir, rel), (0, node_path_1.join)(privateProfile, 'eos-data', rel));
        try {
            await (0, files_1.copyPrivate)((0, node_path_1.join)(ctx.dataDir, 'provider-tokens.nwb'), (0, node_path_1.join)(privateProfile, 'eos-data/modules/backup/provider-tokens.nwb'));
        }
        catch (error) {
            if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT')
                throw error;
        }
        if (ctx.preservedUiNamespace) {
            if (!/^nexowatt-ui\.\d+$/.test(ctx.preservedUiNamespace))
                throw (0, types_1.fail)('EOS_BACKUP_LEGACY_UI_NAMESPACE');
            const legacy = (0, node_path_1.join)((0, node_path_1.dirname)(ctx.eosDataDir), ctx.preservedUiNamespace);
            for (const rel of await (0, files_1.collectFiles)(legacy))
                await (0, files_1.copyPrivate)((0, node_path_1.join)(legacy, rel), (0, node_path_1.join)(privateProfile, 'legacy-ui-data', ctx.preservedUiNamespace, rel));
        }
        try {
            const retention = (0, node_path_1.join)(ctx.dataDir, 'retention');
            for (const rel of await (0, files_1.collectFiles)(retention))
                await (0, files_1.copyPrivate)((0, node_path_1.join)(retention, rel), (0, node_path_1.join)(privateProfile, 'eos-data/modules/backup/retention', rel));
        }
        catch (error) {
            if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT')
                throw error;
        }
        const vendor = [
            ['eosIncludeVendorFile', '/etc/iob-vendor.json', 'iob-vendor.json'],
            ['eosIncludeVendorSecret', (0, node_path_1.join)(ctx.installationDir, 'iob-vendor-secret.json'), 'iob-vendor-secret.json'],
        ];
        for (const [enabled, source, name] of vendor) {
            if ((0, types_1.flag)(c, enabled)) {
                try {
                    await (0, files_1.copyPrivate)(source, (0, node_path_1.join)(privateProfile, 'vendor', name));
                }
                catch (error) {
                    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT')
                        throw error;
                }
            }
        }
        await (0, publicTrust_1.archivePublicTrust)(privateProfile, ctx.publicTrust);
        const profileFiles = await (0, files_1.collectFiles)(privateProfile);
        const manifestFiles = [];
        for (const rel of profileFiles)
            manifestFiles.push({ path: rel, sha256: await (0, files_1.hashFile)((0, node_path_1.join)(privateProfile, rel)) });
        await (0, promises_1.writeFile)((0, node_path_1.join)(privateProfile, 'manifest.json'), JSON.stringify({
            schema: 'nexowatt-eos-backup-profile/v2',
            createdAt: new Date().toISOString(),
            files: manifestFiles,
            containsPrivateDeviceIdentity: true,
            encryptedEnvelope: true,
            restoreAuthority: 'ioBroker archive plus eos-data directory; controller must be stopped during restore',
        }, null, 2), { mode: 0o600 });
        files.push({ file: await directory(ctx, privateProfile, 'eos-profile'), kind: 'eos-profile' });
    }
    for (const [enabled, kind, prefix] of mappings) {
        if ((0, types_1.flag)(c, enabled)) {
            for (const entry of await (0, promises_1.readdir)(dataDir, { withFileTypes: true })) {
                if (entry.name.startsWith(prefix) && entry.isDirectory() && !entry.isSymbolicLink())
                    files.push({
                        file: await directory(ctx, (0, node_path_1.join)(dataDir, entry.name), kind + '-' + entry.name.replaceAll('.', '-')),
                        kind,
                    });
            }
        }
    }
    if ((0, types_1.flag)(c, 'historyEnabled'))
        await (0, preflight_1.assertControllerDataFolders)([(0, types_1.str)(c, 'historyPath')], (0, node_path_1.dirname)(ctx.eosDataDir), ctx.dataDir);
    if ((0, types_1.flag)(c, 'zigbee2mqttEnabled') && (0, types_1.str)(c, 'zigbee2mqttType') === 'local')
        await (0, preflight_1.assertControllerDataFolders)([(0, types_1.str)(c, 'zigbee2mqttPath')], (0, node_path_1.dirname)(ctx.eosDataDir), ctx.dataDir);
    if ((0, types_1.flag)(c, 'historyEnabled'))
        files.push({ file: await directory(ctx, (0, types_1.str)(c, 'historyPath'), 'history'), kind: 'history' });
    if ((0, types_1.flag)(c, 'zigbee2mqttEnabled') && (0, types_1.str)(c, 'zigbee2mqttType') === 'local')
        files.push({ file: await directory(ctx, (0, types_1.str)(c, 'zigbee2mqttPath'), 'zigbee2mqtt'), kind: 'zigbee2mqtt' });
    // Javascript objects and file data already belong to the authoritative controller archive.
    for (const type of ['pgsql', 'mysql', 'influxDB', 'sqlite', 'redis']) {
        const prefix = type === 'pgsql' ? 'pgSql' : type === 'mysql' ? 'mySql' : type;
        if (!(0, types_1.flag)(c, prefix + 'Enabled'))
            continue;
        const multi = (0, types_1.flag)(c, prefix + 'Multi');
        const targets = multi ? records(c[prefix + 'Events']) : [c];
        if (targets.length === 0)
            throw (0, types_1.fail)('EOS_BACKUP_EVENTS_EMPTY');
        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];
            if (!target)
                continue;
            const value = (key, field, fallback = '') => multi ? (0, types_1.str)(target, field, fallback) : (0, types_1.str)(c, prefix + key, fallback);
            const folder = (0, node_path_1.join)(ctx.workDir, type + '-' + i);
            await (0, promises_1.mkdir)(folder, { mode: 0o700 });
            const output = (0, node_path_1.join)(folder, 'database.dump');
            if (type === 'pgsql')
                await (0, command_1.run)(await (0, command_1.executable)('pg_dump'), [
                    '--host',
                    value('Host', 'host', 'localhost'),
                    '--port',
                    value('Port', 'port', '5432'),
                    '--username',
                    value('User', 'user'),
                    '--format=custom',
                    '--dbname',
                    value('Name', 'dbName'),
                ], { cwd: folder, output, environment: { PGPASSWORD: value('Password', 'pass') } });
            if (type === 'mysql') {
                const config = (0, node_path_1.join)(folder, 'client.cnf');
                const escape = (v) => v.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n').replaceAll('\r', '\\r');
                await (0, promises_1.writeFile)(config, '[client]\npassword="' + escape(value('Password', 'pass')) + '"\n', {
                    mode: 0o600,
                });
                const args = [
                    '--defaults-extra-file=' + config,
                    '--host=' + value('Host', 'host', 'localhost'),
                    '--port=' + value('Port', 'port', '3306'),
                    '--user=' + value('User', 'user'),
                ];
                if ((0, types_1.flag)(c, 'mysqlSingleTransaction'))
                    args.push('--single-transaction');
                if ((0, types_1.flag)(c, 'mysqlQuick'))
                    args.push('--quick');
                if ((0, types_1.flag)(c, 'mysqlSkipSSL'))
                    throw (0, types_1.fail)('EOS_BACKUP_MYSQL_TLS_REVIEW');
                args.push('--databases', value('Name', 'dbName'));
                try {
                    await (0, command_1.run)(await (0, command_1.executable)('mysqldump'), args, { cwd: folder, output });
                }
                finally {
                    await (0, promises_1.rm)(config, { force: true });
                }
            }
            if (type === 'sqlite')
                await (0, command_1.run)(await (0, command_1.executable)('sqlite3'), [(0, config_1.safeSourcePath)((0, types_1.str)(c, 'sqlitePath')), '.dump'], {
                    cwd: folder,
                    output,
                });
            if (type === 'redis') {
                if ((0, types_1.str)(c, 'redisType') === 'local') {
                    await (0, command_1.run)(await (0, command_1.executable)('redis-cli'), ['SAVE'], {
                        cwd: folder,
                        environment: { REDISCLI_AUTH: (0, types_1.str)(c, 'redisPassword') },
                    });
                    const file = (0, types_1.flag)(c, 'redisAOFactive') ? 'appendonly.aof' : 'dump.rdb';
                    await (0, files_1.copyPrivate)((0, node_path_1.join)((0, config_1.safeSourcePath)((0, types_1.str)(c, 'redisPath')), file), (0, node_path_1.join)(folder, file));
                }
                else {
                    const args = ['-h', (0, types_1.str)(c, 'redisHost', 'localhost'), '-p', String((0, types_1.num)(c, 'redisPort', 6379))];
                    if ((0, types_1.str)(c, 'redisUser'))
                        args.push('--user', (0, types_1.str)(c, 'redisUser'));
                    args.push('--rdb', (0, node_path_1.join)(folder, 'dump.rdb'));
                    await (0, command_1.run)(await (0, command_1.executable)('redis-cli'), args, {
                        cwd: folder,
                        environment: { REDISCLI_AUTH: (0, types_1.str)(c, 'redisPassword') },
                    });
                }
            }
            if (type === 'influxDB') {
                const selected = (0, databaseTargets_1.influxTargets)(c)[i];
                if (!selected)
                    throw (0, types_1.fail)('EOS_BACKUP_EVENTS');
                if (selected.version === '2.x')
                    await (0, influxIntegrity_1.exportInflux2)(selected, folder, ctx.workDir, i, ctx.historyRequirement?.provider === 'influxdb2' && (0, coverage_1.coversInfluxTarget)(selected, ctx.historyRequirement) ? ctx.historyRequirement : undefined);
                else {
                    const args = ['backup', '-portable', '-host', `${selected.host}:${selected.port}`];
                    if (selected.bucket)
                        args.push('-database', selected.bucket);
                    args.push(folder);
                    await (0, command_1.run)(await (0, command_1.executable)('influxd'), args, { cwd: ctx.workDir });
                    if ((await (0, promises_1.readdir)(folder)).length === 0)
                        throw (0, types_1.fail)('EOS_BACKUP_INFLUX_MANIFEST_MISSING');
                }
            }
            files.push({ file: await directory(ctx, folder, type + '-' + i), kind: type });
        }
    }
    if (ctx.historyRequirement?.provider === 'postgresql') {
        const folder = (0, node_path_1.join)(ctx.workDir, 'postgresql-history');
        await (0, promises_1.mkdir)(folder, { mode: 0o700 });
        await (0, postgresHistory_1.exportPostgresHistory)(ctx.historyRequirement.namespace, folder);
        files.push({ file: await directory(ctx, folder, 'postgresql-history'), kind: 'postgresql-history' });
    }
    files.push(...(await (0, extras_1.createExtraArchives)(ctx)));
    return files;
}
async function createCcu(ctx) {
    const c = ctx.config, targets = (0, types_1.flag)(c, 'ccuMulti') ? records(c.ccuEvents) : [c];
    if (!targets.length)
        throw (0, types_1.fail)('EOS_BACKUP_CCU_TARGETS');
    const { default: axios } = await import('axios');
    const files = [];
    for (let i = 0; i < targets.length; i++) {
        const item = targets[i];
        if (!item)
            continue;
        const field = (key, legacy) => targets.length === 1 && !(0, types_1.flag)(c, 'ccuMulti') ? (0, types_1.str)(c, legacy) : (0, types_1.str)(item, key);
        const host = field('host', 'ccuHost');
        if (!/^[a-zA-Z0-9.:[\]_-]+$/.test(host))
            throw (0, types_1.fail)('EOS_BACKUP_CCU_HOST');
        const url = ((0, types_1.flag)(c, 'ccuUsehttps') ? 'https' : 'http') + '://' + host;
        let sid = '';
        try {
            const login = await axios.post(url + '/api/homematic.cgi', {
                method: 'Session.login',
                params: { username: field('user', 'ccuUser'), password: field('pass', 'ccuPassword') },
            }, { signal: AbortSignal.timeout(5000), maxRedirects: 0, maxContentLength: 1024 * 1024 });
            if (!(0, types_1.record)(login.data) || typeof login.data.result !== 'string' || login.data.result.length > 256)
                throw (0, types_1.fail)('EOS_BACKUP_CCU_AUTH');
            sid = login.data.result;
            const response = await axios.get(url + '/config/cp_security.cgi?sid=' + encodeURIComponent('@' + sid + '@') + '&action=create_backup', { signal: AbortSignal.timeout(30 * 60 * 1000), maxRedirects: 0, responseType: 'stream' });
            const file = (0, node_path_1.join)(ctx.workDir, 'ccu-' + i + '.tar.sbk');
            let bytes = 0;
            const limit = (0, types_1.num)(c, 'maxArchiveGiB', 10) * 1024 ** 3;
            await (0, promises_2.pipeline)(response.data, new node_stream_1.Transform({
                transform(chunk, _enc, cb) {
                    bytes += chunk.length;
                    cb(bytes > limit ? (0, types_1.fail)('EOS_BACKUP_ARCHIVE_LIMIT') : null, chunk);
                },
            }), (0, node_fs_1.createWriteStream)(file, { flags: 'wx', mode: 0o600 }));
            if (bytes === 0)
                throw (0, types_1.fail)('EOS_BACKUP_CCU_EMPTY');
            files.push({ file, kind: 'ccu' });
        }
        finally {
            if (sid)
                await axios
                    .post(url + '/api/homematic.cgi', { method: 'Session.logout', params: { _session_id_: sid } }, { signal: AbortSignal.timeout(5000), maxRedirects: 0, maxContentLength: 1024 * 1024 })
                    .catch(() => undefined);
        }
    }
    return files;
}
