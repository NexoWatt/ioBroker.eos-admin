'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { Module } = require('node:module');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const emitted = process.env.EOS_TEST_RUNTIME === 'build';
const source = path.join(root, emitted ? 'build/lib/eosCustomerUpdateWorker.js' : 'src/lib/eosCustomerUpdateWorker.ts');
const workerCode = async () => emitted ? fs.readFile(source, 'utf8') : ts.transpileModule(await fs.readFile(source, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
let worker;
async function loadWorker(fsOverride) {
    if (!worker || fsOverride) {
        const code = await workerCode();
        const loaded = new Module(source, module); loaded.filename = source; loaded.paths = module.paths;
        if (fsOverride) {
            const inherited = loaded.require.bind(loaded);
            loaded.require = name => name === 'node:fs/promises' ? { ...fs, ...fsOverride } : inherited(name);
        }
        loaded._compile(code, source);
        if (fsOverride) return loaded.exports;
        worker = loaded.exports;
    }
    return worker;
}
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const isLinux = process.platform === 'linux' && process.getuid?.() !== 0;

async function fixture(t, scenario = 'ok') {
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'eos-update-worker-'));
    const id = crypto.randomUUID();
    const directory = path.join(temporary, id);
    const packageDir = path.join(temporary, 'iobroker.eos-admin');
    const controllerDir = path.join(temporary, 'iobroker.js-controller');
    const trace = path.join(temporary, 'trace.jsonl');
    await fs.mkdir(directory, { mode: 0o700 });
    await fs.mkdir(path.join(packageDir, 'build'), { recursive: true });
    await fs.mkdir(controllerDir);
    const oldPackage = JSON.stringify({ name: 'iobroker.eos-admin', version: '9.0.20' });
    const newPackage = JSON.stringify({ name: 'iobroker.eos-admin', version: '9.0.21' });
    const newFiles = { 'package.json': newPackage, 'build/main.js': '/* verified new runtime */\n', 'empty.txt': '' };
    await fs.writeFile(path.join(packageDir, 'package.json'), oldPackage);
    await fs.writeFile(path.join(packageDir, 'io-package.json'), JSON.stringify({ common: { name: 'eos-admin', version: '9.0.20' } }));
    await fs.writeFile(path.join(packageDir, 'build/main.js'), '/* old runtime */\n');
    await fs.writeFile(path.join(controllerDir, 'package.json'), JSON.stringify({ name: 'iobroker.js-controller', version: '7.2.5' }));
    const alive = path.join(temporary, 'alive'); await fs.writeFile(alive, 'true');
    const childPid = path.join(temporary, 'child.pid');
    const cli = `const fs=require('node:fs'),path=require('node:path');
const args=process.argv.slice(2),scenario=${JSON.stringify(scenario)},alive=${JSON.stringify(alive)};
fs.appendFileSync(${JSON.stringify(trace)},JSON.stringify(args)+'\\n');
if(args[0]==='stop'){if(scenario!=='stop-ignored')fs.writeFileSync(alive,'false');}
else if(args[0]==='start'){if(scenario!=='start-ignored')fs.writeFileSync(alive,'true');}
else if(args[0]==='state'){process.stdout.write(scenario==='bad-state'?'undefined':fs.readFileSync(alive,'utf8'));}
else if(args[0]==='url'){
 if(scenario==='install-hangs'){
  const child=require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
  fs.writeFileSync(${JSON.stringify(childPid)},String(child.pid));setInterval(()=>{},1000);
 }else if(scenario!=='false-success'){
  for(const [name,body]of Object.entries(${JSON.stringify(newFiles)}))fs.writeFileSync(path.join(${JSON.stringify(packageDir)},name),scenario==='tampered'&&name==='build/main.js'?'tampered':body);
  fs.writeFileSync(path.join(${JSON.stringify(packageDir)},'io-package.json'),JSON.stringify({common:{name:'eos-admin',version:'9.0.21',installedFrom:args[1]}}));
 }
}else{process.exitCode=99;}
`;
    await fs.writeFile(path.join(controllerDir, 'iobroker.js'), cli);
    const archive = Buffer.from('opaque test archive: package verification happens in service fixture');
    const snapshot = Buffer.from('encrypted-configuration-test-data');
    await fs.writeFile(path.join(directory, 'release.tgz'), archive, { mode: 0o600 });
    await fs.writeFile(path.join(directory, 'configuration.enc.json'), snapshot, { mode: 0o600 });
    const files = Object.entries(newFiles).map(([name, body]) => ({ path: name, sha256: sha(body) }));
    const job = { schema: 1, id, namespace: 'eos-admin.0', fromVersion: '9.0.20', toVersion: '9.0.21', packageDir, controllerDir,
        archiveIntegrity: `sha512-${crypto.createHash('sha512').update(archive).digest('base64')}`, manifestSha256: sha(JSON.stringify(files)), files,
        snapshotSha256: sha(snapshot), createdAt: Date.now(), enabledInstances: ['eos-admin.0'] };
    const save = () => fs.writeFile(path.join(directory, 'job.json'), JSON.stringify(job), { mode: 0o600 });
    await save();
    t.after(async () => {
        // Fixture cleanup also retires a child if a regression forgot its process group.
        try { process.kill(Number(await fs.readFile(childPid, 'utf8')), 'SIGKILL'); } catch {}
        await fs.rm(temporary, { recursive: true, force: true });
    });
    return { directory, job, save, packageDir, controllerDir, childPid, alive,
        readTrace: async () => { try { return (await fs.readFile(trace, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse); } catch { return []; } } };
}

test('worker refuses unsafe scope, paths, versions, duplicate files and mutable manifests before commands', async t => {
    const f = await fixture(t); const { parseEosCustomerUpdateJob } = await loadWorker();
    for (const mutate of [j => { j.namespace = 'admin.0'; }, j => { j.enabledInstances.push('eos-admin.1'); },
        j => { j.toVersion = '10.0.0'; }, j => { j.toVersion = '9.0.19'; }, j => { j.toVersion = '9.0.21-beta.1'; },
        j => { j.packageDir = '/tmp/other'; }, j => { j.files[0].path = '../outside'; },
        j => { j.files[0].path = 'build\\main.js'; }, j => { j.files.push(j.files[0]); },
        j => { j.files[0].sha256 = '0'.repeat(64); }, j => { j.createdAt = 0; }]) {
        const job = structuredClone(f.job); mutate(job); assert.throws(() => parseEosCustomerUpdateJob(job, f.directory));
    }
    assert.deepEqual(await f.readTrace(), []);
});

test('confirmed stop precedes install; exact artifact and actual restart precede success', { skip: !isLinux }, async t => {
    const f = await fixture(t); const { runEosCustomerUpdateWorker } = await loadWorker();
    const result = await runEosCustomerUpdateWorker(f.directory);
    assert.equal(result.status, 'succeeded'); assert.equal(result.phase, 'finished');
    assert.deepEqual(await f.readTrace(), [ ['stop', 'eos-admin.0'], ['state', 'getValue', 'system.adapter.eos-admin.0.alive'],
        ['url', path.join(f.directory, 'release.tgz'), 'eos-admin'], ['start', 'eos-admin.0'],
        ['state', 'getValue', 'system.adapter.eos-admin.0.alive'] ]);
    const receipt = JSON.parse(await fs.readFile(path.join(f.directory, 'result.json'), 'utf8'));
    assert.equal(receipt.id, f.job.id); assert.equal(receipt.status, 'succeeded');
    assert.equal((await fs.stat(path.join(f.directory, 'result.json'))).mode & 0o777, 0o600);
    await assert.rejects(runEosCustomerUpdateWorker(f.directory), /EEXIST/);
    assert.equal((await f.readTrace()).length, 5, 'same job never repeats installation');
});

test('copied standalone worker uses only built-in dependencies and exits after its durable receipt', { skip: !isLinux }, async t => {
    const f = await fixture(t); const script = path.join(f.directory, 'worker.cjs');
    await fs.writeFile(script, await workerCode(), { mode: 0o600 });
    const result = await promisify(execFile)(process.execPath, [script, f.directory], {
        cwd: f.directory, timeout: 10000, maxBuffer: 1024, env: { PATH: process.env.PATH },
    });
    assert.equal(result.stdout, ''); assert.equal(result.stderr, '');
    assert.equal(JSON.parse(await fs.readFile(path.join(f.directory, 'result.json'), 'utf8')).status, 'succeeded');
});

test('changed staging content never reaches a stop or install command', { skip: !isLinux }, async t => {
    for (const file of ['release.tgz', 'configuration.enc.json']) {
        const f = await fixture(t); await fs.appendFile(path.join(f.directory, file), 'changed');
        const result = await (await loadWorker()).runEosCustomerUpdateWorker(f.directory);
        assert.equal(result.status, 'failed'); assert.equal(result.error, 'EOS_UPDATE_STAGED_CONTENT_CHANGED');
        assert.deepEqual(await f.readTrace(), []);
    }
});

test('pre-install storage failure restores only the confirmed-stopped unchanged old code', { skip: !isLinux }, async t => {
    for (const changed of [false, true]) {
        const f = await fixture(t);
        let writes = 0;
        const isolated = await loadWorker({ async open(file, ...args) {
            if (file === path.join(f.directory, 'result.pending') && ++writes === 3) {
                if (changed) await fs.writeFile(path.join(f.packageDir, 'build/main.js'), 'concurrent replacement');
                throw Object.assign(new Error('injected storage failure'), { code: 'ENOSPC' });
            }
            return fs.open(file, ...args);
        } });
        const result = await isolated.runEosCustomerUpdateWorker(f.directory);
        assert.equal(result.status, 'failed');
        assert.equal(result.recovery, changed ? 'not-restored' : 'restored-old');
        const trace = await f.readTrace(); assert.equal(trace.some(args => args[0] === 'url'), false);
        assert.equal(trace.some(args => args[0] === 'start'), !changed);
        assert.equal(await fs.readFile(f.alive, 'utf8'), String(!changed));
        assert.equal(JSON.parse(await fs.readFile(path.join(f.directory, 'result.json'), 'utf8')).recovery, result.recovery);
    }
});

test('bounded encrypted configuration larger than 2 MiB is supported', { skip: !isLinux }, async t => {
    const f = await fixture(t);
    const snapshot = Buffer.alloc(3 * 1024 * 1024, 65);
    await fs.writeFile(path.join(f.directory, 'configuration.enc.json'), snapshot);
    f.job.snapshotSha256 = sha(snapshot); await f.save();
    const result = await (await loadWorker()).runEosCustomerUpdateWorker(f.directory);
    assert.equal(result.status, 'succeeded');
});

test('controller success without new package or with changed runtime never starts EOS', { skip: !isLinux }, async t => {
    for (const scenario of ['false-success', 'tampered']) {
        const f = await fixture(t, scenario); const result = await (await loadWorker()).runEosCustomerUpdateWorker(f.directory);
        assert.equal(result.status, 'uncertain'); assert.ok(result.error);
        assert.equal((await f.readTrace()).some(args => args[0] === 'start'), false);
        assert.equal(await fs.readFile(f.alive, 'utf8'), 'false');
    }
});

test('missing controller state is not treated as a confirmed stop', { skip: !isLinux }, async t => {
    const f = await fixture(t, 'bad-state'); const result = await (await loadWorker()).runEosCustomerUpdateWorker(f.directory);
    assert.equal(result.status, 'failed'); assert.equal(result.error, 'EOS_UPDATE_INSTANCE_STATE_INVALID');
    assert.equal((await f.readTrace()).some(args => args[0] === 'url'), false);
});

test('unconfirmed stop never installs and unconfirmed restart never reports success', { skip: !isLinux }, async t => {
    const { runEosCustomerUpdateWorker } = await loadWorker();
    const stopping = await fixture(t, 'stop-ignored');
    const stopped = await runEosCustomerUpdateWorker(stopping.directory, { maximumPhaseMs: 1200 });
    assert.equal(stopped.status, 'failed');
    assert.equal(stopped.recovery, 'restored-old', 'safe original desired state is restored even when stop was unconfirmed');
    assert.equal((await stopping.readTrace()).some(args => args[0] === 'url'), false);
    const starting = await fixture(t, 'start-ignored');
    const started = await runEosCustomerUpdateWorker(starting.directory, { maximumPhaseMs: 1200 });
    assert.equal(started.status, 'uncertain'); assert.equal(started.phase, 'starting');
    assert.equal((await starting.readTrace()).filter(args => args[0] === 'start').length, 1);
});

test('timed-out install kills its process group, leaves receipt uncertain and never retries', { skip: !isLinux }, async t => {
    const f = await fixture(t, 'install-hangs'); const result = await (await loadWorker()).runEosCustomerUpdateWorker(f.directory, { maximumPhaseMs: 1500 });
    assert.equal(result.status, 'uncertain'); assert.match(result.error, /^EOS_UPDATE_(?:COMMAND_TIMEOUT|PROCESS_UNCERTAIN)$/);
    assert.equal((await f.readTrace()).filter(args => args[0] === 'url').length, 1);
    assert.equal((await f.readTrace()).some(args => args[0] === 'start'), false);
    const pid = Number(await fs.readFile(f.childPid, 'utf8'));
    // A killed orphan may briefly remain a zombie until its init reaps it; it cannot execute.
    let running = false;
    try { const stat = await fs.readFile(`/proc/${pid}/stat`, 'utf8'); running = !/^\d+ \(.+\) Z /.test(stat); } catch {}
    assert.equal(running, false, 'npm descendant may not outlive timeout as a running process');
});

test('worker abort during install kills descendants and records uncertainty without restart', { skip: !isLinux }, async t => {
    const f = await fixture(t, 'install-hangs'); const controller = new AbortController();
    const operation = (await loadWorker()).runEosCustomerUpdateWorker(f.directory, { signal: controller.signal });
    const deadline = Date.now() + 5000;
    let pid;
    do {
        try { pid = Number(await fs.readFile(f.childPid, 'utf8')); } catch {}
        if (!pid) await new Promise(resolve => setTimeout(resolve, 25));
    } while (!pid && Date.now() < deadline);
    controller.abort(); const result = await operation;
    assert.ok(pid, 'fixture reached the install child');
    assert.equal(result.status, 'uncertain'); assert.equal(result.error, 'EOS_UPDATE_WORKER_ABORTED');
    assert.equal((await f.readTrace()).some(args => args[0] === 'start'), false);
    let running = false;
    try { const stat = await fs.readFile(`/proc/${pid}/stat`, 'utf8'); running = !/^\d+ \(.+\) Z /.test(stat); } catch {}
    assert.equal(running, false);
});

test('nonprivate job directory and symlinked archive are refused', { skip: !isLinux }, async t => {
    const f = await fixture(t); await fs.chmod(f.directory, 0o755);
    await assert.rejects((await loadWorker()).runEosCustomerUpdateWorker(f.directory), /JOB_DIRECTORY/);
    await fs.chmod(f.directory, 0o700);
    await fs.rename(path.join(f.directory, 'release.tgz'), path.join(f.directory, 'other.tgz'));
    await fs.symlink('other.tgz', path.join(f.directory, 'release.tgz'));
    const result = await (await loadWorker()).runEosCustomerUpdateWorker(f.directory);
    assert.equal(result.status, 'failed'); assert.equal(result.error, 'EOS_UPDATE_FILE_INVALID');
    assert.deepEqual(await f.readTrace(), []);
});
