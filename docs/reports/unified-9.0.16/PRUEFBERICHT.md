# NexoWatt EOS 9.0.16 – Änderungs- und Prüfbericht

Stand: 23.11.2026. Technischer Integrations-Teststand für den Kanal `next`. Die Softwareprüfung und die tatsächliche Abnahme auf einem Kundengerät bleiben getrennte Nachweise.

## Anlass und Umfang

Der Nutzer meldete erneut einen Abbruch von `npm publish` nach Überkopieren der vollständigen Repo-ZIP: `EOS_PUBLISH_EXTRA_UNKNOWN` für `ui/admin/react/assets/index-Bm4__n5R.js`. Während der Umsetzung kamen Meldungen zu überschriebenen Einstellungen nach einem Update und zum Speichern im Gerätebereich hinzu. Zusätzlich soll jede angemeldete Website-Sitzung nach zehn Minuten ohne Bedienung automatisch enden; automatische Hintergrundabfragen dürfen die Frist nicht verlängern.

Der bisherige Publish-Katalog erfasste alte Admin-Dateien, jedoch nicht den alten Installer-Build unter `ui/admin/react/assets/`. Die gemeldete Datei stammt bytegenau aus dem gelieferten 9.0.6-Archiv. SHA-256 der Datei: `9cd5d39ab4a92133e19c87399b0b22c8f575346df227b693cdcd659520202fe7`. Die Archivherkunft und die weiteren verifizierten historischen Hashes werden im vorhandenen Katalog `release-manifests/unified/obsolete-admin-assets.json` dokumentiert.

## Umsetzung und Schutzgrenzen

Die Publish-Vorbereitung erkennt zusätzlich ausschließlich verifizierte historische Installer-Assets. Vollständige Vorprüfung, aktuelle Quellhashes, Begrenzung auf freigegebene Verzeichnisse, Referenzprüfung und Dateitypschutz bleiben erhalten. Erst nach erfolgreicher Gesamtprüfung werden bekannte alte Dateien in einen benachbarten Sicherungsordner außerhalb des Repositorys verschoben. Unbekannte oder veränderte Dateien werden nicht stillschweigend gelöscht, neu gebaut oder als geprüft versiegelt. Die technische Veröffentlichung eines Testpakets benötigt keine erfundene allgemeine Produktivfreigabe.

Die Inaktivitätsfrist gehört zur gemeinsamen serverseitigen Sitzung. Neue Anmeldungen erhalten eigene Sitzungsfamilien; Token-Erneuerungen übernehmen die bestehende Frist. Normale HTTP-Abfragen, Status-Polling und Socket-Verkehr verlängern sie nicht. Die gemeinsame Browserkomponente meldet tatsächliche Interaktion über die geschützte Aktivitätsgrenze. Abgelaufene Sitzungen erhalten durch erneute Hintergrundabfragen keine neue Freigabe. Sitzung, Rollen, CSRF- und Origin-Prüfungen bleiben maßgeblich; eine reine Browser-Zeitschaltung wäre kein ausreichender Zugriffsschutz.

Die Abmeldung beendet die Website-Berechtigung dieser Sitzung. Sie ist kein Befehl zum Anhalten der lokalen EMS-Regelung oder der Gerätekommunikation. Andere unabhängig angemeldete Sitzungen behalten ihre eigene Frist. Die PWA-Identität, das unveränderte NexoWatt-App-Symbol und die bisherige Migrationsnavigation bleiben Bestandteil des Lieferstands.

## Einstellungen beim Update und Neustart

Die zusätzliche Nutzer-Rückmeldung zu überschriebenen Einstellungen führte zu vier nachgewiesenen Startpfaden im eingebetteten UI-/EMS-Modul. Die Korrekturen liegen in der kanonischen `ui/src-ts/runtime-executables/main.ts` und dem vorhandenen Helfer `lib/preserved-ui-config.ts`; die zugehörigen JavaScript-Dateien werden daraus erzeugt.

| Nachgewiesener Fehler | Korrigiertes Verhalten |
| --- | --- |
| Eine gültige gespeicherte Installer-/EMS-Konfiguration konnte durch eine ältere Sicherung mit mehr Einträgen ersetzt werden. | Der vorhandene gültige Zustand bleibt maßgeblich, auch bei bewusst leeren Listen und gelöschten Zuordnungen. Seine gespeicherten JSON-Bytes werden beim Laden nicht neu geschrieben; erforderliche Normalisierung erfolgt im Arbeitsspeicher. |
| Ein Lade- oder Parsefehler konnte wie eine fehlende Konfiguration behandelt werden. | Unlesbare oder ungültige vorhandene Daten stoppen diesen Ladepfad mit einem festen Fehlercode. Weder Standardwerte noch Sicherungen werden darübergeschrieben. Wiederherstellung ist nur bei nachweislich fehlendem Zustand und passender Instanz zulässig. |
| Ein Lesefehler der StorageFarm konnte leere Standardzuordnungen zurückschreiben. | Der Fehler wird sichtbar behandelt; die vorhandenen Speicherzuordnungen bleiben unverändert. |
| Ein bewusst deaktiviertes PV-Saison-AI-Flag sowie gespeicherte Energiefluss-Anzeigeeinstellungen konnten beim Start wieder geändert werden. | Gespeicherte Werte bleiben beim Start erhalten. Vorgaben werden nur für neue Zustände verwendet; die sechs Energiefluss-Anzeigestates werden dabei erst nach vollständigem Laden der gespeicherten Installer-Konfiguration initialisiert. Ausdrücklich gespeicherte Änderungen werden weiterhin übernommen. |

Die automatische Wiederherstellung eines wirklich fehlenden Installer-Zustands nutzt die aktuelle passende Sicherung vor einer älteren Version. Eine vorhandene, aber ungültige oder nicht lesbare Sicherung darf nicht als Anlass für eine stillschweigende Rücksetzung dienen. Fehler bei der Wiederherstellung aktualisieren die Sicherung nicht. Diagnosecodes enthalten keine Nutzdaten oder Datenbankfehlermeldungen.

Die gezielte Einstellungsprüfung unter Node 22 umfasst 10 bestandene Fälle; die kombinierte Prüfung unter Node 24 mit bestehenden Übernahme-/Laderegressionen umfasst 20 bestandene Fälle. Ein zusätzlicher Test des tatsächlichen Startablaufs bestätigt, dass die konkreten Konfigurationsfehler den vorgesehenen Aufräum- und Fehlerpfad auslösen und keine mit Standardwerten beschreibbare, nur teilweise initialisierte UI freigeben. Rohbelege: `raw/settings-preservation-node22.log` und `raw/settings-preservation-regression.log`. Sie verwenden das tatsächliche gehostete Runtime-Modul mit einem lokalen Controller-Modell, keine Kundendatenbank. Diese Korrektur verhindert die konkret nachgewiesenen Überschreibungen; sie rekonstruiert bereits verlorene Einstellungen nicht ohne eine gültige Sicherung und bescheinigt keine pauschale Übernahme aller Kundenkonfigurationen.

## Geräte speichern

Die Gerätekonfiguration wurde bisher erst mit dem operativen Modulstart geladen. Solange etwa eine Bestandsübernahme oder der lizenzabhängige Betriebsstart ausstand, lieferte der Host nur eine Platzhalterkonfiguration mit `configurationReady=false`. Der innere Geräteeditor blieb trotzdem bedienbar: Ein neu angelegtes Gerät konnte deshalb angezeigt werden, obwohl die äußere Speicherschaltfläche weiterhin gesperrt war. Die aktivierte Checkbox stellte dabei den gewünschten Konfigurationswert dar und bewies keinen laufenden Geräteprozess.

Der Host lädt nun die bestehende geschützte Konfiguration unabhängig vom operativen Modulstart über den vorhandenen Konfigurationsspeicher. Dieser Lesevorgang erzeugt weder Gerätesubscriptions noch Hardwarezugriffe oder Instanzänderungen. Sobald die Migrationsprüfung den Zugriff freigibt und das Laden vollständig erfolgreich ist, kann das Administratorkonto Einstellungen bearbeiten und verschlüsselt speichern, auch wenn das operative Modul noch nicht gestartet ist. Der spätere Modulstart wartet auf bereits angenommene Lese- und Speichervorgänge und liest anschließend den gespeicherten Stand erneut. Ein Schreibfehler bleibt beim Speichern sichtbar; ein zwischenzeitlicher Stopp verhindert den operativen Start. Die Lizenz-, Ownership- und Betriebsstartgrenzen bleiben unverändert.

Bei unvollständiger Bestandsübernahme oder einem Lesefehler lehnt der Server das Speichern weiterhin ab. Statt eines scheinbar nutzbaren Editors zeigt die Oberfläche jetzt den konkreten Grund und einen direkten Zugang zur Bestandsübernahme; Editor und Aktivierungscheckbox sind bis zum erfolgreichen Neuladen gesperrt. Dadurch können dort keine nur scheinbar gespeicherten neuen Geräte angelegt werden. Bei einem Anmelde- oder Speicherfehler bleiben bereits bearbeitete Entwürfe erhalten; bewusstes Neuladen verlangt bei Änderungen eine Bestätigung zum Verwerfen.

Die gezielte Geräte-/Konfigurationsprüfung umfasst unter Node 22 und Node 24 jeweils 51 bestandene Fälle. Rohbelege: `raw/devices-save-regression.log` und `raw/devices-save-regression-node22.log`. Die Prüfungen decken den tatsächlichen HTTP-/OAuth-/CSRF-/Host-/Konfigurationsspeicher-Pfad mit Gerätevalidierung ab: SMA-Energy-Meter über Speedwire anlegen, speichern und erneut laden; Aktivierung ändern; Neustart mit leeren Paketvorgaben ohne Verlust gespeicherter Geräte, Felder, Geheimnisse oder des bestehenden Namensraums. Weitere Fälle prüfen blockierte und später freigegebene Migration, Ladefehler, Start-/Stop-Rennen sowie Entwurferhalt im Editor. Keine Instanzänderung und kein ungefragter operativer Modulstart werden ausgelöst. Controller und Gerätetransport werden dabei modelliert; eine tatsächliche SMA-Gerätefunktion auf einer Kundenanlage ist dadurch nicht belegt.

## Prüfung

| Prüfung | Ergebnis |
| --- | --- |
| Vollständiges `npm test`, Node.js 22.23.4 | 1389 Tests, 1387 bestanden, 0 fehlgeschlagen, 2 ausgelassen |
| Vollständiges `npm test`, Node.js 24.22.3 | Gleicher Umfang und gleiche Ergebnisse |
| Typprüfung | Konfigurierte Gesamtprüfung auf Node 22/24 bestanden; Admin-TypeScript zusätzlich im Build |
| Linting | Konfigurierte Prüfung einschließlich zentraler Sitzungssicherheit und neuem Browser-Inaktivitätsclient bestanden |
| Builds | Backend, Admin-Frontend, Installer, Module und UI-Runtime erfolgreich; Runtimequellen und deutsche Code-Dokumentation synchron |
| Publish-Regression | Reproduktion mit Originaldatei aus 9.0.6, Katalogprovenienz und gesicherte Behandlung historischer Installer-Dateien; unbekannte/manipulierte Dateien bleiben geschützt |
| Inaktivitätsregression | Serverseitige Sitzungsfrist, Token-Erneuerung, Socket-Grenze und Browser-Interaktion mit kontrollierter Zeit geprüft; Rohbelege nennen die einzelnen Fälle |
| Gerätespeicherung | Echter HTTP-/OAuth-/CSRF-/Host-/Store-Pfad, fehlender operativer Start, Neustart, erhaltene Einstellungen/Secrets, Migration und Entwurfschutz geprüft |
| Einstellungsübernahme | Gültige und absichtlich verkleinerte Konfiguration, fehlende/ungültige Zustände, fehlerhafte Sicherungen, StorageFarm sowie Anzeige-/PV-AI-Einstellungen gegen die tatsächliche Runtime geprüft |
| Lizenzregression | Echte Keygen-1.0.4-Quelle im gesamten Testlauf verwendet; temporäre Testschlüssel, keine Herstellerschlüssel |
| UI-Geheimnisprüfung | Keine Treffer; zusätzliche Paket-Geheimnisprüfung im Release-Gate |
| UI-Sicherheitsgate | 210 Quellen; 0 neue blockierte Befunde |
| npm-Audit Laufzeit | 0 gemeldete Advisories |
| npm-Audit gesamte Entwicklungsumgebung | 14 moderate, 0 hohe und 0 kritische Advisories |
| SBOM | Versionsbezug 9.0.16; Vendoring-Abgleich bestanden |

Die zwei ausgelassenen Fälle benötigen `nginx` beziehungsweise `setfacl`. Die automatisierten Tests verwenden lokale HTTP-/Controller-/Gerätemodelle und kontrollierte Browser-Kontexte. Sie bestätigen keine erfolgreiche Übergabe auf der tatsächlichen Liveanlage. Die konkrete Live-Patchversion Node.js 22.23.5 wurde nicht ausgeführt; getestet sind die oben angegebenen Versionen.

Das Sicherheitsgate führt 3222 aktuelle Scannerfundstellen: 2952 historische offene und 270 einzeln geprüfte. Der historische Bestand bleibt als offener Prüfkontext sichtbar; ein erfolgreiches Delta-Gate bedeutet keine vollständige Sicherheitsprüfung aller geerbten Quellen. Historischer Kontext: [Sicherheitsdelta 9.0.14](../unified-9.0.14/UI_SECURITY_DELTA_REVIEW.md).

Die versionsgebundenen Rohbelege stehen in `raw/INDEX.json`. Nach Abschluss dieser unveränderlichen Quellen werden Repo-ZIP, Paket, frische Extraktion und tatsächliche npm-Verzeichnis-Trockenläufe geprüft. Deren Ergebnisse einschließlich Hashes stehen getrennt in `NexoWatt_EOS_9.0.16_Lieferpruefung.json`; diese abschließenden Paketbelege können nicht selbst in ihrem eigenen unveränderlichen Quellhash enthalten sein.

## Grenzen und Installation

Die lokale Testumgebung kann native Windows-Prozesse, reale Smartphone-Browser, npm-Kontoberechtigungen und den tatsächlichen Anlagenzustand nicht ersetzen. Die Paketierung wird mit echten Node-/npm-Prozessen und aktiven Lifecycle-Prüfungen gegen eine lokale, nicht veröffentlichende Zieladresse geprüft. Ein Pfad mit Leerzeichen unter Linux ist kein Windows-Nachweis. Ein zusätzlicher Chromium-Startversuch war durch die Laufzeitumgebung blockiert (`process_singleton`-Socket, `EPERM`); daraus wird kein bestandener visueller Browsertest abgeleitet. Tatsächliche Zeitabläufe im Zielbrowser einschließlich Hintergrundbetrieb und Smartphone-Ruhemodus bleiben vor Ort abzunehmen.

Die bestehende Kundenkonfiguration, Geräteanzahl, Regeltakte, frischen Messwerte und sichere Übergabe zwischen Alt- und Zielinstanzen müssen weiterhin vor Ort bestätigt werden. Es werden weder eine allgemeine Produktionsfreigabe noch eine CRA-Zertifizierung behauptet. Installation, Rückfall und konkrete Bedienprüfung stehen in [START_HIER_9.0.16.md](../../start/START_HIER_9.0.16.md).

## Primärquellen

- [OWASP, Session Management Cheat Sheet – Idle Timeout](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#idle-timeout)
- [npm CLI 11, npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/)

Die Quellen wurden am 23.11.2026 geprüft. Sie begründen die serverseitige Ablaufkontrolle beziehungsweise den Veröffentlichungsablauf; sie bestätigen keine konkrete Geräteabnahme.
