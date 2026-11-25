# Automatische OCPP21-Zuordnung – EOS 9.0.23

Prüfstand: 25.11.2026, lokale Quellcode-/Komponentenprüfung. Kein Zugriff auf eine Kundenanlage oder echte Wallbox.

## Verhalten und Grenzen

Die bisherige OCPP-Erkennung war ausschließlich ein manueller Installer-Aufruf. Der neue lokale Dienst beobachtet nun die registrierten nativen OCPP21-Stationen nach dem Betriebsstart, reagiert auf Änderungen ihrer Vertrags-/Topologiemetadaten und prüft zusätzlich alle 60 Sekunden. Registrierungsereignisse werden 500 ms gesammelt; fehlgeschlagene Abgleiche werden nach 5 Sekunden erneut versucht. Objekt- und Metadatenlesevorgänge haben jeweils ein Zeitbudget von 5 Sekunden. Es werden ausschließlich `ocpp21.*`-Objekte und `ocpp21.*.info.*`-Metadaten abgefragt; keine controllerweite Suche und keine neuen Netzwerkverbindungen.

Eine Station mit `info.eosContract = nexowatt-ocpp21-0.4-native` und `info.deviceType = evCharger` erhält eine EOS-Zeile. Typen, Einheiten sowie Lese-/Schreibberechtigung der tatsächlich vorhandenen Objekte werden geprüft. Auch eine noch unvollständige Registrierung wird als solche sichtbar; spätere Objekte ergänzen dieselbe Zuordnung. Beschädigte Qualitätskennzeichen der Vertragsmetadaten werden nicht als gültige Registrierung verwendet.

Neue Zeilen sind **deaktiviert**, vollständig mit den verfügbaren nativen Datenpunkten verbunden und als inbetriebzunehmen gekennzeichnet. Es werden keine Strom-/Leistungsgrenzen, Phasenzahlen oder AC/DC-Eigenschaften in der gespeicherten Konfiguration erfunden. Der Installer zeigt die erforderliche Prüfung von Typ, Phasen und elektrischen Grenzen ausdrücklich an. Der Dienst installiert keine EMS-App und sendet keine Gerätebefehle.

Der OCPP-Vertrag stellt **ein gemeinsames Stationsleistungslimit** bereit. Deshalb erzeugt EOS genau eine steuerbare Zeile je Station, auch bei mehreren EVSE oder Anschlüssen. Gemeldete Anschluss-/EVSE-Zahlen und optionale Anschlussidentitäten bleiben als Topologiebeschreibung erhalten; unabhängige Anschlusssteuerungen werden nicht behauptet oder angelegt. Der Installer bezeichnet die Zeile als OCPP-Station und erklärt das gemeinsame Limit.

Bekannte alte native/öffentliche Aliasidentitäten werden derselben Station zugeordnet. Nur bekannte semantisch gleichwertige Aliasfelder werden auf den nativen Vertrag überführt. Individuelle Namen, Grenzen, Aktivierung, Betriebsarten und abweichende manuelle Zuordnungen bleiben erhalten. Mehrdeutige oder bereits doppelte Stationszuordnungen erzeugen einen Konfliktstatus und keine zusätzliche Zeile. Der zusätzliche Laufzeitschutz gegen mehrere Writer derselben nativen Station und die eigentliche Rückmeldeauswertung sind Gegenstand der separaten CM-Prüfung.

Ein vorhandener aktiver manueller Messeintrag ohne bisherige Sollstrom-/Sollleistungszuordnung darf durch Discovery keinen ersten Writer erhalten. Er bleibt als `MANUAL_MAPPING_REVIEW_REQUIRED` sichtbar; neue Controlfelder werden nicht ergänzt. Der Schutz bleibt beim wiederholten Abgleich sowie durch Normalisierung, Engine und CM wirksam. Der Regressionstest reproduzierte vor dem ergänzenden CM-Schutz einen unbeauftragten 4.600-W-Schreibwunsch; danach erzeugt dieselbe reale Modulkette weder Sollwert- noch Freigabe-/Lease-Schreibbefehle. Ein ausdrücklich vom Installateur zugeordneter Stellpfad wird weiterhin berücksichtigt.

Jede konfigurierte Zeile belegt weiterhin einen lizenzierten Platz. Weitere erkannte Stationen bleiben mit `LICENSE_LIMIT` ausdrücklich in der Installer-Diagnose sichtbar; der Dienst schneidet keine bestehenden Zuordnungen ab. Nach einem frei gewordenen Platz oder einer Lizenzänderung nimmt der nächste Abgleich die fehlende Zuordnung erneut auf. Technische Grenze: 50 konfigurierte Zeilen, 128 erkannte Stationen, 50.000 Objekte/Metadaten je Abfrage. Überschreitungen werden als Fehler angezeigt, nicht als erfolgreicher leerer Bestand.

## Persistenz und Lebenszyklus

- Der Abgleich verwendet denselben Installer-Mutationsschutz wie manuelle Änderungen und die Geräte-Inbetriebnahme. Er plant auf dem aktuellsten Konfigurationsstand, provisioniert Objekte, speichert den geschützten Installer-Patch und übernimmt anschließend die Laufzeit.
- Eine veraltete Installer-Revision darf automatisch angelegte Zeilen nicht überschreiben. Die vorhandene Revisionspflicht umfasst jetzt auch OCPP-Zuordnungen.
- Fehlgeschlagene Speicherung übernimmt keine neue Runtime-Konfiguration. Nach erfolgreicher Speicherung, aber fehlgeschlagener Laufzeitübernahme bleibt diese sichtbar ausstehend und wird beim nächsten Abgleich erneut versucht.
- Vor einer Laufzeitübernahme wird der bisherige EMS-Zyklus mit dem bestehenden Übergabeschutz angehalten. Ownership-/Lizenzverlust und Shutdown werden vor Writes erneut geprüft.
- Registrierung, Wiederverbindung, Offline-Bestand und EOS-Neustart erzeugen keine zweite Zeile. Fehlende/ungültige Live-Messwerte werden bei der Registrierung nicht als Leistung null interpretiert.
- Der Dienst bündelt gleichzeitige Ereignisse in einem einzigen Abgleich. Beim Stop werden Timer gelöscht und laufende Abgleiche abgewartet; ein verspäteter Scan kann danach keinen neuen Commit beginnen.
- Die validierte Vertragsdiagnose läuft über `syncSettingsConfigToStates` und `EmsEngine._buildChargingConfig` bis zur tatsächlichen CM-Konfiguration. Ein ungültiger oder erfundener Connector-Control-Scope wird dort nicht durchgereicht.

## Nachweise

| Prüfung | Ergebnis |
| --- | --- |
| `EOS_TEST_OCPP21_MAIN=…/ocpp-042/iobroker.ocpp21/main.js node --test test/eos-ocpp-auto-discovery.test.cjs` | 13/13 bestanden, kein Skip; Rohlog `raw/ocpp-auto-discovery.log` |
| Tatsächlicher OCPP-Quellcode: `ensureStructure`, `StationTelemetry`, `_publishStationTelemetry` → EOS-State-Ereignis → laufender Discoverydienst → echte Installer-Persistenz | Bestanden; zwei EVSE, 5.000 W, eine deaktivierte Stationszeile |
| Reale Konfigurationskette bis CM, unbekannte Limits, partielle Registrierung, Qualitätsfehler, falsche Einheit/Schreibrichtung, Aliasmigration, manuelle Werte, Multi-EVSE, Lizenzgrenze | Bestanden |
| Parallelereignisse, konkurrierender Installer-Lock, Offline/Neustart, Persistenz-/Apply-Fehler, Shutdown und Ownership-Verlust | Bestanden |
| `tsc -p ui/tsconfig.ocpp-auto-discovery.json` und typbewusstes ESLint mit `ui/eslint.ocpp-auto-discovery.config.mjs` | Bestanden, strikt typisierter neuer Helfer |
| `tsc -p ui/tsconfig.installer-lifecycle.json` sowie ESLint des geänderten Lifecycle-Helfers | Bestanden |
| Installer-Lifecycle, EMS-Reconfiguration, Device-EMS-Review/Profile-Guard, Full-Startup und Hosted-Runtime-Stop | 40/40 bestanden |
| `verify-rc58-ocpp-compact-mapping.js`, `verify-rc59-ocpp21-native-storage-safety.js` | Beide bestanden |
| Echtes Chromium mit Produktions-`ems-apps.html`/CSS/JS, Desktop 1280×900 und Mobile 390×844 | Je vier Diagnosefälle im gerenderten DOM geprüft: Inbetriebnahme, manueller Monitor, unvollständiger Vertrag, Lizenzplatz; `raw/ocpp-discovery-browser.json` |

Die Komponentenprüfung verwendet echte Produktmodule mit simulierten ioBroker-Datenbankzugriffen und Ereignissen. Sie ist kein realer Controller-, Netzwerk-, Dauer- oder Hardwaretest. Für die Dousida Energyline sind Registrierung, Wiederverbindung, akzeptiertes Stationsprofil, gemessene Leistungsreaktion und echtes PV-Pausieren/Wiederanlaufen vor Ort weiterhin zu prüfen. Die automatische Zuordnung bestätigt weder eine OCPP-Profilannahme noch die physische Einhaltung des Limits.

## Betroffene Quellen

`ui/src-ts/runtime-executables/lib/ocpp-auto-discovery.ts`, die kleinen Lifecycle-/Persistenz-/Metadaten-Hooks in `main.ts`, die Metadatenweitergabe in `ems/engine.ts`, Revisionsschutz in `lib/installer-lifecycle.ts`, Installer-Hinweise in `www/ems-apps.ts` und die zugehörigen generierten Runtime-Dateien. Neue Laufzeitabhängigkeiten und zusätzliche Betriebssystemrechte wurden nicht eingeführt.
