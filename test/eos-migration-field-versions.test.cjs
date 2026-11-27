'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { from, station, oldUi, site, gridId, fixture, meter } = require('./fixtures/eos-customer-web-controller.cjs');

// This upgrade starts with the operator having stopped both external adapter
// instances. It exercises the same original settings and ioBroker objects
// across both releases, including the failed preflight on 9.0.36 when supplied.
test(
    'UI 1.0.35 and Devices 0.5.172 retain the field mapping from both stopped sources through restart',
    { timeout: 45000 },
    async t => {
        const sample = await meter(t);
        const x = await fixture(t, { device: sample.device });
        const ui = 'system.adapter.' + oldUi;
        const devices = 'system.adapter.' + station;
        const sourceNative = {
            pollIntervalMs: 5000,
            modbusTimeoutMs: 2000,
            registerAddressOffset: 0,
            devices: [],
            devicesJson: JSON.stringify([sample.device]),
        };
        x.instance(oldUi, false, '1.0.35', x.objects.get(ui).native);
        x.instance(station, false, '0.5.172', sourceNative);
        const original = [ui, devices].map(id => structuredClone(x.objects.get(id)));
        const historic = structuredClone(x.objects.get(gridId).common.custom);
        const alias = 'alias.0.NexoWattPilot.grid';
        const aliasObject = {
            _id: alias,
            type: 'state',
            common: {
                name: 'Netzpunkt',
                role: 'value.power',
                type: 'number',
                unit: 'W',
                read: true,
                write: false,
                alias: { id: gridId },
            },
            native: {},
        };
        x.objects.set(alias, structuredClone(aliasObject));

        if (process.env.EOS_MIGRATION_936_BASE) {
            const bundle = path.resolve(process.env.EOS_MIGRATION_936_BASE);
            assert.equal(require(path.join(bundle, 'package.json')).version, '9.0.36');
            await x.boot({ bundle });
            assert.equal(x.owner.eosMigration.status().code, 'EOS_MIGRATION_SOURCE_VERSION');
            assert.equal(x.owner.eosMigration.status().phase, 'BLOCKED');
            assert.equal((await fetch(x.address() + '/login.html')).status, 200);
            assert.deepEqual(x.toggles, []);
            await x.stop();
        }
        await x.boot();
        await x.until(() => x.owner.eosMigration.phase === 'COMMITTED', 'new migration committed');
        assert.equal(x.owner.eosModuleHost.namespace('devices'), station);
        assert.equal(x.owner.config.eosUiMigration.source, oldUi);
        assert.equal(x.owner.config.eosUi.datapoints.gridPointPower, gridId);
        const control = x.owner.eosRuntimeControl;
        await x.until(() => control.view('devices', false)?.canEnable, 'Devices available for activation');
        assert.equal(control.request('devices', 'enable', control.revision).accepted, true);
        await control.whenIdle();
        await x.until(
            () => sample.reads > 0 && x.states.get(gridId)?.val === sample.watts,
            'retained meter responds after enabling target Devices',
        );
        await x.stop();
        sample.watts = 1386;
        await x.boot();
        await x.until(() => x.states.get(gridId)?.val === sample.watts, 'retained meter after restart');
        assert.equal(x.owner.eosMigration.phase, 'COMMITTED');
        assert.equal((await fetch(x.address() + '/login.html')).status, 200);
        assert.deepEqual(
            [ui, devices].map(id => x.objects.get(id)),
            original,
        );
        assert.deepEqual(x.objects.get(alias), aliasObject);
        assert.deepEqual(x.objects.get(gridId).common.custom, historic);
        assert.equal(x.owner.config.eosUi.datapoints.gridPointPower, gridId);
        assert.equal(x.owner.config.eosUi.tariffProvider.providerId, 'tibber');
        assert.ok(x.objects.has('system.adapter.' + site));
        assert.deepEqual(x.overlappingWriters, []);
        assert.deepEqual(x.toggles, []);
        assert.equal(sample.writes, 0);
        t.diagnostic(
            JSON.stringify({
                release: from('./package.json').version,
                blocked936Reproduced: !!process.env.EOS_MIGRATION_936_BASE,
                sourceUi: '1.0.35',
                sourceDevices: '0.5.172',
                originalSourcesStillStopped: true,
                originalHistoryLink: Object.keys(historic),
                meterAfterRestartW: sample.watts,
            }),
        );
    },
);
