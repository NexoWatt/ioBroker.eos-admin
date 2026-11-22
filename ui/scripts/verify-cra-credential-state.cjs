#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft Admin-ACL für Adapterkonfiguration und beide geheimnistragenden userdata-Backups.
 * Daten und Wirkung: Isolierte ioBroker-Objekt-/State-Fixtures; simuliert verweigerte und nur scheinbar erfolgreiche ACL-Migration.
 * Bei Änderungen: Erfolgreiches Rücklesen vor JSON-Write, Instanz-Namespace und Bereinigung der Fehlertexte erhalten.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { assertNvpPersistence } = require('../lib/nvp-config-api');
const { assertDynamicGridPersistence, dynamicGridAppState } = require('../lib/dynamic-grid-config-api');
const { assertPartnerPersistence } = require('../lib/partner-config-api');
const { currentPartnerConfig, defaultPartnerConfig } = require('../lib/partner-contracts');
const { createPublicHttpError } = require('../lib/http-error-boundary');
const root = path.resolve(__dirname, '..');
const filename = path.join(root, process.argv.includes('--source') ? 'src-ts/runtime-executables/main.ts' : 'main.js');
const source = fs.readFileSync(filename, 'utf8');
const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
const selected = new Set(['_nwProtectCredentialState', 'ensureInstallerStates', 'persistInstallerConfigToState', 'nwEnsureUserdataBackupObjects', 'nwWriteUserdataBackup', 'nwReadUserdataBackup', 'ensureSimulationStates', 'nwSimWriteStatus']);
const methods = [];
function visit(node) { if (ts.isMethodDeclaration(node) && selected.has(node.name.getText(ast))) methods.push(node.getText(ast)); ts.forEachChild(node, visit); }
visit(ast);
assert.equal(methods.length, selected.size);
// Die extrahierte Originalmethode behält echte NVP-, Dynamic-Grid- und Partnerprüfungen.
// Der VM-Kontext erhält dieselben ausgelieferten Helper wie der Adapterkern; keine Freigabe-Stubs.
const constructor = vm.runInNewContext(`(class { ${methods.join('\n')} })`, { pkg: { version: 'test' }, assertNvpPersistence, assertDynamicGridPersistence, dynamicGridAppState, assertPartnerPersistence, currentPartnerConfig, createPublicHttpError });
const checks = [];
const namespace = 'nexowatt-ui.7';
const current = '0_userdata.0.nexowattVis.backupJson';
const previous = '0_userdata.0.nexowattVis.backupJsonPrev';
const configId = `${namespace}.installer.configJson`;
const simulationId = `${namespace}.simulation.backupConfigJson`;
const jsonIds = [configId, current, previous, simulationId];
const goodAcl = { owner: 'system.user.admin', ownerGroup: 'system.group.administrator', object: 0x600, state: 0x600 };
function fixture() {
  const objects = new Map(jsonIds.map(id => [id, { type: 'state', common: { type: 'string', role: 'json', read: true, write: true }, acl: { state: 0x666, object: 0x666 } }]));
  const states = new Map(); const writes = []; const logs = []; const events = [];
  const instance = new constructor();
  Object.assign(instance, {
    namespace, instance: 7, config: {}, _nwPatchScore: () => 1, nwApplyInstallerPatchToRuntimeConfig: (_, patch) => patch,
    getForeignObjectAsync: async id => { events.push(`read:${id}`); return structuredClone(objects.get(id)); },
    setForeignObjectAsync: async (id, value) => { events.push(`create:${id}`); objects.set(id, structuredClone(value)); },
    extendForeignObjectAsync: async (id, value) => { events.push(`extend:${id}`); objects.set(id, { ...objects.get(id), ...structuredClone(value), common: { ...objects.get(id)?.common, ...value.common } }); },
    setObjectNotExistsAsync: async (id, value) => { const full = `${namespace}.${id}`; if (!objects.has(full)) objects.set(full, structuredClone(value)); },
    setStateAsync: async (id, value) => { const full = `${namespace}.${id}`; events.push(`write:${full}`); writes.push(full); states.set(full, value); },
    setForeignStateAsync: async (id, value) => { events.push(`write:${id}`); writes.push(id); states.set(id, value); },
    getForeignStateAsync: async id => states.get(id),
    log: { warn: value => logs.push(value) },
  });
  return { instance, objects, states, writes, logs, events };
}
async function check(name, fn) { await fn(); checks.push(name); }
(async () => {
  await check('startup-migrates-existing-config-and-both-backup-acls', async () => {
    const f = fixture(); await f.instance.ensureInstallerStates(); await f.instance.ensureSimulationStates(); assert.equal(await f.instance.nwEnsureUserdataBackupObjects(), true);
    for (const id of jsonIds) { assert.deepEqual(f.objects.get(id).acl, goodAcl); assert.equal(f.objects.get(id).common.read, false); }
    assert.equal(f.writes.length, 0);
  });
  await check('first-creation-is-restricted-and-respects-instance-namespace', async () => {
    const f = fixture(); f.objects.clear(); await f.instance.ensureInstallerStates(); await f.instance.ensureSimulationStates(); await f.instance.nwEnsureUserdataBackupObjects();
    for (const id of jsonIds) assert.deepEqual(f.objects.get(id).acl, goodAcl);
    assert.equal(f.objects.has('nexowatt-ui.0.installer.configJson'), false);
    await assert.rejects(f.instance._nwProtectCredentialState('arbitrary.state'), /credential-state-protection-failed/);
    await assert.rejects(f.instance._nwProtectCredentialState('0_userdata.0.unrelated', true), /credential-state-protection-failed/);
  });
  await check('persist-verifies-acl-before-writing-and-retains-config', async () => {
    const f = fixture(); const patch = { tariff: { credentials: { accessToken: 'TEST_ONLY_CONFIG_SECRET' } } };
    assert.equal(await f.instance.persistInstallerConfigToState(patch), true);
    assert.deepEqual(JSON.parse(f.states.get(configId).val), patch);
    assert.equal(f.events.at(-2), `read:${configId}`); assert.equal(f.events.at(-1), `write:${configId}`);
  });
  await check('partner-cas-and-dedicated-save-guards-remain-real-before-credential-write', async () => {
    const f = fixture(); f.instance.config.partnerIntegrations = defaultPartnerConfig();
    const changed = { ...defaultPartnerConfig(), partnerId: 'fixture-partner', configVersion: 2 };
    await assert.rejects(f.instance.persistInstallerConfigToState({ partnerIntegrations: changed }), { code: 'PARTNER_DEDICATED_SAVE_REQUIRED' });
    assert.equal(f.writes.length, 0);
    f.instance._nwPartnerCommitInFlight = true;
    await assert.rejects(f.instance.persistInstallerConfigToState({ partnerIntegrations: { ...changed, configVersion: 1 } }), { code: 'CONFIG_VERSION_CONFLICT' });
    assert.equal(f.writes.length, 0);
    assert.equal(await f.instance.persistInstallerConfigToState({ partnerIntegrations: changed }), true);
    assert.deepEqual(JSON.parse(f.states.get(configId).val).partnerIntegrations, changed);
    assert.deepEqual(f.objects.get(configId).acl, goodAcl);
  });
  await check('acl-failure-blocks-config-write-with-sanitized-error', async () => {
    const f = fixture(); f.instance.extendForeignObjectAsync = async () => { throw new Error('TEST_ONLY_CONFIG_SECRET'); };
    assert.equal(await f.instance.persistInstallerConfigToState({ accessToken: 'TEST_ONLY_CONFIG_SECRET' }), false);
    assert.equal(f.writes.length, 0); assert(!f.logs.join().includes('TEST_ONLY_CONFIG_SECRET'));
  });
  await check('unconfirmed-acl-update-blocks-write', async () => {
    const f = fixture(); f.instance.extendForeignObjectAsync = async () => {};
    assert.equal(await f.instance.persistInstallerConfigToState({ accessToken: 'TEST_ONLY_CONFIG_SECRET' }), false);
    assert.equal(f.writes.length, 0);
  });
  await check('backup-rotation-checks-both-targets-and-preserves-values', async () => {
    const f = fixture(); const old = JSON.stringify({ configPatch: { accessToken: 'TEST_ONLY_OLD_SECRET' } }); f.states.set(current, { val: old });
    assert.equal(await f.instance.nwWriteUserdataBackup({ accessToken: 'TEST_ONLY_NEW_SECRET' }, 'fixture'), true);
    assert.equal(f.states.get(previous).val, old);
    assert.equal(JSON.parse(f.states.get(current).val).configPatch.accessToken, 'TEST_ONLY_NEW_SECRET');
    for (const id of [current, previous]) { assert.deepEqual(f.objects.get(id).acl, goodAcl); const index = f.events.lastIndexOf(`write:${id}`); assert.equal(f.events[index - 1], `read:${id}`); }
  });
  await check('failed-protection-prevents-all-backup-credential-writes', async () => {
    const f = fixture(); f.states.set(current, { val: '{"configPatch":{"accessToken":"TEST_ONLY_OLD_SECRET"}}' });
    f.instance.extendForeignObjectAsync = async () => { throw new Error('TEST_ONLY_CONFIG_SECRET'); };
    assert.equal(await f.instance.nwWriteUserdataBackup({ accessToken: 'TEST_ONLY_NEW_SECRET' }, 'fixture'), false);
    assert.equal(f.writes.length, 0); assert(!f.logs.join().includes('TEST_ONLY_CONFIG_SECRET'));
  });
  await check('simulation-config-backup-is-protected-and-fails-closed', async () => {
    const f = fixture(); await f.instance.nwSimWriteStatus({ backupConfigJson: '{"accessToken":"TEST_ONLY_CONFIG_SECRET"}' });
    assert.deepEqual(f.objects.get(simulationId).acl, goodAcl);
    assert.equal(JSON.parse(f.states.get(simulationId).val).accessToken, 'TEST_ONLY_CONFIG_SECRET');
    const failed = fixture(); failed.instance.extendForeignObjectAsync = async () => { throw new Error('TEST_ONLY_CONFIG_SECRET'); };
    await failed.instance.nwSimWriteStatus({ backupConfigJson: 'TEST_ONLY_CONFIG_SECRET' });
    assert.equal(failed.writes.length, 0);
  });
  console.log(JSON.stringify({ suite: 'UI-CRA-SECRET-06', source: path.relative(root, filename), node: process.version, environment: 'isolated adapter object/state fixtures; no real ioBroker ACL authorization integration', passed: checks.length, checks }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
