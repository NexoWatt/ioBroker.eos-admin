/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Führt genau einen zuvor geprüften EOS-Paketwechsel nach bestätigtem Instanzstopp aus.
 * Daten und Wirkung: Liest einen privaten lokalen Auftrag, stoppt ausschließlich dessen EOS-Instanz und protokolliert begrenzte Phasen.
 * Bei Änderungen: Keine freien Kommandos, fremden Adapter, automatischen Wiederholungen oder ungeprüften Paketpfade zulassen.
 */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';

export interface EosCustomerUpdateFile {
    path: string;
    sha256: string;
}
export interface EosCustomerUpdateJob {
    schema: 1;
    id: string;
    namespace: string;
    fromVersion: string;
    toVersion: string;
    packageDir: string;
    controllerDir: string;
    archiveIntegrity: string;
    manifestSha256: string;
    files: EosCustomerUpdateFile[];
    snapshotSha256: string;
    createdAt: number;
    enabledInstances: string[];
}
export interface EosCustomerUpdateResult {
    schema: 1;
    id: string;
    namespace: string;
    fromVersion: string;
    toVersion: string;
    phase: 'validate' | 'stopping' | 'installing' | 'verifying' | 'starting' | 'finished';
    status: 'running' | 'succeeded' | 'failed' | 'uncertain';
    updatedAt: number;
    error?: string;
    recovery?: 'not-needed' | 'restored-old' | 'not-restored';
}

const MAX_JOB_BYTES = 2 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 256 * 1024 * 1024;
const MAX_SNAPSHOT_BYTES = 24 * 1024 * 1024 + 1024;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const TOTAL_MS = 600_000;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const VERSION = /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/;
const DIGEST = /^[a-f0-9]{64}$/;
const error = (code: string): Error => new Error(`EOS_UPDATE_${code}`);
const record = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value);
const hashText = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

function relativeFile(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= 512 &&
        !/[\\:]/.test(value) &&
        ![...value].some(char => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127) &&
        !path.posix.isAbsolute(value) &&
        value.split('/').every(part => part !== '' && part !== '.' && part !== '..')
    );
}

export function parseEosCustomerUpdateJob(value: unknown, directory: string): EosCustomerUpdateJob {
    if (
        !record(value) ||
        value.schema !== 1 ||
        typeof value.id !== 'string' ||
        !UUID.test(value.id) ||
        path.basename(directory) !== value.id ||
        typeof value.namespace !== 'string' ||
        !/^eos-admin\.(0|[1-9]\d{0,5})$/.test(value.namespace) ||
        typeof value.fromVersion !== 'string' ||
        !VERSION.test(value.fromVersion) ||
        typeof value.toVersion !== 'string' ||
        !VERSION.test(value.toVersion) ||
        typeof value.packageDir !== 'string' ||
        !path.isAbsolute(value.packageDir) ||
        typeof value.controllerDir !== 'string' ||
        !path.isAbsolute(value.controllerDir) ||
        path.basename(value.packageDir) !== 'iobroker.eos-admin' ||
        path.basename(value.controllerDir) !== 'iobroker.js-controller' ||
        path.dirname(value.packageDir) !== path.dirname(value.controllerDir) ||
        typeof value.archiveIntegrity !== 'string' ||
        !/^sha512-[A-Za-z0-9+/]{86}==$/.test(value.archiveIntegrity) ||
        typeof value.manifestSha256 !== 'string' ||
        !DIGEST.test(value.manifestSha256) ||
        typeof value.snapshotSha256 !== 'string' ||
        !DIGEST.test(value.snapshotSha256) ||
        !Number.isSafeInteger(value.createdAt) ||
        Number(value.createdAt) > Date.now() + 60_000 ||
        Number(value.createdAt) < Date.now() - 3_600_000 ||
        !Array.isArray(value.enabledInstances) ||
        value.enabledInstances.length !== 1 ||
        value.enabledInstances[0] !== value.namespace ||
        !Array.isArray(value.files) ||
        value.files.length < 2 ||
        value.files.length > 8192
    ) {
        throw error('JOB_INVALID');
    }
    const before = value.fromVersion.split('.').map(Number);
    const after = value.toVersion.split('.').map(Number);
    if (
        before[0] === undefined ||
        before[1] === undefined ||
        before[2] === undefined ||
        after[0] === undefined ||
        after[1] === undefined ||
        after[2] === undefined
    ) {
        throw error('VERSION_DENIED');
    }
    if (before[0] !== after[0] || !(after[1] > before[1] || (after[1] === before[1] && after[2] > before[2]))) {
        throw error('VERSION_DENIED');
    }
    const files: EosCustomerUpdateFile[] = [];
    const seen = new Set<string>();
    for (const row of value.files) {
        if (
            !record(row) ||
            !relativeFile(row.path) ||
            typeof row.sha256 !== 'string' ||
            !DIGEST.test(row.sha256) ||
            Object.keys(row).some(key => key !== 'path' && key !== 'sha256') ||
            seen.has(row.path) ||
            row.path === 'io-package.json'
        ) {
            throw error('MANIFEST_INVALID');
        }
        seen.add(row.path);
        files.push({ path: row.path, sha256: row.sha256 });
    }
    if (
        !seen.has('package.json') ||
        !seen.has('build/main.js') ||
        hashText(JSON.stringify(files)) !== value.manifestSha256
    ) {
        throw error('MANIFEST_INVALID');
    }
    return {
        schema: 1,
        id: value.id,
        namespace: value.namespace,
        fromVersion: value.fromVersion,
        toVersion: value.toVersion,
        packageDir: value.packageDir,
        controllerDir: value.controllerDir,
        archiveIntegrity: value.archiveIntegrity,
        manifestSha256: value.manifestSha256,
        files,
        snapshotSha256: value.snapshotSha256,
        createdAt: Number(value.createdAt),
        enabledInstances: [value.namespace],
    };
}

async function privateDirectory(directory: string): Promise<void> {
    const stat = await fs.lstat(directory);
    if (
        !stat.isDirectory() ||
        stat.isSymbolicLink() ||
        stat.uid !== process.getuid?.() ||
        (stat.mode & 0o077) !== 0 ||
        (await fs.realpath(directory)) !== directory
    ) {
        throw error('JOB_DIRECTORY');
    }
}

async function regularFile(file: string, maximum: number, privateFile = false): Promise<number> {
    const stat = await fs.lstat(file);
    if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.nlink !== 1 ||
        stat.size < 0 ||
        stat.size > maximum ||
        (privateFile && (stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0))
    ) {
        throw error('FILE_INVALID');
    }
    return stat.size;
}

async function readJson(file: string, maximum: number, privateFile = false): Promise<unknown> {
    await regularFile(file, maximum, privateFile);
    const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        // A file growing after lstat cannot make readFile allocate an unbounded buffer.
        const data = Buffer.alloc(maximum + 1);
        let size = 0;
        for (;;) {
            const { bytesRead } = await handle.read(data, size, data.length - size);
            size += bytesRead;
            if (size > maximum) {
                throw error('FILE_TOO_LARGE');
            }
            if (bytesRead === 0) {
                break;
            }
        }
        return JSON.parse(data.subarray(0, size).toString('utf8')) as unknown;
    } finally {
        await handle.close();
    }
}

async function hashFile(
    file: string,
    algorithm: 'sha256' | 'sha512',
    maximum: number,
    deadline: number,
    privateFile = false,
): Promise<string> {
    await regularFile(file, maximum, privateFile);
    const descriptor = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stream = descriptor.createReadStream({ autoClose: false });
    const hash = createHash(algorithm);
    let count = 0;
    const remaining = Math.max(1, deadline - performance.now());
    const timer = setTimeout(() => stream.destroy(error('DEADLINE')), remaining);
    try {
        for await (const data of stream) {
            const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data as Uint8Array);
            count += bytes.length;
            if (count > maximum || performance.now() >= deadline) {
                throw error('FILE_TOO_LARGE');
            }
            hash.update(bytes);
        }
        return hash.digest(algorithm === 'sha512' ? 'base64' : 'hex');
    } finally {
        clearTimeout(timer);
        stream.destroy();
        await descriptor.close();
    }
}

async function packageIdentity(directory: string, name: string, version?: string): Promise<void> {
    if ((await fs.realpath(directory)) !== directory || (await fs.lstat(directory)).isSymbolicLink()) {
        throw error('PACKAGE_PATH');
    }
    const value = await readJson(path.join(directory, 'package.json'), 1024 * 1024);
    if (
        !record(value) ||
        value.name !== name ||
        typeof value.version !== 'string' ||
        (version !== undefined && value.version !== version)
    ) {
        throw error('PACKAGE_IDENTITY');
    }
    if (name === 'iobroker.js-controller' && value.version !== '7.2.5') {
        throw error('CONTROLLER_UNTESTED');
    }
    if (name === 'iobroker.eos-admin') {
        const io = await readJson(path.join(directory, 'io-package.json'), 1024 * 1024);
        if (!record(io) || !record(io.common) || io.common.name !== 'eos-admin' || io.common.version !== version) {
            throw error('PACKAGE_IDENTITY');
        }
    }
}

async function currentCodeImage(job: EosCustomerUpdateJob, deadline: number): Promise<EosCustomerUpdateFile[]> {
    const image: EosCustomerUpdateFile[] = [];
    let size = 0;
    let entries = 0;
    const walk = async (name: string, depth: number): Promise<void> => {
        if (depth > 20 || ++entries > 16_384 || !relativeFile(name)) {
            throw error('CURRENT_MANIFEST');
        }
        const target = path.join(job.packageDir, name);
        const stat = await fs.lstat(target);
        if (stat.isSymbolicLink() || (await fs.realpath(target)) !== target) {
            throw error('INSTALLED_SYMLINK');
        }
        if (stat.isDirectory()) {
            const children = await fs.readdir(target);
            if (children.length > 8192) {
                throw error('CURRENT_MANIFEST');
            }
            for (const child of children.sort()) {
                // Controller/npm dependency directories are a separate trusted
                // component. No installation has started in the recovery branch.
                if (child !== 'node_modules') {
                    await walk(`${name}/${child}`, depth + 1);
                }
            }
            return;
        }
        size += await regularFile(target, MAX_EXPANDED_BYTES);
        if (size > MAX_EXPANDED_BYTES || image.length >= 8192) {
            throw error('CURRENT_MANIFEST');
        }
        image.push({ path: name, sha256: await hashFile(target, 'sha256', MAX_EXPANDED_BYTES, deadline) });
    };
    await walk('package.json', 0);
    await walk('io-package.json', 0);
    for (const root of ['build', 'ui', 'modules', 'public', 'adminWww', 'admin']) {
        try {
            await fs.lstat(path.join(job.packageDir, root));
        } catch (cause) {
            if (record(cause) && cause.code === 'ENOENT' && root !== 'build') {
                continue;
            }
            throw cause;
        }
        await walk(root, 0);
    }
    if (!image.some(file => file.path === 'build/main.js')) {
        throw error('CURRENT_MANIFEST');
    }
    return image.sort((a, b) => a.path.localeCompare(b.path));
}

async function command(
    cli: string,
    args: string[],
    milliseconds: number,
    capture = false,
    signal?: AbortSignal,
): Promise<string> {
    if (signal?.aborted) {
        throw error('WORKER_ABORTED');
    }
    if (milliseconds <= 0) {
        throw error('DEADLINE');
    }
    const env = { ...process.env };
    delete env.NODE_OPTIONS;
    delete env.NODE_PATH;
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [cli, ...args], {
            cwd: path.dirname(cli),
            env,
            shell: false,
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let output = '';
        let bytes = 0;
        let fault: Error | undefined;
        let killTimer: ReturnType<typeof setTimeout> | undefined;
        let terminalTimer: ReturnType<typeof setTimeout> | undefined;
        const deadlineTimer: { value?: ReturnType<typeof setTimeout> } = {};
        const abortBinding: { callback?: () => void } = {};
        let settled = false;
        const killGroup = (signal: NodeJS.Signals): void => {
            if (child.pid) {
                try {
                    process.kill(-child.pid, signal);
                } catch (cause) {
                    if (!record(cause) || cause.code !== 'ESRCH') {
                        fault ||= error('PROCESS_UNCERTAIN');
                    }
                }
            }
        };
        const finish = (failure?: Error): void => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(deadlineTimer.value);
            clearTimeout(killTimer);
            clearTimeout(terminalTimer);
            if (abortBinding.callback) {
                signal?.removeEventListener('abort', abortBinding.callback);
            }
            child.stdout?.destroy();
            child.stderr?.destroy();
            if (failure) {
                reject(failure);
            } else {
                resolve(output.trim());
            }
        };
        const abort = (reason: Error): void => {
            if (fault) {
                return;
            }
            fault = reason;
            killGroup('SIGTERM');
            killTimer = setTimeout(() => killGroup('SIGKILL'), 500);
            terminalTimer = setTimeout(() => {
                killGroup('SIGKILL');
                finish(error('PROCESS_UNCERTAIN'));
            }, 2000);
        };
        deadlineTimer.value = setTimeout(() => abort(error('COMMAND_TIMEOUT')), milliseconds);
        abortBinding.callback = () => abort(error('WORKER_ABORTED'));
        signal?.addEventListener('abort', abortBinding.callback, { once: true });
        if (signal?.aborted) {
            abortBinding.callback();
        }
        const collect = (data: Buffer, stdout: boolean): void => {
            bytes += data.length;
            if (bytes > MAX_OUTPUT_BYTES || (capture && output.length + (stdout ? data.length : 0) > 1024)) {
                abort(error('COMMAND_OUTPUT_LIMIT'));
                return;
            }
            if (capture && stdout) {
                output += data.toString('utf8');
            }
        };
        child.stdout?.on('data', (data: Buffer) => collect(data, true));
        child.stderr?.on('data', (data: Buffer) => collect(data, false));
        child.on('error', () => abort(error('COMMAND_FAILED')));
        child.on('close', code => {
            // A CLI exit can leave a descendant alive. Kill its isolated process group
            // before allowing a subsequent phase after an aborted command.
            if (fault) {
                killGroup('SIGKILL');
            }
            finish(fault || (code === 0 ? undefined : error('COMMAND_FAILED')));
        });
    });
}

/** Only decreases the production phase budgets; useful for deterministic failure injection. */
export interface EosCustomerUpdateWorkerOptions {
    maximumPhaseMs?: number;
    signal?: AbortSignal;
}

export async function runEosCustomerUpdateWorker(
    directory: string,
    options: EosCustomerUpdateWorkerOptions = {},
): Promise<EosCustomerUpdateResult> {
    if (process.platform !== 'linux' || process.getuid?.() === 0) {
        throw error('PLATFORM_UNSUPPORTED');
    }
    if (!path.isAbsolute(directory) || path.normalize(directory) !== directory) {
        throw error('JOB_DIRECTORY');
    }
    await privateDirectory(directory);
    const job = parseEosCustomerUpdateJob(
        await readJson(path.join(directory, 'job.json'), MAX_JOB_BYTES, true),
        directory,
    );
    const cli = path.join(job.controllerDir, 'iobroker.js');
    const deadline = performance.now() + TOTAL_MS;
    const phaseLimit =
        Number.isSafeInteger(options.maximumPhaseMs) && Number(options.maximumPhaseMs) > 0
            ? Number(options.maximumPhaseMs)
            : TOTAL_MS;
    const budget = (maximum: number): number =>
        Math.min(maximum, phaseLimit, Math.max(0, deadline - performance.now()));
    const assertActive = (): void => {
        if (options.signal?.aborted) {
            throw error('WORKER_ABORTED');
        }
        if (performance.now() >= deadline) {
            throw error('DEADLINE');
        }
    };
    const result: EosCustomerUpdateResult = {
        schema: 1,
        id: job.id,
        namespace: job.namespace,
        fromVersion: job.fromVersion,
        toVersion: job.toVersion,
        phase: 'validate',
        status: 'running',
        updatedAt: Date.now(),
    };
    const resultPath = path.join(directory, 'result.json');
    const claimPath = path.join(directory, 'worker.claim');
    const claim = await fs.open(
        claimPath,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
        0o600,
    );
    await claim.close();
    const writeResult = async (): Promise<void> => {
        result.updatedAt = Date.now();
        const temporary = path.join(directory, 'result.pending');
        const file = await fs.open(
            temporary,
            constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
            0o600,
        );
        try {
            await file.writeFile(JSON.stringify(result));
            await file.sync();
        } finally {
            await file.close();
        }
        await fs.rename(temporary, resultPath);
        const parent = await fs.open(directory, constants.O_RDONLY | constants.O_DIRECTORY);
        try {
            await parent.sync();
        } finally {
            await parent.close();
        }
    };
    const phase = async (value: EosCustomerUpdateResult['phase']): Promise<void> => {
        assertActive();
        result.phase = value;
        await writeResult();
    };
    const waitAlive = async (expected: boolean): Promise<void> => {
        const end = performance.now() + budget(30_000);
        do {
            const value = await command(
                cli,
                ['state', 'getValue', `system.adapter.${job.namespace}.alive`],
                Math.min(5000, end - performance.now()),
                true,
                options.signal,
            );
            if (value === String(expected)) {
                return;
            }
            if (value !== 'true' && value !== 'false') {
                throw error('INSTANCE_STATE_INVALID');
            }
            await delay(Math.min(250, Math.max(1, end - performance.now())));
        } while (performance.now() < end);
        throw error('INSTANCE_STATE_TIMEOUT');
    };
    let installStarted = false;
    let stopAttempted = false;
    let oldImage: EosCustomerUpdateFile[] | undefined;
    try {
        await writeResult();
        assertActive();
        await packageIdentity(job.packageDir, 'iobroker.eos-admin', job.fromVersion);
        await packageIdentity(job.controllerDir, 'iobroker.js-controller');
        await regularFile(cli, 1024 * 1024);
        if ((await fs.realpath(cli)) !== cli) {
            throw error('CONTROLLER_PATH');
        }
        const archive = path.join(directory, 'release.tgz');
        if (
            `sha512-${await hashFile(archive, 'sha512', MAX_ARCHIVE_BYTES, deadline, true)}` !== job.archiveIntegrity ||
            (await hashFile(
                path.join(directory, 'configuration.enc.json'),
                'sha256',
                MAX_SNAPSHOT_BYTES,
                deadline,
                true,
            )) !== job.snapshotSha256
        ) {
            throw error('STAGED_CONTENT_CHANGED');
        }
        oldImage = await currentCodeImage(job, deadline);
        await phase('stopping');
        stopAttempted = true;
        await command(cli, ['stop', job.namespace], budget(30_000), false, options.signal);
        await waitAlive(false);
        await phase('installing');
        installStarted = true;
        // The controller URL install does not stop EOS on Linux. The confirmed
        // stop above is mandatory; fixed argv avoids cmdExec's space splitting.
        await command(cli, ['url', archive, 'eos-admin'], budget(480_000), false, options.signal);
        await phase('verifying');
        await packageIdentity(job.packageDir, 'iobroker.eos-admin', job.toVersion);
        let expandedBytes = 0;
        for (const file of job.files) {
            const target = path.join(job.packageDir, file.path);
            if ((await fs.realpath(target)) !== target) {
                throw error('INSTALLED_SYMLINK');
            }
            expandedBytes += await regularFile(target, MAX_EXPANDED_BYTES);
            if (
                expandedBytes > MAX_EXPANDED_BYTES ||
                (await hashFile(target, 'sha256', MAX_EXPANDED_BYTES, deadline)) !== file.sha256
            ) {
                throw error('INSTALLED_CONTENT_CHANGED');
            }
        }
        await phase('starting');
        await command(cli, ['start', job.namespace], budget(30_000), false, options.signal);
        await waitAlive(true);
        result.status = 'succeeded';
        await phase('finished');
    } catch (cause) {
        result.status = installStarted ? 'uncertain' : 'failed';
        result.error =
            cause instanceof Error && /^EOS_UPDATE_[A-Z_]{1,60}$/.test(cause.message)
                ? cause.message
                : 'EOS_UPDATE_WORKER_FAILED';
        result.recovery = 'not-needed';
        if (!installStarted && stopAttempted) {
            result.recovery = 'not-restored';
            try {
                await packageIdentity(job.packageDir, 'iobroker.eos-admin', job.fromVersion);
                if (!oldImage || JSON.stringify(await currentCodeImage(job, deadline)) !== JSON.stringify(oldImage)) {
                    throw error('CURRENT_CONTENT_CHANGED');
                }
                // No installation was attempted. Restoring only the previously
                // enabled, unchanged own instance is not an install retry.
                await command(cli, ['start', job.namespace], budget(30_000), false, options.signal);
                await waitAlive(true);
                result.recovery = 'restored-old';
            } catch {
                // The maintenance receipt records that manual recovery is needed.
                result.recovery = 'not-restored';
            }
        }
        await writeResult();
    }
    return result;
}

if (require.main === module) {
    const abortController = new AbortController();
    const stop = (): void => abortController.abort();
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
    void runEosCustomerUpdateWorker(process.argv[2] || '', { signal: abortController.signal }).then(
        value => {
            process.removeListener('SIGTERM', stop);
            process.removeListener('SIGINT', stop);
            process.exitCode = value.status === 'succeeded' ? 0 : 1;
        },
        () => {
            process.removeListener('SIGTERM', stop);
            process.removeListener('SIGINT', stop);
            process.stderr.write('EOS_UPDATE_WORKER_FAILED\n');
            process.exitCode = 1;
        },
    );
}
