# Geräte-Lifecycle: vertiefte Nachprüfung

Stand: 24.11.2026. Ausgangsstand: ausgelieferter, unveränderter Quellstand 9.0.19. Korrektur: Arbeitsstand 9.0.20. Kein Zugriff auf Kundengeräte; keine Produktivkonfiguration geändert.

## Bestätigter neuer Befund NW-EOS-920-DEV-01

**Priorität: hoch (Verfügbarkeit und zuverlässige Übergabe).** Ein Modbus-Verbindungsversuch wartete vor dem Öffnen des TCP-Clients seine Wiederverbindungsverzögerung ab. Während dieser Wartezeit konnte `disconnect()` erfolgreich zurückkehren und die Hosted-Berechtigung entzogen werden. Danach setzte der alte Versuch trotzdem fort, öffnete einen neuen TCP-Socket und meldete sich verbunden. Der zuvor bestätigte Stop konnte deshalb einen unbenutzten, weiter offenen Alt-Client zurücklassen. Geräte mit begrenzter Zahl gleichzeitiger Modbus-Sitzungen können dadurch die neue Sitzung ablehnen.

Die Reproduktion nutzt den echten `ModbusDriver`, den echten `guardDriver`, `modbus-serial` und einen tatsächlichen lokalen TCP-Server. Im unveränderten Stand 9.0.19 öffnen Node.js 22 und 24 nach bestätigtem Stop genau eine TCP-Verbindung; der Verbindungsaufruf löst erfolgreich auf und `connected=true`. Es wird kein physischer Aktorbefehl übertragen. Die vorhandenen Dispatch-Schranken für Registerbefehle bleiben wirksam; dieser Befund ist kein Nachweis einer unberechtigten physischen Stellhandlung.

## Zusätzliche Prüfung durch getrennte Code-Review

Der unabhängige zweite Reviewpfad fand im ersten Korrekturstand einen angrenzenden Fall: `ensureConnected()` konnte nach der Ablehnung eines alten Verbindungsversuchs den neuen Client noch als offline markieren. Eine neue tatsächliche TCP-Regression scheiterte genau daran und besteht nach einer generationsgebundenen Fehlerbehandlung.

**NW-EOS-920-DEV-02:** SunSpec-Erkennung markierte ihren Scan vorab als erledigt. Ein Berechtigungsabbruch im ersten Probezugriff ließ dieses Flag bestehen; der nächste erlaubte Versuch übersprang die Erkennung ohne bestätigte Registerbasis. Dieser Fall wurde mit dem echten Erkennungsalgorithmus und kontrollierten Probeantworten reproduziert. Jetzt wird nur ein abgeschlossener Scan gespeichert. Gleichzeitig laufende Aufrufer teilen denselben Scan der aktuellen Generation. Verspätete Probe-/Modellantworten können keine Metadaten oder Client-Zeitlimits einer Ersatzgeneration verändern.

## Gezielte Änderung

`modules/devices/lib/drivers/modbus.js`:

- Jeder Disconnect entwertet die vorherige Verbindungsgeneration.
- Nach dem Warten auf einen parallelen Verbindungsversuch und nach der Wiederverbindungsverzögerung werden Generation und aktuelle Betriebsberechtigung erneut geprüft, bevor ein Transport entsteht.
- Nach abgeschlossenem Transportaufbau und optionaler SunSpec-Erkennung wird dieselbe Prüfung wiederholt.
- Die verspätete Fortsetzung einer alten Generation darf keinen inzwischen gestarteten Ersatzclient schließen oder dessen Verbindungszustand verändern.
- `E_MODBUS_CONNECT_CANCELLED` bleibt eine Lifecycle-Grenze. Sie wird nicht als ungültiges optionales Register behandelt und erzeugt keinen Register-Sperrcache.
- RTU-/ASCII-Freigaben werden jetzt im Disconnect abgewartet; die gesonderte Serial-Bus-Korrektur und deren Prüfungen werden im Serial-Lifecycle-Bericht geführt.
- Die bereits bestehende Behandlung echter ungültiger Register, Befehlsabstände, Einheiten, Geräteprofile und Konfiguration bleibt erhalten.

## Tatsächlich ausgeführte Prüfungen

| Prüfung | Ergebnis | Umfang/Grenze |
| --- | --- | --- |
| Vorher-Reproduktion gegen 9.0.19 | Erwartet fehlgeschlagen auf Node.js 22 und 24 | Echter TCP-Socket öffnet nach Stop; Rohbelege enthalten den Assertion-Fehler. |
| 7 neue TCP-Lifecycle-Regressionen | Bestanden auf Node.js 22 und 24 | Stop während Backoff, Leaseverlust, erneute Freigabe, alte/neue Clients, absichtlich verzögerter echter TCP-Connect-Callback, parallele Aufrufer und Berechtigungsentzug bei SunSpec. |
| 4 zusätzliche SunSpec-Lifecycle-Prüfungen | Bestanden auf Node.js 22 und 24 | Tatsächlicher Erkennungs-/Modellalgorithmus mit kontrollierten Probeantworten: erneuter Versuch nach Abbruch, verspätete Antwort, gemeinsame laufende Erkennung. |
| Neue Tests + vorhandene Modbus-Lese-/Berechtigungs-/Serial-/Mennekes-/SolaX-Prüfungen | Je **50/50 bestanden** auf Node.js 22 und 24 | Echte TCP-Transporte in den TCP-Fällen; Probe-/Register-/RTU-/ASCII-Tests mit kontrollierten Gegenstellen. Keine physische RS485-Hardware. |
| MENNEKES 6-A-Steuerung und SolaX Lese-/Schreibkadenz | **2/2 bestanden**, in den 50 Fällen enthalten | Bestehende Regressionen, kontrollierte Treiberantworten. |
| Syntax | Bestanden | `node --check modules/devices/lib/drivers/modbus.js`. |
| ESLint neuer Test | 0 Fehler, 0 Warnungen | Bestehendes Devices-Lintprofil. |
| ESLint gesamter alter Modbus-Treiber | Weiterhin 50 historische Fehler, keine neue Befundart/-anzahl | Vorher/Nachher jeweils 47 `no-empty`, 3 `no-unused-vars`. Der Treiber wird ausdrücklich nicht insgesamt als lintfehlerfrei ausgegeben. |

Rohbelege liegen unter `raw/device-lifecycle-*`; die separate Hashliste bindet diese Dateien. Der neue Test liegt unter `modules/devices/test/modbusConnectLifecycle.test.js` und wird durch den vorhandenen Module-Testglob berücksichtigt.

## Weitere geprüfte Grenzen

Die vorhandenen Korrekturen der Geräte-Startfrist, des kurzzeitigen Lease-Ablaufs, der SMA-Listener-/Shared-Hub-Wiederaufnahme und des SolaX-Optionalgruppen-Caches bleiben bestehen. Quellprüfung der betroffenen Übergänge und Regressionen ergab dort keinen zusätzlichen bestätigten Befund in diesem Teilauftrag. Eine vollständige Gerätefreigabe folgt daraus nicht: tatsächliche Hersteller-Firmware, Netzwerkverhalten, Multicast/IGMP und kontrollierter Anlagenbetrieb bleiben separat zu prüfen.
