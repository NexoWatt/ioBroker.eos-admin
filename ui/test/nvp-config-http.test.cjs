'use strict';
/** Prüft den ausgelieferten Express-/Rollenpfad mit simuliertem ioBroker, ohne reale Geräte. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('./unified/http-harness.cjs');

function topology(version = 1) {
  const measure = (stateId) => ({ stateId, unit: 'W', sign: 1, maxAgeMs: 3000 });
  return { schemaVersion: 1, configVersion: version, mode: 'dynamic', operation: 'diagnostic', rootPointId: 'M0', maxSkewMs: 1000,
    points: [
      { id: 'M0', name: 'Gesamtanschluss', parentId: null, measurement: measure('fixture.nvp.root'), importLimitW: 250000, exportLimitW: 250000, importReserveW: 25000, exportReserveW: 25000 },
      { id: 'M1', name: 'Hausbereich', parentId: 'M0', measurement: measure('fixture.nvp.local'), importLimitW: 100000, exportLimitW: 0, importReserveW: 10000, exportReserveW: 0 },
    ], storages: [], pvAssignments: [] };
}

test('NVP HTTP: Rollen, atomare Speicherung, Import, Aktivierungssperre und öffentliche Diagnosefilter', async () => {
  const h = await createHarness();
  try {
    const sourceRead = h.adapter.getForeignObjectAsync.bind(h.adapter);
    const configObjects = new Map();
    h.adapter.getForeignObjectAsync = async (id) => ['fixture.nvp.root', 'fixture.nvp.local'].includes(id)
      ? { type: 'state', common: { read: true } }
      : (id === `${h.adapter.namespace}.installer.configJson` ? configObjects.get(id) || null : sourceRead(id));
    h.adapter.setForeignObjectAsync = async (id, object) => { configObjects.set(id, object); };
    h.adapter.extendForeignObjectAsync = async (id, patch) => {
      const current = configObjects.get(id) || {}; configObjects.set(id, { ...current, ...patch, common: { ...current.common, ...patch.common } });
    };
    // Den tatsächlichen zentralen Persistenzschutz statt der alten Teststub verwenden.
    h.adapter.persistInstallerConfigToState = Object.getPrototypeOf(h.adapter).persistInstallerConfigToState.bind(h.adapter);
    h.adapter.nwWriteUserdataBackup = async () => {};
    h.adapter.config.storage = { selfTargetGridImportW: 50, datapoints: { batteryPowerObjectId: 'fixture.ess.actual' } };
    const storageBefore = JSON.stringify(h.adapter.config.storage);
    let hardwareWrites = 0;
    h.adapter.setForeignStateAsync = async () => { hardwareWrites += 1; };
    const customer = await h.login('kunde'); const installer = await h.login('installer');
    for (const url of ['/api/nvp/topology', '/api/nvp/status']) {
      assert.equal((await h.request(url)).status, 401);
      assert.equal((await h.request(url, { token: customer })).status, 403);
      assert.equal((await h.request(url, { token: installer })).status, 200);
    }
    for (const url of ['/api/nvp/topology/config', '/api/nvp/topology/diagnose']) {
      const body = { config: topology(), expectedConfigVersion: 1 };
      assert.equal((await h.request(url, { method: 'POST', body })).status, 401);
      assert.equal((await h.request(url, { token: customer, method: 'POST', body })).status, 403);
    }
    const read = await h.request('/api/nvp/topology', { token: installer });
    assert.equal(read.data.config.mode, 'static'); assert.equal(read.data.activationSupported, false);
    assert.equal(read.response.headers.get('cache-control'), 'no-store');
    const preview = await h.request('/api/nvp/topology/diagnose', { token: installer, method: 'POST', body: { config: topology() } });
    assert.equal(preview.status, 200); assert.equal(preview.data.validation.valid, true);
    assert.equal(h.adapter.config.nvpTopology, undefined);
    h.adapter._nwNvpTopologyStatus = { configVersion: 1, mode: 'static', operation: 'diagnostic', status: 'static', timestamp: 12345,
      measurements: { stale: 'old-measurement' }, budget: { stale: 'old-budget' } };
    const saved = await h.request('/api/nvp/topology/config', { token: installer, method: 'POST', body: { config: topology(), expectedConfigVersion: 1 } });
    assert.equal(saved.status, 200, saved.text); assert.equal(saved.data.config.configVersion, 2);
    assert.equal(saved.data.status.configVersion, 2); assert.equal(saved.data.status.status, 'pending');
    assert.equal(saved.data.status.timestamp, null); assert.equal(saved.data.status.measurements, null); assert.equal(saved.data.status.budget, null);
    for (const url of ['/api/nvp/topology', '/api/nvp/status']) {
      const pending = await h.request(url, { token: installer });
      assert.equal(pending.data.status.configVersion, 2); assert.equal(pending.data.status.status, 'pending');
      assert.ok(!pending.text.includes('old-measurement')); assert.ok(!pending.text.includes('old-budget'));
    }
    h.adapter._nwNvpTopologyStatus = { configVersion: 2, mode: 'dynamic', operation: 'diagnostic', status: 'diagnostic', timestamp: 23456, measurements: { confirmed: true } };
    const fresh = await h.request('/api/nvp/status', { token: installer });
    assert.equal(fresh.data.status.timestamp, 23456); assert.equal(fresh.data.status.measurements.confirmed, true);
    assert.equal(JSON.stringify(h.adapter.config.storage), storageBefore); assert.equal(hardwareWrites, 0);
    const stale = await h.request('/api/nvp/topology/config', { token: installer, method: 'POST', body: { config: topology(), expectedConfigVersion: 1 } });
    assert.equal(stale.status, 409); assert.equal(h.adapter.config.nvpTopology.configVersion, 2);
    const active = topology(2); active.operation = 'active';
    active.points.forEach((point) => { point.failurePolicyId = 'fixture-policy'; point.measurement.physicalSourceId = point.id; });
    for (const url of ['/api/installer/config', '/api/installer/backup/import']) {
      const result = await h.request(url, { token: installer, method: 'POST', body: { patch: { nvpTopology: active }, expectedNvpConfigVersion: 2, restartEms: false } });
      assert.equal(result.status, 422, result.text);
      assert.ok(result.data.details.some((issue) => issue.code === 'RUNTIME_SCOPED_DISPATCH_NOT_IMPLEMENTED'));
      assert.equal(h.adapter.config.nvpTopology.operation, 'diagnostic');
    }
    const incomplete = await h.request('/api/installer/config', { token: installer, method: 'POST', body: {
      patch: { nvpTopology: { mode: 'dynamic', configVersion: 2 } }, expectedNvpConfigVersion: 2, restartEms: false,
    } });
    assert.equal(incomplete.status, 422, 'Unvollständige neue Topologie darf nicht mit alten Messpunkten ergänzt werden.');
    const oldWrite = h.adapter.setStateAsync.bind(h.adapter);
    h.adapter.setStateAsync = async (id, ...args) => { if (id === 'installer.configJson') throw new Error('simulated database failure'); return oldWrite(id, ...args); };
    const changed = topology(2); changed.points[0].exportLimitW = 200000;
    const failedSave = await h.request('/api/nvp/topology/config', { token: installer, method: 'POST', body: { config: changed, expectedConfigVersion: 2 } });
    assert.equal(failedSave.status, 500); assert.equal(h.adapter.config.nvpTopology.configVersion, 2);
    assert.equal(h.adapter.config.nvpTopology.points[0].exportLimitW, 250000);
    h.adapter.setStateAsync = oldWrite;
    h.adapter.stateCache['nvpTopology.statusJson'] = { value: JSON.stringify({ mapping: 'fixture.private.mapping' }), ts: Date.now() };
    const publicState = await h.request('/api/state');
    assert.ok(!publicState.text.includes('fixture.private.mapping'));
    assert.equal(hardwareWrites, 0);
    const admin = await h.login('admin');
    assert.equal((await h.request('/api/nvp/topology', { token: admin })).status, 200);
  } finally { await h.close(); }
});

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

/** Die Barrier liegt im tatsächlichen DB-Schreibpfad nach der NVP-Validierung.
 * Damit bildet der Test gerade das gefährliche Zeitfenster zwischen erfolgreicher
 * Prüfung eines alten Gesamtpatches und dessen verspätetem Persistieren ab. */
test('NVP HTTP: alle Gesamtpatch-Writer schließen parallele veraltete Speicherungen aus', { timeout: 30000 }, async () => {
  const h = await createHarness();
  let releasePending = () => {};
  try {
    const sourceRead = h.adapter.getForeignObjectAsync.bind(h.adapter);
    const configObjects = new Map();
    h.adapter.getForeignObjectAsync = async (id) => ['fixture.nvp.root', 'fixture.nvp.local'].includes(id)
      ? { type: 'state', common: { read: true } }
      : (id === `${h.adapter.namespace}.installer.configJson` ? configObjects.get(id) || null : sourceRead(id));
    h.adapter.setForeignObjectAsync = async (id, object) => { configObjects.set(id, object); };
    h.adapter.extendForeignObjectAsync = async (id, patch) => {
      const current = configObjects.get(id) || {};
      configObjects.set(id, { ...current, ...patch, common: { ...current.common, ...patch.common } });
    };
    h.adapter.persistInstallerConfigToState = Object.getPrototypeOf(h.adapter).persistInstallerConfigToState.bind(h.adapter);
    h.adapter.nwWriteUserdataBackup = async () => {};
    // Runtime-/Geräteübergänge sind isolierte Fixtures; Konfigurationsvalidierung,
    // Express-Routen, Gesamtpatch-Erzeugung und Persistenz bleiben produktiv.
    for (const name of ['syncInstallerConfigToStates', 'syncSettingsToStates', 'syncSettingsConfigToStates',
      'ensureEvcsStates', 'ensureRfidStates', 'subscribeEvcsMappedStates', 'subscribeConfiguredStates', 'initEmsEngine']) {
      h.adapter[name] = async () => {};
    }
    h.adapter.replaceLogicEngine = async () => {};
    h.adapter.nwSimListInstances = async () => [{ id: 'fixture.sim.0' }];
    h.adapter.nwSimSetInstanceEnabled = async () => {};
    h.adapter.nwSimWaitAlive = async () => {};
    h.adapter.nwSimBuildPatch = async () => ({ patch: {}, meta: { storageMaxChKw: 0, storageMaxDisKw: 0 } });
    h.adapter.nwSimWriteStatus = async (values) => {
      for (const [key, value] of Object.entries(values)) await h.adapter.setStateAsync(`simulation.${key}`, { val: value, ack: true });
      return true;
    };
    const initial = topology();
    h.adapter.config.nvpTopology = initial;
    h.adapter._nwInstallerConfigPatch = { nvpTopology: initial };
    const installer = await h.login('installer');
    const databaseWrite = h.adapter.setStateAsync.bind(h.adapter);
    const writers = [
      { name: 'SmartHome', url: '/api/smarthome/config', body: { config: h.adapter.config.smartHomeConfig } },
      { name: 'Logic', url: '/api/logic/editor', body: { config: { version: 1, graphs: [] } } },
      { name: 'Simulation aktivieren', url: '/api/sim/enable', body: { instanceId: 'fixture.sim.0' } },
      { name: 'Simulation zurücksetzen', url: '/api/sim/disable', body: {} },
    ];
    const post = (url, body) => h.request(url, { token: installer, method: 'POST', body });
    const holdNextConfigWrite = () => {
      const entered = deferred(); const released = deferred(); let pending = true;
      releasePending = released.resolve;
      h.adapter.setStateAsync = async (id, ...args) => {
        if (id === 'installer.configJson' && pending) {
          pending = false; entered.resolve(); await released.promise;
        }
        return databaseWrite(id, ...args);
      };
      return { entered: entered.promise, release: released.resolve };
    };
    const waitUntilPersisting = async (barrier, request) => {
      let timer;
      try {
        await Promise.race([barrier.entered, request.then((result) => { throw new Error(`Writer erreichte DB-Barriere nicht: ${result.status} ${result.text}`); }),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('DB-Barriere wurde nicht erreicht.')), 5000); })]);
      } finally { clearTimeout(timer); }
    };
    const assertPersistedVersion = async (version) => {
      const stored = JSON.parse((await h.adapter.getStateAsync('installer.configJson')).val);
      assert.equal(stored.nvpTopology.configVersion, version);
      assert.equal(h.adapter.config.nvpTopology.configVersion, version);
      assert.equal(h.adapter._nwInstallerConfigPatch.nvpTopology.configVersion, version);
      assert.equal(stored.patch, undefined, 'Normalisierungswrapper darf nicht statt des Gesamtpatches gespeichert werden.');
    };

    for (const writer of writers) {
      const version = h.adapter.config.nvpTopology.configVersion;
      if (writer.url === '/api/sim/enable') await databaseWrite('simulation.backupConfigJson', { val: null, ack: true });
      if (writer.url === '/api/sim/disable') await databaseWrite('simulation.backupConfigJson', { val: JSON.stringify(h.adapter._nwInstallerConfigPatch), ack: true });
      const barrier = holdNextConfigWrite();
      const saving = post(writer.url, writer.body);
      await waitUntilPersisting(barrier, saving);
      const concurrentNvp = await post('/api/nvp/topology/config', { config: topology(version), expectedConfigVersion: version });
      assert.equal(concurrentNvp.status, 409, `${writer.name}: paralleler NVP-Save muss während Persistenz gesperrt sein.`);
      barrier.release();
      const saved = await saving;
      assert.equal(saved.status, 200, `${writer.name}: ${saved.text}`);
      await assertPersistedVersion(version);
      const next = await post('/api/nvp/topology/config', { config: topology(version), expectedConfigVersion: version });
      assert.equal(next.status, 200, next.text);
      await assertPersistedVersion(version + 1);
    }

    // Umgekehrte Reihenfolge: Während eines bestätigten NVP-Saves dürfen weder
    // die anderen vier Writer noch Installer-Save/Import ihren Snapshot beginnen.
    const version = h.adapter.config.nvpTopology.configVersion;
    const barrier = holdNextConfigWrite();
    const nvpSave = post('/api/nvp/topology/config', { config: topology(version), expectedConfigVersion: version });
    await waitUntilPersisting(barrier, nvpSave);
    const competing = [...writers,
      { name: 'Installer', url: '/api/installer/config', body: { patch: {}, restartEms: false } },
      { name: 'Import', url: '/api/installer/backup/import', body: { patch: {}, restartEms: false } },
    ];
    const responses = await Promise.all(competing.map((writer) => post(writer.url, writer.body)));
    responses.forEach((response, index) => assert.equal(response.status, 409, `${competing[index].name}: ${response.text}`));
    barrier.release();
    assert.equal((await nvpSave).status, 200);
    await assertPersistedVersion(version + 1);
    assert.equal(h.adapter._nwMeshAppSaveInProgress, false, 'Gemeinsame Sperre wird nach Abschluss freigegeben.');
  } finally { releasePending(); await h.close(); }
});
