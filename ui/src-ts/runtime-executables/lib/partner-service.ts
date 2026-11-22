/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Vermittelt explizit freigegebene Daten und kurzlebige Speicherwünsche für genau einen Partner.
 * Daten und Wirkung: JSON hinein, begrenzte Projektionen/Quittungen hinaus; persistiert Replayjournal vor Annahme.
 * Sicherheitsgrenze: Keine Geräteschreibrechte; der zentrale Writer fragt Wünsche erneut mit getCurrentRequest ab.
 * Bei Änderungen: Widerruf während await, Neustart, Journalfehler, Quoten und tatsächlich aktive Apps testen.
 * Verknüpfungen: partner-contracts.ts, partner-config-api.ts, partner-websocket.ts, arbitrage-control.ts.
 */
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { PARTNER_PROTOCOL, partnerRecord, partnerKeys, partnerId, partnerInteger, partnerNumber, isPartnerAppId, validatePartnerConfig } from './partner-contracts';
import type { PartnerAppId, PartnerConfig, PartnerPermission, PartnerRecord, StorageRequest } from './partner-contracts';
export type PartnerDataKind = 'balance' | 'telemetry' | 'capabilities';
export type PartnerJournalEntry = { id: string; fingerprint: string; partnerId: string; resourceId: string; issuedAt: number; expiresAt: number; acceptedAt: number; configVersion: number; status: 'accepted' | 'cancelled' };
export type PartnerStatus = { connection: 'disabled' | 'blocked' | 'disconnected' | 'connected'; reason: string; controlAvailable: boolean; revision: number };
export type PartnerServiceHooks = {
  loadJournal(): Promise<unknown>;
  persistJournal(entries: PartnerJournalEntry[]): Promise<void>;
  isAppActive(appId: PartnerAppId): boolean;
  controlAvailable(): boolean;
  isResourceAvailable(resourceId: string): boolean;
  readData(appId: PartnerAppId, resourceId: string, kind: PartnerDataKind, signal: AbortSignal): Promise<unknown>;
  now?: () => number;
  monotonicNow?: () => number;
};
const MAX_JOURNAL = 2048;
// Zehn Minuten überdecken die 60-s-Lease und 10-s-Zukunftstoleranz; ältere Nachrichten sind ungültig.
const RETENTION_MS = 10 * 60 * 1000;
const BALANCE_FIELDS = ['intervalCount', 'completeIntervalCount', 'evcsTotalKwh', 'pvDirectKwh', 'otherRenewableDirectKwh', 'storedPvKwh', 'storedOtherRenewableKwh', 'gridDirectKwh', 'storedGridKwh', 'unknownKwh', 'operationalRenewableKwh', 'deCandidateRenewableKwh', 'nlCandidateRenewableKwh'] as const;
/** Beschränkt alle Daten auf primitive, benannte Fachwerte; interne Konfiguration bleibt im EOS. */
export function projectPartnerData(kind: PartnerDataKind, input: unknown): PartnerRecord {
  const output: PartnerRecord = Object.create(null);
  if (!partnerRecord(input)) return output;
  if (kind === 'balance') {
    const summary = partnerRecord(input.summary) ? input.summary : input;
    for (const key of BALANCE_FIELDS) if (partnerNumber(summary[key], 0, 1e15)) output[key] = summary[key];
    for (const key of ['periodStartMs', 'periodEndMs', 'updatedAtMs']) if (partnerInteger(input[key], 0, Number.MAX_SAFE_INTEGER)) output[key] = input[key];
  } else if (kind === 'telemetry') {
    for (const key of ['powerW', 'gridPowerW']) if (partnerNumber(input[key], -1e9, 1e9)) output[key] = input[key];
    if (partnerNumber(input.socPct, 0, 100)) output.socPct = input.socPct;
    if (partnerInteger(input.updatedAtMs, 0, Number.MAX_SAFE_INTEGER)) output.updatedAtMs = input.updatedAtMs;
    if (typeof input.available === 'boolean') output.available = input.available;
  } else {
    for (const key of ['maxChargeW', 'maxDischargeW', 'maxCurtailmentW']) if (partnerNumber(input[key], 0, 1e9)) output[key] = input[key];
    for (const key of ['chargeSupported', 'dischargeSupported', 'curtailmentSupported']) if (typeof input[key] === 'boolean') output[key] = input[key];
  }
  return output;
}
/** Journal aus geschützter Persistenz prüfen; fremde/defekte Einträge sperren die gesamte Verbindung. */
function parseJournal(input: unknown): PartnerJournalEntry[] {
  if (!Array.isArray(input) || input.length > MAX_JOURNAL) throw new Error('JOURNAL_INVALID');
  const out: PartnerJournalEntry[] = [];
  for (const value of input) {
    if (!partnerRecord(value) || !partnerKeys(value, ['id', 'fingerprint', 'partnerId', 'resourceId', 'issuedAt', 'expiresAt', 'acceptedAt', 'configVersion', 'status']) || !partnerId(value.id) || !partnerId(value.partnerId) || !partnerId(value.resourceId) || typeof value.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(value.fingerprint) || !partnerInteger(value.issuedAt, 0, Number.MAX_SAFE_INTEGER) || !partnerInteger(value.expiresAt, value.issuedAt, Number.MAX_SAFE_INTEGER) || !partnerInteger(value.acceptedAt, 0, Number.MAX_SAFE_INTEGER) || !partnerInteger(value.configVersion, 1, Number.MAX_SAFE_INTEGER) || (value.status !== 'accepted' && value.status !== 'cancelled') || out.some(entry => entry.partnerId === value.partnerId && entry.id === value.id)) throw new Error('JOURNAL_INVALID');
    out.push({ id: value.id, fingerprint: value.fingerprint, partnerId: value.partnerId, resourceId: value.resourceId, issuedAt: value.issuedAt, expiresAt: value.expiresAt, acceptedAt: value.acceptedAt, configVersion: value.configVersion, status: value.status });
  }
  return out;
}
/** Sicherheitszustand eines einzelnen Partnerprofils; Instanzen besitzen keine Hardwarezugriffe. */
export class PartnerIntegrationService {
  private config: PartnerConfig;
  private readonly hooks: PartnerServiceHooks;
  private journal: PartnerJournalEntry[] = [];
  private current = new Map<string, StorageRequest>();
  private deadlines = new Map<string, number>();
  private ready = false;
  private invalidated = false;
  private epoch = 0;
  private serial: Promise<void> = Promise.resolve();
  private state: PartnerStatus['connection'] = 'disconnected';
  private reason = 'NOT_CONNECTED';
  private receivedAt: number[] = [];
  constructor(config: PartnerConfig, hooks: PartnerServiceHooks) {
    const validation = validatePartnerConfig(config);
    if (!validation.config) throw new Error('PARTNER_CONFIG_INVALID');
    this.config = validation.config; this.hooks = hooks;
  }
  /** Neustarts laden ausschließlich Replaykennungen; frühere Steuerwünsche werden niemals reaktiviert. */
  async initialize(): Promise<void> {
    try { this.journal = parseJournal(await this.hooks.loadJournal()); this.ready = true; }
    catch { this.ready = false; this.invalidate('JOURNAL_UNAVAILABLE'); }
  }
  private now(): number { return this.hooks.now ? this.hooks.now() : Date.now(); }
  private monotonicNow(): number { return this.hooks.monotonicNow ? this.hooks.monotonicNow() : performance.now(); }
  /** Neue Konfiguration widerruft synchron alle alten Wünsche vor einem möglichen neuen Verbindungsaufbau. */
  updateConfig(config: PartnerConfig): void {
    const result = validatePartnerConfig(config);
    this.invalidate('CONFIG_CHANGED');
    if (!result.config) return;
    this.config = result.config; this.invalidated = false; this.state = 'disconnected'; this.reason = 'NOT_CONNECTED';
  }
  /** Widerruf ist synchron; laufende await-Fortsetzungen erkennen zusätzlich die geänderte Epoche. */
  invalidate(reason = 'REVOKED'): void { this.epoch++; this.invalidated = true; this.current.clear(); this.deadlines.clear(); this.state = 'blocked'; this.reason = reason; }
  /** Transport und jeder Schreib-/Lesewunsch müssen diese aktuelle Freigabe erneut prüfen. */
  authorize(): boolean { return this.ready && !this.invalidated && this.config.enabled; }
  private permitted(appId: PartnerAppId, resourceId: string, permission: PartnerPermission): boolean {
    return this.authorize() && this.hooks.isAppActive(appId) && this.config.grants.some(grant => grant.appId === appId && grant.resourceId === resourceId && grant.permissions.includes(permission));
  }
  /** Zentraler Writer erhält eine Kopie, niemals einen persistierten oder widerrufenen Altauftrag. */
  getCurrentRequest(resourceId: string): StorageRequest | null {
    const request = this.current.get(resourceId);
    if (!request) return null;
    const permission = request.action === 'charge' ? 'storage.charge.request' : 'storage.discharge.request';
    if (!this.permitted('arbitrage', resourceId, permission) || !this.hooks.isResourceAvailable(resourceId) || !this.hooks.controlAvailable() || request.configVersion !== this.config.configVersion || request.partnerId !== this.config.partnerId || request.expiresAt <= this.now() || this.monotonicNow() >= (this.deadlines.get(resourceId) ?? -Infinity)) { this.current.delete(resourceId); this.deadlines.delete(resourceId); return null; }
    return { ...request };
  }
  /** Transportstatus ist rein diagnostisch; ein Verbindungsabbruch verwirft alle Wünsche. */
  setConnection(state: string, code: string): void {
    if (state === 'connected' || state === 'open') { this.state = 'connected'; this.reason = 'CONNECTED'; }
    else { this.current.clear(); this.deadlines.clear(); this.epoch++; this.state = 'disconnected'; this.reason = /^[A-Z0-9_]{1,80}$/.test(code) ? code : 'NOT_CONNECTED'; }
  }
  snapshot(): PartnerStatus {
    const controlAvailable = this.hooks.controlAvailable();
    return { connection: !this.config.enabled ? 'disabled' : !this.ready || this.invalidated ? 'blocked' : this.state, reason: !this.config.enabled ? 'DISABLED' : !this.ready ? 'JOURNAL_UNAVAILABLE' : this.reason, controlAvailable, revision: this.config.configVersion };
  }
  private reply(id: string | null, ok: boolean, code: string, extra: PartnerRecord = {}): string { return JSON.stringify({ protocol: PARTNER_PROTOCOL, id, ok, code, ...extra }); }
  /** Protokollarbeit wird serialisiert und auf 60 Nachrichten/min begrenzt; unbekannte Felder scheitern geschlossen. */
  async handleMessage(partnerIdFromTransport: string, text: string): Promise<string> {
    if (Buffer.byteLength(text, 'utf8') > 65536) return this.reply(null, false, 'MESSAGE_TOO_LARGE');
    const now = this.now(); this.receivedAt = this.receivedAt.filter(at => now - at < 60000);
    if (this.receivedAt.length >= 60) return this.reply(null, false, 'RATE_LIMITED');
    this.receivedAt.push(now);
    let value: unknown;
    try { value = JSON.parse(text); } catch { return this.reply(null, false, 'INVALID_JSON'); }
    if (!partnerRecord(value) || value.protocol !== PARTNER_PROTOCOL || !partnerId(value.id) || !partnerId(value.resourceId) || typeof value.type !== 'string') return this.reply(null, false, 'INVALID_MESSAGE');
    const message = value; const id = value.id;
    const enqueueEpoch = this.epoch;
    const operation = this.serial.then(async () => {
      if (enqueueEpoch !== this.epoch) return this.reply(id, false, 'REVOKED');
      if (!this.authorize() || partnerIdFromTransport !== this.config.partnerId) return this.reply(id, false, 'NOT_AUTHORIZED');
      try { return await this.process(message); } catch { return this.reply(id, false, 'OPERATION_UNAVAILABLE'); }
    });
    this.serial = operation.then(() => undefined, () => undefined);
    return operation;
  }
  /** Einzelanfragen benutzen feste Fachoperationen; Roh-State-IDs und Zeitpläne existieren im Vertrag nicht. */
  private async process(message: PartnerRecord): Promise<string> {
    const id = message.id as string; const resourceId = message.resourceId as string;
    if (message.type === 'data.read') {
      if (!partnerKeys(message, ['protocol', 'id', 'type', 'appId', 'resourceId', 'kind']) || !isPartnerAppId(message.appId) || !['balance', 'telemetry', 'capabilities'].includes(String(message.kind))) return this.reply(id, false, 'INVALID_MESSAGE');
      const appId = message.appId; const kind = message.kind as PartnerDataKind;
      const permission: PartnerPermission = kind === 'balance' ? 'balance.read' : kind === 'telemetry' ? 'telemetry.read' : 'capabilities.read';
      if (!this.permitted(appId, resourceId, permission)) return this.reply(id, false, 'NOT_AUTHORIZED');
      const epoch = this.epoch;
      const data = projectPartnerData(kind, await this.readBounded(appId, resourceId, kind));
      if (epoch !== this.epoch || !this.permitted(appId, resourceId, permission)) return this.reply(id, false, 'REVOKED');
      return this.reply(id, true, 'DATA', { appId, resourceId, kind, data });
    }
    if (message.type === 'curtailment.request') return this.reply(id, false, 'CONTROL_UNAVAILABLE');
    if (message.type === 'dispatch.status') {
      if (!partnerKeys(message, ['protocol', 'id', 'type', 'appId', 'resourceId']) || message.appId !== 'arbitrage') return this.reply(id, false, 'INVALID_MESSAGE');
      if (!this.permitted('arbitrage', resourceId, 'dispatch.status.read')) return this.reply(id, false, 'NOT_AUTHORIZED');
      const request = this.getCurrentRequest(resourceId);
      return this.reply(id, true, 'STATUS', { resourceId, status: request ? 'accepted' : 'idle', commandId: request?.id ?? null, deviceAcknowledged: false });
    }
    if (message.type === 'dispatch.cancel') return this.cancel(message);
    if (message.type !== 'storage.dispatch') return this.reply(id, false, 'UNSUPPORTED_MESSAGE');
    if (!partnerKeys(message, ['protocol', 'id', 'type', 'appId', 'resourceId', 'action', 'powerW', 'issuedAt', 'expiresAt', 'configVersion']) || message.appId !== 'arbitrage' || (message.action !== 'charge' && message.action !== 'discharge') || !partnerNumber(message.powerW, 0.001, 1e8) || !partnerInteger(message.issuedAt, 0, Number.MAX_SAFE_INTEGER) || !partnerInteger(message.expiresAt, 0, Number.MAX_SAFE_INTEGER) || message.configVersion !== this.config.configVersion) return this.reply(id, false, 'INVALID_MESSAGE');
    const now = this.now();
    if (message.issuedAt > now + 10000 || message.issuedAt < now - 300000 || message.expiresAt <= now || message.expiresAt <= message.issuedAt || message.expiresAt - message.issuedAt > this.config.arbitrage.maxCommandSeconds * 1000) return this.reply(id, false, 'COMMAND_EXPIRED');
    const permission = message.action === 'charge' ? 'storage.charge.request' : 'storage.discharge.request';
    if (!this.permitted('arbitrage', resourceId, permission)) return this.reply(id, false, 'NOT_AUTHORIZED');
    if (!this.hooks.controlAvailable()) return this.reply(id, false, 'CONTROL_UNAVAILABLE');
    if (!this.hooks.isResourceAvailable(resourceId)) return this.reply(id, false, 'RESOURCE_UNAVAILABLE');
    const resource = this.config.arbitrage.resources.find(item => item.id === resourceId);
    if (!resource || !resource.commissioned || message.powerW > (message.action === 'charge' ? resource.maxChargeW : resource.maxDischargeW)) return this.reply(id, false, 'LIMIT_EXCEEDED');
    const request: StorageRequest = { id, resourceId, action: message.action, powerW: message.powerW, issuedAt: message.issuedAt, expiresAt: message.expiresAt, configVersion: this.config.configVersion, partnerId: this.config.partnerId };
    const fingerprint = createHash('sha256').update(JSON.stringify(request)).digest('hex');
    const previous = this.journal.find(entry => entry.partnerId === this.config.partnerId && entry.id === id);
    if (previous) return this.reply(id, previous.fingerprint === fingerprint, previous.fingerprint === fingerprint ? 'DUPLICATE' : 'ID_CONFLICT', { duplicate: true, status: previous.status, deviceAcknowledged: false });
    // Bereits angenommene neuere Wünsche bilden auch nach Neustart eine persistente Reihenfolgesperre.
    if (this.journal.some(entry => entry.partnerId === request.partnerId && entry.resourceId === resourceId && entry.issuedAt >= request.issuedAt)) return this.reply(id, false, 'OUT_OF_ORDER');
    const entries = this.journal.filter(entry => now - entry.acceptedAt < RETENTION_MS || entry.expiresAt > now);
    if (entries.length >= MAX_JOURNAL) return this.reply(id, false, 'JOURNAL_FULL');
    const epoch = this.epoch;
    const next: PartnerJournalEntry[] = [...entries, { id, fingerprint, partnerId: request.partnerId, resourceId, issuedAt: request.issuedAt, expiresAt: request.expiresAt, acceptedAt: now, configVersion: request.configVersion, status: 'accepted' }];
    try { await this.hooks.persistJournal(next.map(entry => ({ ...entry }))); }
    catch { this.ready = false; this.invalidate('JOURNAL_UNAVAILABLE'); return this.reply(id, false, 'JOURNAL_UNAVAILABLE'); }
    this.journal = next;
    if (epoch !== this.epoch || !this.permitted('arbitrage', resourceId, permission) || request.expiresAt <= this.now() || !this.hooks.isResourceAvailable(resourceId) || !this.hooks.controlAvailable()) return this.reply(id, false, 'REVOKED');
    this.current.set(resourceId, request);
    this.deadlines.set(resourceId, this.monotonicNow() + Math.min(request.expiresAt - this.now(), this.config.arbitrage.maxCommandSeconds * 1000));
    return this.reply(id, true, 'ACCEPTED', { status: 'accepted', expiresAt: request.expiresAt, deviceAcknowledged: false });
  }
  /** Datenabfragen erhalten ein echtes Abbruchsignal und blockieren die serielle Steuerung höchstens fünf Sekunden. */
  private async readBounded(appId: PartnerAppId, resourceId: string, kind: PartnerDataKind): Promise<unknown> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('READ_TIMEOUT')); }, 5000); });
      return await Promise.race([this.hooks.readData(appId, resourceId, kind, controller.signal), timeout]);
    } finally { if (timer) clearTimeout(timer); controller.abort(); }
  }
  /** Abbruch entfernt zuerst den Wunsch; Persistenzfehler können keinen Altauftrag wieder aktivieren. */
  private async cancel(message: PartnerRecord): Promise<string> {
    const id = message.id as string; const resourceId = message.resourceId as string;
    if (!partnerKeys(message, ['protocol', 'id', 'type', 'appId', 'resourceId', 'commandId']) || message.appId !== 'arbitrage' || !partnerId(message.commandId)) return this.reply(id, false, 'INVALID_MESSAGE');
    if (!this.permitted('arbitrage', resourceId, 'dispatch.cancel')) return this.reply(id, false, 'NOT_AUTHORIZED');
    const current = this.getCurrentRequest(resourceId);
    if (!current || current.id !== message.commandId) return this.reply(id, false, 'COMMAND_NOT_ACTIVE');
    this.current.delete(resourceId); this.deadlines.delete(resourceId);
    const epoch = this.epoch;
    const next = this.journal.map(entry => entry.partnerId === this.config.partnerId && entry.id === message.commandId ? { ...entry, status: 'cancelled' as const } : { ...entry });
    try { await this.hooks.persistJournal(next); this.journal = next; }
    catch { this.ready = false; this.invalidate('JOURNAL_UNAVAILABLE'); return this.reply(id, false, 'JOURNAL_UNAVAILABLE'); }
    if (epoch !== this.epoch || !this.permitted('arbitrage', resourceId, 'dispatch.cancel')) return this.reply(id, false, 'REVOKED');
    return this.reply(id, true, 'CANCELLED', { deviceAcknowledged: false });
  }
}
