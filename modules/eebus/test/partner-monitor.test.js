'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {PartnerMonitor} = require('../build/lib/partnerMonitor');
const {EebusRuntime} = require('../build/lib/eebusRuntime');
const testId='AB'.repeat(20), pin='EF'.repeat(32), name='Wärmepumpe West';
const roster='pairing.monitoredPartners';

function sample() {
    let active=false, clock=0;
    const values=new Map();
    const store={getStateAsync:async k=>values.get(k), setStateAsync:async(k,v)=>{values.set(k,v);},
        canOperate:()=>true, namespace:'eos-admin.0.eebus'};
    function paired() {
        values.set('devices.'+testId+'.pairing.trusted',{val:true,ack:true});
        values.set('devices.'+testId+'.pairing.pinnedFingerprint',{val:pin,ack:true});
    }
    const open = () => new PartnerMonitor(store, id=>active && id===testId, ()=>clock);
    return {store,values,paired,open,connected(x){active=x;},clock(x){clock=x;}};
}

test('EEBus requires local intent, a trusted and pinned live data-exchange and a local display name', async()=>{
    const f=sample(), m=f.open();await m.load();
    assert.deepEqual(m.report(),{state:'ok',offline:[],totalOffline:0,tracked:[],complete:true});
    f.paired(); m.observed(testId);
    await assert.rejects(m.configure(testId,name,true),/PAIRED_SESSION/);
    f.connected(true); f.values.delete('devices.'+testId+'.pairing.trusted');
    await assert.rejects(m.configure(testId,name,true),/PAIRED_SESSION/);
    f.paired(); f.values.delete('devices.'+testId+'.pairing.pinnedFingerprint');
    await assert.rejects(m.configure(testId,name,true),/PAIRED_SESSION/); f.paired();
    for (const label of [testId,'192.168.0.1','AA-BB-CC-DD-EE-FF','https://peer.local/','']) {
        await assert.rejects(m.configure(testId,label,true),/LOCAL_NAME/);
    }
    assert.equal(f.values.has(roster),false);
    await m.configure(testId,name,true);
    assert.equal(m.report().tracked[0].state,'online');
    f.connected(false);
    const fault=m.report();
    assert.deepEqual(fault.offline,[{name}]); assert.equal(fault.state,'fault');
    assert.match(fault.tracked[0].key,/^[a-f0-9]{64}$/);
    assert.ok(!JSON.stringify(fault).toLowerCase().includes(testId.toLowerCase()));
    assert.ok(!JSON.stringify(fault).toLowerCase().includes(pin.toLowerCase()));
    f.connected(true);
    assert.equal(m.report().state,'ok');
    assert.equal(m.report().tracked[0].key,fault.tracked[0].key);
});
test('EEBus opted-in partner survives reboot, allows time to reconnect, and remains paused after deliberate disconnect',async()=>{
    const f=sample();f.paired();f.connected(true);
    const before=f.open();await before.load();await before.configure(testId,name,true);
    f.connected(false);const after=f.open();await after.load();
    assert.equal(after.report().tracked[0].state,'unknown');
    f.clock(119999);assert.equal(after.report().totalOffline,0);
    f.clock(120000);assert.equal(after.report().tracked[0].state,'offline');
    await after.pause(testId);assert.equal(after.report().tracked[0].state,'disabled');
    const restart=f.open();await restart.load();f.clock(240001);assert.equal(restart.report().tracked[0].state,'disabled');
    await restart.configure(testId,'',false); assert.equal(restart.report().tracked.length,0);
});
test('EEBus revocation and pin change disable monitoring persistently; invalid storage cannot generate an offline declaration',async()=>{
    const f=sample();f.paired();f.connected(true);
    const m=f.open();await m.load(); await m.configure(testId,name,true);
    await m.pinChanged(testId,pin);assert.equal(m.report().tracked[0].state,'online');
    await m.pinChanged(testId,'B1'.repeat(32));assert.equal(m.report().tracked[0].state,'disabled');
    await m.configure(testId,name,true);f.values.set('devices.'+testId+'.pairing.trusted',{val:false,ack:true});
    const next=f.open();await next.load();assert.equal(next.report().tracked[0].state,'disabled');
    f.paired();const again=f.open();await again.load();assert.equal(again.report().tracked[0].state,'disabled');
    f.values.set(roster,{val:'{}',ack:true});
    const bad=f.open();await bad.load();assert.equal(bad.report().complete,false);assert.equal(bad.report().totalOffline,0);
    await assert.rejects(bad.configure(testId,name,true),/STORAGE_UNAVAILABLE/);
    assert.equal(f.values.get(roster).val,'{}');
});
test('the normal EEBus disconnect and trust-revocation entry points pause an active monitored partner', async()=>{
    const f=sample();f.paired();let open=true,physicalCommands=0;
    const runtime=new EebusRuntime(f.store,{}, {}, {});
    runtime.endpoint={hasAuthorizedExchange:()=>open,disconnect(){physicalCommands++;open=false;}};
    await runtime.partnerMonitor.load();
    await runtime.partnerMonitor.configure(testId,name,true);assert.equal(physicalCommands,0);
    await runtime.handleStateChange(f.store.namespace+'.devices.'+testId+'.control.disconnect',{val:true,ack:false});
    assert.equal(runtime.partnerMonitor.report().tracked[0].state,'disabled');assert.equal(physicalCommands,1);
    open=true; await runtime.partnerMonitor.configure(testId,name,true);
    await runtime.handleStateChange(f.store.namespace+'.devices.'+testId+'.pairing.trusted',{val:false,ack:true});
    assert.equal(runtime.partnerMonitor.report().tracked[0].state,'disabled');
});
