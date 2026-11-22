'use strict';
/** Tatsächliche ausgelieferte Express-/Installerpfade; keine reale Gerätekommunikation. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('./unified/http-harness.cjs');
const measure = (stateId) => ({ stateId, unit: 'W', sign: 1, maxAgeMs: 5000 });
function config(version = 1) {
  return { schemaVersion: 1, configVersion: version, maxSkewMs: 1000, points: [
    { id: 'M0', source: 'general', importLimitW: 250000, exportLimitW: 250000, importReserveW: 25000, exportReserveW: 25000 },
    { id: 'M1', source: 'mapped', measurement: measure('fixture.local'), importLimitW: 100000, exportLimitW: 0, importReserveW: 0, exportReserveW: 0 },
  ], storages: [{ id: 'free-storage', name: 'Herstellerfreie Zuordnung', connectionPointId: 'M1', controlPointId: 'M1', dispatchGroupId: 'house', primaryPurpose: 'selfConsumption', authority: 'eos',
    powerMeasurement: measure('fixture.actual'), socMeasurement: { stateId: 'fixture.soc', scale: 1, maxAgeMs: 5000 },
    maxChargeW: 20000, maxDischargeW: 20000, minSoc: 10, maxSoc: 90, maxDeltaWPerSec: 1000,
    strategy: { targetGridImportW: 50, importThresholdW: 20 }, command: { mode: 'signedTarget', signedTarget: { stateId: 'fixture.target', scale: 1, sign: 1 } },
    configuredToleranceW: 100, commandTimeoutMs: 5000 }], pvAssignments: [] };
}
async function harness() {
  const h = await createHarness(); const a = h.adapter;
  const originalRead = a.getForeignObjectAsync.bind(a); const configObjects = new Map();
  a.getForeignObjectAsync = async (id) => {
    if (['fixture.root', 'fixture.changedRoot', 'fixture.local', 'fixture.actual', 'fixture.soc', 'fixture.target'].includes(id)) return { type: 'state', common: { type: 'number', unit: id === 'fixture.soc' ? '%' : 'W', read: true, write: id === 'fixture.target' } };
    if (id === `${a.namespace}.installer.configJson`) return configObjects.get(id) || null;
    return originalRead(id);
  };
  a.setForeignObjectAsync = async (id, value) => { configObjects.set(id, value); };
  a.extendForeignObjectAsync = async (id, value) => { const old = configObjects.get(id) || {}; configObjects.set(id, { ...old, ...value, common: { ...old.common, ...value.common } }); };
  a.persistInstallerConfigToState = Object.getPrototypeOf(a).persistInstallerConfigToState.bind(a);
  a.config.datapoints = { gridPointPower: 'fixture.root' };
  a.nwWriteUserdataBackup = async () => {};
  a._nwPrepareDynamicGridTransition = async () => ({ ok: true });
  a._nwCommitDynamicGridConfig = () => {};
  a._nwCancelDynamicGridTransition = () => {};
  a._nwInitLicense = async () => {};
  a._nwRefreshLicenseFromConfiguredKey = async () => {};
  for (const key of ['syncInstallerConfigToStates', 'syncSettingsToStates', 'syncSettingsConfigToStates', 'ensureEvcsStates', 'ensureRfidStates', 'subscribeEvcsMappedStates', 'subscribeConfiguredStates', 'ensureHistorieExportStates', 'updateHistorieExportStates', 'startHistorieExportTimer']) a[key] = async () => {};
  return h;
}

test('DynamicGrid HTTP: globaler AppCenter-Save installiert fehlende und ältere Entwürfe mit gelesenem CAS-Token', { timeout: 20000 }, async () => {
  const legacy = config(); delete legacy.configVersion;
  for (const initial of [undefined, {}, legacy]) {
    const h = await harness();
    try {
      const a = h.adapter, token = await h.login('installer');
      if (initial !== undefined) {
        a.config.dynamicGridConnection = structuredClone(initial);
        a._nwInstallerConfigPatch = { dynamicGridConnection: structuredClone(initial) };
      }
      const post = (body) => h.request('/api/installer/config', { token, method: 'POST', body });
      const before = JSON.stringify(a.config), beforePatch = JSON.stringify(a._nwInstallerConfigPatch);
      const loaded = await h.request('/api/installer/config', { token });
      assert.equal(loaded.status, 200, loaded.text);
      assert.equal(loaded.data.config.dynamicGridConnection.configVersion, 1);
      assert.equal(JSON.stringify(a.config), before, 'Laden erzeugt keinen Runtime-Vertrag.');
      assert.equal(JSON.stringify(a._nwInstallerConfigPatch), beforePatch, 'Laden migriert keinen gespeicherten Entwurf.');
      const direct = await h.request('/api/dynamic-grid', { token });
      assert.equal(direct.data.config.configVersion, 1, 'Beide Installer-APIs liefern denselben Ausgangstoken.');
      // Der tatsächliche globale Editor sendet App-Schalter und Allgemein-Werte,
      // aber keine Kopie des im separaten Editor bearbeiteten Topologievertrags.
      const patch = { emsApps: structuredClone(loaded.data.config.emsApps), datapoints: loaded.data.config.datapoints, settings: loaded.data.config.settings };
      patch.emsApps.apps.dynamicGrid = { installed: true, enabled: false };
      assert.equal((await post({ patch, restartEms: false })).status, 409, 'Fehlender CAS wird nicht durch die aktuelle Serverversion ersetzt.');
      const saved = await post({ patch, expectedDynamicGridConfigVersion: loaded.data.config.dynamicGridConnection.configVersion, restartEms: false });
      assert.equal(saved.status, 200, saved.text);
      assert.equal(saved.data.config.dynamicGridConnection.configVersion, 2);
      assert.equal(a.config.emsApps.apps.dynamicGrid.installed, true);
      assert.equal(a.config.emsApps.apps.dynamicGrid.enabled, false, 'Erstinstallation aktiviert keinen unvollständigen Vertrag.');
      assert.equal(a.config.dynamicGridConnection.configVersion, 2);
      const stored = JSON.parse((await a.getStateAsync('installer.configJson')).val);
      assert.equal(stored.dynamicGridConnection.configVersion, 2);
      assert.equal(stored.emsApps.apps.dynamicGrid.enabled, false);

      // Eine weitere bestehende App kann mit dem neu geladenen Gesamtstand
      // geändert werden; der unveränderte dynamische Vertrag erhält keine neue Version.
      const apps = structuredClone(saved.data.config.emsApps);
      apps.apps.relay = { installed: true, enabled: true };
      const otherApp = await post({ patch: { emsApps: apps }, expectedDynamicGridConfigVersion: 2, restartEms: false });
      assert.equal(otherApp.status, 200, otherApp.text);
      assert.equal(a.config.dynamicGridConnection.configVersion, 2);
      assert.equal(a.config.emsApps.apps.relay.enabled, true);

      // Ein zwischenzeitlicher Save im eigenen App-Editor macht den alten
      // Parent-Token veraltet. Der Parent darf ihn nicht automatisch nachladen.
      const childSaved = await h.request('/api/dynamic-grid/config', { token, method: 'POST', body: { config: config(2), expectedConfigVersion: 2 } });
      assert.equal(childSaved.status, 200, childSaved.text);
      assert.equal(a.config.dynamicGridConnection.configVersion, 3);
      const stalePatch = { emsApps: { apps: { dynamicGrid: { installed: false, enabled: false } } } };
      const stale = await post({ patch: stalePatch, expectedDynamicGridConfigVersion: 2, restartEms: false });
      assert.equal(stale.status, 409); assert.equal(stale.data.error, 'DYNAMIC_GRID_VERSION_CONFLICT');
      assert.equal(a.config.dynamicGridConnection.configVersion, 3);
      assert.equal(a.config.emsApps.apps.dynamicGrid.installed, true);
      const fresh = await h.request('/api/installer/config', { token });
      const activation = await post({ patch: { emsApps: { apps: { dynamicGrid: { installed: true, enabled: true } } } }, expectedDynamicGridConfigVersion: fresh.data.config.dynamicGridConnection.configVersion, restartEms: false });
      assert.equal(activation.status, 200, activation.text);
      assert.equal(a.config.dynamicGridConnection.configVersion, 4);
      assert.equal(a.config.emsApps.apps.dynamicGrid.enabled, true);
      assert.equal((await post({ patch: stalePatch, expectedDynamicGridConfigVersion: 3, restartEms: false })).status, 409);
      assert.equal(a.config.emsApps.apps.dynamicGrid.enabled, true, 'Echter veralteter Lifecycle-Änderungsversuch bleibt ohne Wirkung.');
    } finally { await h.close(); }
  }
});

test('DynamicGrid HTTP: Rollen, Entwurf, atomare Aktivierung, CAS und M0 aus Allgemein', { timeout: 20000 }, async () => {
  const h = await harness();
  try {
    const a = h.adapter, installer = await h.login('installer'), customer = await h.login('kunde');
    assert.equal(a.nwNormalizeEmsApps({ emsApps: { apps: { dynamicGrid: { installed: true } } } }).apps.dynamicGrid.enabled, false, 'Installation ohne explizite Aktivierung bleibt inaktiv.');
    assert.equal(a.nwNormalizeEmsApps({ enableDynamicGrid: true }).apps.dynamicGrid.enabled, false, 'Ein Legacy-Flag ersetzt keinen App-Lifecycle.');
    const post = (url, body) => h.request(url, { token: installer, method: 'POST', body });
    for (const url of ['/api/dynamic-grid', '/api/dynamic-grid/status']) {
      assert.equal((await h.request(url)).status, 401);
      assert.equal((await h.request(url, { token: customer })).status, 403);
      assert.equal((await h.request(url, { token: installer })).status, 200);
    }
    for (const url of ['/api/dynamic-grid/config', '/api/dynamic-grid/preview']) {
      assert.equal((await h.request(url, { method: 'POST', body: { config: config(), expectedConfigVersion: 1 } })).status, 401);
      assert.equal((await h.request(url, { token: customer, method: 'POST', body: { config: config(), expectedConfigVersion: 1 } })).status, 403);
    }
    const read = await h.request('/api/dynamic-grid', { token: installer });
    assert.equal(read.data.app.active, false); assert.equal(read.data.rootSource.measurement.stateId, 'fixture.root');
    assert.equal(read.response.headers.get('cache-control'), 'no-store');
    const draft = read.data.config;
    const savedDraft = await post('/api/dynamic-grid/config', { config: draft, expectedConfigVersion: 1, app: { installed: true, enabled: false } });
    assert.equal(savedDraft.status, 200, savedDraft.text); assert.equal(savedDraft.data.config.configVersion, 2); assert.equal(savedDraft.data.locked, false);
    assert.ok(savedDraft.data.validation.activationErrors.length > 0); assert.equal(a.config.emsApps.apps.dynamicGrid.enabled, false);
    const failedActivation = await post('/api/dynamic-grid/config', { config: savedDraft.data.config, expectedConfigVersion: 2, app: { installed: true, enabled: true } });
    assert.equal(failedActivation.status, 422); assert.equal(a.config.dynamicGridConnection.configVersion, 2);
    const preview = await post('/api/dynamic-grid/preview', { config: config(2) });
    assert.equal(preview.status, 200, preview.text); assert.equal(preview.data.validation.valid, true); assert.equal(a.config.dynamicGridConnection.configVersion, 2);
    a._nwDynamicGridStatus = { active: false, configVersion: 2, snapshot: { oldValue: 1234 } };
    const activated = await post('/api/dynamic-grid/config', { config: config(2), expectedConfigVersion: 2, app: { installed: true, enabled: true } });
    assert.equal(activated.status, 200, activated.text); assert.equal(activated.data.app.active, true); assert.equal(activated.data.config.configVersion, 3);
    assert.equal(activated.data.status.status, 'pending'); assert.equal(activated.data.status.snapshot, undefined);
    assert.equal(a.config.enableDynamicGrid, true); assert.equal(a._nwGetStorageControlAuthority().selectedTopology, 'dynamic');
    assert.equal((await a.applyStorageFarmTargetW(1000)).reason, 'dynamic-grid-owns-storage');
    assert.deepEqual(a._nwDynamicGridCanonicalTargets['fixture.target'], ['fixture.target']);
    assert.equal((await post('/api/dynamic-grid/config', { config: config(2), expectedConfigVersion: 2 })).status, 409);
    const stored = JSON.parse((await a.getStateAsync('installer.configJson')).val);
    assert.equal(stored.dynamicGridConnection.configVersion, 3); assert.equal(stored.emsApps.apps.dynamicGrid.enabled, true);

    // Allgemein-Änderung ohne aktuelle App-Version darf keine laufende Topologie verändern.
    const oldGeneral = JSON.stringify(a.config.datapoints);
    const deniedGeneral = await post('/api/installer/config', { patch: { datapoints: { gridPointPower: 'fixture.changedRoot' } }, restartEms: false });
    assert.equal(deniedGeneral.status, 409, deniedGeneral.text); assert.equal(JSON.stringify(a.config.datapoints), oldGeneral);
    const changedGeneral = await post('/api/installer/config', { patch: { datapoints: { gridPointPower: 'fixture.changedRoot' } }, expectedDynamicGridConfigVersion: 3, restartEms: false });
    assert.equal(changedGeneral.status, 200, changedGeneral.text); assert.equal(a.config.dynamicGridConnection.configVersion, 4); assert.equal(a.config.datapoints.gridPointPower, 'fixture.changedRoot');
    const afterGeneral = await h.request('/api/dynamic-grid', { token: installer });
    assert.equal(afterGeneral.data.rootSource.measurement.stateId, 'fixture.changedRoot');
    const oldWrite = a.setStateAsync.bind(a); let cancelled = 0;
    a._nwCancelDynamicGridTransition = () => { cancelled++; };
    a.setStateAsync = async (id, ...args) => { if (id === 'installer.configJson') throw new Error('fixture-db-failure'); return oldWrite(id, ...args); };
    const failedPersist = await post('/api/dynamic-grid/config', { config: config(4), expectedConfigVersion: 4, app: { installed: true, enabled: false } });
    assert.equal(failedPersist.status, 500); assert.equal(a.config.dynamicGridConnection.configVersion, 4); assert.equal(a.config.emsApps.apps.dynamicGrid.enabled, true); assert.equal(cancelled, 1);
    a.setStateAsync = oldWrite;
    a._nwPrepareDynamicGridTransition = async () => ({ ok: false, reason: 'actual-not-yet-neutral' });
    const pending = await post('/api/dynamic-grid/config', { config: config(4), expectedConfigVersion: 4, app: { installed: true, enabled: false } });
    assert.equal(pending.status, 409); assert.equal(pending.data.error, 'DYNAMIC_GRID_HANDOVER_PENDING'); assert.equal(a.config.emsApps.apps.dynamicGrid.enabled, true); assert.equal(cancelled, 1);
    a._nwPrepareDynamicGridTransition = async () => ({ ok: true });
    const disabled = await post('/api/dynamic-grid/config', { config: config(4), expectedConfigVersion: 4, app: { installed: true, enabled: false } });
    assert.equal(disabled.status, 200, disabled.text); assert.equal(disabled.data.app.active, false); assert.equal(a.config.dynamicGridConnection.configVersion, 5);
    assert.equal(a._nwDynamicGridSaveInFlight, false); assert.equal(a._nwDynamicGridOwnershipPending, null);
    a.stateCache['dynamicGrid.statusJson'] = { value: 'fixture-private-dp', ts: Date.now() };
    assert.ok(!(await h.request('/api/state')).text.includes('fixture-private-dp'));
  } finally { await h.close(); }
});

test('DynamicGrid HTTP: AppCenter/Import und parallele Gesamtpatch-Writer können CAS nicht umgehen', { timeout: 20000 }, async () => {
  const h = await harness(); let release = () => {};
  try {
    const a = h.adapter, token = await h.login('installer');
    const post = (url, body) => h.request(url, { token, method: 'POST', body });
    const saved = await post('/api/dynamic-grid/config', { config: config(), expectedConfigVersion: 1, app: { installed: true, enabled: false } });
    assert.equal(saved.status, 200, saved.text);
    const enable = { emsApps: { apps: { dynamicGrid: { installed: true, enabled: true } } } };
    assert.equal((await post('/api/installer/config', { patch: enable, restartEms: false })).status, 409);
    const enabled = await post('/api/installer/config', { patch: enable, expectedDynamicGridConfigVersion: 2, restartEms: false });
    assert.equal(enabled.status, 200, enabled.text); assert.equal(a.config.dynamicGridConnection.configVersion, 3); assert.equal(a.config.emsApps.apps.dynamicGrid.enabled, true);
    const invalid = config(3); invalid.storages[0].command.signedTarget.stateId = '';
    const imported = await post('/api/installer/backup/import', { patch: { dynamicGridConnection: invalid }, expectedDynamicGridConfigVersion: 3, restartEms: false });
    assert.equal(imported.status, 422, imported.text); assert.equal(a.config.dynamicGridConnection.configVersion, 3);
    let enteredResolve; const entered = new Promise((resolve) => { enteredResolve = resolve; });
    const held = new Promise((resolve) => { release = resolve; }); const write = a.setStateAsync.bind(a); let once = true;
    a.setStateAsync = async (id, ...args) => { if (id === 'installer.configJson' && once) { once = false; enteredResolve(); await held; } return write(id, ...args); };
    const saving = post('/api/dynamic-grid/config', { config: config(3), expectedConfigVersion: 3 });
    let timer;
    try { await Promise.race([entered, saving.then((result) => { throw new Error(`Barriere nicht erreicht: ${result.status} ${result.text}`); }), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('DB-Barriere nicht erreicht')), 5000); })]); }
    finally { clearTimeout(timer); }
    assert.equal(a._nwDynamicGridSaveInFlight, true);
    for (const [url, body] of [
      ['/api/installer/config', { patch: {}, restartEms: false }],
      ['/api/installer/backup/import', { patch: {}, restartEms: false }],
      ['/api/smarthome/config', { config: a.config.smartHomeConfig }],
      ['/api/logic/editor', { config: { version: 1, graphs: [] } }],
      ['/api/sim/enable', { instanceId: 'fixture.sim' }],
      ['/api/sim/disable', {}],
      ['/api/dynamic-grid/config', { config: config(3), expectedConfigVersion: 3 }],
    ]) assert.equal((await post(url, body)).status, 409, url);
    release(); const committed = await saving;
    assert.equal(committed.status, 200, committed.text); assert.equal(a.config.dynamicGridConnection.configVersion, 4);
    assert.equal(JSON.parse((await a.getStateAsync('installer.configJson')).val).dynamicGridConnection.configVersion, 4);
    assert.equal(a._nwDynamicGridSaveInFlight, false);
  } finally { release(); await h.close(); }
});

test('DynamicGrid HTTP: Backup-Inhaltsversion ersetzt nicht den geladenen Import-CAS-Token', { timeout: 20000 }, async () => {
  const h = await harness();
  try {
    const a = h.adapter, token = await h.login('installer');
    a.config.dynamicGridConnection = config(5);
    a.config.emsApps = { schemaVersion: 1, apps: { dynamicGrid: { installed: true, enabled: false } } };
    a._nwInstallerConfigPatch = { dynamicGridConnection: config(5), emsApps: structuredClone(a.config.emsApps) };
    const loaded = await h.request('/api/installer/config', { token });
    assert.equal(loaded.data.config.dynamicGridConnection.configVersion, 5);
    const backup = config(1); backup.maxSkewMs = 750;
    const body = { patch: { dynamicGridConnection: backup }, expectedDynamicGridConfigVersion: loaded.data.config.dynamicGridConnection.configVersion, restartEms: false };
    const imported = await h.request('/api/installer/backup/import', { token, method: 'POST', body });
    assert.equal(imported.status, 200, imported.text);
    assert.equal(a.config.dynamicGridConnection.configVersion, 6);
    assert.equal(a.config.dynamicGridConnection.maxSkewMs, 750);
    assert.equal(a.config.emsApps.apps.dynamicGrid.installed, true, 'Backup ohne neue Appverwaltung entfernt die vorhandene Installation nicht.');
    assert.equal(a.config.emsApps.apps.dynamicGrid.enabled, false);
    const previous = JSON.stringify(a.config.dynamicGridConnection);
    body.patch.dynamicGridConnection.maxSkewMs = 500;
    const stale = await h.request('/api/installer/backup/import', { token, method: 'POST', body });
    assert.equal(stale.status, 409); assert.equal(stale.data.error, 'DYNAMIC_GRID_VERSION_CONFLICT');
    assert.equal(JSON.stringify(a.config.dynamicGridConnection), previous);
  } finally { await h.close(); }
});
