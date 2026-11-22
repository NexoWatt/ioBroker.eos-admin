/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * Regression for negative vehicle-status parsing and pause/fault precedence.
 * --canonical executes the canonical TypeScript through Node type stripping.
 * The session-ambiguity probe is reported as OPEN, not as a recovery success.
 * No ioBroker, network, or hardware commands are issued.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const canonical = process.argv.includes('--canonical');
const runtimePath = path.join(root, 'ems/modules/charging-management.js');
const sourcePath = canonical
    ? path.join(root, 'src-ts/runtime-executables/ems/modules/charging-management.ts')
    : runtimePath;
const source = fs.readFileSync(sourcePath, 'utf8');
const runtime = canonical ? Module.stripTypeScriptTypes(source, { mode: 'strip', sourceUrl: sourcePath }) : source;
const mod = new Module(runtimePath, module);
mod.filename = runtimePath;
mod.paths = Module._nodeModulePaths(path.dirname(runtimePath));
mod._compile(runtime, runtimePath);
const m = mod.exports;
const results = [];
const cases = [
    ['No EV connected', {}, 'disconnected', false],
    ['noEVConnected', {}, 'disconnected', false],
    ['No vehicle', {}, 'disconnected', false],
    ['No EV connected, charging disabled', {}, 'disconnected', false],
    ['No EV connected - preparing', {}, 'disconnected', false],
    ['No vehicle, waiting for current', {}, 'disconnected', false],
    ['Kein Fahrzeug, charging disabled', {}, 'disconnected', false],
    ['Geen auto verbonden, preparing', {}, 'disconnected', false],
    ['EVConnected', {}, 'connected', true],
    ['B1 EV connected', {}, 'connected', true],
    ['B2 EV has the permission to charge', {}, 'ready_to_charge', true],
    ['Preparing', {}, 'ready_to_charge', true],
    ['Charging', {}, 'charging', true],
    ['SuspendedEV', {}, 'paused_by_vehicle', false],
    ['SuspendedEVSE', {}, 'paused_by_evse', true],
    ['Faulted - No EV connected', {}, 'faulted', false],
    ['Offline - No EV connected', {}, 'offline', false],
    ['Unavailable - No EV connected', {}, 'unavailable', false],
    ['Finishing', {}, 'finishing', false],
    ['Reserved', {}, 'reserved', false],
    ['C2 No EV connected', {}, 'charging', true],
    ['No EV connected', { statusDisconnectedValues: 'No EV connected' }, 'disconnected', false],
];
for (const [status, extra, expectedState, expectedStart] of cases) {
    const actual = m.classifyUniversalEvcsVehicleStatus({ status, statusFresh: true, ...extra });
    assert.equal(actual.state, expectedState, status);
    assert.equal(actual.startEligible, expectedStart, status);
    if (expectedState === 'disconnected') assert.equal(actual.plugged, false, status);
    results.push({ status, state: actual.state, startEligible: actual.startEligible });
}
// Keep explicit vehicle pauses and hard stops authoritative during ordinary
// conflicting evidence. A generic Connected/Occupied is no session boundary.
for (const [status, expected] of [['SuspendedEV', 'paused_by_vehicle'], ['Finishing', 'finishing'], ['Faulted', 'faulted'], ['Unavailable', 'unavailable'], ['Offline', 'offline']]) {
    const merged = m.mergeUniversalEvcsStatusEvidence({ evidence: [
        { status, fresh: true, source: 'transaction' },
        { status: 'Occupied', fresh: true, source: 'connector' },
    ] });
    const actual = m.resolveUniversalEvcsVehicleDemand({ actualPowerW: 0, classifiedStatus: merged });
    assert.equal(actual.state, expected);
    assert.equal(actual.startEligible, false);
    results.push({ status: `${status} with Occupied`, state: actual.state, startEligible: actual.startEligible });
}
// Read the real freshness expression. This is an observation of the remaining
// ambiguity, not a fabricated success criterion or a hardware diagnosis.
const match = runtime.match(/const chargingStateFresh = [\s\S]*?;/);
assert(match, 'Runtime charging-state freshness expression missing');
const oldPauseFresh = vm.runInNewContext(match[0] + '\nchargingStateFresh', {
    chargingStateText: 'SuspendedEV', telemetryProfile: 'ocpp-1.6-event-driven',
    ocppRuntimeAlive: true, chargingStateAgeMs: 24 * 3600000,
    wbStatusStaleTimeoutMs: 300000, vehicleLivenessFresh: true,
});
const ambiguousEvidence = m.mergeUniversalEvcsStatusEvidence({ evidence: [
    { status: 'SuspendedEV', fresh: oldPauseFresh, source: 'old-transaction' },
    { status: 'Preparing', fresh: true, source: 'current-connector' },
] });
const ambiguousDemand = m.reconcileOcppTransactionDemand({
    telemetryProfile: 'ocpp-1.6-event-driven', transactionKnown: true, transactionActive: false,
    vehicleDemand: m.resolveUniversalEvcsVehicleDemand({ actualPowerW: 0, classifiedStatus: ambiguousEvidence }),
});
console.log(JSON.stringify({
    scope: 'Parser and evidence-precedence regressions. No full-tick or hardware test.',
    source: canonical ? 'canonical-typescript' : 'generated-runtime',
    passed: results.length,
    results,
    openSessionAmbiguity: {
        status: 'OPEN', oldPauseFresh, normalizedState: ambiguousDemand.state,
        startEligible: ambiguousDemand.startEligible,
        reason: 'Old transaction state can dominate current Preparing; session boundary and actual device semantics are unproven. No automatic pause override applied.',
    },
}, null, 2));
