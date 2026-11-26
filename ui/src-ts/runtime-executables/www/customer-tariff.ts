/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Richtet den gemeinsamen Anlagentarif in den Kundeneinstellungen ein.
 * Daten und Wirkung: Schreibt ausschließlich geänderte Tarifparameter über die
 * dedizierte Kunden-API; niemals eine vollständige App-Center-Konfiguration.
 * auth.ts setzt Sitzung und CSRF. Der Server prüft Rechte, Lizenz, Preiszuordnung,
 * Revision und Quellen. Token werden nicht angezeigt oder lokal gespeichert.
 * Bei Änderungen: Quellwechsel, Pflichtfelder, Secret-Erhalt, Konflikte und
 * unveränderte Geräteeinstellungen prüfen. Kein automatischer Schreibretry.
 */
(() => {
    'use strict';
    type Data = Record<string, unknown>;
    interface Choice { id: string; name: string; countries: string[] }
    interface View { revision: string; config: Data; credentialsPresent: { accessToken: boolean; securityToken: boolean }; providers: Choice[]; profiles: Choice[]; status: Data; configuredExternally: boolean }
    const endpoint = '/api/customer/tariff-provider';
    const installerSelection = '__installer__';
    const supported = new Set(['manual-dp', 'tibber', 'energyzero', 'entsoe', 'market-profile']);
    const formulaFields = [
        ['marketMultiplier', 'customerTariffMultiplier', 1], ['supplierMarkupEurPerKwh', 'customerTariffMarkup', 0],
        ['gridVariableEurPerKwh', 'customerTariffGrid', 0], ['taxEurPerKwh', 'customerTariffTax', 0],
        ['otherVariableEurPerKwh', 'customerTariffOther', 0], ['vatPct', 'customerTariffVat', 0],
    ] as const;
    const isRecord = (value: unknown): value is Data => !!value && typeof value === 'object' && !Array.isArray(value);
    const ownValue = (value: Data, key: string): unknown => Object.hasOwn(value, key) ? Reflect.get(value, key) : undefined;
    const text = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
    function choices(value: unknown): Choice[] {
        if (!Array.isArray(value)) return [];
        return value.slice(0, 64).flatMap((item: unknown) => {
            if (!isRecord(item) || typeof item.id !== 'string' || item.id.length > 80 || typeof item.name !== 'string') return [];
            const countries = Array.isArray(item.countries) ? item.countries.filter((country: unknown): country is string => typeof country === 'string')
                : text(item.country, 'DE/NL').split('/');
            return [{ id: item.id, name: item.name.slice(0, 160), countries }];
        });
    }
    function decode(value: unknown): View {
        if (!isRecord(value) || value.ok !== true || value.scope !== 'system' || typeof value.revision !== 'string'
            || value.revision.length > 160 || !value.revision || !isRecord(value.config)) throw new Error('Die gespeicherte Tarifanbindung wurde nicht bestätigt. Bitte neu laden.');
        const flags = isRecord(value.credentialsPresent) ? value.credentialsPresent : {};
        return { revision: value.revision, config: value.config, credentialsPresent: { accessToken: flags.accessToken === true, securityToken: flags.securityToken === true },
            providers: choices(value.providers).filter(provider => supported.has(provider.id)), profiles: choices(value.profiles), status: isRecord(value.status) ? value.status : {}, configuredExternally: value.configuredExternally === true };
    }
    class ConfigurationLoading extends Error {
        constructor() { super('EOS lädt die gespeicherte Tarifanbindung noch. Bitte kurz warten und anschließend erneut laden.'); }
    }
    function retryDelay(signal: AbortSignal): Promise<void> {
        return new Promise((resolve, reject) => {
            const abort = (): void => { window.clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new Error('Laden abgebrochen')); };
            const timer = window.setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 2000);
            signal.addEventListener('abort', abort, { once: true });
            if (signal.aborted) abort();
        });
    }
    async function request(body?: Data, signal?: AbortSignal): Promise<View> {
        const options: RequestInit = { cache: 'no-store', credentials: 'same-origin', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) };
        if (body) { options.method = 'PUT'; options.headers = { 'Content-Type': 'application/json' }; options.body = JSON.stringify(body); }
        const response = await fetch(endpoint, options);
        if (response.status === 401) throw new Error('Sitzung abgelaufen. Bitte erneut bei EOS anmelden. Deine Eingaben bleiben im Formular.');
        if (response.status === 403) throw new Error('Tarifanbindung nicht freigegeben. Bitte Anmeldung und Systemfreigabe prüfen.');
        if (response.status === 409) throw new Error('Der Tarif wurde inzwischen geändert. Deine Eingaben bleiben erhalten. Gespeicherten Tarif laden und Änderungen abgleichen.');
        if (response.status === 503) {
            const failure: unknown = await response.json();
            if (!body && isRecord(failure) && failure.error === 'EOS_TARIFF_CONFIG_LOADING') throw new ConfigurationLoading();
            if (isRecord(failure) && failure.error === 'EOS_TARIFF_CONFIG_UNAVAILABLE') throw new Error('Die gespeicherte Tarifanbindung konnte beim Systemstart nicht geladen werden. Bitte den Systemstatus prüfen und erneut laden. Bestehende Einstellungen bleiben gespeichert.');
        }
        if (!response.ok) throw new Error('Die Tarifanbindung konnte nicht bestätigt werden. Anbieter, Pflichtfelder und Verbindung prüfen. Es wird nichts automatisch erneut gesendet.');
        return decode(await response.json() as unknown);
    }
    function initialize(): void {
        const panelNode = document.getElementById('customerTariffPanel');
        const formNode = document.getElementById('customerTariffForm');
        if (!(panelNode instanceof HTMLDetailsElement) || !(formNode instanceof HTMLFormElement)) return;
        const panel: HTMLDetailsElement = panelNode; const form: HTMLFormElement = formNode;
        const input = (id: string): HTMLInputElement => { const value = document.getElementById(id); if (!(value instanceof HTMLInputElement)) throw new Error('Tarif-Eingabefeld fehlt'); return value; };
        const select = (id: string): HTMLSelectElement => { const value = document.getElementById(id); if (!(value instanceof HTMLSelectElement)) throw new Error('Tarif-Auswahl fehlt'); return value; };
        const element = (id: string): HTMLElement => { const value = document.getElementById(id); if (!(value instanceof HTMLElement)) throw new Error('Tarif-Anzeige fehlt'); return value; };
        const fieldsetNode = document.getElementById('customerTariffFields');
        const saveNode = document.getElementById('customerTariffSave');
        const reloadNode = document.getElementById('customerTariffReload');
        if (!(fieldsetNode instanceof HTMLFieldSetElement) || !(saveNode instanceof HTMLButtonElement) || !(reloadNode instanceof HTMLButtonElement)) return;
        const fieldset: HTMLFieldSetElement = fieldsetNode; const save: HTMLButtonElement = saveNode; const reload: HTMLButtonElement = reloadNode;
        const country = select('customerTariffCountry'); const provider = select('customerTariffProvider');
        const source = select('customerTariffSource'); const profile = select('customerTariffProfile');
        const credential = input('customerTariffCredential'); const enabled = input('customerTariffEnabled');
        const use = input('customerTariffUse'); const home = input('customerTariffHome');
        const status = element('customerTariffStatus');
        let view: View | null = null; let baseline: Data = {}; let busy = false; let dirty = false;
        let loadController: AbortController | null = null;
        function show(message: string, error = false): void { status.textContent = message; status.dataset.error = String(error); }
        function setOptions(target: HTMLSelectElement, items: Choice[], selected: string, allowCurrent = false): void {
            target.replaceChildren();
            const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Bitte auswählen'; target.appendChild(placeholder);
            for (const item of items) { const option = document.createElement('option'); option.value = item.id; option.textContent = item.name; target.appendChild(option); }
            if (allowCurrent && selected && !items.some(item => item.id === selected)) {
                const option = document.createElement('option'); option.value = selected; option.textContent = supported.has(selected) ? 'Aktuelle Tarifquelle · im gewählten Land nicht verfügbar' : 'Vorhandener Tarif · vom Installateur eingerichtet'; target.appendChild(option);
            }
            target.value = items.some(item => item.id === selected) || allowCurrent ? selected : '';
        }
        function providerChoices(): void {
            if (!view) return;
            setOptions(provider, view.providers.filter(item => item.countries.includes(country.value)), provider.value || (view.configuredExternally ? installerSelection : text(view.config.providerId)), true);
            setOptions(profile, view.profiles.filter(item => item.countries.includes(country.value)), profile.value || text(view.config.providerProfileId));
            setOptions(source, view.providers.filter(item => ['entsoe', 'energyzero'].includes(item.id) && item.countries.includes(country.value)), source.value || text(view.config.sourceId));
        }
        function secretKey(): 'accessToken' | 'securityToken' | '' {
            if (provider.value === 'tibber') return 'accessToken';
            return provider.value === 'entsoe' || (provider.value === 'market-profile' && source.value === 'entsoe') ? 'securityToken' : '';
        }
        function mayKeepSecret(key: 'accessToken' | 'securityToken'): boolean {
            if (!view || view.configuredExternally) return false;
            const previousSource = view.config.providerId === 'market-profile' ? view.config.sourceId : view.config.providerId;
            const nextSource = provider.value === 'market-profile' ? source.value : provider.value;
            const present = key === 'accessToken' ? view.credentialsPresent.accessToken : view.credentialsPresent.securityToken;
            return provider.value === view.config.providerId && previousSource === nextSource && present;
        }
        function visibility(): void {
            const kind = provider.value; const external = !!kind && !supported.has(kind); const market = kind === 'market-profile';
            element('customerTariffProfileField').hidden = !market; element('customerTariffSourceField').hidden = !market;
            element('customerTariffHomeField').hidden = kind !== 'tibber';
            const hasFormula = market || kind === 'entsoe';
            element('customerTariffFormula').hidden = !hasFormula;
            for (const [, id] of formulaFields) input(id).disabled = !hasFormula;
            input('customerTariffIncludesVat').disabled = !hasFormula;
            enabled.disabled = external || kind === 'manual-dp'; use.disabled = external || kind === 'manual-dp';
            const key = secretKey(); element('customerTariffCredentialField').hidden = !key; credential.disabled = !key;
            element('customerTariffCredentialLabel').textContent = key === 'accessToken' ? 'Tibber Access Token' : 'ENTSO-E Security Token';
            element('customerTariffCredentialHint').textContent = key && mayKeepSecret(key)
                ? 'Zugangsschlüssel gespeichert. Leer lassen, um ihn zu behalten; für einen Austausch einen neuen eingeben.'
                : 'Für die neu gewählte Tarifquelle den passenden Zugangsschlüssel eingeben. Gespeicherte Schlüssel anderer Quellen werden nicht übernommen.';
            element('customerTariffProviderHint').textContent = external ? 'Diese Anbindung wurde vom Installateur eingerichtet und bleibt erhalten. Für einen Anbieterwechsel eine unterstützte Tarifquelle auswählen.'
                : market ? 'Anbieterprofile berechnen Preise aus einer Marktpreisquelle und deinen Vertragsbestandteilen. Sie sind keine direkte Anmeldung beim gewählten Stromanbieter.'
                : kind === 'manual-dp' ? 'Die vorhandenen, vom Installateur zugeordneten Preis-Datenpunkte bleiben erhalten.'
                : kind === 'entsoe' ? 'ENTSO-E liefert Börsenpreise. Ergänze die vereinbarten Preisbestandteile, um deinen Vertragspreis abzubilden.'
                : kind === 'energyzero' ? 'EnergyZero liefert eine öffentliche Preiszeitreihe für die Niederlande. Prüfe die Übereinstimmung mit deinem Stromvertrag.'
                : kind === 'tibber' ? 'Verbinde dein Tibber-Konto mit deinem persönlichen Token. Bei mehreren Haushalten die passende Home-ID eintragen.'
                : 'Wähle die Preisquelle für deinen Stromtarif.';
        }
        function values(): Data {
            const formula: Data = { priceIncludesVat: input('customerTariffIncludesVat').checked };
            for (const [key, id] of formulaFields) Reflect.set(formula, key, Number(input(id).value));
            return { enabled: enabled.checked, providerId: provider.value, sourceId: source.value, providerProfileId: profile.value,
                country: country.value, homeId: home.value.trim(), useForTariff: use.checked, formula };
        }
        function patch(): Data {
            const current = values(); const result: Data = {};
            for (const [key, value] of Object.entries(current)) {
                if (['sourceId', 'providerProfileId'].includes(key) && provider.value !== 'market-profile') continue;
                if (key === 'homeId' && provider.value !== 'tibber') continue;
                if (key === 'formula' && !['entsoe', 'market-profile'].includes(provider.value)) continue;
                if (key === 'formula') {
                    const delta: Data = {}; const oldFormula = isRecord(baseline.formula) ? baseline.formula : {};
                    for (const [field, next] of Object.entries(isRecord(value) ? value : {})) if (next !== ownValue(oldFormula, field)) Reflect.set(delta, field, next);
                    if (Object.keys(delta).length) result.formula = delta;
                } else if (value !== ownValue(baseline, key)) Reflect.set(result, key, value);
            }
            const key = secretKey();
            if (key && credential.value.trim()) result.credentials = key === 'accessToken'
                ? { accessToken: credential.value.trim() } : { securityToken: credential.value.trim() };
            return result;
        }
        function controls(): void { fieldset.disabled = busy || !view; save.disabled = busy || !view || !dirty; reload.disabled = busy; }
        function render(next: View): void {
            view = next; const config = next.config; const formula = isRecord(config.formula) ? config.formula : {};
            country.value = config.country === 'NL' ? 'NL' : 'DE'; provider.value = ''; profile.value = ''; source.value = '';
            providerChoices(); enabled.checked = config.enabled === true; use.checked = config.useForTariff === true; home.value = text(config.homeId);
            for (const [key, id, fallback] of formulaFields) {
                const value = ownValue(formula, key);
                input(id).value = String(typeof value === 'number' && Number.isFinite(value) ? value : fallback);
            }
            input('customerTariffIncludesVat').checked = formula.priceIncludesVat === true;
            credential.value = ''; visibility(); baseline = values(); dirty = false;
            const lastUpdate = typeof next.status.lastUpdate === 'number' ? next.status.lastUpdate : 0;
            const updated = lastUpdate > 0 && Number.isFinite(new Date(lastUpdate).getTime()) ? new Date(lastUpdate).toLocaleString('de-DE') : '';
            const state = next.status.state;
            element('customerTariffFetchStatus').textContent = state === 'ready' ? `Preisabruf erfolgreich${updated ? ` · zuletzt ${updated}` : ''}.`
                : state === 'error' ? 'Preisabruf derzeit nicht bestätigt. Zugang und Tarifquelle prüfen.'
                : state === 'pending' ? 'Preisabruf wird vorbereitet.' : state === 'disabled' || !enabled.checked ? 'Direkter Preisabruf ist ausgeschaltet.'
                : 'Preisabruf noch nicht bestätigt. Gespeicherte Tarifanbindung und aktueller Abrufstatus sind getrennte Ergebnisse.';
        }
        async function synchronize(saving: boolean): Promise<void> {
            if (busy || (saving && !view)) return;
            let body: Data | undefined;
            if (saving && view) {
                if (!form.reportValidity()) return;
                const kind = provider.value;
                if (!supported.has(kind) || !view.providers.some(item => item.id === kind && item.countries.includes(country.value))) { show('Bitte eine unterstützte Tarifquelle für das gewählte Land auswählen.', true); return; }
                if (kind === 'market-profile' && (!source.value || !profile.value)) { show('Bitte Anbieterprofil und Marktpreisquelle auswählen.', true); return; }
                const key = secretKey(); if (enabled.checked && key && !credential.value.trim() && !mayKeepSecret(key)) { show('Bitte den passenden Zugangsschlüssel für die gewählte Tarifquelle eintragen.', true); return; }
                const changes = patch(); if (!Object.keys(changes).length) { dirty = false; controls(); show('Keine Änderungen zu speichern.'); return; }
                body = { expectedRevision: view.revision, config: changes };
            }
            const controller = saving ? null : new AbortController();
            if (controller) loadController = controller;
            busy = true; controls(); show(saving ? 'Tarifanbindung wird gespeichert …' : 'Gespeicherte Tarifanbindung wird geladen …');
            try {
                for (let attempt = 0; attempt < 6; attempt++) {
                    try {
                        const next = await request(body, controller?.signal);
                        if (controller?.signal.aborted) return;
                        render(next); show(saving ? 'Tarifanbindung gespeichert. Der Preisabruf wird separat geprüft; Anlagenfreigaben bleiben unverändert.' : 'Gespeicherte Tarifanbindung geladen.');
                        break;
                    } catch (error: unknown) {
                        // Only the initial read waits for hydration. Never repeat a write
                        // or replace an existing view/draft with a delayed response.
                        if (!(error instanceof ConfigurationLoading) || !controller || controller.signal.aborted || view || dirty || !panel.open || attempt >= 5) throw error;
                        show('EOS startet. Die gespeicherte Tarifanbindung wird geladen …');
                        await retryDelay(controller.signal);
                    }
                }
            } catch (error: unknown) {
                if (!controller?.signal.aborted) show(error instanceof Error ? error.message : 'Tarifanbindung nicht verfügbar.', true);
            } finally {
                if (!controller || loadController === controller) { loadController = null; busy = false; controls(); }
            }
        }
        form.addEventListener('input', () => { if (view && !busy) { dirty = Object.keys(patch()).length > 0; controls(); show('Ungespeicherte Tarifänderungen.'); } });
        form.addEventListener('change', event => {
            if (event.target === provider || event.target === source) credential.value = '';
            if (event.target === provider && provider.value === 'manual-dp') { enabled.checked = false; use.checked = false; }
            if (event.target === country) { credential.value = ''; providerChoices(); }
            visibility(); if (view && !busy) { dirty = Object.keys(patch()).length > 0; controls(); show('Ungespeicherte Tarifänderungen.'); }
        });
        form.addEventListener('submit', event => { event.preventDefault(); void synchronize(true); });
        reload.addEventListener('click', () => { if (dirty && !window.confirm('Ungespeicherte Tarifänderungen verwerfen und gespeicherten Tarif laden?')) return; void synchronize(false); });
        function cancelRead(): void {
            if (!loadController) return;
            const controller = loadController; loadController = null; controller.abort(); busy = false; controls();
        }
        panel.addEventListener('toggle', () => {
            if (!panel.open) cancelRead();
            else if (!view && !busy) void synchronize(false);
        });
        window.addEventListener('pagehide', () => { cancelRead(); credential.value = ''; });
        if (panel.open) void synchronize(false);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true }); else initialize();
})();
