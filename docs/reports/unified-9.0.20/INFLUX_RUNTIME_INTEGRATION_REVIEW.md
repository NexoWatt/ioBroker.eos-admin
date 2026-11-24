# Direkte InfluxDB-2-Historie: Laufzeit und Konfiguration

Stand: 24.11.2026. Die Prüfung verwendet die produktive erzeugte EOS-Laufzeit, authentifizierte HTTP-Routen, synthetische ioBroker-Zustände und einen echten lokalen HTTP-Testserver. Eine Verbindung zum Kundenserver oder ein Test mit dessen Messdaten ist damit nicht nachgewiesen.

## Funktionsumfang

`history.provider` ist standardmäßig `adapter`. Vorhandene `history.instance`, Datenpunktzuordnungen, Exportintervalle, Geräte und EMS-Konfigurationen bleiben erhalten. Erst ausdrückliches Speichern von `influxdb2` aktiviert den direkten Client. Die direkte Integration benötigt einen vorhandenen InfluxDB-2-Server, Organisation, Bucket und passenden Token; sie installiert keinen Datenbankserver und erstellt/löscht keine Buckets.

Alle sechs tatsächlich ausführbaren `getHistory`-Aufrufstellen der Hauptlaufzeit verwenden nun `_nwDispatchHistory`: SmartHome-Historien, Energiehistorie einschließlich Zählerabfragen, Tarifberichte, Ladepunktberichte und interne Historienhilfen. Der Adaptermodus delegiert unverändert an `sendTo(instance, 'getHistory', ...)`. Der direkte Modus fragt dieselben Messungsnamen und Zeitbereiche über den begrenzten Influx-Transport ab. Bereits vorhandene fremde Messungen im gewählten Bucket können gelesen werden. Nicht registrierte fremde Geräte-/SmartHome-Datenpunkte werden durch diese Änderung nicht automatisch aufgezeichnet oder migriert.

Der Schreibumfang entspricht den bisherigen lokalen Aufrufen von `_nwEnsureInfluxCustom`: kanonische EOS-Historien, konfigurierte Ladepunkte/Verbraucher/Erzeuger, Tarifwerte, Energiezähler und registrierte EMS-Nachweiszustände. Die Registrierung ist eine begrenzte Positivliste. Nur erfolgreich abgeschlossene, bestätigte ioBroker-State-Schreibvorgänge mit gültigem Wert/Zeitpunkt gelangen in die Warteschlange. Fehlerhafte/abgelehnte Stell- oder State-Aufträge, unbekannte Datenpunkte und State-Echos erzeugen keine Historieneinträge. Originalzeitstempel, echte Nullwerte und negative Tarifpreise bleiben erhalten.

## Lebenszyklus und Grenzen

- Maximal 2.000 registrierte Ziele; Schreibpuffer einschließlich laufender Charge maximal 2.000 Punkte und 4 MiB.
- Eine laufende Schreibcharge mit maximal 100 Punkten/256 KiB; ein Transportversuch mit höchstens fünf Sekunden. Keine versteckten Wiederholungen nach Authentifizierungs-, Transport- oder Ratenfehlern.
- Maximal sechs parallele Leseabfragen und 64 wartende Leseabfragen. Wartedauer und Transport teilen einen fünfsekündigen Gesamtzeitraum; ein Transportplatz bleibt für den Schreiber frei.
- Normaler Shutdown sperrt neue Aufnahmen sofort und versucht vorhandene Schreibpunkte höchstens drei Sekunden lang abzuschließen. Danach werden Verbindungen geschlossen und nicht bestätigte Punkte gezählt. Dies bleibt innerhalb der bestehenden viersekündigen Hosted-Stop-Frist.
- Beim Konfigurationswechsel werden alte Verbindungen sofort abgebrochen und alte Aufträge durch ihre Generation eingezäunt. Kein alter Punkt wird an die neu ausgewählte Datenbank übertragen; späte Antworten können deren Erfolgsstatus nicht setzen.
- Der Puffer ist nicht dauerhaft. Überlauf, Datenbankausfälle, Prozessabbruch oder nicht rechtzeitig beendete Abschaltung können Historienpunkte verlieren. `droppedPoints`, `readError` und `writeError` machen diese Grenze sichtbar; die EMS-Regelung wartet nicht auf Datenbankantworten.
- Erfolgreiche Lese- und Schreibvorgänge korrigieren nur ihre jeweilige Fehlerspur. Ein Schreib-Erfolg überdeckt keine fehlenden Leserechte.

Speichern registriert die bestehenden Exportziele und löst anschließend den vorhandenen Export einmal asynchron aus. Dabei gelten dessen bisherigen Frischeprüfungen; es wird kein künstlicher Prüf-Messwert erzeugt. Danach gilt unverändert das konfigurierte Exportintervall (standardmäßig zehn Minuten).

## Installer-API und Geheimnisse

| Aufruf | Vertrag |
| --- | --- |
| `GET /api/installer/history` | `{ok, config, configurationRevision, status}`; `config` ist die redigierte History-Konfiguration. |
| `POST /api/installer/history` | `{history, expectedConfigurationRevision}`; vollständige aktuelle Revision erforderlich. |
| `POST /api/installer/history/check` | Optional `{history}` als noch nicht gespeicherter Kandidat; prüft Erreichbarkeit und Bucket-Leserecht, ohne zu speichern oder einen Schreib-Erfolg zu behaupten. |

Die bestehende zentrale Anmeldung, CSRF- und Lizenzgrenze gilt; zusätzlich verlangen die Endpunkte ausdrücklich Installer-/Administratorrolle. Speichern prüft Schreibbesitz und Shutdown vor und nach der Persistenz. Leere Tokenfelder erhalten ein vorhandenes Token nur bei gleicher normalisierter Origin; ein anderes Ziel verlangt ein neu angegebenes Token. CA-Felder bleiben bei leerer Eingabe erhalten und können ausdrücklich entfernt werden.

Token werden in `installer.configJson`, Benutzerbackup und Simulationsbackup nur in einem an den Verwendungszweck und die Ziel-Origin gebundenen, mit ioBroker verschlüsselten Umschlag abgelegt. Authentifizierte Backup-Exporte enthalten diesen wiederherstellbaren Umschlag; normale Antworten enthalten nur Merkmale wie `hasToken` und `hasCaCertificate`. Ein fremder Systemschlüssel oder manipuliertes Ziel isoliert ausschließlich die Historienverbindung, bewahrt den verschlüsselten Originalwert und alle übrigen Kundeneinstellungen und verlangt die erneute Token-Eingabe. History ist bei Backup-Merge atomar: ein fehlerhafter importierter Umschlag darf kein altes Klartexttoken erben.

EOS verändert beim Wechsel zum direkten Modus keine externen Adapterinstanzen und deaktiviert keine bestehenden `common.custom`-Historien. Für weiterhin konfigurierte ioBroker-Influx-Aufzeichnungen eigener EOS-Ziele meldet `legacyRecordingCount` eine mögliche Doppelaufzeichnung. Betriebsstatus und Zielbucket müssen vor einer bewussten Abschaltung dieser alten Aufzeichnung geprüft werden.

## Zusätzlich bestätigte Berichtsfehler

Der Ladepunktbericht konnte beliebig viele Tageszeilen anlegen und Datenbankfehler als erfolgreichen Bericht mit Nullverbrauch anzeigen. JSON und CSV prüfen jetzt vor Datenbankzugriff/Allokation auf höchstens 730 Kalendertage; fehlerhafte, umgekehrte oder größere Bereiche ergeben HTTP 400. Ein Datenbankfehler ergibt HTTP 503 statt einer erfundenen Nullverbrauchs-Auswertung. Die 730-Tage-Grenze berücksichtigt vollständige lokale Kalendertage einschließlich Sommerzeitwechseln.

Der §14a-Bericht unterschied Datenbankfehler und Zeitüberschreitungen ebenfalls nicht von einem leeren Ereignisbestand. Fehler, fehlgeschlagene Rückgaben und fehlerhafte Antwortformate ergeben nun HTTP 503; eine tatsächlich erfolgreich gelesene leere Historie bleibt ein gültiges Ergebnis. Ungültige, umgekehrte oder über 730 Tage lange Abfragezeiträume werden vor dem Datenbankzugriff mit HTTP 400 abgewiesen.

## Prüfbelege

- `test/eos-influx-history-runtime.test.cjs`: acht Fälle für Positivliste, Originalzeit/Null/Negativwerte, Batch-Vergiftung, Generationswechsel, Puffergrenze einschließlich laufender Writes, reservierte Schreibkapazität, getrennte Fehlererholung, begrenztes Entleeren und isolierten Schlüsselverlust.
- `test/eos-influx-history-api.test.cjs`: dreizehn reale HTTP-Routenfälle für Anmeldung/Rolle/CSRF/Besitz/Revision, verschlüsselte Persistenz, Blank-Token, Zielwechsel, echte Bucket-Prüfung, unveränderte Fremdaufzeichnungen, tatsächliche State-Schreibaufnahme einschließlich unveränderter ioBroker-Aufrufsignatur, Moduswechsel, Neustart ohne Überschreiben, Backup-Merge und Berichtsgrenzen/Fehler einschließlich §14a. Ein echter 80-Tage-Berichtsaufruf fordert mehr als 50.000 Punkte an; ein 100-Tage-Aufruf prüft die bestehende gröbere Aggregation und erhält eine bekannte Tagesenergie von 2,5 kWh.
- Separater unabhängiger Review prüft reale Tarif-/§14a-Modulschreiber einschließlich beibehaltenem `nexowatt-ui.0`-Namensraum. Transport-, TLS-, DNS-, Secret- und UI-Prüfungen werden in den zugehörigen Berichten ergänzt.

Die Prüfung bestätigt die genannten Softwaregrenzen. Sie ersetzt keine Prüfung der Bucket-Retention, Tokenrechte, TLS-Vertrauenskette und vorhandenen historischen Messungsnamen auf der Kundenanlage.

Bekannte bestehende Berichtsgrenze: Ladepunkt-Tagesenergie bevorzugt vorhandene Tages-/Gesamtenergiezähler. Fehlen solche Zähler, verwendet der ältere EVCS-Bericht weiterhin seine näherungsweise Leistungsintegration mit bisherigen Halteregeln zwischen Messpunkten; längere Messlücken können diese Schätzung verfälschen. Diese Änderung behauptet keine vollständig lückenbereinigte EVCS-Energiebilanz und verändert die Haltesemantik älterer `changesOnly`-Quellen nicht pauschal. Die oben geprüften 2,5 kWh stammen aus einem tatsächlich gelieferten Tageszählerwert.
