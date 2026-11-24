/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/preserved-ui-config.ts
 * Quell-Hash: sha256:21518d2a4293ebf1ae54e9ec44b0945e7d3bdac5b96d81ae68e1fe78e3ddafc7
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/preserved-ui-config.js.
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
exports.PRESERVED_UI_STATE_IDS = void 0;
exports.parseInstallerConfigState = parseInstallerConfigState;
exports.readPreservedUiStates = readPreservedUiStates;
exports.PRESERVED_UI_STATE_IDS = ['installer.configJson', 'smarthome.timersJson', 'smarthome.logicClocksJson'];
function record(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function failure(code) { return Object.assign(new Error(code), { code }); }
/** JSON ist absichtlich unverschlüsselt im bestehenden ACL-geschützten State.
 * Hier wird kein fremdes Credential-Format geraten oder Zugriffsschutz umgangen. */
function parseState(id, object, state, required) {
    if (state === null || state === undefined) {
        if (required || (id === 'installer.configJson' && object !== null && object !== undefined)) {
            throw failure('EOS_MIGRATION_UI_STATE_UNAVAILABLE');
        }
        return null;
    }
    if (!record(state) || typeof state.val !== 'string')
        throw failure('EOS_MIGRATION_UI_STATE_INVALID');
    if (!state.val.trim() && id !== 'installer.configJson' && !required)
        return null;
    if (!state.val.trim() || Buffer.byteLength(state.val) > 512 * 1024)
        throw failure('EOS_MIGRATION_UI_STATE_INVALID');
    let parsed;
    try {
        parsed = JSON.parse(state.val);
    }
    catch {
        throw failure('EOS_MIGRATION_UI_STATE_INVALID');
    }
    if (!record(parsed))
        throw failure('EOS_MIGRATION_UI_STATE_INVALID');
    function visit(value, depth) {
        if (depth > 20)
            throw failure('EOS_MIGRATION_UI_STATE_INVALID');
        if (!value || typeof value !== 'object')
            return;
        for (const [key, child] of Object.entries(value)) {
            if (['__proto__', 'constructor', 'prototype'].includes(key))
                throw failure('EOS_MIGRATION_UI_STATE_INVALID');
            visit(child, depth + 1);
        }
    }
    visit(parsed, 0);
    const arrayFields = (value, fields) => {
        for (const field of fields) {
            if (value[field] !== undefined && (!Array.isArray(value[field]) || !value[field].every(record))) {
                throw failure('EOS_MIGRATION_UI_STATE_INVALID');
            }
        }
    };
    if (id === 'installer.configJson') {
        for (const field of ['smartHome', 'smartHomeConfig', 'logicEditor']) {
            if (parsed[field] !== undefined && !record(parsed[field]))
                throw failure('EOS_MIGRATION_UI_STATE_INVALID');
        }
        if (record(parsed.smartHomeConfig))
            arrayFields(parsed.smartHomeConfig, ['floors', 'rooms', 'functions', 'devices', 'scenes', 'pages']);
        if (record(parsed.logicEditor))
            arrayFields(parsed.logicEditor, ['graphs']);
    }
    else
        arrayFields(parsed, id === 'smarthome.timersJson' ? ['timers'] : ['clocks']);
    return parsed;
}
/** Validiert den vorhandenen eigenen Installer-State vor jeder Start-Hydration.
 * Der Aufrufer behandelt ausschließlich fehlende States als Erstinitialisierung. */
function parseInstallerConfigState(state) {
    try {
        const parsed = parseState('installer.configJson', null, state, true);
        if (!parsed)
            throw failure('EOS_UI_CONFIG_INVALID');
        return parsed;
    }
    catch {
        throw failure('EOS_UI_CONFIG_INVALID');
    }
}
async function readPreservedUiStates(reader, namespace, requiredStates = []) {
    if (!/^nexowatt-ui\.\d+$/.test(namespace) || !Array.isArray(requiredStates)
        || requiredStates.some((id) => !exports.PRESERVED_UI_STATE_IDS.some(known => known === id)))
        throw failure('EOS_MIGRATION_UI_STATE_INVALID');
    let timer;
    const deadline = new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(failure('EOS_MIGRATION_UI_STATE_TIMEOUT')), 5000);
    });
    try {
        const rows = await Promise.race([deadline, Promise.all(exports.PRESERVED_UI_STATE_IDS.map(async (id) => {
                const [object, state] = await Promise.all([
                    reader.getForeignObjectAsync(`${namespace}.${id}`), reader.getForeignStateAsync(`${namespace}.${id}`),
                ]);
                return [id, parseState(id, object, state, requiredStates.includes(id))];
            }))]);
        const values = Object.fromEntries(rows);
        return { values, requiredStates: rows.filter(row => row[1] !== null).map(row => row[0]) };
    }
    catch (error) {
        if (error instanceof Error && 'code' in error && typeof error.code === 'string'
            && /^EOS_MIGRATION_UI_STATE_/.test(error.code))
            throw error;
        throw failure('EOS_MIGRATION_UI_STATE_UNAVAILABLE');
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
