# EVCS/OCPP – letzter Schreibpfad, 25.11.2026

## Ergebnis und Abgrenzung

Im aktuellen EOS-Quellstand wurden zwei Fehler im gemeinsamen numerischen Schreibpfad reproduziert: Ein konfiguriertes Minimum konnte einen EVCS-Stopp von 0 W auf 4140 W anheben; ein positiver Restwert von 20 W verhinderte wegen 25-W-Deadband den folgenden Stopp. Dies sind nachgewiesene Randfälle des Writers, **kein Beleg**, dass diese Konfiguration beim gemeldeten Dousida-Energyline-Ladepunkt vorliegt. Im Standard-CM-Mapping wird kein solches Minimum an die Registry übergeben. Die gesondert geprüfte ausdrückliche PV-Modusüberschreibung durch Negativpreis liegt vorher in der Regelung; deren Korrektur und Start/Stopp/Wiederanlauf-Test gehören zum Bericht des Tarif-/Ladeagenten.

Der EVCS-Consumer kennzeichnet jetzt numerische Schreibzugriffe mit `zeroIsStop`. Nur bei diesem Vertrag bleibt die ausdrückliche physische 0 vom Laufminimum ausgenommen. Übergänge über 0 umgehen die Deadband. Identische 0 bleibt bis zum bisherigen Keepalive-Intervall dedupliziert. Positive Mindest-/Höchstwerte, Skalierung, fehlgeschlagene Schreibversuche, die Stationsverfügbarkeit und andere Verbraucher behalten ihre bisherigen Verträge. Es wurden keine Leistungs-/Netz-/Phasen-/§14a-Grenzen erhöht.

Geändert: kanonische Quellen `ui/src-ts/runtime-executables/ems/datapoints.ts` und `ui/src-ts/runtime-executables/ems/consumers/evcs.ts`. Runtime-Generierung und abschließender Paketlauf erfolgen durch Root.

## Aktuelle Prüfbelege

`test/eos-evcs-stop-writer.test.cjs` führt die tatsächlichen kanonischen Consumer- und DatapointRegistry-Quellen aus. Vor der Änderung: zwei erfolgreiche Fälle, zwei reproduzierte Fehler und ein nicht aktivierter Archivtest. Nach der Änderung mit gesetztem `EOS_TEST_OCPP21_MAIN`: **5 bestanden, 0 Fehler, 0 übersprungen** (Node 24.22.3).

- Tatsächlicher `applySetpoint → applyEvcsSetpoint → DatapointRegistry → setForeignStateAsync`-Pfad: 5700 W → 0 → bestehender Keepalive → 5700 W.
- W- und A-Ausgänge mit konfiguriertem Minimum: Stopp bleibt 0, positive Mindest-/Höchstwerte bleiben erhalten. Unmarkierte generische Zahlenschreibzugriffe behalten auch bei 0 die alte Begrenzung.
- Nullpunktwechsel in beiden Richtungen passieren die Deadband; gleiche 0 wird weiter dedupliziert.
- Fehlgeschlagener Stopp wird erneut geschrieben; W→kW-Umrechnung liefert 5,7 → 0 → 0. PV-Pause setzt Availability nicht auf Inoperative.
- Historischer OCPP21-Adapterpfad: tatsächliches `onStateChange` für 1.6, 2.0.1 und 2.1 erzeugt Profile mit 5700 bzw. 0. Netzwerk-/RPC-Gegenstelle ist simuliert, keine reale Wallbox.

Belege: `raw/backup-followup/evcs-stop-writer-before.tap`, `evcs-stop-writer-after.tap` sowie `evcs-stop-writer-test-eslint.log`. ESLint des neuen Tests mit dem vorhandenen CommonJS-Regelsatz besteht. Ein zusätzlicher direkter Aufruf des allgemeinen Legacy-TypeScript-Regelsatzes auf den beiden alten Dateien und dem Test war nicht grün (244 überwiegend bestehende Stil-/Typisierungsprobleme und Test außerhalb des TS-Projekts); daraus wird keine bestandene Gesamt-Lintprüfung abgeleitet. Der zentrale Release-/Runtime-Check ist separat zu bewerten.

## OCPP21-Archiv und offene Anlagenbestätigung

Die separat bereitgestellte Quelle ist **Version 0.2.2 aus einem älteren Archiv**, nicht nachweislich die installierte Version. Sie wurde nur gelesen und mit simuliertem RPC getestet, nicht verändert oder paketiert. `control.chargeLimit=0` wird dort nicht auf 6 A angehoben und nicht übersprungen. Ein weiterer Befund: auch eine simulierte `SetChargingProfile`-Antwort `Rejected` führt anschließend zu lokalem `ack:true`; das ist keine Hardwarebestätigung. Diese Quelle besitzt außerdem nicht die neueren `requestedChargeLimit`-/`appliedChargeLimit`-/`lastSuccess`-Diagnosestates, die der EOS-Bestätigungsweg verwendet. EOS darf die erfolgreiche Datenpunktschreibung daher nicht mit tatsächlich gestoppter Ladung gleichsetzen.

Installierte OCPP21-Version, reales Profile-Accepted/Rejected, tatsächlicher Leistungsabfall und zuverlässiger Wiederanlauf der Dousida Energyline wurden in dieser Umgebung nicht geprüft. Ein Herstellerfehler oder eine bestandene Hardwareabnahme wird nicht behauptet. Die EOS-Paketkorrektur ersetzt diese noch ausstehende Anlagenbeobachtung nicht.
