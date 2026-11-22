/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'node_modules/typescript'));
const sourcePath = path.join(root, 'src-ts/runtime-executables/lib/iobroker-user-roles.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-role-independent-'));
const runtime = path.join(tmp, 'roles.cjs');
fs.writeFileSync(runtime, ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText);
const {createIoBrokerRolePolicy: policy, resolveIoBrokerRoleInfo: role} = require(runtime);
const group = (id, ...members) => ({_id:id,type:'group',common:{members}});
const admin='system.group.administrator', installer='system.group.installer', customer='system.group.user';
const adapter = objects => ({getForeignObjectAsync: async id => objects.get(id)});
const cases=[];
async function test(name, run) { await run(); cases.push({name,result:'PASS'}); }
(async () => {
  await test('arbitrary canonical usernames inherit actual mapped groups only',async()=>{
    for (const [id, expected] of [[admin,'admin'],[installer,'installer'],[customer,'customer']]) {
      const r=await role(adapter(new Map([[id,group(id,'system.user.Dominique.External')]])),'Dominique.External',policy());
      assert.equal(r.role,expected);assert.equal(r.user,'Dominique.External');
    }
  });
  await test('legacy user lists and protected-looking account names do not elevate',async()=>{
    const p=policy({adminUsers:'admin,dominique',installerUsers:'installer',customerUsers:'customer'},{installerUsers:'user'});
    for(const u of ['admin','installer','customer','user','dominique']) assert.equal((await role(adapter(new Map()),u,p)).role,'none');
  });
  await test('custom group full ID works while display name does not',async()=>{
    const id='system.group.partner.Technicians';const p=policy({installerGroups:id});
    assert.equal((await role(adapter(new Map([[id,group(id,'system.user.fachbetrieb')]])),'fachbetrieb',p)).role,'installer');
    assert.equal(policy({installerGroups:'Technicians'}).valid,false);
  });
  await test('membership uses exact canonical user ID and does not fold case or prefixes',async()=>{
    const a=adapter(new Map([[admin,group(admin,'system.user.alice')]]));
    assert.equal((await role(a,'Alice',policy())).role,'none');assert.equal((await role(a,'alice',policy())).role,'admin');
    assert.equal((await role(a,'alice ',policy())).role,'none');assert.equal((await role(a,'system.user.alice',policy())).role,'none');
  });
  await test('wrong object identity or type cannot supply membership',async()=>{
    for(const obj of [{...group(admin,'system.user.alice'),_id:customer},{...group(admin,'system.user.alice'),type:'state'}]) assert.equal((await role(adapter(new Map([[admin,obj]])),'alice',policy())).role,'none');
  });
  await test('disabled or removed group revokes role in subsequent lookup',async()=>{
    const obj=group(admin,'system.user.alice');const objects=new Map([[admin,obj]]);const a=adapter(objects);
    assert.equal((await role(a,'alice',policy())).role,'admin');obj.common.enabled=false;assert.equal((await role(a,'alice',policy())).role,'none');
    obj.common.enabled=true;obj.common.members=[];assert.equal((await role(a,'alice',policy())).role,'none');
    obj.common.members=['system.user.alice'];objects.delete(admin);assert.equal((await role(a,'alice',policy())).role,'none');
  });
  await test('multiple groups keep highest authorized role and finite capabilities',async()=>{
    const objects=new Map([[admin,group(admin,'system.user.alice')],[installer,group(installer,'system.user.alice')],[customer,group(customer,'system.user.alice')]]);
    const r=await role(adapter(objects),'alice',policy());assert.equal(r.role,'admin');assert.deepEqual(r.capabilities,['*']);
    objects.delete(admin);const i=await role(adapter(objects),'alice',policy());assert.equal(i.role,'installer');assert.equal(i.capabilities.includes('license.manage'),false);assert.equal(i.capabilities.includes('*'),false);
    objects.delete(installer);const c=await role(adapter(objects),'alice',policy());assert.equal(c.role,'customer');assert.equal(c.capabilities.includes('appcenter.open'),false);
  });
  await test('malformed mapped group fails closed even with valid administrator membership',async()=>{
    const objects=new Map([[admin,group(admin,'system.user.alice')],[customer,{_id:customer,type:'group',common:{members:'system.user.alice'}}]]);
    assert.equal((await role(adapter(objects),'alice',policy())).role,'none');
  });
  await test('nested groups, mixed member types and forged suffixes do not elevate',async()=>{
    for(const members of [['system.group.administrator'],['alice'],[true],['system.user.alice',1]]) {
      assert.equal((await role(adapter(new Map([[admin,group(admin,...members)]])),'alice',policy())).role,'none');
    }
  });
  await test('malformed or oversized mappings invalidate complete policy',async()=>{
    for(const v of [true,null,42,{},['system.group.user',42],Array(33).fill('system.group.extra'),'system.user.admin','system.group.']) assert.equal(policy({adminGroups:v}).valid,false);
    assert.equal(policy({adminGroups:'system.group.external'},[]).valid,false);
  });
  await test('read rejection gives no role and no partial administrator result',async()=>{
    const a={getForeignObjectAsync:async id=>{if(id===admin)return group(admin,'system.user.alice');throw new Error('synthetic');}};
    assert.equal((await role(a,'alice',policy())).role,'none');
  });
  await test('timeout ignores late rejection without further reads or unhandled rejection',async()=>{
    let reads=0;let rejectRead;const events=[];const listener=e=>events.push(e);process.on('unhandledRejection',listener);
    try{
      const a={getForeignObjectAsync:()=>{reads++;return new Promise((_resolve,reject)=>{rejectRead=reject;});}};
      assert.equal((await role(a,'alice',policy(),10)).role,'none');rejectRead(new Error('synthetic late failure'));
      await new Promise(resolve=>setTimeout(resolve,20));assert.equal(reads,1);assert.equal(events.length,0);
    }finally{process.off('unhandledRejection',listener);}
  });
  await test('policy and normalized lists cannot mutate after validation',async()=>{
    const p=policy();assert.equal(Object.isFrozen(p),true);assert.equal(Object.isFrozen(p.adminGroups),true);
    assert.throws(()=>p.adminGroups.push(customer),TypeError);assert.throws(()=>p.valid=false,TypeError);
  });
  await test('group resolver and existing header role capabilities stay identical',async()=>{
    const main=fs.readFileSync(path.join(root,'src-ts/runtime-executables/main.ts'),'utf8');
    const sf=ts.createSourceFile('main.ts',main,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);let caps;
    function walk(node){if(ts.isVariableDeclaration(node)&&node.name.getText(sf)==='ROLE_CAPABILITIES')caps=node.initializer;ts.forEachChild(node,walk);}walk(sf);
    assert(caps&&ts.isObjectLiteralExpression(caps));const expected={};
    for(const prop of caps.properties){assert(ts.isPropertyAssignment(prop));assert(ts.isArrayLiteralExpression(prop.initializer));expected[prop.name.getText(sf)]=prop.initializer.elements.map(item=>{assert(ts.isStringLiteral(item));return item.text;});}
    for(const [id, key] of [[admin,'admin'],[installer,'installer'],[customer,'customer']])assert.deepEqual((await role(adapter(new Map([[id,group(id,'system.user.alice')]])),'alice',policy())).capabilities,expected[key]);
  });
  const report={date:'2026-11-03',node:process.version,scope:'Independent synthetic group-policy review; no live Admin8/controller or hardware integration',source:'src-ts/runtime-executables/lib/iobroker-user-roles.ts',sha256:crypto.createHash('sha256').update(source).digest('hex'),passed:cases.length,cases};
  fs.writeFileSync(path.join(__dirname,'independent-group-review.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(()=>{fs.rmSync(tmp,{recursive:true,force:true});});
