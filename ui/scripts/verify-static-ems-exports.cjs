/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';

/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft die beiden EVCS-Helfer bei abgeschalteter String-Codegenerierung.
 * Daten und Wirkung: Lädt nur feste lokale Quellen/Artefakte; temporäre CommonJS-Kopien
 * der JS-kompatiblen TS-Quellen bleiben außerhalb des Repositorys und werden entfernt.
 * Verknüpfungen: ems/charging-budget-helpers.js; ems/evcs-control-mapping.js.
 * Grenze: Dieser Regressionstest belegt keinen vollständigen Sicherheitsnachweis.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test, after } = require('node:test');

const childFlag = '--static-exports-child';
if (!process.argv.includes(childFlag)) {
  const child = spawnSync(process.execPath, [
    '--disallow-code-generation-from-strings',
    __filename,
    childFlag,
    ...process.argv.slice(2),
  ], { stdio: 'inherit', timeout: 30000 });
  if (child.error || child.status !== 0) process.exitCode = 1;
} else {
  assert(process.execArgv.includes('--disallow-code-generation-from-strings'));
  const root = path.resolve(__dirname, '..');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexowatt-static-exports-'));
  after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const helpers = [
    {
      name: 'charging-budget-helpers',
      exports: [
        'resolveAcChargingLimits', 'deriveChargingConnectorCapacityW',
        'computeChargingInfrastructureCapacity', 'computeChargingMinimumServicePlan',
      ],
      verify(api) {
        const limits = api.resolveAcChargingLimits({ phases: 3, voltageV: 230, minA: 6, maxA: 16 });
        assert.equal(limits.minPowerW, 4140);
        assert.equal(limits.maxPowerW, 11040);
        assert.equal(api.deriveChargingConnectorCapacityW({
          enabled: true, chargerType: 'ac', controlBasis: 'currentA',
          setCurrentAId: 'test.lp.setA', phases: 3, voltageV: 230,
          maxA: 32, maxPowerW: 11000,
        }, 22000), 11000);
      },
    },
    {
      name: 'evcs-control-mapping',
      exports: [
        'deriveNexowattDeviceBaseId', 'buildEvcsControlCandidates',
        'buildEvcsTelemetryCandidates', 'normalizeEvcsChargeDemandObjectId',
        'isUpgradeableNexowattEvcsStatusObjectId', 'resolveEvcsControlMapping',
      ],
      verify(api) {
        const base = 'nexowatt-devices.0.devices.test_lp';
        assert.equal(api.deriveNexowattDeviceBaseId(`${base}.aliases.r.power`), base);
        assert.equal(api.buildEvcsControlCandidates(base).current[0], `${base}.aliases.v1.ctrl.targetCurrentA`);
        assert.equal(api.buildEvcsTelemetryCandidates(base).status[0], `${base}.aliases.v1.r.mode3State`);
        assert.deepEqual(api.buildEvcsControlCandidates(''), { current: [], power: [], enable: [] });
      },
    },
  ];
  for (const helper of helpers) {
    const sourcePath = path.join(root, 'src-ts/runtime-executables/ems', `${helper.name}.ts`);
    const source = fs.readFileSync(sourcePath, 'utf8');
    test(`${helper.name}: statischer Export und proprietärer Header in Originalquelle`, () => {
      assert(source.startsWith('/**\n * Copyright (c) 2026 NexoWatt.'));
      assert.match(source, /\bmodule\.exports\s*=/);
      assert.doesNotMatch(source, /\beval\s*\(/);
      assert.doesNotMatch(source, /\bnew\s+Function\s*\(/);
    });
    test(`${helper.name}: Originalquelle lädt und arbeitet ohne String-Codegenerierung`, () => {
      const copy = path.join(temp, `${helper.name}.cjs`);
      fs.writeFileSync(copy, source, { flag: 'wx', mode: 0o600 });
      const api = require(copy);
      assert.deepEqual(Object.keys(api).sort(), [...helper.exports].sort());
      for (const name of helper.exports) assert.equal(typeof api[name], 'function');
      helper.verify(api);
    });
    if (!process.argv.includes('--source-only')) {
      test(`${helper.name}: erzeugtes Laufzeitartefakt lädt ohne String-Codegenerierung`, () => {
        const runtimePath = path.join(root, 'ems', `${helper.name}.js`);
        const runtime = fs.readFileSync(runtimePath, 'utf8');
        assert.doesNotMatch(runtime, /\beval\s*\(/);
        const api = require(runtimePath);
        assert.deepEqual(Object.keys(api).sort(), [...helper.exports].sort());
        helper.verify(api);
      });
    }
  }
}
