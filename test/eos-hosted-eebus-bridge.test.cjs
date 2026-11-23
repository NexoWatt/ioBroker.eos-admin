'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Para14aEebusDirectApi, HELLO_COMMAND, CONTROL_COMMAND, IMPLEMENTATION_COMMAND } = require('../ui/ems/services/para14a-eebus-api');

async function fixture(t) {
  let allowed = true;
  const replies = [], feedback = [], ticks = [];
  const adapter = {
    namespace: 'eos-admin.0', config: { installerConfig: { para14a: true }, countryProfile: { country: 'DE' } },
    emsEngine: { mm: {} }, _nwLicenseOk: true,
    _nwLicenseAllowsAppId: () => true,
    _nwRequestImmediateEmsTick: (...args) => { ticks.push(args); return true; },
    setObjectNotExistsAsync: async () => {}, setStateAsync: async () => {},
    log: { debug() {}, warn() {}, error() {} },
    sendTo: (target, command, message, callback) => { replies.push({ target, command, message }); if (typeof callback === 'function') callback(message); },
  };
  const api = new Para14aEebusDirectApi(adapter);
  api.attachHostedBridge({ sourceInstance: 'eos-admin.0.eebus', canOperate: () => allowed,
    sendFeedback: message => { feedback.push(message); return true; } });
  await api.init(); t.after(() => api.stop());
  const hello = { from: 'eos-admin.0.eebus', command: HELLO_COMMAND,
    message: { apiVersion: 1, sourceInstance: 'eos-admin.0.eebus', bridgeHeartbeatSec: 30 } };
  const control = { from: hello.from, command: CONTROL_COMMAND, message: {
    schema: CONTROL_COMMAND, apiVersion: 1, sourceInstance: hello.from, commandId: 'test-control',
    operation: 'limitConsumption', active: true, limitW: 4200, receivedAtMs: Date.now(),
    validUntilMs: Date.now() + 60000, heartbeatAtMs: Date.now(), heartbeatTimeoutMs: 60000,
  } };
  return { api, hello, control, replies, feedback, ticks, revoke: () => { allowed = false; } };
}

test('private embedded EEBus bridge accepts handshake and dispatches central controller without bus roundtrip', async t => {
  const f = await fixture(t);
  assert.equal((await f.api.handleHostedMessage(f.hello)).accepted, true);
  assert.equal((await f.api.handleHostedMessage(f.control)).accepted, true);
  assert.equal(f.api.ingress.limitW, 4200);
  assert.equal(f.ticks.length, 1);
  assert.equal(f.replies.length, 0);
  assert.equal(f.api._sendImplementationFeedback(f.hello.from, { status: 'applied' }), true);
  assert.deepEqual(f.feedback, [{ command: IMPLEMENTATION_COMMAND, message: { status: 'applied' } }]);
});

test('serialized bus message cannot impersonate embedded source or acquire private proof', async t => {
  const f = await fixture(t);
  await f.api.handleHostedMessage(f.hello);
  let response;
  await f.api.handleMessage({ ...JSON.parse(JSON.stringify(f.control)), hosted: true, trusted: true,
    callback: value => { response = value; } });
  assert.equal(response.accepted, false);
  assert.match(response.reason, /source/);
  assert.equal(f.api.ingress, null);
  assert.equal(f.ticks.length, 0);
});

test('fresh ownership/license denial blocks commands and implementation feedback', async t => {
  const f = await fixture(t);
  await f.api.handleHostedMessage(f.hello);
  f.revoke();
  assert.equal((await f.api.handleHostedMessage(f.control)).accepted, false);
  assert.equal(f.api._sendImplementationFeedback(f.hello.from, { status: 'applied' }), false);
  assert.equal(f.feedback.length, 0);
  assert.equal(f.ticks.length, 0);
});

test('embedded identity, command allowlist, handshake and stopped lifecycle are enforced', async t => {
  const f = await fixture(t);
  assert.equal((await f.api.handleHostedMessage(f.control)).accepted, false);
  assert.equal((await f.api.handleHostedMessage({ ...f.hello, from: 'eos-admin.1.eebus' })).accepted, false);
  assert.equal((await f.api.handleHostedMessage({ ...f.hello, command: 'arbitrary' })).accepted, false);
  assert.equal((await f.api.handleHostedMessage({ ...f.hello, message: { ...f.hello.message, sourceInstance: 'eebus.0' } })).accepted, false);
  assert.throws(() => f.api.attachHostedBridge({}), /BRIDGE_INVALID/);
  f.api.stop();
  assert.equal((await f.api.handleHostedMessage(f.hello)).accepted, false);
});
