'use strict';
/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
/** Numeric-only, isolated cache allocation profile. No heap dumps, user states,
 * licensing material, controller writes or external connections are collected.
 * Run: node --expose-gc ui/test/unified/profile-datapoint-cache.cjs [module path]
 * This is a synthetic component comparison, not the adapter/device RSS baseline. */
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const modulePath = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '../../ems/datapoints.js');
const { DatapointRegistry } = require(modulePath);
if (typeof global.gc !== 'function') throw new Error('Run this isolated fixture with --expose-gc');
const foreignCount = 50000;
const mappings = 256;
function memory() {
  global.gc();
  const { rss, heapUsed, heapTotal, external, arrayBuffers } = process.memoryUsage();
  return { rss, heapUsed, heapTotal, external, arrayBuffers };
}
(async () => {
  const registry = new DatapointRegistry({ log: { warn() {} },
    async getForeignStateAsync() { return null; },
    async getForeignObjectAsync() { return null; },
    async subscribeForeignStatesAsync() {},
  }, []);
  for (let i = 0; i < mappings; i++) {
    const id = `meter.0.devices.fixture${i}.power`;
    await registry.upsert({ key: `power${i}`, objectId: id, useAliveForStale: i % 16 === 0 });
    registry.handleStateChange(id, { val: i, ts: Date.now(), lc: Date.now(), ack: true });
  }
  const before = memory();
  const started = process.hrtime.bigint();
  for (let i = 0; i < foreignCount; i++) {
    // 90% numerical states; 10% unique, flattened 2-KiB textual states.
    const val = i % 10 === 0 ? Buffer.alloc(2048, 65 + (i % 26)).toString('utf8') : i;
    registry.handleStateChange(`foreign.0.unmapped${i}`, { val, ts: Date.now(), lc: Date.now(), ack: true });
  }
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  const after = memory();
  const delta = Object.fromEntries(Object.keys(after).map(key => [key, after[key] - before[key]]));
  console.log(JSON.stringify({ schema: 1, node: process.version,
    sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(modulePath)).digest('hex'),
    scope: 'synthetic DatapointRegistry allocation only; not device RAM or an OOM diagnosis',
    fixture: { mappings, foreignCount, numericPercent: 90, textPercent: 10, textBytes: 2048 },
    retainedEntries: registry.cacheByObjectId.size, lastMappedValue: registry.getNumber('power255'),
    before, after, delta, elapsedMs }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
