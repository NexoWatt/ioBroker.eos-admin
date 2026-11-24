// Audit-only deterministic reproduction; sealed production source is not changed.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const root = '/workspace/scratch/741f792566ea/source-919/iobroker.eos-admin';
let elapsed = 0;
const filename = path.join(root, 'src/lib/eosLegacyMigration.js');
const localRequire = createRequire(filename);
const production = { exports: {} };
vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
  module: production, exports: production.exports, Buffer, setTimeout, clearTimeout,
  require(name) {
    if (name === 'node:perf_hooks') return { performance: { now: () => elapsed } };
    if (name === 'node:timers/promises') return { setTimeout: async ms => { elapsed += ms; } };
    return localRequire(name);
  },
}, { filename });
const fixtureFile = path.join(root, 'test/eos-module-legacy-migration.test.cjs');
const fixtureRequire = createRequire(fixtureFile);
const context = { module: { exports: {} }, __dirname: path.dirname(fixtureFile), Buffer, structuredClone,
  require(name) { return name === '../src/lib/eosLegacyMigration' ? production.exports : fixtureRequire(name); } };
const prefix = fs.readFileSync(fixtureFile, 'utf8').split("test('late license activation")[0];
vm.runInNewContext(prefix + '\nmodule.exports = fixture;', context, { filename: fixtureFile });
(async () => {
  const f = context.module.exports();
  delete f.migration.options.startTimeoutMs; // the shipped 45-second default, not a shortened test budget
  await f.migration.start();
  assert.equal(f.migration.phase, 'TRANSFERRED');
  let stoppedAt = null;
  f.owner.eosModuleHost = {
    status: async () => ({ active: elapsed >= 60000, reason: elapsed >= 60000 ? 'RUNNING' : 'STARTING',
      details: { startup: { elapsedMs: elapsed, progressCount: Math.floor(elapsed / 30), lastProgressAgeMs: 0 } } }),
    stop: async () => { stoppedAt = elapsed; },
    entries: new Map(),
  };
  await f.migration.verifyRuntime();
  assert.equal(elapsed, 45000);
  assert.equal(stoppedAt, 45000);
  assert.equal(f.migration.phase, 'ROLLED_BACK');
  assert.equal(f.objects.get('system.adapter.nexowatt-devices.0').common.enabled, true);
  assert.equal(f.migration.journal.code, 'EOS_MIGRATION_NEW_RUNTIME_FAILED');
  console.log(JSON.stringify({ outcome: 'BUG_REPRODUCED', virtualElapsedMs: elapsed,
    runtimeWouldFinishAtMs: 60000, hostDevicesTotalBudgetMs: 120000,
    reason: f.migration.journal.code, migrationPhase: f.migration.phase,
    restoredOldAdapter: true, method: 'actual migration coordinator; fake monotonic clock and host progress status; in-memory controller fixture' }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
