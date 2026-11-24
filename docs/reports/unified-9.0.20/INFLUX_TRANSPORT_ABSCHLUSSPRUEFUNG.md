# InfluxDB-2-Transport: Abschlussprüfung 9.0.20

Stand: 2026-11-24T20:48:03.143315+00:00. Geprüfter Testkandidat; keine allgemeine Produktiv- oder Hardwarefreigabe.

## Anlass und tatsächliche Korrekturen

Der Nutzer meldet einen erreichbaren InfluxDB-2.7.5-Server, aber einen fehlgeschlagenen Organisations-/Token-Test im bisherigen ioBroker-InfluxDB-Adapter. Der neue direkte Transport benötigt einen vorhandenen Bucket mit passenden Lese-/Schreibrechten; er erstellt oder löscht weder Datenbanken noch Organisationen und enumeriert keine Organisationen oder Benutzer. Ein erfolgreicher Health-Aufruf allein gilt ausdrücklich nicht als erfolgreiche Historienanbindung.

- Der lesende Verbindungstest führt nach Health eine Abfrage im konfigurierten Bucket aus. Er entfernt heterogene Wertspalten vor dem globalen Gruppieren und begrenzt das Ergebnis danach auf eine Zeile. Dadurch entsteht weder ein Typkonflikt zwischen verschiedenen Messreihen noch eine Zeile pro Serie. Der Test schreibt nichts; `writeVerified` bleibt falsch.
- Die Konfigurationsgrenze akzeptiert `unknown`, prüft die eigenen Pflichtfelder und erzeugt erst daraus die typisierte Konfiguration. Ein vorher erforderlicher doppelter Typcast in der verschlüsselten Wiederherstellung kann entfallen.
- Der tatsächliche SmartHome-Aufrufer verlangt `aggregate: minmax`, auch für boolesche Zustände. Die erste direkte Implementierung lehnte diese Option ab. Der Transport erzeugt jetzt begrenzte Zeitfenster auf dem Server und wählt erste/letzte Werte sowie nach Wert sortierte erste/letzte Werte aus. Die Antwort behält echte Messzeitstempel und Werte; keine Mittelwerte, künstlichen Nullen oder neuen Zeitstempel.
- Für boolesche Messungen werden bewusst keine Flux-`min()`-/`max()`-Selektoren verwendet: Der offizielle Flux-Code unterstützt dort keine booleschen Selektoren, sein Sortiervergleich dagegen schon. Die zuerst erwogene Begrenzung eines Rohdaten-Präfixes wurde nicht übernommen; ein normaler dichter Tagesverlauf darf nicht wegen 50.000 Rohmessungen unvollständig erscheinen oder abgelehnt werden.
- Beim SmartHome-Pfad bleibt `count` wirksam, wenn der Host zusätzlich ein höheres `limit` übergibt. Pro Fenster sind höchstens vier Originalmessungen vorgesehen; bei zwei oder drei gewünschten Punkten die globalen Extremwerte. Die gesamte Antwort ist auf das kleinere erlaubte Count/Limit beschränkt. Unpassend feine explizite Fenster werden abgelehnt, statt nur den Anfang des Verlaufs zurückzugeben.
- Das globale Antwortlimit ist mit dem bestehenden Lade-Historienvertrag auf 60.000 Zeilen abgestimmt. Exakt 60.000 werden akzeptiert; 60.001 werden vor I/O bzw. beim Parser abgewiesen. Niedrigere angeforderte Limits bleiben verbindlich.
- HTTPS erzwingt mindestens TLS 1.2 und prüft Zertifikat sowie Hostnamen. Eine explizit gespeicherte CA ergänzt den vorgesehenen Vertrauenspfad; es gibt keinen TLS-Abschalter.

## Transportgrenzen und Funktionserhalt

Bestehende Messungsnamen und das Feld `value` werden für Lesen und Schreiben beibehalten. Zahl, Boolean und String sind bei Rohwerten unterstützt, einschließlich echter Nullwerte, negativer Preise und leerer Strings. SmartHome-Minmax ist auf numerische/boolesche Messungen begrenzt. Leere Intervalle bleiben leer. Überlange, ungültige, widersprüchlich annotierte oder außerhalb des angefragten Zeitraums liegende Antworten werden abgewiesen.

Das Gesamtlaufzeitbudget beträgt höchstens 5 Sekunden einschließlich DNS, TCP, TLS, Health und Folgeabfrage. Weiterleitungen werden nicht verfolgt; ein Token wird weder in URLs noch in Fehlerausgaben aufgenommen. Der Transport begrenzt parallele Anfragen, Antwortgrößen, Zeilen, Schreibpakete und aufgelöste DNS-Adressen. Die für die jeweilige Socket-Verbindung tatsächlich zurückgegebenen Adressen werden geprüft. Die Netzrichtlinie lässt bewusst lokale Datenbanken zu und verbietet Metadaten-/Linklocal-Ziele; HTTP bleibt auf zulässige lokale Adressen beschränkt.

## Ausgeführte Prüfungen

Umgebung: Linux, unprivilegierte UID/GID 1000; Node.js 24.22.3 sowie 22.23.4. Reale HTTP-/HTTPS-Loopback-Verbindungen mit synthetischen Gegenstellen; keine Produktivzugangsdaten.

| Prüfung | Ergebnis |
| --- | --- |
| `node --test test/eos-influx-direct.test.cjs` unter Node 24 | 18 bestanden, 0 fehlgeschlagen, 0 übersprungen |
| Derselbe Testlauf unter Node 22 | 18 bestanden, 0 fehlgeschlagen, 0 übersprungen |
| Strikte TypeScript-Prüfung `ui/tsconfig.influx-direct.json`, Node 24 und 22 | beide Exit 0 |
| Typinformiertes ESLint `ui/eslint.influx-direct.config.mjs` | Exit 0 |

Geprüft werden erfolgreicher Health-/Bucket-Lesezugriff, fehlende Berechtigung ohne Token-Ausgabe, echte HTTP-204-Schreibbestätigung, Redirect-/429-Fehler, ungültige Konfiguration und CA, Flux-/Zeilenescaping, CSV-Typen und Zeitstempel, leere Strings, negative Preise, Größen-/Zeilen-/Zeitbereichsgrenzen, gesamte Deadline einschließlich verspäteter DNS-Auflösung, Abbruch/Parallelität, DNS-Rebinding und reale TLS-Vertrauensprüfung. Die ergänzten SmartHome-Fälle prüfen Count/Limit, Originalzeitstempel, boolesche Werte, serverseitig begrenzte Fenster für dichte Tagesverläufe und übergroße Antworten.

Befehle, Zeiten, Exitcodes und Loghashes: `raw/influx-transport-final/`. Jeder dortige Ergebnisbeleg bezieht sich auf seinen tatsächlich ausgeführten Befehl.

## Quellbezug

| Datei | SHA-256 |
| --- | --- |
| `ui/src-ts/runtime-executables/lib/influx-direct.ts` | `f9378b74a08776253a63ccca58ba50b6ec74c88f07ad934caf921f732537bfc8` |
| `test/eos-influx-direct.test.cjs` | `3f20a75612349776d8990ff4b5a51d20c4f3d9cb8f282c8919a474f82eb96669` |

## Grenzen und noch notwendige Nachweise

Ein echter InfluxDB-/Flux-Server steht in dieser Testumgebung nicht bereit. Die Loopback-Gegenstellen führen keinen Flux-Code aus; die Abfragestruktur wurde anhand offizieller Dokumentation und Primärquellen geprüft. Aus diesen Tests folgt keine bereits bestandene Abnahme an Dominiques InfluxDB 2.7.5 oder an Herstellerhardware. Der spätere Test auf der Anlage muss vorhandene Historien, neu geschriebene Messwerte sowie numerische/boolesche SmartHome-Verläufe prüfen.

Dieser Bericht bewertet den Transport. Token-Persistenz, API-Rechte, Runtime-Warteschlangen, Abschaltung, Konfigurationswechsel und Bedienoberfläche benötigen ihre gesonderten Integrationsnachweise. Vorhandene bzw. gelöschte Alt-Messwerte wurden nicht überprüft; ein vorhandener Bucket allein beweist keinen vollständigen Datenbestand.

## Geprüfte Primärquellen

- [Flux keep](https://docs.influxdata.com/flux/v0/stdlib/universe/keep/), [group](https://docs.influxdata.com/flux/v0/stdlib/universe/group/), [window](https://docs.influxdata.com/flux/v0/stdlib/universe/window/) und [sort](https://docs.influxdata.com/flux/v0/stdlib/universe/sort/), abgerufen am 24.11.2026.
- [Offizieller Flux-Min-Selektor](https://github.com/influxdata/flux/blob/master/stdlib/universe/min.go) und [typisierte Sortiervergleiche](https://github.com/influxdata/flux/blob/master/internal/arrowutil/compare.gen.go), abgerufen am 24.11.2026.
- [ioBroker.influxdb 5.1.8: Historienaufruf](https://github.com/ioBroker/ioBroker.influxdb/blob/v5.1.8/src/main.ts) und [2.x-Datenformat/Zugriff](https://github.com/ioBroker/ioBroker.influxdb/blob/v5.1.8/src/lib/DatabaseInfluxDB2x.ts), abgerufen am 24.11.2026. Der bisherige Minmax-Pfad liest Rohwerte und übergibt sie an seine Aggregationsbibliothek; die neue Umsetzung erhält Extremwerte innerhalb der begrenzten EOS-Antwort und ist keine vollständige Nachbildung sämtlicher optionaler ioBroker-History-Parameter.
