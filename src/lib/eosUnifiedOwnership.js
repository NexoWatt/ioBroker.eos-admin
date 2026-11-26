'use strict';

/**
 * Copyright (c) 2026 NexoWatt. Proprietary; see LICENSE.
 *
 * Verhindert im gemeinsamen Adapter konkurrierende Alt-/Neuregler. Die Freigabe
 * stammt aus einer frischen Controller-Inventur, nicht aus einem schreibbaren
 * `licensed`-/Heartbeat-State. Alte UI- und andere EOS-Instanzen müssen explizit
 * deaktiviert UND vom erreichbaren Controller als beendet gemeldet sein.
 *
 * Vertrauensgrenze: ioBroker-Controller/Objektdatenbank und Hostadministrator.
 * Dies ist keine verteilte atomare Sperre gegen einen manipulierten Controller,
 * einen manuell gestarteten Altprozess oder kompromittierte Fremdadapter.
 */
const { performance } = require('node:perf_hooks');
const { hasConfirmedLegacyStop } = require('./eosLegacyMigration');

const INSTANCE_RE = /^system\.adapter\.(?:nexowatt-ui|eos-admin)\.\d+$/;
const ALIVE_RE = /^system\.adapter\.(?:nexowatt-ui|eos-admin)\.\d+\.alive$/;
const LOCAL_UI_LIFECYCLE = /^system\.adapter\.nexowatt-ui\.\d+\.sigKill$/;
const MAX_INSTANCES = 128;
const LEASE_MS = 15000;
const REFRESH_MS = 5000;
const HOST_FRESH_MS = 60000;
const STATE_ID = 'info.eosOwnership';
const MIGRATION_PHASES = new Set(['IDLE', 'DISABLED', 'LICENSE_REQUIRED', 'NOT_NEEDED', 'BLOCKED', 'PREPARED',
    'STOPPING', 'TRANSFERRED', 'COMMITTED', 'ROLLING_BACK', 'ROLLED_BACK', 'ROLLBACK_REQUIRED']);

function instanceId(row) {
    return row && row.value && typeof row.value._id === 'string' ? row.value._id : '';
}

function createOwnershipGuard(owner) {
    if (!owner || !/^eos-admin\.\d+$/.test(owner.namespace || '')) {
        throw new Error('EOS_OWNERSHIP_OWNER_INVALID');
    }
    const ownId = `system.adapter.${owner.namespace}`;
    let running = false;
    let epoch = 0;
    let allowed = false;
    let validUntil = 0;
    let reason = 'NOT_STARTED';
    let blockers = [];
    let lastCheckedAt = null;
    let refreshTimer = null;
    let eventTimer = null;
    let pending = null;
    let lastPublished = '';

    function canWrite(scope = 'ui') {
        return running && allowed && performance.now() < validUntil && owner.eosMigration?.allowsWrites(scope) !== false;
    }

    function status(scope = 'ui') {
        const currentAllowed = canWrite(scope);
        const migrationBlocked = running && owner.eosMigration?.allowsWrites(scope) === false;
        let migration;
        if (migrationBlocked) {
            // Only fixed diagnostic fields cross this boundary. Never forward
            // the encrypted journal, source configuration or exception text.
            try {
                const value = owner.eosMigration?.status?.();
                migration = {
                    phase: typeof value?.phase === 'string' && MIGRATION_PHASES.has(value.phase) ? value.phase : 'NOT_AVAILABLE',
                    code: typeof value?.code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(value.code) ? value.code : '',
                };
            } catch {
                migration = { phase: 'NOT_AVAILABLE', code: 'EOS_MIGRATION_STATUS_UNAVAILABLE' };
            }
        }
        return {
            schema: 1,
            owner: owner.namespace,
            allowed: currentAllowed,
            reason: allowed && !currentAllowed ? (migrationBlocked ? 'MIGRATION_BLOCKED' : 'EVIDENCE_EXPIRED') : reason,
            generation: epoch,
            lastCheckedAt,
            blockers: blockers.map(row => ({ ...row })),
            ...(migration ? { migration } : {}),
        };
    }

    function publish() {
        const current = status();
        const signature = JSON.stringify({ ...current, lastCheckedAt: null });
        if (signature === lastPublished) return;
        lastPublished = signature;
        if (typeof owner.setStateAsync === 'function') {
            Promise.resolve(owner.setStateAsync(STATE_ID, { val: JSON.stringify(current), ack: true })).catch(() => {
                lastPublished = '';
                owner.log?.warn('EOS ownership diagnostic could not be persisted.');
            });
        }
    }

    function revoke(code, rows = []) {
        allowed = false;
        validUntil = 0;
        reason = code;
        blockers = rows;
        publish();
    }

    async function inspect() {
        const [ui, eos] = await Promise.all([
            owner.getObjectViewAsync('system', 'instance', {
                startkey: 'system.adapter.nexowatt-ui.', endkey: 'system.adapter.nexowatt-ui.\u9999',
            }),
            owner.getObjectViewAsync('system', 'instance', {
                startkey: 'system.adapter.eos-admin.', endkey: 'system.adapter.eos-admin.\u9999',
            }),
        ]);
        if (!Array.isArray(ui?.rows) || !Array.isArray(eos?.rows)) throw new Error('INVENTORY_INVALID');
        const rows = [...ui.rows, ...eos.rows];
        if (rows.length > MAX_INSTANCES) throw new Error('INVENTORY_LIMIT');
        const seen = new Set();
        const conflicts = [];
        for (const row of rows) {
            const id = instanceId(row);
            const object = row?.value;
            if (!INSTANCE_RE.test(id) || seen.has(id) || object.type !== 'instance' || !object.common) {
                throw new Error('INVENTORY_INVALID');
            }
            seen.add(id);
            if (id === ownId) {
                if (object.common.enabled !== true) conflicts.push({ instance: id, reason: 'OWNER_DISABLED' });
                continue;
            }
            const host = object.common.host;
            if (typeof host !== 'string' || !host || host.length > 255 || [...host].some(char => char.charCodeAt(0) <= 32 || char === '/' || char === '\\')) {
                conflicts.push({ instance: id, reason: 'HOST_UNKNOWN' });
                continue;
            }
            if (object.common.enabled !== false) {
                conflicts.push({ instance: id, host, reason: 'INSTANCE_ENABLED' });
                continue;
            }
            const [alive, controller] = await Promise.all([
                owner.getForeignStateAsync(`${id}.alive`),
                owner.getForeignStateAsync(`system.host.${host}.alive`),
            ]);
            // Missing/unknown states do not prove a stopped process. An offline
            // remote host can still control its devices, so it also blocks handover.
            if (!(await hasConfirmedLegacyStop(owner, object, alive))) {
                conflicts.push({ instance: id, host, reason: 'STOP_NOT_CONFIRMED' });
                continue;
            }
            const age = controller && typeof controller.ts === 'number' ? Date.now() - controller.ts : Infinity;
            if (!controller || controller.val !== true || controller.ack !== true || !Number.isFinite(age) || age < -5000 || age > HOST_FRESH_MS) {
                conflicts.push({ instance: id, host, reason: 'CONTROLLER_NOT_CONFIRMED' });
            }
        }
        if (!seen.has(ownId)) throw new Error('OWNER_NOT_IN_INVENTORY');
        return conflicts;
    }

    async function refresh() {
        if (!running) return false;
        if (pending) return pending;
        const startEpoch = epoch;
        pending = (async () => {
            try {
                const conflicts = await inspect();
                if (!running || epoch !== startEpoch) {
                    if (running) revoke('INVENTORY_CHANGED');
                    return false;
                }
                lastCheckedAt = Date.now();
                if (conflicts.length) {
                    revoke('LEGACY_OR_PARALLEL_WRITER', conflicts);
                    return false;
                }
                allowed = true;
                validUntil = performance.now() + LEASE_MS;
                reason = 'CONTROLLER_HANDOVER_CONFIRMED';
                blockers = [];
                publish();
                return true;
            } catch {
                if (running) revoke('INVENTORY_UNAVAILABLE');
                return false;
            } finally {
                pending = null;
            }
        })();
        return pending;
    }

    function changed(code) {
        if (!running) return;
        epoch += 1;
        revoke(code);
        if (eventTimer) clearTimeout(eventTimer);
        eventTimer = setTimeout(() => {
            eventTimer = null;
            void refresh();
        }, 100);
        eventTimer.unref?.();
    }

    function onObjectChange(id, object) {
        if (id === ownId) {
            if (!object || !object.common || object.common.enabled !== true) changed('OWNER_CHANGED');
        } else if (INSTANCE_RE.test(id || '')) changed('INSTANCE_CHANGED');
    }

    function onStateChange(id, state) {
        if ((id !== `${ownId}.alive` && ALIVE_RE.test(id || '')) || LOCAL_UI_LIFECYCLE.test(id || '')) changed('WRITER_STATE_CHANGED');
        // An offline controller revokes immediately. A heartbeat update to true
        // is not a handover and cannot itself grant permission.
        if (/^system\.host\..+\.alive$/.test(id || '') && (!state || state.val !== true || state.ack !== true)) {
            changed('CONTROLLER_STATE_CHANGED');
        }
    }

    async function start() {
        if (running) return refresh();
        running = true;
        epoch += 1;
        try {
            if (typeof owner.setObjectNotExistsAsync === 'function') {
                await owner.setObjectNotExistsAsync(STATE_ID, {
                    type: 'state',
                    common: { name: 'EOS controller ownership diagnostic', type: 'string', role: 'json', read: true, write: false },
                    native: {},
                    acl: { owner: 'system.user.admin', ownerGroup: 'system.group.administrator', object: 0x600, state: 0x600 },
                });
            }
            // Admin already subscribes broadly; registering specific patterns
            // also makes this module usable by a narrower owner implementation.
            await owner.subscribeForeignObjectsAsync('system.adapter.nexowatt-ui.*');
            await owner.subscribeForeignObjectsAsync('system.adapter.eos-admin.*');
            await owner.subscribeForeignStatesAsync('system.adapter.nexowatt-ui.*.alive');
            await owner.subscribeForeignStatesAsync('system.adapter.nexowatt-ui.*.sigKill');
            await owner.subscribeForeignStatesAsync('system.adapter.eos-admin.*.alive');
            await owner.subscribeForeignStatesAsync('system.host.*.alive');
        } catch {
            running = false;
            revoke('SUBSCRIPTION_UNAVAILABLE');
            return false;
        }
        if (!running) return false;
        refreshTimer = setInterval(() => void refresh(), REFRESH_MS);
        refreshTimer.unref?.();
        return refresh();
    }

    function stop() {
        running = false;
        epoch += 1;
        if (refreshTimer) clearInterval(refreshTimer);
        if (eventTimer) clearTimeout(eventTimer);
        refreshTimer = null;
        eventTimer = null;
        revoke('STOPPED');
        // The owner adapter owns shared database subscriptions and releases
        // them on unload. Do not remove another module's overlapping subscription.
    }

    return { start, refresh, canWrite, status, onObjectChange, onStateChange, stop };
}

module.exports = { createOwnershipGuard };
