'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { once } = require('node:events');
const { DeviceRuntime } = require('../lib/deviceRuntime');
const { runWithOperationGate } = require('../lib/operationContext');
const templates = require('../lib/templates.json').templates;
const logs = [];
const adapter = { log: Object.fromEntries(['debug', 'info', 'warn', 'error'].map(k => [k, line => logs.push(line)])) };

function device(module, connection, protocol = 'modbusTcp') {
  const template = templates.find(t => t.id === 'heat.ovum.mira.' + module);
  const runtime = new DeviceRuntime(adapter, { id: module, protocol, templateId: template.id, connection }, template, {});
  return { driver: runtime._createDriver(), dp: id => template.datapoints.find(d => d.id === id) };
}

async function endpoint(t) {
  const trace = [], peers = new Set(), state = new Map();
  const listener = net.createServer(socket => {
    peers.add(socket);
    socket.on('close', () => peers.delete(socket));
    let buf = Buffer.alloc(0);
    socket.on('data', incoming => {
      buf = Buffer.concat([buf, incoming]);
      while (buf.length >= 7 && buf.length >= 6 + buf.readUInt16BE(4)) {
        const size = 6 + buf.readUInt16BE(4);
        const frame = buf.subarray(0, size);
        buf = buf.subarray(size);
        const uid = frame[6], fc = frame[7], addr = frame.readUInt16BE(8), arg = frame.readUInt16BE(10);
        const words = fc === 16 ? Array.from({ length: arg }, (_, i) => frame.readUInt16BE(13 + 2*i)) : [];
        trace.push({ uid, fc, addr, arg, words });
        const unit = state.get(uid);
        let reply;
        if (!unit) reply = Buffer.from([fc | 128, 2]);
        else if (fc === 3) {
          const values = addr === 100 && arg === 1 ? [unit.open ? 1 : 0] :
            unit.open ? Array.from({length: arg}, (_, i) => unit.values.get(addr+i) ?? 0) : null;
          if (!values) reply = Buffer.from([fc | 128, 2]);
          else {
            reply = Buffer.alloc(2 + 2*values.length); reply[0] = fc; reply[1] = 2*values.length;
            values.forEach((w,i) => reply.writeUInt16BE(w, 2+2*i));
            unit.onRead?.(addr);
          }
        } else if (fc === 16 && addr === 101) {
          unit.open = words.length === 2 && words[0] === 0xabcd && words[1] === 0x1234;
          reply = frame.subarray(7,12);
        } else if (unit.open && (fc === 16 || fc === 6)) {
          if (!unit.ignore) (fc === 6 ? [arg] : words).forEach((w,i) => unit.values.set(addr+i, w));
          reply = frame.subarray(7,12);
        } else reply = Buffer.from([fc | 128, 3]);
        const resHeader = Buffer.from(frame.subarray(0,7));
        resHeader.writeUInt16BE(reply.length + 1, 4); socket.write(Buffer.concat([resHeader, reply]));
      }
    });
  });
  listener.listen(0,'127.0.0.1'); await once(listener,'listening');
  t.after(async () => { for (const sock of peers) sock.destroy(); await new Promise(r => listener.close(r)); });
  const connection = { host:'127.0.0.1', port:listener.address().port, writePassword:'0xabcd1234', addressOffset:1, wordOrder:'le' };
  return { trace, connection, unit(id, open=false) { const u={open, values:new Map()}; state.set(id,u); return u; } };
}

test('MIRA sends unit-specific login using FC16, reads real WPM power and confirms volatile HSM writes on Modbus TCP', async t => {
  const ep=await endpoint(t);
  const hsm=ep.unit(110), wpm=ep.unit(116);
  const h=device('hsm',ep.connection), w=device('wpm',{...ep.connection,unitId:116});
  t.after(async () => { await h.driver.disconnect(); await w.driver.disconnect(); });
  const bytes=Buffer.alloc(4); bytes.writeFloatBE(2.25);
  wpm.values.set(56021,bytes.readUInt16BE(0)); wpm.values.set(56022,bytes.readUInt16BE(2));
  const meter=w.dp('measurement.electricalPowerW');
  assert.deepEqual(await w.driver.readDatapoints([meter]), {[meter.id]:2250});
  assert.deepEqual(ep.trace.slice(0,3).map(x=>[x.uid,x.fc,x.addr]),[[116,16,101],[116,3,100],[116,3,56021]]);
  assert.deepEqual(ep.trace[0].words,[0xabcd,0x1234]);
  assert.deepEqual(await h.driver.writeDatapoint(h.dp('control.gridPowerW'),-3300),{effectiveValue:-3300});
  assert.deepEqual(ep.trace.slice(-4).map(x=>[x.uid,x.fc,x.addr]),[[110,16,101],[110,3,100],[110,16,55072],[110,3,55072]]);
  assert.deepEqual(ep.trace.at(-2).words,[65535,62236]);
  await h.driver.writeDatapoint(h.dp('control.pvStatus'),1);
  assert.deepEqual(ep.trace.slice(-3).map(x=>[x.fc,x.addr]),[[3,100],[6,55070],[3,55070]]);
  assert.equal(hsm.values.get(55070),1);
  await h.driver.disconnect(); await h.driver.writeDatapoint(h.dp('control.pvStatus'),0);
  assert.deepEqual(ep.trace.slice(-4).map(x=>[x.fc,x.addr]),[[16,101],[3,100],[6,55070],[3,55070]]);
  const before=ep.trace.length;
  for (const v of [3,0.5,null,true,NaN,'2e0']) await assert.rejects(h.driver.writeDatapoint(h.dp('control.pvStatus'),v), /Stellwert/);
  await assert.rejects(h.driver.writeDatapoint(h.dp('control.batterySocPct'),101),/Stellwert/);
  await assert.rejects(h.driver.writeDatapoint(h.dp('control.pvPowerTargetW'),-1), /Stellwert/);
  await assert.rejects(w.driver.writeDatapoint(meter, 0), /gesperrt/);
  assert.equal(ep.trace.length,before);
});

test('MIRA requires each login to be confirmed, rate-limits rejection and suppresses writes after authorization loss or mismatched readback', async t => {
  const ep=await endpoint(t), unit=ep.unit(110);
  const bad=device('hsm',{...ep.connection,writePassword:'9876543'}), no=device('hsm',{...ep.connection,writePassword:''});
  t.after(async()=>{await bad.driver.disconnect(); await no.driver.disconnect();});
  const dp=bad.dp('control.pvStatus');
  await assert.rejects(bad.driver.readDatapoints([dp]),{code:'EOS_MIRA_LOGIN'});
  await assert.rejects(bad.driver.writeDatapoint(dp,1),{code:'EOS_MIRA_LOGIN'});
  assert.equal(ep.trace.filter(x=>x.addr===101).length,1);
  assert.equal(ep.trace.some(x=>x.addr===55070),false);
  assert.equal(logs.some(entry=>String(entry).includes('9876543')),false);
  await assert.rejects(no.driver.writeDatapoint(dp,1),{code:'EOS_MIRA_LOGIN'});
  unit.open=true; unit.ignore=true;
  await assert.rejects(no.driver.writeDatapoint(dp,1),{code:'EOS_MIRA_READBACK'});
  unit.ignore=false;
  let permitted=true;
  unit.onRead = addr => {if(addr===100) permitted=false;};
  const count = ep.trace.filter(x=>x.fc===6).length;
  await assert.rejects(runWithOperationGate(()=>permitted,()=>no.driver.writeDatapoint(dp,1)),{code:'EOS_DEVICES_NOT_AUTHORIZED'});
  assert.equal(ep.trace.filter(x=>x.fc===6).length,count);
});

test('MIRA rejects unsupported units, protocol and malformed codes before any connection', () => {
  for (const [module,uid] of [['wpm',110],['wpm',119],['hsm',111]]) assert.throws(()=>device(module,{unitId:uid}),/Unit-ID/);
  for (const code of ['12x','2147483648','-2147483649','__EOS_SECRET_UNCHANGED__']) {
    assert.throws(()=>device('hsm',{writePassword:code}), {code:'EOS_MIRA_LOGIN'});
  }
  assert.throws(()=>device('hsm',{},'modbusAscii'), /Protokoll/);
});

test('two MIRA RTU units serialize login, write and echo on one shared serial bus', async t => {
  const {acquireBus, releaseBus} = require('../lib/drivers/modbusRtuBus');
  const c={path:'/fixture/ovum-mira-rtu',baudRate:19200,parity:'even',dataBits:8,stopBits:1,writePassword:'0xabcd1234'};
  const { bus, key } = acquireBus(adapter,c);
  const trace=[], grants=new Set(), values=new Map();
  const tick=()=>new Promise(done=>setImmediate(done));
  const port={
    isOpen:false, uid:null,
    connectRTUBuffered(_device, _opts, done) { this.isOpen=true; done(); },
    close(done) { this.isOpen=false; done(); },
    setID(uid) { this.uid=uid; }, setTimeout() {},
    async readHoldingRegisters(addr,len) {
      await tick(); trace.push([this.uid,3,addr]);
      if (addr===100) return {data:[Number(grants.has(this.uid))]};
      return {data:Array.from({length:len},(_,i)=>values.get(addr+i)??0)};
    },
    async writeRegisters(addr,words) {
      await tick(); trace.push([this.uid,16,addr]);
      if (addr===101) {assert.deepEqual(words,[0xabcd,0x1234]); grants.add(this.uid);}
      else words.forEach((w,i)=>values.set(addr+i,w));
    },
  };
  bus.client=port;
  const h=device('hsm',c,'modbusRtu'), w=device('wpm',{...c,unitId:115},'modbusRtu');
  t.after(async()=>{await Promise.all([h.driver.disconnect(),w.driver.disconnect()]); await releaseBus(key);});
  await Promise.all([h.driver.writeDatapoint(h.dp('control.pvPowerTargetW'),3200),
    w.driver.readDatapoints([w.dp('measurement.electricalPowerW')])]);
  const hAt=trace.findIndex(row=>row[0]===110), wAt=trace.findIndex(row=>row[0]===115);
  assert.deepEqual(trace.slice(hAt,hAt+4),[[110,16,101],[110,3,100],[110,16,55076],[110,3,55076]]);
  assert.deepEqual(trace.slice(wAt,wAt+3),[[115,16,101],[115,3,100],[115,3,56021]]);
  assert.equal(h.driver.rtuBus,w.driver.rtuBus);
});

test('MIRA editor keeps unsaved and stored login codes out of JSON export and preview while protected save retains the field', () => {
  const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'../admin/index_m.js'),'utf8');
  const seen={};
  const ctx=vm.createContext({ rows:[{id:'mira',templateId:'heat.ovum.mira.hsm',connection:{writePassword:'-1234567'}}],
    $:selector=>({val:v=>{if(v!==undefined)seen[selector]=v;},text:v=>{seen[selector]=v;}}),
    grab:body=>{seen.export=body;}, protectedSave:body=>{seen.save=body.devices[0].connection.writePassword;} });
  vm.runInContext(source+'\ndevices=rows;updateJsonPreview();downloadTextFile=(_name,text)=>grab(text);exportDevicesJsonToFile();save(protectedSave);',ctx);
  assert.equal(seen.save,'-1234567');
  for (const k of ['#jsonPreview','#devicesJson','export']) assert.equal(JSON.parse(seen[k])[0].connection.writePassword,'__EOS_SECRET_UNCHANGED__');
});
