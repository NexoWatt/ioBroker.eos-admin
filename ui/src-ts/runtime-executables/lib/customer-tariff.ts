/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Begrenzt Kundeneinstellungen auf den gemeinsamen Anlagentarif.
 * Daten und Wirkung: Anbieter aus fester Liste, bekannte HTTPS-Endpunkte und
 * begrenzte Vertragswerte. Zugangsdaten werden nur angenommen, nie ausgegeben.
 * Ein Anbieterwechsel übernimmt keine fremden Provider-Zugangsdaten; bisherige
 * Werte bleiben ausschließlich im geschützten Konfigurationsstate erhalten.
 * Zusammenhang: Der Aufrufer prüft Sitzung, CSRF, Lizenz und AppCenter-Revision.
 * Bei Änderungen: Fremdfelder, URLs, alte Revisionen, geheime Daten und die
 * ausdrückliche Zustimmung zur Zuordnung der vier Tarif-Lesepunkte prüfen.
 */
import { createPublicHttpError } from './http-error-boundary';

type Dict = Record<string, unknown>;
const PROVIDERS = ['manual-dp', 'tibber', 'energyzero', 'entsoe', 'market-profile'] as const;
const ENDPOINTS: Readonly<Record<string, string>> = Object.freeze({
    tibber: 'https://api.tibber.com/v1-beta/gql',
    energyzero: 'https://public.api.energyzero.nl/public/v1/prices',
    entsoe: 'https://web-api.tp.entsoe.eu/api',
});
const PRICE_KEYS = ['priceCurrent', 'priceAverage', 'priceTodayJson', 'priceTomorrowJson'] as const;
const PRICE_SUFFIXES = new Map([['priceCurrent', 'currentPriceEurPerKwh'], ['priceAverage', 'averagePriceEurPerKwh'], ['priceTodayJson', 'pricesTodayJson'], ['priceTomorrowJson', 'pricesTomorrowJson']]);
const FORMULA_DEFAULTS: Dict = { marketMultiplier: 1, supplierMarkupEurPerKwh: 0, gridVariableEurPerKwh: 0, taxEurPerKwh: 0, otherVariableEurPerKwh: 0, vatPct: 0, priceIncludesVat: true };
const RESERVED_CREDENTIAL_INPUTS = new Set(['__KEEP__']);
const INSTALLER_SECRET_KEYS = ['accessToken', 'securityToken', 'clientSecret', 'bearerToken', 'apiKey', 'password', 'refreshToken'] as const;
const INSTALLER_PRIVATE_REQUEST_KEYS = ['headersJson', 'body'] as const;
const FIELDS = new Set(['enabled', 'providerId', 'sourceId', 'providerProfileId', 'country', 'homeId', 'priceComponent', 'formula', 'credentials', 'useForTariff']);
function rec(value: unknown): Dict { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Dict : {}; }
function copy(value: Dict): Dict { return JSON.parse(JSON.stringify(value)) as Dict; }
function invalid(message: string): never { throw createPublicHttpError(422, 'EOS_TARIFF_INVALID', message); }
function text(value: unknown, limit: number): string {
    if (typeof value !== 'string' || value.length > limit || /[\u0000-\u001f\u007f]/u.test(value)) invalid('Ein Tariftext oder Zugangswert ist ungültig.');
    return value.trim();
}
function own(value: Dict, key: string): boolean { return Object.hasOwn(value, key); }
function storedText(value: unknown, fallback: string): string { return typeof value === 'string' && value.length <= 256 ? value : fallback; }
function source(provider: Dict): string { return provider.providerId === 'market-profile' ? storedText(provider.sourceId, provider.country === 'NL' ? 'energyzero' : 'entsoe') : storedText(provider.providerId, 'manual-dp'); }
function knownEndpoint(provider: Dict): boolean { const expected = Reflect.get(ENDPOINTS, source(provider)); return typeof expected === 'string' && (!provider.endpoint || provider.endpoint === expected); }
function managedPoints(namespace: string): Dict {
    if (!/^(?:eos-admin|nexowatt-ui)\.\d+$/.test(namespace)) invalid('Der Tarifbereich ist nicht verfügbar.');
    return Object.fromEntries([...PRICE_SUFFIXES].map(([key, suffix]) => [key, `${namespace}.tariffProvider.${suffix}`]));
}
function formulaView(value: unknown): Dict {
    const candidate = rec(value);
    return Object.fromEntries(Object.entries(FORMULA_DEFAULTS).map(([key, fallback]) => {
        const raw = Reflect.get(candidate, key);
        return [key, typeof fallback === 'boolean' ? (typeof raw === 'boolean' ? raw : fallback) : (typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback)];
    }));
}
function useForTariff(root: Dict, namespace: string): boolean {
    const points = rec(root.datapoints); const expected = managedPoints(namespace);
    return PRICE_KEYS.every(key => Reflect.get(points, key) === Reflect.get(expected, key));
}

/** Credentials are bound to their recipient, not to a selected home or price formula. */
function installerCredentialScope(config: Dict): string | null {
    const provider = storedText(config.providerId, 'manual-dp').trim().toLowerCase();
    const resolved = provider === 'market-profile'
        ? storedText(config.sourceId, config.country === 'NL' ? 'energyzero' : 'entsoe').trim().toLowerCase() : provider;
    const credentials = rec(config.credentials); const custom = rec(config.customRest);
    const endpoint = (value: unknown, fallback = ''): string | null => {
        try {
            const url = new URL(typeof value === 'string' && value.trim() ? value.trim() : fallback);
            return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
        } catch { return null; }
    };
    const official: unknown = Reflect.get(ENDPOINTS, resolved);
    if (typeof official === 'string') {
        const target = endpoint(config.endpoint, official);
        return target ? JSON.stringify([provider, resolved, target]) : null;
    }
    if (resolved === 'custom-rest') {
        const target = endpoint(custom.url || config.pricesUrl);
        return target ? JSON.stringify([provider, resolved, target, custom.authMode || 'none',
            credentials.username || '', custom.apiKeyHeader || 'x-api-key']) : null;
    }
    if (resolved === 'ostrom') {
        const tokenTarget = endpoint(credentials.tokenUrl || config.tokenUrl);
        const priceTarget = endpoint(config.pricesUrl || custom.url);
        return tokenTarget && priceTarget
            ? JSON.stringify([provider, resolved, tokenTarget, priceTarget, credentials.clientId || '']) : null;
    }
    return null;
}

/** Installer masks preserve only same-source secrets. Empty input remains an explicit deletion. */
export function mergeInstallerTariffSecrets(incoming: unknown, existing: unknown): Dict {
    const next = copy(rec(incoming)); const previous = rec(existing);
    const credentials = copy(rec(next.credentials)); const previousCredentials = rec(previous.credentials);
    const clearedRequest = own(next, 'customRest') && (next.customRest === null || typeof next.customRest !== 'object' || Array.isArray(next.customRest));
    const effective = { ...previous, ...next, credentials: { ...previousCredentials, ...credentials },
        customRest: clearedRequest ? {} : { ...rec(previous.customRest), ...rec(next.customRest) } };
    const previousScope = installerCredentialScope(previous);
    const sameScope = previousScope !== null && previousScope === installerCredentialScope(effective);
    for (const key of INSTALLER_SECRET_KEYS) {
        const raw = Reflect.get(credentials, key);
        if (raw !== '__KEEP__' && raw !== undefined && raw !== null) continue;
        // A plain deletion would be undone by the enclosing Installer deep merge.
        Reflect.set(credentials, key, sameScope && Reflect.get(previousCredentials, key) !== undefined
            ? Reflect.get(previousCredentials, key) : '');
    }
    next.credentials = credentials;
    const custom = copy(rec(next.customRest)); const previousCustom = rec(previous.customRest);
    for (const key of INSTALLER_PRIVATE_REQUEST_KEYS) {
        const raw = Reflect.get(custom, key);
        if (raw !== '__KEEP__' && raw !== undefined && raw !== null) continue;
        if (!clearedRequest && sameScope && Reflect.get(previousCustom, key) !== undefined) Reflect.set(custom, key, Reflect.get(previousCustom, key));
        else if (Reflect.get(previousCustom, key) !== undefined || raw === '__KEEP__') Reflect.set(custom, key, '');
    }
    if (Object.keys(custom).length || own(next, 'customRest')) next.customRest = custom;
    return next;
}

/** Ausschließlich freigegebene Anzeige-Daten; keine internen URLs oder Geheimnisse. */
export function customerTariffView(root: Dict, namespace: string, registry: Dict, snapshot: unknown): Dict {
    const provider = rec(root.tariffProvider); const credentials = rec(provider.credentials);
    const providerId = storedText(provider.providerId, 'manual-dp'); const resolved = source(provider);
    const current = rec(snapshot);
    const matchesCurrent = current.providerId === providerId && current.sourceId === storedText(provider.sourceId, providerId);
    let state = 'unknown';
    if (provider.enabled !== true || providerId === 'manual-dp') state = 'disabled';
    else if (matchesCurrent) {
        state = current.fresh === true ? 'ready' : (current.status === 'error' || current.error ? 'error' : 'pending');
    }
    return {
        scope: 'system',
        config: { enabled: provider.enabled === true, providerId, sourceId: storedText(provider.sourceId, resolved),
            providerProfileId: storedText(provider.providerProfileId, 'local-provider'), country: provider.country === 'NL' ? 'NL' : 'DE',
            homeId: typeof provider.homeId === 'string' ? provider.homeId.slice(0, 128) : '',
            priceComponent: storedText(provider.priceComponent, resolved === 'energyzero' ? 'allInPriceIncludingVat' : 'total'),
            formula: formulaView(provider.formula), useForTariff: useForTariff(root, namespace) },
        credentialsPresent: { accessToken: resolved === 'tibber' && knownEndpoint(provider) && typeof credentials.accessToken === 'string' && credentials.accessToken.length > 0,
            securityToken: resolved === 'entsoe' && knownEndpoint(provider) && typeof credentials.securityToken === 'string' && credentials.securityToken.length > 0 },
        providers: (Array.isArray(registry.providers) ? registry.providers : [])
            .filter(row => PROVIDERS.includes(rec(row).id as typeof PROVIDERS[number]))
            .map(row => rec(row).id === 'market-profile' ? { ...rec(row), name: 'Anbieterprofil mit Marktpreisquelle', directApi: false,
                description: 'ENTSO-E oder EnergyZero mit Vertragsbestandteilen; kein direkter API-Zugang zum genannten Anbieter.' } : rec(row)),
        profiles: Array.isArray(registry.profiles) ? registry.profiles : [],
        configuredExternally: !PROVIDERS.includes(providerId as typeof PROVIDERS[number]) || (providerId !== 'manual-dp' && !knownEndpoint(provider)),
        status: { state, ...(matchesCurrent && typeof current.ts === 'number' && Number.isFinite(current.ts) ? { lastUpdate: current.ts } : {}) },
    };
}

/** Pure targeted patch: no app-enable flag, limits, arbitrary mappings, endpoint or script input. */
export function prepareCustomerTariffChange(root: Dict, incoming: unknown, namespace: string, registry: Dict): { tariffProvider: Dict; datapoints?: Dict } {
    if (incoming === null || typeof incoming !== 'object' || Array.isArray(incoming)) invalid('Die Tarifeinstellungen sind ungültig.');
    const submitted = rec(incoming);
    for (const key of Object.keys(submitted)) if (!FIELDS.has(key)) invalid('Die Anfrage enthält Einstellungen außerhalb des Kundentarifs.');
    const previous = rec(root.tariffProvider); const next = copy(previous);
    const providerId = own(submitted, 'providerId') ? text(submitted.providerId, 32) : storedText(previous.providerId, 'manual-dp');
    if (!PROVIDERS.includes(providerId as typeof PROVIDERS[number])) invalid('Dieser Anschluss wird vom Installateur verwaltet. Bitte einen angebotenen Anbieter wählen.');
    next.providerId = providerId;
    // Explicit customer saves request Tibber's actual quarter-hour data, independently
    // of a legacy hourly setting. Other provider contracts remain unchanged.
    if (providerId === 'tibber') next.resolutionMinutes = 15;
    if (own(submitted, 'enabled') && typeof submitted.enabled !== 'boolean') invalid('Die Tarifaktivierung ist ungültig.');
    next.enabled = own(submitted, 'enabled') ? submitted.enabled : previous.enabled === true;
    const country = own(submitted, 'country') ? text(submitted.country, 2) : previous.country === 'NL' ? 'NL' : 'DE';
    if (!['DE', 'NL'].includes(country)) invalid('Als Tarifland sind Deutschland und die Niederlande verfügbar.');
    next.country = country; next.timeZone = country === 'NL' ? 'Europe/Amsterdam' : 'Europe/Berlin';
    const requestedSource = own(submitted, 'sourceId') ? text(submitted.sourceId, 32) : (previous.providerId === 'market-profile' ? storedText(previous.sourceId, country === 'NL' ? 'energyzero' : 'entsoe') : (country === 'NL' ? 'energyzero' : 'entsoe'));
    if (providerId === 'market-profile' && !['entsoe', 'energyzero'].includes(requestedSource)) invalid('Für Anbieterprofile bitte ENTSO-E oder EnergyZero wählen.');
    if (providerId !== 'market-profile' && own(submitted, 'sourceId') && requestedSource !== providerId) invalid('Die Preisquelle passt nicht zum ausgewählten Anbieter.');
    next.sourceId = providerId === 'market-profile' ? requestedSource : providerId;
    const resolved = source(next);
    if (resolved === 'energyzero' && country !== 'NL') invalid('EnergyZero ist für das Tarifland Niederlande vorgesehen.');
    if (own(submitted, 'providerProfileId')) {
        const id = text(submitted.providerProfileId, 64);
        if (!(Array.isArray(registry.profiles) ? registry.profiles : []).some(row => rec(row).id === id)) invalid('Das Anbieterprofil ist unbekannt.');
        next.providerProfileId = id;
    } else if (!next.providerProfileId) next.providerProfileId = 'local-provider';
    if (own(submitted, 'homeId')) next.homeId = text(submitted.homeId, 128);
    if (own(submitted, 'priceComponent')) {
        const component = text(submitted.priceComponent, 40);
        if (!['total', 'allInPriceIncludingVat', 'basePriceIncludingVat', 'market'].includes(component)) invalid('Die Preiskomponente ist ungültig.');
        next.priceComponent = component;
    } else if (source(previous) !== resolved || !next.priceComponent) next.priceComponent = resolved === 'energyzero' ? 'allInPriceIncludingVat' : 'total';
    if (own(submitted, 'formula')) {
        if (submitted.formula === null || typeof submitted.formula !== 'object' || Array.isArray(submitted.formula)) invalid('Die Preisbestandteile sind ungültig.');
        const formula = { ...rec(previous.formula) };
        for (const [key, value] of Object.entries(rec(submitted.formula))) {
            if (!own(FORMULA_DEFAULTS, key)) invalid('Ein Preisbestandteil ist unbekannt.');
            if (key === 'priceIncludesVat') { if (typeof value !== 'boolean') invalid('Die Mehrwertsteuerangabe ist ungültig.'); }
            else if (typeof value !== 'number' || !Number.isFinite(value) || value < (key === 'marketMultiplier' || key === 'vatPct' ? 0 : -10) || value > (key === 'vatPct' ? 100 : 10)) invalid('Ein Preisbestandteil liegt außerhalb des zulässigen Bereichs.');
            Reflect.set(formula, key, value);
        }
        next.formula = formula;
    }
    const sameSource = previous.providerId === providerId && source(previous) === resolved && knownEndpoint(previous);
    const previousCredentials = rec(previous.credentials);
    const credentials: Dict = sameSource ? copy(previousCredentials) : {};
    if (!sameSource && Object.keys(previousCredentials).length) {
        // Retention only. These archived credentials are never consumed by a provider client.
        const retained = rec(previous.retainedProviderCredentials);
        const key = source(previous);
        const entries = Object.entries(retained).filter(([name]) => ['manual-dp', 'tibber', 'entsoe', 'energyzero', 'custom-rest', 'ostrom'].includes(name));
        next.retainedProviderCredentials = Object.fromEntries([...entries.filter(([name]) => name !== key), [key, { credentials: copy(previousCredentials), endpoint: typeof previous.endpoint === 'string' ? previous.endpoint : '', providerId: previous.providerId || 'manual-dp' }]].slice(-7));
    }
    if (own(submitted, 'credentials')) {
        if (submitted.credentials === null || typeof submitted.credentials !== 'object' || Array.isArray(submitted.credentials)) invalid('Die Zugangsdaten sind ungültig.');
        for (const [key, value] of Object.entries(rec(submitted.credentials))) {
            if ((key !== 'accessToken' || resolved !== 'tibber') && (key !== 'securityToken' || resolved !== 'entsoe')) invalid('Das Zugangsfeld passt nicht zum ausgewählten Anbieter.');
            const secret = text(value, 4096);
            if (RESERVED_CREDENTIAL_INPUTS.has(secret)) invalid('Bitte einen neuen Token eingeben oder das Feld leer lassen.');
            if (secret) Reflect.set(credentials, key, secret);
        }
    }
    if (next.enabled === true && ((resolved === 'tibber' && (typeof credentials.accessToken !== 'string' || !credentials.accessToken.trim())) || (resolved === 'entsoe' && (typeof credentials.securityToken !== 'string' || !credentials.securityToken.trim())))) invalid('Für diesen Anbieterwechsel bitte den passenden Zugangstoken eingeben.');
    next.credentials = credentials;
    if (resolved !== 'manual-dp') next.endpoint = Reflect.get(ENDPOINTS, resolved);
    if (resolved === 'entsoe') next.biddingZone = country === 'NL' ? '10YNL----------L' : '10Y1001A1001A82H';
    if (!sameSource && resolved !== 'manual-dp') next.unit = 'EUR/kWh';
    // Existing active tariff operation is retained, never implicitly activated by a new connection.
    next.activateTariffLogic = typeof previous.activateTariffLogic === 'boolean' ? previous.activateTariffLogic : previous.enabled === true;
    next.automaticMode = typeof previous.automaticMode === 'boolean' ? previous.automaticMode : previous.enabled === true;
    next.timeoutMs = 5000;
    let wantedMapping = own(submitted, 'useForTariff') ? submitted.useForTariff : useForTariff(root, namespace);
    if (typeof wantedMapping !== 'boolean') invalid('Die Zustimmung zur Tarifzuordnung ist ungültig.');
    if (resolved === 'manual-dp') wantedMapping = false;
    next.autoCoupleDatapoints = wantedMapping;
    const oldPoints = rec(root.datapoints); const expected = managedPoints(namespace);
    let datapoints: Dict | undefined;
    if (wantedMapping && resolved !== 'manual-dp') {
        if (!useForTariff(root, namespace)) next.customerPreviousPriceDatapoints = Object.fromEntries(PRICE_KEYS.map(key => [key, typeof Reflect.get(oldPoints, key) === 'string' ? Reflect.get(oldPoints, key) : null]));
        datapoints = { ...copy(oldPoints), ...expected };
    } else if ((own(submitted, 'useForTariff') || resolved === 'manual-dp') && !wantedMapping && useForTariff(root, namespace)) {
        const saved = rec(previous.customerPreviousPriceDatapoints);
        if (PRICE_KEYS.every(key => own(saved, key))) {
            datapoints = copy(oldPoints);
            for (const key of PRICE_KEYS) {
                const value = Reflect.get(saved, key);
                if (typeof value === 'string') Reflect.set(datapoints, key, value); else Reflect.deleteProperty(datapoints, key);
            }
        }
    }
    return { tariffProvider: next, ...(datapoints ? { datapoints } : {}) };
}
