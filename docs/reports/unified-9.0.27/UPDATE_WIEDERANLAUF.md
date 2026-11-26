# EOS: Update und Wiederanlauf

Prüfdatum: 26.11.2026. Ausgangsstand: ausgeliefertes und über npm veröffentlichtes EOS 9.0.26. Der Softwarestand 9.0.27 wurde wie im Prüfbericht dokumentiert geprüft; eine Anlagen- oder allgemeine Produktionsfreigabe wird daraus nicht abgeleitet.

## Nutzerbeobachtung

Nach dem npm-404 beim Update von 9.0.25 auf 9.0.26 und einem erneuten Update blieb eos-admin.0 gestoppt. Dominique bestätigte: Nach einem manuellen Instanzstart läuft alles. Das unterscheidet den Vorfall von einem ausgefallenen Kindprozess. Die aktive Repository-Konfiguration und das vollständige Controllerprotokoll der Anlage liegen nicht vor.

## Paketprüfung

Das öffentliche npm-Archiv 9.0.26 wurde vollständig heruntergeladen, gegen die npm-SHA1 geprüft und dateiweise mit dem zuvor ausgelieferten vollständigen Quellpaket verglichen: alle 3.352 Dateien bytegleich, keine fehlenden oder abweichenden Dateien. Die gzip-Archive selbst haben unterschiedliche Hashes; ihre enthaltenen Dateien sind identisch.

## EOS-UPD-927-01: deaktivierte Instanz nach fehlgeschlagenem Controllerupdate

Mit den unveränderten veröffentlichten Upgrade-/Install-Klassen aus @iobroker/js-controller-cli 7.2.5 wurden vier Fälle geprüft. Datenbank, npm, Dateisystem und Upload-Grenze sind Testdoubles; dies ist kein vollständiger Controllerlauf und kein Pi-Test.

| Fall | Tatsächliches Ergebnis |
| --- | --- |
| Downloadfehler ohne stopBeforeUpdate | Aktivierung bleibt erhalten |
| Downloadfehler mit stopBeforeUpdate, danach erfolgreicher neuer Versuch | Instanz bleibt deaktiviert |
| Direkt erfolgreicher Lauf mit stopBeforeUpdate | Instanz wird wieder aktiviert |
| Vorher bewusst deaktivierte Instanz | Bleibt deaktiviert |

Der Controller merkt sich beim ersten Lauf aktivierte Instanzen nur für diesen Lauf. Bei npm-Abbruch (Exit 25) erreicht er die Reaktivierung nicht. Der neue Versuch erkennt die inzwischen deaktivierte Instanz nicht als wieder zu startende Instanz. Das passt zur Nutzerbeobachtung; der tatsächlich wirksame stopBeforeUpdate-Wert und damit die eindeutige Feldursache sind nicht dokumentiert.

Der EOS-Adapter kann sich nicht selbst ausführen, während ioBroker ihn deaktiviert hält. Deshalb wurden keine pauschale Selbstaktivierung, kein zusätzlicher Dauerdienst und kein Überschreiben bewusst deaktivierter Instanzen eingebaut. Die ioBroker-Installation auf dem Pi wurde nicht geändert.

Primärquellen: veröffentlichte npm-Pakete iobroker.js-controller@7.2.5, @iobroker/js-controller-cli@7.2.5 und @iobroker/db-objects-redis@7.2.5. Der Git-Tag ist in Details nicht mit den veröffentlichten Paketen identisch; der Nachweis verwendet deshalb die Pakete.

## EOS-UPD-927-02: widersprüchliche Hilfsskripte

Die Paketmetadaten verlangen stopBeforeUpdate=true, während ältere Repository-Generator-/Patchwerkzeuge false ausgaben und ein Reparaturskript false setzte. Diese Werkzeuge übernehmen jetzt die Paketvorgabe und das aktuelle Controllerprofil. Das Reparaturskript nutzt feste Argumente, meldet Fehler und bricht beim ersten Fehler ab. Es aktiviert oder startet keine Instanz. Ein laufendes System während des Austauschs seines Programmcodes weiterlaufen zu lassen ist kein Ersatz für einen korrekten Wiederanlauf.

## EOS-START-927-01: unabhängiger Fehler beim Modulstart

EosModuleHost hielt eine abgelehnte Start-Promise fest. Nach einem vorübergehenden Subscriptionfehler konnte derselbe Host nicht erneut initialisieren. Korrektur: begrenzte Wiederholungen, Wiederverwendung bestätigter und noch ausstehender Subscriptions, Freigabe endgültig fehlgeschlagener Initialisierung für einen späteren ausdrücklichen Start. Stop beendet Retry-Wartezeiten und verhindert einen verspäteten Modulstart.

Höchstens acht Startup-Subscriptioneinträge und eine Retry-Wartezeit gleichzeitig; pro Subscription maximal drei Warteversuche mit bestehendem Fünf-Sekunden-Budget und 1/2 Sekunden Abstand. Kein zusätzlicher dauerhafter Abfragezyklus, keine veränderten EMS-Regelzeiten. Eine RAM-Einsparung auf dem Pi wurde nicht gemessen. Dieser Fehler erklärt nicht die deaktivierte Hauptinstanz des Nutzers.

## EOS-eigener Updateweg

Der bestehende EOS-Updateweg lädt und prüft das Paket vor dem Start des getrennten Wartungsprozesses. Ein neuer Regressionstest simuliert vorhandene Versionsmetadaten mit noch fehlendem Tarball: keine Stop-/Installationsmöglichkeit und kein Wartungsprozess; nach erfolgreichem erneuten Download ist weiterhin ein ausdrücklicher Start erforderlich. Der bestehende Worker prüft Paketdateien, startet die vorher aktivierte eigene Instanz und wartet auf ihre Alive-Meldung. Ein Alive-State ist noch kein Hardware- oder vollständiger EMS-Bereitschaftsnachweis. Bei unklarer Teilinstallation wird nicht blind gestartet.

## Abnahme und Grenzen

Die abschließenden Testergebnisse und Hashes stehen im übergeordneten Prüfbericht und im raw-Verzeichnis. Baseline und Änderungstests sind getrennt gekennzeichnet. Ein echter ioBroker-Updatezyklus auf dem Raspberry Pi, Stromausfall während Installation und Wiederanlauf sämtlicher physischer Geräte bleiben offen. Am bereits wieder laufenden System ist allein wegen dieses Berichts keine Neuinstallation nötig.
