// @ts-check
'use strict';
/** @typedef {{valid:boolean,code:string,uuid:string|null,edition:string|null,coreEnabled:boolean,tokenVersion:number|null,scope:string|null,expiresAt:number|null,limits:{chargePoints?:number,batteries?:number},features:string[]}} LicenseStatus */
/** @typedef {{kid:string,fingerprint:string,source:string}} KeyRow */
/** @typedef {{ready:boolean,code:string,canImport:boolean,source:string,keys:KeyRow[],allowedKeys:KeyRow[]}} TrustStatus */
/** @typedef {{license:LicenseStatus,trust:TrustStatus,message?:string}} Result */
(() => {
    /** @param {string} id @returns {HTMLElement} */
    const $ = id => {
        const element = document.getElementById(id);
        if (!element) throw new Error('LICENSE_PAGE');
        return element;
    };
    const tokenInput = (() => {
        const element = $('token');
        if (!(element instanceof HTMLTextAreaElement)) throw new Error('LICENSE_PAGE');
        return element;
    })();
    const trustFile = (() => {
        const element = $('trustFile');
        if (!(element instanceof HTMLInputElement)) throw new Error('LICENSE_PAGE');
        return element;
    })();
    /** @type {Record<string,string>} */
    const names = { energy: 'Energiemanagement', wallet: 'Energie-Wertkonto', smartHome: 'Smart Home', microgridSlave: 'Microgrid Slave', microgridMaster: 'Microgrid Master', multisite: 'Mehrere Standorte', billing: 'Abrechnung' };
    /** @type {Record<string,string>} */
    const errors = {
        LICENSE_MISSING: 'Keine Lizenz aktiviert. Den für diese System-UUID ausgestellten Lizenzcode eingeben.',
        LICENSE_VALID: 'Lizenz gültig.', LICENSE_EXPIRED: 'Lizenz abgelaufen. Eine passende Folgelizenz anfordern.',
        LICENSE_UUID_MISMATCH: 'Die Lizenz gehört zu einer anderen System-UUID. Den passenden Lizenzcode anfordern.',
        LICENSE_UUID_CHANGED: 'Die System-UUID hat sich geändert. Den Service mit der angezeigten UUID kontaktieren.',
        LICENSE_SIGNATURE_INVALID: 'Die Lizenzsignatur ist ungültig. Den unveränderten vollständigen Code vom Aussteller verwenden.',
        LICENSE_CLOCK_ROLLBACK: 'Die Systemzeit wurde zurückgestellt. Datum und Uhrzeit prüfen; gespeicherte Prüfdaten nicht löschen.',
        LICENSE_ADMIN_REQUIRED: 'Mit einem Administrator-Konto anmelden und den Status erneut prüfen.',
        LICENSE_HTTPS_REQUIRED: 'Die Lizenzverwaltung über HTTPS öffnen.',
        LICENSE_KEY_UNKNOWN: 'Der Ausstellerschlüssel ist noch nicht aktiv. Im Reiter „Öffentliche Prüfschlüssel & Wiederherstellung“ die öffentliche Schlüsseldatei importieren oder die OS-Einrichtung prüfen.',
        LICENSE_FORMAT: 'Einen vollständigen NWL3- oder bestehenden NWL2-Lizenzcode eingeben.',
        LICENSE_FORMAT_INVALID: 'Einen vollständigen NWL3- oder bestehenden NWL2-Lizenzcode eingeben.',
        LICENSE_CLAIMS_INVALID: 'Der signierte Lizenzumfang wird nicht unterstützt. Eine passende Lizenz beim Aussteller anfordern.',
        LICENSE_RATE_LIMIT: 'Zu viele Anfragen. Kurz warten und den Status erneut prüfen.',
        LICENSE_ORIGIN: 'Die Lizenzverwaltung direkt über die gleiche HTTPS-Adresse neu öffnen.',
        LICENSE_ORIGIN_REQUIRED: 'Die Lizenzverwaltung direkt über die gleiche HTTPS-Adresse neu öffnen.',
        LICENSE_REQUEST: 'Die Anfrage wurde abgewiesen. Eingabeformat und Dateigröße prüfen.',
        LICENSE_RESPONSE: 'Die Serverantwort konnte nicht sicher ausgewertet werden. Status aktualisieren; bei Wiederholung den Service kontaktieren.',
        SERVICE_STALE: 'Der Lizenzstatus ist nicht aktuell. Status erneut prüfen.',
        SERVICE_UNAVAILABLE: 'Die Lizenzverwaltung ist derzeit nicht bereit. Status erneut prüfen und bei Wiederholung den Service kontaktieren.',
        SERVICE_TIMEOUT: 'Die Anfrage wurde nach fünf Sekunden abgebrochen. Der Lizenzstatus ist unbestätigt. Status aktualisieren; eine Lizenz muss deshalb nicht erneut gekauft oder gelöscht werden.',
        TRUST_STARTING: 'Die Vertrauensprüfung startet. Den Status erneut prüfen.',
        TRUST_FILE_MISSING: 'Die ausdrücklich konfigurierte OS-Vertrauensdatei fehlt. Die autorisierte Systemverwaltung muss sie wiederherstellen; Herstellerfreigaben ersetzen diese Vorgabe nicht.',
        TRUST_READ_DENIED: 'Der Dienst darf die OS-Vertrauensdatei nicht lesen. Die autorisierte Systemverwaltung muss Eigentümer und Zugriffsrechte prüfen.',
        TRUST_RELEASE_METADATA: 'Die mitgelieferten Herstellerfreigaben konnten nicht bestätigt werden. Das unveränderte freigegebene EOS-Paket wiederherstellen lassen.',
        TRUST_KEY_LIMIT: 'Der Import würde mehr als 32 aktive Prüfschlüssel ergeben. Den Aussteller zur passenden Schlüsselzusammenstellung kontaktieren; bestehende Schlüssel nicht unkontrolliert löschen.',
        SERVICE_DIRECTORY: 'Der Lizenzspeicherpfad ist noch nicht eingerichtet. Die Dienstkonfiguration durch die Systemverwaltung prüfen lassen.',
        TRUST_READY: 'Öffentliche Prüfschlüssel sind verfügbar.',
        TRUST_MISSING: 'Kein aktiver Prüfschlüssel vorhanden. Eine zugelassene öffentliche Schlüsseldatei importieren oder die OS-Vertrauensdatei einrichten lassen.',
        TRUST_PATH: 'Der konfigurierte Pfad der OS-Vertrauensdatei ist ungültig. Die autorisierte Systemverwaltung muss die Konfiguration prüfen.',
        TRUST_PLATFORM_UNSUPPORTED: 'Die geschützte OS-Vertrauensdatei wird auf diesem Betriebssystem nicht unterstützt. Den Service zur passenden Einrichtung kontaktieren.',
        TRUST_FILE: 'Die OS-Vertrauensdatei ist nicht sicher lesbar oder hat ein ungültiges Format. Datei und Rechte durch die Systemverwaltung prüfen lassen.',
        TRUST_PERMISSIONS: 'Die OS-Vertrauensdatei ist nicht sicher zugreifbar. Eigentümer und Rechte durch die autorisierte Systemverwaltung prüfen lassen; Schutzrechte nicht lockern.',
        TRUST_INVALID: 'Die öffentliche Schlüsseldatei ist ungültig. Nur eine flache JSON-Zuordnung aus Schlüssel-ID und öffentlichem Ed25519-PUBLIC-KEY verwenden.',
        TRUST_IMPORT_UNKNOWN_KEY: 'Mindestens ein Schlüssel ist nicht freigegeben. Der Import wurde vollständig abgewiesen. Den Aussteller über eine autorisierte OS-Einrichtung oder Herstellerfreigabe bestätigen lassen.',
        TRUST_KEY_CONFLICT: 'Eine Schlüssel-ID gehört bereits zu einem anderen Schlüssel. Nichts wurde ersetzt. Die korrekte Datei beim Aussteller anfordern.',
        TRUST_PRIVATE_KEY_REJECTED: 'Private Schlüssel und Tresor-Backups dürfen nicht in EOS importiert werden. Im Key-Generator ausschließlich die öffentliche Schlüsseldatei exportieren.',
        TRUST_FILE_TOO_LARGE: 'Die Datei überschreitet 32 KiB. Eine reine öffentliche Schlüsseldatei mit höchstens 32 Einträgen verwenden.',
        TRUST_FILE_REQUIRED: 'Zuerst eine öffentliche JSON-Schlüsseldatei auswählen.',
        TRUST_IMPORT_DISABLED: 'Der Import ist derzeit nicht freigegeben. OS-Vertrauensdatei und deren Status prüfen lassen.',
        STORAGE_UNSAFE_PATH: 'Der Lizenzspeicherpfad ist unsicher. Die Dienstkonfiguration durch die Systemverwaltung prüfen lassen; keine Dateien löschen.',
        STORAGE_DIRECTORY_INVALID: 'Das Lizenzdatenverzeichnis hat ungültige Schutzrechte oder einen ungeeigneten Eigentümer. Die Systemverwaltung muss dies prüfen.',
        STORAGE_RUNTIME_ROOT_INVALID: 'Das Lizenzverzeichnis liegt außerhalb des zulässigen Dienstpfades. Die Dienstkonfiguration durch die Systemverwaltung prüfen lassen.',
        STORAGE_TRUST_DATA_INVALID: 'Die lokal wiederhergestellten Prüfschlüssel sind ungültig. Die öffentliche Originaldatei und den Lizenzspeicher mit dem Service prüfen; Dateien nicht unkontrolliert löschen.',
        STORAGE_IO_ERROR: 'Der Lizenzspeicher ist nicht lesbar oder beschreibbar. Freien Speicherplatz und Dienstzugriffsrechte prüfen lassen; vorhandene Lizenzdateien erhalten.',
        STORAGE_SIZE_INVALID: 'Eine gespeicherte Lizenzdatei hat eine unerwartete Größe. Vorhandene Dateien erhalten und den Service kontaktieren.',
        STORAGE_KEY_MISSING: 'Der lokale Entschlüsselungsschlüssel fehlt. Die zusammengehörige Lizenzsicherung wiederherstellen lassen; keinen neuen Schlüssel über bestehende Daten schreiben.',
        STORAGE_KEY_INVALID: 'Der lokale Entschlüsselungsschlüssel ist ungültig. Die zusammengehörige Sicherung und Dateirechte durch den Service prüfen lassen.',
        STORAGE_FORMAT_INVALID: 'Die gespeicherte Lizenzdatei ist beschädigt oder inkompatibel. Dateien erhalten und eine passende Sicherung mit dem Service prüfen.',
        STORAGE_AUTH_FAILED: 'Die gespeicherte Lizenz konnte nicht entschlüsselt oder bestätigt werden. Zusammengehörige Lizenz- und Schlüsselsicherung prüfen lassen; nichts löschen.',
        STORAGE_DATA_INVALID: 'Die gespeicherten Lizenzdaten sind ungültig. Dateien erhalten und den Service mit diesem Fehlercode kontaktieren.',
        STORAGE_CLOCK_ROLLBACK: 'Die gespeicherte Zeitprüfung erkennt eine zurückgestellte Uhr. Datum und Uhrzeit prüfen; Prüfdaten nicht löschen.',
    };
    /** @param {unknown} value @returns {value is Record<string,unknown>} */
    const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    /** @param {unknown} value @returns {string} */
    const safeCode = value => typeof value === 'string' && /^(?:LICENSE|STORAGE|TRUST|SERVICE)_[A-Z_]{1,70}$/.test(value) ? value : 'SERVICE_UNAVAILABLE';
    /** @param {string} code @returns {string} */
    const text = code => errors[code] || 'Die Anfrage konnte nicht bestätigt werden. Den Status erneut prüfen; bei Wiederholung den Service mit diesem Fehlercode kontaktieren.';
    /** @param {unknown} value @returns {value is number} */
    const count = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
    const MAX_BYTES = 32768;
    let busy = false;
    /** @type {TrustStatus|null} */
    let trust = null;

    /** @param {unknown} value @returns {LicenseStatus} */
    function licenseStatus(value) {
        if (!record(value) || value.v !== 1 || typeof value.valid !== 'boolean' || typeof value.code !== 'string' || safeCode(value.code) !== value.code ||
            typeof value.coreEnabled !== 'boolean' || !(value.tokenVersion === null || value.tokenVersion === 2 || value.tokenVersion === 3) || !(value.scope === null || value.scope === 'system' || value.scope === 'adapters') ||
            !(value.uuid === null || typeof value.uuid === 'string' && /^(?:[a-z]{2})?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.uuid)) ||
            !(value.edition === null || value.edition === 'home' || value.edition === 'pro') || !(value.expiresAt === null || count(value.expiresAt) && value.expiresAt > 0 && value.expiresAt <= 8640000000000000) ||
            !record(value.limits) || !Array.isArray(value.features) || value.features.length > 64 || !value.features.every(item => typeof item === 'string' && /^[A-Za-z][A-Za-z0-9]{0,79}$/.test(item)) ||
            value.valid && (value.code !== 'LICENSE_VALID' || !value.uuid || !value.edition || !(value.tokenVersion === 2 || value.tokenVersion === 3) || !value.scope || !count(value.limits.chargePoints) || !count(value.limits.batteries)) ||
            value.valid && (value.tokenVersion === 3 ? value.scope !== 'system' || !value.coreEnabled : value.tokenVersion !== 2 || value.scope !== 'adapters') ||
            !value.valid && (value.coreEnabled || value.tokenVersion !== null || value.scope !== null)) throw new Error('LICENSE_RESPONSE');
        return { valid: value.valid, code: value.code, uuid: value.uuid, edition: value.valid ? value.edition : null,
            coreEnabled: value.valid && value.coreEnabled, tokenVersion: value.valid ? value.tokenVersion : null, scope: value.valid ? value.scope : null,
            expiresAt: value.valid ? value.expiresAt : null, limits: value.valid ? { chargePoints: count(value.limits.chargePoints) ? value.limits.chargePoints : undefined, batteries: count(value.limits.batteries) ? value.limits.batteries : undefined } : {}, features: value.valid ? [...value.features] : [] };
    }
    /** @param {unknown} value @param {boolean} allowed @returns {KeyRow[]} */
    function keyList(value, allowed) {
        const sources = allowed ? ['release', 'os', 'release+os'] : ['os', 'restored', 'os+restored'];
        if (!Array.isArray(value) || value.length > (allowed ? 64 : 32)) throw new Error('LICENSE_RESPONSE');
        const ids = new Set();
        return value.map(key => {
            if (!record(key) || typeof key.kid !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(key.kid) || ids.has(key.kid) ||
                typeof key.fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(key.fingerprint) || (typeof key.source !== 'string' || !sources.includes(key.source))) throw new Error('LICENSE_RESPONSE');
            ids.add(key.kid);
            return { kid: key.kid, fingerprint: key.fingerprint, source: key.source };
        });
    }
    /** @param {unknown} value @returns {TrustStatus} */
    function trustStatus(value) {
        if (!record(value) || value.v !== 1 || typeof value.ready !== 'boolean' || typeof value.canImport !== 'boolean' || typeof value.code !== 'string' || safeCode(value.code) !== value.code ||
            (typeof value.source !== 'string' || !['os', 'restored', 'combined', 'none'].includes(value.source))) throw new Error('LICENSE_RESPONSE');
        const keys = keyList(value.keys, false);
        if (value.ready && (value.code !== 'TRUST_READY' || !keys.length || value.source === 'none') || !value.ready && (keys.length > 0 || value.code === 'TRUST_READY')) throw new Error('LICENSE_RESPONSE');
        return { ready: value.ready, code: value.code, canImport: value.canImport, source: value.source, keys, allowedKeys: keyList(value.allowedKeys, true) };
    }
    /** @param {unknown} value @returns {Record<string,string>} */
    function publicMap(value) {
        if (!record(value) || Object.keys(value).length < 1 || Object.keys(value).length > 32) throw new Error('TRUST_INVALID');
        /** @type {Record<string,string>} */
        const output = Object.create(null);
        for (const [kid, pem] of Object.entries(value)) {
            if (typeof pem === 'string' && /PRIVATE KEY|vault|ciphertext/i.test(pem) || /^(?:privateKey|vault|ciphertext|kdf|passphrase)$/i.test(kid)) throw new Error('TRUST_PRIVATE_KEY_REJECTED');
            if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(kid) || ['__proto__', 'constructor', 'prototype'].includes(kid) || typeof pem !== 'string' || pem.length > 1024 ||
                !/^-----BEGIN PUBLIC KEY-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END PUBLIC KEY-----\r?\n?$/.test(pem)) throw new Error('TRUST_INVALID');
            const encoded = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, '');
            let decoded;
            try { decoded = atob(encoded); } catch { throw new Error('TRUST_INVALID'); }
            const prefix = [0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00];
            if (decoded.length !== 44 || !prefix.every((byte, index) => decoded.charCodeAt(index) === byte) || btoa(decoded) !== encoded) throw new Error('TRUST_INVALID');
            output[kid] = pem;
        }
        if (new TextEncoder().encode(JSON.stringify(output)).length > MAX_BYTES) throw new Error('TRUST_FILE_TOO_LARGE');
        return output;
    }
    /** @param {File|undefined} file @returns {Promise<Record<string,string>>} */
    async function readPublicFile(file) {
        if (!file) throw new Error('TRUST_FILE_REQUIRED');
        if (!count(file.size) || file.size < 1) throw new Error('TRUST_INVALID');
        if (file.size > MAX_BYTES) throw new Error('TRUST_FILE_TOO_LARGE');
        const bytes = await file.arrayBuffer();
        if (bytes.byteLength !== file.size || bytes.byteLength > MAX_BYTES) throw new Error('TRUST_FILE_TOO_LARGE');
        let source;
        try { source = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new Error('TRUST_INVALID'); }
        if (/PRIVATE KEY|"(?:vault|privateKey|ciphertext|kdf|passphrase)"\s*:/i.test(source)) throw new Error('TRUST_PRIVATE_KEY_REJECTED');
        /** @type {unknown} */
        let parsed;
        try { parsed = JSON.parse(source); } catch { throw new Error('TRUST_INVALID'); }
        return publicMap(parsed);
    }
    /** @param {Response} response @returns {Promise<unknown>} */
    async function readJson(response) {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('LICENSE_RESPONSE');
        const chunks = [];
        let length = 0;
        try {
            while (true) {
                const chunk = await reader.read();
                if (chunk.done) break;
                length += chunk.value.byteLength;
                if (length > 65536) throw new Error('LICENSE_RESPONSE');
                chunks.push(chunk.value);
            }
            const bytes = new Uint8Array(length);
            let offset = 0;
            for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
            try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new Error('LICENSE_RESPONSE'); }
        } finally {
            await reader.cancel().catch(() => undefined);
            reader.releaseLock();
        }
    }
    /** @param {string} route @param {unknown} [body] @returns {Promise<unknown>} */
    async function request(route, body) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
            const response = await fetch(`/nexowatt/license/${route}`, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal,
                headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json', 'X-EOS-License': '1' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
            const data = await readJson(response);
            if (!response.ok) throw new Error(safeCode(record(data) && data.error));
            return data;
        } catch (cause) {
            if (controller.signal.aborted) throw new Error('SERVICE_TIMEOUT');
            throw cause;
        } finally { clearTimeout(timeout); }
    }
    /** @type {Record<string,string>} */
    const sources = { os: 'OS-Vertrauensdatei', restored: 'Lokal wiederhergestellte Kopie', 'os+restored': 'OS-Vertrauensdatei und lokale Kopie', release: 'Herstellerfreigabe', 'release+os': 'Herstellerfreigabe und OS-Vertrauensdatei', combined: 'OS-Vertrauensdatei und lokale Kopie', none: 'Keine aktive Vertrauensquelle' };
    /** @param {string} id @param {KeyRow[]} keys */
    function renderKeys(id, keys) {
        const container = $(id);
        container.replaceChildren();
        if (!keys.length) { container.textContent = 'Keine Schlüssel vorhanden.'; return; }
        for (const key of keys) {
            const row = document.createElement('div'); row.className = 'key';
            const kid = document.createElement('strong'); kid.textContent = key.kid;
            const fingerprint = document.createElement('code'); fingerprint.textContent = `SHA-256 (SPKI): ${key.fingerprint}`;
            const source = document.createElement('small'); source.textContent = sources[key.source];
            row.append(kid, fingerprint, source); container.append(row);
        }
    }
    /** @param {LicenseStatus} data */
    function showLicense(data) {
        $('status').textContent = text(data.code); $('statusCode').textContent = data.code;
        $('status').className = data.valid ? 'status' : 'status error';
        $('uuid').textContent = data.uuid || 'Nicht verfügbar';
        $('edition').textContent = data.edition === 'home' ? 'EOS Home' : data.edition === 'pro' ? 'EOS Pro' : '–';
        $('core').textContent = !data.valid ? '–' : data.coreEnabled ? 'Freigegeben' : 'Nicht enthalten – NWL2-Erweiterungslizenz';
        $('expiry').textContent = !data.valid ? '–' : data.expiresAt === null ? 'Dauerhaft' : new Date(data.expiresAt).toLocaleString('de-DE');
        $('limits').textContent = data.valid ? `${data.limits.chargePoints} / ${data.limits.batteries}` : '–';
        $('features').textContent = data.features.map(name => names[name] || name).join(', ') || '–';
        $('continue').hidden = !data.valid || !data.coreEnabled;
        $('activationError').hidden = data.valid;
        $('activationError').textContent = data.valid ? '' : `${text(data.code)}\n${data.code}`;
    }
    /** @param {TrustStatus} data */
    function showTrust(data) {
        trust = data;
        $('trustStatus').textContent = `${text(data.code)} ${sources[data.source]}.`;
        $('trustCode').textContent = data.code;
        renderKeys('trustKeys', data.keys); renderKeys('allowedKeys', data.allowedKeys);
    }
    function clearStatus() {
        trust = null;
        $('continue').hidden = true;
        $('status').textContent = 'Wird geprüft …'; $('status').className = 'status'; $('statusCode').textContent = '–';
        for (const id of ['uuid', 'edition', 'core', 'expiry', 'limits', 'features']) $(id).textContent = '–';
        $('trustStatus').textContent = 'Wird geprüft …'; $('trustCode').textContent = '–';
        $('trustKeys').replaceChildren(); $('allowedKeys').replaceChildren();
        $('message').textContent = ''; $('message').className = '';
        $('activationError').textContent = ''; $('activationError').hidden = true;
    }
    /** @param {string} id @param {boolean} disabled */
    function disable(id, disabled) {
        const element = $(id);
        if (!('disabled' in element) || typeof element.disabled !== 'boolean') throw new Error('LICENSE_PAGE');
        element.disabled = disabled;
    }
    function controls() {
        for (const id of ['refresh', 'activate', 'remove', 'recheckTrust', 'trustFile', 'token']) disable(id, busy);
        disable('importTrust', busy || !trust?.canImport || !trustFile.files?.length);
        disable('exportTrust', busy || !trust?.ready);
    }
    /** @returns {Promise<Result>} */
    async function refresh() {
        const [license, keys] = await Promise.all([request('status'), request('trust/status')]);
        return { license: licenseStatus(license), trust: trustStatus(keys) };
    }
    /** @param {unknown} data @returns {Result} */
    function combined(data) {
        if (!record(data)) throw new Error('LICENSE_RESPONSE');
        return { license: licenseStatus(data.licenseStatus), trust: trustStatus(data) };
    }
    /** @param {() => Promise<Result>} action @returns {Promise<void>} */
    async function run(action) {
        if (busy) return;
        busy = true; clearStatus(); controls();
        try {
            const result = await action();
            if (result.license.valid && !result.trust.ready) throw new Error(result.trust.code);
            showLicense(result.license); showTrust(result.trust);
            $('message').textContent = result.message || '';
        } catch (cause) {
            const code = safeCode(cause instanceof Error ? cause.message : 'SERVICE_UNAVAILABLE');
            $('status').textContent = 'Status derzeit nicht bestätigt.'; $('status').className = 'status error'; $('statusCode').textContent = code;
            $('trustStatus').textContent = 'Status derzeit nicht bestätigt.'; $('trustCode').textContent = code;
            $('message').textContent = `${text(code)}\n${code}`; $('message').className = 'error';
            $('activationError').textContent = `${text(code)}\n${code}`; $('activationError').hidden = false;
        } finally { busy = false; controls(); }
    }
    /** @param {string} selected */
    function selectTab(selected) {
        for (const name of ['license', 'trust']) {
            const active = name === selected;
            $(`${name}Tab`).setAttribute('aria-selected', String(active)); $(`${name}Tab`).tabIndex = active ? 0 : -1;
            $(`${name}Panel`).hidden = !active;
        }
    }
    for (const name of ['license', 'trust']) {
        $(`${name}Tab`).onclick = () => selectTab(name);
        $(`${name}Tab`).onkeydown = event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault(); const target = event.key === 'Home' ? 'license' : event.key === 'End' ? 'trust' : name === 'license' ? 'trust' : 'license';
            selectTab(target); $(`${target}Tab`).focus();
        };
    }
    $('trustFile').onchange = controls;
    $('refresh').onclick = () => run(refresh);
    $('activate').onclick = () => {
        const token = tokenInput.value.trim(); tokenInput.value = '';
        return run(async () => {
            if (!token || token.length > 16384) throw new Error('LICENSE_FORMAT');
            const license = licenseStatus(await request('activate', { token }));
            if (!license.valid) throw new Error('LICENSE_RESPONSE');
            const keys = trustStatus(await request('trust/status'));
            return { license, trust: keys, message: license.coreEnabled ? 'EOS-Lizenz geprüft und gespeichert. Sie können das Dashboard öffnen.' : 'Lizenz gespeichert. Diese NWL2-Lizenz umfasst ausschließlich Erweiterungen; für den EOS-Kern ist eine passende Freigabe erforderlich.' };
        });
    };
    $('remove').onclick = () => {
        if (!confirm('Lizenz entfernen? Angebundene Adapter verlieren ihre Betriebsfreigabe. Vorher den sicheren Anlagenzustand herstellen.')) return;
        return run(async () => {
            const license = licenseStatus(await request('remove', {}));
            if (license.valid) throw new Error('LICENSE_RESPONSE');
            return { license, trust: trustStatus(await request('trust/status')), message: 'Lizenz entfernt.' };
        });
    };
    $('importTrust').onclick = () => {
        const file = trustFile.files?.[0]; const allowed = trust?.canImport;
        trustFile.value = '';
        return run(async () => {
            if (!allowed) throw new Error('TRUST_IMPORT_DISABLED');
            const keys = await readPublicFile(file);
            return { ...combined(await request('trust/import', { keys })), message: 'Öffentliche Schlüssel geprüft und wiederhergestellt. Die bestehende Lizenz wurde erneut geprüft.' };
        });
    };
    $('recheckTrust').onclick = () => run(async () => combined(await request('trust/recheck', {})));
    $('exportTrust').onclick = () => run(async () => {
        const keys = publicMap(await request('trust/export'));
        const result = await refresh();
        const url = URL.createObjectURL(new Blob([`${JSON.stringify(keys, null, 2)}\n`], { type: 'application/json' }));
        try {
            const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'nexowatt-license-public-trust.json'; document.body.append(anchor); anchor.click(); anchor.remove();
        } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
        return { ...result, message: 'Öffentliche Schlüssel exportiert. Diese Datei enthält keinen privaten Signierschlüssel und ersetzt kein Tresor-Backup.' };
    });
    void run(refresh);
})();
