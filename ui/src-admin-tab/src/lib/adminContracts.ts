/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/* Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Nutzung, Änderung und Weitergabe nur mit ausdrücklicher Erlaubnis. */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft native Admin-DTOs an API- und Nachrichtengrenzen vor Änderungen am Formularzustand.
 * Daten und Wirkung: Bewahrt legitime Zusatzfelder, leere Entwurfszahlen und Backend-kompatible Altdaten; führt keine Gerätebefehle aus.
 * Bei Änderungen: Reale Backendantworten, geschützte Formularabläufe und negative Strukturtests gemeinsam prüfen.
 * Fachliche Aktivierungsregeln verbleiben im Backend; fehlerhafte Antworten überschreiben keine Entwürfe.
 */
export type DraftNumber = number | '' | null;
export type Scalar = DraftNumber | boolean;
export interface Measurement { stateId?: string; unit?: string; sign?: DraftNumber; maxAgeMs?: DraftNumber; scale?: DraftNumber }
export interface RootMeasurement extends Measurement { kind?: string; importMeasurement?: Measurement; exportMeasurement?: Measurement }
export interface RootSource { measurement?: RootMeasurement | null; valid?: boolean; reason?: string }
export interface Point { id: string; source?: string; measurement?: Measurement; importLimitW?: DraftNumber | null; exportLimitW?: DraftNumber | null; importReserveW?: DraftNumber; exportReserveW?: DraftNumber }
export interface Output { stateId?: string; scale?: DraftNumber; sign?: DraftNumber; readbackStateId?: string }
export interface SwitchOutput { stateId?: string; readbackStateId?: string; onValue?: Scalar; offValue?: Scalar }
export interface Watchdog { stateId?: string; ttlMs?: DraftNumber; writeValue?: Scalar; readbackStateId?: string; expiryBehavior?: string }
export interface Command { mode?: string; signedTarget?: Output; chargeTarget?: Output; dischargeTarget?: Output; maxCharge?: Output; maxDischarge?: Output; appliedMaxCharge?: Measurement; appliedMaxDischarge?: Measurement; watchdog?: Watchdog; run?: SwitchOutput; chargeEnable?: SwitchOutput; dischargeEnable?: SwitchOutput }
export interface Strategy { targetGridImportW?: DraftNumber; importThresholdW?: DraftNumber; peakLimitW?: DraftNumber }
export interface Availability { stateId?: string; availableValue?: Scalar; maxAgeMs?: DraftNumber }
export interface Storage { id: string; name?: string; connectionPointId?: string; controlPointId?: string; dispatchGroupId?: string; primaryPurpose?: string; authority?: string; powerMeasurement?: Measurement; socMeasurement?: Measurement; maxChargeW?: DraftNumber; maxDischargeW?: DraftNumber; minSoc?: DraftNumber; maxSoc?: DraftNumber; maxDeltaWPerSec?: DraftNumber; configuredToleranceW?: DraftNumber; commandTimeoutMs?: DraftNumber; strategy?: Strategy; command?: Command; availability?: Availability; requestPowerMeasurement?: Measurement }
export interface PvCommand { stateId?: string; unit?: string; scale?: DraftNumber; readbackStateId?: string }
export interface Pv { id: string; connectionPointId?: string; referencePowerW?: DraftNumber; powerMeasurement?: Measurement; command?: PvCommand; evuControl?: boolean }
export interface Topology { schemaVersion?: number; configVersion: number; maxSkewMs?: DraftNumber; points: Point[]; storages: Storage[]; pvAssignments: Pv[] }
export interface AppState { installed: boolean; enabled: boolean }
export interface Issue { path?: string; message?: string; reason?: string; code?: string }
export type Reason = string | Issue;
export interface Validation { valid?: boolean; activeEligible?: boolean; errors?: Reason[]; activationErrors?: Reason[]; warnings?: Reason[] }
export interface Sample { valueW?: number | null; ageMs?: number | null; valid?: boolean; reason?: string }
export interface StorageTelemetry { socPct?: number | null; available?: boolean }
export interface StorageResult { id?: string; requestedW?: number | null; targetW?: number | null; minPowerW?: number | null; maxPowerW?: number | null; commandConfirmed?: boolean; accepted?: boolean; reason?: string }
export interface PendingInterval { id?: string; appliedConfirmed?: boolean; targetW?: number | null }
export interface Group { id: string; connectionPointId?: string; primaryPurpose?: string; authority?: string; requestedW?: number | null; reason?: string; status?: string }
export interface Snapshot { points?: Record<string, Sample>; storages?: Record<string, Sample>; storageTelemetry?: Record<string, StorageTelemetry>; errors?: Reason[] }
export interface LiveState { ts?: number | null; status?: string; configVersion?: number | null; reason?: string; budget?: { reason?: string } | null; snapshot?: Snapshot | null; storageResults?: StorageResult[]; pendingIntervals?: PendingInterval[]; errors?: Reason[]; activationErrors?: Reason[]; groups?: Group[]; writesPerformed?: number | null }
export interface DynamicGridResponse { config?: Topology; app?: AppState; rootSource?: RootSource | null; status?: LiveState | null; validation?: Validation | null; locked?: boolean }
export interface MailConfig { enabled: boolean; host: string; port: number; tlsMode: string; user: string; siteName: string; passwordSet: boolean }

type Guard<T> = (value: unknown) => value is T;
type Shape<T> = { [K in keyof T]-?: Guard<T[K]> };
export const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const text: Guard<string> = (value): value is string => typeof value === 'string';
const number: Guard<number> = (value): value is number => typeof value === 'number' && Number.isFinite(value);
const boolean: Guard<boolean> = (value): value is boolean => typeof value === 'boolean';
const draft: Guard<DraftNumber> = (value): value is DraftNumber => value === null || value === '' || number(value);
const scalar: Guard<Scalar> = (value): value is Scalar => boolean(value) || draft(value);
const optional = <T>(guard: Guard<T>): Guard<T | undefined> => (value): value is T | undefined => value === undefined || guard(value);
const nullable = <T>(guard: Guard<T>): Guard<T | null> => (value): value is T | null => value === null || guard(value);
const array = <T>(guard: Guard<T>): Guard<T[]> => (value): value is T[] => Array.isArray(value) && value.every(guard);
function object<T>(shape: Shape<T>): Guard<T> {
  return (value): value is T => {
    if (!isRecord(value)) return false;
    for (const key in shape) { if (Object.hasOwn(shape, key) && !shape[key](value[key])) return false; }
    return true;
  };
}
const dictionary = <T>(guard: Guard<T>): Guard<Record<string, T>> => (value): value is Record<string, T> => isRecord(value) && Object.keys(value).every(key => !['__proto__', 'prototype', 'constructor'].includes(key) && guard(value[key]));
/** Nur passive JSON-Daten: keine Getter, Prototyp-Schlüssel, Zyklen oder unbeschränkte Strukturen. */
export function isSafeJson(value: unknown): boolean {
  const queue: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  const seen = new Set<object>(); let count = 0;
  while (queue.length) {
    const item = queue.pop(); if (!item || ++count > 50000 || item.depth > 32) return false;
    const current = item.value;
    if (current === null || boolean(current) || number(current)) continue;
    if (text(current)) { if (current.length > 1048576) return false; continue; }
    if (!Array.isArray(current) && !isRecord(current)) return false;
    if (seen.has(current)) return false; seen.add(current);
    const descriptors = Object.getOwnPropertyDescriptors(current);
    for (const key of Object.keys(descriptors)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) return false;
      const descriptor = descriptors[key];
      if (!descriptor || !('value' in descriptor)) return false;
      if (Array.isArray(current) && key === 'length') continue;
      const child: unknown = descriptor.value;
      queue.push({ value: child, depth: item.depth + 1 });
    }
  }
  return true;
}
const measurement = object<Measurement>({ stateId: optional(text), unit: optional(text), sign: optional(draft), maxAgeMs: optional(draft), scale: optional(draft) });
const rootMeasurement = object<RootMeasurement>({ stateId: optional(text), unit: optional(text), sign: optional(draft), maxAgeMs: optional(draft), scale: optional(draft), kind: optional(text), importMeasurement: optional(measurement), exportMeasurement: optional(measurement) });
const rootSource = object<RootSource>({ measurement: optional(nullable(rootMeasurement)), valid: optional(boolean), reason: optional(text) });
const point = object<Point>({ id: text, source: optional(text), measurement: optional(measurement), importLimitW: optional(nullable(draft)), exportLimitW: optional(nullable(draft)), importReserveW: optional(draft), exportReserveW: optional(draft) });
const output = object<Output>({ stateId: optional(text), scale: optional(draft), sign: optional(draft), readbackStateId: optional(text) });
const switchOutput = object<SwitchOutput>({ stateId: optional(text), readbackStateId: optional(text), onValue: optional(scalar), offValue: optional(scalar) });
const watchdog = object<Watchdog>({ stateId: optional(text), ttlMs: optional(draft), writeValue: optional(scalar), readbackStateId: optional(text), expiryBehavior: optional(text) });
const command = object<Command>({ mode: optional(text), signedTarget: optional(output), chargeTarget: optional(output), dischargeTarget: optional(output), maxCharge: optional(output), maxDischarge: optional(output), appliedMaxCharge: optional(measurement), appliedMaxDischarge: optional(measurement), watchdog: optional(watchdog), run: optional(switchOutput), chargeEnable: optional(switchOutput), dischargeEnable: optional(switchOutput) });
const strategy = object<Strategy>({ targetGridImportW: optional(draft), importThresholdW: optional(draft), peakLimitW: optional(draft) });
const availability = object<Availability>({ stateId: optional(text), availableValue: optional(scalar), maxAgeMs: optional(draft) });
const storage = object<Storage>({ id: text, name: optional(text), connectionPointId: optional(text), controlPointId: optional(text), dispatchGroupId: optional(text), primaryPurpose: optional(text), authority: optional(text), powerMeasurement: optional(measurement), socMeasurement: optional(measurement), maxChargeW: optional(draft), maxDischargeW: optional(draft), minSoc: optional(draft), maxSoc: optional(draft), maxDeltaWPerSec: optional(draft), configuredToleranceW: optional(draft), commandTimeoutMs: optional(draft), strategy: optional(strategy), command: optional(command), availability: optional(availability), requestPowerMeasurement: optional(measurement) });
const pvCommand = object<PvCommand>({ stateId: optional(text), unit: optional(text), scale: optional(draft), readbackStateId: optional(text) });
const pv = object<Pv>({ id: text, connectionPointId: optional(text), referencePowerW: optional(draft), powerMeasurement: optional(measurement), command: optional(pvCommand), evuControl: optional(boolean) });
const topology = object<Topology>({ schemaVersion: optional(number), configVersion: number, maxSkewMs: optional(draft), points: array(point), storages: array(storage), pvAssignments: array(pv) });
const app = object<AppState>({ installed: boolean, enabled: boolean });
const issue = object<Issue>({ path: optional(text), message: optional(text), reason: optional(text), code: optional(text) });
const reason: Guard<Reason> = (value): value is Reason => text(value) || issue(value);
const validation = object<Validation>({ valid: optional(boolean), activeEligible: optional(boolean), errors: optional(array(reason)), activationErrors: optional(array(reason)), warnings: optional(array(reason)) });
const sample = object<Sample>({ valueW: optional(nullable(number)), ageMs: optional(nullable(number)), valid: optional(boolean), reason: optional(text) });
const telemetry = object<StorageTelemetry>({ socPct: optional(nullable(number)), available: optional(boolean) });
const result = object<StorageResult>({ id: optional(text), requestedW: optional(nullable(number)), targetW: optional(nullable(number)), minPowerW: optional(nullable(number)), maxPowerW: optional(nullable(number)), commandConfirmed: optional(boolean), accepted: optional(boolean), reason: optional(text) });
const pending = object<PendingInterval>({ id: optional(text), appliedConfirmed: optional(boolean), targetW: optional(nullable(number)) });
const group = object<Group>({ id: text, connectionPointId: optional(text), primaryPurpose: optional(text), authority: optional(text), requestedW: optional(nullable(number)), reason: optional(text), status: optional(text) });
const snapshot = object<Snapshot>({ points: optional(dictionary(sample)), storages: optional(dictionary(sample)), storageTelemetry: optional(dictionary(telemetry)), errors: optional(array(reason)) });
const live = object<LiveState>({ ts: optional(nullable(number)), status: optional(text), configVersion: optional(nullable(number)), reason: optional(text), budget: optional(nullable(object<{ reason?: string }>({ reason: optional(text) }))), snapshot: optional(nullable(snapshot)), storageResults: optional(array(result)), pendingIntervals: optional(array(pending)), errors: optional(array(reason)), activationErrors: optional(array(reason)), groups: optional(array(group)), writesPerformed: optional(nullable(number)) });
const response = object<DynamicGridResponse>({ config: optional(topology), app: optional(app), rootSource: optional(nullable(rootSource)), status: optional(nullable(live)), validation: optional(nullable(validation)), locked: optional(boolean) });
export function parseDynamicGridResponse(value: unknown, requireConfiguration = true): DynamicGridResponse {
  if (!isSafeJson(value) || !response(value)) throw new Error('Ungültige Antwort der Netzanschluss-API. Der Entwurf bleibt erhalten.');
  if (requireConfiguration && (!value.config || !value.app)) throw new Error('Unvollständige Antwort der Netzanschluss-API. Der Entwurf bleibt erhalten.');
  if (value.config && (!Number.isSafeInteger(value.config.configVersion) || value.config.configVersion < 1 || value.config.points.length !== 2 || !value.config.points.some(point => point.id === 'M0') || !value.config.points.some(point => point.id === 'M1'))) throw new Error('Ungültige Messstruktur der Netzanschluss-API.');
  return value;
}
export function parseValidation(value: unknown): Validation | null {
  return isSafeJson(value) && validation(value) ? value : null;
}
export function parseValidationDetails(value: unknown): Validation | null {
  return isSafeJson(value) && array(reason)(value) ? { valid: false, errors: value } : null;
}
const mail = object<MailConfig>({ enabled: boolean, host: text, port: number, tlsMode: text, user: text, siteName: text, passwordSet: boolean });
export function parseMailResponse(value: unknown): MailConfig {
  if (!isSafeJson(value) || !isRecord(value) || !mail(value.config) || !Number.isInteger(value.config.port) || value.config.port < 1 || value.config.port > 65535 || !['tls', 'starttls'].includes(value.config.tlsMode)) throw new Error('Ungültige Antwort der E-Mail-Konfiguration.');
  return value.config;
}
