# Alias-Messwertfrische in 9.0.19

## Befund und Änderung

Bisher unterdrückte `DeviceRuntime._setStateCached` identische Messwerte bei Zählern, Speichern und PV-Wechselrichtern dauerhaft. Nur Ladepunkte erneuerten die Zeitstempel regelmäßig. Dadurch konnten ein unveränderter SMA-Netzbezug und konstante FENECON-PV-Leistung trotz erfolgreicher Abfragen als veraltet erscheinen. Die Frischeprüfung des EMS darf deshalb nicht gelockert werden.

Die vorhandene begrenzte Aktualisierung gilt nun auch für betriebliche Leistungs-, SOC-, Strom-, Spannungs- und relevante Status-Aliasse der Klassen meter, storageSystem, battery, batteryInverter, pvInverter und solarCharger. Das Intervall wird aus der bestehenden Gerätekonfiguration bzw. dem Pollintervall bestimmt und auf 1–10 Sekunden begrenzt. Keine neuen Timer, keine weiteren Gerätebefehle und keine Änderung gespeicherter Zuordnungen.

| Quelle | Nachweis für die erneute Veröffentlichung eines identischen Werts |
| --- | --- |
| Abgefragte Protokolle | Der konkrete Quell-Datenpunkt wurde im erfolgreichen aktuellen Snapshot gelesen. Berechnete Aliasse protokollieren ihre tatsächlich verwendeten Quellen. |
| SMA Speedwire | Zusätzlich muss ein neuer Telegramm-Zeitstempel seit der letzten Alias-Veröffentlichung vorliegen. Wiederholtes Lesen des Treibercaches genügt nicht. |
| MQTT | Alle für den Alias verwendeten Quellen müssen anhand ihrer Treiber-Zeitstempel seit der letzten Alias-Veröffentlichung erneuert worden sein. Andere Topics, alte Gesamtcaches und reine Diagnosepakete genügen nicht. |
| CAN | Ohne den notwendigen Quellnachweis bleibt das bisherige Verhalten bestehen. |
| Befehl / Zählerstand / Metadaten | Keine neue regelmäßige Veröffentlichung. Sollwert-Quittierungen erneuern keinen echten Geräte-Readback. |

Kommunikationsausfall erneuert keinen alten Messwert. Ungültige Werte werden nicht durch eine erfundene Nullmessung ersetzt. Der bestehende Heartbeat meldet weiterhin nur tatsächlich empfangene Daten.

## FENECON-Controllerblock

Mit `feneconCtrlBalancingOffset = -110` wird das Controller-Sollwertregister von 992 auf 882 verschoben (Blockbeginn 780). Die unveränderten Messregister 604, 315, 339 und 702 bleiben unverändert. Der Alias-V1-Vertrag prüft jedes Leseregister einzeln, deshalb bleiben alle acht zusätzlich verifizierten FENECON-Lesealiase verfügbar. Kein Ersatz von Register 415 durch den DC-PV enthaltenden Umrichterwert 604 und kein erfundener Readback für das nur schreibbare Register 706.

## Nachweise

`node --test modules/devices/test/aliasContractV1.test.js modules/devices/test/deviceAliasSemantics.test.js modules/devices/test/deviceAliasFreshness.test.js`: 18 Tests bestanden auf Node.js 24.22.3. Enthalten: 30 Minuten identische echte SMA-Snapshots, keine Wiederbelebung alter Speedwire-Telegramme, begrenzte FENECON-Wiederholungen, keine Frische bei Teil-/Fehlabfragen oder fremden MQTT-Topics, SolaX-Sollwertquittierung getrennt vom tatsächlichen Readback und FENECON-Offset 780/882.

Strikte JS-Typprüfung über `modules/devices/tsconfig.alias-semantics.json` sowie ESLint für neuen Helper und Regressionstest bestanden. Die Tests verwenden die echte Alias-Erzeugung und DeviceRuntime mit simulierten Gerätewerten; ein realer Anlagen-/Netzwerktest ist offen. Die Typprüfung deckt den neuen Helper ab; die große bestehende DeviceRuntime-Datei wird damit nicht als vollständig streng typisiert ausgewiesen.

## Abgrenzung

Der M0-Zähler wird von EMS, NVP und Energiefluss über `config.datapoints.gridPointPower` gelesen. Das ist bereits das Ziel der Geräte-Inbetriebnahme. Farm-SOC, Batteriefluss und PV-Aggregate besitzen vorhandene Laufzeitverbraucher und benötigen keine zusätzliche manuelle Gesamt-Datenpunktzuordnung. Die getrennt behobene Mindestanzahl von zwei Farmmitgliedern und die strikte Ablehnung boolescher Leistungsquellen werden in der zentralen Laufzeit geprüft.
