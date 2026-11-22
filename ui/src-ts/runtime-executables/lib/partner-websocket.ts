/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Begrenzt ausgehende Partner-WSS-Sitzungen, ohne Geräte oder States zu schreiben.
 * Daten und Wirkung: Prüft feste Ziele, TLS, Freigaben, Fristen und Puffer; liefert nur
 * begrenzte Texte an den separat autorisierenden Partnerdienst. Identität stammt aus
 * lokaler Konfiguration. Geheimnisse und fremde Fehlertexte werden nie protokolliert.
 * Bei Änderungen: DNS-Pinning, echte Abbrüche, Widerruf, Wiederanlauf und Last gemeinsam
 * prüfen; die fachliche Befehlslaufzeit ist unabhängig vom Socket-Heartbeat.
 * Verknüpfungen: docs/QUELLCODE_VERKNUEPFUNGEN_DE.md; partner-runtime als Aufrufer.
 */
import WebSocket, { type ClientOptions, type RawData } from 'ws';
import { Resolver } from 'node:dns/promises';
import { BlockList, isIP, type LookupFunction } from 'node:net';
import { checkServerIdentity, TLSSocket } from 'node:tls';
import { X509Certificate } from 'node:crypto';
import { performance } from 'node:perf_hooks';

export const PARTNER_WS_LIMITS = Object.freeze({
  attemptMs: 5000, maxPayloadBytes: 64 * 1024, maxBufferedBytes: 128 * 1024,
  maxQueuedMessages: 16, maxFramesPerWindow: 100, rateWindowMs: 10000,
  maxInboundBytesPerWindow: 256 * 1024, heartbeatMs: 15000, authorizationPollMs: 1000,
  reconnectMinMs: 1000, reconnectMaxMs: 60000, maxFragments: 128, maxDnsAnswers: 32,
});
export type PartnerSocketState = 'stopped' | 'connecting' | 'open' | 'backoff' | 'blocked';
export type PartnerSocketCode = 'stopped' | 'connecting' | 'connected' | 'network_error'
  | 'invalid_config' | 'target_forbidden' | 'authentication_expired' | 'authorization_revoked'
  | 'attempt_timeout' | 'protocol_error' | 'resource_limit' | 'heartbeat_timeout' | 'handler_error';
export interface PartnerWebSocketConfig {
  readonly partnerId: string;
  readonly endpoint: string;
  readonly allowedEndpoint: Readonly<{ hostname: string; port: number; path: string }>;
  readonly credentials: Readonly<{
    expiresAtMs: number;
    bearerToken?: string;
    clientCertPem?: string;
    clientKeyPem?: string;
    caPem?: string;
  }>;
  /** Ausschließlich einzeln geprüfte private VPN-Adressen; keine CIDR-Wildcards. */
  readonly privateVpnAddresses?: readonly string[];
}
export interface PartnerWebSocketHooks {
  readonly isAuthorized: () => boolean;
  readonly onMessage: (partnerId: string, text: string, context: PartnerMessageContext) => void | Promise<void>;
  readonly onState: (state: PartnerSocketState, code: PartnerSocketCode) => void;
  readonly onOpen?: () => void;
}
export interface PartnerMessageContext {
  readonly isCurrent: () => boolean;
  readonly send: (text: string) => boolean;
  readonly signal: AbortSignal;
}
export interface PartnerResolvedAddress { readonly address: string; readonly family: 4 | 6; }
// Ergänzungen sind in ws dokumentiert; ältere Typdefinitionen führen sie noch nicht.
export type PartnerSocketOptions = ClientOptions & {
  maxFragments: number; maxBufferedChunks: number; servername: string;
  lookup: LookupFunction; family: 4 | 6; maxHeaderSize: number;
};
export interface PartnerWebSocketDependencies {
  readonly resolve?: (hostname: string, signal: AbortSignal) => Promise<readonly PartnerResolvedAddress[]>;
  readonly socketFactory?: (url: string, protocol: string, options: PartnerSocketOptions) => WebSocket;
  readonly wallNow?: () => number;
  readonly monotonicNow?: () => number;
  readonly random?: () => number;
}

const protocol = 'nexowatt.partner.v1';
const forbidden4 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) forbidden4.addSubnet(address, prefix, 'ipv4');
const privateAddresses = new BlockList();
privateAddresses.addSubnet('10.0.0.0', 8, 'ipv4');
privateAddresses.addSubnet('172.16.0.0', 12, 'ipv4');
privateAddresses.addSubnet('192.168.0.0', 16, 'ipv4');
privateAddresses.addSubnet('100.64.0.0', 10, 'ipv4');
privateAddresses.addSubnet('fc00::', 7, 'ipv6');
const public6 = new BlockList(); public6.addSubnet('2000::', 3, 'ipv6');
const forbidden6 = new BlockList();
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]] as const) {
  forbidden6.addSubnet(address, prefix, 'ipv6');
}
const metadataAddresses = new BlockList();
metadataAddresses.addAddress('100.100.100.200', 'ipv4');
metadataAddresses.addAddress('168.63.129.16', 'ipv4');

/** Nur globale Unicast-Ziele oder explizit benannte private VPN-Adressen zulassen. */
export function isPartnerAddressAllowed(address: string, vpnAddresses: readonly string[] = []): boolean {
  const family = isIP(address);
  if (!family || address.includes('%')) return false;
  const kind = family === 4 ? 'ipv4' : 'ipv6';
  // Auch ausdrücklich freigegebene VPN-Listen öffnen keine bekannten Cloud-Dienstadressen.
  if (metadataAddresses.check(address, kind)) return false;
  if (privateAddresses.check(address, kind)) {
    // Net.BlockList vergleicht IPv6 kanonisch; gleichwertige Schreibweisen bleiben eindeutig.
    return vpnAddresses.some(candidate => {
      if (isIP(candidate) !== family) return false;
      const exact = new BlockList(); exact.addAddress(candidate, kind);
      return exact.check(address, kind);
    });
  }
  return family === 4 ? !forbidden4.check(address, 'ipv4')
    : public6.check(address, 'ipv6') && !forbidden6.check(address, 'ipv6');
}

/** DNS-Aufträge besitzen einen echten Abbruch; kein weiterlaufendes Promise.race. */
async function resolvePartner(hostname: string, signal: AbortSignal): Promise<readonly PartnerResolvedAddress[]> {
  const resolver = new Resolver({ timeout: PARTNER_WS_LIMITS.attemptMs, tries: 1 });
  const abort = (): void => resolver.cancel();
  if (signal.aborted) throw new Error('attempt_timeout');
  signal.addEventListener('abort', abort, { once: true });
  try {
    const results = await Promise.allSettled([resolver.resolve4(hostname), resolver.resolve6(hostname)]);
    if (signal.aborted) throw new Error('attempt_timeout');
    const addresses: PartnerResolvedAddress[] = [];
    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        for (const address of result.value) addresses.push({ address, family: index === 0 ? 4 : 6 });
      }
    }
    return addresses;
  } finally { signal.removeEventListener('abort', abort); }
}

/** URL exakt an das lokal freigegebene Profil binden; keine URL-Geheimnisse/Redirects. */
function validHostname(hostname: string): boolean {
  if (hostname.length > 253) return false;
  const labels = hostname.split('.');
  return labels.length >= 2 && (labels.at(-1)?.length || 0) >= 2
    && labels.every(label => label.length >= 1 && label.length <= 63
      && /^[a-z0-9-]+$/u.test(label) && !label.startsWith('-') && !label.endsWith('-'));
}

/** Lineare Labelprüfung vermeidet verschachtelte Wiederholungen an der URL-Grenze. */
export function validatePartnerEndpoint(config: PartnerWebSocketConfig): URL {
  try {
    if (typeof config.endpoint !== 'string' || config.endpoint.length > 2048
      || /[\u0000-\u0020\u007f\\]/u.test(config.endpoint)) throw new Error();
    const url = new URL(config.endpoint);
    const allowed = config.allowedEndpoint;
    if (url.protocol !== 'wss:' || url.username || url.password || url.search || url.hash
      || url.hostname !== allowed.hostname || url.hostname.endsWith('.') || isIP(url.hostname)
      || !validHostname(url.hostname)
      || Number(url.port || 443) !== allowed.port || url.pathname !== allowed.path
      || !Number.isInteger(allowed.port) || allowed.port < 1 || allowed.port > 65535
      || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/u.test(config.partnerId)) throw new Error();
    return url;
  } catch { throw new Error('invalid_config'); }
}

/** Eine Instanz je Partner; Konfigurationswechsel erfordert stop() und neue Instanz. */
export class PartnerWebSocketClient {
  private readonly config: PartnerWebSocketConfig;
  private readonly hooks: PartnerWebSocketHooks;
  private readonly dependencies: PartnerWebSocketDependencies;
  private readonly endpoint: URL;
  private readonly wallNow: () => number;
  private readonly monotonicNow: () => number;
  private readonly credentialDeadline: number;
  private readonly expiresAtMs: number;
  private running = false;
  private generation = 0;
  private socket: WebSocket | null = null;
  private controller: AbortController | null = null;
  private deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private failures = 0;
  private peerExpiresAt = Number.POSITIVE_INFINITY;
  private peerDeadline = Number.POSITIVE_INFINITY;
  private pongPendingAt = 0;
  private nextPingAt = 0;
  private rateStart = 0;
  private rateFrames = 0;
  private rateBytes = 0;
  private queue: string[] = [];
  private queueBytes = 0;
  private processingGeneration: number | null = null;

  constructor(config: PartnerWebSocketConfig, hooks: PartnerWebSocketHooks, dependencies: PartnerWebSocketDependencies = {}) {
    this.endpoint = validatePartnerEndpoint(config);
    this.config = Object.freeze({ ...config,
      allowedEndpoint: Object.freeze({ ...config.allowedEndpoint }),
      credentials: Object.freeze({ ...config.credentials }),
      privateVpnAddresses: Object.freeze([...(config.privateVpnAddresses || [])]),
    });
    this.hooks = hooks;
    this.dependencies = dependencies;
    this.wallNow = dependencies.wallNow || Date.now;
    this.monotonicNow = dependencies.monotonicNow || (() => performance.now());
    const credentials = this.config.credentials;
    let expires = credentials.expiresAtMs;
    try {
      for (const pem of [credentials.clientCertPem, credentials.clientKeyPem, credentials.caPem]) {
        if (pem !== undefined && (typeof pem !== 'string' || pem.length > 128 * 1024)) throw new Error();
      }
      if (!Number.isSafeInteger(expires) || expires <= this.wallNow()
        || Boolean(credentials.clientCertPem) !== Boolean(credentials.clientKeyPem)
        || (!credentials.bearerToken && !credentials.clientCertPem)
        || (credentials.bearerToken !== undefined && (!/^[A-Za-z0-9._~+/-]+=*$/u.test(credentials.bearerToken)
          || credentials.bearerToken.length < 16 || credentials.bearerToken.length > 8192))) throw new Error();
      if (credentials.clientCertPem) {
        const certificate = new X509Certificate(credentials.clientCertPem);
        if (Date.parse(certificate.validFrom) > this.wallNow()) throw new Error();
        expires = Math.min(expires, Date.parse(certificate.validTo));
      }
      if (!Number.isFinite(expires) || expires <= this.wallNow()) throw new Error();
      if ((this.config.privateVpnAddresses || []).length > PARTNER_WS_LIMITS.maxDnsAnswers) throw new Error();
      for (const address of this.config.privateVpnAddresses || []) {
        const family = isIP(address);
        if (!family || !privateAddresses.check(address, family === 4 ? 'ipv4' : 'ipv6')) throw new Error();
      }
    } catch { throw new Error('invalid_config'); }
    this.expiresAtMs = expires;
    this.credentialDeadline = this.monotonicNow() + expires - this.wallNow();
  }

  /** Start ist idempotent; abgelaufene/widerrufene Freigaben verhindern jeden Aufbau. */
  start(): void {
    if (this.running) return;
    this.running = true;
    void this.connect();
  }

  /** Sofortiger Abbruch verwirft Puffer; fachliche Leases widerruft der aufrufende Dienst. */
  stop(): void {
    this.running = false;
    this.cleanup();
    this.state('stopped', 'stopped');
  }

  /** Keine Offline-Sendewarteschlange. Vor jeder Aussendung erneut lokal autorisieren. */
  send(text: string): boolean {
    if (!this.authorized()) return false;
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN || typeof text !== 'string') return false;
    const size = Buffer.byteLength(text, 'utf8');
    if (size > PARTNER_WS_LIMITS.maxPayloadBytes || socket.bufferedAmount + size > PARTNER_WS_LIMITS.maxBufferedBytes) {
      this.fail('resource_limit'); return false;
    }
    const generation = this.generation;
    try {
      socket.send(text, { binary: false, compress: false }, error => {
        if (error && generation === this.generation) this.fail('network_error');
      });
      return true;
    } catch { this.fail('network_error'); return false; }
  }

  private state(state: PartnerSocketState, code: PartnerSocketCode): void {
    try { this.hooks.onState(state, code); } catch {
      // Ein defekter Lifecycle-Empfänger darf keine unüberwachte Sitzung offen halten.
      this.running = false; this.cleanup();
    }
  }

  private authorized(): boolean {
    if (!this.running) return false;
    const now = this.wallNow(); const monotonic = this.monotonicNow();
    if (!Number.isFinite(now) || !Number.isFinite(monotonic) || now >= this.expiresAtMs
      || monotonic >= this.credentialDeadline || now >= this.peerExpiresAt || monotonic >= this.peerDeadline) {
      this.block('authentication_expired'); return false;
    }
    try { if (this.hooks.isAuthorized() === true) return true; } catch { /* Nicht freigegeben. */ }
    this.block('authorization_revoked'); return false;
  }

  private block(code: PartnerSocketCode): void {
    this.running = false; this.cleanup(); this.state('blocked', code);
  }

  /** Alle Timer, DNS-Aufträge und TCP/TLS-Sockets tatsächlich abbrechen. */
  private cleanup(): void {
    this.generation++;
    if (this.deadlineTimer) clearTimeout(this.deadlineTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.deadlineTimer = null; this.reconnectTimer = null; this.heartbeatTimer = null;
    this.controller?.abort(); this.controller = null;
    const socket = this.socket; this.socket = null;
    if (socket) { try { socket.terminate(); } catch { /* Bereits geschlossen. */ } }
    this.queue = []; this.queueBytes = 0;
    this.pongPendingAt = 0;
  }

  /** Fehler erzeugen begrenzten Backoff; niemals rekursive Sofort-Wiederholungen. */
  private fail(code: PartnerSocketCode): void {
    this.cleanup();
    if (!this.authorized()) return;
    this.state('backoff', code);
    if (!this.running) return;
    const random = this.dependencies.random ? this.dependencies.random() : Math.random();
    const jitter = Number.isFinite(random) ? Math.min(1, Math.max(0, random)) : 0.5;
    const delay = Math.min(PARTNER_WS_LIMITS.reconnectMaxMs,
      PARTNER_WS_LIMITS.reconnectMinMs * 2 ** Math.min(this.failures++, 6)) * (0.75 + jitter * 0.25);
    this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; void this.connect(); }, delay);
    this.reconnectTimer.unref();
  }

  /** Ein 5-s-Gesamtbudget umfasst DNS, TLS und HTTP-Authentifizierung im Upgrade. */
  private async connect(): Promise<void> {
    this.peerExpiresAt = Number.POSITIVE_INFINITY; this.peerDeadline = Number.POSITIVE_INFINITY;
    if (!this.authorized()) return;
    const generation = ++this.generation;
    const start = this.monotonicNow();
    const controller = new AbortController(); this.controller = controller;
    this.state('connecting', 'connecting');
    if (generation !== this.generation || !this.authorized()) return;
    this.deadlineTimer = setTimeout(() => {
      if (generation === this.generation) this.fail('attempt_timeout');
    }, PARTNER_WS_LIMITS.attemptMs);
    this.deadlineTimer.unref();
    try {
      const addresses = await (this.dependencies.resolve || resolvePartner)(this.endpoint.hostname, controller.signal);
      if (generation !== this.generation || !this.authorized()) return;
      if (!addresses.length || addresses.length > PARTNER_WS_LIMITS.maxDnsAnswers
        || addresses.some(item => isIP(item.address) !== item.family
          || !isPartnerAddressAllowed(item.address, this.config.privateVpnAddresses))) {
        this.block('target_forbidden'); return;
      }
      const pinned = addresses[0];
      if (!pinned) { this.block('target_forbidden'); return; }
      const remaining = PARTNER_WS_LIMITS.attemptMs - (this.monotonicNow() - start);
      if (remaining <= 0) { this.fail('attempt_timeout'); return; }
      // DNS-Rebinding ausschließen: net.connect erhält nur die gerade geprüfte IP.
      const lookup: LookupFunction = (_host, options, callback): void => {
        if (controller.signal.aborted) { callback(new Error('attempt_timeout'), '', 4); return; }
        if (options.all) callback(null, [{ address: pinned.address, family: pinned.family }]);
        else callback(null, pinned.address, pinned.family);
      };
      const credentials = this.config.credentials;
      const options: PartnerSocketOptions = {
        handshakeTimeout: remaining, followRedirects: false, maxRedirects: 0,
        rejectUnauthorized: true, minVersion: 'TLSv1.2', servername: this.endpoint.hostname,
        lookup, family: pinned.family,
        maxPayload: PARTNER_WS_LIMITS.maxPayloadBytes, perMessageDeflate: false,
        maxFragments: PARTNER_WS_LIMITS.maxFragments, maxBufferedChunks: PARTNER_WS_LIMITS.maxFragments,
        maxHeaderSize: 16384, skipUTF8Validation: false,
        ...(credentials.bearerToken ? { headers: { Authorization: `Bearer ${credentials.bearerToken}` } } : {}),
        ...(credentials.clientCertPem ? { cert: credentials.clientCertPem, key: credentials.clientKeyPem } : {}),
        ...(credentials.caPem ? { ca: credentials.caPem } : {}),
      };
      const socket = this.dependencies.socketFactory
        ? this.dependencies.socketFactory(this.endpoint.href, protocol, options)
        : new WebSocket(this.endpoint.href, protocol, options);
      this.socket = socket;
      let tlsVerified = false;
      socket.on('error', () => { if (generation === this.generation) this.fail('network_error'); });
      socket.on('close', () => { if (generation === this.generation) this.fail('network_error'); });
      socket.on('unexpected-response', (request, response) => {
        response.destroy(); request.destroy();
        if (generation === this.generation) this.fail('protocol_error');
      });
      socket.on('upgrade', response => {
        if (generation !== this.generation) return;
        const tls = response.socket;
        if (!(tls instanceof TLSSocket) || !tls.authorized
          || checkServerIdentity(this.endpoint.hostname, tls.getPeerCertificate())) { this.block('protocol_error'); return; }
        const remote = tls.remoteAddress;
        const exact = new BlockList(); exact.addAddress(pinned.address, pinned.family === 4 ? 'ipv4' : 'ipv6');
        if (!remote || !exact.check(remote, isIP(remote) === 4 ? 'ipv4' : 'ipv6')) { this.block('target_forbidden'); return; }
        this.peerExpiresAt = Date.parse(tls.getPeerCertificate().valid_to);
        if (!Number.isFinite(this.peerExpiresAt)) { this.block('protocol_error'); return; }
        this.peerDeadline = this.monotonicNow() + this.peerExpiresAt - this.wallNow();
        tls.disableRenegotiation(); tlsVerified = true;
        this.rateStart = this.monotonicNow(); this.rateFrames = 0; this.rateBytes = 0;
        // Erfasst auch unvollständige Fragmentfolgen; ws begrenzt zusätzlich Fragmente.
        tls.on('data', (chunk: Buffer) => {
          if (generation === this.generation) this.consumeQuota(0, chunk.byteLength);
        });
      });
      socket.on('open', () => {
        if (generation !== this.generation || !this.authorized()) return;
        if (!tlsVerified || socket.protocol !== protocol) { this.block('protocol_error'); return; }
        if (this.monotonicNow() - start >= PARTNER_WS_LIMITS.attemptMs) { this.fail('attempt_timeout'); return; }
        if (this.deadlineTimer) clearTimeout(this.deadlineTimer); this.deadlineTimer = null;
        this.nextPingAt = this.monotonicNow() + PARTNER_WS_LIMITS.heartbeatMs;
        this.state('open', 'connected');
        if (generation !== this.generation || !this.authorized()) return;
        this.heartbeatTimer = setInterval(() => this.heartbeat(generation), PARTNER_WS_LIMITS.authorizationPollMs);
        this.heartbeatTimer.unref();
        try { this.hooks.onOpen?.(); } catch { this.fail('handler_error'); }
      });
      socket.on('ping', () => { if (generation === this.generation) this.consumeQuota(1, 0); });
      socket.on('pong', () => {
        if (generation !== this.generation || !this.consumeQuota(1, 0)) return;
        this.pongPendingAt = 0;
        // Erst eine stabile Heartbeat-Runde setzt den Backoff zurück.
        this.failures = 0;
      });
      socket.on('message', (data: RawData, binary: boolean) => {
        if (generation !== this.generation || !this.authorized()) return;
        if (!tlsVerified || socket.readyState !== WebSocket.OPEN || binary) { this.fail('protocol_error'); return; }
        const size = Array.isArray(data) ? data.reduce((sum, chunk) => sum + chunk.byteLength, 0) : data.byteLength;
        if (size > PARTNER_WS_LIMITS.maxPayloadBytes || this.queueBytes + size > PARTNER_WS_LIMITS.maxBufferedBytes
          || this.queue.length >= PARTNER_WS_LIMITS.maxQueuedMessages || !this.consumeQuota(1, 0)) {
          if (generation === this.generation) this.fail('resource_limit'); return;
        }
        const buffer = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data);
        this.queue.push(buffer.toString('utf8')); this.queueBytes += size;
        void this.drain(generation);
      });
    } catch { if (generation === this.generation) this.fail('network_error'); }
  }

  private consumeQuota(frames: number, bytes: number): boolean {
    const now = this.monotonicNow();
    if (now - this.rateStart >= PARTNER_WS_LIMITS.rateWindowMs) {
      this.rateStart = now; this.rateFrames = 0; this.rateBytes = 0;
    }
    this.rateFrames += frames; this.rateBytes += bytes;
    if (this.rateFrames > PARTNER_WS_LIMITS.maxFramesPerWindow
      || this.rateBytes > PARTNER_WS_LIMITS.maxInboundBytesPerWindow) {
      this.fail('resource_limit'); return false;
    }
    return true;
  }

  /** Seriell abarbeiten; fremde Handlerfehler verlassen die Transportgrenze nicht. */
  private async drain(generation: number): Promise<void> {
    if (this.processingGeneration !== null) return;
    this.processingGeneration = generation;
    try {
      while (this.queue.length && generation === this.generation && this.authorized()) {
        const text = this.queue.shift();
        if (text === undefined) break;
        this.queueBytes -= Buffer.byteLength(text, 'utf8');
        const controller = this.controller;
        if (!controller) break;
        const current = (): boolean => generation === this.generation && this.authorized();
        await this.hooks.onMessage(this.config.partnerId, text, Object.freeze({
          isCurrent: current,
          send: (reply: string): boolean => current() && this.send(reply),
          signal: controller.signal,
        }));
      }
    } catch { if (generation === this.generation) this.fail('handler_error'); }
    finally {
      this.processingGeneration = null;
      if (this.running && this.queue.length) void this.drain(this.generation);
    }
  }

  /** Heartbeat beweist nur Verbindungsleben und erneuert keine fachliche Freigabe. */
  private heartbeat(generation: number): void {
    if (generation !== this.generation || !this.authorized()) return;
    const socket = this.socket; const now = this.monotonicNow();
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > PARTNER_WS_LIMITS.maxBufferedBytes) { this.fail('resource_limit'); return; }
    if (this.pongPendingAt && now - this.pongPendingAt >= PARTNER_WS_LIMITS.heartbeatMs) {
      this.fail('heartbeat_timeout'); return;
    }
    if (now >= this.nextPingAt && !this.pongPendingAt) {
      this.pongPendingAt = now; this.nextPingAt = now + PARTNER_WS_LIMITS.heartbeatMs;
      try { socket.ping(); } catch { this.fail('network_error'); }
    }
  }
}
