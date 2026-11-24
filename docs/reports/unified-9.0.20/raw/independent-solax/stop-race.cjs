'use strict';
const assert=require('node:assert/strict');
const root='/workspace/scratch/741f792566ea/source-920/iobroker.eos-admin';
const {DeviceRuntime}=require(root+'/modules/devices/lib/deviceRuntime');
const t=require(root+'/modules/devices/lib/templates.json').templates.find(t=>t.id==='ess.solax.SolaXHybridX1X3Ess');
(async()=>{
const states=new Map();let entered,release;const paused=new Promise(r=>entered=r);const barrier=new Promise(r=>release=r);let intercept=false;
const rt=new DeviceRuntime({namespace:'eos-admin.0',log:{info(){},warn(){},error(){},debug(){}},setObjectNotExistsAsync:async()=>{},extendObjectAsync:async()=>{},getStateAsync:async()=>null,setStateAsync:async(id,v)=>{if(intercept&&id==='devices.s.aliases.r.soh'){intercept=false;entered();await barrier;}states.set(id,v);}}, {id:'s',templateId:t.id,protocol:'modbusTcp'},t,{});
await rt.initObjects();rt.started=true;intercept=true;
const pending=rt._updateAliases({sOH:99,sET_CONTROL_MODE:4,sET_ACTIVE_POWER:600},{connected:true});
await paused;await rt.stop();const afterStop=states.get('devices.s.aliases.v1.r.powerSetpointReadbackW');release();await pending;const afterDrain=states.get('devices.s.aliases.v1.r.powerSetpointReadbackW');
console.log(JSON.stringify({node:process.version,afterStop,afterDrain,started:rt.started}));assert.equal(afterDrain.val,null,'Stopped alias update must not resurrect qualified mode4 feedback');
})().catch(e=>{console.error(e.message);process.exitCode=1});
