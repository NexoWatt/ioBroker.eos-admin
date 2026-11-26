"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateLegacyConfig = exports.preflightLegacyConfig = exports.validateConfig = exports.validateNotificationPlan = void 0;
exports.createHostedModule = createHostedModule;
/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
const notifications_1 = require("./notifications");
Object.defineProperty(exports, "validateNotificationPlan", { enumerable: true, get: function () { return notifications_1.validateNotificationPlan; } });
const coverage_1 = require("./coverage");
const publicTrust_1 = require("./publicTrust");
const storageRetention_1 = require("./storageRetention");
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_crypto_1 = require("node:crypto");
const preflight_1 = require("./preflight");
const legacy_1 = require("./legacy");
const config_1 = require("./config");
Object.defineProperty(exports, "validateConfig", { enumerable: true, get: function () { return config_1.validateConfig; } });
Object.defineProperty(exports, "preflightLegacyConfig", { enumerable: true, get: function () { return config_1.preflightLegacyConfig; } });
Object.defineProperty(exports, "migrateLegacyConfig", { enumerable: true, get: function () { return config_1.migrateLegacyConfig; } });
const scheduler_1 = require("./scheduler");
const files_1 = require("./files");
const types_1 = require("./types");
function isJobResult(value) {
    return ((0, types_1.record)(value) &&
        Buffer.byteLength(JSON.stringify(value)) <= 1024 ** 2 &&
        typeof value.id === 'string' &&
        typeof value.startedAt === 'string' &&
        ['succeeded', 'failed', 'cancelled', 'running'].includes(String(value.state)) &&
        Array.isArray(value.files) &&
        value.files.length <= 512 &&
        value.files.every(file => (0, types_1.record)(file) &&
            typeof file.name === 'string' &&
            files_1.ARCHIVE_NAME.test(file.name) &&
            typeof file.kind === 'string' &&
            typeof file.size === 'number' &&
            typeof file.mtime === 'string' &&
            typeof file.sha256 === 'string'));
}
class HostedBackup {
    options;
    config;
    started = false;
    stopping = false;
    child = null;
    jobs = [];
    current = null;
    schedule = [];
    watchdog = null;
    jobTimeout = null;
    killTimer = null;
    done = null;
    key = null;
    scanner = null;
    scanPromise = null;
    diskChecking = false;
    lastDiskCheck = 0;
    cancelReason = '';
    notifier = null;
    starting = null;
    subscribed = false;
    historyRequirement = { provider: 'unknown' };
    async refreshCoverage() {
        try {
            this.historyRequirement = (0, coverage_1.historyRequirement)(await this.options.getHistoryBackupRequirement?.());
        }
        catch {
            this.historyRequirement = { provider: 'unknown' };
        }
    }
    stopPromise = null;
    constructor(options) {
        this.options = options;
        this.config = (0, config_1.validateConfig)(options.config);
    }
    guard() {
        if (!this.started || this.stopping || !this.options.canOperate())
            throw (0, types_1.fail)('EOS_BACKUP_INACTIVE');
    }
    async state(name, value) {
        await this.options.adapter.setStateAsync(name, { val: value, ack: true });
    }
    async start() {
        if (this.stopping)
            throw (0, types_1.fail)('EOS_BACKUP_STOPPING');
        if (this.started)
            return;
        if (this.starting)
            return this.starting;
        this.starting = this.initialize();
        try {
            await this.starting;
        }
        finally {
            this.starting = null;
        }
    }
    async initialize() {
        if (this.started)
            return;
        await (0, files_1.privateDir)(this.options.dataDir);
        await (0, files_1.privateDir)((0, node_path_1.join)(this.options.dataDir, 'archives'));
        await (0, files_1.privateDir)((0, node_path_1.join)(this.options.dataDir, 'jobs'));
        for (const entry of await (0, promises_1.readdir)((0, node_path_1.join)(this.options.dataDir, 'jobs'), { withFileTypes: true })) {
            if (/^[0-9a-f-]{36}$/.test(entry.name) && entry.isDirectory() && !entry.isSymbolicLink())
                await (0, promises_1.rm)((0, node_path_1.join)(this.options.dataDir, 'jobs', entry.name), { recursive: true, force: true });
        }
        this.key = await (0, files_1.keyFile)(this.options.dataDir);
        try {
            const fd = await (0, promises_1.open)((0, node_path_1.join)(this.options.dataDir, 'history.json'), node_fs_1.constants.O_RDONLY | node_fs_1.constants.O_NOFOLLOW);
            let contents;
            try {
                const info = await fd.stat();
                if (!info.isFile() || info.size > 4 * 1024 ** 2)
                    throw (0, types_1.fail)('EOS_BACKUP_HISTORY_LIMIT');
                contents = await fd.readFile('utf8');
            }
            finally {
                await fd.close();
            }
            const parsed = JSON.parse(contents);
            if (Array.isArray(parsed))
                this.jobs = parsed
                    .filter((v) => isJobResult(v) && v.state !== 'running')
                    .slice(0, this.historyLimit());
        }
        catch (error) {
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
        ])
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
        if (this.stopping)
            throw (0, types_1.fail)('EOS_BACKUP_STOPPING');
        if (this.options.adapter.subscribeStatesAsync) {
            await this.options.adapter.subscribeStatesAsync('oneClick.*');
            this.subscribed = true;
        }
        if (this.stopping)
            throw (0, types_1.fail)('EOS_BACKUP_STOPPING');
        if ((0, types_1.flag)(this.config, 'notificationEnabled')) {
            if (!this.options.adapter.sendBackupNotification)
                throw (0, types_1.fail)('EOS_BACKUP_NOTIFICATION_CAPABILITY');
            this.notifier = new notifications_1.BackupNotifier(plan => {
                this.guard();
                return (this.options.adapter.sendBackupNotification?.(plan) ??
                    Promise.reject((0, types_1.fail)('EOS_BACKUP_NOTIFICATION_CAPABILITY')));
            }, code => this.options.adapter.log.warn(code));
        }
        await this.refreshCoverage();
        this.started = true;
        await this.state('info.connection', true);
        if (this.stopping)
            throw (0, types_1.fail)('EOS_BACKUP_STOPPING');
        await this.state('info.status', 'READY');
        if (this.stopping)
            throw (0, types_1.fail)('EOS_BACKUP_STOPPING');
        for (const kind of ['iobroker', 'ccu']) {
            const enabled = kind === 'iobroker' ? 'minimalEnabled' : 'ccuEnabled';
            if (!(0, types_1.flag)(this.config, enabled))
                continue;
            const job = (0, scheduler_1.scheduleBackup)((0, scheduler_1.backupCronExpression)(this.config, kind), () => {
                if (this.current || !this.options.canOperate() || this.stopping)
                    return;
                void this.startJob(kind, true).catch(() => this.options.adapter.log.warn('EOS_BACKUP_SCHEDULE_FAILED'));
            }, code => this.options.adapter.log.warn(code));
            this.schedule.push(job);
        }
        this.watchdog = setInterval(() => {
            if (this.child && !this.options.canOperate())
                this.cancel();
            if (this.child && !this.diskChecking && Date.now() - this.lastDiskCheck >= 5000) {
                this.diskChecking = true;
                this.lastDiskCheck = Date.now();
                const id = this.current?.id;
                void (0, preflight_1.assertFreeSpace)(this.options.dataDir, 64 * 1024 ** 2)
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
    historyLimit() {
        return Math.min(3650, Math.max(0, (0, types_1.num)(this.config, 'historyEntriesNumber', 30)));
    }
    async persist() {
        while (this.jobs.length > 1 && Buffer.byteLength(JSON.stringify(this.jobs)) > 4 * 1024 ** 2)
            this.jobs.pop();
        const tmp = (0, node_path_1.join)(this.options.dataDir, 'history-' + (0, node_crypto_1.randomUUID)() + '.tmp');
        await (0, promises_1.writeFile)(tmp, JSON.stringify(this.jobs.slice(0, this.historyLimit())), { flag: 'wx', mode: 0o600 });
        await (0, promises_1.rename)(tmp, (0, node_path_1.join)(this.options.dataDir, 'history.json'));
    }
    async startJob(kind, scheduled = false, remote) {
        this.guard();
        if (this.current || this.child)
            throw (0, types_1.fail)('EOS_BACKUP_BUSY');
        await (0, preflight_1.assertFreeSpace)(this.options.dataDir, Math.max(64, (0, types_1.num)(this.config, 'fileSizeError', 512)) * 1024 ** 2);
        this.guard();
        if (this.current || this.child)
            throw (0, types_1.fail)('EOS_BACKUP_BUSY');
        this.cancelReason = '';
        if (!remote && kind === 'iobroker') {
            if (!this.options.adapter.getBackupDataFolders || !this.options.eosDataDir)
                throw (0, types_1.fail)('EOS_BACKUP_CONTROLLER_PREFLIGHT_UNAVAILABLE');
            await (0, preflight_1.assertControllerDataFolders)(await this.options.adapter.getBackupDataFolders(), (0, node_path_1.dirname)(this.options.eosDataDir), this.options.dataDir);
            this.guard();
            if (this.current || this.child)
                throw (0, types_1.fail)('EOS_BACKUP_BUSY');
        }
        let publicTrust = null;
        if (!remote && kind === 'iobroker') {
            await this.refreshCoverage();
            (0, coverage_1.assertBackupCoverage)(this.config, this.historyRequirement);
            publicTrust = await (0, publicTrust_1.capturePublicTrust)();
            this.guard();
            if (this.current || this.child)
                throw (0, types_1.fail)('EOS_BACKUP_BUSY');
        }
        const id = (0, node_crypto_1.randomUUID)(), workDir = (0, node_path_1.join)(this.options.dataDir, 'jobs', id);
        await (0, files_1.privateDir)(workDir);
        this.guard();
        if (this.current) {
            await (0, promises_1.rm)(workDir, { recursive: true, force: true });
            throw (0, types_1.fail)('EOS_BACKUP_BUSY');
        }
        const installationDir = this.options.installationDir;
        if (!installationDir || !this.options.eosDataDir || !this.key)
            throw (0, types_1.fail)('EOS_BACKUP_CONTEXT_UNAVAILABLE');
        this.current = { id, state: 'running', startedAt: new Date().toISOString(), files: [] };
        const ctx = {
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
        let child;
        try {
            child = (0, node_child_process_1.fork)(this.options.workerPath ?? (0, node_path_1.join)(__dirname, 'worker.js'), [], {
                cwd: workDir,
                detached: process.platform !== 'win32',
                execArgv: ['--max-old-space-size=256'],
                env: { PATH: '/usr/local/bin:/usr/bin:/bin', LANG: 'C.UTF-8', TZ: process.env.TZ ?? '' },
                stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
            });
        }
        catch {
            this.current = null;
            await (0, promises_1.rm)(workDir, { recursive: true, force: true });
            throw (0, types_1.fail)('EOS_BACKUP_WORKER_START');
        }
        this.child = child;
        let result;
        this.done = new Promise(resolve => {
            let completed = false;
            const finish = () => {
                if (completed)
                    return;
                completed = true;
                if (process.platform !== 'win32' && child.pid) {
                    try {
                        process.kill(-child.pid, 'SIGKILL');
                    }
                    catch {
                        /* worker process group already empty */
                    }
                }
                void (async () => {
                    if (this.jobTimeout)
                        clearTimeout(this.jobTimeout);
                    this.jobTimeout = null;
                    if (this.killTimer)
                        clearTimeout(this.killTimer);
                    this.killTimer = null;
                    this.child = null;
                    const final = result ?? {
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
                        await (0, promises_1.rm)(workDir, { recursive: true, force: true });
                        if (final.state === 'succeeded' && scheduled)
                            await this.retention(final.files.map(file => file.name));
                        if (!remote)
                            this.notifier?.enqueue(this.config, final);
                    }
                    catch {
                        this.options.adapter.log.warn('EOS_BACKUP_FINALIZE_FAILED');
                    }
                    finally {
                        this.current = null;
                        resolve();
                    }
                })();
            };
            child.once('error', finish);
            child.once('close', finish);
            child.on('message', (message) => {
                if ((0, types_1.record)(message) &&
                    message.type === 'result' &&
                    isJobResult(message.result) &&
                    message.result.id === id &&
                    ['succeeded', 'failed'].includes(message.result.state))
                    result = message.result;
            });
        });
        this.jobTimeout = setTimeout(() => this.cancel(), (0, types_1.num)(this.config, 'jobTimeoutMinutes', 30) * 60 * 1000);
        this.jobTimeout.unref();
        child.send({ type: 'run', context: ctx }, error => {
            if (error)
                this.cancel();
        });
        await this.state('info.status', 'RUNNING');
        return { accepted: true, jobId: id };
    }
    cancel() {
        const child = this.child;
        if (!child)
            return;
        try {
            if (process.platform !== 'win32' && child.pid)
                process.kill(-child.pid, 'SIGTERM');
            else
                child.kill('SIGTERM');
        }
        catch {
            /* already exited */
        }
        if (!this.killTimer) {
            this.killTimer = setTimeout(() => {
                try {
                    if (process.platform !== 'win32' && child.pid)
                        process.kill(-child.pid, 'SIGKILL');
                    else
                        child.kill('SIGKILL');
                }
                catch {
                    /* already exited */
                }
            }, 1000);
            this.killTimer.unref();
        }
    }
    async retention(currentNames) {
        const directory = (0, node_path_1.join)(this.options.dataDir, 'archives');
        const entries = await (0, promises_1.readdir)(directory);
        if (entries.length > 100000)
            throw (0, types_1.fail)('EOS_BACKUP_ARCHIVE_COUNT');
        if (currentNames.some(name => (0, storageRetention_1.archiveKind)(name) === 'recovery-set')) {
            const candidates = [];
            for (const name of entries) {
                if (!files_1.ARCHIVE_NAME.test(name))
                    continue;
                const s = await (0, promises_1.lstat)((0, node_path_1.join)(directory, name));
                if (s.isFile() && !s.isSymbolicLink())
                    candidates.push({ name, id: name, size: s.size, mtime: s.mtimeMs });
            }
            for (const entry of (0, storageRetention_1.retentionCandidates)({ ...this.config, localDeleteOldBackup: true, advancedDelete: false }, 'local', 'iobroker', candidates, currentNames))
                await (0, promises_1.rm)((0, node_path_1.join)(directory, entry.name), { force: true });
            return;
        }
        const kinds = currentNames.map(storageRetention_1.archiveKind);
        const groups = new Map();
        for (const name of entries) {
            if (!files_1.ARCHIVE_NAME.test(name))
                continue;
            const kind = name.slice(48).replace(/-\d+\.nwb$/, '');
            if (!kinds.includes(kind))
                continue;
            const path = (0, node_path_1.join)(directory, name), s = await (0, promises_1.lstat)(path);
            if (s.isSymbolicLink() || !s.isFile())
                continue;
            const list = groups.get(kind) ?? [];
            list.push({ path, time: s.mtimeMs });
            groups.set(kind, list);
        }
        for (const [kind, items] of groups) {
            let keep = (0, types_1.num)(this.config, kind === 'ccu' ? 'ccuDeleteAfter' : 'minimalDeleteAfter', 30);
            if (keep === 0)
                continue;
            const multi = kind === 'mysql' ? 'mySql' : kind === 'pgsql' ? 'pgSql' : kind;
            const targets = this.config[multi + 'Events'];
            if ((0, types_1.flag)(this.config, multi + 'Multi') && Array.isArray(targets))
                keep *= targets.length;
            for (const file of items.sort((a, b) => b.time - a.time).slice(keep))
                await (0, promises_1.rm)(file.path, { force: true });
        }
    }
    async stop() {
        if (this.stopPromise)
            return this.stopPromise;
        this.stopping = true;
        this.started = false;
        this.stopPromise = this.close();
        return this.stopPromise;
    }
    clearKey() {
        this.key?.fill(0);
        this.key = null;
    }
    async close() {
        this.notifier?.stop();
        this.notifier = null;
        for (const job of this.schedule)
            job.cancel();
        this.schedule = [];
        if (this.watchdog)
            clearInterval(this.watchdog);
        this.watchdog = null;
        this.cancel();
        if (this.scanner)
            this.killGroup(this.scanner);
        this.clearKey();
        await Promise.allSettled([this.starting, this.done, this.scanPromise]);
        this.clearKey();
        if (this.subscribed) {
            try {
                await this.options.adapter.unsubscribeStatesAsync?.('oneClick.*');
            }
            catch {
                this.options.adapter.log.warn('EOS_BACKUP_UNSUBSCRIBE_FAILED');
            }
            this.subscribed = false;
        }
        try {
            await this.state('info.connection', false);
        }
        catch {
            this.options.adapter.log.warn('EOS_BACKUP_STOP_STATE_FAILED');
        }
    }
    getStatus() {
        return {
            running: !!this.current,
            coverage: (0, coverage_1.backupCoverage)(this.config, this.historyRequirement),
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
    async getDownload(name) {
        this.guard();
        if (typeof name !== 'string' || !files_1.ARCHIVE_NAME.test(name))
            throw (0, types_1.fail)('EOS_BACKUP_ARCHIVE_NAME');
        const file = (0, node_path_1.join)(this.options.dataDir, 'archives', name), fd = await (0, promises_1.open)(file, node_fs_1.constants.O_RDONLY | node_fs_1.constants.O_NOFOLLOW);
        try {
            const s = await fd.stat();
            if (!s.isFile() || s.size < 36 || s.size > (0, types_1.num)(this.config, 'maxArchiveGiB', 10) * 1024 ** 3 + 36)
                throw (0, types_1.fail)('EOS_BACKUP_ARCHIVE_INVALID');
            return {
                stream: fd.createReadStream({ start: 0, end: s.size - 1, autoClose: true }),
                filename: name,
                contentType: 'application/octet-stream',
                size: s.size,
            };
        }
        catch (error) {
            await fd.close();
            throw error;
        }
    }
    killGroup(child) {
        try {
            if (process.platform !== 'win32' && child.pid)
                process.kill(-child.pid, 'SIGKILL');
            else
                child.kill('SIGKILL');
        }
        catch {
            /* already gone */
        }
    }
    scanTargets() {
        this.guard();
        if (this.scanPromise)
            return this.scanPromise;
        this.scanPromise = new Promise((resolve, reject) => {
            const child = (0, node_child_process_1.fork)((0, node_path_1.join)(__dirname, 'worker.js'), [], {
                cwd: this.options.dataDir,
                detached: process.platform !== 'win32',
                execArgv: ['--max-old-space-size=128'],
                env: { PATH: '/usr/local/bin:/usr/bin:/bin', LANG: 'C.UTF-8' },
                stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
            });
            this.scanner = child;
            let result, got = false, done = false;
            const timer = setTimeout(() => {
                this.killGroup(child);
            }, 4000);
            timer.unref();
            const finish = () => {
                if (done)
                    return;
                done = true;
                clearTimeout(timer);
                this.killGroup(child);
                this.scanner = null;
                if (got && this.options.canOperate() && !this.stopping)
                    resolve(result);
                else
                    reject((0, types_1.fail)('EOS_BACKUP_SD_DISCOVERY_FAILED'));
            };
            child.once('error', finish);
            child.once('close', finish);
            child.on('message', (message) => {
                if ((0, types_1.record)(message) &&
                    message.type === 'sdTargets' &&
                    Array.isArray(message.value) &&
                    message.value.length <= 128) {
                    result = message.value;
                    got = true;
                }
            });
            child.send({ type: 'scanSd' }, error => {
                if (error)
                    this.killGroup(child);
            });
        }).finally(() => {
            this.scanPromise = null;
        });
        return this.scanPromise;
    }
    async command(command, payload) {
        this.guard();
        if (!(0, types_1.record)(payload))
            throw (0, types_1.fail)('EOS_BACKUP_PAYLOAD');
        if (command === 'legacyList')
            return this.startJob('iobroker', false, { operation: 'legacyList' });
        if (command === 'legacyImport') {
            if (typeof payload.name !== 'string' || !legacy_1.LEGACY_NAME.test(payload.name))
                throw (0, types_1.fail)('EOS_BACKUP_LEGACY_NAME');
            return this.startJob('iobroker', false, { operation: 'legacyImport', remoteName: payload.name });
        }
        if (command === 'remoteList' || command === 'remoteFetch') {
            if (typeof payload.provider !== 'string' ||
                !['cifs', 'ftp', 'webdav', 'dropbox', 'googledrive', 'onedrive'].includes(payload.provider))
                throw (0, types_1.fail)('EOS_BACKUP_REMOTE_PROVIDER');
            if (command === 'remoteFetch' &&
                (typeof payload.name !== 'string' ||
                    (!files_1.ARCHIVE_NAME.test(payload.name) && !legacy_1.LEGACY_NAME.test(payload.name))))
                throw (0, types_1.fail)('EOS_BACKUP_ARCHIVE_NAME');
            return this.startJob(payload.kind === 'ccu' ? 'ccu' : 'iobroker', false, {
                operation: command,
                provider: payload.provider,
                ...(typeof payload.name === 'string' ? { remoteName: payload.name } : {}),
            });
        }
        if (command === 'coverage') {
            await this.refreshCoverage();
            return (0, coverage_1.backupCoverage)(this.config, this.historyRequirement);
        }
        if (command === 'start')
            return this.startJob(payload.kind === 'ccu' ? 'ccu' : 'iobroker');
        if (command === 'cancel') {
            this.cancel();
            return { accepted: true };
        }
        if (command === 'list') {
            if (typeof payload.jobId === 'string') {
                const job = this.jobs.find(item => item.id === payload.jobId);
                if (!job)
                    throw (0, types_1.fail)('EOS_BACKUP_JOB_NOT_FOUND');
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
            if (payload.confirm !== true || !this.key)
                throw (0, types_1.fail)('EOS_BACKUP_KEY_EXPORT_CONFIRM');
            return {
                filename: 'NexoWatt-EOS-Backup-Wiederherstellungsschluessel.json',
                content: JSON.stringify({
                    format: 'nexowatt-eos-recovery-key/v1',
                    key: this.key.toString('base64'),
                    fingerprint: (0, node_crypto_1.createHash)('sha256').update(this.key).digest('hex'),
                }, null, 2),
            };
        }
        if (command === 'restorePlan') {
            const name = payload.name;
            if (typeof name !== 'string' || !files_1.ARCHIVE_NAME.test(name))
                throw (0, types_1.fail)('EOS_BACKUP_ARCHIVE_NAME');
            await (0, promises_1.lstat)((0, node_path_1.join)(this.options.dataDir, 'archives', name));
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
                message: 'Für die Gesamtsicherung alle Dateien desselben Auftrags zusammen herunterladen und das recovery-set auswählen. Die Vorbereitung prüft zusammengehörige Archive und entschlüsselt sie. Controller, EOS-Profil und aktive Historie anschließend auf einer getrennten Installation wiederherstellen; keine Produktionsdaten überschreiben.',
            };
        }
        if (command === 'getSdCardTargets')
            return this.scanTargets();
        throw (0, types_1.fail)('EOS_BACKUP_COMMAND');
    }
    async onStateChange(id, state) {
        if ((0, types_1.record)(state) &&
            state.ack === false &&
            state.val === true &&
            (id === this.options.adapter.namespace + '.oneClick.iobroker' ||
                id === this.options.adapter.namespace + '.oneClick.ccu')) {
            const kind = id.endsWith('.ccu') ? 'ccu' : 'iobroker';
            await this.startJob(kind);
            await this.state('oneClick.' + kind, false);
        }
    }
}
function createHostedModule(options) {
    return new HostedBackup(options);
}
