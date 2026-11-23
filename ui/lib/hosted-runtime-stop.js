/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/hosted-runtime-stop.ts
 * Quell-Hash: sha256:2cf60c02b437d75b38cbde776a02891af4aa37410c90b3c9e7961609632ca67a
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/hosted-runtime-stop.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
"use strict";
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Bestätigt den Stopp der eingebetteten Oberfläche erst nach dem Ende bereits begonnener Initialisierungen.
 * Daten und Wirkung: Wartet begrenzt auf Startversuche und abschließende Bereinigung; eine unklare Beendigung erlaubt keine Rückübergabe an Altregler.
 * Zusammenhang: createHostedRuntime sperrt neue Starts und Schreibrechte synchron; die Migration verwendet ausschließlich den bestätigten Stop-Erfolg.
 * Bei Änderungen: Späte Startabschlüsse, fehlerhafte Bereinigung, Zeitlimit und die dauerhafte Sperre nach einem fehlgeschlagenen Stop prüfen.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HostedRuntimeStopError = exports.HOSTED_RUNTIME_STOP_TIMEOUT_MS = void 0;
exports.createHostedCleanup = createHostedCleanup;
exports.stopHostedRuntime = stopHostedRuntime;
exports.HOSTED_RUNTIME_STOP_TIMEOUT_MS = 4000;
/** Stabile Diagnose ohne interne Fehlertexte oder Konfigurationsinhalte. */
class HostedRuntimeStopError extends Error {
    constructor() {
        super('EOS_UI_STOP_UNCONFIRMED');
        this.code = 'EOS_UI_STOP_UNCONFIRMED';
        this.name = 'HostedRuntimeStopError';
    }
}
exports.HostedRuntimeStopError = HostedRuntimeStopError;
/** Aufgabe: Erfasst tatsächliche asynchrone Unterdienst-Stopps und macht Bereinigungsfehler sichtbar.
 * Wirkung: Synchrone Stopps laufen sofort; ein Promise wird bis zum Abschluss beobachtet, ohne es zu wiederholen. */
function createHostedCleanup() {
    const pending = [];
    let failed = false;
    return {
        capture(operation) {
            try {
                pending.push(Promise.resolve(operation()).then(() => { }, () => { failed = true; }));
            }
            catch {
                failed = true;
            }
        },
        async finish() {
            await Promise.all(pending);
            if (failed)
                throw new HostedRuntimeStopError();
        },
    };
}
/**
 * Aufgabe: Räumt sofort und erneut nach allen Startversuchen auf.
 * Wirkung: Ein Timeout beendet nur die Bestätigung; verspätete Starts werden weiterhin abschließend bereinigt.
 * Zusammenhang: Der Aufrufer muss vor dem Aufruf synchron und dauerhaft neue Starts und Gerätebefehle sperren.
 */
function stopHostedRuntime(pendingStarts, cleanup, timeoutMs = exports.HOSTED_RUNTIME_STOP_TIMEOUT_MS) {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > exports.HOSTED_RUNTIME_STOP_TIMEOUT_MS) {
        return Promise.reject(new HostedRuntimeStopError());
    }
    const attemptCleanup = () => {
        try {
            return Promise.resolve(cleanup());
        }
        catch {
            return Promise.reject(new HostedRuntimeStopError());
        }
    };
    const firstCleanup = attemptCleanup();
    const drain = Promise.allSettled([firstCleanup, ...pendingStarts]).then(async (outcomes) => {
        // Auch ein abgebrochener Start kann unmittelbar vor seinem Ende Ressourcen angelegt haben.
        await attemptCleanup();
        if (outcomes[0]?.status !== 'fulfilled')
            throw new HostedRuntimeStopError();
    });
    return new Promise((resolve, reject) => {
        const deadline = setTimeout(() => reject(new HostedRuntimeStopError()), timeoutMs);
        // Kein unref: Ein noch ausstehender Stop muss sein bestätigtes oder unbestätigtes Ergebnis liefern.
        void drain.then(() => { clearTimeout(deadline); resolve(); }, () => {
            clearTimeout(deadline);
            reject(new HostedRuntimeStopError());
        });
    });
}
