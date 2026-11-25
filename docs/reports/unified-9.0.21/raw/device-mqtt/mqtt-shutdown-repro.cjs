'use strict';
const assert = require('node:assert/strict');
const net = require('node:net');
const { once } = require('node:events');
const { createRequire } = require('node:module');
const req = createRequire(process.env.EOS_TEST_ROOT + '/package.json');
const packets = req('mqtt-packet');
const { MqttDriver } = req('./modules/devices/lib/drivers/mqtt');
async function until(fn) { for(let n=0;n<300;n++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw new Error('wait timeout'); }
(async()=>{
 const sockets=new Set(); const outstanding=[];
 const server=net.createServer(s=>{sockets.add(s);s.on('error',()=>{});s.on('close',()=>sockets.delete(s));const parser=packets.parser();s.on('data',b=>parser.parse(b));parser.on('packet',p=>{
  if(p.cmd==='connect')s.write(packets.generate({cmd:'connack',returnCode:0,sessionPresent:false}));
  if(p.cmd==='publish')outstanding.push({socket:s,id:p.messageId});
  if(p.cmd==='disconnect')s.end();
 });});server.listen(0,'127.0.0.1');await once(server,'listening');
 const adapter={namespace:'eos-admin.0',log:{info(){},warn(){},error(){},debug(){}},async setStateAsync(){}};
 const template={datapoints:[{id:'safe',type:'number',rw:'wo',source:{kind:'mqtt',topic:'control/power',writeGroup:'power'}}],driverHints:{mqtt:{writeGroups:{power:{topic:'control/power',qos:1,safeOnDisconnect:true,safeOnInitialConnect:false,refreshIntervalMs:60000,safeValue:0,fields:{Power:{dpId:'safe'}}}}}}};
 const driver=new MqttDriver(adapter,{id:'stop-repro',connection:{url:`mqtt://127.0.0.1:${server.address().port}`,reconnectPeriodMs:0}},template,{},dp=>dp.id,()=>null);
 try{
  await driver.connect();await until(()=>driver.connected&&driver.writeGroupStates.size===1);
  let stopped=false;const stop=driver.disconnect().then(()=>{stopped=true;});
  await new Promise(r=>setTimeout(r,1500));
  const observed={stoppedAfter1500ms:stopped,actualOpenSockets:sockets.size,safePublishes:outstanding.length};
  console.log(JSON.stringify(observed));
  // Release the deliberate missing-PUBACK fault only after recording the result.
  for(const p of outstanding) if(!p.socket.destroyed)p.socket.write(packets.generate({cmd:'puback',messageId:p.id}));
  await stop;
  assert.equal(observed.stoppedAfter1500ms,true,'missing safe-command PUBACK must not block stop indefinitely');
 }finally{await driver.disconnect();for(const s of sockets)s.destroy();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
