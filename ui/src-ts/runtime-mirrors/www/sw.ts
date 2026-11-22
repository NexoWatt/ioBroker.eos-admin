/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: www/sw.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * www/sw.js
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
 * Original-Hash: 8995c689944b13867b9b0e3619235547a382d582ca0cbc0d725a4c8db3377cd2
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
 * Quelle: src-ts/runtime-executables/www/sw.ts
 * Quell-Hash: sha256:50ba9fef41b8e1b7f564ef1355aaefd578cb7eaccfd288be12a4ff4b02d7a15c
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für www/sw.js.
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
 * Aufgabe: Verwaltet den Service-Worker-Cache für die Browser-Anwendung und den Wechsel zwischen Cache-Versionen.
 * Daten und Wirkung: Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.
 * Bei Änderungen: DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.
 * Verknüpfungen: docs/quellcode/src-ts/runtime-executables/www/sw.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
/**
 * Executable TypeScript source: www/sw.js
 *
 * Zweck:
 * Diese Datei ist ab 0.7.131 die kanonische TypeScript-Quelle der produktiven
 * Adapter-/Frontend-Runtime-Datei `www/sw.js`.
 *
 * Build-Regel:
 * `npm run sync:ts-runtime-executables` erzeugt daraus die auslieferbare
 * JavaScript-Datei. Änderungen an der Runtime sollen hier vorgenommen werden;
 * die JS-Datei ist nur noch Build-Artefakt für Node.js/ioBroker bzw. den Browser.
 *
 * Sicherheit:
 * Der Inhalt basiert auf der bisher produktiven JavaScript-Runtime und bleibt
 * vorübergehend mit `@ts-nocheck` ausführbar. Fachliche TS-Helfer wie EVCS,
 * Energiefluss, Core-Limits und Heizstab bleiben die bereits typisierten Quellen.
 */

/**
 * NexoWatt Detail-Kommentar (DE)
 * Zweck dieser Ergänzung:
 * - Jede relevante Funktion, Methode, Route und UI-Ereignisbindung erhält einen eigenen Erklärungskommentar.
 * - Die Kommentare beschreiben Aufgabe, Daten-/API-Zusammenhang und TypeScript-Migrationshinweise.
 * - Es wurde keine Programmlogik geändert; diese Datei wurde nur für Wartbarkeit und spätere Typisierung dokumentiert.
 */

/**
 * Datei: www/sw.js
 * Rolle im Projekt: Service Worker.
 * Zweck: Cache-Schicht für PWA/Offline-Shell; muss bei jeder Version gebumpt werden.
 * Wartung: Die folgenden Abschnitts-Kommentare erklären die einzelnen Code-Teile.
 * TypeScript-Plan: Beim nächsten fachlichen Umbau werden diese Blöcke schrittweise in .ts/.tsx überführt.
 */
/**
 * NexoWatt Code-Kommentar (DE)
 * Zweck: Service Worker/PWA-Cache: legt fest, welche UI-Dateien offline bzw. schneller geladen werden.
 * Zusammenhänge:
 * - Cache-Version muss bei jedem Frontend-Release erhöht werden.
 * - Greift auf Dateien aus www/ zu.
 * Wartungshinweise:
 * - Fehlerhafte Cache-Listen können alte UI-Dateien ausliefern; nach Änderungen immer Cache-Version erhöhen.
 */

/**
 * 1.0.38: Der Service Worker hält ausschließlich öffentliche Bild-/Schriftdateien.
 * Geschützte Seiten, Konfiguration, Livewerte und APIs werden nie offline geladen.
 * Alte Shell-Caches werden bei Aktivierung vollständig entfernt.
 */
const CACHE_NAME = 'nexowatt-cache-v526';
const PUBLIC_ASSET = /\.(?:png|jpg|jpeg|svg|ico|woff2?)$/i;
self.addEventListener('install', event => { event.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('nexowatt-cache-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'NW_AUTH_LOGOUT') {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('nexowatt-cache-')).map(key => caches.delete(key)))));
  }
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (/(?:^|\/)events(?:\/|$)/.test(url.pathname)) return;
  const publicAsset = /\/(?:static|assets)\//.test(url.pathname) && PUBLIC_ASSET.test(url.pathname)
    && !/(?:^|\/)(?:api|config|state|sse)(?:\/|$)/.test(url.pathname);
  if (publicAsset) {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(response => {
      if (response.ok && !response.redirected && !/(?:no-store|private)/i.test(response.headers.get('Cache-Control') || '')) {
        const copy = response.clone();
        void caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
      }
      return response;
    })));
    return;
  }
  event.respondWith(fetch(req, { cache: 'no-store' }).catch(() => {
    if (req.mode === 'navigate') return new Response('<!doctype html><html lang="de"><meta name="viewport" content="width=device-width"><meta name="theme-color" content="#020814"><title>NexoWatt EOS – Verbindung erforderlich</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#020814;color:#e2f2ff;font:16px/1.6 system-ui,sans-serif}main{max-width:32rem;padding:2rem}img{display:block;width:min(100%,22rem);height:auto}h1{font-size:1.6rem;line-height:1.2}p{color:#9bb5c8}button{padding:.85rem 1.25rem;border:0;border-radius:.75rem;background:#00d685;color:#001c18;font:inherit;font-weight:650;cursor:pointer}</style><body><main><img src="/static/nexowatt-eos-logo.png" alt="NexoWatt EOS"><h1>Verbindung erforderlich</h1><p>Deine Web-App ist installiert. Sobald dein NexoWatt-System wieder erreichbar ist, kannst du dich anmelden und deine Bedienoberfläche öffnen.</p><button onclick="location.reload()">Erneut verbinden</button></main></body></html>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    return new Response('', { status: 503, statusText: 'Offline', headers: { 'Cache-Control': 'no-store' } });
  }));
});
