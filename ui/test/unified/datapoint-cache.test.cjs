'use strict';
/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
/** NexoWatt EOS: configured measurements remain available without retaining the
 * Admin wildcard stream. Synthetic ioBroker database; no physical device IO. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatapointRegistry } = require('../../ems/datapoints');

function fixture() {
  const states = new Map(), objects = new Map(), reads = [];
  const adapter = {
    log: { warn() {} },
    async getForeignStateAsync(id) { reads.push(id); return states.get(id) || null; },
    async getForeignObjectAsync(id) { return objects.get(id) || null; },
    async subscribeForeignStatesAsync() {},
  };
  return { adapter, states, objects, reads, registry: new DatapointRegistry(adapter, []) };
}
const sample = (val, ts = Date.now()) => ({ val, ts, lc: ts, ack: true });

test('Admin wildcard events do not retain unrelated values or evict configured measurements', async () => {
  const { registry } = fixture();
  await registry.upsert({ key: 'grid', objectId: 'meter.0.power', unit: 'W' });
  registry.handleStateChange('meter.0.power', sample(723));
  for (let i = 0; i < 20000; i++) registry.handleStateChange(`unrelated.0.value${i}`, sample({ large: 'x'.repeat(2048) }));
  assert.equal(registry.cacheByObjectId.size, 1);
  assert.equal(registry.getNumber('grid'), 723);
  assert.equal(registry.getNumber('unrelated.0.value0', 99), 99);
});

test('alias source, connected flags and heartbeat stay separate from payload retention', async () => {
  const { registry, states, objects } = fixture();
  const wrapper = 'nexowatt-devices.0.devices.meter.r.power';
  const target = 'modbus.0.inputRegisters.power';
  const stamp = Date.now() - 60000;
  objects.set(wrapper, { common: { alias: { id: target }, unit: 'W' } });
  objects.set(target, { common: { unit: 'kW' } });
  states.set(target, sample(1.5, stamp));
  states.set('nexowatt-devices.0.devices.meter.comm.connected', sample(true));
  states.set('nexowatt-devices.0.info.connection', sample(true));
  await registry.upsert({ key: 'grid', objectId: wrapper, unit: 'W', useAliveForStale: true });
  assert.equal(registry.getNumber('grid'), 1500);
  assert.equal(registry.getMeasurementTimestampMs('grid'), stamp);
  assert.ok(registry.getAgeMs('grid') >= 60000, 'DB priming must not create a fresh heartbeat');
  assert.equal(registry.getConnectionStatus('grid'), true);
  const sibling = 'nexowatt-devices.0.devices.meter.r.voltage';
  registry.handleStateChange(sibling, sample(230));
  assert.equal(registry.cacheByObjectId.has(sibling), false);
  assert.ok(registry.getAliveAgeMs('grid') < 1000);
  assert.equal(registry.getMeasurementTimestampMs('grid'), stamp);
  registry.handleStateChange('nexowatt-devices.0.devices.meter.comm.connected', sample(false));
  assert.equal(registry.getConnectionStatus('grid'), false);
});

test('shared sources survive remapping until the last reference leaves, and remapping back re-primes', async () => {
  const { registry, states, reads } = fixture();
  states.set('meter.0.a', sample(10));
  states.set('meter.0.b', sample(20));
  await registry.upsert({ key: 'first', objectId: 'meter.0.a' });
  await registry.upsert({ key: 'second', objectId: 'meter.0.a' });
  await registry.upsert({ key: 'first', objectId: 'meter.0.b' });
  assert.equal(registry.getNumber('second'), 10);
  await registry.upsert({ key: 'second', objectId: 'meter.0.b' });
  assert.equal(registry.cacheByObjectId.has('meter.0.a'), false);
  registry.handleStateChange('meter.0.a', sample(999));
  assert.equal(registry.cacheByObjectId.has('meter.0.a'), false);
  states.set('meter.0.a', sample(35));
  await registry.upsert({ key: 'first', objectId: 'meter.0.a' });
  assert.equal(registry.getNumber('first'), 35);
  assert.equal(registry.getNumber('second'), 20);
  assert.equal(reads.filter(id => id === 'meter.0.a').length, 2);
});

test('late mappings read the DB and immediate subscription events are retained', async () => {
  const { registry, states, adapter } = fixture();
  registry.handleStateChange('late.0.power', sample(1));
  assert.equal(registry.cacheByObjectId.size, 0);
  states.set('late.0.power', sample(45));
  await registry.upsert({ key: 'late', objectId: 'late.0.power' });
  assert.equal(registry.getNumber('late'), 45);
  adapter.subscribeForeignStatesAsync = async id => registry.handleStateChange(id, sample(82));
  await registry.upsert({ key: 'immediate', objectId: 'fast.0.power' });
  assert.equal(registry.getNumber('immediate'), 82);
});

test('deletion invalidates an active measurement and later updates recover normally', async () => {
  const { registry } = fixture();
  await registry.upsert({ key: 'grid', objectId: 'meter.0.power' });
  registry.handleStateChange('meter.0.power', sample(10));
  registry.handleStateChange('meter.0.power', null);
  assert.equal(registry.getNumber('grid', null), null);
  assert.equal(registry.getMeasurementAgeMs('grid'), Infinity);
  registry.handleStateChange('meter.0.power', sample(25));
  assert.equal(registry.getNumber('grid'), 25);
});

test('unchanged upserts and disabled heartbeat release only obsolete connection payloads', async () => {
  const { registry } = fixture();
  const entry = { key: 'grid', objectId: 'nexowatt-devices.0.devices.meter.r.power', useAliveForStale: true };
  for (let i = 0; i < 10; i++) await registry.upsert(entry);
  registry.handleStateChange(entry.objectId, sample(23));
  registry.handleStateChange('nexowatt-devices.0.devices.meter.comm.connected', sample(true));
  await registry.upsert({ ...entry, useAliveForStale: false });
  assert.equal(registry.getNumber('grid'), 23);
  assert.equal(registry.cacheByObjectId.has('nexowatt-devices.0.devices.meter.comm.connected'), false);
  await registry.upsert({ key: 'grid', objectId: 'new.0.power', useAliveForStale: false });
  assert.equal(registry.cacheByObjectId.has(entry.objectId), false);
});

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('a detached late DB prime cannot block a later remap back to that source', async () => {
  const { registry, adapter } = fixture();
  const readStarted = deferred(), oldRead = deferred();
  let reads = 0;
  adapter.getForeignStateAsync = async id => {
    if (id !== 'meter.0.a') return sample(20);
    if (++reads === 1) { readStarted.resolve(); return oldRead.promise; }
    return sample(50);
  };
  const initial = registry.upsert({ key: 'grid', objectId: 'meter.0.a' });
  await readStarted.promise;
  await registry.upsert({ key: 'grid', objectId: 'meter.0.b' });
  oldRead.resolve(sample(1));
  await initial;
  await registry.upsert({ key: 'grid', objectId: 'meter.0.a' });
  assert.equal(reads, 2);
  assert.equal(registry.getNumber('grid'), 50);
});

for (const mode of ['source', 'connection']) {
  test(`A→B→A remapping rejects an obsolete ${mode} DB response`, async () => {
    const { registry, adapter } = fixture();
    const a = 'nexowatt-devices.0.devices.a.r.power';
    const b = 'nexowatt-devices.0.devices.b.r.power';
    const watched = mode === 'source' ? a : 'nexowatt-devices.0.devices.a.comm.connected';
    const started = [deferred(), deferred()], pending = [deferred(), deferred()];
    let reads = 0;
    adapter.getForeignStateAsync = async id => {
      if (id !== watched) return sample(id.endsWith('power') ? 70 : true);
      const index = reads++;
      started[index].resolve();
      return pending[index].promise;
    };
    const entry = { key: 'grid', objectId: a, useAliveForStale: true };
    const first = registry.upsert(entry);
    await started[0].promise;
    await registry.upsert({ ...entry, objectId: b });
    const second = registry.upsert(entry);
    await started[1].promise;
    pending[1].resolve(sample(mode === 'source' ? 70 : true));
    await second;
    pending[0].resolve(sample(mode === 'source' ? 1 : false));
    await first;
    assert.equal(reads, 2);
    assert.equal(registry.getNumber('grid'), 70);
    assert.equal(registry.getConnectionStatus('grid'), true);
  });
}

test('a live sample wins over an older DB read that completes later', async () => {
  const { registry, adapter } = fixture();
  const started = deferred(), pending = deferred();
  adapter.getForeignStateAsync = async () => { started.resolve(); return pending.promise; };
  const initializing = registry.upsert({ key: 'grid', objectId: 'meter.0.power' });
  await started.promise;
  const now = Date.now();
  registry.handleStateChange('meter.0.power', sample(150, now));
  pending.resolve(sample(10, now - 60000));
  await initializing;
  assert.equal(registry.getNumber('grid'), 150);
  assert.equal(registry.getMeasurementTimestampMs('grid'), now);
});

test('a deletion during DB priming cannot resurrect an old measurement', async () => {
  const { registry, adapter } = fixture();
  const started = deferred(), pending = deferred();
  adapter.getForeignStateAsync = async () => { started.resolve(); return pending.promise; };
  const initializing = registry.upsert({ key: 'grid', objectId: 'meter.0.power' });
  await started.promise;
  registry.handleStateChange('meter.0.power', null);
  pending.resolve(sample(400, Date.now() - 60000));
  await initializing;
  assert.equal(registry.getNumber('grid', null), null);
  assert.equal(registry.getMeasurementAgeMs('grid'), Infinity);
  registry.handleStateChange('meter.0.power', sample(75));
  assert.equal(registry.getNumber('grid'), 75);
});
