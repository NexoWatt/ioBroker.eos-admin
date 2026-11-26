'use strict';
/** Executable production client functions; HTTP and DOM are fixtures, no hardware. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const directory = path.resolve(__dirname, '../ui/src-ts/runtime-executables/www');
function read(name) { return ts.createSourceFile(name, fs.readFileSync(path.join(directory, `${name}.ts`), 'utf8'), ts.ScriptTarget.Latest, true); }
function functions(source, names) {
    const found = new Map();
    const visit = node => { if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) found.set(node.name.text, node.getText(source)); ts.forEachChild(node, visit); };
    visit(source); for (const name of names) assert.ok(found.has(name), `actual production ${name}`);
    return names.map(name => found.get(name)).join('\n');
}
for (const name of ['app', 'evcs']) {
    function fixture(status = 200, code = '') {
        const calls = [], notices = [];
        const source = read(name), names = ['rememberChargingControlIdentity', 'chargingControlFetch'];
        const context = vm.createContext({
            fetch: async (url, options) => { calls.push({ url, options }); return { status, clone: () => ({ json: async () => ({ error: code }) }) }; },
            document: { getElementById: () => notices[0] || null, querySelector: () => ({ prepend: value => notices.push(value) }),
                createElement: () => ({ setAttribute() {}, addEventListener() {}, appendChild() {} }) },
            window: { location: { reload() {} } },
        });
        vm.runInContext('let chargingControlSnapshot=null;\n' + functions(source, names), context);
        return { calls, notices, api: context };
    }
    test(`${name}: snapshot is immutable; automatic refresh never upgrades old controls to B`, async () => {
        const f = fixture(); const first = { chargingControlIdentity: { revision: 'layout-A', slots: { lp1: 'incarnation-A' } } };
        f.api.rememberChargingControlIdentity(first); first.chargingControlIdentity.slots.lp1 = 'tampered';
        f.api.rememberChargingControlIdentity({ chargingControlIdentity: { revision: 'layout-B', slots: { lp1: 'incarnation-B' } } });
        for (const [scope, key] of [['ems', 'evcs.1.userMode'], ['evcs', '1.mode'], ['ems', 'chargingManagement.wallboxes.lp1.userMode']]) {
            await f.api.chargingControlFetch('/api/set', { method: 'POST', body: JSON.stringify({ scope, key, value: 'boost' }) });
            assert.equal(JSON.parse(f.calls.at(-1).options.body).expectedChargingIdentity, 'incarnation-A');
        }
        await f.api.chargingControlFetch('/api/set', { body: JSON.stringify({ scope: 'ems', key: 'evcs.global.storageAssistEnabled', value: true }) });
        assert.equal(JSON.parse(f.calls.at(-1).options.body).expectedChargingLayoutRevision, 'layout-A');
        await f.api.chargingControlFetch('/api/set', { body: JSON.stringify({ scope: 'settings', key: 'evcsMode', value: 'boost' }) });
        assert.equal(JSON.parse(f.calls.at(-1).options.body).expectedChargingLayoutRevision, 'layout-A');
    });
    test(`${name}: a page loaded without identity metadata cannot adopt a later token automatically`, async () => {
        const f = fixture(); f.api.rememberChargingControlIdentity({});
        f.api.rememberChargingControlIdentity({ chargingControlIdentity: { revision: 'B', slots: { lp1: 'B' } } });
        await f.api.chargingControlFetch('/api/set', { body: JSON.stringify({ scope: 'ems', key: 'evcs.1.userMode', value: 'boost' }) });
        assert.equal(Object.hasOwn(JSON.parse(f.calls[0].options.body), 'expectedChargingIdentity'), false);
    });
    test(`${name}: failed initial configuration read freezes the unconfirmed document identity`, async () => {
        const f = fixture(), source = read(name);
        const bootstrap = functions(source, ['bootstrap']);
        const parsed = ts.createSourceFile('bootstrap.ts', bootstrap, ts.ScriptTarget.Latest, true);
        let configRead;
        const visit = node => {
            if (!configRead && ts.isTryStatement(node) && node.tryBlock.getText(parsed).includes("fetch('/config'")) configRead = node;
            ts.forEachChild(node, visit);
        }; visit(parsed);
        assert.ok(configRead?.catchClause);
        assert.match(configRead.catchClause.block.getText(parsed), /rememberChargingControlIdentity\(\{\}\)/);
        f.api.console = { warn() {} };
        // Execute the production catch body of the failed bootstrap read.
        vm.runInContext(`{ const e = new Error('offline'); const _e = e; ${configRead.catchClause.block.getText(parsed)} }`, f.api);
        f.api.rememberChargingControlIdentity({ chargingControlIdentity: { revision: 'B', slots: { lp1: 'B' } } });
        await f.api.chargingControlFetch('/api/set', { body: JSON.stringify({ scope: 'ems', key: 'evcs.1.userMode', value: 'boost' }) });
        assert.equal(Object.hasOwn(JSON.parse(f.calls[0].options.body), 'expectedChargingIdentity'), false);
    });
    test(`${name}: identity rejection is visible and is not retried with a new token`, async () => {
        const f = fixture(409, 'EOS_EVCS_IDENTITY_CHANGED');
        f.api.rememberChargingControlIdentity({ chargingControlIdentity: { revision: 'A', slots: { lp1: 'A' } } });
        await assert.rejects(f.api.chargingControlFetch('/api/set', { body: JSON.stringify({ scope: 'ems', key: 'evcs.1.userMode', value: 'boost' }) }), /EOS_EVCS_IDENTITY_CHANGED/);
        assert.equal(f.calls.length, 1); assert.equal(f.notices.length, 1);
        assert.match(f.notices[0].textContent, /Befehl wurde nicht ausgeführt.*neu laden/);
    });
    test(`${name}: all direct API-set call sites use the identity wrapper`, () => {
        const source = read(name); let writes = 0;
        const visit = node => {
            if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === '/api/set') {
                writes++; assert.ok(['chargingControlFetch', 'fetchModeJson', '_fetchEvcsModeJson'].includes(node.expression.getText(source)));
            }
            ts.forEachChild(node, visit);
        }; visit(source); assert.ok(writes > 5);
        const modeName = name === 'app' ? 'fetchModeJson' : '_fetchEvcsModeJson';
        assert.match(functions(source, [modeName]), /await chargingControlFetch\(url,/);
    });
}
test('station commands carry the rendered station snapshot identity', async () => {
    const source = read('dc-station-display'); const calls = [];
    const context = vm.createContext({ token: 'station-fixture', busyKey: '', lastPayload: {
        station: {}, chargingControlIdentity: { revision: 'old', slots: { lp1: 'old-station-identity' } } },
        render() {}, toast() {}, t: text => text, refresh() {}, setTimeout() {},
        fetchJson: async (url, options) => { calls.push({ url, options }); return { ok: true }; },
    });
    const compiled = ts.transpileModule(functions(source, ['sendCommand']), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInContext(compiled, context);
    context.lastPayload.chargingControlIdentity.slots.lp1 = 'new-poll-identity';
    await context.sendCommand('lp1', 'start', 'fast', { expectedChargingIdentity: 'forged-extra' }, 'old-station-identity');
    assert.equal(calls.length, 1);
    assert.equal(JSON.parse(calls[0].options.body).expectedChargingIdentity, 'old-station-identity');
    assert.match(functions(source, ['render']), /const expectedChargingIdentity = payload\.chargingControlIdentity/);
});
test('station retained A-button callback cannot acquire B identity after another render', () => {
    const source = read('dc-station-display'), handlers = [], calls = [];
    const button = { getAttribute: key => ({ 'data-lp': 'lp1', 'data-action': 'start', 'data-mode': 'fast' })[key],
        hasAttribute: () => false, addEventListener: (_kind, callback) => handlers.push(callback) };
    const context = vm.createContext({ app: { dataset: {}, style: { setProperty() {} }, querySelectorAll: selector => selector === '[data-command]' ? [button] : [] },
        withPresentationModel: value => value, connectorLayout: () => ({ count: 1, density: 'normal', columns: 1, rows: 1 }),
        escapeHtml: value => value, t: value => value, fmtDateTime: () => '', window: {}, connectionLost: false, lastOkTs: 0,
        languageSwitchHtml: () => '', bannerHtml: () => '', renderStatusStrip: () => '', renderSummary: () => '',
        renderDecisionPanel: () => '', renderWarningsPanel: () => '', sendCommand: (...args) => calls.push(args),
    });
    vm.runInContext(ts.transpileModule(functions(source, ['render']), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
    context.render({ chargingControlIdentity: { slots: { lp1: 'A' } } });
    context.render({ chargingControlIdentity: { slots: { lp1: 'B' } } });
    handlers[0](); handlers[1]();
    assert.equal(calls[0][4], 'A'); assert.equal(calls[1][4], 'B');
});
