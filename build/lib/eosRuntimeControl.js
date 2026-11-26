/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
// @ts-check
const { randomUUID } = require('node:crypto');
const { EosModuleConfigStore } = require('./eosModuleConfigStore');
/** @typedef {'ui'|'devices'|'eebus'|'backup'|'ocpp'} ProcessId */
/** @typedef {'enable'|'disable'|'restart'} Action */
/** @typedef {Record<ProcessId, boolean>} Activation */
/** @typedef {{enabled:boolean,canEnable:boolean,canDisable:boolean,canRestart:boolean,busy:boolean,reason:string,revision:string}} ControlView */
/** @typedef {{namespace:string,config:Record<string,unknown>,encrypt:(text:string)=>string,decrypt:(text:string)=>string,getForeignObjectAsync:(id:string)=>Promise<unknown>,setForeignObjectAsync:(id:string,value:unknown)=>Promise<unknown>,eosMigration?:{allowsStartup:()=>boolean,status?:()=>unknown},eosOwnership?:{canWrite:()=>boolean},eosLicenseService?:{statusView:()=>unknown,allowsEmbeddedModule?:(id:string)=>boolean},log:{warn:(code:string)=>void}}} Owner */
/** @typedef {{mutation?:boolean,configurationSavePromise?:Promise<unknown>|null,view:(id:string)=>Promise<unknown>,enableProcessModule:(id:string)=>Promise<void>,controlProcess:(id:string,action:'stop'|'start')=>Promise<void>}} Host */
/** @typedef {{pause:()=>Promise<void>,resume:()=>Promise<void>,status:()=>Record<string,unknown>}} Runtime */
const IDS = /** @type {const} */ (['ui', 'devices', 'eebus', 'backup', 'ocpp']);
/** @param {unknown} value @returns {Record<string,unknown>} */
function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) ? /** @type {Record<string,unknown>} */ (value) : {}; }
/** @param {string} code */
const fail = code => Object.assign(new Error(code), { code });
/** @param {unknown} error */
function code(error) { const value = record(error).code; return typeof value === 'string' && /^(?:EOS|EEBUS)_[A-Z0-9_]{1,72}$/.test(value) ? value : 'EOS_RUNTIME_CONTROL_FAILED'; }
/** @returns {Activation} */
const defaults = () => ({ ui: true, devices: true, eebus: true, backup: true, ocpp: true });
/** @template T @param {Promise<T>} operation @param {number} timeout @returns {Promise<T>} */
async function readWithin(operation, timeout) {
    /** @type {ReturnType<typeof setTimeout>|undefined} */ let timer;
    try {
        return await Promise.race([operation, new Promise((_, reject) => {
                timer = setTimeout(() => reject(fail('EOS_RUNTIME_CONFIG_TIMEOUT')), timeout);
            })]);
    }
    finally {
        clearTimeout(timer);
    }
}
/** A persisted process pause is independent of device settings and migration targets.
 * Only one accepted transaction can exist; an HTTP disconnect never releases its lock.
 */
class EosRuntimeControl {
    /** @param {{owner:Owner,host:Host,runtime:Runtime,readTimeoutMs?:number}} options */
    constructor({ owner, host, runtime, readTimeoutMs = 5000 }) {
        this.owner = owner;
        this.host = host;
        this.runtime = runtime;
        this.store = new EosModuleConfigStore(owner, { moduleIds: ['runtime'] });
        this.enabled = defaults();
        /** @type {string} */ this.revision = randomUUID();
        this.ready = false;
        this.closed = false;
        this.error = '';
        this.readTimeoutMs = Math.max(1, Math.min(5000, readTimeoutMs));
        /** @type {Promise<void>|null} */ this.loading = null;
        /** @type {Promise<void>|null} */ this.pending = null;
        /** @type {ProcessId|null} */ this.target = null;
        /** @type {Set<ProcessId>} */ this.inhibited = new Set();
        /** @type {Set<ProcessId>} */ this.stopFailures = new Set();
        /** @type {Partial<Record<ProcessId,string>>} */ this.errors = {};
    }
    /** Read once before either hosted runtime is allowed to start. @returns {Promise<void>} */
    initialize() {
        if (this.loading)
            return this.loading;
        this.loading = (async () => {
            try {
                const envelope = await readWithin(this.store.load('runtime'), this.readTimeoutMs);
                if (this.closed)
                    return;
                if (envelope) {
                    const data = record(JSON.parse(this.owner.decrypt(envelope.encrypted)));
                    const enabled = record(data.enabled);
                    if (data.v !== 1 || Object.keys(data).some(key => !['v', 'enabled'].includes(key)) ||
                        Object.keys(enabled).length !== IDS.length || IDS.some(id => typeof enabled[id] !== 'boolean')) {
                        throw fail('EOS_RUNTIME_CONFIG_INVALID');
                    }
                    for (const id of IDS)
                        this.enabled[id] = enabled[id] === true;
                }
                this.revision = this.store.revisions.get('runtime') || this.revision;
                this.ready = true;
            }
            catch (error) {
                this.error = code(error);
                this.owner.log.warn(`EOS_RUNTIME_CONFIGURATION_UNAVAILABLE: ${this.error}`);
            }
        })();
        return this.loading;
    }
    /** @param {string} id */
    isEnabled(id) {
        return this.ready && !this.closed && IDS.some(value => value === id) &&
            this.enabled[ /** @type {ProcessId} */(id)] && !this.inhibited.has(/** @type {ProcessId} */ (id));
    }
    /** @param {ProcessId} id @param {boolean} configured */
    startReason(id, configured) {
        if (!this.ready || this.closed)
            return this.error || 'EOS_RUNTIME_NOT_READY';
        if (this.stopFailures.has(id))
            return this.errors[id] || 'EOS_RUNTIME_STOP_UNCONFIRMED';
        if (this.owner.eosMigration?.allowsStartup() === false)
            return 'EOS_RUNTIME_MIGRATION_BLOCKED';
        const license = record(this.owner.eosLicenseService?.statusView());
        if (license.valid !== true || license.coreEnabled !== true ||
            (id !== 'ui' && this.owner.eosLicenseService?.allowsEmbeddedModule?.(id) !== true))
            return 'EOS_RUNTIME_LICENSE_REQUIRED';
        if (this.owner.eosOwnership?.canWrite() !== true)
            return 'EOS_RUNTIME_OWNERSHIP_REQUIRED';
        if (!configured)
            return 'EOS_RUNTIME_MODULE_DISABLED';
        return '';
    }
    /** This projection is the complete public control contract. @param {string} id @param {boolean} configured @returns {ControlView|undefined} */
    view(id, configured = true) {
        if (!IDS.some(value => value === id))
            return undefined;
        const key = /** @type {ProcessId} */ (id);
        const ready = this.ready && !this.closed;
        const busy = this.pending !== null;
        const enabled = this.enabled[key];
        // Enabling a module is one operation, even when its process permission
        // was already on. A saved module-off flag is not an admission failure.
        const blocker = this.startReason(key, true);
        return { enabled, revision: this.revision, busy,
            canEnable: ready && !busy && (!enabled || !configured) && !blocker,
            canDisable: ready && !busy && enabled,
            canRestart: ready && !busy && enabled && configured && !blocker,
            reason: this.errors[key] || blocker || (!enabled ? 'EOS_RUNTIME_DISABLED' : !configured ? 'EOS_RUNTIME_MODULE_DISABLED' : '') };
    }
    /** Exact actions only; no arbitrary process IDs, commands or configuration are accepted.
     * @param {unknown} id @param {unknown} action @param {unknown} revision
     */
    request(id, action, revision) {
        if (typeof id !== 'string' || !IDS.some(value => value === id))
            throw fail('EOS_RUNTIME_PROCESS_INVALID');
        if (!['enable', 'disable', 'restart'].includes(String(action)) || typeof action !== 'string')
            throw fail('EOS_RUNTIME_ACTION_INVALID');
        if (!this.ready || this.closed)
            throw fail(this.error || 'EOS_RUNTIME_NOT_READY');
        if (this.pending || this.host.mutation || this.host.configurationSavePromise)
            throw fail('EOS_RUNTIME_BUSY');
        if (typeof revision !== 'string' || revision !== this.revision)
            throw fail('EOS_RUNTIME_CONFIG_CONFLICT');
        const key = /** @type {ProcessId} */ (id);
        const operation = /** @type {Action} */ (action);
        if (operation !== 'disable') {
            const reason = this.startReason(key, true);
            if (reason)
                throw fail(reason);
        }
        if (operation === 'restart' && !this.enabled[key])
            throw fail('EOS_RUNTIME_DISABLED');
        this.target = key;
        delete this.errors[key];
        const pending = this.apply(key, operation).catch(error => {
            this.errors[key] = code(error);
            this.owner.log.warn(`EOS_RUNTIME_CONTROL_FAILED: ${key}; ${this.errors[key]}`);
        }).finally(() => { if (this.pending === pending) {
            this.pending = null;
            this.target = null;
        } });
        this.pending = pending;
        return { ok: true, accepted: true };
    }
    assertOpen() { if (this.closed)
        throw fail('EOS_RUNTIME_STOPPED'); }
    /** The durable pause is committed before shutdown. Only a confirmed stop may persist a new enable.
     * @param {ProcessId} id @param {boolean} enabled
     */
    async persist(id, enabled) {
        this.assertOpen();
        const next = { ...this.enabled, [id]: enabled };
        const plaintext = JSON.stringify({ v: 1, enabled: next });
        const encrypted = this.owner.encrypt(plaintext);
        if (!encrypted || encrypted === plaintext)
            throw fail('EOS_RUNTIME_ENCRYPTION');
        await this.store.save('runtime', { v: 1, encrypted }, () => !this.closed);
        this.assertOpen();
        this.enabled = next;
        this.revision = this.store.revisions.get('runtime') || this.revision;
    }
    /** @param {ProcessId} id @param {Action} action */
    async apply(id, action) {
        // Yield once so the transaction owns its lock before any synchronous completion.
        await Promise.resolve();
        this.assertOpen();
        let configure = false;
        if (action !== 'disable' && id !== 'ui') {
            const view = record(await this.host.view(id));
            this.assertOpen();
            configure = record(view.config).enabled !== true;
            const reason = this.startReason(id, action === 'enable' || !configure);
            if (reason)
                throw fail(reason);
        }
        await this.persist(id, false);
        this.inhibited.add(id);
        try {
            if (id === 'ui')
                await this.runtime.pause();
            else
                await this.host.controlProcess(id, 'stop');
        }
        catch (error) {
            // Stop implementations retain their failed drain fence for this owner
            // lifecycle. Do not offer an activation that they cannot safely admit.
            this.stopFailures.add(id);
            throw error;
        }
        this.assertOpen();
        if (action === 'disable') {
            this.inhibited.delete(id);
            return;
        }
        if (configure) {
            // The host commits only enabled:true against its complete current
            // configuration. Keep the durable process pause until that actual
            // commit (including a slow database write) has settled.
            await this.host.enableProcessModule(id);
            this.assertOpen();
        }
        const reason = this.startReason(id, true);
        if (reason)
            throw fail(reason);
        await this.persist(id, true);
        this.inhibited.delete(id);
        if (id === 'ui')
            await this.runtime.resume();
        else
            await this.host.controlProcess(id, 'start');
        this.assertOpen();
    }
    /** Await the accepted transaction, including an already-issued storage write. @returns {Promise<void>} */
    async whenIdle() { await this.pending; }
    /** Revoke immediately, then drain an accepted mutation before owner shutdown. @returns {Promise<void>} */
    close() { this.closed = true; return this.whenIdle(); }
}
module.exports = { EosRuntimeControl };
//# sourceMappingURL=eosRuntimeControl.js.map