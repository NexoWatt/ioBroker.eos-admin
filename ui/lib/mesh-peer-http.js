/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/mesh-peer-http.ts
 * Quell-Hash: sha256:2645d16ab9dc6a25948c904ace6cfea3131328dd421b8685754120c64c10a7f6
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/mesh-peer-http.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MESH_PEER_LIMITS = void 0;
exports.safeMeshPeerError = safeMeshPeerError;
exports.normalizeMeshPeerUrl = normalizeMeshPeerUrl;
exports.createMeshPeerClient = createMeshPeerClient;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Begrenzt den nativen HTTP-Transport für den manuellen Mesh-Peer-Feldtest.
 * Daten und Wirkung: Prüft entfernte Antworten und liefert feste Fehlercodes; teilt eine monotone Frist über alle Abrufe eines Peers.
 * Bei Änderungen: Redirects, echte Abbrüche, TLS-Zertifikate, Antwortgrößen und bestehende Peer-Protokolle gemeinsam nachprüfen.
 * HTTP bleibt für bestehende LAN-/Tailscale-Peers möglich. HTTPS prüft Zertifikate.
 * Ein Peer-Ablauf teilt eine monotone Deadline; Redirects werden nie verfolgt.
 * Fremde Fehlertexte und unvalidierte JSON-Objekte verlassen diese Grenze nicht.
 */
const node_http_1 = require("node:http");
const node_https_1 = require("node:https");
const node_perf_hooks_1 = require("node:perf_hooks");
exports.MESH_PEER_LIMITS = Object.freeze({
    maxBudgetMs: 5000, maxResponseBytes: 1024 * 1024, maxRequestBytes: 64 * 1024,
    maxHeaderBytes: 16384, maxDepth: 32, maxNodes: 20000, maxUrlLength: 2048,
});
const ownedErrors = new WeakMap();
function failure(code) {
    const error = new Error(code);
    ownedErrors.set(error, code);
    return error;
}
/** Nur selbst erzeugte Codes ausgeben; auch gefälschte Error-Felder bleiben privat. */
function safeMeshPeerError(error) {
    return error !== null && typeof error === 'object' ? ownedErrors.get(error) || 'mesh_peer_network_error' : 'mesh_peer_network_error';
}
function record(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function ownData(value, key) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') ? descriptor.value : undefined;
}
/** Keine URL-Zugangsdaten, Query-Tokens oder Fragmente in Requests und Diagnosen. */
function normalizeMeshPeerUrl(raw) {
    if (typeof raw !== 'string')
        throw failure('mesh_peer_invalid_url');
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > exports.MESH_PEER_LIMITS.maxUrlLength || /[\u0000-\u0020\u007f\\]/u.test(trimmed))
        throw failure('mesh_peer_invalid_url');
    if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(trimmed) && !/^https?:\/\//iu.test(trimmed))
        throw failure('mesh_peer_invalid_url');
    try {
        const value = new URL(/^https?:\/\//iu.test(trimmed) ? trimmed : `http://${trimmed}`);
        if (!['http:', 'https:'].includes(value.protocol) || !value.hostname || value.username || value.password || value.search || value.hash)
            throw failure('mesh_peer_invalid_url');
        // Pfadpräfixe hinter einem vertrauenswürdigen lokalen Reverse Proxy bleiben erhalten.
        return value.href.replace(/\/+$/u, '');
    }
    catch (_error) {
        throw failure('mesh_peer_invalid_url');
    }
}
/** Tief begrenzte Kopie in Null-Prototyp-Dictionaries; keine fremden Schlüssel übernehmen. */
function validateJson(raw, endpoint, secret) {
    if (!record(raw) || typeof raw['ok'] !== 'boolean')
        throw failure('mesh_peer_invalid_response');
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
        if (raw['schema'] !== expectedSchema)
            throw failure('mesh_peer_invalid_response');
        if (endpoint !== '/api/mesh/command/receive') {
            for (const key of ['nodeId', 'clusterId']) {
                const value = ownData(raw, key);
                if (typeof value !== 'string' || !value.trim() || value.length > 128)
                    throw failure('mesh_peer_invalid_response');
            }
            if (endpoint === '/api/mesh/status') {
                const mesh = raw['mesh'];
                if (!record(mesh))
                    throw failure('mesh_peer_invalid_response');
                const remoteNodes = mesh['nodes'];
                if (remoteNodes !== undefined) {
                    if (!Array.isArray(remoteNodes))
                        throw failure('mesh_peer_invalid_response');
                    for (const node of remoteNodes) {
                        if (!record(node) || typeof node['id'] !== 'string' || !node['id'].trim() || node['id'].length > 128)
                            throw failure('mesh_peer_invalid_response');
                        for (const key of ['name', 'type', 'role', 'status']) {
                            const value = ownData(node, key);
                            if (value !== undefined && (typeof value !== 'string' || value.length > 256))
                                throw failure('mesh_peer_invalid_response');
                        }
                        for (const key of ['surplusW', 'demandW', 'priority']) {
                            const value = ownData(node, key);
                            if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value)))
                                throw failure('mesh_peer_invalid_response');
                        }
                    }
                }
            }
        }
    }
    for (const key of ['status', 'error', 'message']) {
        const value = ownData(raw, key);
        if (value !== undefined && (typeof value !== 'string' || value.length > 1000))
            throw failure('mesh_peer_invalid_response');
    }
    let nodes = 0;
    const copy = (value, depth) => {
        if (++nodes > exports.MESH_PEER_LIMITS.maxNodes || depth > exports.MESH_PEER_LIMITS.maxDepth)
            throw failure('mesh_peer_invalid_response');
        if (value === null || typeof value === 'boolean')
            return value;
        if (typeof value === 'number') {
            if (!Number.isFinite(value))
                throw failure('mesh_peer_invalid_response');
            return value;
        }
        if (typeof value === 'string')
            return secret ? value.split(secret).join('[redacted]') : value;
        if (Array.isArray(value))
            return value.map(entry => copy(entry, depth + 1));
        if (!record(value))
            throw failure('mesh_peer_invalid_response');
        const result = Object.create(null);
        for (const [key, child] of Object.entries(value)) {
            if (['__proto__', 'prototype', 'constructor'].includes(key) || (secret && key.includes(secret)))
                throw failure('mesh_peer_invalid_response');
            Object.defineProperty(result, key, { value: copy(child, depth + 1), enumerable: true });
        }
        return result;
    };
    const result = copy(raw, 0);
    if (!record(result))
        throw failure('mesh_peer_invalid_response');
    return result;
}
/** Der Startzeitpunkt liegt vor URL-Prüfung, DNS, Verbindung und allen Folgeabrufen. */
function createMeshPeerClient(rawUrl, requestedTimeoutMs, token) {
    const started = node_perf_hooks_1.performance.now();
    const timeout = typeof requestedTimeoutMs === 'number' && Number.isFinite(requestedTimeoutMs)
        ? Math.max(1, Math.min(exports.MESH_PEER_LIMITS.maxBudgetMs, requestedTimeoutMs)) : exports.MESH_PEER_LIMITS.maxBudgetMs;
    const deadline = started + timeout;
    const baseUrl = normalizeMeshPeerUrl(rawUrl);
    if (typeof token !== 'string' || token.length > 4096 || /[^\x20-\x7e]/u.test(token))
        throw failure('mesh_peer_invalid_request');
    const request = async (endpoint, body) => {
        if (!['/api/mesh/handshake', '/api/mesh/status', '/api/mesh/command/receive'].includes(endpoint))
            throw failure('mesh_peer_invalid_request');
        const remaining = deadline - node_perf_hooks_1.performance.now();
        if (remaining <= 0)
            throw failure('mesh_peer_timeout');
        let payload;
        try {
            payload = body === undefined ? undefined : JSON.stringify(body);
        }
        catch (_error) {
            throw failure('mesh_peer_invalid_request');
        }
        if (payload !== undefined && Buffer.byteLength(payload) > exports.MESH_PEER_LIMITS.maxRequestBytes)
            throw failure('mesh_peer_invalid_request');
        const url = new URL(baseUrl + endpoint);
        const headers = Object.create(null);
        headers['accept'] = 'application/json';
        headers['accept-encoding'] = 'identity';
        if (token)
            headers['x-nexowatt-mesh-token'] = token;
        if (payload !== undefined) {
            headers['content-type'] = 'application/json';
            headers['content-length'] = String(Buffer.byteLength(payload));
        }
        const requestBudget = deadline - node_perf_hooks_1.performance.now();
        if (requestBudget <= 0)
            throw failure('mesh_peer_timeout');
        return new Promise((resolve, reject) => {
            let outgoing;
            let incoming;
            let settled = false;
            const chunks = [];
            const finish = (error, reply) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                incoming?.destroy();
                outgoing?.destroy();
                if (error)
                    reject(error);
                else if (reply)
                    resolve(reply);
                else
                    reject(failure('mesh_peer_network_error'));
            };
            const timer = setTimeout(() => finish(failure('mesh_peer_timeout')), Math.max(1, Math.ceil(requestBudget)));
            try {
                outgoing = (url.protocol === 'https:' ? node_https_1.request : node_http_1.request)(url, {
                    method: payload === undefined ? 'GET' : 'POST', headers, agent: false,
                    maxHeaderSize: exports.MESH_PEER_LIMITS.maxHeaderBytes, rejectUnauthorized: true,
                }, response => {
                    incoming = response;
                    response.on('error', () => finish(failure('mesh_peer_network_error')));
                    response.on('aborted', () => finish(failure('mesh_peer_network_error')));
                    const status = response.statusCode || 0;
                    if (status >= 300 && status < 400)
                        return finish(failure('mesh_peer_redirect_forbidden'));
                    // HTTP-Fehler bleiben als kontrollierter Status sichtbar; fremde Fehlerbodies nie spiegeln.
                    if (status < 200 || status >= 300)
                        return finish(undefined, { status, ok: false, data: { ok: false } });
                    const encoding = response.headers['content-encoding'];
                    if (encoding && encoding !== 'identity')
                        return finish(failure('mesh_peer_unsupported_encoding'));
                    const length = response.headers['content-length'];
                    if (length !== undefined && (!/^\d+$/u.test(length) || Number(length) > exports.MESH_PEER_LIMITS.maxResponseBytes))
                        return finish(failure('mesh_peer_too_large'));
                    let bytes = 0;
                    response.on('data', (chunk) => {
                        if (settled)
                            return;
                        if (!Buffer.isBuffer(chunk))
                            return finish(failure('mesh_peer_invalid_response'));
                        bytes += chunk.length;
                        if (bytes > exports.MESH_PEER_LIMITS.maxResponseBytes)
                            return finish(failure('mesh_peer_too_large'));
                        chunks.push(chunk);
                    });
                    response.on('end', () => {
                        if (settled)
                            return;
                        if (node_perf_hooks_1.performance.now() >= deadline)
                            return finish(failure('mesh_peer_timeout'));
                        let decoded;
                        try {
                            decoded = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                        }
                        catch (_error) {
                            return finish(failure('mesh_peer_invalid_json'));
                        }
                        try {
                            const data = validateJson(decoded, endpoint, token);
                            if (node_perf_hooks_1.performance.now() >= deadline)
                                return finish(failure('mesh_peer_timeout'));
                            finish(undefined, { status, ok: true, data });
                        }
                        catch (error) {
                            finish(failure(safeMeshPeerError(error)));
                        }
                    });
                });
                outgoing.on('error', () => finish(failure('mesh_peer_network_error')));
                outgoing.end(payload);
            }
            catch (_error) {
                finish(failure('mesh_peer_network_error'));
            }
        });
    };
    return Object.freeze({ baseUrl, request });
}
