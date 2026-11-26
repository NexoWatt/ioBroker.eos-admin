'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const { synchronizeChargingPointIdentity } = require('../ui/lib/charging-point-identity');

const point = name => ({ enabled: true, name, powerId: `fixture.${name}.power`, setPowerWId: `fixture.${name}.target`, minPowerW: 1380, maxPowerW: 11000 });
const station = (id, assignedChargepoints) => ({ id, name: id, token: `${id}_station_token_fixture_0123456789abcdef`, enabled: true,
    assignmentMode: 'manual', assignedChargepoints, allowedModes: ['solar', 'fast', 'auto'], allowStartStop: true, controlProfile: 'chargingManagement' });

async function fixture(t, states) {
    const h = await createHarness(), a = h.adapter;
    a._hostedStartup = { state: 'ready' };
    h.bridge.getLicense = () => ({ valid: true, coreEnabled: true, edition: 'pro', limits: { chargePoints: 50, batteries: 10 }, features: ['energy', 'wallet', 'smartHome'] });
    a._nwLicenseInfo = { ok: true }; a._nwLicenseOk = true;
    a.persistInstallerConfigToState = Object.getPrototypeOf(a).persistInstallerConfigToState;
    a.nwWriteUserdataBackup = async () => {};
    a.emsEngine = { stopForReconfigure: async () => {} };
    // These isolated tests run the real config/state/identity stages, not a live
    // EMS controller or charging station.
    a._nwApplyInstallerRuntime = async function () {
        await this.syncSettingsConfigToStates();
        await synchronizeChargingPointIdentity(this, this.config.settingsConfig.evcsList);
    };
    if (states) {
        for (const [id, state] of states) h.states.set(id, structuredClone(state));
        await a.loadInstallerConfigFromState();
    } else {
        a.config = { ...a.config, enableChargingManagement: true, settingsConfig: { evcsCount: 2, evcsList: [point('A'), point('B')] },
            chargeKiosk: { enabled: true, stations: [station('A', ['lp1']), station('B', ['lp2'])] } };
        a._nwInstallerConfigPatch = { enableChargingManagement: true, settingsConfig: structuredClone(a.config.settingsConfig),
            chargeKiosk: structuredClone(a.config.chargeKiosk), tariffProvider: { provider: 'tibber', token: 'fixture-token-retained' } };
    }
    await a._nwApplyInstallerRuntime();
    const token = await h.login('installer');
    const writes = [], write = h.owner.setForeignStateAsync;
    h.owner.setForeignStateAsync = async (id, ...args) => { writes.push(id); return write(id, ...args); };
    t.after(() => h.close());
    const stationUrl = id => `/api/display/station/${station(id, []).token}`;
    return { ...h, a, token, writes, stationUrl,
        getStation: id => h.request(stationUrl(id)),
        command: (id, body) => h.request(`${stationUrl(id)}/command`, { method: 'POST', body }),
        saved: () => JSON.parse(h.states.get('eos-admin.0.installer.configJson').val) };
}

test('one installer deletion atomically retires the A URL and moves the B URL by physical identity, including restart', async t => {
    const h = await fixture(t);
    const oldA = await h.getStation('A'), oldB = await h.getStation('B');
    assert.equal(oldA.status, 200, oldA.text); assert.equal(oldB.status, 200, oldB.text);
    assert.equal(oldA.data.connectors[0].id, 'lp1'); assert.equal(oldB.data.connectors[0].id, 'lp2');
    const loaded = await h.request('/api/installer/config', { token: h.token });
    const kept = structuredClone(loaded.data.config.settingsConfig.evcsList[1]);
    const response = await h.request('/api/installer/config', { token: h.token, method: 'POST', body: {
        expectedConfigurationRevision: loaded.data.configurationRevision,
        patch: { settingsConfig: { evcsCount: 1, evcsList: [kept] }, chargeKiosk: loaded.data.config.chargeKiosk },
    } });
    assert.equal(response.status, 200, response.text);
    assert.deepEqual(h.saved().chargeKiosk.stations.map(row => row.assignedChargepoints), [[], ['lp1']]);
    assert.equal(h.saved().tariffProvider.token, 'fixture-token-retained');
    assert.deepEqual(h.a.config.chargeKiosk, h.saved().chargeKiosk);

    for (const runtime of [h, await fixture(t, h.states)]) {
        const removed = await runtime.getStation('A'), retained = await runtime.getStation('B');
        assert.equal(removed.status, 200, removed.text); assert.equal(retained.status, 200, retained.text);
        assert.deepEqual(removed.data.connectors, []);
        assert.deepEqual(removed.data.chargingControlIdentity.slots, {});
        assert.equal(retained.data.connectors[0].id, 'lp1');
        const identity = retained.data.chargingControlIdentity.slots.lp1;
        assert.equal(typeof identity, 'string'); assert.ok(identity);
        runtime.writes.length = 0;
        const forbidden = await runtime.command('A', { lp: 'lp1', action: 'set-mode', mode: 'boost', expectedChargingIdentity: identity });
        assert.equal(forbidden.status, 403); assert.equal(forbidden.data.error, 'lp_not_assigned');
        assert.deepEqual(runtime.writes, [], 'even a correct B identity token cannot authorize the retired A URL');
        const accepted = await runtime.command('B', { lp: 'lp1', action: 'set-mode', mode: 'pv', expectedChargingIdentity: identity });
        assert.equal(accepted.status, 200, accepted.text);
        assert.equal(runtime.states.get('eos-admin.0.chargingManagement.wallboxes.lp1.userMode').val, 'pv');
        assert.ok(runtime.writes.every(id => !id.startsWith('fixture.')), 'station bridge only submits the current EOS control wish');
    }
});
