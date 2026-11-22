# Änderungs- und Prüfvermerk – Heizstab 1.0.23

Stand: 08.10.2026. Der finale Produktquellstand ist abgeschlossen und erneut
gebaut. Gezielte Quellen-, generierte Runtime-, Browserprüfungen und separates
Quellreview bestanden. Gesamtregression, SBOM-/Paketprüfung, frische und
überlagerte lokale Publish-Prüfungen sowie Geheimnissuche bestanden.
Hardwaretests sind nicht ausgeführt; eine allgemeine Produktivfreigabe bleibt offen.

| Feld | Bezug |
| --- | --- |
| Anforderung | Auto im Nachtfenster AUS; ab morgendlicher Freigabe schrittweiser PV-Anlauf bei Nulleinspeisung; Batterieentladung nicht als PV nutzen. |
| Quelle | Anwenderbericht vom 08.10.2026 und zwei geprüfte Bildschirmfotos. Die Heizstabansicht zeigt Auto, 0 W, 0 von 6 Stufen bei konfigurierten 9.000 W sowie `pv_or_forecast_signal_too_low`. Die Tagesgrafik enthält keine ausreichend zuordenbare Legende; sie beweist deshalb weder Heizlast noch Datenpunkt-Zuordnung. |
| Version / Basis | Teststand 1.0.23 auf Basis des vollständigen Sicherheits-Prüfstands 1.0.22 vom 29.09.2026. Keine fertige Offline-Lizenzarchitektur übernommen. |
| Befunde | `NW-HEAT-01`: Nachtabschaltung kann durch externe Handerkennung vorzeitig verlassen werden. `NW-HEAT-02`: PV-Freigabe und Eingangsprüfung sind nicht hinreichend an frische, korrekt typisierte Istwerte gebunden. |
| Betroffene Komponenten | Kanonische Heizstab-Regelung, zugehörige typisierte Spiegel, generierte Laufzeit, Heizstab-Bedienung und passende Regressionen. Konkreter Quell-/Artefaktbezug wird durch den aktuellen Release-Dateihashnachweis hergestellt. |
| Geprüfter Heizstab-Quellhash | SHA-256 von `src-ts/runtime-executables/ems/modules/heating-rod-control.ts`: `43b9f107903da4cb85c136fd25f730cf15e333656c5b3ed72ec50a9097a75b3a`. |
| Physische Wirkung | Relais-/Leistungsbefehle an konfigurierten Heizstab. Fehlerhafte Interpretation alter Rückmeldungen kann unerwünschte Heizlast erhalten. |
| Geheimnisse / Netz | Für den Heizstabfix werden keine neuen Zugangsdaten, externen Dienste oder offenen Steuerungszugänge eingeführt. Bestehende private Lizenzbereitstellung bleibt außerhalb der Lieferung. |

## Fehler und Korrekturgrenze

Im untersuchten Ausgangspfad kann eine noch aktive Rückmeldung nach einem
AUS-Befehl oder ein fehlgeschlagener AUS-Versuch zur Erkennung einer vermeintlichen
externen Handfreigabe führen. Erfolgt diese Erkennung vor dem Nachtblock, wird
die erforderliche Abschaltung nicht weiter verfolgt. Der berichtete reale
Anlagenfehler ist ohne Gerätezugriff damit noch nicht vollständig bewiesen;
der fehlerhafte Softwarepfad ist Gegenstand der gezielten Nachprüfung.

Die Korrektur muss den Vorrang der aktiven Auto-Nachtsperre einschließlich
Mindestlaufzeit, verzögerter Rückmeldung, Schreibfehler und Neustart erhalten.
Am Morgen bedeutet die Endzeit nur die Freigabe der PV-Regelung. Zuschaltungen
benötigen frische Messungen und das aktuelle PV-Budget. Explizite Manual-/Boost-
Bedienung und tatsächliche Geräte-/Temperaturschutzgrenzen sind getrennt zu prüfen.
Sollwerte dürfen nicht als bestätigte Istwirkung ausgegeben werden.

Die abschließende Regelungsänderung hält eine offene automatische Abschaltung
als `autoStopPending` fest, bis ein zeitlich passender, frischer AUS-Nachweis
vorliegt. Ein Neustart oder das Ende des Nachtfensters hebt diese Pflicht nicht
auf. AUS-Befehle werden bei Schreibfehlern oder fehlenden/widersprüchlichen
Rückmeldungen weiter versucht. Als Bestätigung gelten unabhängige frische
AUS-Rückmeldungen oder ein akzeptierter AUS-Befehl mit frischer 0-W-Messung
ohne widersprechende EIN-Rückmeldung. Der Messzeitpunkt muss strikt nach Beginn
des AUS-Auftrags liegen; gleicher Zeitstempel genügt nicht. Ein abgewiesener
AUS-Auftrag kann in diesem Versuch keine Bestätigung erzeugen. Nach Neustart
erzwingt ein gespeicherter offener Auftrag ohne lokalen Zeitnachweis zunächst
einen neuen physischen AUS-Versuch. Nach tatsächlicher Bestätigung werden
keine dauernden identischen AUS-Schreibvorgänge erzeugt. Die Nachtbereinigung
verwirft alte Probe-/Rampentimer; der Schutz prüft die Zeitgrenze auch vor und
nach asynchronen Relais-/Rückmeldezugriffen.

Der zentrale PV-Pfad erhöht höchstens um eine physisch schaltbare Stufe pro
Wartezeit. Bei geringerem Angebot reduziert er die Stufen; harte Defizite
erfordern sofort die AUS-Anforderung. Ein unerledigter Abschaltvorgang kann
deshalb auch nach der morgendlichen Uhrzeit einen neuen PV-Anlauf sperren.

Zusätzlich wurden im PV-Freigabepfad folgende Fehlerfälle festgestellt: Eine
veraltete Prognose zusammen mit 0 W gemessener PV kann einen Startversuch
erlauben; umgekehrt kann tatsächlich gemessene PV von 9.000 W ohne Prognose
blockiert werden. Veraltete Cachewerte sowie die Umdeutung fehlender
Batteriewerte zu einem gültig wirkenden Nullwert müssen ebenfalls abgefangen
werden. Die Nachbesserung trennt aktuelle Messnachweise, Prognosehilfen und
unbekannte Werte. Eine Wetterprognose ist weder gemessene PV noch ein Ersatz für
den Nachweis, dass der Speicher keine Energie zum Heizstab beiträgt.

## Prüfmatrix und tatsächlicher Stand

Die folgende Tabelle wird nur aus tatsächlich ausgeführten Läufen ergänzt.
Ein geplanter Test oder eine alte Prüfung des 1.0.22-Stands ist kein PASS für
den neuen Stand.

Das ergänzende Review fand `HR-REVIEW-09`: Ein alter FALSE-Rückmeldewert mit
derselben Millisekunde wie ein abgewiesener AUS-Befehl konnte fälschlich als
Bestätigung gelten. Dieser Befund wurde vor Abschluss des Produktquellstands
behoben und durch einen zusätzlichen Negativtest nachgeprüft. Maßgeblich sind
`build-ts-verified`, `heating-night-verified` und `heating-pv-verified` sowie das
unveränderte UI-Ergebnis `heating-ui-runtime`; frühere Dateien bleiben
historische Zwischenbelege.

Die früheren Läufe mit 9 Nacht-/Verlaufsgruppen und 14 PV-/Frischegruppen
sind unten als Zwischenbelege erhalten. Die ergänzende Korrektur einer
verspäteten Rückmeldung an der Nachtgrenze und die Istleistungs-Pflicht im
älteren Forecast-Probenpfad wurden anschließend erneut auf kanonischer Quelle
und generierter Runtime geprüft; maßgeblich sind die folgenden aktuellen Läufe.

| Prüfbereich | Soll | Aktueller Nachweis |
| --- | --- | --- |
| Nacht / AUS | Nachtsperre wirkt vor externer Handerkennung; Mindestlaufzeit, Restfeedback und AUS-Fehler verhindern sie nicht. | Kanonische Quelle und generierte Runtime: jeweils 11 Nacht-/Verlaufsgruppen bestanden. |
| Neustart / Uhrzeit | Start im Nachtfenster bleibt gesperrt; lokale Zeit und Mitternachtsfenster werden korrekt ausgewertet. | Neustart und asynchrone Nachtgrenze im jeweils 11-Gruppen-Lauf auf Quelle und Runtime bestanden. |
| Morgen / PV / Batterie | Schrittweiser Start, keine Freigabe allein durch Uhrzeit, kein Batterieanteil als PV, Reduktion bei Einbruch; reale ausreichend frische PV nicht allein wegen fehlender Prognose sperren. | Morgenrampe/Defizit im 11-Gruppen-Lauf und PV-Freigabe im 15-Gruppen-Lauf, jeweils Quelle und Runtime, bestanden. |
| Messwert-Triage / Prognose | Veraltete Prognose, alte Cachewerte und fehlende Batteriemessung nicht als belastbare PV-/Speicherfreigabe behandeln. | Kanonische Quelle und generierte Runtime: jeweils 15 PV-/Frischegruppen bestanden. |
| Manual / Boost / Schutz | Bewusste Bedienfreigaben und übergeordnete Temperatur-, Netz- und Geräteschutzgrenzen bleiben wirksam. | Manual/Boost und deaktivierte Regelung im jeweils 11-Gruppen-Lauf bestanden; bestehende Regressionen im erfolgreichen `test:all` enthalten. |
| Oberfläche | Soll und echte Istwirkung sind unterscheidbar; Nachtstatus entspricht der Regelung. | 42 Gruppen über Quelle, Spiegel und generierte Runtime bestanden. Isolierter echter Chromium-Dialog: 5 Szenarien bestanden, siehe Browsernachweis. |
| Build / Gesamtregression | Kanonische Quelle, Spiegel, generierte Laufzeit und Dokumentation passen zusammen; relevante bestehende Regressionen bleiben erfolgreich. | `build:ts`, `docs:build` und abschließendes `test:all` mit Exit 0 abgeschlossen; Gesamtlauf 134,164 Sekunden. |
| Geheimnissuche / SBOM / Paket | Vollständige Lieferung ohne private Konfiguration; SBOM und Dateihashes passen zum tatsächlichen Paket. | SBOM-Erzeugung/-Versiegelung, Geheimnissuche, npm-Packvorschau, echter Tarball-Starttest und Tarball-Geheimnissuche bestanden. Frische und überlagerte Kopie bestanden vollständiges lokales `prepublishOnly`; versiegelte Dateien unverändert. |
| Reale Hausanlage / Feldanlagen | Gerätereaktion, Rückmeldung, Temperatur, Kommunikationsausfall, Backup und Rückfall am konkreten System nachgewiesen. | Nicht ausgeführt. Eigentest durch Anwender vorgesehen. |

### Prüfungen des finalen Produktquellstands

Alle folgenden Läufe vom 08.10.2026 endeten mit Exitcode 0. Die Regelungstests
verwenden kontrollierte Mess-/Geräte-I/O und Zeit; sie sprechen keine reale
Anlage an.

| Befehl | Ergebnis / Umfang | Rohbelege |
| --- | --- | --- |
| `npm run test:heating-rod-night-ramp` | Jeweils 11 Tick-/Verlaufsgruppen auf kanonischer Quelle und generierter Runtime bestanden. | [Ergebnis](heating-night-verified.json), [Ausgabe](heating-night-verified.log) |
| `npm run test:heating-rod-pv-freshness` | Jeweils 15 PV-/Frischegruppen auf kanonischer Quelle und generierter Runtime bestanden; zusätzlich Reduktion bestätigter Stufen bei anhaltender 100-/250-W-Batterieversorgung nach höchstens 3 Sekunden im kontrollierten Test. | [Ergebnis](heating-pv-verified.json), [Ausgabe](heating-pv-verified.log) |
| `npm run test:heating-rod-night-ui` | 42 Gruppen über kanonische Quelle, typisierten Spiegel und generierte Runtime; DOM-/API-Fixtures, kein Hardwaretest. | [Ergebnis](heating-ui-runtime.json), [Ausgabe](heating-ui-runtime.log) |
| `npm run build:ts` | Finalen Produktquellstand nach fachlichem Spiegelabgleich vollständig gebaut. | [Ergebnis](build-ts-verified.json), [Ausgabe](build-ts-verified.log) |
| `npm run docs:build` | Dokumentationsindex erfolgreich erzeugt. | [Ergebnis](docs-build.json), [Ausgabe](docs-build.log) |

Ein früherer Build stoppte am noch nicht fachlich abgeglichenen manuellen
Heizstab-Spiegel. Der Fehler blieb als [Zwischenbeleg](build-ts.json) erhalten;
er wurde vor dem erfolgreichen abschließenden TypeScript-Build behoben. Die
Prüfung wurde nicht entfernt oder umgangen.

Ein separater Review-Agent prüfte den oben genannten Quellhash und wiederholte
die 11 Nacht- sowie 15 PV-Gruppen erfolgreich. Vier eigene zusätzliche Fälle
prüften verzögertes FALSE an der Nachtgrenze, Wiederholung nach einem
Persistenzfehler einschließlich Neustart, gleiche Zeitstempel beziehungsweise
fehlenden lokalen Quittungsnachweis und anhaltende 100-/250-W-Batterieentladung.
Die Quellbefunde `HR-REVIEW-01` bis `HR-REVIEW-09` einschließlich `06A` sind im
geprüften Quellstand nachgebessert. Das ist eine getrennte technische
Gegenprüfung im Entwicklungsteam, keine externe Zertifizierung.
Beleg: [Review mit Befunden, Quellhash und Testergebnissen](independent-review.json).

### Gesamtregression und tatsächliches Paket

| Prüfung | Ergebnis und Nachweisgrenze | Rohbelege |
| --- | --- | --- |
| `npm run test:all` | PASS, Exit 0, 134,164 Sekunden auf dem finalen Produktstand; lokale automatische Gesamtregression. | [Ergebnis](test-all-verified.json), [Ausgabe](test-all-verified.log) |
| `npm run release:generate-manifest` | PASS, CycloneDX-Produkt-SBOM für 1.0.23 erzeugt und geprüft, danach Artefakt-Dateien versiegelt. | [Ergebnis](sbom-seal-verified.json), [Ausgabe](sbom-seal-verified.log) |
| `npm run prepublishOnly`, frische und überlagerte Kopie | Beide Exit 0; versiegelte Dateien unverändert. In der überlagerten Kopie wurde das alte Admin-Asset bereinigt. Ausschließlich lokaler Registry-Test, keine Veröffentlichung; reale npm-Verfügbarkeit der Versionsnummer damit nicht geprüft. | [Ergebnis](prepublish-copies.json), [frische Kopie](prepublish-fresh.log), [überlagerte Kopie](prepublish-overlay.log) |
| `npm pack --dry-run --json --ignore-scripts` | PASS, tatsächliche npm-Paketliste geprüft. Zusätzlich wurde ein echter Tarball mit 407 Einträgen erzeugt und extrahiert. | [Ergebnis](pack-dry-run.json), [Paketliste](pack-dry-run.log) |
| Startprüfung des extrahierten Tarballs | PASS: 235 JS-/MJS-Dateien syntaktisch geprüft; relative `require()`-Pfade vollständig und main.js-/EMS-/§14a-Startkette konstruierbar. Kein gestarteter echter ioBroker-Host und kein Gerätetest. | [Ergebnis](tarball-start-smoke.json), [Ausgabe](tarball-start-smoke.log) |
| `npm run check:secrets` und Scan des extrahierten Tarballs | Beide Exit 0; keine Funde in den unterstützten Regeln. Der Paket-Scan erfasste 407 Dateien. Scannergrenzen bleiben bestehen; keine pauschale Garantie, beliebige Geheimnisse erkennen zu können. | [Repository-Ergebnis](secret-scan-verified.json), [Repository-Ausgabe](secret-scan-verified.log), [Tarball-Ergebnis](tarball-secrets.json), [Tarball-Ausgabe](tarball-secrets.log) |

Der erste Gesamtlauf scheiterte an der lokal noch nicht installierten
React-Testabhängigkeit in `src-admin-tab` (`Cannot find module 'react'`).
Die vorhandenen, unveränderten Lockdateien wurden mit `npm ci --ignore-scripts`
verwendet, um die fehlenden 71 Pakete der Testumgebung bereitzustellen.
Anschließend wurde der vollständige Gesamtlauf erfolgreich wiederholt.
Der [fehlgeschlagene Erstlauf](test-all.json) samt [Ausgabe](test-all.log)
bleibt als Umgebungsbefund erhalten; er wurde nicht als Produkt-PASS umgedeutet.

### Historische Zwischenläufe derselben Bearbeitung

Am 08.10.2026 bestanden mit Exitcode 0:

| Befehl | Ergebnis / Umfang | Rohbelege |
| --- | --- | --- |
| `node scripts/verify-heating-rod-night-ramp.cjs` | 9 echte Tick-/Verlaufsgruppen mit kontrollierten Geräte-I/O: Nacht, AUS-Fehler, Neustart, fehlende/widersprüchliche Rückmeldung, Manual/Boost, deaktivierte Regelung, Morgenrampe, Defizit/Batterie und asynchrone Nachtgrenze. | [Ergebnis](heating-night-source.json), [Ausgabe](heating-night-source.log) |
| `node scripts/verify-heating-rod-pv-freshness.cjs` | 14 Gruppen auf der kanonischen Steuerungsquelle mit kontrollierten Mess-I/O; kein Hardwaretest. | [Ergebnis](heating-pv-source.json), [Ausgabe mit Prüffällen](heating-pv-source.log) |

Der PV-Lauf prüft insbesondere frische tatsächliche 9 kW PV ohne Prognose,
einzelne bestätigte Morgenstufen mit Wartezeit, keine Forecast-Freigabe bei
0 W Ist-PV, begrenztes Alter und echte Datentypen von Prognosen/PV-Caches,
keine Budgeterzeugung aus einem zukünftigen Tagespeak oder veralteter
Batterieladeleistung. Fehlende beziehungsweise nur bilanzierte Batteriewerte
gelten nicht als bestätigter Nullfluss; Bruttoentladung einer Speicherfarm
bleibt auch bei Netto-Null/-Ladung sperrend. Messverlust beendet eine Probe;
PV-Anstieg allein bestätigt weder Netzbezug noch Batterieentladung als PV.
Relais-Sollwerte sind keine gemessene Heizleistung. Ein reduziertes zentrales
Budget bleibt maßgeblich und der Zentralmodus erhält keinen Rückfall in einen
alten Prognosepfad. Der nach diesem Zwischenlauf noch nötige Abgleich mit dem
generierten Laufzeitstand ist durch die oben genannten aktuellen Quellen-/
Runtime-Prüfungen erfolgt. Die getrennte finale Paketprüfung ist oben dokumentiert.

Die ergänzte Messwertvorgabe verlangt für PV-, NVP-, Batterie- und
Heizstab-Istleistung ein nachweisbares Alter von höchstens 5 Sekunden.
Ein Prognose-Snapshot darf höchstens 60 Sekunden und seine Quelldaten höchstens
2 Stunden alt sein. Der ältere Forecast-Probenpfad benötigt nun wie der
Zentralmodus einen frischen echten Heizleistungs-Datenpunkt; andernfalls
sperrt `heating_power_unknown` den neuen Versuch. Dies kann eine bislang
unvollständige Anlagenzuordnung sichtbar machen. Die aktualisierte
[Testanleitung](../../operations/HEIZSTAB_NACHT_PV_TEST_DE.md) erläutert die
erforderliche Messung und grenzt sie von Relais-/Sollwerten ab.

Zwischenbeleg der UI-Änderung: `node scripts/verify-heating-rod-night-ui.cjs
--source-only` bestand am 08.10.2026 mit **28 Prüfgruppen** für kanonische Quelle
und typisierten Spiegel. Geprüft wurden die tatsächliche Renderer-/API-Logik mit
kontrollierten Testdaten, darunter Nachtstatus vor altem PV-Prognosefehler,
Rest-Istleistung und ausstehende Abschaltbestätigung sowie unveränderte explizite
Manual-/Boost-Anzeigen. Das ist keine Prüfung des endgültig generierten
Lieferartefakts, kein echter Browserlauf und kein Hardwaretest.
Rohbelege: [Ergebnis](heating-ui-source.json), [Prüfausgabe](heating-ui-source.log).

Zusätzlich bestand am 08.10.2026 um 19:37 UTC ein echter Chromium-Lauf mit
**5 Szenarien**, Chromium 153.0.8010.0 und Node.js 24.19.0 bei 1280 × 920 Pixeln.
Er verwendete das originale Dialog-HTML/CSS und die vollständige Quick-Control-
Logik aus der kanonischen Quelle; API-Antworten und Schreibziele waren lokale
Testdaten. Nachtanzeige, verbleibende Heizleistung, Manual-Klick, Boost-Klick
und morgendliches PV-Warten bestanden ohne JavaScript-Browserfehler. Drei der
fünf Screenshots wurden zusätzlich visuell geprüft. Der Lauf belegt den
isolierten Dialog, keinen vollständigen Adapter- oder Hardwaretest.
Belege: [Browserbericht](HEIZSTAB_BROWSER_PRUEFUNG_DE.md),
[Rohdaten mit Quellhashes](browser-quick-control.json).

Die UI zeigt einen aktiven Backend-Nachtblock als „Nachtpause“ / „Nachts
gesperrt · Automatik ab HH:MM“. Bei verbleibender Istwirkung oder ausstehender/
fehlgeschlagener Rückmeldung ergänzt sie „Abschaltung noch nicht bestätigt“.
Die AppCenter-Hilfe stellt klar, dass aktives Auto während der Nachtsperre auch
extern eingeschaltete Relais ausschaltet; explizite Manual-/Boost-Freigaben sind
davon getrennt.

## Übergabe und verbleibende Nachweise

Der vereinbarte Lieferumfang ist das vollständige Repository des Teststands,
einschließlich Quellcode, Laufzeit, Dokumentation, automatischer SBOM und
zugehörigen Prüfbelegen. Eine Veröffentlichung oder Installation wird durch
diesen Vermerk nicht als erfolgt ausgegeben.

Die [kurze Testanleitung](../../operations/HEIZSTAB_NACHT_PV_TEST_DE.md) beschreibt
Sicherung, Nachtbeginn, Morgenanlauf, Rückmeldungen und Rückfall auf der eigenen
Anlage. Hardwaremodell, Firmware und tatsächliche Datenpunkt-Zuordnung müssen
für einen Anlagenbefund festgehalten werden. Ein fehlender Kommunikationsweg
kann softwareseitige AUS-Versuche wirkungslos lassen; ein unabhängig wirksamer
Geräteschutz bleibt erforderlich.

`NW-HEAT-01` und `NW-HEAT-02` sind für diesen Quell-/Runtime-/Paketstand
softwareseitig korrigiert und nachgeprüft. Der konkrete Hausanlagenfehler ist
erst mit der beschriebenen Geräteprüfung abschließend zuzuordnen. Die genannten
Zeitgrenzen wurden mit kontrollierter Testzeit geprüft; eine garantierte
physische Reaktionszeit auf dem Zielgerät wurde nicht gemessen.

Die bestehenden offenen Sicherheits-, Lieferketten- und Gesamtsystemnachweise
im [Befundregister](../../security/BEFUNDREGISTER_DE.md) bleiben erhalten. Diese
gezielte Fehlerkorrektur begründet weder vollständige IEC-/CRA-Konformität noch
eine allgemeine Produktivfreigabe. Verantwortlich für Korrektur und lokale
Software-Nachprüfung ist die EOS-Entwicklung; der Anlagenverantwortliche führt
den kontrollierten Eigentest mit realer Rückmeldung aus.
