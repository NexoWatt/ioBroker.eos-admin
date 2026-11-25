'use strict';
// Real backup job, encrypted archives and offline preparation. The controller CLI
// below is an explicit snapshot fixture, not a real js-controller installation.
require('../build/publicTrust').capturePublicTrust = async () => null;
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const syncFs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const Module = require('node:module');
const { randomBytes, createHash } = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const ts = require('typescript');
const { EosModuleConfigStore } = require('../../../src/lib/eosModuleConfigStore');
const { createHostedModule } = require('../build');
const { prepareRestoreSet } = require('../build/restore-cli');
const codecPath = path.resolve(__dirname, '../../../src/lib/eosUiSecretCodec.ts');
const codecModule = new Module(codecPath, module);
codecModule.filename = codecPath;
codecModule.paths = Module._nodeModulePaths(path.dirname(codecPath));
codecModule._compile(ts.transpileModule(syncFs.readFileSync(codecPath, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, codecPath);
const { createUiSecretCodec } = codecModule.exports;

async function finished(runtime) {
    const until = Date.now() + 20000;
    while (Date.now() < until) {
        const status = runtime.getStatus();
        if (!status.current && status.history.length) return status.history[0];
        await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error('backup fixture timeout');
}

async function untar(file) {
    const extract = require('tar-stream').extract();
    const entries = new Map();
    extract.on('entry', (header, stream, next) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.once('end', () => { entries.set(header.name, Buffer.concat(chunks)); next(); });
    });
    await pipeline(syncFs.createReadStream(file), zlib.createGunzip(), extract);
    return entries;
}

for (const retained of [false, true]) {
    test(`encrypted backup retains ${retained ? 'imported ocpp21.3' : 'native EOS OCPP'} config, original state IDs and module files`, { timeout: 30000 }, async t => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'eos-924-ocpp-backup-'));
        t.after(() => fs.rm(root, { recursive: true, force: true }));
        const installationDir = path.join(root, 'iobroker');
        const eosDataDir = path.join(installationDir, 'iobroker-data/eos-admin.0');
        const dataDir = path.join(eosDataDir, 'modules/backup');
        const cli = path.join(installationDir, 'node_modules/iobroker.js-controller/iobroker.js');
        const privateValue = 'fixture-station-private-value';
        const config = require('../../ocpp').validateConfig({ enabled: true, port: 8095, identityAllowlist: [privateValue], smartChargingConnectorId: 0 });
        const migration = retained ? { source: 'ocpp21.3', sourceVersion: '0.4.3', preserveNamespace: true } : undefined;
        const namespace = retained ? 'ocpp21.3' : 'eos-admin.0.ocpp';
        const secret = randomBytes(24).toString('hex');
        const codec = createUiSecretCodec(secret);
        const objects = new Map([
            ['system.config', { _id: 'system.config', type: 'config', native: { secret } }],
            ['system.adapter.eos-admin.0', { _id: 'system.adapter.eos-admin.0', type: 'instance', native: {} }],
            ['eos-admin.0.kiosk.configuration', { _id: 'eos-admin.0.kiosk.configuration', type: 'config',
                acl: { owner: 'system.user.admin', ownerGroup: 'system.group.administrator', object: 0x600 },
                native: { schemaVersion: 1, enabled: true, revision: 2, enabledBy: 'system.user.admin' } }],
            [`${namespace}.fixture-station.configuration.HeartbeatInterval`, {
                _id: `${namespace}.fixture-station.configuration.HeartbeatInterval`, type: 'state',
                common: { type: 'number', read: true, write: true },
                native: { ocppConfiguration: { kind: 'ocpp16', key: 'HeartbeatInterval', lastConfirmedValue: 300 } },
            }],
        ]);
        const owner = {
            namespace: 'eos-admin.0', config: {}, ...codec,
            async getForeignObjectAsync(id) { return structuredClone(objects.get(id) || null); },
            async setForeignObjectAsync(id, value) { objects.set(id, structuredClone(value)); },
        };
        const store = new EosModuleConfigStore(owner);
        await store.save('ocpp', { v: 1, encrypted: codec.encrypt(JSON.stringify(config)), ...(migration ? { migration } : {}) });
        const stored = objects.get('eos-admin.0.modules.ocpp.configuration');
        assert.equal(stored.acl.object, 0x600);
        assert.equal(JSON.stringify(stored).includes(privateValue), false);
        const tsValue = 1700000000000;
        const states = {
            [`${namespace}.fixture-station.control.eosLeaseArmed`]: { val: true, ack: true, ts: tsValue, lc: tsValue, q: 0 },
            [`${namespace}.fixture-station.control.eosLeaseUntilMs`]: { val: tsValue + 15000, ack: true, ts: tsValue, lc: tsValue, q: 0 },
            [`${namespace}.fixture-station.control.chargeLimit`]: { val: 0, ack: true, ts: tsValue, lc: tsValue, q: 0 },
            [`${namespace}.fixture-station.control.numberOfPhases`]: { val: 1, ack: true, ts: tsValue, lc: tsValue, q: 0 },
            [`${namespace}.fixture-station.control.chargeLimitType`]: { val: 'W', ack: true, ts: tsValue, lc: tsValue, q: 0 },
            [`${namespace}.fixture-station.configuration.HeartbeatInterval`]: { val: 300, ack: true, ts: tsValue, lc: tsValue, q: 0 },
            [`${namespace}.fixture-station.measurements.power`]: { val: null, ack: true, ts: tsValue, lc: tsValue, q: 64 },
        };
        const fixture = { objects: Object.fromEntries(objects), states };
        const source = path.join(root, 'controller-fixture.json');
        await fs.writeFile(source, JSON.stringify(fixture), { mode: 0o600 });
        await fs.mkdir(path.dirname(cli), { recursive: true });
        await fs.writeFile(cli, `require('node:fs').writeFileSync(process.argv[3],require('node:zlib').gzipSync(require('node:fs').readFileSync(${JSON.stringify(source)})));`, { mode: 0o600 });
        for (const [relative, value] of [
            ['modules/ocpp/reserved-local-profile.json', 'fixture OCPP local identity'],
            ['modules/eebus/device-key.pem', 'fixture EEBUS local identity'],
        ]) {
            await fs.mkdir(path.dirname(path.join(eosDataDir, relative)), { recursive: true });
            await fs.writeFile(path.join(eosDataDir, relative), value, { mode: 0o600 });
        }
        const runtime = createHostedModule({
            adapter: { namespace: 'eos-admin.0.backup', log: { info() {}, warn() {}, error() {}, debug() {} },
                async getBackupDataFolders() { return []; }, async setObjectNotExistsAsync() {}, async setStateAsync() {} },
            config: { enabled: true, minimalEnabled: false, eosIncludeVendorFile: false, eosIncludeVendorSecret: false },
            canOperate: () => true, getHistoryBackupRequirement: () => ({ provider: 'none' }),
            dataDir, eosDataDir, installationDir,
        });
        t.after(() => runtime.stop());
        await runtime.start();
        await runtime.command('start', {});
        const job = await finished(runtime);
        assert.equal(job.state, 'succeeded', job.error);
        for (const entry of job.files) {
            const encrypted = await fs.readFile(path.join(dataDir, 'archives', entry.name));
            assert.equal(encrypted.includes(Buffer.from(privateValue)), false);
            assert.equal(encrypted.includes(Buffer.from(secret)), false);
        }
        const exported = await runtime.command('exportRecoveryKey', { confirm: true });
        const keyPath = path.join(root, 'exported-recovery-key.json');
        await fs.writeFile(keyPath, exported.content, { mode: 0o600 });
        const set = job.files.find(entry => entry.kind === 'recovery-set');
        const output = path.join(root, 'offline-prepared');
        const plan = JSON.parse(await fs.readFile(await prepareRestoreSet(path.join(dataDir, 'archives', set.name), keyPath, output)));
        assert.equal(plan.automaticRestore, false);
        assert.equal(plan.controllerMustBeStopped, true);
        const controller = plan.files.find(entry => entry.kind === 'iobroker');
        const restored = JSON.parse(zlib.gunzipSync(await fs.readFile(path.join(output, controller.file))));
        assert.deepEqual(restored, fixture, 'controller archive preserves encrypted objects and state types/quality/timestamps byte-for-byte');
        const restoredCodec = createUiSecretCodec(restored.objects['system.config'].native.secret);
        const restoredStore = new EosModuleConfigStore({ namespace: 'eos-admin.0', config: {}, ...restoredCodec,
            async getForeignObjectAsync(id) { return restored.objects[id] || null; } });
        const restoredEnvelope = await restoredStore.load('ocpp');
        assert.deepEqual(JSON.parse(restoredCodec.decrypt(restoredEnvelope.encrypted)), config);
        assert.deepEqual(restoredEnvelope.migration, migration);
        const profile = plan.files.find(entry => entry.kind === 'eos-profile');
        const values = await untar(path.join(output, profile.file));
        assert.equal(values.get('eos-data/modules/ocpp/reserved-local-profile.json').toString(), 'fixture OCPP local identity');
        assert.equal(values.get('eos-data/modules/eebus/device-key.pem').toString(), 'fixture EEBUS local identity');
        const manifest = JSON.parse(values.get('manifest.json'));
        for (const entry of manifest.files) assert.equal(createHash('sha256').update(values.get(entry.path)).digest('hex'), entry.sha256);
        assert.equal([...values.keys()].some(name => name.includes('recovery.key') || name.includes('/archives/')), false);
        assert.deepEqual(objects.get('eos-admin.0.modules.ocpp.configuration'), stored, 'offline preparation leaves running configuration unchanged');
        await runtime.stop();
    });
}
