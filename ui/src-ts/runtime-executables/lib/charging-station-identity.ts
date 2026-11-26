// @runtime-transpile
/** Keep an existing station URL bound to its physical chargepoints on reindex. */
import { chargingPointLayout } from './charging-point-identity';

type Row = Record<string, unknown>;
const record = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const invalid = (): Error & { code: string } => Object.assign(new Error('EOS_EVCS_STATION_ASSIGNMENTS_INVALID'), { code: 'EOS_EVCS_STATION_ASSIGNMENTS_INVALID' });
function safeId(value: unknown): string {
    if (value !== undefined && value !== null && typeof value !== 'string' && typeof value !== 'number') throw invalid();
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_\-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64) || 'station';
}
function stationId(row: Row, index: number): string {
    const rawStationKey = row.stationKey || row.infrastructureStationKey || '';
    if (typeof rawStationKey !== 'string' && typeof rawStationKey !== 'number') throw invalid();
    const stationKey = String(rawStationKey).trim();
    return safeId(row.id || row.key || row.stationId || stationKey || `dc_station_${index + 1}`);
}
function stations(value: unknown): Row[] {
    if (!record(value) || value.stations === undefined) return [];
    if (!Array.isArray(value.stations) || value.stations.length > 100 || !value.stations.every(record)) throw invalid();
    const ids = value.stations.map(stationId);
    if (new Set(ids).size !== ids.length) throw invalid();
    return value.stations;
}
function manual(row: Row): string[] {
    const values: unknown[] = Array.isArray(row.assignedChargepoints) ? row.assignedChargepoints
        : Array.isArray(row.chargepoints) ? row.chargepoints : Array.isArray(row.lps) ? row.lps : [];
    if (values.length > 50) throw invalid();
    const result: string[] = [];
    for (const value of values) {
        if (typeof value !== 'string' && typeof value !== 'number') throw invalid();
        const text = String(value).trim().toLowerCase();
        if (text.length > 64) throw invalid();
        const match = /^(?:lp|ladepunkt|connector|evcs)?\s*([0-9]+)$/i.exec(text);
        const slot = match ? `lp${Math.max(1, Math.round(Number(match[1]) || 1))}` : safeId(text);
        if (!result.includes(slot)) result.push(slot);
    }
    return result;
}
function same(values: readonly string[], other: readonly string[]): boolean {
    return values.length === other.length && values.every((value, index) => value === other[index]);
}
function samePermissions(values: readonly string[], other: readonly string[]): boolean {
    return values.length === other.length && values.every(value => other.includes(value));
}

/** Explicitly edited/new lists belong to the new layout. Unchanged lists,
 * including automatic-mode manual fallbacks, retain their previous devices.
 * Pure and bounded: at most 50 chargepoints and 100 station records. */
export function remapChargingStationAssignments(previousRows: unknown, nextRows: unknown, previousKiosk: unknown, nextKiosk: unknown, namespace = 'eos-admin.0'): unknown {
    const previous = chargingPointLayout(previousRows, previousKiosk, namespace), next = chargingPointLayout(nextRows, nextKiosk, namespace);
    if (previous.length === next.length && previous.every((slot, index) => slot.identity === next[index]?.identity)) return nextKiosk;
    if (!record(nextKiosk)) return nextKiosk;
    const oldStations = stations(previousKiosk), nextStations = stations(nextKiosk);
    const oldById = new Map(oldStations.map((station, index) => [stationId(station, index), station]));
    const nextByIdentity = new Map(next.flatMap(slot => slot.identity ? [[slot.identity, `lp${slot.slot}`] as const] : []));
    let changed = false;
    const mapped = nextStations.map((station, index) => {
        const old = oldById.get(stationId(station, index));
        if (!old) return station;
        const before = manual(old), submitted = manual(station);
        // UI sorting does not authorize a different physical connector. Only a
        // changed permission set is an explicit assignment to the new layout.
        if (!samePermissions(before, submitted)) return station;
        const assigned: string[] = [];
        for (const oldSlot of submitted) {
            const match = /^lp([1-9]\d?)$/.exec(oldSlot);
            const identity = match ? previous[Number(match[1]) - 1]?.identity : null;
            const target = identity ? nextByIdentity.get(identity) : undefined;
            if (target && !assigned.includes(target)) assigned.push(target);
        }
        if (same(assigned, submitted)) return station;
        changed = true;
        const result: Row = { ...station, assignedChargepoints: assigned };
        delete result.chargepoints;
        delete result.lps;
        return result;
    });
    return changed ? { ...nextKiosk, stations: mapped } : nextKiosk;
}
