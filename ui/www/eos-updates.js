/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/www/eos-updates.ts
 * Quell-Hash: sha256:16ab556c7e39a93cc782f2d78a7d8fd74f30d864ef0e7aa375bccc710516db84
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für www/eos-updates.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Zeigt verfügbare EOS-Versionen und führt angemeldete Kunden durch Vorbereitung und bestätigten Update-Start.
 * Daten und Wirkung: Liest ausschließlich die begrenzte EOS-Update-API; ein Start benötigt eine aktuelle Sitzung, CSRF und den serverseitig geprüften Plan. Ein unbestätigter Start wird nie automatisch wiederholt.
 * Bei Änderungen: Verbindungsabbruch, abgelaufene Sitzung, verworfene Pläne und bestätigte Zielversion getrennt testen; niemals Browserwerte als Installationsfreigabe behandeln.
 */
(() => {
    'use strict';
    const endpoint = '/api/eos-update/';
    const versionPattern = /^\d{1,6}\.\d{1,6}\.\d{1,6}(?:-[a-zA-Z0-9.-]{1,60})?$/;
    const states = new Set(['current', 'available', 'checking', 'preparing', 'offline', 'incompatible', 'prepared', 'installing', 'installed', 'failed', 'interrupted']);
    const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
    const safeVersion = (value) => typeof value === 'string' && versionPattern.test(value);
    const epoch = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value < 8640000000000000 ? value : null;
    function decode(value) {
        if (!record(value) || !safeVersion(value.installedVersion) || typeof value.state !== 'string' || !states.has(value.state)
            || value.source !== 'npm-latest' || typeof value.canStart !== 'boolean')
            throw new Error('UPDATE_RESPONSE');
        const view = {
            installedVersion: value.installedVersion,
            availableVersion: safeVersion(value.availableVersion) ? value.availableVersion : null,
            checkedAt: epoch(value.checkedAt), state: value.state, canStart: value.canStart,
            reason: typeof value.reason === 'string' && /^[A-Z0-9_]{1,100}$/.test(value.reason) ? value.reason : null,
            planId: typeof value.planId === 'string' && /^[a-zA-Z0-9_-]{16,128}$/.test(value.planId) ? value.planId : null,
            expiresAt: epoch(value.expiresAt),
        };
        if (view.canStart && (view.state !== 'prepared' || !view.planId || !view.availableVersion || !view.expiresAt))
            throw new Error('UPDATE_RESPONSE');
        return view;
    }
    async function request(action, signal, body, dispatched) {
        const options = { cache: 'no-store', credentials: 'same-origin', signal };
        if (body) {
            const response = await fetch('/api/auth/status', { ...options });
            if (!response.ok)
                throw new Error('UPDATE_AUTH');
            const access = await response.json();
            if (!record(access) || access.authenticated !== true || access.mustChangePassword === true
                || typeof access.csrfToken !== 'string' || !/^[a-f0-9]{64}$/.test(access.csrfToken))
                throw new Error('UPDATE_AUTH');
            options.method = 'POST';
            options.headers = { 'Content-Type': 'application/json', 'X-NW-CSRF': access.csrfToken };
            options.body = JSON.stringify(body);
        }
        if (signal.aborted)
            throw new Error('UPDATE_CANCELLED');
        dispatched?.();
        const response = await fetch(endpoint + action, options);
        if (response.status === 401 || response.status === 403)
            throw new Error('UPDATE_AUTH');
        if (response.status === 409)
            throw new Error('UPDATE_CONFLICT');
        if (!response.ok)
            throw new Error('UPDATE_UNAVAILABLE');
        return decode(await response.json());
    }
    function start() {
        const panel = document.getElementById('eosUpdatesPanel');
        const status = document.getElementById('eosUpdateStatus');
        const installed = document.getElementById('eosUpdateInstalled');
        const available = document.getElementById('eosUpdateAvailable');
        const checked = document.getElementById('eosUpdateChecked');
        const check = document.getElementById('eosUpdateCheck');
        const prepare = document.getElementById('eosUpdatePrepare');
        const confirm = document.getElementById('eosUpdateConfirm');
        const confirmVersion = document.getElementById('eosUpdateConfirmVersion');
        const confirmStart = document.getElementById('eosUpdateStart');
        const cancel = document.getElementById('eosUpdateCancel');
        const gear = document.querySelector('a.topbar-gear');
        const originalGearHref = gear?.getAttribute('href') || 'settings.html';
        let badge = null;
        let view = null;
        let busy = false;
        let loading = false;
        let pendingStart = false;
        let authRequired = false;
        let stopped = false;
        let generation = 0;
        let activeRequest = null;
        let requestTimeout = null;
        let poll = null;
        const pendingMessage = 'Die Rückmeldung zum Updateauftrag steht noch aus. Bitte nicht erneut starten; der Status wird geprüft.';
        const labels = {
            current: 'EOS ist auf dem Stand der veröffentlichten stabilen Version.',
            available: 'Eine neue EOS-Version ist verfügbar.', checking: 'Verfügbare Version wird geprüft …',
            preparing: 'Update wird heruntergeladen und geprüft …',
            offline: 'Die Updatequelle ist momentan nicht erreichbar. EOS läuft weiter.',
            incompatible: 'Diese Version benötigt eine gesonderte Prüfung durch den Installateur.',
            prepared: 'Update geprüft und vorbereitet. Zum Installieren bitte den Start bestätigen.',
            installing: 'Update läuft. Die Verbindung kann während des EOS-Neustarts unterbrochen werden.',
            installed: 'Die Installation der neuen EOS-Version wurde bestätigt.',
            failed: 'Das Update konnte nicht erfolgreich abgeschlossen werden. Bitte die Diagnose prüfen.',
            interrupted: 'Der Updateabschluss ist nicht bestätigt. Es wird kein Auftrag automatisch wiederholt.',
        };
        const reasons = {
            EOS_UPDATE_PLAN_EXPIRED: 'Die Vorbereitung ist abgelaufen. Bitte erneut vorbereiten.',
            EOS_UPDATE_CONFIGURATION_CHANGED: 'Die Einstellungen wurden seit der Vorbereitung geändert. Bitte erneut vorbereiten.',
            EOS_UPDATE_VERSION_CHANGED: 'Die angebotene Version hat sich geändert. Bitte erneut prüfen.',
            EOS_UPDATE_BUSY: 'Ein Updateauftrag wird bereits bearbeitet.',
            EOS_UPDATE_PLATFORM_UNSUPPORTED: 'Die automatische Installation ist auf diesem System nicht freigegeben.',
            EOS_UPDATE_NODE_UNSUPPORTED: 'Die neue Version benötigt eine andere Node.js-Version.',
            EOS_UPDATE_CONTROLLER_UNSUPPORTED: 'Die ioBroker-Version muss zuerst vom Installateur geprüft werden.',
            EOS_UPDATE_MULTI_INSTANCE: 'Mehrere EOS-Instanzen benötigen eine koordinierte Aktualisierung durch den Installateur.',
        };
        function show(message, error = false) {
            if (status) {
                status.textContent = message;
                status.dataset.error = String(error);
            }
        }
        function planReady() {
            return !!view && view.state === 'prepared' && view.canStart && !!view.planId && !!view.expiresAt && view.expiresAt > Date.now();
        }
        function render() {
            const running = !!view && ['checking', 'preparing', 'installing'].includes(view.state) || pendingStart;
            const blocked = busy || loading || running;
            if (check instanceof HTMLButtonElement)
                check.disabled = blocked;
            if (prepare instanceof HTMLButtonElement) {
                prepare.hidden = !view || !['available', 'prepared'].includes(view.state);
                prepare.disabled = blocked || authRequired || (view?.state === 'prepared' && !planReady());
                prepare.textContent = view?.state === 'prepared' ? 'Update starten …' : 'Update vorbereiten';
            }
            if (confirmStart instanceof HTMLButtonElement)
                confirmStart.disabled = blocked || authRequired || !planReady();
            if (!view)
                return;
            if (installed)
                installed.textContent = view.installedVersion;
            if (available)
                available.textContent = view.availableVersion || '—';
            if (checked)
                checked.textContent = view.checkedAt ? new Date(view.checkedAt).toLocaleString('de-DE') : 'Noch nicht geprüft';
            const explanation = view.reason ? reasons[view.reason] || 'Bitte die Update-Diagnose durch den Installateur prüfen lassen.' : '';
            show(pendingStart && view.state !== 'installing' ? pendingMessage
                : (labels[view.state] || 'Updatestatus wird geladen.') + (explanation ? ` ${explanation}` : ''), ['failed', 'interrupted'].includes(view.state));
            const notice = ['available', 'prepared', 'incompatible'].includes(view.state) && !!view.availableVersion;
            if (gear && notice) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'nw-update-badge';
                    badge.textContent = '•';
                    badge.setAttribute('aria-hidden', 'true');
                    gear.appendChild(badge);
                }
                gear.href = 'settings.html#updates';
                gear.title = `Einstellungen · EOS ${view.availableVersion} verfügbar`;
                gear.setAttribute('aria-label', gear.title);
            }
            else if (gear) {
                badge?.remove();
                badge = null;
                gear.setAttribute('href', originalGearHref);
                gear.title = 'Einstellungen';
                gear.setAttribute('aria-label', 'Einstellungen');
            }
            if (confirmVersion)
                confirmVersion.textContent = view.availableVersion || '—';
        }
        function schedule() {
            if (poll !== null)
                clearTimeout(poll);
            poll = null;
            if (stopped || document.hidden)
                return;
            const active = !authRequired && (pendingStart || (view && ['preparing', 'installing', 'checking'].includes(view.state)));
            poll = setTimeout(() => { poll = null; void load(); }, active ? 3000 : panel ? 60000 : 15 * 60000);
        }
        function errorMessage(error) {
            if (error instanceof Error && error.message === 'UPDATE_AUTH') {
                authRequired = true;
                if (view)
                    view = { ...view, canStart: false };
                if (confirm instanceof HTMLDialogElement && confirm.open)
                    confirm.close();
                render();
                show(pendingStart ? 'Bitte erneut bei EOS anmelden. Der Status des bereits gesendeten Updateauftrags ist noch unbestätigt.'
                    : 'Bitte erneut bei EOS anmelden. Es wurde kein neuer Updateauftrag erteilt.', true);
            }
            else if (error instanceof Error && error.message === 'UPDATE_CONFLICT') {
                if (view)
                    view = { ...view, canStart: false, planId: null };
                render();
                show('Der Updateplan ist nicht mehr gültig oder ein Update läuft bereits. Status neu prüfen.', true);
            }
            else {
                show(pendingStart ? pendingMessage : 'Updatestatus momentan nicht erreichbar. Bitte später erneut prüfen.', true);
            }
        }
        async function call(action, body, dispatched) {
            const controller = new AbortController();
            activeRequest = controller;
            const timeout = setTimeout(() => { controller.abort(); }, body ? 20000 : 7000);
            requestTimeout = timeout;
            try {
                return await request(action, controller.signal, body, dispatched);
            }
            finally {
                clearTimeout(timeout);
                if (requestTimeout === timeout)
                    requestTimeout = null;
                if (activeRequest === controller)
                    activeRequest = null;
            }
        }
        async function load() {
            if (busy || loading || stopped || document.hidden) {
                schedule();
                return;
            }
            const current = generation;
            let error;
            loading = true;
            render();
            try {
                const received = await call('status');
                if (stopped || current !== generation)
                    return;
                view = received;
                authRequired = false;
                // Only a fresh server status resolves an indeterminate start.
                // It never causes another POST or assumes that installation succeeded.
                if (view.state !== 'installing')
                    pendingStart = false;
                if (view.state !== 'prepared' && confirm instanceof HTMLDialogElement && confirm.open)
                    confirm.close();
            }
            catch (caught) {
                error = caught;
            }
            finally {
                if (!stopped && current === generation) {
                    loading = false;
                    render();
                    if (error !== undefined)
                        errorMessage(error);
                    schedule();
                }
            }
        }
        async function action(kind) {
            if (busy || loading || stopped || pendingStart)
                return;
            const target = view?.availableVersion;
            const plan = view?.planId;
            if (kind === 'prepare' && (!target || authRequired) || kind === 'start' && (!planReady() || authRequired))
                return;
            const current = generation;
            let error;
            let openConfirmation = false;
            busy = true;
            render();
            if (kind === 'start') {
                if (confirm instanceof HTMLDialogElement && confirm.open)
                    confirm.close();
                show('Updateauftrag wird übermittelt …');
            }
            try {
                const received = await call(kind, kind === 'prepare' ? { version: target } : kind === 'start' ? { planId: plan, confirm: true } : {}, kind === 'start' ? () => { pendingStart = true; } : undefined);
                if (stopped || current !== generation)
                    return;
                view = received;
                authRequired = false;
                if (view.state !== 'installing')
                    pendingStart = false;
                openConfirmation = kind === 'prepare' && planReady();
            }
            catch (caught) {
                error = caught;
                // An explicit server refusal is conclusive; a lost response is not.
                if (!stopped && current === generation && kind === 'start' && caught instanceof Error
                    && ['UPDATE_AUTH', 'UPDATE_CONFLICT'].includes(caught.message))
                    pendingStart = false;
            }
            finally {
                if (!stopped && current === generation) {
                    busy = false;
                    render();
                    if (error !== undefined)
                        errorMessage(error);
                    else if (openConfirmation && confirm instanceof HTMLDialogElement && !confirm.open)
                        confirm.showModal();
                    schedule();
                }
            }
        }
        check?.addEventListener('click', () => { void action('check'); });
        prepare?.addEventListener('click', () => {
            if (busy || loading || pendingStart || authRequired || stopped)
                return;
            if (view?.state === 'prepared') {
                if (planReady() && confirm instanceof HTMLDialogElement && !confirm.open)
                    confirm.showModal();
            }
            else
                void action('prepare');
        });
        confirmStart?.addEventListener('click', () => { void action('start'); });
        cancel?.addEventListener('click', () => { if (confirm instanceof HTMLDialogElement && confirm.open)
            confirm.close(); });
        window.addEventListener('pagehide', () => {
            stopped = true;
            generation++;
            activeRequest?.abort();
            activeRequest = null;
            busy = false;
            loading = false;
            if (requestTimeout !== null)
                clearTimeout(requestTimeout);
            requestTimeout = null;
            if (poll !== null)
                clearTimeout(poll);
            poll = null;
        });
        window.addEventListener('pageshow', () => { if (stopped) {
            stopped = false;
            void load();
        } });
        document.addEventListener('visibilitychange', () => { if (!document.hidden)
            void load();
        else
            schedule(); });
        void load();
    }
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', start, { once: true });
    else
        start();
})();
