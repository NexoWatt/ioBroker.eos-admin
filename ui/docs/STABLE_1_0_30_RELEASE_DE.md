<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. Nutzung, Modifikation oder Verbreitung ohne ausdrückliche Erlaubnis untersagt. -->
# NexoWatt EOS 1.0.30 – Sicherheit und Funktionsprüfung des UI-Adapters

Dieser Stand betrifft den bestehenden ioBroker-Adapter NexoWatt UI. Er ist nicht für den Produktivbetrieb freigegeben; die Anlagenabnahme bleibt gesondert.

Ausgangspunkt ist das geprüfte vollständige Paket 1.0.29. Ein nachgewiesener
Tokenverlust durch HTTP-Weiterleitungen beim Mesh-Peer-Feldtest wird verhindert.
Antwortgrößen, JSON-Strukturen, Zeitbudget und parallele Feldtests sind begrenzt.
Die bestehenden HTTP-/LAN-/Tailscale-Verbindungen bleiben möglich.

Ein blockierender Fall beim Lesen unvollständiger ENTSOe-Tarif-XML-Daten wird
durch einen begrenzten vorwärtslaufenden Parser behoben.

Die gesamte React-Admin-Quelle erhält eine echte TypeScript-strict-Prüfung und
Laufzeitprüfungen an ihren Datengrenzen. NVP- und Dynamic-Grid-Konfigurations-APIs
werden ebenfalls ohne explizite any-Typen streng geprüft. Bestehende Bedienung,
Entwurfswerte, CAS-/Speicherkonflikte, Datenpunkte und Lizenzfreigaben bleiben
Gegenstand der Regressionstests. Es gibt keine neue Laufzeitabhängigkeit.

Ein echter ESLint-Sicherheitslauf prüft die kanonischen Runtime- und Adminquellen.
Historische Befunde werden sichtbar und gegen neue ungeprüfte Funde abgesichert;
das ist keine Behauptung eines mängelfreien Altbestands. Eigene JS-/TS-Quellen
und generierte Spiegel erhalten konsistente proprietäre Lizenzheader.
Drittanbieterhinweise und gebündelte Fremdlizenzen bleiben erhalten.

Vor Update Paket, ioBroker-Konfiguration und States sichern. Nach Update Adapter
neu starten und Browser vollständig neu laden. Auf der Testanlage Anmeldung,
NW1-Lizenz, AppCenter, Datenpunktauswahl, gespeicherte Konfigurationen und vorhandene
Gerätefunktionen prüfen. Mesh-Status und Feldtest mit den tatsächlichen Partnern
prüfen. Ein Rückfall benötigt das vorherige Paket und die passende Sicherung;
1.0.29 enthält die hier dokumentierte Mesh-Feldtest-Lücke. Die Bearbeitung hat
keine Liveanlage verändert und keine Geräte freigegeben.

Prüfumfang, Ergebnisse und verbleibende Grenzen:
[Prüfbericht](reports/security-continuation-2026-10-23/PRUEFBERICHT_DE.md).
