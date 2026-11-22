# NexoWatt EOS – technische Sicherheitsakte

Prüfauftrag: 29.09.2026. Ausgangspunkt ist das hochgeladene vollständige Repository
`NexoWatt_UI_1.0.21_STABLE_FULL_REPOSITORY (1).zip`, Paket `iobroker.nexowatt-ui`
1.0.21. SHA-256 des Eingangsarchivs:
`90db619ecd754cab335dae92fdc123a48f62ceffb505a2a2b832e119d885eefe`.
Der damals geänderte Lieferstand heißt **1.0.22 Security Review – nicht produktiv
freigegeben**. Paketversion, Release-Manifest und Prüfbericht identifizieren ihn;
der Eingangshash bezeichnet ausdrücklich nicht die neue ZIP.

Diese Akte beschreibt die technische Absicherung dieses Adapters und die noch
notwendigen Arbeiten am EOS-Gesamtprodukt. Sie erteilt keine Serienfreigabe,
EU-Konformitätserklärung, Zertifizierung oder unabhängige Prüfbescheinigung.
Automatisierte Tests, Codeprüfung und Prüfungen an realer Hardware haben getrennte
Aussagebereiche. Historische Releaseberichte werden nicht als aktuelle Prüfergebnisse
übernommen. Bekannte ausnutzbare Produktbefunde und fehlgeschlagene kritische Tests
sperren eine Freigabe im betroffenen Betriebsprofil.

| Unterlage | Inhalt |
| --- | --- |
| [Produktgrenzen und Datenflüsse](PRODUKT_GRENZEN_DATENFLUESSE_DE.md) | Gelieferte Komponente, Systemabhängigkeiten, Onlinefunktionen und Vertrauensgrenzen |
| [Bedrohungsmodell](BEDROHUNGSMODELL_DE.md) | Angriffsszenarien, Anlagenwirkung und geforderte Nachweise |
| [Anforderungen und Nachweise](ANFORDERUNGEN_NACHWEISE_DE.md) | Prüfumfang und offene Nachweislücken; keine pauschale Normerfüllung |
| [Schwachstellen und Support](SCHWACHSTELLEN_SUPPORT_DE.md) | Bearbeitungsprozess, Meldebereitschaft und Herstellerentscheidungen |
| [Auslieferung und Betrieb](AUSLIEFERUNG_BETRIEB_DE.md) | Konkrete Prüf- und Freigabegates für Paket und Endgerät |
| [Quellen und Versionsstand](QUELLEN_STAND_DE.md) | Am Prüftag überprüfte offizielle Quellen und Grenzen der Quellenprüfung |
| [Sicherheits-Prüfbericht 1.0.22 vom 29.09.2026](../reports/cra-2026-09-29/PRUEFBERICHT_DE.md) | Damals ausgeführte Tests, Rohbelege und konkrete Prüfgrenzen; kein Nachweis späterer Änderungen |
| [Zentrales Befundregister](../security/BEFUNDREGISTER_DE.md) | Reproduzierte Befunde, Restarbeit und Nachtests |
| [Release-Status](../../release-manifests/release-status.json) | Maschinenlesbarer Freigabestand |
| [SBOM-Index](../../release-manifests/sbom-index.json) | Getrennte Lockdatei-, installierte Build-/Laufzeit- und nachgewiesene Admin-JavaScript-Bundleinventare |
| [Lieferkettenprüfung](../security/supply-chain-review-de.md) | Abhängigkeiten, Advisory-Bewertung und Inventargrenzen |
| [HTTPS, 5 Sekunden und IEC-Anwendbarkeit](../reports/cra-2026-09-29/HTTPS_5S_CRA_IEC_ANFORDERUNGEN_DE.md) | Präzisierte externe Datenpfade, Geheimnisgrenze und industrienaher Pi-5-Systemumfang |

Die bestehende [Architekturübersicht](../ARCHITECTURE_DE.md), der
[Quellcode-Wegweiser](../QUELLCODE_WEGWEISER_DE.md) und der
[Dokumentationsstandard](../DOKUMENTATIONSSTANDARD_DE.md) bleiben maßgeblich.
Die vorliegende Akte ergänzt deren Sicherheits- und Lieferkontext.

## Nachtrag vom 22.10.2026: NVP-Diagnose-Teststand 1.0.24

Auf der fokussierten Heizstab-Basis 1.0.23 ergänzt 1.0.24 die Einrichtung und
Diagnose einer M0/M1-Topologie. Sie verwendet lokale ioBroker-Messungen und
die vorhandene Installer-/Admin-Vertrauensgrenze. Daraus entsteht keine neue
Cloud-Regelung. Neue Datenverträge betreffen `nvpTopology`, die zugehörige
API sowie eigene Diagnosestates.

Der dynamische Pfad ist **ausschließlich Diagnose**. Die statische
Bestandsregelung bleibt zuständig. Neue Bereichszuordnungen und die geplante
externe Stellhoheit bewirken keine tatsächliche Übergabe der Geräteführung.
Aktive dynamische Ausgabe wird serverseitig und in der Runtime gesperrt.
Rechnerische Budgets, simulierte Freigaben und reine Funktionsprüfungen dürfen
nicht als tatsächlich angewandte Leistungsgrenzen oder elektrische
Schutzwirkung dargestellt werden.

| Ergänzende Unterlage | Inhalt und Nachweisgrenze |
| --- | --- |
| [NVP-Topologie und Diagnose](../NVP_TOPOLOGIE_DIAGNOSE_DE.md) | Bedienung, Migration, lokale Datenflüsse, Architektur und ausdrückliche Begrenzung auf Diagnose |
| [NVP-Prüfplan T01–T33](../reports/NVP_2026_10_22_PRUEFPLAN_DE.md) | Zuordnung vorhandener Softwareteile, numerischer Sollwerte und weiterhin offener aktiver Abnahmefälle; keine erfundenen Testergebnisse |
| [NVP-Nachtrag im Befundregister](../security/BEFUNDREGISTER_DE.md) | Unveränderte Kennungen NVP-ACT-01 bis NVP-ACT-06, Verantwortung und Arbeit vor aktiver Freigabe |

Offen bleiben die durchgängige Bereichsbindung der tatsächlichen ESS-/Farm-
Writer, ein gemeinsamer finaler EVU-/PV-Writer, vollständige Live-Gerätefähigkeiten
und bestätigte externe Schnittstellenprofile. Tatsächliche Wirkung,
Freigabeablauf, Altfreigaben, Neustart und Kommunikationsausfall müssen am
ausführenden lokalen Gerät nachgewiesen werden. Reale Messstellen,
Vorzeichen, Mess-/Reaktionszeiten, SoC-/Hybridgrenzen, Phasen-/Scheinleistung
und gegebenenfalls unabhängige Schutzpfade benötigen gesonderte Feldnachweise.

Die neue API-/Diagnoseprüfung und die fortbestehenden Geräte-/Feldlücken sind
getrennt zu bewerten. Der abschließende NVP-Prüfvermerk wird ausschließlich
aus tatsächlich ausgeführten Läufen und deren Rohbelegen erstellt.
Dieser Nachtrag enthält keine neue regulatorische Einstufung, keinen
Nachweis vollständiger Normerfüllung und keine CRA-Konformitäts- oder
Produktionsfreigabe. Die offenen Herstellerentscheidungen der technischen
Sicherheitsakte bleiben bestehen.

## Pflege

Bei jeder Änderung an Authentifizierung, Datenpunktzugriff, Netzverkehr,
Gerätesollwerten, Abhängigkeiten oder Auslieferung die betroffenen Anforderungen,
Bedrohungen und Nachweise im gleichen Lieferstand aktualisieren. Ein Befund wird
im zentralen Befundregister geführt, einschließlich Ursache, Abhilfe und Nachtest.
Die Szenarienkennungen `TM-*` in dieser Akte sind keine zusätzlichen Befundnummern.
Herstellerentscheidungen bleiben offen, bis eine benannte verantwortliche Person
sie mit Datum tatsächlich getroffen hat.
