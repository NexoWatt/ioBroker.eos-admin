# NexoWatt EOS 9.0.36 · Update einer Bestandsanlage

## Bestehende Anlage aktualisieren

1. Den aktuellen ioBroker-Stand und die EOS-Konfiguration sichern. Die vorhandene EOS-Instanz aktualisieren und die Altinstanzen mit ihren Datenpunkten und Einstellungen auf der Anlage belassen. Eine bereits deaktivierte `nexowatt-ui.0` kann für die Übernahme deaktiviert bleiben.
2. Im EOS-Admin **Übernahmestatus** öffnen. Alternativ auf dem EOS-Host die schreibgeschützte Abfrage `iobroker state get eos-admin.0.info.legacyMigration` ausführen. Bei einer anderen Instanznummer die Null ersetzen.
3. `TRANSFERRED` bedeutet, dass die Quellen übernommen wurden und EOS den Anlauf prüft. `COMMITTED` bestätigt den erfolgreichen Abschluss dieser Prüfung. `NOT_NEEDED` bedeutet, dass kein automatischer Transfer erforderlich war. Bei einer Sperre zeigt die Übernahmeseite den Grund und die betroffenen Quellinstanzen, soweit deren Inventur möglich war.
4. Unter **Prozesse** die getrennten Angaben zu Prozessnummer, Heartbeat, Betriebsfreigabe und **EMS bereit** kontrollieren. Ein bewusst ausgeschalteter Prozess lässt sich dort mit **Aktivieren** einschalten. Den betrieblichen Zustand der benötigten Module anschließend mit einer frischen Messung und einer freigegebenen Rückmeldung am Gerät prüfen.

## Der konkrete Fehler aus 9.0.34

`BLOCKED / EOS_MIGRATION_DISABLED_UI_REVIEW` bei `nexowatt-ui.0` entstand schon beim Lesen einer deaktivierten alten Oberfläche. 9.0.36 prüft jetzt die vorhandenen Einstellungen, den Zustand der Zielinstanz und die Bestätigung des Controllers. Bei einer unterstützten Quelle, freiem Ziel und bestätigtem Stopp übernimmt EOS die Zuordnungen und behält den bisherigen Namensraum. Der Altprozess bleibt ausgeschaltet. Der Installateur muss die historische Oberfläche dafür nicht noch einmal starten.

Bei einer aktiven kompatiblen Altinstanz überprüft EOS zunächst die gesamte geplante Übernahme. Erst danach fordert es den Stopp der bisherigen Schreiber an. Für eine zuvor abgeschaltete Quelle bleibt die Abschaltung auch bei einem Rückfall erhalten. Eigene bestehende Zielzuordnungen, fehlende Stoppbestätigung, unlesbare Einstellungen oder nicht unterstützte Quellstände erfordern Klärung. Altobjekte, Journale und Freigabe-Datenpunkte in dieser Situation aufbewahren.

## Welche Prozesse bereits laufen

Die Administration, die Oberfläche, das EMS und die freigegebenen Module haben getrennte Aufgaben. Ein laufender Prozess kann auf die Freigabe für seine Hardware warten. Die Prozessübersicht zeigt dann **Läuft · wartet auf Freigabe** mit eigener PID und aktuellem Heartbeat. Unter **Übernahmestatus** steht die betroffene Altinstanz, sofern sie eindeutig ermittelt wurde. Hat der Installateur ein Modul ausdrücklich deaktiviert, kann er es in seinen Einstellungen wieder einschalten. Während ein Altsystem noch für eine Schnittstelle verantwortlich ist, zeigt EOS die Bereitschaft und den Grund an. Die aktivierte OCPP-Schnittstelle darf den Port und die Gerätebefehle erst nach gesicherter Zuständigkeit bedienen. Eine vorhandene eigenständige OCPP-Instanz kann bis zur geplanten Übernahme weiterarbeiten. Eine Gerätestörung und ein noch ausstehender Übergang haben eigene Anzeigen.

Startet die Anlage zunächst ohne gültige EOS-Kernlizenz, bleibt der Zugang zur Aktivierung erreichbar. Nach der ersten erfolgreichen Aktivierung fordert EOS einmalig den regulären Neustart dieser ioBroker-Instanz an. Die Übernahme wird mit den gespeicherten Daten geprüft, bevor die neue Regelung schreiben darf.

## Einen Prozess wieder einschalten

Im **EOS-Admin → Prozesse** die Karte des betreffenden Prozesses öffnen und **Aktivieren** wählen. Derselbe Schalter ist nach einer gespeicherten Pause auch nach dem Neustart der Instanz erreichbar. Das gilt für Oberfläche, EMS, Geräte, EEBUS, Sicherung und OCPP. Zum Einschalten der Oberfläche den direkten EOS-Admin aufrufen, wenn das Dashboard selbst pausiert ist.

Die Prozesskarte zeigt nach erfolgreichem Start die PID und den Heartbeat. Wartet der Prozess auf einen alten Besitzer, zeigt dieselbe Karte zusätzlich den Grund. Das EMS nimmt die Regelung auf, sobald seine eigene Freigabe und die Voraussetzungen für den Betrieb vorliegen. Die Administration läuft als Zugang zur Prozessverwaltung weiter.

## Git, npm und Pilotprüfung

Für Git den Inhalt von `NexoWatt_EOS_9.0.36/iobroker.eos-admin` in den Checkout übernehmen. Für die lokale Pilotinstallation ist das mitgelieferte `iobroker.eos-admin-9.0.36.tgz` vorgesehen. Nach einer eigenen npm-Veröffentlichung zuerst die installierbare Paketdatei prüfen und anschließend den Repositoryeintrag aktualisieren. Der [Ablauf für Git und npm](START_HIER_9.0.35.md) und der [Prüfbericht zu 9.0.36](../reports/unified-9.0.36/PRUEFBERICHT.md) ergänzen die Übergabe.

Am Kundenstand vor und nach dem Update besonders die Speicher- und Zählerzuordnungen, den ausgewählten Tarif, die Ladepunktzuordnung und die Eigentümerschaft des aktiven Gerätezugangs vergleichen. Für einen Rückfall das vorher verwendete Paket samt passender Instanzsicherung bereithalten.
