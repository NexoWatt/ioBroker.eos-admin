'use strict';
const test=require('node:test'); const assert=require('node:assert/strict'); const net=require('node:net');
const root='/workspace/scratch/741f792566ea/source-920/iobroker.eos-admin';
const {DeviceRuntime}=require(root+'/modules/devices/lib/deviceRuntime');
const {ModbusDriver}=require(root+'/modules/devices/lib/drivers/modbus');
const {guardDriver}=require(root+'/modules/devices/operation-guard');
const template=require(root+'/modules/devices/lib/templates.json').templates.find(t=>t.id==='ess.solax.SolaXHybridX1X3Ess');
async function fixture(t){
 const requests=[],sockets=new Set(),states=new Map(),objects=new Map(),logs=[],holding={416:4,417:600,418:0,419:600,420:160}; let allowed=true;
 const server=net.createServer(socket=>{ sockets.add(socket);socket.on('close',()=>sockets.delete(socket));let buffered=Buffer.alloc(0);
 socket.on('data',data=>{ buffered=Buffer.concat([buffered,data]);while(buffered.length>=7){const size=6+buffered.readUInt16BE(4);if(buffered.length<size)break;const p=buffered.subarray(0,size);buffered=buffered.subarray(size);const fc=p[7],addr=p.readUInt16BE(8);requests.push({fc,addr,regs:fc===16?Array.from({length:p.readUInt16BE(10)},(_,i)=>p.readUInt16BE(13+2*i)):fc===6?[p.readUInt16BE(10)]:[]});let out;
 if(fc===6){out=Buffer.from(p);}else if(fc===16){out=Buffer.from(p.subarray(0,12));out.writeUInt16BE(6,4);}else if(fc===4||fc===3){const count=p.readUInt16BE(10);out=Buffer.alloc(9+2*count);p.copy(out,0,0,7);out.writeUInt16BE(3+2*count,4);out[7]=fc;out[8]=count*2;const words=fc===3?holding:{28:98,56:64936,57:65535,162:5000,163:0,164:0,165:0};for(let i=0;i<count;i++)out.writeUInt16BE(words[addr+i]||0,9+2*i);}else throw Error('Unexpected function '+fc);socket.write(out);
 }});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const adapter={namespace:'eos-admin.0',log:Object.fromEntries(['debug','info','warn','error'].map(level=>[level,msg=>logs.push({level,msg})])),setObjectNotExistsAsync:async(id,v)=>{if(!objects.has(id))objects.set(id,v);},extendObjectAsync:async(id,v)=>objects.set(id,{...objects.get(id),...v}),getStateAsync:async id=>states.get(id)||null,setStateAsync:async(id,v)=>states.set(id,{...v,ts:Date.now()})};
 const cfg={id:'solax',templateId:template.id,protocol:'modbusTcp',connection:{host:'127.0.0.1',port:server.address().port,unitId:1}};
 const runtime=new DeviceRuntime(adapter,cfg,template,{});await runtime.initObjects();
 const driver=guardDriver(new ModbusDriver(adapter,cfg,template,{}),()=>allowed);runtime.driver=driver;
 t.after(async()=>{await runtime.stop();for(const s of sockets)s.destroy();await new Promise(resolve=>server.close(resolve));});
 return {runtime,driver,states,requests,logs,holding,allow:v=>{allowed=v;}};
}
test('actual SolaX AliasV1 dispatch reaches real loopback Modbus TCP as complete Mode4 block with signed W',async t=>{
 const h=await fixture(t); const alias='devices.solax.aliases.v1.ctrl.powerSetpointW';
 for(const [val,words] of [[600,[4,600,0,600,160]],[-600,[4,64936,65535,600,160]],[0,[4,0,0,600,160]]]){
  await h.runtime.handleStateChange('eos-admin.0.'+alias,{val,ack:false});await h.runtime._flushWriteQueueOnce();
  assert.deepEqual(h.requests.filter(x=>x.fc===16).at(-1),{fc:16,addr:160,regs:words});
  assert.equal(h.states.get(alias).val,val);assert.equal(h.states.get(alias).ack,true);
 }
 assert.equal(h.requests[0].fc,6);assert.equal(h.requests[0].addr,0);
 // Revoke hosted capability after the valid connection; no new control packet or success ack allowed.
 const count=h.requests.length;h.allow(false);await h.runtime.handleStateChange('eos-admin.0.'+alias,{val:700,ack:false});await h.runtime._flushWriteQueueOnce();
 assert.equal(h.requests.length,count);assert.notEqual(h.states.get(alias).val,700);assert.ok(h.logs.some(x=>String(x.msg).includes('EOS_DEVICES_NOT_AUTHORIZED')));
 console.log(JSON.stringify({runtime:process.version,wireBlocks:h.requests.filter(x=>x.fc===16),deniedWritePackets:0}));
});
test('actual read path preserves positive discharge, 98% SoC and valid zero BMS discharge capability',async t=>{
 const h=await fixture(t);const dp=template.datapoints.filter(x=>['sOC','bATTERY_POWER','aLLOWED_CHARGE_POWER','aLLOWED_DISCHARGE_POWER'].includes(x.id));
 const values=await h.driver.readDatapoints(dp);await h.runtime._updateAliases(values,{connected:true});
 assert.equal(values.bATTERY_POWER,600);assert.equal(values.sOC,98);assert.equal(values.aLLOWED_DISCHARGE_POWER,0);
 assert.equal(h.states.get('devices.solax.aliases.v1.r.power').val,600);
 assert.equal(h.states.get('devices.solax.aliases.v1.r.allowedDischargePower').val,0);
 assert.equal(h.runtime.aliasByStateRelId.has('devices.solax.aliases.v1.r.allowDischarge'),false);
 console.log(JSON.stringify({runtime:process.version,measured:values,zeroCapabilityPreserved:true}));
});

test('SolaX readback is a polled register, not the optimistic write acknowledgement; mode remains necessary context',async t=>{
 const h=await fixture(t);const readback='devices.solax.aliases.v1.r.powerSetpointReadbackW';
 await h.runtime.handleStateChange('eos-admin.0.devices.solax.aliases.v1.ctrl.powerSetpointW',{val:700,ack:false});await h.runtime._flushWriteQueueOnce();
 assert.equal(h.states.get('devices.solax.sET_ACTIVE_POWER').val,700,'raw RW object is command-ack optimistic');
 assert.equal(h.states.has(readback),false,'semantic readback never created by write ack');
 const dp=template.datapoints.filter(x=>['sET_CONTROL_MODE','sET_ACTIVE_POWER','vPP_WAIT_TIMEOUT','vPP_NEXT_MOTION'].includes(x.id));
 const values=await h.driver.readDatapoints(dp);await h.runtime._updateAliases(values,{connected:true});
 assert.equal(values.sET_CONTROL_MODE,4);assert.equal(h.states.get(readback).val,600,'readback reflects different actual wire reply');
 h.holding[416]=8;h.holding[417]=1;h.holding[418]=500;
 const otherMode=await h.driver.readDatapoints(dp);await h.runtime._updateAliases(otherMode,{connected:true});
 assert.equal(otherMode.sET_CONTROL_MODE,8);
 assert.equal(h.states.get(readback).val,32768001,'existing profile interprets mode-dependent register words without mode validation');
 console.log(JSON.stringify({runtime:process.version,rawCommandAck:700,actualMode4Readback:600,mode8Interpretation:32768001,interpretationRequiresMode4:true}));
});
