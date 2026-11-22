# Prüfbericht: SmartHome-Import und Konfigurationsentwurf

**Stand:** 19.11.2026, Arbeitsstand 1.0.37 auf Basis 1.0.36.
**Umgebung:** Node.js 24.22.3; installierter `@iobroker/type-detector` 5.0.10.
**Abnahmeart:** isolierte Softwareprüfung mit synthetischen Objekt-/Statefixtures.

## Änderung und Prüfgegenstand

Datentypkorrektur für boolesche und textuelle Sensoren; additive Quellenmetadaten,
Aliasabgleich und Importherkunft; ausdrückliche feldweise Aktualisierung im
Installerentwurf; optionale Statuspunkte und dynamische Kamera-State-URL.
Maßgeblich sind die kanonischen TS-Quellen. Kein Produkt-JS wurde von dieser
Prüfsuite überschrieben. Der zentrale Build erzeugt die ausführbaren Spiegel.

## Tatsächlich ausgeführte Prüfungen

| Prüfung | Erwartung | Beobachtetes Ergebnis |
| --- | --- | --- |
| `node scripts/verify-smarthome-import-runtime.js --report docs/reports/smarthome-import-2026-11-19/runtime-evidence.json` | Die fachlichen Regressionen bestehen. | Exit 0, **13 Prüfgruppen bestanden**. |
| `node node_modules/typescript/bin/tsc -p tsconfig.smarthome-import.json` | Neuer Helper ohne implizites/ausdrückliches `any` und ohne Typunterdrückung unter strikter Projektbasis. | Exit 0, keine Typfehler. |
| `node --check scripts/verify-smarthome-import-runtime.js` | Prüfsuite syntaktisch gültig. | Exit 0. |
| Repo-ESLint auf `src-ts/runtime-executables/lib/smarthome-import.ts`, alle konfigurierten TypeScript-/Security-Regeln | Befunde sichtbar, keine Regelabschaltung. | Exit 1: **9 Hinweise `security/detect-object-injection`**, sonst keine Regelbefunde. Rohdaten in `helper-eslint.json`; fachliche Einordnung unten. |

Die Laufzeitsuite führt den echten Detector und die tatsächlichen aktuellen
Normalisierungs-, API-Handler-, Runtime- und Entwurfsfunktionen aus. Erkennung,
Sensorvertrag und Zustandsdarstellung sind dabei als isolierte Kette geprüft.
Die Adapterzugriffe sind kontrollierte Fixtures; Schreibaufrufe wären ein
Testfehler. Ein vollständiger HTTP-Server oder ioBroker wurde nicht gestartet.

## Abgedeckte Regressionen

- Boolean/Text/Zahl vom echten Detector bis zur Runtime mit korrektem Wert und
  Online-Status; Provenienzversion und Fingerabdruck.
- Prozentbatterie einschließlich 0 sowie boolesches LowBattery; unbekannte,
  ungültige und veraltete Zusatzwerte erzeugen keine Nullwerte und überdecken
  keine ungültigen Hauptmesswerte. Gültige UNREACH-/ERROR-Signale wirken.
- Metadaten, sichere lokale Symbole/Farben, mehrdeutige gleichnamige Räume und
  ausdrückliches Erzeugen neuer Zuordnungen im Entwurf.
- Aliaspräferenz, getrennte Lese-/Schreibziele, Zyklus-/Fehlzielabwehr,
  doppelte Übernahme und Abgrenzung gemeinsam verwendeter Statuspunkte.
- Bestehende manuelle Geräte bleiben unverändert; der Konfigurationswechsel
  invalidiert den Ergebnis-Cache.
- Quellenänderungen überschreiben keine manuellen Werte ohne Feldwahl;
  Auswahl wird vor atomarem Entwurfsersatz vollständig geprüft. Konflikte und
  verbotene Prototyppfade werden abgewiesen. ID, Raum, Favorit, Szenen-/Timerbezug
  und zusätzliche Altattribute bleiben erhalten.
- Herkunft und Zusatzstatus verleihen keine Schreib-IDs. Ungültige Herkunft
  wird verworfen; historische Blind-Positionsverträge bleiben erhalten.
- Kameraimport persistiert keine State-URL/Token. Aktuelle zulässige URLs werden
  zur Laufzeit verwendet; ungültige, fehlende oder veraltete Quellen bleiben
  leer. Statische Bestandskameras bleiben unverändert.

## ESLint-Einordnung des neuen Helpers

Die Rohbefunde sind nicht als bestandener Lint-Gate umbenannt. Die
quellenhashgebundene zentrale Reviewaufnahme erfolgt zusammen mit den übrigen
1.0.37-Änderungen.

- Zeilen 68/150/194: ausschließlich lesende Zugriffe auf die ioBroker-Objektmap;
  IDs stammen aus erkannten States bzw. durch `enum.rooms/functions` begrenzten
  Objektkeys. Die Aliasprüfung verlangt ein vorhandenes Stateobjekt.
- Zeile 158: Richtung ist der feste Uniontyp `read | write`, die Alternative
  ebenfalls genau einer dieser beiden Schlüssel; kein freier Schreibpfad.
- Zeilen 110/129: Schreiben in frisch angelegte Null-Prototyp-Maps nach
  `isSmartHomeImportField` mit fester Feldfamilie, begrenzter Pfadlänge,
  Prototyp-/Konstruktorsperre, Skalartypprüfung und höchstens 180 Feldern.
- Zeile 270: reiner Wertvergleich entlang bereits geprüfter Importpfade;
  es findet keine Mutation des gelesenen Geräts statt.
- Zeile 310, zwei Stellen: lesender Vergleich normalisierter `sourceValues`.
  Der jeweilige Pfad wird direkt zuvor erneut gegen die Feldliste geprüft.

Keine Netzwerk-/Codeausführung, keine Benutzer-/Rollenänderung und keine
Gerätesollwerte werden durch diese Zugriffe ausgelöst. Die Einzelhinweise sind
deshalb fachliche Reviewkandidaten; Scannerregeln bleiben vollständig aktiv.

## Nachweise, Grenzen und verbleibende Abnahme

`runtime-evidence.json` enthält tatsächliche Prüfgruppen und SHA-256-Hashes der
geprüften Quellen und der Suite. `helper-eslint.json` enthält die unveränderten
Scannerbefunde. Funktionsbeschreibung und Betriebsgrenzen stehen in
`docs/SMARTHOME_IMPORT_DE.md`.

Nicht Bestandteil dieser Prüfung: HTTP/Auth-Integration, Browser-/Touchabnahme,
produktiver ioBroker, echte Aliasumrechnungen im ioBroker-Controller, Kameraabruf
im Browser, reale Aktoren, EMS-Regelbetrieb oder Hardwareinbetriebnahme. Diese
Grenzen werden nicht durch die Fixturetests ersetzt. Die Gesamtabnahme muss
den zentralen Build, die bestehenden Regressionen und die Artefaktprüfung
einschließen. Bestehende Anlagenkompatibilität ist damit gezielt abgesichert,
aber nicht pauschal für jede bisher unbekannte Anlagenkonfiguration garantiert.
