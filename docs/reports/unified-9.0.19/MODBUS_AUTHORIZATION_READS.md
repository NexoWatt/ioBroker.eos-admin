# Modbus: Berechtigungssperre ist kein ungültiges Register

Stand: 2026-11-24. Vertraulich, NexoWatt.

## Reproduzierter Fehler

Der tatsächliche SolaX-Hybrid-Vertrag nutzt `continueOnReadError` und eine vorübergehende Aussetzung fehlerhafter optionaler Registergruppen für 300000 ms. Im bisherigen Modbus-Treiber wurden auch `EOS_DEVICES_NOT_AUTHORIZED` und explizite Stop-/Eigentumssperren in diese Registerbehandlung übernommen. Ein nach dem ersten Leseblock entzogenes Hosted-Gate konnte deshalb einen erfolgreichen Teilsnapshot liefern und die übrigen gültigen Gruppen für folgende Polls ausschließen.

Die neue Regression verwendet den echten `guardDriver`, den echten Modbus-Leseablauf und das unveränderte SolaX-Hybrid-Template. Die freigegebene erste Clientabfrage beendet im Fixture die Betriebsberechtigung; die tatsächliche Dispatch-Sperre verhindert die nächste physische Abfrage. Vor dem Fix scheiterten vier Regressionen: fehlender Gesamtabbruch, unerwünschter Skip-Cache, vergiftete Split-Reads und verschluckte Autorisierungsfehler im dokumentierten Adressfallback. Der Test für ein wirklich ungültiges optionales Register bestand bereits und muss weiter bestehen.

## Gezielte Korrektur

`modules/devices/lib/drivers/modbus.js` reicht bekannte Betriebsgrenzen unverändert weiter: `EOS_DEVICES_NOT_AUTHORIZED`, `EOS_DEVICES_STOPPED`, `EOS_MODULE_STOPPED` und `EOS_OWNERSHIP_REQUIRED`. Normale Registergruppen, Coils, Discrete Inputs, Split-Reads und dokumentierte Adressfallbacks brechen damit den gesamten aktuellen Snapshot ab. Keine optionale Gruppe erhält aufgrund dieser Sperre einen Skip-/Warn-Cacheeintrag. Eine echte Modbus-Exception bleibt weiterhin sichtbar und wird gemäß vorhandener Registerpolitik behandelt.

Optionale SunSpec-Scans dürfen dieselbe Sperre ebenfalls nicht als abgeschlossenen leeren Modellscan speichern. Die nächste ausdrücklich erlaubte Abfrage liest die betroffenen Gruppen unmittelbar wieder. Der Fix erteilt selbst keine Betriebsfreigabe und entfernt keine vorhandenen legitimen Register-Cooldowns.

## Prüfstand

- Neue Datei `modules/devices/test/modbusAuthorizationReads.test.js`: sieben Tests bestanden.
- Mit den 27 vorhandenen Tests aus `modbusReadIntegrity.test.js`: **34 Tests unter Node.js 22 und 24 bestanden**.
- Reale Hosted-Berechtigungsprüfung, tatsächliche SolaX-Metadaten und echter Modbus-Lesealgorithmus; TCP-/Serialclient kontrolliert simuliert. Kein Hardware- oder Netzwerktest.
- JavaScript-Syntaxprüfung bestanden.
- Der vollständige bestehende Modbus-Treiber ist nicht streng typisiert und hat unter dem Devices-ESLint weiterhin historische Befunde. Der Vergleich mit der unveränderten 9.0.18-Datei zeigt keine neu eingeführte Befundart/-anzahl; die vollständige Datei wird hier ausdrücklich nicht als lintfehlerfrei bezeichnet. Keine Regel wurde deaktiviert.

Die Änderung ergänzt die separat geprüfte Wiederaufnahme der Geräte-Runtime nach einer vorübergehenden Betriebsfreigabesperre. Sie ersetzt weder den zentralen Lizenz-/Eigentumsnachweis noch das Runtime-Lifecycle-Fencing.
