#!/usr/bin/env node
/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. Offline manufacturer tool. */
'use strict';
const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { X509Certificate, createPublicKey, randomBytes } = require('node:crypto');
const { isIP } = require('node:net');

function fail(message) { throw new Error(message); }
function argumentsFor(argv) {
    const [command, ...rest] = argv;
    if (!['init', 'issue'].includes(command)) fail('Verwendung: node tools/eos-tls-issuer.cjs init --directory ORDNER [--passphrase-file DATEI]\noder: issue --directory ORDNER --request ANFRAGE.pem --names nexowatt,nexowatt.local,192.168.10.153 --output NEUER_ORDNER [--passphrase-file DATEI]');
    const options = { command };
    const allowed = new Set(['directory', 'request', 'names', 'output', 'passphrase-file']);
    for (let index = 0; index < rest.length; index += 2) {
        const key = rest[index]?.slice(2);
        if (!rest[index]?.startsWith('--') || !allowed.has(key) || !rest[index + 1] || Object.hasOwn(options, key)) fail('Ungültige oder doppelte Option.');
        options[key] = rest[index + 1];
    }
    if (!options.directory) fail('--directory fehlt.');
    if (command === 'issue' && (!options.request || !options.names || !options.output)) fail('--request, --names und --output sind erforderlich.');
    return options;
}
async function secureFile(file, max = 128 * 1024, secret = false) {
    const before = await fs.lstat(file);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > max) fail('Unzulässige Datei.');
    // O_NOFOLLOW is unavailable on some Windows versions. Matching the opened
    // file identity to lstat also prevents a path substitution on those hosts.
    const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    const bytes = Buffer.alloc(max + 1);
    try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.nlink !== 1 || stat.size > max || stat.dev !== before.dev || stat.ino !== before.ino) fail('Unzulässige Datei.');
        if (secret && process.platform !== 'win32' && ((stat.mode & 0o077) || stat.uid !== process.getuid())) fail('Geheime Datei muss dem Benutzer gehören und Modus 0600 haben.');
        let length = 0;
        while (length < bytes.length) {
            const { bytesRead } = await handle.read(bytes, length, bytes.length - length, length);
            if (bytesRead === 0) break;
            length += bytesRead;
        }
        const after = await handle.stat();
        if (length > max || length !== stat.size || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs) fail('Datei zu groß oder während des Lesens verändert.');
        return bytes.subarray(0, length).toString('utf8');
    } finally {
        if (secret) bytes.fill(0);
        await handle.close();
    }
}
function names(value) {
    const result = [...new Set(value.split(',').map(name => name.trim().toLowerCase()))].sort();
    if (!result.length || result.length > 32 || result.some(name => !isIP(name) && (name.length > 253 || !name.split('.').every(label => label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))))) fail('Ungültige Namen/IP-Adressen; keine Platzhalter oder Konfigurationsfragmente erlaubt.');
    return result;
}
function run(args, capture = false) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.platform === 'win32' ? 'openssl.exe' : '/usr/bin/openssl', args, { shell: false, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', env: { ...process.env, OPENSSL_CONF: process.platform === 'win32' ? 'NUL' : '/dev/null' } });
        let output = '';
        let size = 0;
        const timer = setTimeout(() => { child.kill(); reject(new Error('OpenSSL-Zeitüberschreitung.')); }, 120000);
        if (capture) {
            child.stdout.on('data', chunk => { size += chunk.length; if (size > 128 * 1024) child.kill(); else output += chunk.toString('utf8'); });
            child.stderr.on('data', chunk => { size += chunk.length; if (size > 128 * 1024) child.kill(); });
        }
        child.once('error', () => { clearTimeout(timer); reject(new Error('OpenSSL ist nicht verfügbar.')); });
        child.once('close', code => { clearTimeout(timer); if (code === 0 && size <= 128 * 1024) resolve(output); else reject(new Error('OpenSSL fehlgeschlagen.')); });
    });
}
async function main(argv) {
    process.umask(0o077);
    const options = argumentsFor(argv);
    const directory = path.resolve(options.directory);
    let passphrase = [];
    if (options['passphrase-file']) {
        const file = path.resolve(options['passphrase-file']);
        const secret = await secureFile(file, 4096, true);
        if (secret.trim().length < 16 || secret.trim().split(/\r?\n/).length !== 1) fail('Passphrase-Datei benötigt eine einzelne Zeile mit mindestens 16 Zeichen.');
        passphrase = ['-passin', `file:${file}`];
    } else if (!process.stdin.isTTY) fail('Ein interaktives Terminal oder eine geschützte --passphrase-file ist erforderlich.');
    if (options.command === 'init') {
        await fs.mkdir(directory, { mode: 0o700 }); // Never overwrite an existing issuer.
        await run(['genpkey', '-algorithm', 'EC', '-pkeyopt', 'ec_paramgen_curve:secp384r1', '-aes-256-cbc', ...(passphrase.length ? ['-pass', passphrase[1]] : []), '-out', path.join(directory, 'issuer-private.pem')]);
        await run(['req', '-new', '-x509', '-sha384', '-days', '3650', '-key', path.join(directory, 'issuer-private.pem'), ...passphrase, '-out', path.join(directory, 'root.pem'), '-subj', '/O=NexoWatt/CN=NexoWatt EOS Local Root CA', '-addext', 'basicConstraints=critical,CA:TRUE,pathlen:0', '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-addext', 'subjectKeyIdentifier=hash', '-addext', 'authorityKeyIdentifier=keyid:always']);
        const certificate = new X509Certificate(await secureFile(path.join(directory, 'root.pem')));
        process.stdout.write(`NexoWatt-CA erstellt. SHA-256: ${certificate.fingerprint256}\nNur root.pem verteilen. issuer-private.pem und Passphrase getrennt und gesichert aufbewahren.\n`);
        return;
    }
    const dirStat = await fs.lstat(directory);
    if (!dirStat.isDirectory() || dirStat.isSymbolicLink() || (process.platform !== 'win32' && ((dirStat.mode & 0o077) || dirStat.uid !== process.getuid()))) fail('Ungeschützter Herstellerordner.');
    await secureFile(path.join(directory, 'issuer-private.pem'), 16384, true);
    const root = await secureFile(path.join(directory, 'root.pem'));
    const ca = new X509Certificate(root);
    if (!ca.ca || !ca.verify(ca.publicKey) || Date.parse(ca.validTo) < Date.now() + 397 * 86400000 || Date.parse(ca.validFrom) > Date.now()) fail('Hersteller-CA ist nicht für die neue Laufzeit gültig.');
    // Pin the exact public request bytes before OpenSSL's separate validation and
    // signing commands. A changing download/share path must not swap the key.
    const requestBytes = await secureFile(path.resolve(options.request), 16384);
    const snapshot = await fs.mkdtemp(path.join(directory, '.request-'));
    try {
    const request = path.join(snapshot, 'request.pem');
    await fs.writeFile(request, requestBytes, { flag: 'wx', mode: 0o600 });
    await run(['req', '-in', request, '-verify', '-noout']);
    const publicKey = createPublicKey(await run(['req', '-in', request, '-pubkey', '-noout'], true));
    if (publicKey.asymmetricKeyType !== 'ec' || publicKey.asymmetricKeyDetails.namedCurve !== 'prime256v1') fail('Es wird eine vom EOS erzeugte P-256-Geräteanfrage erwartet.');
    const approvedNames = names(options.names);
    const output = path.resolve(options.output);
    await fs.mkdir(output, { mode: 0o700 });
    const extensions = path.join(output, 'extensions.cnf');
    await fs.writeFile(extensions, `[server]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid,issuer\nsubjectAltName=${approvedNames.map(name => `${isIP(name) ? 'IP' : 'DNS'}:${name}`).join(',')}\n`, { flag: 'wx', mode: 0o600 });
    try {
        await run(['x509', '-req', '-in', request, '-CA', path.join(directory, 'root.pem'), '-CAkey', path.join(directory, 'issuer-private.pem'), ...passphrase, '-set_serial', `0x${randomBytes(20).toString('hex')}`, '-days', '397', '-sha256', '-extfile', extensions, '-extensions', 'server', '-out', path.join(output, 'certificate.pem')]);
        await run(['verify', '-x509_strict', '-auth_level', '2', '-purpose', 'sslserver', '-trusted', path.join(directory, 'root.pem'), path.join(output, 'certificate.pem')]);
        await fs.writeFile(path.join(output, 'root.pem'), root, { flag: 'wx', mode: 0o600 });
        process.stdout.write(`Gerätezertifikat signiert für: ${approvedNames.join(', ')}\nStamm-CA SHA-256: ${ca.fingerprint256}\ncertificate.pem und root.pem auf das anfragende EOS übertragen.\n`);
    } finally { await fs.rm(extensions, { force: true }); }
    } finally { await fs.rm(snapshot, { recursive: true, force: true }); }
}
if (require.main === module) main(process.argv.slice(2)).catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
module.exports = { main, names, secureFile };
