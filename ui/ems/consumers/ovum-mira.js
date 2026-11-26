/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/ems/consumers/ovum-mira.ts
 * Quell-Hash: sha256:17cf0153c25d5b054aeab130c8f881a243a8649826396e999a0e5a1076f78640
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für ems/consumers/ovum-mira.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
'use strict';

const { withActuatorShadowContext, priorityForOwner } = require('../services/actuator-shadow-arbiter');
const { liveSafetyEnvelope, evaluateFlexibleLoadRequest, commitFlexibleLoadDecision } = require('../services/safety-envelope');

const MAX_READING_AGE_MS = 30000;

function miraBinding(row, powerId, bindings, slot) {
    const ending = '.aliases.v1.ctrl.pvStatus';
    if (typeof row.miraPvStatusId !== 'string' || !row.miraPvStatusId.endsWith(ending)) return null;
    const base = row.miraPvStatusId.slice(0, -ending.length);
    if (!base || typeof powerId !== 'string' || !powerId.endsWith('.aliases.v1.r.power')
        || row.miraPowerTargetId !== base + '.aliases.v1.ctrl.pvPowerTargetW'
        || row.miraPvStatusReadId !== base + '.aliases.v1.r.pvStatus'
        || row.miraPowerTargetReadId !== base + '.aliases.v1.r.pvPowerTargetW') return null;
    const hsm = bindings?.[base];
    const wpmBase = powerId.slice(0, -'.aliases.v1.r.power'.length);
    const wpm = bindings?.[wpmBase];
    if (row._eosDevice?.baseId !== base || row._eosDevice?.mode !== 'mira'
        || hsm?.deviceTemplateId !== 'heat.ovum.mira.hsm' || hsm?.activationRequested !== true
        || !Number.isSafeInteger(hsm.miraCommissionedMaxW) || hsm.miraCommissionedMaxW <= 0
        || hsm.miraCommissionedMaxW > 10000000 || wpm?.target !== 'consumer' + slot + 'Power') return null;
    return { base, maxW: hsm.miraCommissionedMaxW, mode: row.miraPvStatusId, watts: row.miraPowerTargetId,
        modeRead: row.miraPvStatusReadId, wattsRead: row.miraPowerTargetReadId };
}

async function registerMiraDevice(dp, d) {
    if (!dp || !d.miraBinding || d.miraKeys || d.miraConflict || !d.miraSourcesConfirmed || !d.enabled) return;
    const keys = {};
    for (const [role, direction] of [['mode','out'], ['watts','out'], ['modeRead','in'], ['wattsRead','in']]) {
        const key = 'th.' + d.id + '.mira.' + role;
        await dp.upsert({ key, objectId: d.miraBinding[role], direction, unit: role.startsWith('watts') ? 'W' : '',
            dataType: 'number', deadband: 0 });
        keys[role] = key;
    }
    d.miraKeys = keys;
    d.miraCommands = {};
}

// Read the original controller sample. An outgoing state or a device heartbeat is not register feedback.
function miraSample(dp, key, now) {
    const ts = key && dp.getVerifiedMeasurementTimestampMs(key, now);
    if (!Number.isFinite(ts) || ts <= 0 || ts > now || now - ts > MAX_READING_AGE_MS) return null;
    const value = dp.getNumber(key, null);
    return typeof value === 'number' && Number.isFinite(value) ? { value, ts } : null;
}

function currentRegister(d, role, sample) {
    const last = d.miraCommands[role];
    return sample && (!last || sample.ts >= last.ts) ? sample.value : null;
}

// One asynchronous device command per tick. Repeated writes use the existing bounded actuator contract.
async function requestRegister(thermal, d, role, value, sample, now) {
    const id = 'thermal:' + d.id + ':mira:' + role;
    const contract = thermal._actuatorContract;
    const cfg = thermal._contractCfg(d, true);
    const decision = contract.prepare(id, value, now, cfg);
    const actual = currentRegister(d, role, sample);
    const last = d.miraCommands[role];
    if (actual === value && (!last || value === last.value)) return contract.confirmFromReadback(id, value, actual, true, now);
    if (!decision.allowed) return contract.result(id, now);
    const key = d.miraKeys[role];
    const owner = 'thermal.' + d.id;
    const result = await withActuatorShadowContext(thermal.adapter, {
        owner, module: 'thermalControl', priority: priorityForOwner(owner), leaseMs: 20000,
        enforceAuthority: true, releaseAuthority: role === 'mode' && value === 0, kind: 'thermal-mira',
    }, () => thermal.dp.writeNumber(key, value, false));
    // Includes uncertain transport failures: a late pre-command sample must never authorize boost.
    d.miraCommands[role] = { value, ts: now };
    return contract.complete(id, value, result === true, null, actual, now, cfg);
}

function miraSafetyGrant(thermal, d, requestedW, measuredW, now) {
    const adapter = thermal.adapter;
    // The productive EMS always supplies a generation and independent physical NVP measurements.
    if (!adapter?._emsSafetyCycle || measuredW === null || requestedW <= 0) return null;
    const envelope = liveSafetyEnvelope(adapter, thermal.dp, { now, generation: adapter._emsSafetyCycle.generation });
    if (!envelope || !envelope.valid) return null;
    return evaluateFlexibleLoadRequest(adapter, {
        key: 'thermal:' + d.id, app: 'thermal', deviceKey: d.id, requestedW, currentActualW: measuredW,
        currentActualFresh: true, phaseCount: Math.max(1, Math.min(3, Number(envelope.phase?.requiredCount) || 3)),
        voltageV: Number(envelope.phase?.voltageV) || 230, deviceCapW: d.maxPowerW, now,
    });
}

async function regulateMira(thermal, d, options) {
    const now = Date.now();
    const measured = miraSample(thermal.dp, d.pWKey, now);
    const measuredW = measured && measured.value >= 0 ? measured.value : null;
    const result = { applied: false, targetW: 0, usedW: measuredW ?? 0, owned: false, status: 'mira_not_commissioned' };
    if (!d.miraKeys || !d.miraSourcesConfirmed || !d.enabled || d.miraConflict) return result;
    // During manual operation relinquish only a boost that this worker had actually requested.
    if (options.manual && !d.miraBoostIssued) return { ...result, status: 'mira_manual' };
    const mode = miraSample(thermal.dp, d.miraKeys.modeRead, now);
    const watts = miraSample(thermal.dp, d.miraKeys.wattsRead, now);
    const actualMode = currentRegister(d, 'mode', mode);
    const actualWatts = currentRegister(d, 'watts', watts);
    const hasFeedback = !!mode && [0, 1, 2].includes(mode.value) && !!watts && Number.isInteger(watts.value) && watts.value >= 0;
    const requestedW = Math.floor(Math.max(0, Math.min(d.maxPowerW, d.miraBinding.maxW, options.requestedW)));
    const grant = hasFeedback && !options.manual && !thermal._isPara14aActive()
        ? miraSafetyGrant(thermal, d, requestedW, measuredW, now) : null;
    const allowedW = Math.max(0, Math.floor(Math.min(requestedW, grant?.allowedW || 0)));
    const lastWatts = d.miraCommands.watts;
    const lastMode = d.miraCommands.mode;
    const boostPossible = actualMode === 1 || (actualMode === null && lastMode?.value === 1);
    const needsReduction = boostPossible && Math.max(watts?.value || 0, lastWatts?.value || 0) > allowedW;
    let r;
    if (!allowedW || needsReduction) {
        // 0 returns temperature control to MIRA. It neither stops the compressor nor demonstrates a load reduction.
        r = await requestRegister(thermal, d, 'mode', 0, mode, now);
        if (r.confirmed) d.miraBoostIssued = false;
        result.status = r.confirmed ? 'mira_local_control' : 'mira_neutral_' + r.status;
        if (requestedW > 0 && (!hasFeedback || measuredW === null)) result.status = 'mira_missing_feedback_' + result.status;
    } else {
        // A smaller confirmed target may activate while the PV grant is increasing. Never enable a target
        // above the current grant. Updating an already active target still requires fresh HSM readback.
        const staged = actualMode !== 1 && lastWatts?.value > 0 && lastWatts.value <= allowedW;
        const desired = staged ? lastWatts.value : allowedW;
        result.targetW = desired;
        if (actualWatts !== desired || (lastWatts && lastWatts.value !== desired)) {
            r = await requestRegister(thermal, d, 'watts', desired, watts, now);
            result.status = 'mira_target_' + r.status;
        } else {
            d.miraBoostIssued = true;
            r = await requestRegister(thermal, d, 'mode', 1, mode, now);
            result.owned = r.confirmed && !options.boost;
            result.applied = r.confirmed;
            result.status = r.confirmed ? 'mira_pv_readback' : 'mira_pv_' + r.status;
        }
        // Reserve the permitted demand while the two register writes are in flight. Neither the grant
        // nor the MIRA register echoes is promoted to a physical reduction in accepted-power-effects.
        commitFlexibleLoadDecision(thermal.adapter, grant, true);
        result.usedW = Math.max(result.usedW, desired);
    }
    result.accepted = r.accepted;
    result.applied = result.applied || (allowedW === 0 && r.confirmed);
    await thermal._publishThermalContract(d, 'thermal.' + d.id, r);
    return result;
}

module.exports = { miraBinding, registerMiraDevice, regulateMira, miraSample };
