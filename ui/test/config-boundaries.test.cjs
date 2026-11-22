/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft unbekannte Werte an den NVP-/Dynamic-Grid-Konfigurationsgrenzen.
 * Daten und Wirkung: Native Tests mit künstlichen ioBroker-Objekten; keine Netzwerk- oder Geräteschreibzugriffe.
 * Prüft strikte Quellverträge, fehlerhafte Objekte, Aliasrichtung, stabile Gerätekennungen und sichere Fehlerantworten.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const guards = require('../lib/config-boundary-contracts');
const nvp = require('../lib/nvp-config-api');
const dynamic = require('../lib/dynamic-grid-config-api');
const { dynamicGridDefaults } = require('../ems/services/dynamic-grid-config');

function response() {
  return { code: 200, body: null, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}

test('die drei Konfigurationsquellen erlauben weder explizite unsichere Typen noch abgeschaltete Prüfungen', () => {
  const root = path.resolve(__dirname, '..');
  const parsed = ts.readConfigFile(path.join(root, 'tsconfig.config-boundaries.json'), ts.sys.readFile);
  assert.equal(parsed.error, undefined);
  const config = ts.parseJsonConfigFileContent(parsed.config, ts.sys, root);
  assert.equal(config.errors.length, 0);
  assert.equal(config.options.strict, true);
  assert.equal(config.options.noImplicitAny, true);
  assert.equal(config.options.noCheck, false);
  for (const name of ['config-boundary-contracts', 'nvp-config-api', 'dynamic-grid-config-api']) {
    const filename = path.join(root, `src-ts/runtime-executables/lib/${name}.ts`);
    const code = fs.readFileSync(filename, 'utf8');
    assert.doesNotMatch(code, /@ts-(?:nocheck|ignore|expect-error)\b/);
    const source = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      assert.notEqual(node.kind, ts.SyntaxKind.AnyKeyword, `${name}: unsicherer Typ`);
      assert.notEqual(node.kind, ts.SyntaxKind.NonNullExpression, `${name}: ungeprüfter Nicht-null-Zugriff`);
      if (ts.isAsExpression(node)) assert.equal(node.type.getText(source), 'const', `${name}: ungeprüfte Typbehauptung`);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
});

test('fehlerhafte Validatorausgaben werden vor einer fachlichen Weiterverwendung abgewiesen', () => {
  for (const value of [null, [], true, { valid: 'true', config: {}, errors: [] }, { valid: true, config: {}, errors: ['private'] }, { valid: true, config: {}, errors: [], activationErrors: [{}] }]) {
    assert.throws(() => guards.validationResult(value), { message: 'CONFIG_VALIDATION_CONTRACT_INVALID' });
  }
  const rejected = { valid: false, config: null, errors: [{ path: 'config', code: 'invalid', message: 'Ungültig' }] };
  assert.equal(guards.validationResult(rejected), rejected, 'Fachliche Fehler bleiben samt Diagnose unverändert.');
  assert.throws(() => guards.issueResult({ errors: [{ code: 'missing-path' }] }), { message: 'CONFIG_ISSUE_CONTRACT_INVALID' });
});

test('verschachtelte Konfigurationsverträge dürfen keine ungeprüften Messobjekte enthalten', () => {
  const staticConfig = { mode: 'static', operation: 'diagnostic', points: [], storages: [], pvAssignments: [] };
  assert.equal(guards.nvpConfig(staticConfig), staticConfig);
  assert.throws(() => guards.nvpConfig({ ...staticConfig, points: [{ measurement: { stateId: 7 } }] }), { message: 'NVP_VALIDATION_CONTRACT_INVALID' });
  assert.throws(() => guards.nvpConfig({ ...staticConfig, storages: [{ id: 'storage', powerMeasurement: null }] }), { message: 'NVP_VALIDATION_CONTRACT_INVALID' });
  const draft = dynamicGridDefaults();
  assert.equal(guards.dynamicConfig(draft), draft);
  for (const changed of [{ configVersion: '1' }, { configVersion: 1.5 }, { storages: [null] }, { pvAssignments: [{ id: 1 }] }]) {
    assert.throws(() => guards.dynamicConfig({ ...draft, ...changed }), { message: 'DYNAMIC_GRID_VALIDATION_CONTRACT_INVALID' });
  }
});

test('falsche ioBroker-Objektformen liefern feste Auflösungsfehler', async () => {
  for (const value of [null, 1, [], { type: 'channel' }, { type: 'state', common: [] }, { type: 'state', common: 'private' }]) {
    const adapter = { getForeignObjectAsync: async () => value };
    await assert.rejects(nvp.resolveNvpSource(adapter, 'meter'), { message: 'MEASUREMENT_SOURCE_UNAVAILABLE' });
    await assert.rejects(dynamic.resolveDynamicGridObject(adapter, 'meter', 'read'), { message: 'STATE_OBJECT_MISSING' });
  }
});

test('gültige getrennte Aliasrichtungen bleiben unverändert nutzbar', async () => {
  const objects = new Map([
    ['alias', { type: 'state', common: { read: true, write: true, alias: { id: { read: 'meter', write: 'target' } } } }],
    ['meter', { type: 'state', common: { read: true, write: false } }],
    ['target', { type: 'state', common: { read: true, write: true } }],
  ]);
  const adapter = { getForeignObjectAsync: async id => objects.get(id) };
  assert.equal(await nvp.resolveNvpSource(adapter, 'alias'), 'meter');
  assert.deepEqual((await dynamic.resolveDynamicGridObject(adapter, 'alias', 'read')).chain, ['alias', 'meter']);
  assert.deepEqual((await dynamic.resolveDynamicGridObject(adapter, 'alias', 'write')).chain, ['alias', 'target']);
  await assert.rejects(dynamic.resolveDynamicGridObject(adapter, 'meter', 'write'), { message: 'STATE_NOT_WRITABLE' });
});

test('ungültige Bestandszeilen verschieben keine Speicher- oder PV-Kennungen', () => {
  const inventory = nvp.nvpDeviceInventory({ storageFarm: { storages: [null, { name: 'Zweiter', signedPowerId: 'ess.actual' }] },
    gridConstraints: { pvCurtailInvertersEvu: [false, { name: 'Zweiter WR' }] } });
  assert.equal(inventory.storages[0].id, 'storage-farm-1');
  assert.equal(inventory.storages[0].index, 1);
  assert.equal(inventory.pv[0].id, 'pv-evu-1');
  assert.deepEqual(inventory.storages[0].powerStateIds, ['ess.actual']);
});

test('Dictionary-Fallbacks besitzen keinen Prototyp und fremde Schlüssel verschmutzen keine globalen Objekte', () => {
  const empty = guards.record(undefined);
  assert.equal(Object.getPrototypeOf(empty), null);
  empty.__proto__ = { boundaryPolluted: true };
  assert.equal({}.boundaryPolluted, undefined);
  const submitted = JSON.parse('{"__proto__":{"boundaryPolluted":true},"constructor":{"prototype":{"boundaryPolluted":true}}}');
  assert.equal(guards.own(submitted, '__proto__'), true);
  assert.equal(guards.own(Object.create({ inherited: true }), 'inherited'), false);
  assert.equal({}.boundaryPolluted, undefined);
});

test('alte und fehlerhafte Entwürfe bleiben sichtbar und lesendes CAS verändert die gespeicherten Daten nicht', () => {
  const raw = { configVersion: 'alt', points: 'noch-unvollständig', storages: [], pvAssignments: [] };
  const adapter = { config: { dynamicGridConnection: raw, nvpTopology: 'ungültiger Altstand' } };
  const read = dynamic.currentDynamicGridConfig(adapter);
  assert.equal(read.configVersion, 1);
  assert.equal(read.points, 'noch-unvollständig');
  assert.equal(raw.configVersion, 'alt');
  assert.equal(nvp.currentNvpConfig(adapter), 'ungültiger Altstand');
  assert.equal(nvp.nvpCurrentStatus(adapter).status, 'pending');
});

test('fremde Speicherfehler bleiben sanitisiert und geben die Speichersperre wieder frei', async () => {
  for (const kind of ['nvp', 'dynamic']) {
    const routes = new Map();
    const app = { get(url, ...handlers) { routes.set(`GET ${url}`, handlers); }, post(url, ...handlers) { routes.set(`POST ${url}`, handlers); } };
    const adapter = { config: {}, getForeignObjectAsync: async () => null };
    const token = {}; let released = false;
    const hooks = { beginSave: () => token, endSave: value => { released = value === token; }, commit: async () => { throw new Error('SYNTHETIC_PRIVATE_BOUNDARY_MARKER'); } };
    if (kind === 'nvp') nvp.registerNvpConfigApi(app, adapter, () => {}, hooks);
    else dynamic.registerDynamicGridApi(app, adapter, () => {}, hooks);
    const handler = routes.get(kind === 'nvp' ? 'POST /api/nvp/topology/config' : 'POST /api/dynamic-grid/config')[1];
    const res = response();
    await handler({ body: { config: kind === 'nvp' ? { mode: 'static' } : dynamicGridDefaults(), expectedConfigVersion: 1 } }, res);
    assert.equal(res.code, 500);
    assert.equal(res.body.error, 'internal_error');
    assert.doesNotMatch(JSON.stringify(res.body), /SYNTHETIC|stack|\.js:/);
    assert.equal(released, true);
    assert.deepEqual(adapter.config, {});
  }
});

test('ein defekter interner Patch-Merge darf keinen neuen Konfigurationsvertrag erzeugen', async () => {
  const adapter = { config: {}, getForeignObjectAsync: async () => null, nwApplyInstallerPatchToRuntimeConfig: () => null };
  await assert.rejects(dynamic.prepareDynamicGridInstallerPatch(adapter, {}, {}, 1), { message: 'INSTALLER_PATCH_CONTRACT_INVALID' });
});
