'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const Module = require('node:module');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const runtimePath = path.join(root, 'ui/main.js');
// Execute the real generated class unchanged; expose its constructor to this
// isolated test module only. Product exports and repository files are untouched.
const executable = new Module(runtimePath, module);
executable.filename = runtimePath;
executable.paths = Module._nodeModulePaths(path.dirname(runtimePath));
executable._compile(fs.readFileSync(runtimePath, 'utf8') + '\nmodule.exports.NexoWattVis = NexoWattVis;\n', runtimePath);
const { NexoWattVis } = executable.exports;
const { TarifVisModule } = require(path.join(root, 'ui/ems/modules/tarif-vis.js'));
const { Para14aModule } = require(path.join(root, 'ui/ems/modules/para14a.js'));
const { registerSmartHomeDeviceApi } = require(path.join(root, 'ui/lib/smarthome-device-api.js'));
const express = Module.createRequire(path.join(root, 'package.json'))('express4');

async function fixture(t, migrated = false, historyCsv = '') {
    const writes = []; const states = new Map(); let canWrite = true; let failure = false;
    const server = http.createServer(async (req, res) => {
        let body = ''; for await (const part of req) body += part;
        writes.push({ path: req.url, body });
        if (req.url.startsWith('/api/v2/query')) { res.statusCode = 200; res.end(historyCsv); }
        else { res.statusCode = 204; res.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const history = { provider: 'influxdb2', influxdb2: { url: `http://127.0.0.1:${server.address().port}`, organization: 'EOS', bucket: 'EOS', token: 'synthetic-review-only' } };
    const owner = {
        namespace: 'eos-admin.0', instance: 0,
        config: { eosUi: { history }, ...(migrated ? { eosUiMigration: { preserveNamespace: true, source: 'nexowatt-ui.0' } } : {}) },
        log: { warn() {}, error() {}, info() {}, debug() {} },
        getStateAsync: async id => states.get(`eos-admin.0.${id}`) || null,
        getForeignStateAsync: async id => states.get(id) || null,
        async setForeignStateAsync(id, state, ack) {
            if (failure) throw new Error('synthetic persistence failure');
            states.set(id, typeof state === 'object' ? structuredClone(state) : { val: state, ack });
        },
    };
    const adapter = new NexoWattVis({ owner, bridge: { canWrite: () => canWrite, originAllowed: () => true, resolveAccess: async () => ({}), getLicense: () => ({ valid: true }) } });
    adapter._nwConfigureHistory();
    t.after(async () => { adapter._nwDirectHistory.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    return { adapter, writes, states, setPermission(value) { canWrite = value; }, failPersistence() { failure = true; } };
}

for (const migrated of [false, true]) test(`actual TarifVis → hosted adapter → HTTP history preserves negative price and namespace (migration=${migrated})`, async t => {
    const f = await fixture(t, migrated); const { adapter } = f;
    adapter._nwDirectHistory.register('tarif.preisAktuellEurProKwh');
    const module = new TarifVisModule(adapter, null);
    const before = Date.now();
    await module._setIfChanged('tarif.preisAktuellEurProKwh', -0.125);
    const after = Date.now();
    await adapter._nwDirectHistory.flush();
    assert.equal(f.writes.length, 1);
    const expectedNamespace = migrated ? 'nexowatt-ui.0' : 'eos-admin.0';
    const match = f.writes[0].body.match(/^(\S+) value=-0\.125 (\d+)$/);
    assert.ok(match); assert.equal(match[1], `${expectedNamespace}.tarif.preisAktuellEurProKwh`);
    assert.ok(Number(match[2]) >= before && Number(match[2]) <= after);
    await module._setIfChanged('tarif.preisAktuellEurProKwh', -0.125);
    await adapter._nwDirectHistory.flush();
    assert.equal(f.writes.length, 1, 'unchanged module value is not duplicated');
    assert.equal(adapter._nwDirectHistory.status().writeVerified, true);
});

test('actual Para14a publication retains source timestamp; denied and failed state writes never reach Influx', async t => {
    const f = await fixture(t); const { adapter } = f;
    adapter._nwDirectHistory.register('para14a.audit.gridPowerW');
    const module = new Para14aModule(adapter, null);
    const ts = Date.now() - 12345;
    await module._setState('para14a.audit.gridPowerW', 0, { force: true, ts });
    await adapter._nwDirectHistory.flush();
    assert.equal(f.writes[0].body, `eos-admin.0.para14a.audit.gridPowerW value=0 ${ts}`);
    f.setPermission(false);
    await assert.rejects(module._setState('para14a.audit.gridPowerW', 42, { force: true, ts }), /OWNERSHIP_LOST/);
    f.setPermission(true); f.failPersistence();
    await assert.rejects(module._setState('para14a.audit.gridPowerW', 43, { force: true, ts }), /synthetic persistence failure/);
    await adapter._nwDirectHistory.flush();
    assert.equal(f.writes.length, 1);
});

test('unregistered physical states remain outside direct historian scope', async t => {
    const f = await fixture(t);
    await f.adapter.setStateAsync('devices.ess1.power', { val: 12, ack: true });
    await f.adapter._nwDirectHistory.flush();
    assert.equal(f.writes.length, 0);
});

for (const type of ['number', 'boolean']) test(`actual SmartHome history route → main dispatch → Influx minmax preserves ${type} values`, async t => {
    const end = Date.now(); const start = end - 10000;
    const values = type === 'number' ? [0, -7, 42, 0] : [false, true, false, true];
    const times = values.map((_, index) => start + (index + 1) * 1000);
    const csv = `#datatype,string,long,dateTime:RFC3339,${type === 'number' ? 'double' : 'boolean'}\n,result,table,_time,_value\n` +
        values.map((value, index) => `,,0,${new Date(times[index]).toISOString()},${value}\n`).join('');
    const f = await fixture(t, false, csv);
    const key = type === 'number' ? 'ACTUAL' : 'SET';
    const objectId = `fixture.0.${type}`;
    const device = { id: 'sensor', io: { deviceControls: { profile: type === 'number' ? 'temperature' : 'socket', fields: [{ key, readId: objectId }] } } };
    const app = express(); const guard = (_req, _res, next) => next();
    registerSmartHomeDeviceApi(app, {
        device: () => device, canOperate: () => true, authorize: async () => true,
        readObject: async () => ({ type: 'state', common: { type, read: true, write: false } }),
        readState: async () => null, writeState: async () => { throw new Error('No physical writes in history test'); },
        history: (id, options) => new Promise(resolve => f.adapter._nwDispatchHistory('eos-direct-influxdb2', { id, options: { ...options, addId: false, ignoreNull: true, limit: 1000 } }, resolve)),
    }, guard, guard);
    const server = http.createServer(app); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const query = new URLSearchParams({ id: 'sensor', key, from: String(start), to: String(end), maxPoints: '4' });
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/smarthome/control-history?${query}`);
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.deepEqual(body.points, values.map((value, index) => ({ ts: times[index], value })));
    assert.equal(f.writes.length, 1);
    assert.match(JSON.parse(f.writes[0].body).query, /_field == "value"/);
});

test('migrated §14a logging follows the configured legacy historian through read outages, a disabled source and recovery', async t => {
    const { adapter } = await fixture(t, true);
    adapter.config.history = { instance: 'influxdb.4' };
    let sourceState = 'unreadable';
    const registered = [], disabled = [], configured = [], auditStates = new Map();
    adapter.getForeignObjectAsync = async id => {
        if (id === 'system.adapter.influxdb.4') {
            if (sourceState === 'unreadable') throw new Error('simulated controller read failure');
            if (sourceState === 'absent') return null;
            return { type: 'instance', common: { name: 'influxdb', enabled: sourceState === 'enabled' }, native: {} };
        }
        throw new Error('Unexpected history object lookup ' + id);
    };
    adapter._nwListAdapterInstances = async () => [
        { instanceId: 'influxdb.0', num: 0, obj: { common: { enabled: true }, native: {} } },
        { instanceId: 'influxdb.20', num: 20, obj: { common: { enabled: true }, native: { nexowattDedicatedPara14a: true, nexowattManagedFor: 'para14a', nexowattManagedBy: adapter.namespace } } },
    ];
    adapter._nwDetectInfluxInstance = async () => 'influxdb.0';
    adapter._nwEnsureInfluxCustom = async (name, instance) => registered.push([name, instance]);
    adapter.nwSimSetInstanceEnabled = async (name, enabled) => disabled.push([name, enabled]);
    const module = new Para14aModule(adapter, {});
    module._setStateIfChanged = async (name, value) => auditStates.set(name, value);
    for (sourceState of ['unreadable', 'absent', 'disabled', 'enabled']) {
        const result = await adapter._nwEnsurePara14aInfluxInstance();
        await module._setupAuditHistory();
        assert.equal(result.instance, 'influxdb.4');
        assert.equal(result.ready, sourceState === 'enabled');
        assert.equal(auditStates.get('para14a.audit.historyInstance'), 'influxdb.4');
        assert.equal(auditStates.get('para14a.audit.historyEnabled'), sourceState === 'enabled');
        if (sourceState !== 'enabled') assert.equal(registered.length, 0);
        configured.push(adapter.config.history.instance);
    }
    assert.deepEqual(disabled, []);
    assert.ok(registered.length > 0);
    assert.ok(registered.every(([, instance]) => instance === 'influxdb.4'));
    assert.deepEqual([...new Set(configured)], ['influxdb.4']);
});
