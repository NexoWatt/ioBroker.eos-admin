/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/ems/modules/prime-mover-control.ts
 * Quell-Hash: sha256:3f1030aba5b5f1e62a544da0f09dcecd353268007757398e3c7fdda3064afd79
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für ems/modules/prime-mover-control.js.
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
 * Aufgabe: Kapselt gemeinsame Betriebs- und Leistungsanforderungen steuerbarer Erzeuger.
 * Daten und Wirkung: Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.
 * Bei Änderungen: Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.
 * Verknüpfungen: docs/quellcode/src-ts/runtime-executables/ems/modules/prime-mover-control.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimeMoverControlModule = void 0;
const { BaseModule } = require('./base');
const { withActuatorShadowContext, priorityForOwner, isActuatorAuthorityBlockedResult, } = require('../services/actuator-shadow-arbiter');
const { ActuatorCommandContract } = require('../services/actuator-command-contract');
const { resolveCurrentNvpSnapshot } = require('../services/measurement-freshness');
const { recordAcceptedActuatorTransition } = require('../services/accepted-power-effects');
function numberOr(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function finiteNumberOrNull(value) {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean')
        return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}
function bounded(value, fallback, min, max) {
    return Math.max(min, Math.min(max, numberOr(value, fallback)));
}
function text(value) {
    return String(value === undefined || value === null ? '' : value).trim();
}
function parseBoolean(value) {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'number')
        return value !== 0;
    const normalized = text(value).toLowerCase();
    if (['1', 'true', 'on', 'ein', 'running', 'run', 'active'].includes(normalized))
        return true;
    if (['0', 'false', 'off', 'aus', 'stopped', 'stop', 'inactive'].includes(normalized))
        return false;
    return null;
}
function stateTimestamp(state, field) {
    const value = Number(state && state[field]);
    return Number.isFinite(value) && value > 0 ? value : null;
}
function normalizeCommandProfile(raw) {
    const value = text(raw).toLowerCase();
    if (['runlevel', 'run-level', 'run', 'single-level', 'singlelevel', 'enable'].includes(value))
        return 'run-level';
    if (['level', 'duallevel', 'dual-level', 'two-wire', 'twowire'].includes(value))
        return 'dual-level';
    return 'pulse';
}
function emptySnapshot(mapped = false) {
    return { mapped, present: false, fresh: false, value: null, ageMs: null, changeAgeMs: null, ts: null, lc: null };
}
class PrimeMoverControlModule extends BaseModule {
    constructor(adapter, dpRegistry, spec) {
        super(adapter, dpRegistry);
        this.devices = [];
        this.runtime = new Map();
        this.actuatorContract = new ActuatorCommandContract();
        this.stateCache = new Map();
        this.pendingPulses = new Map();
        this.loadedPulseState = new Set();
        this.maxDevices = 10;
        this.inited = false;
        this.adapter = adapter;
        this.dp = dpRegistry || null;
        this.spec = spec;
    }
    async init() {
        await this.ensureObjects();
        await this.loadConfig();
        for (const device of this.devices)
            await this.restorePulse(device);
        this.inited = true;
    }
    root() { return this.spec.kind; }
    deviceId(index) { return `${this.spec.devicePrefix}${index}`; }
    deviceBase(device) { return `${this.root()}.devices.${device.id}`; }
    userBase(device) { return `${this.root()}.user.${device.id}`; }
    automaticOwner(device) { return `${this.root()}.${device.id}`; }
    manualOwner(device) { return `manual.${this.root()}.${device.id}`; }
    async ensureObjects() {
        const channel = (id, name) => this.adapter.setObjectNotExistsAsync(id, { type: 'channel', common: { name }, native: {} });
        const state = (id, name, type, role, writable = false, defaultValue, unit = '') => {
            const common = { name, type, role, read: true, write: writable };
            if (defaultValue !== undefined)
                common.def = defaultValue;
            if (unit)
                common.unit = unit;
            return this.adapter.setObjectNotExistsAsync(id, { type: 'state', common, native: {} });
        };
        await channel(this.root(), this.spec.label);
        await channel(`${this.root()}.devices`, `${this.spec.label} Geraete`);
        await channel(`${this.root()}.user`, `${this.spec.label} Bedienung`);
        const definitions = [
            ['running', 'Laeuft', 'boolean', 'indicator.running', false, ''],
            ['runningFresh', 'Laufstatus frisch', 'boolean', 'indicator', false, ''],
            ['runningAgeMs', 'Alter Laufstatus', 'number', 'value.interval', null, 'ms'],
            ['runningSource', 'Quelle Laufstatus', 'string', 'text', '', ''],
            ['powerW', 'Leistung', 'number', 'value.power', null, 'W'],
            ['powerFresh', 'Leistung frisch', 'boolean', 'indicator', false, ''],
            ['powerAgeMs', 'Alter Leistung', 'number', 'value.interval', null, 'ms'],
            ['socPct', 'SoC', 'number', 'value.battery', null, '%'],
            ['socFresh', 'SoC frisch', 'boolean', 'indicator', false, ''],
            ['socAgeMs', 'Alter SoC', 'number', 'value.interval', null, 'ms'],
            ['socSource', 'SoC Quelle', 'string', 'text', '', ''],
            ['nvpW', 'NVP Leistung', 'number', 'value.power', null, 'W'],
            ['nvpFresh', 'NVP frisch', 'boolean', 'indicator', false, ''],
            ['nvpStatus', 'NVP Status', 'string', 'text', '', ''],
            ['centralBudgetStatus', 'Einbindung zentrales EMS', 'string', 'text', '', ''],
            ['status', 'Status', 'string', 'text', '', ''],
            ['reason', 'Grund', 'string', 'text', '', ''],
            ['lastCommand', 'Letzter Befehl', 'string', 'text', '', ''],
            ['lastCommandTs', 'Letzter Befehl Zeitstempel', 'number', 'value.time', 0, ''],
            ['stateSinceTs', 'Realer Zustand seit', 'number', 'value.time', 0, ''],
            ['stateReconstructed', 'Zustand nach Neustart rekonstruiert', 'boolean', 'indicator', false, ''],
            ['owner', 'Aktor Owner', 'string', 'text', '', ''],
            ['requestedCommand', 'Angeforderter Befehl', 'string', 'text', '', ''],
            ['writeAccepted', 'Write akzeptiert', 'boolean', 'indicator', false, ''],
            ['writeConfirmed', 'Write durch Readback bestaetigt', 'boolean', 'indicator', false, ''],
            ['readbackOk', 'Readback bestaetigt', 'boolean', 'indicator', false, ''],
            ['readbackFresh', 'Readback frisch', 'boolean', 'indicator', false, ''],
            ['readbackAgeMs', 'Alter Readback', 'number', 'value.interval', null, 'ms'],
            ['writePending', 'Write ausstehend', 'boolean', 'indicator', false, ''],
            ['retryCount', 'Wiederholungen', 'number', 'value', 0, ''],
            ['faultLocked', 'Fehlerverriegelung', 'boolean', 'indicator', false, ''],
            ['faultUntil', 'Fehlerverriegelung bis', 'number', 'value.time', 0, ''],
            ['pulseResetPending', 'Ausstehende Rücknahme eines Start-/Stoppimpulses', 'string', 'json', '', ''],
            ['writeContractStatus', 'Aktor Vertragsstatus', 'string', 'text', '', ''],
            ['minRunRemainingSec', 'Verbleibende Mindestlaufzeit', 'number', 'value.interval', 0, 's'],
            ['minOffRemainingSec', 'Verbleibender Mindeststillstand', 'number', 'value.interval', 0, 's'],
        ];
        for (let index = 1; index <= this.maxDevices; index++) {
            const id = this.deviceId(index);
            const base = `${this.root()}.devices.${id}`;
            const user = `${this.root()}.user.${id}`;
            await channel(base, `${this.spec.label} ${index}`);
            await channel(user, `${this.spec.label} ${index} Bedienung`);
            for (const [suffix, name, type, role, defaultValue, unit] of definitions) {
                await state(`${base}.${suffix}`, name, type, role, false, defaultValue, unit);
            }
            await state(`${user}.mode`, 'Modus auto/manual/off', 'string', 'text', true, 'auto');
            await state(`${user}.command`, 'Befehl start/stop', 'string', 'text', true, '');
        }
    }
    async loadConfig() {
        const rootConfig = this.adapter?.config?.[this.spec.kind];
        const config = rootConfig && typeof rootConfig === 'object' ? rootConfig : {};
        const rows = Array.isArray(config.devices) ? config.devices : [];
        const used = new Set();
        const devices = [];
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            const row = rows[rowIndex] || {};
            const index = Math.max(1, Math.min(this.maxDevices, Math.round(numberOr(row.idx ?? row.index, rowIndex + 1))));
            if (used.has(index))
                continue;
            used.add(index);
            const runningReadId = text(row.runningReadId || row.runningObjectId || row.runningId);
            const powerReadId = text(row.powerReadId || row.powerObjectId || row.powerId);
            const device = {
                idx: index,
                id: this.deviceId(index),
                enabled: row.enabled === true,
                name: text(row.name) || `${this.spec.label} ${index}`,
                showInLive: row.showInLive !== false,
                userCanControl: row.userCanControl !== false,
                startWriteId: text(row.startWriteId || row.startObjectId || row.startId),
                stopWriteId: text(row.stopWriteId || row.stopObjectId || row.stopId),
                runWriteId: text(row.runWriteId || row.runObjectId || row.enableWriteId || row.enableId),
                runningReadId,
                powerReadId,
                powerScale: bounded(row.powerScale, 1, 0.000001, 1000000),
                socStartPct: bounded(row.socStartPct, 25, 0, 100),
                socStopPct: bounded(row.socStopPct, 60, 0, 100),
                minRunMin: bounded(row.minRunMin, 10, 0, 1440),
                minOffMin: bounded(row.minOffMin, 5, 0, 1440),
                measurementMaxAgeMs: Math.round(bounded(row.maxAgeSec, 30, 1, 3600) * 1000),
                socMaxAgeMs: Math.round(bounded(row.socMaxAgeSec, 60, 1, 3600) * 1000),
                runningPowerThresholdW: Math.max(0, numberOr(row.runningPowerThresholdW, 100)),
                commandProfile: normalizeCommandProfile(row.commandType || row.commandProfile || row.cmdType),
                pulseMs: Math.round(bounded(row.pulseMs ?? row.pulseDurationMs, 800, 50, 10000)),
                requireReadback: typeof row.requireReadback === 'boolean' ? row.requireReadback : !!(runningReadId || powerReadId),
                commandTimeoutMs: Math.round(bounded(row.commandTimeoutSec ?? row.readbackTimeoutSec, 60, 0.25, 300) * 1000),
                retryDelayMs: Math.round(bounded(row.retryDelaySec, 15, 0.25, 300) * 1000),
                maxRetries: Math.round(bounded(row.maxRetries, 2, 0, 20)),
                faultLockMs: Math.round(bounded(row.faultLockSec, 300, 1, 86400) * 1000),
                ownerLeaseMs: Math.round(bounded(row.ownerLeaseSec, 30, 5, 600) * 1000),
                requireGridImportForAutoStart: typeof row.requireGridImportForAutoStart === 'boolean'
                    ? row.requireGridImportForAutoStart
                    : row.requireFreshNvpForStart === true,
                gridImportStartW: Math.max(0, numberOr(row.gridImportStartW ?? row.minGridImportWForStart, 0)),
                stopOnGridExportW: Math.max(0, numberOr(row.stopOnGridExportW, 0)),
                gridMaxAgeMs: Math.round(bounded(row.gridMaxAgeSec ?? row.nvpMaxAgeSec, 15, 1, 3600) * 1000),
            };
            devices.push(device);
        }
        devices.sort((left, right) => left.idx - right.idx);
        this.devices = devices;
        if (this.dp) {
            for (const device of devices) {
                if (device.runningReadId) {
                    await this.dp.upsert({ key: `${this.root()}.${device.id}.running`, name: `${device.name} Laufstatus`, objectId: device.runningReadId, dataType: 'boolean', direction: 'in', unit: '', scale: 1, offset: 0, invert: false, deadband: 0, note: 'Betriebs-Readback' });
                }
                if (device.powerReadId) {
                    await this.dp.upsert({ key: `${this.root()}.${device.id}.powerW`, name: `${device.name} Leistung`, objectId: device.powerReadId, dataType: 'number', direction: 'in', unit: 'W', scale: device.powerScale, offset: 0, invert: false, deadband: 0, note: 'Erzeugerleistung' });
                }
            }
        }
        for (const device of devices) {
            const modeId = `${this.userBase(device)}.mode`;
            const existing = await this.adapter.getStateAsync(modeId).catch(() => null);
            if (!existing || existing.val === null || existing.val === undefined || existing.val === '') {
                await this.adapter.setStateAsync(modeId, 'auto', true);
            }
        }
    }
    getRuntime(id) {
        const existing = this.runtime.get(id);
        if (existing)
            return existing;
        const created = { wasRunning: null, stateSinceTs: 0, lastOnMs: 0, lastOffMs: 0, lastCmdMs: 0, lastCmd: '', restoredPulse: false, reconstructed: false };
        this.runtime.set(id, created);
        return created;
    }
    async setIfChanged(id, value) {
        const normalized = typeof value === 'number' && !Number.isFinite(value) ? null : value;
        if (this.stateCache.get(id) === normalized)
            return;
        this.stateCache.set(id, normalized);
        if (this.stateCache.size > 1000) {
            const __rc85Oldest = this.stateCache.keys().next().value;
            if (__rc85Oldest !== undefined)
                this.stateCache.delete(__rc85Oldest);
        } // RC85_BOUNDED_COLLECTION
        const previous = await this.adapter.getStateAsync(id).catch(() => null);
        if (previous && previous.val === normalized)
            return;
        await this.adapter.setStateAsync(id, normalized, true).catch(() => undefined);
        try {
            this.adapter.updateValue?.(id, normalized, Date.now());
        }
        catch (_error) { }
    }
    async readForeign(objectId, maxAgeMs, parse) {
        if (!objectId || typeof this.adapter?.getForeignStateAsync !== 'function')
            return emptySnapshot(!!objectId);
        const now = Date.now();
        try {
            const state = await this.adapter.getForeignStateAsync(objectId);
            if (!state)
                return emptySnapshot(true);
            const ts = stateTimestamp(state, 'ts');
            const lc = stateTimestamp(state, 'lc');
            const ageMs = ts === null ? null : Math.max(0, now - ts);
            const changeAgeMs = lc === null ? null : Math.max(0, now - lc);
            return {
                mapped: true,
                present: true,
                fresh: ageMs !== null && ageMs <= maxAgeMs,
                value: parse(state.val),
                ageMs,
                changeAgeMs,
                ts,
                lc,
            };
        }
        catch (_error) {
            return emptySnapshot(true);
        }
    }
    async socSnapshot(maxAgeMs) {
        const now = Date.now();
        const config = this.adapter?.config || {};
        const farmInfo = this.adapter?._nwGetStorageFarmRuntimeInfo?.();
        const fallbackFarmDispatchActive = !!farmInfo?.dispatchActive;
        const fallbackSingleActive = config.enableStorageControl === true;
        const authority = (typeof this.adapter?._nwGetStorageControlAuthority === 'function')
            ? this.adapter._nwGetStorageControlAuthority()
            : {
                selectedTopology: fallbackFarmDispatchActive ? 'farm' : (fallbackSingleActive ? 'single' : 'none'),
                reason: fallbackFarmDispatchActive
                    ? 'legacy-writable-farm-active'
                    : (fallbackSingleActive ? 'legacy-single-active' : 'no-active-storage-output'),
            };
        const topology = text(authority?.selectedTopology || 'none').toLowerCase();
        if (topology === 'farm') {
            // BHKW und Generator muessen dieselbe Farm-Sicht wie Speicherregler,
            // Tarife und Core-Budget verwenden. Ein alter Einzel-SoC darf einen
            // fehlenden oder veralteten Farm-SoC niemals kaschieren.
            let firstPresent = null;
            const candidates = [
                { id: 'storageFarm.totalSocOnline', source: 'storage-farm-online' },
                { id: 'storageFarm.totalSoc', source: 'storage-farm-total' },
            ];
            for (const candidate of candidates) {
                const state = await this.adapter.getStateAsync(candidate.id).catch(() => null);
                if (!state)
                    continue;
                const ts = stateTimestamp(state, 'ts');
                const ageMs = ts === null ? null : Math.max(0, now - ts);
                const parsed = finiteNumberOrNull(state.val);
                const value = parsed !== null && parsed >= 0 && parsed <= 100 ? parsed : null;
                const snapshot = {
                    configured: true,
                    fresh: value !== null && ageMs !== null && ageMs <= maxAgeMs,
                    value,
                    ageMs,
                    source: candidate.source,
                };
                if (snapshot.fresh)
                    return snapshot;
                if (!firstPresent)
                    firstPresent = snapshot;
            }
            return firstPresent || {
                configured: true,
                fresh: false,
                value: null,
                ageMs: null,
                source: `storage-farm-missing:${text(authority?.reason || 'unknown')}`,
            };
        }
        if (topology === 'single') {
            const overrideId = text(config.datapoints?.storageSoc);
            if (overrideId) {
                const age = Number(this.adapter?._nwGetCacheAgeMs?.('storageSoc', now));
                const value = finiteNumberOrNull(this.adapter?._nwGetNumberFromCacheFresh?.('storageSoc', maxAgeMs, null, now));
                return { configured: true, fresh: value !== null, value, ageMs: Number.isFinite(age) ? age : null, source: 'appcenter-override' };
            }
            const singleId = text(config.storage?.datapoints?.socObjectId);
            if (singleId) {
                const age = Number(this.dp?.getAgeMs?.('st.socPct'));
                const value = finiteNumberOrNull(this.dp?.getNumberFresh?.('st.socPct', maxAgeMs, null));
                return { configured: true, fresh: value !== null, value, ageMs: Number.isFinite(age) ? age : null, source: 'single-storage' };
            }
            const age = Number(this.adapter?._nwGetCacheAgeMs?.('storageSoc', now));
            const value = finiteNumberOrNull(this.adapter?._nwGetNumberFromCacheFresh?.('storageSoc', maxAgeMs, null, now));
            return { configured: false, fresh: value !== null, value, ageMs: Number.isFinite(age) ? age : null, source: value !== null ? 'automatic-single' : 'single-missing' };
        }
        return {
            configured: false,
            fresh: false,
            value: null,
            ageMs: null,
            source: `storage-none:${text(authority?.reason || 'no-active-storage-output')}`,
        };
    }
    nvpSnapshot(device) {
        return resolveCurrentNvpSnapshot(this.adapter?._nvpFreshnessSnapshot, Date.now(), Math.max(device.gridMaxAgeMs, 1000));
    }
    async operationalFeedback(device) {
        const power = await this.readForeign(device.powerReadId, device.measurementMaxAgeMs, (value) => {
            const parsed = finiteNumberOrNull(value);
            return parsed !== null ? Math.abs(parsed * device.powerScale) : null;
        });
        const direct = await this.readForeign(device.runningReadId, device.measurementMaxAgeMs, parseBoolean);
        if (direct.mapped) {
            return { running: direct, power, source: direct.fresh ? 'running-readback' : 'running-readback-stale' };
        }
        if (power.mapped && power.fresh && typeof power.value === 'number') {
            return { running: { ...power, value: power.value >= device.runningPowerThresholdW }, power, source: 'power-threshold' };
        }
        return { running: direct, power, source: power.mapped ? 'power-stale' : 'missing' };
    }
    actuatorIds(device) {
        return Array.from(new Set([device.startWriteId, device.stopWriteId, device.runWriteId].map(text).filter(Boolean)));
    }
    exclusiveAuthority(device, owner) {
        if (owner.startsWith('manual.'))
            return true;
        const matrix = this.adapter?._stageAActuatorOwnerById;
        const ids = this.actuatorIds(device);
        if (!ids.length || !matrix || typeof matrix !== 'object')
            return false;
        return ids.every((id) => {
            const owners = Array.isArray(matrix[id]?.activeOwners) ? matrix[id].activeOwners.map(text).filter(Boolean) : [];
            return owners.length === 1 && owners[0] === owner;
        });
    }
    contractConfig(device) {
        return {
            requireReadback: device.requireReadback && !!(device.runningReadId || device.powerReadId),
            ackTimeoutMs: device.commandTimeoutMs,
            retryDelayMs: device.retryDelayMs,
            maxRetries: device.maxRetries,
            faultLockMs: device.faultLockMs,
        };
    }
    async publishContract(device, owner, command, result, readback) {
        const base = this.deviceBase(device);
        await this.setIfChanged(`${base}.owner`, owner);
        await this.setIfChanged(`${base}.requestedCommand`, command);
        await this.setIfChanged(`${base}.writeAccepted`, result?.accepted === true);
        await this.setIfChanged(`${base}.writeConfirmed`, result?.confirmed === true);
        await this.setIfChanged(`${base}.readbackOk`, result?.readbackOk === true);
        await this.setIfChanged(`${base}.readbackFresh`, readback.fresh);
        await this.setIfChanged(`${base}.readbackAgeMs`, readback.ageMs);
        await this.setIfChanged(`${base}.writePending`, result?.pending === true);
        await this.setIfChanged(`${base}.retryCount`, Math.max(0, Math.round(numberOr(result?.retryCount, 0))));
        await this.setIfChanged(`${base}.faultLocked`, result?.faultLocked === true);
        await this.setIfChanged(`${base}.faultUntil`, Math.max(0, numberOr(result?.faultUntil, 0)));
        await this.setIfChanged(`${base}.writeContractStatus`, text(result?.status));
    }
    async rawWrite(objectId, value) {
        try {
            const result = await this.adapter.setForeignStateAsync(objectId, value, false);
            if (isActuatorAuthorityBlockedResult(result)) {
                return { accepted: false, blocked: true, error: text(result.reason || 'blocked-by-authority') };
            }
            if (result === false || result?.accepted === false)
                return { accepted: false, blocked: false, error: 'write-rejected' };
            return { accepted: true, blocked: false, error: '' };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.adapter?.log?.warn?.(`[${this.root()}] write failed for '${objectId}': ${message}`);
            return { accepted: false, blocked: false, error: message };
        }
    }
    writeContext(device, owner, reason, manual, releaseAuthority) {
        return {
            owner,
            module: this.spec.moduleName,
            priority: priorityForOwner(owner),
            reason,
            leaseMs: manual ? 5 * 60 * 1000 : device.ownerLeaseMs,
            kind: `${this.root()}-command`,
            enforceAuthority: this.exclusiveAuthority(device, owner),
            releaseAuthority,
        };
    }
    async restorePulse(device) {
        if (this.loadedPulseState.has(device.id))
            return true;
        try {
            const saved = await this.adapter.getStateAsync(`${this.deviceBase(device)}.pulseResetPending`);
            if (saved?.val) {
                const entry = JSON.parse(saved.val);
                const expected = entry?.command === 'start' ? device.startWriteId : entry?.command === 'stop' ? device.stopWriteId : '';
                if (device.commandProfile !== 'pulse' || !expected || entry.objectId !== expected
                    || typeof entry.manual !== 'boolean' || !Number.isFinite(entry.issuedAt)) {
                    await this.setIfChanged(`${this.deviceBase(device)}.writeContractStatus`, 'pulse-reset-mapping-changed');
                    return false;
                }
                const pulse = { objectId: expected, command: entry.command, manual: entry.manual, issuedAt: entry.issuedAt, due: 0, busy: false, released: false, recovered: true };
                const runtime = this.getRuntime(device.id);
                runtime.lastCmd = pulse.command;
                runtime.lastCmdMs = pulse.issuedAt;
                runtime.restoredPulse = true;
                this.pendingPulses.set(device.id, pulse);
                await this.resetPulse(device, pulse);
            }
            else if (device.enabled && device.commandProfile === 'pulse') {
                const base = this.deviceBase(device);
                const [lastCommand, lastTimestamp] = await Promise.all([
                    this.adapter.getStateAsync(`${base}.lastCommand`), this.adapter.getStateAsync(`${base}.lastCommandTs`),
                ]);
                if ((lastCommand?.val === 'start' || lastCommand?.val === 'stop') && Number.isFinite(lastTimestamp?.val)) {
                    const runtime = this.getRuntime(device.id);
                    runtime.lastCmd = lastCommand.val;
                    runtime.lastCmdMs = lastTimestamp.val;
                    runtime.restoredPulse = true;
                }
            }
            this.loadedPulseState.add(device.id);
            return true;
        }
        catch (_error) {
            await this.setIfChanged(`${this.deviceBase(device)}.writeContractStatus`, 'pulse-reset-state-unavailable');
            return false;
        }
    }
    async resetPulse(device, pulse) {
        if (this.adapter._nwShuttingDown || pulse.busy || this.pendingPulses.get(device.id) !== pulse)
            return;
        pulse.busy = true;
        try {
            if (!pulse.released) {
                const owner = pulse.manual ? this.manualOwner(device) : this.automaticOwner(device);
                const attempt = await withActuatorShadowContext(this.adapter, {
                    ...this.writeContext(device, owner, 'pulse-reset', pulse.manual, true),
                    kind: `${this.root()}-pulse-reset`,
                }, () => this.rawWrite(pulse.objectId, false));
                if (!attempt.accepted) {
                    await this.setIfChanged(`${this.deviceBase(device)}.writeContractStatus`, 'pulse-reset-retry');
                    return;
                }
                pulse.released = true;
            }
            // Only acknowledge a recovered manual request after the contact has been lowered.
            // A failed database read/clear leaves the journal intact for the next attempt.
            if (pulse.recovered && pulse.manual) {
                const id = `${this.userBase(device)}.command`;
                const command = await this.adapter.getStateAsync(id);
                if (command?.val === pulse.command && Number.isFinite(command.ts) && command.ts <= pulse.issuedAt) {
                    await this.adapter.setStateAsync(id, '', true);
                }
            }
            await this.adapter.setStateAsync(`${this.deviceBase(device)}.pulseResetPending`, '', true);
            this.pendingPulses.delete(device.id);
            const status = `${this.deviceBase(device)}.writeContractStatus`;
            if (pulse.recovered || this.stateCache.get(status) === 'pulse-reset-retry')
                await this.setIfChanged(status, 'pulse-reset-complete');
        }
        catch (_error) {
            await this.setIfChanged(`${this.deviceBase(device)}.writeContractStatus`, 'pulse-reset-retry');
        }
        finally {
            pulse.due = Date.now() + Math.max(250, Math.min(5000, device.retryDelayMs));
            pulse.busy = false;
        }
    }
    async pulseWrite(device, objectId, owner, reason, manual, desiredRunning) {
        if (!objectId || this.adapter._nwShuttingDown || this.pendingPulses.has(device.id)) {
            return { accepted: false, blocked: false, error: 'pulse-reset-pending-or-unavailable' };
        }
        const entry = { objectId, command: desiredRunning ? 'start' : 'stop', manual, issuedAt: Date.now() };
        const pulse = { ...entry, due: 0, busy: true, released: false, recovered: false };
        this.pendingPulses.set(device.id, pulse);
        try {
            // Persist before energising: a process or controller restart cannot lose the OFF obligation.
            await this.adapter.setStateAsync(`${this.deviceBase(device)}.pulseResetPending`, JSON.stringify(entry), true);
        }
        catch (_error) {
            this.pendingPulses.delete(device.id);
            this.loadedPulseState.delete(device.id);
            return { accepted: false, blocked: false, error: 'pulse-reset-state-unavailable' };
        }
        try {
            if (this.adapter._nwShuttingDown)
                return { accepted: false, blocked: false, error: 'shutdown' };
            const attempt = await withActuatorShadowContext(this.adapter, this.writeContext(device, owner, reason, manual, false), () => this.rawWrite(objectId, true));
            if (!attempt.accepted) {
                // A rejected authority request never reached the output. Transport errors may have.
                pulse.released = attempt.blocked;
                pulse.busy = false;
                await this.resetPulse(device, pulse);
                return attempt;
            }
            pulse.due = Date.now() + device.pulseMs;
            const schedule = this.adapter._nwSetTimeout || this.adapter.setTimeout;
            if (typeof schedule === 'function')
                schedule.call(this.adapter, () => { void this.resetPulse(device, pulse); }, device.pulseMs);
            return attempt;
        }
        finally {
            pulse.busy = false;
        }
    }
    async writeDesired(device, desiredRunning, owner, reason, manual) {
        if (device.commandProfile === 'run-level') {
            const target = device.runWriteId || (device.startWriteId === device.stopWriteId ? device.startWriteId : '');
            if (!target)
                return { accepted: false, blocked: false, error: 'missing-run-write' };
            return withActuatorShadowContext(this.adapter, this.writeContext(device, owner, reason, manual, !desiredRunning), () => this.rawWrite(target, desiredRunning));
        }
        if (device.commandProfile === 'dual-level') {
            if (device.startWriteId && device.startWriteId === device.stopWriteId) {
                return withActuatorShadowContext(this.adapter, this.writeContext(device, owner, reason, manual, !desiredRunning), () => this.rawWrite(device.startWriteId, desiredRunning));
            }
            const active = desiredRunning ? device.startWriteId : device.stopWriteId;
            const inactive = desiredRunning ? device.stopWriteId : device.startWriteId;
            if (!active || !inactive)
                return { accepted: false, blocked: false, error: 'missing-dual-level-write' };
            const neutral = await withActuatorShadowContext(this.adapter, this.writeContext(device, owner, `${reason}:neutralize`, manual, false), () => this.rawWrite(inactive, false));
            if (!neutral.accepted)
                return neutral;
            return withActuatorShadowContext(this.adapter, this.writeContext(device, owner, reason, manual, !desiredRunning), () => this.rawWrite(active, true));
        }
        return this.pulseWrite(device, desiredRunning ? device.startWriteId : device.stopWriteId, owner, reason, manual, desiredRunning);
    }
    async requestState(device, desiredRunning, reason, manual, readback) {
        const owner = manual ? this.manualOwner(device) : this.automaticOwner(device);
        const command = desiredRunning ? 'start' : 'stop';
        const key = `${this.root()}:${device.id}:running`;
        const config = this.contractConfig(device);
        const now = Date.now();
        const confirmed = this.actuatorContract.confirmFromReadback(key, desiredRunning, readback.value, readback.fresh && readback.value === desiredRunning, now);
        if (confirmed) {
            await this.publishContract(device, owner, command, confirmed, readback);
            return confirmed;
        }
        const runtime = this.getRuntime(device.id);
        if (!manual && (device.requireReadback !== true || runtime.restoredPulse) && runtime.lastCmd === command && runtime.lastCmdMs > 0) {
            const settleRemainingMs = device.commandTimeoutMs - (now - runtime.lastCmdMs);
            if (settleRemainingMs > 0) {
                const deferred = this.actuatorContract.defer(key, desiredRunning, now, settleRemainingMs, 'command-settle-wait');
                await this.publishContract(device, owner, command, deferred, readback);
                return deferred;
            }
        }
        const decision = this.actuatorContract.prepare(key, desiredRunning, now, config);
        if (!decision.allowed) {
            const current = this.actuatorContract.result(key, now, decision.targetChanged);
            await this.publishContract(device, owner, command, current, readback);
            return current;
        }
        const attempt = await this.writeDesired(device, desiredRunning, owner, reason, manual);
        if (attempt.blocked) {
            const deferred = this.actuatorContract.defer(key, desiredRunning, now, Math.min(device.retryDelayMs, 5000), 'blocked-by-authority');
            await this.publishContract(device, owner, command, deferred, readback);
            return deferred;
        }
        const after = (await this.operationalFeedback(device)).running;
        const readbackOk = after.fresh && after.value === desiredRunning ? true : null;
        const result = this.actuatorContract.complete(key, desiredRunning, attempt.accepted, readbackOk, after.value, Date.now(), config);
        await this.publishContract(device, owner, command, result, after);
        if (attempt.accepted) {
            // BHKW/Generator haben ohne Nennleistungsmodell keine sichere sofortige
            // Leistungsprognose. Der finale PV-Aktor wartet deshalb bei einem frisch
            // akzeptierten Start/Stop mindestens auf den nächsten NVP-Messzyklus,
            // statt im selben Tick gegen einen noch nicht reagierten Erzeuger zu regeln.
            recordAcceptedActuatorTransition(this.adapter, {
                key: `${this.root()}:${device.id}`,
                accepted: true,
                kind: 'generation',
                source: this.spec.moduleName,
                reason: `${reason}:${command}`,
            });
            runtime.lastCmdMs = Date.now();
            runtime.lastCmd = command;
            runtime.restoredPulse = false;
            await this.setIfChanged(`${this.deviceBase(device)}.lastCommand`, command);
            await this.setIfChanged(`${this.deviceBase(device)}.lastCommandTs`, runtime.lastCmdMs);
            await this.setIfChanged(`${this.deviceBase(device)}.reason`, reason);
        }
        return result;
    }
    updateRuntimeFromReadback(device, snapshot, now) {
        if (!snapshot.fresh || typeof snapshot.value !== 'boolean')
            return;
        const runtime = this.getRuntime(device.id);
        const sinceTs = Math.max(0, Math.min(now, snapshot.lc || snapshot.ts || now));
        if (runtime.wasRunning === null) {
            runtime.wasRunning = snapshot.value;
            runtime.stateSinceTs = sinceTs;
            runtime.reconstructed = true;
            if (snapshot.value)
                runtime.lastOnMs = sinceTs;
            else
                runtime.lastOffMs = sinceTs;
            return;
        }
        if (runtime.wasRunning !== snapshot.value) {
            runtime.wasRunning = snapshot.value;
            runtime.stateSinceTs = sinceTs;
            if (snapshot.value)
                runtime.lastOnMs = sinceTs;
            else
                runtime.lastOffMs = sinceTs;
        }
    }
    normalizeMode(value) {
        const mode = text(value).toLowerCase();
        if (mode === 'manuell')
            return 'manual';
        if (mode === 'aus')
            return 'off';
        return mode === 'manual' || mode === 'off' ? mode : 'auto';
    }
    canActuate(device) {
        if (device.commandProfile === 'run-level')
            return !!(device.runWriteId || (device.startWriteId && device.startWriteId === device.stopWriteId));
        return !!(device.startWriteId && device.stopWriteId);
    }
    async tick() {
        if (!this.inited || !this.devices.length)
            return;
        const now = Date.now();
        for (const device of this.devices) {
            if (!await this.restorePulse(device))
                continue;
            const pending = this.pendingPulses.get(device.id);
            if (pending && pending.due <= now) {
                await this.resetPulse(device, pending);
                if (this.pendingPulses.has(device.id))
                    continue;
            }
            if (!device.enabled)
                continue;
            const base = this.deviceBase(device);
            const user = this.userBase(device);
            const feedback = await this.operationalFeedback(device);
            const running = feedback.running;
            const power = feedback.power;
            const soc = await this.socSnapshot(device.socMaxAgeMs);
            const nvp = this.nvpSnapshot(device);
            this.updateRuntimeFromReadback(device, running, now);
            const runtime = this.getRuntime(device.id);
            const minRunMs = Math.round(device.minRunMin * 60000);
            const minOffMs = Math.round(device.minOffMin * 60000);
            const minRunRemainingSec = running.value === true && runtime.lastOnMs
                ? Math.max(0, Math.ceil((minRunMs - (now - runtime.lastOnMs)) / 1000))
                : 0;
            const minOffRemainingSec = running.value === false && runtime.lastOffMs
                ? Math.max(0, Math.ceil((minOffMs - (now - runtime.lastOffMs)) / 1000))
                : 0;
            await this.setIfChanged(`${base}.running`, typeof running.value === 'boolean' ? running.value : false);
            await this.setIfChanged(`${base}.runningFresh`, running.fresh);
            await this.setIfChanged(`${base}.runningAgeMs`, running.ageMs);
            await this.setIfChanged(`${base}.runningSource`, feedback.source);
            await this.setIfChanged(`${base}.powerW`, typeof power.value === 'number' ? Math.round(power.value) : null);
            await this.setIfChanged(`${base}.powerFresh`, power.fresh);
            await this.setIfChanged(`${base}.powerAgeMs`, power.ageMs);
            await this.setIfChanged(`${base}.socPct`, typeof soc.value === 'number' ? Math.round(soc.value * 10) / 10 : null);
            await this.setIfChanged(`${base}.socFresh`, soc.fresh);
            await this.setIfChanged(`${base}.socAgeMs`, soc.ageMs);
            await this.setIfChanged(`${base}.socSource`, soc.source);
            await this.setIfChanged(`${base}.nvpW`, nvp.usable ? Math.round(Number(nvp.netW) || 0) : null);
            await this.setIfChanged(`${base}.nvpFresh`, nvp.usable === true);
            await this.setIfChanged(`${base}.nvpStatus`, text(nvp.status || nvp.reason));
            await this.setIfChanged(`${base}.centralBudgetStatus`, 'producer-via-nvp');
            await this.setIfChanged(`${base}.stateSinceTs`, runtime.stateSinceTs);
            await this.setIfChanged(`${base}.stateReconstructed`, runtime.reconstructed);
            await this.setIfChanged(`${base}.minRunRemainingSec`, minRunRemainingSec);
            await this.setIfChanged(`${base}.minOffRemainingSec`, minOffRemainingSec);
            const modeState = await this.adapter.getStateAsync(`${user}.mode`).catch(() => null);
            const mode = this.normalizeMode(modeState?.val);
            const commandState = await this.adapter.getStateAsync(`${user}.command`).catch(() => null);
            const command = text(commandState?.val).toLowerCase();
            if ((command === 'start' || command === 'stop') && !this.pendingPulses.has(device.id)) {
                if (mode === 'manual')
                    await this.requestState(device, command === 'start', `manual:${command}`, true, running);
                else
                    await this.setIfChanged(`${base}.reason`, 'manual:ignored_not_manual');
                // A new manual command can arrive during the device write; consume only the observed request.
                const current = await this.adapter.getStateAsync(`${user}.command`);
                if (current?.val === commandState?.val && current?.ts === commandState?.ts)
                    await this.adapter.setStateAsync(`${user}.command`, '', true);
            }
            let status = '';
            let reason = '';
            if (!this.canActuate(device)) {
                status = 'Konfiguration unvollstaendig (Start/Stop-Write fehlt)';
                reason = 'config:missing-write';
            }
            else if (mode === 'off') {
                status = 'Aus';
                reason = 'off';
                if ((running.fresh && running.value === true) || (!running.fresh && runtime.wasRunning === true) || runtime.lastCmd === 'start') {
                    await this.requestState(device, false, 'off:stop', true, running);
                    reason = 'off:stop';
                }
            }
            else if (mode === 'manual') {
                status = 'Manuell';
                reason = 'manual';
            }
            else if (!soc.fresh || typeof soc.value !== 'number') {
                status = 'Auto (SoC fehlt/veraltet)';
                reason = 'auto:stale_soc';
            }
            else if (!running.fresh || typeof running.value !== 'boolean') {
                status = 'Auto (Laufstatus fehlt/veraltet)';
                reason = 'auto:stale_running';
            }
            else {
                const startAt = Math.min(device.socStartPct, device.socStopPct);
                const stopAt = Math.max(device.socStartPct, device.socStopPct);
                const canStartByTime = !runtime.lastOffMs || now - runtime.lastOffMs >= minOffMs;
                const canStopByTime = !runtime.lastOnMs || now - runtime.lastOnMs >= minRunMs;
                const startNeedsNvp = device.requireGridImportForAutoStart || device.gridImportStartW > 0;
                const gridImportW = nvp.usable ? Math.max(0, Number(nvp.netW) || 0) : 0;
                const gridExportW = nvp.usable ? Math.max(0, -(Number(nvp.netW) || 0)) : 0;
                if (running.value && device.stopOnGridExportW > 0 && nvp.usable && gridExportW >= device.stopOnGridExportW) {
                    status = `Auto (Stop bei Export >= ${Math.round(device.stopOnGridExportW)} W)`;
                    reason = canStopByTime ? 'auto:stop_grid_export' : 'auto:stop_blocked_min_run';
                    if (canStopByTime)
                        await this.requestState(device, false, reason, false, running);
                }
                else if (!running.value && soc.value <= startAt) {
                    status = `Auto (Start bei <= ${startAt}%)`;
                    if (!canStartByTime)
                        reason = 'auto:start_blocked_min_off';
                    else if (startNeedsNvp && !nvp.usable)
                        reason = 'auto:start_blocked_stale_nvp';
                    else if (device.gridImportStartW > 0 && gridImportW < device.gridImportStartW)
                        reason = 'auto:start_blocked_grid_import';
                    else {
                        reason = 'auto:start_soc_low';
                        await this.requestState(device, true, reason, false, running);
                    }
                }
                else if (running.value && soc.value >= stopAt) {
                    status = `Auto (Stop bei >= ${stopAt}%)`;
                    reason = canStopByTime ? 'auto:stop_soc_high' : 'auto:stop_blocked_min_run';
                    if (canStopByTime)
                        await this.requestState(device, false, reason, false, running);
                }
                else {
                    status = running.value ? 'Auto (laeuft)' : 'Auto (bereit)';
                    reason = 'auto:idle';
                }
            }
            await this.setIfChanged(`${base}.status`, status);
            if (reason)
                await this.setIfChanged(`${base}.reason`, reason);
        }
    }
}
exports.PrimeMoverControlModule = PrimeMoverControlModule;
module.exports = { PrimeMoverControlModule };
