/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: lib/storage-farm-overview.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * lib/storage-farm-overview.js
 *
 * Zusammenhang:
 * Der Spiegel hilft uns, die JS-Datei später schrittweise zu typisieren, zu testen und
 * kontrolliert auf TypeScript umzustellen. Produktive Originalquellen liegen unter
 * src-ts/runtime-executables/ bzw. den im generierten JS genannten TS-Pfaden.
 * Dort ändern, Laufzeit erzeugen und danach die Spiegel synchronisieren.
 * Build-/Prüfskripte ohne TS-Original werden weiterhin unter scripts/ gepflegt.
 *
 * Wichtig für die Migration:
 * - Diese Datei enthält vorübergehend @ts-nocheck.
 * - Der nächste Schritt ist pro Modul echte Typisierung statt pauschalem No-Check.
 * - Fachliche Kommentare markieren die Abschnitte, die später einzeln migriert werden.
 *
 * Original-Hash: 721ea86e1823275b69c2e7c70752460c35440d3a76d8b7e3b132b5735c213c01
 */

/**
 * Code-Teil: Runtime-Spiegel der kompletten Datei
 *
 * Zweck:
 * Dieser Abschnitt enthält den ursprünglichen JavaScript-Code als TypeScript-Parallelkopie.
 * Einzelne Funktionen werden später pro Modul weiter typisiert; Dateien ohne eigene
 * Funktionsdeklarationen bleiben trotzdem über diesen Dateikommentar dokumentiert.
 */

/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/storage-farm-overview.ts
 * Quell-Hash: sha256:986c2eaeb7ce486a4360bbe18dc61a3661f1df228174984453a53e9d6e385804
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/storage-farm-overview.js.
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
 * Aufgabe: Bildet eine gemeinsame, lesende Farmübersicht aus frischen Messproben
 * und der bekannten Nennkapazität ihrer aktiv konfigurierten Mitglieder.
 * Daten und Wirkung: Unvollständige Leistungssummen bleiben null; gültige SoCs
 * liefern einen ausdrücklich als Teilmittel gekennzeichneten arithmetischen Mittelwert.
 * Zusammenhang: main.ts liefert bereits normalisierte, frisch geprüfte Proben.
 * Diese Anzeige ändert weder alte Regler-SoCs noch Limits, Freigaben oder Sollwerte.
 * Bei Änderungen: Gegenläufige Batterieflüsse, Offline-Mitglieder, fehlende
 * Kapazitäten, doppelte Quellen und echte Nullwerte getrennt prüfen.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFarmOverview = buildFarmOverview;
/**
 * Code-Teil: finite
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
/**
 * Code-Teil: rounded
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function rounded(value, digits = 0) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}
/**
 * Code-Teil: coverage
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function coverage(valid, total) { return { valid, total, complete: total > 0 && valid === total }; }
/** Conflicting duplicate member readings invalidate that metric instead of silently picking one. */
function commonSample(a, b) { return a === b ? a : null; }
/**
 * Code-Teil: buildFarmOverview
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function buildFarmOverview(members, sources, updatedAt) {
    const unique = new Map();
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
    let fresh = 0;
    let batteryValid = 0;
    let socValid = 0;
    let capacityValid = 0;
    let net = 0;
    let charge = 0;
    let discharge = 0;
    let soc = 0;
    let capacity = 0;
    for (const row of unique.values()) {
        if (row.fresh)
            fresh++;
        if (row.batteryPowerW !== null) {
            batteryValid++;
            net += row.batteryPowerW;
            charge += Math.max(0, -row.batteryPowerW);
            discharge += Math.max(0, row.batteryPowerW);
        }
        if (row.socPct !== null) {
            socValid++;
            soc += row.socPct;
        }
        if (row.capacityKWh !== null) {
            capacityValid++;
            capacity += row.capacityKWh;
        }
    }
    const pvSources = new Map();
    for (const row of sources) {
        const value = finite(row.powerW) && row.powerW >= 0 ? row.powerW : null;
        const previous = pvSources.get(row.key);
        pvSources.set(row.key, previous === undefined ? value : commonSample(previous, value));
    }
    let pvValid = 0;
    let pv = 0;
    for (const value of pvSources.values())
        if (value !== null) {
            pvValid++;
            pv += value;
        }
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
