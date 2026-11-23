/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');
require('./fixtures/socket-library-bootstrap.cjs');

function loadSocket() {
    const built = process.env.EOS_TEST_RUNTIME === 'build';
    const file = path.resolve(__dirname, built ? '../build/lib/eosSocketAdmin.js' : '../src/lib/eosSocketAdmin.ts');
    const source = fs.readFileSync(file, 'utf8');
    const js = built ? source : ts.transpileModule(source, { compilerOptions: { target: 9, module: 1, esModuleInterop: true } }).outputText;
    const exports = {};
    vm.runInNewContext(js, { exports, module: { exports }, require: createRequire(file),
        setTimeout, clearTimeout, setInterval, clearInterval, Date }, { filename: file });
    return exports.EosSocketAdmin;
}

async function withFixture(flag, run) {
    const calls = { uuid: 0, requests: [] };
    const axios = createRequire(require.resolve('@iobroker/socket-classes'))('axios');
    const originalGet = axios.get;
    // The actual upstream fetch runs only against this stub. No external network.
    axios.get = async (url, options) => { calls.requests.push({ url, options }); return { data: { fixtures: { rating: 4 } } }; };
    const config = flag === undefined ? {} : { eosExternalRatings: flag };
    const adapter = { name: 'eos-admin', namespace: 'eos-admin.0', config,
        log: Object.fromEntries(['debug', 'info', 'warn', 'error', 'silly'].map(level => [level, () => {}])),
        getForeignObjectAsync: async id => { if (id === 'system.meta.uuid') calls.uuid++; return { native: { uuid: 'fixture-consent-only' } }; },
        subscribeForeignObjectsAsync: async () => {},
    };
    const Socket = loadSocket();
    const socket = new Socket({ language: 'de', defaultUser: 'admin', ttl: 3600 }, adapter, {});
    try { await run({ socket, adapter, calls, Socket }); }
    finally { socket.close(); axios.get = originalGet; }
}

function rpcRatings(socket, update = true) {
    return new Promise(resolve => {
        const handler = socket.commands.getCommandHandler('getRatings');
        assert.equal(typeof handler, 'function');
        handler({ _acl: { user: 'system.user.admin' } }, update, (error, ratings) => resolve({ error, ratings }));
    });
}

test('default and non-boolean choices never read UUID or fetch ratings through direct or real RPC handlers', async () => {
    for (const flag of [undefined, false, 'true', 1]) {
        await withFixture(flag, async ({ socket, calls }) => {
            assert.equal(await socket.updateRatings(), null);
            assert.equal(await socket.updateRatings('explicit-fixture-uuid'), null);
            assert.equal((await rpcRatings(socket, true)).error, null);
            assert.equal((await rpcRatings(socket, false)).error, null);
            assert.equal(calls.uuid, 0);
            assert.equal(calls.requests.length, 0);
        });
    }
});

test('explicit opt-in restores upstream ratings; revocation blocks future direct and RPC fetches', async () => {
    await withFixture(true, async ({ socket, adapter, calls }) => {
        const ratings = await socket.updateRatings();
        assert.equal(ratings.uuid, 'fixture-consent-only');
        assert.equal(calls.uuid, 1);
        assert.equal(calls.requests.length, 1);
        assert.equal(calls.requests[0].url, 'https://rating.iobroker.net/rating?uuid=fixture-consent-only');
        assert.equal((await rpcRatings(socket)).ratings.fixtures.rating, 4);
        assert.equal(calls.uuid, 2); assert.equal(calls.requests.length, 2);
        adapter.config.eosExternalRatings = false;
        assert.equal(await socket.updateRatings(), null);
        await rpcRatings(socket);
        assert.equal(calls.uuid, 2); assert.equal(calls.requests.length, 2);
        adapter.config.eosExternalRatings = true;
        socket.close();
        assert.equal(await socket.updateRatings(), null);
        assert.equal(calls.requests.length, 2);
    });
});

// Execute the exact initSocket method with real EosSocketAdmin commands and
// fixture-only listener/session wiring. No ioBroker process or network is started.
function initSocketMethod(Socket, adapter) {
    const file = path.resolve(__dirname, '../src/main.ts');
    const text = fs.readFileSync(file, 'utf8');
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    let method;
    const walk = node => {
        if (ts.isMethodDeclaration(node) && node.name.getText(ast) === 'initSocket') method = node;
        ts.forEachChild(node, walk);
    };
    walk(ast); assert.ok(method?.body);
    const source = `class StartupFixture { ${method.getText(ast)} } module.exports = StartupFixture.prototype.initSocket;`;
    const js = ts.transpileModule(source, { compilerOptions: { target: 9, module: 1 } }).outputText;
    const module = { exports: {} };
    class SocketFixture extends Socket { start() {} subscribe() {} }
    const context = { module, objects: {}, socket: null, EosSocketAdmin: SocketFixture, SocketIO: {},
        normalizeLoginTimeout: value => value || 3600, isSocketSessionStore: () => true };
    vm.runInNewContext(js, context, { filename: file });
    return { call: () => module.exports.call(adapter, {}, {}), close: () => context.socket?.close() };
}

test('actual initSocket startup skips UUID and ratings by default and requests only after explicit opt-in', async () => {
    for (const flag of [undefined, false, true]) {
        await withFixture(flag, async ({ adapter, calls, Socket }) => {
            adapter.eosStateSubscriptions = { socketAdapter: adapter };
            adapter.ensureEosRoleModel = async () => {};
            adapter.eosSessionSecurity = { bindSockets() {} };
            adapter.installEosSocketCommandGuard = () => {};
            const startup = initSocketMethod(Socket, adapter);
            try {
                await startup.call();
                await new Promise(resolve => setImmediate(resolve));
                assert.equal(calls.uuid, flag === true ? 1 : 0);
                assert.equal(calls.requests.length, flag === true ? 1 : 0);
            } finally { startup.close(); }
        });
    }
});

test('package and administrator configuration disclose the optional UUID transfer and keep it disabled', () => {
    const metadata = require('../io-package.json');
    const config = require('json5').parse(fs.readFileSync(path.resolve(__dirname, '../admin/jsonConfig.json5'), 'utf8'));
    assert.equal(metadata.native.eosExternalRatings, false);
    const option = config.items.mainTab.items.eosExternalRatings;
    assert.equal(option.type, 'checkbox');
    assert.match(option.label, /System-UUID/);
    assert.match(option.help, /rating\.iobroker\.net/);
});
