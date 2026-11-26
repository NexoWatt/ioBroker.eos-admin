/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Validiert ausschließlich sichtbare LIVE-Messwerte und Betriebsstatus.
 * Daten und Wirkung: Liest lokale Snapshot-Werte ohne API-/Schreibwirkung. Fehlend,
 * veraltet und offline bleiben unbekannt; die echte Zahl 0 bleibt eine Messung.
 * Bei Änderungen: Null, konstant bestätigte Werte, Zukunftszeit und Ausfälle prüfen.
 */
(() => {
    type RecordValue = Record<string, unknown>;
    type FarmView = { charge: number | null; discharge: number | null; soc: number | null };
    const record = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
    function entry(snapshot: unknown, key: string): RecordValue | null {
        if (!record(snapshot) || !Object.hasOwn(snapshot, key)) return null;
        const value: unknown = Reflect.get(snapshot, key);
        return record(value) ? value : null;
    }
    function number(value: unknown): number | null {
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        if (typeof value !== 'string' || value.length > 64 || !value.trim()) return null;
        const text = value.trim().replace(',', '.');
        // Begrenzte lineare Dezimalprüfung ohne Regex-Backtracking, Exponent oder Hex.
        let digits = 0, separators = 0;
        for (let index = 0; index < text.length; index++) {
            const char = text.charAt(index);
            if (index === 0 && (char === '+' || char === '-')) continue;
            if (char >= '0' && char <= '9') { digits++; continue; }
            if (char === '.' && separators === 0) { separators++; continue; }
            return null;
        }
        if (digits === 0) return null;
        const parsed = Number(text);
        return Number.isFinite(parsed) ? parsed : null;
    }
    function current(row: RecordValue | null, now: number, maxAge: number, online: boolean): boolean {
        const ts = row ? number(row.ts) : null;
        const quality = row?.q;
        return online && (quality === undefined || quality === 0) && ts !== null && ts > 0 && ts <= now + 5000 && now - ts <= maxAge;
    }
    function read(snapshot: unknown, key: string, now: number, maxAge: number, online: boolean): number | null {
        const row = entry(snapshot, key);
        return current(row, now, maxAge, online) ? number(row?.value) : null;
    }
    function buildingQuality(snapshot: unknown, now: number, maxAge: number, online: boolean, mapped?: (key: string) => boolean): string | null {
        const row = entry(snapshot, 'derived.core.building.quality');
        const value = row?.value;
        if (!online) return 'connection-lost';
        const freshQuality = current(row, now, maxAge, true) && typeof value === 'string' ? value : null;
        if (freshQuality === 'invalid-balance') return freshQuality;
        if (freshQuality?.startsWith('missing-')) {
            const channels: Record<string, string[]> = {
                'missing-grid': ['gridPointPower','gridBuyPower','gridSellPower'],
                'missing-pv': ['pvPower','productionTotal'],
                'missing-storage': ['batteryPower','storageChargePower','storageDischargePower'],
                'missing-producer': ['producer1Power','producer2Power','producer3Power','producer4Power','producer5Power'],
            };
            const expired = channels[freshQuality]?.some(key => {
                if (!mapped?.(key)) return false;
                const sample = entry(snapshot, key);
                const stamp = sample ? number(sample.ts) : null;
                return stamp !== null && stamp > 0 && now - stamp > maxAge && number(sample?.value) !== null
                    && (sample?.q === undefined || sample.q === 0);
            });
            return expired ? freshQuality.replace('missing-', 'expired-') : freshQuality;
        }
        const load = entry(snapshot, 'derived.core.building.loadTotalW') || entry(snapshot, 'consumptionTotal');
        const ts = load ? number(load.ts) : null;
        if (ts !== null && ts > now + 5000) return 'future-load';
        if (ts !== null && ts > 0 && now - ts > maxAge) return 'expired-load';
        return freshQuality;
    }
    function farm(snapshot: unknown, now: number, online: boolean): FarmView | null {
        const row = entry(snapshot, 'storageFarm.overviewJson');
        if (!row) return null; // Legacy snapshots have no atomic overview.
        const missing: FarmView = { charge: null, discharge: null, soc: null };
        if (!current(row, now, 30000, online) || typeof row.value !== 'string' || row.value.length > 16384) return missing;
        try {
            const parsed: unknown = JSON.parse(row.value);
            if (!record(parsed) || parsed.v !== 1 || !record(parsed.members) || !record(parsed.battery) || !record(parsed.soc)) return missing;
            const updatedAt = number(parsed.updatedAt), total = number(parsed.members.total);
            if (updatedAt === null || updatedAt <= 0 || updatedAt > now + 5000 || now - updatedAt > 30000 || total === null || !Number.isInteger(total) || total <= 0 || total > 128) return missing;
            const battery = parsed.battery, soc = parsed.soc;
            const complete = battery.complete === true && battery.valid === total && battery.total === total;
            const charge = number(battery.chargeW), discharge = number(battery.dischargeW), mean = number(soc.meanPct);
            const socComplete = soc.complete === true && soc.valid === total && soc.total === total;
            return { charge: complete && charge !== null && charge >= 0 ? charge : null,
                discharge: complete && discharge !== null && discharge >= 0 ? discharge : null,
                soc: socComplete && mean !== null && mean >= 0 && mean <= 100 ? mean : null };
        } catch { return missing; }
    }
    type Health = {
        ems: string; grid: string; summary: string;
        phase: 'offline' | 'stopped' | 'grid-unavailable' | 'unknown' | 'healthy';
    };
    type ChargingStatus = { overallLevel: string; systemText: string; globalSafety: boolean; total: number };
    const processIds = ['ui', 'ems', 'devices', 'eebus', 'backup', 'ocpp'] as const;
    type ProcessId = typeof processIds[number];
    type ProcessHealth = { state: 'ok' | 'fault' | 'unknown'; failed: ProcessId[]; paused: ProcessId[]; waiting: ProcessId[] };
    type Headline = { text: string; level: 'ok' | 'info' | 'warn' | 'error'; processIds?: ProcessId[]; deviceNames?: string[]; totalOffline?: number };
    // Older snapshots omit ack. An explicit unconfirmed value cannot establish operational health.
    function confirmed(row: RecordValue | null, now: number, maxAge: number): boolean {
        return current(row, now, maxAge, true) && (row?.ack === undefined || row.ack === true);
    }
    function status(snapshot: unknown, online: boolean, now: number, gridMaxAge = 30000): Health {
        if (!online) return { ems: 'Verbindung unterbrochen', grid: 'Messstatus unbekannt', summary: 'Verbindung unterbrochen', phase: 'offline' };
        const alive = entry(snapshot, 'ems.core.schedulerAlive');
        const beat = entry(snapshot, 'ems.core.schedulerHeartbeatAt');
        const heartbeat = confirmed(beat, now, 30000) ? number(beat?.value) : null;
        const aliveKnown = confirmed(alive, now, 30000);
        const running = aliveKnown && alive?.value === true && heartbeat !== null && heartbeat > 0 && heartbeat <= now + 5000 && now - heartbeat <= 30000;
        const stopped = aliveKnown && alive?.value === false;
        const nvp = entry(snapshot, 'ems.gridMeasurementFresh');
        const gridKnown = confirmed(nvp, now, 30000) && typeof nvp?.value === 'boolean';
        const gridFresh = gridKnown && nvp?.value === true;
        const grid = entry(snapshot, 'derived.core.grid.netW');
        const legacyGrid = record(snapshot) && !Object.hasOwn(snapshot, 'ems.gridMeasurementFresh');
        const gridObserved = legacyGrid && confirmed(grid, now, gridMaxAge) && number(grid?.value) !== null;
        const phase: Health['phase'] = stopped ? 'stopped' : gridKnown && !gridFresh ? 'grid-unavailable'
            : running && gridFresh ? 'healthy' : 'unknown';
        return { ems: running ? 'Aktiv' : stopped ? 'Gestoppt' : 'Status unbekannt',
            grid: gridFresh || gridObserved ? 'Messung aktuell' : gridKnown ? 'Messung fehlt / veraltet' : 'Messstatus unbekannt',
            summary: running && gridFresh ? 'EMS aktiv · NVP-Messung aktuell' : stopped ? 'EMS gestoppt' : 'Betriebsstatus prüfen', phase };
    }

    function validIds(value: unknown): value is ProcessId[] {
        return Array.isArray(value) && value.length <= processIds.length &&
            value.every(id => typeof id === 'string' && processIds.some(allowed => allowed === id)) &&
            new Set<unknown>(value).size === value.length;
    }
    function processHealth(snapshot: unknown, now: number): ProcessHealth | null {
        if (!record(snapshot)) return null;
        const { observedAt, state, failed, paused } = snapshot;
        if (typeof observedAt !== 'number' || !Number.isSafeInteger(observedAt) || observedAt <= 0 ||
            !Number.isFinite(now) || observedAt > now + 5000 || now - observedAt > 30000) return null;
        if (state !== 'ok' && state !== 'fault' && state !== 'unknown') return null;
        const waiting = snapshot.waiting === undefined ? [] : snapshot.waiting;
        if (!validIds(failed) || !validIds(paused) || !validIds(waiting) || failed.some(id => paused.includes(id)) ||
            waiting.some(id => failed.includes(id) || paused.includes(id)) || (state === 'ok' && waiting.length) ||
            (state === 'fault') !== (failed.length > 0)) return null;
        return { state, failed: processIds.filter(id => failed.includes(id)), paused, waiting };
    }

    // Only the dashboard renderer commits this decision. Charging details keep their own summary.
    function operatingStatus(health: Health | null | undefined, connection: string | undefined,
        chargeModel: ChargingStatus | null | undefined, safetyStop: boolean, p14Fallback: boolean,
        processes: ProcessHealth | null): Headline {
        const offline = connection === 'disconnected' || health?.phase === 'offline';
        const safety = safetyStop || chargeModel?.globalSafety;
        if (processes?.state === 'fault') {
            const text = offline ? 'Live-Verbindung unterbrochen · Prozess gestört: {names}'
                : safety ? 'Sicherheitsstopp aktiv · Prozess gestört: {names}' : 'Prozess gestört · {names}';
            return { text, level: 'error', processIds: processes.failed };
        }
        if (connection === 'disconnected') return { text: 'Verbindung unterbrochen', level: 'error' };
        if (connection !== 'ready' && connection !== 'snapshot') return { text: 'Verbinde…', level: 'warn' };
        if (offline) return { text: 'Verbindung unterbrochen', level: 'error' };
        if (safety) return { text: 'Sicherheitsstopp aktiv', level: 'error' };
        const emsPaused = processes?.paused.includes('ems') === true;
        const emsWaiting = processes?.waiting.includes('ems') === true;
        if (!emsPaused && !emsWaiting && health?.phase === 'stopped') return { text: 'EMS gestoppt', level: 'error' };
        if (chargeModel && chargeModel.total > 0 && chargeModel.overallLevel === 'error') {
            return { text: chargeModel.systemText, level: 'error' };
        }
        if (!emsPaused && !emsWaiting && health?.phase === 'grid-unavailable') return { text: 'Netzmessung fehlt oder ist veraltet', level: 'warn' };
        if (processes?.waiting.length) return { text: 'Wartet auf Übernahme · {names}', level: 'warn', processIds: processes.waiting };
        if (!emsPaused && health?.phase !== 'healthy') return { text: 'Betriebsstatus prüfen', level: 'warn' };
        if (p14Fallback) return { text: '§14a-Kommunikationsfallback aktiv', level: 'warn' };
        if (chargeModel && chargeModel.total > 0 && chargeModel.overallLevel === 'warn') {
            return { text: chargeModel.systemText, level: 'warn' };
        }
        if (processes?.state !== 'ok') return { text: 'Prozessstatus unbekannt', level: 'warn' };
        if (emsPaused) return { text: 'EMS pausiert', level: 'info' };
        return { text: 'Alle Systeme normal', level: 'ok' };
    }
    function dashboardStatus(health: Health | null | undefined, connection: string | undefined,
        chargeModel: ChargingStatus | null | undefined, safetyStop: boolean, p14Fallback: boolean,
        processSnapshot?: unknown, now = Date.now()): Headline {
        const processes = processHealth(processSnapshot, now);
        const primary = operatingStatus(health, connection, chargeModel, safetyStop, p14Fallback, processes);
        const devices = processes && record(processSnapshot) ? processSnapshot.deviceHealth : null;
        if (record(devices) && devices.state === 'fault' && Array.isArray(devices.offline) &&
            devices.offline.length > 0 && devices.offline.length <= 12 && typeof devices.totalOffline === 'number' &&
            Number.isSafeInteger(devices.totalOffline) && devices.totalOffline >= devices.offline.length && devices.totalOffline <= 10000) {
            const names: string[] = [];
            for (const item of devices.offline) {
                if (!record(item) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 64) break;
                names.push(item.name);
            }
            if (names.length === devices.offline.length) {
                return { ...primary, text: primary.level === 'error' ? primary.text : '',
                    level: 'error', deviceNames: names, totalOffline: devices.totalOffline };
            }
        }
        if (primary.level === 'ok' && !(record(devices) && devices.state === 'ok' &&
            devices.totalOffline === 0 && Array.isArray(devices.offline) && devices.offline.length === 0)) {
            return { text: 'Gerätestatus unbekannt', level: 'warn' };
        }
        return primary;
    }
    const host = window as Window & { NexoWattLiveDisplay?: { read: typeof read; farm: typeof farm; status: typeof status; dashboardStatus: typeof dashboardStatus; buildingQuality: typeof buildingQuality } };
    host.NexoWattLiveDisplay = Object.freeze({ read, farm, status, dashboardStatus, buildingQuality });
})();
