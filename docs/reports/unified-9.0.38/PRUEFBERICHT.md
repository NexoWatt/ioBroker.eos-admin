# EOS 9.0.38 · Bestandsübernahme und Historienzugriff

| Prüfung | Ergebnis |
|---|---|
| Vollständiges `npm test` unter Node.js 22.23.4 | 2.971 bestanden, 2 plattformabhängig übersprungen, 0 fehlgeschlagen |
| Vollständiges `npm test` unter Node.js 24.22.3 | 2.971 bestanden, 2 plattformabhängig übersprungen, 0 fehlgeschlagen |
| Typprüfung, Lint und Builds | Bestanden, 7 Lint-Warnungen im Gesamtprojekt |

Die zwei plattformabhängigen Fälle im Hauptlauf betreffen das nginx-Programm und geerbte POSIX-Dateirechte. Beide wurden mit den benötigten Werkzeugen auf Node 22 und 24 separat erfolgreich ausgeführt. [nginx](raw/platform-nginx-node24.json) · [POSIX-ACL](raw/platform-acl-node24.log)

## Ausgangsfehler und Gerätebetrieb

Mit deaktivierter `nexowatt-ui.0` (1.0.35) und `nexowatt-devices.0` (0.5.172) liefert der ausgelieferte Migrationskoordinator von EOS 9.0.36 im Labortest `BLOCKED / EOS_MIGRATION_SOURCE_VERSION`. Die Leseansicht bleibt erreichbar. Die Quellobjekte sind weiterhin vorhanden und abgeschaltet.

Der Upgrade-Test startet auf demselben nachgebildeten ioBroker-Bestand anschließend den neuen Adapter. Die integrierten Prozesse lesen die bestehende Anlagenkonfiguration. Die Gerätekonfiguration im ursprünglichen Format `devicesJson` überlebt die leere zweite Liste `devices`. Nach Freigabe des integrierten Gerätemoduls und einem weiteren EOS-Neustart erscheint ein neuer Messwert von 1.386 W unter derselben Geräte-ID. Die Messung kommt von einer lokalen Modbus-TCP-Gegenstelle. Der Test prüft außerdem den Alias, die InfluxDB-Aufzeichnung am Objekt, Tibber als gespeicherten Anbieter und unveränderte Altinstanzen. Der Übergang reaktiviert keine Altinstanz. Es wurden keine Modbus-Schreibbefehle aufgezeichnet.

[Upgrade 9.0.36 unter Node 22](raw/field-upgrade-936-node22.log) · [Upgrade unter Node 24](raw/field-upgrade-936-node24.log)

Der Katalogabgleich mit dem Quellpaket Devices 0.5.172 fand alle 195 Vorlagen-IDs und alle bisherigen Datenpunkt-IDs im Zielkatalog. Bei 194 Vorlagen ist die Definition identisch. Das im zusammengeführten Paket enthaltene FENECON-Home-Profil hat 73 statt 55 Datenpunkte. Drei Sollwertregister sind im Ziel als reine Schreibregister definiert. Der Katalogvergleich ermittelt IDs, Adressen und Protokolle. Die physische Funktion jedes dieser Modelle ist damit nicht geprüft. [Katalog- und Schnittstellenvergleich](raw/legacy-template-interfaces.json)

## Bestandsübernahme im Admin

Der neue Start ist eine eigene Administratoraktion. EOS prüft die aktuellen Quellen und die Revision der angezeigten Übernahme. Ein erneuter Klick während des laufenden Auftrags startet keine zweite Übergabe. Bei ausstehender Serverbestätigung fordert die Oberfläche den aktuellen Status an, bevor ein Installateur einen neuen Auftrag auslösen kann. Die installierten Quellobjekte bleiben für Vorprüfung, Abnahme und einen möglichen Rückfall verfügbar. Kann EOS ein Geräteprofil oder Konfigurationsformat nicht interpretieren, bleibt der betreffende Wechsel gesperrt. Das gilt auch bei einer eigenen Zähler- oder Historienzuordnung im EOS-Ziel. Ein unverändertes, von der Oberfläche angelegtes Standardgerüst darf den Übergang zulassen. Nach dem Anhalten prüft EOS die maßgeblichen Einstellungen erneut, um zwischenzeitliche Änderungen zu erkennen. Die Tests decken beide Fälle ab.

Im Test einer zuvor blockierten Übergabe wechselten die GUI-, EMS- und Geräteprozesse auf die Altzuordnungen. Der EOS-Admin blieb währenddessen erreichbar. Nach dem Start antwortete der lokale Modbus-TCP-Zähler unter seiner bisherigen Datenpunkt-ID mit 1.847 W. Die Tibber-Zuordnung blieb erhalten. Die protokollierte Übergabe ergab keine überlappenden Schreibzuständigkeiten. [Prozesswechsel unter Node 22](raw/migration-live-children-node22.log) · [Prozesswechsel unter Node 24](raw/migration-live-children-node24.log)

[Bedienprüfung in Chromium unter Node 22](raw/migration-admin-browser-node22.log) · [Node 24](raw/migration-admin-browser-node24.log)

## Vorhandene Zielkanäle

Der erste Node-22-Gesamtlauf fand einen Fall, den die fokussierten Tests übersehen hatten. Ein vom Installateur benannter, noch leerer `eos-admin.0.energyFlow`-Kanal konnte als Standardgerüst gelten. Die Übernahme war damit trotz vorhandener Zielstruktur möglich. Die Korrektur erkennt einen neutralen Platzhalter anhand der im Produkt belegten Kanaldefinition und des Urhebers. Der Kundenkanal aus dem bestehenden Regressionstest sperrt die Übergabe bereits vor dem ersten Quellstopp. Für den gemeldeten Upgradefall wurde geprüft, dass die in 9.0.36 erzeugten Standardobjekte durch diese Prüfung kommen.

## Historiker und §14a-Nachweise

Die Routinen zur Zuordnung der historischen Datenpunkte wurden mit dem ursprünglichen npm-Paket `iobroker.nexowatt-ui@1.0.35` verglichen. Sie bilden dieselben kanonischen IDs und Abfragekandidaten. Auf einer Bestandsanlage können dies auch Datenpunkte außerhalb des EOS-Namensraums oder abweichende Zuordnungen sein.

Für die Datenbankprüfung standen die originalen npm-Pakete der beiden Altadapter zur Verfügung. In einer lokalen InfluxDB 2.7.12 wurden vor der Übernahme 1.731 W PV-Leistung und 642 W Hauslast unter den bisherigen Serien gespeichert. Die Gerätezuordnung der Hauslast verwendet einen Influx-Alias. Während der Abfrage waren die aktuellen ioBroker-Zustände leer. Der HTTP-Endpunkt des Dashboards lieferte trotzdem beide historischen Werte über `influxdb.1` und den produktiven `getHistoryV2`-Lesepfad von ioBroker.influxdb 5.5.1. Die Abfrage gelang nach der Übernahme und erneut nach dem Neustart. Anschließend aktualisierte der Historienpublisher des neuen EOS die PV-Leistung auf 1.902 W unter der bisherigen Serien-ID. Der Test simuliert die ioBroker-Zustandsereignisse und verwendet den Influx-Schreibpfad und den Datenbankserver. Eine unabhängige Abfrage der Rohdaten nach dem getesteten Rückfall bestätigte die ursprünglichen Werte und Zeitstempel sowie die neue Probe in derselben Zeitreihe.

[InfluxDB-Test mit altem PV-Datenpunkt und Gerätealias](raw/legacy-history-real-influx.log) · [Originalpakete, Versionen und Prüfpfad](raw/legacy-historian-provenance.json)

Eine zweite Korrektur betrifft die Aufzeichnung der §14a-Nachweise. Im Labor wählte EOS 9.0.37 bei vorübergehend unlesbarer `influxdb.4` die außerdem vorhandene `influxdb.0`. Der übernommene Betrieb in 9.0.38 hält die eingestellte Instanz fest. Bei der erneuten Einrichtung nach ihrer Rückkehr werden die ursprünglichen Aufzeichnungen wieder derselben Instanz zugeordnet. Das unterstützt Anlagen mit mehreren Historikern.

[Vergleich der ursprünglichen Historienzuordnungen](raw/legacy-history-source-comparison.json) · [Fehler im Vorgänger](raw/legacy-history-misbinding-937.log) · [Historien- und Providerprüfungen](raw/legacy-history-providers-node24.log)

## Umfang und offene Feldabnahme

Die Softwaretests verwenden die ausgelieferten Prozesse, synthetische Anlagenkonfigurationen und lokale Gegenstellen. Für die Kundenanlage liegen die Quellversionen, der Typ der Historienablage und das Bildschirmfoto der Vorprüfung vor. Die konkreten Zeitreihen, das Feldgerät und der Raspberry Pi des Kunden stehen für eine Messung hier nicht zur Verfügung. Vor Ort sind ein älterer Zeitraum und ein neuer Messwert über die Übergabe hinweg zu prüfen. Eine vorhandene InfluxDB-Sicherung bleibt für schon zuvor gelöschte Daten erforderlich.

Die Prüfung der Produktionsabhängigkeiten meldete zwei moderate Einträge aus derselben Abhängigkeitskette (`ocpp-rpc` und `ajv`), keine hohen oder kritischen. Das Gesamtsystem wurde in dieser Änderung auf dem Kunden-Pi nicht vermessen. Die Datenhistorie wird im normalen Übernahmefall unter ihren bisherigen IDs weiterverwendet, ohne ein zusätzliches Komplettarchiv im Arbeitsspeicher aufzubauen.

[Bedienung und Feldabnahme](../../start/START_HIER_9.0.38.md) · [Alle Testergebnisse](PRUEFERGEBNISSE.json) · [Rohbelege](raw/INDEX.json) · [Abhängigkeitsbericht](raw/npm-runtime-audit.json)
