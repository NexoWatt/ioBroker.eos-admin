/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
function fixture(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos release '));
    t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
    for (const folder of ['tools','ui/www','adminWww/assets']) fs.mkdirSync(path.join(dir, folder), {recursive: true});
    fs.copyFileSync(path.join(__dirname, '../tools/eos-release-manifest.cjs'), path.join(dir, 'tools/eos-release-manifest.cjs'));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({version:'9.0.11'}));
    fs.writeFileSync(path.join(dir, 'LICENSE'), 'NexoWatt proprietary fixture');
    fs.writeFileSync(path.join(dir, 'ui/www/app.js'), 'original build');
    const run = (...args) => spawnSync(process.execPath, ['tools/eos-release-manifest.cjs', ...args], {cwd:dir, encoding:'utf8'});
    assert.equal(run('--write').status, 0);
    return {dir, run};
}
test('read-only release diagnosis accepts a clean extraction and preserves its manifest bytes', t => {
    const {dir, run}=fixture(t); const manifest=path.join(dir,'release-manifests/unified/files.json'); const before=fs.readFileSync(manifest);
    const result=run('--diagnose'); assert.equal(result.status,0,result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).added,[]); assert.deepEqual(JSON.parse(result.stdout).modified,[]);
    assert.deepEqual(fs.readFileSync(manifest),before);
});
test('overlaid old assets, changed build bytes and missing files remain blocked and are distinguished', t => {
    const {dir, run}=fixture(t); const manifest=path.join(dir,'release-manifests/unified/files.json'); const before=fs.readFileSync(manifest);
    fs.writeFileSync(path.join(dir,'adminWww/assets/old-version.js'),'old build');
    fs.writeFileSync(path.join(dir,'ui/www/app.js'),'modified build'); fs.unlinkSync(path.join(dir,'LICENSE'));
    const result=run('--diagnose'); assert.equal(result.status,1); const report=JSON.parse(result.stdout);
    assert.deepEqual(report.added,['adminWww/assets/old-version.js']); assert.deepEqual(report.modified,['ui/www/app.js']); assert.deepEqual(report.missing,['LICENSE']);
    const gate=run(); assert.equal(gate.status,1); assert.match(gate.stderr,/RELEASE_CONTENT_CHANGED/); assert.match(gate.stderr,/Do not re-seal a mixed build/);
    assert.deepEqual(fs.readFileSync(manifest),before);
});
test('version changes stay blocked instead of silently regenerating release evidence', t => {
    const {dir, run}=fixture(t); fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({version:'9.0.12'}));
    const result=run('--diagnose'); assert.equal(result.status,1); assert.equal(JSON.parse(result.stdout).sealedVersion,'9.0.11');
    assert.match(run().stderr,/RELEASE_VERSION_CHANGED/);
});
