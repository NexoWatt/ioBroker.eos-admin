'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const Module = require('node:module');
const path = require('node:path');
const root = '/workspace/scratch/741f792566ea/source-920/iobroker.eos-admin';
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

async function fixture(t, migrated = false) {
    const writes = []; const states = new Map(); let canWrite = true; let failure = false;
    const server = http.createServer(async (req, res) => {
        let body = ''; for await (const part of req) body += part;
        writes.push({ path: req.url, body }); res.statusCode = 204; res.end();
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
