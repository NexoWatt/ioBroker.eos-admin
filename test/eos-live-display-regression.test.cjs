/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), ts=require('typescript');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'ui/src-ts/runtime-executables/www/app.ts'),'utf8');
const ast=ts.createSourceFile('app.ts',app,ts.ScriptTarget.Latest,true);
const functions=new Map(ast.statements.filter(ts.isFunctionDeclaration).map(n=>[n.name.text,n.getText(ast)]));
const helper=ts.transpileModule(fs.readFileSync(path.join(root,'ui/src-ts/runtime-executables/www/live-display.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function fixture(){
 let now=Date.parse('2026-11-24T19:00:00Z');
 class Clock extends Date {static now(){return now}}
 const elements=new Map();
 const element=id=>{if(!elements.has(id)){const classes=new Set(id==='liveDot'?['live']:[]);elements.set(id,{textContent:'',style:{},classList:{toggle(k,on){if(on)classes.add(k);else classes.delete(k)},add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k)}})}return elements.get(id)};
 const ctx=vm.createContext({Date:Clock,console,state:{},window:{latestState:{},__nwCfg:{datapoints:{gridPointPower:'meter.power',batteryPower:'ess.power'},settings:{deviceStaleTimeoutSec:30}}},document:{getElementById:element},
  nwStorageFarmFeatureFromConfig:()=>false,getEvcsPowerW:()=>null,nwEvcsFeatureFromConfig:()=>false,flowExtras:{meta:{evcsAvailable:false}},updateEnergyWebExtras:()=>0,
  stabilizeFlowAbs:(_,n)=>n,stabilizeFlowSigned:(_,n)=>n,formatFlowPower:n=>`${n} W`,formatPower:n=>`${n} W`,
  setText:(id,v)=>element(id).textContent=v,nwApplyCustomerFeatureVisibility(){},nwLatestStateTimestamp:()=>now,nwFormatDashboardTimestamp:String,updateEmsControlUi(){}});
 vm.runInContext(helper,ctx);
 vm.runInContext(ts.transpileModule(fs.readFileSync(path.join(root,'ui/src-ts/runtime-executables/www/power-measurements.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,ctx);
 for(const name of ['coerceNumber','isMappedDatapoint','getGridImportExport','getStateAgeMs','getFlowFreshMaxAgeMs','getFreshFlowNumber','getEvcsPowerW','getStableFlowNumber','getConfiguredDatapointId','getBalanceDerivedBatteryFlow','getNormalizedBatteryFlow','getCanonicalPvPowerW','getLiveMeasurementView','computeDerived','updateEnergyWeb','updateDashboardShellUi','nwSetLiveOnline'])vm.runInContext(functions.get(name),ctx);
 function state(values){ctx.state=Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{value,ts:now}]));ctx.window.latestState=ctx.state;}
 return {ctx,element,state,now:()=>now,advance:ms=>now+=ms,flow(){ctx.updateEnergyWeb()},side(){ctx.updateDashboardShellUi({})},text:id=>element(id).textContent};
}
const valid={ 'derived.core.pv.totalW':5000,consumptionTotal:0,storageSoc:0,gridPointPower:-5000,batteryPower:0 };
test('actual flow keeps measured zero during export and never invents 100 W or indefinitely holds a previous load',()=>{
 const f=fixture();f.state({...valid,consumptionTotal:1200});f.flow();assert.equal(f.text('centerPower'),'1200 W');
 for(let i=0;i<40;i++){f.advance(10000);f.state(valid);f.flow();assert.equal(f.text('centerPower'),'0 W')}
 assert.equal(f.ctx.window.__nwLastGoodLoadDisplayTs,undefined);
});
test('actual flow differentiates null, missing, bool and zero SoC and does not suppress valid raw PV behind null derived PV',()=>{
 const f=fixture();for(const bad of [null,undefined,false,'',NaN]){f.state({...valid,storageSoc:bad});f.flow();assert.equal(f.text('batterySocIn'),'-- %')}
 f.state({...valid,'derived.core.pv.totalW':null,pvPower:3500});f.flow();assert.equal(f.text('pvVal'),'3500 W');assert.equal(f.text('batterySocIn'),'0 %');
});
test('stale, future, absent or offline measurements stay unknown in the same flow and sidebar; fresh unchanged zero recovers',()=>{
 const f=fixture();f.state(valid);f.advance(31000);f.flow();f.side();
 for(const id of ['pvVal','gridVal','restVal','centerPower','sidePvPower','sideBuildingPower','sideBatteryPower'])assert.equal(f.text(id),'--',id);
 f.state({...valid,'derived.core.pv.totalW':0,gridPointPower:0});f.flow();f.side();assert.equal(f.text('pvVal'),'0 W');assert.equal(f.text('sidePvPower'),'0 W');
 f.ctx.state['derived.core.pv.totalW'].ts=f.now()+6000;f.flow();assert.equal(f.text('pvVal'),'--');
 f.ctx.nwSetLiveOnline(false);assert.equal(f.text('centerPower'),'--');assert.equal(f.text('sideEms'),'Verbindung unterbrochen');
});
test('no measurement/engine data never claims active engine, stable grid or healthy system',()=>{
 const f=fixture();f.state({});f.side();assert.equal(f.text('sideEms'),'Status unbekannt');assert.equal(f.text('sideGridStatus'),'Messstatus unbekannt');assert.equal(f.text('sideStatusText'),'Betriebsstatus prüfen');
 f.state({...valid,'ems.core.schedulerAlive':true,'ems.core.schedulerHeartbeatAt':f.now(),'ems.gridMeasurementFresh':true});f.side();assert.equal(f.text('sideEms'),'Aktiv');assert.equal(f.text('sideGridStatus'),'Messung aktuell');
 f.advance(31000);f.side();assert.equal(f.text('sideEms'),'Status unbekannt');assert.equal(f.text('sideGridStatus'),'Messstatus unbekannt');
});
test('canonical NVP-invalid signal prevents a stale fallback from appearing as import/export or 100 percent self-sufficiency',()=>{
 const f=fixture();f.state({...valid,consumptionTotal:5000,gridPointPower:5000,'ems.gridMeasurementFresh':false});f.flow();assert.equal(f.text('gridVal'),'--');assert.equal(f.ctx.computeDerived().autarky,undefined);
});
test('farm flow uses complete atomic gross sums and arithmetic SoC; partial and stale overview do not revive old aggregate values',()=>{
 const f=fixture();f.ctx.nwStorageFarmFeatureFromConfig=()=>true;
 const overview={v:1,updatedAt:f.now(),members:{total:2,fresh:2},battery:{complete:true,total:2,valid:2,chargeW:2000,dischargeW:3000},soc:{complete:true,total:2,valid:2,meanPct:40}};
 f.state({...valid,'storageFarm.totalPowerW':1000,'storageFarm.totalSoc':75,'storageFarm.overviewJson':JSON.stringify(overview)});f.flow();assert.equal(f.text('batterySocIn'),'40 %');assert.equal(f.text('restVal'),'1000 W');
 overview.battery.complete=false;overview.battery.valid=1;overview.soc.complete=false;overview.soc.valid=1;
 f.state({...valid,'storageFarm.totalPowerW':1000,'storageFarm.totalSoc':75,'storageFarm.overviewJson':JSON.stringify(overview)});f.flow();assert.equal(f.text('restVal'),'--');assert.equal(f.text('batterySocIn'),'-- %');
 f.advance(31000);f.flow();assert.equal(f.text('restVal'),'--');
 f.state({'storageFarm.totalPvPowerW':0});f.flow();assert.equal(f.text('pvVal'),'0 W');
 f.state({'storageFarm.totalPvPowerW':null});f.flow();assert.equal(f.text('pvVal'),'--');
});
test('strict read rejects malformed values, absent timestamps and future samples but accepts newly confirmed constant zero',()=>{
 const f=fixture(),read=f.ctx.window.NexoWattLiveDisplay.read;
 for(const bad of [null,false,undefined,'',' ','12W','0x10','1e3','.','+','--1','1,2,3','1.2.3','9'.repeat(65),{},NaN,Infinity])assert.equal(read({x:{value:bad,ts:f.now()}},'x',f.now(),30000,true),null);
 for(const [raw,expected] of [['.5',.5],['1.',1],['+1,5',1.5],['-0.5',-.5],[' 0 ',0]])assert.equal(read({x:{value:raw,ts:f.now()}},'x',f.now(),30000,true),expected);
 assert.equal(read({x:{value:0}},'x',f.now(),30000,true),null);
 assert.equal(read({x:{value:0,ts:f.now(),lc:f.now()-999999}},'x',f.now(),30000,true),0);
 assert.equal(read({x:{value:2,ts:f.now()+6000}},'x',f.now(),30000,true),null);
});
test('both shipped entry pages load the strict live helper before the actual dashboard renderer',()=>{
 for(const name of ['index.html','settings.html']){const html=fs.readFileSync(path.join(root,'ui/www',name),'utf8');assert.ok(html.indexOf('/static/live-display.js')>0);assert.ok(html.indexOf('/static/live-display.js')<html.indexOf('<script src="/static/app.js">'))}
});
test('missing split-meter sides and missing NVP cannot manufacture a complete flow or a balance-derived battery',()=>{
 const f=fixture();f.ctx.window.__nwCfg.datapoints={gridBuyPower:'grid.buy',gridSellPower:'grid.sell',storageChargePower:'ess.charge',storageDischargePower:'ess.discharge'};
 f.state({gridBuyPower:500,storageChargePower:1000,consumptionTotal:2000,pvPower:0,storageSoc:50});
 f.flow();assert.equal(f.text('gridVal'),'--');assert.equal(f.text('restVal'),'--');
 f.ctx.window.__nwCfg.datapoints={gridPointPower:'grid.power',consumptionTotal:'meter.load'};
 f.state({consumptionTotal:2000,pvPower:0,storageSoc:50});
 assert.equal(f.ctx.getBalanceDerivedBatteryFlow(),null);f.flow();assert.equal(f.text('restVal'),'--');
 f.state({consumptionTotal:2000,pvPower:0,storageSoc:50,gridPointPower:1000,'ems.gridMeasurementFresh':false});
 assert.equal(f.ctx.getBalanceDerivedBatteryFlow(),null);
});
test('extra producer and consumer nodes never display command power or missing measurements as measured zero',()=>{
 const f=fixture();
 for(const name of ['isHeatingRodFlowItem','resolveHeatingRodFlowPower','updateEnergyWebExtras'])vm.runInContext(functions.get(name),f.ctx);
 f.ctx.flowExtras={meta:{evcsAvailable:false},producers:[{stateKey:'producer1Power',valId:'producerVal'}],consumers:[{idx:1,stateKey:'consumer1Power',valId:'consumerVal',consumerType:'heatingrod'}],special:[{role:'bhkw',valId:'specialVal',devices:[{idx:1},{idx:2}]}]};
 f.state({...valid,'heatingRod.devices.c1.targetW':5000,'heatingRod.devices.c1.appliedW':5000,'bhkw.devices.b1.powerW':1500});
 f.flow();for(const id of ['producerVal','consumerVal','specialVal','centerPower'])assert.equal(f.text(id),'--',id);
 f.state({...valid,producer1Power:0,consumer1Power:0,'bhkw.devices.b1.powerW':1500,'bhkw.devices.b2.powerW':0,'heatingRod.devices.c1.targetW':5000});
 f.flow();assert.equal(f.text('producerVal'),'0 W');assert.equal(f.text('consumerVal'),'0 W');assert.equal(f.text('specialVal'),'1500 W');assert.equal(f.text('centerPower'),'0 W');
 f.advance(31000);f.flow();for(const id of ['producerVal','consumerVal','specialVal'])assert.equal(f.text(id),'--',id);
});
test('visible dashboard ages measurements even without a new SSE event; hidden and non-dashboard pages do not rerender',()=>{
 const f=fixture();vm.runInContext(functions.get('refreshLiveMeasurementAge'),f.ctx);let calls=0;f.ctx.scheduleLiveTelemetryRender=()=>calls++;
 f.ctx.document.visibilityState='visible';f.ctx.refreshLiveMeasurementAge();assert.equal(calls,1);
 f.ctx.document.visibilityState='hidden';f.ctx.refreshLiveMeasurementAge();assert.equal(calls,1);
 f.ctx.document.visibilityState='visible';f.ctx.document.getElementById=()=>null;f.ctx.refreshLiveMeasurementAge();assert.equal(calls,1);
});

test('real flow does not suppress 80 W or retain separately smoothed previous powers',()=>{
 const f=fixture();
 f.ctx.stabilizeFlowAbs=()=>{throw Error('numeric display must not smooth independently')};
 f.ctx.stabilizeFlowSigned=f.ctx.stabilizeFlowAbs;
 f.state({...valid,'derived.core.pv.totalW':80,consumptionTotal:80,gridPointPower:0});f.flow();
 assert.equal(f.text('centerPower'),'80 W');assert.equal(f.text('pvVal'),'80 W');
 f.state({...valid,'derived.core.pv.totalW':0,consumptionTotal:0,gridPointPower:0});f.flow();
 assert.equal(f.text('centerPower'),'0 W');assert.equal(f.text('pvVal'),'0 W');
});
test('EV freshness, offline, bad-quality and future timestamp use the same measured-data contract as the rest of the flow',()=>{
 const f=fixture();f.ctx.nwEvcsFeatureFromConfig=()=>true;f.ctx.flowExtras.meta.evcsAvailable=true;
 f.state({...valid,consumptionTotal:13000,'evcs.totalPowerW':10700,gridPointPower:3800,'derived.core.pv.totalW':2500,batteryPower:2800});f.flow();
 assert.equal(f.text('centerPower'),'2300 W');assert.match(f.text('energyFlowQuality'),/Bilanzabweichung 3900 W/);
 f.ctx.state['evcs.totalPowerW'].ts=f.now()-31000;f.flow();assert.equal(f.text('c2Val'),'--');assert.equal(f.text('centerPower'),'--');
 f.ctx.state['evcs.totalPowerW'].ts=f.now();f.ctx.state['evcs.totalPowerW'].q=64;f.flow();assert.equal(f.text('c2Val'),'--');
 delete f.ctx.state['evcs.totalPowerW'].q;f.ctx.state['evcs.totalPowerW'].ts=f.now()+6000;f.flow();assert.equal(f.text('c2Val'),'--');
 f.ctx.state['evcs.totalPowerW'].ts=f.now();f.ctx.window.__nwTariffLiveOnline=false;f.flow();assert.equal(f.text('c2Val'),'--');
});
test('consumer greater than total is reported as inconsistent, and fresh balance can recover stale total without fabricating zero',()=>{
 const f=fixture();f.ctx.nwEvcsFeatureFromConfig=()=>true;f.ctx.flowExtras.meta.evcsAvailable=true;
 f.state({...valid,consumptionTotal:3000,'evcs.totalPowerW':10000});f.flow();assert.equal(f.text('centerPower'),'--');assert.match(f.text('energyFlowQuality'),/Teilverbrauch größer/);
 f.state({...valid,consumptionTotal:null,'derived.core.building.loadTotalW':12000,'evcs.totalPowerW':10000});f.flow();assert.equal(f.text('centerPower'),'2000 W');
 f.ctx.state['derived.core.building.loadTotalW'].ts=f.now()-31000;f.flow();assert.equal(f.text('centerPower'),'--');
});
test('signed split flows retain conservation for simultaneous import/export and battery charge/discharge',()=>{
 const f=fixture();f.ctx.window.__nwCfg.datapoints={gridBuyPower:'grid.buy',gridSellPower:'grid.sell',storageChargePower:'bat.charge',storageDischargePower:'bat.discharge'};
 f.state({...valid,'derived.core.pv.totalW':0,consumptionTotal:2500,gridBuyPower:5000,gridSellPower:1500,storageChargePower:3000,storageDischargePower:2000});f.flow();
 assert.equal(f.text('gridVal'),'3500 W');assert.equal(f.text('restVal'),'-1000 W');assert.equal(f.text('centerPower'),'2500 W');
});

test('second field screenshot rejects impossible negative building remainder instead of clamping it to 0 W',()=>{
 const f=fixture();f.ctx.nwEvcsFeatureFromConfig=()=>true;f.ctx.flowExtras.meta.evcsAvailable=true;
 f.state({...valid,'derived.core.pv.totalW':2100,consumptionTotal:4400,gridPointPower:4500,batteryPower:-2200,'evcs.totalPowerW':5700,storageSoc:92});f.flow();
 assert.equal(f.text('pvVal'),'2100 W');assert.equal(f.text('gridVal'),'4500 W');assert.equal(f.text('restVal'),'-2200 W');
 assert.equal(f.text('c2Val'),'5700 W');assert.equal(f.text('centerPower'),'--');assert.match(f.text('energyFlowQuality'),/Teilverbrauch größer/);
});

test('negative load and out-of-range state of charge cannot masquerade as measured zero or valid percent',()=>{
 const f=fixture();f.state({...valid,consumptionTotal:-500,storageSoc:101});f.flow();f.side();
 assert.equal(f.text('centerPower'),'--');assert.equal(f.text('sideBuildingPower'),'--');assert.equal(f.text('batterySocIn'),'-- %');
 f.state({...valid,storageSoc:-1});f.flow();assert.equal(f.text('batterySocIn'),'-- %');
});

test('backend deduplicated extra production is authoritative and invalid published totals cannot be revived by browser sums',()=>{
 const f=fixture();f.ctx.flowExtras.producers=[{stateKey:'producer1Power'}];f.ctx.window.__nwFlowExtraProductionW=5000;
 f.state({...valid,'derived.core.pv.totalW':5000,consumptionTotal:5000,gridPointPower:0,'derived.core.production.extraW':0});f.flow();assert.equal(f.text('energyFlowQuality'),'');
 f.ctx.state['derived.core.production.extraW'].value=null;f.flow();assert.match(f.text('energyFlowQuality'),/unvollständig/);
});
