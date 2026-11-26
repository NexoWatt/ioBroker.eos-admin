/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createServer} = require('node:http');
const {resolve} = require('node:path');
const {createHash} = require('node:crypto');
const {EosModuleProcess} = require('../src/lib/eosModuleProcess');
const {dashboardProcessStatus, notificationProcessStatus, normalizedDeviceHealth} = require('../src/lib/eosDashboardProcessStatus');

const ids = ['ui','ems','devices','eebus','backup','ocpp'];
const keys = ['a'.repeat(64),'b'.repeat(64)];
function snapshot(now) {
    const sources = Object.fromEntries(ids.map(id => [id,{
        reason:'',enabled:true,configured:true,active:true,emsReady:true,
        process:{state:'running',pid:100,generation:0,lastHeartbeatAt:now},
    }]));
    sources.ocpp.configured=false;
    sources.eebus.configured=false;
    return sources;
}
const device = {id:'device-900020002', name:'Energiezähler', templateId:'meter.shelly.pro3em',protocol:'http'};
const until = async (predicate, message) => {
    const stop=Date.now()+20000;
    while (Date.now() < stop) {
        if (predicate()) return;
        await new Promise(resolve => setTimeout(resolve,50));
    }
    assert.fail(message);
};

test('parent redacts telemetry, rejects bad reports and never turns a lost owner into physical failures/recoveries',() => {
    const now=Date.now();
    const sources=snapshot(now);
    const own={state:'fault',totalOffline:1,complete:true,offline:[{name:'Außenzähler',id:'private'}],
        tracked:[{key:keys[0],name:'Außenzähler',state:'offline'}],wrong:'never deliver'};
    const data=normalizedDeviceHealth(own);
    assert.deepEqual(data.offline,[{name:'Außenzähler'}]); assert.equal(data.wrong,undefined);
    assert.equal(normalizedDeviceHealth({...own,offline:[{name:'192.168.10.42'}]}),null);
    for (const name of ['Wärmepumpensteuerung','Pompa północna','Θέρμανση']) {
        assert.ok(normalizedDeviceHealth({...own,offline:[{name}],tracked:[{...own.tracked[0],name}]}));
    }
    assert.equal(normalizedDeviceHealth({...own,offline:[{name:'aa-bb-cc-dd-ee-ff'}]}),null);
    assert.equal(normalizedDeviceHealth({...own,tracked:[{key:'raw id',name:'Ofen',state:'online'}]}),null);
    assert.equal(normalizedDeviceHealth({...own,tracked:[]}),null);
    sources.devices.deviceHealth={...data,observedAt:now};
    const publicData=dashboardProcessStatus(sources,now);
    assert.deepEqual(publicData.deviceHealth,{state:'fault',totalOffline:1,offline:[{name:'Außenzähler'}]});
    assert.doesNotMatch(JSON.stringify(publicData),/tracked|private|a{64}/);
    assert.deepEqual(notificationProcessStatus(sources,now).devices.devices,{complete:true,tracked:data.tracked});
    sources.devices.deviceHealth.observedAt-=6001;
    assert.equal(dashboardProcessStatus(sources,now).deviceHealth.state,'unknown');
    assert.deepEqual(notificationProcessStatus(sources,now).devices.devices,{complete:false,tracked:[]});
    sources.devices.deviceHealth.observedAt=now;
    sources.devices.process.state='failed';
    assert.deepEqual(dashboardProcessStatus(sources,now).deviceHealth,{state:'unknown',totalOffline:0,offline:[]});
    assert.deepEqual(notificationProcessStatus(sources,now).devices.devices,{complete:false,tracked:[]});
});

test('aggregates active owners without name-based deduplication, caps names and ignores vehicles/optional unavailable modules',() => {
    const now=Date.now(); const src=snapshot(now);
    src.devices.deviceHealth={observedAt:now,state:'fault',totalOffline:13,offline:Array.from({length:12},()=>({name:'Lager'}))};
    src.ocpp.configured=true; src.ocpp.deviceHealth={observedAt:now,state:'fault',totalOffline:1,offline:[{name:'Ladestation 1'}]};
    const result=dashboardProcessStatus(src,now).deviceHealth;
    assert.equal(result.state,'fault'); assert.equal(result.totalOffline,14); assert.equal(result.offline.length,12);
    src.devices.configured=false;
    src.ocpp.deviceHealth={observedAt:now,state:'ok',totalOffline:0,offline:[]};
    assert.deepEqual(dashboardProcessStatus(src,now).deviceHealth,{state:'ok',totalOffline:0,offline:[]});
    src.eebus.configured=true;
    src.eebus.deviceHealth={observedAt:now,state:'fault',totalOffline:1,offline:[{name:'EEBus-Partner 1'}],
        complete:true,tracked:[{key:keys[1],name:'EEBus-Partner 1',state:'offline'}]};
    assert.deepEqual(dashboardProcessStatus(src,now).deviceHealth,{state:'fault',totalOffline:1,offline:[{name:'EEBus-Partner 1'}]});
    assert.deepEqual(notificationProcessStatus(src,now).devices.eebus,{complete:true,tracked:src.eebus.deviceHealth.tracked});
});

test('before a device’s first packet, wait for the configured interval; transport failure and data return are independent of actuator state',() => {
    const {DeviceRuntime}=require('../modules/devices/lib/deviceRuntime');
    const runtime=Object.create(DeviceRuntime.prototype);
    const now=Date.now();
    Object.assign(runtime,{started:true,_hbLastSeen:0,_hbOnline:false,_dashboardMonitoringAt:now,_hbTimeoutMs:10000});
    assert.equal(runtime.getDashboardReachability(now),'unknown');
    assert.equal(runtime.getDashboardReachability(now+10000),'unknown');
    assert.equal(runtime.getDashboardReachability(now+10001),'offline');
    runtime._hbLastSeen=now+10001; runtime._hbOnline=true;
    assert.equal(runtime.getDashboardReachability(now+10002),'online');
    runtime._dashboardTransportFailed=true;
    assert.equal(runtime.getDashboardReachability(now+10002),'offline');
    runtime.started=false;
    assert.equal(runtime.getDashboardReachability(now+10002),'unknown');
});

test('real Devices worker reports HTTP meter offline then online, skips a disabled transport and drops evidence on stop',{timeout:60000},async t => {
    let connected=false;
    const server=createServer((req,res)=>{
        if (!connected) {res.writeHead(503);res.end();return;}
        res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({total_act_power:1234,a_current:1,b_current:0,c_current:0}));
    });
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    t.after(()=>new Promise(resolve=>server.close(resolve)));
    const baseUrl='http://127.0.0.1:'+server.address().port;
    const disabled={...device,id:'private-serial-123456',name:'192.168.1.45',enabled:false};
    const config={enabled:true,devices:[{...device,connection:{baseUrl},pollIntervalMs:400,heartbeatTimeoutMs:1500},disabled]};
    const adapter={namespace:'eos-admin.0',instance:0,log:{},config:{},
        getStateAsync:async()=>null,getObjectAsync:async()=>null,setObjectNotExistsAsync:async()=>true,
        setStateAsync:async()=>true,extendObjectAsync:async()=>true};
    const child=new EosModuleProcess({id:'devices',baseDir:resolve(__dirname,'..'),generation:1,canOperate:()=>true,
        moduleOptions:{adapter,config,dataDir:__dirname}});
    t.after(()=>child.stop());
    assert.equal(child.getDeviceHealth(),null); await child.start();
    await until(()=>child.getDeviceHealth()?.totalOffline===1,'device never reported its expired heartbeat');
    const key=createHash('sha256').update(device.id).digest('hex');
    const lost=child.getDeviceHealth();
    assert.deepEqual(lost.offline,[{name:'Energiezähler'}]);
    assert.deepEqual(lost.tracked.find(r=>r.key===key),{key,name:'Energiezähler',state:'offline'});
    assert.equal(lost.tracked[1].state,'disabled'); assert.equal(lost.tracked[1].name,'Gerät 2');
    assert.doesNotMatch(JSON.stringify(lost),/192\.168|private-serial|device-9000|127\.0\.0/);
    connected=true;
    await until(()=>child.getDeviceHealth()?.tracked.find(r=>r.key===key)?.state==='online','meter never recovered after real successful physical sample');
    assert.equal(child.getDeviceHealth().state,'ok');
    await child.stop(); assert.equal(child.getDeviceHealth(),null);
});
