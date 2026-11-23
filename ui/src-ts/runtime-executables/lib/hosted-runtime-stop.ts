/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Bestätigt den Stopp der eingebetteten Oberfläche erst nach dem Ende bereits begonnener Initialisierungen.
 * Daten und Wirkung: Wartet begrenzt auf Startversuche und abschließende Bereinigung; eine unklare Beendigung erlaubt keine Rückübergabe an Altregler.
 * Zusammenhang: createHostedRuntime sperrt neue Starts und Schreibrechte synchron; die Migration verwendet ausschließlich den bestätigten Stop-Erfolg.
 * Bei Änderungen: Späte Startabschlüsse, fehlerhafte Bereinigung, Zeitlimit und die dauerhafte Sperre nach einem fehlgeschlagenen Stop prüfen.
 */

export const HOSTED_RUNTIME_STOP_TIMEOUT_MS = 4_000;

/** Stabile Diagnose ohne interne Fehlertexte oder Konfigurationsinhalte. */
export class HostedRuntimeStopError extends Error {
    readonly code = 'EOS_UI_STOP_UNCONFIRMED';
    constructor() { super('EOS_UI_STOP_UNCONFIRMED'); this.name = 'HostedRuntimeStopError'; }
}

/** Aufgabe: Erfasst tatsächliche asynchrone Unterdienst-Stopps und macht Bereinigungsfehler sichtbar.
 * Wirkung: Synchrone Stopps laufen sofort; ein Promise wird bis zum Abschluss beobachtet, ohne es zu wiederholen. */
export function createHostedCleanup(): { capture(operation: () => unknown): void; finish(): Promise<void> } {
    const pending: Promise<void>[] = [];
    let failed = false;
    return {
        capture(operation) {
            try {
                pending.push(Promise.resolve(operation()).then(() => {}, () => { failed = true; }));
            } catch { failed = true; }
        },
        async finish() {
            await Promise.all(pending);
            if (failed) throw new HostedRuntimeStopError();
        },
    };
}

/**
 * Aufgabe: Räumt sofort und erneut nach allen Startversuchen auf.
 * Wirkung: Ein Timeout beendet nur die Bestätigung; verspätete Starts werden weiterhin abschließend bereinigt.
 * Zusammenhang: Der Aufrufer muss vor dem Aufruf synchron und dauerhaft neue Starts und Gerätebefehle sperren.
 */
export function stopHostedRuntime(
    pendingStarts: readonly Promise<unknown>[],
    cleanup: () => Promise<void>,
    timeoutMs = HOSTED_RUNTIME_STOP_TIMEOUT_MS,
): Promise<void> {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > HOSTED_RUNTIME_STOP_TIMEOUT_MS) {
        return Promise.reject(new HostedRuntimeStopError());
    }
    const attemptCleanup = (): Promise<void> => {
        try { return Promise.resolve(cleanup()); }
        catch { return Promise.reject(new HostedRuntimeStopError()); }
    };
    const firstCleanup = attemptCleanup();
    const drain = Promise.allSettled([firstCleanup, ...pendingStarts]).then(async outcomes => {
        // Auch ein abgebrochener Start kann unmittelbar vor seinem Ende Ressourcen angelegt haben.
        await attemptCleanup();
        if (outcomes[0]?.status !== 'fulfilled') throw new HostedRuntimeStopError();
    });
    return new Promise<void>((resolve, reject) => {
        const deadline = setTimeout(() => reject(new HostedRuntimeStopError()), timeoutMs);
        // Kein unref: Ein noch ausstehender Stop muss sein bestätigtes oder unbestätigtes Ergebnis liefern.
        void drain.then(() => { clearTimeout(deadline); resolve(); }, () => {
            clearTimeout(deadline); reject(new HostedRuntimeStopError());
        });
    });
}
