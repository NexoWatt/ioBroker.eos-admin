/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/smarthome-device-aliases.ts
 * Quell-Hash: sha256:b79b8d18d65eecedf5b84203ddf181adfdfeab1fbca2aebbdf373edf60dc08e5
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/smarthome-device-aliases.js.
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
exports.DeviceAliasError = void 0;
exports.createDeviceAliases = createDeviceAliases;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Erstellt auf ausdrücklichen Installer-Auftrag verwaltete ioBroker-Aliasse für gespeicherte Gerätezuordnungen.
 * Daten und Wirkung: Prüft Quellen und vorhandene Objekte, legt ausschließlich fehlende Alias-Objekte an und schreibt niemals Gerätewerte.
 * Bei Änderungen: Idempotenz, fremde Kollisionen, getrennte Leseschreibziele, Teilfehler und unveränderte Kunden-/Raumdaten prüfen.
 */
const node_crypto_1 = require("node:crypto");
const smarthome_device_controls_1 = require("./smarthome-device-controls");
class DeviceAliasError extends Error {
    constructor(code, created = [], reused = [], uncertain = []) {
        super(code);
        this.code = code;
        this.name = 'DeviceAliasError';
        this.created = [...created];
        this.reused = [...reused];
        this.uncertain = [...uncertain];
    }
}
exports.DeviceAliasError = DeviceAliasError;
const ROOT = 'alias.0.nexowatt_eos';
const OWNER = 'nexowatt-eos-smarthome';
const MAX_DEVICES = 100;
const MAX_FIELDS = 2000;
const MAX_READS = 8192;
const DEADLINE_MS = 30000;
let creating = false;
function row(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return (prototype === null || prototype === Object.prototype)
        && !Object.values(Object.getOwnPropertyDescriptors(value)).some(item => typeof item.get === 'function' || typeof item.set === 'function');
}
function fail(code) { throw new DeviceAliasError(code); }
function text(value, max = 160) { return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : ''; }
function safeClone(value) {
    const seen = new Set();
    let budget = 100000;
    function inspect(item, depth) {
        if (--budget < 0 || depth > 24)
            fail('EOS_ALIAS_REQUEST_INVALID');
        if (item === null || typeof item === 'boolean')
            return;
        if (typeof item === 'string') {
            if (item.length > 65536)
                fail('EOS_ALIAS_REQUEST_INVALID');
            return;
        }
        if (typeof item === 'number') {
            if (!Number.isFinite(item))
                fail('EOS_ALIAS_REQUEST_INVALID');
            return;
        }
        if (typeof item !== 'object' || (!row(item) && !Array.isArray(item)) || seen.has(item))
            fail('EOS_ALIAS_REQUEST_INVALID');
        seen.add(item);
        for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(item))) {
            if (['__proto__', 'constructor', 'prototype'].includes(key) || typeof descriptor.get === 'function' || typeof descriptor.set === 'function')
                fail('EOS_ALIAS_REQUEST_INVALID');
            if (Array.isArray(item) && key === 'length')
                continue;
            const entry = descriptor.value;
            inspect(entry, depth + 1);
        }
        seen.delete(item);
    }
    inspect(value, 0);
    const encoded = JSON.stringify(value);
    if (Buffer.byteLength(encoded, 'utf8') > 4194304)
        fail('EOS_ALIAS_REQUEST_LIMIT');
    const cloned = JSON.parse(encoded);
    return cloned;
}
function sourceError(error) {
    if (error instanceof DeviceAliasError)
        return error.code;
    if (error instanceof Error && 'code' in error && typeof error.code === 'string' && /^EOS_CONTROL_[A-Z_]+$/.test(error.code))
        return error.code;
    return 'EOS_ALIAS_OPERATION_FAILED';
}
/** Begrenzte Objektzugriffe ohne Abonnements; auch nach einem Timeout startet kein verspäteter Folgeauftrag. */
class Context {
    constructor(host) {
        this.host = host;
        this.cache = new Map();
        this.queue = [];
        this.active = 0;
        this.reads = 0;
        this.expires = Date.now() + DEADLINE_MS;
        this.created = new Set();
        this.reused = new Set();
        this.uncertain = new Set();
    }
    check() { if (Date.now() >= this.expires)
        fail('EOS_ALIAS_TIMEOUT'); }
    async bounded(operation) {
        this.check();
        let timer;
        try {
            return await Promise.race([
                Promise.resolve().then(() => { this.check(); return operation(); }),
                new Promise((_resolve, reject) => {
                    timer = setTimeout(() => reject(new DeviceAliasError('EOS_ALIAS_TIMEOUT')), Math.max(1, this.expires - Date.now()));
                }),
            ]);
        }
        finally {
            if (timer !== undefined)
                clearTimeout(timer);
        }
    }
    drain() {
        while (this.active < 8) {
            const task = this.queue.shift();
            if (!task)
                return;
            this.active++;
            void task().finally(() => { this.active--; this.drain(); });
        }
    }
    readObject(id) {
        const cached = this.cache.get(id);
        if (cached)
            return cached;
        if (++this.reads > MAX_READS)
            return Promise.reject(new DeviceAliasError('EOS_ALIAS_READ_LIMIT'));
        const pending = new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    resolve(await this.bounded(() => this.host.readObject(id)));
                }
                catch (error) {
                    reject(new DeviceAliasError(sourceError(error)));
                }
            });
            this.drain();
        });
        this.cache.set(id, pending);
        return pending;
    }
    async freshObject(id) {
        this.cache.delete(id);
        return this.readObject(id);
    }
    result(devices) { return { devices, created: [...this.created], reused: [...this.reused] }; }
    failure(error) {
        return new DeviceAliasError(sourceError(error), [...this.created], [...this.reused], [...this.uncertain]);
    }
}
const META_KEYS = ['name', 'desc', 'role', 'unit', 'min', 'max', 'step', 'states', 'icon', 'color'];
function commonOf(source) {
    if (!row(source) || source.type !== 'state' || !row(source.common))
        return fail('EOS_ALIAS_SOURCE_INVALID');
    return source.common;
}
function sourceMetadata(source, read, write) {
    const common = { type: source.type, read, write };
    for (const key of META_KEYS) {
        const value = source.common[key];
        if (value === undefined)
            continue;
        if (['min', 'max', 'step'].includes(key)) {
            if (typeof value === 'number' && Number.isFinite(value))
                common[key] = value;
        }
        else if (key === 'states') {
            common[key] = safeClone(value);
        }
        else if (typeof value === 'string')
            common[key] = text(value, key === 'icon' ? 2048 : key === 'desc' ? 512 : 160);
        else if (key === 'name' && row(value)) {
            const translated = {};
            for (const [language, translatedName] of Object.entries(value).slice(0, 32)) {
                if (/^[a-z]{2}(?:-[a-z]{2})?$/i.test(language) && typeof translatedName === 'string')
                    translated[language] = text(translatedName);
            }
            common.name = translated;
        }
    }
    return common;
}
function sameShape(read, write) {
    if (read.type !== write.type)
        return false;
    return ['unit', 'min', 'max', 'step', 'states'].every(key => JSON.stringify(read.common[key]) === JSON.stringify(write.common[key]));
}
function ownerNative(device, profile) {
    const tag = { schema: 1, deviceId: device.id };
    const provenance = row(device.importProvenance) ? device.importProvenance : {};
    if (typeof provenance.sourceId === 'string' && provenance.sourceId)
        tag.sourceId = text(provenance.sourceId, 512);
    if (typeof provenance.controlId === 'string' && provenance.controlId)
        tag.controlId = text(provenance.controlId, 512);
    const native = { eosSmartHomeAliasOwner: OWNER, eosSmartHomeAlias: tag, eosSmartHomeAliasProfile: profile };
    if (tag.sourceId)
        native.originalId = tag.sourceId;
    return native;
}
function aliasState(device, config, field, id, read, write) {
    const source = write ?? read;
    if (!source)
        return fail('EOS_ALIAS_SOURCE_INVALID');
    const common = sourceMetadata(source, Boolean(read), Boolean(write));
    common.name = `${text(device.alias ?? device.name ?? device.id)} · ${field.key}`;
    const binding = read && write && read.id !== write.id ? { read: read.id, write: write.id } : source.id;
    common.alias = { id: binding };
    const native = ownerNative(device, config.profile);
    native.eosSmartHomeAliasField = { schema: 1, key: field.key, ...(read ? { readId: read.id } : {}), ...(write ? { writeId: write.id } : {}) };
    return { id, kind: 'state', object: { type: 'state', common, native,
            acl: { owner: 'system.user.admin', ownerGroup: 'system.group.administrator', object: 0x660, state: 0x660 } } };
}
function knownObject(existing, plan) {
    if (!row(existing) || existing.type !== plan.kind || !row(existing.native) || !row(plan.object.native))
        return false;
    const native = existing.native;
    const wanted = plan.object.native;
    if (native.eosSmartHomeAliasOwner !== OWNER)
        return false;
    if (plan.kind === 'folder')
        return native.eosSmartHomeAliasRoot === 1;
    if (!row(native.eosSmartHomeAlias) || !row(wanted.eosSmartHomeAlias)
        || native.eosSmartHomeAlias.schema !== 1 || native.eosSmartHomeAlias.deviceId !== wanted.eosSmartHomeAlias.deviceId
        || native.eosSmartHomeAliasProfile !== wanted.eosSmartHomeAliasProfile)
        return false;
    for (const key of ['sourceId', 'controlId'])
        if (native.eosSmartHomeAlias[key] !== wanted.eosSmartHomeAlias[key])
            return false;
    if (plan.kind === 'channel')
        return true;
    if (!row(native.eosSmartHomeAliasField) || !row(wanted.eosSmartHomeAliasField)
        || JSON.stringify(native.eosSmartHomeAliasField) !== JSON.stringify(wanted.eosSmartHomeAliasField)
        || !row(existing.common) || !row(plan.object.common) || !row(existing.common.alias) || !row(plan.object.common.alias))
        return false;
    return JSON.stringify(existing.common.alias.id) === JSON.stringify(plan.object.common.alias.id)
        && existing.common.type === plan.object.common.type && existing.common.read === plan.object.common.read
        && existing.common.write === plan.object.common.write;
}
async function ensure(plan, context) {
    context.check();
    const existing = await context.freshObject(plan.id);
    if (existing !== undefined && existing !== null) {
        if (!knownObject(existing, plan))
            return fail('EOS_ALIAS_COLLISION');
        context.reused.add(plan.id);
        return;
    }
    context.uncertain.add(plan.id);
    await context.bounded(() => context.host.createObjectIfAbsent(plan.id, plan.object));
    const stored = await context.freshObject(plan.id);
    if (!knownObject(stored, plan))
        return fail('EOS_ALIAS_READBACK_FAILED');
    context.uncertain.delete(plan.id);
    context.created.add(plan.id);
}
async function sourceFor(config, field, side, context) {
    const id = field[side];
    if (!id)
        return undefined;
    const host = { readObject: (sourceId) => context.readObject(sourceId), readState: () => Promise.resolve(null) };
    const checked = side === 'readId' ? await (0, smarthome_device_controls_1.validateDeviceControlRead)(config, field.key, host) : await (0, smarthome_device_controls_1.validateDeviceControlWrite)(config, field.key, host);
    const common = commonOf(await context.readObject(checked.id));
    const alias = row(common.alias);
    if (id.startsWith('alias.') && !alias)
        return fail('EOS_ALIAS_SOURCE_INVALID');
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
function rebaseline(device, path, previous, next) {
    const provenance = row(device.importProvenance) ? device.importProvenance : {};
    const values = row(provenance.sourceValues) ? provenance.sourceValues : {};
    if (Object.hasOwn(values, path) && values[path] === previous)
        values[path] = next;
}
function rewrite(device, config, replacements) {
    if (!row(device.io))
        return fail('EOS_ALIAS_REQUEST_INVALID');
    for (const field of config.fields)
        for (const side of ['readId', 'writeId']) {
            const found = replacements.find(replacement => replacement.key === field.key && replacement.side === side);
            if (found) {
                field[side] = found.target;
                rebaseline(device, `io.deviceControls.fields.${field.key}.${side}`, found.source, found.target);
            }
        }
    device.io.deviceControls = config;
    for (const [group, raw] of Object.entries(device.io)) {
        if (group === 'deviceControls' || !row(raw))
            continue;
        for (const [key, value] of Object.entries(raw)) {
            if (typeof value !== 'string')
                continue;
            const path = `${group}.${key}`;
            const side = READ_PATHS.has(path) ? 'readId' : WRITE_PATHS.has(path) ? 'writeId' : null;
            if (!side && !COMBINED_PATHS.has(path))
                continue;
            const candidates = replacements.filter(replacement => replacement.source === value && (!side || replacement.side === side));
            const targets = [...new Set(candidates.map(replacement => replacement.target))];
            // Ein historisch kombinierter Pfad darf bei getrennten Alias-Typen nicht willkürlich eine Richtung übernehmen.
            if (targets.length !== 1)
                continue;
            const target = targets[0];
            if (!target)
                continue;
            raw[key] = target;
            rebaseline(device, `io.${path}`, value, target);
        }
    }
}
/** Erst werden alle Quellen/Kollisionen geprüft. Danach entstehen ausschließlich fehlende Objekte; Teilstände bleiben für einen bewussten idempotenten Wiederholungsversuch erhalten. */
async function createDeviceAliases(input, host) {
    if (creating)
        return fail('EOS_ALIAS_BUSY');
    const cloned = safeClone(input);
    if (!Array.isArray(cloned) || cloned.length === 0 || cloned.length > MAX_DEVICES)
        return fail('EOS_ALIAS_REQUEST_LIMIT');
    const devices = [];
    const ids = new Set();
    let fields = 0;
    const configs = [];
    for (const item of cloned) {
        if (!row(item) || typeof item.id !== 'string' || item.id.length === 0 || item.id.length > 80 || ids.has(item.id) || !row(item.io))
            return fail('EOS_ALIAS_REQUEST_INVALID');
        const config = (0, smarthome_device_controls_1.normalizeDeviceControls)(item.io.deviceControls);
        if (!config)
            return fail('EOS_ALIAS_MAPPING_REQUIRED');
        fields += config.fields.length;
        if (fields > MAX_FIELDS)
            return fail('EOS_ALIAS_REQUEST_LIMIT');
        ids.add(item.id);
        devices.push(item);
        configs.push(config);
    }
    creating = true;
    const context = new Context(host);
    try {
        const rootPlan = { id: ROOT, kind: 'folder', object: { type: 'folder', common: { name: 'NexoWatt EOS' },
                native: { eosSmartHomeAliasOwner: OWNER, eosSmartHomeAliasRoot: 1 } } };
        const plans = new Map();
        const rewritten = [];
        for (let index = 0; index < devices.length; index++) {
            const device = devices[index];
            const config = configs[index];
            if (!device || !config)
                return fail('EOS_ALIAS_REQUEST_INVALID');
            const hash = (0, node_crypto_1.createHash)('sha256').update(`nexowatt-eos-alias-v1\0${String(device.id)}`).digest('hex').slice(0, 24);
            const channel = `${ROOT}.${hash}`;
            const replacements = [];
            let needsChannel = false;
            for (const field of config.fields) {
                const [read, write] = await Promise.all([sourceFor(config, field, 'readId', context), sourceFor(config, field, 'writeId', context)]);
                const combined = read && write && !read.alias && !write.alias && sameShape(read, write);
                for (const [side, source] of [['readId', read], ['writeId', write]]) {
                    if (!source)
                        continue;
                    let target;
                    if (source.alias) {
                        target = source.id;
                        context.reused.add(source.id);
                    }
                    else {
                        needsChannel = true;
                        const split = Boolean(read && write) && !combined;
                        target = `${channel}.${field.key}${split ? side === 'readId' ? '_READ' : '_WRITE' : ''}`;
                        const plan = aliasState(device, config, field, target, combined || side === 'readId' ? read : undefined, combined || side === 'writeId' ? write : undefined);
                        const prior = plans.get(target);
                        if (prior && !knownObject(prior.object, plan))
                            return fail('EOS_ALIAS_PLAN_COLLISION');
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
            if (existing !== null && existing !== undefined && !knownObject(existing, plan))
                return fail('EOS_ALIAS_COLLISION');
        }
        for (const plan of ordered)
            await ensure(plan, context);
        for (let index = 0; index < devices.length; index++) {
            const device = devices[index];
            const config = configs[index];
            const replacements = rewritten[index];
            if (device && config && replacements)
                rewrite(device, config, replacements);
        }
        return context.result(devices);
    }
    catch (error) {
        throw context.failure(error);
    }
    finally {
        creating = false;
    }
}
