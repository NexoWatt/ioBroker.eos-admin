'use strict';
// Actual hosted HTTP routes and AST-extracted production form handlers.
// DOM, controller database/auth and runtime application are fixtures. No browser/hardware.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const sourceRoot = process.env.EOS_TARIFF_REVIEW_ROOT || root;
const req = createRequire(path.join(root, 'package.json'));
const ts = req('typescript');
const { createHarness } = req('./ui/test/unified/http-harness.cjs');
const file = path.join(sourceRoot, 'ui/src-ts/runtime-executables/www/ems-apps.ts');
const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const names = new Set(['_tpEl', '_tpStr', '_tpBool', '_tpNum', '_tpSet', 'applyTariffProviderUI', 'collectTariffProviderConfig', 'collectTariffProviderPatch']);
const definitions = new Map();
let genericTariffStatements = [];
function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name && names.has(node.name.text)) definitions.set(node.name.text, node.getText(source));
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && names.has(node.name.text)) definitions.set(node.name.text, `const ${node.getText(source)};`);
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'collectPatchFromUI') {
        const statements = node.body.statements;
        const start = statements.findIndex(statement => /^(?:const tariffPatch =|patch\.tariffProvider = collectTariffProviderConfig)/.test(statement.getText(source)));
        assert.ok(start >= 0, 'generic save contains production tariff collection');
        const count = statements[start].getText(source).startsWith('const tariffPatch') ? 3 : 2;
        genericTariffStatements = statements.slice(start, start + count).map(statement => statement.getText(source));
    }
    ts.forEachChild(node, visit);
}
visit(source);
for (const name of names) if (name !== 'collectTariffProviderPatch') assert.ok(definitions.has(name), name);
const compiled = ts.transpileModule([...definitions.values()].join('\n') + '\nfunction genericTariffPatch(){const patch={};\n' + genericTariffStatements.join('\n') + '\nreturn patch;}\nmodule.exports={applyTariffProviderUI,collectTariffProviderConfig,genericTariffPatch};',
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function form(config, missingControls = []) {
    const html = fs.readFileSync(path.join(sourceRoot, 'ui/www/ems-apps.html'), 'utf8');
    const options = new Map([...html.matchAll(/<select\b[^>]*\bid="(tariffProvider[^"]+)"[^>]*>([\s\S]*?)<\/select>/g)]
        .map(match => [match[1], new Set([...match[2].matchAll(/<option\b[^>]*\bvalue="([^"]*)"/g)].map(option => option[1]))]));
    const nodes = new Map([...html.matchAll(/<(?:input|select|textarea)\b[^>]*\bid="(tariffProvider[^"]+)"[^>]*>/g)]
        .map(match => {
            let value = '';
            const choices = options.get(match[1]);
            return [match[1], { type: /\btype="checkbox"/.test(match[0]) ? 'checkbox' : 'text', checked: false,
                get value() { return value; },
                set value(next) { value = choices && !choices.has(String(next)) ? '' : String(next); } }];
        }));
    for (const id of missingControls) nodes.delete(id);
    const module = { exports: {} };
    const context = { module, currentConfig: config, tariffProviderFormConfig: null, tariffProviderFormBaseline: null, document: { getElementById: id => nodes.get(id) || null },
        loadTariffProviderRegistry: async () => ({}), _coupleTariffProviderDatapointsSync() {} };
    vm.runInNewContext(compiled, context);
    module.exports.applyTariffProviderUI(config.tariffProvider);
    return { collect: () => JSON.parse(JSON.stringify(module.exports.collectTariffProviderConfig())),
        patch: () => JSON.parse(JSON.stringify(module.exports.genericTariffPatch())), nodes, context,
        apply: value => module.exports.applyTariffProviderUI(value) };
}

test('unrelated App-Center save must preserve a previously saved Tibber provider and secret', async t => {
    const h = await createHarness(); t.after(() => h.close()); const a = h.adapter;
    a.persistInstallerConfigToState = Object.getPrototypeOf(a).persistInstallerConfigToState.bind(a);
    a.nwWriteUserdataBackup = async () => {};
    a._nwApplyInstallerRuntime = async () => {};
    a.emsEngine = { stopForReconfigure: async () => {} };
    const expected = { enabled: true, providerId: 'tibber', sourceId: 'tibber', country: 'DE',
        endpoint: 'https://api.tibber.com/v1-beta/gql', homeId: 'synthetic-home-retained',
        credentials: { accessToken: 'synthetic-token-never-expose' }, autoCoupleDatapoints: false,
        activateTariffLogic: false, automaticMode: false, resolutionMinutes: 15, refreshMinutes: 45 };
    const config = { tariffProvider: expected, settingsConfig: { evcsCount: 0, evcsList: [] } };
    a._nwInstallerConfigPatch = structuredClone(config);
    a._nwInstallerConfigRawPatch = structuredClone(config);
    a.config = a.nwApplyInstallerPatchToRuntimeConfig(a.config, structuredClone(config));
    a._nwInstallerConfigHydrated = true;
    assert.equal(await a.persistInstallerConfigToState(config), true);
    const token = await h.login('installer');
    const initial = await h.request('/api/customer/tariff-provider', { token });
    assert.equal(initial.status, 200); assert.equal(initial.data.config.providerId, 'tibber');
    assert.equal(initial.data.credentialsPresent.accessToken, true);
    const loaded = await h.request('/api/installer/config', { token });
    assert.equal(loaded.status, 200);
    assert.equal(loaded.text.includes(expected.credentials.accessToken), false);
    const frontend = form(loaded.data.config);
    const frontendPatch = frontend.patch();
    const saved = await h.request('/api/installer/config', { method: 'POST', token, body: {
        patch: { schedulerIntervalMs: 1200, ...frontendPatch }, expectedConfigurationRevision: loaded.data.configurationRevision, restartEms: false,
    } });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    const stored = JSON.parse(h.states.get('eos-admin.0.installer.configJson').val);
    assert.equal(Object.hasOwn(loaded.data.config, 'tariffProvider'), true, 'installer response must include masked persisted tariff');
    assert.equal(loaded.data.config.tariffProvider.credentials.accessToken, '__KEEP__');
    assert.equal(Object.hasOwn(frontendPatch, 'tariffProvider'), false, 'unchanged tariff does not participate in another settings save');
    assert.equal(stored.tariffProvider.providerId, 'tibber', 'unrelated settings save must not replace tariff with UI defaults');
    assert.equal(stored.tariffProvider.enabled, true);
    assert.equal(stored.tariffProvider.homeId, expected.homeId);
    assert.equal(stored.tariffProvider.credentials.accessToken, expected.credentials.accessToken);
});


test('absent tariff controls must not clear a loaded masked credential or home during an unrelated save', () => {
    const expected = { enabled: true, providerId: 'tibber', sourceId: 'tibber', country: 'DE', homeId: 'synthetic-home-retained',
        credentials: { accessToken: '__KEEP__' }, resolutionMinutes: 15, refreshMinutes: 45 };
    const frontend = form({ tariffProvider: expected }, ['tariffProviderAccessToken', 'tariffProviderHomeId']);
    const submitted = frontend.collect();
    assert.equal(submitted.credentials.accessToken, '__KEEP__', 'absent secret field is not an explicit clear request');
    assert.equal(submitted.homeId, expected.homeId, 'absent home field is not an explicit clear request');
});


test('unconfirmed or unrendered tariff data never injects defaults into generic EMS saves', () => {
    const missing = form({});
    assert.deepEqual(missing.patch(), {});
    const replacement = form({ tariffProvider: { providerId: 'tibber', enabled: true, credentials: { accessToken: '__KEEP__' } } });
    replacement.context.currentConfig = { tariffProvider: { providerId: 'tibber', enabled: true, homeId: 'new-snapshot' } };
    assert.deepEqual(replacement.patch(), {}, 'a different config snapshot requires rendering its own fields first');
});

test('missing numeric, flag and formula controls preserve stored values without granting tariff activation', () => {
    const existing = { enabled: true, providerId: 'tibber', sourceId: 'tibber', country: 'DE',
        activateTariffLogic: false, automaticMode: false, autoCoupleDatapoints: false,
        resolutionMinutes: 30, refreshMinutes: 45, feedInEurPerKwh: 0.084, timeZone: 'Europe/Berlin',
        homeId: 'home', credentials: { accessToken: '__KEEP__' },
        formula: { marketMultiplier: 1.13, supplierMarkupEurPerKwh: 0.037, gridVariableEurPerKwh: 0.11,
            taxEurPerKwh: 0.02, otherVariableEurPerKwh: 0.01, vatPct: 19, priceIncludesVat: false } };
    const absent = ['tariffProviderActivateLogic', 'tariffProviderAutomaticMode', 'tariffProviderAutoCouple',
        'tariffProviderResolution', 'tariffProviderRefresh', 'tariffProviderFeedIn', 'tariffProviderTimeZone',
        'tariffProviderMarketMultiplier', 'tariffProviderSupplierMarkup', 'tariffProviderGridVariable',
        'tariffProviderTax', 'tariffProviderOtherVariable', 'tariffProviderVatPct'];
    const f = form({ tariffProvider: existing }, absent);
    f.nodes.get('tariffProviderHomeId').value = 'deliberately-updated-home';
    const next = f.patch().tariffProvider;
    assert.ok(next, 'a deliberate rendered edit still participates in save');
    for (const key of ['activateTariffLogic', 'automaticMode', 'autoCoupleDatapoints', 'resolutionMinutes', 'refreshMinutes', 'feedInEurPerKwh', 'timeZone']) assert.equal(next[key], existing[key], key);
    assert.deepEqual(next.formula, existing.formula);
    assert.equal(next.credentials.accessToken, '__KEEP__');
});

test('explicit rendered field clearing and source changes remain intentional tariff edits', () => {
    const original = { enabled: true, providerId: 'tibber', sourceId: 'tibber', country: 'DE', homeId: 'home', credentials: { accessToken: '__KEEP__' } };
    const f = form({ tariffProvider: original });
    assert.deepEqual(f.patch(), {});
    f.nodes.get('tariffProviderAccessToken').value = '';
    f.nodes.get('tariffProviderHomeId').value = '';
    const clear = f.patch().tariffProvider;
    assert.equal(clear.credentials.accessToken, '');
    assert.equal(clear.homeId, '');
    f.nodes.get('tariffProviderId').value = 'manual-dp';
    f.nodes.get('tariffProviderEnabled').value = 'false';
    assert.equal(f.patch().tariffProvider.providerId, 'manual-dp');
    assert.equal(f.patch().tariffProvider.enabled, false);
    const replacement = form({ tariffProvider: original });
    replacement.nodes.get('tariffProviderAccessToken').value = 'synthetic-explicit-new-token';
    assert.equal(replacement.patch().tariffProvider.credentials.accessToken, 'synthetic-explicit-new-token');
});

test('unrendered custom request fields retain masked headers, body and deliberately empty JSON paths', () => {
    const existing = { enabled: true, providerId: 'custom-rest', sourceId: 'custom-rest', country: 'DE',
        credentials: { bearerToken: '__KEEP__', tokenUrl: '' }, tokenUrl: 'https://fixture.example/token',
        customRest: { headersJson: '__KEEP__', body: '__KEEP__', method: 'POST', startPath: '', endPath: '', pricePath: '', unit: 'ct/kWh' } };
    const f = form({ tariffProvider: existing }, ['tariffProviderHeadersJson', 'tariffProviderTokenUrl',
        'tariffProviderRestMethod', 'tariffProviderStartPath', 'tariffProviderEndPath', 'tariffProviderPricePath', 'tariffProviderUnit']);
    f.nodes.get('tariffProviderRefresh').value = '60';
    const next = f.patch().tariffProvider;
    for (const [key, value] of Object.entries(existing.customRest)) assert.equal(next.customRest[key], value, key);
    assert.equal(next.credentials.bearerToken, '__KEEP__');
    assert.equal(next.credentials.tokenUrl, '');
    assert.equal(next.tokenUrl, existing.tokenUrl);
});

test('editing one tariff field does not persist rendered defaults for other untouched fields', () => {
    const existing = { enabled: true, providerId: 'custom-rest', sourceId: 'custom-rest',
        credentials: { bearerToken: '__KEEP__' },
        customRest: { headersJson: '__KEEP__', body: '__KEEP__', startPath: '', endPath: '', pricePath: '' } };
    const f = form({ tariffProvider: existing });
    f.nodes.get('tariffProviderRefresh').value = '60';
    const next = f.patch().tariffProvider;
    assert.deepEqual(next, { ...existing, refreshMinutes: 60 });
    assert.equal(Object.hasOwn(next, 'activateTariffLogic'), false, 'render defaults do not grant activation');
    assert.equal(Object.hasOwn(next, 'formula'), false);
    assert.deepEqual(existing.customRest, { headersJson: '__KEEP__', body: '__KEEP__', startPath: '', endPath: '', pricePath: '' });
});
