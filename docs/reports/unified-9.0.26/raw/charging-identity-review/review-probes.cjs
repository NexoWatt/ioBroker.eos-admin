'use strict';
// Run from the repository root. Independent review probes use synthetic
// controller states only; production files are read, never modified.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = process.cwd();
const identity = require(path.join(root, 'ui/lib/charging-point-identity'));
const { createHarness } = require(path.join(root, 'ui/test/unified/http-harness.cjs'));
const files = ['ui/lib/charging-point-identity.js', 'ui/src-ts/runtime-executables/lib/charging-point-identity.ts',
    'ui/main.js', 'ui/src-ts/runtime-executables/main.ts', 'src/lib/eosUiProcessWorker.ts'];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const hashes = Object.fromEntries(files.map(file => [file, hash(file)]));
function fixture() {
    const states = new Map();
    return { namespace: 'eos-admin.0', states,
        async getStateAsync(id) { return states.get(id) || null; },
        async setStateAsync(id, state) { states.set(id, structuredClone(state)); },
        async setObjectNotExistsAsync() {},
    };
}
async function run() {
    const checks = [];
    for (const destination of ['eos-admin.0.evcs.2.mode', 'eos-admin.9.evcs.1.mode']) {
        const adapter = fixture(), row = { setCurrentAId: 'fixture.A.set', modeId: 'eos-admin.0.evcs.1.mode' };
        await identity.synchronizeChargingPointIdentity(adapter, [row]);
        const before = identity.publicChargingControlIdentity(adapter);
        await identity.synchronizeChargingPointIdentity(adapter, [{ ...row, modeId: destination }]);
        const current = identity.publicChargingControlIdentity(adapter);
        assert.notEqual(before.slots.lp1, current.slots.lp1);
        assert.throws(() => identity.assertChargingControlIdentity(adapter, 'lp1', { expectedChargingIdentity: before.slots.lp1 }), /IDENTITY_CHANGED/);
        identity.assertChargingControlIdentity(adapter, 'lp1', { expectedChargingIdentity: current.slots.lp1 });
    }
    checks.push('Default mirror exclusion is limited to exact own namespace and slot; another slot or instance rotates the token and rejects stale commands');
    const h = await createHarness();
    try {
        h.bridge.getLicense = () => ({ valid: true, coreEnabled: true, edition: 'pro',
            limits: { chargePoints: 50, batteries: 10 }, features: ['energy', 'wallet', 'smartHome'] });
        const row = { name: 'External bridge', enabled: true };
        h.adapter.evcsList = [{ ...row, index: 1 }];
        h.adapter.config.settingsConfig = { evcsCount: 1, evcsList: [row] };
        h.adapter.config.chargeKiosk = { enabled: true, stations: [{ id: 'fixture-bridge', token: 'fixture-bridge-token-long-enough',
            enabled: true, assignmentMode: 'manual', assignedChargepoints: ['lp1'], allowedModes: ['solar', 'fast'],
            allowStartStop: true, controlProfile: 'commandState', commandStateId: 'fixture.externalA.{lp}', writeChargingManagementMirror: false }] };
        await identity.synchronizeChargingPointIdentity(h.adapter, h.adapter.evcsList);
        const previous = identity.publicChargingControlIdentity(h.adapter);
        assert.ok(previous.slots.lp1);
        const route = '/api/display/station/fixture-bridge-token-long-enough/command';
        const command = expectedChargingIdentity => h.request(route, { method: 'POST',
            body: { lp: 'lp1', action: 'start', mode: 'fast', expectedChargingIdentity } });
        const first = await command(previous.slots.lp1);
        assert.equal(first.status, 200, first.text); assert.ok(h.states.has('fixture.externalA.lp1'));
        h.adapter.config.chargeKiosk.stations[0].commandStateId = 'fixture.externalB.{lp}';
        await identity.synchronizeChargingPointIdentity(h.adapter, h.adapter.evcsList);
        const denied = await command(previous.slots.lp1);
        assert.equal(denied.status, 409); assert.equal(h.states.has('fixture.externalB.lp1'), false);
        const current = identity.publicChargingControlIdentity(h.adapter);
        const next = await command(current.slots.lp1);
        assert.equal(next.status, 200, next.text); assert.ok(h.states.has('fixture.externalB.lp1'));
        checks.push('Unmapped manual point with an explicit custom Command-State remains operable; a changed bridge destination rejects the old token before any new target write');
    } finally { await h.close(); }
    const recovery = await createHarness();
    try {
        const adapter = recovery.adapter, row = { name: 'A', setCurrentAId: 'fixture.A.set', enabled: true };
        adapter.config.settingsConfig = { evcsCount: 1, evcsList: [row] }; adapter.evcsList = [{ ...row, index: 1 }];
        let stops = 0; adapter.emsEngine = { async stopForReconfigure() { stops++; } };
        await identity.synchronizeChargingPointIdentity(adapter, adapter.evcsList);
        await adapter._nwPrepareChargingPointReconfigure({ ...adapter.config,
            settingsConfig: { evcsCount: 1, evcsList: [{ ...row, setCurrentAId: 'fixture.B.set' }] } }, false);
        // A failed following config commit leaves the old config authoritative.
        assert.equal(adapter._nwEvcsIdentityTransitionPending, true);
        const restart = await adapter._nwPrepareChargingPointReconfigure(adapter.config, false);
        assert.ok(stops >= 1); assert.equal(restart, true, 'a previously stopped engine must restart after a successful recovery save');
        checks.push('After a failed precommit transition, retrying the unchanged saved layout requests an engine restart even with restartEms:false');
    } finally { await recovery.close(); }
    for (const file of files) assert.equal(hash(file), hashes[file], `source changed during review probes: ${file}`);
    console.log(JSON.stringify({ result: 'passed', node: process.version, runAt: new Date().toISOString(), checks,
        sourceHashes: hashes, scope: 'Independent real helper, station HTTP route and configuration-preparation probes; synthetic controller states, bridge and engine stop; no hardware or customer secrets.' }, null, 2));
}
run().catch(error => { console.error(error); process.exitCode = 1; });
