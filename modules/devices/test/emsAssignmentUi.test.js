/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { validateConfig } = require('..');
const source = fs.readFileSync(path.join(__dirname, '../admin/ems-assignment.js'), 'utf8');

function browser() {
    class Element { constructor() { this.dataset = {}; this.textContent = ''; } }
    const summary = new Element();
    const row = new Element(); row.dataset = { eosEmsId: 'evcs1', eosEmsMode: 'auto', eosEmsEnabled: 'true' };
    const window = {};
    vm.runInNewContext(source, { window, HTMLElement: Element, document: { getElementById: () => summary, querySelectorAll: () => [row] } });
    return { api: window.EosDeviceEms, row, summary };
}
const device = { id: 'evcs1', templateId: 'fixture.template', protocol: 'modbusTcp', enabled: true, connection: { host: '192.0.2.50' } };
const saved = ems => validateConfig({ enabled: true, devices: [{ ...device, ems }] }).devices[0].ems;

test('known charging profiles show automatic assignment while storage and meters offer explicit role selection', () => {
    const { api } = browser();
    assert.deepEqual(Array.from(api.modes('EVCS'), item => item.value), ['auto', 'monitor', 'manual']);
    assert.match(api.help('EVCS', 'auto', ''), /automatisch unter Ladepunkte/);
    assert.doesNotMatch(api.help('DC_CHARGER', 'auto', ''), /automatisch unter Ladepunkte/);
    assert.ok(api.modes('ESS').some(item => item.value === 'singleStorage'));
    assert.ok(api.modes('ESS').some(item => item.value === 'storageFarm'));
    assert.ok(api.modes('METER').some(item => item.value === 'gridMeter'));
    assert.ok(api.modes('METER').some(item => item.value === 'generationMeter'));
    assert.ok(api.modes('METER').some(item => item.value === 'consumptionMeter'));
    assert.ok(api.modes('PV_INVERTER').some(item => item.value === 'pvInverter'));
});

test('energy flow choices are the six existing generation fields and ten consumers, without invented aggregation', () => {
    const { api } = browser();
    assert.deepEqual(Array.from(api.targets('pvInverter'), item => item.value), [0, 1, 2, 3, 4, 5]);
    assert.deepEqual(Array.from(api.targets('generationMeter'), item => item.value), [0, 1, 2, 3, 4, 5]);
    assert.deepEqual(Array.from(api.targets('consumptionMeter'), item => item.value), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(api.targets('storageFarm').length, 0);
    assert.match(api.help('METER', 'generationMeter', ''), /nicht doppelt/);
    assert.match(api.help('ESS', 'singleStorage', 'M1'), /keine automatische Steuerfreigabe/);
});

for (const intent of [
    { mode: 'auto' }, { mode: 'monitor' }, { mode: 'manual' },
    { mode: 'singleStorage', scope: 'M0' }, { mode: 'storageFarm', scope: 'M1' },
    { mode: 'gridMeter', scope: 'M1' }, { mode: 'generationMeter', flowSlot: 0 },
    { mode: 'pvInverter', flowSlot: 5 }, { mode: 'consumptionMeter', flowSlot: 10 },
]) test(`device config round-trip preserves EMS intent ${JSON.stringify(intent)}`, () => assert.deepEqual(saved(intent), intent));

for (const intent of [
    null, [], { mode: 'runHardware' }, { mode: 'auto', command: 'run' },
    { mode: 'singleStorage' }, { mode: 'gridMeter', scope: 'M2' },
    { mode: 'auto', scope: 0 }, { mode: 'auto', group: '../foreign' },
    { mode: 'generationMeter', flowSlot: 6 }, { mode: 'pvInverter', flowSlot: '1' },
    { mode: 'pvInverter', flowSlot: 0.5 }, { mode: 'consumptionMeter', flowSlot: 0 },
    { mode: 'consumptionMeter', flowSlot: 11 }, { mode: 'consumptionMeter' },
]) test(`malformed EMS intent is rejected before save: ${JSON.stringify(intent)}`, () => assert.throws(() => saved(intent), /EOS_DEVICES_EMS_/));

test('updating an older device preserves existing fields and does not invent an EMS intent', () => {
    const original = { ...device, futureSetting: { x: 4 } };
    const normalized = validateConfig({ devices: [original] });
    assert.deepEqual(normalized.devices[0], original);
    assert.equal(normalized.devices[0].ems, undefined);
});

test('public mapping status is plain text, identifies commissioning and never claims hardware activation', () => {
    const { api, row, summary } = browser();
    api.render({ state: 'ready', statuses: [{ deviceId: 'evcs1', status: 'mapped', code: 'COMMISSIONING_REQUIRED' }] });
    assert.match(row.textContent, /Zugeordnet/);
    assert.match(row.textContent, /Betriebsfreigabe/);
    assert.match(summary.textContent, /1 Gerät\(e\) zugeordnet/);
    api.render({ state: 'ready', statuses: [{ deviceId: 'evcs1', status: 'conflict', code: '<img src=x onerror=alert(1)>' }] });
    assert.equal(row.dataset.state, 'conflict');
    assert.doesNotMatch(row.textContent, /<img/);
    assert.match(row.textContent, /bleibt erhalten/);
    assert.match(summary.textContent, /1 Zuordnungskonflikt/);
});

test('pending and stopped status do not overwrite the device draft or masquerade as a failed save', () => {
    const { api, summary } = browser();
    const draft = { name: 'Unstored name', ems: { mode: 'storageFarm', scope: 'M0' } };
    const before = structuredClone(draft);
    api.render({ state: 'error', statuses: [] });
    assert.match(summary.textContent, /Geräte gespeichert/);
    assert.deepEqual(draft, before);
    api.render({ state: 'stopped', statuses: [] });
    assert.match(summary.textContent, /pausiert/);
    api.render({ state: 'ready', statuses: [{ deviceId: 'evcs1', status: 'mapped' }] });
    assert.equal(api.describe('evcs1', { mode: 'auto' }, false).status, 'disabled');
});

test('partial mappings remain visibly incomplete and occupied targets explain the preserved mapping', () => {
    const { api, row, summary } = browser();
    api.render({ state: 'ready', statuses: [{ devId: 'evcs1', status: 'mapped', code: 'MAPPING_INCOMPLETE', missing: ['powerId', 'onlineId|heartbeatId', '<script>secret</script>'] }] });
    assert.equal(row.dataset.state, 'pending');
    assert.match(row.textContent, /Teilweise zugeordnet/);
    assert.match(row.textContent, /Fehlt: Leistungsmesswert, Verbindungsstatus/);
    assert.doesNotMatch(row.textContent, /<script>/);
    assert.match(summary.textContent, /0 Gerät\(e\) zugeordnet · 1 unvollständig/);
    assert.equal(summary.dataset.state, 'pending');
    api.render({ state: 'ready', statuses: [{ devId: 'evcs1', status: 'conflict', code: 'MEASUREMENT_ALREADY_ASSIGNED' }] });
    assert.match(row.textContent, /Doppelzählung vermeiden/);
    api.render({ state: 'ready', statuses: [{ devId: 'evcs1', status: 'manual', code: 'MONITOR_ONLY' }] });
    assert.match(row.textContent, /automatisch verwaltete Steuereinträge deaktiviert/);
    assert.match(api.help('ESS', 'monitor', ''), /Andere manuelle Einträge bleiben unverändert/);
    assert.match(api.help('ESS', 'monitor', ''), /spätere Betriebsfreigabe erfolgt manuell/);
    assert.match(api.help('ESS', 'manual', ''), /beendet keine bestehende Regelung/);
});

test('optional manufacturer readback is distinguished from required missing data', () => {
    const { api, row, summary } = browser();
    api.render({ state: 'ready', statuses: [{ devId: 'evcs1', status: 'mapped', code: 'COMMISSIONING_REQUIRED', optionalMissing: ['feneconActualSetpointId', '<img>'] }] });
    assert.equal(row.dataset.state, 'mapped');
    assert.match(row.textContent, /Optional nicht verfügbar: Rückmeldung des tatsächlich angewendeten Sollwerts/);
    assert.doesNotMatch(row.textContent, /<img>|Fehlt:/);
    assert.match(summary.textContent, /1 Gerät\(e\) zugeordnet/);
});

test('profile-independent optional aliases and numeric mapping errors remain clear for every manufacturer', () => {
    const { api, row } = browser();
    api.render({ state: 'ready', statuses: [{ devId: 'evcs1', status: 'mapped', code: 'COMMISSIONING_REQUIRED',
        optionalMissing: ['r.pvPowerDc', 'futureVendorExtraId', 'feneconNvpPowerObjectId'] }] });
    assert.equal(row.dataset.state, 'mapped');
    assert.match(row.textContent, /PV-Leistung DC/); assert.match(row.textContent, /Netzanschlussleistung/);
    assert.match(row.textContent, /1 weitere profilabhängige Datenpunkt-Zuordnung/);
    assert.doesNotMatch(row.textContent, /futureVendor|feneconNvp/);
    api.render({ state: 'ready', statuses: [{ devId: 'evcs1', status: 'mapped', code: 'MAPPING_INCOMPLETE', missing: ['invalid:pvPowerId'] }] });
    assert.equal(row.dataset.state, 'pending');
    assert.match(row.textContent, /Eine Zahl ersetzt keinen Datenpunkt/);
    assert.match(row.textContent, /Betriebsfreigabe|erforderliche Datenpunkte/);
    api.render({ state: 'ready', statuses: [{ devId: 'evcs1', status: 'mapped', code: 'MAPPING_INCOMPLETE', missing: ['review:feneconGridSetpointObjectId'] }] });
    assert.match(row.textContent, /Regelungsart.*ausdrücklich prüfen/);
    assert.match(row.textContent, /bisherige Direktregelung bleibt erhalten/);
});

async function pollingFixture() {
    const elements = new Map(); const timers = new Map(); const events = new Map();
    let timerId = 0; let loads = 0; let reads = 0; let renders = 0;
    let draft = {}; let onChange = () => {};
    const node = id => {
        if (!elements.has(id)) elements.set(id, { textContent: '', dataset: {}, events: {}, addEventListener(name, handler) { this.events[name] = handler; } });
        return elements.get(id);
    };
    const context = { Error, AbortSignal, Promise, window: {
        EosDeviceEms: { render() { renders++; } },
        setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; },
        clearTimeout(id) { timers.delete(id); }, addEventListener(name, callback) { events.set(name, callback); },
    }, document: { hidden: false, getElementById: node, querySelectorAll: () => [], addEventListener(name, callback) { events.set(name, callback); } },
    async load(config, changed) { loads++; draft = structuredClone(config); onChange = changed; },
    save(callback) { callback(draft); },
    async fetch(_url, options) {
        assert.equal(options.method, undefined, 'status polling never sends a mutation'); reads++;
        return { status: 200, ok: true, json: async () => ({ config: { enabled: true, devices: [{ id: 'evcs1', name: 'Stored' }] },
            csrfToken: 'fixture-csrf', configurationReady: true, emsCommissioning: { state: 'pending', statuses: [] } }) };
    } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../admin/host-bridge.js'), 'utf8'), context);
    events.get('DOMContentLoaded')();
    const settle = async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)); };
    await settle();
    return { node, events, timers, loads: () => loads, reads: () => reads, renders: () => renders, draft: () => draft,
        changed() { onChange(true); }, settle,
        async tick() { const entry = timers.entries().next().value; assert.ok(entry); timers.delete(entry[0]); entry[1](); await settle(); },
    };
}

test('bounded status polling and explicit refresh preserve unsaved device and EMS selections', async () => {
    const f = await pollingFixture();
    f.draft().devices[0].name = 'Customer draft';
    f.draft().devices[0].ems = { mode: 'storageFarm', scope: 'M0' }; f.changed();
    for (let i = 0; i < 12; i++) await f.tick();
    assert.equal(f.reads(), 13, 'one initial read and twelve bounded status polls');
    assert.equal(f.timers.size, 0, 'no endless polling after pending budget expires');
    assert.equal(f.loads(), 1, 'polling never reloads the editable configuration');
    assert.equal(f.renders(), 13);
    f.node('eosEmsRefresh').events.click(); await f.settle();
    assert.equal(f.loads(), 1); assert.equal(f.reads(), 14);
    assert.equal(f.draft().devices[0].name, 'Customer draft');
    assert.deepEqual(f.draft().devices[0].ems, { mode: 'storageFarm', scope: 'M0' });
    assert.equal(f.node('eosModuleStatus').textContent, 'Ungespeicherte Änderungen.');
});

test('leaving the devices page cancels its pending EMS status poll', async () => {
    const f = await pollingFixture();
    assert.equal(f.timers.size, 1);
    f.events.get('pagehide')();
    assert.equal(f.timers.size, 0);
    assert.equal(f.reads(), 1);
});
