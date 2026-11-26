'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { once } = require('node:events');
const {
    from,
    station,
    oldUi,
    site,
    gridId,
    plantConfig,
    port,
    meter,
    fixture,
} = require('./fixtures/eos-customer-web-controller.cjs');

async function processAction(x, id, action) {
    const control = x.owner.eosRuntimeControl;
    await x.until(() => {
        try {
            return control.request(id, action, control.revision).accepted === true;
        } catch (error) {
            if (error.code === 'EOS_RUNTIME_BUSY') return false;
            throw error;
        }
    }, id + ' process management ready');
    await control.whenIdle();
    assert.equal(control.isEnabled(id), action !== 'disable');
}

test(
    'a customer-confirmed stopped legacy UI and an active Devices instance cut over exactly once through the actual Web listener',
    { timeout: 35000 },
    async t => {
        const sample = await meter(t);
        const x = await fixture(t, { device: sample.device });
        const oldObject = structuredClone(x.objects.get(gridId));
        if (process.env.EOS_CUSTOMER_UPGRADE_FROM) {
            const bundle = path.resolve(process.env.EOS_CUSTOMER_UPGRADE_FROM);
            await x.boot({ bundle });
            await x.until(
                () => x.owner.eosHostedRuntime.status().ui?.process?.state === 'running',
                'old recovery frontend',
            );
            assert.equal((await fetch(x.address() + '/login.html')).status, 200);
            const prior = x.owner.eosMigration.status();
            assert.equal(prior.phase, 'BLOCKED');
            assert.equal(prior.code, 'EOS_MIGRATION_DISABLED_UI_REVIEW');
            assert.deepEqual(
                prior.sources.map(row => row.id),
                ['ui'],
            );
            assert.deepEqual(x.toggles, []);
            assert.deepEqual(x.overlappingWriters, []);
            const allIds = [...x.objects.keys()].filter(id => id.startsWith(site + '.')).sort();
            t.diagnostic(
                JSON.stringify({
                    previous: require(path.join(bundle, 'package.json')).version,
                    migration: prior,
                    localObjects: allIds,
                    localStates: [...x.states.keys()].filter(id => id.startsWith(site + '.')).sort(),
                    destinationChannels: ['smarthome', 'ems', 'chargepoints', 'energyFlow'].filter(key =>
                        x.objects.has(site + '.' + key),
                    ),
                }),
            );
            await x.stop();
        }
        await x.boot();
        assert.ok(
            ['TRANSFERRED', 'COMMITTED'].includes(x.owner.eosMigration.phase),
            JSON.stringify({ state: x.owner.eosMigration.status(), logs: x.logs.slice(-14) }),
        );
        await x.until(() => x.owner.eosModuleHost?.supervisorState('devices').active, 'real Devices worker');
        await x.until(() => x.owner.eosMigration.phase === 'COMMITTED', 'committed handover');
        assert.equal(x.owner.eosHostedRuntime.status().emsReady, true);
        assert.equal(x.owner.eosModuleHost.namespace('devices'), station);
        assert.equal(x.owner.config.eosUiMigration.source, oldUi);
        assert.equal(x.owner.config.eosUi.datapoints.gridPointPower, gridId);
        assert.deepEqual(x.owner.config.eosUi.tariffProvider, plantConfig.tariffProvider);
        assert.equal(x.owner.config.eosUi.datapoints.batterySoc, plantConfig.datapoints.batterySoc);
        await x.until(() => sample.reads > 0 && x.states.get(gridId)?.val === 1847, 'live meter in retained namespace');
        assert.equal(x.states.get(gridId).ack, true);
        assert.deepEqual(x.objects.get(gridId).common.custom, oldObject.common.custom);
        assert.equal(sample.writes, 0);
        assert.deepEqual(x.overlappingWriters, []);
        assert.deepEqual(x.toggles, [{ id: 'system.adapter.' + station, enabled: false }]);
        const oldPid = x.owner.eosModuleHost.supervisorState('devices').process.pid;
        assert.ok(oldPid > 0 && oldPid !== process.pid);
        assert.equal((await fetch(x.address() + '/login.html')).status, 200);
        await x.stop();
        const priorSamples = sample.reads;
        sample.watts = 1562;
        await x.boot();
        await x.until(() => x.owner.eosModuleHost.supervisorState('devices').active, 'restarted Devices');
        assert.notEqual(x.owner.eosModuleHost.supervisorState('devices').process.pid, oldPid);
        assert.equal(x.owner.eosMigration.phase, 'COMMITTED');
        assert.deepEqual(x.owner.config.eosUi.tariffProvider, plantConfig.tariffProvider);
        assert.equal(x.owner.config.eosUi.datapoints.batterySoc, plantConfig.datapoints.batterySoc);
        assert.deepEqual(x.toggles, [{ id: 'system.adapter.' + station, enabled: false }]);
        assert.equal(x.objects.get('system.adapter.' + oldUi).common.enabled, false);
        await x.until(
            () => sample.reads > priorSamples && x.states.get(gridId)?.val === 1562,
            'fresh grid watts after restart',
        );
        assert.equal(x.states.get(gridId).ack, true);
        assert.deepEqual(x.objects.get(gridId).common.custom, oldObject.common.custom);
        assert.equal(sample.writes, 0);
        assert.deepEqual(x.overlappingWriters, []);
        t.diagnostic(
            JSON.stringify({
                version: from('./package.json').version,
                phase: x.owner.eosMigration.phase,
                originalWriterRestarts: x.toggles.filter(row => row.enabled).length,
                reads: sample.reads,
                postRestartWatts: x.states.get(gridId).val,
                distinctChildPids: new Set([
                    x.owner.eosHostedRuntime.status().ui.process.pid,
                    x.owner.eosHostedRuntime.status().ems.process.pid,
                    x.owner.eosModuleHost.supervisorState('devices').process.pid,
                ]).size,
                historyLink: 'influxdb.0',
                provider: x.owner.config.eosUi.tariffProvider.providerId,
            }),
        );
    },
);

test(
    'a fully active compatible legacy installation retains mappings when both writers hand over',
    { timeout: 22000 },
    async t => {
        const x = await fixture(t, { uiEnabled: true });
        await x.boot();
        assert.ok(
            ['TRANSFERRED', 'COMMITTED'].includes(x.owner.eosMigration.phase),
            JSON.stringify({ state: x.owner.eosMigration.status(), logs: x.logs.slice(-14) }),
        );
        await x.until(() => x.owner.eosMigration.phase === 'COMMITTED', 'live handover');
        assert.equal(x.owner.eosHostedRuntime.status().emsReady, true);
        assert.equal(x.owner.eosModuleHost.namespace('devices'), station);
        assert.equal(x.owner.config.eosUi.datapoints.gridPointPower, gridId);
        assert.deepEqual(x.toggles, [
            { id: 'system.adapter.' + oldUi, enabled: false },
            { id: 'system.adapter.' + station, enabled: false },
        ]);
        assert.deepEqual(x.overlappingWriters, []);
    },
);

test('missing stop evidence and an independent target mapping leave both original configurations intact', async t => {
    for (const condition of ['unknownStop', 'target', 'destinationChannel', 'invalidConfig'])
        await t.test(condition, async t => {
            const x = await fixture(t);
            if (condition === 'unknownStop') x.states.delete('system.adapter.' + oldUi + '.alive');
            else if (condition === 'destinationChannel')
                x.objects.set(site + '.energyFlow', {
                    _id: site + '.energyFlow',
                    type: 'channel',
                    common: { name: 'local commissioning' },
                    native: {},
                });
            else if (condition === 'invalidConfig')
                x.states.set(oldUi + '.installer.configJson', { val: '{broken', ack: true, ts: Date.now() });
            else x.originConfig.eosUi = { ...x.originConfig.eosUi, datapoints: { gridPointPower: 'meter.2.other' } };
            const before = structuredClone(x.objects.get('system.adapter.' + oldUi));
            await x.boot();
            const status = x.owner.eosMigration.status();
            assert.equal(status.phase, 'BLOCKED');
            if (condition === 'target') assert.equal(status.code, 'EOS_MIGRATION_DESTINATION_CONFIGURED');
            else if (condition === 'destinationChannel') assert.equal(status.code, 'EOS_MIGRATION_DESTINATION_STATES');
            else if (condition === 'invalidConfig') assert.equal(status.code, 'EOS_MIGRATION_UI_STATE_INVALID');
            else assert.match(status.code, /STOP|HOST/);
            assert.deepEqual(x.objects.get('system.adapter.' + oldUi), before);
            assert.equal(x.objects.get('system.adapter.' + station).common.enabled, true);
            assert.deepEqual(x.toggles, []);
            assert.deepEqual(x.overlappingWriters, []);
            assert.equal(x.owner.eosOwnership.canWrite(), false);
            assert.equal((await fetch(x.address() + '/login.html')).status, 200);
        });
});

test(
    'new installation remains reachable without license and starts from its saved process choices after activation and restart',
    { timeout: 25000 },
    async t => {
        const x = await fixture(t, { fresh: true, licensed: false });
        await x.boot();
        assert.equal(x.owner.eosMigration.phase, 'LICENSE_REQUIRED');
        assert.equal((await fetch(x.address() + '/login.html')).status, 200);
        assert.equal(x.owner.eosOwnership.canWrite(), false);
        x.setLicense(true);
        assert.equal(x.owner.eosOwnership.canWrite(), false, 'activation alone cannot transfer an uninspected estate');
        await x.stop();
        await x.boot();
        assert.equal(x.owner.eosMigration.phase, 'NOT_NEEDED');
        const host = x.owner.eosModuleHost;
        await x.until(() => host.supervisorState('devices').active, 'first licensed Devices start');
        await processAction(x, 'devices', 'disable');
        assert.equal(host.supervisorState('devices').active, false);
        await x.stop();
        await x.boot();
        assert.equal(x.owner.eosRuntimeControl.isEnabled('devices'), false);
        assert.equal(x.owner.eosModuleHost.supervisorState('devices').active, false);
        assert.deepEqual(x.toggles, []);
        assert.deepEqual(x.overlappingWriters, []);
    },
);

test(
    'licensed workers stay alive during two external ownership conflicts while field I/O and the OCPP socket stay fenced',
    { timeout: 35000 },
    async t => {
        const sample = await meter(t);
        const x = await fixture(t, { fresh: true });
        const ocppPort = await port();
        x.instance(station, true, '8.0.0', { devices: [sample.device] });
        x.instance('ocpp21.0', true, '0.4.3', { port: ocppPort });
        const config = {
            devices: { enabled: true, devices: [sample.device] },
            eebus: {
                enabled: true,
                discoveryEnabled: false,
                shipServerEnabled: false,
                autoConnectEnabled: false,
                nexowattBridgeEnabled: false,
                commandDryRun: true,
            },
            backup: { enabled: true, minimalEnabled: false, ccuEnabled: false },
            ocpp: { enabled: true, port: ocppPort, activeRefresh: false },
        };
        x.originConfig.eosModules = Object.fromEntries(
            Object.entries(config).map(([id, cfg]) => [id, { v: 1, encrypted: x.owner.encrypt(JSON.stringify(cfg)) }]),
        );
        await x.boot();
        const host = x.owner.eosModuleHost;
        const get = id =>
            ['ui', 'ems'].includes(id) ? x.owner.eosHostedRuntime.status()[id] : host.supervisorState(id);
        const ids = ['ui', 'ems', 'devices', 'eebus', 'backup', 'ocpp'];
        await x.until(
            () => ids.every(id => get(id)?.process?.pid > 0 && get(id)?.process?.lastHeartbeatAt > 0),
            'six real worker heartbeats',
        );
        assert.equal(new Set(ids.map(id => get(id).process.pid)).size, 6);
        await x.until(
            () => get('ui').active && get('ems').emsReady && get('eebus').active && get('backup').active,
            'independent licensed workers ready',
        );
        for (const id of ['ocpp', 'devices']) assert.equal(get(id).active, false, id + ' field ownership denied');
        const first = Object.fromEntries(ids.map(id => [id, get(id).process.lastHeartbeatAt]));
        await x.until(() => ids.every(id => get(id).process.lastHeartbeatAt > first[id]), 'all six leases refreshed');
        assert.equal(sample.connections, 0);
        assert.equal(sample.writes, 0);
        const probe = net.connect(ocppPort, '127.0.0.1');
        try {
            await assert.rejects(once(probe, 'connect'), { code: 'ECONNREFUSED' });
        } finally {
            probe.destroy();
        }
        assert.deepEqual(x.toggles, []);
        assert.deepEqual(x.overlappingWriters, []);
        assert.equal(x.objects.get('system.adapter.' + station).common.enabled, true);
        assert.equal(x.objects.get('system.adapter.ocpp21.0').common.enabled, true);
        // Operator can explicitly stop one waiting process without changing the external writer.
        await processAction(x, 'ocpp', 'disable');
        await x.until(() => !get('ocpp').process.pid, 'manual OCPP pause');
        assert.ok(get('devices').process.pid > 0 && get('backup').active);
        assert.equal(x.objects.get('system.adapter.ocpp21.0').common.enabled, true);
        // The controller confirms the external OCPP process stopped. Only an operator can
        // lift its saved pause. Devices remains fenced by its own conflicting source.
        const former = 'system.adapter.ocpp21.0';
        await x.owner.extendForeignObjectAsync(former, { common: { enabled: false } });
        host.onObjectChange(former);
        host.onStateChange(former + '.alive', x.states.get(former + '.alive'));
        await processAction(x, 'ocpp', 'enable');
        await x.until(() => get('ocpp').active, 'OCPP owns socket after operator release');
        const connection = net.connect(ocppPort, '127.0.0.1');
        try {
            await once(connection, 'connect');
        } finally {
            connection.destroy();
        }
        assert.equal(sample.connections, 0);
        assert.equal(sample.writes, 0);
        assert.ok(get('devices').process.pid > 0 && !get('devices').active);
        assert.deepEqual(x.toggles, [{ id: former, enabled: false }]);
        assert.deepEqual(x.overlappingWriters, []);
        t.diagnostic(
            JSON.stringify({
                workerPids: 6,
                heartbeatRounds: 2,
                conflictingOwners: ['devices', 'ocpp'],
                meterConnections: sample.connections,
                meterWrites: sample.writes,
                ocppPortClosedDuringConflict: true,
                ocppConnectedAfterConfirmedRelease: true,
            }),
        );
    },
);

test('occupied EOS listener rolls back only the previously active legacy writer', { timeout: 22000 }, async t => {
    const x = await fixture(t);
    const existing = http.createServer((_q, res) => res.end('existing site'));
    existing.listen(x.originConfig.port, '127.0.0.1');
    await once(existing, 'listening');
    t.after(async () => {
        existing.closeAllConnections();
        await new Promise(done => existing.close(done));
    });
    await x.boot({ expectFailure: true });
    assert.equal(x.owner.eosMigration.phase, 'ROLLED_BACK');
    assert.equal(x.owner.eosMigration.status().code, 'EOS_MIGRATION_WEB_START_FAILED');
    assert.deepEqual(x.toggles, [
        { id: 'system.adapter.' + station, enabled: false },
        { id: 'system.adapter.' + station, enabled: true },
    ]);
    assert.equal(x.objects.get('system.adapter.' + oldUi).common.enabled, false);
    assert.equal(x.objects.get('system.adapter.' + station).common.enabled, true);
    assert.deepEqual(x.overlappingWriters, []);
    assert.equal(await (await fetch('http://127.0.0.1:' + x.originConfig.port)).text(), 'existing site');
});
