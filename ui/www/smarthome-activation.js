/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/www/smarthome-activation.ts
 * Quell-Hash: sha256:fcdb69a4abb524ea6e021bd996c2729b1a424d8ab2c0b9ece1edcff5d63a20b4
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für www/smarthome-activation.js.
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
 * Aufgabe: Zeigt und speichert die SmartHome-Aktivierung direkt im Installer.
 * Daten und Wirkung: Überträgt ausschließlich einen Boolean an die geschützte
 * Aktivierungs-API. Gebäudeentwürfe und gespeicherte Geräte-, Zeitprogramm-
 * und Szenenkonfigurationen bleiben erhalten. auth.ts übernimmt Sitzung und
 * CSRF; der Server prüft Rechte und aktiviert die passende Geräteansicht.
 * Bei Änderungen: Abgelaufene Sitzung, fehlende Lizenz, fehlgeschlagene
 * Speicherung und unveränderte Editorentwürfe mitprüfen. Kein automatisches
 * Wiederholen eines Schreibbefehls nach einem Fehler.
 */
(function () {
    'use strict';
    const endpoint = '/api/smarthome/activation';
    /** Die Serverantwort darf nur einen bestätigten Boolean zur Anzeige liefern. */
    function confirmedEnabled(value) {
        if (!value || typeof value !== 'object' || !('ok' in value) || value.ok !== true
            || !('enabled' in value) || typeof value.enabled !== 'boolean') {
            throw new Error('Der gespeicherte Status wurde nicht bestätigt. Bitte Status neu laden.');
        }
        return value.enabled;
    }
    /** Verwendet den gemeinsamen Auth-/CSRF-Fetch und eine begrenzte Anfrage. */
    async function request(enabled) {
        const options = { cache: 'no-store', signal: AbortSignal.timeout(5000) };
        if (enabled !== undefined) {
            options.method = 'POST';
            options.headers = { 'Content-Type': 'application/json' };
            options.body = JSON.stringify({ enabled });
        }
        const response = await fetch(endpoint, options);
        if (response.status === 401)
            throw new Error('Sitzung abgelaufen. Bitte erneut bei EOS anmelden.');
        if (response.status === 403)
            throw new Error('Keine Freigabe. Bitte Rolle und EOS-Systemlizenz prüfen.');
        if (response.status === 409)
            throw new Error('Eine andere Konfiguration wird gerade gespeichert. Bitte anschließend erneut speichern.');
        if (!response.ok)
            throw new Error('Der gespeicherte Status wurde nicht bestätigt. Bitte Status neu laden.');
        const data = await response.json();
        return confirmedEnabled(data);
    }
    function initialize() {
        const checkbox = document.getElementById('nw-smarthome-enabled');
        const save = document.getElementById('nw-smarthome-activation-save');
        const reload = document.getElementById('nw-smarthome-activation-reload');
        const status = document.getElementById('nw-smarthome-activation-status');
        if (!(checkbox instanceof HTMLInputElement) || !(save instanceof HTMLButtonElement)
            || !(reload instanceof HTMLButtonElement) || !(status instanceof HTMLElement))
            return;
        bindControls(checkbox, save, reload, status);
    }
    function bindControls(checkbox, save, reload, status) {
        let persisted = null;
        let busy = false;
        function renderControls() {
            checkbox.disabled = busy || persisted === null;
            save.disabled = busy || persisted === null || checkbox.checked === persisted;
            reload.disabled = busy;
        }
        function show(message, error = false) {
            status.textContent = message;
            status.dataset.error = String(error);
        }
        /** Lädt nur den Schalter; ungespeicherte Gebäudedaten werden nicht neu geladen. */
        async function synchronize(saving) {
            if (busy || (saving && persisted === null))
                return;
            busy = true;
            renderControls();
            show(saving ? 'SmartHome-Aktivierung wird gespeichert …' : 'SmartHome-Status wird geladen …');
            try {
                const enabled = await request(saving ? checkbox.checked : undefined);
                persisted = enabled;
                checkbox.checked = enabled;
                show(enabled ? 'SmartHome ist aktiviert und wird im Dashboard angezeigt.' : 'SmartHome ist deaktiviert. Die Konfiguration bleibt erhalten.');
            }
            catch (error) {
                show(error instanceof Error && error.name !== 'TimeoutError' && error.name !== 'AbortError'
                    ? error.message
                    : 'Der gespeicherte Status ist nicht bestätigt. Bitte Verbindung prüfen und Status neu laden.', true);
            }
            finally {
                busy = false;
                renderControls();
            }
        }
        checkbox.addEventListener('change', () => {
            renderControls();
            show(checkbox.checked === persisted ? 'SmartHome-Aktivierung unverändert.' : 'SmartHome-Aktivierung geändert. Bitte separat speichern.');
        });
        // synchronize behandelt jeden Fehler und verändert ausschließlich diese Karte.
        save.addEventListener('click', () => { void synchronize(true); });
        reload.addEventListener('click', () => { void synchronize(false); });
        void synchronize(false);
    }
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else
        initialize();
})();
