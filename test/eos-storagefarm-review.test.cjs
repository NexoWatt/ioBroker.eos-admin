'use strict';
/** Independent review regressions for the real farm overview collector. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');

async function fixture(t) {
    const h = await createHarness(); const a = h.adapter;
    t.after(async () => { await new Promise(resolve => a.onUnload(resolve)); await h.close(); });
    a.config = structuredClone(require('../ui/io-package.json').native); a.config.port = 8188;
    await a.migrateNativeConfig(); await a.loadInstallerConfigFromState();
    a.config.emsApps.apps.storagefarm = { installed: true, enabled: true }; a.config.enableStorageFarm = true;
    a.config.storageFarm = { enabled: true, storages: [] };
    await a.ensureStorageFarmStates();
    const set = (id, val, unit = 'W') => {
        h.states.set(id, { val, ts: Date.now(), ack: true });
        h.objects.set(id, { type: 'state', common: { type: 'number', unit }, native: {} });
    };
    const overview = async () => { await a.updateStorageFarmDerived('independent-review');
        return JSON.parse(h.states.get('eos-admin.0.storageFarm.overviewJson').val); };
    return { ...h, set, overview };
}

test('independent dotted device identities retain both PV sources in the real overview', async t => {
    const x = await fixture(t);
    for (const [name, pv] of [['storage.home', 1000], ['storage.solax', 2000]]) {
        const baseId = `eos-admin.0.devices.${name}`;
        const row = { enabled: true, name, _eosDevice: { v: 1, baseId }, signedPowerId: `${baseId}.aliases.v1.r.power`,
            socId: `${baseId}.aliases.v1.r.soc`, pvPowerId: `${baseId}.aliases.v1.r.pvPower`, capacityKWh: 10 };
        x.adapter.config.storageFarm.storages.push(row);
        x.set(row.signedPowerId, 0); x.set(row.socId, 50, '%'); x.set(row.pvPowerId, pv);
    }
    const result = await x.overview();
    assert.equal(result.pv.total, 2);
    assert.equal(result.pv.powerW, 3000);
});

test('two owner labels cannot duplicate one physical battery measurement in the real overview', async t => {
    const x = await fixture(t);
    for (const name of ['one', 'two']) {
        x.adapter.config.storageFarm.storages.push({ enabled: true, name,
            _eosDevice: { v: 1, baseId: `eos-admin.0.devices.${name}` }, signedPowerId: `alias.0.${name}.converter`,
            batteryFlowPowerId: 'alias.0.shared.battery', socId: `alias.0.${name}.soc`, capacityKWh: 10 });
        x.set(`alias.0.${name}.converter`, 1000); x.set(`alias.0.${name}.soc`, 50, '%');
    }
    x.set('alias.0.shared.battery', 1000);
    const result = await x.overview();
    assert.ok(result.battery.netW === null || result.battery.netW === 1000,
        'the shared measurement must be deduplicated or rejected, never counted twice');
});

test('explicit energy units cannot become valid watt measurements in the new farm display', async t => {
    const x = await fixture(t);
    const row = { enabled: true, name: 'Meter mismatch', signedPowerId: 'alias.0.power', socId: 'alias.0.soc',
        batteryFlowPowerId: 'alias.0.energy', pvPowerId: 'alias.0.pvEnergy', capacityKWh: 10 };
    x.adapter.config.storageFarm.storages.push(row);
    x.set(row.signedPowerId, 1000); x.set(row.socId, 50, '%');
    x.set(row.batteryFlowPowerId, 99999, 'Wh'); x.set(row.pvPowerId, 10000, 'kWh');
    const result = await x.overview();
    assert.equal(result.battery.netW, null);
    assert.equal(result.pv.powerW, null);
});
