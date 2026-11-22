/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Beschreibt und prüft den versionierten Partnervertrag sowie dessen lokale Freigaben.
 * Daten und Wirkung: Unbekanntes JSON wird streng geprüft; keine Netzwerk-, Geräte- oder Persistenzzugriffe.
 * Bei Änderungen: API, Transport, App-Freigaben, CAS und Negativtests gemeinsam anpassen.
 * Verknüpfungen: partner-service.ts, partner-config-api.ts, partner-websocket.ts.
 */
export const PARTNER_PROTOCOL = 'nexowatt.partner.v1' as const;
export const PARTNER_PERMISSIONS = ['balance.read', 'telemetry.read', 'capabilities.read', 'curtailment.request', 'storage.charge.request', 'storage.discharge.request', 'dispatch.status.read', 'dispatch.cancel'] as const;
export type PartnerPermission = typeof PARTNER_PERMISSIONS[number];
export type PartnerAppId = 'arbitrage' | 'energyLedger' | 'directMarketing';
export type PartnerResource = { id: string; maxChargeW: number; maxDischargeW: number; maxImportW: number; maxExportW: number; allowGridCharge: boolean; allowGridExport: boolean; commissioned: boolean; minSocPct: number; maxSocPct: number };
export type PartnerGrant = { appId: PartnerAppId; resourceId: string; permissions: PartnerPermission[] };
export type PartnerConfig = { configVersion: number; enabled: boolean; partnerId: string; endpoint: string; credentialRef: string; grants: PartnerGrant[]; arbitrage: { profile: 'household' | 'tradingOnly'; resources: PartnerResource[]; maxCommandSeconds: number } };
export type PartnerIssue = { path: string; code: string; message: string };
export type PartnerValidation = { valid: boolean; errors: PartnerIssue[]; config: PartnerConfig | null };
export type PartnerAppState = { installed: boolean; enabled: boolean; active: boolean };
export type StorageRequest = { id: string; resourceId: string; action: 'charge' | 'discharge'; powerW: number; issuedAt: number; expiresAt: number; configVersion: number; partnerId: string };
export type PartnerRecord = Record<string, unknown>;
/** Nur normale JSON-Objekte akzeptieren; Klassen und Arrays sind keine Verträge. */
export function partnerRecord(value: unknown): value is PartnerRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
/** Eigene Schlüssel müssen exakt aus einer Positivliste stammen. */
export function partnerKeys(value: PartnerRecord, allowed: readonly string[]): boolean {
  return Object.keys(value).every(key => allowed.includes(key));
}
export function partnerId(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value); }
export function partnerNumber(value: unknown, min: number, max: number): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max; }
export function partnerInteger(value: unknown, min: number, max: number): value is number { return partnerNumber(value, min, max) && Number.isSafeInteger(value); }
export function isPartnerAppId(value: unknown): value is PartnerAppId { return value === 'arbitrage' || value === 'energyLedger' || value === 'directMarketing'; }
/** Frische Standardwerte sind gesperrt und enthalten keine implizite Freigabe. */
export function defaultPartnerConfig(): PartnerConfig {
  return { configVersion: 1, enabled: false, partnerId: '', endpoint: '', credentialRef: '', grants: [], arbitrage: { profile: 'household', resources: [], maxCommandSeconds: 60 } };
}
/** Appübergreifende Rechte werden abgewiesen; Bilanz bleibt ausschließlich lesend. */
export function permissionAllowed(appId: PartnerAppId, permission: PartnerPermission): boolean {
  if (appId === 'energyLedger') return permission === 'balance.read';
  if (appId === 'directMarketing') return ['telemetry.read', 'capabilities.read', 'curtailment.request', 'dispatch.status.read', 'dispatch.cancel'].includes(permission);
  return permission !== 'balance.read' && permission !== 'curtailment.request';
}
/** Prüft alle Eingaben, Mengen und Einheiten; ungültige Entwürfe werden nie normalisiert aktiviert. */
export function validatePartnerConfig(input: unknown): PartnerValidation {
  const errors: PartnerIssue[] = [];
  const issue = (path: string, message: string): void => { errors.push({ path, code: 'INVALID_CONFIG', message }); };
  if (!partnerRecord(input) || !partnerKeys(input, ['configVersion', 'enabled', 'partnerId', 'endpoint', 'credentialRef', 'grants', 'arbitrage'])) return { valid: false, errors: [{ path: '', code: 'INVALID_CONFIG', message: 'Ungültige oder unbekannte Konfigurationsfelder.' }], config: null };
  if (!partnerInteger(input.configVersion, 1, Number.MAX_SAFE_INTEGER - 1)) issue('configVersion', 'Positive ganzzahlige Revision erforderlich.');
  if (typeof input.enabled !== 'boolean') issue('enabled', 'Expliziter Ein-/Ausschalter erforderlich.');
  if (!(input.partnerId === '' || partnerId(input.partnerId))) issue('partnerId', 'Partnerkennung mit maximal 64 Zeichen erforderlich.');
  if (typeof input.endpoint !== 'string' || input.endpoint.length > 2048) issue('endpoint', 'Begrenzte WSS-Adresse erforderlich.');
  else if (input.endpoint !== '') {
    try { const endpoint = new URL(input.endpoint); if (endpoint.protocol !== 'wss:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || !endpoint.hostname) issue('endpoint', 'Nur WSS ohne Zugangsdaten, Query oder Fragment zulässig.'); }
    catch { issue('endpoint', 'Ungültige WSS-Adresse.'); }
  }
  if (typeof input.credentialRef !== 'string' || !(input.credentialRef === '' || /^NEXOWATT_PARTNER_[A-Z0-9_]{1,80}$/.test(input.credentialRef))) issue('credentialRef', 'Nur eine NEXOWATT_PARTNER_-Umgebungsreferenz ist zulässig.');
  if (input.enabled === true && (!input.partnerId || !input.endpoint || !input.credentialRef)) issue('enabled', 'Partnerkennung, WSS-Adresse und geschützte Zugangsdatenreferenz fehlen.');
  const resources: PartnerResource[] = [];
  const arb = input.arbitrage;
  if (!partnerRecord(arb) || !partnerKeys(arb, ['profile', 'resources', 'maxCommandSeconds'])) issue('arbitrage', 'Ungültige Arbitrage-Konfiguration.');
  else {
    if (arb.profile !== 'household' && arb.profile !== 'tradingOnly') issue('arbitrage.profile', 'Haushalt oder reiner Speicherhandel erforderlich.');
    if (!partnerInteger(arb.maxCommandSeconds, 1, 60)) issue('arbitrage.maxCommandSeconds', 'Befehlsdauer muss zwischen 1 und 60 Sekunden liegen.');
    if (!Array.isArray(arb.resources) || arb.resources.length > 32) issue('arbitrage.resources', 'Höchstens 32 freigegebene Speicher zulässig.');
    else for (const [index, value] of arb.resources.entries()) {
      if (!partnerRecord(value) || !partnerKeys(value, ['id', 'maxChargeW', 'maxDischargeW', 'maxImportW', 'maxExportW', 'allowGridCharge', 'allowGridExport', 'commissioned', 'minSocPct', 'maxSocPct']) || !partnerId(value.id) || !partnerInteger(value.maxChargeW, 0, 100000000) || !partnerInteger(value.maxDischargeW, 0, 100000000) || !partnerInteger(value.maxImportW, 0, 100000000) || !partnerInteger(value.maxExportW, 0, 100000000) || typeof value.allowGridCharge !== 'boolean' || typeof value.allowGridExport !== 'boolean' || typeof value.commissioned !== 'boolean' || !partnerNumber(value.minSocPct, 0, 100) || !partnerNumber(value.maxSocPct, 0, 100) || value.minSocPct >= value.maxSocPct || resources.some(resource => resource.id === value.id)) issue(`arbitrage.resources.${index}`, 'Eindeutige Ressource mit Leistungsgrenzen in W und gültigem SoC-Bereich erforderlich.');
      else resources.push({ id: value.id, maxChargeW: value.maxChargeW, maxDischargeW: value.maxDischargeW, maxImportW: value.maxImportW, maxExportW: value.maxExportW, allowGridCharge: value.allowGridCharge, allowGridExport: value.allowGridExport, commissioned: value.commissioned, minSocPct: value.minSocPct, maxSocPct: value.maxSocPct });
    }
  }
  const grants: PartnerGrant[] = [];
  if (!Array.isArray(input.grants) || input.grants.length > 64) issue('grants', 'Höchstens 64 Ressourcenfreigaben zulässig.');
  else for (const [index, value] of input.grants.entries()) {
    if (!partnerRecord(value) || !partnerKeys(value, ['appId', 'resourceId', 'permissions']) || !isPartnerAppId(value.appId) || !partnerId(value.resourceId) || !Array.isArray(value.permissions) || value.permissions.length < 1 || value.permissions.length > PARTNER_PERMISSIONS.length) { issue(`grants.${index}`, 'Ungültige App-/Ressourcenfreigabe.'); continue; }
    const permissions: PartnerPermission[] = [];
    for (const p of value.permissions) {
      if (typeof p !== 'string' || !PARTNER_PERMISSIONS.includes(p as PartnerPermission) || !permissionAllowed(value.appId, p as PartnerPermission) || permissions.includes(p as PartnerPermission)) issue(`grants.${index}.permissions`, 'Unbekanntes, doppeltes oder für diese App unzulässiges Recht.');
      else permissions.push(p as PartnerPermission);
    }
    if (grants.some(grant => grant.appId === value.appId && grant.resourceId === value.resourceId)) issue(`grants.${index}`, 'Doppelte App-/Ressourcenfreigabe.');
    if (value.appId !== 'arbitrage' && value.resourceId !== 'site') issue(`grants.${index}.resourceId`, 'Bilanz und Direktvermarktung unterstützen ausschließlich die Ressource site.');
    if (value.appId === 'arbitrage' && !resources.some(resource => resource.id === value.resourceId)) issue(`grants.${index}.resourceId`, 'Arbitrage-Ressource muss lokal mit Grenzen eingerichtet sein.');
    grants.push({ appId: value.appId, resourceId: value.resourceId, permissions });
  }
  if (errors.length || !partnerRecord(arb)) return { valid: false, errors, config: null };
  // Die einzelnen Werte wurden oben vollständig geprüft; kein unbekannter Schlüssel wird übernommen.
  const config: PartnerConfig = { configVersion: input.configVersion as number, enabled: input.enabled as boolean, partnerId: input.partnerId as string, endpoint: input.endpoint as string, credentialRef: input.credentialRef as string, grants, arbitrage: { profile: arb.profile as 'household' | 'tradingOnly', resources, maxCommandSeconds: arb.maxCommandSeconds as number } };
  return { valid: true, errors: [], config };
}
/** Fehlende Bestandskonfiguration bleibt aus; eine beschädigte Konfiguration wird nicht still freigegeben. */
export function currentPartnerConfig(root: unknown): PartnerConfig {
  if (!partnerRecord(root) || root.partnerIntegrations === undefined) return defaultPartnerConfig();
  const result = validatePartnerConfig(root.partnerIntegrations);
  if (!result.config) throw new Error('PARTNER_CONFIG_INVALID');
  return result.config;
}
/** Direkter Appzustand ohne Legacy-Freigabe oder Dynamic-NVP-Abhängigkeit. */
export function partnerAppState(root: unknown, id: PartnerAppId = 'arbitrage'): PartnerAppState {
  const apps = partnerRecord(root) && partnerRecord(root.emsApps) && partnerRecord(root.emsApps.apps) ? root.emsApps.apps : null;
  const value = apps && partnerRecord(apps[id]) ? apps[id] : null;
  const installed = value?.installed === true; const enabled = installed && value?.enabled === true;
  return { installed, enabled, active: installed && enabled };
}
