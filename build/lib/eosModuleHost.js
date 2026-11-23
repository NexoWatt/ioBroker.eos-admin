/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const { join } = require('node:path');
const { performance } = require('node:perf_hooks');
const SECRET_MARKER = '__EOS_SECRET_UNCHANGED__';
const MODULES = Object.freeze({ devices: 'nexowatt-devices', eebus: 'eebus' });
const SECRET_KEY = /password|passwd|secret|token|privatekey|pairingpin|apikey|credential|authorization|cookie/i;
const MAX_CONFIG_BYTES = 512 * 1024;
const MAX_LEGACY_INSTANCES = 64;
const LEASE_MS = 12000;
const isRecord = value => !!value && typeof value === 'object' && !Array.isArray(value);
const fail = code => Object.assign(new Error(code), { code });
function bounded(promise, milliseconds = 5000) {
    let timer;
    return Promise.race([
        Promise.resolve(promise),
        new Promise((_, reject) => { timer = setTimeout(() => reject(fail('EOS_MODULE_TIMEOUT')), milliseconds); }),
    ]).finally(() => clearTimeout(timer));
}
function assertJson(value) {
    const text = JSON.stringify(value);
    if (!text || Buffer.byteLength(text) > MAX_CONFIG_BYTES)
        throw fail('EOS_MODULE_CONFIG_SIZE');
    const copy = JSON.parse(text);
    const walk = (node, depth = 0) => {
        if (depth > 16)
            throw fail('EOS_MODULE_CONFIG_DEPTH');
        if (node && typeof node === 'object') {
            for (const key of Object.keys(node)) {
                if (['__proto__', 'prototype', 'constructor'].includes(key))
                    throw fail('EOS_MODULE_CONFIG_KEY');
                walk(node[key], depth + 1);
            }
        }
    };
    walk(copy);
    return copy;
}
function isSecret(key, value) {
    if (SECRET_KEY.test(key))
        return true;
    if (typeof value === 'string' && /url|uri|endpoint/i.test(key)) {
        try {
            const url = new URL(value);
            return !!url.username || !!url.password || [...url.searchParams.keys()].some(name => SECRET_KEY.test(name) || name === 'key');
        }
        catch {
            return false;
        }
    }
    return false;
}
function redact(value, key = '') {
    if (isSecret(key, value) && value !== '' && value != null)
        return SECRET_MARKER;
    if (Array.isArray(value))
        return value.map(item => redact(item));
    if (isRecord(value))
        return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redact(item, name)]));
    return value;
}
/** Secret placeholders follow device identity, never an array index. */
function restoreSecrets(value, previous, key = '') {
    if (value === SECRET_MARKER) {
        if (!isSecret(key, previous) || previous == null || previous === SECRET_MARKER)
            throw fail('EOS_MODULE_SECRET_MISSING');
        return previous;
    }
    if (Array.isArray(value)) {
        return value.map(item => {
            const id = isRecord(item) && typeof item.id === 'string' ? item.id : null;
            const matches = id && Array.isArray(previous) ? previous.filter(old => isRecord(old) && old.id === id) : [];
            return restoreSecrets(item, matches.length === 1 ? matches[0] : undefined);
        });
    }
    if (isRecord(value)) {
        return Object.fromEntries(Object.entries(value).map(([name, item]) => [name,
            restoreSecrets(item, isRecord(previous) ? previous[name] : undefined, name)]));
    }
    return value;
}
class EosModuleHost {
    constructor(owner, options) {
        this.owner = owner;
        this.options = options;
        this.running = false;
        this.entries = new Map();
        this.pending = null;
        this.mutation = false;
        this.timer = null;
        this.nextOwnershipCheck = 0;
        this.bridgeHandler = null;
        this.bridgeReply = null;
        this.stopped = false;
        this.stopPromise = null;
        for (const id of Object.keys(MODULES)) {
            this.entries.set(id, { id, module: null, config: { enabled: false }, reason: 'DISABLED', lease: 0,
                generation: 0, blockers: [], loading: false, failed: false, timers: new Set(), subscriptions: new Set() });
        }
    }
    factory(id) {
        if (!Object.hasOwn(MODULES, id))
            throw fail('EOS_MODULE_UNKNOWN');
        return this.options.factories?.[id] || require(join(this.options.baseDir, 'modules', id, 'index.js'));
    }
    readConfig(id) {
        const envelope = this.owner.config.eosModules?.[id];
        if (envelope == null)
            return this.factory(id).validateConfig({ enabled: false });
        if (!isRecord(envelope) || envelope.v !== 1 || typeof envelope.encrypted !== 'string') {
            throw fail('EOS_MODULE_CONFIG_FORMAT');
        }
        const config = assertJson(JSON.parse(this.owner.decrypt(envelope.encrypted)));
        return this.factory(id).validateConfig(config);
    }
    licensed(id) {
        try {
            const service = this.owner.eosLicenseService;
            return service?.allowsEmbeddedModule?.(id) === true;
        }
        catch {
            return false;
        }
    }
    canOperate(id, generation) {
        const entry = this.entries.get(id);
        return this.running && !this.stopped && !!entry && entry.config.enabled === true && !entry.failed &&
            entry.generation === generation && entry.lease > performance.now() && this.licensed(id) &&
            this.owner.eosOwnership?.canWrite() === true;
    }
    async inspectOwnership(entry) {
        const name = MODULES[entry.id];
        const result = await bounded(this.owner.getObjectViewAsync('system', 'instance', {
            startkey: `system.adapter.${name}.`, endkey: `system.adapter.${name}.\u9999`,
        }));
        if (!Array.isArray(result?.rows) || result.rows.length > MAX_LEGACY_INSTANCES)
            throw fail('OWNERSHIP_UNAVAILABLE');
        const blockers = [];
        const seen = new Set();
        for (const row of result.rows) {
            const obj = row.value;
            const instance = obj?._id?.slice('system.adapter.'.length);
            if (!obj || obj.type !== 'instance' || !new RegExp(`^${name}\\.\\d+$`).test(instance || '') || seen.has(instance)) {
                throw fail('OWNERSHIP_UNAVAILABLE');
            }
            seen.add(instance);
            if (obj.common?.enabled !== false || typeof obj.common?.host !== 'string') {
                blockers.push({ instance, reason: 'LEGACY_ENABLED_OR_UNKNOWN' });
                continue;
            }
            const [alive, hostAlive] = await bounded(Promise.all([
                this.owner.getForeignStateAsync(`system.adapter.${instance}.alive`),
                this.owner.getForeignStateAsync(`system.host.${obj.common.host}.alive`),
            ]));
            const age = Date.now() - hostAlive?.ts;
            const stopped = alive?.val === false && alive.ack === true && Number.isSafeInteger(obj.ts) && alive.ts >= obj.ts;
            const hostFresh = hostAlive?.val === true && hostAlive.ack === true && Number.isFinite(age) && age >= -5000 && age <= 60000;
            if (!stopped || !hostFresh)
                blockers.push({ instance, reason: 'LEGACY_STOP_NOT_CONFIRMED' });
        }
        entry.blockers = blockers;
        return blockers.length === 0;
    }
    revoke(entry, reason) {
        entry.lease = 0;
        entry.reason = reason;
    }
    async stopEntry(entry) {
        const module = entry.module;
        entry.module = null;
        entry.generation++;
        for (const timer of entry.timers) {
            clearTimeout(timer);
            clearInterval(timer);
        }
        entry.timers.clear();
        if (module) {
            try {
                await bounded(module.stop(), 1500);
            }
            catch {
                entry.failed = true;
                entry.stopFailed = true;
                entry.reason = 'STOP_FAILED_RESTART_REQUIRED';
            }
        }
        await Promise.allSettled([...entry.subscriptions].map(pattern => bounded(Promise.resolve().then(() => this.owner.unsubscribeForeignStatesAsync(pattern)), 1000)));
        entry.subscriptions.clear();
    }
    facade(entry, generation) {
        const owner = this.owner;
        const namespace = entry.id === 'eebus' ? `${owner.namespace}.eebus` : owner.namespace;
        const resolve = id => {
            if (typeof id !== 'string' || id.length > 512)
                throw fail('EOS_MODULE_STATE_ID');
            const local = id.startsWith(`${namespace}.`) ? id.slice(namespace.length + 1) : id;
            const valid = entry.id === 'devices'
                ? /^(?:devices(?:\.|$)|modules\.devices(?:\.|$))/.test(local)
                : /^(?:devices|info|identity|bridge|discovery|pairing|cls)(?:\.|$)/.test(local);
            if (!valid || [...local].some(character => character.charCodeAt(0) < 32))
                throw fail('EOS_MODULE_STATE_SCOPE');
            return `${namespace}.${local}`;
        };
        const timer = (repeat, callback, ms, ...args) => {
            if (entry.timers.size >= 256 || typeof callback !== 'function' || !Number.isFinite(ms) || ms < (repeat ? 1 : 0)) {
                throw fail('EOS_MODULE_TIMER');
            }
            let pending = false;
            const invoke = () => {
                if (!repeat)
                    entry.timers.delete(handle);
                if (entry.generation !== generation || pending || this.stopped)
                    return;
                pending = true;
                Promise.resolve().then(() => callback(...args)).catch(() => {
                    this.revoke(entry, 'MODULE_CALLBACK_FAILED');
                    entry.failed = true;
                    owner.log.warn(`EOS_MODULE_CALLBACK_FAILED: ${entry.id}`);
                }).finally(() => { pending = false; });
            };
            const handle = repeat ? setInterval(invoke, ms) : setTimeout(invoke, ms);
            handle.unref?.();
            entry.timers.add(handle);
            return handle;
        };
        return {
            namespace, instance: owner.instance, config: entry.config, log: owner.log,
            getObjectAsync: id => owner.getForeignObjectAsync(resolve(id)),
            getStateAsync: id => owner.getForeignStateAsync(resolve(id)),
            setObjectNotExistsAsync: (id, object) => entry.generation === generation
                ? owner.setForeignObjectNotExistsAsync(resolve(id), object) : Promise.reject(fail('EOS_MODULE_STOPPED')),
            extendObjectAsync: (id, object) => entry.generation === generation
                ? owner.extendForeignObjectAsync(resolve(id), object) : Promise.reject(fail('EOS_MODULE_STOPPED')),
            setStateAsync: (id, value, ack) => {
                if (entry.generation !== generation) {
                    // Cleanup telemetry is discarded rather than overwriting a newer runtime.
                    // Resolving discarded ack writes lets shutdown continue closing transports.
                    if (isRecord(value) ? value.ack === true : ack === true)
                        return Promise.resolve();
                    return Promise.reject(fail('EOS_MODULE_STOPPED'));
                }
                return owner.setForeignStateAsync(resolve(id), value, ack);
            },
            subscribeStatesAsync: async (pattern) => {
                const full = resolve(pattern);
                if (entry.generation !== generation || entry.subscriptions.size >= 32)
                    throw fail('EOS_MODULE_SUBSCRIPTION');
                await owner.subscribeForeignStatesAsync(full);
                entry.subscriptions.add(full);
            },
            unsubscribeStatesAsync: async (pattern) => {
                const full = resolve(pattern);
                await owner.unsubscribeForeignStatesAsync(full);
                entry.subscriptions.delete(full);
            },
            setTimeout: (callback, ms, ...args) => timer(false, callback, ms, ...args),
            setInterval: (callback, ms, ...args) => timer(true, callback, ms, ...args),
            clearTimeout: handle => { clearTimeout(handle); entry.timers.delete(handle); },
            clearInterval: handle => { clearInterval(handle); entry.timers.delete(handle); },
            sendTo: (target, command, message, callback) => {
                if (entry.id !== 'eebus' || target !== owner.namespace ||
                    !['nexowatt.para14a.hello.v1', 'nexowatt.para14a.command.v1'].includes(command) ||
                    !this.canOperate(entry.id, generation) || !this.bridgeHandler) {
                    if (typeof callback === 'function')
                        queueMicrotask(() => callback({ accepted: false, error: 'EOS_MODULE_BRIDGE_UNAVAILABLE' }));
                    return;
                }
                void bounded(this.bridgeHandler({ from: namespace, command, message: assertJson(message) }), 3000).then(result => { if (typeof callback === 'function')
                    callback(result); }, () => { if (typeof callback === 'function')
                    callback({ accepted: false, error: 'EOS_MODULE_BRIDGE_UNAVAILABLE' }); }).catch(() => owner.log.warn('EOS_MODULE_BRIDGE_CALLBACK_FAILED'));
            },
        };
    }
    async reconcile() {
        if (!this.running || this.stopped)
            return;
        if (this.pending)
            return this.pending;
        this.pending = (async () => {
            const checkOwnership = performance.now() >= this.nextOwnershipCheck;
            if (checkOwnership)
                this.nextOwnershipCheck = performance.now() + 4000;
            for (const entry of this.entries.values()) {
                if (!this.running || this.stopped)
                    break;
                if (!entry.config.enabled)
                    this.revoke(entry, 'DISABLED');
                else if (!this.licensed(entry.id))
                    this.revoke(entry, 'LICENSE_REQUIRED');
                else if (this.owner.eosOwnership?.canWrite() !== true)
                    this.revoke(entry, 'EOS_OWNERSHIP_REQUIRED');
                else if (checkOwnership && !entry.failed) {
                    const generation = entry.generation;
                    try {
                        const allowed = await bounded(this.inspectOwnership(entry));
                        if (this.running && !this.stopped && generation === entry.generation) {
                            if (allowed) {
                                entry.lease = performance.now() + LEASE_MS;
                                entry.reason = 'READY';
                            }
                            else
                                this.revoke(entry, 'LEGACY_CONFLICT');
                        }
                    }
                    catch {
                        this.revoke(entry, 'OWNERSHIP_UNAVAILABLE');
                    }
                }
                if (entry.module && entry.moduleGeneration !== entry.generation)
                    await this.stopEntry(entry);
                if (!this.canOperate(entry.id, entry.generation)) {
                    if (entry.module)
                        await this.stopEntry(entry);
                    continue;
                }
                if (entry.module || entry.failed)
                    continue;
                const generation = entry.generation;
                try {
                    const factory = this.factory(entry.id);
                    const module = factory.createHostedModule({
                        adapter: this.facade(entry, generation), config: entry.config,
                        canOperate: () => this.canOperate(entry.id, generation),
                        dataDir: join(this.options.dataDir, entry.id),
                    });
                    entry.module = module;
                    entry.moduleGeneration = generation;
                    await bounded(module.start(), 10000);
                    if (!this.canOperate(entry.id, generation))
                        await this.stopEntry(entry);
                    else
                        entry.reason = 'RUNNING';
                }
                catch {
                    this.revoke(entry, 'START_FAILED_RESTART_REQUIRED');
                    entry.failed = true;
                    await this.stopEntry(entry);
                    this.owner.log.warn(`EOS_MODULE_START_FAILED: ${entry.id}; HTTPS remains available`);
                }
            }
        })().catch(() => this.owner.log.warn('EOS_MODULE_RECONCILE_FAILED')).finally(() => { this.pending = null; });
        return this.pending;
    }
    async start() {
        if (this.running || this.stopped)
            return;
        this.running = true;
        for (const entry of this.entries.values()) {
            if (this.stopped)
                return;
            try {
                entry.config = this.readConfig(entry.id);
            }
            catch {
                entry.failed = true;
                entry.reason = 'CONFIG_INVALID';
            }
            const name = MODULES[entry.id];
            await bounded(this.owner.subscribeForeignObjectsAsync(`system.adapter.${name}.*`));
            if (this.stopped)
                return;
            await bounded(this.owner.subscribeForeignStatesAsync(`system.adapter.${name}.*.alive`));
        }
        if (this.stopped)
            return;
        this.timer = setInterval(() => { void this.reconcile(); }, 1000);
        this.timer.unref?.();
        await this.reconcile();
    }
    onObjectChange(id) {
        for (const entry of this.entries.values()) {
            if (id.startsWith(`system.adapter.${MODULES[entry.id]}.`)) {
                this.revoke(entry, 'OWNERSHIP_CHANGED');
                entry.generation++;
                this.nextOwnershipCheck = 0;
            }
        }
        void this.reconcile();
    }
    onStateChange(id, state) {
        for (const entry of this.entries.values()) {
            if (id.startsWith(`system.adapter.${MODULES[entry.id]}.`) ||
                (/^system\.host\..*\.alive$/.test(id) && state?.val !== true)) {
                this.revoke(entry, 'OWNERSHIP_CHANGED');
                entry.generation++;
                this.nextOwnershipCheck = 0;
            }
            const prefix = entry.id === 'devices' ? `${this.owner.namespace}.devices.` : `${this.owner.namespace}.eebus.`;
            if (entry.module && id.startsWith(prefix)) {
                try {
                    Promise.resolve(entry.module.onStateChange?.(id, state)).catch(() => this.owner.log.warn(`EOS_MODULE_EVENT_FAILED: ${entry.id}`));
                }
                catch {
                    this.owner.log.warn(`EOS_MODULE_EVENT_FAILED: ${entry.id}`);
                }
            }
        }
    }
    async status(id) {
        const entry = this.entries.get(id);
        if (!entry)
            throw fail('EOS_MODULE_UNKNOWN');
        let details = {};
        try {
            details = entry.module ? await bounded(entry.module.getStatus?.() || {}, 2000) : {};
        }
        catch {
            details = { statusUnavailable: true };
        }
        return { id, enabled: entry.config.enabled === true, active: !!entry.module && entry.moduleGeneration === entry.generation && this.canOperate(id, entry.generation),
            reason: entry.reason, blockers: entry.blockers, details: redact(assertJson(details)),
            namespace: id === 'devices' ? `${this.owner.namespace}.devices` : `${this.owner.namespace}.eebus` };
    }
    async view(id) {
        const entry = this.entries.get(id);
        if (!entry)
            throw fail('EOS_MODULE_UNKNOWN');
        return { id, config: redact(entry.config), status: await this.status(id),
            migration: this.owner.config.eosModules?.[id]?.migration || null };
    }
    async save(id, config, migration) {
        if (this.mutation || this.stopped)
            throw fail('EOS_MODULE_BUSY');
        this.mutation = true;
        try {
            const entry = this.entries.get(id);
            if (!entry)
                throw fail('EOS_MODULE_UNKNOWN');
            const normalized = this.factory(id).validateConfig(restoreSecrets(assertJson(config), entry.config));
            const encrypted = this.owner.encrypt(JSON.stringify(normalized));
            if (typeof encrypted !== 'string' || encrypted === JSON.stringify(normalized))
                throw fail('EOS_MODULE_ENCRYPTION');
            const own = await bounded(this.owner.getForeignObjectAsync(`system.adapter.${this.owner.namespace}`));
            if (!own?.native)
                throw fail('EOS_MODULE_CONFIG_UNAVAILABLE');
            const eosModules = { ...(own.native.eosModules || {}), [id]: { v: 1, encrypted,
                    migration: migration || own.native.eosModules?.[id]?.migration || null } };
            this.revoke(entry, 'CONFIG_CHANGED');
            await this.stopEntry(entry);
            await bounded(this.owner.extendForeignObjectAsync(`system.adapter.${this.owner.namespace}`, { native: { eosModules } }));
            this.owner.config.eosModules = eosModules;
            entry.config = normalized;
            if (!entry.stopFailed) {
                entry.failed = false;
                entry.reason = normalized.enabled ? 'STARTING' : 'DISABLED';
            }
            else {
                entry.failed = true;
                entry.reason = 'STOP_FAILED_RESTART_REQUIRED';
            }
            this.nextOwnershipCheck = 0;
            void this.reconcile();
            return this.view(id);
        }
        finally {
            this.mutation = false;
        }
    }
    async importLegacy(id, instance) {
        if (!Object.hasOwn(MODULES, id) || typeof instance !== 'string' ||
            !new RegExp(`^${MODULES[id]}\\.\\d+$`).test(instance))
            throw fail('EOS_MODULE_IMPORT_INSTANCE');
        const entry = this.entries.get(id);
        if (entry.config.enabled || entry.module)
            throw fail('EOS_MODULE_IMPORT_REQUIRES_DISABLED');
        if (!(await bounded(this.inspectOwnership(entry))))
            throw fail('EOS_MODULE_LEGACY_RUNNING');
        const object = await bounded(this.owner.getForeignObjectAsync(`system.adapter.${instance}`));
        if (!object?.native || object.common?.enabled !== false)
            throw fail('EOS_MODULE_IMPORT_UNAVAILABLE');
        let config = assertJson(object.native);
        // Existing private keys are never copied out of legacy native storage.
        delete config.privateKey;
        delete config.certificate;
        delete config.cert;
        if (id === 'eebus') {
            // Legacy EEBus encryptedNative values are ciphertext in the object DB.
            // Pairing identity/PIN require deliberate fresh pairing after import.
            delete config.pairingPin;
            delete config.shipPairingPin;
        }
        const migration = this.factory(id).migrateLegacyConfig?.(config);
        if (migration)
            config = migration.config;
        config.enabled = false;
        const report = { source: instance, importedAt: new Date().toISOString(),
            oldPrefix: `${instance}.`, newPrefix: id === 'devices' ? `${this.owner.namespace}.` : `${this.owner.namespace}.eebus.`,
            statesCopied: false, mappingsRewritten: false, identityImported: false,
            omittedFields: migration?.omittedFields || [], requiresPairing: id === 'eebus' };
        const result = await this.save(id, config, report);
        return { ...result, migration: report };
    }
    async command(id, command, payload) {
        const entry = this.entries.get(id);
        if (!entry || typeof command !== 'string')
            throw fail('EOS_MODULE_COMMAND');
        const now = performance.now();
        if (!entry.commandWindow || now - entry.commandWindow > 10000) {
            entry.commandWindow = now;
            entry.commands = 0;
        }
        if (++entry.commands > 30)
            throw fail('EOS_MODULE_RATE_LIMIT');
        const safePayload = assertJson(payload ?? {});
        if (id === 'devices') {
            const factory = this.factory(id);
            if (typeof factory.command === 'function')
                return bounded(factory.command(command, safePayload));
            if (typeof factory.getCatalog === 'function' && command === 'getCatalog')
                return factory.getCatalog();
        }
        if (!entry.module || !this.canOperate(id, entry.generation))
            throw fail('EOS_MODULE_INACTIVE');
        return bounded(entry.module.command(command, safePayload));
    }
    bindBridge(handler) { this.bridgeHandler = handler; }
    receiveBridge(message) {
        const entry = this.entries.get('eebus');
        if (!entry.module || !this.canOperate('eebus', entry.generation) || message?.command !== 'nexowatt.para14a.implementation.v1')
            return false;
        try {
            Promise.resolve(entry.module.onMessage?.({ ...message, from: this.owner.namespace })).catch(() => this.owner.log.warn('EOS_MODULE_BRIDGE_EVENT_FAILED'));
        }
        catch {
            this.owner.log.warn('EOS_MODULE_BRIDGE_EVENT_FAILED');
        }
        return true;
    }
    async stop() {
        if (this.stopPromise)
            return this.stopPromise;
        this.stopped = true;
        this.running = false;
        this.bridgeHandler = null;
        clearInterval(this.timer);
        this.timer = null;
        for (const entry of this.entries.values())
            this.revoke(entry, 'STOPPED');
        this.stopPromise = Promise.allSettled([...this.entries.values()].map(entry => this.stopEntry(entry)));
        await this.stopPromise;
    }
}
module.exports = { EosModuleHost, bounded, redact, restoreSecrets, assertJson, SECRET_MARKER };
//# sourceMappingURL=eosModuleHost.js.map