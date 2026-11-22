#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft den echten Adapterkern mit isoliertem ioBroker-I/O gegen Partner-Lifecycle- und Versionsfehler.
 * Daten und Wirkung: Lokale Testkonfigurationen; kein Serverstart, kein Fremdnetz und keine Geräteansteuerung.
 * Bei Änderungen: Appnormalisierung, Mutation-Lock und zentrale Persistenzgrenze gemeinsam nachweisen.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { defaultPartnerConfig } = require('../lib/partner-contracts');
const filename = path.join(__dirname, 'verify-storage-farm-dispatch-recovery.js');
const fixture = new Module(filename, module);
fixture.filename = filename;
fixture.paths = Module._nodeModulePaths(__dirname);
const source = fs.readFileSync(filename, 'utf8');
const originalLoad = Module._load;
let factory;
try {
  fixture._compile(source.slice(0, source.indexOf('(async () => {')) + '\nmodule.exports = {};', filename);
  factory = require('../main');
} finally { Module._load = originalLoad; }

(async () => {
  const adapter = factory({});
  adapter._nwLicenseOk = true;
  adapter._nwLicenseInfo = { ok: true, edition: 'hems', type: 'full' };
  adapter.config = { partnerIntegrations: defaultPartnerConfig(), emsApps: { apps: { arbitrage: { installed: true, enabled: true } } } };
  const normalized = adapter.nwApplyEmsAppsToLegacyFlags(structuredClone(adapter.config));
  assert.equal(normalized.enableArbitrage, true, 'Household license permits independent arbitrage');
  assert.equal(normalized.enableDynamicGrid, false, 'No implicit dynamic-grid dependency');
  assert.equal(adapter._nwPartnerAppActive('arbitrage'), true);
  assert.equal(adapter._nwPartnerAppActive('energyLedger'), false, 'Arbitrage never grants balance access');
  adapter.config.emsApps.apps.grid = { installed: true, enabled: true };
  assert.equal(adapter._nwPartnerAppActive('directMarketing'), true, 'Direct marketing belongs to existing grid/PV app');
  adapter._nwLicenseOk = false;
  assert.equal(adapter._nwPartnerAppActive('arbitrage'), false);
  adapter._nwLicenseOk = true;
  let stopped = 0; let refreshed = 0;
  adapter._partnerRuntime = { stop() { stopped++; }, async refresh() { refreshed++; } };
  const token = adapter._nwBeginInstallerConfigMutation();
  assert.ok(token); assert.equal(stopped, 1);
  assert.equal(adapter._nwPartnerAppActive('arbitrage'), false, 'Mutation immediately denies old grants');
  assert.equal(adapter._nwBeginInstallerConfigMutation(), null);
  adapter._nwEndInstallerConfigMutation({});
  assert.equal(refreshed, 0, 'Foreign token cannot release mutation');
  adapter._nwEndInstallerConfigMutation(token);
  assert.equal(refreshed, 1);
  assert.equal(adapter._nwPartnerAppActive('arbitrage'), true);
  const changed = defaultPartnerConfig(); changed.configVersion = 2; changed.arbitrage.maxCommandSeconds = 30;
  await assert.rejects(adapter.persistInstallerConfigToState({ partnerIntegrations: changed }), /Partnerfreigaben/, 'Generic persistence cannot change grants');
  const bad = defaultPartnerConfig(); bad.configVersion = 9;
  adapter._nwPartnerCommitInFlight = true;
  await assert.rejects(adapter.persistInstallerConfigToState({ partnerIntegrations: bad }), /zwischenzeitlich/, 'Dedicated commit still requires CAS');
  adapter._nwPartnerCommitInFlight = false;
  const fresh = factory({}); fresh.config = {};
  const migrated = fresh.nwApplyEmsAppsToLegacyFlags({ enableArbitrage: true });
  assert.equal(migrated.enableArbitrage, false, 'Legacy flag never auto-installs new control app');
  console.log(JSON.stringify({ result: 'PASS', checks: 16, scope: 'Actual adapter methods with isolated ioBroker I/O; no hardware or network' }));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
