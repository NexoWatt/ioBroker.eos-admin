/** Copyright (c) 2026 NexoWatt. All rights reserved. */
'use strict';
// Cookies belong to a host, not a TCP port. The upstream OAuth/Socket.IO
// implementation uses Admin's generic names internally. Translate them only at
// this EOS server's boundary; never read, overwrite or clear Admin's cookies.
const GENERIC = ['access_token', 'refresh_token', 'connect.sid', 'io', 'ioBroker.sid', 'eos-admin.sid', 'nexowatt_eos_first_login'];
const RESERVED_PREFIX = 'nexowatt_eos_';
const MAX_COOKIE_BYTES = 16_384;
function createEosCookieNamespace(namespace) {
    const match = /^eos-admin\.(0|[1-9]\d{0,5})$/.exec(namespace);
    if (!match) {
        throw new Error('EOS_COOKIE_NAMESPACE_INVALID');
    }
    const prefix = `${RESERVED_PREFIX}admin_${match[1]}_`;
    const names = Object.freeze({
        accessToken: `${prefix}access_token`,
        refreshToken: `${prefix}refresh_token`,
        session: `${prefix}session`,
        firstLogin: `${prefix}first_login`,
    });
    const external = new Map([
        ['access_token', names.accessToken],
        ['refresh_token', names.refreshToken],
        ['connect.sid', names.session],
        ['io', `${prefix}io`],
        ['ioBroker.sid', `${prefix}iobroker_session`],
        ['eos-admin.sid', `${prefix}legacy_session`],
        ['nexowatt_eos_first_login', names.firstLogin],
    ]);
    const internal = new Map([...external].map(([key, value]) => [value, key]));
    const normalized = new WeakMap();
    const responses = new WeakSet();
    const servers = new WeakMap();
    function normalizeRequest(req) {
        if (normalized.has(req)) {
            return normalized.get(req);
        }
        const header = req.headers?.cookie;
        if (header === undefined) {
            normalized.set(req, true);
            return true;
        }
        if (typeof header !== 'string' || Buffer.byteLength(header) > MAX_COOKIE_BYTES) {
            normalized.set(req, false);
            return false;
        }
        const selected = new Set();
        const cookies = [];
        let valid = true;
        for (const part of header.split(';')) {
            const value = part.trim();
            const separator = value.indexOf('=');
            const name = (separator < 0 ? value : value.slice(0, separator)).trim();
            const mapped = internal.get(name);
            if (mapped) {
                if (selected.has(mapped) || separator < 0) {
                    valid = false;
                    break;
                }
                selected.add(mapped);
                cookies.push(`${mapped}=${value.slice(separator + 1)}`);
            }
            else if (!GENERIC.includes(name) && !name.startsWith(RESERVED_PREFIX)) {
                cookies.push(value);
            }
        }
        // Clear previously parsed cookies as well: this can be called by a raw
        // server or an isolated Express harness before its own cookie parser.
        if (req.cookies) {
            for (const name of Object.keys(req.cookies)) {
                if (GENERIC.includes(name) || name.startsWith(RESERVED_PREFIX)) {
                    delete req.cookies[name];
                }
            }
        }
        if (valid && cookies.length) {
            req.headers.cookie = cookies.join('; ');
        }
        else {
            delete req.headers.cookie;
        }
        normalized.set(req, valid);
        return valid;
    }
    function rewriteCookie(value) {
        if (typeof value !== 'string') {
            return value;
        }
        const separator = value.indexOf('=');
        const name = (separator < 0 ? value : value.slice(0, separator)).trim();
        const mapped = external.get(name);
        return mapped ? `${mapped}${value.slice(separator)}` : value;
    }
    function wrapResponse(res) {
        if (responses.has(res)) {
            return;
        }
        responses.add(res);
        const setHeader = res.setHeader;
        res.setHeader = function (name, value) {
            if (String(name).toLowerCase() === 'set-cookie') {
                value = Array.isArray(value) ? value.map(rewriteCookie) : rewriteCookie(value);
            }
            return setHeader.call(this, name, value);
        };
        const writeHead = res.writeHead;
        if (typeof writeHead === 'function') {
            res.writeHead = function (...args) {
                const index = typeof args[1] === 'string' ? 2 : 1;
                const headers = args[index];
                if (Array.isArray(headers)) {
                    const values = [...headers];
                    for (let i = 0; i < values.length; i += 2) {
                        if (String(values[i]).toLowerCase() === 'set-cookie') {
                            values[i + 1] = rewriteCookie(values[i + 1]);
                        }
                    }
                    args[index] = values;
                }
                else if (headers && typeof headers === 'object') {
                    args[index] = Object.fromEntries(Object.entries(headers).map(([name, value]) => [
                        name,
                        name.toLowerCase() === 'set-cookie'
                            ? (Array.isArray(value) ? value.map(rewriteCookie) : rewriteCookie(value))
                            : value,
                    ]));
                }
                return writeHead.apply(this, args);
            };
        }
    }
    function reject(res) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end('{"error":"EOS_COOKIE_INVALID"}');
    }
    function middleware(req, res, next) {
        wrapResponse(res);
        if (!normalizeRequest(req)) {
            reject(res);
            return;
        }
        next();
    }
    function attach(server) {
        if (servers.has(server)) {
            return servers.get(server);
        }
        const emit = server.emit;
        // Socket.IO replaces request listeners when attaching to a server, and
        // parses upgrade cookies without Express. A local emit boundary runs
        // before both paths, regardless of their listener registration order.
        function emitIsolated(event, ...args) {
            if (event === 'request' || event === 'upgrade') {
                const [req, target] = args;
                if (event === 'request') {
                    wrapResponse(target);
                }
                if (!normalizeRequest(req)) {
                    if (event === 'request') {
                        reject(target);
                    }
                    else {
                        target.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
                    }
                    return true;
                }
            }
            return emit.call(this, event, ...args);
        }
        const detach = () => {
            if (server.emit === emitIsolated) {
                server.emit = emit;
            }
            server.removeListener('close', detach);
            servers.delete(server);
        };
        server.emit = emitIsolated;
        server.once('close', detach);
        servers.set(server, detach);
        return detach;
    }
    return { names, normalizeRequest, wrapResponse, middleware, attach };
}
module.exports = { createEosCookieNamespace };
//# sourceMappingURL=eosCookieNamespace.js.map