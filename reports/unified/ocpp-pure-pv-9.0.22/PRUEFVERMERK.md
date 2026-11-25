# Expliziter PV-Lademodus bei OCPP – Korrektur für 9.0.22

25.11.2026. Nutzer meldet eine Dousida Energyline am Adapter ocpp21: Trotz gewähltem reinem PV-Modus und zu wenig PV-Überschuss lädt das Fahrzeug weiter. Installierter EOS-Stand: 9.0.21. Installierte ocpp21-Version und konkrete Live-Konfiguration wurden nicht ausgelesen.

## Befund PV922-01

`ChargingManagementModule.tick()` wandelte einen ausdrücklich gewählten `userMode=pv` bei `tarif.netzbezugBevorzugt=true` in `effectiveMode=normal` um. Dadurch konnte die wirtschaftliche Negativpreisfreigabe den gewählten PV-Modus übersteuern. Ein benachbarter Kommentar behauptete bereits das gegenteilige Sollverhalten. Auch Min+PV wurde auf normal erweitert.

Reproduktion mit tatsächlichem Modul, endgültiger TypeScript-Allocation und realem Datenpunkt-Schreibpfad bis zum simulierten ioBroker-Ausgang: OCPP-Leistungsrückmeldung 5.700 W, frisches zentrales PV-Budget 1.000 W, explizit PV, Negativpreispräferenz aktiv. Vor Änderung entstanden `effectiveMode=normal`, `setW=11000` und `enable=true`. Drei neue Regressionstests schlugen vor Änderung fehl.

Korrektur: Explizites PV bleibt PV. Explizites Min+PV hält nur den dafür vorgesehenen Mindest-Netzanteil und verwendet PV für Mehrleistung. Auto/Global dürfen weiterhin die bereits bestehende wirtschaftliche Netzfreigabe nutzen. Netzanschluss-, Geräte-, Phasen-, §14a-, Mindestleistungs- und Stop-/Startgrenzen wurden nicht angehoben. Keine herstellerspezifischen Dousida-Befehle eingeführt.

## Prüfungen

Node.js 24.22.3, lokale Testumgebung. Keine Kundenanlage verbunden. OCPP-Messwerte und ioBroker-Datenbank sind simuliert; es ist kein Hardwaretest der Dousida Energyline.

| Prüfung | Ergebnis |
| --- | --- |
| `node --test test/eos-charging-pure-pv-ocpp.test.cjs` | 3/3 bestanden, vor Korrektur 0/3 |
| Explizit PV + 1.000 W Überschuss + Negativpreispräferenz | PV bleibt wirksam, tatsächlicher DP-Ausgang erhält 0 W |
| Min+PV + kein Überschuss | Nur konfigurierte Mindestleistung; kein Wechsel auf normale Netzladung |
| Auto + wirtschaftliche Freigabe | Vorgesehenes Netzladen weiterhin möglich |
| Start mit 6.000 W Überschuss → laufend → 1.000 W Überschuss → bestätigte 0-W-Ausgabe → simuliert 0 W/SuspendedEVSE → Überschuss wieder vorhanden | Stop-/Wiederanlaufkette bestanden; angenommener Befehl und simulierte physische Rückmeldung getrennt |
| `node ui/scripts/verify-rc60-universal-auto-wallbox.js` | Bestanden |
| `node ui/scripts/verify-stable-1.0.4-auto-pv-phases.cjs` | 37 Szenariogruppen bestanden |
| `node ui/scripts/verify-rc57-ocpp-stability.js` | Bestanden |
| `node ui/scripts/verify-charging-minpv-base-reaction.js` | Nicht bestanden: historische Source-String-Assertion erwartet optimistische LIVE-Modusanzeige. Aktuelle UI nutzt bestätigte Schreibvorgänge; nicht als bestandenen Gesamttest ausgegeben. |

## Änderung und Grenzen

Geändert: `ui/src-ts/runtime-executables/ems/modules/charging-management.ts` und zugehörige Runtime, zwei Moduszweige. Neue Regression: `test/eos-charging-pure-pv-ocpp.test.cjs`. Vorher parallel durchgeführte Null-/Frischekorrekturen in der gleichen Datei bleiben erhalten.

Der Fehler ist reproduziert; ob die Negativpreispräferenz auf der konkreten Anlage aktiv war, ist ohne deren Konfiguration/States nicht bewiesen. Zusätzlich werden zentrale PV-Budget-Frische sowie der separate ocpp21-Befehlsweg geprüft. Ein erfolgreicher Datenpunktschreibvorgang beweist keine akzeptierte OCPP-Antwort und keine tatsächliche Leistungsreduzierung des Fahrzeugs.

Anlagenprüfung nach Installation: rein PV auswählen, aktuellen Überschuss und zentralen PV-Grant mit Zählerdaten vergleichen, Stop bei anhaltendem Defizit überprüfen, OCPP-Antwort und gemessene Ladeleistung prüfen, bei erneut ausreichendem Überschuss Wiederanlauf beobachten. Keine Produktivfreigabe oder 100-%-Zuverlässigkeitsgarantie aus diesen Softwaretests ableiten.
