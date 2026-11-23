# Integrierte Geräte- und EEBus-Module ab 9.0.6

Devices 0.5.176 und EEBus 0.3.0 werden im vorhandenen Prozess von `eos-admin` betrieben. Es gibt keine zusätzliche Adapterinstanz und keine zweite Lizenzaktivierung. Die importierten Protokollimplementierungen und ihre Grenzen stehen in den jeweiligen Unterlagen unter `modules/devices/` und `modules/eebus/`.

## Bedienung und einmalige Einrichtung

- `https://<EOS-Adresse>:8188/modules/devices/`: Geräte konfigurieren, vorhandene Templates auswählen und bei Bedarf die Konfiguration einer gestoppten `nexowatt-devices.N`-Instanz übernehmen.
- `https://<EOS-Adresse>:8188/modules/eebus/`: EEBus konfigurieren, lokale Identität und Gegenstellen anzeigen, Geräte gezielt koppeln und Verbindungen verwalten.
- Beide Seiten benutzen die bestehende EOS-Anmeldung. Konfiguration, Import, Kopplung und Diagnosebefehle sind Administratoren vorbehalten; der Server prüft Rolle, Passwort-Ersteinrichtung, Origin und CSRF bei jedem Aufruf.
- Neue Module bleiben deaktiviert, bis ihre Konfiguration geprüft und ausdrücklich aktiviert wird. Ein Import aktiviert kein Gerät.
- Die vorhandene NWL3-Systemlizenz schaltet die Module mit frei. Alte NWL2-Lizenzen behalten ihre signierte Adapterauswahl; eine reine UI-Altfreigabe wird nicht auf neue Module ausgeweitet. Ein getrenntes Lizenzformular ist nicht vorgesehen.
- Aus den Moduloberflächen führen Links zur Systemverwaltung (`/system/`) und zum EOS-Dashboard (`/`). ioBroker Admin bleibt auf seinem bestehenden Port 8081; EOS verwendet weiterhin 8188.

## Übernahme bestehender Anlagen

1. Bestehende ioBroker-Konfiguration, Datenbank und Instanzdaten sichern. Alte Geräte- und EEBus-Instanzen nicht löschen.
2. Die jeweilige alte Instanz deaktivieren und den tatsächlichen Stillstand durch den laufenden ioBroker-Controller bestätigen lassen. Ein veraltetes oder fehlendes Alive-Signal reicht nicht als Nachweis.
3. Auf der passenden EOS-Modulseite die ursprüngliche Instanz ausdrücklich auswählen und importieren. Quellkonfiguration und alte Datenpunkte bleiben erhalten.
4. Den Importhinweis prüfen: Der Adapter speichert Herkunft, Zeit, altes und neues Präfix sowie ausgelassene EEBus-Felder als Migrationsvermerk. Diese Angaben bleiben bei späteren Konfigurationsänderungen erhalten.
5. EMS-/History-/VIS-Zuordnungen gezielt auf die neuen IDs umstellen. Der Import kopiert keine historischen Zustände und schreibt bestehende Mappings nicht automatisch um.
6. EEBus-Identitäten, private Schlüssel und Kopplungs-PINs aus der alten Instanz werden nicht übernommen. Die neue lokale Identität prüfen und Gegenstellen neu koppeln. Zertifikat und privater Schlüssel des eingebetteten Moduls liegen anschließend im privaten Modul-Instanzverzeichnis; Neustarts erhalten diese Identität.
7. Modul aktivieren und Messwerte, Schreibgrenzen, Gegenstellen und gerätespezifisches Fehlerverhalten prüfen. Erst danach erforderliche Steuerfreigaben aktivieren. EEBus startet mit Trockenlauf und ohne automatisches Anwenden von CLS-Grenzen.

| Alter Namensraum | Neuer Namensraum bei EOS-Instanz 0 |
| --- | --- |
| `nexowatt-devices.N.devices.<id>.*` | `eos-admin.0.devices.<id>.*` |
| `eebus.N.devices.<id>.*` | `eos-admin.0.eebus.devices.<id>.*` |

Für einen Rückfall zuerst das eingebettete Modul deaktivieren und seinen Stillstand prüfen. Anschließend die gesicherte Zuordnung und alte Instanz kontrolliert wiederherstellen. Niemals beide Instanzen gleichzeitig für dieselben Geräte freigeben.

## Laufzeitgrenzen

`src/lib/eosModuleHost.js` verwaltet Lebenszyklen, getrennte Datenpunktbereiche, Konfiguration und Betriebsfreigaben. Vor dem Start und während des Betriebs müssen zentrale Lizenz, EOS-Ownership und ein frischer Nachweis über gestoppte Altinstanzen gültig sein. Bei einer Änderung der Altinstanz oder einem Controller-Ausfall wird die Schreibfreigabe sofort ungültig. Ein monotones, begrenztes Lease verhindert, dass ein hängender Datenbankaufruf die Freigabe unbegrenzt verlängert. Die Protokollmodule prüfen dieselbe Freigabe zusätzlich am eigentlichen Gerätezugriff.

Start, Stop, Datenbankprüfungen, HTTP-Autorisierung und Kommandos sind zeitlich begrenzt. Konfiguration und JSON-Nachrichten sind größenbegrenzt, und wiederholte Kommandos werden begrenzt. Ein Fehler eines Moduls stoppt seine Freigabe; die HTTPS-Anmeldung und Systemverwaltung bleiben unabhängig erreichbar. Ein nicht bestätigter Transport-Stop sperrt einen erneuten Start bis zum Adapterneustart.

Konfigurationen werden über ioBrokers Verschlüsselungsfunktion als ein Envelope unter dem geschützten `native.eosModules` gespeichert. Die API liefert Passwörter, Authentifizierungsheader und URLs mit Zugangsdaten nur als Platzhalter zurück. Beim Speichern werden unveränderte Geheimnisse anhand der Geräte-ID zugeordnet, niemals anhand einer verschobenen Tabellenzeile. Eine vollständige Sicherung muss auch den zur Entschlüsselung erforderlichen ioBroker-Systemschlüssel enthalten; das Envelope ist kein Ersatz für ein verschlüsseltes Backup.

Die EEBus-/§14a-Kommunikation erfolgt intern über eine feste Schnittstelle mit einem nicht serialisierbaren Herkunftsnachweis. Der normale ioBroker-Nachrichtenbus erhält dadurch keine Berechtigung, sich als eingebettetes Modul auszugeben. Rückmeldungen gehen direkt an das aktive eingebettete Modul.

## Name und Sitzung

Die Root-Adresse entscheidet anhand der aktuellen EOS-Sitzung: ohne gültige Anmeldung zur Login-Seite, mit gültiger Sitzung ins Dashboard. Die Berechtigung für Verwaltungsfunktionen wird separat geprüft. Eine Sitzung unter einer IP-Adresse wird vom Browser nicht automatisch auf einen anderen Hostnamen übertragen.

Die lokale mDNS-Ankündigung ist standardmäßig aktiv und kann in den Adaptereinstellungen abgeschaltet werden. Sie kündigt den tatsächlich laufenden HTTPS-Port an und erzeugt weder einen DNS-Eintrag für den Kurznamen `nexowatt` noch einen privilegierten Listener auf 443. Für `https://nexowatt` ohne Port gelten die Einrichtungsschritte in `deploy/NEXOWATT_LOCAL_HTTPS.md`. Namensauflösung, Zertifikatsnamen und Vertrauen auf den Clients müssen zusammenpassen.

## Prüfgrenzen

Die Softwareprüfungen umfassen echte lokale HTTP-/TLS-Verbindungen, die tatsächlichen Modul-Factories und die interne Bridge. ioBroker-Datenbank, Lizenzstatus, Benutzerrollen und Hardware wurden dafür kontrolliert simuliert. Eine erfolgreiche Hausanlagen-, EEBus-Gegenstellen- oder elektrische Abnahme wird damit nicht behauptet. Das eingebettete EEBus-Protokoll behält seinen dokumentierten Erprobungsstatus. Für RAM-Verbrauch und Dauerstabilität sind Messungen mit der tatsächlichen Gerätezahl und dem realen Controller erforderlich; aus den Tests wird keine feste Speicherobergrenze abgeleitet.
