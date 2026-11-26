# Tibber: Überschreiben bei anderer EMS-Änderung

Die Nutzerbeobachtung wurde über den tatsächlichen App-Center-Speicherweg nachgestellt. Ein isolierter Kunden-Tarifsave mit anschließendem Child-/Owner-Neustart bestand im Ausgangsstand. Der zusätzliche EMS-Speichervorgang war entscheidend:

1. Die tatsächliche Kunden-HTTP-API speichert Tibber mit einem künstlichen Testtoken.
2. Installer-GET ließ tariffProvider aus seiner Auswahl weg und lieferte dem Formular den gespeicherten Tarif nicht.
3. Die echten Apply-/Collect-Formularfunktionen erzeugten deshalb Tarif-Defaults. Auch bei einer anderen EMS-Änderung sendete das Formular manual-dp, deaktiviert und Token leer mit.
4. Der tatsächliche Installer-POST bestätigte die Speicherung. Nach Stop und frischem Owner/Child aus einem Disk-State-/Objekt-Snapshot waren Anbieter, Aktivierung und Token entsprechend zurückgesetzt.

Der Regressionstest war vor der Korrektur rot. Eine einzelne Tarifzeile in der Installer-Auswahl machte denselben Scratchlauf grün und isolierte die Ursache. Die endgültige Korrektur ergänzt:

- Bestätigte Tarifkonfiguration im Installer-GET, mit Geheimnisplatzhaltern statt Tokenwerten. Zurückgehaltene Anbietergeheimnisse bleiben verborgen.
- Kein unveränderter Tarif im allgemeinen App-Center-Save. Bei Tarifbearbeitung werden echte Felddifferenzen auf den geladenen Stand angewandt; fehlende Controls und sichtbare Normalisierungsdefaults löschen keine gespeicherten Werte.
- Der Server ersetzt __KEEP__ nur beim passenden Anbieter, der passenden Preisquelle, passenden Endpunkten und Authentifizierungsdaten. Ein Home-ID-/Landwechsel innerhalb derselben Tibber-Anbindung oder bewusstes Deaktivieren verursacht keinen grundlosen Tokenverlust. Neue Tokens, bewusste Leerung und echte Zielwechsel bleiben möglich.
- Vollständige Maskierung benutzerdefinierter REST-Header und Request-Bodies, auch bei objektförmiger Speicherung. Kein Weiterreichen alter Geheimnisse an eine andere Quelle.
- Positive Hydration für Installer-GET/POST: vor dem bestätigten Laden keine vermeintlich gespeicherten Defaults oder Revisionen. Frühe POSTs trafen außerdem bereits vorhandene globale Startup-Sperren; diese werden nicht als zuvor fehlender Schutz ausgegeben.
- Positive Hydration auch vor automatischen Devices-/OCPP-Konfigurationsmutationen. Ein echter früher onReady-Fehler (Object-DB-Fehler in ensureLicenseStates) konnte zuvor degraded ohne geladene Konfiguration hinterlassen; der Devices-Planner blieb dennoch erreichbar. Der neue Test verwendet diesen echten Lifecycle und verhindert den Aufruf.

Die neuen Tests prüfen echte HTTP-/IPC-Aufrufe, Disk-Snapshot, frischen Owner-/Childstart, Maskierung, Zielwechsel, bewusste Leerung sowie Start-/Lesefehler. Frontendtests führen die tatsächlichen Apply-/Collect-Funktionen aus. Gesamtzahlen und Laufzeitversionen stehen in PRUEFERGEBNISSE.json und raw/INDEX.json; nachgelagerte Paket-/Git-Nachweise separat unter Liefernachweise.

Kein echter Tibber-Token war erforderlich und kein Zugriff auf das Nutzerkonto wurde durchgeführt. Keine neuen Hintergrundprozesse, Timer oder Abonnements; nur ein kleiner Formular-Snapshot und eine Referenz. Ein echter ioBroker-Datenbankdienst und die Nutzeranlage gehören weiterhin nicht zu dieser lokalen Reproduktion.

Bereits gelöschte Tokens werden nicht automatisch rekonstruiert. Falls erforderlich, nach Installation einmal neu speichern. Auf dem Pi zusätzlich eine andere EMS-Einstellung speichern, Adapter neu starten und Anbieter/Aktivierung/Token-vorhanden kontrollieren. Tokenwerte niemals in Diagnoselogs kopieren. Weitere Feldursachen werden durch den lokalen Nachweis nicht pauschal ausgeschlossen.
