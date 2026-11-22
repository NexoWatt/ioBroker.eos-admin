/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/partner-contracts.ts
 * Quell-Hash: sha256:c1b93bd8414a5100f847c32dac72465dc97953a9b4f3c867be782a8ff3439243
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/partner-contracts.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PARTNER_PERMISSIONS = exports.PARTNER_PROTOCOL = void 0;
exports.partnerRecord = partnerRecord;
exports.partnerKeys = partnerKeys;
exports.partnerId = partnerId;
exports.partnerNumber = partnerNumber;
exports.partnerInteger = partnerInteger;
exports.isPartnerAppId = isPartnerAppId;
exports.defaultPartnerConfig = defaultPartnerConfig;
exports.permissionAllowed = permissionAllowed;
exports.validatePartnerConfig = validatePartnerConfig;
exports.currentPartnerConfig = currentPartnerConfig;
exports.partnerAppState = partnerAppState;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Beschreibt und prüft den versionierten Partnervertrag sowie dessen lokale Freigaben.
 * Daten und Wirkung: Unbekanntes JSON wird streng geprüft; keine Netzwerk-, Geräte- oder Persistenzzugriffe.
 * Bei Änderungen: API, Transport, App-Freigaben, CAS und Negativtests gemeinsam anpassen.
 * Verknüpfungen: partner-service.ts, partner-config-api.ts, partner-websocket.ts.
 */
exports.PARTNER_PROTOCOL = 'nexowatt.partner.v1';
exports.PARTNER_PERMISSIONS = ['balance.read', 'telemetry.read', 'capabilities.read', 'curtailment.request', 'storage.charge.request', 'storage.discharge.request', 'dispatch.status.read', 'dispatch.cancel'];
/** Nur normale JSON-Objekte akzeptieren; Klassen und Arrays sind keine Verträge. */
function partnerRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
/** Eigene Schlüssel müssen exakt aus einer Positivliste stammen. */
function partnerKeys(value, allowed) {
    return Object.keys(value).every(key => allowed.includes(key));
}
function partnerId(value) { return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value); }
function partnerNumber(value, min, max) { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max; }
function partnerInteger(value, min, max) { return partnerNumber(value, min, max) && Number.isSafeInteger(value); }
function isPartnerAppId(value) { return value === 'arbitrage' || value === 'energyLedger' || value === 'directMarketing'; }
/** Frische Standardwerte sind gesperrt und enthalten keine implizite Freigabe. */
function defaultPartnerConfig() {
    return { configVersion: 1, enabled: false, partnerId: '', endpoint: '', credentialRef: '', grants: [], arbitrage: { profile: 'household', resources: [], maxCommandSeconds: 60 } };
}
/** Appübergreifende Rechte werden abgewiesen; Bilanz bleibt ausschließlich lesend. */
function permissionAllowed(appId, permission) {
    if (appId === 'energyLedger')
        return permission === 'balance.read';
    if (appId === 'directMarketing')
        return ['telemetry.read', 'capabilities.read', 'curtailment.request', 'dispatch.status.read', 'dispatch.cancel'].includes(permission);
    return permission !== 'balance.read' && permission !== 'curtailment.request';
}
/** Prüft alle Eingaben, Mengen und Einheiten; ungültige Entwürfe werden nie normalisiert aktiviert. */
function validatePartnerConfig(input) {
    const errors = [];
    const issue = (path, message) => { errors.push({ path, code: 'INVALID_CONFIG', message }); };
    if (!partnerRecord(input) || !partnerKeys(input, ['configVersion', 'enabled', 'partnerId', 'endpoint', 'credentialRef', 'grants', 'arbitrage']))
        return { valid: false, errors: [{ path: '', code: 'INVALID_CONFIG', message: 'Ungültige oder unbekannte Konfigurationsfelder.' }], config: null };
    if (!partnerInteger(input.configVersion, 1, Number.MAX_SAFE_INTEGER - 1))
        issue('configVersion', 'Positive ganzzahlige Revision erforderlich.');
    if (typeof input.enabled !== 'boolean')
        issue('enabled', 'Expliziter Ein-/Ausschalter erforderlich.');
    if (!(input.partnerId === '' || partnerId(input.partnerId)))
        issue('partnerId', 'Partnerkennung mit maximal 64 Zeichen erforderlich.');
    if (typeof input.endpoint !== 'string' || input.endpoint.length > 2048)
        issue('endpoint', 'Begrenzte WSS-Adresse erforderlich.');
    else if (input.endpoint !== '') {
        try {
            const endpoint = new URL(input.endpoint);
            if (endpoint.protocol !== 'wss:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || !endpoint.hostname)
                issue('endpoint', 'Nur WSS ohne Zugangsdaten, Query oder Fragment zulässig.');
        }
        catch {
            issue('endpoint', 'Ungültige WSS-Adresse.');
        }
    }
    if (typeof input.credentialRef !== 'string' || !(input.credentialRef === '' || /^NEXOWATT_PARTNER_[A-Z0-9_]{1,80}$/.test(input.credentialRef)))
        issue('credentialRef', 'Nur eine NEXOWATT_PARTNER_-Umgebungsreferenz ist zulässig.');
    if (input.enabled === true && (!input.partnerId || !input.endpoint || !input.credentialRef))
        issue('enabled', 'Partnerkennung, WSS-Adresse und geschützte Zugangsdatenreferenz fehlen.');
    const resources = [];
    const arb = input.arbitrage;
    if (!partnerRecord(arb) || !partnerKeys(arb, ['profile', 'resources', 'maxCommandSeconds']))
        issue('arbitrage', 'Ungültige Arbitrage-Konfiguration.');
    else {
        if (arb.profile !== 'household' && arb.profile !== 'tradingOnly')
            issue('arbitrage.profile', 'Haushalt oder reiner Speicherhandel erforderlich.');
        if (!partnerInteger(arb.maxCommandSeconds, 1, 60))
            issue('arbitrage.maxCommandSeconds', 'Befehlsdauer muss zwischen 1 und 60 Sekunden liegen.');
        if (!Array.isArray(arb.resources) || arb.resources.length > 32)
            issue('arbitrage.resources', 'Höchstens 32 freigegebene Speicher zulässig.');
        else
            for (const [index, value] of arb.resources.entries()) {
                if (!partnerRecord(value) || !partnerKeys(value, ['id', 'maxChargeW', 'maxDischargeW', 'maxImportW', 'maxExportW', 'allowGridCharge', 'allowGridExport', 'commissioned', 'minSocPct', 'maxSocPct']) || !partnerId(value.id) || !partnerInteger(value.maxChargeW, 0, 100000000) || !partnerInteger(value.maxDischargeW, 0, 100000000) || !partnerInteger(value.maxImportW, 0, 100000000) || !partnerInteger(value.maxExportW, 0, 100000000) || typeof value.allowGridCharge !== 'boolean' || typeof value.allowGridExport !== 'boolean' || typeof value.commissioned !== 'boolean' || !partnerNumber(value.minSocPct, 0, 100) || !partnerNumber(value.maxSocPct, 0, 100) || value.minSocPct >= value.maxSocPct || resources.some(resource => resource.id === value.id))
                    issue(`arbitrage.resources.${index}`, 'Eindeutige Ressource mit Leistungsgrenzen in W und gültigem SoC-Bereich erforderlich.');
                else
                    resources.push({ id: value.id, maxChargeW: value.maxChargeW, maxDischargeW: value.maxDischargeW, maxImportW: value.maxImportW, maxExportW: value.maxExportW, allowGridCharge: value.allowGridCharge, allowGridExport: value.allowGridExport, commissioned: value.commissioned, minSocPct: value.minSocPct, maxSocPct: value.maxSocPct });
            }
    }
    const grants = [];
    if (!Array.isArray(input.grants) || input.grants.length > 64)
        issue('grants', 'Höchstens 64 Ressourcenfreigaben zulässig.');
    else
        for (const [index, value] of input.grants.entries()) {
            if (!partnerRecord(value) || !partnerKeys(value, ['appId', 'resourceId', 'permissions']) || !isPartnerAppId(value.appId) || !partnerId(value.resourceId) || !Array.isArray(value.permissions) || value.permissions.length < 1 || value.permissions.length > exports.PARTNER_PERMISSIONS.length) {
                issue(`grants.${index}`, 'Ungültige App-/Ressourcenfreigabe.');
                continue;
            }
            const permissions = [];
            for (const p of value.permissions) {
                if (typeof p !== 'string' || !exports.PARTNER_PERMISSIONS.includes(p) || !permissionAllowed(value.appId, p) || permissions.includes(p))
                    issue(`grants.${index}.permissions`, 'Unbekanntes, doppeltes oder für diese App unzulässiges Recht.');
                else
                    permissions.push(p);
            }
            if (grants.some(grant => grant.appId === value.appId && grant.resourceId === value.resourceId))
                issue(`grants.${index}`, 'Doppelte App-/Ressourcenfreigabe.');
            if (value.appId !== 'arbitrage' && value.resourceId !== 'site')
                issue(`grants.${index}.resourceId`, 'Bilanz und Direktvermarktung unterstützen ausschließlich die Ressource site.');
            if (value.appId === 'arbitrage' && !resources.some(resource => resource.id === value.resourceId))
                issue(`grants.${index}.resourceId`, 'Arbitrage-Ressource muss lokal mit Grenzen eingerichtet sein.');
            grants.push({ appId: value.appId, resourceId: value.resourceId, permissions });
        }
    if (errors.length || !partnerRecord(arb))
        return { valid: false, errors, config: null };
    // Die einzelnen Werte wurden oben vollständig geprüft; kein unbekannter Schlüssel wird übernommen.
    const config = { configVersion: input.configVersion, enabled: input.enabled, partnerId: input.partnerId, endpoint: input.endpoint, credentialRef: input.credentialRef, grants, arbitrage: { profile: arb.profile, resources, maxCommandSeconds: arb.maxCommandSeconds } };
    return { valid: true, errors: [], config };
}
/** Fehlende Bestandskonfiguration bleibt aus; eine beschädigte Konfiguration wird nicht still freigegeben. */
function currentPartnerConfig(root) {
    if (!partnerRecord(root) || root.partnerIntegrations === undefined)
        return defaultPartnerConfig();
    const result = validatePartnerConfig(root.partnerIntegrations);
    if (!result.config)
        throw new Error('PARTNER_CONFIG_INVALID');
    return result.config;
}
/** Direkter Appzustand ohne Legacy-Freigabe oder Dynamic-NVP-Abhängigkeit. */
function partnerAppState(root, id = 'arbitrage') {
    const apps = partnerRecord(root) && partnerRecord(root.emsApps) && partnerRecord(root.emsApps.apps) ? root.emsApps.apps : null;
    const value = apps && partnerRecord(apps[id]) ? apps[id] : null;
    const installed = value?.installed === true;
    const enabled = installed && value?.enabled === true;
    return { installed, enabled, active: installed && enabled };
}
