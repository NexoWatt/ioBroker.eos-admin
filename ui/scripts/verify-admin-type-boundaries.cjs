/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/* Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Nutzung, Änderung und Weitergabe nur mit ausdrücklicher Erlaubnis. */
'use strict';
/** Führt die echten nativen Admin-DTO-Guards gegen reale Backendantworten und negative Grenzfälle aus.
 * Ergänzt strict und Browserprüfungen; kein Nachweis für echte Gerätewirkung oder OWASP-Vollkonformität. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
// Projektweit exakt 5.8.3: normaler Devtool-Import ohne verschachtelten Installationspfad.
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const moduleFixture = { exports: {} };
const source = fs.readFileSync(path.join(root, 'src-admin-tab/src/lib/adminContracts.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true });
assert.equal(compiled.diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0);
vm.runInThisContext('(function(module,exports){' + compiled.outputText + '\n})', { filename: 'adminContracts.test.js' })(moduleFixture, moduleFixture.exports);
const contracts = moduleFixture.exports;
const api = require('../lib/dynamic-grid-config-api');
const { dynamicGridDefaults, validateDynamicGridConfig } = require('../ems/services/dynamic-grid-config');
const clone = value => JSON.parse(JSON.stringify(value));
let checks = 0;
function check(name, run) { run(); checks++; console.log('PASS', name); }
function adapter() {
  return { config: { datapoints: {}, dynamicGridConnection: dynamicGridDefaults(), emsApps: { schemaVersion: 1, apps: { dynamicGrid: { installed: true, enabled: false } } } },
    getForeignObjectAsync: async () => null, _nwLicenseMaxStorages: () => 2 };
}
(async () => {
  const a = adapter(); const raw = clone(await api.dynamicGridSnapshot(a));
  check('real inactive snapshot with null budget and missing M0 mappings remains editable', () => {
    const parsed = contracts.parseDynamicGridResponse(raw);
    assert.equal(parsed.config.configVersion, 1); assert.equal(parsed.status.status, 'inactive'); assert.equal(parsed.status.budget, null);
    assert.ok(parsed.validation.activationErrors.length > 0); assert.equal(parsed.rootSource.valid, false);
  });
  check('incomplete stored drafts retain empty and null numeric values', () => {
    const input = clone(raw); input.config.maxSkewMs = '';
    input.config.storages = [{ id: 'draft', maxChargeW: '', maxDischargeW: null, socMeasurement: { stateId: '', scale: null }, command: { mode: 'externalLimits', watchdog: { writeValue: false } } }];
    const parsed = contracts.parseDynamicGridResponse(input);
    assert.equal(parsed.config.maxSkewMs, ''); assert.equal(parsed.config.storages[0].maxChargeW, ''); assert.equal(parsed.config.storages[0].maxDischargeW, null); assert.equal(parsed.config.storages[0].command.watchdog.writeValue, false);
  });
  check('backend-compatible legacy drafts and valid point order remain editable', () => {
    const input = clone(raw); delete input.config.schemaVersion; input.config.points.reverse();
    assert.equal(validateDynamicGridConfig(input.config).valid, true);
    assert.equal(contracts.parseDynamicGridResponse(input).config.schemaVersion, undefined);
    assert.deepEqual(contracts.parseDynamicGridResponse(input).config.points.map(point => point.id), ['M1', 'M0']);
  });
  check('extra legitimate configuration fields remain intact', () => {
    const input = clone(raw); input.config.extension = { future: [0, false, 'value'] };
    const parsed = contracts.parseDynamicGridResponse(input);
    assert.equal(parsed, input); assert.deepEqual(parsed.config.extension, { future: [0, false, 'value'] });
  });
  check('real normalized draft and split M0 measurement pass guards', () => {
    const normalized = clone(validateDynamicGridConfig(dynamicGridDefaults()));
    const input = clone(raw); input.config = normalized.config;
    input.rootSource.measurement = { kind: 'split', importMeasurement: { stateId: 'site.import', unit: 'W', sign: 1 }, exportMeasurement: { stateId: 'site.export', unit: 'kW', sign: 1 }, sign: -1 };
    assert.equal(contracts.parseDynamicGridResponse(input).rootSource.measurement.exportMeasurement.unit, 'kW');
  });
  check('real stale runtime response keeps null telemetry as unavailable', () => {
    const input = clone(raw); a.config.emsApps.apps.dynamicGrid.enabled = true;
    a._nwDynamicGridStatus = { configVersion: 1, active: true, ts: Date.now() - 60000 };
    input.status = clone(api.dynamicGridCurrentStatus(a));
    assert.equal(contracts.parseDynamicGridResponse(input).status.snapshot, null);
    assert.equal(contracts.parseDynamicGridResponse(input).status.writesPerformed, null);
  });
  check('preview contract permits a response without configuration while load/save do not', () => {
    const preview = { validation: { valid: false, errors: [{ path: 'points.M1', code: 'missing', message: 'Zuordnung fehlt' }] }, status: null };
    assert.equal(contracts.parseDynamicGridResponse(preview, false).validation.valid, false);
    assert.throws(() => contracts.parseDynamicGridResponse(preview)); assert.throws(() => contracts.parseDynamicGridResponse({}));
  });
  check('malformed nested configuration cannot replace the current draft', () => {
    for (const mutate of [value => { value.config.storages = {}; }, value => { value.config.points[0].importLimitW = false; }, value => { value.config.points[1].measurement.stateId = {}; }, value => { value.config.configVersion = 1.5; }, value => { value.config.points[1].id = 'M0'; }, value => { value.status.storageResults = [{ id: 'x', targetW: '0' }]; }]) {
      const input = clone(raw); mutate(input); assert.throws(() => contracts.parseDynamicGridResponse(input));
    }
  });
  check('poison keys, getters, cycles, non-finite numbers and oversized nesting fail closed', () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      const input = clone(raw); input.config.extra = JSON.parse('{"' + key + '":{ "polluted":true }}'); assert.throws(() => contracts.parseDynamicGridResponse(input));
    }
    let touched = false; const getter = Object.defineProperty({}, 'secret', { enumerable: true, get() { touched = true; return 'sensitive'; } });
    assert.equal(contracts.isSafeJson(getter), false); assert.equal(touched, false);
    const cycle = {}; cycle.self = cycle; assert.equal(contracts.isSafeJson(cycle), false);
    assert.equal(contracts.isSafeJson({ value: Infinity }), false);
    let deep = {}; for (let index = 0; index < 34; index++) deep = { nested: deep }; assert.equal(contracts.isSafeJson(deep), false);
    assert.equal(Object.prototype.polluted, undefined);
  });
  check('validation messages keep paths but cannot carry arbitrary objects into React', () => {
    assert.equal(contracts.parseValidation({ valid: false, errors: [{ path: 'points.M0', message: 'fehlt' }, 'Prüfhinweis'] }).errors.length, 2);
    assert.equal(contracts.parseValidation({ errors: [{ message: { unsafe: true } }] }), null);
    assert.equal(contracts.parseValidationDetails([{ code: 'missing', message: 'Zuordnung fehlt' }]).valid, false);
  });
  check('mail API fields and real TLS choices are validated before state updates', () => {
    const value = { config: { enabled: true, host: 'mail.local', port: 465, tlsMode: 'tls', user: 'operator', siteName: 'Test', passwordSet: true, extension: true } };
    assert.equal(contracts.parseMailResponse(value).passwordSet, true); assert.equal(contracts.parseMailResponse(value).extension, true);
    for (const patch of [{ port: '465' }, { port: 0 }, { port: 65536 }, { tlsMode: 'plain' }, { enabled: 'false' }]) assert.throws(() => contracts.parseMailResponse({ config: { ...value.config, ...patch } }));
  });
  check('Admin build requires actual strict checking and sources contain no any/suppression', () => {
    const configPath = path.join(root, 'src-admin-tab/tsconfig.json'); const config = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
    assert.equal(parsed.options.strict, true); assert.notEqual(parsed.options.noCheck, true); assert.ok(parsed.fileNames.length >= 15);
    for (const file of parsed.fileNames) {
      const text = fs.readFileSync(file, 'utf8'); assert.ok(!/@ts-(?:nocheck|ignore|expect-error)\b/.test(text), path.relative(root, file));
      const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      function visit(node) { assert.notEqual(node.kind, ts.SyntaxKind.AnyKeyword, path.relative(root, file)); ts.forEachChild(node, visit); } visit(ast);
    }
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'src-admin-tab/package.json'), 'utf8'));
    assert.match(pkg.scripts.build, /^npm run typecheck &&/); assert.equal(pkg.dependencies.react, '^18.3.1'); assert.equal(pkg.dependencies['react-dom'], '^18.3.1');
  });
  console.log(`PASS Admin-Typgrenzen: ${checks} Prüfgruppen`);
})().catch(error => { console.error(error); process.exitCode = 1; });
