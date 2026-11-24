'use strict';
const path=require('node:path');
const root='/workspace/scratch/741f792566ea/source-920/iobroker.eos-admin';
const {createRequire}=require('node:module');const requireRoot=createRequire(path.join(root,'package.json'));
const {parseInfluxCsv,influxLineProtocol}=requireRoot('tsx/cjs/api').require(path.join(root,'ui/src-ts/runtime-executables/lib/influx-direct.ts'),__filename);
const cases={badTime:'#datatype,string,long,dateTime:RFC3339,double\n,result,table,_time,_value\n,,0,1,23\n',unknownType:'#datatype,string,long,dateTime:RFC3339,evil\n,result,table,_time,_value\n,,0,2026-11-24T18:00:00Z,23\n',emptyString:'#datatype,string,long,dateTime:RFC3339,string\n,result,table,_time,_value\n,,0,2026-11-24T18:00:00Z,""\n',unsafeInt:'#datatype,string,long,dateTime:RFC3339,unsignedLong\n,result,table,_time,_value\n,,0,2026-11-24T18:00:00Z,9007199254740993\n',duplicateTime:'#datatype,string,long,dateTime:RFC3339,dateTime:RFC3339,double\n,result,table,_time,_time,_value\n,,0,2026-11-24T18:00:00Z,2026-11-25T18:00:00Z,23\n'};
const result={node:process.version,parser:{}};for(const [name,csv]of Object.entries(cases)){try{result.parser[name]={value:parseInfluxCsv(csv)}}catch(e){result.parser[name]={error:e.message}}}
for(const [name,point]of Object.entries({emptyStringWrite:{id:'test',val:'',ts:1},commentMeasurement:{id:'#comment',val:23,ts:1}})){try{result[name]={value:influxLineProtocol([point])}}catch(e){result[name]={error:e.message}}}
console.log(JSON.stringify(result,null,2));
