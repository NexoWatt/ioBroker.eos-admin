'use strict';
/* Actual frontend discovery actions and hosted GET/POST configuration routes.
 * DOM, OCPP inventory and controller DB/auth are fixtures; no browser/hardware. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const { fixture, connector } = require('./fixtures/eos-ocpp-installer-actions.cjs');

test('background OCPP mapping refreshes a pristine form; dirty CAS conflicts preserve both drafts and saved mappings', async t => {
    const h = await createHarness(); const a = h.adapter;
    t.after(() => h.close());
    a.persistInstallerConfigToState = Object.getPrototypeOf(a).persistInstallerConfigToState.bind(a);
    a.nwWriteUserdataBackup = async () => {};
    a._nwApplyInstallerRuntime = async () => {};
    a.emsEngine = { stopForReconfigure: async () => {} };
    const token = await h.login('installer');
    const c = connector();
    const savedRow = { enabled: false, name: 'Automatisch gespeichert', powerId: c.ids.powerId,
        setPowerWId: c.ids.setPowerWId, maxPowerW: 7400, stationKey: '' };
    const backgroundSave = async rows => {
        const config = { settingsConfig: { evcsCount: rows.length, evcsList: structuredClone(rows), stationGroups: [] } };
        a._nwInstallerConfigPatch = structuredClone(config);
        a.config = a.nwApplyInstallerPatchToRuntimeConfig(a.config, structuredClone(config));
        assert.equal(await a.persistInstallerConfigToState(config), true);
    };
    await backgroundSave([]);
    const x = fixture([], [c, structuredClone(c)]);
    let loadCount = 0;
    x.context.loadConfig = async () => {
        loadCount++;
        const result = await h.request('/api/installer/config', { token });
        assert.equal(result.status, 200);
        x.context.currentConfig = structuredClone(result.data.config);
        x.context.configurationRevision = result.data.configurationRevision;
        x.api.clearDirty();
    };
    await x.context.loadConfig();
    const originalRevision = x.context.configurationRevision;
    await backgroundSave([savedRow]);
    await x.api.ocppAutoDetect();
    assert.equal(loadCount, 2, 'pristine action reads authoritative rows before merging');
    assert.equal(x.rows().length, 1);
    assert.equal(x.rows()[0].name, savedRow.name);
    assert.notEqual(x.context.configurationRevision, originalRevision);
    const firstRevision = x.context.configurationRevision;

    x.context.currentConfig.settingsConfig.evcsList[0].name = 'Ungespeicherter Entwurf';
    x.context.appCenterConfigDirty = true;
    await backgroundSave([savedRow, { enabled: false, name: 'Neu im Hintergrund', powerId: 'fixture.0.second' }]);
    await x.api.ocppMapExisting();
    assert.equal(loadCount, 2, 'dirty draft is not silently reloaded');
    assert.equal(x.context.configurationRevision, firstRevision);
    const rejected = await h.request('/api/installer/config', { method: 'POST', token, body: {
        patch: { settingsConfig: structuredClone(x.context.currentConfig.settingsConfig) },
        expectedConfigurationRevision: firstRevision, restartEms: true,
    } });
    assert.equal(rejected.status, 409);
    assert.equal(x.rows()[0].name, 'Ungespeicherter Entwurf');
    assert.equal(JSON.parse(h.states.get('eos-admin.0.installer.configJson').val).settingsConfig.evcsList.length, 2);

    await x.context.loadConfig();
    await x.api.ocppMapExisting();
    const accepted = await h.request('/api/installer/config', { method: 'POST', token, body: {
        patch: { settingsConfig: structuredClone(x.context.currentConfig.settingsConfig) },
        expectedConfigurationRevision: x.context.configurationRevision, restartEms: true,
    } });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
    const stored = JSON.parse(h.states.get('eos-admin.0.installer.configJson').val);
    assert.equal(stored.settingsConfig.evcsList.length, 2);
    assert.equal(stored.settingsConfig.evcsList[0].maxPowerW, 7400);
    assert.equal(stored.settingsConfig.evcsList[0].stationKey || '', '');
    assert.deepEqual(stored.settingsConfig.stationGroups, []);
});
