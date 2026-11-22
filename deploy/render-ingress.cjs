#!/usr/bin/env node
// @ts-check
'use strict';
/** Copyright (c) 2026 NexoWatt. Proprietary; see LICENSE.
 * Rendert ausschließlich eine prüfbare Konfiguration. Keine Dienstinstallation,
 * keine Schlüsselgenerierung, keine Netzwerkverbindung, kein Überschreiben.
 */
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');

const CODES = new Set(['DEVICE_IPV4_REQUIRED', 'CERTIFICATE_PATH_INVALID', 'OUTPUT_PATH_INVALID',
    'PATH_UNSAFE', 'CERTIFICATE_AND_KEY_MUST_DIFFER', 'UPSTREAM_PROTOCOL_INVALID', 'UPSTREAM_NAME_INVALID',
    'UPSTREAM_CA_REQUIRED', 'HTTP_PROFILE_TLS_OPTIONS_FORBIDDEN', 'LOCAL_NAME_OPTION_INVALID',
    'ARGUMENTS_INVALID', 'OUTPUT_EXISTS']);

/** Canonical absolute POSIX paths only; no Nginx metacharacters.
 * @param {unknown} value
 * @param {string} code
 * @returns {string}
 */
function checkedPath(value, code) {
    if (typeof value !== 'string' || value.length > 4096 || !/^\/[A-Za-z0-9._/-]+$/.test(value)
        || path.posix.normalize(value) !== value || value.endsWith('/')
        || value.split('/').some(part => part === '.' || part === '..')) throw new Error(code);
    return value;
}

/** No symlinks or writable foreign directories. Sticky temporary directories
 * are permitted; output uses O_EXCL. Owner/root remain the local trust boundary.
 * @param {string} filename
 */
function checkedParents(filename) {
    const uid = typeof process.getuid === 'function' ? process.getuid() : null;
    let current = '/';
    for (const part of path.posix.dirname(filename).split('/').filter(Boolean)) {
        current = path.posix.join(current, part);
        const stat = fs.lstatSync(current);
        if (!stat.isDirectory() || stat.isSymbolicLink()
            || (uid !== null && stat.uid !== uid && stat.uid !== 0)
            || ((stat.mode & 0o022) !== 0 && (stat.mode & 0o1000) === 0)) throw new Error('PATH_UNSAFE');
    }
}

/** @param {unknown} filename @param {boolean} privateFile */
function checkedFile(filename, privateFile = false) {
    const checkedFilename = checkedPath(filename, 'CERTIFICATE_PATH_INVALID');
    checkedParents(checkedFilename);
    const stat = fs.lstatSync(checkedFilename);
    const uid = typeof process.getuid === 'function' ? process.getuid() : null;
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0 || stat.size > 1024 * 1024
        || (stat.mode & 0o022) !== 0 || (privateFile && (stat.mode & 0o007) !== 0)
        || (uid !== null && stat.uid !== uid && stat.uid !== 0)) throw new Error('PATH_UNSAFE');
    return stat;
}

/** @param {unknown} value @returns {string} */
function dnsName(value) {
    if (typeof value !== 'string' || value.length > 253 || value !== value.toLowerCase()
        || net.isIP(value) !== 0 || !value.split('.').every(label =>
            /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) throw new Error('UPSTREAM_NAME_INVALID');
    return value;
}

/** @param {{ip?: unknown, certificate?: unknown, privateKey?: unknown, upstreamProtocol?: unknown, upstreamName?: unknown, upstreamCa?: unknown, includeLocalName?: unknown}} options */
function render({ ip, certificate, privateKey, upstreamProtocol = 'https', upstreamName, upstreamCa, includeLocalName = false }) {
    if (typeof ip !== 'string' || net.isIP(ip) !== 4) throw new Error('DEVICE_IPV4_REQUIRED');
    const certificatePath = checkedPath(certificate, 'CERTIFICATE_PATH_INVALID');
    const privateKeyPath = checkedPath(privateKey, 'CERTIFICATE_PATH_INVALID');
    if (certificatePath === privateKeyPath) throw new Error('CERTIFICATE_AND_KEY_MUST_DIFFER');
    if (typeof upstreamProtocol !== 'string' || !['https', 'http'].includes(upstreamProtocol)) throw new Error('UPSTREAM_PROTOCOL_INVALID');
    if (typeof includeLocalName !== 'boolean') throw new Error('LOCAL_NAME_OPTION_INVALID');
    let tls = '# Explicit legacy profile: HTTP only to the fixed loopback upstream.';
    if (upstreamProtocol === 'https') {
        upstreamName = dnsName(upstreamName);
        if (!upstreamCa) throw new Error('UPSTREAM_CA_REQUIRED');
        checkedFile(upstreamCa);
        tls = `proxy_ssl_verify on;\n        proxy_ssl_trusted_certificate ${upstreamCa};\n        proxy_ssl_verify_depth 3;\n        proxy_ssl_server_name on;\n        proxy_ssl_name ${upstreamName};\n        proxy_ssl_protocols TLSv1.2 TLSv1.3;`;
    } else if (upstreamName !== undefined || upstreamCa !== undefined || includeLocalName) throw new Error('HTTP_PROFILE_TLS_OPTIONS_FORBIDDEN');
    const cert = checkedFile(certificatePath);
    const key = checkedFile(privateKeyPath, true);
    if (cert.dev === key.dev && cert.ino === key.ino) throw new Error('CERTIFICATE_AND_KEY_MUST_DIFFER');
    const names = upstreamProtocol === 'http' ? [ip] : [ip, 'nexowatteos', ...(includeLocalName ? ['nexowatteos.local'] : [])];
    const hosts = names.flatMap(name => [`    "${name}" 1;`, `    "${name}:443" 1;`]).join('\n');
    return fs.readFileSync(path.join(__dirname, 'nginx-eos.conf.template'), 'utf8')
        .replaceAll('@@DEVICE_IP@@', ip)
        .replaceAll('@@SERVER_NAMES@@', names.join(' '))
        .replaceAll('@@ALLOWED_HOSTS@@', hosts)
        .replaceAll('@@CERTIFICATE@@', certificatePath)
        .replaceAll('@@PRIVATE_KEY@@', privateKeyPath)
        .replaceAll('@@UPSTREAM_PROTOCOL@@', upstreamProtocol)
        .replaceAll('@@UPSTREAM_TLS@@', tls);
}

/** @param {unknown} filename @param {string} content */
function writeOutput(filename, content) {
    const checkedFilename = checkedPath(filename, 'OUTPUT_PATH_INVALID');
    checkedParents(checkedFilename);
    const fd = fs.openSync(checkedFilename, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL
        | (fs.constants.O_NOFOLLOW || 0), 0o600);
    try { fs.writeFileSync(fd, content, 'utf8'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

if (require.main === module) {
    try {
        const args = process.argv.slice(2);
        /** @type {Record<string, string>} */
        const values = Object.create(null);
        const names = new Set(['--ip', '--certificate', '--private-key', '--output', '--upstream-protocol',
            '--upstream-name', '--upstream-ca', '--include-local-name']);
        for (let i = 0; i < args.length; i += 2) {
            const name = args[i];
            const value = args[i + 1];
            if (typeof name !== 'string' || !names.has(name) || !value || Object.hasOwn(values, name)) throw new Error('ARGUMENTS_INVALID');
            values[name] = value;
        }
        if (values['--include-local-name'] !== undefined && !['true', 'false'].includes(values['--include-local-name'])) {
            throw new Error('LOCAL_NAME_OPTION_INVALID');
        }
        const content = render({ ip: values['--ip'], certificate: values['--certificate'], privateKey: values['--private-key'],
            upstreamProtocol: values['--upstream-protocol'], upstreamName: values['--upstream-name'],
            upstreamCa: values['--upstream-ca'], includeLocalName: values['--include-local-name'] === 'true' });
        writeOutput(values['--output'], content);
        process.stdout.write('Konfiguration erstellt. Noch nicht installiert; nginx -t und TLS-/Geräteabnahme erforderlich.\n');
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        const code = error instanceof Error && 'code' in error && error.code === 'EEXIST'
            ? 'OUTPUT_EXISTS' : CODES.has(message) ? message : 'FILE_ERROR';
        process.stderr.write(`EOS ingress: ${code}\n`);
        process.exitCode = 1;
    }
}
module.exports = { render, writeOutput };
