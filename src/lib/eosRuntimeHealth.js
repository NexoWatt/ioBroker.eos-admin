/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const { pid: parentPid } = require('node:process');

/** @typedef {Record<string, unknown>} RecordValue */
/** @typedef {{id:string,label:string,kind:string,state:string,pid:number|null,active:boolean|null,emsReady:boolean|null,connected:boolean|null,generation:number|null,restarts:number|null,reason:string,lastHeartbeatAt:number|null,nextRestartAt:number|null}} ProcessRow */
/** @typedef {{status:(id:string)=>unknown,owner?:{getObjectViewAsync?:(design:string,search:string,params:RecordValue)=>Promise<unknown>,getForeignStateAsync?:(id:string)=>Promise<unknown>}}} HealthHost */

const STATES = new Set(['starting', 'running', 'stopping', 'stopped', 'error', 'failed', 'backoff']);
const HOST_REASONS = new Set(['DISABLED', 'RUNNING', 'STARTING', 'READY', 'PROCESS_BACKOFF', 'CONFIG_INVALID',
    'STOP_FAILED_RESTART_REQUIRED', 'OWNERSHIP_CHANGED', 'LICENSE_REQUIRED', 'LICENSE_INVALID',
    'LEGACY_ENABLED_OR_UNKNOWN', 'LEGACY_STOP_NOT_CONFIRMED', 'START_FAILED', 'STOPPED', 'MODULE_CALLBACK_FAILED',
    'LEGACY_CONFLICT', 'OWNERSHIP_UNAVAILABLE', 'START_FAILED_RESTART_REQUIRED', 'CONFIG_CHANGED']);
const MODULE_LABELS = Object.freeze({ devices: 'Geräte', eebus: 'EEBus', backup: 'Sicherung', ocpp: 'OCPP-Ladestationen' });
/** @param {unknown} value @returns {RecordValue} */
function record(value) { return value && typeof value === 'object' && !Array.isArray(value) ? /** @type {RecordValue} */ (value) : {}; }
/** @param {unknown} value @returns {number|null} */
function natural(value) { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null; }
/** @param {unknown} value @returns {number|null} */
function pid(value) { const result = natural(value); return result && result <= 2147483647 ? result : null; }
/** @param {unknown} value @returns {number|null} */
function timestamp(value) { const result = natural(value); return result && result <= 8640000000000000 ? result : null; }
/** @param {unknown} value @returns {boolean|null} */
function boolean(value) { return typeof value === 'boolean' ? value : null; }
/** Only protocol codes, never arbitrary runtime exception text. @param {unknown} value */
function reason(value) {
    return typeof value === 'string' && value.length <= 80 && (HOST_REASONS.has(value) || /^(?:EOS|EEBUS)_[A-Z0-9_]+$/.test(value)) ? value : '';
}
/** @param {string} id @param {string} label @param {string} kind @returns {ProcessRow} */
function unknownRow(id, label, kind) {
    return { id, label, kind, state: 'unknown', pid: null, active: null, emsReady: null, connected: null,
        generation: null, restarts: null, reason: '', lastHeartbeatAt: null, nextRestartAt: null };
}
/** Explicit projection: module config, IPC content, license and raw errors are never serialised.
 * @param {string} id @param {string} label @param {unknown} value @param {boolean} [direct]
 * @returns {ProcessRow}
 */
function processRow(id, label, value, direct = false) {
    const raw = record(value); const details = record(raw.details); const process = record(direct ? raw.process : details.process);
    const result = unknownRow(id, label, 'child');
    result.state = typeof process.state === 'string' && STATES.has(process.state) ? process.state : 'unknown';
    if (raw.enabled === false && ['unknown', 'stopped'].includes(result.state)) result.state = 'disabled';
    result.pid = ['running', 'starting', 'stopping'].includes(result.state) ? pid(process.pid) : null;
    result.active = raw.active === false ? false : raw.active === true && result.state === 'running' ? true : null;
    if (id === 'ems') result.emsReady = raw.emsReady === false ? false : raw.emsReady === true && result.active === true ? true : null;
    result.generation = natural(process.generation); result.restarts = natural(process.restarts);
    result.reason = reason(process.lastError) || reason(raw.reason);
    result.lastHeartbeatAt = timestamp(process.lastHeartbeatAt); result.nextRestartAt = timestamp(process.nextRestartAt);
    if (details.statusUnavailable === true) result.active = null;
    return result;
}

/** A controller state must be acknowledged, valid and timestamped. @param {unknown} value @param {number} now */
function controllerState(value, now) {
    const state = record(value); const ts = timestamp(state.ts);
    return state.ack === true && (state.q === 0 || state.q === undefined) && ts !== null && ts <= now + 5000 ? state : null;
}

/** Exact controller instance inventory only; no user supplied namespace, wildcard states or writes.
 * A reported PID is displayed only while a fresh alive state confirms the same process run.
 * @param {HealthHost['owner']} owner @param {number} [now] @returns {Promise<ProcessRow[]>}
 */
async function readExternalOcppStatus(owner, now = Date.now()) {
    if (!owner?.getObjectViewAsync || !owner.getForeignStateAsync) return [];
    const view = record(await owner.getObjectViewAsync('system', 'instance', {
        startkey: 'system.adapter.ocpp21.', endkey: 'system.adapter.ocpp21.\u9999', limit: 33,
    }));
    if (!Array.isArray(view.rows)) throw new Error('EOS_RUNTIME_OCPP_INVENTORY');
    if (view.rows.length > 32) throw new Error('EOS_RUNTIME_OCPP_LIMIT');
    const instances = [...new Set(view.rows.map(row => record(row).id)
        .filter((id) => typeof id === 'string' && /^system\.adapter\.ocpp21\.\d{1,8}$/.test(id)))];
    return Promise.all(instances.map(async instanceId => {
        const instance = /** @type {string} */ (instanceId).slice('system.adapter.'.length);
        const row = unknownRow(instance, `OCPP · ${instance}`, 'external');
        const read = /** @type {NonNullable<NonNullable<HealthHost['owner']>['getForeignStateAsync']>} */ (owner.getForeignStateAsync).bind(owner);
        const [aliveValue, pidValue, connectionValue] = await Promise.all([
            read(`${instanceId}.alive`).catch(() => null), read(`${instanceId}.pid`).catch(() => null), read(`${instance}.info.connection`).catch(() => null),
        ]);
        const alive = controllerState(aliveValue, now); const reportedPid = controllerState(pidValue, now);
        const connected = controllerState(connectionValue, now);
        if (alive && typeof alive.val === 'boolean' && now - Number(alive.ts) <= 120000) {
            row.state = alive.val ? 'running' : 'stopped'; row.active = alive.val; row.lastHeartbeatAt = timestamp(alive.ts);
            const aliveChanged = timestamp(alive.lc);
            if (alive.val && reportedPid && aliveChanged && Number(reportedPid.ts) >= aliveChanged - 5000) row.pid = pid(reportedPid.val);
        }
        if (row.state === 'running' && connected && now - Number(connected.ts) <= 120000) row.connected = boolean(connected.val);
        return row;
    }));
}

/** @template T @param {Promise<T>} promise @param {number} milliseconds @returns {Promise<T>} */
function within(promise, milliseconds) {
    /** @type {ReturnType<typeof setTimeout>|undefined} */ let timer;
    return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('EOS_RUNTIME_STATUS_TIMEOUT')), milliseconds); })])
        .finally(() => clearTimeout(timer));
}

/** Single-flight per source remains occupied until the underlying read settles, even after its deadline.
 * This bounds unresolved ioBroker/IPC work across tabs and polling retries.
 * @param {{host:HealthHost,runtimeStatus?:()=>unknown,timeoutMs?:number,runtimeControl?:{view:(id:string,configured?:boolean)=>unknown,isEnabled:(id:string)=>boolean}}} options
 */
function createRuntimeHealthReader({ host, runtimeStatus, timeoutMs = 2500, runtimeControl }) {
    /** @type {Map<string, Promise<unknown>>} */ const pending = new Map();
    /** @param {string} id @param {()=>unknown} read */
    const source = (id, read) => {
        let promise = pending.get(id);
        if (!promise) {
            promise = Promise.resolve().then(read); pending.set(id, promise);
            void promise.then(() => pending.delete(id), () => pending.delete(id));
        }
        return within(promise, timeoutMs).catch(() => null);
    };
    /** @type {Promise<{observedAt:number,processes:ProcessRow[]}>|null} */ let request = null;
    return () => {
        if (request) return request;
        request = (async () => {
            const ids = /** @type {const} */ (['devices', 'eebus', 'backup', 'ocpp']);
            const [values, runtime, external] = await Promise.all([
                Promise.all(ids.map(id => source(id, () => host.status(id)))),
                source('runtime', () => runtimeStatus?.()), source('ocpp-external', () => readExternalOcppStatus(host.owner)),
            ]);
            const parent = unknownRow('admin', 'EOS Administration', 'parent');
            parent.state = 'running'; parent.pid = parentPid; parent.active = true;
            const status = record(runtime);
            const processes = [parent, processRow('ui', 'Oberfläche', status.ui ?? status, true),
                processRow('ems', 'Energiemanagement (EMS)', status.ems, true),
                ...ids.map((id, index) => processRow(id, MODULE_LABELS[id], values[index]))];
            for (const row of processes) {
                if (row.kind !== 'child' || !runtimeControl) continue;
                const configured = row.id === 'ui' || row.id === 'ems' ||
                    record(values[ids.indexOf(/** @type {'devices'|'eebus'|'backup'|'ocpp'} */(row.id))]).enabled === true;
                const controls = runtimeControl.view(row.id, configured);
                Object.assign(row, { controls });
                if (!runtimeControl.isEnabled(row.id)) {
                    row.active = false;
                    if (row.id === 'ems') row.emsReady = false;
                    if (['unknown', 'stopped'].includes(row.state)) row.state = 'disabled';
                    row.reason = reason(record(controls).reason) || 'EOS_RUNTIME_DISABLED';
                }
            }
            const hostedNamespace = record(values[ids.indexOf('ocpp')]).namespace;
            if (Array.isArray(external)) processes.push(.../** @type {ProcessRow[]} */(external)
                .filter(row => row.id !== hostedNamespace || row.state !== 'stopped'));
            else { const row = unknownRow('ocpp-external', 'OCPP · externe Instanzprüfung', 'external'); row.reason = 'EOS_RUNTIME_OCPP_UNAVAILABLE'; processes.push(row); }
            return { observedAt: Date.now(), processes };
        })().finally(() => { request = null; });
        return request;
    };
}

module.exports = { createRuntimeHealthReader, processRow, readExternalOcppStatus };
