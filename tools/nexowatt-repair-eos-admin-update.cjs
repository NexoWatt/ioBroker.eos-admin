#!/usr/bin/env node
'use strict';
/** Explicit maintenance of legacy metadata; does not start, enable or update EOS. */
const cp = require('node:child_process');
const io = require('../io-package.json');
/** @param {string} id @param {string} property */
function run(id, property) {
  const args = ['object', 'set', id, property];
  console.log(`iobroker ${args.join(' ')}`);
  cp.execFileSync('iobroker', args, { stdio: 'inherit', shell: false, timeout: 30_000 });
}
try {
  if (process.platform !== 'linux' || io.common?.stopBeforeUpdate !== true) {
    throw new Error('EOS_UPDATE_METADATA_UNSUPPORTED');
  }
  run('system.adapter.eos-admin', `common.stopBeforeUpdate=${io.common.stopBeforeUpdate}`);
  for (const id of ['system.adapter.eos-admin', 'system.adapter.eos-admin.0']) {
    run(id, 'common.dontDelete=false');
    run(id, 'common.nondeletable=false');
  }
  console.log('EOS legacy metadata commands completed. Instance enable flags and configuration were not changed.');
  console.log('This is not an update or a restart check; inspect the controller result of any subsequent update.');
} catch {
  console.error('EOS_UPDATE_METADATA_REPAIR_FAILED: Stopped at the failed command. Earlier metadata writes may already have applied.');
  process.exitCode = 1;
}
