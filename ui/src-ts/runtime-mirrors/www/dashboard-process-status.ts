/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: www/dashboard-process-status.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * www/dashboard-process-status.js
 *
 * Zusammenhang:
 * Der Spiegel hilft uns, die JS-Datei später schrittweise zu typisieren, zu testen und
 * kontrolliert auf TypeScript umzustellen. Produktive Originalquellen liegen unter
 * src-ts/runtime-executables/ bzw. den im generierten JS genannten TS-Pfaden.
 * Dort ändern, Laufzeit erzeugen und danach die Spiegel synchronisieren.
 * Build-/Prüfskripte ohne TS-Original werden weiterhin unter scripts/ gepflegt.
 *
 * Wichtig für die Migration:
 * - Diese Datei enthält vorübergehend @ts-nocheck.
 * - Der nächste Schritt ist pro Modul echte Typisierung statt pauschalem No-Check.
 * - Fachliche Kommentare markieren die Abschnitte, die später einzeln migriert werden.
 *
 * Original-Hash: 11cef2f4b172594d4dab4217fe809be35e033f4c15f92f982b59062443bc28e0
 */

/**
 * Code-Teil: Runtime-Spiegel der kompletten Datei
 *
 * Zweck:
 * Dieser Abschnitt enthält den ursprünglichen JavaScript-Code als TypeScript-Parallelkopie.
 * Einzelne Funktionen werden später pro Modul weiter typisiert; Dateien ohne eigene
 * Funktionsdeklarationen bleiben trotzdem über diesen Dateikommentar dokumentiert.
 */

/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/www/dashboard-process-status.ts
 * Quell-Hash: sha256:ebabb70be8b30b9a7eba89e595e8c9ca6197dd6cb7f121c2db137f35025cbfae
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für www/dashboard-process-status.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
"use strict";
/** Read the host's public process summary independently of the EMS telemetry stream. */
(() => {
    const win = window;
    const dashboard = document.querySelector('main.nw-dashboard');
    if (!dashboard || !document.getElementById('sideStatusText') || win.NexoWattDashboardProcesses)
        return;
    const names = ['ui', 'ems', 'devices', 'eebus', 'backup', 'ocpp'];
    const intervalMs = 10000;
    const maxAgeMs = 30000;
    const unknownDevices = Object.freeze({ state: 'unknown', offline: Object.freeze([]), totalOffline: 0 });
    let pageActive = true;
    let ready = document.readyState !== 'loading';
    let sample = null;
    let pending = null;
    let nextStart = 0;
    let pollTimer;
    let abortTimer;
    let expiryTimer;
/**
 * Code-Teil: identifiers
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function identifiers(value) {
        if (!Array.isArray(value) || value.length > names.length ||
            !value.every(id => names.includes(id)) || new Set(value).size !== value.length)
            return null;
        return Object.freeze(names.filter(id => value.includes(id)));
    }
/**
 * Code-Teil: devices
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function devices(body) {
        if (!body || typeof body !== 'object')
            return unknownDevices;
        const { state, offline, totalOffline } = body;
        if ((state !== 'ok' && state !== 'unknown' && state !== 'fault') ||
            typeof totalOffline !== 'number' || !Number.isSafeInteger(totalOffline) || totalOffline < 0 || totalOffline > 10000 ||
            !Array.isArray(offline) || offline.length > 12 || offline.length > totalOffline ||
            (state === 'fault') !== (totalOffline > 0) || (totalOffline > 0 && offline.length === 0))
            return unknownDevices;
        const names = [];
        for (const row of offline) {
            if (!row || typeof row.name !== 'string' || !row.name.trim() || row.name.length > 64)
                return unknownDevices;
            names.push(Object.freeze({ name: row.name }));
        }
        return Object.freeze({ state, offline: Object.freeze(names), totalOffline });
    }
/**
 * Code-Teil: decode
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function decode(body) {
        if (!body || typeof body !== 'object' || Array.isArray(body))
            return null;
        const row = body;
        const { observedAt, state } = row;
        if (typeof observedAt !== 'number' || !Number.isSafeInteger(observedAt) || observedAt <= 0 ||
            (state !== 'ok' && state !== 'fault' && state !== 'unknown'))
            return null;
        const failed = identifiers(row.failed);
        const paused = identifiers(row.paused);
        if (!failed || !paused || failed.some(id => paused.includes(id)) || (state === 'fault') !== (failed.length > 0))
            return null;
        return { observedAt, state, failed, paused, deviceHealth: devices(row.deviceHealth) };
    }
/**
 * Code-Teil: visible
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function visible() {
        return ready && pageActive && document.visibilityState === 'visible' && !dashboard.hidden && dashboard.style.display !== 'none';
    }
/**
 * Code-Teil: age
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function age(s) {
        return s.ageMs + Math.max(0, performance.now() - s.receivedTick, Date.now() - s.receivedAt);
    }
/**
 * Code-Teil: current
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function current() {
        if (!sample)
            return null;
        const ageMs = age(sample);
        return ageMs < maxAgeMs ? { ...sample.value, observedAt: Math.floor(Date.now() - ageMs) } : null;
    }
/**
 * Code-Teil: notify
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function notify() { window.dispatchEvent(new Event('nexowatt:process-health')); }
/**
 * Code-Teil: forget
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function forget() {
        window.clearTimeout(expiryTimer);
        if (sample) {
            sample = null;
            notify();
        }
    }
/**
 * Code-Teil: setExpiry
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function setExpiry() {
        window.clearTimeout(expiryTimer);
        if (!sample)
            return;
        const remaining = maxAgeMs - age(sample);
        if (remaining <= 0)
            forget();
        else
            expiryTimer = window.setTimeout(setExpiry, Math.ceil(remaining));
    }
/**
 * Code-Teil: accept
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function accept(value, serverDate, started) {
        const now = Date.now();
        const tick = performance.now();
        // HTTP Date has one-second precision. Bound the possible observation age,
        // also accounting for time spent receiving the response over a slow link.
        const headerMs = Date.parse(serverDate || '');
        const remoteNow = Number.isFinite(headerMs) ? headerMs + 999 : now;
        const delta = remoteNow - value.observedAt;
        const ageMs = Math.max(0, delta) + (tick - started);
        if (delta < -5000 || ageMs >= maxAgeMs)
            return;
        const previous = current();
        if (previous && sample && value.observedAt <= sample.value.observedAt)
            return;
        sample = { value, receivedAt: now, receivedTick: tick, ageMs };
        setExpiry();
        if (!previous || previous.state !== value.state || previous.failed.join() !== value.failed.join() ||
            previous.paused.join() !== value.paused.join() || JSON.stringify(previous.deviceHealth) !== JSON.stringify(value.deviceHealth))
            notify();
    }
/**
 * Code-Teil: schedule
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function schedule() {
        window.clearTimeout(pollTimer);
        if (visible() && !pending)
            pollTimer = window.setTimeout(poll, Math.max(0, nextStart - performance.now()));
    }
/**
 * Code-Teil: cancelRequest
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function cancelRequest() {
        window.clearTimeout(abortTimer);
        const controller = pending;
        pending = null;
        controller?.abort();
    }
/**
 * Code-Teil: poll
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    async function poll() {
        if (!visible() || pending)
            return;
        const started = performance.now();
        nextStart = started + intervalMs;
        const controller = new AbortController();
        pending = controller;
        abortTimer = window.setTimeout(() => {
            if (pending === controller) {
                cancelRequest();
                schedule();
            }
        }, 4000);
        try {
            const path = '/api/eos/dashboard/process-status';
            const url = new URL(win.NW_RUNTIME?.url(path) ?? path, window.location.href);
            if (url.origin !== window.location.origin || url.username || url.password)
                return;
            const res = await window.fetch(url.href, { credentials: 'same-origin', cache: 'no-store',
                redirect: 'error', signal: controller.signal });
            if (pending !== controller || !visible())
                return;
            if (res.status === 401 || res.status === 403) {
                forget();
                return;
            }
            if (!res.ok)
                return;
            const value = decode(await res.json());
            if (pending === controller && visible() && value)
                accept(value, res.headers.get('Date'), started);
        }
        catch { /* A transport failure leaves the last confirmed observation valid only until its original expiry. */ }
        finally {
            if (pending === controller) {
                window.clearTimeout(abortTimer);
                pending = null;
                schedule();
            }
        }
    }
/**
 * Code-Teil: sync
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function sync() {
        if (visible()) {
            setExpiry();
            schedule();
        }
        else {
            window.clearTimeout(pollTimer);
            window.clearTimeout(expiryTimer);
            cancelRequest();
        }
    }
    win.NexoWattDashboardProcesses = Object.freeze({ current });
    const tab = new MutationObserver(sync);
    tab.observe(dashboard, { attributes: true, attributeFilter: ['style', 'hidden'] });
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pagehide', () => { pageActive = false; sync(); });
    window.addEventListener('pageshow', () => { pageActive = true; sync(); });
    if (!ready)
        document.addEventListener('DOMContentLoaded', () => { ready = true; sync(); }, { once: true });
    else
        sync();
})();
