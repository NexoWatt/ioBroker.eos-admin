/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: www/pwa.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * www/pwa.js
 *
 * Zusammenhang:
 * Der Spiegel hilft uns, die JS-Datei später schrittweise zu typisieren, zu testen und
 * kontrolliert auf TypeScript umzustellen. Produktive Originalquellen liegen unter
 * src-ts/runtime-executables/ bzw. den im generierten JS genannten TS-Pfaden.
 * Dort ändern, Laufzeit erzeugen und danach die Spiegel synchronisieren.
 * Build-/Prüfskripte ohne TS-Original werden weiterhin unter scripts/ gepflegt.
 *
 * Wichtig für die Migration:
 * - Diese Datei enthält vorübergehend @ts-nocheck.
 * - Der nächste Schritt ist pro Modul echte Typisierung statt pauschalem No-Check.
 * - Fachliche Kommentare markieren die Abschnitte, die später einzeln migriert werden.
 *
 * Original-Hash: ad32a03ec7a5ba356589dc9b80c0795cf6250cfbdec52080817d5e674b2c9c54
 */

/**
 * Code-Teil: Runtime-Spiegel der kompletten Datei
 *
 * Zweck:
 * Dieser Abschnitt enthält den ursprünglichen JavaScript-Code als TypeScript-Parallelkopie.
 * Einzelne Funktionen werden später pro Modul weiter typisiert; Dateien ohne eigene
 * Funktionsdeklarationen bleiben trotzdem über diesen Dateikommentar dokumentiert.
 */

/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/www/pwa.ts
 * Quell-Hash: sha256:cae266c2f9d5010485a639a17b0270111c6c1b1cb6d3eed51a75e6a330af898c
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für www/pwa.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Registriert den eigenen App-Worker bereits auf der Anmeldeseite und
 * prüft ihn bei Wiederaufnahme oder erneuter Netzverbindung auf Aktualisierung.
 * Daten und Wirkung: Nutzt nur den geprüften direkten Browserursprung und den
 * bestehenden Root-Scope. Keine Tokens, Auth-Freigabe, Kundendaten oder DOM-Änderung.
 * Bei Änderungen: Direkten Einstieg, Proxy-/Frame-Grenze, Wiederaufnahme, Fehler und erhaltene App-Identität prüfen.
 * Sicherheitsgrenze: Kein Worker im gemeinsamen Admin-Proxy, in Frames oder auf
 * unsicheren Fernzugriffen. Ein laufender Browserauftrag und höchstens ein Timer;
 * Fehler dürfen Anmeldung und UI nicht blockieren. Registrierung/Update haben
 * keinen Abort-Vertrag; offene Aufträge werden deshalb nicht parallel ersetzt.
 * Verknüpfung: docs/security/UI_PWA_BOOTSTRAP_DE.md
 */
(function () {
    'use strict';
    const hostWindow = window;
    try {
        if (hostWindow.NW_PWA_BOOTSTRAPPED || window.top !== window.self
            || window.NW_RUNTIME?.isProxy !== false || window.isSecureContext !== true
            || !('serviceWorker' in navigator))
            return;
        const page = new URL(window.location.href);
        const localHttp = page.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(page.hostname);
        if ((page.protocol !== 'https:' && !localHttp) || page.origin !== window.location.origin
            || page.username || page.password)
            return;
        // Absolute URLs verhindern eine Scope-Änderung durch /static/login.html,
        // einen query-Parameter oder ein fremdes HTML-base-Element.
        const workerUrl = new URL('/sw.js', page.origin).href;
        const scope = new URL('/', page.origin).href;
        const minimumIntervalMs = 30000;
        let registration = null;
        let running = false;
        let lastAttempt = Number.NEGATIVE_INFINITY;
        let pending = false;
        let timer = null;
        Object.defineProperty(window, 'NW_PWA_BOOTSTRAPPED', { value: true, writable: false, configurable: false });
/**
 * Code-Teil: clearScheduled
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
        const clearScheduled = () => {
            if (timer !== null) {
                window.clearTimeout(timer);
                timer = null;
            }
        };
        /** Wiederholte Ereignisse auf einen Auftrag pro 30 s und einen Folgetimer begrenzen. */
        const refresh = () => {
            if (document.hidden || navigator.onLine === false)
                return;
            if (running) {
                pending = true;
                return;
            }
            const remaining = minimumIntervalMs - (performance.now() - lastAttempt);
            if (remaining > 0) {
                if (timer === null)
                    timer = window.setTimeout(() => { timer = null; refresh(); }, Math.ceil(remaining));
                return;
            }
            clearScheduled();
            running = true;
            pending = false;
            lastAttempt = performance.now();
/**
 * Code-Teil: operation
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
            const operation = async () => {
                if (registration)
                    await registration.update();
                else
                    registration = await navigator.serviceWorker.register(workerUrl, { scope, updateViaCache: 'none' });
            };
            // Absichtlich kein Reload, kein Auth-Bypass und keine Fehleranzeige über
            // der Anmeldung: SW-Verfügbarkeit darf deren Bedienbarkeit nicht bestimmen.
            void operation().catch(() => { }).finally(() => {
                running = false;
                if (pending) {
                    pending = false;
                    refresh();
                }
            });
        };
        window.addEventListener('pageshow', refresh);
        window.addEventListener('online', refresh);
        window.addEventListener('pagehide', clearScheduled);
        document.addEventListener('visibilitychange', () => { if (document.hidden)
            clearScheduled();
        else
            refresh(); });
        refresh();
    }
    catch { /* Fehlender Browser-Support blockiert weder Login noch App. */ }
})();
