'use strict';
/** Real runtime/config-store/migration functions with an in-memory controller.
 * Fixtures were written by the original 9.0.21 persistInstallerConfigToState.
 * Provider credentials are synthetic. No provider requests or actuator writes.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const { EosLegacyMigration } = require('../src/lib/eosLegacyMigration');
const historical = require('./fixtures/tariff-provider-9.0.21.json');
const defaults = require('../io-package.json').native.eosUi;
const settings = {
  dynamicTariff: true, tariffMode: 0, price: 0.173, priority: 3,
  tariffPvSeasonEnabled: true, tariffPvSeasonAiEnabled: false,
  tariffPvSeasonQ1Factor: 0.45, tariffPvSeasonQ2Factor: 1.2,
  tariffPvSeasonQ3Factor: 1.15, tariffPvSeasonQ4Factor: 0.55,
  netFeeEnabled: true, netFeeModel: 2, netFeePriceNt: 0,
  netFeePriceHt: 0.12, netFeePriceSt: 0.06, netFeeNtStart: '23:15', netFeeNtEnd: '05:30',
};

function freshRuntime(h) {
  // Construct another actual runtime against the same persisted controller data.
  // Unlike the HTTP fixture adapter, this instance has no mocked save/load methods.
  return new (Object.getPrototypeOf(h.adapter).constructor)({ owner: h.owner, bridge: h.bridge });
}
function seed(h, namespace, row) {
  const id = `${namespace}.installer.configJson`;
  h.states.set(id, { val: row.stateJson, ack: true, ts: 1700000000000, q: 0 });
  h.objects.set(id, { _id: id, type: 'state', common: { type: 'string', read: false, write: true },
    native: {}, acl: { owner: 'system.user.admin', ownerGroup: 'system.group.administrator', object: 0x600, state: 0x600 } });
  for (const [key, val] of Object.entries(settings)) h.states.set(`${namespace}.settings.${key}`, { val, ack: true, q: 0, ts: 1700000000000 });
  return { id, before: structuredClone(h.states.get(id)), patch: JSON.parse(row.stateJson) };
}
async function hydrate(runtime) {
  await runtime.migrateNativeConfig();
  await runtime.ensureSettingsStates();
  await runtime.loadInstallerConfigFromState();
  await runtime.syncSettingsToStates(true);
}
function assertRetained(h, runtime, snapshot) {
  assert.deepEqual(runtime.config.tariffProvider, snapshot.patch.tariffProvider);
  assert.deepEqual(runtime.config.datapoints, snapshot.patch.datapoints);
  assert.deepEqual(runtime.config.settings, snapshot.patch.settings);
  for (const key of ['installed', 'enabled']) assert.equal(runtime.config.emsApps.apps.tariff[key], snapshot.patch.emsApps.apps.tariff[key]);
  assert.deepEqual(h.states.get(snapshot.id), snapshot.before, 'normal startup must not rewrite the saved JSON, ACK, quality or timestamp');
  for (const [key, val] of Object.entries(settings)) assert.deepEqual(h.states.get(`${runtime.namespace}.settings.${key}`),
    { val, ack: true, q: 0, ts: 1700000000000 }, `existing setting ${key}, including false/0, survives defaults`);
}

for (const row of historical.providers) {
  test(`9.0.21 ${row.id} provider selection, credentials and tariff settings survive upgrade and two restarts`, async t => {
    const h = await createHarness(); t.after(() => h.close());
    // Package/instance defaults are deliberately different from the persisted selection.
    h.owner.config.eosUi = { ...structuredClone(defaults), tariffProvider: { enabled: false, providerId: 'manual-dp', credentials: {} } };
    const snapshot = seed(h, h.owner.namespace, row);
    for (let restart = 0; restart < 2; restart++) {
      const runtime = freshRuntime(h);
      await hydrate(runtime);
      assertRetained(h, runtime, snapshot);
    }
    // A subsequent explicit save uses the real ACL-protected persistence path,
    // after which another newly constructed runtime must read the same secrets.
    const writer = freshRuntime(h);
    await hydrate(writer);
    assert.equal(await writer.persistInstallerConfigToState(writer._nwInstallerConfigPatch), true);
    const saved = structuredClone(h.states.get(snapshot.id));
    const restarted = freshRuntime(h); await hydrate(restarted);
    assertRetained(h, restarted, { ...snapshot, before: saved });
    assert.equal(h.objects.get(snapshot.id).acl.state, 0x600);
    assert.equal(h.objects.get(snapshot.id).common.read, false);
  });
}

function migrationController(h) {
  const secret = randomBytes(32);
  h.owner.config.eosUi = structuredClone(defaults);
  h.owner.config.eosModules = {};
  Object.assign(h.owner, {
    eosOwnership: { canWrite: () => true },
    eosLicenseService: { statusView: () => ({ valid: true, coreEnabled: true }), allowsEmbeddedModule: () => true },
    encrypt(value) { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', secret, iv); return Buffer.concat([iv, cipher.update(value), cipher.final(), cipher.getAuthTag()]).toString('base64'); },
    decrypt(value) { const b = Buffer.from(value, 'base64'), decipher = createDecipheriv('aes-256-gcm', secret, b.subarray(0, 12)); decipher.setAuthTag(b.subarray(-16)); return Buffer.concat([decipher.update(b.subarray(12, -16)), decipher.final()]).toString(); },
    getObjectViewAsync: async (_design, _search, range) => ({ rows: [...h.objects.values()].filter(obj => obj._id >= range.startkey && obj._id <= range.endkey).map(value => ({ value: structuredClone(value) })) }),
  });
  const extend = h.owner.extendForeignObjectAsync;
  h.owner.extendForeignObjectAsync = async (id, patch) => {
    await extend(id, patch);
    if (patch.common?.enabled !== undefined) {
      const ts = Date.now(); h.objects.get(id).ts = ts;
      h.states.set(`${id}.alive`, { val: patch.common.enabled, ack: true, ts: ts + 1 });
    }
  };
  h.objects.set(`system.adapter.${h.owner.namespace}`, { _id: `system.adapter.${h.owner.namespace}`, type: 'instance', native: h.owner.config, common: { enabled: true, host: 'fixture-host' } });
  h.states.set('system.host.fixture-host.alive', { val: true, ack: true, ts: Date.now() });
  const options = { baseDir: path.resolve(__dirname, '..'), dataDir: '/tmp/unused-tariff-migration', stopTimeoutMs: 100, startTimeoutMs: 100 };
  return () => { const migration = new EosLegacyMigration(h.owner, options); h.owner.eosMigration = migration; return migration; };
}

test('UI handover and persisted migration restart retain the original tariff namespace, secret state and protected native configuration', async t => {
  const h = await createHarness(); t.after(() => h.close());
  const makeMigration = migrationController(h);
  const namespace = 'nexowatt-ui.3';
  const snapshot = seed(h, namespace, historical.providers.find(row => row.id === 'tibber'));
  const source = `system.adapter.${namespace}`;
  h.objects.set(source, { _id: source, type: 'instance', ts: Date.now() - 100,
    common: { version: '1.0.37', host: 'fixture-host', enabled: true },
    native: { tariffProvider: snapshot.patch.tariffProvider, settings: snapshot.patch.settings, siteName: 'existing-site' } });
  h.states.set(`${source}.alive`, { val: true, ack: true, ts: Date.now() });
  const migration = makeMigration(); t.after(() => migration.stop());
  await migration.start();
  assert.equal(migration.phase, 'TRANSFERRED');
  assert.equal(h.objects.get(source).common.enabled, false);
  assert.equal(h.owner.config.eosUiMigration.source, namespace);
  let runtime = freshRuntime(h); await hydrate(runtime); assertRetained(h, runtime, snapshot);
  assert.equal(runtime.namespace, namespace);
  // Exercise real encrypted ConfigStore write/read, without overwriting the
  // original installer state. Readiness is a controller fixture, not a HW claim.
  await migration.saveUi({ ...h.owner.config.eosUi, siteName: 'updated-site' });
  h.owner.eosHostedRuntime = { status: () => ({ emsReady: true, canWrite: true }) };
  await migration.verifyRuntime(); assert.equal(migration.phase, 'COMMITTED');
  h.owner.config.eosUi = structuredClone(defaults); delete h.owner.config.eosUiMigration;
  const restartedMigration = makeMigration(); t.after(() => restartedMigration.stop());
  await restartedMigration.start(); assert.equal(restartedMigration.phase, 'COMMITTED');
  assert.equal(h.owner.config.eosUi.siteName, 'updated-site');
  runtime = freshRuntime(h); await hydrate(runtime); assertRetained(h, runtime, snapshot);
  const store = h.objects.get(`${h.owner.namespace}.modules.ui.configuration`);
  assert.equal(store.acl.object, 0x600);
  for (const secret of Object.values(snapshot.patch.tariffProvider.credentials)) assert.equal(JSON.stringify(store).includes(secret), false);
  assert.equal(h.states.has(`${h.owner.namespace}.installer.configJson`), false, 'the upgrade must not create an empty second provider config');
});

test('existing EOS update without a handover journal reloads protected UI config and preserves tariffs while external OCPP remains separate', async t => {
  const h = await createHarness(); t.after(() => h.close());
  const makeMigration = migrationController(h);
  const snapshot = seed(h, h.owner.namespace, historical.providers.find(row => row.id === 'entsoe'));
  const previous = makeMigration(); t.after(() => previous.stop());
  await previous.saveUi({ tariffProvider: snapshot.patch.tariffProvider, settings: snapshot.patch.settings, siteName: 'existing-eos' });
  h.owner.config.eosUi = structuredClone(defaults);
  const external = { _id: 'system.adapter.ocpp21.0', type: 'instance', common: { version: '0.2.2', host: 'fixture-host', enabled: true }, native: { port: 9220 } };
  h.objects.set(external._id, structuredClone(external));
  const migration = makeMigration(); t.after(() => migration.stop());
  await migration.start();
  assert.equal(migration.phase, 'NOT_NEEDED');
  assert.equal(migration.allowsStartup(), true);
  assert.equal(h.owner.config.eosUi.siteName, 'existing-eos');
  assert.deepEqual(h.owner.config.eosUi.tariffProvider, snapshot.patch.tariffProvider);
  const runtime = freshRuntime(h); await hydrate(runtime); assertRetained(h, runtime, snapshot);
  assert.deepEqual(h.objects.get(external._id), external);
});

test('unreadable or corrupt existing provider storage never becomes fresh defaults or an older backup', async t => {
  const h = await createHarness(); t.after(() => h.close());
  const snapshot = seed(h, h.owner.namespace, historical.providers[0]);
  const runtime = freshRuntime(h); await hydrate(runtime);
  const before = structuredClone(runtime.config.tariffProvider);
  let backupReads = 0;
  runtime.nwReadUserdataBackup = async () => { backupReads++; return { instance: 0, configPatch: {} }; };
  h.states.set(snapshot.id, { val: '{invalid', ack: true });
  await assert.rejects(runtime.loadInstallerConfigFromState(), { message: 'EOS_UI_CONFIG_INVALID' });
  assert.deepEqual(runtime.config.tariffProvider, before);
  assert.equal(h.states.get(snapshot.id).val, '{invalid');
  runtime.getStateAsync = async () => { throw new Error('fixture unavailable'); };
  await assert.rejects(runtime.loadInstallerConfigFromState(), { message: 'EOS_UI_CONFIG_LOAD_FAILED' });
  assert.deepEqual(runtime.config.tariffProvider, before);
  assert.equal(backupReads, 0);
});
