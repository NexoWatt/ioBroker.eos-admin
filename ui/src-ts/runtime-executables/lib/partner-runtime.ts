/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Verbindet geschützte lokale Bereitstellung, Replayjournal, Fachdienst und ausgehendes WSS.
 * Daten und Wirkung: Liest ausschließlich feste Messwertprojektionen und eine benannte Umgebungsreferenz;
 * schreibt atomar ein begrenztes Replayjournal. Keine Geräte-, Roh-State- oder Installerkonfigurationsschreibrechte.
 * Bei Änderungen: Journalverlust, Widerruf während await, Reconnectgeneration, Appzustand und Datenfrische testen.
 * Verknüpfungen: partner-service.ts, partner-websocket.ts, docs/PARTNER_RUNTIME_PROVISIONIERUNG_DE.md.
 */
import * as fs from 'node:fs/promises';
import { constants, type Stats } from 'node:fs';
import * as path from 'node:path';
import { randomBytes, X509Certificate } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { currentPartnerConfig, partnerRecord, partnerKeys, partnerId, partnerInteger, partnerNumber } from './partner-contracts';
import type { PartnerAppId, PartnerConfig, PartnerRecord, StorageRequest } from './partner-contracts';
import { PartnerIntegrationService } from './partner-service';
import type { PartnerDataKind, PartnerJournalEntry, PartnerStatus } from './partner-service';
import { PartnerWebSocketClient } from './partner-websocket';
import type { PartnerWebSocketConfig, PartnerWebSocketHooks } from './partner-websocket';

const MAX_JSON_BYTES = 65536;
const MAX_JOURNAL_BYTES = 1024 * 1024;
const SAMPLE_AGE_MS = 15000;
const BALANCE_AGE_MS = 30 * 60 * 1000;
export type PartnerStateSample = { value: unknown; ts: unknown };
export interface PartnerRuntimeHooks {
  dataDirectory: string;
  getRoot(): unknown;
  isAppActive(appId: PartnerAppId): boolean;
  controlAvailable(): boolean;
  isResourceAvailable(resourceId: string): boolean;
  readState(id: string): PartnerStateSample | null;
  readTelemetry(resourceId: string): unknown;
  environment?: Readonly<Record<string, string | undefined>>;
  now?: () => number;
  /** Nur Tests injizieren einen Transport; produktiv stets den fest importierten WSS-Client verwenden. */
  createTransport?: (config: PartnerWebSocketConfig, hooks: PartnerWebSocketHooks) => Pick<PartnerWebSocketClient, 'start' | 'stop'>;
}

/** Externe Fehler enthalten potenziell Pfade/Geheimnisse und werden nicht weitergegeben. */
function missing(error: unknown): boolean { return partnerRecord(error) ? error.code === 'ENOENT' : error instanceof Error && 'code' in error && error.code === 'ENOENT'; }
/** POSIX-Eigentümer und Schutzbits prüfen; Windows-ACL-Nachweis gehört zur Inbetriebnahme. */
function secureMode(stat: Stats, directory: boolean): boolean {
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile())) return false;
  if (process.platform === 'win32') return false; // Kein stilles Gleichsetzen von Modebits und Windows-ACLs.
  return (stat.mode & 0o077) === 0 && (!process.getuid || stat.uid === process.getuid());
}
/** Atomare Schreibvorgänge benötigen nach Dateifsync auch das dauerhafte Verzeichnis-Rename. */
async function syncDirectory(directory: string): Promise<void> {
  const handle = await fs.open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { await handle.sync(); } finally { await handle.close(); }
}
/** Geschützte begrenzte Datei mit O_NOFOLLOW öffnen; Prüfung gilt für den geöffneten Deskriptor. */
async function readProtected(file: string, maxBytes: number): Promise<string> {
  const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    if (!secureMode(stat, false) || stat.size > maxBytes) throw new Error('PARTNER_PERSISTENCE_UNSAFE');
    const buffer = Buffer.alloc(maxBytes + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const result = await handle.read(buffer, offset, buffer.length - offset, null);
      if (!result.bytesRead) break;
      offset += result.bytesRead;
    }
    if (offset > maxBytes) throw new Error('PARTNER_PERSISTENCE_TOO_LARGE');
    return buffer.subarray(0, offset).toString('utf8');
  } finally { await handle.close(); }
}

/**
 * Replayjournal enthält keine Geheimnisse; Dateirechte verhindern Fremdänderungen durch andere lokale Nutzer.
 * Der Marker im Elternverzeichnis macht den Verlust des Journalverzeichnisses erkennbar.
 * Gegen absichtlichen Rollback durch denselben Betriebssystemnutzer ist zusätzlich geschützter Hostbetrieb nötig.
 */
export class PartnerJournalStore {
  private readonly directory: string;
  private readonly file: string;
  private readonly marker: string;
  private readonly fence: string;
  private serial: Promise<void> = Promise.resolve();
  constructor(private readonly dataDirectory: string) {
    if (!path.isAbsolute(dataDirectory)) throw new Error('PARTNER_DATA_DIRECTORY_INVALID');
    this.directory = path.join(dataDirectory, 'partner-runtime');
    this.file = path.join(this.directory, 'journal.json');
    this.fence = path.join(this.directory, 'revocation.json');
    this.marker = path.join(dataDirectory, 'partner-runtime.initialized');
  }
  /** Vor jedem Zugriff feste eigene Verzeichnisse und Elternpfade ohne Symlinks überprüfen. */
  private async checkParents(): Promise<void> {
    let current = path.resolve(this.dataDirectory);
    while (true) {
      const stat = await fs.lstat(current);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('PARTNER_DATA_DIRECTORY_INVALID');
      // Eltern dürfen vom Administrator verwaltet sein; unprivilegierte Fremdschreiber sind verboten.
      if ((stat.mode & 0o022) !== 0 && !(stat.mode & 0o1000)) throw new Error('PARTNER_DATA_DIRECTORY_UNSAFE');
      const parent = path.dirname(current); if (parent === current) break; current = parent;
    }
    const stat = await fs.lstat(this.directory);
    if (!secureMode(stat, true)) throw new Error('PARTNER_PERSISTENCE_UNSAFE');
  }
  /** Nur eine echte Erstinbetriebnahme erzeugt ein leeres Journal; Verlust nach Initialisierung sperrt. */
  load(): Promise<unknown> { return this.ordered(() => this.loadInternal()); }
  private async loadInternal(): Promise<unknown> {
    let hasDirectory = true; let hasMarker = true;
    try { await fs.lstat(this.directory); } catch (error) { if (!missing(error)) throw new Error('JOURNAL_UNAVAILABLE'); hasDirectory = false; }
    try { if (await readProtected(this.marker, 128) !== 'nexowatt.partner.journal.v1\n') throw new Error('JOURNAL_INVALID'); } catch (error) { if (!missing(error)) throw new Error('JOURNAL_UNAVAILABLE'); hasMarker = false; }
    if (!hasDirectory && !hasMarker) {
      await fs.mkdir(this.directory, { mode: 0o700 });
      await this.checkParents();
      // Marker zuerst: ein Stromausfall beim Erstaufbau darf kein unbemerktes Reset erlauben.
      const marker = await fs.open(this.marker, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try { await marker.writeFile('nexowatt.partner.journal.v1\n'); await marker.sync(); } finally { await marker.close(); }
      await syncDirectory(this.dataDirectory);
      await this.atomicWrite(this.fence, JSON.stringify({ schema: 'nexowatt.partner.revocation.v1', version: 0 }));
      await this.persistInternal([]);
    } else if (!hasDirectory || !hasMarker) throw new Error('JOURNAL_UNAVAILABLE');
    await this.checkParents();
    await this.revokedVersion();
    const text = await readProtected(this.file, MAX_JOURNAL_BYTES);
    let value: unknown; try { value = JSON.parse(text); } catch { throw new Error('JOURNAL_INVALID'); }
    if (!partnerRecord(value) || !partnerKeys(value, ['schema', 'entries']) || value.schema !== 'nexowatt.partner.journal.v1' || !Array.isArray(value.entries)) throw new Error('JOURNAL_INVALID');
    return value.entries;
  }
  /** Erst nach fsync+Rename+Verzeichnisfsync darf der Fachdienst einen neuen Wunsch freigeben. */
  persist(entries: PartnerJournalEntry[]): Promise<void> { return this.ordered(() => this.persistInternal(entries)); }
  private async persistInternal(entries: PartnerJournalEntry[]): Promise<void> {
    await this.checkParents();
    const marker = await readProtected(this.marker, 128);
    if (marker !== 'nexowatt.partner.journal.v1\n') throw new Error('JOURNAL_INVALID');
    const text = JSON.stringify({ schema: 'nexowatt.partner.journal.v1', entries });
    if (!Array.isArray(entries) || entries.length > 2048 || Buffer.byteLength(text) > MAX_JOURNAL_BYTES) throw new Error('JOURNAL_FULL');
    await this.atomicWrite(this.file, text);
  }
  /** Eine einmal bestätigte Widerrufsrevision bleibt auch nach Neustart gesperrt. */
  async revokedVersion(): Promise<number> {
    await this.checkParents();
    let value: unknown;
    try { value = JSON.parse(await readProtected(this.fence, 512)); } catch { throw new Error('REVOCATION_FENCE_UNAVAILABLE'); }
    if (!partnerRecord(value) || !partnerKeys(value, ['schema', 'version']) || value.schema !== 'nexowatt.partner.revocation.v1' || !partnerInteger(value.version, 0, Number.MAX_SAFE_INTEGER)) throw new Error('REVOCATION_FENCE_INVALID');
    return value.version;
  }
  /** Die HTTP-Antwort darf erfolgreichen Widerruf erst nach dieser dauerhaften Schranke melden. */
  revoke(version: number): Promise<void> { return this.ordered(() => this.revokeInternal(version)); }
  private async revokeInternal(version: number): Promise<void> {
    const previous = await this.revokedVersion();
    if (!partnerInteger(version, 1, Number.MAX_SAFE_INTEGER)) throw new Error('REVOCATION_VERSION_INVALID');
    await this.atomicWrite(this.fence, JSON.stringify({ schema: 'nexowatt.partner.revocation.v1', version: Math.max(version, previous) }));
  }
  /** Ein Hot-Reload liest erst nach allen bereits begonnenen alten Journal-Schreibvorgängen. */
  private ordered<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.serial.then(operation);
    this.serial = result.then(() => undefined, () => undefined);
    return result;
  }
  private async atomicWrite(file: string, text: string): Promise<void> {
    const temp = path.join(this.directory, `.journal-${randomBytes(16).toString('hex')}.tmp`);
    const handle = await fs.open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await handle.writeFile(text); await handle.sync(); }
    catch { await handle.close(); await fs.unlink(temp).catch(() => undefined); throw new Error('JOURNAL_UNAVAILABLE'); }
    await handle.close();
    try { await fs.rename(temp, file); await syncDirectory(this.directory); }
    catch { await fs.unlink(temp).catch(() => undefined); throw new Error('JOURNAL_UNAVAILABLE'); }
  }
}

/**
 * Die UI kennt nur eine Umgebungsreferenz. Ihr Inhalt bindet Identität, festes TLS-Ziel und Ablaufzeit.
 * Es existieren keine Secrets im Konfigbackup, Querystring, Status, Log oder Rückfallwert.
 */
export function readPartnerProvisioning(config: PartnerConfig, environment: Readonly<Record<string, string | undefined>>): PartnerWebSocketConfig {
  if (!/^NEXOWATT_PARTNER_[A-Z0-9_]{1,80}$/.test(config.credentialRef)) throw new Error('CREDENTIALS_UNAVAILABLE');
  const text = environment[config.credentialRef];
  if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_JSON_BYTES) throw new Error('CREDENTIALS_UNAVAILABLE');
  let value: unknown; try { value = JSON.parse(text); } catch { throw new Error('CREDENTIALS_UNAVAILABLE'); }
  if (!partnerRecord(value) || !partnerKeys(value, ['partnerId', 'allowedEndpoint', 'credentials', 'privateVpnAddresses']) || !partnerId(value.partnerId) || value.partnerId !== config.partnerId || !partnerRecord(value.allowedEndpoint) || !partnerRecord(value.credentials)) throw new Error('CREDENTIALS_INVALID');
  const endpoint = value.allowedEndpoint; const credentials = value.credentials;
  if (!partnerKeys(endpoint, ['hostname', 'port', 'path']) || typeof endpoint.hostname !== 'string' || endpoint.hostname.length > 253 || !partnerInteger(endpoint.port, 1, 65535) || typeof endpoint.path !== 'string' || endpoint.path.length > 2048 || !endpoint.path.startsWith('/') || !partnerKeys(credentials, ['expiresAtMs', 'bearerToken', 'clientCertPem', 'clientKeyPem', 'caPem']) || !partnerInteger(credentials.expiresAtMs, 1, Number.MAX_SAFE_INTEGER)) throw new Error('CREDENTIALS_INVALID');
  const parsed: PartnerWebSocketConfig['credentials'] = { expiresAtMs: credentials.expiresAtMs };
  const strings: { bearerToken?: string; clientCertPem?: string; clientKeyPem?: string; caPem?: string } = {};
  for (const key of ['bearerToken', 'clientCertPem', 'clientKeyPem', 'caPem'] as const) {
    const raw = credentials[key];
    if (raw !== undefined) { if (typeof raw !== 'string' || !raw.length || Buffer.byteLength(raw) > 32768) throw new Error('CREDENTIALS_INVALID'); strings[key] = raw; }
  }
  const privateVpnAddresses: string[] = [];
  if (value.privateVpnAddresses !== undefined) {
    if (!Array.isArray(value.privateVpnAddresses) || value.privateVpnAddresses.length > 32 || value.privateVpnAddresses.some(address => typeof address !== 'string' || address.length > 64)) throw new Error('CREDENTIALS_INVALID');
    for (const address of value.privateVpnAddresses) if (typeof address === 'string') privateVpnAddresses.push(address);
  }
  return { partnerId: value.partnerId, endpoint: config.endpoint, allowedEndpoint: { hostname: endpoint.hostname, port: endpoint.port, path: endpoint.path }, credentials: { ...parsed, ...strings }, privateVpnAddresses };
}

/** Endliche echte Messwerte mit ursprünglichem Zeitstempel; Strings und aufgefrischte Altwerte sind ungültig. */
function sample(read: PartnerRuntimeHooks['readState'], key: string, now: number, min: number, max: number): { value: number; ts: number } | null {
  const value = read(key);
  return value && partnerNumber(value.value, min, max) && partnerInteger(value.ts, 1, now + 1000) && now - value.ts <= SAMPLE_AGE_MS ? { value: value.value, ts: value.ts } : null;
}
/** Nur das letzte abgeschlossene Bilanzintervall, keine Personen-, Zählerkennungen oder Rohkonfiguration. */
function balanceProjection(read: PartnerRuntimeHooks['readState'], now: number): PartnerRecord {
  const state = read('energyLedger.origin.lastIntervalJson');
  if (!state || typeof state.value !== 'string' || Buffer.byteLength(state.value) > MAX_JSON_BYTES || !partnerInteger(state.ts, 1, now + 1000)) throw new Error('DATA_UNAVAILABLE');
  let value: unknown; try { value = JSON.parse(state.value); } catch { throw new Error('DATA_UNAVAILABLE'); }
  if (!partnerRecord(value) || !partnerInteger(value.startTs, 1, now) || !partnerInteger(value.endTs, value.startTs + 1, now) || now - value.endTs > BALANCE_AGE_MS || !partnerRecord(value.quality) || value.quality.status !== 'complete' || !partnerRecord(value.evcs) || !partnerRecord(value.evcs.sourceBreakdown) || !partnerNumber(value.evcs.totalKwh, 0, 1e15)) throw new Error('DATA_UNAVAILABLE');
  const source = value.evcs.sourceBreakdown;
  const out: PartnerRecord = Object.create(null);
  out.intervalCount = 1; out.completeIntervalCount = 1; out.evcsTotalKwh = value.evcs.totalKwh;
  for (const key of ['pvDirectKwh', 'otherRenewableDirectKwh', 'storedPvKwh', 'storedOtherRenewableKwh', 'gridDirectKwh', 'storedGridKwh']) {
    if (!partnerNumber(source[key], 0, 1e15)) throw new Error('DATA_UNAVAILABLE');
    out[key] = source[key];
  }
  const known = Object.values(source).length; // Umfang des Fremdobjekts wird nicht zurückgegeben.
  if (known > 64) throw new Error('DATA_UNAVAILABLE');
  const renewable = Number(out.pvDirectKwh) + Number(out.otherRenewableDirectKwh) + Number(out.storedPvKwh) + Number(out.storedOtherRenewableKwh);
  const totalKnown = renewable + Number(out.gridDirectKwh) + Number(out.storedGridKwh);
  if (totalKnown > value.evcs.totalKwh + 0.000001) throw new Error('DATA_UNAVAILABLE');
  out.unknownKwh = Math.max(0, value.evcs.totalKwh - totalKnown); out.operationalRenewableKwh = renewable;
  out.periodStartMs = value.startTs; out.periodEndMs = value.endTs; out.updatedAtMs = state.ts;
  return out;
}
/** Feste fachliche Ressourcen statt frei wählbarer ioBroker-State-IDs. Ungültige Werte bleiben unavailable. */
export function readPartnerProjection(config: PartnerConfig, read: PartnerRuntimeHooks['readState'], appId: PartnerAppId, resourceId: string, kind: PartnerDataKind, now = Date.now(), telemetry?: unknown): PartnerRecord {
  if (appId === 'energyLedger') {
    if (resourceId !== 'site' || kind !== 'balance') throw new Error('RESOURCE_UNAVAILABLE');
    return balanceProjection(read, now);
  }
  if (appId === 'directMarketing') {
    if (resourceId !== 'site') throw new Error('RESOURCE_UNAVAILABLE');
    if (kind === 'capabilities') return { curtailmentSupported: false, maxCurtailmentW: 0 };
    if (kind !== 'telemetry') throw new Error('RESOURCE_UNAVAILABLE');
    const power = sample(read, 'pvPower', now, 0, 1e9);
    const imported = sample(read, 'gridBuyPower', now, 0, 1e9); const exported = sample(read, 'gridSellPower', now, 0, 1e9);
    return power && imported && exported && Math.max(power.ts, imported.ts, exported.ts) - Math.min(power.ts, imported.ts, exported.ts) <= 5000 ? { powerW: power.value, gridPowerW: imported.value - exported.value, updatedAtMs: Math.min(power.ts, imported.ts, exported.ts), available: true } : { available: false };
  }
  const resource = config.arbitrage.resources.find(candidate => candidate.id === resourceId);
  if (!resource || resourceId === 'farm') throw new Error('RESOURCE_UNAVAILABLE');
  if (kind === 'capabilities') return { maxChargeW: resource.maxChargeW, maxDischargeW: resource.maxDischargeW, chargeSupported: resource.maxChargeW > 0, dischargeSupported: resource.maxDischargeW > 0 };
  if (kind !== 'telemetry') throw new Error('RESOURCE_UNAVAILABLE');
  // Einziger Ursprung ist der vorhandene Writer mit echten Messzeitstempeln, keine Diagnose-State-Zeit.
  if (!partnerRecord(telemetry) || telemetry.resourceId !== resourceId || telemetry.valid !== true || !partnerNumber(telemetry.socPct, 0, 100) || !partnerNumber(telemetry.powerW, -1e9, 1e9) || !partnerNumber(telemetry.gridPowerW, -1e9, 1e9) || !partnerInteger(telemetry.socTs, now - SAMPLE_AGE_MS, now + 1000) || !partnerInteger(telemetry.powerTs, now - SAMPLE_AGE_MS, now + 1000) || !partnerInteger(telemetry.gridTs, now - SAMPLE_AGE_MS, now + 1000) || Math.max(telemetry.socTs, telemetry.powerTs, telemetry.gridTs) - Math.min(telemetry.socTs, telemetry.powerTs, telemetry.gridTs) > 5000) return { available: false };
  return { socPct: telemetry.socPct, powerW: telemetry.powerW, gridPowerW: telemetry.gridPowerW, updatedAtMs: Math.min(telemetry.socTs, telemetry.powerTs, telemetry.gridTs), available: true };
}

/** Adapter-Fassade: Konfigurationswechsel und Stop widerrufen synchron, bevor asynchrone Arbeit fortsetzt. */
export class PartnerRuntime {
  private readonly journal: PartnerJournalStore;
  private service: PartnerIntegrationService | null = null;
  private transport: Pick<PartnerWebSocketClient, 'start' | 'stop'> | null = null;
  private generation = 0;
  private signature = '';
  private stopped = true;
  private revokedVersion = 0;
  private credentialExpiresAt = 0;
  private credentialDeadline = 0;
  private fallback: PartnerStatus = { connection: 'disabled', reason: 'DISABLED', controlAvailable: false, revision: 1 };
  constructor(private readonly hooks: PartnerRuntimeHooks) { this.journal = new PartnerJournalStore(hooks.dataDirectory); }
  /** Keine Fremdexception verlässt die Lifecycle-Grenze; Fehler sperren und haben feste Statuscodes. */
  async refresh(): Promise<void> {
    this.stop(); this.stopped = false; const generation = this.generation;
    try {
      const config = currentPartnerConfig(this.hooks.getRoot()); this.signature = JSON.stringify(config);
      this.fallback = { connection: config.enabled ? 'blocked' : 'disabled', reason: config.enabled ? 'INITIALIZING' : 'DISABLED', controlAvailable: false, revision: config.configVersion };
      if (!config.enabled) return;
      const transportConfig = readPartnerProvisioning(config, this.hooks.environment || process.env);
      const certificateExpiry = transportConfig.credentials.clientCertPem ? Date.parse(new X509Certificate(transportConfig.credentials.clientCertPem).validTo) : Number.POSITIVE_INFINITY;
      this.credentialExpiresAt = Math.min(transportConfig.credentials.expiresAtMs, certificateExpiry);
      this.credentialDeadline = performance.now() + this.credentialExpiresAt - this.now();
      if (!Number.isFinite(this.credentialExpiresAt) || this.credentialExpiresAt <= this.now()) throw new Error('CREDENTIALS_EXPIRED');
      const service = new PartnerIntegrationService(config, {
        loadJournal: () => this.journal.load(), persistJournal: entries => this.journal.persist(entries),
        isAppActive: appId => this.hooks.isAppActive(appId), isResourceAvailable: resourceId => this.hooks.isResourceAvailable(resourceId), controlAvailable: () => this.authorized(generation) && this.hooks.controlAvailable(),
        readData: async (appId, resourceId, kind) => {
          if (appId === 'arbitrage' && !this.hooks.isResourceAvailable(resourceId)) throw new Error('RESOURCE_UNAVAILABLE');
          return readPartnerProjection(config, id => this.hooks.readState(id), appId, resourceId, kind, this.now(), this.hooks.readTelemetry(resourceId));
        },
        now: () => this.now(),
      });
      this.service = service;
      await service.initialize();
      this.revokedVersion = Math.max(this.revokedVersion, await this.journal.revokedVersion());
      if (config.configVersion <= this.revokedVersion) { service.invalidate('REVOKED'); return; }
      if (!this.authorized(generation)) return;
      const socketHooks: PartnerWebSocketHooks = {
        isAuthorized: () => this.authorized(generation),
        onState: (state, code) => { if (generation === this.generation) service.setConnection(state, code.toUpperCase()); },
        onMessage: async (partnerIdValue, text, context) => {
          if (!this.authorized(generation) || !context.isCurrent()) return;
          const response = await service.handleMessage(partnerIdValue, text);
          if (this.authorized(generation) && context.isCurrent()) context.send(response);
        },
      };
      this.transport = this.hooks.createTransport ? this.hooks.createTransport(transportConfig, socketHooks) : new PartnerWebSocketClient(transportConfig, socketHooks);
      if (this.authorized(generation)) this.transport.start(); else this.transport.stop();
    } catch { if (generation === this.generation) { this.service?.invalidate('RUNTIME_UNAVAILABLE'); this.fallback = { ...this.fallback, connection: 'blocked', reason: 'RUNTIME_UNAVAILABLE' }; } }
  }
  private now(): number { return this.hooks.now ? this.hooks.now() : Date.now(); }
  /** Auch ohne HTTP-Refresh erkennt jeder Zugriff geänderte Konfiguration oder deaktivierte Apps. */
  private authorized(generation: number): boolean {
    if (this.stopped || generation !== this.generation || !this.service?.authorize()) return false;
    try {
      const config = currentPartnerConfig(this.hooks.getRoot());
      const allowed = this.now() < this.credentialExpiresAt && performance.now() < this.credentialDeadline && config.configVersion > this.revokedVersion && JSON.stringify(config) === this.signature && config.grants.some(grant => this.hooks.isAppActive(grant.appId));
      if (!allowed) this.service.invalidate('AUTHORIZATION_CHANGED');
      return allowed;
    } catch { return false; }
  }
  getCurrentRequest(resourceId: string): StorageRequest | null {
    try { return this.authorized(this.generation) ? this.service?.getCurrentRequest(resourceId) ?? null : null; }
    catch { this.block('LOCAL_STATE_UNAVAILABLE'); return null; }
  }
  snapshot(): PartnerStatus {
    try { return this.service?.snapshot() || { ...this.fallback }; }
    catch { return { ...this.fallback, connection: 'blocked', reason: 'LOCAL_STATE_UNAVAILABLE', controlAvailable: false }; }
  }
  /** Lokaler Widerruf sofort; bestätigter Widerruf zusätzlich persistent vor der API-Quittung. */
  async invalidate(reason = 'REVOKED'): Promise<void> {
    this.block(reason);
    if (reason !== 'REVOKED') return;
    this.revokedVersion = Math.max(this.revokedVersion, this.fallback.revision);
    try { await this.journal.load(); await this.journal.revoke(this.revokedVersion); }
    catch { this.fallback = { ...this.fallback, connection: 'blocked', reason: 'REVOCATION_PERSIST_FAILED' }; throw new Error('REVOCATION_PERSIST_FAILED'); }
  }
  private block(reason: string): void { this.generation++; this.stopped = true; this.service?.invalidate(reason); this.transport?.stop(); this.transport = null; }
  stop(): void { this.block('STOPPED'); this.service = null; }
}
