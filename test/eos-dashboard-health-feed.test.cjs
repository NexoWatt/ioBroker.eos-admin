'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');

const file = require.resolve('../ui/main.js');
const compiled = new Module(file, module);
compiled.filename = file;
compiled.paths = Module._nodeModulePaths(require('node:path').dirname(file));
compiled._compile(fs.readFileSync(file, 'utf8') + '\nmodule.exports.TestRuntime = NexoWattVis;', file);
const grid = 'ems.gridMeasurementFresh';
const alive = 'ems.core.schedulerAlive';
const beat = 'ems.core.schedulerHeartbeatAt';

function fixture() {
  const runtime = Object.create(compiled.exports.TestRuntime.prototype);
  Object.assign(runtime, {
    namespace: 'nexowatt-ui.3', config: {}, stateCache: {}, sseClients: new Set(),
    _nwDashboardHealth: { [grid]: undefined, [alive]: undefined, [beat]: undefined },
    _nwDashboardHealthSent: Object.create(null),
    log: { warn() {}, debug() {} },
    subscribeForeignStatesAsync: async () => {},
    getStateAsync: async () => null,
  });
  return runtime;
}

test('startup reads retain EMS quality and timestamp; deletion during a read wins including in a preserved namespace', async () => {
  const r = fixture();
  const seen = [];
  const old = 123456789;
  let release, began;
  const pending = new Promise(resolve => { began = resolve; });
  const reads = [];
  r.subscribeForeignStatesAsync = async key => { seen.push(key); };
  r.getStateAsync = async key => {
    if (![grid, alive, beat].includes(key)) return null;
    reads.push(key);
    assert.ok(seen.includes(r.namespace + '.ems.*'));
    if (key === beat) return { val: old, ack: true, ts: old, q: 0 };
    if (key === alive) return { val: true, ack: false, q: 128 }; // no observation time
    began();
    return new Promise(resolve => { release = resolve; });
  };
  const loading = r.subscribeEmsUiStates();
  await pending;
  await r.onStateChange(r.namespace + '.' + grid, null);
  release({ val: true, ack: true, ts: old });
  await loading;
  assert.deepEqual(reads.sort(), [grid, alive, beat].sort());
  assert.deepEqual(r._nwDashboardHealth[grid], { value: null, ack: false, ts: 0 });
  assert.deepEqual(r._nwDashboardHealth[alive], { value: true, ack: false, ts: 0, q: 128 });
  assert.deepEqual(r._nwDashboardHealth[beat], { value: old, ack: true, ts: old, q: 0 });
  await r.onStateChange('eos-admin.0.' + grid, { val: true, ts: old, ack: true });
  await r.onStateChange(r.namespace + '.ems.private.token', { val: 'private', ts: old, ack: true });
  assert.deepEqual(r._nwDashboardHealth[grid], { value: null, ack: false, ts: 0 });
  assert.equal(Object.keys(r._nwDashboardHealth).length, 3);
  assert.equal(r._sseFlushTimer, undefined);
  assert.equal(Object.hasOwn(r.stateCache, grid), false);
});

test('SSE coalesces steady measurements, sends quality, failures and recovery, and ignores normalized admin refreshes', async () => {
  const r = fixture(), frames = [];
  const start = Date.now();
  let flush;
  r._nwSetTimeout = fn => { flush = fn; return 123; };
  r._nwBuildPublicStatePatch = patch => patch;
  r._nwSseGuard = { broadcast: ({ publicChunk }) => { frames.push(JSON.parse(publicChunk.slice(6)).payload); } };
  r.sseClients.add({ internal: false });
  const observe = (val, ts, ack = true, q = 0) => r.onStateChange(r.namespace + '.' + grid, { val, ack, ts, q });
  await observe(true, start);
  flush();
  assert.deepEqual(frames[0][grid], { value: true, ts: start, ack: true, q: 0 });
  for (let i = 1; i < 16; i++) await observe(true, start + i * 250);
  assert.equal(r._sseFlushTimer, null);
  assert.equal(r._nwDashboardHealth[grid].ts, start + 3750);
  await observe(true, start + 4000);
  flush();
  await observe(false, start + 4001);
  flush();
  assert.equal(frames[2][grid].value, false);
  await observe(true, start + 4002, false, 128);
  flush();
  assert.equal(frames[3][grid].ack, false);
  assert.equal(frames[3][grid].q, 128);
  await observe(true, start + 4003);
  r.updateValue(grid, false, start + 10000); // Admin overview normalized the timestamp and discarded ack/quality
  flush();
  assert.deepEqual(frames[4][grid], { value: true, ts: start + 4003, ack: true, q: 0 });
  assert.equal(r._nwDashboardHealth[grid].value, true);
  await r.onStateChange(r.namespace + '.' + grid, null);
  flush();
  assert.deepEqual(frames[5][grid], { value: null, ts: 0, ack: false });
  await observe({ token: 'private' }, start + 4004);
  flush();
  assert.equal(frames[6][grid].value, null);
  assert.equal(JSON.stringify(frames).includes('private'), false);
});

test('separate UI receives the original farm diagnostic state and a concurrent deletion wins over the startup read', async () => {
  const r = fixture();
  const memberKey = 'storageFarm.storagesStatusJson';
  const dispatchKey = 'storageFarm.lastDispatchJson';
  const prefix = r.namespace + '.';
  const ts = Date.now();
  const waiting = Promise.withResolvers(), delayed = Promise.withResolvers();
  const subscriptions = new Set();
  r.subscribeForeignStates = () => {};
  r.subscribeForeignStatesAsync = async id => { subscriptions.add(id); };
  r._nwPrimeForeignPowerScale = async () => {};
  r._nwStartLiveCoreRefresh = () => {};
  r._nwRefreshLiveCoreDatapoints = async () => {};
  r.getForeignStateAsync = async id => {
    if (id === prefix + memberKey) {
      assert.ok(subscriptions.has(id));
      waiting.resolve();
      return delayed.promise;
    }
    if (id === prefix + dispatchKey) return {val:'{}', ts, ack:false, q:128};
    return null;
  };
  const startup = r.subscribeConfiguredStates();
  await waiting.promise;
  await r.onStateChange(prefix + memberKey, null);
  delayed.resolve({val:'[{"name":"Old"}]', ts, ack:true, q:0});
  await startup;
  assert.deepEqual(r._nwFarmDisplay[memberKey], {value:null, ts:0, ack:false});
  assert.deepEqual(r._nwFarmDisplay[dispatchKey], {value:'{}', ts, ack:false, q:128});
  assert.equal(r._sseFlushTimer, undefined);

  const frames = [];
  let flush;
  r.sseClients.add({ internal:false });
  r._nwSetTimeout = fn => { flush = fn; return 42; };
  r._nwBuildPublicStatePatch = patch => patch;
  r._nwSseGuard = { broadcast: ({ publicChunk }) => frames.push(JSON.parse(publicChunk.slice(6)).payload) };
  await r.onStateChange(prefix + memberKey, {val:'[]', ts, q:0, ack:true});
  r.updateValue(memberKey, '[{"name":"Unconfirmed"}]', ts+1000);
  flush();
  assert.deepEqual(frames[0][memberKey], {value:'[]', ts, q:0, ack:true});
  await r.onStateChange(prefix + memberKey, null);
  flush();
  assert.equal(frames[1][memberKey].value, null);
  await r.onStateChange('eos-admin.0.' + memberKey, {val:'["foreign"]', ts, ack:true});
  assert.equal(r._nwFarmDisplay[memberKey].value, null);
});
