/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/www/smarthome-feedback.ts
 * Quell-Hash: sha256:523f87bfc12a4cea5ec9c86c3c798ffb68fd774686fd146e69a9ca3a11d25c16
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für www/smarthome-feedback.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
"use strict";
(function () {
    'use strict';
    const host = window;
    if (host.NW_SH_FEEDBACK)
        return;
    const routes = new Set([
        '/api/smarthome/control', '/api/smarthome/toggle', '/api/smarthome/level', '/api/smarthome/color',
        '/api/smarthome/cover', '/api/smarthome/player', '/api/smarthome/rtrSetpoint',
        '/api/smarthome/climate', '/api/smarthome/value', '/api/smarthome/timers',
    ]);
    const statuses = new Map();
    const pending = new Map();
    const deadlineMs = 5000;
    const statusLimit = 256;
    const responseLimit = 128 * 1024;
    // Timer-POST liefert den gesamten Bestand. 1 MiB umfasst den bestehenden
    // 512-KiB-Übernahmevertrag samt Antwortumschlag; kein unbegrenztes Einlesen.
    const timerResponseLimit = 1024 * 1024;
    let sequence = 0;
    let cleanupTimer;
    let installed = false;
    let press = null;
    let cancelledUntil = 0;
    function record(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }
    function validId(value) {
        return typeof value === 'string' && value.length > 0 && value.length <= 512;
    }
    function scheduleCleanup() {
        if (cleanupTimer !== undefined)
            clearTimeout(cleanupTimer);
        cleanupTimer = undefined;
        if (!statuses.size)
            return;
        let next = Infinity;
        for (const status of statuses.values())
            next = Math.min(next, status.expires);
        cleanupTimer = setTimeout(refresh, Math.max(1, next - Date.now()));
    }
    function renderStatus(node) {
        const id = node.dataset.shDeviceId;
        const status = id ? statuses.get(id) : undefined;
        node.hidden = !status;
        node.textContent = status?.message ?? '';
        if (status)
            node.dataset.state = status.state;
        else
            delete node.dataset.state;
    }
    function refresh() {
        const now = Date.now();
        for (const [id, status] of statuses)
            if (status.expires <= now)
                statuses.delete(id);
        for (const node of document.querySelectorAll('.nw-sh-command-status')) {
            if (node instanceof HTMLElement)
                renderStatus(node);
        }
        scheduleCleanup();
    }
    function show(id, requestSequence, state, message) {
        // Ein langsamer alter Fahrbefehl darf die Rückmeldung eines neueren Stopps
        // weder überschreiben noch dessen Fehler verbergen.
        const previous = statuses.get(id);
        if (previous && previous.sequence > requestSequence)
            return;
        statuses.delete(id);
        statuses.set(id, { sequence: requestSequence, state, message,
            expires: Date.now() + (state === 'sent' ? 6000 : 15000) });
        while (statuses.size > statusLimit) {
            const oldest = statuses.keys().next();
            if (oldest.done)
                break;
            statuses.delete(oldest.value);
        }
        refresh();
    }
    function attachStatus(root, id) {
        if (!validId(id))
            return;
        const existing = Array.from(root.children).find(child => child.classList.contains('nw-sh-command-status'));
        const node = existing instanceof HTMLElement ? existing : document.createElement('div');
        node.className = 'nw-sh-command-status';
        node.dataset.shDeviceId = id;
        node.setAttribute('role', 'status');
        node.setAttribute('aria-live', 'polite');
        node.setAttribute('aria-atomic', 'true');
        if (!existing)
            root.appendChild(node);
        renderStatus(node);
    }
    async function readResponse(response, limit) {
        // Begrenzt auch die Antwort beim Lesen; die Deadline gilt bis zum JSON-Ende.
        const reader = response.body?.getReader();
        if (!reader) {
            const text = await response.text();
            if (text.length > limit)
                throw new Error('EOS_UI_RESPONSE_LIMIT');
            return JSON.parse(text);
        }
        const decoder = new TextDecoder();
        let bytes = 0;
        let text = '';
        try {
            for (;;) {
                const part = await reader.read();
                if (part.done)
                    break;
                bytes += part.value.byteLength;
                if (bytes > limit) {
                    await reader.cancel();
                    throw new Error('EOS_UI_RESPONSE_LIMIT');
                }
                text += decoder.decode(part.value, { stream: true });
            }
            text += decoder.decode();
            return JSON.parse(text);
        }
        finally {
            reader.releaseLock();
        }
    }
    function post(endpoint, payload, id) {
        if (!validId(id))
            return Promise.resolve(null);
        const requestSequence = ++sequence;
        let body;
        try {
            if (!routes.has(endpoint) || !record(payload))
                throw new Error('EOS_UI_COMMAND_INVALID');
            const serialized = JSON.stringify(payload);
            if (serialized.length > 32 * 1024)
                throw new Error('EOS_UI_COMMAND_LIMIT');
            body = serialized;
        }
        catch {
            show(id, requestSequence, 'error', 'Bedienung nicht verfügbar. Gerätestatus prüfen.');
            return Promise.resolve(null);
        }
        // Jeder bewusst erneut ausgelöste Stopp erreicht den Server. Insbesondere
        // STOPP → AB → STOPP darf den letzten Stopp nicht mit einem noch laufenden
        // ersten HTTP-Auftrag zusammenlegen. Andere gleiche Befehle bleiben dedupliziert.
        const stop = record(payload) && ((endpoint === '/api/smarthome/cover' && payload.action === 'stop')
            || (endpoint === '/api/smarthome/control' && (payload.key === 'STOP' || payload.key === 'TILT_STOP')));
        const key = id + '\n' + endpoint + '\n' + body + (stop ? '\nstop:' + requestSequence : '');
        const existing = pending.get(key);
        if (existing)
            return existing.promise;
        // Stopp erhält reservierte Kapazität und wartet nie auf den Fahrbefehl.
        if (pending.size >= (stop ? 64 : 48)) {
            show(id, requestSequence, 'error', 'Viele Befehle sind noch offen. Gerätestatus prüfen.');
            return Promise.resolve(null);
        }
        const controller = new AbortController();
        let timer;
        let abort;
        let timedOut = false;
        show(id, requestSequence, 'sending', 'Wird an EOS gesendet …');
        const promise = (async () => {
            try {
                const aborted = new Promise((_resolve, reject) => {
                    abort = () => reject(new Error('EOS_UI_REQUEST_ABORTED'));
                    controller.signal.addEventListener('abort', abort, { once: true });
                });
                timer = setTimeout(() => { timedOut = true; controller.abort(); }, deadlineMs);
                const operation = (async () => {
                    // Global fetch ist absichtlich der vorhandene Auth-/CSRF-Wrapper.
                    const response = await fetch(endpoint, {
                        method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
                        body, signal: controller.signal,
                    });
                    if (!response.ok) {
                        await response.body?.cancel();
                        if (response.status === 401)
                            throw new Error('EOS_UI_SESSION_EXPIRED');
                        if (response.status === 403)
                            throw new Error('EOS_UI_FORBIDDEN');
                        throw new Error('EOS_UI_COMMAND_UNCONFIRMED');
                    }
                    const data = await readResponse(response, endpoint === '/api/smarthome/timers' ? timerResponseLimit : responseLimit);
                    if (!record(data) || data.ok !== true)
                        throw new Error('EOS_UI_COMMAND_UNCONFIRMED');
                    return data;
                })();
                const result = await Promise.race([operation, aborted]);
                show(id, requestSequence, 'sent', 'An EOS übergeben');
                return result;
            }
            catch (error) {
                const code = error instanceof Error ? error.message : '';
                const message = timedOut ? 'Keine Bestätigung nach 5 Sekunden. Gerätestatus prüfen.'
                    : code === 'EOS_UI_SESSION_EXPIRED' ? 'Sitzung abgelaufen. Bitte erneut anmelden.'
                        : code === 'EOS_UI_FORBIDDEN' ? 'Keine Freigabe für diese Bedienung.'
                            : 'Befehl nicht bestätigt. Gerätestatus prüfen.';
                show(id, requestSequence, timedOut ? 'timeout' : 'error', message);
                return null;
            }
            finally {
                if (timer !== undefined)
                    clearTimeout(timer);
                if (abort)
                    controller.signal.removeEventListener('abort', abort);
                pending.delete(key);
            }
        })();
        pending.set(key, { promise, controller });
        return promise;
    }
    function actionTarget(target) {
        if (!(target instanceof Element))
            return null;
        if (!target.closest('.nw-sh-tile, .nw-sh-popover'))
            return null;
        const element = target.closest('button, input[type="range"], [role="button"], .nw-sh-tile');
        if (!(element instanceof HTMLElement) || element.matches(':disabled')
            || element.closest('[inert], [aria-disabled="true"]'))
            return null;
        return element;
    }
    function clearPress(cancelled = false) {
        if (press)
            delete press.target.dataset.shPressed;
        press = null;
        if (cancelled)
            cancelledUntil = Date.now() + 400;
    }
    function markPress(target, pointerId, x, y) {
        clearPress();
        target.dataset.shPressed = 'true';
        press = { target, pointerId, x, y };
    }
    function install() {
        if (installed)
            return;
        installed = true;
        document.addEventListener('pointerdown', (event) => {
            if (!event.isPrimary || event.button !== 0)
                return;
            const target = actionTarget(event.target);
            if (target)
                markPress(target, event.pointerId, event.clientX, event.clientY);
        }, { capture: true, passive: true });
        document.addEventListener('pointermove', (event) => {
            if (press?.pointerId !== event.pointerId)
                return;
            if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10)
                clearPress(true);
        }, { capture: true, passive: true });
        document.addEventListener('pointerup', () => clearPress(), { capture: true, passive: true });
        document.addEventListener('pointercancel', () => clearPress(true), { capture: true, passive: true });
        document.addEventListener('lostpointercapture', () => clearPress(), { capture: true, passive: true });
        document.addEventListener('scroll', () => clearPress(true), { capture: true, passive: true });
        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ')
                return;
            const target = actionTarget(event.target);
            if (target && !target.matches('input[type="range"]'))
                markPress(target, null, 0, 0);
        }, true);
        document.addEventListener('keyup', () => clearPress(), true);
        document.addEventListener('focusout', () => clearPress(), true);
        // Capture sieht auch Buttons, die den Ereignisaufstieg lokal beenden. Erst
        // nach deren Handlern entscheiden; keine selbst erzeugten Klickereignisse.
        document.addEventListener('click', (event) => {
            const target = actionTarget(event.target);
            if (!event.isTrusted || !target || target.matches('input[type="range"]'))
                return;
            queueMicrotask(() => {
                if (event.defaultPrevented || Date.now() < cancelledUntil || target.matches(':disabled'))
                    return;
                try {
                    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
                        && typeof navigator.vibrate === 'function')
                        navigator.vibrate(8);
                }
                catch { /* Haptik ist optional; fehlende Plattformunterstützung ist kein Bedienfehler. */ }
            });
        }, true);
        window.addEventListener('blur', () => clearPress(true));
        document.addEventListener('visibilitychange', () => { if (document.hidden)
            clearPress(true); });
        window.addEventListener('pagehide', () => {
            clearPress(true);
            for (const entry of pending.values())
                entry.controller.abort();
        });
    }
    host.NW_SH_FEEDBACK = Object.freeze({ install, post, attachStatus, refresh });
    install();
})();
