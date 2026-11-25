'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');
const ts = require('typescript');
const baseDir = path.resolve(__dirname, '..');
const compiled = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-ui-codec-'));
for (const name of ['eosUiProcess', 'eosUiProcessWorker', 'eosUiProcessRpc', 'eosUiSecretCodec']) {
  fs.writeFileSync(path.join(compiled, `${name}.js`), ts.transpileModule(fs.readFileSync(path.join(baseDir, 'src/lib', `${name}.ts`), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText);
}
// This executor has the real controller SDK, but no installed controller. Only its
// package filesystem locator is supplied; encryption/decryption execute original SDK exports.
const controllerPackage = path.join(compiled, 'controller-package.json');
fs.writeFileSync(controllerPackage, JSON.stringify({ name: 'iobroker.js-controller' }));
const originalResolve = Module._resolveFilename;
let controller;
try {
  Module._resolveFilename = function (id, ...args) { return id === 'iobroker.js-controller/package.json' ? controllerPackage : originalResolve.call(this, id, ...args); };
  controller = require('@iobroker/js-controller-common-db/tools');
} finally { Module._resolveFilename = originalResolve; }
const { createUiSecretCodec } = require(path.join(compiled, 'eosUiSecretCodec'));
const { createEosUiProcess } = require(path.join(compiled, 'eosUiProcess'));
const influx = require('../ui/lib/influx-config');
test.after(() => fs.rmSync(compiled, { recursive: true, force: true }));
const key = 'c'.repeat(48);
test('AES and legacy envelopes round-trip in both directions against the actual controller SDK', () => {
  for (const secret of [key, 'legacy-system-secret']) for (const value of ['fixture-token', 'Grüße € 🔋', 'x'.repeat(65536), 'ä'.repeat(32000)]) {
    const codec = createUiSecretCodec(secret);
    assert.equal(codec.decrypt(controller.encrypt(secret, value)), value);
    const encrypted = codec.encrypt(value);
    assert.equal(controller.decrypt(secret, encrypted), value); assert.equal(codec.decrypt(encrypted), value);
    if (secret === key) assert.match(encrypted, /^\$\/aes-192-cbc:[a-f0-9]{32}:[a-f0-9]+$/);
  }
  assert.throws(() => createUiSecretCodec(key).encrypt('ä'.repeat(40000)), /SECRET_INVALID/);
});
test('missing system secret and malformed ciphertext fail without plaintext fallback', () => {
  for (const secret of [undefined, null, '', 1]) {
    assert.throws(() => createUiSecretCodec(secret).encrypt('fixture-token'), /SECRET_UNAVAILABLE/);
    assert.throws(() => createUiSecretCodec(secret).decrypt('fixture-token'), /SECRET_UNAVAILABLE/);
  }
  assert.throws(() => createUiSecretCodec(key).decrypt('$/aes-192-cbc:ff:00'), /SECRET_INVALID/);
});
test('existing encrypted Influx config works through the actual child owner codec; absent secret quarantines credentials', async t => {
  const runtimePath = path.join(compiled, 'credential-runtime.cjs');
  fs.writeFileSync(runtimePath, `const influx=require(${JSON.stringify(path.join(baseDir, 'ui/lib/influx-config.js'))});
exports.createHostedRuntime=(owner)=>({async start(){},async stop(){},async startOperational(){},status(){return{}},handle(_q,_s,next){next()},
async reconcileDeviceEms([input]){return input.operation==='protect'?influx.protectInfluxHistoryConfig(input.config,owner):influx.restoreInfluxHistoryConfig(input.config,owner)}});`);
  const config = { history: { provider: 'influxdb2', influxdb2: { url: 'https://history.example.test:8086', organization: 'home', bucket: 'energy', token: 'fixture-history-token-0123456789' } } };
  const sdkCodec = { encrypt: value => controller.encrypt(key, value), decrypt: value => controller.decrypt(key, value) };
  const stored = influx.protectInfluxHistoryConfig(config, sdkCodec);
  const makeRuntime = async secret => {
    const owner = { namespace: 'eos-admin.0', instance: 0, config: { eosUi: {} }, getForeignObjectAsync: async () => ({ native: { secret } }) };
    const bridge = { canWrite: () => true, originAllowed: () => false, getLicense: () => ({ valid: false }), resolveAccess: async () => null };
    const runtime = createEosUiProcess(owner, bridge, { baseDir, runtimePath, workerPath: path.join(compiled, 'eosUiProcessWorker.js') });
    t.after(() => runtime.stop()); await runtime.start(); return runtime;
  };
  const runtime = await makeRuntime(key);
  const restored = await runtime.reconcileDeviceEms([{ operation: 'restore', config: stored }]);
  assert.equal(restored.history.influxdb2.token, config.history.influxdb2.token);
  const fromChild = await runtime.reconcileDeviceEms([{ operation: 'protect', config }]);
  assert.equal(influx.restoreInfluxHistoryConfig(fromChild, sdkCodec).history.influxdb2.token, config.history.influxdb2.token);
  const missing = await makeRuntime(undefined);
  const quarantined = await missing.reconcileDeviceEms([{ operation: 'restore', config: stored }]);
  assert.equal(quarantined.history.influxdb2.token, undefined); assert.ok(quarantined.history.credentialError);
  await assert.rejects(missing.reconcileDeviceEms([{ operation: 'protect', config }]), /EOS_INFLUX_TOKEN_ENCRYPTION_FAILED/);
});
