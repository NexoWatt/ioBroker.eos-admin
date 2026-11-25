# EOS 9.0.23 – unabhängige Nachprüfung UI-/EMS-Prozess

Prüfdatum: 25.11.2026. Geprüft wurden `eosUiProcess.ts`, `eosUiProcessRpc.ts`, `eosUiProcessWorker.ts`, deren `web.ts`-Anbindung und der anschließend korrigierte `eosUiSecretCodec.ts`. Dies ist ein separates technisches Review innerhalb des Entwicklungsteams, keine externe Zertifizierung.

## Festgestellte und nachgebesserte Punkte

| Kennung | Befund | Nachprüfung |
| --- | --- | --- |
| UI923-R1 | Die erste Worker-Lease setzte ihr Alter erst beim Empfang zurück; verspätete Freigaben konnten dadurch erneut gültig werden. | Sequenz und absolute Ablaufzeit ergänzt. Echte Worker-Tests mit abgelaufener, älterer und anschließend frischer Freigabe bestanden. |
| UI923-R2 | Die erste Object-Subscription-Verwaltung wartete bei Stop nicht auf den ursprünglichen Subscribe-Abschluss. Ein spätes ACK konnte Cleanup überholen. | Acquisition-Promise bleibt erfasst; Stop wartet vor Unsubscribe. Test hält das tatsächliche Parent-ACK zurück und bestätigt anschließend vollständige Freigabe. |
| UI923-R3 | Nach wirklichem Prozessende konnte der Status während ausstehendem Cleanup vorübergehend `active: true` bei `pid: null` melden. | Exit setzt sofort Fehler-/Stopzustand und löscht Bereitschaft; `active`/`emsReady` benötigen zusätzlich eine aktuelle lebende Generation. Code nachgeprüft; Stop während ausstehender Subscription meldet in der Regression keine Bereitschaft. |
| UI923-R4 | Die erste synchrone Codec-Anbindung verwies auf `adapter-core.commonTools.encrypt/decrypt`, die das ausgelieferte SDK 3.4.3 nicht exportiert. Verschlüsselte Influx-Konfiguration war damit nicht wiederherstellbar. | Typisierter synchroner Kompatibilitätscodec gegen die originalen Controller-SDK-Funktionen geprüft; AES-192-CBC- und Legacy-XOR-Hüllen bleiben kompatibel. Auch die zunächst asymmetrische Klartext-/Ciphertext-Größengrenze wurde korrigiert. |

Der private HTTP-Pfad wurde zusätzlich anhand des Codes geprüft: Der Parent erzeugt den Nonce, entfernt vom Browser gelieferte Prozessheader und bindet den Kontext einmalig an Generation, Methode, URL und Originalrequest. Die Identitätsprüfung findet weiterhin am Parent-Request statt. Bereits vorhandene direkte Loopback-/Replaytests wurden nicht als eigene neue Prüfung umetikettiert.

## Tatsächliche Ausführung

Eigene neue Datei: `test/eos-ui-operational-process-review.test.cjs` mit drei Fällen. Die echte `ui/main.js`-Laufzeit startet über den realen Child-Prozess und `startOperational()` den tatsächlichen EMS-Scheduler sowie das Charging-Management. Der Test bestätigt dessen angelegten Datenpunktvertrag, einen weiter steigenden Scheduler-Heartbeat und das Schließen der Subscriptions. Zwei weitere Fälle decken die Lease- und Object-Subscription-Korrekturen ab.

Die ioBroker-Datenbank wird dabei durch eine synthetische Parent-Fassade dargestellt. Da im Executor kein vollständiger js-controller installiert ist, ersetzt eine klar begrenzte Fixture ausschließlich `getAbsoluteInstanceDataDir`. UI-, EMS- und Charging-Management-Methoden werden nicht ersetzt. Der Test nutzt keine realen Wallboxen, keine angeschlossene Anlage und keine produktiven Zugangsdaten.

Zusätzlich wurde `test/eos-ui-secret-codec.test.cjs` unabhängig gelesen und zusammen mit den drei eigenen Fällen ausgeführt. Der Codec-Test verwendet die **originalen** `@iobroker/js-controller-common-db/tools`-Funktionen; lediglich deren Controller-Paketlokator ist synthetisch. Er prüft beide Richtungen zwischen Controller und neuem Codec, Legacy/AES, Unicode, 64-KiB-Grenzwerte, falsche/fehlende Eingaben sowie tatsächlichen Child-Owner-Aufruf von `protectInfluxHistoryConfig` und `restoreInfluxHistoryConfig`. Bei fehlendem Schlüssel bleibt die Historienkonfiguration quarantänisiert; es entsteht kein Klartext-Fallback.

Ergebnis: **6/6 Fälle je Node-Version bestanden, keine übersprungen**. Die kombinierten Rohprotokolle liegen neben diesem Bericht:

- `ui-process-final-review-node22.tap` – Node 22.23.4
- `ui-process-final-review-node24.tap` – Node 24.22.3

## Historienabgrenzung und offene Praxisprüfung

Der nachgewiesene Codec-Bruch betraf Influx-Token und den synchronen Owner-Codec-Vertrag. Die verwaltete PostgreSQL-Historie liest ihr geschütztes lokales Profil und die CA unter `/etc/nexowatt-eos/postgresql`; sie verwendet diesen Codec nicht. Dieser Profil-/TLS-Pfad wurde durch die Codec-Korrektur nicht geändert. Die Child-Laufzeit erhält weiterhin den zentralen `hostNamespace` für die PostgreSQL-Profilauswahl. Die anfängliche Sammelbezeichnung „Influx/PG-Codec“ wurde entsprechend präzisiert.

Hier wurde keine vollständige Controllerinstallation, Produktionsdatenbank, Hersteller-Wallbox oder reale Energieanlage abgenommen. Der tatsächliche OCPP-Stop bei ausbleibendem EMS-Lebenszeichen wird separat geprüft. Eine Prozessbeendigung allein ist kein Nachweis eines physisch erreichten Null-Sollwerts. Hardware-, Last- und Dauerbetriebsnachweise bleiben getrennte offene Abnahmen.
