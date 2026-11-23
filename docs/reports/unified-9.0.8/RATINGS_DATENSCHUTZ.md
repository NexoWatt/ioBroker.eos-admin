# Optionale Adapterbewertungen: Datenschutzprüfung 9.0.8

Stand: 23.11.2026. Quellreview und gezielte Regressionstests; keine Aussage über sämtliche Netzwerkfunktionen des Gesamtsystems.

## Produktverhalten

`eosExternalRatings` ist standardmäßig `false`. Die Admin-Checkbox nennt sowohl die Übermittlung der System-UUID als auch `rating.iobroker.net`. `initSocket` überspringt ohne ausdrücklichen Boolean `true` den Bewertungsabruf vollständig.

Zusätzlich prüft `EosSocketAdmin` die aktuelle Einstellung am gemeinsamen `SocketCommandsAdmin.updateRatings`-Einstieg. In der festgelegten `@iobroker/socket-classes`-Version 2.10.0 verwenden sowohl der öffentliche Methodenaufruf als auch das tatsächliche `getRatings`-RPC diesen Einstieg. Dadurch wird ohne Aktivierung schon das Lesen von `system.meta.uuid` verhindert. Auch die Werte `"true"` oder `1` aktivieren die Funktion nicht. Die Adapter-Fassade liefert die aktuelle Konfiguration; der Wrapper hält keinen veralteten Kopierstand der Zustimmung.

Bei ausdrücklicher Aktivierung bleibt die vorhandene Upstream-Funktion nutzbar. Ein späteres Ausschalten oder `close()` verhindert neue Abrufe über den geprüften Einstieg. Die vorhandenen Sitzungs- und Befehlsrechte werden nicht ersetzt oder abgeschwächt.

## Ausgeführt

```sh
node --test test/eos-unified-ratings-privacy.test.cjs test/eos-unified-loopback-fixture.test.cjs
EOS_TEST_RUNTIME=build node --test test/eos-unified-ratings-privacy.test.cjs
```

Ergebnis des Reviewlaufs: **10/10 Tests bestanden** für Quell-/RPC-/Startpfad und Testnetzwerkgrenze sowie **4/4 Tests bestanden** mit dem gebauten `EosSocketAdmin`. Der tatsächliche `initSocket`-Methodentext wurde mit Testverdrahtung ausgeführt. Die Upstream-Bewertungsabfrage wurde ausschließlich durch einen lokalen Axios-Stub beantwortet; kein Test kontaktierte den Bewertungsdienst.

Die Tests prüfen fehlende/false/nichtboolesche Aktivierung, direkte Aufrufe, das reale RPC-Kommando, ausdrückliches Einschalten, spätere Abschaltung, geschlossenen Socket und die verständliche Standardeinstellung. Das ist kein Mitschnitt eines vollständigen Kundenbetriebs.

## Übernommene Upstream-Grenzen

- Nach Aktivierung nutzt der unveränderte Upstream-Abruf ein Axios-Timeout von **15 Sekunden**. Er bietet in diesem Stand keine nachgewiesene harte EOS-Gesamtdeadline von fünf Sekunden einschließlich aller Phasen.
- Eine bereits gestartete, zuvor ausdrücklich erlaubte Anfrage wird bei Ausschalten oder Socket-Schließung nicht aktiv abgebrochen. Die neue Prüfung gilt beim Einstieg eines Abrufs.
- Bereits erhaltene Bewertungen einschließlich der im Upstream-Cache ergänzten UUID können lokal weiterhin als RPC-Antwort geliefert werden. Ausschalten löscht diesen Cache nicht rückwirkend und widerruft keine zuvor erfolgte Übermittlung.
- Der Upstream liest die UUID vor seinem eigenen Netzwerk-`try`-Block. Ein Datenbankfehler kann deshalb zurückgewiesen werden; der Startpfad fängt diese Promise ab. Das ältere RPC behandelt diesen Sonderfall nicht mit derselben separaten Fehlerbehandlung. Ohne Aktivierung wird dieser Weg nicht betreten.
- Andere externe ioBroker-/Adapterfunktionen wurden durch diese Änderung nicht als vollständig unterbunden oder auditiert ausgewiesen. Nach einem Wechsel von `socket-classes` muss die gemeinsame Kommandoanbindung erneut geprüft werden.

## Ausschließlich für Tests verwendete Netzwerkgrenze

`test/fixtures/loopback-network.cjs` verlangt ausdrücklich `EOS_TEST_NETWORK_FIXTURE=loopback`. Die Egress-Prüfung wird nur für den erwarteten installierten EOS-Einstieg `node_modules/iobroker.eos-admin/build/main.js` aktiviert. npm und die Vorbereitung des Testcontrollers dürfen weiterhin die geprüften Abhängigkeiten beziehen.

Der Prüfer begrenzt die erfassten Node-Wege HTTP/HTTPS, TCP, TLS, `dns.lookup` und `fetch` auf den lokalen Testbetrieb. Er verhindert auch die geprüften absoluten Proxy-Ziele und CONNECT-Tunnel, bevor der entsprechende Transport aufgerufen wird. Fehler enthalten nur einen festen Code. Ein realer HTTP-Austausch auf Loopback wurde im Kindprozess nachgewiesen.

Dies ist **keine produktive Firewall und keine vollständige Netzwerkisolation**: UDP, beliebige Unterprozesse, native Fremdkomponenten oder gezielt bösartiger Code sind nicht vollständig eingeschlossen. Die Auswahl hängt zudem vom tatsächlich verwendeten Einstieg und Arbeitsverzeichnis ab.

Beim anschließenden Controllerlauf wurde die DNS-Testregel als zu streng für den lokalen Listener-Bind an `0.0.0.0` erkannt. Die korrigierte Testvorrichtung erlaubt die lokale Verarbeitung numerischer IP-Adressen, da dabei keine externe DNS-Abfrage nötig ist. Die unabhängigen TCP-/TLS-/HTTP-Zielprüfungen bleiben erhalten und sperren ausgehende Nicht-Loopback-Verbindungen einschließlich `0.0.0.0` und `::` weiterhin.

Die korrigierten **sechs Testfälle bestanden sowohl unter Node 22 als auch unter Node 24**. Darin wird nun ein tatsächlicher HTTP-Listener an `0.0.0.0` geöffnet und über `127.0.0.1` im Kindprozess angesprochen; der Test prüft nicht nur eine simulierte Argumentliste. Die Ergebnislogs `raw/egress-fixture-node22.log` und `raw/egress-fixture-node24.log` wurden beim Review gelesen. Der erneute vollständige Controllerlauf wird im allgemeinen Prüfbericht gesondert ausgewiesen. Für diese Korrektur wurde keine Produkt-Runtime geändert.
