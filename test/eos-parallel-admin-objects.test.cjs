'use strict';
// Execute real source lifecycle/role methods against a controller DB double. This
// reproduces cross-adapter writes without starting a live controller or actuators.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
const sourcePath = path.resolve(__dirname, '../src/main.ts');
const source = ts.createSourceFile(sourcePath, fs.readFileSync(sourcePath, 'utf8'), ts.ScriptTarget.Latest, true);
const cls = source.statements.find(node => ts.isClassDeclaration(node) && node.name.text === 'Admin');
const names = new Set([
    'getAdminOnlyGroup',
    'getAdminOnlyAcl',
    'getEosConfiguredGroupIds',
    'getEosRoleGroupIds',
    'getEosRoleGroupAcl',
    'getEosRoleGroupName',
    'ensureEosRoleGroup',
    'ensureEosRoleModel',
    'refreshEosRoleCache',
    'ensureEosRoleReadableAcl',
    'restoreObjectAclManagedByEos',
    'ensureObjectProtectionPolicy',
    'ensureProtectedAdapter',
    'enforceEosSecurity',
    'startEosSecurityGuard',
    'scheduleEosSecurityGuard',
    'getProtectedAdapterNames',
    'addRepositoryReadTimestamp',
    'checkRevokedVersions',
]);
const functions = new Set([
    'normalizeGroupId',
    'normalizeAdminOnlyGroups',
    'isRecord',
    'isEosOwnedAccount',
    'ensureEosStableInitialAccounts',
    'clearLegacyNondeletable',
]);
const declarations = source.statements.filter(
    node =>
        (ts.isVariableStatement(node) &&
            node.declarationList.declarations.some(item =>
                /^(EOS_|DEFAULT_EOS_|DEFAULT_ADMIN_|ADMIN_|CORE_PROTECTED_|LEGACY_ADMIN_)/.test(
                    item.name.getText(source),
                ),
            )) ||
        (ts.isFunctionDeclaration(node) && functions.has(node.name?.text)),
);
const methods = cls.members.filter(node => names.has(node.name?.getText(source)));
const code = ts.transpileModule(
    `${declarations.map(node => node.getText(source)).join('\n')}
class UnderTest { ${methods.map(node => node.getText(source)).join('\n')} }
module.exports = { UnderTest, ensureEosStableInitialAccounts };`,
    {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    },
).outputText;
const copy = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const platformAcl = { owner: 'system.user.operator', ownerGroup: 'system.group.customer', object: 0x640 };
function existingObjects() {
    const result = {};
    for (const id of [
        'system.adapter.admin',
        'system.adapter.admin.0',
        'system.adapter.backitup',
        'system.adapter.backitup.0',
        'system.adapter.discovery',
        'system.adapter.discovery.0',
        'system.adapter.devices.0',
        'system.config',
        'system.repositories',
        'system.certificates',
        'system.licenses',
        'system.credentials.backup',
        'enum.rooms',
        'enum.rooms.kitchen',
        'enum.functions',
        'enum.functions.light',
    ]) {
        result[id] = {
            _id: id,
            type: 'instance',
            common: { icon: 'customer.svg', enabled: true, dontDelete: true, nondeletable: true },
            native: { port: 8081, customerSetting: 'unchanged' },
            acl: copy(platformAcl),
        };
    }
    for (const id of [
        'system.group.administrator',
        'system.group.nexowatt-service',
        'system.group.installateur',
        'system.group.endkunde',
        'system.group.customer',
    ]) {
        result[id] = {
            _id: id,
            type: 'group',
            common: {
                name: 'Customer group',
                members: ['system.user.admin'],
                acl: { file: { list: true, read: true, write: true, create: true, delete: true } },
            },
            native: { customer: true },
        };
    }
    for (const user of ['admin', 'installer', 'guest', 'user']) {
        const id = `system.user.${user}`;
        result[id] = { _id: id, type: 'user', common: { enabled: true, password: '' }, native: { customer: true } };
    }
    return result;
}
function fixture(initial = existingObjects(), config = {}) {
    const db = copy(initial),
        writes = [],
        timers = [],
        warnings = [],
        passwords = [],
        subscriptions = [];
    const context = {
        module: { exports: {} },
        randomBytes: crypto.randomBytes,
        semver: require('semver'),
        getEosRoleGroups: require('../src/lib/eosRolePolicy').getEosRoleGroups,
        setInterval(fn, ms) {
            timers.push({ fn, ms });
            return { unref() {} };
        },
        setTimeout(fn, ms) {
            timers.push({ fn, ms });
            return { unref() {} };
        },
        clearTimeout() {},
    };
    vm.runInNewContext(code, context, { filename: sourcePath, timeout: 1000 });
    const target = Object.assign(new context.module.exports.UnderTest(), {
        namespace: 'eos-admin.0',
        eosRoleCache: new Map(),
        eosDisabledUsers: new Set(),
        eosPasswordSetupRequired: new Set(),
        config: {
            eosServiceGroups: [],
            eosInstallerGroups: [],
            eosEndUserGroups: [],
            eosHideLegacyAdminFromNonAdmins: true,
            eosHideLegacyBackupFromNonAdmins: true,
            eosStrictProtectedAdapterAcl: true,
            eosApplyAdminOnlyAclToProtectedAdapters: true,
            eosProtectAdapterDeletion: true,
            eosAutoAssignDefaultRoleUsers: true,
            ...config,
        },
        log: {
            info() {},
            debug() {},
            error(message) {
                warnings.push(message);
            },
            warn(message) {
                warnings.push(message);
            },
        },
        async getForeignObjectAsync(id) {
            return copy(db[id]) || null;
        },
        async getObjectListAsync() {
            return { rows: Object.entries(db).map(([id, value]) => ({ id, value: copy(value) })) };
        },
        async getObjectViewAsync() {
            return { rows: Object.entries(db).map(([id, value]) => ({ id, value: copy(value) })) };
        },
        async setForeignObjectAsync(id, value) {
            writes.push(id);
            db[id] = copy(value);
        },
        async setForeignObjectNotExistsAsync(id, value) {
            if (!db[id]) {
                writes.push(id);
                db[id] = { _id: id, ...copy(value) };
            }
        },
        async extendForeignObjectAsync(id, value) {
            writes.push(id);
            for (const key of Object.keys(value)) db[id][key] = { ...db[id][key], ...copy(value[key]) };
        },
        async setPasswordAsync(user) {
            passwords.push(user);
            db[`system.user.${user}`].common.password = 'unique-fixture-hash';
        },
        async checkPasswordAsync() {
            throw new Error('Foreign account password must not be checked');
        },
        subscribeForeignObjects(pattern) {
            subscriptions.push(pattern);
        },
    });
    return {
        target,
        db,
        writes,
        timers,
        warnings,
        passwords,
        subscriptions,
        stableAccounts: () => context.module.exports.ensureEosStableInitialAccounts(target),
    };
}

test('empty or invalid role settings use separate EOS groups and never downgrade administrator', async () => {
    for (const value of [undefined, [], null, [''], [{ enabled: false, group: 'administrator' }], [7, {}]]) {
        const f = fixture(existingObjects(), {
            eosServiceGroups: value,
            eosInstallerGroups: value,
            eosEndUserGroups: value,
        });
        assert.ok(f.target.getEosRoleGroupIds('service').includes('system.group.nexowatt-service'));
        assert.ok(f.target.getEosRoleGroupIds('service').includes('system.group.administrator'));
        assert.ok(f.target.getEosRoleGroupIds('installer').includes('system.group.installateur'));
        assert.ok(!f.target.getEosRoleGroupIds('installer').includes('system.group.administrator'));
        assert.ok(f.target.getEosRoleGroupIds('enduser').includes('system.group.endkunde'));
        assert.ok(!f.target.getEosRoleGroupIds('enduser').includes('system.group.administrator'));
        await f.target.enforceEosSecurity('startup');
        assert.deepEqual(f.db, existingObjects());
        assert.deepEqual(f.writes, []);
    }
});

test('startup, object-change debounce and periodic guard preserve every existing foreign object including ACLs/icons', async () => {
    const initial = existingObjects(),
        f = fixture(initial);
    await f.stableAccounts();
    await f.target.startEosSecurityGuard();
    f.target.scheduleEosSecurityGuard('protected object change: system.adapter.backitup.0');
    for (const timer of [...f.timers]) {
        timer.fn();
        await new Promise(resolve => setImmediate(resolve));
    }
    await f.target.enforceEosSecurity('periodic');
    assert.deepEqual(f.db, initial);
    assert.deepEqual(f.writes, []);
    assert.deepEqual(f.passwords, []);
    assert.equal(f.target.eosRoleCacheHealthy, true);
    assert.equal(f.target.eosRoleCache.get('system.user.admin'), 'admin');
});

test('configured customer groups including administrator are read-only even when mapped to a lower EOS role', async () => {
    const f = fixture(existingObjects(), {
        eosServiceGroups: ['customer'],
        eosInstallerGroups: ['administrator'],
        eosEndUserGroups: ['administrator'],
    });
    await f.target.enforceEosSecurity('startup');
    await f.target.enforceEosSecurity('periodic');
    assert.deepEqual(f.writes, []);
    assert.deepEqual(f.db, existingObjects());
    assert.equal(f.target.eosRoleCache.get('system.user.admin'), 'admin');
    await f.target.ensureEosRoleGroup('system.group.missing-custom-group', 'installer');
    assert.deepEqual(f.writes, []);
});

test('new installation creates only missing EOS role groups and disabled EOS accounts; no admin membership escalation', async () => {
    const f = fixture({});
    await f.stableAccounts();
    await f.target.enforceEosSecurity('startup');
    assert.deepEqual(Object.keys(f.db).sort(), [
        'system.group.endkunde',
        'system.group.installateur',
        'system.group.nexowatt-service',
        'system.user.guest',
        'system.user.installer',
        'system.user.user',
    ]);
    assert.deepEqual(f.db['system.group.nexowatt-service'].common.members, []);
    assert.deepEqual(f.db['system.group.installateur'].common.members, ['system.user.installer']);
    assert.deepEqual(f.db['system.group.endkunde'].common.members, ['system.user.guest', 'system.user.user']);
    for (const user of ['guest', 'installer', 'user']) assert.equal(f.db[`system.user.${user}`].common.enabled, false);
    const before = copy(f.db);
    f.writes.length = 0;
    await f.target.enforceEosSecurity('periodic');
    assert.deepEqual(f.db, before);
    assert.deepEqual(f.writes, []);
});

test('concurrent customer group/account creation cannot be overwritten or disabled by EOS bootstrap', async () => {
    const f = fixture({});
    f.target.setForeignObjectNotExistsAsync = async id => {
        f.db[id] = {
            _id: id,
            type: id.startsWith('system.user.') ? 'user' : 'group',
            common: {
                name: 'Created concurrently',
                enabled: true,
                password: 'customer-hash',
                members: ['system.user.operator'],
            },
            native: { customer: true },
        };
    };
    await f.stableAccounts();
    await f.target.ensureEosRoleGroup('system.group.installateur', 'installer');
    assert.deepEqual(f.writes, []);
    assert.deepEqual(f.passwords, []);
    for (const object of Object.values(f.db)) assert.equal(object.native.customer, true);
});

test('existing EOS-owned insecure accounts are still retired without touching foreign same-name accounts', async () => {
    const initial = existingObjects();
    initial['system.user.installer'].native = { nexowattManaged: true, nexowattRole: 'installer' };
    const f = fixture(initial);
    await f.stableAccounts();
    assert.equal(f.db['system.user.installer'].common.enabled, false);
    assert.deepEqual(f.passwords, ['installer']);
    assert.deepEqual(f.db['system.user.guest'], initial['system.user.guest']);
    assert.deepEqual(f.db['system.user.user'], initial['system.user.user']);
});

test('own-object protection rejects foreign adapter and metadata targets even if called directly', async () => {
    const f = fixture();
    for (const id of Object.keys(f.db)) {
        await f.target.ensureEosRoleReadableAcl(id);
        await f.target.ensureObjectProtectionPolicy(id, { keepDontDelete: false, adminOnlyAcl: true });
    }
    for (const adapter of ['admin', 'backitup', 'discovery', 'nexowatt-ui', 'devices'])
        await f.target.ensureProtectedAdapter(adapter);
    assert.deepEqual(f.writes, []);
});

test('ACL recovery restores recorded state only; malformed/missing/operator-modified evidence is preserved', async () => {
    const id = 'system.adapter.backitup.0';
    const original = { owner: 'system.user.operator', ownerGroup: 'system.group.customer', object: 0x640 };
    const eosAcl = { owner: 'system.user.admin', ownerGroup: 'system.group.administrator', object: 0x660 };
    for (const previous of [JSON.stringify(original), null]) {
        const f = fixture({
            [id]: {
                _id: id,
                common: {},
                native: { _nexowattEosAclManaged: true, _nexowattEosAclPrevious: previous },
                acl: eosAcl,
            },
        });
        assert.equal(await f.target.restoreObjectAclManagedByEos(id), true);
        assert.deepEqual(f.db[id].acl, previous === null ? undefined : original);
        assert.deepEqual(f.db[id].native, {});
    }
    for (const previous of [
        undefined,
        '',
        '{broken',
        '{}',
        '[]',
        'null',
        JSON.stringify({ ...original, object: -1 }),
    ]) {
        const obj = { _id: id, common: {}, native: { _nexowattEosAclManaged: true }, acl: eosAcl };
        if (previous !== undefined) obj.native._nexowattEosAclPrevious = previous;
        const f = fixture({ [id]: obj });
        assert.equal(await f.target.restoreObjectAclManagedByEos(id), false);
        assert.deepEqual(f.db[id], obj);
        assert.deepEqual(f.writes, []);
    }
    for (const acl of [
        { ...eosAcl, object: 0x644 },
        { ...eosAcl, file: 0x600 },
    ]) {
        const obj = {
            _id: id,
            common: {},
            native: { _nexowattEosAclManaged: true, _nexowattEosAclPrevious: JSON.stringify(original) },
            acl,
        };
        const f = fixture({ [id]: obj });
        assert.equal(await f.target.restoreObjectAclManagedByEos(id), false);
        assert.deepEqual(f.db[id], obj);
        assert.deepEqual(f.writes, []);
    }
});

test('repository checks report blocked versions without stopping adapters or rewriting shared repository metadata', async () => {
    const initial = existingObjects();
    initial['system.adapter.backitup.0'].common = { enabled: true, name: 'backitup', version: '2.0.0', host: 'plant' };
    const f = fixture(initial);
    const repository = { _repoInfo: {}, backitup: { blockedVersions: ['<3.0.0'] } };
    await f.target.addRepositoryReadTimestamp(repository, 'stable');
    await f.target.checkRevokedVersions(repository);
    assert.equal(typeof repository._repoInfo.repoReadTime, 'string');
    assert.ok(f.warnings.some(message => message.includes('EOS_REPOSITORY_VERSION_BLOCKED')));
    assert.deepEqual(f.writes, []);
    assert.deepEqual(f.db, initial);
});

test('own ACL/delete-flag maintenance cannot overwrite a concurrent devices or EMS configuration save', async () => {
    const id = 'system.adapter.eos-admin.0';
    const initial = {
        [id]: {
            _id: id,
            type: 'instance',
            common: { dontDelete: true, nondeletable: true },
            native: { devices: [{ id: 'old' }], ems: { mapping: 'old' } },
            acl: copy(platformAcl),
        },
    };
    const f = fixture(initial);
    const read = f.target.getForeignObjectAsync;
    const patches = [],
        extend = f.target.extendForeignObjectAsync;
    f.target.getForeignObjectAsync = async key => {
        const snapshot = await read(key);
        if (key === id) {
            f.db[id].native.devices = [{ id: 'saved-device' }];
            f.db[id].native.ems = { mapping: 'saved-mapping' };
            f.db[id].common.customerLabel = 'concurrent label';
        }
        return snapshot;
    };
    f.target.extendForeignObjectAsync = async (key, patch) => {
        patches.push(copy(patch));
        return extend(key, patch);
    };
    f.target.setForeignObjectAsync = async () => {
        throw new Error('Full instance rewrite is forbidden');
    };
    await f.target.ensureProtectedAdapter('eos-admin');
    assert.deepEqual(f.db[id].native.devices, [{ id: 'saved-device' }]);
    assert.deepEqual(f.db[id].native.ems, { mapping: 'saved-mapping' });
    assert.equal(f.db[id].common.customerLabel, 'concurrent label');
    assert.equal(f.db[id].common.dontDelete, false);
    assert.equal(f.db[id].common.nondeletable, false);
    assert.ok(patches.length >= 2);
    for (const patch of patches)
        assert.ok(
            !patch.native || Object.keys(patch.native).every(key => key === '_nexowattEosRoleReadableAclManaged'),
        );
});

test('actual socket role cache matches shared HTTP resolution for configured aliases without platform writes', async () => {
    const { resolveEosRole } = require('../src/lib/eosRolePolicy');
    for (const [key, expected] of [
        ['eosAdminOnlyGroups', 'admin'],
        ['eosSecurityAdminGroups', 'admin'],
        ['eosAdminOnlyGroup', 'admin'],
        ['eosNexoWattServiceGroups', 'admin'],
        ['eosInstallateurGroups', 'installer'],
        ['eosCommissioningGroups', 'installer'],
        ['eosEndkundeGroups', 'enduser'],
        ['eosCustomerGroups', 'enduser'],
    ]) {
        const initial = existingObjects(),
            group = 'system.group.operator-role',
            user = 'system.user.operator';
        initial[group] = {
            _id: group,
            type: 'group',
            common: { members: [user], acl: { file: { read: false } } },
            native: { customer: true },
        };
        initial[user] = { _id: user, type: 'user', common: { enabled: true }, native: {} };
        const f = fixture(initial, { [key]: key === 'eosAdminOnlyGroup' ? group : [{ group }] });
        await f.target.enforceEosSecurity('startup');
        assert.equal(f.target.eosRoleCache.get(user), expected, key);
        assert.equal(f.target.eosRoleCache.get(user), resolveEosRole(f.target.config, user, [group]), key);
        assert.deepEqual(f.db, initial);
        assert.deepEqual(f.writes, []);
    }
    const initial = existingObjects();
    for (const object of Object.values(initial)) if (object.type === 'group') object.common.members = [];
    const f = fixture(initial);
    await f.target.enforceEosSecurity('startup');
    assert.equal(f.target.eosRoleCache.get('system.user.admin') || 'enduser', 'enduser');
    assert.deepEqual(f.writes, []);
});
