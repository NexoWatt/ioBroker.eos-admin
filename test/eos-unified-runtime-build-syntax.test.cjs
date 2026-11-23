'use strict';
// Prüft den echten Generator in einem isolierten Mini-Projekt, ohne Code auszuführen.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

function fixture(t, source) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-runtime-syntax-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, 'scripts'));
    fs.mkdirSync(path.join(root, 'src-ts/runtime-executables'), { recursive: true });
    fs.copyFileSync(path.join(__dirname, '../ui/scripts/build-ts-runtime-executables.js'), path.join(root, 'scripts/build.cjs'));
    fs.writeFileSync(path.join(root, 'src-ts/runtime-executables/example.ts'), source);
    fs.writeFileSync(path.join(root, 'example.js'), '/* original runtime */\n');
    const result = spawnSync(process.execPath, ['scripts/build.cjs'], {
        cwd: root, encoding: 'utf8', timeout: 15000,
        env: { ...process.env, NODE_PATH: path.dirname(path.dirname(require.resolve('typescript/package.json'))) },
    });
    return { result, output: fs.readFileSync(path.join(root, 'example.js'), 'utf8') };
}

test('misplaced TypeScript marker fails before replacing a runtime artifact', t => {
    const f = fixture(t, '/** short header */\n// @runtime-transpile\ntype Flag = boolean;\nconst enabled: Flag = true;\n');
    assert.equal(f.result.status, 1);
    assert.match(f.result.stderr, /Ungültiges Runtime-JavaScript/);
    assert.equal(f.output, '/* original runtime */\n');
});

test('explicitly marked TypeScript builds executable JavaScript without running it', t => {
    const f = fixture(t, '// @runtime-transpile\nconst enabled: boolean = true;\nthrow new Error("not executed during build");\n');
    assert.equal(f.result.status, 0, f.result.stderr);
    assert.match(f.output, /const enabled = true/);
    assert.doesNotMatch(f.output, /: boolean/);
});
