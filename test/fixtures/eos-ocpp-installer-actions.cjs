'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = process.env.EOS_OCPP_FRONTEND_BASELINE || path.resolve(__dirname, '../..');
const filename = path.join(root, 'ui/src-ts/runtime-executables/www/ems-apps.ts');
const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const selected = new Map();
const names = ['_ocppStationIdentityFromDp', '_ocppStationIdentitiesFromRow', '_ocppStationIdentityFromRow', '_ocppStationIdentityFromConnector',
    '_isKnownLegacyNexoWattOcppMapping', '_isEmptyEvcsMappingRow', '_applyOcppConnectorToRow',
    '_updateEvcsField', 'setDirty', 'clearDirty', 'appCenterDraftSnapshot', 'hasAppCenterDraftChanges', 'fetchOcppDiscovery', 'ocppAutoDetect', 'ocppMapExisting', '_ensureSettingsConfig', '_ensureEvcsList', '_clampInt'];
function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) selected.set(node.name.text, node.getText(source));
    ts.forEachChild(node, visit);
}
visit(source);
for (const name of names.filter(name => !['_ocppStationIdentitiesFromRow', 'appCenterDraftSnapshot', 'hasAppCenterDraftChanges'].includes(name))) assert.ok(selected.has(name), `production function ${name} exists`);
const compiled = ts.transpileModule(`${[...selected.values()].join('\n')}\nmodule.exports={${[...selected.keys()].join(',')}};`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const clone = value => JSON.parse(JSON.stringify(value));
function connector(base = 'eos-admin.0.ocpp.ENERGYLINE') {
    return { base, stationKey: base, name: 'Energyline', connectorNo: 1, telemetryProfile: 'nexowattocpp',
        controlPreference: 'powerW', contractVersion: 'nexowatt-ocpp21-0.4-native',
        ids: { powerId: `${base}.measurements.powerW`, setPowerWId: `${base}.control.chargeLimit`,
            enableWriteId: `${base}.control.availability`, onlineId: `${base}.info.socketConnected` } };
}
function fixture(rows = [], connectors = [connector()], declaredCount = rows.length) {
    const module = { exports: {} }, statuses = [];
    const context = {
        module, currentConfig: { settingsConfig: { evcsCount: declaredCount, evcsList: clone(rows),
            stationGroups: [{ stationKey: 'manual-group', name: 'Vom Installateur', maxPowerKw: 22 }] } },
        configurationRevision: 'original-cas-token', evcsExplicitEmpty: false, appCenterMutationBusy: false,
        appCenterConfigDirty: true, appCenterLoadedDraftSnapshot: null,
        document: { querySelectorAll: () => [] },
        els: { evcsCount: { value: String(declaredCount) } }, window: { confirm: () => true },
        _maxEvcsCount: () => 50, fetches: 0, dirty: 0,
        async fetchJson(url) { assert.equal(url, '/api/ocpp/discover'); context.fetches++; return { connectors: clone(connectors) }; },
        beginAppCenterMutation() {
            if (context.appCenterMutationBusy) throw new Error('MUTATION_BUSY');
            context.appCenterMutationBusy = true;
            return () => { context.appCenterMutationBusy = false; };
        },
        async loadConfig() {},
        setStatus: (...args) => statuses.push(args), setDirty: () => { context.dirty++; context.appCenterConfigDirty = true; },
        buildEvcsUI() {}, buildStationGroupsUI() {}, scheduleValidation() {},
    };
    vm.runInNewContext(compiled, context, { filename: 'actual-ems-apps-discovery-actions.js', timeout: 1000 });
    if (module.exports.appCenterDraftSnapshot) context.appCenterLoadedDraftSnapshot = module.exports.appCenterDraftSnapshot();
    return { api: module.exports, context, statuses, rows: () => clone(context.currentConfig.settingsConfig.evcsList) };
}

module.exports = { fixture, connector, clone };
