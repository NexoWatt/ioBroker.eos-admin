'use strict';
const assert = require('node:assert/strict');
const net = require('node:net');
const { once } = require('node:events');
const { createRequire } = require('node:module');
const root = process.env.EOS_TEST_ROOT;
const req = createRequire(root + '/package.json');
const packets = req('mqtt-packet');
const { MqttDriver } = req('./modules/devices/lib/drivers/mqtt');
const { guardDriver } = req('./modules/devices/operation-guard');
async function until(fn) { for (let i = 0; i < 400; i++) { if (fn()) return; await new Promise(r => setTimeout(r, 10)); } throw new Error('condition timeout'); }
(async () => {
 const sockets = new Set(); const publishes = []; let connections = 0; let allowed = true;
 const server = net.createServer(s => {
  sockets.add(s); s.on('error', () => {}); s.on('close', () => sockets.delete(s));
  const parser = packets.parser(); s.on('data', b => parser.parse(b));
  parser.on('packet', p => {
   if (p.cmd === 'connect') { connections++; s.write(packets.generate({cmd:'connack',returnCode:0,sessionPresent:false})); }
   if (p.cmd === 'publish') { publishes.push({payload:p.payload.toString(),connection:connections,authorized:allowed}); if(connections > 1) s.write(packets.generate({cmd:'puback',messageId:p.messageId})); }
   if (p.cmd === 'disconnect') s.end();
  });
 });
 server.listen(0,'127.0.0.1'); await once(server,'listening');
 const adapter = { namespace:'eos-admin.0', log:{info(){},warn(){},debug(){},error(){}}, async setStateAsync(){} };
 const driver = guardDriver(new MqttDriver(adapter,{id:'repro',connection:{url:`mqtt://127.0.0.1:${server.address().port}`,reconnectPeriodMs:50}},{datapoints:[]},{},x=>x.id,()=>null),() => allowed);
 let writeResult;
 try {
  await driver.connect(); await until(() => driver.connected);
  const write = driver.writeDatapoint({id:'setpoint',type:'number',source:{kind:'mqtt',topic:'control/power',qos:1}},681);
  write.then(() => {writeResult='resolved';},e=>{writeResult=e.message;});
  await until(() => publishes.length === 1);
  allowed = false;
  for(const s of sockets) s.destroy();
  await new Promise(r => setTimeout(r,450));
  console.log(JSON.stringify({connections,publishes,writeResult}));
  assert.equal(publishes.filter(p => !p.authorized).length,0,'previous power command must not replay after authorization loss');
 } finally { await driver.disconnect(); for(const s of sockets) s.destroy(); await new Promise(r=>server.close(r)); }
})().catch(e => { console.error(e); process.exitCode=1; });
