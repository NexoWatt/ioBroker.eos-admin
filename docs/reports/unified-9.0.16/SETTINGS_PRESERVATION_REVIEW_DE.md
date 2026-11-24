# Nachprüfung: Erhalt gespeicherter Kundeneinstellungen

23.11.2026, EOS 9.0.16. Vergleich mit dem gelieferten Repository-ZIP 9.0.15 und gezielter Review der geänderten Startpfade; kein Produktionsdatenbank- oder Anlagenversuch.

## Änderung und Grenze

`loadInstallerConfigFromState` akzeptiert einen vorhandenen validen Installer-State als maßgeblich, einschließlich absichtlich leerer Objekt- und Listenwerte. Ein älteres Backup mit mehr Zuordnungen ersetzt diesen Zustand nicht mehr. Fehlende neue Laufzeitfelder werden im Speicher ergänzt; der normale Neustart persistiert den normalisierten Zustand nicht ungefragt. Bei Lese-/Validierungsfehlern werden vorherige Konfigurationsreferenzen wiederhergestellt und feste Diagnosecodes ausgegeben.

Nur ein bestätigt fehlender State erlaubt automatische Initialisierung beziehungsweise Recovery. Dieser Pfad verwendet die aktuelle zur Instanz passende Sicherung und prüft deren Installer-Inhalt mit demselben begrenzten Parser. Ein beschädigtes vorhandenes Backup oder ein Lesefehler wird nicht durch Rückgriff auf einen vermeintlich besseren alten Stand verdeckt. Fehlgeschlagene Installer-Persistierung löst keinen Backup-Schreibaufruf aus.

Vorhandene Flow-Schalter und eine abgeschaltete PV-Saison-KI bleiben beim Start erhalten. Die sechs fest benannten Flow-Einstellungen werden erst nach dem Laden der Installer-Konfiguration initialisiert, damit frühe Defaults keine gespeicherten Vorgaben verdecken. `syncSettingsToStates(true)` initialisiert nur fehlende States aus der dann wirksamen Konfiguration. Ein bewusster Einstellungs-Speicheraufruf darf weiterhin schreiben. StorageFarm-Lesefehler rechtfertigen keine leeren Defaults; vorhandene leere Listen bleiben vorhanden.

Die fünf neuen festen Konfigurations-/Backup-/StorageFarm-Startfehler sind in die bestehende fatale Startfehler-Liste aufgenommen. Dadurch bestätigt der Startfehlerpfad keine schreibbereite Runtime mit unvollständig geladenen Kundendaten. Die vorhandene kontrollierte Bereinigung wird beibehalten; es entsteht kein neuer Betriebssystem- oder Gerätebefehlsweg.

## Quellgebundene bestehende Scannerstellen

- Neun Einträge in `src-ts/runtime-executables/main.ts`: Diagnosezähler, vier Partnerfreigabe-/Telemetry-Zugriffe, History-Query-Lesen, begrenzter binärer Array-Suchindex, Dezimalgrammatik und feste Discovery-Fehler-Literalmap. Keiner dieser zuvor einzeln begründeten Bereiche ist Bestandteil des Settings-Diffs. Fingerprints, Anzahl, Gründe und ursprüngliche Belege bleiben erhalten.
- Zwei Einträge in `src-ts/runtime-executables/lib/preserved-ui-config.ts` mit insgesamt fünf Vorkommen: ausschließlich lesende Zugriffe über fest programmierte Abschnitts-/Arraynamen. Der neue Export `parseInstallerConfigState` ruft denselben Parser mit der konstanten ID `installer.configJson` und `required=true` auf. Größen-, Tiefen-, Prototypschlüssel- und Abschnittsform-Prüfung werden dabei beibehalten. Die bestehenden Zugriffsausdrücke und ihre begründeten Grenzen bleiben unverändert.

Nach dem vollständigen Diff-Review werden ausschließlich die gedruckten Code-Hashes dieser bisherigen Einzelreviews aktualisiert. Die historische Baseline und bisherige Befundbudgets bleiben unverändert. Zusätzliche Scannerstellen werden separat gemeldet und müssen behoben oder einzeln nachgeprüft werden; dieser Vermerk genehmigt sie nicht pauschal.

Der zwischenzeitlich hinzugefügte direkte dynamische Flow-Indexzugriff wurde vor dem endgültigen Stand entfernt. Die Initialisierung nutzt die vorhandene feste Synchronisierung nach dem Laden der Installer-Konfiguration. Dafür wurde keine zusätzliche Scanner-Ausnahme behalten. Geprüfte finale Quellbytes: `main.ts` SHA-256 `943ab11ea87203ba5cb746b4cff421200465a216442283405516f331a92eac0a`, `preserved-ui-config.ts` SHA-256 `21518d2a4293ebf1ae54e9ec44b0945e7d3bdac5b96d81ae68e1fe78e3ddafc7`.

## Prüfbezug

`test/eos-unified-settings-preservation.test.cjs` prüft die tatsächliche gehostete Runtime mit Controller-Doubles: valide und absichtlich leere Konfigurationen bleiben bytegleich, beschädigte/unerreichbare States schreiben keine Defaults, Recovery benötigt fehlenden State und passende Instanz, Schreibfehler verändern keine Backups, Flow-/KI-Schalter überleben und StorageFarm-Lesefehler überschreiben keine Konfiguration. Der abschließende Releasebericht weist ausgeführte Ergebnisse und Scannerbefunde aus.
