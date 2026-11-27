/** Copyright (c) 2026 NexoWatt. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const page = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../ui/www/live-display.js'), 'utf8'), page);
const { status, dashboardStatus } = page.window.NexoWattLiveDisplay;
const now = 1700002000000;
const alive = 'ems.core.schedulerAlive';
const heartbeat = 'ems.core.schedulerHeartbeatAt';
const nvp = 'ems.gridMeasurementFresh';
const measurement = 'derived.core.grid.netW';
const row = (value, options = {}) => ({ value, ts: now, q: 0, ack: true, ...options });
const normal = () => ({ [alive]: row(true), [heartbeat]: row(now), [nvp]: row(true) });
const points = (level, text, total = 1) => ({ globalSafety: false, total, overallLevel: level, systemText: text });
const idle = points('ok', 'Alle Systeme normal');
const processes = (state = 'ok', failed = [], paused = [], observedAt = now) => ({ state, observedAt, failed, paused, deviceHealth:{state:"ok",offline:[],totalOffline:0} });
function expectHeadline(health, connection, charging, safety, fallback, text, level, supervisor = processes()) {
    const actual = dashboardStatus(health, connection, charging, safety, fallback, supervisor, now);
    assert.equal(actual.level, level);
    assert.equal(actual.text, text);
    return actual;
}

test('only current, confirmed engine and NVP data establish a normal status', () => {
    for (const acknowledgements of [true, undefined]) {
        const snapshot = normal();
        for (const value of Object.values(snapshot)) {
            value.ack = acknowledgements;
            value.lc = now - 8 * 3600000;
        }
        expectHeadline(status(snapshot, true, now), 'ready', idle, false, false, 'Alle Systeme normal', 'ok');
    }
    for (const [key, signal] of [[alive,'EMS-Betriebsmeldung'], [heartbeat,'EMS-Herzschlag'], [nvp,'NVP-Bestätigung']]) {
        for (const invalid of [
            { ts: now - 30001 }, { ts: now + 6000 }, { ts: null }, { q: 64 }, { ack: false }, { ack: 'true' }
        ]) {
            const snapshot = normal();
            Object.assign(snapshot[key], invalid);
            const problem = invalid.ts === now - 30001 ? 'veraltet' : 'ungültig';
            expectHeadline(status(snapshot, true, now), 'ready', idle, false, false, signal + ' ' + problem, 'warn');
        }
        const snapshot = normal();
        delete snapshot[key];
        expectHeadline(status(snapshot, true, now), 'snapshot', idle, false, false, signal + ' fehlt', 'warn');
    }
    for (const badHeartbeat of [0, now - 30001, now + 6000]) {
        const snapshot = { ...normal(), [heartbeat]: row(badHeartbeat) };
        assert.equal(status(snapshot, true, now).ems, badHeartbeat === now - 30001 ? 'EMS-Herzschlag veraltet' : 'EMS-Herzschlag ungültig');
    }
});

test('legacy grid measurements can inform the grid row but cannot clear an EMS status', () => {
    const snapshot = { ...normal(), [measurement]: row(0) };
    delete snapshot[nvp];
    let health = status(snapshot, true, now);
    assert.equal(health.grid, 'Messwert vorhanden · Bestätigung fehlt');
    assert.equal(health.ems, 'Aktiv');
    expectHeadline(health, 'ready', idle, false, false, 'NVP-Bestätigung fehlt', 'warn');
    for (const [broken, expected] of [[{},'ungültig'], [null,'fehlt'], [row(true, { q: 128 }),'ungültig'], [row(false, { ts: now - 31000 }),'veraltet']]) {
        health = status({ ...snapshot, [nvp]: broken }, true, now);
        assert.equal(health.grid, 'NVP-Bestätigung ' + expected);
    }
    for (const badGrid of [row(0, { ack: false }), row(0, { ts: now - 100000 }), row(null)]) {
        health = status({ ...snapshot, [measurement]: badGrid }, true, now, 90000);
        assert.equal(health.grid, 'NVP-Bestätigung fehlt');
    }
    health = status({ ...snapshot, [nvp]: row(false) }, true, now);
    assert.equal(health.grid, 'Messung fehlt / veraltet');
    expectHeadline(health, 'ready', idle, false, false, 'Netzmessung fehlt oder ist veraltet', 'warn');
});

test('an offline or connecting dashboard cannot be marked healthy by old engine and charging data', () => {
    const health = status(normal(), true, now);
    expectHeadline(health, 'connecting', idle, false, false, 'Verbinde…', 'warn');
    expectHeadline(health, 'disconnected', { ...idle, globalSafety: true }, true, true, 'Verbindung unterbrochen', 'error');
    expectHeadline(status(normal(), false, now), 'ready', idle, false, false, 'Verbindung unterbrochen', 'error');
    expectHeadline(status({}, true, now), 'snapshot', idle, false, false, 'EMS-Betriebsmeldung fehlt', 'warn');
    expectHeadline(health, 'snapshot', null, false, false, 'Alle Systeme normal', 'ok');
});

test('emergency and stopped EMS take precedence over charging messages; localized point faults remain visible', () => {
    const healthy = status(normal(), true, now);
    const stopped = status({ ...normal(), [alive]: row(false) }, true, now);
    const unknown = status({}, true, now);
    const fault = points('error', 'Charging point fault');
    const warning = points('warn', 'Ladepunkt eingeschränkt');
    expectHeadline(stopped, 'ready', fault, true, true, 'Sicherheitsstopp aktiv', 'error');
    expectHeadline(healthy, 'ready', { ...idle, globalSafety: true, total: 0 }, false, false, 'Sicherheitsstopp aktiv', 'error');
    expectHeadline(stopped, 'ready', fault, false, false, 'EMS gestoppt', 'error');
    expectHeadline(unknown, 'ready', fault, false, true, 'Charging point fault', 'error');
    expectHeadline(unknown, 'ready', warning, false, false, 'Ladepunkt eingeschränkt', 'warn');
    expectHeadline(healthy, 'ready', warning, false, true, '§14a-Kommunikationsfallback aktiv', 'warn');
    expectHeadline(healthy, 'ready', warning, false, false, 'Ladepunkt eingeschränkt', 'warn');
    expectHeadline(healthy, 'ready', points('warn', 'alte Ladepunktwarnung', 0), false, false, 'Alle Systeme normal', 'ok');
});

test('fresh supervisor fault identifies specific internal processes even when the SSE stream has stopped', () => {
    const healthy = status(normal(), true, now);
    const faults = processes('fault', ['backup', 'devices'], ['eebus']);
    for (const [connection, safety, expected] of [
        ['ready', false, 'Prozess gestört · {names}'],
        ['ready', true, 'Sicherheitsstopp aktiv · Prozess gestört: {names}'],
        ['disconnected', true, 'Live-Verbindung unterbrochen · Prozess gestört: {names}']
    ]) {
        const result = expectHeadline(healthy, connection, idle, safety, false, expected, 'error', faults);
        assert.deepEqual(Array.from(result.processIds), ['devices', 'backup']);
    }
    const expired = { ...faults, observedAt: now - 30001 };
    expectHeadline(healthy, 'disconnected', idle, false, false, 'Verbindung unterbrochen', 'error', expired);
    expectHeadline(healthy, 'ready', idle, false, false, 'Prozessstatus unbekannt', 'warn', expired);
});

test('an unverified, expired or inconsistent supervisor cannot clear the dashboard or hide a concrete alert', () => {
    const healthy = status(normal(), true, now);
    for (const untrusted of [null, {}, processes('unknown'), processes('ok', [], [], now - 30001),
        processes('ok', [], [], now + 5001), processes('ok', ['ems']), processes('fault', []),
        processes('ok', [], ['unknown-adapter']), processes('fault', ['ui', 'ui']),
        processes('fault', ['ui'], ['ui']), { state: 'ok', observedAt: now }]) {
        expectHeadline(healthy, 'ready', idle, false, false, 'Prozessstatus unbekannt', 'warn', untrusted);
        const pointFault = points('error', 'Ladepunkt offline');
        expectHeadline(healthy, 'ready', pointFault, false, false, 'Ladepunkt offline', 'error', untrusted);
        const missingGrid = status({ ...normal(), [nvp]: row(false) }, true, now);
        expectHeadline(missingGrid, 'ready', idle, false, false, 'Netzmessung fehlt oder ist veraltet', 'warn', untrusted);
    }
    expectHeadline(healthy, 'ready', idle, false, false, 'Alle Systeme normal', 'ok', processes('ok', [], [], now - 30000));
});

test('intentionally paused modules are distinguished from outages and allow other active faults to surface', () => {
    const healthy = status(normal(), true, now);
    const stopped = status({ ...normal(), [alive]: row(false) }, true, now);
    const unknown = status({}, true, now);
    const emsPause = processes('ok', [], ['ems']);
    expectHeadline(stopped, 'snapshot', idle, false, false, 'EMS pausiert', 'info', emsPause);
    expectHeadline(unknown, 'ready', idle, false, false, 'EMS pausiert', 'info', emsPause);
    expectHeadline(healthy, 'ready', idle, false, false, 'Alle Systeme normal', 'ok', processes('ok', [], ['ocpp','backup']));
    expectHeadline(stopped, 'ready', idle, false, false, 'Prozess gestört · {names}', 'error', processes('fault', ['devices'], ['ems']));
    expectHeadline(stopped, 'ready', points('error', 'Ladepunkt gestört'), false, false, 'Ladepunkt gestört', 'error', emsPause);
});

test('handover identifies a running standby worker without suppressing an unrelated active stop', () => {
    const healthy = status(normal(), true, now);
    const stopped = status({ ...normal(), [alive]: row(false) }, true, now);
    const waiting = { ...processes('unknown', [], []), waiting:['devices'] };
    expectHeadline(healthy, 'ready', idle, false, false, 'Wartet auf Übernahme · {names}', 'warn', waiting);
    expectHeadline(stopped, 'ready', idle, false, false, 'EMS gestoppt', 'error', waiting);
    expectHeadline(stopped, 'ready', idle, false, false, 'Wartet auf Übernahme · {names}', 'warn', { ...waiting, waiting:['ems'] });
    expectHeadline(healthy, 'ready', idle, true, false, 'Sicherheitsstopp aktiv', 'error', waiting);
});

test('dashboard and mail validate the same signed and time-coherent member report', () => {
    const browserRead = page.window.NexoWattLiveDisplay.farmPowerComparison;
    const { farmPowerComparison: serverRead, farmPowerWarningLimitW } = require('../ui/www/live-display');
    assert.equal(farmPowerWarningLimitW, 200);
    const sample = { dispatchKey: 'id-a', name: 'Speicher A', online: true,
        powerComparison: { v: 1, targetW: -636, measuredW: -435, differenceW: 201,
            commandAt: now - 80000, sampledAt: now - 1000, validUntil: now + 5000, warning: true } };
    for (const read of [browserRead, serverRead]) {
        assert.deepEqual({ ...read(sample, now) }, sample.powerComparison);
        const converter = { ...sample.powerComparison, domain:'ess-ac' };
        assert.deepEqual({ ...read({ ...sample, powerComparison:converter }, now) }, converter);
        assert.equal(read(sample, sample.powerComparison.validUntil + 1), null);
        assert.equal(read(sample, sample.powerComparison.validUntil)?.differenceW, 201);
        assert.equal(read({ ...sample, online: false }, now), null);
        assert.equal(read({ ...sample, dispatchKey: '  ' }, now), null);
        assert.equal(read({ ...sample, powerComparison: null }, now), null);
        for (const patch of [{ v: 2 }, { domain:'grid' }, { domain:null }, { targetW: '636' }, { measuredW: 435 }, { differenceW: null },
            { commandAt: now }, { sampledAt: now + 1 }, { validUntil: now - 1 }, { validUntil: now + 30001 },
            { warning: false }, { measuredW: -436, differenceW: 200, warning: true }]) {
            assert.equal(read({ ...sample, powerComparison: { ...sample.powerComparison, ...patch } }, now), null, JSON.stringify(patch));
        }
        for (const [targetW, measuredW, differenceW, warning] of [[636, 576, 60, false], [0, 200, 200, false], [100,-101,201,true], [0,0,0,false]]) {
            const report = read({ ...sample, powerComparison: { ...sample.powerComparison, targetW, measuredW, differenceW, warning } }, now);
            assert.equal(report?.warning, warning);
        }
    }
});

test('member warnings use unique IDs, stay behind existing alarms and survive a cancelling farm total', () => {
    const healthy = status(normal(), true, now);
    const model = (rows, extra = {}, supervisor = processes(), safety = false, health = healthy) =>
        dashboardStatus(health, 'ready', idle, safety, false, supervisor, now, row(JSON.stringify(rows), extra));
    const member = (id, name, targetW, measuredW) => {
        const differenceW = Math.abs(targetW - measuredW);
        return { dispatchKey:id, name, online:true, powerComparison:{
            v:1, targetW, measuredW, differenceW, commandAt:now-2000, sampledAt:now-1000, validUntil:now+2000, warning:differenceW>200 } };
    };
    const a = member('a','Nord',800,599), b = member('b','Süd',400,601);
    const affected = model([a,b]);
    assert.equal(affected.level, 'warn');
    assert.deepEqual(Array.from(affected.storageWarnings, value => [value.name,value.differenceW]), [['Nord',201],['Süd',201]]);
    for (const members of [[], [a,{...a,powerComparison:null}], [member('a','Nord',400,200)],
        Array.from({length:129}, (_, i) => ({...a, dispatchKey:'d'+i})), [{...a,powerComparison:null}]]) {
        assert.equal(model(members).text, 'Alle Systeme normal');
    }
    for (const bad of [{q:128},{ack:false},{ts:now-30001},{ts:now+1}]) assert.equal(model([a],bad).text,'Alle Systeme normal');
    assert.equal(model([a],{},processes(),true).text,'Sicherheitsstopp aktiv');
    assert.equal(model([a],{},processes(),false,status({...normal(),[nvp]:row(false)},true,now)).text,'Netzmessung fehlt oder ist veraltet');
    assert.equal(model([a],{},processes('fault',['devices'])).text,'Prozess gestört · {names}');
    const offline = { ...processes(), deviceHealth:{state:'fault',offline:[{name:'Garage'}],totalOffline:1} };
    assert.deepEqual(Array.from(model([a],{},offline).deviceNames),['Garage']);
});
