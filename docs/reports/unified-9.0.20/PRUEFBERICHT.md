# NexoWatt EOS 9.0.20 – vertiefte Code- und Visualisierungsprüfung

Datum: 24.11.2026. Ausgangsstand: ausgeliefertes 9.0.19-Repository, ZIP-SHA-256 `af873743bd82e93f588f2163b1b911313c324ea50cb108ae07f28c96c9a791dc`. Prüfumfang: Inbetriebnahme, Lebenszyklus, Konfigurationserhalt, EMS-Zuordnung und Visualisierung. Keine Produktivänderung und keine npm-Veröffentlichung wurden ausgeführt.

## Bestätigte Befunde und begrenzte Korrekturen

- Modbus: verzögerter Verbindungsaufbau konnte nach bestätigtem Stopp einen neuen Socket öffnen. Generation und Freigabe werden nach asynchronen Grenzen erneut geprüft; alte Verbindungen dürfen neue Sitzungen nicht verändern.
- Serieller Modbus: Busfreigabe wartet auf bestätigtes Schließen. Eine Reservierung pro Prozess verhindert widersprüchliche RTU-/ASCII-/Baudratenverbindungen auf demselben konfigurierten Anschluss; sie ist kein Betriebssystem-Lock.
- Bestandsübernahme: feste 45 Sekunden passten nicht zum fortschrittsabhängigen Gerätestart. Nur bestätigter Metadatenfortschritt verlängert die Wartezeit innerhalb einer festen Obergrenze; Stillstand/Fehler und Rückfall bleiben begrenzt.
- EMS-Profilwechsel: nach einem vorherigen Geräte-Rollback konnten Referenzen auf alte Konfigurationszeilen zeigen. Der Sicherheitsabgleich liest jetzt die tatsächlichen aktuellen Zeilen.
- Fehlgeschlagener EMS-Start: asynchrone Modulbereinigung muss bestätigt sein, bevor eine neue Engine entsteht. Unbestätigte Bereinigung bleibt gesperrt und sichtbar. Startseite, API und interne Betriebsbereitschaft verlangen einen tatsächlich laufenden Scheduler.
- Live-Anzeige: erfundene 100 W und unbegrenzt festgehaltener alter Gebäudeverbrauch entfernt. Fehlend, veraltet und echte Nullwerte bleiben unterscheidbar; Betriebszustände benötigen tatsächliche Statusdaten.
- History: fehlende Werte dürfen nicht über `Number(null)` zu Nullmessungen werden, gültige Fallbacks nicht verdecken und DC-PV nicht doppelt zählen. Providerpreise behalten Einheiten/Vorzeichen und Gültigkeit. Kanonische periodische Reihen werden bei Ausfällen nur begrenzt fortgeschrieben; Diagramme und Energieintegration erhalten Datenlücken. Historische Bestandsdaten werden nicht umgeschrieben.
- Tarifdarstellung: negative EUR/kWh-Werte bleiben in Viertelstundenkosten, Tagesaggregation, gewichteten Summen und Diagrammachsen erhalten. Fehlende Preise sind keine kostenlosen Intervalle; bestehende Netzentgeltregeln bleiben erhalten.
- Viertelstundenbericht: Abfragezeitraum vor Datenbankzugriff begrenzt, unvollständige Intervalle und noch offene Viertelstunden gekennzeichnet; fehlende Preise/Messungen erzeugen keine vollständigen Kosten oder Nullwerte im CSV.
- Wertkonto: ein ausdrücklich ungültiger Tarif darf nicht über einen jüngst geschriebenen History-/Budget-Zwischenspeicher wieder gültig werden. Der konfigurierte Festpreis bleibt der gekennzeichnete Fallback.

- Gerätebefehle: Das gehostete Gerätemodul hatte kein eigenes Steuerdaten-Abonnement. Ein Datenbank-Schreibauftrag konnte daher ohne Browser-Abonnement oder nach dessen Drosselung bei `ack:false` stehenbleiben, ohne den Treiber zu erreichen. Ein begrenzter, vor dem Modulstart erworbener Bezug hält die Zustellung für rohe, Legacy- und Alias-V1-Steuerdaten unabhängig von Browsern aufrecht. Getrennte Bezüge schützen andere Verbraucher beim Stoppen; verzögerte oder fehlgeschlagene Anmeldung bleibt kontrolliert gesperrt.
- Schreibbestätigung: Ein passender `ack:false`-Wert ist ein ausstehender Auftrag. Erst ein gültiger, dem Auftrag zeitlich zugeordneter `ack:true`-Wert gilt als Treiberquittierung, niemals als gemessene Leistung. Ausstehende Quittierung allein erzeugt keine sofortige Rücknahme oder Befehlsflut; tatsächliche Werteabweichungen und Zuständigkeitsfehler behalten ihre Fehlerbehandlung.
- Farmdiagnose: Anforderung, Übergabe an den Schreibpfad und gemessene Batterieleistung werden getrennt angezeigt. Ein Speicher unter der wirksamen SoC-Grenze wird mit seinem Ausschlussgrund dargestellt. Die Regression mit FENECON 1 %, SolaX 98 % und Mindest-SoC 10 % weist die Verteilung ausschließlich auf den zweiten Speicher nach.

- Direkte InfluxDB-2-Anbindung: eigener Lese-/Schreibweg für bestehende EOS-Historien ohne zusätzlichen Influx-Adapter. Der bisherige Adaptermodus bleibt nach dem Update erhalten. Geschützter Token, exakte Organisation und Bucket, expliziter Einrichtungsschritt und getrennte Nachweise für Lesen bzw. tatsächliches Schreiben. Keine Anlage, Löschung oder Wiederherstellung einer Datenbank durch EOS.
- Login-/Webapp-Logo: vorhandenes NexoWatt-Emblem direkt im Anmeldeformular, expliziter 180-Pixel-Apple-Verweis und drei feste iOS-Fallbackadressen. Anonyme HTTPS-Abrufe mit geprüfter Zertifikatskette und weiterhin gesperrten APIs getestet; Original-Logo unverändert. Siehe `LOGIN_WEBAPP_LOGO.md` und `PWA_ANONYMOUS_HTTPS_REVIEW.md`. Eine physische iPhone-Installation sowie öffentliches Zertifikatsvertrauen sind dadurch nicht nachgewiesen.
- Historienbetrieb: begrenzte Warteschlangen und gemeinsame Netzwerkdeadlines, getrennte Lese-/Schreibfehler und kontrollierter Stopp. Umschalten der Datenbank verwirft alte Aufträge, statt sie versehentlich an ein neues Ziel zu senden. Keine dauerhafte Warteschlange bei Strom-/Prozessausfall. Fremde manuell historisierte ioBroker-Datenpunkte werden nicht still übernommen; fortbestehende alte EOS-Aufzeichnungen müssen beim Übergang berücksichtigt werden.
- Historienzugangsdaten: normaler Konfigurationsabruf liefert keinen Token. Gesicherte verschlüsselte Zugangsdaten benötigen beim Wiederherstellen das passende ioBroker-Systemgeheimnis. Ein fehlender Entschlüsselungsschlüssel sperrt nur die Historienverbindung; Geräte- und EMS-Konfiguration bleiben erhalten.

Die Einzelberichte enthalten konkrete Auslöser, Quellstellen, Negativreproduktionen und Regressionen. Die Anforderungsmatrix trennt umgesetzte automatische Grundzuordnung von ergänzend notwendiger Einrichtung.

## Funktionserhalt und Sicherheitsgrenzen

Keine neue Laufzeitabhängigkeit, kein Hersteller-Privatschlüssel und keine Änderung der Standard-Admin-/Backitup-Konfiguration gehören zu diesem Delta. Bestehende Kundeneinstellungen werden nicht auf Vorgaben zurückgesetzt. Zentraler Lizenzschutz, gerätespezifische Freigaben und begrenzte Fehlerbehandlung bleiben bestehen. Ein neuer Build ist kein Nachweis vollständiger Fehlerfreiheit oder CRA-Konformität.

## Abschlussprüfungen

<!-- FINAL_RESULTS_BEGIN -->
| Prüfung | Ergebnis |
| --- | --- |
| Vollständiges npm test, Node 22.23.4 | 1990 Tests, 1988 bestanden, 0 fehlgeschlagen, 2 ausgelassen |
| Vollständiges npm test, Node 24.22.3 | Gleicher Umfang und gleiche Ergebnisse |
| Typprüfung und konfiguriertes Lint | Bestanden; neue strikte Helper und gezielt geprüfte Altbereiche dokumentiert |
| Builds | Admin, Installer, Backend, UI-Runtime und Module bestanden |
| Dokumentation und produktiver TS/Runtime-Abgleich | Bestanden; historischer nichtproduktiver Spiegelabgleich gesondert als Altbestand dokumentiert |
| Sicherheitsgate | 226 Quellen; 3200 inventarisierte Fundstellen (2929 historisch offen, 271 einzeln geprüft); 0 neue blockierte Befunde |
| Geheimnisprüfung | Bestanden |
| npm-Audit Laufzeit | 0 gemeldete Advisories |
| npm-Audit Entwicklung | 14 moderate, 0 hohe, 0 kritische; keine pauschale Befundfreiheit |
| SBOM | Aktualisiert und geprüft; auf Paket-/Lockfile-/Buildinventaren beruhend, kein Inventar der Kundenanlage |

Die beiden ausgelassenen Prüfungen benötigen nginx bzw. setfacl. Die vollständigen Testlogs verwenden die tatsächlichen Node-Versionen und die bytegeprüften vorhandenen Keygen-1.0.4-Quellen mit flüchtigen Testschlüsseln. Die Rohbelege enthalten auch gekennzeichnete fehlgeschlagene Reproduktionen des Ausgangsstands; diese sind keine Fehler im abschließenden Testlauf. Package-/Publish- und Controller-Nachweise stehen zusätzlich im Liefernachweis.
<!-- FINAL_RESULTS_END -->

## Noch erforderliche Anlagenbelege

Physische SMA-/FENECON-/SolaX-/Wallbox-Kommunikation, reale Stellwirkung, EEBus-Kopplung, langfristiger RAM-Verbrauch und Regellatenz wurden hier nicht am Kundengerät gemessen. Der echte Chromium-Prozess kann in dieser Umgebung wegen `socket() EPERM` nicht starten; ausführbare DOM-/Datenflussprüfungen und CSS-Prüfung sind kein visueller Browserabnahmetest. Die Anleitung benennt dafür eine konkrete, begrenzte Anlagenabnahme.
