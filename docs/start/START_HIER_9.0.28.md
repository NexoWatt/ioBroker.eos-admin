# NexoWatt EOS 9.0.28

Teststand für die Funktionsordner der SmartHome-Erkennung, die Suche auf Deutsch und Englisch und die Auswahl passender Datenpunkte. Eine bestehende Instanz wird als `eos-admin` weitergeführt. Die Mindestversionen stehen in der [README](../../README.md).

## Aktualisieren und prüfen

1. Die Anlage sichern und den vorherigen getesteten Stand für den Rückfall bereithalten.
2. Das geprüfte `iobroker.eos-admin`-Paket installieren oder die bestehende Instanz aktualisieren. Prüfen, ob EOS, UI/EMS und eingerichtete Module bereit sind.
3. Mit der bisherigen Einrichtungsberechtigung **SmartHome → Einrichtung → Geräteerkennung** öffnen. Die Funktionsordner aufklappen und z. B. nach „Licht“, „switch“, „Jalousie“, „blind“, „Dimmwert“ oder „brightness“ suchen.
4. Ein bereits bekanntes Gerät aus KNX oder Homematic öffnen. Je nach Gerät Befehl, Rückmeldung und Messwert getrennt prüfen. Bei einer Jalousie sind zum Beispiel Fahrbefehle, Soll- und Istposition sowie der Lamellenwinkel unterschiedliche Funktionen.
5. Bei einer manuellen Zuordnung direkt vom Profilfeld in die Datenpunktauswahl wechseln. Die Herkunft und Eigenschaften des Vorschlags prüfen. Bei unklarem Wertebereich oder unklarer Wirkrichtung die betreffende Funktion erst nach der Klärung zuordnen.
6. Ein Gerät auswählen und wie gewohnt dem Zielraum zuordnen. Bei weiteren passenden Funktionsordnern kontrollieren, dass es nur einmal markiert und übernommen wird. Bestehende Geräte, Datenpunkte und Räume nach Neuladen kontrollieren.

Prüfe auf der Zielanlage zunächst die angezeigte Rückmeldung. Führe einen Bedienbefehl erst aus, wenn Funktion, Richtung und Wertebereich bestätigt sind. Besonders wichtig ist das bei Jalousien, Rollläden und getrennten KNX-Gruppenadressen. Die Erkennung selbst dient der Auswahl und löst keinen Testbefehl aus.

## Git und npm

Den vollständigen Ordner `iobroker.eos-admin` aus der ZIP übernehmen und eigene Änderungen vergleichen. Wer von einer älteren Ordnerstruktur kommt, findet verschobene Dokumente in der [Pfadliste](../UMSORTIERTE_DATEIEN.tsv). `node_modules` gehört nicht in Git.

Mit `npm pack --dry-run` prüfst du den Paketinhalt lokal. Den Repo-Eintrag `nexowatt-eos-admin-repository-entry-v9-0-28.json` erst dann als Updatequelle einsetzen, wenn das dort referenzierte Paket verfügbar ist. Die [Prüfergebnisse und offenen Anlagenprüfungen](../reports/unified-9.0.28/PRUEFBERICHT.md) gehören zu dieser Version.
