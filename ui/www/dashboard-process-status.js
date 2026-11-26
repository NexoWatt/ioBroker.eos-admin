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
    function identifiers(value) {
        if (!Array.isArray(value) || value.length > names.length ||
            !value.every(id => names.includes(id)) || new Set(value).size !== value.length)
            return null;
        return Object.freeze(names.filter(id => value.includes(id)));
    }
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
    function visible() {
        return ready && pageActive && document.visibilityState === 'visible' && !dashboard.hidden && dashboard.style.display !== 'none';
    }
    function age(s) {
        return s.ageMs + Math.max(0, performance.now() - s.receivedTick, Date.now() - s.receivedAt);
    }
    function current() {
        if (!sample)
            return null;
        const ageMs = age(sample);
        return ageMs < maxAgeMs ? { ...sample.value, observedAt: Math.floor(Date.now() - ageMs) } : null;
    }
    function notify() { window.dispatchEvent(new Event('nexowatt:process-health')); }
    function forget() {
        window.clearTimeout(expiryTimer);
        if (sample) {
            sample = null;
            notify();
        }
    }
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
    function schedule() {
        window.clearTimeout(pollTimer);
        if (visible() && !pending)
            pollTimer = window.setTimeout(poll, Math.max(0, nextStart - performance.now()));
    }
    function cancelRequest() {
        window.clearTimeout(abortTimer);
        const controller = pending;
        pending = null;
        controller?.abort();
    }
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
