/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
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
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { getControlProfiles, normalizeDeviceControls } from './smarthome-device-controls';

type Row = Record<string, unknown>;
type Objects = Record<string, unknown>;
export type CleanDetectedControl = Row & { type: string; states: Row[] };
type ControlField = { key: string; readId?: string; writeId?: string };
/** Operational limits apply to discovery only, never to saved customer devices.
 * A synchronous detector call is cooperatively checked before/after the call;
 * this budget is deliberately not a hard event-loop execution guarantee. */
export const DETECTION_LIMITS = Object.freeze({ objects: 100000, roots: 20000, suggestions: 10000, timeoutMs: 30000, readTimeoutMs: 5000 });
export type DetectionErrorCode = 'EOS_DETECTION_ABORTED' | 'EOS_DETECTION_TIMEOUT' | 'EOS_DETECTION_LIMIT' | 'EOS_DETECTION_FAILED' | 'EOS_UI_STOPPING';
export class DetectionError extends Error {
    constructor(readonly code: DetectionErrorCode) { super(code); this.name = 'DetectionError'; }
}
export function detectionNow(): number { return performance.now(); }

/** TypeDetector uses binary search with JS string comparison, not locale order.
 * Passing localeCompare-sorted IDs with _keysOptionalSorted drops valid devices. */
export function detectionSnapshot(input: unknown): { objects: Objects; keys: string[] } {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new DetectionError('EOS_DETECTION_FAILED');
    const objects = input as Objects;
    const keys = Object.keys(objects);
    if (keys.length > DETECTION_LIMITS.objects) throw new DetectionError('EOS_DETECTION_LIMIT');
    keys.sort();
    return { objects, keys };
}

/** No writes/retries: bound waiting for the shared object snapshot and stop
 * scanning when HTTP disconnects or the hosted runtime shuts down. Underlying
 * ioBroker object IO has no cancellation API; its loader must discard late IO. */
export class DetectionScan {
    private readonly started: number;
    constructor(private readonly options: { signal?: AbortSignal; stopping?: () => boolean; now?: () => number } = {}) {
        this.started = this.now();
    }
    private now(): number { return this.options.now ? this.options.now() : detectionNow(); }
    get elapsedMs(): number { return Math.max(0, this.now() - this.started); }
    check(kind?: 'roots' | 'suggestions', count = 0): void {
        if (this.options.stopping?.()) throw new DetectionError('EOS_UI_STOPPING');
        if (this.options.signal?.aborted) throw new DetectionError('EOS_DETECTION_ABORTED');
        if (this.elapsedMs >= DETECTION_LIMITS.timeoutMs) throw new DetectionError('EOS_DETECTION_TIMEOUT');
        if (kind && count > DETECTION_LIMITS[kind]) throw new DetectionError('EOS_DETECTION_LIMIT');
    }
    async read<T>(pending: Promise<T>): Promise<T> {
        try { this.check(); } catch (error) {
            // Even an already-cancelled caller must observe the shared IO's
            // eventual rejection; cancellation does not cancel ioBroker IO.
            void pending.catch(() => undefined);
            throw error;
        }
        return new Promise<T>((resolve, reject) => {
            const signal = this.options.signal;
            const failed = (error: unknown): void => {
                cleanup(); reject(error instanceof Error ? error : new DetectionError('EOS_DETECTION_FAILED'));
            };
            const aborted = (): void => failed(new DetectionError('EOS_DETECTION_ABORTED'));
            const timer = setTimeout(() => failed(new DetectionError('EOS_DETECTION_TIMEOUT')),
                Math.max(1, Math.min(DETECTION_LIMITS.readTimeoutMs, DETECTION_LIMITS.timeoutMs - this.elapsedMs)));
            const cleanup = (): void => { clearTimeout(timer); signal?.removeEventListener('abort', aborted); };
            signal?.addEventListener('abort', aborted, { once: true });
            if (signal?.aborted) aborted();
            void pending.then(value => {
                try { this.check(); cleanup(); resolve(value); } catch (error) { failed(error); }
            }, failed);
        });
    }
}
const LEGACY_TYPES = new Set(['switch', 'dimmer', 'color', 'blind', 'rtr', 'scene', 'sensor', 'player', 'camera', 'widget']);
const SAFE_KEY = /^[A-Z][A-Z0-9_]{0,63}$/;
const DIAGNOSTIC_KEYS = new Set(['BATTERY', 'RSSI', 'LOWBAT', 'UNREACH', 'UNREACH_STICKY', 'MAINTAIN', 'ERROR', 'CONNECTED', 'WORKING', 'DIRECTION', 'DIRECTION_ENUM']);
const PROFILE_FIELDS = new Map(getControlProfiles().map(profile => [profile.id, profile.fields.map(row)]));

function row(value: unknown): Row { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}; }
function text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function parent(id: string): string { return id.slice(0, Math.max(0, id.lastIndexOf('.'))); }
function mandatory(state: Row): boolean { return state.required === true || !!state.requiredOneOf; }
function digest(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function stateObject(objects: Objects, id: string): Row | undefined {
    if (!id || id.length > 512 || /[\u0000-\u001f]/u.test(id)) return undefined;
    const object = row(objects[id]);
    return object.type === 'state' ? row(object.common) : undefined;
}
function definitions(profile: string): Row[] {
    return PROFILE_FIELDS.get(profile) || [];
}
function fieldDefinition(fields: Row[], key: string): Row | undefined {
    return fields.find(item => item.key === key || (typeof item.key === 'string' && item.key.includes('%d')
        && new RegExp('^' + item.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('%d', '[0-9]{1,3}') + '$').test(key)));
}
function managedIdentity(sourceId: string, control: CleanDetectedControl, objects: Objects): { sourceId: string; controlId: string } | null {
    if (!sourceId.startsWith('alias.0.nexowatt_eos.')) return null;
    const object = row(objects[sourceId]); const native = row(object.native); const tag = row(native.eosSmartHomeAlias);
    const originalId = text(tag.sourceId); const controlId = text(tag.controlId);
    if (object.type !== 'channel' || tag.schema !== 1 || native.eosSmartHomeAliasOwner !== 'nexowatt-eos-smarthome' || !originalId || originalId.length > 512
        || /[\u0000-\u0020]/u.test(originalId) || !/^[a-f\d]{64}$/.test(controlId) || !text(tag.deviceId)) return null;
    const primary = control.states.filter(state => mandatory(state));
    if (!primary.length || !primary.every(state => text(state.id).startsWith(sourceId + '.') && !!stateObject(objects, text(state.id))?.alias)) return null;
    return { sourceId: originalId, controlId };
}

/** Remove leaked optional alias siblings and repeated datapoints before mapping.
 * A requiredOneOf slot is also primary; a random optional state must never choose
 * the home channel. The input and cached object tree are left unchanged. */
export function cleanControls(input: unknown, objects: Objects): CleanDetectedControl[] {
    const output: CleanDetectedControl[] = [];
    const seen = new Set<string>();
    for (const value of list(input)) {
        const original = row(value); const type = text(original.type);
        if (!definitions(type).length) continue;
        const candidates = list(original.states).map(row).filter(state => stateObject(objects, text(state.id)));
        const primary = candidates.find(mandatory);
        const home = primary ? parent(text(primary.id)) : '';
        const owners = new Map<string, string>();
        const states: Row[] = [];
        for (const state of candidates) {
            const id = text(state.id); const key = text(state.name).toUpperCase();
            if (!SAFE_KEY.test(key)) continue;
            const actual = stateObject(objects, id)!;
            if (home && !mandatory(state) && actual.alias && parent(id) !== home) continue;
            const owner = owners.get(id);
            if (owner && owner !== key && !mandatory(state)) continue;
            if (!owner) owners.set(id, key);
            if (!states.some(existing => existing.id === id && existing.name === key)) states.push({ ...state, name: key, id });
        }
        if (!states.length) continue;
        // A multiple ACTUAL slot represents independent readings, not an array
        // of values silently collapsed into one binding. Keep one proposal per
        // primary value, retaining the shared diagnostic slots.
        const multiple = states.find(state => state.multiple === true && state.indicator !== true);
        const siblings = multiple ? states.filter(state => state.name === multiple.name) : [];
        const variants = siblings.length > 1
            ? siblings.map(sibling => states.filter(state => state.name !== sibling.name || state.id === sibling.id)) : [states];
        for (const variant of variants) {
            const key = digest({ type, states: variant.map(state => `${String(state.name)}:${String(state.id)}`).sort() });
            if (seen.has(key)) continue;
            seen.add(key); output.push({ ...original, type, states: variant });
        }
    }
    return output;
}

/** Identity is independent of object enumeration and optional indicators. */
export function getControlIdentity(control: unknown): string {
    const value = row(control); const states = list(value.states).map(row);
    const required = states.filter(state => text(state.id) && mandatory(state));
    const core = required.length ? required : states.filter(state => text(state.id) && state.indicator !== true && !DIAGNOSTIC_KEYS.has(text(state.name)));
    return digest({ type: text(value.type), primary: core.map(state => `${text(state.name)}:${text(state.id)}`).sort() });
}

/** All known, matched slots survive in one deviceControls profile. Actual
 * metadata is diagnostic data only; runtime resolves it again before writes. */
export function extendSuggestion(input: unknown, controlInput: unknown, objects: Objects): Row {
    const original = row(input);
    const control = cleanControls([controlInput], objects)[0];
    if (!control) return { ...original, importable: false };
    const profileFields = definitions(control.type);
    const mappings = new Map<string, ControlField>();
    const states: Row[] = [];
    for (const state of control.states) {
        const key = text(state.name); const id = text(state.id);
        const common = stateObject(objects, id)!;
        const definition = fieldDefinition(profileFields, key);
        if (!definition || definition.manualOnly === true) continue;
        const types = list(definition.types).filter((item): item is string => typeof item === 'string');
        const actualType = text(common.type);
        if (!['number', 'string', 'boolean'].includes(actualType) || (types.length && !types.includes(actualType))) continue;
        const canRead = definition.read === true && common.read !== false;
        const canWrite = definition.write === true && common.write === true
            && (definition.manualWriteOnly !== true || state.write === true);
        if (!canRead && !canWrite) continue;
        const field = mappings.get(key) || { key };
        if (canRead && !field.readId) field.readId = id;
        if (canWrite && !field.writeId) field.writeId = id;
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
    try { normalizeDeviceControls({ profile: control.type, fields }); } catch { controlsValid = false; }
    const proposal: Row = { ...previous, type, io: { ...row(previous.io), deviceControls: { profile: control.type, fields } },
        behavior: { ...row(previous.behavior), readOnly: !writable } };
    return { ...original, id: `td_${controlId.slice(0, 24)}`, controlId,
        ...(managed ? { sourceId: managed.sourceId, displaySourceId, managedAlias: true } : {}), detectorType: control.type, targetType: type,
        signature: `${control.type}|${fields.map(field => `${field.key}:${field.readId || ''}:${field.writeId || ''}`).join('|')}`,
        states, matchCount: fields.length, proposal, importable: fields.length > 0 && hasCore && controlsValid,
        notes: [...list(original.notes), ...(!controlsValid ? ['Die erkannte Bedienzuordnung enthält nicht zulässige Datenpunkte oder zu viele Felder. Bitte manuell prüfen.'] : [])] };
}
