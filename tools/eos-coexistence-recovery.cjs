#!/usr/bin/env node
'use strict';
/* Copyright (c) 2026 NexoWatt. Proprietary; see LICENSE. */
// Offline administration helper: bounded property reads only. It never changes
// ioBroker objects, accounts, files, services or backup configuration.
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { isDeepStrictEqual } = require('node:util');

const MAX_OUTPUT = 16384;
const DEFAULT_IDS = Object.freeze([
    'system.adapter.admin', 'system.adapter.admin.0',
    'system.adapter.backitup', 'system.adapter.backitup.0',
    'system.group.administrator', 'system.config', 'system.certificates', 'system.licenses',
]);
const FIELDS = Object.freeze(['acl', 'native._nexowattEosAclManaged', 'native._nexowattEosAclPrevious']);
const fail = code => new Error(code);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = value => DEFAULT_IDS.includes(value) || /^system\.adapter\.(?:admin|backitup)\.(?:0|[1-9]\d{0,3})$/.test(value);
const absolutePath = value => typeof value === 'string' && path.isAbsolute(value) && value.length <= 4096 && !/[\0\r\n]/.test(value);

function parseArguments(args) {
    const result = { directory: '/opt/iobroker', ids: [...DEFAULT_IDS], output: null };
    const seen = new Set();
    for (let i = 0; i < args.length; i++) {
        const flag = args[i];
        if (flag === '--apply') throw fail('APPLY_NOT_SUPPORTED_NO_ATOMIC_WRITE');
        if (flag === '--check') { if (seen.has(flag)) throw fail('ARGUMENTS_INVALID'); seen.add(flag); continue; }
        if (!['--iobroker-dir', '--output', '--object'].includes(flag) || !args[i + 1]) throw fail('ARGUMENTS_INVALID');
        const value = args[++i];
        if (flag !== '--object' && seen.has(flag)) throw fail('ARGUMENTS_INVALID');
        seen.add(flag);
        if (flag === '--object') {
            if (!validId(value) || result.ids.includes(value) || result.ids.length >= 24) throw fail('ARGUMENTS_INVALID');
            result.ids.push(value);
        } else {
            if (!absolutePath(value)) throw fail('ARGUMENTS_INVALID');
            result[flag === '--output' ? 'output' : 'directory'] = value;
        }
    }
    return result;
}

function resolveController(directory) {
    try {
        const root = fs.realpathSync(directory);
        if (!fs.statSync(root).isDirectory()) throw fail('CONTROLLER_PATH_INVALID');
        const controller = fs.realpathSync(path.join(root, 'node_modules/iobroker.js-controller'));
        if (!controller.startsWith(root + path.sep)) throw fail('CONTROLLER_PATH_INVALID');
        const fd = fs.openSync(path.join(controller, 'package.json'), fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
        let pkg;
        try {
            const stat = fs.fstatSync(fd);
            if (!stat.isFile() || stat.size > 131072) throw fail('CONTROLLER_PATH_INVALID');
            pkg = JSON.parse(fs.readFileSync(fd, 'utf8'));
        } finally { fs.closeSync(fd); }
        if (pkg.name !== 'iobroker.js-controller' || typeof pkg.version !== 'string' || !/^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[A-Za-z0-9.-]{1,64})?$/.test(pkg.version)) throw fail('CONTROLLER_PATH_INVALID');
        const cli = path.join(controller, 'iobroker.js');
        const stat = fs.lstatSync(cli);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw fail('CONTROLLER_PATH_INVALID');
        return { directory: root, cli, version: pkg.version };
    } catch { throw fail('CONTROLLER_PATH_INVALID'); }
}

function validAcl(value) {
    if (!record(value) || !/^system\.user\.[A-Za-z0-9_-]{1,96}$/.test(value.owner) || !/^system\.group\.[A-Za-z0-9_-]{1,96}$/.test(value.ownerGroup)) return false;
    if (!Object.hasOwn(value, 'object') || Object.keys(value).some(key => !['owner', 'ownerGroup', 'object', 'state', 'file'].includes(key))) return false;
    return ['object', 'state', 'file'].every(key => !Object.hasOwn(value, key) || (Number.isInteger(value[key]) && value[key] >= 0 && /^[0-7]{3}$/.test(value[key].toString(16).padStart(3, '0'))));
}

function decodeOutput(output) {
    if (typeof output !== 'string' || Buffer.byteLength(output) > MAX_OUTPUT) return { error: 'OUTPUT_LIMIT' };
    const value = output.trim();
    if (value === 'undefined') return { absent: true };
    try { return { value: JSON.parse(value) }; }
    catch { return { error: 'VALUE_INVALID' }; }
}

function createCliReader(target, execute = execFile) {
    const deadline = performance.now() + 60000;
    return (id, field) => new Promise(resolve => {
        if (!validId(id) || !(FIELDS.includes(field) || (id === 'system.group.administrator' && field === 'common.acl.file'))) return resolve({ error: 'READ_NOT_ALLOWED' });
        const remaining = Math.floor(deadline - performance.now());
        if (remaining <= 0) return resolve({ error: 'DEADLINE' });
        const env = { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' };
        if (typeof process.env.PATH === 'string') env.PATH = process.env.PATH;
        try {
            execute(process.execPath, [target.cli, 'object', 'get', id, field], {
                cwd: target.directory, env, shell: false, windowsHide: true, encoding: 'utf8',
                maxBuffer: MAX_OUTPUT, timeout: Math.min(5000, remaining), killSignal: 'SIGKILL',
            }, (error, stdout) => {
                // Do not stringify errors, stderr, native configuration or tokens.
                if (error) return resolve({ error: error.killed ? 'TIMEOUT' : error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' ? 'OUTPUT_LIMIT' : 'CLI_READ_FAILED' });
                return resolve(decodeOutput(stdout));
            });
        } catch { resolve({ error: 'CLI_READ_FAILED' }); }
    });
}

function assessObject(id, reads) {
    if (!validId(id)) throw fail('OBJECT_NOT_ALLOWED');
    const result = { id, status: 'NOT_MANAGED', applied: false };
    if (reads.some(read => !record(read) || read.error)) return { ...result, status: 'READ_UNAVAILABLE' };
    const [current, marker, previous] = reads;
    if (marker.value !== true) return marker.absent || marker.value === false || marker.value === null ? result : { ...result, status: 'MARKER_INVALID' };
    // A null/absent preimage cannot be turned into a guessed default ACL.
    if (previous.absent || previous.value === null) return { ...result, status: 'PRIOR_ACL_MISSING' };
    if (!validAcl(previous.value)) return { ...result, status: 'PRIOR_ACL_INVALID' };
    if (!validAcl(current.value)) return { ...result, status: 'CURRENT_ACL_INVALID' };
    // The historic setter preserved all extra ACL fields. They must match too.
    const expected = { ...previous.value, owner: 'system.user.admin', ownerGroup: 'system.group.administrator', object: 0x660 };
    if (!isDeepStrictEqual(current.value, expected)) return { ...result, status: 'CURRENT_ACL_CHANGED_OR_CUSTOM_GROUP' };
    return {
        ...result, status: 'REVIEW_PRIOR_ACL_RESTORE', currentAcl: current.value, priorAcl: previous.value,
        action: 'MANUAL_REVIEW_ONLY',
        requires: ['Protected current-object snapshot before any write', 'Stop concurrent object writers or use a verified atomic compare-and-swap', 'Re-read and compare current ACL and original marker immediately before a reviewed restore'],
    };
}

async function collectDiagnostics(read, ids, controllerVersion) {
    if (!Array.isArray(ids) || ids.length > 24 || new Set(ids).size !== ids.length || ids.some(id => !validId(id))) throw fail('OBJECT_NOT_ALLOWED');
    const report = {
        schema: 'nexowatt-eos-coexistence-recovery/v1', createdAt: new Date().toISOString(),
        readOnly: true, applied: false, controllerVersion,
        scope: 'Listed objects only; default instances are 0. Add known additional instances with --object.',
        objects: [], administratorFilePermissions: null,
        limitations: [
            'Separate property reads are not an atomic object snapshot; proposals are observations, never authorization to write.',
            'Only the historic default administrator-group ACL is recognized; changed or custom-group ACLs are left for review.',
            'Administrator role overwrites without a saved preimage cannot be restored automatically.',
            'This report contains no complete object/configuration backup and never replaces a protected pre-repair snapshot.',
            'Cookies, HTTP file delivery and completed Backitup jobs are not tested by this tool.',
        ],
    };
    for (const id of ids) {
        const reads = [];
        for (const field of FIELDS) {
            try { reads.push(await read(id, field)); } catch { reads.push({ error: 'CLI_READ_FAILED' }); }
        }
        report.objects.push(assessObject(id, reads));
    }
    let role;
    try { role = await read('system.group.administrator', 'common.acl.file'); } catch { role = { error: 'CLI_READ_FAILED' }; }
    const names = ['list', 'read', 'write', 'create', 'delete'];
    if (record(role?.value) && Object.keys(role.value).every(key => names.includes(key)) && Object.values(role.value).every(value => typeof value === 'boolean')) {
        report.administratorFilePermissions = {
            status: names.some(name => role.value[name] === false) ? 'REVIEW_FILE_CAPABILITIES_NO_PREIMAGE' : 'FILE_CAPABILITIES_OBSERVED',
            flags: Object.fromEntries(names.filter(name => Object.hasOwn(role.value, name)).map(name => [name, role.value[name]])),
            applied: false,
        };
    } else report.administratorFilePermissions = { status: 'FILE_CAPABILITIES_UNAVAILABLE', applied: false };
    return report;
}

function writeReport(file, report) {
    if (!absolutePath(file)) throw fail('ARGUMENTS_INVALID');
    let fd;
    try {
        fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0), 0o600);
        fs.writeFileSync(fd, JSON.stringify(report, null, 2) + '\n');
        fs.fsyncSync(fd);
    } catch { throw fail('REPORT_WRITE_FAILED'); }
    finally { if (fd !== undefined) fs.closeSync(fd); }
}

async function main(args) {
    const options = parseArguments(args);
    const target = resolveController(options.directory);
    const report = await collectDiagnostics(createCliReader(target), options.ids, target.version);
    if (options.output) writeReport(options.output, report);
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    if (report.objects.some(item => item.status === 'READ_UNAVAILABLE') || report.administratorFilePermissions.status === 'FILE_CAPABILITIES_UNAVAILABLE') process.exitCode = 2;
}

if (require.main === module) main(process.argv.slice(2)).catch(error => {
    const known = ['ARGUMENTS_INVALID', 'APPLY_NOT_SUPPORTED_NO_ATOMIC_WRITE', 'CONTROLLER_PATH_INVALID', 'OBJECT_NOT_ALLOWED', 'REPORT_WRITE_FAILED'];
    process.stderr.write(`EOS coexistence: ${known.includes(error.message) ? error.message : 'DIAGNOSTIC_FAILED'}. Keine ioBroker-Einstellungen geändert.\n`);
    process.exitCode = 1;
});

module.exports = { parseArguments, resolveController, validAcl, decodeOutput, createCliReader, assessObject, collectDiagnostics, writeReport };
