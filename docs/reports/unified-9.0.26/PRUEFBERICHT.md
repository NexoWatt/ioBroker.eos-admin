# Prüfbericht – NexoWatt EOS 9.0.26

Stand: 25.11.2026. Ein vollständiges Adapterpaket mit getrennten Modulprozessen. Kontrollierter Teststand, keine pauschale Produktionsfreigabe oder Zuverlässigkeitsgarantie.

## Ergebnis und Nutzerbefund

Die gemeldete Aktivierungssackgasse ist reproduziert und korrigiert: Ein gespeichertes „Prozess an“ bei „Modul aus“ ließ bisher keinen wirksamen Aktivierungsschritt zu. Die Aktion aktiviert nun beide Freigaben mit bestehender Konfiguration, wartet den tatsächlichen Commit ab und bestätigt anschließend den Prozessstart. Abschalten bleibt dauerhaft gespeichert; unbestätigter Stopp, Lizenz- oder Eigentumsprobleme bleiben wirksame Sperren.

Ein zweiter reproduzierbarer Fehler lag im Veröffentlichungsweg: Die Git-Regel `**/build` entfernte beim normalen Git-Staging die kompilierten Laufzeiten von EEBUS, OCPP und Sicherung. Das vollständige 9.0.25-TGZ ließ sich dagegen sauber installieren. Ein frisch aus Git exportierter 9.0.25-Stand erzeugte für alle drei Module `Cannot find module './build/index.js'`, während Devices geladen wurde. Die korrigierten Ausnahmen erhalten alle 48 benötigten Modul-Builddateien einschließlich des SD-Kartentreibers der Sicherung. Nicht ausgelieferte Buildordner, Abhängigkeiten und temporäre UI-Spiegel bleiben ausgeschlossen.

Auch das tatsächlich auf npm veröffentlichte 9.0.25-Paket wurde heruntergeladen: Alle 3186 entpackten Dateien stimmen bytegleich mit der vorherigen Lieferung überein. Der unterschiedliche TGZ-Containerhash ist kein Unterschied der Paketdateien. Der Nutzer bestätigte anschließend, dass über npm EEBUS, Sicherung und auch OCPP laufen. Das ist eine Nutzerrückmeldung, kein von hier ausgeführter Geräte- oder Steuerungstest. Die genaue vorübergehende OCPP-Installationsursache auf dem Pi wurde nicht nachgewiesen.

Die abschließende Prüfung eines wirklich frischen Git-Exports fand zusätzlich 36 von derselben allgemeinen Build-Regel ausgeschlossene Dateien unter `src/lib/vendor/webserver/build/`. Die Laufzeitinstallation funktionierte bereits, die Herkunftsprüfung vor Veröffentlichung scheiterte jedoch mit `VENDORED_SOURCE_UNAVAILABLE`. Zwei weitere exakt begrenzte Git-Ausnahmen korrigieren dies. Der abschließende Git-Test vergleicht nun zusätzlich das komplette versiegelte Inventar mit einem frischen Git-Index; es bleibt keine ausgelassene versiegelte Datei. Diese reine Lieferkorrektur wurde nach dem vollständigen Laufzeittest vorgenommen und auf beiden Node-Linien mit jeweils zwei Git-Tests geprüft. Laufzeitcode blieb dabei unverändert; Belege unter `raw/git-vendor-source/`.

## Weitere Änderungen

- Beim Löschen von Ladepunkten wurden zwei unabhängige Ursachen reproduziert: Die EMS-Konfigurationsantwort konnte einen neueren Inhalt mit einem älteren Versionskennzeichen kombinieren; außerdem verhinderte ein Schutz gegen versehentlich leere Listen auch die bewusste letzte Löschung. Ein atomarer Antwortsnapshot, eine ausdrückliche Löschaktion und die passende UI-Sperre während des Ladens korrigieren diese Wege. Echte gleichzeitige Fremdänderungen bleiben geschützt. Verwaiste OCPP-Datenpunkte ohne vorhandene Adapterinstanz werden nicht erneut automatisch übernommen. Einzelheiten und Testgrenzen stehen in `OCPP_DELETION_REVIEW.md` und `EVCS_DELETE_UI_REVIEW.md`.
- Bei geänderter Ladepunktreihenfolge werden bestehende Bedienwerte anhand ihrer Gerätezuordnung übernommen. Ein bestätigtes Register und ein begrenztes Wiederaufnahmejournal verhindern, dass ein Teilfehler eine neue Regelung mit unvollständig kopierten Werten startet. Angenommene Befehle werden vor dem Wechsel abgeschlossen; spätere veraltete Browserbefehle werden über die dargestellte Ladepunktidentität abgewiesen. Bestehende Stationsberechtigungen werden im selben Konfigurationscommit umgeordnet; entfernte Stationen erhalten keinen Zugriff auf nachgerückte Geräte. Interne Standard-Modusverweise folgen dem zugehörigen Ladepunkt. Details: `EVCS_IDENTITY_REVIEW.md` und `CHARGING_CLIENT_REVIEW.md`.
- Der Tibber-Neustarttest umfasst einen echten UI-Kindprozess, bestätigtes Speichern über den Elternprozess und einen neuen Owner mit erneut gelesenen gespeicherten Zuständen. Dabei wurde eine Startphase reproduziert, in der die API vor Konfigurationshydration einen scheinbar erfolgreich geladenen manuellen Standardtarif lieferte. Der gespeicherte Tibber-Tarif samt synthetischem Zugangsschlüssel war in diesem Fall unverändert. Tarif-Lesen und -Speichern warten nun auf erfolgreiche Hydration; die Oberfläche wiederholt ausschließlich initiale Leseversuche begrenzt und erhält Benutzerentwürfe. Dieser Nachweis belegt den konkreten Fehlerpfad und ersetzt keine Untersuchung der historischen Pi-Datenbank. Details stehen in `TARIFF_STARTUP.md`.
- Eine langsame Modul-Factory konnte die kurzfristige Betriebsfreigabe vor dem eigentlichen Start ablaufen lassen. Der Worker bestätigt jetzt zunächst die Konstruktion; danach sendet der Parent eine aktuelle Freigabe und startet das Modul innerhalb des unveränderten Gesamtzeitbudgets. Widerruf, Stopp und Zeitüberschreitung werden weiter wirksam geprüft.
- Fehlende Abhängigkeiten werden mit einem begrenzten Diagnosecode angezeigt. Permanente Paket-/Initialisierungsfehler erzeugen keine automatischen Neustartschleifen. Ein ausdrücklicher Start lädt auch einen zuvor fehlgeschlagenen Konfigurationsimport erneut. Normale Statusabfragen wiederholen ihn nicht.
- Bei fehlender neuer Konfiguration sind die integrierten Modul- und Prozessfreigaben an. Bestehendes ausdrücklich gespeichertes Aus bleibt erhalten. Der neue Sicherungsprozess erhält keinen ungefragten Sicherungszeitplan.
- Die erweiterten Sicherungseinstellungen werden nach Sicherungsteilen und Speicherzielen geordnet und über Einstellungsdialoge bearbeitet. Unabhängige Aktivierungen, Entwurf/Abbrechen, bestehende Konfiguration und geschützte Speicherung werden gezielt geprüft; Details und Feldzuordnung stehen in `BACKUP_UI.md`.
- Das unveränderte NexoWatt-Logo wird auch an den üblichen Apple-Rootadressen unabhängig vom UI-Prozess ausgeliefert. Vorher reproduzierbare 503-Antworten bei pausierter UI sind korrigiert. Bedingte PNG-Anfragen liefern 304 ohne erneute Bilddaten.
- Die Anmeldung bietet die öffentliche HTTPS-Einrichtung mit Download einer bereits validierten Stamm-CA. Private Schlüssel und Verwaltungsdaten bleiben geschützt. iOS-Profilinstallation und Vertrauensfreigabe bleiben Benutzeraktionen; es gibt keine automatische CA-Erzeugung, Zertifikatsrotation oder Umgehung der TLS-Prüfung.

## Prüfungen des Quellen- und Buildstands

| Prüfung | Ergebnis |
| --- | --- |
| Vollständiges `npm test`, Node 22.23.4 | 2636 Tests, 2634 bestanden, 2 ausgelassen, 0 Fehler |
| Vollständiges `npm test`, Node 24.22.3 | 2636 Tests, 2634 bestanden, 2 ausgelassen, 0 Fehler |
| TypeScript-Prüfung und Lint | Bestanden; eine bestehende JSDoc-Warnung in `eosUnifiedBoundary.js` |
| Frontend, Installer, Backend, UI-Laufzeit, Module | Neu gebaut; Buildprotokolle beigefügt |
| Prozessbedienung im Chromium-Browser | Je Node 14 Prüfgruppen bestanden; keine PageErrors |
| HTTPS-/App-Einrichtung im Chromium-Browser | Je Node 4 Prüfgruppen bestanden, einschließlich echtem DER-Download |
| Sicherungsdialoge im Browser | Tatsächliche Ergebnisse und Quellhashes unter `raw/backup-ui/`; siehe `BACKUP_UI.md` |
| Ladepunkt-Löschung im Browser | Einzelne und letzte Löschung, echter Konflikt, Lade-/Speicherrennen und Neustartübernahme; Rohbelege unter `raw/evcs-delete/` |
| Tibber im Prozess- und Browser-Neustarttest | Bestanden, einschließlich zusätzlicher Tarifänderung bei unverändert fehlerhafter Ladepunktkonfiguration; je Node 6 Browsergruppen. Tatsächlicher Prozesswechsel mit synthetischen Controllerdaten, kein Tibber-Cloudabruf |
| Frischer Git-Index und Git-Archiv | Kompilierte Laufzeiten erhalten; isolierter Import des exportierten SD-Kartentreibers geprüft |
| Unabhängiger Review | Aktivierung, Wiederanlauf, öffentliche Zertifikatsausgabe und Git-Auslieferung geprüft; Ergebnisse und Snapshotgrenzen in `INDEPENDENT_REVIEW.md` |

Die zwei ausgelassenen Fälle betreffen in dieser Umgebung nicht verfügbare nginx- beziehungsweise POSIX-ACL-Werkzeuge. Alle weiteren optionalen Quellen wurden ausdrücklich bereitgestellt: geprüfter Keygen 1.0.4, isolierte echte InfluxDB 2.10.1 und Standalone-OCPP 0.4.3. Die Summen stammen aus den fünf echten Node-Testzusammenfassungen je vollständigem Lauf; Rohprotokolle, Versionen und Hashes stehen in `raw/INDEX.json`.

Frühe Läufe deckten zusätzlich veraltete Testannahmen über standardmäßig ausgeschaltete Module auf. Die betroffenen isolierten Import-/Migrationsfixtures nennen ihren ausgeschalteten Zielzustand jetzt ausdrücklich; Lizenz-, Eigentums-, Import- und Stopprüfungen wurden dafür nicht abgeschwächt. Die endgültigen Läufe sind getrennt von Zwischenständen gekennzeichnet.

Ein bestehender Geräte-Inbetriebnahmetest war außerdem vom Zeitpunkt des ersten Regelzyklus abhängig: Er verbot sämtliche Stellschreibvorgänge, obwohl das bereits vorhandene Sollverhalten bei fehlenden Speichermesswerten eine Sicherheitsnullung vorsieht. Die Reproduktion unter beiden Node-Linien zeigte ausschließlich diese 0-W-Schreibvorgänge. Der Test wartet nun auf den tatsächlichen Regelzyklus und erlaubt ausschließlich numerische Nullwerte an den zwei erwarteten Sollwert-Datenpunkten; andere Ziele oder Leistungswerte bleiben verboten. Die Produktregelung wurde dafür nicht verändert.

## Prüfung des endgültigen Lieferpakets

Nach Versiegelung und regulärem `npm pack` werden die tatsächlichen Paketbytes separat geprüft. Die Ergebnisse liegen außerhalb des versiegelten Quellenordners in `INSTALLED_PACKAGE_TEST.json` und `PUBLISH_DRYRUN.json`; `PACKAGING_VERIFICATION.json` bindet sie an das ausgelieferte TGZ. Die Verpackung akzeptiert nur erfolgreiche Prüfungen beider Node-Linien mit passender TGZ-Prüfsumme.

Die Paketprüfung verwendet frische Produktionsabhängigkeiten mit aktivierten Installationsskripten, gesperrtem globalem Modulsuchpfad und echte Kindprozesse. Die ioBroker-Datenbank, Lizenz- und Authentifizierungsbereitstellung sind kontrollierte Fixtures. OCPP 1.6, 2.0.1 und 2.1 werden über Loopback geprüft. Zusätzlich wird der Git-Export separat geprüft. Das ersetzt keinen vollständigen ioBroker-Controller- oder Hardwaretest.

Die Publish-Probeläufe verwenden normale `prepack`/`prepublishOnly`-Prüfungen auf Node 22 und 24, einschließlich historischer unveränderter 9.0.21-Dateireste und des unmittelbar vorherigen Lieferstands. Es findet keine Veröffentlichung statt. Bekannte Reste werden gesichert bereinigt, unbekannte oder veränderte Dateien nicht gelöscht.

## Ressourcen und erhaltenes Verhalten

Im synthetischen Vorher-/Nachher-Vergleich verursachten 459 externe Alive-Ereignisse beim ausgeschalteten internen OCPP zuvor 459 Generationserhöhungen, jetzt 0. 459 irrelevante Objektänderungen verursachten zuvor 459 Reconcile-Aufrufe, jetzt 0. Es entstanden in beiden Vergleichsfällen keine Kindprozesse. Dies belegt vermiedene Ereignisarbeit, keine gemessene Raspberry-Pi-RAM-Ersparnis. Die Rohmessungen und Grenzen stehen in `LIFECYCLE_REVIEW.md` und `raw/lifecycle/`.

Die Änderungen fügen keinen weiteren Dauerprozess hinzu. Die bestehenden Grenzen für IPC, Warteschlangen, Zeitüberschreitungen und exponentielle Wiederanläufe bleiben erhalten. Die Energieflussanzeige bleibt bei fünf Sekunden; Regelintervalle und bestehende Stelllogiken werden dadurch nicht verlängert. Tarifanbieter, Zugangsdaten, Preisformeln, Geräteprofile, bekannte Namensräume und ausdrücklich gespeicherte Null-/Aus-Werte bleiben erhalten. Die bestehenden Tarif- und Messwertregressionen sind Bestandteil der Gesamttests.

## Offene Grenzen

- Raspberry Pi/ARM64, Dauerbetrieb, tatsächliche Ladepause und Wiederanlauf an der Dousida-Wallbox sowie physische EEBUS-/Geräteschnittstellen wurden hier nicht getestet. Die gemeldeten etwa 1056–1087 MB bezogen sich auf 9.0.21; eine vergleichbare RAM-Messung dieses Standes liegt nicht vor.
- Der vollständige ioBroker-Controller-Test wurde bereits beim unveränderten 9.0.25-Versuch vor EOS-Start durch `os.networkInterfaces()` / `uv_interface_addresses` in dieser Ausführungsumgebung blockiert. Für 9.0.26 wird daraus kein bestandener Controller-Test abgeleitet. Die tatsächlichen Modulprozesse und ihre Netzwerkpfade werden separat geprüft.
- iPhone-Profilimport, Zertifikatsvertrauen, passende lokale/VPN-Adressen im Zertifikat und Home-Screen-Vorschau bleiben auf der Anlage zu prüfen. Ein korrekt geliefertes PNG beweist nicht automatisch eine korrigierte iOS-Verknüpfung.
- `EOS_BACKUP_SOURCE_PATH` schützt vor unzulässigen Quell- oder lokalen Zielpfaden. Der Screenshot benennt nicht den konkreten Pfad. Ein laufendes Sicherungsmodul bestätigt noch keinen erfolgreichen Sicherungslauf; fehlende Einbindung der aktiven Historie verhindert weiterhin eine als vollständig geltende Gesamtsicherung.
- Der aktuelle Produktionsabhängigkeits-Audit meldet 2 moderate Einträge (AJV und dessen OCPP-RPC-Abhängigkeit), 0 hohe und 0 kritische. Keine Abhängigkeiten wurden ungeprüft ausgetauscht. Der bestehende Einsatz-/Advisory-Befund bleibt dokumentiert; dies ist keine Aussage, dass das Gesamtsystem frei von Schwachstellen ist.

Prüfsummen belegen Dateiintegrität, keine digitale Signatur, Zertifizierung oder Garantie. Die Anleitung `START_HIER_9.0.26.md` beschreibt den bisherigen Git-/npm-Weg und die Kontrolle nach Installation.
