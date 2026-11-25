'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {StationTelemetry,normalizeEosLimit,shouldSendLimit,scopeKey}=require('../ocpp/eos-contract');
const sample=(val,category='realtime')=>({val,category});
const now=Date.now(), ttl=90000;
test('EOS cap never exceeds requested W; zero is a real limit; DC values not raised',()=>{
  for(const v of [0,50,500,1380,4200,11000])assert.equal(normalizeEosLimit(v,'W',3).effectiveLimit,v);
  assert.equal(normalizeEosLimit(5,'A',1).effectiveLimit,0);
  assert.throws(()=>normalizeEosLimit(null,'W',3)); assert.throws(()=>normalizeEosLimit(-1,'W',3));
  const p=normalizeEosLimit(4000,'W',3);assert.equal(shouldSendLimit(p,normalizeEosLimit(3999,'W',3)),true);assert.equal(shouldSendLimit(p,normalizeEosLimit(4050,'W',3)),false);
});
test('declared two-connector station never treats a partial measurement as total',()=>{
  const t=new StationTelemetry('ocpp1.6',['1:1','1:2']);
  t.meter(1,1,{powerW:sample(4200)},now,now);assert.equal(t.snapshot(now,ttl,ttl).result.powerW,undefined);
  t.meter(1,2,{powerW:sample(3000)},now,now);assert.equal(t.snapshot(now,ttl,ttl).result.powerW.val,7200);
  t.status(1,2,'Available');assert.equal(t.snapshot(now,ttl,ttl).result.powerW.val,4200);
  t.status(1,1,'Available');assert.equal(t.snapshot(now,ttl,ttl).result.powerW.val,0);
});
test('EVSE zero is station total; alternative connectors on one EVSE are not added',()=>{
  const t=new StationTelemetry('ocpp2.0.1',['1:1','1:2','2:1']);assert.equal(scopeKey('ocpp2.1',0,0),'station');
  t.meter(1,0,{powerW:sample(2000)},now,now);t.meter(2,0,{powerW:sample(3000)},now,now);
  assert.equal(t.snapshot(now,ttl,ttl).result.powerW.val,5000);
  t.meter(0,0,{powerW:sample(5100)},now,now);assert.equal(t.snapshot(now,ttl,ttl).result.powerW.val,5100);
  assert.equal(t.snapshot(now+ttl+1,ttl,ttl).result.powerW,undefined);
});
test('per-outlet transaction stop does not stop another charging transaction',()=>{
  const t=new StationTelemetry('ocpp1.6',['1:1','1:2']);
  t.transaction({type:'Start',txId:'a',evseId:1,connectorId:1,chargingState:'Charging'});
  t.transaction({type:'Start',txId:'b',evseId:1,connectorId:2,chargingState:'Charging'});
  t.transaction({type:'Stop',txId:'b',evseId:1,connectorId:2,chargingState:'Idle'});
  assert.equal(t.snapshot(now,ttl,ttl).active,true);
  t.transaction({type:'Stop',txId:'wrong',evseId:1,connectorId:1,chargingState:'Idle'});assert.equal(t.snapshot(now,ttl,ttl).active,true);
});
test('old and repeated source timestamps do not renew samples',()=>{
  const t=new StationTelemetry('ocpp1.6',['1:1']);t.meter(1,1,{powerW:sample(5000)},now,now);
  t.meter(1,1,{powerW:sample(9000)},now+500,now-100);assert.equal(t.snapshot(now+500,ttl,ttl).result.powerW.val,5000);
  t.meter(1,1,{powerW:sample(5000)},now+800,now);assert.equal(t.snapshot(now+800,ttl,ttl).result.powerW.at,now);
});
test('vehicle SOC not assigned to wrong vehicle and clears on Available',()=>{
  const t=new StationTelemetry('ocpp2.1',['1:1']);t.meter(1,0,{socPercent:sample(80,'soc')},now,now);assert.equal(t.snapshot(now,ttl,ttl).result.socPercent.val,80);
  t.status(1,1,'Available');assert.equal(t.snapshot(now,ttl,ttl).result.socPercent,undefined);
  t.status(2,1,'Occupied');t.meter(2,0,{socPercent:sample(40,'soc')},now,now);assert.equal(t.snapshot(now,ttl,ttl).result.socPercent,undefined);
});

test('unknown EVSE invalidates commissioned topology, even with a station meter',()=>{
  const t=new StationTelemetry('ocpp2.1',['1:1']);
  t.meter(0,0,{powerW:sample(4000)},now,now);
  t.meter(2,0,{powerW:sample(2000)},now,now);
  assert.equal(t.snapshot(now,ttl,ttl).result.powerW,undefined);
  assert.equal(t.snapshot(now,ttl,ttl).topologySource,'inventory-mismatch');
});
test('SoC does not leak between different EVSEs',()=>{
  const t=new StationTelemetry('ocpp2.1',['1:1','2:1']);
  t.meter(1,1,{socPercent:sample(70,'soc')},now,now);
  assert.equal(t.snapshot(now,ttl,ttl).result.socPercent,undefined);
});
test('real MeterValues handler normalizes kW and multiplier and rejects old samples',async()=>{
  const {applyMeterValues}=require('../ocpp/common');
  const received=[];
  const ctx={config:{connectorDetails:false},states:{ensureStructure:async()=>{},ensureConnectorStructure:async()=>null,ensureMeasurementState:async(id,k)=>`${id}.measurements.${k}`,ensureTextMeasurementState:async(id,k)=>`${id}.measurements.${k}`},setStateFreshAsync:async()=>{},runtime:{publishScopedMeter:async(...args)=>received.push(args)}};
  const at=new Date().toISOString();
  await applyMeterValues(ctx,'cp',1,0,[{timestamp:at,sampledValue:[{measurand:'Power.Active.Import',value:7.2,unitOfMeasure:{unit:'kW'}},{measurand:'SoC',value:43,unitOfMeasure:{unit:'Percent'}}]}],'ocpp2.1');
  assert.equal(received.length,1);assert.equal(received[0][3].powerW.val,7200);
  await applyMeterValues(ctx,'cp',1,0,[{timestamp:new Date(Date.now()-300000).toISOString(),sampledValue:[{measurand:'Power.Active.Import',value:5,unitOfMeasure:{unit:'kW'}}]}],'ocpp2.1');
  assert.equal(received.length,1);
});
