/** Copyright (c) 2026 NexoWatt. Confidential and Proprietary; see LICENSE. */
'use strict';
// Execute the actual Admin startup methods. Controller/database and the separately
// tested migration coordinator are injected; no live ioBroker or device is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const os = require('node:os');
const built = process.env.EOS_TEST_RUNTIME === 'build';
const filename = path.resolve(__dirname, built ? '../build/main.js' : '../src/main.ts');
const source = fs.readFileSync(filename, 'utf8');
const code =
    (built
        ? source
        : require('typescript').transpileModule(source, {
              compilerOptions: { target: 9, module: 1, esModuleInterop: true },
          }).outputText) + '\nmodule.exports.TestAdmin = Admin;\n';
function deferred() {
    let resolve;
    const promise = new Promise(done => {
        resolve = done;
    });
    return { promise, resolve };
}
function fixture(options = {}, t) {
    const events = [];
    const errors = [];
    const recovery = deferred();
    const instanceDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-main-startup-'));
    t.after(() => {
        recovery.resolve();
        fs.rmSync(instanceDirectory, { recursive: true, force: true });
    });
    if (options.socketSecretStorageBlocked) {
        fs.writeFileSync(path.join(instanceDirectory, 'security'), 'existing customer file');
    } else if (options.socketSecretExists || options.socketSecretMalformed) {
        fs.mkdirSync(path.join(instanceDirectory, 'security'), { mode: 0o700 });
        fs.writeFileSync(
            path.join(instanceDirectory, 'security/socket-secret'),
            options.socketSecretMalformed ? 'invalid-existing-EOS-key' : Buffer.alloc(32, 0x4a),
            { mode: 0o600 },
        );
    }
    const { loadEosSocketSecret } = require(built ? '../build/lib/eosSocketSecret' : '../src/lib/eosSocketSecret');
    const systemConfig = {
        common: { language: 'en' },
        native: {
            secret: Object.hasOwn(options, 'platformSecret')
                ? options.platformSecret
                : 'synthetic-system-secret-for-startup-fixture',
        },
    };
    class Adapter {
        constructor() {
            this.namespace = 'eos-admin.0';
            this.host = 'fixture';
            this.config = { auth: true };
            this.log = {
                info() {},
                debug() {},
                silly() {},
                warn() {},
                error(message) {
                    errors.push(String(message));
                },
            };
        }
        on() {}
        async stop(request) { events.push('controller-stop:' + request.exitCode); }
        async getForeignObjectAsync(id) {
            if (id === 'system.config') return systemConfig;
            if (id.startsWith('system.user.'))
                return { type: 'user', common: { password: 'individual-fixture', enabled: true }, native: {} };
            return null;
        }
        async checkPasswordAsync() {
            return false;
        }
        async extendForeignObjectAsync() {
            assert.fail('EOS startup must not change platform secret or foreign settings');
        }
        async setForeignObjectAsync() {
            assert.fail('startup fixture must not mutate other adapter objects');
        }
    }
    class Migration {
        status() { return options.migrationStatus || { phase: 'NOT_NEEDED', code: '' }; }
        async start() {
            events.push('migration-start');
        }
        verifyRuntime() {
            events.push('monitor');
            return options.monitorRejects ? Promise.reject(new Error('fixture monitor failure')) : Promise.resolve();
        }
        failStartup(reason) {
            events.push(`recover:${reason}`);
            if (options.recoveryThrows) throw new Error('fixture recovery failure');
            return recovery.promise.then(() => events.push('recovered'));
        }
        block(reason) {
            events.push(`block:${reason}`);
        }
    }
    const imports = {
        '@iobroker/adapter-core': {
            Adapter,
            EXIT_CODES: { START_IMMEDIATELY_AFTER_STOP: 156 },
            commonTools: {},
            controllerDir: path.resolve(__dirname, '../node_modules/iobroker.js-controller'),
            getAbsoluteInstanceDataDir: () => instanceDirectory,
            I18n: { init: async () => {} },
        },
        './lib/eosStateSubscriptions': { installEosStateSubscriptions: () => ({}) },
        './lib/eosUiSessionRegistry': { EosUiSessionRegistry: class {} },
        './lib/eosSessionSecurity': { EosSessionSecurity: class {} },
        './lib/eosSocketSecret': {
            loadEosSocketSecret(directory) {
                assert.equal(directory, instanceDirectory);
                events.push('socket-secret');
                return loadEosSocketSecret(directory);
            },
        },
        './lib/eosLicenseService': {
            EosLicenseService: class {
                constructor(owner, config) { this.verified = config.onVerified; }
                async start() {
                    events.push('license-start');
                }
            },
        },
        './lib/eosLegacyMigration': { EosLegacyMigration: Migration },
        './lib/eosUnifiedOwnership': {
            createOwnershipGuard: () => ({
                async start() {
                    events.push('ownership-start');
                    if (options.ownershipFails) throw new Error('fixture ownership failure');
                },
            }),
        },
        './lib/objectFixes': { verifyAdapterCore: async () => {} },
    };
    const moduleValue = { exports: {} };
    const load = name => {
        if (Object.hasOwn(imports, name)) return imports[name];
        if (name.startsWith('./lib/')) return {};
        if (name === '@iobroker/ws-server' || name === '@iobroker/plugin-docker') return {};
        return require(name);
    };
    vm.runInNewContext(
        code,
        {
            module: moduleValue,
            exports: moduleValue.exports,
            require: load,
            __dirname: path.dirname(filename),
            __filename: filename,
            console,
            process,
            Buffer,
            URL,
            Error,
            setTimeout,
            clearTimeout,
            setInterval,
            clearInterval,
        },
        { filename, timeout: 5000 },
    );
    const adapter = new moduleValue.exports.TestAdmin();
    if (options.securityFails) {
        adapter.startEosSecurityGuard = async () => {
            events.push('security-start');
            throw new Error('fixture ACL failure');
        };
        adapter.getData = () => assert.fail('failed security reconciliation cannot create Web');
    } else {
        adapter.init = async () => {
            events.push('init');
            if (options.initFails) throw new Error('fixture init failure');
        };
    }
    return { adapter, events, errors, recovery, instanceDirectory, systemConfig };
}
function startReady(h) {
    let timer;
    const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`onReady deadline exceeded; events: ${h.events.join(', ')}`)), 5000);
    });
    return Promise.race([h.adapter.onReady(), deadline]).finally(() => clearTimeout(timer));
}

async function waitForEvent(events, expected) {
    for (let count = 0; count < 20 && !events.includes(expected); count++)
        await new Promise(resolve => setImmediate(resolve));
    assert.ok(events.includes(expected), `Missing event ${expected}; actual ${events.join(', ')}`);
}

test('actual onReady starts migration monitoring before ownership and initialization', async t => {
    const h = fixture({}, t);
    const starting = startReady(h);
    await waitForEvent(h.events, 'init');
    await starting;
    assert.deepEqual(h.events, [
        'license-start',
        'migration-start',
        'monitor',
        'ownership-start',
        'socket-secret',
        'init',
    ]);
    assert.equal(h.adapter.config.auth, true);
});

for (const [name, options, code, allowedInit] of [
    ['ownership failure', { ownershipFails: true }, 'EOS_MIGRATION_OWNERSHIP_START_FAILED', false],
    [
        'EOS secret persistence failure',
        { socketSecretStorageBlocked: true },
        'EOS_MIGRATION_SESSION_START_FAILED',
        false,
    ],
    ['invalid existing EOS secret', { socketSecretMalformed: true }, 'EOS_MIGRATION_SESSION_START_FAILED', false],
    [
        'initialization failure with existing EOS secret',
        { socketSecretExists: true, initFails: true },
        'EOS_MIGRATION_INIT_FAILED',
        true,
    ],
    ['initialization failure after first EOS secret creation', { initFails: true }, 'EOS_MIGRATION_INIT_FAILED', true],
    ['initial security reconciliation failure', { securityFails: true }, 'EOS_MIGRATION_SECURITY_START_FAILED', false],
]) {
    test(`actual onReady awaits migration recovery after ${name}`, async t => {
        const h = fixture(options, t);
        let settled = false;
        const starting = startReady(h).then(() => {
            settled = true;
        });
        await waitForEvent(h.events, `recover:${code}`);
        assert.equal(settled, false, 'startup must not finish before recovery resolves');
        assert.ok(h.events.indexOf('monitor') < h.events.indexOf('ownership-start'));
        assert.equal(h.events.includes('init'), allowedInit);
        h.recovery.resolve();
        await starting;
        assert.equal(h.events.at(-1), 'recovered');
        assert.equal(h.events.filter(value => value.startsWith('recover:')).length, 1);
        assert.ok(!h.events.some(value => value.startsWith('block:')));
    });
}

test('unexpected recovery rejection blocks migration and is contained by actual onReady', async t => {
    const h = fixture({ ownershipFails: true, recoveryThrows: true }, t);
    await assert.doesNotReject(startReady(h));
    assert.deepEqual(h.events.slice(-2), [
        'recover:EOS_MIGRATION_OWNERSHIP_START_FAILED',
        'block:EOS_MIGRATION_RECOVERY_REQUIRED',
    ]);
    assert.equal(h.events.includes('init'), false);
    assert.ok(h.errors.some(value => value.startsWith('EOS_MIGRATION_RECOVERY_REQUIRED:')));
    assert.ok(h.errors.every(value => !value.includes('fixture recovery failure')));
});

test('unexpected detached monitor rejection requests fail-closed recovery without an unhandled rejection', async t => {
    const h = fixture({ monitorRejects: true }, t);
    await startReady(h);
    await waitForEvent(h.events, 'recover:EOS_MIGRATION_MONITOR_FAILED');
    h.recovery.resolve();
    await waitForEvent(h.events, 'recovered');
    assert.equal(h.events.filter(value => value.startsWith('recover:')).length, 1);
});

test('actual onReady uses a stable own key and never changes absent or malformed platform secrets', async t => {
    for (const platformSecret of [
        undefined,
        '',
        'invalid',
        { unexpected: true },
        'existing-customer-encryption-secret',
    ]) {
        const h = fixture({ platformSecret }, t);
        const before = JSON.stringify(h.systemConfig);
        const starting = startReady(h);
        await waitForEvent(h.events, 'init');
        await starting;
        assert.equal(JSON.stringify(h.systemConfig), before);
        assert.match(h.adapter.secret, /^[a-f0-9]{64}$/);
        const key = fs.readFileSync(path.join(h.instanceDirectory, 'security/socket-secret')).toString('hex');
        assert.equal(h.adapter.secret, key);
        const { loadEosSocketSecret } = require(built ? '../build/lib/eosSocketSecret' : '../src/lib/eosSocketSecret');
        assert.equal(
            loadEosSocketSecret(h.instanceDirectory),
            key,
            'reopening a configured instance retains its own key',
        );
        assert.ok(!h.events.some(value => value.startsWith('recover:')));
    }
});

test('first verified activation requests one normal controller restart and never starts writing inside the unlicensed shell', async t => {
    const status = { phase: 'LICENSE_REQUIRED', code: 'EOS_MIGRATION_LICENSE_REQUIRED' };
    const h = fixture({ migrationStatus: status }, t);
    await startReady(h);
    h.adapter.eosLicenseService.verified();
    assert.equal(h.adapter.migrationRestartTimer, undefined);
    status.code = 'EOS_MIGRATION_RESTART_REQUIRED';
    h.adapter.eosLicenseService.verified();
    const first = h.adapter.migrationRestartTimer;
    assert.ok(first);
    h.adapter.eosLicenseService.verified();
    assert.equal(h.adapter.migrationRestartTimer, first);
    await new Promise(resolve => setTimeout(resolve, 1650));
    h.adapter.eosLicenseService.verified();
    assert.equal(h.adapter.migrationRestartTimer, undefined);
    assert.deepEqual(h.events.filter(event => event.startsWith('controller-stop:')), ['controller-stop:156']);
});

test('withdrawing the license before the controller restart preserves the waiting state', async t => {
    const status = { phase: 'LICENSE_REQUIRED', code: 'EOS_MIGRATION_LICENSE_REQUIRED' };
    const h = fixture({ migrationStatus: status }, t);
    await startReady(h);
    status.code = 'EOS_MIGRATION_RESTART_REQUIRED';
    h.adapter.eosLicenseService.verified();
    assert.ok(h.adapter.migrationRestartTimer);
    status.code = 'EOS_MIGRATION_LICENSE_REQUIRED';
    await new Promise(resolve => setTimeout(resolve, 1650));
    assert.equal(h.adapter.migrationRestartTimer, undefined);
    assert.ok(!h.events.some(event => event.startsWith('controller-stop:')));
});
