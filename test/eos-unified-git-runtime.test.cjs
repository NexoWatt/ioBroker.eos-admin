'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtemp, mkdir, readFile, readdir, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

async function runtimeFiles(base, prefix) {
    const files = [];
    for (const entry of await readdir(join(base, prefix), { withFileTypes: true })) {
        const name = `${prefix}/${entry.name}`;
        if (entry.isDirectory()) files.push(...await runtimeFiles(base, name));
        else if (entry.isFile()) files.push(name);
        else assert.fail(`runtime output must not be a symlink: ${name}`);
    }
    return files;
}

test('ordinary git add and Git archive retain every compiled module runtime including the backup SD-card driver', async t => {
    const source = resolve(__dirname, '..');
    const dir = await mkdtemp(join(tmpdir(), 'eos-git-runtime-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const names = ['.gitignore'];
    for (const id of ['eebus', 'backup', 'ocpp']) {
        names.push(`modules/${id}/index.js`, ...await runtimeFiles(source, `modules/${id}/build`));
        assert.ok(names.includes(`modules/${id}/build/index.js`), `${id}: built entry point missing before Git staging`);
    }
    names.push(...await runtimeFiles(source, 'modules/backup/upstream/build'));
    names.push(...await runtimeFiles(source, 'src/lib/vendor/webserver/build'));
    const vendorEntry = 'src/lib/vendor/webserver/build/index.js';
    assert.ok(names.includes(vendorEntry), 'reviewed vendored source is mandatory for npm publication');
    const sdCard = 'modules/backup/upstream/build/lib/sdCard.js';
    assert.ok(names.includes(sdCard), 'backup runtime SD-card driver is required before Git staging');
    // Nested ignore policy is part of the delivery path as well. Temporary UI
    // TypeScript staging stays excluded; its production mirrors live elsewhere.
    names.push('ui/.gitignore');
    for (const name of names) {
        await mkdir(join(dir, name, '..'), { recursive: true });
        await writeFile(join(dir, name), await readFile(join(source, name)));
    }
    // The exception is limited to shipped runtimes; development output and
    // dependency trees must remain ignored even when copied into a Git folder.
    const ignored = ['node_modules/fixture/index.js', 'modules/unshipped/build/index.js',
        'ui/build/local-cache.js', 'ui/build-ts/local-cache.js', 'ui/build-types/local.d.ts', 'tmp/build/cache.js'];
    for (const name of ignored) {
        await mkdir(join(dir, name, '..'), { recursive: true });
        await writeFile(join(dir, name), 'unshipped fixture\n');
    }
    const git = args => execFileSync('git', args, { cwd: dir, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    git(['init', '-q']);
    git(['add', '.']);
    const tracked = new Set(git(['ls-files', '-z']).split('\0').filter(Boolean));
    for (const name of names) assert.ok(tracked.has(name), `ZIP-to-Git would omit runtime file: ${name}`);
    for (const name of ignored) assert.equal(tracked.has(name), false, `unrelated output was admitted: ${name}`);
    // write-tree + archive exercises the transport representation without a
    // commit, remote push, npm download or workspace node_modules fallback.
    const tree = git(['write-tree']).trim();
    const archive = execFileSync('git', ['archive', '--format=tar', tree], { cwd: dir, maxBuffer: 32 * 1024 * 1024 });
    assert.ok(archive.length > 0);
    for (const id of ['eebus', 'backup', 'ocpp']) {
        assert.ok(archive.includes(Buffer.from(`modules/${id}/build/index.js`)), `Git archive lacks ${id} runtime`);
        assert.equal(git(['show', `${tree}:modules/${id}/index.js`]), await readFile(join(source, 'modules', id, 'index.js'), 'utf8'));
    }
    assert.ok(archive.includes(Buffer.from(sdCard)), 'Git archive lacks the SD-card backup driver');
    assert.equal(git(['show', `${tree}:${vendorEntry}`]), await readFile(join(source, vendorEntry), 'utf8'), 'Git archive retains the exact reviewed vendored source bytes');
    const exportedSdCard = join(dir, 'git-export', sdCard);
    await mkdir(join(exportedSdCard, '..'), { recursive: true });
    await writeFile(exportedSdCard, git(['show', `${tree}:${sdCard}`]));
    assert.equal(await readFile(exportedSdCard, 'utf8'), await readFile(join(source, sdCard), 'utf8'));
    // Import the Git-staged driver without probing or modifying a real disk.
    const parsed = execFileSync(process.execPath, ['--no-global-search-paths', '-e',
        'const sd = require(process.argv[1]); if (typeof sd.validateSdCardTarget !== "function") throw Error("missing backup driver"); process.stdout.write(JSON.stringify(sd.parseLsblkOutput(JSON.stringify({blockdevices:[]}))));',
        exportedSdCard], { encoding: 'utf8' });
    assert.deepEqual(JSON.parse(parsed), []);
});


test('a fresh Git index retains every file required by the sealed publication inventory', async t => {
    const source = resolve(__dirname, '..');
    const dir = await mkdtemp(join(tmpdir(), 'eos-git-sealed-inventory-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    execFileSync('git', ['init', '-q', dir], { encoding: 'utf8' });
    // Separate Git metadata/index, read-only work tree: no commit, forced add,
    // source edits, node_modules copy, remote operation or exclusion bypass.
    const git = args => execFileSync('git', [`--git-dir=${join(dir, '.git')}`, `--work-tree=${source}`, ...args],
        { cwd: dir, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    git(['add', '-A']);
    const tracked = new Set(git(['ls-files', '-z']).split('\0').filter(Boolean));
    const seal = JSON.parse(await readFile(join(source, 'release-manifests/unified/files.json'), 'utf8'));
    assert.ok(seal && seal.files && Object.keys(seal.files).length > 1000, 'real full release inventory required');
    const packageFiles = JSON.parse(await readFile(join(source, 'package.json'), 'utf8')).files;
    assert.equal(packageFiles.includes('ui/build-ts/'), false, 'npm must exclude the local TypeScript staging directory');
    assert.ok(Object.hasOwn(seal.files, 'ui/lib/ts-mirrors/ems/core-limits/core-runtime.js'), 'the runtime copy must ship');
    assert.equal(Object.keys(seal.files).some(name => name.startsWith('ui/build-ts/')), false);
    const missing = Object.keys(seal.files).filter(name => !tracked.has(name));
    assert.deepEqual(missing, [], 'ordinary Git upload must retain every sealed runtime, source and publication proof');
});
