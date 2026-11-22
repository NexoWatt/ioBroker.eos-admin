#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: CRA-Nachbesserungen an echten Express-Auth-/Schreibschnittstellen prüfen.
 * Daten und Wirkung: Lokaler Port, künstliche ioBroker-Benutzer/States, keine Geräte.
 * Bei Änderungen: Positive und negative Rechte-/Widerrufsfälle gemeinsam erhalten;
 * vollständiger Testbeleg ist die Konsolenausgabe, keine Hardwarefreigabe.
 */
const assert = require('node:assert/strict');
const { createHarness } = require('./verify-stable-1.0.9-access.cjs');
const crypto = require('node:crypto');
let checks = 0;
async function test(name, callback) { await callback(); checks++; console.log('PASS ' + name); }
async function request(h, url, body, token, headers = {}) {
  return h.request(url, { method: body === undefined ? 'GET' : 'POST', body, token, headers, redirect: 'manual' });
}
async function main() {
  const h = await createHarness();
  try {
    const admin = await h.login('admin');
    const installer = await h.login('installer');
    const customer = await h.login('kunde');
    await test('anonyme Kundenschreibversuche benötigen Sitzung; Kunde bedient eigene Settings', async () => {
      assert.equal((await request(h, '/api/set', { scope: 'settings', key: 'price', value: 0.30 })).status, 401);
      assert.equal((await request(h, '/api/set', { scope: 'settings', key: 'price', value: 0.30 }, customer)).status, 200);
    });
    await test('unknown scope umgeht weder Peak-Shaving-Sperre noch Tarifzwang', async () => {
      const writes=[]; const original=h.adapter.setStateAsync.bind(h.adapter); h.adapter.setStateAsync=async (...args)=>{writes.push(args);return original(...args);};
      for (const key of ['peakShavingEnabled','tariffPvSeasonAiEnabled']) assert.equal((await request(h,'/api/set',{scope:'bogus',key,value:false},customer)).status,400);
      assert.equal(writes.length,0);
    });
    await test('Origin null/fremde Origin werden vor Mutationen gesperrt, eigene Origin funktioniert', async () => {
      for (const origin of ['null','https://attacker.invalid','file://127.0.0.1']) assert.equal((await request(h,'/api/set',{scope:'settings',key:'price',value:0.31},customer,{Origin:origin})).status,403);
      assert.equal((await request(h,'/api/set',{scope:'settings',key:'price',value:0.31},customer,{Origin:h.base})).status,200);
      assert.equal((await request(h,'/api/set',{scope:'settings',key:'price',value:0.31},customer,{'Sec-Fetch-Site':'cross-site'})).status,403);
    });
    await test('fehlerhaft kodierte Cookies erzeugen keinen Serverfehler', async () => {
      const r=await request(h,'/api/strict-auth/status',undefined,undefined,{Cookie:h.adapter._nwAuthCookieName+'=%E0%A4%A'});assert.equal(r.status,200);assert.equal(r.data.authed,false);
    });
    await test('Login rotiert Browser-Sitzung, Logout widerruft Token', async () => {
      const result=await request(h,'/api/strict-auth/login',{user:'admin',password:h.testPassword},admin);
      assert.equal(result.status,200);const replacement=h.tokenOf(result);assert.notEqual(replacement,admin);
      assert.equal((await request(h,'/api/license/info',undefined,admin)).status,401);
      assert.equal((await request(h,'/api/strict-auth/logout',{},replacement)).status,200);assert.equal((await request(h,'/api/license/info',undefined,replacement)).status,401);
    });
    await test('Kontosperre, Löschung und Passwortwechsel widerrufen vorhandene Sessions', async () => {
      let token=await h.login('admin');h.accounts.get('admin').common.enabled=false;assert.equal((await request(h,'/api/license/info',undefined,token)).status,401);
      assert.equal((await request(h,'/api/strict-auth/login',{user:'admin',password:h.testPassword})).status,401);h.accounts.get('admin').common.enabled=true;
      token=await h.login('admin');h.accounts.get('admin').common.password=crypto.randomBytes(32).toString('hex');assert.equal((await request(h,'/api/license/info',undefined,token)).status,401);
      token=await h.login('admin');const account=h.accounts.get('admin');h.accounts.delete('admin');assert.equal((await request(h,'/api/license/info',undefined,token)).status,401);h.accounts.set('admin',account);
    });
    await test('Gruppen-Demotion wirkt ohne Logout und ohne Wartezeit', async () => {
      h.accounts.set('worker',{_id:'system.user.worker',type:'user',common:{enabled:true,password:crypto.randomBytes(32).toString('hex')}});
      h.setGroup('system.group.installer',['system.user.installer','system.user.worker']);h.setGroup('system.group.user',['system.user.kunde','system.user.worker']);
      const original=h.adapter.checkPassword;h.adapter.checkPassword=(user,password,done)=>user==='system.user.worker'?done(password===h.testPassword,user):original(user,password,done);
      const login=await request(h,'/api/strict-auth/login',{user:'worker',password:h.testPassword});assert.equal(login.status,200);const token=h.tokenOf(login);
      assert.equal((await request(h,'/api/license/features',undefined,token)).status,200);h.groups.get('system.group.installer').common.members=['system.user.installer'];
      assert.equal((await request(h,'/api/license/features',undefined,token)).status,401);assert.equal((await request(h,'/api/strict-auth/status',undefined,token)).data.authed,false);
      const again=await request(h,'/api/auth/login',{user:'worker',password:h.testPassword});assert.equal(again.status,200);assert.equal(again.data.role,'customer');
      assert.equal((await request(h,'/api/license/features',undefined,h.tokenOf(again))).status,403);
    });
    await test('Sessionzahl pro Konto ist auf acht begrenzt', async () => {
      for(let i=0;i<10;i++) await h.login('admin');assert.equal([...h.adapter._authSessions.values()].filter(s=>s.user==='admin').length,8);
    });
    await test('Prototype-Pollution direkt, per Arrays und HTTP ist vor Merge/Mutation blockiert', async () => {
      for (const patch of [JSON.parse('{"__proto__":{"craPolluted":true}}'),JSON.parse('{"rows":[{"constructor":{"prototype":{"craPolluted":true}}}]}'),JSON.parse('{"settings":{"__proto__":{"craPolluted":true}}}')]) {
        const target={};assert.throws(()=>h.adapter.nwDeepMerge(target,patch),/Unsicherer/);assert.deepEqual(target,{});assert.equal({}.craPolluted,undefined);
        assert.equal((await request(h,'/api/installer/config',patch,installer)).status,400);assert.equal({}.craPolluted,undefined);
      }
      const input={rows:[{enabled:true}],nested:{a:2}};const output=h.adapter.nwDeepMerge({nested:{b:3}},input);assert.deepEqual(output,{rows:[{enabled:true}],nested:{a:2,b:3}});output.rows[0].enabled=false;assert.equal(input.rows[0].enabled,true);
    });
    await test('Flow-Sollwertgrenzen werden serverseitig vor jedem Gerätetarget durchgesetzt', async () => {
      h.adapter.config.vis={flowSlots:{consumers:[{consumerType:'generic',ctrl:{setpointWriteId:'fixture.set',setpointMin:10,setpointMax:80}}]}};
      const original=h.adapter.getForeignObjectAsync.bind(h.adapter);h.adapter.getForeignObjectAsync=async id=>id==='fixture.set'?{common:{write:true,min:20,max:70}}:original(id);
      const writes=[];h.adapter.setForeignStateAsync=async(...args)=>{writes.push(args);};
      for (const value of [-1,19,71,1e99]) assert.equal((await request(h,'/api/set',{scope:'flow',key:'consumer.1.setpoint',value},customer)).status,400);
      assert.equal(writes.length,0);assert.equal((await request(h,'/api/set',{scope:'flow',key:'consumer.1.setpoint',value:40},customer)).status,200);assert.deepEqual(writes[0],['fixture.set',40]);
      h.adapter.config.vis.flowSlots.consumers[0].ctrl.setpointMin=75;assert.equal((await request(h,'/api/set',{scope:'flow',key:'consumer.1.setpoint',value:76},customer)).status,400);assert.equal(writes.length,1);
    });
    await test('öffentliche States und selbst privilegierter SSE-LIVE-Kanal enthalten keine Stationstokens', async () => {
      const marker=crypto.randomBytes(24).toString('hex');h.adapter.stateCache['chargeKiosk.stations.test.csvExportUrl']={value:`/api/display/station/${marker}/operator.csv`};h.adapter.stateCache['chargeKiosk.stations.test.operatorSummaryJson']={value:JSON.stringify({csvUrl:`/api/display/station/${marker}/operator.csv`})};h.adapter.stateCache['installer.configJson']={value:'private-admin-config'};
      const anonymous=await request(h,'/api/state');assert.equal(anonymous.status,401);assert.ok(!anonymous.text.includes(marker));
      const publicState=await request(h,'/api/state',undefined,customer);assert.equal(publicState.status,200);assert.ok(!publicState.text.includes(marker));assert.ok(!publicState.text.includes('private-admin-config'));
      const current=await h.login('admin');const abort=new AbortController();const response=await fetch(h.base+'/events',{headers:{Cookie:h.cookieHeader(current)},signal:abort.signal});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^text\/event-stream/);const reader=response.body.getReader();const chunk=await reader.read();const body=Buffer.from(chunk.value).toString();assert.match(body,/data:/);assert.ok(!body.includes(marker));assert.ok(!body.includes('private-admin-config'));abort.abort();
    });
    await test('Stationsmodus-Freigabe gilt ebenso für set-mode und mode Alias', async () => {
      const token=crypto.randomBytes(24).toString('hex');h.adapter._nwLicenseAllowsAppId=()=>true;h.adapter.config.chargeKiosk={stations:[{id:'solar',token,assignmentMode:'manual',assignedChargepoints:['lp1'],allowedModes:['solar']}]};
      for(const action of ['set-mode','mode']) for(const mode of ['boost','fast','auto','minpv','invalid']) assert.equal((await request(h,`/api/display/station/${token}/command`,{lp:'lp1',action,mode})).status,403);
    });
    await test('neue oder geänderte kurze Stationstokens werden beim Save und Import abgelehnt', async () => {
      const station={id:'new-station',token:'short',enabled:true,assignedChargepoints:['lp1']};
      for(const url of ['/api/installer/config','/api/installer/backup/import']) {
        const result=await request(h,url,{patch:{chargeKiosk:{stations:[station]}},restartEms:false},installer);assert.equal(result.status,400);assert.equal(result.data.error,'invalid_station_token');
      }
      const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'../src-ts/runtime-executables/main.ts'),'utf8');
      const fn=source.match(/    const nwValidateStationTokenChanges = \(patch\) => \{[\s\S]*?\n    \};/)[0];
      const validate=new Function(fn+'; return nwValidateStationTokenChanges;').call(h.adapter);
      const strong='ST-'+crypto.randomBytes(16).toString('hex').toUpperCase();assert.equal(validate({chargeKiosk:{stations:[{...station,token:strong}]}}),'');
      h.adapter.config.chargeKiosk={stations:[station]};assert.equal(validate({chargeKiosk:{stations:[station]}}),'');
      assert.ok(validate({chargeKiosk:{stations:[{...station,token:strong},{id:'other',token:strong}]}}));
    });
  } finally { await h.close(); }
  const missingPolicy=await createHarness({policy:'invalid-policy'});try{
    await test('fehlende oder ungültige Policy fällt sicher auf session zurück',async()=>{
      assert.equal((await request(missingPolicy,'/api/set',{scope:'settings',key:'price',value:1})).status,401);
    });
  }finally{await missingPolicy.close();}
  const stalled=await createHarness();try{
    await test('fehlender Passwort-Rückruf läuft nach fünf Sekunden aus und gibt Login-Kapazität frei',async()=>{
      const original=stalled.adapter.checkPassword;stalled.adapter.checkPassword=()=>{};
      const start=Date.now();assert.equal((await request(stalled,'/api/strict-auth/login',{user:'admin',password:stalled.testPassword})).status,401);assert.ok(Date.now()-start<6500);
      stalled.adapter.checkPassword=original;assert.equal((await request(stalled,'/api/strict-auth/login',{user:'admin',password:stalled.testPassword})).status,200);
    });
  }finally{await stalled.close();}
  for (const policy of ['all','lan','session']) {
    const open=await createHarness({authEnabled:false,policy});try{
      await test(`Installer-Mapping bleibt bei auth=false und ${policy} geschützt`,async()=>{
        const writes=[];open.adapter.setForeignStateAsync=async(...args)=>{writes.push(args);};open.adapter.config.installer={critical:'fixture.critical'};
        assert.equal((await request(open,'/api/set',{scope:'installer',key:'critical',value:0})).status,401);assert.equal(writes.length,0);
        const installer=await open.login('installer');assert.equal((await request(open,'/api/set',{scope:'installer',key:'critical',value:1},installer)).status,200);assert.equal(writes.length,1);
        assert.equal((await request(open,'/api/auth/status')).data.isAdmin,false);
      });
    }finally{await open.close();}
  }
  const limited=await createHarness();try{
    await test('parallele Logins reservieren Kapazität vor der Passwortprüfung',async()=>{
      let active=0,max=0;limited.adapter.checkPassword=(_user,_password,done)=>{active++;max=Math.max(max,active);setTimeout(()=>{active--;done(false);},30);};
      const results=await Promise.all(Array.from({length:12},()=>request(limited,'/api/strict-auth/login',{user:'admin',password:crypto.randomBytes(16).toString('hex')})));assert.ok(max<=3);assert.ok(results.some(r=>r.status===429));
      for(let i=0;i<6;i++) await request(limited,'/api/strict-auth/login',{user:'admin',password:crypto.randomBytes(16).toString('hex')});
      assert.equal((await request(limited,'/api/strict-auth/login',{user:'admin',password:crypto.randomBytes(16).toString('hex')})).status,429);
    });
  }finally{await limited.close();}
  console.log(`CRA AUTH: ${checks} checks passed; real local HTTP, mocked ioBroker accounts/states, no hardware.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
