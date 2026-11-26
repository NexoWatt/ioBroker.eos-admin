'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EosModuleHost } = require('../src/lib/eosModuleHost');
const { EosLegacyMigration } = require('../src/lib/eosLegacyMigration');
const { EosModuleConfigStore } = require('../src/lib/eosModuleConfigStore');
const { EosLicenseService } = require('../src/lib/eosLicenseService');
const defaults = require('../io-package.json').native.eosUi;

// Real Host/Migration/ConfigStore, synthetic controller DB and runtime factory.
// Actual OCPP TCP/WS child behavior has a separate integration suite.
function setup(t, { enabled = false, source = false, sourceEnabled = false, absentOcpp = false } = {}) {
    const objects = new Map(); const states = new Map(); const events = []; const runtimes = [];
    const encrypt = text => `fixture-encrypted:${Buffer.from(text).toString('base64')}`;
    const clone = value => value == null ? value : structuredClone(value);
    const owner = {
        namespace: 'eos-admin.2', instance: 2, owned: true, licensed: true,
        // These ownership/import tests isolate OCPP. A missing module envelope
        // now enables commissioning, so unrelated modules are explicitly off.
        config: { eosUi: clone(defaults), eosModules: Object.fromEntries(['devices', 'eebus', 'backup']
            .map(id => [id, { v: 1, encrypted: encrypt(JSON.stringify({ enabled: false })) }])) },
        log: { warn() {}, info() {}, error() {} },
        encrypt, decrypt: text => Buffer.from(text.slice('fixture-encrypted:'.length), 'base64').toString(),
        eosLicenseService: { allowsEmbeddedModule: () => owner.licensed, statusView: () => ({ valid: owner.licensed, coreEnabled: owner.licensed }) },
        eosOwnership: { canWrite: () => owner.owned },
        async getForeignObjectAsync(id) { return clone(objects.get(id)); },
        async getForeignStateAsync(id) { return clone(states.get(id)); },
        async getForeignStatesAsync(pattern) { const prefix = pattern.slice(0, pattern.indexOf('*')); return Object.fromEntries([...states].filter(([id]) => id.startsWith(prefix)).map(([id, state]) => [id, clone(state)])); },
        async getObjectViewAsync(_design, _type, range) { return { rows: [...objects.values()].filter(value => value._id >= range.startkey && value._id <= range.endkey).map(value => ({ id: value._id, value: clone(value) })) }; },
        async setForeignObjectAsync(id, object) { events.push(`object:${id}`); objects.set(id, { ...clone(object), _id: id }); },
        async setForeignObjectNotExistsAsync(id, object) { if (!objects.has(id)) await this.setForeignObjectAsync(id, object); },
        async extendForeignObjectAsync(id, patch) {
            const previous = objects.get(id) || {}; const current = { ...previous, ...clone(patch), common: { ...previous.common, ...patch.common }, _id: id, ts: Date.now() };
            objects.set(id, current); events.push(`extend:${id}:${String(patch.common?.enabled)}`);
            if (typeof patch.common?.enabled === 'boolean') states.set(`${id}.alive`, { val: patch.common.enabled, ack: true, ts: current.ts + 1 });
        },
        async setForeignStateAsync(id, state, ack) { states.set(id, typeof state === 'object' ? clone(state) : { val: state, ack }); },
        async setForeignStateChangedAsync(id, state, ack) { await this.setForeignStateAsync(id, state, ack); },
        async delForeignObjectAsync(id) { objects.delete(id); },
        async setObjectNotExistsAsync(id, object) { await this.setForeignObjectNotExistsAsync(`${owner.namespace}.${id}`, object); },
        async setStateAsync(id, state) { await this.setForeignStateAsync(`${owner.namespace}.${id}`, state); },
        async subscribeForeignObjectsAsync() {},
        async subscribeForeignStatesAsync(pattern) { events.push(`subscribe:${pattern}`); },
        async unsubscribeForeignStatesAsync(pattern) { events.push(`unsubscribe:${pattern}`); },
    };
    owner.eosStateSubscriptions = { async acquireHost(pattern) { await owner.subscribeForeignStatesAsync(pattern); let done = false; return async () => { if (!done) { done = true; await owner.unsubscribeForeignStatesAsync(pattern); } }; } };
    objects.set('system.adapter.eos-admin.2', { _id: 'system.adapter.eos-admin.2', type: 'instance', common: { host: 'fixture', enabled: true }, native: owner.config });
    states.set('system.host.fixture.alive', { val: true, ack: true, ts: Date.now() });
    const validateConfig = config => ({ ...config, enabled: config.enabled === true });
    const factory = { validateConfig,
        preflightLegacyConfig: async config => ({ config: validateConfig(config) }),
        migrateLegacyConfig: async config => ({ config: validateConfig(config) }),
        createHostedModule(options) {
            const runtime = { options,
                async start() { assert.equal(options.canOperate(), true); events.push(`start:${options.adapter.namespace}`); await options.adapter.subscribeStatesAsync('*'); },
                async stop() { events.push(`stop:${options.adapter.namespace}`); await options.adapter.unsubscribeStatesAsync('*'); },
                getStatus() { return { ready: true }; }, command() {}, onStateChange() {},
            }; runtimes.push(runtime); return runtime;
        },
    };
    const factories = Object.fromEntries(['devices', 'eebus', 'backup', 'ocpp'].map(id => [id, factory]));
    // Manual import deliberately requires a configured, disabled destination.
    if (!absentOcpp) owner.config.eosModules.ocpp = { v: 1, encrypted: encrypt(JSON.stringify({ enabled, port: 9220 })) };
    if (source) {
        const id = 'system.adapter.ocpp21.3'; const ts = Date.now() - 100;
        objects.set(id, { _id: id, type: 'instance', ts, common: { enabled: sourceEnabled, host: 'fixture', version: '0.4.3' }, native: { port: 9220, enable16: true, identityAllowlist: ['DOUSIDA'], createPublicAliases: true } });
        states.set(`${id}.alive`, { val: sourceEnabled, ack: true, ts: ts + 1 });
        states.set('ocpp21.3.DOUSIDA.connector1.power', { val: 5700, ack: true, ts: ts + 2, q: 0 });
    }
    const options = { baseDir: path.resolve(__dirname, '..'), dataDir: '/tmp/eos-ocpp-host-unit-only', factories, stopTimeoutMs: 150, startTimeoutMs: 200 };
    const host = new EosModuleHost(owner, options); owner.eosModuleHost = host;
    const migration = new EosLegacyMigration(owner, options);
    t.after(() => host.stop()); t.after(() => migration.stop());
    return { owner, objects, states, events, runtimes, factory, host, migration };
}

test('OCPP uses the existing central grant and preserves explicit legacy adapter scope', () => {
    const context = { statusView: () => ({ valid: true, coreEnabled: true }), claims: { scope: 'system', adapters: [] } };
    const allows = () => EosLicenseService.prototype.allowsEmbeddedModule.call(context, 'ocpp');
    assert.equal(allows(), true);
    context.claims = { scope: 'adapters', adapters: ['nexowatt-ui'] }; assert.equal(allows(), false);
    context.claims.adapters.push('ocpp21'); assert.equal(allows(), true);
    context.statusView = () => ({ valid: false, coreEnabled: true }); assert.equal(allows(), false);
});

test('native OCPP root command lease precedes startup and is released exactly once', async t => {
    const f = setup(t, { enabled: true }); await f.host.start();
    assert.equal(f.runtimes.length, 1); assert.equal((await f.host.status('ocpp')).namespace, 'eos-admin.2.ocpp');
    assert.equal((await f.host.status('ocpp')).active, true);
    assert.ok(f.events.indexOf('subscribe:eos-admin.2.ocpp.*') < f.events.indexOf('start:eos-admin.2.ocpp'));
    assert.equal(f.events.filter(x => x === 'subscribe:eos-admin.2.ocpp.*').length, 1);
    await f.host.stop(); assert.equal(f.events.filter(x => x === 'unsubscribe:eos-admin.2.ocpp.*').length, 1);
});

test('active or unconfirmed standalone OCPP blocks the new listener', async t => {
    const f = setup(t, { enabled: true, source: true, sourceEnabled: true }); await f.host.start();
    assert.equal(f.runtimes.length, 0); assert.equal((await f.host.status('ocpp')).active, false);
    f.objects.get('system.adapter.ocpp21.3').common.enabled = false;
    f.host.onObjectChange('system.adapter.ocpp21.3'); await f.host.reconcile();
    assert.equal(f.runtimes.length, 0, 'disabled config without confirmed dead source is insufficient');
});

test('manual OCPP import retains original IDs and stays disabled until reviewed enable', async t => {
    const f = setup(t, { source: true }); await f.host.start();
    const previous = structuredClone(f.states.get('ocpp21.3.DOUSIDA.connector1.power'));
    const view = await f.host.importLegacy('ocpp', 'ocpp21.3');
    assert.equal(view.config.enabled, false); assert.equal(view.status.namespace, 'ocpp21.3');
    assert.equal(view.migration.preserveNamespace, true); assert.equal(view.migration.newPrefix, 'ocpp21.3.');
    assert.equal(view.migration.sourceVersion, '0.4.3'); assert.equal(f.runtimes.length, 0);
    assert.deepEqual(f.states.get('ocpp21.3.DOUSIDA.connector1.power'), previous);
    const restored = await new EosModuleConfigStore(f.owner).load('ocpp');
    assert.equal(restored.migration.source, 'ocpp21.3');
    assert.equal(JSON.parse(f.owner.decrypt(restored.encrypted)).port, 9220);
    await f.host.save('ocpp', { ...view.config, enabled: true }); await f.host.reconcile();
    assert.equal(f.runtimes.length, 1); assert.equal(f.runtimes[0].options.adapter.namespace, 'ocpp21.3');
    assert.equal(f.events.filter(x => x === 'subscribe:ocpp21.3.*').length, 1);
});

test('manual preserved import refuses a source changed during asynchronous conversion', async t => {
    const f = setup(t, { source: true }); await f.host.start();
    f.factory.migrateLegacyConfig = async config => { f.objects.get('system.adapter.ocpp21.3').native.port = 9221; return { config }; };
    await assert.rejects(f.host.importLegacy('ocpp', 'ocpp21.3'), /SOURCE_CHANGED/);
    assert.equal(f.objects.has('eos-admin.2.modules.ocpp.configuration'), false);
    assert.equal(f.runtimes.length, 0);
});

async function priorOcppHandover(f, phase = 'TRANSFERRED') {
    // Represent an already transferred 9.0.24 handover. New startups no longer
    // choose external OCPP automatically, but existing journals remain binding.
    const candidate = await f.migration.candidate('ocpp', f.objects.get('system.adapter.ocpp21.3'));
    const { id, source, enabled, nativeHash, sourceVersion, host } = candidate;
    f.migration.journal = { sources: [{ id, source, enabled, nativeHash, sourceVersion, host }] };
    await f.migration.persist('PREPARED');
    await f.owner.extendForeignObjectAsync('system.adapter.ocpp21.3', { common: { enabled: false } });
    await f.migration.store.save('ocpp', candidate.envelope);
    await f.migration.persist(phase);
}

test('persisted earlier OCPP handover still loads and rollback retains source data', async t => {
    const f = setup(t, { source: true, sourceEnabled: true, absentOcpp: true }); f.owner.eosMigration = f.migration;
    const retained = structuredClone(f.states.get('ocpp21.3.DOUSIDA.connector1.power'));
    await priorOcppHandover(f);
    await f.migration.start(); assert.equal(f.migration.phase, 'TRANSFERRED');
    const envelope = f.owner.config.eosModules.ocpp;
    assert.equal(envelope.migration.preserveNamespace, true); assert.equal(envelope.migration.source, 'ocpp21.3');
    assert.equal(f.objects.get('system.adapter.ocpp21.3').common.enabled, false);
    assert.ok(f.events.indexOf('extend:system.adapter.ocpp21.3:false') < f.events.indexOf('object:eos-admin.2.modules.ocpp.configuration'));
    await f.host.start(); assert.equal((await f.host.status('ocpp')).active, true);
    f.states.set('ocpp21.3.info.eosHostedRuntime', { val: true, ack: true, ts: Date.now() });
    await assert.rejects(f.migration.rollback('EOS_MIGRATION_TEST_RECOVERY', false), /STOP_UNCONFIRMED/);
    assert.equal(f.states.get('ocpp21.3.info.eosHostedRuntime').val, true);
    await f.host.stop(); await f.migration.rollback('EOS_MIGRATION_TEST_RECOVERY', true);
    assert.equal(f.migration.phase, 'ROLLED_BACK'); assert.equal(f.objects.get('system.adapter.ocpp21.3').common.enabled, true);
    assert.equal(f.states.get('ocpp21.3.info.eosHostedRuntime').val, false, 'marker clears only after stopped target and confirmed restored source');
    assert.deepEqual(f.states.get('ocpp21.3.DOUSIDA.connector1.power'), retained);
});

test('committed earlier OCPP journal retains preserved ownership and validated destination', async t => {
    const f = setup(t, { source: true, sourceEnabled: true, absentOcpp: true });
    await priorOcppHandover(f, 'COMMITTED');
    await f.migration.start();
    assert.equal(f.migration.phase, 'COMMITTED');
    assert.equal(f.migration.allowsStartup(), true);
    await f.host.start();
    assert.equal((await f.host.status('ocpp')).active, true);
    assert.equal((await f.host.status('ocpp')).namespace, 'ocpp21.3');
    assert.equal(f.objects.get('system.adapter.ocpp21.3').common.enabled, false);
});

test('missing destination in an earlier OCPP journal still blocks unsafe startup', async t => {
    const f = setup(t, { source: true, sourceEnabled: true, absentOcpp: true });
    await priorOcppHandover(f, 'COMMITTED');
    f.objects.delete(f.migration.store.objectId('ocpp'));
    await assert.rejects(f.migration.start(), { code: 'EOS_MIGRATION_DESTINATION_MISSING' });
    assert.equal(f.migration.allowsStartup(), false);
    assert.equal(f.objects.get('system.adapter.ocpp21.3').common.enabled, false);
});

test('existing committed migration never silently stops a newly discovered OCPP source', async t => {
    const f = setup(t, { source: true, sourceEnabled: true, absentOcpp: true });
    await f.migration.store.save('migration', f.migration.envelope({ v: 1, owner: f.owner.namespace, phase: 'COMMITTED', sources: [] }));
    await f.migration.start(); assert.equal(f.migration.phase, 'COMMITTED');
    assert.equal(f.objects.get('system.adapter.ocpp21.3').common.enabled, true);
    assert.equal(f.owner.config.eosModules.ocpp, undefined);
    assert.equal(f.events.some(value => value.startsWith('extend:system.adapter.ocpp21.3:')), false);
});

test('real OCPP worker retains lease revocation history across immediate regrant and expiry', { timeout: 10000 }, async t => {
    const { mkdtemp, mkdir, writeFile, rm } = require('node:fs/promises');
    const { tmpdir } = require('node:os');
    const { EosModuleProcess } = require('../src/lib/eosModuleProcess');
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const baseDir = await mkdtemp(path.join(tmpdir(), 'eos-ocpp-epoch-'));
    await mkdir(path.join(baseDir, 'modules/ocpp'), { recursive: true });
    await writeFile(path.join(baseDir, 'modules/ocpp/index.js'), `
        exports.createHostedModule = ({canOperate,getAuthorityGeneration,onAuthorityLost}) => {
            let pending = false;
            return {start(){},stop(){},getStatus(){return {pending,generation:getAuthorityGeneration(),allowed:canOperate()};},
                async command(name){if(name==='authorityLost'){onAuthorityLost();return;}const admitted=getAuthorityGeneration();pending=true;await new Promise(r=>setTimeout(r,300));
                    return {admitted,current:getAuthorityGeneration(),allowed:canOperate()};}};
        };`);
    const failures = [];
    const runtime = new EosModuleProcess({ id: 'ocpp', baseDir, generation: 1, canOperate: () => true, onFailure: code => failures.push(code),
        moduleOptions: { config: { enabled: true }, dataDir: baseDir, adapter: { namespace: 'eos-admin.2.ocpp', log: {} } } });
    t.after(async () => { await runtime.stop(); await rm(baseDir, { recursive: true, force: true }); });
    await runtime.start();
    const operation = runtime.command('queued', {});
    const deadline = Date.now() + 3000;
    while (!(await runtime.getStatus()).pending) { assert.ok(Date.now() < deadline); await pause(10); }
    runtime.authority(false); runtime.authority(true);
    const result = await operation;
    assert.equal(result.allowed, true); assert.ok(result.current > result.admitted, 'old work cannot inherit the later positive grant');
    const before = (await runtime.getStatus()).generation;
    clearInterval(runtime.timer); await pause(1200);
    runtime.authority(true);
    const renewed = await runtime.getStatus();
    assert.equal(renewed.allowed, true); assert.ok(renewed.generation > before, 'expiry changes the epoch even if no runtime check ran in the gap');
    await runtime.command('authorityLost', {}).catch(() => undefined);
    await runtime.stop();
    assert.deepEqual(failures, ['EOS_MODULE_PROCESS_AUTHORITY_EXPIRED']);
    assert.equal(runtime.health().pid, null, 'irreversibly revoked wrapper must leave no idle child labelled running');
});
