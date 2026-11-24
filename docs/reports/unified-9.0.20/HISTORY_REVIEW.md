# History-Messwerte und Tarifwerte – Nachprüfung 9.0.20

Stand: 24.11.2026. Geprüfter Ausgangsstand: unverändertes Repository 9.0.19.

## Reproduzierte Befunde

| Kennung | Priorität | Auslöser und tatsächlich beobachteter Fehler |
| --- | --- | --- |
| HIST-920-01 | Hoch | `updateHistorieExportStates`: fehlender/veralteter abgeleiteter PV-/Verbrauchswert wurde durch `Number(null)` zu 0. Vorhandene gültige Ersatzmessungen 5000 W PV und 6000 W Verbrauch wurden als 0 W protokolliert. |
| HIST-920-02 | Hoch | Einzel-Speicher mit DC-PV: bereits zusammengeführter kanonischer PV-Wert 5000 W plus DC-Anteil 3000 W wurde nochmals auf 8000 W erhöht. |
| HIST-920-03 | Hoch | Fehlender Providerpreis wurde im History-Pfad zu 0 EUR/kWh. Der vorhandene Festpreis 0,35 EUR/kWh wurde dadurch verdrängt. Auch `tarif.currentPriceFresh=false` hinderte einen noch vorhandenen Preis nicht an einer erneuten History-Veröffentlichung. Das Wertkonto führt den History-Providerpreis als mögliche Ersatzquelle. |
| HIST-920-04 | Mittel | Fehlender Farm-SoC wurde zu 0 %, fehlende Netz-/Batteriemessungen konnten als neue 0-W-Messung geschrieben werden. Der History-Sink selbst wandelte `null` ebenfalls zu 0 um. |
| HIST-920-05 | Mittel | Bereits validierte negative kanonische EUR-Preise unter −5 EUR/kWh wurden in History auf −5 gekürzt; Preis und Netzentgeltzerlegung wichen damit von der wirklichen Quelle ab. |
| HIST-920-06 | Hoch | `/api/history` verlängerte einen vorhandenen kanonischen Leistungspunkt unbegrenzt bis zum Ende des angefragten Zeitraums. Auch nach fehlenden Exporten blieb damit eine alte Leistung scheinbar gültig. Ladepunktsummen verwarfen fehlende Mitglieder und konnten unvollständige Werte als Gesamtsumme anzeigen. |
| HIST-920-07 | Mittel | Im History-Frontend wurde `null` erneut zu 0. Leistungs-/SoC-Linien und Flächen verbanden Abschnitte über Ausfälle, Energieintegrationen erzeugten Rampen durch unbekannte Bereiche. Ein vom Backend bewusst auf `null` gesetzter Gesamtwert wurde durch `Number(null)` als exakte 0 übernommen. |
| HIST-920-08 | Hoch | History-Preisintervalle, Kostenaggregation und Diagrammachsen begrenzten negative Strompreise beziehungsweise negative Kosten auf 0. Ein gemischter Viertelstundenverlauf mit 2 kWh Bezug und tatsächlichen −0,15 EUR Kosten verlor damit die Gutschrift. Auch `/api/history` kürzte validierte EUR-Preise unter −5; fehlende manuelle Preise wurden durch Null-Konvertierung zu kostenlosen Preisen. |

Der Ausgangsrepro führt die tatsächlichen Methodenrümpfe aus dem TS-Quelltext aus. Nur Cache, Uhr und physische Quellen-/Schreibumgebung sind kontrollierte Fixtures. Sieben Fehlerszenarien wurden unter Node 22.23.4 und 24.22.3 bestätigt. Das ist kein Hardware-/Influx-Servernachweis.

## Korrektur

* Ein ausschließlich im History-Verbraucher verwendeter Leser prüft numerischen Wert, Zeitstempel, Alter und vorhandene Qualitätskennzeichnung. Fehlende, ungültige oder alte Daten werden nicht als neue Stichprobe veröffentlicht.
* Frische abgeleitete Werte haben Vorrang, einschließlich echter 0. Fehlen sie, bleiben gültige direkte Messungen nutzbar. Bereits zusammengeführte PV erhält keinen zweiten DC-Zuschlag.
* Netzwerte beachten ausdrücklich `hasGrid`; die Darstellungsersatzwerte 0/0 bei unbekanntem NVP sind keine Messung. Farm-/Batterieausfallcodes werden ebenso berücksichtigt. Die globalen Regelungs-/Messresolver wurden dafür nicht verändert.
* Farm-SoC verwendet nur frische tatsächliche Werte, einschließlich echter 0 %. Ladepunkt-/Erzeuger-/Verbraucher-Historien werden nicht aus abgelaufenen Cachewerten neu gestempelt.
* Providerpreise beachten die ausdrücklichen Frischekennzeichen und ihr Zeitbudget. Ungültige Providerwerte werden nicht archiviert. Der bestehende konfigurierte manuelle Tarif bleibt Ersatz; Standard- und dynamischer Betrieb behalten ihre Auswahl. Echte Null-/Negativpreise und die Netzentgeltzerlegung bleiben erhalten.
* Der gemeinsame History-Sink lehnt `null`, leere Texte, Statusflags und nicht endliche Werte ab. Das verändert keine physische Stellgröße.
* Kanonische Leistung-/SoC-Reihen werden nur für ein konfiguriertes Exportintervall beziehungsweise einen gröberen Abfrage-Bucket fortgeschrieben. Die tatsächliche Exportimplementierung schreibt unveränderte Leistungspunkte (`tolAbs=0`); die automatisch eingerichtete Influx-Konfiguration verwendet `changesOnly=false`. Die Abfrage nutzt deshalb die vorhandene 10–60-Minuten-Abtastung und erfindet kein allgemeines Geräte-Zeitbudget. Eigene alte History-Zuordnungen und auf Änderung gespeicherte Tarifreihen behalten ihr bisheriges Verhalten.
* Summen aus Ladepunkt-Historien verlangen pro Zeitpunkt einen gültigen Wert aller konfigurierten Mitglieder. Fehlende Mitglieder bleiben als Lücke erhalten. Die vorhandene Begrenzung auf acht parallele Abfragen bleibt bestehen.
* Linien und gestapelte Flächen beginnen nach einer Lücke neu; Tooltip-Werte bleiben unbekannt. Energieintegrationen überspringen Abschnitte mit fehlenden Endpunkten. Die Oberfläche weist bei Lücken ausdrücklich darauf hin, dass berechnete Summen nur bekannte Abschnitte enthalten; `energyExact=null` ist keine exakte Nullenergie.
* Negative und echte Nullpreise bleiben in `/api/history`, Viertelstundenintervallen, Kosten, Tagesaggregation, Zusammenfassung und beiden Diagrammachsen erhalten. Der Preis wird nicht erneut nach vermuteter Einheit umgerechnet. Die bestehende nichtnegative Netzentgeltregel und die Zerlegung Gesamtpreis minus Netzentgelt bleiben erhalten. Zeitgewichtete Diagramm-Aggregation und energiegewichteter Durchschnitt in den Karten werden für bekannte Preise nicht verändert. Fehlende Preise bleiben unbekannt; Teilkosten werden als solche kenntlich gemacht.
* Der History-Cacheleser nimmt nur eigene Dateneigenschaften für einen geprüften, begrenzten Cache-Schlüssel entgegen. Prototypwerte und Accessors für Eintrag, Zeitstempel, Messwert oder Qualität werden ohne Getter-Aufruf verworfen. Damit entfällt der neu entstandene dynamische Objektzugriff, ohne eine zusätzliche Security-Ausnahme einzuführen.

Vorhandene Datenbanken, Archivdaten und Kundeneinstellungen werden durch diesen Fix nicht bereinigt oder überschrieben. Bereits falsch erfasste historische Punkte werden damit nicht rückwirkend korrigiert. Die Auflösung bleibt durch Exportintervall und gewählte Datenbank-Aggregation begrenzt: Ein Fehler zwischen zwei Exporten lässt sich daraus nicht sekundengenau rekonstruieren. Bei älteren oder manuell auf `changesOnly=true` geänderten kanonischen Archivierungen können echte konstante Abschnitte ebenfalls Lücken enthalten; diese unbekannten Daten werden nicht nachträglich erfunden. Eine reale Influx-Serverabfrage und Hardware-Ausfallmessung wurden hier nicht durchgeführt. Tarif-Abfrageinterpolation ist wegen ihres abweichenden On-Change-Vertrags kein Teil dieses Leistungsreihen-Fixes.

## Neue Regressionen

`test/eos-history-measurement-integrity.test.cjs`: 9 Tests, jeweils 9 bestanden / 0 fehlgeschlagen unter Node 22 und Node 24.

1. Fehlende/alte Ableitung → gültige direkte PV-/Verbrauchsmessung; echte 0 bleibt führend.
2. Bereits zusammengeführte DC-PV wird nicht doppelt gezählt; AC+DC-Ersatz bleibt nutzbar.
3. Farm-PV wird einmal zusammengeführt; unbekannter/alter SoC wird nicht zu 0 %.
4. Null/Boolean/Leerpreis → konfigurierter Festpreis, kein kostenloser Providerpreis.
5. Stale-Flag, abgelaufener/falscher Zeitstempel und Qualität blockieren Tarifübernahme; manuelle Tarifwahl bleibt erhalten.
6. Echte Null-/Negativpreise einschließlich −8,5 EUR/kWh und Netzentgeltanteil bleiben exakt.
7. Fehlende Netz-/Batterie-/PV-Daten erzeugen keine neuen fiktiven Nullmessungen.
8. Alte Rohwerte und Farmaggregate werden nicht in neue History-Messungen umgewandelt.
9. Sink verwirft ungültige Eingaben und akzeptiert echte 0/negative Messwerte.

Rohbelege der gezielten Nachprüfung liegen vor Erstellung des Gesamtbelegs unter `audit-919/history/node22-after.log`, `node24-after.log`, die Ausgangsrepros unter `node22-repro.log`, `node24-repro.log`. Der Hauptprüflauf und der generierte Runtime-Abgleich werden zentral durchgeführt und getrennt ausgewiesen.

## Ergänzende API-/Darstellungsregressionen

`test/eos-history-api-stability.test.cjs` führt den tatsächlichen produktiven Handler mit kontrollierten Transportantworten aus. Drei neue Fälle prüfen kanonische Ausfälle samt Erholung auf echte 0, ein konfiguriertes 30-Minuten-Exportintervall und unvollständige Ladepunktsummen. Die bestehenden Tests für alte Sparse-Mappings, 200 Ladepunkte, Zeitbudgets und Reihenbegrenzungen bleiben unverändert erfolgreich.

`test/eos-history-chart-gaps.test.cjs` führt die tatsächlichen Frontend-Funktionen mit einem aufzeichnenden Canvas aus. Fünf Fälle prüfen Nullwertabbildung, Leistungs-/SoC-Linienunterbrechung, getrennte Flächenpolygone, Energieintegration ohne künstliche Rampen und Erhalt von Lückenmarkierungen für die Kostenintegration. Dies ist ein Funktionsnachweis, kein Browser-Screenshot-Test.

Die drei neuen API-Fälle und fünf Frontend-Fälle schlagen gegen den unveränderten 9.0.19-Quelltext fehl. Nach der Korrektur bestehen zusammen mit den neun Writer-Fällen **34/34 Tests unter Node 22 und Node 24**. Belege: `api-gaps-before.log`, `chart-gaps-before.log`, `history-followup-node22.log`, `history-followup-node24.log` im oben genannten Audit-Verzeichnis.

## Abschließende Negativpreis- und Zugriffstests

`test/eos-history-negative-pricing.test.cjs` ergänzt sechs tatsächliche Frontend-Funktionstests: gemischte Viertelstunden mit negativen/Null-/positiven Preisen, unveränderter Festtarif, unterschiedliche Zeit-/Energiemittelung, negative Basispreisableitung bei positivem Netzentgelt, unbekannte Preise und signierte Canvas-Achsen. Vier Fehlerfälle scheitern gegen 9.0.19; zwei unveränderte Verhaltensfälle bestehen bereits dort. Zwei weitere Tests im echten History-API-Handler prüfen −8,5/−0,1/0/+0,35 EUR/kWh und ungültige manuelle Preiswerte. Beide scheitern im Ausgangsstand.

Ein zusätzlicher Writer-Test führt absichtlich geerbte Datensätze sowie Getter an Cache-Eintrag, Wert, Zeitstempel und Qualität ein. Kein Getter wird aufgerufen; die gültige eigene Ersatzmessung bleibt verwendbar.

**Finaler gezielter Stand: 43/43 Tests unter Node 22 und Node 24**, jeweils ohne Fehler. Belege: `history-final-node22.log`, `history-final-node24.log`, `negative-pricing-before.log`, `api-negative-before.log`. Die separate Route `/api/tariff/report` wird durch einen anderen Teilprüflauf bearbeitet und ist nicht in diesen 43 Tests enthalten.

Die abschließende Prüfung von `www/history.ts` mit dem tatsächlichen UI-ESLint 10.13.0 und der unveränderten Gate-Auswertung liefert 76 bestehende erfasste Fundstellen und **0 neue blockierende Fundstellen**. Neue Objektzugriffe wurden durch feste Kernreihen-/Energieauswahl ersetzt; Integer-Schleifen lesen Arrays über begrenzte `.at()`-Positionen. Keine Baseline oder Ausnahme wurde ergänzt. Beleg: `history-eslint-final.json`. Die 43 Tests wurden nach diesen Änderungen unter beiden Node-Versionen erneut erfolgreich ausgeführt.
