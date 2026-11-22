/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const runtime = path.join(root, 'ems/services/charging-management-audit.js');
let audit;
if (process.argv.includes('--canonical')) {
  const filename = path.join(root, 'src-ts/runtime-executables/ems/services/charging-management-audit.ts');
  const m = new Module(runtime, module); m.filename = runtime; m.paths = Module._nodeModulePaths(path.dirname(runtime));
  m._compile(Module.stripTypeScriptTypes(fs.readFileSync(filename, 'utf8')), runtime);
  audit = m.exports;
} else audit = require(runtime);
const base = {safe:'lp1', userMode:'auto', effectiveMode:'pv', connected:true, vehicleDemandConfirmed:false, online:true, enabled:true, targetW:0, applyStatus:'applied'};
function snapshot(overrides = {}) { return audit.buildChargingAuditSnapshot({wallboxes:[{...base,...overrides}]}); }
const positive = snapshot({userMode:'boost',effectiveMode:'boost',targetW:11000,rawTargetW:11000,reason:'safety-approved'});
assert.equal(positive.wallboxes[0].targetPowerW,11000);
assert.equal(positive.wallboxes[0].limiter,'none','positive Boost target must not be labelled demand-blocked');
assert.equal(snapshot().wallboxes[0].limiter,'no-charge-demand','zero target with unconfirmed demand stays informational');
assert.equal(snapshot({applyStatus:'write_failed:no-readback'}).wallboxes[0].limiter,'write-error','write failure must not be hidden by no-charge-demand');
assert.equal(snapshot({reason:'NO_SETPOINT'}).wallboxes[0].limiter,'no-setpoint');
assert.equal(snapshot({faultActive:true,targetW:11000}).wallboxes[0].limiter,'fault');
assert.equal(snapshot({safetyBinding:'grid',targetW:11000}).wallboxes[0].limiter,'grid-import');
assert.equal(audit.deriveChargingAuditLimiter({...base,targetW:11000}),'none','legacy callers remain supported');
const previous=snapshot({userMode:'pv'}), current=snapshot({userMode:'auto'});
assert.notEqual(audit.chargingAuditEventSignature(previous),audit.chargingAuditEventSignature(current),'user-mode-only changes must be logged');
const events = audit.buildChargingAuditEvents(previous,current,{now:1700000000000});
const event=events.find(e=>e.safe==='lp1');
assert.ok(event,'mode change creates an event');
assert.equal(event.userMode,'auto'); assert.equal(event.mode,'pv');
assert.equal(event.connected,true); assert.equal(event.vehicleDemandConfirmed,false);
for (const field of ['statusEffective','vehicleDemandReason']) {
  const next = snapshot({[field]:'Changed'});
  assert.notEqual(audit.chargingAuditEventSignature(snapshot()),audit.chargingAuditEventSignature(next));
  const changed = audit.buildChargingAuditEvents(snapshot(),next).find(e=>e.safe==='lp1');
  assert.equal(changed[field],'Changed','status/reason-only changes must survive export');
}
console.log(JSON.stringify({passed:true,scope:'Audit service, real snapshot and event functions; no hardware or browser test',checks:16},null,2));
