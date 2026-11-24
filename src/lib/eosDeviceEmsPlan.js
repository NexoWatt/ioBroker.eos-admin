/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
// @ts-check
'use strict';

/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Plant passende EMS-Zuordnungen aus geprüften Geräte-Aliasdaten.
 * Daten und Wirkung: Arbeitet nur mit Kopien der Konfiguration; führt keine Datenbank- oder Geräteschreibzugriffe aus.
 * Bei Änderungen: Wiederholtes Speichern, Neustart, manuelle Zuordnungen, Lizenz-/Eigentumsentzug und begrenzte Fehlerpfade prüfen.
 */

/**
 * Deterministic commissioning plan for verified device inventories. This module
 * never accesses the controller or writes device states. Explicit one-shot
 * commissioning intents may enable validated rows/apps in the returned plan.
 * Its output must pass the normal versioned configuration save.
 * Existing non-empty installer assignments are authoritative.
 * @typedef {import('./eosDeviceEmsPlan').Json} Json
 * @typedef {{[key: string]: Json}} Dict
 * @typedef {{id: string, type: string, unit: string, read: boolean, write: boolean, targetId: string}} Alias
 * @typedef {{baseId: string, devId: string, name: string, templateId: string, protocol: string, deviceClass: string, enabled: boolean, aliases: Map<string, Alias>, ems: Dict, discoveryCode: string}} Device
 * @typedef {{baseId: string, devId: string, status: string, code: string, target: string, mappedFields: string[], missing: string[], optionalMissing: string[], activationRequestId: string, activationApplied: boolean, corrections:string[]}} Status
 */

const MODES = new Set(['auto', 'monitor', 'manual', 'singleStorage', 'storageFarm', 'gridMeter', 'generationMeter', 'consumptionMeter', 'pvInverter']);
const STORAGE_CLASSES = new Set(['storageSystem', 'battery', 'batteryInverter']);
const MAX_DEVICES = 256;
const MAX_CONFIG_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 100;
const { Buffer } = require('node:buffer');
const { createHash } = require('node:crypto');

/** @param {unknown} value @returns {value is Dict} */
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) &&
        [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
/** @param {unknown} value @returns {Dict} */
function record(value) { return isRecord(value) ? value : {}; }
/** @param {unknown} value @returns {string} */
function text(value) { return typeof value === 'string' ? value.trim() : ''; }
/** @param {unknown} value @returns {boolean} */
function empty(value) { return value === undefined || value === null || value === ''; }
/** @param {string} code @returns {Error & {code: string}} */
function fail(code) { return Object.assign(new Error(code), { code }); }

/** Reject malformed/hostile config, rather than substituting an empty config. @param {unknown} value @returns {Dict} */
function copyConfig(value) {
    if (!isRecord(value)) throw fail('EOS_EMS_PLAN_CONFIG_INVALID');
    let nodes = 0;
    /** @param {unknown} item @param {number} depth */
    const visit = (item, depth) => {
        if (++nodes > 100000 || depth > 24) throw fail('EOS_EMS_PLAN_CONFIG_SIZE');
        if (item === null || typeof item === 'boolean' || typeof item === 'string') return;
        if (typeof item === 'number' && Number.isFinite(item)) return;
        if (Array.isArray(item)) { for (const child of item) visit(child, depth + 1); return; }
        if (!isRecord(item)) throw fail('EOS_EMS_PLAN_CONFIG_INVALID');
        for (const [key, child] of Object.entries(item)) {
            if (['__proto__', 'constructor', 'prototype'].includes(key)) throw fail('EOS_EMS_PLAN_CONFIG_KEY');
            visit(child, depth + 1);
        }
    };
    visit(value, 0);
    const serialized = JSON.stringify(value);
    if (Buffer.byteLength(serialized) > MAX_CONFIG_BYTES) throw fail('EOS_EMS_PLAN_CONFIG_SIZE');
    return /** @type {Dict} */ (JSON.parse(serialized));
}

/** @param {Dict} parent @param {string} key @returns {Dict} */
function section(parent, key) {
    if (!empty(parent[key]) && !isRecord(parent[key])) throw fail('EOS_EMS_PLAN_SECTION_INVALID');
    if (!isRecord(parent[key])) parent[key] = {};
    return /** @type {Dict} */ (parent[key]);
}
/** @param {Dict} parent @param {string} key @param {number} [max] @returns {Dict[]} */
function rows(parent, key, max = MAX_ROWS) {
    if (parent[key] === undefined) parent[key] = [];
    const value = parent[key];
    if (!Array.isArray(value) || value.length > max || value.some(row => !isRecord(row))) throw fail('EOS_EMS_PLAN_ROWS_INVALID');
    return /** @type {Dict[]} */ (value);
}

/** Only actual Alias V1 objects verified by the caller are accepted. @param {unknown} raw @returns {Device} */
function device(raw) {
    const row = record(raw);
    const baseId = text(row.baseId);
    const devId = text(row.devId || row.deviceId);
    if (!/^(?:eos-admin|nexowatt-devices)\.\d+\.devices\.[A-Za-z0-9_.-]+$/.test(baseId) || baseId.length > 450 ||
        !devId || devId.length > 128 || !baseId.endsWith(`.devices.${devId}`)) throw fail('EOS_EMS_PLAN_DEVICE_INVALID');
    const ems = record(row.ems);
    if (ems.mode !== undefined && !MODES.has(text(ems.mode))) throw fail('EOS_EMS_PLAN_INTENT_INVALID');
    if (ems.scope !== undefined && !['M0', 'M1'].includes(text(ems.scope))) throw fail('EOS_EMS_PLAN_INTENT_INVALID');
    if (ems.flowSlot !== undefined && (!Number.isInteger(ems.flowSlot) || Number(ems.flowSlot) < 0 || Number(ems.flowSlot) > 10)) {
        throw fail('EOS_EMS_PLAN_INTENT_INVALID');
    }
    if (ems.activation !== undefined) {
        const activation = record(ems.activation);
        if (typeof activation.requested !== 'boolean' || !/^[A-Za-z0-9][A-Za-z0-9_-]{15,127}$/.test(text(activation.requestId))) {
            throw fail('EOS_EMS_PLAN_ACTIVATION_INVALID');
        }
        if (activation.limits !== undefined && !isRecord(activation.limits)) throw fail('EOS_EMS_PLAN_ACTIVATION_INVALID');
        const numericLimits = new Set(['maxChargeW', 'maxDischargeW', 'capacityKWh', 'minCurrentA', 'maxCurrentA', 'minPowerW', 'maxPowerW']);
        for (const [key, value] of Object.entries(record(activation.limits))) {
            if (numericLimits.has(key)) {
                if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1000000000) throw fail('EOS_EMS_PLAN_ACTIVATION_INVALID');
            } else if (key === 'coupling' || key === 'chargerType') {
                if (value !== 'ac' && value !== 'dc') throw fail('EOS_EMS_PLAN_ACTIVATION_INVALID');
            } else if (key === 'phases') {
                if (value !== 1 && value !== 3) throw fail('EOS_EMS_PLAN_ACTIVATION_INVALID');
            } else throw fail('EOS_EMS_PLAN_ACTIVATION_INVALID');
        }
    }
    const aliases = new Map();
    const metadata = record(row.aliasMeta);
    if (Object.keys(metadata).length > 512) throw fail('EOS_EMS_PLAN_ALIAS_LIMIT');
    for (const [key, item] of Object.entries(metadata)) {
        const meta = record(item);
        const id = text(meta.id);
        if (!/^(?:r|ctrl|comm|alarm)\.[A-Za-z0-9_.]+$/.test(key) || id !== `${baseId}.aliases.v1.${key}`) continue;
        if (!['number', 'boolean', 'string'].includes(text(meta.type))) continue;
        const target = text(meta.targetId);
        if (target.length > 512 || [...target].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) continue;
        aliases.set(key, { id, type: text(meta.type), unit: text(meta.unit), read: meta.read !== false,
            write: meta.write === true, targetId: target || id });
    }
    return { baseId, devId, name: text(row.name).slice(0, 128) || devId, templateId: text(row.templateId), protocol: text(row.protocol), deviceClass: text(row.deviceClass),
        enabled: row.enabled !== false, aliases, ems, discoveryCode: text(row.discoveryCode) };
}

/** @param {Device} dev @param {string[]} keys @param {boolean} [write] @param {string[]} [types] @param {string[]} [units] @returns {string} */
function alias(dev, keys, write = false, types = ['number'], units = []) {
    for (const key of keys) {
        const meta = dev.aliases.get(key);
        if (!meta || (write ? !meta.write : !meta.read) || !types.includes(meta.type)) continue;
        if (units.length && !units.includes(meta.unit)) continue;
        return meta.id;
    }
    return '';
}

/** @param {Device} dev @param {string} mode @returns {Dict} */
function identity(dev, mode) { return { v: 1, baseId: dev.baseId, devId: dev.devId, mode }; }
/** @param {Dict} row @param {Device} dev @returns {boolean} */
function belongs(row, dev) {
    const owner = record(row._eosDevice);
    if (owner.v === 1) return owner.baseId === dev.baseId;
    return Object.entries(row).some(([key, value]) => /(?:Id|ObjectId)$/.test(key) &&
        typeof value === 'string' && value.startsWith(`${dev.baseId}.`));
}
/** @param {Dict} row @param {string} key @param {Json|undefined} value @param {Status} result */
function fill(row, key, value, result) {
    if (value === undefined || value === '' || !empty(row[key])) return;
    row[key] = value;
    result.mappedFields.push(key);
}
/** @param {Device} dev @returns {Status} */
function status(dev) { return { baseId: dev.baseId, devId: dev.devId, status: 'pending', code: 'ALIASES_PENDING', target: '', mappedFields: [], missing: [], optionalMissing: [], activationRequestId: text(record(dev.ems.activation).requestId), activationApplied: false, corrections: [] }; }

/** An entered power value is not an object ID. Keep it for correction, never resolve it as a DP. @param {unknown} value */
function numericReference(value) { return typeof value === 'number' || (typeof value === 'string' && /^[+-]?\d+(?:[.,]\d+)?$/.test(value.trim())); }

/** Only bounded configuration reference strings, never secrets or values, enter conflict detection. @param {unknown} value @returns {string[]} */
function mappedIds(value) {
    const found = new Set();
    let visited = 0;
    /** @param {unknown} item @param {number} depth */
    const walk = (item, depth) => {
        if (!item || typeof item !== 'object' || depth > 12 || ++visited > 20000) return;
        for (const [key, child] of Object.entries(item)) {
            if (key === '_eosDevice' || key === 'eosDeviceEms') continue;
            if (/(?:Id|ObjectId)$/.test(key) && typeof child === 'string' && child.length <= 512 && child && !numericReference(child)) found.add(child);
            else if (child && typeof child === 'object') walk(child, depth + 1);
        }
    };
    walk(value, 0);
    return [...found];
}

/**
 * Exact references needed to resolve ioBroker aliases before planning. Only
 * relevant EMS sections are scanned; the caller never needs an object dump.
 * A split native alias is resolved separately for read and write directions.
 * @param {unknown} value
 * @returns {{read: string[], write: string[]}}
 */
function getDeviceEmsReferences(value) {
    const config = copyConfig(value);
    const read = new Set(); const write = new Set();
    const writeKey = /(?:write|^set|^target|^output(?:Object)?Id$|^(?:pv)?feedInLimit|^pvLimit|^runObjectId$|^maxChargeObjectId$|^maxDischargeObjectId$|^phaseSwitchId$|^chargeEnableObjectId$|^dischargeEnableObjectId$|^feneconGridSetpoint|^e3dcSetPower|^enableId$)/i;
    /** @param {unknown} item @param {number} depth */
    const walk = (item, depth) => {
        if (!item || typeof item !== 'object' || depth > 12) return;
        for (const [key, child] of Object.entries(item)) {
            if (key === '_eosDevice' || key === 'eosDeviceEms') continue;
            if (/(?:Id|ObjectId)$/.test(key) && typeof child === 'string' && child.length <= 512 && child && !numericReference(child)) {
                (writeKey.test(key) ? write : read).add(child);
            } else if (child && typeof child === 'object') walk(child, depth + 1);
        }
    };
    for (const item of [record(config.settingsConfig).evcsList, config.storage, config.storageFarm,
        config.gridConstraints, config.thermalControl, config.thermal, config.vis, config.heatingRod, config.threshold,
        config.generator, config.bhkw, config.dynamicGridConnection]) walk(item, 0);
    for (const [key, id] of Object.entries(record(config.datapoints))) {
        if (/^(?:pvPower|producer\d+Power|consumer\d+Power|gridPointPower|consumptionEvcs|batteryPower|storageSoc)$/.test(key) && typeof id === 'string' && id.length <= 512 && id) read.add(id);
    }
    if (read.size + write.size > 1024) throw fail('EOS_EMS_PLAN_REFERENCE_LIMIT');
    return { read: [...read].sort(), write: [...write].sort() };
}

/**
 * @param {{config: unknown, devices: unknown, limits?: {chargePoints?: unknown, batteries?: unknown}, writeTargets?: Record<string,string>, readTargets?: Record<string,string>, referenceMeta?: Record<string,{type?:unknown,unit?:unknown,read?:unknown,write?:unknown}>, allowedApps?:string[]}} input
 * @returns {{config: Dict, patch: Dict, changed: boolean, statuses: Status[]}}
 */
function planDeviceEms(input) {
    const before = copyConfig(input.config);
    const config = copyConfig(before);
    if (!Array.isArray(input.devices) || input.devices.length > MAX_DEVICES) throw fail('EOS_EMS_PLAN_DEVICE_LIMIT');
    const devices = input.devices.map(device).sort((a, b) => a.baseId.localeCompare(b.baseId, 'en'));
    if (new Set(devices.map(dev => dev.baseId)).size !== devices.length) throw fail('EOS_EMS_PLAN_DEVICE_DUPLICATE');
    const canonical = new Map(Object.entries(input.writeTargets || {}).filter(([id, target]) =>
        typeof id === 'string' && id.length <= 512 && typeof target === 'string' && target.length <= 512));
    const canonicalRead = new Map(Object.entries(input.readTargets || {}).filter(([id, target]) =>
        typeof id === 'string' && id.length <= 512 && typeof target === 'string' && target.length <= 512));
    for (const dev of devices) for (const meta of dev.aliases.values()) canonical.set(meta.id, meta.targetId);
    for (const dev of devices) for (const meta of dev.aliases.values()) if (meta.read) canonicalRead.set(meta.id, meta.targetId);
    /** @param {string} id */
    const targetOf = id => canonical.get(id) || id;
    /** @param {string} id */
    const readTargetOf = id => canonicalRead.get(id) || id;
    /** @param {unknown} value @param {number} hard */
    const limit = (value, hard) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? Math.min(value, hard) : 0;
    const evLimit = limit(input.limits?.chargePoints, 50);
    const storageLimit = limit(input.limits?.batteries, MAX_ROWS);
    /** @type {Status[]} */
    const statuses = [];
    /** Existing live rows are restored if explicit commissioning cannot complete. @type {Map<string, Dict>} */
    const activeOriginals = new Map();

    /** @param {Device} dev @returns {Dict} */
    const binding = dev => record(record(record(config.eosDeviceEms).bindings)[dev.baseId]);
    /** @param {Device} dev */
    const explicitApply = dev => record(dev.ems.activation).requested === true &&
        text(record(dev.ems.activation).requestId) !== text(binding(dev).activationRequestId);
    /** @param {Device} dev */
    const requestFingerprint = dev => {
        const activation = record(dev.ems.activation); const bounds = record(activation.limits);
        return createHash('sha256').update(JSON.stringify({ requested: activation.requested, mode: dev.ems.mode || 'auto',
            scope: dev.ems.scope || '', flowSlot: dev.ems.flowSlot ?? null, templateId: dev.templateId, protocol: dev.protocol, deviceClass: dev.deviceClass,
            limits: Object.fromEntries(Object.keys(bounds).sort().map(key => [key, bounds[key]])) })).digest('hex');
    };
    /** @param {string} id @param {Device} dev */
    const belongsReference = (id, dev) => id.startsWith(`${dev.baseId}.`) || [...dev.aliases.values()].some(meta =>
        meta.read && readTargetOf(id) === readTargetOf(meta.id) || meta.write && targetOf(id) === targetOf(meta.id));
    /** Only identity-bearing measurement/command fields may adopt a legacy row. @param {Dict} row @returns {string[]} */
    const primaryIds = row => Object.entries(row).flatMap(([key, value]) => {
        if (key === 'datapoints' && isRecord(value)) return primaryIds(value);
        return /^(?:socId|socObjectId|signedPowerId|batteryPowerObjectId|powerId|energyTotalId|chargePowerId|dischargePowerId|setSignedPowerId|setChargePowerId|setDischargePowerId|targetPowerObjectId|targetChargePowerObjectId|targetDischargePowerObjectId|setCurrentAId|setPowerWId|feneconEssActualPowerId|feneconEssActualPowerObjectId)$/.test(key)
            && typeof value === 'string' && value && !numericReference(value) ? [value] : [];
    });
    /** @param {Dict} row @param {Device} dev */
    const belongsDevice = (row, dev) => record(row._eosDevice).v === 1 ? record(row._eosDevice).baseId === dev.baseId
        : belongs(row, dev) || explicitApply(dev) && primaryIds(row).some(id => belongsReference(id, dev));
    /** @param {Dict} row @param {Device} dev */
    const mixedIdentity = (row, dev) => primaryIds(row).some(id => !belongsReference(id, dev));

    /** @param {Dict} row @param {Device} dev @param {string} mode @param {string} target */
    const remember = (row, dev, mode, target) => {
        if (!row._eosDevice) row._eosDevice = identity(dev, mode);
        const registry = section(config, 'eosDeviceEms');
        if (registry.v !== undefined && registry.v !== 1) throw fail('EOS_EMS_PLAN_BINDING_VERSION');
        registry.v = 1;
        const bindings = section(registry, 'bindings');
        const next = { target, mode, ...(dev.ems.scope ? { scope: dev.ems.scope } : {}),
            ...(dev.ems.flowSlot !== undefined ? { flowSlot: dev.ems.flowSlot } : {}) };
        bindings[dev.baseId] = { ...record(bindings[dev.baseId]), ...next };
    };
    /** @param {Device} dev @param {Dict} candidate @param {unknown[]} competing @returns {boolean} */
    const conflict = (dev, candidate, competing) => {
        const writes = new Set([...dev.aliases.values()].filter(meta => meta.write).map(meta => targetOf(meta.id)));
        const candidateWrites = mappedIds(candidate).map(targetOf).filter(id => writes.has(id));
        return competing.some(other => mappedIds(other).some(id => candidateWrites.includes(targetOf(id))));
    };
    /** @param {Device} dev @param {Status} result */
    const ev = (dev, result) => {
        const settings = section(config, 'settingsConfig');
        const list = rows(settings, 'evcsList', 50);
        const found = list.filter(row => belongsDevice(row, dev));
        if (found.length > 1) { result.status = 'conflict'; result.code = 'DUPLICATE_DEVICE_MAPPING'; return; }
        if (found.length && mixedIdentity(found[0], dev)) {
            result.status = 'conflict'; result.code = 'MIXED_MANUAL_MAPPING'; return;
        }
        if (!found.length && list.length >= evLimit) { result.status = 'conflict'; result.code = 'LICENSE_LIMIT'; return; }
        const row = found[0] || { enabled: false };
        if (found.length && row.enabled !== false && explicitApply(dev)) activeOriginals.set(dev.baseId, copyConfig(row));
        const next = copyConfig(row);
        fill(next, 'name', dev.name, result);
        const fields = {
            powerId: alias(dev, ['r.power'], false, ['number'], ['W']),
            energyTotalId: alias(dev, ['r.energyTotal'], false, ['number'], ['Wh', 'kWh']),
            statusId: alias(dev, ['r.mode3State', 'r.mode3Code', 'r.evState', 'r.statusText', 'r.statusCode'], false, ['string', 'number']),
            vehicleConnectedId: alias(dev, ['r.vehicleConnected'], false, ['boolean']),
            chargeDemandId: alias(dev, ['r.chargeDemand', 'r.vehicleDemand', 'r.readyToCharge', 'r.chargingRequested'], false, ['boolean']),
            heartbeatId: alias(dev, ['r.heartbeat', 'r.lastSeenMs']),
            onlineId: alias(dev, ['r.online', 'comm.connected'], false, ['boolean']),
            setCurrentAId: alias(dev, ['ctrl.targetCurrentA', 'ctrl.currentLimitA', 'ctrl.setCurrentA'], true, ['number'], ['A']),
            setPowerWId: alias(dev, ['ctrl.targetPowerW', 'ctrl.powerLimitW', 'ctrl.setPowerW'], true, ['number'], ['W']),
            enableWriteId: alias(dev, ['ctrl.run', 'ctrl.enable', 'ctrl.enabled'], true, ['boolean']),
        };
        if (!Object.values(fields).some(Boolean)) { result.code = 'ALIASES_PENDING'; return; }
        for (const [key, value] of Object.entries(fields)) fill(next, key, value, result);
        if (fields.energyTotalId && empty(row.energyTotalId)) {
            const meta = [...dev.aliases.values()].find(item => item.id === fields.energyTotalId);
            fill(next, 'energyTotalInputIsWh', meta?.unit === 'Wh', result);
        }
        if (conflict(dev, next, [list.filter(item => item !== row), config.storage, config.storageFarm, config.gridConstraints,
            config.thermalControl, config.thermal, config.vis, config.heatingRod, config.threshold, config.generator, config.bhkw])) {
            result.status = 'conflict'; result.code = 'CONTROL_TARGET_ALREADY_ASSIGNED'; result.mappedFields = []; return;
        }
        if (!next.powerId) result.missing.push('powerId');
        if (!next.setCurrentAId && !next.setPowerWId) result.missing.push('setCurrentAId|setPowerWId');
        if (!next.onlineId && !next.heartbeatId) result.missing.push('onlineId|heartbeatId');
        remember(next, dev, 'auto', 'evcs');
        if (found.length) list[list.indexOf(row)] = next; else list.push(next);
        const count = settings.evcsCount;
        if (count !== undefined && (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 || count > 50)) {
            throw fail('EOS_EMS_PLAN_EVCS_COUNT_INVALID');
        }
        settings.evcsCount = Math.max(typeof count === 'number' ? count : 0, list.length);
        result.target = 'settingsConfig.evcsList'; result.status = 'mapped';
        result.code = result.missing.length ? 'MAPPING_INCOMPLETE' : next.enabled === false ? 'COMMISSIONING_REQUIRED' : 'MAPPED';
    };

    /** @param {Device} dev @param {Status} result @param {boolean} farm */
    const storage = (dev, result, farm) => {
        if (dev.ems.scope === 'M1') { result.code = 'MANUAL_TOPOLOGY_REQUIRED'; return; }
        const single = record(config.storage);
        const farmConfig = record(config.storageFarm);
        const farmRows = Array.isArray(farmConfig.storages) ? farmConfig.storages.filter(isRecord) : [];
        const singleAssigned = mappedIds(single).some(Boolean);
        const existingSameSingle = belongsDevice(single, dev);
        const existingSameFarm = farmRows.filter(row => belongsDevice(row, dev));
        if ((farm && existingSameSingle) || (!farm && existingSameFarm.length) || existingSameFarm.length > 1) {
            result.status = 'conflict'; result.code = 'STORAGE_CONTROLLER_ALREADY_ASSIGNED'; return;
        }
        if (!farm && singleAssigned && !existingSameSingle) { result.status = 'conflict'; result.code = 'MANUAL_MAPPING_PRESERVED'; return; }
        const existing = farm ? existingSameFarm[0] : existingSameSingle ? single : undefined;
        if (existing && mixedIdentity(existing, dev)) {
            result.status = 'conflict'; result.code = 'MIXED_MANUAL_MAPPING'; return;
        }
        if (!existing && farmRows.length + (singleAssigned ? 1 : 0) >= storageLimit) {
            result.status = 'conflict'; result.code = 'LICENSE_LIMIT'; return;
        }
        // A preconfigured, as-yet-unassigned single-storage section can contain
        // customer limits and vendor settings. Keep these when adding aliases.
        // A new assignment still needs commissioning even if its empty section
        // had enabled=true from an earlier installer selection.
        const row = existing ? copyConfig(existing) : farm ? { enabled: false } : { ...copyConfig(single), enabled: false };
        if (existing && existing.enabled !== false && explicitApply(dev)) activeOriginals.set(dev.baseId, copyConfig(existing));
        if (existing && !existing._eosDevice && explicitApply(dev)) result.corrections.push('LEGACY_ROW_ADOPTED');
        const destination = farm ? row : section(row, 'datapoints');
        fill(row, 'name', dev.name, result);
        const feneconHome = dev.templateId === 'ess.fenecon.FeneconHomeEssImpl';
        /** Exact known Home source; an arbitrary alias with a familiar name is not sufficient. @param {string[]} names @param {string} source @param {boolean} [write] */
        const homePower = (names, source, write = false) => {
            for (const name of names) {
                const id = alias(dev, [name], write, ['number'], ['W']);
                if (id && dev.aliases.get(name)?.targetId === `${dev.baseId}.${source}`) return id;
            }
            return '';
        };
        const homeFeedback = feneconHome ? homePower(['r.essActivePower'], 'eSS0_ACTIVE_POWER') : '';
        if (feneconHome && homeFeedback && explicitApply(dev)) {
            const old = text(destination[farm ? 'signedPowerId' : 'batteryPowerObjectId']);
            const oldActor = text(destination[farm ? 'feneconEssActualPowerId' : 'feneconEssActualPowerObjectId']);
            /** @param {string} value */
            const isWrongFeedback = value => value && (['r.power', 'r.powerAc', 'r.powerBalance'].some(key =>
                value === `${dev.baseId}.aliases.${key}` || value === `${dev.baseId}.aliases.v1.${key}`) ||
                [`${dev.baseId}.bATTERY_AC_POWER`, `${dev.baseId}.bATTERY_POWER`].includes(readTargetOf(value)));
            if (isWrongFeedback(old)) {
                destination[farm ? 'signedPowerId' : 'batteryPowerObjectId'] = homeFeedback;
                result.corrections.push('FENECON_ACTOR_FEEDBACK_CORRECTED');
            }
            if (isWrongFeedback(oldActor)) {
                destination[farm ? 'feneconEssActualPowerId' : 'feneconEssActualPowerObjectId'] = homeFeedback;
                if (!result.corrections.includes('FENECON_ACTOR_FEEDBACK_CORRECTED')) result.corrections.push('FENECON_ACTOR_FEEDBACK_CORRECTED');
            }
        }
        const keys = farm ? {
            socId: ['r.soc'], signedPowerId: feneconHome ? [] : ['r.essActivePower', 'r.powerAc', 'r.power'],
            chargePowerId: ['r.powerCharge'], dischargePowerId: ['r.powerDischarge'],
            availableId: ['r.online', 'comm.connected'], faultId: ['alarm.fault'],
            chargeAllowedId: ['r.allowCharge'], dischargeAllowedId: ['r.allowDischarge'],
        } : {
            socObjectId: ['r.soc'], batteryPowerObjectId: feneconHome ? [] : ['r.essActivePower', 'r.powerAc', 'r.power'],
        };
        for (const [key, names] of Object.entries(keys)) {
            const booleanField = ['availableId', 'faultId', 'chargeAllowedId', 'dischargeAllowedId'].includes(key);
            fill(destination, key, alias(dev, names, false, booleanField ? ['boolean'] : ['number'],
                key.startsWith('soc') ? ['%'] : booleanField ? [] : ['W']), result);
        }
        const signed = feneconHome ? homePower(['ctrl.powerSetpointW'], 'sET_ACTIVE_POWER', true)
            : alias(dev, ['ctrl.powerSetpointW'], true, ['number'], ['W']);
        const charge = alias(dev, ['ctrl.chargePowerW'], true, ['number'], ['W']);
        const discharge = alias(dev, ['ctrl.dischargePowerW'], true, ['number'], ['W']);
        const commandKeys = farm ? ['setSignedPowerId', 'setChargePowerId', 'setDischargePowerId', 'feneconGridSetpointId']
            : ['targetPowerObjectId', 'targetChargePowerObjectId', 'targetDischargePowerObjectId', 'feneconGridSetpointObjectId', 'e3dcSetPowerModeObjectId', 'e3dcSetPowerValueObjectId'];
        const hadCommand = commandKeys.some(key => !empty(destination[key]));
        if (feneconHome) {
            if (!existing || row.enabled === false || !hadCommand) {
                fill(row, 'vendorProfile', 'fenecon-openems', result);
                fill(row, 'coupling', 'dc', result);
            }
            // Detection does not switch a commissioned FEMS controller into a
            // different command family. New Home rows use the verified direct
            // ESS path; the optional native target is exposed separately.
            fill(row, 'feneconControlMode', existing && hadCommand ? 'auto' : 'direct-ess', result);
            fill(destination, farm ? 'signedPowerId' : 'batteryPowerObjectId', homeFeedback, result);
            /** @type {[string, string[], string][]} */
            const homeFields = [
                ['feneconEssActualPower', ['r.essActivePower'], 'eSS0_ACTIVE_POWER'],
                ['feneconNvpPower', ['r.nvpPower', 'r.gridPower', 'r.napPower'], 'gRID_POWER'],
                ['feneconConsumptionTotal', ['r.consumptionTotal', 'r.loadTotal', 'r.consumptionPower', 'r.loadPower'], 'lOAD_POWER'],
                ['feneconMinPower', ['r.minPowerSetpointW'], 'mIN_POWER_SETPOINT'],
                ['feneconMaxPower', ['r.maxPowerSetpointW'], 'mAX_POWER_SETPOINT'],
                ['feneconPvDc', ['r.pvPowerDc'], 'pV_DC_POWER'],
                ['feneconPvAc', ['r.pvPowerAc'], 'pV_AC_POWER'],
                ['feneconPvTotal', ['r.pvPowerTotal'], 'pV_POWER_SUM'],
            ];
            for (const field of homeFields) {
                const key = `${field[0]}${farm ? 'Id' : 'ObjectId'}`;
                fill(destination, key, homePower(field[1], field[2]), result);
                if (empty(destination[key]) && field[0] !== 'feneconEssActualPower') result.optionalMissing.push(key);
            }
            const gridKey = farm ? 'feneconGridSetpointId' : 'feneconGridSetpointObjectId';
            const nativeGrid = homePower(['ctrl.gridSetpointW', 'ctrl.napSetpointW'], 'sET_GRID_ACTIVE_POWER', true);
            const oldGrid = text(destination[gridKey]);
            if (explicitApply(dev) && oldGrid && (oldGrid === `${dev.baseId}.aliases.ctrl.powerSetpointW` ||
                oldGrid === `${dev.baseId}.aliases.v1.ctrl.powerSetpointW` || targetOf(oldGrid) === `${dev.baseId}.sET_ACTIVE_POWER`)) {
                destination[gridKey] = nativeGrid;
                result.corrections.push('FENECON_NATIVE_TARGET_CORRECTED');
            }
            const multipleFarm = farm && devices.filter(item => item.enabled && item.ems.mode === 'storageFarm').length > 1;
            if (explicitApply(dev) && signed && homeFeedback && multipleFarm && row.feneconControlMode !== 'direct-ess') {
                row.feneconControlMode = 'direct-ess';
                result.corrections.push('FENECON_DIRECT_ESS_SELECTED');
            }
            // Populate both real target references without changing an existing
            // mode: direct-ess uses 706; fems-grid uses its guarded controller.
            const directMode = row.feneconControlMode === 'direct-ess';
            if (directMode && !commandKeys.slice(0, 3).some(key => !empty(destination[key])) && signed) {
                fill(destination, commandKeys[0], signed, result);
            }
            const preserveAutoDirect = !explicitApply(dev) && existing && row.enabled !== false && empty(destination[gridKey]) &&
                !['direct-ess', 'fems-grid'].includes(text(row.feneconControlMode)) &&
                commandKeys.slice(0, 3).some(key => !empty(destination[key]));
            if (preserveAutoDirect && nativeGrid) result.missing.push(`review:${gridKey}`);
            else {
                fill(destination, gridKey, nativeGrid, result);
                if (empty(destination[gridKey])) result.optionalMissing.push(gridKey);
            }
            const readbackKey = farm ? 'feneconActualSetpointId' : 'feneconActualSetpointObjectId';
            const readback = dev.aliases.get('r.powerSetpointReadbackW');
            const actualReadback = readback && readback.read && !readback.write &&
                ![`${dev.baseId}.sET_ACTIVE_POWER`, `${dev.baseId}.sET_GRID_ACTIVE_POWER`].includes(readback.targetId)
                ? alias(dev, ['r.powerSetpointReadbackW'], false, ['number'], ['W']) : '';
            fill(destination, readbackKey, actualReadback, result);
            if (empty(destination[readbackKey])) result.optionalMissing.push(readbackKey);
            if (row.vendorProfile !== 'fenecon-openems') result.missing.push('vendorProfile:fenecon-openems');
            if (!homeFeedback && empty(destination[farm ? 'feneconEssActualPowerId' : 'feneconEssActualPowerObjectId'])) {
                result.missing.push(farm ? 'feneconEssActualPowerId' : 'feneconEssActualPowerObjectId');
            }
        }
        if (!commandKeys.some(key => !empty(destination[key]))) {
            if (signed) fill(destination, commandKeys[0], signed, result);
            else if (charge && discharge) { fill(destination, commandKeys[1], charge, result); fill(destination, commandKeys[2], discharge, result); }
        }
        if (!hadCommand && commandKeys.some(key => !empty(destination[key]))) row.enabled = false;
        if (!farm) {
            fill(destination, 'runObjectId', alias(dev, ['ctrl.run'], true, ['boolean']), result);
            fill(destination, 'maxChargeObjectId', alias(dev, ['ctrl.maxChargePowerW'], true, ['number'], ['W']), result);
            fill(destination, 'maxDischargeObjectId', alias(dev, ['ctrl.maxDischargePowerW'], true, ['number'], ['W']), result);
            fill(destination, 'chargeEnableObjectId', alias(dev, ['ctrl.chargeEnable'], true, ['boolean']), result);
            fill(destination, 'dischargeEnableObjectId', alias(dev, ['ctrl.dischargeEnable'], true, ['boolean']), result);
        }
        const dcPv = feneconHome ? homePower(['r.pvPowerDc'], 'pV_DC_POWER') : alias(dev, ['r.pvPowerDc'], false, ['number'], ['W']);
        const acPv = feneconHome ? homePower(['r.pvPowerAc'], 'pV_AC_POWER') : alias(dev, ['r.pvPowerAc'], false, ['number'], ['W']);
        if (dcPv && empty(row.coupling) && (!existing || row.enabled === false || !hadCommand)) fill(row, 'coupling', 'dc', result);
        if (row.coupling === 'dc') fill(destination, farm ? 'pvPowerId' : 'dcPvPowerObjectId', dcPv, result);
        else if (farm && row.coupling === 'ac') fill(destination, 'pvPowerId', acPv, result);
        const pvKey = farm ? 'pvPowerId' : 'dcPvPowerObjectId';
        if (explicitApply(dev) && numericReference(destination[pvKey]) && row.coupling === 'dc' && dcPv) {
            destination[pvKey] = dcPv; result.corrections.push('PV_POWER_REFERENCE_CORRECTED');
        }
        // The Home ESS actuator channel 604 is deliberately separate from the
        // physical battery/display channel 415. Never feed its DC-PV component
        // into the home's displayed battery discharge a second time.
        const batteryFlow = feneconHome ? alias(dev, ['r.powerAc', 'r.power'], false, ['number'], ['W']) : '';
        if (farm && batteryFlow) fill(row, 'batteryFlowPowerId', batteryFlow, result);
        if (!farm && batteryFlow) {
            const globalDp = section(config, 'datapoints');
            if (empty(globalDp.batteryPower)) {
                fill(globalDp, 'batteryPower', batteryFlow, result);
                section(section(config, 'settings'), 'flowPowerDpIsW').batteryPower = true;
            }
            fill(globalDp, 'storageSoc', alias(dev, ['r.soc'], false, ['number'], ['%']), result);
        }
        if (!mappedIds(destination).length) { result.code = 'ALIASES_PENDING'; result.mappedFields = []; return; }
        const competing = [farm ? [single, ...farmRows.filter(item => item !== existing)] : farmRows,
            record(config.settingsConfig).evcsList, config.gridConstraints, config.thermalControl, config.thermal, config.vis,
            config.heatingRod, config.threshold, config.generator, config.bhkw];
        if (conflict(dev, row, competing)) { result.status = 'conflict'; result.code = 'CONTROL_TARGET_ALREADY_ASSIGNED'; result.mappedFields = []; return; }
        const socKey = farm ? 'socId' : 'socObjectId';
        const powerKey = farm ? 'signedPowerId' : 'batteryPowerObjectId';
        if (!destination[socKey]) result.missing.push(socKey);
        if (!destination[powerKey]) result.missing.push(powerKey);
        const controlKeys = feneconHome && row.feneconControlMode === 'direct-ess' ? commandKeys.slice(0, 3)
            : feneconHome && row.feneconControlMode === 'fems-grid' ? [farm ? 'feneconGridSetpointId' : 'feneconGridSetpointObjectId'] : commandKeys;
        if (!controlKeys.some(key => !empty(destination[key]) && !numericReference(destination[key]))) result.missing.push('storageControl');
        for (const [key, value] of Object.entries(destination)) {
            if (/(?:Id|ObjectId)$/.test(key) && numericReference(value)) result.missing.push(`invalid:${key}`);
        }
        remember(row, dev, farm ? 'storageFarm' : 'singleStorage', farm ? 'storageFarm' : 'storage');
        if (farm) {
            const list = rows(section(config, 'storageFarm'), 'storages');
            if (existing) list[list.findIndex(item => belongsDevice(item, dev))] = row; else list.push(row);
        } else config.storage = row;
        result.target = farm ? 'storageFarm.storages' : 'storage'; result.status = 'mapped';
        result.code = result.missing.length ? 'MAPPING_INCOMPLETE' : row.enabled === false ? 'COMMISSIONING_REQUIRED' : 'MAPPED';
    };

    /** @param {Device} dev @param {Status} result @param {string} mode */
    const measurement = (dev, result, mode) => {
        const power = alias(dev, mode === 'pvInverter' ? ['r.pvPower', 'r.power'] : ['r.power'], false, ['number'], ['W']);
        if (!power) { result.code = 'ALIASES_PENDING'; result.missing.push('r.power'); return; }
        const powerKeys = /^(?:pvPower|producer\d+Power|consumer\d+Power|gridPointPower)$/;
        /** @param {string} [except] */
        const assignedFlow = except => Object.entries(record(config.datapoints)).some(([key, id]) => key !== except && powerKeys.test(key) &&
            typeof id === 'string' && readTargetOf(id) === readTargetOf(power));
        /** @param {string} [except] */
        const assignedDynamic = except => {
            const points = record(config.dynamicGridConnection).points;
            return Array.isArray(points) && points.some(point => {
                const row = record(point); const id = record(row.measurement).stateId;
                return row.id !== except && typeof id === 'string' && readTargetOf(id) === readTargetOf(power);
            });
        };
        if (mode === 'gridMeter' && dev.ems.scope === 'M1') {
            if (assignedFlow() || assignedDynamic('M1')) { result.status = 'conflict'; result.code = 'MEASUREMENT_ALREADY_ASSIGNED'; return; }
            /** @type {Dict} */
            const dynamic = config.dynamicGridConnection === undefined ? {
                schemaVersion: 1, configVersion: 1, maxSkewMs: 1000, points: [
                    { id: 'M0', source: 'general', importLimitW: null, exportLimitW: null, importReserveW: 0, exportReserveW: 0 },
                    { id: 'M1', source: 'mapped', measurement: { stateId: '', unit: 'W', sign: 1, maxAgeMs: 5000 }, importLimitW: null,
                        exportLimitW: null, importReserveW: 0, exportReserveW: 0 },
                ], storages: [], pvAssignments: [],
            } : copyConfig(config.dynamicGridConnection);
            const points = rows(dynamic, 'points', 2);
            const point = points.find(item => item.id === 'M1');
            if (!point) { result.code = 'MANUAL_TOPOLOGY_REQUIRED'; return; }
            const mapping = section(point, 'measurement');
            if (!empty(mapping.stateId) && mapping.stateId !== power) { result.status = 'conflict'; result.code = 'MANUAL_MAPPING_PRESERVED'; return; }
            fill(mapping, 'stateId', power, result); fill(mapping, 'unit', 'W', result);
            fill(mapping, 'sign', 1, result); fill(mapping, 'maxAgeMs', 5000, result);
            config.dynamicGridConnection = dynamic;
            remember(point, dev, mode, 'M1');
            result.target = 'dynamicGridConnection.points.M1.measurement'; result.status = 'mapped'; result.code = 'MEASUREMENT_MAPPED'; return;
        }
        let key = '';
        let slot = dev.ems.flowSlot;
        let kind = '';
        if (mode === 'gridMeter') {
            if (dev.ems.scope !== 'M0') { result.code = 'NEEDS_SELECTION'; result.missing.push('scope'); return; }
            key = 'gridPointPower';
        } else if (mode === 'generationMeter' || mode === 'pvInverter') {
            if (typeof slot !== 'number' || slot < 0 || slot > 5) { result.code = 'NEEDS_SELECTION'; result.missing.push('flowSlot'); return; }
            key = slot === 0 ? 'pvPower' : `producer${slot}Power`; kind = 'producers';
        } else if (mode === 'consumptionMeter') {
            if (typeof slot !== 'number' || slot < 1 || slot > 10) { result.code = 'NEEDS_SELECTION'; result.missing.push('flowSlot'); return; }
            key = `consumer${slot}Power`; kind = 'consumers';
        }
        if (!key) { result.code = 'NEEDS_SELECTION'; return; }
        const dp = section(config, 'datapoints');
        if (!empty(dp[key]) && dp[key] !== power) { result.status = 'conflict'; result.code = 'MANUAL_MAPPING_PRESERVED'; return; }
        const duplicated = assignedFlow(key) || assignedDynamic();
        if (duplicated) { result.status = 'conflict'; result.code = 'MEASUREMENT_ALREADY_ASSIGNED'; return; }
        fill(dp, key, power, result);
        // Unit flags are adjusted only together with a new assignment; a manual
        // setting on an existing target is not silently changed.
        if (result.mappedFields.includes(key)) section(section(config, 'settings'), 'flowPowerDpIsW')[key] = true;
        const fs = section(section(config, 'vis'), 'flowSlots');
        let owner = section(fs, 'core');
        if (kind && typeof slot === 'number' && slot > 0) {
            const list = rows(fs, kind, kind === 'producers' ? 5 : 10);
            while (list.length < slot) list.push({});
            owner = list[slot - 1];
            fill(owner, 'name', dev.name, result);
        } else if (key === 'pvPower') fill(owner, 'pvName', dev.name, result);
        if (mode === 'gridMeter') {
            const connected = alias(dev, ['comm.connected', 'r.online'], false, ['boolean']);
            if (explicitApply(dev) && connected && [ `${dev.baseId}.aliases.r.online`, `${dev.baseId}.aliases.v1.r.online` ].includes(text(dp.gridPointConnected)) && dp.gridPointConnected !== connected) {
                dp.gridPointConnected = connected; result.corrections.push('NVP_TRANSPORT_STATUS_SELECTED');
            }
            fill(dp, 'gridPointConnected', connected, result);
            fill(dp, 'gridPointWatchdog', alias(dev, ['r.heartbeat', 'r.lastSeenMs']), result);
        }
        remember(owner, dev, mode, key);
        result.target = `datapoints.${key}`; result.status = 'mapped'; result.code = 'MEASUREMENT_MAPPED';
    };

    // Existing auto-created control rows survive missing/deactivated devices, but
    // are held inactive. Re-adding a device never grants activation by itself.
    const activeBases = new Set(devices.filter(dev => dev.enabled && dev.ems.mode !== 'monitor').map(dev => dev.baseId));
    const disableSingleApp = () => {
        const root = section(config, 'emsApps');
        if (root.schemaVersion === undefined) root.schemaVersion = 1;
        section(section(root, 'apps'), 'storage').enabled = false;
    };
    const controlRows = [
        ...(Array.isArray(record(config.settingsConfig).evcsList) ? /** @type {Json[]} */ (record(config.settingsConfig).evcsList) : []),
        ...(Array.isArray(record(config.storageFarm).storages) ? /** @type {Json[]} */ (record(config.storageFarm).storages) : []),
        record(config.storage),
    ];
    for (const item of controlRows) {
        const row = record(item); const owner = record(row._eosDevice);
        if (owner.v === 1 && typeof owner.baseId === 'string' && !activeBases.has(owner.baseId)) {
            row.enabled = false;
            if (row === config.storage) disableSingleApp();
        }
    }

    for (const dev of devices) {
        const result = status(dev); statuses.push(result);
        const mode = text(dev.ems.mode) || 'auto';
        const previousBinding = binding(dev);
        const profileChanged = typeof previousBinding.deviceTemplateId === 'string' &&
            (previousBinding.deviceTemplateId !== dev.templateId || typeof previousBinding.deviceProtocol === 'string' && previousBinding.deviceProtocol !== dev.protocol ||
                !dev.discoveryCode && previousBinding.deviceClass !== dev.deviceClass);
        if (profileChanged) {
            // Reusing a device ID is not permission to transfer a commissioned
            // controller to another hardware profile. Preserve the assignment
            // for review, but never restore an active old-profile row on a
            // failed attempt to commission its replacement.
            let incompatibleVendor = false;
            for (const item of controlRows) {
                const row = record(item); const owner = record(row._eosDevice);
                if (owner.v === 1 && owner.baseId === dev.baseId) {
                    row.enabled = false;
                    if (row === config.storage) disableSingleApp();
                    if (row.vendorProfile === 'fenecon-openems' && dev.templateId !== 'ess.fenecon.FeneconHomeEssImpl') incompatibleVendor = true;
                }
            }
            if (!explicitApply(dev) || incompatibleVendor) {
                result.code = 'ACTIVATION_PROFILE_CHANGED'; continue;
            }
        }
        if (!dev.enabled) { result.status = 'disabled'; result.code = 'DEVICE_DISABLED'; continue; }
        if (mode === 'manual' || mode === 'monitor') { result.status = 'manual'; result.code = mode === 'manual' ? 'MANUAL_MAPPING' : 'MONITOR_ONLY'; continue; }
        if (dev.discoveryCode || !dev.aliases.size) { result.code = dev.discoveryCode || 'ALIASES_PENDING'; continue; }
        if (result.activationRequestId && binding(dev).activationRequestId === result.activationRequestId &&
            binding(dev).activationFingerprint !== requestFingerprint(dev)) {
            result.status = 'conflict'; result.code = 'ACTIVATION_REQUEST_CHANGED'; continue;
        }
        const checkpoint = copyConfig(config);
        try {
            if (dev.deviceClass === 'evCharger' && mode === 'auto') { ev(dev, result); continue; }
            if (STORAGE_CLASSES.has(dev.deviceClass) && ['singleStorage', 'storageFarm'].includes(mode)) { storage(dev, result, mode === 'storageFarm'); continue; }
            if (dev.deviceClass === 'meter' && ['gridMeter', 'generationMeter', 'consumptionMeter'].includes(mode)) { measurement(dev, result, mode); continue; }
            if (dev.deviceClass === 'pvInverter' && mode === 'pvInverter') { measurement(dev, result, mode); continue; }
            if (dev.deviceClass === 'heat' && mode === 'consumptionMeter') { measurement(dev, result, mode); continue; }
            if (dev.deviceClass === 'solarCharger' || dev.deviceClass === 'generic') { result.status = 'manual'; result.code = 'MANUAL_MAPPING'; continue; }
            result.code = mode === 'auto' ? 'NEEDS_SELECTION' : 'DEVICE_ROLE_MISMATCH';
        } finally {
            // Conflicts and unavailable metadata must not leave empty sections,
            // partially added rows or binding records in the committed config.
            if (result.status !== 'mapped') {
                for (const key of Object.keys(config)) delete config[key];
                Object.assign(config, checkpoint);
                result.mappedFields = [];
            }
        }
    }

    // Commission only explicit, unconsumed installer requests. These records are
    // persisted with the exact same versioned patch as the row/app changes, so a
    // restart or a later background inventory refresh cannot replay activation.
    const grantedApps = new Set(Array.isArray(input.allowedApps) ? input.allowedApps : []);
    const references = new Map(Object.entries(input.referenceMeta || {}));
    for (const dev of devices) for (const meta of dev.aliases.values()) references.set(meta.id, meta);
    /** @param {unknown} value @returns {number|null} */
    const number = value => typeof value === 'number' && Number.isFinite(value) ? value
        : typeof value === 'string' && /^[+-]?\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : null;
    /** @param {unknown} id @param {boolean} write @param {string} type @param {string[]} units */
    const validReference = (id, write, type, units) => {
        if (typeof id !== 'string' || !id || numericReference(id)) return false;
        const meta = references.get(id);
        return !!meta && meta.type === type && (write ? meta.write === true : meta.read === true) &&
            (!units.length || units.includes(text(meta.unit)));
    };
    /** @param {Device} dev @returns {Dict|undefined} */
    const managedRow = dev => {
        const target = text(binding(dev).target);
        if (target === 'storage') return isRecord(config.storage) ? config.storage : undefined;
        const list = target === 'storageFarm' ? record(config.storageFarm).storages : target === 'evcs' ? record(config.settingsConfig).evcsList : undefined;
        return Array.isArray(list) ? list.filter(isRecord).find(row => record(row._eosDevice).baseId === dev.baseId) : undefined;
    };
    for (let index = 0; index < devices.length; index++) {
        const dev = devices[index]; const result = statuses[index];
        const activation = record(dev.ems.activation); const requestId = text(activation.requestId);
        if (!requestId || !dev.enabled || result.status === 'conflict' || result.code === 'ACTIVATION_PROFILE_CHANGED') continue;
        const mode = text(dev.ems.mode) || 'auto';
        const appId = dev.deviceClass === 'evCharger' && mode === 'auto' ? 'charging'
            : mode === 'singleStorage' ? 'storage' : mode === 'storageFarm' ? 'storagefarm' : '';
        const row = managedRow(dev);
        if (binding(dev).activationRequestId === requestId) {
            // A consumed request records a previous successful save, not proof
            // that today's device metadata is available and still usable.
            if (result.status !== 'mapped') continue;
            result.activationApplied = true;
            const app = record(record(record(config.emsApps).apps)[appId]);
            if (activation.requested === false) result.code = 'ACTIVATION_DISABLED';
            else if (appId && (row?.enabled === false || app.enabled !== true || app.installed !== true)) result.code = 'APP_DISABLED';
            else if (!result.missing.length) result.code = 'ACTIVATION_APPLIED';
            continue;
        }
        if (result.status !== 'mapped') continue;
        /** @type {Dict} */
        const proposedBounds = {};
        const limits = record(activation.limits);
        /** Keep existing valid customer limits authoritative; populate missing finite bounds. @param {string} key @param {number} max @param {boolean} [zeroAllowed] */
        const requireBound = (key, max, zeroAllowed = false) => {
            const current = number(row?.[key]); const supplied = number(limits[key]);
            const value = current !== null && (zeroAllowed ? current >= 0 : current > 0) && current <= max ? current : supplied;
            if (value === null || !Number.isFinite(value) || (zeroAllowed ? value < 0 : value <= 0) || value > max) {
                result.missing.push(`limit:${key}`); return null;
            }
            if (current !== value) proposedBounds[key] = value;
            return value;
        };
        /** @param {string} key @param {boolean} write @param {string} type @param {string[]} units */
        const requireReference = (key, write, type, units) => {
            const target = mode === 'singleStorage' ? record(row?.datapoints) : record(row);
            if (!validReference(target[key], write, type, units)) result.missing.push(`reference:${key}`);
        };
        if (activation.requested === true && appId) {
            if (!row) result.missing.push('deviceRow');
            if (!grantedApps.has(appId)) result.missing.push(`license:${appId}`);
            const gridId = record(config.datapoints).gridPointPower;
            const gridMeta = typeof gridId === 'string' ? references.get(gridId) : undefined;
            const perDpW = record(record(config.settings).flowPowerDpIsW).gridPointPower;
            const gridUnit = text(gridMeta?.unit);
            if (!validReference(gridId, false, 'number', ['W', 'kW']) || gridUnit === 'W' && perDpW === false || gridUnit === 'kW' && perDpW !== false) {
                result.missing.push('gridPointPower');
            }
            if (appId === 'charging') {
                requireReference('powerId', false, 'number', ['W']);
                const chargerType = text(row?.chargerType) || text(limits.chargerType);
                if (!['ac', 'dc'].includes(chargerType)) result.missing.push('limit:chargerType');
                else if (empty(row?.chargerType)) proposedBounds.chargerType = chargerType;
                if (chargerType === 'ac') {
                    const phases = number(row?.phases) ?? number(limits.phases);
                    if (phases !== 1 && phases !== 3) result.missing.push('limit:phases');
                    else if (number(row?.phases) !== phases) proposedBounds.phases = phases;
                    const min = requireBound('minCurrentA', 1000); const max = requireBound('maxCurrentA', 1000);
                    if (min !== null && max !== null && min > max) result.missing.push('limit:minCurrentA|maxCurrentA');
                    if (empty(row?.setCurrentAId)) requireReference('setPowerWId', true, 'number', ['W']);
                    else requireReference('setCurrentAId', true, 'number', ['A']);
                } else if (chargerType === 'dc') {
                    const min = requireBound('minPowerW', 1000000000); const max = requireBound('maxPowerW', 1000000000);
                    if (min !== null && max !== null && min > max) result.missing.push('limit:minPowerW|maxPowerW');
                    requireReference('setPowerWId', true, 'number', ['W']);
                }
                if (!empty(row?.enableWriteId)) requireReference('enableWriteId', true, 'boolean', []);
            } else {
                const farm = appId === 'storagefarm';
                requireReference(farm ? 'socId' : 'socObjectId', false, 'number', ['%']);
                requireReference(farm ? 'signedPowerId' : 'batteryPowerObjectId', false, 'number', ['W']);
                const destination = farm ? record(row) : record(row?.datapoints);
                const native = row?.vendorProfile === 'fenecon-openems' && row?.feneconControlMode === 'fems-grid';
                if (native) requireReference(farm ? 'feneconGridSetpointId' : 'feneconGridSetpointObjectId', true, 'number', ['W']);
                else if (!empty(destination[farm ? 'setSignedPowerId' : 'targetPowerObjectId'])) requireReference(farm ? 'setSignedPowerId' : 'targetPowerObjectId', true, 'number', ['W']);
                else {
                    requireReference(farm ? 'setChargePowerId' : 'targetChargePowerObjectId', true, 'number', ['W']);
                    requireReference(farm ? 'setDischargePowerId' : 'targetDischargePowerObjectId', true, 'number', ['W']);
                }
                const charge = requireBound('maxChargeW', 1000000000, farm); const discharge = requireBound('maxDischargeW', 1000000000, farm);
                if (charge === 0 && discharge === 0) result.missing.push('limit:storagePower');
                const coupling = text(row?.coupling) || text(limits.coupling);
                if (!['ac', 'dc'].includes(coupling)) result.missing.push('limit:coupling');
                else if (empty(row?.coupling)) proposedBounds.coupling = coupling;
                if (!empty(limits.capacityKWh) && empty(row?.capacityKWh)) requireBound('capacityKWh', 10000000);
                const otherApp = record(record(record(config.emsApps).apps)[farm ? 'storage' : 'storagefarm']);
                const otherRows = farm ? [record(config.storage)] : (Array.isArray(record(config.storageFarm).storages) ? /** @type {Json[]} */ (record(config.storageFarm).storages) : []);
                if (otherApp.enabled === true && otherRows.some(item => record(item).enabled !== false && mappedIds(item).length)) result.missing.push('otherStorageController');
            }
        }
        if (activation.requested === true && result.missing.length) {
            result.missing = [...new Set(result.missing)];
            result.status = 'pending'; result.code = 'ACTIVATION_PENDING';
            const original = activeOriginals.get(dev.baseId);
            if (row && original) {
                for (const key of Object.keys(row)) delete row[key];
                Object.assign(row, original);
                result.corrections = []; result.mappedFields = [];
            }
            continue;
        }
        if (row && appId) {
            Object.assign(row, proposedBounds);
            row.enabled = activation.requested === true;
            if (appId === 'storage' && activation.requested === false) disableSingleApp();
        }
        if (activation.requested === true && appId) {
            const registry = section(config, 'emsApps'); fill(registry, 'schemaVersion', 1, result);
            const app = section(section(registry, 'apps'), appId); app.installed = true; app.enabled = true;
            if (appId === 'charging') {
                const dp = record(config.datapoints); const oldEv = text(dp.consumptionEvcs);
                if (oldEv && references.get(oldEv)?.type === 'boolean') {
                    dp.consumptionEvcs = ''; result.corrections.push('EV_FLOW_BOOLEAN_OVERRIDE_REMOVED');
                }
            }
        }
        const registry = section(config, 'eosDeviceEms'); registry.v = 1;
        const bindings = section(registry, 'bindings');
        bindings[dev.baseId] = { ...record(bindings[dev.baseId]), activationRequestId: requestId,
            activationFingerprint: requestFingerprint(dev), activationRequested: activation.requested === true,
            deviceTemplateId: dev.templateId, deviceProtocol: dev.protocol, deviceClass: dev.deviceClass };
        result.activationApplied = true;
        result.code = activation.requested === true ? 'ACTIVATION_APPLIED' : 'ACTIVATION_DISABLED';
    }
    // Switching on a shared app also switches on every enabled controller row.
    // Do not implicitly start a dormant manual row or a row whose commissioning
    // is still incomplete just because another device was added successfully.
    for (const appId of ['charging', 'storagefarm']) {
        const oldApp = record(record(record(before.emsApps).apps)[appId]);
        const app = record(record(record(config.emsApps).apps)[appId]);
        if (oldApp.installed === true && oldApp.enabled === true || app.enabled !== true) continue;
        const list = appId === 'charging' ? record(config.settingsConfig).evcsList : record(config.storageFarm).storages;
        if (!Array.isArray(list)) continue;
        const controllingFields = appId === 'charging' ? ['setCurrentAId', 'setPowerWId', 'enableWriteId']
            : ['setSignedPowerId', 'setChargePowerId', 'setDischargePowerId', 'feneconGridSetpointId'];
        const relevant = devices.filter(dev => appId === 'charging' ? dev.deviceClass === 'evCharger' && (dev.ems.mode || 'auto') === 'auto' : dev.ems.mode === 'storageFarm');
        const approved = new Set(relevant.filter(dev => {
            const result = statuses.find(item => item.baseId === dev.baseId);
            return record(dev.ems.activation).requested === true && result?.activationApplied === true && result.code === 'ACTIVATION_APPLIED' &&
                text(record(record(record(before.eosDeviceEms).bindings)[dev.baseId]).activationRequestId) !== result.activationRequestId;
        }).map(dev => dev.baseId));
        const hasDormantController = list.filter(isRecord).some(row => row.enabled !== false && controllingFields.some(key => !empty(row[key])) &&
            !approved.has(text(record(row._eosDevice).baseId)));
        if (!hasDormantController) continue;
        app.enabled = false;
        for (const dev of relevant) {
            if (!approved.has(dev.baseId)) continue;
            const result = /** @type {Status} */ (statuses.find(item => item.baseId === dev.baseId));
            const row = managedRow(dev); const original = activeOriginals.get(dev.baseId);
            if (row) {
                if (original) {
                    for (const key of Object.keys(row)) delete row[key];
                    Object.assign(row, original); result.corrections = []; result.mappedFields = [];
                } else row.enabled = false;
            }
            const previous = record(record(record(before.eosDeviceEms).bindings)[dev.baseId]);
            const current = binding(dev);
            for (const key of ['activationRequestId', 'activationFingerprint', 'activationRequested', 'deviceTemplateId', 'deviceProtocol', 'deviceClass']) {
                if (previous[key] === undefined) delete current[key]; else current[key] = previous[key];
            }
            result.activationApplied = false; result.status = 'pending'; result.code = 'ACTIVATION_PENDING';
            result.missing.push('otherUncommissionedController');
        }
    }
    /** @type {Dict} */
    const patch = {};
    for (const [key, value] of Object.entries(config)) if (JSON.stringify(value) !== JSON.stringify(before[key])) patch[key] = value;
    return { config, patch, changed: Object.keys(patch).length > 0, statuses };
}

module.exports = { planDeviceEms, getDeviceEmsReferences };
