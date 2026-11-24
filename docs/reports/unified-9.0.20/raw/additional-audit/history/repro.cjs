'use strict';
const fs=require('node:fs'); const vm=require('node:vm'); const assert=require('node:assert/strict');
const root='/workspace/scratch/741f792566ea/source-919/iobroker.eos-admin';
const ts=require(root+'/node_modules/typescript');
const {numericMeasurement}=require(root+'/ui/lib/installer-lifecycle');
const source=fs.readFileSync(root+'/ui/src-ts/runtime-executables/main.ts','utf8');
const parsed=ts.createSourceFile('main.ts',source,ts.ScriptTarget.ES2022,true);
const wanted=new Set(['updateHistorieExportStates','_nwGetNumberFromCache','_nwGetNumberFromCacheFresh','_nwGetCacheAgeMs','_nwSetHistorieValue']); const methods=[];
const visit=n=>{if(ts.isMethodDeclaration(n)&&wanted.has(n.name?.getText(parsed)))methods.push(n.getText(parsed));ts.forEachChild(n,visit)};visit(parsed);assert.equal(methods.length,wanted.size);
const now=1795543200000;
const ctx=vm.createContext({numericMeasurement,Date:class extends Date {static now(){return now;}}});
const Holder=vm.runInContext('class ActualMethods {\n'+methods.join('\n')+'\n}; ActualMethods;',ctx);
function fixture(values={},opts={}){
 const a=new Holder(); a.stateCache=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{value:v,ts:now}])); a.config={datapoints:{},peakShaving:{atypical:{review:{influxLogEnabled:false}}},...opts.config};a.writes={};
 a.setLocalStateWithCache=(key,value,stamp)=>{a.writes[key]={value,stamp}};
 a._nwResolveGridImportExportFromCache=()=>({gridBuyW:1000,gridSellW:0,...opts.grid});
 a._nwResolveBatteryFlowFromCache=()=>({chargeW:0,dischargeW:0,...opts.battery});
 a._nwGetStorageControlAuthority=()=>({selectedTopology:opts.topology||'none'});
 a._nwResolveStorageFarmMetricsFromCache=()=>opts.farm||null;
 a._nwMergeStorageFarmPvWithBase=(base)=>({totalW:base+3000});
 return a;
}
async function run(name,values,opts={}){const a=fixture(values,opts);await a.updateHistorieExportStates();console.log(JSON.stringify({name,writes:a.writes}));return a;}
(async()=>{
 let a=await run('missing-derived ignores valid PV=5000/load=6000', {pvPower:5000,consumptionTotal:6000,'settings.price':.25});
 assert.equal(a.writes['historie.core.pv.totalW'].value,0); assert.equal(a.writes['historie.core.building.loadTotalW'].value,0);
 a=await run('derived PV=5000 already includes DC=3000, counted again', {'derived.core.pv.totalW':5000,'derived.core.building.loadTotalW':6000,'speicher.dcPvPowerW':3000}, {topology:'single',config:{datapoints:{},storage:{coupling:'dc'},peakShaving:{atypical:{review:{influxLogEnabled:false}}}}});
 assert.equal(a.writes['historie.core.pv.totalW'].value,8000);
 a=await run('missing provider price becomes zero instead of unavailable',{'settings.dynamicTariff':true,'settings.price':.35,'tarif.preisAktuellEurProKwh':null,'tarif.currentPriceFresh':false});
 assert.equal(a.writes['historie.tariff.totalEurPerKwh'].value,0);assert.equal(a.writes['historie.tariff.providerCurrentEurPerKwh'].value,0);
 a=await run('known stale provider still recorded',{ 'settings.dynamicTariff':true,'settings.price':.35,'tarif.preisAktuellEurProKwh':.89,'tarif.currentPriceFresh':false});
 assert.equal(a.writes['historie.tariff.totalEurPerKwh'].value,.89);
 a=await run('missing farmSoC becomes zero',{}, {topology:'farm',farm:{active:true,soc:null}});
 assert.equal(a.writes['historie.core.storage.socPct'].value,0);
 a=await run('missing grid/battery readings become valid zeros',{}, {grid:{gridBuyW:null,gridSellW:null},battery:{chargeW:null,dischargeW:null}});
 assert.equal(a.writes['historie.core.grid.netW'].value,0);assert.equal(a.writes['historie.core.storage.chargeW'].value,0);
 a=fixture();a._nwSetHistorieValue('test.null',null,now);assert.equal(a.writes['test.null'].value,0);console.log(JSON.stringify({name:'sink coerces null',writes:a.writes}));
 console.log('CONFIRMED 7 issue scenarios with actual shipped method bodies, simulated cache/sink context. No source changes.');
})().catch(e=>{console.error(e);process.exitCode=1});
