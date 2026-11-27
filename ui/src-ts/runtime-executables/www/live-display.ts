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
// The same checked observation is used by Node.js notification delivery.
declare const module: { exports: unknown };
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
    type FarmComparison = { v: 1; domain?: 'ess-ac'; targetW: number; measuredW: number; differenceW: number;
        sampledAt: number; commandAt: number; validUntil: number; warning: boolean };
    type FarmWarning = { key: string; name: string; differenceW: number };
    const farmPowerWarningLimitW = 200;
    const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
    const stamp = (value: unknown): value is number => finite(value) && Number.isSafeInteger(value) && value > 0;
    /** Diagnose eines einzelnen, zeitlich belegten Batterieauftrags. Positiv bedeutet Entladen. */
    function compareFarmPower(targetW: unknown, measuredW: unknown, commandAt: unknown, sampledAt: unknown, validUntil: unknown, now: number, domain?: 'ess-ac') {
        if (domain !== undefined && domain !== 'ess-ac') return null;
        if (!finite(targetW) || !finite(measuredW) || !finite(commandAt) || !finite(sampledAt) || !finite(validUntil) || !finite(now)) return null;
        const expiry = Math.min(validUntil, sampledAt + 30000);
        if (commandAt <= 0 || sampledAt <= commandAt || sampledAt > now || now > expiry) return null;
        const differenceW = Math.abs(targetW - measuredW);
        if (!finite(differenceW)) return null;
        return { v: 1 as const, ...(domain ? { domain } : {}), targetW, measuredW, differenceW, commandAt, sampledAt, validUntil: expiry, warning: differenceW > farmPowerWarningLimitW };
    }
    function farmKey(row: unknown): string {
        return record(row) && typeof row.dispatchKey === 'string' && row.dispatchKey.length <= 512 ? row.dispatchKey.trim() : '';
    }
    // The EMS owns command acceptance, sign and warning threshold. The same reader
    // validates its timed evidence for the dashboard, farm page and mail service.
    function farmPowerComparison(row: unknown, now: number): FarmComparison | null {
        if (!record(row) || row.online !== true || !farmKey(row) || !finite(now)) return null;
        const report = row.powerComparison;
        if (!record(report) || report.v !== 1 || typeof report.warning !== 'boolean') return null;
        const { targetW, measuredW, differenceW, commandAt, sampledAt, validUntil, domain } = report;
        if (domain !== undefined && domain !== 'ess-ac') return null;
        if (!finite(targetW) || !finite(measuredW) || !finite(differenceW) || differenceW !== Math.abs(targetW - measuredW)
            || report.warning !== (differenceW > farmPowerWarningLimitW)
            || !stamp(sampledAt) || !stamp(commandAt) || !stamp(validUntil) || commandAt >= sampledAt
            || sampledAt > now || now > validUntil || validUntil - sampledAt > 30000) return null;
        return { v: 1, targetW, measuredW, differenceW, commandAt, sampledAt, validUntil, warning: report.warning,
            ...(domain === 'ess-ac' ? { domain } : {}) };
    }
    // The atomic farm payload is immutable between SSE updates. Retain only small
    // warning candidates; duplicate device keys never produce an attributable alarm.
    const farmCandidates = new WeakMap<RecordValue, RecordValue[]>();
    function farmWarnings(state: unknown, now: number): FarmWarning[] {
        if (!record(state) || !stamp(state.ts) || state.ts > now || !confirmed(state, now, 30000)
            || typeof state.value !== 'string' || state.value.length > 262144) return [];
        let candidates = farmCandidates.get(state);
        if (!candidates) {
            candidates = [];
            try {
                const rows: unknown = JSON.parse(state.value);
                if (Array.isArray(rows) && rows.length <= 128) {
                    const seen = new Set<string>(), duplicates = new Set<string>();
                    for (const row of rows) {
                        const key = farmKey(row);
                        if (!key) continue;
                        if (seen.has(key)) duplicates.add(key);
                        seen.add(key);
                        if (record(row) && record(row.powerComparison) && row.powerComparison.warning === true) {
                            candidates.push({ dispatchKey: key, name: row.name, online: row.online, powerComparison: row.powerComparison });
                        }
                    }
                    candidates = candidates.filter(row => !duplicates.has(farmKey(row)));
                }
            } catch { /* Incomplete or malformed evidence cannot establish a deviation. */ }
            farmCandidates.set(state, candidates);
        }
        const result: FarmWarning[] = [];
        for (const row of candidates) {
            const report = farmPowerComparison(row, now);
            if (report?.warning) result.push({ key: farmKey(row), name: typeof row.name === 'string' ? row.name.trim().slice(0, 64) : '', differenceW: report.differenceW });
        }
        return result;
    }
    // Ordinary power updates belong to the ten-second display frame. A change
    // of affected storage units gets an immediate diagnostic refresh.
    function farmWarningChanged(before: unknown, after: unknown, now: number): boolean {
        const a = farmWarnings(before, now), b = farmWarnings(after, now);
        return a.length !== b.length || a.some((warning, i) => warning.key !== b[i]?.key);
    }

    type Health = {
        ems: string; grid: string; summary: string;
        phase: 'offline' | 'stopped' | 'grid-unavailable' | 'unknown' | 'healthy';
    };
    type ChargingStatus = { overallLevel: string; systemText: string; globalSafety: boolean; total: number };
    const processIds = ['ui', 'ems', 'devices', 'eebus', 'backup', 'ocpp'] as const;
    type ProcessId = typeof processIds[number];
    type ProcessHealth = { state: 'ok' | 'fault' | 'unknown'; failed: ProcessId[]; paused: ProcessId[]; waiting: ProcessId[] };
    type Headline = { text: string; level: 'ok' | 'info' | 'warn' | 'error'; processIds?: ProcessId[]; deviceNames?: string[]; totalOffline?: number; storageWarnings?: FarmWarning[] };
    // Older snapshots omit ack. An explicit unconfirmed value cannot establish operational health.
    function confirmed(row: RecordValue | null, now: number, maxAge: number): boolean {
        return current(row, now, maxAge, true) && (row?.ack === undefined || row.ack === true);
    }
    type ReportIssue = 'missing' | 'invalid' | 'stale';
    const aliveIssue = { missing: 'EMS-Betriebsmeldung fehlt', invalid: 'EMS-Betriebsmeldung ungültig', stale: 'EMS-Betriebsmeldung veraltet' };
    const beatIssue = { missing: 'EMS-Herzschlag fehlt', invalid: 'EMS-Herzschlag ungültig', stale: 'EMS-Herzschlag veraltet' };
    const gridIssue = { missing: 'NVP-Bestätigung fehlt', invalid: 'NVP-Bestätigung ungültig', stale: 'NVP-Bestätigung veraltet' };

    function reportIssue(row: unknown, now: number, isHeartbeat: boolean): ReportIssue | null {
        if (row === null || row === undefined) return 'missing';
        if (!record(row) || (row.ack !== undefined && row.ack !== true) || (row.q !== undefined && row.q !== 0)) return 'invalid';
        const ts = number(row.ts);
        if (ts === null || ts <= 0 || ts > now + 5000) return 'invalid';
        let observedAt = ts;
        if (isHeartbeat) {
            const beat = number(row.value);
            if (beat === null || beat <= 0 || beat > now + 5000) return 'invalid';
            observedAt = Math.min(ts, beat);
        } else if (typeof row.value !== 'boolean') return 'invalid';
        return now - observedAt > 30000 ? 'stale' : null;
    }

    // An ordinary heartbeat advances the timestamp without changing what the operator sees.
    function reportChanged(previous: unknown, next: unknown, now: number, isHeartbeat: boolean): boolean {
        const before = reportIssue(previous, now, isHeartbeat), after = reportIssue(next, now, isHeartbeat);
        return before !== after || (!after && !isHeartbeat && record(previous) && record(next) && previous.value !== next.value);
    }

    function status(snapshot: unknown, online: boolean, now: number, gridMaxAge = 30000): Health {
        if (!online) return { ems: 'Verbindung unterbrochen', grid: 'Messstatus unbekannt', summary: 'Verbindung unterbrochen', phase: 'offline' };
        const alive = entry(snapshot, 'ems.core.schedulerAlive');
        const beat = entry(snapshot, 'ems.core.schedulerHeartbeatAt');
        const nvp = entry(snapshot, 'ems.gridMeasurementFresh');
        const aliveProblem = reportIssue(alive, now, false), beatProblem = reportIssue(beat, now, true);
        const gridProblem = reportIssue(nvp, now, false);
        const stopped = !aliveProblem && alive?.value === false;
        const emsProblem = aliveProblem ? aliveIssue[aliveProblem] : beatProblem ? beatIssue[beatProblem] : '';
        const gridUnavailable = !gridProblem && nvp?.value === false;
        const gridDiagnosis = gridProblem ? gridIssue[gridProblem] : '';
        let grid = gridUnavailable ? 'Messung fehlt / veraltet' : gridDiagnosis || 'Messung aktuell';
        if (gridProblem === 'missing' && record(snapshot) && !Object.hasOwn(snapshot, 'ems.gridMeasurementFresh')) {
            const measurement = entry(snapshot, 'derived.core.grid.netW');
            if (confirmed(measurement, now, gridMaxAge) && number(measurement?.value) !== null) grid = 'Messwert vorhanden · Bestätigung fehlt';
        }
        const ems = stopped ? 'Gestoppt' : emsProblem || 'Aktiv';
        if (stopped) return { ems, grid, summary: 'EMS gestoppt', phase: 'stopped' };
        if (gridUnavailable) return { ems, grid, summary: 'Netzmessung fehlt oder ist veraltet', phase: 'grid-unavailable' };
        if (emsProblem || gridDiagnosis) return { ems, grid, summary: emsProblem || gridDiagnosis, phase: 'unknown' };
        return { ems, grid, summary: 'EMS aktiv · NVP-Messung aktuell', phase: 'healthy' };
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
        if (p14Fallback) return { text: '§14a-Kommunikationsfallback aktiv', level: 'warn' };
        if (chargeModel && chargeModel.total > 0 && chargeModel.overallLevel === 'warn') {
            return { text: chargeModel.systemText, level: 'warn' };
        }
        if (!emsPaused && health?.phase !== 'healthy') return { text: health?.summary || 'Betriebsdiagnose nicht verfügbar', level: 'warn' };
        if (processes?.state !== 'ok') return { text: 'Prozessstatus unbekannt', level: 'warn' };
        if (emsPaused) return { text: 'EMS pausiert', level: 'info' };
        return { text: 'Alle Systeme normal', level: 'ok' };
    }
    function dashboardStatus(health: Health | null | undefined, connection: string | undefined,
        chargeModel: ChargingStatus | null | undefined, safetyStop: boolean, p14Fallback: boolean,
        processSnapshot?: unknown, now = Date.now(), farmState?: unknown): Headline {
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
        if (primary.level === 'ok') {
            const storageWarnings = farmWarnings(farmState, now);
            if (storageWarnings.length) return { text: 'Speicherabweichung: {name} · {watts} W', level: 'warn', storageWarnings };
        }
        return primary;
    }
    const view = Object.freeze({ read, farm, status, dashboardStatus, reportChanged, buildingQuality, farmPowerComparison, farmWarningChanged });
    if (typeof window !== 'undefined') (window as Window & { NexoWattLiveDisplay?: typeof view }).NexoWattLiveDisplay = view;
    if (typeof module !== 'undefined' && module.exports) module.exports = { compareFarmPower, farmPowerComparison, farmPowerWarningLimitW };
})();
