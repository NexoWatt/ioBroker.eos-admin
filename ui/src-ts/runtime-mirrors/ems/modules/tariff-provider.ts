/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: ems/modules/tariff-provider.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * ems/modules/tariff-provider.js
 *
 * Zusammenhang:
 * Der Spiegel hilft uns, die JS-Datei später schrittweise zu typisieren, zu testen und
 * kontrolliert auf TypeScript umzustellen. Produktive Originalquellen liegen unter
 * src-ts/runtime-executables/ bzw. den im generierten JS genannten TS-Pfaden.
 * Dort ändern, Laufzeit erzeugen und danach die Spiegel synchronisieren.
 * Build-/Prüfskripte ohne TS-Original werden weiterhin unter scripts/ gepflegt.
 *
 * Wichtig für die Migration:
 * - Diese Datei enthält vorübergehend @ts-nocheck.
 * - Der nächste Schritt ist pro Modul echte Typisierung statt pauschalem No-Check.
 * - Fachliche Kommentare markieren die Abschnitte, die später einzeln migriert werden.
 *
 * Original-Hash: a6579574df66c72f2a3f72e881d11780ed5c1cb14136f9042e6bf2f3d076c849
 */

/**
 * Code-Teil: Runtime-Spiegel der kompletten Datei
 *
 * Zweck:
 * Dieser Abschnitt enthält den ursprünglichen JavaScript-Code als TypeScript-Parallelkopie.
 * Einzelne Funktionen werden später pro Modul weiter typisiert; Dateien ohne eigene
 * Funktionsdeklarationen bleiben trotzdem über diesen Dateikommentar dokumentiert.
 */

/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/ems/modules/tariff-provider.ts
 * Quell-Hash: sha256:92f133b4fe74d37e283e5bc6b6b683ebe528f29c6bc672f30413b9789d1e1e17
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für ems/modules/tariff-provider.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
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
const {
    fetchProvider,
    splitTodayTomorrow,
    currentAndAverage,
    publicRegistry,
} = require('../services/tariff-provider-registry');

/**
 * Code-Teil: TariffProviderModule
 *
 * Zweck:
 * Automatisch markierter Klasse-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
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
    }

    async init() {
        await this.adapter.setObjectNotExistsAsync('tariffProvider', {
            type: 'channel',
            common: { name: 'Dynamischer Tarifprovider' },
            native: {},
        });
/**
 * Code-Teil: mk
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
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

    async _set(id, val) {
        try { await this.adapter.setStateAsync(id, { val, ack: true }); } catch (_e) {}
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

    async _setTariffSettings(cfg) {
        if (!cfg.enabled || cfg.providerId === 'manual-dp' || !cfg.activateTariffLogic) return;
        const ns = String(this.adapter.namespace || `nexowatt-ui.${this.adapter.instance || 0}`);
        try {
            const dynId = `${ns}.settings.dynamicTariff`;
            const modeId = `${ns}.settings.tariffMode`;
            const dyn = await this.adapter.getForeignStateAsync(dynId).catch(() => null);
            if (!dyn || dyn.val !== true) await this.adapter.setForeignStateAsync(dynId, true, true);
            if (cfg.automaticMode) {
                const mode = await this.adapter.getForeignStateAsync(modeId).catch(() => null);
                if (!mode || Number(mode.val) !== 2) await this.adapter.setForeignStateAsync(modeId, 2, true);
            }
        } catch (e) {
            try { this.adapter.log.debug(`[TariffProvider] settings coupling skipped: ${String(e && e.message || e)}`); } catch (_e) {}
        }
    }

    async _publish(cfg, nowMs, statusOverride = '') {
        const split = splitTodayTomorrow(this._intervals, nowMs, cfg.timeZone);
        const ca = currentAndAverage(this._intervals, nowMs);
        const staleAge = this._lastSuccessMs ? nowMs - this._lastSuccessMs : Number.POSITIVE_INFINITY;
        const fresh = this._lastSuccessMs > 0 && staleAge <= cfg.maxStaleMinutes * 60 * 1000 && Number.isFinite(ca.current);
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

        await this._set('tariffProvider.enabled', cfg.enabled);
        await this._set('tariffProvider.providerId', cfg.providerId);
        await this._set('tariffProvider.sourceId', cfg.sourceId);
        await this._set('tariffProvider.status', status);
        await this._set('tariffProvider.quality', quality);
        if (publishPrices) {
            await this._set('tariffProvider.currentPriceEurPerKwh', current);
            await this._set('tariffProvider.averagePriceEurPerKwh', average);
        }
        if (fresh && publishPrices) {
            await this._set('tariffProvider.pricesTodayJson', JSON.stringify(split.today));
            await this._set('tariffProvider.pricesTomorrowJson', JSON.stringify(split.tomorrow));
            await this._set('tariffProvider.normalizedJson', JSON.stringify(this._intervals));
        } else if (!fresh && publishPrices) {
            // Explicitly clear the operational curves once their provider freshness
            // expires. The in-memory cache remains available for diagnostics, but no
            // new storage/EVCS tariff action may be started from it.
            await this._set('tariffProvider.pricesTodayJson', '[]');
            await this._set('tariffProvider.pricesTomorrowJson', '[]');
            await this._set('tariffProvider.normalizedJson', '[]');
        }
        this._lastCurrentKey = publishedKey;
        this._lastPublishedFresh = fresh;
        await this._set('tariffProvider.lastUpdate', nowMs);
        if (this._lastPublishedSuccessMs !== this._lastSuccessMs) {
            await this._set('tariffProvider.lastSuccess', this._lastSuccessMs || 0);
            this._lastPublishedSuccessMs = this._lastSuccessMs;
        }
        await this._set('tariffProvider.nextUpdate', this._nextFetchMs || 0);
        await this._set('tariffProvider.fresh', fresh);
        await this._set('tariffProvider.error', this._lastError || '');
        await this._set('tariffProvider.intervalCount', this._intervals.length);
        await this._set('tariffProvider.effectiveRefreshMinutes', this._effectiveRefreshMinutes || 0);
        await this._set('tariffProvider.consecutiveErrors', this._consecutiveErrors || 0);
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
        await this._set('tariffProvider.statusJson', JSON.stringify(snapshot));
        try { this.adapter._tariffProviderSnapshot = snapshot; } catch (_e) {}
    }

    /** Die Registry validiert alle Intervalle vor der Übernahme. Abruffehler
     * behalten den letzten gültigen Stand und dessen Erfolgszeit; _publish
     * setzt nach Ablauf der vorhandenen Frischegrenze die Preise auf null. */
    async _refresh(cfg, nowMs) {
        this._lastFetchMs = nowMs;
        try {
            const result = await fetchProvider(cfg);
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
            await this._publish(cfg, this._lastSuccessMs, 'ok');
        } catch (e) {
            const failedAt = Date.now();
            this._consecutiveErrors += 1;
            this._lastError = String(e && e.message || e || 'provider_error').slice(0, 500);
            this._scheduleNextFetch(cfg, failedAt, false);
            try { this.adapter.log.warn(`[TariffProvider] ${cfg.providerId}: ${this._lastError}`); } catch (_e) {}
            await this._publish(cfg, failedAt, this._intervals.length ? 'degraded' : 'error');
        }
    }

    async tick() {
        const cfg = this._cfg();
        const nowMs = Date.now();
        if (!cfg.enabled || cfg.providerId === 'manual-dp') {
            this._intervals = [];
            this._lastError = '';
            this._consecutiveErrors = 0;
            this._effectiveRefreshMinutes = 0;
            this._nextFetchMs = 0;
            await this._set('tariffProvider.enabled', cfg.enabled);
            await this._set('tariffProvider.providerId', cfg.providerId);
            await this._set('tariffProvider.sourceId', cfg.sourceId);
            await this._set('tariffProvider.status', cfg.enabled ? 'manual-datapoints' : 'disabled');
            await this._set('tariffProvider.fresh', false);
            await this._set('tariffProvider.currentPriceEurPerKwh', null);
            await this._set('tariffProvider.averagePriceEurPerKwh', null);
            await this._set('tariffProvider.pricesTodayJson', '[]');
            await this._set('tariffProvider.pricesTomorrowJson', '[]');
            await this._set('tariffProvider.normalizedJson', '[]');
            return;
        }

        await this._setTariffSettings(cfg);
        if (!this._fetchPromise && (!this._lastFetchMs || nowMs >= this._nextFetchMs || !this._intervals.length)) {
            this._fetchPromise = this._refresh(cfg, nowMs).finally(() => { this._fetchPromise = null; });
            await this._fetchPromise;
            return;
        }
        await this._publish(cfg, nowMs);
    }
}

module.exports = { TariffProviderModule, publicRegistry };
