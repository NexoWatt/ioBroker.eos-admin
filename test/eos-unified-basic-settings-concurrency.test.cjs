'use strict';
// Actual Web save method against a controller boundary with interleaved writes.
// This checks the requested patch, not a cross-process DB transaction guarantee.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/lib/web.ts');
const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
const cls = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'Web');
const method = cls.members.find(node => node.name?.getText(source) === 'saveEosBasicSettings');
assert.ok(method);
const output = ts.transpileModule(`class Web { ${method.getText(source)} }\nmodule.exports = Web;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const clone = value => JSON.parse(JSON.stringify(value));
function fixture(role = 'installer') {
    const module = { exports: {} };
    vm.runInNewContext(output, { module }, { timeout: 1000 });
    const web = new module.exports();
    const writes = [];
    const config = {
        _id: 'system.config', type: 'config',
        common: { siteName: 'Old site', language: 'de', currency: 'EUR', expertMode: false,
            activeRepo: ['stable'], defaultNewAcl: { owner: 'system.user.admin' }, customSetting: 'keep' },
        native: { secret: 'synthetic-original' },
        acl: { owner: 'system.user.admin', object: 1632 },
    };
    web.getEosRequestAccess = async () => ({ role, userId: 'system.user.electrician' });
    web.isEosSameOriginWrite = () => true;
    web.getEosHistoryInstances = async () => ['history.0'];
    web.sendEosBasicSettings = async (_req, res) => res.status(200).json({ settings: clone(config.common) });
    web.adapter = {
        getForeignObjectAsync: async id => { assert.equal(id, 'system.config'); return clone(config); },
        setForeignObjectAsync: async () => assert.fail('Whole system.config write is forbidden'),
        extendForeignObjectAsync: async (id, patch) => {
            writes.push({ id, patch: clone(patch) });
            Object.assign(config.common, patch.common);
        },
        log: { info() {} },
    };
    const res = { code: 0, body: null, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    const req = settings => ({ headers: { 'x-nexowatt-eos-role-settings': '1' }, body: { settings } });
    return { web, config, writes, res, req };
}

test('basic settings patch preserves concurrent Admin/security/unrequested settings and native data', async () => {
    const f = fixture();
    f.web.getEosHistoryInstances = async () => {
        Object.assign(f.config.common, { language: 'nl', currency: 'USD', expertMode: true,
            activeRepo: ['customer'], defaultNewAcl: { owner: 'system.user.customer' }, customSetting: 'concurrent' });
        f.config.native.secret = 'synthetic-concurrent';
        f.config.acl.object = 1536;
        return ['history.0'];
    };
    await f.web.saveEosBasicSettings(f.req({ siteName: 'New site', language: 'de', defaultHistory: 'history.0',
        expertMode: false, activeRepo: ['attacker'], defaultNewAcl: {}, native: { secret: 'ignored' } }), f.res);
    assert.deepEqual(f.writes, [{ id: 'system.config', patch: { common: { siteName: 'New site', defaultHistory: 'history.0' } } }]);
    assert.equal(f.config.common.language, 'nl');
    assert.equal(f.config.common.currency, 'USD');
    assert.equal(f.config.common.expertMode, true);
    assert.deepEqual(f.config.common.activeRepo, ['customer']);
    assert.equal(f.config.common.defaultNewAcl.owner, 'system.user.customer');
    assert.equal(f.config.common.customSetting, 'concurrent');
    assert.equal(f.config.native.secret, 'synthetic-concurrent');
    assert.equal(f.config.acl.object, 1536);
    assert.equal(f.res.code, 200);
});

test('unchanged, unsupported and invalid settings never cause a persistence write', async () => {
    const f = fixture();
    await f.web.saveEosBasicSettings(f.req({ siteName: 'Old site', language: 'invalid', expertMode: true,
        activeRepo: [], defaultNewAcl: {}, unknown: 'ignored', latitude: 91 }), f.res);
    assert.equal(f.writes.length, 0);
    assert.equal(f.res.code, 200);
});

test('basic settings keep role/origin checks and propagate persistence failure', async () => {
    const denied = fixture('enduser');
    await denied.web.saveEosBasicSettings(denied.req({ siteName: 'Denied' }), denied.res);
    assert.equal(denied.res.code, 403);
    assert.equal(denied.writes.length, 0);
    const origin = fixture();
    origin.web.isEosSameOriginWrite = () => false;
    await origin.web.saveEosBasicSettings(origin.req({ siteName: 'Denied' }), origin.res);
    assert.equal(origin.res.code, 403);
    assert.equal(origin.writes.length, 0);
    const failure = fixture();
    failure.web.adapter.extendForeignObjectAsync = async () => { throw new Error('synthetic unavailable DB'); };
    await assert.rejects(failure.web.saveEosBasicSettings(failure.req({ siteName: 'New site' }), failure.res), /unavailable DB/);
    assert.equal(failure.res.code, 0, 'no false save success');
});
