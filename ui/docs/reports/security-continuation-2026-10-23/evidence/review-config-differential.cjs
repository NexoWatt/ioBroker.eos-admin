// Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'../work/NexoWatt_UI_1.0.30');
function compiled(code, filename){const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(code,filename);return m.exports;}
function fixture(kind){const filename=root+'/test/'+kind+'-config-api.test.cjs';const code=fs.readFileSync(filename,'utf8');return compiled(code.slice(0,code.indexOf("test('"))+`\nmodule.exports={adapter,config:${kind==='nvp'?'topology':'config'}};`,filename);}
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
async function outcome(fn){try{return {result:clone(await fn())};}catch(e){return {error:e.code||e.message,status:e.status||0};}}
(async()=>{
 let cases=0;
 for(const kind of ['nvp','dynamic-grid']){
  const filename=root+'/lib/'+kind+'-config-api.js';const old=compiled(fs.readFileSync(__dirname+'/config-review-baseline/'+kind+'-config-api.ts.old.js','utf8'),filename);const current=require(filename);const f=fixture(kind);
  const standard=f.config();const variants=[undefined,null,false,[],{},standard,{...standard,configVersion:'1'},{...standard,configVersion:0},{...standard,configVersion:Number.MAX_SAFE_INTEGER},{...standard,points:[]},{...standard,storages:[]},{...standard,pvAssignments:[{id:'missing'}]},{...standard,points:[null]},{...standard,mode:'static'},{...standard,operation:'active'}];
  for(const raw of variants){const a=f.adapter(),b=f.adapter();const name=kind==='nvp'?'validateNvpCandidate':'validateDynamicGridCandidate';const before=await outcome(()=>old[name](a,clone(raw)));const after=await outcome(()=>current[name](b,clone(raw)));assert.deepEqual(after,before,kind+' validation case '+cases);cases++;}
  for(const version of [undefined,null,'1',0,1,2,Number.MAX_SAFE_INTEGER]){
   const a=f.adapter(),b=f.adapter();const name=kind==='nvp'?'prepareNvpChange':'prepareDynamicGridChange';const before=await outcome(()=>old[name](a,clone(standard),version));const after=await outcome(()=>current[name](b,clone(standard),version));assert.deepEqual(after,before,kind+' CAS case '+cases);cases++;
  }
 }
 console.log(JSON.stringify({review:'independent generated-runtime comparison to ZIP 1.0.29',cases,changedUnexpectedResults:0,hardware:false},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
