/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/ocpp-limit-feedback.ts
 * Quell-Hash: sha256:53d1842e1c60a31eb42e6477d176cafcf995c5ecf48fdf0197a43392bd911aba
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/ocpp-limit-feedback.js.
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
exports.OcppControlLeases = void 0;
exports.ocppConnectionConfirmed = ocppConnectionConfirmed;
exports.resolveOcppRuntimeAlive = resolveOcppRuntimeAlive;
exports.resolveOcppLimitFeedback = resolveOcppLimitFeedback;
exports.ocppLeaseCapability = ocppLeaseCapability;
function record(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function power(value) { return finite(value) && value >= 0 && value <= 1e9; }
function code(value) { return typeof value === 'string' && /^[A-Za-z0-9_.:-]{0,160}$/.test(value) ? value : ''; }
function timestamp(state) {
    const value = Object.hasOwn(state, 'sourceTs') ? state.sourceTs : state.ts;
    return finite(value) && value > 0 ? value : 0;
}
function state(value, now, maxAgeMs) {
    if (!record(value) || value.ack !== true || (value.q !== undefined && value.q !== 0))
        return null;
    const ts = timestamp(value);
    return ts > 0 && ts <= now && now - ts <= maxAgeMs ? value : null;
}
/** Event-based connection flags may be unchanged, but must retain valid source metadata. */
function ocppConnectionConfirmed(value, now) {
    return state(value, now, Infinity)?.val === true;
}
/** Hosted workers heartbeat independently; a live Admin parent cannot authorize charging. */
function resolveOcppRuntimeAlive(input) {
    // Only a valid explicit false (confirmed migration rollback) permits external fallback.
    // Missing/invalid metadata on a present marker must never imply that rollback succeeded.
    const marker = state(input.marker, input.now, Infinity);
    const hosted = input.hostedNamespace || (input.marker !== null && input.marker !== undefined && marker?.val !== false);
    const markerValid = input.hostedNamespace || marker?.val === true;
    const heartbeat = markerValid ? state(input.runtimeAlive, input.now, 15000) : null;
    return { hosted, alive: hosted && heartbeat?.val === true, state: heartbeat };
}
function time(value) {
    if (finite(value))
        return value > 0 ? (value < 1e11 ? value * 1000 : value) : 0;
    if (typeof value !== 'string' || value.length > 40 || !/^\d{4}-\d\d-\d\dT/.test(value))
        return 0;
    const result = Date.parse(value);
    return Number.isFinite(result) ? result : 0;
}
function resolveOcppLimitFeedback(input) {
    const { now } = input;
    const maxAge = input.maxAgeMs ?? 120000;
    const contract = input.atomic !== undefined && input.atomic !== null || input.session !== undefined && input.session !== null
        ? 'atomic' : input.appliedW !== undefined && input.appliedW !== null || input.valid !== undefined && input.valid !== null ? 'watts' : 'legacy';
    const invalid = (error) => ({ valid: false, contract, requestedW: null, appliedW: null, commandAtMs: 0, reason: '', error });
    if (!finite(now) || !finite(maxAge) || maxAge < 1 || maxAge > 300000)
        return invalid('OCPP_FEEDBACK_CLOCK');
    // Connection flags are event based. Their original timestamp must exist,
    // but their unchanged age does not invalidate an otherwise current response.
    if (state(input.connected, now, Infinity)?.val !== true || state(input.alive, now, Infinity)?.val !== true)
        return invalid('OCPP_FEEDBACK_OFFLINE');
    if (contract === 'atomic') {
        const snapshot = state(input.atomic, now, maxAge);
        const session = state(input.session, now, Infinity);
        if (!snapshot || !session || typeof snapshot.val !== 'string' || snapshot.val.length > 4096)
            return invalid('OCPP_FEEDBACK_UNAVAILABLE');
        let parsed;
        try {
            parsed = JSON.parse(snapshot.val);
        }
        catch {
            return invalid('OCPP_FEEDBACK_INVALID');
        }
        if (!record(parsed) || parsed.schema !== 1 || typeof parsed.valid !== 'boolean' ||
            typeof parsed.sessionId !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(parsed.sessionId) || parsed.sessionId !== session.val ||
            !finite(parsed.updatedAtMs) || parsed.updatedAtMs > now || parsed.updatedAtMs < timestamp(session) ||
            now - parsed.updatedAtMs > maxAge || parsed.updatedAtMs > timestamp(snapshot))
            return invalid('OCPP_FEEDBACK_SESSION');
        if (parsed.valid !== true)
            return invalid(code(parsed.error) || 'OCPP_PROFILE_UNCONFIRMED');
        if (!power(parsed.requestedW) || !power(parsed.appliedW) || !finite(parsed.appliedAtMs) ||
            parsed.appliedAtMs < timestamp(session) || parsed.appliedAtMs > parsed.updatedAtMs ||
            parsed.appliedW > parsed.requestedW + 1 || (parsed.requestedW === 0 && parsed.appliedW !== 0))
            return invalid('OCPP_FEEDBACK_INVALID');
        return { valid: true, contract, requestedW: parsed.requestedW, appliedW: parsed.appliedW,
            commandAtMs: parsed.appliedAtMs, reason: code(parsed.reason), error: '' };
    }
    const requested = state(input.requested, now, maxAge);
    const applied = state(contract === 'watts' ? input.appliedW : input.legacyApplied, now, maxAge);
    if (!requested || !applied || !power(requested.val) || !power(applied.val))
        return invalid('OCPP_FEEDBACK_UNAVAILABLE');
    if (contract === 'watts') {
        const valid = state(input.valid, now, maxAge);
        // 0.4.2 publishes valid last. A partially updated tuple is not confirmed.
        if (!valid || valid.val !== true || timestamp(valid) < timestamp(requested) || timestamp(valid) < timestamp(applied))
            return invalid('OCPP_PROFILE_UNCONFIRMED');
        if (applied.val > requested.val + 1 || (requested.val === 0 && applied.val !== 0))
            return invalid('OCPP_FEEDBACK_INVALID');
        return { valid: true, contract, requestedW: requested.val, appliedW: applied.val,
            commandAtMs: timestamp(applied), reason: code(state(input.reason, now, maxAge)?.val), error: '' };
    }
    const success = state(input.success, now, maxAge);
    const command = state(input.command, now, maxAge);
    const commandAt = time(state(input.commandAt, now, maxAge)?.val);
    const unit = state(input.legacyUnit, now, Infinity)?.val;
    if ((unit !== undefined && unit !== '' && unit !== 'W') || command?.val !== 'SetChargingProfile' || success?.val !== true ||
        commandAt <= 0 || commandAt > now || now - commandAt > maxAge || state(input.error, now, maxAge)?.val)
        return invalid('OCPP_LEGACY_FEEDBACK_UNCONFIRMED');
    return { valid: true, contract, requestedW: requested.val, appliedW: applied.val, commandAtMs: commandAt,
        reason: code(state(input.reason, now, maxAge)?.val), error: '' };
}
/** The native 0.4.3 contract needs a fresh process lease, independent of a profile acknowledgement. */
function ocppLeaseCapability(support, atomic, session, now) {
    const required = support !== undefined && support !== null || atomic !== undefined && atomic !== null;
    const sessionId = state(session, now, Infinity)?.val;
    return { required, supported: state(support, now, Infinity)?.val === true && typeof sessionId === 'string'
            && /^[A-Za-z0-9_-]{16,128}$/.test(sessionId), sessionId: typeof sessionId === 'string' ? sessionId : '' };
}
/** A bounded renewal cache; successful local write is not a claim of physical or protocol acceptance. */
class OcppControlLeases {
    constructor() {
        this.renewed = new Map();
    }
    async renew(input) {
        if (!input.required)
            return true;
        if (!input.supported || !input.enabled || !finite(input.now) || input.now <= 0) {
            this.renewed.delete(input.root);
            return false;
        }
        const last = this.renewed.get(input.root);
        if (last && last.sessionId === input.sessionId && input.now >= last.at && input.now - last.at < 5000)
            return true;
        this.renewed.delete(input.root);
        if (this.renewed.size >= 128)
            return false;
        try {
            if (await input.write(input.now + 15000) !== true)
                return false;
        }
        catch {
            return false;
        }
        this.renewed.set(input.root, { at: input.now, sessionId: input.sessionId });
        return true;
    }
}
exports.OcppControlLeases = OcppControlLeases;
