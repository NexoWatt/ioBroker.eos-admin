'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { HostedAdapter, centralAccess, centralLicenseSnapshot } = require('../../lib/hosted-adapter');
const { createHostedRuntime } = require('../../main');

function fixture() {
  let writable = true;
  const writes = [];
  const hostObject = { _id: 'system.adapter.eos-admin.0', type: 'instance', common: { enabled: true },
    native: { auth: true, secure: false, port: 8188, eosUi: { siteName: 'Anlage' } } };
  const owner = { namespace: 'eos-admin.0', instance: 0, config: { ...hostObject.native },
    log: { error() {}, warn() {}, info() {}, debug() {} },
    getForeignObjectAsync: async () => structuredClone(hostObject),
    setForeignObjectAsync: async (id, object) => { writes.push({ id, object }); },
    setForeignStateAsync: async (...args) => writes.push(args),
    setForeignStateChangedAsync: async (...args) => writes.push(args),
    setForeignState: (...args) => writes.push(args),
    setForeignStateChanged: (...args) => writes.push(args),
  };
  const bridge = { originAllowed: () => true, canWrite: () => writable, getLicense: () => ({ valid: false }), resolveAccess: async () => null };
  return { owner, bridge, writes, setWritable(value) { writable = value; } };
}
test('facade creates no adapter and isolates native.eosUi from host security fields', async () => {
  const { owner, bridge, writes } = fixture();
  const runtime = new HostedAdapter({ owner, bridge });
  const object = await runtime.getForeignObjectAsync('system.adapter.eos-admin.0');
  assert.equal(object.native.siteName, 'Anlage');
  assert.equal(object.native.eosUi, undefined);
  object.native.auth = false; object.native.port = 9999; object.native.secure = false;
  object.native.licenseKey = 'must-not-persist'; object.native.siteName = 'Neu'; object.common.enabled = false;
  await runtime.setForeignObjectAsync('system.adapter.eos-admin.0', object);
  const saved = writes[0].object;
  assert.equal(saved.native.auth, true); assert.equal(saved.native.port, 8188);
  assert.equal(saved.common.enabled, true); assert.equal(saved.native.eosUi.siteName, 'Neu');
  assert.equal(saved.native.eosUi.licenseKey, undefined); assert.equal(saved.native.eosUi.auth, undefined);
});
test('all four foreign state APIs enforce the current owner generation', async () => {
  const fixtureValue = fixture(); const facade = new HostedAdapter(fixtureValue);
  await facade.setForeignStateAsync('device.0.power', 1);
  fixtureValue.setWritable(false);
  await assert.rejects(facade.setForeignStateAsync('device.0.power', 2), /OWNERSHIP_LOST/);
  await assert.rejects(facade.setForeignStateChangedAsync('device.0.power', 2), /OWNERSHIP_LOST/);
  assert.throws(() => facade.setForeignState('device.0.power', 2), /OWNERSHIP_LOST/);
  assert.throws(() => facade.setForeignStateChanged('device.0.power', 2), /OWNERSHIP_LOST/);
  assert.equal(fixtureValue.writes.length, 1);
});
test('license requires a valid central core grant and preserves signed limits', () => {
  const state = { valid: true, coreEnabled: false, edition: 'pro', limits: { chargePoints: 4, batteries: 1 }, features: ['energy'] };
  const bridge = { getLicense: () => state };
  assert.equal(centralLicenseSnapshot(bridge).ok, false);
  state.coreEnabled = true;
  assert.equal(centralLicenseSnapshot(bridge).maxWallboxes, 4);
  assert.equal(centralLicenseSnapshot(bridge).maxStorages, 1);
  state.valid = false; assert.equal(centralLicenseSnapshot(bridge).edition, 'none');
});
test('central access rejects required password setup and missing credential binding', async () => {
  const state = { authenticated: true, user: 'system.user.demo', role: 'customer', mustChangePassword: false,
    groups: [], capabilities: ['frontend.open'], csrfToken: 'x'.repeat(32), credentialKey: 'revision-1' };
  const bridge = { resolveAccess: async () => state };
  assert.equal((await centralAccess(bridge, {})).isCustomer, true);
  state.capabilities = ['*', 'license.manage', 'frontend.open'];
  assert.deepEqual((await centralAccess(bridge, {})).capabilities, ['frontend.open']);
  state.mustChangePassword = true; assert.equal((await centralAccess(bridge, {})).authenticated, false);
  state.mustChangePassword = false; state.credentialKey = ''; assert.equal((await centralAccess(bridge, {})).authenticated, false);
});
test('hosted shell opens no listener; HTTP authorization remains fail closed', async t => {
  const f = fixture(); f.setWritable(false);
  const { UnifiedSessions } = require('../../../src/lib/eosUnifiedBoundary');
  const boundary = new UnifiedSessions(f.owner, { secure: false, externalOrigin: '', resolveAccess: async () => ({}), firstLogin: async () => ({ required: false }), getLicense: f.bridge.getLicense });
  f.bridge.originAllowed = req => boundary.requestAllowed(req);
  let calls = 0;
  const original = http.Server.prototype.listen;
  http.Server.prototype.listen = function (...args) { calls++; return original.apply(this, args); };
  const runtime = createHostedRuntime(f.owner, f.bridge);
  try { await runtime.start(); await runtime.start(); assert.equal(calls, 0); assert.equal(runtime.status().state, 'unlicensed'); }
  finally { http.Server.prototype.listen = original; }
  const server = http.createServer((req, res) => runtime.handle(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await runtime.stop(); await runtime.stop(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const script = await fetch(base + '/static/login.js');
  assert.equal(script.status, 200); assert.match(script.headers.get('content-type'), /javascript/);
  const logo = await fetch(base + '/static/nexowatt-eos-logo.png'); assert.equal(logo.status, 200);
  const response = await fetch(base + '/api/state');
  assert.equal(response.status, 401);
  const page = await fetch(base + '/', { redirect: 'manual' });
  assert.equal(page.status, 303); assert.ok(page.headers.get('location').startsWith('/login.html'));
  f.bridge.originAllowed = () => false;
  assert.equal((await fetch(base + '/api/state')).status, 403);
});

test('fresh UI snapshot never converts revoked Home to Pro; control retains only verified old limits', async () => {
  const { createHarness } = require('./http-harness.cjs');
  const h = await createHarness();
  try {
    let snapshot = { valid: true, coreEnabled: true, edition: 'home', limits: { chargePoints: 2, batteries: 1 }, features: ['energy','wallet','smartHome','microgridSlave'] };
    h.bridge.getLicense = () => snapshot;
    assert.equal(h.adapter._nwBuildLicenseFeatureInfo().edition, 'hems');
    assert.equal(h.adapter._nwBuildLicenseFeatureInfo().features.energyWalletOperator, false);
    assert.equal(h.adapter._nwBuildLicenseFeatureInfo().features.meshMicrogrid, true);
    h.adapter._nwRuntimeLicenseSnapshot(); h.adapter._hostedOperational = true;
    snapshot = { valid: false, coreEnabled: false };
    const info = h.adapter._nwBuildLicenseFeatureInfo();
    assert.equal(info.valid, false); assert.equal(info.edition, 'none'); assert.equal(info.proFullAccess, false);
    assert.equal(Object.values(info.features).some(Boolean), false);
    assert.equal(h.adapter._nwLicenseMaxWallboxes(), 2);
    assert.equal(h.adapter._nwLicenseMaxStorages(), 1);
    assert.equal(h.adapter._nwHasCentralLicenseGrant('energy'), false);
    assert.equal(h.adapter._nwHasCentralLicenseGrant('energy', true), true);
    assert.equal(h.adapter._nwHasCentralLicenseGrant('microgridMaster', true), false);
    snapshot = { valid: true, coreEnabled: true, edition: 'pro', limits: { chargePoints: 4, batteries: 1 }, features: ['energy'] };
    const { ModuleManager } = require('../../ems/module-manager');
    assert.equal(ModuleManager.prototype._licenseAllowsApp.call({adapter:h.adapter}, 'energyWallet'), false);
    assert.equal(ModuleManager.prototype._licenseAllowsApp.call({adapter:h.adapter}, 'meshMicrogrid'), false);
    assert.equal(ModuleManager.prototype._licenseAllowsApp.call({adapter:h.adapter}, 'storage'), true);
  } finally { await h.close(); }
});
