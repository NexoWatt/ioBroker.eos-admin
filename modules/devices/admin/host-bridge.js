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
    const element = id => document.getElementById(id);
    function status(message, error = false) {
        element('eosModuleStatus').textContent = message;
        element('eosModuleStatus').dataset.error = String(error);
    }
    function changed() {
        if (ready && !busy) {
            element('eosModuleSave').disabled = false;
            status('Ungespeicherte Änderungen.');
        }
    }
    async function request(suffix = '', options = {}) {
        const response = await fetch(endpoint + suffix, {
            credentials: 'same-origin',
            signal: AbortSignal.timeout(15000),
            ...options,
            headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'x-nw-csrf': csrfToken } : {}), ...options.headers },
        });
        if (response.status === 401) throw new Error('Sitzung abgelaufen. Bitte erneut bei EOS anmelden.');
        if (response.status === 403) throw new Error('Diese Funktion benötigt eine angemeldete EOS-Administration. Seite neu laden und erneut versuchen.');
        const result = await response.json();
        if (!response.ok || result.error) throw new Error(String(result.error || `HTTP ${response.status}`));
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
        ready = true;
        element('eosModuleSave').disabled = false;
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
        catch (error) { status(error instanceof Error ? error.message : 'EOS_DEVICES_REQUEST_FAILED', true); }
        finally {
            busy = false;
            element('eosModuleReload').disabled = false;
            for (const id of ['eosModuleSave', 'eosModuleImport']) element(id).disabled = !ready;
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
