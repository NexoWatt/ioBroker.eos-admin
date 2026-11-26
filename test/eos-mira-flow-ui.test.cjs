'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '../ui');
function functions(file, names) {
    const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const result = new Map();
    function visit(node) {
        if ((ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) && names.includes(node.name?.getText(source))) {
            const name = node.name.getText(source);
            const body = ts.isFunctionDeclaration(node) ? node.getText(source) : 'const ' + name + ' = ' + node.initializer.getText(source) + ';';
            result.set(name, body);
        }
        ts.forEachChild(node, visit);
    }
    visit(source);
    return names.map(name => { assert.ok(result.has(name), name); return result.get(name); }).join('\n');
}
const row = {
    slot: 10, enabled: true, ovumMira: true, miraSourcesConfirmed: true, miraTopologyId: 'c'.repeat(64),
    type: 'power', maxPowerW: 3500, miraPvStatusId: 'hsm.aliases.v1.ctrl.pvStatus',
    miraPvStatusReadId: 'hsm.aliases.v1.r.pvStatus', miraPowerTargetId: 'hsm.aliases.v1.ctrl.pvPowerTargetW',
    miraPowerTargetReadId: 'hsm.aliases.v1.r.pvPowerTargetW', _eosDevice: {v:1, baseId:'wpm'},
};
const slot = {consumerType:'heatPump', name:'MIRA', _eosDevice:{v:1,baseId:'wpm'}};
test('opening and saving the App Center retains both MIRA channels, commissioning and flow ownership, including slot ten', () => {
    const names = ['_ensureThermalCfg','_ensureFlowSlots','_normalizeFlowConsumerType','_thermalDefaultSetpoints','_clampInt'];
    const cfg = {thermal:{devices:[{ ...row }]},vis:{flowSlots:{consumers:Array(9).fill(null).concat(slot)}}};
    const ctx = vm.createContext({currentConfig:cfg,_ensureVis:()=>cfg.vis,FLOW_CONSUMER_SLOT_COUNT:10,FLOW_PRODUCER_SLOT_COUNT:5});
    vm.runInContext(functions('www/ems-apps.js', names),ctx);
    for (let i=0;i<2;i++) {
        const saved=ctx._ensureThermalCfg().devices[9];
        for (const k of Object.keys(row)) assert.deepEqual(saved[k],row[k],k);
        assert.deepEqual(ctx._ensureFlowSlots().consumers[9]._eosDevice,slot._eosDevice);
    }
    cfg.thermal.devices[9].maxPowerW=0;
    assert.equal(ctx._ensureThermalCfg().devices[9].maxPowerW,0);
});
test('MIRA can open EMS quick controls without exposing switch, SG Ready or direct power writes', () => {
    const cfg={enableThermalControl:true,thermal:{devices:[{...row}]}};
    const slots=Array(9).fill({}).concat({...slot,ctrl:{}});
    const ctx=vm.createContext({cfg,slots});
    vm.runInContext(functions('main.js',['miraFlowControlReady','pickQuick'])+'\nthis.meta=()=>pickQuick(slots,10,"consumers")',ctx);
    let m=ctx.meta();
    assert.equal(m.enabled,true); assert.equal(m.ovumMira,true); assert.equal(m.controlKind,'thermal');
    assert.equal(m.hasSetpoint,false); assert.equal(m.hasSwitch,false);
    cfg.thermal.devices[0].boostEnabled=false;
    assert.equal(ctx.meta().enabled,true); assert.equal(ctx.meta().hasBoost,false);
    for (const invalid of [{miraSourcesConfirmed:false},{miraPowerTargetReadId:''},{maxPowerW:0},{enabled:false}]) {
        cfg.thermal.devices[0]={...row,...invalid};
        slots[9].ctrl = {switchWriteId:'legacy.bad',setpointWriteId:'legacy.bad'};
        m=ctx.meta();
        assert.deepEqual([m.enabled,m.hasSwitch,m.hasSetpoint,m.hasBoost],[false,false,false,false]);
    }
});
test('MIRA readout distinguishes measured zero from unknown after disconnect in the quick control', () => {
    let measured=null;
    const ctx=vm.createContext({ctx:{kind:'consumer',idx:10,qc:{ovumMira:true,max:3500}},
        getEntry:()=>({stateKey:'consumer10Power'}),getSlotMeta:()=>({}),getFreshFlowNumber:k=>{assert.equal(k,'consumer10Power');return measured;}});
    vm.runInContext(functions('www/app.js',['resolveFlowPower'])+'\nthis.read=resolveFlowPower;',ctx);
    assert.equal(ctx.read().valueW,null);
    for(const w of [0,1770]){ measured=w; assert.equal(ctx.read().valueW,w); assert.equal(ctx.read().maxW,3500); }
});
