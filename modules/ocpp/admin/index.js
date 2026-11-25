/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
(() => {
    const api = '/api/eos/modules/ocpp';
    /** @typedef {Record<string,unknown>} Data */
    /** @typedef {{key:string,label:string,type:string,default:unknown,min?:number,max?:number,step?:number|string,help?:string}} Field */
    /** @typedef {{id:string,title:string,fields:Field[]}} Group */
    /** @param {unknown} value @returns {Data} */
    const record = value => value && typeof value === 'object' && !Array.isArray(value) ? /** @type {Data} */ (value) : {};
    /** @param {string} id @returns {HTMLElement} */
    function element(id) { const found = document.getElementById(id); if (!found) throw new Error('OCPP_UI_ELEMENT'); return found; }
    /** @param {string} id @returns {HTMLInputElement|HTMLTextAreaElement} */
    function input(id) { const found = element(id); if (!(found instanceof HTMLInputElement || found instanceof HTMLTextAreaElement)) throw new Error('OCPP_UI_INPUT'); return found; }
    /** @param {string} id @returns {HTMLButtonElement} */
    const button = id => /** @type {HTMLButtonElement} */ (element(id));
    const editor = /** @type {HTMLFieldSetElement} */ (element('editor'));
    /** @type {Group[]} */ let groups = [];
    /** @type {Data} */ let savedConfig = {};
    let token = ''; let revision = ''; let ready = false; let busy = false; let dirty = false; let paused = document.hidden; let authBlocked = false; let importAllowed = false;
    /** @type {ReturnType<typeof setTimeout>|null} */ let pollTimer = null;
    /** @type {AbortController|null} */ let polling = null;
    /** @param {string} text @param {boolean} [failed] */
    function message(text, failed = false) { element('message').textContent = text; element('message').className = `eos-message${failed ? ' is-error' : ''}`; }
    /** @param {unknown} code */
    function explanation(code) {
        /** @type {Record<string,string>} */ const messages = {
            AUTHENTICATION_REQUIRED: 'Bitte erneut bei EOS anmelden.', ADMIN_REQUIRED: 'Die OCPP-Konfiguration ist nur für die EOS-Administration freigegeben.',
            AUTH_CSRF: 'Die Sitzung konnte nicht bestätigt werden. Bitte den gespeicherten Stand neu laden.',
            PASSWORD_CHANGE_REQUIRED: 'Zuerst das EOS-Passwort in der Administration festlegen.',
            EOS_MODULE_CONFIG_CONFLICT: 'Die gespeicherte Konfiguration wurde inzwischen geändert. Deine Eingaben bleiben erhalten. Gespeicherten Stand laden und Änderungen abgleichen.',
            EOS_MODULE_LEGACY_RUNNING: 'Die bisherige OCPP-Instanz läuft noch. Vor der Übernahme vollständig stoppen.',
            EOS_MODULE_LEGACY_ENABLED: 'Die bisherige OCPP-Instanz ist noch aktiviert. Vor der Übernahme vollständig stoppen und deaktivieren.',
            LEGACY_CONFLICT: 'Eine bisherige OCPP-Instanz ist noch aktiv oder ihr Stop ist nicht bestätigt.',
            LICENSE_REQUIRED: 'Für OCPP fehlt die zentrale EOS-Freigabe.', DISABLED: 'Modul deaktiviert.',
            STARTING: 'OCPP-Prozess startet.', RUNNING: 'OCPP-Modul aktiv.', PROCESS_BACKOFF: 'OCPP wartet vor einem erneuten Start.',
            CONFIG_INVALID: 'Die gespeicherte OCPP-Konfiguration muss geprüft werden.',
            EOS_OCPP_CONFIG_PORT: 'WebSocket-Port prüfen: erlaubt sind 1024 bis 65535.',
            EOS_OCPP_PORT_IN_USE: 'Der OCPP-Port wird bereits verwendet. Portbelegung oder bisherige Instanz prüfen.',
            EOS_OCPP_CONFIG_INVALID: 'Der gespeicherte Konfigurationsstand ist ungültig. Einstellungen prüfen.',
            EOS_OCPP_CONFIG_NUMBER: 'Zahlenwerte und angegebene Einstellgrenzen prüfen.',
            EOS_OCPP_CONFIG_BOOLEAN: 'Aktivierungsfelder müssen ein- oder ausgeschaltet sein.',
            EOS_OCPP_CONFIG_IDENTITIES: 'Stationskennungen prüfen: maximal 256 eindeutige Kennungen ohne Schrägstriche oder Steuerzeichen.',
            EOS_OCPP_CONFIG_PROTOCOL: 'Mindestens eine OCPP-Protokollversion aktivieren.',
            EOS_OCPP_CONFIG_KEY: 'Die Konfiguration enthält nicht unterstützte Felder. Vor einer Übernahme prüfen.',
            EOS_OCPP_TRANSPORT_REVIEW_REQUIRED: 'Die bisherige Konfiguration enthält TLS- oder Zugangseinstellungen, die vor der Übernahme geprüft werden müssen.',
            EOS_OCPP_LEGACY_VERSION: 'Die bisherige OCPP-Version unterstützt diese Übernahme noch nicht.',
            EOS_OCPP_START_FAILED: 'OCPP konnte nicht starten. Portbelegung und Prozessdiagnose prüfen.',
            EOS_OCPP_STOP_FAILED: 'Der OCPP-Prozess konnte nicht bestätigt gestoppt werden. Prozessdiagnose prüfen.',
            EOS_MODULE_IMPORT_REQUIRES_DISABLED: 'Vor der Übernahme das integrierte OCPP-Modul deaktivieren, speichern und seinen bestätigten Stop abwarten.',
            EOS_MODULE_IMPORT_ALREADY_MIGRATED: 'Diese OCPP-Konfiguration wurde bereits übernommen. Die bisherigen Datenpunktnamen bleiben erhalten.',
            EOS_MODULE_IMPORT_UNAVAILABLE: 'Die alte OCPP-Instanz ist nicht verfügbar oder noch aktiviert.',
            EOS_MODULE_IMPORT_VERSION: 'Die bisherige OCPP-Instanz muss Version 0.4.2 oder 0.4.3 verwenden.',
            EOS_MODULE_IMPORT_SOURCE_CHANGED: 'Die bisherige Instanz wurde verändert oder ihr Stop ist nicht mehr bestätigt. Zustand prüfen und erneut übernehmen.',
            EOS_MODULE_STOP_UNCONFIRMED: 'Der Stop des bisherigen Modulprozesses ist noch nicht bestätigt.',
            EOS_MODULE_NOT_READY: 'EOS lädt noch den gespeicherten Modulstand. Bitte kurz warten und erneut laden.',
            EOS_MODULE_BUSY: 'EOS verarbeitet bereits eine Konfigurationsänderung. Bitte kurz warten und erneut versuchen.',
            EOS_MODULE_MIGRATION_BLOCKED: 'Die Bestandsübernahme ist noch nicht freigegeben. Details unter „Status der Bestandsübernahme“ prüfen.',
            EOS_MODULE_CONFIG_UNAVAILABLE: 'Der gespeicherte Modulstand kann derzeit nicht bestätigt geladen werden.',
        };
        const value = typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,100}$/.test(code) ? code : '';
        return messages[value] || (value ? `OCPP meldet ${value}. Konfiguration und Prozessdiagnose prüfen.` : 'OCPP-Status derzeit nicht bestätigt.');
    }
    function controls() {
        editor.disabled = busy || !ready;
        button('save').disabled = busy || !ready || !revision || !token;
        button('reload').disabled = busy || !groups.length;
        button('import').disabled = busy || !token || !importAllowed;
        button('refresh').disabled = busy;
    }
    /** @param {Data} config */
    function showConfig(config) {
        savedConfig = structuredClone(config); const target = element('config-fields'); target.replaceChildren();
        for (const group of groups) {
            const container = group.id === 'general' ? document.createElement('div') : document.createElement('details');
            if (container instanceof HTMLDetailsElement) { container.className = 'ocpp-group'; const summary = document.createElement('summary'); summary.textContent = group.title; container.append(summary); }
            const fields = document.createElement('div'); fields.className = 'ocpp-fields';
            for (const field of group.fields) {
                const label = document.createElement('label'); label.className = `ocpp-field${field.type === 'checkbox' ? ' ocpp-check' : ''}`;
                const caption = document.createElement('span'); caption.textContent = field.label;
                const control = field.type === 'list' ? document.createElement('textarea') : document.createElement('input');
                control.id = `field-${field.key}`; control.name = field.key;
                const value = config[field.key] ?? field.default;
                if (control instanceof HTMLInputElement) {
                    control.type = field.type;
                    if (field.type === 'checkbox') control.checked = value === true;
                    else { control.value = String(value ?? ''); control.required = true; }
                    if (field.type === 'number') { control.min = String(field.min); control.max = String(field.max); control.step = String(field.step || 1); }
                } else { control.value = Array.isArray(value) ? value.join('\n') : ''; control.rows = 3; control.maxLength = 33024; }
                label.append(caption, control);
                if (field.help && field.type !== 'checkbox') { const hint = document.createElement('small'); hint.textContent = field.type === 'list' ? 'Eine Kennung pro Zeile. Leer: alle Stationskennungen zulassen.' : field.help; label.append(hint); }
                fields.append(label);
            }
            container.append(fields); target.append(container);
        }
        dirty = false; element('draft-status').textContent = 'Gespeicherter Stand geladen.';
    }
    function readConfig() {
        const next = structuredClone(savedConfig);
        for (const group of groups) for (const field of group.fields) {
            const control = input(`field-${field.key}`);
            if (!control.checkValidity()) { control.reportValidity(); throw new Error(`Bitte „${field.label}“ prüfen.`); }
            if (field.type === 'list') {
                const identities = control.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
                if (identities.length > 256 || identities.some(value => value.length > 128 || [...value].some(char => char === '/' || char === '\\' || char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))) throw new Error('Stationskennungen prüfen: höchstens 256 Einträge, je 1 bis 128 Zeichen, ohne Schrägstriche oder Steuerzeichen.');
                next[field.key] = [...new Set(identities)];
            } else if (control instanceof HTMLInputElement) next[field.key] = field.type === 'checkbox' ? control.checked : control.valueAsNumber;
        }
        if (next.enabled === true && ![next.enable16, next.enable201, next.enable21].some(value => value === true)) throw new Error('Mindestens eine OCPP-Protokollversion aktivieren.');
        return next;
    }
    /** @param {string} [path] @param {string} [method] @param {unknown} [body] @param {AbortSignal} [signal] */
    async function request(path = '', method = 'GET', body, signal) {
        const timeout = AbortSignal.timeout(15000);
        try {
        const response = await fetch(api + path, { method, credentials: 'same-origin', cache: 'no-store',
            signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
            headers: { 'Content-Type': 'application/json', ...(method !== 'GET' ? { 'x-nw-csrf': token } : {}) },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
        const data = record(await response.json());
        if (response.status === 401 || response.status === 403) { authBlocked = true; ready = false; token = ''; controls(); }
        if (!response.ok || data.error) throw new Error(explanation(data.error || (response.status === 401 ? 'AUTHENTICATION_REQUIRED' : response.status === 403 ? 'ADMIN_REQUIRED' : 'EOS_MODULE_REQUEST_FAILED')));
        if (typeof data.csrfToken === 'string') token = data.csrfToken;
        authBlocked = false;
        return data;
        } catch (error) { if (method === 'GET' && !signal?.aborted) clearStatus(); throw error; }
    }
    /** @param {HTMLElement} target @param {string} label @param {unknown} value */
    function row(target, label, value) { const title = document.createElement('dt'); title.textContent = label; const text = document.createElement('dd'); text.textContent = String(value ?? 'Unbekannt'); target.append(title, text); }
    /** @param {unknown} value */
    function date(value) { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 8640000000000000 ? new Date(value).toLocaleString('de-DE') : 'Unbekannt'; }
    /** @param {unknown} value */
    function short(value) { return typeof value === 'string' ? value.slice(0, 256) : ''; }
    /** @param {Data} data @param {boolean} [replace] */
    function render(data, replace = false) {
        const config = record(data.config); const status = record(data.status); const details = record(status.details); const process = record(details.process);
        const manualImport = record(data.manualImport); importAllowed = manualImport.allowed === true;
        element('import-status').textContent = importAllowed ? 'Übernahme verfügbar, sobald die bisherige Instanz deaktiviert und bestätigt gestoppt ist.' : explanation(manualImport.reason);
        const namespace = typeof status.namespace === 'string' && /^(?:eos-admin\.\d{1,8}\.ocpp|ocpp21\.\d{1,8})$/.test(status.namespace) ? status.namespace : '';
        const target = element('status'); target.replaceChildren();
        const confirmed = details.statusUnavailable !== true;
        row(target, 'Modul', confirmed && status.active === true && details.started === true && process.state === 'running' ? 'Aktiv'
            : !confirmed || status.reason === 'RUNNING' ? 'Status nicht bestätigt' : explanation(status.reason || details.lastError));
        row(target, 'Datenpunktbereich', namespace || 'Noch nicht bestätigt');
        const port = Number.isInteger(details.port) ? Number(details.port) : Number(config.port);
        row(target, 'WebSocket-Port', port >= 1024 && port <= 65535 ? port : 'Unbekannt');
        row(target, 'Prozess', typeof process.pid === 'number' && process.pid > 0 ? `PID ${process.pid}` : 'Nicht bestätigt');
        row(target, 'Version', short(details.sourceVersion) || 'Noch nicht gestartet');
        if (details.lastError || process.lastError) row(target, 'Meldung', explanation(details.lastError || process.lastError));
        element('connection-address').textContent = port >= 1024 && port <= 65535 ? `ws://${location.hostname}:${port}/<Stationskennung>` : 'Noch kein bestätigter Port';
        if (replace) {
            if (!data.config || typeof data.configurationRevision !== 'string' || !/^[a-f0-9-]{36}$/.test(data.configurationRevision)) throw new Error('Der gespeicherte OCPP-Stand ist noch nicht verfügbar. Bitte erneut laden.');
            showConfig(config); revision = data.configurationRevision; ready = data.configurationReady !== false;
        } else {
            if (data.configurationReady === true && revision) ready = true;
            if (data.configurationRevision !== revision && revision) element('draft-status').textContent = 'Der gespeicherte Stand wurde geändert. Deine Eingaben bleiben erhalten; vor dem Speichern abgleichen.';
        }
        if (data.configurationReady === false) { ready = false; element('draft-status').textContent = explanation(data.configurationReason); }
        const list = element('stations'); list.replaceChildren();
        const stations = confirmed && Array.isArray(details.stations) ? details.stations.slice(0, 256) : [];
        if (!stations.length) { const empty = document.createElement('p'); empty.textContent = 'Noch keine Ladestation gemeldet. Modulstatus, Port und Verbindungsadresse an der Station prüfen.'; list.append(empty); }
        for (const item of stations) {
            const station = record(item); const id = short(station.id); const card = document.createElement('article'); card.className = 'ocpp-station';
            const header = document.createElement('header'); const title = document.createElement('h3'); title.textContent = short(station.identity) || id || 'Ladestation';
            const badge = document.createElement('span'); badge.className = `ocpp-badge${station.connected === true ? ' is-online' : ''}`; badge.textContent = station.connected === true ? 'Verbunden' : station.connected === false ? 'Getrennt' : 'Unbestätigt'; header.append(title, badge); card.append(header);
            const fields = document.createElement('dl'); fields.className = 'eos-detail-list';
            row(fields, 'Protokoll', short(station.protocol) || 'Unbekannt'); row(fields, 'Ladezustand', short(station.status) || 'Unbekannt');
            row(fields, 'Messwerte', station.dataFresh === true ? 'Aktuell' : station.dataFresh === false ? 'Nicht aktuell' : 'Nicht bestätigt');
            /** @type {Record<string,string>} */ const leaseStates = { active: 'Aktiv', expired: 'Abgelaufen', unarmed: 'Noch nicht aktiviert' };
            row(fields, 'Letzte Nachricht', date(station.lastSeenMs)); row(fields, 'EOS-Prozessfreigabe', leaseStates[short(station.leaseState)] || (station.leaseArmed === false ? 'Noch nicht aktiviert' : 'Unbestätigt')); card.append(fields);
            if (namespace && /^[A-Za-z0-9_-]{1,128}$/.test(id)) {
                const points = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'Wichtige Datenpunkte'; points.append(summary);
                for (const suffix of ['measurements.powerW', 'info.socketConnected', 'health.dataFresh', 'control.chargeLimit', 'control.chargeLimitStatus', 'control.eosLeaseState']) {
                    const line = document.createElement('p'); const code = document.createElement('code'); code.textContent = `${namespace}.${id}.${suffix}`; line.append(code); points.append(line);
                }
                card.append(points);
            }
            list.append(card);
        }
        controls();
    }
    function clearStatus() { element('stations').textContent = 'Stationsstatus derzeit nicht bestätigt.'; element('status').replaceChildren(); row(element('status'), 'Modul', 'Status nicht bestätigt'); }
    function clearPoll() { if (pollTimer !== null) clearTimeout(pollTimer); pollTimer = null; }
    function schedule() { clearPoll(); if (!authBlocked && !paused && !document.hidden) pollTimer = setTimeout(() => void poll(), 5000); }
    async function poll() {
        if (authBlocked || busy || paused || document.hidden || polling) { schedule(); return; }
        const controller = new AbortController(); polling = controller;
        try { const data = await request('', 'GET', undefined, controller.signal); if (!paused && !controller.signal.aborted) render(data); }
        catch (error) { if (!controller.signal.aborted) message(error instanceof Error ? error.message : 'Status nicht verfügbar.', true); }
        finally { polling = null; schedule(); }
    }
    /** @param {()=>Promise<void>} work */
    async function operation(work) {
        if (busy) return; busy = true; clearPoll(); polling?.abort(); controls();
        try { await work(); } catch (error) { message(error instanceof Error ? error.message : 'OCPP-Anfrage fehlgeschlagen.', true); }
        finally { busy = false; controls(); schedule(); }
    }
    element('config-form').addEventListener('input', () => { dirty = true; element('draft-status').textContent = 'Ungespeicherte Änderungen. Die automatische Statusprüfung erhält deine Eingaben.'; });
    element('config-form').addEventListener('submit', event => event.preventDefault());
    button('refresh').addEventListener('click', () => void operation(async () => { render(await request()); message('Status aktualisiert.'); }));
    button('reload').addEventListener('click', () => void operation(async () => { if (dirty && !confirm('Ungespeicherte Änderungen verwerfen und den gespeicherten Stand laden?')) return; render(await request(), true); message('Gespeicherten Stand geladen.'); }));
    button('save').addEventListener('click', () => {
        if (busy || !ready) return;
        try {
            const config = readConfig();
            void operation(async () => { await request('', 'PUT', { config, expectedConfigurationRevision: revision }); render(await request(), true); message('OCPP-Konfiguration gespeichert. Der Laufstatus wird geprüft.'); });
        } catch (error) { message(error instanceof Error ? error.message : 'OCPP-Eingaben prüfen.', true); }
    });
    button('import').addEventListener('click', () => void operation(async () => {
        const instance = input('legacy').value.trim(); if (!/^ocpp21\.\d{1,8}$/.test(instance)) throw new Error('Eine OCPP-Instanz wie ocpp21.0 angeben.');
        if (!confirm('Konfiguration der vollständig gestoppten OCPP-Instanz übernehmen? Der importierte Stand bleibt zunächst deaktiviert. Bestehende Eingaben werden ersetzt.')) return;
        await request('/import', 'POST', { instance }); render(await request(), true); message('OCPP-Konfiguration deaktiviert übernommen. Port und Ladepunkte prüfen, danach Modul aktivieren.');
    }));
    function pause() { paused = true; clearPoll(); polling?.abort(); }
    function resume() { if (!document.hidden && paused) { paused = false; void poll(); } }
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else resume(); }); window.addEventListener('pagehide', pause); window.addEventListener('pageshow', resume);
    void operation(async () => {
        const response = await fetch('/modules/ocpp/config-fields.json', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000) });
        const schema = record(await response.json()); if (!response.ok || !Array.isArray(schema.groups) || schema.groups.length > 8) throw new Error('OCPP-Eingabefelder konnten nicht geladen werden.');
        groups = schema.groups.map(raw => {
            const group = record(raw); if (typeof group.id !== 'string' || typeof group.title !== 'string' || !Array.isArray(group.fields) || group.fields.length > 48) throw new Error('OCPP-Felddefinition ungültig.');
            return { id: group.id, title: group.title, fields: group.fields.map(rawField => {
                const field = record(rawField); if (typeof field.key !== 'string' || !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(field.key) || typeof field.label !== 'string' || !['checkbox', 'number', 'list'].includes(String(field.type))) throw new Error('OCPP-Felddefinition ungültig.');
                return /** @type {Field} */ (field);
            }) };
        });
        render(await request(), true); message('OCPP-Konfiguration geladen.');
    });
})();
