# NexoWatt EOS 9.0.13 – Repo-Veröffentlichung und SmartHome-Menüs

Stand: 23.11.2026. Paket `iobroker.eos-admin`, Kanal `next`. Gezielte Fortschreibung von 9.0.12; keine Veröffentlichung auf npm und keine Änderung an einer Kundenanlage durch diese Arbeit.

## Fehlerbild und Änderung

Der Nutzer meldete `RELEASE_CONTENT_CHANGED` nach dem Kopieren neuer ZIP-Inhalte in einen schon benutzten Repository-Ordner. Mehrere Generationen von Admin-Builddateien blieben darin liegen. Alle 20 konkret gemeldeten Dateinamen wurden in tatsächlichen früheren Lieferungen gefunden; der historische Katalog umfasst deren Dateihashes mit Archivprovenienz. Der gesonderte TGZ-Versuch scheiterte an einer nicht vorhandenen Datei (`ENOENT`).

Eine zweite, eigenständig reproduzierte Ursache verhinderte den gewünschten Weg auch bei einem frischen Repository: Nach bestandener Dateiprüfung startete `prepublishOnly` die gesamten Entwicklertests, deren Abhängigkeiten in einer ZIP ohne `node_modules` fehlen. Ein echter npm-11.19.1-Verzeichnis-Trockenlauf zeigte dieses Problem am unveränderten 9.0.12-Paket.

9.0.13 bereitet ausschließlich bytegenau bekannte obsolete Admin-Dateien vor, sichert sie außerhalb des Repositorys und prüft danach den unveränderten aktuellen Lieferstand. Die vollständigen Tests laufen weiterhin vor der Lieferung und in der Entwicklung; ein versions- und dateigebundener Nachweis wird beim normalen `npm publish` ohne Entwicklungsabhängigkeiten geprüft. Es gibt kein automatisches Neubauen, Neuversiegeln oder Aussetzen der Prüfung im Veröffentlichungs-Hook.

Zusätzlich wurde anhand des neuen Nutzerbildes ein abgeschnittenes „Projektdatei“-Menü korrigiert. Die gemeinsame Headerregel begrenzte überlaufende Inhalte. Die Korrektur umfasst die lokale Layoutregel und koordiniertes Öffnen/Schließen der SmartHome-Menüs, ohne neue API oder Backendfunktion.

## Prüfergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| Vollständiges `npm test`, Node.js 22.23.4 | 1290 Tests, 1288 bestanden, 0 fehlgeschlagen, 2 ausgelassen |
| Vollständiges `npm test`, Node.js 24.22.3 | Gleicher Umfang und gleiche Ergebnisse |
| Publish-Vorbereitung und unabhängige Dateisystemregressionen | 28 Fälle je Node-Version, im Gesamtlauf enthalten |
| Versions-/Quellbaum-/Testbelegbindung | 49 Fälle je Node-Version, im Gesamtlauf enthalten |
| SmartHome-Einrichtung einschließlich sechs neuer Menüregressionen | 33 Fälle je Node-Version, im Gesamtlauf enthalten |
| Typprüfung | Konfigurierte Gesamtprüfung auf Node 22/24; neue Helfer zusätzlich mit strengem checkJs geprüft |
| Linting | Konfigurierte Prüfung einschließlich neuer Helfer und Menüquelle bestanden |
| Builds | Backend, Admin-Frontend, Installer und UI-Runtime erfolgreich; Runtimequellen und deutsche Code-Dokumentation synchron |
| Lizenzregression | Echte Keygen-1.0.4-Quelle im gesamten Testlauf verwendet; Schlüssel/Tresore nur temporär |
| Unterstützte UI-Geheimnisprüfung | Keine Treffer; zusätzliche Paket-Geheimnisprüfung im Release-Gate |
| UI-Sicherheitsgate | 208 Quellen; 0 neue blockierte Befunde; Baseline unverändert |
| npm-Audit Laufzeit | 0 gemeldete Advisories |
| npm-Audit gesamte Entwicklungsumgebung | 14 moderate, 0 hohe/kritische Advisories |
| SBOM | Versionsbezug 9.0.13, Vendoring-Abgleich bestanden |

Die zwei ausgelassenen Fälle benötigen `nginx` beziehungsweise `setfacl`. Die erste vollständige Prüfung schlug ausschließlich an einer Groß-/Kleinschreibung im erwarteten Diagnosehinweis „Do not re-seal a mixed build“ fehl. Der Hinweis wurde im Produktcode wiederhergestellt; keine Testaussage oder Schutzregel wurde abgeschwächt. Die erneuten vollständigen Läufe sind die hier genannten Ergebnisse. Frühere Fehlversuche bleiben in den Rohbelegen enthalten.

Das Sicherheitsgate zählt weiterhin 3222 aktuelle Scannerfundstellen: 2952 historische offene und 270 einzeln geprüfte. Die Menüänderung wurde unabhängig überprüft; nur die zwei bestehenden quellgebundenen Revieweinträge wurden nach der tatsächlichen Prüfung fortgeschrieben. Das ist kein sauberer Gesamt-Sicherheitsscan. Einzelheiten: [Sicherheitsdelta](SECURITY_DELTA_REVIEW.md).

Die vollständigen Rohbelege mit SHA-256-Zuordnung stehen unter `raw/INDEX.json`. Der abschließende Test des tatsächlichen ZIP-/npm-Verzeichniswegs folgt nach der unveränderlichen Versiegelung; sein Ergebnis steht außerhalb dieser selbstreferenzfrei versiegelten Quellen in `NexoWatt_EOS_9.0.13_Lieferpruefung.json`.

## Sicherheit und Abgrenzung

- Vollständige Vorprüfung vor einer Dateientfernung; nur bekannte historische Admin-Dateien außerhalb des aktuellen Manifests sind zulässig.
- Verifizierte Sicherungen außerhalb des Pakets; Rückfall bei Teilfehlern und Erhalt konkurrierend hinzugekommener Dateien.
- Keine Änderung an zentraler Lizenzprüfung, Anmeldedaten, Ports, Gerätekonfiguration oder EMS-Regelung.
- Zusätzliche Dateien im gesamten veröffentlichten Verzeichnis `release-manifests/unified` werden erfasst; nur das selbstreferenzierende Hashmanifest wird aus seiner eigenen Dateiliste ausgeschlossen. Auch kaputte symbolische Links werden erkannt.
- Testnachweise und SHA-256-Manifest sind Integritätsbelege, keine digitale Herstellersignatur und keine CRA-Konformitätsbescheinigung. Ein Angreifer, der sämtlichen Code und sämtliche Nachweise ersetzen kann, wird dadurch nicht authentifiziert.
- Die historischen offenen Sicherheitsbefunde aus 9.0.12 bleiben als solche dokumentiert. Diese Änderung behauptet keine vollständige Bereinigung des Altbestands, keine RAM-Einsparung und keine allgemeine Produktivfreigabe.

Einzelreviews: [Publish-Vorbereitung](PUBLISH_PREPARATION_REVIEW.md), [unabhängiger Sicherheitsreview](PUBLISH_SECURITY_REVIEW.md), [SmartHome-Menüs](SMART_HOME_MENU_REVIEW.md). Die Lieferprüfung neben ZIP/TGZ dokumentiert die tatsächlich ausgeführten frischen Extraktionen und Verzeichnis-Veröffentlichungen. Frühere Berichte sind historische Belege und bestätigen nicht automatisch diese Version.

## Grenzen

Die automatisierten Prüfungen laufen unter Linux mit echten Node-/npm-Prozessen und isolierten lokalen Fixtures. Native Windows-PowerShell-/NTFS-Ausführung wurde nicht durchgeführt; Pfade mit Leerzeichen und Windows-Pfadkonflikte werden separat geprüft. Ein npm-Trockenlauf prüft weder npm-Anmeldung/2FA noch die Berechtigung zum tatsächlichen Upload. Es fand kein echter Upload statt.

Das Menü wurde anhand Quellcode, Screenshot und DOM-Regressionsprüfungen bearbeitet. Eine visuelle Browserabnahme auf den Endgeräten und eine Abnahme der Kundenanlage bleiben offen. Die zwei entsprechend ausgewiesenen ausgelassenen Tests benötigen zusätzliche Systemwerkzeuge; sie werden nicht als bestanden gezählt.
