'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, mkdir, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { loadModuleFactory, reportModuleLoadFailure } = require('../src/lib/eosModuleLoad');

test('missing packaged runtime dependency names the import and relative source without exposing installation paths', async t => {
    const root = await mkdtemp(join(tmpdir(), 'eos-load-diagnostic-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(join(root, 'modules/ocpp'), { recursive: true });
    await writeFile(join(root, 'modules/ocpp/index.js'), "module.exports = require('./missing-built-server');\n");
    const logs = [];
    assert.throws(() => loadModuleFactory(root, 'ocpp', message => logs.push(message)), { code: 'EOS_MODULE_DEPENDENCY_MISSING' });
    assert.equal(logs.length, 1);
    assert.match(logs[0], /missing=\.\/missing-built-server; from=modules\/ocpp\/index.js/);
    assert.equal(logs[0].includes(root), false);
    assert.equal(logs[0].includes(__filename), false);
});

test('load diagnostic accepts package names but suppresses arbitrary error text and foreign paths', () => {
    const root = join(tmpdir(), 'eos-diagnostic-root');
    const logs = [];
    const report = message => logs.push(message);
    const missing = Object.assign(new Error("Cannot find module '@example/runtime'\nPRIVATE_PASSWORD_VALUE"), {
        code: 'MODULE_NOT_FOUND', requireStack: [join(root, 'modules/ocpp/build/server.js'), '/other/customer/private.js'] });
    assert.equal(reportModuleLoadFailure(missing, root, 'ocpp', report).code, 'EOS_MODULE_DEPENDENCY_MISSING');
    assert.equal(logs[0], 'EOS_MODULE_DEPENDENCY_MISSING: ocpp; missing=@example/runtime; from=modules/ocpp/build/server.js');
    for (const name of ['/other/customer/private.js', 'C:\\Customer\\private.js', 'password=secret value', 'bad\nmessage']) {
        reportModuleLoadFailure({ code: 'MODULE_NOT_FOUND', message: `Cannot find module '${name}'` }, root, 'ocpp', report);
        assert.equal(logs.at(-1).includes(name), false);
    }
    assert.equal(reportModuleLoadFailure(new Error('PRIVATE_PASSWORD_VALUE'), root, 'ocpp', report), null);
    assert.equal(logs.some(text => text.includes('PRIVATE_PASSWORD_VALUE')), false);
});
