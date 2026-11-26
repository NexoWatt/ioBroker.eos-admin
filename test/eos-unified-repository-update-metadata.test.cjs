'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const io = require('../io-package.json');
const pkg = require('../package.json');
const generator = 'tools/nexowatt-generate-eos-admin-repo-entry.cjs';
const patcher = 'tools/nexowatt-patch-repo.cjs';
const repair = 'tools/nexowatt-repair-eos-admin-update.cjs';

function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-update-metadata-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function run(script, args = [], options = {}) {
  const result = spawnSync(process.execPath, [path.isAbsolute(script) ? script : path.join(root, script), ...args], {
    encoding: 'utf8', timeout: 10_000, maxBuffer: 256 * 1024, ...options,
  });
  assert.equal(result.error, undefined);
  return result;
}
function mockRegistry(directory, problem = '') {
  const preload = path.join(directory, 'registry-response.cjs');
  fs.writeFileSync(preload, `
    const { createHash } = require('node:crypto');
    const artifact = Buffer.from('tarball content');
    const problem = process.env.EOS_TEST_REGISTRY_PROBLEM;
    globalThis.fetch = async input => {
      const name = 'iobroker.eos-admin';
      const prefix = 'https://registry.npmjs.org/' + name + '/';
      if (!input.startsWith(prefix)) throw new Error('unexpected url');
      if (input.includes('/-/')) {
        if (problem === '404') return new Response('', { status: 404 });
        if (problem === 'interrupted') throw new Error('interrupted download');
        return new Response(problem === 'integrity' ? Buffer.from('partial') : artifact);
      }
      const version = input.slice(prefix.length);
      return Response.json({ name, version, dist: { tarball: prefix + '-/' + name + '-' + version + '.tgz',
        integrity: 'sha512-' + createHash('sha512').update(artifact).digest('base64') } });
    };
  `);
  return { env: { ...process.env, NODE_OPTIONS: '--require=' + JSON.stringify(preload), EOS_TEST_REGISTRY_PROBLEM: problem } };
}
function assertProfile(entry) {
  assert.equal(entry.stopBeforeUpdate, true, 'EOS processes stop before package replacement');
  for (const key of ['dependencies', 'type', 'mode', 'platform', 'connectionType', 'dataSource', 'adminUI']) {
    assert.deepEqual(entry[key], io.common[key], key);
  }
  assert.equal(Object.hasOwn(entry, 'enabled'), false, 'repository does not force instance activation');
}

test('repository generator uses installed release profile and explicit base URL', () => {
  for (const base of [undefined, 'https://example.test/eos/custom/']) {
    const result = run(generator, base ? [base] : []);
    assert.equal(result.status, 0, result.stderr);
    const entry = JSON.parse(result.stdout)['eos-admin'];
    assertProfile(entry);
    assert.equal(entry.version, pkg.version);
    assert.equal(entry.meta, `${base?.replace(/\/$/, '') || `https://unpkg.com/iobroker.eos-admin@${pkg.version}`}/io-package.json`);
  }
});

test('repository patcher replaces stale profile but preserves unrelated entries and custom fields', t => {
  const directory = temporary(t);
  const input = path.join(directory, 'original repo.json');
  const output = path.join(directory, 'patched repo.json');
  const original = { other: { version: '4.2.1', custom: ['retained'] },
    'eos-admin': { version: '0.0.1', stopBeforeUpdate: false, dependencies: [{ 'js-controller': '>=6.0.11' }],
      mode: 'schedule', customOperatorValue: { retained: true } } };
  fs.writeFileSync(input, JSON.stringify(original));
  const registry = mockRegistry(directory);
  const result = run(patcher, [input, output, '9.0.99', 'https://example.test/eos/release/'], registry);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(input)), original, 'separate output keeps original intact');
  const patched = JSON.parse(fs.readFileSync(output));
  assert.deepEqual(patched.other, original.other);
  assert.deepEqual(patched['eos-admin'].customOperatorValue, original['eos-admin'].customOperatorValue);
  assertProfile(patched['eos-admin']);
  assert.equal(patched['eos-admin'].version, '9.0.99');
  assert.equal(patched['eos-admin'].meta, 'https://example.test/eos/release/io-package.json');
  assert.match(result.stdout, /stopBeforeUpdate=true/);
  const inPlace = run(patcher, [output], registry);
  assert.equal(inPlace.status, 0, inPlace.stderr);
  assert.equal(JSON.parse(fs.readFileSync(output))['eos-admin'].version, pkg.version);
});

test('repository keeps the previous version through 404, interruption or partial bytes, and advances on verified retry', t => {
  const directory = temporary(t);
  const file = path.join(directory, 'repo.json');
  const original = JSON.stringify({ 'eos-admin': { version: '9.0.31', stopBeforeUpdate: true }, other: { keep: true } });
  fs.writeFileSync(file, original);
  for (const failure of ['404', 'interrupted', 'integrity']) {
    const result = run(patcher, [file], mockRegistry(directory, failure));
    assert.notEqual(result.status, 0);
    assert.equal(fs.readFileSync(file, 'utf8'), original);
  }
  assert.equal(run(patcher, [file], mockRegistry(directory)).status, 0);
  const updated = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(updated['eos-admin'].version, pkg.version);
  assert.equal(updated['eos-admin'].stopBeforeUpdate, true);
  assert.equal(Object.hasOwn(updated['eos-admin'], 'enabled'), false);
});

test('first repository file, Windows-style UTF-8 BOM and path with spaces are supported', t => {
  const directory = temporary(t);
  const file = path.join(directory, 'Repository Kunde.json');
  const registry = mockRegistry(directory);
  assert.equal(run(patcher, [file], registry).status, 0);
  assertProfile(JSON.parse(fs.readFileSync(file, 'utf8'))['eos-admin']);
  fs.writeFileSync(file, '\uFEFF' + JSON.stringify({ other: { keep: true } }));
  assert.equal(run(patcher, [file], registry).status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).other, { keep: true });
});

test('invalid release metadata fails before a repository can be rewritten', t => {
  const directory = temporary(t);
  fs.mkdirSync(path.join(directory, 'tools'));
  for (const script of [generator, patcher]) fs.copyFileSync(path.join(root, script), path.join(directory, script));
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify(pkg));
  const input = path.join(directory, 'repo.json');
  const original = '{"other":{"retained":true}}';
  for (const invalid of [{ ...io.common, stopBeforeUpdate: false }, { ...io.common, dependencies: [] }]) {
    fs.writeFileSync(path.join(directory, 'io-package.json'), JSON.stringify({ common: invalid }));
    fs.writeFileSync(input, original);
    for (const script of [generator, patcher]) {
      const result = run(path.join(directory, script), script === patcher ? [input] : []);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /EOS_REPOSITORY_METADATA_INVALID/);
    }
    assert.equal(fs.readFileSync(input, 'utf8'), original);
  }
});

function fakeController(t, failAt = 0) {
  const directory = temporary(t);
  const trace = path.join(directory, 'commands.jsonl');
  const executable = path.join(directory, 'iobroker');
  fs.writeFileSync(executable, `#!${process.execPath}\n'use strict';
const fs=require('node:fs');
const trace=${JSON.stringify(trace)};
fs.appendFileSync(trace,JSON.stringify(process.argv.slice(2))+'\\n');
if(fs.readFileSync(trace,'utf8').trim().split('\\n').length===${failAt})process.exitCode=23;
`, { mode: 0o700 });
  return { env: { ...process.env, PATH: `${directory}${path.delimiter}${process.env.PATH || ''}` },
    read: () => fs.existsSync(trace) ? fs.readFileSync(trace, 'utf8').trim().split('\n').map(JSON.parse) : [] };
}

test('explicit metadata repair uses fixed controller arguments without enabling or restarting instances', { skip: process.platform !== 'linux' }, t => {
  const controller = fakeController(t);
  const result = run(repair, [], { env: controller.env });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(controller.read(), [
    ['object', 'set', 'system.adapter.eos-admin', 'common.stopBeforeUpdate=true'],
    ['object', 'set', 'system.adapter.eos-admin', 'common.dontDelete=false'],
    ['object', 'set', 'system.adapter.eos-admin', 'common.nondeletable=false'],
    ['object', 'set', 'system.adapter.eos-admin.0', 'common.dontDelete=false'],
    ['object', 'set', 'system.adapter.eos-admin.0', 'common.nondeletable=false'],
  ]);
  assert.match(result.stdout, /commands completed/);
});

test('metadata repair aborts on controller failure and never reports successful completion', { skip: process.platform !== 'linux' }, t => {
  const controller = fakeController(t, 2);
  const result = run(repair, [], { env: controller.env });
  assert.equal(result.status, 1);
  assert.equal(controller.read().length, 2, 'later operations are not attempted');
  assert.match(result.stderr, /EOS_UPDATE_METADATA_REPAIR_FAILED/);
  assert.doesNotMatch(result.stdout, /commands completed/);
});
