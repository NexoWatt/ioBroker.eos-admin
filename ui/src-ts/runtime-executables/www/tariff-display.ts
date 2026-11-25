/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
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
    type Data = Record<string, unknown>;
    interface Segment { startMs: number; endMs: number; priceEurKwh: number }
    const rec = (value: unknown): Data => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
    const own = (value: Data, key: string): unknown => Object.hasOwn(value, key) ? Reflect.get(value, key) : undefined;
    function finite(value: unknown): number | null {
        if (typeof value !== 'number' && typeof value !== 'string') return null;
        if (typeof value === 'string') {
            const text = value.trim();
            if (!text || text.length > 64 || [...text].some(character => !'0123456789eE+-.'.includes(character))) return null;
        }
        const result = Number(value); return Number.isFinite(result) ? result : null;
    }
    function euro(value: unknown, unit: unknown = 'auto'): number | null {
        const number = finite(value); if (number === null) return null;
        const label = typeof unit === 'string' ? unit.toLowerCase().replace(/\s/g, '') : 'auto';
        if (['eur', '€', 'eur/kwh', '€/kwh'].includes(label)) return number;
        if (['ct', 'cent', 'ct/kwh', 'cent/kwh'].includes(label)) return number / 100;
        if (['eur/mwh', '€/mwh'].includes(label)) return number / 1000;
        if (label && label !== 'auto') return null;
        // Nur untypisierte Alt-Zuordnungen behalten ihre bisherige Einheitenkonvention.
        return Math.abs(number) >= 10 ? number / 100 : number;
    }
    function format(value: unknown): string { const number = finite(value); return number === null ? '--' : `${number.toFixed(3)} €/kWh`; }
    function decoded(value: unknown): unknown {
        if (typeof value !== 'string') return value;
        if (value.length > 2000000) return null;
        try { return JSON.parse(value) as unknown; } catch { return null; }
    }
    function time(value: unknown): number | null {
        if (typeof value === 'number' && Number.isFinite(value)) return value < 1e12 ? value * 1000 : value;
        if (typeof value === 'string') { const result = Date.parse(value); return Number.isFinite(result) ? result : null; }
        return null;
    }
    function parseCurve(raw: unknown): Segment[] {
        const decodedRows = decoded(raw); const wrapper = rec(decodedRows);
        const rows = Array.isArray(decodedRows) ? decodedRows : wrapper.prices ?? wrapper.data ?? wrapper.items ?? wrapper.values;
        if (!Array.isArray(rows) || rows.length > 1000) return [];
        const pending: { startMs: number; endMs: number | null; priceEurKwh: number }[] = [];
        for (const input of rows) {
            const row = rec(input); const nested = rec(row.price);
            const price = row.total ?? nested.total ?? nested.value ?? row.price ?? row.value ?? row.marketprice ?? row.marketPrice ?? row.energyPrice;
            // Tibber und der normalisierte EOS-Vertrag geben total in EUR/kWh aus.
            const unit = row.unit ?? row.currency ?? (row.total !== undefined && row.startsAt !== undefined ? 'EUR/kWh' : 'auto');
            const priceEurKwh = euro(price, unit);
            const startMs = time(row.startsAt ?? row.start ?? row.startTime ?? row.from ?? row.begin ?? row.timestamp ?? row.time);
            const endMs = time(row.endsAt ?? row.end ?? row.endTime ?? row.to ?? row.until);
            if (priceEurKwh === null || startMs === null) continue;
            pending.push({ startMs, endMs: endMs !== null && endMs > startMs ? endMs : null, priceEurKwh });
        }
        pending.sort((a, b) => a.startMs - b.startMs);
        return pending.map((row, index) => {
            const next = pending.at(index + 1); const previous = pending.at(index - 1);
            const observed = next ? next.startMs - row.startMs : previous ? row.startMs - previous.startMs : 3600000;
            const inferredDuration = observed > 0 && observed <= 3600000 ? observed : 3600000;
            return { ...row, endMs: row.endMs ?? row.startMs + inferredDuration };
        });
    }
    function dayRange(now: number): { startMs: number; endMs: number } {
        const start = new Date(now); start.setHours(0, 0, 0, 0);
        const end = new Date(start); end.setDate(end.getDate() + 1);
        return { startMs: start.getTime(), endMs: end.getTime() };
    }
    function resolution(curve: Segment[]): string {
        if (!curve.length) return '';
        const durations = new Set(curve.map(row => row.endMs - row.startMs));
        if (durations.size !== 1) return 'Originalintervalle';
        const minutes = (curve[0]?.endMs ?? 0) - (curve[0]?.startMs ?? 0);
        return minutes > 0 && minutes % 60000 === 0 ? `${minutes / 60000}-Minuten-Preise` : 'Originalintervalle';
    }
    function display(snapshot: unknown, metadata: unknown, now: number = Date.now(), connected = true): { current: number | null; average: number | null; status: string } {
        if (!connected) return { current: null, average: null, status: 'Verbindung unterbrochen – Preis nicht bestätigt' };
        const states = rec(snapshot), info = rec(metadata);
        const entry = (key: string): Data => rec(own(states, key));
        const value = (key: string): unknown => entry(key).value;
        const fresh = (row: Data, maxAge: number): boolean => {
            const timestamp = finite(row.ts); return timestamp !== null && timestamp <= now + 5000 && now - timestamp <= maxAge;
        };
        const provider = rec(decoded(value('tariffProvider.statusJson')));
        const providerFresh = provider.fresh === true && fresh({ ts: provider.ts }, 30000);
        function price(average: boolean): number | null {
            const source = average ? info.averageSource : info.currentSource;
            if (source === 'none') return null;
            if (source === 'provider') return providerFresh ? euro(average ? provider.averagePriceEurPerKwh : provider.currentPriceEurPerKwh, 'EUR/kWh') : null;
            if (value('tarif.currentPriceFresh') === false) return null;
            const key = average ? 'priceAverage' : 'priceCurrent';
            const mapped = entry(key); const unit = average ? info.averageUnit : info.currentUnit;
            if (fresh(mapped, average ? 86400000 : 5400000)) return euro(mapped.value, unit ?? 'auto');
            const canonical = entry(average ? 'tarif.preisDurchschnittEurProKwh' : 'tarif.preisAktuellEurProKwh');
            return value('tarif.currentPriceFresh') === true && fresh(canonical, average ? 86400000 : 5400000) ? euro(canonical.value, 'EUR/kWh') : null;
        }
        const current = price(false), average = price(true);
        return { current, average, status: current === null ? 'Aktuell kein bestätigter Preis verfügbar' : 'Preis verfügbar; Optimierung separat einstellbar' };
    }
    function flowStatus(snapshot: unknown, now: number = Date.now(), connected = true): { text: string; title: string } {
        const states = rec(snapshot);
        const entry = (key: string): Data => rec(own(states, key));
        const value = (key: string): unknown => entry(key).value;
        const enabled = (key: string): boolean => value(key) === true || value(key) === 1 || value(key) === 'true';
        const tariffOn = enabled('settings.dynamicTariff'), netFeeOn = enabled('settings.netFeeEnabled');
        if (!tariffOn && !netFeeOn) return { text: '', title: '' };
        const mode = finite(value('settings.tariffMode')) === 2 ? 'Automatik' : 'Manuell';
        const label = tariffOn ? `Tarif ${mode} aktiv` : 'Zeitvariables Netzentgelt aktiv';
        if (!connected) return { text: `${label} – Verbindung unterbrochen; Regelungsstatus nicht bestätigt`, title: '' };
        const validQuality = (row: Data): boolean => row.q === undefined || row.q === 0;
        const recent = (row: Data): boolean => {
            const time = finite(row.ts);
            return validQuality(row) && time !== null && time > 0 && time <= now + 5000 && now - time <= 30000;
        };
        const statusRow = entry('tarif.statusJson');
        const status = rec(decoded(statusRow.value));
        const stamp = finite(status.ts);
        const fresh = stamp !== null && stamp > 0 && stamp <= now + 5000 && now - stamp <= 30000 && recent(statusRow);
        const intent = rec(status.intent), effective = rec(status.effective);
        const text = (input: unknown): string => typeof input === 'string' ? input.trim().slice(0, 1600) : '';
        if (!validQuality(statusRow)) return { text: `${label} – Regelungsstatus nicht bestätigt`, title: '' };
        if (stamp !== null && !fresh) return { text: `${label} – Regelungsstatus veraltet`, title: '' };
        if (fresh && (status.active !== true || intent.snapshotFresh === false)) {
            return { text: `${label} – Regelung noch nicht bestätigt`, title: text(intent.reason) };
        }
        // Der JSON-Snapshot ist der Heartbeat: Ein unveränderter statusText-State
        // behält absichtlich seinen alten Zeitstempel. Nicht allein daran verwerfen.
        let message = fresh ? text(effective.statusText) : '';
        let title = fresh ? text(effective.detailStatusText) : '';
        if (!message && !Object.keys(status).length) {
            const legacy = entry('tarif.statusText');
            if (recent(legacy)) message = text(legacy.value);
        }
        if (!message) return { text: `${label} – warte auf aktuellen Regelungsstatus`, title: '' };
        if (tariffOn && mode === 'Manuell' && !/manuell/i.test(message)) message += ' — Modus: Manuell';
        const reserve = rec(status.pvReserve);
        const legacyReserve = !Object.hasOwn(status, 'pvReserve') && recent(entry('speicher.regelung.tarifPvBlock'));
        const reserveBlocked = Object.hasOwn(status, 'pvReserve')
            ? reserve.fresh === true && reserve.blocked === true
            : legacyReserve && enabled('speicher.regelung.tarifPvBlock');
        if (fresh && reserveBlocked) {
            const capRow = entry('speicher.regelung.tarifPvCapSocPct');
            const cap = Object.hasOwn(status, 'pvReserve') ? finite(reserve.capSocPct)
                : validQuality(capRow) ? finite(capRow.value) : null;
            message += ` — PV-Reserve: Netzladen gesperrt${cap !== null && cap >= 0 && cap <= 100 ? ` (max ${cap.toFixed(1)}%)` : ''}`;
            const reason = text(Object.hasOwn(status, 'pvReserve') ? reserve.reason : value('speicher.regelung.tarifPvBlockGrund'));
            if (reason) title = title ? `${title} | ${reason}` : reason;
        }
        return { text: message, title };
    }
    Reflect.set(window, 'NexoWattTariffDisplay', Object.freeze({ euro, format, parseCurve, dayRange, resolution, display, flowStatus }));
})();
