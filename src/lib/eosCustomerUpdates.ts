/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Bietet angemeldeten EOS-Kunden einen ausschließlich auf EOS begrenzten, ausdrücklich gestarteten Updateablauf.
 * Daten und Wirkung: Prüft die npm-Version, Registry-Signatur und Paketbytes, sichert die eigene Konfiguration verschlüsselt und startet einen festen Wartungsarbeiter. Globale Konten, Repositories und fremde Adapter bleiben unberührt.
 * Bei Änderungen: Rechte am letzten Wirkungspunkt, Neustart-/Abbruchfälle, private Dateien und Konfigurationserhalt mit den HTTP- und Arbeitertests gemeinsam prüfen.
 */
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, readFile, realpath, rename, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import semver from 'semver';
import {
    fetchUpdateResource,
    inspectUpdateArchive,
    isRecord,
    parseCandidate,
    stableVersion,
    updateError,
    UPDATE_KEYS_URL,
    UPDATE_MAX_ARCHIVE_BYTES,
    UPDATE_METADATA_URL,
    verifyArchiveIntegrity,
    verifyRegistrySignature,
    type UpdateCandidate,
    type UpdateFetch,
} from './eosCustomerUpdateTransport';

export type EosUpdateState =
    | 'current'
    | 'available'
    | 'checking'
    | 'preparing'
    | 'offline'
    | 'incompatible'
    | 'prepared'
    | 'installing'
    | 'installed'
    | 'failed'
    | 'interrupted';
export interface EosUpdateStatus {
    installedVersion: string;
    availableVersion: string | null;
    checkedAt: number | null;
    source: 'npm-latest';
    state: EosUpdateState;
    canStart: boolean;
    reason: string | null;
    planId?: string;
    expiresAt?: number;
    jobId?: string;
}
export interface EosCustomerUpdatesOptions {
    namespace: string;
    currentVersion: string;
    nodeVersion: string;
    packageDir: string;
    controllerDir: string;
    dataDir: string;
    readConfigurationSnapshot: () => Promise<unknown>;
    encryptSnapshot: (plain: string) => string;
    decryptSnapshot: (cipher: string) => string;
    readHostInstances: () => Promise<Array<{ namespace: string; enabled: boolean }>>;
    /** Dependency injection for isolated tests; no HTTP/configuration field controls the transport. */
    fetchResource?: UpdateFetch;
}
type Authorize = () => Promise<boolean>;
interface PreparedUpdate {
    id: string;
    version: string;
    expiresAt: number;
    expiresMonotonic: number;
    configurationFingerprint: string;
    job: Record<string, unknown>;
}
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;
const CACHE_MS = 6 * 60 * 60 * 1000;
const CHECK_COOLDOWN_MS = 60000;
const PLAN_MS = 10 * 60 * 1000;
const hash = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
const safeReason = (error: unknown): string =>
    error instanceof Error && /^EOS_UPDATE_[A-Z_]{1,64}$/.test(error.message) ? error.message : 'EOS_UPDATE_FAILED';

/** Existing configured values must survive; a new release may add previously absent defaults. */
export function preservesUpdateConfiguration(before: unknown, after: unknown): boolean {
    let visited = 0;
    const same = (oldValue: unknown, newValue: unknown, depth: number): boolean => {
        if (++visited > 200000 || depth > 64) {
            return false;
        }
        if (oldValue === null || typeof oldValue !== 'object') {
            return Object.is(oldValue, newValue);
        }
        if (Array.isArray(oldValue)) {
            return (
                Array.isArray(newValue) &&
                oldValue.length === newValue.length &&
                oldValue.every((item: unknown, index) => same(item, newValue[index], depth + 1))
            );
        }
        if (!isRecord(oldValue) || !isRecord(newValue)) {
            return false;
        }
        return Object.keys(oldValue).every(
            key => Object.prototype.hasOwnProperty.call(newValue, key) && same(oldValue[key], newValue[key], depth + 1),
        );
    };
    return same(before, after, 0);
}

/** Private, same-instance files never contain a client-supplied path or executable. */
async function privateDirectory(path: string): Promise<void> {
    await mkdir(path, { mode: 0o700 });
    await checkPrivateDirectory(path);
}
async function checkPrivateDirectory(path: string): Promise<void> {
    const info = await lstat(path);
    if (
        !info.isDirectory() ||
        info.isSymbolicLink() ||
        info.uid !== process.getuid?.() ||
        (info.mode & 0o077) !== 0 ||
        (await realpath(path)) !== path
    ) {
        throw updateError('PRIVATE_STORAGE');
    }
}
async function privateRead(path: string, maximum: number): Promise<Buffer> {
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const info = await handle.stat();
        if (
            !info.isFile() ||
            info.uid !== process.getuid?.() ||
            (info.mode & 0o077) !== 0 ||
            info.size > maximum ||
            info.nlink !== 1
        ) {
            throw updateError('PRIVATE_STORAGE');
        }
        const chunks: Buffer[] = [];
        let length = 0;
        for (;;) {
            const chunk = Buffer.alloc(Math.min(65536, maximum - length + 1));
            const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
            if (!bytesRead) {
                break;
            }
            length += bytesRead;
            if (length > maximum) {
                throw updateError('PRIVATE_STORAGE');
            }
            chunks.push(chunk.subarray(0, bytesRead));
        }
        return Buffer.concat(chunks, length);
    } finally {
        await handle.close();
    }
}
async function privateWrite(path: string, data: string | Buffer): Promise<void> {
    const temporary = `${path}.${randomUUID()}.tmp`;
    const handle = await open(
        temporary,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o600,
    );
    try {
        await handle.writeFile(data);
        await handle.sync();
    } finally {
        await handle.close();
    }
    try {
        await rename(temporary, path);
        const directory = await open(dirname(path), constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
        try {
            await directory.sync();
        } finally {
            await directory.close();
        }
    } finally {
        await rm(temporary, { force: true });
    }
}

export class EosCustomerUpdates {
    private readonly options: EosCustomerUpdatesOptions;
    private readonly fetchResource: UpdateFetch;
    private readonly directory: string;
    private readonly ready: Promise<void>;
    private stopped = false;
    private operation: Promise<EosUpdateStatus> | null = null;
    private externalAbort: AbortController | null = null;
    private candidate: UpdateCandidate | null = null;
    private checkedAt: number | null = null;
    private lastAttemptMonotonic = -Infinity;
    private state: EosUpdateState = 'checking';
    private reason: string | null = null;
    private plan: PreparedUpdate | null = null;
    private activeId: string | null = null;
    private activeFingerprint: string | null = null;
    private activeVersion: string | null = null;
    private activeCreatedAt = 0;
    private activeStarted = false;
    private initializationFailed = false;
    private receiptOperation: Promise<void> | null = null;

    constructor(options: EosCustomerUpdatesOptions) {
        if (
            !/^eos-admin\.\d{1,4}$/.test(options.namespace) ||
            !stableVersion(options.currentVersion) ||
            !semver.valid(options.nodeVersion) ||
            [options.packageDir, options.controllerDir, options.dataDir].some(
                path => !isAbsolute(path) || path !== resolve(path),
            )
        ) {
            throw updateError('CONFIGURATION');
        }
        this.options = options;
        this.fetchResource = options.fetchResource || fetchUpdateResource;
        this.directory = join(options.dataDir, 'customer-updates');
        this.ready = this.initialize().catch(error => {
            this.initializationFailed = true;
            this.state = 'failed';
            this.reason = safeReason(error);
        });
    }

    private async initialize(): Promise<void> {
        if (process.platform !== 'linux' || !process.getuid || process.getuid() === 0) {
            this.state = 'incompatible';
            this.reason = 'EOS_UPDATE_PLATFORM_UNSUPPORTED';
            return;
        }
        try {
            await privateDirectory(this.directory);
        } catch (error) {
            if (!isRecord(error) || error.code !== 'EEXIST') {
                throw error;
            }
            await checkPrivateDirectory(this.directory);
        }
        let active: unknown;
        try {
            active = JSON.parse((await privateRead(join(this.directory, 'active.json'), 4096)).toString('utf8'));
        } catch (error) {
            if (isRecord(error) && error.code === 'ENOENT') {
                return;
            }
            throw error;
        }
        if (
            !isRecord(active) ||
            active.schema !== 1 ||
            typeof active.id !== 'string' ||
            !UUID.test(active.id) ||
            active.namespace !== this.options.namespace ||
            !stableVersion(active.version) ||
            typeof active.configurationFingerprint !== 'string' ||
            !/^[a-f0-9]{64}$/.test(active.configurationFingerprint) ||
            typeof active.createdAt !== 'number' ||
            !Number.isSafeInteger(active.createdAt) ||
            active.createdAt <= 0 ||
            !['prepared', 'started', 'completed', 'failed-safe'].includes(String(active.phase))
        ) {
            throw updateError('RECEIPT');
        }
        this.activeId = active.id;
        this.activeVersion = active.version;
        this.activeCreatedAt = active.createdAt;
        this.activeFingerprint = active.configurationFingerprint;
        this.activeStarted = active.phase === 'started';
        this.state =
            active.phase === 'started'
                ? 'installing'
                : active.phase === 'completed'
                  ? 'installed'
                  : active.phase === 'failed-safe'
                    ? 'failed'
                    : 'interrupted';
        this.reason =
            active.phase === 'prepared'
                ? 'EOS_UPDATE_PREPARATION_INTERRUPTED'
                : active.phase === 'failed-safe'
                  ? typeof active.reason === 'string' && /^EOS_UPDATE_[A-Z_]{1,64}$/.test(active.reason)
                      ? active.reason
                      : 'EOS_UPDATE_WORKER_FAILED'
                  : null;
        if (active.phase === 'completed' || active.phase === 'failed-safe') {
            this.lastAttemptMonotonic = performance.now();
        }
    }

    private assertRunning(): void {
        if (this.stopped) {
            throw updateError('STOPPED');
        }
    }
    private view(): EosUpdateStatus {
        const plan = this.plan;
        return {
            installedVersion: this.options.currentVersion,
            availableVersion: this.candidate?.version || this.activeVersion,
            checkedAt: this.checkedAt,
            source: 'npm-latest',
            state: this.state,
            canStart: this.state === 'prepared' && !!plan && plan.expiresMonotonic > performance.now() && !this.stopped,
            reason: this.reason,
            ...(plan ? { planId: plan.id, expiresAt: plan.expiresAt } : {}),
            ...(this.activeId ? { jobId: this.activeId } : {}),
        };
    }

    stop(): void {
        this.stopped = true;
        this.externalAbort?.abort();
        this.externalAbort = null;
        this.plan = null;
        // A launched, bounded maintenance worker must survive the adapter stop it requested.
    }

    async status(): Promise<EosUpdateStatus> {
        await this.ready;
        if (this.initializationFailed || this.reason === 'EOS_UPDATE_PLATFORM_UNSUPPORTED') {
            return this.view();
        }
        if (this.activeId && this.activeStarted && !this.receiptOperation) {
            const operation = this.refreshReceipt();
            this.receiptOperation = operation;
            try {
                await operation;
            } finally {
                if (this.receiptOperation === operation) {
                    this.receiptOperation = null;
                }
            }
        }
        if (!this.operation && !this.activeStarted && performance.now() - this.lastAttemptMonotonic >= CACHE_MS) {
            return this.check();
        }
        if (this.plan && this.plan.expiresMonotonic <= performance.now()) {
            this.plan = null;
            this.state = 'available';
            this.reason = 'EOS_UPDATE_PLAN_EXPIRED';
        }
        return this.view();
    }

    check(): Promise<EosUpdateStatus> {
        return this.exclusive(async () => {
            if (this.activeStarted || this.state === 'prepared') {
                return this.view();
            }
            if (performance.now() - this.lastAttemptMonotonic < CHECK_COOLDOWN_MS) {
                return this.view();
            }
            this.lastAttemptMonotonic = performance.now();
            this.state = 'checking';
            this.reason = null;
            try {
                const candidate = await this.external(async signal =>
                    parseCandidate(
                        await this.fetchResource(UPDATE_METADATA_URL, 128 * 1024, signal),
                        this.options.currentVersion,
                        this.options.nodeVersion,
                    ),
                );
                this.assertRunning();
                this.candidate = candidate;
                this.checkedAt = Date.now();
                this.state = semver.gt(candidate.version, this.options.currentVersion) ? 'available' : 'current';
            } catch (error) {
                this.reason = safeReason(error);
                this.state = this.reason === 'EOS_UPDATE_INCOMPATIBLE' ? 'incompatible' : 'offline';
            }
            return this.view();
        });
    }

    prepare(version: string, authorize: Authorize): Promise<EosUpdateStatus> {
        return this.exclusive(async () => {
            if (this.activeStarted) {
                throw updateError('BUSY');
            }
            if (
                !stableVersion(version) ||
                !semver.gt(version, this.options.currentVersion) ||
                !this.candidate ||
                this.candidate.version !== version ||
                !this.checkedAt ||
                Date.now() - this.checkedAt > CACHE_MS
            ) {
                throw updateError('VERSION_CHANGED');
            }
            await this.assertHost();
            await this.authorize(authorize);
            await this.pruneOldJobs();
            this.state = 'preparing';
            this.reason = null;
            this.plan = null;
            const id = randomUUID(),
                directory = join(this.directory, id);
            await privateDirectory(directory);
            try {
                const candidate = this.candidate;
                const archive = await this.external(async signal => {
                    const [metadata, keys] = await Promise.all([
                        this.fetchResource(UPDATE_METADATA_URL, 128 * 1024, signal),
                        this.fetchResource(UPDATE_KEYS_URL, 32 * 1024, signal),
                    ]);
                    const fresh = parseCandidate(metadata, this.options.currentVersion, this.options.nodeVersion);
                    if (fresh.version !== candidate.version || fresh.integrity !== candidate.integrity) {
                        throw updateError('VERSION_CHANGED');
                    }
                    verifyRegistrySignature(fresh, keys, Date.now());
                    const data = await this.fetchResource(fresh.tarball, UPDATE_MAX_ARCHIVE_BYTES, signal);
                    verifyArchiveIntegrity(data, fresh.integrity);
                    return data;
                });
                this.assertRunning();
                await privateWrite(join(directory, 'release.tgz'), archive);
                const archiveInfo = await this.external(signal =>
                    inspectUpdateArchive(join(directory, 'release.tgz'), candidate, signal),
                );
                const files = archiveInfo.files.filter(file => file.path !== 'io-package.json');
                if (!files.some(file => file.path === 'build/main.js')) {
                    throw updateError('ARCHIVE_IDENTITY');
                }
                const snapshot = await this.snapshot();
                const encrypted = this.options.encryptSnapshot(snapshot);
                if (
                    typeof encrypted !== 'string' ||
                    !encrypted ||
                    encrypted === snapshot ||
                    Buffer.byteLength(encrypted) > MAX_SNAPSHOT_BYTES * 3
                ) {
                    throw updateError('SNAPSHOT_ENCRYPTION');
                }
                const savedSnapshot = JSON.stringify({ schema: 1, namespace: this.options.namespace, encrypted });
                await privateWrite(join(directory, 'configuration.enc.json'), savedSnapshot);
                const createdAt = Date.now();
                const job: Record<string, unknown> = {
                    schema: 1,
                    id,
                    namespace: this.options.namespace,
                    fromVersion: this.options.currentVersion,
                    toVersion: version,
                    packageDir: this.options.packageDir,
                    controllerDir: this.options.controllerDir,
                    archiveIntegrity: candidate.integrity,
                    manifestSha256: hash(JSON.stringify(files)),
                    files,
                    snapshotSha256: hash(savedSnapshot),
                    createdAt,
                    enabledInstances: [this.options.namespace],
                };
                await this.authorize(authorize);
                this.plan = {
                    id,
                    version,
                    expiresAt: createdAt + PLAN_MS,
                    expiresMonotonic: performance.now() + PLAN_MS,
                    configurationFingerprint: hash(snapshot),
                    job,
                };
                this.activeId = id;
                this.activeVersion = version;
                this.activeCreatedAt = createdAt;
                this.activeFingerprint = hash(snapshot);
                await this.persistActive('prepared');
                this.state = 'prepared';
                return this.view();
            } catch (error) {
                this.state = 'failed';
                this.reason = safeReason(error);
                await rm(directory, { recursive: true, force: true }).catch(() => undefined);
                throw error;
            }
        });
    }

    start(planId: string, authorize: Authorize): Promise<EosUpdateStatus> {
        return this.exclusive(async () => {
            const plan = this.plan;
            if (
                !plan ||
                this.state !== 'prepared' ||
                !UUID.test(planId) ||
                plan.id !== planId ||
                plan.expiresMonotonic <= performance.now()
            ) {
                throw updateError('PLAN_EXPIRED');
            }
            await this.assertHost();
            await this.authorize(authorize);
            if (hash(await this.snapshot()) !== plan.configurationFingerprint) {
                throw updateError('CONFIGURATION_CHANGED');
            }
            const directory = join(this.directory, plan.id);
            await checkPrivateDirectory(directory);
            await privateWrite(join(directory, 'job.json'), JSON.stringify(plan.job));
            const workerSource = join(this.options.packageDir, 'build', 'lib', 'eosCustomerUpdateWorker.js');
            const worker = await readFile(workerSource);
            if (worker.length < 100 || worker.length > 256 * 1024) {
                throw updateError('WORKER');
            }
            await privateWrite(join(directory, 'worker.cjs'), worker);
            // Durable before spawn: a crash at this boundary is never replayed automatically.
            this.activeCreatedAt = Date.now();
            await this.persistActive('started');
            this.activeStarted = true;
            try {
                await this.authorize(authorize);
            } catch (error) {
                // No worker has been spawned: this is a known pre-effect rejection.
                this.activeStarted = false;
                await this.persistActive('prepared');
                throw error;
            }
            this.state = 'installing';
            this.reason = null;
            this.plan = null;
            await new Promise<void>((resolveStart, rejectStart) => {
                const child = spawn(process.execPath, [join(directory, 'worker.cjs'), directory], {
                    cwd: directory,
                    detached: true,
                    stdio: 'ignore',
                    shell: false,
                    env: {
                        PATH: process.env.PATH || '/usr/bin:/bin',
                        HOME: process.env.HOME || this.options.dataDir,
                        LANG: 'C.UTF-8',
                    },
                });
                child.once('spawn', () => {
                    child.unref();
                    resolveStart();
                });
                child.once('error', () => rejectStart(updateError('WORKER_START')));
            }).catch(error => {
                this.state = 'failed';
                this.reason = safeReason(error);
                throw error;
            });
            return this.view();
        });
    }

    private async external<T>(task: (signal: AbortSignal) => Promise<T>): Promise<T> {
        this.assertRunning();
        const controller = new AbortController();
        this.externalAbort = controller;
        const timer = setTimeout(() => controller.abort(), 5000);
        timer.unref();
        try {
            return await task(controller.signal);
        } finally {
            clearTimeout(timer);
            if (this.externalAbort === controller) {
                this.externalAbort = null;
            }
        }
    }
    private exclusive(task: () => Promise<EosUpdateStatus>): Promise<EosUpdateStatus> {
        if (this.operation) {
            return Promise.reject(updateError('BUSY'));
        }
        const promise = (async () => {
            await this.ready;
            this.assertRunning();
            if (this.initializationFailed) {
                throw updateError('PRIVATE_STORAGE');
            }
            if (process.platform !== 'linux' || !process.getuid || process.getuid() === 0) {
                throw updateError('PLATFORM_UNSUPPORTED');
            }
            await checkPrivateDirectory(this.directory);
            return task();
        })();
        this.operation = promise;
        void promise
            .finally(() => {
                if (this.operation === promise) {
                    this.operation = null;
                }
            })
            .catch(() => undefined);
        return promise;
    }
    private async authorize(authorize: Authorize): Promise<void> {
        this.assertRunning();
        if ((await authorize()) !== true) {
            throw updateError('AUTHORIZATION');
        }
        this.assertRunning();
    }
    private async assertHost(): Promise<void> {
        const instances = await this.options.readHostInstances();
        this.assertRunning();
        if (
            instances.length !== 1 ||
            instances[0]?.namespace !== this.options.namespace ||
            instances[0].enabled !== true
        ) {
            throw updateError('MULTI_INSTANCE');
        }
        const controller: unknown = JSON.parse(
            await readFile(join(this.options.controllerDir, 'package.json'), 'utf8'),
        );
        if (!isRecord(controller) || controller.name !== 'iobroker.js-controller' || controller.version !== '7.2.5') {
            throw updateError('CONTROLLER_UNSUPPORTED');
        }
    }
    private async snapshot(): Promise<string> {
        this.assertRunning();
        const snapshot = JSON.stringify(await this.options.readConfigurationSnapshot());
        this.assertRunning();
        if (typeof snapshot !== 'string' || snapshot.length < 2 || Buffer.byteLength(snapshot) > MAX_SNAPSHOT_BYTES) {
            throw updateError('SNAPSHOT_SIZE');
        }
        return snapshot;
    }
    private async persistActive(phase: 'prepared' | 'started' | 'completed' | 'failed-safe'): Promise<void> {
        await privateWrite(
            join(this.directory, 'active.json'),
            JSON.stringify({
                schema: 1,
                id: this.activeId,
                namespace: this.options.namespace,
                version: this.activeVersion,
                configurationFingerprint: this.activeFingerprint,
                createdAt: this.activeCreatedAt,
                phase,
                reason: this.reason,
            }),
        );
    }
    private async refreshReceipt(): Promise<void> {
        if (!this.activeId) {
            return;
        }
        let result: unknown;
        try {
            result = JSON.parse(
                (await privateRead(join(this.directory, this.activeId, 'result.json'), 4096)).toString('utf8'),
            );
        } catch (error) {
            if (isRecord(error) && error.code === 'ENOENT' && Date.now() - this.activeCreatedAt < PLAN_MS) {
                return;
            }
            this.state = 'interrupted';
            this.reason = 'EOS_UPDATE_RESULT_UNAVAILABLE';
            return;
        }
        if (
            !isRecord(result) ||
            result.schema !== 1 ||
            result.id !== this.activeId ||
            result.namespace !== this.options.namespace ||
            result.toVersion !== this.activeVersion
        ) {
            this.state = 'interrupted';
            this.reason = 'EOS_UPDATE_RECEIPT';
            return;
        }
        if (result.status === 'running') {
            if (Date.now() - this.activeCreatedAt > PLAN_MS) {
                this.state = 'interrupted';
                this.reason = 'EOS_UPDATE_RESULT_TIMEOUT';
            }
            return;
        }
        if (result.status !== 'succeeded') {
            this.state = result.status === 'failed' ? 'failed' : 'interrupted';
            this.reason =
                typeof result.error === 'string' && /^EOS_UPDATE_[A-Z_]{1,64}$/.test(result.error)
                    ? result.error
                    : 'EOS_UPDATE_WORKER_FAILED';
            if (result.status === 'failed' && (result.phase === 'validate' || result.recovery === 'restored-old')) {
                await this.persistActive('failed-safe');
                this.activeStarted = false;
                this.lastAttemptMonotonic = performance.now();
            }
            return;
        }
        if (this.options.currentVersion !== this.activeVersion) {
            this.reason = 'EOS_UPDATE_RESTART_PENDING';
            return;
        }
        try {
            const saved: unknown = JSON.parse(
                (
                    await privateRead(
                        join(this.directory, this.activeId, 'configuration.enc.json'),
                        MAX_SNAPSHOT_BYTES * 3 + 1024,
                    )
                ).toString('utf8'),
            );
            if (
                !isRecord(saved) ||
                saved.schema !== 1 ||
                saved.namespace !== this.options.namespace ||
                typeof saved.encrypted !== 'string'
            ) {
                throw updateError('SNAPSHOT_FORMAT');
            }
            const original: unknown = JSON.parse(this.options.decryptSnapshot(saved.encrypted));
            const present: unknown = JSON.parse(await this.snapshot());
            if (!preservesUpdateConfiguration(original, present)) {
                throw updateError('CONFIGURATION_CHANGED');
            }
            await this.persistActive('completed');
            this.state = 'installed';
            this.reason = null;
            this.activeStarted = false;
            this.lastAttemptMonotonic = performance.now();
        } catch (error) {
            this.state = 'interrupted';
            this.reason = safeReason(error);
        }
    }
    private async pruneOldJobs(): Promise<void> {
        const entries = await readdir(this.directory, { withFileTypes: true });
        const jobs = await Promise.all(
            entries
                .filter(entry => UUID.test(entry.name) && entry.isDirectory() && entry.name !== this.activeId)
                .map(async entry => ({
                    path: join(this.directory, entry.name),
                    modified: (await lstat(join(this.directory, entry.name))).mtimeMs,
                })),
        );
        jobs.sort((a, b) => b.modified - a.modified);
        for (const job of jobs.slice(2)) {
            await rm(job.path, { recursive: true, force: true });
        }
    }
}
