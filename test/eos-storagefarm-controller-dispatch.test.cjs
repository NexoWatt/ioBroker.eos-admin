'use strict';
/** Actual storage controller tick, farm aggregation and dispatcher.
 * The database/device IO boundary is a fixture; no physical hardware writes. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const { SpeicherRegelungModule } = require('../ui/ems/modules/storage-control');
const { NvpCoordinatorModule } = require('../ui/ems/modules/nvp-coordinator');

async function fixture(t, options = {}) {
    const h = await createHarness(); const a = h.adapter;
    t.after(async () => { await new Promise(resolve => a.onUnload(resolve)); await h.close(); });
    a.config = structuredClone(require('../ui/io-package.json').native); a.config.port = 8188;
    await a.migrateNativeConfig(); await a.loadInstallerConfigFromState();
    a.config.emsApps.apps.storagefarm = { installed: true, enabled: options.enabled !== false };
    a.config.enableStorageFarm = true; a.config.enableStorageControl = false;
    a.config.enableMultiUse = options.multiUse === true; a.config.enablePeakShaving = false;
    a.config.storage = { ...a.config.storage, controlMode: 'targetPower',
        standaloneSelfDischargeEnabled: true, standaloneSelfMinSocPct: 10, standaloneSelfMaxSocPct: 100,
        staleTimeoutSec: 15, maxDeltaWPerTick: 5000, stepW: 1 };
    if (options.multiUse) a.config.installerConfig.storageMultiUse = {
        enabled: true, reserveEnabled: true, reserveMinSocPct: 10, reserveTargetSocPct: 10,
        peakEnabled: true, lskMinSocPct: 10, lskMaxSocPct: 50, selfEnabled: true, selfMinSocPct: 50, selfMaxSocPct: 100,
    };
    const rows = ['fenecon', 'solax'].map(name => ({ enabled: true, name,
        socId: `farm.${name}.soc`, signedPowerId: `farm.${name}.actual`, setSignedPowerId: `farm.${name}.set`,
        availableId: `farm.${name}.online`, faultId: `farm.${name}.fault`, dischargeAllowedId: `farm.${name}.allowed`,
        capacityKWh: 10, maxChargeW: 5000, maxDischargeW: 5000 }));
    Object.assign(rows[0], { vendorProfile: 'fenecon-openems', coupling: 'dc', feneconControlMode: 'direct-ess',
        feneconEssActualPowerId: rows[0].signedPowerId });
    for (const capability of options.capabilities || []) {
        rows[capability.member ?? 1][capability.direction === 'charge' ? 'allowedChargePowerId' : 'allowedDischargePowerId'] = `farm.capability.${capability.direction || 'discharge'}.${capability.member ?? 1}`;
    }
    if (options.capW !== undefined) rows[options.capMember ?? 1].maxDischargeW = options.capW;
    a.config.storageFarm = { enabled: true, mode: 'pool', selfTargetGridImportW: 0, selfImportThresholdW: 20, storages: rows };
    const writes = [];
    const originalWrite = h.owner.setForeignStateAsync;
    h.owner.setForeignStateAsync = async (id, value, ack) => {
        if (id === rows[0].setSignedPowerId || id === rows[1].setSignedPowerId) writes.push({ id, value });
        return originalWrite(id, value, ack);
    };
    const set = (id, val, unit = 'W', write = false, age = 0) => {
        h.states.set(id, { val, ts: Date.now() - age, ack: true });
        h.objects.set(id, { type: 'state', common: { type: typeof val, unit, read: true, write }, native: {} });
    };
    const socs = options.socs || [1, 98];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]; const age = options.staleMember === i ? 3600000 : 0;
        set(row.socId, socs[i], '%', false, age); set(row.signedPowerId, options.actuals?.[i] || 0, 'W', false, age);
        set(row.setSignedPowerId, 0, 'W', true); set(row.availableId, true, '', false, age);
        set(row.faultId, options.faultMember === i, '', false, age);
        set(row.dischargeAllowedId, options.deniedMember !== i, '', false, age);
    }
    for (const capability of options.capabilities || []) {
        const id = `farm.capability.${capability.direction || 'discharge'}.${capability.member ?? 1}`;
        set(id, capability.value, capability.unit || 'W', false, capability.age || 0);
        if (capability.patch) Object.assign(h.states.get(id), capability.patch);
    }
    await a.ensureStorageFarmStates(); await a.updateStorageFarmDerived('controller-dispatch-regression');
    const entries = new Map([
        ['grid.powerW', { val: options.gridW ?? 600, ts: Date.now() - (options.staleGrid ? 3600000 : 0), objectId: 'grid.actual' }],
        ['grid.powerRawW', { val: options.gridW ?? 600, ts: Date.now() - (options.staleGrid ? 3600000 : 0), objectId: 'grid.actual' }],
        // Deliberately keep a legacy first-member mapping. Farm authority must
        // obtain the aggregate, not mistakenly use this empty battery's SoC.
        ['st.socPct', { val: socs[0], ts: Date.now(), objectId: rows[0].socId }],
    ]);
    if (options.tariffBlock) entries.set('cm.dischargeAllowed', { val: false, ts: Date.now(), objectId: 'tariff.allowed' });
    const dp = {
        getEntry: key => entries.get(key) || null,
        getAgeMs: key => entries.has(key) ? Date.now() - entries.get(key).ts : null,
        getNumberFresh(key, stale, fallback = null) { return entries.has(key) && this.getAgeMs(key) <= stale ? this.getNumber(key, fallback) : fallback; },
        getNumber: (key, fallback = null) => { const v = entries.get(key)?.val; return typeof v === 'number' && Number.isFinite(v) ? v : fallback; },
        getBoolean: (key, fallback = false) => entries.has(key) ? entries.get(key).val === true : fallback,
        writeNumber: async () => { assert.fail('farm must not write through the legacy single-device path'); },
        writeBoolean: async () => { assert.fail('farm must not write through the legacy single-device path'); },
    };
    const controller = new SpeicherRegelungModule(a, dp);
    const state = id => h.states.get(`${a.namespace}.${id}`)?.val;
    return { ...h, rows, writes, controller, state, set,
        tick: async () => { await controller.tick(); return new Map(writes.map(row => [row.id, row.value])); } };
}

for (const socs of [[1, 98], [98, 1]]) test(`actual farm controller dispatches600W to eligible member at SoCs${socs.join('/')}`, async t => {
    const h = await fixture(t, { socs }); const commands = await h.tick();
    const full = socs[0] === 98 ? 0 : 1; const empty = 1 - full;
    assert.equal(h.state('storageFarm.totalSoc'), 49.5);
    assert.equal(h.state('speicher.regelung.socPct'), 49.5);
    assert.equal(h.state('speicher.regelung.selfMinSocPct'), 10);
    assert.equal(commands.get(h.rows[empty].setSignedPowerId), 0);
    assert.equal(commands.get(h.rows[full].setSignedPowerId), 600);
    assert.equal(h.state('speicher.regelung.farmAcceptedW'), 600);
});

test('both members below configured minimum receive no discharge command', async t => {
    const h = await fixture(t, { socs: [1, 6] }); await h.tick();
    assert.ok(h.writes.every(row => row.value <= 0));
    assert.equal(h.state('speicher.regelung.farmAcceptedW'), 0);
    assert.match(h.state('speicher.regelung.grund'), /SoC|Min-SoC/);
});

for (const capW of [0, 250]) test(`eligible member's explicit${capW}W limit remains binding`, async t => {
    const h = await fixture(t, { capW }); const commands = await h.tick();
    assert.equal(commands.get(h.rows[0].setSignedPowerId), 0);
    assert.equal(commands.get(h.rows[1].setSignedPowerId), capW);
    assert.equal(h.state('speicher.regelung.farmAcceptedW'), capW);
});

for (const gate of ['staleMember', 'faultMember', 'deniedMember']) {
    test(`eligible full member blocked by${gate} cannot discharge`, async t => {
        const h = await fixture(t, { [gate]: 1 }); await h.tick();
        assert.ok(h.writes.every(row => row.value <= 0));
        assert.ok((h.state('speicher.regelung.farmAcceptedW') || 0) === 0);
    });
    test(`empty member's${gate} does not block healthy full member`, async t => {
        const h = await fixture(t, { [gate]: 0 }); const commands = await h.tick();
        assert.equal(commands.get(h.rows[1].setSignedPowerId), 600);
        assert.equal(h.state('speicher.regelung.farmAcceptedW'), 600);
    });
}

for (const options of [{ staleGrid: true }, { tariffBlock: true }, { enabled: false }]) test(`global admission remains binding:${JSON.stringify(options)}`, async t => {
    const h = await fixture(t, options); await h.tick();
    assert.ok(h.writes.every(row => row.value <= 0));
});

test('explicit global MultiUse50% reserve blocks49.5% mean without silently overriding operator policy', async t => {
    const h = await fixture(t, { multiUse: true }); await h.tick();
    assert.equal(h.state('speicher.regelung.socPct'), 49.5);
    assert.equal(h.state('speicher.regelung.selfMinSocPct'), 50);
    assert.equal(h.state('speicher.regelung.aktivAutoMultiUse'), true);
    assert.ok(h.writes.every(row => row.value <= 0));
    assert.match(h.state('speicher.regelung.grund'), /49\.5%.*50%.*installerConfig\.storageMultiUse/);
});

test('farm write acceptance does not masquerade as measured response: 63W actual versus673W target times out', async t => {
    const h = await fixture(t, { actuals: [0, 63], gridW: 610 });
    const commands = await h.tick();
    assert.equal(commands.get(h.rows[0].setSignedPowerId), 0);
    assert.equal(commands.get(h.rows[1].setSignedPowerId), 673);
    assert.equal(h.state('storageFarm.totalPowerW'), 63);
    assert.equal(h.state('speicher.regelung.batteryPowerFeedbackMeasuredW'), 63);
    assert.equal(h.state('speicher.regelung.acceptedSollW'), 673);

    let now = Date.now(); t.mock.method(Date, 'now', () => now);
    const coordinator = new NvpCoordinatorModule(h.adapter, null, null);
    const refresh = () => {
        h.adapter._nvpFreshnessSnapshot = { ts: now, measurementAgeMs: 77, netW: 610, usable: true, connected: true };
        // Fresh device observations, unchanged physical output. The controller's
        // actual aggregate stays63W; only measurement age/time advance.
        h.set(`${h.adapter.namespace}.speicher.regelung.batteryPowerFeedbackSampleTs`, now, 'ms');
        h.set(`${h.adapter.namespace}.speicher.regelung.batteryPowerFeedbackAgeMs`, 0, 'ms');
    };
    refresh(); await coordinator.tick();
    assert.equal(h.adapter._nvpCoordinatorSnapshot.storageActualW, 63);
    assert.equal(h.adapter._nvpCoordinatorSnapshot.storageTargetW, 673);
    assert.equal(h.adapter._nvpCoordinatorSnapshot.storageWriteAccepted, true);
    assert.equal(h.adapter._nvpCoordinatorSnapshot.storageCommandCredited, true);

    now += 39900; refresh(); await coordinator.tick();
    const result = h.adapter._nvpCoordinatorSnapshot;
    assert.equal(result.storageActualW, 63);
    assert.equal(result.storagePendingDeltaW, 610);
    assert.equal(result.storageWriteAccepted, true);
    assert.equal(result.storageCommandCredited, false);
    assert.equal(result.projectedAfterStorageW, 610);
    assert.equal(result.status, 'storage-response-timeout');
});

for (const [value, expected] of [[0, 0], [250, 250], [9566, 600]]) test(`fresh device discharge capability ${value}W caps real controller allocation to ${expected}W`, async t => {
    const h = await fixture(t, { capabilities: [{ value }] }); const commands = await h.tick();
    assert.equal(commands.get(h.rows[1].setSignedPowerId), expected);
    assert.equal(h.state('speicher.regelung.farmAcceptedW'), expected);
    assert.equal(h.adapter.config.storageFarm.storages[1].maxDischargeW, 5000, 'customer fixed setting is not overwritten');
});

test('numeric hardware capability cannot raise an installer limit', async t => {
    const h = await fixture(t, { capW: 250, capabilities: [{ value: 9566 }] }); const commands = await h.tick();
    assert.equal(commands.get(h.rows[1].setSignedPowerId), 250);
});

for (const [label, capability, reason] of [['missing', { value: null }, 'missing'], ['stale', { value: 9566, age: 60000 }, 'stale'],
    ['unacknowledged', { value: 9566, patch: { ack: false } }, 'invalid'], ['bad quality', { value: 9566, patch: { q: 64 } }, 'invalid'],
    ['negative', { value: -1 }, 'invalid'], ['string', { value: '9566' }, 'invalid'], ['wrong unit', { value: 9.566, unit: 'kW' }, 'invalid']]) {
    test(`bound ${label} device capability blocks only its own direction without erasing mapping`, async t => {
        const h = await fixture(t, { capabilities: [capability] }); const commands = await h.tick();
        assert.equal(commands.get(h.rows[1].setSignedPowerId), 0);
        const rows = JSON.parse(h.state('storageFarm.storagesStatusJson'));
        assert.ok(rows[1].dischargeBlockedReasons.includes(`discharge_capability_${reason}`));
        assert.equal(rows[1].chargeDispatchAvailable, true);
        assert.equal(rows[1].dischargeCapability.valueW, null, 'unknown measured limit is not fabricated as zero');
        assert.equal(h.adapter.config.storageFarm.storages[1].allowedDischargePowerId, 'farm.capability.discharge.1');
    });
}

test('capability block of empty member does not suppress eligible full member', async t => {
    const h = await fixture(t, { capabilities: [{ member: 0, value: 0 }] }); const commands = await h.tick();
    assert.equal(commands.get(h.rows[1].setSignedPowerId), 600);
});

test('charge capability independently clamps charging while discharge admission remains intact', async t => {
    const h = await fixture(t, { socs: [50, 50], gridW: -600,
        capabilities: [{ direction: 'charge', member: 0, value: 0 }, { direction: 'charge', member: 1, value: 250 }] });
    const commands = await h.tick();
    assert.ok(commands.get(h.rows[0].setSignedPowerId) === 0);
    assert.equal(commands.get(h.rows[1].setSignedPowerId), -250);
    const rows = JSON.parse(h.state('storageFarm.storagesStatusJson'));
    assert.equal(rows[0].dischargeDispatchAvailable, true);
    assert.equal(rows[1].maxChargeW, 250);
});

for (const scenario of [
    { name: 'zero discharge', value: 0, target: 600, expectedGrid: 600 },
    { name: '250W discharge', value: 250, target: 600, expectedGrid: 350 },
    { name: 'stale discharge', value: 9566, age: 60000, target: 600, expectedGrid: 600 },
    { name: '250W charge', direction: 'charge', value: 250, target: -600, expectedGrid: 850 },
    { name: 'opposite direction stays available', value: 0, target: -600, expectedGrid: 1200 },
]) test(`exclusive native FEMS path honors bound capability: ${scenario.name}`, async t => {
    const h = await fixture(t, { socs: [50, 50], capabilities: [{ member: 0, ...scenario }] });
    const row = h.adapter.config.storageFarm.storages[0];
    row.feneconControlMode = 'fems-grid'; row.setSignedPowerId = '';
    row.feneconGridSetpointId = 'farm.fenecon.grid-target';
    h.adapter.config.storageFarm.storages = [row];
    h.set(row.feneconGridSetpointId, 600, 'W', true);
    h.set(`${h.adapter.namespace}.ems.gridPowerRawW`, 600);
    await h.adapter.updateStorageFarmDerived('native-capability-regression');
    const result = await h.adapter.applyStorageFarmTargetW(scenario.target, { source: 'eigenverbrauch' });
    assert.equal(result.commandEffective, true);
    assert.equal(h.states.get(row.feneconGridSetpointId).val, scenario.expectedGrid);
    assert.equal(row.maxDischargeW, 5000);
});
