'use strict';
// Independent behavior review of the actual installer functions, not a duplicate implementation.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../ui/src-ts/runtime-executables/www/ems-apps.ts');
const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const names = ['_ocppStationIdentityFromDp', '_ocppStationIdentityFromRow', '_ocppStationIdentityFromConnector',
    '_isKnownLegacyNexoWattOcppMapping', '_applyOcppConnectorToRow'];
const selected = new Map();
function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) selected.set(node.name.text, node.getText(source));
    ts.forEachChild(node, visit);
}
visit(source);
for (const name of names) assert.ok(selected.has(name), `production function ${name} exists`);
const moduleFixture = { exports: {} };
const compiled = ts.transpileModule(`${[...selected.values()].join('\n')}\nmodule.exports={${names.join(',')}};`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(compiled, { module: moduleFixture }, { filename: 'actual-ems-apps-ocpp-functions.js', timeout: 1000 });
const api = moduleFixture.exports;
const clone = value => JSON.parse(JSON.stringify(value));
function connector(root) {
    return { stationKey: root, base: root, name: 'Neue Station', connectorNo: 1,
        telemetryProfile: 'nexowattocpp', controlPreference: 'powerW', contractVersion: 'nexowatt-ocpp21-0.4-native',
        ids: { powerId: `${root}.measurements.powerW`, setPowerWId: `${root}.control.chargeLimit`,
            onlineId: `${root}.info.socketConnected`, enableWriteId: `${root}.control.availability` } };
}

test('manual hosted/native OCPP detection cannot pre-enable a new station or assume AC electrical settings', () => {
    for (const root of ['eos-admin.0.ocpp.CP_DC', 'ocpp21.0.CP_DC']) for (const options of [{ onlyEmpty: true }, { overwrite: true }]) {
        // The native contract carries protocol/identity, not an AC/DC electrical attestation.
        const result = clone(api._applyOcppConnectorToRow({}, connector(root), options));
        assert.equal(result.enabled, false, `${root}: commissioning must remain explicit`);
        for (const field of ['chargerType', 'minCurrentA', 'maxCurrentA', 'minPowerW', 'maxPowerW', 'phases', 'voltageV']) {
            assert.equal(Object.hasOwn(result, field), false, `${root}: no invented ${field}`);
        }
        assert.equal(result.setPowerWId, `${root}.control.chargeLimit`);
        assert.equal(result.powerId, `${root}.measurements.powerW`);
    }
});

test('mapping a known native station preserves the installer-approved activation and electrical settings', () => {
    for (const root of ['eos-admin.0.ocpp.CP_DC', 'ocpp21.0.CP_DC']) for (const enabled of [true, false]) {
        const existing = { enabled, chargerType: 'dc', minCurrentA: 0, maxCurrentA: 125, minPowerW: 1200,
            maxPowerW: 50000, phases: 3, voltageV: 400, note: 'Geprüfte Grenzen', powerId: `${root}.measurements.powerW` };
        const before = structuredClone(existing);
        for (const options of [{ onlyEmpty: true }, { overwrite: true }]) {
            const result = clone(api._applyOcppConnectorToRow(existing, connector(root), options));
            for (const field of Object.keys(existing)) assert.deepEqual(result[field], existing[field], `${root}: preserves ${field}`);
            assert.equal(result.setPowerWId, `${root}.control.chargeLimit`);
            assert.deepEqual(existing, before, 'mapping produces a draft without mutating the stored row');
        }
    }
});

test('station identities retain exact hosted namespace and legacy aliases without conflating equal station names', () => {
    const get = api._ocppStationIdentityFromDp;
    const identities = ['eos-admin.0.ocpp.CP_1', 'eos-admin.1.ocpp.CP_1', 'eos-admin.10.ocpp.CP_1', 'ocpp21.0.CP_1', 'ocpp21.1.CP_1']
        .map(root => get(`${root}.measurements.powerW`));
    assert.equal(new Set(identities).size, identities.length);
    assert.equal(get('alias.0.nexowatt.ocpp.0.CP_1.powerW'), get('ocpp21.0.CP_1.measurements.powerW'));
    assert.equal(get('alias.0.ocpp21.0.CP_1.powerW'), get('ocpp21.0.CP_1.measurements.powerW'));
    for (const id of ['eos-admin.0.ocpp2.CP_1.measurements.powerW', 'x.eos-admin.0.ocpp.CP_1.measurements.powerW', 'eos-admin.0x.ocpp.CP_1']) assert.equal(get(id), '');
    assert.equal(api._ocppStationIdentityFromRow({ stationKey: 'CP_1', adapterInstance: 'eos-admin.0.ocpp' }), get('eos-admin.0.ocpp.CP_1'));
    assert.equal(api._ocppStationIdentityFromConnector(connector('eos-admin.1.ocpp.CP_1')), get('eos-admin.1.ocpp.CP_1'));
});
