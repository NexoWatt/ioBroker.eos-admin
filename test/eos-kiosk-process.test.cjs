/** Copyright (c) 2026 NexoWatt. Proprietary; see LICENSE. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { EventEmitter } = require('node:events');
const ts = require('typescript');
const baseDir = path.resolve(__dirname, '..');
const compiled = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-kiosk-process-'));
for (const name of ['eosKiosk', 'eosUiProcess', 'eosUiProcessWorker', 'eosUiProcessRpc', 'eosUiSecretCodec']) {
    fs.writeFileSync(path.join(compiled, `${name}.js`), ts.transpileModule(fs.readFileSync(path.join(baseDir, 'src/lib', `${name}.ts`), 'utf8'),
        { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText);
}
const { EosKiosk, kioskRouteAllowed, kioskSetAllowed } = require(path.join(compiled, 'eosKiosk'));
const { createEosUiProcess } = require(path.join(compiled, 'eosUiProcess'));
test.after(() => fs.rmSync(compiled, { recursive: true, force: true }));
function service() {
    const objects = new Map(), revocations = [];
    const storage = { namespace: 'eos-admin.0', secure: false,
        read: async id => objects.get(id) || null, write: async (id, object) => objects.set(id, structuredClone(object)),
        ready: async () => true, revoke: value => revocations.push(value) };
    return { kiosk: new EosKiosk(storage), storage, objects, revocations };
}
const req = (url = '/api/state', headers = {}) => ({ url, method: 'GET', headers });

test('generation rotation invalidates freshly bootstrapped request references and open kiosk streams', async () => {
    const { kiosk } = service(); await kiosk.initialize();
    await kiosk.save({ enabled: true, revision: 0 }, 'system.user.admin', async () => true);
    const request = req(); let cookie;
    kiosk.bootstrap(request, { cookie(name, value) { cookie = `${name}=${value}`; } });
    assert.ok(await kiosk.access(request));
    const response = new EventEmitter(); let ended = 0; response.end = () => { ended++; };
    assert.equal(kiosk.bindStream(request, response), true);
    await kiosk.save({ enabled: true, revision: 1 }, 'system.user.admin', async () => true);
    assert.equal(kiosk.token(request), ''); assert.equal(kiosk.csrf(request), '');
    assert.equal(await kiosk.access(request), null); assert.equal(ended, 1);
    assert.equal(await kiosk.access(req('/api/state', { cookie })), null);
});

test('storage, path, body and cookie parsing stay closed for malformed, foreign and stale input', async () => {
    const x = service(); await x.kiosk.initialize();
    await assert.rejects(x.kiosk.save({ enabled: true, revision: 0, role: 'admin' }, 'system.user.admin', async () => true), /KIOSK_REQUEST/);
    await x.kiosk.save({ enabled: true, revision: 0 }, 'system.user.admin', async () => true);
    await assert.rejects(x.kiosk.save({ enabled: false, revision: 0 }, 'system.user.admin', async () => true), /KIOSK_CONFLICT/);
    const request = req(); let cookie;
    x.kiosk.bootstrap(request, { cookie(name, value) { cookie = `${name}=${value}`; } });
    for (const url of ['/settings.html', '/static/settings.html', '/api/eos/kiosk', '/api/installer/config', '/api/set/%2e%2e/settings', '/static/../settings.html', '/static/%61dmin.js', '/api//state']) {
        assert.equal(kioskRouteAllowed(req(url)), false, url);
        assert.equal(await x.kiosk.access(req(url, { cookie })), null);
    }
    assert.equal(await x.kiosk.access(req('/api/auth/status?admin=1', { cookie })), null);
    assert.equal(await x.kiosk.access(req('/api/state', { cookie: `${cookie}; ${cookie}` })), null);
    assert.equal(await x.kiosk.access(req('/api/state', { cookie: cookie.slice(0, -1) + (cookie.endsWith('0') ? '1' : '0') })), null);
    for (const input of [null, [], {}, { scope: 'flow', key: 'device.0.raw', value: 1 }, { scope: 'settings', key: 'smtpPassword', value: 'test' },
        { scope: 'ems', key: 'evcs.1.goalTargetSocPct', value: Infinity }, { scope: 'ems', key: 'evcs.1.userMode', value: { toString: 'pv' } }]) {
        assert.equal(kioskSetAllowed(input), false);
    }
    const saved = x.objects.get(x.kiosk.id); saved.acl.object = 0x666;
    const restarted = new EosKiosk(x.storage); await restarted.initialize();
    assert.deepEqual(restarted.view(), { enabled: false, revision: 0, available: false });
});

test('current dashboard payloads remain usable without granting installer limits or arbitrary settings', () => {
    const commands = [
        ['ems', 'evcs.1.stationEnabled', false], ['ems', 'evcs.2.regEnabled', true],
        ...['auto', 'pv', 'minpv', 'boost'].map(mode => ['ems', 'evcs.1.userMode', mode]),
        ...['auto-pv', 'fixed-1p', 'fixed-3p'].map(mode => ['ems', 'evcs.1.phaseMode', mode]),
        ...['standard', 'strategy'].map(mode => ['ems', 'evcs.1.autoSource', mode]),
        ['ems', 'evcs.1.storageAssistEnabled', false], ['ems', 'evcs.global.storageAssistEnabled', true],
        ['ems', 'evcs.1.goalEnabled', true], ['ems', 'evcs.1.goalTargetSocPct', 80],
        ['ems', 'evcs.1.goalBatteryKwh', 60], ['ems', 'evcs.1.goalFinishTs', 1800000000000],
        ['settings', 'evcsActive', false], ['settings', 'evcsMode', 3], ['evcs', '1.mode', 2], ['evcs', '2.active', true],
        ['flow', 'producer.1.switch', false], ['flow', 'consumer.2.setpoint', 55],
        ['flow', 'consumer.1.regEnabled', true], ['flow', 'consumer.1.boost', false],
        ...['inherit', 'pvAuto', 'manual', 'manual1', 'manual2', 'manual3', 'off'].map(mode => ['flow', 'consumer.1.mode', mode]),
    ];
    for (const [scope, key, value] of commands) assert.equal(kioskSetAllowed({ scope, key, value }), true, `${scope}:${key}:${value}`);
    for (const key of ['maxCurrentA', 'minCurrentA', 'phaseLimitA', 'priority', 'fuseA']) {
        assert.equal(kioskSetAllowed({ scope: 'ems', key: `evcs.1.${key}`, value: 32 }), false);
    }
    for (const name of ['devices', 'layout', 'control-history']) assert.equal(kioskRouteAllowed(req(`/api/smarthome/${name}`)), true);
    for (const name of ['toggle', 'level', 'color', 'cover', 'player', 'climate', 'value', 'rtrSetpoint', 'scene/run', 'control', 'timers']) {
        assert.equal(kioskRouteAllowed({ ...req(`/api/smarthome/${name}`), method: 'POST' }), true);
    }
    for (const name of ['config', 'activation', 'aliases', 'control-profiles']) {
        assert.equal(kioskRouteAllowed(req(`/api/smarthome/${name}`)), false);
        assert.equal(kioskRouteAllowed({ ...req(`/api/smarthome/${name}`), method: 'POST' }), false);
    }
});

test('real UI child receives only parent kiosk identity; forged role/context headers and disabled cookies never unlock admin', async t => {
    const x = service(); await x.kiosk.initialize();
    await x.kiosk.save({ enabled: true, revision: 0 }, 'system.user.admin', async () => true);
    const owner = { namespace: 'eos-admin.0', instance: 0, config: { eosUi: { chargeKiosk: { enabled: true, stations: [{ id: 'station1', name: 'Fixture Station', token: 'station_fixture_0123456789abcdef0123456789abcdef', enabled: true, assignmentMode: 'manual', assignedChargepoints: ['lp1'], controlBridge: 'readonly' }] } }, port: 443, secure: true },
        log: { info() {}, warn() {}, error() {}, debug() {} },
        getForeignObjectAsync: async () => ({ native: {} }), getForeignStateAsync: async () => null,
        eosStateSubscriptions: { async acquireHost() { return async () => {}; } } };
    const bridge = { canWrite: () => false, originAllowed: () => true, machineRequestAllowed: () => false,
        isListening: () => true, getLicense: () => ({ valid: true, coreEnabled: true, edition: 'pro', limits: { chargePoints: 10, batteries: 5 }, features: ['energy', 'chargeKiosk'] }),
        resolveAccess: async request => await x.kiosk.access(request) || { authenticated: false } };
    const runtime = createEosUiProcess(owner, bridge, { baseDir, workerPath: path.join(compiled, 'eosUiProcessWorker.js'), runtimePath: path.join(baseDir, 'ui/main.js') });
    await runtime.start(); t.after(() => runtime.stop());
    const app = express();
    app.use((request, response, next) => { x.kiosk.bootstrap(request, response); runtime.handle(request, response, next); });
    app.use((_request, response) => response.status(404).end());
    const server = http.createServer(app); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(base + '/api/state');
    assert.equal(response.status, 200, await response.text());
    const cookie = response.headers.getSetCookie()[0].split(';')[0];
    assert.notEqual(runtime.status().process.pid, process.pid);
    const stationUrl = '/api/display/station/station_fixture_0123456789abcdef0123456789abcdef';
    const stationBefore = await fetch(base + stationUrl);
    assert.equal(stationBefore.status, 200, await stationBefore.text());
    const headers = { cookie, 'x-user': 'system.user.admin', 'x-role': 'admin', 'x-eos-process-context': 'a'.repeat(48) };
    assert.equal((await fetch(base + '/api/installer/config', { headers })).status, 401);
    assert.equal((await fetch(base + '/api/state', { headers })).status, 200);
    await x.kiosk.save({ enabled: false, revision: 1 }, 'system.user.admin', async () => true);
    assert.equal((await fetch(base + '/api/state', { headers })).status, 401);
    assert.equal((await fetch(base + '/api/installer/config', { headers })).status, 401);
    const stationAfter = await fetch(base + stationUrl);
    assert.equal(stationAfter.status, 200, await stationAfter.text());
});
