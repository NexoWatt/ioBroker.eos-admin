# OCPP-Namensraum und EMS-Regelpfad — EOS 9.0.24

Prüfstand: 25.11.2026, Node.js 24.22.3. Lokale Integrations- und Browserprüfung; keine reale Dousida-Wallbox angesteuert. Der Bericht beschreibt die EMS-/Installer-Kompatibilität. Prozessstart, OCPP-Transport und Migration des integrierten Workers werden zusätzlich in ihren eigenen Nachweisen geprüft.

## Vertrag und Änderung

| Fall | Native Basis | Lebenszeichen für EMS |
| --- | --- | --- |
| Neue integrierte Installation | `eos-admin.N.ocpp.<Station>` | `eos-admin.N.ocpp.info.runtimeAlive` des OCPP-Workers |
| Integrierte Migration mit erhaltenen IDs | `ocpp21.N.<Station>` | `ocpp21.N.info.runtimeAlive`, erkannt über `info.eosHostedRuntime` |
| Weiter vorhandener externer OCPP-Adapter ohne Hosted-Marker | `ocpp21.N.<Station>` | bisheriges `system.adapter.ocpp21.N.alive` |

Die native Stationsschnittstelle bleibt `nexowatt-ocpp21-0.4-native`. Messung, Watt-Stellwert, Freigabe, atomare Profilantwort, Session-ID und EOS-Lease werden aus derselben Stationsbasis abgeleitet. Ein Aggregat bildet genau eine steuerbare Station ab; mehrere physische EVSE/Connectoren erzeugen keine zusätzlichen Stellwert-Schreiber.

Der automatische Dienst liest und abonniert ausschließlich `ocpp21.*` sowie `eos-admin.N.ocpp.*` der **eigenen** EOS-Hostinstanz. Er erhält Registrierung, Teilregistrierung, periodische Wiederholung, Ereignisbündelung, Sperren gegen parallele Installer-Saves und idempotente Neuanläufe. Eine übernommene UI mit altem UI-Namensraum nutzt weiterhin den tatsächlichen EOS-Host als Grenze. Andere EOS-Instanzen oder frei erfundene Namespaces werden nicht automatisch erschlossen.

Vorhandene Migrationen behalten ihre Datenpunkt-IDs. Gleiche Stationsnamen in verschiedenen echten Namespaces werden nicht ohne Identitätsbeleg zusammengelegt. Die Installation muss ihre migrierte Basis erhalten; eine neue Basis wird nicht aus dem Anzeigenamen geraten. Öffentliche historische OCPP-Aliase werden wie bisher zur zugehörigen nativen `ocpp21.N`-Station aufgelöst.

## Schutzverhalten

- Neue Stationen bleiben deaktiviert, bis ihre elektrischen Grenzen geprüft und gesetzt wurden. Es werden keine Phasen-/Strom-/Leistungsgrenzen erfunden. Lizenzüberhänge bleiben als ausstehende Stationen sichtbar.
- Vorhandene aktive reine Monitor-Zuordnungen erhalten weiterhin keinen ersten Stellwertschreiber und keine Lease durch Auto-Erkennung.
- Ein Hosted-Heartbeat benötigt `ack:true`, gültige Qualität, eine vorhandene originale Quellzeit und ein Alter von höchstens 15 Sekunden. Fehlende, zukünftige, veraltete oder ungültige Heartbeats sperren positive Leistung und Lease-Erneuerung. Das Lebenszeichen des Admin-Parents ersetzt den Worker nicht.
- Nur ein explizit bestätigtes `false` mit gültiger Originalmetadatenlage nach kontrolliertem Migrations-Rollback erlaubt wieder das externe Adapter-Lebenszeichen. Ein vorhandener, aber ungültiger Hosted-Marker fällt nicht auf ein scheinbar lebendes externes Adapter-Lebenszeichen zurück. Unverändert veröffentlichte gültige Marker dürfen alt sein; der Worker-Heartbeat muss aktuell sein.
- Bei integrierten Stationen darf ein ungültiges Socket-Flag nicht über einen frischen Status oder Leistungswert als online gelten. Qualitäts-, ACK- und Quellzeitprüfung bleibt von der Profilantwort getrennt.
- Native Zuordnungen in den Namespace einer anderen EOS-Instanz sowie Zeilen mit mehreren unterschiedlichen nativen Stationsbasen werden vor DP-Registrierung gesperrt. So kann eine Lease von Station A keinen Stellwertschreiber für Station B legitimieren. Diagnose: `ocpp_host_namespace_mismatch` bzw. `ocpp_mixed_station_mapping`. Es werden dabei weder Stop-Bestätigungen behauptet noch fremde Gerätebefehle geschrieben.
- Doppelzuordnungen derselben nativen Station behalten die bestehende Konfliktsperre: keine positive Leistung, keine Lease und genau ein konservativer Null-Schreiber. Generische frühere `ocpp.N`-Connectoren bleiben getrennt steuerbar.

## Tatsächlich ausgeführte Prüfung

`EOS_TEST_OCPP21_MAIN=/workspace/scratch/b0b00b64c39c/ocpp-042/iobroker.ocpp21/main.js node --test test/eos-ocpp-auto-discovery.test.cjs test/eos-ocpp-runtime-feedback.test.cjs test/eos-ocpp-limit-feedback.test.cjs`

Erster erweiterter Prüfstand: **41 Tests bestanden, 0 fehlgeschlagen, 0 übersprungen** (`raw/ocpp-namespace-control.log`). Nach dem unabhängigen Review und den unten beschriebenen Korrekturen bestand der finale Prüfstand **47/47 auf Node 22.23.4 und 24.22.3 ohne Skips**. Finale Belege: `raw/current/ocpp-namespace-independent-node22.txt` und `raw/current/ocpp-namespace-independent-node24.txt`; unabhängiger Bericht: `OCPP_UNABHAENGIGER_REVIEW.md`.

Dabei werden die tatsächlichen `ensureStructure`-/Telemetrie-Methoden sowohl des bisherigen Adapters als auch von `modules/ocpp/runtime.js` verwendet. Die integrierte Registrierung durchläuft den echten EOS-Discovery-Hook, die Installer-Persistenz, Normalisierung, Engine und einen CM-Zyklus. Eine unbekannte neue Station bleibt dabei deaktiviert. Wiederholte Scans, Ereignisbündel, Offline/Neustart und erhaltene Migrationen erzeugen keine zweite Zeile.

Die getrennten tatsächlichen CM-Allokations-/Writer-Prüfungen decken beide integrierten Namespace-Varianten ab: positive begrenzte Wattvorgabe erst nach Lease, atomare Rückmeldung aus derselben Session, bestätigtes Profil 0 W bei getrennt weiter sichtbarer Istleistung, Lease-Fehler, stale/q/ACK/Zeitfehler, fremde EOS-Instanz, Mischzuordnung und Aggregat-Doppelbelegung. Geräte-Transport und Messwerte sind simuliert; eine erfolgreiche Profilantwort wird nicht als physischer Lade-Stopp ausgegeben.

Zusätzlich bestanden:

- Strict-Typecheck und typgestütztes ESLint für `ocpp-auto-discovery.ts` und `ocpp-limit-feedback.ts` mit den bestehenden projektspezifischen Konfigurationen.
- `verify-rc58-ocpp-compact-mapping.js` und `verify-rc59-ocpp21-native-storage-safety.js`; zwei bisher fest verdrahtete Quellmarker sind auf den getesteten begrenzten Pattern-Helper aktualisiert.
- Echter Chromium-Test `verify-rc59-ocpp21-mapping-browser.js` einmal unverändert für Legacy und einmal mit `EOS_TEST_HOSTED_OCPP=1`: native Zuordnung, vorhandene Fremdzuordnung erhalten, wiederholte Zuordnung ohne zusätzliche Zeile. Rohbelege: `raw/ocpp-hosted-mapping-browser.log` und `raw/ocpp-legacy-mapping-browser.log`.

## Ergänzungen aus dem unabhängigen Review

- Die manuelle Installer-Aktion „OCPP zuordnen/erkennen“ hatte bei neuen Zeilen bisher `enabled:true`, `chargerType:ac` und 6 A Mindeststrom gesetzt. Diese Annahmen sind entfernt. Neue Zeilen bleiben deaktiviert; vorhandene explizite Aktivierung, AC/DC-Auswahl und elektrische Grenzen bleiben erhalten. Der veröffentlichte native Vertrag enthält keine verlässliche AC/DC-Angabe, deshalb wird diese nicht erfunden.
- Ein Teilcache konnte den Hosted-Pflichtlease fälschlich zum alten externen Protokoll herabstufen, wenn Supportmarker und atomare Antwort noch fehlten. Für Hosted-Stationen bleibt die Lease jetzt zwingend erforderlich; fehlender Nachweis ergibt keine positive Vorgabe.
- Eine vorhandene manuelle Wahl `generic`, `polling`, `modbus`, `http`, `mqtt` oder `udp` konnte bei nativen Hosted-IDs ebenfalls Workerprüfung und Lease umgehen. Die Klassifikation des Hosted-Vertrags wird nun vor der Profil-/DP-Ableitung gelesen. Der zwingende native Vertrag gewinnt dort vor diesen alten Telemetrieoptionen; ein spätes Umschalten des Markers wird bis zum folgenden bestätigten Zyklus gesperrt. Ein nicht lebender Hosted-Worker sperrt unabhängig vom Profiltoken. Tatsächliche generische Geräte und der externe 0.4.2-Pfad ohne Hosted-Marker bleiben kompatibel.

Die beiden Sicherheitsbefunde wurden vor der Korrektur am tatsächlichen CM-Writer mit 4.200 W reproduziert und danach unabhängig unter beiden Node-Versionen geprüft. Die letzte Matrix enthält beide Namespace-Varianten, alle sechs Profiltokens, Worker an/aus, anfänglich fehlende Cache-Daten, externe Altkompatibilität und die drei neuen Installer-Tests. Die historischen roten Repros im Review-Verzeichnis sind ausdrücklich Vorherbelege.

## Grenzen

Dieser Prüfstand ersetzt weder Anlagen-Inbetriebnahme noch Hardware-Sicherheitskette. Am tatsächlichen Gerät bleiben insbesondere Registrieren/Reconnect, Leistungsreduktion bis 0 W, Reaktion auf Verlust des EMS-/OCPP-Prozesses und Wiederanlauf nach gültiger neuer Session zu prüfen. Keine Aussage „100 % fehlerfrei“ oder allgemeine Produktionsfreigabe aus diesen Tests.
