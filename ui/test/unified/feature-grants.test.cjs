/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('./http-harness.cjs');
const { NexoLogicEngine } = require('../../ems/nexologic-engine');

function license(features) {
    return { valid: true, coreEnabled: true, edition: 'pro', limits: { chargePoints: 4, batteries: 1 }, features };
}

test('signed feature subset blocks direct SmartHome, NexoLogic and ledger APIs', async t => {
    const h = await createHarness(); t.after(() => h.close());
    h.bridge.getLicense = () => license(['energy']);
    h.adapter.smartHomeDevices = [{ id: 'relay', type: 'switch', io: { switch: { writeId: 'device.0.relay' } } }];
    const token = await h.login('admin');
    for (const [url, method, body] of [
        ['/api/smarthome/toggle', 'POST', { id: 'relay', value: true }],
        ['/api/logic/editor', 'GET'],
        ['/api/ledger/local-kwh', 'GET'],
        ['/api/mesh/coordinator/accounting/report', 'POST', {}],
    ]) {
        const response = await h.request(url, { token, method, body });
        assert.equal(response.status, 403, url);
        assert.equal(response.data.error, 'EOS_FEATURE_LICENSE_REQUIRED', url);
    }
    assert.equal(h.states.has('device.0.relay'), false);
    h.bridge.getLicense = () => license(['energy', 'smartHome']);
    const allowed = await h.request('/api/smarthome/toggle', { token, method: 'POST', body: { id: 'relay', value: true } });
    assert.equal(allowed.status, 200);
    assert.equal(h.states.get('device.0.relay').val, true);
    h.bridge.getLicense = () => license(['energy', 'wallet']);
    const info = h.adapter._nwBuildLicenseFeatureInfo();
    assert.equal(info.features.energyWalletOperator, false);
    assert.equal(info.features.multiSiteWallet, false);
    assert.equal((await h.request('/api/ledger/local-kwh', { token })).status, 200);
    assert.equal((await h.request('/api/mesh/coordinator/accounting/report', { token, method: 'POST', body: {} })).status, 403);
});

test('never-granted SmartHome cannot dispatch timer, scene or initialize NexoLogic', async t => {
    const h = await createHarness(); t.after(() => h.close());
    h.bridge.getLicense = () => license(['energy']);
    await assert.rejects(h.adapter._nwWriteSmartHomeSceneState('device.0.relay', true), /FEATURE_LICENSE_REQUIRED/);
    assert.equal(await h.adapter._nwExecuteSmartHomeTimerAction({ deviceId: 'relay' }, 'start'), false);
    await h.adapter.initLogicEngine();
    assert.equal(Boolean(h.adapter.logicEngine), false);
    const engine = new NexoLogicEngine(h.adapter);
    await assert.rejects(engine.init({ graphs: [] }), /FEATURE_LICENSE_REQUIRED/);
    assert.equal(h.states.has('device.0.relay'), false);
});

test('NexoLogic rechecks actual SmartHome grant before a later output dispatch', async t => {
    const h = await createHarness(); t.after(() => h.close());
    h.bridge.getLicense = () => license(['energy', 'smartHome']);
    const engine = new NexoLogicEngine(h.adapter); t.after(() => engine.stop());
    await engine.init({ graphs: [{ id: 'grant', enabled: true, nodes: [{ id: 'out', type: 'dp_out', params: { dpId: 'device.0.logic' } }], links: [] }] });
    assert.equal(engine.runners.length, 1);
    h.bridge.getLicense = () => license(['energy']);
    await assert.rejects(engine.runners[0]._requestOutput('out', 'device.0.logic', true, false, 'test', 'nexologic', {}), /FEATURE_LICENSE_REQUIRED/);
    assert.equal(h.states.has('device.0.logic'), false);
});
