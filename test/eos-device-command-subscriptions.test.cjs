'use strict';
// Real owner event handler, subscription manager, module host, hosted Devices and
// DeviceRuntime. Controller delivery is filtered by real acquired subscriptions;
// only database persistence and physical driver IO are controlled boundaries.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const ts = require('typescript');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const { EosModuleHost } = require('../src/lib/eosModuleHost');
const devices = require('../modules/devices');
const { DeviceRuntime } = require('../modules/devices/lib/deviceRuntime');
function loadTs(file) {
    const filename = path.join(root, file); const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
        { exports, module: { exports }, require: createRequire(filename), __filename: filename, __dirname: path.dirname(filename), setTimeout, clearTimeout, console });
    return exports;
}
const { installEosStateSubscriptions } = loadTs('src/lib/eosStateSubscriptions.ts');
const main = ts.createSourceFile('main.ts', fs.readFileSync(path.join(root, 'src/main.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
let eventArrow;
function visit(node) { if (ts.isPropertyDeclaration(node) && node.name?.getText(main) === 'onStateChange') eventArrow = node.initializer.getText(main); ts.forEachChild(node, visit); }
visit(main); assert.ok(eventArrow);
const bindEvent = vm.runInNewContext(ts.transpileModule(`(function bind() { return ${eventArrow}; })`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, { socket: null, webServer: null });
const match = (pattern, id) => new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(id);
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
async function fixture(t, migrated = false) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-command-subscription-'));
    const objects = new Map(), states = new Map(), patterns = new Set(), physical = [], subscriptionOps = [], delivered = [];
    let runtime, allowed = true;
    const config = { enabled: true, devices: [{ id: 'solax', templateId: 'ess.solax.SolaXHybridX1X3Ess', protocol: 'modbusTcp', connection: { host: '127.0.0.1', port: 502, unitId: 1 } }] };
    const encrypt = value => `fixture:${Buffer.from(value).toString('base64')}`;
    const ns = migrated ? 'nexowatt-devices.0' : 'eos-admin.0';
    const envelope = { v: 1, encrypted: encrypt(JSON.stringify(config)), ...(migrated ? { migration: { preserveNamespace: true, source: ns } } : {}) };
    const owner = {
        namespace: 'eos-admin.0', instance: 0, config: { eosModules: { devices: envelope } },
        log: { warn() {}, info() {}, debug() {}, error() {} },
        encrypt, decrypt: value => Buffer.from(value.slice('fixture:'.length), 'base64').toString(),
        eosOwnership: { canWrite: () => allowed, onStateChange() {} }, eosLicenseService: { allowsEmbeddedModule: () => allowed },
        getForeignObjectAsync: async id => objects.get(id) || null,
        getObjectViewAsync: async () => ({ rows: [] }),
        getForeignStateAsync: async id => states.get(id) || null,
        setForeignObjectNotExistsAsync: async (id, obj) => { if (!objects.has(id)) objects.set(id, structuredClone(obj)); },
        extendForeignObjectAsync: async (id, obj) => { objects.set(id, { ...objects.get(id), ...structuredClone(obj) }); },
        setForeignObjectAsync: async (id, obj) => { objects.set(id, structuredClone(obj)); },
        setForeignStateAsync: async (id, value, ack) => {
            const state = value && typeof value === 'object' ? { ...value, ts: Date.now() } : { val: value, ack, ts: Date.now() };
            states.set(id, state);
            // The controller emits only matching subscriptions, never every DB write.
            if ([...patterns].some(pattern => match(pattern, id))) queueMicrotask(() => { delivered.push({ id, state }); owner.onStateChange(id, state); });
        },
        subscribeForeignObjectsAsync: async () => {},
        subscribeForeignStatesAsync: async pattern => { patterns.add(pattern); subscriptionOps.push(['sub', pattern]); },
        unsubscribeForeignStatesAsync: async pattern => { patterns.delete(pattern); subscriptionOps.push(['unsub', pattern]); },
    };
    owner.onStateChange = bindEvent.call(owner);
    owner.eosStateSubscriptions = installEosStateSubscriptions(owner);
    const host = new EosModuleHost(owner, { baseDir: root, dataDir: directory, factories: { devices: { ...devices,
        createHostedModule: args => devices.createHostedModule({ ...args, runtimeFactory: (cfg, template) => {
            runtime = new DeviceRuntime(args.adapter, cfg, template, args.config);
            runtime._createDriver = () => ({ connect: async () => {}, disconnect: async () => {},
                readDatapoints: async () => ({}), writeDatapoint: async (dp, value) => { physical.push({ id: dp.id, value }); } });
            return runtime;
        } }) } } });
    owner.eosModuleHost = host;
    t.after(async () => { allowed = false; await host.stop(); await owner.eosStateSubscriptions.close(); fs.rmSync(directory, { recursive: true, force: true }); });
    await host.start(); await flush();
    assert.equal((await host.status('devices')).active, true);
    const command = async (suffix, value) => { await owner.setForeignStateAsync(`${ns}.devices.solax.${suffix}`, value, false); await flush(); await runtime._flushWriteQueueOnce(); await flush(); };
    return { owner, host, states, patterns, physical, subscriptionOps, delivered, runtime, ns, command,
        setAllowed(value) { allowed = value; } };
}

test('without a browser, raw, legacy and AliasV1 commands reach real hosted DeviceRuntime', async t => {
    for (const migrated of [false, true]) await t.test(migrated ? 'retained namespace' : 'EOS namespace', async child => {
        const f = await fixture(child, migrated);
        for (const [suffix, value] of [['sET_ACTIVE_POWER', 681], ['aliases.ctrl.powerSetpointW', -400], ['aliases.v1.ctrl.powerSetpointW', 0]]) {
            const before = f.physical.length;
            await f.command(suffix, value);
            assert.ok(f.physical.length > before, `No physical command for ${suffix}; patterns=${[...f.patterns]}`);
            assert.equal(f.physical.at(-1).id, 'sET_ACTIVE_POWER');
            assert.equal(f.physical.at(-1).value, value);
            const state = f.states.get(`${f.ns}.devices.solax.${suffix}`);
            assert.equal(state.ack, true); assert.equal(state.val, value);
        }
        assert.equal(f.patterns.has('*'), false, 'host must never acquire a global wildcard');
    });
});

test('browser subscribe/unsubscribe cannot enable or disable physical command delivery', async t => {
    const f = await fixture(t);
    await f.owner.eosStateSubscriptions.socketAdapter.subscribeForeignStatesAsync('*');
    await f.command('aliases.v1.ctrl.powerSetpointW', 681);
    assert.equal(f.physical.at(-1)?.value, 681, 'browser incidental coverage proves the old routing path works');
    await f.owner.eosStateSubscriptions.socketAdapter.unsubscribeForeignStatesAsync('*');
    const before = f.physical.length;
    await f.command('aliases.v1.ctrl.powerSetpointW', 700);
    assert.ok(f.physical.length > before, 'throttle/disconnect must not remove device-owned command coverage');
    assert.equal(f.physical.at(-1)?.value, 700);
});

test('revoked device ownership rejects commands and stop preserves an independent host observer', async t => {
    const f = await fixture(t); const pattern = `${f.ns}.devices.*`;
    await f.owner.subscribeForeignStatesAsync(pattern);
    await f.command('aliases.v1.ctrl.powerSetpointW', 681);
    const before = f.physical.length;
    f.setAllowed(false);
    await f.command('aliases.v1.ctrl.powerSetpointW', 700);
    assert.equal(f.physical.length, before, 'subscription cannot bypass revoked permission');
    assert.equal(f.states.get(`${f.ns}.devices.solax.aliases.v1.ctrl.powerSetpointW`).ack, false);
    await f.host.reconcile();
    assert.equal((await f.host.status('devices')).active, false);
    assert(f.patterns.has(pattern), 'module stop releases only its own lease');
    await f.owner.unsubscribeForeignStatesAsync(pattern);
    assert.equal(f.patterns.has(pattern), false);
});
