'use strict';
// Copyright (c) 2026 NexoWatt. Proprietary; see LICENSE.
// Synthetic transcript fixtures test admission rules; they are not product test evidence.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { check, write } = require('../tools/eos-release-evidence.cjs');
const repository = path.resolve(__dirname, '..');
const version = require('../package.json').version;
const validation = 'release-manifests/unified/validation.json';
const command = 'npm run test:unified && npm run test:retained && npm run test:modules';
const counts = { tests: 1207, pass: 1205, fail: 0, skipped: 2, cancelled: 0 };
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function summary(tests, skipped = 0, prefix = 'ℹ') {
    return ['tests ' + tests, 'suites 0', 'pass ' + (tests - skipped), 'fail 0', 'cancelled 0', 'skipped ' + skipped, 'todo 0', 'duration_ms 15'].map(line => `${prefix} ${line}`).join('\n');
}

function transcript(major) {
    const prefix = major === 22 ? '#' : 'ℹ';
    return [
        `> iobroker.eos-admin@${version} test`, `> ${command}`, '',
        `> iobroker.eos-admin@${version} test:unified`, '> node --test synthetic-unified-fixture', summary(765, 2, prefix), '',
        `> iobroker.eos-admin@${version} test:retained`, '> node --test synthetic-retained-fixture', summary(48, 0, prefix), '',
        `> iobroker.eos-admin@${version} test:modules`, '> node --test synthetic-modules-fixture', summary(327, 0, prefix), summary(4, 0, prefix), summary(63, 0, prefix), '',
    ].join('\n');
}

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos evidence fixture '));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const raw = `docs/reports/unified-${version}/raw`;
    const put = (relative, content) => {
        const absolute = path.join(root, relative);
        fs.mkdirSync(path.dirname(absolute), { recursive: true });
        fs.writeFileSync(absolute, content);
    };
    const get = relative => fs.readFileSync(path.join(root, relative), 'utf8');
    const putJson = (relative, value) => put(relative, JSON.stringify(value, null, 2) + '\n');
    putJson('package.json', { name: 'iobroker.eos-admin', version, scripts: {
        test: command,
        'test:unified': 'node --test synthetic-unified-fixture',
        'test:retained': 'node --test synthetic-retained-fixture',
        'test:modules': 'node --test synthetic-modules-fixture',
    } });
    for (const file of ['eos-release-evidence.cjs', 'eos-release-manifest.cjs']) put(`tools/${file}`, fs.readFileSync(path.join(repository, 'tools', file)));
    put('src/example.js', "'use strict';\nmodule.exports = 1;\n");
    fs.mkdirSync(path.join(root, path.dirname(validation)), { recursive: true });
    for (const major of [22, 24]) {
        put(`${raw}/node${major}-tests-final.log`, transcript(major));
        put(`${raw}/node${major}-version.log`, major === 22 ? 'v22.23.4\n' : 'v24.22.3\n');
    }
    function index() {
        putJson(`${raw}/INDEX.json`, {
            version,
            results: { 'node22-tests-final': counts, 'node24-tests-final': counts },
            files: [22, 24].flatMap(major => [`node${major}-tests-final.log`, `node${major}-version.log`]).map(file => ({ file, deliveredSha256: hash(get(`${raw}/${file}`)) })),
        });
    }
    function mutateIndex(update) {
        const value = JSON.parse(get(`${raw}/INDEX.json`));
        update(value);
        putJson(`${raw}/INDEX.json`, value);
    }
    function mutateLog(major, update) {
        put(`${raw}/node${major}-tests-final.log`, update(get(`${raw}/node${major}-tests-final.log`)));
        index();
    }
    index();
    return { root, raw, put, get, putJson, index, mutateIndex, mutateLog };
}

test('release evidence binds the current source tree and both complete versioned test runs', t => {
    const f = fixture(t);
    const written = write({ root: f.root });
    assert.equal(written.version, version);
    assert.deepEqual(written.evidence.runs.map(run => run.nodeVersion), ['v22.23.4', 'v24.22.3']);
    assert.deepEqual(written.evidence.runs.map(run => run.result), [counts, counts]);
    assert.equal(written.evidence.index.sha256, hash(f.get(`${f.raw}/INDEX.json`)));
    const bytes = f.get(validation);
    const mtime = fs.statSync(path.join(f.root, validation)).mtimeMs;
    assert.deepEqual(check({ root: f.root }), written);
    assert.equal(f.get(validation), bytes);
    assert.equal(fs.statSync(path.join(f.root, validation)).mtimeMs, mtime);
    assert.deepEqual(write({ root: f.root }), written, 'explicit recording is deterministic and excludes only the record itself');
});

test('fresh copied release verifies through the Node CLI without node_modules', t => {
    const f = fixture(t);
    write({ root: f.root });
    const result = spawnSync(process.execPath, ['tools/eos-release-evidence.cjs'], { cwd: f.root, encoding: 'utf8', timeout: 10000, env: { PATH: path.dirname(process.execPath) } });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /unveraendert verifiziert/);
    assert.equal(fs.existsSync(path.join(f.root, 'node_modules')), false);
});

test('missing validation cannot be generated by a read-only check or unsupported CLI switch', t => {
    const f = fixture(t);
    assert.throws(() => check({ root: f.root }), /ENOENT/);
    const result = spawnSync(process.execPath, ['tools/eos-release-evidence.cjs', '--skip'], { cwd: f.root, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 1);
    assert.equal(fs.existsSync(path.join(f.root, validation)), false);
});

test('source changes after validation are rejected without replacing the record', t => {
    const f = fixture(t);
    write({ root: f.root });
    const original = f.get(validation);
    f.put('src/example.js', "'use strict';\nmodule.exports = 2;\n");
    assert.throws(() => check({ root: f.root }), /record differs from release files/);
    assert.equal(f.get(validation), original);
});

test('changed or added files inside reports cannot be excluded from the evidence digest', t => {
    const f = fixture(t);
    write({ root: f.root });
    f.put(`docs/reports/unified-${version}/added-note.md`, 'Changed after validation.');
    assert.throws(() => check({ root: f.root }), /record differs from release files/);
});

test('edited validation summaries are rejected even when source files stay unchanged', t => {
    const f = fixture(t);
    write({ root: f.root });
    const value = JSON.parse(f.get(validation));
    value.evidence.runs[0].result.pass++;
    f.putJson(validation, value);
    assert.throws(() => check({ root: f.root }), /record differs from release files/);
});

test('raw transcript changes must match the INDEX before explicit recording', t => {
    const f = fixture(t);
    f.put(`${f.raw}/node22-tests-final.log`, transcript(22) + 'unindexed bytes\n');
    assert.throws(() => write({ root: f.root }), /INDEX hash differs/);
    assert.equal(fs.existsSync(path.join(f.root, validation)), false);
});

test('INDEX aggregate cannot claim success which differs from raw counters', t => {
    const f = fixture(t);
    f.mutateIndex(index => { index.results['node22-tests-final'].tests++; index.results['node22-tests-final'].pass++; });
    assert.throws(() => write({ root: f.root }), /INDEX totals differ/);
});

test('incomplete, negative, nonnumeric and failed INDEX counters are rejected', async t => {
    for (const [label, change] of [
        ['missing field', value => { delete value.cancelled; }],
        ['negative', value => { value.skipped = -1; }],
        ['string', value => { value.tests = '1207'; }],
        ['failure', value => { value.fail = 1; }],
        ['cancelled', value => { value.cancelled = 1; }],
        ['reduced scope', value => { value.tests = 100; value.pass = 98; }],
    ]) await t.test(label, child => {
        const f = fixture(child);
        f.mutateIndex(index => change(index.results['node22-tests-final']));
        assert.throws(() => write({ root: f.root }), /RELEASE_VALIDATION_INVALID/);
    });
});

test('raw failure, cancellation, skipped expansion, TODO and truncated suites block recording', async t => {
    for (const [label, update] of [
        ['failure', text => text.replace('ℹ fail 0', 'ℹ fail 1')],
        ['cancelled', text => text.replace('ℹ cancelled 0', 'ℹ cancelled 1')],
        ['extra skipped', text => text.replace('ℹ pass 763', 'ℹ pass 762').replace('ℹ skipped 2', 'ℹ skipped 3')],
        ['todo', text => text.replace('ℹ todo 0', 'ℹ todo 1')],
        ['truncated last suite', text => text.slice(0, text.lastIndexOf('ℹ tests'))],
        ['missing last counter', text => text.slice(0, text.lastIndexOf('ℹ todo'))],
        ['duplicate counter', text => text.replace('ℹ pass 763', 'ℹ pass 763\nℹ pass 763')],
        ['reduced scope', text => text.replace('ℹ tests 765', 'ℹ tests 20').replace('ℹ pass 763', 'ℹ pass 18')],
    ]) await t.test(label, child => {
        const f = fixture(child);
        f.mutateLog(24, update);
        assert.throws(() => write({ root: f.root }), /RELEASE_VALIDATION_INVALID/);
    });
});

test('wrong npm version headers, missing full command and wrong phase order are rejected', async t => {
    for (const [label, update] of [
        ['older release', text => text.replaceAll(`@${version}`, '@8.0.2')],
        ['missing full command', text => text.replace(`> ${command}`, '> npm run test:unified')],
        ['missing retained phase', text => text.replace(' test:retained\n', ' test:modules\n')],
        ['extra test command', text => text + `> ${command}\n`],
        ['changed phase command', text => text.replace('> node --test synthetic-unified-fixture', '> node --test only-one-smoke-test')],
    ]) await t.test(label, child => {
        const f = fixture(child);
        f.mutateLog(24, update);
        assert.throws(() => write({ root: f.root }), /RELEASE_VALIDATION_INVALID/);
    });
});

test('wrong release metadata cannot be covered by old test transcripts', t => {
    const f = fixture(t);
    f.mutateIndex(index => { index.version = '8.0.2'; });
    assert.throws(() => write({ root: f.root }), /INDEX version/);
});

test('Node 22 and 24 evidence requires their supported patch levels', async t => {
    for (const [major, runtime] of [[22, 'v24.22.3'], [22, 'v22.23.3'], [24, 'v24.22.0'], [24, 'node24'], [24, 'v24.22.3\nextra']]) await t.test(`${major}: ${JSON.stringify(runtime)}`, child => {
        const f = fixture(child);
        f.put(`${f.raw}/node${major}-version.log`, runtime);
        f.index();
        assert.throws(() => write({ root: f.root }), /runtime evidence/);
    });
});

test('duplicate or external INDEX entries cannot supply a required local transcript', async t => {
    for (const mode of ['duplicate', 'external']) await t.test(mode, child => {
        const f = fixture(child);
        f.mutateIndex(index => {
            if (mode === 'duplicate') index.files.push(index.files[0]);
            else index.files[0].file = '../../node22-tests-final.log';
        });
        assert.throws(() => write({ root: f.root }), /INDEX entry missing or ambiguous/);
    });
});

test('missing or oversized logs cannot produce release validation', async t => {
    for (const mode of ['missing', 'oversized']) await t.test(mode, child => {
        const f = fixture(child);
        if (mode === 'missing') fs.unlinkSync(path.join(f.root, f.raw, 'node22-tests-final.log'));
        else f.put(`${f.raw}/node22-version.log`, 'v22.23.4\n' + ' '.repeat(256));
        assert.throws(() => write({ root: f.root }), /ENOENT|too large/);
    });
});

test('CRLF and Node spec/TAP reporter summaries retain their exact byte hashes', t => {
    const f = fixture(t);
    for (const major of [22, 24]) f.mutateLog(major, text => text.replaceAll('\n', '\r\n'));
    const evidence = write({ root: f.root });
    assert.equal(evidence.evidence.runs[0].log.sha256, hash(f.get(`${f.raw}/node22-tests-final.log`)));
    assert.deepEqual(check({ root: f.root }), evidence);
});

test('validation record must remain in the seal snapshot scope', t => {
    const f = fixture(t);
    write({ root: f.root });
    const file = 'tools/eos-release-manifest.cjs';
    f.put(file, f.get(file).replace("'release-manifests/unified'", "'release-manifests/unified/runtime.cdx.json'"));
    delete require.cache[require.resolve(path.join(f.root, file))];
    assert.throws(() => check({ root: f.root }), /validation record outside release snapshot/);
});

test('symlinked log files and report directories are rejected', { skip: process.platform === 'win32' }, async t => {
    for (const mode of ['file', 'directory', 'validation']) await t.test(mode, child => {
        const f = fixture(child);
        const original = mode === 'directory' ? path.join(f.root, f.raw) : path.join(f.root, mode === 'validation' ? validation : `${f.raw}/node22-tests-final.log`);
        if (mode === 'validation') write({ root: f.root });
        const moved = `${original}-outside`;
        fs.renameSync(original, moved);
        fs.symlinkSync(moved, original, mode === 'directory' ? 'dir' : 'file');
        assert.throws(() => mode === 'validation' ? check({ root: f.root }) : write({ root: f.root }), /unsafe evidence path/);
    });
});
