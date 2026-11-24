/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Schützt AppCenter-Zuordnungen vor veralteten Speicherformularen und
 * legt fehlende eigene Datenpunktobjekte vor der Laufzeitübernahme an.
 * Daten und Wirkung: Eine flüchtig geschützte HMAC-Revision verlässt den Server,
 * niemals Konfigurationswerte oder der HMAC-Schlüssel. Pro Objektgruppe gibt es
 * höchstens zwei Versuche; fehlende Messwerte bleiben ohne künstlichen Nullwert.
 * Zusammenhang: Automatische Gerätezuordnung und manuelles Speichern verwenden
 * denselben AppCenter-Mutationsschutz. Keine App oder Stellfreigabe wird erteilt.
 * Bei Änderungen: Veraltete nichtleere Listen, Ownership-Verlust, fehlgeschlagene
 * Objektanlage und unveränderte Kundenwerte prüfen; Neustarts verwerfen alte Revisionen.
 */
import { createHmac, randomBytes } from 'node:crypto';
import { createPublicHttpError } from './http-error-boundary';
const revisionSecret = randomBytes(32);

function record(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
    }
    return value;
}
/** Stable within this runtime across key ordering; restart invalidates old forms.
 * An ephemeral HMAC key prevents public revisions from becoming a secret-value guessing oracle. */
export function installerRevision(patch: unknown): string {
    return createHmac('sha256', revisionSecret).update(JSON.stringify(canonical(record(patch)))).digest('hex');
}
/** Older clients remain compatible until automatic bindings need protection.
 * Once present, a missing or stale token must never replace a newer nonempty row list. */
export function assertInstallerRevision(expected: unknown, patch: unknown): void {
    const bindings = record(record(record(patch).eosDeviceEms).bindings);
    const required = Object.keys(bindings).length > 0;
    if ((expected === undefined || expected === null) && !required) return;
    if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected) || expected !== installerRevision(patch)) {
        throw createPublicHttpError(409, 'EOS_INSTALLER_CONFIG_CHANGED',
            'Die EMS-Zuordnung wurde inzwischen geändert. Deine Eingaben bleiben erhalten. Bitte den aktuellen Stand über „Neu laden“ laden und die Änderungen vergleichen, bevor du erneut speicherst.');
    }
}

/** Bounded retries tolerate a transient controller failure. No deletion, state reset or detached work. */
export async function provisionInstallerObjects(options: Readonly<{
    canWrite(): boolean;
    steps: ReadonlyArray<() => Promise<unknown>>;
}>): Promise<void> {
    for (const step of options.steps) {
        let completed = false;
        for (let attempt = 0; attempt < 2; attempt++) {
            if (!options.canWrite()) throw createPublicHttpError(409, 'EOS_UI_OWNERSHIP_REQUIRED', 'Die Systemfreigabe ist nicht mehr gültig. Einstellungen wurden nicht neu übernommen.');
            try { await step(); completed = true; break; } catch { /* Retry only idempotent object creation. */ }
        }
        if (!completed) throw createPublicHttpError(503, 'EOS_EMS_OBJECT_PROVISION_FAILED',
            'Die benötigten EMS-Datenpunktobjekte konnten nicht angelegt werden. Es wurde kein erfolgreicher Abschluss gemeldet; Verbindung prüfen und erneut speichern.');
    }
}
