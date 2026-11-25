'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Module } = require('node:module');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const root = '/workspace/scratch/741f792566ea/source-921/iobroker.eos-admin';
let helpers;
async function loadHelpers() {
    if (!helpers) {
        const filename = path.join(root, 'test/eos-customer-update-worker.test.cjs');
        let code = await fs.readFile(filename, 'utf8');
        code = code.slice(0, code.indexOf("test('worker refuses"));
        code += '\nmodule.exports = { fixture, loadWorker, workerCode };\n';
        const mod = new Module(filename, module);
        mod.filename = filename;
        mod.paths = Module._nodeModulePaths(path.dirname(filename));
        mod._compile(code, filename);
        helpers = mod.exports;
    }
    return helpers;
}

test('independent: competing copies admit exactly one installation', async t => {
    const { fixture, loadWorker } = await loadHelpers();
    const f = await fixture(t);
    const { runEosCustomerUpdateWorker } = await loadWorker();
    const outcomes = await Promise.allSettled([
        runEosCustomerUpdateWorker(f.directory),
        runEosCustomerUpdateWorker(f.directory),
    ]);
    assert.equal(outcomes.filter(r => r.status === 'fulfilled' && r.value.status === 'succeeded').length, 1);
    const failure = outcomes.find(r => r.status === 'rejected');
    assert.equal(failure.reason.code, 'EEXIST');
    assert.equal((await f.readTrace()).filter(args => args[0] === 'url').length, 1);
});

test('independent: preexisting claim does not replay or replace the old result', async t => {
    const { fixture, loadWorker } = await loadHelpers();
    const f = await fixture(t);
    await fs.writeFile(path.join(f.directory, 'worker.claim'), '', { mode: 0o600 });
    const old = JSON.stringify({ status: 'uncertain', phase: 'installing' });
    await fs.writeFile(path.join(f.directory, 'result.json'), old, { mode: 0o600 });
    await assert.rejects((await loadWorker()).runEosCustomerUpdateWorker(f.directory), { code: 'EEXIST' });
    assert.equal(await fs.readFile(path.join(f.directory, 'result.json'), 'utf8'), old);
    assert.deepEqual(await f.readTrace(), []);
});

test('independent: CLI output bound fails before install and redacts payload', async t => {
    const { fixture, loadWorker } = await loadHelpers();
    const f = await fixture(t);
    const cli = path.join(f.controllerDir, 'iobroker.js');
    const original = await fs.readFile(cli, 'utf8');
    await fs.writeFile(cli, original.replace("if(args[0]==='stop'){", "if(args[0]==='stop'){process.stdout.write('SECRET_FIXTURE'.repeat(200000));"));
    const result = await (await loadWorker()).runEosCustomerUpdateWorker(f.directory);
    assert.equal(result.status, 'failed');
    assert.equal(result.error, 'EOS_UPDATE_COMMAND_OUTPUT_LIMIT');
    assert.equal((await f.readTrace()).some(args => args[0] === 'url'), false);
    assert.equal((await fs.readFile(path.join(f.directory, 'result.json'), 'utf8')).includes('SECRET_FIXTURE'), false);
});

test('independent: oversized sparse archive and snapshot are refused before stop', async t => {
    const { fixture, loadWorker } = await loadHelpers();
    for (const [name, size] of [['release.tgz', 64 * 1024 * 1024 + 1], ['configuration.enc.json', 24 * 1024 * 1024 + 1025]]) {
        const f = await fixture(t);
        await fs.truncate(path.join(f.directory, name), size);
        const result = await (await loadWorker()).runEosCustomerUpdateWorker(f.directory);
        assert.equal(result.status, 'failed');
        assert.equal(result.error, 'EOS_UPDATE_FILE_INVALID');
        assert.deepEqual(await f.readTrace(), []);
    }
});

test('independent: OS SIGTERM to copied worker retires installation descendants', async t => {
    const { fixture, workerCode } = await loadHelpers();
    const f = await fixture(t, 'install-hangs');
    const script = path.join(f.directory, 'worker.cjs');
    await fs.writeFile(script, await workerCode(), { mode: 0o600 });
    const child = spawn(process.execPath, [script, f.directory], {
        cwd: f.directory, env: { PATH: process.env.PATH }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', b => { stdout += b.toString(); });
    child.stderr.on('data', b => { stderr += b.toString(); });
    const closed = new Promise((resolve, reject) => { child.once('close', (code, signal) => resolve({ code, signal })); child.once('error', reject); });
    t.after(() => child.kill('SIGKILL'));
    let pid;
    const deadline = Date.now() + 6000;
    while (!pid && Date.now() < deadline) {
        try { pid = Number(await fs.readFile(f.childPid, 'utf8')); } catch {}
        if (!pid) await delay(20);
    }
    assert.ok(pid, 'the install phase created a real descendant');
    child.kill('SIGTERM');
    let timer;
    const terminated = await Promise.race([closed, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('worker did not exit')), 5000); })]).finally(() => clearTimeout(timer));
    assert.deepEqual(terminated, { code: 1, signal: null });
    assert.equal(stdout, ''); assert.equal(stderr, '');
    const receipt = JSON.parse(await fs.readFile(path.join(f.directory, 'result.json'), 'utf8'));
    assert.equal(receipt.status, 'uncertain');
    assert.equal(receipt.error, 'EOS_UPDATE_WORKER_ABORTED');
    assert.equal((await f.readTrace()).some(args => args[0] === 'start'), false);
    let running = false;
    try { running = !/^\d+ \(.+\) Z /.test(await fs.readFile(`/proc/${pid}/stat`, 'utf8')); } catch {}
    assert.equal(running, false);
});
