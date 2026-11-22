# Bedrohungsmodell für EOS UI und Regelung

Stand: 29.09.2026. Dies ist eine technische Risikoanalyse des verfügbaren Codes.
Die Szenarien bezeichnen mögliche Angriffe und Prüfanforderungen; sie behaupten
keine jeweils nachgewiesene ausnutzbare Schwachstelle. Reproduzierte Befunde und
ihre Nachtests werden im zentralen Befundregister geführt.

## Schutzgüter und Annahmen

Vorrangig sind unverfälschte Messwerte und Sollwerte, Einhaltung der projektierten
Netz-/Gerätegrenzen und sichere Regelung bei Ausfällen. Hinzu kommen Verfügbarkeit,
Zugänge/Schlüssel, private Betriebsdaten und nachvollziehbare Softwarelieferung.
Lokales LAN ist kein Authentizitätsnachweis. Browser, API-Inhalte, Gerätewerte,
Prognosen, Dateien und Gegenstellen werden vor Verwendung validiert.

Berücksichtigte Angreifer: nicht angemeldeter LAN-/VPN-Teilnehmer; berechtigter
Kunde mit zu weitgehender Funktion; kompromittierter Browser oder Fremdadapter;
gestohlener Stations-/Mesh-Zugang; manipulierte Paketquelle; technisch berechtigte,
aber fehlerhaft bedienende Person. Host-root-Kompromittierung übersteigt die
Schutzwirkung dieses Adapters und verlangt eine eigene Systemprüfung.

Priorität **hoch** bedeutet mögliche Anlagenwirkung, Rechte-/Geheimnisverlust
oder Ausfall zentraler Funktionen; **mittel** begrenzte Daten-/Verfügbarkeitswirkung.
Eine CVSS-Zahl wird ohne konkrete ausnutzbare Ursache und Angriffsbedingungen nicht
erfunden. Reststatus: **offen**, bis der genannte Nachweis für das konkrete
Auslieferungsprofil vorliegt; einzelne bestandene Tests sind Teilnachweise.

| ID / Priorität | Angriff und Auswirkung | Geforderte Maßnahme / konkreter Nachweis |
| --- | --- | --- |
| TM-01 / hoch | Kunde oder anonymer Aufruf erreicht technische DP-Zuordnung, Lizenz, SMTP oder fremde ioBroker-Objekte | Jede API serverseitig autorisieren; Negativtests pro Rolle, auch bei ausgeschalteter Kundenanmeldung; technische Schreibziele beschränken |
| TM-02 / hoch | Sitzungsdiebstahl, Rechteentzug ohne Widerruf oder Login-Versuche | Zufällige Tokens, begrenzte Versuche/Sitzungen, Ablauf/Logout, aktuelle Benutzer-/Gruppenprüfung; Entzug bei laufender Sitzung und SSE testen |
| TM-03 / hoch | Fremdseite sendet schreibende Befehle oder liest APIs; schädlicher Text läuft als Browsercode | Origin-/CSRF-Schutz, sichere Ausgabekodierung und Header; echte Browserprüfungen für API, Import, Namen und Stationsanzeige |
| TM-04 / hoch | Messwert gefälscht, veraltet, außerhalb Bereich oder falsches Vorzeichen; Regelung erhöht Last unzulässig | Quelle, Alter, Einheit und Bereich prüfen; projektspezifischer Rückfall, unabhängige Grenzen; Kommunikationsverlust/Neustart an realen Geräten testen |
| TM-05 / hoch | Mesh-Befehl wiederholt, veraltet, falsch zugeordnet oder Schlüssel kompromittiert | Authentisierung, Sequenz/Zeit-/Knotenbindung und Widerruf; Masterverlust, Replay, Reihenfolge, Neustart und Neuanmeldung testen |
| TM-06 / hoch | Angreifer liest Anmeldedaten oder Tokens über HTTP bzw. umgeht TLS-Proxy direkt | Zertifikatgeprüfter verschlüsselter Zugang, Backend-Port nur für vorgesehenen Proxy/Host erreichbar; Secure-Cookies und vollständigen Pfad auf Endgerät prüfen |
| TM-07 / hoch | Viele Login-, SSE-, Report- oder große Konfigurationsanfragen verdrängen Regelzyklen | Grenzen für Größe, Parallelität, Zeit und Rate; Lasttest mit Messung des Regelzyklus und freigegebenem maximalem Verzug auf Zielhardware |
| TM-08 / hoch | Geheimnisse in Export, Log, Browser-State, Quellpaket oder Backup | Explizit begrenzte Ausgabemodelle, Reduktion/Maskierung, Geheimnissuche und Dateirechte; negative Exfiltrationstests und Wiederherstellung mit Schlüssel prüfen |
| TM-09 / hoch | Manipuliertes Update, fremde Abhängigkeit oder unsauberer Overlay-Build | Exakte Komponentenherkunft, geprüfte Artefakte, abgesicherte Verteilung; Neuinstallation, Overlay und unveränderten Publish-Stand nachweisen |
| TM-10 / mittel | Öffentliches Display oder Bericht verrät andere Häuser, RFID-/Ladedaten oder Hausprofile | Station-/Rollenbindung, Datenminimierung, Widerruf; fremde Token/Station/Knoten und CSV-Export negativ testen |
| TM-11 / hoch | Berechtigte Fehlkonfiguration schreibt beliebige DP, unsichere Protokoll-/Tarif-/Widget-URLs | Schemavalidierung, erlaubte Ziele/Protokolle, Autorisierung und Wertebereiche; interne Zieladressen/Redirects/unerwartete Antwortdaten prüfen |
| TM-12 / hoch | Backup fehlt, Stromverlust beschädigt Daten oder Update startet mit unpassenden Sollwerten | Konsistente Sicherung aller Instanzdaten und Systemschlüssel; Ausfall/Restore/Rückfall unter Diagnosebetrieb testen; keine automatische ungeregelte Wiederaufnahme |

## Physische Wirkung und Testfreigabe

Sicherheitsprüfungen beginnen in isolierter Softwareumgebung mit simulierten
Schreibzielen. Hardwareversuche benötigen ein Prüfprotokoll mit Gerät/Firmware,
zulässigem Leistungsbereich, Schutzkonzept, erwarteter Ausfallreaktion und
verantwortlicher Person. Keine pauschale „alles aus“-Reaktion einbauen: Wärmebedarf,
Speicherzustand, Ladegerät und Netzvorgabe benötigen abgestimmte Rückfälle.

Die Abnahme betrachtet mindestens PV, Speicher, AC/DC-Ladepunkte, Heizlasten,
Netzbegrenzung und gegebenenfalls Mesh gemeinsam. Sollwerte an der API allein
belegen weder Reaktion des Geräts noch Einhaltung der Netzgrenze. Die fachliche
Abnahme muss tatsächliche Leistungswerte und Reaktionszeiten erfassen.


## Nachtrag 1.0.25 – generische Bereichsregelung

Die App Dynamischer Netzanschluss erweitert TM-01, TM-04, TM-07, TM-09, TM-11 und TM-12 um frei konfigurierte Speicher-/PV-Schnittstellen. Zusätzliche Angriffsmöglichkeiten sind Alias-Umgehung eines reservierten Ausgangs, konkurrierende Altregler, veraltete Konfigurationsversionen und als Istwirkung fehlinterpretierte Befehlsechos.

Der zentrale Arbiter reserviert konfigurierte Ausgänge vor der ersten normalen Lease und während einer Übergabe. Freie Schreibaliasse werden begrenzt aufgelöst; eine unaufgelöste eigene Schreibseite darf keine Fremdschreiber freigeben. Generation und Messfrische werden unmittelbar vor der Ausgabe geprüft. Gemeinsame Intervallbudgets halten alte und unbestätigte Freigaben bis zur bestätigten Wirkung zurück. Generische Geräteverträge ersetzen eine Hersteller-Whitelist, nicht die Prüfung von Einheit, Vorzeichen, Leistungsgrenzen und lokaler Ablaufreaktion.

Nachweise und tatsächlicher Testumfang: [Prüfvermerk 1.0.25](../reports/dynamic-grid-2026-10-23/PRUEFVERMERK_DE.md). Hostmanipulation und externe Schreiber außerhalb dieses Adapters bleiben außerhalb seiner Durchsetzungsgrenze. Reale Watchdog-/Ausfallwirkung und gleichzeitiger Gerätebetrieb sind an der projektierten Anlage nachzuweisen.
