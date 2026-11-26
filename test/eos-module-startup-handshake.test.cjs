'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, mkdir, writeFile, readFile, rm } = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { EosModuleProcess } = require('../src/lib/eosModuleProcess');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function fixture(t, options = {}) {
    const baseDir = await mkdtemp(join(tmpdir(), 'eos-start-handshake-'));
    const directory = join(baseDir, 'modules', 'ocpp');
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'index.js'), `
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
exports.createHostedModule = options => {
    writeFileSync(join(options.dataDir, 'constructing'), 'true');
    const deadline = performance.now() + 1200;
    while (performance.now() < deadline) {}
    return {
        async start() {
            if (options.config.startDelayMs) await new Promise(resolve => setTimeout(resolve, options.config.startDelayMs));
            writeFileSync(join(options.dataDir, 'started'), 'true');
        },
        async stop() {},
        getStatus() { return { pid: process.pid, allowed: options.canOperate() }; },
    };
};
`);
    let allowed = true;
    const failures = [];
    const runtime = new EosModuleProcess({ id: 'ocpp', baseDir, generation: 8,
        canOperate: () => allowed, onFailure: code => failures.push(code),
        ...(options.startTimeoutMs ? { startTimeoutMs: options.startTimeoutMs } : {}),
        moduleOptions: { config: { enabled: true, startDelayMs: options.startDelayMs || 0 }, dataDir: baseDir,
            adapter: { namespace: 'eos-admin.0.ocpp', instance: 0, config: {}, log: {} } } });
    t.after(async () => { await runtime.stop(); await rm(baseDir, { recursive: true, force: true }); });
    return { runtime, failures, baseDir, revoke() { allowed = false; runtime.revoke(); },
        async constructing() {
            const deadline = Date.now() + 5000;
            while (Date.now() < deadline) {
                try { await readFile(join(baseDir, 'constructing')); return; }
                catch (error) { if (error.code !== 'ENOENT') throw error; }
                await delay(10);
            }
            assert.fail('worker never entered factory construction');
        },
        async assertNotStarted() { await assert.rejects(readFile(join(baseDir, 'started')), { code: 'ENOENT' }); } };
}

test('real worker starts after a synchronous 1200ms factory using a fresh lease and unchanged watchdog', { timeout: 10000 }, async t => {
    const x = await fixture(t);
    await x.runtime.start();
    assert.deepEqual(x.failures, []);
    assert.equal(x.runtime.health().state, 'running');
    assert.notEqual(x.runtime.health().pid, process.pid);
    assert.equal((await x.runtime.getStatus()).allowed, true);
    assert.equal(await readFile(join(x.baseDir, 'started'), 'utf8'), 'true');
});

test('readiness after authority loss cannot start a module or restore its permission', { timeout: 10000 }, async t => {
    const x = await fixture(t);
    const starting = x.runtime.start().catch(error => error);
    await x.constructing();
    x.revoke();
    assert.equal((await starting).code, 'EOS_MODULE_PROCESS_INACTIVE');
    await x.runtime.stop();
    await x.assertNotStarted();
    assert.equal(x.runtime.health().pid, null);
});

test('stop during worker construction drains the process and never queues start after readiness', { timeout: 10000 }, async t => {
    const x = await fixture(t);
    const starting = x.runtime.start().catch(error => error);
    await x.constructing();
    const pid = x.runtime.health().pid;
    await x.runtime.stop();
    assert.match((await starting).code, /EOS_MODULE_PROCESS_(?:INACTIVE|DISCONNECTED)/);
    await x.assertNotStarted();
    assert.equal(x.runtime.health().pid, null);
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
});

test('factory preparation and start consume one unchanged startup deadline', { timeout: 10000 }, async t => {
    const x = await fixture(t, { startTimeoutMs: 1500, startDelayMs: 600 });
    await assert.rejects(x.runtime.start(), { code: 'EOS_MODULE_PROCESS_TIMEOUT' });
    await x.runtime.stop();
    await x.assertNotStarted();
    assert.equal(x.runtime.health().pid, null);
});
