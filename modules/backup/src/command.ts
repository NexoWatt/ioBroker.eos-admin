/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { constants } from 'node:fs';
import { lstat, open, realpath, rm, stat, type FileHandle } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform, Writable } from 'node:stream';
import { fail } from './types';
const ALLOWED = new Set(['pg_dump', 'mysqldump', 'sqlite3', 'influx', 'influxd', 'redis-cli']);
export async function executable(name: string): Promise<string> {
    if (!ALLOWED.has(name)) throw fail('EOS_BACKUP_EXECUTABLE');
    for (const root of ['/usr/bin', '/usr/local/bin', '/bin']) {
        try {
            const path = await realpath(join(root, name)),
                s = await stat(path);
            if (s.isFile() && s.uid === 0 && (s.mode & 0o022) === 0 && (s.mode & 0o111) !== 0) return path;
        } catch {
            /* try fixed next directory */
        }
    }
    throw fail('EOS_BACKUP_EXECUTABLE_MISSING_' + name.replace(/[^A-Za-z0-9]/g, '_').toUpperCase());
}

interface RunOptions {
    cwd: string;
    output?: string;
    environment?: Record<string, string>;
    timeout?: number;
    maxBytes?: number;
}
/** Fixed tools run without a shell, inside the owning backup worker's process group. */
export async function run(exe: string, args: string[], options: RunOptions): Promise<void> {
    const timeout = options.timeout ?? 10 * 60 * 1000,
        max = options.maxBytes ?? 10 * 1024 ** 3;
    if (!Number.isFinite(timeout) || timeout < 1 || !Number.isSafeInteger(max) || max < 0)
        throw fail('EOS_BACKUP_COMMAND_OPTIONS');
    // Open before spawn: EEXIST/permissions must not leave an unmanaged process behind.
    const sink: FileHandle | null = options.output
        ? await open(
              options.output,
              constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
              0o600,
          )
        : null;
    let stream: Writable | undefined,
        child: ChildProcessWithoutNullStreams | undefined,
        timer: NodeJS.Timeout | undefined;
    let succeeded = false;
    try {
        stream = sink
            ? sink.createWriteStream({ autoClose: false })
            : new Writable({
                  write(_chunk, _enc, done) {
                      done();
                  },
              });
        // Explicit pipes permit immediate lifecycle registration; stdin is never used.
        child = spawn(exe, args, {
            cwd: options.cwd,
            shell: false,
            detached: false,
            env: { PATH: '/usr/local/bin:/usr/bin:/bin', LANG: 'C.UTF-8', HOME: options.cwd, ...options.environment },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const processChild = child;
        processChild.stdin.end();
        processChild.stdin.on('error', () => {});
        processChild.stderr.resume();
        let finish: (result: boolean) => void = () => {};
        const exited = new Promise<boolean>(resolve => {
            let settled = false;
            finish = result => {
                if (!settled) {
                    settled = true;
                    resolve(result);
                }
            };
            processChild.once('error', () => finish(false));
            processChild.once('exit', code => finish(code === 0));
        });
        const stop = (): void => {
            processChild.kill('SIGKILL');
            processChild.stdout.destroy();
            processChild.stderr.destroy();
            processChild.stdin.destroy();
            finish(false);
        };
        let bytes = 0;
        const bound = new Transform({
            transform(chunk: Buffer, _encoding, done) {
                bytes += chunk.length;
                done(bytes > max ? fail('EOS_BACKUP_COMMAND_OUTPUT_LIMIT') : null, chunk);
            },
        });
        // Attach rejection handling immediately: a failed writer must never reject
        // unobserved while we wait for a long-running child to exit.
        const transferred = pipeline(processChild.stdout, bound, stream).then(
            () => true,
            () => {
                stop();
                return false;
            },
        );
        timer = setTimeout(stop, timeout);
        timer.unref();
        const [okExit, okOutput] = await Promise.all([exited, transferred]);
        if (!okExit || !okOutput || bytes > max) throw fail('EOS_BACKUP_COMMAND_FAILED');
        await sink?.sync();
        succeeded = true;
    } catch {
        child?.kill('SIGKILL');
        throw fail('EOS_BACKUP_COMMAND_FAILED');
    } finally {
        clearTimeout(timer);
        child?.stdout.destroy();
        child?.stderr.destroy();
        child?.stdin.destroy();
        stream?.destroy();
        await sink?.close();
        if (!succeeded && sink && options.output) await rm(options.output, { force: true });
    }
}
export async function controllerCli(installationDir: string): Promise<string> {
    const path = join(installationDir, 'node_modules/iobroker.js-controller/iobroker.js');
    const s = await lstat(path);
    if (!s.isFile() || s.isSymbolicLink() || (s.mode & 0o002) !== 0) throw fail('EOS_BACKUP_CONTROLLER_PATH');
    return path;
}
