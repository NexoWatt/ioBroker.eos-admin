/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
import { BackupNotifier, validateNotificationPlan } from './notifications';
import { assertBackupCoverage, backupCoverage, historyRequirement, type HistoryBackupRequirement } from './coverage';
import { capturePublicTrust } from './publicTrust';
import { archiveKind, retentionCandidates, type RemoteEntry } from './storageRetention';
import { fork, type ChildProcess } from 'node:child_process';
import { constants } from 'node:fs';
import { lstat, open, readdir, writeFile, rename, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { assertFreeSpace, assertControllerDataFolders } from './preflight';
import { LEGACY_NAME } from './legacy';
import { validateConfig, preflightLegacyConfig, migrateLegacyConfig } from './config';
import { backupCronExpression, scheduleBackup, type ScheduledJob } from './scheduler';
import { ARCHIVE_NAME, keyFile, privateDir } from './files';
import {
    record,
    num,
    flag,
    fail,
    type Options,
    type JobContext,
    type JobResult,
    type Download,
    type Config,
} from './types';
function isJobResult(value: unknown): value is JobResult {
    return (
        record(value) &&
        Buffer.byteLength(JSON.stringify(value)) <= 1024 ** 2 &&
        typeof value.id === 'string' &&
        typeof value.startedAt === 'string' &&
        ['succeeded', 'failed', 'cancelled', 'running'].includes(String(value.state)) &&
        Array.isArray(value.files) &&
        value.files.length <= 512 &&
        value.files.every(
            file =>
                record(file) &&
                typeof file.name === 'string' &&
                ARCHIVE_NAME.test(file.name) &&
                typeof file.kind === 'string' &&
                typeof file.size === 'number' &&
                typeof file.mtime === 'string' &&
                typeof file.sha256 === 'string',
        )
    );
}
class HostedBackup {
    readonly options: Options;
    readonly config: Config;
    private started = false;
    private stopping = false;
    private child: ChildProcess | null = null;
    private jobs: JobResult[] = [];
    private current: JobResult | null = null;
    private schedule: ScheduledJob[] = [];
    private watchdog: NodeJS.Timeout | null = null;
    private jobTimeout: NodeJS.Timeout | null = null;
    private killTimer: NodeJS.Timeout | null = null;
    private done: Promise<void> | null = null;
    private key: Buffer | null = null;
    private scanner: ChildProcess | null = null;
    private scanPromise: Promise<unknown> | null = null;
    private diskChecking = false;
    private lastDiskCheck = 0;
    private cancelReason = '';
    private notifier: BackupNotifier | null = null;
    private starting: Promise<void> | null = null;
    private subscribed = false;
    private historyRequirement: HistoryBackupRequirement = { provider: 'unknown' };
    private async refreshCoverage(): Promise<void> {
        try { this.historyRequirement = historyRequirement(await this.options.getHistoryBackupRequirement?.()); }
        catch { this.historyRequirement = { provider: 'unknown' }; }
    }
    private stopPromise: Promise<void> | null = null;
    constructor(options: Options) {
        this.options = options;
        this.config = validateConfig(options.config);
    }
    private guard(): void {
        if (!this.started || this.stopping || !this.options.canOperate()) throw fail('EOS_BACKUP_INACTIVE');
    }
    private async state(name: string, value: string | number | boolean): Promise<void> {
        await this.options.adapter.setStateAsync(name, { val: value, ack: true });
    }
    async start(): Promise<void> {
        if (this.stopping) throw fail('EOS_BACKUP_STOPPING');
        if (this.started) return;
        if (this.starting) return this.starting;
        this.starting = this.initialize();
        try {
            await this.starting;
        } finally {
            this.starting = null;
        }
    }
    private async initialize(): Promise<void> {
        if (this.started) return;
        await privateDir(this.options.dataDir);
        await privateDir(join(this.options.dataDir, 'archives'));
        await privateDir(join(this.options.dataDir, 'jobs'));
        for (const entry of await readdir(join(this.options.dataDir, 'jobs'), { withFileTypes: true })) {
            if (/^[0-9a-f-]{36}$/.test(entry.name) && entry.isDirectory() && !entry.isSymbolicLink())
                await rm(join(this.options.dataDir, 'jobs', entry.name), { recursive: true, force: true });
        }
        this.key = await keyFile(this.options.dataDir);
        try {
            const fd = await open(
                join(this.options.dataDir, 'history.json'),
                constants.O_RDONLY | constants.O_NOFOLLOW,
            );
            let contents: string;
            try {
                const info = await fd.stat();
                if (!info.isFile() || info.size > 4 * 1024 ** 2) throw fail('EOS_BACKUP_HISTORY_LIMIT');
                contents = await fd.readFile('utf8');
            } finally {
                await fd.close();
            }
            const parsed: unknown = JSON.parse(contents);
            if (Array.isArray(parsed))
                this.jobs = parsed
                    .filter((v): v is JobResult => isJobResult(v) && v.state !== 'running')
                    .slice(0, this.historyLimit());
        } catch (error) {
            if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT')
                this.options.adapter.log.warn('EOS_BACKUP_HISTORY_UNAVAILABLE');
        }
        for (const [id, type] of [
            ['info.connection', 'boolean'],
            ['info.status', 'string'],
            ['info.lastBackup', 'string'],
            ['info.lastError', 'string'],
            ['oneClick.iobroker', 'boolean'],
            ['oneClick.ccu', 'boolean'],
        ] as const)
            await this.options.adapter.setObjectNotExistsAsync(id, {
                type: 'state',
                common: {
                    name: id,
                    type,
                    role: id.startsWith('oneClick.') ? 'button' : type === 'boolean' ? 'indicator' : 'text',
                    read: true,
                    write: id.startsWith('oneClick.'),
                },
                native: {},
            });
        if (this.stopping) throw fail('EOS_BACKUP_STOPPING');
        if (this.options.adapter.subscribeStatesAsync) {
            await this.options.adapter.subscribeStatesAsync('oneClick.*');
            this.subscribed = true;
        }
        if (this.stopping) throw fail('EOS_BACKUP_STOPPING');
        if (flag(this.config, 'notificationEnabled')) {
            if (!this.options.adapter.sendBackupNotification) throw fail('EOS_BACKUP_NOTIFICATION_CAPABILITY');
            this.notifier = new BackupNotifier(
                plan => {
                    this.guard();
                    return (
                        this.options.adapter.sendBackupNotification?.(plan) ??
                        Promise.reject(fail('EOS_BACKUP_NOTIFICATION_CAPABILITY'))
                    );
                },
                code => this.options.adapter.log.warn(code),
            );
        }
        await this.refreshCoverage();
        this.started = true;
        await this.state('info.connection', true);
        if (this.stopping) throw fail('EOS_BACKUP_STOPPING');
        await this.state('info.status', 'READY');
        if (this.stopping) throw fail('EOS_BACKUP_STOPPING');
        for (const kind of ['iobroker', 'ccu'] as const) {
            const enabled = kind === 'iobroker' ? 'minimalEnabled' : 'ccuEnabled';
            if (!flag(this.config, enabled)) continue;
            const job = scheduleBackup(backupCronExpression(this.config, kind), () => {
                if (this.current || !this.options.canOperate() || this.stopping) return;
                void this.startJob(kind, true).catch(() => this.options.adapter.log.warn('EOS_BACKUP_SCHEDULE_FAILED'));
            }, code => this.options.adapter.log.warn(code));
            this.schedule.push(job);
        }
        this.watchdog = setInterval(() => {
            if (this.child && !this.options.canOperate()) this.cancel();
            if (this.child && !this.diskChecking && Date.now() - this.lastDiskCheck >= 5000) {
                this.diskChecking = true;
                this.lastDiskCheck = Date.now();
                const id = this.current?.id;
                void assertFreeSpace(this.options.dataDir, 64 * 1024 ** 2)
                    .catch(() => {
                        if (this.current?.id === id) {
                            this.cancelReason = 'EOS_BACKUP_DISK_SPACE';
                            this.cancel();
                        }
                    })
                    .finally(() => {
                        this.diskChecking = false;
                    });
            }
        }, 500);
        this.watchdog.unref();
    }
    private historyLimit(): number {
        return Math.min(3650, Math.max(0, num(this.config, 'historyEntriesNumber', 30)));
    }
    private async persist(): Promise<void> {
        while (this.jobs.length > 1 && Buffer.byteLength(JSON.stringify(this.jobs)) > 4 * 1024 ** 2) this.jobs.pop();
        const tmp = join(this.options.dataDir, 'history-' + randomUUID() + '.tmp');
        await writeFile(tmp, JSON.stringify(this.jobs.slice(0, this.historyLimit())), { flag: 'wx', mode: 0o600 });
        await rename(tmp, join(this.options.dataDir, 'history.json'));
    }
    private async startJob(
        kind: 'iobroker' | 'ccu',
        scheduled = false,
        remote?: {
            operation: 'remoteList' | 'remoteFetch' | 'legacyList' | 'legacyImport';
            provider?: string;
            remoteName?: string;
        },
    ): Promise<{ accepted: true; jobId: string }> {
        this.guard();
        if (this.current || this.child) throw fail('EOS_BACKUP_BUSY');
        await assertFreeSpace(this.options.dataDir, Math.max(64, num(this.config, 'fileSizeError', 512)) * 1024 ** 2);
        this.guard();
        if (this.current || this.child) throw fail('EOS_BACKUP_BUSY');
        this.cancelReason = '';
        if (!remote && kind === 'iobroker') {
            if (!this.options.adapter.getBackupDataFolders || !this.options.eosDataDir)
                throw fail('EOS_BACKUP_CONTROLLER_PREFLIGHT_UNAVAILABLE');
            await assertControllerDataFolders(
                await this.options.adapter.getBackupDataFolders(),
                dirname(this.options.eosDataDir),
                this.options.dataDir,
            );
            this.guard();
            if (this.current || this.child) throw fail('EOS_BACKUP_BUSY');
        }
        let publicTrust: Record<string, string> | null = null;
        if (!remote && kind === 'iobroker') {
            await this.refreshCoverage();
            assertBackupCoverage(this.config, this.historyRequirement);
            publicTrust = await capturePublicTrust();
            this.guard();
            if (this.current || this.child) throw fail('EOS_BACKUP_BUSY');
        }
        const id = randomUUID(),
            workDir = join(this.options.dataDir, 'jobs', id);
        await privateDir(workDir);
        this.guard();
        if (this.current) {
            await rm(workDir, { recursive: true, force: true });
            throw fail('EOS_BACKUP_BUSY');
        }
        const installationDir = this.options.installationDir;
        if (!installationDir || !this.options.eosDataDir || !this.key) throw fail('EOS_BACKUP_CONTEXT_UNAVAILABLE');
        this.current = { id, state: 'running', startedAt: new Date().toISOString(), files: [] };
        const ctx: JobContext = {
            config: this.config,
            installationDir,
            eosDataDir: this.options.eosDataDir,
            dataDir: this.options.dataDir,
            workDir,
            jobId: id,
            kind,
            key: this.key.toString('base64'),
            retentionEnabled: scheduled,
            historyRequirement: this.historyRequirement,
            publicTrust,
            ...(this.options.preservedUiNamespace ? { preservedUiNamespace: this.options.preservedUiNamespace } : {}),
            ...(remote ?? {}),
        };
        let child: ChildProcess;
        try {
            child = fork(this.options.workerPath ?? join(__dirname, 'worker.js'), [], {
                cwd: workDir,
                detached: process.platform !== 'win32',
                execArgv: ['--max-old-space-size=256'],
                env: { PATH: '/usr/local/bin:/usr/bin:/bin', LANG: 'C.UTF-8', TZ: process.env.TZ ?? '' },
                stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
            });
        } catch {
            this.current = null;
            await rm(workDir, { recursive: true, force: true });
            throw fail('EOS_BACKUP_WORKER_START');
        }
        this.child = child;
        let result: JobResult | undefined;
        this.done = new Promise<void>(resolve => {
            let completed = false;
            const finish = (): void => {
                if (completed) return;
                completed = true;
                if (process.platform !== 'win32' && child.pid) {
                    try {
                        process.kill(-child.pid, 'SIGKILL');
                    } catch {
                        /* worker process group already empty */
                    }
                }
                void (async () => {
                    if (this.jobTimeout) clearTimeout(this.jobTimeout);
                    this.jobTimeout = null;
                    if (this.killTimer) clearTimeout(this.killTimer);
                    this.killTimer = null;
                    this.child = null;
                    const final: JobResult = result ?? {
                        id,
                        state: this.stopping ? 'cancelled' : 'failed',
                        startedAt: this.current?.startedAt ?? new Date().toISOString(),
                        files: [],
                        finishedAt: new Date().toISOString(),
                        error: this.cancelReason || 'EOS_BACKUP_WORKER_STOPPED',
                    };
                    this.jobs.unshift(final);
                    this.jobs = this.jobs.slice(0, this.historyLimit());
                    try {
                        await this.persist();
                        await this.state('info.status', final.state.toUpperCase());
                        await this.state('info.lastError', final.error ?? '');
                        if (final.state === 'succeeded' && !remote)
                            await this.state('info.lastBackup', final.finishedAt ?? '');
                        await rm(workDir, { recursive: true, force: true });
                        if (final.state === 'succeeded' && scheduled)
                            await this.retention(final.files.map(file => file.name));
                        if (!remote) this.notifier?.enqueue(this.config, final);
                    } catch {
                        this.options.adapter.log.warn('EOS_BACKUP_FINALIZE_FAILED');
                    } finally {
                        this.current = null;
                        resolve();
                    }
                })();
            };
            child.once('error', finish);
            child.once('close', finish);
            child.on('message', (message: unknown) => {
                if (
                    record(message) &&
                    message.type === 'result' &&
                    isJobResult(message.result) &&
                    message.result.id === id &&
                    ['succeeded', 'failed'].includes(message.result.state)
                )
                    result = message.result;
            });
        });
        this.jobTimeout = setTimeout(() => this.cancel(), num(this.config, 'jobTimeoutMinutes', 30) * 60 * 1000);
        this.jobTimeout.unref();
        child.send({ type: 'run', context: ctx }, error => {
            if (error) this.cancel();
        });
        await this.state('info.status', 'RUNNING');
        return { accepted: true, jobId: id };
    }
    private cancel(): void {
        const child = this.child;
        if (!child) return;
        try {
            if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGTERM');
            else child.kill('SIGTERM');
        } catch {
            /* already exited */
        }
        if (!this.killTimer) {
            this.killTimer = setTimeout(() => {
                try {
                    if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL');
                    else child.kill('SIGKILL');
                } catch {
                    /* already exited */
                }
            }, 1000);
            this.killTimer.unref();
        }
    }
    private async retention(currentNames: readonly string[]): Promise<void> {
        const directory = join(this.options.dataDir, 'archives');
        const entries = await readdir(directory);
        if (entries.length > 100000) throw fail('EOS_BACKUP_ARCHIVE_COUNT');
        if (currentNames.some(name => archiveKind(name) === 'recovery-set')) {
            const candidates: RemoteEntry[] = [];
            for (const name of entries) {
                if (!ARCHIVE_NAME.test(name)) continue;
                const s = await lstat(join(directory, name));
                if (s.isFile() && !s.isSymbolicLink()) candidates.push({ name, id: name, size: s.size, mtime: s.mtimeMs });
            }
            for (const entry of retentionCandidates({ ...this.config, localDeleteOldBackup: true, advancedDelete: false }, 'local', 'iobroker', candidates, currentNames))
                await rm(join(directory, entry.name), { force: true });
            return;
        }
        const kinds = currentNames.map(archiveKind);
        const groups = new Map<string, { path: string; time: number }[]>();
        for (const name of entries) {
            if (!ARCHIVE_NAME.test(name)) continue;
            const kind = name.slice(48).replace(/-\d+\.nwb$/, '');
            if (!kinds.includes(kind)) continue;
            const path = join(directory, name),
                s = await lstat(path);
            if (s.isSymbolicLink() || !s.isFile()) continue;
            const list = groups.get(kind) ?? [];
            list.push({ path, time: s.mtimeMs });
            groups.set(kind, list);
        }
        for (const [kind, items] of groups) {
            let keep = num(this.config, kind === 'ccu' ? 'ccuDeleteAfter' : 'minimalDeleteAfter', 30);
            if (keep === 0) continue;
            const multi = kind === 'mysql' ? 'mySql' : kind === 'pgsql' ? 'pgSql' : kind;
            const targets = this.config[multi + 'Events'];
            if (flag(this.config, multi + 'Multi') && Array.isArray(targets)) keep *= targets.length;
            for (const file of items.sort((a, b) => b.time - a.time).slice(keep)) await rm(file.path, { force: true });
        }
    }
    async stop(): Promise<void> {
        if (this.stopPromise) return this.stopPromise;
        this.stopping = true;
        this.started = false;
        this.stopPromise = this.close();
        return this.stopPromise;
    }
    private clearKey(): void {
        this.key?.fill(0);
        this.key = null;
    }
    private async close(): Promise<void> {
        this.notifier?.stop();
        this.notifier = null;
        for (const job of this.schedule) job.cancel();
        this.schedule = [];
        if (this.watchdog) clearInterval(this.watchdog);
        this.watchdog = null;
        this.cancel();
        if (this.scanner) this.killGroup(this.scanner);
        this.clearKey();
        await Promise.allSettled([this.starting, this.done, this.scanPromise]);
        this.clearKey();
        if (this.subscribed) {
            try {
                await this.options.adapter.unsubscribeStatesAsync?.('oneClick.*');
            } catch {
                this.options.adapter.log.warn('EOS_BACKUP_UNSUBSCRIBE_FAILED');
            }
            this.subscribed = false;
        }
        try {
            await this.state('info.connection', false);
        } catch {
            this.options.adapter.log.warn('EOS_BACKUP_STOP_STATE_FAILED');
        }
    }

    getStatus(): Record<string, unknown> {
        return {
            running: !!this.current,
            coverage: backupCoverage(this.config, this.historyRequirement),
            current: this.current,
            history: this.jobs
                .slice(0, 10)
                .map(job => ({
                    ...job,
                    files: job.files.slice(0, 32),
                    moreFiles: job.files.length > 32,
                    ...(job.remote
                        ? {
                              remote: {
                                  ...job.remote,
                                  entries: Array.isArray(job.remote.entries) ? job.remote.entries.slice(0, 50) : [],
                              },
                          }
                        : {}),
                })),
            encrypted: true,
            recoveryKeyAvailable: !!this.key,
            nextRuns: this.schedule.map(j => j.nextInvocation()?.toISOString() ?? null),
            sourceVersion: '1.0.10',
            restoreMode: 'MAINTENANCE_REQUIRED',
        };
    }
    async getDownload(name: unknown): Promise<Download> {
        this.guard();
        if (typeof name !== 'string' || !ARCHIVE_NAME.test(name)) throw fail('EOS_BACKUP_ARCHIVE_NAME');
        const file = join(this.options.dataDir, 'archives', name),
            fd = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
            const s = await fd.stat();
            if (!s.isFile() || s.size < 36 || s.size > num(this.config, 'maxArchiveGiB', 10) * 1024 ** 3 + 36)
                throw fail('EOS_BACKUP_ARCHIVE_INVALID');
            return {
                stream: fd.createReadStream({ start: 0, end: s.size - 1, autoClose: true }),
                filename: name,
                contentType: 'application/octet-stream',
                size: s.size,
            };
        } catch (error) {
            await fd.close();
            throw error;
        }
    }
    private killGroup(child: ChildProcess): void {
        try {
            if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL');
            else child.kill('SIGKILL');
        } catch {
            /* already gone */
        }
    }
    private scanTargets(): Promise<unknown> {
        this.guard();
        if (this.scanPromise) return this.scanPromise;
        this.scanPromise = new Promise((resolve, reject) => {
            const child = fork(join(__dirname, 'worker.js'), [], {
                cwd: this.options.dataDir,
                detached: process.platform !== 'win32',
                execArgv: ['--max-old-space-size=128'],
                env: { PATH: '/usr/local/bin:/usr/bin:/bin', LANG: 'C.UTF-8' },
                stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
            });
            this.scanner = child;
            let result: unknown,
                got = false,
                done = false;
            const timer = setTimeout(() => {
                this.killGroup(child);
            }, 4000);
            timer.unref();
            const finish = (): void => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                this.killGroup(child);
                this.scanner = null;
                if (got && this.options.canOperate() && !this.stopping) resolve(result);
                else reject(fail('EOS_BACKUP_SD_DISCOVERY_FAILED'));
            };
            child.once('error', finish);
            child.once('close', finish);
            child.on('message', (message: unknown) => {
                if (
                    record(message) &&
                    message.type === 'sdTargets' &&
                    Array.isArray(message.value) &&
                    message.value.length <= 128
                ) {
                    result = message.value;
                    got = true;
                }
            });
            child.send({ type: 'scanSd' }, error => {
                if (error) this.killGroup(child);
            });
        }).finally(() => {
            this.scanPromise = null;
        });
        return this.scanPromise;
    }
    async command(command: string, payload: unknown): Promise<unknown> {
        this.guard();
        if (!record(payload)) throw fail('EOS_BACKUP_PAYLOAD');
        if (command === 'legacyList') return this.startJob('iobroker', false, { operation: 'legacyList' });
        if (command === 'legacyImport') {
            if (typeof payload.name !== 'string' || !LEGACY_NAME.test(payload.name))
                throw fail('EOS_BACKUP_LEGACY_NAME');
            return this.startJob('iobroker', false, { operation: 'legacyImport', remoteName: payload.name });
        }
        if (command === 'remoteList' || command === 'remoteFetch') {
            if (
                typeof payload.provider !== 'string' ||
                !['cifs', 'ftp', 'webdav', 'dropbox', 'googledrive', 'onedrive'].includes(payload.provider)
            )
                throw fail('EOS_BACKUP_REMOTE_PROVIDER');
            if (
                command === 'remoteFetch' &&
                (typeof payload.name !== 'string' ||
                    (!ARCHIVE_NAME.test(payload.name) && !LEGACY_NAME.test(payload.name)))
            )
                throw fail('EOS_BACKUP_ARCHIVE_NAME');
            return this.startJob(payload.kind === 'ccu' ? 'ccu' : 'iobroker', false, {
                operation: command,
                provider: payload.provider,
                ...(typeof payload.name === 'string' ? { remoteName: payload.name } : {}),
            });
        }
        if (command === 'coverage') { await this.refreshCoverage(); return backupCoverage(this.config, this.historyRequirement); }
        if (command === 'start') return this.startJob(payload.kind === 'ccu' ? 'ccu' : 'iobroker');
        if (command === 'cancel') {
            this.cancel();
            return { accepted: true };
        }
        if (command === 'list') {
            if (typeof payload.jobId === 'string') {
                const job = this.jobs.find(item => item.id === payload.jobId);
                if (!job) throw fail('EOS_BACKUP_JOB_NOT_FOUND');
                return { job };
            }
            return {
                jobs: this.jobs
                    .map(job => ({
                        ...job,
                        files: job.files.slice(0, 32),
                        moreFiles: job.files.length > 32,
                        ...(job.remote
                            ? {
                                  remote: {
                                      ...job.remote,
                                      entries: Array.isArray(job.remote.entries) ? job.remote.entries.slice(0, 50) : [],
                                  },
                              }
                            : {}),
                    }))
                    .slice(0, 10),
                current: this.current,
            };
        }
        if (command === 'exportRecoveryKey') {
            if (payload.confirm !== true || !this.key) throw fail('EOS_BACKUP_KEY_EXPORT_CONFIRM');
            return {
                filename: 'NexoWatt-EOS-Backup-Wiederherstellungsschluessel.json',
                content: JSON.stringify(
                    {
                        format: 'nexowatt-eos-recovery-key/v1',
                        key: this.key.toString('base64'),
                        fingerprint: createHash('sha256').update(this.key).digest('hex'),
                    },
                    null,
                    2,
                ),
            };
        }
        if (command === 'restorePlan') {
            const name = payload.name;
            if (typeof name !== 'string' || !ARCHIVE_NAME.test(name)) throw fail('EOS_BACKUP_ARCHIVE_NAME');
            await lstat(join(this.options.dataDir, 'archives', name));
            return {
                name,
                requiresControllerStopped: true,
                automaticRestore: false,
                command: [
                    'node',
                    'modules/backup/build/restore-cli.js',
                    /-recovery-set-\d+\.nwb$/.test(name) ? '--set' : '--archive',
                    name,
                    '--key-file',
                    '<Wiederherstellungsschluessel.json>',
                    '--output',
                    '<leeres-Wiederherstellungsverzeichnis>',
                ],
                message:
                    'Für die Gesamtsicherung alle Dateien desselben Auftrags zusammen herunterladen und das recovery-set auswählen. Die Vorbereitung prüft zusammengehörige Archive und entschlüsselt sie. Controller, EOS-Profil und aktive Historie anschließend auf einer getrennten Installation wiederherstellen; keine Produktionsdaten überschreiben.',
            };
        }
        if (command === 'getSdCardTargets') return this.scanTargets();
        throw fail('EOS_BACKUP_COMMAND');
    }
    async onStateChange(id: string, state: unknown): Promise<void> {
        if (
            record(state) &&
            state.ack === false &&
            state.val === true &&
            (id === this.options.adapter.namespace + '.oneClick.iobroker' ||
                id === this.options.adapter.namespace + '.oneClick.ccu')
        ) {
            const kind = id.endsWith('.ccu') ? 'ccu' : 'iobroker';
            await this.startJob(kind);
            await this.state('oneClick.' + kind, false);
        }
    }
}
export { validateNotificationPlan, validateConfig, preflightLegacyConfig, migrateLegacyConfig };
export function createHostedModule(options: Options): HostedBackup {
    return new HostedBackup(options);
}
