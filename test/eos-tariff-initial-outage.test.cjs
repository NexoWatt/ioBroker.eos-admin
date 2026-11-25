'use strict';
/** Initial provider failure must honor its scheduled retry, including an empty cache. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = process.env.EOS_AUDIT_SOURCE_ROOT || path.resolve(__dirname, '..');
function fixture(t) {
    const clock = { now: Date.parse('2026-11-24T12:00:00Z') };
    const file = path.join(root, 'ui/src-ts/runtime-executables/ems/modules/tariff-provider.ts');
    const localRequire = createRequire(path.join(root, 'ui/ems/modules/tariff-provider.js'));
    const registry = localRequire('../services/tariff-provider-registry');
    const module = { exports: {} };
    let calls = 0, fails = true; let fetchOverride; let beforeWrite = async () => {};
    class ClockDate extends Date { static now() { return clock.now; } }
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
        module, exports: module.exports, Date: ClockDate, Intl, Buffer, console, process, AbortController,
        require(id) {
            if (id !== '../services/tariff-provider-registry') return localRequire(id);
            return { ...registry, fetchProvider: async (_config, signal) => {
                calls++;
                if (fetchOverride) return fetchOverride(signal);
                if (fails) throw new Error('provider_http_503');
                return { intervals: [{ startsAt: new Date(clock.now - 1000).toISOString(),
                    endsAt: new Date(clock.now + 900000).toISOString(), total: -0.05, quality: 'provider' }] };
            } };
        },
    }, { filename: file });
    const states = new Map(); const warnings = [];
    const adapter = { namespace: 'eos-admin.0', config: { tariffProvider: {
        enabled: true, providerId: 'tibber', sourceId: 'tibber', refreshMinutes: 15,
        maxStaleMinutes: 180, timeZone: 'Europe/Berlin', activateTariffLogic: false,
    } }, log: { warn: value => warnings.push(value) },
    async setStateAsync(id, state) { await beforeWrite(id, state); states.set(id, { ...state, ts: clock.now }); } };
    const instance = new module.exports.TariffProviderModule(adapter, null);
    t.after(() => instance.stop());
    return { instance, adapter, states, clock, warnings, calls: () => calls, recover: () => { fails = false; }, fetch: fn => { fetchOverride = fn; }, beforeWrite: fn => { beforeWrite = fn; } };
}
async function tick(x) { await x.instance.tick(); await x.instance._fetchPromise; }

test('921-HIS-001 initial outage respects scheduled retry for 120 successive EMS ticks', async t => {
    const x = fixture(t);
    await tick(x);
    const next = x.instance._nextFetchMs;
    assert.equal(x.calls(), 1);
    assert.ok(next > x.clock.now + 120000);
    for (let i = 0; i < 120; i++) { x.clock.now += 1000; await tick(x); }
    assert.equal(x.calls(), 1, 'empty price cache must not bypass the scheduled outage backoff');
    assert.equal(x.warnings.length, 1, 'one warning per actual failed attempt');
    assert.equal(x.states.get('tariffProvider.currentPriceEurPerKwh').val, null);
    assert.equal(x.states.get('tariffProvider.lastSuccess').val, 0);
    assert.equal(x.states.get('tariffProvider.nextUpdate').val, next);
    assert.equal(x.states.get('tariffProvider.status').val, 'error', 'waiting during retry must not hide the known provider failure');
    x.clock.now = next; await tick(x);
    assert.equal(x.calls(), 2);
    assert.equal(x.states.get('tariffProvider.consecutiveErrors').val, 2);
});
test('921-HIS-001 recovery occurs at retry deadline and an explicit configuration change can retry immediately', async t => {
    const x = fixture(t); await tick(x); x.recover();
    x.clock.now = x.instance._nextFetchMs - 1;
    await tick(x); assert.equal(x.calls(), 1);
    x.clock.now++; await tick(x); assert.equal(x.calls(), 2);
    assert.equal(x.states.get('tariffProvider.currentPriceEurPerKwh').val, -0.05);
    assert.equal(x.states.get('tariffProvider.fresh').val, true);
    assert.equal(x.states.get('tariffProvider.error').val, '');
    assert.equal(x.states.get('tariffProvider.consecutiveErrors').val, 0);
    x.adapter.config.tariffProvider = { ...x.adapter.config.tariffProvider, credentials: { accessToken: 'synthetic-replaced-token' } };
    await x.instance.invalidateConfiguration(); await tick(x);
    assert.equal(x.calls(), 3);
    assert.equal(x.states.get('tariffProvider.fresh').val, true);
});

test('921-HIS-002 unresolved cloud fetch does not hold the local tick, permits no overlap and stops cleanly', async t => {
    const x = fixture(t); let signal;
    x.fetch(input => new Promise((resolve, reject) => {
        signal = input;
        input?.addEventListener('abort', () => reject(new Error('provider_cancelled')), { once: true });
    }));
    let finished = false;
    const localTick = x.instance.tick().then(() => { finished = true; });
    // One event-loop turn is enough for all local writes in this controlled fixture.
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(finished, true, 'the EMS tick must not await a remote tariff response');
    assert.equal(x.calls(), 1);
    for (let i = 0; i < 20; i++) await x.instance.tick();
    assert.equal(x.calls(), 1, 'only one external request may remain in flight');
    const pending = x.instance._fetchPromise;
    x.instance.stop();
    assert.equal(signal.aborted, true, 'stop aborts the actual request signal');
    const count = x.states.size; await pending; await localTick;
    assert.equal(x.states.size, count);
    assert.equal(x.instance._fetchPromise, null);
});

test('921-HIS-002 source replacement revokes the old request before permitting another provider', async t => {
    const x = fixture(t); let oldSignal;
    x.fetch(signal => new Promise((resolve, reject) => {
        oldSignal = signal;
        signal.addEventListener('abort', () => reject(new Error('provider_cancelled')), { once: true });
    }));
    await x.instance.tick();
    const pending = x.instance._fetchPromise;
    x.adapter.config.tariffProvider = { ...x.adapter.config.tariffProvider, providerId: 'energyzero', sourceId: 'energyzero' };
    await x.instance.invalidateConfiguration();
    assert.equal(oldSignal.aborted, true);
    await pending;
    assert.equal(x.instance._lastError, '');
    assert.equal(x.instance._lastSuccessMs, 0);
    assert.equal(x.calls(), 1);
    x.fetch(undefined); x.recover(); await tick(x);
    assert.equal(x.calls(), 2);
    assert.equal(x.states.get('tariffProvider.providerId').val, 'energyzero');
    assert.equal(x.states.get('tariffProvider.currentPriceEurPerKwh').val, -0.05);
});
test('921-HIS-002 background publication failure retains its reader fence and recovers only after DB writes work', async t => {
    const x = fixture(t); x.recover();
    x.beforeWrite(async () => { throw new Error('synthetic DB failure'); });
    await tick(x);
    assert.equal(x.instance._invalidationPending, true);
    assert.equal(x.instance._lastError, 'TARIFF_STATE_WRITE_FAILED');
    assert.ok(x.adapter._nwTariffInvalidation);
    assert.equal(x.adapter._tariffProviderSnapshot.fresh, false);
    await assert.rejects(x.instance.tick(), /TARIFF_STATE_WRITE_FAILED/);
    assert.equal(x.calls(), 1, 'failed clearing must block further network attempts');
    x.beforeWrite(async () => {}); await tick(x);
    assert.equal(x.calls(), 2);
    assert.equal(x.instance._invalidationPending, false);
    assert.equal(x.adapter._nwTariffInvalidation, undefined);
    assert.equal(x.states.get('tariffProvider.fresh').val, true);
});
