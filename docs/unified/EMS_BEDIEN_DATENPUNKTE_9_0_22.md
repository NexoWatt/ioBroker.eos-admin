# Normale EMS-Bediendatenpunkte in 9.0.22

Nach der aktualisierten Vorgabe werden vorhandene normale ioBroker-Datenpunkte verwendet. Es gibt keine zusätzliche Integrationsanmeldung, keine Tokenverwaltung und keine neue ACL-Umschreibung. Die bestehenden ioBroker-Rechte und die bisherigen EOS-Webanmeldungen bleiben bestehen. HomeKit benötigt weiterhin eine passende ioBroker-/HomeKit-Bridge; diese ordnet ihre Bedienelemente den folgenden Zuständen zu. EOS stellt hier keinen nativen HomeKit-Server bereit.

## Ladepunkte

Basis: `<Namespace>.chargingManagement.wallboxes.<Schlüssel>.`.

Der tatsächliche Namespace lautet beispielsweise `eos-admin.0`; bei bestätigter Übernahme einer Bestandsanlage kann er `nexowatt-ui.0` bleiben. Vorhandene Ladepunktschlüssel wie `lp1` bleiben erhalten. Die Zuordnung wird nicht nach einer neu sortierten Liste umnummeriert.

| Funktion | Datenpunkt | Wert |
|---|---|---|
| Station freigeben/sperren, geeigneter HomeKit-Schalter | `userStationEnabled` | Boolean `true` / `false` |
| Lademodus | `userMode` | `auto`, `pv`, `minpv`, `boost` |
| Quelle im Auto-Modus | `userAutoSource` | `standard`, `strategy` |
| Phasenwunsch | `userPhaseMode` | `fixed-1p`, `fixed-3p`, `auto-pv`; nur vorhandene Gerätefunktion wird umgesetzt |
| Speicher-Mitnutzung | `userStorageAssistEnabled` | Boolean; bisherige Installer-/Anlagenfreigabe bleibt maßgeblich |
| Ladeziel aktiv | `goalEnabled` | Boolean |
| Ziel-SoC | `goalTargetSocPct` | Zahl 0–100, Prozent |
| Zielzeit | `goalFinishTs` | Nicht negative ganze Epoch-Millisekunden; 0 löscht die Zielzeit; maximal 366 Tage voraus |
| Fahrzeugkapazität für Zielplanung | `goalBatteryKwh` | Zahl 0–5000, kWh |
| EMS-Regelung aktiv | `userEnabled` | Boolean; **kein Stations-Ein/Aus-Schalter** |

Die bestehenden leeren String-Vorgaben bei `userMode`, `userAutoSource` und `userPhaseMode` bleiben als Rückfall auf die Anlagenkonfiguration unterstützt. Vergangene Zielzeiten bleiben für den vorhandenen täglichen Zeitplan zulässig und werden wie bisher weitergeführt.

Eine Bridge schreibt Bedienwünsche mit `ack: false` und den oben genannten tatsächlichen Datentypen. Beispielsweise ist der boolesche Wert `false` zulässig, der Text `"false"` nicht. Weder `ack` noch `from` dienen als zusätzliche Zugriffskontrolle. Der Datenpunkt `userStationEnabled=false` sperrt die Station, ohne `userEnabled` zu ändern. Ein PV-Warten mit 0 W schaltet die Station nicht automatisch ab.

Kompatibilität: `<Namespace>.evcs.<Nummer>.mode` bleibt als numerischer Wunsch verfügbar: 0 = Auto, 1 = Boost, 2 = Min+PV, 3 = PV. Ungültige numerische oder als Text übermittelte Werte werden nicht mehr stillschweigend in Auto umgewandelt. Der vorhandene `lp<Nummer>.userMode` bleibt bei einem solchen ungültigen Kompatibilitätsbefehl unverändert.

## Prüfung und Wirkung

Alle normalen Bediendatenpunkte werden sowohl bei einem Ereignis als auch beim Lesen aus dem Cache beziehungsweise der Datenbank geprüft. Damit gilt die Prüfung nach einem Neustart auch für vorher gespeicherte Werte. Ungültige Befehle werden nicht als bestätigt oder erfolgreich ausgeführt ausgegeben.

Bei einem ungültigen Ladepunkt-Bedienwert bleibt der Rohwert im ioBroker-Datenpunkt zur Korrektur erhalten. Nur der betroffene Ladepunkt wird über die bestehende EMS-Sperre von positiver Ladeleistung ausgeschlossen. Die neuen lesbaren Diagnosezustände heißen:

- `controlInputsValid`: Ob die Bedienwerte des Ladepunkts gültig sind.
- `controlInputError`: Namen der ungültigen Felder.

Zusätzlich erklärt `unavailableReason` die Sperre mit `invalid_control: …`. Nach einer gültigen Korrektur prüft der nächste EMS-Zyklus erneut. Andere Ladepunkte, Anlagenlimits, RFID-Regeln, Phasenschutz, Gerätefehler, Offline-/Messwertschutz und bestehende Regelungspfade bleiben maßgeblich. Die Prüfung ergänzt die Regelung und schreibt keine unmittelbaren Hardware-Sollwerte.

Ein gespeicherter Wunsch oder ein bestätigter ioBroker-Schreibaufruf ist keine Bestätigung einer realen Stellgliedreaktion. Dafür die effektive Stationsfreigabe, den effektiven Modus, Sperrgründe und aktuelle Messwerte auswerten. Nicht jede Gerätekategorie unterstützt jede Funktion; vorhandene Geräte-/Installerfreigaben werden nicht durch einen Datenpunkt-Schreibwunsch erweitert.

## Vertrauensgrenze

Ein anderer Adapter mit ausreichenden ioBroker-Rechten kann diese normalen Bediendatenpunkte schreiben, wie ausdrücklich gewünscht. Es wird keine zusätzliche isolierte Autorisierung pro Fremdanbieter oder einzelner Aktion eingeführt. Zugangsschutz und Auswahl vertrauenswürdiger Adapter bleiben Aufgabe der vorhandenen ioBroker-/Betriebssystemkonfiguration. Keine Passwörter in Bediendatenpunkten hinterlegen. Ein kompromittierter Adapter unter derselben Dienstkennung wird hierdurch nicht isoliert.

## Nachweise und Grenzen

`test/eos-ems-control-datapoints.test.cjs` führt den echten Ladepunkt-Regelzyklus mit isolierter Datenbank-/Protokollsimulation aus und prüft gültige Null-/Boolean-Werte, ungültige gespeicherte/cachebasierte Wünsche, Stationssperre bei weiter aktivierter EMS-Regelung sowie den tatsächlichen Hosted-State-Handler mit Bestandsnamespace und Kompatibilitätsmodus. Die vorhandenen Stationsfreigabe- und Availability-Regressionsprüfungen werden zusätzlich ausgeführt. Die Tests verwenden keine realen Wallboxen und sind keine HomeKit-/Hardwareabnahme.

Prüfstand vom 25.11.2026: Unter Node.js 22.23.4 und 24.22.3 jeweils 18/18 Tests bestanden (6 Bedien-DP-, 3 EVCS-Mirror- und 9 Hosted-Drain-Tests). Zusätzlich bestanden auf beiden Laufzeiten `verify-evcs-station-permission.js`, `verify-rc63-availability-storage-grid-gate.js` und `verify-safety-envelope-final-write.js`. Die neue Validierung besteht strikte TypeScript-Prüfung und typgestütztes ESLint. Bereinigte Nachweise liegen unter `docs/reports/unified-9.0.22/raw/ems-control-points/`.
