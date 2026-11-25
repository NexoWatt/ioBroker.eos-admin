/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/ems/services/tariff-provider-registry.ts
 * Quell-Hash: sha256:ec084b73b68e40694711b32e56424a073f187912959dfca649d0962bebb19f5f
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für ems/services/tariff-provider-registry.js.
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
 * Aufgabe: Registriert unterstützte Tarifquellen und deren Aufruf-/Normalisierungsschnittstellen.
 * Daten und Wirkung: Optional konfigurierte Provider liefern EUR/kWh-Zeitreihen; Tarifregelung behält ihre vorhandene Frische-/Ausfallbehandlung. HTTPS-Gesamtabrufe einschließlich OAuth, DNS und Antwortkörper sind auf höchstens 5 s, 64 KiB Request und 2 MiB dekodierte Antwort begrenzt. Keine Redirects. Ein Lebenszyklus-Abbruch beendet den aktiven Transport und entfernt den Abbruchlistener. Eine fehlerhafte Preiszeile verwirft die gesamte Antwort vor der Übergabe an ioBroker.
 * Bei Änderungen: Einheiten, Vorzeichen, Frische und Aufrufer mitprüfen; Netzwerkvertrag mit scripts/verify-cra-tariff.cjs testen. Anbieter-Fehlertexte nicht protokollieren; keine Zugangsdaten in Fehlermeldungen übernehmen. docs:build nach fachlichen Änderungen aktualisieren.
 * Verknüpfungen: docs/quellcode/src-ts/runtime-executables/ems/services/tariff-provider-registry.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
/**
 * Executable TypeScript source: ems/services/tariff-provider-registry.js
 *
 * Central provider registry + normalizers for direct dynamic-tariff integrations.
 * All providers are normalized to EUR/kWh intervals before tariff-vis consumes them.
 */
'use strict';

const { performance } = require('node:perf_hooks');

const DEFAULT_USER_AGENT = 'NexoWatt-EOS/0.8.201 (+https://www.nexowatt.com)';

const BIDDING_ZONES = Object.freeze({
    DE: '10Y1001A1001A82H', // DE-LU
    NL: '10YNL----------L',
});

const PROVIDERS = Object.freeze([
    {
        id: 'manual-dp',
        name: 'Bestehende Datenpunkte / manuell',
        countries: ['DE', 'NL'],
        sourceType: 'datapoints',
        directApi: false,
        requires: [],
        description: 'Verwendet die vier frei zugeordneten Preis-Datenpunkte.',
    },
    {
        id: 'tibber',
        name: 'Tibber API',
        countries: ['DE', 'NL'],
        sourceType: 'graphql',
        directApi: true,
        requires: ['accessToken'],
        supportsResolution: [15],
        description: 'Direkte GraphQL-Integration; persönlicher Token oder registrierter OAuth-Client.',
    },
    {
        id: 'energyzero',
        name: 'EnergyZero Marktpreise',
        countries: ['NL'],
        sourceType: 'rest-public',
        directApi: true,
        requires: [],
        supportsResolution: [15, 60],
        description: 'Öffentliche Preiszeitreihe mit wählbarer Preis-Komponente.',
    },
    {
        id: 'entsoe',
        name: 'ENTSO-E Day-Ahead',
        countries: ['DE', 'NL'],
        sourceType: 'xml',
        directApi: true,
        requires: ['securityToken'],
        supportsResolution: [15, 30, 60],
        description: 'Börsenpreisquelle; Endkunden-Aufschläge werden im Tarifprofil ergänzt.',
    },
    {
        id: 'ostrom',
        name: 'Ostrom API / Partnerzugang',
        countries: ['DE'],
        sourceType: 'oauth-json',
        directApi: true,
        requires: ['clientId', 'clientSecret', 'tokenUrl', 'pricesUrl'],
        supportsResolution: [60],
        configurationRequired: true,
        description: 'OAuth2-/JSON-Profil für Kunden- oder Partnerzugang; Endpunkte werden nach Vertrag konfiguriert.',
    },
    {
        id: 'custom-rest',
        name: 'Allgemeine REST/JSON-API',
        countries: ['DE', 'NL'],
        sourceType: 'rest-custom',
        directApi: true,
        requires: ['url'],
        supportsResolution: [15, 30, 60],
        description: 'Universelle API für Stadtwerke und örtliche Energieversorger.',
    },
    {
        id: 'market-profile',
        name: 'Anbieterprofil über ENTSO-E/Custom REST',
        countries: ['DE', 'NL'],
        sourceType: 'profile',
        directApi: true,
        requires: [],
        supportsResolution: [15, 30, 60],
        description: 'Anbieterprofil mit allgemeiner Marktpreisquelle und vertraglichen Preisbestandteilen.',
    },
]);

const PROVIDER_PROFILES = Object.freeze([
    { id: 'local-provider', name: 'Lokaler Energieversorger / Stadtwerk', country: 'DE/NL', preferredSource: 'entsoe' },
    { id: 'rabot', name: 'Rabot Energy', country: 'DE', preferredSource: 'entsoe' },
    { id: 'enbw-dynamic', name: 'EnBW Strom dynamisch', country: 'DE', preferredSource: 'entsoe' },
    { id: 'lichtblick-dynamic', name: 'LichtBlick ÖkoStrom Dynamic', country: 'DE', preferredSource: 'entsoe' },
    { id: 'elli-flex', name: 'Elli / Volkswagen Naturstrom Flex', country: 'DE', preferredSource: 'entsoe' },
    { id: 'zonneplan', name: 'Zonneplan', country: 'NL', preferredSource: 'energyzero' },
    { id: 'nextenergy', name: 'NextEnergy', country: 'NL', preferredSource: 'energyzero' },
    { id: 'frankenergie', name: 'Frank Energie', country: 'NL', preferredSource: 'energyzero' },
    { id: 'anwb', name: 'ANWB Energie', country: 'NL', preferredSource: 'energyzero' },
]);

function clampNumber(value, fallback, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, num));
}

function parseJsonMaybe(raw) {
    if (raw === null || raw === undefined) return raw;
    if (typeof raw !== 'string') return raw;
    const text = raw.trim();
    if (!text) return null;
    try { return JSON.parse(text); } catch (_e) { return raw; }
}

function getByPath(root, pathSpec) {
    if (!pathSpec) return root;
    const normalized = String(pathSpec)
        .trim()
        .replace(/^\$\.?/, '')
        .replace(/\[(\d+)\]/g, '.$1');
    if (!normalized) return root;
    return normalized.split('.').filter(Boolean).reduce((cur, key) => {
        if (cur === null || cur === undefined) return undefined;
        if (typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, key) || ['__proto__', 'constructor', 'prototype'].includes(key)) return undefined;
        return cur[key];
    }, root);
}

function num(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    let text = String(value).trim().replace(/\s+/g, '');
    if (!text) return fallback;
    if (text.includes(',') && text.includes('.')) {
        const lc = text.lastIndexOf(',');
        const ld = text.lastIndexOf('.');
        if (lc > ld) text = text.replace(/\./g, '').replace(',', '.');
        else text = text.replace(/,/g, '');
    } else if (text.includes(',')) {
        text = text.replace(',', '.');
    }
    const n = Number(text);
    return Number.isFinite(n) ? n : fallback;
}

/** Provider-Zeitstempel: ISO-8601 mit expliziter Zeitzone oder endliche positive
 * Epoch-Zahl in Sekunden/Millisekunden. Objekte, Booleans und lokale Datumsstrings
 * werden nicht stillschweigend als Zeitpunkt interpretiert. */
function toIso(value) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        const ms = value < 1e12 ? value * 1000 : value;
        const d = new Date(ms);
        return Number.isFinite(d.getTime()) ? d.toISOString() : '';
    }
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return '';
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(5, 7));
    const day = Number(value.slice(8, 10));
    if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return '';
    if (Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || (value[16] === ':' && Number(value.slice(17, 19)) > 59)) return '';
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function priceToEurKwh(value, unit = 'EUR/kWh') {
    const n = num(value, null);
    if (!Number.isFinite(n)) return null;
    const u = String(unit || 'EUR/kWh').trim().toLowerCase().replace(/\s+/g, '');
    if (u === 'eur/mwh' || u === '€/mwh') return n / 1000;
    if (u === 'ct/kwh' || u === 'cent/kwh' || u === 'cents/kwh') return n / 100;
    if (u === 'eur/wh' || u === '€/wh') return n * 1000;
    return n;
}

function applyFormula(marketEurKwh, formula = {}) {
    const market = Number.isFinite(Number(marketEurKwh)) ? Number(marketEurKwh) : 0;
    const multiplier = clampNumber(formula.marketMultiplier, 1, -100, 100);
    const supplier = num(formula.supplierMarkupEurPerKwh, 0) || 0;
    const grid = num(formula.gridVariableEurPerKwh, 0) || 0;
    const taxes = num(formula.taxEurPerKwh, 0) || 0;
    const other = num(formula.otherVariableEurPerKwh, 0) || 0;
    const vatPct = clampNumber(formula.vatPct, 0, 0, 100);
    const beforeVat = market * multiplier + supplier + grid + taxes + other;
    const total = formula.priceIncludesVat === true ? beforeVat : beforeVat * (1 + vatPct / 100);
    return {
        total,
        market,
        supplierMarkup: supplier,
        gridVariable: grid,
        tax: taxes + other,
        vatPct,
    };
}

// Der sehr breite Bereich lässt negative Marktpreise zu, verhindert jedoch
// offensichtlich falsche Einheiten/Überläufe vor preisabhängigen EMS-Entscheidungen.
const MAX_ABSOLUTE_PRICE_EUR_KWH = 100;
const MAX_PRICE_INTERVALS = 4096;

/** Eine Provider-Zeile wird nur mit vollständigem Start/Preis und korrekten
 * JSON-Typen übernommen. Fehlendes Ende darf aus der konfigurierten Auflösung
 * entstehen; ein vorhandenes ungültiges Ende niemals. Ergebnis: EUR/kWh, keine
 * State-Schreibwirkung; null bewirkt atomare Ablehnung der gesamten Antwort. */
function normalizeInterval(row, options = {}) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    const firstDefined = (values) => values.find(value => value !== undefined);
    const startsAt = toIso(firstDefined([row.startsAt, row.start, row.startTime, row.from, row.begin, row.timestamp, row.time]));
    if (!startsAt) return null;
    const resolutionMinutes = clampNumber(options.resolutionMinutes, 60, 1, 1440);
    const rawEnd = firstDefined([row.endsAt, row.end, row.endTime, row.to, row.until]);
    const endsAt = rawEnd === undefined
        ? new Date(Date.parse(startsAt) + resolutionMinutes * 60 * 1000).toISOString()
        : toIso(rawEnd);
    const duration = Date.parse(endsAt) - Date.parse(startsAt);
    if (!endsAt || !Number.isFinite(duration) || duration <= 0 || duration > 86400000) return null;
    const component = String(options.priceComponent || 'total').trim();
    const raw = firstDefined([row[component], row.total, row.price, row.value, row.marketprice,
        row.marketPrice, row.energyPrice, row.priceWithTax, row.allInPrice,
        row.allInPriceIncludingVat, row.basePriceIncludingVat]);
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
    const unit = String(options.unit || 'EUR/kWh').trim().toLowerCase().replace(/\s+/g, '');
    if (!['eur/kwh', '€/kwh', 'eur/mwh', '€/mwh', 'ct/kwh', 'cent/kwh', 'cents/kwh', 'eur/wh', '€/wh'].includes(unit)) return null;
    const basePrice = priceToEurKwh(raw, unit);
    const calc = applyFormula(basePrice, options.formula || {});
    if (!Number.isFinite(basePrice) || Math.abs(basePrice) > MAX_ABSOLUTE_PRICE_EUR_KWH ||
        Object.values(calc).some(value => !Number.isFinite(value)) || Math.abs(calc.total) > MAX_ABSOLUTE_PRICE_EUR_KWH) return null;
    const currency = firstDefined([row.currency, options.currency, 'EUR']);
    if (typeof currency !== 'string' || currency.toUpperCase() !== 'EUR') return null;
    return {
        startsAt,
        endsAt,
        total: Math.round(calc.total * 1e8) / 1e8,
        market: Math.round(calc.market * 1e8) / 1e8,
        tax: Math.round(calc.tax * 1e8) / 1e8,
        supplierMarkup: Math.round(calc.supplierMarkup * 1e8) / 1e8,
        gridVariable: Math.round(calc.gridVariable * 1e8) / 1e8,
        feedIn: Number.isFinite(num(options.feedInEurPerKwh, null)) ? num(options.feedInEurPerKwh, null) : null,
        currency: 'EUR',
        source: String(options.source || row.source || 'unknown'),
        quality: String(options.quality || row.quality || 'calculated-all-in'),
    };
}

/** Nie eine teilweise gültige Antwort als frischen Erfolg ausgeben: eine falsche
 * Zeile, leere Daten, überlappende Intervalle oder mehr als 4096 Zeilen verwerfen
 * den gesamten Abruf. Die aufrufende Tarifregelung behält ihren letzten gültigen
 * Stand mit unverändertem Erfolgszeitpunkt und bestehender Ablaufbehandlung. */
function normalizeRows(rows, options = {}) {
    if (!Array.isArray(rows) || !rows.length || rows.length > MAX_PRICE_INTERVALS) throw new Error('provider_prices_invalid');
    const intervals = rows.map(row => normalizeInterval(row, options));
    if (intervals.some(row => !row)) throw new Error('provider_prices_invalid');
    intervals.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    for (let i = 1; i < intervals.length; i++) {
        if (Date.parse(intervals[i].startsAt) < Date.parse(intervals[i - 1].endsAt)) throw new Error('provider_prices_invalid');
    }
    return intervals;
}

function splitTodayTomorrow(intervals, nowMs = Date.now(), timeZone = 'Europe/Berlin') {
    const dateKey = (ms) => {
        try {
            return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
        } catch (_e) {
            return new Date(ms).toISOString().slice(0, 10);
        }
    };
    const todayKey = dateKey(nowMs);
    // Advance the local calendar date, not the current instant by 24 hours.
    // DST days have 23/25 hours; adding 24h can select today or the day after.
    const tomorrowCalendar = new Date(`${todayKey}T12:00:00.000Z`);
    tomorrowCalendar.setUTCDate(tomorrowCalendar.getUTCDate() + 1);
    const tomorrowKey = tomorrowCalendar.toISOString().slice(0, 10);
    const today = [];
    const tomorrow = [];
    for (const row of intervals || []) {
        const key = dateKey(Date.parse(row.startsAt));
        if (key === todayKey) today.push(row);
        else if (key === tomorrowKey) tomorrow.push(row);
    }
    return { today, tomorrow };
}

function currentAndAverage(intervals, nowMs = Date.now()) {
    const rows = Array.isArray(intervals) ? intervals : [];
    const active = rows.find((row) => Date.parse(row.startsAt) <= nowMs && Date.parse(row.endsAt) > nowMs) || null;
    const future = rows.filter((row) => Date.parse(row.endsAt) > nowMs && Date.parse(row.startsAt) < nowMs + 36 * 60 * 60 * 1000);
    const average = future.length ? future.reduce((sum, row) => sum + Number(row.total || 0), 0) / future.length : null;
    return { current: active ? Number(active.total) : null, average };
}

function buildTibberQuery() {
    const resolution = 'QUARTER_HOURLY';
    return `query NexoWattPriceInfo { viewer { homes { id appNickname address { address1 postalCode city country } currentSubscription { priceInfo(resolution: ${resolution}) { current { total energy tax startsAt level currency } today { total energy tax startsAt level currency } tomorrow { total energy tax startsAt level currency } } } } } }`;
}

function normalizeTibber(payload, config = {}) {
    const homes = getByPath(payload, 'data.viewer.homes');
    if (!Array.isArray(homes) || !homes.length) throw new Error('tibber_no_homes');
    const homeId = String(config.homeId || '').trim();
    const home = homeId ? homes.find(h => h && h.id === homeId) : homes[0];
    if (!home || typeof home.id !== 'string' || !home.id) throw new Error('tibber_home_invalid');
    const priceInfo = getByPath(home, 'currentSubscription.priceInfo');
    if (!priceInfo || !Array.isArray(priceInfo.today) || !priceInfo.today.length || (priceInfo.tomorrow !== undefined && !Array.isArray(priceInfo.tomorrow))) throw new Error('tibber_no_price_info');
    const rows = [...priceInfo.today, ...(priceInfo.tomorrow || [])];
    const intervals = normalizeRows(rows, {
        resolutionMinutes: 15,
        priceComponent: 'total',
        unit: 'EUR/kWh',
        formula: { priceIncludesVat: true },
        source: 'tibber',
        quality: 'provider-all-in',
    });
    return { intervals, homeId: String(home.id || ''), homeName: String(home.appNickname || getByPath(home, 'address.address1') || '') };
}

function collectLikelyPriceRows(value, depth = 0) {
    if (depth > 7 || value === null || value === undefined) return [];
    if (Array.isArray(value)) {
        if (value.some((row) => row && typeof row === 'object' && (
            row.startsAt !== undefined || row.start !== undefined || row.timestamp !== undefined || row.readingDate !== undefined || row.date !== undefined
        ))) return value;
        for (const child of value) {
            const found = collectLikelyPriceRows(child, depth + 1);
            if (found.length) return found;
        }
        return [];
    }
    if (typeof value === 'object') {
        const preferred = ['Prices', 'prices', 'PriceItems', 'priceItems', 'data', 'items', 'values', 'result'];
        for (const key of preferred) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                const found = collectLikelyPriceRows(value[key], depth + 1);
                if (found.length) return found;
            }
        }
        for (const child of Object.values(value)) {
            const found = collectLikelyPriceRows(child, depth + 1);
            if (found.length) return found;
        }
    }
    return [];
}

function normalizeEnergyZero(payload, config = {}) {
    const rawRows = collectLikelyPriceRows(payload);
    const component = String(config.priceComponent || 'allInPriceIncludingVat');
    const mapped = rawRows.map((row) => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('provider_prices_invalid');
        const firstDefined = values => values.find(value => value !== undefined);
        return {
            startsAt: firstDefined([row.startsAt, row.start, row.timestamp, row.readingDate, row.date]),
            endsAt: firstDefined([row.endsAt, row.end, row.endDate]),
            total: firstDefined([row[component], row.price, row.value, row.total]),
            currency: row.currency === undefined ? 'EUR' : row.currency,
        };
    });
    const intervals = normalizeRows(mapped, {
        resolutionMinutes: Number(config.resolutionMinutes) <= 15 ? 15 : 60,
        unit: config.unit || 'EUR/kWh',
        formula: { priceIncludesVat: true },
        source: 'energyzero',
        quality: component.toLowerCase().includes('allin') ? 'provider-all-in' : 'provider-variable',
    });
    if (!intervals.length) throw new Error('energyzero_no_prices');
    return { intervals };
}

function parseIsoDurationMinutes(value, fallback = 60) {
    const m = String(value || '').match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);
    if (!m) return fallback;
    return (Number(m[1] || 0) * 60) + Number(m[2] || 0) || fallback;
}

/** Begrenzter XML-Scanner für die bereits unterstützten ENTSO-E-Preisfelder.
 * Jeder Quelltextabschnitt wird pro Aufruf nur vorwärts durchlaufen; kein Regex
 * sucht für jedes ungeschlossene Starttag erneut bis zum Antwortende. Kein DTD,
 * keine Entity-Auflösung, kein Nachladen. Namenräume/Attribute bleiben unterstützt.
 * Elementtiefe, Knotenzahl und Taglänge begrenzen zusätzlich Speicher/CPU. */
function xmlBlocks(block, wanted) {
    const matches = [];
    const stack = [];
    let cursor = 0; let elements = 0;
    while (cursor < block.length) {
        const start = block.indexOf('<', cursor);
        if (start < 0) break;
        if (block.startsWith('<!--', start)) {
            const end = block.indexOf('-->', start + 4);
            if (end < 0) throw new Error('entsoe_invalid_response');
            cursor = end + 3; continue;
        }
        if (block.startsWith('<?', start)) {
            const end = block.indexOf('?>', start + 2);
            if (end < 0) throw new Error('entsoe_invalid_response');
            cursor = end + 2; continue;
        }
        if (block.startsWith('<!', start)) throw new Error('entsoe_invalid_response');
        let end = start + 1; let quote = '';
        for (; end < block.length; end += 1) {
            if (end - start > 16384) throw new Error('entsoe_invalid_response');
            const character = block.charAt(end);
            if (quote) { if (character === quote) quote = ''; }
            else if (character === '"' || character === "'") quote = character;
            else if (character === '>') break;
        }
        if (end >= block.length || quote) throw new Error('entsoe_invalid_response');
        const raw = block.slice(start + 1, end).trim();
        const closing = raw.startsWith('/');
        const token = closing ? raw.slice(1) : raw;
        const parsed = /^([A-Za-z_][A-Za-z0-9_.:-]*)(?:\s|\/|$)/.exec(token);
        if (!parsed) throw new Error('entsoe_invalid_response');
        const name = parsed[1].toLowerCase();
        const local = name.slice(name.lastIndexOf(':') + 1);
        const tail = token.slice(parsed[1].length).trim();
        if (closing) {
            const opened = stack.pop();
            if (!opened || tail || opened.name !== name) throw new Error('entsoe_invalid_response');
            if (local === wanted) matches.push(block.slice(opened.contentStart, start));
        } else {
            if (++elements > 65536 || stack.length >= 32) throw new Error('entsoe_invalid_response');
            if (local === wanted && stack.some(entry => entry.local === wanted)) throw new Error('entsoe_invalid_response');
            if (tail.endsWith('/')) { if (local === wanted) matches.push(''); }
            else stack.push({ name, local, contentStart: end + 1 });
        }
        cursor = end + 1;
    }
    if (stack.length) throw new Error('entsoe_invalid_response');
    return matches;
}
function xmlText(block, tag) {
    return (xmlBlocks(block, tag.toLowerCase()).at(0) || '').trim();
}

/** ENTSO-E liefert XML statt JSON. Nur explizite Dezimalzahlen und positive
 * fortlaufende Positionsnummern werden konvertiert; fehlende Felder und externe
 * Entitäten verwerfen die gesamte Antwort. Anbieter-Fehlertexte bleiben intern. */
function normalizeEntsoe(xml, config = {}) {
    if (typeof xml !== 'string' || Buffer.byteLength(xml, 'utf8') > MAX_PROVIDER_RESPONSE_BYTES || /<!DOCTYPE|<!ENTITY/i.test(xml) || (!xml.includes('Publication_MarketDocument') && !xml.includes('TimeSeries'))) throw new Error('entsoe_invalid_response');
    const currency = xmlText(xml, 'currency_Unit.name');
    const measure = xmlText(xml, 'price_Measure_Unit.name');
    if ((currency && currency !== 'EUR') || (measure && measure !== 'MWH')) throw new Error('entsoe_invalid_response');
    const periods = xmlBlocks(xml, 'period');
    const rows = [];
    for (const period of periods) {
        const startsAt = toIso(xmlText(period, 'start'));
        const resolutionMinutes = parseIsoDurationMinutes(xmlText(period, 'resolution'), 0);
        if (!startsAt || !Number.isInteger(resolutionMinutes) || resolutionMinutes < 1 || resolutionMinutes > 1440) throw new Error('entsoe_invalid_response');
        const baseMs = Date.parse(startsAt);
        const points = xmlBlocks(period, 'point');
        if (!points.length) throw new Error('entsoe_invalid_response');
        let expectedPosition = 1;
        for (const point of points) {
            const positionText = xmlText(point, 'position');
            const priceText = xmlText(point, 'price.amount');
            if (!/^[1-9]\d*$/.test(positionText) || Number(positionText) !== expectedPosition++ || !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(priceText)) throw new Error('entsoe_invalid_response');
            const price = Number(priceText);
            if (!Number.isFinite(price)) throw new Error('entsoe_invalid_response');
            const startMs = baseMs + (Number(positionText) - 1) * resolutionMinutes * 60 * 1000;
            rows.push({ startsAt: new Date(startMs).toISOString(), endsAt: new Date(startMs + resolutionMinutes * 60 * 1000).toISOString(), total: price });
            if (rows.length > MAX_PRICE_INTERVALS) throw new Error('provider_prices_invalid');
        }
    }
    const intervals = normalizeRows(rows, {
        resolutionMinutes: Number(config.resolutionMinutes) || 60,
        unit: 'EUR/MWh',
        formula: config.formula || {},
        source: 'entsoe',
        quality: Object.keys(config.formula || {}).length ? 'calculated-all-in' : 'market-only',
        feedInEurPerKwh: config.feedInEurPerKwh,
    });
    return { intervals };
}

function normalizeCustomRest(payload, config = {}) {
    const root = getByPath(payload, config.arrayPath || '');
    const rows = Array.isArray(root) ? root : collectLikelyPriceRows(root);
    const mapped = rows.map((row) => ({
        startsAt: getByPath(row, config.startPath || 'startsAt'),
        endsAt: getByPath(row, config.endPath || 'endsAt'),
        total: getByPath(row, config.pricePath || 'total'),
        currency: getByPath(row, config.currencyPath || 'currency') === undefined ? (config.currency || 'EUR') : getByPath(row, config.currencyPath || 'currency'),
    }));
    const intervals = normalizeRows(mapped, {
        resolutionMinutes: Number(config.resolutionMinutes) || 60,
        unit: config.unit || 'EUR/kWh',
        formula: config.formula || {},
        source: config.source || 'custom-rest',
        quality: config.quality || 'calculated-all-in',
        feedInEurPerKwh: config.feedInEurPerKwh,
    });
    if (!intervals.length) throw new Error('custom_rest_no_prices');
    return { intervals };
}

// UI-CRA-NET-04 / NW-HTTPS-5S: Ein gesamter Abruf einschließlich OAuth darf
// höchstens 5000 ms warten. Ein gemeinsames Signal beendet Netzwerk und Body;
// das zusätzliche Promise-Race liefert auch bei nicht kooperierendem Transport
// einen Fehler zurück. Keine synchronen Wartezeiten oder automatischen Retries.
const MAX_PROVIDER_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_PROVIDER_REQUEST_BYTES = 64 * 1024;
const MAX_PROVIDER_TIMEOUT_MS = 5000;

/** Ein Budget pro fetchProvider, nicht pro HTTP-Schritt. Konfigurierte kürzere
 * Fristen bleiben möglich; lange/ungültige Werte erhöhen niemals das Maximum.
 * Nach dem Parsing wird die monotone Frist erneut geprüft. Node.js-Timer sind
 * keine Echtzeitgarantie bei blockiertem Betriebssystem/Event-Loop. */
function withTimeout(timeoutMs, fn, parentSignal) {
    const requested = Number(timeoutMs);
    const budget = Number.isFinite(requested) && requested > 0 ? Math.min(MAX_PROVIDER_TIMEOUT_MS, requested) : MAX_PROVIDER_TIMEOUT_MS;
    const deadline = performance.now() + budget;
    const ctrl = new AbortController();
    let timer;
    let cancel;
    const timeout = new Promise((_resolve, reject) => {
        timer = setTimeout(() => { ctrl.abort(); reject(new Error('provider_timeout')); }, budget);
        cancel = () => { ctrl.abort(); reject(new Error('provider_cancelled')); };
        if (parentSignal?.aborted) cancel();
        else parentSignal?.addEventListener('abort', cancel, { once: true });
    });
    const operation = Promise.resolve().then(() => {
        if (ctrl.signal.aborted) throw new Error('provider_cancelled');
        return fn(ctrl.signal);
    }).then(result => {
        if (ctrl.signal.aborted || performance.now() >= deadline) { ctrl.abort(); throw new Error('provider_timeout'); }
        return result;
    });
    return Promise.race([operation, timeout]).finally(() => {
        clearTimeout(timer);
        parentSignal?.removeEventListener('abort', cancel);
    });
}

/** Jeder externe Tarifabruf verlangt HTTPS mit der Node.js-Standardprüfung des
 * Serverzertifikats. Keine URL-Zugangsdaten, Redirects oder TLS-Ausnahmen; echte
 * API-Zugangsdaten kommen ausschließlich aus der ioBroker-Adapterkonfiguration. */
function validateProviderUrl(raw, _options) {
    let url;
    try { url = new URL(raw); } catch (_error) { throw new Error('provider_url_invalid'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) throw new Error('provider_url_invalid');
    if (url.protocol !== 'https:') throw new Error('provider_https_required');
    return url;
}

/** Prüft Content-Length zusätzlich zum tatsächlich gelesenen Stream. Die Grenze
 * bezieht sich auf Bytes nach HTTP-Dekompression; Provider-Fehlertexte werden
 * nicht in Logs/API-Fehler übernommen, da sie Zugangsdaten zurückspiegeln können. */
async function readProviderResponse(response) {
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_PROVIDER_RESPONSE_BYTES) {
        await response.body?.cancel().catch(() => {});
        throw new Error('provider_response_too_large');
    }
    if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw new Error(`provider_http_${response.status}`);
    }
    if (!response.body) return '';
    const reader = response.body.getReader();
    let size = 0;
    const chunks = [];
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > MAX_PROVIDER_RESPONSE_BYTES) {
                await reader.cancel().catch(() => {});
                throw new Error('provider_response_too_large');
            }
            chunks.push(Buffer.from(value));
        }
        return Buffer.concat(chunks, size).toString('utf8');
    } finally { reader.releaseLock(); }
}

/** Transportteil des gemeinsamen Provider-Budgets. Signal gilt von DNS bis
 * zum letzten Body-Byte; Ausnahmen verlassen den Adapter nur als feste Codes. */
async function fetchText(rawUrl, options = {}, signal) {
    const url = validateProviderUrl(rawUrl, options);
    if (options.body && Buffer.byteLength(String(options.body), 'utf8') > MAX_PROVIDER_REQUEST_BYTES) throw new Error('provider_request_too_large');
    const requestOptions = { ...options };
    delete requestOptions.timeoutMs;
    delete requestOptions.sensitive;
    try {
        if (signal.aborted) throw new Error('provider_timeout');
        const response = await fetch(url, { ...requestOptions, redirect: 'error', signal });
        return await readProviderResponse(response);
    } catch (error) {
        if (signal.aborted) throw new Error('provider_timeout');
        if (/^provider_(?:response_too_large|http_\d+)$/.test(String(error && error.message))) throw error;
        throw new Error('provider_request_failed');
    }
}

/** JSON-Syntaxprüfung im gleichen Budget; fachliche Vollständigkeit/Typen folgen
 * im jeweiligen Normalizer, bevor fetchProvider ein Ergebnis freigibt. */
async function fetchJson(url, options = {}, signal) {
    const text = await fetchText(url, options, signal);
    try { return JSON.parse(text); } catch (_e) { throw new Error('invalid_json_response'); }
}

function headersFromConfig(raw) {
    const value = parseJsonMaybe(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out = {};
    for (const [key, val] of Object.entries(value)) {
        if (!key || val === null || val === undefined) continue;
        out[String(key)] = String(val);
    }
    return out;
}

async function fetchTibber(config = {}, signal) {
    const token = String(config.credentials && config.credentials.accessToken || '').trim();
    if (!token || token === '__KEEP__') throw new Error('tibber_token_missing');
    const endpoint = String(config.endpoint || 'https://api.tibber.com/v1-beta/gql');
    const payload = await fetchJson(endpoint, {
        method: 'POST',
        timeoutMs: config.timeoutMs,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'User-Agent': String(config.userAgent || DEFAULT_USER_AGENT),
        },
        body: JSON.stringify({ query: buildTibberQuery() }),
    }, signal);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('tibber_invalid_response');
    if (payload.errors !== undefined && !Array.isArray(payload.errors)) throw new Error('tibber_invalid_response');
    if (Array.isArray(payload.errors) && payload.errors.length) throw new Error('tibber_graphql_error');
    return normalizeTibber(payload, config);
}

async function fetchEnergyZero(config = {}, signal) {
    // Official public EnergyZero endpoint. It returns the day before, selected
    // day and the following day (if available). The date format is dd-mm-yyyy
    // and the interval is an enum, not the legacy numeric API parameters.
    const endpoint = String(config.endpoint || 'https://public.api.energyzero.nl/public/v1/prices');
    const url = new URL(endpoint);
    if (!url.searchParams.has('date')) {
        const now = new Date();
        const pad = (value) => String(value).padStart(2, '0');
        url.searchParams.set('date', `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`);
    }
    if (!url.searchParams.has('interval')) {
        url.searchParams.set('interval', Number(config.resolutionMinutes) <= 15 ? 'INTERVAL_QUARTER' : 'INTERVAL_HOUR');
    }
    const payload = await fetchJson(url.toString(), {
        method: 'GET',
        timeoutMs: config.timeoutMs,
        headers: { 'Accept': 'application/json', 'User-Agent': String(config.userAgent || DEFAULT_USER_AGENT) },
    }, signal);
    return normalizeEnergyZero(payload, config);
}

function entsoeWindow(nowMs = Date.now()) {
    // ENTSO-E expects UTC timestamps in YYYYMMDDHHmm. Request a complete
    // today/tomorrow window so tariff-vis can publish both JSON curves without
    // an external adapter.
    const dayStart = new Date(nowMs);
    dayStart.setUTCHours(0, 0, 0, 0);
    const start = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000);
    const end = new Date(dayStart.getTime() + 72 * 60 * 60 * 1000);
    const fmt = (d) => [
        d.getUTCFullYear(),
        String(d.getUTCMonth() + 1).padStart(2, '0'),
        String(d.getUTCDate()).padStart(2, '0'),
        String(d.getUTCHours()).padStart(2, '0'),
        String(d.getUTCMinutes()).padStart(2, '0'),
    ].join('');
    return { start: fmt(start), end: fmt(end) };
}

async function fetchEntsoe(config = {}, signal) {
    const token = String(config.credentials && config.credentials.securityToken || '').trim();
    if (!token || token === '__KEEP__') throw new Error('entsoe_token_missing');
    const country = String(config.country || 'DE').toUpperCase() === 'NL' ? 'NL' : 'DE';
    const domain = String(config.biddingZone || BIDDING_ZONES[country]);
    const window = entsoeWindow();
    const url = new URL(String(config.endpoint || 'https://web-api.tp.entsoe.eu/api'));
    url.searchParams.set('securityToken', token);
    url.searchParams.set('documentType', 'A44');
    url.searchParams.set('in_Domain', domain);
    url.searchParams.set('out_Domain', domain);
    url.searchParams.set('periodStart', window.start);
    url.searchParams.set('periodEnd', window.end);
    const xml = await fetchText(url.toString(), {
        method: 'GET',
        timeoutMs: config.timeoutMs,
        headers: { 'Accept': 'application/xml,text/xml', 'User-Agent': String(config.userAgent || DEFAULT_USER_AGENT) },
    }, signal);
    return normalizeEntsoe(xml, config);
}

async function fetchOAuthToken(config = {}, signal) {
    const credentials = config.credentials || {};
    const clientId = String(credentials.clientId || '').trim();
    const clientSecret = String(credentials.clientSecret || '').trim();
    const tokenUrl = String(credentials.tokenUrl || config.tokenUrl || '').trim();
    if (!clientId || !clientSecret || clientSecret === '__KEEP__' || !tokenUrl) throw new Error('oauth_credentials_missing');
    const body = new URLSearchParams();
    body.set('grant_type', 'client_credentials');
    if (credentials.scope) body.set('scope', String(credentials.scope));
    const payload = await fetchJson(tokenUrl, {
        method: 'POST',
        timeoutMs: config.timeoutMs,
        sensitive: true,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            'User-Agent': String(config.userAgent || DEFAULT_USER_AGENT),
        },
        body: body.toString(),
    }, signal);
    if (!payload || typeof payload.access_token !== 'string' || !payload.access_token || payload.access_token.length > 16384) throw new Error('oauth_token_invalid');
    return payload.access_token;
}

async function fetchCustomRest(config = {}, overrideToken = '', signal) {
    const custom = config.customRest || config;
    const url = String(custom.url || config.pricesUrl || '').trim();
    if (!url) throw new Error('custom_rest_url_missing');
    const headers = { 'Accept': 'application/json', 'User-Agent': String(config.userAgent || DEFAULT_USER_AGENT), ...headersFromConfig(custom.headersJson) };
    const credentials = config.credentials || {};
    const authMode = String(custom.authMode || (overrideToken ? 'bearer' : 'none'));
    if (overrideToken) headers.Authorization = `Bearer ${overrideToken}`;
    else if (authMode === 'bearer' && credentials.bearerToken && credentials.bearerToken !== '__KEEP__') headers.Authorization = `Bearer ${credentials.bearerToken}`;
    else if (authMode === 'api-key' && credentials.apiKey && credentials.apiKey !== '__KEEP__') headers[String(custom.apiKeyHeader || 'x-api-key')] = String(credentials.apiKey);
    else if (authMode === 'basic' && credentials.username && credentials.password && credentials.password !== '__KEEP__') headers.Authorization = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`;
    const method = String(custom.method || 'GET').toUpperCase();
    const payload = await fetchJson(url, {
        method,
        timeoutMs: config.timeoutMs,
        sensitive: !!overrideToken || authMode !== 'none',
        headers: method === 'GET' ? headers : { 'Content-Type': 'application/json', ...headers },
        body: method === 'GET' ? undefined : String(custom.body || ''),
    }, signal);
    return normalizeCustomRest(payload, {
        ...custom,
        resolutionMinutes: config.resolutionMinutes,
        formula: config.formula,
        feedInEurPerKwh: config.feedInEurPerKwh,
        source: config.providerId || 'custom-rest',
    });
}

async function fetchOstrom(config = {}, signal) {
    const token = await fetchOAuthToken(config, signal);
    return fetchCustomRest({ ...config, customRest: { ...(config.customRest || {}), url: String(config.pricesUrl || config.customRest && config.customRest.url || '') } }, token, signal);
}

/** Öffentlicher Abrufvertrag: erst die gesamte validierte Antwort zurückgeben;
 * nie States schreiben. Alle Fehler sind feste Codes ohne URLs/Token/Antworttext.
 * Tarifmodul und Installer-API fangen diese Rejection bereits asynchron ab. */
async function fetchProvider(config = {}, signal) {
    return withTimeout(config.timeoutMs, async signal => {
        let providerId = String(config.providerId || 'manual-dp');
        if (providerId === 'market-profile') providerId = String(config.sourceId || (config.country === 'NL' ? 'energyzero' : 'entsoe'));
        const resolvedConfig = { ...config, providerId };
        if (providerId === 'tibber') return fetchTibber(resolvedConfig, signal);
        if (providerId === 'energyzero') return fetchEnergyZero(resolvedConfig, signal);
        if (providerId === 'entsoe') return fetchEntsoe(resolvedConfig, signal);
        if (providerId === 'ostrom') return fetchOstrom(resolvedConfig, signal);
        if (providerId === 'custom-rest') return fetchCustomRest(resolvedConfig, '', signal);
        throw new Error(providerId === 'manual-dp' ? 'manual_dp_has_no_fetch' : 'unknown_provider');
    }, signal).catch(error => {
        const message = String(error && error.message || '');
        if (/^(?:provider_(?:timeout|cancelled|https_required|url_invalid|request_too_large|response_too_large|request_failed|prices_invalid|http_\d{3})|invalid_json_response|tibber_(?:token_missing|graphql_error|invalid_response|no_homes|home_invalid|no_price_info)|energyzero_no_prices|entsoe_(?:token_missing|invalid_response|no_prices)|oauth_(?:credentials_missing|token_invalid)|custom_rest_(?:url_missing|no_prices)|manual_dp_has_no_fetch|unknown_provider)$/.test(message)) throw error;
        throw new Error('provider_request_failed');
    });
}

function publicRegistry() {
    return {
        providers: PROVIDERS.map((row) => ({ ...row })),
        profiles: PROVIDER_PROFILES.map((row) => ({ ...row })),
        biddingZones: { ...BIDDING_ZONES },
        internalDatapoints: {
            priceCurrent: 'tariffProvider.currentPriceEurPerKwh',
            priceAverage: 'tariffProvider.averagePriceEurPerKwh',
            priceTodayJson: 'tariffProvider.pricesTodayJson',
            priceTomorrowJson: 'tariffProvider.pricesTomorrowJson',
        },
    };
}

module.exports = {
    DEFAULT_USER_AGENT,
    BIDDING_ZONES,
    PROVIDERS,
    PROVIDER_PROFILES,
    parseJsonMaybe,
    getByPath,
    priceToEurKwh,
    applyFormula,
    normalizeInterval,
    normalizeRows,
    splitTodayTomorrow,
    currentAndAverage,
    buildTibberQuery,
    normalizeTibber,
    normalizeEnergyZero,
    normalizeEntsoe,
    normalizeCustomRest,
    fetchProvider,
    publicRegistry,
};
