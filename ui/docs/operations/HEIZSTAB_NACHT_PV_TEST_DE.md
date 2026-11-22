# Heizstab 1.0.23 – Nachtabschaltung und PV-Anlauf prüfen

Teststand: 08.10.2026, auf Basis des Sicherheits-Prüfstands 1.0.22.
Diese Anleitung begleitet den ausdrücklich vorgesehenen Eigentest auf der
laufenden Hausanlage. Sie bescheinigt keinen bereits durchgeführten Hardwaretest.

## Gewünschtes Verhalten

In **Auto** bleibt der Heizstab während des eingestellten Nachtfensters aus.
Am Ende des Nachtfensters darf die PV-Regelung wieder arbeiten. Sie schaltet
erst bei ausreichend nachgewiesener PV-Leistung ein und erhöht die Last
schrittweise. Bei weniger PV wird die Last wieder reduziert; Batterieentladung
ist keine erlaubte Quelle für den PV-Automatikbetrieb.

Die Nachtregel verwendet die lokale Uhrzeit des EOS-Controllers. Eine gleiche
Start- und Endzeit bedeutet bei aktivierter Nachtsperre eine ganztägige Sperre.
In der aktiven Auto-Nachtsperre werden auch extern eingeschaltete Relais
wieder ausgeschaltet; eine aktive Rückmeldung allein ist keine Handfreigabe.
**Manual 1/2/3 und Boost sind ausdrückliche Bedienfreigaben** und werden durch
diesen Auto-Test nicht geändert. Wer nachts generell keine Heizlast wünscht,
darf dafür keine solche Freigabe aktivieren. Temperatur- und Geräteschutz bleiben
auch bei bewusster Handbedienung erforderlich.

## Vor dem Update

1. ioBroker-Sicherung und Export der aktuellen EOS-Einstellungen anlegen.
   Vorherige Adapterversion und Installationspaket für den Rückfall bereithalten.
   Die bereits benötigte private Lizenzumgebung aus dem 1.0.22-Stand erhalten;
   keine Geheimnisse in einen öffentlichen Export oder Prüfbericht aufnehmen.
2. Betriebssystemzeit und Zeitzone des Controllers prüfen. Für eine Anlage in
   Deutschland muss die lokale Anzeige einschließlich Sommer-/Winterzeit passen.
   Uhrzeit nicht auf dem laufenden Regler zum Testen verstellen; stattdessen das
   Nachtfenster zeitweise passend einstellen und die ursprünglichen Werte notieren.
3. In der Heizstab-App **Auto** wählen, Nachtsperre aktivieren und Beginn/Ende
   kontrollieren. Aktiven Boost beenden. PV-, NVP-, Batterie-, Stufen- und
   Temperaturmessungen auf Aktualität, Einheit und Vorzeichen prüfen.
4. Die reale Leistung und Rückmeldung am Gerät beobachten können. Ein
   geschriebener Sollwert beweist keine physische Abschaltung. Unabhängiger
   Temperaturbegrenzer, Schütze und geräteeigener Rückfall müssen funktionsfähig
   bleiben. Schutzfunktionen für den Test nicht überbrücken.

## Messpunkte vor dem Auto-Start prüfen

Für neue PV-Prüflasten benötigt der Heizstab eine **echte aktuelle
Leistungsmessung in W** im zugehörigen Energiefluss-Verbraucherslot. In der
Heizstab-App zeigt die Zeile **„Leistungs-DP: ✓“** die vorhandene Zuordnung an;
**„Leistungs-DP: fehlt“** muss vor dem Test behoben werden. Der Haken prüft noch
nicht die Aktualität oder Richtigkeit der Messwerte. Die Summe konfigurierter
Stufenleistungen, ein Relais-EIN, ein Schreibsollwert oder eine Leistungsschätzung
ersetzen die Messung nicht. Auch bei ausgeschaltetem Heizstab muss der echte
Messkanal seinen aktuellen Nullwert liefern können.

| Nachweis | Höchstes zulässiges Alter für die PV-Freigabe |
| --- | --- |
| Tatsächliche PV-, Netzpunkt-, Batterie- und Heizstab-Leistungsmessung | 5 Sekunden; echte numerische Werte mit nachvollziehbarer Messzeit. |
| Interner Prognose-Snapshot | 60 Sekunden. |
| Ursprüngliche Prognose-Quelldaten | 2 Stunden; allein keine Freigabe zum Heizen. |

Ist die Heizleistung unbekannt oder veraltet, bleibt ein neuer Startversuch
mit **`heating_power_unknown`** gesperrt. Diese Prüfung gilt nun auch für den
älteren Forecast-Pfad. Langsam meldende Geräte brauchen eine passende reale
Messaktualisierung; ein größeres Stale-Timeout oder ein künstlich erneuerter
Heartbeat macht einen alten Wert nicht frisch. Fehlende Batteriemessung darf
nicht als bestätigte Nullentladung eingetragen werden. Ohne die erforderlichen
Nachweise kann der bisherige Auto-Start deshalb bewusst ausbleiben.

Ausreichend gemessene aktuelle PV darf hingegen auch ohne Wetterprognose genutzt
werden. Die Prognose ist eine Hilfsinformation und kein Ersatz für die
tatsächlichen Leistungswerte.

## Kurzer Funktionslauf

Die Heizstabseite zeigt **„Nachtpause“** und **„Nachts gesperrt · Automatik ab
HH:MM“**, wenn die Regelung den Nachtblock meldet. Ein Rest-Istwert oder eine
ausstehende beziehungsweise fehlgeschlagene Rückmeldung ergänzt **„Abschaltung
noch nicht bestätigt“**. Bei gleicher Start-/Endzeit erscheint **„Ganztägige
Automatik-Sperre“**. Tagsüber bedeutet **„PV-Leistung/Prognose noch zu gering“**,
dass weiterhin keine passende PV-Freigabe vorliegt. Diese Hinweise ersetzen
keine Kontrolle der tatsächlichen Geräteleistung.

| Schritt | Durchführung | Erwartung / festzuhalten |
| --- | --- | --- |
| Nachtbeginn | Eine automatisch laufende Stufe beobachten und den Beginn des Nachtfensters abwarten. | Auto fordert AUS an, auch wenn die Mindestlaufzeit noch nicht abgelaufen ist. Keine erneute Auto-Hochschaltung im Nachtfenster. Tatsächliche Leistung und Stufenrückmeldung müssen AUS bestätigen. |
| Langsame Rückmeldung | Wenn das reale Gerät verzögert zurückmeldet, Soll und Ist getrennt verfolgen. | Ein noch aktiver Istwert wird nicht als neue Handfreigabe behandelt. Die AUS-Anforderung bleibt wirksam; „Soll 0“ allein gilt nicht als bestätigtes AUS. |
| Fehler / Neustart | Einen Kommunikationsfehler nur über eine dafür vorgesehene Testmöglichkeit prüfen; danach Adapterneustart im Nachtfenster und Rückkehr der Verbindung beobachten. | Keine automatische Heizfreigabe durch Fehler, alte Rückmeldung oder Neustart. Nach Rückkehr muss die Nachtabschaltung erneut am erreichbaren Gerät wirken. Bei fehlender Kommunikation ist die physische Abschaltung nicht durch EOS garantiert. |
| Morgen ohne PV | Ende des Nachtfensters bei fehlender oder unzureichender PV abwarten. | Auto ist wieder freigegeben, der Heizstab bleibt mangels PV aus. Kein Einschaltbefehl allein aufgrund der Uhrzeit. |
| Morgen mit PV | Steigende reale PV und Heizstabstufen beobachten. | Nur schrittweises Zuschalten; jeder weitere Schritt benötigt erneut ausreichende Messwerte/Freigaben und die vorgesehenen Wartezeiten. Keine volle Leistung sofort zum Tagesbeginn. |
| Wolken / Batterie | Einen natürlichen PV-Einbruch und die Batterie-Istleistung beobachten. | Die Automatik reduziert die Heizlast bei unzureichender PV. Batterieentladung wird nicht als PV-Budget angerechnet; keine dauerhafte batteriebetriebene Heizlast. |
| Rückkehr der PV | Nach dem Einbruch stabile PV abwarten. | Geordneter schrittweiser Wiederanlauf; keine schnelle Folge wechselnder Relaisbefehle. Temperatur-, Netz- und Gerätegrenzen gelten weiter. |

Bei Nulleinspeisung kann am Netzpunkt 0 W anliegen, obwohl der Wechselrichter
noch abgeregelte PV erschließen könnte. Die bestehende gemeinsame PV-Strategie
kann dafür eine begrenzte Prüflast erlauben. Diese ist kein Nachweis bereits
vorhandener PV und kann kurzzeitig Netz-/Speicherenergie beanspruchen. Wenn auch
solche Transienten unzulässig sind, die zusätzliche PV-Prüflast auf **0 W** setzen;
dann kann der automatische Start bei vollständig abgeregelter PV ausbleiben.
Keinen dauerhaften Batterieeinsatz als normale PV-Regelung akzeptieren.

## Ergebnis und Rückfall

Für eine Rückmeldung genügen Adapterversion, Geräte-/Relaismodell,
Firmware-/ioBroker-Version, lokale Testzeit und Nachtfenster sowie Soll-/Ist-Stufe,
gemessene Heizleistung, PV-, Netz- und Batterieleistung und der angezeigte
Statusgrund. Kleine bereinigte Logausschnitte ergänzen; keine Tokens,
Lizenzdateien oder Zugangsdaten mitsenden.

Bleibt der Heizstab trotz Nacht-AUS tatsächlich an, den Test beenden und den
vorgesehenen geräteseitigen AUS-Weg nutzen. Ursache anhand der Rückmeldung und
Zuordnung prüfen; ein grüner UI-Status ersetzt die Messung nicht. Bei einem
Adapterfehler den dokumentierten vorherigen Stand und dessen passende
Konfiguration wiederherstellen. Ein Downgrade ersetzt keine Anlagenkontrolle.

Prüfstand und offene Punkte: [Prüfvermerk](../reports/heating-rod-2026-10-08/PRUEFVERMERK_DE.md).
Einrichtung: [Nulleinspeisung](../NULL_EINSPEISUNG_EINRICHTUNG_DE.md).
