<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. -->
# NexoWatt EOS 1.0.36 – Bestätigte Lademodi und HTTPS-Bedienung

Vollständiger Folgestand auf 1.0.35. Dieser Stand ist nicht für den Produktivbetrieb freigegeben. Der Status `review` erlaubt den vorgesehenen technischen Eigentest; er ersetzt weder die konkrete Anlagenabnahme noch die Herstellerentscheidung.

Die Lademodusauswahl auf Hauptseite und EVCS-Seite darf keinen erfolgreichen Wechsel anzeigen, wenn die Schreibanfrage abgewiesen wurde oder ihre Antwort verloren ging. Die Anzeige richtet sich nach dem zurückgelesenen Serverzustand. Verbindungs-, Sitzungs- und Schreibfehler werden sichtbar; je Ladepunkt werden konkurrierende Moduswechsel begrenzt. Die bestehende Berechtigungsprüfung bleibt erforderlich.

Auto mit der Betriebsstrategie `cheap-grid` berücksichtigt auch positive günstige Tarifpreise, wenn die vorhandene Netz-/Tariffreigabe und frische Preisdaten dies erlauben. Tarif-, Prioritäts-, Haltezeit- und Leistungsgrenzen bleiben maßgeblich. Bekannte negierte Fahrzeugtexte wie `No EV connected` werden vor allgemeinen positiven Textmustern behandelt. Der Ladediagnoseexport trennt den gewählten Benutzermodus vom effektiven Modus und ergänzt Fahrzeug-/Bedarfszustände. Ein effektiver PV-Untermodus kann im Auto-Betrieb weiterhin beabsichtigt sein.

HTTPS im Browser stellt die OCPP-Verbindung der Wallbox nicht automatisch von WS auf WSS um. Der UI-Adapter steuert weiterhin über seine ioBroker-Datenpunktverträge; der separate OCPP-Adapter besitzt die Wallboxverbindung. Beim HTTPS-Adminproxy gelten zusätzliche Sitzungs-/Zugangsgrenzen, deren Fehler die Oberfläche melden muss. Die gezielten Befunde und Prüfgrenzen stehen im [aktuellen Prüfbericht](reports/charging-mode-https-2026-11-11/PRUEFBERICHT_DE.md).

Ein alter OCPP-Transaktionsstatus kann einen neueren Vorbereitungszustand überstimmen. Ohne nachgewiesene Sessiongrenze darf eine echte Fahrzeugpause nicht automatisch aufgehoben werden. Dieser Wiederanlaufbefund bleibt offen; das Paket behauptet keine Korrektur dieses gerätespezifisch zu prüfenden Falls.

Vor dem Update Adapterkonfiguration und vollständigen Stand 1.0.35 sichern. Ein reguläres ioBroker-Adapterupgrade verwenden, anschließend den UI-Adapter neu starten und Haupt-/EVCS-Seite vollständig neu laden. Bei direkter PWA-Nutzung die aktualisierten Webdateien übernehmen; im Adminproxy bleibt der Root-Serviceworker wie bisher deaktiviert. HTTPS, Zertifikatsprüfung oder Berechtigungen nicht zur Fehlerumgehung abschalten.

Für die Anlagenabnahme die tatsächlich eingesetzte Wallbox, Firmware und OCPP-Adapterversion dokumentieren. Prüfen: erfolgreiche und abgewiesene Moduswechsel, Auto bei PV und Tarifwechsel, PV ohne unerwünschten Netzbezug, Min+PV, Boost und Boost-Abbruch, Zielladen über Mitternacht, lange Fahrzeugpause sowie Wiederanlauf ohne Umstecken. Netz-/Stationsgrenzen und echte Fehler-/Pausenzustände müssen Vorrang behalten. Unveränderten JSON-Diagnoseexport und Rohzustände mit Zeitstempeln sichern. Rückfall bei Abweichungen: gesicherten vollständigen Stand 1.0.35 und dessen Konfiguration wiederherstellen.

Vollständige Build-/Paket-/Regressionsergebnisse werden ausschließlich mit tatsächlich ausgeführten Rohbelegen im aktuellen Prüfbericht geführt. Ältere Berichte und der frühere reine 1.0.35-Quellpatch beschreiben ihren damaligen Prüfstand.
