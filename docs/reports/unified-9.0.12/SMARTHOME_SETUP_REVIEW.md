# SmartHome-Einrichtung: UX- und Regressionsprüfung

Stand: 23.11.2026, Zielversion 9.0.12. Dieser Bericht begleitet die Umstellung der Einrichtung auf Auswahllisten und getrennte Bearbeitungsdialoge. Er ist keine Browser- oder Geräteabnahme.

## Ausgangslage und Abnahmevertrag

Die bisherige Konfiguration zeigt eine Geräteauswahl neben einem umfangreichen Eigenschaftsformular; auf schmalen Ansichten beziehungsweise bei langen Zuordnungen können Inhalte rechts abgeschnitten werden. Die bestehenden Gerätevorlagen, manuellen Read-/Write-Zuordnungen, importierten Quellmetadaten sowie Räume, Funktionen, Favoriten und Kunden-IDs müssen beim Umbau erhalten bleiben.

Ein Bearbeitungsdialog erhält einen isolierten Entwurf. **Anwenden** übernimmt geprüfte Eingaben in den noch ungespeicherten Gesamtdraft; **Abbrechen**, Escape und Schließen stellen den ursprünglichen Gesamtdraft einschließlich vorherigem Dirty-Status und Auswahl wieder her. Neue Geräte, Räume oder Geschosse dürfen bei Abbruch keine leeren Reste hinterlassen. Die zentrale Speicherung ist ein gesonderter, ausdrücklich ausgelöster Vorgang. Die vorhandenen Datenpunkt-/Icon-Auswahlfenster müssen aus einem Bearbeitungsdialog erreichbar bleiben und dürfen nach dessen Abbruch keine verspätete Änderung an der wiederhergestellten Basis auslösen.

Die Erkennung muss bereits zugeordnete Geräte berücksichtigen, konkrete Räume/Funktionen zuweisen und mehrere bewusst ausgewählte Vorschläge übernehmen können. Der Batch wird vor dem Commit geprüft. Alias-Teilfehler oder zwischenzeitlich geänderte Konfiguration dürfen keinen unvollständigen Geräte-/Raumimport erzeugen; eventuell schon angelegte Alias-Objekte sind separat zu benennen. Kein Einrichtungs- oder Suchvorgang darf unaufgefordert Gerätewerte schreiben.

## Prüfmethode und Grenzen

`ui/test/unified/smarthome-setup-flow.test.cjs` lädt die tatsächlichen kanonischen Funktions- und Variablendeklarationen aus `smarthome-config.ts` sowie die tatsächlichen Browserhelper. Die Tests verwenden kontrollierte Fetch-Antworten und Verzögerungen an der Netzwerkgrenze. Für Datenflussprüfungen werden nur nicht betroffene Renderhooks unterdrückt; Import-, Validierungs-, Transaktions- und Speicherlogik werden nicht durch Erfolgsmocks ersetzt.

Ein minimales DOM prüft Ereignisse, Elemente und Fokuszustände. Es berechnet kein Browserlayout. CSS-/Markup-Prüfungen sind deshalb lediglich strukturelle Nachweise zu Breiten, Scrollbarkeit und vorhandenen Bedienelementen. Eine visuelle Prüfung bei schmalen Bildschirmbreiten, mit Bildschirmvergrößerung und auf echten Endgeräten bleibt ausdrücklich offen. Der hier zuvor nicht verfügbare Browserzugriff wird nicht umgangen.

## Reproduzierte Befunde

| Kennung | Befund | Risiko | Bearbeitung |
| --- | --- | --- | --- |
| SHSETUP-001 | Eine verspätete erfolgreiche Speicherantwort ersetzt neuere lokale Eingaben und setzt Dirty zurück. | Ungespeicherte Kundeneinstellungen gehen verloren. | Behoben und nachgeprüft: Identität und JSON-Snapshot schützen den neueren Entwurf; Dirty bleibt gesetzt und Speichern wieder bedienbar. |
| SHSETUP-002 | Ein zuvor registrierter Profil-Callback setzt nach Dialogabbruch den Dirty-Status der wiederhergestellten Basis. | Abgebrochene Aktionen verändern den Zustand eines anderen Entwurfs. | Behoben und nachgeprüft: alter Callback wird verworfen; ursprüngliches Konfigurationsobjekt, Inhalt und Dirty-Status bleiben erhalten. |
| SHSETUP-003 | Neuladen, verzögerter Dateiimport oder Scan können nach einem Entwurfswechsel veraltete Ergebnisse übernehmen. | Benutzeränderungen oder zur Konfiguration passende Vorschläge werden überschrieben. | Guards und Antwort-Snapshots nachgeprüft: Reload/Dateiimport verhindern parallele Editoren; inzwischen geänderte Entwürfe bleiben erhalten. Eine Scanantwort bei geändertem Entwurf oder offenem Editor wird mit Hinweis verworfen. |
| SHSETUP-004 | Formular-Neuaufbau bei einfachen Texteingaben kann das nächste Feld entfernen; erfolgloses Apply kann ohne Rückmeldung bleiben. | Eingabeablauf, Fokus oder Fehlerbehebung werden erschwert. | Nachgeprüft: Namensänderung hält bestehende Controls im DOM; explizites Refresh behält Body, Scrollposition und Fokusindex. Ungültiges Apply bleibt offen und liefert sichtbaren Text. |

## Abnahmefälle

- Bestehende Vorlagen und alle elf bisherigen Oberflächentypen bleiben erzeugbar; Vorbereitung ohne Commit verändert keine Kundendaten.
- Einzelimport behält konkrete Read-/Write-Datenpunkte, Profil, Kundennamen und Raumzuordnung; wiederholter Import erzeugt keine Dublette.
- Alias-Teilfehler und verspätete Antwort nach Entwurfswechsel erhalten Geräte-/Raumentwurf unverändert und liefern einen verständlichen Hinweis.
- Fehler der Autoerkennung überschreiben weder die Konfiguration noch unbemerkt vorherige Ergebnisse.
- Fehlgeschlagenes Speichern erhält Dirty-Status und lokale Änderungen; erfolgreicher verspäteter Save darf neuere Änderungen nicht ersetzen.
- Dialog Apply/Cancel/Escape, Fokus-Rückkehr und Abbruch neuer Geräte/Räume/Geschosse sind geprüft. Globale Save-/Reload-/Dateiimportaktionen bleiben im Dialog gesperrt; ein ausstehendes Apply lässt keinen zweiten Dialog zu.
- Bestehende Datenpunktauswahl bleibt über dem Bearbeitungsdialog erreichbar. Nach Cancel wird die Auswahl geschlossen; verspätete Auswahl- und Profilcallbacks ändern weder Basisdaten noch Dirty-Status.
- Batch-Auswahl, Zielraum, Erhalt der genauen IO-Zuordnungen, Dubletten, wiederholter Import, Ablehnung, ungültiger Zielraum und Alias-Teilfehler sind am tatsächlichen Importpfad geprüft. Eine späte Aliasantwort darf auch bei Mutation desselben Konfigurationsobjekts nicht committen.
- Eine Liste mit 10.000 Vorschlägen rendert höchstens 100 Vorschlagszeilen gleichzeitig; Auswahl bleibt über Seitenwechsel und Suche erhalten. Bestehende lange Kunden-IDs und Einträge jenseits der Erkennungsgrenze werden in der Einrichtung nicht still verkürzt oder versteckt.
- Fokusfalle berücksichtigt sichtbare Summary-Elemente geschlossener Details und überspringt versteckte Vorfahren. Die vorhandene verschachtelte Datenpunktauswahl erhält Fokus; Escape dort schließt nicht den übergeordneten Entwurf.
- HTML und geparstes, auf die Konfigurationsseite begrenztes CSS enthalten den neuen Einstieg, Dialogbreiten-/Scrollregeln, einspaltige Felder bei schmalen Ansichten und eine höhere Ebene für den Datenpunktdialog.

## Ausführung und Nachweise

Der gezielte Lauf umfasst **27 Tests, jeweils 27 bestanden, 0 fehlgeschlagen und 0 übersprungen** auf Node.js 22 und 24. Die Konfigurationsfunktionen werden aus den tatsächlichen kanonischen Quellen geladen; die Helper werden ohne Logikänderung nach JavaScript übersetzt und ausgeführt. Das ist ein Nachweis der geprüften Datenflüsse und DOM-Verträge, keine Ersatzimplementierung des Produkts. Im beschriebenen Prüfumfang bleibt kein offener Funktionsblocker; die nachfolgenden Grenzen bleiben bestehen.

| Runtime | Befehl | Ergebnis | Rohprotokoll |
| --- | --- | --- | --- |
| Node.js 22.23.4 | `/workspace/scratch/741f792566ea/node22-runtime/package/bin/node --test ui/test/unified/smarthome-setup-flow.test.cjs` | Exit 0; 27/27; 23.495 ms | `raw/smarthome-setup-flow-node22.log` |
| Node.js 24.22.3 | `node --test ui/test/unified/smarthome-setup-flow.test.cjs` | Exit 0; 27/27; 18.536 ms | `raw/smarthome-setup-flow-node24.log` |

Geprüfter Quellstand (SHA-256):

| Datei | SHA-256 |
| --- | --- |
| `ui/src-ts/runtime-executables/www/smarthome-config.ts` | `5e9ea20bd2affc82f62ae55a5b812c58dc37cb446ebebea3ae949cefcf8f3562` |
| `ui/src-ts/runtime-executables/www/smarthome-setup.ts` | `9513f3b63d66f64a4bb1c949207dd979359a1db8d208a9d02848225c44c423b4` |
| `ui/www/smarthome-config.html` | `f289625b99d3eadb614ca3c57ff9592b4fcb0726fd2c27920ced480f772f5bcd` |
| `ui/www/smarthome-config-workspace.css` | `affef6b4fce2c6e42b5ee1c700ab343520cffaa8572133cfee8d556eabbe699a` |
| `ui/test/unified/smarthome-setup-flow.test.cjs` | `f5e3b3d3458a8c3f905626ee4a3cbd94287874836b40daa170781e7747e5f74a` |

Nach den gezielten Testläufen wurden im Setuphelper ausschließlich zwei Kommentarformatierungen für Runtimegenerator und Dokumentationsmodell berichtigt. Die Hashbindung oben enthält diesen finalen Stand; die Produktlogik blieb unverändert.

Offen bleibt die visuelle Endgeräteprüfung: echtes Layout bei 320/375/768 Pixeln, Zoom, Touch/Scroll und die native Reihenfolge von Tab, Blur und Change. Das Minimal-DOM besitzt keine Layout- oder native Event-Propagation-Engine. Fokusindex-/Scrollprüfungen bestätigen deshalb den expliziten Refreshvertrag, nicht jede Browserinteraktion. Ebenfalls nicht Bestandteil dieses Teilberichts sind ein realer Anlagenscan, tatsächliche Alias-Persistierung, Anlagenmigration, Gerätequittungen oder das vollständige Release-/Security-Gate; diese Nachweise sind separat zu führen.
