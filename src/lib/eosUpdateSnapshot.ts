/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Liest ausschließlich die bestehenden EOS-Konfigurationen für eine verschlüsselte Update-Sicherung.
 * Daten und Wirkung: Führt zwei begrenzte Lesedurchläufe durch; bewahrt Geräte, EMS, Kundeneinstellungen und geschützte Alt-Namespaces ohne Datenbankänderung.
 * Bei Änderungen: Geheimnisse niemals zurückgeben oder protokollieren; gleichzeitige Änderungen, fehlende Zustände und alte Konfigurationshüllen mitprüfen.
 */
import { createHash } from 'node:crypto';

type Data = Record<string, unknown>;
export interface EosUpdateSnapshotReader {
    namespace: string;
    getForeignObjectAsync(id: string): Promise<unknown>;
    getForeignStateAsync(id: string): Promise<unknown>;
    getForeignStatesAsync(pattern: string): Promise<unknown>;
    decrypt(value: string): string;
    isBusy(): boolean;
}
const record = (value: unknown): value is Data => value !== null && typeof value === 'object' && !Array.isArray(value);
const modules = ['devices', 'eebus', 'backup', 'ui', 'migration'];
const configStates = [
    'installer.configJson',
    'smarthome.timersJson',
    'smarthome.logicClocksJson',
    'storageFarm.configJson',
    'storageFarm.groupsJson',
    'simulation.backupConfigJson',
    'simulation.backupSettingsJson',
    'simulation.active',
    'simulation.instanceId',
];
const MAX_BYTES = 8 * 1024 * 1024;
const fail = (): Error => new Error('EOS_UPDATE_CONFIGURATION_INVALID');
const has = (value: Data, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);

/** Sort a bounded JSON tree without changing primitive types or array order. */
export function normalizeUpdateConfiguration(value: unknown): unknown {
    let nodes = 0;
    let bytes = 0;
    const addBytes = (count: number): void => {
        bytes += count;
        if (bytes > MAX_BYTES) {
            throw fail();
        }
    };
    function stringBytes(value: string): void {
        // Count escaped JSON UTF-8 bytes before allocating a serialized copy.
        // Unpaired UTF-16 surrogates are escaped by JSON.stringify as six bytes.
        addBytes(2);
        if (!/["\\\p{Cc}\ud800-\udfff]/u.test(value)) {
            addBytes(Buffer.byteLength(value));
            return;
        }
        for (let index = 0; index < value.length; index++) {
            const code = value.charCodeAt(index);
            if (
                code === 0x22 ||
                code === 0x5c ||
                code === 8 ||
                code === 9 ||
                code === 10 ||
                code === 12 ||
                code === 13
            ) {
                addBytes(2);
            } else if (code < 0x20) {
                addBytes(6);
            } else if (code < 0x80) {
                addBytes(1);
            } else if (code < 0x800) {
                addBytes(2);
            } else if (
                code >= 0xd800 &&
                code <= 0xdbff &&
                value.charCodeAt(index + 1) >= 0xdc00 &&
                value.charCodeAt(index + 1) <= 0xdfff
            ) {
                addBytes(4);
                index++;
            } else {
                addBytes(code >= 0xd800 && code <= 0xdfff ? 6 : 3);
            }
        }
    }
    function visit(input: unknown, depth: number): unknown {
        if (++nodes > 100000 || depth > 40) {
            throw fail();
        }
        if (input === null || typeof input === 'boolean') {
            addBytes(input === false ? 5 : 4);
            return input;
        }
        if (typeof input === 'number' && Number.isFinite(input)) {
            addBytes(JSON.stringify(input).length);
            return input;
        }
        if (typeof input === 'string' && Buffer.byteLength(input) <= MAX_BYTES) {
            stringBytes(input);
            return input;
        }
        if (Array.isArray(input)) {
            if (input.length > 100000 - nodes) {
                throw fail();
            }
            addBytes(2 + Math.max(0, input.length - 1));
            return Array.from(input, (item: unknown) => visit(item, depth + 1));
        }
        if (!record(input)) {
            throw fail();
        }
        const output: Data = Object.create(null) as Data;
        const keys = Object.keys(input);
        if (keys.length > 100000 - nodes) {
            throw fail();
        }
        addBytes(2 + Math.max(0, keys.length - 1));
        for (const key of keys.sort()) {
            if (['__proto__', 'prototype', 'constructor'].includes(key)) {
                throw fail();
            }
            stringBytes(key);
            addBytes(1);
            output[key] = visit(input[key], depth + 1);
        }
        return output;
    }
    return visit(value, 0);
}

export async function readEosUpdateConfiguration(reader: EosUpdateSnapshotReader): Promise<unknown> {
    if (!/^eos-admin\.\d{1,6}$/.test(reader.namespace)) {
        throw fail();
    }
    const available = (): void => {
        if (reader.isBusy()) {
            throw new Error('EOS_UPDATE_CONFIGURATION_BUSY');
        }
    };
    function decodeEnvelope(value: unknown, stored: boolean): { config: Data; migration: Data | null } {
        if (!record(value)) {
            throw fail();
        }
        if (
            value.v !== (stored ? 2 : 1) ||
            typeof value.encrypted !== 'string' ||
            !value.encrypted ||
            Buffer.byteLength(value.encrypted) > MAX_BYTES
        ) {
            throw fail();
        }
        try {
            const plain = reader.decrypt(value.encrypted);
            if (typeof plain !== 'string' || plain === value.encrypted || Buffer.byteLength(plain) > MAX_BYTES) {
                throw fail();
            }
            const decoded: unknown = JSON.parse(plain);
            // The real store has exactly one outer v2 and one inner v1 envelope.
            // Arbitrary nested envelopes are neither migration data nor a valid backup.
            if (stored) {
                return decodeEnvelope(decoded, false);
            }
            if (!record(decoded) || (value.migration != null && !record(value.migration))) {
                throw fail();
            }
            return { config: decoded, migration: record(value.migration) ? value.migration : null };
        } catch {
            throw fail();
        }
    }
    function migratedUiNamespace(value: unknown): { namespace: string; requiredStates: string[] } {
        if (value == null) {
            return { namespace: reader.namespace, requiredStates: [] };
        }
        if (!record(value)) {
            throw fail();
        }
        if (value.preserveNamespace !== true) {
            return { namespace: reader.namespace, requiredStates: [] };
        }
        if (typeof value.source !== 'string' || !/^nexowatt-ui\.\d{1,6}$/.test(value.source)) {
            throw fail();
        }
        const requiredStates = value.requiredStates === undefined ? [] : value.requiredStates;
        if (
            !Array.isArray(requiredStates) ||
            requiredStates.length > 3 ||
            !requiredStates.every(
                (id: unknown): id is string =>
                    typeof id === 'string' &&
                    ['installer.configJson', 'smarthome.timersJson', 'smarthome.logicClocksJson'].includes(id),
            )
        ) {
            throw fail();
        }
        return { namespace: value.source, requiredStates };
    }
    async function capture(): Promise<unknown> {
        available();
        const instance = await reader.getForeignObjectAsync(`system.adapter.${reader.namespace}`);
        if (
            !record(instance) ||
            instance._id !== `system.adapter.${reader.namespace}` ||
            instance.type !== 'instance' ||
            !record(instance.native)
        ) {
            throw fail();
        }
        const native: Data = { ...instance.native };
        delete native.eosModules; // The actual module store below supersedes these legacy envelopes.
        const moduleValues: Data = {};
        const moduleMigrations: Data = {};
        let uiMigration: unknown = native.eosUiMigration;
        for (const id of modules) {
            available();
            const objectId = `${reader.namespace}.modules.${id}.configuration`;
            const object = await reader.getForeignObjectAsync(objectId);
            let envelope: { config: Data; migration: Data | null } | null = null;
            if (object != null) {
                if (
                    !record(object) ||
                    object._id !== objectId ||
                    object.type !== 'config' ||
                    !record(object.native) ||
                    !record(object.acl) ||
                    object.acl.owner !== 'system.user.admin' ||
                    object.acl.ownerGroup !== 'system.group.administrator' ||
                    object.acl.object !== 0x600 ||
                    typeof object.native.revision !== 'string' ||
                    !/^[a-f0-9-]{36}$/.test(object.native.revision)
                ) {
                    throw fail();
                }
                envelope = decodeEnvelope(object.native, true);
            } else if (record(instance.native.eosModules) && instance.native.eosModules[id] != null) {
                envelope = decodeEnvelope(instance.native.eosModules[id], false);
            }
            if (envelope) {
                moduleValues[id] = envelope.config;
                moduleMigrations[id] = envelope.migration;
                if (id === 'ui') {
                    uiMigration = envelope.migration;
                }
            }
        }
        // Migration hydrates this metadata into runtime memory; it need not be
        // present in the persisted instance object. The protected UI store wins.
        const retained = migratedUiNamespace(uiMigration);
        const uiNamespace = retained.namespace;
        const values: Data = {};
        for (const suffix of configStates) {
            available();
            const state = await reader.getForeignStateAsync(`${uiNamespace}.${suffix}`);
            if (state == null) {
                if (retained.requiredStates.includes(suffix)) {
                    throw fail();
                }
                continue;
            }
            if (!record(state) || !has(state, 'val')) {
                throw fail();
            }
            const value = state.val;
            if (typeof value === 'string' && Buffer.byteLength(value) > MAX_BYTES) {
                throw fail();
            }
            try {
                values[suffix] =
                    suffix.endsWith('Json') && typeof value === 'string' && value.trim()
                        ? (JSON.parse(value) as unknown)
                        : value;
            } catch {
                throw fail();
            }
            if (retained.requiredStates.includes(suffix) && !record(values[suffix])) {
                throw fail();
            }
        }
        available();
        const settings = await reader.getForeignStatesAsync(`${uiNamespace}.settings.*`);
        if (!record(settings) || Object.keys(settings).length > 512) {
            throw fail();
        }
        for (const [id, state] of Object.entries(settings)) {
            if (!id.startsWith(`${uiNamespace}.settings.`) || !record(state) || !has(state, 'val')) {
                throw fail();
            }
            values[id.slice(uiNamespace.length + 1)] = state.val;
        }
        available();
        return normalizeUpdateConfiguration({
            instanceNative: native,
            modules: moduleValues,
            moduleMigrations,
            uiNamespace,
            values,
        });
    }
    const first = await capture();
    const second = await capture();
    const digest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
    if (digest(first) !== digest(second)) {
        throw new Error('EOS_UPDATE_CONFIGURATION_CHANGED');
    }
    return second;
}
