# NexoWatt EOS – Architekturübersicht

Grundstand: 1.0.11; gezielter NVP-Diagnose-Nachtrag für 1.0.24 vom
22.10.2026. Den Einstieg in konkrete Funktionen und Abläufe bietet der
[Quellcode-Wegweiser](QUELLCODE_WEGWEISER_DE.md). Die
[Code-Landkarte](CODEMAP_DE.md) unterscheidet Originalquellen und generierte Ausgaben.

## Adapter und Kommunikation

`src-ts/runtime-executables/main.ts` verbindet ioBroker-Zustände, Zustands-Cache, Webserver, authentifizierte APIs, SSE-Liveupdates, Lizenzprüfung und EMS-Lebenszyklus. Dashboard, History, SmartHome und App-Center nutzen diese Schnittstellen. Zustandsnamen, Einheiten und API-Felder sind gemeinsame Verträge; Änderungen müssen alle betroffenen Leser und Schreiber berücksichtigen.

## Energie- und Laderegelung

Die Engine und der Modulmanager unter `src-ts/runtime-executables/ems/` koordinieren Messwerte, regelmäßige Berechnungen und das Stoppen der Module. Regelmodule bestimmen Budgets und Sollwerte. Zentrale Datenpunkt-/Schreibfunktionen führen freigegebene Befehle aus; Roh-Datenpunktzugriffe dürfen Schutz-, Einheiten- und Schreibregeln nicht umgehen.

Ladepunkte haben explizite elektrische Grenzen. AC-Netzstrom und DC-Ausgangsstrom sind unterschiedliche Größen; die Umrechnung braucht den richtigen Spannungs-/Phasenbezug. Speicherregelung und Ladebetrieb teilen sich Netz-, SOC- und Leistungsgrenzen. Fehlende oder veraltete Messwerte sind kein gültiger Nullwert.

### M0/M1-Diagnosearchitektur – Nachtrag 22.10.2026, Version 1.0.24

Die zusätzliche Konfiguration `nvpTopology` beschreibt M0 als Gesamtanschluss
und M1 als darunterliegenden Bereich. M0 enthält M1 bereits. Physischer
Anschluss, lokaler Regelmesspunkt, Aufgabe, Dispatchgruppe und geplante
Stellhoheit sind getrennte Angaben. Speicher und PV werden vorhandenen
Bestandsgeräten ausdrücklich zugeordnet; Herstellername oder ein zweiter
erkannter Zähler lösen keine automatische Zuordnung aus.

Die neue Architektur ist in diesem Lieferstand ein **Diagnosepfad neben der
weiterlaufenden statischen Regelung**. Auch `mode: dynamic` mit
`operation: diagnostic` aktiviert keinen neuen Gerätewriter. `operation: active`
wird zurückgewiesen. Insbesondere übergibt die Diagnosezuordnung `external`
keine tatsächliche Steuerhoheit und schaltet keine bisherigen Keepalives ab.

| Schicht | Funktion / tatsächliche Wirkung |
| --- | --- |
| React-Seite und `lib/nvp-config-api.ts` | Vollständiger Entwurf, Installer-/Adminrechte, Alias-/Bestandsgeräteprüfung, gemeinsame Version und atomare Persistenz über den bestehenden Konfigurationspfad |
| `ems/services/nvp-topology.ts` | Getrennte, kohärente Messkontexte für M0/M1/ESS; echte numerische Werte, Alter, Qualität, Einheiten und Vorzeichen |
| `ems/services/nvp-group-planner.ts` | Hypothetischer Bedarf je homogener Gruppe unter Verwendung vorhandener Speicher-Policies; fehlende Gerätefähigkeit bleibt unbekannt |
| `ems/services/nvp-budget.ts` | Reine Berechnung gemeinsamer Leistungsintervalle, Reservierungen, lokaler/übergeordneter Grenzen und weiterer fachlicher Teilfunktionen |
| `ems/services/nvp-grants.ts` | Reiner Zustandsautomat für simulierte Freigabeverträge; Sitzung, Sequenz, Empfang, Anwendung und konservative Reservierung getrennt |
| `ems/modules/nvp-topology.ts` | Nicht blockierendes Lesen und Veröffentlichung eigener `nvpTopology.*`-Diagnosestates; keine dynamischen Gerätebefehle |

Maßgeblich sind die Originalquellen unter `src-ts/runtime-executables/`.
Der bestehende EMS-Modulmanager führt den Sampler als getrennten Beobachter
außerhalb seiner Aktor-/Telemetrieliste. API und
Runtime prüfen die Konfiguration getrennt; ein direkter Konfigurationseingriff
eröffnet keine dynamische Geräteausgabe. Eine Vorschau verändert weder
gespeicherte Topologie noch Geräteführung. Veraltete asynchrone Ergebnisse
dürfen keinen neueren Konfigurationsstand überschreiben.

Live-Budgets bilden eine Momentaufnahme aus bekannten Netz- und
Speicher-Istwerten sowie eingetragenen Leistungsgrenzen. Sie sind als
`isAuthorization: false` gekennzeichnet. Aktuelle Ladung eines externen
Speichers ist keine garantierte spätere PV-Senke. Vorhandene Rechenbausteine
für Reservierungen oder Hybridgrenzen bedeuten noch keine vollständig
angeschlossene Live-Fähigkeits- und Übergangsprüfung.

Für den späteren aktiven Modus fehlen insbesondere die durchgängige
Bereichsbindung und exklusive Ausgabe je Aktor, die gemeinsame dynamische
EVU-/PV-Sollwertbildung sowie bestätigte Geräteprofile mit lokal wirksamem
Ablauf-/Rückfallverhalten. Die statische Bestandsregelung wird nicht allein
durch einen Fehler der neuen Diagnose abgelöst. Details und offene
Abnahmefälle stehen in [NVP-Topologie und Diagnose](NVP_TOPOLOGIE_DIAGNOSE_DE.md)
und im [NVP-Prüfplan](reports/NVP_2026_10_22_PRUEFPLAN_DE.md).

## Oberflächen und Rollen

Die Browserquellen unter `src-ts/runtime-executables/www/` arbeiten mit HTML/CSS unter `www/`. React-Admin-Quellen liegen unter `src-admin-tab/src/`; ihre Bundles werden erzeugt.

Kunden bedienen bereits konfigurierte SmartHome-Geräte. SmartHome-Einrichtung, NexoLogic-Editor und Datenpunktzuordnung benötigen Installer/Admin mit echter Sitzung. Die Kundenansicht erhält ihre Raumstruktur über das getrennte Lesemodell `/api/smarthome/layout`; offene Kundenbedienung hebt die technischen Rollenprüfungen nicht auf. SMTP-Versandkonfiguration und Lizenzverwaltung bleiben Admin-Aufgaben; entscheidend ist die serverseitige Berechtigung, nicht allein ein ausgeblendeter Menüpunkt. App-Center-Funktionsgrenzen können über einen eigenen Endpunkt ohne Lizenzschlüssel gelesen werden.

## Benachrichtigungen

Der Adapter sammelt relevante Zustände. `notification-policy` erkennt Ereignisse und bestimmt Eskalation, Wiederholschutz und Versandfälligkeit. `notification-mail` verwaltet verschlüsselte Zugangsdaten, Versandhistorie und SMTP-Verbindung. Harte Fehler werden bei Erkennung fällig, normale Fehler werden alle 30 Minuten gesammelt, übrige Meldungen täglich. Ein SMTP-Ausfall kann die Zustellung verzögern; Annahme durch SMTP ist keine garantierte Zustellung ins Postfach.

## Dokumentation und Prüfung

[Deutsche Modulkommentare und fachliche Funktionskommentare](DOKUMENTATIONSSTANDARD_DE.md) gehören zur laufenden Pflege. Der generierte [Katalog](QUELLCODE_VERKNUEPFUNGEN_DE.md) verbindet Dateien, Imports und benannte Funktionen; dynamische API-/State-Verbindungen müssen zusätzlich fachlich beschrieben werden. Release- und Regressionstests prüfen Quellen, Laufzeit, Berechtigungen, Regelung und Dokumentationsstand.
