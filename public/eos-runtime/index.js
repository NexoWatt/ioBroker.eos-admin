/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
(() => {
    const POLL_MS = 5000;
    /** @type {Record<string,string>} */ const states = { running: 'Läuft', starting: 'Startet', stopping: 'Wird beendet',
        stopped: 'Beendet', disabled: 'Deaktiviert', moduleDisabled: 'Modul deaktiviert', blocked: 'Start blockiert', notStarted: 'Nicht gestartet',
        error: 'Fehler', failed: 'Fehler', backoff: 'Neustart wartet', unknown: 'Unbestätigt' };
    /** @type {Record<string,string>} */ const labels = { admin: 'EOS Administration', ui: 'Oberfläche', ems: 'Energiemanagement (EMS)', devices: 'Geräte', eebus: 'EEBus', backup: 'Sicherung', ocpp: 'OCPP-Ladestationen' };
    /** @type {Record<string,string>} */ const errors = {
        AUTHENTICATION_REQUIRED: 'Bitte erneut bei EOS anmelden.',
        ADMIN_REQUIRED: 'Für die Prozessbedienung ist eine Administratoranmeldung erforderlich.',
        PASSWORD_CHANGE_REQUIRED: 'Bitte zuerst das Kennwort ändern und erneut anmelden.',
        AUTH_CSRF: 'Die Sitzungsfreigabe ist nicht mehr aktuell. Status aktualisieren und erneut versuchen.',
        AUTH_ORIGIN: 'Der Aufruf wurde nicht über den freigegebenen EOS-Zugang gesendet.',
        EOS_RUNTIME_MODULE_DISABLED: 'Das Modul ist deaktiviert. Aktivieren schaltet Modul und Prozess gemeinsam mit den gespeicherten Einstellungen ein.',
        EOS_MODULE_LEGACY_RUNNING: 'Ein separater Adapter ist noch aktiv oder sein Ende ist nicht bestätigt. Erst die Zuständigkeit in den Moduleinstellungen klären.',
        EOS_MODULE_OWNERSHIP_UNAVAILABLE: 'Der Zustand eines anderen Adapters konnte nicht bestätigt werden. Der Modulstart bleibt bis zur geklärten Zuständigkeit gesperrt.',
        EOS_MODULE_NOT_READY: 'Die Modulkonfiguration konnte noch nicht geladen werden. Moduleinstellungen und Systemprotokoll prüfen.',
        EOS_MODULE_CONFIG_UNAVAILABLE: 'Die gespeicherte Modulkonfiguration ist nicht lesbar. Moduleinstellungen und Systemprotokoll prüfen.',
        EOS_MODULE_DEPENDENCY_MISSING: 'Eine benötigte Moduldatei oder Abhängigkeit fehlt. Das vollständige EOS-Paket erneut installieren.',
        EOS_RUNTIME_START_FAILED: 'Der Prozessstart wurde nicht bestätigt. Die Meldung und die Moduleinstellungen prüfen.',
        EOS_RUNTIME_MIGRATION_BLOCKED: 'Der Start ist durch eine nicht abgeschlossene Geräteübernahme blockiert. Übernahmestatus prüfen.',
        EOS_RUNTIME_LICENSE_REQUIRED: 'Die erforderliche Lizenzfreigabe fehlt. Lizenzstatus prüfen.',
        EOS_RUNTIME_OWNERSHIP_REQUIRED: 'Die Zuständigkeit für die Geräte ist nicht bestätigt. Ein anderer Adapter kann noch aktiv sein.',
        EOS_RUNTIME_BUSY: 'Ein Steuerauftrag läuft bereits. Den bestätigten Abschluss abwarten.',
        EOS_RUNTIME_NOT_READY: 'Die Prozessverwaltung ist noch nicht bereit. Der Status wird erneut geprüft.',
        EOS_RUNTIME_DISABLED: 'Dieser Prozess ist dauerhaft deaktiviert. Aktivieren startet ihn wieder mit seiner gespeicherten Konfiguration.',
        EOS_RUNTIME_STOP_UNCONFIRMED: 'Das Ende des bisherigen Prozesses ist nicht bestätigt. Vor erneuter Aktivierung ist ein regulärer EOS-Adapterneustart erforderlich.',
        EOS_RUNTIME_CONFIG_INVALID: 'Die gespeicherte Prozesskonfiguration ist ungültig. Das Systemprotokoll prüfen.',
        EOS_RUNTIME_CONFIG_TIMEOUT: 'Der Zugriff auf die gespeicherte Prozessfreigabe wurde nicht rechtzeitig bestätigt. Status und Systemprotokoll prüfen.',
        EOS_RUNTIME_CONFIG_CONFLICT: 'Die Einstellung wurde zwischenzeitlich geändert. Status aktualisieren und die Auswahl erneut prüfen.',
        EOS_MODULE_CONFIG_CONFLICT: 'Die Einstellung wurde zwischenzeitlich geändert. Status aktualisieren und die Auswahl erneut prüfen.',
        EOS_MIGRATION_SOURCE_VERSION: 'Die Version eines vorhandenen Adapters passt nicht zur Übernahme. Übernahmestatus prüfen.',
        EOS_MIGRATION_MODULE_LICENSE_REQUIRED: 'Für die angeforderte Übernahme fehlt eine Modulfreigabe. Übernahmestatus prüfen.',
        EOS_MIGRATION_RESTART_REQUIRED: 'Die Freigabe wurde geändert. Der EOS-Adapter muss regulär neu gestartet werden.',
        EOS_MODULE_PROCESS_EXIT: 'Der Prozess wurde unerwartet beendet. EOS prüft den kontrollierten Wiederanlauf.',
        LEGACY_ENABLED_OR_UNKNOWN: 'Der bisherige Adapter ist noch aktiv oder sein Zustand ist nicht bestätigt.',
        LEGACY_STOP_NOT_CONFIRMED: 'Das Ende des bisherigen Adapters ist nicht bestätigt.',
        LICENSE_REQUIRED: 'Die erforderliche Lizenzfreigabe fehlt. Lizenzstatus prüfen.',
        LICENSE_INVALID: 'Die erforderliche Lizenzfreigabe fehlt. Lizenzstatus prüfen.',
        OWNERSHIP_CHANGED: 'Die Zuständigkeit für die Geräte hat sich geändert. Den Übernahmestatus prüfen.',
    };
    /** @typedef {{enabled:boolean,canEnable:boolean,canDisable:boolean,canRestart:boolean,busy:boolean,reason:string,revision:string}} Controls */
    /** @param {string} id @returns {HTMLElement} */
    function element(id) { const node = document.getElementById(id); if (!node) throw new Error('EOS_RUNTIME_ELEMENT'); return node; }
    const refreshButton = /** @type {HTMLButtonElement} */ (element('refresh'));
    const message = element('request-message'); const list = element('processes');
    const controlMessage = element('control-message');
    /** @type {Map<string, Controls>} */ const controls = new Map();
    /** @type {ReturnType<typeof setTimeout>|null} */ let timer = null;
    /** @type {AbortController|null} */ let controller = null;
    /** @type {AbortController|null} */ let mutation = null;
    let csrf = ''; let revision = 0;
    let paused = document.hidden; let blocked = false; let resumePending = false;
    /** @param {unknown} value @returns {Record<string,unknown>} */
    function record(value) { return value && typeof value === 'object' && !Array.isArray(value) ? /** @type {Record<string,unknown>} */ (value) : {}; }
    /** @param {unknown} value */
    function natural(value) { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value) : 'Unbekannt'; }
    /** @param {unknown} value */
    function date(value) { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 8640000000000000 ? new Date(value).toLocaleString('de-DE') : 'Unbekannt'; }
    /** @param {unknown} value @param {string} yes @param {string} no */
    function boolean(value, yes, no) { return value === true ? yes : value === false ? no : 'Unbestätigt'; }
    /** @param {unknown} value */
    function safeCode(value) { return typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(value) ? value : ''; }
    /** @param {string} code */
    function explanation(code) { return errors[code] || (code ? `Die Aktion ist derzeit nicht freigegeben. Meldung: ${code}` : 'Prozessbedienung derzeit nicht verfügbar.'); }
    /** @param {unknown} value @returns {Controls|null} */
    function readControls(value) {
        const raw = record(value);
        if (typeof raw.enabled !== 'boolean' || typeof raw.canEnable !== 'boolean' || typeof raw.canDisable !== 'boolean' ||
            typeof raw.canRestart !== 'boolean' || typeof raw.busy !== 'boolean' || typeof raw.revision !== 'string' ||
            !/^[a-f0-9-]{36}$/.test(raw.revision)) return null;
        return { enabled: raw.enabled, canEnable: raw.canEnable, canDisable: raw.canDisable, canRestart: raw.canRestart,
            busy: raw.busy, reason: safeCode(raw.reason), revision: raw.revision };
    }
    /** @param {string} text @param {boolean} [error] */
    function showControlMessage(text, error = false) { controlMessage.textContent = text; controlMessage.className = `runtime-control-message${error ? ' is-error' : ''}`; }
    function updateButtons() {
        list.querySelectorAll('button[data-action]').forEach(node => {
            if (!(node instanceof HTMLButtonElement)) return;
            const entry = controls.get(node.dataset.process || ''); const action = node.dataset.action;
            const permitted = entry && !entry.busy && (action === 'enable' ? entry.canEnable : action === 'disable' ? entry.canDisable : action === 'restart' && entry.canRestart);
            node.disabled = !!mutation || blocked || !csrf || !permitted;
        });
        refreshButton.disabled = !!controller || !!mutation;
    }
    /** @param {string} text */
    function unavailable(text) {
        controls.clear(); csrf = '';
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
    /** @param {HTMLElement} card @param {string} id @param {Controls|null} entry */
    function addControls(card, id, entry) {
        const actions = document.createElement('div'); actions.className = 'runtime-controls';
        actions.setAttribute('aria-label', `${labels[id]} bedienen`);
        for (const [action, text] of [['enable', 'Aktivieren'], ['disable', 'Deaktivieren'], ['restart', 'Neustarten']]) {
            if (!action || !text) continue;
            const button = document.createElement('button'); button.type = 'button'; button.className = 'btn';
            button.dataset.action = action; button.dataset.process = id; button.textContent = text; button.disabled = true;
            button.setAttribute('aria-label', `${labels[id]}: ${text}`);
            button.addEventListener('click', () => { void control(id, action); }); actions.append(button);
        }
        const note = document.createElement('p'); note.className = 'runtime-control-note';
        if (!entry) note.textContent = 'Prozessbedienung derzeit nicht verfügbar. Status aktualisieren.';
        else if (entry.busy) note.textContent = 'Steuerauftrag läuft. Der bestätigte Prozessstatus wird automatisch aktualisiert.';
        else if (entry.reason) { note.textContent = explanation(entry.reason); note.classList.add('is-blocked'); }
        else if (id === 'ui') note.textContent = 'Deaktivieren beendet die Oberfläche. Die Administration und diese Seite bleiben erreichbar.';
        else if (id === 'ems') note.textContent = 'Deaktivieren hält die EMS-Regelung an. Aktivieren startet sie mit der gespeicherten Konfiguration.';
        else note.textContent = 'Aktivieren schaltet Modul und Prozess gemeinsam ein. Deaktivieren beendet den Prozess; die Konfiguration bleibt gespeichert.';
        card.append(actions, note);
        if (id !== 'ui' && id !== 'ems') {
            const link = document.createElement('a'); link.className = 'runtime-config-link'; link.href = `/modules/${id}/`;
            link.textContent = 'Moduleinstellungen öffnen'; card.append(link);
        }
        if (entry?.reason.includes('MIGRATION')) {
            const link = document.createElement('a'); link.className = 'runtime-config-link'; link.href = '/migration/';
            link.textContent = 'Übernahmestatus öffnen'; card.append(link);
        }
    }
    /** @param {unknown} input */
    function render(input) {
        const value = record(input); const now = Date.now();
        if (!Array.isArray(value.processes) || value.processes.length > 39 || typeof value.observedAt !== 'number' ||
            !Number.isSafeInteger(value.observedAt) || value.observedAt > now + 5000 || now - value.observedAt > 15000) throw new Error('EOS_RUNTIME_INVALID_STATUS');
        const fragment = document.createDocumentFragment(); const seen = new Set(); let external = false;
        controls.clear(); csrf = typeof value.csrfToken === 'string' && value.csrfToken.length >= 16 && value.csrfToken.length <= 512 ? value.csrfToken : '';
        for (const raw of value.processes) {
            const row = record(raw); const id = typeof row.id === 'string' ? row.id : '';
            const isExternal = /^ocpp21\.\d{1,8}$/.test(id) || id === 'ocpp-external';
            if ((!Object.hasOwn(labels, id) && !isExternal) || seen.has(id)) continue;
            seen.add(id); external ||= isExternal;
            const entry = !isExternal && id !== 'admin' ? readControls(row.controls) : null;
            if (entry) controls.set(id, entry);
            const state = typeof row.state === 'string' && Object.hasOwn(states, row.state) ? row.state : 'unknown';
            const displayState = entry?.enabled === false && ['stopped', 'unknown'].includes(state) ? 'disabled'
                : entry?.reason === 'EOS_RUNTIME_MODULE_DISABLED' && ['stopped', 'disabled', 'unknown'].includes(state) ? 'moduleDisabled'
                : entry?.reason && !entry.busy && !['running', 'stopping'].includes(state) && entry.enabled ? 'blocked'
                : state === 'stopped' && row.generation === 0 && entry?.enabled ? 'notStarted' : state;
            const card = document.createElement('section'); card.className = 'eos-panel runtime-card'; card.dataset.process = id;
            const header = document.createElement('header'); const heading = document.createElement('h2');
            heading.textContent = isExternal ? (id === 'ocpp-external' ? 'OCPP · externe Instanzprüfung' : `OCPP · ${id}`) : labels[id] || id;
            const badge = document.createElement('span'); badge.className = `runtime-badge${displayState === 'running' ? ' is-running' : ['error', 'failed', 'backoff'].includes(displayState) ? ' is-error' : displayState === 'blocked' ? ' is-blocked' : ''}`;
            badge.textContent = states[displayState] || 'Unbestätigt'; header.append(heading, badge); card.append(header);
            const kind = document.createElement('p'); kind.className = 'runtime-kind';
            kind.textContent = isExternal ? 'Separater ioBroker-Adapter' : id === 'admin' ? 'Administrationsprozess' : 'Eigener EOS-Prozess'; card.append(kind);
            const fields = document.createElement('dl');
            field(fields, 'Prozessnummer (PID)', ['running', 'starting', 'stopping'].includes(state) && typeof row.pid === 'number' && row.pid > 0 ? natural(row.pid) : 'Unbekannt');
            field(fields, isExternal ? 'Controller meldet aktiv' : id === 'ui' ? 'Oberfläche aktiv' : id === 'admin' ? 'Administration erreichbar' : 'Betrieb freigegeben', boolean(row.active, 'Ja', 'Nein'));
            if (id === 'ems') field(fields, 'EMS bereit', boolean(row.emsReady, 'Ja', 'Nein'));
            if (isExternal) field(fields, 'OCPP-Verbindung', boolean(row.connected, 'Verbunden', 'Getrennt'));
            if (!isExternal && id !== 'admin') {
                if (entry) field(fields, 'Prozessfreigabe', entry.enabled ? 'Aktiviert' : 'Deaktiviert');
                field(fields, 'Neustarts in diesem Lauf', natural(row.restarts)); field(fields, 'Generation', natural(row.generation));
                field(fields, 'Letzter Heartbeat', date(row.lastHeartbeatAt));
                if (row.nextRestartAt) field(fields, 'Neustart frühestens', date(row.nextRestartAt));
            }
            if (isExternal) field(fields, 'Letzte Alive-Meldung', date(row.lastHeartbeatAt));
            const code = safeCode(row.reason);
            if (code && !['RUNNING', 'DISABLED'].includes(code)) field(fields, 'Meldung', code);
            card.append(fields);
            if (code && errors[code] && entry?.reason !== code) {
                const note = document.createElement('p'); note.className = 'runtime-control-note is-blocked';
                note.textContent = errors[code]; card.append(note);
            }
            if (!isExternal && id !== 'admin') addControls(card, id, entry);
            else {
                const note = document.createElement('p'); note.className = 'runtime-control-note';
                note.textContent = isExternal ? 'Diese separate Instanz wird im ioBroker verwaltet. Die EOS-Schalter verändern sie nicht.'
                    : 'Bleibt als Zugang zur Prozessverwaltung aktiv. Einen vollständigen EOS-Neustart über die ioBroker-Instanzverwaltung ausführen.';
                const link = document.createElement('a'); link.className = 'runtime-config-link'; link.href = '/system/';
                link.textContent = 'ioBroker-Verwaltung öffnen'; card.append(note, link);
            }
            fragment.append(card);
        }
        if (!seen.has('admin') || !seen.has('ui') || !seen.has('ems')) throw new Error('EOS_RUNTIME_INVALID_STATUS');
        list.replaceChildren(fragment); element('observed-at').textContent = `Abfrage bestätigt: ${date(value.observedAt)}`;
        element('external-note').textContent = external ? 'Zusätzlich vorhandene OCPP-Adapter werden separat angezeigt. Ihre Prozessnummer stammt ausschließlich aus bestätigten Controller-Meldungen. Ein gleichzeitig laufender Altadapter muss vor der Übernahme vollständig beendet sein.' : 'Das integrierte OCPP-Modul läuft als eigener EOS-Prozess. Es ist keine zusätzliche aktive OCPP-Adapterinstanz erfasst.';
        message.textContent = 'Prozessstatus aktualisiert.'; message.className = '';
        updateButtons();
    }
    function clearTimer() { if (timer !== null) clearTimeout(timer); timer = null; }
    async function refresh() {
        if (paused || document.hidden || controller || blocked || mutation) return;
        clearTimer(); const started = performance.now(); const request = new AbortController(); controller = request;
        const requestRevision = revision;
        refreshButton.disabled = true;
        const deadline = setTimeout(() => request.abort(), 5000);
        try {
            const response = await fetch('/api/eos/runtime', { credentials: 'same-origin', cache: 'no-store', signal: request.signal });
            if (paused || request.signal.aborted || requestRevision !== revision) return;
            if (response.status === 401 || response.status === 403) {
                blocked = true; unavailable(response.status === 401 ? 'Bitte erneut bei EOS anmelden.' : 'Diese Ansicht ist nur für die EOS-Administration freigegeben.'); return;
            }
            if (!response.ok) throw new Error('EOS_RUNTIME_STATUS_UNAVAILABLE');
            const value = await response.json(); if (!paused && !request.signal.aborted && requestRevision === revision) render(value);
        } catch {
            if (!paused && requestRevision === revision) unavailable('Prozessstatus vorübergehend nicht erreichbar. Die Abfrage wird automatisch wiederholt.');
        } finally {
            clearTimeout(deadline); controller = null; updateButtons();
            if (!paused && !blocked && !document.hidden && !mutation) {
                const delay = resumePending ? 0 : Math.max(0, POLL_MS - (performance.now() - started)); resumePending = false;
                timer = setTimeout(() => void refresh(), delay);
            }
        }
    }
    /** @param {string} id @param {string} action */
    async function control(id, action) {
        const entry = controls.get(id);
        const permitted = entry && !entry.busy && (action === 'enable' ? entry.canEnable : action === 'disable' ? entry.canDisable : action === 'restart' && entry.canRestart);
        if (mutation || blocked || !csrf || !permitted) return;
        const token = csrf; const expectedRevision = entry.revision;
        clearTimer(); revision++; controller?.abort();
        const request = new AbortController(); mutation = request; updateButtons();
        showControlMessage(`${labels[id]}: Steuerauftrag wird gesendet …`);
        const deadline = setTimeout(() => request.abort(), 5000);
        try {
            const response = await fetch(`/api/eos/runtime/${id}/control`, { method: 'POST', credentials: 'same-origin', cache: 'no-store',
                headers: { 'Content-Type': 'application/json', 'x-nw-csrf': token }, body: JSON.stringify({ action, expectedRevision }), signal: request.signal });
            const result = record(await response.json());
            if (!response.ok || result.ok !== true) {
                const code = safeCode(result.error);
                if (response.status === 401 || (response.status === 403 && code !== 'AUTH_CSRF')) {
                    blocked = true; unavailable(explanation(code || (response.status === 401 ? 'AUTHENTICATION_REQUIRED' : 'ADMIN_REQUIRED')));
                }
                showControlMessage(explanation(code), true); return;
            }
            showControlMessage(`${labels[id]}: Steuerauftrag angenommen. Der bestätigte Abschluss wird im Prozessstatus angezeigt.`);
        } catch {
            showControlMessage('Die Bestätigung des Steuerauftrags fehlt. Den aktualisierten Prozessstatus prüfen, bevor du die Aktion erneut ausführst.', true);
        } finally {
            clearTimeout(deadline); mutation = null; updateButtons();
            // A lost response is not a failed or completed lifecycle. Read the server state; never replay the command automatically.
            if (!paused && !document.hidden && !blocked) {
                if (controller) resumePending = true;
                else void refresh();
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
