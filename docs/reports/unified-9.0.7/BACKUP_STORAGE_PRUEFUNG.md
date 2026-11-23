# Backup-Speicherprüfung 9.0.7

Stand: 2026-11-23. Entwicklungstest unter Linux/Node.js 24.22.3; keine Kundenzugangsdaten verwendet und keine produktiven Cloudspeicher angesprochen.

## Abgleich mit dem vorhandenen NexoWatt Backitup

Referenz ist das bereitgestellte `nexowatt.backitup` 1.0.10, insbesondere `src/main.ts` (Speicher-Konfigurationsabbildung) und die Skripte `50-ftp.ts`, `55-onedrive.ts`, `65-webdav.ts`, `70-dropbox.ts`, `75-googledrive.ts`, `78-clean.ts`. Aufbewahrungswerte bedeuten eine **Anzahl je Archivtyp**, keine Tage. Die bisherigen Minimal-/CCU-Verzeichnisse, `advancedDelete`, providerspezifischen Zähler und Faktoren für mehrere Datenbanken werden berücksichtigt. Manuelle Läufe löschen keine älteren Sicherungen. SD-Karte verwendet weiterhin ihren gemeinsamen Zielordner und den eigenen Influx-Zähler.

| Ziel | Umsetzung im integrierten Modul |
| --- | --- |
| Bereits eingehängtes CIFS/NFS, Copy, SD-Karte | Private streamende Kopie mit exklusiver Dateierstellung; kein Überschreiben und keine Hardlink-Anforderung auf dem NAS. Copy erhält getrennte Minimal-/CCU-Ordner. SD-Kartenprüfung aus dem vorhandenen Modul. |
| FTPS | Explizites TLS mit Zertifikatsprüfung, rekursive Zielordneranlage, Upload, Inventar, Download und Aufbewahrung. Verbindungs-/Metadatenfristen; begrenzte Transferzeit. |
| WebDAV | HTTPS mit Zertifikatsprüfung, MKCOL für konfigurierte Unterordner, vorhandene Collection wird mit PROPFIND geprüft; Inventar, streamender Upload/Download und Aufbewahrung. |
| Dropbox | Offizielles SDK 10.66.0 für Uploads; Ordneranlage, paginiertes Inventar, Download und Aufbewahrung über die dokumentierte API. Bestehende benutzerdefinierte Zugriffstoken sowie bestehende Refresh-Token werden genutzt. |
| Google Drive | Ordnerauflösung/-anlage, Resumable-Upload-Sitzung, paginiertes Inventar, Download, Aufbewahrung, persistierte Token-Erneuerung. |
| OneDrive | Ordnerauflösung/-anlage, Upload-Sitzung mit 320-KiB-Vielfachen, paginiertes Inventar, Download über eingeschränkte Microsoft-Zielhosts, Aufbewahrung und persistierte Token-Erneuerung. |

Remote-Inventare liefern ausschließlich Provider, Dateiname, Größe, Datum und Format. Zugangstoken, interne Objekt-IDs und signierte Downloadadressen werden nicht an den Browser weitergegeben. Ein Download wird als exklusiver Hintergrundauftrag ausgeführt. Alte Backitup-Dateien bleiben am ursprünglichen Ort; eine lokale Kopie wird verschlüsselt. Eine heruntergeladene NWB-Datei mit fremdem Wiederherstellungsschlüssel wird ausdrücklich nicht als authentifiziert gemeldet und nicht automatisch wiederhergestellt.

## Schutz gemeinsam genutzter Ziele

Namen allein beweisen keine Zugehörigkeit zu einer Anlage. Das Modul führt deshalb ein AES-GCM-verschlüsseltes Besitzverzeichnis je Geräteschlüssel, Provider und Zielkonfiguration unter `backup/retention`. Nur vollständig erfolgreich hochgeladene eigene Dateien werden eingetragen. Automatisches Löschen beschränkt sich auf diesen nachgewiesenen Bestand, den gerade erfolgreich erzeugten Archivtyp und die konfigurierte Anzahl. Alte Dateien, fremde EOS-Sicherungen und unklare Bestände bleiben erhalten. Bei unvollständiger Liste, doppelten Namen oder ungültigen Datumswerten findet kein solcher Bereinigungslauf statt. Aktuelle Dateien sind unabhängig von Sortierung geschützt.

Die verschlüsselte Token-Datei und das verschlüsselte Besitzverzeichnis müssen zusammen mit dem gesondert verwahrten Wiederherstellungsschlüssel im EOS-Profil wiederherstellbar bleiben. Fehlende Besitzmetadaten führen zur Aufbewahrung zusätzlicher alter Dateien, nicht zu einer pauschalen Löschung fremder Sicherungen.

## Grenzen und Voraussetzungen

- CIFS/NFS wird durch berechtigte Betriebssystemwartung eingehängt. Der Adapter führt keine privilegierten Mount-Kommandos aus. Unterschiedliche alte CIFS-/NFS-Ziele je Sicherungsart benötigen eindeutige lokale Mount-Zuordnungen; eine einzelne Zielangabe ersetzt sie nicht stillschweigend.
- Unsicheres FTP ohne TLS oder abgeschaltete Zertifikatsprüfung werden nicht übernommen. TLS-Vertrauen beruht auf dem Vertrauensspeicher des Geräts.
- Bestehende OAuth-Erneuerung nutzt dieselben Relay-Dienste wie das alte Modul. Für komplett neue OAuth-Konten ist weiterhin der jeweilige Einrichtungs-/Anmeldeablauf erforderlich; hier wurde keine neue OAuth-Anwendung registriert.
- Aufbewahrung wird erst nach erfolgreichem Upload aller ausgewählten Ziele gestartet. Bei einem teilweise fehlgeschlagenen Auftrag können zusätzliche nicht zugeordnete Kopien verbleiben; sie werden nicht unbemerkt gelöscht.
- Inventar: höchstens 10.000 Einträge bzw. 100 Seiten; Browserliste höchstens 1.000 Sicherungen. Bei Überschreitung expliziter Fehler statt einer zur Löschung verwendeten Teilliste. WebDAV/XML und andere Metadatenantworten sind auf 1 MiB begrenzt; DTD/Entitäten werden abgewiesen. FTPS-Metadaten sind zusätzlich zeitbegrenzt; die bestehende FTP-Bibliothek puffert die Verzeichnisantwort intern bis zur Rückgabe. Deshalb ist dies kein Nachweis eines absoluten Speicherlimits für einen beliebig fehlerhaften FTPS-Server.
- Transfers sind streamend und zeit-/größenbegrenzt. NWB-Authentifizierung ist vom bloßen erfolgreichen Download getrennt. Legacy-Archive werden durch eine verschlüsselte Kopie nicht nachträglich zu vertrauenswürdigen Programmen.
- Keine Feldprüfung mit realen Google-/Microsoft-/Dropbox-Konten, Kunden-NAS, SD-Karte oder einer Wiederherstellung einer Kundenanlage. Die Prüfungen ersetzen diese Abnahme nicht.

## Prüfungen

`node_modules/.bin/tsc -p modules/backup/tsconfig.json` erfolgreich.

Typbewusstes ESLint für alle Storage-/Token-Dateien mit `modules/backup/eslint.config.mjs` erfolgreich.

`node --test modules/backup/test/storage-parity.test.cjs modules/backup/test/http-transport.test.cjs`: **19/19 bestanden**. Rohprotokoll: `backup-storage-tests.log`.

Die 13 Speicherprüfungen testen echte temporäre Dateien, Verschlüsselung/Authentifizierung, zwei unterschiedliche Anlagenschlüssel in demselben Ziel, Zielwechsel, Nichtüberschreiben, getrennte Copy-Ziele, Legacy-Import, fremden Wiederherstellungsschlüssel, Größen-/Trunkierungsfehler, Aufbewahrungsanzahlen inkl. mehreren Datenbanken, XML-Grenzen, Ordneranlage, paginierte API-Verträge, Tokenrotation und Tokenverschlüsselung. Cloud-API-Antworten und FTPS-Verbindungen sind Testdoubles. Die sechs separaten HTTPS-Transportprüfungen decken Verbindungsfehler, frühzeitige HTTP-Antwort, Antwortabbruch, Größenlimit, synchrone Fehler, Erfolg und Zeitüberschreitung mit vollständigem Schließen offener Upload-Streams ab.

## Referenzen

- Google Drive Upload API: https://developers.google.com/workspace/drive/api/guides/manage-uploads
- Microsoft Graph Download: https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0
- Dropbox HTTP API: https://www.dropbox.com/developers/documentation/http/documentation
- WebDAV MKCOL/PROPFIND: https://www.rfc-editor.org/rfc/rfc4918.html
- XML-Parser: `fast-xml-parser` 5.12.1, nach Prüfung der behobenen `stopNodes`-Schwachstelle; diese Implementierung benutzt kein `stopNodes`.
