'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, connector, clone } = require('./fixtures/eos-ocpp-installer-actions.cjs');

test('new OCPP mappings leave manual station/group assignment empty', async () => {
    for (const action of ['ocppAutoDetect', 'ocppMapExisting']) {
        const x = fixture(); const groups = clone(x.context.currentConfig.settingsConfig.stationGroups);
        await x.api[action]();
        assert.equal(x.rows().length, 1);
        assert.equal(x.rows()[0].stationKey || '', '');
        assert.equal(x.rows()[0].enabled, false);
        assert.equal(x.rows()[0].powerId, connector().ids.powerId);
        assert.deepEqual(x.context.currentConfig.settingsConfig.stationGroups, groups);
        assert.equal(x.context.configurationRevision, 'original-cas-token');
    }
});

test('repeated discovery preserves commissioned values and does not replace the list', async () => {
    const c = connector();
    const commissioned = { enabled: true, name: 'Eigener Name', stationKey: 'manual-group', powerId: c.ids.powerId,
        setPowerWId: c.ids.setPowerWId, maxPowerW: 6900, minPowerW: 1380, chargerType: 'ac', phases: 1,
        minCurrentA: 6, maxCurrentA: 30, custom: { preserve: true } };
    const foreign = { name: 'Modbus', enabled: true, powerId: 'devices.0.power', setCurrentAId: 'devices.0.current' };
    for (const action of ['ocppAutoDetect', 'ocppMapExisting']) {
        const x = fixture([foreign, commissioned]);
        await x.api[action](); await x.api[action]();
        assert.equal(x.rows().length, 2);
        assert.deepEqual(x.rows()[0], foreign);
        for (const field of Object.keys(commissioned)) assert.deepEqual(x.rows()[1][field], commissioned[field], field);
    }
});

test('duplicate discovery entries and equivalent aliases yield one physical station row', async () => {
    const c = connector('ocpp21.0.ENERGYLINE');
    for (const action of ['ocppAutoDetect', 'ocppMapExisting']) {
        const x = fixture([], [c, clone(c)]);
        await x.api[action](); await x.api[action]();
        assert.equal(x.rows().length, 1);
        const aliases = fixture([{ stationKey: 'manual-group', enabled: false,
            setPowerWId: 'alias.0.nexowatt.ocpp.0.ENERGYLINE.control.chargeLimit' }], [c, clone(c)]);
        await aliases.api[action]();
        assert.equal(aliases.rows().length, 1);
        assert.equal(aliases.rows()[0].stationKey, 'manual-group');
        assert.equal(aliases.rows()[0].setPowerWId, c.ids.setPowerWId);
    }
});

test('physical station metadata identifies incomplete mappings without assigning display groups', async () => {
    const c = connector();
    const x = fixture([{ enabled: false, name: 'Behalten', stationKey: 'manual-group',
        powerId: 'custom.0.meter', ocppDiscovery: { source: 'nexowatt-ocpp21', stationRoot: c.base, controlScope: 'station' } }]);
    await x.api.ocppMapExisting();
    assert.equal(x.rows().length, 1);
    assert.equal(x.rows()[0].powerId, 'custom.0.meter');
    assert.equal(x.rows()[0].stationKey, 'manual-group');
});

test('existing mapped rows survive a stale lower EVCS count during explicit discovery', async () => {
    const c = connector(); const row = { name: 'Behalten', enabled: true, stationKey: 'manual-group', powerId: c.ids.powerId, maxPowerW: 7000 };
    const x = fixture([row], [c], 0);
    await x.api.ocppMapExisting();
    assert.equal(x.rows().length, 1);
    assert.equal(x.rows()[0].name, row.name);
    assert.equal(x.rows()[0].enabled, true);
    assert.equal(x.rows()[0].stationKey, row.stationKey);
    assert.equal(x.rows()[0].maxPowerW, row.maxPowerW);
});

test('pending discovery excludes simultaneous load/save/discovery and keeps the original CAS token', async () => {
    const x = fixture(); let release;
    x.context.fetchJson = async () => { x.context.fetches++; return new Promise(resolve => { release = resolve; }); };
    const first = x.api.ocppMapExisting();
    assert.equal(x.context.appCenterMutationBusy, true);
    await assert.rejects(x.api.ocppAutoDetect(), /läuft bereits|MUTATION_BUSY/);
    assert.equal(x.context.fetches, 1);
    release({ connectors: [connector()] }); await first;
    assert.equal(x.context.appCenterMutationBusy, false);
    assert.equal(x.context.configurationRevision, 'original-cas-token');
});

test('pristine detection adopts the authoritative saved rows and their exact CAS revision first', async () => {
    const c = connector(); const saved = { enabled: false, name: 'Vom Server', stationKey: 'manual-group',
        powerId: c.ids.powerId, setPowerWId: c.ids.setPowerWId, maxPowerW: 7400 };
    const x = fixture(); x.context.appCenterConfigDirty = false;
    let reloads = 0;
    x.context.loadConfig = async () => {
        reloads++;
        x.context.currentConfig.settingsConfig.evcsList = [clone(saved)];
        x.context.currentConfig.settingsConfig.evcsCount = 1;
        x.context.configurationRevision = 'fresh-authoritative-revision';
    };
    await x.api.ocppAutoDetect();
    assert.equal(reloads, 1);
    assert.equal(x.rows().length, 1);
    for (const field of Object.keys(saved)) assert.deepEqual(x.rows()[0][field], saved[field], field);
    assert.equal(x.context.configurationRevision, 'fresh-authoritative-revision');
});

test('dirty discovery preserves the draft and its CAS token while the server may have newer mappings', async () => {
    const c = connector(); const x = fixture([{ name: 'Lokaler Entwurf', powerId: c.ids.powerId }]);
    x.context.loadConfig = async () => { throw new Error('dirty draft must not be reloaded'); };
    await x.api.ocppAutoDetect();
    assert.equal(x.rows()[0].name, 'Lokaler Entwurf');
    assert.equal(x.context.configurationRevision, 'original-cas-token');
});

test('native applied-limit feedback and physical metadata are retained without converting manual rows to auto-managed writers', async () => {
    const c = connector();
    c.ids.appliedChargeLimitWId = `${c.base}.control.appliedChargeLimitW`;
    c.ids.appliedChargeLimitValidId = `${c.base}.control.appliedChargeLimitValid`;
    c.ocppDiscovery = { source: 'nexowatt-ocpp21', stationRoot: c.base, controlScope: 'station',
        autoCreated: true, code: 'COMMISSIONING_REQUIRED' };
    const x = fixture([], [c]); await x.api.ocppMapExisting();
    assert.equal(x.rows()[0].appliedChargeLimitWId, c.ids.appliedChargeLimitWId);
    assert.equal(x.rows()[0].appliedChargeLimitValidId, c.ids.appliedChargeLimitValidId);
    assert.deepEqual(x.rows()[0].ocppDiscovery, c.ocppDiscovery);
    const manual = fixture([{ powerId: c.ids.powerId, enabled: true }], [c]);
    await manual.api.ocppMapExisting();
    assert.equal(manual.rows()[0].ocppDiscovery, undefined);
    const managed = fixture([{ powerId: c.ids.powerId, ocppDiscovery: { ...c.ocppDiscovery, autoCreated: false } }], [c]);
    await managed.api.ocppMapExisting();
    assert.equal(managed.rows()[0].ocppDiscovery.autoCreated, false);
});

test('a configured read-only monitor never gains a command target from either discovery action', async () => {
    const c = connector();
    for (const action of ['ocppAutoDetect', 'ocppMapExisting']) {
        const x = fixture([{ enabled: true, name: 'Nur messen', powerId: c.ids.powerId }]);
        await x.api[action]();
        assert.equal(x.rows().length, 1);
        assert.equal(x.rows()[0].enabled, true);
        for (const field of ['setPowerWId', 'setCurrentAId', 'enableWriteId']) assert.equal(x.rows()[0][field], undefined);
    }
});

test('mixed or duplicated physical mappings are left unchanged and never get another row appended', async () => {
    const c = connector();
    for (const rows of [
        [{ powerId: c.ids.powerId, setPowerWId: 'eos-admin.0.ocpp.OTHER.control.chargeLimit' }],
        [{ powerId: c.ids.powerId }, { setPowerWId: c.ids.setPowerWId }],
    ]) {
        const x = fixture(rows); await x.api.ocppMapExisting();
        assert.deepEqual(x.rows(), rows);
        assert.ok(x.statuses.at(-1)[0].includes('widersprüchliche'));
        assert.equal(x.statuses.at(-1)[1], 'error');
    }
});

test('actual EVCS input mutation prevents automatic reload without a test-forced dirty flag', async () => {
    const c = connector(); const x = fixture([{ enabled: false, powerId: c.ids.powerId, name: 'Gespeichert' }]);
    x.api.clearDirty();
    let reloads = 0;
    x.context.loadConfig = async () => { reloads++; x.context.currentConfig.settingsConfig.evcsList[0].name = 'Gespeichert'; };
    x.api._updateEvcsField(1, 'name', 'Ungespeicherter Name');
    await x.api.ocppMapExisting();
    assert.equal(reloads, 0);
    assert.equal(x.rows()[0].name, 'Ungespeicherter Name');
});

test('direct station-group edits and uncommitted DOM values prevent automatic reload even without a dirty flag', async () => {
    for (const mutate of [
        x => { x.context.currentConfig.settingsConfig.stationGroups[0].maxPowerKw = 17; },
        x => { x.inputs[0].value = 'Noch nicht als change übernommen'; },
    ]) {
        const x = fixture(); x.inputs = [{ id: 'station-name', name: '', type: 'text', value: 'Gespeichert', checked: false }];
        x.context.document.querySelectorAll = () => x.inputs;
        x.api.clearDirty();
        mutate(x);
        assert.equal(x.context.appCenterConfigDirty, false, 'case exercises snapshot detection rather than the flag');
        let reloads = 0; x.context.loadConfig = async () => { reloads++; };
        await x.api.ocppMapExisting();
        assert.equal(reloads, 0);
    }
});

test('current-only native aliases deduplicate and mixed current writers remain fenced', async () => {
    const c = connector('ocpp21.0.ENERGYLINE');
    const currentOnly = { enabled: false, stationKey: 'manual-group',
        setCurrentAId: 'alias.0.nexowatt.ocpp.0.ENERGYLINE.control.currentLimitA', controlPreference: 'currentA' };
    const x = fixture([currentOnly], [c]);
    await x.api.ocppMapExisting();
    assert.equal(x.rows().length, 1);
    assert.equal(x.rows()[0].setCurrentAId, currentOnly.setCurrentAId);
    assert.equal(x.rows()[0].stationKey, currentOnly.stationKey);
    assert.equal(x.rows()[0].controlPreference, currentOnly.controlPreference);
    const mixed = { powerId: c.ids.powerId, setCurrentAId: 'ocpp21.0.OTHER.control.currentLimitA' };
    const y = fixture([mixed], [c]); await y.api.ocppMapExisting();
    assert.deepEqual(y.rows(), [mixed]);
    assert.equal(y.statuses.at(-1)[1], 'error');
});
