# Unabhängige Prüfung: direkte InfluxDB-2-Anbindung

Prüfgegenstand zunächst der isolierte neue Transport `ui/src-ts/runtime-executables/lib/influx-direct.ts` und seine Tests. Dieser Helfer war bei Beginn der Prüfung nicht in Runtime, Konfiguration oder Speicherung aktiviert. Eine gelungene Transportprüfung ist deshalb keine fertige Integration und kein Nachweis auf der Kunden-Datenbank.

## Erster Prüfstand: noch nicht freigegeben

Die vorhandenen zehn Loopback-HTTP-/HTTPS-Tests bestanden unabhängig unter Node.js 24.22.3. Folgende Grenzen wurden im Code nachvollzogen: keine Redirect-Verfolgung mit Token, keine Token-Ausgabe in Fehlern, TLS-Prüfung eingeschaltet, optionale explizite Zertifikatskette, begrenzte Antwort- und Batchgröße, acht gleichzeitige Requests, tatsächlicher Abbruch offener Requests beim Schließen. HTTP ist weiterhin eine mögliche explizite Verbindungskonfiguration; dies verschlüsselt den Token auf dem Übertragungsweg nicht. Die spätere Konfigurationsoberfläche muss HTTPS und vorhandene lokale Zertifikatsverwaltung konsistent nutzen; diese Oberfläche ist nicht Gegenstand dieses ersten Helferreviews.

### Reproduzierte Korrekturpunkte

| Eingabe | Erstes tatsächliches Ergebnis | Erwartete Grenze |
| --- | --- | --- |
| Zeitfeld `1` bei RFC3339-Annotation | Als Datum im Jahr 2001 akzeptiert | Format und Zeitzone tatsächlich validieren |
| Unbekannter Werttyp `evil` | Zahl 23 akzeptiert | Nur ausdrücklich unterstützte Datentypen |
| Zwei `_time`-Spalten | Letzte Spalte ausgewählt | Mehrdeutige Header ablehnen |
| `unsignedLong` 9007199254740993 | Gerundet zu 9007199254740992 | Verlustbehaftete Integer-Konvertierung ablehnen |
| Quoted leerer String bei String-Typ | Datensatz verschwindet; Schreiben von leerem String möglich | Unterstütztes Schreiben und Lesen konsistent behandeln |
| Messungsname `#comment` | Line-Protocol-Kommentar statt Datenpunkt | Kommentar-/reservierte Messungsnamen vor I/O ablehnen |

Rohreproduktion: `raw/independent-influx/parser-before.json`. Zusätzlich wurde festgestellt, dass die erste `query()`-Implementierung ihre CSV-Ausgabe mit dem allgemeinen 50.000-Zeilenlimit statt dem konkreten angeforderten Count/Limit prüft. Der spätere Integrationsvertrag muss außerdem tatsächliche Antwortzeitstempel gegenüber dem angeforderten Zeitbereich behandeln.

Das bestehende UI-Sicherheitsprofil mit ESLint 10.13.0 meldet zunächst eine neue `security/detect-unsafe-regex`-Fundstelle in der Decimal-Grammatik. Eine neue Inventar-Ausnahme wurde nicht zugelassen. Der Implementierer erhält die Befunde zur Korrektur mit gezielten negativen Regressionen.

## Offizielle Formatquellen

Geprüft am 24.11.2026:

- [InfluxDB 2: Annotated CSV](https://docs.influxdata.com/influxdb/v2/reference/syntax/annotated-csv/) beschreibt typisierte Spalten und RFC3339-Zeitwerte; ein Datenpunkt darf nicht allein durch permissives `Date.parse` oder fehlende Typannotation plausibel gemacht werden.
- [InfluxDB 2: Line Protocol](https://docs.influxdata.com/influxdb/v2/reference/syntax/line-protocol/) beschreibt Messungs-/Feldescaping und die Kommentarwirkung von `#` am Zeilenanfang. Die vorhandene Behandlung von Backslashes wurde damit abgeglichen und nicht als Fehler gewertet.

## Noch offene Abschlussprüfung

Korrigierte Parser-/Limit-/Deadlinefälle, strikte Typprüfung und Sicherheitslint sowie die spätere Runtime-/Konfigurations-/Token-Persistenzgrenze müssen vor einer Freigabe separat belegt werden. HTTP-Erreichbarkeit von Port 8086 allein bestätigt weder Leserechte für Organisation/Bucket noch Schreibrechte oder vollständige Historiendaten.


## Nachprüfung der reproduzierten Transportbefunde

Die oben dokumentierten sechs Parser-/Formatfälle wurden am 24.11.2026 unabhängig auf der tatsächlichen TypeScript-Quelle erneut unter Node.js 22.23.4 und 24.22.3 ausgeführt. Ungültige Zeitformate, unbekannte Typen, doppelte Zeitheader und nicht verlustfrei darstellbare Integer werden jetzt abgewiesen. Quoted leere Strings bleiben erhalten und können wieder gelesen werden; Kommentar-Messungsnamen werden vor dem Schreiben abgewiesen. Die konkreten Antworten und Quellenhashes stehen in `raw/independent-influx/parser-after-node22.*` und `parser-after-node24.*`. Dies sind gezielte Reproduktionen, kein zusätzlich behaupteter Hersteller-/Kundendatenbanktest.

Zusätzlich wurden drei vom Implementierungstest getrennte reale Loopback-HTTP-Fälle auf beiden Node-Versionen ausgeführt; jeweils **3 bestanden, 0 fehlgeschlagen, 0 übersprungen**:

- Eine abgebrochene/trunkierte CSV-Antwort wird als Fehler behandelt, nicht als scheinbar vollständige Kurve.
- Eine Antwort über 8 MiB beendet die Übertragung und gibt anschließend die Anfragekapazität für eine weitere Abfrage frei.
- Ein ausdrücklich durch den Test wiederholter Schreibauftrag behält exakt dieselben Messungen und Zeitstempel; echte Nullwerte und der konfigurierte URL-Präfix bleiben erhalten. Der Runtimepfad wiederholt fehlgeschlagene Writes dadurch nicht automatisch.

Rohbelege: `raw/independent-influx/transport-extra-node22.*` und `transport-extra-node24.*`. Es wurden ausschließlich synthetische Tokens und lokale Testserver verwendet, keine vorhandene Influx-Datenbank verändert.

## Integration und Sicherheitsgrenzen

Die nachfolgend implementierte Integration wurde zusätzlich im Quelltext gelesen: getrennte Installer-History-API mit bestehender Sitzungs-/CSRF-Grenze und Admin-/Installerrolle, explizite Revision beim Speichern, feste Einstellungsfelder, geschützte Tokenpersistenz und Rückfall auf den bisherigen Adaptermodus. Normale Konfigurationsansichten geben weder Klartexttoken noch verschlüsselten Token zurück. Authentifizierte Backups behalten die verschlüsselte Wiederherstellungsfassung. Bei fremdem/ungültigem Systemschlüssel wird nur die Historieverbindung gesperrt; die übrige Geräte-/EMS-Konfiguration bleibt bestehen. Ein Merge-Import behandelt den Historyblock atomar, damit ein quarantänisierter fremder Token nicht den alten Klartexttoken erbt.

Die direkte Verbindung prüft DNS-Adressen unmittelbar vor dem tatsächlichen Socketzugriff, verweigert Metadaten-/Link-local-/Multicastziele sowie öffentliches unverschlüsseltes HTTP und folgt keinen Redirects. HTTPS bleibt mit Zertifikatsprüfung aktiv; eine eigene CA muss ausdrücklich hinterlegt und syntaktisch geprüft werden. HTTP im lokalen Netz verschlüsselt den Token nicht. Der Vergleich bekannter Metadatenadressen ist keine Behauptung, jede denkbare private Infrastrukturadresse zu erkennen.

Der dedizierte Historybetrieb registriert begrenzt lokale EOS-Export-/Tarif-/Nachweiszustände. Die Netzwerkübertragung wird nach erfolgreichem ioBroker-State-Write asynchron ausgeführt; sie wird nicht als await in die Energieregelung eingebaut. Query-Warteschlange, Antwortgröße, Punktzahl und Laufzeit sind begrenzt. Normale Beendigung bekommt ein begrenztes Drain-Fenster; Umkonfiguration verwirft keine Punkte in einen neuen Zielbucket. Nicht geschriebene Punkte werden gezählt. Der Speicherpuffer ist nicht dauerhaft und ersetzt keinen ausfallsicheren Datenspool.

Ein erfolgreicher `/health`-Abruf beweist weiterhin weder Bucketrechte noch Messwertbestand. Der Verbindungstest liest den konkreten Bucket mit dem gewählten Token; er schreibt keine Probe. Schreibzugriff wird erst nach einer tatsächlich angenommenen Messwertschreibung angezeigt. Die Oberfläche trennt Entwurfsprüfung, gespeicherten Status, Lesen und Schreiben. Bereits für dieselben EOS-Zustände aktivierte ioBroker-Influx-Aufzeichnungen werden als möglicher paralleler Writer angezeigt, nicht still deaktiviert.

Die tatsächlichen Fokusprüfungen der Runtime-/API-Integration, des Installerformulars und der Crypto-/Netzgrenze stehen in den zugehörigen Influx-Berichten. Diese unabhängige statische Nachprüfung ersetzt sie nicht. Der abschließende produktive Build, Quell-/Artefaktsynchronität und vollständige Releaseprüfungen werden durch den Hauptprüfbericht an den ausgelieferten Stand gebunden.

## Verbleibende Inbetriebnahme

Auf der Kundenanlage bleiben die Prüfung von Organisation/Bucket/Token, ein neuer nachweislich gelesener und geschriebener EOS-Messwert, Wiederanlauf sowie eine Abfrage vorhandener Archivdaten erforderlich. Ein vorhandener Bucket beweist nicht, dass vor dem Löschen vorhandene Messwerte noch enthalten sind; diese Integration stellt gelöschte Punkte nicht wieder her. Fremde durch `common.custom` erfasste Datenpunkte werden nicht pauschal als neue direkte Aufzeichnung übernommen. Soll der bisherige Influx-Adapter weitere Datenpunkte protokollieren, ist diese Aufgabenteilung vor dem Abschalten zu prüfen. Die Datenbank selbst bleibt für die Influx-Historie erforderlich.

Die Aufbewahrungsdauer des vorhandenen Buckets wird nicht automatisch geändert; die nötige Retention für betriebliche Nachweise ist in InfluxDB gesondert zu prüfen.
