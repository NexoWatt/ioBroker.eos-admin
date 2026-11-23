'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { scheduleBackup, nextCronInvocation, backupCronExpression } = require('../build/scheduler');
const { validateConfig } = require('../build/config');

// Expected instants were captured from the former cron-parser4.9.0 iterator.
// These fixtures remain after removing node-schedule and its deprecated parser.
const calendarFixtures = [
    ['spring DST', '0 30 2 * * *', '2026-03-28T23:00:00Z', 'Europe/Berlin',
        ['2026-03-29T01:30:00.000Z', '2026-03-30T00:30:00.000Z', '2026-03-31T00:30:00.000Z']],
    ['autumn DST', '0 30 2 * * *', '2026-10-24T23:00:00Z', 'Europe/Berlin',
        ['2026-10-25T00:30:00.000Z', '2026-10-26T01:30:00.000Z', '2026-10-27T01:30:00.000Z']],
    ['EveryXDays and month boundary', '10 30 1 */3 * *', '2026-11-23T00:00:00Z', 'UTC',
        ['2026-11-25T01:30:10.000Z', '2026-11-28T01:30:10.000Z', '2026-12-01T01:30:10.000Z']],
    ['seconds field', '*/15 * * * * *', '2026-11-23T12:00:00Z', 'UTC',
        ['2026-11-23T12:00:15.000Z', '2026-11-23T12:00:30.000Z', '2026-11-23T12:00:45.000Z']],
    ['five fields and weekday/day OR', '0 0 1 * MON', '2026-11-23T12:00:00Z', 'UTC',
        ['2026-11-30T00:00:00.000Z', '2026-12-01T00:00:00.000Z', '2026-12-07T00:00:00.000Z']],
];
for (const [label, spec, start, zone, expected] of calendarFixtures) {
    test('cron5 retains cron4 backup times: ' + label, () => {
        let cursor = Date.parse(start);
        assert.deepEqual(expected.map(() => {
            const next = nextCronInvocation(spec, cursor, zone);
            cursor = next.getTime();
            return next.toISOString();
        }), expected);
    });
}
function fakeClock() {
    let now = Date.parse('2026-11-23T12:00:00Z');
    let pending = null;
    let maxPending = 0;
    const clock = {
        now: () => now,
        setTimer(callback, delayMs) {
            assert.equal(pending, null, 'only one live timer per job');
            assert(delayMs >= 1 && delayMs <= 60000);
            const token = { callback, delayMs };
            pending = token;
            maxPending = Math.max(maxPending, 1);
            return () => { if (pending === token) pending = null; };
        },
    };
    return {
        clock,
        at(value) { now = Date.parse(value); },
        tick() { assert(pending); const current = pending; pending = null; current.callback(); },
        get pending() { return pending; },
        get maxPending() { return maxPending; },
    };
}
test('backup timer fires once at deadline, advances, and cancellation clears next run', () => {
    const f = fakeClock(); let count = 0;
    const job = scheduleBackup('*/15 * * * * *', () => { count++; }, assert.fail, f.clock);
    assert.equal(job.nextInvocation().toISOString(), '2026-11-23T12:00:15.000Z');
    const copy = job.nextInvocation(); copy.setFullYear(2000);
    assert.equal(job.nextInvocation().getUTCFullYear(), 2026);
    f.at('2026-11-23T12:00:14Z'); f.tick(); assert.equal(count, 0);
    f.at('2026-11-23T12:00:15Z'); f.tick(); assert.equal(count, 1);
    assert.equal(job.nextInvocation().toISOString(), '2026-11-23T12:00:30.000Z');
    job.cancel(); job.cancel(); assert.equal(f.pending, null); assert.equal(job.nextInvocation(), null);
});
test('stale callback after unload cannot start backup or recreate timer', () => {
    const f = fakeClock(); let count = 0;
    const job = scheduleBackup('* * * * * *', () => { count++; }, assert.fail, f.clock);
    const stale = f.pending.callback;
    job.cancel(); f.at('2026-11-23T12:00:05Z'); stale();
    assert.equal(count, 0); assert.equal(f.pending, null);
});
test('clock forward/pause produces one backup, backward jump never repeats a fired instant', () => {
    const f = fakeClock(); let count = 0;
    const job = scheduleBackup('*/15 * * * * *', () => { count++; }, assert.fail, f.clock);
    f.at('2026-11-23T18:00:00Z'); f.tick(); assert.equal(count, 1);
    assert.equal(job.nextInvocation().toISOString(), '2026-11-23T18:00:15.000Z');
    f.at('2026-11-23T12:00:00Z'); f.tick(); assert.equal(count, 1);
    assert.equal(f.maxPending, 1);
    job.cancel();
});
test('sync and async job failures are reported without unhandled rejection or timer loss', async () => {
    for (const handler of [() => { throw Error('private'); }, async () => { throw Error('private'); }]) {
        const f = fakeClock(); const errors = [];
        const job = scheduleBackup('* * * * * *', handler, code => errors.push(code), f.clock);
        f.at('2026-11-23T12:00:01Z'); f.tick();
        await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(errors, ['EOS_BACKUP_SCHEDULE_FAILED']); assert(f.pending);
        job.cancel();
    }
});
test('invalid active cron is rejected during preflight; dormant custom config is preserved', () => {
    assert.throws(() => validateConfig({ enabled: true, iobrokerCron: true, iobrokerCronJob: 'not a cron' }), /SCHEDULE_INVALID/);
    assert.throws(() => validateConfig({ enabled: true, iobrokerCron: 'true' }), /CONFIG_BOOLEAN/);
    const dormant = validateConfig({ enabled: false, iobrokerCron: true, iobrokerCronJob: 'not a cron' });
    assert.equal(dormant.iobrokerCronJob, 'not a cron');
    const defaults = validateConfig({ enabled: true, minimalTime: '03:42', minimalEveryXDays: 3 });
    assert.equal(backupCronExpression(defaults, 'iobroker'), '10 42 3 */3 * *');
});
test('blank, oversized and nonfinite schedule input allocates no timer', () => {
    for (const spec of ['', 'x'.repeat(1025), 'invalid']) {
        const f = fakeClock();
        assert.throws(() => scheduleBackup(spec, assert.fail, assert.fail, f.clock), /SCHEDULE_INVALID/);
        assert.equal(f.pending, null);
    }
    assert.throws(() => nextCronInvocation('* * * * *', NaN), /SCHEDULE_INVALID/);
});
