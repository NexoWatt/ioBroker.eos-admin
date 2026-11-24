/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Lädt Tarifdaten über die registrierten Anbieter und stellt sie der weiteren Tarifverarbeitung bereit.
 * Daten und Wirkung: Liest HTTPS-Tarife mit höchstens 5 s Gesamtabrufbudget. Erst vollständig validierte Intervalle aktualisieren Preis-States und Erfolgszeit. Bei Fehlern verbleibt der letzte gültige Stand bis zur konfigurierten Frischegrenze; danach werden Preise null und Kurven leer.
 * Bei Änderungen: Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.
 * Verknüpfungen: docs/quellcode/src-ts/runtime-executables/ems/modules/tariff-provider.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
/**
 * Executable TypeScript source: ems/modules/tariff-provider.js
 *
 * Direct dynamic-tariff provider integration. This module only reads provider APIs
 * and publishes normalized price states; all storage/EVCS decisions remain in tariff-vis.
 */
'use strict';

const { BaseModule } = require('./base');
const { createHash } = require('node:crypto');
const {
    fetchProvider,
    splitTodayTomorrow,
    currentAndAverage,
    publicRegistry,
} = require('../services/tariff-provider-registry');

// Only configuration changes hash the normalized configuration, including
// credentials. The digest is private and is never exposed as a diagnostic.
function stableConfiguration(value) {
    let nodes = 0;
    const visit = (item, depth) => {
        if (++nodes > 4096 || depth > 16) throw new Error('TARIFF_CONFIGURATION_INVALID');
        if (item === null || ['string', 'boolean', 'number'].includes(typeof item)) return item;
        if (Array.isArray(item)) return item.map(child => visit(child, depth + 1));
        if (!item || typeof item !== 'object') return undefined;
        const entries = [];
        for (const [key, child] of Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
            if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('TARIFF_CONFIGURATION_INVALID');
            entries.push([key, visit(child, depth + 1)]);
        }
        return Object.fromEntries(entries);
    };
    const serialized = JSON.stringify(visit(value, 0));
    if (serialized.length > 262144) throw new Error('TARIFF_CONFIGURATION_INVALID');
    return serialized;
}

const OPERATIONAL_PRICE_STATES = [
    ['tariffProvider.currentPriceEurPerKwh', null],
    ['tariffProvider.averagePriceEurPerKwh', null],
    ['tariffProvider.pricesTodayJson', '[]'],
    ['tariffProvider.pricesTomorrowJson', '[]'],
    ['tariffProvider.normalizedJson', '[]'],
];

class TariffProviderModule extends BaseModule {
    constructor(adapter, dpRegistry) {
        super(adapter, dpRegistry);
        this._intervals = [];
        this._lastFetchMs = 0;
        this._lastSuccessMs = 0;
        this._nextFetchMs = 0;
        this._lastCurrentKey = '';
        this._lastPublishedFresh = null;
        this._lastPublishedSuccessMs = null;
        this._fetchPromise = null;
        this._lastError = '';
        this._consecutiveErrors = 0;
        this._effectiveRefreshMinutes = 0;
        this._generation = 0;
        this._stopped = false;
        this._publicationTail = Promise.resolve();
        this._invalidationPending = false;
        this._mappingPromise = null;
        this._captureConfiguration();
        this._fencePriceReaders();
    }

    _fencePriceReaders() {
        this._priceReaderFence = { ids: new Set(OPERATIONAL_PRICE_STATES.map(([id]) => `${this.adapter.namespace}.${id}`)) };
        this.adapter._nwTariffInvalidation = this._priceReaderFence;
    }

    _captureConfiguration() {
        const serialized = stableConfiguration(this._cfg());
        const signature = createHash('sha256').update(serialized).digest('hex');
        this._configurationSource = this.adapter?.config?.tariffProvider;
        this._configurationCountry = this.adapter?.config?.countryProfile?.country;
        if (signature === this._configurationSignature) return false;
        this._configurationSignature = signature;
        this._configuration = JSON.parse(serialized);
        return true;
    }

    _isCurrent(generation) {
        return !this._stopped && !this.adapter?._nwShuttingDown && generation === this._generation;
    }

    /** Rebind only the tariff readers, including charging-management's direct
     * price keys. Unchanged mappings keep their transformations and caches. */
    async applyTariffMappings() {
        if (this._stopped || !this.dp) return;
        if (this._mappingPromise) await this._mappingPromise;
        const vis = this.adapter.emsEngine?.mm?.modules?.find(entry => entry.key === 'tarifVis')?.instance;
        const dps = this.adapter.config?.datapoints || {};
        const trim = value => typeof value === 'string' ? value.trim() : '';
        const current = vis?._getVisPriceCurrentId?.() || trim(dps.priceCurrent);
        const average = vis?._getVisPriceAverageId?.() || trim(dps.priceAverage);
        const today = vis?._getVisPriceTodayJsonId?.() || trim(dps.priceTodayJson);
        const tomorrow = vis?._getVisPriceTomorrowJsonId?.() || trim(dps.priceTomorrowJson);
        const mappings = [
            ['tarif.preisAktuellEurProKwh', current, 'number'], ['priceCurrent', current, 'number'],
            ['tarif.preisDurchschnittEurProKwh', average, 'number'], ['priceAverage', average, 'number'],
            ['tarif.pricesTodayJson', today, 'string'], ['tarif.pricesTomorrowJson', tomorrow, 'string'],
        ];
        const changed = [];
        // Drop all obsolete reader bindings synchronously before the first DB
        // await. A regulation tick can see missing readings, never old curves
        // combined with the first newly registered price.
        for (const [key, objectId, dataType] of mappings) {
            const previous = this.dp.getEntry(key);
            if (previous?.objectId === objectId) continue;
            if (previous) this.dp.remove(key);
            if (objectId) changed.push([key, objectId, dataType]);
        }
        const operation = (async () => {
            for (const [key, objectId, dataType] of changed) {
                if (this._stopped || this.adapter?._nwShuttingDown) return;
                // A canonical €/kWh source never inherits a cent/kWh converter.
                await this.dp.upsert({ key, objectId, dataType, direction: 'in',
                    ...(dataType === 'number' && objectId.startsWith(`${this.adapter.namespace}.tariffProvider.`)
                        ? { unit: '€/kWh', scale: 1, offset: 0, invert: false } : {}) });
            }
        })();
        this._mappingPromise = operation;
        try { await operation; }
        finally { if (this._mappingPromise === operation) this._mappingPromise = null; }
    }

    /** Called by the save/apply path, not a second scheduler or an EMS restart. */
    invalidateConfiguration() {
        if (this._stopped) return Promise.resolve(false);
        const changed = this._captureConfiguration();
        if (!changed && !this._invalidationPending) return Promise.resolve(false);
        this._invalidationPending = true;
        this._fencePriceReaders();
        const generation = ++this._generation;
        this._intervals = [];
        this._lastFetchMs = 0;
        this._lastSuccessMs = 0;
        this._nextFetchMs = 0;
        this._lastCurrentKey = '';
        this._lastPublishedFresh = null;
        this._lastPublishedSuccessMs = null;
        this._lastError = '';
        this._consecutiveErrors = 0;
        this._effectiveRefreshMinutes = 0;
        // Remove the old provider from the actual EMS cache immediately. This
        // also fences any outstanding registry prime read for those exact IDs.
        const now = Date.now();
        for (const [id, value] of OPERATIONAL_PRICE_STATES) {
            const fullId = `${this.adapter.namespace}.${id}`;
            this.dp?.handleStateChange?.(fullId, null);
            const key = this.adapter.keyFromId?.(fullId);
            if (key) this.adapter.updateValue?.(key, value, now);
        }
        const cfg = this._configuration;
        const status = !cfg.enabled ? 'disabled' : cfg.providerId === 'manual-dp' ? 'manual-datapoints' : 'configuration-changed';
        this.adapter._tariffProviderSnapshot = { ts: now, providerId: cfg.providerId, sourceId: cfg.sourceId,
            enabled: cfg.enabled, status, quality: 'missing', fresh: false,
            currentPriceEurPerKwh: null, averagePriceEurPerKwh: null, intervalCount: 0, lastSuccessMs: 0 };
        return this._publish(cfg, now, status, generation).then(() => {
            if (this._isCurrent(generation)) this._invalidationPending = false;
            return true;
        });
    }

    async init() {
        await this.adapter.setObjectNotExistsAsync('tariffProvider', {
            type: 'channel',
            common: { name: 'Dynamischer Tarifprovider' },
            native: {},
        });
        const mk = async (id, name, type, role, unit = '') => {
            const common = { name, type, role, read: true, write: false };
            if (unit) common.unit = unit;
            await this.adapter.setObjectNotExistsAsync(id, { type: 'state', common, native: {} });
        };
        await mk('tariffProvider.enabled', 'Tarifprovider aktiv', 'boolean', 'indicator');
        await mk('tariffProvider.providerId', 'Tarifprovider', 'string', 'text');
        await mk('tariffProvider.sourceId', 'Preisquelle', 'string', 'text');
        await mk('tariffProvider.status', 'Tarifprovider Status', 'string', 'text');
        await mk('tariffProvider.quality', 'Tarifdaten Qualität', 'string', 'text');
        await mk('tariffProvider.currentPriceEurPerKwh', 'Aktueller Preis', 'number', 'value', '€/kWh');
        await mk('tariffProvider.averagePriceEurPerKwh', 'Durchschnittspreis', 'number', 'value', '€/kWh');
        await mk('tariffProvider.pricesTodayJson', 'Preise heute JSON', 'string', 'json');
        await mk('tariffProvider.pricesTomorrowJson', 'Preise morgen JSON', 'string', 'json');
        await mk('tariffProvider.normalizedJson', 'Normalisierte Preiszeitreihe JSON', 'string', 'json');
        await mk('tariffProvider.lastUpdate', 'Letzte Aktualisierung', 'number', 'value.time');
        await mk('tariffProvider.lastSuccess', 'Letzter erfolgreicher Abruf', 'number', 'value.time');
        await mk('tariffProvider.nextUpdate', 'Nächster Abruf', 'number', 'value.time');
        await mk('tariffProvider.fresh', 'Tarifdaten frisch', 'boolean', 'indicator');
        await mk('tariffProvider.error', 'Tarifprovider Fehler', 'string', 'text');
        await mk('tariffProvider.intervalCount', 'Anzahl Preisintervalle', 'number', 'value');
        await mk('tariffProvider.effectiveRefreshMinutes', 'Effektives Abrufintervall', 'number', 'value', 'min');
        await mk('tariffProvider.consecutiveErrors', 'Aufeinanderfolgende Abruffehler', 'number', 'value');
        await mk('tariffProvider.statusJson', 'Tarifprovider Diagnose JSON', 'string', 'json');
    }

    _cfg() {
        const raw = this.adapter && this.adapter.config && this.adapter.config.tariffProvider;
        const cfg = raw && typeof raw === 'object' ? raw : {};
        return {
            enabled: cfg.enabled === true,
            providerId: String(cfg.providerId || 'manual-dp'),
            sourceId: String(cfg.sourceId || cfg.providerId || 'manual-dp'),
            activateTariffLogic: cfg.activateTariffLogic !== false,
            automaticMode: cfg.automaticMode !== false,
            autoCoupleDatapoints: cfg.autoCoupleDatapoints !== false,
            refreshMinutes: Math.max(5, Math.min(360, Math.round(Number(cfg.refreshMinutes) || 15))),
            maxStaleMinutes: Math.max(30, Math.min(4320, Math.round(Number(cfg.maxStaleMinutes) || 180))),
            resolutionMinutes: [15, 30, 60].includes(Number(cfg.resolutionMinutes)) ? Number(cfg.resolutionMinutes) : 15,
            country: String(cfg.country || this.adapter?.config?.countryProfile?.country || 'DE').toUpperCase() === 'NL' ? 'NL' : 'DE',
            timeZone: String(cfg.timeZone || (String(cfg.country || '').toUpperCase() === 'NL' ? 'Europe/Amsterdam' : 'Europe/Berlin')),
            ...cfg,
            // Nach ...cfg begrenzen: eine gespeicherte Alt-Konfiguration darf
            // die 5-s-Gesamtfrist einschließlich OAuth nicht überschreiben.
            timeoutMs: Math.max(1, Math.min(5000, Math.round(Number(cfg.timeoutMs) || 5000))),
        };
    }

    async _set(id, val, generation = this._generation) {
        if (!this._isCurrent(generation)) return;
        try { await this.adapter.setStateAsync(id, { val, ack: true }); }
        catch (_e) { throw new Error('TARIFF_STATE_WRITE_FAILED'); }
    }

    _providerSourceId(cfg) {
        const providerId = String(cfg && cfg.providerId || 'manual-dp');
        return providerId === 'market-profile'
            ? String(cfg && cfg.sourceId || (String(cfg && cfg.country || '').toUpperCase() === 'NL' ? 'energyzero' : 'entsoe'))
            : providerId;
    }

    _localHour(nowMs, timeZone) {
        try {
            return Number(new Intl.DateTimeFormat('en-GB', {
                timeZone: String(timeZone || 'Europe/Berlin'),
                hour: '2-digit',
                hourCycle: 'h23',
            }).format(new Date(nowMs)));
        } catch (_e) {
            return new Date(nowMs).getUTCHours();
        }
    }

    _stableJitterFactor(seed) {
        // Provider APIs should not be hit by every NexoWatt installation at the
        // same second. A deterministic +/-10 % jitter keeps tests reproducible
        // while distributing real installations over the polling window.
        let hash = 2166136261;
        const text = String(seed || 'nexowatt');
        for (let i = 0; i < text.length; i += 1) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return 0.9 + ((hash >>> 0) % 2001) / 10000;
    }

    _baseRefreshMinutes(cfg, nowMs) {
        const requested = Math.max(5, Math.min(360, Math.round(Number(cfg && cfg.refreshMinutes) || 15)));
        const provider = this._providerSourceId(cfg);
        if (provider === 'tibber') {
            const split = splitTodayTomorrow(this._intervals, nowMs, cfg && cfg.timeZone);
            const hour = this._localHour(nowMs, cfg && cfg.timeZone);
            // Tibber recommends caching today/tomorrow and avoiding frequent
            // price requests. Once tomorrow is available, four refreshes per day
            // are sufficient. During the expected publication window we retry
            // hourly until tomorrow prices are present.
            if (split.tomorrow.length) return Math.max(requested, 360);
            if (hour >= 12 && hour <= 20) return Math.max(requested, 60);
            return Math.max(requested, 180);
        }
        if (provider === 'ostrom') return Math.max(requested, 60);
        if (provider === 'energyzero' || provider === 'entsoe') return Math.max(requested, 30);
        return requested;
    }

    _scheduleNextFetch(cfg, nowMs, success) {
        const baseMinutes = this._baseRefreshMinutes(cfg, nowMs);
        const errorFactor = success ? 1 : Math.pow(2, Math.min(5, Math.max(1, this._consecutiveErrors)));
        const effectiveMinutes = Math.min(720, Math.max(5, baseMinutes * errorFactor));
        const provider = this._providerSourceId(cfg);
        const dayKey = Math.floor(Number(nowMs) / (24 * 60 * 60 * 1000));
        const jitter = this._stableJitterFactor(`${this.adapter && this.adapter.namespace || 'nexowatt-ui'}:${provider}:${dayKey}:${this._consecutiveErrors}`);
        this._effectiveRefreshMinutes = Math.round(effectiveMinutes * 100) / 100;
        this._nextFetchMs = Math.round(Number(nowMs) + effectiveMinutes * 60 * 1000 * jitter);
        return this._nextFetchMs;
    }

    async _setTariffSettings(cfg, generation = this._generation) {
        if (!this._isCurrent(generation) || !cfg.enabled || cfg.providerId === 'manual-dp' || !cfg.activateTariffLogic) return;
        const ns = String(this.adapter.namespace || `nexowatt-ui.${this.adapter.instance || 0}`);
        try {
            const dynId = `${ns}.settings.dynamicTariff`;
            const modeId = `${ns}.settings.tariffMode`;
            const dyn = await this.adapter.getForeignStateAsync(dynId).catch(() => null);
            if (!this._isCurrent(generation)) return;
            if (!dyn || dyn.val !== true) await this.adapter.setForeignStateAsync(dynId, true, true);
            if (!this._isCurrent(generation)) return;
            if (cfg.automaticMode) {
                const mode = await this.adapter.getForeignStateAsync(modeId).catch(() => null);
                if (!this._isCurrent(generation)) return;
                if (!mode || Number(mode.val) !== 2) await this.adapter.setForeignStateAsync(modeId, 2, true);
            }
        } catch (e) {
            try { this.adapter.log.debug(`[TariffProvider] settings coupling skipped: ${String(e && e.message || e)}`); } catch (_e) {}
        }
    }

    _publish(cfg, nowMs, statusOverride = '', generation = this._generation) {
        const pending = this._publicationTail.then(() => this._publishCurrent(cfg, nowMs, statusOverride, generation));
        this._publicationTail = pending.catch(() => {});
        return pending;
    }

    async _publishCurrent(cfg, nowMs, statusOverride, generation) {
        if (!this._isCurrent(generation)) return;
        const set = (id, val) => this._set(id, val, generation);
        const split = splitTodayTomorrow(this._intervals, nowMs, cfg.timeZone);
        const ca = currentAndAverage(this._intervals, nowMs);
        const staleAge = this._lastSuccessMs ? nowMs - this._lastSuccessMs : Number.POSITIVE_INFINITY;
        const fresh = cfg.enabled && cfg.providerId !== 'manual-dp' && this._lastSuccessMs > 0
            && staleAge <= cfg.maxStaleMinutes * 60 * 1000 && Number.isFinite(ca.current);
        const status = statusOverride || (fresh ? 'ok' : (this._intervals.length ? 'stale' : 'waiting'));
        const quality = this._intervals[0] ? String(this._intervals[0].quality || 'unknown') : 'missing';
        // Never refresh the tariff-control datapoints with stale provider data.
        // tariff-vis uses state timestamps as its safety/freshness contract; writing
        // old prices every EMS tick would incorrectly make an expired curve look new.
        const current = fresh && Number.isFinite(ca.current) ? ca.current : null;
        const average = fresh && Number.isFinite(ca.average) ? ca.average : null;
        const currentKey = this._intervals.find((row) => Date.parse(row.startsAt) <= nowMs && Date.parse(row.endsAt) > nowMs)?.startsAt || '';
        const publishedKey = fresh ? currentKey : '';
        // Statusmeldungen sind kein Datenabruf. Bei gleichem Intervall und gleicher
        // Gültigkeit bleiben auch die ioBroker-State-Zeitstempel unverändert.
        // Ein echter Erfolg, Intervallwechsel oder Ablauf benötigt neue Preisstates.
        const publishPrices = statusOverride === 'ok' || this._lastCurrentKey !== publishedKey || this._lastPublishedFresh !== fresh;

        // Operational prices/curves are cleared before the new provider label.
        // Consumers inspect numeric values and timestamps, not only fresh=false.
        if (!fresh && publishPrices) {
            await set('tariffProvider.fresh', false);
            for (const [id, value] of OPERATIONAL_PRICE_STATES) await set(id, value);
        }

        await set('tariffProvider.enabled', cfg.enabled);
        await set('tariffProvider.providerId', cfg.providerId);
        await set('tariffProvider.sourceId', cfg.sourceId);
        await set('tariffProvider.status', status);
        await set('tariffProvider.quality', quality);
        if (fresh && publishPrices) {
            await set('tariffProvider.currentPriceEurPerKwh', current);
            await set('tariffProvider.averagePriceEurPerKwh', average);
        }
        if (fresh && publishPrices) {
            await set('tariffProvider.pricesTodayJson', JSON.stringify(split.today));
            await set('tariffProvider.pricesTomorrowJson', JSON.stringify(split.tomorrow));
            await set('tariffProvider.normalizedJson', JSON.stringify(this._intervals));
        }
        if (!this._isCurrent(generation)) return;
        await set('tariffProvider.lastUpdate', nowMs);
        if (this._lastPublishedSuccessMs !== this._lastSuccessMs) {
            await set('tariffProvider.lastSuccess', this._lastSuccessMs || 0);
            if (!this._isCurrent(generation)) return;
        }
        await set('tariffProvider.nextUpdate', this._nextFetchMs || 0);
        await set('tariffProvider.fresh', fresh);
        await set('tariffProvider.error', this._lastError || '');
        await set('tariffProvider.intervalCount', this._intervals.length);
        await set('tariffProvider.effectiveRefreshMinutes', this._effectiveRefreshMinutes || 0);
        await set('tariffProvider.consecutiveErrors', this._consecutiveErrors || 0);
        const snapshot = {
            ts: nowMs,
            enabled: cfg.enabled,
            providerId: cfg.providerId,
            sourceId: cfg.sourceId,
            status,
            quality,
            fresh,
            currentPriceEurPerKwh: current,
            averagePriceEurPerKwh: average,
            intervalCount: this._intervals.length,
            todayCount: split.today.length,
            tomorrowCount: split.tomorrow.length,
            lastFetchMs: this._lastFetchMs,
            lastSuccessMs: this._lastSuccessMs,
            nextFetchMs: this._nextFetchMs,
            requestedRefreshMinutes: cfg.refreshMinutes,
            effectiveRefreshMinutes: this._effectiveRefreshMinutes || 0,
            consecutiveErrors: this._consecutiveErrors || 0,
            error: this._lastError || '',
        };
        await set('tariffProvider.statusJson', JSON.stringify(snapshot));
        if (!this._isCurrent(generation)) return;
        this._lastCurrentKey = publishedKey;
        this._lastPublishedFresh = fresh;
        this._lastPublishedSuccessMs = this._lastSuccessMs;
        if (this.adapter._nwTariffInvalidation === this._priceReaderFence) delete this.adapter._nwTariffInvalidation;
        try { this.adapter._tariffProviderSnapshot = snapshot; } catch (_e) {}
    }

    /** Die Registry validiert alle Intervalle vor der Übernahme. Abruffehler
     * behalten den letzten gültigen Stand und dessen Erfolgszeit; _publish
     * setzt nach Ablauf der vorhandenen Frischegrenze die Preise auf null. */
    async _refresh(cfg, nowMs, generation = this._generation) {
        if (!this._isCurrent(generation)) return;
        this._lastFetchMs = nowMs;
        try {
            const result = await fetchProvider(cfg);
            if (!this._isCurrent(generation)) return;
            const intervals = Array.isArray(result && result.intervals) ? result.intervals : [];
            if (!intervals.length) throw new Error('provider_returned_no_intervals');
            // Historische Parser bleiben für Diagnose verwendbar. Erst hier an
            // der State-Grenze muss die vollständige Antwort einen aktuell
            // nutzbaren Preis enthalten: weder nur Vergangenheit noch nur Zukunft.
            const acceptedAt = Date.now();
            if (!intervals.some(row => Date.parse(row.startsAt) <= acceptedAt && Date.parse(row.endsAt) > acceptedAt)) throw new Error('provider_prices_not_current');
            this._intervals = intervals;
            this._lastSuccessMs = acceptedAt;
            this._lastError = '';
            this._consecutiveErrors = 0;
            this._scheduleNextFetch(cfg, this._lastSuccessMs, true);
            await this._publish(cfg, this._lastSuccessMs, 'ok', generation);
        } catch (e) {
            if (!this._isCurrent(generation)) return;
            if (e && e.message === 'TARIFF_STATE_WRITE_FAILED') {
                this._invalidationPending = true;
                await this.invalidateConfiguration();
                return;
            }
            const failedAt = Date.now();
            this._consecutiveErrors += 1;
            this._lastError = String(e && e.message || e || 'provider_error').slice(0, 500);
            this._scheduleNextFetch(cfg, failedAt, false);
            try { this.adapter.log.warn(`[TariffProvider] ${cfg.providerId}: ${this._lastError}`); } catch (_e) {}
            await this._publish(cfg, failedAt, this._intervals.length ? 'degraded' : 'error', generation);
        }
    }

    async tick() {
        if (this._stopped || this.adapter?._nwShuttingDown) return;
        if (this._mappingPromise) await this._mappingPromise;
        // The common 1-s path compares references only; secrets are not hashed
        // on every regulation tick. Save/import explicitly invokes the hook.
        if (this._invalidationPending || this._configurationSource !== this.adapter?.config?.tariffProvider
            || this._configurationCountry !== this.adapter?.config?.countryProfile?.country) {
            await this.invalidateConfiguration();
        }
        const cfg = this._configuration;
        const generation = this._generation;
        if (!this._isCurrent(generation)) return;
        const nowMs = Date.now();
        if (!cfg.enabled || cfg.providerId === 'manual-dp') {
            this._intervals = [];
            this._lastError = '';
            this._consecutiveErrors = 0;
            this._effectiveRefreshMinutes = 0;
            this._nextFetchMs = 0;
            this._lastSuccessMs = 0;
            await this._publish(cfg, nowMs, cfg.enabled ? 'manual-datapoints' : 'disabled', generation);
            await this._publicationTail;
            return;
        }

        await this._setTariffSettings(cfg, generation);
        if (!this._isCurrent(generation)) return;
        if (!this._fetchPromise && (!this._lastFetchMs || nowMs >= this._nextFetchMs || !this._intervals.length)) {
            const operation = this._refresh(cfg, nowMs, generation).finally(() => {
                if (this._fetchPromise === operation) this._fetchPromise = null;
            });
            this._fetchPromise = operation;
            await this._fetchPromise;
            await this._publicationTail;
            return;
        }
        await this._publish(cfg, nowMs, '', generation);
        await this._publicationTail;
    }

    stop() {
        this._stopped = true;
        this._generation++;
        this._intervals = [];
        this._lastSuccessMs = 0;
    }
}

module.exports = { TariffProviderModule, publicRegistry };
