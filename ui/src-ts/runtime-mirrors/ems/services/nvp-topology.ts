/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: ems/services/nvp-topology.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * ems/services/nvp-topology.js
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
 * Original-Hash: f4971090892d160d7a0af976d6c7ea8bad55775f8fbcfb3705aaa1a8ea4ea81c
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
 * Quelle: src-ts/runtime-executables/ems/services/nvp-topology.ts
 * Quell-Hash: sha256:ac061b57e15493c11e0cc524a897b2a8fee511129db669d2867d89bfc20afa64
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für ems/services/nvp-topology.js.
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
 * Aufgabe: Validiert die versionierte NVP-Topologie und liest getrennte Messkontexte für M0, M1 und Speicher.
 * Daten und Wirkung: Konfiguration und ioBroker-Messzustände hinein, geprüfte Werte in W und Diagnosegründe hinaus; keine Hardware- oder State-Schreibzugriffe.
 * Bei Änderungen: Physische Bilanzgrenzen, Nullgrenzen, Aliasidentität, Zeitbezug und die serverseitige Aktivierungsprüfung gemeinsam prüfen.
 * Verknüpfungen: docs/quellcode/src-ts/runtime-executables/ems/services/nvp-topology.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
'use strict';
const POINTS = ['M0', 'M1'];
const PURPOSES = ['selfConsumption', 'zeroExport', 'peakShaving', 'tariff', 'externalArbitrage'];
const UNSAFE_KEYS = ['__proto__', 'prototype', 'constructor'];
/**
 * Code-Teil: own
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
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
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
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
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
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
const identifier = (value) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value) && !UNSAFE_KEYS.includes(value);
/** Statische Defaults enthalten keine zusätzliche Zuordnung und lösen daher keine neuen Gerätezugriffe aus. */
function staticDefaults() {
    return { schemaVersion: 1, configVersion: 1, mode: 'static', operation: 'diagnostic', rootPointId: 'M0', maxSkewMs: 1000, points: [], storages: [], pvAssignments: [] };
}
/**
 * Prüft vollständige Topologien, bevor eine API sie atomar aktiviert. Zahlen werden
 * niemals aus Strings/null/Boolean konvertiert. Eine positive Prüfung bestätigt
 * nur diesen Softwarevertrag, keine elektrische Montage oder Herstellerfähigkeit.
 */
function validateTopology(raw, options = {}) {
    const errors = [];
    const warnings = [];
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
    const add = (path, code, message) => errors.push({ path, code, message });
/**
 * Code-Teil: warn
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const warn = (path, code, message) => warnings.push({ path, code, message });
    if (raw === undefined || raw === null)
        return { valid: true, config: staticDefaults(), errors, warnings, activeEligible: false };
    if (!plain(raw))
        return { valid: false, config: null, errors: [{ path: '', code: 'object', message: 'NVP-Konfiguration muss ein Objekt sein.' }], warnings, activeEligible: false };
    const config = staticDefaults();
/**
 * Code-Teil: scalar
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const scalar = (obj, key, fallback) => own(obj, key) ? obj[key] : fallback;
    config.mode = scalar(raw, 'mode', 'static');
    config.operation = scalar(raw, 'operation', 'diagnostic');
    config.schemaVersion = scalar(raw, 'schemaVersion', 1);
    config.configVersion = scalar(raw, 'configVersion', 1);
    config.rootPointId = scalar(raw, 'rootPointId', 'M0');
    config.maxSkewMs = scalar(raw, 'maxSkewMs', 1000);
    if (config.schemaVersion !== 1)
        add('schemaVersion', 'schema', 'Unbekannte NVP-Schemaversion.');
    if (!Number.isSafeInteger(config.configVersion) || config.configVersion < 1)
        add('configVersion', 'version', 'Konfigurationsversion muss eine positive ganze Zahl sein.');
    if (!['static', 'dynamic'].includes(config.mode))
        add('mode', 'mode', 'NVP-Modus muss static oder dynamic sein.');
    if (!['diagnostic', 'active'].includes(config.operation))
        add('operation', 'operation', 'Betriebszustand muss diagnostic oder active sein.');
    if (!finite(config.maxSkewMs) || config.maxSkewMs < 0 || config.maxSkewMs > 60000)
        add('maxSkewMs', 'range', 'Zulässiger Zeitversatz muss zwischen 0 und 60000 ms liegen.');
    if (config.rootPointId !== 'M0')
        add('rootPointId', 'root', 'M0 ist der übergeordnete Netzanschluss.');
    const dynamic = config.mode === 'dynamic';
    const active = dynamic && (config.operation === 'active' || options.activation === true);
/**
 * Code-Teil: number
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const number = (value, path, min = 0, max = 1000000000) => {
        if (!finite(value) || value < min || value > max) {
            add(path, 'number', `Endliche Zahl zwischen ${min} und ${max} erforderlich.`);
            return null;
        }
        return value;
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
    const measurement = (value, path) => {
        if (!plain(value)) {
            add(path, 'measurement', 'Messzuordnung fehlt.');
            return null;
        }
        const out = {};
        if (typeof value.stateId !== 'string' || !value.stateId.trim() || value.stateId.length > 512 || /[\x00-\x1f\x7f]/.test(value.stateId))
            add(`${path}.stateId`, 'stateId', 'Gültiger Messdatenpunkt erforderlich.');
        out.stateId = value.stateId;
        out.unit = value.unit;
        out.sign = value.sign;
        out.maxAgeMs = value.maxAgeMs;
        if (!['W', 'kW'].includes(out.unit))
            add(`${path}.unit`, 'unit', 'Messleistung muss in W oder kW vorliegen.');
        if (out.sign !== 1 && out.sign !== -1)
            add(`${path}.sign`, 'sign', 'Vorzeichen muss ausdrücklich 1 oder -1 sein.');
        number(out.maxAgeMs, `${path}.maxAgeMs`, 1, 60000);
        if (own(value, 'physicalSourceId')) {
            if (!identifier(value.physicalSourceId))
                add(`${path}.physicalSourceId`, 'identity', 'Ungültige physische Messstellenkennung.');
            else
                out.physicalSourceId = value.physicalSourceId;
        }
        if (options.resolveSourceId && typeof out.stateId === 'string') {
            try {
                const resolved = options.resolveSourceId(out.stateId);
                if (typeof resolved === 'string' && resolved)
                    out.resolvedSourceId = resolved;
                else if (active)
                    add(path, 'unresolved-source', 'Messquelle konnte nicht eindeutig aufgelöst werden.');
            }
            catch (_e) {
                add(path, 'source-resolution', 'Messquelle konnte nicht sicher aufgelöst werden.');
            }
        }
        return out;
    };
/**
 * Code-Teil: readArray
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const readArray = (key, max) => {
        if (!own(raw, key))
            return [];
        if (!Array.isArray(raw[key]) || raw[key].length > max) {
            add(key, 'array', `Liste mit höchstens ${max} Einträgen erforderlich.`);
            return [];
        }
        return raw[key];
    };
    const pointIds = new Set();
    config.points = readArray('points', 2).map((entry, index) => {
        const path = `points[${index}]`;
        if (!plain(entry)) {
            add(path, 'object', 'Messpunkt muss ein Objekt sein.');
            return null;
        }
        const point = { id: entry.id, name: typeof entry.name === 'string' ? entry.name.slice(0, 120) : entry.id, parentId: entry.parentId, measurement: measurement(entry.measurement, `${path}.measurement`) };
        if (!POINTS.includes(point.id) || pointIds.has(point.id))
            add(`${path}.id`, 'point-id', 'M0 und M1 müssen jeweils einmal vorhanden sein.');
        pointIds.add(point.id);
        if (point.id === 'M0' && point.parentId !== null)
            add(`${path}.parentId`, 'topology', 'M0 darf keinen übergeordneten Messpunkt besitzen.');
        if (point.id === 'M1' && point.parentId !== 'M0')
            add(`${path}.parentId`, 'topology', 'M1 muss M0 untergeordnet bleiben.');
        for (const side of ['import', 'export']) {
            const limitKey = `${side}LimitW`, reserveKey = `${side}ReserveW`;
            if (entry[limitKey] === null && point.id === 'M1')
                point[limitKey] = null;
            else
                point[limitKey] = number(entry[limitKey], `${path}.${limitKey}`);
            point[reserveKey] = number(scalar(entry, reserveKey, 0), `${path}.${reserveKey}`);
            if (point[limitKey] === null && point[reserveKey] !== 0)
                add(`${path}.${reserveKey}`, 'reserve-without-limit', 'Reserve benötigt eine bekannte Grenze.');
            if (finite(point[limitKey]) && finite(point[reserveKey]) && point[reserveKey] > point[limitKey])
                add(`${path}.${reserveKey}`, 'reserve', 'Reserve darf die Anschlussgrenze nicht überschreiten.');
        }
        point.failurePolicyId = typeof entry.failurePolicyId === 'string' ? entry.failurePolicyId : '';
        if (active && !identifier(point.failurePolicyId))
            add(`${path}.failurePolicyId`, 'failure-policy', 'Vor Aktivierung ist eine geprüfte Rückfallstrategie zuzuordnen.');
        if (own(entry, 'phaseLimitsA')) {
            if (!Array.isArray(entry.phaseLimitsA) || entry.phaseLimitsA.length !== 3)
                add(`${path}.phaseLimitsA`, 'phases', 'Drei Phasengrenzen erforderlich.');
            else
                point.phaseLimitsA = entry.phaseLimitsA.map((n, i) => number(n, `${path}.phaseLimitsA[${i}]`, 0, 100000));
        }
        if (own(entry, 'apparentPowerLimitVA'))
            point.apparentPowerLimitVA = number(entry.apparentPowerLimitVA, `${path}.apparentPowerLimitVA`);
        if (active && (point.phaseLimitsA || own(point, 'apparentPowerLimitVA')))
            add(path, 'electrical-profile-required', 'Phasen-/Scheinleistungsgrenzen benötigen ein bestätigtes Mess- und Begrenzungsprofil; aktive Freigabe ist hier gesperrt.');
        return point;
    }).filter(Boolean);
    if (dynamic && (!pointIds.has('M0') || !pointIds.has('M1') || config.points.length !== 2))
        add('points', 'points-required', 'Dynamischer Betrieb benötigt M0 und M1.');
    if (dynamic && config.points.length === 2) {
        const a = config.points[0].measurement, b = config.points[1].measurement;
        if (a && b) {
            for (const key of ['stateId', 'physicalSourceId', 'resolvedSourceId'])
                if (a[key] && a[key] === b[key])
                    add('points', 'duplicate-source', 'M0 und M1 dürfen nicht dieselbe physische Messquelle verwenden.');
            if (!a.physicalSourceId || !b.physicalSourceId) {
                if (active)
                    add('points', 'identity-required', 'Für die Aktivierung müssen beide physischen Messstellen identifiziert sein.');
                else
                    warn('points', 'identity-unverified', 'Physische Zuordnung der beiden Messstellen bei der Inbetriebnahme prüfen.');
            }
        }
    }
    const storageIds = new Set();
    const measurementIds = new Set();
    config.storages = readArray('storages', 32).map((entry, index) => {
        const path = `storages[${index}]`;
        if (!plain(entry)) {
            add(path, 'object', 'Speicherzuordnung muss ein Objekt sein.');
            return null;
        }
        const storage = {};
        for (const key of ['id', 'connectionPointId', 'controlPointId', 'dispatchGroupId', 'primaryPurpose', 'authority'])
            storage[key] = entry[key];
        if (!identifier(storage.id) || storageIds.has(storage.id))
            add(`${path}.id`, 'storage-id', 'Eindeutige Speicherkennung erforderlich.');
        storageIds.add(storage.id);
        for (const key of ['connectionPointId', 'controlPointId'])
            if (!POINTS.includes(storage[key]))
                add(`${path}.${key}`, 'point-id', 'Anschluss- und Regelpunkt müssen M0 oder M1 sein.');
        if (!identifier(storage.dispatchGroupId))
            add(`${path}.dispatchGroupId`, 'group-id', 'Gültige Dispatchgruppenkennung erforderlich.');
        if (!PURPOSES.includes(storage.primaryPurpose))
            add(`${path}.primaryPurpose`, 'purpose', 'Unbekannte Speicheraufgabe.');
        if (!['eos', 'external'].includes(storage.authority))
            add(`${path}.authority`, 'authority', 'Stellhoheit muss eos oder external sein.');
        if (storage.connectionPointId !== storage.controlPointId)
            add(path, 'cross-area-control', 'Bereichsübergreifende Regelung benötigt ein gesondert geprüftes Profil und ist in Schema 1 gesperrt.');
        if ((storage.authority === 'external') !== (storage.primaryPurpose === 'externalArbitrage'))
            add(path, 'authority-purpose', 'Externe Arbitrage benötigt externe Stellhoheit; andere Aufgaben benötigen EOS-Stellhoheit.');
        storage.ancestorGuards = storage.connectionPointId === 'M1' ? ['M0'] : [];
        storage.powerMeasurement = measurement(entry.powerMeasurement, `${path}.powerMeasurement`);
        const identity = storage.powerMeasurement && (storage.powerMeasurement.resolvedSourceId || storage.powerMeasurement.physicalSourceId || storage.powerMeasurement.stateId);
        if (identity && measurementIds.has(identity))
            add(`${path}.powerMeasurement`, 'duplicate-storage-source', 'Eine Speicher-Istleistung darf nicht zwei unabhängige Teilnehmer darstellen.');
        if (identity)
            measurementIds.add(identity);
        storage.maxChargeW = number(entry.maxChargeW, `${path}.maxChargeW`);
        storage.maxDischargeW = number(entry.maxDischargeW, `${path}.maxDischargeW`);
        storage.minSoc = number(entry.minSoc, `${path}.minSoc`, 0, 100);
        storage.maxSoc = number(entry.maxSoc, `${path}.maxSoc`, 0, 100);
        if (finite(storage.minSoc) && finite(storage.maxSoc) && storage.minSoc >= storage.maxSoc)
            add(path, 'soc-range', 'Untergrenze des SoC muss kleiner als die Obergrenze sein.');
        for (const key of ['profileId', 'inverterGroupId'])
            if (own(entry, key) && entry[key] !== '') {
                if (!identifier(entry[key]))
                    add(`${path}.${key}`, 'identifier', 'Ungültige Profil-/Wechselrichtergruppenkennung.');
                else
                    storage[key] = entry[key];
            }
        if (active && storage.authority === 'external' && !(options.supportedProfileIds || []).includes(storage.profileId))
            add(`${path}.profileId`, 'external-profile-unverified', 'Externes Geräteprofil einschließlich Ablauf und Rückmeldung ist nicht bestätigt.');
        return storage;
    }).filter(Boolean);
    const groups = new Map();
    for (const storage of config.storages) {
        const signature = [storage.connectionPointId, storage.controlPointId, storage.primaryPurpose, storage.authority].join('|');
        if (groups.has(storage.dispatchGroupId) && groups.get(storage.dispatchGroupId) !== signature)
            add('storages', 'mixed-dispatch-group', 'Eine Dispatchgruppe darf keine unterschiedlichen Bereiche, Aufgaben oder Stellhoheiten mischen.');
        groups.set(storage.dispatchGroupId, signature);
    }
    const pvIds = new Set();
    config.pvAssignments = readArray('pvAssignments', 64).map((entry, index) => {
        const path = `pvAssignments[${index}]`;
        if (!plain(entry)) {
            add(path, 'object', 'PV-Zuordnung muss ein Objekt sein.');
            return null;
        }
        const pv = { id: entry.id, connectionPointId: entry.connectionPointId, referencePowerW: number(entry.referencePowerW, `${path}.referencePowerW`, 1) };
        if (!identifier(pv.id) || pvIds.has(pv.id))
            add(`${path}.id`, 'pv-id', 'Eindeutige PV-Kennung erforderlich.');
        pvIds.add(pv.id);
        if (!POINTS.includes(pv.connectionPointId))
            add(`${path}.connectionPointId`, 'point-id', 'PV-Anschlussbereich muss M0 oder M1 sein.');
        for (const key of ['profileId', 'inverterGroupId'])
            if (own(entry, key) && entry[key] !== '') {
                if (!identifier(entry[key]))
                    add(`${path}.${key}`, 'identifier', 'Ungültige Profil-/Wechselrichtergruppenkennung.');
                else
                    pv[key] = entry[key];
            }
        return pv;
    }).filter(Boolean);
    if (dynamic && config.storages.length === 0)
        warn('storages', 'no-storage', 'Noch kein Speicher einem Regelbereich zugeordnet.');
    // Bei statisch dürfen explizit gespeicherte dynamische Zuordnungen erhalten bleiben,
    // werden aber nicht ausgeführt. Fehlerhafte Entwürfe werden auch hier nicht übernommen.
    return { valid: errors.length === 0, config: errors.length ? null : config, errors, warnings, activeEligible: errors.length === 0 && active };
}
/** Nur Anschlussbereiche bestimmen die elektrische Wirkung: M0 enthält M1 bereits. */
function affectsPoint(connectionPointId, pointId) {
    return POINTS.includes(connectionPointId) && (pointId === 'M0' || (pointId === 'M1' && connectionPointId === 'M1'));
}
/**
 * Liest echte Messwerte mit separater Frische und Qualität. ts, nicht lc, ist der
 * Aktualitätsbezug: unveränderte, frisch übertragene Messungen bleiben verwendbar.
 * connected=true und ein Empfangs-ACK ersetzen niemals einen frischen Messwert.
 */
function readMeasurement(config, state, now = Date.now()) {
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
    const invalid = (reason, ts = null) => ({ valid: false, valueW: null, ts, ageMs: finite(ts) && finite(now) ? now - ts : null, reason });
    if (!plain(config) || !['W', 'kW'].includes(config.unit) || ![1, -1].includes(config.sign) || !finite(config.maxAgeMs) || config.maxAgeMs <= 0)
        return invalid('configuration');
    if (!plain(state))
        return invalid('missing');
    if (!finite(state.val))
        return invalid('invalid-value');
    if (!finite(state.ts) || state.ts <= 0 || !finite(now))
        return invalid('invalid-timestamp');
    if (state.connected === false)
        return invalid('disconnected', state.ts);
    if (own(state, 'q') && state.q !== 0)
        return invalid('quality', state.ts);
    if (state.ts > now)
        return invalid('future-timestamp', state.ts);
    if (now - state.ts > config.maxAgeMs)
        return invalid('stale', state.ts);
    const valueW = state.val * (config.unit === 'kW' ? 1000 : 1) * config.sign;
    if (!finite(valueW) || Math.abs(valueW) > 1000000000)
        return invalid('out-of-range', state.ts);
    return { valid: true, valueW, ts: state.ts, ageMs: now - state.ts, reason: 'ok' };
}
/** Erstellt genau einen unveränderlichen Lesezyklus; Fehler werden nicht durch Nullwerte ersetzt. */
function collectSnapshot(config, statesById, now = Date.now()) {
    const points = Object.create(null), storages = Object.create(null);
    const errors = [];
    const timestamps = [];
    if (!config || config.mode !== 'dynamic')
        return { valid: true, points, storages, errors, skewMs: 0, ts: now, configVersion: config && config.configVersion };
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
    const collect = (entries, key, target) => {
        for (const entry of entries) {
            const m = entry[key];
            const result = readMeasurement(m, m && statesById && statesById[m.stateId], now);
            target[entry.id] = Object.freeze(result);
            if (result.valid)
                timestamps.push(result.ts);
            else
                errors.push({ path: `${key}.${entry.id}`, code: result.reason, message: `${entry.id}: Messwert nicht verwendbar (${result.reason}).` });
        }
    };
    collect(config.points || [], 'measurement', points);
    collect(config.storages || [], 'powerMeasurement', storages);
    const skewMs = timestamps.length ? Math.max(...timestamps) - Math.min(...timestamps) : null;
    if (!finite(skewMs) || skewMs > config.maxSkewMs)
        errors.push({ path: 'measurements', code: 'skew', message: 'Messwerte sind zeitlich nicht ausreichend kohärent.' });
    return Object.freeze({ valid: errors.length === 0, points: Object.freeze(points), storages: Object.freeze(storages), errors: Object.freeze(errors), skewMs, ts: now, configVersion: config.configVersion });
}
/** Homogene Gruppen verwenden einen gemeinsamen Bereichsbedarf; niemals einen Regler pro Batterie auf denselben Fehler anwenden. */
function groupStorages(config) {
    const groups = new Map();
    for (const storage of config.storages || []) {
        if (!groups.has(storage.dispatchGroupId))
            groups.set(storage.dispatchGroupId, { id: storage.dispatchGroupId, connectionPointId: storage.connectionPointId, controlPointId: storage.controlPointId, primaryPurpose: storage.primaryPurpose, authority: storage.authority, ancestorGuards: storage.ancestorGuards || (storage.connectionPointId === 'M1' ? ['M0'] : []), storages: [] });
        groups.get(storage.dispatchGroupId).storages.push(storage);
    }
    return [...groups.values()];
}
module.exports = { staticDefaults, validateTopology, affectsPoint, readMeasurement, collectSnapshot, groupStorages };
