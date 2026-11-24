'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');

function loadSource(relative, clock, overrides = {}) {
    const file = path.join(root, 'ui/src-ts/runtime-executables', relative);
    const generated = createRequire(path.join(root, 'ui', relative.replace(/\.ts$/, '.js')));
    const output = { exports: {} };
    class ClockDate extends Date { static now() { return clock.now; } }
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module: output, exports: output.exports,
        require: id => overrides[id] || generated(id), Date: ClockDate, Intl, URL, Buffer, AbortController,
        setTimeout, clearTimeout, fetch, console, process }, { filename: file });
    return output.exports;
}

function tibberPayload(start, next, end, price = i => 0.2 + i / 1000) {
    const rows = (from, to) => Array.from({ length: (to - from) / 900000 }, (_, i) => ({
        startsAt: new Date(from + i * 900000).toISOString(), total: price(i), currency: 'EUR' }));
    return { data: { viewer: { homes: [{ id: 'test-home', currentSubscription: { priceInfo: {
        today: rows(start, next), tomorrow: rows(next, end),
    } } }] } } };
}

test('Tibber requests and normalizes quarter-hours even with an older hourly setting; zero/negative remain valid and null is rejected', () => {
    const clock = { now: Date.parse('2026-11-24T00:00:00+01:00') };
    const registry = loadSource('ems/services/tariff-provider-registry.ts', clock);
    assert.match(registry.buildTibberQuery(60), /resolution: QUARTER_HOURLY/);
    const payload = tibberPayload(clock.now, clock.now + 86400000, clock.now + 2 * 86400000, i => i === 0 ? 0 : -0.03);
    const { intervals } = registry.normalizeTibber(payload, { resolutionMinutes: 60 });
    assert.equal(intervals.length, 192);
    assert.equal(Date.parse(intervals[0].endsAt) - Date.parse(intervals[0].startsAt), 900000);
    assert.equal(registry.currentAndAverage(intervals, clock.now).current, 0);
    assert.equal(registry.currentAndAverage(intervals, clock.now + 900000).current, -0.03);
    payload.data.viewer.homes[0].currentSubscription.priceInfo.today[0].total = null;
    assert.throws(() => registry.normalizeTibber(payload, { resolutionMinutes: 60 }), /provider_prices_invalid/);
});

test('local calendar splitting retains 92/96/100 quarter-hours and the next day across DST boundaries', () => {
    const clock = { now: 0 };
    const registry = loadSource('ems/services/tariff-provider-registry.ts', clock);
    for (const [from, next, end, count] of [
        ['2026-03-29T00:00:00+01:00', '2026-03-30T00:00:00+02:00', '2026-03-31T00:00:00+02:00', 92],
        ['2026-10-25T00:00:00+02:00', '2026-10-26T00:00:00+01:00', '2026-10-27T00:00:00+01:00', 100],
        ['2026-11-24T00:00:00+01:00', '2026-11-25T00:00:00+01:00', '2026-11-26T00:00:00+01:00', 96],
    ]) {
        const start = Date.parse(from), tomorrow = Date.parse(next);
        const { intervals } = registry.normalizeTibber(tibberPayload(start, tomorrow, Date.parse(end)));
        for (const now of [start + 1800000, tomorrow - 1800000]) {
            const result = registry.splitTodayTomorrow(intervals, now, 'Europe/Berlin');
            assert.equal(result.today.length, count, from);
            assert.equal(result.tomorrow.length, 96, from);
            assert.equal(Date.parse(result.tomorrow[0].startsAt), tomorrow, from);
        }
    }
    // The evening before spring-forward must select the short next calendar day,
    // not Monday, which a simple +24h can select from late Saturday evening.
    const start = Date.parse('2026-03-28T00:00:00+01:00');
    const tomorrow = Date.parse('2026-03-29T00:00:00+01:00');
    const { intervals } = registry.normalizeTibber(tibberPayload(start, tomorrow, Date.parse('2026-03-30T00:00:00+02:00')));
    assert.equal(registry.splitTodayTomorrow(intervals, tomorrow - 1800000, 'Europe/Berlin').tomorrow.length, 92);
});

async function providerFixture(t) {
    const start = Date.parse('2026-11-24T00:00:00+01:00');
    const clock = { now: start + 14 * 60000 + 50000 };
    const registry = loadSource('ems/services/tariff-provider-registry.ts', clock);
    const payload = tibberPayload(start, start + 86400000, start + 2 * 86400000, i => i === 1 ? 0 : i === 2 ? -0.04 : 0.21);
    let calls = 0, failure = false;
    const runtime = loadSource('ems/modules/tariff-provider.ts', clock, {
        '../services/tariff-provider-registry': { ...registry, fetchProvider: async config => {
            calls++;
            if (failure) throw new Error('test-provider-unavailable');
            return registry.normalizeTibber(payload, config);
        } },
    });
    const states = new Map();
    const adapter = { namespace: 'eos-admin.0', config: { tariffProvider: { enabled: true, providerId: 'tibber',
        sourceId: 'tibber', resolutionMinutes: 60, refreshMinutes: 360, maxStaleMinutes: 180,
        timeZone: 'Europe/Berlin', activateTariffLogic: false } }, log: { warn() {} },
        async setStateAsync(id, state) { states.set(id, { ...state, ts: clock.now }); },
    };
    const instance = new runtime.TariffProviderModule(adapter, null);
    t.after(() => instance.stop());
    return { instance, adapter, clock, states, calls: () => calls, fail: () => { failure = true; } };
}

test('actual provider tick selects each cached quarter-hour without network calls and refreshes before customer freshness expires', async t => {
    const x = await providerFixture(t);
    await x.instance.tick();
    const fetchedAt = x.clock.now;
    const next = x.instance._nextFetchMs;
    assert.equal(x.instance._configuration.resolutionMinutes, 15);
    assert.equal(x.adapter.config.tariffProvider.resolutionMinutes, 60, 'no persisted settings migration');
    assert.equal(x.adapter.config.tariffProvider.maxStaleMinutes, 180);
    assert.equal(x.states.get('tariffProvider.currentPriceEurPerKwh').val, 0.21);
    x.clock.now += 20000; await x.instance.tick();
    assert.equal(x.states.get('tariffProvider.currentPriceEurPerKwh').val, 0);
    x.clock.now += 900000; await x.instance.tick();
    assert.equal(x.states.get('tariffProvider.currentPriceEurPerKwh').val, -0.04);
    assert.equal(x.calls(), 1, 'changing the current slot reads the existing validated cache');
    assert(next <= fetchedAt + 175 * 60000, 'successful next fetch leaves at least 5 minutes of freshness reserve after jitter');
    x.clock.now = next; await x.instance.tick();
    assert.equal(x.calls(), 2);
    assert.equal(x.states.get('tariffProvider.fresh').val, true);
    assert.equal(x.instance._lastSuccessMs, next);
});

test('provider failures do not extend freshness, do not spin requests and clear expired prices instead of creating zero', async t => {
    const x = await providerFixture(t); await x.instance.tick();
    const success = x.instance._lastSuccessMs;
    x.fail();
    x.clock.now = x.instance._nextFetchMs; await x.instance.tick();
    assert.equal(x.instance._lastSuccessMs, success);
    assert(x.instance._nextFetchMs - x.clock.now >= 60000, 'failure near the deadline has a bounded retry cadence');
    x.clock.now = success + 180 * 60000 + 1; await x.instance.tick();
    assert.equal(x.states.get('tariffProvider.currentPriceEurPerKwh').val, null);
    assert.equal(x.states.get('tariffProvider.averagePriceEurPerKwh').val, null);
    assert.equal(x.states.get('tariffProvider.pricesTodayJson').val, '[]');
    assert.equal(x.states.get('tariffProvider.fresh').val, false);
    assert.equal(x.instance._lastSuccessMs, success);
});

test('other providers retain their resolution and normal jittered cadence, while a shorter customer deadline still bounds refresh', async t => {
    const x = await providerFixture(t);
    x.adapter.config.tariffProvider = { ...x.adapter.config.tariffProvider, providerId: 'energyzero',
        sourceId: 'energyzero', refreshMinutes: 15, maxStaleMinutes: 180, resolutionMinutes: 60 };
    await x.instance.invalidateConfiguration();
    // The upper jitter boundary is deliberately exercised, not the remote API.
    x.instance._stableJitterFactor = () => 1.1;
    await x.instance.tick();
    assert.equal(x.instance._configuration.resolutionMinutes, 60);
    assert.equal(x.instance._nextFetchMs, x.clock.now + 33 * 60000, 'the established 30-minute EnergyZero cadence plus jitter remains unchanged');
    x.adapter.config.tariffProvider = { ...x.adapter.config.tariffProvider, maxStaleMinutes: 30 };
    await x.instance.invalidateConfiguration(); await x.instance.tick();
    assert.equal(x.instance._nextFetchMs, x.clock.now + 27 * 60000);
    assert.equal(x.adapter.config.tariffProvider.maxStaleMinutes, 30);
    assert.equal(x.instance._configuration.resolutionMinutes, 60);
});
