/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { MeshCoordinator } = require('../../lib/mesh-coordinator');
const C = require('../../lib/mesh-coordinator-contract');

function fixture(grants, continuingGrants = grants) {
    const adapter = {
        config: { emsApps: { apps: { meshMicrogrid: { installed: true, enabled: true } } } },
        _nwHasCentralLicenseGrant: (grant, continuing) => (continuing ? continuingGrants : grants).includes(grant),
    };
    const coordinator = new MeshCoordinator(adapter);
    coordinator.initialized = true;
    coordinator.persist = async () => {};
    coordinator.syncAppLifecycle = async () => {};
    coordinator.requestTick = () => {};
    return { adapter, coordinator };
}

function masterConfig() {
    return { ...C.defaultConfig(), role: 'master', siteId: 'site', nodeId: 'master', masterId: 'master' };
}

test('Home slave entitlement cannot configure or pair a Microgrid master', async () => {
    const { coordinator } = fixture(['microgridSlave']);
    try {
        await assert.rejects(coordinator.configure(masterConfig()), { code: 'MESH_ROLE_LICENSE_REQUIRED' });
        coordinator.config = masterConfig();
        assert.equal(coordinator.appState().licensed, false);
        assert.equal(coordinator.appState().enabled, false);
        await assert.rejects(coordinator.pair('house'), { code: 'MESH_ROLE_LICENSE_REQUIRED' });
    } finally { coordinator.stop(); }
});

test('explicit central Master grant permits configuration', async () => {
    const { coordinator } = fixture(['microgridMaster']);
    try {
        await coordinator.configure(masterConfig());
        assert.equal(coordinator.config.role, 'master');
        assert.equal(coordinator.appState().enabled, true);
    } finally { coordinator.stop(); }
});

test('existing Master regulation can retain its validated grant; new configuration and pairing cannot', async () => {
    const { coordinator } = fixture([], ['microgridMaster']);
    try {
        coordinator.config = masterConfig();
        assert.equal(coordinator.appState().enabled, true);
        await assert.rejects(coordinator.configure(masterConfig()), { code: 'MESH_ROLE_LICENSE_REQUIRED' });
        await assert.rejects(coordinator.pair('house'), { code: 'MESH_ROLE_LICENSE_REQUIRED' });
    } finally { coordinator.stop(); }
});

test('missing central grant authority fails closed', () => {
    const { adapter, coordinator } = fixture(['microgridMaster']);
    try {
        delete adapter._nwHasCentralLicenseGrant;
        adapter._nwLicenseAllowsAppId = () => true;
        coordinator.config = masterConfig();
        assert.equal(coordinator.appState().licensed, false);
    } finally { coordinator.stop(); }
});
