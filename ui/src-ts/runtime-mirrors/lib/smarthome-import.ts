/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: lib/smarthome-import.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * lib/smarthome-import.js
 *
 * Zusammenhang:
 * Der Spiegel hilft uns, die JS-Datei später schrittweise zu typisieren, zu testen und
 * kontrolliert auf TypeScript umzustellen. Produktive Originalquellen liegen unter
 * src-ts/runtime-executables/ bzw. den im generierten JS genannten TS-Pfaden.
 * Dort ändern, Laufzeit erzeugen und danach die Spiegel synchronisieren.
 * Build-/Prüfskripte ohne TS-Original werden weiterhin unter scripts/ gepflegt.
 *
 * Wichtig für die Migration:
 * - Diese Datei enthält vorübergehend @ts-nocheck.
 * - Der nächste Schritt ist pro Modul echte Typisierung statt pauschalem No-Check.
 * - Fachliche Kommentare markieren die Abschnitte, die später einzeln migriert werden.
 *
 * Original-Hash: 175277746c0c82b375031b2635982448d7401c2d53f180de9a3c0d56c08f3686
 */

/**
 * Code-Teil: Runtime-Spiegel der kompletten Datei
 *
 * Zweck:
 * Dieser Abschnitt enthält den ursprünglichen JavaScript-Code als TypeScript-Parallelkopie.
 * Einzelne Funktionen werden später pro Modul weiter typisiert; Dateien ohne eigene
 * Funktionsdeklarationen bleiben trotzdem über diesen Dateikommentar dokumentiert.
 */

/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/smarthome-import.ts
 * Quell-Hash: sha256:9dcb7e2a63b2a3ef52c9bba9b00a0766d823338b7cdb422973e86804e80e0be5
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/smarthome-import.js.
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
exports.SMART_HOME_IMPORT_VERSION = exports.SMART_HOME_DETECTOR_VERSION = void 0;
exports.normalizeSmartHomeImportColor = normalizeSmartHomeImportColor;
exports.normalizeSmartHomeCameraStateUrl = normalizeSmartHomeCameraStateUrl;
exports.isSmartHomeImportField = isSmartHomeImportField;
exports.normalizeSmartHomeImportProvenance = normalizeSmartHomeImportProvenance;
exports.resolveSmartHomeAliasIdentity = resolveSmartHomeAliasIdentity;
exports.enrichSmartHomeImportSuggestion = enrichSmartHomeImportSuggestion;
exports.reconcileSmartHomeImportSuggestions = reconcileSmartHomeImportSuggestions;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Ergänzt lokale Type-Detector-Vorschläge um Datentypen, Metadaten,
 * Aliasidentität und eine nachvollziehbare Importherkunft.
 * Daten und Wirkung: Liest ioBroker-Objekte und bestehende EOS-Konfiguration rein
 * synchron; erzeugt nur Vorschläge. Keine States, Konfigurationen oder Gerätewrites.
 * Alias-Ziele dienen ausschließlich dem Vergleich; IO-Zuordnungen behalten die
 * ursprünglichen Alias-IDs und damit deren Umrechnungs-/Schreibvertrag.
 * Bei Änderungen: Bool/Text, Aliaszyklen, getrennte Lese-/Schreibquellen,
 * manuelle Überschreibungen und wiederholte Imports gemeinsam prüfen.
 * Verknüpfungen: docs/quellcode/src-ts/runtime-executables/lib/smarthome-import.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md
 */
const node_crypto_1 = require("node:crypto");
exports.SMART_HOME_DETECTOR_VERSION = '5.0.10';
exports.SMART_HOME_IMPORT_VERSION = 1;
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ICON_NAMES = new Set(['toggle', 'bulb', 'plug', 'blinds', 'thermostat', 'thermometer', 'speaker', 'tv', 'camera', 'sensor', 'door', 'window', 'motion', 'alarm', 'smoke', 'water', 'fan', 'meter', 'scene', 'solar', 'battery', 'charger', 'car', 'grid', 'house', 'globe', 'fire', 'lock']);
/**
 * Code-Teil: record
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function record(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
/**
 * Code-Teil: row
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function row(value) { return record(value) ? value : {}; }
/**
 * Code-Teil: text
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function text(value, max = 512) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
/**
 * Code-Teil: list
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function list(value) { return Array.isArray(value) ? value : []; }
/**
 * Code-Teil: scalar
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function scalar(value) {
    if (value === null || typeof value === 'boolean')
        return value;
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : undefined;
    if (typeof value === 'string' && value.length <= 2048)
        return value;
    return undefined;
}
/**
 * Code-Teil: name
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function name(value) {
    if (typeof value === 'string')
        return text(value, 160);
    const names = row(value);
    return text(names.de || names.en || Object.values(names).find(v => typeof v === 'string'), 160);
}
/**
 * Code-Teil: digest
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function digest(value) {
    return (0, node_crypto_1.createHash)('sha256').update(JSON.stringify(value)).digest('hex');
}
/**
 * Code-Teil: common
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function common(objects, id) { return row(row(objects[id]).common); }
/** Nur lokale EOS-Iconnamen/kurze Symbole und feste Farbwerte übernehmen.
 * Externe Bildpfade bleiben Installer-Hinweise und lösen keinen Abruf aus. */
function normalizeSmartHomeImportColor(value) {
    const raw = text(value, 16);
    if (/^#[\da-f]{6}$/i.test(raw))
        return raw.toLowerCase();
    if (/^#[\da-f]{3}$/i.test(raw))
        return '#' + raw.slice(1).split('').map(c => c + c).join('').toLowerCase();
    return '';
}
/**
 * Code-Teil: safeIcon
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function safeIcon(value) {
    const raw = text(value, 80);
    const key = raw.toLowerCase().replace(/^3d-/, '');
    if (ICON_NAMES.has(key))
        return raw.toLowerCase();
    if (raw.length <= 16 && /\p{Extended_Pictographic}/u.test(raw) && !/[<>\u0000-\u001f]/u.test(raw))
        return raw;
    return '';
}
/** Kamera-State ist nur eine Browser-URL, niemals ein Serverfetch. Keine
 * eingebetteten Zugangsdaten, Skript-/Daten-URLs oder falschen Werttypen. */
function normalizeSmartHomeCameraStateUrl(value) {
    if (typeof value !== 'string' || value.length > 2048)
        return undefined;
    try {
        const parsed = new URL(value.trim());
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
            return undefined;
        return parsed.href;
    }
    catch (_error) {
        return undefined;
    }
}
/** IO-Pfade sind feste, begrenzte Felder; Herkunft enthält keine freien Objekt-
 * Strukturen. Damit können spätere Änderungen feldweise geprüft werden. */
function isSmartHomeImportField(path) {
    if (typeof path !== 'string' || path.length > 160)
        return false;
    const keys = path.split('.');
    if (keys.some(k => BLOCKED_KEYS.has(k)))
        return false;
    return ['alias', 'icon', 'ui.unit', 'ui.color', 'ui.precision'].includes(path)
        || /^io\.(switch|level|color|white|colorTemperature|cover|climate|player|sensor|camera|indicators)\.[A-Za-z][A-Za-z0-9]{0,60}$/.test(path);
}
/**
 * Code-Teil: sourceValues
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function sourceValues(proposal) {
    const out = Object.create(null);
/**
 * Code-Teil: add
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const add = (path, value) => {
        const val = scalar(value);
        if (isSmartHomeImportField(path) && val !== undefined && Object.keys(out).length < 180)
            out[path] = val;
    };
    add('alias', proposal.alias);
    add('icon', proposal.icon);
    for (const [key, value] of Object.entries(row(proposal.ui)))
        add(`ui.${key}`, value);
    for (const [group, fields] of Object.entries(row(proposal.io))) {
        if (!record(fields))
            continue;
        for (const [key, value] of Object.entries(fields))
            add(`io.${group}.${key}`, value);
    }
    return out;
}
/** Alte manuelle Geräte bekommen keine künstliche Importherkunft. Ungültige
 * Herkunft wird verworfen; eine Herkunft verleiht niemals Schreibrechte. */
function normalizeSmartHomeImportProvenance(value) {
    const raw = row(value);
    if (raw.provider !== 'iobroker.type-detector' || !text(raw.sourceId) || typeof raw.signature !== 'string' || !/^[a-f\d]{64}$/.test(raw.signature))
        return undefined;
    const values = Object.create(null);
    for (const [path, value] of Object.entries(row(raw.sourceValues)).slice(0, 180)) {
        const val = scalar(value);
        if (isSmartHomeImportField(path) && val !== undefined)
            values[path] = val;
    }
    return {
        provider: 'iobroker.type-detector', sourceId: text(raw.sourceId), detectorType: text(raw.detectorType, 64),
        detectorVersion: text(raw.detectorVersion, 32), mappingVersion: Number.isSafeInteger(raw.mappingVersion) && Number(raw.mappingVersion) > 0 ? Number(raw.mappingVersion) : 1,
        signature: text(raw.signature, 64), sourceStateIds: [...new Set(list(raw.sourceStateIds).map(v => text(v)).filter(Boolean))].slice(0, 128),
        semanticStateIds: [...new Set(list(raw.semanticStateIds).map(v => text(v)).filter(Boolean))].slice(0, 128),
        sourceValues: values,
    };
}
/** Endpunkte rekursiver ioBroker-Aliase nur für Identitätsvergleiche verfolgen.
 * Bei Zyklen, zu tiefer Kette oder ungültigen Zielen bleibt die Identität isoliert;
 * der Import wird später zur manuellen Prüfung gesperrt. Kein Write wird umgeleitet. */
function resolveSmartHomeAliasIdentity(objects, id, direction) {
    const seen = new Set();
    let current = text(id);
    let alias = false;
    for (let depth = 0; depth < 16; depth += 1) {
        if (!current || seen.has(current))
            return { id, alias, valid: false };
        seen.add(current);
        if (row(objects[current]).type !== 'state')
            return { id, alias, valid: false };
        const definition = common(objects, current).alias;
        if (!definition)
            return { id: current, alias, valid: true };
        alias = true;
        const target = typeof definition === 'string' ? definition : row(definition).id;
        if (typeof target === 'string')
            current = text(target);
        else {
            const pair = row(target);
            current = text(pair[direction] || pair[direction === 'read' ? 'write' : 'read']);
        }
    }
    return { id, alias, valid: false };
}
/**
 * Code-Teil: bindingIds
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function bindingIds(device) {
    const ids = new Set();
    for (const [group, fields] of Object.entries(row(device.io))) {
        if (group === 'indicators' || !record(fields))
            continue;
        for (const [key, value] of Object.entries(fields))
            if (/Id$/.test(key) && text(value))
                ids.add(text(value));
    }
    return [...ids].sort();
}
/**
 * Code-Teil: semanticIdentity
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function semanticIdentity(device, objects) {
    const ids = new Set();
    let alias = false;
    let valid = true;
    for (const id of bindingIds(device)) {
        for (const direction of ['read', 'write']) {
            const resolved = resolveSmartHomeAliasIdentity(objects, id, direction);
            ids.add(resolved.valid ? resolved.id : `unresolved:${id}`);
            alias || (alias = resolved.alias || id.startsWith('alias.'));
            valid && (valid = resolved.valid);
        }
    }
    return { ids: [...ids].sort(), alias, valid };
}
/**
 * Code-Teil: memberships
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function memberships(objects, ids, prefix) {
    const candidates = new Set();
    for (const id of ids) {
        let current = id;
        for (let depth = 0; current && depth < 24; depth += 1) {
            candidates.add(current);
            const end = current.lastIndexOf('.');
            current = end > 0 ? current.slice(0, end) : '';
        }
    }
    return Object.keys(objects).filter(id => id.startsWith(`enum.${prefix}.`)).sort().flatMap(enumId => {
        const object = row(objects[enumId]);
        const data = row(object.common);
        if (object.type !== 'enum' || !list(data.members).some(id => typeof id === 'string' && candidates.has(id)))
            return [];
        return [{ enumId, name: name(data.name) || enumId.split('.').pop() || enumId }];
    }).slice(0, 32);
}
/**
 * Code-Teil: assignments
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function assignments(members, existing, kind) {
    return members.flatMap(member => {
        const rows = existing.map(row).filter(item => text(item.id, 80));
        const exact = rows.find(item => text(item.id) === member.enumId);
        if (exact)
            return [{ ...member, id: text(exact.id, 80), create: false }];
        const matched = rows.filter(item => name(item.name || item.alias).toLocaleLowerCase('de') === member.name.toLocaleLowerCase('de'));
        // Gleichnamige Bestandsräume sind mehrdeutig: alle zur Auswahl zeigen,
        // keinen dritten Raum und keine stillschweigende Erstzuordnung erzeugen.
        if (matched.length)
            return matched.map(item => ({ ...member, id: text(item.id, 80), create: false }));
        return [{ ...member, id: `${kind}_import_${digest(member.enumId).slice(0, 16)}`, create: true }];
    });
}
/** Reiner Vorschlagsausbau: Einheiten/Typen und Statusindikatoren stammen aus
 * den tatsächlichen common-Feldern. Fehlende Werte erhalten keine künstliche Null. */
function enrichSmartHomeImportSuggestion(input, objects, config) {
    const original = row(input);
    const cfg = row(config);
    const proposal = { ...row(original.proposal), io: { ...row(row(original.proposal).io) }, ui: { ...row(row(original.proposal).ui) } };
    const io = row(proposal.io);
    const ui = row(proposal.ui);
    const states = list(original.states).map(row).filter(s => text(s.id)).map(s => ({
        id: text(s.id), key: text(s.key).toUpperCase(), type: text(s.type), role: text(s.role), unit: text(s.unit, 32), read: s.read !== false, write: s.write === true,
    }));
    const notes = list(original.notes).filter((v) => typeof v === 'string').slice();
    const sourceId = text(original.sourceId);
    const source = common(objects, sourceId);
    if (name(source.name))
        proposal.alias = name(source.name);
    const icon = safeIcon(source.icon);
    if (icon)
        proposal.icon = icon;
    else if (text(source.icon))
        notes.push('Quell-Icon ist ein Bildpfad oder ein nicht unterstütztes Symbol. Bitte bei Bedarf ein lokales EOS-Symbol wählen.');
    const color = normalizeSmartHomeImportColor(source.color);
    if (color)
        ui.color = color;
    if (proposal.type === 'sensor') {
        const sensor = { ...row(io.sensor) };
        const meta = common(objects, text(sensor.readId));
        sensor.valueType = ['number', 'boolean', 'string'].includes(text(meta.type)) ? meta.type : 'number';
        io.sensor = sensor;
        if (typeof meta.unit === 'string')
            ui.unit = text(meta.unit, 32);
        if (sensor.valueType !== 'number')
            ui.precision = 0;
    }
    const indicators = {};
    const battery = states.find(s => s.key === 'BATTERY' && s.read && s.type === 'number' && (s.unit === '%' || s.role === 'value.battery'));
    const low = states.find(s => s.key === 'LOWBAT' && s.read && s.type === 'boolean');
    if (battery) {
        indicators.batteryId = battery.id;
        indicators.batteryUnit = '%';
    }
    else if (low) {
        indicators.batteryId = low.id;
        indicators.batteryUnit = 'low';
    }
    const unreachable = states.find(s => s.key === 'UNREACH' && s.read && s.type === 'boolean');
    const error = states.find(s => s.key === 'ERROR' && s.read && ['number', 'boolean', 'string'].includes(s.type));
    if (unreachable)
        indicators.unreachableId = unreachable.id;
    if (error)
        indicators.errorId = error.id;
    if (Object.keys(indicators).length)
        io.indicators = indicators;
    const core = semanticIdentity(proposal, objects);
    const memberIds = [sourceId, ...bindingIds(proposal), ...core.ids];
    const rooms = assignments(memberships(objects, memberIds, 'rooms'), list(cfg.rooms), 'room');
    const functions = assignments(memberships(objects, memberIds, 'functions'), list(cfg.functions), 'function');
    const values = sourceValues(proposal);
    const sourceStateIds = states.map(s => s.id).sort();
    const signature = digest({ sourceId, detectorType: original.detectorType, version: exports.SMART_HOME_IMPORT_VERSION, values, semanticStateIds: core.ids,
        states, rooms: rooms.map(v => ({ enumId: v.enumId, name: v.name })), functions: functions.map(v => ({ enumId: v.enumId, name: v.name })) });
    const provenance = {
        provider: 'iobroker.type-detector', sourceId, detectorType: text(original.detectorType, 64),
        detectorVersion: exports.SMART_HOME_DETECTOR_VERSION, mappingVersion: exports.SMART_HOME_IMPORT_VERSION, signature, sourceStateIds, semanticStateIds: core.ids, sourceValues: values,
    };
    proposal.importProvenance = provenance;
    if (!core.valid)
        notes.push('Alias-Ziel ist zyklisch oder ungültig. Vor einer Übernahme die Datenpunktzuordnung prüfen.');
    return { ...original, proposal, notes, importable: original.importable === true && core.valid, metadata: { rooms, functions, color, icon: text(source.icon, 160) },
        semanticIds: core.ids, usesAlias: core.alias, provenance,
        suggestedAssignment: { roomId: rooms.length === 1 ? rooms[0].id : '', functionId: functions.length === 1 ? functions[0].id : '' } };
}
/**
 * Code-Teil: valueAt
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function valueAt(source, path) {
    let value = source;
    for (const key of path.split('.'))
        value = row(value)[key];
    return scalar(value) ?? null;
}
/** Erst Aliaspräferenz innerhalb gleicher physischer Kernzuordnung, dann Abgleich
 * gegen vorhandene Geräte. Gemeinsame Batterie-/UNREACH-Punkte zählen nicht als
 * Geräteidentität. Bestehende Geräte werden nie mutiert oder automatisch ersetzt. */
function reconcileSmartHomeImportSuggestions(inputs, objects, config) {
    const cfg = row(config);
    const devices = list(cfg.devices).map(row);
    const ordered = inputs.map(row).slice().sort((a, b) => Number(b.usesAlias === true) - Number(a.usesAlias === true)
        || Number(b.matchCount || 0) - Number(a.matchCount || 0) || text(a.sourceId).localeCompare(text(b.sourceId)));
    const preferred = [];
    for (const suggestion of ordered) {
        const ids = list(suggestion.semanticIds).filter((v) => typeof v === 'string');
        const duplicate = preferred.find(other => other.targetType === suggestion.targetType && other.usesAlias === true
            && ids.length > 0 && list(other.semanticIds).length > 0
            && (ids.every(id => list(other.semanticIds).includes(id)) || list(other.semanticIds).every(id => ids.includes(String(id)))));
        if (duplicate) {
            duplicate.aliasAlternatives = [...list(duplicate.aliasAlternatives), text(suggestion.sourceId)].slice(0, 32);
            duplicate.notes = [...new Set([...list(duplicate.notes), 'Passender Alias wird bevorzugt; die physische Quelle wird nicht zusätzlich importiert.'])];
        }
        else
            preferred.push({ ...suggestion });
    }
    const existing = devices.map(device => ({ device, ids: semanticIdentity(device, objects).ids }));
    return preferred.map(suggestion => {
        const ids = list(suggestion.semanticIds);
        const matches = existing.filter(item => item.ids.some(id => ids.includes(id))
            || (row(item.device.importProvenance).sourceId === suggestion.sourceId && !!suggestion.sourceId));
        const exact = matches.filter(item => {
            const p = normalizeSmartHomeImportProvenance(item.device.importProvenance);
            return p && p.sourceId === suggestion.sourceId && p.detectorType === suggestion.detectorType && item.device.type === suggestion.targetType;
        });
        let update = null;
        if (exact.length === 1 && matches.length === 1) {
            const device = exact[0].device;
            const previous = normalizeSmartHomeImportProvenance(device.importProvenance);
            const next = normalizeSmartHomeImportProvenance(row(suggestion.proposal).importProvenance);
            const changes = [];
            if (previous.signature !== next.signature) {
                for (const path of [...new Set([...Object.keys(previous.sourceValues), ...Object.keys(next.sourceValues)])].sort()) {
                    if (!isSmartHomeImportField(path))
                        continue;
                    const before = previous.sourceValues[path] ?? null;
                    const after = next.sourceValues[path] ?? null;
                    if (before === after || valueAt(device, path) === after)
                        continue;
                    const current = valueAt(device, path);
                    changes.push({ path, current, proposed: after, manualOverride: current !== before });
                }
            }
            update = { deviceId: text(device.id, 80), alias: text(device.alias, 160), changes, sourceChanged: previous.signature !== next.signature };
        }
        const notes = list(suggestion.notes).filter((v) => typeof v === 'string');
        if (matches.length)
            notes.push(update ? 'Importherkunft gefunden. Änderungen lassen sich einzeln prüfen; bestehende Werte bleiben bis zur ausdrücklichen Übernahme erhalten.' : 'Physische Quelle oder Alias ist bereits zugeordnet. Bestehende manuelle Einrichtung bleibt unverändert.');
        return { ...suggestion, alreadyConfigured: matches.length > 0, configuredOverlap: matches.map(m => text(m.device.id, 80)), update, notes };
    });
}
