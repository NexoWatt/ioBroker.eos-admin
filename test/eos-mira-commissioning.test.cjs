'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { planDeviceEms, getDeviceEmsReferences } = require('../src/lib/eosDeviceEmsPlan');
const { EosDeviceEmsService, projectDeviceEmsConfig } = require('../src/lib/eosDeviceEmsService');

const requestId = '12b3b927-0326-414c-a8be-12a576e44ae4';
const bus = 'a'.repeat(64);
function device(id, role, extra = {}) {
    const baseId = `eos-admin.0.devices.${id}`;
    const row = {baseId, devId:id, name:`MIRA ${id}`, deviceClass:'heat', templateId:`heat.ovum.mira.${role}`,
        protocol:'modbusTcp', miraBus:bus, miraUnit:role === 'hsm' ? 110 : 111, enabled:true, ems:{mode:'auto'}, aliasMeta:{}, ...extra};
    const add = (key, unit, target, write = false) => {
        row.aliasMeta[key] = {id:`${baseId}.aliases.v1.${key}`, type:'number', unit, read:true, write, targetId:`${baseId}.${target}`};
    };
    if (role === 'wpm') add('r.power','W','measurement.electricalPowerW');
    else {
        add('ctrl.pvStatus','','control.pvStatus',true);
        add('r.pvStatus','','control.pvStatus');
        add('ctrl.pvPowerTargetW','W','control.pvPowerTargetW',true);
        add('r.pvPowerTargetW','W','control.pvPowerTargetW');
    }
    return row;
}
const hsm = device('hydro','hsm'), meter = device('meter','wpm');
const commissioned = {...hsm, ems:{mode:'auto',activation:{requested:true,requestId,limits:{maxPowerW:4500,miraSources:'confirmed'}}}};
const baseConfig = {datapoints:{gridPointPower:'meter.grid'}};
function plan(devices, config = baseConfig, more = {}) {
    return planDeviceEms({config,devices,allowedApps:['thermal'],referenceMeta:{'meter.grid':{type:'number',unit:'W',read:true}},...more});
}

test('commissioning both units maps one measured electrical flow and a prepared, inactive PV controller', () => {
    const r = plan([hsm,meter]);
    assert.equal(r.config.datapoints.consumer1Power, meter.aliasMeta['r.power'].id);
    assert.equal(r.config.datapoints.consumer2Power, undefined);
    assert.equal(r.config.settings.flowPowerDpIsW.consumer1Power, true);
    assert.equal(r.config.vis.flowSlots.consumers[0].consumerType, 'heatPump');
    const row = r.config.thermal.devices[0];
    assert.equal(row.slot,1);
    assert.equal(row.enabled,false);
    assert.equal(row.miraPvStatusId,hsm.aliasMeta['ctrl.pvStatus'].id);
    assert.equal(row.miraPvStatusReadId,hsm.aliasMeta['r.pvStatus'].id);
    assert.equal(row.miraPowerTargetId,hsm.aliasMeta['ctrl.pvPowerTargetW'].id);
    assert.equal(row.miraPowerTargetReadId,hsm.aliasMeta['r.pvPowerTargetW'].id);
    assert.equal(r.config.emsApps,undefined);
    assert.equal(plan([meter,hsm],r.config).changed,false);
    const refs=getDeviceEmsReferences(r.config);
    assert.ok(refs.read.includes(row.miraPvStatusReadId) && refs.write.includes(row.miraPvStatusId));
});

test('one explicit HSM confirmation activates the licensed thermal app, respecting later app/row disable and changed sources', () => {
    const r=plan([commissioned,meter]); const c=r.config;
    assert.equal(c.thermal.devices[0].enabled,true);
    assert.equal(c.thermal.devices[0].miraSourcesConfirmed,true);
    assert.equal(c.thermal.devices[0].maxPowerW,4500);
    assert.equal(c.eosDeviceEms.bindings[hsm.baseId].miraCommissionedMaxW,4500);
    assert.equal(c.emsApps.apps.thermal.enabled,true);
    assert.equal(plan([commissioned,meter],c).changed,false);
    const disabled=structuredClone(c); disabled.thermal.devices[0].enabled=false;
    assert.equal(plan([commissioned,meter],disabled).config.thermal.devices[0].enabled,false);
    const changed={...commissioned, ems: structuredClone(commissioned.ems)};
    changed.ems.activation.limits.maxPowerW=8000;
    assert.equal(plan([changed,meter],c).config.thermal.devices[0].enabled,false);
});

test('license, grid, confirmed source and electrical limit are individually enforced before enabling the writer', () => {
    for (const scenario of ['license','grid','miraSources','maxPowerW']) {
        const dev=structuredClone(commissioned);
        if (['miraSources','maxPowerW'].includes(scenario)) delete dev.ems.activation.limits[scenario];
        const r=plan([dev,meter],baseConfig, scenario==='license'?{allowedApps:[]}:scenario==='grid'?{referenceMeta:{}}:{});
        assert.equal(r.config.thermal.devices[0].enabled,false,scenario);
        assert.equal(r.config.emsApps?.apps?.thermal?.enabled,undefined);
        assert.equal(r.statuses.find(s=>s.devId===hsm.devId).code,'ACTIVATION_PENDING');
    }
});

test('different buses, ambiguous cascades and removed pumps cannot retain or create an HSM writer', () => {
    assert.equal(plan([hsm]).config.thermal,undefined);
    const r=plan([commissioned,meter]);
    const meter2=device('other','wpm',{miraUnit:112});
    const casc=plan([commissioned,meter,meter2],r.config);
    assert.equal(casc.config.thermal.devices[0].enabled,false);
    assert.ok(casc.config.datapoints.consumer2Power);
    assert.equal(casc.config.thermal.devices.length,1);
    assert.equal(plan([commissioned,meter],casc.config).config.thermal.devices[0].enabled,false);
    const missing=plan([commissioned],r.config);
    assert.equal(missing.config.thermal.devices[0].enabled,false);
    assert.equal(missing.config.datapoints.consumer1Power,'');
    const restored=plan([commissioned,meter],missing.config);
    assert.equal(restored.config.datapoints.consumer1Power,meter.aliasMeta['r.power'].id);
    assert.equal(restored.config.thermal.devices[0].enabled,false);
    assert.equal(plan([commissioned,{...meter,miraBus:'b'.repeat(64)}]).config.thermal,undefined);
    assert.equal(plan([commissioned, {...meter,miraBus:'b'.repeat(64)}],r.config).config.thermal.devices[0].enabled,false);
    assert.equal(plan([{...commissioned,miraWpmDeviceId:''},meter]).config.thermal,undefined);
    assert.equal(plan([{...commissioned,miraWpmDeviceId:'missing'},meter]).config.thermal,undefined);
});

test('deliberately selected separate RTU links are supported once and never shared by two managers', () => {
    const pair={...commissioned,protocol:'modbusRtu',miraWpmDeviceId:'meter'};
    const local={...meter,protocol:'modbusRtu',miraBus:'b'.repeat(64)};
    assert.equal(plan([pair,local]).config.thermal.devices[0].enabled,true);
    assert.equal(plan([{...pair,miraFraming:'1'.repeat(64)}, {...local,miraBus:bus,miraFraming:'2'.repeat(64)}]).config.thermal,undefined);
    const rival=device('rival','hsm',{protocol:'modbusRtu',miraBus:'c'.repeat(64),miraWpmDeviceId:'meter'});
    assert.equal(plan([pair,local,rival]).config.thermal,undefined);
});

test('manual slots and control targets survive, repeated discovery cannot reinsert a deleted mapping', () => {
    const c=structuredClone(baseConfig);
    c.datapoints.consumer1Power='manual.kW';
    c.vis={flowSlots:{consumers:[{name:'Küche'}, {name:'Kältekreis'}]}};
    c.thermal={devices:[{slot:3,enabled:false,type:'sgready',name:'manuell'}]};
    const r=plan([commissioned,meter],c);
    assert.equal(r.config.datapoints.consumer1Power,'manual.kW');
    assert.equal(r.config.datapoints.consumer4Power,meter.aliasMeta['r.power'].id);
    assert.deepEqual(r.config.thermal.devices[0],c.thermal.devices[0]);
    const edited=structuredClone(r.config); edited.datapoints.consumer4Power='';
    const replay=plan([commissioned,meter],edited);
    assert.equal(replay.config.datapoints.consumer4Power,'');
    assert.equal(replay.config.thermal.devices[1].enabled,false);
    const other={...baseConfig,thermal:{devices:[{slot:3,enabled:true,setpointId:hsm.aliasMeta['ctrl.pvPowerTargetW'].targetId}]}};
    assert.equal(plan([commissioned,meter],other).config.thermal.devices.length,1);
    const legacy=projectDeviceEmsConfig({...baseConfig, flowSlots:{consumers:[{powerId:'manual.preexisting'}]}});
    assert.equal(plan([hsm,meter],legacy).config.thermal.devices[0].slot,2);
    assert.ok(getDeviceEmsReferences(legacy).read.includes('manual.preexisting'));
    const full=structuredClone(baseConfig); for(let idx=1;idx<=10;idx++) full.datapoints[`consumer${idx}Power`]=`other.${idx}`;
    assert.equal(plan([hsm,meter],full).statuses.find(s=>s.devId==='meter').code,'MIRA_FLOW_FULL');
    delete full.datapoints.consumer10Power;
    assert.equal(plan([hsm,meter],full).config.thermal.devices[0].slot,10);
});

test('restart inventory transports protocol+unit grouping without hostnames or login values',async () => {
    const devices=[{id:'hydro',templateId:hsm.templateId,protocol:'modbusTcp',connection:{host:'Heating.local',unitId:110,miraWpmDeviceId:'meter',login:'not-shared'}},
        {id:'meter',templateId:meter.templateId,protocol:'modbusTcp',connection:{host:'heating.local',port:502,unitId:111}}];
    const snap={namespace:'eos-admin.0',devices,moduleEnabled:true,ready:true,generation:1};
    const service=new EosDeviceEmsService({owner:{getForeignStateAsync:async()=>null,getForeignObjectsAsync:async()=>({})},getSnapshot:()=>snap,canRun:()=>true,apply:async()=>{}});
    const inv=await service.inventory(snap);
    assert.match(inv[0].miraBus,/^[a-f0-9]{64}$/); assert.equal(inv[0].miraBus,inv[1].miraBus);
    assert.equal(inv[0].miraWpmDeviceId,'meter'); assert.equal(inv[1].miraUnit,111);
    assert.doesNotMatch(JSON.stringify(inv),/heating.local|not-shared/i);
    await service.stop();
});
