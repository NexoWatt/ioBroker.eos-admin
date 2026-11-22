/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/* Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Nutzung, Änderung und Weitergabe nur mit ausdrücklicher Erlaubnis. */
'use strict';
/** Prüft die echten Admin-Mesh-Verträge gegen Backend-Defaults, Protokollstatus,
 * Paarungen und aus echten Journalfunktionen erzeugte Datensätze/Abrechnungen.
 * Temporäre synthetische Zählerwerte ersetzen ausschließlich die Feldgeräte. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const C = require('../lib/mesh-coordinator-contract');
const { MeshCoordinator } = require('../lib/mesh-coordinator');
const { defaults } = require('../lib/mesh-energy-service');
const filename = path.resolve(__dirname, '../src-admin-tab/src/lib/mesh-types.ts');
const source = fs.readFileSync(filename, 'utf8');
const compiled = ts.transpileModule(source, { fileName: filename, reportDiagnostics: true,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, strict: true } });
assert.deepEqual((compiled.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error), []);
const moduleRecord = { exports: {} };
// Das echte Modul und die vom HTTP-JSON-Transport kommenden Fixtureobjekte teilen
// einen Realm, wie im Browser. Keine nachgebauten oder übersprungenen Decoder.
vm.runInThisContext('(function(module, exports) {\n' + compiled.outputText + '\n})', { filename })(moduleRecord, moduleRecord.exports);
const api = moduleRecord.exports;
const wire = value => JSON.parse(JSON.stringify(value));
function includesFields(actual, expected) {
  if (expected === null || typeof expected !== 'object') { assert.equal(actual, expected); return; }
  for (const key of Object.keys(expected)) includesFields(actual[key], expected[key]);
}
const network = { importW: 10000, exportW: 10000, l1A: 32, l2A: 32, l3A: 32 };
const sample = () => ({ quality: 'ok', ageMs: 0, gridW: 0, phaseA: [0, 0, 0], devicesHealthy: true, controlledW: { ...C.ZERO } });
let checks = 0;
async function check(name, run) { await run(); checks++; console.log('PASS', name); }

(async () => {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'nw-admin-mesh-boundaries-'));
  let clock = Date.parse('2026-01-01T00:00:00.000Z');
  let importKwh = 100;
  let exportKwh = 20;
  const adapter = { namespace: 'synthetic.0', config: { emsApps: { apps: { meshMicrogrid: { installed: true, enabled: true } } } },
    _nwHasCentralLicenseGrant: () => true, // Explicit trusted test authority; no product fallback.
    getForeignStateAsync: async id => ({ val: id === 'synthetic.buy' ? importKwh : exportKwh, ts: clock, q: 0 }) };
  const coordinator = new MeshCoordinator(adapter, { directory, systemSecret: crypto.randomBytes(32).toString('hex'), sample, siteSample: sample });
  try {
    await coordinator.init();
    await check('Backend-Defaults und leerer OFF-Status werden vollständig gelesen', () => {
      const response = wire({ ...coordinator.publicConfig(), status: coordinator.status() });
      const parsed = api.parseMeshResponse(response);
      includesFields(parsed.config, C.defaultConfig());
      assert.equal(parsed.status.master, null);
      assert.equal(parsed.status.local.state, 'OFF');
      assert.equal(parsed.status.accounting.pending, 0);
      assert.equal(parsed.status.accounting.lastSync, null);
      assert.equal(Object.getPrototypeOf(parsed.config), null);
      includesFields(api.parseAccountingResponse({ config: defaults() }).config, defaults());
    });
    const raw = C.defaultConfig();
    Object.assign(raw, { role: 'master', mode: 'diagnostic', siteId: 'synthetic_site', nodeId: 'master', masterId: 'master', localParticipates: true });
    raw.local = { ...raw.local, id: 'master', name: 'Masterhaus', commissioned: true, watchdogVerified: true };
    raw.nodes = [{ ...raw.local, id: 'house_1', name: 'Haus 1', max: { ...C.ZERO, ...network } }];
    raw.site.limit = network;
    raw.siteFeedback = { gridW: 'synthetic.grid', l1A: 'synthetic.l1', l2A: 'synthetic.l2', l3A: 'synthetic.l3' };
    coordinator.config = C.validateConfig(raw);
    coordinator.resetProtocols();
    await check('Diagnose und aktiver Master erhalten Teilnehmer, Nullgrenzen und Timing', () => {
      for (const mode of ['diagnostic', 'active']) {
        coordinator.config = C.validateConfig({ ...coordinator.config, mode });
        coordinator.resetProtocols();
        coordinator.master.plan(sample());
        const response = wire({ ...coordinator.publicConfig(), status: coordinator.status() });
        const parsed = api.parseMeshResponse(response);
        includesFields(parsed.config, coordinator.config);
        assert.equal(parsed.config.mode, mode);
        assert.equal(parsed.status.master.nodes.length, 2);
        assert.equal(parsed.status.master.nodes.find(node => node.id === 'house_1').allowed.evW, 0);
        assert.equal(parsed.status.timing.lastRttMs, null);
      }
      coordinator.config = C.validateConfig({ ...coordinator.config, mode: 'diagnostic' });
      coordinator.resetProtocols();
    });
    await check('Persistierte Betriebslimits ohne Strategie erfinden keinen fixed-Modus', () => {
      coordinator.config = C.validateConfig({ ...coordinator.config, allocation: { ...coordinator.config.allocation, strategy: 'transformer' } });
      coordinator.operatorLimits = { importW: 5000, exportW: 5000 };
      coordinator.resetProtocols();
      const parsed = api.parseMeshResponse(wire({ ...coordinator.publicConfig(), status: coordinator.status() }));
      assert.equal(parsed.config.allocation.strategy, 'transformer');
      assert.equal(parsed.status.master.operatorLimits.strategy, undefined);
      assert.equal(parsed.status.master.operatorLimits.strategy || parsed.config.allocation.strategy, 'transformer');
      assert.equal(api.parseOperating({ importW: 5000, exportW: 5000, strategy: 'fixed' }).strategy, 'fixed');
    });
    await check('Echte Master-Paarung und JSON-Import bewahren den Slavevertrag', async () => {
      const bundle = wire(await coordinator.pair('house_1'));
      const parsed = api.parsePairBundle(bundle);
      includesFields(parsed.config, bundle.config);
      assert.equal(parsed.config.role, 'slave');
      assert.equal(parsed.pairingKey, bundle.pairingKey);
      assert.equal(api.parsePairImport(JSON.stringify(bundle)).config.nodeId, 'house_1');
      for (const invalid of [{ ...bundle, pairingKey: 'invalid' }, { ...bundle, config: { ...bundle.config, role: 'master' } }, { ...bundle, config: { ...bundle.config, revision: '1' } }, { ...bundle, config: { ...bundle.config, local: null } }]) assert.throws(() => api.parsePairBundle(invalid));
      assert.throws(() => api.parsePairImport('{ invalid'));
    });
    coordinator.accounting = { ...defaults(), enabled: true, operatorName: 'Synthetischer Testbetrieb',
      meter: { ...defaults().meter, id: 'meter_1', epoch: 'first', importDp: 'synthetic.buy', exportDp: 'synthetic.sell', calibrated: true, calibrationUntil: '2030-12-31' },
      tariff: { importEuroKwh: 0.3, exportEuroKwh: 0.08, periodFeeEuro: 2 } };
    const records = [];
    await check('Echte Zählererfassung und Archivexport behalten Hashes und beide Quellenzeiten', async () => {
      const originalNow = Date.now;
      try {
        Date.now = () => clock;
        for (let index = 0; index < 3; index++) {
          records.push(wire(await coordinator.energy.capture()));
          clock += 600000; importKwh += 1; exportKwh += 0.5;
        }
      } finally { Date.now = originalNow; }
      const parsed = api.parseRecords({ lastSequence: records.length, records });
      assert.deepEqual(wire(parsed.records), records);
      assert.equal(parsed.records[0].sourceAt.length, 2);
      assert.equal(typeof parsed.records[0].sourceAt[0], 'number');
      assert.equal(typeof parsed.records[0].hash, 'string');
      assert.equal(parsed.records[0].meter.calibrated, true);
      coordinator.energy.lastSync = records[2].at;
      const snapshot = api.parseMeshResponse(wire({ ...coordinator.publicConfig(), status: coordinator.status() }));
      assert.equal(snapshot.status.accounting.lastSync, records[2].at);
      assert.equal(snapshot.status.accounting.local.sequence, 3);
      assert.throws(() => api.parseRecords({ lastSequence: 1, records: [{ ...records[0], sourceAt: [false, clock] }] }));
    });
    await check('Echte BLOCKED-, PARTIAL_PERIOD- und DRAFT-Abrechnungen sind unverändert darstellbar', async () => {
      const base = { nodeId: 'master', from: records[0].at, to: records[2].at };
      const draft = wire(await coordinator.energy.report(base));
      const parsed = api.parseReport(draft);
      assert.equal(parsed.status, 'DRAFT');
      assert.equal(parsed.amounts.balanceCents, 252);
      assert.deepEqual(wire(parsed), draft, 'JSON-Prüfbeleg behält Originalfelder');
      const partial = api.parseReport(wire(await coordinator.energy.report({ ...base, from: '2025-12-31T23:59:00.000Z' })));
      assert.equal(partial.status, 'PARTIAL_PERIOD');
      assert.equal(partial.periodFeePending, true);
      assert.equal(partial.amounts.periodFeeCents, 0);
      const blocked = api.parseReport(wire(await coordinator.energy.report({ ...base, from: '2025-12-30T00:00:00.000Z', to: '2025-12-31T00:00:00.000Z' })));
      assert.equal(blocked.status, 'BLOCKED');
      assert.equal(blocked.amounts, null);
      assert.equal(blocked.usable, false);
      assert.throws(() => api.parseReport({ ...draft, amounts: null }));
    });
    await check('Manipulierte JSON-Strukturen und falsche Zahlen erreichen keine Mesh-Formulare', () => {
      const original = wire({ ...coordinator.publicConfig(), status: coordinator.status() });
      for (const key of ['__proto__', 'prototype', 'constructor']) {
        const bad = wire(original);
        Object.defineProperty(bad.config, key, { value: { polluted: true }, enumerable: true });
        assert.throws(() => api.parseMeshResponse(bad));
      }
      const deep = wire(original); let cursor = deep;
      for (let index = 0; index < 30; index++) { cursor.extra = {}; cursor = cursor.extra; }
      assert.throws(() => api.parseMeshResponse(deep));
      assert.throws(() => api.parseMeshResponse({ ...original, config: { ...original.config, intervalMs: '1000' } }));
      assert.throws(() => api.parseAccountingResponse({ config: { ...defaults(), tariff: { ...defaults().tariff, importEuroKwh: true } } }));
      assert.equal({}.polluted, undefined);
    });
  } finally {
    coordinator.stop();
    await fsp.rm(directory, { recursive: true, force: true });
  }
  console.log(JSON.stringify({ result: 'PASS', checks, node: process.version,
    sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
    limitation: 'Echte Backend-/Journalfunktionen mit temporären synthetischen Zählerwerten; keine Feldgeräte oder Liveanlage.' }));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
