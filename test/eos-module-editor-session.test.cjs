'use strict';
// Browser-script contract test with a minimal DOM, not a graphical browser proof.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../modules/devices/admin/host-bridge.js'), 'utf8');

async function flushUntil(predicate) {
    for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(resolve => setImmediate(resolve)); }
    assert.fail('editor operation did not settle');
}

async function fixture() {
    const nodes = new Map(); const domEvents = new Map(); const requests = [];
    let token = 'initial-csrf'; let authenticated = true; let loads = 0; let denyPut = false;
    let stored = { enabled: false, devices: [{ id: 'ess1', name: 'Existing ESS', connection: { password: '__EOS_SECRET_UNCHANGED__' } }] };
    let edited = structuredClone(stored);
    const node = id => {
        if (!nodes.has(id)) nodes.set(id, { textContent: '', dataset: {}, events: {}, children: [], checked: false,
            addEventListener(name, handler) { this.events[name] = handler; }, append(child) { this.children.push(child); } });
        return nodes.get(id);
    };
    const context = { Error, AbortSignal, Promise, console, window: {}, document: {
        getElementById: node, querySelectorAll: () => [], createElement: () => ({}),
        addEventListener: (name, handler) => domEvents.set(name, handler),
    }, async load(config) { loads++; edited = structuredClone(config); }, save(callback) { callback(edited); },
    async fetch(url, options) {
        const method = options.method || 'GET'; requests.push({ url, ...options, method });
        if (!authenticated) return { status: 401, ok: false };
        if (method === 'PUT') {
            if (denyPut) return { status: 403, ok: false };
            assert.equal(options.headers['x-nw-csrf'], token);
            stored = JSON.parse(options.body).config;
        }
        return { status: 200, ok: true, json: async () => ({ config: structuredClone(stored), csrfToken: token, status: { active: false, reason: 'DISABLED' } }) };
    } };
    vm.runInNewContext(source, context, { filename: 'host-bridge.js' }); domEvents.get('DOMContentLoaded')();
    await flushUntil(() => node('eosModuleStatus').textContent.startsWith('Gerätemodul:'));
    return { node, requests, draft: () => edited, stored: () => stored, loads: () => loads,
        authenticate(value, nextToken = token) { authenticated = value; token = nextToken; }, denyPut(value) { denyPut = value; },
        async save() { node('eosModuleSave').events.click(); await flushUntil(() => node('eosModuleReload').disabled === false); },
    };
}

test('device save refreshes rotated session CSRF without discarding the edited device', async () => {
    const f = await fixture(); f.draft().devices[0].name = 'FENECON edited';
    f.authenticate(true, 'new-session-csrf'); await f.save();
    assert.equal(f.stored().devices[0].name, 'FENECON edited');
    assert.equal(f.stored().devices[0].connection.password, '__EOS_SECRET_UNCHANGED__');
    assert.equal(f.requests.filter(request => request.method === 'PUT').length, 1);
    assert.equal(f.loads(), 2, 'one initial load and one successful persisted reload');
    assert.equal(f.node('eosModuleStatus').dataset.error, 'false');
});

test('expired session preserves the unsaved form and allows explicit retry after a separate login', async () => {
    const f = await fixture(); f.draft().devices[0].name = 'Unsaved device';
    f.authenticate(false); await f.save();
    assert.equal(f.draft().devices[0].name, 'Unsaved device'); assert.equal(f.loads(), 1);
    assert.equal(f.requests.filter(request => request.method === 'PUT').length, 0);
    assert.match(f.node('eosModuleStatus').textContent, /Änderungen bleiben im Formular/);
    assert.deepEqual(f.node('eosModuleStatus').children[0], { href: '/login.html', target: '_blank', rel: 'noopener noreferrer', textContent: ' EOS-Anmeldung öffnen' });
    f.authenticate(true, 'after-login'); await f.save();
    assert.equal(f.stored().devices[0].name, 'Unsaved device');
    assert.equal(f.requests.filter(request => request.method === 'PUT').length, 1);
});

test('forbidden mutation is never replayed and preserves its draft for correction', async () => {
    const f = await fixture(); f.draft().devices[0].name = 'Do not lose'; f.denyPut(true); await f.save();
    assert.equal(f.requests.filter(request => request.method === 'PUT').length, 1);
    assert.equal(f.loads(), 1); assert.equal(f.draft().devices[0].name, 'Do not lose');
    assert.equal(f.node('eosModuleStatus').dataset.error, 'true');
});
