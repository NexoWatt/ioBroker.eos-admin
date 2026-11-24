/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';

const { join } = require('node:path');
const { performance } = require('node:perf_hooks');
const { EosModuleConfigStore } = require('./eosModuleConfigStore');
const { EosDeviceEmsService } = require('./eosDeviceEmsService');

const SECRET_MARKER = '__EOS_SECRET_UNCHANGED__';
const MODULES = Object.freeze({ devices: 'nexowatt-devices', eebus: 'eebus', backup: 'nexowatt-backup' });
const SECRET_KEY = /password|passwd|^pass$|accessjson|expertmount|secret|token|privatekey|pairingpin|apikey|credential|authorization|cookie/i;
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
    if (!text || Buffer.byteLength(text) > MAX_CONFIG_BYTES) throw fail('EOS_MODULE_CONFIG_SIZE');
    const copy = JSON.parse(text);
    const walk = (node, depth = 0) => {
        if (depth > 16) throw fail('EOS_MODULE_CONFIG_DEPTH');
        if (node && typeof node === 'object') {
            for (const key of Object.keys(node)) {
                if (['__proto__', 'prototype', 'constructor'].includes(key)) throw fail('EOS_MODULE_CONFIG_KEY');
                walk(node[key], depth + 1);
            }
        }
    };
    walk(copy);
    return copy;
}

function isSecret(key, value) {
    if (SECRET_KEY.test(key)) return true;
    if (typeof value === 'string' && /url|uri|endpoint/i.test(key)) {
        try {
            const url = new URL(value);
            return !!url.username || !!url.password || [...url.searchParams.keys()].some(name => SECRET_KEY.test(name) || name === 'key');
        } catch { return false; }
    }
    return false;
}

function redact(value, key = '') {
    if (isSecret(key, value) && value !== '' && value != null) return SECRET_MARKER;
    if (Array.isArray(value)) return value.map(item => redact(item));
    if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redact(item, name)]));
    return value;
}

/** Secret placeholders follow device identity, never an array index. */
function restoreSecrets(value, previous, key = '') {
    if (value === SECRET_MARKER) {
        if (!isSecret(key, previous) || previous == null || previous === SECRET_MARKER) throw fail('EOS_MODULE_SECRET_MISSING');
        return previous;
    }
    if (Array.isArray(value)) {
        return value.map(item => {
            const identity = secretRowIdentity(item);
            const matches = identity && Array.isArray(previous) ? previous.filter(old => secretRowIdentity(old) === identity) : [];
            return restoreSecrets(item, matches.length === 1 ? matches[0] : undefined);
        });
    }
    if (isRecord(value)) {
        return Object.fromEntries(Object.entries(value).map(([name, item]) => [name,
            restoreSecrets(item, isRecord(previous) ? previous[name] : undefined, name)]));
    }
    return value;
}

function secretRowIdentity(item) {
    if (!isRecord(item)) return null;
    if (typeof item.id === 'string' && item.id) return `id:${item.id}`;
    // Legacy backup database/CCU lists have no id. Match their endpoint identity,
    // never a mutable row position; duplicate or edited identities need a password.
    const fields = ['host', 'port', 'dbName', 'nameSuffix'];
    if (!fields.some(key => typeof item[key] === 'string' && item[key] !== '')) return null;
    return `endpoint:${JSON.stringify(fields.map(key => item[key] ?? null))}`;
}

class EosModuleHost {
    constructor(owner, options) {
        this.owner = owner;
        this.options = options;
        this.configStore = new EosModuleConfigStore(owner);
        this.running = false;
        this.initialized = false;
        this.startPromise = null;
        this.configurationLoadPromise = null;
        this.configurationSavePromise = null;
        this.entries = new Map();
        this.pending = null;
        this.mutation = false;
        this.timer = null;
        this.nextOwnershipCheck = 0;
        this.bridgeHandler = null;
        this.bridgeReply = null;
        this.stopped = false;
        this.stopPromise = null;
        this.deviceEms = null;
        for (const id of Object.keys(MODULES)) {
            this.entries.set(id, { id, module: null, config: { enabled: false }, configLoaded: false, reason: 'DISABLED', lease: 0,
                generation: 0, blockers: [], loading: false, failed: false, started: false, startup: null, stopEntryPromise: null, pendingWrites: new Set(), timers: new Set(), subscriptions: new Set(), downloads: new Set() });
        }
    }

    factory(id) {
        if (!Object.hasOwn(MODULES, id)) throw fail('EOS_MODULE_UNKNOWN');
        return this.options.factories?.[id] || require(join(this.options.baseDir, 'modules', id, 'index.js'));
    }

    /** Bind only the internal hosted runtime, never a URL or browser callback. */
    bindDeviceEms(handler) {
        if (this.deviceEms || this.stopped || typeof handler !== 'function') throw fail('EOS_EMS_BRIDGE_INVALID');
        this.deviceEms = new EosDeviceEmsService({
            owner: this.owner,
            getSnapshot: () => {
                const entry = this.entries.get('devices');
                return { namespace: this.namespace('devices'), devices: Array.isArray(entry.config.devices) ? entry.config.devices : [],
                    moduleEnabled: entry.config.enabled === true, generation: entry.generation,
                    ready: entry.configLoaded && this.initialized && (!entry.config.enabled ||
                        (entry.started === true && this.canOperate('devices', entry.generation))) };
            },
            canRun: () => !this.stopped && !this.mutation && this.licensed('devices') && this.owner.eosOwnership?.canWrite() === true,
            apply: async devices => {
                // Keep the authoritative device revision stable until the hosted
                // configuration write completes. Discovery itself holds no lock.
                if (this.mutation || this.stopped) throw fail('EOS_MODULE_BUSY');
                this.mutation = true;
                try { return await handler(devices); }
                finally { this.mutation = false; }
            },
        });
        this.deviceEms.request('configuration');
    }

    requestDeviceEms() { this.deviceEms?.request('apps'); }
    async flushDeviceEms() { await this.deviceEms?.flush(); }

    readConfig(id) {
        return this.decodeConfig(id, this.owner.config.eosModules?.[id]);
    }

    decodeConfig(id, envelope) {
        if (envelope == null) return this.factory(id).validateConfig({ enabled: false });
        if (!isRecord(envelope) || envelope.v !== 1 || typeof envelope.encrypted !== 'string') {
            throw fail('EOS_MODULE_CONFIG_FORMAT');
        }
        const config = assertJson(JSON.parse(this.owner.decrypt(envelope.encrypted)));
        return this.factory(id).validateConfig(config);
    }

    // The authenticated configuration shell must read the real saved settings even
    // while operational startup is fenced. This does not subscribe, start modules,
    // claim ownership or write the instance/configuration objects.
    async loadForEditing(id) {
        if (this.configurationLoadPromise) await this.configurationLoadPromise;
        const entry = this.entries.get(id);
        if (!entry) throw fail('EOS_MODULE_UNKNOWN');
        const startupAllowed = this.owner.eosMigration?.allowsStartup?.();
        if ((entry.configLoaded && entry.configurationStartupAllowed === startupAllowed) ||
            this.initialized || this.stopped || this.mutation || this.startPromise) return;
        this.mutation = true;
        this.configurationLoadPromise = (async () => {
            try {
                const envelope = await bounded(this.configStore.load(id));
                if (this.stopped) return;
                const config = this.decodeConfig(id, envelope);
                entry.config = config;
                entry.loadedEnvelope = envelope;
                entry.configLoaded = true;
                entry.configurationStartupAllowed = startupAllowed;
                entry.configurationError = '';
            } catch (error) {
                entry.configLoaded = false;
                entry.configurationError = typeof error?.code === 'string' ? error.code : 'EOS_MODULE_CONFIG_UNAVAILABLE';
            } finally { this.mutation = false; }
        })();
        try { await this.configurationLoadPromise; }
        finally { this.configurationLoadPromise = null; }
    }

    configurationReason(id) {
        const entry = this.entries.get(id);
        if (!entry) throw fail('EOS_MODULE_UNKNOWN');
        if (this.stopped) return 'EOS_MODULE_BUSY';
        if (!entry?.configLoaded) return entry?.configurationError || 'EOS_MODULE_NOT_READY';
        const migration = this.owner.eosMigration;
        // An unfinished handover may still write its target. Never accept a draft
        // into that target before the coordinator has released startup.
        if (migration?.allowsStartup?.() === false) return 'EOS_MODULE_MIGRATION_BLOCKED';
        if (!this.initialized && migration?.allowsStartup?.() !== true) return 'EOS_MODULE_NOT_READY';
        return '';
    }

    namespace(id) {
        const migrated = this.entries.get(id)?.loadedEnvelope?.migration || this.owner.config.eosModules?.[id]?.migration;
        if (migrated?.preserveNamespace === true &&
            typeof migrated.source === 'string' && new RegExp(`^${MODULES[id]}\\.\\d+$`).test(migrated.source)) {
            return migrated.source;
        }
        return id === 'devices' ? this.owner.namespace : `${this.owner.namespace}.${id}`;
    }

    licensed(id) {
        try {
            const service = this.owner.eosLicenseService;
            return service?.allowsEmbeddedModule?.(id) === true;
        } catch { return false; }
    }

    canOperate(id, generation) {
        const entry = this.entries.get(id);
        return this.running && this.initialized && !this.stopped && !!entry && entry.config.enabled === true && !entry.failed &&
            entry.generation === generation && entry.lease > performance.now() && this.licensed(id) &&
            this.owner.eosOwnership?.canWrite() === true;
    }

    async inspectOwnership(entry) {
        const name = MODULES[entry.id];
        const result = await bounded(this.owner.getObjectViewAsync('system', 'instance', {
            startkey: `system.adapter.${name}.`, endkey: `system.adapter.${name}.\u9999`,
        }));
        if (!Array.isArray(result?.rows) || result.rows.length > MAX_LEGACY_INSTANCES) throw fail('OWNERSHIP_UNAVAILABLE');
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
            if (!stopped || !hostFresh) blockers.push({ instance, reason: 'LEGACY_STOP_NOT_CONFIRMED' });
        }
        entry.blockers = blockers;
        return blockers.length === 0;
    }

    revoke(entry, reason) {
        entry.lease = 0;
        entry.reason = reason;
    }

    async stopEntry(entry) {
        if (entry.stopEntryPromise) return entry.stopEntryPromise;
        const module = entry.module;
        const startup = entry.startup;
        const wasStarting = startup?.module === module && startup.settled !== true;
        entry.module = null;
        entry.started = false;
        entry.generation++;
        const markUnconfirmed = () => {
            entry.failed = true; entry.stopFailed = true; entry.reason = 'STOP_FAILED_RESTART_REQUIRED';
        };
        const clearResources = () => {
            for (const download of entry.downloads) {
                download.accept = false;
                download.stream?.destroy();
            }
            entry.downloads.clear();
            for (const timer of entry.timers) { clearTimeout(timer); clearInterval(timer); }
            entry.timers.clear();
        };
        clearResources();
        // A module can finish opening a transport after its first stop call. Keep
        // the original start promise (not only its timeout wrapper), wait for its
        // settlement, then close again. The public deadline never means stopped.
        const cleanup = Promise.resolve().then(async () => {
            if (module && wasStarting) {
                await Promise.all([
                    Promise.resolve().then(() => module.stop()).catch(markUnconfirmed),
                    startup.promise.catch(() => undefined),
                ]);
                await module.stop();
            } else if (module) {
                await module.stop();
            }
            clearResources();
            // Controller API completion is distinct from physical device feedback.
            // Do not restore the old owner while an accepted mutation may still
            // settle into the retained namespace. Never retry an uncertain write.
            await Promise.allSettled([...entry.pendingWrites]);
            const subscriptions = [...entry.subscriptions];
            await Promise.all(subscriptions.map(pattern =>
                bounded(Promise.resolve().then(() => this.owner.unsubscribeForeignStatesAsync(pattern)), 1000)));
            for (const pattern of subscriptions) entry.subscriptions.delete(pattern);
        });
        // Keep late cleanup alive after timeout, but never restore its authority
        // or turn an uncertain stop into permission to reactivate the old owner.
        const configured = this.options.stopTimeoutMs;
        const deadline = Number.isFinite(configured) && configured > 0 ? Math.min(configured, 3500) : 3500;
        entry.stopEntryPromise = bounded(cleanup, deadline).catch(markUnconfirmed);
        return entry.stopEntryPromise;
    }

    facade(entry, generation) {
        const owner = this.owner;
        const namespace = this.namespace(entry.id);
        const resolve = id => {
            if (typeof id !== 'string' || id.length > 512) throw fail('EOS_MODULE_STATE_ID');
            const local = id.startsWith(`${namespace}.`) ? id.slice(namespace.length + 1) : id;
            const valid = entry.id === 'devices'
                ? /^(?:devices(?:\.|$)|modules\.devices(?:\.|$))/.test(local)
                : entry.id === 'backup' ? /^(?:info|backup|history|restore|schedule|oneClick|historyJSON)(?:\.|$)/.test(local)
                : /^(?:devices|info|identity|bridge|discovery|pairing|cls)(?:\.|$)/.test(local);
            if (!valid || [...local].some(character => character.charCodeAt(0) < 32)) throw fail('EOS_MODULE_STATE_SCOPE');
            return `${namespace}.${local}`;
        };
        const timer = (repeat, callback, ms, ...args) => {
            if (this.stopped || entry.generation !== generation || entry.timers.size >= 256 || typeof callback !== 'function' || !Number.isFinite(ms) || ms < (repeat ? 1 : 0)) {
                throw fail('EOS_MODULE_TIMER');
            }
            let pending = false;
            const invoke = () => {
                if (!repeat) entry.timers.delete(handle);
                if (entry.generation !== generation || pending || this.stopped) return;
                pending = true;
                Promise.resolve().then(() => callback(...args)).catch(() => {
                    this.revoke(entry, 'MODULE_CALLBACK_FAILED');
                    entry.failed = true;
                    owner.log.warn(`EOS_MODULE_CALLBACK_FAILED: ${entry.id}`);
                }).finally(() => { pending = false; });
            };
            const handle = repeat ? setInterval(invoke, ms) : setTimeout(invoke, ms);
            handle.unref?.(); entry.timers.add(handle); return handle;
        };
        const mutate = operation => {
            if (this.stopped || entry.generation !== generation) return Promise.reject(fail('EOS_MODULE_STOPPED'));
            if (entry.pendingWrites.size >= 4096) return Promise.reject(fail('EOS_MODULE_WRITE_LIMIT'));
            const pending = Promise.resolve().then(() => {
                if (this.stopped || entry.generation !== generation) throw fail('EOS_MODULE_STOPPED');
                return operation();
            });
            entry.pendingWrites.add(pending);
            void pending.then(() => entry.pendingWrites.delete(pending), () => entry.pendingWrites.delete(pending));
            return pending;
        };
        return {
            namespace, hostNamespace: owner.namespace,
            eosTargetNamespace: owner.config.eosUiMigration?.preserveNamespace ? owner.config.eosUiMigration.source : owner.namespace,
            instance: /^\w[\w-]*\.\d+$/.test(namespace) ? Number(namespace.split('.').at(-1)) : owner.instance, config: entry.config, log: owner.log,
            getObjectAsync: id => owner.getForeignObjectAsync(resolve(id)),
            getStateAsync: id => owner.getForeignStateAsync(resolve(id)),
            setObjectNotExistsAsync: (id, object) => {
                if (entry.generation !== generation) return Promise.reject(fail('EOS_MODULE_STOPPED'));
                const full = resolve(id);
                return mutate(() => owner.setForeignObjectNotExistsAsync(full, object));
            },
            extendObjectAsync: (id, object) => {
                if (entry.generation !== generation) return Promise.reject(fail('EOS_MODULE_STOPPED'));
                const full = resolve(id);
                return mutate(() => owner.extendForeignObjectAsync(full, object));
            },
            setStateAsync: (id, value, ack) => {
                if (entry.generation !== generation) {
                    // Cleanup telemetry is discarded rather than overwriting a newer runtime.
                    // Resolving discarded ack writes lets shutdown continue closing transports.
                    if (isRecord(value) ? value.ack === true : ack === true) return Promise.resolve();
                    return Promise.reject(fail('EOS_MODULE_STOPPED'));
                }
                const full = resolve(id);
                return mutate(async () => {
                    await owner.setForeignStateAsync(full, value, ack);
                    // Metadata is generated after aliases exist; no discovery on normal telemetry ticks.
                    if (entry.id === 'devices' && full.endsWith('.aliases.meta.manifest')) this.deviceEms?.event(full, true);
                });
            },
            subscribeStatesAsync: async pattern => {
                const full = resolve(pattern);
                if (entry.generation !== generation || entry.subscriptions.size >= 32) throw fail('EOS_MODULE_SUBSCRIPTION');
                await owner.subscribeForeignStatesAsync(full);
                if (this.stopped || entry.generation !== generation) {
                    await owner.unsubscribeForeignStatesAsync(full);
                    throw fail('EOS_MODULE_SUBSCRIPTION');
                }
                entry.subscriptions.add(full);
            },
            unsubscribeStatesAsync: async pattern => {
                const full = resolve(pattern);
                await owner.unsubscribeForeignStatesAsync(full); entry.subscriptions.delete(full);
            },
            setTimeout: (callback, ms, ...args) => timer(false, callback, ms, ...args),
            setInterval: (callback, ms, ...args) => timer(true, callback, ms, ...args),
            clearTimeout: handle => { clearTimeout(handle); entry.timers.delete(handle); },
            clearInterval: handle => { clearInterval(handle); entry.timers.delete(handle); },
            getBackupDataFolders: async () => {
                if (entry.id !== 'backup' || !this.canOperate(entry.id, generation)) throw fail('EOS_MODULE_INACTIVE');
                const result = await bounded(owner.getObjectViewAsync('system', 'instance', {
                    startkey: 'system.adapter.', endkey: 'system.adapter.\u9999',
                }));
                if (!Array.isArray(result?.rows) || result.rows.length > 20000) throw fail('EOS_BACKUP_DATA_FOLDER_INVENTORY');
                const folders = [];
                let bytes = 0;
                for (const row of result.rows) {
                    const object = row.value;
                    if (object?.type !== 'instance' || !/^system\.adapter\.[a-z0-9_-]+\.\d+$/.test(object._id || '')) throw fail('EOS_BACKUP_DATA_FOLDER_INVENTORY');
                    const folder = object.common?.dataFolder;
                    if (folder == null || folder === '') continue;
                    if (typeof folder !== 'string' || folder.length > 4096 || folder.includes('\0')) throw fail('EOS_BACKUP_DATA_FOLDER_INVENTORY');
                    bytes += Buffer.byteLength(folder);
                    if (bytes > 1024 * 1024) throw fail('EOS_BACKUP_DATA_FOLDER_INVENTORY');
                    folders.push(folder);
                }
                if (!this.canOperate(entry.id, generation)) throw fail('EOS_MODULE_INACTIVE');
                return folders;
            },
            sendBackupNotification: async plan => {
                if (entry.id !== 'backup' || !this.canOperate(entry.id, generation)) throw fail('EOS_MODULE_INACTIVE');
                const safe = assertJson(plan);
                if (Buffer.byteLength(JSON.stringify(safe)) > 8192 || this.factory('backup').validateNotificationPlan?.(entry.config, safe) !== true) {
                    throw fail('EOS_BACKUP_NOTIFICATION_SCOPE');
                }
                const now = performance.now();
                if (!entry.notificationWindow || now - entry.notificationWindow > 60000) { entry.notificationWindow = now; entry.notifications = 0; }
                if (++entry.notifications > 20) throw fail('EOS_BACKUP_NOTIFICATION_RATE');
                if (!this.canOperate(entry.id, generation)) throw fail('EOS_MODULE_INACTIVE');
                await bounded(new Promise((resolve, reject) => {
                    owner.sendTo(safe.target, safe.command, safe.message, reply => {
                        if (reply?.error) reject(fail('EOS_BACKUP_NOTIFICATION_FAILED'));
                        else resolve();
                    });
                }), 5000);
            },
            sendTo: (target, command, message, callback) => {
                const uiNamespace = owner.config.eosUiMigration?.preserveNamespace ? owner.config.eosUiMigration.source : owner.namespace;
                if (entry.id !== 'eebus' || target !== uiNamespace ||
                    !['nexowatt.para14a.hello.v1', 'nexowatt.para14a.command.v1'].includes(command) ||
                    !this.canOperate(entry.id, generation) || !this.bridgeHandler) {
                    if (typeof callback === 'function') queueMicrotask(() => callback({ accepted: false, error: 'EOS_MODULE_BRIDGE_UNAVAILABLE' }));
                    return;
                }
                const payload = assertJson(message);
                if (payload.sourceInstance === namespace) payload.sourceInstance = `${owner.namespace}.eebus`;
                void bounded(this.bridgeHandler({ from: `${owner.namespace}.eebus`, command, message: payload }), 3000).then(
                    result => { if (typeof callback === 'function') callback(result); },
                    () => { if (typeof callback === 'function') callback({ accepted: false, error: 'EOS_MODULE_BRIDGE_UNAVAILABLE' }); },
                ).catch(() => owner.log.warn('EOS_MODULE_BRIDGE_CALLBACK_FAILED'));
            },
        };
    }

    async reconcile() {
        if (!this.running || !this.initialized || this.stopped) return;
        if (this.pending) return this.pending;
        this.pending = (async () => {
            const checkOwnership = performance.now() >= this.nextOwnershipCheck;
            if (checkOwnership) this.nextOwnershipCheck = performance.now() + 4000;
            for (const entry of this.entries.values()) {
                if (!this.running || this.stopped) break;
                if (!entry.config.enabled) this.revoke(entry, 'DISABLED');
                else if (!this.licensed(entry.id)) this.revoke(entry, 'LICENSE_REQUIRED');
                else if (this.owner.eosOwnership?.canWrite() !== true) this.revoke(entry, 'EOS_OWNERSHIP_REQUIRED');
                else if (checkOwnership && !entry.failed) {
                    const generation = entry.generation;
                    try {
                        const allowed = await bounded(this.inspectOwnership(entry));
                        if (this.running && !this.stopped && generation === entry.generation) {
                            if (allowed) { entry.lease = performance.now() + LEASE_MS; entry.reason = entry.module && entry.started ? 'RUNNING' : 'READY'; }
                            else this.revoke(entry, 'LEGACY_CONFLICT');
                        }
                    } catch { this.revoke(entry, 'OWNERSHIP_UNAVAILABLE'); }
                }
                if (entry.module && entry.moduleGeneration !== entry.generation) await this.stopEntry(entry);
                if (!this.canOperate(entry.id, entry.generation)) {
                    if (entry.module) await this.stopEntry(entry);
                    continue;
                }
                if (entry.module || entry.failed) continue;
                const generation = entry.generation;
                try {
                    const factory = this.factory(entry.id);
                    const module = factory.createHostedModule({
                        adapter: this.facade(entry, generation), config: entry.config,
                        canOperate: () => this.canOperate(entry.id, generation),
                        dataDir: join(this.options.dataDir, entry.id),
                        ...(entry.id === 'backup' ? {
                            installationDir: this.options.installationDir, eosDataDir: this.options.eosDataDir,
                            preservedUiNamespace: this.owner.config.eosUiMigration?.preserveNamespace === true &&
                                /^nexowatt-ui\.\d+$/.test(this.owner.config.eosUiMigration.source || '')
                                ? this.owner.config.eosUiMigration.source : undefined,
                        } : {}),
                    });
                    entry.module = module;
                    entry.moduleGeneration = generation;
                    entry.started = false;
                    entry.stopEntryPromise = null;
                    const startup = { module, settled: false, promise: Promise.resolve().then(() => module.start()) };
                    entry.startup = startup;
                    void startup.promise.then(() => { startup.settled = true; }, () => { startup.settled = true; });
                    await bounded(startup.promise, 10000);
                    if (!this.canOperate(entry.id, generation)) await this.stopEntry(entry);
                    else {
                        entry.started = true; entry.reason = 'RUNNING';
                        if (entry.id === 'devices') this.deviceEms?.request('started');
                    }
                } catch {
                    if (!entry.stopFailed) this.revoke(entry, 'START_FAILED_RESTART_REQUIRED');
                    entry.failed = true;
                    await this.stopEntry(entry);
                    this.owner.log.warn(`EOS_MODULE_START_FAILED: ${entry.id}; HTTPS remains available`);
                }
            }
        })().catch(() => this.owner.log.warn('EOS_MODULE_RECONCILE_FAILED')).finally(() => { this.pending = null; });
        return this.pending;
    }

    async start() {
        if (this.startPromise) return this.startPromise;
        while (this.configurationLoadPromise || this.configurationSavePromise) {
            // The accepted save owns its error response. Startup independently
            // loads the authoritative store afterwards, including after rejection.
            await (this.configurationLoadPromise || this.configurationSavePromise).then(() => undefined, () => undefined);
        }
        if (this.startPromise) return this.startPromise;
        if (this.stopped) return;
        if (this.mutation) throw fail('EOS_MODULE_BUSY');
        this.mutation = true;
        this.running = true;
        this.startPromise = (async () => {
            try {
                for (const entry of this.entries.values()) {
                    if (this.stopped) return;
                    try {
                        const envelope = await bounded(this.configStore.load(entry.id));
                        if (this.stopped) return;
                        if (envelope) this.owner.config.eosModules = { ...this.owner.config.eosModules, [entry.id]: envelope };
                        entry.config = this.readConfig(entry.id);
                        entry.loadedEnvelope = envelope;
                        entry.configLoaded = true;
                        entry.configurationError = '';
                    }
                    catch (error) { entry.failed = true; entry.configLoaded = false; entry.reason = 'CONFIG_INVALID';
                        entry.configurationError = typeof error?.code === 'string' ? error.code : 'EOS_MODULE_CONFIG_UNAVAILABLE'; }
                    const name = MODULES[entry.id];
                    await bounded(this.owner.subscribeForeignObjectsAsync(`system.adapter.${name}.*`));
                    if (this.stopped) return;
                    await bounded(this.owner.subscribeForeignStatesAsync(`system.adapter.${name}.*.alive`));
                }
                if (this.stopped) return;
                this.initialized = true;
            } finally { this.mutation = false; }
            if (this.stopped) return;
            this.timer = setInterval(() => { void this.reconcile(); }, 1000);
            this.timer.unref?.();
            await this.reconcile();
        })();
        return this.startPromise;
    }

    onObjectChange(id) {
        this.deviceEms?.event(id);
        for (const entry of this.entries.values()) {
            if (id.startsWith(`system.adapter.${MODULES[entry.id]}.`)) {
                this.revoke(entry, 'OWNERSHIP_CHANGED'); entry.generation++;
                this.nextOwnershipCheck = 0;
            }
        }
        void this.reconcile();
    }

    onStateChange(id, state) {
        this.deviceEms?.event(id, true);
        for (const entry of this.entries.values()) {
            if (id.startsWith(`system.adapter.${MODULES[entry.id]}.`) ||
                (/^system\.host\..*\.alive$/.test(id) && state?.val !== true)) {
                this.revoke(entry, 'OWNERSHIP_CHANGED'); entry.generation++; this.nextOwnershipCheck = 0;
            }
            const prefix = entry.id === 'devices' ? `${this.namespace(entry.id)}.devices.` : `${this.namespace(entry.id)}.`;
            if (entry.module && id.startsWith(prefix)) {
                try {
                    Promise.resolve(entry.module.onStateChange?.(id, state)).catch(() => this.owner.log.warn(`EOS_MODULE_EVENT_FAILED: ${entry.id}`));
                } catch { this.owner.log.warn(`EOS_MODULE_EVENT_FAILED: ${entry.id}`); }
            }
        }
    }

    async status(id) {
        const entry = this.entries.get(id);
        if (!entry) throw fail('EOS_MODULE_UNKNOWN');
        let details = {};
        try { details = entry.module ? await bounded(entry.module.getStatus?.() || {}, 2000) : {}; }
        catch { details = { statusUnavailable: true }; }
        return { id, enabled: entry.config.enabled === true, active: !!entry.module && entry.started === true && entry.moduleGeneration === entry.generation && this.canOperate(id, entry.generation),
            reason: entry.reason, blockers: entry.blockers, details: redact(assertJson(details)),
            namespace: id === 'devices' ? `${this.namespace(id)}.devices` : this.namespace(id) };
    }

    async view(id) {
        await this.loadForEditing(id);
        const entry = this.entries.get(id);
        if (!entry) throw fail('EOS_MODULE_UNKNOWN');
        const reason = this.configurationReason(id);
        return { id, config: redact(entry.config), configurationReady: !reason, configurationLoaded: entry.configLoaded,
            configurationReason: reason, status: await this.status(id),
            ...(id === 'devices' && this.deviceEms ? { emsCommissioning: this.deviceEms.view() } : {}),
            manualImport: this.manualImportStatus(id), migration: entry.loadedEnvelope?.migration || this.owner.config.eosModules?.[id]?.migration || null };
    }

    manualImportStatus(id) {
        const entry = this.entries.get(id);
        if (!entry) throw fail('EOS_MODULE_UNKNOWN');
        const migration = entry.loadedEnvelope?.migration || this.owner.config.eosModules?.[id]?.migration;
        const reason = this.stopped ? 'EOS_MODULE_BUSY'
            : !this.initialized || !entry.configLoaded ? 'EOS_MODULE_NOT_READY'
                : migration?.preserveNamespace === true ? 'EOS_MODULE_IMPORT_ALREADY_MIGRATED'
                : entry.stopFailed ? 'EOS_MODULE_STOP_UNCONFIRMED'
                    : entry.config.enabled || entry.module ? 'EOS_MODULE_IMPORT_REQUIRES_DISABLED' : '';
        return { allowed: !reason, reason };
    }

    async save(id, config, migration) {
        const reason = this.configurationReason(id);
        if (reason) throw fail(reason);
        if (this.mutation || this.stopped) throw fail('EOS_MODULE_BUSY');
        const entry = this.entries.get(id);
        if (!entry) throw fail('EOS_MODULE_UNKNOWN');
        if (!entry.configLoaded) throw fail('EOS_MODULE_NOT_READY');
        if (id === 'devices') this.deviceEms?.request('configuration');
        this.mutation = true;
        this.configurationSavePromise = this.persistConfig(id, config, migration);
        try { return await this.configurationSavePromise; }
        finally { this.mutation = false; this.configurationSavePromise = null; }
    }

    /** Internal commit shared by save/import; the entire caller operation owns the mutation lock. */
    async persistConfig(id, config, migration) {
        if (!this.mutation || this.stopped) throw fail('EOS_MODULE_BUSY');
        const entry = this.entries.get(id);
        if (!entry) throw fail('EOS_MODULE_UNKNOWN');
        const normalized = this.factory(id).validateConfig(restoreSecrets(assertJson(config), entry.config));
        const encrypted = this.owner.encrypt(JSON.stringify(normalized));
        if (typeof encrypted !== 'string' || encrypted === JSON.stringify(normalized)) throw fail('EOS_MODULE_ENCRYPTION');
        const envelope = { v: 1, encrypted,
            migration: migration || entry.loadedEnvelope?.migration || this.owner.config.eosModules?.[id]?.migration || null };
        // Commit before interrupting the old runtime. Failed/conflicting writes
        // leave its validated settings and transport generation untouched.
        await bounded(this.configStore.save(id, envelope));
        this.revoke(entry, 'CONFIG_CHANGED');
        await this.stopEntry(entry);
        this.owner.config.eosModules = { ...this.owner.config.eosModules, [id]: envelope };
        entry.config = normalized;
        entry.loadedEnvelope = envelope;
        if (!entry.stopFailed) {
            entry.failed = false; entry.reason = normalized.enabled ? 'STARTING' : 'DISABLED';
        } else {
            entry.failed = true; entry.reason = 'STOP_FAILED_RESTART_REQUIRED';
        }
        this.nextOwnershipCheck = 0;
        if (id === 'devices') this.deviceEms?.request('configuration');
        void this.reconcile();
        return this.view(id);
    }

    async importLegacy(id, instance) {
        if (!this.initialized && !this.stopped) throw fail('EOS_MODULE_NOT_READY');
        if (this.mutation || this.stopped) throw fail('EOS_MODULE_BUSY');
        this.mutation = true;
        try {
            if (!Object.hasOwn(MODULES, id) || typeof instance !== 'string' ||
                !new RegExp(`^${MODULES[id]}\\.\\d+$`).test(instance)) throw fail('EOS_MODULE_IMPORT_INSTANCE');
            const entry = this.entries.get(id);
            const eligibility = this.manualImportStatus(id);
            if (!eligibility.allowed) throw fail(eligibility.reason);
            if (!(await bounded(this.inspectOwnership(entry)))) throw fail('EOS_MODULE_LEGACY_RUNNING');
            const object = await bounded(this.owner.getForeignObjectAsync(`system.adapter.${instance}`));
            if (!object?.native || object.common?.enabled !== false) throw fail('EOS_MODULE_IMPORT_UNAVAILABLE');
            let config = id === 'eebus' ? assertJson(object.native) : require('./eosLegacyMigration').decryptNative(this.owner, object);
            // Existing private keys are never copied out of legacy native storage.
            delete config.privateKey; delete config.certificate; delete config.cert;
            if (id === 'eebus') {
                // Legacy EEBus encryptedNative values are ciphertext in the object DB.
                // Pairing identity/PIN require deliberate fresh pairing after import.
                delete config.pairingPin; delete config.shipPairingPin;
            }
            const migration = await bounded(this.factory(id).migrateLegacyConfig?.(config, {
                owner: this.owner, source: instance, sourceVersion: object.common.version, sourceEnabled: false,
                installationDir: this.options.installationDir, eosDataDir: this.options.eosDataDir,
                dataDir: join(this.options.dataDir, id),
            }));
            if (migration) config = migration.config;
            config.enabled = false;
            const report = { source: instance, importedAt: new Date().toISOString(),
                oldPrefix: `${instance}.`, newPrefix: id === 'devices' ? `${this.owner.namespace}.` : `${this.owner.namespace}.${id}.`,
                statesCopied: false, mappingsRewritten: false, identityImported: false,
                omittedFields: migration?.omittedFields || [], requiresPairing: id === 'eebus' };
            // Recheck ownership after asynchronous conversion; imports never start a source or target.
            if (this.stopped) throw fail('EOS_MODULE_BUSY');
            if (!(await bounded(this.inspectOwnership(entry)))) throw fail('EOS_MODULE_LEGACY_RUNNING');
            const currentEligibility = this.manualImportStatus(id);
            if (!currentEligibility.allowed) throw fail(currentEligibility.reason);
            const result = await this.persistConfig(id, config, report);
            return { ...result, migration: report };
        } finally { this.mutation = false; }
    }

    async command(id, command, payload) {
        const entry = this.entries.get(id);
        if (!entry || typeof command !== 'string') throw fail('EOS_MODULE_COMMAND');
        const now = performance.now();
        if (!entry.commandWindow || now - entry.commandWindow > 10000) { entry.commandWindow = now; entry.commands = 0; }
        if (++entry.commands > 30) throw fail('EOS_MODULE_RATE_LIMIT');
        const safePayload = assertJson(payload ?? {});
        if (id === 'devices') {
            const factory = this.factory(id);
            if (typeof factory.command === 'function') return bounded(factory.command(command, safePayload));
            if (typeof factory.getCatalog === 'function' && command === 'getCatalog') return factory.getCatalog();
        }
        if (!entry.module || !this.canOperate(id, entry.generation)) throw fail('EOS_MODULE_INACTIVE');
        return bounded(entry.module.command(command, safePayload));
    }

    bindBridge(handler) { this.bridgeHandler = handler; }

    migrationStatus() {
        return this.owner.eosMigration?.status() || { phase: 'NOT_AVAILABLE', code: '', sources: [], updatedAt: null };
    }

    async download(id, name) {
        const entry = this.entries.get(id);
        if (id !== 'backup' || !entry?.module || !this.canOperate(id, entry.generation) ||
            typeof entry.module.getDownload !== 'function') throw fail('EOS_MODULE_INACTIVE');
        if (entry.downloads.size >= 4) throw fail('EOS_MODULE_RATE_LIMIT');
        const generation = entry.generation;
        const module = entry.module;
        const download = { accept: true, stream: null };
        entry.downloads.add(download);
        // File opening can finish after the HTTP deadline. Retain cleanup authority
        // over that late result instead of losing its file descriptor in Promise.race.
        const pending = Promise.resolve().then(() => module.getDownload(name)).then(result => {
            if (!result?.stream || typeof result.stream.destroy !== 'function' || typeof result.stream.once !== 'function') {
                throw fail('EOS_MODULE_DOWNLOAD_INVALID');
            }
            download.stream = result.stream;
            result.stream.once('close', () => entry.downloads.delete(download));
            if (!download.accept || !this.canOperate(id, generation)) {
                result.stream.destroy();
                throw fail('EOS_MODULE_INACTIVE');
            }
            return result;
        });
        try {
            return await bounded(pending, Math.min(this.options.downloadTimeoutMs || 5000, 5000));
        } catch (error) {
            download.accept = false;
            download.stream?.destroy();
            entry.downloads.delete(download);
            throw error;
        }
    }

    receiveBridge(message) {
        const entry = this.entries.get('eebus');
        if (!entry.module || !this.canOperate('eebus', entry.generation) || message?.command !== 'nexowatt.para14a.implementation.v1') return false;
        try {
            const payload = assertJson(message.message);
            if (payload.targetInstance === `${this.owner.namespace}.eebus`) payload.targetInstance = this.namespace('eebus');
            const uiNamespace = this.owner.config.eosUiMigration?.preserveNamespace ? this.owner.config.eosUiMigration.source : this.owner.namespace;
            Promise.resolve(entry.module.onMessage?.({ ...message, message: payload, from: uiNamespace })).catch(() => this.owner.log.warn('EOS_MODULE_BRIDGE_EVENT_FAILED'));
        } catch { this.owner.log.warn('EOS_MODULE_BRIDGE_EVENT_FAILED'); }
        return true;
    }

    async stop() {
        if (this.stopPromise) return this.stopPromise;
        this.stopped = true; this.running = false; this.bridgeHandler = null;
        clearInterval(this.timer); this.timer = null;
        for (const entry of this.entries.values()) this.revoke(entry, entry.stopFailed ? 'STOP_FAILED_RESTART_REQUIRED' : 'STOPPED');
        this.stopPromise = Promise.allSettled([
            ...[...this.entries.values()].map(entry => this.stopEntry(entry)),
            ...(this.deviceEms ? [this.deviceEms.stop()] : []),
        ]).then(results => {
            if (results.some(result => result.status === 'rejected') || [...this.entries.values()].some(entry => entry.stopFailed)) {
                throw fail('EOS_MODULE_STOP_UNCONFIRMED');
            }
        });
        await this.stopPromise;
    }
}

module.exports = { EosModuleHost, bounded, redact, restoreSecrets, assertJson, SECRET_MARKER };
