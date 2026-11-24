'use strict';
// Execute the actual EOS App methods with a controller-socket fixture. No
// standard Admin instance, server or adapter-owned states are supplied.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');
const requireUi = createRequire(path.resolve(__dirname, '../src-admin/package.json'));
const React = requireUi('react');
const file = path.resolve(__dirname, '../src-admin/src/App.tsx');
const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name.text === 'App');
const names = ['ownNewsState', 'subscribeOwnNews', 'onNews', 'renderNewsDialog'];
const methods = names.map(name => {
    const member = declaration.members.find(node => node.name?.getText(source) === name);
    assert.ok(member, `production App.${name} exists`);
    return member.getText(source);
}).join('\n');
const compiled = ts.transpileModule(`class App { ${methods} }\nmodule.exports = App;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText;

function fixture(namespace = 'eos-admin.7') {
    const module = { exports: {} };
    vm.runInNewContext(compiled, { module, React, NewsAdminDialog: 'NewsAdminDialog', console }, { timeout: 1000 });
    const app = new module.exports();
    const calls = [];
    const states = new Map([
        ['admin.0.info.newsLastId', { val: 'standard-admin-retained' }],
        ['eos-admin.0.info.newsLastId', { val: 'another-eos-retained' }],
        [`${namespace}.info.newsLastId`, { val: 'own-previous' }],
    ]);
    app.adminInstance = namespace;
    app.state = { systemConfig: { common: { licenseConfirmed: true } }, showNews: { checkNews: [], lastNewsId: 'own-previous' } };
    app.setState = update => Object.assign(app.state, update);
    app.showAlert = message => assert.fail(message);
    app.socket = {
        subscribeState: async (id, callback) => { calls.push(['subscribe', id, callback]); },
        unsubscribeState: async (id, callback) => { calls.push(['unsubscribe', id, callback]); },
        getState: async id => { calls.push(['read', id]); return states.get(id); },
        setState: async (id, value) => { calls.push(['write', id]); states.set(id, value); },
    };
    return { app, calls, states };
}

test('EOS news subscribes, reads and acknowledges its serving instance without standard Admin', async () => {
    const { app, calls, states } = fixture();
    await app.subscribeOwnNews();
    assert.equal(calls[0][1], 'eos-admin.7.info.newsFeed');
    assert.equal(calls[0][2], app.onNews);
    await app.onNews('eos-admin.7.info.newsFeed', { val: null });
    await app.renderNewsDialog().props.onSetLastNewsId('own-new');
    assert.deepEqual(calls.map(row => row.slice(0, 2)), [
        ['subscribe', 'eos-admin.7.info.newsFeed'],
        ['read', 'eos-admin.7.info.newsLastId'],
        ['write', 'eos-admin.7.info.newsLastId'],
    ]);
    assert.equal(states.get('eos-admin.7.info.newsLastId').val, 'own-new');
    assert.equal(states.get('admin.0.info.newsLastId').val, 'standard-admin-retained');
    assert.equal(states.get('eos-admin.0.info.newsLastId').val, 'another-eos-retained');
    assert.equal(app.state.showNews, null);
});

test('news switching unsubscribes the previous EOS instance without scanning other instances', async () => {
    const { app, calls } = fixture();
    await app.subscribeOwnNews();
    app.adminInstance = 'eos-admin.12';
    await app.subscribeOwnNews();
    assert.deepEqual(calls.map(row => row.slice(0, 2)), [
        ['subscribe', 'eos-admin.7.info.newsFeed'],
        ['unsubscribe', 'eos-admin.7.info.newsFeed'],
        ['subscribe', 'eos-admin.12.info.newsFeed'],
    ]);
});

test('an unresolved or foreign serving instance never falls back to admin.0 or eos-admin.0', async () => {
    for (const value of ['', 'admin.0', 'eos-admin.01', 'system.adapter.eos-admin.0']) {
        const { app, calls } = fixture(value);
        await assert.rejects(app.subscribeOwnNews(), /EOS_NEWS_INSTANCE_UNAVAILABLE/);
        assert.equal(calls.length, 0);
    }
});
