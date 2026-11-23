/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/smarthome-device-controls.ts
 * Quell-Hash: sha256:e3e9cc8bdca359aca7821754aa5085333de61b99c598fdd55fafba4b2fb20cb9
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/smarthome-device-controls.js.
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
exports.DeviceControlError = void 0;
exports.getControlProfiles = getControlProfiles;
exports.normalizeDeviceControls = normalizeDeviceControls;
exports.buildDeviceControls = buildDeviceControls;
exports.validateDeviceControlRead = validateDeviceControlRead;
exports.validateDeviceControlWrite = validateDeviceControlWrite;
exports.executeDeviceControl = executeDeviceControl;
exports.executeDeviceControlBatch = executeDeviceControlBatch;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Stellt alle TypeDetector-Gerätefelder als geprüfte EOS-Bedienfähigkeiten bereit.
 * Daten und Wirkung: Liest nur gespeicherte Zuordnungen; schreibt erst nach Katalog-, Objekt-, Werte- und Schutzprüfung.
 * Bei Änderungen: Katalogabdeckung, Schreibgrenzen, unbekannte Werte, Schutzmeldungen und Zeitüberschreitungen prüfen.
 */
const type_detector_1 = require("@iobroker/type-detector");
const smarthome_custom_contract_1 = require("./smarthome-custom-contract");
/** Fehler enthalten ausschließlich feste Codes; weder Datenpunkt-ID noch fremde Fehlermeldungen werden ausgegeben. */
class DeviceControlError extends Error {
    constructor(code) {
        super(code);
        this.code = code;
        this.name = 'DeviceControlError';
    }
}
exports.DeviceControlError = DeviceControlError;
const SCALAR_TYPES = ['boolean', 'number', 'string'];
const MAX_FIELDS = 128;
const MAX_READS = 512;
const MAX_PARALLEL_READS = 8;
const DEADLINE_MS = 5000;
const MAX_READ_STRING = 8192;
const MAX_MAP_STRING = 1048576;
const MAX_DTO_BYTES = 1048576;
const MAX_WRITE_STRING = 8192;
const MAX_OPTIONS = 256;
const COVER_PROFILES = new Set(['blind', 'blindButtons', 'gate']);
const COVER_PROTECTIONS = ['LOCKED', 'WIND_ALARM', 'RAIN_ALARM', 'FROST_ALARM'];
const MOVEMENT_KEYS = new Set(['SET', 'OPEN', 'CLOSE', 'TILT_SET', 'TILT_OPEN', 'TILT_CLOSE']);
const COLOR_PROFILES = new Set(['rgb', 'rgbSingle', 'rgbwSingle', 'hue', 'cie', 'ct']);
const COLOR_KEYS = new Set(['RED', 'GREEN', 'BLUE', 'WHITE', 'RGB', 'RGBW', 'HUE', 'SATURATION', 'CIE', 'TEMPERATURE', 'DIMMER', 'BRIGHTNESS']);
const pendingClimateWrites = new Map();
const LABELS = {
    SET: 'Sollwert', ACTUAL: 'Istwert', ON: 'Ein / Aus', ON_SET: 'Ein / Aus', ON_ACTUAL: 'Schaltzustand',
    POWER: 'Ein / Aus', STOP: 'Stopp', OPEN: 'Öffnen', CLOSE: 'Schließen', TILT_SET: 'Lamellenposition',
    TILT_ACTUAL: 'Lamellen-Istwert', TILT_STOP: 'Lamellen stoppen', TILT_OPEN: 'Lamellen öffnen',
    TILT_CLOSE: 'Lamellen schließen', LOCKED: 'Gesperrt', WIND_ALARM: 'Windschutz', RAIN_ALARM: 'Regenschutz',
    FROST_ALARM: 'Frostschutz', UNREACH: 'Nicht erreichbar', LOWBAT: 'Batterie schwach', BATTERY: 'Batterie',
    MAINTAIN: 'Wartung', ERROR: 'Fehler', WORKING: 'In Betrieb', RSSI: 'Signalstärke',
    MODE: 'Betriebsart', SPEED: 'Geschwindigkeit', TEMPERATURE: 'Temperatur', HUMIDITY: 'Luftfeuchtigkeit',
    PLAY: 'Wiedergabe', PAUSE: 'Pause', NEXT: 'Weiter', PREV: 'Zurück', MUTE: 'Stumm', VOLUME: 'Lautstärke',
    KEY: 'Fernbedienung', INPUT: 'Eingang', APP: 'Anwendung', HOME: 'Zur Station',
    PRESS: 'Tastendruck', PRESS_LONG: 'Langer Tastendruck', DOOR_STATE: 'Türzustand',
};
const PROFILE_LABELS = {
    chart: 'Diagramm', tv: 'Fernseher', media: 'Medienplayer', weatherForecast: 'Wettervorhersage',
    rgb: 'RGB-Licht', rgbwSingle: 'RGBW-Licht', rgbSingle: 'RGB-Farbwert', cie: 'CIE-Licht', hue: 'Farbton-Licht',
    ct: 'Farbtemperatur', warning: 'Warnmeldung', airCondition: 'Klimaanlage', airPurifier: 'Luftreiniger',
    fan: 'Ventilator', thermostat: 'Thermostat', vacuumCleaner: 'Saugroboter', blind: 'Rollladen / Jalousie',
    blindButtons: 'Rollladen-Tasten', gate: 'Tor', weatherCurrent: 'Wetter aktuell', camera: 'Kamera',
    lock: 'Türschloss', motion: 'Bewegungsmelder', contact: 'Kontakt', window: 'Fenster', windowTilt: 'Fensterstellung',
    fireAlarm: 'Brandmelder', coAlarm: 'CO-Melder', floodAlarm: 'Wassermelder', door: 'Türkontakt',
    dimmer: 'Dimmer', light: 'Licht', volume: 'Lautstärke', locationOne: 'Position', location: 'Koordinaten',
    volumeGroup: 'Lautstärkegruppe', pump: 'Pumpe', percentage: 'Prozentwert', slider: 'Stellwert',
    socket: 'Steckdose', button: 'Taster', buttonSensor: 'Tastensensor', airQuality: 'Luftqualität',
    temperature: 'Temperatur', humidity: 'Luftfeuchtigkeit', illuminance: 'Helligkeit', pressure: 'Druck',
    flow: 'Durchfluss', fillLevel: 'Füllstand', image: 'Bild', electricity: 'Elektrische Messwerte',
    info: 'Information', universal: 'Universelles Gerät',
};
function isRecord(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return (prototype === null || prototype === Object.prototype)
        && !Object.values(Object.getOwnPropertyDescriptors(value)).some(descriptor => typeof descriptor.get === 'function' || typeof descriptor.set === 'function');
}
function fail(code) { throw new DeviceControlError(code); }
function scalarType(value) {
    return value === 'boolean' || value === 'number' || value === 'string';
}
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function text(value, maximum = 160) {
    return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maximum) : '';
}
function label(key) { return LABELS[key] ?? key.replace(/_/g, ' '); }
function typeOf(types) { return types.length === 1 ? types[0] ?? 'mixed' : 'mixed'; }
function scalar(value, type, limit) {
    return typeof value === type && (type !== 'number' || finite(value))
        && (typeof value !== 'string' || value.length <= limit);
}
function keyValue(key, type) {
    if (type === 'string')
        return key;
    if (type === 'number')
        return key.trim() && finite(Number(key)) ? Number(key) : null;
    return key === 'true' || key === '1' ? true : key === 'false' || key === '0' ? false : null;
}
function optionsFor(value, type) {
    if (value === undefined || value === null)
        return [];
    if (typeof value === 'string') {
        if (value.length > 65536)
            return fail('EOS_CONTROL_ENUM_INVALID');
        if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
            try {
                const parsed = JSON.parse(value);
                return optionsFor(parsed, type);
            }
            catch {
                return fail('EOS_CONTROL_ENUM_INVALID');
            }
        }
        const legacy = Object.create(null);
        for (const entry of value.split(';')) {
            const separator = entry.indexOf(':');
            if (separator <= 0)
                return fail('EOS_CONTROL_ENUM_INVALID');
            const key = entry.slice(0, separator);
            if (Object.hasOwn(legacy, key))
                return fail('EOS_CONTROL_ENUM_INVALID');
            legacy[key] = entry.slice(separator + 1);
        }
        return optionsFor(legacy, type);
    }
    let source;
    if (Array.isArray(value))
        source = Object.fromEntries(value.map((entry, index) => [String(index), entry]));
    else if (isRecord(value))
        source = value;
    else
        return fail('EOS_CONTROL_ENUM_INVALID');
    const entries = Object.entries(source);
    if (entries.length > MAX_OPTIONS)
        return fail('EOS_CONTROL_ENUM_INVALID');
    const result = [];
    for (const [key, entry] of entries) {
        const converted = keyValue(key, type);
        if (converted === null || typeof entry !== 'string' || key.length > MAX_WRITE_STRING) {
            return fail('EOS_CONTROL_ENUM_INVALID');
        }
        if (!result.some(option => option.value === converted))
            result.push({ value: converted, label: text(entry) });
    }
    return result;
}
function defaultOptions(value, type) {
    // Einige Detector-Varianten teilen einen Feldnamen, aber nicht dessen Enum-Semantik (z.B. SWING als Zahl oder Boolean).
    try {
        return optionsFor(value, type);
    }
    catch {
        return [];
    }
}
function kindFor(type, write, indicator, momentary, hasOptions) {
    if (indicator)
        return 'indicator';
    if (!write)
        return 'readout';
    if (hasOptions)
        return 'select';
    if (momentary && type === 'boolean')
        return 'button';
    return type === 'boolean' ? 'toggle' : type === 'number' ? 'range' : 'text';
}
function detectorField(state) {
    const types = state.type === undefined ? [...SCALAR_TYPES]
        : Array.isArray(state.type) ? state.type.filter(scalarType) : [state.type];
    const type = typeOf(types);
    const write = state.write === true && state.indicator !== true;
    const momentary = write && state.noSubscribe === true;
    const options = optionsFor(state.defaultStates, type === 'mixed' ? 'string' : type);
    const field = {
        key: state.name, label: label(state.name), type, types,
        read: state.read !== false, write, indicator: state.indicator === true,
        kind: kindFor(type, write, state.indicator === true, momentary, options.length > 0),
        unit: text(state.defaultUnit ?? state.unit, 32), options,
        required: state.required === true || Boolean(state.requiredOneOf),
        statesRequired: state.statesDefined === true, momentary,
    };
    if (state.defaultStates !== undefined)
        field.defaultStates = { ...state.defaultStates };
    if (momentary && type === 'boolean')
        field.commandValue = true;
    return field;
}
function makeCatalog() {
    const result = new Map();
    for (const pattern of Object.values(type_detector_1.default.getPatterns())) {
        const id = String(pattern.type);
        let profile = result.get(id);
        if (!profile) {
            profile = { id, label: PROFILE_LABELS[id] ?? id, fields: [] };
            result.set(id, profile);
        }
        for (const state of pattern.states) {
            const field = detectorField(state);
            const existing = profile.fields.find(candidate => candidate.key === field.key);
            if (!existing)
                profile.fields.push(field);
            else {
                existing.types = [...new Set([...existing.types, ...field.types])];
                existing.type = typeOf(existing.types);
                existing.read || (existing.read = field.read);
                existing.write || (existing.write = field.write);
                existing.required || (existing.required = field.required === true);
            }
        }
        if (COVER_PROFILES.has(id))
            for (const key of COVER_PROTECTIONS) {
                if (!profile.fields.some(field => field.key === key))
                    profile.fields.push({
                        key, label: label(key), type: 'mixed', types: [...SCALAR_TYPES], read: true, write: false,
                        kind: 'indicator', unit: '', indicator: true,
                    });
            }
    }
    addManualReferenceSlots(result);
    for (const profile of (0, smarthome_custom_contract_1.getCustomControlProfiles)())
        result.set(profile.id, {
            id: profile.id, label: profile.label,
            fields: profile.fields.map(field => ({ ...field, types: [...field.types] })),
        });
    result.set('universal', { id: 'universal', label: PROFILE_LABELS.universal ?? 'Universal', fields: [] });
    return result;
}
const CATALOG = makeCatalog();
/** Die Referenzoberflächen akzeptieren zusätzliche explizite Zuordnungen; diese Metadaten erfinden keine Erkennung und keine Ziel-ID. */
function addManualReferenceSlots(catalog) {
    const add = (profileId, key, types, write = false, fieldLabel) => {
        const profile = catalog.get(profileId);
        if (!profile || profile.fields.some(field => field.key === key))
            return;
        const type = typeOf(types);
        profile.fields.push({ key, label: fieldLabel ?? label(key), type, types: [...types],
            read: true, write, kind: kindFor(type, write, false, false, false), unit: '', indicator: false, manualOnly: true });
    };
    for (const profile of COLOR_PROFILES) {
        add(profile, 'SET', ['number'], true, 'Helligkeit');
        add(profile, 'ACTUAL', ['number'], false, 'Helligkeitsrückmeldung');
        add(profile, 'ON_SET', ['boolean'], true, 'Ein / Aus');
        add(profile, 'ON_ACTUAL', ['boolean']);
    }
    add('percentage', 'ON', ['boolean'], true);
    add('percentage', 'ON_ACTUAL', ['boolean']);
    add('socket', 'ON_ACTUAL', ['boolean']);
    add('light', 'ACTUAL', ['boolean']);
    add('humidity', 'SECOND', ['number'], false, 'Temperatur');
    add('media', 'SET', ['number'], true, 'Lautstärke');
    const mediaState = catalog.get('media')?.fields.find(field => field.key === 'STATE');
    if (mediaState) {
        mediaState.write = true;
        mediaState.manualWriteOnly = true;
        mediaState.kind = kindFor(mediaState.type, true, false, false, Boolean(mediaState.options?.length));
    }
    for (const key of ['PRESSURE', 'FLOW', 'AQI', 'ELECTRIC_POWER', 'CONSUMPTION', 'CURRENT', 'VOLTAGE', 'FREQUENCY']) {
        add('info', key, [...SCALAR_TYPES]);
    }
    add('location', 'GPS', ['string']);
    add('locationOne', 'LATITUDE', ['number']);
    add('locationOne', 'LONGITUDE', ['number']);
}
/** Gibt kopierte öffentliche Metadaten zurück; Aufrufer können den zentralen Katalog nicht verändern. */
function getControlProfiles() {
    return [...CATALOG.values()].map(profile => ({ id: profile.id, label: profile.label,
        fields: profile.fields.map(field => {
            const output = {
                key: field.key, label: field.label, type: field.type, types: [...field.types],
                read: field.read, write: field.write, kind: field.kind, unit: field.unit, indicator: field.indicator,
            };
            if (field.options)
                output.options = field.options.map(option => ({ ...option }));
            if (field.required !== undefined)
                output.required = field.required;
            if (field.commandValue !== undefined)
                output.commandValue = field.commandValue;
            if (field.manualOnly !== undefined)
                output.manualOnly = field.manualOnly;
            if (field.manualWriteOnly !== undefined)
                output.manualWriteOnly = field.manualWriteOnly;
            return output;
        }),
    }));
}
function fieldFor(profile, key) {
    const exact = profile.fields.find(field => field.key === key);
    if (exact)
        return exact;
    // Wetterprognosen ersetzen %d durch den vom Detector erkannten Tagesindex.
    const template = profile.fields.find(field => field.key.endsWith('%d')
        && key.startsWith(field.key.slice(0, -2)) && /^\d{1,3}$/.test(key.slice(field.key.length - 2)));
    if (template)
        return { ...template, key, label: label(key) };
    if (profile.id === 'universal')
        return {
            key, label: label(key), type: 'mixed', types: [...SCALAR_TYPES], read: true, write: true,
            kind: 'text', unit: '', indicator: false,
        };
    return undefined;
}
function validId(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 512
        && value === value.trim() && !/[\u0000-\u0020\u007f*?\[\]{}]/.test(value)
        && !/^(?:system\.|admin\.\d+(?:\.|$))/i.test(value)
        && !/(?:^|\.)(?:__proto__|prototype|constructor|[^.]*(?:password|passwd|secret|credentials?|private.?key|access.?token|refresh.?token|api.?key)|token)(?:\.|$)/i.test(value);
}
/** Nur vom Installer gespeicherte Fähigkeiten und konkrete IDs werden akzeptiert, niemals eine Schreib-ID aus einem Bedienbefehl. */
function normalizeDeviceControls(value) {
    if (value === undefined || value === null)
        return null;
    if (!isRecord(value) || typeof value.profile !== 'string' || !Array.isArray(value.fields)
        || Object.keys(value).some(key => key !== 'profile' && key !== 'fields'))
        return fail('EOS_CONTROL_CONFIG_INVALID');
    const profile = CATALOG.get(value.profile);
    if (!profile || value.fields.length > MAX_FIELDS)
        return fail('EOS_CONTROL_CONFIG_INVALID');
    const fields = [];
    const keys = new Set();
    for (const raw of value.fields) {
        if (!isRecord(raw) || typeof raw.key !== 'string' || !/^[A-Z][A-Z0-9_]*(?:%d)?$/.test(raw.key)
            || raw.key.length > 80 || keys.has(raw.key)
            || Object.keys(raw).some(key => !['key', 'readId', 'writeId'].includes(key)))
            return fail('EOS_CONTROL_CONFIG_INVALID');
        const field = fieldFor(profile, raw.key);
        if (!field)
            return fail('EOS_CONTROL_FIELD_UNKNOWN');
        const mapping = { key: raw.key };
        for (const side of ['readId', 'writeId']) {
            if (raw[side] === undefined || raw[side] === '')
                continue;
            if (!validId(raw[side]))
                return fail('EOS_CONTROL_ID_FORBIDDEN');
            if ((side === 'readId' && !field.read) || (side === 'writeId' && !field.write))
                return fail('EOS_CONTROL_CAPABILITY_INVALID');
            mapping[side] = raw[side];
        }
        keys.add(raw.key);
        fields.push(mapping);
    }
    return { profile: profile.id, fields };
}
/** Ein Aufruf hat genau ein Zeitbudget und maximal acht gleichzeitige Reads; abgelaufene Arbeit beginnt keine weiteren Reads oder Writes. */
class ReadContext {
    constructor(host, options = {}) {
        this.host = host;
        this.cache = new Map();
        this.queue = [];
        this.active = 0;
        this.started = 0;
        this.bytes = 0;
        this.expires = Date.now() + DEADLINE_MS;
        this.staleAfterMs = finite(options.staleAfterMs) && options.staleAfterMs > 0 ? options.staleAfterMs : 0;
    }
    reserveField(field) {
        const size = Buffer.byteLength(JSON.stringify(field), 'utf8');
        // Platz für die kleinen expliziten Fehlerfelder bleibt selbst bei einem sehr großen Kartenwert erhalten.
        if (this.bytes + size > MAX_DTO_BYTES - MAX_FIELDS * 1024) {
            field.value = null;
            field.valid = false;
            field.writable = false;
            field.options = [];
            field.error = 'EOS_CONTROL_VALUE_LIMIT';
        }
        this.bytes += Buffer.byteLength(JSON.stringify(field), 'utf8');
    }
    check() { if (Date.now() >= this.expires)
        fail('EOS_CONTROL_TIMEOUT'); }
    async bounded(operation, write = false) {
        this.check();
        let timer;
        try {
            return await Promise.race([
                Promise.resolve().then(() => { this.check(); return operation(); }),
                new Promise((_resolve, reject) => {
                    timer = setTimeout(() => reject(new DeviceControlError(write ? 'EOS_CONTROL_WRITE_UNCERTAIN' : 'EOS_CONTROL_TIMEOUT')), Math.max(1, this.expires - Date.now()));
                }),
            ]);
        }
        catch (error) {
            if (error instanceof DeviceControlError)
                throw error;
            return fail(write ? 'EOS_CONTROL_WRITE_FAILED' : 'EOS_CONTROL_READ_FAILED');
        }
        finally {
            if (timer !== undefined)
                clearTimeout(timer);
        }
    }
    drain() {
        while (this.active < MAX_PARALLEL_READS) {
            const task = this.queue.shift();
            if (!task)
                return;
            this.active++;
            // task fängt jeden Fehler selbst; finally gibt lediglich den begrenzten Slot frei.
            void task().finally(() => { this.active--; this.drain(); });
        }
    }
    run(kind, id) {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    this.check();
                    resolve(await this.bounded(() => kind === 'object' ? this.host.readObject(id) : this.host.readState(id)));
                }
                catch (error) {
                    reject(error instanceof DeviceControlError ? error : new DeviceControlError('EOS_CONTROL_READ_FAILED'));
                }
            });
            this.drain();
        });
    }
    read(kind, id) {
        const cacheKey = `${kind}:${id}`;
        let pending = this.cache.get(cacheKey);
        if (!pending) {
            if (++this.started > MAX_READS)
                return Promise.reject(new DeviceControlError('EOS_CONTROL_READ_LIMIT'));
            pending = this.run(kind, id);
            this.cache.set(cacheKey, pending);
        }
        return pending;
    }
}
function metadata(value, field) {
    if (!isRecord(value) || value.type !== 'state' || !isRecord(value.common))
        return fail('EOS_CONTROL_OBJECT_INVALID');
    const common = value.common;
    if (!scalarType(common.type) || !field.types.includes(common.type))
        return fail('EOS_CONTROL_TYPE_INVALID');
    if (typeof common.role === 'string' && /(?:password|passwd|secret|credential|private.?key|auth(?:entication)?|access.?token|apikey)/i.test(common.role)) {
        return fail('EOS_CONTROL_ID_FORBIDDEN');
    }
    if (common.type === 'string' && (common.password === true || common.encrypted === true))
        return fail('EOS_CONTROL_ID_FORBIDDEN');
    if (isRecord(common.alias)) {
        const target = common.alias.id;
        const ids = isRecord(target) ? Object.values(target) : [target];
        if (ids.length === 0 || ids.some(id => !validId(id)))
            return fail('EOS_CONTROL_ID_FORBIDDEN');
    }
    const actualOptions = optionsFor(common.states, common.type);
    const options = common.states === undefined || common.states === null
        ? defaultOptions(field.defaultStates, common.type) : actualOptions;
    const result = {
        type: common.type, read: common.read !== false && field.read,
        write: common.write === true && field.write && (!field.statesRequired || actualOptions.length > 0),
        unit: text(common.unit, 32) || field.unit, options,
        optionsAuthoritative: common.states !== undefined && common.states !== null,
        momentary: field.momentary === true || (typeof common.role === 'string' && /^button(?:\.|$)/.test(common.role)),
    };
    for (const key of ['min', 'max', 'step']) {
        if (common[key] !== undefined && common[key] !== null) {
            if (!finite(common[key]) || (key === 'step' && common[key] <= 0))
                return fail('EOS_CONTROL_BOUNDS_INVALID');
            result[key] = common[key];
        }
    }
    if (result.min !== undefined && result.max !== undefined && result.min > result.max)
        return fail('EOS_CONTROL_BOUNDS_INVALID');
    return result;
}
async function resolvedMetadata(context, id, field, direction) {
    let current = id;
    let first;
    let permitted = true;
    const visited = new Set();
    for (let depth = 0; depth <= 8; depth++) {
        if (!validId(current))
            return fail('EOS_CONTROL_ID_FORBIDDEN');
        if (visited.has(current))
            return fail('EOS_CONTROL_ALIAS_CYCLE');
        visited.add(current);
        const raw = await context.read('object', current);
        // Der Controller konvertiert konfigurierte Aliasse einschließlich seiner normalen Typ-/Prozentskalierung.
        // Hier werden der sichtbare Alias-Typ und danach ausschließlich sichere Zielmetadaten/Rechte geprüft.
        const meta = metadata(raw, depth === 0 ? field : { ...field, types: [...SCALAR_TYPES], statesRequired: false });
        if (!first)
            first = meta;
        permitted && (permitted = meta[direction]);
        const common = isRecord(raw) && isRecord(raw.common) ? raw.common : {};
        if (common.alias === undefined || common.alias === null)
            return { ...first, [direction]: permitted };
        if (!isRecord(common.alias))
            return fail('EOS_CONTROL_ALIAS_INVALID');
        const target = common.alias.id;
        const next = isRecord(target) ? target[direction] : target;
        if (!validId(next))
            return fail('EOS_CONTROL_ID_FORBIDDEN');
        current = next;
    }
    return fail('EOS_CONTROL_ALIAS_LIMIT');
}
function inBounds(value, meta) {
    if (typeof value === 'number' && ((meta.min !== undefined && value < meta.min) || (meta.max !== undefined && value > meta.max)))
        return false;
    return !meta.optionsAuthoritative || meta.options.length === 0 || meta.options.some(option => option.value === value);
}
function matchesStep(value, meta) {
    if (typeof value !== 'number' || meta.step === undefined)
        return true;
    const steps = (value - (meta.min ?? 0)) / meta.step;
    return finite(steps) && Math.abs(steps - Math.round(steps)) <= 1e-8 * Math.max(1, Math.abs(steps));
}
function stateValue(raw, meta, maximum = MAX_READ_STRING, staleAfterMs = 0) {
    if (!isRecord(raw) || !scalar(raw.val, meta.type, maximum)
        || (raw.q !== undefined && raw.q !== 0) || !inBounds(raw.val, meta))
        return null;
    if (staleAfterMs > 0 && (!finite(raw.ts) || raw.ts < 0 || raw.ts > Date.now() + 5000 || Date.now() - raw.ts > staleAfterMs))
        return null;
    return raw.val;
}
function protectionActive(value) {
    if (typeof value === 'boolean')
        return value;
    if (finite(value))
        return value !== 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'on', 'yes', 'ja', 'active', 'alarm', 'locked', 'open'].includes(normalized))
            return true;
        if (['false', '0', 'off', 'no', 'nein', 'inactive', 'ok', 'unlocked', 'closed'].includes(normalized))
            return false;
    }
    return null;
}
function errorCode(error) {
    return error instanceof DeviceControlError ? error.code : 'EOS_CONTROL_READ_FAILED';
}
function numericMetadata(meta) {
    const result = {};
    for (const key of ['min', 'max', 'step'])
        if (meta[key] !== undefined)
            result[key] = meta[key];
    return result;
}
async function buildField(mapping, field, profile, context, readOnly) {
    const result = {
        key: field.key, label: field.label, type: field.type, kind: field.kind,
        value: null, valid: false, writable: false, readable: false,
        unit: field.unit, options: [], confirm: profile === 'lock' && (field.key === 'SET' || field.key === 'OPEN'),
    };
    let readMeta;
    let writeMeta;
    if (mapping.readId) {
        try {
            readMeta = await resolvedMetadata(context, mapping.readId, field, 'read');
            result.readable = readMeta.read;
            if (readMeta.read) {
                const raw = await context.read('state', mapping.readId);
                const maximum = field.key === 'MAP_BASE64' ? MAX_MAP_STRING : MAX_READ_STRING;
                const protection = COVER_PROFILES.has(profile) && COVER_PROTECTIONS.includes(field.key);
                const staleAfter = protection ? context.staleAfterMs || 60000 : context.staleAfterMs;
                const value = protection && isRecord(raw) && raw.ack === false ? null : stateValue(raw, readMeta, maximum, staleAfter);
                result.value = value;
                result.valid = value !== null;
                if (isRecord(raw) && typeof raw.val === 'string' && raw.val.length > maximum)
                    result.error = 'EOS_CONTROL_VALUE_LIMIT';
                if (isRecord(raw)) {
                    for (const key of ['ts', 'lc', 'q'])
                        if (finite(raw[key]))
                            result[key] = raw[key];
                    if (finite(raw.ts))
                        result.age = Math.max(0, Date.now() - raw.ts);
                    if (typeof raw.ack === 'boolean')
                        result.ack = raw.ack;
                }
            }
        }
        catch (error) {
            result.error = errorCode(error);
        }
    }
    if (mapping.writeId && !readOnly) {
        try {
            writeMeta = await resolvedMetadata(context, mapping.writeId, field, 'write');
            result.writable = writeMeta.write;
        }
        catch (error) {
            result.error = errorCode(error);
        }
    }
    const selected = writeMeta ?? readMeta;
    if (selected) {
        result.type = selected.type;
        result.unit = selected.unit;
        result.options = selected.options.map(option => ({ ...option }));
        Object.assign(result, numericMetadata(selected));
        result.kind = kindFor(selected.type, result.writable, field.indicator, selected.momentary, result.options.length > 0);
        if (selected.momentary && selected.type === 'boolean')
            result.commandValue = true;
        // Unterschiedliche Ist-/Solltypen dürfen einen Istwert nicht in einen gültigen Sollwert umdeuten.
        if (result.value !== null && !scalar(result.value, selected.type, field.key === 'MAP_BASE64' ? MAX_MAP_STRING : MAX_READ_STRING))
            result.valid = false;
    }
    context.reserveField(result);
    return result;
}
/** Momentaufnahme ohne Abonnements, globale Caches oder Folgeaktionen; Teilfehler ergeben ungültige Felder statt eines Prozessfehlers. */
async function buildDeviceControls(config, host, readOnly = false, options = {}) {
    const normalized = normalizeDeviceControls(config);
    if (!normalized)
        return null;
    const profile = CATALOG.get(normalized.profile);
    if (!profile)
        return fail('EOS_CONTROL_CONFIG_INVALID');
    const context = new ReadContext(host, options);
    const fields = await Promise.all(normalized.fields.map(mapping => {
        const field = fieldFor(profile, mapping.key);
        if (!field)
            return fail('EOS_CONTROL_FIELD_UNKNOWN');
        return buildField(mapping, field, profile.id, context, readOnly);
    }));
    if (COVER_PROFILES.has(profile.id)) {
        const protectedFields = fields.filter(field => COVER_PROTECTIONS.includes(field.key));
        if (protectedFields.some(field => !field.readable || !field.valid || protectionActive(field.value) !== false)) {
            for (const field of fields)
                if (MOVEMENT_KEYS.has(field.key)) {
                    field.writable = false;
                    field.error = 'EOS_CONTROL_SAFETY_BLOCKED';
                }
        }
    }
    return { profile: profile.id, label: profile.label, fields };
}
/** History erhält nur ein bereits gespeichertes und über dieselbe Alias-/Geheimnisgrenze geprüftes Lesefeld. */
async function validateDeviceControlRead(config, key, host) {
    const normalized = normalizeDeviceControls(config);
    if (!normalized || typeof key !== 'string')
        return fail('EOS_CONTROL_REQUEST_INVALID');
    const profile = CATALOG.get(normalized.profile);
    const mapping = normalized.fields.find(field => field.key === key);
    const field = profile ? fieldFor(profile, key) : undefined;
    if (!mapping?.readId || !field?.read)
        return fail('EOS_CONTROL_NOT_READABLE');
    const meta = await resolvedMetadata(new ReadContext(host), mapping.readId, field, 'read');
    if (!meta.read)
        return fail('EOS_CONTROL_NOT_READABLE');
    return { id: mapping.readId, type: meta.type };
}
/** Alias-Erstellung prüft Schreibmetadaten über dieselbe Grenze, ohne einen Gerätewert zu lesen oder zu verändern. */
async function validateDeviceControlWrite(config, key, host) {
    const normalized = normalizeDeviceControls(config);
    if (!normalized || typeof key !== 'string')
        return fail('EOS_CONTROL_REQUEST_INVALID');
    const profile = CATALOG.get(normalized.profile);
    const mapping = normalized.fields.find(field => field.key === key);
    const field = profile ? fieldFor(profile, key) : undefined;
    if (!mapping?.writeId || !field?.write)
        return fail('EOS_CONTROL_NOT_WRITABLE');
    const meta = await resolvedMetadata(new ReadContext(host), mapping.writeId, field, 'write');
    if (!meta.write)
        return fail('EOS_CONTROL_NOT_WRITABLE');
    return { id: mapping.writeId, type: meta.type };
}
async function verifyCoverProtection(config, profile, context) {
    for (const mapping of config.fields.filter(field => COVER_PROTECTIONS.includes(field.key))) {
        if (!mapping.readId)
            return fail('EOS_CONTROL_SAFETY_UNKNOWN');
        const field = fieldFor(profile, mapping.key);
        if (!field)
            return fail('EOS_CONTROL_SAFETY_UNKNOWN');
        const meta = await resolvedMetadata(context, mapping.readId, field, 'read');
        if (!meta.read)
            return fail('EOS_CONTROL_SAFETY_UNKNOWN');
        const raw = await context.read('state', mapping.readId);
        const value = isRecord(raw) && raw.ack !== false ? stateValue(raw, meta, MAX_READ_STRING, context.staleAfterMs || 60000) : null;
        const active = protectionActive(value);
        if (active === null)
            return fail('EOS_CONTROL_SAFETY_UNKNOWN');
        if (active)
            return fail('EOS_CONTROL_SAFETY_BLOCKED');
    }
}
async function verifyClimateOrder(config, profile, key, value, context) {
    if (!['airCondition', 'thermostat'].includes(profile.id) || !['SET_HEATING', 'SET_COOLING'].includes(key) || typeof value !== 'number')
        return;
    const opposite = key === 'SET_HEATING' ? 'SET_COOLING' : 'SET_HEATING';
    const mapping = config.fields.find(field => field.key === opposite);
    if (!mapping)
        return;
    const field = fieldFor(profile, opposite);
    if (!mapping.readId || !field)
        return fail('EOS_CONTROL_CLIMATE_UNKNOWN');
    const meta = await resolvedMetadata(context, mapping.readId, field, 'read');
    if (!meta.read)
        return fail('EOS_CONTROL_CLIMATE_UNKNOWN');
    const raw = await context.read('state', mapping.readId);
    if (!isRecord(raw) || raw.ack === false)
        return fail('EOS_CONTROL_CLIMATE_UNKNOWN');
    const current = stateValue(raw, meta, MAX_READ_STRING, context.staleAfterMs);
    if (typeof current !== 'number')
        return fail('EOS_CONTROL_CLIMATE_UNKNOWN');
    if ((key === 'SET_HEATING' && value > current) || (key === 'SET_COOLING' && value < current))
        return fail('EOS_CONTROL_CLIMATE_ORDER');
}
function climateLease(config, request) {
    if (!['airCondition', 'thermostat'].includes(config.profile) || !isRecord(request)
        || !['SET_HEATING', 'SET_COOLING'].includes(String(request.key)))
        return () => undefined;
    const ids = config.fields.filter(field => ['SET_HEATING', 'SET_COOLING'].includes(field.key))
        .map(field => field.writeId ?? field.readId ?? '').sort();
    const key = JSON.stringify(ids);
    if (pendingClimateWrites.has(key) || pendingClimateWrites.size >= 64)
        return fail('EOS_CONTROL_BUSY');
    const token = {};
    pendingClimateWrites.set(key, token);
    return () => { if (pendingClimateWrites.get(key) === token)
        pendingClimateWrites.delete(key); };
}
async function prepareWrite(normalized, request, context) {
    if (!isRecord(request) || typeof request.key !== 'string' || !Object.hasOwn(request, 'value')
        || (request.confirmed !== undefined && typeof request.confirmed !== 'boolean')
        || Object.keys(request).some(key => !['key', 'value', 'confirmed'].includes(key)))
        return fail('EOS_CONTROL_REQUEST_INVALID');
    const profile = CATALOG.get(normalized.profile);
    const mapping = normalized.fields.find(field => field.key === request.key);
    const field = profile ? fieldFor(profile, request.key) : undefined;
    if (!profile || !mapping || !field || !field.write || !mapping.writeId)
        return fail('EOS_CONTROL_NOT_WRITABLE');
    const meta = await resolvedMetadata(context, mapping.writeId, field, 'write');
    if (!meta.write)
        return fail('EOS_CONTROL_NOT_WRITABLE');
    if (!scalar(request.value, meta.type, MAX_WRITE_STRING) || !inBounds(request.value, meta) || !matchesStep(request.value, meta)
        || (meta.momentary && meta.type === 'boolean' && request.value !== true))
        return fail('EOS_CONTROL_VALUE_INVALID');
    if (profile.id === 'lock' && ((field.key === 'SET' && request.value === false) || (field.key === 'OPEN' && request.value === true))
        && request.confirmed !== true)
        return fail('EOS_CONTROL_CONFIRM_REQUIRED');
    if (COVER_PROFILES.has(profile.id) && MOVEMENT_KEYS.has(field.key))
        await verifyCoverProtection(normalized, profile, context);
    await verifyClimateOrder(normalized, profile, field.key, request.value, context);
    context.check();
    return { id: mapping.writeId, value: request.value };
}
/** Genau ein geprüfter Schreibversuch. Zeitüberschreitungen beim Schreiben sind unbestätigt und werden niemals automatisch wiederholt. */
async function executeDeviceControl(config, request, host, readOnly = false, options = {}) {
    if (readOnly)
        return fail('EOS_CONTROL_READ_ONLY');
    const normalized = normalizeDeviceControls(config);
    if (!normalized)
        return fail('EOS_CONTROL_CONFIG_INVALID');
    const context = new ReadContext(host, options);
    const release = climateLease(normalized, request);
    let submitted = false;
    try {
        const prepared = await prepareWrite(normalized, request, context);
        await context.bounded(() => {
            submitted = true;
            // Die Klimasperre bleibt bei einer unbestätigten Schreibzeitüberschreitung bis zum tatsächlichen Promise-Ende bestehen.
            return Promise.resolve().then(() => host.writeState(prepared.id, prepared.value)).finally(release);
        }, true);
        return { ok: true };
    }
    finally {
        if (!submitted)
            release();
    }
}
/** Ein Farbauftrag prüft alle höchstens vier Werte vor dem ersten Write; Gerätewrites bleiben einzeln und sind keine atomare Transaktion. */
async function executeDeviceControlBatch(config, commands, host, readOnly = false, options = {}) {
    if (readOnly)
        return fail('EOS_CONTROL_READ_ONLY');
    const normalized = normalizeDeviceControls(config);
    if (!normalized || !COLOR_PROFILES.has(normalized.profile) || !Array.isArray(commands)
        || commands.length < 1 || commands.length > 4)
        return fail('EOS_CONTROL_BATCH_INVALID');
    const seen = new Set();
    for (const raw of commands) {
        if (!isRecord(raw) || typeof raw.key !== 'string' || !COLOR_KEYS.has(raw.key) || seen.has(raw.key))
            return fail('EOS_CONTROL_BATCH_INVALID');
        seen.add(raw.key);
    }
    const context = new ReadContext(host, options);
    const prepared = await Promise.all(commands.map(command => prepareWrite(normalized, command, context)));
    // Keine automatische Wiederholung oder Rücknahme: eine teilweise übergebene Farbe kann nur das Gerät selbst atomar behandeln.
    for (const command of prepared)
        await context.bounded(() => host.writeState(command.id, command.value), true);
    return { ok: true };
}
