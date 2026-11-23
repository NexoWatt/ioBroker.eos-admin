# Zweite Codeprüfung: Backup-Dateien und Kindprozesse

Stand: 23.11.2026; Teilumfang der laufenden 9.0.7-Integration. Getrennte technische Codeprüfung durch einen zweiten Entwicklungsagenten, keine unabhängige Sicherheitszertifizierung. Linux x64 / Node.js 24.22.3.

Geprüft und nach Abstimmung mit dem Integrationsverantwortlichen korrigiert: `modules/backup/src/files.ts` und `modules/backup/src/command.ts`.

| Befund | Korrektur und Nachweis |
| --- | --- |
| FileHandle-Streams mit `autoClose:false` halten nach `pipeline()` ihren Deskriptor. Ein unmittelbar folgendes `await fd.close()` blieb in einem tatsächlichen Node-Versuch ausstehend. | Alle Streams vor manuellem Schließen ausdrücklich zerstören; Synchronisation vorher ausführen. Verschlüsselung, Entschlüsselung, Archivbildung, Hashing, Kopie und Befehlsausgabe schließen jetzt im Test vollständig ab. |
| Bei einem bereits vorhandenen Entschlüsselungsziel schlug `open(...O_EXCL)` korrekt fehl, der allgemeine Fehlerpfad löschte anschließend jedoch die bestehende Datei. | Nur in diesem Aufruf tatsächlich neu angelegte Klartextdateien entfernen. EEXIST-Test bestätigt unveränderten Inhalt der vorhandenen Datei. |
| Ein gescheitertes Öffnen des Kopierziels konnte den bereits geöffneten Quelldeskriptor zurücklassen. | Geschachteltes Ressourcenmanagement; 30 wiederholte Fehlversuche ohne Deskriptorwachstum. |
| Archivveröffentlichung per `rename()` konnte ein gleichnamiges bestehendes Archiv ersetzen. | Atomische Veröffentlichung per Hardlink im selben Verzeichnis mit anschließendem Entfernen der temporären Datei; vorhandene Archive bleiben unverändert. |
| Quelldateiprüfung und späterer normaler Pfadzugriff konnten unterschiedliche Inodes betreffen. | Quelldatei mit `O_NOFOLLOW` öffnen und den geöffneten Deskriptor prüfen; Hashing und Datenstrom verwenden diesen Deskriptor. Größenlimit zusätzlich während des Streams durchsetzen. |
| Kindprozess startete vor dem möglicherweise scheiternden Öffnen der Ausgabedatei. Pipeline-Fehler wurden erst nach Prozessende erwartet. | Ausgabe vor Start öffnen, Fehlerhandler sofort registrieren, Pipeline sofort beobachten, Timeout-/Ausgabelimit beendet den direkten Prozess und schließt Streams. Feste Befehle ohne Shell; der Prozess bleibt in der eigenen Backup-Worker-Gruppe. |

`backup-files-review-tests.tap`: **7/7 bestanden**. Enthalten sind tatsächliche Dateien, AES-256-GCM-Roundtrip, Authentifizierungsfehler, leere Datei, Kollisionsschutz, Symlinkablehnung, Archiv-Einträge/Ausschluss des eigenen Backup-Verzeichnisses sowie echte Kindprozesse mit Startfehler, Exitcode, Zeitüberschreitung und zu großer Ausgabe.

Zusätzlich wurde eine 64-MiB-Datei verschlüsselt und wiederhergestellt. SHA-256 vor und nach Wiederherstellung identisch. Während des Datenstroms abgetasteter maximaler zusätzlicher JavaScript-Heap: **1.551.152 Byte**; RSS-Zuwachs **54.857.728 Byte**. Diese Einzelmessung unterstreicht die Trennung von JavaScript-Heap und Prozess-RSS. Sie ist keine Messung des vollständigen EOS-Geräts und keine feste RAM-Garantie.

Die Gesamtkontrolle des Prozessbaums liegt beim Backup-Worker/Elternprozess: fest zugeordnete Prozessgruppe, Abbruch auch bei frühem Ende des Gruppenführers und beim Verlust der Elternverbindung. Diese Schnittstelle wurde dem Integrationsverantwortlichen zur Nachprüfung gemeldet. Nach Abgleich mit dem tatsächlich ausgeführten ursprünglichen `78-clean.ts` gilt die Aufbewahrung als **Anzahl pro Sicherungstyp**, bei Mehrfach-Datenbanken mit entsprechender Zielanzahl; manuelle Läufe löschen nichts. Die frühere Vermutung anhand eines veralteten Kommentars in `main.ts`, es seien Tage, war falsch. Ebenfalls gemeldet: CCU-One-Click muss seinen vorhandenen Datenpunkt bedienen. Der endgültige Gesamtbericht muss deren Nachprüfung ausweisen.

Grenzen: Verzeichnisarchivierung verwendet den bestehenden tar-fs-Baustein ohne Link-Dereferenzierung, mit vorab geprüfter Dateiliste und begrenzter Ausgabemenge. Ein kompromittierter Prozess unter derselben Dienst-UID ist keine isolierte Vertrauenszone; diese Prüfung behauptet keine Dateisystem-Sandbox gegen gleichberechtigte Hostprozesse. Reale Datenbanksicherungen, NAS/Cloud-Ziele, Datenträgerausfälle und vollständige Wiederherstellung auf Zielhardware gehören in die separate Integration-/Anlagenabnahme.
