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
 * Aufgabe: Kapselt die Verbindung zur Adapter-Instanz und die geschützten Anmelde-, Konfigurations- und SMTP-API-Aufrufe.
 * Daten und Wirkung: Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.
 * Bei Änderungen: DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.
 * Verknüpfungen: docs/quellcode/src-admin-tab/src/lib/adminConnection.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
/**
 * NexoWatt Detail-Kommentar (DE)
 * Zweck dieser Ergänzung:
 * - Jede relevante Funktion, Methode, Route und UI-Ereignisbindung erhält einen eigenen Erklärungskommentar.
 * - Die Kommentare beschreiben Aufgabe, Daten-/API-Zusammenhang und TypeScript-Migrationshinweise.
 * - API- und ioBroker-Grenzen werden zur Laufzeit geprüft; die Aufrufreihenfolge und vorhandene Fallbacks bleiben erhalten.
 */

/**
 * Datei: src-admin-tab/src/lib/adminConnection.ts
 * Rolle im Projekt: Admin-React-Quelle.
 * Zweck: React-Quellcode für ioBroker-Admin-Tab und Installer-Einstiegsseiten.
 * Wartung: Die folgenden Abschnitts-Kommentare erklären die einzelnen Code-Teile.
 * TypeScript-Status: Diese Admin-Quelle ist auf .ts/.tsx umgestellt; der Browser erhält weiterhin ein gebautes JS-Bundle.
 */
/**
 * NexoWatt Code-Kommentar (DE)
 * Zweck: Quellcode der React-Admin-Tab-Oberfläche.
 * Zusammenhänge:
 * - Baut nach admin/react/ und öffnet Installer-/Lizenz-/Redirect-Seiten.
 * - Kommuniziert über AdminConnection/ioBroker Admin APIs.
 * Wartungshinweise:
 * - Bei UI-Änderungen anschließend admin:build ausführen.
 */

const ADAPTER_NAME = 'eos-admin';
const DEFAULT_PORT = 8188;
const ADMIN_CALL_TIMEOUT_MS = 5000;
const RUNTIME_FETCH_TIMEOUT_MS = 1500;

/**
 * Obergrenze je dekodierter HTTP-Antwort, vor UTF-8-/JSON-Verarbeitung.
 * 16 MiB lassen die vorhandenen 5-MiB-Konfigurationen einschließlich Hülle und
 * Vorschau sowie Archivseiten (200 Datensätze mit je höchstens 4000 Byte) zu.
 * Die bestehenden Tiefen-/Knotenprüfungen gelten zusätzlich nach JSON.parse.
 */
export const ADMIN_RESPONSE_MAX_BYTES = 16 * 1024 * 1024;

export type JsonRecord = Record<string, unknown>;
type ReadCallback = (error: unknown, value?: unknown) => void;
type WriteCallback = (error?: unknown) => void;
type RawCallback = (first?: unknown, second?: unknown) => void;

/** Normalisiert die historischen ioBroker-Callback-Varianten ohne Daten zu vertrauen. */
export interface AdminConnection {
  readonly type: 'servConn' | 'socket';
  getObject(id: string, callback: ReadCallback): void;
  getState(id: string, callback: ReadCallback): void;
  setObject(id: string, object: unknown, callback: WriteCallback): void;
}

interface ServConn {
  getObject(id: string, callback: RawCallback): unknown;
  getState?: (id: string, callback: RawCallback) => unknown;
  setObject(id: string, object: unknown, callback: WriteCallback): unknown;
}

interface AdminSocket {
  emit(event: string, ...args: unknown[]): unknown;
}

interface SocketIoClient {
  connect(): unknown;
}

export interface IoBrokerObject extends JsonRecord {
  native?: JsonRecord;
  common?: JsonRecord;
}

export interface IoBrokerState extends JsonRecord {
  val?: unknown;
}

/** Bestätigte Transporteinstellung derselben Adapterinstanz; kein Browser-Queryziel. */
export interface RuntimeTarget {
  readonly port: number;
  readonly secure: boolean;
}

/** Nur tatsächlich geprüfte Sitzungsfelder entscheiden über die UI-Freigabe. */
export interface RuntimeAuthStatus extends JsonRecord {
  enabled: boolean;
  configured: boolean;
  mode: 'iobroker' | 'eos';
  authed: boolean;
  role: string;
  user: string | null;
  capabilities: string[];
  loginUrl: string;
  logoutUrl: string;
  csrfToken: string;
}

interface RuntimeFetchOptions {
  credentials?: RequestCredentials;
  headers?: Record<string, string>;
  adminProxy?: boolean;
}

declare global {
  interface Window {
    servConn?: unknown;
    socket?: unknown;
    io?: unknown;
    __nwAdminSocket?: unknown;
    __nwSocketLoader?: unknown;
    socketPath?: unknown;
  }
}

/** HTTP-Status und bereits validierte Nutzdaten bleiben für gezielte Fehlerbehandlung verfügbar. */
export class RuntimeRequestError extends Error {
  constructor(message: string, readonly status: number, readonly payload: JsonRecord) {
    super(message);
    this.name = 'RuntimeRequestError';
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isServConn(value: unknown): value is ServConn {
  return isRecord(value) && typeof value.getObject === 'function' && typeof value.setObject === 'function'
    && (value.getState === undefined || typeof value.getState === 'function');
}

function isAdminSocket(value: unknown): value is AdminSocket {
  return isRecord(value) && typeof value.emit === 'function';
}

function isSocketIoClient(value: unknown): value is SocketIoClient {
  return (isRecord(value) || typeof value === 'function') && 'connect' in value && typeof value.connect === 'function';
}

/** Fehlerobjekte werden niemals vorausgesetzt; Stack-Traces werden nicht in die UI übernommen. */
export function getErrorStatus(error: unknown): number {
  return isRecord(error) && typeof error.status === 'number' && Number.isInteger(error.status) ? error.status : 0;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return isRecord(error) && typeof error.message === 'string' && error.message ? error.message : fallback;
}

/**
 * Prüft die vollständige JSON-Struktur vor Verwendung. Zusätzliche legitime Felder bleiben erhalten;
 * zyklische/übermäßig tiefe Daten, Nicht-JSON-Werte und Prototyp-Schlüssel werden abgewiesen.
 * Dictionaries erhalten keinen Prototyp. Das Knotenbudget schützt auch große Array-Strukturen.
 */
function copyJsonValue(value: unknown, depth = 0, budget = { remaining: 100000 }): unknown {
  budget.remaining -= 1;
  if (depth > 40 || budget.remaining < 0) throw new Error('API-Daten überschreiten die zulässige Strukturgröße.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(entry => copyJsonValue(entry, depth + 1, budget));
  if (!isRecord(value)) throw new Error('Ungültige JSON-Daten.');
  const result: JsonRecord = Object.create(null);
  for (const [key, entry] of Object.entries(value)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw new Error('Unzulässiger API-Datenschlüssel.');
    result[key] = copyJsonValue(entry, depth + 1, budget);
  }
  return result;
}

function parseApiRecord(value: unknown): JsonRecord {
  const result = copyJsonValue(value);
  if (!isRecord(result)) throw new Error('Ungültige API-Antwort.');
  return result;
}

/** Ungültige oder fehlende Berechtigungsfelder können keine Sitzung freischalten. */
export function parseRuntimeAuthStatus(value: unknown): RuntimeAuthStatus {
  const record = parseApiRecord(value);
  if (typeof record.enabled !== 'boolean' || typeof record.authed !== 'boolean' || typeof record.role !== 'string'
    || typeof record.configured !== 'boolean' || !['iobroker', 'eos'].includes(String(record.mode))
    || !['none', 'customer', 'installer', 'admin'].includes(record.role)
    || (record.authenticated !== undefined && record.authenticated !== record.authed)
    || !Array.isArray(record.capabilities) || !record.capabilities.every((entry: unknown): entry is string => typeof entry === 'string')
    || record.capabilities.length > 128
    || (record.user !== undefined && record.user !== null && typeof record.user !== 'string')
    || (record.authed && (record.configured !== true || !record.user || record.role === 'none'
      || typeof record.csrfToken !== 'string' || !/^[A-Za-z0-9+/_=-]{16,1024}$/.test(record.csrfToken)))) {
    throw new Error('Ungültiger EOS-Anmeldestatus.');
  }
  return { ...record, enabled: record.enabled, configured: record.configured, mode: record.mode as 'iobroker' | 'eos',
    authed: record.authed, role: record.role,
    loginUrl: typeof record.loginUrl === 'string' && record.loginUrl.length <= 4096 ? record.loginUrl : '',
    logoutUrl: typeof record.logoutUrl === 'string' && record.logoutUrl.length <= 4096 ? record.logoutUrl : '',
    csrfToken: record.authed && typeof record.csrfToken === 'string' ? record.csrfToken : '',
    capabilities: record.capabilities, user: typeof record.user === 'string' ? record.user : null };
}

function isIoBrokerObject(value: unknown): value is IoBrokerObject {
  return isRecord(value) && (value.native === undefined || isRecord(value.native))
    && (value.common === undefined || isRecord(value.common));
}

class ApiResponseLimitError extends Error {
  constructor() {
    super('API-Antwort ist zu groß (maximal 16 MiB).');
    this.name = 'ApiResponseLimitError';
  }
}

/**
 * Liest native Fetch-Streams mit einer Grenze auf tatsächlich gelieferte Bytes.
 * Content-Length dient nur zur frühen Ablehnung; fehlende/zu kleine Angaben
 * umgehen das Streamlimit nicht. Browserseitig dekomprimierte Bytes zählen.
 * Ein wachsender Bytepuffer begrenzt auch den Speicher bei sehr kleinen Chunks.
 * Derselbe AbortController deckt Fetch und Body ab; Fehler brechen den Transport
 * und Reader ab. Keine Antwort wird unbeschränkt mit json()/text() eingelesen.
 */
export async function readBoundedApiJson(response: Response, controller: AbortController): Promise<unknown> {
  const body = response.body;
  if (!body || body.locked) {
    controller.abort();
    throw new Error('API-Antwort enthält keinen lesbaren Datenstrom.');
  }
  const reader = body.getReader();
  const signal = controller.signal;
  const cancel = (): void => { void reader.cancel().catch(() => { /* Abbruchfehler enthalten keine Nutzdaten. */ }); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    if (signal.aborted) throw new Error('API-Abruf abgebrochen.');
    const declaredLength = response.headers.get('content-length');
    if (declaredLength !== null) {
      if (!/^\d+$/.test(declaredLength) || !Number.isSafeInteger(Number(declaredLength))) {
        throw new Error('Ungültige API-Antwortgröße.');
      }
      if (Number(declaredLength) > ADMIN_RESPONSE_MAX_BYTES) throw new ApiResponseLimitError();
    }
    let bytes = new Uint8Array(64 * 1024);
    let received = 0;
    for (;;) {
      const chunk = await reader.read();
      if (signal.aborted) throw new Error('API-Abruf abgebrochen.');
      if (chunk.done) break;
      const nextSize = received + chunk.value.byteLength;
      if (nextSize > ADMIN_RESPONSE_MAX_BYTES) throw new ApiResponseLimitError();
      if (nextSize > bytes.byteLength) {
        const expanded = new Uint8Array(Math.min(ADMIN_RESPONSE_MAX_BYTES, Math.max(nextSize, bytes.byteLength * 2)));
        expanded.set(bytes.subarray(0, received));
        bytes = expanded;
      }
      bytes.set(chunk.value, received);
      received = nextSize;
    }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, received));
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch (error) {
    // Auch bei Größen-/UTF-8-/JSON-Fehlern läuft der Fetch nicht im Hintergrund weiter.
    controller.abort();
    cancel();
    throw error;
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

/** Auch bei HTML-/defekten Fehlerantworten bleibt der HTTP-Status für das Fallback-Verbot erhalten. */
async function readApiResponse(response: Response, controller: AbortController, adminProxy = false): Promise<JsonRecord> {
  const jsonType = /^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '');
  if (adminProxy && !jsonType && [401, 403, 404, 502].includes(response.status)) {
    controller.abort();
    if (response.body) void response.body.cancel().catch(() => {});
    if (response.status === 401) throw new RuntimeRequestError('Die Anmeldung an der Systemverwaltung ist abgelaufen. Bitte dort erneut anmelden.', 401, { error: 'admin_proxy_auth_required' });
    if (response.status === 403) throw new RuntimeRequestError('Der Admin-Proxy benötigt ein Konto aus der Administratorgruppe der Systemverwaltung.', 403, { error: 'admin_proxy_forbidden' });
    if (response.status === 404) throw new RuntimeRequestError('Der Admin-Proxy dieser Instanz ist nicht verfügbar. Admin-Version und Instanzfreigabe prüfen.', 404, { error: 'admin_proxy_unavailable' });
    throw new RuntimeRequestError('Der UI-Adapter ist über den Admin-Proxy nicht erreichbar. Instanzstatus und Port prüfen.', 502, { error: 'runtime_unreachable' });
  }
  let json: JsonRecord;
  try {
    const raw = await readBoundedApiJson(response, controller);
    json = parseApiRecord(raw);
  } catch (error) {
    const payload: JsonRecord = Object.create(null);
    const message = response.ok
      ? (error instanceof ApiResponseLimitError ? error.message : 'Ungültige API-Antwort.')
      : `HTTP ${response.status}`;
    throw new RuntimeRequestError(message, response.status, payload);
  }
  if (!response.ok || json.ok === false) {
    const message = typeof json.message === 'string' ? json.message
      : typeof json.error === 'string' ? json.error : `HTTP ${response.status}`;
    throw new RuntimeRequestError(message, response.status, json);
  }
  return json;
}
/**
 * Code-Teil: withTimeout
 * Zweck: Kapselt einen lokalen Verarbeitungsschritt, damit Aufrufer nicht direkt in Detaildaten eingreifen.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label || 'Aufruf'} Timeout`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
/**
 * Code-Teil: callbackPromise
 * Zweck: Kapselt einen lokalen Verarbeitungsschritt, damit Aufrufer nicht direkt in Detaildaten eingreifen.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
function callbackPromise(fn: (callback: ReadCallback) => void, label: string, ms = ADMIN_CALL_TIMEOUT_MS): Promise<unknown> {
  return withTimeout(new Promise<unknown>((resolve, reject) => {
    try {
      fn((err, value) => (err ? reject(err) : resolve(value || null)));
    } catch (error) {
      reject(error);
    }
  }), ms, label);
}

/**
 * Code-Teil: getInstance
 * Zweck: Kapselt einen lokalen Verarbeitungsschritt, damit Aufrufer nicht direkt in Detaildaten eingreifen.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
function checkedInstance(value: unknown): string {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,5})$/.test(value)) {
    throw new RuntimeRequestError('Ungültige Adapterinstanz.', 0, { error: 'runtime_instance_invalid' });
  }
  return value;
}

export function getInstance(): string {
  const query = new URLSearchParams(window.location.search || '').get('instance');
  if (query !== null) return checkedInstance(query);
  // Eingebettete Fachseiten vererben die Instanz über den Proxy-Pfad auch ohne Query.
  const marker = '/proxy/nexowatt-ui.';
  const pathname = window.location.pathname || '/';
  const index = pathname.indexOf(marker);
  if (index >= 0) {
    const rest = pathname.slice(index + marker.length);
    const slash = rest.indexOf('/');
    return checkedInstance(slash < 0 ? rest : rest.slice(0, slash));
  }
  return '0';
}
/**
 * Code-Teil: getAdapterObjectId
 * Zweck: Kapselt einen lokalen Verarbeitungsschritt, damit Aufrufer nicht direkt in Detaildaten eingreifen.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
export function getAdapterObjectId(instance = getInstance()): string {
  return `system.adapter.${ADAPTER_NAME}.${instance}`;
}

/**
 * Code-Teil: buildRuntimeBaseUrl
 * Zweck: Erzeugt UI-/Konfigurations- oder Datenstruktur.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
/** Nur lokale, segmentweise begrenzte Admin-Prefixe; keine URL-/Traversal-Eingaben. */
function checkedPrefix(value: unknown): string {
  if (typeof value !== 'string' || value.length > 256 || !value.startsWith('/') || !value.endsWith('/')) {
    throw new RuntimeRequestError('Der Admin-Verbindungspfad ist ungültig.', 0, { error: 'runtime_path_invalid' });
  }
  const segments = value.slice(1, -1).split('/');
  if (value !== '/' && (segments.length > 16 || segments.some(part => !/^[A-Za-z0-9._~-]{1,128}$/.test(part) || part === '.' || part === '..'))) {
    throw new RuntimeRequestError('Der Admin-Verbindungspfad ist ungültig.', 0, { error: 'runtime_path_invalid' });
  }
  if (/\/proxy\/nexowatt-ui\.(?:0|[1-9][0-9]{0,5})\//u.test(value)) {
    throw new RuntimeRequestError('Der Admin-Verbindungspfad ist mehrdeutig.', 0, { error: 'runtime_path_invalid' });
  }
  return value;
}

/** Der vollständige Proxy-Pfad einschließlich Instanz bleibt in allen Schichten auf 256 Zeichen begrenzt. */
function composeRuntimeProxyBase(prefix: string, instance: string): string {
  const proxyPath = `${prefix}proxy/nexowatt-ui.${instance}`;
  if (proxyPath.length > 256) throw new RuntimeRequestError('Der Admin-Verbindungspfad ist zu lang.', 0, { error: 'runtime_path_invalid' });
  return currentOrigin() + proxyPath;
}

function currentOrigin(): string {
  const protocol = window.location.protocol;
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new RuntimeRequestError('Für die EOS-Verbindung ist HTTP oder HTTPS erforderlich.', 0, { error: 'runtime_protocol_invalid' });
  }
  const host = window.location.hostname;
  if (!host || /[\\\s/?#@]/.test(host)) {
    throw new RuntimeRequestError('Der EOS-Hostname ist ungültig.', 0, { error: 'runtime_host_invalid' });
  }
  const port = window.location.port;
  if (port && (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535)) {
    throw new RuntimeRequestError('Der EOS-Port ist ungültig.', 0, { error: 'runtime_port_invalid' });
  }
  return `${protocol}//${host}${port ? `:${port}` : ''}`;
}

/**
 * Admin 8.3+ stellt opt-in Instanz-Proxy unter seinem eigenen Origin bereit.
 * Die Instanz ist im Pfad gebunden; Queryparameter können kein fremdes Ziel setzen.
 * Bestehender Proxykontext bleibt auch bei HTTP erhalten. HTTPS-Admin verwendet
 * niemals den unverschlüsselten Runtime-Port als automatischen Rückfall.
 */
export function getRuntimeProxyBase(instance = getInstance()): string | null {
  const selected = checkedInstance(instance);
  const pathname = window.location.pathname || '/';
  const proxyMarker = '/proxy/nexowatt-ui.';
  const proxyIndex = pathname.indexOf(proxyMarker);
  if (proxyIndex >= 0) {
    // Ein Proxy-Namensraum im öffentlichen Admin-Präfix wäre als andere
    // Runtime-Instanz deutbar. Solche verschachtelten Pfade bleiben gesperrt.
    if (pathname.indexOf(proxyMarker, proxyIndex + proxyMarker.length) >= 0 || pathname.indexOf('/adapter/nexowatt-ui/', proxyIndex + proxyMarker.length) >= 0) {
      throw new RuntimeRequestError('Der Admin-Verbindungspfad ist mehrdeutig.', 0, { error: 'runtime_path_invalid' });
    }
    const rest = pathname.slice(proxyIndex + proxyMarker.length);
    const slash = rest.indexOf('/');
    const actual = checkedInstance(slash < 0 ? rest : rest.slice(0, slash));
    if (actual !== selected) throw new RuntimeRequestError('Die Seite gehört zu einer anderen Adapterinstanz.', 0, { error: 'runtime_instance_mismatch' });
    const prefix = checkedPrefix(pathname.slice(0, proxyIndex + 1));
    return composeRuntimeProxyBase(prefix, selected);
  }
  if (window.location.protocol !== 'https:') return null;
  const marker = '/adapter/nexowatt-ui/';
  const index = pathname.indexOf(marker);
  if (index < 0) return null;
  const prefix = checkedPrefix(pathname.slice(0, index + 1));
  const tail = pathname.slice(index + marker.length);
  if (tail !== 'tab.html' && tail !== 'react/index.html' && tail !== 'react/' && tail !== 'react') {
    throw new RuntimeRequestError('Der Admin-Einstiegspfad ist unbekannt.', 0, { error: 'runtime_path_invalid' });
  }
  // Admins öffentliches Prefix wird gegen den tatsächlichen Iframepfad gebunden.
  // Fehlende/noch nicht ersetzte Angaben ändern den aus dem Pfad ermittelten Bezug nicht.
  const declared = safeWindowAccess(() => window.socketPath)
    || safeWindowAccess(() => window.parent && window.parent.socketPath)
    || safeWindowAccess(() => window.top && window.top.socketPath);
  if (declared !== null && declared !== undefined && declared !== '' && !(typeof declared === 'string' && declared.includes('@@'))) {
    if (checkedPrefix(declared) !== prefix) {
      throw new RuntimeRequestError('Admin-Pfad und Verbindungspfad stimmen nicht überein.', 0, { error: 'runtime_path_mismatch' });
    }
  }
  return composeRuntimeProxyBase(prefix, selected);
}

function isEmbeddedRuntime(): boolean {
  const pathname = window.location.pathname || '/';
  return ['/mail-setup', '/mesh-setup', '/ems/microgrid', '/ems/nvp', '/ems/dynamic-grid', '/ems/arbitrage', '/ems/partner-integrations']
    .some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'));
}

export function buildRuntimeBaseUrl(_target: RuntimeTarget | number = DEFAULT_PORT): string {
  return currentOrigin();
}

/** Port und TLS aus genau einem bestätigten Instanzobjekt; Lesefehler ergeben kein Ersatzziel. */
export async function readAdapterRuntimeTarget(instance = getInstance(), conn: AdminConnection | null = null): Promise<RuntimeTarget> {
  const selected = checkedInstance(instance);
  let adapter: IoBrokerObject | null;
  try { adapter = await withTimeout(getObject(getAdapterObjectId(selected), conn), 3000, 'Adapterziel lesen'); }
  catch { throw new RuntimeRequestError('Die Verbindung zur ausgewählten Adapterinstanz konnte nicht ermittelt werden.', 0, { error: 'runtime_target_unavailable' }); }
  if (!adapter || adapter._id !== getAdapterObjectId(selected) || !adapter.native) {
    throw new RuntimeRequestError('Die ausgewählte Adapterinstanz liefert kein gültiges Verbindungsziel.', 0, { error: 'runtime_target_invalid' });
  }
  const raw = adapter.native.port;
  const port = raw === undefined ? DEFAULT_PORT : typeof raw === 'number' ? raw
    : typeof raw === 'string' && /^\d{1,5}$/.test(raw.trim()) ? Number(raw.trim()) : 0;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RuntimeRequestError('Der konfigurierte EOS-Port ist ungültig.', 0, { error: 'runtime_port_invalid' });
  }
  const secure = adapter.native.secure === undefined ? false : adapter.native.secure;
  if (typeof secure !== 'boolean') {
    throw new RuntimeRequestError('Die HTTPS-Einstellung der Adapterinstanz ist ungültig.', 0, { error: 'runtime_target_invalid' });
  }
  return { port, secure };
}

/** Genau das konfigurierte Ziel der ausgewählten Instanz; keine Port-Suche mit Zugangsdaten. */
export async function resolveRuntimeBaseUrl(_instance = getInstance(), _conn: AdminConnection | null = null): Promise<string> {
  return currentOrigin();
}

/**
 * Code-Teil: safeWindowAccess
 * Zweck: Kapselt einen lokalen Verarbeitungsschritt, damit Aufrufer nicht direkt in Detaildaten eingreifen.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
function safeWindowAccess(getter: () => unknown): unknown {
  try {
    return getter();
  } catch {
    return null;
  }
}
/**
 * Code-Teil: isErrorLike
 * Zweck: Kapselt einen lokalen Verarbeitungsschritt, damit Aufrufer nicht direkt in Detaildaten eingreifen.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
function isErrorLike(value: unknown): boolean {
  if (!value) return false;
  if (value instanceof Error) return true;
  if (typeof value === 'string') return true;
  if (!isRecord(value)) return false;

  // ioBroker objects/states can contain "message" in common/native data.
  // Treat an object as error only if it does NOT look like a normal object/state.
  const looksLikeIoBrokerObject = value._id || value.type || value.common || value.native;
  const looksLikeState = Object.prototype.hasOwnProperty.call(value, 'val') || Object.prototype.hasOwnProperty.call(value, 'ack');
  if (looksLikeIoBrokerObject || looksLikeState) return false;

  return !!(value.error || value.err || value.message);
}
/**
 * Code-Teil: normalizeIoBrokerCallback
 * Zweck: Kapselt einen lokalen Verarbeitungsschritt, damit Aufrufer nicht direkt in Detaildaten eingreifen.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
function normalizeIoBrokerCallback(cb: ReadCallback): RawCallback {
  return (arg1: unknown, arg2?: unknown) => {
    // ioBroker admin APIs are inconsistent across versions:
    //   callback(obj) / callback(state)
    //   callback(err, obj) / callback(err, state)
    // Support both, otherwise the license page can hang or misread the UUID.
    if (arg2 !== undefined) {
      cb(isErrorLike(arg1) ? arg1 : null, arg2 || null);
      return;
    }
    if (isErrorLike(arg1)) {
      cb(arg1, null);
      return;
    }
    cb(null, arg1 || null);
  };
}
/**
 * Code-Teil: pickServConn
 * Zweck: Kapselt einen lokalen Verarbeitungsschritt, damit Aufrufer nicht direkt in Detaildaten eingreifen.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
function pickServConn(): unknown {
  return (
    safeWindowAccess(() => window.servConn)
    || safeWindowAccess(() => window.parent && window.parent.servConn)
    || safeWindowAccess(() => window.top && window.top.servConn)
    || null
  );
}
/**
 * Code-Teil: pickSocket
 * Zweck: Kapselt einen lokalen Verarbeitungsschritt, damit Aufrufer nicht direkt in Detaildaten eingreifen.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
function pickSocket(): unknown {
  return (
    safeWindowAccess(() => window.socket)
    || safeWindowAccess(() => window.parent && window.parent.socket)
    || safeWindowAccess(() => window.top && window.top.socket)
    || safeWindowAccess(() => window.__nwAdminSocket)
    || null
  );
}
/**
 * Code-Teil: ensureSocketIo
 * Zweck: Kapselt einen lokalen Verarbeitungsschritt, damit Aufrufer nicht direkt in Detaildaten eingreifen.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
async function ensureSocketIo(): Promise<boolean> {
  if (window.io || pickSocket()) {
    return true;
  }

  if (typeof window.__nwSocketLoader === 'function') {
    try {
      await window.__nwSocketLoader();
    } catch {
      return false;
    }
  }

  return !!window.io || !!pickSocket();
}
/**
 * Code-Teil: wrapServConn
 * Zweck: Kapselt einen lokalen Verarbeitungsschritt, damit Aufrufer nicht direkt in Detaildaten eingreifen.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
function wrapServConn(servConn: ServConn): AdminConnection {
  return {
    type: 'servConn',
    /**
     * Code-Teil: getObject
     * Zweck: Kapselt einen lokalen Verarbeitungsschritt, damit Aufrufer nicht direkt in Detaildaten eingreifen.
     * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
     * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
     */
    getObject(id, cb) {
      try {
        servConn.getObject(id, normalizeIoBrokerCallback(cb));
      } catch (error) {
        cb(error, null);
      }
    },
    /**
     * Code-Teil: Methode `getState`
     * Zweck: liest/ermittelt Werte und kapselt Fallback- oder Mapping-Logik.
     * Zusammenhang: Hängt an Admin-/JSONConfig-Bridge und Installer-Weiterleitungen; Änderungen müssen mit admin/* und main.js kompatibel bleiben.
     * TypeScript-Hinweis: Die Verbindung normalisiert Rückrufe; Nutzdaten werden an der Leseschnittstelle geprüft.
     */
    /**
     * Code-Teil: getState
     * Zweck: Kapselt einen lokalen Verarbeitungsschritt, damit Aufrufer nicht direkt in Detaildaten eingreifen.
     * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
     * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
     */
    getState(id, cb) {
      if (typeof servConn.getState !== 'function') {
        cb(null, null);
        return;
      }
      try {
        servConn.getState(id, normalizeIoBrokerCallback(cb));
      } catch (error) {
        cb(error, null);
      }
    },
    /**
     * Code-Teil: Methode `setObject`
     * Zweck: schreibt Werte in ioBroker-States, DOM-Felder oder lokale Laufzeitstrukturen.
     * Zusammenhang: Hängt an Admin-/JSONConfig-Bridge und Installer-Weiterleitungen; Änderungen müssen mit admin/* und main.js kompatibel bleiben.
     * TypeScript-Hinweis: Die Verbindung normalisiert Rückrufe; Nutzdaten werden an der Leseschnittstelle geprüft.
     */
    /**
     * Code-Teil: setObject
     * Zweck: Setzt Werte im DOM, Cache, State oder in der Konfiguration.
     * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
     * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
     */
    setObject(id, obj, cb) {
      try {
        servConn.setObject(id, obj, err => cb(err || null));
      } catch (error) {
        cb(error);
      }
    },
  };
}
/**
 * Code-Teil: wrapSocket
 * Zweck: Kapselt einen lokalen Verarbeitungsschritt, damit Aufrufer nicht direkt in Detaildaten eingreifen.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
function wrapSocket(socket: AdminSocket): AdminConnection {
  return {
    type: 'socket',
    /**
     * Code-Teil: getObject
     * Zweck: Kapselt einen lokalen Verarbeitungsschritt, damit Aufrufer nicht direkt in Detaildaten eingreifen.
     * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
     * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
     */
    getObject(id, cb) {
      try {
        socket.emit('getObject', id, normalizeIoBrokerCallback(cb));
      } catch (error) {
        cb(error, null);
      }
    },
    /**
     * Code-Teil: Methode `getState`
     * Zweck: liest/ermittelt Werte und kapselt Fallback- oder Mapping-Logik.
     * Zusammenhang: Hängt an Admin-/JSONConfig-Bridge und Installer-Weiterleitungen; Änderungen müssen mit admin/* und main.js kompatibel bleiben.
     * TypeScript-Hinweis: Die Verbindung normalisiert Rückrufe; Nutzdaten werden an der Leseschnittstelle geprüft.
     */
    /**
     * Code-Teil: getState
     * Zweck: Kapselt einen lokalen Verarbeitungsschritt, damit Aufrufer nicht direkt in Detaildaten eingreifen.
     * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
     * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
     */
    getState(id, cb) {
      try {
        socket.emit('getState', id, normalizeIoBrokerCallback(cb));
      } catch (error) {
        cb(error, null);
      }
    },
    /**
     * Code-Teil: Methode `setObject`
     * Zweck: schreibt Werte in ioBroker-States, DOM-Felder oder lokale Laufzeitstrukturen.
     * Zusammenhang: Hängt an Admin-/JSONConfig-Bridge und Installer-Weiterleitungen; Änderungen müssen mit admin/* und main.js kompatibel bleiben.
     * TypeScript-Hinweis: Die Verbindung normalisiert Rückrufe; Nutzdaten werden an der Leseschnittstelle geprüft.
     */
    /**
     * Code-Teil: setObject
     * Zweck: Setzt Werte im DOM, Cache, State oder in der Konfiguration.
     * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
     * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
     */
    setObject(id, obj, cb) {
      try {
        socket.emit('setObject', id, obj, (result: unknown) => {
          if (!result || result === true) {
            cb(null);
            return;
          }
          if (typeof result === 'string') {
            cb(result);
            return;
          }
          if (isRecord(result) && result.error) {
            cb(result.error);
            return;
          }
          cb(null);
        });
      } catch (error) {
        cb(error);
      }
    },
  };
}

/**
 * Code-Teil: getAdminConnection
 * Zweck: Kapselt einen lokalen Verarbeitungsschritt, damit Aufrufer nicht direkt in Detaildaten eingreifen.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
export async function getAdminConnection(): Promise<AdminConnection | null> {
  const servConn = pickServConn();
  if (isServConn(servConn)) {
    return wrapServConn(servConn);
  }

  const socketAlreadyThere = pickSocket();
  if (isAdminSocket(socketAlreadyThere)) {
    return wrapSocket(socketAlreadyThere);
  }

  const socketIoLoaded = await withTimeout(ensureSocketIo(), 3000, 'socket.io Laden');
  if (!socketIoLoaded) {
    return null;
  }

  let socket = pickSocket();
  if (!socket && isSocketIoClient(window.io)) {
    window.__nwAdminSocket = window.__nwAdminSocket || window.io.connect();
    socket = window.__nwAdminSocket;
  }

  if (isAdminSocket(socket)) {
    return wrapSocket(socket);
  }

  return null;
}

/**
 * Code-Teil: extractUuid
 * Zweck: Kapselt einen lokalen Verarbeitungsschritt, damit Aufrufer nicht direkt in Detaildaten eingreifen.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
export function extractUuid(obj: unknown): string {
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const seen = new Set<object>();

  /**
   * Code-Teil: Arrow-Funktion `scan`
   * Zweck: durchsucht ioBroker-Metadaten nach dem bisherigen UUID-Vertrag und erkennt zyklische Objekte.
   * Zusammenhang: Hängt an Admin-/JSONConfig-Bridge und Installer-Weiterleitungen; Änderungen müssen mit admin/* und main.js kompatibel bleiben.
   * TypeScript-Hinweis: Die Verbindung normalisiert Rückrufe; Nutzdaten werden an der Leseschnittstelle geprüft.
   */
  const scan = (value: unknown, key = ''): string => {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') {
      const v = value.trim();
      if (!v) return '';
      if (/uuid/i.test(key) || uuidRe.test(v)) return v;
      return '';
    }
    if (!isRecord(value) && !Array.isArray(value)) return '';
    if (seen.has(value)) return '';
    seen.add(value);

    const preferredKeys = ['uuid', 'UUID', '_uuid', 'systemUuid', 'systemUUID', 'val', 'value'];
    for (const k of preferredKeys) {
      if (Object.prototype.hasOwnProperty.call(value, k)) {
        const found = scan(Object.getOwnPropertyDescriptor(value, k)?.value, k);
        if (found) return found;
      }
    }
    for (const [k, v] of Object.entries(value)) {
      const found = scan(v, k);
      if (found) return found;
    }
    return '';
  };

  return scan(obj);
}

/**
 * Code-Teil: getObject
 * Zweck: Kapselt einen lokalen Verarbeitungsschritt, damit Aufrufer nicht direkt in Detaildaten eingreifen.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
export async function getObject(id: string, conn: AdminConnection | null = null): Promise<IoBrokerObject | null> {
  const resolvedConn = conn || (await getAdminConnection());
  if (!resolvedConn) {
    throw new Error('Admin-Verbindung nicht verfügbar');
  }
  const result = await callbackPromise(cb => resolvedConn.getObject(id, cb), `getObject ${id}`);
  if (result === null || isIoBrokerObject(result)) return result;
  throw new Error('Ungültige Admin-Objektantwort.');
}

/**
 * Code-Teil: getState
 * Zweck: Kapselt einen lokalen Verarbeitungsschritt, damit Aufrufer nicht direkt in Detaildaten eingreifen.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
export async function getState(id: string, conn: AdminConnection | null = null): Promise<IoBrokerState | null> {
  const resolvedConn = conn || (await getAdminConnection());
  if (!resolvedConn || typeof resolvedConn.getState !== 'function') {
    return null;
  }
  const result = await callbackPromise(cb => resolvedConn.getState(id, cb), `getState ${id}`);
  if (result === null || isRecord(result)) return result;
  throw new Error('Ungültige Admin-State-Antwort.');
}

/**
 * Code-Teil: setObject
 * Zweck: Setzt Werte im DOM, Cache, State oder in der Konfiguration.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
export async function setObject(id: string, obj: unknown, conn: AdminConnection | null = null): Promise<void> {
  const resolvedConn = conn || (await getAdminConnection());
  if (!resolvedConn) {
    throw new Error('Admin-Verbindung nicht verfügbar');
  }
  await callbackPromise(cb => resolvedConn.setObject(id, obj, cb), `setObject ${id}`);
}

/**
 * Code-Teil: readAdapterPort
 * Zweck: Liest Werte mit Fallbacks aus Cache/State/Config.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
export async function readAdapterPort(instance = getInstance(), conn: AdminConnection | null = null): Promise<number> {
  try {
    const adapterObj = await getObject(getAdapterObjectId(instance), conn);
    const value = adapterObj?.native?.port;
    // Alte Admin-Konfigurationen können den Port als Dezimaltext gespeichert haben.
    const port = typeof value === 'number' ? value
      : typeof value === 'string' && /^\d{1,5}$/.test(value.trim()) ? Number(value) : 0;
    return Number.isInteger(port) && port > 0 && port <= 65535 ? port : DEFAULT_PORT;
  } catch {
    return DEFAULT_PORT;
  }
}

/**
 * Code-Teil: readSystemUuid
 * Zweck: Liest Werte mit Fallbacks aus Cache/State/Config.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
export async function readSystemUuid(conn: AdminConnection | null = null, instance = getInstance()): Promise<string> {
  const adapterBase = `${ADAPTER_NAME}.${instance}.license.uuid`;

  try {
    const metaObject = await getObject('system.meta.uuid', conn);
    const fromObject = extractUuid(metaObject);
    if (fromObject) return String(fromObject).trim();
  } catch {
    // ignore and continue with state fallback
  }

  try {
    const state = await getState('system.meta.uuid', conn);
    if (state?.val !== undefined && state?.val !== null && String(state.val).trim()) {
      return String(state.val).trim();
    }
  } catch {
    // ignore and continue with system.config fallback
  }

  try {
    const systemConfig = await getObject('system.config', conn);
    const nativeUuid = systemConfig?.native?.uuid || systemConfig?.native?.UUID || systemConfig?.common?.uuid || systemConfig?.common?.UUID;
    if (nativeUuid) return String(nativeUuid).trim();
  } catch {
    // ignore and continue with adapter-published fallback
  }

  try {
    const adapterUuidState = await getState(adapterBase, conn);
    if (adapterUuidState?.val !== undefined && adapterUuidState?.val !== null && String(adapterUuidState.val).trim()) {
      return String(adapterUuidState.val).trim();
    }
  } catch {
    // ignore
  }

  return '';
}
/**
 * Code-Teil: fetchJsonWithTimeout
 * Zweck: Holt Daten über HTTP/API oder aus externen Quellen.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
async function fetchJsonWithTimeout(url: string, ms = RUNTIME_FETCH_TIMEOUT_MS, options: RuntimeFetchOptions = {}): Promise<JsonRecord> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  try {
    timer = setTimeout(() => { timedOut = true; controller.abort(); }, ms);
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'error',
      credentials: options.credentials || 'omit',
      headers: options.headers || undefined,
      signal: controller.signal,
    });
    return await readApiResponse(response, controller, options.adminProxy === true);
  } catch (error) {
    if (timedOut) throw new RuntimeRequestError('Der UI-Adapter antwortet nicht rechtzeitig. Bitte Verbindung und Adapterstatus prüfen.', 0, { error: 'runtime_timeout' });
    if (error instanceof RuntimeRequestError) throw error;
    throw new RuntimeRequestError('Die Verbindung zum UI-Adapter ist nicht erreichbar. Bitte Zugriffspfad und Adapterstatus prüfen.', 0, { error: 'runtime_network_error' });
  } finally {
    if (timer) clearTimeout(timer);
  }
}
/**
 * Code-Teil: postJsonWithTimeout
 * Zweck: Kapselt einen lokalen Verarbeitungsschritt, damit Aufrufer nicht direkt in Detaildaten eingreifen.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
async function postJsonWithTimeout(url: string, payload: unknown, ms = RUNTIME_FETCH_TIMEOUT_MS, options: RuntimeFetchOptions = {}): Promise<JsonRecord> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  try {
    timer = setTimeout(() => { timedOut = true; controller.abort(); }, ms);
    const response = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      redirect: 'error',
      credentials: options.credentials || 'omit',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: JSON.stringify(payload || {}),
      signal: controller.signal,
    });
    return await readApiResponse(response, controller, options.adminProxy === true);
  } catch (error) {
    if (timedOut) throw new RuntimeRequestError('Der UI-Adapter antwortet nicht rechtzeitig. Bitte Verbindung und Adapterstatus prüfen.', 0, { error: 'runtime_timeout' });
    if (error instanceof RuntimeRequestError) throw error;
    throw new RuntimeRequestError('Die Verbindung zum UI-Adapter ist nicht erreichbar. Bitte Zugriffspfad und Adapterstatus prüfen.', 0, { error: 'runtime_network_error' });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Ein autoritatives Ziel pro API-Aufruf. Frist umfasst Zielermittlung und HTTP-Body;
 * Zugangsdaten, Lizenzschlüssel und Mutationen werden nach Fehlern nie weitergesendet.
 * Die 6/12-s-Authentifizierungsbudgets gelten nur für lokale Konten-/Gruppenabfragen,
 * nicht für externe Wetter-/Preisabrufe oder bestehende 5-s-Konfigurationsverträge.
 */
async function requestRuntimeApi(path: string, payload: unknown = null, timeoutMs = 6000,
  instance = getInstance(), conn: AdminConnection | null = null): Promise<JsonRecord> {
  const deadline = Date.now() + timeoutMs;
  const base = await resolveRuntimeBaseUrl(instance, conn);
  let remaining = deadline - Date.now();
  if (remaining <= 0) throw new RuntimeRequestError('Der UI-Adapter antwortet nicht rechtzeitig. Bitte Verbindung und Adapterstatus prüfen.', 0, { error: 'runtime_timeout' });
  const options: RuntimeFetchOptions = { credentials: 'include', adminProxy: base.includes('/proxy/nexowatt-ui.') };
  const url = base + path;
  if (payload !== null) {
    // Keine Passwörter/CSRF-Token an einen anderen Origin; der konfigurierte
    // Admin-Instanzproxy hält auch separate Runtime-Prozesse am selben Ursprung.
    if (new URL(url).origin !== window.location.origin) {
      throw new RuntimeRequestError('Schreibzugriffe benötigen den gemeinsamen HTTPS-Zugang zur UI.', 0, { error: 'runtime_same_origin_required' });
    }
    if (!/^\/api\/(?:auth|strict-auth)\/login(?:\?|$)/.test(path)) {
      const status = parseRuntimeAuthStatus(await fetchJsonWithTimeout(base + '/api/auth/status', remaining, options));
      if (!status.authed || !status.configured || !status.csrfToken) throw new RuntimeRequestError('Anmeldung erforderlich.', 401, { error: 'authentication_required' });
      options.headers = { 'X-NW-CSRF': status.csrfToken };
      remaining = deadline - Date.now();
      if (remaining <= 0) throw new RuntimeRequestError('Die Berechtigungsprüfung hat das Zeitbudget überschritten.', 0, { error: 'runtime_timeout' });
    }
  }
  return payload === null ? fetchJsonWithTimeout(url, remaining, options) : postJsonWithTimeout(url, payload, remaining, options);
}

/** Separater Einstieg statt Kennwortmaske im Admin-Frame; Profilwahl erfolgt auf der Loginseite. */
export async function resolveRuntimeLoginUrl(instance = getInstance(), conn: AdminConnection | null = null): Promise<string> {
  const base = await resolveRuntimeBaseUrl(instance, conn);
  const target = new URL(base + '/login.html');
  if (target.username || target.password || (target.protocol !== 'https:'
    && !(target.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(target.hostname)))) {
    throw new RuntimeRequestError('Die Anmeldung benötigt einen HTTPS-Zugang.', 0, { error: 'runtime_secure_route_required' });
  }
  return target.href;
}

/** Lokalen EOS-Status über dieselbe Instanzroute wie Anmeldung und Fach-APIs prüfen. */
export async function readRuntimeAuthStatus(instance = getInstance(), conn: AdminConnection | null = null): Promise<RuntimeAuthStatus> {
  return parseRuntimeAuthStatus(await requestRuntimeApi(`/api/strict-auth/status?instance=${encodeURIComponent(checkedInstance(instance))}&t=${Date.now()}`, null, 6000, instance, conn));
}

/** Eigenes Kontopasswort nur einmal an das ausgewählte, abgesicherte Ziel senden. */
export async function loginRuntimeAuth(instance = getInstance(), user = '', password = '', conn: AdminConnection | null = null): Promise<RuntimeAuthStatus> {
  return parseRuntimeAuthStatus(await requestRuntimeApi(`/api/strict-auth/login?instance=${encodeURIComponent(checkedInstance(instance))}&t=${Date.now()}`,
    { user: String(user || '').trim(), password: String(password || '') }, 12000, instance, conn));
}

/** Genau die über denselben Cookie-Pfad angelegte EOS-Sitzung beenden. */
export async function logoutRuntimeAuth(instance = getInstance(), conn: AdminConnection | null = null): Promise<{ ok: true }> {
  await requestRuntimeApi(`/api/strict-auth/logout?instance=${encodeURIComponent(checkedInstance(instance))}&t=${Date.now()}`, {}, 6000, instance, conn);
  return { ok: true };
}

/** Lizenzzugriffe teilen dieselbe Instanzroute und deren HttpOnly-Sitzung. */
export async function readRuntimeLicenseInfo(instance = getInstance(), conn: AdminConnection | null = null): Promise<JsonRecord | null> {
  return requestRuntimeApi(`/api/license/info?instance=${encodeURIComponent(checkedInstance(instance))}&t=${Date.now()}`, null, 6000, instance, conn);
}

/** Kein Wiederholen von Lizenzmutationen nach Fehlern oder Zeitablauf. */
export async function saveRuntimeLicenseKey(instance = getInstance(), licenseKey = '', conn: AdminConnection | null = null): Promise<JsonRecord | null> {
  return requestRuntimeApi(`/api/license/save?instance=${encodeURIComponent(checkedInstance(instance))}&t=${Date.now()}`,
    { licenseKey: String(licenseKey || '').trim() }, 6000, instance, conn);
}

/**
 * Code-Teil: readLicenseStatus
 * Zweck: Liest Werte mit Fallbacks aus Cache/State/Config.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
export async function readLicenseStatus(instance = getInstance(), conn: AdminConnection | null = null): Promise<{ ok: boolean; text: string }> {
  const resolvedConn = conn || (await getAdminConnection());
  if (!resolvedConn) {
    return {
      ok: false,
      text: 'Admin-Verbindung nicht verfügbar.',
    };
  }

  const base = `${ADAPTER_NAME}.${instance}.license.`;
  try {
    const [validState, typeState, messageState, daysState, expiresState] = await Promise.all([
      getState(`${base}valid`, resolvedConn),
      getState(`${base}type`, resolvedConn),
      getState(`${base}message`, resolvedConn),
      getState(`${base}daysRemaining`, resolvedConn),
      getState(`${base}expiresAt`, resolvedConn),
    ]);

    const valid = validState?.val === true;
    const type = typeState?.val !== undefined ? String(typeState.val) : '';
    const message = messageState?.val !== undefined ? String(messageState.val) : '';
    const daysRemaining = daysState?.val !== undefined ? Number(daysState.val) || 0 : 0;
    const expiresAt = expiresState?.val !== undefined ? Number(expiresState.val) || 0 : 0;

    if (type === 'trial') {
      const active = valid && daysRemaining > 0;
      let text = active
        ? `Lizenzstatus: Testlizenz aktiv – noch ${daysRemaining} Tage ✅`
        : 'Lizenzstatus: Testlizenz abgelaufen ❌';
      if (expiresAt) {
        try {
          text += ` (bis ${new Date(expiresAt).toLocaleDateString()})`;
        } catch {
          // ignore date formatting errors
        }
      }
      return { ok: active, text };
    }

    if (valid) {
      return { ok: true, text: 'Lizenzstatus: gültig ✅' };
    }

    return {
      ok: false,
      text: `Lizenzstatus: ${message || 'gesperrt/ungültig'} ❌`,
    };
  } catch {
    return { ok: true, text: 'Lizenzstatus konnte nicht gelesen werden. Adapter evtl. noch nicht gestartet.' };
  }
}

/**
 * Code-Teil: openExternal
 * Zweck: Öffnet Dialoge/Seiten/Popovers.
 * Zusammenhang: Teil von React-Admin-Quelle; Aufrufstellen und abhängige States/APIs beim Ändern mitprüfen.
 * TypeScript: Parameter und Ergebnisse sind strikt typisiert; externe Werte werden vor Verwendung geprüft.
 */
export function openExternal(url: string): void {
  try {
    (window.top || window).location.href = url;
  } catch {
    window.location.href = url;
  }
}

/** Dedicated mail endpoint never returns the password to the browser. */
/**
 * Ablauf und Zusammenhang: Ruft den dedizierten Mail-Endpunkt der Adapter-Runtime mit EOS-Sitzung auf. Ohne Payload wird gelesen, mit Payload gespeichert; 400/401/403 werden sofort weitergegeben, statt durch einen anderen Port eine Autorisierung zu umgehen.
 */
export async function notificationMailRequest(payload: unknown = null): Promise<unknown> {
  return requestRuntimeApi('/api/installer/notification-mail', payload, 10000);
}

/** Installer history: bounded same-origin request, shared EOS session/CSRF, no mutation retry. */
export async function historySetupRequest(suffix = '', payload: unknown = null): Promise<unknown> {
  if (!['', '/check'].includes(suffix)) throw new Error('Ungültiger Historie-Aufruf.');
  return requestRuntimeApi(`/api/installer/history${suffix}`, payload, 15000);
}

/** Geschützte Mesh-API nutzt dieselbe Instanzroute; kein erneutes Senden nach Fehlern. */
export async function meshCoordinatorRequest(suffix = '', payload: unknown = null): Promise<unknown> {
  return requestRuntimeApi(`/api/mesh/coordinator${suffix}`, payload, 10000);
}

/** Dynamischer Netzanschluss: gemeinsames 5-s-Budget und keine Mutationswiederholung. */
export async function dynamicGridRequest(suffix = '', payload: unknown = null): Promise<unknown> {
  if (!['', '/status', '/config', '/preview'].includes(suffix)) throw new Error('Ungültiger Netzanschluss-Aufruf.');
  return requestRuntimeApi(`/api/dynamic-grid${suffix}`, payload, 5000);
}

/** Partnerfreigaben: dasselbe 5-s-Budget, keine zweite Instanz und kein Mutationsretry. */
export async function partnerIntegrationsRequest(suffix = '', payload: unknown = null): Promise<unknown> {
  if (!['', '/config', '/preview', '/revoke'].includes(suffix)) throw new Error('Ungültiger Partner-Aufruf.');
  return requestRuntimeApi(`/api/installer/partner-integrations${suffix}`, payload, 5000);
}
