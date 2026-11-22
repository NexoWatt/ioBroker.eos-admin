/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: lib/config-boundary-contracts.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * lib/config-boundary-contracts.js
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
 * Original-Hash: cc2afbc9cb8786914e89449d8981e377841d4a70f61db7c877e6b5e11ba9c01f
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
 * Quelle: src-ts/runtime-executables/lib/config-boundary-contracts.ts
 * Quell-Hash: sha256:9f912784cde03899343c91fb0505d7b2740b532d967136d9b8ad6d98129ad68f
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/config-boundary-contracts.js.
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
exports.isRecord = isRecord;
exports.record = record;
exports.own = own;
exports.text = text;
exports.cloneJson = cloneJson;
exports.recordArray = recordArray;
exports.isIssue = isIssue;
exports.issueResult = issueResult;
exports.validationResult = validationResult;
exports.dynamicConfig = dynamicConfig;
exports.nvpConfig = nvpConfig;
exports.stateObject = stateObject;
/** Unbekannte Objekte werden erst nach dieser Formprüfung als Dictionary gelesen. */
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** Fehlende Teilkonfigurationen liefern ein leeres Dictionary ohne geerbte Schlüssel. */
function record(value) {
    if (isRecord(value))
        return value;
    const empty = Object.create(null);
    return empty;
}
/**
 * Code-Teil: own
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function own(value, key) {
    return isRecord(value) && Object.prototype.hasOwnProperty.call(value, key);
}
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
function text(value) { return typeof value === 'string' ? value.trim() : ''; }
/**
 * Code-Teil: cloneJson
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function cloneJson(value) { return JSON.parse(JSON.stringify(value)); }
/**
 * Code-Teil: recordArray
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function recordArray(value) {
    return Array.isArray(value) ? value.filter(isRecord) : [];
}
/**
 * Code-Teil: isIssue
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function isIssue(value) {
    return isRecord(value) && typeof value.path === 'string' && typeof value.code === 'string' && typeof value.message === 'string';
}
/**
 * Code-Teil: isIssues
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function isIssues(value) { return Array.isArray(value) && value.every(isIssue); }
/** Prüfresultate ohne Konfigurationsobjekt (z. B. Bestands-PV-Abdeckung). */
function issueResult(value) {
    if (!isRecord(value) || !isIssues(value.errors))
        throw new Error('CONFIG_ISSUE_CONTRACT_INVALID');
    return value.errors;
}
/**
 * Code-Teil: isValidation
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function isValidation(value) {
    return isRecord(value) && typeof value.valid === 'boolean' && own(value, 'config') && isIssues(value.errors)
        && (value.warnings === undefined || isIssues(value.warnings))
        && (value.activationErrors === undefined || isIssues(value.activationErrors))
        && (value.activeEligible === undefined || typeof value.activeEligible === 'boolean');
}
/** Zusätzliche interne Vertragsprüfung, keine zweite fachliche Normalisierung. */
function validationResult(value) {
    if (!isValidation(value))
        throw new Error('CONFIG_VALIDATION_CONTRACT_INVALID');
    return value;
}
/**
 * Code-Teil: isEntity
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function isEntity(value) { return isRecord(value) && typeof value.id === 'string'; }
/**
 * Code-Teil: isEntities
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function isEntities(value) { return Array.isArray(value) && value.every(isEntity); }
/**
 * Code-Teil: isDynamicConfig
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function isDynamicConfig(value) {
    return isRecord(value) && typeof value.configVersion === 'number' && Number.isSafeInteger(value.configVersion) && value.configVersion > 0
        && isEntities(value.points) && isEntities(value.storages) && isEntities(value.pvAssignments);
}
/**
 * Code-Teil: dynamicConfig
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function dynamicConfig(value) {
    if (!isDynamicConfig(value))
        throw new Error('DYNAMIC_GRID_VALIDATION_CONTRACT_INVALID');
    return value;
}
/**
 * Code-Teil: isNvpPoint
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function isNvpPoint(value) {
    return isRecord(value) && isRecord(value.measurement) && typeof value.measurement.stateId === 'string';
}
/**
 * Code-Teil: isNvpStorage
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function isNvpStorage(value) {
    return isEntity(value) && isRecord(value.powerMeasurement) && typeof value.powerMeasurement.stateId === 'string';
}
/**
 * Code-Teil: isNvpConfig
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function isNvpConfig(value) {
    return isRecord(value) && typeof value.mode === 'string' && typeof value.operation === 'string'
        && Array.isArray(value.points) && value.points.every(isNvpPoint)
        && Array.isArray(value.storages) && value.storages.every(isNvpStorage) && isEntities(value.pvAssignments);
}
/**
 * Code-Teil: nvpConfig
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function nvpConfig(value) {
    if (!isNvpConfig(value))
        throw new Error('NVP_VALIDATION_CONTRACT_INVALID');
    return value;
}
/** ioBroker liefert unbekannte Objektwerte; nur State-Objekte mit Objekt-Metadaten gelten als auflösbar. */
function stateObject(value) {
    return isStateObject(value) ? value : null;
}
/**
 * Code-Teil: isStateObject
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function isStateObject(value) {
    return isRecord(value) && value.type === 'state' && (value.common === undefined || isRecord(value.common));
}
