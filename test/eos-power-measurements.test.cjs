'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const helper = read('ui/src-ts/runtime-executables/www/power-measurements.ts');
const app = read('ui/src-ts/runtime-executables/www/app.ts');
const installer = read('ui/src-ts/runtime-executables/www/ems-apps.ts');

function functionText(source, name) {
    const file = ts.createSourceFile('source.ts', source, ts.ScriptTarget.ES2022, true);
    let found;
    const visit = node => {
        if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(file);
        else ts.forEachChild(node, visit);
    };
    visit(file);
    assert.ok(found, name);
    return found;
}

function context(extra = {}) {
    const ctx = vm.createContext({ window: {}, ...extra });
    const js = ts.transpileModule(helper, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
    vm.runInContext(js, ctx);
    return ctx;
}

test('EV card, sidebar, modal and flow use one source model; valid manual override wins, booleans never become watts', () => {
    const ctx = context();
    vm.runInContext(functionText(app, 'isMappedDatapoint'), ctx);
    vm.runInContext(functionText(app, 'getEvcsPowerW'), ctx);
    ctx.window.__nwCfg = { datapoints: { consumptionEvcs: 'ocpp.transactionActive' } };
    let states = { consumptionEvcs: true, 'evcs.totalPowerW': 10400 };
    ctx.getFreshFlowNumber = key => states[key];
    assert.equal(ctx.getEvcsPowerW(key => states[key]), 10400);
    states = { consumptionEvcs: 6000, 'evcs.totalPowerW': 10400 };
    assert.equal(ctx.getEvcsPowerW(key => states[key]), 6000, 'preserve a genuine explicitly mapped meter');
    states = { consumptionEvcs: 0, 'evcs.totalPowerW': 10400 };
    assert.equal(ctx.getEvcsPowerW(key => states[key]), 0, 'zero is a valid explicit measurement');
    ctx.window.__nwCfg = { datapointFlags: { consumptionEvcs: true } };
    assert.equal(ctx.getEvcsPowerW(key => states[key]), 0, 'redacted customer config preserves mapped power authority');
    ctx.window.__nwCfg = { datapoints: {} };
    assert.equal(ctx.getEvcsPowerW(key => states[key]), 10400, 'no override: use actual connector aggregate');
    for (const value of [true, false, null, undefined, NaN, Infinity, '10400', {}]) {
        states = { consumptionEvcs: value, 'evcs.totalPowerW': value, evcsPower: value };
        assert.equal(ctx.getEvcsPowerW(key => states[key]), null);
    }
    for (const consumer of ['updateDashboardShellUi', 'updateEnergyWeb']) {
        assert.match(functionText(app, consumer), /getEvcsPowerW\(d\)/, consumer);
    }
    assert.match(app, /const evcsPowerNow = getEvcsPowerW\(d\);/);
    assert.match(app, /setText\('consumptionEvcs',[^\n]*evcsPowerNow === null \? '--'/);
    assert.match(app, /window\.__evcsApply = function\(d, s\)\{\s*const p = getEvcsPowerW\(d\)/);
    assert.match(app, /T\('c2Val', evcsPowerW === null \? '--'/, 'unknown flow power is not shown as 0 W');
});

test('actual App-Center validator rejects boolean/energy/invalid power states and accepts numeric W/kW', async () => {
    const badges = [];
    let metadata;
    const input = { value: 'test.power', id: 'dp_consumptionEvcs', dataset: { dpPower: '1' } };
    const ctx = context({
        document: { querySelectorAll: () => [input] },
        _setBadge: (...args) => badges.push(args), _fmtAge: value => String(value),
        setStatus() {}, fetchJson: async () => ({ ok: true, results: { 'test.power': metadata } }),
    });
    vm.runInContext(functionText(installer, 'runValidation'), ctx);
    for (const [type, unit, value, expected] of [
        ['boolean', '', true, 'error'], ['number', 'Wh', 100, 'error'],
        ['number', 'W', null, 'error'], ['number', 'W', false, 'error'],
        ['number', 'W', 10400, 'ok'], ['number', 'kW', 10.4, 'ok'],
        ['number', 'W', 0, 'ok'], ['number', '', 100, 'warn'],
    ]) {
        metadata = { exists: true, common: { type, unit, read: true }, statePresent: true, state: { val: value }, stale: false };
        await ctx.runValidation(false);
        assert.equal(badges.at(-1)[1], expected, `${type}/${unit}/${value}`);
    }
    metadata.stale = true; metadata.common.unit = 'W';
    await ctx.runValidation(false);
    assert.equal(badges.at(-1)[1], 'warn', 'freshness remains independently required');
    assert.match(installer, /if \(field\.power\) input\.dataset\.dpPower = '1'/);
    assert.match(installer, /dpInput\.dataset\.dpPower = '1'/);
});

test('every shipped entry point loads the measurement helper before its consuming script', () => {
    for (const page of ['index', 'settings', 'ems-apps']) {
        const html = read(`ui/www/${page}.html`);
        const script = page === 'ems-apps' ? 'ems-apps' : 'app';
        const first = html.indexOf('src="/static/power-measurements.js"');
        assert.ok(first >= 0 && first < html.indexOf(`src="/static/${script}.js"`), page);
    }
});

test('App-Center recovery and save roundtrip preserve separate battery-flow feedback without replacing controller feedback', () => {
    const ctx = context();
    for (const name of ['normalizeStorageVendorProfile', '_normalizeRecoveredStorageFarmRow', 'deepMerge']) {
        vm.runInContext(functionText(installer, name), ctx);
    }
    const base = 'eos-admin.0.devices.ess1';
    const row = {
        name: 'Home', vendorProfile: 'fenecon-openems',
        signedPowerId: `${base}.aliases.v1.r.essActivePower`,
        feneconEssActualPowerId: `${base}.aliases.v1.r.essActivePower`,
        batteryFlowPowerId: `${base}.aliases.v1.r.powerAc`,
    };
    const recovered = ctx._normalizeRecoveredStorageFarmRow(row, 0);
    const patch = ctx.deepMerge({}, { storages: [recovered] });
    const roundtrip = JSON.parse(JSON.stringify(patch));
    assert.equal(roundtrip.storages[0].batteryFlowPowerId, row.batteryFlowPowerId);
    assert.equal(roundtrip.storages[0].signedPowerId, row.signedPowerId);
    assert.equal(roundtrip.storages[0].feneconEssActualPowerId, row.feneconEssActualPowerId);
    assert.equal(ctx._normalizeRecoveredStorageFarmRow({ signedPowerId: row.signedPowerId }, 0).batteryFlowPowerId, '');
    assert.match(installer, /patch\.storageFarm = deepMerge\(\{\}, currentConfig\.storageFarm \|\| \{\}\)/);
    const parsed = ts.createSourceFile('ems-apps.ts', installer, ts.ScriptTarget.Latest, true);
    let handler;
    function findField(node) {
        if (ts.isCallExpression(node) && node.expression.getText(parsed) === 'mkDpField' &&
            node.arguments[0]?.text === 'Batterieanteil für Energiefluss (W)') handler = node.arguments[3];
        ts.forEachChild(node, findField);
    }
    findField(parsed);
    assert.ok(handler, 'actual editable battery-flow field exists');
    const edited = { storages: [{ ...row }, { ...row, name: 'Unchanged' }] };
    ctx._ensureStorageFarmCfg = () => edited;
    ctx.i = 0;
    const onChange = vm.runInContext('(' + handler.getText(parsed) + ')', ctx);
    onChange('fixture.0.battery-only');
    assert.equal(edited.storages[0].batteryFlowPowerId, 'fixture.0.battery-only');
    assert.equal(edited.storages[0].signedPowerId, row.signedPowerId);
    assert.equal(edited.storages[1].batteryFlowPowerId, row.batteryFlowPowerId);
    ctx.i = 5;
    assert.doesNotThrow(() => onChange('fixture.0.discarded'), 'a stale row index does not change another storage');
});

test('energy balance reports screenshot mismatch, preserves real zero and existing consumer magnitude semantics, and never invents negative residual',()=>{
 const f=context().window.NexoWattPowerMeasurements.resolveFlowBalance;
 const valid={load:9100,ev:6800,consumers:0,pv:2500,producers:0,grid:3800,battery:2800,subtractEv:true,evAvailable:true};
 assert.equal(f(valid).buildingW,2300);assert.equal(f(valid).mismatchW,null);
 const screenshot=f({...valid,load:13000,ev:10700});assert.equal(screenshot.buildingW,2300);assert.equal(screenshot.mismatchW,-3900);
 for(const value of [null,undefined,false,'13000',NaN,Infinity])assert.equal(f({...valid,load:value}).buildingW,null);
 assert.equal(f({...valid,load:1000,ev:4000}).buildingW,null);
 const zero=f({...valid,load:0,ev:0,pv:0,grid:0,battery:0});assert.equal(zero.buildingW,0);assert.equal(zero.mismatchW,null);
 assert.equal(f({...valid,load:5000,ev:-3000,consumers:1000}).buildingW,1000);
 assert.equal(f({...valid,consumers:null}).buildingW,null);
 assert.equal(f({...valid,ev:null}).buildingW,null);
 assert.equal(f({...valid,ev:null,evAvailable:false}).buildingW,9100);
 assert.equal(f({...valid,battery:null}).buildingW,2300);assert.match(f({...valid,battery:null}).status,/unvollständig/);
 assert.equal(f({...valid,ev:null,subtractEv:false}).buildingW,9100);
});
