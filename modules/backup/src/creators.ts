/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
import { assertControllerDataFolders } from './preflight';
import { createExtraArchives } from './extras';
import { mkdir, lstat, readdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { archiveDirectory, copyPrivate, collectFiles, hashFile } from './files';
import { controllerCli, executable, run } from './command';
import { flag, str, num, record, fail, type JobContext } from './types';
import { safeSourcePath } from './config';
const mappings: readonly [string, string, string][] = [
    ['zigbeeEnabled', 'zigbee', 'zigbee.'],
    ['noderedEnabled', 'nodered', 'node-red.'],
    ['yahkaEnabled', 'yahka', 'yahka.'],
    ['jarvisEnabled', 'jarvis', 'jarvis.'],
    ['esphomeEnabled', 'esphome', 'esphome.'],
];
function records(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value) || value.length > 64 || value.some(v => !record(v))) throw fail('EOS_BACKUP_EVENTS');
    return value.filter(record);
}
async function directory(
    ctx: JobContext,
    path: string,
    name: string,
    exclude: readonly string[] = [],
): Promise<string> {
    safeSourcePath(path);
    const dest = join(ctx.workDir, name + '.tar.gz');
    await archiveDirectory(path, dest, exclude, num(ctx.config, 'maxArchiveGiB', 10) * 1024 ** 3);
    return dest;
}
export async function createArchives(ctx: JobContext): Promise<{ file: string; kind: string }[]> {
    const c = ctx.config,
        files: { file: string; kind: string }[] = [];
    const dataDir = join(ctx.installationDir, 'iobroker-data');
    if (ctx.kind === 'ccu') return createCcu(ctx);
    const cli = await controllerCli(ctx.installationDir),
        base = join(ctx.workDir, 'iobroker.tar.gz');
    await run(process.execPath, [cli, 'backup', base], { cwd: ctx.installationDir });
    const st = await lstat(base);
    if (!st.isFile() || st.size === 0) throw fail('EOS_BACKUP_CONTROLLER_EMPTY');
    files.push({ file: base, kind: 'iobroker' });
    if (flag(c, 'eosProfileEnabled')) {
        const privateProfile = join(ctx.workDir, 'eos-profile');
        await mkdir(privateProfile, { mode: 0o700 });
        // All EOS private runtime identity files are copied. The recovery key and the archives themselves stay separate.
        const eosFiles = await collectFiles(ctx.eosDataDir, ['modules/backup']);
        for (const rel of eosFiles) await copyPrivate(join(ctx.eosDataDir, rel), join(privateProfile, 'eos-data', rel));
        try {
            await copyPrivate(
                join(ctx.dataDir, 'provider-tokens.nwb'),
                join(privateProfile, 'eos-data/modules/backup/provider-tokens.nwb'),
            );
        } catch (error) {
            if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
        }
        if (ctx.preservedUiNamespace) {
            if (!/^nexowatt-ui\.\d+$/.test(ctx.preservedUiNamespace)) throw fail('EOS_BACKUP_LEGACY_UI_NAMESPACE');
            const legacy = join(dirname(ctx.eosDataDir), ctx.preservedUiNamespace);
            for (const rel of await collectFiles(legacy))
                await copyPrivate(
                    join(legacy, rel),
                    join(privateProfile, 'legacy-ui-data', ctx.preservedUiNamespace, rel),
                );
        }
        try {
            const retention = join(ctx.dataDir, 'retention');
            for (const rel of await collectFiles(retention))
                await copyPrivate(join(retention, rel), join(privateProfile, 'eos-data/modules/backup/retention', rel));
        } catch (error) {
            if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
        }
        const vendor: readonly [string, string, string][] = [
            ['eosIncludeVendorFile', '/etc/iob-vendor.json', 'iob-vendor.json'],
            ['eosIncludeVendorSecret', join(ctx.installationDir, 'iob-vendor-secret.json'), 'iob-vendor-secret.json'],
        ];
        for (const [enabled, source, name] of vendor) {
            if (flag(c, enabled)) {
                try {
                    await copyPrivate(source, join(privateProfile, 'vendor', name));
                } catch (error) {
                    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
                }
            }
        }
        const profileFiles = await collectFiles(privateProfile);
        const manifestFiles = [];
        for (const rel of profileFiles)
            manifestFiles.push({ path: rel, sha256: await hashFile(join(privateProfile, rel)) });
        await writeFile(
            join(privateProfile, 'manifest.json'),
            JSON.stringify(
                {
                    schema: 'nexowatt-eos-backup-profile/v2',
                    createdAt: new Date().toISOString(),
                    files: manifestFiles,
                    containsPrivateDeviceIdentity: true,
                    encryptedEnvelope: true,
                    restoreAuthority:
                        'ioBroker archive plus eos-data directory; controller must be stopped during restore',
                },
                null,
                2,
            ),
            { mode: 0o600 },
        );
        files.push({ file: await directory(ctx, privateProfile, 'eos-profile'), kind: 'eos-profile' });
    }
    for (const [enabled, kind, prefix] of mappings) {
        if (flag(c, enabled)) {
            for (const entry of await readdir(dataDir, { withFileTypes: true })) {
                if (entry.name.startsWith(prefix) && entry.isDirectory() && !entry.isSymbolicLink())
                    files.push({
                        file: await directory(
                            ctx,
                            join(dataDir, entry.name),
                            kind + '-' + entry.name.replaceAll('.', '-'),
                        ),
                        kind,
                    });
            }
        }
    }
    if (flag(c, 'historyEnabled'))
        await assertControllerDataFolders([str(c, 'historyPath')], dirname(ctx.eosDataDir), ctx.dataDir);
    if (flag(c, 'zigbee2mqttEnabled') && str(c, 'zigbee2mqttType') === 'local')
        await assertControllerDataFolders([str(c, 'zigbee2mqttPath')], dirname(ctx.eosDataDir), ctx.dataDir);
    if (flag(c, 'historyEnabled'))
        files.push({ file: await directory(ctx, str(c, 'historyPath'), 'history'), kind: 'history' });
    if (flag(c, 'zigbee2mqttEnabled') && str(c, 'zigbee2mqttType') === 'local')
        files.push({ file: await directory(ctx, str(c, 'zigbee2mqttPath'), 'zigbee2mqtt'), kind: 'zigbee2mqtt' });
    // Javascript objects and file data already belong to the authoritative controller archive.
    for (const type of ['pgsql', 'mysql', 'influxDB', 'sqlite', 'redis']) {
        const prefix = type === 'pgsql' ? 'pgSql' : type === 'mysql' ? 'mySql' : type;
        if (!flag(c, prefix + 'Enabled')) continue;
        const multi = flag(c, prefix + 'Multi');
        const targets = multi ? records(c[prefix + 'Events']) : [c];
        if (targets.length === 0) throw fail('EOS_BACKUP_EVENTS_EMPTY');
        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];
            if (!target) continue;
            const value = (key: string, field: string, fallback = ''): string =>
                multi ? str(target, field, fallback) : str(c, prefix + key, fallback);
            const folder = join(ctx.workDir, type + '-' + i);
            await mkdir(folder, { mode: 0o700 });
            const output = join(folder, 'database.dump');
            if (type === 'pgsql')
                await run(
                    await executable('pg_dump'),
                    [
                        '--host',
                        value('Host', 'host', 'localhost'),
                        '--port',
                        value('Port', 'port', '5432'),
                        '--username',
                        value('User', 'user'),
                        '--format=custom',
                        '--dbname',
                        value('Name', 'dbName'),
                    ],
                    { cwd: folder, output, environment: { PGPASSWORD: value('Password', 'pass') } },
                );
            if (type === 'mysql') {
                const config = join(folder, 'client.cnf');
                const escape = (v: string): string =>
                    v.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n').replaceAll('\r', '\\r');
                await writeFile(config, '[client]\npassword="' + escape(value('Password', 'pass')) + '"\n', {
                    mode: 0o600,
                });
                const args = [
                    '--defaults-extra-file=' + config,
                    '--host=' + value('Host', 'host', 'localhost'),
                    '--port=' + value('Port', 'port', '3306'),
                    '--user=' + value('User', 'user'),
                ];
                if (flag(c, 'mysqlSingleTransaction')) args.push('--single-transaction');
                if (flag(c, 'mysqlQuick')) args.push('--quick');
                if (flag(c, 'mysqlSkipSSL')) throw fail('EOS_BACKUP_MYSQL_TLS_REVIEW');
                args.push('--databases', value('Name', 'dbName'));
                try {
                    await run(await executable('mysqldump'), args, { cwd: folder, output });
                } finally {
                    await rm(config, { force: true });
                }
            }
            if (type === 'sqlite')
                await run(await executable('sqlite3'), [safeSourcePath(str(c, 'sqlitePath')), '.dump'], {
                    cwd: folder,
                    output,
                });
            if (type === 'redis') {
                if (str(c, 'redisType') === 'local') {
                    await run(await executable('redis-cli'), ['SAVE'], {
                        cwd: folder,
                        environment: { REDISCLI_AUTH: str(c, 'redisPassword') },
                    });
                    const file = flag(c, 'redisAOFactive') ? 'appendonly.aof' : 'dump.rdb';
                    await copyPrivate(join(safeSourcePath(str(c, 'redisPath')), file), join(folder, file));
                } else {
                    const args = ['-h', str(c, 'redisHost', 'localhost'), '-p', String(num(c, 'redisPort', 6379))];
                    if (str(c, 'redisUser')) args.push('--user', str(c, 'redisUser'));
                    args.push('--rdb', join(folder, 'dump.rdb'));
                    await run(await executable('redis-cli'), args, {
                        cwd: folder,
                        environment: { REDISCLI_AUTH: str(c, 'redisPassword') },
                    });
                }
            }
            if (type === 'influxDB') {
                const version = value('Version', 'dbversion', str(c, 'influxDBVersion', '1.x')),
                    host = value('Host', 'host', 'localhost'),
                    port = value('Port', 'port', version === '2.x' ? '8086' : '8088'),
                    database = value('Name', 'dbName');
                if (version === '2.x') {
                    const proto = value('Protocol', 'protocol', 'http');
                    if (!['http', 'https'].includes(proto)) throw fail('EOS_BACKUP_INFLUX_PROTOCOL');
                    const args = ['backup', '--host', `${proto}://${host}:${port}`];
                    if (database) args.push('--bucket', database);
                    args.push(folder);
                    await run(await executable('influx'), args, {
                        cwd: ctx.workDir,
                        environment: { INFLUX_TOKEN: value('Token', 'token') },
                    });
                } else {
                    const args = ['backup', '-portable', '-host', `${host}:${port}`];
                    if (database) args.push('-database', database);
                    args.push(folder);
                    await run(await executable('influxd'), args, { cwd: ctx.workDir });
                }
            }
            files.push({ file: await directory(ctx, folder, type + '-' + i), kind: type });
        }
    }
    files.push(...(await createExtraArchives(ctx)));
    return files;
}

async function createCcu(ctx: JobContext): Promise<{ file: string; kind: string }[]> {
    const c = ctx.config,
        targets = flag(c, 'ccuMulti') ? records(c.ccuEvents) : [c];
    if (!targets.length) throw fail('EOS_BACKUP_CCU_TARGETS');
    const { default: axios } = await import('axios');
    const files: { file: string; kind: string }[] = [];
    for (let i = 0; i < targets.length; i++) {
        const item = targets[i];
        if (!item) continue;
        const field = (key: string, legacy: string): string =>
            targets.length === 1 && !flag(c, 'ccuMulti') ? str(c, legacy) : str(item, key);
        const host = field('host', 'ccuHost');
        if (!/^[a-zA-Z0-9.:[\]_-]+$/.test(host)) throw fail('EOS_BACKUP_CCU_HOST');
        const url = (flag(c, 'ccuUsehttps') ? 'https' : 'http') + '://' + host;
        let sid = '';
        try {
            const login = await axios.post<unknown>(
                url + '/api/homematic.cgi',
                {
                    method: 'Session.login',
                    params: { username: field('user', 'ccuUser'), password: field('pass', 'ccuPassword') },
                },
                { signal: AbortSignal.timeout(5000), maxRedirects: 0, maxContentLength: 1024 * 1024 },
            );
            if (!record(login.data) || typeof login.data.result !== 'string' || login.data.result.length > 256)
                throw fail('EOS_BACKUP_CCU_AUTH');
            sid = login.data.result;
            const response = await axios.get<NodeJS.ReadableStream>(
                url + '/config/cp_security.cgi?sid=' + encodeURIComponent('@' + sid + '@') + '&action=create_backup',
                { signal: AbortSignal.timeout(30 * 60 * 1000), maxRedirects: 0, responseType: 'stream' },
            );
            const file = join(ctx.workDir, 'ccu-' + i + '.tar.sbk');
            let bytes = 0;
            const limit = num(c, 'maxArchiveGiB', 10) * 1024 ** 3;
            await pipeline(
                response.data,
                new Transform({
                    transform(chunk: Buffer, _enc, cb) {
                        bytes += chunk.length;
                        cb(bytes > limit ? fail('EOS_BACKUP_ARCHIVE_LIMIT') : null, chunk);
                    },
                }),
                createWriteStream(file, { flags: 'wx', mode: 0o600 }),
            );
            if (bytes === 0) throw fail('EOS_BACKUP_CCU_EMPTY');
            files.push({ file, kind: 'ccu' });
        } finally {
            if (sid)
                await axios
                    .post(
                        url + '/api/homematic.cgi',
                        { method: 'Session.logout', params: { _session_id_: sid } },
                        { signal: AbortSignal.timeout(5000), maxRedirects: 0, maxContentLength: 1024 * 1024 },
                    )
                    .catch(() => undefined);
        }
    }
    return files;
}
