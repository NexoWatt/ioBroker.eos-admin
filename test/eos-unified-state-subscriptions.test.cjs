'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
require('./fixtures/socket-library-bootstrap.cjs');
const { installEosStateSubscriptions } = process.env.EOS_TEST_RUNTIME === 'build'
    ? require('../build/lib/eosStateSubscriptions')
    : require('tsx/cjs/api').require(path.resolve(__dirname, '../src/lib/eosStateSubscriptions.ts'), __filename);

function fixture() {
    const active = new Set();
    const calls = [];
    const logs = [];
    const failures = { subscribe: 0, unsubscribe: 0 };
    let pause = null;
    const adapter = {
        namespace: 'eos-admin.0',
        log: { error: message => logs.push(message) },
        marker() { return this.namespace; },
        async subscribeForeignStatesAsync(pattern, options) {
            calls.push(['subscribe', pattern, options]);
            if (pause) await pause;
            if (failures.subscribe-- > 0) throw new Error('fixture subscribe failed');
            active.add(pattern);
        },
        async unsubscribeForeignStatesAsync(pattern, options) {
            calls.push(['unsubscribe', pattern, options]);
            if (failures.unsubscribe-- > 0) throw new Error('fixture unsubscribe failed');
            active.delete(pattern);
        },
    };
    const manager = installEosStateSubscriptions(adapter);
    return { adapter, socket: manager.socketAdapter, manager, active, calls, logs, failures,
        pause(value) { pause = value; } };
}

test('browser threshold unsubscription cannot remove a matching EMS subscription', async () => {
    const f = fixture();
    await f.adapter.subscribeForeignStatesAsync('meter.0.power');
    await f.socket.subscribeForeignStatesAsync('meter.0.power', { user: 'system.user.installer' });
    await f.socket.unsubscribeForeignStatesAsync('meter.0.power');
    assert(f.active.has('meter.0.power'));
    assert.deepEqual(f.calls, [['subscribe', 'meter.0.power', undefined]]);
    await f.adapter.unsubscribeForeignStatesAsync('meter.0.power');
    assert.equal(f.active.size, 0);
});

test('socket-first and host-first subscribers share the service bus, with no user escalation on other methods', async () => {
    const f = fixture();
    await f.socket.subscribeForeignStatesAsync('alias.0.power', { user: 'system.user.viewer' });
    await f.adapter.subscribeForeignStatesAsync('alias.0.power');
    await f.adapter.unsubscribeForeignStatesAsync('alias.0.power');
    assert(f.active.has('alias.0.power'));
    await f.socket.unsubscribeForeignStatesAsync('alias.0.power', { user: 'system.user.viewer' });
    assert.equal(f.active.size, 0);
    assert(f.calls.every(call => call[2] === undefined), 'shared controller input is service-owned; socket publication enforces ACL separately');
    assert.equal(f.socket.marker(), 'eos-admin.0', 'unrelated adapter methods retain original receiver');
});

test('duplicates are idempotent and wildcard removal is exact, not a global unsubscribe', async () => {
    const f = fixture();
    await f.adapter.subscribeForeignStatesAsync('meter.0.*');
    await f.socket.subscribeForeignStatesAsync('*');
    await f.socket.subscribeForeignStatesAsync('*');
    await f.socket.subscribeForeignStatesAsync('meter.0.*');
    await f.socket.unsubscribeForeignStatesAsync('*');
    assert(f.active.has('meter.0.*'));
    assert(!f.active.has('*'));
    await f.socket.unsubscribeForeignStatesAsync('meter.0.*');
    assert(f.active.has('meter.0.*'));
    await f.manager.close();
    assert.equal(f.active.size, 0);
    assert.equal(f.calls.filter(call => call[0] === 'subscribe').length, 2);
});

test('own-state async and callback methods share ownership with absolute socket patterns', async () => {
    const f = fixture();
    await new Promise((resolve, reject) => f.adapter.subscribeStates('forecast.*', error => error ? reject(error) : resolve()));
    await f.socket.subscribeForeignStatesAsync('eos-admin.0.forecast.*');
    await new Promise((resolve, reject) => f.socket.unsubscribeStates('forecast.*', {}, error => error ? reject(error) : resolve()));
    assert(f.active.has('eos-admin.0.forecast.*'));
    await f.adapter.unsubscribeStatesAsync('eos-admin.0.forecast.*');
    assert.equal(f.active.size, 0);
    await f.adapter.subscribeStatesAsync(['meter.0.power', 'meter.0.power', 'meter.1.power']);
    assert.deepEqual([...f.active], ['meter.0.power', 'meter.1.power'], 'controller own-array semantics are absolute');
    await f.adapter.unsubscribeForeignStatesAsync(['meter.0.power', 'meter.1.power']);
});

test('subscription failure rolls back and a retry can establish and release the bus', async () => {
    const f = fixture();
    f.failures.subscribe = 1;
    await assert.rejects(f.adapter.subscribeForeignStatesAsync('meter.0.power'), /fixture subscribe failed/);
    assert.equal(f.active.size, 0);
    await f.socket.subscribeForeignStatesAsync('meter.0.power');
    assert(f.active.has('meter.0.power'));
    await f.manager.closeSocket();
    assert.equal(f.active.size, 0);
});

test('unsubscribe failure retains tracked ownership until a successful retry', async () => {
    const f = fixture();
    await f.adapter.subscribeForeignStatesAsync('meter.0.power');
    f.failures.unsubscribe = 1;
    await assert.rejects(f.adapter.unsubscribeForeignStatesAsync('meter.0.power'), /fixture unsubscribe failed/);
    assert(f.active.has('meter.0.power'));
    await f.adapter.unsubscribeForeignStatesAsync('meter.0.power');
    assert.equal(f.active.size, 0);
});

test('concurrent subscribe/unsubscribe operations serialize without stale removal', async () => {
    const f = fixture();
    const jobs = [f.socket.subscribeForeignStatesAsync('meter.0.power'),
        f.adapter.subscribeForeignStatesAsync('meter.0.power'),
        f.socket.unsubscribeForeignStatesAsync('meter.0.power')];
    await Promise.all(jobs);
    assert(f.active.has('meter.0.power'));
    assert.equal(f.calls.length, 1);
    await f.manager.close();
    assert.equal(f.active.size, 0);
});

test('closing socket scope preserves EMS and blocks late timer and browser activity', async () => {
    const f = fixture();
    await f.adapter.subscribeForeignStatesAsync('meter.0.power');
    await f.socket.subscribeForeignStatesAsync('meter.0.power');
    await f.socket.subscribeForeignStatesAsync('system.adapter.*');
    await f.manager.closeSocket();
    assert.deepEqual([...f.active], ['meter.0.power']);
    await assert.rejects(f.socket.subscribeForeignStatesAsync('late.0.*'), /STOPPED/);
    const callsAfterClose = f.calls.length;
    await f.socket.unsubscribeForeignStatesAsync('meter.0.power');
    assert.equal(f.calls.length, callsAfterClose, 'late browser disconnect is an idempotent no-op');
    await f.adapter.subscribeForeignStatesAsync('meter.1.power');
    await f.manager.close();
    assert.equal(f.active.size, 0);
    await assert.rejects(f.adapter.subscribeStatesAsync('*'), /STOPPED/);
});

test('late disconnect callbacks after shutdown succeed without touching the controller or logging noise', async () => {
    const f = fixture();
    await f.adapter.subscribeForeignStatesAsync('meter.0.power');
    await f.socket.subscribeForeignStatesAsync('meter.0.power');
    await f.manager.close();
    const callsAfterClose = f.calls.length;
    await new Promise((resolve, reject) => f.socket.unsubscribeForeignStates('meter.0.power', error => error ? reject(error) : resolve()));
    await f.adapter.unsubscribeStatesAsync('*');
    await assert.rejects(f.socket.subscribeForeignStatesAsync('meter.0.power'), /STOPPED/);
    assert.equal(f.calls.length, callsAfterClose);
    assert.equal(f.active.size, 0);
    assert.deepEqual(f.logs, []);
});

test('stop drains a backend subscribe already in flight, then removes it without resurrection', async () => {
    const f = fixture();
    let resume;
    f.pause(new Promise(resolve => { resume = resolve; }));
    const subscribing = f.socket.subscribeForeignStatesAsync('meter.0.power');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.calls.length, 1);
    const closing = f.manager.close();
    resume();
    await Promise.all([subscribing, closing]);
    assert.equal(f.active.size, 0);
    assert.deepEqual(f.calls.map(call => call[0]), ['subscribe', 'unsubscribe']);
});

test('invalid requests do not mutate bus interests and callback failures are handled', async () => {
    const f = fixture();
    await assert.rejects(f.adapter.subscribeForeignStatesAsync(['meter.0.*', null]), /PATTERN_INVALID/);
    await assert.rejects(f.socket.subscribeForeignStatesAsync('meter.0.*', 'invalid'), /OPTIONS_INVALID/);
    assert.equal(f.calls.length, 0);
    f.failures.subscribe = 1;
    await new Promise(resolve => f.adapter.subscribeForeignStates('meter.0.power', error => {
        assert.match(error.message, /fixture subscribe failed/); resolve();
    }));
    f.failures.subscribe = 1;
    f.adapter.subscribeForeignStates('meter.0.power');
    await new Promise(resolve => setImmediate(resolve));
    assert(f.logs.some(message => message.startsWith('EOS_STATE_SUBSCRIPTION_FAILED:')));
    f.adapter.subscribeForeignStates('meter.0.power', () => { throw new Error('callback fixture'); });
    await new Promise(resolve => setImmediate(resolve));
    assert(f.logs.some(message => message.startsWith('EOS_STATE_SUBSCRIPTION_CALLBACK_FAILED:')));
    await f.manager.close();
});

test('real SocketCommands publication still enforces user-specific state denial and ACL revocation on the shared bus', async () => {
    const { SocketCommands } = require('@iobroker/socket-classes');
    const f = fixture();
    const decisions = new Map([['meter.0.denied', false], ['meter.0.allowed', true]]);
    const questions = [];
    f.adapter.name = 'admin';
    f.adapter.subscribeForeignObjectsAsync = async () => undefined;
    f.adapter.getForeignObject = (id, options, callback) => {
        questions.push({ id, user: options.user });
        queueMicrotask(() => callback(decisions.get(id) === true ? null : new Error('permissionError')));
    };
    const commands = new SocketCommands(f.socket, () => true);
    const events = [];
    const socket = { _acl: { user: 'system.user.viewer', groups: [] },
        subscribe: { stateChange: [{ regex: /^meter\.0\./ }] },
        emit: (...args) => events.push(args) };
    await f.adapter.subscribeForeignStatesAsync('meter.0.*');
    await f.socket.subscribeForeignStatesAsync('meter.0.*', { user: 'system.user.viewer' });
    commands.publish(socket, 'stateChange', 'meter.0.denied', { val: 1 });
    commands.publish(socket, 'stateChange', 'meter.0.allowed', { val: 2 });
    commands.publish(socket, 'stateChange', 'meter.0.missing', { val: 3 });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(events.map(event => event[1]), ['meter.0.allowed']);
    assert(questions.every(question => question.user === 'system.user.viewer'), 'ACL queries retain client identity');
    decisions.set('meter.0.allowed', false);
    commands.publish(socket, 'objectChange', 'meter.0.allowed', { _id: 'meter.0.allowed' });
    commands.publish(socket, 'stateChange', 'meter.0.allowed', { val: 4 });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(events.length, 1, 'object ACL revocation invalidates a cached allow');
    socket._acl.user = '';
    commands.publish(socket, 'stateChange', 'meter.0.allowed', { val: 5 });
    assert.equal(events.length, 1, 'missing identity never receives an event');
    commands.destroy();
    await f.manager.close();
});

test('controller-7 absent-object semantics are unchanged: no DB refusal is treated as readable by upstream', async () => {
    const { SocketCommands } = require('@iobroker/socket-classes');
    const f = fixture();
    f.adapter.name = 'admin';
    f.adapter.subscribeForeignObjectsAsync = async () => undefined;
    f.adapter.getForeignObject = (_id, options, callback) => {
        assert.equal(options.user, 'system.user.viewer');
        queueMicrotask(() => callback(null, null));
    };
    const commands = new SocketCommands(f.socket, () => true);
    const events = [];
    const socket = { _acl: { user: 'system.user.viewer', groups: [] },
        subscribe: { stateChange: [{ regex: /^orphan\.0\./ }] }, emit: (...args) => events.push(args) };
    commands.publish(socket, 'stateChange', 'orphan.0.value', { val: 7 });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(events.length, 1, 'documents existing upstream behavior; this test does not claim absent-object denial');
    commands.destroy();
    await f.manager.close();
});

test('controller promisify captures original callback APIs and does not recurse into installed wrappers', async () => {
    const toolsFile = path.join(path.dirname(require.resolve('@iobroker/js-controller-common-db')), 'lib/common/tools.js');
    // Execute the actual unchanged utility function without its unrelated
    // module-level controller-directory discovery. No promisify substitute.
    const fs = require('node:fs');
    const vm = require('node:vm');
    const ts = require('typescript');
    const source = fs.readFileSync(toolsFile, 'utf8');
    const ast = ts.createSourceFile(toolsFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const functionText = name => {
        const node = ast.statements.find(item => ts.isFunctionDeclaration(item) && item.name?.text === name);
        assert(node, `actual controller utility ${name} must exist`);
        return node.getText(ast);
    };
    const promisify = vm.runInNewContext(`${functionText('sliceArgs')}\n${functionText('promisify')}\npromisify`, { Promise, Error });
    const active = new Set();
    const calls = [];
    const adapter = { namespace: 'eos-admin.0', log: { error() {} },
        subscribeForeignStates(pattern, options, callback) {
            if (typeof options === 'function') callback = options;
            calls.push(['subscribe', pattern]); active.add(pattern); callback(null);
        },
        unsubscribeForeignStates(pattern, options, callback) {
            if (typeof options === 'function') callback = options;
            calls.push(['unsubscribe', pattern]); active.delete(pattern); callback(null);
        },
    };
    adapter.subscribeForeignStatesAsync = promisify(adapter.subscribeForeignStates, adapter);
    adapter.unsubscribeForeignStatesAsync = promisify(adapter.unsubscribeForeignStates, adapter);
    const manager = installEosStateSubscriptions(adapter);
    await adapter.subscribeForeignStatesAsync('meter.0.*');
    await manager.socketAdapter.subscribeForeignStatesAsync('meter.0.*');
    await manager.socketAdapter.unsubscribeForeignStatesAsync('meter.0.*');
    assert(active.has('meter.0.*'));
    await manager.close();
    assert.equal(active.size, 0);
    assert.deepEqual(calls, [['subscribe', 'meter.0.*'], ['unsubscribe', 'meter.0.*']]);
});

test('controller foreign omitted-pattern defaults and own empty-pattern behavior remain compatible', async () => {
    const f = fixture();
    await f.adapter.subscribeForeignStatesAsync();
    assert(f.active.has('*'));
    await f.adapter.unsubscribeForeignStatesAsync();
    assert.equal(f.active.size, 0);
    await assert.rejects(f.adapter.subscribeStatesAsync(), /PATTERN_INVALID/, 'controller own subscription requires a string or array');
    await f.adapter.subscribeStatesAsync('');
    assert(f.active.has('eos-admin.0.'));
    await f.adapter.unsubscribeStatesAsync('');
    assert.equal(f.active.size, 0);
    await f.manager.close();
});
