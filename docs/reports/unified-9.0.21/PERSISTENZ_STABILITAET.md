# Konfigurationserhalt und Speicherabläufe – 9.0.21

Stand: 24.11.2026. Unveränderte Vergleichsbasis: ausgeliefertes Repository 9.0.20. Betrachtet wurden Modulkonfigurationen, Geräte-/EMS-Speichergrenzen, konkurrierende Bearbeitung, verspätete Datenbankantworten, Stopp, Bestandsübernahme und Start mit vorhandenen Kundeneinstellungen. Keine Liveanlage wurde verändert. Die folgenden Befunde sind neue Reproduktionen gegen 9.0.20; frühere 9.0.19/20-Korrekturen wurden nicht erneut als neue Befunde gezählt.

## 921-CFG-01 – Verspäteter Commit konnte bei der nächsten Bearbeitung verloren gehen

**Priorität: hoch, Konfigurationserhalt. Behoben.**

`EosModuleHost.persistConfig()` begrenzte in 9.0.20 den tatsächlichen Datenbankauftrag auf fünf Sekunden Wartezeit. Der Auftrag selbst wurde dadurch nicht abgebrochen. Nach der Fehlermeldung gab `save()` jedoch seine Mutationssperre frei. Bei einem später erfolgreichen Commit aktualisierte der Konfigurationsspeicher seine Revision, während die angezeigte und laufende Modulkonfiguration auf dem alten Stand blieb. Ein weiterer Save konnte damit den inzwischen dauerhaft gespeicherten Kundenwert durch den alten angezeigten Wert ersetzen.

Die Reproduktion führt den tatsächlichen Host und Konfigurationsspeicher aus: Schreibantwort nach fünf Sekunden verzögern, anschließend den ursprünglichen Auftrag erfolgreich abschließen, Konfiguration erneut anzeigen, nur ein anderes Feld ändern und neu speichern. Ein neu erzeugter Host liest danach unter 9.0.20 den alten Wert `before` anstelle von `keep-this-confirmed-customer-value`. Dies ist ein konkret ausgeführter Verlust des neuen Konfigurationswertes in der Datenbankfixture, keine alleinige Quellcodevermutung. Rohbeleg: [920-late-commit-overwrite-node24.log](raw/persistence/920-late-commit-overwrite-node24.log).

`waitConfigurationSave()` begrenzt jetzt die Antwort an den Aufrufer, während `configurationSavePromise` und die Mutationssperre die tatsächliche Transaktion bis zum Datenbankabschluss und der Laufzeitübernahme besitzen. Derselbe Ablauf gilt für manuelle Modulimporte. Weitere Saves/Importe bleiben bis dahin gesperrt. Die Profilwechsel-Reservierung wird erst nach Abschluss freigegeben. Eine verspätete Ablehnung belässt die frühere Konfiguration; ein verspäteter Erfolg wird vor der nächsten zulässigen Bearbeitung in der Ansicht sichtbar. Es gibt keine automatische Wiederholung eines unklaren Schreibauftrags.

## 921-CFG-02 – Konfigurationsauftrag überschritt die Stoppgrenze

**Priorität: hoch, Lebenszyklus und Konfigurationskonsistenz. Behoben.**

In 9.0.20 konnte ein vor dem Stopp begonnener Konfigurations-Lesevorgang nach dem Stopp noch einen neuen persistenten Schreibauftrag auslösen. Ein bereits ausgeführter Schreibauftrag durfte nach verspäteter Bestätigung außerdem die Konfiguration des gestoppten Hosts übernehmen und Erfolg melden. Die ursprünglichen Negativtests zeigen diese beiden fehlenden Ablehnungen: [920-save-lifecycle-node24.log](raw/persistence/920-save-lifecycle-node24.log), drei erwartete Fehler und eine erfolgreiche Kontrollprüfung.

Der Modul-Konfigurationsspeicher prüft für Host-Saves vor dem ersten Zugriff, nach asynchronen Lesegrenzen und unmittelbar vor dem Write erneut die Lebenszyklusfreigabe. `persistConfig()` prüft nach bestätigtem Commit und nach dem Stoppen der alten Modulinstanz erneut den Hoststatus. Ein gestoppter Host darf keine neue Laufzeitübernahme beginnen.

`stop()` wartet zusätzlich begrenzt auf das tatsächliche Ende eines laufenden Konfigurationsauftrags. Ein erledigter, abgelehnter Auftrag ist dabei ebenfalls abgeschlossen. Eine nach fünf Sekunden weiterhin ausstehende Bestätigung ergibt `EOS_MODULE_STOP_UNCONFIRMED`; sie wird nicht als erfolgreicher Stopp dargestellt. Ein schon an die Datenbank übergebener Write kann nicht zuverlässig zurückgenommen werden. Wird dieser später bestätigt, bleiben die ausdrücklich gespeicherten Daten für den nächsten Start vorhanden; die gestoppte Laufzeit wird dadurch nicht neu geöffnet.

## 921-CFG-03 – Zweites Browserformular konnte neuere Geräte-/Moduleinstellungen überschreiben

**Priorität: hoch, Konfigurationserhalt. Behoben.**

Die geschützte Objektablage hatte bereits eine Revisionsprüfung zwischen Speicherinstanzen. Diese Prüfung kannte aber die Version des Browserentwurfs nicht. Zwei nacheinander gespeicherte Formulare aus zwei Browsern konnten daher beide erfolgreich sein, obwohl das zweite Formular den ersten neuen Stand wieder überschrieb. Die Reproduktion verwendet echte HTTP-Anfragen, die reale Sitzungs-/CSRF-Grenze, den tatsächlichen Modulhost/-speicher und den Gerätevalidator. In 9.0.20 antwortet der zweite Save mit HTTP 200 statt 409. Auch eine fehlende/ungültige Entwurfsrevision wurde angenommen: [920-http-draft-revision-node24.log](raw/persistence/920-http-draft-revision-node24.log).

Die Modulansicht liefert jetzt `configurationRevision`. Externe PUT-Anfragen an `/api/eos/modules/{devices,eebus,backup}` müssen die geladene Revision als `expectedConfigurationRevision` mitliefern. Fehlende/ungültige Angaben und abweichende Revisionen werden mit HTTP 409 / `EOS_MODULE_CONFIG_CONFLICT` abgelehnt. Die genaue Gleichheit wird vor Beginn der Mutationen geprüft; die vorhandene geschützte Ablage- und Rückleseprüfung bleibt zusätzlich erhalten. Die Revisionskennung ist eine zufällige UUID bzw. die zufällige gespeicherte Revision, kein Hash des Passwortes oder Konfigurationsinhaltes.

Die drei mitgelieferten Editoren übernehmen eine neue Entwurfsrevision ausschließlich zusammen mit dem tatsächlich geladenen Formular. Ein Statusabruf oder erneuertes CSRF-Token aktualisiert diese Revision nicht. Bei Konflikt bleiben die Eingaben im Formular; es erfolgt kein automatischer Reload und kein erneuter Schreibversuch. Die Meldung fordert zum Laden und Abgleichen des aktuellen Standes auf. Ein vor dem Adapterupdate geöffnetes älteres Formular muss neu geladen werden, bevor es über den neuen PUT-Vertrag speichern kann. Interne Host-Saves behalten ihren bisherigen Aufrufvertrag, werden jedoch weiterhin durch die gemeinsame Transaktionssperre geschützt.

## Geänderte Stellen

| Datei | Methoden / Änderung |
| --- | --- |
| `src/lib/eosModuleConfigStore.js` | `save()`: optionale Host-Lebenszyklusprüfung an den asynchronen Lese-/Schreibgrenzen |
| `src/lib/eosModuleHost.js` | `save()`, neues `waitConfigurationSave()`, `persistConfig()`, `importLegacy()`, `stop()`; Revision in Konstruktor, `loadForEditing()`, `start()` und `view()` |
| `src/lib/eosModuleHost.d.ts` | Revisionsfeld und optionaler Revisionsparameter; schreibgeschützte Sicht auf laufende Mutationen für vorgelagerte Konsistenzprüfungen |
| `src/lib/eosModuleHttp.js` | Pflichtfeld am Modul-PUT und Konfliktstatus 409; Authentifizierung, Rollen, Origin und CSRF unverändert |
| `modules/devices/admin/host-bridge.js` | Entwurfsrevision bei `reload()` übernehmen, bei Save mitsenden; Konflikt-/Timeoutmeldung mit Eingabenerhalt |
| `modules/eebus/admin/index.js` | Revision im API-Schema, bei Formularersatz übernehmen, bei Save mitsenden; Konfliktmeldung |
| `modules/backup/admin/index.js` | Revision nur bei `load(true)` übernehmen, bei Save mitsenden; Konfliktmeldung |

Neue Regressionen stehen in `test/eos-module-save-lifecycle.test.cjs` und `test/eos-module-editor-revision.test.cjs`. Ergänzt wurden reale HTTP-Prüfungen in `test/eos-module-device-save.test.cjs`, Geräteformularprüfungen in `test/eos-module-editor-session.test.cjs` und der bestehende HTTP-Testvertrag in `test/eos-module-http.test.cjs`. In `test/eos-device-ems-web-pipeline.test.cjs` wurde ausschließlich der Modul-PUT-Helfer um die geladene Revision ergänzt. `test/integration-unified.cjs` sendet die Revision und prüft einen abgelehnten veralteten Save am Controllerpfad; dessen vollständige Ausführung gehört zum zentralen Release-Prüflauf.

Die geänderten Dateien dieses Teilprüfstands sind unter [source-files.sha256](raw/persistence/source-files.sha256) gehasht. `eosDeviceEmsService.js`, die Migrationslogik und die kanonische UI-`main.ts` wurden in diesem Teilauftrag nur geprüft und nicht verändert.

Beim abschließenden zentralen Lint wurden noch die Klammern des einzeiligen `assertWritable()`-Checks in `eosModuleConfigStore.js` und der Zeilenumbruch der `save()`-Typdeklaration in `eosModuleHost.d.ts` formatiert. Die beiden Änderungen wurden separat geprüft: Ausschließliches Rückgängigmachen dieser Formatierung rekonstruiert exakt die vorher dokumentierten Dateihashes. [Prüfbeleg](raw/persistence/921-final-format-review.json) und [vorheriger Hashstand](raw/persistence/source-files.pre-final-format.sha256) bleiben erhalten; die obige Hashliste enthält den abschließenden Stand. Verhalten und Typvertrag sind unverändert. Die ursprünglichen Teiltest-Receipts werden nicht nachträglich umgeschrieben; die zentralen vollständigen Node-22-/Node-24-Prüfläufe sind im Release-Nachweis dokumentiert.

## Ausgeführte Prüfungen

| Nachweis | Ergebnis |
| --- | --- |
| Modul-, Migrations-, Speicher-, Stopp-, HTTP-, Editor- und Einstellungserhaltungsregressionen, Node 22.23.4 | 162 bestanden, 0 Fehler, 0 ausgelassen |
| Derselbe Prüfumfang, Node 24.22.3 | 162 bestanden, 0 Fehler, 0 ausgelassen |
| Konfiguriertes Backend-Lint auf den drei geänderten JS-Modulen | Bestanden |
| Konfiguriertes Devices-Frontend-Lint auf `host-bridge.js` | Bestanden |
| EEBus-Editor mit JS-Typprüfung und DOM-/ES2022-Vertrag | Bestanden |
| `tsc -p tsconfig.build.json --noEmit` | Bestanden |

Rohlogs, tatsächlich ausgeführte Befehle, Node-Versionen, Zeitpunkte, Dauer, Exit-Code und Loghashes stehen in [Node-22-Protokoll](raw/persistence/921-persistence-final-node22.log), [Node-22-Receipt](raw/persistence/921-persistence-final-node22.receipt.json), [Node-24-Protokoll](raw/persistence/921-persistence-final-node24.log) und [Node-24-Receipt](raw/persistence/921-persistence-final-node24.receipt.json). Die kleineren Lint-/Typprüfungen haben eigene Rohlogdateien; für sie wird kein nachträglich erfundener Startzeit-Receipt behauptet.

Die gezielte Fehlerinjektion umfasst abgelehntes `setForeignObjectAsync`, fehlgeschlagenes Rücklesen nach tatsächlich gespeichertem Objekt, verzögerte erfolgreiche und abgelehnte Commits, gleichzeitige Saves/Importe, Stopp während des letzten Datenbankreads, Stopp nach Ausgabe eines Writes und dessen ausbleibende Abschlussbestätigung. Die Browser-Skripte werden tatsächlich ausgeführt: Geräte, EEBus und Sicherung bewahren ihre Entwurfsrevision und ungespeicherten Eingaben bei einem Konflikt. Die 162 Prüfungen enthalten außerdem vorhandene Nachweise zu bewusst leeren EMS-/Gerätelisten, ungültigen Konfigurationsständen, Update-/Start-Hydration, Migration und Rollback.

Eine unabhängige zweite Codeprüfung des Revisions-/HTTP-/Editor-Deltas hat keinen weiteren blockierenden Befund in diesem abgegrenzten Umfang festgestellt. Sie ersetzt weder die Tests noch einen vollständigen Sicherheitsnachweis.

## Grenzen und Betriebsverhalten

- Der Datenbankteil dieser gezielten Tests verwendet kontrollierte Objekt-/State-Fixtures mit realen persistenten EOS-APIs. Ein im Test neu erzeugter Host ist ein geprüfter Neustart dieses Konfigurationspfades; er ist kein Stromausfalltest der Kundendatenbank. Der eigenständige echte js-controller-Prüflauf wird zentral dokumentiert.
- Eine einzelne unbestätigte Datenbankoperation hält bewusst die weitere Speichermöglichkeit gesperrt. Verfügbarkeit darf hier nicht durch unkontrolliertes Wiederholen oder Überschreiben erkauft werden. Der Fehler bleibt sichtbar und verlangt Abgleich des gespeicherten Standes bzw. eine kontrollierte Wiederinbetriebnahme nach Klärung des DB-Zustands.
- Keine vollständige Transaktion über mehrere unabhängige ioBroker-Objekte/States und kein Schutz vor beliebigen fremden Schreibzugriffen auf dieselben Datenbankzugänge werden behauptet. Die vorhandenen Berechtigungsgrenzen bleiben maßgeblich.
- Keine globalen Admin-/Gruppen-ACLs, Standard-Admin-Ports, fremden Adapterkonfigurationen oder Herstellerprotokolle wurden durch dieses Delta geändert. Die vorhandene Authentifizierung, zentrale Lizenzprüfung, Profilwechselprüfung und Verschlüsselung bleiben erhalten.
- Physische Geräte, Langzeitbetrieb, Stromausfall, vollständiger Anlagenrestore und grafische Browserabnahme sind durch diese Teilprüfung nicht nachgewiesen. Aus den Ergebnissen folgt keine allgemeine Fehlerfreiheit, Produktionsfreigabe oder CRA-Konformität.
