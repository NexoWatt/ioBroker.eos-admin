/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Enge Auswahlgrenze für die lokale PostgreSQL-Historie.
 * Daten und Wirkung: Nimmt keine Hostnamen, Dateipfade oder Geheimnisse vom Browser an.
 * Bestehende Historien bleiben erhalten; ein Providerwechsel erfordert nachgewiesene Neuanlage.
 */
import { isDeepStrictEqual } from 'node:util';
import { prepareInfluxHistoryChange } from './influx-config';
type Dict = Record<string, unknown>;
const record = (value: unknown): value is Dict => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (code: string): Error => Object.assign(new Error(code), { code });
/** Bundled native defaults are not evidence of a customer selecting a historian. */
export function isUntouchedHistoryDefault(value: unknown, packagedDefault: unknown): boolean {
    return value === undefined || isDeepStrictEqual(value, packagedDefault);
}
export function prepareHistoryChange(previous: unknown, incoming: unknown, newInstallationAllowed: boolean): Dict {
    if (!record(incoming) || incoming.provider !== 'postgresql') return prepareInfluxHistoryChange(previous, incoming);
    if (Object.keys(incoming).some(key => !['provider', 'postgresql', 'newInstallation'].includes(key)) ||
        !record(incoming.postgresql) || incoming.postgresql.profile !== 'local' ||
        Object.keys(incoming.postgresql).some(key => key !== 'profile') ||
        incoming.newInstallation !== undefined && typeof incoming.newInstallation !== 'boolean') throw fail('EOS_POSTGRES_PROFILE_INVALID');
    const old = record(previous) ? previous : {};
    if (old.provider !== 'postgresql') {
        if (!newInstallationAllowed) throw fail('EOS_POSTGRES_EXISTING_HISTORY');
        if (incoming.newInstallation !== true) throw fail('EOS_POSTGRES_NEW_INSTALLATION_REQUIRED');
    }
    return { ...old, provider: 'postgresql', postgresql: { profile: 'local' } };
}
