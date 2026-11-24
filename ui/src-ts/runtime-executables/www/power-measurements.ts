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

    Reflect.set(window, 'NexoWattPowerMeasurements', Object.freeze({ resolveEvcsPower, validatePowerReference }));
})();
