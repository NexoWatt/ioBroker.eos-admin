# PostgreSQL-Historie in EOS 9.0.22

Die lokale PostgreSQL-Historie ergänzt die vorhandenen Provider `adapter` und `influxdb2`. Bestandsanlagen behalten ihre gespeicherte Auswahl, Datenpunkt-IDs, Zeitreihen und Influx-Zugangsdaten. Es findet keine Datenkopie oder Löschung und keine ungefragte Umstellung statt. Ein bloßes npm-Installieren richtet keinen privilegierten Datenbankdienst ein.

## Auswahl und Einrichtung

Das getrennte EOS-Systemsetup richtet die lokale Umgebung für eine ausdrücklich ausgewählte Neuanlage ein. Die Laufzeit liest anschließend ausschließlich `/etc/nexowatt-eos/postgresql/client-eos-admin.<Instanz>.json` und die CA unter demselben geschützten Verzeichnis. Browser/API erhalten keine Datenbankzugänge und können weder Host noch Port, Dateipfade oder Rollen ändern.

Der Installer wählt „Neue Anlage mit PostgreSQL einrichten“. Der Server prüft die Neuanlagenberechtigung zusätzlich zur Oberfläche. Bereits gespeicherte Historien, vorhandene Historienadapter, nicht auflösbare Zustände oder eine erhaltene alte UI-Instanz verhindern eine automatische Umstellung. Ein gültiges, ausdrücklich als Neuanlage bereitgestelltes Systemprofil kann beim Betriebsstart übernommen werden. Hat EOS bereits eine leere Erstinitialisierung gespeichert, kann nur dieses geschützte Systemprofil die Neuanlagenfreigabe nachträglich belegen; vorhandene Historieneinstellungen und installierte Historienadapter bleiben Sperrgründe. Fehlendes Systemsetup wird als Fehler angezeigt und nicht durch eine Klartextverbindung ersetzt.

„Geschütztes Verbindungsprofil vorhanden“ bestätigt das geprüfte Systemprofil. „Verbindung prüfen“ führt eine TLS-Verbindung und eine lesende Schemaabfrage aus. Erst ein erfolgreicher regulärer Historien-Write bestätigt den Schreibbetrieb. Die bisherigen Exportintervalle bleiben erhalten; standardmäßig werden reguläre EOS-Verlaufswerte im Zehn-Minuten-Raster geschrieben.

## Daten- und Abfragevertrag

Die Aufzeichnung benutzt die vorhandenen, ausdrücklich registrierten EOS-Historien-States und deren Originalzeitstempel. Nur bestätigte, qualitativ gültige Werte werden übernommen. Ein unbestätigter Steuerwunsch wird nicht zu einem Messwert. Fehlende, ungültige oder ausgefallene Messungen erzeugen keine künstlichen Nullwerte. Zahl, Boolean und Text bleiben verschiedene Typen; Zahlen behalten negative Werte und echte Nullwerte.

Das Systemsetup besitzt das Schema `eos_history.samples`. Die Laufzeit verfügt über SELECT, INSERT und UPDATE für dieses Schema, nicht über CREATE, DROP, Systemverwaltung oder Benutzeranlage. Der Schlüssel ist `(id, ts)` mit Epoch-Millisekunden. Wiederholte Übertragung desselben Samples ist idempotent. Mehrere Updates derselben ID innerhalb derselben Millisekunde ergeben den zuletzt übergebenen Wert; alle Eingabewerte werden zuvor geprüft.

Die vorhandenen Diagramm-, SmartHome-, Ladebericht-, §14a- und Exportwege nutzen dieselbe Providerverzweigung. Numerische Aggregationen verwenden epochenausgerichtete Zeitfenster wie die vorhandene Influx-Abfrage. `minmax` verwendet die Grenzen des gewählten Bereichs und liefert echte Min-/Max-/Rand-Samples mit ihren tatsächlichen Zeitstempeln. Lücken bleiben ohne Punkte. Text wird in Rohabfragen unterstützt; `minmax` ist für Zahlen und Boolean vorgesehen.

## Schutz und Ausfallverhalten

- TCP ausschließlich `127.0.0.1:55432`; TLS mindestens 1.2, vertrauenswürdige CA und explizite Hostnamenprüfung `localhost`. Keine Option zum Abschalten der Zertifikatsprüfung, keine unverschlüsselte Ersatzverbindung.
- Geschützte Profil- und CA-Dateien: feste Pfade, root als Eigentümer, keine beschreibbaren Elternverzeichnisse oder Symlinks, keine Lesbarkeit der Zugangsdaten für sonstige Benutzer. Der Adapter läuft weiterhin als normaler Dienstbenutzer.
- Vier Poolverbindungen; höchstens drei parallele Historienabfragen aus der Laufzeit reservieren Platz für Writes. Höchstens 64 wartende Lesejobs, fünf Sekunden Gesamtdeadline, begrenzte Verbindungs- und SQL-Laufzeit. Ein abgelaufener aktiver Job verwirft seine Verbindung.
- Höchstens 2.000 gepufferte oder laufende Samples und 4 MiB, Batches höchstens 100 Samples und 256 KiB. PostgreSQL-Verbindungsfehler und Timeouts werden höchstens zweimal mit Abstand erneut versucht. Nicht wiederherstellbare Fehler und Überlauf erhöhen sichtbare Verlustzähler; kein unbegrenzter Speicher- oder Retryaufbau.
- Höchstens 60.000 Ergebniszeilen und 8 MiB je Abfrage. IDs, Werte und Zeitgrenzen werden als SQL-Parameter gebunden. Keine dynamischen Schema- oder Tabellenbezeichner aus Nutzereingaben.
- Ein begrenzter asynchroner Lesetest meldet fehlenden Datenbankzugriff bereits beim Konfigurieren, ohne auf den ersten Messwert zu warten. Die EMS-Regelung wartet nicht auf Datenbankantworten. Lese-, Schreib- und Profilfehler bleiben getrennt sichtbar. Nach Neustart ist der Arbeitsspeicherpuffer nicht wiederherstellbar; während eines längeren Datenbankausfalls können daher ausdrücklich gemeldete Historienlücken entstehen.

Die iobroker-Dienstgruppe kann das lokale Laufzeitprofil lesen. Andere Prozesse mit denselben weitreichenden Dienstrechten sind somit **keine** gegenüber dem Historian isolierte Sicherheitsdomäne. Gegenüber externen Netzwerkclients gelten TLS, lokale Bindung, SCRAM und getrennte Rollen. Root-/Betriebssystemadministratoren bleiben eine eigene Vertrauensgrenze.

## Sicherungsumfang

`getHistoryBackupRequirement()` liefert dem Backupmodul die aktive Provideridentität ohne Zugangsdaten. PostgreSQL benutzt den echten EOS-Hostnamespace, auch wenn eine Legacy-UI einen alten Namespace beibehält. Eine nicht auflösbare Historiendatenbank wird als `unknown` gemeldet und darf nicht als vollständige Sicherung ohne Datenbank gelten. Systemsetup, Datenbankbackup, Wiederherstellung und Zertifikatsrotation besitzen getrennte Nachweise; ein erfolgreicher Historien-Test allein ist keine vollständige Restore-Abnahme.

## Nachweise

Die gezielten Softwaretests stehen in:

- `test/eos-postgres-history.test.cjs`: Profil-/TLS-Konfiguration, SQL-Parameter, Werte, Dubletten, Deadlines, Verbindungsschluss, Queue-Retry, Überlaufgrenzen und reservierte Schreibkapazität.
- `test/eos-postgres-history-api.test.cjs`: tatsächliche authentifizierte Hosted-HTTP-Routen, Auswahl-/Persistenzgrenze, Erhalt von Geräte-/EMS-Einstellungen und vorhandenen Export-IDs; Transport bei erfolgreichen Saves simuliert.
- `test/eos-influx-history-runtime.test.cjs`, `test/eos-influx-history-api.test.cjs`, `test/eos-influx-hosted-module-history.test.cjs`: Regression der vorhandenen Influx-Wege.
- `test/eos-postgres-real-integration.cjs`: separater Integrationstest mit echter PostgreSQL-Gegenstelle, TLS-Negativfällen, SQL-Datentypen, Rollen, Fehlern und Datenbanksicherung. Umgebung und Ergebnis stehen im zugehörigen Prüfbericht; nicht mit einem realen Kundengerät gleichsetzen.

Strikte Typprüfung: `ui/tsconfig.postgres-history.json` und `ui/tsconfig.influx-history-runtime.json`. Typbasiertes Linting: `ui/eslint.postgres-history.config.mjs` und `ui/eslint.influx-history-runtime.config.mjs`.

Diese Beschreibung dokumentiert Implementierung und Prüfgrenzen. Sie ist keine CRA-Zertifizierung und keine pauschale Freigabe aller Bestandsanlagen.
