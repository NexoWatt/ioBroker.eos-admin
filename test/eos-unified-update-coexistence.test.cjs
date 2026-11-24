'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadManager() {
    if (process.env.EOS_TEST_RUNTIME === 'build') return require('../build/lib/eosAutoUpdate.js').NexoWattStableUpdateManager;
    const source = fs.readFileSync(path.join(__dirname, '../src/lib/eosAutoUpdate.ts'), 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {};
    vm.runInNewContext(output, { exports, setInterval, clearInterval, setTimeout, clearTimeout });
    return exports.NexoWattStableUpdateManager;
}

test('EOS update manager leaves shared policies and recovery evidence intact through start, enable, refresh and stop', async t => {
    const legacy = {
        previousPolicies: { backitup: 'minor', 'nexowatt-devices': 'patch' },
        selectedRepository: 'stable', previousRepositoryEnabled: false,
        ownsActiveRepoOrder: true, previousActiveRepo: ['customer'], managedAdapters: ['backitup'],
    };
    const objects = {
        'system.config': { common: { activeRepo: ['stable', 'customer'], adapterAutoUpgrade: { repositories: { stable: true } } }, native: { keep: true } },
        'system.adapter.eos-admin.0': { native: { eosNexoWattAutoUpdateState: legacy, deviceConfig: { id: 'meter1' } } },
        'system.adapter.nexowatt-devices': { common: { name: 'nexowatt-devices', version: '0.5.176', automaticUpgrade: 'minor' } },
        'system.adapter.backitup': { common: { name: 'backitup', version: '3.4.0', automaticUpgrade: 'patch' } },
        'system.adapter.admin': { common: { name: 'admin', version: '8.3.5', automaticUpgrade: 'major' } },
    };
    const before = structuredClone(objects);
    const states = {};
    const allowed = new Set(['info.nexowattStableUpdatesState', 'info.nexowattStableUpdatesEnabled']);
    const manager = new (loadManager())({
        namespace: 'eos-admin.0',
        log: { debug() {}, info() {}, warn() {}, error() {} },
        async getForeignObjectAsync(id) { return objects[id] && structuredClone(objects[id]); },
        async getObjectViewAsync() { return { rows: Object.entries(objects).map(([id, value]) => ({ id, value: structuredClone(value) })) }; },
        async getStateAsync(id) { return states[id]; },
        async setStateAsync(id, val, ack) { assert.ok(allowed.has(id)); assert.equal(ack, true); states[id] = { val }; },
        async setForeignObjectAsync() { assert.fail('shared object rewrite'); },
        async extendForeignObjectAsync() { assert.fail('shared object patch'); },
        async sendToHostAsync() { assert.fail('host mutation or installation'); },
    });
    t.after(() => manager.stop());
    for (const status of [await manager.start(), await manager.setEnabled(true), await manager.getStatus(true), await manager.reconcile('interval')]) {
        assert.equal(status.enabled, false);
        assert.equal(status.blocked, true);
        assert.equal(status.policy, 'none');
    }
    assert.deepEqual(objects, before);
    const saved = JSON.parse(states['info.nexowattStableUpdatesState'].val);
    for (const key of ['previousPolicies', 'previousRepositoryEnabled', 'previousActiveRepo', 'ownsActiveRepoOrder']) assert.deepEqual(saved[key], legacy[key]);
    manager.stop();
    const stopped = structuredClone(states);
    await manager.setEnabled(true);
    await manager.reconcile('after-stop');
    assert.deepEqual(states, stopped);
});
