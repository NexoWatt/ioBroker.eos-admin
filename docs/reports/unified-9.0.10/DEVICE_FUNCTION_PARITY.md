# Geräte- und Bedienfunktionsabgleich für EOS 9.0.10

Stand: 23.11.2026. **Anforderungs- und Lückeninventar, keine Implementierungsfreigabe.** Der Vergleich beschreibt EOS 9.0.9 vor dem neuen Ausbau. Eine vorhandene generische Kachel wird als Wiederverwendung ausgewiesen; sie beweist keine vollständige Funktionsgleichheit eines zusammengesetzten Gerätes.

## Referenz und Vollständigkeit

Nutzerarchiv `ioBroker.devices-master.zip`, Paketversion **4.4.0**, SHA-256 `a0166efec63ae7e5dc5ce3d25d41e60a321f7f58444c127c2cc4c9535a46ba2f`, MIT. Die Herkunft und Lizenzaufbewahrung stehen in [DEVICE_UI_REFERENCE.md](../unified-9.0.9/DEVICE_UI_REFERENCE.md). Maßgeblich sind die tatsächlich verdrahteten Typen in `src-admin/src/WidgetsManager/Category.tsx`, nicht nur exportierte Dateinamen.

**51 erkannte eingebaute Gerätetypen, 10 eingebaute Custom-Typen und 2 getrennte Erweiterungstypen** sind erfasst. Die maschinenlesbare [DEVICE_FUNCTION_PARITY.json](DEVICE_FUNCTION_PARITY.json) enthält alle Slotlisten, Schreibsemantiken, Funktionen, Quellen, EOS-Zuordnungen und Lücken. Die Typmenge wurde automatisiert gegen den tatsächlichen `getWidgetComponent`-Dispatch abgeglichen.

Die Referenz deklariert `@iobroker/type-detector ^6.2.0`; EOS 9.0.9 verwendet **5.0.10**. Slotnamen wie `SET`, `ACTUAL`, `POWER` sind semantische Detector-Slots, keine universellen Hardware-Rollen. `common.role`, Typ, Einheit, Wertebereich, Schrittweite, `common.states` und Lese-/Schreibflags stammen vom tatsächlich zugeordneten ioBroker-Objekt. Die vollständigen Pattern-Definitionen von Detector 6.2 liegen nicht im hochgeladenen Quellarchiv und werden hier nicht erfunden.

## Zuerst zu beheben

- **TD_MEDIA_NAME (P0):** EOS führt `mediaPlayer`, der Detector liefert tatsächlich `media`. Dadurch wird das Mediengerät bereits über `allowedTypes` ausgeschlossen. `media` auf `player` abbilden und den alten Alias bei Bedarf erhalten.
- **TD_FIRST_ONLY (P1):** EOS übernimmt je Wurzel nur das erste passende Detector-Ergebnis. Alle unterstützten Ergebnisse durchlaufen lassen und danach über stabile Identität und den bestehenden Dublettenabgleich bereinigen.
- **TD_VERSION (P1):** Im installierten Detector 5.0.10 fehlen die Typen contact/coAlarm/pressure/flow/electricity/airQuality/fan/airPurifier/pump/tv/fillLevel. Das tatsächliche Pattern-Paket 6.2 und sein kontrolliertes Upgrade prüfen; eine neue Typdeklaration allein genügt nicht.
- **TD_DROPPED_FIELDS (P1):** Bisherige Vorschläge übernehmen nur Primärsensoren, grundlegende Klima-/Medienfelder, Kamera-URL und zwei gemeinsame RGB-Varianten. Sämtliche fachlich passenden Slots samt getrennten Lese-/Schreibmetadaten erhalten.
- **UI_GUARDS (P0):** Eine Frontend-Bestätigung oder ein erkannter Typ verleiht keine Schreibrechte. Gerät, Aktion, Datenpunkt, Typ, Enum, Grenzen, Rolle und Lizenz werden serverseitig geprüft; die vorhandenen Schutzfunktionen bleiben erhalten.
- **ROLE_SOURCE (P1):** Detector-Slots sind keine universellen Hardware-Rollen. Tatsächliche `common.role/unit/type/read/write/min/max/step/states` übernehmen und externe Pattern-Definitionen gesondert prüfen.

Priorität P0 bedeutet hier zuerst zu klärende Befehls-/Sicherheitssemantik, keine pauschale Aussage über die Kritikalität eines Kundenfehlers. Für die Umsetzung zuerst Schloss/Tor, STOP/Lamellenbefehle, Kamera-Steuerung, Dual-Klima und sichere Aktionszuordnung definieren; danach Verbundgeräte, Farbkodierungen, TV, Mehrfachsensorik und Custom-Ansichten.

## Erkannte eingebaute Gerätetypen

Alle Quellen in der folgenden Tabelle beginnen mit `src-admin/src/WidgetsManager/Widgets/`. Die JSON-Datei enthält die exakten Lese- und Schreibslots je Typ; optionale nicht zugeordnete Slots erzeugen keine Bedienelemente.

| Referenztyp → Datei | Bedienumfang | EOS 9.0.9 wiederverwendbar | Fehlende oder zu prüfende Funktion |
| --- | --- | --- | --- |
| socket → Switch.tsx | Ein/Aus, getrennte Rückmeldung | switch: getrennte readId/writeId und Boolean-Bedienung | Socket-Profil und alle gemeinsamen Zusatzfunktionen vollständig zuordnen |
| light → Light.tsx | Licht Ein/Aus, aktive Lichtdarstellung | switch mit Lichtsymbol | Licht-Profil und gemeinsame Zusatzfunktionen |
| dimmer → Dimmer.tsx | Helligkeit, Ein/Aus, Presets, Feinregelung, Effektwahl, Übergangszeit | dimmer: Helligkeit, Power, Presets, +/-; manuelle Wertebereiche | EFFECT/TRANSITION_TIME, enum metadata; On-Wert/Skalierung im Profil prüfen |
| temperature → Temperature.tsx | Temperatur + optionale Feuchte, Komfortanzeige, Verlauf beider Werte | sensor: primärer Messwert | SECOND und beide Einheiten/Verläufe |
| motion → Motion.tsx | Bewegung + Helligkeit, letzte Zustandsänderung | sensor: primärer Status | SECOND und Ereignisalter |
| window → Window.tsx | Boolean offen/zu oder 0=zu,1=gekippt,2=offen; unbekannt; Änderungsalter | sensor: Rohwert/Status | Dreistufige Semantik und Änderungsalter |
| windowTilt → Window.tsx | Boolean offen/zu oder 0=zu,1=gekippt,2=offen; unbekannt; Änderungsalter | sensor: Rohwert/Status | Dreistufige Semantik und Änderungsalter |
| gate → Gate.tsx | Tor Auf/Zu/Stopp, Position/Endkontakte | blind deckt einzelne Bewegungsbefehle ab | Boolean-Torvertrag; keine numerischen Level-Writes auf SET; Endkontakte |
| blind → Blind.tsx | Position, Auf/Stopp/Ab, Bewegung stoppen, Lamellenwinkel und Lamellen-Auf/Stopp/Ab | blind: Position, Auf/Ab/Stopp, tilt, Schutzkontakte | Getrennte Lamellenimpulse; tatsächlichen Wertebereich und Polarität statt pauschal0..100 erhalten |
| blindButtons → BlindButtons.tsx | Tastenbeschattung ohne Positionssensor; optionale Lamellenbedienung | blind kann reine Auf/Ab/Stopp-Zuordnung verwenden | Lamellen-Auf/Stopp/Ab |
| button → Button.tsx | Einmaliger Auslöseimpuls, Druckanzeige, optionale Bestätigung | switch momentary und scene trigger vorhanden | Einmal true versus vorhandener true/false-Puls ausdrücklich unterscheiden; Bestätigungs-UX |
| buttonSensor → ButtonSensor.tsx | Empfangener kurzer/langer Tastendruck, steigende Flanke,1.5sHighlight, letztes Ereignis | sensor: Einzelanzeige | Zwei Ereigniskanäle und Zeit/Flankenanzeige |
| camera → Camera.tsx | Bild/Refresh, großes Kameradialogfenster, vier Schalter, PTZ | camera: URL-State/Snapshot/Live/Refresh | PTZ und Feature-Schalter, zugeordnete Schreibrechte und Dialog |
| vacuumCleaner → VacuumCleaner.tsx | Power/Pause/Home, drei Moduswahlen, Fortschritt/Phase, Batterie/Behälter/Verschleiß, Karte | Kein eigener Vertrag | Staubsaugervertrag, Return-Home, Mehrfachstatus, begrenzte Kartenbilder |
| contact → Contact.tsx | Kontaktzustand und Änderungsalter wie Window | sensor manuell | Semantisches Profil/Auto-Erkennung |
| coAlarm → CoAlarm.tsx | CO-Alarm im ACTUAL-Slot, Schweregrad/Alter | sensor manuell | CO-Profil/Auto-Erkennung |
| pressure → Pressure.tsx | Druckwert, Einheit, Verlauf | numeric sensor manuell | Auto-Erkennung/Slotbindung, Profil |
| flow → Flow.tsx | Durchflusswert, Einheit, Verlauf | numeric sensor manuell | Auto-Erkennung/Slotbindung, Profil |
| electricity → Electricity.tsx | Beliebige Kombination aus Leistung/Energie/Strom/Spannung/Frequenz; primär/sekundär+alleInfo/Verlauf | sensor: einzelne Messung | Mehrfachwerte und Auto-Erkennung |
| airQuality → AirQuality.tsx | AQI/Pollutanten+jeweiligeStufe, Risikoreihenfolge, Umgebungswerte, optionalPower | Einzelne sensor/switch-Primitiven | Kompositgerät, enum-levels ausMetadaten, optionalPower |
| lock → Lock.tsx | Verriegeln/Entriegeln, getrenntes Öffnen, Türzustand, Bestätigung pro Aktionsklasse | Kein eigener Vertrag | Semantischer Schlossvertrag samt separatem OPEN/Türkontakt und Bestätigung |
| door → Door.tsx | Türsensorzustand und Änderungsalter wie Window | sensor: Rohwert | Kontaktsemantik, kein Entriegelungsbefehl |
| floodAlarm → FloodAlarm.tsx | Wasseralarm, Zeit, optional nurbeiAlarm | sensor: primärer Status | Profil/Alter; Referenz-null=>false nicht kopieren |
| fireAlarm → FireAlarm.tsx | Rauch/CO getrennt in einem Alarmgerät, Schweregrad, Unbekannt/Zeit, optional nurbeiAlarm | sensor: primärer Status | Mehrfachalarm/Schweregrad und unbekannte Werte |
| humidity → Humidity.tsx | Feuchte + optionale Temperatur | sensor: primärer Messwert | SECOND und beide Einheiten |
| illuminance → Illuminance.tsx | Helligkeitswert, Einheit, Verlauf | sensor: primärer Messwert/Einheit | Semantisches Profil und gemeinsame Zusatzfunktionen |
| thermostat → Thermostat.tsx | Einzel-/Dual-Sollwerte, Ist/Feuchte, Power/Party/Modus, Boost-/Arbeitsmodus-Anzeige | rtr: ein Sollwert/Ist/Feuchte/Power/Modus | Getrennte Heiz-/Kühlsollwerte, Party, Arbeitsmodus/Boostanzeige, typisierte Moduswahl |
| airCondition → AirCondition.tsx | Dual-Sollwerte, Power/Boost/Modus, Lüfterwahl/-stufe, Swing/Luftrichtung, Status | rtr: ein Sollwert/Power/Modus/Fan/Swing | Dual-Sollwerte, Boost, getrennte Geschwindigkeit/Stufe, Luftrichtung, Arbeitsmodus/enum-UI |
| fan → Fan.tsx / FanBase.tsx | Power, Geschwindigkeitswahl, kontinuierliche Stufe, Swing, Luftrichtung | rtr: Power, fanSpeed, Swing; einzelne generic value/switch | Zwei unabhängige Geschwindigkeiten, Luftrichtung und kombiniertes Gerät; enum- statt Raw-Textbedienung |
| airPurifier → AirPurifier.tsx / FanBase.tsx | Power, Geschwindigkeitswahl, kontinuierliche Stufe, Swing, Luftrichtung | rtr: Power, fanSpeed, Swing; einzelne generic value/switch | Zwei unabhängige Geschwindigkeiten, Luftrichtung und kombiniertes Gerät; enum- statt Raw-Textbedienung |
| pump → Pump.tsx | Power, Leistungs-/Förderstufe, Temperatur/Druck/Durchfluss | Einzelne switch/value/sensor-Primitiven | Kombiniertes Pumpengerät und Mehrfachmesswerte |
| warning → Warning.tsx | Warnschwere, Titel/Text, Gültigkeitszeitraum, optional ausblenden | sensor: einzelner Primärwert | Strukturierte Warnung statt Einzeldatenpunkt |
| volume → Volume.tsx | Standalone-Lautstärkebogen/-regler und Mute-Wiederherstellung | player volume oder numeric value | Eigenständiges Volume-Profil; Mute-Speicherverhalten |
| volumeGroup → Volume.tsx | Standalone-Lautstärkebogen/-regler und Mute-Wiederherstellung | player volume oder numeric value | Eigenständiges Volume-Profil; Mute-Speicherverhalten |
| media → MediaPlayer.tsx | Transport, Lautstärke/Mute, Titel/Interpret/Album/Cover, Dauer/Position-Anzeige | player: Transport, Lautstärke/Mute/Power, Metadaten; zusätzlich Seek/TTS/Station/Playlist/Shuffle/Repeat | DURATION/ELAPSED, separates Album; automatische media-Zuordnung reparieren |
| tv → Tv.tsx | Power/Kunstmodus, Lautstärkewippe/Mute, App/Eingang, Navigation/Ziffern/Farbtasten/Transport | player: Power, Volume, Transport | TV-KEY/App/Input/ArtMode/Wippe-Vertrag und sichere Tastenauswahl |
| fillLevel → Tank.tsx | Rohwert/Einheit/Range, normierter Füllstand, zusätzliche nongenericSlots imDialog | numeric sensor | Tank-Profil mit Metadatenrange und Zusatzwerten |
| slider → Slider.tsx | Regler/Zahl/Enum mit optionalem Power; sofort/debounced/OK-Abbrechen; Valve/Fan/Gauge-Ansichten | writable sensor: number bounds/step; Boolean sensor | Level+Power in einem Gerät, enum-labels, Bestätigungsmodus und Device-Metadaten |
| percentage → Slider.tsx | Regler/Zahl/Enum mit optionalem Power; sofort/debounced/OK-Abbrechen; Valve/Fan/Gauge-Ansichten | writable sensor: number bounds/step; Boolean sensor | Level+Power in einem Gerät, enum-labels, Bestätigungsmodus und Device-Metadaten |
| info → Info.tsx | Alle passenden ACTUAL/PRESSURE/FLOW/AQI-Werte, sonst erste Elektromessung; Typ/Name/Einheit/Verlauf jeZeile | sensor: ein Boolean/Text/Zahlenwert | Mehrfachlesevertrag, keine Reduktion auf first state |
| image → Image.tsx | Bild ausURL-State, Refresh und optionalTimestamp; beide standardmäßigaus | camera/widget können einzelne Bilder/URLs anzeigen | Image-Profil und Refreshoptionen; sichereURL-Grenze |
| location → Location.tsx | Koordinaten/Einzel-GPS, Radius/Genauigkeit, Karte, bis3 Zusatzpositionen | Kein eigener Vertrag | Location-Vertrag und explizite Karten-/Egressentscheidung |
| locationOne → Location.tsx | Koordinaten/Einzel-GPS, Radius/Genauigkeit, Karte, bis3 Zusatzpositionen | Kein eigener Vertrag | Location-Vertrag und explizite Karten-/Egressentscheidung |
| weatherCurrent → WeatherCurrent.tsx | Aktuelles Wetter als Mehrfachmessung mit Beschreibung/Icon/Zusatzmetriken | Einzelne sensor-Werte | DP-basiertes Wetterkomposit |
| weatherForecast → WeatherForecast.tsx | Tag0 und bis7 zusätzliche indexierte Tagesvorhersagen | Kein eigener Vertrag | Mehrtage-Wettervertrag und Anzeige |
| rgbSingle → ColorLight.tsx | Gemeinsamer RGB-Datenpunkt; Helligkeit/Power gemäß Zuordnung; Farb-/Helligkeits-/CT-Presets; Geerbte Effekt-/Übergangszeitbedienung | color: gemeinsamer RGB-State mit hex/rgb/int | #-Konvention prüfen; Effekt/Übergangszeit |
| rgbwSingle → ColorLight.tsx | Gepackter RGBW-Datenpunkt; Helligkeit/Power gemäß Zuordnung; Farb-/Helligkeits-/CT-Presets; Geerbte Effekt-/Übergangszeitbedienung | color und separates white vorhanden | Gepacktes RGBW erhalten; separates white ist kein Ersatz |
| rgb → ColorLight.tsx | Getrennte RGB-Kanäle; Helligkeit/Power gemäß Zuordnung; Farb-/Helligkeits-/CT-Presets; Geerbte Effekt-/Übergangszeitbedienung | RGB-Farbwähler vorhanden | Separate R/G/B-Zuordnung und Schreiben |
| hue → ColorLight.tsx | Hue/Sättigungs-Kanäle; Helligkeit/Power gemäß Zuordnung; Farb-/Helligkeits-/CT-Presets; Geerbte Effekt-/Übergangszeitbedienung | RGB-Farbwähler vorhanden | HUE/SATURATION-Zuordnung und Konvertierung |
| cie → ColorLight.tsx | CIE-xy; Helligkeit/Power gemäß Zuordnung; Farb-/Helligkeits-/CT-Presets; Geerbte Effekt-/Übergangszeitbedienung | RGB-Farbwähler vorhanden | CIE-Feedback und Umrechnung |
| ct → ColorLight.tsx | Nur Farbtemperatur; Helligkeit/Power gemäß Zuordnung; Farb-/Helligkeits-/CT-Presets; Geerbte Effekt-/Übergangszeitbedienung | colorTemperature: Kelvin, Power und Helligkeit | CT-Profil ohne unerlaubte RGB-Bedienung; Effekte/Übergangszeit |

## Kritische Semantik der Referenz

- `lock`: Verriegelung (`SET`) und Tür-/Fallenöffnung (`OPEN=true`) sind verschiedene Aktionen; `DOOR_STATE` ist nur Rückmeldung. Bestätigungsdialog/PIN im Browser ersetzt keine EOS-Autorisierung.
- `gate`: `SET` ist Boolean Auf/Zu. Ein numerisches `ACTUAL` wird dadurch nicht zu einem numerischen Schreibziel.
- `button`: Die Referenz schreibt einmal `true`, keinen automatischen `false`-Release. Vorhandene EOS-Impulsprofile behalten ihren eigenen Vertrag. `buttonSensor` ist dagegen ausschließlich ein empfangenes Kurz-/Langdruckereignis.
- `rgbwSingle` erhält den vorhandenen Weiß-Suffix. Die Referenz weist `WHITE` nur einer Eigenschaft zu, ohne unabhängige Weißbedienung. Split-RGB, Hue/Saturation und CIE sind eigene Kodierungen.
- `thermostat`: BOOST und WORKING_MODE werden angezeigt; BOOST ist beim `airCondition` zusätzlich schreibbar. Heiz-/Kühlsollwerte bleiben getrennt, mit je eigenen Bounds/Steps; Heizen darf Kühlen nicht überschreiten.
- `camera`: BRIGHTNESS ist in dieser Vorlage ein Boolean-Schalter. PTZ ist ein einzelner numerischer State, keine erfundene Zweiachsensteuerung.
- `media`: DURATION/ELAPSED sind Anzeige. Zusätzliche EOS-Funktionen wie Seek/TTS/Stationen bleiben erhalten. `volumeGroup` allein begründet keine zusätzliche Gruppenbefehlsverteilung.
- Unbekannt/veraltet bleibt in EOS unbekannt. Referenzstellen mit optimistischer Anzeige oder Null-zu-False-Konvertierung werden nicht als Sollfehler übernommen.

## Eingebaute Custom-Ansichten

| Typ → Datei | Daten/Funktion | EOS-Lücke / Grenze |
| --- | --- | --- |
| clock → Clock.tsx | Analog/Digital, Datum/Wochentag/Sekunden, lokaler Sonnenauf-/untergang ausStandort | Eigenes Clock-Element |
| weather → Weather.tsx | DP-basierteAdapterdaten oder optionaleOpenMeteo/met.no-Daten; aktuell+Vorhersage | LokalesKomposit+Quellenkonfiguration; Explicit optional Open-Meteo/met.no fetch,30min refresh; met.no icons useGitHubraw |
| iframe → Iframe.tsx | Einbetten, Refresh, Dialog/neuerTab/gleicherTab, WebPort-Kontext | VollständigeKlick/Refreshoptionen; Only configured permitted navigation/embedding; preserve EOS URL/sandbox policy |
| gauge → Gauge.tsx | Bis2 Messwerte, Min/Max/Einheit/Präzision/Prozent/Farbschwellen/Gradient, Verlauf | Gauge-Profil undZweitwert |
| wind → Wind.tsx | Kompass/Richtung,Geschwindigkeit,Böen | Dreiwert-Windkomposit |
| universal → Universal.tsx | Mehrfachanzeige,bedingteIcons/Farben,TypedValueoderToggle,Min/Max-NumericToggle,Bestätigung,QuickChart,History | Mehrfachlesevertrag,getrennteAktion,MetadatenTyp/Enum,gemeinsameHistoryfunktionen; Frontend PIN must not be treated as authorization |
| presence → Presence.tsx | Präsenz,invertierbar,abwesendverbergen/abdimmen | Präsenzprofil/Sichtbarkeit |
| energyFlow → EnergyFlow.tsx | ArraysErzeuger/Verbraucher,Leistung/Tageswerte,Batteriestatus,animierteFlüsse,Verlauf | KonfigurierbaresSmartHome-Energieflusskomposit |
| markdown → Markdown.tsx | Markdown/GFM Notiz, großeDialogansicht | SicheresMarkdown-Element; Raw HTML disabled; unsafe link schemes filtered; preserve link policy |
| newline → Layout.tsx | NurLayoutumbruch,keinGerät | ExpliziterLayoutumbruchfallsgewünscht |

## Gemeinsame Funktionen und einzelne Datenpunkte

**Indikatoren:** WORKING, UNREACH, LOWBAT, MAINTAIN, ERROR, DIRECTION, DIRECTION_ENUM, CONNECTED, BATTERY, RSSI, FILTER_CHANGE, WASTE_ALARM, WATER_ALARM, MUTED, TEST, WINDOW.

**Zusatzinformationen:** ELECTRIC_POWER, CURRENT, VOLTAGE, CONSUMPTION, FREQUENCY, FILTER, BRUSH, SIDE_BRUSH, SENSORS, VALVE, FILTER_CONDITION, FILTER_CONDITION_CARBON.

`ON_TIME` ist ein separater Gerätestate für die automatische Abschaltzeit: nichtnegative gerundete Sekunden, erst nach Eingabeabschluss schreiben. Die EOS-Zeitprogramme sind eine andere Funktion und dürfen nicht als Ersatz gezählt werden.

Die Referenz bietet konfigurierte Verlaufsquelle, Trend, Min/Max seit Mitternacht oder letzte 24 Stunden, Chartdialog/Glättung und Verlauf einzelner Zusatzwerte. Ohne tatsächliche Datenquelle ist kein Verlauf nachgewiesen. Bestehende EOS-History-Seiten allein sind keine vollständige Kachelparität.

`src/lib/DeviceManagement.ts` zeigt zusätzlich jeden gemappten State: Werteliste → Auswahl, Boolean → Schalter, begrenzte Zahl → Regler, freie Zahl → Zahleneingabe, Text → Texteingabe; nicht schreibbar → Anzeige. Befehlsstate und Rückmeldung stehen getrennt. Für EOS ist das ein kontrollierter Mehrfach-Datenpunktvertrag mit serverseitiger Prüfung, keine freie Schreibkonsole. `common.states` kann Objekt, Array oder Semikolontext sein; numerische und String-Schlüssel bleiben typkorrekt.

## Zuordnung und Raumablauf

Die bestehenden EOS-Wege für manuelle Datenpunktauswahl, Type-Detector-Vorschläge, Importherkunft und Raum-/Funktionszuordnung werden erweitert. Keine Neuerkennung darf Gerätebefehle auslösen, bestehende IDs ersetzen oder manuelle Kundenzuordnungen überschreiben.

| Schritt | Manuell | Automatisch |
| --- | --- | --- |
| 1 | Geräteprofil wählen | Berechtigten Objektumfang lesen und alle unterstützten Detector-Ergebnisse auflisten |
| 2 | Benötigte und optionale Slots getrennt zuordnen | Sämtliche verfügbaren Slots mit tatsächlichen Typ-/Rollen-/Rechtemetadaten vorschlagen |
| 3 | Rückmeldung und Schreibziel getrennt prüfen | Aliasidentität, Geschwisterkanäle, doppelte Slots und bestehende Geräte abgleichen |
| 4 | Zuordnung ohne Aktorbefehl validieren | Unklare/fehlende Funktionen anzeigen; Vorschlag ausdrücklich übernehmen |
| 5 | Raum wählen/erlaubt anlegen; Etage/Funktion erhalten | Raumvorschlag übernehmen oder ändern; Mehrdeutigkeit nie still auflösen |
| 6 | Bestehenden transaktionalen Konfigurationspfad verwenden | Herkunft und manuelle Überschreibungen erhalten, wiederholten Import idempotent behandeln |

Bestehende Quellen: `ui/src-ts/runtime-executables/lib/smarthome-import.ts`, `www/smarthome-config.ts` und `main.ts`. Diese enthalten bereits Alias-/Dublettenerkennung, Importherkunft, Änderungsabgleich sowie Raumvorschläge. Auch Szenen, Zeitprogramme, Logikuhren, Seiten, Etagen, Funktionen, Migration, gemeinsame Lizenz und die vorhandenen Schutzprüfungen bleiben Teil der Regression.

## Erweiterungen und externe Quellen

`plugin`/`WidgetPlugin` (Module Federation samt Services) und `webComponent` führen Code fremder Adapter aus. Sie sind ausdrücklich getrennte Erweiterungsschnittstellen, keine weiteren eingebauten Geräteprofile. Ihr Laden ist nicht allein durch die Forderung nach sämtlichen eingebauten Bedienfunktionen freigegeben.

DP-basiertes Wetter, lokale Messungen und lokale Uhren funktionieren ohne zusätzliche Cloudquelle. Direkte Wetteranbieter und externe Karten-/Bildquellen werden als optionale Netzwerkfunktion mit eigener Freigabe behandelt. Die bestehende EOS-URL-/Sandbox-/Authentifizierungsgrenze darf durch die Referenz nicht abgeschwächt werden.

## Abnahmekriterien und offene Nachweise

Jeder Matrixeintrag benötigt nach Implementierung mindestens: vollständige manuelle Zuordnung, automatische Zuordnung falls Detector verfügbar, Raumzuordnung, alle vorhandenen Lese-/Schreibfunktionen, nicht vorhandene optionale Slots, reine Leserechte, falsche Datentypen/Enums/Bounds, unbekannte/veraltete Rückmeldung, erhaltene Bestandskonfiguration und keine ungewollten Befehle beim Rendern/Scrollen. Für STOP, Tor/Schloss, Kamera, Klima und Universalaktionen zusätzlich direkte API-Negativtests; für zusammengesetzte Geräte jede Teilfunktion getrennt prüfen.

Dieser Bericht enthält Quellprüfung und Inventarabgleich. Er bescheinigt keine fertige 9.0.10-Umsetzung, keine Hardwarefunktion, keine visuelle Browserabnahme und keine CRA-Konformität. Die tatsächlich erreichte Parität wird erst nach Implementierung pro Matrixeintrag mit Testergebnis ergänzt.
