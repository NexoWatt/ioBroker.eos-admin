// Offline Linux benchmark of the shipped dashboard classifier; no ioBroker, DOM or device I/O.
'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { setImmediate } = require('node:timers/promises');
const { performance } = require('node:perf_hooks');
const path = require('node:path');
async function main() {
  const context = {window:{}};
  vm.runInNewContext(readFileSync(path.join(process.argv[2], 'ui/www/live-display.js'), 'utf8'), context);
  const classify = context.window.NexoWattLiveDisplay.dashboardStatus;
  const healthy = { phase:'healthy' };
  const supervisor = {state:'ok', failed:[], paused:[], deviceHealth:{state:'ok',offline:[],totalOffline:0}};
  const members = Array.from({length:128}, (_, i) => ({dispatchKey:'unit-'+i,name:'Test '+i,online:true}));
  let sampleCount = 0;
  const set = () => {
    for (let i=0; i<500; i++) {
      const now = 1700000000000 + sampleCount++ * 10000;
      supervisor.observedAt = now;
      const measuredW = i % 2 === 0 ? 436 : 435;
      const payload = members.map((row, index) => {
        const measured = index === 127 ? measuredW : 576;
        return {...row, powerComparison:{v:1, targetW:636, measuredW:measured, differenceW:636-measured,
          commandAt:now-2000,sampledAt:now-500,validUntil:now+20000,warning:636-measured>200}};
      });
      const snapshot = { value:JSON.stringify(payload), ts:now, q:0, ack:true };
      const expected = i % 2 ? 'warn' : 'ok';
      for (let repeat=0; repeat<3; repeat++)
        assert.equal(classify(healthy, 'ready', null, false, false, supervisor, now, snapshot).level, expected);
    }
  };
  set();
  await setImmediate(); global.gc();
  const initial = process.memoryUsage().heapUsed;
  const checkpoints = [];
  const start = performance.now();
  for (let i=0;i<6;i++) {
    set(); await setImmediate(); global.gc();
    checkpoints.push(process.memoryUsage().heapUsed);
  }
  console.log(JSON.stringify({node:process.version, platform:process.platform, arch:process.arch,
    scope:'Synthetic 128-member JSON snapshots, alternating 200 W and 201 W on one member. Three real display classifications per snapshot, no DOM, EMS, or I/O.',
    warmupSnapshots:500, measuredSnapshots:3000, renderingDecisions:9000, elapsedMs:Math.round(performance.now()-start),
    initialHeapBytesAfterGC:initial, heapBytesAfterEvery500Snapshots:checkpoints}, null, 2));
}
main().catch(err=>{console.error(err);process.exitCode=1;});
