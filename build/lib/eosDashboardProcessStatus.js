/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
// @ts-check
'use strict';
/** @typedef {import('./eosDashboardProcessStatus').DashboardProcessId} ProcessId */
/** @typedef {import('./eosDashboardProcessStatus').DashboardProcessStatus} DashboardStatus */
/** @type {readonly ProcessId[]} */
const PROCESS_IDS = ['ui', 'ems', 'devices', 'eebus', 'backup', 'ocpp'];
const PROCESS_FAILURES = new Set(['failed', 'error', 'backoff']);
const STOP_FAILURES = new Set(['STOP_FAILED_RESTART_REQUIRED', 'EOS_RUNTIME_STOP_UNCONFIRMED', 'EOS_MODULE_STOP_UNCONFIRMED',
    'EOS_MODULE_PROCESS_STOP_UNCONFIRMED', 'EOS_UI_PROCESS_STOP_UNCONFIRMED']);
const HOST_FAILURES = new Set(['START_FAILED', 'START_FAILED_RESTART_REQUIRED', 'PROCESS_BACKOFF', 'MODULE_CALLBACK_FAILED',
    'CONFIG_INVALID', 'LEGACY_CONFLICT', 'OWNERSHIP_UNAVAILABLE', 'EOS_OWNERSHIP_REQUIRED', 'STOPPED']);
/** @param {unknown} value @returns {Record<string, unknown>} */
function record(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? /** @type {Record<string, unknown>} */ (value) : {};
}
/**
 * Classify one local supervisor observation. Generation zero is valid for a hosted
 * module. Its first confirmed heartbeat may arrive after start() has completed.
 * @param {ProcessId} id @param {unknown} input @param {number} now
 * @returns {'ok'|'fault'|'unknown'|'paused'|'waiting'}
 */
function processStatus(id, input, now) {
    const source = record(input);
    const child = record(source.process);
    const reason = typeof source.reason === 'string' ? source.reason : '';
    const state = typeof child.state === 'string' ? child.state : '';
    if (STOP_FAILURES.has(reason) || (typeof child.lastError === 'string' && STOP_FAILURES.has(child.lastError)))
        return 'fault';
    const standby = child.standby === true;
    if (source.enabled === false || (source.configured === false && !standby))
        return 'paused';
    if (source.enabled !== true)
        return 'unknown';
    if (reason === 'CONFIG_INVALID')
        return 'fault';
    if (source.configured !== true && !standby)
        return 'unknown';
    const splitWorker = id === 'ui' || id === 'ems';
    if (!splitWorker && reason === 'LICENSE_REQUIRED')
        return 'paused';
    if (HOST_FAILURES.has(reason) || PROCESS_FAILURES.has(state))
        return 'fault';
    if (state === 'stopped') {
        // Before the very first acquisition, the supervisors can report a
        // stopped placeholder while preparing to schedule the initial start.
        if (reason === 'READY' || reason === 'STARTING' || reason === 'CONFIG_CHANGED' ||
            (splitWorker && child.generation === 0 && !child.lastError))
            return 'unknown';
        return 'fault';
    }
    if (state !== 'running')
        return 'unknown';
    // Only a fresh acknowledgement from the current supervised process counts.
    const heartbeat = child.lastHeartbeatAt;
    if (typeof heartbeat !== 'number' || !Number.isSafeInteger(heartbeat) || heartbeat <= 0 || heartbeat > now)
        return 'unknown';
    if (now - heartbeat > (splitWorker ? 5000 : 4000))
        return 'fault';
    if (typeof child.pid !== 'number' || !Number.isSafeInteger(child.pid) || child.pid < 1 ||
        typeof child.generation !== 'number' || !Number.isSafeInteger(child.generation) || child.generation < 0)
        return 'unknown';
    // A fresh passive process is alive, but cannot attest to the devices still owned elsewhere.
    if (standby)
        return 'waiting';
    if (source.active !== true)
        return source.active === false ? 'fault' : 'unknown';
    if (id === 'ems' && source.emsReady !== true) {
        if (source.emsReady !== false || ['starting', 'idle'].includes(reason))
            return 'unknown';
        return 'fault';
    }
    return 'ok';
}
/** @param {unknown} name @returns {boolean} */
function safeName(name) {
    return typeof name === 'string' && name.length > 0 && name.length <= 64 && name.trim() === name
        && /^[\p{L}\p{M}\p{N} ()_–·-]+$/u.test(name) && !/\d{6,}|[a-f\d]{16,}|(?:[a-f\d]{2}-){5}[a-f\d]{2}/i.test(name);
}
/** The child is an IPC boundary. Accept only bounded, allowlisted values and
 * select individual fields before retaining a snapshot in the parent.
 * @param {unknown} raw @returns {import('./eosDashboardProcessStatus').InternalDeviceHealth|null}
 */
function normalizedDeviceHealth(raw) {
    const value = record(raw);
    const state = value.state;
    if (state !== 'ok' && state !== 'fault' && state !== 'unknown')
        return null;
    const count = value.totalOffline;
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 || count > 10000 ||
        (state === 'fault') !== (count > 0) || !Array.isArray(value.offline) ||
        value.offline.length !== Math.min(count, 12) || !Array.isArray(value.tracked) || value.tracked.length > 256)
        return null;
    const offline = [];
    for (const item of value.offline) {
        const name = record(item).name;
        if (typeof name !== 'string' || !safeName(name))
            return null;
        offline.push({ name });
    }
    /** @type {import('./eosDashboardProcessStatus').InternalDeviceHealth['tracked']} */
    const tracked = [];
    const keys = new Set();
    for (const item of value.tracked) {
        const { key, name, state: status } = record(item);
        if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key) || keys.has(key) ||
            typeof name !== 'string' || !safeName(name) ||
            (status !== 'online' && status !== 'offline' && status !== 'unknown' && status !== 'disabled'))
            return null;
        keys.add(key);
        tracked.push({ key, name, state: status });
    }
    const confirmed = tracked.filter(item => item.state === 'offline').length;
    if (confirmed > count || (value.complete === true && confirmed !== count) ||
        (state === 'ok' && tracked.some(item => item.state === 'unknown')))
        return null;
    return { state, totalOffline: count, offline, tracked, complete: value.complete === true };
}
/** @param {Record<string, unknown>} own @param {number} now */
function freshDeviceReport(own, now) {
    const stamp = own.observedAt;
    return typeof stamp === 'number' && Number.isSafeInteger(stamp) && stamp > 0 && stamp <= now && now - stamp <= 6000;
}
/** Internal automation observes the same bounded supervisor snapshot; the public
 * HTTP API never returns these opaque keys. A missing source cannot clear incidents.
 * @param {unknown} sources @param {number} [now]
 * @returns {ReturnType<typeof import('./eosDashboardProcessStatus').notificationProcessStatus>}
 */
function notificationProcessStatus(sources, now = Date.now()) {
    /** @type {ReturnType<typeof import('./eosDashboardProcessStatus').notificationProcessStatus>} */
    const result = { processes: { ui: 'unknown', ems: 'unknown', devices: 'unknown', eebus: 'unknown', backup: 'unknown', ocpp: 'unknown' },
        devices: { devices: { complete: false, tracked: [] }, eebus: { complete: false, tracked: [] }, ocpp: { complete: false, tracked: [] } } };
    if (!Number.isSafeInteger(now) || now <= 0)
        return result;
    const snapshot = record(sources);
    for (const id of PROCESS_IDS) {
        const item = record(snapshot[id]);
        const status = processStatus(id, item, now);
        result.processes[id] = status === 'ok' ? 'online' : status === 'fault' ? 'offline' : status === 'paused' ? 'disabled' : 'unknown';
        if ((id === 'devices' || id === 'eebus' || id === 'ocpp') && status === 'ok') {
            const own = record(item.deviceHealth);
            const data = freshDeviceReport(own, now) ? normalizedDeviceHealth(own) : null;
            if (data)
                result.devices[id] = { complete: data.complete, tracked: data.tracked };
        }
    }
    return result;
}
/**
 * Fixed, customer-visible projection. It reads only a synchronous in-memory
 * snapshot. No inventory, raw reason, address, configuration or PID leaves it.
 * @param {unknown} sources @param {number} [now] @returns {DashboardStatus}
 */
function dashboardProcessStatus(sources, now = Date.now()) {
    const result = /** @type {DashboardStatus} */ ({ observedAt: now, state: 'ok', failed: [], paused: [],
        deviceHealth: { state: 'ok', offline: [], totalOffline: 0 } });
    if (!Number.isSafeInteger(now) || now <= 0)
        return { ...result, observedAt: 0, state: 'unknown', deviceHealth: { state: 'unknown', offline: [], totalOffline: 0 } };
    const snapshot = record(sources);
    for (const id of PROCESS_IDS) {
        const input = record(snapshot[id]);
        const state = processStatus(id, input, now);
        if ((id === 'devices' || id === 'eebus' || id === 'ocpp') && state !== 'paused') {
            // Parent getter has already validated and bounded the IPC report once.
            // Never echo tracked keys. A stopped owner cannot attest to physical reachability.
            const own = state === 'ok' ? record(input.deviceHealth) : {};
            const current = freshDeviceReport(own, now);
            const count = own.totalOffline;
            if (current && own.state === 'fault' && typeof count === 'number' && Number.isSafeInteger(count) &&
                count > 0 && count <= 10000 && Array.isArray(own.offline) && own.offline.length === Math.min(12, count)
                && own.offline.every(item => safeName(record(item).name))) {
                result.deviceHealth.totalOffline = Math.min(10000, result.deviceHealth.totalOffline + count);
                for (const item of own.offline.slice(0, 12 - result.deviceHealth.offline.length)) {
                    result.deviceHealth.offline.push({ name: String(record(item).name) });
                }
            }
            else if (!current || own.state !== 'ok' || count !== 0 || !Array.isArray(own.offline) || own.offline.length) {
                result.deviceHealth.state = 'unknown';
            }
        }
        if (state === 'paused')
            result.paused.push(id);
        else if (state === 'waiting') {
            (result.waiting ??= []).push(id);
            result.state = 'unknown';
        }
        else if (state === 'fault')
            result.failed.push(id);
        else if (state === 'unknown')
            result.state = 'unknown';
    }
    if (result.deviceHealth.totalOffline)
        result.deviceHealth.state = 'fault';
    if (result.failed.length)
        result.state = 'fault';
    return result;
}
module.exports = { dashboardProcessStatus, notificationProcessStatus, normalizedDeviceHealth };
//# sourceMappingURL=eosDashboardProcessStatus.js.map