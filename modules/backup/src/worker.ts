/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
import { rm, writeFile } from 'node:fs/promises';
import { assertBackupCoverage, historyRequirement } from './coverage';
import { validatePublicTrust } from './publicTrust';
import { join } from 'node:path';
import { storageList, storageFetch } from './storageDownload';
import { wakeTarget } from './wake';
import { assertFreeSpace } from './preflight';
import { legacyList, legacyImport } from './legacy';
import { createArchives } from './creators';
import { validateConfig } from './config';
import { uploadArchives } from './storage';
import { archiveInfo, encryptFile, decryptFile, privateDir } from './files';
import { record, fail, num, type JobContext, type JobResult } from './types';
/** A short-lived job process keeps compressors, remote clients and DB tools out of the EMS heap. */
async function execute(ctx: JobContext): Promise<JobResult> {
    const startedAt = new Date().toISOString();
    await privateDir(ctx.workDir);
    const outputs = join(ctx.dataDir, 'archives');
    await privateDir(outputs);
    const result: JobResult = { id: ctx.jobId, state: 'running', startedAt, files: [] };
    try {
        if (ctx.operation === 'remoteList') {
            result.remote = { ...(await storageList(ctx, ctx.provider ?? '')), kind: ctx.kind };
            result.operation = ctx.operation;
            result.state = 'succeeded';
            return result;
        }
        if (ctx.operation === 'remoteFetch') {
            const fetched = await storageFetch(ctx, ctx.provider ?? '', ctx.remoteName ?? '');
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
            result.remote = await legacyList(ctx);
            result.operation = ctx.operation;
            result.state = 'succeeded';
            return result;
        }
        if (ctx.operation === 'legacyImport') {
            result.files.push(await legacyImport(ctx, ctx.remoteName ?? ''));
            result.remote = { provider: 'legacy', sourceName: ctx.remoteName ?? '' };
            result.operation = ctx.operation;
            result.state = 'succeeded';
            return result;
        }
        if (ctx.kind === 'iobroker') result.coverage = assertBackupCoverage(ctx.config, historyRequirement(ctx.historyRequirement));
        await assertFreeSpace(ctx.workDir, Math.max(64, num(ctx.config, 'fileSizeError', 512)) * 1024 ** 2);
        await wakeTarget(ctx.config);
        const raw = await createArchives(ctx),
            key = Buffer.from(ctx.key, 'base64');
        if (raw.length > (ctx.kind === 'iobroker' ? 511 : 512)) throw fail('EOS_BACKUP_ARCHIVE_COUNT');
        const max = num(ctx.config, 'maxArchiveGiB', 10) * 1024 ** 3;
        for (let i = 0; i < raw.length; i++) {
            const item = raw[i];
            if (!item) continue;
            const filename = `eos-backup-${ctx.jobId}-${item.kind}-${i}.nwb`;
            const path = join(outputs, filename);
            await encryptFile(item.file, path, key, max);
            await decryptFile(path, undefined, key, max);
            result.files.push(await archiveInfo(path, item.kind));
        }
        if (ctx.kind === 'iobroker') {
            const descriptor = join(ctx.workDir, 'recovery-set.json');
            await writeFile(descriptor, JSON.stringify({ format: 'nexowatt-eos-recovery-set/v1', jobId: ctx.jobId,
                startedAt, completedAt: new Date().toISOString(), coverage: result.coverage, files: result.files,
                consistency: 'Controller and database snapshots are taken sequentially; this is not a globally atomic live-system snapshot.',
                requiresControllerStopped: true, automaticTrustInstallation: false }, null, 2), { flag: 'wx', mode: 0o600 });
            const path = join(outputs, `eos-backup-${ctx.jobId}-recovery-set-${raw.length}.nwb`);
            await encryptFile(descriptor, path, key, 1024 ** 2);
            await decryptFile(path, undefined, key, 1024 ** 2);
            result.files.push(await archiveInfo(path, 'recovery-set'));
        }
        await uploadArchives(
            ctx.config,
            result.files.map(v => join(outputs, v.name)),
            ctx.kind,
            ctx,
        );
        result.state = 'succeeded';
    } catch (error) {
        result.state = 'failed';
        result.error =
            error instanceof Error && 'code' in error && typeof error.code === 'string'
                ? error.code
                : 'EOS_BACKUP_JOB_FAILED';
    } finally {
        result.finishedAt = new Date().toISOString();
        await rm(ctx.workDir, { recursive: true, force: true });
    }
    result.finishedAt = new Date().toISOString();
    return result;
}
function parseContext(value: unknown): JobContext {
    if (
        !record(value) ||
        typeof value.installationDir !== 'string' ||
        typeof value.eosDataDir !== 'string' ||
        typeof value.dataDir !== 'string' ||
        typeof value.workDir !== 'string' ||
        typeof value.jobId !== 'string' ||
        typeof value.key !== 'string' ||
        !['iobroker', 'ccu'].includes(String(value.kind)) ||
        !/^[0-9a-f-]{36}$/.test(value.jobId)
    )
        throw fail('EOS_BACKUP_WORKER_CONTEXT');
    if (value.workDir !== join(value.dataDir, 'jobs', value.jobId)) throw fail('EOS_BACKUP_WORKER_CONTEXT');
    return {
        config: validateConfig(value.config),
        installationDir: value.installationDir,
        eosDataDir: value.eosDataDir,
        dataDir: value.dataDir,
        workDir: value.workDir,
        jobId: value.jobId,
        key: value.key,
        kind: value.kind === 'ccu' ? 'ccu' : 'iobroker',
        retentionEnabled: value.retentionEnabled === true,
        historyRequirement: historyRequirement(value.historyRequirement),
        publicTrust: value.publicTrust === null || value.publicTrust === undefined ? null : validatePublicTrust(value.publicTrust),
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
            } catch {
                process.exit(1);
            }
        } else process.exit(1);
    });
    process.on('message', (input: unknown) => {
        if (used || !record(input)) return;
        if (input.type === 'scanSd') {
            used = true;
            const sd = require('../upstream/build/lib/sdCard.js') as { discoverSdCardTargets: () => Promise<unknown> };
            void sd.discoverSdCardTargets().then(
                value => {
                    process.send?.({ type: 'sdTargets', value }, () => process.exit(0));
                },
                () => {
                    process.send?.({ type: 'failed' }, () => process.exit(1));
                },
            );
            return;
        }
        if (input.type !== 'run' || !record(input.context)) return;
        used = true;
        void Promise.resolve()
            .then(() => execute(parseContext(input.context)))
            .then(
                result => {
                    process.send?.({ type: 'result', result }, () =>
                        process.exit(result.state === 'succeeded' ? 0 : 1),
                    );
                },
                () => {
                    process.send?.({ type: 'failed', code: 'EOS_BACKUP_WORKER_FAILED' }, () => process.exit(1));
                },
            );
    });
}
export { execute };
