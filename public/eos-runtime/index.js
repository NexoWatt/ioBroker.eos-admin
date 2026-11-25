/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
(() => {
    const POLL_MS = 5000;
    /** @type {Record<string,string>} */ const states = { running: 'Läuft', starting: 'Startet', stopping: 'Wird beendet',
        stopped: 'Beendet', disabled: 'Deaktiviert', error: 'Fehler', failed: 'Fehler', backoff: 'Neustart wartet', unknown: 'Unbestätigt' };
    /** @type {Record<string,string>} */ const labels = { admin: 'EOS Administration', ui: 'Oberfläche und EMS', devices: 'Geräte', eebus: 'EEBus', backup: 'Sicherung', ocpp: 'OCPP-Ladestationen' };
    /** @param {string} id @returns {HTMLElement} */
    function element(id) { const node = document.getElementById(id); if (!node) throw new Error('EOS_RUNTIME_ELEMENT'); return node; }
    const refreshButton = /** @type {HTMLButtonElement} */ (element('refresh'));
    const message = element('request-message'); const list = element('processes');
    /** @type {ReturnType<typeof setTimeout>|null} */ let timer = null;
    /** @type {AbortController|null} */ let controller = null;
    let paused = document.hidden; let blocked = false; let resumePending = false;
    /** @param {unknown} value @returns {Record<string,unknown>} */
    function record(value) { return value && typeof value === 'object' && !Array.isArray(value) ? /** @type {Record<string,unknown>} */ (value) : {}; }
    /** @param {unknown} value */
    function natural(value) { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value) : 'Unbekannt'; }
    /** @param {unknown} value */
    function date(value) { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 8640000000000000 ? new Date(value).toLocaleString('de-DE') : 'Unbekannt'; }
    /** @param {unknown} value @param {string} yes @param {string} no */
    function boolean(value, yes, no) { return value === true ? yes : value === false ? no : 'Unbestätigt'; }
    /** @param {string} text */
    function unavailable(text) {
        list.replaceChildren(); const note = document.createElement('p'); note.className = 'runtime-empty';
        note.textContent = 'Kein aktuell bestätigter Prozessstatus. Die nächste erfolgreiche Abfrage zeigt die laufenden Prozesse wieder an.';
        list.append(note); message.textContent = text; message.className = 'is-error';
        element('observed-at').textContent = 'Status aktuell nicht bestätigt';
    }
    /** @param {HTMLElement} node @param {string} label @param {string} value */
    function field(node, label, value) {
        const title = document.createElement('dt'); title.textContent = label;
        const content = document.createElement('dd'); content.textContent = value; node.append(title, content);
    }
    /** @param {unknown} input */
    function render(input) {
        const value = record(input); const now = Date.now();
        if (!Array.isArray(value.processes) || value.processes.length > 38 || typeof value.observedAt !== 'number' ||
            !Number.isSafeInteger(value.observedAt) || value.observedAt > now + 5000 || now - value.observedAt > 15000) throw new Error('EOS_RUNTIME_INVALID_STATUS');
        const fragment = document.createDocumentFragment(); const seen = new Set(); let external = false;
        for (const raw of value.processes) {
            const row = record(raw); const id = typeof row.id === 'string' ? row.id : '';
            const isExternal = /^ocpp21\.\d{1,8}$/.test(id) || id === 'ocpp-external';
            if ((!Object.hasOwn(labels, id) && !isExternal) || seen.has(id)) continue;
            seen.add(id); external ||= isExternal;
            const state = typeof row.state === 'string' && Object.hasOwn(states, row.state) ? row.state : 'unknown';
            const card = document.createElement('section'); card.className = 'eos-panel runtime-card'; card.dataset.process = id;
            const header = document.createElement('header'); const heading = document.createElement('h2');
            heading.textContent = isExternal ? (id === 'ocpp-external' ? 'OCPP · externe Instanzprüfung' : `OCPP · ${id}`) : labels[id] || id;
            const badge = document.createElement('span'); badge.className = `runtime-badge${state === 'running' ? ' is-running' : ['error', 'failed', 'backoff'].includes(state) ? ' is-error' : ''}`;
            badge.textContent = states[state] || 'Unbestätigt'; header.append(heading, badge); card.append(header);
            const kind = document.createElement('p'); kind.className = 'runtime-kind';
            kind.textContent = isExternal ? 'Separater ioBroker-Adapter' : id === 'admin' ? 'Administrationsprozess' : 'Eigener EOS-Prozess'; card.append(kind);
            const fields = document.createElement('dl');
            field(fields, 'Prozessnummer (PID)', ['running', 'starting', 'stopping'].includes(state) && typeof row.pid === 'number' && row.pid > 0 ? natural(row.pid) : 'Unbekannt');
            field(fields, isExternal ? 'Controller meldet aktiv' : id === 'ui' ? 'Oberfläche aktiv' : id === 'admin' ? 'Administration erreichbar' : 'Betrieb freigegeben', boolean(row.active, 'Ja', 'Nein'));
            if (id === 'ui') field(fields, 'EMS bereit', boolean(row.emsReady, 'Ja', 'Nein'));
            if (isExternal) field(fields, 'OCPP-Verbindung', boolean(row.connected, 'Verbunden', 'Getrennt'));
            if (!isExternal && id !== 'admin') {
                field(fields, 'Neustarts in diesem Lauf', natural(row.restarts)); field(fields, 'Generation', natural(row.generation));
                field(fields, 'Letzter Heartbeat', date(row.lastHeartbeatAt));
                if (row.nextRestartAt) field(fields, 'Neustart frühestens', date(row.nextRestartAt));
            }
            if (isExternal) field(fields, 'Letzte Alive-Meldung', date(row.lastHeartbeatAt));
            const code = typeof row.reason === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(row.reason) ? row.reason : '';
            if (code && !['RUNNING', 'DISABLED'].includes(code)) field(fields, 'Meldung', code);
            card.append(fields); fragment.append(card);
        }
        if (!seen.has('admin') || !seen.has('ui')) throw new Error('EOS_RUNTIME_INVALID_STATUS');
        list.replaceChildren(fragment); element('observed-at').textContent = `Abfrage bestätigt: ${date(value.observedAt)}`;
        element('external-note').textContent = external ? 'Zusätzlich vorhandene OCPP-Adapter werden separat angezeigt. Ihre Prozessnummer stammt ausschließlich aus bestätigten Controller-Meldungen. Ein gleichzeitig laufender Altadapter muss vor der Übernahme vollständig beendet sein.' : 'Das integrierte OCPP-Modul läuft als eigener EOS-Prozess. Es ist keine zusätzliche aktive OCPP-Adapterinstanz erfasst.';
        message.textContent = 'Prozessstatus aktualisiert.'; message.className = '';
    }
    function clearTimer() { if (timer !== null) clearTimeout(timer); timer = null; }
    async function refresh() {
        if (paused || document.hidden || controller || blocked) return;
        clearTimer(); const started = performance.now(); const request = new AbortController(); controller = request;
        refreshButton.disabled = true;
        const deadline = setTimeout(() => request.abort(), 5000);
        try {
            const response = await fetch('/api/eos/runtime', { credentials: 'same-origin', cache: 'no-store', signal: request.signal });
            if (paused || request.signal.aborted) return;
            if (response.status === 401 || response.status === 403) {
                blocked = true; unavailable(response.status === 401 ? 'Bitte erneut bei EOS anmelden.' : 'Diese Ansicht ist nur für die EOS-Administration freigegeben.'); return;
            }
            if (!response.ok) throw new Error('EOS_RUNTIME_STATUS_UNAVAILABLE');
            const value = await response.json(); if (!paused && !request.signal.aborted) render(value);
        } catch {
            if (!paused) unavailable('Prozessstatus vorübergehend nicht erreichbar. Die Abfrage wird automatisch wiederholt.');
        } finally {
            clearTimeout(deadline); controller = null; refreshButton.disabled = false;
            if (!paused && !blocked && !document.hidden) {
                const delay = resumePending ? 0 : Math.max(0, POLL_MS - (performance.now() - started)); resumePending = false;
                timer = setTimeout(() => void refresh(), delay);
            }
        }
    }
    function pause() { paused = true; resumePending = false; clearTimer(); controller?.abort(); }
    function resume() {
        if (document.hidden) return;
        const wasPaused = paused; paused = false;
        if (!wasPaused) return;
        unavailable('Prozessstatus wird erneut geprüft …');
        if (controller) { resumePending = true; return; }
        void refresh();
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else resume(); });
    window.addEventListener('pagehide', pause); window.addEventListener('pageshow', resume);
    refreshButton.addEventListener('click', () => { blocked = false; void refresh(); });
    void refresh();
})();
