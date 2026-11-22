'use strict';
/** Schreibhoheit vor Erstbefehl, Alias-Umgehung und bestätigte Übergabe. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const loaded = new Map();
function sourceModule(relative) {
  const filename = path.resolve(__dirname, '../src-ts/runtime-executables', relative);
  if (loaded.has(filename)) return loaded.get(filename).exports;
  const module = { exports: {} }; loaded.set(filename, module);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const localRequire = (id) => id.startsWith('.')
    ? sourceModule(path.relative(path.resolve(__dirname, '../src-ts/runtime-executables'), path.resolve(path.dirname(filename), id + '.ts')))
    : require(id);
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}
const ownership = sourceModule('ems/services/dynamic-grid-ownership.ts');
const { installActuatorShadowArbiter, withActuatorShadowContext } = sourceModule('ems/services/actuator-shadow-arbiter.ts');
const cfg = () => ({ storages: [{ command: { signedTarget: { stateId: 'alias.owned' }, run: { stateId: 'device.run' }, appliedMaxCharge: { stateId: 'feedback' } } }], pvAssignments: [{ command: { stateId: 'pv.limit' } }] });
function adapter() {
  const calls = [];
  return {
    namespace: 'nexowatt-ui.0',
    config: { diagnostics: { actuatorArbiterMode: 'shadow' }, emsApps: { apps: { dynamicGrid: { installed: true, enabled: true } } }, dynamicGridConnection: cfg() },
    _nwDynamicGridCanonicalTargets: { 'alias.owned': ['alias.owned', 'device.target'], 'device.run': ['device.run'], 'pv.limit': ['pv.limit'] },
    calls,
    getForeignObjectAsync: async (id) => ({ type: 'state', common: id === 'alias.free' ? { alias: { id: { read: 'irrelevant', write: 'device.target' } } } : {} }),
    setForeignStateAsync: async (...args) => { calls.push(args); return { ok: true }; },
    setForeignStateChangedAsync: async (...args) => { calls.push(args); return { ok: true }; },
  };
}

test('aktive Konfiguration beansprucht Ausgänge vor Runtime und vor erster Lease', () => {
  const a = adapter();
  assert.equal(ownership.dynamicGridHasControl(a), true);
  for (const id of ['alias.owned', 'device.target', 'device.run', 'pv.limit']) assert.equal(ownership.isDynamicGridOwned(a, id), true);
  assert.equal(ownership.isDynamicGridOwned(a, 'feedback'), false);
  assert.equal(ownership.isDynamicGridOwned(a, 'unrelated'), false);
});

test('Shadow, gleiche Werte, Keepalive und manuelle API umgehen konfigurierte Hoheit nicht', async () => {
  const a = adapter(); const arbiter = installActuatorShadowArbiter(a);
  for (const owner of ['storage', 'manual.ems', 'nexologic', 'safety-lifecycle']) {
    const result = await withActuatorShadowContext(a, { owner, priority: 999 }, () => a.setForeignStateAsync('device.target', 0, false));
    assert.equal(result.__nexowattActuatorAuthorityBlocked, true);
  }
  const skipped = withActuatorShadowContext(a, { owner: 'storage' }, () => arbiter.guardSkippedWrite('device.target', 0));
  assert.equal(skipped.__nexowattActuatorAuthorityBlocked, true);
  assert.equal(a.calls.length, 0);
  const accepted = await withActuatorShadowContext(a, { owner: 'dynamicGridConnection', enforceAuthority: true, dynamicGridGuard: () => true }, () => a.setForeignStateAsync('device.target', 0, false));
  assert.equal(accepted.ok, true); assert.equal(a.calls.length, 1);
});

test('freier Alias auf physisches Ziel wird vor Schreibausführung aufgelöst und gesperrt', async () => {
  const a = adapter(); installActuatorShadowArbiter(a);
  const result = await withActuatorShadowContext(a, { owner: 'manual.ems' }, () => a.setForeignStateChangedAsync('alias.free', 1200, false));
  assert.equal(result.__nexowattActuatorAuthorityBlocked, true);
  assert.equal(a.calls.length, 0);
  assert.equal(ownership.isDynamicGridOwned(a, 'alias.free'), true);
});

test('unaufgelöster Alias wird blockiert, fremder bekannter Aktor bleibt nutzbar', async () => {
  const a = adapter(); a.getForeignObjectAsync = async (id) => id === 'alias.bad' ? null : { type: 'state', common: {} };
  installActuatorShadowArbiter(a);
  const bad = await a.setForeignStateAsync('alias.bad', 3, false);
  assert.equal(bad.reason, 'dynamic-grid-write-alias-unresolved');
  assert.equal((await a.setForeignStateAsync('light.brightness', 40, false)).ok, true);
  assert.equal(a.calls.length, 1);
});

test('Deaktivierung behält alte Ziele bis Runtime die bestätigte Übergabe freigibt', () => {
  const a = adapter(); const old = cfg();
  a.config.emsApps.apps.dynamicGrid.enabled = false;
  a.config.dynamicGridConnection = { storages: [] };
  a._nwDynamicGridConnectionRuntime = { retainedConfigs: [old] };
  assert.equal(ownership.dynamicGridHasControl(a), true);
  assert.equal(ownership.isDynamicGridOwned(a, 'device.target'), true);
  a._nwDynamicGridConnectionRuntime.retainedConfigs = [];
  assert.equal(ownership.dynamicGridHasControl(a), false);
  assert.equal(ownership.isDynamicGridOwned(a, 'device.target'), false);
});

test('inaktive App ändert alte Writes nicht und fragt keine Objekte ab', async () => {
  const a = adapter(); a.config.emsApps.apps.dynamicGrid.enabled = false;
  a.getForeignObjectAsync = () => { throw new Error('unexpected query'); };
  installActuatorShadowArbiter(a);
  assert.equal((await a.setForeignStateAsync('device.target', 500, false)).ok, true);
  assert.equal(a.calls.length, 1);
});

test('expliziter Hardware-Notstopp bleibt möglich, allgemeine Safetybezeichnung reicht nicht', async () => {
  const a = adapter(); installActuatorShadowArbiter(a);
  const result = await withActuatorShadowContext(a, { owner: 'hardware-stop.operator' }, () => a.setForeignStateAsync('device.target', 0, false));
  assert.equal(result.ok, true);
});

test('Bestands-Speicherregler übergibt Tick, direkten Write und Deaktivierung ohne Nullbefehl', async () => {
  const filename = path.resolve(__dirname, '../src-ts/runtime-executables/ems/modules/storage-control.ts');
  const content = fs.readFileSync(filename, 'utf8');
  const ast = ts.createSourceFile(filename, content, ts.ScriptTarget.Latest, true);
  const wanted = new Set(['tick', 'deactivate', '_applyTargetW', '_getStorageControlAuthority']);
  const methods = [];
  function visit(node) {
    if (ts.isMethodDeclaration(node) && wanted.has(node.name?.getText(ast))) methods.push(node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.equal(methods.length, 4);
  const Controller = new Function('dynamicGridHasControl', `return class { ${methods.join('\n')} };`)(ownership.dynamicGridHasControl);
  const controller = new Controller(); controller.adapter = adapter();
  controller._getCfg = () => { throw new Error('Legacy-Regler darf keine Sollwerte planen'); };
  controller.dp = { writeNumber: () => { throw new Error('Legacy-Write'); } };
  await controller.tick();
  assert.equal((await controller._applyTargetW(0, 'old-stop', 'safety-lifecycle')).accepted, false);
  const stop = await controller.deactivate();
  assert.equal(stop.attempted, 0); assert.equal(stop.transferredTo, 'dynamicGrid');
  assert.equal(controller._getStorageControlAuthority().selectedTopology, 'dynamic');
  assert.equal(controller.adapter.calls.length, 0);
});

test('verzögerter App-Write prüft seine Generation direkt vor Geräteausgabe erneut', async () => {
  const a = adapter(); const arbiter = installActuatorShadowArbiter(a);
  let current = true, proceed;
  const wait = new Promise(resolve => { proceed = resolve; });
  const write = withActuatorShadowContext(a, { owner: 'dynamicGridConnection', dynamicGridGuard: () => current }, async () => {
    await wait;
    return a.setForeignStateAsync('device.target', 1000, false);
  });
  current = false; proceed();
  assert.equal((await write).reason, 'dynamic-grid-generation-changed');
  const skipped = withActuatorShadowContext(a, { owner: 'dynamicGridConnection', dynamicGridGuard: () => current }, () => arbiter.guardSkippedWrite('device.target', 1000));
  assert.equal(skipped.reason, 'dynamic-grid-generation-changed');
  assert.equal(a.calls.length, 0);
});

test('Appwriter ohne eigenen gültigen Vertrag darf keine fremden Aktoren beschreiben', async () => {
  const a = adapter(); installActuatorShadowArbiter(a);
  const result = await withActuatorShadowContext(a, { owner: 'dynamicGridConnection', dynamicGridGuard: () => true }, () => a.setForeignStateAsync('light.brightness', 1000, false));
  assert.equal(result.reason, 'dynamic-grid-target-not-owned'); assert.equal(a.calls.length, 0);
});

test('unbekannte eigene Alias-Schreibseite sperrt Fremdschreiber schon vor Startupvalidierung', async () => {
  const a = adapter(); a._nwDynamicGridCanonicalTargets = {};
  installActuatorShadowArbiter(a);
  assert.equal(ownership.hasCompleteDynamicGridOwnership(a), false);
  const result = await withActuatorShadowContext(a, { owner: 'manual.ems' }, () => a.setForeignStateAsync('device.target', 4500, false));
  assert.equal(result.reason, 'dynamic-grid-write-alias-unresolved'); assert.equal(a.calls.length, 0);
});

test('Partnerwiderruf blockiert reale Writes, Changed-Writes und Keepalive auch ohne Autoritätslease', async () => {
  const a = adapter(); a.config.emsApps.apps.dynamicGrid.enabled = false;
  const arbiter = installActuatorShadowArbiter(a);
  for (const method of ['setForeignStateAsync', 'setForeignStateChangedAsync']) {
    const result = await withActuatorShadowContext(a, { owner: 'storage', partnerControlRequired: true, partnerControlGuard: () => false }, () => a[method]('device.target', 1000, false));
    assert.equal(result.reason, 'partner-control-expired-or-revoked');
  }
  const skipped = withActuatorShadowContext(a, { partnerControlRequired: true, partnerControlGuard: () => false }, () => arbiter.guardSkippedWrite('device.target', 1000));
  assert.equal(skipped.__nexowattActuatorAuthorityBlocked, true);
  assert.equal(a.calls.length, 0);
});

test('Partnerwiderruf während Alias-await verhindert Geräteausgabe', async () => {
  const a = adapter(); let valid = true, proceed;
  a.getForeignObjectAsync = () => new Promise(resolve => { proceed = () => resolve({type:'state', common:{}}); });
  installActuatorShadowArbiter(a);
  const write = withActuatorShadowContext(a, { owner: 'storage', partnerControlRequired: true, partnerControlGuard: () => valid }, () => a.setForeignStateAsync('unowned.target', 1000, false));
  valid = false; proceed();
  assert.equal((await write).__nexowattActuatorAuthorityBlocked, true);
  assert.equal(a.calls.length, 0);
});

for (const restart of [false, true]) test(`Partnerfortsetzung nach Stop${restart ? ' und Reinstall' : ''} bleibt gesperrt`, async () => {
  const a = adapter(); a.config.emsApps.apps.dynamicGrid.enabled = false;
  const arbiter = installActuatorShadowArbiter(a); let resume;
  const wait = new Promise(resolve => { resume = resolve; });
  const write = withActuatorShadowContext(a, { partnerControlRequired: true, partnerControlGuard: () => true }, async () => { await wait; return a.setForeignStateAsync('device.target', 1000, false); });
  arbiter.stop(); if (restart) arbiter.install(a); resume();
  assert.equal((await write).__nexowattActuatorAuthorityBlocked, true);
  assert.equal(a.calls.length, 0);
});

test('fehlender oder abgemeldeter Arbiter führt Partner-Callback niemals aus', () => {
  const a = adapter(); let calls = 0;
  const context = { partnerControlRequired: true, partnerControlGuard: () => true };
  assert.throws(() => withActuatorShadowContext(a, context, () => calls++), /arbiter-unavailable/);
  const arbiter = installActuatorShadowArbiter(a); arbiter.uninstall();
  assert.throws(() => withActuatorShadowContext(a, context, () => calls++), /arbiter-unavailable/);
  assert.equal(calls, 0);
});

test('gültiger Partnerauftrag verwendet genau bestehenden Writer, lokaler Rückfall bleibt nach Stop möglich', async () => {
  const a = adapter(); a.config.emsApps.apps.dynamicGrid.enabled = false;
  const arbiter = installActuatorShadowArbiter(a);
  assert.equal((await withActuatorShadowContext(a, { partnerControlRequired: true, partnerControlGuard: () => true }, () => a.setForeignStateAsync('device.target', 700, false))).ok, true);
  assert.equal(a.calls.length, 1); arbiter.stop();
  assert.equal((await a.setForeignStateAsync('device.target', 0, false)).ok, true);
  assert.equal(a.calls.length, 2);
});
