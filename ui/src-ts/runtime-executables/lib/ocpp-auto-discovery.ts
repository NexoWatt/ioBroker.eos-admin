/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Registrierte native OCPP21-Stationen automatisch und idempotent dem EMS zuordnen.
 * Daten und Wirkung: Prüft ausschließlich den veröffentlichten OCPP-Vertrag und erstellt
 * Konfigurationsvorschläge. Neue Stationen bleiben bis zur Inbetriebnahme deaktiviert;
 * dieser Dienst sendet niemals Gerätebefehle. Ein Stationslimit ist eine einzige Stellgröße,
 * unabhängig von der Zahl der physisch vorhandenen Anschlüsse.
 * Bei Änderungen: Teilregistrierung, Parallel-Save, Neustart, Offline, manuelle Mappings,
 * mehrere EVSE, Vertragsfehler und kontrolliertes Beenden prüfen.
 */
type Dict = Record<string, unknown>;
type States = Record<string, unknown>;
export const OCPP_NATIVE_CONTRACT = 'nexowatt-ocpp21-0.4-native';
const MAX_STATIONS = 128;
const MAX_OBJECTS = 50000;
const MAX_ROWS = 50;
const META = new Set(['eosContract', 'deviceType', 'identity', 'protocol', 'connectorCount', 'evseCount', 'topologySource', 'controlScope', 'topologyJson', 'socketConnected']);
const record = (value: unknown): Dict => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Dict : {};
const text = (value: unknown, max = 160): string => typeof value === 'string' && value.length <= max && !/[\x00-\x1f\x7f]/.test(value) ? value : '';
const empty = (value: unknown): boolean => value === null || value === undefined || value === '';
const fail = (code: string): Error => Object.assign(new Error(code), { code });
const valueOf = (states: States, id: string): unknown => {
    const state = record(states[id]);
    return state.ack !== false && (state.q === undefined || state.q === 0) ? state.val : undefined;
};

/** Known native and previous public alias identities. Arbitrary aliases are never guessed. */
export function ocppStationRoot(value: unknown): string {
    const id = text(value, 512);
    const hosted = /^(eos-admin\.\d+\.ocpp)\.([A-Za-z0-9_-]+)(?:\.|$)/.exec(id);
    if (hosted && hosted[2] && !['__proto__', 'prototype', 'constructor'].includes(hosted[2])) return `${hosted[1]}.${hosted[2]}`;
    const match = /^(?:ocpp21\.(\d+)\.([A-Za-z0-9_-]+)|alias\.0\.nexowatt\.ocpp\.(\d+)\.([A-Za-z0-9_-]+)|alias\.0\.ocpp21\.(\d+)\.([A-Za-z0-9_-]+))(?:\.|$)/.exec(id);
    if (!match) return '';
    const instance = match[1] ?? match[3] ?? match[5];
    const station = match[2] ?? match[4] ?? match[6];
    if (!station || ['__proto__', 'prototype', 'constructor'].includes(station)) return '';
    return `ocpp21.${instance}.${station}`;
}

/** Only the owning EOS instance may discover/control its hosted OCPP tree. */
export function ocppRootInScope(root: string, hostNamespace: unknown): boolean {
    if (ocppStationRoot(root) !== root) return false;
    return root.startsWith('ocpp21.') || (typeof hostNamespace === 'string' && /^eos-admin\.\d+$/.test(hostNamespace)
        && root.startsWith(`${hostNamespace}.ocpp.`));
}
export function ocppNamespace(root: string): string {
    return ocppStationRoot(root) === root ? root.slice(0, root.lastIndexOf('.')) : '';
}
export function ocppDiscoveryPatterns(hostNamespace: unknown): string[] {
    return ['ocpp21.*', ...(typeof hostNamespace === 'string' && /^eos-admin\.\d+$/.test(hostNamespace)
        ? [`${hostNamespace}.ocpp.*`] : [])];
}

type MappingSpec = Readonly<{ field: string; suffix: string; type: string; unit?: string; write?: boolean; required?: boolean }>;
const SPECS: readonly MappingSpec[] = [
    { field: 'powerId', suffix: 'measurements.powerW', type: 'number', unit: 'W', required: true },
    { field: 'currentId', suffix: 'measurements.currentA', type: 'number', unit: 'A' },
    { field: 'energyTotalId', suffix: 'measurements.energyKWh', type: 'number', unit: 'kWh' },
    { field: 'statusId', suffix: 'info.status', type: 'string', required: true },
    { field: 'chargingStateId', suffix: 'transactions.chargingState', type: 'string' },
    { field: 'activeId', suffix: 'transactions.transactionActive', type: 'boolean' },
    { field: 'heartbeatId', suffix: 'health.lastSeenMs', type: 'number', required: true },
    { field: 'onlineId', suffix: 'info.socketConnected', type: 'boolean', required: true },
    { field: 'dataFreshId', suffix: 'health.dataFresh', type: 'boolean', required: true },
    { field: 'setPowerWId', suffix: 'control.chargeLimit', type: 'number', unit: 'W', write: true, required: true },
    { field: 'enableWriteId', suffix: 'control.availability', type: 'boolean', write: true, required: true },
    { field: 'appliedChargeLimitWId', suffix: 'control.appliedChargeLimitW', type: 'number', unit: 'W', required: true },
    { field: 'appliedChargeLimitValidId', suffix: 'control.appliedChargeLimitValid', type: 'boolean', required: true },
    { field: 'vehicleSocId', suffix: 'measurements.socPercent', type: 'number', unit: '%' },
    { field: 'rfidReadId', suffix: 'info.rfid', type: 'string' },
];
const ID_FIELDS = [...SPECS.map(spec => spec.field), 'setCurrentAId', 'phaseSwitchId', 'energySessionId'];
export type OcppStation = Readonly<{
    root: string; adapterInstance: string; name: string; protocol: string;
    ids: Readonly<Record<string, string>>; missing: readonly string[];
    connectorCount: number | null; evseCount: number | null; topologySource: string;
    connectors: readonly Readonly<{ evseId: number; connectorId: number }>[];
}>;
export type OcppDiscoveryStatus = {
    root: string; adapterInstance: string; rowIndex: number | null; code: string;
    connectorCount: number | null; evseCount: number | null; topologySource: string; missing: readonly string[];
};
export type OcppDiscoveryPlan = {
    changed: boolean; patch: Dict; statuses: OcppDiscoveryStatus[];
};

/** Object definitions establish units/directions; a stale measurement is not used to register a writer. */
export function collectOcppStations(objectInput: unknown, stateInput: unknown, hostNamespace?: string): OcppStation[] {
    const objects = record(objectInput); const states = record(stateInput);
    const keys = Object.keys(objects);
    if (keys.length > MAX_OBJECTS || Object.keys(states).length > MAX_OBJECTS) throw fail('EOS_OCPP_DISCOVERY_INVENTORY_LIMIT');
    const roots = [...new Set(keys.filter(id => id.endsWith('.info.eosContract')).map(ocppStationRoot).filter(root => ocppRootInScope(root, hostNamespace)))].sort();
    if (roots.length > MAX_STATIONS) throw fail('EOS_OCPP_DISCOVERY_STATION_LIMIT');
    const count = (value: unknown): number | null => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1024 ? value : null;
    const stations: OcppStation[] = [];
    for (const root of roots) {
        if (valueOf(states, `${root}.info.eosContract`) !== OCPP_NATIVE_CONTRACT || valueOf(states, `${root}.info.deviceType`) !== 'evCharger') continue;
        const scope = valueOf(states, `${root}.info.controlScope`);
        if (scope !== undefined && scope !== '' && scope !== 'station') continue;
        const ids: Record<string, string> = {};
        const missing: string[] = [];
        for (const spec of SPECS) {
            const id = `${root}.${spec.suffix}`; const object = record(objects[id]); const common = record(object.common);
            const valid = object.type === 'state' && (object._id === undefined || object._id === id)
                && common.type === spec.type && common.read !== false && (!spec.write || common.write === true)
                && (!spec.unit || common.unit === spec.unit);
            if (valid) ids[spec.field] = id;
            else if (spec.required) missing.push(spec.field);
        }
        const connectors = new Map<string, { evseId: number; connectorId: number }>();
        // Optional detail objects describe topology; they never become independent command paths.
        for (const id of keys) {
            if (!id.startsWith(`${root}.connectors.`)) continue;
            const match = /^(\d+)_(\d+)(?:\.|$)/.exec(id.slice(`${root}.connectors.`.length));
            if (!match) continue;
            const evseId = Number(match[1]); const connectorId = Number(match[2]);
            if (evseId > 0 && evseId <= 1024 && connectorId > 0 && connectorId <= 1024) connectors.set(`${evseId}:${connectorId}`, { evseId, connectorId });
            if (connectors.size > 1024) throw fail('EOS_OCPP_DISCOVERY_TOPOLOGY_LIMIT');
        }
        // Newer contracts publish topology even when optional connector detail objects are off.
        const topology = valueOf(states, `${root}.info.topologyJson`);
        if (typeof topology === 'string' && topology.length <= 32768) {
            try {
                const parsed: unknown = JSON.parse(topology);
                const ports = Array.isArray(parsed) ? parsed : record(parsed).connectors;
                if (Array.isArray(ports) && ports.length <= 1024) for (const port of ports) {
                    const p = record(port); const evseId = count(p.evseId); const connectorId = count(p.connectorId);
                    if (evseId && connectorId) connectors.set(`${evseId}:${connectorId}`, { evseId, connectorId });
                }
            } catch { /* Invalid optional topology must not grant any additional control scope. */ }
        }
        stations.push({ root, adapterInstance: ocppNamespace(root),
            name: text(valueOf(states, `${root}.info.identity`), 120) || root.slice(root.lastIndexOf('.') + 1),
            protocol: text(valueOf(states, `${root}.info.protocol`), 30), ids, missing,
            connectorCount: count(valueOf(states, `${root}.info.connectorCount`)), evseCount: count(valueOf(states, `${root}.info.evseCount`)),
            topologySource: text(valueOf(states, `${root}.info.topologySource`), 60) || 'unknown',
            connectors: [...connectors.values()].sort((a, b) => a.evseId - b.evseId || a.connectorId - b.connectorId) });
    }
    return stations;
}

function rootsOf(row: Dict): string[] {
    return [...new Set([...ID_FIELDS.map(key => ocppStationRoot(row[key])), ocppStationRoot(record(row.ocppDiscovery).stationRoot)].filter(Boolean))];
}
/** Only bounded discovery metadata crosses the normalized runtime configuration. */
export function normalizeOcppDiscovery(value: unknown): Dict | null {
    const input = record(value); const stationRoot = text(input.stationRoot, 200);
    if (input.source !== 'nexowatt-ocpp21' || input.contract !== OCPP_NATIVE_CONTRACT
        || input.controlScope !== 'station' || ocppStationRoot(stationRoot) !== stationRoot
        || !['MAPPED', 'COMMISSIONING_REQUIRED', 'CONTRACT_INCOMPLETE', 'CONTROL_GROUP_CONFLICT', 'MIXED_MANUAL_MAPPING', 'MANUAL_MAPPING_REVIEW_REQUIRED'].includes(String(input.code))) return null;
    const count = (item: unknown): number | null => typeof item === 'number' && Number.isInteger(item) && item >= 0 && item <= 1024 ? item : null;
    const connectors = Array.isArray(input.connectors) ? input.connectors.slice(0, 1024).map(item => {
        const port = record(item); return { evseId: count(port.evseId), connectorId: count(port.connectorId) };
    }).filter(port => port.evseId !== null && port.evseId > 0 && port.connectorId !== null && port.connectorId > 0) : [];
    return { source: 'nexowatt-ocpp21', stationRoot, contract: OCPP_NATIVE_CONTRACT, controlScope: 'station',
        code: input.code, autoCreated: input.autoCreated === true, connectorCount: count(input.connectorCount), evseCount: count(input.evseCount),
        topologySource: text(input.topologySource, 60) || 'unknown', connectors };
}
function knownAliasEquivalent(field: string, current: unknown, canonical: string, root: string): boolean {
    const id = text(current, 512);
    if (!id.startsWith('alias.0.') || ocppStationRoot(id) !== root) return false;
    const suffix = canonical.slice(root.length + 1).toLowerCase();
    if (id.toLowerCase().endsWith(`.${suffix}`)) return true;
    const aliases: Record<string, readonly string[]> = {
        powerId: ['powerw', 'power'], energyTotalId: ['energykwh', 'energytotal'],
        statusId: ['status'], onlineId: ['socketconnected'], dataFreshId: ['datafresh'],
        setPowerWId: ['chargelimit', 'setpowerw'], enableWriteId: ['availability'],
        heartbeatId: ['lastseenms'], activeId: ['transactionactive'], chargingStateId: ['chargingstate'],
        vehicleSocId: ['socpercent'], rfidReadId: ['rfid'],
    };
    return (aliases[field] || []).some(suffix => id.toLowerCase().endsWith(`.${suffix}`));
}

/** Called inside the shared installer mutation lock with the latest configuration. */
export function planOcppDiscovery(configInput: unknown, stations: readonly OcppStation[], options: Readonly<{ maxRows?: number }> = {}): OcppDiscoveryPlan {
    const config = record(configInput); const settings = record(config.settingsConfig);
    const limit = options.maxRows ?? MAX_ROWS;
    if (!Number.isInteger(limit) || limit < 0) throw fail('EOS_OCPP_LICENSE_LIMIT_INVALID');
    const maxRows = Math.min(MAX_ROWS, limit);
    if (settings.evcsList !== undefined && !Array.isArray(settings.evcsList)) throw fail('EOS_OCPP_CONFIG_INVALID');
    const original = (settings.evcsList || []) as unknown[];
    if (original.length > MAX_ROWS || original.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw fail('EOS_OCPP_CONFIG_INVALID');
    const rows: Dict[] = original.map(row => ({ ...record(row) }));
    const statuses: OcppDiscoveryStatus[] = [];
    if (stations.length > MAX_STATIONS) throw fail('EOS_OCPP_DISCOVERY_STATION_LIMIT');
    for (const station of stations) {
        const found = rows.map((row, index) => ({ row, index })).filter(item => rootsOf(item.row).includes(station.root));
        const existing = found[0];
        let code = station.missing.length ? 'CONTRACT_INCOMPLETE' : 'MAPPED';
        if (found.length > 1) code = 'CONTROL_GROUP_CONFLICT';
        else if (existing && rootsOf(existing.row).length > 1) code = 'MIXED_MANUAL_MAPPING';
        else if (!found.length && rows.length >= maxRows) code = maxRows < MAX_ROWS ? 'LICENSE_LIMIT' : 'ROW_LIMIT';
        const blocked = ['CONTROL_GROUP_CONFLICT', 'MIXED_MANUAL_MAPPING', 'ROW_LIMIT', 'LICENSE_LIMIT'].includes(code);
        const index = existing ? existing.index : rows.length;
        // Partial registration is visible, with every verified field filled now; retry completes it later.
        if (!blocked) {
            const next: Dict = existing ? { ...existing.row } : { enabled: false, name: station.name, stationKey: station.root, connectorNo: 1 };
            const autoCreated = !existing || record(next.ocppDiscovery).autoCreated === true;
            const manualMonitor = !!existing && !autoCreated && next.enabled !== false
                && empty(next.setCurrentAId) && empty(next.setPowerWId);
            for (const [key, id] of Object.entries(station.ids)) {
                // Discovering an existing monitor must not authorize a first command writer.
                if (manualMonitor && (key === 'setPowerWId' || key === 'enableWriteId')) continue;
                if (key === 'setPowerWId' && !empty(next.setCurrentAId) && empty(next.setPowerWId)) continue;
                if (empty(next[key]) || knownAliasEquivalent(key, next[key], id, station.root)) {
                    next[key] = id;
                    if (key === 'energyTotalId') next.energyTotalInputIsWh = false;
                }
            }
            if (empty(next.telemetryProfile)) next.telemetryProfile = 'nexowattocpp';
            if (empty(next.controlPreference) && empty(next.setCurrentAId) && !manualMonitor) next.controlPreference = 'powerW';
            if (code === 'MAPPED' && next.enabled === false) code = 'COMMISSIONING_REQUIRED';
            if (manualMonitor) code = 'MANUAL_MAPPING_REVIEW_REQUIRED';
            next.ocppDiscovery = { source: 'nexowatt-ocpp21', stationRoot: station.root, contract: OCPP_NATIVE_CONTRACT,
                controlScope: 'station', connectorCount: station.connectorCount, evseCount: station.evseCount,
                topologySource: station.topologySource, connectors: station.connectors, code, autoCreated };
            rows[index] = next;
        }
        statuses.push({ root: station.root, adapterInstance: station.adapterInstance, rowIndex: blocked && !found.length ? null : index,
            code, connectorCount: station.connectorCount, evseCount: station.evseCount, topologySource: station.topologySource, missing: station.missing });
    }
    const count = settings.evcsCount;
    if (count !== undefined && (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > MAX_ROWS)) throw fail('EOS_OCPP_CONFIG_INVALID');
    const nextCount = Math.max(typeof count === 'number' ? count : 0, rows.length);
    const changed = JSON.stringify(rows) !== JSON.stringify(original) || (rows.length > 0 && count !== nextCount);
    return { changed, patch: changed ? { settingsConfig: { ...settings, evcsList: rows, evcsCount: nextCount } } : {}, statuses };
}

type DiscoveryOptions = Readonly<{
    readObjects(): Promise<unknown>; readMetadata(): Promise<unknown>; subscribe(): Promise<unknown>;
    reconcile(stations: readonly OcppStation[]): Promise<OcppDiscoveryPlan>;
    canRun(): boolean; warn(code: string): void;
    pollMs?: number; debounceMs?: number; hostNamespace?: string;
}>;
/** Single-flight scans coalesce registration events; periodic retry covers missed events/restarts. */
export class OcppAutoDiscovery {
    private stopped = false;
    private started = false;
    private dirty = false;
    private running: Promise<void> | null = null;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private poll: ReturnType<typeof setInterval> | undefined;
    private metadata = new Map<string, string>();
    private view: { state: string; error: string; ts: number; stations: OcppDiscoveryStatus[] } = { state: 'idle', error: '', ts: 0, stations: [] };
    constructor(private readonly options: DiscoveryOptions) {}
    status(): typeof this.view { return { ...this.view, stations: this.view.stations.map(item => ({ ...item, missing: [...item.missing] })) }; }
    async start(): Promise<void> {
        if (this.started || this.stopped) return;
        this.started = true;
        try { await this.readBounded(this.options.subscribe()); } catch { this.options.warn('EOS_OCPP_SUBSCRIBE_FAILED'); }
        if (this.stopped) return;
        this.poll = setInterval(() => this.request(), this.options.pollMs ?? 60000);
        this.poll.unref?.();
        await this.refresh();
    }
    onStateChange(id: string, state: unknown): void {
        const root = ocppStationRoot(id);
        if (!ocppRootInScope(root, this.options.hostNamespace) || !id.startsWith(`${root}.info.`) || !META.has(id.slice(`${root}.info.`.length))) return;
        const st = record(state);
        const value = typeof st.val === 'string' ? (st.val.length <= 32768 ? st.val : 'oversized-metadata')
            : typeof st.val === 'boolean' || (typeof st.val === 'number' && Number.isFinite(st.val)) ? st.val : null;
        const signature = JSON.stringify([value, typeof st.q === 'number' ? st.q : null, st.ack === true]);
        if (this.metadata.get(id) === signature) return;
        if (this.metadata.size < MAX_STATIONS * META.size) this.metadata.set(id, signature);
        this.request();
    }
    request(): void {
        if (this.stopped || !this.started) return;
        this.dirty = true;
        if (this.running || this.timer) return;
        this.timer = setTimeout(() => { this.timer = undefined; void this.refresh(); }, this.options.debounceMs ?? 500);
        this.timer.unref?.();
    }
    async refresh(): Promise<void> {
        if (this.stopped) return;
        this.dirty = true;
        if (this.running) return this.running;
        this.running = this.drain();
        try { await this.running; }
        finally { this.running = null; if (this.dirty && !this.stopped) this.request(); }
    }
    private async readBounded(operation: Promise<unknown>): Promise<unknown> {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try { return await Promise.race([operation, new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(fail('EOS_OCPP_DISCOVERY_TIMEOUT')), 5000);
        })]); } finally { if (timer) clearTimeout(timer); }
    }
    private async drain(): Promise<void> {
        // Bound one event burst; further work yields to the regular event loop.
        for (let pass = 0; pass < 2 && this.dirty && !this.stopped; pass++) {
            this.dirty = false;
            if (!this.options.canRun()) { this.view = { ...this.view, state: 'blocked', error: 'EOS_OCPP_RUNTIME_NOT_READY' }; return; }
            try {
                const [objects, states] = await Promise.all([this.readBounded(this.options.readObjects()), this.readBounded(this.options.readMetadata())]);
                if (this.stopped || !this.options.canRun()) return;
                const stations = collectOcppStations(objects, states, this.options.hostNamespace);
                const plan = await this.options.reconcile(stations);
                if (this.stopped) return;
                this.view = { state: 'ready', error: '', ts: Date.now(), stations: plan.statuses };
            } catch (error) {
                if (this.stopped) return;
                const code = error instanceof Error && /^EOS_[A-Z0-9_]+$/.test(error.message) ? error.message : 'EOS_OCPP_DISCOVERY_FAILED';
                if (this.view.error !== code) this.options.warn(code);
                this.view = { ...this.view, state: 'pending', error: code };
                if (!this.timer) {
                    this.timer = setTimeout(() => { this.timer = undefined; void this.refresh(); }, 5000);
                    this.timer.unref?.();
                }
            }
        }
    }
    async stop(): Promise<void> {
        this.stopped = true; this.dirty = false;
        if (this.timer) clearTimeout(this.timer);
        if (this.poll) clearInterval(this.poll);
        this.timer = undefined; this.poll = undefined;
        await this.running;
        this.metadata.clear();
        this.view = { ...this.view, state: 'stopped' };
    }
}
