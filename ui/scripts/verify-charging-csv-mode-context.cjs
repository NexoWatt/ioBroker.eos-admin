/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const root = path.resolve(__dirname,'..');
const canonical = process.argv.includes('--canonical');
const file = path.join(root,canonical ? 'src-ts/runtime-executables/www/charging-diagnostics-appcenter.ts' : 'www/charging-diagnostics-appcenter.js');
let source=fs.readFileSync(file,'utf8');
if(canonical) source=Module.stripTypeScriptTypes(source);
const start=source.indexOf('const csvValue =');
const end=source.indexOf('async function clearEvents',start);
assert(start>=0&&end>start,'actual export functions must be found');
function exportRows(events) {
  let result;
  vm.runInNewContext(source.slice(start,end)+'\nexportCsv();',{payload:{audit:{events}},download:(name,content,type)=>{result={name,content,type};}});
  return result;
}
function parse(line) {
  const out=[]; let value='',quoted=false;
  for(let i=0;i<line.length;i++) {
    const c=line[i];
    if(c==='"') {if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
    else if(c===';'&&!quoted){out.push(value);value='';}else value+=c;
  }
  out.push(value); return out;
}
const event={ts:1700000000000,type:'wallbox',safe:'lp1',name:'Test; "Wallbox"',mode:'pv',userMode:'auto',connected:true,vehicleDemandConfirmed:false,vehicleDemandReason:'paused',statusEffective:'SuspendedEV',targetCurrentA:15.9};
const result=exportRows([event]);
const lines=result.content.replace(/^\uFEFF/,'').split('\r\n');
const header=parse(lines[0]),row=parse(lines[1]);
assert.equal(header.length,22);assert.equal(row.length,header.length);
assert.equal(header[4],'Modus');assert.equal(row[4],'pv');assert.equal(row[17],'auto');
assert.equal(row[3],event.name);assert.equal(row[8],'15.9');
assert.deepEqual(row.slice(18),['true','false','paused','SuspendedEV']);
const old=parse(exportRows([{mode:'pv'}]).content.split('\r\n')[1]);
assert.deepEqual(old.slice(17),['','','','',''],'old events must remain readable with empty new context');
console.log(JSON.stringify({passed:true,scope:'Actual CSV export functions in isolated VM; no full browser test',checks:9},null,2));
