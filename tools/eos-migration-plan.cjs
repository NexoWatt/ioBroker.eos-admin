#!/usr/bin/env node
'use strict';
/**
 * Copyright (c) 2026 NexoWatt. Proprietary; see LICENSE.
 * Erstellt aus einem lokalen ioBroker-JSON-Export einen prüfbaren Migrationsplan.
 * Keine Verbindung zur Anlage, keine live geschriebenen States, keine Löschung.
 * Konfigurationen können Geheimnisse enthalten: private Ausgabedatei (0600),
 * keine Werte in stdout, keine Übernahme von Aktivierungscodes oder Credentials.
 */
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

const MAX_BYTES = 20 * 1024 * 1024;
const EXCLUDED_NATIVE = new Set(['port', 'secure', 'certPublic', 'certPrivate', 'certChained', 'bind', 'publicPath', 'licenseKey', 'auth', 'ip']);
const FORBIDDEN_KEY = new Set(['__proto__', 'prototype', 'constructor']);
const SECRET_KEY = /(?:password|passphrase|secret|token|credential|privatekey|licensekey|apikey)/i;
const clone = value => JSON.parse(JSON.stringify(value));
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);

function createMigrationPlan(input, source, target) {
    if (!/^nexowatt-ui\.\d+$/.test(source) || !/^eos-admin\.\d+$/.test(target)) throw new Error('NAMESPACE_INVALID');
    if (!plain(input) || !plain(input.objects) || !plain(input.states)) throw new Error('EXPORT_REQUIRES_OBJECTS_AND_STATES');
    const sourceObject = input.objects[`system.adapter.${source}`];
    if (!plain(sourceObject) || sourceObject.type !== 'instance' || sourceObject._id !== `system.adapter.${source}` || !plain(sourceObject.native)) {
        throw new Error('SOURCE_INSTANCE_MISSING');
    }
    const warnings = [];
    const credentialReentry = [];
    const externalReferences = [];
    const idMap = Object.create(null);
    let nodes = 0;
    function walk(value, location, transform, depth = 0) {
        if (++nodes > 200000 || depth > 64) throw new Error('EXPORT_COMPLEXITY_LIMIT');
        if (typeof value === 'string') {
            if (value === source || value.startsWith(`${source}.`)) return transform ? target + value.slice(source.length) : value;
            if (value.includes(`${source}.`)) warnings.push({ path: location, code: 'EMBEDDED_REFERENCE_MANUAL_REVIEW' });
            return value;
        }
        if (Array.isArray(value)) return value.map((entry, i) => walk(entry, `${location}[${i}]`, transform, depth + 1));
        if (plain(value)) {
            const result = Object.create(null);
            for (const [key, entry] of Object.entries(value)) {
                if (FORBIDDEN_KEY.has(key)) throw new Error('UNSAFE_PROPERTY');
                if (transform && SECRET_KEY.test(key) && entry !== '' && entry !== null && entry !== undefined) {
                    credentialReentry.push(`${location}.${key}`);
                    continue;
                }
                result[key] = walk(entry, `${location}.${key}`, transform, depth + 1);
            }
            return result;
        }
        return value;
    }
    const native = Object.create(null);
    for (const [key, value] of Object.entries(sourceObject.native)) {
        if (FORBIDDEN_KEY.has(key)) throw new Error('UNSAFE_PROPERTY');
        if (EXCLUDED_NATIVE.has(key)) continue;
        if (SECRET_KEY.test(key)) { credentialReentry.push(`native.${key}`); continue; }
        native[key] = walk(value, `native.${key}`, true);
    }
    const objects = Object.create(null);
    const states = Object.create(null);
    const skipped = [];
    for (const [id, object] of Object.entries(input.objects)) {
        if (!id.startsWith(`${source}.`)) {
            if (id !== `system.adapter.${source}` && JSON.stringify(object).includes(`${source}.`)) externalReferences.push(id);
            continue;
        }
        const relative = id.slice(source.length + 1);
        if (/^(?:license|info)(?:\.|$)/.test(relative) || /(?:password|token|secret|credential)/i.test(relative)) {
            skipped.push({ id, reason: 'RUNTIME_STATUS_OR_CREDENTIAL' }); continue;
        }
        if (!plain(object) || object._id !== id || !['state', 'channel', 'device', 'folder'].includes(object.type)) throw new Error('SOURCE_OBJECT_INVALID');
        const dest = target + id.slice(source.length);
        if (Object.hasOwn(input.objects, dest) || Object.hasOwn(input.states, dest)) throw new Error('TARGET_COLLISION');
        idMap[id] = dest;
        const copy = walk(object, `objects.${id}`, true);
        copy._id = dest;
        delete copy._rev;
        objects[dest] = copy;
        const state = input.states[id];
        if (state !== undefined) {
            if (!plain(state) || state.ack !== true) {
                skipped.push({ id, reason: 'UNACKNOWLEDGED_COMMAND_NOT_REPLAYED' }); continue;
            }
            // Snapshot values are retained for review; this file never executes them.
            // JSON-encoded config text is parsed explicitly so ID references and
            // secret fields are not hidden inside an opaque configJson string.
            const copyState = clone(state);
            if (/configJson$/.test(relative) && typeof state.val === 'string') {
                let config;
                try { config = JSON.parse(state.val); } catch { throw new Error('CONFIG_JSON_INVALID'); }
                if (!plain(config)) throw new Error('CONFIG_JSON_INVALID');
                copyState.val = JSON.stringify(walk(config, `states.${id}.val`, true));
            } else {
                copyState.val = walk(state.val, `states.${id}.val`, true);
            }
            states[dest] = copyState;
        }
    }
    return {
        schema: 'nexowatt-eos-migration-plan/v1',
        createdAt: new Date().toISOString(),
        source,
        target,
        sourceVersion: sourceObject.common?.version || null,
        sourceWasEnabled: sourceObject.common?.enabled !== false,
        mode: 'OFFLINE_REVIEW_ONLY',
        applied: false,
        instancePatch: { _id: `system.adapter.${target}`, native: { eosUi: native } },
        objectProposals: objects,
        stateProposals: states,
        idMap,
        excludedNativeFields: [...EXCLUDED_NATIVE],
        credentialReentry,
        externalReferences,
        warnings,
        skipped,
        requiredBeforeApply: [
            'Restore-tested full backup including licenses, certificates, history and original packages.',
            'Confirm every old writer disabled and stopped on every host; verify new ownership guard.',
            'Review every proposed mapping and external reference; no automatic script/history rewrite.',
            'Re-enter protected credentials through the authenticated installer.',
            'Activate existing genuine NWL3 centrally; no NW1 activation key is converted or copied.',
            'Apply reviewed configuration and object/state plan with controller APIs while both EMS writers are stopped.',
            'Perform functional and hardware acceptance before removing any old instance or object.',
        ],
    };
}

if (require.main === module) {
    try {
        const args = process.argv.slice(2);
        const options = Object.create(null);
        const known = new Set(['--input', '--source', '--target', '--output']);
        for (let i = 0; i < args.length; i += 2) {
            if (!known.has(args[i]) || !args[i + 1] || options[args[i]]) throw new Error('ARGUMENTS_INVALID');
            options[args[i]] = args[i + 1];
        }
        if (!options['--input'] || !options['--output'] || !path.isAbsolute(options['--input']) || !path.isAbsolute(options['--output'])) {
            throw new Error('ABSOLUTE_INPUT_AND_OUTPUT_REQUIRED');
        }
        const fd = fs.openSync(options['--input'], fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
        let bytes;
        try {
            const stat = fs.fstatSync(fd);
            if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error('EXPORT_SIZE_INVALID');
            bytes = fs.readFileSync(fd);
            if (bytes.length > MAX_BYTES) throw new Error('EXPORT_SIZE_INVALID');
        } finally { fs.closeSync(fd); }
        const output = createMigrationPlan(JSON.parse(bytes.toString('utf8')), options['--source'], options['--target']);
        output.sourceSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
        fs.writeFileSync(options['--output'], JSON.stringify(output, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
        process.stdout.write('Migrationsplan erstellt. Keine Anlage geändert; Zuordnungen und Rückfall vor Anwendung prüfen.\n');
    } catch (error) {
        const safeCodes = ['NAMESPACE_INVALID', 'EXPORT_REQUIRES_OBJECTS_AND_STATES', 'SOURCE_INSTANCE_MISSING', 'EXPORT_COMPLEXITY_LIMIT', 'UNSAFE_PROPERTY', 'SOURCE_OBJECT_INVALID', 'TARGET_COLLISION', 'CONFIG_JSON_INVALID', 'ARGUMENTS_INVALID', 'ABSOLUTE_INPUT_AND_OUTPUT_REQUIRED', 'EXPORT_SIZE_INVALID'];
        process.stderr.write(`EOS migration: ${safeCodes.includes(error.message) ? error.message : 'FILE_OR_JSON_ERROR'}\n`);
        process.exitCode = 1;
    }
}
module.exports = { createMigrationPlan };
