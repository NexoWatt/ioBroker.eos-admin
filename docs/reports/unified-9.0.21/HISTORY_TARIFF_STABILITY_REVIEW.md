# Historien- und Tarifstabilität – 9.0.21

Stand: 24.11.2026. Differenzprüfung gegen die unveränderte Lieferung 9.0.20; keine Produktivverbindung und keine pauschale Produktions- oder CRA-Freigabe.

## Reproduzierte Befunde und Änderungen

| Kennung | Befund in 9.0.20 | Korrektur und Nachweis |
| --- | --- | --- |
| **921-HIS-001** | Nach einem ersten fehlgeschlagenen Tarifabruf umging `!_intervals.length` die berechnete Wiederholfrist. Die reproduzierte Folge mit 120 weiteren EMS-Ticks erzeugte 121 Abrufe und Warnungen statt eines Abrufs. | Ein leerer Cache darf die geplante Wiederholung nicht übergehen. Erstabruf und ausdrücklicher Konfigurationswechsel bleiben unmittelbar möglich. Während der Wartezeit bleiben Fehlerstatus, letzter Erfolg und unbekannter Preis wahrheitsgemäß. Der Test prüft 120 Ticks, die nächste Frist und die Erholung mit einem negativen Preis. |
| **921-HIS-002** | Der lokale Tarif-Modultick wartete direkt auf den entfernten HTTPS-Abruf. Bei ausbleibender Antwort blieb der Tick bis zum gesamten Netzwerkbudget offen; Stop und Quellwechsel hatten keinen eigenen Transportabbruch. | Höchstens ein Hintergrundabruf; der lokale Tick wartet nicht auf das Provider-Netzwerk. Stop und Quellwechsel widerrufen dessen Signal. Die Registry bricht den echten Antwortkörper ab und entfernt Elternlistener. Generationen, Preis-Lesesperre und Reihenfolge der Konfigurationsinvalidierung bleiben erhalten. Fehlgeschlagene Hintergrund-Publikation/Invalidierung bleibt sichtbar und verhindert neue Abrufe bis zur erfolgreichen DB-Bereinigung. |

Betroffen sind nur `tariff-provider.ts` und `tariff-provider-registry.ts` sowie die zugehörigen Tests. Keine Änderung an Gerätesollwerten, Speichergrenzen, Geräte-/EMS-Zuordnungen, ioBroker-Admin, Datenbankkonten oder gespeicherter Konfiguration. Provider-/Frischeeinstellungen und Viertelstundenreihen bleiben erhalten. Fehlende oder abgelaufene Preise bleiben `null`; ein echter Preis `0` beziehungsweise ein negativer Preis ist weiterhin gültig.

Der optionale interne Abbruchparameter von `fetchProvider` verändert bestehende Aufrufer ohne Signal nicht. Die bestehende 5-s-Gesamtdeadline einschließlich OAuth, DNS und Antwortkörper, Größenlimits, HTTPS-Pflicht, Zertifikatsprüfung und Redirect-Sperre werden nicht gelockert.

## 921-HIS-003 – zusammenhängende Influx-Störprüfung

Hier wurde **kein zusätzlicher Produktcodefehler** nachgewiesen. Die vier Influx-Quellmodule bleiben bytegleich zu 9.0.20. Derselbe neue Test läuft bereits auf der unveränderten Baseline erfolgreich:

- Ausbleibende Antworten mit 70 aktiven/gewarteten Leseaufträgen und 2.100 Messwerten: höchstens sechs Leser und ein Schreiber, insgesamt 2.000 gepufferte oder aktive Messpunkte, kontrollierte Zeitüberschreitung und vollständige Verlustzählung nach Stop.
- Acht aufeinanderfolgende HTTP-429-Schreibfehler ohne verborgene Wiederholungen; anschließende Erholung. Unabhängige Lesefehler bleiben nach erfolgreichem Schreiben sichtbar. Eine echte Null wird geschrieben; eine leere Historie bleibt leer.
- Zielwechsel bei einem aktiven Schreiber, einer aktiven Abfrage und 200 alten Messpunkten: alte Verbindungen schließen, alte Daten gelangen nicht in den neuen Bucket, Verlustzähler bleibt nachvollziehbar.
- Echter HTTPS-Loopback-Transport mit ausdrücklich vertrautem synthetischem Zertifikat: ein blockierter Schreiber wird bei begrenztem Drain abgebrochen; anschließend funktioniert derselbe Runtime-Typ nach Neukonfiguration wieder. Keine deaktivierte TLS-Prüfung.

## Ausgeführte Prüfungen

Linux, UID/GID 1000, Node.js **22.23.4** und **24.22.3**. Die Prüfungen verwenden synthetische Daten und keine Kundenzugangsdaten.

| Prüfung | Node 22 | Node 24 |
| --- | --- | --- |
| Acht Testdateien zu Tarif-Lebenszyklus, bestehender Kunden-/Viertelstundenlogik und Influx-Transport/-Runtime/-Sicherheit | 67 bestanden | 67 bestanden |
| `ui/scripts/verify-cra-tariff.cjs --source` | 23 bestanden | 23 bestanden |
| Baseline-Regression der drei ursprünglichen Tarif-Fehlerfälle | nicht erneut ausgeführt | 3 erwartete Fehler auf unverändertem 9.0.20 |
| Neue Influx-Störfolge auf unverändertem 9.0.20 | nicht erneut ausgeführt | 4 bestanden |

Die positiven Preis-Ergebnisprüfungen in zwei Bestandstestdateien warten nun ausdrücklich auf den gesonderten Hintergrundabruf. Tests für verspätete Antworten, Stop, verlorene DB-Schreibzugriffe und Quellwechsel behalten ihre fachlichen Zusicherungen. Die neue Blockierungsprüfung verlangt umgekehrt, dass der lokale Tick schon vor einer noch ausstehenden Providerantwort fertig wird.

Zusätzlich: Syntaxprüfung beider geänderter Tarifquellen und strikte Typprüfung des unveränderten Influx-Runtime-Moduls erfolgreich. ESLint mit empfohlenen Kontrollfluss-/Sicherheitsregeln findet **keine neuen Diagnosen**. Drei bestehende `no-empty`-Befunde in optionalen Diagnose-Catches des Tarifmoduls sind gegenüber 9.0.20 unverändert und werden im Vergleichsbeleg ausgewiesen, nicht als behoben ausgegeben.

**Typprüfungsgrenze:** Beide vorhandenen Tarifmodule enthalten bereits in 9.0.20 `@ts-nocheck`. Dieser Audit ist kein Nachweis vollständiger strikter Typprüfung dieser Altmodule. Die bestehende Typisierungsschuld bleibt offen; es wurden keine neuen Typ-Unterdrückungen hinzugefügt. Build-/Gesamt-Lint-/Paketfreigabe erfolgt im übergeordneten Release-Nachweis.

## Nachweise und verbleibende Grenzen

Befehle, echte Exitcodes, Laufzeiten und Loghashes: `raw/history/results-node22.json` und `raw/history/results-node24.json`. Quellhashes und ergänzende Prüfungen: `raw/history/source-evidence.json`; Vergleich vorhandener Lintbefunde: `raw/history/lint-baseline-comparison.json`. Die unveränderte 9.0.20-Baseline wird bei Gegenprüfungen über `EOS_AUDIT_SOURCE_ROOT` geladen, nicht überschrieben.

Die Influx-Gegenstellen sind echte lokale HTTP-/TLS-Sockets, führen aber **keinen Flux-Code** aus. Die zusätzliche Tarif-Abbruchprüfung verwendet einen realen HTTP-Antwortstrom hinter einer ausdrücklich simulierten HTTPS-Testadresse; das ist kein öffentlicher Provider-TLS-Test. Die bestehende Zertifikatsprüfung wird dadurch im Produkt nicht verändert. Erfolgreiche Tests ersetzen weder die Abnahme an Dominiques InfluxDB noch die erneute Funktionsprüfung von Tibber auf der Anlage. Ein Nutzerbericht „Influx läuft wieder“ ist kein selbst gemessener native-Inﬂux-Integrationsnachweis.

Für die Hausanlagenprobe: Nach normaler Verbindung müssen bestehende Historien lesbar und neue echte Messwerte vorhanden sein. Bei unterbrochener Historienverbindung müssen Diagnose/Verlustzähler nachvollziehbar bleiben, Geräte und lokales EMS weiterarbeiten und nach Wiederherstellung neue Messwerte wieder gespeichert werden. Bei Tarifausfall darf es keine Abruf-/Warnungsschleife geben; der letzte gültige Preis darf nur innerhalb seiner ursprünglichen Frischegrenze verwendet werden. Keine absichtlichen Störtests an einer produktiv regelnden Kundenanlage aus diesem Bericht ableiten.
