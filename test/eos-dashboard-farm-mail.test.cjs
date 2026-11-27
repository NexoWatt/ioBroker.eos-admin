'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NotificationMail } = require('../ui/lib/notification-mail');
const { NotificationPolicy } = require('../ui/lib/notification-policy');

const halfHour = 1800000, day = 86400000;
const key = 'set-signed:devices.0.store.ctrl.request.W';
const key2 = 'set-signed:devices-0-store-ctrl-request-W'; // older safeId normalization can collide
function fixture() {
  const x = { now: 1800000000000, rows: [], cfg: [{ key, enabled:true }, { key:key2, enabled:true }],
    active: true, metadata: {}, staleEMS: false, reads: 0, delivered: [], checks: 0 };
  const settings = { notifyEnabled: true, email:'qa@example.test', notifySystem:true, notifyCommunication:true };
  const adapter = {
    namespace:'eos-admin.0', _hostedStartup:{state:'ready'}, config:{}, _notify:{},
    _nwGetStorageFarmRuntimeInfo: () => ({ active:x.active, rows:x.cfg }),
    _sfGetStorageDispatchKey: row => row.key,
    _notifyGetSettingBool: (id, fallback) => settings[id] ?? fallback,
    _notifyGetSettingString: id => settings[id] || '',
    _notifyRefreshWatchedInstances: async () => {},
    _notifyRefreshNwDevicesCache: async () => {},
    _notifySetDebugState: async () => {},
    getStateAsync: async id => {
      if (id === 'ems.core.lastTickStart') return { val:x.staleEMS ? x.now - 120001 : x.now };
      if (id !== 'storageFarm.storagesStatusJson') return null;
      x.reads++;
      return { val:JSON.stringify(x.rows), ts:x.now, q:0, ack:true, ...x.metadata };
    },
  };
  const mail = new NotificationMail(adapter, {now:() => x.now});
  mail.config.enabled = true;
  mail.init = mail.reloadLedger = mail.reloadSmtp = mail.saveLedger = async () => {};
  mail.withDeliveryLock = async fn => fn();
  mail.deliver = async (_to, _subject, _body, batch) => {
    x.delivered.push(...batch);
    mail.policy.complete(batch, x.now, true);
  };
  x.mail = mail; x.adapter = adapter; x.settings = settings; x.now += 31000;
  x.row = (actual, overrides = {}, member = key) => ({dispatchKey:member, name:'Kundenspeicher', state:'online', online:true,
    powerComparison:{v:1,targetW:-1000,measuredW:actual,differenceW:Math.abs(-1000-actual),
      warning:Math.abs(-1000-actual)>200,commandAt:x.now-400,sampledAt:x.now-20,validUntil:x.now+7000},...overrides});
  x.farm = () => [...mail.policy.records].filter(([id]) => id.startsWith('farm-power:'));
  x.check = async (rows, advance = 0) => { x.rows=rows; await mail.tick(); x.checks++; x.now += advance; };
  return x;
}

test('same per-member >200 W evidence and normal system-mail policy, across sign, restart, unresolved samples and stable recovery', async () => {
  const x = fixture();
  for (const actual of [-1000, -1199, -1200, -800]) {
    await x.check([x.row(actual)]);
    assert.equal(x.farm().length, 0);
  }
  await x.check([x.row(-799)], halfHour);
  await x.check([x.row(-799)]);
  const alarms = x.delivered.filter(e => e.id.startsWith('farm-power:'));
  assert.equal(alarms.length,1);
  assert.equal(alarms[0].category,'system'); assert.equal(alarms[0].severity,'warning');
  assert.match(alarms[0].message,/201 W/); assert.ok(!alarms[0].id.includes('devices'));
  x.mail.policy = new NotificationPolicy(x.mail.policy.snapshot());
  await x.check([x.row(-799)]);
  assert.equal(x.delivered.length, 1, 'restart and repeated polls preserve delivery state');
  for (const change of [{q:128},{ack:false},{ts:x.now-30001},{ts:x.now+1},{ts:0},{val:'{}'},{val:'{'}]) {
    x.metadata = change;
    await x.check([x.row(-1000)]);
    assert.equal(x.farm()[0][1].active,true);
    assert.equal(x.farm()[0][1].suppressed,true);
  }
  x.metadata={};
  for (const [actual, flag] of [[-1200,true],[-799,false]]) {
    const corrupt=x.row(actual);
    corrupt.powerComparison.warning=flag;
    await x.check([corrupt]);
    assert.equal(x.farm()[0][1].suppressed,true,'inconsistent threshold flag is unusable');
  }
  // A fresh report can expire after collection, before acquiring the delivery lock.
  x.mail.withDeliveryLock = async fn => { x.now += 7001; return fn(); };
  await x.check([x.row(-1000)]);
  assert.equal(x.farm()[0][1].active,true);
  assert.equal(x.farm()[0][1].suppressed,true);
  x.mail.withDeliveryLock = async fn => fn();
  await x.check([]);
  assert.equal(x.farm()[0][1].active,true,'missing configured member must remain unknown');
  await x.check([x.row(-1000),x.row(-1000)]);
  assert.equal(x.farm()[0][1].suppressed,true,'duplicate identifiers cannot establish recovery');
  const stale=x.row(-1000); stale.powerComparison.validUntil=x.now-1;
  await x.check([stale]);
  assert.equal(x.farm()[0][1].active,true);
  await x.check([x.row(-1200)],300001);
  assert.equal(x.farm()[0][1].active,false);
  // An unconfirmed sample during pending stable recovery suppresses the previous report.
  await x.check([x.row(-1000,{ powerComparison:null })],day);
  assert.equal(x.farm()[0][1].suppressed,true);
  assert.equal(x.delivered.length,1);
  await x.check([x.row(-1200)],300001);
  await x.check([x.row(-1200)]);
  assert.equal(x.delivered.filter(e=>e.kind==='recovery').length,1);
  assert.equal(x.reads,x.checks,'one existing storage state read per mail tick');
});

test('hardware fault or offline takes precedence; deliberate disable, removed member and withdrawn system consent retire silently', async () => {
  const x=fixture();
  const both=() => [x.row(400),x.row(-1500,{},key2)];
  await x.check(both(),halfHour);
  await x.check(both());
  assert.equal(x.farm().length,2);
  assert.equal(x.delivered.length,2);
  await x.check([x.row(400,{dispatchBlockedReasons:['fault_active']}),x.row(-1500,{state:'offline'},key2)]);
  assert.equal(x.farm().every(([,r])=>r.suppressed && r.active),true);
  assert.equal(x.delivered.some(e=>e.severity==='critical' && !e.id.startsWith('farm-power:')),true);
  x.staleEMS=true;
  await x.check(both());
  assert.ok(x.farm().every(([,r])=>r.suppressed));
  x.staleEMS=false;
  x.cfg[0].enabled=false; x.cfg.pop();
  await x.check(both());
  assert.equal(x.farm().length,0);
  assert.equal(x.delivered.some(e=>e.id.startsWith('farm-power:') && e.kind==='recovery'),false);
  x.cfg[0].enabled=true;
  await x.check(both()); assert.equal(x.farm().length,1);
  x.active=false; await x.check(both()); assert.equal(x.farm().length,0);
  x.active=true; await x.check(both()); assert.equal(x.farm().length,1);
  x.settings.notifySystem=false; await x.check(both()); assert.equal(x.farm().length,0);
});

test('upgrading a uniquely identifiable existing hardware incident preserves its last delivery', async () => {
  const x = fixture();
  const faulty = () => x.row(400,{dispatchBlockedReasons:['fault_active']});
  await x.check([faulty()]);
  const known = [...x.mail.policy.records].find(([id])=>id.startsWith('storage:device:'));
  assert.ok(known);
  const [newId, record] = known;
  const oldId = 'storage:' + key.toLowerCase().replace(/[^a-z0-9_]+/g,'_');
  x.mail.policy.records.delete(newId);
  x.mail.policy.records.set(oldId,{...record,meta:{...record.meta,id:oldId}});
  x.mail.policy = new NotificationPolicy(x.mail.policy.snapshot());
  const sent = record.lastSent;
  x.delivered.length=0;
  await x.check([faulty()]);
  assert.equal(x.mail.policy.records.has(oldId),false);
  assert.equal(x.mail.policy.records.get(newId).lastSent,sent);
  assert.equal(x.mail.policy.records.get(newId).alertSent,true);
  assert.deepEqual(x.delivered,[]);
});
