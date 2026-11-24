# Geräte und EMS gemeinsam einrichten – 9.0.19

Die Aufgabe eines unterstützten Geräts wird im Gerätefenster festgelegt. „Speichern und übernehmen“ oben auf der Geräteseite speichert die Gerätekonfiguration und beauftragt die passende EMS-Einrichtung. Ein zweites Einrichten derselben Datenpunkte im App-Center ist bei vollständig unterstützten Geräteprofilen nicht erforderlich. Das App-Center zeigt die Ergebnisse und bleibt für erweiterte Einstellungen verfügbar.

## Ein Ablauf für Gerät und EMS

1. Gerät hinzufügen oder bearbeiten und Verbindung sowie Geräteprofil festlegen.
2. Unter **Aufgabe & Anlagenbereich** die EMS-Funktion und – soweit erforderlich – Messpunkt oder Energiefluss-Platz wählen.
3. **Im EMS verwenden und aktivieren** einschalten. Bei Speichern und Ladepunkten die zutreffenden **Betriebsgrenzen** angeben. Neue Geräte benötigen diese Grenzen; EOS nimmt keine unbegrenzte Leistung an.
4. Das Gerätefenster speichern. Anschließend oben **Speichern und übernehmen** wählen. Damit werden die vorgesehenen Zuordnungen und benötigten EMS-Apps gemeinsam eingerichtet.
5. Den Status des einzelnen Geräts beachten. **EMS eingerichtet** bestätigt die Konfigurationsübernahme und App-Freigabe; es bestätigt noch keinen tatsächlichen Energiefluss. Die Regelung wartet weiterhin auf gültige Messwerte, Verbindung und wirksame Schutzfreigaben.

Die Geräteansicht fragt den Status automatisch ab. Bei noch laufender Vorbereitung folgen höchstens 30 weitere Abfragen im Abstand von 2,5 Sekunden; Netzwerkzeiten kommen hinzu. Danach kann „Zuordnungsstatus aktualisieren“ erneut abfragen. Statusabfragen überschreiben keine ungespeicherten Formulareingaben.

## Profilfunktionen erkennen

Im Gerätefenster stehen kompakte Hinweise wie **Leistungsmessung**, **Ladezustand**, **Energiemessung** oder **Leistungsvorgabe**. Sie stammen aus ausdrücklich deklarierten Datenpunkt-Rollen und Zugriffsarten des geladenen Profils. In der Geräteliste sind sie unter **Profilfunktionen** aufklappbar. Eine Kategorie oder ein Herstellername allein erzeugt keinen Fähigkeitshinweis. Die Chips bestätigen weder erfolgreiche Kommunikation noch eine Betriebsfreigabe; die tatsächlichen Alias-Datenpunkte und die EMS-Verwendbarkeit werden beim Übernehmen gesondert geprüft.

## Welche Felder gehören zu welchem Gerät?

| Gerät / Aufgabe | Auswahl auf der Geräteseite | Weitere Angaben |
| --- | --- | --- |
| Netzanschlusszähler | **Regelpunkt NVP · Netzanschlusszähler**, dann **M0 · Regelpunkt NVP / Hauptanschluss** oder **M1 · Unteranlage** | M0 ist der zentrale Netzverknüpfungspunkt. M1 ist eine separate Messung der Unteranlage. |
| Erzeugungszähler | **Erzeugungszähler**, vorhandenen Energiefluss-Platz wählen | PV-Hauptanlage oder eine der fünf weiteren Erzeugungsanlagen. |
| Verbrauchszähler | **Verbrauchszähler**, Verbraucher 1–10 wählen | Ein Verbrauchsmesswert macht aus dem Zähler keinen steuerbaren Verbraucher. |
| PV-Wechselrichter | **PV-Wechselrichter / Erzeugungsanlage**, Energiefluss-Platz wählen | Ein Platz steht für eine Messquelle. Er ist keine automatische Summierung mehrerer Wechselrichter. |
| Einzelner Speicher | **Einzelspeicher**, Regelbereich | Maximale Lade- und Entladeleistung in W, AC-/DC-Anbindung; Kapazität in kWh optional. |
| Mehrere Speicher | Je Gerät **Speicherfarm-Mitglied**, Regelbereich | Je Speicher eigene Lade-/Entladegrenzen, passende Anbindung und gegebenenfalls Kapazität. Die vorhandene Speicherfarm wird verwendet. |
| Unterstützte AC-Wallbox | **Automatisch nach Geräteprofil**, **AC-Wallbox** | Phasenanzahl 1 oder 3, minimaler und maximaler Ladestrom in A. |
| Unterstützter DC-Ladepunkt | **Automatisch nach Geräteprofil**, **DC-Ladepunkt** | Minimale und maximale Ladeleistung in W. |
| Messwerte ohne verwaltete Regelung | **Nur Messwerte** | Automatisch verwaltete Steuereinträge dieses Geräts werden deaktiviert; Zuordnungen und Grenzen bleiben erhalten. Andere manuelle Einträge werden nicht umgeschaltet. |
| Bewusst externe/manuelle Zuordnung | **Manuell im App-Center zuordnen** | Vorhandene manuelle Zuordnungen und Freigaben bleiben erhalten. Diese Auswahl beendet keine bestehende manuelle Regelung. |

Bereits gültige Grenzen bestehender EMS-Einträge bleiben vorrangig erhalten. Die Gerätefelder ergänzen fehlende oder ungültige Grenzen; sie überschreiben keine später im App-Center geänderten gültigen Kundenwerte. Fehlen auch dort Werte, bleibt die EMS-Einrichtung mit einer konkreten Meldung offen. Im Gerätefenster ergänzen und erneut übernehmen. Eine Zahl wie `10000` gehört in ein Leistungsgrenzen-Feld; sie ist kein Messwert-Datenpunkt.

M1-Speicherregelung benötigt weiterhin die Prüfung der vorhandenen Anlagentopologie. Die Auswahl einer M1-Messung behauptet keine automatische M1-Aktorregelung.

## Beispiel: SMA-Zähler sowie FENECON und SolaX als Farm

Beim SMA-Zähler die Funktion **Regelpunkt NVP · Netzanschlusszähler** und **M0 · Regelpunkt NVP / Hauptanschluss** auswählen. Bei jedem unterstützten Speicher das passende Herstellerprofil und **Speicherfarm-Mitglied** wählen; Regelbereich, reale Lade-/Entladegrenzen und passende Anbindung angeben. Bei allen vorgesehenen Geräten die EMS-Verwendung einschalten und anschließend gemeinsam übernehmen.

EOS verwendet die tatsächlich vorhandenen und geprüften AliasV1-Datenpunkte des jeweiligen Profils. Herstellername allein genügt nicht: Kann ein Modell die benötigten Mess- oder Steuerfunktionen nicht bereitstellen, nennt der Gerätestatus die fehlenden Funktionen. Nicht durch Fantasie-Datenpunkte oder unbegrenzte Leistungswerte ersetzen. Die fachliche Geräte-/Regelprüfung vor Ort bleibt erforderlich.

PV-Erzeugungszähler und Wechselrichter derselben Anlage dürfen nicht dieselbe Energie doppelt zählen. Belegte Ziele und bereits vorhandene gültige manuelle Zuordnungen werden auf Konflikte geprüft. Erkannte, profilbestätigte Korrekturen werden am einzelnen Gerät als „Angepasst“ benannt; optionale Profilhinweise sind aufklappbar.

## Status richtig lesen

| Anzeige | Bedeutung / nächste Aktion |
| --- | --- |
| EMS eingerichtet | Auftrag wurde übernommen und die erforderliche App-Konfiguration freigegeben. Gültige Messwerte und Schutzfreigaben bleiben Voraussetzung für die tatsächliche Regelung. |
| Zugeordnet | Zuordnung besteht; vorhandene Freigaben bleiben erhalten. |
| Einrichtung offen | Benannte Grenzen, Aufgabenwahl oder Funktionen im Gerätefenster ergänzen und übernehmen. |
| Zuordnung wird geprüft / Gerät ohne EMS-Rückmeldung | Der Status ist noch nicht vollständig. EOS fragt automatisch nach; es wird keine erfolgreiche Freigabe vorgetäuscht. |
| EMS-Zuordnung fehlgeschlagen | Konkrete Verbindungs-/Betriebsmeldung und EOS-Protokoll prüfen. Gespeicherte Geräteeinstellungen bleiben erhalten. |
| Zuordnungskonflikt | Vorhandene Zuordnung oder Regelzuständigkeit prüfen. Kein blindes Überschreiben. |
| App wurde deaktiviert | Eine frühere Freigabe wird durch Neustart oder unbeteiligte Änderungen nicht wiederholt. Für eine ausdrückliche neue Gerätefreigabe EMS-Verwendung im Gerätefenster aus- und wieder einschalten, das Gerätefenster speichern und übernehmen. |
| Profilhinweise | Optionale herstellerabhängige Funktionen; aufklappen, wenn Details benötigt werden. Fehlende Pflichtfunktionen stehen weiterhin direkt im Status. |

Ein Übernahmeauftrag erhält eine eindeutige Kennung. Ein erneuter Versuch nach einer unklaren Netzwerkantwort verwendet denselben Auftrag; Umbenennungen und andere unbeteiligte Änderungen erzeugen keine neue Freigabe. Gespeicherte Einstellungen, Zugangsdaten und unberührte Erweiterungsfelder bleiben erhalten.

## Nachweise und Grenzen dieses Arbeitsstands

- Automatisierte UI-Logiktests prüfen Auswahl, Statusdarstellung, fehlende/teilweise API-Ergebnisse, begrenzte Statusabfragen, Auftragserneuerung und unveränderte Formulareingaben.
- Ein HTTP-Vertragstest führt die echten Browser-Skripte in einer DOM-Testumgebung gegen Express-Routen, EOS-Sitzung/CSRF, Modulhost, Konfigurationsspeicherung und Gerätevalidator aus. Er prüft gemeinsames Speichern, erhaltene Geheimnisse, gleichbleibende Auftragskennung bei Umbenennung sowie automatische Statusaktualisierung. Hardware und der abschließende EMS-Dienststatus sind dabei isolierte Testkomponenten.
- Der Chromium-Lauf konnte in dieser Arbeitsumgebung nicht starten: `socket() failed: Operation not permitted` beim Browser-Profil-Lock. Deshalb liegen für diesen Stand keine geprüften Desktop-/Smartphone-Screenshots oder ein visueller Browsernachweis vor.
- Kein Test dieses Dokuments ersetzt einen Versuch mit realen SMA-, FENECON-, SolaX- oder Ladegeräten und der tatsächlichen Anlagenkonfiguration.

## Gesamtübersicht der Speicherfarm

Im App-Center unter **Speicherfarm → Farm-Gesamtübersicht öffnen** führt ein direkter Link im selben Tab zur Kundenansicht. Sie zeigt sechs kompakte Gesamtwerte und die Zahl aktueller Mitglieder:

- **Gesamtkapazität** aller aktiv konfigurierten Farmmitglieder. Fehlt eine Kapazität, heißt die Anzeige **Bekannte Kapazität** und nennt die Abdeckung.
- **Ø Ladezustand** als arithmetischer Mittelwert der gültigen aktuellen SoC-Werte. Bei fehlenden Werten steht ausdrücklich **Teilmittel** mit `X / Y`; es ist kein nach Kapazität gewichteter Ladezustand.
- **Batterieleistung netto**, **Ladeleistung gesamt** und **Entladeleistung gesamt**. Gleichzeitiges Laden und Entladen verschiedener Speicher wird in den beiden Bruttowerten getrennt sichtbar. Die Nettosumme beschreibt die physische Batterie und verwendet keine ersatzweise Regler-/Umrichterleistung.
- **PV-Leistung gesamt** aus den konfigurierten eindeutigen PV-Quellen. Mehrfach verwendete Quellen werden serverseitig geprüft und dedupliziert. Ohne PV-Zuordnung wird kein erfundener Nullwert angezeigt.

Für Leistungssummen müssen alle zugehörigen Messungen gültig vorliegen. Andernfalls bleibt der Zahlenwert offen und die Kachel nennt die unvollständige Abdeckung. Die Übersicht verarbeitet einen zusammenhängenden `storageFarm.overviewJson`-Stand, damit Zahlen und Abdeckungsangaben zusammenpassen. Die bisherigen Einzelzeilen bleiben erhalten.

Bei Verbindungsverlust oder einer über 30 Sekunden alten Gesamtübersicht verschwinden die aktuellen Leistungs-/SoC-Zahlen. Die zuletzt bestätigte Kapazitätskonfiguration darf als solche sichtbar bleiben. Diese Anzeige ist lesend und verändert weder Freigaben noch Grenzen oder Regelung.

Zusätzlicher Nachweis: Fünf automatisierte DOM-/Vertragstests prüfen die Darstellung einschließlich der Ausgabe der tatsächlichen Aggregationsfunktion: gegenläufige Batterieflüsse, vollständige/teilweise Messabdeckung, Kapazitäten, arithmetisches SoC-Mittel, echte Nullwerte, veraltete Daten, Verbindungsverlust und unabhängig gezählte PV-Quellen. Ein visueller Chromium-Nachweis und reale Anlagenmessungen bleiben davon getrennt.

## Tibber: Viertelstunden und sichtbarer aktueller Preis

Im Kundenbereich unter **Einstellungen → Dynamischer Stromtarif** bleibt die bestehende Tibber-Verbindung erhalten. Für die Verwendung auf dieser EOS-Anlage muss **Diese Preise im EOS verwenden** ausgewählt sein. Der Abruf und die Anzeige eines bestätigten Preises benötigen keine Aktivierung der Tarifoptimierung; die bewusste Freigabe der Regelung bleibt getrennt.

Der Preisverlauf zeigt die vom Anbieter gelieferten Intervalle. Tibber wird in dieser Version mit Viertelstundenauflösung abgefragt; echte 15-Minuten-Preise werden nicht mehr zu Stundenpreisen gemittelt. Ein normaler Tag umfasst 96 Intervalle, die europäischen Sommerzeit-Wechseltage 92 beziehungsweise 100. Fehlende Preise für morgen ersetzen oder löschen die heutigen Werte nicht. Stundenreihen anderer Quellen bleiben als Stundenreihen erkennbar; EOS erfindet daraus keine Viertelstundenpreise.

Ein tatsächlicher Preis von 0 oder ein negativer Preis wird angezeigt. Fehlende, ungültige oder veraltete Preise sowie ein Verbindungsabbruch erscheinen dagegen als **--**. Die eigene Anbieterquelle ist in EUR/kWh definiert und wird auch bei ungewöhnlich hohen Preisen nicht anhand ihrer Größe in Cent umgedeutet. Vorhandene manuelle Zuordnungen bleiben maßgeblich; eine ausdrücklich hinterlegte Einheit ct/kWh wird in EUR/kWh umgerechnet.

Nachweis der Anzeige: `node --test test/eos-tariff-display.test.cjs` führt die tatsächlichen Dashboard-, Tooltip- und Canvas-Funktionen mit simuliertem DOM aus; ein Fall verwendet die reale Tarifprovider-Publikation. Acht Fälle prüfen Intervalltreue, Sommerzeit, abgeschaltete Optimierung, Null-/Negativpreise, Quellwahl und Verbindungsverlust. Dies ist kein Test mit einem echten Tibber-Kundenkonto und kein visueller Browser- oder Smartphone-Nachweis.


## Gerätestart und Zuordnung getrennt erkennen

Die Geräteseite zeigt **gespeicherte Konfiguration**, **Laufstatus des Gerätemoduls** und **EMS-Zuordnung** getrennt. Eine Startfreigabe (`READY`) bedeutet noch nicht, dass die Gerätekommunikation läuft. Ein erfolgreicher Zuordnungsauftrag bestätigt ebenfalls keine frischen Messwerte. Bei einem fehlgeschlagenen Start erscheint die Ursache als verständliche Statusmeldung; Geräte und ungespeicherte Eingaben bleiben erhalten.

Solange die Seite sichtbar und das gespeicherte Modul aktiviert ist, wird der Laufstatus regelmäßig gelesen: während der anfänglichen Start-/Zuordnungsphase zügiger, danach höchstens alle zehn Sekunden nach der vorherigen Antwort. Verbergen oder Verlassen der Seite beendet den geplanten Statusabruf. „Status aktualisieren“ liest den aktuellen Zustand, ohne den Geräteentwurf neu zu laden. Eine gemeldete Verbindung von mindestens einem Gerät ersetzt die Prüfung der Messwertfrische der einzelnen Geräte nicht.

Zusätzlicher Nachweis: Der reale HTTP-/Sitzungs-/Modulhost-Vertrag und die tatsächlichen Browserhelfer werden in `test/eos-module-device-save.test.cjs` über Startfreigabe → Startfehler → laufendes Modul ohne Messdaten → gemeldete Verbindung geprüft. Der ungespeicherte Entwurf und der eigene Änderungsstatus bleiben dabei erhalten; Statusabrufe schreiben keine Konfiguration.
