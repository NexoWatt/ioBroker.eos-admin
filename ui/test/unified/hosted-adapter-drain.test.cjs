/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function source(name) {
    const filename = path.resolve(__dirname, '../../lib/' + name + '.js');
    const compiled = new Module(filename, module); compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename));
    compiled._compile(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../src-ts/runtime-executables/lib/' + name + '.ts'), 'utf8'),
        { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
    return compiled.exports;
}
const { HostedAdapter } = source('hosted-adapter');
const { stopHostedRuntime } = source('hosted-runtime-stop');
const turn = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function fixture(legacy = false) {
    const calls = []; const pending = []; const returnValue = { controllerReturn: true };
    const owner = { namespace: 'eos-admin.0', instance: 0, config: { eosUi: {}, ...(legacy ? { eosUiMigration: { preserveNamespace: true, source: 'nexowatt-ui.2' } } : {}) } };
    for (const method of ['setForeignStateAsync', 'setForeignStateChangedAsync']) owner[method] = (...args) => {
        const item = deferred(); calls.push({ method, args }); pending.push(item); return item.promise;
    };
    for (const method of ['setForeignState', 'setForeignStateChanged']) owner[method] = (...args) => {
        calls.push({ method, args }); return returnValue;
    };
    for (const method of ['setState', 'setStateChanged', 'setStateAsync', 'setStateChangedAsync']) owner[method] = () => assert.fail('untracked local owner bypass');
    let writable = true;
    const adapter = new HostedAdapter({ owner, bridge: { canWrite: () => writable, getLicense: () => null, resolveAccess: async () => null, originAllowed: () => true } });
    return { adapter, owner, calls, pending, returnValue, revoke: () => { writable = false; }, allow: () => { writable = true; } };
}

for (const legacy of [false, true]) test(`all four local write aliases are tracked with correct IDs (${legacy ? 'migrated' : 'same'} namespace)`, async () => {
    const f = fixture(legacy); const prefix = legacy ? 'nexowatt-ui.2' : 'eos-admin.0'; const state = { val: 3, ack: true };
    const one = f.adapter.setStateAsync('command', state); const two = f.adapter.setStateChangedAsync(prefix + '.changed', false, false);
    assert.equal(one, f.pending[0].promise); assert.equal(two, f.pending[1].promise);
    const callbackValues = [];
    assert.equal(f.adapter.setState('switch', true, false, (...args) => callbackValues.push(args)), f.returnValue);
    assert.equal(f.adapter.setStateChanged(prefix + '.switchChanged', state), f.returnValue);
    assert.deepEqual(f.calls.map(call => call.args[0]), [prefix + '.command', prefix + '.changed', prefix + '.switch', prefix + '.switchChanged']);
    assert.equal(f.calls[0].args[1], state); assert.deepEqual(f.calls[1].args.slice(1), [false, false]);
    const drain = f.adapter.stopStateWrites(); let drained = false; void drain.then(() => { drained = true; });
    f.pending[0].resolve('one'); f.pending[1].reject(new Error('controller rejected'));
    await one; await assert.rejects(two, /controller rejected/);
    f.calls[2].args.at(-1)(null, prefix + '.switch'); await turn(); assert.equal(drained, false);
    f.calls[3].args.at(-1)(null, prefix + '.switchChanged', false); await drain;
    assert.deepEqual(callbackValues, [[null, prefix + '.switch']]);
    await assert.rejects(f.adapter.setStateAsync('blocked', 4), /OWNERSHIP_LOST/);
    assert.throws(() => f.adapter.setStateChanged('blocked', 4), /OWNERSHIP_LOST/); assert.equal(f.calls.length, 4);
});

test('both foreign async methods preserve original promise and wait fulfilled/rejected completion', async () => {
    const f = fixture(); const one = f.adapter.setForeignStateAsync('physical.a', 1, true); const two = f.adapter.setForeignStateChangedAsync('physical.b', 2);
    assert.equal(one, f.pending[0].promise); assert.equal(two, f.pending[1].promise);
    const drain = f.adapter.stopStateWrites(); let drained = false; void drain.then(() => { drained = true; });
    f.pending[0].resolve('persisted'); assert.equal(await one, 'persisted'); await turn(); assert.equal(drained, false);
    f.pending[1].reject(new Error('write rejected')); await assert.rejects(two, /write rejected/); await drain;
});

test('callback API preserves synchronous return, callback context, errors and extra callback values', async () => {
    const f = fixture(); const callbackContext = { owner: true }; const failure = new Error('controller rejected'); let observed;
    assert.equal(f.adapter.setForeignStateChanged('physical.a', { val: true, ack: false }, function (...values) { observed = { context: this, values }; }), f.returnValue);
    const drain = f.adapter.stopStateWrites(); f.calls[0].args.at(-1).call(callbackContext, failure, 'physical.a', true);
    await drain; assert.equal(observed.context, callbackContext); assert.deepEqual(observed.values, [failure, 'physical.a', true]);
});

test('callback API can be observed without caller callback and preserves returned Promise completion', async () => {
    const f = fixture(); const completion = deferred(); let sentCallback;
    f.owner.setForeignState = (...args) => { sentCallback = args.at(-1); sentCallback(null, args[0]); return completion.promise; };
    const returned = f.adapter.setForeignState('physical.a', true, undefined, undefined);
    assert.equal(returned, completion.promise); assert.equal(typeof sentCallback, 'function');
    const drain = f.adapter.stopStateWrites(); let drained = false; void drain.then(() => { drained = true; });
    await turn(); assert.equal(drained, false); completion.resolve('persisted'); await drain; assert.equal(await returned, 'persisted');
});

test('a callback-method returned promise alone cannot confirm a still pending callback', async () => {
    const f = fixture(); let callback;
    f.owner.setForeignStateChanged = (...args) => { callback = args.at(-1); return Promise.resolve('returned'); };
    assert.equal(await f.adapter.setForeignStateChanged('physical.a', true), 'returned');
    const drain = f.adapter.stopStateWrites(); let drained = false; void drain.then(() => { drained = true; });
    await turn(); assert.equal(drained, false); callback(null, 'physical.a'); await drain;
});

test('pending capacity rejects without queueing or sending and frees completed slots', async () => {
    const f = fixture(); for (let n = 0; n < 1024; n++) f.adapter.setForeignState('physical.' + n, n);
    assert.throws(() => f.adapter.setForeignState('overflow', 1), /EOS_UI_WRITES_BUSY/);
    await assert.rejects(f.adapter.setForeignStateAsync('overflow', 1), /EOS_UI_WRITES_BUSY/); assert.equal(f.calls.length, 1024);
    f.calls[0].args.at(-1)(null, 'physical.0'); f.adapter.setForeignState('physical.reuse', 1); assert.equal(f.calls.length, 1025);
    const drain = f.adapter.stopStateWrites(); for (const call of f.calls.slice(1)) call.args.at(-1)(null, call.args[0]); await drain;
});

test('unknown completion or synchronous owner failure cannot become confirmed shutdown', async () => {
    const f = fixture(); f.adapter.setForeignState('physical.never-callback', true);
    await assert.rejects(stopHostedRuntime([f.adapter.stopStateWrites()], async () => {}, 20), { code: 'EOS_UI_STOP_UNCONFIRMED' });
    const g = fixture(); g.owner.setForeignStateAsync = () => { throw new Error('unknown dispatch'); };
    await assert.rejects(g.adapter.setForeignStateAsync('physical.a', 1), /unknown dispatch/);
    await assert.rejects(stopHostedRuntime([g.adapter.stopStateWrites()], async () => {}, 20), { code: 'EOS_UI_STOP_UNCONFIRMED' });
    const h = fixture(); h.owner.setForeignStateChangedAsync = () => undefined;
    await assert.rejects(h.adapter.setForeignStateChangedAsync('physical.a', 1), /EOS_UI_WRITE_COMPLETION_UNKNOWN/);
    await assert.rejects(stopHostedRuntime([h.adapter.stopStateWrites()], async () => {}, 20), { code: 'EOS_UI_STOP_UNCONFIRMED' });
});

test('closing admission remains permanent even if external ownership later returns', async () => {
    const f = fixture(); await f.adapter.stopStateWrites(); f.revoke(); f.allow(); let denied;
    f.adapter.setForeignState('physical.a', true, error => { denied = error; }); assert.match(denied.message, /OWNERSHIP_LOST/);
    await assert.rejects(f.adapter.setForeignStateChangedAsync('physical.a', false), /OWNERSHIP_LOST/); assert.equal(f.calls.length, 0);
});
