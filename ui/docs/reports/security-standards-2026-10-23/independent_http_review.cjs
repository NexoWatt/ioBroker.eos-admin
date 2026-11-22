/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
// Separate, focused review probes. Only real local HTTP + mocked ioBroker.
// Usage: node independent_http_review.cjs <repository> <evidence.json>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const root = path.resolve(process.argv[2]);
const destination = path.resolve(process.argv[3]);
const { createHarness } = require(path.join(root, 'scripts/verify-stable-1.0.9-access.cjs'));
const { createPublicHttpError, safeConfigurationFailure } = require(path.join(root, 'lib/http-error-boundary'));
const { MeshCoordinator } = require(path.join(root, 'lib/mesh-coordinator'));
const meshContract = require(path.join(root, 'lib/mesh-coordinator-contract'));
const marker = 'SYNTHETIC_REVIEW_SECRET';
const probes = [];
async function test(name, fn) {
  const result = await fn();
  probes.push({ name, ...result, passed: true });
}
function opaque(response, expected = 500) {
  assert.equal(response.status, expected);
  assert.equal(response.data.error, 'internal_error');
  assert(!response.text.includes(marker));
}
const checkedFiles = [
  'main.js', 'lib/http-error-boundary.js', 'lib/mesh-coordinator.js',
  'lib/mesh-coordinator-contract.js', 'lib/mesh-energy-service.js',
  'ems/nexologic-engine.js', 'www/simulation.js',
  'src-ts/runtime-executables/main.ts', 'src-ts/runtime-executables/lib/http-error-boundary.ts',
  'src-ts/runtime-executables/lib/mesh-coordinator.ts',
  'src-ts/runtime-executables/lib/mesh-coordinator-contract.ts',
  'src-ts/runtime-executables/lib/mesh-energy-service.ts',
  'src-ts/runtime-executables/ems/nexologic-engine.ts',
  'src-ts/runtime-executables/www/simulation.ts',
  'scripts/build-ts-runtime-executables.js', 'scripts/verify-security-standards.cjs',
  '.github/workflows/codeql.yml', '.github/codeql/codeql-config.yml',
];
function hashes() { return checkedFiles.map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') })); }
async function run() {
  const before = hashes();
  const oldEnvironment = process.env.NODE_ENV;
  delete process.env.NODE_ENV;
  const h = await createHarness();
  try {
    const token = await h.login('installer');
    await test('spoofed status/code on installer persistence failure', async () => {
      const original = h.adapter.persistInstallerConfigToState;
      h.adapter.persistInstallerConfigToState = async () => { throw Object.assign(new Error(marker), { status: 409, code: 'DYNAMIC_GRID_VERSION_CONFLICT', details: [marker] }); };
      try {
        const response = await h.request('/api/installer/config', { token, method: 'POST', body: { patch: {}, restartEms: false } });
        opaque(response); assert(!response.data.details);
        return { status: response.status, leaked: false };
      } finally { h.adapter.persistInstallerConfigToState = original; }
    });
    const originalRead = h.adapter.getStateAsync;
    const originalEnable = h.adapter.nwSimEnable;
    const originalWrite = h.adapter.nwSimWriteStatus;
    let stored = marker;
    h.adapter.getStateAsync = async id => id === 'simulation.lastError' ? { val: stored } : originalRead.call(h.adapter, id);
    h.adapter.nwSimEnable = async () => { throw new Error(marker); };
    h.adapter.nwSimWriteStatus = async update => { if (update.lastError !== undefined) stored = update.lastError; };
    try {
      await test('historical simulation.lastError is sanitized on read', async () => {
        const response = await h.request('/api/sim/status', { token });
        assert.equal(response.status, 200); assert.equal(response.data.lastError, 'internal_error'); assert(!response.text.includes(marker));
        return { status: response.status, leaked: false };
      });
      await test('simulation failure sanitized immediately, in stored state and followup read', async () => {
        const response = await h.request('/api/sim/enable', { token, method: 'POST', body: {} });
        opaque(response); assert.equal(stored, 'internal_error');
        const status = await h.request('/api/sim/status', { token });
        assert.equal(status.status, 200); assert.equal(status.data.lastError, 'internal_error'); assert(!status.text.includes(marker));
        return { status: response.status, statusRead: status.status, leaked: false };
      });
    } finally { h.adapter.getStateAsync = originalRead; h.adapter.nwSimEnable = originalEnable; h.adapter.nwSimWriteStatus = originalWrite; }
    await test('malformed anonymous JSON with NODE_ENV unset', async () => {
      const response = await fetch(h.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"' + marker + '":' });
      const body = await response.text();
      assert.equal(response.status, 400); assert.equal(JSON.parse(body).error, 'invalid_json');
      assert(!/SYNTHETIC_REVIEW_SECRET|SyntaxError|node_modules|\.js:\d|\.cjs:\d/.test(body));
      return { status: response.status, leaked: false };
    });
    await test('partial request aborted by actual HTTP client then auth status', async () => {
      await new Promise(resolve => {
        const request = http.request(h.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': 99999 } });
        request.on('error', () => {}); request.on('close', resolve);
        request.write('{"partial":'); setTimeout(() => request.destroy(), 20);
      });
      const response = await h.request('/api/auth/status', { token });
      assert.equal(response.status, 200);
      return { status: response.status };
    });
    await test('synthetic in-memory route throws after headers; no second response or leak', async () => {
      const app = h.adapter.server.listeners('request')[0];
      app.get('/review-after-headers', (_req, res, next) => { res.setHeader('content-type', 'text/plain'); res.write('partial'); next(new Error(marker)); });
      const stack = app._router.stack;
      const layer = stack.pop();
      const boundary = stack.map(entry => entry.handle).findLastIndex(handler => handler.length === 4);
      assert(boundary >= 0); stack.splice(boundary, 0, layer);
      try {
        const response = await h.request('/review-after-headers');
        assert.equal(response.status, 200); assert.equal(response.text, 'partial');
        return { status: response.status, body: response.text, leaked: false };
      } finally { stack.splice(stack.indexOf(layer), 1); }
    });
    await test('internally created conflict retains immutable safe response', async () => {
      const error = createPublicHttpError(409, 'DYNAMIC_GRID_VERSION_CONFLICT', 'Konfiguration wurde zwischenzeitlich geändert.');
      error.message = marker; error.status = 500;
      const response = safeConfigurationFailure(error);
      assert.equal(response.status, 409); assert.equal(response.body.message, 'Konfiguration wurde zwischenzeitlich geändert.'); assert(!JSON.stringify(response).includes(marker));
      return { status: response.status, leaked: false };
    });
    await test('Mesh owned Stillsetzung guidance survives and foreign lookalike fails opaque', async () => {
      const previousCoordinator = h.adapter._meshCoordinator;
      const previousApps = h.adapter.config.emsApps;
      const previousLicense = h.adapter._nwLicenseAllowsAppId;
      const coordinator = new MeshCoordinator(h.adapter);
      coordinator.initialized = true; coordinator.config.mode = 'active';
      h.adapter._meshCoordinator = coordinator;
      h.adapter.config.emsApps = { apps: { meshMicrogrid: { installed: true, enabled: true } } };
      h.adapter._nwLicenseAllowsAppId = () => true;
      try {
        const responses = [];
        const savedBefore = h.saved.length;
        for (const url of ['/api/installer/config', '/api/installer/backup/import']) {
          const response = await h.request(url, { token, method: 'POST', body: { patch: { emsApps: { apps: { meshMicrogrid: { installed: false, enabled: false } } } }, restartEms: false } });
          assert.equal(response.status, 409); assert.equal(response.data.error, 'MESH_APP_PROTECTED'); assert.match(response.data.message, /Stillsetzung/);
          responses.push({ route: url, kind: 'owned', status: response.status });
        }
        assert.equal(h.saved.length, savedBefore);
        const originalAssert = coordinator.assertAppChange;
        coordinator.assertAppChange = () => { throw Object.assign(new Error(marker), { status: 409, code: 'MESH_APP_PROTECTED' }); };
        for (const url of ['/api/installer/config', '/api/installer/backup/import']) {
          const response = await h.request(url, { token, method: 'POST', body: { patch: {}, restartEms: false } });
          opaque(response); responses.push({ route: url, kind: 'foreign', status: response.status });
        }
        coordinator.assertAppChange = originalAssert; coordinator.config.mode = 'diagnostic'; coordinator.locked = true;
        const url = '/api/mesh/coordinator/config';
        const owned = await h.request(url, { token, method: 'POST', body: { config: meshContract.defaultConfig() } });
        assert.equal(owned.status, 422); assert.match(owned.data.message, /Stillsetzung/);
        responses.push({ route: url, kind: 'owned', status: owned.status });
        coordinator.configure = async () => { throw Object.assign(new Error(marker), { status: 422, code: 'MESH_CONFIG_PROTECTED' }); };
        const foreign = await h.request(url, { token, method: 'POST', body: { config: meshContract.defaultConfig() } });
        opaque(foreign); responses.push({ route: url, kind: 'foreign', status: foreign.status });
        return { responses, persistedOnRefusal: false, leaked: false };
      } finally {
        coordinator.stop(); for (const agents of [coordinator.agents, coordinator.archiveAgents]) { agents['http:'].destroy(); agents['https:'].destroy(); }
        h.adapter._meshCoordinator = previousCoordinator; h.adapter.config.emsApps = previousApps; h.adapter._nwLicenseAllowsAppId = previousLicense;
      }
    });
    await test('NexoLogic owned issues retained but forged code and arbitrary issues are opaque', async () => {
      const originalReplace = h.adapter.replaceLogicEngine;
      const originalWarn = h.adapter.log.warn;
      const logs = [];
      h.adapter.log.warn = value => logs.push(String(value));
      try {
        let trusted;
        try { await h.adapter.initLogicEngine(true, { version: 1, graphs: [{ id: 'g', nodes: [{ id: 'n', type: 'UNKNOWN_TYPE' }], links: [] }] }); } catch (error) { trusted = error; }
        assert(trusted); assert.equal(safeConfigurationFailure(trusted).status, 400);
        h.adapter.replaceLogicEngine = async () => { throw trusted; };
        const owned = await h.request('/api/logic/editor', { token, method: 'POST', body: { config: { version: 1, graphs: [] } } });
        assert.equal(owned.status, 400); assert.equal(owned.data.error, 'NEXOLOGIC_CONFIG_INVALID');
        assert(owned.data.issues.some(issue => issue.code === 'node-type-unknown')); assert(!owned.text.includes('UNKNOWN_TYPE'));
        h.adapter.replaceLogicEngine = async () => { throw Object.assign(new Error(marker), { code: 'NEXOLOGIC_CONFIG_INVALID', issues: [marker] }); };
        const foreign = await h.request('/api/logic/editor', { token, method: 'POST', body: { config: { version: 1, graphs: [] } } });
        opaque(foreign); assert.deepEqual(foreign.data.issues, []); assert(!JSON.stringify(logs).includes(marker));
        return { ownedStatus: owned.status, foreignStatus: foreign.status, publicIssueCode: 'node-type-unknown', leaked: false };
      } finally { h.adapter.replaceLogicEngine = originalReplace; h.adapter.log.warn = originalWarn; }
    });
  } finally {
    await h.close();
    if (oldEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldEnvironment;
  }
  const after = hashes(); assert.deepEqual(after, before, 'Sources changed during review');
  const evidence = { reviewType: 'separate KI review, not external certification', capturedAt: new Date().toISOString(), node: process.version,
    environment: 'Linux, real loopback Express, mocked ioBroker, no devices or publication',
    probeScriptSha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'), testedFiles: after, passed: probes.length, probes };
  fs.writeFileSync(destination, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ passed: probes.length, capturedAt: evidence.capturedAt, destination }));
}
run().catch(error => { console.error(error); process.exitCode = 1; });
