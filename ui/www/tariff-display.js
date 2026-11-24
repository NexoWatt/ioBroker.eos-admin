/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/www/tariff-display.ts
 * Quell-Hash: sha256:452005ed20fb9bbb6e0c73b4175e857fd34a9a3412714a5da8d049878ad80fb6
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für www/tariff-display.js.
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
 * Aufgabe: Stellt echte Tarifintervalle und bestätigte Preise im Dashboard dar.
 * Daten und Wirkung: Liest nur öffentliche Preisstates und Quellmetadaten; die
 * Anzeige aktiviert keine Tarifoptimierung. EUR-Quellen werden nicht anhand
 * der Preisgröße in Cent umgedeutet. Null, boolesche und veraltete Werte fehlen.
 * Bei Änderungen: Viertelstunden, Sommerzeit, Null-/Negativpreise, Einheiten,
 * nicht verfügbare Quellen und abgeschaltete Optimierung getrennt prüfen.
 */
(() => {
    const rec = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const own = (value, key) => Object.hasOwn(value, key) ? Reflect.get(value, key) : undefined;
    function finite(value) {
        if (typeof value !== 'number' && typeof value !== 'string')
            return null;
        if (typeof value === 'string') {
            const text = value.trim();
            if (!text || text.length > 64 || [...text].some(character => !'0123456789eE+-.'.includes(character)))
                return null;
        }
        const result = Number(value);
        return Number.isFinite(result) ? result : null;
    }
    function euro(value, unit = 'auto') {
        const number = finite(value);
        if (number === null)
            return null;
        const label = typeof unit === 'string' ? unit.toLowerCase().replace(/\s/g, '') : 'auto';
        if (['eur', '€', 'eur/kwh', '€/kwh'].includes(label))
            return number;
        if (['ct', 'cent', 'ct/kwh', 'cent/kwh'].includes(label))
            return number / 100;
        if (['eur/mwh', '€/mwh'].includes(label))
            return number / 1000;
        if (label && label !== 'auto')
            return null;
        // Nur untypisierte Alt-Zuordnungen behalten ihre bisherige Einheitenkonvention.
        return Math.abs(number) >= 10 ? number / 100 : number;
    }
    function format(value) { const number = finite(value); return number === null ? '--' : `${number.toFixed(3)} €/kWh`; }
    function decoded(value) {
        if (typeof value !== 'string')
            return value;
        if (value.length > 2000000)
            return null;
        try {
            return JSON.parse(value);
        }
        catch {
            return null;
        }
    }
    function time(value) {
        if (typeof value === 'number' && Number.isFinite(value))
            return value < 1e12 ? value * 1000 : value;
        if (typeof value === 'string') {
            const result = Date.parse(value);
            return Number.isFinite(result) ? result : null;
        }
        return null;
    }
    function parseCurve(raw) {
        const decodedRows = decoded(raw);
        const wrapper = rec(decodedRows);
        const rows = Array.isArray(decodedRows) ? decodedRows : wrapper.prices ?? wrapper.data ?? wrapper.items ?? wrapper.values;
        if (!Array.isArray(rows) || rows.length > 1000)
            return [];
        const pending = [];
        for (const input of rows) {
            const row = rec(input);
            const nested = rec(row.price);
            const price = row.total ?? nested.total ?? nested.value ?? row.price ?? row.value ?? row.marketprice ?? row.marketPrice ?? row.energyPrice;
            // Tibber und der normalisierte EOS-Vertrag geben total in EUR/kWh aus.
            const unit = row.unit ?? row.currency ?? (row.total !== undefined && row.startsAt !== undefined ? 'EUR/kWh' : 'auto');
            const priceEurKwh = euro(price, unit);
            const startMs = time(row.startsAt ?? row.start ?? row.startTime ?? row.from ?? row.begin ?? row.timestamp ?? row.time);
            const endMs = time(row.endsAt ?? row.end ?? row.endTime ?? row.to ?? row.until);
            if (priceEurKwh === null || startMs === null)
                continue;
            pending.push({ startMs, endMs: endMs !== null && endMs > startMs ? endMs : null, priceEurKwh });
        }
        pending.sort((a, b) => a.startMs - b.startMs);
        return pending.map((row, index) => {
            const next = pending.at(index + 1);
            const previous = pending.at(index - 1);
            const observed = next ? next.startMs - row.startMs : previous ? row.startMs - previous.startMs : 3600000;
            const inferredDuration = observed > 0 && observed <= 3600000 ? observed : 3600000;
            return { ...row, endMs: row.endMs ?? row.startMs + inferredDuration };
        });
    }
    function dayRange(now) {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        return { startMs: start.getTime(), endMs: end.getTime() };
    }
    function resolution(curve) {
        if (!curve.length)
            return '';
        const durations = new Set(curve.map(row => row.endMs - row.startMs));
        if (durations.size !== 1)
            return 'Originalintervalle';
        const minutes = (curve[0]?.endMs ?? 0) - (curve[0]?.startMs ?? 0);
        return minutes > 0 && minutes % 60000 === 0 ? `${minutes / 60000}-Minuten-Preise` : 'Originalintervalle';
    }
    function display(snapshot, metadata, now = Date.now(), connected = true) {
        if (!connected)
            return { current: null, average: null, status: 'Verbindung unterbrochen – Preis nicht bestätigt' };
        const states = rec(snapshot), info = rec(metadata);
        const entry = (key) => rec(own(states, key));
        const value = (key) => entry(key).value;
        const fresh = (row, maxAge) => {
            const timestamp = finite(row.ts);
            return timestamp !== null && timestamp <= now + 5000 && now - timestamp <= maxAge;
        };
        const provider = rec(decoded(value('tariffProvider.statusJson')));
        const providerFresh = provider.fresh === true && fresh({ ts: provider.ts }, 30000);
        function price(average) {
            const source = average ? info.averageSource : info.currentSource;
            if (source === 'none')
                return null;
            if (source === 'provider')
                return providerFresh ? euro(average ? provider.averagePriceEurPerKwh : provider.currentPriceEurPerKwh, 'EUR/kWh') : null;
            if (value('tarif.currentPriceFresh') === false)
                return null;
            const key = average ? 'priceAverage' : 'priceCurrent';
            const mapped = entry(key);
            const unit = average ? info.averageUnit : info.currentUnit;
            if (fresh(mapped, average ? 86400000 : 5400000))
                return euro(mapped.value, unit ?? 'auto');
            const canonical = entry(average ? 'tarif.preisDurchschnittEurProKwh' : 'tarif.preisAktuellEurProKwh');
            return value('tarif.currentPriceFresh') === true && fresh(canonical, average ? 86400000 : 5400000) ? euro(canonical.value, 'EUR/kWh') : null;
        }
        const current = price(false), average = price(true);
        return { current, average, status: current === null ? 'Aktuell kein bestätigter Preis verfügbar' : 'Preis verfügbar; Optimierung separat einstellbar' };
    }
    Reflect.set(window, 'NexoWattTariffDisplay', Object.freeze({ euro, format, parseCurve, dayRange, resolution, display }));
})();
