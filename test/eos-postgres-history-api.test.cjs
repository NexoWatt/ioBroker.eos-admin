'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const { PostgresHistoryClient } = require('../ui/lib/postgres-history');
const { InfluxHistoryRuntime } = require('../ui/lib/influx-history-runtime');
const candidate = { provider: 'postgresql', postgresql: { profile: 'local' }, newInstallation: true };
async function fixture(t) {
    const h = await createHarness(); const a = h.adapter;
    a.config.history = { instance: 'influxdb.0', datapoints: { pvPower: 'customer.pv' } };
    a._nwHistoryExistingInstallation = false;
    a._nwInstallerConfigPatch = { storageFarm: { storages: [{ name: 'Retained' }] } };
    a.persistInstallerConfigToState = Object.getPrototypeOf(a).persistInstallerConfigToState.bind(a);
    a._nwProtectCredentialState = async () => {};
    a.updateHistorieExportStates = async () => {};
    t.after(async () => { a._nwDirectHistory.close(); await h.close(); });
    const token = await h.login('admin');
    return { ...h, a, token, save: async history => h.request('/api/installer/history', { token, method: 'POST', body: { history, expectedConfigurationRevision: a._nwInstallerConfigRevision() } }) };
}

test('PG selection fails closed on existing history, missing explicit intent and missing setup', async t => {
    const h = await fixture(t);
    h.a._nwInstallerConfigPatch.history = { instance: 'influxdb.0' };
    assert.equal((await h.save(candidate)).data.error, 'EOS_POSTGRES_EXISTING_HISTORY');
    delete h.a._nwInstallerConfigPatch.history;
    h.a._nwHistoryExistingInstallation = true;
    assert.equal((await h.save(candidate)).data.error, 'EOS_POSTGRES_EXISTING_HISTORY');
    h.a._nwHistoryExistingInstallation = false;
    assert.equal((await h.save({ provider: 'postgresql', postgresql: { profile: 'local' } })).data.error, 'EOS_POSTGRES_NEW_INSTALLATION_REQUIRED');
    const notReady = await h.save(candidate);
    assert.equal(notReady.status, 503); assert.match(notReady.data.error, /^EOS_POSTGRES_/);
    assert.equal(h.a.config.history.provider, undefined); assert.equal(h.states.has('eos-admin.0.installer.configJson'), false);
});

test('installed historian and unreadable instance inventory prevent new-install selection; no guessed eligibility', async t => {
    const h = await fixture(t);
    assert.equal(await h.a._nwHistoryNewInstallationAllowed(), true);
    h.a.getForeignObjectsAsync = async () => ({ 'system.adapter.influxdb.0': { common: {} } });
    assert.equal(await h.a._nwHistoryNewInstallationAllowed(), false);
    h.a.getForeignObjectsAsync = async () => { throw new Error('read failure'); };
    assert.equal(await h.a._nwHistoryNewInstallationAllowed(), false);
    h.a.getForeignObjectsAsync = async () => ({});
    h.a._nwHistoryExistingInstallation = undefined;
    assert.equal(await h.a._nwHistoryNewInstallationAllowed(), false);
});

test('PG authenticated save/read/dispatch retains device mappings, original export IDs and scoped backup identity', async t => {
    const h = await fixture(t);
    const original = PostgresHistoryClient.prototype.check;
    PostgresHistoryClient.prototype.check = async () => ({ reachable: true, readable: true });
    t.after(() => { PostgresHistoryClient.prototype.check = original; });
    const saved = await h.save(candidate); assert.equal(saved.status, 200, saved.text);
    assert.equal(saved.data.config.provider, 'postgresql'); assert.equal(saved.data.config.postgresql.profile, 'local');
    assert.equal(saved.data.config.newInstallationAllowed, false);
    assert.deepEqual(h.a._nwInstallerConfigPatch.storageFarm, { storages: [{ name: 'Retained' }] });
    assert.deepEqual(h.a.config.history.datapoints, { pvPower: 'customer.pv' });
    assert.deepEqual(h.a.getHistoryBackupRequirement(), { provider: 'postgresql', namespace: 'eos-admin.0' });
    assert.equal(h.a._nwGetHistoryInstance(), 'eos-direct-postgresql');
    const obj = h.objects.get('eos-admin.0.historie.core.grid.buyW');
    assert.ok(obj); assert.equal(obj.common.custom, undefined, 'PG registration must not enable old Influx adapter custom');
    h.a._nwDirectHistory.close(); let request;
    h.a._nwDirectHistory = new InfluxHistoryRuntime('eos-admin.0', undefined, () => ({ close() {}, write: async () => {}, query: async (id, options) => { request = { id, options }; return { result: [{ ts: 1000, val: -50 }] }; } }));
    const payload = { id: 'eos-admin.0.historie.core.grid.netW', options: { start: 1000, end: 2000 } };
    const result = await new Promise(resolve => h.a._nwDispatchHistory('ignored', payload, resolve));
    assert.deepEqual(request, payload); assert.deepEqual(result.result, [{ ts: 1000, val: -50 }]);
    const second = await h.save({ provider: 'postgresql', postgresql: { profile: 'local' } }); assert.equal(second.status, 200, second.text);
    assert.ok(!JSON.stringify(second.data).includes('password'));
});


test('PG installer API inherits authentication, role, CSRF, revision and ownership checks', async t => {
    const h = await fixture(t);
    assert.equal((await h.request('/api/installer/history')).status, 401);
    assert.equal((await h.request('/api/installer/history', { token: await h.login('kunde') })).status, 403);
    assert.equal((await h.request('/api/installer/history', { token: h.token, method: 'POST', csrf: false, body: { history: candidate } })).status, 403);
    assert.equal((await h.request('/api/installer/history', { token: h.token, method: 'POST', body: { history: candidate, expectedConfigurationRevision: 'stale' } })).status, 409);
    h.bridge.canWrite = () => false;
    assert.equal((await h.save(candidate)).status, 503);
    assert.equal(h.states.has('eos-admin.0.installer.configJson'), false);
});


test('protected explicit new-site setup may follow empty first initialization but never bypass saved history', async t => {
    const h = await fixture(t); h.a._nwHistoryExistingInstallation = true;
    assert.equal(await h.a._nwHistoryNewInstallationAllowed(), false);
    h.a._nwPostgresProfileAvailable = async () => true;
    assert.equal(await h.a._nwHistoryNewInstallationAllowed(), true);
    h.a._nwInstallerConfigPatch.history = { instance: 'influxdb.0' };
    assert.equal(await h.a._nwHistoryNewInstallationAllowed(), false);
    delete h.a._nwInstallerConfigPatch.history;
    h.a._nwHistoryExistingInstallation = undefined;
    assert.equal(await h.a._nwHistoryNewInstallationAllowed(), false);
});


test('actual bundled native history defaults do not block an explicitly new site; any customer change does', async t => {
    const h = await fixture(t);
    h.owner.config.eosUi.history = structuredClone(require('../io-package.json').native.eosUi.history);
    h.a.config.history = structuredClone(h.owner.config.eosUi.history);
    assert.equal(await h.a._nwHistoryNewInstallationAllowed(), true);
    h.owner.config.eosUi.history.datapoints.pvPower = 'customer.changed.pv';
    assert.equal(await h.a._nwHistoryNewInstallationAllowed(), false);
});
