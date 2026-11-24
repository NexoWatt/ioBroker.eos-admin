/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/installer-lifecycle.ts
 * Quell-Hash: sha256:970590230a91cc592372ca6da3f1ff8e460c5cd8143345de321bc6eb416cd083
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/installer-lifecycle.js.
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
exports.installerRevision = installerRevision;
exports.assertInstallerRevision = assertInstallerRevision;
exports.provisionInstallerObjects = provisionInstallerObjects;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Schützt AppCenter-Zuordnungen vor veralteten Speicherformularen und
 * legt fehlende eigene Datenpunktobjekte vor der Laufzeitübernahme an.
 * Daten und Wirkung: Eine flüchtig geschützte HMAC-Revision verlässt den Server,
 * niemals Konfigurationswerte oder der HMAC-Schlüssel. Pro Objektgruppe gibt es
 * höchstens zwei Versuche; fehlende Messwerte bleiben ohne künstlichen Nullwert.
 * Zusammenhang: Automatische Gerätezuordnung und manuelles Speichern verwenden
 * denselben AppCenter-Mutationsschutz. Keine App oder Stellfreigabe wird erteilt.
 * Bei Änderungen: Veraltete nichtleere Listen, Ownership-Verlust, fehlgeschlagene
 * Objektanlage und unveränderte Kundenwerte prüfen; Neustarts verwerfen alte Revisionen.
 */
const node_crypto_1 = require("node:crypto");
const http_error_boundary_1 = require("./http-error-boundary");
const revisionSecret = (0, node_crypto_1.randomBytes)(32);
function record(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function canonical(value) {
    if (Array.isArray(value))
        return value.map(canonical);
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
    }
    return value;
}
/** Stable within this runtime across key ordering; restart invalidates old forms.
 * An ephemeral HMAC key prevents public revisions from becoming a secret-value guessing oracle. */
function installerRevision(patch) {
    return (0, node_crypto_1.createHmac)('sha256', revisionSecret).update(JSON.stringify(canonical(record(patch)))).digest('hex');
}
/** Older clients remain compatible until automatic bindings need protection.
 * Once present, a missing or stale token must never replace a newer nonempty row list. */
function assertInstallerRevision(expected, patch) {
    const bindings = record(record(record(patch).eosDeviceEms).bindings);
    const required = Object.keys(bindings).length > 0;
    if ((expected === undefined || expected === null) && !required)
        return;
    if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected) || expected !== installerRevision(patch)) {
        throw (0, http_error_boundary_1.createPublicHttpError)(409, 'EOS_INSTALLER_CONFIG_CHANGED', 'Die EMS-Zuordnung wurde inzwischen geändert. Deine Eingaben bleiben erhalten. Bitte den aktuellen Stand über „Neu laden“ laden und die Änderungen vergleichen, bevor du erneut speicherst.');
    }
}
/** Bounded retries tolerate a transient controller failure. No deletion, state reset or detached work. */
async function provisionInstallerObjects(options) {
    for (const step of options.steps) {
        let completed = false;
        for (let attempt = 0; attempt < 2; attempt++) {
            if (!options.canWrite())
                throw (0, http_error_boundary_1.createPublicHttpError)(409, 'EOS_UI_OWNERSHIP_REQUIRED', 'Die Systemfreigabe ist nicht mehr gültig. Einstellungen wurden nicht neu übernommen.');
            try {
                await step();
                completed = true;
                break;
            }
            catch { /* Retry only idempotent object creation. */ }
        }
        if (!completed)
            throw (0, http_error_boundary_1.createPublicHttpError)(503, 'EOS_EMS_OBJECT_PROVISION_FAILED', 'Die benötigten EMS-Datenpunktobjekte konnten nicht angelegt werden. Es wurde kein erfolgreicher Abschluss gemeldet; Verbindung prüfen und erneut speichern.');
    }
}
