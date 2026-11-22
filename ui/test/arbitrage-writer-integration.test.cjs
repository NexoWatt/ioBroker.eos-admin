/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/** Produktiver Speicher-Tick mit simulierten ioBroker-Transporten; keine Geräteprüfung. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS} }).outputText, file);
const base = '../src-ts/runtime-executables/ems/';
const { SpeicherRegelungModule } = require(base + 'modules/storage-control');
const { installActuatorShadowArbiter } = require(base + 'services/actuator-shadow-arbiter');
// Bewährte produktive Tick-Testdaten wiederverwenden, ohne dessen Szenarien zu starten.
const fixtureText = fs.readFileSync(path.join(__dirname, '../scripts/verify-storage-control-runtime-scenarios.js'), 'utf8').split('(async () => {')[0].replace(/^#![^\n]*\n/, '');
const fixtures = new Function('require', fixtureText + '\nreturn {FakeDp,makeEntry,makeAdapter};')(id => id === '../ems/modules/storage-control' ? { SpeicherRegelungModule } : require(id));
function setup(profile = 'household') {
  const {FakeDp,makeEntry,makeAdapter} = fixtures;
  const adapter = makeAdapter({storage:{maxChargeW:6000,maxDischargeW:6000,allowGridCharge:true},root:{installerConfig:{gridConnectionPower:22000}}});
  adapter.namespace = 'nexowatt-ui.0';
  adapter.config.emsApps = { apps: { arbitrage: {installed:true, enabled:true} } };
  adapter.config.partnerIntegrations = { enabled:true,configVersion:1,partnerId:'partner-a',arbitrage:{profile,resources:[{id:'single',commissioned:true,maxChargeW:6000,maxDischargeW:6000,maxImportW:22000,maxExportW:5000,minSocPct:20,maxSocPct:90,allowGridCharge:true,allowGridExport:true}]} };
  const now = Date.now();
  adapter._nvpFreshnessSnapshot = { ts:now,measurementAgeMs:0,netW:1000,usable:true,connected:true };
  adapter._nwSafetyEnvelopeRequired = true;
  adapter._emsSafetyCycle = {generation:1,moduleHealth:{},safetyFaults:[]};
  const entries = {'grid.powerW':makeEntry(1000,'grid.filtered'),'grid.powerRawW':makeEntry(1000,'grid.raw'),'st.socPct':makeEntry(50,'battery.soc'),'st.batteryPowerW':makeEntry(0,'battery.actualPower'),'st.targetPowerW':makeEntry(0,'battery.target')};
  const dp = new FakeDp(entries), writes = [];
  adapter.setForeignStateAsync = async (id,val,ack) => {writes.push([id,val,ack]);return true;};
  adapter.getForeignObjectAsync = async () => ({type:'state',common:{write:true}});
  installActuatorShadowArbiter(adapter);
  dp.writeNumber = async (key,value) => {const r=await adapter.setForeignStateAsync(entries[key]?.objectId || key,value,false);return !r?.__nexowattActuatorAuthorityBlocked;};
  dp.writeBoolean = dp.writeNumber;
  let request = {id:'command-1',resourceId:'single',action:'charge',powerW:2000,issuedAt:now-10,expiresAt:now+10000,configVersion:1,partnerId:'partner-a'};
  adapter._nwGetPartnerStorageRequest = () => request;
  const controller = new SpeicherRegelungModule(adapter,dp);
  return {adapter,dp,writes,controller,setRequest:r=>{request=r;},getRequest:()=>request};
}

test('standalone Partnerladung erreicht genau bestehenden Speicher-Writer ohne DynamicGrid/PV/Bilanz', async () => {
  const f=setup(); await f.controller.tick();
  assert.equal(f.adapter._nwPartnerArbitrageDecision.status,'ready',JSON.stringify(f.adapter._nwPartnerArbitrageDecision));
  assert.equal(f.adapter._nwPartnerResourceAvailability.single.available,true);
  assert.equal(f.adapter._nwPartnerStorageTelemetry.single.powerTs,f.dp.entries['st.batteryPowerW'].ts);
  const values=f.writes.filter(([id])=>id==='battery.target');
  assert.equal(values.length,1); assert.equal(values[0][1],-2000);
  assert.equal(f.controller._lastSource,'arbitrage');
});

test('abgelaufener Auftrag fällt im nächsten produktiven Tick auf Haushaltsregelung zurück', async () => {
  const f=setup(); await f.controller.tick(); f.writes.length=0;
  f.setRequest({...f.getRequest(),expiresAt:Date.now()-1});
  await f.controller.tick();
  const values=f.writes.filter(([id])=>id==='battery.target');
  assert.equal(values.length,1); assert.ok(values[0][1]>=0,JSON.stringify(values));
  assert.notEqual(f.controller._lastSource,'arbitrage');
});

test('Handelsprofil fällt nach Disconnect auf lokalen Nullwunsch zurück', async () => {
  const f=setup('tradingOnly'); await f.controller.tick(); f.writes.length=0; f.setRequest(null);
  await f.controller.tick();
  const values=f.writes.filter(([id])=>id==='battery.target');
  assert.equal(values.length,1); assert.equal(values[0][1],0);
});

test('Widerruf während produktivem Write-await verhindert den alten Partnerbefehl', async () => {
  const f=setup(); let resumed=false;
  const original=f.dp.writeNumber;
  f.dp.writeNumber=async(key,value)=>{ if(key==='st.targetPowerW'&&!resumed){resumed=true;await Promise.resolve();f.setRequest(null);} return original(key,value); };
  await f.controller.tick();
  assert.equal(resumed,true); assert.equal(f.writes.filter(([id])=>id==='battery.target').length,0);
});

test('zwischen Planung und Write verschärfte lokale Leistungssperre bleibt wirksam', async () => {
  const f=setup(); const original=f.dp.writeNumber;
  f.dp.writeNumber=async(key,value)=>{if(key==='st.targetPowerW'){await Promise.resolve();f.adapter._emsCaps={storageChargeLimitW:0};}return original(key,value);};
  await f.controller.tick();
  assert.equal(f.writes.filter(([id])=>id==='battery.target').length,0);
});
