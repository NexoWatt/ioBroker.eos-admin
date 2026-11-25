// @ts-check
'use strict';
(() => {
    const api = '/api/eos/modules/eebus';
    /** @param {string} id @returns {HTMLElement} */
    const element = id => { const found = document.getElementById(id); if (!found) throw new Error('EEBUS_UI_ELEMENT'); return found; };
    /** @param {string} id @returns {HTMLInputElement} */
    const inputElement = id => { const found = element(id); if (!(found instanceof HTMLInputElement)) throw new Error('EEBUS_UI_INPUT'); return found; };
    /** @typedef {[string, string, 'checkbox'|'number'|'text'|'password', boolean|number|string, number?, number?]} Field */
    /** @typedef {{id:string,name:string,ski:string,fingerprint:string,trusted:boolean,state:string}} Device */
    /** @typedef {{running:boolean,shipPort:number|undefined,commandDryRun:boolean,localSki:string,certificateFingerprint:string,devices:Device[]}} Details */
    /** @typedef {{csrfToken?:string,configurationRevision?:string,config:Record<string,unknown>,status:{reason:string,state:string,details:Details}}} ApiData */
    /** @param {unknown} value @returns {value is Record<string,unknown>} */
    const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
    /** @param {unknown} raw @returns {ApiData} */
    function parseData(raw) {
        if (!record(raw)) throw new Error('EEBUS_API_RESPONSE');
        if (raw.error === 'EOS_MODULE_CONFIG_CONFLICT') throw new Error('Die EEBus-Einstellungen wurden inzwischen geändert. Deine Eingaben bleiben erhalten. Seite neu laden und Änderungen mit dem gespeicherten Stand abgleichen.');
        if (raw.error) throw new Error(typeof raw.error === 'string' ? raw.error : 'EEBUS_API_ERROR');
        const status = record(raw.status) ? raw.status : {};
        const data = record(status.details) ? status.details : status;
        const devices = (Array.isArray(data.devices) ? data.devices.slice(0, 128) : []).filter(record).map(device => ({
            id: String(device.id || ''), name: String(device.name || ''), ski: String(device.ski || ''),
            fingerprint: String(device.fingerprint || ''), trusted: device.trusted === true, state: String(device.state || '') }));
        return { csrfToken: typeof raw.csrfToken === 'string' ? raw.csrfToken : undefined,
            configurationRevision: typeof raw.configurationRevision === 'string' ? raw.configurationRevision : undefined,
            config: record(raw.config) ? raw.config : {}, status: { reason: String(status.reason || ''), state: String(status.state || ''),
                details: { running: data.running === true, shipPort: typeof data.shipPort === 'number' ? data.shipPort : undefined,
                    commandDryRun: data.commandDryRun !== false, localSki: String(data.localSki || ''),
                    certificateFingerprint: String(data.certificateFingerprint || ''), devices } } };
    }
    let token = '';
    let configurationRevision = '';
    let busy = false;
    let initial = true;
    /** @type {Field[]} */
    const fields = [
        ['enabled', 'EEBus-Modul aktivieren', 'checkbox', false],
        ['commandDryRun', 'Testmodus: keine Steuerbefehle ausgeben', 'checkbox', true],
        ['autoApplyClsLimits', 'CLS-Vorgaben an den EOS-Regler übernehmen', 'checkbox', false],
        ['discoveryEnabled', 'Geräte im lokalen Netz entdecken (mDNS)', 'checkbox', true],
        ['shipServerEnabled', 'SHIP-Verbindungen von Geräten annehmen', 'checkbox', true],
        ['shipPort', 'SHIP-Port', 'number', 4712, 1024, 65535],
        ['serviceName', 'Gerätename im EEBus-Netz', 'text', 'NexoWatt EOS'],
        ['ianaPen', 'Herstellerkennung (IANA PEN)', 'text', '999999'],
        ['autoConnectEnabled', 'Verbindungsaufbau zu entdeckten Geräten', 'checkbox', true],
        ['spineDiscoveryEnabled', 'SPINE-Gerätefunktionen auslesen', 'checkbox', true],
        ['nexowattBridgeEnabled', 'Interne Verbindung zum EOS-Regler', 'checkbox', true],
        ['sendImplementationResultToCls', 'Zusätzliche CLS-Umsetzungsrückmeldung', 'checkbox', true],
        ['brand', 'Herstellername', 'text', 'NexoWatt'],
        ['model', 'Modellname', 'text', 'EOS'],
        ['shipPath', 'SHIP-WebSocket-Pfad', 'text', '/ship/'],
        ['pairingPin', 'Neue Kopplungs-PIN (leer: unverändert)', 'password', ''],
        ['measurementIntervalSec', 'Statusprüfung (Sekunden)', 'number', 10, 5, 3600],
        ['metadataIntervalSec', 'Metadatenprüfung (Sekunden)', 'number', 60, 30, 86400],
        ['nexowattBridgeHeartbeatSec', 'EOS-Verbindungsprüfung (Sekunden)', 'number', 5, 5, 300],
        ['nexowattBridgeRequestTimeoutMs', 'EOS-Anfragefrist (Millisekunden)', 'number', 2000, 100, 5000],
        ['nexowattAcceptanceTargetMs', 'Annahme-Zielzeit (Millisekunden)', 'number', 250, 50, 5000],
        ['nexowattControlTargetMs', 'Regelungs-Zielzeit (Millisekunden)', 'number', 1000, 100, 10000],
        ['nexowattFeedbackTargetMs', 'Rückmelde-Zielzeit (Millisekunden)', 'number', 1500, 200, 15000],
        ['nexowattImplementationTimeoutMs', 'Umsetzungsfrist (Millisekunden)', 'number', 5000, 1500, 30000],
        ['clsHeartbeatTimeoutSec', 'CLS-Heartbeat-Frist (Sekunden)', 'number', 120, 5, 3600],
    ];
    /** @param {Record<string,unknown>} config */
    function showConfig(config) {
        element('basic-fields').replaceChildren(); element('expert-fields').replaceChildren();
        fields.forEach(([key, label, type, fallback, min, max], index) => {
            const wrap = document.createElement('label'); wrap.className = type === 'checkbox' ? 'checkbox-field' : '';
            const input = document.createElement('input'); input.id = `field-${key}`; input.name = key; input.type = type;
            if (type === 'checkbox') input.checked = typeof config[key] === 'boolean' ? config[key] : Boolean(fallback);
            else input.value = type === 'password' ? '' : String(config[key] ?? fallback);
            if (type === 'number') { input.min = String(min); input.max = String(max); input.step = '1'; }
            if (type === 'password') { input.autocomplete = 'new-password'; input.maxLength = 32; }
            const caption = document.createElement('span'); caption.textContent = label;
            wrap.append(caption, input); element(index < 9 ? 'basic-fields' : 'expert-fields').append(wrap);
        });
    }
    function readConfig() {
        /** @type {Record<string,unknown>} */
        const config = {};
        for (const [key, , type] of fields) {
            const input = inputElement(`field-${key}`);
            if (!input.checkValidity()) throw new Error(`Einstellung prüfen: ${input.name}`);
            if (type === 'password' && !input.value) continue;
            config[key] = type === 'checkbox' ? input.checked : type === 'number' ? input.valueAsNumber : input.value;
        }
        return config;
    }
    /** @param {string} text @param {boolean} [failed] */
    const message = (text, failed = false) => {
        element('message').textContent = text;
        element('message').className = failed ? 'error' : '';
    };
    /** @param {string} [path] @param {string} [method] @param {unknown} [body] @returns {Promise<ApiData>} */
    async function request(path = '', method = 'GET', body) {
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), 15000);
        try {
            const response = await fetch(api + path, { method, credentials: 'same-origin', signal: abort.signal,
                headers: { 'Content-Type': 'application/json', ...(method !== 'GET' ? { 'x-nw-csrf': token } : {}) },
                ...(body ? { body: JSON.stringify(body) } : {}) });
            const data = parseData(await response.json());
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            if (typeof data.csrfToken === 'string') token = data.csrfToken;
            return data;
        } finally { clearTimeout(timer); }
    }
    /** @param {HTMLElement} target @param {string} label @param {unknown} value */
    function row(target, label, value) {
        const dt = document.createElement('dt'); dt.textContent = label;
        const dd = document.createElement('dd'); dd.textContent = String(value ?? '–');
        target.append(dt, dd);
    }
    async function render(replaceConfig = false) {
        const data = await request();
        const details = data.status?.details || data.status || {};
        const status = element('status'); status.replaceChildren();
        row(status, 'Modul', details.running ? 'Aktiv' : String(data.status?.reason || data.status?.state || 'Inaktiv'));
        row(status, 'SHIP-Port', details.shipPort || data.config?.shipPort || 4712);
        row(status, 'Steuerbefehle', details.commandDryRun !== false ? 'Testmodus – keine Ausgabe' : 'Ausgabe freigegeben');
        row(status, 'Eigener SKI', details.localSki || 'Wird beim ersten Start angelegt');
        row(status, 'Zertifikat-Fingerabdruck', details.certificateFingerprint || '–');
        if (initial || replaceConfig) { showConfig(data.config || {}); configurationRevision = data.configurationRevision || ''; initial = false; }
        const list = element('devices'); list.replaceChildren();
        if (!Array.isArray(details.devices) || !details.devices.length) list.textContent = 'Noch keine Geräte erkannt. Aktivierung, Netzwerk und EEBus an der Gegenstelle prüfen.';
        for (const device of (Array.isArray(details.devices) ? details.devices : [])) {
            const card = document.createElement('article'); card.className = 'device';
            const heading = document.createElement('h3'); heading.textContent = device.name || device.id; card.append(heading);
            for (const text of [`Status: ${device.state || 'unbekannt'} · ${device.trusted ? 'Freigegeben' : 'Nicht gekoppelt'}`, `SKI: ${device.ski || device.id}`, `Zertifikat: ${device.fingerprint || 'Noch kein TLS-Zertifikat beobachtet'}`]) {
                const p = document.createElement('p'); p.textContent = text; card.append(p);
            }
            for (const [action, label] of [['pairing.approve', 'Gerät freigeben'], ['pairing.reject', 'Freigabe widerrufen'], ['device.connect', 'Verbinden'], ['device.disconnect', 'Trennen'], ['device.refresh', 'Daten aktualisieren']]) {
                const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
                button.disabled = !details.running || (action === 'pairing.approve' && !device.fingerprint);
                button.addEventListener('click', () => operation(async () => {
                    if (action === 'pairing.approve' && !window.confirm(`Dieses Gerät ausdrücklich freigeben?\nSKI: ${device.ski}\nZertifikat: ${device.fingerprint}\nBitte mit der Gegenstelle vergleichen.`)) return;
                    await request('/command', 'POST', { command: action, payload: { deviceId: device.id } });
                    await render(); message('Geräteaktion verarbeitet.');
                })); card.append(button);
            }
            list.append(card);
        }
    }
    /** @param {() => Promise<void>} work */
    async function operation(work) {
        if (busy) return;
        busy = true;
        try { await work(); } catch (error) { message(error instanceof Error ? error.message : 'Aktion fehlgeschlagen.', true); }
        finally { busy = false; }
    }
    element('refresh').addEventListener('click', () => operation(async () => { await render(); message('Status aktualisiert.'); }));
    element('save').addEventListener('click', () => operation(async () => {
        const config = readConfig();
        await request('', 'PUT', { config, expectedConfigurationRevision: configurationRevision }); await render(true); message('Konfiguration gespeichert.');
    }));
    element('import').addEventListener('click', () => operation(async () => {
        const instance = inputElement('legacy').value.trim();
        if (!/^eebus\.\d+$/.test(instance)) throw new Error('Bitte eine EEBus-Instanz wie eebus.0 angeben.');
        if (!window.confirm('Konfiguration der gestoppten alten Instanz übernehmen? Das Modul bleibt deaktiviert; Geräte müssen neu gekoppelt werden.')) return;
        await request('/import', 'POST', { instance }); await render(true); message('Konfiguration deaktiviert übernommen.');
    }));
    operation(async () => { await render(); message('Bereit.'); });
})();
