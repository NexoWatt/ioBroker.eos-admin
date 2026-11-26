# NexoWatt EOS 9.0.28 – SmartHome-Geräteerkennung und Zuordnung

Ausgangspunkt ist der aufgeräumte Git-Lieferstand von 9.0.27. Die Änderung betrifft die Erkennung und Zuordnung im SmartHome-Installer. Der technische Paketname `iobroker.eos-admin` und die Instanz `eos-admin` bleiben die Grundlage für Updates.

## Änderungsumfang und Sollverhalten

| Bereich | Erwartetes Verhalten |
| --- | --- |
| Funktionsordner | Treffer lassen sich nach Funktion durchsuchen. Ein Gerät kann über mehrere passende Ordner gefunden werden. Auswahl und Übernahme verwenden die gleiche Geräteidentität. |
| Suchbegriffe | Deutsche und englische Bezeichnungen erleichtern die Suche. Rolle, Typ, Lese- und Schreibbarkeit, Einheit, Bereich und Gerätekontext entscheiden über die Eignung einer Zuordnung. |
| Befehl und Rückmeldung | Die Zuordnung berücksichtigt die Richtung des gewählten Profilfelds. Eine Rückmeldung ist von einem Schreibbefehl getrennt und kann auch ohne zugeordneten Befehl genutzt werden. |
| Mehrdeutige Quellen | Ähnliche Namen, gemeinsame Prozentwerte oder zwei benachbarte KNX-Gruppenadressen belegen für sich keine Gerätebeziehung. Unsichere Treffer brauchen eine bewusste Prüfung. |
| Bestandsdaten | Räume, gespeicherte Zuordnungen, Aliase und die bestehenden Speicher- und Freigabewege sind bei der Regression zu prüfen. |

## Berechtigungen und Betriebsgrenzen

Die Zuordnung bleibt in der geschützten Einrichtung. Eine Vorschlagsgruppe oder ein Suchbegriff ist keine neue Berechtigung für Gerätebefehle. Die Detektion nutzt vorhandene Objektinformationen. Die Einrichtungsansicht sendet während der Suche keine Testtelegramme an Geräte.

Die Einordnung gilt für die im konkreten Adapterbaum verfügbaren Metadaten. Physische Richtung, Wertebereich und das Zusammenspiel getrennter KNX-Gruppenadressen müssen bei der Inbetriebnahme nachgewiesen werden.

## Softwareprüfungen

| Prüfung | Ergebnis |
| --- | --- |
| Vollständiges `npm test` unter Node.js 22 | v22.23.4, 2723 erfasst, 2721 bestanden, 2 ausgelassen |
| Vollständiges `npm test` unter Node.js 24 | v24.22.3, 2723 erfasst, 2721 bestanden, 2 ausgelassen |
| Typprüfung, Lint und Builds | Bestanden |
| Paketprüfung | Nachweise am fertigen Paket unter `docs/Liefernachweise/` in der ZIP |
| Physische KNX-/Homematic-Geräte am Zielsystem | Offen |

Die Softwareläufe verwenden isolierte Objekt-, Controller- und Gerätefixtures. Der [Anlagen-Prüfablauf](../../start/START_HIER_9.0.28.md#aktualisieren-und-prüfen) ergänzt die Softwareergebnisse.


## Technische Grenzen dieser Änderung

Schlagwörter erweitern die Typenerkennung mit denselben lokalen Objektmetadaten. Aus einem Namen allein entsteht kein neuer Schreibbefehl. Ergänzende Schlagworttreffer sind pro Scan auf 512 begrenzt. Bei Erreichen der Grenze verweist die Anzeige auf die manuelle Datenpunktauswahl. Die vorhandenen Grenzen des gesamten Scans bleiben erhalten.

Die Suiten liefen unter Linux x86_64 mit dem normalen Arbeitskonto. Ausgelassen wurden der nginx-Test und die POSIX-ACL-Prüfung wegen fehlender Werkzeuge. Die DOM-Tests führen die Erkennungs- und Auswahlfunktionen in einem Test-DOM aus. Visuelle Prüfung im Browser und Betrieb mit physischen KNX- und Homematic-Geräten sind separat offen.

Die Abhängigkeiten wurden beibehalten. Der Produktionsscan meldet wie zuvor zwei moderate Einträge zu AJV im OCPP-Abhängigkeitsbaum, ohne hohe oder kritische Einträge. Ergebnisse und SBOMs liegen in den Nachweisen. Die [Entwicklungsrichtung zu Microservices](../../unified/ARCHITECTURE.md#entwicklungsrichtung-zu-microservices) ist als Architekturentscheidung dokumentiert.
