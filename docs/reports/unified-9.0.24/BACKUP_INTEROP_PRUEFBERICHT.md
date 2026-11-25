# EOS 9.0.24 – Sicherung und unabhängige Modulprozesse

Stand: 25.11.2026. Geprüfter Arbeitsbaum: `work-924/iobroker.eos-admin`. Dieser Bericht beschreibt die lokale Nachprüfung der integrierten OCPP-Konfiguration und der Laufzeitgrenze zwischen UI/EMS, Geräteanbindung, EEBUS und OCPP. Eine Kundenanlage oder physische Ladestation wurde nicht verwendet.

## Änderung und Abdeckung

**Befund B924-01, behoben:** Die zusätzliche Konfigurationssicherung vor einem EOS-Update verwendete in `src/lib/eosUpdateSnapshot.ts` eine feste Modulliste ohne OCPP. `ocpp` ist ergänzt. Die bestehende Prüfung von verschlüsselter v2-/v1-Hülle, Objektidentität, privater ACL, Größenbegrenzung und zwei konsistenten Lesedurchläufen gilt damit auch für OCPP. Ein beschädigter autoritativer Store fällt nicht auf eine alte native Konfiguration zurück. Änderungen zwischen den beiden Lesedurchläufen verhindern die Updatevorbereitung.

Die im selben 9.0.24-Auftrag ergänzte Kioskkonfiguration wird ebenfalls erfasst. Der Snapshot prüft exakt Objekt-ID, Config-Typ, private ACL und das tatsächliche Schema mit Aktivierung, sicherer Revision und gültigem freischaltendem Benutzer. Unbekannte Felder, ungültige Berechtigungen und konkurrierende Änderungen werden abgewiesen. Laufzeit-Cookies oder Sitzungsschlüssel sind nicht Bestandteil dieses Exports.

Die reguläre Vollsicherung benötigte keinen zusätzlichen OCPP-Sonderexport: Der Controller sichert Objekte und Zustände einschließlich `eos-admin.N.modules.ocpp.configuration`, Systemschlüssel, Namespace-Migrationsdaten sowie nativer oder erhaltener Stations-IDs. Das EOS-Profil kopiert Modulverzeichnisse bereits generisch; nur eigene Backup-Archive und Wiederherstellungsschlüssel sind davon ausgenommen. Der derzeitige OCPP-Laufzeitstand benötigt keine persistenten Dateien in `modules/ocpp`; auch dort künftig vorhandene private Dateien werden vom vorhandenen Profilpfad erfasst.

Die vollständige Sicherung enthält die dauerhafte OCPP-Watchdog-Aktivierung, Phasen-/Einheitseinstellungen und Stations-Konfigurationsobjekte mit ihren bestätigten Werten. Gespeicherte Sitzungen, Sollwerte und zeitlich alte Lease-Fristen bleiben historische Daten. Das Offlinewerkzeug führt keine Wiederanlaufbefehle aus. Die separate Update-Konfigurationssicherung ist kein vollständiger Export aller Stationszustände und ersetzt nicht die Vollsicherung.

`modules/backup/README.md` beschreibt die Datenhoheit bei übernommenem `ocpp21.N`, den getrennt zu bewahrenden Schlüssel, Update-/Vollsicherungsabgrenzung und den Rückfall: Ein weiterhin verwendeter Originalnamensraum darf nicht pauschal mit einem alten Adapter gelöscht werden. Alter und integrierter Stationsserver dürfen nicht gleichzeitig aktiv sein. Eine globale Neuvergabe oder Löschung von Stationsdaten wurde nicht eingeführt.

## Ausgeführte Prüfungen

| Prüfung | Node 22.23.4 | Node 24.22.3 |
| --- | ---: | ---: |
| Update-Konfigurationssnapshot einschließlich neuer OCPP-/Kiosk-Fälle | 14/14 | 14/14 |
| Bestehende Historien-Backup-Zuordnung | 5/5 | 5/5 |
| Neue verschlüsselte OCPP-Vollsicherungs-/Offlinevorbereitungsfälle | 2/2 | 2/2 |
| Neue tatsächliche Prozess-/OCPP-Sitzungsunabhängigkeit | 1/1 | 1/1 |
| Unabhängige Kiosk-HTTP-/Widerrufprüfung, separater Bericht | 3/3 | 3/3 |
| Summe dieses abgegrenzten Laufs | **25/25, keine Skips** | **25/25, keine Skips** |

Gemeinsamer Befehl je Node-Version:

```sh
node --test test/eos-module-ems-independence.test.cjs modules/backup/test/ocpp-coverage.test.cjs test/eos-customer-update-snapshot.test.cjs test/eos-history-backup-scope.test.cjs test/eos-kiosk-independent-review.test.cjs
```

Rohprotokolle: `raw/backup-interop/final-node22.tap` und `final-node24.tap`. Strikte Typprüfung über `tsconfig.eos-customer-updates.json` und ESLint des geänderten TS-Helfers sowie der vier betroffenen Testdateien bestanden; Rohlogs: `types.txt`, `lint-source.txt`, `lint-tests.txt`. Customer-Update-, Modul- und Backup-Tests sind durch vorhandene Testglobs erfasst; die separate Kiosk-Reviewdatei ist durch die Releaseintegration zusätzlich aufzunehmen. Paket-/Versionsmetadaten wurden in diesem Teilauftrag nicht verändert.

### Was tatsächlich ausgeführt wurde

`modules/backup/test/ocpp-coverage.test.cjs` verwendet die tatsächliche OCPP-Konfigurationsvalidierung, den tatsächlichen `EosModuleConfigStore` und den produktiven Credentialcodec. Ein echter Backup-Job-Kindprozess erstellt authentifiziert verschlüsselte Archive und das zugehörige Recovery-Set. Die echte Offlinevorbereitung prüft und entschlüsselt diese. Nach dem Export lassen sich native und übernommene OCPP-Konfiguration mit dem gesicherten Systemschlüssel erneut laden. Originale IDs, Typen, Nullwerte, Qualität und Zeitstempel sowie OCPP-Konfigurationsmetadaten bleiben erhalten. Moduldateien und deren Hashmanifest stimmen; Schlüssel und eigene Archive erscheinen nicht im Profil. Der Controller-CLI-Einstieg ist ausdrücklich eine synthetische Datenbank-Snapshot-Fixture. Hier wurde keine vollständige echte Controller-Datenbank wiederhergestellt.

`test/eos-module-ems-independence.test.cjs` startet den produktiven `EosModuleHost` ohne injizierte Modulfactories: Geräte, EEBUS und OCPP laufen in drei wirklichen OS-Kindprozessen. Geräte sind leer konfiguriert; EEBUS-Netzwerkdienste sind deaktiviert, Identitäts-/Zustandsverwaltung läuft real. Eine lokale simulierte OCPP-Station öffnet einen echten WebSocket, führt BootNotification aus und bleibt verbunden.

Die echte `ui/main.js`-Laufzeit mit EMS/Charging-Management startet in einem vierten Kindprozess. Die Geräte-/EEBUS-Bridges sind wie im Parent angebunden. Nach `SIGKILL` dieses UI-/EMS-Prozesses erzeugt dessen Supervisor eine neue Generation/PID und erreicht wieder EMS-Bereitschaft. Anschließend wird UI/EMS vollständig gestoppt. Die drei Modul-PIDs und Generationen bleiben unverändert, ihre Parent-Freigabe bleibt gültig und dieselbe OCPP-Verbindung beantwortet weiter Heartbeat. Erst `ModuleHost.stop()` schließt die Verbindung und beendet die drei Prozesse. Synthetisch sind ioBroker-Datenbank/Fassade, Lizenzantwort und der im Executor fehlende Controller-Dateilokator; die UI-, EMS-, Modul- und Prozessimplementierungen sind nicht ersetzt.

## Grenzen und Restabnahme

Die Modulprozesse sind unabhängig vom UI-/EMS-Prozess, aber weiterhin vom gemeinsamen EOS-Parent und Controller abhängig. Ein EMS-Neustart ist kein Neustart des gesamten EOS-Adapters. Unabhängige Kommunikation ist außerdem kein Nachweis, dass ein physischer Lader einen Sollwert eingehalten hat. Der OCPP-Lease-Stop und dessen Protokollfehlerfälle gehören zum gesonderten OCPP-Bericht.

Die vorhandene Historienauswahl und PostgreSQL-/Influx-Implementierung wurden hier nicht geändert. Reale PostgreSQL-/Influx-Backup-/Restorebelege aus früheren Ständen werden nicht als neu ausgeführte 9.0.24-Prüfung ausgegeben. Offen bleiben Zielhostinstallation, reale Datenbankwiederherstellung, Hersteller-Wallbox, Ausfall-/Wiederanlaufprüfung mit gemessener Leistung und Dauer-/Lastbetrieb. Die vollständige Release-Regression, Paketbuild und endgültige Quell-/Artefaktzuordnung werden durch die zentrale Releaseintegration ergänzt. Dieser Teilbericht enthält keine allgemeine Produktionsfreigabe oder Zuverlässigkeitsgarantie.
