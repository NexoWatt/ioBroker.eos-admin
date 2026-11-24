/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DeviceRuntime } = require('../modules/devices/lib/deviceRuntime');
const templates = require('../modules/devices/lib/templates.json').templates;

test('MENNEKES V1 run retains the explicitly commanded 6 A instead of throwing or restoring 16 A', async t => {
    const template = templates.find(value => value.id === 'evcs.mennekes.amtron4you500.4business700.modbusTcp');
    const objects = new Map(), states = new Map(), writes = [], warnings = [];
    const adapter = { namespace: 'eos-admin.0',
        log: { debug() {}, info() {}, warn: value => warnings.push(value), error() {} },
        setObjectNotExistsAsync: async (id, value) => { if (!objects.has(id)) objects.set(id, value); },
        extendObjectAsync: async (id, value) => objects.set(id, { ...objects.get(id), ...value }),
        getStateAsync: async id => states.get(id) || null,
        setStateAsync: async (id, value) => states.set(id, value),
    };
    const runtime = new DeviceRuntime(adapter, { id: 'wallbox', templateId: template.id, protocol: 'modbusTcp', connection: {} }, template, {});
    t.after(() => runtime.stop());
    await runtime.initObjects();
    runtime.driver = { writeDatapoint: async (dp, value) => writes.push({ id: dp.id, value }), disconnect: async () => {} };
    const current = runtime.aliasByStateRelId.get('devices.wallbox.aliases.v1.ctrl.currentLimitA');
    const run = runtime.aliasByStateRelId.get('devices.wallbox.aliases.v1.ctrl.run');
    assert.ok(current); assert.ok(run);
    await runtime.handleStateChange('eos-admin.0.devices.wallbox.aliases.v1.ctrl.currentLimitA', { val: 6, ack: false });
    await runtime.handleStateChange('eos-admin.0.devices.wallbox.aliases.v1.ctrl.run', { val: true, ack: false });
    assert.deepEqual(writes.filter(value => value.id === current.writeDpId).map(value => value.value), [6, 6]);
    assert.equal(states.get('devices.wallbox.aliases.v1.ctrl.run').val, true);
    assert.equal(states.get('devices.wallbox.aliases.v1.ctrl.run').ack, true);
    assert.equal(warnings.some(value => /not defined|primaryCurrentWriteDp/.test(value)), false);
    await runtime.handleStateChange('eos-admin.0.devices.wallbox.aliases.v1.ctrl.run', { val: false, ack: false });
    assert.equal(writes.filter(value => value.id === current.writeDpId).at(-1).value, 0);
});
