# NexoWatt EOS 9.0.10 – Änderungs- und Prüfbericht

Stand: 23.11.2026. Der Bericht beschreibt den gelieferten Integrations-Teststand,
keine allgemeine Produktionsfreigabe oder CRA-Zertifizierung.

## Anlass und Umsetzung

Gewünscht sind die unterstützten Geräte-Bedienfunktionen der bereitgestellten
ioBroker.devices-Referenz, automatische und manuelle Datenpunktzuordnung, verknüpfte
Aliase sowie eine übersichtlichere Konfiguration und ein eigenständiges farbigeres
NexoWatt-Design ohne zusätzliche Schritttasten und lange Erklärtexte auf den Kacheln.

Die Referenzinventare `DEVICE_FUNCTION_PARITY.md` und `.json` dokumentieren die
51 eingebauten Gerätearten, 10 zusätzlichen Ansichtsarten und zwei getrennten
Erweiterungsschnittstellen. Sie sind eine **Bestands-/Lückenaufnahme der Ausgangsversion
9.0.9**, kein automatisch bestandener Abnahmebericht für 9.0.10.

Neue Geräteprofile beschreiben getrennte Lese- und Schreibziele. Bedienbefehle akzeptieren
Geräte-ID und Funktionsschlüssel, keine freien Datenpunkt-IDs. Aktuelle Objektmetadaten,
Typen, Einheiten, Grenzen, Enumerationen, Alias-Ketten und Schreibrechte werden geprüft.
Lizenz, Laufzeit-Eigentümerschaft, Rolle und Zuordnung werden unmittelbar vor dem Write
erneut geprüft. Mehrwertige Farbaufträge prüfen alle Werte vor dem ersten Write;
die einzelnen Gerätewrites sind **keine atomare Transaktion**.

Die erneuerte Erkennung übernimmt alle passenden Geräte eines Kanals. Stabile
Herkunftsangaben schützen Raumzuordnungen und manuelle Änderungen. Für verwaltete Aliase
bleibt die ursprüngliche Importidentität erhalten. Aliasobjekte entstehen ausschließlich
auf ausdrücklichen Konfigurationsauftrag, ohne Geräte-State-Writes. Kollisionsprüfung,
begrenzt parallele Metadatenabfragen und idempotente Wiederholung begrenzen Teilfehler.

Bestehende EOS-Zusatzfunktionen bleiben über die vorhandenen Bedienwege erreichbar.
Profilfähige Geräte erhalten dabei dieselbe Metadaten-/Schutzprüfung wie die neuen
Oberflächen; aus einem reinen Rückmelde-Datenpunkt wird kein zusätzlicher Schreibpfad.
Bisherige Geräte ohne neues Profil behalten ihren vorhandenen Vertrag.

Die Konfiguration erhält drei Arbeitsbereiche und nutzt die verfügbare Breite.
Geschosskarten belegen eine volle Arbeitsflächenzeile, lange Namen dürfen umbrechen,
technische Symbole werden als lokale SVGs aufgelöst. Unter 1.100 Pixeln werden die
Builder-Spalten gestapelt. Die Anordnung bietet Raumfilter, Drag-and-drop, Tastatur,
Positionswahl und direktes Tauschen; bis zum Speichern ändern sich nur lokale
Reihenfolgewerte. Behoben wurden das Überschreiben gespeicherter Reihenfolgen beim
Laden und ein falscher Zielindex beim klassischen Verschieben.

## Ressourcen und Fehlerverhalten

- Geräteprofile: höchstens 128 Felder, maximal acht parallele Metadaten-/State-Lesevorgänge
  je Gerät, fünf Sekunden Budget. Der gesamte zusätzliche Snapshot-Lesecache hat ebenfalls
  fünf Sekunden Laufzeit ab Anlage; kein neues Fünf-Sekunden-Budget pro Folgegerät.
- Snapshot-Zwischenspeicher gelten nur für eine Abfrage; kein zweiter dauerhafter
  Gesamtbestand und keine neuen pauschalen State-Abonnements.
- Sichtbare Zusatzfelder werden bei Bedarf aufgebaut. UI-Caches sind begrenzt.
- Aktive numerische Eingaben und Bestätigungen werden durch Polls nicht ersetzt.
- Normale Befehle und Stop verfügen über getrennte begrenzte Kapazitäten. Keine
  automatische Wiederholung eines unbestätigten Hardwarewrites.
- History-Abfragen verwenden ausschließlich gespeicherte Lesefelder, begrenzte
  Zeitbereiche/Antwortmengen und ein Zeitlimit. Ein Ausfall ist ein HTTP-/UI-Fehler.
- Alias-Anlage: maximal 100 Geräte/2.000 Felder je ausdrücklichem Auftrag, 30 Sekunden
  Budget, kein Überschreiben fremder Aliasobjekte und kein automatisches Löschen.

Dies ist keine Messung des RAM-Verbrauchs auf der Kundenanlage. Der reale Einfluss
hängt insbesondere von Datenpunktzahl, offenen Seiten, Geräten und History-Quelle ab.

## Prüfungen

Die folgenden Ergebnisse gehören zum Quell- und Buildstand dieser Lieferung.

| Prüfung | Tatsächliches Ergebnis |
| --- | --- |
| Vollständiges `npm test`, Node.js 24.22.3 | 1106 bestanden, 0 fehlgeschlagen, 2 ausgelassen |
| Vollständiges `npm test`, Node.js 22.23.4 | 1106 bestanden, 0 fehlgeschlagen, 2 ausgelassen |
| Konfigurationslayout | 11 Regressionstests: Reihenfolge, Raumgrenzen, Drag-and-drop, Tastatur/Fokus, Tauschen, Reload und Layoutverträge |
| Neue Bedienprofile / Aliasse / Erkennung / Referenzslots | 104 Tests jeweils unter Node 22/24; in der Gesamtsuite enthalten |
| Gebaute SmartHome-Oberfläche mit echten Bedienhelfern | 11 zusätzliche Integrationsfälle in der Gesamtsuite; DOM-/API-Simulation, kein Browser |
| Vorhandene moderne SmartHome-Oberfläche | 9 Tests zusätzlich bestanden |
| Vertrag, transaktionale Konfiguration, Szenenschutz, UI-Fähigkeiten, Appcenter-Auth | Vorhandene Prüfprogramme bestanden |
| Strikte Typprüfung, Node 22/24 | Bestanden; finale Layout-Korrektur separat nochmals auf beiden Laufzeiten geprüft |
| Gezieltes ESLint | Bestanden; neue Module ohne `any`/Typunterdrückung |
| Quellen-Sicherheitsgate | 206 Quellen, 0 neue blockierte Befunde |
| Builds | Admin-Frontend, Installer, Backend, Module und finale UI-Runtime erfolgreich |
| Runtime-/Dokumentationsabgleich | 184 Runtime-Ausgaben und 296 deutsche Modulbeschreibungen synchron |
| Geheimnissuche | 3.698 Dateien ohne Treffer innerhalb der unterstützten Regeln |
| npm-Audit Laufzeit | 0 gemeldete Advisories |
| npm-Audit gesamte Build-/Testumgebung | 14 moderate, 0 high/critical; bereits vorhandener Entwicklungsbestand |
| SBOM | Root, Laufzeit, Admin-Frontend und Installer auf 9.0.10; Vendoring-Abgleich bestanden |

Die beiden ausgelassenen Fälle benötigen `nginx` beziehungsweise `setfacl`.
Die Lizenzkette Keygen 1.0.4 → lokaler HTTPS-Import → Aktivierung → verschlüsselte
Speicherung → Neustart wurde mit der vorhandenen geprüften Keygen-Quelle ausgeführt.
Die Testtresore und Schlüssel werden nur temporär im Test erzeugt und nicht ausgeliefert.

Der Sicherheitslauf führt 3197 aktuelle Scannerfundstellen:
2952 historische offene Hinweise und
245 einzeln bewertete Fundstellen. Die historische
Baseline wurde nicht erweitert. Neue heuristische Fundstellen wurden mit konkretem
Datenfluss, Fingerprint, Quellhash und Tests bewertet; Details im
`SECURITY_DELTA_REVIEW.md`. Das Ergebnis ist kein Nachweis eines vollständig
bereinigten Altbestands. Die Entwicklungs-Advisories bleiben ebenfalls offen.

Die UI-Prüfungen verwenden lokale DOM-/API-Fixtures und Layoutverträge. Eine echte
visuelle Browserabnahme war in dieser Umgebung nicht verfügbar. Der Vollbreitenfix
ist daher im Code und per Regression geprüft, nicht als auf allen Endgeräten
visuell abgenommen ausgewiesen.

Rohbelege mit Prüfsummen stehen unter `raw/INDEX.json`. Einzeltests in der Gesamtsuite
werden nicht mehrfach als zusätzliche Gesamterfolge gezählt. Die endgültige ZIP-/TGZ-
Byteprüfung und Prüfung einer frischen Extraktion stehen in der mitgelieferten
`NexoWatt_EOS_9.0.10_Lieferpruefung.json`.

## Grenzen und noch erforderliche Abnahme

- Physische Geräte, Busse, Verriegelungen, reale Rückmeldungen und Kundenmigrationen
  wurden in dieser Entwicklungsumgebung nicht an der Anlage geprüft.
- Eine echte visuelle Browser-/Touch-Abnahme ist hier nicht verfügbar. DOM-/API-Simulationen
  und Layout-Vertragsprüfungen ersetzen keine Ansicht auf den Zielgeräten.
- Es gibt keine automatische Übernahme externer Widget-Plugins, Anbieter-Wetterdienste,
  Kartendienste oder deren Benutzerkonten. Die Referenzbedienung wird in EOS-Funktionen
  umgesetzt; der vollständige Fremdadapter und seine Administrationsoberfläche werden
  nicht nachgeladen.
- Alte Sicherheits-Scannerhinweise und Entwicklungs-Advisories werden im Sicherheitsdelta
  getrennt von neu geprüften Fundstellen dokumentiert. Ein grünes Regressionsgate ist
  kein Nachweis eines vollständig bereinigten Altbestands.
- Port-443-/DNS-/Zertifikatsvertrauen, echte Host-ACLs und physische Regelzeiten sind
  unveränderte, gesondert am Zielgerät zu prüfende Integrationsgrenzen.
