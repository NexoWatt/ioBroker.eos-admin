// Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'../work/NexoWatt_UI_1.0.30'),ts=require(root+'/node_modules/typescript');
const filename=root+'/ems/services/tariff-provider-registry.js';
const original=new Module(filename,module);original.filename=filename;original.paths=Module._nodeModulePaths(path.dirname(filename));
original._compile(ts.transpileModule(fs.readFileSync(__dirname+'/entsoe-review-baseline.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const before=original.exports.normalizeEntsoe,after=require(filename).normalizeEntsoe;
let comparisons=0;
for(const periodCount of [1,2,4])for(const minutes of [15,30,60])for(const formula of [{},{fixedCt:1,vatPercent:19}]){
 let content='';
 for(let day=0;day<periodCount;day++){
  const start=new Date(Date.UTC(2026,9,23+day));const points=Array.from({length:24*60/minutes},(_,i)=>`<Point><position>${i+1}</position><price.amount>${(i-20)*12.5}</price.amount></Point>`).join('');
  content+=`<Period><timeInterval><start>${start.toISOString()}</start></timeInterval><resolution>PT${minutes}M</resolution>${points}</Period>`;
 }
 const xml=`<Publication_MarketDocument><TimeSeries><currency_Unit.name>EUR</currency_Unit.name><price_Measure_Unit.name>MWH</price_Measure_Unit.name>${content}</TimeSeries></Publication_MarketDocument>`;
 assert.deepEqual(after(xml,{formula}),before(xml,{formula}));comparisons++;
}
const blocks='<Period>'.repeat(70000),start=performance.now();assert.throws(()=>after('<TimeSeries>'+blocks));const malformedMs=performance.now()-start;assert(malformedMs<1000);
console.log(JSON.stringify({review:'independent actual generated ENTSOe runtime vs original1.0.29',validMultiPeriodComparisons:comparisons,intervalsPerPeriod:[96,48,24],periods:[1,2,4],negativePrices:true,unchangedResults:true,malformedBytes:Buffer.byteLength(blocks),malformedMs,network:false},null,2));
