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
function own(value, key) {
    return isRecord(value) && Object.prototype.hasOwnProperty.call(value, key);
}
function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function cloneJson(value) { return JSON.parse(JSON.stringify(value)); }
function recordArray(value) {
    return Array.isArray(value) ? value.filter(isRecord) : [];
}
function isIssue(value) {
    return isRecord(value) && typeof value.path === 'string' && typeof value.code === 'string' && typeof value.message === 'string';
}
function isIssues(value) { return Array.isArray(value) && value.every(isIssue); }
/** Prüfresultate ohne Konfigurationsobjekt (z. B. Bestands-PV-Abdeckung). */
function issueResult(value) {
    if (!isRecord(value) || !isIssues(value.errors))
        throw new Error('CONFIG_ISSUE_CONTRACT_INVALID');
    return value.errors;
}
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
function isEntity(value) { return isRecord(value) && typeof value.id === 'string'; }
function isEntities(value) { return Array.isArray(value) && value.every(isEntity); }
function isDynamicConfig(value) {
    return isRecord(value) && typeof value.configVersion === 'number' && Number.isSafeInteger(value.configVersion) && value.configVersion > 0
        && isEntities(value.points) && isEntities(value.storages) && isEntities(value.pvAssignments);
}
function dynamicConfig(value) {
    if (!isDynamicConfig(value))
        throw new Error('DYNAMIC_GRID_VALIDATION_CONTRACT_INVALID');
    return value;
}
function isNvpPoint(value) {
    return isRecord(value) && isRecord(value.measurement) && typeof value.measurement.stateId === 'string';
}
function isNvpStorage(value) {
    return isEntity(value) && isRecord(value.powerMeasurement) && typeof value.powerMeasurement.stateId === 'string';
}
function isNvpConfig(value) {
    return isRecord(value) && typeof value.mode === 'string' && typeof value.operation === 'string'
        && Array.isArray(value.points) && value.points.every(isNvpPoint)
        && Array.isArray(value.storages) && value.storages.every(isNvpStorage) && isEntities(value.pvAssignments);
}
function nvpConfig(value) {
    if (!isNvpConfig(value))
        throw new Error('NVP_VALIDATION_CONTRACT_INVALID');
    return value;
}
/** ioBroker liefert unbekannte Objektwerte; nur State-Objekte mit Objekt-Metadaten gelten als auflösbar. */
function stateObject(value) {
    return isStateObject(value) ? value : null;
}
function isStateObject(value) {
    return isRecord(value) && value.type === 'state' && (value.common === undefined || isRecord(value.common));
}
