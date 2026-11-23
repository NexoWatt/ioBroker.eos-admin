# Prüfung der automatischen npm-Vorbereitung

Prüfstand: NexoWatt EOS 9.0.13, 23. November 2026.

Der neue Helfer `tools/eos-prepare-publish.cjs` unterstützt das Kopieren einer
vollständigen Repo-Lieferung über einen älteren Repo-Ordner. Vor dem bestehenden
Release-Gate entfernt er ausschließlich bytegenau bekannte, nicht mehr benötigte
Dateien unter `adminWww` aus dem Veröffentlichungsbaum. Die Originalbytes bleiben
in einem neuen Nachbarordner `*.publish-backup-*` außerhalb des Repositorys
erhalten. `restore.json` dokumentiert Pfade, SHA-256-Werte und Bearbeitungszustand.

## Prüfreihenfolge und Abbruchbedingungen

1. Alle aktuellen versiegelten Dateien einschließlich Helfer, Releaseprüfer und
   Altdateikatalog müssen vorhanden sein und ihren SHA-256-Werten entsprechen.
   Paketname und Version müssen zur Versiegelung passen.
2. Sämtliche Zusatzdateien im Prüfumfang werden vor dem ersten Schreibzugriff
   klassifiziert. Erlaubt sind ausschließlich Pfad-/Hash-Kombinationen aus dem
   versiegelten Katalog, die nicht aktuell versiegelt sind und mit keinem
   aktuellen Pfad unter Windows kollidieren. Unbekannte oder geänderte Dateien
   bleiben unverändert; der Vorgang bricht ab.
3. Pfadprüfung und `lstat` blockieren Pfadtraversal, absolute Pfade, Windows-ADS,
   reservierte Gerätenamen, symbolische Verknüpfungen einschließlich defekter
   Links, Hardlinks und Spezialdateien. Aktuelle Admin-Textdateien dürfen die
   zu entfernenden Dateinamen nicht mehr referenzieren.
4. Alle Sicherungskopien werden exklusiv angelegt und erneut gehasht, bevor ein
   Original entfernt wird. Unmittelbar vor jeder Entfernung werden Inhalt und
   Dateiidentität erneut geprüft.
5. Abschließend muss der unveränderte Releaseprüfer `check()` bestehen. Der
   Helfer erzeugt keine neue Versiegelung, baut keine Assets neu und überspringt
   keine Tests oder weitere npm-Prüfungen.
6. Bei einem Fehler werden bereits entfernte Originale aus den bestätigten
   Kopien zurückgeschrieben. Eine inzwischen am Originalpfad entstandene Datei
   wird nicht überschrieben. Solche Konflikte werden im Wiederherstellungsplan
   festgehalten; Sicherung und Fehlermeldung bleiben verfügbar.

## Schnittstelle

```js
const { preparePublish, PublishPreparationError } = require('./tools/eos-prepare-publish.cjs');
const result = preparePublish({ root: repositoryPath });
// { version, quarantined: string[], backupDir: string | null, verifiedFiles }
```

Ohne `root` wird der Repositorypfad aus dem Speicherort des Helfers bestimmt.
Der direkte CLI-Aufruf akzeptiert keine zusätzlichen Optionen. Fehler besitzen
einen `code` und beenden den CLI-Aufruf mit Status 1. Eine erneute Vorbereitung
des bereits bereinigten Bestands legt keine weitere Sicherung an.

## Durchgeführte Prüfungen

Die neun funktionalen Tests in `test/eos-publish-prepare.test.cjs` und die
19 unabhängigen Sicherheitsprüfungen in
`test/eos-publish-prepare-security.test.cjs` bestanden zusammen jeweils mit
**28/28 Tests auf Node.js 22.23.4 und 24.22.3 unter Linux**. Geprüft wurden unter
anderem unveränderte frische Lieferungen, mehrere bekannte Altdateien,
Wiederholbarkeit, Änderungen aktueller Quellen, unbekannte Dateien, manipulierte
Kataloge, Pfad-/Linkfälle, eine fehlgeschlagene Sicherung, ein Fehler bei der
zweiten Entfernung, ein während des Rückfalls neu belegter Zielpfad und der
CLI-Aufruf aus einem Verzeichnis mit Leerzeichen. Der Helfer bestand außerdem
ESLint und einen strikten JSDoc-/checkJs-Typcheck.

## Grenzen

- Die Hashprüfung setzt einen vertrauenswürdig bezogenen Lieferstand voraus.
  Sie ist keine digitale Herausgebersignatur und schützt nicht gegen einen
  Angreifer, der Helfer und Versiegelung gemeinsam ersetzt.
- Zwischen der letzten Pfadprüfung und dem Entfernen verbleibt eine
  betriebssystembedingte Race-Grenze gegenüber gleichzeitig mit denselben
  Benutzerrechten schreibenden Prozessen. Kopieren und Veröffentlichen müssen
  nacheinander erfolgen. Bei einem Prozessabbruch oder Stromausfall bleibt die
  Sicherung erhalten; ein automatischer Neustart einer unterbrochenen
  Bereinigung ist nicht implementiert.
- Sicherungsrechte sind unter POSIX 0700 für Ordner und 0600 für Dateien.
  Unter Windows gelten zusätzlich die geerbten NTFS-Berechtigungen; der Helfer
  richtet keine eigene ACL ein. Ein nativer Windows-Lauf wurde hier nicht
  durchgeführt. Portable Pfadregeln wurden durch Negativtests geprüft.
- Der Helfer arbeitet im Dateiumfang des Releaseprüfers und prüft zusätzlich
  den gesamten Admin-Dateibaum. Er ersetzt weder die anschließende Prüfung des
  npm-Paketinhalts auf Geheimnisse noch die übrigen Releaseprüfungen.
- Diese Tests betreffen die Veröffentlichungs-Vorbereitung. Sie belegen keine
  unveränderte Laufzeitfunktion sämtlicher Adaptermodule oder einen bereits
  erfolgten Upload zur npm-Registry.
