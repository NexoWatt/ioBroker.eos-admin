# NVP-Bereiche und Speicherfarm – Diagnose-Teststand 1.0.24

Historischer Diagnosevertrag aus 1.0.24. Für die aktive eigenständige App ab 1.0.25 siehe [Dynamischer Netzanschluss](DYNAMISCHER_NETZANSCHLUSS_DE.md).

Stand: 22.10.2026. Ausgangsbasis: vollständiges Repository
`NexoWatt-ui-1.0.23-HEIZSTAB-TEST`. Ziel-Lieferstand: **1.0.24
NVP-DIAGNOSE-TEST**. Anforderungsbezug: `NW-UI-NVP-ZONEN-20261022`, Version 1.0,
Datei `NexoWatt_UI_NVP_Statisch_Dynamisch_Speicherfarm_Umsetzung.md`.

**Dieser Stand ergänzt die Einrichtung und Diagnose der dynamischen
M0/M1-Topologie. Er enthält noch keinen aktiven dynamischen Gerätebetrieb.**
Die vorhandene statische Speicher-, Farm- und PV-Regelung bleibt maßgeblich,
auch wenn eine dynamische Topologie als Diagnose gespeichert wurde. Die neue
Zuordnung überträgt keine Steuerhoheit an einen externen Speicherregler.

Die Soll-Spezifikation ist damit erst teilweise umgesetzt. Offene aktive
Integrationsarbeiten und die Zuordnung der 33 Abnahmefälle stehen im
[Prüfplan](reports/NVP_2026_10_22_PRUEFPLAN_DE.md). Ein bestandener Rechentest
wäre weder ein Hardwaretest noch eine Freigabe zum aktiven dynamischen Betrieb.

## 1. Was dieser Stand bereitstellt

- Auswahl zwischen bisheriger statischer Messstruktur und dynamischer
  M0/M1-Diagnose, ohne automatische Umschaltung bestehender Anlagen.
- Getrennte Zuordnung von Gesamtmessung M0, lokaler Messung M1 und
  Speicher-Istleistungen mit Einheit, Vorzeichen und zulässigem Alter.
- Explizite Zuordnung vorhandener Einzel-/Farmspeicher zu Anschlussbereich,
  Regelmesspunkt, homogener Dispatchgruppe, Aufgabe und geplanter Stellhoheit.
- PV-Zuordnung mit Anschlussbereich und bestätigter AC-Bezugsleistung.
- Versionierte Gesamtvalidierung, serverseitige Installer-/Adminprüfung,
  Konflikterkennung bei gleichzeitig geöffneten Konfigurationsfenstern.
- Messqualitätsdiagnose und rechnerische Momentanbudgets, getrennt von
  angeforderter, angewandter und gemessener Leistung.
- Reine Rechenbausteine für konservative Intervalle, gemeinsame Budgets,
  Reservierungen, PV-Anforderungsminimum und gemeinsame Hybrid-AC-Grenzen.

Nicht verfügbar sind aktive M0/M1-Dispatchgruppen, eine aktive TESVOLT-
Freigabeschnittstelle, eine dynamische Zusammenführung der bestehenden
EVU-/PV-Writer und ein nachgewiesener gerätespezifischer Ausfallpfad.

## 2. Bedienung und Inbetriebnahme der Diagnose

### Voraussetzungen

Vor einem Paketwechsel bestehende Adapter-/ioBroker-Konfiguration sichern
und den bisherigen vollständigen Installationsstand bereithalten. Die
bereits vorhandene Regelung und deren tatsächliche Gerätezuordnung müssen
bekannt sein. Die Diagnose ersetzt keine Messung der elektrischen Anlage.

Die React-Seite **„NVP · Bereiche und Speicherfarm“** verwendet die Route
`/nvp-topology` innerhalb der vorhandenen Admin-Anwendung. Installer oder
Administrator sind erforderlich. Die API prüft diese Rechte unabhängig von
ausgeblendeten Bedienelementen. Die Speicherfarm-Übersicht bleibt über die
vorhandene Navigation erreichbar.

### Einrichtung

1. **Statisch** beibehalten, wenn die Anlage weiter mit einem Regelmesspunkt
   betrieben wird. „Statisch“ bezeichnet die Topologie; Eigenverbrauch,
   Tarifregelung und vorhandene dynamische Leistungsanpassungen bleiben erhalten.
2. Für die neue Diagnose **„Dynamisch – Gesamtanschluss M0 mit lokalem
   Bereich M1“** auswählen. Betriebsphase ist **Diagnose**. Die aktive
   Betriebsphase ist gesperrt und wird auch serverseitig zurückgewiesen.
3. M0 als reale Gesamtmessung und M1 als reale untergeordnete Messung
   eintragen. M0 enthält M1 bereits. Dieselbe Quelle über zwei ioBroker-Aliase
   ist keine zulässige zweite Messung. Aliasquellen werden serverseitig
   aufgelöst; die tatsächliche Montage und Zuordnung vor Ort separat prüfen.
4. Für jede Messung W oder kW und das Vorzeichen ausdrücklich festlegen.
   Intern ist Netzbezug positiv und Einspeisung negativ. Bei Speicherleistung
   ist Entladung positiv und Ladung negativ. Die zulässigen Alters- und
   Zeitversatzwerte müssen zum gemessenen Übertragungsverhalten passen;
   Formularvoreinstellungen sind keine bestätigten Schutzreaktionszeiten.
5. Import- und Exportgrenze sowie feste Reserve getrennt eintragen.
   **0 W ist eine wirksame Grenze.** Bei M1 kann eine nicht benötigte lokale
   Vertragsgrenze ausdrücklich unkonfiguriert bleiben. Dies ersetzt keine
   erforderliche Leitungs-, Phasen- oder Scheinleistungsgrenze.
6. Vorhandene Speicher ausdrücklich auswählen. Ein Einzelspeicher benötigt
   dafür keine künstliche Mehrspeicherfarm. Die zugeordnete AC-Istleistung
   muss zum ausgewählten Bestandsgerät gehören. Die Reihenfolge oder ein
   Herstellername erzeugt keine automatische Bereichszuordnung.
7. Anschlussbereich und Regelmesspunkt gleich zuordnen. Bereichsübergreifende
   Regelung ist in Schema 1 gesperrt. M1-Speicher unterliegen rechnerisch
   M1 und M0; die übergeordnete M0-Grenze lässt sich nicht entfernen.
8. Nur Speicher mit gleichem Bereich, Regelpunkt, Zweck und gleicher
   Stellhoheit in dieselbe Dispatchgruppe aufnehmen. Externe Arbitrage
   benötigt die geplante Stellhoheit `external`, andere Aufgaben `eos`.
   **Diese Diagnoseauswahl ändert den vorhandenen Gerätewriter nicht.**
9. PV-Wechselrichter dem tatsächlichen Bereich zuordnen und die bestätigte
   Bezugsleistung in W AC eintragen. DC-Modulleistung in kWp ist nicht
   automatisch die Bezugsgröße für 100/60/30/0-%-Vorgaben.
10. **„Entwurf diagnostizieren“** prüft die ungespeicherte Konfiguration.
    **„NVP-Zuordnung speichern“** übernimmt nur einen vollständig gültigen
    Gesamtstand mit neuer Konfigurationsversion. Ein Versionskonflikt erfordert
    Neuladen und erneute Prüfung; Änderungen werden nicht still überschrieben.

Ein eingetragener Profilname, eine Rückfallkennung oder ein gesetztes
Phasenlimit bestätigt keine Gerätefähigkeit. Diese Angaben sind im
Diagnose-Teststand Zuordnungs- und Planungsdaten.

### Diagnose richtig lesen

| Anzeige / Zustand | Bedeutung |
| --- | --- |
| Gespeicherter Stand | Grundlage der laufenden Diagnose; ein ungespeicherter Entwurf ändert ihn nicht. |
| Vorschau des Entwurfs | Einmalige Prüfung des Formularentwurfs, ohne Persistenz oder Gerätebefehle. |
| Messleistung | Tatsächlich gelesener numerischer Wert mit zugehörigem Zeitstempel; keine Sollvorgabe. |
| Ungültig / veraltet / inkonsistent | Messgrundlage fehlt; es wird kein belastbares Budget berechnet. |
| Momentaner rechnerischer Korridor | Hypothetischer Leistungsbereich aus Momentanmessung und eingetragenen Nennlimits; keine Gerätefreigabe. |
| Anforderung | Rechnerischer lokaler Bedarf, noch nicht angewandt. |
| Angewandt | Benötigt eine tatsächliche Rückmeldung; aus einem Vorschlag oder Empfangs-ACK darf kein Wert erfunden werden. |
| Aktivierung gesperrt | Der aktive dynamische Pfad fehlt in diesem Lieferstand. Die bestehende Regelung bleibt maßgeblich. |

Die laufende Diagnose wird höchstens einmal je Sekunde angestoßen. Die
Browseranzeige fragt ihren Status periodisch ab. Das sind keine garantierten
Regel- oder Schutzreaktionszeiten. Datenbankfehler, laufende Leseaufträge oder
ungültige Messungen können eine neue Diagnose verhindern.

## 3. Grenzen der gegenwärtigen Rechenanzeige

M0 enthält M1 bereits. Für einen Speicher mit positiver Entladeleistung
`p` wird die Restleistung ohne diesen Speicher mit `r = g + p` ermittelt.
Äußere M0-Speicher beeinflussen M1 nicht. Eine TESVOLT-Ladung außerhalb M1
kann daher eine lokale M1-Nulleinspeisung nicht herstellen.

Für einen bekannten Restbereich gilt der rechnerische Speicherkorridor
`[r_max − Importbudget, r_min + Exportbudget]`, geschnitten mit den
Gerätegrenzen. Mehrere unabhängige Teilnehmer teilen dasselbe Budget;
deren volle Einzelspielräume dürfen nicht mehrfach vergeben werden.

Die Live-Diagnose setzt den Restbereich derzeit aus der **Momentanmessung**
zusammen. Sie kennt keine bestätigten Störungsgrenzen über eine Freigabedauer
und keine tatsächlich offenen externen Freigaben. Ihre angenommene
Reservierung ist null, weil dieser neue Pfad keine Freigaben erteilt. Das
belegt nicht, dass fremde Regler oder die Bestandsregelung keine Befehle
ausführen. Deshalb ist das Ergebnis ausdrücklich `isAuthorization: false`.

Der Gruppenplaner kann lokale Anforderungen und externe Zuständigkeiten
beschreiben. Eine Leistungszuteilung verlangt zusätzlich frischen SoC und
bestätigte Verfügbarkeit. Die laufende Diagnose führt diese Telemetrie im
vorliegenden Stand nicht vollständig zu. Entsprechende Gruppen bleiben bei
`capability-unverified`; ein unbekannter SoC wird nicht in eine verfügbare
Lade-/Entladeleistung umgewandelt. Tarifaufträge und wirtschaftliche
Peak-Shaving-Ziele benötigen ebenfalls noch die gruppenspezifische Anbindung.

Die angezeigten Momentankorridore berücksichtigen eingetragene maximale
Lade-/Entladeleistungen. Sie sind **keine vollständige Prüfung von SoC,
Derating, Rampen, Hybridleistung, Phasen, Scheinleistung, wirtschaftlichen
Energiereserven oder Altfreigaben**. Rechenhelfer für einige dieser
Teilaufgaben sind vorhanden, aber noch nicht zu einer aktiven Geräteführung
verbunden.

Ein Intervall ohne null verlangt eine Mindestlade- oder Mindestentladeleistung.
Bloße Maximalwerte können diese Wirkung nicht erzwingen. Ein leeres Intervall
oder bereits überlastete Restbilanz ergibt keine gültige Leistungszusage.
Die Diagnose löst deshalb keine erfundene Entlastungsreaktion aus.

## 4. Architektur und Datenverträge

Maßgeblich sind die TypeScript-Quellen unter `src-ts/runtime-executables/`.
Die Spiegel in `ems/`, `lib/`, `www/` und `main.js` werden nach dem bestehenden
Buildvertrag erzeugt; React liegt unter `src-admin-tab/src/`.

| Komponente | Aufgabe und tatsächliche Wirkung |
| --- | --- |
| `ems/services/nvp-topology.ts` | Schema 1 validieren, M0/M1-Wirkung bestimmen, frische kohärente Messkontexte und homogene Gruppen erzeugen; keine Writes. |
| `ems/services/nvp-budget.ts` | Reine Intervall-/Budgetprüfung, Reserveabzug, Reservierungsrechnung, PV-Minimum und Hybridgrenze; keine Geräteintegration. |
| `ems/services/nvp-grants.ts` | Reiner Freigabe-Zustandsautomat für Simulation und künftige Profile: Sitzung, Sequenz, Empfang/Anwendung, Ablauf und konservative Reservierung; nicht an aktive Geräteschnittstellen angebunden. |
| `ems/services/nvp-group-planner.ts` | Hypothetische Anforderungen je Gruppe unter Wiederverwendung der bestehenden Speicher-Policy; getrennte Zustände, keine Gerätebefehle. |
| `ems/modules/nvp-topology.ts` | Diagnose neben dem Bestand, nicht blockierender Messsampler und eigene Diagnosestates; keine dynamischen Aktorwrites. |
| `lib/nvp-config-api.ts` | Bestandsgerätebindung, Aliasauflösung, versionierte Gesamtvalidierung, Persistenzschutz und Aktivierungssperre. |
| `main.ts` / `ems/module-manager.ts` | Bestehende Konfigurations-/Rechtegrenze und Registrierung des Diagnosemoduls. |
| `NvpTopologyPage.tsx` | Formularentwurf, Speichern, Vorschau und Live-Diagnose; keine direkte Gerätesteuerung. |

Die zusätzliche Adapterkonfiguration heißt `nvpTopology`. Sie enthält
`schemaVersion`, `configVersion`, `mode`, `operation`, `rootPointId`,
`maxSkewMs`, `points`, `storages` und `pvAssignments`. Die bestehende
`storage`-/`storageFarm`-/`gridConstraints`-Konfiguration bleibt für den
realen Betrieb verantwortlich.

| Schnittstelle | Vertrag |
| --- | --- |
| `GET /api/nvp/topology` | Gespeicherte Topologie, Geräteauswahl, Diagnose und Aktivierungssperre. |
| `GET /api/nvp/status` | Aktueller Diagnosestatus ohne erfundenen neuen Messzeitpunkt. |
| `POST /api/nvp/topology/diagnose` | Vollständiger Entwurf unter `config`; validiert und liest eine schreibfreie Vorschau. |
| `POST /api/nvp/topology/config` | Vollständiger Entwurf und `expectedConfigVersion`; Rollenprüfung, Speichersperre, Gesamtvalidierung und Versionsvergleich. |

Alle Endpunkte verwenden die vorhandene serverseitige Installer-/Adminprüfung
und `Cache-Control: no-store`. HTTP 409 bedeutet unter anderem Versionskonflikt
oder gesperrten Übergang; HTTP 422 eine ungültige Topologie. `operation: active`
wird auch bei einem direkten API-Versuch zurückgewiesen. Die Runtime prüft
unabhängig und erzeugt auch nach direkter Konfigurationsmanipulation keine
dynamischen Gerätebefehle.

Der neue Pfad veröffentlicht ausschließlich eigene, lesbare Diagnosestates:

- `nvpTopology.statusJson`: strukturierte Momentaufnahme einschließlich
  `schemaVersion`, `configVersion`, Messwerten, Gründen und Rechenergebnissen;
- `nvpTopology.status`: kurzer Diagnosestatus;
- `nvpTopology.activationSupported`: in diesem Teststand `false`.

Im unveränderten statischen Bestand erzeugt das Modul keine zusätzlichen
Diagnoseobjekte und liest keine neuen M0/M1-Gerätedaten. Eigene Diagnose-State-
Writes sind von Hardware-Sollwerten zu unterscheiden: `writesPerformed: 0`
bezieht sich auf neue dynamische Gerätebefehle, nicht auf die Veröffentlichung
der Diagnose und nicht auf die weiterlaufende Bestandsregelung.

## 5. Migration und Rückweg

Ohne `nvpTopology` beziehungsweise ohne neue Modusauswahl bleibt die
statische Regelung aktiv. Das Update sortiert Speicher nicht um und ersetzt
keinen bisherigen Messdatenpunkt. Eine als dynamisch gespeicherte Diagnose
ist eine zusätzliche Betrachtung der Anlage.

Zur Rückkehr die Betriebsart **Statisch** ausdrücklich speichern. Vorhandene
gültige Diagnosezuordnungen können dabei gespeichert bleiben; sie führen
keine dynamischen Gerätezugriffe aus. Der Import darf eine vorhandene
NVP-Konfiguration nicht still entfernen oder die Versionsprüfung umgehen.
Bei Austausch oder Umsortieren von Farmzeilen die Diagnosezuordnungen erneut
prüfen: Kennung und tatsächliche Speicher-Istquelle müssen zusammenpassen.

Bei Paket-Rücknahme auf 1.0.23 den vorher gesicherten vollständigen
Konfigurations- und Installationsstand verwenden. Die neue Diagnose hat keine
dynamischen Freigaben erteilt; die tatsächliche Bestandssteuerung und externe
Geräteregler müssen dennoch wie bei jedem normalen Adapterwechsel geprüft
werden. Für einen künftigen aktiven dynamischen Stand wird zusätzlich eine
nachgewiesene Ablösung aller noch wirksamen Freigaben erforderlich.

## 6. Vor aktivem dynamischem Betrieb noch umzusetzen

1. Bestehenden Speicher-/Farm-Writer auf getrennte Bereichskontexte und einen
   endgültigen Schreibpfad je physischem Aktor umstellen; externe Stellhoheit
   auch gegenüber Keepalives und Herstellerregelung durchsetzen.
2. Live-SoC, Verfügbarkeit, Derating, Rampen, Tarif-/Peak-Ziele, Hybrid-/Phasen-
   und Scheinleistungsgrenzen an die gemeinsame Budgetierung anbinden.
3. Offene Freigaben, Anwendungsbestätigung und gemessene Wirkung persistent
   und sitzungsgebunden unterscheiden; konservative Wiederaufnahme herstellen.
4. Einschränkungen zuerst wirksam machen. Noch nicht bewiesene Entlastung
   nicht neu vergeben und benötigte Unterstützung nicht vorzeitig zurücknehmen.
5. Externe Geräteprofile mit Sitzung, Sequenz, Gültigkeitsdauer, angewandtem
   Korridor und lokal wirksamem Ablauf-/Rückfallvertrag nachweisen.
6. EVU-, NVP- und Geräteanforderungen je PV-Aktor zusammenführen; Geltungsbereich
   M0/M1/Einzelgerät erhalten und genau einen finalen Writer verwenden.
7. Modus-, Lizenz- und Appwechsel, Kommunikationsausfall und Neustart gegen
   reale Geräteabläufe prüfen. „Alle Speicher auf 0“ ist kein allgemeiner
   sicherer Zustand.
8. Die vollständigen Abnahmefälle einschließlich Hardware-Reaktionszeit,
   tatsächlicher Messgrenzen und unabhängiger Schutzfunktionen nachweisen.

Verantwortlich für diese offenen Implementierungen ist die EOS-Entwicklung;
Geräteprofile und Anlagenprüfung sind mit Anlagenverantwortlichem und
Herstellern abzustimmen. Das ist keine behauptete CRA-/IEC-Konformität,
Zertifizierung oder allgemeine Produktionsfreigabe.
