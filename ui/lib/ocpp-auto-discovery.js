/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/ocpp-auto-discovery.ts
 * Quell-Hash: sha256:1fcb9a8e0a1874f7872def460ff56cc6930da725a7a1292a7a38009dc94eff90
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/ocpp-auto-discovery.js.
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
exports.OcppAutoDiscovery = exports.OCPP_NATIVE_CONTRACT = void 0;
exports.ocppStationRoot = ocppStationRoot;
exports.ocppRootInScope = ocppRootInScope;
exports.ocppNamespace = ocppNamespace;
exports.ocppDiscoveryPatterns = ocppDiscoveryPatterns;
exports.collectOcppStations = collectOcppStations;
exports.filterOcppDiscoverySources = filterOcppDiscoverySources;
exports.normalizeOcppDiscovery = normalizeOcppDiscovery;
exports.planOcppDiscovery = planOcppDiscovery;
exports.OCPP_NATIVE_CONTRACT = 'nexowatt-ocpp21-0.4-native';
const MAX_STATIONS = 128;
const MAX_OBJECTS = 50000;
const MAX_ROWS = 50;
const META = new Set(['eosContract', 'deviceType', 'identity', 'protocol', 'connectorCount', 'evseCount', 'topologySource', 'controlScope', 'topologyJson', 'socketConnected']);
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value, max = 160) => typeof value === 'string' && value.length <= max && !/[\x00-\x1f\x7f]/.test(value) ? value : '';
const empty = (value) => value === null || value === undefined || value === '';
const fail = (code) => Object.assign(new Error(code), { code });
const valueOf = (states, id) => {
    const state = record(states[id]);
    return state.ack !== false && (state.q === undefined || state.q === 0) ? state.val : undefined;
};
/** Known native and previous public alias identities. Arbitrary aliases are never guessed. */
function ocppStationRoot(value) {
    const id = text(value, 512);
    const hosted = /^(eos-admin\.\d+\.ocpp)\.([A-Za-z0-9_-]+)(?:\.|$)/.exec(id);
    if (hosted && hosted[2] && !['__proto__', 'prototype', 'constructor'].includes(hosted[2]))
        return `${hosted[1]}.${hosted[2]}`;
    const match = /^(?:ocpp21\.(\d+)\.([A-Za-z0-9_-]+)|alias\.0\.nexowatt\.ocpp\.(\d+)\.([A-Za-z0-9_-]+)|alias\.0\.ocpp21\.(\d+)\.([A-Za-z0-9_-]+))(?:\.|$)/.exec(id);
    if (!match)
        return '';
    const instance = match[1] ?? match[3] ?? match[5];
    const station = match[2] ?? match[4] ?? match[6];
    if (!station || ['__proto__', 'prototype', 'constructor'].includes(station))
        return '';
    return `ocpp21.${instance}.${station}`;
}
/** Only the owning EOS instance may discover/control its hosted OCPP tree. */
function ocppRootInScope(root, hostNamespace) {
    if (ocppStationRoot(root) !== root)
        return false;
    return root.startsWith('ocpp21.') || (typeof hostNamespace === 'string' && /^eos-admin\.\d+$/.test(hostNamespace)
        && root.startsWith(`${hostNamespace}.ocpp.`));
}
function ocppNamespace(root) {
    return ocppStationRoot(root) === root ? root.slice(0, root.lastIndexOf('.')) : '';
}
function ocppDiscoveryPatterns(hostNamespace) {
    return ['ocpp21.*', ...(typeof hostNamespace === 'string' && /^eos-admin\.\d+$/.test(hostNamespace)
            ? [`${hostNamespace}.ocpp.*`] : [])];
}
const SPECS = [
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
/** Object definitions establish units/directions; a stale measurement is not used to register a writer. */
function collectOcppStations(objectInput, stateInput, hostNamespace) {
    const objects = record(objectInput);
    const states = record(stateInput);
    const keys = Object.keys(objects);
    if (keys.length > MAX_OBJECTS || Object.keys(states).length > MAX_OBJECTS)
        throw fail('EOS_OCPP_DISCOVERY_INVENTORY_LIMIT');
    const roots = [...new Set(keys.filter(id => id.endsWith('.info.eosContract')).map(ocppStationRoot).filter(root => ocppRootInScope(root, hostNamespace)))].sort();
    if (roots.length > MAX_STATIONS)
        throw fail('EOS_OCPP_DISCOVERY_STATION_LIMIT');
    const count = (value) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1024 ? value : null;
    const stations = [];
    for (const root of roots) {
        if (valueOf(states, `${root}.info.eosContract`) !== exports.OCPP_NATIVE_CONTRACT || valueOf(states, `${root}.info.deviceType`) !== 'evCharger')
            continue;
        const scope = valueOf(states, `${root}.info.controlScope`);
        if (scope !== undefined && scope !== '' && scope !== 'station')
            continue;
        const ids = {};
        const missing = [];
        for (const spec of SPECS) {
            const id = `${root}.${spec.suffix}`;
            const object = record(objects[id]);
            const common = record(object.common);
            const valid = object.type === 'state' && (object._id === undefined || object._id === id)
                && common.type === spec.type && common.read !== false && (!spec.write || common.write === true)
                && (!spec.unit || common.unit === spec.unit);
            if (valid)
                ids[spec.field] = id;
            else if (spec.required)
                missing.push(spec.field);
        }
        const connectors = new Map();
        // Optional detail objects describe topology; they never become independent command paths.
        for (const id of keys) {
            if (!id.startsWith(`${root}.connectors.`))
                continue;
            const match = /^(\d+)_(\d+)(?:\.|$)/.exec(id.slice(`${root}.connectors.`.length));
            if (!match)
                continue;
            const evseId = Number(match[1]);
            const connectorId = Number(match[2]);
            if (evseId > 0 && evseId <= 1024 && connectorId > 0 && connectorId <= 1024)
                connectors.set(`${evseId}:${connectorId}`, { evseId, connectorId });
            if (connectors.size > 1024)
                throw fail('EOS_OCPP_DISCOVERY_TOPOLOGY_LIMIT');
        }
        // Newer contracts publish topology even when optional connector detail objects are off.
        const topology = valueOf(states, `${root}.info.topologyJson`);
        if (typeof topology === 'string' && topology.length <= 32768) {
            try {
                const parsed = JSON.parse(topology);
                const ports = Array.isArray(parsed) ? parsed : record(parsed).connectors;
                if (Array.isArray(ports) && ports.length <= 1024)
                    for (const port of ports) {
                        const p = record(port);
                        const evseId = count(p.evseId);
                        const connectorId = count(p.connectorId);
                        if (evseId && connectorId)
                            connectors.set(`${evseId}:${connectorId}`, { evseId, connectorId });
                    }
            }
            catch { /* Invalid optional topology must not grant any additional control scope. */ }
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
/** Retained state objects do not prove that their standalone adapter still exists.
 * A hosted legacy namespace is admitted only from the owning parent's current
 * configuration, never from stale alive/hosted marker states. Offline configured
 * adapters remain discoverable; source lifecycle is separate from station health. */
function filterOcppDiscoverySources(stations, sourceInput, hostNamespace) {
    const source = record(sourceInput);
    const rows = record(source.instances).rows;
    if (!Array.isArray(rows) || rows.length > MAX_STATIONS)
        throw fail('EOS_OCPP_DISCOVERY_SOURCE_INVENTORY');
    const namespaces = new Set();
    for (const row of rows) {
        const instance = record(record(row).value);
        const id = text(instance._id, 120);
        if (instance.type !== 'instance' || !/^system\.adapter\.ocpp21\.\d{1,8}$/.test(id)) {
            throw fail('EOS_OCPP_DISCOVERY_SOURCE_INVENTORY');
        }
        namespaces.add(id.slice('system.adapter.'.length));
    }
    if (typeof hostNamespace === 'string' && /^eos-admin\.\d+$/.test(hostNamespace)) {
        namespaces.add(`${hostNamespace}.ocpp`);
        const hosted = text(source.hostedNamespace, 120);
        if (/^ocpp21\.\d{1,8}$/.test(hosted))
            namespaces.add(hosted);
    }
    return stations.filter(station => namespaces.has(station.adapterInstance));
}
function rootsOf(row) {
    return [...new Set([...ID_FIELDS.map(key => ocppStationRoot(row[key])), ocppStationRoot(record(row.ocppDiscovery).stationRoot)].filter(Boolean))];
}
/** Only bounded discovery metadata crosses the normalized runtime configuration. */
function normalizeOcppDiscovery(value) {
    const input = record(value);
    const stationRoot = text(input.stationRoot, 200);
    if (input.source !== 'nexowatt-ocpp21' || input.contract !== exports.OCPP_NATIVE_CONTRACT
        || input.controlScope !== 'station' || ocppStationRoot(stationRoot) !== stationRoot
        || !['MAPPED', 'COMMISSIONING_REQUIRED', 'CONTRACT_INCOMPLETE', 'CONTROL_GROUP_CONFLICT', 'MIXED_MANUAL_MAPPING', 'MANUAL_MAPPING_REVIEW_REQUIRED'].includes(String(input.code)))
        return null;
    const count = (item) => typeof item === 'number' && Number.isInteger(item) && item >= 0 && item <= 1024 ? item : null;
    const connectors = Array.isArray(input.connectors) ? input.connectors.slice(0, 1024).map(item => {
        const port = record(item);
        return { evseId: count(port.evseId), connectorId: count(port.connectorId) };
    }).filter(port => port.evseId !== null && port.evseId > 0 && port.connectorId !== null && port.connectorId > 0) : [];
    return { source: 'nexowatt-ocpp21', stationRoot, contract: exports.OCPP_NATIVE_CONTRACT, controlScope: 'station',
        code: input.code, autoCreated: input.autoCreated === true, connectorCount: count(input.connectorCount), evseCount: count(input.evseCount),
        topologySource: text(input.topologySource, 60) || 'unknown', connectors };
}
function knownAliasEquivalent(field, current, canonical, root) {
    const id = text(current, 512);
    if (!id.startsWith('alias.0.') || ocppStationRoot(id) !== root)
        return false;
    const suffix = canonical.slice(root.length + 1).toLowerCase();
    if (id.toLowerCase().endsWith(`.${suffix}`))
        return true;
    const aliases = {
        powerId: ['powerw', 'power'], energyTotalId: ['energykwh', 'energytotal'],
        statusId: ['status'], onlineId: ['socketconnected'], dataFreshId: ['datafresh'],
        setPowerWId: ['chargelimit', 'setpowerw'], enableWriteId: ['availability'],
        heartbeatId: ['lastseenms'], activeId: ['transactionactive'], chargingStateId: ['chargingstate'],
        vehicleSocId: ['socpercent'], rfidReadId: ['rfid'],
    };
    return (aliases[field] || []).some(suffix => id.toLowerCase().endsWith(`.${suffix}`));
}
/** Called inside the shared installer mutation lock with the latest configuration. */
function planOcppDiscovery(configInput, stations, options = {}) {
    const config = record(configInput);
    const settings = record(config.settingsConfig);
    const limit = options.maxRows ?? MAX_ROWS;
    if (!Number.isInteger(limit) || limit < 0)
        throw fail('EOS_OCPP_LICENSE_LIMIT_INVALID');
    const maxRows = Math.min(MAX_ROWS, limit);
    if (settings.evcsList !== undefined && !Array.isArray(settings.evcsList))
        throw fail('EOS_OCPP_CONFIG_INVALID');
    const original = (settings.evcsList || []);
    if (original.length > MAX_ROWS || original.some(row => !row || typeof row !== 'object' || Array.isArray(row)))
        throw fail('EOS_OCPP_CONFIG_INVALID');
    const rows = original.map(row => ({ ...record(row) }));
    const statuses = [];
    if (stations.length > MAX_STATIONS)
        throw fail('EOS_OCPP_DISCOVERY_STATION_LIMIT');
    for (const station of stations) {
        const found = rows.map((row, index) => ({ row, index })).filter(item => rootsOf(item.row).includes(station.root));
        const existing = found[0];
        let code = station.missing.length ? 'CONTRACT_INCOMPLETE' : 'MAPPED';
        if (found.length > 1)
            code = 'CONTROL_GROUP_CONFLICT';
        else if (existing && rootsOf(existing.row).length > 1)
            code = 'MIXED_MANUAL_MAPPING';
        else if (!found.length && rows.length >= maxRows)
            code = maxRows < MAX_ROWS ? 'LICENSE_LIMIT' : 'ROW_LIMIT';
        const blocked = ['CONTROL_GROUP_CONFLICT', 'MIXED_MANUAL_MAPPING', 'ROW_LIMIT', 'LICENSE_LIMIT'].includes(code);
        const index = existing ? existing.index : rows.length;
        // Partial registration is visible, with every verified field filled now; retry completes it later.
        if (!blocked) {
            const next = existing ? { ...existing.row } : { enabled: false, name: station.name, stationKey: station.root, connectorNo: 1 };
            const autoCreated = !existing || record(next.ocppDiscovery).autoCreated === true;
            const manualMonitor = !!existing && !autoCreated && next.enabled !== false
                && empty(next.setCurrentAId) && empty(next.setPowerWId);
            for (const [key, id] of Object.entries(station.ids)) {
                // Discovering an existing monitor must not authorize a first command writer.
                if (manualMonitor && (key === 'setPowerWId' || key === 'enableWriteId'))
                    continue;
                if (key === 'setPowerWId' && !empty(next.setCurrentAId) && empty(next.setPowerWId))
                    continue;
                if (empty(next[key]) || knownAliasEquivalent(key, next[key], id, station.root)) {
                    next[key] = id;
                    if (key === 'energyTotalId')
                        next.energyTotalInputIsWh = false;
                }
            }
            if (empty(next.telemetryProfile))
                next.telemetryProfile = 'nexowattocpp';
            if (empty(next.controlPreference) && empty(next.setCurrentAId) && !manualMonitor)
                next.controlPreference = 'powerW';
            if (code === 'MAPPED' && next.enabled === false)
                code = 'COMMISSIONING_REQUIRED';
            if (manualMonitor)
                code = 'MANUAL_MAPPING_REVIEW_REQUIRED';
            next.ocppDiscovery = { source: 'nexowatt-ocpp21', stationRoot: station.root, contract: exports.OCPP_NATIVE_CONTRACT,
                controlScope: 'station', connectorCount: station.connectorCount, evseCount: station.evseCount,
                topologySource: station.topologySource, connectors: station.connectors, code, autoCreated };
            rows[index] = next;
        }
        statuses.push({ root: station.root, adapterInstance: station.adapterInstance, rowIndex: blocked && !found.length ? null : index,
            code, connectorCount: station.connectorCount, evseCount: station.evseCount, topologySource: station.topologySource, missing: station.missing });
    }
    const count = settings.evcsCount;
    if (count !== undefined && (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > MAX_ROWS))
        throw fail('EOS_OCPP_CONFIG_INVALID');
    const nextCount = Math.max(typeof count === 'number' ? count : 0, rows.length);
    const changed = JSON.stringify(rows) !== JSON.stringify(original) || (rows.length > 0 && count !== nextCount);
    return { changed, patch: changed ? { settingsConfig: { ...settings, evcsList: rows, evcsCount: nextCount } } : {}, statuses };
}
/** Single-flight scans coalesce registration events; periodic retry covers missed events/restarts. */
class OcppAutoDiscovery {
    constructor(options) {
        this.options = options;
        this.stopped = false;
        this.started = false;
        this.dirty = false;
        this.running = null;
        this.metadata = new Map();
        this.view = { state: 'idle', error: '', ts: 0, stations: [] };
    }
    status() { return { ...this.view, stations: this.view.stations.map(item => ({ ...item, missing: [...item.missing] })) }; }
    async start() {
        if (this.started || this.stopped)
            return;
        this.started = true;
        try {
            await this.readBounded(this.options.subscribe());
        }
        catch {
            this.options.warn('EOS_OCPP_SUBSCRIBE_FAILED');
        }
        if (this.stopped)
            return;
        this.poll = setInterval(() => this.request(), this.options.pollMs ?? 60000);
        this.poll.unref?.();
        await this.refresh();
    }
    onStateChange(id, state) {
        const root = ocppStationRoot(id);
        if (!ocppRootInScope(root, this.options.hostNamespace) || !id.startsWith(`${root}.info.`) || !META.has(id.slice(`${root}.info.`.length)))
            return;
        const st = record(state);
        const value = typeof st.val === 'string' ? (st.val.length <= 32768 ? st.val : 'oversized-metadata')
            : typeof st.val === 'boolean' || (typeof st.val === 'number' && Number.isFinite(st.val)) ? st.val : null;
        const signature = JSON.stringify([value, typeof st.q === 'number' ? st.q : null, st.ack === true]);
        if (this.metadata.get(id) === signature)
            return;
        if (this.metadata.size < MAX_STATIONS * META.size)
            this.metadata.set(id, signature);
        this.request();
    }
    request() {
        if (this.stopped || !this.started)
            return;
        this.dirty = true;
        if (this.running || this.timer)
            return;
        this.timer = setTimeout(() => { this.timer = undefined; void this.refresh(); }, this.options.debounceMs ?? 500);
        this.timer.unref?.();
    }
    async refresh() {
        if (this.stopped)
            return;
        this.dirty = true;
        if (this.running)
            return this.running;
        this.running = this.drain();
        try {
            await this.running;
        }
        finally {
            this.running = null;
            if (this.dirty && !this.stopped)
                this.request();
        }
    }
    async readBounded(operation) {
        let timer;
        try {
            return await Promise.race([operation, new Promise((_resolve, reject) => {
                    timer = setTimeout(() => reject(fail('EOS_OCPP_DISCOVERY_TIMEOUT')), 5000);
                })]);
        }
        finally {
            if (timer)
                clearTimeout(timer);
        }
    }
    async drain() {
        // Bound one event burst; further work yields to the regular event loop.
        for (let pass = 0; pass < 2 && this.dirty && !this.stopped; pass++) {
            this.dirty = false;
            if (!this.options.canRun()) {
                this.view = { ...this.view, state: 'blocked', error: 'EOS_OCPP_RUNTIME_NOT_READY' };
                return;
            }
            try {
                const [objects, states, sources] = await Promise.all([this.readBounded(this.options.readObjects()),
                    this.readBounded(this.options.readMetadata()),
                    this.options.readSources ? this.readBounded(this.options.readSources()) : Promise.resolve(undefined)]);
                if (this.stopped || !this.options.canRun())
                    return;
                const collected = collectOcppStations(objects, states, this.options.hostNamespace);
                const stations = this.options.readSources
                    ? filterOcppDiscoverySources(collected, sources, this.options.hostNamespace) : collected;
                const plan = await this.options.reconcile(stations);
                if (this.stopped)
                    return;
                this.view = { state: 'ready', error: '', ts: Date.now(), stations: plan.statuses };
            }
            catch (error) {
                if (this.stopped)
                    return;
                const code = error instanceof Error && /^EOS_[A-Z0-9_]+$/.test(error.message) ? error.message : 'EOS_OCPP_DISCOVERY_FAILED';
                if (this.view.error !== code)
                    this.options.warn(code);
                this.view = { ...this.view, state: 'pending', error: code };
                if (!this.timer) {
                    this.timer = setTimeout(() => { this.timer = undefined; void this.refresh(); }, 5000);
                    this.timer.unref?.();
                }
            }
        }
    }
    async stop() {
        this.stopped = true;
        this.dirty = false;
        if (this.timer)
            clearTimeout(this.timer);
        if (this.poll)
            clearInterval(this.poll);
        this.timer = undefined;
        this.poll = undefined;
        await this.running;
        this.metadata.clear();
        this.view = { ...this.view, state: 'stopped' };
    }
}
exports.OcppAutoDiscovery = OcppAutoDiscovery;
