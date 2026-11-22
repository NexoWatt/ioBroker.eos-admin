/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Reproduziert Fehleroffenlegung gegen den echten lokalen Express-Server.
 * Wirkung: Nur Loopback, künstliche ioBroker-Konten und synthetische Fehlermarker.
 * --source transpiliert die geänderten Originalquellen ausschließlich im Speicher.
 * Ohne Option werden die ausgelieferten JS-Dateien geprüft. Keine Hardwarewrites.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const sourceMode = process.argv.includes('--source');
const originalJs = Module._extensions['.js'];
const originalTs = Module._extensions['.ts'];
const sourceHelper = path.join(root, 'src-ts/runtime-executables/lib/http-error-boundary.ts');
if (sourceMode) {
  const ts = require('typescript');
  const compile = (filename) => ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    fileName: filename,
  }).outputText;
  Module._extensions['.ts'] = (mod, filename) => {
    if (filename !== sourceHelper) {
      if (originalTs) return originalTs(mod, filename);
      throw new Error('Unexpected test source');
    }
    return mod._compile(compile(filename), filename);
  };
  Module._extensions['.js'] = (mod, filename) => {
    const relative = path.relative(root, filename).split(path.sep).join('/');
    if (!['main.js', 'lib/dynamic-grid-config-api.js', 'lib/nvp-config-api.js', 'lib/mesh-coordinator.js', 'lib/mesh-coordinator-contract.js', 'lib/mesh-energy-service.js', 'ems/nexologic-engine.js'].includes(relative)) return originalJs(mod, filename);
    const source = compile(path.join(root, 'src-ts/runtime-executables', relative.replace(/\.js$/, '.ts')))
      .replace(/require\(['"](?:\.\.?\/lib\/|\.\/)http-error-boundary['"]\)/g, `require(${JSON.stringify(sourceHelper)})`);
    return mod._compile(source, filename);
  };
}
const { safeHttpFailure, safeConfigurationFailure, createPublicHttpError, safeSourceFailureCode } = require(sourceMode ? sourceHelper : '../lib/http-error-boundary');
const { createHarness } = require('./verify-stable-1.0.9-access.cjs');
const { MeshCoordinator } = require('../lib/mesh-coordinator');
const meshContract = require('../lib/mesh-coordinator-contract');
Module._extensions['.js'] = originalJs;
if (originalTs) Module._extensions['.ts'] = originalTs;
else delete Module._extensions['.ts'];
let cases = 0;
const checks = [];
async function test(name, fn) { await fn(); cases += 1; checks.push(name); }
async function run() {
  await test('unknown-errors-and-accessors-are-not-inspected', () => {
    let getterCalls = 0;
    const accessor = Object.defineProperty({}, 'type', { get() { getterCalls++; throw new Error('private'); } });
    const proxy = new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('private'); } });
    for (const error of [null, undefined, 'private', 42, new Error('private'), accessor, proxy]) {
      const value = safeHttpFailure(error);
      assert.equal(value.status, 500); assert.equal(value.body.error, 'internal_error');
      assert(Object.isFrozen(value)); assert(Object.isFrozen(value.body));
    }
    assert.equal(getterCalls, 0);
  });
  await test('parser-types-have-finite-public-policies', () => {
    for (const [type, status] of [['entity.too.large', 413], ['entity.parse.failed', 400], ['request.aborted', 400], ['request.size.invalid', 400], ['charset.unsupported', 415], ['encoding.unsupported', 415]]) {
      assert.equal(safeHttpFailure({ type, message: 'private', stack: 'private', body: 'private' }).status, status);
      assert(!JSON.stringify(safeHttpFailure({ type })).includes('private'));
    }
    assert.equal(safeHttpFailure(Object.create({ type: 'entity.parse.failed' })).status, 500);
  });
  await test('only-internal-errors-retain-frozen-public-validation', () => {
    const spoof = Object.assign(new Error('SYNTHETIC_PRIVATE_ERROR_MARKER'), { status: 409, code: 'DYNAMIC_GRID_VERSION_CONFLICT', details: ['private'] });
    assert.equal(safeConfigurationFailure(spoof).status, 500);
    const issue = { path: 'points.M1.measurement', code: 'unit', message: 'Einheit W oder kW erforderlich.' };
    const known = createPublicHttpError(422, 'DYNAMIC_GRID_CONFIG_INVALID', 'Konfiguration ist ungültig.', [issue]);
    issue.message = 'SYNTHETIC_PRIVATE_ERROR_MARKER'; known.message = 'SYNTHETIC_PRIVATE_ERROR_MARKER'; known.status = 500;
    const result = safeConfigurationFailure(known);
    assert.equal(result.status, 422); assert.equal(result.body.details[0].code, 'unit');
    assert.equal(Object.isFrozen(result.body.details[0]), true); assert(!JSON.stringify(result).includes('SYNTHETIC'));
    assert.equal(safeSourceFailureCode(spoof), 'STATE_LOOKUP_FAILED');
    assert.equal(safeSourceFailureCode(new Error('ALIAS_CYCLE_OR_DEPTH')), 'ALIAS_CYCLE_OR_DEPTH');
  });
  const previousEnvironment = process.env.NODE_ENV;
  try {
    for (const environment of ['unset', 'production']) {
      if (environment === 'unset') delete process.env.NODE_ENV; else process.env.NODE_ENV = environment;
      const h = await createHarness();
      try {
        await test(`${environment}:anonymous-malformed-json-is-sanitized`, async () => {
          const response = await fetch(h.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"SYNTHETIC_PRIVATE_ERROR_MARKER":' });
          const text = await response.text();
          assert.equal(response.status, 400); assert.match(response.headers.get('content-type'), /application\/json/);
          assert.equal(JSON.parse(text).error, 'invalid_json'); assert.equal(response.headers.get('cache-control'), 'no-store');
          assert(!/SyntaxError|node_modules|SYNTHETIC_PRIVATE_ERROR_MARKER|\.cjs:\d|\.js:\d/.test(text));
        });
        await test(`${environment}:anonymous-protected-payload-stays-unauthorized`, async () => {
          const response = await h.request('/api/license/save', { method: 'POST', body: { filler: 'x'.repeat(70 * 1024) } });
          assert.equal(response.status, 401); assert.equal(response.data.error, 'authentication_required');
          assert(!/SyntaxError|node_modules|filler|\.cjs:\d|\.js:\d/.test(response.text));
        });
        const adminToken = await h.login('admin');
        await test(`${environment}:authorized-oversized-json-remains-413`, async () => {
          // Die vorgelagerte Auth-/CSRF-Grenze bleibt aktiv. Nur eine echte
          // HTTP-Sitzung darf den nachfolgenden 64-KiB-Routenparser erreichen.
          const response = await h.request('/api/license/save', { token: adminToken, method: 'POST', body: { filler: 'x'.repeat(70 * 1024) } });
          assert.equal(response.status, 413); assert.equal(response.data.error, 'payload too large');
          assert(!/SyntaxError|node_modules|filler|\.cjs:\d|\.js:\d/.test(response.text));
        });
        const token = await h.login('installer');
        await test(`${environment}:unexpected-simulation-error-is-sanitized`, async () => {
          h.adapter.nwSimListInstances = async () => { throw new Error('SYNTHETIC_PRIVATE_ERROR_MARKER'); };
          const response = await h.request('/api/sim/discover', { token });
          assert.equal(response.status, 500); assert.equal(response.data.error, 'internal_error');
          assert(!response.text.includes('SYNTHETIC_PRIVATE_ERROR_MARKER'));
        });
        await test(`${environment}:foreign-installer-errors-and-logs-are-sanitized`, async () => {
          const previousPersist = h.adapter.persistInstallerConfigToState;
          const previousWarn = h.adapter.log.warn;
          const logs = [];
          h.adapter.log.warn = value => logs.push(String(value));
          h.adapter.persistInstallerConfigToState = async () => { throw Object.assign(new Error('SYNTHETIC_PRIVATE_ERROR_MARKER'), { status: 400, code: 'DYNAMIC_GRID_CONFIG_INVALID', details: ['SYNTHETIC_PRIVATE_DETAIL'] }); };
          try {
            const response = await h.request('/api/installer/config', { token, method: 'POST', body: { patch: {}, restartEms: false } });
            assert.equal(response.status, 500); assert.equal(response.data.error, 'internal_error');
            assert(!response.text.includes('SYNTHETIC')); assert(!JSON.stringify(logs).includes('SYNTHETIC'));
          } finally { h.adapter.persistInstallerConfigToState = previousPersist; h.adapter.log.warn = previousWarn; }
        });
        await test(`${environment}:owned-mesh-guidance-remains-public-but-spoofs-do-not`, async () => {
          const previousCoordinator = h.adapter._meshCoordinator;
          const previousApps = h.adapter.config.emsApps;
          const previousLicense = h.adapter._nwLicenseAllowsAppId;
          const coordinator = new MeshCoordinator(h.adapter);
          coordinator.initialized = true;
          h.adapter._meshCoordinator = coordinator;
          h.adapter._nwLicenseAllowsAppId = () => true;
          h.adapter.config.emsApps = { apps: { meshMicrogrid: { installed: true, enabled: true } } };
          try {
            coordinator.config.mode = 'active';
            const savedBefore = h.saved.length;
            for (const url of ['/api/installer/config', '/api/installer/backup/import']) {
              const body = { patch: { emsApps: { apps: { meshMicrogrid: { installed: false, enabled: false } } } }, restartEms: false };
              const response = await h.request(url, { token, method: 'POST', body });
              assert.equal(response.status, 409); assert.match(response.data.message, /Stillsetzung/);
              assert.equal(response.data.error, 'MESH_APP_PROTECTED');
            }
            assert.equal(h.saved.length, savedBefore);
            const previousAssert = coordinator.assertAppChange;
            coordinator.assertAppChange = () => { throw Object.assign(new Error('SYNTHETIC_MESH_SECRET'), { status: 409, code: 'MESH_APP_PROTECTED' }); };
            for (const url of ['/api/installer/config', '/api/installer/backup/import']) {
              const response = await h.request(url, { token, method: 'POST', body: { patch: {}, restartEms: false } });
              assert.equal(response.status, 500); assert(!response.text.includes('SYNTHETIC'));
            }
            coordinator.assertAppChange = previousAssert;
            coordinator.config.mode = 'diagnostic';
            for (const [suffix, body, hint] of [
              ['/config', { config: { role: 'invalid' } }, /Rolle muss/],
              ['/pair', {}, /Paarung nur/],
              ['/operating', {}, /Trafo-Master nicht bereit/],
              ['/accounting', { meter: { unit: 'invalid' } }, /Zählereinheit/],
              ['/accounting/report', { nodeId: 'missing' }, /archive_node_unknown/],
              ['/accounting/records', { nodeId: 'missing' }, /Unbekanntes Haus/],
            ]) {
              const response = await h.request('/api/mesh/coordinator' + suffix, { token, method: 'POST', body });
              assert.equal(response.status, 422); assert.match(response.data.message, hint);
            }
            coordinator.locked = true;
            let response = await h.request('/api/mesh/coordinator/config', { token, method: 'POST', body: { config: meshContract.defaultConfig() } });
            assert.equal(response.status, 422); assert.match(response.data.message, /Stillsetzung/);
            coordinator.configure = async () => { throw Object.assign(new Error('SYNTHETIC_MESH_SECRET'), { status: 422, code: 'MESH_CONFIG_PROTECTED' }); };
            response = await h.request('/api/mesh/coordinator/config', { token, method: 'POST', body: { config: meshContract.defaultConfig() } });
            assert.equal(response.status, 500); assert(!response.text.includes('SYNTHETIC'));
          } finally {
            coordinator.stop(); coordinator.agents['http:'].destroy(); coordinator.agents['https:'].destroy();
            coordinator.archiveAgents['http:'].destroy(); coordinator.archiveAgents['https:'].destroy();
            h.adapter._meshCoordinator = previousCoordinator; h.adapter.config.emsApps = previousApps; h.adapter._nwLicenseAllowsAppId = previousLicense;
          }
        });
        await test(`${environment}:owned-simulator-preconditions-retain-guidance`, async () => {
          const previousRead = h.adapter.getStateAsync;
          const previousList = h.adapter.nwSimListInstances;
          const previousPick = h.adapter.nwSimPickDefaultInstance;
          const previousBackup = h.adapter.nwSimReadBackupPatchFromState;
          const previousWrite = h.adapter.nwSimWriteStatus;
          h.adapter.nwSimWriteStatus = async () => {};
          try {
            h.adapter.getStateAsync = async id => id === 'simulation.backupConfigJson' ? { val: '{}' } : previousRead.call(h.adapter, id);
            let response = await h.request('/api/sim/enable', { token, method: 'POST', body: {} });
            assert.equal(response.status, 500); assert.equal(response.data.error, 'SIMULATION_BACKUP_EXISTS'); assert.match(response.data.message, /disable simulation/);
            h.adapter.getStateAsync = previousRead;
            h.adapter.nwSimListInstances = async () => [];
            h.adapter.nwSimPickDefaultInstance = async () => '';
            response = await h.request('/api/sim/enable', { token, method: 'POST', body: {} });
            assert.equal(response.status, 500); assert.equal(response.data.error, 'SIMULATION_INSTANCE_NOT_FOUND');
            h.adapter.nwSimReadBackupPatchFromState = async () => null;
            response = await h.request('/api/sim/disable', { token, method: 'POST', body: {} });
            assert.equal(response.status, 500); assert.equal(response.data.error, 'SIMULATION_BACKUP_NOT_FOUND');
          } finally { h.adapter.getStateAsync = previousRead; h.adapter.nwSimListInstances = previousList; h.adapter.nwSimPickDefaultInstance = previousPick; h.adapter.nwSimReadBackupPatchFromState = previousBackup; h.adapter.nwSimWriteStatus = previousWrite; }
        });
        await test(`${environment}:nexologic-validation-has-identity-and-safe-logs`, async () => {
          const previousReplace = h.adapter.replaceLogicEngine;
          const previousWarn = h.adapter.log.warn;
          const logs = [];
          h.adapter.log.warn = value => logs.push(String(value));
          try {
            let trusted;
            try { await h.adapter.initLogicEngine(true, { version: 1, graphs: [{ id: 'g', nodes: [{ id: 'n', type: 'UNKNOWN_TYPE' }], links: [] }] }); } catch (error) { trusted = error; }
            assert(trusted); assert.equal(safeConfigurationFailure(trusted).status, 400);
            h.adapter.replaceLogicEngine = async () => { throw trusted; };
            let response = await h.request('/api/logic/editor', { token, method: 'POST', body: { config: { version: 1, graphs: [] } } });
            assert.equal(response.status, 400); assert.equal(response.data.error, 'NEXOLOGIC_CONFIG_INVALID');
            assert(response.data.issues.some(issue => issue.code === 'node-type-unknown'));
            assert(!response.text.includes('UNKNOWN_TYPE'));
            h.adapter.replaceLogicEngine = async () => { throw Object.assign(new Error('SYNTHETIC_LOGIC_SECRET'), { code: 'NEXOLOGIC_CONFIG_INVALID', issues: [{ message: 'SYNTHETIC_LOGIC_ISSUE' }] }); };
            response = await h.request('/api/logic/editor', { token, method: 'POST', body: { config: { version: 1, graphs: [] } } });
            assert.equal(response.status, 500); assert.deepEqual(response.data.issues, []);
            assert(!response.text.includes('SYNTHETIC')); assert(!JSON.stringify(logs).includes('SYNTHETIC'));
          } finally { h.adapter.replaceLogicEngine = previousReplace; h.adapter.log.warn = previousWarn; }
        });
        await test(`${environment}:simulation-status-scrubs-new-and-historical-errors`, async () => {
          const previousEnable = h.adapter.nwSimEnable;
          const previousDisable = h.adapter.nwSimDisable;
          const previousWrite = h.adapter.nwSimWriteStatus;
          const previousRead = h.adapter.getStateAsync;
          let storedError = 'SYNTHETIC_HISTORICAL_ERROR';
          h.adapter.nwSimWriteStatus = async update => { if (update.lastError !== undefined) storedError = update.lastError; };
          h.adapter.getStateAsync = async id => id === 'simulation.lastError' ? { val: storedError } : previousRead.call(h.adapter, id);
          h.adapter.nwSimEnable = h.adapter.nwSimDisable = async () => { throw new Error('SYNTHETIC_PRIVATE_ERROR_MARKER'); };
          try {
            let response = await h.request('/api/sim/status', { token });
            assert.equal(response.data.lastError, 'internal_error'); assert(!response.text.includes('SYNTHETIC'));
            for (const known of ['SIMULATION_BACKUP_EXISTS', 'SIMULATION_INSTANCE_NOT_FOUND', 'SIMULATION_BACKUP_NOT_FOUND']) {
              storedError = known; response = await h.request('/api/sim/status', { token }); assert.equal(response.data.lastError, known);
            }
            for (const action of ['enable', 'disable']) {
              response = await h.request('/api/sim/' + action, { token, method: 'POST', body: { instanceId: 'nexowatt-sim.0' } });
              assert.equal(response.status, 500); assert(!response.text.includes('SYNTHETIC')); assert.equal(storedError, 'internal_error');
              response = await h.request('/api/sim/status', { token });
              assert.equal(response.data.lastError, 'internal_error'); assert(!response.text.includes('SYNTHETIC'));
            }
          } finally { h.adapter.nwSimEnable = previousEnable; h.adapter.nwSimDisable = previousDisable; h.adapter.nwSimWriteStatus = previousWrite; h.adapter.getStateAsync = previousRead; }
        });
        await test(`${environment}:propagated-route-error-is-sanitized`, async () => {
          h.adapter._meshCoordinator = { appState: () => ({ installed: true }), publicConfig: () => { throw new Error('SYNTHETIC_PRIVATE_ERROR_MARKER'); } };
          const response = await h.request('/api/mesh/coordinator', { token });
          assert.equal(response.status, 500); assert.equal(response.data.error, 'internal_error');
          assert(!response.text.includes('SYNTHETIC_PRIVATE_ERROR_MARKER'));
        });
        await test(`${environment}:server-and-auth-remain-functional`, async () => {
          const status = await h.request('/api/strict-auth/status', { token });
          assert.equal(status.status, 200); assert.equal(status.data.role, 'installer');
          const denied = await h.request('/api/sim/discover');
          assert.equal(denied.status, 401);
        });
      } finally { await h.close(); }
    }
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnvironment;
  }
  console.log(JSON.stringify({ suite: 'NW-HTTP-ERROR-01', sourceMode, node: process.version, passed: cases,
    environment: 'real loopback Express HTTP; mocked ioBroker; synthetic errors; no devices', checks }, null, 2));
}
run().catch(() => { console.error('HTTP error boundary regression failed (details withheld).'); process.exitCode = 1; });
