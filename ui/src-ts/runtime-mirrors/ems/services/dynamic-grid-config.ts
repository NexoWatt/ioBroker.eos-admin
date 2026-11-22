/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: ems/services/dynamic-grid-config.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * ems/services/dynamic-grid-config.js
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
 * Original-Hash: ade895a60ff4bd8ca8bb189e164c1392e41b13c0cbeb78ff4432d4e3a38f6e20
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
 * Quelle: src-ts/runtime-executables/ems/services/dynamic-grid-config.ts
 * Quell-Hash: sha256:5e88c6a9d61b930c816e4f6060225ce25785c6b0eb77601afe8d4dee439ee0c1
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für ems/services/dynamic-grid-config.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft die eigenständige App für den dynamischen Netzanschluss und bildet vollständige Messzyklen.
 * Daten und Wirkung: Reine Normalisierung herstellerunabhängiger Zuordnungen; M0 stammt aus Allgemein. Keine Objektabfragen und keine Geräteschreibzugriffe.
 * Bei Änderungen: Entwürfe und Aktivierung trennen, physische Aliasidentität sowie Einheiten prüfen und fehlende Rückmeldungen niemals als Nullleistung behandeln.
 * Verknüpfungen: docs/quellcode/src-ts/runtime-executables/ems/services/dynamic-grid-config.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
'use strict';
const { readMeasurement } = require('./nvp-topology');
/**
 * Code-Teil: finite
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
/**
 * Code-Teil: plain
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v));
/**
 * Code-Teil: has
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const has = (v, k) => plain(v) && Object.prototype.hasOwnProperty.call(v, k);
/**
 * Code-Teil: identifier
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const identifier = (v) => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v) && !['constructor', 'prototype', '__proto__'].includes(v);
/**
 * Code-Teil: stateId
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const stateId = (v) => typeof v === 'string' && !!v.trim() && v.length <= 512 && !/[\x00-\x1f\x7f]/.test(v);
const OUTPUTS = ['signedTarget', 'chargeTarget', 'dischargeTarget', 'maxCharge', 'maxDischarge'];
const FLAGS = ['run', 'chargeEnable', 'dischargeEnable'];
/** Ein frischer Entwurf aktiviert weder neue Messungen noch neue Aktoren. */
function dynamicGridDefaults() {
    return { schemaVersion: 1, configVersion: 1, maxSkewMs: 1000, points: [
            { id: 'M0', source: 'general', importLimitW: null, exportLimitW: null, importReserveW: 0, exportReserveW: 0 },
            { id: 'M1', source: 'mapped', measurement: { stateId: '', unit: 'W', sign: 1, maxAgeMs: 5000 }, importLimitW: null, exportLimitW: null, importReserveW: 0, exportReserveW: 0 },
        ], storages: [], pvAssignments: [] };
}
/**
 * Übernimmt ausschließlich die Allgemein-Zuordnung. Der Aufrufer liefert echte
 * Objekt-Einheiten; eine unbekannte Einheit wird nicht als Watt geraten.
 * Split-Bezug/Einspeisung ist nur mit beiden Datenpunkten verwendbar.
 */
function resolveGeneralMeasurement(rootConfig = {}, options = {}) {
    const dp = rootConfig.datapoints || {};
/**
 * Code-Teil: unit
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const unit = (id) => options.unitByStateId && options.unitByStateId[id];
    const sign = rootConfig.settings?.flowInvertGrid === true || rootConfig.flowInvertGrid === true ? -1 : 1;
    const maxAgeMs = finite(options.maxAgeMs) ? options.maxAgeMs : 5000;
/**
 * Code-Teil: sample
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const sample = (id) => ({ stateId: typeof id === 'string' ? id.trim() : '', unit: unit(id), sign: 1, maxAgeMs });
    if (stateId(dp.gridPointPower))
        return { ...sample(dp.gridPointPower), sign };
    return { kind: 'split', importMeasurement: sample(dp.gridBuyPower), exportMeasurement: sample(dp.gridSellPower), sign, maxAgeMs };
}
/**
 * Vollständige Schema- und Aktivierungsprüfung. Unvollständige inaktive Entwürfe
 * sind erlaubt; falsche Datentypen, doppelte Aktoren und widersprüchliche Gruppen
 * bleiben Fehler. Backend ergänzt reale Objekt-/Aliasrechte über Resolver.
 */
function validateDynamicGridConfig(raw, options = {}) {
    const errors = [], activationErrors = [], warnings = [];
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
    const add = (path, code, message, activation = false) => (activation ? activationErrors : errors).push({ path, code, message });
    const active = options.active === true;
    if (raw === undefined || raw === null)
        raw = dynamicGridDefaults();
    if (!plain(raw))
        return { valid: false, config: null, topology: null, errors: [{ path: '', code: 'object', message: 'App-Konfiguration muss ein Objekt sein.' }], activationErrors, warnings, activeEligible: false };
    const config = { schemaVersion: raw.schemaVersion === undefined ? 1 : raw.schemaVersion, configVersion: raw.configVersion === undefined ? 1 : raw.configVersion, maxSkewMs: raw.maxSkewMs === undefined ? 1000 : raw.maxSkewMs, points: [], storages: [], pvAssignments: [] };
/**
 * Code-Teil: num
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const num = (v, path, min = 0, max = 1000000000, required = true) => {
        if (v === undefined || v === null || v === '') {
            if (required)
                add(path, 'required', 'Zahlenwert für die Aktivierung erforderlich.', true);
            return null;
        }
        if (!finite(v) || v < min || v > max) {
            add(path, 'number', `Endliche Zahl zwischen ${min} und ${max} erforderlich.`);
            return null;
        }
        return v;
    };
/**
 * Code-Teil: id
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const id = (v, path, required = true) => {
        if (!stateId(v)) {
            add(path, 'state-id', 'Gültiger Datenpunkt erforderlich.', v === undefined || v === '');
            return '';
        }
        return v.trim();
    };
/**
 * Code-Teil: resolve
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const resolve = (v, path, writing = false) => {
        const resolver = writing ? options.resolveWriteId : options.resolveSourceId;
        if (!resolver || !v)
            return v;
        try {
            const result = resolver(v);
            if (stateId(result))
                return result;
        }
        catch (_e) { /* Fehler unten gesammelt. */ }
        add(path, writing ? 'write-source-unresolved' : 'read-source-unresolved', 'Datenpunkt konnte nicht eindeutig aufgelöst werden.', true);
        return v;
    };
/**
 * Code-Teil: measurement
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const measurement = (value, path, soc = false) => {
        if (!plain(value)) {
            add(path, 'measurement-required', 'Messzuordnung für die Aktivierung erforderlich.', value === undefined || value === null);
            value = {};
        }
        const out = { stateId: id(value.stateId, `${path}.stateId`), maxAgeMs: num(value.maxAgeMs ?? 5000, `${path}.maxAgeMs`, 1, 60000) };
        if (soc)
            out.scale = num(value.scale ?? 1, `${path}.scale`, 0.000000001, 1000000);
        else {
            out.unit = value.unit;
            out.sign = value.sign;
            if (!['W', 'kW'].includes(out.unit))
                add(`${path}.unit`, 'unit', 'Einheit W oder kW erforderlich.', out.unit === undefined || out.unit === '');
            if (![1, -1].includes(out.sign))
                add(`${path}.sign`, 'sign', 'Vorzeichen 1 oder -1 erforderlich.', out.sign === undefined);
        }
        if (out.stateId)
            out.resolvedSourceId = resolve(out.stateId, path);
        return out;
    };
/**
 * Code-Teil: readMeasurementConfig
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const readMeasurementConfig = (value, path) => {
        if (plain(value) && value.kind === 'split')
            return { kind: 'split', importMeasurement: measurement(value.importMeasurement, `${path}.importMeasurement`), exportMeasurement: measurement(value.exportMeasurement, `${path}.exportMeasurement`), sign: value.sign === -1 ? -1 : 1, maxAgeMs: num(value.maxAgeMs ?? 5000, `${path}.maxAgeMs`, 1, 60000) };
        return measurement(value, path);
    };
/**
 * Code-Teil: arrays
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const arrays = (name, max) => {
        if (raw[name] === undefined)
            return [];
        if (!Array.isArray(raw[name]) || raw[name].length > max) {
            add(name, 'array', `Höchstens ${max} Einträge erforderlich.`);
            return [];
        }
        return raw[name];
    };
    if (config.schemaVersion !== 1)
        add('schemaVersion', 'schema', 'Unbekannte App-Schemaversion.');
    if (!Number.isSafeInteger(config.configVersion) || config.configVersion < 1)
        add('configVersion', 'version', 'Positive ganzzahlige Konfigurationsversion erforderlich.');
    num(config.maxSkewMs, 'maxSkewMs', 0, 60000);
    if (has(raw, 'mode') || has(raw, 'operation') || has(raw, 'enabled'))
        add('', 'activation-source', 'Die Aktivierung wird ausschließlich durch die App-Verwaltung bestimmt.');
    const topology = { origin: 'dynamicGridConnection', schemaVersion: 1, configVersion: config.configVersion, mode: 'dynamic', operation: 'active', rootPointId: 'M0', maxSkewMs: config.maxSkewMs, points: [], storages: config.storages, pvAssignments: config.pvAssignments };
    const pointIds = new Set();
    for (const [index, entry] of arrays('points', 2).entries()) {
        const path = `points[${index}]`;
        if (!plain(entry)) {
            add(path, 'object', 'Messpunkt muss ein Objekt sein.');
            continue;
        }
        if (!['M0', 'M1'].includes(entry.id) || pointIds.has(entry.id))
            add(`${path}.id`, 'point-id', 'M0/M1 müssen eindeutig sein.');
        pointIds.add(entry.id);
        const root = entry.id === 'M0';
        const point = { id: entry.id, source: root ? 'general' : 'mapped', name: typeof entry.name === 'string' ? entry.name.slice(0, 120) : entry.id };
        if (entry.source !== undefined && entry.source !== point.source)
            add(`${path}.source`, 'point-source', 'M0 stammt aus Allgemein, M1 aus dieser App.');
        if (root && has(entry, 'measurement'))
            add(`${path}.measurement`, 'general-source-only', 'M0 darf in dieser App keine eigene Messquelle besitzen.');
        if (!root)
            point.measurement = measurement(entry.measurement, `${path}.measurement`);
        for (const side of ['import', 'export']) {
            const key = `${side}LimitW`, reserve = `${side}ReserveW`;
            point[key] = entry[key] === null && !root ? null : num(entry[key], `${path}.${key}`, 0, 1000000000, true);
            point[reserve] = num(entry[reserve] ?? 0, `${path}.${reserve}`);
            if (point[key] === null && point[reserve] !== 0)
                add(`${path}.${reserve}`, 'reserve-without-limit', 'Reserve benötigt eine bekannte Grenze.');
            if (finite(point[key]) && finite(point[reserve]) && point[reserve] > point[key])
                add(`${path}.${reserve}`, 'reserve', 'Reserve überschreitet die Anschlussgrenze.');
            if (!root && (entry[key] === '' || entry[key] === undefined))
                point[key] = '';
        }
        config.points.push(point);
        const effectiveMeasurement = root ? readMeasurementConfig(options.generalMeasurement || resolveGeneralMeasurement(options.rootConfig || {}, options), `${path}.generalMeasurement`) : point.measurement;
        topology.points.push({ ...point, importLimitW: point.importLimitW === '' ? null : point.importLimitW, exportLimitW: point.exportLimitW === '' ? null : point.exportLimitW, parentId: root ? null : 'M0', measurement: effectiveMeasurement });
    }
    if (!pointIds.has('M0') || !pointIds.has('M1'))
        add('points', 'points-required', 'M0 und M1 sind für die Aktivierung erforderlich.', true);
/**
 * Code-Teil: sourceIds
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const sourceIds = (m) => m?.kind === 'split' ? [m.importMeasurement, m.exportMeasurement].flatMap(sourceIds) : m?.stateId ? [m.resolvedSourceId || m.stateId] : [];
    const pointSources = topology.points.map((p) => sourceIds(p.measurement));
    if (pointSources.length === 2 && pointSources[0].some((v) => pointSources[1].includes(v)))
        add('points', 'duplicate-source', 'M0 und M1 dürfen keine identische physische Messquelle verwenden.');
    for (const ids of pointSources)
        if (new Set(ids).size !== ids.length)
            add('points', 'duplicate-split-source', 'Bezug und Einspeisung benötigen unterschiedliche Messquellen.');
    const outputOwners = new Map(), storageIds = new Set(), powerIds = new Set();
/**
 * Code-Teil: output
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const output = (v, path, signed) => {
        if (!plain(v)) {
            add(path, 'output-required', 'Leistungsausgang erforderlich.', true);
            v = {};
        }
        const out = { stateId: id(v.stateId, `${path}.stateId`), scale: num(v.scale ?? 1, `${path}.scale`, 0.000000001, 1000000000), sign: v.sign ?? 1 };
        if (![1, -1].includes(out.sign) || (!signed && out.sign !== 1))
            add(`${path}.sign`, 'sign', signed ? 'Vorzeichen muss 1 oder -1 sein.' : 'Richtungsgrenzen sind positive Beträge mit Vorzeichen 1.');
        if (v.readbackStateId)
            out.readbackStateId = id(v.readbackStateId, `${path}.readbackStateId`);
        return out;
    };
    for (const [index, entry] of arrays('storages', 32).entries()) {
        const path = `storages[${index}]`;
        if (!plain(entry)) {
            add(path, 'object', 'Speicher muss ein Objekt sein.');
            continue;
        }
        const storage = { id: entry.id, name: typeof entry.name === 'string' ? entry.name.slice(0, 120) : entry.id };
        if (!identifier(storage.id) || storageIds.has(storage.id))
            add(`${path}.id`, 'storage-id', 'Eindeutige Speicherkennung erforderlich.', storage.id === undefined || storage.id === '');
        if (storage.id)
            storageIds.add(storage.id);
        for (const key of ['connectionPointId', 'controlPointId']) {
            storage[key] = entry[key];
            if (!['M0', 'M1'].includes(storage[key]))
                add(`${path}.${key}`, 'point-id', 'Bereich M0 oder M1 erforderlich.', !storage[key]);
        }
        if (['M0', 'M1'].includes(storage.connectionPointId) && ['M0', 'M1'].includes(storage.controlPointId) && storage.connectionPointId !== storage.controlPointId)
            add(path, 'cross-area-control', 'Anschluss- und Regelbereich müssen übereinstimmen.');
        storage.dispatchGroupId = entry.dispatchGroupId;
        if (!identifier(storage.dispatchGroupId))
            add(`${path}.dispatchGroupId`, 'group-id', 'Gültige Gruppenkennung erforderlich.', !storage.dispatchGroupId);
        storage.primaryPurpose = entry.primaryPurpose;
        storage.authority = entry.authority;
        if (!['selfConsumption', 'zeroExport', 'peakShaving', 'tariff', 'arbitrage'].includes(storage.primaryPurpose))
            add(`${path}.primaryPurpose`, 'purpose', 'Unbekannte Speicheraufgabe.', !storage.primaryPurpose);
        if (!['eos', 'external'].includes(storage.authority))
            add(`${path}.authority`, 'authority', 'EOS oder externe Stellhoheit erforderlich.', !storage.authority);
        if (storage.authority === 'external' && storage.primaryPurpose !== 'arbitrage')
            add(path, 'authority-purpose', 'Externe Stellhoheit ist nur für Arbitrage zulässig.');
        storage.powerMeasurement = measurement(entry.powerMeasurement, `${path}.powerMeasurement`);
        storage.socMeasurement = measurement(entry.socMeasurement, `${path}.socMeasurement`, true);
        const identity = storage.powerMeasurement.resolvedSourceId || storage.powerMeasurement.stateId;
        const socIdentity = storage.socMeasurement.resolvedSourceId || storage.socMeasurement.stateId;
        if (identity && identity === socIdentity)
            add(`${path}.socMeasurement`, 'power-soc-source-collision', 'Leistung und Ladezustand sind unterschiedliche Messgrößen und benötigen getrennte physische Quellen.');
        if (identity && powerIds.has(identity))
            add(path, 'duplicate-storage-source', 'Dieselbe Speicherleistung darf nicht mehrfach bilanziert werden.');
        if (identity && pointSources.some((ids) => ids.includes(identity)))
            add(path, 'storage-is-grid-meter', 'Speicher-Istleistung und Bereichszähler benötigen getrennte physische Messquellen.');
        if (identity)
            powerIds.add(identity);
        for (const key of ['maxChargeW', 'maxDischargeW', 'maxDeltaWPerSec'])
            storage[key] = num(entry[key], `${path}.${key}`, key === 'maxDeltaWPerSec' ? 0.000001 : 0);
        storage.minSoc = num(entry.minSoc, `${path}.minSoc`, 0, 100);
        storage.maxSoc = num(entry.maxSoc, `${path}.maxSoc`, 0, 100);
        if (finite(storage.minSoc) && finite(storage.maxSoc) && storage.minSoc >= storage.maxSoc)
            add(path, 'soc-range', 'SoC-Untergrenze muss kleiner als die Obergrenze sein.');
        storage.configuredToleranceW = num(entry.configuredToleranceW ?? 100, `${path}.configuredToleranceW`, 0, 1000000);
        storage.commandTimeoutMs = num(entry.commandTimeoutMs ?? 5000, `${path}.commandTimeoutMs`, 100, 60000);
        storage.ancestorGuards = storage.connectionPointId === 'M1' ? ['M0'] : [];
        if (entry.strategy !== undefined && !plain(entry.strategy))
            add(`${path}.strategy`, 'object', 'Strategie muss ein Objekt sein.');
        const strategy = plain(entry.strategy) ? entry.strategy : {};
        storage.strategy = { targetGridImportW: num(strategy.targetGridImportW ?? 50, `${path}.strategy.targetGridImportW`), importThresholdW: num(strategy.importThresholdW ?? 20, `${path}.strategy.importThresholdW`) };
        if (has(strategy, 'peakLimitW') || storage.primaryPurpose === 'peakShaving')
            storage.strategy.peakLimitW = num(strategy.peakLimitW, `${path}.strategy.peakLimitW`);
        if (entry.availability) {
            const a = entry.availability;
            storage.availability = { stateId: id(a.stateId, `${path}.availability.stateId`), availableValue: a.availableValue, maxAgeMs: num(a.maxAgeMs ?? 5000, `${path}.availability.maxAgeMs`, 1, 60000) };
            if (typeof a.availableValue !== 'boolean' && !finite(a.availableValue))
                add(`${path}.availability.availableValue`, 'availability-value', 'Verfügbarkeit benötigt Boolean oder endliche Zahl.');
        }
        if (entry.requestPowerMeasurement || (storage.primaryPurpose === 'arbitrage' && storage.authority === 'eos'))
            storage.requestPowerMeasurement = measurement(entry.requestPowerMeasurement, `${path}.requestPowerMeasurement`);
        if (entry.command !== undefined && !plain(entry.command))
            add(`${path}.command`, 'object', 'Ausgabevertrag muss ein Objekt sein.');
        const command = plain(entry.command) ? entry.command : {};
        storage.command = { mode: command.mode };
        if (!['signedTarget', 'splitTarget', 'externalLimits'].includes(command.mode))
            add(`${path}.command.mode`, 'command-mode', 'Ausgabeart erforderlich.', !command.mode);
        if ((storage.authority === 'external') !== (command.mode === 'externalLimits'))
            add(`${path}.command`, 'command-authority', 'Externe Stellhoheit benötigt unabhängige Grenzen; EOS benötigt Sollwerte.', !command.mode || !storage.authority);
        const required = command.mode === 'signedTarget' ? ['signedTarget'] : command.mode === 'splitTarget' ? ['chargeTarget', 'dischargeTarget'] : command.mode === 'externalLimits' ? ['maxCharge', 'maxDischarge'] : [];
        for (const key of required)
            storage.command[key] = output(command[key], `${path}.command.${key}`, key === 'signedTarget');
        for (const key of FLAGS)
            if (command[key]) {
                const flag = command[key];
                storage.command[key] = { stateId: id(flag.stateId, `${path}.command.${key}.stateId`), onValue: flag.onValue, offValue: flag.offValue };
                if (flag.readbackStateId)
                    storage.command[key].readbackStateId = id(flag.readbackStateId, `${path}.command.${key}.readbackStateId`);
                if (!['boolean', 'number'].includes(typeof flag.onValue) || typeof flag.onValue !== typeof flag.offValue || flag.onValue === flag.offValue || (typeof flag.onValue === 'number' && (!finite(flag.onValue) || !finite(flag.offValue))))
                    add(`${path}.command.${key}`, 'flag-values', 'Verschiedene gleichartige Boolean-/Zahlenwerte erforderlich.');
            }
        if (command.mode === 'externalLimits') {
            for (const key of ['appliedMaxCharge', 'appliedMaxDischarge']) {
                storage.command[key] = measurement(command[key], `${path}.command.${key}`);
                if (storage.command[key].sign !== 1)
                    add(`${path}.command.${key}`, 'positive-readback', 'Angewandte Maximalgrenzen sind positive Beträge.');
            }
            const watchdog = plain(command.watchdog) ? command.watchdog : {};
            storage.command.watchdog = { stateId: id(watchdog.stateId, `${path}.command.watchdog.stateId`), readbackStateId: id(watchdog.readbackStateId, `${path}.command.watchdog.readbackStateId`), ttlMs: num(watchdog.ttlMs, `${path}.command.watchdog.ttlMs`, 100, 60000), writeValue: watchdog.writeValue, expiryBehavior: watchdog.expiryBehavior };
            if (watchdog.expiryBehavior !== 'zeroLimits')
                add(`${path}.command.watchdog.expiryBehavior`, 'watchdog-expiry', 'Geräteseitiger Ablauf auf Nullgrenzen muss ausdrücklich zugeordnet sein.', watchdog.expiryBehavior === undefined);
            if (typeof watchdog.writeValue !== 'boolean' && !finite(watchdog.writeValue))
                add(`${path}.command.watchdog.writeValue`, 'watchdog-value', 'Watchdog-Wert muss Boolean oder endliche Zahl sein.', watchdog.writeValue === undefined);
        }
        for (const key of [...OUTPUTS, ...FLAGS, 'watchdog']) {
            const mapping = storage.command[key];
            if (!mapping?.stateId)
                continue;
            const physical = resolve(mapping.stateId, `${path}.command.${key}`, true);
            mapping.resolvedWriteId = physical;
            if (outputOwners.has(physical))
                add(`${path}.command.${key}`, 'duplicate-output', `Ein Ausgang darf nur einmal zugeordnet sein (${outputOwners.get(physical)}).`);
            else
                outputOwners.set(physical, `${storage.id}.${key}`);
        }
        config.storages.push(storage);
    }
    const groups = new Map();
    for (const storage of config.storages) {
        if (!identifier(storage.dispatchGroupId))
            continue;
        const signature = JSON.stringify([storage.connectionPointId, storage.controlPointId, storage.primaryPurpose, storage.authority, storage.strategy]);
        if (groups.has(storage.dispatchGroupId) && groups.get(storage.dispatchGroupId) !== signature)
            add('storages', 'mixed-dispatch-group', 'Eine Gruppe benötigt denselben Bereich, dieselbe Aufgabe, Stellhoheit und Strategie.');
        groups.set(storage.dispatchGroupId, signature);
    }
    if (config.storages.length === 0)
        add('storages', 'storage-required', 'Mindestens ein Speicher ist für die Aktivierung erforderlich.', true);
    const pv = require('./dynamic-grid-pv').validateDynamicPvAssignments(raw.pvAssignments === undefined ? [] : raw.pvAssignments, { ...options, active });
    config.pvAssignments = pv.pvAssignments || [];
    topology.pvAssignments = config.pvAssignments;
    errors.push(...(pv.errors || []));
    activationErrors.push(...(pv.activationErrors || []));
    warnings.push(...(pv.warnings || []));
    for (const row of config.pvAssignments) {
        const measured = row.powerMeasurement?.stateId ? resolve(row.powerMeasurement.stateId, `pvAssignments.${row.id}.powerMeasurement`) : null;
        if (measured && (powerIds.has(measured) || pointSources.some((ids) => ids.includes(measured))))
            add(`pvAssignments.${row.id}.powerMeasurement`, 'duplicate-cross-role-measurement', 'PV, Speicher und Bereichszähler benötigen getrennte Messwerte; eine Hybrid-Gesamtleistung darf nicht doppelt bilanziert werden.');
        const physical = row.command?.stateId ? resolve(row.command.stateId, `pvAssignments.${row.id}.command`, true) : null;
        if (physical && outputOwners.has(physical))
            add(`pvAssignments.${row.id}.command`, 'duplicate-output', 'PV und Speicher dürfen keinen gemeinsamen finalen Ausgang besitzen.');
        if (physical)
            outputOwners.set(physical, `pv.${row.id}`);
    }
    const combined = active ? [...errors, ...activationErrors] : errors;
    return { valid: combined.length === 0, config: errors.length ? null : config, topology: errors.length ? null : topology, errors: combined, activationErrors, warnings, activeEligible: errors.length === 0 && activationErrors.length === 0 };
}
/** Liefert die begrenzte Liste der benötigten Rohzustände ohne Objektentdeckung. */
function dynamicGridReadIds(topology) {
    const ids = new Set();
/**
 * Code-Teil: measurement
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const measurement = (m) => { if (m?.kind === 'split') {
        measurement(m.importMeasurement);
        measurement(m.exportMeasurement);
    }
    else if (stateId(m?.stateId))
        ids.add(m.stateId); };
    for (const point of topology?.points || [])
        measurement(point.measurement);
    for (const storage of topology?.storages || []) {
        for (const key of ['powerMeasurement', 'socMeasurement', 'availability', 'requestPowerMeasurement'])
            measurement(storage[key]);
        for (const key of ['appliedMaxCharge', 'appliedMaxDischarge'])
            measurement(storage.command?.[key]);
        for (const key of [...OUTPUTS, ...FLAGS, 'watchdog']) {
            const m = storage.command?.[key];
            if (stateId(m?.readbackStateId || m?.stateId))
                ids.add(m.readbackStateId || m.stateId);
        }
    }
    for (const pv of topology?.pvAssignments || []) {
        measurement(pv.powerMeasurement);
        if (pv.command?.readbackStateId || pv.command?.stateId)
            ids.add(pv.command.readbackStateId || pv.command.stateId);
    }
    return [...ids];
}
/** Alle Schreibzuordnungen für den einzigen finalen Writer, inklusive Watchdog. */
function dynamicGridWriteIds(topology) {
    const ids = new Set();
    for (const storage of topology?.storages || [])
        for (const key of [...OUTPUTS, ...FLAGS, 'watchdog'])
            if (stateId(storage.command?.[key]?.stateId))
                ids.add(storage.command[key].stateId);
    for (const pv of topology?.pvAssignments || [])
        if (stateId(pv.command?.stateId))
            ids.add(pv.command.stateId);
    return [...ids];
}
/** Strenge Rohqualität gilt auch für SoC, Verfügbarkeit und Bestätigungen. */
function readScalar(mapping, state, now) {
/**
 * Code-Teil: invalid
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const invalid = (reason) => ({ valid: false, value: null, ts: state?.ts ?? null, reason });
    if (!mapping || !state)
        return invalid('missing');
    if (!finite(state.ts) || state.ts <= 0 || state.ts > now)
        return invalid('timestamp');
    if (has(state, 'q') && state.q !== 0 || state.connected === false)
        return invalid('quality');
    if (now - state.ts > mapping.maxAgeMs)
        return invalid('stale');
    return { valid: true, value: state.val, ts: state.ts, reason: 'ok' };
}
/**
 * Ein gemeinsamer Messzyklus mit striktem Split-M0, SoC und optionaler
 * Verfügbarkeit. Bestätigungen bleiben Rohzustände und werden erst durch den
 * Writer mit Sequenz, Zeit, ACK und erwartetem Wert verglichen.
 */
function collectDynamicSnapshot(topology, states, now = Date.now()) {
    const result = { valid: true, points: {}, storages: {}, storageTelemetry: {}, requests: {}, readbacks: {}, pv: {}, errors: [], skewMs: 0, ts: now, configVersion: topology?.configVersion };
    const times = [];
/**
 * Code-Teil: collect
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const collect = (mapping) => {
        if (mapping?.kind !== 'split')
            return readMeasurement(mapping, states?.[mapping?.stateId], now);
        const buy = collect(mapping.importMeasurement), sell = collect(mapping.exportMeasurement);
        if (!buy.valid || !sell.valid || buy.valueW < 0 || sell.valueW < 0 || Math.abs(buy.ts - sell.ts) > topology.maxSkewMs)
            return { valid: false, valueW: null, ts: null, reason: 'split-invalid' };
        return { valid: true, valueW: (buy.valueW - sell.valueW) * mapping.sign, ts: Math.min(buy.ts, sell.ts), newestTs: Math.max(buy.ts, sell.ts), ageMs: now - Math.min(buy.ts, sell.ts), reason: 'ok' };
    };
/**
 * Code-Teil: record
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const record = (target, id, sample, path) => {
        target[id] = Object.freeze(sample);
        if (sample.valid) {
            times.push(sample.ts);
            if (sample.newestTs)
                times.push(sample.newestTs);
        }
        else
            result.errors.push({ path, code: sample.reason, message: `${id}: Messwert nicht verwendbar (${sample.reason}).` });
    };
    for (const point of topology?.points || [])
        record(result.points, point.id, collect(point.measurement), `points.${point.id}`);
    for (const storage of topology?.storages || []) {
        const power = collect(storage.powerMeasurement);
        record(result.storages, storage.id, power, `storages.${storage.id}`);
        const soc = readScalar(storage.socMeasurement, states?.[storage.socMeasurement?.stateId], now);
        const socPct = soc.valid && finite(soc.value) && finite(storage.socMeasurement?.scale) ? soc.value * storage.socMeasurement.scale : null;
        const availability = storage.availability ? readScalar(storage.availability, states?.[storage.availability.stateId], now) : { valid: power.valid && soc.valid, value: true, ts: Math.min(power.ts || now, soc.ts || now) };
        const available = availability.valid && (storage.availability ? availability.value === storage.availability.availableValue : true);
        const valid = power.valid && soc.valid && finite(socPct) && socPct >= 0 && socPct <= 100 && availability.valid;
        result.storageTelemetry[storage.id] = { valid, socPct, available, ts: valid ? Math.min(power.ts, soc.ts, availability.ts) : null, maxDeltaWPerSec: storage.maxDeltaWPerSec };
        if (valid)
            times.push(soc.ts, availability.ts);
        else
            result.errors.push({ path: `storages.${storage.id}.telemetry`, code: 'telemetry-invalid', message: `${storage.id}: SoC oder Verfügbarkeit nicht frisch und gültig.` });
        if (storage.requestPowerMeasurement)
            result.requests[storage.id] = collect(storage.requestPowerMeasurement);
        const readbacks = {};
        for (const key of [...OUTPUTS, ...FLAGS, 'watchdog']) {
            const m = storage.command?.[key];
            if (m)
                readbacks[key] = states?.[m.readbackStateId || m.stateId] || null;
        }
        for (const key of ['appliedMaxCharge', 'appliedMaxDischarge'])
            if (storage.command?.[key]) {
                const applied = collect(storage.command[key]);
                applied.ack = states?.[storage.command[key].stateId]?.ack;
                if (applied.valid && (applied.valueW < 0 || applied.ack !== true)) {
                    applied.valid = false;
                    applied.reason = applied.valueW < 0 ? 'negative-applied-limit' : 'unconfirmed-applied-limit';
                }
                readbacks[key] = applied;
            }
        result.readbacks[storage.id] = readbacks;
    }
    for (const pv of topology?.pvAssignments || []) {
        const sample = collect(pv.powerMeasurement);
        if (sample.valid && sample.valueW < 0) {
            sample.valid = false;
            sample.valueW = null;
            sample.reason = 'negative-generation';
        }
        record(result.pv, pv.id, sample, `pvAssignments.${pv.id}`);
    }
    result.skewMs = times.length ? Math.max(...times) - Math.min(...times) : null;
    if (!finite(result.skewMs) || result.skewMs > topology.maxSkewMs)
        result.errors.push({ path: 'measurements', code: 'skew', message: 'Messwerte sind zeitlich nicht ausreichend kohärent.' });
    result.valid = result.errors.length === 0;
    return Object.freeze(result);
}
module.exports = { dynamicGridDefaults, validateDynamicGridConfig, resolveGeneralMeasurement, dynamicGridReadIds, dynamicGridWriteIds, collectDynamicSnapshot };
