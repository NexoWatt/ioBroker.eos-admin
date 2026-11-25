/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/www/power-measurements.ts
 * Quell-Hash: sha256:8871d05c6b55b6d10e7f9f65a1554d1b2ddc1d97cefe93096782149e721576a5
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für www/power-measurements.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
"use strict";
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Vereinheitlicht die Anzeige realer Ladeleistungen und die Prüfung
 * von Leistungs-Datenpunkten im Dashboard und im EMS-AppCenter.
 * Daten und Wirkung: Liest nur Messwerte und Metadaten. Ein gültiger manuell
 * zugeordneter Leistungswert bleibt maßgeblich; boolesche Zustände und fehlende
 * Proben werden nicht als Watt oder künstliche Nullwerte ausgegeben.
 * Zusammenhang: app.ts verwendet dieselbe Quellenauswahl für Karte und
 * Energiefluss; ems-apps.ts meldet unpassende Datentypen und Einheiten.
 * Bei Änderungen: Echte Nullwerte, manuelle Zuordnungen, ungültige Statuswerte,
 * Aggregat-Fallback und die unabhängigen Browser-Vertragstests prüfen.
 */
(() => {
    'use strict';
    const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value : {};
    const number = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
    function resolveEvcsPower(input) {
        const override = number(input.override);
        if (input.overrideConfigured && override !== null)
            return override;
        return number(input.aggregate) ?? override ?? number(input.legacy);
    }
    function validatePowerReference(value) {
        const info = record(value);
        const common = record(info.common);
        const state = record(info.state);
        if (common.type !== 'number')
            return { kind: 'error', text: 'Kein Leistungswert: Zahl in W/kW wählen' };
        if (info.statePresent === true && number(state.val) === null)
            return { kind: 'error', text: 'Kein gültiger Leistungs-Messwert' };
        const unit = typeof common.unit === 'string' ? common.unit.trim().toLowerCase() : '';
        if (unit && unit !== 'w' && unit !== 'kw')
            return { kind: 'error', text: 'Falsche Einheit: Leistung in W/kW wählen' };
        if (!unit)
            return { kind: 'warn', text: 'Einheit fehlt: W/kW-Zuordnung prüfen' };
        return null;
    }
    /** Nur Anzeige/Diagnose: keine Stellwerte, keine erfundene Mindestlast. */
    function resolveFlowBalance(input) {
        const load = number(input.load), consumers = number(input.consumers);
        const ev = input.evAvailable ? number(input.ev) : 0;
        if (load === null || load < 0)
            return { buildingW: null, mismatchW: null, status: 'Gebäudeverbrauch: Messung fehlt oder ist veraltet' };
        if (consumers === null || (input.subtractEv && ev === null))
            return { buildingW: null, mismatchW: null, status: 'Gebäudeaufteilung: Verbrauchermessung fehlt oder ist veraltet' };
        const residual = load - Math.abs(consumers) - (input.subtractEv ? Math.abs(ev ?? 0) : 0);
        if (residual < 0)
            return { buildingW: null, mismatchW: null, status: 'Gebäudeaufteilung unplausibel: Teilverbrauch größer als Gesamtverbrauch – Zuordnung und Zeitstempel prüfen' };
        const pv = number(input.pv), producers = number(input.producers), grid = number(input.grid), battery = number(input.battery);
        if (pv === null || producers === null || grid === null || battery === null)
            return { buildingW: residual, mismatchW: null, status: 'Energiebilanz unvollständig: Messwerte fehlen oder sind veraltet' };
        // Bei deaktiviertem EV-Abzug ist die Zählergrenze kundenspezifisch; keine
        // erfundene Annahme, ob der Gebäudemesswert die Ladestation einschließt.
        if (input.evAvailable && !input.subtractEv)
            return { buildingW: residual, mismatchW: null, status: 'EV-Abzug deaktiviert – Zählergrenze von Gebäude und Ladestation beachten' };
        const mismatch = pv + producers + grid + battery - load;
        const activity = Math.max(Math.abs(load), Math.abs(pv) + Math.abs(producers) + Math.abs(grid) + Math.abs(battery));
        // Diagnoseband für asynchrone Messungen/Verluste; verändert keinen Wert.
        const tolerance = Math.max(150, activity * 0.03);
        return { buildingW: residual, mismatchW: Math.abs(mismatch) > tolerance ? mismatch : null, status: '' };
    }
    Reflect.set(window, 'NexoWattPowerMeasurements', Object.freeze({ resolveEvcsPower, validatePowerReference, resolveFlowBalance }));
})();
