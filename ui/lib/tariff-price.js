/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/tariff-price.ts
 * Quell-Hash: sha256:f63d79cc09008466c3c249f46ded3d5bc5fbe5cde028b5cba255f8d0297af485
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/tariff-price.js.
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
exports.tariffPriceNumber = tariffPriceNumber;
exports.tariffPriceUnit = tariffPriceUnit;
exports.normalizeTariffPrice = normalizeTariffPrice;
exports.readTariffPriceState = readTariffPriceState;
exports.tariffDisplayConfig = tariffDisplayConfig;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Unterscheidet echte Tarifpreise einschließlich 0 und negativer Preise
 * von fehlenden Werten, Statusflags und ungültigen Zahlen.
 * Daten und Wirkung: Liest ausschließlich numerische Preisproben. Keine Umrechnung,
 * Betriebsfreigabe, Konfigurationsänderung oder automatische Preisannahme.
 * Zusammenhang: Wallet und der gezielte Tarifpreis-Leser im Core-Budget verwenden
 * denselben Vertrag; andere Messgrößen und ihre bisherigen Leser bleiben unverändert.
 * Bei Änderungen: null/leer/boolean, echte 0, negative Preise und IO-Fehler prüfen.
 */
function tariffPriceNumber(value) {
    if (typeof value !== 'number' && typeof value !== 'string')
        return null;
    if (typeof value === 'string' && value.trim() === '')
        return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}
/** Nur explizite Preis-Einheiten; ohne Vertrag bleibt der bisherige Auto-Pfad. */
function tariffPriceUnit(value) {
    const unit = typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, '') : '';
    if (unit === 'eur/kwh' || unit === '€/kwh')
        return 'EUR/kWh';
    if (unit === 'ct/kwh' || unit === 'cent/kwh' || unit === 'cents/kwh')
        return 'ct/kWh';
    if (unit === 'eur/mwh' || unit === '€/mwh')
        return 'EUR/MWh';
    return 'auto';
}
/** Bekannte Einheiten deterministisch umrechnen; EUR nicht erneut nach Größe deuten. */
function normalizeTariffPrice(value, unit) {
    let price = tariffPriceNumber(value);
    if (price === null)
        return null;
    if (unit === 'ct/kWh')
        price /= 100;
    else if (unit === 'EUR/MWh')
        price /= 1000;
    else if (unit === 'auto' && Math.abs(price) > 2 && Math.abs(price) <= 500)
        price /= 100;
    // Gleiche Grenze wie die geprüfte Provider-Normalisierung. Legacy-Auto bleibt ±2.
    const limit = unit === 'auto' ? 2 : 100;
    return Number.isFinite(price) && Math.abs(price) <= limit ? price : null;
}
async function readTariffPriceState(adapter, id) {
    try {
        const state = await adapter.getStateAsync(id);
        if (state === null || typeof state !== 'object' || Array.isArray(state))
            return null;
        const quality = Reflect.get(state, 'q');
        if (quality !== undefined && quality !== 0)
            return null;
        const value = Reflect.get(state, 'val');
        return tariffPriceNumber(value);
    }
    catch {
        return null;
    }
}
/** Public source/unit metadata carries no object paths, endpoints or credentials. */
function tariffDisplayConfig(value, namespace) {
    const rec = (item) => item !== null && typeof item === 'object' && !Array.isArray(item) ? item : {};
    const root = rec(value);
    const points = rec(root.datapoints);
    const legacy = rec(root.vis);
    const units = rec(root.units);
    const source = (id, fallback, suffix) => {
        const selected = typeof id === 'string' && id.trim() ? id.trim() : typeof fallback === 'string' ? fallback.trim() : '';
        return selected === `${namespace}.tariffProvider.${suffix}` ? 'provider' : selected ? 'mapped' : 'none';
    };
    const currentSource = source(points.priceCurrent, legacy.priceCurrentId, 'currentPriceEurPerKwh');
    const averageSource = source(points.priceAverage, legacy.priceAverageId, 'averagePriceEurPerKwh');
    const unit = (raw, src) => {
        if (src === 'provider')
            return 'EUR/kWh';
        const clean = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
        if (['eur/kwh', '€/kwh'].includes(clean))
            return 'EUR/kWh';
        if (['ct/kwh', 'cent/kwh', 'cents/kwh'].includes(clean))
            return 'ct/kWh';
        if (['eur/mwh', '€/mwh'].includes(clean))
            return 'EUR/MWh';
        return 'auto';
    };
    return { currentSource, averageSource, currentUnit: unit(units.priceCurrent, currentSource), averageUnit: unit(units.priceAverage, averageSource) };
}
