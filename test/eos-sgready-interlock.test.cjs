/** Copyright (c) 2026 NexoWatt. All rights reserved. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { applySgReady } = require('../ui/ems/consumers/sg-ready');

function heatPump(options = {}) {
    const consumer = { sg1Key: 'sg1', sg2Key: 'sg2', enableKey: 'enable', ...options };
    const outputs = { sg1: !!consumer.invert1, sg2: !!consumer.invert2, enable: false };
    const writes = [];
    const dp = {
        getEntry: key => key in outputs,
        getBoolean: key => outputs[key],
        async writeBoolean(key, value) { writes.push([key, value]); outputs[key] = value; return true; },
    };
    return { dp, outputs, writes, apply: state => applySgReady({ dp }, consumer, { state }) };
}

test('SG-Ready completes the contact sequence before release, withdraws release before changing active contacts', async () => {
    const h = heatPump();
    assert.ok((await h.apply('boost')).applied);
    assert.deepEqual(h.writes, [['enable', false], ['sg1', true], ['sg2', true], ['enable', true]]);
    h.writes.length = 0;
    await h.apply('on');
    assert.deepEqual(h.writes, [['enable', false], ['sg1', true], ['sg2', false], ['enable', true]]);
    h.writes.length = 0;
    await h.apply('on');
    assert.ok(!h.writes.some(([key, value]) => key === 'enable' && !value));
    await h.apply('block');
    assert.deepEqual(h.outputs, { sg1:false, sg2:true, enable:false });
});

for (const hasEnable of [true, false]) {
    test(`SG-Ready rolls back partial Boost with release relay ${hasEnable}, respecting contact inversion`, async () => {
        const h = heatPump({ enableKey: hasEnable ? 'enable' : '', invert1:true });
        const write = h.dp.writeBoolean;
        h.dp.writeBoolean = async (key, value) => {
            if (key === 'sg2' && value) return false;
            return write(key, value);
        };
        assert.equal((await h.apply('boost')).applied, false);
        assert.deepEqual(h.outputs, { sg1:true, sg2:false, enable:false });
        assert.ok(!h.writes.some(([key, value]) => key === 'enable' && value));
    });
}

test('SG-Ready cancels a failed enable write, and a missing configured contact blocks release', async () => {
    const h = heatPump();
    const write = h.dp.writeBoolean;
    h.dp.writeBoolean = async (key, value) => {
        if (key === 'enable' && value) throw new Error('offline');
        return write(key, value);
    };
    assert.equal((await h.apply('boost')).applied, false);
    assert.deepEqual(h.outputs, {sg1:false, sg2:false, enable:false});
    h.dp.writeBoolean = write;
    delete h.outputs.sg2;
    assert.equal((await h.apply('boost')).applied, false);
    assert.equal(h.outputs.enable, false);
});
