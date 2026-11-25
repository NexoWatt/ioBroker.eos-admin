'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveOcppLimitFeedback } = require('../ui/lib/ocpp-limit-feedback');
const { evaluateOcppCommandConfirmation } = require('../ui/ems/modules/charging-management');
const now = 1795600000000;
const sid = '11111111-2222-4333-8444-555555555555';
const state = (val, ts = now - 1000, extras = {}) => ({ val, ts, ack: true, q: 0, ...extras });
const payload = (patch = {}) => ({ schema: 1, valid: true, sessionId: sid, requestedW: 11000,
    appliedW: 10929.6, appliedAtMs: now - 2000, updatedAtMs: now - 1000, reason: 'watt-to-ampere-conservative', error: '', ...patch });
const atomic = (patch = {}) => ({ now, connected: state(true), alive: state(true), session: state(sid, now - 10000),
    atomic: state(JSON.stringify(payload(patch))) });

test('atomic profile uses confirmed watts, not raw wire amperes or unrelated command success', () => {
    const input = atomic(); input.legacyApplied = state(14.4); input.legacyUnit = state('A'); input.success = state(false);
    const result = resolveOcppLimitFeedback(input);
    assert.equal(result.valid, true); assert.equal(result.appliedW, 10929.6); assert.equal(result.commandAtMs, now - 2000);
    assert.equal(evaluateOcppCommandConfirmation({ targetW: 11000, requestedW: result.requestedW,
        appliedW: result.appliedW, appliedValid: result.valid, lastSuccess: result.valid, commandAt: result.commandAtMs, now }).confirmed, true);
});

test('current atomic response confirms zero and a conservative lower ceiling without inventing physical power', () => {
    for (const [requestedW, appliedW] of [[0, 0], [1000, 0], [11000, 10929.6]]) {
        const r = resolveOcppLimitFeedback(atomic({ requestedW, appliedW }));
        assert.equal(r.valid, true);
        assert.equal(evaluateOcppCommandConfirmation({ targetW: requestedW, requestedW, appliedW, appliedValid: true, lastSuccess: true, commandAt: r.commandAtMs, now }).confirmed, true);
    }
});

test('reconnect, pending/rejected, source quality and missing timestamps cannot fall back to old successful fields', () => {
    const variations = [
        x => { x.session = state('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'); },
        x => { x.atomic = state(JSON.stringify(payload({ valid: false, error: 'rejected' }))); },
        x => { x.atomic = state('{}'); }, x => { x.atomic = state('not-json'); },
        x => { x.atomic.q = 64; }, x => { x.atomic.ack = false; }, x => { delete x.atomic.ts; },
        x => { x.atomic.sourceTs = 0; }, x => { x.atomic.ts = now + 1; }, x => { x.atomic.ts = now - 120001; },
        x => { x.atomic = state(JSON.stringify(payload({ updatedAtMs: now + 1 })), now + 1); },
        x => { x.atomic = state(JSON.stringify(payload({ appliedAtMs: now - 20000 }))); },
        x => { x.connected = state(false); }, x => { x.alive = state(false); },
        x => { x.atomic = state(JSON.stringify(payload({ requestedW: 0, appliedW: 0.1 }))); },
        x => { x.atomic = state(JSON.stringify(payload({ appliedW: 11010 }))); },
        x => { x.atomic = state(JSON.stringify(payload({ requestedW: '11000' }))); },
    ];
    for (const mutate of variations) {
        const input = { ...atomic(), requested: state(11000), appliedW: state(11000), valid: state(true), legacyApplied: state(11000), success: state(true) };
        mutate(input); const result = resolveOcppLimitFeedback(input);
        assert.equal(result.valid, false); assert.equal(result.contract, 'atomic'); assert.equal(result.appliedW, null);
    }
});

test('0.4.2 watt tuple requires last validity publication and does not confuse amperes with watts', () => {
    const input = { now, connected: state(true), alive: state(true), requested: state(11000, now - 2000),
        appliedW: state(10929.6, now - 1500), valid: state(true), legacyApplied: state(14.4), legacyUnit: state('A') };
    assert.equal(resolveOcppLimitFeedback(input).appliedW, 10929.6);
    assert.equal(resolveOcppLimitFeedback({ ...input, valid: state(true, now - 2500) }).valid, false);
    assert.equal(resolveOcppLimitFeedback({ ...input, valid: state(false) }).valid, false);
    assert.equal(resolveOcppLimitFeedback({ ...input, appliedW: state(null) }).valid, false);
});

test('legacy result requires an actual successful profile response in watts', () => {
    const input = { now, connected: state(true), alive: state(true), requested: state(11000), legacyApplied: state(11000),
        command: state('SetChargingProfile'), commandAt: state(new Date(now - 1000).toISOString()), success: state(true), error: state('') };
    assert.equal(resolveOcppLimitFeedback(input).valid, true);
    assert.equal(resolveOcppLimitFeedback({ ...input, legacyUnit: state('A') }).valid, false);
    assert.equal(resolveOcppLimitFeedback({ ...input, command: state('GetConfiguration') }).valid, false);
    assert.equal(resolveOcppLimitFeedback({ ...input, success: state(false) }).valid, false);
});

test('invalid session and future response never become confirmed merely through matching old numeric values', () => {
    for (const extra of [{ appliedValid: false }, { commandAt: now + 1 }]) {
        assert.equal(evaluateOcppCommandConfirmation({ targetW: 0, requestedW: 0, appliedW: 0, lastSuccess: true,
            commandAt: now - 1000, now, ...extra }).confirmed, false);
    }
});
