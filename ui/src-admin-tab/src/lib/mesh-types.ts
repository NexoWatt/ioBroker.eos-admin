/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Nutzung, Modifikation oder Verbreitung ohne ausdrückliche Erlaubnis ist untersagt.
 */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft Mesh-API-Daten und importierte Paarungen vor der Formularverwendung.
 * Daten und Wirkung: Native, begrenzte JSON-Prüfung; unbekannte Archivfelder bleiben
 * für den Originalexport erhalten. Fachliche Freigaben prüft weiterhin das Backend.
 * Bei Änderungen: Backend-Verträge, leere Formularzahlen und Archivexport mitprüfen.
 */
type Decoder<T> = (value: unknown) => T;
const invalid = (): never => { throw new Error('Ungültige Mesh-Daten. Bitte Verbindung und Konfiguration prüfen.'); };
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid();
  return value as Record<string, unknown>;
}
const text: Decoder<string> = value => typeof value === 'string' && value.length <= 16384 ? value : invalid();
const number: Decoder<number> = value => typeof value === 'number' && Number.isFinite(value) ? value : invalid();
const bool: Decoder<boolean> = value => typeof value === 'boolean' ? value : invalid();
const nullable = <T,>(decode: Decoder<T>): Decoder<T | null> => value => value == null ? null : decode(value);
const optional = <T,>(decode: Decoder<T>, fallback: T): Decoder<T> => value => value === undefined ? fallback : decode(value);
const list = <T,>(decode: Decoder<T>, max = 10000): Decoder<T[]> => value => Array.isArray(value) && value.length <= max ? value.map((item: unknown) => decode(item)) : invalid();
const choice = <T extends string>(...allowed: T[]): Decoder<T> => value => {
  for (const option of allowed) if (value === option) return option;
  return invalid();
};
type Decoded<S> = { [K in keyof S]: S[K] extends Decoder<infer T> ? T : never };
function shape<S extends Record<string, Decoder<unknown>>>(schema: S): Decoder<Decoded<S>> {
  // Schlüssel stammen ausschließlich aus internen Schemata; kein Fremdschlüssel
  // wird in ein Objekt mit Prototyp übernommen. Jeder Wert wird geprüft.
  return value => {
    const source = record(value);
    const output: Record<string, unknown> = Object.create(null);
    for (const [key, decode] of Object.entries(schema)) output[key] = decode(source[key]);
    return output as Decoded<S>;
  };
}
/** Auch lokale JSON-Importe haben dieselbe begrenzte Vertrauensgrenze wie HTTP. */
function safeTree(value: unknown, depth = 0, budget = { remaining: 200000 }): void {
  if (--budget.remaining < 0 || depth > 24) invalid();
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') { text(value); return; }
  if (typeof value === 'number') { number(value); return; }
  if (Array.isArray(value)) {
    if (value.length > 10000) invalid();
    for (const item of value) safeTree(item, depth + 1, budget);
    return;
  }
  for (const [key, item] of Object.entries(record(value))) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') invalid();
    safeTree(item, depth + 1, budget);
  }
}
function boundary<T>(decode: Decoder<T>): Decoder<T> {
  return value => { safeTree(value); return decode(value); };
}
export const limitKeys = ['importW', 'exportW', 'l1A', 'l2A', 'l3A', 'evW', 'chargeW', 'dischargeW', 'pvW', 'flexW'] as const;
export const networkKeys = ['importW', 'exportW', 'l1A', 'l2A', 'l3A'] as const;
export type LimitKey = typeof limitKeys[number];
const network = shape({ importW: number, exportW: number, l1A: number, l2A: number, l3A: number });
const limits = shape({ importW: number, exportW: number, l1A: number, l2A: number, l3A: number, evW: number, chargeW: number, dischargeW: number, pvW: number, flexW: number });
const groupSchema = { limit: network, reserve: network, unmonitored: network };
const group = shape(groupSchema);
const node = shape({ id: text, name: text, branch: text, max: limits, fallback: limits, weight: number, commissioned: bool, watchdogVerified: bool });
const allocation = shape({ strategy: choice('fixed', 'transformer'), headroomW: number, headroomA: number, engagePct: number, releasePct: number });
const feedback = shape({ evW: optional(text, ''), chargeW: optional(text, ''), dischargeW: optional(text, ''), pvW: optional(text, ''), flexW: optional(text, '') });
const siteFeedback = shape({ gridW: optional(text, ''), l1A: optional(text, ''), l2A: optional(text, ''), l3A: optional(text, '') });
const meter = shape({ id: text, epoch: text, importDp: text, exportDp: text, unit: choice('Wh', 'kWh') });
const decodeConfig = shape({
  role: choice('off', 'master', 'slave'), mode: choice('diagnostic', 'active'), siteId: text, nodeId: text, masterId: text,
  revision: number, intervalMs: number, requestTimeoutMs: number, leaseMs: number, staleMs: number, recoveryCycles: number, rampWPerSecond: number,
  allocation, masterUrl: text, localParticipates: bool, nodes: list(node, 99), branches: list(shape({ id: text, ...groupSchema }), 100),
  local: node, site: group, feedback, siteFeedback,
  meter: shape({ id: text, epoch: text, importDp: text, exportDp: text, unit: choice('Wh', 'kWh'), archiveIntervalMs: number }),
});
/** Leere Zahlen bleiben während der Bearbeitung möglich; die API akzeptiert nur Zahlen. */
type Draft<T> = T extends number ? number | '' : T extends Array<infer U> ? Draft<U>[] : T extends object ? { [K in keyof T]: Draft<T[K]> } : T;
export type MeshConfig = Draft<ReturnType<typeof decodeConfig>>;
export type MeshNode = Draft<ReturnType<typeof node>>;
export type MeshGroup = Draft<ReturnType<typeof group>>;
export type DraftNumber = number | '';
const operating = shape({ importW: number, exportW: number, strategy: (value: unknown) => value === undefined ? undefined : choice('fixed', 'transformer')(value) });
export type OperatingLimits = Draft<ReturnType<typeof operating>>;
export const parseOperating = boundary(operating);
const decodeRecord = (value: unknown) => {
  const source = record(value);
  const fields = shape({ seq: number, at: text, stream: text, meter, quality: text, importMilliWh: nullable(number), exportMilliWh: nullable(number), sourceAt: list(nullable(number), 2) })(value);
  if (!Number.isSafeInteger(fields.seq) || fields.seq < 1 || !Number.isFinite(Date.parse(fields.at))) invalid();
  // Zusatzfelder (Hash, Empfang, Intervall usw.) bleiben in Originalexporten erhalten.
  return { ...source, ...fields, meter: { ...record(source.meter), ...fields.meter } };
};
export type EnergyRecord = ReturnType<typeof decodeRecord>;
const accountingStatus = shape({
  error: optional(text, ''), local: nullable(shape({ sequence: number })), pending: number, lastSync: nullable(text), meterQuality: text,
  nodes: list(shape({ id: text, name: text, last: nullable(decodeRecord), receivedAt: nullable(text), failure: optional(text, ''), sequence: optional(number, 0) }), 100),
});
const masterStatus = shape({
  controlMode: text, state: text, reason: text,
  operatorLimits: nullable(operating),
  siteMeasurement: nullable(shape({ gridW: nullable(number), ageMs: nullable(number), phaseA: nullable(list(nullable(number), 3)) })),
  nodes: list(shape({ id: text, name: text, online: bool, ageMs: nullable(number), rttMs: nullable(number), confirmed: bool,
    sample: nullable(shape({ gridW: number })), allowed: limits, reserved: limits }), 100),
});
const decodeStatus = shape({ master: nullable(masterStatus), local: nullable(shape({ state: optional(text, ''), reason: optional(text, ''), remainingMs: optional(number, 0) })),
  timing: shape({ lastRttMs: nullable(number), p95RttMs: nullable(number) }), error: text, accounting: accountingStatus });
export type MeshStatus = ReturnType<typeof decodeStatus>;
const app = shape({ enabled: bool });
export type MeshApp = ReturnType<typeof app>;
const publicConfig = { app, config: decodeConfig, pairedNodes: list(text, 99), locked: bool };
export const parseMeshConfigResponse = boundary(shape(publicConfig));
export const parseMeshResponse = boundary(shape({ ...publicConfig, status: decodeStatus }));
const pairBundle = shape({ config: decodeConfig, pairingKey: text });
export const parsePairBundle = boundary((value: unknown) => {
  const result = pairBundle(value);
  if (result.config.role !== 'slave' || !/^[A-Za-z0-9_-]{43}$/.test(result.pairingKey)) invalid();
  return result;
});
export function parsePairImport(value: string): ReturnType<typeof pairBundle> {
  if (value.length > 1048576) invalid();
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { return invalid(); }
  return parsePairBundle(parsed);
}
const tariff = shape({ importEuroKwh: number, exportEuroKwh: number, periodFeeEuro: number });
const decodeAccounting = shape({ enabled: bool, intervalMs: number, maxAgeMs: number, maxSkewMs: number, maxArchiveMB: number, operatorName: text, tariff,
  meter: shape({ id: text, epoch: text, importDp: text, exportDp: text, unit: choice('Wh', 'kWh'), calibrated: bool, calibrationUntil: text }) });
export type AccountingConfig = Draft<ReturnType<typeof decodeAccounting>>;
export const parseAccountingResponse = boundary(shape({ config: decodeAccounting }));
export const parseRecords = boundary(shape({ lastSequence: number, records: list(decodeRecord) }));
export const parseReport = boundary((value: unknown) => {
  const fields = shape({ nodeId: text, name: text, operatorName: text, status: choice('BLOCKED', 'PARTIAL_PERIOD', 'DRAFT'),
    requested: shape({ from: text, to: text }), measured: shape({ from: nullable(text), to: nullable(text) }), first: nullable(decodeRecord), last: nullable(decodeRecord),
    count: number, invalid: number, gaps: number, importKwh: nullable(number), exportKwh: nullable(number),
    amounts: nullable(shape({ importCents: number, exportCents: number, periodFeeCents: number, balanceCents: number })),
    note: text, periodFeePending: bool, usable: bool, boundaryComplete: bool, generatedAt: text })(value);
  if (fields.usable && (!fields.amounts || !fields.first || !fields.last || !fields.measured.from || !fields.measured.to)) invalid();
  return { ...record(value), ...fields };
});
export type AccountingReport = ReturnType<typeof parseReport>;
