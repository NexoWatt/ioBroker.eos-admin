'use strict';
// Explicit release gate: point EOS_INSTALLED_PACKAGE_ROOT at the extracted npm
// tarball after a clean production-only dependency install. This suite never
// falls back to the checkout or replaces module factories. Only the controller
// database, license and session contracts are fixtures. It is not a hardware,
// multicast, backup-execution or installed js-controller acceptance test.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { realpathSync, lstatSync, existsSync, readFileSync } = require('node:fs');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve, relative, isAbsolute, sep } = require('node:path');
const { createServer } = require('node:net');
const setting = process.env.EOS_INSTALLED_PACKAGE_ROOT;
assert.ok(setting && isAbsolute(setting), 'EOS_INSTALLED_PACKAGE_ROOT must name an isolated, production-installed npm artifact');
const root = realpathSync(setting);
const checkout = realpathSync(resolve(__dirname, '..'));
assert.notEqual(root, checkout, 'installed-package tests must not run against the checkout');
const requireInstalled = createRequire(join(root, 'package.json'));
for (const searchPath of requireInstalled.resolve.paths('eos-package-isolation-probe') || []) {
    if (!existsSync(searchPath)) continue;
    assert.equal(realpathSync(searchPath), join(root, 'node_modules'),
        'external dependency search path masks missing packages; clear NODE_PATH and use --no-global-search-paths');
}
const { EosModuleHost } = requireInstalled('./build/lib/eosModuleHost');
const { registerEosModuleRoutes } = requireInstalled('./build/lib/eosModuleHttp');
const { createEosSplitRuntime } = requireInstalled('./build/lib/eosSplitRuntime');
const express = requireInstalled('express');
const { RPCClient } = requireInstalled('ocpp-rpc');
const ids = ['devices', 'eebus', 'backup', 'ocpp'];

async function freePort() {
    const server = createServer();
    await new Promise((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done); });
    const port = server.address().port;
    await new Promise(done => server.close(done));
    return port;
}

test('installed artifact has its own production dependency tree and all module validators load', () => {
    const modules = join(root, 'node_modules');
    assert.equal(lstatSync(modules).isSymbolicLink(), false, 'a workspace dependency symlink masks missing runtime packages');
    const pkg = requireInstalled('./package.json');
    for (const name of Object.keys(pkg.dependencies)) {
        const location = realpathSync(join(modules, name, 'package.json'));
        const local = relative(modules, location);
        assert.ok(!local.startsWith(`..${sep}`) && !isAbsolute(local), `production dependency escaped installation: ${name}`);
    }
    for (const developmentPackage of ['typescript', '@playwright/test']) {
        assert.equal(existsSync(join(modules, developmentPackage)), false, `development package present: ${developmentPackage}`);
    }
    for (const id of ids) {
        const factory = requireInstalled(`./modules/${id}`);
        assert.equal(factory.validateConfig({ enabled: false }).enabled, false, `${id}: saved opt-out`);
        assert.equal(factory.validateConfig({ enabled: true }).enabled, true, `${id}: new installation`);
        assert.equal(typeof factory.createHostedModule, 'function');
    }
});

test('installed read-only presentation worker serves its files and picker independently of the EMS', { timeout: 30000 }, async t => {
    let objectReads = 0;
    const owner = {
        namespace: 'eos-admin.0', instance: 0, config: {},
        async getForeignObjectsAsync(pattern, type) {
            assert.deepEqual([pattern, type], ['*', 'state']);
            objectReads++;
            return { 'alias.0.packageLight': { common: { role: 'switch', type: 'boolean', name: 'Paketlicht', read: true, write: true } } };
        },
    };
    const access = {
        authenticated: true, user: 'system.user.package-fixture', role: 'installer',
        capabilities: ['frontend.open', 'mapping.edit'], csrfToken: 'p'.repeat(32), credentialKey: 'fixture',
    };
    const runtime = createEosSplitRuntime(owner, {
        resolveAccess: req => req.headers['x-test-session'] === 'installer-fixture' ? access : { authenticated: false },
        getLicense: () => ({ valid: true, coreEnabled: true, edition: 'home', limits: { chargePoints: 3, batteries: 2 }, features: ['smartHome'] }),
        canWrite: () => true,
        originAllowed: req => !req.headers.origin,
    }, { baseDir: root });
    t.after(() => runtime.stop());
    await runtime.start();
    const { ui, ems } = runtime.status();
    assert.ok(ui.process.pid > 0 && ui.process.pid !== process.pid);
    assert.equal(ui.canWrite, false);
    assert.equal(ems.process.pid, null);
    const app = express();
    app.use((req, res, next) => runtime.handle(req, res, next));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((done, fail) => { server.once('listening', done); server.once('error', fail); });
    t.after(async () => { server.closeAllConnections(); await new Promise(done => server.close(done)); });
    const endpoint = `http://127.0.0.1:${server.address().port}`;
    const read = (path, options = {}) => fetch(`${endpoint}${path}`, { redirect: 'manual', ...options });
    const headers = { 'x-test-session': 'installer-fixture' };
    assert.equal((await read('/')).status, 303);
    const dashboard = await read('/', { headers });
    assert.equal(dashboard.status, 200);
    const dashboardHtml = await dashboard.text();
    assert.match(dashboardHtml, /static\/dashboard-lp-status\.js/);
    const iconPath = '/apple-touch-icon-eos-v2.png';
    assert.match(dashboardHtml, /rel="apple-touch-icon"[^>]*href="\/apple-touch-icon-eos-v2\.png"/);
    const icon = await read(iconPath);
    assert.equal(icon.status, 200);
    assert.match(icon.headers.get('content-type'), /^image\/png/);
    const expectedIcon = readFileSync(join(root, 'ui', 'www', 'assets', 'icons', 'nexowatt-180.png'));
    assert.deepEqual(Buffer.from(await icon.arrayBuffer()), expectedIcon);
    assert.deepEqual(readFileSync(join(root, 'adminWww', iconPath.slice(1))), expectedIcon);
    assert.equal((await read('/static/styles.css')).status, 200);
    assert.equal((await read('/api/smarthome/dpsearch')).status, 401);
    const search = await read('/api/smarthome/dpsearch?q=paketlicht', { headers });
    assert.equal(search.status, 200);
    assert.equal((await search.json()).results[0].id, 'alias.0.packageLight');
    const tree = await read('/api/object/tree?prefix=alias.0', { headers });
    assert.equal(tree.status, 200);
    assert.equal((await tree.json()).children[0].id, 'alias.0.packageLight');
    assert.equal(objectReads, 1);
    assert.equal((await read('/api/set', { headers, method: 'POST' })).status, 503);
});

async function fixture(t) {
    const dataDir = await mkdtemp(join(tmpdir(), 'eos-installed-package-data-'));
    const port = await freePort();
    const configs = {
        devices: { enabled: true, devices: [], pollIntervalMs: 5000 },
        eebus: { enabled: true, discoveryEnabled: false, shipServerEnabled: false, autoConnectEnabled: false,
            nexowattBridgeEnabled: false, commandDryRun: true, autoApplyClsLimits: false },
        backup: { enabled: true, minimalEnabled: false, ccuEnabled: false },
        ocpp: { enabled: true, port, activeRefresh: false, identityAllowlist: ['package-fixture'] },
    };
    const objects = new Map(), states = new Map(), logs = [];
    const encrypt = value => `fixture:${Buffer.from(value).toString('base64')}`;
    const owner = {
        namespace: 'eos-admin.0', instance: 0,
        config: { eosModules: Object.fromEntries(ids.map(id => [id, { v: 1, encrypted: encrypt(JSON.stringify(configs[id])) }])) },
        log: Object.fromEntries(['info', 'warn', 'error', 'debug'].map(level => [level, message => logs.push({ level, message })])),
        eosLicenseService: { allowsEmbeddedModule: () => true }, eosOwnership: { canWrite: () => true },
        encrypt, decrypt: value => Buffer.from(value.slice('fixture:'.length), 'base64').toString(),
        async getObjectViewAsync(_design, _type, range) {
            return { rows: [...objects.values()].filter(row => row._id >= range.startkey && row._id <= range.endkey)
                .map(value => ({ id: value._id, value })) };
        },
        async getForeignObjectAsync(id) { return id === 'system.adapter.eos-admin.0' ? { native: structuredClone(owner.config) } : objects.get(id) || null; },
        async getForeignStateAsync(id) { return states.get(id) || null; },
        async getForeignStatesAsync(pattern) {
            const prefix = pattern.split('*')[0];
            return Object.fromEntries([...states].filter(([id]) => id.startsWith(prefix)));
        },
        async setForeignObjectAsync(id, value) { objects.set(id, { ...structuredClone(value), _id: id }); },
        async setForeignObjectNotExistsAsync(id, value) {
            if (!objects.has(id)) {
                objects.set(id, { ...structuredClone(value), _id: id });
                if (value.common?.def !== undefined && !states.has(id)) states.set(id, { val: value.common.def, ack: true, ts: Date.now(), q: 0 });
            }
        },
        async extendForeignObjectAsync(id, value) {
            const previous = objects.get(id) || {};
            objects.set(id, { ...previous, ...structuredClone(value), _id: id,
                common: { ...previous.common, ...value.common }, native: { ...previous.native, ...value.native } });
        },
        async delForeignObjectAsync(id) { objects.delete(id); },
        async setForeignStateAsync(id, value, ack) {
            states.set(id, { ...(value && typeof value === 'object' ? value : { val: value, ack }), ts: Date.now(), q: 0 });
        },
        async setForeignStateChangedAsync(id, value, ack) { return this.setForeignStateAsync(id, value, ack); },
        async subscribeForeignObjectsAsync() {}, async subscribeForeignStatesAsync() {}, async unsubscribeForeignStatesAsync() {},
    };
    const host = new EosModuleHost(owner, { baseDir: root, dataDir });
    t.after(async () => { await host.stop(); await rm(dataDir, { recursive: true, force: true }); });
    for (const id of ids) {
        await host.loadForEditing(id);
        const view = await host.view(id);
        assert.equal(view.configurationLoaded, true, `${id}: configuration editor failed: ${JSON.stringify(view)}`);
        assert.equal(view.config.enabled, true);
    }
    await host.start();
    for (const id of ids) {
        const status = await host.status(id);
        assert.equal(status.active, true, `${id}: ${JSON.stringify({ status, logs })}`);
        assert.ok(status.details.process.pid > 0);
        assert.notEqual(status.details.process.pid, process.pid);
    }
    return { host, configs, port, states, logs };
}

test('installed host starts all four real workers, serves configuration/status APIs and accepts all OCPP protocols', { timeout: 30000 }, async t => {
    const f = await fixture(t);
    const app = express();
    registerEosModuleRoutes({ app, host: f.host, baseDir: root, jsonParser: express.json({ limit: '512kb' }),
        authorize: async req => ({ authenticated: req.headers['x-test-session'] === 'admin-fixture', role: 'admin', csrfToken: 'fixture-only' }),
        requestAllowed: () => true, csrfAllowed: req => req.headers['x-test-csrf'] === 'fixture-only' });
    const server = app.listen(0, '127.0.0.1');
    await new Promise((done, fail) => { server.once('listening', done); server.once('error', fail); });
    t.after(async () => { server.closeAllConnections(); await new Promise(done => server.close(done)); });
    const endpoint = `http://127.0.0.1:${server.address().port}`;
    const read = path => fetch(`${endpoint}${path}`, { headers: { 'x-test-session': 'admin-fixture' } });
    for (const id of ids) {
        const response = await read(`/api/eos/modules/${id}`);
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.configurationReady, true);
        assert.equal(body.status.active, true);
    }
    assert.equal((await fetch(`${endpoint}/api/eos/modules/ocpp`)).status, 401);
    const healthResponse = await read('/api/eos/runtime');
    assert.equal(healthResponse.status, 200);
    const health = await healthResponse.json();
    assert.equal(new Set(health.processes.filter(row => ids.includes(row.id)).map(row => row.pid)).size, 4);
    for (const protocol of ['ocpp1.6', 'ocpp2.0.1', 'ocpp2.1']) {
        const client = new RPCClient({ endpoint: `ws://127.0.0.1:${f.port}`, identity: 'package-fixture',
            protocols: [protocol], strictMode: false, reconnect: false });
        try {
            await client.connect();
            const result = await client.call('BootNotification', protocol === 'ocpp1.6'
                ? { chargePointVendor: 'Package fixture', chargePointModel: 'Loopback' }
                : { chargingStation: { vendorName: 'Package fixture', model: 'Loopback' }, reason: 'PowerUp' });
            assert.equal(result.status, 'Accepted');
            assert.equal(typeof (await client.call('Heartbeat', {})).currentTime, 'string');
        } finally { await client.close({ force: true }); }
    }
    const initial = await f.host.status('eebus');
    await f.host.controlProcess('eebus', 'stop');
    await f.host.controlProcess('eebus', 'start');
    const restarted = await f.host.status('eebus');
    assert.equal(restarted.active, true);
    assert.notEqual(restarted.details.process.pid, initial.details.process.pid);
    assert.equal(restarted.details.localSki, initial.details.localSki, 'module restart retains paired identity');
    assert.equal((await f.host.status('ocpp')).active, true, 'restarting EEBus does not stop OCPP');
});
