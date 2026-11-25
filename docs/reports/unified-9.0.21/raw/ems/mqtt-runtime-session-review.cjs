'use strict';
const { createRequire } = require('node:module');
const req = createRequire('/workspace/scratch/741f792566ea/source-921/iobroker.eos-admin/package.json');
const { DeviceRuntime } = req('./modules/devices/lib/deviceRuntime');
const { runMqttMessageSession } = req('./modules/devices/lib/drivers/mqttPendingOperations');
const template = req('./modules/devices/lib/templates.json').templates.find(t => t.id === 'ess.tesvolt.iotGateway.mqttV2');
let release, entered; const held = new Promise(r => { release = r; }); const reached = new Promise(r => { entered = r; });
const writes = []; let first = true; let current = true;
const adapter = { log: { debug() {}, info() {}, warn() {}, error() {} }, async setStateAsync(id, state) {
  if (id.endsWith('.info.connection') && state.val === true && first) { first = false; entered(); await held; }
  writes.push({ id, ...state, oldSessionAlreadyInvalid: !current });
}};
const runtime = new DeviceRuntime(adapter, { id: 'review', category: template.category, protocol: 'mqtt', connection: {} }, template, {});
for (const dp of template.datapoints) runtime.dpById.set(dp.id, dp);
runtime.aliasDefs = runtime._buildAliasDefinitions();
(async () => {
 const old = runMqttMessageSession(() => current, () => runtime._handleMqttSnapshot({aCTIVE_POWER: 12, bATTERY_SOC: 80}, {connected:true}));
 await reached; current=false;
 await runtime._handleMqttConnectionState(false, 'test disconnect');
 const offlineWrites = writes.length;
 release(); await old;
 console.log(JSON.stringify({offlineWrites, writesAfterOffline: writes.slice(offlineWrites)},null,2));
})().catch(e => { console.error(e); process.exitCode=1; });
