'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, mkdir, writeFile, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { EosModuleHost } = require('../src/lib/eosModuleHost');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const fixtureSource = `
'use strict';
const { appendFileSync } = require('node:fs');
const { join } = require('node:path');
exports.validateConfig = config => ({ ...config, enabled: config.enabled === true });
exports.createHostedModule = options => {
  appendFileSync(join(options.dataDir, 'attempts.txt'), process.pid + '\\n');
  if (options.config.failAt === 'factory') require('./installed-dependency.cjs');
  return {
    async start() { if (options.config.failAt === 'start') require('./installed-dependency.cjs'); },
    async stop() {},
    getStatus() { return { pid: process.pid }; },
    async command() { return options.adapter.setStateAsync('devices.fixture.command', 23, false); },
    async onStateChange(_id, state) {
      if (state && state.ack === false) await options.adapter.setStateAsync('devices.fixture.result', state.val, false);
    },
  };
};
`;

async function createHost(t, configuration = {}, options = {}) {
    const baseDir = await mkdtemp(join(tmpdir(), 'eos-retry-'));
    const objects = new Map(), writes = [], warnings = [];
    let ownershipReads = 0;
    const encrypt = value => `encrypted:${Buffer.from(value).toString('base64')}`;
    const configs = Object.fromEntries(['devices', 'eebus', 'backup', 'ocpp'].map(id => [id,
        { enabled: id === 'devices', ...(id === 'devices' ? configuration : {}) }]));
    for (const id of Object.keys(configs)) {
        await mkdir(join(baseDir, 'modules', id), { recursive: true });
        await mkdir(join(baseDir, id), { recursive: true });
        await writeFile(join(baseDir, 'modules', id, 'index.js'), fixtureSource);
    }
    const owner = {
        namespace: 'eos-admin.0', instance: 0,
        config: { eosModules: Object.fromEntries(Object.entries(configs)
            .map(([id, config]) => [id, { v: 1, encrypted: encrypt(JSON.stringify(config)) }])) },
        log: { warn: message => warnings.push(message) },
        eosLicenseService: { allowsEmbeddedModule: () => true }, eosOwnership: { canWrite: () => true },
        encrypt, decrypt: value => Buffer.from(value.slice(10), 'base64').toString(),
        async getObjectViewAsync() { ownershipReads++; return { rows: [] }; },
        async getForeignObjectAsync(id) { return objects.get(id); },
        async setForeignObjectAsync(id, value) { objects.set(id, structuredClone(value)); },
        async getForeignStateAsync() { return null; },
        async setForeignObjectNotExistsAsync() {},
        async subscribeForeignObjectsAsync() {}, async subscribeForeignStatesAsync() {}, async unsubscribeForeignStatesAsync() {},
        async setForeignStateAsync(...args) { writes.push(args); },
    };
    const host = new EosModuleHost(owner, { baseDir, dataDir: baseDir,
        ...(options.processEnabled ? { processEnabled: options.processEnabled } : {}) });
    t.after(async () => { await host.stop(); await rm(baseDir, { recursive: true, force: true }); });
    if (options.beforeStart) await options.beforeStart({ baseDir, host });
    await host.start();
    return { host, owner, writes, warnings, baseDir, ownershipReads: () => ownershipReads,
        attempts: async () => (await readFile(join(baseDir, 'devices', 'attempts.txt'), 'utf8')).trim().split('\n').map(Number),
        installDependency: () => writeFile(join(baseDir, 'modules', 'devices', 'installed-dependency.cjs'), 'module.exports = true;\n') };
}

for (const failAt of ['factory', 'start']) {
    test(`missing dependency during worker ${failAt} stays stopped until an explicit restart`, { timeout: 15000 }, async t => {
        const x = await createHost(t, { failAt });
        await x.host.reconcile();
        const entry = x.host.entries.get('devices');
        const firstAttempts = await x.attempts();
        assert.equal(firstAttempts.length, 1);
        assert.notEqual(firstAttempts[0], process.pid);
        const firstStatus = await x.host.status('devices');
        assert.equal(firstStatus.active, false);
        assert.equal(firstStatus.details.process.lastError, 'EOS_MODULE_DEPENDENCY_MISSING');
        assert.equal(firstStatus.details.process.pid, null);
        assert.equal(firstStatus.details.process.nextRestartAt, 0);
        assert.throws(() => process.kill(firstAttempts[0], 0), { code: 'ESRCH' });
        const generation = entry.generation;
        const old = entry.startup.module;

        // Supply a command while unavailable, then make the package loadable.
        // Neither repaired files nor telemetry may replay that old command.
        x.host.onStateChange('eos-admin.0.devices.fixture.command', { val: 91, ack: false, ts: Date.now() });
        await x.installDependency();
        await delay(1200);
        for (let tick = 0; tick < 30; tick++) await x.host.reconcile();
        assert.deepEqual(await x.attempts(), firstAttempts);
        assert.equal(entry.generation, generation);
        assert.equal(entry.timers.size, 0);
        assert.equal(entry.subscriptions.size, 0);
        assert.equal(entry.pendingWrites.size, 0);
        assert.equal(x.writes.length, 0);
        await assert.rejects(old.command('write', {}), /INACTIVE/);

        await x.host.controlProcess('devices', 'start');
        assert.equal((await x.host.status('devices')).active, true);
        const attempts = await x.attempts();
        assert.equal(attempts.length, 2);
        assert.notEqual(attempts[1], firstAttempts[0]);
        assert.equal(x.writes.length, 0, 'commands received before recovery must not be replayed');
        await entry.module.command('write', {});
        assert.deepEqual(x.writes, [['eos-admin.0.devices.fixture.command', 23, false]]);
    });
}

test('a validated configuration commit can recover a latched worker dependency failure', { timeout: 15000 }, async t => {
    const x = await createHost(t, { failAt: 'start', marker: 'preserve-me', password: 'preserved-secret' });
    await x.host.reconcile();
    assert.equal((await x.host.status('devices')).details.process.lastError, 'EOS_MODULE_DEPENDENCY_MISSING');
    await x.installDependency();
    await x.host.save('devices', { ...x.host.readConfig('devices'), marker: 'changed-deliberately' });
    await x.host.reconcile();
    assert.equal((await x.host.status('devices')).active, true);
    assert.equal((await x.attempts()).length, 2);
    assert.equal(x.host.readConfig('devices').password, 'preserved-secret');
    assert.equal(x.host.readConfig('devices').marker, 'changed-deliberately');
});

test('configuration import failure is visible and cannot masquerade as a disabled module', async t => {
    const x = await createHost(t, {}, { beforeStart: ({ baseDir }) => rm(join(baseDir, 'modules', 'devices', 'index.js')) });
    const status = await x.host.status('devices');
    assert.equal(status.active, false);
    assert.notEqual(status.reason, 'DISABLED');
    const view = await x.host.view('devices');
    assert.equal(view.configurationReady, false);
    assert.equal(view.configurationReason, 'EOS_MODULE_DEPENDENCY_MISSING');
    const generation = x.host.entries.get('devices').generation;
    for (let tick = 0; tick < 30; tick++) await x.host.reconcile();
    assert.equal(x.host.entries.get('devices').generation, generation);
    assert.equal(x.writes.length, 0);
});

for (const action of ['start', 'enable']) {
    test(`only an explicit ${action} retries a repaired configuration factory import`, { timeout: 15000 }, async t => {
        let permitted = action === 'start';
        const saved = { enabled: action === 'start', marker: 'retain-profile', password: 'retain-secret' };
        const x = await createHost(t, saved, {
            processEnabled: () => permitted,
            beforeStart: ({ baseDir }) => rm(join(baseDir, 'modules', 'devices', 'index.js')),
        });
        const entry = x.host.entries.get('devices');
        assert.equal(x.host.initialized, true);
        assert.equal(entry.configLoaded, false);
        assert.equal((await x.host.view('devices')).configurationReason, 'EOS_MODULE_DEPENDENCY_MISSING');
        await writeFile(join(x.baseDir, 'modules', 'devices', 'index.js'), fixtureSource);
        for (let tick = 0; tick < 10; tick++) {
            await x.host.view('devices');
            await x.host.reconcile();
        }
        assert.equal(entry.configLoaded, false, 'ordinary polling must not clear the failed import latch');
        assert.equal(entry.module, null);
        await assert.rejects(readFile(join(x.baseDir, 'devices', 'attempts.txt')), { code: 'ENOENT' });
        if (action === 'enable') {
            await x.host.enableProcessModule('devices');
            assert.equal(entry.configLoaded, true);
            assert.equal(entry.module, null, 'saving enabled configuration must still respect the disabled process');
            permitted = true;
        }
        await x.host.controlProcess('devices', 'start');
        assert.equal(entry.configLoaded, true);
        assert.equal((await x.host.status('devices')).active, true);
        assert.deepEqual(x.host.readConfig('devices'), { ...saved, enabled: true });
        assert.equal((await x.attempts()).length, 1);
        assert.equal(x.writes.length, 0);
    });
}

test('external heartbeat traffic does not advance an inactive OCPP generation or schedule irrelevant work', async t => {
    const x = await createHost(t, { enabled: false });
    const entry = x.host.entries.get('ocpp');
    const generation = entry.generation;
    let reconciliations = 0;
    const original = x.host.reconcile.bind(x.host);
    x.host.reconcile = (...args) => { reconciliations++; return original(...args); };
    const ownershipReads = x.ownershipReads();
    for (let event = 0; event < 459; event++) {
        x.host.onStateChange('system.adapter.ocpp21.0.alive', { val: true, ack: true, ts: Date.now() });
        x.host.onObjectChange('system.adapter.ocpp21.0.alive');
    }
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(entry.generation, generation);
    assert.equal(reconciliations, 0);
    assert.equal(x.ownershipReads(), ownershipReads);
    assert.equal(entry.module, null);
});

for (const event of ['instance', 'alive']) {
    test(`an active real worker is fenced immediately when legacy ${event} ownership changes`, async t => {
        const x = await createHost(t);
        const entry = x.host.entries.get('devices');
        const old = entry.module, pid = old.health().pid;
        assert.equal((await x.host.status('devices')).active, true);
        const id = 'system.adapter.nexowatt-devices.0';
        x.owner.getObjectViewAsync = async () => ({ rows: [{ value: {
            _id: id, type: 'instance', ts: Date.now(), common: { enabled: true, host: 'controller' },
        } }] });
        if (event === 'instance') x.host.onObjectChange(id);
        else x.host.onStateChange(`${id}.alive`, { val: true, ack: true, ts: Date.now() });
        assert.equal(x.host.canOperate('devices', old.options.generation), false);
        await assert.rejects(old.command('write', {}), /INACTIVE/);
        await x.host.reconcile();
        assert.equal((await x.host.status('devices')).active, false);
        assert.equal(x.writes.length, 0);
        assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
        assert.equal((await x.attempts()).length, 1);
    });
}

test('integrated OCPP starts only a passive PID while the external owner retains its port and configuration', async t => {
    let permitted = false;
    const x = await createHost(t, { enabled: false }, { processEnabled: () => permitted });
    x.owner.getObjectViewAsync = async () => ({ rows: [{ value: {
        _id: 'system.adapter.ocpp21.0', type: 'instance', ts: Date.now(),
        common: { enabled: true, host: 'controller' },
    } }] });
    await assert.rejects(x.host.enableProcessModule('ocpp'), {code:'EOS_MODULE_LEGACY_RUNNING'});
    assert.equal(x.host.readConfig('ocpp').enabled, false);
    assert.equal(x.host.entries.get('ocpp').module, null);
    permitted = true;
    x.host.options.standbyRequested=id=>id==='ocpp';
    await x.host.controlProcess('ocpp', 'start');
    const health=(await x.host.status('ocpp')).details.process;
    assert.equal(health.standby,true);assert.equal(health.state,'running');assert.ok(health.pid>0);
    assert.doesNotThrow(()=>process.kill(health.pid,0));
    assert.equal(x.host.entries.get('ocpp').module, null);
    assert.equal((await x.host.status('ocpp')).reason, 'WAITING_FOR_OWNERSHIP');
    assert.equal((await x.host.status('ocpp')).active, false);
    await assert.rejects(readFile(join(x.baseDir, 'ocpp', 'attempts.txt')), { code: 'ENOENT' });
    assert.equal(x.writes.length, 0);
});

test('process activation waits for the actual slow configuration commit and preserves the complete saved configuration', { timeout: 15000 }, async t => {
    const saved = { enabled: false, marker: 'commissioning', password: 'retained-secret',
        endpoint: { host: 'meter.local', unitId: 7 }, custom: [1, 2, 3] };
    const x = await createHost(t, saved, { processEnabled: () => false });
    let commitEntered, releaseCommit, settled = false, commits = 0;
    const entered = new Promise(resolve => { commitEntered = resolve; });
    const gate = new Promise(resolve => { releaseCommit = resolve; });
    const originalSave = x.owner.setForeignObjectAsync.bind(x.owner);
    x.owner.setForeignObjectAsync = async (id, value) => {
        commits++;
        commitEntered();
        await gate;
        await originalSave(id, value);
    };
    const activation = x.host.enableProcessModule('devices').then(() => { settled = true; });
    t.after(() => releaseCommit());
    await entered;
    assert.equal(x.host.mutation, true);
    assert.ok(x.host.configurationSavePromise);
    await delay(5200); // Exceeds the ordinary module-save HTTP response deadline.
    assert.equal(settled, false, 'the runtime control transaction must retain ownership of an unresolved commit');
    assert.equal(x.host.mutation, true);
    assert.equal(x.host.entries.get('devices').module, null);
    assert.equal(x.host.readConfig('devices').enabled, false);
    releaseCommit();
    await activation;
    assert.equal(commits, 1);
    assert.deepEqual(x.host.readConfig('devices'), { ...saved, enabled: true });
    assert.equal(x.host.entries.get('devices').module, null, 'configuration activation alone cannot bypass the process permission');
    assert.equal(x.host.mutation, false);
    assert.equal(x.host.configurationSavePromise, null);
    await x.host.enableProcessModule('devices');
    assert.equal(commits, 1, 'already-enabled configuration must not be rewritten');
});
