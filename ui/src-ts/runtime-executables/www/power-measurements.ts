/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
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
    type Data = Record<string, unknown>;
    type Issue = { kind: 'error' | 'warn'; text: string };
    const record = (value: unknown): Data => value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Data : {};
    const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

    function resolveEvcsPower(input: { overrideConfigured: boolean; override: unknown; aggregate: unknown; legacy: unknown }): number | null {
        const override = number(input.override);
        if (input.overrideConfigured && override !== null) return override;
        return number(input.aggregate) ?? override ?? number(input.legacy);
    }

    function validatePowerReference(value: unknown): Issue | null {
        const info = record(value);
        const common = record(info.common);
        const state = record(info.state);
        if (common.type !== 'number') return { kind: 'error', text: 'Kein Leistungswert: Zahl in W/kW wählen' };
        if (info.statePresent === true && number(state.val) === null) return { kind: 'error', text: 'Kein gültiger Leistungs-Messwert' };
        const unit = typeof common.unit === 'string' ? common.unit.trim().toLowerCase() : '';
        if (unit && unit !== 'w' && unit !== 'kw') return { kind: 'error', text: 'Falsche Einheit: Leistung in W/kW wählen' };
        if (!unit) return { kind: 'warn', text: 'Einheit fehlt: W/kW-Zuordnung prüfen' };
        return null;
    }

    type FlowInput = {
        load: unknown; ev: unknown; consumers: unknown; pv: unknown; producers: unknown;
        grid: unknown; battery: unknown; subtractEv: boolean; evAvailable: boolean; buildingQuality?: unknown;
    };
    type FlowView = { buildingW: number | null; mismatchW: number | null; status: string };
    function missingBuildingStatus(quality: unknown): string {
        switch (quality) {
            case 'invalid-balance': return 'Gebäudeverbrauch nicht berechenbar. Die Energiebilanz ist negativ. Messpunkte, Vorzeichen und Zeitstempel prüfen.';
            case 'missing-grid': return 'Gebäudeverbrauch nicht berechenbar. Die Netzmessung fehlt oder ist veraltet.';
            case 'missing-pv': return 'Gebäudeverbrauch nicht berechenbar. Die PV-Messung fehlt oder ist veraltet.';
            case 'missing-storage': return 'Gebäudeverbrauch nicht berechenbar. Die Speicherleistungsmessung fehlt oder ist veraltet.';
            case 'missing-producer': return 'Gebäudeverbrauch nicht berechenbar. Die Messung eines zusätzlichen Erzeugers fehlt oder ist veraltet.';
            default: return 'Gebäudeverbrauch: Messung fehlt oder ist veraltet';
        }
    }
    /** Nur Anzeige/Diagnose: keine Stellwerte, keine erfundene Mindestlast. */
    function resolveFlowBalance(input: FlowInput): FlowView {
        const load = number(input.load), consumers = number(input.consumers);
        const ev = input.evAvailable ? number(input.ev) : 0;
        if (load === null || load < 0) return { buildingW: null, mismatchW: null, status: missingBuildingStatus(input.buildingQuality) };
        if (consumers === null || (input.subtractEv && ev === null)) return { buildingW: null, mismatchW: null, status: 'Gebäudeaufteilung: Verbrauchermessung fehlt oder ist veraltet' };
        const residual = load - Math.abs(consumers) - (input.subtractEv ? Math.abs(ev ?? 0) : 0);
        if (residual < 0) return { buildingW: null, mismatchW: null, status: 'Gebäudeaufteilung unplausibel: Teilverbrauch größer als Gesamtverbrauch – Zuordnung und Zeitstempel prüfen' };
        const pv = number(input.pv), producers = number(input.producers), grid = number(input.grid), battery = number(input.battery);
        if (pv === null || producers === null || grid === null || battery === null) return { buildingW: residual, mismatchW: null, status: 'Energiebilanz unvollständig: Messwerte fehlen oder sind veraltet' };
        // Bei deaktiviertem EV-Abzug ist die Zählergrenze kundenspezifisch; keine
        // erfundene Annahme, ob der Gebäudemesswert die Ladestation einschließt.
        if (input.evAvailable && !input.subtractEv) return { buildingW: residual, mismatchW: null, status: 'EV-Abzug deaktiviert – Zählergrenze von Gebäude und Ladestation beachten' };
        const mismatch = pv + producers + grid + battery - load;
        const activity = Math.max(Math.abs(load), Math.abs(pv) + Math.abs(producers) + Math.abs(grid) + Math.abs(battery));
        // Diagnoseband für asynchrone Messungen/Verluste; verändert keinen Wert.
        const tolerance = Math.max(150, activity * 0.03);
        return { buildingW: residual, mismatchW: Math.abs(mismatch) > tolerance ? mismatch : null, status: '' };
    }

    Reflect.set(window, 'NexoWattPowerMeasurements', Object.freeze({ resolveEvcsPower, validatePowerReference, resolveFlowBalance }));
})();
