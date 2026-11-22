#!/usr/bin/env node
'use strict';
/** Copyright (c) 2026 NexoWatt. Proprietary; see LICENSE.
 * Rendert ausschließlich eine prüfbare Konfigurationsdatei. Installiert keine
 * Pakete, startet keine Dienste und erzeugt weder CA noch private Schlüssel.
 */
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');

function render({ ip, certificate, privateKey }) {
    if (net.isIP(ip) !== 4) throw new Error('DEVICE_IPV4_REQUIRED');
    for (const value of [certificate, privateKey]) {
        if (typeof value !== 'string' || !path.posix.isAbsolute(value) || value.length > 4096 || !/^\/[A-Za-z0-9._/-]+$/.test(value) || value.split('/').includes('..')) {
            throw new Error('CERTIFICATE_PATH_INVALID');
        }
    }
    if (certificate === privateKey) throw new Error('CERTIFICATE_AND_KEY_MUST_DIFFER');
    return fs.readFileSync(path.join(__dirname, 'nginx-eos.conf.template'), 'utf8')
        .replaceAll('@@DEVICE_IP@@', ip)
        .replaceAll('@@CERTIFICATE@@', certificate)
        .replaceAll('@@PRIVATE_KEY@@', privateKey);
}

if (require.main === module) {
    try {
        const args = process.argv.slice(2);
        const values = Object.create(null);
        const names = new Set(['--ip', '--certificate', '--private-key', '--output']);
        for (let i = 0; i < args.length; i += 2) {
            if (!names.has(args[i]) || !args[i + 1] || values[args[i]]) throw new Error('ARGUMENTS_INVALID');
            values[args[i]] = args[i + 1];
        }
        if (!values['--output'] || !path.isAbsolute(values['--output'])) throw new Error('ABSOLUTE_OUTPUT_REQUIRED');
        const content = render({ ip: values['--ip'], certificate: values['--certificate'], privateKey: values['--private-key'] });
        fs.writeFileSync(values['--output'], content, { flag: 'wx', mode: 0o600 });
        process.stdout.write('Konfiguration erstellt. Noch nicht installiert; nginx -t und Geräteabnahme erforderlich.\n');
    } catch (error) {
        const codes = ['DEVICE_IPV4_REQUIRED', 'CERTIFICATE_PATH_INVALID', 'CERTIFICATE_AND_KEY_MUST_DIFFER', 'ARGUMENTS_INVALID', 'ABSOLUTE_OUTPUT_REQUIRED'];
        const code = error.code === 'EEXIST' ? 'OUTPUT_EXISTS' : codes.includes(error.message) ? error.message : 'FILE_ERROR';
        process.stderr.write(`EOS ingress: ${code}\n`);
        process.exitCode = 1;
    }
}
module.exports = { render };
