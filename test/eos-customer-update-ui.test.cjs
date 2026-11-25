'use strict';
/** Deterministic DOM/Fetch lifecycle fixture for the actual TS source; not a rendered-browser geometry test. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const sourceFile = process.env.EOS_UPDATE_UI_SOURCE || path.join(root, 'ui/src-ts/runtime-executables/www/eos-updates.ts');
const source = ts.transpileModule(fs.readFileSync(sourceFile, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const csrf = 'a'.repeat(64);
const planId = '01234567-89ab-4def-89ab-0123456789ab';
const responseView = (state = 'available', extra = {}) => ({ installedVersion: '9.0.21', availableVersion: '9.0.22', checkedAt: Date.now(),
    source: 'npm-latest', state, canStart: state === 'prepared', reason: null,
    ...(state === 'prepared' ? { planId, expiresAt: Date.now() + 300000 } : {}), ...extra });
const response = (body, status = 200) => ({ status, ok: status >= 200 && status < 300, json: async () => structuredClone(body) });
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
class EventTargetFixture {
    listeners = new Map();
    addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(fn); }
    dispatch(type) { for (const fn of this.listeners.get(type) || []) fn({ type }); }
}
class Element extends EventTargetFixture {
    dataset = {}; children = []; parent = null; textContent = ''; className = ''; title = ''; hidden = false; attributes = new Map();
    setAttribute(key, value) { this.attributes.set(key, String(value)); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    appendChild(child) { child.parent = this; this.children.push(child); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
    set innerHTML(_value) { throw new Error('untrusted HTML insertion is prohibited'); }
}
class Button extends Element { disabled = false; click(force = false) { if (force || (!this.disabled && !this.hidden)) this.dispatch('click'); } }
class Anchor extends Element { get href() { return this.getAttribute('href'); } set href(value) { this.setAttribute('href', value); } }
class Span extends Element {}
class Dialog extends Element { open = false; showModal() { assert.equal(this.open, false, 'must not reopen an open modal'); this.open = true; } close() { this.open = false; } }
async function flush() { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); }
function fixture(t, initialHandler) {
    const html = fs.readFileSync(path.join(root, 'ui/www/settings.html'), 'utf8');
    const elements = new Map();
    for (const match of html.matchAll(/<(\w+)\b[^>]*\bid="(eosUpdate\w+)"[^>]*>/g)) {
        const node = match[1] === 'button' ? new Button() : match[1] === 'dialog' ? new Dialog() : new Element();
        node.id = match[2]; elements.set(node.id, node);
    }
    const gear = new Anchor(); gear.href = 'settings.html';
    const document = new EventTargetFixture(); document.hidden = false; document.readyState = 'complete';
    document.getElementById = id => elements.get(id) || null;
    document.querySelector = selector => selector === 'a.topbar-gear' ? gear : null;
    document.createElement = tag => tag === 'span' ? new Span() : new Element();
    const window = new EventTargetFixture(); const timers = new Map(); let timerId = 0;
    let status = responseView(); let handler = initialHandler; const calls = []; const clock = { now: Date.now() };
    class ClockDate extends Date { static now() { return clock.now; } }
    const fetch = (url, options = {}) => {
        const call = { path: url, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null, headers: options.headers || {}, signal: options.signal };
        calls.push(call);
        return Promise.resolve().then(() => handler?.(call)).then(result => result || response(call.path === '/api/auth/status' ? { authenticated: true, mustChangePassword: false, csrfToken: csrf } : status));
    };
    vm.runInNewContext(source, { window, document, fetch, AbortSignal, AbortController, Error, Date: ClockDate,
        HTMLButtonElement: Button, HTMLDialogElement: Dialog, HTMLAnchorElement: Anchor, HTMLSpanElement: Span,
        setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; }, clearTimeout(id) { timers.delete(id); },
    }, { filename: sourceFile });
    t.after(() => { window.dispatch('pagehide'); });
    return { elements, gear, calls, clock, timers, window, document, get: id => elements.get(id),
        setStatus: value => { status = value; }, handle: fn => { handler = fn; },
        async refresh() { document.dispatch('visibilitychange'); await flush(); },
        async click(id, force = false) { elements.get(id).click(force); await flush(); },
        async fireTimer(ms) { const entry = [...timers].find(([, timer]) => timer.ms === ms); assert.ok(entry); timers.delete(entry[0]); entry[1].fn(); await flush(); },
    };
}
async function ready(x) { await flush(); assert.equal(x.get('eosUpdateInstalled').textContent, '9.0.21'); }
async function prepare(x) {
    x.handle(async call => { if (call.path === '/api/eos-update/prepare') { const view = responseView('prepared'); x.setStatus(view); return response(view); } });
    await x.click('eosUpdatePrepare'); assert.equal(x.get('eosUpdateConfirm').open, true);
}
const startCalls = x => x.calls.filter(call => call.path === '/api/eos-update/start');

test('update notice performs no automatic action and links directly to the update settings', async t => {
    const x = fixture(t); await ready(x);
    assert.equal(x.calls.some(call => call.method !== 'GET'), false);
    assert.equal(x.gear.children.length, 1); assert.equal(x.gear.href, 'settings.html#updates');
    assert.equal(x.get('eosUpdateAvailable').textContent, '9.0.22'); assert.equal(x.get('eosUpdateConfirm').open, false);
});
test('failed check keeps its error and restores explicit retry controls', async t => {
    const x = fixture(t); await ready(x);
    x.handle(call => { if (call.path === '/api/eos-update/check') throw new Error('offline'); });
    await x.click('eosUpdateCheck');
    assert.equal(x.get('eosUpdateStatus').dataset.error, 'true'); assert.match(x.get('eosUpdateStatus').textContent, /nicht erreichbar/);
    assert.equal(x.get('eosUpdateCheck').disabled, false); assert.equal(startCalls(x).length, 0);
    x.handle(undefined); await x.click('eosUpdateCheck');
    assert.equal(x.get('eosUpdateStatus').dataset.error, 'false');
    assert.equal(x.calls.filter(call => call.path === '/api/eos-update/check').length, 2);
});
test('prepare and start need separate clicks, fresh CSRF and the exact version/plan; duplicate clicks cannot start twice', async t => {
    const x = fixture(t); await ready(x); await prepare(x);
    assert.equal(startCalls(x).length, 0);
    const prepared = x.calls.find(call => call.path === '/api/eos-update/prepare');
    assert.deepEqual(prepared.body, { version: '9.0.22' }); assert.equal(prepared.headers['X-NW-CSRF'], csrf);
    assert.equal(x.get('eosUpdateConfirmVersion').textContent, '9.0.22');
    const gate = deferred();
    x.handle(call => { if (call.path === '/api/eos-update/start') return gate.promise; });
    x.get('eosUpdateStart').click(true); x.get('eosUpdateStart').click(true); await flush();
    assert.equal(startCalls(x).length, 1); assert.deepEqual(startCalls(x)[0].body, { planId, confirm: true });
    gate.resolve(response(responseView('installing'))); await flush();
    assert.match(x.get('eosUpdateStatus').textContent, /Update läuft/);
    assert.equal(x.get('eosUpdateInstalled').textContent, '9.0.21', 'start acknowledgement is not installation confirmation');
});
test('lost start response stays indeterminate, blocks repeats and recovers only from an authoritative status', async t => {
    const x = fixture(t); await ready(x); await prepare(x);
    x.handle(call => { if (call.path === '/api/eos-update/start') throw new Error('connection lost'); });
    await x.click('eosUpdateStart'); assert.match(x.get('eosUpdateStatus').textContent, /noch aus/);
    await x.click('eosUpdateStart', true); assert.equal(startCalls(x).length, 1); assert.equal(x.get('eosUpdateStart').disabled, true);
    x.handle(undefined); x.setStatus(responseView('prepared')); await x.refresh();
    assert.equal(x.get('eosUpdateCheck').disabled, false); assert.equal(startCalls(x).length, 1);
    x.setStatus(responseView('installed', { installedVersion: '9.0.22' })); await x.refresh();
    assert.equal(x.get('eosUpdateInstalled').textContent, '9.0.22'); assert.equal(x.gear.children.length, 0);
});
test('expired authentication before sending the start issues no order and keeps an explicit sign-in notice', async t => {
    const x = fixture(t); await ready(x); await prepare(x);
    x.handle(call => { if (call.path === '/api/auth/status') return response({ authenticated: false }); });
    await x.click('eosUpdateStart'); assert.match(x.get('eosUpdateStatus').textContent, /anmelden/);
    assert.equal(startCalls(x).length, 0); assert.equal(x.get('eosUpdateStart').disabled, true); assert.equal(x.get('eosUpdateCheck').disabled, false);
});
test('expired session after lost start never falsely declares the earlier order unissued', async t => {
    const x = fixture(t); await ready(x); await prepare(x);
    x.handle(call => { if (call.path === '/api/eos-update/start') throw new Error('connection lost'); });
    await x.click('eosUpdateStart');
    x.handle(call => { if (call.path === '/api/eos-update/status') return response({}, 401); });
    await x.refresh(); assert.match(x.get('eosUpdateStatus').textContent, /anmelden/);
    assert.doesNotMatch(x.get('eosUpdateStatus').textContent, /kein.*Auftrag.*erteilt/i);
    assert.match(x.get('eosUpdateStatus').textContent, /unbestätigt/);
    await x.click('eosUpdateStart', true); assert.equal(startCalls(x).length, 1);
});
test('repeated visibility events cannot overlap status reads or actions', async t => {
    const gate = deferred(); const x = fixture(t, call => call.path === '/api/eos-update/status' ? gate.promise : undefined);
    for (let i = 0; i < 8; i++) x.document.dispatch('visibilitychange');
    await flush(); assert.equal(x.calls.length, 1); assert.equal(x.get('eosUpdateCheck').disabled, true);
    await x.click('eosUpdateCheck', true); assert.equal(x.calls.length, 1);
    gate.resolve(response(responseView())); await ready(x);
});
test('pagehide aborts outstanding work and pageshow resumes; stale responses cannot overwrite the new page state', async t => {
    const gate = deferred(); let first = true;
    const x = fixture(t, call => { if (call.path === '/api/eos-update/status' && first) { first = false; return gate.promise; } });
    await flush(); const oldSignal = x.calls[0].signal;
    x.window.dispatch('pagehide'); assert.equal(oldSignal.aborted, true); assert.equal(x.timers.size, 0);
    x.setStatus(responseView('current', { availableVersion: null })); x.window.dispatch('pageshow'); await ready(x);
    assert.equal(x.get('eosUpdateAvailable').textContent, '—');
    gate.resolve(response(responseView('available', { availableVersion: '9.0.99' }))); await flush();
    assert.equal(x.get('eosUpdateAvailable').textContent, '—'); assert.equal(x.gear.children.length, 0);
    assert.equal(x.calls.filter(call => call.path === '/api/eos-update/status').length, 2);
});
test('malformed metadata and executable-looking versions never enter HTML or authorize starts', async t => {
    const x = fixture(t, call => call.path === '/api/eos-update/status' ? response(responseView('available', { installedVersion: '<img src=x onerror=alert(1)>' })) : undefined);
    await flush(); assert.equal(x.get('eosUpdateStatus').dataset.error, 'true'); assert.equal(x.get('eosUpdateCheck').disabled, false);
    assert.equal(x.calls.some(call => call.method !== 'GET'), false);
    x.handle(undefined); x.setStatus(responseView('prepared', { planId: '<script>bad</script>' })); await x.refresh();
    assert.equal(x.get('eosUpdateStatus').dataset.error, 'true'); assert.equal(x.get('eosUpdateStart').disabled, true);
});
test('conflicting plans and expired plan timestamps cannot be submitted again', async t => {
    const x = fixture(t); await ready(x); await prepare(x);
    x.handle(call => call.path === '/api/eos-update/start' ? response({}, 409) : undefined);
    await x.click('eosUpdateStart'); assert.match(x.get('eosUpdateStatus').textContent, /nicht mehr gültig/);
    assert.equal(x.get('eosUpdateCheck').disabled, false); assert.equal(x.get('eosUpdateStart').disabled, true);
    await x.click('eosUpdateStart', true); assert.equal(startCalls(x).length, 1);
    x.handle(undefined); x.setStatus(responseView('prepared', { expiresAt: Date.now() - 1000 })); await x.refresh();
    assert.equal(x.get('eosUpdateStart').disabled, true); await x.click('eosUpdateStart', true); assert.equal(startCalls(x).length, 1);
});
test('offline/current states do not advertise installation and modal cancellation never mutates the system', async t => {
    const x = fixture(t); await ready(x); x.setStatus(responseView('offline')); await x.refresh();
    assert.equal(x.get('eosUpdatePrepare').hidden, true); assert.equal(x.gear.children.length, 0); assert.match(x.get('eosUpdateStatus').textContent, /nicht erreichbar/);
    x.setStatus(responseView('current', { availableVersion: '9.0.21' })); await x.refresh(); assert.equal(x.gear.children.length, 0);
    x.setStatus(responseView()); await x.refresh(); await prepare(x); await x.click('eosUpdateCancel');
    assert.equal(x.get('eosUpdateConfirm').open, false); assert.equal(startCalls(x).length, 0);
});
test('mobile markup and stylesheet retain explicit containment and live status semantics', () => {
    const html = fs.readFileSync(path.join(root, 'ui/www/settings.html'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'ui/www/eos-updates.css'), 'utf8');
    assert.match(html, /id="eosUpdateStatus"[^>]*role="status"[^>]*aria-live="polite"/);
    assert.match(html, /<dialog id="eosUpdateConfirm" aria-labelledby="eosUpdateConfirmTitle"/);
    assert.match(css, /max-width:\s*min\(560px,\s*calc\(100vw - 40px\)\)/);
    assert.match(css, /max-height:\s*calc\(100vh - 48px\)/); assert.match(css, /overflow-y:\s*auto/);
    assert.match(css, /@media\s*\(max-width:\s*640px\)/); assert.match(css, /grid-template-columns:\s*1fr/);
});
test('password-change requirement and missing or malformed CSRF prevent every mutating request', async t => {
    for (const access of [
        { authenticated: true, mustChangePassword: true, csrfToken: csrf },
        { authenticated: true, mustChangePassword: false },
        { authenticated: true, mustChangePassword: false, csrfToken: 'bad\nheader' },
    ]) {
        const x = fixture(t); await ready(x);
        x.handle(call => call.path === '/api/auth/status' ? response(access) : undefined);
        await x.click('eosUpdateCheck');
        assert.equal(x.calls.some(call => call.method === 'POST'), false);
        assert.match(x.get('eosUpdateStatus').textContent, /anmelden/);
        assert.equal(x.get('eosUpdateCheck').disabled, false);
    }
});
test('hidden document stops polling until visibility returns and an in-flight action remains single', async t => {
    const x = fixture(t); await ready(x); const count = x.calls.length;
    x.document.hidden = true; x.document.dispatch('visibilitychange'); await flush();
    assert.equal(x.timers.size, 0); assert.equal(x.calls.length, count);
    x.document.hidden = false; await x.refresh(); assert.equal(x.calls.length, count + 1);
    const gate = deferred(); x.handle(call => call.path === '/api/eos-update/check' ? gate.promise : undefined);
    x.get('eosUpdateCheck').click(true); await flush(); await x.refresh(); await x.click('eosUpdateCheck', true);
    assert.equal(x.calls.filter(call => call.path === '/api/eos-update/check').length, 1);
    gate.resolve(response(responseView('current', { availableVersion: null }))); await flush();
    assert.equal(x.get('eosUpdateCheck').disabled, false); assert.equal(x.gear.children.length, 0);
});
