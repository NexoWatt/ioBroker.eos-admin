# NexoWatt EOS 9.0.19 – durchgängige Geräte-Inbetriebnahme

Stand: 24.11.2026. Ausgangspunkt ist das unveränderte ausgelieferte Repository 9.0.18 mit SHA-256 `3972c1f3b18b39e6914dbb8495ad3e298b6c4853efb9ce2c0194ad8f160e758f`. Kanal `next`; proprietäre Lizenz und zentrale NWL3-Systemfreigabe bleiben erhalten.

## Anlass und Sollverhalten

Der Nutzerbericht zeigt zwei Speicher mit gewählter Farm-Aufgabe im Gerätebereich, aber nur einen vorhandenen FENECON-Eintrag im EMS, einen als veraltet markierten SMA-Zähler und unvollständigen Energiefluss. Die Anforderung lautet: unterstützte Geräte einmal unter Geräte einrichten und dort alle nötigen Zuordnungen, Betriebsgrenzen und die Aktivierung der erforderlichen EMS-Funktionen übernehmen. Der ausgewählte SMA-Netzanschlusszähler ist der Regelpunkt M0.

Eine ausdrückliche Geräte-Inbetriebnahme darf die zugehörigen Apps aktivieren. Ein späterer Hintergrundabgleich, Neustart oder ein Update darf eine nachträglich bewusst deaktivierte App nicht wieder einschalten. Bereits gültige Kundenzuordnungen und Grenzen bleiben erhalten. Physische Sollwerte benötigen weiterhin frische gültige Messwerte und die bestehenden Sicherheitsfreigaben.

## Fehlerursachen und Korrekturen

Die Einzelreviews dokumentieren die reproduzierten Ursachen und konkrete Änderungen. Unveränderte erfolgreich neu gemessene Werte müssen von nur zwischengespeicherten alten Werten unterschieden werden. Ein gültiger Messwert darf frisch bleiben, ein ausgefallenes Gerät dagegen nicht durch einen Timer frisch erscheinen. EMS-Konfigurationswechsel dürfen keine überlappenden alten und neuen Aktorbefehle erzeugen. Eine fehlgeschlagene Übergabe muss im Gerätebereich sichtbar sein.

Die Regression führt außerdem den tatsächlichen Web-/Runtime-Start und den Modul-HTTP-Speicherweg aus. Frühere Tests setzten Teile der internen Verknüpfung bereits voraus; ihre Ergebnisse waren kein Nachweis des gesamten hier betroffenen Produktionswegs.

## Tibber und bestehende Anzeigen

Zusätzlich wurden die vom Nutzer gemeldeten Tibber-Anzeigen geprüft. Die Quelle muss Viertelstundenpreise liefern und die Oberfläche deren tatsächliche Intervalle erhalten; Stundenaggregation darf diese Daten nicht verdecken. Preisanzeige und ausdrücklich aktivierte Preisregelung sind getrennte Aufgaben. Fehlende oder veraltete Werte dürfen keine kostenlosen 0-Euro-Preise erzeugen; echte Null- und Negativpreise bleiben gültig. Weitere Anbieter sind ausdrücklich auf eine spätere Version verschoben. Der Tarif-Einzelbericht nennt reproduzierte Ursachen, Intervall-/Sommerzeitprüfungen und Grenzen ohne echten Kunden-API-Zugriff.

## Sicherheits- und Erhaltungsgrenzen

Die Geräteauswahl ersetzt keine neue Hersteller-Schreibfreigabe. Aliasquellen, Einheiten, Lese-/Schreibfähigkeit, Herkunft und Identität werden weiter geprüft. Echte Rückmeldungen bleiben von Schreibbestätigungen getrennt. Leistungsgrenzen werden aus gültiger vorhandener Konfiguration übernommen oder beim Gerät eingegeben, nicht geraten. Keine zusätzlichen Laufzeitabhängigkeiten, keine privaten Schlüssel und keine Anpassung globaler ioBroker-Benutzerrechte gehören zu dieser Änderung.

Standard-Admin und Standard-Backitup bleiben unabhängige Adapter. EOS verändert bei dieser Inbetriebnahme weder deren Konfigurationen noch deren Icons oder Ports. Gerätekonfigurationen und EMS-Einstellungen werden nicht beim Update auf Standardwerte gesetzt.

## Tatsächliche Prüfungen

<!-- FINAL_RESULTS_BEGIN -->
| Prüfung | Ergebnis |
| --- | --- |
| Vollständiges npm test, Node 22.23.4 | 1710 Tests, 1708 bestanden, 0 fehlgeschlagen, 2 ausgelassen; fünf vollständige Phasen |
| Vollständiges npm test, Node 24.22.3 | Gleicher Umfang und gleiche Ergebnisse |
| Geräte → HTTP → Web/Runtime → EMS | Tatsächlicher Produktions-Verknüpfungsweg, realer Geräte-/Aliascode und kontrollierte Datenbank-/Gerätetransporte; Details im unabhängigen Review |
| Alte/neue Regelzyklen | Ausstehende Zyklen, verspätete Modulaufgaben und asynchrone Stopps verhindern überlappenden Neustart; Test gegen alte Version reproduziert den Fehler |
| Messwerte und Energiefluss | Unveränderte Samples, Ausfall/alte Caches, getrennte FENECON-Batterie-/Konverterwerte und gleiche EV-Anzeigequellen geprüft |
| Konfigurationserhalt | Bekannte manuelle Zeilen, Kundengrenzen, Geheimnisse, wiederholtes Speichern, spätere Deaktivierung und Neustart geprüft |
| Typprüfung / Lint | Gesamtprüfung und neue strikte Bereiche unter Node 22 und 24 bzw. konfigurierte Lint-Prüfungen bestanden |
| Builds | Admin, Installer, Backend, UI-Runtime und Module erfolgreich |
| Dokumentation / Runtime-Abgleich | Bestanden |
| Sicherheitsgate | 218 Quellen; 3222 inventarisierte Fundstellen, davon 2951 historisch offen und 271 einzeln geprüft; 0 neue blockierte Befunde |
| Geheimnisprüfung | UI-Prüfung bestanden; gezielter Paket-Scan zusätzlich im Releasegate |
| npm-Audit Laufzeit | 0 gemeldete Advisories |
| npm-Audit gesamte Entwicklungsumgebung | 14 moderate, 0 hohe, 0 kritische; nicht als vollständig befundfrei bewertet |
| SBOM | Lieferumfang und Build-/Frontend-Inventare aktualisiert; Verifikation bestanden |

Die zwei ausgelassenen Prüfungen benötigen hier nicht vorhandenes nginx beziehungsweise setfacl. Vorhandene Lizenz-/Keygen-1.0.4-Prüfungen verwenden bytegeprüfte Generatorquellen und flüchtige Testschlüssel. Es wurden keine Hersteller-Privatschlüssel verwendet. Der visuelle Chromium-Lauf ist durch socket() EPERM vor dem Seitenstart blockiert; DOM-/HTTP-Tests ersetzen keinen visuellen Browsernachweis. Physische Herstellergeräte waren nicht angeschlossen. Ein laufender Kunden-Admin/Backitup oder eine reale Regellatenz werden nicht als getestet ausgegeben.

Die abschließend gepackten Dateien, Publish-Trockenläufe und ein gegebenenfalls ausgeführter echter Controllerlauf sind im separaten Liefernachweis dokumentiert. Frühere Ergebnisse von 9.0.18 gelten nicht als erneuter Nachweis für diese Version.
<!-- FINAL_RESULTS_END -->

Rohbelege stehen nach Abschluss unter `raw/INDEX.json`. Eine Geräte-/Lastprüfung auf der tatsächlichen Anlage und eine allgemeine Produktions- oder CRA-Freigabe werden durch Softwaretests nicht ersetzt. Lieferdateien und Publish-Trockenläufe erhalten einen separaten Liefernachweis.

## Fachliche Referenzen

Am 24.11.2026 abgeglichen: [ioBroker Objektschema](https://www.iobroker.com/docs/dev/objectsschema.md), [ioBroker Alias-Grundlagen](https://www.iobroker.com/docs/basics/alias.md) und [Adapter-API](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterref.md). Relevant sind insbesondere die Unterscheidung von Messzeitpunkt `ts` und Wertänderung `lc`, sowie getrennte Alias-Lese- und Schreibquellen. Die projektspezifischen Alias-V1-Rollen ersetzen nicht die konkreten Quellen-/Fähigkeitsprüfungen.
