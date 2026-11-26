"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = execute;
/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
const promises_1 = require("node:fs/promises");
const coverage_1 = require("./coverage");
const publicTrust_1 = require("./publicTrust");
const node_path_1 = require("node:path");
const storageDownload_1 = require("./storageDownload");
const wake_1 = require("./wake");
const preflight_1 = require("./preflight");
const legacy_1 = require("./legacy");
const creators_1 = require("./creators");
const config_1 = require("./config");
const storage_1 = require("./storage");
const files_1 = require("./files");
const types_1 = require("./types");
/** A short-lived job process keeps compressors, remote clients and DB tools out of the EMS heap. */
async function execute(ctx) {
    const startedAt = new Date().toISOString();
    await (0, files_1.privateDir)(ctx.workDir);
    const outputs = (0, node_path_1.join)(ctx.dataDir, 'archives');
    await (0, files_1.privateDir)(outputs);
    const result = { id: ctx.jobId, state: 'running', startedAt, files: [] };
    try {
        if (ctx.operation === 'remoteList') {
            result.remote = { ...(await (0, storageDownload_1.storageList)(ctx, ctx.provider ?? '')), kind: ctx.kind };
            result.operation = ctx.operation;
            result.state = 'succeeded';
            return result;
        }
        if (ctx.operation === 'remoteFetch') {
            const fetched = await (0, storageDownload_1.storageFetch)(ctx, ctx.provider ?? '', ctx.remoteName ?? '');
            result.files.push(fetched);
            result.remote = {
                provider: ctx.provider ?? '',
                sourceName: fetched.sourceName,
                authentication: fetched.authentication,
            };
            result.operation = ctx.operation;
            result.state = 'succeeded';
            return result;
        }
        if (ctx.operation === 'legacyList') {
            result.remote = await (0, legacy_1.legacyList)(ctx);
            result.operation = ctx.operation;
            result.state = 'succeeded';
            return result;
        }
        if (ctx.operation === 'legacyImport') {
            result.files.push(await (0, legacy_1.legacyImport)(ctx, ctx.remoteName ?? ''));
            result.remote = { provider: 'legacy', sourceName: ctx.remoteName ?? '' };
            result.operation = ctx.operation;
            result.state = 'succeeded';
            return result;
        }
        if (ctx.kind === 'iobroker')
            result.coverage = (0, coverage_1.assertBackupCoverage)(ctx.config, (0, coverage_1.historyRequirement)(ctx.historyRequirement));
        await (0, preflight_1.assertFreeSpace)(ctx.workDir, Math.max(64, (0, types_1.num)(ctx.config, 'fileSizeError', 512)) * 1024 ** 2);
        await (0, wake_1.wakeTarget)(ctx.config);
        const raw = await (0, creators_1.createArchives)(ctx), key = Buffer.from(ctx.key, 'base64');
        if (raw.length > (ctx.kind === 'iobroker' ? 511 : 512))
            throw (0, types_1.fail)('EOS_BACKUP_ARCHIVE_COUNT');
        const max = (0, types_1.num)(ctx.config, 'maxArchiveGiB', 10) * 1024 ** 3;
        for (let i = 0; i < raw.length; i++) {
            const item = raw[i];
            if (!item)
                continue;
            const filename = `eos-backup-${ctx.jobId}-${item.kind}-${i}.nwb`;
            const path = (0, node_path_1.join)(outputs, filename);
            await (0, files_1.encryptFile)(item.file, path, key, max);
            await (0, files_1.decryptFile)(path, undefined, key, max);
            result.files.push(await (0, files_1.archiveInfo)(path, item.kind));
        }
        if (ctx.kind === 'iobroker') {
            const descriptor = (0, node_path_1.join)(ctx.workDir, 'recovery-set.json');
            await (0, promises_1.writeFile)(descriptor, JSON.stringify({ format: 'nexowatt-eos-recovery-set/v1', jobId: ctx.jobId,
                startedAt, completedAt: new Date().toISOString(), coverage: result.coverage, files: result.files,
                consistency: 'Controller and database snapshots are taken sequentially; this is not a globally atomic live-system snapshot.',
                requiresControllerStopped: true, automaticTrustInstallation: false }, null, 2), { flag: 'wx', mode: 0o600 });
            const path = (0, node_path_1.join)(outputs, `eos-backup-${ctx.jobId}-recovery-set-${raw.length}.nwb`);
            await (0, files_1.encryptFile)(descriptor, path, key, 1024 ** 2);
            await (0, files_1.decryptFile)(path, undefined, key, 1024 ** 2);
            result.files.push(await (0, files_1.archiveInfo)(path, 'recovery-set'));
        }
        await (0, storage_1.uploadArchives)(ctx.config, result.files.map(v => (0, node_path_1.join)(outputs, v.name)), ctx.kind, ctx);
        result.state = 'succeeded';
    }
    catch (error) {
        result.state = 'failed';
        result.error =
            error instanceof Error && 'code' in error && typeof error.code === 'string'
                ? error.code
                : 'EOS_BACKUP_JOB_FAILED';
    }
    finally {
        result.finishedAt = new Date().toISOString();
        await (0, promises_1.rm)(ctx.workDir, { recursive: true, force: true });
    }
    result.finishedAt = new Date().toISOString();
    return result;
}
function parseContext(value) {
    if (!(0, types_1.record)(value) ||
        typeof value.installationDir !== 'string' ||
        typeof value.eosDataDir !== 'string' ||
        typeof value.dataDir !== 'string' ||
        typeof value.workDir !== 'string' ||
        typeof value.jobId !== 'string' ||
        typeof value.key !== 'string' ||
        !['iobroker', 'ccu'].includes(String(value.kind)) ||
        !/^[0-9a-f-]{36}$/.test(value.jobId))
        throw (0, types_1.fail)('EOS_BACKUP_WORKER_CONTEXT');
    if (value.workDir !== (0, node_path_1.join)(value.dataDir, 'jobs', value.jobId))
        throw (0, types_1.fail)('EOS_BACKUP_WORKER_CONTEXT');
    return {
        config: (0, config_1.validateConfig)(value.config),
        installationDir: value.installationDir,
        eosDataDir: value.eosDataDir,
        dataDir: value.dataDir,
        workDir: value.workDir,
        jobId: value.jobId,
        key: value.key,
        kind: value.kind === 'ccu' ? 'ccu' : 'iobroker',
        retentionEnabled: value.retentionEnabled === true,
        historyRequirement: (0, coverage_1.historyRequirement)(value.historyRequirement),
        publicTrust: value.publicTrust === null || value.publicTrust === undefined ? null : (0, publicTrust_1.validatePublicTrust)(value.publicTrust),
        ...(typeof value.preservedUiNamespace === 'string' && /^nexowatt-ui\.\d+$/.test(value.preservedUiNamespace)
            ? { preservedUiNamespace: value.preservedUiNamespace }
            : {}),
        ...(value.operation === 'remoteList' ||
            value.operation === 'remoteFetch' ||
            value.operation === 'legacyList' ||
            value.operation === 'legacyImport'
            ? {
                operation: value.operation,
                ...(typeof value.provider === 'string' ? { provider: value.provider } : {}),
                ...(typeof value.remoteName === 'string' ? { remoteName: value.remoteName } : {}),
            }
            : {}),
    };
}
if (require.main === module) {
    let used = false;
    process.once('disconnect', () => {
        if (process.platform !== 'win32') {
            try {
                process.kill(-process.pid, 'SIGKILL');
            }
            catch {
                process.exit(1);
            }
        }
        else
            process.exit(1);
    });
    process.on('message', (input) => {
        if (used || !(0, types_1.record)(input))
            return;
        if (input.type === 'scanSd') {
            used = true;
            const sd = require('../upstream/build/lib/sdCard.js');
            void sd.discoverSdCardTargets().then(value => {
                process.send?.({ type: 'sdTargets', value }, () => process.exit(0));
            }, () => {
                process.send?.({ type: 'failed' }, () => process.exit(1));
            });
            return;
        }
        if (input.type !== 'run' || !(0, types_1.record)(input.context))
            return;
        used = true;
        void Promise.resolve()
            .then(() => execute(parseContext(input.context)))
            .then(result => {
            process.send?.({ type: 'result', result }, () => process.exit(result.state === 'succeeded' ? 0 : 1));
        }, () => {
            process.send?.({ type: 'failed', code: 'EOS_BACKUP_WORKER_FAILED' }, () => process.exit(1));
        });
    });
}
