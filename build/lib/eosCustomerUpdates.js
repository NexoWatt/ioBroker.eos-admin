"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EosCustomerUpdates = void 0;
exports.preservesUpdateConfiguration = preservesUpdateConfiguration;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Bietet angemeldeten EOS-Kunden einen ausschließlich auf EOS begrenzten, ausdrücklich gestarteten Updateablauf.
 * Daten und Wirkung: Prüft die npm-Version, Registry-Signatur und Paketbytes, sichert die eigene Konfiguration verschlüsselt und startet einen festen Wartungsarbeiter. Globale Konten, Repositories und fremde Adapter bleiben unberührt.
 * Bei Änderungen: Rechte am letzten Wirkungspunkt, Neustart-/Abbruchfälle, private Dateien und Konfigurationserhalt mit den HTTP- und Arbeitertests gemeinsam prüfen.
 */
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_child_process_1 = require("node:child_process");
const node_perf_hooks_1 = require("node:perf_hooks");
const semver_1 = __importDefault(require("semver"));
const eosCustomerUpdateTransport_1 = require("./eosCustomerUpdateTransport");
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;
const CACHE_MS = 6 * 60 * 60 * 1000;
const CHECK_COOLDOWN_MS = 60000;
const PLAN_MS = 10 * 60 * 1000;
const hash = (value) => (0, node_crypto_1.createHash)('sha256').update(value).digest('hex');
const safeReason = (error) => error instanceof Error && /^EOS_UPDATE_[A-Z_]{1,64}$/.test(error.message) ? error.message : 'EOS_UPDATE_FAILED';
/** Existing configured values must survive; a new release may add previously absent defaults. */
function preservesUpdateConfiguration(before, after) {
    let visited = 0;
    const same = (oldValue, newValue, depth) => {
        if (++visited > 200000 || depth > 64) {
            return false;
        }
        if (oldValue === null || typeof oldValue !== 'object') {
            return Object.is(oldValue, newValue);
        }
        if (Array.isArray(oldValue)) {
            return (Array.isArray(newValue) &&
                oldValue.length === newValue.length &&
                oldValue.every((item, index) => same(item, newValue[index], depth + 1)));
        }
        if (!(0, eosCustomerUpdateTransport_1.isRecord)(oldValue) || !(0, eosCustomerUpdateTransport_1.isRecord)(newValue)) {
            return false;
        }
        return Object.keys(oldValue).every(key => Object.prototype.hasOwnProperty.call(newValue, key) && same(oldValue[key], newValue[key], depth + 1));
    };
    return same(before, after, 0);
}
/** Private, same-instance files never contain a client-supplied path or executable. */
async function privateDirectory(path) {
    await (0, promises_1.mkdir)(path, { mode: 0o700 });
    await checkPrivateDirectory(path);
}
async function checkPrivateDirectory(path) {
    const info = await (0, promises_1.lstat)(path);
    if (!info.isDirectory() ||
        info.isSymbolicLink() ||
        info.uid !== process.getuid?.() ||
        (info.mode & 0o077) !== 0 ||
        (await (0, promises_1.realpath)(path)) !== path) {
        throw (0, eosCustomerUpdateTransport_1.updateError)('PRIVATE_STORAGE');
    }
}
async function privateRead(path, maximum) {
    const handle = await (0, promises_1.open)(path, node_fs_1.constants.O_RDONLY | node_fs_1.constants.O_NOFOLLOW);
    try {
        const info = await handle.stat();
        if (!info.isFile() ||
            info.uid !== process.getuid?.() ||
            (info.mode & 0o077) !== 0 ||
            info.size > maximum ||
            info.nlink !== 1) {
            throw (0, eosCustomerUpdateTransport_1.updateError)('PRIVATE_STORAGE');
        }
        const chunks = [];
        let length = 0;
        for (;;) {
            const chunk = Buffer.alloc(Math.min(65536, maximum - length + 1));
            const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
            if (!bytesRead) {
                break;
            }
            length += bytesRead;
            if (length > maximum) {
                throw (0, eosCustomerUpdateTransport_1.updateError)('PRIVATE_STORAGE');
            }
            chunks.push(chunk.subarray(0, bytesRead));
        }
        return Buffer.concat(chunks, length);
    }
    finally {
        await handle.close();
    }
}
async function privateWrite(path, data) {
    const temporary = `${path}.${(0, node_crypto_1.randomUUID)()}.tmp`;
    const handle = await (0, promises_1.open)(temporary, node_fs_1.constants.O_WRONLY | node_fs_1.constants.O_CREAT | node_fs_1.constants.O_EXCL | node_fs_1.constants.O_NOFOLLOW, 0o600);
    try {
        await handle.writeFile(data);
        await handle.sync();
    }
    finally {
        await handle.close();
    }
    try {
        await (0, promises_1.rename)(temporary, path);
        const directory = await (0, promises_1.open)((0, node_path_1.dirname)(path), node_fs_1.constants.O_RDONLY | node_fs_1.constants.O_DIRECTORY | node_fs_1.constants.O_NOFOLLOW);
        try {
            await directory.sync();
        }
        finally {
            await directory.close();
        }
    }
    finally {
        await (0, promises_1.rm)(temporary, { force: true });
    }
}
class EosCustomerUpdates {
    options;
    fetchResource;
    directory;
    ready;
    stopped = false;
    operation = null;
    externalAbort = null;
    candidate = null;
    checkedAt = null;
    lastAttemptMonotonic = -Infinity;
    state = 'checking';
    reason = null;
    plan = null;
    activeId = null;
    activeFingerprint = null;
    activeVersion = null;
    activeCreatedAt = 0;
    activeStarted = false;
    initializationFailed = false;
    receiptOperation = null;
    constructor(options) {
        if (!/^eos-admin\.\d{1,4}$/.test(options.namespace) ||
            !(0, eosCustomerUpdateTransport_1.stableVersion)(options.currentVersion) ||
            !semver_1.default.valid(options.nodeVersion) ||
            [options.packageDir, options.controllerDir, options.dataDir].some(path => !(0, node_path_1.isAbsolute)(path) || path !== (0, node_path_1.resolve)(path))) {
            throw (0, eosCustomerUpdateTransport_1.updateError)('CONFIGURATION');
        }
        this.options = options;
        this.fetchResource = options.fetchResource || eosCustomerUpdateTransport_1.fetchUpdateResource;
        this.directory = (0, node_path_1.join)(options.dataDir, 'customer-updates');
        this.ready = this.initialize().catch(error => {
            this.initializationFailed = true;
            this.state = 'failed';
            this.reason = safeReason(error);
        });
    }
    async initialize() {
        if (process.platform !== 'linux' || !process.getuid || process.getuid() === 0) {
            this.state = 'incompatible';
            this.reason = 'EOS_UPDATE_PLATFORM_UNSUPPORTED';
            return;
        }
        try {
            await privateDirectory(this.directory);
        }
        catch (error) {
            if (!(0, eosCustomerUpdateTransport_1.isRecord)(error) || error.code !== 'EEXIST') {
                throw error;
            }
            await checkPrivateDirectory(this.directory);
        }
        let active;
        try {
            active = JSON.parse((await privateRead((0, node_path_1.join)(this.directory, 'active.json'), 4096)).toString('utf8'));
        }
        catch (error) {
            if ((0, eosCustomerUpdateTransport_1.isRecord)(error) && error.code === 'ENOENT') {
                return;
            }
            throw error;
        }
        if (!(0, eosCustomerUpdateTransport_1.isRecord)(active) ||
            active.schema !== 1 ||
            typeof active.id !== 'string' ||
            !UUID.test(active.id) ||
            active.namespace !== this.options.namespace ||
            !(0, eosCustomerUpdateTransport_1.stableVersion)(active.version) ||
            typeof active.configurationFingerprint !== 'string' ||
            !/^[a-f0-9]{64}$/.test(active.configurationFingerprint) ||
            typeof active.createdAt !== 'number' ||
            !Number.isSafeInteger(active.createdAt) ||
            active.createdAt <= 0 ||
            !['prepared', 'started', 'completed', 'failed-safe'].includes(String(active.phase))) {
            throw (0, eosCustomerUpdateTransport_1.updateError)('RECEIPT');
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
            this.lastAttemptMonotonic = node_perf_hooks_1.performance.now();
        }
    }
    assertRunning() {
        if (this.stopped) {
            throw (0, eosCustomerUpdateTransport_1.updateError)('STOPPED');
        }
    }
    view() {
        const plan = this.plan;
        return {
            installedVersion: this.options.currentVersion,
            availableVersion: this.candidate?.version || this.activeVersion,
            checkedAt: this.checkedAt,
            source: 'npm-latest',
            state: this.state,
            canStart: this.state === 'prepared' && !!plan && plan.expiresMonotonic > node_perf_hooks_1.performance.now() && !this.stopped,
            reason: this.reason,
            ...(plan ? { planId: plan.id, expiresAt: plan.expiresAt } : {}),
            ...(this.activeId ? { jobId: this.activeId } : {}),
        };
    }
    stop() {
        this.stopped = true;
        this.externalAbort?.abort();
        this.externalAbort = null;
        this.plan = null;
        // A launched, bounded maintenance worker must survive the adapter stop it requested.
    }
    async status() {
        await this.ready;
        if (this.initializationFailed || this.reason === 'EOS_UPDATE_PLATFORM_UNSUPPORTED') {
            return this.view();
        }
        if (this.activeId && this.activeStarted && !this.receiptOperation) {
            const operation = this.refreshReceipt();
            this.receiptOperation = operation;
            try {
                await operation;
            }
            finally {
                if (this.receiptOperation === operation) {
                    this.receiptOperation = null;
                }
            }
        }
        if (!this.operation && !this.activeStarted && node_perf_hooks_1.performance.now() - this.lastAttemptMonotonic >= CACHE_MS) {
            return this.check();
        }
        if (this.plan && this.plan.expiresMonotonic <= node_perf_hooks_1.performance.now()) {
            this.plan = null;
            this.state = 'available';
            this.reason = 'EOS_UPDATE_PLAN_EXPIRED';
        }
        return this.view();
    }
    check() {
        return this.exclusive(async () => {
            if (this.activeStarted || this.state === 'prepared') {
                return this.view();
            }
            if (node_perf_hooks_1.performance.now() - this.lastAttemptMonotonic < CHECK_COOLDOWN_MS) {
                return this.view();
            }
            this.lastAttemptMonotonic = node_perf_hooks_1.performance.now();
            this.state = 'checking';
            this.reason = null;
            try {
                const candidate = await this.external(async (signal) => (0, eosCustomerUpdateTransport_1.parseCandidate)(await this.fetchResource(eosCustomerUpdateTransport_1.UPDATE_METADATA_URL, 128 * 1024, signal), this.options.currentVersion, this.options.nodeVersion));
                this.assertRunning();
                this.candidate = candidate;
                this.checkedAt = Date.now();
                this.state = semver_1.default.gt(candidate.version, this.options.currentVersion) ? 'available' : 'current';
            }
            catch (error) {
                this.reason = safeReason(error);
                this.state = this.reason === 'EOS_UPDATE_INCOMPATIBLE' ? 'incompatible' : 'offline';
            }
            return this.view();
        });
    }
    prepare(version, authorize) {
        return this.exclusive(async () => {
            if (this.activeStarted) {
                throw (0, eosCustomerUpdateTransport_1.updateError)('BUSY');
            }
            if (!(0, eosCustomerUpdateTransport_1.stableVersion)(version) ||
                !semver_1.default.gt(version, this.options.currentVersion) ||
                !this.candidate ||
                this.candidate.version !== version ||
                !this.checkedAt ||
                Date.now() - this.checkedAt > CACHE_MS) {
                throw (0, eosCustomerUpdateTransport_1.updateError)('VERSION_CHANGED');
            }
            await this.assertHost();
            await this.authorize(authorize);
            await this.pruneOldJobs();
            this.state = 'preparing';
            this.reason = null;
            this.plan = null;
            const id = (0, node_crypto_1.randomUUID)(), directory = (0, node_path_1.join)(this.directory, id);
            await privateDirectory(directory);
            try {
                const candidate = this.candidate;
                const archive = await this.external(async (signal) => {
                    const [metadata, keys] = await Promise.all([
                        this.fetchResource(eosCustomerUpdateTransport_1.UPDATE_METADATA_URL, 128 * 1024, signal),
                        this.fetchResource(eosCustomerUpdateTransport_1.UPDATE_KEYS_URL, 32 * 1024, signal),
                    ]);
                    const fresh = (0, eosCustomerUpdateTransport_1.parseCandidate)(metadata, this.options.currentVersion, this.options.nodeVersion);
                    if (fresh.version !== candidate.version || fresh.integrity !== candidate.integrity) {
                        throw (0, eosCustomerUpdateTransport_1.updateError)('VERSION_CHANGED');
                    }
                    (0, eosCustomerUpdateTransport_1.verifyRegistrySignature)(fresh, keys, Date.now());
                    const data = await this.fetchResource(fresh.tarball, eosCustomerUpdateTransport_1.UPDATE_MAX_ARCHIVE_BYTES, signal);
                    (0, eosCustomerUpdateTransport_1.verifyArchiveIntegrity)(data, fresh.integrity);
                    return data;
                });
                this.assertRunning();
                await privateWrite((0, node_path_1.join)(directory, 'release.tgz'), archive);
                const archiveInfo = await this.external(signal => (0, eosCustomerUpdateTransport_1.inspectUpdateArchive)((0, node_path_1.join)(directory, 'release.tgz'), candidate, signal));
                const files = archiveInfo.files.filter(file => file.path !== 'io-package.json');
                if (!files.some(file => file.path === 'build/main.js')) {
                    throw (0, eosCustomerUpdateTransport_1.updateError)('ARCHIVE_IDENTITY');
                }
                const snapshot = await this.snapshot();
                const encrypted = this.options.encryptSnapshot(snapshot);
                if (typeof encrypted !== 'string' ||
                    !encrypted ||
                    encrypted === snapshot ||
                    Buffer.byteLength(encrypted) > MAX_SNAPSHOT_BYTES * 3) {
                    throw (0, eosCustomerUpdateTransport_1.updateError)('SNAPSHOT_ENCRYPTION');
                }
                const savedSnapshot = JSON.stringify({ schema: 1, namespace: this.options.namespace, encrypted });
                await privateWrite((0, node_path_1.join)(directory, 'configuration.enc.json'), savedSnapshot);
                const createdAt = Date.now();
                const job = {
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
                    expiresMonotonic: node_perf_hooks_1.performance.now() + PLAN_MS,
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
            }
            catch (error) {
                this.state = 'failed';
                this.reason = safeReason(error);
                await (0, promises_1.rm)(directory, { recursive: true, force: true }).catch(() => undefined);
                throw error;
            }
        });
    }
    start(planId, authorize) {
        return this.exclusive(async () => {
            const plan = this.plan;
            if (!plan ||
                this.state !== 'prepared' ||
                !UUID.test(planId) ||
                plan.id !== planId ||
                plan.expiresMonotonic <= node_perf_hooks_1.performance.now()) {
                throw (0, eosCustomerUpdateTransport_1.updateError)('PLAN_EXPIRED');
            }
            await this.assertHost();
            await this.authorize(authorize);
            if (hash(await this.snapshot()) !== plan.configurationFingerprint) {
                throw (0, eosCustomerUpdateTransport_1.updateError)('CONFIGURATION_CHANGED');
            }
            const directory = (0, node_path_1.join)(this.directory, plan.id);
            await checkPrivateDirectory(directory);
            await privateWrite((0, node_path_1.join)(directory, 'job.json'), JSON.stringify(plan.job));
            const workerSource = (0, node_path_1.join)(this.options.packageDir, 'build', 'lib', 'eosCustomerUpdateWorker.js');
            const worker = await (0, promises_1.readFile)(workerSource);
            if (worker.length < 100 || worker.length > 256 * 1024) {
                throw (0, eosCustomerUpdateTransport_1.updateError)('WORKER');
            }
            await privateWrite((0, node_path_1.join)(directory, 'worker.cjs'), worker);
            // Durable before spawn: a crash at this boundary is never replayed automatically.
            this.activeCreatedAt = Date.now();
            await this.persistActive('started');
            this.activeStarted = true;
            try {
                await this.authorize(authorize);
            }
            catch (error) {
                // No worker has been spawned: this is a known pre-effect rejection.
                this.activeStarted = false;
                await this.persistActive('prepared');
                throw error;
            }
            this.state = 'installing';
            this.reason = null;
            this.plan = null;
            await new Promise((resolveStart, rejectStart) => {
                const child = (0, node_child_process_1.spawn)(process.execPath, [(0, node_path_1.join)(directory, 'worker.cjs'), directory], {
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
                child.once('error', () => rejectStart((0, eosCustomerUpdateTransport_1.updateError)('WORKER_START')));
            }).catch(error => {
                this.state = 'failed';
                this.reason = safeReason(error);
                throw error;
            });
            return this.view();
        });
    }
    async external(task) {
        this.assertRunning();
        const controller = new AbortController();
        this.externalAbort = controller;
        const timer = setTimeout(() => controller.abort(), 5000);
        timer.unref();
        try {
            return await task(controller.signal);
        }
        finally {
            clearTimeout(timer);
            if (this.externalAbort === controller) {
                this.externalAbort = null;
            }
        }
    }
    exclusive(task) {
        if (this.operation) {
            return Promise.reject((0, eosCustomerUpdateTransport_1.updateError)('BUSY'));
        }
        const promise = (async () => {
            await this.ready;
            this.assertRunning();
            if (this.initializationFailed) {
                throw (0, eosCustomerUpdateTransport_1.updateError)('PRIVATE_STORAGE');
            }
            if (process.platform !== 'linux' || !process.getuid || process.getuid() === 0) {
                throw (0, eosCustomerUpdateTransport_1.updateError)('PLATFORM_UNSUPPORTED');
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
    async authorize(authorize) {
        this.assertRunning();
        if ((await authorize()) !== true) {
            throw (0, eosCustomerUpdateTransport_1.updateError)('AUTHORIZATION');
        }
        this.assertRunning();
    }
    async assertHost() {
        const instances = await this.options.readHostInstances();
        this.assertRunning();
        if (instances.length !== 1 ||
            instances[0]?.namespace !== this.options.namespace ||
            instances[0].enabled !== true) {
            throw (0, eosCustomerUpdateTransport_1.updateError)('MULTI_INSTANCE');
        }
        const controller = JSON.parse(await (0, promises_1.readFile)((0, node_path_1.join)(this.options.controllerDir, 'package.json'), 'utf8'));
        if (!(0, eosCustomerUpdateTransport_1.isRecord)(controller) || controller.name !== 'iobroker.js-controller' || controller.version !== '7.2.5') {
            throw (0, eosCustomerUpdateTransport_1.updateError)('CONTROLLER_UNSUPPORTED');
        }
    }
    async snapshot() {
        this.assertRunning();
        const snapshot = JSON.stringify(await this.options.readConfigurationSnapshot());
        this.assertRunning();
        if (typeof snapshot !== 'string' || snapshot.length < 2 || Buffer.byteLength(snapshot) > MAX_SNAPSHOT_BYTES) {
            throw (0, eosCustomerUpdateTransport_1.updateError)('SNAPSHOT_SIZE');
        }
        return snapshot;
    }
    async persistActive(phase) {
        await privateWrite((0, node_path_1.join)(this.directory, 'active.json'), JSON.stringify({
            schema: 1,
            id: this.activeId,
            namespace: this.options.namespace,
            version: this.activeVersion,
            configurationFingerprint: this.activeFingerprint,
            createdAt: this.activeCreatedAt,
            phase,
            reason: this.reason,
        }));
    }
    async refreshReceipt() {
        if (!this.activeId) {
            return;
        }
        let result;
        try {
            result = JSON.parse((await privateRead((0, node_path_1.join)(this.directory, this.activeId, 'result.json'), 4096)).toString('utf8'));
        }
        catch (error) {
            if ((0, eosCustomerUpdateTransport_1.isRecord)(error) && error.code === 'ENOENT' && Date.now() - this.activeCreatedAt < PLAN_MS) {
                return;
            }
            this.state = 'interrupted';
            this.reason = 'EOS_UPDATE_RESULT_UNAVAILABLE';
            return;
        }
        if (!(0, eosCustomerUpdateTransport_1.isRecord)(result) ||
            result.schema !== 1 ||
            result.id !== this.activeId ||
            result.namespace !== this.options.namespace ||
            result.toVersion !== this.activeVersion) {
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
                this.lastAttemptMonotonic = node_perf_hooks_1.performance.now();
            }
            return;
        }
        if (this.options.currentVersion !== this.activeVersion) {
            this.reason = 'EOS_UPDATE_RESTART_PENDING';
            return;
        }
        try {
            const saved = JSON.parse((await privateRead((0, node_path_1.join)(this.directory, this.activeId, 'configuration.enc.json'), MAX_SNAPSHOT_BYTES * 3 + 1024)).toString('utf8'));
            if (!(0, eosCustomerUpdateTransport_1.isRecord)(saved) ||
                saved.schema !== 1 ||
                saved.namespace !== this.options.namespace ||
                typeof saved.encrypted !== 'string') {
                throw (0, eosCustomerUpdateTransport_1.updateError)('SNAPSHOT_FORMAT');
            }
            const original = JSON.parse(this.options.decryptSnapshot(saved.encrypted));
            const present = JSON.parse(await this.snapshot());
            if (!preservesUpdateConfiguration(original, present)) {
                throw (0, eosCustomerUpdateTransport_1.updateError)('CONFIGURATION_CHANGED');
            }
            await this.persistActive('completed');
            this.state = 'installed';
            this.reason = null;
            this.activeStarted = false;
            this.lastAttemptMonotonic = node_perf_hooks_1.performance.now();
        }
        catch (error) {
            this.state = 'interrupted';
            this.reason = safeReason(error);
        }
    }
    async pruneOldJobs() {
        const entries = await (0, promises_1.readdir)(this.directory, { withFileTypes: true });
        const jobs = await Promise.all(entries
            .filter(entry => UUID.test(entry.name) && entry.isDirectory() && entry.name !== this.activeId)
            .map(async (entry) => ({
            path: (0, node_path_1.join)(this.directory, entry.name),
            modified: (await (0, promises_1.lstat)((0, node_path_1.join)(this.directory, entry.name))).mtimeMs,
        })));
        jobs.sort((a, b) => b.modified - a.modified);
        for (const job of jobs.slice(2)) {
            await (0, promises_1.rm)(job.path, { recursive: true, force: true });
        }
    }
}
exports.EosCustomerUpdates = EosCustomerUpdates;
//# sourceMappingURL=eosCustomerUpdates.js.map