'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readPreservedUiStates } = require('../../lib/preserved-ui-config');
const { createHarness } = require('./http-harness.cjs');

function reader(state, object = null) {
  return {
    getForeignObjectAsync: async id => id.endsWith('.installer.configJson') ? object : null,
    getForeignStateAsync: async id => id.endsWith('.installer.configJson') ? state : null,
  };
}

test('preserved UI rejects damaged, unsafe and oversized JSON without reflecting values', async () => {
  for (const val of ['broken-private-marker', '[]', 'null', 'true', '{"smartHomeConfig":{"rooms":{}}}',
    '{"smartHome":{"__proto__":{"enabled":true}}}', JSON.stringify({ private: 'x'.repeat(512 * 1024) })]) {
    await assert.rejects(readPreservedUiStates(reader({ val }), 'nexowatt-ui.0'), error =>
      error.code === 'EOS_MIGRATION_UI_STATE_INVALID' && !error.message.includes('private-marker'));
  }
});

test('absent optional timers and their original empty defaults remain valid; known lost data blocks', async () => {
  const source = reader(null);
  assert.deepEqual((await readPreservedUiStates(source, 'nexowatt-ui.0')).requiredStates, []);
  source.getForeignStateAsync = async id => id.endsWith('.installer.configJson') ? null : { val: '' };
  assert.deepEqual((await readPreservedUiStates(source, 'nexowatt-ui.0')).requiredStates, []);
  await assert.rejects(readPreservedUiStates(source, 'nexowatt-ui.0', ['smarthome.timersJson']), /EOS_MIGRATION_UI_STATE_INVALID/);
  await assert.rejects(readPreservedUiStates(reader(null, { type: 'state' }), 'nexowatt-ui.0'), /EOS_MIGRATION_UI_STATE_UNAVAILABLE/);
  await assert.rejects(readPreservedUiStates(reader(null), 'nexowatt-ui.0', ['installer.configJson']), /EOS_MIGRATION_UI_STATE_UNAVAILABLE/);
});

test('unavailable database and timeout fail with fixed errors before a migration can continue', async () => {
  const unavailable = reader(null);
  unavailable.getForeignStateAsync = async () => { throw new Error('private-credential-fragment'); };
  await assert.rejects(readPreservedUiStates(unavailable, 'nexowatt-ui.0'), error => error.message === 'EOS_MIGRATION_UI_STATE_UNAVAILABLE');
  const hanging = reader(null);
  hanging.getForeignStateAsync = async () => new Promise(() => {});
  await assert.rejects(readPreservedUiStates(hanging, 'nexowatt-ui.0'), /EOS_MIGRATION_UI_STATE_TIMEOUT/);
});

test('migrated runtime never hydrates global userdata from a different old UI instance', async t => {
  const h = await createHarness({ legacyNamespace: 'nexowatt-ui.0' }); t.after(() => h.close());
  h.adapter.config = { smartHome: { enabled: false }, smartHomeConfig: { version: 3, floors: [], rooms: [], devices: [] } };
  h.states.set('nexowatt-ui.0.installer.configJson', { val: '{}', ack: true });
  let backupReads = 0;
  h.adapter.nwReadUserdataBackup = async () => {
    backupReads++;
    return { instance: 9, configPatch: { smartHomeConfig: { rooms: [{ id: 'wrong-customer' }] } } };
  };
  await h.adapter.loadInstallerConfigFromState();
  assert.equal(backupReads, 0);
  assert.deepEqual(h.adapter.config.smartHomeConfig.rooms, []);
});

test('migrated runtime rejects damaged installer, timer and clock data before replacing active configuration', async t => {
  for (const id of ['installer.configJson', 'smarthome.timersJson', 'smarthome.logicClocksJson']) {
    const h = await createHarness({ legacyNamespace: 'nexowatt-ui.0' });
    try {
      const original = structuredClone(h.adapter.config);
      h.states.set(`nexowatt-ui.0.${id}`, { val: '{broken', ack: true });
      await assert.rejects(h.adapter.loadInstallerConfigFromState(), /EOS_MIGRATION_UI_STATE_INVALID/);
      await assert.rejects(h.adapter.loadSmartHomeTimersFromState(), /EOS_MIGRATION_UI_STATE_INVALID/);
      await assert.rejects(h.adapter.loadSmartHomeLogicClocksFromState(), /EOS_MIGRATION_UI_STATE_INVALID/);
      assert.deepEqual(h.adapter.config, original);
      assert.equal(h.saved.length, 0);
    } finally { await h.close(); }
  }
});
