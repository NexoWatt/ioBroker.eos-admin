/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';

const { fork } = require('node:child_process');
const { join } = require('node:path');
const { Readable } = require('node:stream');
const { performance } = require('node:perf_hooks');
const { randomUUID } = require('node:crypto');
const { normalizedDeviceHealth } = require('./eosDashboardProcessStatus');
const { channel, ADAPTER_METHODS, error, errorCode, isRecord, sanitizeLog, validate } = require('./eosModuleProcessProtocol');
/** @typedef {import('./eosModuleProcessTypes').RecordValue} RecordValue */

/** One runtime per OS process. No adapter-core or owner object crosses this boundary. */
class EosModuleProcess {
    /** @param {import('./eosModuleProcess').ModuleProcessOptions} options */
    constructor(options) {
        this.options = options;
        /** @type {import('node:child_process').ChildProcess|null} */
        this.child = null;
        /** @type {import('./eosModuleProcessTypes').Channel|null} */
        this.rpc = null;
        /** @type {NodeJS.Timeout|undefined} */
        this.timer = undefined;
        this.stopping = false;
        this.failure = '';
        /** @type {Promise<void>|null} */
        this.stopPromise = null;
        /** @type {Set<Readable>} */
        this.streams = new Set();
        this.state = 'stopped';
        this.lastHeartbeatAt = 0;
        this.lastHeartbeat = 0;
        /** @type {import('./eosDashboardProcessStatus').InternalDeviceHealth | null} */
        this.deviceHealth = null;
        this.deviceHealthAt = 0;
        /** @type {Promise<{code:number|null,signal:NodeJS.Signals|null}>|null} */
        this.exitPromise = null;
        this.leaseSequence = 0;
        this.logWindow = 0;
        this.logCount = 0;
    }
    getDeviceHealth() {
        const age = Date.now() - this.deviceHealthAt;
        return this.state === 'running' && this.deviceHealth && age >= 0 && age <= 6000
            ? {...this.deviceHealth,observedAt:this.deviceHealthAt} : null;
    }
    health() {
        return { mode: 'process', ...(this.options.standby ? {standby:true} : {}), state: this.state, pid: this.child?.pid || null,
            generation: this.options.generation, lastError: this.failure, lastHeartbeatAt: this.lastHeartbeatAt };
    }
    /** @param {string} code */
    fail(code) {
        if (this.stopping || this.failure) return;
        this.failure = errorCode({ code }); this.state = 'error';
        try { this.options.onFailure?.(this.failure); } catch { /* process still must stop */ }
        // Kill first; the host may restart only after stop() confirms actual exit.
        void this.stop().catch(() => this.options.onFailure?.('EOS_MODULE_PROCESS_STOP_UNCONFIRMED'));
    }
    /** @param {boolean} allowed */
    authority(allowed) {
        this.rpc?.event('lease', { allowed, sequence: ++this.leaseSequence, expiresAt: Date.now() + 1000 });
    }
    revoke() { try { this.authority(false); } catch { /* watchdog/stop retain authority */ } }
    async start() {
        if (this.child || this.stopping) throw error('EOS_MODULE_PROCESS_ALREADY_STARTED');
        const standby = this.options.standby === true;
        if (!standby && !this.options.canOperate()) throw error('EOS_MODULE_PROCESS_INACTIVE');
        this.state = 'starting';
        const child = fork(this.options.workerPath || join(__dirname, 'eosModuleProcessWorker.js'), [], {
            stdio: ['ignore', 'ignore', 'ignore', 'ipc'], serialization: 'json',
            // Do not inherit inspector/test switches or parent environment secrets.
            execArgv: [], env: Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TZ', 'LANG', 'NODE_EXTRA_CA_CERTS']
                .filter(key => typeof process.env[key] === 'string').map(key => [key, process.env[key]])),
            detached: process.platform !== 'win32',
        });
        this.child = child;
        const parentExit = () => { try { this.kill('SIGKILL'); } catch { /* OS is already exiting */ } };
        process.once('exit', parentExit);
        this.lastHeartbeat = performance.now(); this.lastHeartbeatAt = 0;
        this.exitPromise = new Promise(resolve => {
            let settled = false;
            /** @param {number|null} code @param {NodeJS.Signals|null} signal */
            const ended = (code, signal) => {
                if (settled) return;
                settled = true;
                process.off('exit', parentExit);
                this.child = null; clearInterval(this.timer); this.timer = undefined;
                this.rpc?.close();
                for (const stream of this.streams) stream.destroy(error('EOS_MODULE_PROCESS_DISCONNECTED'));
                this.streams.clear();
                if (!this.stopping) this.fail(signal ? 'EOS_MODULE_PROCESS_SIGNAL' : 'EOS_MODULE_PROCESS_EXIT');
                if (!this.failure) this.state = 'stopped';
                resolve({ code, signal });
            };
            child.once('exit', ended);
            // A failed spawn has no PID and may emit close without exit.
            child.once('close', (code, signal) => { if (!child.pid) ended(code, signal); });
        });
        child.on('error', () => this.fail('EOS_MODULE_PROCESS_SPAWN_FAILED'));
        child.on('disconnect', () => { if (!this.stopping) this.fail('EOS_MODULE_PROCESS_DISCONNECTED'); });
        this.rpc = channel(child, this.options.generation, async (method, args) => {
            if (standby) throw error('EOS_MODULE_PROCESS_INACTIVE');
            if (!ADAPTER_METHODS.includes(method) && method !== 'getHistoryBackupRequirement') throw error('EOS_MODULE_PROCESS_METHOD');
            // A child lease is only a fast local fence. The authoritative owner
            // checks every RPC again, including requests queued before revocation.
            if (!this.options.canOperate() && method !== 'unsubscribeStatesAsync') throw error('EOS_MODULE_PROCESS_INACTIVE');
            if (method === 'getHistoryBackupRequirement') {
                if (this.options.id !== 'backup') throw error('EOS_MODULE_PROCESS_METHOD');
                return this.options.moduleOptions.getHistoryBackupRequirement?.();
            }
            const facade = this.options.moduleOptions.adapter;
            const callable = /** @type {RecordValue} */ (/** @type {unknown} */ (facade))[method];
            if (typeof callable !== 'function') throw error('EOS_MODULE_PROCESS_METHOD');
            const invoke = /** @type {import('./eosModuleProcessTypes').Call} */ (callable);
            if (method === 'sendTo') return new Promise(resolve => invoke(...args, resolve));
            return invoke(...args);
        }, message => {
            if (message.type === 'heartbeat') {
                this.lastHeartbeat = performance.now(); this.lastHeartbeatAt = Date.now();
                if (this.options.id === 'devices' || this.options.id === 'eebus' || this.options.id === 'ocpp') {
                    if (Object.prototype.hasOwnProperty.call(message, 'deviceHealth')) {
                        this.deviceHealth = normalizedDeviceHealth(message.deviceHealth);
                        this.deviceHealthAt = this.lastHeartbeatAt;
                    } else if (message.deviceHealthConfirmed === true && this.deviceHealth) this.deviceHealthAt = this.lastHeartbeatAt;
                }
            }
            else if (message.type === 'failure') this.fail(errorCode({ code: message.code }));
            else if (message.type === 'invalid') this.fail('EOS_MODULE_PROCESS_INVALID_MESSAGE');
            else if (message.type === 'log' && typeof message.level === 'string' && ['warn', 'error', 'info', 'debug'].includes(message.level)) {
                if (Date.now() - this.logWindow > 1000) { this.logWindow = Date.now(); this.logCount = 0; }
                const level = /** @type {'warn'|'error'|'info'|'debug'} */ (message.level);
                if (++this.logCount <= 20) this.options.moduleOptions.adapter.log[level]?.(
                    `[EOS ${this.options.id}] ${sanitizeLog(message.text, this.options.moduleOptions.config)}`);
            }
        });
        const heartbeatMs = this.options.heartbeatMs || 250;
        this.timer = setInterval(() => {
            if (performance.now() - this.lastHeartbeat > (this.options.watchdogMs || 4000)) {
                this.fail('EOS_MODULE_PROCESS_HEARTBEAT_TIMEOUT'); return;
            }
            if (standby) return;
            try { this.authority(!this.stopping && this.options.canOperate()); }
            catch { this.fail('EOS_MODULE_PROCESS_DISCONNECTED'); }
        }, heartbeatMs);
        this.timer.unref?.();
        const moduleOptions = this.options.moduleOptions;
        const adapter = moduleOptions.adapter;
        const init = standby ? {id:this.options.id} : { id: this.options.id, baseDir: this.options.baseDir,
            moduleOptions: { config: moduleOptions.config, dataDir: moduleOptions.dataDir,
                installationDir: moduleOptions.installationDir, eosDataDir: moduleOptions.eosDataDir,
                preservedUiNamespace: moduleOptions.preservedUiNamespace,
                adapter: { namespace: adapter.namespace, hostNamespace: adapter.hostNamespace,
                    eosTargetNamespace: adapter.eosTargetNamespace, instance: adapter.instance, config: adapter.config } },
            allowed: this.options.canOperate(), sequence: ++this.leaseSequence, expiresAt: Date.now() + 1000 };
        validate(init);
        this.rpc.event(standby ? 'standby' : 'init', init);
        const startDeadline = performance.now() + (this.options.startTimeoutMs || 125000);
        const remainingStartMs = () => {
            const remaining = startDeadline - performance.now();
            if (remaining <= 0) throw error('EOS_MODULE_PROCESS_TIMEOUT');
            return remaining;
        };
        try {
            // Do not queue start ahead of lease updates while synchronous imports
            // occupy the child event loop. Construction and start share the same
            // existing deadline, and readiness itself grants no write authority.
            if (await this.rpc.request('prepare', [], remainingStartMs()) !== true) throw error('EOS_MODULE_PROCESS_INIT');
            if (this.stopping) throw error('EOS_MODULE_PROCESS_INACTIVE');
            if (standby) { this.state = 'running'; return; }
            if (!this.options.canOperate()) throw error('EOS_MODULE_PROCESS_INACTIVE');
            this.authority(true);
            await this.rpc.request('start', [], remainingStartMs());
            if (!this.options.canOperate() || this.stopping) throw error('EOS_MODULE_PROCESS_INACTIVE');
            this.state = 'running';
        } catch (issue) { this.fail(errorCode(issue)); throw issue; }
    }
    /** @param {string} method @param {unknown[]} args @returns {Promise<unknown>} */
    async request(method, args) {
        if (!this.rpc || this.options.standby || this.stopping || !this.options.canOperate()) throw error('EOS_MODULE_PROCESS_INACTIVE');
        return this.rpc.request(method, args);
    }
    getStatus() { return this.request('getStatus', []); }
    /** @param {string} name @param {unknown} payload */
    command(name, payload) { return this.request('command', [name, payload]); }
    /** @param {string} id @param {unknown} state */
    onStateChange(id, state) {
        // Match the public module event contracts before IPC: ordinary telemetry
        // is not a control event. EEBUS acknowledged trust revocation is one.
        if (this.options.id === 'devices' && (!isRecord(state) || state.ack !== false)) return Promise.resolve();
        if (this.options.id === 'ocpp' && (!isRecord(state) || state.ack !== false)) return Promise.resolve();
        if (this.options.id === 'eebus' && isRecord(state) && state.ack && !/\.pairing\.(trusted|pinnedFingerprint)$/.test(id)) return Promise.resolve();
        if (this.options.id === 'backup' && (!isRecord(state) || state.ack !== false || state.val !== true ||
            !['oneClick.iobroker', 'oneClick.ccu'].some(local => id === `${this.options.moduleOptions.adapter.namespace}.${local}`))) return Promise.resolve();
        return this.request('onStateChange', [id, state]);
    }
    /** @param {unknown} message */
    onMessage(message) { return this.request('onMessage', [message]); }
    /** @param {string} name @returns {Promise<import('./eosModuleProcessTypes').Download>} */
    async getDownload(name) {
        // Parent selects the token so a timed-out open can be cancelled before
        // its asynchronous file open completes in the worker.
        const handle = randomUUID();
        let result;
        const close = () => this.rpc?.request('download.close', [handle]).catch(() => {});
        try { result = await this.request('download.open', [name, handle]); }
        catch (issue) { void close(); throw issue; }
        if (!isRecord(result) || result.handle !== handle || typeof result.filename !== 'string' ||
            (result.contentType !== undefined && typeof result.contentType !== 'string') ||
            (result.size !== undefined && (typeof result.size !== 'number' || !Number.isSafeInteger(result.size) || result.size < 0))) {
            void close(); throw error('EOS_MODULE_PROCESS_DOWNLOAD');
        }
        const self = this;
        let reading = false;
        const stream = new Readable({ objectMode: false, highWaterMark: 65536,
            read() {
                if (reading) return;
                reading = true;
                void self.request('download.read', [handle]).then(chunk => {
                    reading = false;
                    if (this.destroyed) return;
                    if (!isRecord(chunk)) this.destroy(error('EOS_MODULE_PROCESS_DOWNLOAD'));
                    else if (chunk.done) this.push(null);
                    else if (typeof chunk.data !== 'string' || chunk.data.length > 90000) this.destroy(error('EOS_MODULE_PROCESS_DOWNLOAD'));
                    else this.push(Buffer.from(chunk.data, 'base64'));
                }, issue => { reading = false; this.destroy(issue); });
            },
            destroy(issue, callback) { void Promise.resolve(close()).finally(() => callback(issue)); },
        });
        this.streams.add(stream);
        // The consumer may not have installed its pipeline yet when the child
        // exits. Preserve stream.errored while preventing an unhandled event.
        stream.on('error', () => {});
        stream.once('close', () => this.streams.delete(stream));
        return { stream, filename: result.filename, contentType: result.contentType, size: result.size };
    }
    /** @param {NodeJS.Signals} signal */
    kill(signal) {
        if (!this.child?.pid) return;
        try {
            if (process.platform !== 'win32') process.kill(-this.child.pid, signal);
            else this.child.kill(signal);
        } catch (issue) { if (!isRecord(issue) || issue.code !== 'ESRCH') throw issue; }
    }
    async stop() {
        if (this.stopPromise) return this.stopPromise;
        this.stopping = true; this.state = this.failure ? 'error' : 'stopping';
        this.stopPromise = (async () => {
            clearInterval(this.timer); this.timer = undefined;
            for (const stream of this.streams) stream.destroy();
            this.streams.clear();
            if (!this.child) { this.rpc?.close(); this.state = this.failure ? 'error' : 'stopped'; return; }
            this.revoke();
            void this.rpc?.request('stop', [], 800).catch(() => {});
            /** @type {NodeJS.Timeout|undefined} */ let term;
            /** @type {NodeJS.Timeout|undefined} */ let hard;
            /** @type {NodeJS.Timeout|undefined} */ let deadline;
            try {
                await Promise.race([this.exitPromise, new Promise((_, reject) => {
                    term = setTimeout(() => this.kill('SIGTERM'), 900);
                    hard = setTimeout(() => this.kill('SIGKILL'), 1600);
                    deadline = setTimeout(() => reject(error('EOS_MODULE_PROCESS_STOP_UNCONFIRMED')), 2300);
                })]);
            } finally { clearTimeout(term); clearTimeout(hard); clearTimeout(deadline); this.rpc?.close(); }
            this.state = this.failure ? 'error' : 'stopped';
        })();
        return this.stopPromise;
    }
}

module.exports = { EosModuleProcess };
