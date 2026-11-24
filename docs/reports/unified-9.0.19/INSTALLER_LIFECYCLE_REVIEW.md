# EMS-Geräteübernahme und Laufzeitübergabe 9.0.19

Stand: 24.11.2026. Geprüft in lokaler Node.js-24-Testumgebung mit echter gehosteter HTTP-Runtime, EMS-Engine, Modulmanager und Datenpunkt-Registry. ioBroker-Datenbank, Sitzungsidentität und Geräte sind Testfixtures. Keine Prüfung an Kundenanlage oder physischer Hardware, keine pauschale Produktions-/CRA-Konformitätsaussage.

## Reproduzierter Fehler und Änderung

Die neue Regression `real apply waits old tick and async module stop before config replacement` wurde zusätzlich gegen den unveränderten gelieferten Runtime-Stand aus `source-918` ausgeführt. Sie scheitert dort: Während der alte Regelzyklus noch wartet, sieht er bereits `alias.0.new.grid` statt seiner bisherigen Zuordnung `alias.0.old.grid`. Die bisherige erzwungene Engine-Initialisierung stoppte und verwendete dasselbe Engine-Objekt ohne bestätigten Abschluss alter Aufträge erneut.

9.0.19 pausiert zuerst neue Regelzyklen und wartet auf den tatsächlichen Abschluss laufender Zyklen. Auch Modulaufträge, deren äußerer Watchdog bereits einen Timeout gemeldet hat, bleiben bis zu ihrem wirklichen Ende registriert. Der Modulmanager erwartet danach asynchrone Stopphooks. Erst anschließend wird die neue Konfiguration für die Laufzeit sichtbar und eine neue Engine mit neuer Datenpunkt-Registry aufgebaut. Der HTTP-Server und die Benutzersitzungen werden dafür nicht neu gestartet.

Die Übergabe hat ein gemeinsames Zeitbudget von höchstens 5 Sekunden für Zyklusende, verspätete Modulaufträge und Stopphooks. Ein Timeout startet keine zweite Engine und löscht keine noch laufende Quarantäne. Der alte Bestand bleibt pausiert; die gespeicherte Konfiguration ist als noch nicht angewandt markiert. Scheduler-Diagnose und Initialisierungsfehler zeigen die ausstehende Anwendung. Die Geräteübernahme kann nach tatsächlichem Abschluss erneut anwenden. Ein dauerhaft hängender Fremdauftrag wird nicht durch einen neuen parallelen Regler umgangen.

Die Geräteplanung erhält die aktuellen zentralen Appfreigaben. Vor dem Speichern wird eine neu angeforderte Appaktivierung zusätzlich geprüft; eine verweigerte Lizenz wird nicht als erfolgreiche aktive Zuordnung ausgegeben. Bestehende Speicherlimits bleiben wirksam. Ein einmaliger Geräteauftrag wird vom Planner behandelt; ein Hintergrundstart erteilt selbst keine neue Appfreigabe.

## Messwerte, Farm und Energiefluss

- Eine ausdrücklich aktivierte Farm ist mit einem real konfigurierten Mitglied gültig. Runtime, Kundenkonfiguration, Anzeige und Speicherregelungs-Fallback verwenden dieselbe Mindestanzahl. Deaktivierte Apps und reine Messzeilen erhalten dadurch keinen zusätzlichen Schreibpfad.
- Numerische Cacheleser akzeptieren keine booleschen Zustände, fehlenden Werte, leeren Strings oder Sammlungen als Leistung. Ein echter numerischer Nullwert bleibt erhalten.
- FENECON Home trennt `batteryFlowPowerId` für den physischen Batteriefluss (415) von der ESS-Konverter-Rückmeldung (604). `storageFarm.totalPowerW` und seine vorhandenen Lade-/Entladesummen behalten ihre Regelungsbedeutung. Die neue, nur lesbare Aggregation `storageFarm.totalBatteryPowerW` versorgt Anzeige/History; sie enthält keine durchgeleitete DC-PV als Batterieentladung.
- Fehlt bei ausdrücklich getrennter Batterieflussquelle ein gültiger aktueller Messwert, wird die neue Aggregation `null`. Weder Konverterleistung noch ein erfundener Nullwert ersetzen ihn. Bereits bestehende manuelle Zuordnungen werden hier nicht verändert.
- Zwei freie, nicht definierte Variablen (`userMode`, `userEnabled`) wurden aus den Energiefluss-Shadow-Ergebnissen entfernt. Sie waren weder Eingabe noch Bestandteil des fachlichen Energieflussvertrags und führten zuvor zum Abbruch des Vergleichs.

## Prüfungen

`node --test test/eos-ems-reconfiguration.test.cjs test/eos-installer-lifecycle.test.cjs`: **16 bestanden, 0 fehlgeschlagen**.

Die acht neuen Fälle prüfen:

1. Echten alten Engine-Tick und asynchronen Modulstopp abwarten; neue NVP-, Speicher- und Ladepunktzuordnungen erreichen die tatsächlichen Leser; dieselbe HTTP-Sitzung bleibt gültig.
2. Begrenzter Übergabe-Timeout lässt die alte Engine gesperrt und verhindert einen zweiten Regelzyklus.
3. Boolesche/fehlende Messwerte bleiben ungültig, echte 0 bleibt gültig.
4. Farm mit einem aktiven Mitglied liefert reale Messwerte und wird bei Appdeaktivierung nicht weiter als aktiv gemeldet.
5. FENECON 415 = −2.000 W, 604 = +1.000 W, DC-PV = 3.000 W: Batterie lädt 2.000 W, Regelungsrückmeldung bleibt +1.000 W. Bei 415 = 0 und 604/DC-PV = 3.000 W bleibt Batteriefluss 0. Ungültige 415-Probe ergibt `null`.
6. Energiefluss-Shadow liefert einen gültigen Vergleich statt eines `ReferenceError`.
7. Tatsächlicher Modulmanager-Watchdog meldet einen noch laufenden Auftrag; die Übergabe wartet dennoch. Sein späterer Zugriff sieht ausschließlich die alte Zuordnung.
8. Eine deaktivierte, durch Gerätekommissionierung verwaltete Einzel-Speicherzeile erhält trotz noch aktivem Appdatensatz keine Schreibhoheit; bisherige nicht verwaltete Einzel-Konfigurationen behalten ihre vorhandene Semantik.

Die acht bisherigen Lifecycle-Tests behalten ihre Gültigkeit: Revisionen, veraltete Formulare, begrenzte Objektanlage, Messwert-/RFID-Erhalt, kein Löschen beim Start, Appdeaktivierung/Wiederaktivierung und integrierte/alte gepunktete Geräte-IDs.

Zusätzlich bestanden: `tsc -p ui/tsconfig.installer-lifecycle.json`, typisiertes ESLint mit `ui/eslint.installer-lifecycle.config.mjs`, Runtime-Transpilierung, `verify-storage-single-tab-coupling.js` und `verify-storage-farm-config-fallback.js` (letzteres im UI-Verzeichnis).

Der historische separate `verify-storage-topology-authority.js`-Loader ist nicht als bestanden gewertet: Sein alter optional-dependency-Stub wirft bereits beim heutigen SmartHome-Type-Detector-Import, bevor seine Topologie-Assertions ausgeführt werden. Die oben genannten neuen echten Runtime-Tests ersetzen diese Beobachtung nicht stillschweigend; die gesamte Releaseprüfung führt der übergeordnete Releaseablauf aus.

Die umfangreichen bestehenden Runtime-Dateien tragen weiterhin ihre dokumentierte TypeScript-Migrationsschuld. Der geänderte eigenständige Lifecycle-Helfer wird strikt und typinformiert geprüft; das ist kein Volltypnachweis für den gesamten alten Adapterkern.

## Ergänzungen der Geräte- und Farmprüfung

- Der reale Ablauf AppCenter deaktivieren → Geräte erneut speichern legte durch `_nwApplyLicenseLimitsToInstallerPatch` sieben zuvor nicht vorhandene optionale Speichergrenzen als eigene `undefined`-Eigenschaften an. Die strenge Geräteplanung lehnte diese später ab. Nur diese bekannten optionalen Grenzen bleiben jetzt abwesend; explizite 0, null und positive Grenzen werden nicht umgedeutet. Der tatsächliche HTTP-/Neustarttest der unabhängigen Integration bestätigt die erhaltene deaktivierte App.
- Ein Profil-/Protokollwechsel reserviert vor dem Geräte-Commit denselben Mutationsschutz wie AppCenter. Aktive Controller einschließlich NVP-Splitmessung, Peak/Atypical, Wallbox, Einzel-/Farmspeicher und dynamischem Netzanschluss werden gegen tatsächliche DP-Referenzen geprüft. Manuelle ioBroker-Aliase werden über den vorhandenen begrenzten Resolver aufgelöst. Ein genutztes Geräteprofil wird mit `EOS_DEVICES_PROFILE_IN_USE` abgelehnt; eine nicht sicher mögliche Prüfung mit `EOS_DEVICES_PROFILE_CHECK_UNAVAILABLE`. Die Sperre hält bis zum Geräte-Commit, damit keine gleichzeitige App-Aktivierung die Prüfung überholt. Reine Anzeigezuordnungen bei deaktivierten Controllern erteilen keine Steuerhoheit und werden nicht als solche behandelt.
- `storageFarm.overviewJson` ist ein atomarer, lesender Darstellungssnapshot. Er enthält Frische und Abdeckung je Messgröße. Physisches Brutto-Laden und Brutto-Entladen werden je Mitglied vor der Nettierung addiert: −5 kW und +5 kW ergeben 5 kW Laden, 5 kW Entladen, 0 kW netto. Bei fehlenden/stalen/ungültigen Mitgliedsproben bleiben vollständige Leistungssummen null.
- Der neue `displayMeanSoc` ist der arithmetische Mittelwert ausschließlich gültiger frischer SoC-Proben; ein Teilmittel wird mit `valid/total` und `complete:false` ausdrücklich ausgewiesen. Der vorhandene, letzten SoC erhaltende Reglervertrag (`totalSoc`, Median, gewichtet) wurde dafür nicht geändert. Konfigurierte Nennkapazität bleibt unabhängig von der Messfrische; unvollständig bekannte Kapazität liefert nur eine als solche bezeichnete bekannte Teilsumme, keine falsche Gesamtkapazität.
- Tatsächlich identische Batteriemesspfade werden unabhängig von verschiedenen Besitzmarkern einmal gezählt. Unterschiedliche erlaubte gepunktete Geräte-IDs werden anhand der `.aliases.`-Grenze unterschieden. Explizite Wh/kWh/fachfremde Einheiten werden im neuen Leistungsanzeigepfad verworfen; der bestehende Reglerparser bleibt unverändert.
- Die neuen Anzeigeobjekte werden angelegt, aber nicht mit erfundenen Messwerten initialisiert. Sie ändern keine Betriebsfreigabe, Leistungsgrenze oder Stellgröße.

### Geprüfter ergänzter Stand

`node --test test/eos-device-ems-profile-guard.test.cjs test/eos-storage-farm-overview.test.cjs test/eos-storagefarm-review.test.cjs test/eos-device-ems-review.test.cjs test/eos-ems-reconfiguration.test.cjs test/eos-installer-lifecycle.test.cjs`: **34 bestanden, 0 fehlgeschlagen**. Die unabhängigen Reviewdateien sind in diesem tatsächlichen Lauf enthalten. Weitere vollständige HTTP-Integrations- und Releaseprüfungen laufen im übergeordneten Releaseablauf.

`node_modules/.bin/tsc -p ui/tsconfig.installer-lifecycle.json` und `node_modules/.bin/eslint -c ui/eslint.installer-lifecycle.config.mjs ui/src-ts/runtime-executables/lib/installer-lifecycle.ts ui/src-ts/runtime-executables/lib/storage-farm-overview.ts`: beide erfolgreich. Der neue reine Aggregationshelper und die Profilreferenz-Auswahl sind strikt typisiert; die großen vorhandenen Runtime-Dateien behalten ihren dokumentierten Legacy-TS-Status.
