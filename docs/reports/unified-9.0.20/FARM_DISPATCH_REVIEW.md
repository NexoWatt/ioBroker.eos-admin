# Speicherfarm: unterschiedliche SoCs und konkrete Verteilentscheidung

Stand: 24.11.2026. Anlass ist eine Anlage mit FENECON bei 1 %, SolaX bei 98 %, frischen Farmwerten und bestehendem Netzbezug. Die Anzeige eines mittleren SoCs und frischer Messungen beweist weder einen aktiven Stellauftrag noch eine physische Batteriereaktion. Der zusätzliche Anlagenhinweis `storage-response-timeout` bei gültigem NVP, positivem Sollwert und `Write OK` verlangt deshalb eine getrennte Prüfung von Auftrag und tatsächlicher Rückmeldung.

## Unabhängig reproduzierter Verteilpfad

Der echte erzeugte Adapter wurde mit isolierter ioBroker-Zustandsdatenbank ausgeführt. Verwendet wurden `updateStorageFarmDerived()` und `applyStorageFarmTargetW()` einschließlich Statuszuordnung, Policy-Floor, Gewichtsverteilung, tatsächlichem Kommandostate-Write und anschließendem Lesen dieses States. Die Profile wurden für diesen abgegrenzten Verteiltest bewusst als generische signed-Leistungsprofile eingerichtet; herstellerspezifische Register-/Firmwarewirkung ist damit nicht geprüft.

| Eingang | Bestehendes beobachtetes Ergebnis vor der Diagnosekorrektur |
| --- | --- |
| Pool, je 10 kWh, SoC 1 % / 98 %, Mindest-SoC 10 %, Auftrag +600 W | Erstes Mitglied 0 W, zweites Mitglied +600 W; Auftrag vollständig angenommen. |
| Gleiche Konfiguration, SoC 98 % / 1 % | Erstes Mitglied +600 W, zweites Mitglied 0 W. |
| SoC fehlt beim ersten oder zweiten Mitglied | Das andere freigegebene Mitglied übernimmt den +600-W-Auftrag; fehlender SoC blockiert nicht die ganze Farm. |
| 98-%-Mitglied mit ausdrücklich konfiguriertem Entladelimit 0 W | Beide 0 W; Grund `no-discharge-dispatchable-storage`, 600 W bleiben unerfüllt. |
| Eingangsvorgabe 0 W | Beide 0 W; Grund `farm-stop`. Die Verteilung erfindet keinen eigenen Entladeauftrag. |

Damit wurde ein genereller Fehler „leeres erstes Mitglied blockiert jedes andere Mitglied“ in dieser tatsächlichen Verteilkette **nicht** reproduziert. Die globale Regler-/Herstellerprüfung ist gesondert dokumentiert. Aus diesem Ergebnis folgt nicht, dass die konkrete Kundenanlage bereits korrekt reagiert.

## Bestätigte Diagnoseabweichung und schmale Korrektur

Beim 1-%-Mitglied lieferte der Dispatcher korrekt 0 W, meldete aber zugleich `dischargeDispatchAvailable: true` und keine Blockiergründe. Dieses Feld stammt aus der vorgelagerten Statusfähigkeit; der Mindest-SoC wird erst im anschließenden `eligibleForDispatch`-Filter angewendet. Die Diagnose `availableDischargePowerW` summierte ebenfalls noch die Limits vor diesem Filter. Bei zwei auf 5000 W begrenzten Mitgliedern erschien dadurch 10000 W verfügbar, obwohl der konkrete Entladeauftrag nur das 98-%-Mitglied verwenden durfte.

Die Korrektur ändert ausschließlich die Ergebnis-/Diagnoseprojektion:

- `directionDispatchAvailable` zeigt die bereits getroffene Zulassungsentscheidung für den aktuellen Auftrag. Die bestehenden Statusfähigkeitsfelder bleiben unverändert und dürfen damit nicht verwechselt werden.
- `dischargeFloorSocPct` wird nur für einen tatsächlichen Entladeauftrag ausgegeben.
- `effectiveMaxDischargeW` ist bei diesem Entladeauftrag 0 für ausgeschlossene Mitglieder, sonst das vorhandene Limit; `null` bedeutet kein endliches Limit beziehungsweise keine aktuelle Entladeprüfung. Der Wert ist keine Bestätigung einer Hardwareleistung.
- Ein Ausschluss durch den bestehenden SoC-Filter erhält `soc_at_or_below_discharge_floor` beziehungsweise `soc_missing`. Bereits vorhandene Gründe für eine BMS-Freigabe, Fehler, Lizenz oder ein 0-W-Limit bleiben erhalten.
- Der ursprüngliche beobachtete SoC wird für die Diagnose separat aufbewahrt. Fehlender SoC erscheint dort als `null`, nicht als erfundene 0 %.
- `dispatchKey` wird aus der bestehenden stabilen Dispatcherkennung in das Ergebnis übernommen. Die Oberfläche kann Mitglieder dadurch unabhängig von Reihenfolge und gleichen Namen zuordnen.
- Nur `storageFarm.lastDispatchJson.availableDischargePowerW` summiert bei einem Entladeauftrag die nach dem Floor zugelassenen Mitglieder. Die live von der Regelung konsumierten Zustände und deren Getter werden nicht verändert.

`eligibleForDispatch`, Verteilgewichte, Gruppenregeln, Policy-/BMS-/Lizenzgrenzen, Sollwertberechnung, Schreibreihenfolge und Kommandobestätigung bleiben unverändert. Der tatsächliche Messwert-/Zeitüberwachungsfehler wird dadurch nicht unterdrückt oder umgangen.

## Neue Regression und Nachweise

`test/eos-storagefarm-dispatch-diagnostics.test.cjs` führt den tatsächlichen erzeugten Runtimepfad aus. Die neue Diagnoseprüfung schlägt vor dem Neubau gegen den bisherigen Runtimecode fehl; die bestehenden Writeergebnisse waren bereits vorher korrekt. Nach der Korrektur bestehen jeweils **8/8 Testfälle unter Node 22.23.4 und Node 24.22.3**, keine Fehler oder Skips.

Geprüft wurden 1 % / 98 %, umgekehrte SoCs und umgekehrte Statusreihenfolge, fehlender SoC, ausdrücklich gesetztes 0-W-Limit, ausdrückliche Entladeverweigerung sowie Idle-/Ladeaufträge. Letztere dürfen keinen angeblich angewendeten Entlade-Floor ausweisen. Die Tests vergleichen auch die unveränderten tatsächlich geschriebenen Werte.

Rohbelege, genaue Befehle, Zeitstempel, Laufzeiten sowie Hashes von Log, TypeScript und erzeugter Runtime liegen unter `raw/farm-dispatch/`. Der dortige UI-ESLint-10.13-Lauf findet keine neu eingeführte Scannerfundstelle; vorhandene historische Funde bleiben offen. Die endgültige Ganzdateibindung und unabhängige Zweitprüfung gehören in `STATIC_REVIEW_DE.md` beziehungsweise den abschließenden Releasebericht.

## Grenzen für die konkrete Anlage

Ein bestätigter ioBroker-Kommandostate bedeutet, dass der angeforderte Wert gespeichert beziehungsweise zurückgelesen werden konnte. Er bestätigt weder Modbus-Schreibannahme im Wechselrichter noch die physische Leistung der Batterie. Bei `storage-response-timeout` sind der tatsächlich dem SolaX zugewiesene Auftrag, Hersteller-/BMS-Freigabe, korrektes Aktorprofil, Messdatenpunkt und echte Rückmeldung gemeinsam zu prüfen. Ein vorhandener Sollwert darf nicht als gemessene Leistung dargestellt werden.

Eine frische Farmübersicht mit 2/2 Mitgliedern und arithmetischem SoC 49,5 % bleibt eine Messübersicht. Entscheidende Diagnosewerte sind `speicher.regelung.aktiv`, `sollW`, `quelle`, `grund` sowie `storageFarm.lastDispatchJson` mit Auftrag, angenommener Verteilung, wirksamem Floor, Einzelgründen und Schreib-/Rücklesestatus. Physische FENECON-/SolaX-Hardware wurde in dieser Prüfung nicht angesteuert; ein behobener Gerätefehler oder eine erfolgreiche Kundeninbetriebnahme wird nicht behauptet.
