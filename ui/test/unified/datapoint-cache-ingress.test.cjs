'use strict';
/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('./http-harness.cjs');
const { DatapointRegistry } = require('../../ems/datapoints');

test('actual hosted stateChange ingress invalidates deleted EMS sources without calling value-only consumers', async () => {
  const h = await createHarness();
  try {
    const registry = new DatapointRegistry(h.owner, []);
    await registry.upsert({ key: 'grid', objectId: 'meter.0.power' });
    registry.handleStateChange('meter.0.power', { val: 100, ts: Date.now(), ack: true });
    let externalCalls = 0, logicCalls = 0;
    h.adapter.emsEngine = { dp: registry, handleExternalStateChange() { externalCalls++; } };
    h.adapter.logicEngine = { handleStateChange() { logicCalls++; } };
    h.adapter.onStateChange('meter.0.power', null);
    assert.equal(registry.getNumber('grid'), null);
    assert.equal(registry.getMeasurementAgeMs('grid'), Infinity);
    assert.equal(externalCalls, 0);
    assert.equal(logicCalls, 0);
  } finally { await h.close(); }
});
