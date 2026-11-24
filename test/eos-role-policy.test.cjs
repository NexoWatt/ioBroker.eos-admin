'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { getEosRoleGroups, resolveEosRole, normalizeGroupId } = require('../src/lib/eosRolePolicy');

test('exact historical HTTP fallback groups remain stable for both transports', () => {
    assert.deepEqual(getEosRoleGroups({}, 'service'), ['system.group.administrator', 'system.group.eos-service', 'system.group.nexowatt-service']);
    assert.deepEqual(getEosRoleGroups({}, 'installer'), ['system.group.inbetriebnahme', 'system.group.installateur', 'system.group.installateure', 'system.group.installer', 'system.group.integrator', 'system.group.techniker']);
    assert.deepEqual(getEosRoleGroups({}, 'enduser'), ['system.group.endkunde', 'system.group.endkunden', 'system.group.kunde', 'system.group.kunden', 'system.group.user', 'system.group.users']);
    assert.deepEqual(getEosRoleGroups({}, 'unknown'), []);
});

test('all established configuration aliases preserve explicit customer role mappings', () => {
    const aliases = {
        service: ['eosAdminOnlyGroups', 'eosSecurityAdminGroups', 'eosAdminOnlyGroup', 'eosServiceGroups', 'eosNexoWattServiceGroups'],
        installer: ['eosInstallerGroups', 'eosInstallateurGroups', 'eosCommissioningGroups'],
        enduser: ['eosEndUserGroups', 'eosEndkundeGroups', 'eosCustomerGroups'],
    };
    for (const [role, keys] of Object.entries(aliases)) for (const key of keys) {
        for (const value of ['customer-role', [{ group: 'group.customer-role', enabled: true }], { id: 'system.group.customer-role' }, { name: 'customer-role' }]) {
            const settings = { [key]: value }; const before = structuredClone(settings);
            assert.ok(getEosRoleGroups(settings, role).includes('system.group.customer-role'), key);
            assert.equal(resolveEosRole(settings, 'system.user.operator', ['system.group.customer-role']), role === 'service' ? 'admin' : role);
            assert.deepEqual(settings, before);
        }
    }
});

test('disabled custom rows are skipped while old canonical fallback behavior is retained', () => {
    const settings = { eosServiceGroups: [{ group: 'customer-service', enabled: false }], eosInstallerGroups: [], eosEndUserGroups: null };
    assert.equal(getEosRoleGroups(settings, 'service').includes('system.group.customer-service'), false);
    assert.ok(getEosRoleGroups(settings, 'service').includes('system.group.nexowatt-service'));
    assert.ok(getEosRoleGroups(settings, 'installer').includes('system.group.installateur'));
    assert.ok(getEosRoleGroups(settings, 'enduser').includes('system.group.endkunde'));
});

test('administrator username and labels alone never grant administrator access', () => {
    assert.equal(resolveEosRole({}, 'system.user.admin', []), 'enduser');
    assert.equal(resolveEosRole({}, 'system.user.admin', ['system.group.installateur']), 'installer');
    for (const groups of [['Administrator'], ['administrator'], ['system.group.administrator-copy'], ['system.group.nexowatt-service-extra'], [{ name: 'NexoWatt Service', id: 'system.group.administrator' }]]) assert.equal(resolveEosRole({}, 'system.user.user', groups), 'enduser');
    for (const user of [null, undefined, '', 'admin', 'system.user.invalid value']) assert.equal(resolveEosRole({}, user, ['system.group.administrator']), 'enduser');
});

test('actual membership determines precedence and removal loses privilege on next resolution', () => {
    const settings = { eosServiceGroups: ['customer-service'], eosInstallerGroups: ['customer-installer'] };
    const user = 'system.user.operator';
    assert.equal(resolveEosRole(settings, user, ['system.group.administrator']), 'admin');
    assert.equal(resolveEosRole(settings, user, ['system.group.customer-installer', 'system.group.customer-service']), 'admin');
    assert.equal(resolveEosRole(settings, user, ['system.group.customer-installer']), 'installer');
    assert.equal(resolveEosRole(settings, user, []), 'enduser');
    assert.equal(resolveEosRole({}, user, ['system.group.customer-service']), 'enduser');
});

test('normalization is exact, bounded and refuses wildcards or inherited configuration', () => {
    assert.equal(normalizeGroupId(' group.custom-team '), 'system.group.custom-team');
    for (const value of [null, {}, 1, '', 'administrator*', 'group.bad name', 'system.group.' + 'x'.repeat(129)]) assert.equal(normalizeGroupId(value), null);
    const inherited = Object.create({ eosServiceGroups: ['hidden-service'] });
    assert.equal(getEosRoleGroups(inherited, 'service').includes('system.group.hidden-service'), false);
    const cyclic = []; cyclic.push(cyclic, 'custom-service');
    assert.ok(getEosRoleGroups({ eosServiceGroups: cyclic }, 'service').includes('system.group.custom-service'));
    const first = getEosRoleGroups({}, 'service'); first.length = 0;
    assert.ok(getEosRoleGroups({}, 'service').includes('system.group.administrator'));
    assert.equal(resolveEosRole({}, 'system.user.operator', Array(2049).fill('system.group.administrator')), 'enduser');
});
