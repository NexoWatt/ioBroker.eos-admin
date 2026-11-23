/** Copyright (c) 2026 NexoWatt. Confidential and Proprietary; see LICENSE. */
'use strict';
// Execute the actual Admin startup methods. Controller/database and the separately
// tested migration coordinator are injected; no live ioBroker or device is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const built = process.env.EOS_TEST_RUNTIME === 'build';
const filename = path.resolve(__dirname, built ? '../build/main.js' : '../src/main.ts');
const source = fs.readFileSync(filename, 'utf8');
const code = (built ? source : require('typescript').transpileModule(source, {
    compilerOptions: { target: 9, module: 1, esModuleInterop: true },
}).outputText) + '\nmodule.exports.TestAdmin = Admin;\n';
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function fixture(options = {}) {
    const events = []; const errors = []; const recovery = deferred();
    const systemConfig = { common: { language: 'en' }, native: {
        secret: options.secret === undefined ? 'synthetic-system-secret-for-startup-fixture' : options.secret,
    } };
    class Adapter {
        constructor() {
            this.namespace = 'eos-admin.0'; this.host = 'fixture'; this.config = { auth: true };
            this.log = { info() {}, debug() {}, silly() {}, warn() {}, error(message) { errors.push(String(message)); } };
        }
        on() {}
        async getForeignObjectAsync(id) {
            if (id === 'system.config') return systemConfig;
            if (id.startsWith('system.user.')) return { type: 'user', common: { password: 'individual-fixture', enabled: true }, native: {} };
            return null;
        }
        async checkPasswordAsync() { return false; }
        async extendForeignObjectAsync(id) {
            assert.equal(id, 'system.config'); events.push('secret-write');
            if (options.secretWriteFails) throw new Error('fixture secret storage failure');
        }
        async setForeignObjectAsync() { assert.fail('startup fixture must not mutate other adapter objects'); }
    }
    class Migration {
        async start() { events.push('migration-start'); }
        verifyRuntime() {
            events.push('monitor');
            return options.monitorRejects ? Promise.reject(new Error('fixture monitor failure')) : Promise.resolve();
        }
        failStartup(reason) {
            events.push(`recover:${reason}`);
            if (options.recoveryThrows) throw new Error('fixture recovery failure');
            return recovery.promise.then(() => events.push('recovered'));
        }
        block(reason) { events.push(`block:${reason}`); }
    }
    const imports = {
        '@iobroker/adapter-core': { Adapter, commonTools: {}, controllerDir: path.resolve(__dirname, '../node_modules/iobroker.js-controller'),
            getAbsoluteInstanceDataDir: () => path.join(require('node:os').tmpdir(), 'eos-main-startup-fixture'), I18n: { init: async () => {} } },
        './lib/eosStateSubscriptions': { installEosStateSubscriptions: () => ({}) },
        './lib/eosUiSessionRegistry': { EosUiSessionRegistry: class {} },
        './lib/eosSessionSecurity': { EosSessionSecurity: class {} },
        './lib/eosLicenseService': { EosLicenseService: class { async start() { events.push('license-start'); } } },
        './lib/eosLegacyMigration': { EosLegacyMigration: Migration },
        './lib/eosUnifiedOwnership': { createOwnershipGuard: () => ({ async start() {
            events.push('ownership-start');
            if (options.ownershipFails) throw new Error('fixture ownership failure');
        } }) },
        './lib/objectFixes': { verifyAdapterCore: async () => {} },
    };
    const moduleValue = { exports: {} };
    const load = name => {
        if (Object.hasOwn(imports, name)) return imports[name];
        if (name.startsWith('./lib/')) return {};
        if (name === '@iobroker/ws-server' || name === '@iobroker/plugin-docker') return {};
        return require(name);
    };
    vm.runInNewContext(code, { module: moduleValue, exports: moduleValue.exports, require: load,
        __dirname: path.dirname(filename), __filename: filename, console, process, Buffer, URL, Error,
        setTimeout, clearTimeout, setInterval, clearInterval }, { filename, timeout: 5000 });
    const adapter = new moduleValue.exports.TestAdmin();
    if (options.securityFails) {
        adapter.startEosSecurityGuard = async () => { events.push('security-start'); throw new Error('fixture ACL failure'); };
        adapter.getData = () => assert.fail('failed security reconciliation cannot create Web');
    } else {
        adapter.init = async () => {
            events.push('init');
            if (options.initFails) throw new Error('fixture init failure');
        };
    }
    return { adapter, events, errors, recovery };
}
async function waitForEvent(events, expected) {
    for (let count = 0; count < 20 && !events.includes(expected); count++) await new Promise(resolve => setImmediate(resolve));
    assert.ok(events.includes(expected), `Missing event ${expected}; actual ${events.join(', ')}`);
}

test('actual onReady starts migration monitoring before ownership and initialization', async () => {
    const h = fixture(); await h.adapter.onReady();
    assert.deepEqual(h.events, ['license-start', 'migration-start', 'monitor', 'ownership-start', 'init']);
    assert.equal(h.adapter.config.auth, true);
});

for (const [name, options, code, allowedInit] of [
    ['ownership failure', { ownershipFails: true }, 'EOS_MIGRATION_OWNERSHIP_START_FAILED', false],
    ['secret persistence failure', { secret: '', secretWriteFails: true }, 'EOS_MIGRATION_SESSION_START_FAILED', false],
    ['invalid existing secret', { secret: 'invalid' }, 'EOS_MIGRATION_SESSION_START_FAILED', false],
    ['initialization failure', { initFails: true }, 'EOS_MIGRATION_INIT_FAILED', true],
    ['initialization failure after first secret creation', { secret: '', initFails: true }, 'EOS_MIGRATION_SESSION_START_FAILED', true],
    ['initial security reconciliation failure', { securityFails: true }, 'EOS_MIGRATION_SECURITY_START_FAILED', false],
]) {
    test(`actual onReady awaits migration recovery after ${name}`, async () => {
        const h = fixture(options); let settled = false;
        const starting = h.adapter.onReady().then(() => { settled = true; });
        await waitForEvent(h.events, `recover:${code}`);
        assert.equal(settled, false, 'startup must not finish before recovery resolves');
        assert.ok(h.events.indexOf('monitor') < h.events.indexOf('ownership-start'));
        assert.equal(h.events.includes('init'), allowedInit);
        h.recovery.resolve(); await starting;
        assert.equal(h.events.at(-1), 'recovered');
        assert.equal(h.events.filter(value => value.startsWith('recover:')).length, 1);
        assert.ok(!h.events.some(value => value.startsWith('block:')));
    });
}

test('unexpected recovery rejection blocks migration and is contained by actual onReady', async () => {
    const h = fixture({ ownershipFails: true, recoveryThrows: true });
    await assert.doesNotReject(h.adapter.onReady());
    assert.deepEqual(h.events.slice(-2), ['recover:EOS_MIGRATION_OWNERSHIP_START_FAILED', 'block:EOS_MIGRATION_RECOVERY_REQUIRED']);
    assert.equal(h.events.includes('init'), false);
    assert.ok(h.errors.some(value => value.startsWith('EOS_MIGRATION_RECOVERY_REQUIRED:')));
    assert.ok(h.errors.every(value => !value.includes('fixture recovery failure')));
});

test('unexpected detached monitor rejection requests fail-closed recovery without an unhandled rejection', async () => {
    const h = fixture({ monitorRejects: true });
    await h.adapter.onReady();
    await waitForEvent(h.events, 'recover:EOS_MIGRATION_MONITOR_FAILED');
    h.recovery.resolve(); await waitForEvent(h.events, 'recovered');
    assert.equal(h.events.filter(value => value.startsWith('recover:')).length, 1);
});
