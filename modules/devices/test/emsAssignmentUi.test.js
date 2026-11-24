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
    vm.runInNewContext(source, { window, crypto: require('node:crypto').webcrypto, HTMLElement: Element, document: { getElementById: () => summary, querySelectorAll: () => [row] } });
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
    assert.match(row.textContent, /EMS-Verwendung/);
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
    assert.match(api.help('ESS', 'monitor', ''), /spätere Betriebsfreigabe erfolgt durch ausdrückliche/);
    assert.match(api.help('ESS', 'manual', ''), /beendet keine bestehende Regelung/);
});

test('optional manufacturer readback is distinguished from required missing data', () => {
    const { api, row, summary } = browser();
    api.render({ state: 'ready', statuses: [{ devId: 'evcs1', status: 'mapped', code: 'COMMISSIONING_REQUIRED', optionalMissing: ['feneconActualSetpointId', '<img>'] }] });
    assert.equal(row.dataset.state, 'mapped');
    assert.match(api.describe('evcs1', {}, true).optionalDetail, /Optional nicht verfügbar: Rückmeldung des tatsächlich angewendeten Sollwerts/);
    assert.doesNotMatch(row.textContent, /<img>|Fehlt:/);
    assert.match(summary.textContent, /1 Gerät\(e\) zugeordnet/);
});

test('profile-independent optional aliases and numeric mapping errors remain clear for every manufacturer', () => {
    const { api, row } = browser();
    api.render({ state: 'ready', statuses: [{ devId: 'evcs1', status: 'mapped', code: 'COMMISSIONING_REQUIRED',
        optionalMissing: ['r.pvPowerDc', 'futureVendorExtraId', 'feneconNvpPowerObjectId'] }] });
    assert.equal(row.dataset.state, 'mapped');
    assert.match(api.describe('evcs1', {}, true).optionalDetail, /PV-Leistung DC/); assert.match(api.describe('evcs1', {}, true).optionalDetail, /Netzanschlussleistung/);
    assert.match(api.describe('evcs1', {}, true).optionalDetail, /1 weitere profilabhängige Datenpunkt-Zuordnung/);
    assert.doesNotMatch(row.textContent, /futureVendor|feneconNvp/);
    api.render({ state: 'ready', statuses: [{ devId: 'evcs1', status: 'mapped', code: 'MAPPING_INCOMPLETE', missing: ['invalid:pvPowerId'] }] });
    assert.equal(row.dataset.state, 'pending');
    assert.match(row.textContent, /Eine Zahl ersetzt keinen Datenpunkt/);
    assert.match(row.textContent, /Gerätefunktionen oder Einstellungen/);
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
    for (let i = 0; i < 30; i++) await f.tick();
    assert.equal(f.reads(), 31, 'one initial read and thirty bounded status polls');
    assert.equal(f.timers.size, 0, 'no endless polling after pending budget expires');
    assert.equal(f.loads(), 1, 'polling never reloads the editable configuration');
    assert.equal(f.renders(), 31);
    f.node('eosEmsRefresh').events.click(); await f.settle();
    assert.equal(f.loads(), 1); assert.equal(f.reads(), 32);
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

test('missing service, empty READY, partial status and global errors never masquerade as completed commissioning', () => {
    const { api, row, summary } = browser();
    api.setDevices([{ id: 'evcs1' }, { id: 'meter1' }]);
    api.render(undefined);
    assert.equal(api.needsPolling(), true); assert.match(row.textContent, /Rückmeldung wird geladen/);
    assert.doesNotMatch(row.textContent, /nach dem Speichern verfügbar/);
    api.render({ state: 'ready', statuses: [] });
    assert.equal(api.needsPolling(), true); assert.match(summary.textContent, /2 gespeicherte.*ohne EMS-Rückmeldung/);
    assert.equal(summary.dataset.state, 'pending');
    api.render({ state: 'ready', statuses: [{ deviceId: 'evcs1', status: 'mapped', code: 'ACTIVATION_APPLIED', activationApplied: true }] });
    assert.equal(api.needsPolling(), true); assert.match(row.textContent, /EMS eingerichtet/);
    assert.match(row.textContent, /wartet auf gültige Messwerte/);
    api.render({ state: 'error', code: 'EOS_EMS_BRIDGE_UNAVAILABLE', statuses: [{ deviceId: 'evcs1', code: 'EOS_EMS_BRIDGE_UNAVAILABLE', status: 'pending' }] });
    assert.equal(api.needsPolling(), false); assert.equal(row.dataset.state, 'conflict');
    assert.match(row.textContent, /EMS-Verbindung nicht verfügbar/); assert.match(summary.textContent, /fehlgeschlagen/);
});

test('explicit global Save commissions legacy selections once and retains the token across ambiguous retries and unrelated saves', () => {
    const { api } = browser();
    const old = { ...device, category: 'ESS', futureValue: 7, ems: { mode: 'storageFarm', scope: 'M0' } };
    const prepared = api.prepareSave([old], [old]);
    const json = value => JSON.parse(JSON.stringify(value));
    assert.equal(prepared[0].ems.activation.requested, true);
    assert.match(prepared[0].ems.activation.requestId, /^[0-9a-f-]{36}$/);
    assert.equal(prepared[0].futureValue, 7); assert.equal(old.ems.activation, undefined);
    assert.deepEqual(json(api.prepareSave([old], [old])), json(prepared), 'an explicit retry keeps the request token after an ambiguous response');
    const edited = json(prepared); edited[0].name = 'New name';
    assert.equal(api.prepareSave(edited, prepared)[0].ems.activation.requestId, prepared[0].ems.activation.requestId, 'renaming never re-enables a later disabled app');
    const limits = json(prepared); limits[0].ems.activation.limits = { maxChargeW: 5000, maxDischargeW: 5000, coupling: 'dc', capacityKWh: 10 };
    assert.notEqual(api.prepareSave(limits, prepared)[0].ems.activation.requestId, prepared[0].ems.activation.requestId);
    api.setDevices(prepared); api.requestRenewal('evcs1');
    assert.notEqual(api.prepareSave(prepared, prepared)[0].ems.activation.requestId, prepared[0].ems.activation.requestId, 'explicitly rechecking EMS use can renew an intentionally disabled app');
});

test('activation requests survive strict Devices persistence and malformed or unlimited limits are rejected', () => {
    const { api } = browser();
    const deviceWithIntent = { ...device, category: 'EVCS', ems: { mode: 'auto', activation: { requested: true,
        limits: { chargerType: 'ac', phases: 3, minCurrentA: 6, maxCurrentA: 16 } } } };
    const prepared = JSON.parse(JSON.stringify(api.prepareSave([deviceWithIntent], [])));
    assert.deepEqual(validateConfig({ devices: prepared }).devices, prepared);
    for (const mutation of [activation => { activation.requestId = 'invalid'; },
        activation => { activation.limits.minCurrentA = 0; }, activation => { activation.limits.phases = 2; },
        activation => { activation.limits.maxCurrentA = 5; }, activation => { activation.limits.command = 'enable'; }]) {
        const invalid = structuredClone(prepared); mutation(invalid[0].ems.activation);
        assert.throws(() => validateConfig({ devices: invalid }), /EOS_DEVICES_EMS_/);
    }
    const manual = { ...deviceWithIntent, ems: { mode: 'manual' } };
    assert.equal(api.prepareSave([manual], [manual])[0].ems.activation, undefined);
});

test('profile capability chips use explicit datapoint metadata, not category or manufacturer guesses', () => {
    const { api } = browser();
    const template = { category: 'ESS', manufacturer: 'FENECON', datapoints: [
        { type: 'number', role: 'value.power', rw: 'ro', source: { kind: 'modbus', read: { fc: 4, address: 1 } } },
        { type: 'number', role: 'value.battery', unit: '%', rw: 'ro', source: { kind: 'modbus' } },
        { type: 'number', role: 'level.power', rw: 'wo', source: { kind: 'modbus', write: { fc: 16, address: 2 } } },
        { type: 'number', role: 'value.temperature', rw: 'wo', source: { kind: 'modbus' } },
        { type: 'number', role: 'value.energy', rw: 'ro' },
    ] };
    assert.deepEqual(Array.from(api.capabilities(template)), ['Leistungsmessung', 'Ladezustand', 'Leistungsvorgabe', 'Schreibdatenpunkte']);
    assert.deepEqual(Array.from(api.capabilities({ category: 'ESS', manufacturer: 'FENECON', datapoints: [] })), []);
    assert.deepEqual(Array.from(api.capabilities({ category: 'PV_INVERTER', datapoints: [{ type: 'number', role: 'value', name: 'PVPower', rw: 'ro', source: { kind: 'modbus' } }] })), []);
    const catalog = require('../lib/templates.json').templates;
    assert.ok(api.capabilities(catalog.find(item => item.id === 'ess.fenecon.FeneconHomeEssImpl')).includes('Leistungsvorgabe'));
    assert.ok(!api.capabilities(catalog.find(item => item.id === 'meter.sma.SmaEnergyMeterSpeedwireImpl')).includes('Leistungsvorgabe'));
});

test('a previous activation acknowledgement cannot confirm a newly saved request, while current errors stay visible', () => {
    const { api, row, summary } = browser();
    api.setDevices([{ id: 'evcs1', ems: { mode: 'auto', activation: { requested: true, requestId: 'new-request' } } }]);
    api.render({ state: 'ready', statuses: [{ deviceId: 'evcs1', status: 'mapped', code: 'ACTIVATION_APPLIED', activationApplied: true, activationRequestId: 'previous-request' }] });
    assert.equal(api.needsPolling(), true); assert.equal(row.dataset.state, 'pending');
    assert.match(row.textContent, /bisherige Rückmeldung gilt nicht als neue Freigabe/);
    assert.equal(summary.dataset.state, 'pending');
    api.render({ state: 'ready', statuses: [{ deviceId: 'evcs1', status: 'pending', code: 'ACTIVATION_PENDING', missing: ['limit:maxChargeW', 'reference:powerId'] }] });
    assert.match(row.textContent, /maximale Ladeleistung.*Leistungsmesswert/);
    api.render({ state: 'ready', statuses: [{ deviceId: 'evcs1', status: 'mapped', code: 'ACTIVATION_APPLIED', activationApplied: true, activationRequestId: 'new-request' }] });
    assert.equal(api.needsPolling(), false); assert.match(row.textContent, /EMS eingerichtet/);
});

test('explicit profile or device-class change renews the binding-specific activation without renewing unrelated edits', () => {
    const { api } = browser();
    const original = { ...device, category: 'EVCS', ems: { mode: 'auto', activation: { requested: true, requestId: '0ef06100-32c6-4d34-baf4-e6503a205c22', limits: {} } } };
    const changed = structuredClone(original); changed.templateId = 'fixture.other';
    const prepared = api.prepareSave([changed], [original]);
    assert.notEqual(prepared[0].ems.activation.requestId, original.ems.activation.requestId);
    changed.category = 'EVSE';
    assert.notEqual(api.prepareSave([changed], [original])[0].ems.activation.requestId, prepared[0].ems.activation.requestId);
    const disabled = structuredClone(original); disabled.ems.activation.requested = false; disabled.templateId = 'fixture.other';
    assert.equal(api.prepareSave([disabled], [disabled])[0].ems.activation.requestId, original.ems.activation.requestId);
});


test('module runtime READY is only startup permission and failure never claims working telemetry', () => {
    const { api } = browser();
    const starting = api.runtimeStatus({ enabled: true, active: false, reason: 'READY', details: {} });
    assert.equal(starting.state, 'starting'); assert.equal(starting.monitor, true);
    assert.match(starting.text, /noch keine laufende Gerätekommunikation/);
    const failed = api.runtimeStatus({ enabled: true, active: false, reason: 'START_FAILED_RESTART_REQUIRED', details: { lastError: 'credential-private-secret' } });
    assert.equal(failed.state, 'error'); assert.match(failed.text, /konnte nicht starten/); assert.doesNotMatch(failed.text, /credential-private-secret/);
    const waiting = api.runtimeStatus({ enabled: true, active: true, reason: 'RUNNING', details: { state: 'running', connected: false } });
    assert.equal(waiting.state, 'waiting'); assert.match(waiting.text, /Noch keine aktuellen Gerätedaten bestätigt/);
    const connected = api.runtimeStatus({ enabled: true, active: true, reason: 'RUNNING', details: { state: 'running', connected: true } });
    assert.equal(connected.state, 'running'); assert.match(connected.text, /Messwertfrische je Gerät prüfen/);
    assert.doesNotMatch(connected.text, /alle.*aktuell|alle.*normal|liefert aktuelle/i);
    assert.equal(api.runtimeStatus({ enabled: false, reason: 'DISABLED' }).monitor, false);
});
