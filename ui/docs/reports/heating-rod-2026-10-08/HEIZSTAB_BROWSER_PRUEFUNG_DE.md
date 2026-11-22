# Heizstab-Schnellsteuerung – Browsernachweis

Prüfzeitpunkt: 2026-10-08T19:37:14.080Z. Ergebnis: **PASS**, fünf Szenarien, keine JavaScript-Browserfehler.

Ausgeführt mit Chromium 153.0.8010.0 und Node.js v24.19.0 bei 1280 × 920 Pixeln. Verwendet wurden das originale Quick-Control-HTML aus `www/index.html`, unverändertes `www/styles.css`, die vollständige Quick-Control-IIFE und die zugehörigen Anzeigehelfer aus der kanonischen `src-ts/runtime-executables/www/app.ts`. Die Prüfung fand auf einer ausschließlich lokal erreichbaren HTTP-Fixture statt. API-Antworten und Schreibziele waren simuliert; externe Netzwerkziele wurden blockiert. Keine Anlage oder Relais wurden angesprochen.

| Szenario | Feststellung | Bildschirmnachweis |
|---|---|---|
| Nacht, Auto, 0 von 6 Stufen | Nachtpause und Freigabezeit 06:00 stehen vor dem alten Forecast-Grund; Auto bleibt gewählt. | `browser-night.png` |
| Nacht, Abschaltung offen, 1500 W | Restleistung und 1 von 6 Stufen bleiben sichtbar; „Abschaltung noch nicht bestätigt“ wird vollständig angezeigt. | `browser-night-stop-open.png` |
| Stufe 2 per Klick | Richtiger lokaler API-Schreibvertrag; keine falsche Nachtanzeige trotz alter Nacht-Fixture. | `browser-manual.png` |
| Boost per Klick | Richtiger lokaler API-Schreibvertrag; 6 von 6 Stufen, 9000 W und Rückkehr zu Stufe 2 dargestellt. Für den Screenshot wurde der Dialog frisch geladen, um die stabile Fixtureleistung ohne Übergangswert des vorhandenen Anzeigefilters zu dokumentieren. | `browser-boost.png` |
| Morgen, noch geringe PV-Leistung | Nachttext entfällt; „PV-Leistung/Prognose noch zu gering“ erscheint bei gewähltem Auto. | `browser-morning-wait.png` |

Die Nacht-, Abschalt- und Boost-Screenshots wurden zusätzlich visuell geprüft: Die neuen Texte bleiben lesbar und innerhalb des vorhandenen Dialogs; Restleistung wird nicht durch einen fälschlichen AUS-Wert ersetzt. Die geprüften Dialoge lagen vollständig innerhalb des Viewports. Keine optische Neugestaltung wurde vorgenommen.

Rohdaten einschließlich SHA-256 der verwendeten Quellen, gemessener DOM-Texte und lokaler API-Schreibaufrufe: `browser-quick-control.json`. Reproduzierbare Fixture: `browser-quick-control-fixture.cjs` (aus dem Repository-Hauptverzeichnis starten; benötigt Playwright, TypeScript und einen über `CHROMIUM_BIN` angegebenen Chromium; Playwright wird über `CODEX_PRIMARY_RUNTIME_NODE_MODULES` gefunden).

Diese Prüfung belegt den isolierten Browserdialog und seine Anzeige-/Bedienverträge. Sie ersetzt weder den vollständigen Adapterlauf noch den Hardware- oder Abnahmetest. Generierte Runtime-Prüfungen werden im getrennten Gesamtnachweis aufgeführt.
