'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { RPCClient } = require('ocpp-rpc');
const { createHostedModule, validateConfig, preflightLegacyConfig } = require('../index');

async function port() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const value = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return value;
}
async function until(read, check, ms = 7000) {
  const deadline = Date.now() + ms;
  let value;
  while (Date.now() < deadline) {
    value = await read();
    if (check(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 15));
  }
  throw new Error(`Condition timed out: ${JSON.stringify(value)}`);
}
function fixture(namespace = 'eos-admin.0.ocpp') {
  const states = new Map(), objects = new Map(), logs = [];
  let authorized = true, epoch = 1;
  const adapter = {
    namespace, instance: 0,
    log: Object.fromEntries(['warn','info','error','debug'].map(level => [level, message => logs.push({ level, message })])),
    async getStateAsync(id) { return states.get(id) || null; },
    async getStatesAsync(pattern) {
      const match = new RegExp('^' + pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
      return Object.fromEntries([...states].filter(([id]) => match.test(id)));
    },
    async getObjectAsync(id) { return objects.get(id) || null; },
    async getObjectViewAsync(_design, _search, options) {
      return { rows: [...objects].filter(([id]) => `${namespace}.${id}` >= options.startkey && `${namespace}.${id}` <= options.endkey).map(([id,value]) => ({ id: `${namespace}.${id}`, value })) };
    },
    async setObjectNotExistsAsync(id, obj) {
      if (!objects.has(id)) {
        objects.set(id, structuredClone(obj));
        if (obj.common?.def !== undefined && !states.has(id)) states.set(id, { val: obj.common.def, ack: true, ts: Date.now(), q: 0 });
      }
    },
    async extendObjectAsync(id, patch) {
      const previous = objects.get(id) || {};
      objects.set(id, { ...previous, ...patch, native: { ...previous.native, ...patch.native }, common: { ...previous.common, ...patch.common } });
    },
    async setStateAsync(id, state) { states.set(id, { ...state, ts: Date.now(), q: 0 }); },
    async setStateChangedAsync(id, state) { return this.setStateAsync(id, state); },
    async subscribeStatesAsync() {}, async unsubscribeStatesAsync() {}, async delObjectAsync(id) { objects.delete(id); },
  };
  return { adapter, states, objects, logs, canOperate: () => authorized, getAuthorityGeneration: () => epoch,
    revoke() { authorized = false; epoch++; }, grant() { authorized = true; } };
}
async function startStation(t, protocol = 'ocpp1.6', namespace) {
  const f = fixture(namespace), listenerPort = await port();
  const module = createHostedModule({ ...f, config: { enabled: true, port: listenerPort, activeRefresh: false, smartChargingMinIntervalMs: 1000 } });
  const client = new RPCClient({ endpoint: `ws://127.0.0.1:${listenerPort}`, identity: 'cp', protocols: [protocol], strictMode: false, reconnect: false });
  const limits = [];
  client.handle('SetChargingProfile', ({ params }) => {
    limits.push(protocol === 'ocpp1.6' ? params.csChargingProfiles.chargingSchedule.chargingSchedulePeriod[0].limit : params.chargingProfile.chargingSchedule[0].chargingSchedulePeriod[0].limit);
    return { status: 'Accepted' };
  });
  t.after(async () => { await client.close({ force: true }).catch(() => {}); await module.stop(); });
  await module.start();
  await client.connect();
  const boot = await client.call('BootNotification', protocol === 'ocpp1.6' ? { chargePointVendor: 'Test', chargePointModel: 'Loopback' } : { chargingStation: { vendorName: 'Test', model: 'Loopback' }, reason: 'PowerUp' });
  assert.equal(boot.status, 'Accepted');
  await until(() => f.states.get('cp.info.sessionId'), state => typeof state?.val === 'string' && state.val.length > 16);
  const write = async (id, val) => {
    const state = { val, ack: false, ts: Date.now(), q: 0 };
    f.states.set(id, state);
    await module.onStateChange(`${f.adapter.namespace}.${id}`, state);
  };
  return { ...f, module, client, limits, write, port: listenerPort };
}

test('hosted config preserves native defaults and rejects unsafe or unsupported migration settings', async () => {
  assert.equal(validateConfig({}).enabled, false);
  assert.equal(validateConfig({}).maximumPhaseVoltageV, 253);
  assert.equal(validateConfig({ zeroLimitBehavior: 'keepLast' }).zeroLimitBehavior, 'keepLast');
  for (const config of [{ port: 80 }, { port: '9220' }, { enabled: true, enable16: false, enable201: false, enable21: false }, { identityAllowlist: ['bad/name'] }]) assert.throws(() => validateConfig(config), /EOS_OCPP_CONFIG/);
  await assert.rejects(preflightLegacyConfig({ tls: true }, { sourceVersion: '0.4.3' }), /TRANSPORT_REVIEW_REQUIRED/);
  await assert.rejects(preflightLegacyConfig({}, { sourceVersion: '0.1.0' }), /LEGACY_VERSION/);
});
for (const protocol of ['ocpp1.6','ocpp2.0.1','ocpp2.1']) {
  test(`actual hosted ${protocol} station keeps W profile, atomic feedback and separate child-alive contract`, async t => {
    const f = await startStation(t, protocol);
    assert.equal(f.states.get('info.eosHostedRuntime').val, true);
    assert.equal(f.states.get('info.runtimeAlive').val, true);
    assert.equal(f.objects.get('cp').native.controlScope, 'station');
    await f.write('cp.control.chargeLimit', 4200);
    await f.write('cp.control.chargeLimit', 0);
    assert.deepEqual(f.limits, [4200, 0]);
    const status = JSON.parse(f.states.get('cp.control.chargeLimitStatus').val);
    assert.equal(status.valid, true);
    assert.equal(status.appliedW, 0);
    assert.equal(status.sessionId, f.states.get('cp.info.sessionId').val);
    assert.equal(f.module.getStatus().stations.length, 1);
    await f.module.stop();
    assert.equal(f.states.get('info.runtimeAlive').val, false);
  });
}
test('legacy namespace retains native station IDs and needs no separate adapter instance', async t => {
  const f = await startStation(t, 'ocpp1.6', 'ocpp21.2');
  assert.equal(f.module.getStatus().namespace, 'ocpp21.2');
  await f.write('cp.control.chargeLimit', 0);
  assert.equal(f.limits.at(-1), 0);
});
test('hosted EOS lease expires independently and actual station confirms zero without automatic resume', async t => {
  const f = await startStation(t);
  await f.write('cp.control.eosLeaseUntilMs', Date.now() + 1200);
  await f.write('cp.control.chargeLimit', 4200);
  await until(() => f.states.get('cp.control.eosLeaseState'), state => state?.val === 'expired-zero-confirmed');
  assert.deepEqual(f.limits, [4200, 0]);
  assert.equal(JSON.parse(f.states.get('cp.control.chargeLimitStatus').val).valid, false);
  await f.write('cp.control.eosLeaseUntilMs', Date.now() + 15000);
  assert.deepEqual(f.limits, [4200, 0]);
});
test('listener bind failure rejects module startup without crashing or affecting another listener', async t => {
  const f = await startStation(t);
  const secondFixture = fixture('eos-admin.1.ocpp');
  const second = createHostedModule({ ...secondFixture, config: { enabled: true, port: f.port } });
  t.after(() => second.stop());
  await assert.rejects(second.start(), /EOS_OCPP_START_FAILED/);
  assert.equal(f.module.getStatus().started, true);
  assert.equal(typeof (await f.client.call('Heartbeat', {})).currentTime, 'string');
});
test('unavailable authority never starts a socket and revocation closes an existing station', async t => {
  const f = await startStation(t);
  f.revoke();
  await until(() => f.module.getStatus().state, state => state === 'stopped');
  f.grant();
  await assert.rejects(f.write('cp.control.chargeLimit', 4200), /REVOKED/);
  assert.deepEqual(f.limits, []);
});
test('immediate revoke and regrant cannot replay a positive command waiting for a configuration read', async t => {
  const f = await startStation(t);
  const original = f.adapter.getStateAsync;
  let entered = false, release;
  const wait = new Promise(resolve => { release = resolve; });
  f.adapter.getStateAsync = async id => { if (id === 'cp.control.chargeLimitType') { entered = true; await wait; } return original(id); };
  const writing = f.write('cp.control.chargeLimit', 4200);
  const rejected = assert.rejects(writing, /REVOKED|HOST/);
  await until(() => entered, Boolean);
  f.revoke(); f.grant(); release();
  await rejected;
  assert.deepEqual(f.limits, []);
});

test('hosted status never labels an inactive open idle station as fresh', async t => {
  const f = await startStation(t);
  await f.client.call('StatusNotification', { connectorId: 1, status: 'Available', errorCode: 'NoError' });
  await until(() => f.module.getStatus().stations[0]?.dataFresh, Boolean);
  const originalNow = Date.now;
  const later = originalNow() + 751000;
  Date.now = () => later;
  try {
    const station = f.module.getStatus().stations[0];
    assert.equal(station.connected, true);
    assert.equal(station.dataFresh, false);
  } finally { Date.now = originalNow; }
});

test('dashboard health follows proven OCPP sessions, preserves identity privately and clears after a confirmed reconnect', async t => {
  const f = fixture(), listenerPort = await port();
  const hosted = createHostedModule({...f, config:{enabled:true,port:listenerPort,activeRefresh:false}});
  const disabled = createHostedModule({...f, config:{enabled:false}});
  const empty = {state:'ok',offline:[],totalOffline:0,tracked:[],complete:false};
  assert.deepEqual(disabled.getDashboardDeviceHealth(),{...empty,complete:true});
  assert.deepEqual(hosted.getDashboardDeviceHealth(),{...empty,state:'unknown'});
  const identity = 'secret-serial-888264902', clients = [];
  const connect = async () => {
    const client = new RPCClient({endpoint:'ws://127.0.0.1:'+listenerPort,identity,protocols:['ocpp1.6'],reconnect:false});
    clients.push(client);
    await client.connect();
    return client;
  };
  t.after(async () => {
    await Promise.all(clients.map(c => c.close({force:true}).catch(()=>{})));
    await hosted.stop();
  });
  await hosted.start();
  assert.deepEqual(hosted.getDashboardDeviceHealth(),empty);
  const measure = () => hosted.getDashboardDeviceHealth();
  const waitState = state => until(measure,result => result.tracked[0]?.state === state);
  const first = await connect();
  const pending = await waitState('unknown');
  assert.equal(pending.state,'unknown');
  assert.equal(pending.totalOffline,0);
  await first.close({force:true});
  await until(measure,result => !result.tracked.length);
  assert.deepEqual(measure(),empty);

  const station = await connect();
  const boot = await station.call('BootNotification',{chargePointVendor:'Test',chargePointModel:'Local station'});
  assert.equal(boot.status,'Accepted');
  await station.call('StatusNotification',{connectorId:1,status:'Available',errorCode:'NoError'});
  const online = await waitState('online');
  const key = require('node:crypto').createHash('sha256').update(identity).digest('hex');
  assert.deepEqual(online,{...empty,tracked:[{key,name:'Ladestation 1',state:'online'}]});
  const systemNow = Date.now;
  try {
    const later = systemNow() + 751000;
    Date.now = () => later;
    assert.equal(measure().state,'fault','the native activity window also covers a silent open socket');
  } finally { Date.now = systemNow; }
  await station.close({force:true});
  const offline = await waitState('offline');
  assert.deepEqual(offline,{state:'fault',complete:false,offline:[{name:'Ladestation 1'}],totalOffline:1,tracked:[{key,name:'Ladestation 1',state:'offline'}]});
  assert.doesNotMatch(JSON.stringify(offline),/secret-serial|888264902|127\.0\.0\.1/);
  const reconnecting = await connect();
  await waitState('unknown');
  await reconnecting.close({force:true});
  await waitState('offline');
  const final = await connect();
  await final.call('Heartbeat',{});
  assert.deepEqual(await waitState('online'),online,'an accepted heartbeat confirms an existing station after reconnection');
  f.revoke();
  assert.deepEqual(measure(),{...empty,state:'unknown'});
});

test('dashboard reports the offline count and at most twelve synthetic station names',async t => {
  const f = fixture(),listenerPort = await port();
  const identityAllowlist = Array.from({length:13},(_,i) => 'private-address-'+i);
  const hosted = createHostedModule({...f,config:{enabled:true,port:listenerPort,activeRefresh:false,identityAllowlist}});
  t.after(()=>hosted.stop());
  await hosted.start();
  assert.equal(hosted.getDashboardDeviceHealth().complete,false);
  for(let i=0;i<13;i++){
    const client = new RPCClient({endpoint:'ws://127.0.0.1:'+listenerPort,identity:'private-address-'+i,protocols:['ocpp1.6'],reconnect:false});
    try {
      await client.connect();
      await client.call('Heartbeat',{});
    } finally { await client.close({force:true}); }
  }
  const summary=await until(()=>hosted.getDashboardDeviceHealth(),v=>v.totalOffline===13);
  assert.equal(summary.state,'fault');
  assert.equal(summary.complete,true,'every identity on the closed admission list has been confirmed');
  assert.equal(summary.offline.length,12);
  assert.equal(summary.tracked.length,13);
  assert.deepEqual(summary.offline[11],{name:'Ladestation 12'});
  assert.equal(new Set(summary.tracked.map(x=>x.key)).size,13);
  assert.doesNotMatch(JSON.stringify(summary),/private-address/);
});

test('known stations survive worker replacement with the same native states; inactive admission entries and a bare socket are never promoted', async t => {
  const f = fixture(), identity='Garage West', listenerPort=await port();
  const config={enabled:true,port:listenerPort,activeRefresh:false,identityAllowlist:[identity,'Future Spare'],heartbeatIntervalSec:10,activityTimeoutSec:90};
  const boot = async () => {
    const hosted=createHostedModule({...f,config});
    t.after(()=>hosted.stop()); await hosted.start(); return hosted;
  };
  const socket=async () => {
    const client=new RPCClient({endpoint:'ws://127.0.0.1:'+listenerPort,identity,protocols:['ocpp1.6'],reconnect:false});
    t.after(()=>client.close({force:true}).catch(()=>{}));
    await client.connect();return client;
  };
  const original=await boot();
  await until(()=>original.getDashboardDeviceHealth(),r=>r.state==='ok'&&!r.tracked.length);
  const client=await socket();
  await client.call('Heartbeat',{});
  await until(()=>original.getDashboardDeviceHealth(),r=>r.tracked[0]?.state==='online');
  await until(()=>[...f.states.keys()],ids=>ids.some(k=>k.endsWith('.health.dashboardConfirmedKey')&&
    /^[a-f0-9]{64}$/.test(String(f.states.get(k).val))));
  await client.close({force:true});
  const firstLost=await until(()=>original.getDashboardDeviceHealth(),r=>r.totalOffline===1);
  await original.stop();
  const reloaded=await boot();
  const waiting=await until(()=>reloaded.getDashboardDeviceHealth(),r=>r.tracked[0]?.key===firstLost.tracked[0].key);
  assert.notEqual(waiting.state,'ok');assert.equal(waiting.tracked.length,1);
  const dt=Date.now;
  try {const afterWindow=dt()+91000;Date.now=()=>afterWindow;
    assert.deepEqual(reloaded.getDashboardDeviceHealth().offline,[{name:'Ladestation 1'}]);
  } finally {Date.now=dt;}
  const replacement=await socket();
  assert.equal((await until(()=>reloaded.getDashboardDeviceHealth(),r=>r.tracked[0]?.state==='unknown')).state,'unknown');
  await replacement.call('BootNotification',{chargePointModel:'Local',chargePointVendor:'Fixture'});
  const online=await until(()=>reloaded.getDashboardDeviceHealth(),r=>r.tracked[0]?.state==='online');
  assert.equal(online.totalOffline,0);assert.equal(online.tracked[0].key,firstLost.tracked[0].key);
});

test('legacy ocpp21 namespace restores acknowledged Boot evidence and prior physical disconnect, rejects defaults, bad quality and handshakes', async t=>{
  const ns='ocpp21.3',f=fixture(ns),listenerPort=await port();
  const add=(id,val,q=0)=>f.states.set(ns+'.'+id,{val,ack:true,q,ts:Date.now()});
  add('Primary.info.identity','Raw With Space');
  add('Primary.info.heartbeatInterval',300);add('Primary.health.staleReason','socket-disconnected');add('Primary.health.online',false);
  add('Never.info.identity','Whitelist Only');add('Never.info.heartbeatInterval',0);add('Never.health.online',false);
  add('Bad.info.identity','Bad device');add('Bad.health.lastBoot',new Date().toISOString(),32);
  add('Opening.info.identity','Websocket only');add('Opening.health.lastSeenMs',Date.now());
  const hosted=createHostedModule({...f,config:{enabled:true,port:listenerPort,activeRefresh:false}});
  t.after(()=>hosted.stop());await hosted.start();
  const health=await until(()=>hosted.getDashboardDeviceHealth(),r=>r.totalOffline===1);
  assert.equal(health.tracked.length,1);assert.equal(health.tracked[0].key,require('node:crypto').createHash('sha256').update('Raw With Space').digest('hex'));
  assert.doesNotMatch(JSON.stringify(health),/With Space|Primary|ocpp21/);
});

test('an unavailable historical inventory does not prevent the port from accepting stations and cannot declare all devices healthy',async t=>{
  const f=fixture(),listenerPort=await port();
  f.adapter.getStatesAsync=async()=>{throw Error('controller unavailable')};
  const hosted=createHostedModule({...f,config:{enabled:true,port:listenerPort}});
  t.after(()=>hosted.stop());await hosted.start();
  assert.equal(hosted.getStatus().started,true);assert.equal(hosted.getDashboardDeviceHealth().state,'unknown');
  assert.equal(hosted.getDashboardDeviceHealth().complete,false);
});

test('deferred history does not delay the WebSocket listener and is neutral until loaded',async t=>{
  const f=fixture(), read=f.adapter.getStatesAsync,listenerPort=await port();
  let resume,waiting=true;const blocked=new Promise(resolve=>{resume=resolve;});
  f.adapter.getStatesAsync=async pattern=>{
    if(pattern==='*.health.dashboardConfirmedKey' && waiting) await blocked;
    return read(pattern);
  };
  const hosted=createHostedModule({...f,config:{enabled:true,port:listenerPort,activeRefresh:false}});
  t.after(async()=>{waiting=false;resume();await hosted.stop();});
  await hosted.start();assert.equal(hosted.getDashboardDeviceHealth().state,'unknown');
  const client=new RPCClient({endpoint:'ws://127.0.0.1:'+listenerPort,identity:'Live',protocols:['ocpp1.6'],reconnect:false});
  try {
    await client.connect();
    await client.call('Heartbeat',{});
    await until(()=>hosted.getDashboardDeviceHealth(),r=>r.tracked[0]?.state==='online');
    waiting=false;resume();await until(()=>hosted.getDashboardDeviceHealth(),r=>r.state==='ok');
  } finally {await client.close({force:true});}
});
