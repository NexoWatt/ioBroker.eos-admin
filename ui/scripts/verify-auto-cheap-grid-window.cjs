#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
// Reale Charging-Management-Ticks mit gemockter IO. Keine Hardwaretests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');

// Review-only: prüft die kanonische TS-Datei vor dem gemeinsamen Runtime-Sync.
// Im regulären Releasecheck ohne Option wird das ausgelieferte JS ausgeführt.
if (process.argv.includes('--canonical')) {
  const filename = path.join(root, 'ems/modules/charging-management.js');
  const source = fs.readFileSync(path.join(root, 'src-ts/runtime-executables/ems/modules/charging-management.ts'), 'utf8');
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  require.cache[filename] = compiled;
  compiled._compile(Module.stripTypeScriptTypes(source, { mode: 'strip' }), filename);
  compiled.loaded = true;
}

const { makeHarness } = require('./verify-rc60-universal-auto-wallbox.js');
const base = 'chargingManagement.wallboxes.lp1.';
async function runCase(name, overrides, expected) {
  const o = { active: true, fresh: true, stale: false, state: 'guenstig', gate: true, policy: 'cheap-grid', ...overrides };
  const h = makeHarness({ gridAllowed: o.gate, tariffState: o.state, priceCurrent: o.negative ? -0.05 : 0.1,
    gridImportPreferred: o.negative === true, status: 'B2', totalBudgetW: o.budgetW ?? 11000, userMode: o.userMode || 'auto' });
  h.setLocal(base + 'userAutoSource', 'strategy');
  h.setLocal('tarif.aktiv', o.active);
  h.setLocal('tarif.currentPriceFresh', o.fresh);
  h.setLocal('tarif.dynamicTariffStale', o.stale);
  h.setLocal('tarif.netFeeEnabled', !!o.netFee);
  h.setLocal('tarif.netFeeMode', o.netFee || 'Standard');
  if (o.hold) {
    h.adapter.config.chargingManagement.tariffPermissionHoldSec = 60;
    h.module._tariffGridChargeAllowed = false;
    h.module._tariffGridChargeAllowedTrueSinceMs = 0;
  }
  h.adapter.config.operatingStrategies = { resourceLinks: [{ sourceId: 'evcs:lp1', autoSource: 'strategy', enabled: true,
    controlMode: 'active', commissioningConfirmed: true, writeEnabled: true }] };
  h.adapter._nwOperatingStrategyRuntime = { activeControl: true, requestsByResource: { 'evcs:lp1': {
    selected: true, controlEligible: true, issuedAt: Date.now(), expiresAt: Date.now() + 60000,
    action: o.action || 'target-power', requestedPowerW: 11000, maxPowerW: 11000, energySourcePolicy: o.policy,
  } } };
  try {
    const out = await h.tick();
    assert.equal(out.vehicleStartEligible, true, name + ': vehicle start eligibility');
    assert.equal(out.effectiveMode, expected.mode, name + ': effective mode');
    if (expected.starts) {
      assert.ok(out.targetPowerW >= 4140 && out.targetPowerW <= (o.budgetW ?? 11000), name + ': bounded start target');
      assert.ok(out.writes.some(w => w.key.endsWith('.setA') && w.value >= 6), name + ': actual mock write');
    } else assert.equal(out.targetPowerW, 0, name + ': no positive target');
    return { name, mode: out.effectiveMode, targetW: out.targetPowerW };
  } finally { h.stop(); }
}

(async () => {
  const cases = [
    ['positive cheap tariff', {}, { mode: 'normal', starts: true }],
    ['cheap tariff inside NT', { netFee: 'NT' }, { mode: 'normal', starts: true }],
    ['negative tariff', { negative: true }, { mode: 'normal', starts: true }],
    ['EVCS tariff priority denies grid', { gate: false }, { mode: 'pv', starts: false }],
    ['HT denies positive cheap tariff', { netFee: 'HT' }, { mode: 'pv', starts: false }],
    ['neutral tariff', { state: 'neutral' }, { mode: 'pv', starts: false }],
    ['expensive tariff', { state: 'teuer', gate: false }, { mode: 'pv', starts: false }],
    ['stale tariff', { stale: true }, { mode: 'pv', starts: false }],
    ['current price not fresh', { fresh: false }, { mode: 'pv', starts: false }],
    ['disabled tariff with old cheap state', { active: false }, { mode: 'pv', starts: false }],
    ['permission hold pending', { hold: true }, { mode: 'pv', starts: false }],
    ['PV-only strategy retains source limit', { policy: 'pv-only', negative: true }, { mode: 'pv', starts: false }],
    ['strategy pause remains blocked', { action: 'pause' }, { mode: 'normal', starts: false }],
    ['hard budget below minimum remains blocked', { budgetW: 2000 }, { mode: 'normal', starts: false }],
    ['explicit PV remains selected', { userMode: 'pv' }, { mode: 'pv', starts: false }],
    ['explicit boost remains independent', { userMode: 'boost', gate: false }, { mode: 'boost', starts: true }],
  ];
  const results = [];
  for (const [name, overrides, expected] of cases) results.push(await runCase(name, overrides, expected));
  console.log(JSON.stringify({ suite: 'auto-cheap-grid-window', source: process.argv.includes('--canonical') ? 'canonical-ts' : 'runtime-js', cases: results.length, results }, null, 2));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
