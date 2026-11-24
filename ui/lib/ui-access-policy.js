/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/ui-access-policy.ts
 * Quell-Hash: sha256:c3b68fac91389ad1502fd03a889fdeca278c5230f7441c80bd77b767f0f030de
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/ui-access-policy.js.
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
exports.EosSessionClient = exports.UiLoginLimiter = void 0;
exports.parseUiCookies = parseUiCookies;
exports.uiAuthMode = uiAuthMode;
exports.uiSessionBinding = uiSessionBinding;
exports.uiSessionCookieName = uiSessionCookieName;
exports.normalizePeer = normalizePeer;
exports.isLoopback = isLoopback;
exports.trustedProxyPeer = trustedProxyPeer;
exports.secureUiTransport = secureUiTransport;
exports.uiOriginAllowed = uiOriginAllowed;
exports.uiRequestPath = uiRequestPath;
exports.isPublicUiRequest = isPublicUiRequest;
exports.isIndependentMachineRequest = isIndependentMachineRequest;
exports.constantTimeToken = constantTimeToken;
exports.eosSessionEndpoint = eosSessionEndpoint;
exports.safeCentralUiUrl = safeCentralUiUrl;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Trennt lokale ioBroker-Sitzungen von der zentral geprüften EOS-Sitzung.
 * Daten und Wirkung: Liest ausschließlich konfigurierte Vertrauensgrenzen und
 * kurzlebige HTTP-Zugangsdaten. Keine Passwörter, Anlagenwerte oder Konfiguration
 * werden gespeichert. Externe Sitzungsprüfungen haben ein gemeinsames 5-s-Budget,
 * keine Redirects, geprüfte TLS-Zertifikate und maximal 32 KiB Antwortdaten.
 * Bei Änderungen: Profiltrennung, exakte Origins, Cookieparser, Kontowiderruf,
 * TLS-Fehler, Antwortgrenzen und tatsächlichen Abbruch gemeinsam nachprüfen.
 * Sicherheit: Unbekannte Profile, doppelte Cookies und Ausfall der Zentrale
 * sperren den Zugang. Maschinenendpunkte behalten ihre eigene Tokenprüfung.
 */
const crypto = require("node:crypto");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const path = require("node:path");
const fs = require("node:fs");
/** Keine stillen Typumwandlungen oder widersprüchlichen Cookie-Identitäten. */
function parseUiCookies(req) {
    const out = Object.create(null);
    const raw = req?.headers?.cookie;
    if (raw === undefined)
        return out;
    if (typeof raw !== 'string' || Buffer.byteLength(raw) > 8192)
        return out;
    const parts = raw.split(';');
    if (parts.length > 64)
        return out;
    for (const part of parts) {
        const split = part.indexOf('=');
        if (split < 1)
            continue;
        const name = part.slice(0, split).trim();
        if (!/^[!#$%&'*+.^_`|~A-Za-z0-9-]+$/.test(name) || Object.hasOwn(out, name))
            return Object.create(null);
        try {
            const value = decodeURIComponent(part.slice(split + 1).trim());
            if (/[\u0000-\u001f\u007f]/.test(value))
                return Object.create(null);
            Object.defineProperty(out, name, { value, enumerable: true });
        }
        catch {
            return Object.create(null);
        }
    }
    return out;
}
function uiAuthMode(config = {}) {
    const mode = config.mode;
    if (mode === undefined || mode === '' || mode === 'iobroker')
        return 'iobroker';
    return mode === 'eos' ? 'eos' : 'blocked';
}
/** Cookies sind nicht portgebunden: Profil, Instanz und Port erhalten eigene Namen. */
function uiSessionBinding(namespace, port, config) {
    return crypto.createHash('sha256').update(JSON.stringify([
        namespace, String(port || 8188), uiAuthMode(config),
        config.eosSessionUrl || '', config.eosCaFile || '', config.trustedProxyIps || [],
    ])).digest('hex');
}
function uiSessionCookieName(binding) { return 'nw_ui_' + binding.slice(0, 20); }
function normalizePeer(raw) {
    let value = typeof raw === 'string' ? raw.toLowerCase().trim() : '';
    if (value.startsWith('::ffff:'))
        value = value.slice(7);
    if (value === '::1')
        return '127.0.0.1';
    return value;
}
function isLoopback(raw) {
    const value = normalizePeer(raw);
    return value === '127.0.0.1';
}
function trustedProxyPeer(req, raw) {
    const peer = normalizePeer(req.socket?.remoteAddress);
    if (isLoopback(peer))
        return true;
    const rows = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[\n,;]+/) : [];
    return !!net.isIP(peer) && rows.some(value => {
        const address = normalizePeer(value);
        return !!net.isIP(address) && address === peer;
    });
}
function secureUiTransport(req, trustedIps, proxyPrefixValid) {
    return req.socket?.encrypted === true || (proxyPrefixValid && trustedProxyPeer(req, trustedIps)
        && req.headers?.['x-forwarded-proto'] === 'https');
}
/** Browser-Origin umfasst Schema, Host UND Port; benachbarte Apps erben keine Sitzung. */
function uiOriginAllowed(req, allowedOrigins, trustedIps, proxyPrefixValid) {
    const origin = req.headers?.origin;
    if (origin === undefined || origin === '')
        return req.headers?.['sec-fetch-site'] !== 'cross-site';
    if (typeof origin !== 'string' || origin.length > 2048)
        return false;
    const canonicalOrigin = (value) => {
        if (typeof value !== 'string')
            return null;
        try {
            const url = new URL(value);
            return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && value === url.origin ? value : null;
        }
        catch {
            return null;
        }
    };
    if (!canonicalOrigin(origin))
        return false;
    let protocol = req.socket?.encrypted === true ? 'https:' : 'http:';
    let host = req.headers?.host;
    if (proxyPrefixValid && trustedProxyPeer(req, trustedIps)) {
        const forwardedProtocol = req.headers?.['x-forwarded-proto'];
        if (forwardedProtocol === 'https' || forwardedProtocol === 'http')
            protocol = forwardedProtocol + ':';
        const forwardedHost = req.headers?.['x-forwarded-host'];
        if (typeof forwardedHost === 'string')
            host = forwardedHost;
    }
    if (typeof host === 'string' && !/[\s\\/?#@,]/.test(host) && canonicalOrigin(protocol + '//' + host) === origin)
        return true;
    const rows = Array.isArray(allowedOrigins) ? allowedOrigins : typeof allowedOrigins === 'string' ? allowedOrigins.split(/[\n,;]+/).map(value => value.trim()) : [];
    return rows.length <= 64 && rows.some(value => canonicalOrigin(value) === origin);
}
/** Pfadprüfung bildet die Normalisierung von express.static ab. */
function uiRequestPath(req) {
    const raw = String(req.path || req.originalUrl || req.url || '/').split(/[?#]/, 1)[0] || '/';
    if (raw.length > 8192)
        return '';
    try {
        const decoded = decodeURIComponent(raw).replace(/\\/g, '/');
        if (/[\u0000-\u001f\u007f]/.test(decoded))
            return '';
        return path.posix.normalize('/' + decoded).replace(/\/+$/, '') || '/';
    }
    catch {
        return '';
    }
}
const AUTH_READ = new Set(['/api/auth/status', '/api/strict-auth/status', '/api/session/me', '/api/locale']);
const AUTH_WRITE = new Set(['/api/auth/login', '/api/strict-auth/login', '/api/installer/login', '/api/auth/logout', '/api/strict-auth/logout', '/api/installer/logout']);
const PUBLIC_PAGES = new Set(['/login', '/login.html', '/static/login.html', '/favicon.ico', '/apple-touch-icon.png', '/apple-touch-icon-precomposed.png', '/apple-touch-icon-180x180.png', '/apple-touch-icon-180x180-precomposed.png', '/manifest.webmanifest', '/sw.js']);
/** Nur öffentliche Programm-Assets; niemals HTML, API-Daten oder Konfiguration. */
function isPublicUiRequest(req) {
    const pathname = uiRequestPath(req);
    const method = String(req.method || 'GET').toUpperCase();
    if (method === 'OPTIONS' && (AUTH_READ.has(pathname) || AUTH_WRITE.has(pathname) || /^\/api\/license\/(info|save)$/.test(pathname)))
        return true;
    if (method === 'POST')
        return AUTH_WRITE.has(pathname);
    if (method !== 'GET' && method !== 'HEAD')
        return false;
    if (AUTH_READ.has(pathname) || PUBLIC_PAGES.has(pathname))
        return true;
    if (/(?:^|\/)(?:api|config|state|sse)(?:\/|$)/i.test(pathname))
        return false;
    return /^\/(?:static|assets)\/(?:[A-Za-z0-9_./-]+)\.(?:js|mjs|css|png|jpg|jpeg|svg|ico|woff|woff2)$/.test(pathname)
        || /^\/static\/i18n\/(?:de|en|nl)\.json$/.test(pathname);
}
/** Explizite Ausnahmen erreichen erst danach ihre vorhandene Maschinen-Authentifizierung. */
function isIndependentMachineRequest(req) {
    const pathname = uiRequestPath(req);
    const method = String(req.method || 'GET').toUpperCase();
    if (method === 'POST' && ['/api/mesh/coordinator/exchange', '/api/mesh/coordinator/energy', '/api/mesh/command/receive'].includes(pathname))
        return true;
    if ((method === 'GET' || method === 'HEAD') && ['/api/mesh/handshake', '/api/mesh/status'].includes(pathname))
        return true;
    if ((method === 'GET' || method === 'HEAD') && /^\/(?:api\/)?display\/station\/[^/]{1,512}(?:\/operator\.csv)?$/.test(pathname))
        return true;
    return method === 'POST' && /^\/api\/display\/station\/[^/]{1,512}\/(?:heartbeat|command)$/.test(pathname);
}
function constantTimeToken(given, expected) {
    if (typeof given !== 'string' || typeof expected !== 'string' || given.length < 16 || given.length > 256 || expected.length < 16)
        return false;
    return crypto.timingSafeEqual(crypto.createHash('sha256').update(given).digest(), crypto.createHash('sha256').update(expected).digest());
}
/** Konto- und Quellbegrenzung, parallel reserviert; kein dauerhafter Kontolock. */
class UiLoginLimiter {
    constructor(clock = Date.now) {
        this.clock = clock;
        this.failures = new Map();
        this.inFlight = new Map();
        this.active = 0;
    }
    keys(ip, login) {
        const normalized = login.normalize('NFKC').trim().toLowerCase().replace(/^system\.user\./, '');
        return ['ip:' + ip, 'account:' + crypto.createHash('sha256').update(normalized).digest('hex')];
    }
    status(keys) {
        const now = this.clock();
        let retry = 0;
        for (const key of keys) {
            const row = this.failures.get(key);
            if (row && row.until > now)
                retry = Math.max(retry, Math.ceil((row.until - now) / 1000));
            else if (row && now - row.start >= 300000)
                this.failures.delete(key);
        }
        return { blocked: retry > 0, retryAfterSec: retry };
    }
    acquire(keys) {
        if (this.active >= 16 || keys.some(key => (this.inFlight.get(key) || 0) >= (key.startsWith('account:') ? 1 : 3)))
            return null;
        for (const key of keys)
            this.inFlight.set(key, (this.inFlight.get(key) || 0) + 1);
        this.active += 1;
        let released = false;
        return () => {
            if (released)
                return;
            released = true;
            this.active -= 1;
            for (const key of keys) {
                const count = (this.inFlight.get(key) || 1) - 1;
                if (count)
                    this.inFlight.set(key, count);
                else
                    this.inFlight.delete(key);
            }
        };
    }
    failure(keys) {
        const now = this.clock();
        let until = 0;
        for (const [key, row] of this.failures)
            if (now - row.start > 300000 && row.until <= now)
                this.failures.delete(key);
        for (const key of keys) {
            const previous = this.failures.get(key);
            const row = previous && now - previous.start < 300000 ? previous : { start: now, count: 0, until: 0 };
            row.count += 1;
            // Konten nur kurz verzögern: absichtliches Aussperren bleibt zeitlich begrenzt.
            if (row.count >= 5)
                row.until = now + (key.startsWith('account:') ? 30000 : 600000);
            until = Math.max(until, row.until);
            if (!this.failures.has(key) && this.failures.size >= 2048)
                this.failures.delete(this.failures.keys().next().value);
            this.failures.set(key, row);
        }
        return { lockUntil: until };
    }
    success(keys) { for (const key of keys)
        this.failures.delete(key); }
}
exports.UiLoginLimiter = UiLoginLimiter;
/** Feste Administrations-URL: kein Redirect, kein frei wählbarer Request-Zielhost. */
function eosSessionEndpoint(raw) {
    if (typeof raw !== 'string' || raw.length > 2048)
        return null;
    try {
        const url = new URL(raw);
        if (url.username || url.password || url.search || url.hash)
            return null;
        if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname)))
            return null;
        const segments = url.pathname.split('/');
        if (segments[0] !== '' || segments.length < 4 || segments.length > 20
            || segments.slice(-3).join('/') !== 'nexowatt/security/session'
            || !segments.slice(1, -3).every(segment => segment.length <= 128 && /^[A-Za-z0-9_~-]+$/.test(segment)))
            return null;
        return url;
    }
    catch {
        return null;
    }
}
function safeCentralUiUrl(raw) {
    if (typeof raw !== 'string' || !raw || raw.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(raw))
        return null;
    if (raw.startsWith('/') && !raw.startsWith('//') && !/%(?:2f|5c)/i.test(raw))
        return raw;
    try {
        const url = new URL(raw);
        return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    }
    catch {
        return null;
    }
}
/** Zentrale EOS-Session bleibt die Autorität; keine zweite Passwortdatenbank. */
class EosSessionClient {
    constructor(config, binding) {
        this.binding = binding;
        this.secret = crypto.randomBytes(32);
        this.active = new Map();
        this.revoked = new Map();
        this.pending = new Set();
        this.closed = false;
        this.endpoint = eosSessionEndpoint(config.eosSessionUrl);
        let caValid = true;
        if (config.eosCaFile) {
            try {
                if (typeof config.eosCaFile !== 'string' || !path.isAbsolute(config.eosCaFile))
                    throw new Error('invalid_ca');
                const stat = fs.statSync(config.eosCaFile);
                if (!stat.isFile() || stat.size > 65536)
                    throw new Error('invalid_ca');
                this.ca = fs.readFileSync(config.eosCaFile);
                if (!this.ca.includes('-----BEGIN CERTIFICATE-----') || this.ca.includes('PRIVATE KEY'))
                    throw new Error('invalid_ca');
            }
            catch {
                caValid = false;
            }
        }
        this.configured = !!this.endpoint && caValid && !!safeCentralUiUrl(config.eosLoginUrl) && !!safeCentralUiUrl(config.eosLogoutUrl);
    }
    credential(req) {
        const value = parseUiCookies(req).access_token;
        return typeof value === 'string' && value.length >= 16 && value.length <= 4096 ? value : '';
    }
    key(value) { return crypto.createHmac('sha256', this.secret).update(this.binding + '\n' + value).digest('hex'); }
    revoke(req) {
        const value = this.credential(req);
        if (!value)
            return;
        // Volle Sperrliste sperrt die EOS-Brücke bis Neustart statt alte Sperren zu vergessen.
        if (this.revoked.size >= 2048) {
            this.closed = true;
            return;
        }
        this.revoked.set(this.key(value), Date.now());
    }
    isRevoked(key) { return this.closed || this.revoked.has(key); }
    async resolve(req) {
        if (!this.configured || this.closed)
            return null;
        const value = this.credential(req);
        if (!value)
            return null;
        const key = this.key(value);
        if (this.revoked.has(key))
            return null;
        const existing = this.active.get(key);
        if (existing)
            return existing;
        if (this.active.size >= 32)
            return null;
        const result = this.request(value, key).finally(() => this.active.delete(key));
        this.active.set(key, result);
        return result;
    }
    request(value, key) {
        return new Promise(resolve => {
            let finished = false;
            let request;
            let response;
            const finish = (access) => {
                if (finished)
                    return;
                finished = true;
                clearTimeout(deadline);
                if (request)
                    this.pending.delete(request);
                response?.destroy();
                request?.destroy();
                resolve(this.revoked.has(key) || this.closed ? null : access);
            };
            const deadline = setTimeout(() => finish(null), 5000);
            deadline.unref?.();
            try {
                const url = this.endpoint;
                const transport = url.protocol === 'https:' ? https : http;
                request = transport.request(url, {
                    method: 'GET', agent: false, rejectUnauthorized: true, ca: this.ca,
                    headers: { Accept: 'application/json', Cookie: 'access_token=' + encodeURIComponent(value), 'Cache-Control': 'no-store' },
                    maxHeaderSize: 16384,
                }, incoming => {
                    response = incoming;
                    if (incoming.statusCode !== 200 || !/^application\/json(?:\s*;|$)/i.test(String(incoming.headers['content-type'] || ''))) {
                        finish(null);
                        return;
                    }
                    const chunks = [];
                    let bytes = 0;
                    incoming.on('error', () => finish(null));
                    incoming.on('aborted', () => finish(null));
                    incoming.on('data', (chunk) => {
                        bytes += chunk.length;
                        if (bytes > 32768) {
                            finish(null);
                            return;
                        }
                        chunks.push(chunk);
                    });
                    incoming.on('end', () => {
                        try {
                            const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                                finish(null);
                                return;
                            }
                            const body = data;
                            if (body.authenticated !== true || body.mustChangePassword !== false || typeof body.user !== 'string'
                                || !/^system\.user\.[A-Za-z0-9_.-]{1,128}$/.test(body.user)
                                || typeof body.role !== 'string' || !['admin', 'installer', 'enduser'].includes(body.role)
                                || !Array.isArray(body.groups) || body.groups.length > 256
                                || !body.groups.every(group => typeof group === 'string' && /^system\.group\.[A-Za-z0-9_.-]{1,128}$/.test(group))) {
                                finish(null);
                                return;
                            }
                            finish({ user: body.user, role: body.role === 'enduser' ? 'customer' : body.role,
                                groups: body.groups, eos: true, credentialKey: key,
                                csrfToken: crypto.createHmac('sha256', this.secret).update('csrf\n' + key).digest('base64url') });
                        }
                        catch {
                            finish(null);
                        }
                    });
                });
                this.pending.add(request);
                request.on('error', () => finish(null));
                request.on('close', () => { if (!finished)
                    finish(null); });
                request.end();
            }
            catch {
                finish(null);
            }
        });
    }
    close() {
        this.closed = true;
        for (const request of this.pending)
            request.destroy();
        this.pending.clear();
    }
}
exports.EosSessionClient = EosSessionClient;
