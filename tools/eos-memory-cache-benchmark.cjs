#!/usr/bin/env node
'use strict';
/** Isolated synthetic UI snapshot benchmark; no customer data or control writes. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
if (process.argv[2] !== '--sample') {
    const index = process.argv.indexOf('--baseline');
    if (index < 0 || !process.argv[index + 1]) throw new Error('Usage: node tools/eos-memory-cache-benchmark.cjs --baseline /path/to/9.0.6/ui/src-ts/runtime-executables/main.ts');
    const baseline = path.resolve(process.argv[index + 1]);
    const current = path.join(root, 'ui/src-ts/runtime-executables/main.ts');
    const samples = [];
    for (let attempt = 1; attempt <= 3; attempt++) for (const [mode, file] of [['baseline', baseline], ['candidate', current]]) {
        const result = spawnSync(process.execPath, ['--expose-gc', __filename, '--sample', mode, file], { cwd: root, encoding: 'utf8', timeout: 60000 });
        if (result.status !== 0) throw new Error(result.stderr || result.stdout);
        samples.push({ attempt, ...JSON.parse(result.stdout) });
    }
    const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const summarize = mode => Object.fromEntries(['loadedHeapBytes', 'idleHeapBytes', 'loadMs', 'cachedReadMs', 'reads'].map(key => [key, median(samples.filter(s => s.mode === mode).map(s => s[key]))]));
    const before = summarize('baseline'); const after = summarize('candidate');
    console.log(JSON.stringify({ scope: 'Synthetic 25,000-object UI discovery snapshot; not device RSS or complete adapter', node: process.version, platform: process.platform, arch: process.arch, baseline: before, candidate: after, idleRetainedHeapReductionBytes: before.idleHeapBytes - after.idleHeapBytes, samples }, null, 2));
} else {
    const mode = process.argv[3]; const file = process.argv[4];
    const { ExpiringSnapshot } = require('../test/fixtures/load-ephemeral-cache.cjs');
    let now = 0; const timers = new Map();
    const clock = { now: () => now,
        schedule: (fn, ms) => { const token = {}; timers.set(token, { at: now + ms, fn }); return token; },
        cancel: token => timers.delete(token) };
    class Snapshot extends ExpiringSnapshot { constructor(load, ttl) { super(load, ttl, clock); } }
    const source = fs.readFileSync(file, 'utf8');
    const start = source.indexOf('const nwShcfgTdGetObjectsCache = async (force = false) => {');
    if (start < 0) throw new Error('Expected canonical discovery wrapper');
    const wrapper = source.slice(start, source.indexOf('\n};', start) + 3);
    let reads = 0;
    const runtime = { getForeignObjectsAsync: async () => {
        reads++;
        const result = {};
        for (let i = 0; i < 25000; i++) {
            const id = `fixture.0.devices.device${String(i).padStart(5, '0')}.power`;
            result[id] = { _id: id, type: 'state', common: { name: `Fixture ${i}`, type: 'number', role: 'value.power', unit: 'W', read: true, write: false }, native: { metadata: `${i}:` + 'x'.repeat(1536) } };
        }
        // Simulate independently parsed objects returned by the database connection.
        return JSON.parse(JSON.stringify(result));
    } };
    const get = vm.runInNewContext(`(function() { ${wrapper}; return nwShcfgTdGetObjectsCache; })`, { ExpiringSnapshot: Snapshot }).call(runtime);
    const sample = () => { for (let i = 0; i < 5; i++) global.gc(); return process.memoryUsage().heapUsed; };
    (async () => {
        // Let transient compilation/VM setup frames retire before taking the baseline.
        await new Promise(resolve => setImmediate(resolve));
        const before = sample();
        const started = performance.now(); await get(); const loadMs = performance.now() - started;
        const loadedHeapBytes = sample() - before;
        const cachedStart = performance.now(); for (let i = 0; i < 1000; i++) await get();
        const cachedReadMs = (performance.now() - cachedStart) / 1000;
        // Trigger only the candidate's monotonic idle expiry. The baseline has no cleanup timer.
        now = 30001;
        for (const [token, entry] of timers) if (entry.at <= now) { timers.delete(token); entry.fn(); }
        await new Promise(resolve => setImmediate(resolve));
        const idleHeapBytes = sample() - before;
        console.log(JSON.stringify({ mode, loadedHeapBytes, idleHeapBytes, loadMs, cachedReadMs, reads }));
        runtime._nwTypeDetectorObjectsCache?.close?.();
    })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
