# NexoWatt EOS 9.0.11 – Veröffentlichung und Bestandsübernahme

Stand: 23.11.2026. Vollständiger Integrations-Teststand, keine pauschale Freigabe für jede Kundenanlage. SmartHome-Funktionen und Layout aus 9.0.10 bleiben enthalten. Zentrale Lizenz, Anmeldung und Ports bleiben erhalten.

## Warum der npm-Aufruf scheiterte

Der gemeldete Aufruf führte `iobroker.eos-admin@9.0.9 prepublishOnly` aus und scheiterte an `RELEASE_CONTENT_CHANGED` für zahlreiche Admin-Bundles. Der Ordner entspricht damit nicht dem versiegelten Quell-/Buildstand. Die Tests liefen noch nicht; Node.js 24.22.1 ist im deklarierten Profil zugelassen.

Nicht den gemischten Ordner neu versiegeln oder die Prüfung ausschalten. Das Repo-ZIP in ein **leeres Verzeichnis** entpacken. `node tools/eos-release-manifest.cjs --diagnose` unterscheidet zusätzliche, fehlende und veränderte Dateien, ohne etwas umzuschreiben. Bei Git-Import die mitgelieferte `.gitattributes` erhalten; sie verhindert Zeilenendkonvertierung versiegelter Dateien.

## npm-Veröffentlichung unter Windows

Das fertig geprüfte `iobroker.eos-admin-9.0.11.tgz` verwenden. Dieses Paket wird unverändert hochgeladen; der gemischte Desktop-Quellordner wird nicht erneut gebaut oder gepackt. Die vollständige Linux-orientierte Entwicklungstestsuite bleibt ein eigener Entwicklungs-/Release-Schritt. Sie ist kein geeigneter Windows-Upload-Schritt.

TGZ und `SHA256SUMS_9.0.11.txt` in einen separaten Ordner herunterladen. SHA-256 mit `Get-FileHash .\iobroker.eos-admin-9.0.11.tgz -Algorithm SHA256` gegen die mitgelieferte Prüfsumme vergleichen. Im Ordner mit der TGZ-Datei zunächst:

```powershell
npm publish .\iobroker.eos-admin-9.0.11.tgz --tag next --access public --dry-run
```

Nach erfolgreicher Prüfung und mit dem berechtigten npm-Konto lautet der tatsächliche Veröffentlichungsaufruf:

```powershell
npm publish .\iobroker.eos-admin-9.0.11.tgz --tag next --access public
```

Kein `--force`, kein `--ignore-scripts`, keine automatische Neuversiegelung. Eine bereits veröffentlichte Kombination aus Paketname und Version kann nicht überschrieben werden. Ein Trockenlauf bestätigt keine Kontoberechtigung, verfügbare Versionsnummer oder erfolgreiche Veröffentlichung. Diese Lieferung veröffentlicht selbst nichts.

**Lizenz:** Die NexoWatt-Anteile bleiben proprietär; vorhandene Drittanbieterrechte bleiben erhalten. Das unscoped Paket auf der öffentlichen npm-Registry ist öffentlich herunterladbar. Die Lizenzbeschränkung macht die ausgelieferten Dateien nicht geheim. Es werden keine privaten Hersteller- oder Kundenschlüssel mitgeliefert.

## Vor der Live-Übernahme

Eine rücksicherbare vollständige ioBroker-Sicherung und die bisherigen Adapterpakete bereithalten. Das gilt insbesondere für Konfiguration, Lizenzverzeichnis, Zertifikate, SmartHome-/Gerätedaten, History und Instanzdateien. Ein Wartungsfenster vorsehen: Ein Prozess-/Verbindungswechsel ist keine unterbrechungsfreie Umschaltung.

Für die gemeldete Live-Anlage sind EOS Admin **8.0.2**, NexoWatt UI **1.0.37** und NexoWatt Devices **0.5.176** bestätigt. Die UI- und Devices-Versionen liegen in der Vorprüfungsliste. Der bestehende EOS Admin wird als dieselbe Instanz aktualisiert. Die Versionsübereinstimmung allein bestätigt noch nicht die übrigen Voraussetzungen der Anlage.

Die automatische Übernahme ist für folgende Quellstände vorgesehen:

| Quelladapter | Zugelassene Versionen |
| --- | --- |
| `nexowatt-ui` | 1.0.35, 1.0.36, 1.0.37, 1.0.38 |
| `nexowatt-devices` | 0.5.176 |
| `eebus` | 0.3.0 |
| `nexowatt-backup` | 1.0.10 |

Es darf je Quelladapter genau eine eindeutige Instanz auf demselben erreichbaren Host vorliegen. Die jeweiligen Zielmodule dürfen noch nicht eigenständig konfiguriert sein. Eine gültige zentrale EOS-Lizenz mit passenden Modulrechten ist Voraussetzung. Der Standardadapter `backitup` ist kein automatisch zugelassener Quelladapter.

**Die alten Adapter nicht vorsorglich deaktivieren oder löschen.** Insbesondere eine vorher deaktivierte alte UI wird absichtlich nicht automatisch als laufender EMS übernommen. Nach erfolgreicher Vorprüfung deaktiviert EOS die passenden Altinstanzen selbst und wartet auf bestätigtes Prozessende. Nach erfolgreicher Übergabe bleiben sie deaktiviert erhalten. Ihre Objekte und Dateien werden weiterverwendet und dürfen nicht als vermeintlich unnötiger Altbestand gelöscht werden. Andere nicht integrierte Kommunikationsadapter bleiben unverändert.

Die vorhandene EOS-Admin-Instanz aktualisieren, keine zweite parallele Reglerinstanz anlegen. ioBroker Admin auf 8081 als Wartungszugang erhalten. EOS verwendet die vorhandene Transportkonfiguration; neue Instanzen verwenden HTTPS auf Port 8188. Vor dem Update von 8.0.2 prüfen, dass die EOS-Instanz einen eigenen freien Port, HTTPS und passende Zertifikate verwendet. Bestehende Port-/Bindungswerte werden nicht blind auf 8188 umgeschrieben. Der separate ioBroker-Admin bleibt unverändert. Nach gegebenenfalls erforderlicher zentraler Lizenzaktivierung EOS neu starten, damit die Übernahme erneut vorgeprüft wird.

## Bestehende Anlage mit der TGZ-Datei aktualisieren

Die folgenden Befehle sind für das gemeldete Linux-System mit js-controller 7.2.5 geprüft. Die Datei per WinSCP in das Home-Verzeichnis deines SSH-Benutzers kopieren. Zuerst die SHA-256-Summe mit der Lieferung vergleichen:

```bash
sha256sum "$HOME/iobroker.eos-admin-9.0.11.tgz"
cd /opt/iobroker
iobroker backup
```

Nur nach erfolgreicher, rücksicherbarer Sicherung und der oben beschriebenen Port-/TLS-Prüfung fortfahren. Ausschließlich den vorhandenen EOS Admin für den Paketaustausch stoppen; UI und Devices zunächst laufen lassen:

```bash
iobroker stop eos-admin.0
iobroker url "$HOME/iobroker.eos-admin-9.0.11.tgz" eos-admin
```

Nur wenn der Paketaufruf erfolgreich mit Exitcode 0 beendet wurde:

```bash
iobroker start eos-admin.0
```

Kein `iobroker add`, kein Löschen der alten Adapter und kein Stop des gesamten Controllers. Der URL-/Datei-Workflow aktualisiert Paket und Adapterobjekte; vorhandene native Werte und `common.enabled` werden erhalten. Deshalb wird EOS anschließend ausdrücklich wieder gestartet. Im Protokoll muss **Version 9.0.11** erscheinen. Bei Paketfehlern die Ausgabe sichern und nicht blind mit einem möglicherweise unvollständigen Paket fortfahren.

Nach gültiger zentraler Lizenz prüft EOS die vorhandenen UI-/Devices-Instanzen und übergibt sie wie oben beschrieben. Ein zunächst blockierter Stand bleibt Diagnosefall und ist kein Anlass, die alten Adapter manuell parallel umzuschalten.

Grundlage der CLI-Prüfung: offizielle js-controller-Quellen [setupInstall.ts, v7.2.5](https://github.com/ioBroker/ioBroker.js-controller/blob/v7.2.5/packages/cli/src/lib/setup/setupInstall.ts) und [setupUpload.ts, v7.2.5](https://github.com/ioBroker/ioBroker.js-controller/blob/v7.2.5/packages/cli/src/lib/setup/setupUpload.ts). Das ist eine Quellprüfung; ein reales Update deiner Anlage wurde hier nicht ausgeführt.

## Was erhalten wird – und was die Übernahme blockiert

Die ursprünglichen Datenpunkt-Namespaces bleiben erhalten. Native Einstellungen werden verschlüsselt übernommen; SmartHome-Gebäude/Räume/Geräte, Szenen, Timer und weitere geschützte UI-Konfigurationszustände werden geprüft und weiterverwendet. Bestehende Datenpunkte, Aliasse, History-/Custom-Einstellungen und Instanzdateien werden nicht pauschal umbenannt oder gelöscht. Alte unbestätigte Schaltbefehle werden nicht als neue Befehle kopiert.

Ausgenommen sind bewusst zentralisierte UI-Felder für Port/Bindung, TLS, Anmeldung und Lizenz. Es erfolgt keine Umwandlung alter Lizenzcodes. Bei unbekannten Versionen, mehreren Quellinstanzen, vorhandener Zielkonfiguration, fehlenden geschützten Zugangsdaten, ungeprüften Geräte-/EEBus-Einstellungen oder erkannten alten `sendTo`-Postfachverweisen wird die automatische Übernahme vor dem Abschalten blockiert. Datenpunktverweise und Adapter-Postfächer sind unterschiedliche Schnittstellen.

## Kontrolle und Rückfall

Auf der Übernahmeseite beziehungsweise in `eos-admin.0.info.legacyMigration` prüfen:

- `BLOCKED`: Vorprüfung nicht bestanden; Altadapter wurden nicht umgeschaltet. Fehlerursache bearbeiten, nicht blind manuell stoppen.
- `TRANSFERRED`: Konfiguration übernommen; Betriebsstart wird noch geprüft.
- `COMMITTED`: Startbedingungen und Quellabschaltung bestätigt. Das ersetzt nicht die Geräteabnahme.
- `ROLLED_BACK`: Alte zuvor aktive Adapter wurden nach bestätigtem Stopp der neuen Laufzeiten wieder freigegeben; kein automatischer neuer Umschaltversuch.
- `ROLLBACK_REQUIRED`: Rückfall nicht sicher bestätigt. Neue Schreibfreigabe bleibt gesperrt; keine zweite manuelle Aktorinstanz daneben starten.

9.0.11 überwacht den neuen Start bereits vor HTTPS-/Socket-Bereitschaft. TLS-, Port-, Initialisierungs- und Startfehler lösen den kontrollierten Rückfall aus. Laufende Startversuche und nachfolgendes Cleanup müssen abgeschlossen sein, bevor alte Aktorinstanzen wieder freigegeben werden. Auch bereits an den Controller übergebene Schreibaufträge müssen abgeschlossen sein. Ein unbestätigter Stopp bleibt mit `ROLLBACK_REQUIRED` über Neustarts hinweg gesperrt; ein Prozessneustart allein bestätigt keinen erfolgreichen Rückfall. Unsichere oder hängende Stopps werden als ungeklärt gemeldet. Datenbankschreiboperationen sind nicht beliebig abbrechbar; daraus folgt keine garantierte Gesamtausfallzeit.

Nach `COMMITTED` Anmeldung, Geräteverbindungen, frische Werte, bestehende Zuordnungen, Regelgrenzen, History, SmartHome-Bedienung und einen regulären Neustart an der Anlage prüfen. Die Befehle zur konkreten Umschaltung erst nach Abgleich der tatsächlich installierten Versionen und Konfiguration verwenden.

Weitere Grenzen und ausgeführte Prüfungen: [Prüfbericht](../reports/unified-9.0.11/PRUEFBERICHT.md). Details der erhaltenen Namespace-Architektur: [Bestandsübernahme](../unified/BESTANDSUEBERNAHME_9_0_7.md).
