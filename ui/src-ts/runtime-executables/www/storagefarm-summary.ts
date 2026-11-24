/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Zeigt die atomare Speicherfarm-Gesamtübersicht in der Kundenansicht.
 * Daten und Wirkung: Liest ausschließlich storageFarm.overviewJson. Berechnet
 * keine Regelwerte; Vollsummen erscheinen nur bei bestätigter Messabdeckung.
 * SoC ist ausdrücklich ein arithmetischer Mittelwert, keine Energiegewichtung.
 * Bei Änderungen: Nullwerte, Teilabdeckung, Alterung und Verbindungsverlust testen.
 */
(() => {
    type Data = Record<string, unknown>;
    interface Coverage { valid: number; total: number; complete: boolean }
    interface Overview {
        updatedAt: number; members: { total: number; fresh: number };
        battery: Coverage & { netW: number | null; chargeW: number | null; dischargeW: number | null };
        soc: Coverage & { meanPct: number | null };
        capacity: Coverage & { totalKWh: number | null; knownKWh: number | null };
        pv: Coverage & { powerW: number | null };
    }
    type Quality = 'complete' | 'partial' | 'missing' | 'stale';
    const staleAfterMs = 30000;
    const isRecord = (value: unknown): value is Data => !!value && typeof value === 'object' && !Array.isArray(value);
    const own = (value: Data, key: string): unknown => Object.hasOwn(value, key) ? Reflect.get(value, key) : undefined;
    const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
    function count(value: unknown): number {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 128) throw new Error('FARM_COUNT_INVALID');
        return value;
    }
    function coverage(value: unknown): Coverage & Data {
        if (!isRecord(value)) throw new Error('FARM_COVERAGE_INVALID');
        const valid = count(value.valid), total = count(value.total);
        if (valid > total || typeof value.complete !== 'boolean') throw new Error('FARM_COVERAGE_INVALID');
        return { ...value, valid, total, complete: value.complete && valid === total && total > 0 };
    }
    function decode(snapshot: unknown): Overview | null {
        try {
            if (!isRecord(snapshot)) return null;
            const entry = own(snapshot, 'storageFarm.overviewJson');
            if (!isRecord(entry)) return null;
            const raw: unknown = entry.value;
            if (typeof raw !== 'string' || raw.length > 16384) return null;
            const data: unknown = JSON.parse(raw);
            if (!isRecord(data) || data.v !== 1 || !isRecord(data.members)) return null;
            const updatedAt = finite(data.updatedAt);
            if (updatedAt === null || updatedAt <= 0) return null;
            const total = count(data.members.total), fresh = count(data.members.fresh);
            if (fresh > total) return null;
            const battery = coverage(data.battery), soc = coverage(data.soc), capacity = coverage(data.capacity), pv = coverage(data.pv);
            if (battery.total !== total || soc.total !== total || capacity.total !== total) return null;
            const socValue = finite(soc.meanPct);
            return { updatedAt, members: { total, fresh },
                battery: { ...battery, netW: finite(battery.netW), chargeW: finite(battery.chargeW), dischargeW: finite(battery.dischargeW) },
                soc: { ...soc, meanPct: socValue !== null && socValue >= 0 && socValue <= 100 ? socValue : null },
                capacity: { ...capacity, totalKWh: finite(capacity.totalKWh), knownKWh: finite(capacity.knownKWh) },
                pv: { ...pv, powerW: finite(pv.powerW) } };
        } catch { return null; }
    }
    function format(value: number, unit: string): string {
        return value.toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' ' + unit;
    }
    function power(value: number | null): string {
        if (value === null) return '—';
        if (Math.abs(value) >= 1000000) return format(value / 1000000, 'MW');
        if (Math.abs(value) >= 1000) return format(value / 1000, 'kW');
        return format(Math.round(value), 'W');
    }
    function text(id: string, value: string): void { const element = document.getElementById(id); if (element) element.textContent = value; }
    function card(key: string, label: string, value: string, detail: string, quality: Quality): void {
        text(`sf_${key}_label`, label); text(`sf_${key}_value`, value); text(`sf_${key}_detail`, detail);
        const element = document.getElementById(`sf_metric_${key}`); if (element) element.dataset.quality = quality;
    }
    function render(snapshot: unknown, connected: boolean, now = Date.now()): void {
        const data = decode(snapshot);
        const current = !!data && connected && now - data.updatedAt <= staleAfterMs && data.updatedAt <= now + 5000;
        const unavailable = !data ? 'Noch keine bestätigte Gesamtübersicht' : !connected ? 'Verbindung unterbrochen' : 'Messübersicht veraltet';
        const quality: Quality = !data ? 'missing' : 'stale';
        const members = data ? data.members.total : null;
        text('sf_members', members === null ? '— / — aktuell' : `${current ? data?.members.fresh ?? 0 : 0} / ${members} aktuell`);
        const fullBattery = current && data?.battery.complete === true && data.battery.netW !== null && data.battery.chargeW !== null && data.battery.chargeW >= 0 && data.battery.dischargeW !== null && data.battery.dischargeW >= 0;
        const batteryDetail = data ? `${current ? data.battery.valid : 0} / ${data.battery.total} aktuelle Batteriemessungen` : unavailable;
        const net = fullBattery ? data.battery.netW : null;
        const netText = net === null ? '—' : net > 0 ? `Entladen ${power(net)}` : net < 0 ? `Laden ${power(-net)}` : power(0);
        const batteryQuality: Quality = !current ? quality : fullBattery ? 'complete' : 'partial';
        const detail = !current ? unavailable : fullBattery ? batteryDetail : `${batteryDetail} · keine vollständige Summe`;
        card('net', 'Batterieleistung netto', netText, detail, batteryQuality);
        card('charge', 'Ladeleistung gesamt', power(fullBattery ? data.battery.chargeW : null), detail, batteryQuality);
        card('discharge', 'Entladeleistung gesamt', power(fullBattery ? data.battery.dischargeW : null), detail, batteryQuality);
        const hasSoc = current && data !== null && data.soc.valid > 0 && data.soc.meanPct !== null;
        card('soc', hasSoc && !data.soc.complete ? 'Ø Ladezustand · Teilmittel' : 'Ø Ladezustand', hasSoc ? format(data.soc.meanPct!, '%') : '—',
            !current ? unavailable : `${data?.soc.valid ?? 0} / ${data?.soc.total ?? 0} aktuelle SoC-Werte · arithmetisch, nicht kapazitätsgewichtet`,
            !current ? quality : data?.soc.complete && hasSoc ? 'complete' : hasSoc ? 'partial' : 'missing');
        const capacity = data?.capacity;
        const capacityValue = capacity?.complete ? capacity.totalKWh : capacity?.knownKWh;
        const hasCapacity = capacityValue !== null && capacityValue !== undefined && capacityValue > 0;
        card('capacity', capacity?.complete ? 'Gesamtkapazität' : 'Bekannte Kapazität', hasCapacity ? format(capacityValue, 'kWh') : '—',
            capacity ? `${capacity.valid} / ${capacity.total} Kapazitäten hinterlegt${current ? '' : ' · zuletzt bestätigte Konfiguration'}` : unavailable,
            !hasCapacity ? 'missing' : capacity?.complete ? 'complete' : 'partial');
        const fullPv = current && data?.pv.complete === true && data.pv.powerW !== null && data.pv.powerW >= 0;
        card('pv', 'PV-Leistung gesamt', power(fullPv ? data.pv.powerW : null),
            !current ? unavailable : data?.pv.total === 0 ? 'Keine PV-Quelle zugeordnet' : `${data?.pv.valid ?? 0} / ${data?.pv.total ?? 0} eindeutige PV-Quellen aktuell${fullPv ? '' : ' · keine vollständige Summe'}`,
            !current ? quality : fullPv ? 'complete' : data?.pv.total ? 'partial' : 'missing');
        const partial = current && data && (!data.battery.complete || !data.soc.complete || !data.capacity.complete || data.pv.total > 0 && !data.pv.complete);
        text('sf_summary', !current ? unavailable : `${data?.members.fresh ?? 0} von ${members ?? 0} Mitgliedern aktuell${partial ? ' · Teilübersicht' : ''}`);
        text('sf_aggregate_hint', !current ? `${unavailable}. Leistungs- und SoC-Werte werden nicht als aktuell ausgegeben.`
            : partial ? 'Nicht alle Werte liegen vollständig vor. Teilsummen und Teilmittel sind ausdrücklich markiert; vollständige Leistungswerte bleiben bis zur Messabdeckung offen.'
                : 'Aktuelle Gesamtübersicht. Batterieleistung und PV-Erzeugung werden getrennt gezeigt; Ø SoC ist ein arithmetischer Mittelwert.');
    }
    const target = window as unknown as { NWStorageFarmSummary?: { render: typeof render } };
    target.NWStorageFarmSummary = Object.freeze({ render });
})();
