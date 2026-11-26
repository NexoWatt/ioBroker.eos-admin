'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../ui/www/dashboard-process-status.js'), 'utf8');
const base = 1800000000000;
const snapshot = (now, state = 'ok', failed = [], paused = []) => ({
    observedAt: now, state, failed, paused, deviceHealth: { state: 'ok', offline: [], totalOffline: 0 },
});
function fixture({ dashboard = true, authPath = p => p, loading = false } = {}) {
    let tick = 0, next = 0, clockShift = 0, events = 0, onTab = null;
    const scheduled = new Map(), requests = [];
    function target() {
        const callbacks = {};
        return {
            addEventListener(kind, cb) { (callbacks[kind] ||= []).push(cb); },
            dispatchEvent(ev) { for (const cb of callbacks[ev.type] || []) cb(ev); },
        };
    }
    const dom = { style: { display: 'grid' }, hidden: false };
    const document = Object.assign(target(), {
        readyState: loading ? 'loading' : 'complete', visibilityState: 'visible',
        querySelector: () => dashboard ? dom : null, getElementById: () => dashboard ? {} : null,
    });
    const window = Object.assign(target(), {
        NW_RUNTIME: { url: authPath }, location: new URL('https://eos.test/'),
        setTimeout(fn, ms) { scheduled.set(++next, { at: tick + ms, fn }); return next; },
        clearTimeout(id) { scheduled.delete(id); },
        fetch(url, init) {
            return new Promise((resolve, reject) => requests.push({ url, init, resolve, reject, tick }));
        },
    });
    const ctx = vm.createContext({window, document, URL, Event, AbortController, performance: { now: () => tick },
        Date: class extends Date { static now() { return base + clockShift + tick; } },
        MutationObserver: class { constructor(fn) { onTab = fn; } observe() {} },
    });
    window.addEventListener('nexowatt:process-health', () => events++);
    vm.runInContext(source, ctx);
    async function flush() { await new Promise(r => setImmediate(r)); }
    async function advance(ms) {
        const end = tick + ms;
        while (true) {
            const first = Array.from(scheduled).sort(([,a],[,b]) => a.at - b.at)[0];
            if (!first || first[1].at > end) break;
            tick = first[1].at;
            scheduled.delete(first[0]);
            first[1].fn(); await flush();
        }
        tick = end; await flush();
    }
    async function reply(req, body, { http = 200, date, later } = {}) {
        req.resolve({ status: http, ok: http >= 200 && http < 300, headers: { get: () => date ?? null },
            json: async () => later ? await later : body });
        await flush();
    }
    return {
        requests, window, document, dom, advance, reply, flush, events: () => events, tick: () => tick,
        current: () => window.NexoWattDashboardProcesses?.current() ?? null,
        tab(display) { dom.style.display = display; if (onTab) onTab(); },
        shift(ms) { clockShift += ms; },
        visibility(visible) { document.visibilityState = visible ? 'visible' : 'hidden'; document.dispatchEvent(new Event('visibilitychange')); },
    };
}

test('only an initialized visible LIVE dashboard polls, once per ten seconds across tabs/pageshow, on the same authenticated origin and proxy prefix', async () => {
    const other = fixture({ dashboard: false });
    await other.advance(60000);
    assert.equal(other.requests.length, 0);
    const foreign = fixture({ authPath: () => 'https://foreign.test/api/eos/dashboard/process-status' });
    await foreign.advance(20000);
    assert.equal(foreign.requests.length, 0);
    const f = fixture({ authPath: p => '/admin/proxy/nexowatt-ui.0' + p, loading: true });
    f.window.dispatchEvent(new Event('pageshow')); f.tab('grid'); await f.advance(0);
    assert.equal(f.requests.length, 0);
    f.document.dispatchEvent(new Event('DOMContentLoaded'));
    await f.advance(0);
    assert.equal(f.requests.length, 1);
    const [req] = f.requests;
    assert.equal(req.url, 'https://eos.test/admin/proxy/nexowatt-ui.0/api/eos/dashboard/process-status');
    assert.equal(req.init.credentials, 'same-origin'); assert.equal(req.init.cache, 'no-store'); assert.equal(req.init.redirect, 'error');
    await f.reply(req, snapshot(base)); assert.equal(f.events(), 1);
    f.window.dispatchEvent(new Event('pageshow')); f.tab('grid');
    await f.advance(9999); assert.equal(f.requests.length, 1);
    f.tab('none'); await f.advance(30000); assert.equal(f.requests.length, 1);
    assert.equal(f.current(), null);
    f.tab('grid'); await f.advance(0); assert.equal(f.requests.length, 2);
    await f.reply(f.requests[1], snapshot(base + f.tick())); assert.equal(f.current().state, 'ok');
});

test('pagehide, hidden tab and timeout abort requests and discard late headers or bodies, also after BFCache resume', async () => {
    const f = fixture(); await f.advance(0);
    const first = f.requests[0];
    let delayed;
    const later = new Promise(resolve => delayed = resolve);
    await f.reply(first, null, { later });
    f.window.dispatchEvent(new Event('pagehide')); assert.equal(first.init.signal.aborted, true);
    await f.advance(15000); assert.equal(f.requests.length, 1);
    f.window.dispatchEvent(new Event('pageshow')); await f.advance(0);
    const second = f.requests[1];
    await f.reply(second, snapshot(base + f.tick(), 'fault', ['ems']));
    delayed(snapshot(base, 'ok')); await f.flush();
    assert.deepEqual(Array.from(f.current().failed), ['ems']); assert.equal(f.events(), 1);
    await f.advance(10000); const third = f.requests[2];
    await f.advance(4000); assert.equal(third.init.signal.aborted, true);
    await f.reply(third, snapshot(base + f.tick())); assert.equal(f.current().state, 'fault');
    await f.advance(6000); f.visibility(false);
    assert.equal(f.requests[3].init.signal.aborted, true);
    await f.advance(90000); assert.equal(f.requests.length, 4);
    f.visibility(true); await f.advance(0);
    assert.equal(f.current(), null); assert.equal(f.events(), 2); assert.equal(f.requests.length, 5);
});

test('original observation age bounds health across repeated samples, bad replies and server/client clock differences', async () => {
    const f = fixture(); const remote = base + 24 * 3600000;
    await f.advance(0);
    const original = snapshot(remote - 5000, 'fault', ['devices']);
    await f.reply(f.requests[0], original, { date: new Date(remote).toUTCString() });
    assert.equal(f.current().observedAt, base - 5999);
    await f.advance(10000);
    await f.reply(f.requests[1], original, { date: new Date(remote + 10000).toUTCString() });
    assert.equal(f.events(), 1);
    await f.advance(10000);
    await f.reply(f.requests[2], {}, { http: 503 });
    f.shift(-60000);
    await f.advance(4002);
    assert.equal(f.current(), null); assert.equal(f.events(), 2);
    await f.advance(5998);
    await f.reply(f.requests[3], snapshot(remote + 100000), { date: new Date(remote + 30000).toUTCString() });
    assert.equal(f.current(), null, 'future report');
    await f.advance(10000);
    await f.reply(f.requests[4], original, { date: new Date(remote + 40000).toUTCString() });
    assert.equal(f.events(), 2, 'stale report may not revive');
});

test('malformed device details do not discard a process fault; unchanged, invalid, reversed and unauthorized observations cannot falsely clear it', async () => {
    const f = fixture(); await f.advance(0);
    const observed = (ms, deviceHealth) => ({ ...snapshot(base + ms, 'fault', ['ems'], ['ocpp']), deviceHealth });
    await f.reply(f.requests[0], observed(0, { state: 'fault', totalOffline: 1, offline: [{ name: 'x'.repeat(65) }] }));
    assert.equal(f.current().state, 'fault'); assert.equal(f.current().deviceHealth.state, 'unknown');
    const valid = { state:'fault', totalOffline: 15, offline:[{name:'Netzzähler'},{name:'AC-Punkt'}] };
    await f.advance(10000);
    await f.reply(f.requests[1], observed(10000, valid)); assert.equal(f.current().deviceHealth.totalOffline, 15);
    assert.equal(f.events(), 2);
    await f.advance(10000);
    await f.reply(f.requests[2], snapshot(base + 9000)); assert.equal(f.current().state, 'fault');
    assert.equal(f.events(), 2);
    await f.advance(10000);
    await f.reply(f.requests[3], observed(30000, valid)); assert.equal(f.events(), 2);
    await f.advance(10000);
    await f.reply(f.requests[4], snapshot(base + f.tick(), 'ok', ['ui'])); assert.equal(f.current().state, 'fault');
    await f.advance(10000); await f.reply(f.requests[5], null, { http: 401 });
    assert.equal(f.current(), null); assert.equal(f.events(), 3);
});
