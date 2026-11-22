/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft den vollständigen Partner-API-Vertrag vor der Anzeige und vor Schreibanfragen.
 * Daten und Wirkung: Unbekanntes JSON wird in begrenzte Konfigurationen und Statusdaten überführt;
 * dieser Code öffnet keine Partnerverbindung und erzeugt keine Gerätebefehle.
 * Bei Änderungen: Backend partner-integrations, CAS-Versionen, Rechte und Einheiten gemeinsam prüfen.
 * Verknüpfungen: docs/quellcode/src-admin-tab/src/lib/partnerContracts.md
 */
import { isRecord, isSafeJson } from './adminContracts';

export const PARTNER_PERMISSIONS = ['balance.read', 'telemetry.read', 'capabilities.read', 'curtailment.request', 'storage.charge.request', 'storage.discharge.request', 'dispatch.status.read', 'dispatch.cancel'] as const;
export type PartnerPermission = typeof PARTNER_PERMISSIONS[number];
export type PartnerAppId = 'arbitrage' | 'energyLedger' | 'directMarketing';
export interface PartnerResource { id: string; maxChargeW: number; maxDischargeW: number; minSocPct: number; maxSocPct: number; maxImportW: number; maxExportW: number; allowGridCharge: boolean; allowGridExport: boolean; commissioned: boolean }
export interface PartnerGrant { appId: PartnerAppId; resourceId: string; permissions: PartnerPermission[] }
export interface PartnerConfig {
  configVersion: number; enabled: boolean; partnerId: string; endpoint: string; credentialRef: string;
  grants: PartnerGrant[];
  arbitrage: { profile: 'household' | 'tradingOnly'; resources: PartnerResource[]; maxCommandSeconds: number };
}
export interface PartnerResponse {
  ok: true; config: PartnerConfig; app: { installed: boolean; enabled: boolean; active: boolean };
  status: { connection: 'disabled' | 'blocked' | 'disconnected' | 'connected'; reason: string; controlAvailable: boolean; revision: number };
  validation: { valid: boolean; errors: Array<{ path: string; code: string; message: string }> };
  preview?: boolean;
}
export interface PartnerPreviewResponse extends Omit<PartnerResponse, 'config'> { config: PartnerConfig | null }
export type PartnerDraftResource = { [K in keyof PartnerResource]: PartnerResource[K] extends number ? number | '' : PartnerResource[K] };
export interface PartnerDraft extends Omit<PartnerConfig, 'arbitrage'> {
  arbitrage: { profile: 'household' | 'tradingOnly'; resources: PartnerDraftResource[]; maxCommandSeconds: number | '' };
}
function fail(): never { throw new Error('Die Partnerdaten sind unvollständig oder ungültig. Bitte Eingaben prüfen oder erneut laden.'); }
function text(value: unknown, max = 256): string { if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) return fail(); return value; }
function bool(value: unknown): boolean { if (typeof value !== 'boolean') return fail(); return value; }
function number(value: unknown, min: number, max: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) return fail();
  return value;
}
function oneOf<T extends string>(value: unknown, values: readonly T[]): T { if (typeof value !== 'string' || !values.includes(value as T)) return fail(); return value as T; }
function list<T>(value: unknown, max: number, parse: (entry: unknown) => T): T[] { if (!Array.isArray(value) || value.length > max) return fail(); return value.map(parse); }

/** Leere Eingaben werden nicht in Null umgewandelt. Grenzen sind W und SoC-Prozent, Laufzeiten Sekunden. */
export function parsePartnerConfig(value: unknown): PartnerConfig {
  if (!isSafeJson(value) || !isRecord(value) || !isRecord(value.arbitrage)) return fail();
  return {
    configVersion: number(value.configVersion, 1, Number.MAX_SAFE_INTEGER, true), enabled: bool(value.enabled),
    partnerId: text(value.partnerId, 128), endpoint: text(value.endpoint, 2048), credentialRef: text(value.credentialRef, 128),
    grants: list(value.grants, 64, row => {
      if (!isRecord(row)) return fail();
      return { appId: oneOf(row.appId, ['arbitrage', 'energyLedger', 'directMarketing']), resourceId: text(row.resourceId, 128), permissions: list(row.permissions, 8, p => oneOf(p, PARTNER_PERMISSIONS)) };
    }),
    arbitrage: {
      profile: oneOf(value.arbitrage.profile, ['household', 'tradingOnly']),
      maxCommandSeconds: number(value.arbitrage.maxCommandSeconds, 1, 60, true),
      resources: list(value.arbitrage.resources, 32, row => {
        if (!isRecord(row)) return fail();
        const result = { id: text(row.id, 128), maxChargeW: number(row.maxChargeW, 0, 100000000, true), maxDischargeW: number(row.maxDischargeW, 0, 100000000, true), minSocPct: number(row.minSocPct, 0, 100), maxSocPct: number(row.maxSocPct, 0, 100), maxImportW: number(row.maxImportW, 0, 100000000, true), maxExportW: number(row.maxExportW, 0, 100000000, true), allowGridCharge: bool(row.allowGridCharge), allowGridExport: bool(row.allowGridExport), commissioned: bool(row.commissioned) };
        if (result.minSocPct >= result.maxSocPct) return fail();
        return result;
      }),
    },
  };
}
/** Nur explizit bestätigte Booleans dürfen die Betriebsanzeige freischalten. Unbekannte Felder bleiben ungenutzt. */
export function parsePartnerResponse(value: unknown): PartnerResponse;
export function parsePartnerResponse(value: unknown, preview: true): PartnerPreviewResponse;
export function parsePartnerResponse(value: unknown, preview = false): PartnerPreviewResponse {
  if (!isSafeJson(value) || !isRecord(value) || value.ok !== true || !isRecord(value.app) || !isRecord(value.status) || !isRecord(value.validation)) return fail();
  return {
    ok: true, config: preview && value.preview === true && value.config === null && value.validation.valid === false ? null : parsePartnerConfig(value.config),
    app: { installed: bool(value.app.installed), enabled: bool(value.app.enabled), active: bool(value.app.active) },
    status: { connection: oneOf(value.status.connection, ['disabled', 'blocked', 'disconnected', 'connected']), reason: text(value.status.reason, 512), controlAvailable: bool(value.status.controlAvailable), revision: number(value.status.revision, 0, Number.MAX_SAFE_INTEGER, true) },
    validation: parsePartnerValidation(value.validation),
    ...(value.preview === undefined ? {} : { preview: bool(value.preview) }),
  };
}

/** Fachliche Prüfhinweise aus Fehlerantworten werden ebenfalls vollständig geprüft. */
export function parsePartnerValidation(value: unknown): PartnerResponse['validation'] {
  if (!isSafeJson(value) || !isRecord(value)) return fail();
  return { valid: bool(value.valid), errors: list(value.errors, 256, row => {
    if (!isRecord(row)) return fail();
    return { path: text(row.path, 512), code: text(row.code, 128), message: text(row.message, 1024) };
  }) };
}
