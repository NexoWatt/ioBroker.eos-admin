/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/smarthome-device-detection.ts
 * Quell-Hash: sha256:7e40e5d6393e3f570dbe4f7ca457ea3bd9b77d0aceff209b19fe206fa36d2463
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/smarthome-device-detection.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DetectionScan = exports.DetectionError = exports.DETECTION_LIMITS = void 0;
exports.detectionNow = detectionNow;
exports.detectionSnapshot = detectionSnapshot;
exports.cleanControls = cleanControls;
exports.getControlIdentity = getControlIdentity;
exports.extendSuggestion = extendSuggestion;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Überführt erkannte Geräte in prüfbare, vollständige Bedienzuordnungen.
 * Daten und Wirkung: Liest TypeDetector-Ausgaben und Objektmetadaten synchron;
 * keine Gerätebefehle, Speicherung, Netzwerkzugriffe oder Objektänderungen.
 * Grenzen: Ein Vorschlag erteilt keine Berechtigung. Lesen/Schreiben müssen sowohl
 * zum registrierten Slot als auch zu den tatsächlichen common-Metadaten passen.
 * Bei Änderungen: Pflichtslots, fremde Aliasgeschwister, mehrere Controls,
 * alternative Slottypen und getrennte Lese-/Schreibrechte gemeinsam prüfen.
 * Verknüpfungen: smarthome-device-controls.ts, smarthome-import.ts.
 */
const node_crypto_1 = require("node:crypto");
const node_perf_hooks_1 = require("node:perf_hooks");
const smarthome_device_controls_1 = require("./smarthome-device-controls");
/** Operational limits apply to discovery only, never to saved customer devices.
 * A synchronous detector call is cooperatively checked before/after the call;
 * this budget is deliberately not a hard event-loop execution guarantee. */
exports.DETECTION_LIMITS = Object.freeze({ objects: 100000, roots: 20000, suggestions: 10000, timeoutMs: 30000, readTimeoutMs: 5000 });
class DetectionError extends Error {
    constructor(code) {
        super(code);
        this.code = code;
        this.name = 'DetectionError';
    }
}
exports.DetectionError = DetectionError;
function detectionNow() { return node_perf_hooks_1.performance.now(); }
/** TypeDetector uses binary search with JS string comparison, not locale order.
 * Passing localeCompare-sorted IDs with _keysOptionalSorted drops valid devices. */
function detectionSnapshot(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new DetectionError('EOS_DETECTION_FAILED');
    const objects = input;
    const keys = Object.keys(objects);
    if (keys.length > exports.DETECTION_LIMITS.objects)
        throw new DetectionError('EOS_DETECTION_LIMIT');
    keys.sort();
    return { objects, keys };
}
/** No writes/retries: bound waiting for the shared object snapshot and stop
 * scanning when HTTP disconnects or the hosted runtime shuts down. Underlying
 * ioBroker object IO has no cancellation API; its loader must discard late IO. */
class DetectionScan {
    constructor(options = {}) {
        this.options = options;
        this.started = this.now();
    }
    now() { return this.options.now ? this.options.now() : detectionNow(); }
    get elapsedMs() { return Math.max(0, this.now() - this.started); }
    check(kind, count = 0) {
        if (this.options.stopping?.())
            throw new DetectionError('EOS_UI_STOPPING');
        if (this.options.signal?.aborted)
            throw new DetectionError('EOS_DETECTION_ABORTED');
        if (this.elapsedMs >= exports.DETECTION_LIMITS.timeoutMs)
            throw new DetectionError('EOS_DETECTION_TIMEOUT');
        if (kind && count > exports.DETECTION_LIMITS[kind])
            throw new DetectionError('EOS_DETECTION_LIMIT');
    }
    async read(pending) {
        try {
            this.check();
        }
        catch (error) {
            // Even an already-cancelled caller must observe the shared IO's
            // eventual rejection; cancellation does not cancel ioBroker IO.
            void pending.catch(() => undefined);
            throw error;
        }
        return new Promise((resolve, reject) => {
            const signal = this.options.signal;
            const failed = (error) => {
                cleanup();
                reject(error instanceof Error ? error : new DetectionError('EOS_DETECTION_FAILED'));
            };
            const aborted = () => failed(new DetectionError('EOS_DETECTION_ABORTED'));
            const timer = setTimeout(() => failed(new DetectionError('EOS_DETECTION_TIMEOUT')), Math.max(1, Math.min(exports.DETECTION_LIMITS.readTimeoutMs, exports.DETECTION_LIMITS.timeoutMs - this.elapsedMs)));
            const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', aborted); };
            signal?.addEventListener('abort', aborted, { once: true });
            if (signal?.aborted)
                aborted();
            void pending.then(value => {
                try {
                    this.check();
                    cleanup();
                    resolve(value);
                }
                catch (error) {
                    failed(error);
                }
            }, failed);
        });
    }
}
exports.DetectionScan = DetectionScan;
const LEGACY_TYPES = new Set(['switch', 'dimmer', 'color', 'blind', 'rtr', 'scene', 'sensor', 'player', 'camera', 'widget']);
const SAFE_KEY = /^[A-Z][A-Z0-9_]{0,63}$/;
const DIAGNOSTIC_KEYS = new Set(['BATTERY', 'RSSI', 'LOWBAT', 'UNREACH', 'UNREACH_STICKY', 'MAINTAIN', 'ERROR', 'CONNECTED', 'WORKING', 'DIRECTION', 'DIRECTION_ENUM']);
const PROFILE_FIELDS = new Map((0, smarthome_device_controls_1.getControlProfiles)().map(profile => [profile.id, profile.fields.map(row)]));
function row(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function list(value) { return Array.isArray(value) ? value : []; }
function parent(id) { return id.slice(0, Math.max(0, id.lastIndexOf('.'))); }
function mandatory(state) { return state.required === true || !!state.requiredOneOf; }
function digest(value) { return (0, node_crypto_1.createHash)('sha256').update(JSON.stringify(value)).digest('hex'); }
function stateObject(objects, id) {
    if (!id || id.length > 512 || /[\u0000-\u001f]/u.test(id))
        return undefined;
    const object = row(objects[id]);
    return object.type === 'state' ? row(object.common) : undefined;
}
function definitions(profile) {
    return PROFILE_FIELDS.get(profile) || [];
}
function fieldDefinition(fields, key) {
    return fields.find(item => item.key === key || (typeof item.key === 'string' && item.key.includes('%d')
        && new RegExp('^' + item.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('%d', '[0-9]{1,3}') + '$').test(key)));
}
function managedIdentity(sourceId, control, objects) {
    if (!sourceId.startsWith('alias.0.nexowatt_eos.'))
        return null;
    const object = row(objects[sourceId]);
    const native = row(object.native);
    const tag = row(native.eosSmartHomeAlias);
    const originalId = text(tag.sourceId);
    const controlId = text(tag.controlId);
    if (object.type !== 'channel' || tag.schema !== 1 || native.eosSmartHomeAliasOwner !== 'nexowatt-eos-smarthome' || !originalId || originalId.length > 512
        || /[\u0000-\u0020]/u.test(originalId) || !/^[a-f\d]{64}$/.test(controlId) || !text(tag.deviceId))
        return null;
    const primary = control.states.filter(state => mandatory(state));
    if (!primary.length || !primary.every(state => text(state.id).startsWith(sourceId + '.') && !!stateObject(objects, text(state.id))?.alias))
        return null;
    return { sourceId: originalId, controlId };
}
/** Remove leaked optional alias siblings and repeated datapoints before mapping.
 * A requiredOneOf slot is also primary; a random optional state must never choose
 * the home channel. The input and cached object tree are left unchanged. */
function cleanControls(input, objects) {
    const output = [];
    const seen = new Set();
    for (const value of list(input)) {
        const original = row(value);
        const type = text(original.type);
        if (!definitions(type).length)
            continue;
        const candidates = list(original.states).map(row).filter(state => stateObject(objects, text(state.id)));
        const primary = candidates.find(mandatory);
        const home = primary ? parent(text(primary.id)) : '';
        const owners = new Map();
        const states = [];
        for (const state of candidates) {
            const id = text(state.id);
            const key = text(state.name).toUpperCase();
            if (!SAFE_KEY.test(key))
                continue;
            const actual = stateObject(objects, id);
            if (home && !mandatory(state) && actual.alias && parent(id) !== home)
                continue;
            const owner = owners.get(id);
            if (owner && owner !== key && !mandatory(state))
                continue;
            if (!owner)
                owners.set(id, key);
            if (!states.some(existing => existing.id === id && existing.name === key))
                states.push({ ...state, name: key, id });
        }
        if (!states.length)
            continue;
        // A multiple ACTUAL slot represents independent readings, not an array
        // of values silently collapsed into one binding. Keep one proposal per
        // primary value, retaining the shared diagnostic slots.
        const multiple = states.find(state => state.multiple === true && state.indicator !== true);
        const siblings = multiple ? states.filter(state => state.name === multiple.name) : [];
        const variants = siblings.length > 1
            ? siblings.map(sibling => states.filter(state => state.name !== sibling.name || state.id === sibling.id)) : [states];
        for (const variant of variants) {
            const key = digest({ type, states: variant.map(state => `${String(state.name)}:${String(state.id)}`).sort() });
            if (seen.has(key))
                continue;
            seen.add(key);
            output.push({ ...original, type, states: variant });
        }
    }
    return output;
}
/** Identity is independent of object enumeration and optional indicators. */
function getControlIdentity(control) {
    const value = row(control);
    const states = list(value.states).map(row);
    const required = states.filter(state => text(state.id) && mandatory(state));
    const core = required.length ? required : states.filter(state => text(state.id) && state.indicator !== true && !DIAGNOSTIC_KEYS.has(text(state.name)));
    return digest({ type: text(value.type), primary: core.map(state => `${text(state.name)}:${text(state.id)}`).sort() });
}
/** All known, matched slots survive in one deviceControls profile. Actual
 * metadata is diagnostic data only; runtime resolves it again before writes. */
function extendSuggestion(input, controlInput, objects) {
    const original = row(input);
    const control = cleanControls([controlInput], objects)[0];
    if (!control)
        return { ...original, importable: false };
    const profileFields = definitions(control.type);
    const mappings = new Map();
    const states = [];
    for (const state of control.states) {
        const key = text(state.name);
        const id = text(state.id);
        const common = stateObject(objects, id);
        const definition = fieldDefinition(profileFields, key);
        if (!definition || definition.manualOnly === true)
            continue;
        const types = list(definition.types).filter((item) => typeof item === 'string');
        const actualType = text(common.type);
        if (!['number', 'string', 'boolean'].includes(actualType) || (types.length && !types.includes(actualType)))
            continue;
        const canRead = definition.read === true && common.read !== false;
        const canWrite = definition.write === true && common.write === true
            && (definition.manualWriteOnly !== true || state.write === true);
        if (!canRead && !canWrite)
            continue;
        const field = mappings.get(key) || { key };
        if (canRead && !field.readId)
            field.readId = id;
        if (canWrite && !field.writeId)
            field.writeId = id;
        mappings.set(key, field);
        states.push({ key, id, type: actualType, role: text(common.role), unit: text(common.unit),
            read: canRead, write: canWrite, indicator: state.indicator === true,
            label: common.name ?? key,
            ...(typeof common.min === 'number' && Number.isFinite(common.min) ? { min: common.min } : {}),
            ...(typeof common.max === 'number' && Number.isFinite(common.max) ? { max: common.max } : {}),
            ...(typeof common.step === 'number' && Number.isFinite(common.step) ? { step: common.step } : {}),
        });
    }
    const fields = [...mappings.values()].sort((a, b) => a.key.localeCompare(b.key));
    const previous = row(original.proposal);
    const type = LEGACY_TYPES.has(text(previous.type)) ? text(previous.type) : 'device';
    const displaySourceId = text(original.sourceId);
    const managed = managedIdentity(displaySourceId, control, objects);
    const controlId = managed?.controlId || getControlIdentity(control);
    const writable = fields.some(field => field.writeId);
    const hasCore = states.some(state => state.indicator !== true && !DIAGNOSTIC_KEYS.has(text(state.key)));
    let controlsValid = true;
    try {
        (0, smarthome_device_controls_1.normalizeDeviceControls)({ profile: control.type, fields });
    }
    catch {
        controlsValid = false;
    }
    const proposal = { ...previous, type, io: { ...row(previous.io), deviceControls: { profile: control.type, fields } },
        behavior: { ...row(previous.behavior), readOnly: !writable } };
    return { ...original, id: `td_${controlId.slice(0, 24)}`, controlId,
        ...(managed ? { sourceId: managed.sourceId, displaySourceId, managedAlias: true } : {}), detectorType: control.type, targetType: type,
        signature: `${control.type}|${fields.map(field => `${field.key}:${field.readId || ''}:${field.writeId || ''}`).join('|')}`,
        states, matchCount: fields.length, proposal, importable: fields.length > 0 && hasCore && controlsValid,
        notes: [...list(original.notes), ...(!controlsValid ? ['Die erkannte Bedienzuordnung enthält nicht zulässige Datenpunkte oder zu viele Felder. Bitte manuell prüfen.'] : [])] };
}
