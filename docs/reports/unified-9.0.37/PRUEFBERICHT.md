# NexoWatt EOS 9.0.37 · Betriebsstatus und Speicherdiagnose

Ausgangspunkt der Korrektur ist die vollständige Repo-ZIP 9.0.36 mit SHA-256 `80fac105e950b78f0ed40a686146f49d9bbc0a90d6eebadaaef6d1cbfe684ef3`. Das vom Anwender installierte 9.0.35 wurde separat im Labor gestartet.

| Prüfung | Ergebnis |
|---|---|
| Vollständiges `npm test` unter Node.js 22.23.4 | 2.951 bestanden, 2 plattformabhängig übersprungen, 0 fehlgeschlagen |
| Vollständiges `npm test` unter Node.js 24.22.3 | 2.951 bestanden, 2 plattformabhängig übersprungen, 0 fehlgeschlagen |
| Typprüfung, Lint und Builds | Bestanden, 7 Lint-Warnungen im Gesamtprojekt |

## Dashboard

Im Labor lieferte das EMS eine gültige NVP-Bestätigung und die öffentliche Zustandsabfrage lieferte einen aktuellen Netzleistungswert. Die Bestätigung des EMS fehlte im Webdatenstrom von 9.0.35. In Chromium entstanden „Aktiv“, „Messung aktuell“ und „Betriebsstatus prüfen“ gleichzeitig. Im selben Browserfall mit nachgelieferter Bestätigung erschien „Alle Systeme normal“.

9.0.37 trennt die Bestätigung der Netzmessung vom numerischen Leistungswert. Die Anzeige benennt ausstehende, ungültige oder veraltete Rückmeldungen. Eine gültige Nullmessung ist zulässig. Echte Netzstörungen, ein gestopptes EMS, ein Sicherheitsstopp, bestätigte Geräteausfälle und Prozessfehler haben eigene Anzeigen.

Der tatsächliche EMS- und der Oberflächenprozess liefen im Test mit unterschiedlichen PIDs. Ein simulierter Netzbezug von 100 W mit gültiger Bestätigung erreichte in 9.0.37 den Kundenendpunkt und Chromium. Eine verschlechterte Messqualität führte zur Meldung „Netzmessung fehlt oder ist veraltet“. Nach einer gültig bestätigten Nullmessung erschien wieder „Alle Systeme normal“. Der ursprüngliche Zeitstempel, die ioBroker-Qualität und die Quittierung bleiben über den Prozesswechsel bis zum Browser erhalten.

[Wiedergabe des Dashboards aus 9.0.35](raw/dashboard-935-screenshot.json) · [Prozessübergreifende Prüfung auf Node 22 und 24](raw/ems-ui-nvp-integration.json)

## Speicherfarm

Die veröffentlichte Farmansicht 9.0.35 und ihre Live-Statusauswertung wurden mit denselben synthetischen Messwerten wie im Screenshot geprüft. Während der Sollwert und die übergebene Leistung bei 636 W und die Istleistung bei 576 W blieben, wechselte allein mit der bestätigten Netzmessung der Dashboardstatus zu Grün. Die Farm zeigte weiterhin „Status unbekannt“ und „Quelle unbekannt“. Diese Felder hatten eine zweite Ursache. Der Regler schrieb unveränderte Werte nur bei Änderung, während die Ansicht die letzte Einzelmeldung bereits nach 30 Sekunden als zu alt verwarf.

[Dokumentierter Ausgangsfall mit beiden Anzeigen](raw/farm-and-dashboard-935.json)

Die Farmanzeige verwendet die datierte Entscheidung des Reglers für Aktivzustand und Quelle. Der Vergleich einer Geräteleistung bezieht sich auf einen angenommenen Auftrag, dieselbe Gerätezuordnung, dieselbe physikalische Messgröße und eine frische, anschließend beobachtete Istleistung. Die Auswertung berücksichtigt das Vorzeichen. Die Warnschwelle ist strikt größer als 200 W. Die Wattzahl der Speicherfarm und die Banddifferenz am Netzverknüpfungspunkt lösen für sich keine Einzelgerätewarnung aus.

Der Browser zeigte im Kundenkonto bei 60 W und 200 W Abweichung den Normalstatus und bei 201 W den Namen des Speichers. Beim Rückgang von 201 auf genau 200 W verschwand die Warnung. Zwei Speicher mit gegenläufigen Abweichungen von jeweils 201 W blieben im Test getrennt erkennbar. Fehler der Netzmessung und bestätigte Geräteausfälle behielten ihre Priorität. Die Prüfung umfasste Deutsch, Englisch und Niederländisch. Die Monitoranzeige verwendet den vorhandenen Datenstrom. Das Energieflussbild behält seinen Zehn-Sekunden-Takt.

[Speicherwarnung im Kundenkonto mit HTTP und SSE](raw/speicher-warnschwelle-integration.json) · [Dashboard in Chromium für alle drei Sprachen](raw/dashboard-de-en-nl.json)

Ein zusätzlicher Test des produktiven Farmreglers hielt die Vorgabe über 100 Sekunden bei 600 W. Eine anschließende Istleistung von 300 W löste die Warnung aus. Der Test für FENECON Home verwendete das direkte ESS-Stellsignal und die unabhängige aktive AC-Leistung desselben Wechselrichters. 600 W am Sollpfad und 399 W am Istpfad ergaben die erwarteten 201 W Abweichung, während der Batteriefluss gleichzeitig −500 W betrug. Eine unquittierte AC-Probe hob die Vergleichbarkeit auf. [Vergleich am Regler und Ende einer Schreibphase](raw/farm-tracking-source-tests.log)

## Benachrichtigungen und Abhängigkeiten

Bei eingeschalteten Systembenachrichtigungen übernimmt der vorhandene Maildienst den geprüften Vergleich je Speicher. Für die Leistungswarnung gilt der normale Sammelversand. Ungültige oder fehlende Messwerte können eine aktive Warnung nicht als behoben quittieren. Ein bestätigter Geräteausfall behält seine eigene Meldung. Die Prüfungen liefen mit einem lokalen SMTP-Empfänger.

Die Prüfung der Produktionsabhängigkeiten meldete zwei moderate Einträge in der Abhängigkeitskette von `ocpp-rpc` und `ajv`. Der Bericht enthält keine hohen oder kritischen Einträge. [npm-Prüfbericht](raw/npm-runtime-audit.json)

## Ressourcen der Statusanzeige

Die Auswertung nutzt den vorhandenen Datenstrom und die vorhandenen Aktualisierungen. Im isolierten Linux/x64-Test verarbeitete der ausgelieferte Statuscode 3.000 synthetische Datenstände mit je 128 Speichern und drei Auswertungen pro Stand. Über sechs Messpunkte nach der Speicherbereinigung lag der belegte JavaScript-Heap des Testprozesses unter Node 22 zwischen 6,25 und 6,34 MiB und unter Node 24 zwischen 7,05 und 7,07 MiB. Diese Zahlen beschreiben nur den Testprozess für die Statusentscheidung. Der Gesamt-RAM-Bedarf im realen Anlagenbetrieb auf dem Raspberry Pi ist offen.

[Messreihe Node 22](raw/storage-display-memory-node22.json) · [Messreihe Node 24](raw/storage-display-memory-node24.json) · [Messprogramm](raw/measure-storage-display.cjs)

Der SSE-Regressionstest bestätigte in 9.0.35 und 9.0.37, dass EOS bei einem blockierten Browser weitere Meldungen zusammenfasst, bei wieder frei werdendem Puffer synchronisiert und eine dauerhaft blockierte Verbindung gezielt schließt. Der Test prüfte auch, dass andere gesunde Verbindungen bestehen bleiben. [Prüfung des Sendepuffers 9.0.35](raw/sse-backpressure-9.0.35.log) · [Prüfung 9.0.37](raw/sse-backpressure-9.0.37.log)

## Plattformprüfungen

Im ersten Parallellauf beider Node-Versionen überschritten zwei Node-22-Tests ihre internen Zeitgrenzen. Betroffen waren der Start von drei Geräteprofilen mit ausstehenden Erstantworten und der Wiederanlauf des EMS nach einem Prozessabbruch. Bei der separaten Wiederholung bestanden beide mit unveränderten Zeitgrenzen. Die Laufzeit allein liefert keine garantierte Startzeit für eine Kundenanlage. [Zeitmessungen der zwei Starttests](raw/node22-startzeiten.json)

Unter Node 22 und 24 liefen alle 14 Prüfungen des Lizenzspeichers mit geerbten POSIX-ACLs auf einem ACL-fähigen Dateisystem erfolgreich. nginx 1.26.3 akzeptierte die generierte Konfiguration im lokalen Test und reichte einen HTTPS-Abruf über einen zertifikatsgeprüften TLS-Upstream auf Port 8188 durch. Die öffentlichen Listen-Adressen waren für den unprivilegierten Test an freie lokale Ports gebunden. Die Prüfung an Port 443 der Zielanlage steht aus. [ACL Node 22](raw/platform-acl-node22.log) · [ACL Node 24](raw/platform-acl-node24.log) · [HTTPS Node 22](raw/platform-nginx-node22.json) · [HTTPS Node 24](raw/platform-nginx-node24.json)

## Vor-Ort-Prüfung

Die Prüfungen verwenden synthetische Zustände, lokale Gegenstellen und ausgelieferte Software unter Linux/x64. Für die vorhandenen Geräte und die ioBroker-Instanz des Anwenders liegen die beiden Bildschirmfotos vor. Eine Messung auf dessen Raspberry Pi sowie eine physische Rückmeldung der beiden tatsächlichen Wechselrichter stehen aus.

[Installations- und Bedienhinweise](../../start/START_HIER_9.0.37.md) · [Auswertung](PRUEFERGEBNISSE.json) · [Rohbelege](raw/INDEX.json)
