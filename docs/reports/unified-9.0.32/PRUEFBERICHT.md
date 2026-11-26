# EOS 9.0.32 – Gebäudeverbrauch im LIVE-Energiefluss

## Feldbefund

Der Gebäudeverbrauch wird seit dem Update auf 9.0.29 zeitweise mit `--` angezeigt. Der Vergleich der ausgelieferten Backend-Bilanz und der LIVE-Anzeige in 9.0.28 und 9.0.29 ergab identische Implementierungen. Die auf der Anlage wirksame Kombination aus Messwerten, Zuordnungen und Zeitstempeln zum Zeitpunkt des Ausfalls ist offen.

Für den Screenshot ergeben 1,5 kW PV, 1,8 kW Einspeisung und angezeigte 2,8 kW Speicherladung ohne weitere Erzeugung einen rechnerischen Rest von −3,1 kW. Bei einer gemeinsamen vorzeichenbehafteten Lade-/Entladequelle konnte die bisherige Anzeige das Vorzeichen des Rohwerts verlieren. Für die Anlagenprüfung sind deshalb auch die ursprüngliche Speichermessung und ihr Messzeitstempel relevant.

## Änderung

Ein gültiger direkt gemessener Gesamtverbrauch hat Vorrang. Fehlt er, verwendet die Bilanz gültige Messwerte für Erzeugung, Netzbezug, Einspeisung und den konfigurierten Speicher. Die Berechnung verwendet die Zeitstempel der ausgewählten Quellen. Gültige 0 W bleiben sichtbar. Eine fehlende, veraltete oder ungültige Quelle und eine negative Leistungsbilanz führen zu `--` mit einem Hinweis auf die Ursache. [Berechnung und Messwertaufnahme](../../../ui/src-ts/runtime-executables/main.ts)

Die LIVE-Anzeige verwendet die normalisierten Netz- und Speicherwerte der Bilanz. Damit stimmen Richtung und Vorzeichen im Diagramm und in der Seitenleiste überein. Die Verbrauchsanzeige im Gebäude-Knoten berücksichtigt die Einstellungen für die separat dargestellte Ladeleistung und weitere Verbraucher. [LIVE-Ansicht](../../../ui/src-ts/runtime-executables/www/app.ts) · [Bilanzanzeige](../../../ui/src-ts/runtime-executables/www/power-measurements.ts)

Die Nachrechnung führt jeweils einen Lauf aus und nutzt den vorhandenen Datenpunktabruf für die Überprüfung ablaufender Messwerte. Treffen während eines Laufs neue Messwerte ein, folgt eine weitere Berechnung mit den aktuellen Daten. Das Dashboard aktualisiert die Darstellung im Fünf-Sekunden-Takt. [Zeitsteuerung und Zustandsverarbeitung](../../../ui/src-ts/runtime-executables/main.ts)

## Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| Versionsvergleich 9.0.28 und 9.0.29 | Die ausgelieferten Dateien für Bilanz, EMS-Messwertverarbeitung und LIVE-Projektion stimmen byteweise überein. |
| Auswahl und Zeitstempel | Regressionsfälle für ausgewählte Netz- und Speicherquellen, deren ursprüngliche Zeitstempel und die Priorität des direkten Messwerts. |
| Ablauf und Wiederaufnahme | Regressionsfälle für Messwertablauf, wieder eintreffende Messungen und Zustandsänderungen während einer laufenden Berechnung. |
| Bilanz und LIVE-Projektion | Regressionsfälle für Bezug, Einspeisung, Laden und Entladen, gültige 0 W, fehlende oder fehlerhafte Eingänge und negative Bilanz. |
| Desktop- und Mobilansicht | 20 von 20 Szenarien bestanden. Der Chromium-Test hat die mitgelieferte Dashboard-Struktur mit den produktiven Anzeigefunktionen und kontrollierten Messwerten verwendet. |
| Fünf-Sekunden-Takt | Im Chromium-Test mit simulierten Live-Ereignissen und Tab-Wechseln bestätigt. |
| Vollständiges `npm test` unter Node.js 22 | v22.23.4, 2747 erfasst, 2745 bestanden, 2 ausgelassen |
| Vollständiges `npm test` unter Node.js 24 | v24.22.3, 2747 erfasst, 2745 bestanden, 2 ausgelassen |
| Typprüfung, Lint und Builds | Bestanden |
| Prüfung auf dem betroffenen Raspberry Pi | Offen. Die Prüfung umfasst die NVP-Richtung, das Speichervorzeichen und die Zeitstempel bei Bezug, Einspeisung sowie Lade- und Entladebetrieb. |

Die Aktualisierung erfolgt in der bestehenden Instanz. Die verknüpften Messpunkte und die Rückfallmöglichkeit sind bei der Anlagenprüfung nach der [Anleitung zu 9.0.32](../../start/START_HIER_9.0.32.md) zu berücksichtigen.

Bei Anlagen mit ausschließlich DC- oder Speicherfarm-PV ist zusätzlich die Nachtmessung zu prüfen. Im bestehenden DC-Spiegel kann 0 W aus einem Messwert oder aus einem fehlenden Eingang stammen. Ohne Nachweis der gültigen Quelle kann die Bilanz bei 0 W PV weiterhin offen bleiben. Für die Kundenfreigabe fehlen die Messwert- und Wiederanlaufprüfung an der Pilotanlage.
