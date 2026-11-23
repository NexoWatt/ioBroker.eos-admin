# NexoWatt EOS 9.0.10 – SmartHome-Geräte und Alias-Zuordnung

Diese Lieferung ist ein Integrations-Teststand. Sie erweitert die vorhandene EOS-Instanz;
Anmeldung, zentrale Systemlizenz und Port 8188 bleiben erhalten. Es wird keine zweite
Lizenz für SmartHome benötigt. ioBroker Admin auf 8081 bleibt getrennt erreichbar.

## Einrichtung

1. Vor dem Update eine aktuelle Sicherung anlegen. Den bisherigen Repo-/Paketstand für
   einen Rückfall aufbewahren. Kundenanlagen erst nach eigener Anlagenabnahme aktualisieren.
2. Das Repository-ZIP enthält den vollständigen Quell- und Buildstand. Das TGZ ist das
   installierbare npm-Paket. Beide sind zur manuellen Prüfung/Verteilung bereitgestellt;
   diese Lieferung veröffentlicht nichts in GitHub oder npm. Das ZIP in ein leeres
   Verzeichnis entpacken. Beim bloßen Überkopieren über 9.0.9 können drei alte
   Admin-Bundles zurückbleiben; das Integritätsgate weist diesen Mischstand ab.
   Für die laufende Instanz den regulären Paket-Updateweg verwenden.
3. Die vorhandene `eos-admin.0`-Instanz aktualisieren. Keine zweite Instanz neben einer
   aktiven EOS-Regelung anlegen. Danach EOS im Browser neu laden, damit die neuen lokalen
   Bedienmodule verwendet werden.
4. Unter SmartHome-Konfiguration die Gebäude-/Raumstruktur prüfen. Bei der automatischen
   Erkennung Geräte auswählen, Zuordnung kontrollieren und dem Raum zuweisen. Unklare
   oder fehlende Datenpunkte lassen sich im Geräteprofil manuell ergänzen.
5. Die aktivierte Alias-Option erzeugt beim ausdrücklichen Übernehmen verknüpfte
   `alias.0.nexowatt_eos.*`-Objekte. Vorhandene geeignete Alias-Datenpunkte werden
   weiterverwendet. **Die Erkennung allein erzeugt keine Objekte und schaltet keine Geräte.**
6. Den Konfigurationsentwurf speichern. Reihenfolge, Räume, Profile und Alias-Zuordnungen
   gehören zur gespeicherten EOS-Konfiguration. Danach die tatsächliche Bedienung und
   Rückmeldung der angeschlossenen Geräte prüfen.

## Neue Konfigurationsansicht

Die SmartHome-Einrichtung nutzt die verfügbare Fensterbreite. Die drei Arbeitsbereiche
**Gebäude & Räume**, **Geräte & Datenpunkte** und **Darstellung & Anordnung** trennen
Struktur, technische Zuordnung und Kachelpositionen. Aktivierung und seltene Details
sind aufklappbar. Auf schmalen Displays werden die Bereiche untereinander angeordnet.

Unter **Darstellung & Anordnung** den Raum wählen, Kacheln ziehen oder über die
Positionsauswahl verschieben beziehungsweise mit einer anderen Kachel tauschen.
Die Tastaturbedienung ist zusätzlich verfügbar. Änderungen gelten zunächst nur im
Entwurf; erst **Speichern** übernimmt sie dauerhaft. Datenpunkte und Raumzuordnung
werden beim Sortieren innerhalb des Raums nicht geändert.

## Bedienung und Bestand

Die unterstützten eingebauten Gerätearten der beigefügten ioBroker.devices-4.4.0-Referenz
bilden den Maßstab für die Bedienfunktionen. EOS verwendet eigene lokale Oberflächen,
serverseitig geprüfte Zuordnungen und ein gemeinsames Rechte-/Lizenzmodell. Die
TypeDetector-Bibliothek wurde von 5.0.10 auf 6.2.0 angeglichen.

Bestehende Geräte bleiben erhalten. Neue vollständige Profile ergänzen einzelne
Fähigkeiten; manuell korrigierte Felder und Räume werden beim erneuten Erkennen nicht
stillschweigend überschrieben. Ein Profilwechsel mit entfallenden Zuordnungen erfordert
eine bewusste Übernahme im Editor. Ein Geräte-Austausch kann über unveränderte Alias-IDs
mit neu zugeordneten Zielen vorbereitet werden; diese Version überschreibt vorhandene
Alias-Ziele nicht automatisch.

Befehlsrückmeldungen unterscheiden die Übergabe an den Adapter von der tatsächlichen
Geräterückmeldung. Fehlende Werte werden als unbekannt angezeigt. Türöffnen/-entriegeln
hat eine ausdrückliche Bestätigung. Zugeordnete Schutzmeldungen der Beschattung werden
auch in den erhaltenen EOS-Bedienwegen berücksichtigt; Stop bleibt separat ausführbar.

## Umfang und Grenzen

- Gerätebedienung: Licht/Farben, Beschattung, Tor/Schloss, Klima/Lüfter/Pumpe,
  Medien/TV, Saugroboter, Kamera-Funktionen und die unterstützten Sensor-/Statusgruppen.
- Zusätzliche lokale Ansichten: Uhr, Messinstrument, Wind, Anwesenheit, Markdown,
  Webansicht, Universalansicht, Energiefluss, Wetterdaten und Zeilenumbruch.
- Verläufe nutzen eine bereits konfigurierte History-Quelle. Das Anlegen einer Kachel
  aktiviert keine neue Aufzeichnung und installiert keinen History-Adapter.
- Drittanbieter-Widget-Plugins, externe Wetter-/Kartenanbieter und deren Cloudkonten
  werden nicht automatisch geladen oder eingebunden. Dies ist keine Übernahme des
  vollständigen fremden Adapters oder seiner Konfigurationsoberfläche.
- Der zusätzliche Detector-Typ `chart` wird auch von der Referenzoberfläche nicht als
  eingebautes Bediengerät angeboten. Messwert-Verläufe und explizite Webansichten sind
  getrennte Funktionen.
- Tatsächliche Prüfungen und offene Hardware-/Browserprüfungen stehen im
  [Prüfbericht](docs/reports/unified-9.0.10/PRUEFBERICHT.md). Keine pauschale
  Fehlerfreiheits-, RAM-Einsparungs- oder CRA-Konformitätszusage.

## Lizenz und Rückfall

Die NexoWatt-Anteile bleiben proprietär. Vorhandene Drittanbieter-Lizenzen und Hinweise
bleiben im Paket erhalten, einschließlich der MIT-Hinweise für die Referenz und der
lokal gebündelten Markdown-Abhängigkeiten. Hersteller-Privatschlüssel oder Tresore
gehören nicht in dieses Repository.

Bei einem Rückfall den gesicherten Paket- und Konfigurationsstand gemeinsam verwenden.
Neu angelegte Aliase werden bei Fehlern nicht automatisch gelöscht. Teilfehler werden
angezeigt; eine erneute ausdrückliche Anlage prüft vorhandene Objekte auf identische
Eigentümerschaft und Verknüpfung. Fremde oder anders verknüpfte Objekte werden abgewiesen.
