# NVP 1.0.24 – Änderungsumfang, Prüfplan und Abnahmezuordnung

Stand: 22.10.2026. Ziel-Lieferstand: **1.0.24 NVP-DIAGNOSE-TEST**.
Ausgangsrepository: `NexoWatt-ui-1.0.23-HEIZSTAB-TEST`.
Anforderung: `NW-UI-NVP-ZONEN-20261022`, Spezifikation Version 1.0.

**Dieser Bericht trennt vorhandene Softwarebausteine, geplante Prüfungen und
tatsächliche Nachweise. Beim Erstellen dieser Fassung wurden keine hier
aufgeführten Testläufe als bestanden bestätigt.** Die final ausführende
Prüfung ergänzt Befehle, Laufzeitumgebung, Quell-/Artefaktbezug und Rohlogs.
Frühere Berichte zu 1.0.22 oder 1.0.23 gelten nicht als Nachweis der neuen
M0/M1-Funktion.

Der anschließend erstellte [Ausführungsvermerk](nvp-2026-10-22/PRUEFVERMERK_DE.md)
enthält die tatsächlich gelaufenen Prüfungen und ihre Rohlogs. Diese Tabelle
bleibt die Zuordnung der Anforderungen und ersetzt den Ausführungsvermerk nicht.

## 1. Änderungs- und Nachweisgrenze

Der Stand ergänzt Konfigurationsschema, React-Bedienung, serverseitige API,
Alias-/Gerätebindung, getrennte Messkontexte, hypothetische Gruppenplanung
und reine Intervallberechnung. Im neuen dynamischen Pfad existiert kein
aktiver Gerätewriter. Die statische Speicher-, Farm- und PV-Regelung läuft
weiter. `external` in der Diagnose übergibt keine reale Steuerhoheit.

Die Bedienung, Datenverträge und Migrationsgrenzen stehen in
[NVP-Topologie und Diagnose](../NVP_TOPOLOGIE_DIAGNOSE_DE.md).

### Gelesene Softwareteile

| Kürzel | Maßgebliche Originalquelle | Prüfgegenstand |
| --- | --- | --- |
| S | `src-ts/runtime-executables/ems/services/nvp-topology.ts` | Schema, Nullgrenzen, Topologie, Messfrische und Gruppierung |
| B | `src-ts/runtime-executables/ems/services/nvp-budget.ts` | Korridore, Gesamtintervalle, Reservierungen, PV-Minimum, Hybridgrenzen |
| L | `src-ts/runtime-executables/ems/services/nvp-grants.ts` | Reiner Freigabe-Zustandsautomat für Sitzung, Sequenz, Empfang/Anwendung, Ablauf und konservative Reservierung; keine aktive Geräteanbindung |
| G | `src-ts/runtime-executables/ems/services/nvp-group-planner.ts` | Lokale hypothetische Anforderungen und getrennte Gruppen-/Rampenzustände |
| R | `src-ts/runtime-executables/ems/modules/nvp-topology.ts` | Diagnoseintegration, Messsampler, Aktivierungssperre und eigene States |
| A | `src-ts/runtime-executables/lib/nvp-config-api.ts` plus `main.ts` | Rollen, Bestandsgerätebindung, Aliasauflösung, Versionierung und Persistenz |
| U | `src-admin-tab/src/pages/NvpTopologyPage.tsx` und zugehörige Route/API-Verbindung | Darstellung, vollständiger Entwurf, Vorschau, Speichern, klare Diagnosekennzeichnung |

„Softwareteil vorhanden“ bedeutet Code für einen Teilaspekt, nicht bestandener
Test und nicht vollständige Erfüllung eines aktiven Abnahmefalls.

## 2. Verbindliche Prüfziele für diesen Diagnose-Teststand

1. Statische Alt-Konfiguration löst weder neue Hardwarebefehle noch zusätzliche
   M0/M1-Messzugriffe aus. Bestehende Regelpfade bleiben regressionsgeprüft.
2. Dynamische Diagnose erzeugt ausschließlich eigene Diagnosestates. Kein
   positiver Test darf diese mit angewandten Gerätebefehlen verwechseln.
3. `active` bleibt auf API- und Runtime-Ebene gesperrt, einschließlich direkter
   Konfigurationsänderung und Importversuch. Die Sperre ist ein Nachweis der
   Begrenzung dieses Lieferstands, keine Erfüllung des aktiven Modus.
4. Numerische Eingaben sind echte endliche Zahlen. Nullgrenzen, unbekannte
   lokale Grenzen, ungültige IDs, doppelte Quellen und Aliaszyklen unterscheiden.
5. Rollen, gleichzeitig geöffnete Formulare und fehlgeschlagene Validierung
   dürfen keine teilweise gespeicherte Topologie bewirken.
6. Budgettests prüfen Extremkombinationen mehrerer unabhängiger Teilnehmer,
   lokale Wirkung, Vorzeichen und Übergänge anhand externer Sollwerte.
7. Ein veralteter oder fehlender Messwert erzeugt keinen erfundenen Nullwert.
   Datenbanktimeout darf weder den EMS-Takt blockieren noch unbeschränkt
   weitere Leseaufträge erzeugen.
8. UI zeigt gespeicherten Stand und Entwurf getrennt. Unbekannte Gerätewirkung
   bleibt unbekannt; Diagnosekorridore heißen nicht angewandte Freigaben.

## 3. Zuordnung aller Abnahmefälle T01–T33

Status der folgenden Tabelle: **Prüfplanung / Codezuordnung**. Eine Zeile mit
Softwareteil wird erst durch einen benannten Lauf und Rohbeleg zum
Software-Nachweis. Sämtliche Hardware- und aktiven Integrationsfälle bleiben
ohne gesonderten Nachweis offen.

| ID | Anforderung | Softwareteil / im Teststand prüfbarer Teil | Noch offener aktiver Nachweis |
| --- | --- | --- | --- |
| T01 | Alt-Konfiguration unverändert | S/R: fehlender Modus → statisch, keine neuen Gerätebefehle/Messzugriffe; statische Regression ausführen. | Reale Anlagenregression nach Paketwechsel. |
| T02 | Zweiter Zähler aktiviert nichts | S/R/U: nur ausdrückliche Topologieauswahl; keine automatische Gerätezuordnung. | Elektrische Inbetriebnahme bleibt separat. |
| T03 | Vertauschte/identische Messstellen | S/A: Struktur, doppelte IDs, physische Kennungen und Aliasziel erkennen. | Physisch vertauschte echte Zähler sind ohne unabhängigen Montagenachweis nicht sicher automatisch erkennbar. |
| T04 | FENECON folgt M1, TESVOLT M0 | S/G/B: Wirkungsmatrix und lokaler Rechenbedarf statt globalem NVP. | Getrennte aktive Bereichswriter und tatsächliches Geräteverhalten. |
| T05 | M1 genau einmal in M0 | B/R: M0 nicht um M1 addieren; lokale und äußere Wirkung getrennt. | Übergänge unter tatsächlicher Regelung. |
| T06 | Lokale Nulleinspeisung, äußere KOSTAL-Einspeisung | S/B/G: M1-Exportgrenze getrennt von M0 prüfen. | Lokale PV-Ausgabe und übergeordnete Koordination. |
| T07 | Äußerer TESVOLT ändert M1 nicht | S/B: `affectsPoint` und Bereichsintervalle. | Nachweis der tatsächlichen Verdrahtung/Messgrenzen. |
| T08 | Beide Speicher laden | B: gemeinsame unabhängige Intervalle statt mehrfach verteiltem Restbudget. | Istwirkung, alte Freigaben und Übergangssynchronisierung. |
| T09 | PV und Speicher speisen ein | B: Restbereich plus gemeinsame Exportintervalle. | PV-/ESS-Livebilanz und gemeinsamer finaler Writer. |
| T10 | Mehrere externe Teilnehmer | B: Worst-Case-Summen einschließlich vorgegebener Reservierungen. | Reale Freigabeverträge und deren Laufzeitverwaltung. |
| T11 | Fünf Korridorbeispiele | B: exakte Sollintervalle aus Abschnitt 4 dieses Prüfplans. | Keine Hardware erforderlich für reine Mathematik. |
| T12 | Verzögerte FENECON-Wirkung | B: Restbereich [60,90] kW ergibt höchstens 135 kW Ladung; nach Nachweis [60,60] bis 165 kW. | Erfassen von angewandter Grenze und gemessener Wirkung in der aktiven Runtime. |
| T13 | Restbezug oberhalb Grenze | B: Intervall ohne null und verpflichtende Entladung erkennen; keine falschen Maximalfreigaben. | Bestätigter Mindestleistungsauftrag oder Ersatz-/Schutzreaktion. |
| T14 | Zu hohe Rest-PV, Speicher voll | B/G: leeres/erforderliches Intervall und fehlende SoC-Fähigkeit erkennbar. | Verlässliche SoC-Anbindung, lokale PV-Abregelung und Ausfallpfad. |
| T15 | Unvereinbare Grenzen | S/B: Eingaben, leere Intervalle und unsichere Ausgangsbilanz zurückweisen. | Physisch wirksame Entlastung/Schutzreaktion. |
| T16 | EVU 60/30/0 plus NVP | B: Minimum bereits in AC-Erzeugungsleistung umgerechneter Anforderungen. | Ein gemeinsamer finaler Writer ersetzt konkurrierende Bestandsausgaben. |
| T17 | EVU-Eingang veraltet | B: ungültige Anforderung erzeugt keinen stillen 100-%-Rückfall. | Live-Eingang, herstellerspezifische Rückfallvorgabe und Istwirkung. |
| T18 | KOSTAL 0 % versus M0 0 W Export | S/B: Messbereich und Erzeugungs-/Exportgröße getrennt modellierbar. | Aktive Verarbeitung von Geltungsbereich und Netzbetreibersignal. |
| T19 | Gemeinsamer Hybrid-AC-Port | B: `hybridStorageBounds` prüft eine gemeinsame AC-Grenze. | Fähigkeitsprofil, eindeutige Batterie-AC-Messung und Laufzeitanbindung. |
| T20 | Alter, Zeitversatz, Vorzeichen | S/R: echte numerische Werte, `ts`, Qualität, Alter, Einheit und kohärenter Snapshot. | Vorzeichen und Erfassungszeitpunkt am echten Gerät verifizieren. |
| T21 | Nur Empfang bestätigt | B/L: Empfangs-ACK verengt keine Reservierung; frische bestätigte Anwendung separat. R erfindet keine angewandten Befehle. | Empfang/Anwendung/Wirkung im bestätigten Geräteprofil anbinden. |
| T22 | Alte/doppelte Freigaben | L: simulierte Sitzung, Sequenz, Duplikate und alte Pakete; R/A geben keine aktiven Freigaben aus. | Sitzungen, Sequenzen und Replay-/Duplikatbehandlung an das ausführende Gerät anbinden. |
| T23 | EOS/Netz/Fremdregler fällt aus | L: Zeitablauf allein löst reservierte Rechte nicht auf. R: Diagnosefehler und begrenztes Leseverhalten. | Lokal wirksamer Ablauf-/Rückfallvertrag und Hardwareausfalltests. |
| T24 | Peak-Shaving plus Arbitrage | S/G: getrennte Aufgaben/Stellhoheit; fehlendes Peak-Ziel bleibt unbekannt. | Verbindliche Leistungs-/Energiereserven und Mehrfachnutzungsvertrag. |
| T25 | M0 sättigt M1-Regler | G: getrennte Gruppenzustände und versionierte Budgetrückführung als Rechenbaustein. | Rückführung im geschlossenen aktiven Regelkreis und reale Wiederfreigabe. |
| T26 | Modus/App/Lizenzwechsel | A/R: aktiver Modus gesperrt; Versions-/Übergangsprüfung ohne neue Geräteausgabe. | Alle realen Writer/Freigaben bei aktivem Modus kontrolliert übergeben. |
| T27 | Neustart mit unbestätigten Freigaben | L: neue Sitzung startet mit konservativen Gerätebounds und verlangt Synchronisierung. R erstellt keine aktiven Freigaben. | Bestätigte Altfreigaben-/Gerätebounds und geräteseitige Synchronisierung in der Runtime. |
| T28 | Rechte und ungültige Eingaben | S/A/U: Installer-/Adminrollen, Schema, Gerätebindung, CAS und atomarer Gesamtstand. | Tatsächliche HTTP-/Sitzungsregression ausführen; keine Hardware erforderlich. |
| T29 | Phasen-/Scheinleistung bindet | S/U: Werte getrennt erfassen, aktive Ausgabe ohne Mess-/Begrenzungsprofil sperren. | Phasen-/Scheinleistungsmessung und aktive Budgetwirkung. |
| T30 | Statische Profile/Farm | Bestehende Regressionen plus R: neuer Pfad bleibt im statischen Bestand ohne Gerätewirkung. | Reale Anlage, Mess-/Einheitenvertrag und Geräteprofil nach Update. |
| T31 | Unterstützung erst nach Restriktion zurücknehmen | B: 175-kW-Altfreigabe plus 30-kW-Rücknahme als unsicher erkennen; nach 145-kW-Nachweis zulässig. | Wirksame Reihenfolge und keine vorzeitig freigegebene Unterstützung. |
| T32 | Externer Speicher wählt 0 W | B: alle zulässigen Intervalle prüfen; gemessene Ladung ist keine zugesagte Senke. | PV-Freigabe an bestätigte Mindestaufnahme oder unabhängige Senke koppeln. |
| T33 | Wirtschaftliches Peak-Ziel unerreichbar | G: fehlende Ziele/Verfügbarkeit und unerfüllte rechnerische Anforderung sichtbar halten. | Energie-/Leistungsreservierung und getrennte reale Anschlussabsicherung. |

Die Sperrprüfung von `active` ersetzt insbesondere T04, T06, T16 und T21–T27
nicht. Die aktive Funktion wird erst nach ihrer tatsächlichen Integration
und Prüfung als umgesetzt ausgewiesen.

## 4. Unabhängige numerische Sollwerte

Alle folgenden Tabellenwerte in kW. Import-/Exportbudget jeweils 225 kW,
TESVOLT-Geräteleistung −250 bis +250 kW; keine zusätzlichen SoC-/Phasenlimits.

| Restbereich ohne TESVOLT | Erwarteter Korridor | Aussage |
| --- | --- | --- |
| [20,20] | [−205,+245] | Null enthalten. |
| [−180,−180] | [−250,+45] | Entladung bis 45 kW. |
| [260,260] | [+35,+250] | Mindestens 35 kW Entladung erforderlich. |
| [−260,−260] | [−250,−35] | Mindestens 35 kW Ladung erforderlich. |
| [−20,+60] | [−165,+205] | Unsicherheit verringert beide Freigaben. |
| [60,90] | [−135,+250] | Übergang: höchstens 135 kW Ladung. |
| [60,60] | [−165,+250] | Erst nach bestätigter Entlastung bis 165 kW Ladung. |

Zusätzliche Verfahrensprüfungen:

- Physikalische Nachrechnung der Extremfälle `g = r − Σp`, einschließlich
  beider unabhängiger Richtungen mehrerer Teilnehmer und lokaler M1-Grenzen.
- Zufällige gültige Intervalle mit festem Seed erzeugen und sämtliche
  Eckkombinationen gegen eine von der Vergaberoutine unabhängige Rechnung
  prüfen. Grenzfälle null, NaN, Infinity und falsche Datentypen gesondert testen.
- Bei 50 kW Restlast und 175 kW Ladefreigabe liegen 225 kW Bezug an.
  Rücknahme von 30 kW Unterstützung bei alter Freigabe ergibt 255 kW und muss
  abgewiesen werden. Nach wirksam bestätigter Begrenzung auf 145 kW sind
  80 + 145 = 225 kW wieder zulässig.
- Geplante PV-Senke darf in keinem Test allein aus einer externen
  Maximal-Ladefreigabe oder dem zuletzt gemessenen Laden entstehen.

## 5. Auszuführende Prüfungen und Rohbelege

Die folgenden Befehle sind ein Prüfauftrag, kein Ausführungsprotokoll:

```sh
npm run sync:ts-runtime-executables
npm run admin:build
npm run docs:build
npm run docs:check
npm run build:ts
npm run test:nvp-topology
npm run test:all
npm run check:secrets
npm run publish:check
npm pack --dry-run --json --ignore-scripts
```

`npm run test:nvp-topology` führt `node --test test/nvp-*.test.cjs` aus.
Die vorliegenden Tests sind `test/nvp-domain.test.cjs`,
`test/nvp-group-planner.test.cjs`, `test/nvp-config-api.test.cjs` und
`test/nvp-runtime.test.cjs`, `test/nvp-manager.test.cjs` und
`test/nvp-config-http.test.cjs`. Sie enthalten unter anderem 250 deterministische
Intervallfälle mit unabhängiger Prüfung der Extremkombinationen. Vorhandener
Testcode ist noch kein bestätigter erfolgreicher Lauf.

Zusätzlich die neuen UI-Prüfungen mit ihren im finalen Paket vorhandenen
Skriptnamen einzeln ausführen und protokollieren.
Quellen und erzeugte Runtime müssen beide zum geprüften Stand gehören.
Die bestehenden Freigabegates einschließlich SBOM-/Artefaktbindung sind
beizubehalten; ein neuer Prüfsummenstand ist kein Ersatz für erfolgreiche
fachliche Prüfung.

Vorgesehene Rohbelegablage: `docs/reports/nvp-2026-10-22/`, insbesondere die
Läufe `nvp-tests`, `build-ts`, `test-all` und `publish-check` mit ihrer jeweiligen
tatsächlich erzeugten Dateiendung. Vorhandene Dateien, genaue Namen und
Exitcodes sind im endgültigen Ausführungsvermerk anzugeben; diese Planung
behauptet keine bereits erzeugten Logs.

Für jeden tatsächlichen Lauf ergänzen:

| Feld | Erforderlicher Inhalt |
| --- | --- |
| Zeitpunkt und Umgebung | Datum/Uhrzeit, OS, Node/npm, verwendete Buildabhängigkeiten |
| Quellstand | Ausgangs-ZIP/Hash, Zielversion, Commit oder geprüfte Quellen-/Artefakthashes |
| Befehl | Exakter Befehl und Arbeitsverzeichnis |
| Ergebnis | Exitcode, überprüfte Fallzahl, Soll/Ist und Abweichungen |
| Rohbeleg | Relative Log-/JSON-Datei im Repository, bereinigt um Geheimnisse |
| Grenze | Mock-/Rechen-/HTTP-/Browser-/Hardwareprüfung getrennt benennen |

Nicht ausgeführte oder fehlgeschlagene Prüfungen bleiben ausdrücklich offen.
Die endgültige Releaseprüfung muss gemäß `docs/AGENTS.md` außerdem frische
Extraktion, überlagerte Altinstallation und die lokale Publish-Kette ohne
externe Veröffentlichung berücksichtigen. Fehlende Laufzeitwerkzeuge oder
Netzzugriffe werden als Hindernis dokumentiert, nicht durch behauptete
Ergebnisse ersetzt.

## 6. Offene aktive Anforderungen und Priorität

Dies sind neue funktionale Integrationslücken, keine erfundenen CVEs und kein
Nachweis einer bereits erfolgten Fremdausnutzung. Bestehende Sicherheitsbefunde
bleiben im [zentralen Befundregister](../security/BEFUNDREGISTER_DE.md).

| Kennung | Offener Punkt | Wirkung und Termin |
| --- | --- | --- |
| NVP-ACT-01 | Bereichsgebundener endgültiger ESS-/Farm-Writer fehlt. | Aktiven dynamischen Betrieb vor Schließung gesperrt halten; EOS-Entwicklung. |
| NVP-ACT-02 | Externes Profil, Sitzungen, Ablauf, Altfreigaben und lokale Rückfälle fehlen. | Keine aktiven TESVOLT-Freigaben; Hersteller-/Anlagenabstimmung und Implementierung vor Aktivierung. |
| NVP-ACT-03 | Bestehende EVU-/PV-Ausgaben noch nicht gemeinsam dynamisch dispatcht. | Keine Behauptung aktiver lokaler Nulleinspeisung oder eines finalen gemeinsamen PV-Writers; EOS-Entwicklung. |
| NVP-ACT-04 | Vollständige Live-Fähigkeits-/SoC-/Hybrid-/Phasen-/Scheinleistungsanbindung fehlt. | Momentanbudgets bleiben ausdrücklich hypothetisch; vor aktiver Freigabe nachweisen. |
| NVP-ACT-05 | Gruppen-Tarifziele, wirtschaftliche Peak-Ziele und reservierte Energie nicht durchgehend angebunden. | Keine wirtschaftlichen Ziele als erreicht melden; vor Freigabe der jeweiligen Betriebsart schließen. |
| NVP-ACT-06 | Reale Messstellen-/Vorzeichen-/Zeit- und Ausfallnachweise fehlen. | Softwaretests belegen keine elektrische Schutzwirkung; Anlagenverantwortlicher und Gerätehersteller vor Aktivierung. |

Kein aufgeführter offener Punkt wird allein durch ein Profilnamensfeld oder
einen bestandenen Diagnosetest geschlossen. Der Diagnose-Teststand ist keine
vollständige Umsetzung des beauftragten aktiven dynamischen NVP-Modus.
