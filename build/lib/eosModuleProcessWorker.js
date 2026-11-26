/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const { isAbsolute } = require('node:path');
const { performance } = require('node:perf_hooks');
const { channel, ADAPTER_METHODS, MODULE_METHODS, error, errorCode, isRecord, sanitizeLog, validate } = require('./eosModuleProcessProtocol');
const { loadModuleFactory, reportModuleLoadFailure } = require('./eosModuleLoad');
/** @typedef {import('./eosModuleProcessTypes').RecordValue} RecordValue */
/** @typedef {import('./eosModuleProcessTypes').Call} Call */
/** @type {import('./eosModuleProcessTypes').Channel|undefined} */
let rpc;
/** @type {import('./eosModuleProcessTypes').ModuleRuntime|undefined} */
let runtime;
let initialized = false;
let initializationError = '';
let stopping = false;
let leaseUntil = 0;
let authorityGeneration = 0;
let authorityFailureReported = false;
/** @type {NodeJS.Timeout|undefined} */ let heartbeat;
let leaseSequence = 0;
/** @type {Set<NodeJS.Timeout>} */ const timers = new Set();
/** @type {Map<string, import('./eosModuleProcessTypes').WorkerDownload>} */ const downloads = new Map();
function invalidateLease() {
    if (leaseUntil > 0)
        authorityGeneration++;
    leaseUntil = 0;
}
const canOperate = () => {
    if (leaseUntil > 0 && performance.now() >= leaseUntil)
        invalidateLease();
    return !stopping && process.connected && leaseUntil > 0;
};
function getRpc() { if (!rpc)
    throw error('EOS_MODULE_PROCESS_INIT'); return rpc; }
/** @param {RecordValue} message */
function updateLease(message) {
    if (typeof message.sequence !== 'number' || !Number.isSafeInteger(message.sequence) || message.sequence <= leaseSequence)
        return;
    leaseSequence = message.sequence;
    // Parent and child share the host clock; an IPC message queued while the
    // child was blocked must not create a fresh authorization on resumption.
    const remaining = typeof message.expiresAt === 'number' && Number.isFinite(message.expiresAt) ? Math.min(1000, message.expiresAt - Date.now()) : 0;
    // A later positive message cannot revive an operation admitted before a
    // revocation or a gap in the lease, even if no timer ran during that gap.
    if (leaseUntil > 0 && performance.now() >= leaseUntil)
        invalidateLease();
    if (message.allowed === true && !stopping && remaining > 0)
        leaseUntil = performance.now() + remaining;
    else
        invalidateLease();
}
async function shutdown() {
    if (stopping)
        return;
    stopping = true;
    invalidateLease();
    clearInterval(heartbeat);
    for (const timer of timers) {
        clearTimeout(timer);
        clearInterval(timer);
    }
    timers.clear();
    for (const download of downloads.values()) {
        download.cancelled = true;
        download.stream?.destroy();
    }
    downloads.clear();
    const forced = setTimeout(() => process.exit(1), 1500);
    try {
        await runtime?.stop();
    }
    finally {
        clearTimeout(forced);
        process.exit(0);
    }
}
/** @param {boolean} repeat @param {Call} callback @param {number} ms @param {...unknown} args */
function localTimer(repeat, callback, ms, ...args) {
    if (stopping || timers.size >= 256 || typeof callback !== 'function' || !Number.isFinite(ms) || ms < (repeat ? 1 : 0))
        throw error('EOS_MODULE_TIMER');
    let pending = false;
    const run = () => {
        if (!repeat)
            timers.delete(timer);
        if (!canOperate() || pending)
            return;
        pending = true;
        Promise.resolve().then(() => callback(...args)).catch(() => {
            invalidateLease();
            try {
                getRpc().event('failure', { code: 'EOS_MODULE_CALLBACK_FAILED' });
            }
            catch { /* parent will time out */ }
        }).finally(() => { pending = false; });
    };
    const timer = repeat ? setInterval(run, ms) : setTimeout(run, ms);
    timer.unref?.();
    timers.add(timer);
    return timer;
}
/** @param {unknown} received */
function boot(received) {
    if (initialized || !isRecord(received) || received.type !== 'init')
        return;
    validate(received);
    if (typeof received.id !== 'string' || !['devices', 'eebus', 'backup', 'ocpp'].includes(received.id) ||
        typeof received.generation !== 'number' || !Number.isSafeInteger(received.generation) ||
        typeof received.baseDir !== 'string' || !isAbsolute(received.baseDir) ||
        !isRecord(received.moduleOptions) || !isRecord(received.moduleOptions.adapter) ||
        typeof received.moduleOptions.adapter.namespace !== 'string' || !isRecord(received.moduleOptions.config) ||
        typeof received.moduleOptions.dataDir !== 'string')
        throw error('EOS_MODULE_PROCESS_INIT');
    const message = /** @type {import('./eosModuleProcessTypes').WorkerInit} */ (received);
    initialized = true;
    process.off('message', boot);
    updateLease(message);
    rpc = channel(process, message.generation, async (method, args) => {
        if (!MODULE_METHODS.includes(method))
            throw error('EOS_MODULE_PROCESS_METHOD');
        if (method === 'stop') {
            void shutdown();
            return null;
        }
        if (method === 'prepare') {
            // Factory imports may take longer than the short operation lease.
            // This reply only acknowledges construction, never hardware authority.
            // The parent must renew authority before sending the actual start.
            if (stopping)
                throw error('EOS_MODULE_PROCESS_INACTIVE');
            if (!runtime)
                throw error(initializationError || 'EOS_MODULE_PROCESS_INIT');
            return true;
        }
        if (method === 'download.close') {
            if (typeof args[0] !== 'string')
                throw error('EOS_MODULE_PROCESS_DOWNLOAD');
            const download = downloads.get(args[0]);
            if (!download)
                return null;
            download.cancelled = true;
            download.stream?.destroy();
            if (download.stream)
                downloads.delete(args[0]);
            return null;
        }
        if (!canOperate())
            throw error('EOS_MODULE_PROCESS_INACTIVE');
        const current = runtime;
        if (!current)
            throw error(initializationError || 'EOS_MODULE_PROCESS_INIT');
        if (method === 'download.open') {
            if (message.id !== 'backup' || downloads.size >= 4 || typeof current.getDownload !== 'function')
                throw error('EOS_MODULE_PROCESS_DOWNLOAD');
            const handle = args[1];
            if (typeof handle !== 'string' || !/^[a-f0-9-]{36}$/.test(handle) || downloads.has(handle))
                throw error('EOS_MODULE_PROCESS_DOWNLOAD');
            /** @type {import('./eosModuleProcessTypes').WorkerDownload} */
            const download = { cancelled: false, stream: null, iterator: null, remainder: null, reading: false };
            downloads.set(handle, download);
            try {
                const result = await current.getDownload(args[0]);
                if (!canOperate() || download.cancelled) {
                    result.stream.destroy();
                    throw error('EOS_MODULE_PROCESS_INACTIVE');
                }
                download.stream = result.stream;
                download.iterator = result.stream[Symbol.asyncIterator]();
                return { handle, filename: result.filename, contentType: result.contentType, size: result.size };
            }
            catch (issue) {
                downloads.delete(handle);
                throw issue;
            }
        }
        if (method.startsWith('download.')) {
            if (typeof args[0] !== 'string')
                throw error('EOS_MODULE_PROCESS_DOWNLOAD');
            const download = downloads.get(args[0]);
            if (!download?.iterator || download.cancelled || download.reading)
                throw error('EOS_MODULE_PROCESS_DOWNLOAD');
            download.reading = true;
            try {
                // Node's async iterator may coalesce buffered chunks. Retain a
                // bounded remainder while keeping each IPC response at 64 KiB.
                const chunk = download.remainder ? { done: false, value: download.remainder } : await download.iterator.next();
                if (chunk.done) {
                    downloads.delete(args[0]);
                    return { done: true };
                }
                if (!Buffer.isBuffer(chunk.value) || chunk.value.length > 2 * 1024 * 1024) {
                    download.stream?.destroy();
                    downloads.delete(args[0]);
                    throw error('EOS_MODULE_PROCESS_DOWNLOAD');
                }
                download.remainder = chunk.value.length > 65536 ? chunk.value.subarray(65536) : null;
                return { done: false, data: chunk.value.subarray(0, 65536).toString('base64') };
            }
            finally {
                download.reading = false;
            }
        }
        const callable = /** @type {RecordValue} */ ( /** @type {unknown} */(current))[method];
        if (typeof callable !== 'function') {
            if (['onStateChange', 'onMessage'].includes(method))
                return null;
            throw error('EOS_MODULE_PROCESS_METHOD');
        }
        try {
            return await /** @type {Call} */ (callable).apply(current, args);
        }
        catch (issue) {
            throw reportModuleLoadFailure(issue, message.baseDir, message.id, text => getRpc().event('log', { level: 'warn', text })) || issue;
        }
    }, event => {
        if (event.type === 'lease')
            updateLease(event);
        else if (event.type === 'invalid')
            void shutdown();
    });
    const options = message.moduleOptions;
    /** @type {RecordValue} */
    const adapter = { ...options.adapter };
    for (const method of ADAPTER_METHODS) {
        /** @param {...unknown} args */
        adapter[method] = (...args) => {
            if (method === 'sendTo') {
                const last = args.at(-1);
                const callback = typeof last === 'function' ? /** @type {Call} */ (last) : null;
                if (callback)
                    args.pop();
                void getRpc().request(method, args).then(result => callback?.(canOperate() ? result : { accepted: false, error: 'EOS_MODULE_BRIDGE_UNAVAILABLE' }), () => callback?.({ accepted: false, error: 'EOS_MODULE_BRIDGE_UNAVAILABLE' }));
                return;
            }
            return getRpc().request(method, args);
        };
    }
    const moduleLog = Object.fromEntries(['warn', 'error', 'info', 'debug'].map(level => [level, /** @param {unknown} value */ /** @param {unknown} value */ value => {
            try {
                getRpc().event('log', { level, text: sanitizeLog(value, options.config) });
            }
            catch { /* logging never expands the bounded queue */ }
        }]));
    adapter.log = moduleLog;
    /** @param {Call} fn @param {number} ms @param {...unknown} args */
    adapter.setTimeout = (fn, ms, ...args) => localTimer(false, fn, ms, ...args);
    /** @param {Call} fn @param {number} ms @param {...unknown} args */
    adapter.setInterval = (fn, ms, ...args) => localTimer(true, fn, ms, ...args);
    /** @param {NodeJS.Timeout} timer */
    adapter.clearTimeout = adapter.clearInterval = timer => { clearTimeout(timer); clearInterval(timer); timers.delete(timer); };
    try {
        const factory = loadModuleFactory(message.baseDir, message.id, text => moduleLog.warn(text));
        if (!isRecord(factory) || typeof factory.createHostedModule !== 'function')
            throw error('EOS_MODULE_PROCESS_INIT');
        const created = /** @type {Call} */ (factory.createHostedModule)({ ...options,
            adapter, canOperate, ...(message.id === 'ocpp' ? {
                getAuthorityGeneration: () => { canOperate(); return authorityGeneration; },
                onAuthorityLost: () => {
                    if (stopping || authorityFailureReported)
                        return;
                    authorityFailureReported = true;
                    getRpc().event('failure', { code: 'EOS_MODULE_PROCESS_AUTHORITY_EXPIRED' });
                },
            } : {}),
            ...(message.id === 'backup' ? { getHistoryBackupRequirement: () => getRpc().request('getHistoryBackupRequirement') } : {}) });
        if (!isRecord(created) || typeof created.start !== 'function' || typeof created.stop !== 'function' ||
            typeof created.getStatus !== 'function')
            throw error('EOS_MODULE_PROCESS_INIT');
        runtime = /** @type {import('./eosModuleProcessTypes').ModuleRuntime} */ ( /** @type {unknown} */(created));
    }
    catch (issue) {
        // Reply to the parent's pending start request with a bounded error code.
        // An uncaught exception would otherwise turn a missing dependency into
        // a generic exit and trigger pointless automatic process replacements.
        initializationError = errorCode(reportModuleLoadFailure(issue, message.baseDir, message.id, text => moduleLog.warn(text)) || issue);
        return;
    }
    let nextDeviceReport = 0;
    let lastReport = '';
    heartbeat = setInterval(() => {
        /** @type {RecordValue} */
        const data = {};
        if ((message.id === 'devices' || message.id === 'eebus' || message.id === 'ocpp') && runtime?.getDashboardDeviceHealth &&
            performance.now() >= nextDeviceReport) {
            nextDeviceReport = performance.now() + 2000;
            try {
                const report = runtime.getDashboardDeviceHealth();
                const serialized = JSON.stringify(report);
                if (serialized && serialized === lastReport)
                    data.deviceHealthConfirmed = true;
                else
                    data.deviceHealth = report ?? null;
                lastReport = serialized || '';
            }
            catch {
                data.deviceHealth = null;
                lastReport = '';
            }
        }
        try {
            getRpc().event('heartbeat', data);
        }
        catch {
            void shutdown();
        }
    }, 250);
    heartbeat.unref?.();
}
process.on('message', boot);
process.on('disconnect', () => { void shutdown(); });
process.on('SIGTERM', () => { void shutdown(); });
process.on('uncaughtException', () => {
    leaseUntil = 0;
    try {
        rpc?.event('failure', { code: 'EOS_MODULE_PROCESS_UNCAUGHT' });
    }
    catch { /* exit still required */ }
    process.exit(1);
});
process.on('unhandledRejection', () => {
    leaseUntil = 0;
    try {
        rpc?.event('failure', { code: 'EOS_MODULE_PROCESS_REJECTION' });
    }
    catch { /* exit still required */ }
    process.exit(1);
});
//# sourceMappingURL=eosModuleProcessWorker.js.map