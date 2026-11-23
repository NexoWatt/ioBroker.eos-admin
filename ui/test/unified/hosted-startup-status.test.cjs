/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { describeHostedStartup, readHostedStartup } = require('../../lib/hosted-startup-status');
const { createHarness } = require('./http-harness.cjs');
const readyHost = () => ({ migration: { phase: 'COMMITTED', code: '', allowsStartup: true }, ownership: { allowed: true, reason: 'CONTROLLER_HANDOVER_CONFIRMED', blockers: [] } });

test('startup status distinguishes waiting, unlicensed, blocked, failure and commissioned runtime', () => {
  const cases = [
    ['idle', 'EOS_UI_NOT_STARTED'], ['starting', 'EOS_UI_STARTING'], ['unlicensed', 'EOS_LICENSE_REQUIRED'],
    ['blocked', 'EOS_UI_OWNERSHIP_REQUIRED'], ['degraded', 'EOS_UI_STARTUP_FAILED'], ['stopped', 'EOS_UI_STOPPED'], ['ready', ''],
  ];
  for (const [state, code] of cases) {
    const result = describeHostedStartup({ state, error: '' }, readyHost(), 'ems');
    assert.equal(result.code, code); assert.equal(result.state, state);
    assert.equal(result.phase, state === 'ready' ? '' : 'ems');
  }
});

test('host-blocked migration and writer diagnostics stay distinct from ordinary startup', () => {
  const host = readyHost(); host.migration = { phase: 'BLOCKED', code: 'EOS_MIGRATION_DESTINATION_CONFIGURED', allowsStartup: false };
  host.ownership = { allowed: false, reason: 'EVIDENCE_EXPIRED', blockers: [{ instance: 'system.adapter.nexowatt-ui.0' }] };
  const result = describeHostedStartup({ state: 'blocked' }, host);
  assert.equal(result.state, 'blocked'); assert.equal(result.code, 'EOS_MIGRATION_DESTINATION_CONFIGURED');
  assert.equal(result.migrationPhase, 'BLOCKED'); assert.equal(result.recoveryPath, '/migration/');
  assert.deepEqual(result.blockingInstances, ['system.adapter.nexowatt-ui.0']);
  host.migration.allowsStartup = true;
  assert.equal(describeHostedStartup({ state: 'idle' }, host).code, 'EOS_UI_OWNERSHIP_REQUIRED');
  host.migration.phase = 'LICENSE_REQUIRED';
  assert.equal(describeHostedStartup({ state: 'blocked' }, host).code, 'EOS_LICENSE_REQUIRED');
  host.migration.code = 'EOS_MIGRATION_RESTART_REQUIRED';
  const restart = describeHostedStartup({ state: 'unlicensed' }, host);
  assert.equal(restart.state, 'blocked'); assert.equal(restart.code, 'EOS_MIGRATION_RESTART_REQUIRED');
  assert.match(restart.message, /Lizenz ist jetzt aktiv/); assert.match(restart.message, /einmal neu starten/);
});

test('failed startup cannot be relabelled as a harmless pending migration or stale grant', () => {
  const host = { migration: { phase: 'ROLLBACK_REQUIRED', allowsStartup: false }, ownership: { allowed: false } };
  assert.equal(describeHostedStartup({ state: 'degraded', error: 'EOS_MIGRATION_UI_STATE_INVALID' }, host).code, 'EOS_MIGRATION_UI_STATE_INVALID');
  assert.equal(describeHostedStartup({ state: 'stopped' }, host).code, 'EOS_UI_STOPPED');
});

test('unknown metadata, secrets and unbounded blockers are never copied into status', () => {
  const secret = 'password=private-marker';
  const result = describeHostedStartup({ state: 'degraded', error: secret, config: secret }, {
    migration: { phase: secret, code: secret }, ownership: { reason: secret, blockers: [
      { instance: secret }, { instance: 'system.adapter.javascript.0' },
      ...Array.from({ length: 40 }, (_, i) => ({ instance: `system.adapter.nexowatt-ui.${i}` })),
    ] }, secret,
  }, secret);
  assert.equal(result.code, 'EOS_UI_STARTUP_FAILED'); assert.equal(result.phase, '');
  assert.ok(result.blockingInstances.length <= 32); assert.equal(JSON.stringify(result).includes(secret), false);
  for (const input of [null, [], true, 4, 'text']) assert.equal(describeHostedStartup(input, input).code, 'EOS_UI_NOT_STARTED');
});

test('readiness provider failure has no writes or change to the existing lifecycle snapshot', () => {
  const startup = { state: 'starting', error: '' }; const before = structuredClone(startup);
  const result = readHostedStartup(startup, { getRuntimeReadiness() { throw new Error('private message'); } }, 'states');
  assert.equal(result.code, 'EOS_UI_STARTING'); assert.deepEqual(startup, before); assert.equal(JSON.stringify(result).includes('private message'), false);
});

test('authenticated EMS status shows the actual migration blocker without starting or writing anything', async () => {
  const h = await createHarness();
  try {
    h.adapter._hostedStartup = { state: 'blocked', error: 'EOS_UI_OWNERSHIP_REQUIRED' };
    h.bridge.getRuntimeReadiness = () => ({ migration: { phase: 'BLOCKED', code: 'EOS_MIGRATION_DESTINATION_CONFIGURED', allowsStartup: false }, ownership: { allowed: false, reason: 'LEGACY_OR_PARALLEL_WRITER', blockers: [{ instance: 'system.adapter.nexowatt-ui.0' }] } });
    const token = await h.login('admin');
    const before = structuredClone([...h.states]);
    const response = await h.request('/api/ems/status', { token });
    assert.equal(response.status, 200); assert.equal(response.data.engine.running, false);
    assert.equal(response.data.startup.code, 'EOS_MIGRATION_DESTINATION_CONFIGURED');
    assert.equal(response.data.startup.recoveryPath, '/migration/');
    assert.deepEqual([...h.states], before); assert.equal(h.adapter.emsEngine, null);
    const installer = await h.login('installer');
    const limited = await h.request('/api/ems/status', { token: installer });
    assert.equal(limited.status, 200); assert.equal(limited.data.startup.recoveryPath, '');
    assert.equal(limited.data.startup.code, 'EOS_MIGRATION_DESTINATION_CONFIGURED');
    assert.equal((await h.request('/api/ems/status')).status, 401);
    const customer = await h.login('kunde');
    assert.equal((await h.request('/api/ems/status', { token: customer })).status, 403);
  } finally { await h.close(); }
});

// Executes the actual frontend functions with a small DOM surface, not a copy of their behavior.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const frontendSource = ts.createSourceFile('ems-apps.ts', fs.readFileSync(path.join(__dirname, '../../src-ts/runtime-executables/www/ems-apps.ts'), 'utf8'), ts.ScriptTarget.ES2020, true);
function frontendFunction(name, globals = {}) {
  let fn = null;
  function find(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === name) fn = node; else ts.forEachChild(node, find); }
  find(frontendSource); assert.ok(fn, `actual function ${name} exists`);
  return vm.runInNewContext(`(${fn.getText(frontendSource)})`, globals);
}
function fakeElement(tag) {
  return { tag, children: [], style: {}, textContent: '', html: '', appendChild(node) { this.children.push(node); },
    set innerHTML(value) { this.html = value; this.children = []; }, get innerHTML() { return this.html; } };
}
function allElements(node) { return [node, ...node.children.flatMap(allElements)]; }

test('EMS frontend displays blocked startup and its safe same-tab recovery link without claiming a running engine', () => {
  const root = fakeElement('section');
  const render = frontendFunction('renderEmsStatus', { els: { emsStatus: root }, document: { createElement: fakeElement } });
  const startup = describeHostedStartup({ state: 'idle' }, { migration: { phase: 'BLOCKED', code: 'EOS_MIGRATION_DESTINATION_CONFIGURED', allowsStartup: false } });
  render({ engine: { running: false }, startup });
  const nodes = allElements(root);
  assert.ok(nodes.some(node => node.textContent === 'Betriebsstart'));
  assert.ok(nodes.some(node => node.textContent.includes('EOS_MIGRATION_DESTINATION_CONFIGURED')));
  assert.ok(nodes.some(node => node.html === 'STOPPED'));
  const links = nodes.filter(node => node.tag === 'a');
  assert.equal(links.length, 1); assert.equal(links[0].href, '/migration/'); assert.equal(links[0].target, undefined);
});

test('EMS frontend keeps diagnostic text inert and omits unauthorized or external recovery links', () => {
  const root = fakeElement('section');
  const render = frontendFunction('renderEmsStatus', { els: { emsStatus: root }, document: { createElement: fakeElement } });
  for (const recoveryPath of ['', 'https://outside.invalid', '/migration/?next=https://outside.invalid']) {
    render({ engine: { running: false }, startup: { state: 'blocked', message: '<img src=x onerror=alert(1)>', recoveryPath } });
    const nodes = allElements(root);
    assert.equal(nodes.filter(node => node.tag === 'a').length, 0);
    assert.ok(nodes.some(node => node.textContent.includes('<img')));
    assert.equal(nodes.some(node => node.html.includes('<img')), false);
  }
});

test('restore frontend reports the specific startup reason and preserves other API error behavior', async () => {
  let body = { ok: false, error: 'EOS_MIGRATION_DESTINATION_CONFIGURED', message: 'Bestandsübernahme prüfen.', startup: { state: 'blocked' } };
  let requests = 0;
  const fetchJson = frontendFunction('fetchJson', { fetch: async () => { requests++; return { ok: false, status: 503, json: async () => body }; }, dynamicGridReloadNotice: 'Konfiguration neu laden' });
  await assert.rejects(fetchJson('/api/installer/backup/import'), /Bestandsübernahme prüfen\. \(EOS_MIGRATION_DESTINATION_CONFIGURED\)/);
  body = { ok: false, error: 'DYNAMIC_GRID_VERSION_CONFLICT' };
  await assert.rejects(fetchJson('/api/installer/config'), /Konfiguration neu laden/);
  body = { ok: false, error: 'forbidden' };
  await assert.rejects(fetchJson('/api/installer/backup/import'), /^Error: forbidden$/);
  assert.equal(requests, 3, 'No hidden retry or restore request is issued');
});

test('restore requests remain blocked for every incomplete start state, with accurate reason and preserved configuration', async () => {
  const h = await createHarness();
  try {
    const token = await h.login('admin'); const customer = await h.login('kunde');
    const backup = { backupVersion: 1, adapterVersion: '1.0.38', configPatch: { enableChargingManagement: true, installer: { gridPowerW: 'knx.0.kept' } } };
    h.states.set('0_userdata.0.nexowattVis.backupJson', { val: JSON.stringify(backup), ack: true });
    // Protected userdata-object provisioning is outside this read/write route boundary test.
    h.adapter.nwEnsureUserdataBackupObjects = async () => true;
    let backupWrites = 0, engineStarts = 0;
    h.adapter.nwWriteUserdataBackup = async () => { backupWrites++; };
    h.adapter.initEmsEngine = async () => { engineStarts++; };
    h.adapter.config.customerCanary = { mapped: 'knx.0.existing' };
    const before = structuredClone(h.adapter.config);
    const beforeStates = structuredClone([...h.states]);
    for (const [state, error] of [['idle', 'EOS_UI_NOT_STARTED'], ['starting', 'EOS_UI_STARTING'], ['blocked', 'EOS_UI_OWNERSHIP_REQUIRED'], ['unlicensed', 'EOS_LICENSE_REQUIRED'], ['degraded', 'EOS_UI_STARTUP_FAILED']]) {
      h.adapter._hostedStartup = { state, error: '' };
      const available = await h.request('/api/installer/backup/userdata', { token });
      assert.equal(available.status, 200); assert.equal(available.data.exists, true); assert.deepEqual(available.data.backup, backup);
      const response = await h.request('/api/installer/backup/import', { token, method: 'POST', body: { backup } });
      assert.equal(response.status, 503); assert.equal(response.data.error, error);
      assert.equal(typeof response.data.message, 'string'); assert.equal(response.data.startup.state, state);
      assert.deepEqual(h.adapter.config, before); assert.deepEqual(h.saved, []);
      assert.equal(backupWrites, 0); assert.equal(engineStarts, 0); assert.deepEqual([...h.states], beforeStates);
    }
    const denied = await h.request('/api/installer/backup/import', { token, method: 'POST', body: {}, csrf: false });
    assert.equal(denied.status, 403); assert.equal(denied.data.error, 'csrf_required');
    const minimal = await h.request('/api/installer/backup/import', { token: customer, method: 'POST', body: {} });
    assert.equal(minimal.status, 503); assert.equal(minimal.data.startup, undefined); assert.equal(minimal.data.message, undefined);
  } finally { await h.close(); }
});
