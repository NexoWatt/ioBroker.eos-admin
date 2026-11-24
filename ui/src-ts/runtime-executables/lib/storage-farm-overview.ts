/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Bildet eine gemeinsame, lesende Farmübersicht aus frischen Messproben
 * und der bekannten Nennkapazität ihrer aktiv konfigurierten Mitglieder.
 * Daten und Wirkung: Unvollständige Leistungssummen bleiben null; gültige SoCs
 * liefern einen ausdrücklich als Teilmittel gekennzeichneten arithmetischen Mittelwert.
 * Zusammenhang: main.ts liefert bereits normalisierte, frisch geprüfte Proben.
 * Diese Anzeige ändert weder alte Regler-SoCs noch Limits, Freigaben oder Sollwerte.
 * Bei Änderungen: Gegenläufige Batterieflüsse, Offline-Mitglieder, fehlende
 * Kapazitäten, doppelte Quellen und echte Nullwerte getrennt prüfen.
 */

type Sample = number | null;
export interface FarmOverviewMember {
    key: string;
    fresh: boolean;
    batteryPowerW: Sample;
    socPct: Sample;
    capacityKWh: Sample;
}
export interface FarmOverviewPvSource { key: string; powerW: Sample; }
interface Coverage { valid: number; total: number; complete: boolean; }
export interface FarmOverview {
    v: 1;
    updatedAt: number;
    members: { total: number; fresh: number };
    battery: Coverage & { netW: Sample; chargeW: Sample; dischargeW: Sample };
    soc: Coverage & { meanPct: Sample };
    capacity: Coverage & { totalKWh: Sample; knownKWh: Sample };
    pv: Coverage & { powerW: Sample };
}
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function rounded(value: number, digits = 0): number {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}
function coverage(valid: number, total: number): Coverage { return { valid, total, complete: total > 0 && valid === total }; }
/** Conflicting duplicate member readings invalidate that metric instead of silently picking one. */
function commonSample(a: Sample, b: Sample): Sample { return a === b ? a : null; }
export function buildFarmOverview(members: readonly FarmOverviewMember[], sources: readonly FarmOverviewPvSource[], updatedAt: number): FarmOverview {
    const unique = new Map<string, FarmOverviewMember>();
    for (const row of members) {
        const normalized = {
            key: row.key,
            fresh: row.fresh === true,
            batteryPowerW: row.fresh && finite(row.batteryPowerW) ? row.batteryPowerW : null,
            socPct: finite(row.socPct) && row.socPct >= 0 && row.socPct <= 100 ? row.socPct : null,
            capacityKWh: finite(row.capacityKWh) && row.capacityKWh > 0 ? row.capacityKWh : null,
        };
        const previous = unique.get(row.key);
        unique.set(row.key, previous ? {
            key: row.key, fresh: previous.fresh && normalized.fresh,
            batteryPowerW: commonSample(previous.batteryPowerW, normalized.batteryPowerW),
            socPct: commonSample(previous.socPct, normalized.socPct),
            capacityKWh: commonSample(previous.capacityKWh, normalized.capacityKWh),
        } : normalized);
    }
    let fresh = 0; let batteryValid = 0; let socValid = 0; let capacityValid = 0;
    let net = 0; let charge = 0; let discharge = 0; let soc = 0; let capacity = 0;
    for (const row of unique.values()) {
        if (row.fresh) fresh++;
        if (row.batteryPowerW !== null) {
            batteryValid++; net += row.batteryPowerW;
            charge += Math.max(0, -row.batteryPowerW); discharge += Math.max(0, row.batteryPowerW);
        }
        if (row.socPct !== null) { socValid++; soc += row.socPct; }
        if (row.capacityKWh !== null) { capacityValid++; capacity += row.capacityKWh; }
    }
    const pvSources = new Map<string, Sample>();
    for (const row of sources) {
        const value = finite(row.powerW) && row.powerW >= 0 ? row.powerW : null;
        const previous = pvSources.get(row.key);
        pvSources.set(row.key, previous === undefined ? value : commonSample(previous, value));
    }
    let pvValid = 0; let pv = 0;
    for (const value of pvSources.values()) if (value !== null) { pvValid++; pv += value; }
    const batteryCoverage = coverage(batteryValid, unique.size);
    const capacityCoverage = coverage(capacityValid, unique.size);
    const pvCoverage = coverage(pvValid, pvSources.size);
    return {
        v: 1, updatedAt, members: { total: unique.size, fresh },
        battery: { ...batteryCoverage, netW: batteryCoverage.complete ? rounded(net) : null,
            chargeW: batteryCoverage.complete ? rounded(charge) : null, dischargeW: batteryCoverage.complete ? rounded(discharge) : null },
        soc: { ...coverage(socValid, unique.size), meanPct: socValid > 0 ? rounded(soc / socValid, 1) : null },
        capacity: { ...capacityCoverage, totalKWh: capacityCoverage.complete ? rounded(capacity, 3) : null,
            knownKWh: capacityValid > 0 ? rounded(capacity, 3) : null },
        pv: { ...pvCoverage, powerW: pvCoverage.complete ? rounded(pv) : null },
    };
}
