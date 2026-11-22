/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/** Reine Softwaretests der kanonischen Steuergrenze; keine Hardwarefreigabe. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const SOURCE = path.resolve(__dirname, '../src-ts/runtime-executables/ems/services/arbitrage-control.ts');
const source = fs.readFileSync(SOURCE, 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
const loaded = new Module(SOURCE, module);
loaded.filename = SOURCE;
loaded.paths = module.paths;
loaded._compile(compiled.outputText, SOURCE);
const { evaluateArbitrageRequest: evaluate } = loaded.exports;
const NOW = 1800000000000;
const sample = value => ({ value, ts: NOW - 100, valid: true });
function request(extra = {}) {
  return { id: 'cmd-1', resourceId: 'battery-1', direction: 'charge', powerW: 3000, issuedAt: NOW - 1000, expiresAt: NOW + 3000, ...extra };
}
function context() {
  return {
    now: NOW, resourceId: 'battery-1', appActive: true, commissioned: true, writerActive: true, available: true,
    sampleMaxAgeMs: 5000, maxSkewMs: 1000,
    soc: sample(50), batteryPower: sample(0), gridPower: sample(1000),
    limits: { minSoc: 20, maxSoc: 90, maxChargeW: 6000, maxDischargeW: 6000, maxImportW: 11000, maxExportW: 8000, allowGridCharge: true, allowGridExport: true },
    grant: { maxChargeW: 6000, maxDischargeW: 6000, issuedAt: NOW - 10, expiresAt: NOW + 1000 },
  };
}

test('strict TS und verbotene Typausnahmen im gesamten neuen Steuermodul', () => {
  const program = ts.createProgram([SOURCE], { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    strict: true, noImplicitAny: true, strictNullChecks: true, useUnknownInCatchVariables: true,
    noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, noEmit: true, types: [], skipLibCheck: false });
  assert.deepEqual(ts.getPreEmitDiagnostics(program).map(d => ({ code: d.code, file: d.file?.fileName })), []);
  const file = ts.createSourceFile(SOURCE, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const forbidden = [];
  function visit(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) forbidden.push('any');
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.deepEqual(forbidden, []);
  assert.equal(file.pragmas?.has('ts-nocheck'), false);
  assert.equal((file.commentDirectives || []).length, 0);
});

test('Standalone Haushalt ohne PV, Bilanz oder dynamische App lädt und entlädt', () => {
  assert.equal(evaluate(request(), context()).targetW, -3000);
  const discharge = evaluate(request({ direction: 'discharge' }), context());
  assert.equal(discharge.targetW, 3000);
  assert.equal(discharge.status, 'ready');
});

test('reiner Speicherhandel ohne Hauslast funktioniert mit eigenen statischen Grenzen', () => {
  const c = context(); c.gridPower = sample(0);
  assert.equal(evaluate(request({ direction: 'discharge', powerW: 5000 }), c).targetW, 5000);
  assert.equal(evaluate(request({ powerW: 5000 }), c).targetW, -5000);
});

test('Partnerdienstvertrag wird ohne freie Datenpunkte auf denselben Intent abgebildet', () => {
  const r = request(); delete r.direction;
  Object.assign(r, { action: 'charge', partnerId: 'partner-1', configVersion: 3 });
  assert.equal(evaluate(r, context()).targetW, -3000);
  assert.equal(evaluate({ ...r, stateId: 'system.host.x' }, context()).reason, 'invalid-request');
  assert.equal(evaluate({ ...r, direction: 'discharge' }, context()).reason, 'invalid-request');
});

test('Freigabe, Geräteabnahme und alleiniger Writer sind zwingend', () => {
  for (const key of ['appActive', 'commissioned', 'writerActive', 'available']) {
    const c = context(); c[key] = false;
    const d = evaluate(request(), c);
    assert.equal(d.status, 'rejected', key); assert.equal(d.targetW, null, key);
  }
  const c = context(); c.resourceId = 'battery-2';
  assert.equal(evaluate(request(), c).reason, 'resource-mismatch');
});

test('physische Werte sind echte endliche Zahlen, kein null/Boolean/String-Ersatz', () => {
  for (const bad of [null, true, false, '', '0', '50', NaN, Infinity, -Infinity]) {
    assert.equal(evaluate(request({ powerW: bad }), context()).status, 'rejected');
    for (const field of ['soc', 'batteryPower', 'gridPower']) {
      const c = context(); c[field].value = bad;
      assert.equal(evaluate(request(), c).reason, 'telemetry-invalid', `${field}:${String(bad)}`);
    }
  }
});

test('SoC-Grenzen und gültige Nullleistungsgrenzen sperren jeweilige Richtung', () => {
  const c = context(); c.soc.value = 90;
  assert.equal(evaluate(request(), c).reason, 'operating-limit');
  c.soc.value = 20;
  assert.equal(evaluate(request({ direction: 'discharge' }), c).reason, 'operating-limit');
  c.soc.value = 50; c.limits.maxChargeW = 0;
  assert.equal(evaluate(request(), c).reason, 'operating-limit');
  for (const invalid of [-0.1, 100.1]) { c.soc.value = invalid; assert.equal(evaluate(request(), c).reason, 'telemetry-invalid'); }
});

test('veraltete, zukünftig datierte oder ungültige Messungen ergeben keinen Sollwert', () => {
  for (const field of ['soc', 'batteryPower', 'gridPower']) {
    for (const ts of [NOW - 5000, NOW + 1]) {
      const c = context(); c[field].ts = ts;
      assert.equal(evaluate(request(), c).reason, 'telemetry-invalid');
    }
    const c = context(); c[field].valid = false;
    assert.equal(evaluate(request(), c).targetW, null);
  }
});

test('zeitlich inkohärente, für sich frische Messungen bleiben gesperrt', () => {
  const c = context(); c.gridPower.ts = NOW - 2000;
  assert.equal(evaluate(request(), c).reason, 'telemetry-incoherent');
});

test('abgelaufene, zukünftige und zu lange Befehle werden abgewiesen', () => {
  assert.equal(evaluate(request({ expiresAt: NOW }), context()).reason, 'request-expired-or-future');
  assert.equal(evaluate(request({ issuedAt: NOW + 1 }), context()).reason, 'request-expired-or-future');
  assert.equal(evaluate(request({ expiresAt: NOW + 60000 }), context()).reason, 'invalid-request');
});

test('zentraler Grant begrenzt Leistung und Lebensdauer und fehlt niemals still', () => {
  const c = context(); c.grant.maxChargeW = 1200;
  const d = evaluate(request(), c);
  assert.equal(d.targetW, -1200); assert.equal(d.status, 'limited'); assert.equal(d.validUntil, NOW + 1000);
  delete c.grant; assert.equal(evaluate(request(), c).reason, 'central-grant-unavailable');
});

test('abgelaufene oder ungültige Grants können keine alte Freigabe fortsetzen', () => {
  for (const field of ['maxChargeW', 'maxDischargeW']) {
    const c = context(); c.grant[field] = '6000';
    assert.equal(evaluate(request(), c).reason, 'central-grant-unavailable');
  }
  const c = context(); c.grant.expiresAt = NOW;
  assert.equal(evaluate(request(), c).reason, 'central-grant-unavailable');
  c.grant.expiresAt = NOW + 1000; c.grant.issuedAt = NOW + 1;
  assert.equal(evaluate(request(), c).reason, 'central-grant-unavailable');
});

test('dynamische Zusatzlimits können nur enger werden und niemals Grundlimits ersetzen', () => {
  const c = context(); c.dynamicLimitsRequired = true;
  assert.equal(evaluate(request(), c).reason, 'dynamic-limits-unavailable');
  c.dynamicLimits = { required: true, valid: true, maxChargeW: 500, maxDischargeW: 500, issuedAt: NOW - 1, expiresAt: NOW + 500 };
  let d = evaluate(request(), c); assert.equal(d.targetW, -500); assert.equal(d.validUntil, NOW + 500);
  c.dynamicLimits.maxChargeW = 999999; c.limits.maxChargeW = 250;
  assert.equal(evaluate(request(), c).targetW, -250);
  c.dynamicLimits.valid = false; c.dynamicLimits.required = false;
  assert.equal(evaluate(request(), c).reason, 'dynamic-limits-unavailable');
});

test('Anschlussberechnung entfernt laufenden Speicher-Istwert genau einmal', () => {
  const c = context(); c.gridPower.value = 10000; c.batteryPower.value = -3000;
  // Restverbrauch 7 kW, Anschluss 11 kW: insgesamt 4 kW Speicherladung zulässig.
  assert.equal(evaluate(request({ powerW: 6000 }), c).targetW, -4000);
  c.gridPower.value = -7000; c.batteryPower.value = 4000;
  // Restexport 3 kW, Exportgrenze 8 kW: insgesamt 5 kW Entladung zulässig.
  assert.equal(evaluate(request({ direction: 'discharge', powerW: 6000 }), c).targetW, 5000);
});

test('Netzladen und Netzeinspeisung benötigen ihre jeweiligen lokalen Freigaben', () => {
  const c = context(); c.limits.allowGridCharge = false;
  assert.equal(evaluate(request(), c).reason, 'operating-limit');
  c.gridPower.value = -2000;
  assert.equal(evaluate(request(), c).targetW, -2000);
  c.gridPower.value = 1000; c.limits.allowGridExport = false;
  assert.equal(evaluate(request({ direction: 'discharge' }), c).targetW, 1000);
});

test('Grenzen bleiben bei überlastetem Anschluss und strikten Nullwerten wirksam', () => {
  const c = context(); c.gridPower.value = 12000;
  assert.equal(evaluate(request(), c).reason, 'operating-limit');
  c.gridPower.value = -9000;
  assert.equal(evaluate(request({ direction: 'discharge' }), c).reason, 'operating-limit');
  c.gridPower.value = 0; c.limits.maxImportW = 0;
  assert.equal(evaluate(request(), c).reason, 'operating-limit');
});

test('Messwertablauf begrenzt Entscheidung, Bruchteile werden sicher abgerundet', () => {
  const c = context(); c.soc.ts = c.batteryPower.ts = c.gridPower.ts = NOW - 4900;
  assert.equal(evaluate(request(), c).validUntil, NOW + 100);
  c.grant.maxChargeW = 1000.9;
  assert.equal(evaluate(request(), c).targetW, -1000);
});

test('Nullwunsch ist ein begrenzter Intent und keine Bestätigung einer Gerätewirkung', () => {
  const d = evaluate(request({ powerW: 0 }), context());
  assert.equal(d.targetW, 0); assert.equal(d.status, 'ready');
  assert.equal(Object.hasOwn(d, 'applied'), false); assert.equal(Object.isFrozen(d), true);
});

test('Getter, Prototypschlüssel und Proxyfehler werden ohne fremde Fehlerdetails isoliert', () => {
  let called = false;
  const r = request(); Object.defineProperty(r, 'powerW', { enumerable: true, get() { called = true; throw new Error('secret'); } });
  assert.equal(evaluate(r, context()).status, 'rejected'); assert.equal(called, false);
  const evil = JSON.parse('{"__proto__":{"admin":true}}');
  assert.equal(evaluate(evil, context()).status, 'rejected');
  const proxy = new Proxy({}, { getPrototypeOf() { throw new Error('private-data'); } });
  assert.deepEqual(evaluate(proxy, context()), { status: 'rejected', reason: 'invalid-input', requestId: null, resourceId: null, requestedW: null, targetW: null, validUntil: null });
});

test('Eingaben werden nicht mutiert und beliebige Datenpunkt-/Codefelder sind abgewiesen', () => {
  const r = request(), c = context(), before = JSON.stringify({ r, c });
  evaluate(r, c); assert.equal(JSON.stringify({ r, c }), before);
  for (const key of ['stateId', 'objectId', 'script', 'command']) assert.equal(evaluate({ ...r, [key]: 'x' }, c).reason, 'invalid-request');
});
