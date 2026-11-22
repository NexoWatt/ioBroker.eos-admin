/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft unbekannte Werte an NVP-/Dynamic-Grid-Konfigurationsgrenzen und beschreibt die tatsächlich verwendeten Adapter-/HTTP-Verträge.
 * Daten und Wirkung: Fremde JSON-/Objektwerte hinein, nach Formprüfung eingegrenzte Werte hinaus; keine Datenbank-, Netzwerk- oder Geräteschreibzugriffe.
 * Sicherheitsgrenze: Interne Validatorresultate werden vor fachlichem Zugriff geprüft; fehlerhafte Verträge lösen ausschließlich einen internen Fehler aus.
 * Bei Änderungen: Bestehende Entwürfe, CAS, Aliasse, Lizenzgrenzen und sämtliche Installer-/Importwege prüfen; diese Guards ersetzen nicht die fachlichen Validatoren.
 */
export type JsonRecord = Record<string, unknown>;
export type Issue = { path: string; code: string; message: string };
export type EntityRecord = JsonRecord & { id: string };
export type Validation = JsonRecord & {
  valid: boolean; config: unknown; errors: Issue[];
  warnings?: Issue[]; activationErrors?: Issue[]; activeEligible?: boolean;
};
export type DynamicConfig = JsonRecord & {
  configVersion: number; points: EntityRecord[]; storages: EntityRecord[]; pvAssignments: EntityRecord[];
};
export type NvpConfig = JsonRecord & {
  mode: string; operation: string;
  points: (JsonRecord & { measurement: JsonRecord & { stateId: string } })[];
  storages: (EntityRecord & { powerMeasurement: JsonRecord & { stateId: string } })[];
  pvAssignments: EntityRecord[];
};
export type StateObject = JsonRecord & { type: 'state'; common?: JsonRecord };
export type AppState = { installed: boolean; enabled: boolean; active: boolean };
export type BoundaryAdapter = {
  config?: unknown;
  getForeignObjectAsync(id: string): Promise<unknown>;
  _nwNvpTopologyStatus?: unknown;
  _nwDynamicGridStatus?: unknown;
  _nwDynamicGridPvRuntime?: unknown;
  _nwDynamicGridCanonicalTargets?: JsonRecord;
  _nwMeshAppSaveInProgress?: unknown;
  _nwPreviewNvpTopology?(config: unknown): unknown;
  _nwPreviewDynamicGrid?(config: unknown, root: JsonRecord): unknown;
  _nwLicenseAllowsAppId?(id: string): boolean;
  _nwLicenseMaxStorages?(): number;
  _nwPrepareDynamicGridTransition?(root: JsonRecord): Promise<unknown>;
};
export type DynamicAdapter = BoundaryAdapter & {
  nwApplyInstallerPatchToRuntimeConfig(root: JsonRecord, patch: JsonRecord): unknown;
};
export type HttpRequest = { body?: unknown };
export type HttpResponse = {
  setHeader(name: string, value: string): unknown;
  status(code: number): HttpResponse;
  json(value: unknown): unknown;
};
export type HttpHandler = (request: HttpRequest, response: HttpResponse, next?: (error?: unknown) => void) => unknown;
export type HttpApp = {
  get(path: string, ...handlers: HttpHandler[]): unknown;
  post(path: string, ...handlers: HttpHandler[]): unknown;
};
export type SaveHooks<T> = { beginSave(): unknown; endSave(token: unknown): unknown; commit(value: T): Promise<unknown> };

/** Unbekannte Objekte werden erst nach dieser Formprüfung als Dictionary gelesen. */
export function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** Fehlende Teilkonfigurationen liefern ein leeres Dictionary ohne geerbte Schlüssel. */
export function record(value: unknown): JsonRecord {
  if (isRecord(value)) return value;
  const empty: JsonRecord = Object.create(null);
  return empty;
}
export function own(value: unknown, key: string): boolean {
  return isRecord(value) && Object.prototype.hasOwnProperty.call(value, key);
}
export function text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
export function cloneJson(value: unknown): unknown { return JSON.parse(JSON.stringify(value)); }
export function recordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}
export function isIssue(value: unknown): value is Issue {
  return isRecord(value) && typeof value.path === 'string' && typeof value.code === 'string' && typeof value.message === 'string';
}
function isIssues(value: unknown): value is Issue[] { return Array.isArray(value) && value.every(isIssue); }
/** Prüfresultate ohne Konfigurationsobjekt (z. B. Bestands-PV-Abdeckung). */
export function issueResult(value: unknown): Issue[] {
  if (!isRecord(value) || !isIssues(value.errors)) throw new Error('CONFIG_ISSUE_CONTRACT_INVALID');
  return value.errors;
}
function isValidation(value: unknown): value is Validation {
  return isRecord(value) && typeof value.valid === 'boolean' && own(value, 'config') && isIssues(value.errors)
    && (value.warnings === undefined || isIssues(value.warnings))
    && (value.activationErrors === undefined || isIssues(value.activationErrors))
    && (value.activeEligible === undefined || typeof value.activeEligible === 'boolean');
}
/** Zusätzliche interne Vertragsprüfung, keine zweite fachliche Normalisierung. */
export function validationResult(value: unknown): Validation {
  if (!isValidation(value)) throw new Error('CONFIG_VALIDATION_CONTRACT_INVALID');
  return value;
}
function isEntity(value: unknown): value is EntityRecord { return isRecord(value) && typeof value.id === 'string'; }
function isEntities(value: unknown): value is EntityRecord[] { return Array.isArray(value) && value.every(isEntity); }
function isDynamicConfig(value: unknown): value is DynamicConfig {
  return isRecord(value) && typeof value.configVersion === 'number' && Number.isSafeInteger(value.configVersion) && value.configVersion > 0
    && isEntities(value.points) && isEntities(value.storages) && isEntities(value.pvAssignments);
}
export function dynamicConfig(value: unknown): DynamicConfig {
  if (!isDynamicConfig(value)) throw new Error('DYNAMIC_GRID_VALIDATION_CONTRACT_INVALID');
  return value;
}
function isNvpPoint(value: unknown): value is JsonRecord & { measurement: JsonRecord & { stateId: string } } {
  return isRecord(value) && isRecord(value.measurement) && typeof value.measurement.stateId === 'string';
}
function isNvpStorage(value: unknown): value is EntityRecord & { powerMeasurement: JsonRecord & { stateId: string } } {
  return isEntity(value) && isRecord(value.powerMeasurement) && typeof value.powerMeasurement.stateId === 'string';
}
function isNvpConfig(value: unknown): value is NvpConfig {
  return isRecord(value) && typeof value.mode === 'string' && typeof value.operation === 'string'
    && Array.isArray(value.points) && value.points.every(isNvpPoint)
    && Array.isArray(value.storages) && value.storages.every(isNvpStorage) && isEntities(value.pvAssignments);
}
export function nvpConfig(value: unknown): NvpConfig {
  if (!isNvpConfig(value)) throw new Error('NVP_VALIDATION_CONTRACT_INVALID');
  return value;
}
/** ioBroker liefert unbekannte Objektwerte; nur State-Objekte mit Objekt-Metadaten gelten als auflösbar. */
export function stateObject(value: unknown): StateObject | null {
  return isStateObject(value) ? value : null;
}
function isStateObject(value: unknown): value is StateObject {
  return isRecord(value) && value.type === 'state' && (value.common === undefined || isRecord(value.common));
}
