# NexoWatt EOS 9.0.12 – SmartHome-Einrichtung

Stand: 23.11.2026. Ausgangspunkt ist das ausgelieferte und versiegelte vollständige Repository 9.0.11. Das neue Paket bleibt im Kanal `next`. Dieser Bericht ist keine allgemeine Produktivfreigabe, Hardwareabnahme oder CRA-Konformitätserklärung.

## Anlass und geprüfter Bestand

**EOS-SHCFG-UX-001:** Der Kundenscreenshot zeigt eine breite Arbeitsfläche, aber ein abgeschnittenes Eigenschaftenpanel mit horizontalem Scrollen rechts. Die dauerhaft gleichzeitig sichtbaren Bibliotheks-, Arbeits- und Eigenschaftenbereiche erschweren eine einfache Raum-/Gerätezuordnung. Der Nutzer wünscht ausdrücklich Dropdowns und getrennte Einrichtungsfenster. Er bestätigt auf Nachfrage, dass bei der automatischen Erkennung vor allem die Bedienung unübersichtlich ist; ein konkreter Nulltreffer- oder Importfehler wurde nicht gemeldet.

Die Änderung führt eine vereinfachte Standardansicht mit Auswahl und Dialogen ein. Die vorhandene Struktur bleibt das Datenmodell; es wird kein neuer Gebäudebaum erzwungen. Bestehende Konfiguration, Szenen, Timer, manuelle Geräteprofile, Alias-Verknüpfungen und Kachelanordnung sind zu erhaltende Funktionen. Dialog-Abbruch, Speichern und Erkennen sind voneinander getrennte Aktionen.

**EOS-TD-ORDER-001:** Bei der anschließenden Codeprüfung wurde ein eigenständiger Fehler reproduziert. Die Objektkeys wurden per `localeCompare` sortiert und mit `_keysOptionalSorted: true` an `@iobroker/type-detector` 6.2.0 übergeben. Dessen binäre Suche verwendet die normale JavaScript-Zeichenreihenfolge. In einer kontrollierten Mischung aus Groß- und Kleinbuchstaben fehlten dadurch drei von sieben Kanälen. Die korrekte Sortierung erkennt alle sieben. Der tatsächliche ausgelieferte Typdetektor wird im Regressionstest verwendet; es wird kein künstlicher Erkennungsalgorithmus als Produktnachweis eingesetzt.

## Umsetzung und Vertrauensgrenzen

Die Standardansicht „Einrichten“ ersetzt das dauerhaft dreigeteilte Arbeitsfenster durch Geschoss-/Raum-Dropdowns und eine kompakte Geräteliste. Anlegen und Bearbeiten öffnen einen breiten Dialog im selben Tab. Die Formulare verwenden die bestehenden Gerätevorlagen, Datenpunktbindungen und Bedienprofile. Die bisherige Expertenansicht, Szenen, Zeitschaltuhren, manuelle Gerätezuordnung und Kachelanordnung bleiben erreichbar.

Jeder Bearbeitungsdialog besitzt einen eigenen tief kopierten Entwurf. „Abbrechen“ verwirft ihn einschließlich neuer, noch nicht übernommener Geräte. „In Entwurf übernehmen“ ändert erst den Hauptentwurf; dauerhaft gespeichert wird weiterhin ausdrücklich. Gleichzeitige Speichervorgänge werden verhindert. Eine verspätete Antwort darf einen inzwischen neueren Entwurf nicht ersetzen. Reload-/Dateiimport- und Erkennungsantworten prüfen ihre Anforderungs- und Entwurfszuordnung.

Die Erkennung zeigt kompakte, durchsuchbare Seiten mit je 100 Vorschlägen. Bis zu 100 ausgewählte Geräte lassen sich gemeinsam einem Zielraum zuordnen. Details und bestehende Aktualisierungsfunktionen bleiben separat zugänglich. Vorschläge werden vor der Übernahme vollständig vorbereitet, auf Duplikate und aktuelle Zuordnung geprüft und anschließend gemeinsam in den Entwurf übernommen. Eine optionale Aliasanlage bleibt ein expliziter, serverseitig berechtigter Auftrag. Bei Fehlern oder veralteter Antwort bleibt der Konfigurationsentwurf unverändert; eventuell bereits angelegte Aliasobjekte werden ausdrücklich gemeldet und nicht automatisch gelöscht oder erneut angelegt.

Die Backend-Erkennung besitzt begrenzte Mengen und kooperative Zeitbudgets; Details und Einschränkungen stehen in `DETECTION-REVIEW.md`. Normale leere Ergebnisse werden von Fehlern und abgebrochenen Teilscans unterschieden. Discovery selbst führt keine Aktor- oder Konfigurationsschreibzugriffe aus. Bestehende Anmeldung, serverseitige Rollen-/CSRF-Grenzen, Lizenzprüfung und Alias-Lese-/Schreibziele bleiben bestehen. Es wurden keine neuen Produktabhängigkeiten eingeführt.

**EOS-PUBLISH-OVERLAY-001 (fortgeführt):** Der Nutzer meldet auch beim Wechsel von 9.0.9 auf 9.0.11 erneut dieselben abweichenden Admin-Assets. Das Log belegt die lokale Integritätsabweichung, aber nicht allein, ob jeder Eintrag zusätzlich oder verändert ist. Ein Overlay alter Dateien ist die naheliegende Ursache. Der unterstützte Lieferweg bleibt ein frisch entpacktes Repository oder die unveränderte, geprüfte TGZ-Datei als explizites Argument für `npm publish`. Die Schutzprüfung wird nicht deaktiviert; `--diagnose` trennt zusätzliche, fehlende und veränderte Dateien.

## Prüfungen

Die folgenden Ergebnisse gehören zum Quell-/Buildstand 9.0.12:

| Prüfung | Ergebnis |
| --- | --- |
| Vollständiges `npm test`, Node.js 22.23.4 | 1205 bestanden, 0 fehlgeschlagen, 2 ausgelassen |
| Vollständiges `npm test`, Node.js 24.22.3 | 1205 bestanden, 0 fehlgeschlagen, 2 ausgelassen |
| Erkennung, Limits, Abbruch, Alias-/Importregressionen | 26 gezielte Backendfälle auf beiden Node-Versionen; im Gesamtlauf enthalten |
| Einrichtungsdialoge, Stapelimport und verspätete Antworten | Echte Produktfunktionen und lokale DOM-/API-Fixtures; Einzelheiten in `SMARTHOME_SETUP_REVIEW.md` |
| Bestehende SmartHome-Transaktionen und Import | Separater Runtime-Prüflauf erfolgreich; keine echte Browser- oder Hardwareabnahme |
| Typprüfung | Gesamte konfigurierte Typprüfung auf Node 22/24; neuer Dialoghelfer mit strikten Typen |
| Linting | Konfiguriertes ESLint einschließlich neuer Dialog- und geänderter Erkennungskomponente bestanden |
| Builds | Admin-Frontend, Installer, Backend und finale UI-Runtime erfolgreich |
| Quellen-/Dokumentationsabgleich | Generierte Runtime und deutsche Modulbeschreibungen synchron; Rohbelege enthalten die genauen Mengen |
| Geheimnissuche | Unterstützte UI-Regeln ohne Treffer; zusätzliche Paketprüfung im Release-Gate |
| Sicherheitsgate | 208 Quellen, 0 neue blockierte Befunde; historische Baseline unverändert |
| npm-Audit Laufzeit | 0 gemeldete Advisories |
| npm-Audit gesamte Build-/Testumgebung | 14 moderate, 0 high/critical; Entwicklungsbestand bleibt offen |
| SBOM | Root, Laufzeit, Admin-Frontend und Installer auf 9.0.12; Vendoring-Abgleich bestanden |

Im ersten Gesamtlauf scheiterten zwei Prüfungen: Der extrahierte Discovery-Cache benötigte im Testkontext zusätzlich die neuen realen Erkennungshelfer, und die Versionsmeldungen in `io-package.json` überschritten mit 21 Einträgen das unveränderte ioBroker-Schemalimit von 20. Der Testkontext wurde ergänzt und der älteste Metadateneintrag entfernt. Ein reiner Kommentarformatfehler des neuen Helpers wurde vor dem finalen Runtime-/Dokumentationsbuild korrigiert. Die Schutzregeln und Testaussagen wurden nicht gelockert; die anschließenden vollständigen Läufe sind die oben ausgewiesenen Ergebnisse.

Die ausgelassenen Fälle benötigen `nginx` beziehungsweise `setfacl`. Die Lizenzkette Keygen 1.0.4 → lokaler HTTPS-Import → Aktivierung → verschlüsselte Speicherung → Neustart wird im Gesamtlauf mit der vorhandenen Keygen-Quelle geprüft. Testschlüssel und Tresore entstehen nur temporär und sind nicht Teil der Lieferung.

Das Sicherheitsgate enthält 3222 aktuelle Scannerfundstellen: 2952 historische offene Hinweise und 270 einzeln bewertete Fundstellen. Das bedeutet keine Bereinigung sämtlicher Altbefunde. `SECURITY_DELTA_REVIEW.md` bewertet den geänderten Umfang. Rohbelege und Hashes stehen unter `raw/INDEX.json`; Teilmengen werden nicht nochmals als zusätzliche Gesamterfolge gezählt.

Die abschließenden ZIP-/TGZ-Bytevergleiche, die frische Extraktion, der versionsbezogene Overlay-Fall und der npm-11.19.1-Artefakt-Trockenlauf stehen in `NexoWatt_EOS_9.0.12_Lieferpruefung.json`. Es wurde nichts auf npm oder auf der Kundenanlage veröffentlicht/installiert.

## Grenzen

Die vorhandenen ioBroker-Geräteobjekte und Rollen bilden die Grundlage der Erkennung. Automatische Vorschläge sind keine garantierte Erkennung beliebiger Hardware und keine Berechtigung zum Schalten. Eine manuelle Zuordnung bleibt für unvollständige Metadaten möglich. Es erfolgt kein Netzwerkgerätescan und keine automatische Hardwareinbetriebnahme.

Keine Kundenanlage, realen Aktoren oder Feldbusse wurden hier eingerichtet oder umgeschaltet. Die Bedienprüfungen verwenden lokale DOM-/API-Fixtures und echte Produktfunktionen. Eine visuelle Browser-/Touch-Abnahme war in dieser Umgebung nicht verfügbar; diese Grenze wird nicht durch Mocktests ersetzt. Auf dem Zielgerät insbesondere schmale Bildschirmbreite, Dropdowns, Dialoge, Datenpunktauswahl, Abbruch, Speichern/Neuladen und bestehende Bedienfunktionen prüfen.

Die Bestandsübernahme und Start-/Stoppabsicherung aus 9.0.11 werden beibehalten. Ein erfolgreiches Softwarepaket bestätigt keine unterbrechungsfreie Kundenmigration. Die historische Sicherheitsbaseline und bereits offene Entwicklungsbefunde bleiben sichtbar. Scanergebnisse oder Bestandsschutz sind kein pauschaler Konformitätsnachweis.

Lizenz-/Notice-Texte bleiben erhalten. Das vollständige Quell-ZIP und das fertige npm-TGZ werden geprüft und eindeutig an diesen Stand gebunden. Es wird keine Veröffentlichung oder Live-Installation im Namen des Nutzers durchgeführt.
