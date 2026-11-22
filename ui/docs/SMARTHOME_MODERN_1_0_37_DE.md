# Smart Home 1.0.37 – Darstellung und Detailbedienung

## Zweck und Geltungsbereich

Stand: 19. November 2026. Änderungskennung: `SH-UI-1.0.37`.
Ausgangspunkt ist das bereitgestellte vollständige Quellpaket 1.0.36. Die
Änderung setzt die abgestimmte EOS-Gestaltung in der vorhandenen Kundenansicht
um. Es handelt sich um echte Produktoberfläche mit den bestehenden Geräten,
API-Aufrufen und Bedienfunktionen; die vorherige Vorschau wird nicht ausgeliefert.

Betroffen sind die kanonische Browserquelle
`src-ts/runtime-executables/www/smarthome.ts`, `www/smarthome.html` und ausschließlich
SmartHome-spezifische Ergänzungen in `www/styles.css`. Die generierte
`www/smarthome.js` muss im gemeinsamen Build über den vorhandenen
Runtime-Generator synchronisiert werden. Der gezielte UI-Arbeitsschritt hat
keinen globalen Build gestartet und keine fremden Spiegel überschrieben.

## Umgesetzte Bedienung

- Ruhige EOS-Flächen in Blau/Anthrazit, klare Typografie und Abstände, Grün für
  Auswahl/Hauptaktionen. Bestehende Geräteicons und gültige konfigurierte
  Gerätefarben bleiben erhalten. Externe Iconquellen werden nicht nachgeladen.
- Gerätekarten haben lesbare Namen, getrennte Status-/Qualitätsangaben,
  mindestens 44 Pixel große Aktionsflächen und kompakte Fortschrittsanzeigen.
  Raumklima zeigt Isttemperatur sowie vorhandenen Sollwert und Luftfeuchte.
  Auf schmalen Geräten stehen die Karten untereinander; kein Gerätetyp wird
  für die neue Gestaltung entfernt.
- Die bestehenden großen Bedienansichten für Dimmer, Farbe, Beschattung,
  Raumklima, Player und schreibbare Werte bleiben erhalten. Auch die bisherigen
  Farbfunktionen, Lamellen, Schutzanzeigen, Medienfunktionen und Timer sind
  weiter über ihre bestehenden Implementierungen erreichbar.
- Ein Gerätename ist bei bedienbaren Kacheln ein echter Tastatur-Button. Ein
  Klick, Tippen oder Enter führt dieselbe bisherige Kachelaktion aus. Bei
  Schaltern und Szenen bleibt die direkte Schnellaktion erhalten; die anderen
  genannten Typen öffnen ihre große Detailansicht. Bestehende Schnellschalter,
  Dimmschritte, Auf/Stopp/Ab, Favorit und Zeitschaltuhr bleiben verfügbar.
- Detailansichten und Timer besitzen Dialog-Semantik, Hintergrundsperre,
  Initialfokus, umlaufende Tab-Navigation, Escape und Fokus-Rückkehr zum
  auslösenden Bedienelement. Falls eine Kachel inzwischen aktualisiert wurde,
  wird das entsprechende Bedienelement über die unveränderte Geräte-ID
  wiedergefunden.
- Ein Timerdialog verwendet denselben modalen Lebenszyklus wie ein Gerätedialog.
  Noch nicht gespeicherte Timerzeiten werden durch Geräte-Polls nicht ersetzt.

## Rückmeldungen, Qualitätszustände und Polling

Die Render-Signatur ignoriert ausschließlich `quality.ageMs` und
`fieldQuality.<Feld>.ageMs`. Diese berechneten Alterszähler laufen bei jedem
Poll weiter und verursachten bisher unnötige vollständige Kachel-Neuaufbauten.
Die unveränderten echten DTOs bleiben im Browsercache aktuell. Werte,
Qualitätsstatus, Validität, Zeitstempel, Konfiguration und Timer beeinflussen
die Signatur weiterhin. Ein Wechsel nach veraltet/offline/fehlerhaft bleibt
sichtbar; Alter wird nicht mit Aktualität gleichgesetzt.

Ein geöffnetes Bedienpanel bleibt beim Poll bestehen. Die ausdrücklich als
**Rückmeldung** bezeichnete Kopfzeile aktualisiert den vom Backend gelesenen
Gerätezustand separat von den gewählten Eingabewerten. Slider, Schrittwahl,
Player-Bibliothek und lokale Timerentwürfe werden dabei nicht neu aufgebaut.
Ein erfolgreich angenommener Bedienauftrag heißt **Gesendet**, nicht pauschal
„Bestätigt“. Die tatsächliche Gerätereaktion ergibt sich aus der Rückmeldung.

Wird das Gerät entfernt oder werden seine Bedienzuordnung beziehungsweise
`behavior` geändert, schließt das Panel. Dadurch bleiben keine alten
Bedienfreigaben im geöffneten Dialog bestehen. Die eigentliche Autorisierung
und die gerätespezifischen Schutzprüfungen verbleiben unverändert im Backend.

Veraltete/offline/ungültige Sensorwerte werden als Qualitätszustand mit
Gedankenstrich dargestellt, nicht als aktueller Messwert oder künstliche Null.
Eine gültige echte Null bleibt sichtbar. Optionale Indikatoren werden nur aus
vorhandenen Rückmeldungen angezeigt:

| Daten | Darstellung |
| --- | --- |
| `state.battery`, Einheit `%`, endliche Zahl 0–100 | Tatsächlicher Batteriestand, einschließlich gültiger 0 % |
| `state.battery`, Einheit `low`, Boolean | Batterie schwach beziehungsweise Batterie OK |
| Fehlende, ungültige oder veraltete Batterierückmeldung | Keine erfundene Batterieanzeige |
| `state.unreachable === true` | Nicht erreichbar |
| Aktiver `state.deviceError` | Gerätestörung |

Die zugehörigen additiven Import-/Backend-Mappings werden im separaten
SmartHome-Import-Arbeitsschritt dokumentiert. Ältere Geräte ohne diese Felder
funktionieren unverändert. Die UI interpretiert keine beliebigen Texte als CSS;
ein übernommener Geräteakzent muss `#RRGGBB` entsprechen.

## Verbindlicher Funktionserhalt

Es gibt keine Migration vorhandener Anlagen. Geräte-IDs, Datenpunktzuordnungen,
Räume/Etagen, Seitenreihenfolgen, kundeneigene Einstellungen, Favoriten-Schlüssel,
Szenen, Timerwerte, Wertebereiche und Schrittweiten werden nicht umgeschrieben.
Die vorhandenen Schreib-Endpunkte und Payloads werden weiterverwendet. Die
Bedienung verändert keine EMS-Prioritäten oder Regelgrenzen.

Bei der Quellprüfung wurden 18 bestehende Funktionen gegenüber 1.0.36 verglichen:
Geräte-/Dimmer-/Farb-/Beschattungs-/Player-/Klima-/Wert-Schreibaufrufe,
Timer-Speichern/Löschen, Klima-Wertebereich, Favoritenladen/-speichern/-bestimmen/
-umschalten sowie Seitenfilter und Konfigurationsladen. Diese Funktionskörper
sind unverändert. Der neue Test prüft zusätzlich beispielhafte reale Payloads
und die Verwendung konfigurierter Klima-Grenzen und Schrittweiten.

## Prüfvermerk

Umgebung: Linux-Arbeitscontainer, Node.js 24.22.3, lokales TypeScript 5.8.3;
keine laufende Kundenanlage, kein ioBroker-Controller und keine physische
Geräteverbindung. Prüfung der kanonischen Quelle, nicht nur der Vorschau.

| Prüfung | Befehl / Verfahren | Ergebnis |
| --- | --- | --- |
| Runtime-/DOM-Regression | `node --test test/smarthome-modern-ui.test.cjs` | 9 Tests bestanden, 0 fehlgeschlagen |
| JS-Syntax der kanonischen Browserquelle | Node `vm.Script` | Bestanden |
| Gezielte TypeScript-Transpilation | `typescript.transpileModule`, ES2022; Ausgabe im Speicher durch `vm.Script` geprüft | Bestanden, keine Diagnosen; keine generierten Runtime-Dateien verändert |
| Bestehende Funktionsverträge | AST-Funktionskörpervergleich der oben genannten 18 Funktionen mit 1.0.36 | Identisch |
| CSS-/Markup-Prüfung | SmartHome-spezifischer Scope, mobile Umbrüche, Namens-/Buttonstruktur und Dialogtitel geprüft | Quellprüfung durchgeführt |
| Gerenderte Browser-/Touch-Prüfung | Chromium-Start war in dieser Arbeitsumgebung zuvor mit `socket() failed: Operation not permitted (1)` blockiert | Nicht ausgeführt; keine visuelle Browserabnahme behauptet |
| Geräte-/Hardwaretest | Keine echte Anlage verbunden | Offen |
| Integrierter Gesamtbuild, Spiegel-/Dokumentationssync und Release-Gates | Gemeinsam mit den übrigen Änderungen an 1.0.37 auszuführen | Separater gemeinsamer Nachweis erforderlich |

Die neun Tests decken Alters-Signaturen und echte Zustandswechsel, zehn
Kacheltypen, gültige Null/Qualitätszustände, Batterieindikatoren, Fokusfang und
Fokus-Rückkehr nach Kacheltausch, Timerentwürfe, Konfigurations-/Rechtewechsel,
Schalt-/Szenen-/Dimmer-/Klima-Payloads und lokale Favoriten ab. Die kleine
DOM-Simulation prüft Programmlogik und DOM-Verknüpfungen; sie berechnet kein
Browserlayout und ersetzt keinen echten Tastatur-/Touchtest im Zielbrowser.

## Prüfung auf der Hausanlage und Rückfall

Vor dem Update Adapterkonfiguration und bisheriges 1.0.36-Paket sichern. Für
browserlokale Favoriten denselben Browser und Ursprung verwenden; diese Daten
werden durch die Änderung weder migriert noch gelöscht. Für einen Rückfall
wieder das gesicherte vollständige Paket verwenden.

1. Vorhandene Räume, Geräte, Favoriten, Szenen und Timer mit dem vorherigen Stand
   vergleichen. Ohne Import sollen Gerätezahl und Zuordnungen gleich bleiben.
2. Auf Desktop sowie schmalem 320-/360-Pixel-Viewport Gerätekarten prüfen:
   vollständige Bedienbarkeit, keine Überlagerung, kein seitliches Abschneiden.
3. Licht schalten/dimmen, Farbfunktionen, Jalousie Auf/Stopp/Ab/Lamellen und Klima
   mit den bestehenden Zuordnungen erproben. Rückmeldung, Grenzwerte,
   Schrittweiten und vorhandene Schutzsperren kontrollieren.
4. Große Bedienung öffnen, mindestens zwei Pollintervalle abwarten und währenddessen
   einen Regler beziehungsweise Timerentwurf ändern. Fokus und Eingabe dürfen
   durch reine Altersänderungen nicht verloren gehen. Escape und Zurückfokus prüfen.
5. Szenen, Zeitschaltuhren, Audio, Kamera/Widget und schreibbare Sensoren gemäß
   vorhandener Ausstattung prüfen. Ein nicht vorhandener Gerätetyp gilt als offen.
6. Ein bekannt offline/veraltet gemeldetes Testgerät ansehen: keine erfundene
   Null und kein unberechtigter Schaltzustand. Keine Verbindung absichtlich an
   einer sicherheitsrelevanten Anlage trennen.

Ergebnisse mit Adapterversion, Zielbrowser, tatsächlichen Geräten und
Soll-/Ist-Beobachtung ergänzen. Dieser UI-Prüfvermerk erteilt keine allgemeine
Produktivfreigabe und bescheinigt keine Normkonformität.
