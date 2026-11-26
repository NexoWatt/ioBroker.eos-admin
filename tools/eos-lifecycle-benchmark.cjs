'use strict';

// Synthetic host event workload only. This measures controller work and epoch
// churn; it is not a measurement of Raspberry Pi RAM or physical hardware.
const { resolve } = require('node:path');
const { performance } = require('node:perf_hooks');
const { EosModuleHost } = require(resolve(process.argv[2] || '.', 'src/lib/eosModuleHost.js'));

async function main() {
    let ownershipReads = 0, reconciliations = 0, revocations = 0, moduleCreates = 0;
    const factory = {
        validateConfig: config => ({ ...config, enabled: config.enabled === true }),
        createHostedModule() { moduleCreates++; throw new Error('disabled module must not be created'); },
    };
    const ids = ['devices', 'eebus', 'backup', 'ocpp'];
    const owner = {
        namespace: 'eos-admin.0', instance: 0,
        config: { eosModules: Object.fromEntries(ids.map(id => [id, { v: 1, encrypted: '{"enabled":false}' }])) },
        log: { warn() {} }, decrypt: value => value,
        eosLicenseService: { allowsEmbeddedModule: () => true }, eosOwnership: { canWrite: () => true },
        async getForeignObjectAsync() { return null; },
        async getObjectViewAsync() { ownershipReads++; return { rows: [] }; },
        async subscribeForeignObjectsAsync() {}, async subscribeForeignStatesAsync() {}, async unsubscribeForeignStatesAsync() {},
    };
    const host = new EosModuleHost(owner, { baseDir: '.', dataDir: '/tmp/eos-event-benchmark', factories: Object.fromEntries(ids.map(id => [id, factory])) });
    await host.start();
    // No idle timer ticks enter this synchronous event workload.
    clearInterval(host.timer);
    const originalReconcile = host.reconcile.bind(host), originalRevoke = host.revoke.bind(host);
    host.reconcile = (...args) => { reconciliations++; return originalReconcile(...args); };
    host.revoke = (...args) => { revocations++; return originalRevoke(...args); };
    const snapshot = () => ({ generation: host.entries.get('ocpp').generation, ownershipReads, reconciliations, revocations, moduleCreates });
    const results = [];
    for (const workload of ['external-alive', 'irrelevant-state-object']) {
        const before = snapshot(), started = performance.now();
        for (let event = 0; event < 459; event++) {
            if (workload === 'external-alive') host.onStateChange('system.adapter.ocpp21.0.alive', { val: true, ack: true, ts: Date.now() });
            else host.onObjectChange('system.adapter.ocpp21.0.alive');
        }
        await new Promise(resolve => setImmediate(resolve));
        await host.pending;
        const after = snapshot();
        results.push({ workload, events: 459, elapsedMs: Number((performance.now() - started).toFixed(3)),
            counts: Object.fromEntries(Object.keys(before).map(key => [key, after[key] - before[key]])) });
    }
    await host.stop();
    process.stdout.write(JSON.stringify({ node: process.version, synthetic: true, results }, null, 2) + '\n');
}

main().catch(error => { process.stderr.write(`${error.code || error.message}\n`); process.exitCode = 1; });
