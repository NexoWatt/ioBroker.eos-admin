'use strict';
const fs=require('node:fs'), vm=require('node:vm'), path=require('node:path');
const root='/workspace/scratch/741f792566ea/source-919/iobroker.eos-admin';
const ts=require(path.join(root,'node_modules/typescript'));
const source=fs.readFileSync(path.join(root,'ui/www/app.js'),'utf8');
const ast=ts.createSourceFile('app.js',source,ts.ScriptTarget.Latest,true);
const functions=new Map(ast.statements.filter(ts.isFunctionDeclaration).map(n=>[n.name.text,n.getText(ast)]));
let now=Date.parse('2026-11-24T19:00:00Z');
class Clock extends Date{static now(){return now}}
const elements=new Map();
const element=id=>{ if(!elements.has(id))elements.set(id,{textContent:'',style:{},classList:{toggle(){},add(){},remove(){},contains(){return true}}});return elements.get(id); };
const ctx=vm.createContext({Date:Clock,console,state:{},window:{latestState:{},__nwCfg:{}},document:{getElementById:element},
 nwStorageFarmFeatureFromConfig:()=>false,getEvcsPowerW:()=>null,getNormalizedBatteryFlow:()=>({chargeW:0,dischargeW:0}),nwEvcsFeatureFromConfig:()=>false,flowExtras:{meta:{evcsAvailable:false}},updateEnergyWebExtras:()=>0,
 stabilizeFlowAbs:(_,n)=>n,stabilizeFlowSigned:(_,n)=>n,formatFlowPower:n=>`${n} W`,isMappedDatapoint:k=>k==='gridPointPower',
 setText:(id,v)=>element(id).textContent=v,nwApplyCustomerFeatureVisibility(){},nwLatestStateTimestamp:()=>now,nwFormatDashboardTimestamp:String,updateEmsControlUi(){}});
for(const name of ['coerceNumber','getGridImportExport','getCanonicalPvPowerW','updateEnergyWeb','updateDashboardShellUi','nwSetLiveOnline'])vm.runInContext(functions.get(name),ctx);
function render(v){ctx.state=v;ctx.window.latestState=v;ctx.updateEnergyWeb();return Object.fromEntries(['pvVal','gridVal','restVal','centerPower','batterySocIn'].map(id=>[id,element(id).textContent]));}
const base={'derived.core.pv.totalW':{value:5000,ts:now},consumptionTotal:{value:0,ts:now},storageSoc:{value:null,ts:now},gridPointPower:{value:-5000,ts:now}};
console.log('CASE zero building while exporting, null SoC',render(base));
const baseline={'derived.core.pv.totalW':{value:5000,ts:now},consumptionTotal:{value:1200,ts:now},gridPointPower:{value:-3800,ts:now}};
console.log('CASE true 1200W before zero',render(baseline));
for(let i=0;i<40;i++){now+=10000;render(base)}
console.log('CASE after 400s of repeated true zero',render(base),'held timestamp age=',now-ctx.window.__nwLastGoodLoadDisplayTs);
console.log('CASE null derived PV, valid raw PV',render({'derived.core.pv.totalW':{value:null,ts:now},pvPower:{value:5000,ts:now}}));
ctx.state={};ctx.window.latestState={};ctx.updateDashboardShellUi({});
console.log('CASE no engine/no measurements sidebar',Object.fromEntries(['sideEms','sideGridStatus','sideStatusText','sidePvPower','sideBuildingPower','sideBatteryPower'].map(id=>[id,element(id).textContent])));
