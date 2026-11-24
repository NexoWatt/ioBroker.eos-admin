'use strict';
const assert=require('node:assert/strict');
const root='/workspace/scratch/741f792566ea/source-919/iobroker.eos-admin';
const {createHarness}=require(root+'/ui/test/unified/http-harness.cjs');
const {EosDeviceEmsService,projectDeviceEmsConfig}=require(root+'/src/lib/eosDeviceEmsService');
const {planDeviceEms}=require(root+'/src/lib/eosDeviceEmsPlan');
(async()=>{const h=await createHarness();const a=h.adapter;let s;try{
 const row=(id,cls,mode,limits={})=>({baseId:`eos-admin.0.devices.${id}`,devId:id,name:id,templateId:`review.${id}`,deviceClass:cls,enabled:true,aliasMeta:{},ems:{mode,scope:'M0',activation:{requested:true,requestId:`review-${id}-0123456789012345`,limits}}});
 const alias=(d,k,type,unit,write=false)=>d.aliasMeta[k]={id:`${d.baseId}.aliases.v1.${k}`,type,unit,read:!write,write,targetId:`${d.baseId}.${k}`};
 const storage=row('storage','storageSystem','storageFarm',{maxChargeW:3000,maxDischargeW:3500,coupling:'ac'});alias(storage,'r.power','number','W');alias(storage,'r.soc','number','%');alias(storage,'ctrl.powerSetpointW','number','W',true);
 const grid=row('grid','meter','gridMeter');alias(grid,'r.power','number','W');const devices=[storage,grid];
 a.config=structuredClone(require(root+'/ui/io-package.json').native);a.config.port=8188;a._hostedStartup={state:'ready'};a.persistInstallerConfigToState=Object.getPrototypeOf(a).persistInstallerConfigToState;a.startHistorieExportTimer=()=>{};h.owner.subscribeForeignStates=()=>{};h.owner.unsubscribeForeignStates=()=>{};
 await a.migrateNativeConfig();await a.loadInstallerConfigFromState();await a.syncSettingsConfigToStates();
 a._bridge.deviceEmsPlan=async input=>planDeviceEms({...input,config:projectDeviceEmsConfig(input.config),limits:{chargePoints:20,batteries:20}});
 const apply=a._nwApplyInstallerRuntime.bind(a);let applications=0;a._nwApplyInstallerRuntime=async(...args)=>{applications++;if(applications===1)throw new Error('EOS_EMS_APPLY_FAILED');return apply(...args);};
 s=new EosDeviceEmsService({owner:h.owner,getSnapshot:()=>({namespace:'eos-admin.0',devices:devices.map(d=>({id:d.devId})),moduleEnabled:true,generation:1,ready:true}),canRun:()=>true,apply:dev=>a.reconcileDeviceEms(dev)});s.inventory=async()=>devices;
 await s.flush();await new Promise(r=>setTimeout(r,1200));console.log(JSON.stringify({applications,applyPending:a._nwDeviceEmsApplyPending,service:s.view(),retryScheduled:!!s.timer},null,2));assert.equal(applications,2,'confirmed post-persistence apply failure should retry within its existing bounded budget');
}finally{await s?.stop();await new Promise(r=>a.onUnload(r));await h.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
