#!/usr/bin/env node
'use strict';
/**
 * Copyright (c) 2026 NexoWatt. Proprietary; see LICENSE.
 * Lokale, rein lesende Zugangsanalyse. Ruft ausschließlich fest definierte
 * Controller-CLI-get-Befehle ohne Shell auf. Keine Serverroute, kein Passwort-
 * Reset, kein Dienststart und keine Ausgabe vollständiger Konfigurationen.
 */
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { execFile } = require('node:child_process');
const { performance } = require('node:perf_hooks');

const REQUEST_TIMEOUT_MS = 3000;
const TOTAL_TIMEOUT_MS = 30000;
const MAX_OUTPUT_BYTES = 16384;
const MAX_PACKAGE_BYTES = 131072;
const MESSAGES = Object.freeze({
    ARGUMENTS_INVALID: 'Erwartet: --iobroker-dir /opt/iobroker [--instance 0].',
    DIRECTORY_INVALID: 'Das angegebene ioBroker-Verzeichnis ist nicht gültig.',
    CONTROLLER_IDENTITY_INVALID: 'Unter dem Ziel wurde kein passend benannter ioBroker-Controller gefunden.',
    CONTROLLER_PATH_INVALID: 'Der feste Controller-CLI-Pfad konnte nicht sicher bestätigt werden.',
    DIAGNOSTIC_FAILED: 'Die Zugangsanalyse konnte nicht abgeschlossen werden.',
});

function parseArguments(args) {
    const options = Object.create(null);
    for (let i = 0; i < args.length; i += 2) {
        const name = args[i];
        if (!['--iobroker-dir', '--instance'].includes(name) || !args[i + 1] || Object.hasOwn(options, name)) {
            throw new Error('ARGUMENTS_INVALID');
        }
        options[name] = args[i + 1];
    }
    const directory = options['--iobroker-dir'];
    const instance = options['--instance'] ?? '0';
    if (typeof directory !== 'string' || !path.isAbsolute(directory) || directory.length > 4096 || ['\0', '\r', '\n'].some(char => directory.includes(char)) || !/^(?:0|[1-9]\d{0,3})$/.test(instance)) {
        throw new Error('ARGUMENTS_INVALID');
    }
    return { directory, instance };
}

function readPackage(file) {
    const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
        const stat = fs.fstatSync(fd);
        if (!stat.isFile() || stat.size > MAX_PACKAGE_BYTES) throw new Error('CONTROLLER_IDENTITY_INVALID');
        const bytes = fs.readFileSync(fd);
        if (bytes.length > MAX_PACKAGE_BYTES) throw new Error('CONTROLLER_IDENTITY_INVALID');
        return JSON.parse(bytes.toString('utf8'));
    } finally {
        fs.closeSync(fd);
    }
}

function resolveController(directory) {
    let root;
    try {
        root = fs.realpathSync(directory);
        if (!fs.statSync(root).isDirectory()) throw new Error('DIRECTORY_INVALID');
    } catch {
        throw new Error('DIRECTORY_INVALID');
    }
    const controller = path.join(root, 'node_modules', 'iobroker.js-controller');
    try {
        const actual = fs.realpathSync(controller);
        if (!actual.startsWith(root + path.sep)) throw new Error('CONTROLLER_PATH_INVALID');
        const pkg = readPackage(path.join(actual, 'package.json'));
        if (pkg.name !== 'iobroker.js-controller' || typeof pkg.version !== 'string' || !/^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[A-Za-z0-9.-]{1,64})?$/.test(pkg.version)) {
            throw new Error('CONTROLLER_IDENTITY_INVALID');
        }
        const cli = path.join(actual, 'iobroker.js');
        const stat = fs.lstatSync(cli);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw new Error('CONTROLLER_PATH_INVALID');
        return { directory: root, cli, version: pkg.version };
    } catch (error) {
        if (error.message === 'CONTROLLER_IDENTITY_INVALID') throw error;
        throw new Error('CONTROLLER_PATH_INVALID');
    }
}

function requests(instance) {
    if (!/^(?:0|[1-9]\d{0,3})$/.test(String(instance))) throw new Error('ARGUMENTS_INVALID');
    const result = [];
    const object = (field, id, property, type) => result.push({ field, args: ['object', 'get', id, property], type });
    const state = (field, id) => result.push({ field, args: ['state', 'getValue', id], type: 'boolean' });
    const eos = `system.adapter.eos-admin.${instance}`;
    for (const [group, id] of [['eos', eos], ['legacyAdmin', 'system.adapter.admin.0']]) {
        object(`${group}.enabled`, id, 'common.enabled', 'boolean');
        object(`${group}.port`, id, 'native.port', 'port');
        object(`${group}.bind`, id, 'native.bind', 'bind');
        object(`${group}.secure`, id, 'native.secure', 'boolean');
        object(`${group}.auth`, id, 'native.auth', 'boolean');
        object(`${group}.certPublic`, id, 'native.certPublic', 'certificateName');
        object(`${group}.certPrivate`, id, 'native.certPrivate', 'certificateName');
        object(`${group}.certChained`, id, 'native.certChained', 'certificateName');
        state(`${group}.alive`, `${id}.alive`);
    }
    object('eos.externalOrigin', eos, 'native.eosExternalOrigin', 'origin');
    object('eos.legacyAdminLock', eos, 'native.eosLockLegacyAdmin', 'boolean');
    object('eos.legacyAdminLockPort', eos, 'native.eosLegacyAdminLockPort', 'port');
    object('eos.legacyAdminLockBind', eos, 'native.eosLegacyAdminLockBind', 'bind');
    object('adminAccount.enabled', 'system.user.admin', 'common.enabled', 'boolean');
    // This property is never returned. Only presence of a bounded single-line
    // value is converted to a boolean; it does not validate a password or hash.
    object('adminAccount.passwordPresent', 'system.user.admin', 'common.password', 'passwordPresence');
    // The CLI has no certificate-name listing command. Its bounded dictionary
    // output is kept in memory only and reduced immediately to names/presence.
    object('certificates.inventory', 'system.certificates', 'native.certificates', 'certificateInventory');
    return result;
}

function decodeOutput(type, output) {
    if (typeof output !== 'string' || Buffer.byteLength(output) > MAX_OUTPUT_BYTES) return { value: null, error: 'OUTPUT_LIMIT' };
    const value = output.trim();
    if (type === 'certificateInventory') {
        try {
            const entries = JSON.parse(value);
            if (!entries || typeof entries !== 'object' || Array.isArray(entries) || Object.keys(entries).length > 128) return { value: null, error: 'VALUE_INVALID' };
            const names = Object.keys(entries).filter(name => /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(name) && typeof entries[name] === 'string' && entries[name].trim().length > 0).sort();
            return { value: { names, defaultPublic: names.includes('defaultPublic'), defaultPrivate: names.includes('defaultPrivate'), omittedNames: Object.keys(entries).length - names.length } };
        } catch { return { value: null, error: 'VALUE_INVALID' }; }
    }
    if (['\0', '\r', '\n'].some(char => value.includes(char))) return { value: null, error: 'VALUE_INVALID' };
    if (type === 'passwordPresence') {
        if (value === 'undefined' || value === 'null') return { value: false };
        return { value: value.length > 0 };
    }
    if (value === 'undefined' || value === 'null') return { value: null, error: 'VALUE_UNAVAILABLE' };
    if (type === 'boolean' && ['true', 'false'].includes(value)) return { value: value === 'true' };
    if (type === 'port' && /^\d{1,5}$/.test(value) && Number(value) >= 1 && Number(value) <= 65535) return { value: Number(value) };
    if (type === 'bind' && (value === '' || value === 'localhost' || net.isIP(value))) return { value };
    if (type === 'certificateName' && (value === '' || /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(value))) return { value };
    if (type === 'origin') {
        if (value === '') return { value: '' };
        try {
            const url = new URL(value);
            if (url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/' && url.origin === value) return { value: url.origin };
        } catch { /* Invalid values become a fixed diagnostic code only. */ }
    }
    return { value: null, error: 'VALUE_INVALID' };
}

function createCliReader(target, execute = execFile) {
    const deadline = performance.now() + TOTAL_TIMEOUT_MS;
    return request => new Promise(resolve => {
        const instance = /^system\.adapter\.eos-admin\.(0|[1-9]\d{0,3})(?:\.alive)?$/.exec(request?.args?.[2])?.[1] ?? '0';
        const expected = requests(instance).find(item => item.field === request?.field);
        if (!expected || request.type !== expected.type || !Array.isArray(request.args) || request.args.length !== expected.args.length || request.args.some((value, index) => value !== expected.args[index])) {
            return resolve({ value: null, error: 'REQUEST_NOT_ALLOWED' });
        }
        const remaining = Math.floor(deadline - performance.now());
        if (remaining <= 0) return resolve({ value: null, error: 'DEADLINE' });
        // No inherited NODE_OPTIONS/NODE_PATH and no arbitrary command or shell.
        const env = { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' };
        if (typeof process.env.PATH === 'string') env.PATH = process.env.PATH;
        try {
            execute(process.execPath, [target.cli, ...request.args], {
                cwd: target.directory,
                env,
                shell: false,
                windowsHide: true,
                encoding: 'utf8',
                maxBuffer: MAX_OUTPUT_BYTES,
                timeout: Math.min(REQUEST_TIMEOUT_MS, remaining),
                killSignal: 'SIGKILL',
            }, (error, stdout) => {
                if (error) {
                    // Never stringify child errors: they may contain stderr,
                    // stdout or the password hash read by the presence check.
                    const code = error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' ? 'OUTPUT_LIMIT' : error.killed ? 'TIMEOUT' : 'CLI_READ_FAILED';
                    resolve({ value: null, error: code });
                    return;
                }
                resolve(decodeOutput(request.type, stdout));
            });
        } catch {
            resolve({ value: null, error: 'CLI_READ_FAILED' });
        }
    });
}

function assess(report) {
    const findings = [];
    const add = (code, message) => findings.push({ code, message });
    const local = bind => ['127.0.0.1', '::1', 'localhost'].includes(bind);
    if (local(report.eos.bind)) add('EOS_LOOPBACK', 'EOS ist nur lokal gebunden. Ein Fernzugriff benötigt einen passend konfigurierten HTTPS-Eingang oder einen SSH-Tunnel; Port 443 wird hier nicht geprüft.');
    if (report.eos.secure === true && ['0.0.0.0', '::', ''].includes(report.eos.bind)) add('EOS_DIRECT_HTTPS_PROFILE', 'EOS ist für HTTPS auf allen konfigurierten Interfaces eingerichtet. Listener, Firewall, Zertifikatsvertrauen und Namensauflösung wurden nicht geprüft; ein HTTPS-Eingang auf 443 muss separat eingerichtet sein.');
    if (report.eos.secure === false && report.eos.externalOrigin) add('HTTPS_INGRESS_PROFILE', 'Der interne EOS-Port spricht HTTP, die konfigurierte öffentliche Origin HTTPS. https://IP:8188 ist dafür kein passender Zugang.');
    if (report.legacyAdmin.enabled === false) add('LEGACY_ADMIN_DISABLED', 'admin.0 ist deaktiviert. Vor bewusstem Recovery-Start EOS-/Legacy-Sperren kontrolliert anhalten.');
    if (report.eos.legacyAdminLock === true && report.eos.enabled === true) add('LEGACY_LOCK_ACTIVE', 'Die Legacy-Admin-Sperre ist in der ausgewählten aktiven EOS-Instanz gespeichert. Alpha 1 kann einen manuellen admin.0-Start zurücksetzen; ab Alpha 2 ist diese Sperre entfernt. Die installierte Adapterversion wird hier nicht festgestellt.');
    if (report.adminAccount.passwordPresent === false) add('ADMIN_PASSWORD_MISSING', 'Für system.user.admin ist kein Passwortwert vorhanden. Vor Authentifizierungsaktivierung interaktiv ein Passwort setzen; keine Passwörter in Befehlsargumente schreiben.');
    if (report.adminAccount.passwordPresent === null) add('ADMIN_PASSWORD_UNKNOWN', 'Der Passwortstatus konnte nicht bestätigt werden. Daraus folgt weder ein vorhandenes noch ein leeres Passwort.');
    if (report.adminAccount.enabled === false) add('ADMIN_ACCOUNT_DISABLED', 'Das Konto system.user.admin ist deaktiviert. Seine Aktivierung ist eine getrennte, bewusst zu prüfende Recovery-Maßnahme.');
    if (report.legacyAdmin.auth === false) add('LEGACY_AUTH_DISABLED', 'Beim vorhandenen Admin ist Authentifizierung ausgeschaltet. Vor Freigabe im Netz gültige Zugangsdaten und Authentifizierung sicherstellen; Recovery zunächst nur über Loopback/SSH.');
    if (report.eos.enabled === true && report.legacyAdmin.enabled === true && report.eos.port !== null && report.eos.port === report.legacyAdmin.port && report.eos.bind === report.legacyAdmin.bind) add('POSSIBLE_PORT_CONFLICT', 'Beide aktivierten Instanzen sind für dieselbe Bind-Adresse und denselben Port konfiguriert. Tatsächliche Listener wurden nicht abgefragt.');
    if (report.certificates?.inventory) add('CERTIFICATE_INVENTORY_ONLY', 'Zertifikatsnamen und nichtleere Einträge wurden gefunden. Das bestätigt weder lesbare Zertifikatsdateien noch Gültigkeit, Schlüsselzuordnung, SAN oder Browser-/Proxy-Vertrauen. Globale Standardzertifikate nicht ungeprüft erneuern.');
    for (const group of ['eos', 'legacyAdmin']) {
        const profile = report[group];
        if (profile.secure === true && (profile.certPublic === '' || profile.certPrivate === '')) add(`${group === 'eos' ? 'EOS' : 'ADMIN'}_TLS_NAMES_MISSING`, 'Für den HTTPS-Listener fehlen konfigurierte Zertifikatsnamen. Vor dem Start vorhandene passende Zertifikate auswählen.');
    }
    return findings;
}

async function collectDiagnostics(read, instance, controllerVersion) {
    const report = {
        schema: 'nexowatt-eos-access-diagnostics/v1',
        readOnly: true,
        controller: { name: 'iobroker.js-controller', version: controllerVersion },
        eos: { instance: `eos-admin.${instance}` },
        legacyAdmin: { instance: 'admin.0' },
        adminAccount: {},
        certificates: {},
        readErrors: [],
        scope: 'Ausgewählte EOS-Instanz, admin.0, Passwortvorhandensein und Zertifikatsnamen; keine Prüfung anderer Instanzen, Listener, Zertifikatsgültigkeit/-dateien, Namensauflösung oder Passwortgültigkeit.',
    };
    const list = requests(instance);
    let index = 0;
    async function worker() {
        while (index < list.length) {
            const request = list[index++];
            let result;
            try { result = await read(request); } catch { result = { value: null, error: 'CLI_READ_FAILED' }; }
            const [group, property] = request.field.split('.');
            report[group][property] = result.value ?? null;
            if (result.error) report.readErrors.push({ field: request.field, code: result.error });
        }
    }
    await Promise.all([worker(), worker(), worker()]);
    report.readErrors.sort((a, b) => a.field.localeCompare(b.field));
    report.findings = assess(report);
    return report;
}

async function main(args) {
    const options = parseArguments(args);
    const target = resolveController(options.directory);
    const report = await collectDiagnostics(createCliReader(target), options.instance, target.version);
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    // Partial reads are visible and produce a nonzero status; never claim a
    // complete successful diagnosis merely because the utility itself ran.
    if (report.readErrors.length) process.exitCode = 2;
}

if (require.main === module) {
    main(process.argv.slice(2)).catch(error => {
        const code = Object.hasOwn(MESSAGES, error.message) ? error.message : 'DIAGNOSTIC_FAILED';
        process.stderr.write(`EOS access diagnostics: ${code}. ${MESSAGES[code]}\n`);
        process.exitCode = 1;
    });
}

module.exports = { parseArguments, resolveController, requests, decodeOutput, createCliReader, collectDiagnostics, assess };
