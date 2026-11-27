/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.join(__dirname,'..');
const code=ts.transpileModule(fs.readFileSync(path.join(root,'ui/src-ts/runtime-executables/www/storagefarm-dispatch.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const liveCode=ts.transpileModule(fs.readFileSync(path.join(root,'ui/src-ts/runtime-executables/www/live-display.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const html=fs.readFileSync(path.join(root,'ui/www/storagefarm.html'),'utf8');
const ids=new Set(Array.from(html.matchAll(/id="([^"]+)"/g),m=>m[1]));
const now=1800000000000;
function fixture(){
 const elements=new Map();
 function node(tag='div'){let own='';const attrs=new Map();return{tagName:tag,children:[],className:'',setAttribute(k,v){attrs.set(k,String(v))},getAttribute(k){return attrs.get(k)??null},hasAttribute(k){return attrs.has(k)},set textContent(v){own=String(v);this.children=[]},get textContent(){return own+this.children.map(n=>n.textContent).join(' ')},append(...nodes){this.children.push(...nodes)},replaceChildren(...nodes){own='';this.children=[...nodes]}}}
 function get(id){assert.ok(ids.has(id),'Actual HTML contains '+id);if(!elements.has(id))elements.set(id,node());return elements.get(id)}
 const window={}; const context=vm.createContext({window,document:{getElementById:get,createElement:node},Date,console});
 vm.runInContext(liveCode,context); vm.runInContext(code,context);
 return{api:window.NWStorageFarmDispatch,get,render(s,connected=true,time=now){window.NWStorageFarmDispatch.render(s,connected,time)},details(){return get('sf_dispatch_members').children.map(d=>({name:d.children.at(0)?.textContent,fields:Object.fromEntries((d.children.at(1)?.children||[]).map(pair=>pair.children.map(n=>n.textContent)))}))}};
}
const rec=value=>({value,ts:now});
function sample(){
 const members=[{dispatchKey:'fenecon',name:'Speicher',online:true,soc:1,maxDischargeW:5000,chargePowerW:0,dischargePowerW:0,dischargeBlockedReasons:[]},
 {dispatchKey:'solax',name:'Speicher',online:true,soc:98,maxDischargeW:5000,chargePowerW:0,dischargePowerW:0,dischargeBlockedReasons:[]}];
 const diag={ts:now,requestedW:600,acceptedDeliveredW:600,status:'farm',direction:'discharge',dischargeFloorSocPct:10,
 results:[{dispatchKey:'solax',name:'Speicher',chargeW:0,dischargeW:600,acceptedW:600,directionDispatchAvailable:true,effectiveMaxDischargeW:5000,dischargeFloorSocPct:10,commandAccepted:true,ok:true,statusMatch:'dispatch-key',writes:{}},
 {dispatchKey:'fenecon',name:'Speicher',chargeW:0,dischargeW:0,acceptedW:0,directionDispatchAvailable:false,effectiveMaxDischargeW:0,dischargeFloorSocPct:10,blockedReasons:['soc_at_or_below_discharge_floor'],commandAccepted:true,ok:true,statusMatch:'dispatch-key',writes:{}}]};
 const snapshot={'storageFarm.storagesStatusJson':rec(JSON.stringify(members)),'storageFarm.lastDispatchJson':rec(JSON.stringify(diag)),
 'storageFarm.overviewJson':rec(JSON.stringify({v:1,updatedAt:now,members:{total:2},battery:{complete:true,total:2,valid:2,netW:0}})),
 'speicher.regelung.aktiv':rec(true),'speicher.regelung.sollW':rec(600),'speicher.regelung.quelle':rec('eigenverbrauch'),'speicher.regelung.grund':rec('Netzbezug ausgleichen')};
 return {snapshot,members,diag,update(){snapshot['storageFarm.storagesStatusJson']=rec(JSON.stringify(members));snapshot['storageFarm.lastDispatchJson']=rec(JSON.stringify(diag));}};
}
test('actual diagnostic DOM separates requested, accepted command and measured farm output',()=>{
 const f=fixture(),s=sample();f.render(s.snapshot);
 assert.equal(f.get('sf_dispatch_requested').textContent,'Entladen 600 W');
 assert.equal(f.get('sf_dispatch_accepted').textContent,'Entladen 600 W');
 assert.equal(f.get('sf_dispatch_measured').textContent,'0 W');
 assert.match(f.get('sf_dispatch_status').textContent,/Schreibauftrag übergeben/);
 assert.doesNotMatch(f.get('sf_dispatch_status').textContent,/separat prüfen/);
 assert.match(f.get('sf_dispatch_accepted_detail').textContent,/keine Treiber-, Geräte- oder Leistungsbestätigung/);
 assert.match(f.get('sf_dispatch_ems').textContent,/eigenverbrauch.*Netzbezug ausgleichen/);
});
test('same-name members are joined by dispatchKey despite reversed result order, and floor/caps describe only that request',()=>{
 const f=fixture(),s=sample();f.render(s.snapshot);const [low,high]=f.details();
 assert.equal(low.fields['An Schreibpfad übergeben'],'0 W');assert.equal(high.fields['An Schreibpfad übergeben'],'600 W');
 assert.match(low.fields.Schreibdiagnose,/Mindest-SoC erreicht/);
 assert.equal(low.fields['Effektives Limit dieses Entladeauftrags'],'0 W');
 assert.equal(low.fields['Konfiguriertes Entladelimit'],'5 kW');
 assert.equal(low.fields['Mindest-SoC dieses Entladeauftrags'],'10 %');
 assert.match(low.fields['Freigabe dieses Regelauftrags'],/ausgeschlossen/);
 assert.match(high.fields['Freigabe dieses Regelauftrags'],/berücksichtigbar/);
 f.get('sf_dispatch_members').children[0].setAttribute('open','');f.render(s.snapshot);assert.equal(f.get('sf_dispatch_members').children[0].hasAttribute('open'),true,'expanded diagnostic survives a telemetry refresh');
});
test('a missing, limited or blocked command is never presented as an explicit zero request or healthy standby',()=>{
 const f=fixture(),s=sample();s.diag.acceptedDeliveredW=0;s.diag.status='farm-write-failed';s.diag.results[0].authorityBlocked=true;s.update();f.render(s.snapshot);
 assert.match(f.get('sf_dispatch_status').textContent,/Leistung angefordert, aber kein Leistungsbefehl angenommen/);
 assert.match(f.details()[1].fields.Schreibdiagnose,/Schreibzuständigkeit blockiert/);
 delete s.snapshot['storageFarm.lastDispatchJson'];f.render(s.snapshot);
 assert.match(f.get('sf_dispatch_status').textContent,/Keine aktuelle Farm-Verteilung/);assert.equal(f.get('sf_dispatch_accepted').textContent,'—');
 assert.equal(f.get('sf_dispatch_requested').textContent,'Entladen 600 W');
 assert.match(f.api.status(s.members[0]),/Messung online/);assert.doesNotMatch(f.api.status(s.members[0]),/Standby|Bereit/);
 s.diag.requestedW=0;s.diag.acceptedDeliveredW=0;s.diag.status='farm-stop';s.update();s.snapshot['speicher.regelung.sollW']=rec(0);f.render(s.snapshot);
 assert.match(f.get('sf_dispatch_status').textContent,/Aktuelle Nullvorgabe/);assert.equal(f.get('sf_dispatch_requested').textContent,'0 W');
});
test('both source JSON age and state timestamp must be current; offline or future data is unknown',()=>{
 const f=fixture(),s=sample();
 s.diag.ts=now-30001;s.update();f.render(s.snapshot);assert.equal(f.get('sf_dispatch_accepted').textContent,'—');
 s.diag.ts=now;s.update();s.snapshot['storageFarm.lastDispatchJson'].ts=now-30001;f.render(s.snapshot);assert.equal(f.get('sf_dispatch_accepted').textContent,'—');
 s.update();s.diag.ts=now+5001;s.update();f.render(s.snapshot);assert.equal(f.get('sf_dispatch_accepted').textContent,'—');
 s.diag.ts=now;s.update();f.render(s.snapshot,false);assert.equal(f.get('sf_dispatch_measured').textContent,'—');assert.equal(f.get('sf_dispatch_requested').textContent,'—');assert.equal(f.api.rows(s.snapshot,false,now).length,0);
 f.render(s.snapshot,true,now+30001);assert.match(f.get('sf_dispatch_members').textContent,/Keine aktuellen/);
});
test('ambiguous legacy names, conflicting keys and duplicate member keys never receive another storage command',()=>{
 const f=fixture(),s=sample();for(const r of s.diag.results)delete r.dispatchKey;s.update();f.render(s.snapshot);
 for(const row of f.details())assert.match(row.fields['Zuteilung der letzten Verteilung'],/Keine eindeutige/);
 s.members[0].name='Einzel A';s.members[1].name='Einzel B';s.diag.results[0].name='Einzel B';s.diag.results[1].name='Einzel A';s.update();f.render(s.snapshot);
 assert.equal(f.details()[0].fields['An Schreibpfad übergeben'],'0 W');
 s.diag.results[1].dispatchKey='unrelated';s.update();f.render(s.snapshot);assert.match(f.details()[0].fields['Zuteilung der letzten Verteilung'],/Keine eindeutige/);
 s.members[1].dispatchKey='fenecon';s.diag.results[1].dispatchKey='fenecon';s.update();f.render(s.snapshot);for(const row of f.details())assert.match(row.fields['Zuteilung der letzten Verteilung'],/Keine eindeutige/);
});
test('unknown caps, boolean/null power, missing reasons and changed EMS target stay explicit instead of being fabricated',()=>{
 const f=fixture(),s=sample();s.diag.acceptedDeliveredW=null;s.diag.requestedW=false;delete s.diag.results[0].effectiveMaxDischargeW;delete s.diag.results[0].dischargeFloorSocPct;s.update();f.render(s.snapshot);
 assert.equal(f.get('sf_dispatch_requested').textContent,'—');assert.equal(f.get('sf_dispatch_accepted').textContent,'—');
 assert.match(f.details()[1].fields['Effektives Limit dieses Entladeauftrags'],/Kein numerischer/);
 assert.equal(f.details()[1].fields['Mindest-SoC dieses Entladeauftrags'],'Nicht mitgeteilt');
 s.diag.requestedW=600;s.diag.acceptedDeliveredW=-600;s.update();f.render(s.snapshot);assert.match(f.get('sf_dispatch_status').textContent,/Richtung der Befehlsannahme weicht/);
 s.diag.requestedW=600;s.update();s.snapshot['speicher.regelung.sollW']=rec(900);f.render(s.snapshot);assert.match(f.get('sf_dispatch_status').textContent,/EMS-Ziel geändert/);
});
test('diagnostic reason/name payload is rendered as text only and malformed JSON cannot create a false available state',()=>{
 const f=fixture(),s=sample();s.members[0].name='<img src=x onerror=alert(1)>';s.diag.results[1].blockedReasons=['<script>bad()</script>'];s.update();f.render(s.snapshot);
 assert.equal(f.details()[0].name,'<img src=x onerror=alert(1)>');assert.match(f.details()[0].fields.Schreibdiagnose,/<script>/);
 assert.equal(f.get('sf_dispatch_members').children[0].children[0].tagName,'summary');
 s.snapshot['storageFarm.lastDispatchJson']=rec('{');s.snapshot['storageFarm.storagesStatusJson']=rec('{}');f.render(s.snapshot);assert.match(f.get('sf_dispatch_status').textContent,/Keine aktuelle/);assert.equal(f.api.rows(s.snapshot,true,now).length,0);
});
test('shipped farm page loads strict diagnostic renderer before page logic and exposes all three actual DOM cards',()=>{
 assert.ok(html.indexOf('/static/storagefarm-dispatch.js')<html.indexOf('/static/storagefarm.js'));
 for(const id of ['sf_dispatch_requested','sf_dispatch_accepted','sf_dispatch_measured','sf_dispatch_members'])assert.ok(ids.has(id));
 const page=fs.readFileSync(path.join(root,'ui/src-ts/runtime-executables/www/storagefarm.ts'),'utf8');
 assert.match(page,/NWStorageFarmDispatch\.rows\(state, liveConnected\)/);assert.match(page,/NWStorageFarmDispatch\.render\(state, liveConnected\)/);
});

test('own command-DP echo never confirms the driver or device, even when old JSON says confirmed',()=>{
 const f=fixture(),s=sample();s.diag.requestedW=681;s.diag.acceptedDeliveredW=681;s.snapshot['speicher.regelung.sollW']=rec(681);
 s.snapshot['storageFarm.overviewJson']=rec(JSON.stringify({v:1,updatedAt:now,members:{total:2},battery:{complete:true,total:2,valid:2,netW:31}}));
 s.diag.results[0].writes={signed:{ok:true,readbackSupported:true,readbackOk:true,readback:{ok:true,status:'confirmed',expected:681,actual:681,ack:false,ts:now}}};s.update();f.render(s.snapshot);
 assert.equal(f.get('sf_dispatch_accepted').textContent,'Entladen 681 W');assert.equal(f.get('sf_dispatch_measured').textContent,'Entladen 31 W');
 assert.match(f.details()[1].fields['DP-Rückmeldung'],/Nur Sollwert im ioBroker-DP; Treiberquittierung ausstehend/);
 const wr=s.diag.results[0].writes.signed;wr.readbackOk=false;Object.assign(wr.readback,{ok:false,pending:true,status:'pending-ack',confirmationLevel:'requested'});s.update();f.render(s.snapshot);
 assert.match(f.details()[1].fields['DP-Rückmeldung'],/Quittierung ausstehend/i);assert.doesNotMatch(f.details()[1].fields.Schreibdiagnose,/abweichend|fehlgeschlagen/);
 wr.readbackOk=true;Object.assign(wr.readback,{ok:true,pending:false,ack:true,status:'driver-acknowledged',confirmationLevel:'driver-acknowledged'});s.update();f.render(s.snapshot);
 assert.match(f.details()[1].fields['DP-Rückmeldung'],/Vom Treiber quittiert; physische Umsetzung nicht bestätigt/);
 wr.readback.ts=now-30001;s.update();f.render(s.snapshot);assert.match(f.details()[1].fields['DP-Rückmeldung'],/veraltet/);
 delete wr.readback.ack;wr.readback.ts=now;s.update();f.render(s.snapshot);assert.match(f.details()[1].fields['DP-Rückmeldung'],/Quittierungsstatus nicht mitgeteilt/);
});

test('configured limit, device allowance and effective request limit remain distinct across current and legacy snapshots',()=>{
 const f=fixture(),s=sample();Object.assign(s.members[1],{configuredMaxDischargeW:5000,maxDischargeW:250,dischargeCapability:{configured:true,status:'valid',valueW:250,limitW:250,objectId:'ess.allowedDischargePower'}});
 s.diag.results[0].effectiveMaxDischargeW=250;s.update();f.render(s.snapshot);let fields=f.details()[1].fields;
 assert.equal(fields['Konfiguriertes Entladelimit'],'5 kW');assert.equal(fields['Gerätefreigabe Entladen'],'250 W · aktuelle Gerätefreigabe');assert.equal(fields['Effektives Limit dieses Entladeauftrags'],'250 W');
 s.members[1].configuredMaxDischargeW=null;s.update();f.render(s.snapshot);assert.equal(f.details()[1].fields['Konfiguriertes Entladelimit'],'Keine feste Grenze hinterlegt');
 delete s.members[1].configuredMaxDischargeW;s.members[1].maxDischargeW=5000;s.update();f.render(s.snapshot);assert.equal(f.details()[1].fields['Konfiguriertes Entladelimit'],'5 kW');
 for(const [state,label] of [['missing','fehlt'],['invalid','ungültig'],['stale','veraltet']]){
  s.members[1].dischargeCapability={configured:true,status:state,valueW:null,limitW:0};s.members[1].dischargeBlockedReasons=['discharge_capability_'+state];s.update();f.render(s.snapshot);fields=f.details()[1].fields;
  assert.match(fields['Gerätefreigabe Entladen'],new RegExp(label));assert.doesNotMatch(fields['Gerätefreigabe Entladen'],/0 W/);assert.match(fields.Entladehinweise,new RegExp(label));
 }
 s.members[1].dischargeCapability={configured:true,status:'valid',valueW:0,limitW:0};s.members[1].dischargeBlockedReasons=['discharge_capability_zero'];
 s.members[1].chargeCapability={configured:true,status:'stale',valueW:null,limitW:0};s.update();f.render(s.snapshot);fields=f.details()[1].fields;
 assert.equal(fields['Gerätefreigabe Entladen'],'0 W · Gerät sperrt Entladen');assert.match(fields['Gerätefreigabe Laden'],/veraltet/);
 s.members[1].dischargeCapability={configured:false,status:'unconfigured',valueW:null,limitW:null};s.update();f.render(s.snapshot);assert.equal(f.details()[1].fields['Gerätefreigabe Entladen'],'Nicht zugeordnet');
});

test('a fresh storage decision describes an unchanged writer while both farm members retain their independent evidence', () => {
 const f = fixture(), s = sample(), key = 'speicher.regelung.dispatcherJson';
 for (const name of ['aktiv', 'quelle', 'grund', 'sollW']) s.snapshot['speicher.regelung.' + name].ts = now - 120000;
 const decision = { ts: now, active: true, finalW: 636, src: 'eigenverbrauch', reason: 'Eigenverbrauch: NVP-Balancing entladen' };
 s.snapshot[key] = rec(JSON.stringify(decision));
 Object.assign(s.diag, { requestedW: 636, acceptedDeliveredW: 636, source: 'eigenverbrauch' });
 Object.assign(s.diag.results[0], { dischargeW: 636, acceptedW: 636 });
 s.snapshot['storageFarm.overviewJson'] = rec(JSON.stringify({v: 1, updatedAt: now, members: {total: 2}, battery: {complete: true, total: 2, valid: 2, netW: 576}}));
 s.update();
 f.render(s.snapshot);
 assert.match(f.get('sf_dispatch_ems').textContent, /Speicherregelung: aktiv.*Reglerziel vor Schreibprüfung: Entladen 636 W.*Quelle: eigenverbrauch.*NVP-Balancing/);
 assert.equal(f.get('sf_dispatch_requested').textContent, 'Entladen 636 W');
 assert.equal(f.get('sf_dispatch_accepted').textContent, 'Entladen 636 W');
 assert.equal(f.get('sf_dispatch_measured').textContent, 'Entladen 576 W');
 assert.deepEqual(f.details().map(row => row.fields['An Schreibpfad übergeben']), ['0 W', '636 W']);
 for (const row of f.details()) assert.match(row.fields['DP-Rückmeldung'], /Keine aktuelle Quittierungsdiagnose/);
 s.snapshot[key] = rec(JSON.stringify({ts: now, active: false, disabled: true, src: 'aus', reason: 'Deaktiviert'}));
 f.render(s.snapshot);
 assert.match(f.get('sf_dispatch_ems').textContent, /deaktiviert.*Reglerziel vor Schreibprüfung: —.*Quelle: aus/);
 assert.match(f.get('sf_dispatch_status').textContent, /Quelle des letzten Farmauftrags: eigenverbrauch/);
 s.snapshot[key] = rec(JSON.stringify(decision));
 s.snapshot['speicher.regelung.aktiv'] = {value: false, ts: now + 1};
 f.render(s.snapshot);
 assert.match(f.get('sf_dispatch_ems').textContent, /deaktiviert/);
 assert.doesNotMatch(f.get('sf_dispatch_ems').textContent, /Quelle: eigenverbrauch/);
});

test('stale, invalid, unacknowledged, or unproven storage decisions cannot confirm operation', () => {
 const f = fixture(), s = sample(), key = 'speicher.regelung.dispatcherJson';
 for (const name of ['aktiv', 'quelle', 'grund', 'sollW']) delete s.snapshot['speicher.regelung.' + name];
 const good = {ts: now, active: true, finalW: 636, src: 'eigenverbrauch', reason: 'NVP-Balancing'};
 s.diag.source = 'eigenverbrauch'; s.update();
 for (const input of [
   {}, rec('{'), rec(JSON.stringify({...good, ts: now + 5001})), rec(JSON.stringify({...good, ts: now - 30001})),
   {...rec(JSON.stringify(good)), ts: now - 30001}, {...rec(JSON.stringify(good)), q: 64},
   {...rec(JSON.stringify(good)), ack: false}, rec(JSON.stringify({...good, active: 'true'})),
   rec(JSON.stringify({...good, active: undefined})), rec(JSON.stringify({...good, disabled: true})),
 ]) {
   s.snapshot[key] = input; f.render(s.snapshot);
   assert.match(f.get('sf_dispatch_ems').textContent, /Status unbekannt.*Quelle: unbekannt/);
   assert.match(f.get('sf_dispatch_status').textContent, /Quelle des letzten Farmauftrags: eigenverbrauch/);
 }
 s.snapshot[key] = rec(JSON.stringify(good)); f.render(s.snapshot, false);
 assert.match(f.get('sf_dispatch_ems').textContent, /Status unbekannt.*Quelle: unbekannt/);
 assert.doesNotMatch(f.get('sf_dispatch_status').textContent, /eigenverbrauch/);
});

test('public initial snapshot and SSE patch expose only the typed fields used for the storage decision', () => {
 const source = fs.readFileSync(path.join(root, 'ui/src-ts/runtime-executables/main.ts'), 'utf8');
 const begin = source.indexOf('    const nwMaskEmail ='), end = source.indexOf('    /** Öffentliche /config-', begin);
 assert.ok(begin > 0 && end > begin);
 const api = {};
 vm.runInNewContext('(function(){' + source.slice(begin, end) + '}).call(api)', {api, Date});
 const key = 'speicher.regelung.dispatcherJson';
 const data = {ts: now, active: true, finalW: 636, src: 'eigenverbrauch', reason: 'NVP-Balancing', reqW: 640, validation: {internal: 'local-validation-data'}};
 const states = {[key]: {...rec(JSON.stringify(data)), q: 0, ack: true}};
 for (const project of [api._nwBuildPublicStateSnapshot, api._nwBuildPublicStatePatch]) {
   const publicState = project(states)[key];
   assert.deepEqual(JSON.parse(publicState.value), {ts: now, active: true, disabled: false, finalW: 636, src: 'eigenverbrauch', reason: 'NVP-Balancing'});
   assert.equal(publicState.ts, now); assert.equal(publicState.q, 0); assert.equal(publicState.ack, true);
   for (const malformed of ['{}', '{', 'null', JSON.stringify({...data, active: 'yes'})]) {
     assert.equal(project({[key]: rec(malformed)})[key].value, null);
   }
 }
 assert.equal(JSON.parse(states[key].value).validation.internal, 'local-validation-data');
});

test('warning threshold uses comparable signed power for one confirmed command and handles exact boundaries', () => {
 const {compareFarmPower} = require('../ui/www/live-display');
 const commandAt = now - 8000, sampledAt = now - 250, expiry = now + 1500;
 for (const [target, actual, difference, warn] of [
   [636, 576, 60, false], [399, 200, 199, false], [400, 200, 200, false],
   [401, 200, 201, true], [-100, 100, 200, false], [-101, 100, 201, true],
   [0, -201, 201, true], [0, 0, 0, false], [200.2, 0, 200.2, true],
 ]) {
   const result = compareFarmPower(target, actual, commandAt, sampledAt, expiry, now);
   assert.deepEqual(result, {v:1, targetW:target, measuredW:actual, differenceW:difference, commandAt, sampledAt, validUntil:expiry, warning:warn});
 }
 for (const [target, actual, command, sample, until] of [
   [undefined, 0, commandAt, sampledAt, expiry], [false, 0, commandAt, sampledAt, expiry],
   [600, null, commandAt, sampledAt, expiry], [0, Infinity, commandAt, sampledAt, expiry],
   [500, 0, now, now, expiry], [500, 0, now - 1, now - 2, expiry], [500, 0, now - 1, now + 1, expiry],
   [500, 0, 0, sampledAt, expiry], [500, 0, commandAt, sampledAt, now - 1], [500, 0, now - 40000, now - 30001, expiry],
 ]) assert.equal(compareFarmPower(target, actual, command, sample, until, now), null);
 assert.equal(compareFarmPower(500, 0, now-40000, now-30000, expiry, now).validUntil, now);
});

test('farm shows a specific member warning and preserves independent write failure, even when farm totals cancel', () => {
 const {compareFarmPower} = require('../ui/www/live-display');
 const f=fixture(), s=sample(), compare=(target,actual)=>compareFarmPower(target,actual,now-10000,now-50,now+1200,now);
 s.members[0].name='Speicher A'; s.members[1].name='Speicher B';
 s.members[0].powerComparison=compare(300,99); s.members[1].powerComparison=compare(-300,-99);
 s.diag.writeOk=false; s.diag.status='farm-write-failed'; s.update(); f.render(s.snapshot);
 const banner=f.get('sf_dispatch_deviation');
 assert.equal(banner.hidden,false); assert.match(banner.textContent,/Speicher A \(201 W\).*Speicher B \(201 W\)/);
 assert.match(f.details()[0].fields['Soll-/Ist-Vergleich'],/Soll Entladen 300 W.*Ist Entladen 99 W.*201 W/);
 assert.match(f.details()[1].fields['Soll-/Ist-Vergleich'],/Soll Laden 300 W.*Ist Laden 99 W.*201 W/);
 assert.match(f.get('sf_dispatch_status').textContent,/Schreibauftrag fehlgeschlagen/);
 assert.equal(f.get('sf_dispatch_status').getAttribute('data-warning'),'true');
 s.members[0].powerComparison=compare(300,100); s.members[1].powerComparison=compare(300,150);
 s.update(); f.render(s.snapshot); assert.equal(banner.hidden,true);
 assert.equal(f.get('sf_dispatch_status').getAttribute('data-warning'),'true');
 s.members[0].powerComparison=compare(300,0); s.members[1].powerComparison=null; s.update(); f.render(s.snapshot);
 assert.match(banner.textContent,/Speicher A/); assert.doesNotMatch(banner.textContent,/Speicher B/);
 s.members[1].dispatchKey=s.members[0].dispatchKey; s.update(); f.render(s.snapshot); assert.equal(banner.hidden,true);
 s.members[1].dispatchKey='solax'; s.update(); f.render(s.snapshot,true,now+1201); assert.equal(banner.hidden,true);
 f.render(s.snapshot,false); assert.equal(banner.hidden,true);
 s.snapshot['storageFarm.storagesStatusJson'].q=128; f.render(s.snapshot); assert.equal(banner.hidden,true);
});

test('direct ESS comparison labels the AC actuator boundary independently of battery power and sign', () => {
 const {compareFarmPower} = require('../ui/www/live-display');
 const f=fixture(), s=sample();
 s.members[0].name='FENECON'; s.members[0].batteryFlowPowerW=-1750;
 s.members[0].powerComparison=compareFarmPower(636,435,now-2000,now-50,now+500,now,'ess-ac');
 s.members[1].powerComparison=compareFarmPower(-636,-576,now-2000,now-50,now+500,now);
 s.update(); f.render(s.snapshot);
 const first=f.details()[0].fields['Soll-/Ist-Vergleich · ESS-Wechselrichter (AC)'];
 assert.match(first,/Soll AC-Abgabe 636 W.*Ist AC-Abgabe 435 W.*201 W/);
 assert.doesNotMatch(first,/Laden|Entladen|1.750/);
 assert.match(f.get('sf_dispatch_deviation').textContent,/FENECON \(201 W\)/);
 assert.match(f.details()[1].fields['Soll-/Ist-Vergleich'],/Soll Laden 636 W.*Ist Laden 576 W.*60 W/);
 s.members[0].powerComparison=compareFarmPower(-636,-436,now-2000,now-50,now+500,now,'ess-ac');
 s.update(); f.render(s.snapshot);
 assert.match(f.details()[0].fields['Soll-/Ist-Vergleich · ESS-Wechselrichter (AC)'],/AC-Aufnahme/);
 assert.equal(f.get('sf_dispatch_deviation').hidden,true);
});
