'use strict';
/* Copyright (c) 2026 NexoWatt. Proprietary EOS role policy. */

// Preserve the existing HTTP role contract in both HTTP and Socket paths.
// These are exact group IDs, never display names or group-name prefixes.
// Resolving an EOS role neither creates a group nor changes platform ACLs.
const DEFAULT_GROUPS = Object.freeze({
    service: Object.freeze(['system.group.administrator', 'system.group.nexowatt-service', 'system.group.eos-service']),
    installer: Object.freeze([
        'system.group.installateur',
        'system.group.installateure',
        'system.group.installer',
        'system.group.techniker',
        'system.group.inbetriebnahme',
        'system.group.integrator',
    ]),
    enduser: Object.freeze([
        'system.group.endkunde',
        'system.group.endkunden',
        'system.group.kunde',
        'system.group.kunden',
        'system.group.user',
        'system.group.users',
    ]),
});
const CONFIG_KEYS = Object.freeze({
    service: Object.freeze([
        'eosAdminOnlyGroups',
        'eosSecurityAdminGroups',
        'eosAdminOnlyGroup',
        'eosServiceGroups',
        'eosNexoWattServiceGroups',
    ]),
    installer: Object.freeze(['eosInstallerGroups', 'eosInstallateurGroups', 'eosCommissioningGroups']),
    enduser: Object.freeze(['eosEndUserGroups', 'eosEndkundeGroups', 'eosCustomerGroups']),
});
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function normalizeGroupId(value) {
    if (typeof value !== 'string' || value.length > 192) {
        return null;
    }
    let group = value.trim();
    if (!group) {
        return null;
    }
    if (!group.startsWith('system.group.')) {
        group = `system.group.${group.replace(/^group\./, '')}`;
    }
    return /^system\.group\.[a-z0-9_.-]{1,128}$/i.test(group) ? group : null;
}

function getEosRoleGroups(settings, role) {
    if (typeof role !== 'string' || !Object.hasOwn(DEFAULT_GROUPS, role)) {
        return [];
    }
    const groups = new Set(DEFAULT_GROUPS[role]);
    if (!record(settings)) {
        return [...groups].sort();
    }
    const seen = new Set();
    let remaining = 2048;
    const add = (value, depth = 0) => {
        if (--remaining < 0 || depth > 8) {
            return;
        }
        if (typeof value === 'string') {
            const group = normalizeGroupId(value);
            if (group) {
                groups.add(group);
            }
            return;
        }
        if (!value || typeof value !== 'object' || seen.has(value)) {
            return;
        }
        seen.add(value);
        if (Array.isArray(value)) {
            for (const row of value) {
                if (remaining <= 0) {
                    break;
                }
                add(row, depth + 1);
            }
        } else if (value.enabled !== false) {
            // 'name' is a historical configuration field containing a group ID;
            // presentation names from actual group objects are never accepted.
            const entry = ['group', 'id', 'name'].find(key => Object.hasOwn(value, key) && value[key]);
            if (entry) {
                add(value[entry], depth + 1);
            }
        }
    };
    for (const key of CONFIG_KEYS[role]) {
        if (Object.hasOwn(settings, key)) {
            add(settings[key]);
        }
    }
    return [...groups].sort();
}

function resolveEosRole(settings, userId, groupIds) {
    // Authentication, enabled-user checks, expiry and revocation remain in the
    // callers. The low-privilege fallback is never evidence of authentication.
    if (
        typeof userId !== 'string' ||
        !/^system\.user\.[a-z0-9_.@-]{1,128}$/i.test(userId) ||
        !Array.isArray(groupIds) ||
        groupIds.length > 2048
    ) {
        return 'enduser';
    }
    const memberOf = new Set(
        groupIds.filter(group => typeof group === 'string' && /^system\.group\.[a-z0-9_.-]{1,128}$/i.test(group)),
    );
    for (const [groupRole, role] of [
        ['service', 'admin'],
        ['installer', 'installer'],
        ['enduser', 'enduser'],
    ]) {
        if (getEosRoleGroups(settings, groupRole).some(group => memberOf.has(group))) {
            return role;
        }
    }
    return 'enduser';
}

module.exports = { getEosRoleGroups, resolveEosRole, normalizeGroupId };
