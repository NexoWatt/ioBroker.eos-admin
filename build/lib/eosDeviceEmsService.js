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
/** @param {unknown} value @returns {value is RecordValue} */
function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
/** @param {string} code */
function fail(code) { return Object.assign(new Error(code), { code }); }
/** @param {unknown} value @param {number} [max] @returns {string} */
function text(value, max = 160) { return typeof value === 'string' && value.length <= max && ![...value].some(character => character.charCodeAt(0) < 32) ? value : ''; }
/** @param {unknown} value @returns {value is string} */
function safeId(value) { return typeof value === 'string' && /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,159}$/.test(value) && !value.split('.').some(part => !part || ['__proto__', 'prototype', 'constructor'].includes(part)); }
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
    return result;
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
 * @returns {Promise<{readTargets: Record<string,string>, writeTargets: Record<string,string>}>} */
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
    for (const device of options.devices)
        for (const metadata of Object.values(device.aliasMeta || {})) {
            if (!valid(metadata.id))
                continue;
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
    /** @param {string} id @param {'read'|'write'} mode @returns {Promise<string>} */
    const resolve = async (id, mode) => {
        const visited = new Set();
        for (let depth = 0; depth < 8; depth++) {
            guard();
            if (known.has(id))
                return known.get(id);
            if (visited.has(id))
                throw fail('EOS_EMS_TARGET_ALIAS_PENDING');
            visited.add(id);
            const object = await read(id);
            // A missing former leaf cannot currently send commands. Keep its
            // exact identity; do not invent another target or delete its mapping.
            if (object === null || object === undefined)
                return id;
            if (!record(object) || object._id !== id || object.type !== 'state' || !record(object.common))
                throw fail('EOS_EMS_TARGET_ALIAS_PENDING');
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
    return { readTargets, writeTargets };
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
            this.current = { state: 'pending', code: 'EOS_EMS_CONFIGURATION_PENDING', updatedAt: Date.now(), statuses: this.current.statuses };
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
                    enabled: snapshot.moduleEnabled && device.enabled !== false, templateId: text(device.templateId),
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
                        optionalMissing: Array.isArray(row.optionalMissing) ? row.optionalMissing.filter(x => text(x, 160)).slice(0, MAX_ALIASES) : [] };
                });
                const pending = statuses.some(row => row.status === 'pending');
                const conflict = statuses.some(row => row.status === 'conflict');
                this.current = { state: conflict ? 'error' : pending ? 'pending' : 'ready',
                    code: conflict ? 'EOS_EMS_ASSIGNMENT_CONFLICT' : pending ? 'EOS_EMS_ALIASES_PENDING' : '', updatedAt: Date.now(), statuses };
                if (pending && this.retry < RETRIES.length)
                    this.dirty = true;
            }
            catch (error) {
                const code = error instanceof Error && /^[A-Z][A-Z0-9_]{1,99}$/.test(error.message) ? error.message : 'EOS_EMS_ASSIGNMENT_FAILED';
                const transient = /PENDING|STARTING|NOT_READY|BUSY|CHANGED|UNAVAILABLE/.test(code);
                if (!this.stopped)
                    this.current = { state: transient ? 'pending' : 'error', code, updatedAt: Date.now(), statuses: this.current.statuses };
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
        clearTimeout(this.timer || undefined);
        this.timer = null;
        this.current = { ...this.current, state: 'stopped', code: 'EOS_EMS_STOPPED' };
        await this.pending;
    }
}
module.exports = { EosDeviceEmsService, resolveDeviceEmsTargets };
//# sourceMappingURL=eosDeviceEmsService.js.map