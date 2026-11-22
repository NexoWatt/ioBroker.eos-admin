# Dynamischer Netzanschluss: gemeinsamer PV-Finalwriter

Stand: 23.10.2026. Bestandteil der eigenen App `dynamicGrid`, Konfiguration
`dynamicGridConnection`; gemeinsamer Vertrag in [DYNAMIC_GRID_CONTRACT.md](DYNAMIC_GRID_CONTRACT.md).

## Aufgabe und Zuordnung

`ems/services/dynamic-grid-pv.ts` verwendet den vorhandenen
`resolveZeroExportPvTarget` für die Umrechnung von Exportgrenze in zulässige
Generation und `computePvLimit` für das Minimum gültiger Generation-Vorgaben.
Es gibt keine Herstellerliste. Jede PV-Zeile besitzt eine eindeutige Kennung,
den physischen Anschlussbereich M0 oder M1, die AC-Bezugsleistung in W, einen
eigenen Istleistungsdatenpunkt und genau einen Generation-Ausgang in W oder %.
`command.scale` bedeutet W beziehungsweise Prozentpunkte pro Rohwert. Eine
Netzexportgrenze `feedInLimitW` ist ausdrücklich kein solcher Ausgang.

`evuControl: true` ordnet diesem Wechselrichter die vorhandenen Relais der
EVU-Regelung (`gridConstraints.pvEvuRelay60Id/30Id/0Id`) zu. Andere Wechselrichter
werden nicht pauschal von dieser Stufenvorgabe betroffen. Der gespeicherte
Boolean und der vorhandene EVU-Aktivierungszustand bestimmen den Geltungsbereich.

M0 stammt unverändert aus Allgemein. Der gemeinsame Snapshot-Collector liefert
bei getrennten Bezug-/Einspeisewerten nur einen gültigen M0-Wert, wenn beide
Messungen frisch, numerisch und zeitlich kohärent sind. M1, Speicher- und
PV-Istleistungen werden separat mit Qualitäts- und Zeitprüfung gelesen.

## Berechnung und Übergänge

Netzbezug und Speicherentladung sind positiv; PV-Erzeugung ist ein positiver
Betrag. Je betroffenem Messpunkt wird die schlechteste Exportlage aus den
gemessenen Leistungen und allen alten/neuen Speicherintervallen berechnet:

`Exportlage = Netz-Ist − Σ(maximale Speicherentladung − Speicher-Ist)`

`PV-Obergrenze = max(0, enthaltene PV-Ist + Exportlage + zulässiger Export)`

Zuerst wird die lokale M1-Grenze, anschließend die Gesamtgrenze M0 angewandt.
M0 enthält M1 bereits; beide Zähler werden nie summiert. Ein Speicher außerhalb
M1 kann lokale Überschüsse nicht aufnehmen. Auch die maximale Ladefreigabe eines
lokalen Speichers zählt nicht als garantierte Aufnahme.

Die strengste Grenze wird proportional auf die betroffenen Generation-Caps
verteilt und abgerundet. EVU-Grenzen werden vorher in W derselben AC-Bezugsgröße
umgerechnet. Ein stärkerer M0-Eingriff kann die lokale Grenze weiter senken,
niemals erhöhen. Nicht durch PV lösbare Restverletzungen bleiben sichtbar.
Die Importdiagnose berücksichtigt vollständigen PV-Ausfall: Ein Generation-Cap
garantiert keine Mindestproduktion und rechtfertigt keine zusätzliche Ladung.

Ein aktiver Mesh-Vertrag verschärft die M0-Exportgrenze zusätzlich. Seine
PV-Kategoriegrenze wird genau einmal auf alle App-Wechselrichter verteilt,
nicht als eigenes Budget je Gerät verwendet. Vor jedem einzelnen Write wird
der Vertrag erneut gelesen und der gemeinsame Plan geprüft. Eine zwischenzeitliche
Absenkung verwirft einen nun zu hohen Folgeauftrag; bereits abgesendete Vorgaben
bleiben reserviert und das Ergebnis meldet die unvollständige Ausgabe. Während
einer Übergabe zur alten Regelung dürfen bekannte Caps nur gehalten oder gesenkt
werden; ohne bekannte Cap gilt höchstens die frisch gemessene Generation.

Der final übernommene Befehl und die noch mögliche Generation bleiben getrennt.
Eine neue Writeabsicht wird vor dem asynchronen Gerätezugriff reserviert; auch
eine verlorene Antwort kann einen später wirksamen Befehl hinterlassen.
`pendingEffects` bleibt für die Speicherbudgetierung erhalten. Eine alte höhere
PV-Freigabe wird erst bei ausdrücklich konfiguriertem `readbackStateId` für die
angewandte Generation-Obergrenze und passender bestätigter Rückmeldung verkleinert.
Ohne diese Rückmeldung bleibt die vorherige beziehungsweise anfänglich nominelle
Obergrenze konservativ reserviert. Die tatsächliche Erzeugungsleistung wird
weiterhin ausschließlich aus dem Messdatenpunkt ermittelt.

## Ausführung und Fehlerverhalten

Der bestehende NVP-Koordinator ruft den finalen PV-Slot nach der Speicherregelung
auf. Bei aktiver App verwendet er keine globalen Single-/Farm-Sollwerte zur
Berechnung der lokalen Bilanz. Gezielte Guards und die gemeinsame Schreibhoheit
verhindern konkurrierende EVU-, Zero-Export- und Fehler-Nullbefehle des Bestands
auf App-Ausgänge. Bei ausgeschalteter App bleibt der bisherige Pfad erhalten.

Vor der Aktivierung prüft das Backend zusätzlich die Übernahme tatsächlich
aktiver bisheriger Zero-Export-Ausgänge. Es berücksichtigt denselben Vorrang der
Installerfreigaben und Diagnosemodi wie der alte Export-Guard, bei einer
WR-Gruppe alle konfigurierten Ausgänge und beim Sammelausgang nur den ausgewählten
Regelmodus. Alle betroffenen Generation-Ausgänge müssen über ihre kanonische
Alias-Schreibidentität in der neuen App zugeordnet sein. Eine fehlende Zuordnung
erzeugt eine konkrete Aktivierungsmeldung; die bisherige Regelung wird nicht
lautlos abgeschaltet. Reine EVU-Zuordnungen, ausgeschaltete Regeln und
Diagnosekonfigurationen erzwingen keine PV-Zeile in der App.

Ein bisheriger `feedInLimitW`-Ausgang kann nicht als Generation-DP übernommen
werden. Die Meldung verlangt dafür die Umstellung der bisherigen PV-Zuordnung
auf einen geeigneten Generation-Ausgang. Das verhindert eine Änderung der
physikalischen Bedeutung desselben W-Werts beim Appwechsel.

Unmittelbar vor jedem Write werden Konfigurationsgeneration, EVU-Konfiguration
und Messfrische erneut geprüft. Eine unbekannte Wirkung anderer Aktoren hält
Freigaben zurück; bekannte Lastreduktionen werden konservativ berücksichtigt.
Ein veraltetes EVU-Signal hält höchstens die letzte übernommene Cap. Beim Start
ohne gültige EVU-Stufe und ohne bekannte Cap erfolgt kein 100-%-Ersatz.
Eine frische strengere EVU-Vorgabe bleibt auch bei ausgefallenen Netz-/PV-Messungen
anwendbar; aus unbekanntem Altwert gilt dies nur für die explizite Nullstufe.
Diese Ausnahme erzeugt keine Freigabeerhöhung und meldet die fehlende Bilanz weiter.

Die Datenbankwartezeit beträgt höchstens 1500 ms. Da die ioBroker-Lese-API keinen
Abbruchvertrag bietet, bleibt eine abgelaufene Anfrage bis zu ihrem tatsächlichen
Abschluss als laufend markiert. Folgezyklen erzeugen keine parallelen Ersatzjobs.
Timeout, Messfehler und Konfigurationswechsel werden als Haltezustand veröffentlicht.

`accepted` bezeichnet eine übernommene Ausgabe. `applied` bleibt hier ausdrücklich
`false`: ACK, Sollwert-Rückmeldung und Mocktest sind kein Nachweis einer gemessenen
physischen Wirkung oder einer eingehaltenen Anschlussgrenze.

## Prüfvermerk

Geprüfte Komponenten: PV-Service, dynamischer Zweig des NVP-Koordinators,
Legacy-PV-Schreibguards. Testumgebung: Node.js 24.19.0, Linux, TS-Quellen direkt
transpiliert; keine Geräte oder Anlagenadapter angeschlossen.

- `node --test test/dynamic-grid-pv.test.cjs`: 34/34 Prüfungen bestanden.
- Strenge TypeScript-Prüfung von `dynamic-grid-pv.ts` und `nvp-coordinator.ts`
  mit `--noEmit --strict --noUncheckedIndexedAccess --skipLibCheck --target ES2022 --module NodeNext
  --moduleResolution NodeNext --moduleDetection force`: bestanden.
- Abgedeckt: herstellerfreie Mappings, fehlerhafte Eingaben/physische Duplikate,
  lokale und gemeinsame Grenzen, alte/neue Speicherintervalle, PV-Ausfall,
  EVU 60/30/0 und Frischeverlust, Split-M0, Konfigurationsrennen, Timeout mit
  Einzelauftrag, Writeabsicht-Reservierung, explizite Cap-Rückmeldung,
  Fremdaktorübergänge, Legacy-Schreibsperren und vollständige physische Übernahme
  aktiver Legacy-PV-Ausgänge einschließlich Freigabe-/Diagnosevorrang,
  gemeinsame Mesh-PV-/Exportgrenzen, live abgesenkte Mesh-Freigaben und Übergabe.

Gesamtrepository-Build und Releaseprüfungen werden im übergeordneten Prüfbericht
festgehalten. Hardwareprüfung ist offen: insbesondere Einheiten/Skalierung,
EVU-Geltungsbereich, Bedeutung des angewandten Cap-Readbacks, Stellzeit und
Ausfallreaktion müssen an der konkreten Anlage überprüft werden. Kein Test hier
belegt eine Herstellerfreigabe oder eine allgemeine Produktionsfreigabe.
