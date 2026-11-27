# Bestandsübernahme in NexoWatt EOS 9.0.7

Die aktuelle Bedienung und die Kompatibilitätsprüfung für UI und Devices beschreibt die [Anleitung zu 9.0.38](../start/START_HIER_9.0.38.md). Die folgende Dokumentation hält den ursprünglichen Ablauf von 9.0.7 und seine Ergänzungen fest.

Stand: 23.11.2026. Geltungsbereich: automatische Übernahme von Konfiguration und Zuständigkeit in derselben ioBroker-Installation. Der Ablauf ersetzt weder eine rücksicherbare Gesamtsicherung noch die Abnahme an den Geräten der Anlage. Eine unterbrechungsfreie oder für jede beliebige Kundenversion vollständige Migration wird nicht behauptet.

## Erhaltene Daten

Die automatische Übernahme hält die bisherigen Datenpunkt-Namespaces fest: `nexowatt-ui.N.*`, `nexowatt-devices.N.*`, `eebus.N.*` und `nexowatt-backup.N.*`. Das integrierte Modul liest und schreibt die vorhandenen IDs weiter. Objekte, Datentypen, Einheiten, History-/Custom-Konfiguration, Aliase, vollständige Datenpunktverweise und die ursprünglichen Zustände bleiben in der Datenbank. Es werden keine alten Befehlszustände kopiert oder als neue Schaltbefehle wiederholt. UI-Dateien wie Partnerjournale werden weiterhin aus dem bisherigen UI-Instanzverzeichnis gelesen.

Native Einstellungen werden in eigenständige, mit dem ioBroker-Installationsschlüssel verschlüsselte Konfigurationsobjekte mit Admin-ACL 0x600 übernommen. Beim Devices-Speichern wird das laufende `system.adapter.eos-admin.N` nicht mehr verändert. Damit löst das Speichern weder einen Controller-Neustart dieses Prozesses noch eine neue Anmelde-Generation aus. Die UI-Konfiguration verwendet ebenfalls diese geschützte Ablage; aufeinanderfolgende Änderungen lesen den aktuellen Stand zurück.

Die bisherige Konfiguration der Altinstanzen bleibt erhalten. Der automatische Übergang ändert dort nur `common.enabled`; er entfernt weder Adapterpakete noch Objekte oder Dateien. Ausnahme bei der UI-Konfiguration sind die bewusst zentralisierten Transport-, Anmelde- und Lizenzfelder: EOS bleibt auf der eingerichteten sicheren Anmeldung und dem EOS-Port, und alte Lizenzcodes werden nicht in eine andere Lizenzgeneration umgewandelt. Die gemeinsame gültige EOS-Lizenz muss vorher vorliegen.

## Vorprüfung und Übergabe

Aktuell ausdrücklich erkannte Versionsstände:

| Quelladapter | Versionen für diese Vorprüfung |
| --- | --- |
| nexowatt-ui | 1.0.35, 1.0.36, 1.0.37, 1.0.38 |
| nexowatt-devices | 0.5.176 |
| eebus | 0.3.0 |
| nexowatt-backup | 1.0.10 |

Eine bekannte Versionsnummer allein gilt nicht als Nachweis beliebiger lokaler Codeänderungen oder jeder Anlagenfunktion. Andere Versionen werden nicht stillschweigend übernommen.

Für jeden vorhandenen Quelladapter muss es genau eine eindeutige Instanz geben. Sie muss auf demselben, aktuell erreichbaren Host liegen; der jeweilige Zielbereich darf noch keine eigene Konfiguration enthalten. Die zentrale Lizenz muss auch das betroffene Modul erlauben. Geräteprofile und Protokolle werden vor einer Abschaltung mit dem enthaltenen Katalog abgeglichen. Ein weiterer aktiver oder nicht sicher als beendet nachgewiesener EOS-Prozess blockiert die Übergabe.

Eine bewusst deaktivierte alte UI wird mit `EOS_MIGRATION_DISABLED_UI_REVIEW` zurückgestellt. Der eingebettete EMS darf nicht durch die Übernahme einer solchen Konfiguration unbeabsichtigt starten. Die alte Instanz bleibt deaktiviert und unverändert. Bei Devices, EEBus und Backup wird der vorhandene Aktivierungszustand in der Modulkonfiguration erhalten.

Alle Kandidaten werden vor der ersten Abschaltung geprüft. Ein verschlüsseltes Journal wird geschrieben, dann werden die bisherigen Prozesse deaktiviert. EOS wartet auf vom Controller bestätigte `alive=false`-Zustände mit passenden Zeitstempeln und frischem Host-Lebenszeichen. Quelle, Version, Host und Konfigurationshash werden vor und nach dem Stoppen erneut verglichen. Erst dann werden die Konfigurationen übernommen und die integrierten Laufzeiten gestartet. Die anschließende Prüfung verlangt den betriebsbereiten UI-/EMS-Status mit aktueller Schreibberechtigung, aktive übernommene Module und erneut bestätigte Abschaltung der alten Prozesse. Sie prüft deren Start, nicht die tatsächliche physische Gerätewirkung.

Bei jedem späteren Wiederanlauf müssen die übertragenen geschützten Konfigurationsobjekte vorhanden und weiterhin derselben ursprünglichen Instanz und Version mit erhaltenem Namespace zugeordnet sein. Fehlende oder falsch zugeordnete Daten sperren die neue Schreibfreigabe; EOS ersetzt sie nicht durch Paketvorgaben. Nach erfolgreichem Abschluss gespeicherte legitime Konfigurationsänderungen bleiben erlaubt und werden beim nächsten Start geladen.

Datenbanklesevorgänge haben eine Grenze von fünf Sekunden. Stop-/Rückfallnachweise werden höchstens 15 Sekunden abgewartet, der neue Start höchstens 45 Sekunden. Die öffentlichen ioBroker-Datenbankschreiboperationen sind nicht als abbrechbare Transaktionen verfügbar. Ein unklarer Schreib-/Stopzustand ist deshalb kein Beleg für einen erfolgreichen Rückfall; ein ungeklärter Zustand sperrt die neue Schreibfreigabe.

## Geschützte Werte und EEBus

`encryptedNative` wird nur anhand der ausdrücklich ausgewiesenen Felder entschlüsselt und anschließend im neuen Konfigurationsspeicher verschlüsselt. Fehlende `protectedNative`-Werte werden nicht durch leere Passwörter ersetzt. Der ioBroker-Controller kann diese Werte für fremde Adapter ausblenden. Der automatische Wechsel bleibt dann vor jeder Quellabschaltung blockiert. Es gibt keinen falschen Adapter-Namen, kein Umgehen der Controller-Zugriffsgrenze und kein Erraten solcher Werte.

Bei einer geeigneten EEBus-Übernahme werden das tatsächlich zusammenpassende P-256-Zertifikat/Schlüsselpaar, SHIP-ID, SKI, PIN, Ports, Polling sowie die aktive/dry-run-Konfiguration erhalten. Die Geräteidentität wird ausschließlich in private Dateien (0700/0600) übernommen; eine bereits abweichende Identität wird nicht überschrieben. Bereits vertraute Gegenstellen brauchen einen ausdrücklich vorhandenen, bestätigten SHA-256-Zertifikat-Pin. Ein über mDNS gemeldeter Fingerabdruck oder eine historische `trusted=true`-Markierung ohne Pin genügt nicht. Fehlende Pins erfordern eine gezielte Kopplungsprüfung. Nicht konfigurierte, deaktivierte Quellinstanzen bekommen keine erfundene alte Identität.

## Grenzen bei RPC und Backup

Datenpunkt-IDs und ioBroker-Adapter-Postfächer sind verschiedene Schnittstellen. Ein `sendTo('nexowatt-ui.0', ...)` erreicht nach dem Stoppen dieser Adapterinstanz kein eigenes laufendes Postfach mehr. Der neue Prozess registriert keine fremden Controller-Postfächer. Deshalb sperren erkannte exakte Altinstanz-Ziele in aktiven Fremdadapter-Konfigurationen und erkannte `sendTo`-Verweise in aktiven Skripten die automatische Übergabe. Solche Aufrufer müssen gezielt an die neue EOS-Schnittstelle angepasst werden. Dynamisch berechnete Ziele, externe Aufrufer und undurchsichtige Skriptlogik sind durch diese Inventur nicht vollständig nachweisbar; sie gehören zur Anlagenprüfung. Vollständige alte Datenpunktverweise allein blockieren den Wechsel nicht.

Die Backup-Übernahme prüft den eigenen NexoWatt-Quelladapter und dessen aktivierte Funktionen, Ziele und benötigte Programme. Fehlende vormontierte Ziele, nicht übernehmbare Betriebsarten oder nicht lesbare geschützte Credentials blockieren den automatischen Wechsel. Details der enthaltenen Backup-Funktionen und verbleibenden Grenzen stehen beim Backup-Modul. Die neue Integration hebt keine Betriebssystemrechte an und mountet keine fremden Dateisysteme als Root.

## Status, Fehler und Rückfall

Der angemeldete Administrator sieht den Status unter `/migration/`; zusätzlich steht er im Datenpunkt `eos-admin.N.info.legacyMigration`. Angezeigt werden ausschließlich Phase, Fehlercode und Quellinstanzen, keine Konfigurationswerte oder Credentials.

| Phase | Bedeutung |
| --- | --- |
| NOT_NEEDED / DISABLED | Keine Übernahme erforderlich bzw. automatische Übernahme abgeschaltet |
| LICENSE_REQUIRED | Für eine Übergabe fehlt noch die gültige zentrale Lizenz; nach Aktivierung EOS neu starten |
| BLOCKED | Vorprüfung abgebrochen; die Altadapter wurden nicht geändert |
| PREPARED / STOPPING | Journal gesichert; bestätigter Stillstand wird hergestellt |
| TRANSFERRED | Konfiguration und Namespaces übernommen; Startprüfung läuft |
| COMMITTED | Übernommene Laufzeiten haben ihren Start bestätigt; Altadapter bleiben deaktiviert vorhanden |
| ROLLED_BACK | Neue Laufzeiten gestoppt, ursprüngliche zuvor aktiven Adapter wieder aktiviert und als laufend bestätigt |
| ROLLBACK_REQUIRED | Übergabe/Rückfall unklar; neue Schreibfreigabe gesperrt, gezielte Wiederherstellung erforderlich |

Ein Abbruch während der Vorbereitung wird beim nächsten Start anhand des Journals behandelt. Ein einmal ausgeführter Rückfall wird nicht bei jedem Neustart automatisch wieder versucht. Bei ungeklärtem Stoppen eines neuen Transports wird die alte Instanz nicht zusätzlich aktiviert. Dadurch wird eine doppelte physische Zuständigkeit vermieden, statt fälschlich einen erfolgreichen Rückfall zu melden.

Vor Kundenupdates eine vollständige, rücksicherbare Sicherung mit Konfigurationsdaten, Zertifikaten, Lizenzspeicher, UI-/Moduldaten, Historie und passenden Originalpaketen vorhalten. Die Umschaltung benötigt einen tatsächlichen Prozesswechsel und kann Geräteverbindungen kurz unterbrechen. Nach dem Update Port 8081, EOS-Anmeldung, gespeicherte Zuordnungen, frische Messwerte, Regeltakte, aktive Grenzen, Gerätetelegramme, Historie, Backup und Neustart der Zielanlage prüfen. Bei Rückfall zuerst die integrierten Regler und Transporte sicher stoppen, dann die gesicherten Originalinstanzen wieder in Betrieb nehmen. Ein bloßer Paket-Downgrade auf 9.0.6 liest die neue separate Konfigurationsablage nicht und ist deshalb kein vollständiger Daten-Rollback.

Die vorhandenen manuellen Geräte-/EEBus-Importknöpfe bleiben separate Konfigurationsimporte mit den früheren neuen Zielpfaden. Sie sind keine zweite Stufe der automatischen Übernahme und dürfen nach erfolgreicher automatischer Übernahme nicht zusätzlich ausgeführt werden.

## Ergänzung 9.0.14: Lizenzwechsel und Geräte-Altformat

Wird die Lizenz erst nach dem Start aktiviert, bleibt die noch nicht ausgeführte Übernahme gesperrt. Der Status nennt dann `EOS_MIGRATION_RESTART_REQUIRED`. Ein vollständiger EOS-Adapterneustart prüft vor dem Aufbau der neuen Laufzeiten alle Quellen neu. Ein Hot-Retry in einer bereits an einen Namespace gebundenen Laufzeit findet nicht statt. Solange die Vorprüfung nicht erfolgreich ist, werden keine Defaults als Ersatz für den Bestand freigegeben.

Die Altübernahme von Devices 0.5.176 berücksichtigt `devicesJson`, wenn `devices` fehlt oder leer ist. Zwei gefüllte, widersprüchliche Listen sperren den Import. Das absichtliche Leeren einer heutigen Geräteliste bleibt eine echte Löschung der Konfiguration und reaktiviert keine alte JSON-Liste. Bereits übernommene Original-Namespaces werden durch einen weiteren manuellen Import nicht ersetzt.

Im gemeldeten Livefall startete 9.0.12 ohne Vertrauensanker; die Lizenz wurde später aktiviert. Die Statusseite bestätigt `LICENSE_REQUIRED`, beide Altadapter sind noch eingeschaltet. Vor der korrigierten automatischen Übernahme bleiben die Quellen erhalten und aktiv. Die konkrete erfolgreiche Übergabe muss auf dem Zielgerät mit `COMMITTED`, unveränderten IDs, übernommenen Einstellungen und frischen Gerätewerten nachgewiesen werden. Ein lesbares App-Center-Backup ist kein Nachweis, dass die vollständige Übernahme schon stattgefunden hat.

[9.0.14-Anleitung](../start/START_HIER_9.0.14.md) und [Prüfbericht](../reports/unified-9.0.14/PRUEFBERICHT.md).
