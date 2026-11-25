/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/postgres-history-config.ts
 * Quell-Hash: sha256:67068de65cc570f8a0a489acfa6b6afa902b63867afdcb608d3f52c5159b3090
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/postgres-history-config.js.
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
exports.isUntouchedHistoryDefault = isUntouchedHistoryDefault;
exports.prepareHistoryChange = prepareHistoryChange;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Enge Auswahlgrenze für die lokale PostgreSQL-Historie.
 * Daten und Wirkung: Nimmt keine Hostnamen, Dateipfade oder Geheimnisse vom Browser an.
 * Bestehende Historien bleiben erhalten; ein Providerwechsel erfordert nachgewiesene Neuanlage.
 */
const node_util_1 = require("node:util");
const influx_config_1 = require("./influx-config");
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (code) => Object.assign(new Error(code), { code });
/** Bundled native defaults are not evidence of a customer selecting a historian. */
function isUntouchedHistoryDefault(value, packagedDefault) {
    return value === undefined || (0, node_util_1.isDeepStrictEqual)(value, packagedDefault);
}
function prepareHistoryChange(previous, incoming, newInstallationAllowed) {
    if (!record(incoming) || incoming.provider !== 'postgresql')
        return (0, influx_config_1.prepareInfluxHistoryChange)(previous, incoming);
    if (Object.keys(incoming).some(key => !['provider', 'postgresql', 'newInstallation'].includes(key)) ||
        !record(incoming.postgresql) || incoming.postgresql.profile !== 'local' ||
        Object.keys(incoming.postgresql).some(key => key !== 'profile') ||
        incoming.newInstallation !== undefined && typeof incoming.newInstallation !== 'boolean')
        throw fail('EOS_POSTGRES_PROFILE_INVALID');
    const old = record(previous) ? previous : {};
    if (old.provider !== 'postgresql') {
        if (!newInstallationAllowed)
            throw fail('EOS_POSTGRES_EXISTING_HISTORY');
        if (incoming.newInstallation !== true)
            throw fail('EOS_POSTGRES_NEW_INSTALLATION_REQUIRED');
    }
    return { ...old, provider: 'postgresql', postgresql: { profile: 'local' } };
}
