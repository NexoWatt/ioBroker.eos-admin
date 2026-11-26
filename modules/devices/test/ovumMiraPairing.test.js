/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const editor = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../admin/index_m.js'), 'utf8'), editor);
const pair = editor.planMiraPair;
const hsm = (id = 'h1', host = 'lsm.lan') => ({
    id, name: 'MIRA', category: 'HEAT', manufacturer: 'OVUM', templateId: 'heat.ovum.mira.hsm',
    enabled: true, protocol: 'modbusTcp', connection: { host, unitId: 110 }
});
const wpm = (id, unitId) => ({
    ...hsm(id), templateId: 'heat.ovum.mira.wpm', connection: { host: 'LSM.LAN', port: 502, unitId }
});
const rtu = (device, port) => ({
    ...device, protocol: 'modbusRtu', connection: {unitId: device.connection.unitId, path: port, baudRate: 19200}
});

test('new MIRA setup creates one distinct WPM at its selected unit, with separate settings and collision-safe IDs', () => {
    const device = hsm('A'.repeat(80));
    device.connection.writePassword = '123456';
    device.connection.unrelatedProfileSetting = 'hsm-only';
    const first = pair(device, [], -1, 'same', 112);
    const result = pair(device, [{ id: first.id }], -1, 'same', 112);
    assert.ok(result.id.length <= 80 && result.id !== first.id && result.id !== device.id);
    assert.equal(result.companion.id, result.id);
    assert.equal(result.companion.connection.unitId, 112);
    assert.equal(result.companion.connection.host, 'lsm.lan');
    assert.equal(result.companion.connection.writePassword, device.connection.writePassword);
    assert.equal(result.companion.connection.unrelatedProfileSetting, undefined);
    assert.equal(result.companion.ems.mode, 'auto');
    assert.equal(device.connection.unitId, 110);
    assert.throws(() => pair(device, Array(127).fill({}), -1, 'same', 111), /Geräteplätze/);
    device.connection.writePassword = '__EOS_SECRET_UNCHANGED__';
    assert.throws(() => pair(device, [], -1, 'same', 111), /Login-Code/);
    assert.throws(() => pair(device, [], -1, 'same', 110), /WPM/);
});

test('existing matching WPM keeps its identity, settings, prior EMS intent and enabled state', () => {
    const device = hsm(), existing = wpm('w1', 111);
    existing.enabled = false; existing.ems = { mode: 'manual' }; existing.connection.writePassword = 'private-local-value';
    const before = JSON.stringify(existing);
    const result = pair(device, [existing], -1, 'same', 111);
    assert.equal(result.id, existing.id); assert.equal(result.companion, undefined);
    assert.equal(JSON.stringify(existing), before);
    assert.equal(pair(device, [], -1, 'none').id, '');
    assert.equal(pair(device, [device], 0, 'legacy'), null);
    assert.equal(pair(wpm('standalone', 112), [], -1, 'same', 111), null);
    assert.equal(pair({templateId:'unrelated'}, [], -1, ''), null);
});

test('ambiguous units, another owner, unknown IDs and different TCP plants cannot be silently paired', () => {
    const d = hsm(), a = wpm('wp-a', 111), b = wpm('wp-b', 111);
    assert.throws(() => pair(d, [a,b], -1, 'same', 111), /anderen Gerät/);
    assert.throws(() => pair(d, [a,b], -1, 'id:wp-a'), /mehrfach/);
    assert.throws(() => pair(d, [{...a, templateId:'generic'}], -1, 'same', 111), /anderen Gerät/);
    assert.throws(() => pair(d, [a], -1, 'id:missing'), /passendes MIRA-WPM/);
    assert.throws(() => pair(hsm('remote','lsm2.lan'), [a], -1, 'id:wp-a'), /passendes MIRA-WPM/);
    assert.throws(() => pair(d, [hsm('old')], -1, 'none'), /bereits als Gerät/);
    const owner = hsm('owner','other-lsm'); owner.connection.miraWpmDeviceId = a.id;
    assert.throws(() => pair(d, [a, owner], -1, 'same', 111), /anderen HSM/);
    assert.throws(() => pair(a, [b], -1, ''), /bereits als Gerät/);
});

test('two RTU lines link only by explicit selection, separate from a same-line new WPM', () => {
    const d = rtu(hsm(), '/dev/ttyA'), remote = rtu(wpm('wp-b',111), '/dev/ttyB');
    assert.equal(pair(d, [remote], -1,'same',111).companion.connection.path, '/dev/ttyA');
    assert.equal(pair(d, [remote], -1,'id:wp-b').id, remote.id);
    const legacyOwner = rtu(hsm('other'), '/dev/ttyB');
    assert.throws(() => pair(d, [remote, legacyOwner], -1,'id:wp-b'), /anderen HSM/);
    legacyOwner.connection.miraWpmDeviceId = '';
    assert.equal(pair(d, [remote, legacyOwner], -1,'id:wp-b').id, remote.id);
});
