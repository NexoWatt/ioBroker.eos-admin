/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
// Runs the actual TypeScript frontend against a DOM/API contract fixture.
// This is not a real browser, provider API or hardware proof.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { createRequire } = require('node:module');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'ui/src-ts/runtime-executables/www/customer-tariff.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const backendSource = fs.readFileSync(path.join(root, 'ui/src-ts/runtime-executables/lib/customer-tariff.ts'), 'utf8');
const backendExports = {};
vm.runInNewContext(ts.transpileModule(backendSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
    { exports: backendExports, require: createRequire(path.join(root, 'ui/lib/customer-tariff.js')) });
const base = () => ({ ok: true, scope: 'system', revision: 'revision-1', configuredExternally: false,
    config: { enabled: true, providerId: 'tibber', sourceId: 'tibber', providerProfileId: 'local-provider', country: 'DE', homeId: 'customer-home', useForTariff: false,
        formula: { marketMultiplier: 1, supplierMarkupEurPerKwh: 0, gridVariableEurPerKwh: 0, taxEurPerKwh: 0, otherVariableEurPerKwh: 0, vatPct: 19, priceIncludesVat: true } },
    credentialsPresent: { accessToken: true, securityToken: false },
    providers: [
        { id: 'manual-dp', name: 'Vorhandene Datenpunkte', countries: ['DE', 'NL'] },
        { id: 'tibber', name: 'Tibber API', countries: ['DE', 'NL'] },
        { id: 'entsoe', name: 'ENTSO-E', countries: ['DE', 'NL'] },
        { id: 'energyzero', name: 'EnergyZero', countries: ['NL'] },
        { id: 'market-profile', name: 'Anbieterprofil', countries: ['DE', 'NL'] },
    ], profiles: [{ id: 'local-provider', name: 'Stadtwerk', country: 'DE/NL' }, { id: 'rabot', name: 'Rabot Energy', country: 'DE' }],
    status: { state: 'ready', lastUpdate: 1700000000000 } });

function fixture(initial = base()) {
    class Element {
        constructor(id = '') { this.id = id; this.value = ''; this.checked = false; this.disabled = false; this.hidden = false; this.dataset = {}; this.events = {}; this.children = []; this.textContent = ''; }
        addEventListener(name, callback) { this.events[name] = callback; }
        replaceChildren() { this.children = []; this.value = ''; }
        appendChild(child) { this.children.push(child); }
    }
    class Input extends Element {} class Select extends Element {} class Button extends Element {} class Fieldset extends Element {}
    class Details extends Element { constructor(id) { super(id); this.open = false; } }
    class Form extends Element { reportValidity() { return true; } }
    const ids = [...fs.readFileSync(path.join(root, 'ui/www/settings.html'), 'utf8').matchAll(/\bid="(customerTariff[^"]+)"/g)].map(match => match[1]);
    const selects = new Set(['customerTariffCountry', 'customerTariffProvider', 'customerTariffSource', 'customerTariffProfile']);
    const inputs = new Set(['customerTariffEnabled', 'customerTariffUse', 'customerTariffHome', 'customerTariffCredential', 'customerTariffIncludesVat',
        'customerTariffMultiplier', 'customerTariffMarkup', 'customerTariffGrid', 'customerTariffTax', 'customerTariffOther', 'customerTariffVat']);
    const nodes = new Map(ids.map(id => [id, new (selects.has(id) ? Select : inputs.has(id) ? Input : id === 'customerTariffForm' ? Form : id === 'customerTariffFields' ? Fieldset
        : ['customerTariffSave', 'customerTariffReload'].includes(id) ? Button : ['customerTariffPanel', 'customerTariffFormula'].includes(id) ? Details : Element)(id)]));
    const events = {}; const requests = []; let saved = structuredClone(initial); let getStatus = 200; let getErrorCode = ''; let timerSequence = 0; const timers = new Map(); let putStatus = 200; let confirms = 0; let allowDiscard = false;
    const context = { console, AbortSignal, AbortController, Error, HTMLElement: Element, HTMLInputElement: Input, HTMLSelectElement: Select, HTMLButtonElement: Button, HTMLFieldSetElement: Fieldset, HTMLDetailsElement: Details, HTMLFormElement: Form,
        document: { readyState: 'complete', getElementById: id => nodes.get(id), createElement: () => new Element() },
        window: { setTimeout(callback) { const id = ++timerSequence; timers.set(id, callback); return id; }, clearTimeout(id) { timers.delete(id); }, addEventListener(name, callback) { events[name] = callback; }, confirm() { confirms++; return allowDiscard; } },
        async fetch(url, options) {
            const method = options.method || 'GET'; requests.push({ url, options, method }); const responseStatus = method === 'PUT' ? putStatus : getStatus;
            if (method === 'PUT' && responseStatus === 200) {
                const payload = JSON.parse(options.body); const patch = payload.config; const credentials = patch.credentials;
                delete patch.credentials;
                saved = { ...saved, revision: 'revision-2', config: { ...saved.config, ...patch, formula: { ...saved.config.formula, ...patch.formula } } };
                if (credentials?.accessToken) saved.credentialsPresent.accessToken = true;
                if (credentials?.securityToken) saved.credentialsPresent.securityToken = true;
            }
            return { status: responseStatus, ok: responseStatus === 200, json: async () => getErrorCode && method === 'GET' && responseStatus !== 200 ? { ok: false, error: getErrorCode } : structuredClone(saved) };
        },
    };
    vm.runInNewContext(compiled, context);
    const node = id => { assert.ok(nodes.has(id), id); return nodes.get(id); };
    const settle = async () => { for (let index = 0; index < 8; index++) await new Promise(resolve => setImmediate(resolve)); };
    return { node, requests, events, timers, async tick() { const entries = [...timers]; timers.clear(); for (const [, run] of entries) run(); await settle(); },
        async close() { node('customerTariffPanel').open = false; node('customerTariffPanel').events.toggle(); await settle(); }, saved: () => saved, confirms: () => confirms,
        errors(status) { putStatus = status; }, getErrors(status, code = '') { getStatus = status; getErrorCode = code; }, confirmDiscard(value) { allowDiscard = value; },
        async open() { node('customerTariffPanel').open = true; node('customerTariffPanel').events.toggle(); await settle(); },
        change(id, value, change = false) { const target = node(id); if (typeof value === 'boolean') target.checked = value; else target.value = value;
            node('customerTariffForm').events[change ? 'change' : 'input']({ target }); },
        async save() { node('customerTariffForm').events.submit({ preventDefault() {} }); await settle(); },
        async reload() { node('customerTariffReload').events.click(); await settle(); },
    };
}

test('tariff editor loads lazily and renders secret presence without copying secret values', async () => {
    const data = base(); data.config.credentials = { accessToken: 'must-never-display' };
    const f = fixture(data); assert.equal(f.requests.length, 0); await f.open();
    assert.equal(f.requests.length, 1); assert.equal(f.requests[0].url, '/api/customer/tariff-provider');
    assert.equal(f.requests[0].options.credentials, 'same-origin');
    assert.equal(f.node('customerTariffCredential').value, '');
    assert.match(f.node('customerTariffCredentialHint').textContent, /gespeichert/);
    assert.match(f.node('customerTariffFetchStatus').textContent, /Preisabruf erfolgreich/);
    assert.equal(f.node('customerTariffSave').disabled, true);
});

test('single setting sends only its revisioned tariff delta, never full AppCenter data or blank secret', async () => {
    const f = fixture(); await f.open(); f.change('customerTariffHome', 'new-home'); await f.save();
    const writes = f.requests.filter(item => item.method === 'PUT'); assert.equal(writes.length, 1);
    assert.deepEqual(JSON.parse(writes[0].options.body), { expectedRevision: 'revision-1', config: { homeId: 'new-home' } });
    assert.equal(f.node('customerTariffCredential').value, '');
    assert.match(f.node('customerTariffStatus').textContent, /gespeichert/);
});

test('source switch requires its own token and clears typed token from the previous source', async () => {
    const data = base(); data.credentialsPresent.securityToken = true;
    const f = fixture(data); await f.open();
    f.change('customerTariffCredential', 'old-source-draft');
    f.change('customerTariffProvider', 'entsoe', true);
    assert.equal(f.node('customerTariffCredential').value, '');
    assert.match(f.node('customerTariffCredentialHint').textContent, /nicht übernommen/);
    await f.save(); assert.equal(f.requests.filter(item => item.method === 'PUT').length, 0);
    assert.match(f.node('customerTariffStatus').textContent, /passenden Zugangsschlüssel/);
    f.change('customerTariffCredential', 'synthetic-entsoe-value'); await f.save();
    assert.deepEqual(JSON.parse(f.requests.find(item => item.method === 'PUT').options.body).config,
        { providerId: 'entsoe', credentials: { securityToken: 'synthetic-entsoe-value' } });
    assert.equal(f.node('customerTariffCredential').value, '');
});

test('actual frontend and backend require a fresh token on provider change even with the same ENTSO-E source', async () => {
    const defaults = base(); const registry = { providers: defaults.providers, profiles: defaults.profiles };
    const original = { tariffProvider: { ...defaults.config, providerId: 'entsoe', sourceId: 'entsoe', credentials: { securityToken: 'synthetic-original-entsoe' } },
        storage: { enabled: true, limitW: 3500 }, datapoints: { unrelated: 'customer.keep.me' } };
    const before = structuredClone(original);
    const data = { ok: true, revision: 'revision-1', ...backendExports.customerTariffView(original, 'eos-admin.0', registry, {}) };
    const f = fixture(data); await f.open(); f.change('customerTariffProvider', 'market-profile', true);
    assert.match(f.node('customerTariffCredentialHint').textContent, /nicht übernommen/);
    assert.match(f.node('customerTariffProviderHint').textContent, /keine direkte Anmeldung/);
    await f.save(); assert.equal(f.requests.filter(item => item.method === 'PUT').length, 0, 'UI blocks the exact request the backend would reject');
    assert.throws(() => backendExports.prepareCustomerTariffChange(original, { providerId: 'market-profile' }, 'eos-admin.0', registry), /Zugangstoken/);
    f.change('customerTariffCredential', 'synthetic-fresh-entsoe');
    await f.save(); const body = JSON.parse(f.requests.find(item => item.method === 'PUT').options.body);
    assert.deepEqual(body.config, { providerId: 'market-profile', credentials: { securityToken: 'synthetic-fresh-entsoe' } });
    const planned = backendExports.prepareCustomerTariffChange(original, body.config, 'eos-admin.0', registry);
    assert.equal(planned.tariffProvider.credentials.securityToken, 'synthetic-fresh-entsoe');
    assert.equal(planned.tariffProvider.providerId, 'market-profile');
    assert.equal(planned.tariffProvider.sourceId, 'entsoe');
    assert.deepEqual(original, before, 'cross-boundary preparation does not mutate stored devices or tariff');
});

test('revision conflict preserves edited values and token and never automatically retries', async () => {
    const f = fixture(); await f.open(); f.change('customerTariffCredential', 'synthetic-unsaved-token'); f.change('customerTariffHome', 'unsaved-home'); f.errors(409); await f.save();
    assert.equal(f.requests.filter(item => item.method === 'PUT').length, 1);
    assert.equal(f.node('customerTariffHome').value, 'unsaved-home'); assert.equal(f.node('customerTariffCredential').value, 'synthetic-unsaved-token');
    assert.match(f.node('customerTariffStatus').textContent, /inzwischen geändert/);
    assert.equal(f.node('customerTariffSave').disabled, false);
});

test('source/provider options contain no custom endpoint choice and preserve installer provider until deliberate switch', async () => {
    const data = base(); data.config.providerId = 'custom-rest'; data.config.sourceId = 'custom-rest'; data.configuredExternally = true;
    data.providers.push({ id: 'custom-rest', name: 'Unsafe URL editor', countries: ['DE'] });
    const f = fixture(data); await f.open();
    assert.equal(f.node('customerTariffProvider').value, '__installer__');
    assert.match(f.node('customerTariffProviderHint').textContent, /Installateur/);
    assert.equal(f.node('customerTariffEnabled').disabled, true);
    assert.equal(f.node('customerTariffProvider').children.filter(item => item.value === 'custom-rest').length, 0);
    assert.match(f.node('customerTariffProvider').children.find(item => item.value === '__installer__').textContent, /Installateur/);
    assert.equal(f.requests.filter(item => item.method === 'PUT').length, 0);
});

test('a known provider name with an external endpoint remains installer-managed until deliberately selected again', async () => {
    const data = base(); data.configuredExternally = true;
    const f = fixture(data); await f.open();
    assert.equal(f.node('customerTariffProvider').value, '__installer__');
    assert.equal(f.node('customerTariffHomeField').hidden, true);
    f.change('customerTariffProvider', 'tibber', true);
    assert.match(f.node('customerTariffCredentialHint').textContent, /nicht übernommen/);
    await f.save(); assert.equal(f.requests.filter(item => item.method === 'PUT').length, 0);
    f.change('customerTariffCredential', 'synthetic-new-trusted-token'); await f.save();
    const patch = JSON.parse(f.requests.find(item => item.method === 'PUT').options.body).config;
    assert.deepEqual(patch, { providerId: 'tibber', credentials: { accessToken: 'synthetic-new-trusted-token' } });
});

test('country change cannot post a hidden stale sourceId for a direct provider', async () => {
    const data = base(); data.config.providerId = 'energyzero'; data.config.sourceId = 'energyzero'; data.config.country = 'NL';
    const f = fixture(data); await f.open(); f.change('customerTariffCountry', 'DE', true); f.change('customerTariffProvider', 'entsoe', true);
    f.change('customerTariffCredential', 'synthetic-country-token'); await f.save();
    const body = JSON.parse(f.requests.find(item => item.method === 'PUT').options.body).config;
    assert.equal(body.providerId, 'entsoe'); assert.equal(body.country, 'DE'); assert.equal(Object.hasOwn(body, 'sourceId'), false);
});

test('formula and use-for-tariff consent are targeted explicit changes', async () => {
    const data = base(); data.config.providerId = 'entsoe'; data.config.sourceId = 'entsoe'; data.credentialsPresent.securityToken = true;
    const f = fixture(data); await f.open(); f.change('customerTariffMarkup', '0.037'); f.change('customerTariffUse', true); await f.save();
    const patch = JSON.parse(f.requests.find(item => item.method === 'PUT').options.body).config;
    assert.deepEqual(patch, { useForTariff: true, formula: { supplierMarkupEurPerKwh: 0.037 } });
    assert.equal(JSON.stringify(patch).includes('activateTariffLogic'), false);
});

test('failed initial load remains locked; untrusted error text is never displayed', async () => {
    const f = fixture(); f.getErrors(503); await f.open();
    assert.equal(f.node('customerTariffFields').disabled, true);
    assert.equal(f.node('customerTariffSave').disabled, true);
    assert.match(f.node('customerTariffStatus').textContent, /nicht bestätigt/);
    await f.save(); assert.equal(f.requests.length, 1);
});

test('authentication failure on save preserves form without replaying writes', async () => {
    const f = fixture(); await f.open(); f.change('customerTariffHome', 'still-unsaved'); f.errors(401); await f.save();
    assert.match(f.node('customerTariffStatus').textContent, /Sitzung abgelaufen/);
    assert.equal(f.node('customerTariffHome').value, 'still-unsaved');
    assert.equal(f.requests.filter(item => item.method === 'PUT').length, 1);
});

test('reload asks before discarding an edit and pagehide clears a typed secret', async () => {
    const f = fixture(); await f.open(); f.change('customerTariffCredential', 'synthetic-draft-secret'); await f.reload();
    assert.equal(f.confirms(), 1); assert.equal(f.requests.length, 1);
    assert.equal(f.node('customerTariffCredential').value, 'synthetic-draft-secret');
    f.events.pagehide(); assert.equal(f.node('customerTariffCredential').value, '');
});

test('provider labels are rendered as plain text and unrelated server fields never enter a save', async () => {
    const data = base(); data.providers[1].name = '<img src=x onerror=alert(1)>'; data.config.storage = { enableWrites: true };
    const f = fixture(data); await f.open();
    assert.equal(f.node('customerTariffProvider').children.find(item => item.value === 'tibber').textContent, '<img src=x onerror=alert(1)>');
    f.change('customerTariffHome', 'changed'); await f.save();
    assert.deepEqual(JSON.parse(f.requests.find(item => item.method === 'PUT').options.body).config, { homeId: 'changed' });
});


test('startup loading retries initial GET only, confirms Tibber and stops its single timer', async () => {
    const f = fixture(); f.getErrors(503, 'EOS_TARIFF_CONFIG_LOADING'); await f.open();
    assert.equal(f.node('customerTariffFields').disabled, true); assert.equal(f.node('customerTariffSave').disabled, true);
    assert.match(f.node('customerTariffStatus').textContent, /EOS startet/); assert.equal(f.requests.length, 1); assert.equal(f.timers.size, 1);
    f.getErrors(200); await f.tick();
    assert.equal(f.requests.length, 2); assert.equal(f.node('customerTariffProvider').value, 'tibber'); assert.equal(f.node('customerTariffEnabled').checked, true);
    assert.match(f.node('customerTariffStatus').textContent, /gespeicherte Tarifanbindung geladen/i); assert.equal(f.timers.size, 0);
});

test('startup retries are bounded and closing or leaving the panel cancels the single pending timer', async () => {
    const f = fixture(); f.getErrors(503, 'EOS_TARIFF_CONFIG_LOADING'); await f.open();
    await f.close(); assert.equal(f.timers.size, 0); await f.tick(); assert.equal(f.requests.length, 1);
    await f.open(); assert.equal(f.requests.length, 2); assert.equal(f.timers.size, 1);
    f.events.pagehide(); assert.equal(f.timers.size, 0);
    const bounded = fixture(); bounded.getErrors(503, 'EOS_TARIFF_CONFIG_LOADING'); await bounded.open();
    for (let index = 0; index < 8; index++) await bounded.tick();
    assert.equal(bounded.requests.length, 6); assert.equal(bounded.timers.size, 0);
    assert.equal(bounded.node('customerTariffFields').disabled, true); assert.equal(bounded.node('customerTariffReload').disabled, false);
    assert.match(bounded.node('customerTariffStatus').textContent, /erneut laden/);
});

test('hydration failure has no retry and an existing draft is never replaced by startup reads', async () => {
    const unavailable = fixture(); unavailable.getErrors(503, 'EOS_TARIFF_CONFIG_UNAVAILABLE'); await unavailable.open();
    assert.equal(unavailable.requests.length, 1); assert.equal(unavailable.timers.size, 0);
    assert.match(unavailable.node('customerTariffStatus').textContent, /Systemstatus/);
    const f = fixture(); await f.open(); f.change('customerTariffHome', 'draft-home'); f.change('customerTariffCredential', 'synthetic-draft');
    f.confirmDiscard(true); f.getErrors(503, 'EOS_TARIFF_CONFIG_LOADING'); await f.reload();
    assert.equal(f.timers.size, 0); assert.equal(f.node('customerTariffHome').value, 'draft-home'); assert.equal(f.node('customerTariffCredential').value, 'synthetic-draft');
    f.errors(503); await f.save(); assert.equal(f.requests.filter(item => item.method === 'PUT').length, 1); assert.equal(f.timers.size, 0);
});
