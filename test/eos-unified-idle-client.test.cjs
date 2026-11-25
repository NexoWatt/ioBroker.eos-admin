/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const sourceFile = path.join(root, 'ui/src-ts/runtime-executables/www/eos-session-idle.ts');
const source = fs.readFileSync(sourceFile, 'utf8');
const code = process.env.EOS_TEST_RUNTIME === 'build' ? fs.readFileSync(path.join(root, 'ui/www/eos-session-idle.js'), 'utf8')
    : ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const IDLE = 600000;
const flush = async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); };
function target() {
    const listeners = new Map();
    return {
        addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
        emit(type, detail = {}) { for (const listener of listeners.get(type) || []) listener({ type, isTrusted: true, ...detail }); },
    };
}
function clock() {
    let time = 0, sequence = 0;
    const timers = new Map();
    return {
        now: () => time,
        jump(value) { time = value; },
        set(fn, delay) { const id = ++sequence; timers.set(id, { at: time + delay, fn }); return id; },
        clear(id) { timers.delete(id); },
        async advance(value) {
            const end = time + value;
            for (let i = 0; i < 10000; i++) {
                const item = [...timers].filter(([, value]) => value.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
                if (!item) { time = end; await flush(); return; }
                timers.delete(item[0]); time = Math.max(time, item[1].at); item[1].fn(); await flush();
            }
            throw Error('Unbounded timer loop');
        },
        timers,
    };
}
function backend(time, key = 'session_1234567890abcdef') {
    const value = { expires: IDLE, csrf: 'a'.repeat(64), sessionKey: key, calls: [], offline: false, renewals: 0 };
    value.status = () => ({ authenticated: time.now() < value.expires, serverNow: 1000000 + time.now(), idleTimeoutMs: IDLE,
        idleExpiresAt: 1000000 + value.expires, sessionKey: value.sessionKey, csrfToken: value.csrf });
    value.fetch = async (url, init) => {
        const pathname = new URL(url, 'https://nexowatt.local').pathname;
        value.calls.push({ url, path: pathname, init });
        if (value.offline) throw Error('offline');
        if (init.method === 'POST' && init.headers['X-NW-CSRF'] !== value.csrf) return new Response('{}', { status: 403, headers: { 'Content-Type': 'application/json' } });
        if (pathname === '/api/auth/activity' && time.now() < value.expires) { value.expires = time.now() + IDLE; value.renewals++; }
        return new Response(JSON.stringify(value.status()), { headers: { 'Content-Type': 'application/json' } });
    };
    return value;
}
function broadcast() {
    const peers = new Set();
    return class Channel {
        constructor() { peers.add(this); }
        postMessage(data) { for (const peer of peers) if (peer !== this) queueMicrotask(() => peer.onmessage?.({ data })); }
        close() { peers.delete(this); }
    };
}
function browser(options = {}) {
    const time = options.time || clock(), server = options.server || backend(time);
    const elements = new Map(), classes = new Set(), redirects = [], frames = [];
    class Element { constructor(tagName) { this.tagName = tagName; } querySelector() { return null; } }
    const node = () => ({
        style: {}, setAttribute() {}, appendChild(child) { if (child.id) elements.set(child.id, child); },
        remove() { elements.delete(this.id); },
    });
    const document = Object.assign(target(), {
        visibilityState: 'visible', documentElement: { classList: { add: name => classes.add(name), remove: name => classes.delete(name) } },
        head: node(), body: node(), createElement: node, getElementById: id => elements.get(id), querySelectorAll: () => frames,
    });
    const location = { pathname: options.pathname || '/system/', origin: 'https://nexowatt.local', replace: url => redirects.push(url) };
    const window = Object.assign(target(), { document, fetch: server.fetch, location });
    window.top = window;
    let mutation;
    const context = vm.createContext({
        window, document, performance: { now: time.now }, setTimeout: time.set, clearTimeout: time.clear,
        AbortController, TextDecoder, URL, console, Element,
        BroadcastChannel: options.Channel || broadcast(),
        MutationObserver: class { constructor(fn) { mutation = fn; } observe() {} disconnect() {} },
    });
    vm.runInContext(code, context, { filename: sourceFile, timeout: 1000 });
    return { time, server, document, window, context, redirects, classes, frames,
        mutate: () => mutation([{ addedNodes: [new Element('IFRAME')] }]),
        gesture(type = 'pointerdown', extra = {}) { document.emit(type, extra); },
        async ready() { await flush(); },
    };
}

test('an untouched page logs out at ten minutes; background status reads do not renew', async () => {
    const ui = browser(); await ui.ready();
    for (let i = 0; i < 9; i++) { await ui.time.advance(60000); ui.window.emit('focus'); await ui.ready(); }
    assert.equal(ui.server.renewals, 0); assert.deepEqual(ui.redirects, []);
    await ui.time.advance(59999); assert.deepEqual(ui.redirects, []);
    await ui.time.advance(1); assert.deepEqual(ui.redirects, ['/login.html?reason=idle&admin=1&returnTo=%2Fsystem%2F']);
    assert.ok(ui.classes.has('nw-session-idle-locked'));
    assert.ok(ui.server.calls.every(call => ['GET', 'POST'].includes(call.init.method)));
});

for (const event of ['pointerdown', 'keydown', 'touchstart', 'wheel']) {
    test(`trusted ${event} extends idle exactly from the last submitted input`, async () => {
        const ui = browser(); await ui.ready(); await ui.time.advance(300000);
        ui.gesture(event); await ui.time.advance(0);
        assert.equal(ui.server.expires, 900000); assert.equal(ui.server.renewals, 1);
        const write = ui.server.calls.find(call => call.path === '/api/auth/activity');
        assert.equal(write.init.headers['X-NW-CSRF'], ui.server.csrf);
        assert.equal(write.init.credentials, 'same-origin'); assert.equal(write.init.body, '{}');
        await ui.time.advance(599999); assert.deepEqual(ui.redirects, []);
        await ui.time.advance(1); assert.equal(ui.redirects.length, 1);
    });
}

test('synthetic events, passive pointer motion, polling and visibility never count as input', async () => {
    const ui = browser(); await ui.ready();
    for (const event of ['pointerdown', 'keydown', 'touchstart', 'wheel']) ui.gesture(event, { isTrusted: false });
    ui.gesture('pointermove', { buttons: 0 }); ui.document.emit('scroll'); ui.window.emit('online');
    ui.document.emit('visibilitychange'); ui.window.emit('pageshow', { persisted: true });
    await ui.time.advance(10000);
    assert.equal(ui.server.renewals, 0);
    assert.ok(ui.server.calls.every(call => call.path === '/api/auth/idle'));
});

test('a burst is bounded and its final gesture still gets a trailing update', async () => {
    const ui = browser(); await ui.ready();
    ui.gesture(); await ui.time.advance(0);
    await ui.time.advance(400);
    for (let i = 0; i < 500; i++) ui.gesture('keydown');
    assert.equal(ui.server.renewals, 1);
    await ui.time.advance(600); assert.equal(ui.server.renewals, 2);
    await ui.time.advance(10000); assert.equal(ui.server.renewals, 2, 'no activity heartbeat after input ends');
});

test('an active sibling tab keeps the same family open without the idle tab renewing', async () => {
    const time = clock(), server = backend(time), Channel = broadcast();
    const first = browser({ time, server, Channel }), second = browser({ time, server, Channel });
    await first.ready(); await second.ready(); await time.advance(550000);
    second.gesture(); await time.advance(0);
    assert.equal(server.renewals, 1); await time.advance(50000);
    assert.deepEqual(first.redirects, []); assert.deepEqual(second.redirects, []);
    await time.advance(550000);
    assert.equal(first.redirects.length, 1); assert.equal(second.redirects.length, 1);
    assert.equal(server.renewals, 1);
});

test('unrelated sessions and fabricated cross-tab deadlines cannot extend or end a page', async () => {
    const time = clock(), Channel = broadcast(), first = browser({ time, Channel });
    await first.ready(); const stranger = new Channel();
    const before = first.server.calls.length;
    stranger.postMessage({ type: 'activity', sessionKey: 'other_session_12345678', idleExpiresAt: 999999999 });
    await flush(); assert.equal(first.server.calls.length, before);
    stranger.postMessage({ type: 'activity', sessionKey: first.server.sessionKey, idleExpiresAt: 999999999 });
    await flush(); assert.ok(first.server.calls.length > before);
    assert.equal(first.server.renewals, 0);
    await time.advance(IDLE); assert.equal(first.redirects.length, 1);
});

test('sleep and BFCache resume checks the server before accepting a late gesture', async () => {
    const ui = browser(); await ui.ready(); ui.time.jump(IDLE + 1);
    ui.gesture(); ui.window.emit('pageshow', { persisted: true }); await ui.ready();
    assert.equal(ui.server.renewals, 0); assert.equal(ui.redirects.length, 1);
    assert.ok(ui.classes.has('nw-session-idle-locked'));
});

test('offline timeout hides the old page and does not stop devices or EMS', async () => {
    const ui = browser(); await ui.ready(); ui.server.offline = true;
    await ui.time.advance(IDLE); assert.equal(ui.redirects.length, 1);
    assert.ok(ui.classes.has('nw-session-idle-locked'));
    assert.ok(ui.server.calls.every(call => /^\/api\/auth\/(idle|activity|expire)$/.test(call.path)));
});

test('refresh changes CSRF without losing a fresh real gesture or creating periodic writes', async () => {
    const ui = browser(); await ui.ready(); await ui.time.advance(1000);
    ui.server.csrf = 'b'.repeat(64); ui.gesture(); await ui.time.advance(1000);
    assert.equal(ui.server.renewals, 1);
    assert.equal(ui.server.calls.filter(call => call.path === '/api/auth/activity').length, 2);
    await ui.time.advance(10000); assert.equal(ui.server.renewals, 1);
});

test('CSRF rotation just before expiry never delays the real gesture beyond the server deadline', async () => {
    const ui = browser(); await ui.ready(); await ui.time.advance(IDLE - 800);
    ui.server.csrf = 'b'.repeat(64); ui.gesture(); await ui.time.advance(0);
    assert.equal(ui.server.renewals, 1); assert.deepEqual(ui.redirects, []);
    await ui.time.advance(800); assert.deepEqual(ui.redirects, []);
});

test('same-origin Admin frame interactions count; frame reload listeners bind the new document', async () => {
    const ui = browser(); await ui.ready();
    const firstDoc = target(), frame = Object.assign(target(), { contentDocument: firstDoc });
    ui.frames.push(frame); ui.mutate(); firstDoc.emit('keydown'); await ui.time.advance(0);
    assert.equal(ui.server.renewals, 1);
    const secondDoc = target(); frame.contentDocument = secondDoc; frame.emit('load');
    await ui.time.advance(2000); secondDoc.emit('pointermove', { buttons: 1 }); await ui.time.advance(0);
    assert.equal(ui.server.renewals, 2);
});

test('login page is excluded and duplicate loading never registers a second timer or API request', async () => {
    const login = browser({ pathname: '/login.html' }); await login.ready(); assert.equal(login.server.calls.length, 0);
    const ui = browser(); await ui.ready(); const count = ui.server.calls.length;
    vm.runInContext(code, ui.context); await ui.ready(); assert.equal(ui.server.calls.length, count);
});

test('blocked cross-tab transport keeps server checks and inactivity logout working', async () => {
    const ui = browser({ Channel: class { constructor() { throw Error('privacy setting'); } } });
    await ui.ready(); assert.equal(ui.server.calls.length, 1);
    await ui.time.advance(IDLE); assert.equal(ui.redirects.length, 1);
});

test('all canonical EOS screens include the shared root client, including recovery and module pages', () => {
    const pages = fs.readdirSync(path.join(root, 'ui/www')).filter(name => name.endsWith('.html') && !['login.html', 'dc-station-display.html'].includes(name))
        .map(name => `ui/www/${name}`).concat([
            'src-admin/index.html', 'ui/src-admin-tab/index.html', 'public/nexowatt-license.html',
            'public/eos-migration/index.html', 'public/eos-tls/index.html',
            'modules/devices/admin/index.html', 'modules/eebus/admin/index.html', 'modules/backup/admin/index.html',
        ]);
    if (process.env.EOS_TEST_RUNTIME === 'build') pages.push('adminWww/index.html', 'ui/admin/react/index.html');
    for (const file of pages) {
        const html = fs.readFileSync(path.join(root, file), 'utf8');
        assert.match(html, /<script\b[^>]*\bsrc="\/eos-session-idle\.js(?:\?[^"<>]*)?"[^>]*><\/script>/, file);
        assert.equal((html.match(/src="\/eos-session-idle\.js(?:\?[^"<>]*)?"/g) || []).length, 1, file);
    }
    assert.ok(!/localStorage|sessionStorage/.test(source), 'no secret or stale session authority stored in browser storage');
    assert.doesNotMatch(fs.readFileSync(path.join(root, 'ui/www/dc-station-display.html'), 'utf8'), /eos-session-idle\.js/,
        'machine-token station display does not participate in human browser sessions');
});

test('instance proxy rendering and fetch mapping preserve the shared owner idle routes', async () => {
    const { rewriteRuntimeProxyHtml } = require('tsx/cjs/api').require(
        path.join(root, 'ui/src-ts/runtime-executables/lib/runtime-proxy-html.ts'), __filename);
    const rendered = rewriteRuntimeProxyHtml('<html><head><script defer src="/eos-session-idle.js"></script></head><body></body></html>', '/admin/proxy/nexowatt-ui.2');
    assert.match(rendered, /src="\/eos-session-idle\.js"/);
    assert.doesNotMatch(rendered, /src="\/admin\/proxy\/nexowatt-ui\.2\/eos-session-idle\.js"/);
    const file = path.join(root, 'ui/src-ts/runtime-executables/www/runtime-base.ts');
    const runtimeCode = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const calls = [], location = new URL('https://nexowatt.local/admin/proxy/nexowatt-ui.2/smarthome.html');
    const window = { location, fetch: async input => { calls.push(input); return Response.json({}); } };
    vm.runInNewContext(runtimeCode, { window, document: { baseURI: location.href }, URL, Request });
    for (const endpoint of ['idle', 'activity', 'expire']) await window.fetch('/api/auth/' + endpoint);
    await window.fetch('/api/set');
    assert.deepEqual(calls, ['/api/auth/idle', '/api/auth/activity', '/api/auth/expire', '/admin/proxy/nexowatt-ui.2/api/set']);
});

function kioskBackend(time) {
    const server = backend(time);
    server.status = () => ({ authenticated: true, kiosk: true, serverNow: 1000000 + time.now(), idleTimeoutMs: 0,
        idleExpiresAt: null, sessionKey: 'kiosk:' + 'b'.repeat(48), csrfToken: server.csrf });
    return server;
}
test('public kiosk remains available for thirty minutes without expiry or activity writes', async () => {
    const time = clock(), server = kioskBackend(time), ui = browser({ pathname: '/', time, server }); await ui.ready();
    for (let i = 0; i < 30; i++) { await time.advance(60000); ui.gesture(); await ui.ready(); }
    assert.deepEqual(ui.redirects, []); assert.equal(ui.classes.has('nw-session-idle-locked'), false);
    assert.ok(server.calls.length >= 60); assert.ok(server.calls.every(call => call.init.method === 'GET' && call.url === '/api/auth/idle'));
    assert.equal(server.renewals, 0);
});
test('disabling kiosk or losing its API locks the public page at the next read-only check', async () => {
    for (const variant of ['disabled', 'offline']) {
        const time = clock(), server = kioskBackend(time), ui = browser({ pathname: '/', time, server }); await ui.ready();
        if (variant === 'disabled') server.status = () => ({ authenticated: false, serverNow: 1000000 + time.now(), idleTimeoutMs: IDLE, idleExpiresAt: null, sessionKey: null, csrfToken: '' });
        else server.offline = true;
        await time.advance(30000); assert.deepEqual(ui.redirects, ['/login.html?reason=idle'], variant);
        assert.equal(ui.classes.has('nw-session-idle-locked'), true, variant);
        assert.ok(server.calls.every(call => call.init.method === 'GET'));
    }
});
test('kiosk cannot unlock protected or cached Admin DOM and protected idle checks explicitly suppress fallback', async () => {
    for (const pathname of ['/system/', '/settings.html', '/migration/', '/modules/ocpp/']) {
        const time = clock(), server = kioskBackend(time), ui = browser({ pathname, time, server }); await ui.ready();
        assert.deepEqual(ui.redirects, ['/login.html?reason=idle&admin=1&returnTo=' + encodeURIComponent(pathname)]);
        assert.equal(ui.classes.has('nw-session-idle-locked'), true);
        assert.ok(server.calls.every(call => call.url === '/api/auth/idle?admin=1'));
    }
});
test('a real admin session keeps ordinary ten-minute expiry even while kiosk capability exists elsewhere', async () => {
    const ui = browser({ pathname: '/settings.html' }); await ui.ready();
    assert.ok(ui.server.calls.every(call => call.url.endsWith('?admin=1')));
    await ui.time.advance(IDLE);
    assert.deepEqual(ui.redirects, ['/login.html?reason=idle&admin=1&returnTo=%2Fsettings.html']);
});
