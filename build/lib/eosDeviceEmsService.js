/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
// @ts-check
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Stimmt gespeicherte Geräte und ihre tatsächlich vorhandenen Aliasdaten begrenzt mit dem EMS ab.
 * Daten und Wirkung: Liest nur konkrete Gerätepfade und übergibt geprüfte Pläne an den geschützten Speicherpfad; sendet keine Aktorbefehle.
 * Bei Änderungen: Wiederholtes Speichern, Neustart, manuelle Zuordnungen, Lizenz-/Eigentumsentzug und begrenzte Fehlerpfade prüfen.
 */
/** @typedef {import('./eosDeviceEmsService').DeviceEmsServiceOptions} DeviceEmsServiceOptions */
/** @typedef {import('./eosDeviceEmsService').DeviceEmsInventory} DeviceEmsInventory */
/** @typedef {import('./eosDeviceEmsService').DeviceEmsSnapshot} DeviceEmsSnapshot */
/** @typedef {import('./eosDeviceEmsService').DeviceEmsPublicView} DeviceEmsPublicView */
/** @typedef {Record<string, unknown>} RecordValue */
const MAX_DEVICES = 128;
const MAX_ALIASES = 512;
const MAX_MANIFEST_BYTES = 65536;
const CLASSES = new Set(['evCharger', 'meter', 'pvInverter', 'storageSystem', 'battery', 'batteryInverter', 'heat', 'io', 'solarCharger', 'generic']);
const MODES = new Set(['auto', 'monitor', 'manual', 'singleStorage', 'storageFarm', 'gridMeter', 'generationMeter', 'consumptionMeter', 'pvInverter']);
const RETRIES = [1000, 2000, 5000, 10000, 15000, 30000];
const PLANNER_CONFIG_KEYS = Object.freeze(['settingsConfig', 'settings', 'storage', 'storageFarm', 'gridConstraints',
    'thermalControl', 'thermal', 'heatingRod', 'threshold', 'generator', 'bhkw',
    'dynamicGridConnection', 'datapoints', 'vis', 'eosDeviceEms', 'emsApps']);
/** @param {unknown} value @returns {value is RecordValue} */
function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
/** @param {string} code */
function fail(code) { return Object.assign(new Error(code), { code }); }
/** @param {unknown} value @param {number} [max] @returns {string} */
function text(value, max = 160) { return typeof value === 'string' && value.length <= max && ![...value].some(character => character.charCodeAt(0) < 32) ? value : ''; }
/** @param {unknown} value @returns {value is string} */
function safeId(value) { return typeof value === 'string' && /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,159}$/.test(value) && !value.split('.').some(part => !part || ['__proto__', 'prototype', 'constructor'].includes(part)); }
/** The adapter runtime also contains TLS handles, optional port fields and other
 * non-installer data. Only the planner's explicit configuration contract crosses
 * this boundary; the planner still strictly validates every included section.
 * @param {unknown} value @returns {RecordValue} */
function projectDeviceEmsConfig(value) {
    if (!record(value))
        throw fail('EOS_EMS_PLAN_CONFIG_INVALID');
    /** @type {RecordValue} */
    const result = {};
    for (const key of PLANNER_CONFIG_KEYS)
        if (Object.prototype.hasOwnProperty.call(value, key) && value[key] !== undefined)
            result[key] = value[key];
    return result;
}
/** @param {unknown} value @returns {RecordValue} */
function publicIntent(value) {
    if (!record(value))
        return { mode: 'auto' };
    /** @type {RecordValue} */
    const result = { mode: typeof value.mode === 'string' && MODES.has(value.mode) ? value.mode : 'manual' };
    if (value.scope === 'M0' || value.scope === 'M1')
        result.scope = value.scope;
    if (typeof value.flowSlot === 'number' && Number.isInteger(value.flowSlot) && value.flowSlot >= 0 && value.flowSlot <= 10)
        result.flowSlot = value.flowSlot;
    if (text(value.group, 80))
        result.group = value.group;
    if (value.activation !== undefined) {
        const activation = value.activation;
        if (!record(activation) || typeof activation.requested !== 'boolean' ||
            typeof activation.requestId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{15,127}$/.test(activation.requestId))
            throw fail('EOS_EMS_ACTIVATION_INVALID');
        /** @type {RecordValue} */
        const limits = {};
        if (activation.limits !== undefined) {
            if (!record(activation.limits))
                throw fail('EOS_EMS_ACTIVATION_INVALID');
            for (const key of ['maxChargeW', 'maxDischargeW', 'capacityKWh', 'minCurrentA', 'maxCurrentA', 'minPowerW', 'maxPowerW']) {
                const limit = activation.limits[key];
                if (limit !== undefined) {
                    if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0)
                        throw fail('EOS_EMS_ACTIVATION_INVALID');
                    limits[key] = limit;
                }
            }
            for (const key of ['coupling', 'chargerType']) {
                const limit = activation.limits[key];
                if (limit !== undefined) {
                    if (limit !== 'ac' && limit !== 'dc')
                        throw fail('EOS_EMS_ACTIVATION_INVALID');
                    limits[key] = limit;
                }
            }
            if (activation.limits.phases !== undefined) {
                if (activation.limits.phases !== 1 && activation.limits.phases !== 3)
                    throw fail('EOS_EMS_ACTIVATION_INVALID');
                limits.phases = activation.limits.phases;
            }
        }
        result.activation = { requested: activation.requested, requestId: activation.requestId, limits };
    }
    return result;
}
/** A failure before discovery must still be visible for every saved device.
 * @param {DeviceEmsSnapshot} snapshot @param {string} code @returns {DeviceEmsPublicView['statuses']} */
function blockedStatuses(snapshot, code) {
    if (!Array.isArray(snapshot.devices) || !/^(?:eos-admin|nexowatt-devices)\.\d+$/.test(snapshot.namespace))
        return [];
    return snapshot.devices.slice(0, MAX_DEVICES).filter(value => record(value) && safeId(value.id)).map(value => {
        const device = /** @type {RecordValue} */ (value);
        const id = String(device.id);
        return { deviceId: id, devId: id, baseId: `${snapshot.namespace}.devices.${id}`, status: 'pending', code,
            target: '', mappedFields: [], missing: [], optionalMissing: [] };
    });
}
/** Bounded database reads only. No timeout is ever used to pretend a write completed.
 * @template T @param {Promise<T>} operation @param {number} milliseconds @returns {Promise<T>} */
function readDeadline(operation, milliseconds) {
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timer;
    return Promise.race([operation, new Promise((_, reject) => {
            timer = setTimeout(() => reject(fail('EOS_EMS_DISCOVERY_TIMEOUT')), Math.max(1, milliseconds));
        })]).finally(() => clearTimeout(timer));
}
/** Resolve only references in the current installer configuration, never a
 * controller-wide object scan. Alias expressions are not executed: this checks
 * command/read identity, not signal conversion or arbitrary hardware topology.
 * @param {import('./eosDeviceEmsService').DeviceEmsTargetOptions} options
 * @returns {Promise<import('./eosDeviceEmsService').DeviceEmsTargets>} */
async function resolveDeviceEmsTargets(options) {
    const references = options.references;
    const valid = (/** @type {unknown} */ id) => typeof id === 'string' && id.length > 0 && id.length <= 512
        && text(id, 512) === id && ![...id].some(character => '*?[]'.includes(character))
        && !id.split('.').some(part => ['__proto__', 'prototype', 'constructor'].includes(part));
    if (!references || !Array.isArray(references.read) || !Array.isArray(references.write)
        || references.read.length + references.write.length > 1024
        || ![...references.read, ...references.write].every(valid))
        throw fail('EOS_EMS_TARGET_REFERENCE_LIMIT');
    const deadline = Date.now() + 10000;
    let aborted = false;
    const known = new Map();
    /** @type {Map<string, import('./eosDeviceEmsService').DeviceEmsAlias>} */
    const knownMetadata = new Map();
    for (const device of options.devices)
        for (const metadata of Object.values(device.aliasMeta || {})) {
            if (!valid(metadata.id))
                continue;
            knownMetadata.set(metadata.id, metadata);
            if (valid(metadata.targetId))
                known.set(metadata.id, metadata.targetId);
            // Generated V1 heartbeat/computed readings are states in their own
            // right. They deliberately have no single backing device datapoint.
            else if (metadata.read === true && metadata.write === false)
                known.set(metadata.id, metadata.id);
        }
    /** @type {Map<string, Promise<unknown>>} */
    const cache = new Map();
    const guard = () => {
        if (aborted || (options.canRun && !options.canRun()))
            throw fail('EOS_EMS_CONFIGURATION_CHANGED');
        if (Date.now() >= deadline)
            throw fail('EOS_EMS_TARGET_RESOLUTION_PENDING');
    };
    /** @param {string} id @returns {Promise<unknown>} */
    const read = id => {
        guard();
        let request = cache.get(id);
        if (!request) {
            if (cache.size >= 2048)
                throw fail('EOS_EMS_TARGET_REFERENCE_LIMIT');
            request = readDeadline(options.owner.getForeignObjectAsync(id), Math.min(3000, deadline - Date.now()));
            cache.set(id, request);
        }
        return request;
    };
    /** @type {Record<string,import('./eosDeviceEmsService').DeviceEmsReferenceMeta>} */
    const referenceMeta = Object.create(null);
    /** @param {string} id @param {'read'|'write'} mode @returns {Promise<string>} */
    const resolve = async (id, mode) => {
        const originalId = id;
        const visited = new Set();
        let permitted = true;
        /** @param {RecordValue|import('./eosDeviceEmsService').DeviceEmsAlias|null} common */
        const inspect = common => {
            permitted = permitted && common !== null && (mode === 'read' ? common.read !== false : common.write === true);
            if (id === originalId && !referenceMeta[originalId])
                referenceMeta[originalId] = {
                    type: common ? text(common.type, 30) : '', unit: common ? text(common.unit, 30) : '', read: false, write: false,
                };
            referenceMeta[originalId][mode] = permitted;
        };
        for (let depth = 0; depth < 8; depth++) {
            guard();
            if (known.has(id)) {
                inspect(knownMetadata.get(id) || null);
                return known.get(id);
            }
            if (visited.has(id))
                throw fail('EOS_EMS_TARGET_ALIAS_PENDING');
            visited.add(id);
            const object = await read(id);
            // A missing former leaf cannot currently send commands. Keep its
            // exact identity; do not invent another target or delete its mapping.
            if (object === null || object === undefined) {
                inspect(null);
                return id;
            }
            if (!record(object) || object._id !== id || object.type !== 'state' || !record(object.common))
                throw fail('EOS_EMS_TARGET_ALIAS_PENDING');
            inspect(object.common);
            // Previous device releases also exposed aliases without the V1
            // suffix. Resolve them only against the saved, verified device and
            // template identity, using their actual native target metadata.
            if (record(object.native) && object.native.isAlias === true) {
                const native = object.native;
                const device = options.devices.find(value => id.startsWith(`${value.baseId}.aliases.`)
                    && native.deviceId === value.deviceId && native.templateId === value.templateId);
                if (device) {
                    const target = mode === 'write' && safeId(native.writeDpId) ? native.writeDpId : native.dpId;
                    if (!safeId(target)) {
                        if (mode === 'read' && object.common.read !== false && object.common.write === false
                            && (native.aliasKind === 'heartbeat' || native.aliasKind === 'computed'))
                            return id;
                        throw fail('EOS_EMS_TARGET_ALIAS_PENDING');
                    }
                    return `${device.baseId}.${target}`;
                }
            }
            const alias = object.common.alias;
            if (alias === undefined || alias === null)
                return id;
            if (!record(alias))
                throw fail('EOS_EMS_TARGET_ALIAS_PENDING');
            const pointer = record(alias.id) ? alias.id[mode] : alias.id;
            if (!valid(pointer))
                throw fail('EOS_EMS_TARGET_ALIAS_PENDING');
            id = /** @type {string} */ (pointer);
        }
        throw fail('EOS_EMS_TARGET_ALIAS_PENDING');
    };
    /** @type {Record<string,string>} */
    const readTargets = Object.create(null);
    /** @type {Record<string,string>} */
    const writeTargets = Object.create(null);
    const jobs = [
        ...references.read.map(id => ({ id, mode: /** @type {const} */ ('read'), output: readTargets })),
        ...references.write.map(id => ({ id, mode: /** @type {const} */ ('write'), output: writeTargets })),
    ];
    let cursor = 0;
    const worker = async () => {
        while (cursor < jobs.length) {
            const job = jobs[cursor++];
            job.output[job.id] = await resolve(job.id, job.mode);
        }
    };
    try {
        await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, worker));
    }
    catch {
        aborted = true;
        throw fail('EOS_EMS_TARGET_RESOLUTION_PENDING');
    }
    guard();
    return { readTargets, writeTargets, referenceMeta };
}
/** Event-driven device commissioning. Inventory is reconstructed only from the
 * protected saved device list and real V1 objects. Hardware commands are never sent. */
class EosDeviceEmsService {
    /** @param {DeviceEmsServiceOptions} options */
    constructor(options) {
        this.options = options;
        /** @type {ReturnType<typeof setTimeout> | null} */
        this.timer = null;
        /** @type {Promise<void> | null} */
        this.pending = null;
        this.stopped = false;
        this.dirty = false;
        this.retry = 0;
        this.sequence = 0;
        this.lastReportedCode = '';
        /** @type {Map<string, {ts: number, qualified: boolean}>} */
        this.powerCapabilitySamples = new Map();
        /** @type {number|null} */
        this.powerCapabilityGeneration = null;
        /** @type {DeviceEmsPublicView} */
        this.current = { state: 'pending', code: 'EOS_EMS_CONFIGURATION_PENDING', updatedAt: 0, statuses: [] };
    }
    /** @returns {DeviceEmsPublicView} */
    view() { return JSON.parse(JSON.stringify(this.current)); }
    /** Coalesce a burst of aliases without postponing forever. @param {string} [reason] */
    request(reason = 'change') {
        if (this.stopped)
            return;
        this.dirty = true;
        this.retry = 0;
        if (reason === 'configuration') {
            this.sequence++;
            this.powerCapabilitySamples.clear();
            this.powerCapabilityGeneration = null;
            this.current = { state: 'pending', code: 'EOS_EMS_CONFIGURATION_PENDING', updatedAt: Date.now(),
                statuses: blockedStatuses(this.options.getSnapshot(), 'EOS_EMS_CONFIGURATION_PENDING') };
        }
        this.schedule(250);
    }
    /** @param {number} milliseconds */
    schedule(milliseconds) {
        if (this.stopped || this.timer || this.pending)
            return;
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.flush().catch(() => { });
        }, milliseconds);
        this.timer.unref?.();
    }
    /** Exact owner namespace, including preserved legacy namespace and dotted ids.
     * @param {string} id @param {boolean} [state] */
    event(id, state = false) {
        if (this.stopped || typeof id !== 'string')
            return;
        const snapshot = this.options.getSnapshot();
        const prefix = `${snapshot.namespace}.devices.`;
        if (id.startsWith(prefix) && (state ? id.endsWith('.aliases.meta.manifest') : id.includes('.aliases.')))
            this.request('aliases');
    }
    /** @param {DeviceEmsSnapshot} snapshot @returns {Promise<DeviceEmsInventory[]>} */
    async inventory(snapshot) {
        if (!/^(?:eos-admin|nexowatt-devices)\.\d+$/.test(snapshot.namespace) || !Array.isArray(snapshot.devices) || snapshot.devices.length > MAX_DEVICES)
            throw fail('EOS_EMS_INVENTORY_SCOPE');
        if (snapshot.generation !== this.powerCapabilityGeneration) {
            this.powerCapabilitySamples.clear();
            this.powerCapabilityGeneration = snapshot.generation;
        }
        const deadline = Date.now() + 10000;
        /** @type {DeviceEmsInventory[]} */
        const result = new Array(snapshot.devices.length);
        let cursor = 0;
        const worker = async () => {
            while (cursor < snapshot.devices.length) {
                const index = cursor++;
                const device = snapshot.devices[index];
                if (!record(device) || !safeId(device.id) || !text(device.templateId))
                    throw fail('EOS_EMS_INVENTORY_DEVICE');
                const baseId = `${snapshot.namespace}.devices.${device.id}`;
                /** @type {DeviceEmsInventory} */
                const row = { baseId, deviceId: device.id, devId: device.id, name: text(device.name) || device.id,
                    enabled: snapshot.moduleEnabled && device.enabled !== false, templateId: text(device.templateId), protocol: text(device.protocol, 32),
                    deviceClass: 'generic', category: '', aliases: {}, aliasMeta: {}, capabilities: [], missingRequired: [],
                    ems: publicIntent(device.ems) };
                result[index] = row;
                if (this.stopped || snapshot.generation !== this.options.getSnapshot().generation)
                    throw fail('EOS_EMS_CONFIGURATION_CHANGED');
                const budget = Math.min(3000, deadline - Date.now());
                if (budget <= 0) {
                    row.discoveryCode = 'EOS_EMS_DISCOVERY_TIMEOUT';
                    continue;
                }
                try {
                    const [state, objects] = await readDeadline(Promise.all([
                        this.options.owner.getForeignStateAsync(`${baseId}.aliases.meta.manifest`),
                        this.options.owner.getForeignObjectsAsync(`${baseId}.aliases.v1.*`, 'state'),
                    ]), budget);
                    const raw = record(state) && state.ack === true ? state.val : undefined;
                    if (typeof raw !== 'string' || Buffer.byteLength(raw) > MAX_MANIFEST_BYTES) {
                        row.discoveryCode = 'EOS_EMS_ALIASES_PENDING';
                        continue;
                    }
                    /** @type {unknown} */
                    const manifest = JSON.parse(raw);
                    if (!record(manifest) || manifest.schemaVersion !== 1 || manifest.namespace !== 'v1' || manifest.standardPath !== 'aliases.v1'
                        || manifest.templateId !== device.templateId || typeof manifest.deviceClass !== 'string' || !CLASSES.has(manifest.deviceClass)
                        || !Array.isArray(manifest.capabilities) || manifest.capabilities.length > MAX_ALIASES
                        || !manifest.capabilities.every(cap => typeof cap === 'string' && /^[a-zA-Z0-9_.-]{1,160}$/.test(cap))) {
                        row.discoveryCode = 'EOS_EMS_ALIAS_CONTRACT_INVALID';
                        continue;
                    }
                    if (!record(objects) || Object.keys(objects).length > MAX_ALIASES) {
                        row.discoveryCode = 'EOS_EMS_ALIAS_INVENTORY_LIMIT';
                        continue;
                    }
                    row.deviceClass = manifest.deviceClass;
                    row.category = text(manifest.category, 40);
                    row.capabilities = manifest.capabilities;
                    row.missingRequired = Array.isArray(manifest.missingRequired) ? manifest.missingRequired.filter(value => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,160}$/.test(value)).slice(0, MAX_ALIASES) : [];
                    const capabilities = new Set(row.capabilities);
                    const prefix = `${baseId}.aliases.v1.`;
                    for (const [id, object] of Object.entries(objects)) {
                        if (!id.startsWith(prefix) || !record(object) || object._id !== id || object.type !== 'state' || !record(object.common) || !record(object.native))
                            continue;
                        const key = id.slice(prefix.length);
                        const common = object.common;
                        const native = object.native;
                        if (!safeId(key) || native.isAlias !== true || native.aliasContractVersion !== 1 || native.aliasContractPath !== key
                            || native.deviceId !== device.id || native.templateId !== device.templateId || native.deviceClass !== manifest.deviceClass
                            || typeof native.capability !== 'string' || !capabilities.has(native.capability)
                            || !['number', 'boolean', 'string'].includes(String(common.type)))
                            continue;
                        const target = safeId(native.writeDpId) ? native.writeDpId : safeId(native.dpId) ? native.dpId : '';
                        row.aliases[key] = id;
                        row.aliasMeta[key] = { id, exists: true, read: common.read !== false, write: common.write === true,
                            type: String(common.type), unit: text(common.unit, 30), role: text(common.role, 80),
                            ...(target ? { targetId: `${baseId}.${target}` } : {}) };
                    }
                    // Two bounded reads only, within the existing inventory
                    // deadline. A template's optional register is not evidence
                    // of a supported dynamic hardware power limit.
                    await Promise.all(['r.allowedChargePower', 'r.allowedDischargePower'].map(async (key) => {
                        const metadata = key === 'r.allowedChargePower' ? row.aliasMeta['r.allowedChargePower'] : row.aliasMeta['r.allowedDischargePower'];
                        if (!metadata || !metadata.read || metadata.type !== 'number' || metadata.unit !== 'W')
                            return;
                        let proven = false;
                        try {
                            const remaining = Math.min(1000, deadline - Date.now());
                            if (remaining <= 0)
                                throw fail('EOS_EMS_DISCOVERY_TIMEOUT');
                            const observation = await readDeadline(this.options.owner.getForeignStateAsync(metadata.id), remaining);
                            const now = Date.now();
                            proven = record(observation) && observation.ack === true && (observation.q === undefined || observation.q === 0)
                                && typeof observation.val === 'number' && Number.isFinite(observation.val) && observation.val >= 0 && observation.val <= 1000000000
                                && typeof observation.ts === 'number' && Number.isFinite(observation.ts) && observation.ts <= now + 1000 && now - observation.ts <= 30000;
                            if (proven && record(observation) && typeof observation.ts === 'number') {
                                const previous = this.powerCapabilitySamples.get(metadata.id);
                                const ts = observation.ts;
                                // Prove the effective source cadence, including
                                // template/device overrides, without guessing
                                // it from one cached sample or creating a timer.
                                const qualified = !!previous && (ts === previous.ts ? previous.qualified : ts > previous.ts && ts - previous.ts <= 10000);
                                if (previous || this.powerCapabilitySamples.size < MAX_DEVICES * 2)
                                    this.powerCapabilitySamples.set(metadata.id, { ts, qualified });
                                proven = qualified;
                            }
                        }
                        catch { /* Unsupported/missing optional register: no automatic binding. */ }
                        metadata.powerCapabilityValidated = proven;
                        if (!proven)
                            row.optionalPowerCapabilityPending = true;
                    }));
                    if (!Object.keys(row.aliasMeta).length)
                        row.discoveryCode = 'EOS_EMS_ALIASES_PENDING';
                }
                catch {
                    row.discoveryCode = 'EOS_EMS_DISCOVERY_UNAVAILABLE';
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(4, snapshot.devices.length) }, worker));
        return result;
    }
    /** Deterministic flush also used by integration tests. Writes remain owned by
     * the runtime's configuration queue; this layer never retries uncertain writes.
     * @returns {Promise<void>} */
    async flush() {
        if (this.stopped)
            return;
        clearTimeout(this.timer || undefined);
        this.timer = null;
        if (this.pending) {
            this.dirty = true;
            return this.pending;
        }
        this.dirty = false;
        const sequence = this.sequence;
        this.pending = (async () => {
            try {
                const snapshot = this.options.getSnapshot();
                if (!snapshot.ready || !this.options.canRun())
                    throw fail('EOS_EMS_RUNTIME_PENDING');
                const devices = await this.inventory(snapshot);
                if (this.stopped || sequence !== this.sequence || snapshot.generation !== this.options.getSnapshot().generation || !this.options.canRun())
                    throw fail('EOS_EMS_CONFIGURATION_CHANGED');
                const result = await this.options.apply(devices);
                if (this.stopped || sequence !== this.sequence)
                    return;
                if (!record(result) || !Array.isArray(result.statuses) || result.statuses.length > MAX_DEVICES)
                    throw fail('EOS_EMS_RESULT_INVALID');
                // Result comes from the pure planner, nevertheless retain only its public contract.
                const statuses = result.statuses.map(value => {
                    const row = record(value) ? value : {};
                    const deviceId = text(row.deviceId || row.devId, 160);
                    return { deviceId, devId: deviceId, baseId: text(row.baseId, 512), status: text(row.status, 40), code: text(row.code, 100),
                        target: text(row.target, 100), mappedFields: Array.isArray(row.mappedFields) ? row.mappedFields.filter(x => typeof x === 'string').slice(0, MAX_ALIASES) : [],
                        missing: Array.isArray(row.missing) ? row.missing.filter(x => typeof x === 'string').slice(0, MAX_ALIASES) : [],
                        optionalMissing: Array.isArray(row.optionalMissing) ? row.optionalMissing.filter(x => text(x, 160)).slice(0, MAX_ALIASES) : [],
                        corrections: Array.isArray(row.corrections) ? row.corrections.filter(x => typeof x === 'string' && /^[A-Z][A-Z0-9_]{1,99}$/.test(x)).slice(0, 32) : [],
                        ...(typeof row.activationRequestId === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{15,127}$/.test(row.activationRequestId)
                            ? { activationRequestId: row.activationRequestId, activationApplied: row.activationApplied === true } : {}) };
                });
                const pending = statuses.some(row => row.status === 'pending');
                const conflict = statuses.some(row => row.status === 'conflict');
                this.current = { state: conflict ? 'error' : pending ? 'pending' : 'ready',
                    code: conflict ? 'EOS_EMS_ASSIGNMENT_CONFLICT' : pending ? 'EOS_EMS_ALIASES_PENDING' : '', updatedAt: Date.now(), statuses };
                this.lastReportedCode = '';
                if ((pending || devices.some(row => row.optionalPowerCapabilityPending === true)) && this.retry < RETRIES.length)
                    this.dirty = true;
            }
            catch (error) {
                const code = error instanceof Error && /^[A-Z][A-Z0-9_]{1,99}$/.test(error.message) ? error.message : 'EOS_EMS_ASSIGNMENT_FAILED';
                // These two post-persistence failures are safe to retry: the
                // runtime retains its pending-apply marker and consumed intent,
                // and drains the old engine before creating its replacement.
                // An unknown/uncertain persistence failure is never replayed.
                const transient = /PENDING|STARTING|NOT_READY|BUSY|CHANGED|UNAVAILABLE/.test(code)
                    || code === 'EOS_EMS_APPLY_FAILED' || code === 'EOS_EMS_CONFIG_WAIT_TIMEOUT';
                if (!this.stopped) {
                    this.current = { state: transient ? 'pending' : 'error', code, updatedAt: Date.now(),
                        statuses: blockedStatuses(this.options.getSnapshot(), code) };
                    if (code !== this.lastReportedCode) {
                        this.lastReportedCode = code;
                        this.options.report?.(code);
                    }
                }
                if (transient && this.retry < RETRIES.length)
                    this.dirty = true;
            }
        })().finally(() => {
            this.pending = null;
            if (!this.stopped && this.dirty)
                this.schedule(RETRIES[this.retry++] || 30000);
        });
        await this.pending;
    }
    /** No pending database request may start a later configuration write. */
    async stop() {
        this.stopped = true;
        this.sequence++;
        this.powerCapabilitySamples.clear();
        clearTimeout(this.timer || undefined);
        this.timer = null;
        this.current = { ...this.current, state: 'stopped', code: 'EOS_EMS_STOPPED' };
        await this.pending;
    }
}
module.exports = { EosDeviceEmsService, resolveDeviceEmsTargets, projectDeviceEmsConfig };
//# sourceMappingURL=eosDeviceEmsService.js.map