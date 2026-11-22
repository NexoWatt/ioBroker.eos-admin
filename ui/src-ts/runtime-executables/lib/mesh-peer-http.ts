/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Begrenzt den nativen HTTP-Transport für den manuellen Mesh-Peer-Feldtest.
 * Daten und Wirkung: Prüft entfernte Antworten und liefert feste Fehlercodes; teilt eine monotone Frist über alle Abrufe eines Peers.
 * Bei Änderungen: Redirects, echte Abbrüche, TLS-Zertifikate, Antwortgrößen und bestehende Peer-Protokolle gemeinsam nachprüfen.
 * HTTP bleibt für bestehende LAN-/Tailscale-Peers möglich. HTTPS prüft Zertifikate.
 * Ein Peer-Ablauf teilt eine monotone Deadline; Redirects werden nie verfolgt.
 * Fremde Fehlertexte und unvalidierte JSON-Objekte verlassen diese Grenze nicht.
 */
import { request as requestHttp, type ClientRequest, type IncomingMessage } from 'node:http';
import { request as requestHttps } from 'node:https';
import { performance } from 'node:perf_hooks';

export const MESH_PEER_LIMITS = Object.freeze({
  maxBudgetMs: 5000, maxResponseBytes: 1024 * 1024, maxRequestBytes: 64 * 1024,
  maxHeaderBytes: 16384, maxDepth: 32, maxNodes: 20000, maxUrlLength: 2048,
});
type PeerCode = 'mesh_peer_invalid_url' | 'mesh_peer_timeout' | 'mesh_peer_redirect_forbidden'
  | 'mesh_peer_too_large' | 'mesh_peer_invalid_json' | 'mesh_peer_invalid_response'
  | 'mesh_peer_unsupported_encoding' | 'mesh_peer_network_error' | 'mesh_peer_invalid_request';
type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
interface JsonObject { [key: string]: JsonValue; }
type PeerEndpoint = '/api/mesh/handshake' | '/api/mesh/status' | '/api/mesh/command/receive';
export type PeerReply = Readonly<{ status: number; ok: boolean; data: JsonObject }>;
export type MeshPeerClient = Readonly<{
  baseUrl: string;
  request: (endpoint: PeerEndpoint, body?: unknown) => Promise<PeerReply>;
}>;
const ownedErrors = new WeakMap<object, PeerCode>();
function failure(code: PeerCode): Error {
  const error = new Error(code);
  ownedErrors.set(error, code);
  return error;
}
/** Nur selbst erzeugte Codes ausgeben; auch gefälschte Error-Felder bleiben privat. */
export function safeMeshPeerError(error: unknown): PeerCode {
  return error !== null && typeof error === 'object' ? ownedErrors.get(error) || 'mesh_peer_network_error' : 'mesh_peer_network_error';
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function ownData(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') ? descriptor.value : undefined;
}

/** Keine URL-Zugangsdaten, Query-Tokens oder Fragmente in Requests und Diagnosen. */
export function normalizeMeshPeerUrl(raw: unknown): string {
  if (typeof raw !== 'string') throw failure('mesh_peer_invalid_url');
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MESH_PEER_LIMITS.maxUrlLength || /[\u0000-\u0020\u007f\\]/u.test(trimmed)) throw failure('mesh_peer_invalid_url');
  if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(trimmed) && !/^https?:\/\//iu.test(trimmed)) throw failure('mesh_peer_invalid_url');
  try {
    const value = new URL(/^https?:\/\//iu.test(trimmed) ? trimmed : `http://${trimmed}`);
    if (!['http:', 'https:'].includes(value.protocol) || !value.hostname || value.username || value.password || value.search || value.hash) throw failure('mesh_peer_invalid_url');
    // Pfadpräfixe hinter einem vertrauenswürdigen lokalen Reverse Proxy bleiben erhalten.
    return value.href.replace(/\/+$/u, '');
  } catch (_error: unknown) {
    throw failure('mesh_peer_invalid_url');
  }
}

/** Tief begrenzte Kopie in Null-Prototyp-Dictionaries; keine fremden Schlüssel übernehmen. */
function validateJson(raw: unknown, endpoint: PeerEndpoint, secret: string): JsonObject {
  if (!record(raw) || typeof raw['ok'] !== 'boolean') throw failure('mesh_peer_invalid_response');
  if (raw['ok'] === false) {
    // Negative Antworten sind Diagnosecodes, niemals fremde Stacks oder freie Meldungen.
    const codes = new Set(['mesh_token_invalid', 'token_invalid', 'receiver_disabled', 'cluster_mismatch', 'local_command_state_missing', 'peer_not_allowed', 'replay_blocked', 'no_commands', 'blocked_by_actuator_authority', 'failed_local_write', 'eos_required', 'internal_error']);
    const candidate = typeof raw['error'] === 'string' ? raw['error'] : raw['status'];
    const code = typeof candidate === 'string' && codes.has(candidate) ? candidate : 'mesh_peer_rejected';
    return Object.assign(Object.create(null), { ok: false, error: code, status: code });
  }
  const expectedSchema = endpoint === '/api/mesh/handshake' ? 'nexowatt.mesh-peer-handshake.v1'
    : endpoint === '/api/mesh/status' ? 'nexowatt.mesh-peer-status.v1' : 'nexowatt.mesh-command-ack.v1';
  if (raw['ok'] === true) {
    if (raw['schema'] !== expectedSchema) throw failure('mesh_peer_invalid_response');
    if (endpoint !== '/api/mesh/command/receive') {
      for (const key of ['nodeId', 'clusterId']) {
        const value = ownData(raw, key);
        if (typeof value !== 'string' || !value.trim() || value.length > 128) throw failure('mesh_peer_invalid_response');
      }
      if (endpoint === '/api/mesh/status') {
        const mesh = raw['mesh'];
        if (!record(mesh)) throw failure('mesh_peer_invalid_response');
        const remoteNodes = mesh['nodes'];
        if (remoteNodes !== undefined) {
          if (!Array.isArray(remoteNodes)) throw failure('mesh_peer_invalid_response');
          for (const node of remoteNodes) {
            if (!record(node) || typeof node['id'] !== 'string' || !node['id'].trim() || node['id'].length > 128) throw failure('mesh_peer_invalid_response');
            for (const key of ['name', 'type', 'role', 'status']) {
              const value = ownData(node, key);
              if (value !== undefined && (typeof value !== 'string' || value.length > 256)) throw failure('mesh_peer_invalid_response');
            }
            for (const key of ['surplusW', 'demandW', 'priority']) {
              const value = ownData(node, key);
              if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) throw failure('mesh_peer_invalid_response');
            }
          }
        }
      }
    }
  }
  for (const key of ['status', 'error', 'message']) {
    const value = ownData(raw, key);
    if (value !== undefined && (typeof value !== 'string' || value.length > 1000)) throw failure('mesh_peer_invalid_response');
  }
  let nodes = 0;
  const copy = (value: unknown, depth: number): JsonValue => {
    if (++nodes > MESH_PEER_LIMITS.maxNodes || depth > MESH_PEER_LIMITS.maxDepth) throw failure('mesh_peer_invalid_response');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw failure('mesh_peer_invalid_response');
      return value;
    }
    if (typeof value === 'string') return secret ? value.split(secret).join('[redacted]') : value;
    if (Array.isArray(value)) return value.map(entry => copy(entry, depth + 1));
    if (!record(value)) throw failure('mesh_peer_invalid_response');
    const result: JsonObject = Object.create(null);
    for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key) || (secret && key.includes(secret))) throw failure('mesh_peer_invalid_response');
      Object.defineProperty(result, key, { value: copy(child, depth + 1), enumerable: true });
    }
    return result;
  };
  const result = copy(raw, 0);
  if (!record(result)) throw failure('mesh_peer_invalid_response');
  return result as JsonObject;
}

/** Der Startzeitpunkt liegt vor URL-Prüfung, DNS, Verbindung und allen Folgeabrufen. */
export function createMeshPeerClient(rawUrl: unknown, requestedTimeoutMs: unknown, token: unknown): MeshPeerClient {
  const started = performance.now();
  const timeout = typeof requestedTimeoutMs === 'number' && Number.isFinite(requestedTimeoutMs)
    ? Math.max(1, Math.min(MESH_PEER_LIMITS.maxBudgetMs, requestedTimeoutMs)) : MESH_PEER_LIMITS.maxBudgetMs;
  const deadline = started + timeout;
  const baseUrl = normalizeMeshPeerUrl(rawUrl);
  if (typeof token !== 'string' || token.length > 4096 || /[^\x20-\x7e]/u.test(token)) throw failure('mesh_peer_invalid_request');
  const request = async (endpoint: PeerEndpoint, body?: unknown): Promise<PeerReply> => {
    if (!['/api/mesh/handshake', '/api/mesh/status', '/api/mesh/command/receive'].includes(endpoint)) throw failure('mesh_peer_invalid_request');
    const remaining = deadline - performance.now();
    if (remaining <= 0) throw failure('mesh_peer_timeout');
    let payload: string | undefined;
    try { payload = body === undefined ? undefined : JSON.stringify(body); } catch (_error: unknown) { throw failure('mesh_peer_invalid_request'); }
    if (payload !== undefined && Buffer.byteLength(payload) > MESH_PEER_LIMITS.maxRequestBytes) throw failure('mesh_peer_invalid_request');
    const url = new URL(baseUrl + endpoint);
    const headers: Record<string, string> = Object.create(null);
    headers['accept'] = 'application/json';
    headers['accept-encoding'] = 'identity';
    if (token) headers['x-nexowatt-mesh-token'] = token;
    if (payload !== undefined) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = String(Buffer.byteLength(payload));
    }
    const requestBudget = deadline - performance.now();
    if (requestBudget <= 0) throw failure('mesh_peer_timeout');
    return new Promise<PeerReply>((resolve, reject) => {
      let outgoing: ClientRequest | undefined;
      let incoming: IncomingMessage | undefined;
      let settled = false;
      const chunks: Buffer[] = [];
      const finish = (error?: Error, reply?: PeerReply): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        incoming?.destroy();
        outgoing?.destroy();
        if (error) reject(error);
        else if (reply) resolve(reply);
        else reject(failure('mesh_peer_network_error'));
      };
      const timer = setTimeout(() => finish(failure('mesh_peer_timeout')), Math.max(1, Math.ceil(requestBudget)));
      try {
        outgoing = (url.protocol === 'https:' ? requestHttps : requestHttp)(url, {
          method: payload === undefined ? 'GET' : 'POST', headers, agent: false,
          maxHeaderSize: MESH_PEER_LIMITS.maxHeaderBytes, rejectUnauthorized: true,
        }, response => {
          incoming = response;
          response.on('error', () => finish(failure('mesh_peer_network_error')));
          response.on('aborted', () => finish(failure('mesh_peer_network_error')));
          const status = response.statusCode || 0;
          if (status >= 300 && status < 400) return finish(failure('mesh_peer_redirect_forbidden'));
          // HTTP-Fehler bleiben als kontrollierter Status sichtbar; fremde Fehlerbodies nie spiegeln.
          if (status < 200 || status >= 300) return finish(undefined, { status, ok: false, data: { ok: false } });
          const encoding = response.headers['content-encoding'];
          if (encoding && encoding !== 'identity') return finish(failure('mesh_peer_unsupported_encoding'));
          const length = response.headers['content-length'];
          if (length !== undefined && (!/^\d+$/u.test(length) || Number(length) > MESH_PEER_LIMITS.maxResponseBytes)) return finish(failure('mesh_peer_too_large'));
          let bytes = 0;
          response.on('data', (chunk: unknown) => {
            if (settled) return;
            if (!Buffer.isBuffer(chunk)) return finish(failure('mesh_peer_invalid_response'));
            bytes += chunk.length;
            if (bytes > MESH_PEER_LIMITS.maxResponseBytes) return finish(failure('mesh_peer_too_large'));
            chunks.push(chunk);
          });
          response.on('end', () => {
            if (settled) return;
            if (performance.now() >= deadline) return finish(failure('mesh_peer_timeout'));
            let decoded: unknown;
            try { decoded = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_error: unknown) { return finish(failure('mesh_peer_invalid_json')); }
            try {
              const data = validateJson(decoded, endpoint, token);
              if (performance.now() >= deadline) return finish(failure('mesh_peer_timeout'));
              finish(undefined, { status, ok: true, data });
            } catch (error: unknown) { finish(failure(safeMeshPeerError(error))); }
          });
        });
        outgoing.on('error', () => finish(failure('mesh_peer_network_error')));
        outgoing.end(payload);
      } catch (_error: unknown) { finish(failure('mesh_peer_network_error')); }
    });
  };
  return Object.freeze({ baseUrl, request });
}
