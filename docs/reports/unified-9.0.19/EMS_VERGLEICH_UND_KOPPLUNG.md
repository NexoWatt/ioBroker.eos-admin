# Gerätekopplung – Vergleich und EOS-Entscheidung

Recherche: 24.11.2026, offizielle Projektdokumentation. Es wurde kein fremder Programmcode oder fremdes UI-Design übernommen.

| Ansatz | Dokumentierte Umsetzung | Ableitung für NexoWatt EOS |
| --- | --- | --- |
| OpenEMS: Gerätefähigkeiten | „Natures“ beschreiben erforderliche Kanäle eines Geräts; Controller verwenden diese Fähigkeiten herstellerunabhängig. | Alias-V1-Namen allein reichen nicht: Quelle, Datentyp, Einheit, Messrichtung und echte Schreibfähigkeit müssen zum Geräteprofil passen. |
| OpenEMS: Regelzuständigkeit | Controller werden priorisiert ausgeführt; spätere Controller dürfen frühere Ergebnisse nicht beliebig überschreiben. | Alle passenden Logiken dürfen auf dasselbe bestätigte Gerätemodell zugreifen. Physische Sollwerte bleiben über die vorhandene zentrale Regelzuständigkeit und Grenzen koordiniert. |
| evcc: Anlagenrolle | Geräte werden einmal identifiziert und mit Rollen wie Netz, PV oder Batterie der Anlage zugeordnet; ein Ladepunkt verweist auf seine Komponenten. | Rolle im Geräteeditor festlegen; EMS-Zeilen, NVP-Messpunkt und Energiefluss aus derselben Konfiguration erzeugen. Keine erneute DP-Auswahl für bekannte Fähigkeiten. |
| evcc: Einrichtung | Web-Konfiguration gliedert Anlage, Ladepunkte, Solar/Batterie und weitere Integrationen. | Geräteformular nach Verbindung, Anlagenaufgabe, erforderlichen Betriebsgrenzen und Ergebnis gliedern; technische Details bei Bedarf öffnen. |

## Festgelegtes EOS-Verhalten

Ein als M0 gewählter SMA-Zähler versorgt den gemeinsamen NVP-Messwert. Eine Speicherfarm verwendet die gewählten, tatsächlich steuerbaren Mitglieder; Leistung und SOC werden aus ihren vorhandenen bestätigten Quellen abgeleitet. Unterstützte Wallboxen erhalten einen Ladepunkt mit ihren gemessenen Werten und passenden Steuerfähigkeiten. Erzeugungs- und Verbrauchszuordnungen speisen die dafür vorgesehenen Energieflussfelder.

Die ausdrückliche Inbetriebnahme im Gerätebereich aktiviert die für diese Aufgabe nötige Basisfunktion. Ob der Kunde beispielsweise Arbitrage, Lastspitzenkappung oder besondere Zeitprogramme nutzen möchte, bleibt eine Betriebsstrategie. Eine Gerätefähigkeit bedeutet nicht, dass alle Strategien gleichzeitig eigenständig auf denselben Aktor schreiben dürfen. Später bewusst deaktivierte Apps bleiben bei Hintergrundabgleich, Neustart und Update deaktiviert.

Ein Gerät stellt nur nachgewiesene Funktionen bereit. Fehlende Messung, fehlende Steuerfähigkeit oder ein unklarer Messbereich werden sichtbar benannt. Zusätzliche Register werden nicht anhand des Herstellernamens geraten. Die tatsächliche Abdeckung der vorhandenen EOS-Verbraucher steht im separaten Kategorienreview; diese Architekturentscheidung ist kein Nachweis für sämtliche Herstellergeräte oder zukünftige Funktionen.

## Quellen

- OpenEMS, [Core concepts & terminology](https://openems.github.io/openems.io/openems/latest/coreconcepts.html): Komponentenidentität, Kanäle und Gerätefähigkeiten.
- OpenEMS, [Edge Architecture](https://openems.github.io/openems.io/openems/latest/edge/architecture.html): Controller, Priorisierung und konsistenter Regelzyklus.
- evcc, [Configuration](https://docs.evcc.io/en/installation/configuration/): Web-Einrichtung und Anlagenkomponenten.
- evcc, [Meters](https://docs.evcc.io/en/reference/configuration/meters/): Messrollen und einheitliche Messgrößen. Dessen Vorzeichenkonvention ist keine Anweisung, bestehende EOS-Vorzeichen pauschal zu ändern.
