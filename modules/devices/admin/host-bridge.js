/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
/* exported translateAll */
'use strict';
var systemDictionary = {};

// Translate trusted local labels without HTML insertion or an ioBroker socket bridge.
function translateAll() {
    for (const element of document.querySelectorAll('.translate')) {
        const original = element.dataset.eosTranslation || element.textContent;
        element.dataset.eosTranslation = original;
        const translation = systemDictionary[original]?.de;
        if (translation) element.textContent = translation;
    }
}

(() => {
    const endpoint = '/api/eos/modules/devices';
    let csrfToken = '';
    let originalConfig = {};
    let ready = false;
    let busy = false;
    let manualImportAllowed = false;
    /** @type {Readonly<Record<string, string>>} */
    const importMessages = Object.freeze({
        EOS_MODULE_NOT_READY: 'Die gespeicherte Modulkonfiguration ist noch nicht freigegeben oder konnte nicht geladen werden. Bitte den Status der Bestandsübernahme und das ioBroker-Protokoll prüfen; nach einer Lizenzaktivierung kann ein kontrollierter EOS-Neustart nötig sein.',
        EOS_MODULE_IMPORT_REQUIRES_DISABLED: 'Für den manuellen Import muss das gespeicherte Gerätemodul deaktiviert sein. Haken bei „Gerätemodul aktivieren“ entfernen und „Speichern und übernehmen“ wählen. Für eine 1:1-Bestandsübernahme zuerst deren Status prüfen.',
        EOS_MODULE_IMPORT_ALREADY_MIGRATED: 'Die automatische Bestandsübernahme erhält bereits die ursprünglichen Datenpunkt-IDs. Ein erneuter manueller Import ist gesperrt. Bitte den Status der Bestandsübernahme prüfen.',
        EOS_MODULE_LEGACY_RUNNING: 'Der bisherige Geräteadapter läuft noch oder sein vollständiger Stopp ist nicht bestätigt. Für die 1:1-Übernahme bitte den Bestandsstatus prüfen; ein manueller Import benötigt eine bestätigte, deaktivierte alte Instanz.',
        EOS_MODULE_IMPORT_UNAVAILABLE: 'Die bisherige Instanz wurde nicht gefunden oder ist nicht deaktiviert. Instanzname und Bestandsstatus prüfen.',
        EOS_MODULE_STOP_UNCONFIRMED: 'Der Stopp des Gerätemoduls ist nicht bestätigt. Vor einer Übernahme bitte den Modulstatus und das ioBroker-Protokoll prüfen.',
        EOS_DEVICES_LEGACY_CONFIG_CONFLICT: 'Die bisherige Instanz enthält unterschiedliche Gerätelisten in devices und devicesJson. Es wurde nichts übernommen. Die ursprüngliche Konfiguration zuerst abgleichen; keine der beiden Listen ungeprüft überschreiben.',
        EOS_MODULE_BUSY: 'Eine Konfigurationsänderung oder ein Stopp läuft bereits. Bitte den Abschluss abwarten und danach neu laden.',
    });
    /** @param {string} code @returns {string} */
    function messageFor(code) {
        return Object.hasOwn(importMessages, code) ? importMessages[code] : code;
    }
    /** @param {{manualImport?: {reason?: string, allowed?: boolean}, migration?: {preserveNamespace?: boolean}, status?: {reason?: string, active?: boolean}, config?: {enabled?: boolean}}} result */
    function importAvailability(result) {
        const reason = result.manualImport?.reason || (result.migration?.preserveNamespace === true
            ? 'EOS_MODULE_IMPORT_ALREADY_MIGRATED'
            : result.status?.reason === 'STOP_FAILED_RESTART_REQUIRED' ? 'EOS_MODULE_STOP_UNCONFIRMED'
                : result.config?.enabled === true || result.status?.active === true ? 'EOS_MODULE_IMPORT_REQUIRES_DISABLED' : '');
        manualImportAllowed = !reason && result.manualImport?.allowed !== false;
        element('eosModuleImport').disabled = busy || !ready || !manualImportAllowed;
        element('eosImportHint').textContent = reason ? messageFor(reason)
            : 'Manueller Konfigurationsimport bereit. Die alte Instanz muss vollständig gestoppt sein. Das Ergebnis bleibt deaktiviert und verwendet neue Datenpunkt-Pfade; für eine 1:1-Übernahme den Bestandsstatus verwenden.';
    }
    const element = id => document.getElementById(id);
    function status(message, error = false, reauthenticate = false) {
        element('eosModuleStatus').textContent = message;
        element('eosModuleStatus').dataset.error = String(error);
        if (reauthenticate) {
            const link = document.createElement('a');
            link.href = '/login.html';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = ' EOS-Anmeldung öffnen';
            element('eosModuleStatus').append(link);
        }
    }
    function changed() {
        if (ready && !busy) {
            element('eosModuleSave').disabled = false;
            status('Ungespeicherte Änderungen.');
        }
    }
    async function request(suffix = '', options = {}) {
        // A login in another tab can legitimately rotate the HttpOnly session
        // cookie. Obtain its current CSRF proof without replacing edited rows.
        // Never repeat a mutation after an ambiguous response or authentication error.
        if (options.method && !['GET', 'HEAD'].includes(options.method)) {
            const session = await request();
            if (typeof session.csrfToken !== 'string' || !session.csrfToken) throw new Error('EOS_DEVICES_INVALID_RESPONSE');
            csrfToken = session.csrfToken;
        }
        const response = await fetch(endpoint + suffix, {
            credentials: 'same-origin',
            signal: AbortSignal.timeout(15000),
            ...options,
            headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'x-nw-csrf': csrfToken } : {}), ...options.headers },
        });
        if (response.status === 401) throw Object.assign(new Error('Sitzung abgelaufen. Die Änderungen bleiben im Formular. Bitte EOS in einem neuen Tab anmelden und danach erneut speichern.'), { reauthenticate: true });
        if (response.status === 403) throw new Error('Diese Funktion benötigt eine angemeldete EOS-Administration. Seite neu laden und erneut versuchen.');
        const result = await response.json();
        if (!response.ok || result.error) throw new Error(messageFor(String(result.error || `HTTP ${response.status}`)));
        return result;
    }
    async function reload() {
        const result = await request();
        if (!result.config || typeof result.csrfToken !== 'string') throw new Error('EOS_DEVICES_INVALID_RESPONSE');
        csrfToken = result.csrfToken;
        originalConfig = result.config;
        element('eosModuleEnabled').checked = result.config.enabled === true;
        ready = false;
        await load(result.config, value => { if (value) changed(); });
        ready = result.configurationReady !== false;
        importAvailability(result);
        element('eosModuleSave').disabled = !ready;
        const moduleState = result.status?.active === true
            ? (result.status?.details?.state || 'running')
            : (result.status?.reason && result.status.reason !== 'RUNNING' ? result.status.reason : 'nicht aktiv');
        status(`Gerätemodul: ${moduleState}. Gerätevorlagen werden lokal geladen.`);
    }
    async function action(callback) {
        if (busy) return;
        busy = true;
        for (const id of ['eosModuleSave', 'eosModuleReload', 'eosModuleImport']) element(id).disabled = true;
        try { await callback(); }
        catch (error) { status(error instanceof Error ? error.message : 'EOS_DEVICES_REQUEST_FAILED', true, error?.reauthenticate === true); }
        finally {
            busy = false;
            element('eosModuleReload').disabled = false;
            element('eosModuleSave').disabled = !ready;
            element('eosModuleImport').disabled = !ready || !manualImportAllowed;
        }
    }
    window.sendTo = (_instance, command, payload, callback) => {
        request('/command', { method: 'POST', body: JSON.stringify({ command, payload }) })
            .then(
                result => callback(Array.isArray(result) ? result : result.result ?? result.data ?? []),
                () => callback([]),
            )
            .catch(() => status('Gerätemetadaten konnten nicht verarbeitet werden.', true));
    };
    document.addEventListener('DOMContentLoaded', () => {
        element('eosModuleEnabled').addEventListener('change', changed);
        element('eosModuleReload').addEventListener('click', () => void action(reload));
        element('eosModuleSave').addEventListener('click', () => void action(async () => {
            const edited = await new Promise(resolve => save(resolve));
            const config = { ...originalConfig, ...edited, enabled: element('eosModuleEnabled').checked };
            delete config.devicesJson;
            status('Konfiguration wird sicher gespeichert und übernommen …');
            await request('', { method: 'PUT', body: JSON.stringify({ config }) });
            await reload();
        }));
        element('eosModuleImport').addEventListener('click', () => void action(async () => {
            if (!manualImportAllowed) throw new Error(element('eosImportHint').textContent || 'Manueller Import ist noch nicht verfügbar.');
            const legacy = element('eosLegacyInstance').value.trim();
            if (!/^nexowatt-devices\.\d+$/.test(legacy)) throw new Error('Bitte eine Instanz wie nexowatt-devices.0 angeben.');
            const result = await request('/import', { method: 'POST', body: JSON.stringify({ instance: legacy }) });
            element('eosImportMapping').textContent = JSON.stringify(result.migration || result.mapping || result.mappings || result, null, 2);
            await reload();
            status('Konfiguration deaktiviert übernommen. Datenpunkt-Pfade und EMS-Zuordnung vor der Aktivierung prüfen.');
        }));
        void action(reload);
    });
})();
