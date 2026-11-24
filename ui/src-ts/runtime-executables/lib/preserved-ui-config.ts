/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft bekannte Bestandskonfigurationen vor einer UI-Übernahme und
 * vor dem Start der übernommenen Laufzeit. Fremde globale Sicherungen sind
 * kein Ersatz für unlesbare, beschädigte oder verschwundene Kundendaten.
 * Daten und Wirkung: Nur berechtigte DB-Leseoperationen, feste State-IDs,
 * begrenzte JSON-Größe/Tiefe und fünf Sekunden Gesamtdeadline. Keine Writes.
 * Bei Änderungen: Fehlende optionale States von verlorenen vorhandenen Daten
 * unterscheiden; keine JSON-Inhalte oder Kundengeheimnisse in Fehler ausgeben.
 */
type JsonRecord = Record<string, unknown>;
export const PRESERVED_UI_STATE_IDS = ['installer.configJson', 'smarthome.timersJson', 'smarthome.logicClocksJson'] as const;
type StateId = typeof PRESERVED_UI_STATE_IDS[number];
interface Reader {
    getForeignObjectAsync(id: string): Promise<unknown>;
    getForeignStateAsync(id: string): Promise<unknown>;
}
function record(value: unknown): value is JsonRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function failure(code: string): Error & { code: string } { return Object.assign(new Error(code), { code }); }

/** JSON ist absichtlich unverschlüsselt im bestehenden ACL-geschützten State.
 * Hier wird kein fremdes Credential-Format geraten oder Zugriffsschutz umgangen. */
function parseState(id: StateId, object: unknown, state: unknown, required: boolean): JsonRecord | null {
    if (state === null || state === undefined) {
        if (required || (id === 'installer.configJson' && object !== null && object !== undefined)) {
            throw failure('EOS_MIGRATION_UI_STATE_UNAVAILABLE');
        }
        return null;
    }
    if (!record(state) || typeof state.val !== 'string') throw failure('EOS_MIGRATION_UI_STATE_INVALID');
    if (!state.val.trim() && id !== 'installer.configJson' && !required) return null;
    if (!state.val.trim() || Buffer.byteLength(state.val) > 512 * 1024) throw failure('EOS_MIGRATION_UI_STATE_INVALID');
    let parsed: unknown;
    try { parsed = JSON.parse(state.val); } catch { throw failure('EOS_MIGRATION_UI_STATE_INVALID'); }
    if (!record(parsed)) throw failure('EOS_MIGRATION_UI_STATE_INVALID');
    function visit(value: unknown, depth: number): void {
        if (depth > 20) throw failure('EOS_MIGRATION_UI_STATE_INVALID');
        if (!value || typeof value !== 'object') return;
        for (const [key, child] of Object.entries(value)) {
            if (['__proto__', 'constructor', 'prototype'].includes(key)) throw failure('EOS_MIGRATION_UI_STATE_INVALID');
            visit(child, depth + 1);
        }
    }
    visit(parsed, 0);
    const arrayFields = (value: JsonRecord, fields: readonly string[]): void => {
        for (const field of fields) {
            if (value[field] !== undefined && (!Array.isArray(value[field]) || !value[field].every(record))) {
                throw failure('EOS_MIGRATION_UI_STATE_INVALID');
            }
        }
    };
    if (id === 'installer.configJson') {
        for (const field of ['smartHome', 'smartHomeConfig', 'logicEditor']) {
            if (parsed[field] !== undefined && !record(parsed[field])) throw failure('EOS_MIGRATION_UI_STATE_INVALID');
        }
        if (record(parsed.smartHomeConfig)) arrayFields(parsed.smartHomeConfig, ['floors', 'rooms', 'functions', 'devices', 'scenes', 'pages']);
        if (record(parsed.logicEditor)) arrayFields(parsed.logicEditor, ['graphs']);
    } else arrayFields(parsed, id === 'smarthome.timersJson' ? ['timers'] : ['clocks']);
    return parsed;
}

/** Validiert den vorhandenen eigenen Installer-State vor jeder Start-Hydration.
 * Der Aufrufer behandelt ausschließlich fehlende States als Erstinitialisierung. */
export function parseInstallerConfigState(state: unknown): JsonRecord {
    try {
        const parsed = parseState('installer.configJson', null, state, true);
        if (!parsed) throw failure('EOS_UI_CONFIG_INVALID');
        return parsed;
    } catch { throw failure('EOS_UI_CONFIG_INVALID'); }
}

export async function readPreservedUiStates(reader: Reader, namespace: string, requiredStates: unknown = []): Promise<{
    values: Record<StateId, JsonRecord | null>; requiredStates: StateId[];
}> {
    if (!/^nexowatt-ui\.\d+$/.test(namespace) || !Array.isArray(requiredStates)
        || requiredStates.some((id: unknown) => !PRESERVED_UI_STATE_IDS.some(known => known === id))) throw failure('EOS_MIGRATION_UI_STATE_INVALID');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(failure('EOS_MIGRATION_UI_STATE_TIMEOUT')), 5000);
    });
    try {
        const rows = await Promise.race([deadline, Promise.all(PRESERVED_UI_STATE_IDS.map(async id => {
            const [object, state] = await Promise.all([
                reader.getForeignObjectAsync(`${namespace}.${id}`), reader.getForeignStateAsync(`${namespace}.${id}`),
            ]);
            return [id, parseState(id, object, state, requiredStates.includes(id))] as const;
        }))]);
        const values = Object.fromEntries(rows) as Record<StateId, JsonRecord | null>;
        return { values, requiredStates: rows.filter(row => row[1] !== null).map(row => row[0]) };
    } catch (error: unknown) {
        if (error instanceof Error && 'code' in error && typeof error.code === 'string'
            && /^EOS_MIGRATION_UI_STATE_/.test(error.code)) throw error;
        throw failure('EOS_MIGRATION_UI_STATE_UNAVAILABLE');
    } finally { if (timer) clearTimeout(timer); }
}
