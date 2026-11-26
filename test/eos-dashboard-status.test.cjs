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
    for (const key of [alive, heartbeat, nvp]) {
        for (const invalid of [
            { ts: now - 30001 }, { ts: now + 6000 }, { ts: null }, { q: 64 }, { ack: false }, { ack: 'true' }
        ]) {
            const snapshot = normal();
            Object.assign(snapshot[key], invalid);
            expectHeadline(status(snapshot, true, now), 'ready', idle, false, false, 'Betriebsstatus prüfen', 'warn');
        }
        const snapshot = normal();
        delete snapshot[key];
        expectHeadline(status(snapshot, true, now), 'snapshot', idle, false, false, 'Betriebsstatus prüfen', 'warn');
    }
    for (const badHeartbeat of [0, now - 30001, now + 6000]) {
        const snapshot = { ...normal(), [heartbeat]: row(badHeartbeat) };
        assert.equal(status(snapshot, true, now).ems, 'Status unbekannt');
    }
});

test('legacy grid measurements can inform the grid row but cannot clear an EMS status', () => {
    const snapshot = { ...normal(), [measurement]: row(0) };
    delete snapshot[nvp];
    let health = status(snapshot, true, now);
    assert.equal(health.grid, 'Messung aktuell');
    expectHeadline(health, 'ready', idle, false, false, 'Betriebsstatus prüfen', 'warn');
    for (const broken of [{}, null, row(true, { q: 128 }), row(false, { ts: now - 31000 })]) {
        health = status({ ...snapshot, [nvp]: broken }, true, now);
        assert.equal(health.grid, 'Messstatus unbekannt');
    }
    for (const badGrid of [row(0, { ack: false }), row(0, { ts: now - 100000 }), row(null)]) {
        health = status({ ...snapshot, [measurement]: badGrid }, true, now, 90000);
        assert.equal(health.grid, 'Messstatus unbekannt');
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
    expectHeadline(status({}, true, now), 'snapshot', idle, false, false, 'Betriebsstatus prüfen', 'warn');
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
    expectHeadline(unknown, 'ready', warning, false, false, 'Betriebsstatus prüfen', 'warn');
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
