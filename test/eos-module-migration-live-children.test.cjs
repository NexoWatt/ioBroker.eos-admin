'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, meter, gridId, station, oldUi, plantConfig } = require('./fixtures/eos-customer-web-controller.cjs');

test('installer can repeat blocked migration on running EOS and bind fresh GUI, EMS and Devices children to the stopped field installation',
    { timeout: 40000 }, async t => {
        const sample = await meter(t);
        const x = await fixture(t, { device: sample.device });
        x.instance(oldUi, false, '1.0.35', plantConfig);
        x.instance(station, false, '0.5.172', { devices: [sample.device], pollIntervalMs: 1200 });
        const reference = 'script.js.local.maintenance';
        x.objects.set(reference, { _id:reference, type:'script', common:{ enabled:true, source:"sendTo('nexowatt-devices.0','status');" }, native:{} });
        await x.boot();
        assert.equal(x.owner.eosMigration.phase,'BLOCKED');
        assert.equal(x.owner.eosMigration.status().code,'EOS_MIGRATION_EXTERNAL_RPC_REFERENCE');
        await x.until(() => x.owner.eosHostedRuntime.status().ems.process.pid > 0 &&
            x.owner.eosHostedRuntime.status().ui.process.pid > 0,'shell and fenced EMS have separate processes');
        const oldProcesses=x.owner.eosHostedRuntime.status();
        const first=await x.owner.eosMigration.manualReview();
        assert.equal(first.sources.find(row=>row.id==='devices').sourceVersion,'0.5.172');
        assert.equal(x.owner.eosMigration.manualView().canActivateDevices,true);
        assert.equal(sample.reads,0);
        x.objects.delete(reference);
        x.owner.eosMigration.requestManual(true, x.owner.eosMigration.manualView().revision, async()=>true);
        await x.owner.eosMigration.whenManualIdle();
        assert.deepEqual(x.owner.eosMigration.manualView().operation, {state:'complete',code:''},
            JSON.stringify({status:x.owner.eosMigration.status(),logs:x.logs.slice(-18)}));
        await x.until(() => sample.reads>0 && x.states.get(gridId)?.val===sample.watts, 'old meter ID gets samples from embedded Devices');
        const live = x.owner.eosHostedRuntime.status();
        assert.notEqual(live.ui.process.pid,oldProcesses.ui.process.pid);
        assert.notEqual(live.ems.process.pid,oldProcesses.ems.process.pid);
        assert.equal(live.emsReady,true);
        assert.equal(x.owner.eosModuleHost.namespace('devices'),station);
        assert.equal(x.owner.config.eosUiMigration.source,oldUi);
        assert.deepEqual(x.owner.config.eosUi.tariffProvider,plantConfig.tariffProvider);
        assert.equal(x.objects.get('system.adapter.'+oldUi).common.enabled,false);
        assert.equal(x.objects.get('system.adapter.'+station).common.enabled,false);
        assert.deepEqual(x.overlappingWriters,[]);
        assert.equal(sample.writes,0);
        assert.equal((await fetch(x.address()+'/login.html')).status,200);
    });
