/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/ems/services/arbitrage-control.ts
 * Quell-Hash: sha256:4b2a79c1dd0612d40d28b57727c4cf77c4065579c119b5bbe6977f0dd0091b84
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für ems/services/arbitrage-control.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
"use strict";
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Begrenzt einen freigegebenen Arbitragewunsch anhand frischer Messwerte,
 * lokaler Speicher-/Anschlussgrenzen und der bestehenden zentralen Freigabe.
 * Daten und Wirkung: Reine Funktion ohne Geräte-, State-, Datei- oder Netzschreiber.
 * Leistung in W: positiver Sollwert entlädt, negativer Sollwert lädt den Speicher.
 * Netzleistung in W: positiver Messwert ist Bezug, negativer Messwert Einspeisung.
 * Sicherheitsgrenze: Eine zulässige Entscheidung ist nur ein Intent für den
 * bestehenden alleinigen Writer. Sie bestätigt keine Gerätewirkung. Der Writer
 * muss Widerruf, Steuerhoheit, aktuelle Grenzen und Messwerte vor Wirkung erneut
 * prüfen und seinen vorhandenen gerätespezifischen Rückfall beibehalten.
 * Bei Änderungen: Standalone ohne PV/Bilanz/dynamische App sowie Rechte-, Zeit-,
 * Messwert- und Grenzfehler in test/arbitrage-control.test.cjs mitprüfen.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectConfiguredArbitrageRequest = selectConfiguredArbitrageRequest;
exports.configuredArbitrageFallbackProfile = configuredArbitrageFallbackProfile;
exports.evaluateArbitrageRequest = evaluateArbitrageRequest;
const MAX_POWER_W = 1000000000;
const MAX_COMMAND_DURATION_MS = 60000;
const REQUEST_KEYS = Object.freeze(['id', 'resourceId', 'direction', 'powerW', 'issuedAt', 'expiresAt']);
const PARTNER_REQUEST_KEYS = Object.freeze(['id', 'resourceId', 'action', 'powerW', 'issuedAt', 'expiresAt', 'configVersion', 'partnerId']);
/** Kopiert nur eigene Datenfelder einfacher Objekte, ohne Getter auszuführen. */
function data(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return null;
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null)
        return null;
    const result = Object.create(null);
    for (const key of Object.keys(value)) {
        if (key === '__proto__' || key === 'prototype' || key === 'constructor')
            return null;
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value'))
            return null;
        result[key] = descriptor.value;
    }
    return result;
}
/** Keine String-/Boolean-/Null-Konvertierung an der Steuergrenze zulassen. */
function finite(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
/** Zeitstempel sind nichtnegative, sichere Millisekunden-Ganzzahlen. */
function time(value) {
    return finite(value) && Number.isSafeInteger(value) && value >= 0;
}
/** Fachliche IDs sind keine ioBroker-Pfade und enthalten keine Steuerzeichen. */
function identifier(value) {
    return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/.test(value)
        && !['__proto__', 'constructor', 'prototype'].includes(value);
}
/** Leistungsgrenzen bleiben endlich und innerhalb des lokalen Zahlenvertrags. */
function power(value) {
    return finite(value) && value >= 0 && value <= MAX_POWER_W;
}
/** Ablehnung erzeugt ausdrücklich keinen Ersatz-Sollwert für die Hardware. */
function rejected(reason, request = null) {
    return Object.freeze({ status: 'rejected', reason, requestId: request?.id ?? null,
        resourceId: request?.resourceId ?? null, requestedW: request ? (request.direction === 'charge' ? -request.powerW : request.powerW) : null,
        targetW: null, validUntil: null });
}
/** Strikter, begrenzter Befehlsvertrag; Laufzeitdaten enthalten keine freien DPs. */
function requestData(value) {
    const r = data(value);
    if (!r)
        return null;
    const partner = Object.prototype.hasOwnProperty.call(r, 'action');
    const keys = partner ? PARTNER_REQUEST_KEYS : REQUEST_KEYS;
    if (Object.keys(r).length !== keys.length || Object.keys(r).some(key => !keys.includes(key)))
        return null;
    if (partner && (!identifier(r.partnerId) || !time(r.configVersion)))
        return null;
    const direction = partner ? r.action : r.direction;
    if (!identifier(r.id) || !identifier(r.resourceId) || (direction !== 'charge' && direction !== 'discharge'))
        return null;
    if (!power(r.powerW) || !time(r.issuedAt) || !time(r.expiresAt)
        || r.expiresAt <= r.issuedAt || r.expiresAt - r.issuedAt > MAX_COMMAND_DURATION_MS)
        return null;
    return { id: r.id, resourceId: r.resourceId, direction, powerW: r.powerW, issuedAt: r.issuedAt, expiresAt: r.expiresAt };
}
/** Liest nur gültige, frische Messungen; Zukunftszeit und Ersatzwerte sperren. */
function sample(value, now, maxAgeMs) {
    const s = data(value);
    if (!s || s.valid !== true || !finite(s.value) || !time(s.ts)
        || s.ts > now || now - s.ts >= maxAgeMs)
        return null;
    return { value: s.value, ts: s.ts };
}
/** Ein Grant ist eine zeitlich begrenzte Zuteilung aus dem zentralen Regler. */
function grant(value, now) {
    const g = data(value);
    if (!g || !power(g.maxChargeW) || !power(g.maxDischargeW)
        || !time(g.issuedAt) || !time(g.expiresAt) || g.issuedAt > now || g.expiresAt <= now
        || g.expiresAt <= g.issuedAt || g.expiresAt - g.issuedAt > MAX_COMMAND_DURATION_MS)
        return null;
    return { maxChargeW: g.maxChargeW, maxDischargeW: g.maxDischargeW, issuedAt: g.issuedAt, expiresAt: g.expiresAt };
}
/** Prüft lokale Betriebsgrenzen; Null-W-Grenzen bleiben wirksame Sperren. */
function limits(value) {
    const l = data(value);
    if (!l || !finite(l.minSoc) || !finite(l.maxSoc) || l.minSoc < 0 || l.maxSoc > 100 || l.minSoc >= l.maxSoc
        || !power(l.maxChargeW) || !power(l.maxDischargeW) || !power(l.maxImportW) || !power(l.maxExportW)
        || typeof l.allowGridCharge !== 'boolean' || typeof l.allowGridExport !== 'boolean')
        return null;
    return { minSoc: l.minSoc, maxSoc: l.maxSoc, maxChargeW: l.maxChargeW, maxDischargeW: l.maxDischargeW,
        maxImportW: l.maxImportW, maxExportW: l.maxExportW, allowGridCharge: l.allowGridCharge, allowGridExport: l.allowGridExport };
}
/**
 * Verbindet ausschließlich lokale App-/Ressourcenfreigaben mit dem aktuellen
 * Auftrag des Partnerdienstes. Der Rückruf prüft Authentisierung, Lease und
 * Widerruf; seine Daten dürfen keine lokale Grenze ersetzen. Der Fingerprint
 * bindet auch die konkrete Konfiguration an spätere Hardware-Guards.
 */
function selectConfiguredArbitrageRequest(rootValue, resourceId, currentRequest) {
    try {
        const root = data(rootValue), appsRoot = data(root?.emsApps), apps = data(appsRoot?.apps), app = data(apps?.arbitrage);
        const config = data(root?.partnerIntegrations), arb = data(config?.arbitrage);
        if (!config || config.enabled !== true || !time(config.configVersion)
            || app?.installed !== true || app.enabled !== true || !arb || !Array.isArray(arb.resources)
            || (arb.profile !== 'household' && arb.profile !== 'tradingOnly'))
            return null;
        const rows = arb.resources.map(data).filter((row) => row !== null && row.id === resourceId);
        if (rows.length !== 1)
            return null;
        const row = rows[0];
        if (!row || row.commissioned !== true)
            return null;
        const local = limits({ minSoc: row.minSocPct, maxSoc: row.maxSocPct, maxChargeW: row.maxChargeW, maxDischargeW: row.maxDischargeW,
            maxImportW: row.maxImportW, maxExportW: row.maxExportW, allowGridCharge: row.allowGridCharge, allowGridExport: row.allowGridExport });
        if (!local)
            return null;
        const raw = data(currentRequest(resourceId));
        const request = requestData(raw);
        if (!request || !raw || request.resourceId !== resourceId || raw.configVersion !== config.configVersion || raw.partnerId !== config.partnerId)
            return null;
        const copy = Object.freeze({ ...raw });
        return Object.freeze({ request: copy, limits: Object.freeze(local), commissioned: true,
            profile: arb.profile, fingerprint: JSON.stringify([config.configVersion, config.partnerId, copy, local, arb.profile]) });
    }
    catch (_error) {
        return null;
    }
}
/** Das Rückfallprofil bleibt auch ohne aktuelle Partnerlease lokal festgelegt. */
function configuredArbitrageFallbackProfile(rootValue, resourceId) {
    try {
        const root = data(rootValue), apps = data(data(root?.emsApps)?.apps), app = data(apps?.arbitrage);
        const config = data(root?.partnerIntegrations), arb = data(config?.arbitrage);
        if (config?.enabled !== true || app?.installed !== true || app.enabled !== true || !arb || !Array.isArray(arb.resources)
            || (arb.profile !== 'household' && arb.profile !== 'tradingOnly'))
            return null;
        const rows = arb.resources.map(data).filter((row) => row !== null && row.id === resourceId);
        return rows.length === 1 && rows[0]?.commissioned === true ? arb.profile : null;
    }
    catch (_error) {
        return null;
    }
}
/**
 * Bewertet einen Partnerwunsch ohne Stellwirkung. Der Kontext stammt lokal aus
 * Inbetriebnahme, Messwertbasis und zentraler Freigabe, niemals aus der Nachricht.
 * Ohne PV, Bilanz oder DynamicGrid ist derselbe Vertrag vollständig nutzbar.
 * Vorhandene dynamische Grenzen dürfen nur durch weitere Minima einschränken.
 * Unerwartete Getter/Proxies/Fehler ergeben einen festen Diagnosecode.
 */
function evaluateArbitrageRequest(requestValue, contextValue) {
    try {
        const request = requestData(requestValue);
        if (!request)
            return rejected('invalid-request');
        const c = data(contextValue);
        if (!c || !time(c.now) || !identifier(c.resourceId))
            return rejected('invalid-context', request);
        const now = c.now;
        if (request.resourceId !== c.resourceId)
            return rejected('resource-mismatch', request);
        if (c.appActive !== true)
            return rejected('app-disabled', request);
        if (c.commissioned !== true)
            return rejected('not-commissioned', request);
        if (c.writerActive !== true)
            return rejected('writer-unavailable', request);
        if (c.available !== true)
            return rejected('storage-unavailable', request);
        if (request.issuedAt > now || request.expiresAt <= now)
            return rejected('request-expired-or-future', request);
        if (!time(c.sampleMaxAgeMs) || c.sampleMaxAgeMs < 1 || c.sampleMaxAgeMs > 60000
            || !time(c.maxSkewMs) || c.maxSkewMs > c.sampleMaxAgeMs)
            return rejected('invalid-freshness-policy', request);
        const maxAgeMs = c.sampleMaxAgeMs;
        const soc = sample(c.soc, now, maxAgeMs);
        const actual = sample(c.batteryPower, now, maxAgeMs);
        const grid = sample(c.gridPower, now, maxAgeMs);
        if (!soc || soc.value < 0 || soc.value > 100 || !actual || !grid
            || Math.abs(actual.value) > MAX_POWER_W || Math.abs(grid.value) > MAX_POWER_W)
            return rejected('telemetry-invalid', request);
        const stamps = [soc.ts, actual.ts, grid.ts];
        if (Math.max(...stamps) - Math.min(...stamps) > c.maxSkewMs)
            return rejected('telemetry-incoherent', request);
        const local = limits(c.limits);
        if (!local)
            return rejected('invalid-local-limits', request);
        const shared = grant(c.grant, now);
        if (!shared)
            return rejected('central-grant-unavailable', request);
        let chargeCap = Math.min(local.maxChargeW, shared.maxChargeW);
        let dischargeCap = Math.min(local.maxDischargeW, shared.maxDischargeW);
        let validUntil = Math.min(request.expiresAt, shared.expiresAt, ...stamps.map(ts => ts + maxAgeMs));
        if (c.dynamicLimitsRequired !== undefined && typeof c.dynamicLimitsRequired !== 'boolean')
            return rejected('invalid-dynamic-limits', request);
        if (c.dynamicLimits !== undefined && c.dynamicLimits !== null) {
            const d = data(c.dynamicLimits);
            if (!d || typeof d.required !== 'boolean')
                return rejected('invalid-dynamic-limits', request);
            // Eine mitgelieferte Grenze wird immer geprüft. required=false darf eine
            // alte/fehlerhafte Grenze nicht still aus dem wirksamen Vertrag entfernen.
            const dynamic = d.valid === true ? grant(d, now) : null;
            if (!dynamic)
                return rejected('dynamic-limits-unavailable', request);
            chargeCap = Math.min(chargeCap, dynamic.maxChargeW);
            dischargeCap = Math.min(dischargeCap, dynamic.maxDischargeW);
            validUntil = Math.min(validUntil, dynamic.expiresAt);
        }
        if (c.dynamicLimitsRequired === true && (c.dynamicLimits === undefined || c.dynamicLimits === null)) {
            return rejected('dynamic-limits-unavailable', request);
        }
        // P_grid = P_rest - P_battery. Der Istwert wird genau einmal entfernt.
        // Der zentrale Grant begrenzt zusätzlich konkurrierende Ressourcen und
        // unbestätigte Übergänge; lokale Einzelberechnung ersetzt ihn niemals.
        const residualW = grid.value + actual.value;
        const exportLimitW = local.allowGridExport ? local.maxExportW : 0;
        chargeCap = Math.max(0, Math.min(chargeCap, local.maxImportW - residualW));
        dischargeCap = Math.max(0, Math.min(dischargeCap, residualW + exportLimitW));
        if (soc.value >= local.maxSoc)
            chargeCap = 0;
        if (soc.value <= local.minSoc)
            dischargeCap = 0;
        // Ohne Netzladefreigabe darf nur der nachgewiesene Restüberschuss laden.
        if (!local.allowGridCharge)
            chargeCap = Math.min(chargeCap, Math.max(0, -residualW));
        const cap = request.direction === 'charge' ? chargeCap : dischargeCap;
        const magnitude = Math.floor(Math.min(request.powerW, cap));
        if (validUntil <= now)
            return rejected('decision-expired', request);
        if (request.powerW > 0 && magnitude <= 0)
            return rejected('operating-limit', request);
        const signed = request.direction === 'charge' ? -magnitude : magnitude;
        const limited = magnitude < request.powerW;
        return Object.freeze({ status: limited ? 'limited' : 'ready', reason: limited ? 'operating-limit' : 'within-limits',
            requestId: request.id, resourceId: request.resourceId,
            requestedW: request.direction === 'charge' ? -request.powerW : request.powerW,
            targetW: signed === 0 ? 0 : signed, validUntil });
    }
    catch (_error) {
        return rejected('invalid-input');
    }
}
