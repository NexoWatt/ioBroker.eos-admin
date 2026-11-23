# Sicherheitsprüfung des SmartHome-Deltas 9.0.8

Stand: 23.11.2026. Geprüft wurde das tatsächliche Quell-Differenzbild gegen `NexoWatt_EOS_9.0.7_FULL_REPOSITORY.zip`, nicht ein neu erzeugter Scanner-Baselinebestand. Diese Prüfung ist keine vollständige Sicherheits- oder CRA-Freigabe.

## Umfang und Altbefunde

Die Änderung in `ui/src-ts/runtime-executables/main.ts` umfasst die Anbindung der Aktivierungs- und Bestandsdatenprüfer, die gemeinsame SmartHome-Freigabeentscheidung, den Erhalt des ursprünglichen Namensraums, das Unterbinden eines fremden globalen Backup-Fallbacks, die Start-Hydration und das Beenden einer Laufzeit mit beschädigtem Bestand. Bekannte Bestandsdatenfehler führen nun auch nach einer abgeschlossenen Migration zur vorhandenen Unload-/Schreibsperre. Zeitprogramm- und Logikuhrzugriffe bleiben während der Ersthydration und beim Herunterfahren gesperrt.

Die elf historischen Einzelreview-Einträge dieser Datei wurden einzeln zugeordnet:

| Befundgruppe | Aktueller Abgleich |
| --- | --- |
| Mesh-Diagnosezähler, ein Fingerprint mit zwei Vorkommen | Weiterhin Akkumulator aus `Object.create(null)`; ausschließlich Zähler, keine Rechtevergabe. Fundstelle und Schlüsselherkunft unverändert. |
| Partner-App, Availability, State-Cache, Telemetrie, vier Fingerprints | Die betroffenen Aufrufe und lokalen Maps liegen außerhalb der geänderten Bereiche. Appfreigabe/Lizenz, feste Projektionen, Ressourcen- und Frischeprüfung bleiben erhalten. |
| Drei frühere Cookie-/Logout-Fingerprints | Im aktuellen Scannerlauf nicht mehr vorhanden. Keine neue Ausnahme aktiviert; historische Dokumentation bleibt als abwesender Bestand nachvollziehbar. |
| History-Abfrage und binäre Suche, zwei Fingerprints | Nur feste Query-Namen beziehungsweise begrenzte ganzzahlige Arrayindizes. Keine Änderung der Parameterquellen oder Verwendung durch das SmartHome-Delta. |
| Dezimal-RegEx, ein Fingerprint | Verankerte Dezimalgrammatik und nachfolgende Endlichkeitsprüfung unverändert. Keine zusätzliche Datenquelle im geänderten Bereich. |

In `www/smarthome-config.ts` wurde ausschließlich der veraltete Hinweis entfernt, SmartHome im früheren UI-Adapter zu aktivieren. Die 13 bestehenden Einzelreview-Einträge betreffen weiterhin unveränderte Raum-/Funktionslisten, ausdrücklich gewählte Importpfade und Statuszuordnungen. Die zugrunde liegenden Quellblöcke wurden nachgelesen: feste Schlüsselgruppen, Prototypsperre, Typ-/Konfliktprüfung und Änderung nur des lokalen Entwurfs bleiben erhalten. Die neue Aktivierungskarte verarbeitet den eigenen Boolean separat und übernimmt keinen Gebäudeentwurf.

Für diese vorhandenen Einträge bleiben Regel, Fingerprint, Anzahl und ursprüngliche Begründung erhalten. Lediglich der geprüfte Gesamtdatei-Codehash und ein ergänzender Reviewvermerk werden erneuert. Die historische Baseline und die Scannerregeln werden nicht geändert.

## Neue einzeln bewertete Scannerhinweise

| Datei / Fingerprint | Vorkommen | Einzelbewertung |
| --- | ---: | --- |
| `lib/preserved-ui-config.ts` / `38eccf344cefde55b47139665e4b2429b0aa622cafe0711288f3d7008384a765` | 3 | `value[field]` in `arrayFields` ist ausschließlich lesend. `fields` stammt aus den lokalen Literalgruppen Etagen/Räume/Funktionen/Geräte/Szenen/Seiten, Graphen, Timer oder Uhren; externe Daten wählen keinen Eigenschaftsnamen. Das JSON ist größen- und tiefenbegrenzt, gefährliche eigene Schlüssel werden vor diesen Zugriffen abgewiesen. Es erfolgt keine dynamische Objektmutation. |
| `lib/preserved-ui-config.ts` / `1dc026b127729595690224d8dd5739b141ad0c6f1bd7a1537bff2d5969f42505` | 2 | `parsed[field]` prüft ausschließlich die fest vorgegebenen Schlüssel `smartHome`, `smartHomeConfig`, `logicEditor` auf Objektform. Keine Eingabe bestimmt einen Schlüssel oder Schreibpfad. Dieselbe vorgelagerte JSON-/Prototypschlüsselprüfung gilt. |
| `lib/smarthome-activation.ts` / `c44792017ca8db5fe1f20ed60d44173b1fabfdd416966e859f5b63a1c221aaf5` | 1 | Der vom Scanner als möglicher Timingangriff markierte `=== token`-Vergleich ist ein Identitätsvergleich einer lokal neu erzeugten leeren Objektreferenz. Diese Referenz ist ausschließlich Eigentumsmarker der Konfigurationssperre, kein Passwort, Lizenzschlüssel, CSRF- oder Sitzungstoken und kein vom Request gelieferter Wert. Der Vergleich verhindert das Freigeben einer fremden Sperre im `finally`-Block. Konstante kryptografische Vergleichsfunktionen wären für diese Referenzidentität fachlich falsch. |

Die Aktivierungs-API akzeptiert genau ein eigenes Boolean-Feld. Sie bleibt hinter gemeinsamer Anmeldung, Rollen-/Capability-, CSRF- und Lizenzprüfung. Sie verändert nur den ausdrücklich gewählten Freigabeschalter im vorhandenen Installer-Patch, übernimmt die Änderung erst nach bestätigtem DB-Write und verwendet die gemeinsame Konfigurationssperre. Der Bestandsdatenprüfer verwendet feste States im validierten alten UI-Namensraum, die bestehenden berechtigten Datenbankzugriffe und feste Fehlercodes ohne Konfigurationsinhalte.

## Ergebnis und Grenzen

Der vollständige ESLint-Regressionslauf wurde nach Eintrag dieser drei konkreten Bewertungen erneut ausgeführt und mit Exitcode 0 beendet:

| Messgröße | Ergebnis |
| --- | ---: |
| Geprüfte Quellen | 190 |
| Aktuelle Scannerfundstellen | 3.103 |
| Historische offene Fundstellen | 2.955 |
| Individuell bewertete aktuelle Fundstellen | 148 |
| Unbewertete neue oder verbotene Fundstellen | 0 |
| Früher inventarisierte, derzeit abwesende Fundstellen | 108 |

Die Rohdaten liegen in `raw/ui-security.json`. Bereits inventarisierte Altbefunde bleiben offene Scannerhinweise. Ein grüner Regressionslauf bedeutet ausschließlich, dass keine unbewerteten neuen oder verbotenen Scannerfundstellen verbleiben; er bedeutet keinen befundfreien Quellcode.

Nicht nachgewiesen sind eine vollständige fachliche Prüfung sämtlicher alter Timer-/Graphfelder, eine automatische Wiederherstellung vor 9.0.8 bereits verlorener optionaler States oder die Verfügbarkeit geschützter Quelldaten ohne entsprechende Leseberechtigung. Diese Grenzen werden durch die Scannerbewertung nicht aufgehoben.
