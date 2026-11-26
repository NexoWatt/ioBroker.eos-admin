"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executable = executable;
exports.run = run;
exports.controllerCli = controllerCli;
/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const promises_2 = require("node:stream/promises");
const node_stream_1 = require("node:stream");
const types_1 = require("./types");
const ALLOWED = new Set(['pg_dump', 'mysqldump', 'sqlite3', 'influx', 'influxd', 'redis-cli']);
async function executable(name) {
    if (!ALLOWED.has(name))
        throw (0, types_1.fail)('EOS_BACKUP_EXECUTABLE');
    for (const root of ['/usr/bin', '/usr/local/bin', '/bin']) {
        try {
            const path = await (0, promises_1.realpath)((0, node_path_1.join)(root, name)), s = await (0, promises_1.stat)(path);
            if (s.isFile() && s.uid === 0 && (s.mode & 0o022) === 0 && (s.mode & 0o111) !== 0)
                return path;
        }
        catch {
            /* try fixed next directory */
        }
    }
    throw (0, types_1.fail)('EOS_BACKUP_EXECUTABLE_MISSING_' + name.replace(/[^A-Za-z0-9]/g, '_').toUpperCase());
}
/** Fixed tools run without a shell, inside the owning backup worker's process group. */
async function run(exe, args, options) {
    const timeout = options.timeout ?? 10 * 60 * 1000, max = options.maxBytes ?? 10 * 1024 ** 3;
    if (!Number.isFinite(timeout) || timeout < 1 || !Number.isSafeInteger(max) || max < 0)
        throw (0, types_1.fail)('EOS_BACKUP_COMMAND_OPTIONS');
    // Open before spawn: EEXIST/permissions must not leave an unmanaged process behind.
    const sink = options.output
        ? await (0, promises_1.open)(options.output, node_fs_1.constants.O_WRONLY | node_fs_1.constants.O_CREAT | node_fs_1.constants.O_EXCL | node_fs_1.constants.O_NOFOLLOW, 0o600)
        : null;
    let stream, child, timer;
    let succeeded = false;
    try {
        stream = sink
            ? sink.createWriteStream({ autoClose: false })
            : new node_stream_1.Writable({
                write(_chunk, _enc, done) {
                    done();
                },
            });
        // Explicit pipes permit immediate lifecycle registration; stdin is never used.
        child = (0, node_child_process_1.spawn)(exe, args, {
            cwd: options.cwd,
            shell: false,
            detached: false,
            env: { PATH: '/usr/local/bin:/usr/bin:/bin', LANG: 'C.UTF-8', HOME: options.cwd, ...options.environment },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const processChild = child;
        processChild.stdin.end();
        processChild.stdin.on('error', () => { });
        processChild.stderr.resume();
        let finish = () => { };
        const exited = new Promise(resolve => {
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
        const stop = () => {
            processChild.kill('SIGKILL');
            processChild.stdout.destroy();
            processChild.stderr.destroy();
            processChild.stdin.destroy();
            finish(false);
        };
        let bytes = 0;
        const bound = new node_stream_1.Transform({
            transform(chunk, _encoding, done) {
                bytes += chunk.length;
                done(bytes > max ? (0, types_1.fail)('EOS_BACKUP_COMMAND_OUTPUT_LIMIT') : null, chunk);
            },
        });
        // Attach rejection handling immediately: a failed writer must never reject
        // unobserved while we wait for a long-running child to exit.
        const transferred = (0, promises_2.pipeline)(processChild.stdout, bound, stream).then(() => true, () => {
            stop();
            return false;
        });
        timer = setTimeout(stop, timeout);
        timer.unref();
        const [okExit, okOutput] = await Promise.all([exited, transferred]);
        if (!okExit || !okOutput || bytes > max)
            throw (0, types_1.fail)('EOS_BACKUP_COMMAND_FAILED');
        await sink?.sync();
        succeeded = true;
    }
    catch {
        child?.kill('SIGKILL');
        throw (0, types_1.fail)('EOS_BACKUP_COMMAND_FAILED');
    }
    finally {
        clearTimeout(timer);
        child?.stdout.destroy();
        child?.stderr.destroy();
        child?.stdin.destroy();
        stream?.destroy();
        await sink?.close();
        if (!succeeded && sink && options.output)
            await (0, promises_1.rm)(options.output, { force: true });
    }
}
async function controllerCli(installationDir) {
    const path = (0, node_path_1.join)(installationDir, 'node_modules/iobroker.js-controller/iobroker.js');
    const s = await (0, promises_1.lstat)(path);
    if (!s.isFile() || s.isSymbolicLink() || (s.mode & 0o002) !== 0)
        throw (0, types_1.fail)('EOS_BACKUP_CONTROLLER_PATH');
    return path;
}
