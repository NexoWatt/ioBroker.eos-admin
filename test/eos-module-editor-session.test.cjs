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

async function fixture(settings = {}) {
    const nodes = new Map(); const domEvents = new Map(); const requests = [];
    let token = 'initial-csrf'; let authenticated = true; let loads = 0; let denyPut = false;
    let onChange = () => {}; let confirmations = 0;
    let stored = { enabled: settings.enabled === true, devices: [{ id: 'ess1', name: 'Existing ESS', connection: { password: '__EOS_SECRET_UNCHANGED__' } }] };
    let edited = structuredClone(stored);
    const node = id => {
        if (!nodes.has(id)) nodes.set(id, { textContent: '', dataset: {}, events: {}, children: [], checked: false,
            addEventListener(name, handler) { this.events[name] = handler; }, append(child) { this.children.push(child); } });
        return nodes.get(id);
    };
    const context = { Error, AbortSignal, Promise, console, window: { confirm() { confirmations++; return settings.confirmDiscard === true; } }, document: {
        getElementById: node, querySelectorAll: () => [], createElement: () => ({}),
        addEventListener: (name, handler) => domEvents.set(name, handler),
    }, async load(config, changed) { loads++; onChange = changed; edited = structuredClone(config); changed(false); }, save(callback) { callback(edited); },
    async fetch(url, options) {
        const method = options.method || 'GET'; requests.push({ url, ...options, method });
        if (!authenticated) return { status: 401, ok: false };
        if (method === 'POST' && settings.importError) return { status: 400, ok: false, json: async () => ({ error: settings.importError }) };
        if (method === 'PUT') {
            if (denyPut) return { status: 403, ok: false };
            assert.equal(options.headers['x-nw-csrf'], token);
            stored = JSON.parse(options.body).config;
        }
        return { status: 200, ok: true, json: async () => ({ config: structuredClone(stored), configurationReady: settings.configurationReady !== false,
            configurationReason: settings.configurationReason,
            manualImport: settings.manualImport, csrfToken: token, migration: settings.migration || null, status: { active: false, reason: settings.reason || 'DISABLED' } }) };
    } };
    vm.runInNewContext(source, context, { filename: 'host-bridge.js' }); domEvents.get('DOMContentLoaded')();
    // Configuration/edit readiness is separate from the periodically updated
    // runtime status. Wait for the actual completed load, not an obsolete label.
    await flushUntil(() => loads === 1 && node('eosModuleReload').disabled === false);
    assert.match(node('eosModuleStatus').textContent, /Gerätekonfiguration geladen|Konfiguration gesperrt/);
    assert.notEqual(node('eosModuleRuntimeStatus').textContent, '');
    return { node, requests, draft: () => edited, stored: () => stored, loads: () => loads,
        changed() { onChange(true); }, confirmations: () => confirmations,
        readiness(value, reason = '') { settings.configurationReady = value; settings.configurationReason = reason; },
        authenticate(value, nextToken = token) { authenticated = value; token = nextToken; }, denyPut(value) { denyPut = value; },
        async import() { node('eosLegacyInstance').value = 'nexowatt-devices.0'; node('eosModuleImport').events.click(); await flushUntil(() => node('eosModuleReload').disabled === false); },
        async save() { node('eosModuleSave').events.click(); await flushUntil(() => node('eosModuleReload').disabled === false); },
        async reload() { node('eosModuleReload').events.click(); await flushUntil(() => node('eosModuleReload').disabled === false); },
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


test('enabled stored module exposes the exact import prerequisite and never posts a manual import', async () => {
    const f = await fixture({ enabled: true });
    assert.equal(f.node('eosModuleImport').disabled, true);
    assert.match(f.node('eosImportHint').textContent, /gespeicherte Gerätemodul deaktiviert/);
    f.node('eosModuleEnabled').checked = false;
    await f.import();
    assert.equal(f.requests.some(request => request.url.endsWith('/import')), false, 'unsaved checkbox alone cannot unlock import');
    assert.equal(f.stored().enabled, true);
    await f.save();
    assert.equal(f.stored().enabled, false);
    assert.equal(f.node('eosModuleImport').disabled, false);
});

test('preserved automatic migration cannot be replaced by a manual import from the editor', async () => {
    const f = await fixture({ migration: { preserveNamespace: true, source: 'nexowatt-devices.0' } });
    assert.equal(f.node('eosModuleImport').disabled, true);
    assert.match(f.node('eosImportHint').textContent, /ursprünglichen Datenpunkt-IDs/);
    await f.import();
    assert.equal(f.requests.some(request => request.url.endsWith('/import')), false);
    assert.equal(f.loads(), 1);
});

test('manual import explains a newly blocked server state without losing the draft or replaying writes', async () => {
    const f = await fixture({ importError: 'EOS_MODULE_IMPORT_REQUIRES_DISABLED' });
    f.draft().devices[0].name = 'Unsaved customer setting';
    await f.import();
    assert.equal(f.requests.filter(request => request.url.endsWith('/import')).length, 1);
    assert.match(f.node('eosModuleStatus').textContent, /Speichern und übernehmen/);
    assert.doesNotMatch(f.node('eosModuleStatus').textContent, /^EOS_MODULE_/);
    assert.equal(f.draft().devices[0].name, 'Unsaved customer setting');
    assert.equal(f.loads(), 1);
});

test('unconfirmed module stop blocks the editor import without instructing an unsafe retry', async () => {
    const f = await fixture({ reason: 'STOP_FAILED_RESTART_REQUIRED' });
    assert.equal(f.node('eosModuleImport').disabled, true);
    assert.match(f.node('eosImportHint').textContent, /Stopp des Gerätemoduls ist nicht bestätigt/);
    await f.import();
    assert.equal(f.requests.some(request => request.url.endsWith('/import')), false);
});

test('uninitialized module configuration stays readable but cannot be saved or manually imported', async () => {
    const f = await fixture({ configurationReady: false, manualImport: { allowed: false, reason: 'EOS_MODULE_NOT_READY' } });
    assert.equal(f.node('eosModuleImport').disabled, true);
    assert.equal(f.node('eosModuleSave').disabled, true);
    assert.equal(f.node('eosModuleReload').disabled, false);
    assert.equal(f.node('eosDeviceEditor').inert, true);
    assert.equal(f.node('eosModuleEnabled').disabled, true);
    assert.equal(f.node('eosConfigurationHelp').hidden, false);
    assert.match(f.node('eosModuleStatus').textContent, /Konfiguration gesperrt/);
    assert.match(f.node('eosImportHint').textContent, /kontrollierter EOS-Neustart/);
    await f.import();
    assert.equal(f.requests.some(request => request.method === 'POST'), false);
    await f.save();
    assert.equal(f.requests.some(request => request.method === 'PUT'), false);
});

test('migration-blocked editor explains the prerequisite and unlocks after a fresh released configuration load', async () => {
    const f = await fixture({ configurationReady: false, configurationReason: 'EOS_MODULE_MIGRATION_BLOCKED',
        manualImport: { allowed: false, reason: 'EOS_MODULE_NOT_READY' } });
    assert.equal(f.node('eosDeviceEditor').inert, true);
    assert.match(f.node('eosModuleStatus').textContent, /Bestandsübernahme ist noch nicht freigegeben/);
    assert.equal(f.node('eosModuleSave').disabled, true);
    f.readiness(true); await f.reload();
    assert.equal(f.node('eosDeviceEditor').inert, false);
    assert.equal(f.node('eosModuleEnabled').disabled, false);
    assert.equal(f.node('eosModuleSave').disabled, false);
    assert.equal(f.node('eosConfigurationHelp').hidden, true);
    f.draft().devices.push({ id: 'meter1', templateId: 'meter.sma.SmaEnergyMeterSpeedwireImpl', protocol: 'speedwire' });
    f.changed(); f.node('eosModuleEnabled').checked = true; f.node('eosModuleEnabled').events.change();
    await f.save();
    assert.equal(f.stored().devices.length, 2);
    assert.equal(f.stored().devices[1].id, 'meter1');
    assert.equal(f.stored().enabled, true);
    assert.equal(f.stored().devices[0].connection.password, '__EOS_SECRET_UNCHANGED__');
});

test('reload does not silently discard the pending device draft', async () => {
    const f = await fixture();
    f.draft().devices[0].name = 'Pending customer device'; f.changed();
    const requests = f.requests.length;
    await f.reload();
    assert.equal(f.confirmations(), 1);
    assert.equal(f.requests.length, requests);
    assert.equal(f.loads(), 1);
    assert.equal(f.draft().devices[0].name, 'Pending customer device');
    await f.save();
    assert.equal(f.stored().devices[0].name, 'Pending customer device');
});
