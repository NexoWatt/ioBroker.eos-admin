/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Erstellt auf ausdrücklichen Installer-Auftrag verwaltete ioBroker-Aliasse für gespeicherte Gerätezuordnungen.
 * Daten und Wirkung: Prüft Quellen und vorhandene Objekte, legt ausschließlich fehlende Alias-Objekte an und schreibt niemals Gerätewerte.
 * Bei Änderungen: Idempotenz, fremde Kollisionen, getrennte Leseschreibziele, Teilfehler und unveränderte Kunden-/Raumdaten prüfen.
 */
import { createHash } from 'node:crypto';
import {
    normalizeDeviceControls, validateDeviceControlRead, validateDeviceControlWrite,
    type DeviceControlsConfig, type ControlMapping, type ControlScalarType,
} from './smarthome-device-controls';

type Row = Record<string, unknown>;
export interface DeviceAliasHost {
    readObject(id: string): Promise<unknown>;
    createObjectIfAbsent(id: string, object: Row): Promise<unknown>;
}
export interface DeviceAliasResult { devices: Row[]; created: string[]; reused: string[] }
export class DeviceAliasError extends Error {
    readonly created: string[];
    readonly reused: string[];
    readonly uncertain: string[];
    constructor(public readonly code: string, created: string[] = [], reused: string[] = [], uncertain: string[] = []) {
        super(code); this.name = 'DeviceAliasError';
        this.created = [...created]; this.reused = [...reused]; this.uncertain = [...uncertain];
    }
}
interface Source { id: string; type: ControlScalarType; common: Row; alias: boolean }
interface AliasPlan { id: string; object: Row; kind: 'folder' | 'channel' | 'state' }
interface Replacement { key: string; side: 'readId' | 'writeId'; source: string; target: string }
const ROOT = 'alias.0.nexowatt_eos';
const OWNER = 'nexowatt-eos-smarthome';
const MAX_DEVICES = 100;
const MAX_FIELDS = 2_000;
const MAX_READS = 8_192;
const DEADLINE_MS = 30_000;
let creating = false;

function row(value: unknown): value is Row {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype: unknown = Object.getPrototypeOf(value);
    return (prototype === null || prototype === Object.prototype)
        && !Object.values(Object.getOwnPropertyDescriptors(value)).some(item => typeof item.get === 'function' || typeof item.set === 'function');
}
function fail(code: string): never { throw new DeviceAliasError(code); }
function text(value: unknown, max = 160): string { return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : ''; }
function safeClone(value: unknown): unknown {
    const seen = new Set<object>(); let budget = 100_000;
    function inspect(item: unknown, depth: number): void {
        if (--budget < 0 || depth > 24) fail('EOS_ALIAS_REQUEST_INVALID');
        if (item === null || typeof item === 'boolean') return;
        if (typeof item === 'string') { if (item.length > 65_536) fail('EOS_ALIAS_REQUEST_INVALID'); return; }
        if (typeof item === 'number') { if (!Number.isFinite(item)) fail('EOS_ALIAS_REQUEST_INVALID'); return; }
        if (typeof item !== 'object' || (!row(item) && !Array.isArray(item)) || seen.has(item)) fail('EOS_ALIAS_REQUEST_INVALID');
        seen.add(item);
        for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(item))) {
            if (['__proto__', 'constructor', 'prototype'].includes(key) || typeof descriptor.get === 'function' || typeof descriptor.set === 'function') fail('EOS_ALIAS_REQUEST_INVALID');
            if (Array.isArray(item) && key === 'length') continue;
            const entry: unknown = descriptor.value; inspect(entry, depth + 1);
        }
        seen.delete(item);
    }
    inspect(value, 0);
    const encoded = JSON.stringify(value);
    if (Buffer.byteLength(encoded, 'utf8') > 4_194_304) fail('EOS_ALIAS_REQUEST_LIMIT');
    const cloned: unknown = JSON.parse(encoded);
    return cloned;
}
function sourceError(error: unknown): string {
    if (error instanceof DeviceAliasError) return error.code;
    if (error instanceof Error && 'code' in error && typeof error.code === 'string' && /^EOS_CONTROL_[A-Z_]+$/.test(error.code)) return error.code;
    return 'EOS_ALIAS_OPERATION_FAILED';
}

/** Begrenzte Objektzugriffe ohne Abonnements; auch nach einem Timeout startet kein verspäteter Folgeauftrag. */
class Context {
    private readonly cache = new Map<string, Promise<unknown>>();
    private readonly queue: (() => Promise<void>)[] = [];
    private active = 0;
    private reads = 0;
    private readonly expires = Date.now() + DEADLINE_MS;
    readonly created = new Set<string>();
    readonly reused = new Set<string>();
    readonly uncertain = new Set<string>();
    constructor(readonly host: DeviceAliasHost) {}
    check(): void { if (Date.now() >= this.expires) fail('EOS_ALIAS_TIMEOUT'); }
    async bounded<T>(operation: () => Promise<T>): Promise<T> {
        this.check(); let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            return await Promise.race([
                Promise.resolve().then(() => { this.check(); return operation(); }),
                new Promise<never>((_resolve, reject) => {
                    timer = setTimeout(() => reject(new DeviceAliasError('EOS_ALIAS_TIMEOUT')), Math.max(1, this.expires - Date.now()));
                }),
            ]);
        } finally { if (timer !== undefined) clearTimeout(timer); }
    }
    private drain(): void {
        while (this.active < 8) {
            const task = this.queue.shift(); if (!task) return;
            this.active++;
            void task().finally(() => { this.active--; this.drain(); });
        }
    }
    readObject(id: string): Promise<unknown> {
        const cached = this.cache.get(id); if (cached) return cached;
        if (++this.reads > MAX_READS) return Promise.reject(new DeviceAliasError('EOS_ALIAS_READ_LIMIT'));
        const pending = new Promise<unknown>((resolve, reject) => {
            this.queue.push(async () => {
                try { resolve(await this.bounded(() => this.host.readObject(id))); }
                catch (error: unknown) { reject(new DeviceAliasError(sourceError(error))); }
            });
            this.drain();
        });
        this.cache.set(id, pending); return pending;
    }
    async freshObject(id: string): Promise<unknown> {
        this.cache.delete(id);
        return this.readObject(id);
    }
    result(devices: Row[]): DeviceAliasResult { return { devices, created: [...this.created], reused: [...this.reused] }; }
    failure(error: unknown): DeviceAliasError {
        return new DeviceAliasError(sourceError(error), [...this.created], [...this.reused], [...this.uncertain]);
    }
}

const META_KEYS = ['name', 'desc', 'role', 'unit', 'min', 'max', 'step', 'states', 'icon', 'color'] as const;
function commonOf(source: unknown): Row {
    if (!row(source) || source.type !== 'state' || !row(source.common)) return fail('EOS_ALIAS_SOURCE_INVALID');
    return source.common;
}
function sourceMetadata(source: Source, read: boolean, write: boolean): Row {
    const common: Row = { type: source.type, read, write };
    for (const key of META_KEYS) {
        const value = source.common[key];
        if (value === undefined) continue;
        if (['min', 'max', 'step'].includes(key)) {
            if (typeof value === 'number' && Number.isFinite(value)) common[key] = value;
        } else if (key === 'states') {
            common[key] = safeClone(value);
        } else if (typeof value === 'string') common[key] = text(value, key === 'icon' ? 2048 : key === 'desc' ? 512 : 160);
        else if (key === 'name' && row(value)) {
            const translated: Row = {};
            for (const [language, translatedName] of Object.entries(value).slice(0, 32)) {
                if (/^[a-z]{2}(?:-[a-z]{2})?$/i.test(language) && typeof translatedName === 'string') translated[language] = text(translatedName);
            }
            common.name = translated;
        }
    }
    return common;
}
function sameShape(read: Source, write: Source): boolean {
    if (read.type !== write.type) return false;
    return ['unit', 'min', 'max', 'step', 'states'].every(key => JSON.stringify(read.common[key]) === JSON.stringify(write.common[key]));
}
function ownerNative(device: Row, profile: string): Row {
    const tag: Row = { schema: 1, deviceId: device.id };
    const provenance = row(device.importProvenance) ? device.importProvenance : {};
    if (typeof provenance.sourceId === 'string' && provenance.sourceId) tag.sourceId = text(provenance.sourceId, 512);
    if (typeof provenance.controlId === 'string' && provenance.controlId) tag.controlId = text(provenance.controlId, 512);
    const native: Row = { eosSmartHomeAliasOwner: OWNER, eosSmartHomeAlias: tag, eosSmartHomeAliasProfile: profile };
    if (tag.sourceId) native.originalId = tag.sourceId;
    return native;
}
function aliasState(device: Row, config: DeviceControlsConfig, field: ControlMapping, id: string, read: Source | undefined, write: Source | undefined): AliasPlan {
    const source = write ?? read;
    if (!source) return fail('EOS_ALIAS_SOURCE_INVALID');
    const common = sourceMetadata(source, Boolean(read), Boolean(write));
    common.name = `${text(device.alias ?? device.name ?? device.id)} · ${field.key}`;
    const binding: string | Row = read && write && read.id !== write.id ? { read: read.id, write: write.id } : source.id;
    common.alias = { id: binding };
    const native = ownerNative(device, config.profile);
    native.eosSmartHomeAliasField = { schema: 1, key: field.key, ...(read ? { readId: read.id } : {}), ...(write ? { writeId: write.id } : {}) };
    return { id, kind: 'state', object: { type: 'state', common, native,
        acl: { owner: 'system.user.admin', ownerGroup: 'system.group.administrator', object: 0x660, state: 0x660 } } };
}
function knownObject(existing: unknown, plan: AliasPlan): boolean {
    if (!row(existing) || existing.type !== plan.kind || !row(existing.native) || !row(plan.object.native)) return false;
    const native = existing.native; const wanted = plan.object.native;
    if (native.eosSmartHomeAliasOwner !== OWNER) return false;
    if (plan.kind === 'folder') return native.eosSmartHomeAliasRoot === 1;
    if (!row(native.eosSmartHomeAlias) || !row(wanted.eosSmartHomeAlias)
        || native.eosSmartHomeAlias.schema !== 1 || native.eosSmartHomeAlias.deviceId !== wanted.eosSmartHomeAlias.deviceId
        || native.eosSmartHomeAliasProfile !== wanted.eosSmartHomeAliasProfile) return false;
    for (const key of ['sourceId', 'controlId']) if (native.eosSmartHomeAlias[key] !== wanted.eosSmartHomeAlias[key]) return false;
    if (plan.kind === 'channel') return true;
    if (!row(native.eosSmartHomeAliasField) || !row(wanted.eosSmartHomeAliasField)
        || JSON.stringify(native.eosSmartHomeAliasField) !== JSON.stringify(wanted.eosSmartHomeAliasField)
        || !row(existing.common) || !row(plan.object.common) || !row(existing.common.alias) || !row(plan.object.common.alias)) return false;
    return JSON.stringify(existing.common.alias.id) === JSON.stringify(plan.object.common.alias.id)
        && existing.common.type === plan.object.common.type && existing.common.read === plan.object.common.read
        && existing.common.write === plan.object.common.write;
}
async function ensure(plan: AliasPlan, context: Context): Promise<void> {
    context.check();
    const existing = await context.freshObject(plan.id);
    if (existing !== undefined && existing !== null) {
        if (!knownObject(existing, plan)) return fail('EOS_ALIAS_COLLISION');
        context.reused.add(plan.id); return;
    }
    context.uncertain.add(plan.id);
    await context.bounded(() => context.host.createObjectIfAbsent(plan.id, plan.object));
    const stored = await context.freshObject(plan.id);
    if (!knownObject(stored, plan)) return fail('EOS_ALIAS_READBACK_FAILED');
    context.uncertain.delete(plan.id); context.created.add(plan.id);
}
async function sourceFor(config: DeviceControlsConfig, field: ControlMapping, side: 'readId' | 'writeId', context: Context): Promise<Source | undefined> {
    const id = field[side]; if (!id) return undefined;
    const host = { readObject: (sourceId: string) => context.readObject(sourceId), readState: () => Promise.resolve(null) };
    const checked = side === 'readId' ? await validateDeviceControlRead(config, field.key, host) : await validateDeviceControlWrite(config, field.key, host);
    const common = commonOf(await context.readObject(checked.id));
    const alias = row(common.alias);
    if (id.startsWith('alias.') && !alias) return fail('EOS_ALIAS_SOURCE_INVALID');
    return { id, type: checked.type, common, alias };
}

const READ_PATHS = new Set([
    'switch.readId', 'level.readId', 'dimmer.readId', 'color.readId', 'white.readId', 'colorTemperature.readId', 'sensor.readId',
    'cover.positionId', 'cover.readId', 'cover.tiltReadId', 'cover.lockId', 'cover.windAlarmId', 'cover.rainAlarmId', 'cover.frostAlarmId',
    'blind.posReadId', 'climate.currentTempId', 'climate.humidityId', 'climate.demandId', 'climate.windowId', 'climate.errorId',
    'player.playingId', 'player.titleId', 'player.artistId', 'player.sourceId', 'player.coverId', 'player.volumeReadId',
    'player.muteReadId', 'player.powerReadId', 'player.seekReadId', 'camera.urlStateId',
    'indicators.batteryId', 'indicators.unreachableId', 'indicators.errorId',
]);
const WRITE_PATHS = new Set([
    'switch.writeId', 'scene.triggerId', 'level.writeId', 'dimmer.writeId', 'color.writeId', 'white.writeId', 'colorTemperature.writeId', 'sensor.writeId',
    'cover.positionWriteId', 'cover.writeId', 'cover.upId', 'cover.downId', 'cover.stopId', 'cover.tiltWriteId', 'cover.slatsWriteId', 'cover.actionId',
    'blind.posWriteId', 'player.volumeWriteId', 'player.toggleId', 'player.playId', 'player.pauseId', 'player.stopId', 'player.nextId',
    'player.prevId', 'player.muteWriteId', 'player.powerWriteId', 'player.seekWriteId', 'player.ttsWriteId',
]);
const COMBINED_PATHS = new Set([
    'dimmer.levelId', 'color.rgbId', 'color.wwId', 'color.colorTemperatureId', 'dimmer.colorTemperatureId', 'blind.tiltId',
    'climate.setpointId', 'climate.modeId', 'climate.powerId', 'climate.fanSpeedId', 'climate.swingId',
    'player.volumeId', 'player.muteId', 'player.powerId', 'player.seekId', 'player.stationId', 'player.playlistId', 'player.shuffleId', 'player.repeatId', 'player.ttsId',
]);
function rebaseline(device: Row, path: string, previous: string, next: string): void {
    const provenance = row(device.importProvenance) ? device.importProvenance : {};
    const values = row(provenance.sourceValues) ? provenance.sourceValues : {};
    if (Object.hasOwn(values, path) && values[path] === previous) values[path] = next;
}
function rewrite(device: Row, config: DeviceControlsConfig, replacements: Replacement[]): void {
    if (!row(device.io)) return fail('EOS_ALIAS_REQUEST_INVALID');
    for (const field of config.fields) for (const side of ['readId', 'writeId'] as const) {
        const found = replacements.find(replacement => replacement.key === field.key && replacement.side === side);
        if (found) {
            field[side] = found.target;
            rebaseline(device, `io.deviceControls.fields.${field.key}.${side}`, found.source, found.target);
        }
    }
    device.io.deviceControls = config;
    for (const [group, raw] of Object.entries(device.io)) {
        if (group === 'deviceControls' || !row(raw)) continue;
        for (const [key, value] of Object.entries(raw)) {
            if (typeof value !== 'string') continue;
            const path = `${group}.${key}`;
            const side = READ_PATHS.has(path) ? 'readId' : WRITE_PATHS.has(path) ? 'writeId' : null;
            if (!side && !COMBINED_PATHS.has(path)) continue;
            const candidates = replacements.filter(replacement => replacement.source === value && (!side || replacement.side === side));
            const targets = [...new Set(candidates.map(replacement => replacement.target))];
            // Ein historisch kombinierter Pfad darf bei getrennten Alias-Typen nicht willkürlich eine Richtung übernehmen.
            if (targets.length !== 1) continue;
            const target = targets[0]; if (!target) continue;
            raw[key] = target; rebaseline(device, `io.${path}`, value, target);
        }
    }
}

/** Erst werden alle Quellen/Kollisionen geprüft. Danach entstehen ausschließlich fehlende Objekte; Teilstände bleiben für einen bewussten idempotenten Wiederholungsversuch erhalten. */
export async function createDeviceAliases(input: unknown, host: DeviceAliasHost): Promise<DeviceAliasResult> {
    if (creating) return fail('EOS_ALIAS_BUSY');
    const cloned = safeClone(input);
    if (!Array.isArray(cloned) || cloned.length === 0 || cloned.length > MAX_DEVICES) return fail('EOS_ALIAS_REQUEST_LIMIT');
    const devices: Row[] = []; const ids = new Set<string>(); let fields = 0;
    const configs: DeviceControlsConfig[] = [];
    for (const item of cloned as unknown[]) {
        if (!row(item) || typeof item.id !== 'string' || item.id.length === 0 || item.id.length > 80 || ids.has(item.id) || !row(item.io)) return fail('EOS_ALIAS_REQUEST_INVALID');
        const config = normalizeDeviceControls(item.io.deviceControls);
        if (!config) return fail('EOS_ALIAS_MAPPING_REQUIRED');
        fields += config.fields.length; if (fields > MAX_FIELDS) return fail('EOS_ALIAS_REQUEST_LIMIT');
        ids.add(item.id); devices.push(item); configs.push(config);
    }
    creating = true;
    const context = new Context(host);
    try {
        const rootPlan: AliasPlan = { id: ROOT, kind: 'folder', object: { type: 'folder', common: { name: 'NexoWatt EOS' },
            native: { eosSmartHomeAliasOwner: OWNER, eosSmartHomeAliasRoot: 1 } } };
        const plans = new Map<string, AliasPlan>();
        const rewritten: Replacement[][] = [];
        for (let index = 0; index < devices.length; index++) {
            const device = devices[index]; const config = configs[index];
            if (!device || !config) return fail('EOS_ALIAS_REQUEST_INVALID');
            const hash = createHash('sha256').update(`nexowatt-eos-alias-v1\0${String(device.id)}`).digest('hex').slice(0, 24);
            const channel = `${ROOT}.${hash}`; const replacements: Replacement[] = []; let needsChannel = false;
            for (const field of config.fields) {
                const [read, write] = await Promise.all([sourceFor(config, field, 'readId', context), sourceFor(config, field, 'writeId', context)]);
                const combined = read && write && !read.alias && !write.alias && sameShape(read, write);
                for (const [side, source] of [['readId', read], ['writeId', write]] as const) {
                    if (!source) continue;
                    let target: string;
                    if (source.alias) { target = source.id; context.reused.add(source.id); }
                    else {
                        needsChannel = true;
                        const split = Boolean(read && write) && !combined;
                        target = `${channel}.${field.key}${split ? side === 'readId' ? '_READ' : '_WRITE' : ''}`;
                        const plan = aliasState(device, config, field, target, combined || side === 'readId' ? read : undefined, combined || side === 'writeId' ? write : undefined);
                        const prior = plans.get(target);
                        if (prior && !knownObject(prior.object, plan)) return fail('EOS_ALIAS_PLAN_COLLISION');
                        plans.set(target, plan);
                    }
                    replacements.push({ key: field.key, side, source: source.id, target });
                }
            }
            if (needsChannel) {
                plans.set(channel, { id: channel, kind: 'channel', object: { type: 'channel',
                    common: { name: text(device.alias ?? device.name ?? device.id), role: config.profile }, native: ownerNative(device, config.profile) } });
            }
            rewritten.push(replacements);
        }
        const ordered = plans.size ? [rootPlan, ...[...plans.values()].filter(plan => plan.kind === 'channel'), ...[...plans.values()].filter(plan => plan.kind === 'state')] : [];
        // Eine bereits erkennbare fremde Kollision verhindert jede Mutation dieses Auftrags.
        for (const plan of ordered) {
            const existing = await context.readObject(plan.id);
            if (existing !== null && existing !== undefined && !knownObject(existing, plan)) return fail('EOS_ALIAS_COLLISION');
        }
        for (const plan of ordered) await ensure(plan, context);
        for (let index = 0; index < devices.length; index++) {
            const device = devices[index]; const config = configs[index]; const replacements = rewritten[index];
            if (device && config && replacements) rewrite(device, config, replacements);
        }
        return context.result(devices);
    } catch (error: unknown) { throw context.failure(error); }
    finally { creating = false; }
}
