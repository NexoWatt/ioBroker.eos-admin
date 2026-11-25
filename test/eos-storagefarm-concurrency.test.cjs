'use strict';
/** Actual farm runtime, isolated database fixture, no device connections. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.env.EOS_TEST_SOURCE_ROOT || path.resolve(__dirname, '..');
// main.ts intentionally uses the direct-JavaScript build contract. Validate and
// load that exact source; transpiling it here could hide a production build error.
const runtimeFile = path.join(root, 'ui/main.js');
const runtimeSource = fs.readFileSync(path.join(root, 'ui/src-ts/runtime-executables/main.ts'), 'utf8');
new vm.Script(runtimeSource, { filename: runtimeFile });
const readFileSync = fs.readFileSync;
let createHarness;
try {
    fs.readFileSync = function (name, ...args) { return path.resolve(String(name)) === runtimeFile ? runtimeSource : readFileSync.call(this, name, ...args); };
    ({ createHarness } = require(path.join(root, 'ui/test/unified/http-harness.cjs')));
} finally { fs.readFileSync = readFileSync; }

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function fixture(t) {
    const h = await createHarness(); const a = h.adapter;
    t.after(async () => { await new Promise(resolve => a.onUnload(resolve)); await h.close(); });
    a.config = structuredClone(require(path.join(root, 'ui/io-package.json')).native);
    a.config.port = 8188;
    await a.migrateNativeConfig(); await a.loadInstallerConfigFromState();
    a.config.emsApps.apps.storagefarm = { installed: true, enabled: true };
    a.config.enableStorageFarm = true;
    a.config.storageFarm = { enabled: true, mode: 'pool', storages: [{ enabled: true, name: 'Fixture',
        socId: 'farm.member.soc', signedPowerId: 'farm.member.power', availableId: 'farm.member.online',
        setSignedPowerId: 'farm.member.target', capacityKWh: 10, maxChargeW: 5000, maxDischargeW: 5000 }] };
    const set = (id, val, unit) => {
        h.states.set(id, { val, ts: Date.now(), ack: true, q: 0 });
        h.objects.set(id, { type: 'state', common: { type: typeof val, read: true, write: false, unit }, native: {} });
    };
    set('farm.member.soc', 80, '%'); set('farm.member.power', 100, 'W'); set('farm.member.online', true, '');
    await a.ensureStorageFarmStates();
    const reads = []; const publications = [];
    const originalRead = a.getForeignStateAsync.bind(a); const originalWrite = a.setStateAsync.bind(a);
    a.getForeignStateAsync = async id => { reads.push(id); return originalRead(id); };
    a.setStateAsync = async (id, ...args) => { if (id.startsWith('storageFarm.')) publications.push({ id, args }); return originalWrite(id, ...args); };
    return { ...h, a, reads, publications, set, state: id => h.states.get(`eos-admin.0.${id}`)?.val };
}

test('one hundred timer requests do not create overlapping farm aggregations or stale final publication', async t => {
    const f = await fixture(t); const entered = deferred(); const held = deferred();
    const read = f.a.getForeignStateAsync; let first = true;
    f.a.getForeignStateAsync = async id => {
        const value = await read(id);
        if (id === 'farm.member.power' && first) { first = false; entered.resolve(); await held.promise; }
        return value;
    };
    const initial = f.a.updateStorageFarmDerived('timer'); await entered.promise;
    t.after(() => held.resolve());
    f.set('farm.member.power', 900, 'W');
    await Promise.all(Array.from({ length: 100 }, () => f.a.updateStorageFarmDerived('timer')));
    const readCount = f.reads.filter(id => id === 'farm.member.power').length;
    held.resolve(); await initial;
    assert.equal(readCount, 1, 'busy timer must not begin another database snapshot');
    await f.a.updateStorageFarmDerived('timer');
    assert.equal(f.state('storageFarm.totalPowerW'), 900);
});

test('explicit refresh waits for an active aggregation and then reads the latest measurement', async t => {
    const f = await fixture(t); const entered = deferred(); const held = deferred();
    const read = f.a.getForeignStateAsync; let first = true;
    f.a.getForeignStateAsync = async id => {
        const value = await read(id);
        if (id === 'farm.member.power' && first) { first = false; entered.resolve(); await held.promise; }
        return value;
    };
    const initial = f.a.updateStorageFarmDerived('timer'); await entered.promise;
    t.after(() => held.resolve()); f.set('farm.member.power', 900, 'W');
    let refreshed = false;
    const refresh = f.a.updateStorageFarmDerived('dispatch-preflight').then(() => { refreshed = true; });
    await new Promise(resolve => setImmediate(resolve));
    const finishedBeforeRelease = refreshed;
    held.resolve(); await Promise.all([initial, refresh]);
    assert.equal(f.state('storageFarm.totalPowerW'), 900, 'old snapshot must not win after explicit refresh');
    assert.equal(finishedBeforeRelease, false, 'explicit refresh must not race the previous snapshot');
});

for (const interruption of ['shutdown', 'configuration']) test(`delayed old aggregation publishes nothing after ${interruption}`, async t => {
    const f = await fixture(t); const entered = deferred(); const held = deferred();
    const read = f.a.getForeignStateAsync; let first = true;
    f.a.getForeignStateAsync = async id => {
        const value = await read(id);
        if (id === 'farm.member.power' && first) { first = false; entered.resolve(); await held.promise; }
        return value;
    };
    const initial = f.a.updateStorageFarmDerived('timer'); await entered.promise;
    t.after(() => held.resolve());
    if (interruption === 'shutdown') f.a._nwShuttingDown = true;
    else f.a.config = structuredClone(f.a.config);
    held.resolve(); await initial;
    assert.equal(f.publications.length, 0, 'obsolete snapshot must not stamp old farm measurements as current');
});

test('failed publication releases the aggregation flight and a later refresh succeeds', async t => {
    const f = await fixture(t); const write = f.a.setStateAsync; let fail = true;
    f.a.setStateAsync = async (...args) => { if (fail && args[0] === 'storageFarm.totalSoc') throw new Error('TEST_DB_WRITE_FAILED'); return write(...args); };
    await f.a.updateStorageFarmDerived('timer'); fail = false; f.set('farm.member.power', 750, 'W');
    await f.a.updateStorageFarmDerived('timer');
    assert.equal(f.state('storageFarm.totalPowerW'), 750);
});

for (const interruption of ['shutdown', 'configuration']) test(`publication stops after an in-flight database write during ${interruption}`, async t => {
    const f = await fixture(t); const entered = deferred(); const held = deferred();
    const write = f.a.setStateAsync; let first = true;
    f.a.setStateAsync = async (id, ...args) => {
        if (id === 'storageFarm.totalSoc' && first) { first = false; entered.resolve(); await held.promise; }
        return write(id, ...args);
    };
    const initial = f.a.updateStorageFarmDerived('timer'); await entered.promise;
    t.after(() => held.resolve());
    if (interruption === 'shutdown') f.a._nwShuttingDown = true;
    else f.a.config = structuredClone(f.a.config);
    held.resolve(); await initial;
    assert.equal(f.publications.length, 1, 'already-issued write may settle, but no remaining publications are admitted');
    assert.equal(f.a.stateCache['storageFarm.totalPowerW'], undefined, 'cancelled snapshot cannot refresh the runtime cache');
});
