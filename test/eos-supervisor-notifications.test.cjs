/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { randomBytes, createHash } = require('node:crypto');
const { fork } = require('node:child_process');
const { NotificationMail } = require('../ui/lib/notification-mail');
const { EosSupervisorNotifications } = require('../src/lib/eosSupervisorNotifications');

const DAY = 86400000;
const recipient = 'owner@example.test';
const names = ['ui', 'ems', 'devices', 'eebus', 'backup', 'ocpp'];
const hash = id => createHash('sha256').update(id).digest('hex');
function baseline() {
    return { processes: Object.fromEntries(names.map(id => [id, 'online'])),
        devices: Object.fromEntries(['devices','eebus','ocpp'].map(source => [source, {complete:true,tracked:[]}])),
        namespaces: {devices:'eos-admin.0',ocpp:'eos-admin.0.ocpp'} };
}
const ledger = async dir => JSON.parse(await readFile(join(dir,'notification-ledger.json'),'utf8'));

async function fixture(t, preserved=false) {
    const directory = await mkdtemp(join(tmpdir(),'eos-supervision-'));
    t.after(()=>rm(directory,{recursive:true,force:true}));
    const namespace = preserved ? 'nexowatt-ui.4' : 'eos-admin.0';
    const settings = {notifyEnabled:true,email:recipient,notifySystem:true,notifyCommunication:true,notifyRecovery:true};
    const secret = randomBytes(32).toString('hex');
    const events=[]; const reads=[]; const debug=new Map();
    const context = {now: 1_800_000_000_000, observation:baseline(),waitSend:null};
    function readSetting(id) {
        assert.ok(id.startsWith(namespace+'.settings.'));
        reads.push(id); const val=settings[id.slice((namespace+'.settings.').length)];
        return val === undefined ? null : {val,ack:true,q:0};
    }
    const owner = {namespace:'eos-admin.0',config:preserved?{eosUiMigration:{preserveNamespace:true,source:namespace}}:{},
        getForeignObjectAsync:async id=>id==='system.config'?{native:{secret}}:undefined,
        getForeignStateAsync:async id=>readSetting(id),
        getForeignStatesAsync:async ids=>Object.fromEntries(ids.map(id=>[id,readSetting(id)])),
        setForeignStateChangedAsync:async (id,val)=>debug.set(id,val),log:{warn(){}}};
    const local = {namespace,getForeignObjectAsync:owner.getForeignObjectAsync,
        _notifySetDebugState:async (id,val)=>debug.set(id,val),
        _notifyGetSettingBool:(id,defaultValue)=>settings[id]??defaultValue,
        _notifyGetSettingString:(id,defaultValue)=>settings[id]??defaultValue};
    const options = {directory,now:()=>context.now,createTransport:()=>({
        close(){}, async sendMail(message){ events.push(message); await context.waitSend?.(); return {accepted:[recipient],rejected:[]}; }
    })};
    const configMail = new NotificationMail(local,options);
    await configMail.configure({enabled:true,host:'smtp.example.test',user:'fixture',password:'test-fixture-password',port:465});
    assert.doesNotMatch(await readFile(join(directory,'notification-mail.json'),'utf8'),/smtp\.example|test-fixture-password/);
    t.after(()=>configMail.close());
    const supervisor=()=> {
        const service = new EosSupervisorNotifications(owner,()=>context.observation,options);
        t.after(()=>service.close()); return service;
    };
    const sender=supervisor();
    await sender.tick(); context.now+=31_000;
    return {directory,context,settings,events,reads,debug,supervisor,sender,configMail,local,options,namespace,secret,owner};
}

if (process.env.EOS_SUPERVISION_LOCK_CHILD === '1') {
    process.once('message',async ({directory,namespace,secret,now})=>{
        let attempted=0;
        const mail = new NotificationMail({namespace,getForeignObjectAsync:async ()=>({native:{secret}}),
            _notifySetDebugState:async()=>{}},{directory,now:()=>now,createTransport:()=>({
            async sendMail(){attempted++;return {accepted:[recipient]};},close(){}
        })});
        try { process.send({result:await mail.test(recipient),attempted}); }
        finally {mail.close();process.disconnect();}
    });
} else {
test('parent sends distinct device and process incidents from a preserved namespace, survives restart and only reports confirmed recovery',async t=>{
    const f=await fixture(t,true); const {context,events}=f;
    const first=hash('physical one'),second=hash('physical two');
    context.observation.processes.ems='offline';
    context.observation.devices.devices.tracked=[{key:first,name:'Technikraum',state:'offline'}];
    context.observation.devices.eebus.tracked=[{key:second,name:'Technikraum',state:'offline'}];
    await f.sender.tick();
    assert.equal(events.length,1); assert.match(events[0].subject,/3 Störung/);
    assert.match(events[0].text,/Energiemanagement/); assert.match(events[0].text,/Technikraum/);
    assert.ok(!events[0].text.includes(first) && !events[0].text.includes(second));
    assert.equal(events[0].to,recipient);
    assert.equal((await ledger(f.directory)).records.length,3);
    f.sender.close();
    const restarted=f.supervisor(); await restarted.tick();context.now+=31_000;await restarted.tick();
    assert.equal(events.length,1,'same unresolved alarms cannot fire again after a restart');

    context.observation.processes.ems='unknown';
    context.observation.devices.devices={complete:false,tracked:[]};
    context.observation.devices.eebus.tracked[0].state='unknown';
    context.now+=DAY; await restarted.tick();
    assert.equal(events.length,1,'loss of evidence cannot create reminders or recoveries');
    context.observation.processes.ems='online';context.observation.devices.devices={complete:true,tracked:[{key:first,name:'Technikraum',state:'online'}]};
    context.observation.devices.eebus.tracked[0].state='disabled';
    await restarted.tick(); context.now+=300001; await restarted.tick();
    assert.equal(events.length,2);assert.match(events[1].subject,/0 Störung\(en\), 2 Entwarnung/);
    assert.equal(events[1].text.match(/Technikraum/g)?.length,1,'a deliberately disabled EEBus partner never generates recovery');
    assert.ok(f.reads.every(id=>id.startsWith('nexowatt-ui.4.settings.')));
});

test('system and communications switches independently control mail and a planned stop clears an old incident silently',async t=>{
    const f=await fixture(t); const o=f.context.observation;
    o.processes.ui='offline'; o.devices.ocpp.tracked=[{key:hash('wallbox'),name:'Ladestation 1',state:'offline'}];
    f.settings.notifySystem=false; await f.sender.tick();
    assert.equal(f.events.length,1);assert.match(f.events[0].text,/Ladestation/);assert.doesNotMatch(f.events[0].text,/Oberfläche/);
    f.settings.notifyCommunication=false; f.settings.notifySystem=true;
    f.context.now+=125000; await f.sender.tick(); assert.equal(f.events.length,2);assert.match(f.events[1].text,/Oberfläche/);
    o.processes.ui='disabled';o.devices.ocpp={complete:true,tracked:[]};
    f.context.now+=DAY+1;await f.sender.tick();
    assert.equal(f.events.length,2); assert.equal((await ledger(f.directory)).records.length,0);
    f.settings.notifyEnabled=false;const inactive=f.supervisor();
    o.processes.ems='offline';await inactive.tick();f.context.now+=DAY;await inactive.tick();
    assert.equal(f.events.length,2,'the master switch suppresses new outages and all reminders');
});

test('256 active devices and a new EMS process failure all retain their delivery records',async t=>{
    const f=await fixture(t); const o=f.context.observation;
    for (const source of ['devices','eebus']) {
        o.devices[source].tracked=Array.from({length:128},(_,i)=>({key:hash(source+i),name:'Technik '+i,state:'offline'}));
    }
    await f.sender.tick();
    const last='supervisor:device:eebus:'+hash('eebus127');
    assert.equal(new Map((await ledger(f.directory)).records).get(last).active,true);
    o.processes.ems='offline';f.context.now+=10000;await f.sender.tick();
    const records=new Map((await ledger(f.directory)).records);
    assert.equal(records.size,257);
    assert.match(f.events.at(-1).text,/Energiemanagement/, 'new confirmed EMS failure is in the next group even with hundreds of queued device faults');
    assert.equal(records.get('supervisor:process:ems').active,true,'device inventory may never prevent a new EMS failure from being reported');
    assert.equal(records.get(last).active,true,'all previously reported devices remain active');
    const reload=new NotificationMail(f.local,f.options);t.after(()=>reload.close());await reload.init();
    assert.equal(reload.policy.records.size,257,'restarting a sender preserves the whole persisted delivery ledger');
    assert.ok(reload.policy.records.get('supervisor:process:ems')?.active);
});

test('an interrupted five-minute recovery window restarts with a fresh physical observation',async t=>{
    const f=await fixture(t);const group=f.context.observation.devices.ocpp;
    group.tracked=[{key:hash('garage'),name:'Ladestation Garage',state:'offline'}];
    await f.sender.tick();assert.equal(f.events.length,1);
    group.tracked[0].state='online';f.context.now+=1000;await f.sender.tick();
    group.tracked[0].state='unknown';f.context.now+=239000;await f.sender.tick();
    f.context.now+=DAY;await f.sender.tick();assert.equal(f.events.length,1);
    group.tracked[0].state='online';await f.sender.tick();
    f.context.now+=299999;await f.sender.tick();assert.equal(f.events.length,1,'old healthy time must not contribute');
    f.context.now+=1;await f.sender.tick();assert.equal(f.events.length,2);
    assert.match(f.events[1].subject,/1 Entwarnung/);
});

test('an already reported legacy inverter and its monitored native device share delivery history across namespaces',async t=>{
    const f=await fixture(t,true);
    const deviceId='pv.west', root='nexowatt-devices.3.devices.'+deviceId;
    Object.assign(f.local,{config:{ems:{enabled:false},chargingManagement:{enabled:false}},
        getStateAsync:async()=>null,getForeignStateAsync:async id=>id===root+'.aliases.v1.comm.connected'?{val:false}:null,
        _notify:{watchedInstances:{instances:[]},nwDevices:{pvInverters:[{id:root,name:'West',dp:{connected:root+'.aliases.v1.comm.connected'}}]}},
        _notifyRefreshNwDevicesCache:async()=>{},_notifyRefreshWatchedInstances:async()=>{}});
    f.settings.notifyCommunication=false;f.settings.notifyInverters=true;
    const normal=new NotificationMail(f.local,f.options);t.after(()=>normal.close());
    await normal.tick();f.context.now+=31000;await normal.tick();f.context.now+=1800001;await normal.tick();
    assert.equal(f.events.length,1,'pre-upgrade inverter warning reached its normal reporting window');
    assert.match(f.events[0].text,/Wechselrichter/);
    f.settings.notifyCommunication=true;
    const o=f.context.observation;o.namespaces.devices='nexowatt-devices.3';
    o.devices.devices.tracked=[{key:hash(deviceId),name:'West',state:'offline'}];
    await f.sender.tick();await normal.tick();
    assert.equal(f.events.length,1,'same physical incident cannot send again through the new supervisor');
    const r=new Map((await ledger(f.directory)).records);
    assert.ok(r.get('supervisor:device:devices:'+hash(deviceId))?.alertSent);
    assert.equal(r.has('inverter:'+root),false);
    f.settings.notifyInverters=false; f.settings.notifyCommunication=false;
    await f.sender.tick(); await normal.tick();
    assert.equal((await ledger(f.directory)).records.length,0);
    f.context.now+=DAY; await normal.tick();await f.sender.tick();
    assert.equal(f.events.length,1,'disabling both categories does not create reminders or recoveries');
});

test('a changed recipient or withdrawn communications consent discards a stale EMS collection before committing the ledger', async t => {
    const f = await fixture(t);
    f.context.observation.processes.ems = 'offline';
    await f.sender.tick();
    const original = await ledger(f.directory);
    const worker = new NotificationMail(f.local, f.options);
    t.after(() => worker.close());
    worker.collect = async () => [{id:'lp:external:offline',category:'communications',severity:'critical',title:'Extern',message:'Verbindung unterbrochen.'}];
    f.context.now += 31000;
    let recipientValue = 'changed@example.test', comm = true;
    f.local.getForeignStatesAsync = async keys => Object.fromEntries(keys.map(id => {
        const k = id.slice((f.namespace + '.settings.').length);
        const val = k === 'email' ? recipientValue : k === 'notifyCommunication' ? comm : f.settings[k] ?? true;
        return [id,{val,ack:true,q:0}];
    }));
    await worker.tick();
    recipientValue = recipient; comm = false;
    await worker.tick();
    assert.equal(f.events.length,1);
    assert.deepEqual(await ledger(f.directory),original);
    f.local.getForeignStatesAsync = f.owner.getForeignStatesAsync;
    await worker.tick(); assert.equal(f.events.length,2);
});

test('rolling back a migrated UI namespace relinquishes its ledger and cannot send from its settings', async t => {
    const f = await fixture(t,true);
    let allowed = true;
    f.owner.eosMigration = {allowsStartup:()=>allowed};
    f.context.observation.processes.ems='offline';
    await f.sender.tick();
    const previous = await ledger(f.directory), reads = f.reads.length;
    allowed=false;
    f.context.observation.processes.ui='offline'; f.context.now+=DAY;
    await f.sender.tick();
    assert.equal(f.events.length,1);
    assert.equal(f.reads.length,reads);
    assert.deepEqual(await ledger(f.directory),previous);
});

test('a rollback during SMTP preserves the ledger written by the restored standalone owner', async t => {
    const f = await fixture(t,true);
    let allowed = true, started, released;
    f.owner.eosMigration = {allowsStartup:()=>allowed};
    const entered = new Promise(resolve=>{ started=resolve; });
    const release = new Promise(resolve=>{ released=resolve; });
    f.context.waitSend=()=>{started();return release;};
    f.context.observation.processes.ems='offline';
    const pending = f.sender.tick();
    await entered;
    try {
        allowed=false;
        await writeFile(join(f.directory,'notification-ledger.json'),'{"standalone":"restored"}');
    } finally { released(); }
    await pending;
    assert.deepEqual(await ledger(f.directory),{standalone:'restored'});
});

test('an independent process cannot block the local sender or bypass the shared SMTP test quota',{timeout:15000},async t=>{
    const f=await fixture(t);
    let notifyEntered; let unblock;
    const entered = new Promise(resolve=>{notifyEntered=resolve;});
    const hold = new Promise(resolve=>{unblock=resolve;});
    f.context.waitSend=()=>{notifyEntered();return hold;};
    const sending=f.configMail.test(recipient);await entered;
    const child=fork(__filename,[],{env:{...process.env,EOS_SUPERVISION_LOCK_CHILD:'1'},execArgv:[],silent:true});
    t.after(()=>{unblock();child.kill();});
    const observed=new Promise((resolve,reject)=>{child.once('message',resolve);child.once('error',reject);child.once('exit',code=>{if(code)reject(new Error('child exit '+code));});});
    child.send({directory:f.directory,namespace:f.namespace,secret:f.secret,now:f.context.now});
    const response=await observed;
    assert.equal(response.attempted,0);assert.equal(response.result.ok,false);assert.match(response.result.error,/läuft bereits/);
    unblock();assert.equal((await sending).ok,true);assert.equal(f.events.length,1);
    f.context.waitSend=null;
    const other=new NotificationMail(f.local,f.options);t.after(()=>other.close());
    assert.equal((await other.test(recipient)).ok,false,'restart cannot bypass minimum interval');
    f.context.now+=300000;assert.equal((await other.test(recipient)).ok,true);
    f.context.now+=300000;assert.equal((await f.configMail.test(recipient)).ok,true);
    f.context.now+=300000;assert.equal((await other.test(recipient)).ok,false,'hourly quota spans owners');
    assert.equal(f.events.length,3);
});
}
