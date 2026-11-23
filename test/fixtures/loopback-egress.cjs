'use strict';
// Test-only privacy boundary. This is not a production firewall or a sandbox
// against hostile code. It restricts the installed adapter's Node transports;
// npm remains able to download the reviewed dependencies before adapter start.
const path = require('node:path');
const net = require('node:net');

function isInstalledAdapter(argv, cwd) {
    if (typeof argv?.[1] !== 'string') return false;
    const entry = path.resolve(cwd, argv[1]);
    return entry === path.join(cwd, 'build', 'main.js') &&
        cwd.endsWith(path.join('node_modules', 'iobroker.eos-admin'));
}

function blocked() {
    const error = new Error('EOS_TEST_EGRESS_BLOCKED');
    error.code = 'EOS_TEST_EGRESS_BLOCKED';
    return error;
}

function loopback(host) {
    if (host === undefined || host === null || host === '') return true;
    if (typeof host !== 'string') return false;
    const value = host.toLowerCase().replace(/^\[([^\]]+)\]$/, '$1');
    if (value === 'localhost' || value === '::1') return true;
    if (net.isIP(value) === 4) return value.startsWith('127.');
    return /^::ffff:127\.(?:\d{1,3}\.){2}\d{1,3}$/.test(value) && net.isIP(value) === 6;
}

function requireLoopback(host) {
    if (!loopback(host)) throw blocked();
}

function requireUrl(value) {
    const url = value instanceof URL ? value : new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw blocked();
    requireLoopback(url.hostname);
}

function requireHttpArguments(args) {
    const first = args[0];
    let options;
    if (typeof first === 'string' || first instanceof URL) {
        requireUrl(first);
        options = args[1] && typeof args[1] === 'object' ? args[1] : {};
    } else options = first || {};
    requireLoopback(options.hostname);
    if (options.host !== undefined) {
        // Node's HTTP options host may carry a port; URL parsing handles IPv6.
        requireUrl(`http://${options.host}`);
    }
    if (options.socketPath) throw blocked();
    if (typeof options.path === 'string' && /^https?:\/\//i.test(options.path)) requireUrl(options.path);
    if (String(options.method || '').toUpperCase() === 'CONNECT') requireUrl(`http://${options.path || ''}`);
}

function requireSocketArguments(args) {
    // Node passes its internal [options, callback] normalized form too.
    if (Array.isArray(args[0])) return requireSocketArguments(args[0]);
    const first = args[0];
    if (first && typeof first === 'object') {
        if (first.path) throw blocked();
        requireLoopback(first.host ?? first.hostname);
    } else {
        // Numeric strings are TCP ports; other strings denote Unix sockets.
        if (typeof first === 'string' && !/^\d+$/.test(first)) throw blocked();
        if (typeof args[1] === 'string') requireLoopback(args[1]);
        for (const argument of args.slice(1)) {
            if (argument && typeof argument === 'object') {
                if (argument.path) throw blocked();
                requireLoopback(argument.host ?? argument.hostname);
            }
        }
    }
}

function installLoopbackEgress({ http, https, net: sockets, tls, dns, target = globalThis }) {
    for (const transport of [http, https]) {
        for (const name of ['request', 'get']) {
            const original = transport[name];
            transport[name] = function (...args) {
                requireHttpArguments(args);
                return Reflect.apply(original, this, args);
            };
        }
    }
    const connect = sockets.Socket.prototype.connect;
    sockets.Socket.prototype.connect = function (...args) {
        requireSocketArguments(args);
        return Reflect.apply(connect, this, args);
    };
    const tlsConnect = tls.connect;
    tls.connect = function (...args) {
        requireSocketArguments(args);
        return Reflect.apply(tlsConnect, this, args);
    };
    const lookup = dns.lookup;
    dns.lookup = function (hostname, ...args) {
        // Server.listen resolves its literal wildcard bind address through this
        // API too. Numeric IPs never perform a DNS lookup; outbound connection
        // guards remain independent and still reject nonloopback destinations.
        if (typeof hostname !== 'string' || net.isIP(hostname) === 0) requireLoopback(hostname);
        return Reflect.apply(lookup, this, [typeof hostname === 'string' && hostname.toLowerCase() === 'localhost' ? '127.0.0.1' : hostname, ...args]);
    };
    if (typeof target.fetch === 'function') {
        const fetch = target.fetch;
        target.fetch = function (input, ...args) {
            try {
                requireUrl(typeof input === 'string' || input instanceof URL ? input : input.url);
            } catch (error) { return Promise.reject(error); }
            return Reflect.apply(fetch, this, [input, ...args]);
        };
    }
}

module.exports = { isInstalledAdapter, installLoopbackEgress, loopback };
