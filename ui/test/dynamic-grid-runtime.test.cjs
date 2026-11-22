'use strict';
/** NexoWatt: aktive generische Schreibpfade, unverwechselbare Bestätigung und gemeinsame Bereichsreservierung. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
let prefix = '../ems';
if (process.env.NW_DYNAMIC_SOURCE_TEST === '1') {
  const fs = require('node:fs'), ts = require('typescript');
  require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, filename);
  prefix = '../src-ts/runtime-executables/ems';
}
const { DynamicGridWriter } = require(`${prefix}/services/dynamic-grid-writer`);
const { buildDispatchInput, DynamicGridConnectionModule, activeApp } = require(`${prefix}/modules/dynamic-grid-connection`);
const { solveDynamicDispatch } = require(`${prefix}/services/nvp-budget`);
const makeAdapter = () => {
  const states = {}, writes = [];
  return { namespace: 'nexowatt-ui.0', config: {}, states, writes, log: { warn() {} },
    getForeignObjectAsync: async () => ({ type: 'state', common: { write: true, unit: 'W' } }),
    getForeignStateAsync: async id => states[id] || null,
    setForeignStateAsync: async (id, value) => { writes.push([id, value]); states[id] = { val: value, ts: Date.now(), ack: true, q: 0 }; },
    getForeignStatesAsync: async ids => Object.fromEntries(ids.map(id => [id, states[id]])),
    setObjectNotExistsAsync: async () => {}, setStateAsync: async () => {},
  };
};
const output = (id, extra = {}) => ({ stateId: id, scale: 1, sign: 1, ...extra });
const mapping = id => ({ stateId: id, unit: 'W', sign: 1, maxAgeMs: 5000 });
const storage = (id, point = 'M1', authority = 'eos') => ({ id, connectionPointId: point, controlPointId: point, dispatchGroupId: id, primaryPurpose: authority === 'external' ? 'arbitrage' : 'selfConsumption', authority, powerMeasurement: mapping(`${id}.power`), socMeasurement: { stateId: `${id}.soc`, scale: 1, maxAgeMs: 5000 }, maxChargeW: 10000, maxDischargeW: 10000, minSoc: 10, maxSoc: 90, maxDeltaWPerSec: 10000, configuredToleranceW: 50, commandTimeoutMs: 5000, command: { mode: 'signedTarget', signedTarget: output(`${id}.target`) } });
const config = rows => ({ schemaVersion: 1, configVersion: 1, origin: 'dynamicGridConnection', operation: 'active', mode: 'dynamic', maxSkewMs: 1000, points: [ { id: 'M0', parentId: null, measurement: mapping('grid.root'), importLimitW: 50000, exportLimitW: 50000, importReserveW: 0, exportReserveW: 0 }, { id: 'M1', parentId: 'M0', measurement: mapping('grid.inner'), importLimitW: 20000, exportLimitW: 0, importReserveW: 0, exportReserveW: 0 } ], storages: rows, pvAssignments: [] });
const sample = (valueW, now) => ({ valid: true, valueW, ts: now });
const snapshot = (cfg, now = Date.now()) => ({ valid: true, ts: now, configVersion: cfg.configVersion, points: { M0: sample(5000, now), M1: sample(2000, now) }, storages: Object.fromEntries(cfg.storages.map(s => [s.id, sample(0, now)])), storageTelemetry: Object.fromEntries(cfg.storages.map(s => [s.id, { valid: true, available: true, socPct: 50, ts: now, maxDeltaWPerSec: s.maxDeltaWPerSec }])), pv: {}, readbacks: {} });

test('app activation has exactly installed && enabled authority', () => {
  assert.equal(activeApp({ emsApps: { apps: { dynamicGrid: { installed: true, enabled: true } } } }), true);
  assert.equal(activeApp({ emsApps: { apps: { dynamicGrid: { installed: false, enabled: true } } } }), false);
});

test('generic signed DP converts W/raw and sign exactly once; ACK is not applied power', async () => {
  const adapter = makeAdapter(), writer = new DynamicGridWriter(adapter);
  const row = storage('a'); row.command.signedTarget = output('a.target', { scale: 1000, sign: -1 });
  const result = await writer.writeStorage(row, { targetW: 2500 }, () => true);
  assert.deepEqual(adapter.writes, [['a.target', -2.5]]);
  assert.equal(result.accepted, true); assert.equal(result.commandConfirmed, true); assert.equal(result.applied, false);
});

test('unconfirmed split-neutralization stops before opposite direction and flags', async () => {
  const adapter = makeAdapter(), writer = new DynamicGridWriter(adapter);
  adapter.setForeignStateAsync = async (id, value) => { adapter.writes.push([id, value]); adapter.states[id] = { val: value, ts: Date.now(), ack: false }; };
  const row = storage('a'); row.command = { mode: 'splitTarget', chargeTarget: output('charge'), dischargeTarget: output('discharge'), run: { stateId: 'run', onValue: true, offValue: false } };
  const result = await writer.writeStorage(row, { targetW: -5000 }, () => true);
  assert.deepEqual(adapter.writes, [['discharge', 0]]);
  assert.equal(result.commandConfirmed, false);
});

test('confirmed split writes inactive zero, target, then enable/run', async () => {
  const adapter = makeAdapter(), writer = new DynamicGridWriter(adapter);
  const row = storage('a'); row.command = { mode: 'splitTarget', chargeTarget: output('charge'), dischargeTarget: output('discharge'), run: { stateId: 'run', onValue: 1, offValue: 0 } };
  const result = await writer.writeStorage(row, { targetW: 2000 }, () => true);
  assert.deepEqual(adapter.writes, [['charge', 0], ['discharge', 2000], ['run', 1]]);
  assert.equal(result.commandConfirmed, true);
});

test('mapping generation change during first accepted write stops all subsequent writes', async () => {
  const adapter = makeAdapter(), writer = new DynamicGridWriter(adapter); let current = true;
  const original = adapter.setForeignStateAsync;
  adapter.setForeignStateAsync = async (...args) => { await original(...args); current = false; };
  const row = storage('a'); row.command = { mode: 'splitTarget', chargeTarget: output('charge'), dischargeTarget: output('discharge') };
  const result = await writer.writeStorage(row, { targetW: -5000 }, () => current);
  assert.deepEqual(adapter.writes, [['discharge', 0]]); assert.equal(result.commandConfirmed, false);
});

test('readonly output never receives a command', async () => {
  const adapter = makeAdapter(), writer = new DynamicGridWriter(adapter);
  adapter.getForeignObjectAsync = async () => ({ type: 'state', common: { write: false } });
  const result = await writer.writeStorage(storage('a'), { targetW: 2000 }, () => true);
  assert.equal(result.accepted, false); assert.equal(adapter.writes.length, 0);
});

test('PV final generation limit uses percent without reinterpreting it as export', async () => {
  const adapter = makeAdapter(), writer = new DynamicGridWriter(adapter);
  const result = await writer.writePv({ id: 'pv', referencePowerW: 10000, command: output('pv.limit', { unit: '%' }) }, 2500, () => true);
  assert.deepEqual(adapter.writes, [['pv.limit', 25]]); assert.equal(result.applied, false);
});

test('external corridor writes contraction before expansion and watchdog last', async () => {
  const adapter = makeAdapter(), writer = new DynamicGridWriter(adapter), row = storage('trade', 'M0', 'external');
  row.command = { mode: 'externalLimits', maxCharge: output('charge'), maxDischarge: output('discharge'), watchdog: { stateId: 'ttl', writeValue: 1, ttlMs: 5000, readbackStateId: 'ttl', expiryBehavior: 'zeroLimits' } };
  const result = await writer.writeStorage(row, { minPowerW: -1000, maxPowerW: 6000, previousLimits: { maxCharge: 5000, maxDischarge: 3000 } }, () => true);
  assert.deepEqual(adapter.writes, [['charge', 1000], ['discharge', 6000], ['ttl', 1]]); assert.equal(result.commandConfirmed, true);
});

test('pending commands remain in M0/M1 budgets and M1 is not added onto M0', () => {
  const cfg = config([storage('inside'), storage('outside', 'M0')]), snap = snapshot(cfg), now = snap.ts;
  snap.storages.inside.valueW = -1000;
  const plan = { requests: [ { storageId: 'inside', proposedW: 0, minW: -10000, maxW: 10000 }, { storageId: 'outside', proposedW: 0, minW: -10000, maxW: 10000 } ] };
  const input = buildDispatchInput(cfg, snap, plan, { inside: { minPowerW: -4000, maxPowerW: 2000 } }, { nowMs: now });
  assert.equal(input.residuals.M0.minW, 4000); assert.equal(input.residuals.M1.minW, 1000);
  assert.equal(input.participants[0].reservedMinW, -4000); assert.equal(input.participants[0].reservedMaxW, 2000);
});

test('local failure holds M1 while valid outer actuator retains own M0 context', () => {
  const cfg = config([storage('inside'), storage('outside', 'M0')]), snap = snapshot(cfg);
  snap.points.M1.valid = false;
  const input = buildDispatchInput(cfg, snap, { requests: cfg.storages.map(s => ({ storageId: s.id, proposedW: 0 })) }, {}, { nowMs: snap.ts });
  assert.deepEqual(input.participants.map(p => p.id), ['outside']); assert.deepEqual(input.points.map(p => p.id), ['M0']);
});

test('PV disappearance is reserved before storage charging; stale SoC cannot allocate', () => {
  const cfg = config([storage('a')]); cfg.pvAssignments = [{ id: 'pv', connectionPointId: 'M1', referencePowerW: 10000 }];
  const snap = snapshot(cfg); snap.pv.pv = sample(6000, snap.ts);
  const input = buildDispatchInput(cfg, snap, { requests: [{ storageId: 'a', proposedW: -5000 }] }, {}, { nowMs: snap.ts });
  assert.equal(input.residuals.M0.maxW, 11000); assert.equal(input.residuals.M1.maxW, 8000);
  snap.storageTelemetry.a.ts -= 6000;
  assert.equal(buildDispatchInput(cfg, snap, { requests: [{ storageId: 'a', proposedW: -5000 }] }, {}, { nowMs: snap.ts }).participants.length, 0);
});

test('external startup reserves full capability without applied limit feedback', () => {
  const cfg = config([storage('trade', 'M0', 'external')]), snap = snapshot(cfg);
  const input = buildDispatchInput(cfg, snap, { requests: [] }, {}, { nowMs: snap.ts });
  assert.equal(input.participants[0].reservedMinW, -10000); assert.equal(input.participants[0].reservedMaxW, 10000);
});

test('EOS command confirmation alone never clears the previous pending interval', () => {
  const adapter = makeAdapter(), runtime = new DynamicGridConnectionModule(adapter), cfg = config([storage('a')]), snap = snapshot(cfg);
  runtime.pending.a = { minPowerW: -5000, maxPowerW: 0, targetW: -5000, commandConfirmed: true, commandTs: snap.ts - 1 };
  runtime.reconcile(cfg, snap); assert.equal(runtime.pending.a.appliedConfirmed, undefined);
  snap.storages.a.valueW = -5000; runtime.reconcile(cfg, snap); assert.equal(runtime.pending.a.appliedConfirmed, true); assert.equal(runtime.pending.a.maxPowerW, -5000);
});

test('coherent solver permits active mandatory support but labels recovery until measured', () => {
  const solved = solveDynamicDispatch({ points: [{ id: 'M0', importLimitW: 1000, exportLimitW: 1000 }], residuals: { M0: { minW: 2000, maxW: 2000 } }, participants: [{ id: 'a', connectionPointId: 'M0', authority: 'eos', actualW: 0, minPowerW: -10000, maxPowerW: 10000, requestedW: 1000, reservedMinW: 0, reservedMaxW: 0 }] });
  assert.equal(solved.recoveryAllowed, true); assert.equal(solved.safe, false); assert.equal(solved.commands[0].targetW >= 1000, true);
});

test('delayed ACK is confirmed on the next cycle without resetting the issued timestamp', async () => {
  const adapter = makeAdapter(), writer = new DynamicGridWriter(adapter), row = storage('a');
  adapter.setForeignStateAsync = async (id, value) => { adapter.writes.push([id, value]); adapter.states[id] = { val: value, ts: Date.now(), ack: false, q: 0 }; };
  const first = await writer.writeStorage(row, { targetW: 1500 }, () => true);
  assert.equal(first.commandConfirmed, false); const issued = first.writes[0].ts;
  adapter.states['a.target'] = { val: 1500, ts: Date.now(), ack: true, q: 0 };
  const second = await writer.writeStorage(row, { targetW: 1500 }, () => true);
  assert.equal(second.commandConfirmed, true); assert.equal(adapter.writes.length, 1); assert.equal(second.writes[0].ts, issued); assert.equal(second.writes[0].writeIssued, false);
});

test('startup also reserves latent EOS commands, including unavailable excluded devices', () => {
  const cfg = config([storage('a'), storage('b', 'M0')]), snap = snapshot(cfg);
  const plan = { requests: [{ storageId: 'a', proposedW: 0 }, { storageId: 'b', proposedW: 0 }] };
  const input = buildDispatchInput(cfg, snap, plan, {}, { nowMs: snap.ts });
  assert.equal(input.participants[0].reservedMinW, -10000); assert.equal(input.participants[0].reservedMaxW, 10000);
  snap.storageTelemetry.a.valid = false;
  const limited = buildDispatchInput(cfg, snap, plan, {}, { nowMs: snap.ts });
  assert.equal(limited.residuals.M0.minW, -5000); assert.equal(limited.residuals.M0.maxW, 15000);
});

test('previously issued PV cap reserves possible generation growth in storage export budget', () => {
  const cfg = config([storage('a')]); cfg.pvAssignments = [{ id: 'pv', connectionPointId: 'M1', referencePowerW: 10000 }];
  const snap = snapshot(cfg); snap.pv.pv = sample(2000, snap.ts);
  const input = buildDispatchInput(cfg, snap, { requests: [{ storageId: 'a', proposedW: 0 }] }, {}, { nowMs: snap.ts, pendingPvEffects: [{ id: 'pv', maxGenerationW: 9000 }] });
  assert.equal(input.residuals.M0.minW, -2000); assert.equal(input.residuals.M1.minW, -5000);
});

test('active runtime issues a real bounded generic command and retains uncertainty', async () => {
  const adapter = makeAdapter(), row = storage('a'), cfg = config([row]);
  adapter.config = { dynamicGridConnection: cfg, emsApps: { apps: { dynamicGrid: { installed: true, enabled: true } } } };
  const now = Date.now();
  for (const [id, value] of [['grid.root', 5000], ['grid.inner', 2000], ['a.power', 0], ['a.soc', 50]]) adapter.states[id] = { val: value, ts: now, ack: true, q: 0 };
  const runtime = new DynamicGridConnectionModule(adapter);
  runtime.config = cfg;
  runtime.plannerState = { configVersion: 1, groups: { a: { ts: now - 1000, limitedTargetW: 0, members: { a: { ts: now - 1000, limitedTargetW: 0 } } } } };
  await runtime.execute(cfg);
  assert.equal(adapter.writes.some(([id]) => id === 'a.target'), true, JSON.stringify(adapter._nwDynamicGridStatus));
  assert.equal(adapter._nwDynamicGridStatus.storageResults[0].appliedConfirmed, false);
  assert.equal(runtime.pending.a.minPowerW, -10000); assert.equal(runtime.pending.a.maxPowerW, 10000);
});

test('restart-active configuration cannot be deactivated before real handover verification', async () => {
  const adapter = makeAdapter(), row = storage('a'), cfg = config([row]);
  adapter.config = { dynamicGridConnection: cfg, emsApps: { apps: { dynamicGrid: { installed: true, enabled: true } } } };
  adapter._nwValidateDynamicGridConfig = async () => ({ valid: true, config: cfg, topology: cfg });
  const now = Date.now();
  for (const [id, value] of [['grid.root', 5000], ['grid.inner', 2000], ['a.power', 0], ['a.soc', 50]]) adapter.states[id] = { val: value, ts: now, ack: true, q: 0 };
  const runtime = new DynamicGridConnectionModule(adapter);
  const next = { ...adapter.config, emsApps: { apps: { dynamicGrid: { installed: true, enabled: false } } } };
  const first = await runtime.prepareTransition(next);
  assert.equal(first.ok, false); assert.equal(runtime.retainedConfigs.length, 1); assert.equal(adapter.writes.some(([id]) => id === 'a.target'), true, JSON.stringify(adapter._nwDynamicGridStatus));
  await new Promise(resolve => setTimeout(resolve, 2));
  adapter.states['a.power'] = { val: 0, ts: Date.now(), ack: true, q: 0 };
  const second = await runtime.prepareTransition(next);
  assert.equal(second.ok, true); assert.equal(runtime.preparedHandover, true);
});

test('hard discharge cap is applied before solver and actual hardware write', async () => {
  const adapter = makeAdapter(), cfg = config([storage('a')]);
  adapter.config = { dynamicGridConnection: cfg, emsApps: { apps: { dynamicGrid: { installed: true, enabled: true } } } };
  adapter._emsCaps = { storageDischargeLimitW: 400 };
  const now = Date.now();
  for (const [id, value] of [['grid.root', 5000], ['grid.inner', 2000], ['a.power', 0], ['a.soc', 50]]) adapter.states[id] = { val: value, ts: now, ack: true, q: 0 };
  const runtime = new DynamicGridConnectionModule(adapter);
  runtime.plannerState = { configVersion: 1, groups: { a: { ts: now - 1000, limitedTargetW: 0, members: { a: { ts: now - 1000, limitedTargetW: 0 } } } } };
  await runtime.execute(cfg);
  assert.equal(adapter.writes.find(([id]) => id === 'a.target')[1], 400);
});

test('zero charge cap survives planning and physical write even with local export', async () => {
  const adapter = makeAdapter(), cfg = config([storage('a')]);
  adapter.config = { dynamicGridConnection: cfg, emsApps: { apps: { dynamicGrid: { installed: true, enabled: true } } } };
  adapter._emsCaps = { storageChargeLimitW: 0 };
  const now = Date.now();
  for (const [id, value] of [['grid.root', 0], ['grid.inner', -2000], ['a.power', 0], ['a.soc', 50]]) adapter.states[id] = { val: value, ts: now, ack: true, q: 0 };
  const runtime = new DynamicGridConnectionModule(adapter);
  runtime.plannerState = { configVersion: 1, groups: { a: { ts: now - 1000, limitedTargetW: 0, members: { a: { ts: now - 1000, limitedTargetW: 0 } } } } };
  await runtime.execute(cfg);
  assert.equal(adapter.writes.every(([id, value]) => id !== 'a.target' || value >= 0), true);
  assert.equal(adapter._nwDynamicGridStatus.hardLimits.chargeW, 0);
});

test('configuration changes while DP metadata is pending prohibit the later hardware write', async () => {
  const adapter = makeAdapter(), writer = new DynamicGridWriter(adapter); let current = true, release;
  adapter.getForeignObjectAsync = () => new Promise(resolve => { release = resolve; });
  const work = writer.writeStorage(storage('a'), { targetW: 2000 }, () => current);
  current = false; release({ type: 'state', common: { write: true } });
  const result = await work;
  assert.equal(adapter.writes.length, 0); assert.equal(result.accepted, false);
});

test('timed out hardware remains tracked and blocks handover/new physical calls until settled', async () => {
  const adapter = makeAdapter(), writer = new DynamicGridWriter(adapter, { timeoutMs: 50 }); let complete;
  adapter.setForeignStateAsync = (id, value) => { adapter.writes.push([id, value]); return new Promise(resolve => { complete = resolve; }); };
  const result = await writer.writeStorage(storage('a'), { targetW: 2000 }, () => true);
  assert.equal(result.commandConfirmed, false); assert.equal(writer.hasPendingWrites(), true);
  await writer.writeStorage(storage('b'), { targetW: 1000 }, () => true);
  assert.equal(adapter.writes.length, 1);
  complete(); await Promise.resolve(); await Promise.resolve();
  assert.equal(writer.hasPendingWrites(), false);
});

test('live licence loss between split commands prevents the active direction from being released', async () => {
  const adapter = makeAdapter(), row = storage('a'); let licensed = true;
  row.command = { mode: 'splitTarget', chargeTarget: output('a.charge'), dischargeTarget: output('a.discharge') };
  const cfg = config([row]);
  adapter.config = { dynamicGridConnection: cfg, emsApps: { apps: { dynamicGrid: { installed: true, enabled: true } } } };
  const now = Date.now();
  for (const [id, value] of [['grid.root', 5000], ['grid.inner', 2000], ['a.power', 0], ['a.soc', 50]]) adapter.states[id] = { val: value, ts: now, ack: true, q: 0 };
  const original = adapter.setForeignStateAsync;
  adapter.setForeignStateAsync = async (...args) => { await original(...args); licensed = false; };
  const runtime = new DynamicGridConnectionModule(adapter, null, () => licensed);
  runtime.plannerState = { configVersion: 1, groups: { a: { ts: now - 1000, limitedTargetW: 0, members: { a: { ts: now - 1000, limitedTargetW: 0 } } } } };
  await runtime.execute(cfg);
  assert.deepEqual(adapter.writes, [['a.charge', 0]]);
  assert.equal(runtime.pending.a.appliedConfirmed, false);
});

test('zero storage power cannot release ownership while a previous PV increase remains unsafe', async () => {
  const adapter = makeAdapter(), cfg = config([storage('a')]);
  cfg.pvAssignments = [{ id: 'pv', connectionPointId: 'M1', referencePowerW: 10000, powerMeasurement: mapping('pv.power'), command: output('pv.limit') }];
  adapter.config = { dynamicGridConnection: cfg, emsApps: { apps: { dynamicGrid: { installed: true, enabled: true } } } };
  const now = Date.now();
  for (const [id, value] of [['grid.root', 0], ['grid.inner', 0], ['a.power', 0], ['a.soc', 50], ['pv.power', 0]]) adapter.states[id] = { val: value, ts: now, ack: true, q: 0 };
  const runtime = new DynamicGridConnectionModule(adapter);
  runtime.pending.a = { id: 'a', connectionPointId: 'M1', minPowerW: 0, maxPowerW: 0, nextMinPowerW: 0, nextMaxPowerW: 0, targetW: 0, commandConfirmed: true, appliedConfirmed: true, commandTs: now - 1 };
  adapter._nwDynamicGridPvRuntime = { pendingEffects: [{ id: 'pv', maxGenerationW: 10000 }] };
  await runtime.execute(cfg, true);
  assert.equal(runtime.preparedHandover, false);
  assert.equal(adapter._nwDynamicGridStatus.status, 'handover_pending');
  adapter._nwDynamicGridPvRuntime.pendingEffects[0].maxGenerationW = 0;
  await runtime.execute(cfg, true);
  assert.equal(runtime.preparedHandover, true);
  adapter._nwDynamicGridPvRuntime.pendingEffects[0].maxGenerationW = 10000;
  await runtime.execute(cfg, true);
  assert.equal(runtime.preparedHandover, false);
});

function partnerFixture() {
  const adapter = makeAdapter(), row = storage('trade'); row.primaryPurpose='arbitrage';
  const cfg=config([row]);
  const now=Date.now();
  adapter.config={dynamicGridConnection:cfg,emsApps:{apps:{dynamicGrid:{installed:true,enabled:true},arbitrage:{installed:true,enabled:true}}},partnerIntegrations:{enabled:true,configVersion:1,partnerId:'partner-a',arbitrage:{profile:'tradingOnly',resources:[{id:'trade',commissioned:true,maxChargeW:6000,maxDischargeW:6000,minSocPct:20,maxSocPct:90,maxImportW:15000,maxExportW:0,allowGridCharge:true,allowGridExport:false}]}}};
  for(const [id,value] of [['grid.root',5000],['grid.inner',2000],['trade.power',0],['trade.soc',50]]) adapter.states[id]={val:value,ts:now,ack:true,q:0};
  let current={id:'trade-1',resourceId:'trade',action:'charge',powerW:2000,issuedAt:now-10,expiresAt:now+10000,configVersion:1,partnerId:'partner-a'};
  adapter._nwGetPartnerStorageRequest=()=>current;
  const runtime=new DynamicGridConnectionModule(adapter);runtime.config=cfg;
  runtime.plannerState={configVersion:1,groups:{trade:{ts:now-1000,limitedTargetW:0,members:{trade:{ts:now-1000,limitedTargetW:0}}}}};
  return{adapter,runtime,cfg,setRequest:value=>{current=value;},getRequest:()=>current};
}

test('Dynamic Partnerauftrag nutzt gemeinsamen Writer; Capability und Telemetrie entstehen vor Lease',async()=>{
  const f=partnerFixture();await f.runtime.execute(f.cfg);
  assert.equal(f.adapter._nwPartnerResourceAvailability.trade.available,true);
  assert.equal(f.adapter._nwPartnerStorageTelemetry.trade.powerTs,f.adapter.states['trade.power'].ts);
  assert.equal(f.adapter._nwPartnerArbitrageDecisions.trade.targetW,-2000);
  assert.deepEqual(f.adapter.writes.filter(([id])=>id==='trade.target'),[['trade.target',-2000]]);
});

test('Dynamic abgelaufene Partnerlease hält keinen alten Rampenauftrag aktiv',async()=>{
  const f=partnerFixture();await f.runtime.execute(f.cfg);f.adapter.writes.length=0;
  f.setRequest({...f.getRequest(),expiresAt:Date.now()-1});
  // Ursprünglicher Istwert bleibt 0: ein ACK wird nicht als angewandte Leistung erfunden.
  await f.runtime.execute(f.cfg);
  assert.deepEqual(f.adapter.writes.filter(([id])=>id==='trade.target'),[['trade.target',0]]);
});

test('Dynamic Widerruf während Writer-Metadatenawait sperrt alte Geräteausgabe',async()=>{
  const f=partnerFixture();f.adapter.getForeignObjectAsync=async()=>{await Promise.resolve();f.setRequest(null);return{type:'state',common:{write:true,unit:'W'}};};
  await f.runtime.execute(f.cfg);
  assert.equal(f.adapter.writes.filter(([id])=>id==='trade.target').length,0);
});

test('Dynamic fehlender Partnerauftrag ermöglicht Capability und liefert lokalen Rückfallwunsch',async()=>{
  const f=partnerFixture();f.setRequest(null);await f.runtime.execute(f.cfg);
  assert.equal(f.adapter._nwPartnerResourceAvailability.trade.available,true);
  assert.equal(f.adapter._nwPartnerStorageTelemetry.trade.valid,true);
  assert.deepEqual(f.adapter.writes.filter(([id])=>id==='trade.target'),[['trade.target',0]]);
});
