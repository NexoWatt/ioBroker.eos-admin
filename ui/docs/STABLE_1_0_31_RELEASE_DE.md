<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. Nutzung, Modifikation oder Verbreitung ohne ausdrückliche Erlaubnis untersagt. -->
# NexoWatt EOS 1.0.31 – HTTP- und Admin-Sicherheitskorrektur

Dieser Sicherheitsstand des bestehenden UI-Adapters ist **nicht für den Produktivbetrieb freigegeben**. Die technische Paketprüfung und eine Freigabe der konkreten Kundenanlage bleiben getrennt.

Der erneute Abhängigkeitsscan vom 24.10.2026 hat im unveränderten Stand 1.0.30 zwei betroffene Laufzeitpakete gemeldet: `body-parser` mit einem als hoch eingestuften Verfügbarkeitsbefund sowie drei als moderat eingestufte Meldungen zur Adressanalyse in `nodemailer`. Frühere Scans ohne Treffer gelten ausschließlich für ihren damaligen Abrufzeitpunkt.

Der gelockte Parser wird von 1.20.8 auf 1.20.9 und Nodemailer von 10.0.10 auf 10.1.4 aktualisiert. Zusätzlich weisen alle vier JSON-Eingangsparser komprimierte Requestbodys vor der Dekompression ab. Dadurch ist die Schutzmaßnahme auch dann wirksam, wenn eine bestehende ioBroker-Installation noch einen älteren transitiven Parser auflöst. Die bestehenden Größenlimits für unkomprimierte JSON-Anfragen bleiben erhalten.

**Schnittstellenänderung:** Eigene API-Clients müssen JSON ohne gzip-/deflate-Kompression senden. Komprimierte Requestbodys werden mit HTTP 415 abgewiesen. Das betrifft die Eingabe der JSON-APIs; die Härtung schaltet keine Tarif-, Netzanschluss- oder Speicherregelung um. Die normalen Weboberflächen senden unkomprimierte JSON-Anfragen.

Die React-Admin-Oberfläche begrenzt HTTP-Antworten vor `JSON.parse` auf 16 MiB tatsächlich gelesene Bytes. Ein Größenverstoß oder eine bestehende Ablaufgrenze bricht das Lesen ab. Die vorhandenen Strukturprüfungen und unterschiedlichen Endpoint-Zeitlimits bleiben zusätzlich wirksam. Das Budget liegt oberhalb der vorhandenen 5-MiB-Konfigurationseingänge und der begrenzten Archivseiten; große Daten werden weiterhin seitenweise geladen.

Es werden keine neuen Laufzeitpakete eingeführt. Bestandslizenzen, Datenpunkte und EMS-Regelstrategien werden nicht migriert. Die bekannten Tarif-/NVP-Anzeigeprobleme aus der Diagnose vom 24.10.2026 sind separate offene Befunde und werden durch diesen Sicherheitsstand nicht als behoben erklärt.

Vor dem Update Paket, Konfiguration und relevante States sichern. Nach dem Update Anmeldung, AppCenter, Datenpunktauswahl, Konfigurationsspeicherung, Archivseiten und E-Mail-Benachrichtigung gezielt prüfen. Bei eigenen Integrationen die unkomprimierte Übertragung kontrollieren. Reale Gerätewirkung und sichere Wiederherstellung bleiben Bestandteil der Anlagenabnahme. Der Vorgänger 1.0.30 enthält die neu dokumentierte Parserbetroffenheit und ist deshalb kein gleichwertig gehärteter Rückfallstand.

Der aktuelle Ergebnisstand, Rohbelege und verbleibende Freigabepunkte stehen im [Prüfbericht](reports/security-patch-2026-10-24/PRUEFBERICHT_DE.md). Die Bearbeitung installiert nichts auf einer Liveanlage und veröffentlicht kein Paket automatisch.

Browser-Kompatibilität: Die Adminoberfläche benötigt native `AbortController`, `Response.body` und `ReadableStream`. Ein Browser ohne diese APIs erhält einen kontrollierten Fehler. Antworten über 16 MiB werden abgewiesen; dieser Wert begrenzt Antwortbytes und nicht den gesamten Browserarbeitsspeicher.

Die lokale Abschlussprüfung ist bestanden: TypeScript-/Admin-Build, vollständiges `test:all`, Sicherheitslint mit unverändert offenem Altbestand, Geheimnisscan, Paketstart und Paketprüfung. Beide aktuellen vollständigen npm-Audits melden null bekannte Schwachstellen. Das ersetzt keine Hardwareabnahme oder vollständige ASVS-Prüfung.
