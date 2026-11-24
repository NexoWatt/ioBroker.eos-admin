'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EosDeviceEmsService } = require('../src/lib/eosDeviceEmsService');
const { planDeviceEms } = require('../src/lib/eosDeviceEmsPlan');

function fixture(t) {
    const base = 'eos-admin.0.devices.ess1';
    const device = { id: 'ess1', templateId: 'solax-fixture', enabled: true, ems: { mode: 'storageFarm' } };
    const fields = [['r.soc', '%', false], ['r.power', 'W', false], ['ctrl.powerSetpointW', 'W', true],
        ['r.allowedChargePower', 'W', false], ['r.allowedDischargePower', 'W', false]];
    const objects = Object.fromEntries(fields.map(([key, unit, write]) => {
        const id = `${base}.aliases.v1.${key}`;
        return [id, { _id: id, type: 'state', common: { type: 'number', unit, read: true, write }, native: {
            isAlias: true, aliasContractVersion: 1, aliasContractPath: key, deviceId: device.id, templateId: device.templateId,
            deviceClass: 'storageSystem', capability: key, dpId: key.replace('.', '_'),
        } }];
    }));
    const states = new Map([[`${base}.aliases.meta.manifest`, { ack: true, val: JSON.stringify({
        schemaVersion: 1, namespace: 'v1', standardPath: 'aliases.v1', templateId: device.templateId,
        deviceClass: 'storageSystem', capabilities: fields.map(row => row[0]), missingRequired: [],
    }) }]]);
    const reads = []; let config = {}; let inventory; let generation = 1;
    const service = new EosDeviceEmsService({ owner: {
        getForeignStateAsync: async id => { reads.push(id); return states.get(id) || null; },
        getForeignObjectsAsync: async () => objects,
    }, getSnapshot: () => ({ namespace: 'eos-admin.0', devices: [device], moduleEnabled: true, ready: true, generation }),
    canRun: () => true, apply: async devices => {
        inventory = devices;
        const result = planDeviceEms({ config, devices, limits: { batteries: 10, chargePoints: 10 } });
        config = result.config; return result;
    } });
    t.after(() => service.stop());
    const id = direction => `${base}.aliases.v1.r.allowed${direction}Power`;
    const observe = (direction, val, patch = {}) => states.set(id(direction), { val, ack: true, ts: Date.now(), q: 0, ...patch });
    return { service, objects, states, reads, observe, id, device, nextGeneration: () => { generation++; }, config: () => config, inventory: () => inventory };
}

test('optional unsupported register objects alone do not bind or disable an existing device', async t => {
    const h = fixture(t); await h.service.flush();
    const row = h.config().storageFarm.storages[0];
    assert.equal(row.allowedChargePowerId, undefined); assert.equal(row.allowedDischargePowerId, undefined);
    assert.equal(h.inventory()[0].optionalPowerCapabilityPending, true);
    assert.equal(h.reads.length, 3, 'one manifest and exactly two bounded optional capability reads');
    for (let i = 0; i < 7; i++) await h.service.flush();
    assert.equal(h.service.timer, null, 'existing retry budget terminates; no indefinite discovery loop');
});

test('later valid capability measurement including zero fills binding once; stale later data never removes it', async t => {
    const h = fixture(t); await h.service.flush();
    h.observe('Charge', 9566, { ts: Date.now() - 5000 }); h.observe('Discharge', 0, { ts: Date.now() - 5000 }); await h.service.flush();
    assert.equal(h.config().storageFarm.storages[0].allowedDischargePowerId, undefined, 'one sample cannot prove effective refresh cadence');
    h.observe('Charge', 9566); h.observe('Discharge', 0); await h.service.flush();
    const row = h.config().storageFarm.storages[0];
    assert.equal(row.allowedChargePowerId, h.id('Charge')); assert.equal(row.allowedDischargePowerId, h.id('Discharge'));
    row.maxChargeW = 2500; row.maxDischargeW = 3500;
    h.observe('Discharge', 9566, { ts: Date.now() - 60000 });
    await h.service.flush();
    assert.equal(h.config().storageFarm.storages[0].allowedDischargePowerId, h.id('Discharge'));
    assert.equal(h.config().storageFarm.storages[0].maxDischargeW, 3500);
});

for (const [label, val, patch] of [['null', null, {}], ['numeric string', '9566', {}], ['negative', -1, {}],
    ['not acknowledged', 9566, { ack: false }], ['bad quality', 9566, { q: 64 }],
    ['stale', 9566, { ts: 1 }], ['future', 9566, { ts: Date.now() + 60000 }]]) {
    test(`automatic power capability binding rejects ${label}`, async t => {
        const h = fixture(t); h.observe('Discharge', val, patch); await h.service.flush();
        assert.equal(h.config().storageFarm.storages[0].allowedDischargePowerId, undefined);
    });
}

test('manual capability references and existing fixed limits survive subsequent inventory reconciliation', async t => {
    const h = fixture(t); await h.service.flush();
    const row = h.config().storageFarm.storages[0]; row.allowedDischargePowerId = 'alias.0.customer.cap'; row.maxDischargeW = 3210;
    h.observe('Discharge', 9566, { ts: Date.now() - 5000 }); await h.service.flush();
    h.observe('Discharge', 9566); await h.service.flush();
    assert.equal(h.config().storageFarm.storages[0].allowedDischargePowerId, 'alias.0.customer.cap');
    assert.equal(h.config().storageFarm.storages[0].maxDischargeW, 3210);
});

test('automatic numeric capability requires canonical W metadata, not guessed kW conversion', async t => {
    const h = fixture(t); h.objects[h.id('Discharge')].common.unit = 'kW'; h.observe('Discharge', 9.566);
    await h.service.flush(); assert.equal(h.config().storageFarm.storages[0].allowedDischargePowerId, undefined);
});

test('two actual slow source samples do not install a shorter capability freshness gate', async t => {
    const h = fixture(t); let now = Date.now(); t.mock.method(Date, 'now', () => now);
    h.observe('Discharge', 9566); await h.service.flush();
    now += 60000; h.observe('Discharge', 9566); await h.service.flush();
    assert.equal(h.config().storageFarm.storages[0].allowedDischargePowerId, undefined);
});

test('repeated cached sample does not prove source cadence; a later fresh sample does', async t => {
    const h = fixture(t); h.observe('Discharge', 9566, { ts: Date.now() - 5000 });
    await h.service.flush(); assert.equal(h.config().storageFarm.storages[0].allowedDischargePowerId, undefined);
    await h.service.flush(); assert.equal(h.config().storageFarm.storages[0].allowedDischargePowerId, undefined);
    h.observe('Discharge', 9566); await h.service.flush();
    assert.equal(h.config().storageFarm.storages[0].allowedDischargePowerId, h.id('Discharge'));
});

test('generation or explicit configuration change discards preceding cadence evidence', async t => {
    const h = fixture(t); h.observe('Discharge', 9566, { ts: Date.now() - 5000 }); await h.service.flush();
    h.nextGeneration(); h.observe('Discharge', 9566); await h.service.flush();
    assert.equal(h.config().storageFarm.storages[0].allowedDischargePowerId, undefined);
    h.service.request('configuration'); assert.equal(h.service.powerCapabilitySamples.size, 0);
});
