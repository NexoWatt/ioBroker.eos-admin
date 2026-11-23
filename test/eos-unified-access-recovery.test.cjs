'use strict';
// Exercise current lifecycle methods from main.ts with a controlled controller DB.
// No Webserver, package build, live adapter or controller process is started here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const semver = require('semver');
const sourcePath = path.resolve(__dirname, '../src/main.ts');
const sourceText = fs.readFileSync(sourcePath, 'utf8');
const source = ts.createSourceFile(sourcePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const admin = source.statements.find(node => ts.isClassDeclaration(node) && node.name.text === 'Admin');
const selected = new Set([
    'isLegacyAdminLockEnabled',
    'getLegacyAdminLockPort',
    'getLegacyAdminLockBind',
    'ensureLegacyAdminLocked',
    'enforceEosSecurity',
    'startEosSecurityGuard',
    'scheduleEosSecurityGuard',
    'warnIfLocalAdminPasswordMissing',
    'onUnload',
    'onStateChange',
    'onMessage',
    'init',
    'recoverEosMigrationStartup',
]);
const constants = new Set([
    'LEGACY_ADMIN_INSTANCE_ID',
    'DEFAULT_LEGACY_ADMIN_LOCK_PORT',
    'DEFAULT_LEGACY_ADMIN_LOCK_BIND',
]);
const declarations = source.statements.filter(
    node =>
        ts.isVariableStatement(node) &&
        node.declarationList.declarations.some(item => constants.has(item.name.getText(source))),
);
const members = admin.members.filter(node => selected.has(node.name?.getText(source)));
const code = ts.transpileModule(
    `${declarations.map(node => node.getText(source)).join('\n')}\nclass UnderTest { ${members.map(node => node.getText(source)).join('\n')} }\nmodule.exports=UnderTest;`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
).outputText;
function fixture(
    flag,
    initial = {
        common: { enabled: true, name: 'admin', version: '7.7.7', host: 'device' },
        native: { port: 8081, bind: '0.0.0.0', secure: true, certPublic: 'operator-cert' },
    },
) {
    const timers = new Map();
    let id = 0;
    const clock = {
        setTimeout(fn, ms) {
            const handle = {
                id: ++id,
                unref() {
                    return this;
                },
            };
            timers.set(handle, { fn, ms, repeat: false });
            return handle;
        },
        setInterval(fn, ms) {
            const handle = {
                id: ++id,
                unref() {
                    return this;
                },
            };
            timers.set(handle, { fn, ms, repeat: true });
            return handle;
        },
        clear(handle) {
            timers.delete(handle);
        },
        fire(ms) {
            for (const [handle, item] of [...timers]) {
                if (item.ms === ms) {
                    if (!item.repeat) {
                        timers.delete(handle);
                    }
                    item.fn();
                }
            }
        },
    };
    const context = {
        module: { exports: {} },
        console,
        semver,
        isRecord: value => !!value && typeof value === 'object' && !Array.isArray(value),
        setTimeout: clock.setTimeout,
        setInterval: clock.setInterval,
        clearTimeout: clock.clear,
        clearInterval: clock.clear,
        socket: undefined,
        webServer: undefined,
        clearLegacyNondeletable() {
            return false;
        },
        async verifyAdapterCore() {},
        async checkCommonObjects() {},
        updateIcons() {},
        async validateUserData0() {},
        async updateDevicesObject() {},
    };
    vm.runInNewContext(code, context, { filename: sourcePath, timeout: 1000 });
    const target = new context.module.exports();
    const original = structuredClone(initial);
    const instance = { _id: 'system.adapter.admin.0', type: 'instance', ...structuredClone(initial) };
    const writes = [];
    const warnings = [];
    const errors = [];
    const subscriptionCleanup = [];
    Object.assign(target, {
        eosStateSubscriptions: {
            async closeSocket() { subscriptionCleanup.push('socket'); },
            async close() { subscriptionCleanup.push('all'); },
        },
        config: {
            eosLockLegacyAdmin: flag,
            eosLegacyAdminLockPort: 18081,
            eosLegacyAdminLockBind: '127.0.0.1',
            eosProtectAdapterDeletion: false,
            auth: true,
            autoUpdate: 0,
        },
        eosSecurityRunning: false,
        eosDeleteLockRepairFinished: true,
        namespace: 'eos-admin.0',
        uiPushSessions: { clear() {} },
        log: {
            info() {},
            debug() {},
            error(message) {
                errors.push(message);
            },
            warn(message) {
                warnings.push(message);
            },
        },
        async getForeignObjectAsync(key) {
            return key === instance._id ? structuredClone(instance) : null;
        },
        async setForeignObjectAsync(key, value) {
            writes.push({ key, value: structuredClone(value) });
            if (key === instance._id) {
                Object.assign(instance, structuredClone(value));
            }
        },
        async getObjectViewAsync() {
            return { rows: [{ id: instance._id, value: structuredClone(instance) }] };
        },
        async getForeignStateAsync() {
            return { val: true };
        },
        sendToHost() {},
        async ensureEosRoleModel() {},
        async ensureEosSystemObjectAccess() {},
        async ensureEosSmartHomeEnumAccess() {},
        async ensureLegacyAdminVisibleOnlyToAdmins() {},
        async ensureLegacyBackupVisibleOnlyToAdmins() {},
        getProtectedAdapterNames() {
            return ['admin', 'eos-admin'];
        },
        subscribeForeignObjects() {},
        async getObjectAsync() {
            return {};
        },
        async updateNews() {},
        getData() {},
    });
    return { target, clock, writes, warnings, errors, instance, original, context, subscriptionCleanup };
}
const settled = () => new Promise(resolve => setImmediate(resolve));

test('instance messages before Socket startup do not interrupt initial reconciliation', () => {
    const x = fixture(true);
    assert.doesNotThrow(() =>
        x.target.onMessage({ command: 'im', from: 'test.0', message: { m: 'state', s: 'test.0.x', d: { val: 1 } } }),
    );
});
test('malformed instance message bodies are ignored after Socket startup', () => {
    const x = fixture(true);
    const forwarded = [];
    x.context.socket = { publishInstanceMessageAll: (...args) => forwarded.push(args) };
    for (const message of [undefined, null, [], false, 123, 'state']) {
        assert.doesNotThrow(() => x.target.onMessage({ command: 'im', from: 'test.0', message }));
    }
    assert.equal(forwarded.length, 0);
});
test('valid instance message bodies are forwarded unchanged once Socket is ready', () => {
    const x = fixture(true);
    const forwarded = [];
    x.context.socket = { publishInstanceMessageAll: (...args) => forwarded.push(args), sendCommand() {} };
    const data = { val: 42, ack: true };
    x.target.onMessage({ command: 'im', from: 'test.0', message: { m: 'state', s: 'test.0.x', d: data } });
    assert.deepEqual(forwarded, [['test.0', 'state', 'test.0.x', data]]);
});
test('license service messages remain available before Socket startup', async () => {
    const x = fixture(true);
    const checked = [];
    const replies = [];
    const result = { v: 1, valid: false, code: 'NOT_ACTIVATED' };
    x.target.eosLicenseService = {
        async check(...args) {
            checked.push(args);
            return result;
        },
    };
    x.target.sendTo = (...args) => replies.push(args);
    const message = { adapter: 'test' };
    const callback = { id: 1 };
    x.target.onMessage({ command: 'eos.license.check', from: 'test.0', message, callback });
    await settled();
    assert.deepEqual(checked, [['test.0', message]]);
    assert.deepEqual(replies, [['test.0', 'eos.license.check', result, callback]]);
});

test('Web creation waits for the complete initial role and ACL reconciliation', async () => {
    const x = fixture(true);
    const order = [];
    let release;
    x.target.ensureEosRoleModel = async () => {
        order.push('roles-start');
        await new Promise(resolve => {
            release = resolve;
        });
        order.push('roles-complete');
    };
    x.target.ensureEosSystemObjectAccess = async () => {
        order.push('system-acl');
    };
    x.target.ensureLegacyAdminVisibleOnlyToAdmins = async () => {
        order.push('admin-acl');
    };
    x.target.getData = () => {
        order.push('web-data');
    };
    const startup = x.target.init();
    await settled();
    assert.deepEqual(order, ['roles-start']);
    assert.equal(x.target.eosSecurityTimer, undefined);
    release();
    await startup;
    assert.deepEqual(order, ['roles-start', 'roles-complete', 'system-acl', 'admin-acl', 'web-data']);
    assert.ok(x.target.eosSecurityTimer);
    assert.equal(x.errors.length, 0);
});
test('failed initial role reconciliation denies Web startup and leaves Admin access intact', async () => {
    const x = fixture(true);
    let webStarted = false;
    x.target.ensureEosRoleModel = async () => {
        throw new Error('fixture role DB unavailable');
    };
    x.target.getData = () => {
        webStarted = true;
    };
    await x.target.init();
    assert.equal(webStarted, false);
    assert.equal(x.target.eosSecurityRunning, false);
    assert.equal(x.target.eosSecurityTimer, undefined);
    assert.match(x.errors.join('\n'), /EOS_SECURITY_STARTUP_FAILED/);
    assert.equal(x.writes.length, 0);
    assert.deepEqual(x.instance.native, x.original.native);
    assert.equal(x.instance.common.enabled, true);
});
test('a busy initial guard fails closed while periodic failures retain their recovery behavior', async () => {
    const x = fixture(true);
    x.target.eosSecurityRunning = true;
    await assert.rejects(x.target.enforceEosSecurity('startup'), /EOS_SECURITY_STARTUP_BUSY/);
    x.target.eosSecurityRunning = false;
    x.target.ensureEosRoleModel = async () => {
        throw new Error('fixture periodic DB unavailable');
    };
    await assert.doesNotReject(x.target.enforceEosSecurity('periodic'));
    assert.equal(x.target.eosSecurityRunning, false);
    assert.match(x.warnings.join('\n'), /Cannot apply EOS security guard/);
});

test('startup and periodic enforcement preserve existing Admin endpoint even with stale lock=true', async () => {
    for (const flag of [undefined, true, false, 'true']) {
        const x = fixture(flag);
        await x.target.enforceEosSecurity('startup');
        await x.target.enforceEosSecurity('periodic');
        assert.equal(x.instance.common.enabled, x.original.common.enabled, `enabled changed for lock=${flag}`);
        assert.deepEqual(x.instance.native, x.original.native, `endpoint changed for lock=${flag}`);
        assert.equal(x.writes.length, 0);
    }
});
test('actual startup timer and object-change debounce cannot reinstate an old Admin lock', async () => {
    const x = fixture(true);
    await x.target.startEosSecurityGuard();
    await settled();
    x.target.scheduleEosSecurityGuard('protected object change: system.adapter.admin.0');
    x.clock.fire(750);
    await settled();
    x.clock.fire(300000);
    await settled();
    assert.equal(x.writes.length, 0);
    assert.equal(x.instance.common.enabled, true);
    assert.equal(x.instance.native.port, 8081);
});
test('already-disabled or customized Admin settings are not guessed or silently restored', async () => {
    for (const initial of [
        { common: { enabled: false, name: 'admin' }, native: { port: 18081, bind: '127.0.0.1', secure: false } },
        {
            common: { enabled: true, name: 'admin' },
            native: { port: 8443, bind: '192.168.3.20', secure: true, certPublic: 'custom' },
        },
    ]) {
        const x = fixture(true, initial);
        await x.target.enforceEosSecurity('startup');
        assert.deepEqual(x.instance.native, initial.native);
        assert.equal(x.instance.common.enabled, initial.common.enabled);
        assert.equal(x.writes.length, 0);
    }
});
test('early sentry state change before Web initialization does not crash startup', () => {
    const x = fixture(true);
    assert.doesNotThrow(() =>
        x.target.onStateChange('system.adapter.eos-admin.0.plugins.sentry.enabled', { val: false, ack: true }),
    );
});
test('unload continues and completes once when a service stop throws', async () => {
    const x = fixture(true);
    const stopped = [];
    let called = 0;
    x.target.eosOwnership = {
        stop() {
            stopped.push('ownership');
            throw new Error('fixture stop');
        },
    };
    x.target.eosLicenseService = {
        stop() {
            stopped.push('license');
        },
    };
    x.target.eosSessionSecurity = {
        stop() {
            stopped.push('session');
        },
    };
    x.target.eosHostedRuntime = {
        async stop() {
            stopped.push('runtime');
        },
    };
    assert.doesNotThrow(() => x.target.onUnload(() => called++));
    await settled();
    assert.equal(called, 1);
    assert.deepEqual(stopped, ['ownership', 'license', 'session', 'runtime']);
    assert.deepEqual(x.subscriptionCleanup, ['socket', 'all']);
});
test('unload deadline bounds a stuck UI stop and ignores late duplicate completion', async () => {
    const x = fixture(true);
    let called = 0,
        finish;
    x.target.eosHostedRuntime = {
        stop() {
            return new Promise(resolve => {
                finish = resolve;
            });
        },
    };
    x.target.onUnload(() => called++);
    assert.equal(called, 0);
    assert.deepEqual(x.subscriptionCleanup, ['socket']);
    x.clock.fire(2000);
    assert.equal(called, 1);
    finish();
    await settled();
    assert.equal(called, 1);
    assert.deepEqual(x.subscriptionCleanup, ['socket', 'all']);
});

test('unload diagnoses rejected subscription cleanup and still completes once', async () => {
    const x = fixture(true);
    let called = 0;
    x.target.eosStateSubscriptions = {
        async closeSocket() { throw new Error('fixture socket cleanup'); },
        async close() { throw new Error('fixture owner cleanup'); },
    };
    x.target.onUnload(() => called++);
    await settled();
    assert.equal(called, 1);
    assert.ok(x.warnings.some(line => line.startsWith('EOS_SOCKET_SUBSCRIPTION_CLEANUP_FAILED')));
    assert.ok(x.warnings.some(line => line.startsWith('EOS_STATE_SUBSCRIPTION_CLEANUP_FAILED')));
    x.clock.fire(2000);
    assert.equal(called, 1);
});

test('ownership and EMS receive state changes before browser publication', () => {
    const x = fixture(true);
    const order = [];
    x.target.eosOwnership = { onStateChange: () => order.push('ownership') };
    x.target.eosHostedRuntime = { onStateChange: () => order.push('ems') };
    x.context.socket = { stateChange: () => order.push('browser') };
    x.target.onStateChange('meter.0.power', { val: 123, ack: true });
    assert.deepEqual(order, ['ownership', 'ems', 'browser']);
});

test('passwordless legacy admin gets a bounded diagnostic, never a credential or access mutation', async () => {
    const x = fixture(true);
    x.target.getForeignObjectAsync = async () => ({ type: 'user', common: { password: '' } });
    await x.target.warnIfLocalAdminPasswordMissing();
    assert.equal(x.writes.length, 0);
    assert.equal(x.warnings.length, 1);
    assert.match(x.warnings[0], /EOS_SETUP_ADMIN_PASSWORD_REQUIRED/);
    assert.match(x.warnings[0], /iobroker user passwd admin/);
});
test('existing password or missing account does not produce a false passwordless diagnostic', async () => {
    for (const account of [null, { type: 'user', common: { password: 'test-only-private-hash' } }]) {
        const x = fixture(true);
        x.target.getForeignObjectAsync = async () => account;
        await x.target.warnIfLocalAdminPasswordMissing();
        assert.equal(x.warnings.length, 0);
        assert.equal(x.writes.length, 0);
    }
});
test('unavailable account read is diagnosed without leaking exception content or stopping startup', async () => {
    const x = fixture(true);
    x.target.getForeignObjectAsync = async () => {
        throw new Error('private-database-details');
    };
    await x.target.warnIfLocalAdminPasswordMissing();
    assert.equal(x.writes.length, 0);
    assert.match(x.warnings[0], /EOS_SETUP_ACCOUNT_CHECK_UNAVAILABLE/);
    assert.ok(!x.warnings.join('').includes('private-database-details'));
});
