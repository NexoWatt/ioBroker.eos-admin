/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
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
(function (): void {
  'use strict';
  const hostWindow = window as Window & { readonly NW_PWA_BOOTSTRAPPED?: true };
  try {
    if (hostWindow.NW_PWA_BOOTSTRAPPED || window.top !== window.self
      || window.NW_RUNTIME?.isProxy !== false || window.isSecureContext !== true
      || !('serviceWorker' in navigator)) return;
    const page = new URL(window.location.href);
    const localHttp = page.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(page.hostname);
    if ((page.protocol !== 'https:' && !localHttp) || page.origin !== window.location.origin
      || page.username || page.password) return;

    // Absolute URLs verhindern eine Scope-Änderung durch /static/login.html,
    // einen query-Parameter oder ein fremdes HTML-base-Element.
    const workerUrl = new URL('/sw.js', page.origin).href;
    const scope = new URL('/', page.origin).href;
    const minimumIntervalMs = 30_000;
    let registration: ServiceWorkerRegistration | null = null;
    let running = false;
    let lastAttempt = Number.NEGATIVE_INFINITY;
    let pending = false;
    let timer: number | null = null;
    Object.defineProperty(window, 'NW_PWA_BOOTSTRAPPED', { value: true, writable: false, configurable: false });

    const clearScheduled = (): void => {
      if (timer !== null) { window.clearTimeout(timer); timer = null; }
    };

    /** Wiederholte Ereignisse auf einen Auftrag pro 30 s und einen Folgetimer begrenzen. */
    const refresh = (): void => {
      if (document.hidden || navigator.onLine === false) return;
      if (running) { pending = true; return; }
      const remaining = minimumIntervalMs - (performance.now() - lastAttempt);
      if (remaining > 0) {
        if (timer === null) timer = window.setTimeout(() => { timer = null; refresh(); }, Math.ceil(remaining));
        return;
      }
      clearScheduled(); running = true; pending = false; lastAttempt = performance.now();
      const operation = async (): Promise<void> => {
        if (registration) await registration.update();
        else registration = await navigator.serviceWorker.register(workerUrl, { scope, updateViaCache: 'none' });
      };
      // Absichtlich kein Reload, kein Auth-Bypass und keine Fehleranzeige über
      // der Anmeldung: SW-Verfügbarkeit darf deren Bedienbarkeit nicht bestimmen.
      void operation().catch(() => { /* Nächste Wiederaufnahme darf erneut prüfen. */ }).finally(() => {
        running = false;
        if (pending) { pending = false; refresh(); }
      });
    };

    window.addEventListener('pageshow', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('pagehide', clearScheduled);
    document.addEventListener('visibilitychange', () => { if (document.hidden) clearScheduled(); else refresh(); });
    refresh();
  } catch { /* Fehlender Browser-Support blockiert weder Login noch App. */ }
})();
