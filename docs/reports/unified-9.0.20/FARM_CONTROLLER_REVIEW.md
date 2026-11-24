# Speicherfarm: Regler, Verteilung und physische Rückmeldung

Prüfung vom 24.11.2026 am noch nicht ausgelieferten 9.0.20-Stand. Anlass: FENECON bei 1 %, SolaX bei 98 %, Farmmittel 49,5 %, Mindest-SoC laut Bediener 10 %, dennoch weiter Netzbezug. Späteres Livebild: Farm-Ist 63 W, akzeptierter Sollwert 673 W, ausstehende Änderung 610 W und `storage-response-timeout` nach rund 39,9 Sekunden.

## Reproduzierbares Ergebnis

Der tatsächliche `SpeicherRegelungModule.tick()` mit tatsächlicher `updateStorageFarmDerived()`-Aggregation und tatsächlichem `applyStorageFarmTargetW()`-Dispatcher verteilt einen 600-W-Entladebedarf bei 1 %/98 % und 10 % Mindest-SoC als **0 W/600 W**. Umgekehrte Reihenfolge liefert **600 W/0 W**. Der erste Speicher blockiert den zweiten in diesem geprüften Pfad nicht. Verwendet wurden das FENECON-Direct-ESS-Profil und ein SolaX-Signed-Power-Pfad. Eine absichtlich erhaltene Einzelgeräte-SoC-Zuordnung auf den ersten Speicher ändert den Farm-SoC nicht.

Eine ausdrücklich aktive globale MultiUse-Eigenverbrauchsuntergrenze von 50 % sperrt dagegen bei 49,5 % Farmmittel den Auftrag. Das ist eine andere wirksame Policy als die eigenständige 10-%-Grenze. Die Regression prüft den ausgewiesenen Grund einschließlich `installerConfig.storageMultiUse`; die Prüfung verändert oder überschreibt diese Kundenentscheidung nicht. Der später sichtbare tatsächliche 673-W-Auftrag ist kein Beleg für eine solche globale Sperre.

Der NVP-Koordinator verwendet die aggregierte Farmleistung, keinen versteckten FENECON-Erstwert. Im zusätzlichen vollständigen Controller-/Koordinatortest erzeugen 610 W Netzbezug und 63 W Farm-Ist einen 673-W-Auftrag an das volle Mitglied. Bleibt die frisch gemessene Istleistung 63 W, wird die ausstehende 610-W-Reaktion nach 39,9 Sekunden nicht mehr als sichere NVP-Korrektur vorweggenommen: `storageWriteAccepted=true`, aber `storageCommandCredited=false`, `storage-response-timeout`, prognostizierter verbleibender Netzbezug 610 W.

`WriteOK-farm` bestätigt den angenommenen Befehlspfad mit Rücklesen des Kommandodatenpunkts. Es bestätigt keine physisch erreichte Wechselrichterleistung. Deshalb darf weder diese Anzeige noch ein erfolgreicher Modbus-Schreibauftrag als abgeschlossene Leistungsreaktion behandelt werden.

## Tests und unabhängiger Review

`test/eos-storagefarm-controller-dispatch.test.cjs`: **16/16 bestanden unter Node.js 22.23.4 und 24.22.3**. Abgedeckt sind Reihenfolge 1/98 und 98/1, beide Speicher unter Minimum, ausdrücklich 0 W bzw. 250 W Leistungslimit, vollständig veraltete Mitgliedstelemetrie, Fault, Richtungsfreigabe, veralteter NVP, Tarifsperre, deaktivierte Farm-App, ausdrücklich abweichende globale MultiUse-Policy und ausbleibende physische Reaktion trotz akzeptiertem Auftrag. Datenbank und Geräte-I/O sind Fixtures; Regler, Aggregation, Dispatcher und NVP-Koordinator sind reale Produktimplementierungen. Kein Aktorbefehl wurde an ein Kundengerät gesendet.

Die bestehende Behandlung nur bei Änderung aktualisierter optionaler Geräteflags bleibt bestehen. Ein alter Einzelwert ist nicht automatisch ein komplettes Offline-Gerät. Für den Stale-Test sind alle relevanten Mitgliedstelemetrien veraltet. Es wird keine neue allgemeine Aussage behauptet, wonach jeder alte optionale Statuswert allein den gesamten Speicher sperren müsste.

Unabhängig gelesen wurde außerdem die schmale Farm-Diagnosekorrektur in `main.ts`: aktuelle SoC-Ausschlussgründe, effektive Entladegrenze und stabile `dispatchKey`-Zuordnung werden nach der bestehenden Allokation projiziert. Sollwertberechnung, Auswahl berechtigter Mitglieder und Schreibpfade bleiben unverändert. Der separate Bericht und die acht Diagnosefälle enthalten deren Detailnachweise.

## Offene Liveursache

Die fehlende physische Entladung der konkreten Anlage ist mit diesen Fixtures **nicht als behoben nachgewiesen**. Dafür müssen die tatsächlichen Einzelergebnisse von `storageFarm.lastDispatchJson`, die Kommandorückmeldung und die aktuelle Gerätefreigabe ausgewertet werden. Insbesondere existieren im SolaX-Treiber numerische erlaubte Lade-/Entladeleistungen; diese sind nicht gleichbedeutend mit den optionalen booleschen EMS-Richtungsfreigaben. Ein weitergehender Regler- oder Schutzumbau ohne diesen Nachweis ist nicht Bestandteil dieser Prüfung.

Rohbelege: `raw/farm-controller/controller-node22.log`, `controller-node24.log`, zugehöriger Quellen-/Loghash in `evidence.json`. Eine Produktionsabnahme der physischen SolaX-/FENECON-Anlage wird damit nicht behauptet.
