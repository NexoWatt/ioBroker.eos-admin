# EVCS-Spiegelobjekte: dataFresh und chargingState

Stand: 2026-11-24. Vertraulich, NexoWatt. Gezielter Fehlerfix für 9.0.19.

## Ursache und Änderung

Die produktive Eingangszuordnung `_nwEvcsInputSpecsForWallbox` kann `dataFreshId` und `chargingStateId` lesen und ihre Werte nach `evcs.N.dataFresh` beziehungsweise `evcs.N.chargingState` spiegeln. `ensureEvcsStates` legte diese beiden Objektdefinitionen bisher nicht an. Der Controller erhielt dadurch wiederkehrende Schreibvorgänge für Zustände ohne bestehendes Objekt.

Die kanonische Quelle `ui/src-ts/runtime-executables/main.ts` legt nun beide Zustände vor den ersten Abonnements und Initiallesungen an: `dataFresh` als nur lesbaren Boolean, `chargingState` als nur lesbaren String. Der vorhandene Objekt-anlegen-wenn-fehlend-Vertrag erhält bestehende Werte und Kundenmetadaten; es werden keine Messwerte vorgetäuscht. Derselbe Pfad ist bei Start, Update und nachträglicher Ladepunktanlage wirksam.

Beide Zustände sind außerdem als nur lesbare EVCS-Spiegel klassifiziert. Ihre eigenen `ack=true`-Rückmeldungen dürfen den ursprünglichen Quellenzeitstempel nicht erneuern. Insbesondere bleiben ein altes `dataFresh=false` und ein alter Ladezustand alt, statt durch den Spiegel als aktuelle Fremdprobe zu erscheinen.

Keine Warnungsunterdrückung, keine Rechteänderung und keine Bearbeitung fremder Admin-/Adapterobjekte sind Bestandteil dieses Fixes.

## Reproduktion am unveränderten Altstand

Ausgeführt gegen die echte 9.0.18-Runtime in `source-918/iobroker.eos-admin/ui/main.js` mit deren eigenem `ui/test/unified/http-harness.cjs`. SHA-256 der geprüften alten Runtime:

`513833a38047c2bf18f3a6d4207b4a7af5c9ed38a20f5915294a06414609bb2a`

Zwei Ladepunkte wurden auf dieselben simulierten OCPP-Quellen gelegt; danach wurden die echten Methoden `ensureEvcsStates()` und `subscribeEvcsMappedStates()` ausgeführt. Der Fixture-Owner erfasste die tatsächlichen qualifizierten `setForeignStateAsync`-Aufrufe und prüfte dabei den Objektbestand. Das Ergebnis wurde mit `assert.deepEqual` bestätigt:

```json
{
  "version": "9.0.18",
  "actualMissingObjectWriteAttempts": [
    "eos-admin.0.evcs.1.dataFresh",
    "eos-admin.0.evcs.2.dataFresh",
    "eos-admin.0.evcs.1.chargingState",
    "eos-admin.0.evcs.2.chargingState"
  ],
  "oldReadOnlyDataFresh": false,
  "oldReadOnlyChargingState": false
}
```

Dies ist ein Laufzeitnachweis mit isolierter ioBroker-Datenbank-Fixture, kein Hardwaretest und keine bloße Textsuche.

## Regressionen

`test/eos-device-ems-evcs-mirrors.test.cjs` enthält drei neue Tests mit den echten generierten Hosted-Runtime-Methoden:

1. Zwei Ladepunkte, alle 15 unterstützten Eingangsfelder: jedes Objekt besteht vor dem ersten Spiegel-Schreibvorgang; keine Telemetriewerte werden beim Anlegen initialisiert.
2. Simuliertes Update mit fehlenden Objektdefinitionen und wiederholte Start-Anlage: Werte und Energiezähler bleiben erhalten, fehlende Metadaten werden ergänzt.
3. Nachträgliche Erweiterung auf drei Ladepunkte über die echte Installer-Objektvorbereitung: keine Schreibvorgänge ohne Objekt; eigene Bestätigungsereignisse verändern weder den alten Quellenzeitstempel noch `dataFresh=false`.

Die drei neuen Tests und die acht bestehenden Installer-Lifecycle-Tests bestehen unter Node.js 22 und 24. Der reguläre `test:unified`-Lauf umfasst den neuen Dateinamen bereits über `test/eos-device-ems*.test.cjs`. Die Runtime wurde mit dem vorhandenen TypeScript-Runtime-Build erzeugt; dessen Syntax-/Generierungsprüfung bestand. Der vollständige ioBroker-Start mit produktiver Datenbank sowie reale OCPP-Geräte sind nicht Bestandteil dieser gezielten Fixtureprüfung.
