# Visualisierungsprüfung 9.0.20

Stand: 24.11.2026. Geprüft wurden der versiegelte Ausgangsstand 9.0.19 und die Änderungen des 9.0.20-Arbeitsstands. Die Prüfung verwendet tatsächlich extrahierte Frontendfunktionen und simulierte DOM-Elemente/Zeitstempel. Sie ist kein Hardwaretest und keine fotografische Browserabnahme.

## Bestätigte Fehler und Korrekturen

| Kennung | Reproduktion im Ausgangsstand | Korrektur 9.0.20 |
|---|---|---|
| VIS-01 | Bei PV 5000 W, NVP −5000 W und gemessenem Gebäudeverbrauch 0 W zeigte der Energiefluss 100 W. Nach einmal 1200 W blieb 1200 W selbst nach 400 s echter Nullmessungen sichtbar; jeder Render erneuerte den Haltezeitstempel. | Erfundenen Mindestverbrauch und unbegrenztes Halten entfernt. Echte 0 bleibt 0. |
| VIS-02 | Null-SoC wurde als 0 % dargestellt; ein `null` in `derived.core.pv.totalW` unterdrückte den gültigen Roh-PV-Wert und erschien als 0 W. | Strikte numerische Prüfung; null, leer, boolesch, ungültig und fehlend bleiben unbekannt. Gültiger Roh-PV-Fallback bleibt nutzbar. |
| VIS-03 | Ohne Messwerte/Engine meldete die Seitenleiste „Aktiv“, „Stabil“ und „Alle Systeme normal“ sowie 0 W. Alte Werte blieben als aktuell sichtbar. | Status folgt Scheduler-Heartbeat und NVP-Gültigkeit. Fehlend, abgelaufen, Zukunftszeit und Verbindungsabbruch ergeben `--` bzw. einen unbekannten/unterbrochenen Status. Ein sichtbarer 5-s-Anzeigetakt lässt Messungen auch bei stillstehender SSE-Verbindung altern. |
| VIS-04 | Die Farmanzeige konnte unabhängige alte Summen/SoC-States weiterverwenden, obwohl die atomare Übersicht bereits unvollständige Daten meldete. | Bei vorhandenem atomarem Farm-Snapshot gilt dessen Vollständigkeit: Brutto-Lade-/Entladesummen und arithmetischer SoC nur bei vollständiger gültiger Abdeckung. Gegenläufige Speicherleistungen werden im zentralen Fluss weiterhin als Nettofluss gezeichnet, in der Farmübersicht getrennt summiert. |
| VIS-05 | Eine fehlende Seite eines konfigurierten Messwertpaars konnte als 0 erscheinen; allein ein vorhandener NVP-Mapping-Eintrag erlaubte eine Batterie-Bilanz ohne NVP-Messung. | Unvollständige Paare bleiben unbekannt. Ein aktueller signed-Batteriewert darf ein unvollständiges Split-Paar ersetzen. Batterie-Bilanz verlangt aktuelle vollständige Netzwerte und berücksichtigt das NVP-Gültigkeitssignal. |
| VIS-06 | Zusätzliche Erzeuger/Verbraucher zeigten fehlende Messungen als 0. Beim Heizstab konnten Soll-/geschaltete Nennleistungen als gemessene Energieflussleistung erscheinen. | Extra-Kreise verwenden aktuelle Messwerte. Fehlende Teilwerte verhindern vollständige Summen und daraus abgeleitete Gebäude-Restleistung. Heizstab-Sollwerte werden nicht mehr als bestätigte Leistung angezeigt. |

Baseline-Ausgaben: `raw/visuals-baseline-919.txt`. Die ursprüngliche 9.0.19-Quelle wurde nicht geändert.

## Geänderte Dateien und Wirkung

- `ui/src-ts/runtime-executables/www/live-display.ts`: neuer strikt typgeprüfter, rein lesender Snapshot-Validator für Zahlen, Zeitstempel, Farmabdeckung und Betriebsstatus. Keine API-Aufrufe, kein Schreiben von ioBroker-States oder Konfiguration.
- `ui/src-ts/runtime-executables/www/app.ts`: zentrale Anzeigeprojektion für Energiefluss und Seitenleiste; die oben aufgeführten Fehlerkorrekturen. Die Datei gehört zum bestehenden Legacy-Transpile-Bereich; es wurde keine neue `@ts-nocheck`-Ausnahme eingeführt.
- `ui/www/index.html`, `ui/www/settings.html`: laden den neuen Helper vor `app.js`.
- `ui/tsconfig.live-display-ui.json`, `ui/eslint.live-display-ui.config.mjs`: getrennte strikte Prüfkonfiguration für den neuen Helper.
- `test/eos-live-display-regression.test.cjs`: elf verhaltensbezogene Regressionstests mit echten extrahierten App-Funktionen und echter Helper-Implementierung.

Die Änderungen betreffen die Anzeige. Kundenzuordnungen, gespeicherte Geräte, Leistungsgrenzen, Freigaben, Regeln, Aktorbefehle und ioBroker-Admin-Rechte werden nicht verändert. Der neue 5-s-Alterungstakt läuft nur auf dem sichtbaren Dashboard, ruft keine Geräte/API ab und wird bei `pagehide` beendet; bei `pageshow` wird genau ein Takt wiederhergestellt.

## UI-/Layout-Abdeckung

| Bereich | Prüfung und Ergebnis |
|---|---|
| LIVE / Seitenleiste | DOM-Projektionen für echte Null, Null/Bool/Leerwert, fehlende/alte/zukünftige Zeitstempel, Verbindungsausfall, ungültigen NVP, Split-Paare und Summen getestet. |
| Speicherfarm | Bestehende DOM-Tests prüfen vollständige Bruttosummen, Kapazität, arithmetischen SoC, Teilabdeckung, Alterung und Verbindungsabbruch. Neuer Test verknüpft atomare Farmqualität mit dem zentralen Energiefluss. |
| Tibber / Preisansicht | Bestehende tatsächliche Renderertests prüfen 96 Viertelstunden und 92/100 Intervalle bei Sommerzeitwechsel, echte Null/negative Preise, Ablauf/Fehlen, separate Tarifquelle ohne eingeschaltete Optimierung und Erhalt manueller Zuordnung. Stundenpreise werden nicht zu erfundenen Viertelstunden vervielfacht. |
| Geräte speichern / Sitzung | Vorhandene Tests prüfen erneuertes CSRF, Sitzungsablauf mit Entwurfserhalt, kein Replay verbotener Mutationen, Importvoraussetzungen, Entwurfsschutz beim Neuladen und Freigabe nach frischer Konfiguration. |
| Geräte / EEBus-Design | HTML/CSS geprüft. Beide laden den gemeinsamen EOS-Modulstil. Geräte-Navigation hat den spezifischen dunklen Override `.m .eos-module-nav { background: #061825; }`; die zuvor gezeigte hellblaue Navigation ist im aktuellen CSS nicht bestätigt. Keine spekulative Neugestaltung. |
| SmartHome-Projektmenü | Aktueller CSS-Stand hebt `overflow` am Header auf, legt Header/Schritte auf getrennte Ebenen, begrenzt Menüs auf Viewport und Höhe, zeigt bei schmalen Geräten statische Menüs und lässt nur offene Menüs sichtbar. Dialogkörper scrollt innerhalb des begrenzten Dialogs; Fußleiste und darüberliegender DP-Dialog sind separat angeordnet. Der frühere Screenshot-Clippingfehler ist im aktuellen Quellcode nicht erneut bestätigt. |

## Ausgeführte Prüfungen

Folgende fünf Testdateien wurden gemeinsam unter Node 22 und Node 24 ausgeführt:

```text
test/eos-live-display-regression.test.cjs
test/eos-power-measurements.test.cjs
test/eos-tariff-display.test.cjs
test/eos-storagefarm-overview-ui.test.cjs
test/eos-module-editor-session.test.cjs
```

Ergebnis: **39/39 erfolgreich unter Node 22 und 39/39 unter Node 24**. Rohprotokolle: `raw/visuals-node22.txt`, `raw/visuals-node24.txt`.

```text
node node_modules/typescript/bin/tsc -p ui/tsconfig.live-display-ui.json
node node_modules/eslint/bin/eslint.js --config ui/eslint.live-display-ui.config.mjs ui/src-ts/runtime-executables/www/live-display.ts
```

Beide erfolgreich (Exitcode 0); leere Fehlerprotokolle `raw/visuals-typecheck.txt`, `raw/visuals-lint.txt`. Die Zahlenprüfung verwendet einen auf 64 Zeichen begrenzten linearen Zeichenscan ohne regulären Ausdruck. Zusätzlich wurde der Helper mit dem tatsächlichen UI-ESLint 10.13.0 und `ui/eslint.config.cjs` geprüft: keine Befunde (Exitcode 0), Protokoll `raw/visuals-security.txt`. Dezimalpunkt/-komma und Vorzeichen bleiben erlaubt; Exponent, Hex, alleinstehendes Vorzeichen, doppelte Trennzeichen und überlange Eingaben werden im Regressionstest verworfen.

## Grenzen der Abnahme

Chromium wurde erneut zum lokalen Rendern gestartet, beendet sich hier jedoch vor dem Seitenaufbau mit `socket() failed: Operation not permitted` (Exitcode 134). Beleg: `raw/visuals-browser-limit.txt`. Deshalb wurden **keine neuen Browser-Screenshots, mobilen Pixelprüfungen oder reale Touch-/Fokustests als bestanden gewertet**. DOM-Tests können CSS-Überlappungen nicht vollständig ausschließen.

Die Bildschirmprüfung auf realem Desktop und Smartphone bleibt für Projektmenü, Geräte-/EEBus-Dialoge und Energiefluss erforderlich. Ebenso bleibt eine kontrollierte Inbetriebnahme mit tatsächlichen aktuellen SMA-/Modbus-/Wallbox-Messungen erforderlich; die Tests bestätigen keine physische Geräteverbindung. Gesamt-Build, Release-Prüfung und übergreifende Tests werden im zentralen Prüfbericht dokumentiert.
