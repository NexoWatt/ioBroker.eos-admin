/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/ems/services/locale-api-service.ts
 * Quell-Hash: sha256:e700619bb5ccd58092f5bc88365e65ce2420d601407f9c8c09f8060f0f0356ea
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für ems/services/locale-api-service.js.
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
 * Aufgabe: Stellt Sprach-/Regionseinstellungen über die zugehörige Backend-Schnittstelle bereit.
 * Daten und Wirkung: Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.
 * Bei Änderungen: Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.
 * Verknüpfungen: docs/quellcode/src-ts/runtime-executables/ems/services/locale-api-service.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
/**
 * Executable TypeScript source: ems/services/locale-api-service.js
 *
 * Kleiner API-Handler für die live übernommene ioBroker-/EOS-Systemsprache.
 * Die Datei wird aus strikt typisiertem TypeScript in die produktive JS-Runtime transpiliert.
 */
'use strict';
function createLocaleHandler(adapter, sendNoStore) {
    return async function localeHandler(_req, res) {
        try {
            sendNoStore(res);
            await adapter._nwRefreshSystemLanguage('api-locale');
            return res.json({
                ok: true,
                locale: adapter._nwBuildLocaleInfo(),
                countryProfile: adapter._nwBuildCountryProfileInfo(),
                ts: Date.now(),
            });
        }
        catch (error) {
            return res.status(500).json({
                ok: false,
                error: 'locale_unavailable',
                message: String(error instanceof Error ? error.message : error),
            });
        }
    };
}
module.exports = { createLocaleHandler };
