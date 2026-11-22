/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/http-error-boundary.ts
 * Quell-Hash: sha256:d44e839cda81fd990eab425b2495b02409e43d85697b18831db24de7c12529ec
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/http-error-boundary.js.
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
exports.safeHttpFailure = safeHttpFailure;
exports.createPublicHttpError = createPublicHttpError;
exports.safeConfigurationFailure = safeConfigurationFailure;
exports.safeSourceFailureCode = safeSourceFailureCode;
function policy(status, error, message) {
    return Object.freeze({ status, body: Object.freeze({ ok: false, error, message }) });
}
const INTERNAL = policy(500, 'internal_error', 'Anfrage konnte intern nicht verarbeitet werden.');
const INVALID_JSON = policy(400, 'invalid_json', 'Der Anfragekörper enthält kein gültiges JSON.');
// Der bestehende Fehlercode bleibt für die App-Center-Größenprüfung kompatibel.
const TOO_LARGE = policy(413, 'payload too large', 'Der Anfragekörper ist zu groß.');
const INVALID_BODY = policy(400, 'invalid_request_body', 'Der Anfragekörper konnte nicht gelesen werden.');
const UNSUPPORTED_ENCODING = policy(415, 'unsupported_encoding', 'Die Zeichen- oder Inhaltskodierung wird nicht unterstützt.');
/** Nur eigene einfache Datenwerte lesen; Accessoren werden nicht aufgerufen. */
function ownData(value, key) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') ? descriptor.value : undefined;
}
/** Der unbekannte Fehler kann selbst ein Proxy oder eine ungültige Eingabe sein. */
function safeHttpFailure(error) {
    try {
        if (error === null || typeof error !== 'object')
            return INTERNAL;
        const kind = ownData(error, 'type');
        switch (kind) {
            case 'entity.too.large': return TOO_LARGE;
            case 'entity.parse.failed': return INVALID_JSON;
            case 'request.aborted':
            case 'request.size.invalid': return INVALID_BODY;
            case 'charset.unsupported':
            case 'encoding.unsupported': return UNSUPPORTED_ENCODING;
            default: return INTERNAL;
        }
    }
    catch (_classificationError) {
        return INTERNAL;
    }
}
const publicErrors = new WeakMap();
/** Nur interne Validatoren erzeugen einen öffentlichen Fehlervertrag.
 * Die Provenienz liegt außerhalb des Error-Objekts; fremde status/code-Felder
 * oder nachträglich geänderte Error-Eigenschaften können sie nicht nachbilden.
 * Details sind begrenzte Kopien fachlicher Validierung, keine Exceptions.
 */
function createPublicHttpError(status, code, message, details = []) {
    const safeStatus = [400, 403, 409, 413, 422, 503].includes(status) ? status : 500;
    const safeCode = /^[A-Z][A-Z0-9_]{0,95}$/.test(code) ? code : 'INTERNAL_ERROR';
    const safeMessage = message.slice(0, 500);
    const safeDetails = Object.freeze(details.slice(0, 100).map(issue => Object.freeze({
        path: issue.path.slice(0, 512), code: issue.code.slice(0, 96), message: issue.message.slice(0, 400),
    })));
    const failure = Object.freeze({ status: safeStatus, body: Object.freeze({ ok: false, error: safeCode, message: safeMessage, details: safeDetails }) });
    const error = Object.assign(new Error(safeMessage), { status: safeStatus, code: safeCode, details: safeDetails });
    publicErrors.set(error, failure);
    return error;
}
/** Fremde Fehler dürfen selbst mit gefälschtem Code keine Detailausgabe erreichen. */
function safeConfigurationFailure(error) {
    if (error !== null && typeof error === 'object') {
        const known = publicErrors.get(error);
        if (known)
            return known;
    }
    return INTERNAL;
}
/** Nur bekannte lokale Auflösungsfehler dürfen als Diagnosecode erscheinen. */
function safeSourceFailureCode(error) {
    try {
        const message = error !== null && typeof error === 'object' ? ownData(error, 'message') : undefined;
        return typeof message === 'string' && ['ALIAS_CYCLE_OR_DEPTH', 'STATE_OBJECT_MISSING',
            'STATE_NOT_WRITABLE', 'STATE_NOT_READABLE', 'ALIAS_WRITE_SOURCE_INVALID',
            'ALIAS_READ_SOURCE_INVALID', 'MEASUREMENT_SOURCE_UNAVAILABLE'].includes(message)
            ? message : 'STATE_LOOKUP_FAILED';
    }
    catch (_classificationError) {
        return 'STATE_LOOKUP_FAILED';
    }
}
