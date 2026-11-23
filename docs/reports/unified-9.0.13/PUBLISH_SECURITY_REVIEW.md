# Sicherheitsreview: Veröffentlichung aus der Repo-ZIP, 9.0.13

Stand: 2026-11-23. Unabhängiger Quellcode- und Negativtest-Review des Publish-Ablaufs. Geprüft wurden `tools/eos-prepare-publish.cjs`, `tools/eos-release-evidence.cjs`, die Anbindung in `tools/eos-release-check.cjs` und `package.json` sowie der Dateiumfang von `tools/eos-release-manifest.cjs`.

**Ergebnis:** Für diesen begrenzten Publish-Ablauf wurde nach den unten beschriebenen Korrekturen kein offener Releaseblocker gefunden. Dies ist keine allgemeine Freigabe der Regelung, einer Kundenmigration oder einer Live-Anlage. Diese Bereiche wurden in diesem Review nicht erneut geprüft.

## Schutzgrenzen und Änderungen

Die Repo-ZIP darf in einen bestehenden Arbeitsordner kopiert werden. Die Vorbereitung entfernt ausschließlich zusätzliche Dateien unter `adminWww/`, deren Pfad und exakter SHA-256-Inhalt im mitgelieferten, selbst versiegelten Altdateikatalog stehen. Aktuelle versiegelte Dateien werden vorher vollständig geprüft. Fehlende oder veränderte aktuelle Dateien, unbekannte Zusätze, abweichende Altdateibytes und noch vom aktuellen Admin-Build referenzierte Altdateien blockieren die Vorbereitung.

Die Vorbereitung erzeugt keinen neuen Build und keine neue Versiegelung. Ein vollständiger Vorprüfungsfehler erzeugt keine Sicherung und entfernt keine Datei. Zulässige Altdateien werden zuerst vollständig in einem neuen Nachbarordner außerhalb des Paketordners gesichert. Die Sicherungsdateien werden bytegenau geprüft, bevor irgendein Original entfernt wird. Ein lokaler `restore.json`-Beleg enthält Originalpfad, Dateihashes und Bearbeitungszustand. Unter POSIX werden Sicherungsverzeichnisse mit Modus 0700 und Sicherungsdateien mit 0600 angelegt. Der Elternordner muss dafür beschreibbar sein.

Dateien werden über `lstat`, regulären Dateityp, Linkanzahl, Geräte-/Inodeidentität, Größe, Zeitstempel und erneuten Inhaltsvergleich geprüft. Symbolische Links, Junctions, kaputte Links und Hartverknüpfungen werden nicht zur Bereinigung zugelassen. Relative Pfade werden einschließlich Traversierung, Windows-ADS, reservierter Gerätenamen, Kontrollzeichen und kollidierender Groß-/Kleinschreibung geprüft. Eine noch vorhandene aktuelle Datei wird niemals aufgrund ihres ähnlich geschriebenen Altdateinamens entfernt.

Bei einem abgefangenen Teilfehler werden bereits entfernte Originale aus der geprüften Sicherung zurückkopiert. Eine zwischenzeitlich neu angelegte Datei wird durch exklusives Anlegen geschützt und nicht überschrieben. Ein solcher Konflikt beendet die Vorbereitung mit einem Fehler und erhält die Sicherung für die gezielte Wiederherstellung. Anschließend prüft der vorhandene Releaseprüfer weiterhin den kompletten Lieferstand.

## Im Review geschlossene Punkte

| Punkt | Behandlung |
| --- | --- |
| `existsSync` vor `lstat` konnte einen kaputten symbolischen Link übersehen. | Der Manifest-Walker verwendet `lstat`; nur ein tatsächlich nicht vorhandener Pfad wird übersprungen. Links und Spezialdateien blockieren. Die Vorbereitung prüft zusätzlich den kompletten Admin-Dateibaum. |
| Das Paket veröffentlichte das ganze Verzeichnis `release-manifests/unified/`, während das Seal zuvor nur einzelne dortige Dateien erfasste. | Das gesamte Verzeichnis ist nun im Seal-Umfang; nur `files.json` selbst ist zur Vermeidung einer Selbstreferenz ausgenommen. Unbekannte Zusatzdateien in diesem Umfang werden nicht stillschweigend veröffentlicht. |
| Eine reine Sammlung von Negativtests könnte schon wegen einer ungültigen Testfixture scheitern. | Eine gültige Positivkontrolle prüft erfolgreiche Sicherung, unveränderte aktuelle Dateien, unverändertes Seal, externe Ablage und Wiederholbarkeit, bevor dieselbe Fixture für Negativfälle verwendet wird. |

## Testbelege statt Nachinstallation beim Publish

Eine frisch entpackte ZIP enthält keine Entwicklerabhängigkeiten. Deshalb startet der Publish-Hook keine neue Installation und keine nur teilweise ausführbaren Tests. Die vollständigen Tests werden bei der Release-Erstellung ausgeführt; ihre Ergebnisse werden in einem explizit erzeugten `validation.json` an den geprüften Lieferstand gebunden. Publish prüft diesen Datensatz nur lesend. Es gibt keinen automatischen Ersatz fehlender Belege und keine erneute Versiegelung.

Der Belegprüfer verlangt die aktuelle Paketversion, die tatsächlichen Testbefehle aus `package.json`, beide unterstützten Node-Reihen, fünf vollständige Testzusammenfassungen mit Mindestumfang je Phase, keine Fehler/Abbrüche/TODOs und maximal die zwei bereits bekannten übersprungenen Tests. Die Zähler müssen mit dem INDEX übereinstimmen. Die festen lokalen Rohlog- und Laufzeitdateien müssen dieselben SHA-256-Hashes wie im INDEX haben. Der Datensatz bindet zusätzlich die sortierte vollständige Release-Dateiliste; ausschließlich `validation.json` selbst wird aus diesem inneren Hash ausgenommen. Das äußere Seal umfasst auch `validation.json` und die Verifizierungswerkzeuge.

Diese Hashes erkennen vermischte oder nachträglich veränderte Lieferstände. Sie sind keine digitale Hersteller-Signatur und kein unabhängiger Beweis gegenüber einem Autor, der alle Dateien und Belege bewusst ändern darf. Der Vertrauensursprung bleibt der kontrollierte NexoWatt-Releaseprozess.

## Ausgeführte unabhängige Prüfungen

`test/eos-publish-prepare-security.test.cjs` enthält 19 Prüfungen. Sie wurden mit Node 22.23.4 und Node 24.22.3 auf Linux ausgeführt: jeweils 19 bestanden, 0 fehlgeschlagen, 0 übersprungen. Rohprotokolle:

- `raw/node22-publish-security.log`
- `raw/node24-publish-security.log`

Abgedeckt sind gültige Sicherung/Idempotenz, veränderte oder fehlende aktuelle Dateien, unbekannte Zusatzdateien und Altdateiinhalte, bearbeiteter Katalog, sechs ungültige Pfadvarianten, kaputter Symlink, verknüpftes Elternverzeichnis, Hartlink, Windows-Casefold-Kollision, aktuelle Assetreferenz sowie injizierte Teilfehler mit erfolgreichem Rollback und mit einer geschützten Ersatzdatei.

Zusätzlich wurde die separate Belegprüfer-Suite `test/eos-release-evidence.test.cjs` im Review mit Node 24.22.3 ausgeführt: 49 bestanden, 0 fehlgeschlagen, 0 übersprungen. Sie prüft unter anderem manipulierte oder fehlende Logs, widersprüchliche Zähler, verkürzte Testphasen, Versions- und Befehlsabweichungen, veränderte Quelldateien, unzulässige Node-Stände, symbolische Links sowie die Prüfung einer Kopie ohne `node_modules`. Ihre synthetischen Fixtures ersetzen nicht die echten Volltestprotokolle des Releasepakets.

Die vollständigen Release-/Paketprüfungen und der konkrete `npm publish --dry-run` mit dem endgültigen Paket sind getrennte Liefernachweise im selben Releasebericht. Es wurde durch diesen Review nichts zu npm hochgeladen und keine Kundenanlage verändert.

## Verbleibende Grenzen

- Native Windows-ACLs, alle Windows-Reparse-Point-Arten und ein echter Windows-Publish wurden in diesem Linux-Review nicht ausgeführt. POSIX-Dateimodi sind kein Nachweis einer Windows-DACL. Die Windows-relevanten Pfad- und Kollisionsregeln wurden mit Dateisystem-Fixtures geprüft.
- Die Wiederherstellung deckt abgefangene I/O-Fehler ab. Prozessabbruch oder Stromausfall werden nicht als vollständig transaktionaler Rollback zugesichert; Sicherung und Wiederherstellungsbeleg dienen dann der gezielten Wiederherstellung.
- Ein konkurrierender Prozess mit denselben Schreibrechten kann zwischen der letzten Pfadprüfung und einer Dateisystemoperation eingreifen. Identitäts- und Inhaltsprüfungen verkleinern dieses Zeitfenster, ersetzen aber keine Betriebssystem-Transaktion. Während `npm publish` dürfen daher keine parallelen Kopier-/Buildvorgänge im selben Ordner laufen.
- Der Review belegt keine CRA-Zertifizierung, keine Hardwareprüfung und keine verlustfreie Übernahme ungeprüfter Kundenkonfigurationen.
