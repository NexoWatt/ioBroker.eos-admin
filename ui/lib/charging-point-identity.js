/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/charging-point-identity.ts
 * Quell-Hash: sha256:6db008926f84201dda3c8ef6f3391e56fcda0f771eb61fda7b14bf210b6c3f93
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/charging-point-identity.js.
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
exports.getChargingControlIdentity = exports.CHARGING_IDENTITY_STATE = void 0;
exports.beginChargingControlWrite = beginChargingControlWrite;
exports.chargingPointLayout = chargingPointLayout;
exports.remapChargingPointDefaultModes = remapChargingPointDefaultModes;
exports.chargingPointLayoutChanged = chargingPointLayoutChanged;
exports.publicChargingControlIdentity = publicChargingControlIdentity;
exports.assertChargingControlIdentity = assertChargingControlIdentity;
exports.synchronizeChargingPointIdentity = synchronizeChargingPointIdentity;
exports.bindChargingPointIdentityBaseline = bindChargingPointIdentityBaseline;
/** Stable ownership of index-based charging wishes during configuration changes. */
const node_crypto_1 = require("node:crypto");
const ems_control_values_1 = require("./ems-control-values");
exports.CHARGING_IDENTITY_STATE = 'chargingManagement.controlIdentityRegistry';
const MAX_ROWS = 50;
const MAX_BYTES = 131072;
const timers = ['chargingSince', 'boostSince', 'boostUntil', 'boostRemainingMin', 'boostActive'];
const fields = [...ems_control_values_1.EMS_CONTROL_FIELDS, ...timers, 'legacyMode'];
const reservations = new WeakMap();
const confirmed = new WeakMap();
const record = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const fail = (code) => Object.assign(new Error(code), { code });
function reservation(adapter) {
    let state = reservations.get(adapter);
    if (!state) {
        state = { pending: new Set() };
        reservations.set(adapter, state);
    }
    return state;
}
/** Synchronous admission before an HTTP/state-mirror operation's first await. */
function beginChargingControlWrite(adapter) {
    const state = reservation(adapter);
    if (adapter._nwEvcsIdentityTransitionPending || adapter._nwMeshAppSaveInProgress || adapter._nwShuttingDown || state.pending.size >= 64) {
        throw fail('EOS_EVCS_IDENTITY_BUSY');
    }
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    state.pending.add(pending);
    let completed = false;
    return () => {
        if (completed)
            return;
        completed = true;
        state.pending.delete(pending);
        release?.();
    };
}
function rowsOf(input) {
    if (!Array.isArray(input) || input.length > MAX_ROWS || !input.every(record))
        throw fail('EOS_EVCS_IDENTITY_LAYOUT_INVALID');
    return input;
}
/** No names, array positions or credentials are stored as physical identity. */
function identity(row, slot, namespace) {
    for (const key of ['setPowerWId', 'setCurrentAId', 'enableWriteId', 'powerId', 'energyTotalId', 'statusId', 'onlineId', 'activeId', 'lockWriteId', 'phaseSwitchId', 'modeId']) {
        const value = row[key];
        if (value === undefined || value === null || value === '')
            continue;
        if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value))
            throw fail('EOS_EVCS_IDENTITY_LAYOUT_INVALID');
        const target = value.trim();
        if (!target)
            continue;
        if (key === 'modeId' && target === `${namespace}.evcs.${slot}.mode`)
            continue;
        const connector = row.connectorNo === undefined || row.connectorNo === null || row.connectorNo === '' || Number(row.connectorNo) === 0 ? 1 : Number(row.connectorNo);
        if (!Number.isSafeInteger(connector) || connector < 1 || connector > 1024)
            throw fail('EOS_EVCS_IDENTITY_LAYOUT_INVALID');
        return (0, node_crypto_1.createHash)('sha256').update(JSON.stringify([target, connector])).digest('hex');
    }
    return null;
}
function commandIdentity(row, slot, namespace, bridges) {
    const targets = [];
    for (const key of ['setPowerWId', 'setCurrentAId', 'enableWriteId', 'activeId', 'lockWriteId', 'phaseSwitchId', 'modeId']) {
        const value = row[key];
        if (value === undefined || value === null || value === '')
            continue;
        if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value))
            throw fail('EOS_EVCS_IDENTITY_LAYOUT_INVALID');
        const target = value.trim();
        if (!target || (key === 'modeId' && target === `${namespace}.evcs.${slot}.mode`))
            continue;
        targets.push([key, target]);
    }
    return (0, node_crypto_1.createHash)('sha256').update(JSON.stringify([targets, bridges])).digest('hex');
}
/** A configured generic bridge is also a real command destination. */
function scalarText(value) {
    if (value === undefined || value === null)
        return '';
    if (typeof value !== 'string' && typeof value !== 'number')
        throw fail('EOS_EVCS_IDENTITY_LAYOUT_INVALID');
    return String(value);
}
function bridgeTargets(rows, slot, kiosk) {
    if (!record(kiosk) || kiosk.stations === undefined)
        return [];
    if (!Array.isArray(kiosk.stations) || kiosk.stations.length > 100 || !kiosk.stations.every(record))
        throw fail('EOS_EVCS_IDENTITY_LAYOUT_INVALID');
    const lp = `lp${slot}`, targets = [];
    const safeId = (value) => scalarText(value || '').trim().toLowerCase().replace(/[^a-z0-9_\-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64) || 'station';
    for (const [index, station] of kiosk.stations.entries()) {
        const bridge = scalarText(station.controlBridge || station.commandBridge || '').trim().toLowerCase();
        const profile = scalarText(station.controlProfile || station.controlBackend || (bridge === 'generic' ? 'commandState' : 'chargingManagement')).trim().toLowerCase();
        if (!['json', 'commandstate', 'command-state', 'external', 'bridge', 'generic', 'ocpp', 'modbus', 'mqtt', 'vendor', 'manufacturer', 'hersteller', 'nexowatt-devices', 'dual', 'both', 'mirror', 'hybrid'].includes(profile))
            continue;
        const raw = station.commandStateId || station.commandObjectId;
        if (raw === undefined || raw === null || raw === '')
            continue;
        if (typeof raw !== 'string' || raw.length > 2048 || /[\u0000-\u001f\u007f]/.test(raw))
            throw fail('EOS_EVCS_IDENTITY_LAYOUT_INVALID');
        const stationKey = scalarText(station.stationKey || station.infrastructureStationKey || '').trim();
        const automatic = rows.flatMap((row, i) => row.enabled !== false && stationKey && row.stationKey === stationKey ? [`lp${i + 1}`] : []);
        const manual = Array.isArray(station.assignedChargepoints) ? station.assignedChargepoints : Array.isArray(station.chargepoints) ? station.chargepoints : Array.isArray(station.lps) ? station.lps : [];
        if (manual.length > MAX_ROWS)
            throw fail('EOS_EVCS_IDENTITY_LAYOUT_INVALID');
        const normalized = manual.map(value => {
            const match = /^(?:lp|ladepunkt|connector|evcs)?\s*([0-9]+)$/i.exec(scalarText(value).trim());
            return match ? `lp${Math.max(1, Math.round(Number(match[1]) || 1))}` : '';
        });
        const mode = scalarText(station.assignmentMode || station.assignmentSource || (stationKey ? 'station' : 'manual')).trim().toLowerCase();
        if (!(mode !== 'manual' && automatic.length ? automatic : normalized).includes(lp))
            continue;
        const id = safeId(station.id || station.key || station.stationId || stationKey || `dc_station_${index + 1}`);
        const target = raw.trim().replace(/\{lp\}/g, lp).replace(/\{stationId\}|\{station\}/g, id);
        if (target)
            targets.push(JSON.stringify([target, id, lp]));
    }
    return [...new Set(targets)].sort();
}
function chargingPointLayout(input, kiosk, namespace = 'eos-admin.0') {
    const rows = rowsOf(input);
    const layout = rows.map((row, index) => {
        const slot = index + 1, bridges = bridgeTargets(rows, slot, kiosk);
        // An unmapped row has no physical device identifier. Bind its explicit
        // bridge and configured label conservatively; renaming it requires refresh.
        const physical = identity(row, slot, namespace);
        const fallback = bridges.length ? (0, node_crypto_1.createHash)('sha256').update(JSON.stringify(['bridge', bridges, scalarText(row.name || `Ladepunkt ${slot}`).trim()])).digest('hex') : null;
        return { slot, identity: physical || fallback, commands: commandIdentity(row, slot, namespace, bridges) };
    });
    const identities = layout.map(item => item.identity).filter(item => item !== null);
    if (new Set(identities).size !== identities.length)
        throw fail('EOS_EVCS_IDENTITY_AMBIGUOUS');
    return layout;
}
/** Move only a carried-forward, proven own default mirror with its device. */
function remapChargingPointDefaultModes(previous, next, namespace) {
    const oldRows = rowsOf(previous), nextRows = rowsOf(next);
    const oldByIdentity = new Map(oldRows.flatMap((row, index) => {
        const key = identity(row, index + 1, namespace);
        return key ? [[key, { row, slot: index + 1 }]] : [];
    }));
    let changed = false;
    const mapped = nextRows.map((row, index) => {
        const key = identity(row, index + 1, namespace), old = key ? oldByIdentity.get(key) : undefined;
        if (!old || old.slot === index + 1 || old.row.modeId !== `${namespace}.evcs.${old.slot}.mode` || row.modeId !== old.row.modeId)
            return row;
        changed = true;
        return { ...row, modeId: `${namespace}.evcs.${index + 1}.mode` };
    });
    return changed ? mapped : nextRows;
}
function chargingPointLayoutChanged(previous, next, previousKiosk, nextKiosk, namespace = 'eos-admin.0') {
    return JSON.stringify(chargingPointLayout(previous, previousKiosk, namespace)) !== JSON.stringify(chargingPointLayout(next, nextKiosk, namespace));
}
function sameLayout(previous, next) {
    return previous.length === next.length && previous.every((slot, index) => slot.slot === next[index]?.slot && slot.identity === next[index]?.identity && slot.commands === next[index]?.commands);
}
function changedSlots(previous, next) {
    return Array.from({ length: Math.max(previous.length, next.length) }, (_, index) => index + 1)
        .filter(slot => !previous[slot - 1] || !next[slot - 1] || previous[slot - 1]?.identity !== next[slot - 1]?.identity || previous[slot - 1]?.commands !== next[slot - 1]?.commands);
}
function bindLayout(next, previous = []) {
    return next.map(slot => ({ ...slot, token: slot.identity === null ? null : previous[slot.slot - 1]?.identity === slot.identity && previous[slot.slot - 1]?.commands === slot.commands
            ? previous[slot.slot - 1]?.token || (0, node_crypto_1.randomUUID)() : (0, node_crypto_1.randomUUID)() }));
}
/** Only a confirmed layout can be paired with displayed points and commands. */
function publicChargingControlIdentity(adapter, rows) {
    const value = confirmed.get(adapter);
    if (!value || adapter._nwEvcsIdentityTransitionPending)
        return { revision: '', slots: {} };
    if (rows !== undefined) {
        try {
            if (!sameLayout(value.layout, chargingPointLayout(rows, adapter.config?.chargeKiosk, adapter.namespace)))
                return { revision: '', slots: {} };
        }
        catch {
            return { revision: '', slots: {} };
        }
    }
    return { revision: value.revision, slots: Object.fromEntries(value.layout.flatMap(slot => slot.token ? [[`lp${slot.slot}`, slot.token]] : [])) };
}
exports.getChargingControlIdentity = publicChargingControlIdentity;
/** Old clients remain compatible only where their index has never been reused. */
function assertChargingControlIdentity(adapter, slot, request) {
    const value = confirmed.get(adapter);
    if (!value || adapter._nwEvcsIdentityTransitionPending || !record(request))
        throw fail('EOS_EVCS_IDENTITY_CHANGED');
    const suppliedLayout = request.expectedChargingLayoutRevision;
    if (suppliedLayout !== undefined && suppliedLayout !== value.revision)
        throw fail('EOS_EVCS_IDENTITY_CHANGED');
    if (slot === null) {
        if (value.layoutChanged && suppliedLayout !== value.revision)
            throw fail('EOS_EVCS_IDENTITY_CHANGED');
        return;
    }
    const match = /^lp([1-9]\d?)$/.exec(slot);
    const index = match ? Number(match[1]) : 0;
    const target = value.layout[index - 1];
    if (!target?.token || !target.identity)
        throw fail('EOS_EVCS_IDENTITY_CHANGED');
    const supplied = request.expectedChargingIdentity;
    if (supplied !== undefined ? supplied !== target.token : value.protectedSlots.includes(index))
        throw fail('EOS_EVCS_IDENTITY_CHANGED');
}
function validLayout(value) {
    if (!Array.isArray(value) || value.length > MAX_ROWS)
        return false;
    const seen = new Set(), tokens = new Set();
    return value.every((entry, index) => {
        if (!record(entry) || Object.keys(entry).sort().join(',') !== 'commands,identity,slot,token' || entry.slot !== index + 1 ||
            typeof entry.commands !== 'string' || !/^[a-f0-9]{64}$/.test(entry.commands))
            return false;
        if (entry.identity === null)
            return entry.token === null;
        if (typeof entry.identity !== 'string' || !/^[a-f0-9]{64}$/.test(entry.identity) || seen.has(entry.identity))
            return false;
        if (typeof entry.token !== 'string' || !/^[a-f0-9-]{36}$/.test(entry.token) || tokens.has(entry.token))
            return false;
        tokens.add(entry.token);
        seen.add(entry.identity);
        return true;
    });
}
function validValue(field, value) {
    if (field === 'boostActive')
        return typeof value === 'boolean';
    if (field === 'boostRemainingMin')
        return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1000000;
    if (field === 'chargingSince' || field === 'boostSince' || field === 'boostUntil') {
        return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;
    }
    return (0, ems_control_values_1.validEmsControlValue)(field, value);
}
function validValues(value) {
    return record(value) && Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field) && validValue(field, value[field]));
}
function parseRegistry(state) {
    if (state === null || state === undefined || (record(state) && (state.val === null || state.val === undefined || state.val === '')))
        return null;
    if (!record(state) || typeof state.val !== 'string' || Buffer.byteLength(state.val) > MAX_BYTES)
        throw fail('EOS_EVCS_IDENTITY_REGISTRY_INVALID');
    let value;
    try {
        value = JSON.parse(state.val);
    }
    catch {
        throw fail('EOS_EVCS_IDENTITY_REGISTRY_INVALID');
    }
    if (!record(value) || value.schema !== 1 || typeof value.revision !== 'string' || !/^[a-f0-9-]{36}$/.test(value.revision) ||
        !validLayout(value.layout) || typeof value.layoutChanged !== 'boolean' || !Array.isArray(value.protectedSlots) ||
        value.protectedSlots.length > MAX_ROWS || !value.protectedSlots.every(slot => typeof slot === 'number' && Number.isInteger(slot) && slot >= 1 && slot <= MAX_ROWS) ||
        new Set(value.protectedSlots).size !== value.protectedSlots.length || (value.layoutChanged === false && value.protectedSlots.length > 0) ||
        Object.keys(value).some(key => !['schema', 'revision', 'layout', 'journal', 'protectedSlots', 'layoutChanged'].includes(key))) {
        throw fail('EOS_EVCS_IDENTITY_REGISTRY_INVALID');
    }
    const registry = { schema: 1, revision: value.revision, layout: value.layout, protectedSlots: value.protectedSlots, layoutChanged: value.layoutChanged };
    if (value.journal !== undefined) {
        const journal = value.journal;
        if (!record(journal) || Object.keys(journal).sort().join(',') !== 'sourceRevision,target,targetRevision,writes' ||
            journal.sourceRevision !== value.revision || typeof journal.targetRevision !== 'string' || !/^[a-f0-9-]{36}$/.test(journal.targetRevision) ||
            !validLayout(journal.target) || !Array.isArray(journal.writes) || journal.writes.length > MAX_ROWS)
            throw fail('EOS_EVCS_IDENTITY_JOURNAL_INVALID');
        const writes = [], seen = new Set();
        for (const item of journal.writes) {
            if (!record(item) || Object.keys(item).sort().join(',') !== 'slot,values' || typeof item.slot !== 'number' ||
                !Number.isInteger(item.slot) || item.slot < 1 || item.slot > MAX_ROWS || seen.has(item.slot) || !validValues(item.values)) {
                throw fail('EOS_EVCS_IDENTITY_JOURNAL_INVALID');
            }
            seen.add(item.slot);
            writes.push({ slot: item.slot, values: item.values });
        }
        const required = changedSlots(registry.layout, journal.target);
        if (!required.length || required.length !== writes.length || required.some(slot => !seen.has(slot)))
            throw fail('EOS_EVCS_IDENTITY_JOURNAL_INVALID');
        for (const slot of journal.target) {
            const previous = registry.layout[slot.slot - 1];
            if (previous?.identity === slot.identity && previous.commands === slot.commands ? previous.token !== slot.token : !!slot.token && registry.layout.some(old => old.token === slot.token)) {
                throw fail('EOS_EVCS_IDENTITY_JOURNAL_INVALID');
            }
        }
        registry.journal = { sourceRevision: journal.sourceRevision, targetRevision: journal.targetRevision, target: journal.target, writes };
    }
    return registry;
}
function stateId(slot, field) {
    return field === 'legacyMode' ? `evcs.${slot}.mode` : `chargingManagement.wallboxes.lp${slot}.${field}`;
}
function defaults(row) {
    const mode = row && (0, ems_control_values_1.validEmsControlValue)('userMode', row.userMode) && row.userMode !== '' ? String(row.userMode) : 'auto';
    const phase = row && (0, ems_control_values_1.validEmsControlValue)('userPhaseMode', row.phaseMode) && row.phaseMode !== '' ? String(row.phaseMode) : '';
    return { userMode: mode, userAutoSource: 'standard', userPhaseMode: phase,
        userEnabled: !!row, userStationEnabled: !!row, userStorageAssistEnabled: false,
        goalEnabled: false, goalTargetSocPct: 100, goalFinishTs: 0, goalBatteryKwh: 0,
        chargingSince: 0, boostSince: 0, boostUntil: 0, boostRemainingMin: 0, boostActive: false,
        legacyMode: mode === 'boost' ? 1 : mode === 'minpv' ? 2 : mode === 'pv' ? 3 : 0 };
}
async function drained(state) {
    if (!state.pending.size)
        return;
    let timer;
    try {
        await Promise.race([Promise.all([...state.pending]), new Promise((_resolve, reject) => {
                timer = setTimeout(() => reject(fail('EOS_EVCS_IDENTITY_DRAIN_TIMEOUT')), 5000);
            })]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
async function writeConfirmed(adapter, id, value) {
    if (adapter._nwShuttingDown)
        throw fail('EOS_EVCS_IDENTITY_STOPPED');
    await adapter.setStateAsync(id, { val: value, ack: true });
    const stored = await adapter.getStateAsync(id);
    if (!record(stored) || stored.val !== value || stored.ack !== true)
        throw fail('EOS_EVCS_IDENTITY_COMMIT_UNCONFIRMED');
    const now = Date.now();
    if (adapter.stateCache) {
        adapter.stateCache[id] = { value, ts: now };
        adapter.stateCache[`${adapter.namespace}.${id}`] = { value, ts: now };
    }
    adapter.updateValue?.(id, value, now);
}
async function saveRegistry(adapter, registry) {
    const encoded = JSON.stringify(registry);
    if (Buffer.byteLength(encoded) > MAX_BYTES)
        throw fail('EOS_EVCS_IDENTITY_JOURNAL_LIMIT');
    await writeConfirmed(adapter, exports.CHARGING_IDENTITY_STATE, encoded);
    if (!registry.journal)
        confirmed.set(adapter, registry);
}
async function copyJournal(adapter, registry) {
    const journal = registry.journal;
    if (!journal)
        throw fail('EOS_EVCS_IDENTITY_JOURNAL_INVALID');
    // Four in-flight state writes at most; complete the accepted batch even
    // after one failure. A replacement engine cannot run against partial data.
    const writes = journal.writes.flatMap(item => fields.map(field => ({ id: stateId(item.slot, field), field, value: item.values[field] })));
    for (let index = 0; index < writes.length; index += 4) {
        const settled = await Promise.allSettled(writes.slice(index, index + 4).map(async (write) => {
            await adapter.setObjectNotExistsAsync(write.id, { type: 'state', common: { name: write.field,
                    type: typeof write.value, role: 'state', read: true, write: !timers.some(field => field === write.field) }, native: {} });
            await writeConfirmed(adapter, write.id, write.value);
        }));
        const failed = settled.find(result => result.status === 'rejected');
        if (failed?.status === 'rejected')
            throw failed.reason;
    }
    const protectedSlots = [...new Set([...registry.protectedSlots,
            ...changedSlots(registry.layout, journal.target).filter(slot => !!registry.layout[slot - 1])])].sort((a, b) => a - b);
    await saveRegistry(adapter, { schema: 1, revision: journal.targetRevision, layout: journal.target, protectedSlots, layoutChanged: true });
}
async function synchronize(adapter, input, state, baseline, desired, desiredKiosk) {
    await drained(state);
    const rows = rowsOf(input), target = chargingPointLayout(rows, adapter.config?.chargeKiosk, adapter.namespace);
    await adapter.setObjectNotExistsAsync(exports.CHARGING_IDENTITY_STATE, { type: 'state', common: {
            name: 'Ladepunkt-Bedienwerte: Identitätsregister', type: 'string', role: 'json', read: true, write: false
        }, native: {},
        acl: { owner: 'system.user.admin', ownerGroup: 'system.group.administrator', object: 0x600, state: 0x600 } });
    const registry = parseRegistry(await adapter.getStateAsync(exports.CHARGING_IDENTITY_STATE));
    if (!registry) {
        // First upgrade binds existing wishes to the currently configured points.
        // Never guess an earlier layout or erase an operator's chosen mode.
        await saveRegistry(adapter, { schema: 1, revision: (0, node_crypto_1.randomUUID)(), layout: bindLayout(target), protectedSlots: [], layoutChanged: false });
        return true;
    }
    if (baseline) {
        if (registry.journal) {
            if (!sameLayout(registry.journal.target, chargingPointLayout(desired === undefined ? input : desired, desired === undefined ? adapter.config?.chargeKiosk : desiredKiosk, adapter.namespace)))
                throw fail('EOS_EVCS_IDENTITY_RECOVERY_LAYOUT_MISMATCH');
            return false;
        }
        confirmed.set(adapter, registry);
        return true;
    }
    if (registry.journal) {
        if (!sameLayout(registry.journal.target, target))
            throw fail('EOS_EVCS_IDENTITY_RECOVERY_LAYOUT_MISMATCH');
        await copyJournal(adapter, registry);
        return true;
    }
    if (sameLayout(registry.layout, target)) {
        confirmed.set(adapter, registry);
        return true;
    }
    const writes = [];
    for (let slot = 1; slot <= Math.max(registry.layout.length, target.length); slot++) {
        const previous = registry.layout[slot - 1], next = target[slot - 1];
        if (previous && next && previous.identity === next.identity && previous.commands === next.commands)
            continue;
        const source = next?.identity ? registry.layout.find(item => item.identity === next.identity) : undefined;
        const values = defaults(rows[slot - 1]);
        if (source) {
            for (const field of fields) {
                const old = await adapter.getStateAsync(stateId(source.slot, field));
                if (old === null || old === undefined || (record(old) && (old.val === null || old.val === undefined)))
                    continue;
                if (!record(old) || !validValue(field, old.val))
                    throw fail('EOS_EVCS_IDENTITY_CONTROL_INVALID');
                values[field] = old.val;
            }
        }
        writes.push({ slot, values });
    }
    const prepared = { ...registry, journal: { sourceRevision: registry.revision, targetRevision: (0, node_crypto_1.randomUUID)(), target: bindLayout(target, registry.layout), writes } };
    await saveRegistry(adapter, prepared);
    await copyJournal(adapter, prepared);
    return true;
}
/** Called after old engine drain, before any replacement module initializes. */
function run(adapter, rows, baseline, desired, desiredKiosk) {
    const state = reservation(adapter);
    adapter._nwEvcsIdentityTransitionPending = true;
    const target = JSON.stringify([baseline, chargingPointLayout(rows, adapter.config?.chargeKiosk, adapter.namespace), desired === undefined ? null : chargingPointLayout(desired, desiredKiosk, adapter.namespace)]);
    if (state.operation)
        return state.target === target ? state.operation : Promise.reject(fail('EOS_EVCS_IDENTITY_BUSY'));
    const operation = synchronize(adapter, rows, state, baseline, desired, desiredKiosk).then(completed => { adapter._nwEvcsIdentityTransitionPending = !completed; });
    state.operation = operation;
    state.target = target;
    const complete = () => { if (state.operation === operation) {
        delete state.operation;
        delete state.target;
    } };
    void operation.then(complete, complete);
    return operation;
}
function synchronizeChargingPointIdentity(adapter, rows) {
    return run(adapter, rows, false);
}
/** Seed only a previously missing registry before the first configuration commit. */
function bindChargingPointIdentityBaseline(adapter, rows, desired, desiredKiosk) {
    return run(adapter, rows, true, desired, desiredKiosk);
}
