# Ladepunktidentität: unabhängiger Read-only-Review

Stand: 25.11.2026. Der Reviewer hat keine Produktdatei dieses Funktionsbereichs verändert. Geprüft wurden der typisierte Helper `charging-point-identity.ts`, die Einbindung beim Konfigurationswechsel und beim EMS-Start, die HTTP-Bedienpfade und die IPC-Klassifizierung des Registry-States.

## Ergebnis

Im zuletzt geprüften Stand bleibt kein blockierender Befund aus diesem Review offen.

Vier während der Prüfung gefundene Punkte wurden vom Implementierer korrigiert und anschließend erneut geprüft:

1. Eine Änderung eines sekundären Aktorziels, beispielsweise `modeId`, konnte zunächst bei unverändertem primärem Strom-Sollwertziel denselben Token behalten. Die separate Signatur der Schreibziele rotiert jetzt die Bedienidentität, ohne bestehende Wünsche des weiterhin identifizierten Geräts zu löschen.
2. Die ursprüngliche Ausnahme für interne Modusspiegel war zu weit: auch ein anderes LP oder eine fremde EOS-Instanz wurde ignoriert. Die Ausnahme gilt jetzt ausschließlich für den eigenen Namespace und exakt den aktuellen Slot. Eine Änderung auf LP2 oder eine andere Instanz verwirft den alten Token.
3. Eine manuell zugewiesene Station mit einer bereits unterstützten generischen Command-State-Brücke und ohne normalen Power-/Setpoint-Datenpunkt wurde zunächst vollständig abgewiesen. Die konkrete konfigurierte Brücke wird jetzt in die Identität eingebunden. Es gibt keinen pauschalen Nullidentitäts-Bypass. Änderungen des tatsächlichen Command-Ziels verlangen einen neuen Token. Bei solchen sonst nicht physisch identifizierbaren Punkten wird auch die konfigurierte Bezeichnung konservativ berücksichtigt.
4. Nach fehlgeschlagenem Konfigurationscommit konnte ein erneuter Save des alten Layouts mit `restartEms:false` die nötige Wiederaufnahme der bereits gestoppten Engine übergehen. Die Restartentscheidung berücksichtigt jetzt den tatsächlich gestoppten Zustand. Die Bedienung bleibt bis zur bestätigten Übernahme gesperrt; der bereits quittiert gestoppte Motor wird nicht erneut verwendet.

## Geprüfte Verträge

- Ein Indexwechsel A/B übernimmt die gespeicherten Bedienwünsche und Sitzungs-/Boostzeiten anhand der Geräteidentität. Die Quelldaten werden vollständig aufgenommen, bevor eine Zielposition überschrieben wird. Entfernte Slots werden zurückgesetzt und bleiben für alte tokenlose Clients geschützt.
- Tokens werden serverseitig erzeugt, dauerhaft gespeichert und nach Neustart wieder gelesen. Ein entferntes und später am selben Index erneut hinzugefügtes Gerät erhält den alten Token nicht zurück. Globale Befehle werden nach Layoutänderungen an die bestätigte Layoutrevision gebunden.
- Reine Metadaten-/Messwertänderungen eines weiterhin eindeutig gemappten Geräts lassen dessen Token unverändert. Geänderte Aktorziele verlangen eine neue Bedienidentität. Ein eigener, nur infolge der Neunummerierung umgezogener Standard-Modusspiegel wird korrekt behandelt.
- Eine abgebrochene Übertragung bleibt durch das Journal wiederholbar. Unvollständige oder widersprüchliche Journale sowie ein fremdes Wiederherstellungslayout werden vor Schreibzugriffen abgewiesen. Eine neue Engine initialisiert ihre Module erst nach abgeschlossener Identitätsübernahme.
- Der Registry-State erhält im UI-Worker ausschließlich über seinen exakten, aktuellen beziehungsweise übernommenen Namespace den längeren Commit-Bestätigungszeitraum. `ack:true` allein erweitert den Zeitraum gewöhnlicher Aktorbefehle nicht. Die eigentliche Owner-Schreibpromise wird weiterhin abgewartet.
- Registrygröße, Anzahl der Slots und parallele Transferwrites sind begrenzt. Der Registerzustand enthält gehashte Identitäten und Tokens, keine kopierten Endpunkttexte oder Zugangsdaten. Daraus folgt kein gemessener RAM-Verbrauch der Anlage.

## Tatsächliche Prüfungen

Unter Node 24.22.3 bestanden **30/30 vorhandene Identity-/HTTP-Regressionstests**:

```sh
node --test test/eos-evcs-control-identity.test.cjs test/eos-evcs-control-fence.test.cjs
```

Rohlog: `node24-tests.log`.

Drei zusätzliche, unabhängig formulierte Probes verwenden den echten Helper, die echte Stations-HTTP-Route und die echte Konfigurationsvorbereitung. Sie prüfen die konkrete Defaultmirror-Abgrenzung, den weiterhin funktionierenden Custom-Bridge-Pfad einschließlich Ablehnung eines veralteten Tokens vor dem neuen Fremdwrite sowie die Recovery mit `restartEms:false`:

```sh
node docs/reports/unified-9.0.26/raw/charging-identity-review/review-probes.cjs
```

Ergebnis: **3/3 bestanden**, `independent-probes.json`; die aufgeführten Quellhashes blieben während des Laufs unverändert.

Ein separater tatsächlicher UI-Kindprozess schrieb den Registry-State über den echten Worker-/Owner-IPC-Weg. Der synthetische Owner bestätigte den Write erst nach 2300 ms. Beide Varianten bestanden ohne vorzeitigen 2-Sekunden-Timeout: `eos-admin.0` mit 2303 ms und das erhaltene `nexowatt-ui.3` mit 2302 ms. Ergebnis und Quellhashes: `registry-ipc.json`.

Sämtliche Controllerdaten, Stationen und Gerätezugriffe sind Testfixtures. Die Prüfung ist keine Hardwareabnahme der Dousida-Wallbox und keine Messung auf dem Raspberry Pi. Den tatsächlichen Browser-Client und seine Snapshot-/Tokenbindung prüft ein weiterer Reviewer separat.
