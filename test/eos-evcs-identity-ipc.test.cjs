'use strict';
// Real child/owner IPC; isolated synthetic state only, no device commands.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const baseDir = path.resolve(__dirname, '..');
const compiled = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-identity-ack-'));
for (const name of ['eosUiProcess', 'eosUiProcessWorker', 'eosUiProcessRpc', 'eosUiSecretCodec']) {
    fs.writeFileSync(path.join(compiled, name + '.js'), ts.transpileModule(fs.readFileSync(path.join(baseDir, 'src/lib', name + '.ts'), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText);
}
const { createEosUiProcess } = require(path.join(compiled, 'eosUiProcess'));
const runtimePath = path.join(compiled, 'registry-runtime.cjs');
fs.writeFileSync(runtimePath, `exports.createHostedRuntime = (owner) => ({
    async start(){}, async startOperational(){}, async stop(){},
    status(){ return {state:'ready', active:true, emsReady:true}; },
    async reconcileDeviceEms([id]) { await owner.setForeignStateAsync(id,{val:'confirmed-registry-fixture',ack:true}); return {committed:true}; }
});`);
test.after(() => fs.rmSync(compiled, { recursive: true, force: true }));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
for (const namespace of ['eos-admin.0', 'nexowatt-ui.3']) test(`registry write waits for durable owner ACK beyond regular RPC timeout (${namespace})`, async t => {
    const id = `${namespace}.chargingManagement.controlIdentityRegistry`;
    let committed = false, entered;
    const started = new Promise(resolve => { entered = resolve; });
    const owner = { namespace: 'eos-admin.0', instance: 0,
        config: { eosUi: {}, ...(namespace !== 'eos-admin.0' ? { eosUiMigration: { preserveNamespace: true, source: namespace } } : {}) },
        log: { info() {}, warn() {}, error() {}, debug() {} },
        async getForeignObjectAsync() { return null; },
        async setForeignStateAsync(key, value) {
            assert.equal(key, id); assert.equal(value.val, 'confirmed-registry-fixture'); entered();
            await delay(2200); committed = true;
        },
    };
    const bridge = { canWrite: () => true, originAllowed: () => false, isListening: () => true,
        getLicense: () => ({ valid: true, coreEnabled: true, edition: 'home', features: ['energy'] }), resolveAccess: async () => null };
    const runtime = createEosUiProcess(owner, bridge, { baseDir, workerPath: path.join(compiled, 'eosUiProcessWorker.js'), runtimePath, restartDelayMs: 25 });
    t.after(() => runtime.stop()); await runtime.start();
    let answered = false;
    const saving = runtime.reconcileDeviceEms([id]).then(result => { answered = true; return result; });
    await started; await delay(2050);
    assert.equal(answered, false); assert.equal(committed, false);
    assert.deepEqual(await saving, { committed: true }); assert.equal(committed, true);
    assert.equal(runtime.status().process.state, 'running');
});
