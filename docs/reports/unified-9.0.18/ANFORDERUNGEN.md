# Geräte direkt im EMS zuordnen – 9.0.18

Ausgangsstand: ausgelieferte 9.0.17, Repo-ZIP SHA-256 `9fcce971b2083cd64abc55883029f25ffd56b3cc354320aaf02e8a6973c698af`.
Stand: 24.11.2026. Diese Anforderungsbeschreibung behauptet noch kein bestandenes Prüfergebnis.

## Auftrag und Grenzen

Unterstützte NexoWatt-Geräte sollen nach dem Speichern unmittelbar für die EMS-Konfiguration verfügbar werden. Die bisherigen Alias-V1-Namen, Gerätekommunikation und zentralen Lizenz-/Eigentumsgrenzen bleiben erhalten. Keine zusätzlichen Laufzeitabhängigkeiten, keine Cloud-Abhängigkeit, keine Änderungen an Standard-Admin-/Backitup-Konfiguration oder globalen ioBroker-Rechten.

| Kennung | Sollverhalten |
| --- | --- |
| EMS-AUTO-01 | Eine unterstützte Wallbox erhält anhand ihrer stabilen Gerätekennung genau einen passend zugeordneten Ladepunkt. Wiederholtes Speichern und Neustarts erzeugen keine Duplikate. |
| EMS-AUTO-02 | Das Geräteformular bietet passende EMS-Aufgaben: Anzeige/manuell, Einzelspeicher/Farm, Zähleraufgabe M0/M1/Erzeugung/Verbrauch sowie PV-Anlage/Anzeigefeld. Nur vom bestehenden EMS unterstützte Ziele werden angeboten. |
| EMS-AUTO-03 | Aus dem tatsächlich veröffentlichten V1-Vertrag und den vorhandenen Objekten werden lesbare Messwerte und schreibbare Befehle unterschieden. Keine erfundenen Zielpfade, Werte oder Freigaben. |
| EMS-AUTO-04 | Geräteverwaltung und App-Center verwenden denselben persistenten Konfigurationsstand. Ein veraltetes App-Center-Formular darf neue Zuordnungen nicht zurücksetzen. |
| EMS-AUTO-05 | Manuelle und kundenspezifische vorhandene Werte bleiben autoritativ. Belegte Anzeigefelder und uneindeutige Topologien führen zu sichtbaren Konflikten statt stiller Ersetzung. |
| EMS-AUTO-06 | App-/Gerätedeaktivierung und normale Updates entfernen weder gespeicherte Zuordnungen noch vorhandene Datenpunkte. Fehlende eigene Objekte werden ergänzt, bestehende Objekte nicht pauschal überschrieben. |
| EMS-AUTO-07 | Eine neue Zuordnung aktiviert keinen bisher deaktivierten Regler und sendet keine Hardware-Testbefehle. Neue regelbare Ladepunkte benötigen eine bewusste Inbetriebnahme. |
| EMS-AUTO-08 | Geräte- und EMS-Speicherung melden Teilergebnisse ehrlich. Ist das Gerät gespeichert, aber EMS noch nicht bereit, bleibt die Zuordnung erkennbar ausstehend und kann beim Wiederanlauf fortgesetzt werden. |
| EMS-AUTO-09 | Die automatische Abstimmung läuft begrenzt, zusammengefasst und außerhalb des zeitkritischen EMS-Takts. Stop, Lizenz-/Eigentumsentzug und Fehler beenden weitere Schreibarbeit kontrolliert. |
| EMS-AUTO-10 | Manuell eingebundene Fremdgeräte bleiben über das App-Center konfigurierbar; keine pauschale Erkennung beliebiger Fremdadapter oder neue Protokolltreiber. |

## Ergänzung: einfache Kundeneinstellungen für dynamische Tarife

Der Nutzer ergänzt vor Auslieferung: Kunden sollen ihren Tarifanbieter selbst unter Einstellungen wählen können; Einrichtung und Bedienung sollen übersichtlich bleiben. Ein EOS-Gerät verwendet einen gemeinsamen Anlagentarif, keinen abweichenden Tarif je Benutzerkonto.

| Kennung | Sollverhalten |
| --- | --- |
| TARIF-KUNDE-01 | In den vorhandenen Kundeneinstellungen gibt es eine verständliche Anbieterauswahl und nur die dafür erforderlichen Eingaben. Preisbestandteile und selten benötigte Angaben werden schrittweise eingeblendet. |
| TARIF-KUNDE-02 | Vorhandene Tarifdaten werden übernommen. Ein normales Update, ein leeres Passwortfeld oder eine Änderung anderer Einstellungen setzt sie nicht zurück. |
| TARIF-KUNDE-03 | Ein eigener berechtigter, CSRF-geschützter Speicherpfad erlaubt ausschließlich die vorgesehenen Tarifparameter. Kunden erhalten dadurch keinen Zugriff auf beliebige Installer-, Sicherheits- oder Anlagenlimits. |
| TARIF-KUNDE-04 | Direkte Preis-APIs, Marktpreisquellen und berechnete Anbieterprofile sind klar unterscheidbar. Die Oberfläche behauptet keine direkte Anbindung an einen Anbieter, wenn nur ein Formelprofil vorhanden ist. |
| TARIF-KUNDE-05 | Zugangsdaten werden nicht an den Browser zurückgegeben, protokolliert oder bei einem Anbieterwechsel unbemerkt an einen anderen Anbieter übermittelt. Kundenseitig sind keine beliebigen URL-/Header-/OAuth-Endpunkte editierbar. |
| TARIF-KUNDE-06 | Ein Anbieterwechsel verwirft dessen alte aktuellen Preise und laufende Antworten. Erst neue gültige Preisdaten dürfen für die neue Quelle verwendet werden; keine erfundenen Nullpreise. Historische Abrechnungswerte bleiben bestehen. |
| TARIF-KUNDE-07 | Die Änderung aktiviert keine bisher ausgeschaltete EMS-App, verändert keine Anlagenlimits und benötigt keinen vollständigen EMS-/Adapter-Neustart. Die Verwendung als Preisquelle wird verständlich und gezielt ausgewählt. |

## Prüfplan

Positive Fälle: echte Geräteprofil-/Alias-Erzeugung, Wallbox, Zählerrollen, PV-Felder, Einzelspeicher/Farm, Neustart und wiederholtes Speichern. Negative Fälle: fehlende/falsch typisierte Aliasdaten, nicht schreibbare Stellgrößen, uneindeutige Ziele, Doppelbelegung, alte Formulare, fehlende Lizenz/Laufzeit und parallele Speicherung. Regressionsfälle: Kundeneinstellungen, deaktivierte Apps, Namespace-Erhalt, Sitzungen und Standard-Admin-Isolation.

Softwaretests und echte Geräteabnahmen werden getrennt dokumentiert. Die Auswahl M1 darf keine im Bestand nicht implementierte M1-Regelung vortäuschen; reine Messwertzuordnung und operative Regelungsfreigabe sind getrennte Zustände. Die automatische Zuordnung mehrerer Wechselrichter zu einer gemeinsamen Summe wird nur angeboten, wenn eine tatsächlich implementierte, geprüfte Aggregation vorhanden ist.

## Entwicklungsbezug

Die Prüfung folgt den bestehenden EOS-Anforderungen an Laufzeitvalidierung, minimale Änderungen, eindeutige Schreibzuständigkeit, Konfigurationserhalt und Rückfall. Technische Grundlage ist die offizielle ioBroker-Adapterreferenz: `setObjectNotExists` erhält bestehende Objekte; `ack:false` und `ack:true` unterscheiden Befehle und Rückmeldungen. Quelle, geprüft am 24.11.2026: https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterref.md


## Einheitlicher Aliasvertrag für unterstützte Hersteller

- **ALIAS-ALLE-01:** Vorhandene kanonische und Legacy-Pfade behalten ihre Namen, Semantik und manuelle Zuordnung. Erweiterungen sind zusätzliche Rollen im V1-Vertrag.
- **ALIAS-ALLE-02:** Gleiche belegte Funktionen erhalten gleiche kanonische Namen, Typen, Einheiten und Vorzeichen. Alle 195 vorhandenen Profile werden auf vorhandene und fehlende Quellen geprüft; Herstellername allein ist kein Fähigkeitsnachweis.
- **ALIAS-ALLE-03:** SolaX- und FENECON-Quellen werden anhand der konkreten vorhandenen Profile gebunden. Nicht vorhandene oder semantisch unklare Funktionen bleiben nicht verfügbar.
- **ALIAS-ALLE-04:** Ein echter NVP-Regler-Sollwert ist von einem ESS-Leistungssollwert getrennt. Schreibbestätigung ist keine gemessene Aktor- oder Sollwertrückmeldung.
- **ALIAS-ALLE-05:** Ergänzte Messwerte dürfen vorhandene Regelpfade nicht automatisch umschalten. Bestehende manuelle Werte bleiben erhalten; neue steuerbare Einträge bleiben bis zur gezielten Freigabe deaktiviert.
- **ALIAS-ALLE-06:** UI-Felder unterscheiden Datenpunkt-IDs von festen Wattwerten. Ungültige bestehende Zuordnungen werden sichtbar gekennzeichnet und nicht still überschrieben.
