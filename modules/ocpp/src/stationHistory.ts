import { createHash } from 'node:crypto';

type States = Record<string, unknown>;
export type KnownStation = { key: string; offline: boolean };
const record = (value: unknown): value is States => !!value && typeof value === 'object' && !Array.isArray(value);
export const stationKey = (identity: string): string => createHash('sha256').update(identity).digest('hex');
const fields = [
    'health.staleReason',
    'health.online',
    'health.dashboardConfirmedKey',
    'info.identity',
    'info.heartbeatInterval',
    'health.lastBoot',
    'info.lastHeartbeat',
    'health.lastMeterValue',
] as const;

/**
 * Only exact evidence suffixes in the module's own (possibly migrated) namespace.
 * Object defaults, socket creation and a configuration allowlist do not prove a station exists.
 */
export async function readStationHistory(
    namespace: string,
    read: (pattern: string) => Promise<unknown>,
    allow: Set<string>,
): Promise<{ known: Map<string, KnownStation>; complete: boolean; readFailed: boolean }> {
    const rows = new Map<string, States>();
    let complete = true;
    let readFailed = false;
    const collect = async (field: (typeof fields)[number]): Promise<void> => {
        try {
            const values = await read(`*.${field}`);
            if (!record(values)) {
                throw new Error('invalid controller response');
            }
            for (const [id, state] of Object.entries(values)) {
                const rel = id.startsWith(`${namespace}.`) ? id.slice(namespace.length + 1) : id;
                if (!rel.endsWith(`.${field}`)) {
                    continue;
                }
                const root = rel.slice(0, -(field.length + 1));
                if (!/^[A-Za-z0-9_-]{1,256}$/.test(root) || !record(state)) {
                    continue;
                }
                if (state.ack !== true || (state.q !== undefined && state.q !== 0)) {
                    // An unreadable positive marker is not proof of an empty station inventory.
                    if (field === 'health.dashboardConfirmedKey' && state.val) {
                        complete = false;
                    }
                    continue;
                }
                let row = rows.get(root);
                if (!row) {
                    if (rows.size >= 1024) {
                        complete = false;
                        continue;
                    }
                    row = {};
                    rows.set(root, row);
                }
                row[field] = state.val;
            }
        } catch {
            complete = false;
            readFailed = true;
        }
    };
    // Start with outage evidence before the normal runtime resets old session flags.
    // At most two bounded controller requests in flight, independent of station count.
    for (let i = 0; i < fields.length; i += 2) {
        await Promise.all(fields.slice(i, i + 2).map(collect));
    }
    const known = new Map<string, KnownStation>();
    const now = Date.now();
    for (const row of rows.values()) {
        const raw = row['info.identity'],
            marker = row['health.dashboardConfirmedKey'];
        const timestamp = (value: unknown): boolean =>
            typeof value === 'string' &&
            Number.isFinite(Date.parse(value)) &&
            Date.parse(value) > 0 &&
            Date.parse(value) <= now;
        const interval = row['info.heartbeatInterval']; // The native runtime writes this only after BootNotification.
        const legacy =
            (typeof interval === 'number' && Number.isInteger(interval) && interval >= 10 && interval <= 86400) ||
            timestamp(row['health.lastBoot']) ||
            timestamp(row['info.lastHeartbeat']) ||
            timestamp(row['health.lastMeterValue']);
        const marked = typeof marker === 'string' && /^[a-f0-9]{64}$/.test(marker);
        if (!marked && !legacy) {
            if (marker) {
                complete = false;
            }
            continue;
        }
        const rawKey = typeof raw === 'string' && raw.length > 0 && raw.length <= 256 ? stationKey(raw) : '';
        if (marked && rawKey && rawKey !== marker) {
            complete = false;
            continue;
        }
        const key = marked ? marker : rawKey;
        if (!key) {
            complete = false;
            continue;
        }
        if (allow.size && !allow.has(key)) {
            continue;
        }
        if (known.has(key)) {
            complete = false;
            continue;
        }
        const reason = row['health.staleReason'];
        const offline =
            row['health.online'] === false && (reason === 'socket-disconnected' || reason === 'no-ocpp-activity');
        known.set(key, { key, offline });
    }
    return { known, complete, readFailed };
}
