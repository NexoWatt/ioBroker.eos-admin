'use strict';
const assert = require('node:assert/strict');
const {planDeviceEms} = require('/workspace/scratch/741f792566ea/source-919/iobroker.eos-admin/src/lib/eosDeviceEmsPlan');
const row = (id, cls, mode) => ({baseId:`eos-admin.0.devices.${id}`,devId:id,name:id,templateId:`profile.${id}`,protocol:'modbusTcp',deviceClass:cls,enabled:true,aliasMeta:{},ems:{mode,scope:'M0',activation:{requested:true,requestId:`request-${id}-0123456789012345`,limits:{maxChargeW:3000,maxDischargeW:3000,coupling:'ac'}}}});
function alias(d,k,type,unit,write=false){d.aliasMeta[k]={id:`${d.baseId}.aliases.v1.${k}`,type,unit,read:!write,write,targetId:`${d.baseId}.${k}`};}
const s=row('storage','storageSystem','storageFarm');alias(s,'r.power','number','W');alias(s,'r.soc','number','%');alias(s,'ctrl.powerSetpointW','number','W',true);
const g=row('grid','meter','gridMeter');alias(g,'r.power','number','W');
const plan=(config,devices)=>planDeviceEms({config,devices,limits:{chargePoints:20,batteries:20},allowedApps:['storagefarm','charging','storage']});
const initial=plan({},[s,g]);assert.equal(initial.config.storageFarm.storages[0].enabled,true);
s.templateId='profile.replacement';
const only=plan(initial.config,[s,g]);assert.equal(only.config.storageFarm.storages[0].enabled,false);
const a=row('aaa','generic','auto');delete a.ems.activation;alias(a,'r.power','number','W');
const result=plan(initial.config,[s,g,a]);
console.log(JSON.stringify({status:result.statuses,actualEnabled:result.config.storageFarm.storages[0].enabled,expectedEnabled:false},null,2));
assert.equal(result.config.storageFarm.storages[0].enabled,false,'a preceding unassigned generic device must not defeat replacement-profile safety');
