# CORE-MODULES-906-001 – Integration und Sitzungsgrenzen

Stand: 23.11.2026, NexoWatt EOS 9.0.6. Ausgangspunkt war das ausgelieferte vollständige Repository 9.0.5; Devices stammt aus 0.5.176, EEBus aus 0.3.0. Dieser Vermerk ergänzt die komponenteneigenen Prüfberichte und die übergreifenden Release-Nachweise.

## Änderung

Ein gemeinsamer Modulhost verbindet die zwei eingebetteten Protokollmodule mit dem EOS-Lizenzdienst, Instanzlebenszyklus, Objekt-/State-System und den authentifizierten Administrationsseiten. Es werden keine zusätzlichen ioBroker-Adapterprozesse gestartet. Admin 8081 und EOS 8188 werden nicht umkonfiguriert. Die beiden Konfigurationsseiten arbeiten mit geschützter, verschlüsselter Konfiguration und einer getrennten Freigabe für tatsächlichen Gerätebetrieb.

Die Übernahme alter Instanzen ist ausdrücklich, deaktiviert und reversibel. Der Nachweis gegen konkurrierende alte Writer wird bei Änderungen und regelmäßig erneut geprüft. Alte Datenpunkte und private EEBus-Schlüssel werden nicht stillschweigend übernommen oder gelöscht. Migrationshinweise dokumentieren neue Präfixe und notwendige Neuverknüpfung beziehungsweise Neukopplung.

Die mDNS-Integration startet erst nach erfolgreich geöffnetem HTTPS-Listener und beendet sich sowohl beim Schließen des Webservers als auch beim Adapter-Unload. Die bestehende Root-/Login-Entscheidung wurde für `nexowatt` über verifizierte lokale TLS-Verbindungen nachgeprüft.

## Befunde und Korrekturen im selben Arbeitsstand

| Kennung | Befund | Korrektur/Nachweis |
| --- | --- | --- |
| CORE-906-01 | Eine erneuerte Ownership hätte einen alten Modulabschluss hinter einer neuen Generation verbergen können. | Modul- und Freigabegeneration werden verglichen; alte Instanz wird vor Neustart gestoppt. Regressionsfall mit Legacy-Aktivierung/Deaktivierung bestanden. |
| CORE-906-02 | Normale Host-Alive-Ereignisse hätten Module unnötig unterbrochen. | Gesunde Heartbeats widerrufen keine Freigabe; tatsächlicher Ausfall und veraltete Nachweise tun dies. |
| CORE-906-03 | Alte asynchrone Telemetrie könnte nach einem Neustart neue Werte überschreiben. | Alte Generationen können keine Datenbankänderungen senden; bestätigte Cleanup-Telemetrie wird verworfen, damit das Schließen der Verbindungen fortgesetzt wird. |
| CORE-906-04 | Geheimnisse könnten beim Verschieben von Gerätezeilen falsch zugeordnet oder über HTTP-Header/URLs sichtbar werden. | Zuordnung anhand stabiler Geräte-ID; Maskierung einschließlich Authorization/Cookie und URLs mit Zugangsdaten. Positive/negative Tests bestanden. |
| CORE-906-05 | Gleichzeitiges Webserver-Schließen und Adapter-Unload beziehungsweise spätes Start-Resolve könnten Cleanup doppelt ausführen oder Timer zurücklassen. | Gemeinsames Stop-Promise und Stop-Fence vor jeder nachfolgenden Startphase; Regressionstest bestanden. |
| CORE-906-06 | Eingebettete EEBus-Meldungen dürfen nicht durch ein frei wählbares Bus-Absenderfeld vertraut werden. | Tatsächlicher Modulhost, Laufzeit-Entry, privater API-Herkunftsnachweis und Rückkanal gemeinsam geprüft; Lizenzentzug blockiert beide Richtungen. |

## Ausgeführte Prüfungen

| Befehl | Ergebnis |
| --- | --- |
| `node --test test/eos-module-host.test.cjs test/eos-module-http.test.cjs test/eos-module-real-contract.test.cjs test/eos-unified-listen.test.cjs` | 45 Tests bestanden, 0 fehlgeschlagen; `core-module-tests.log`. |
| `npm run lint:unified` | Exit 0; `core-module-lint.log`. |
| `node node_modules/typescript/bin/tsc -p tsconfig.build.json --noEmit --pretty false` | Exit 0; `core-module-typecheck.log`. |

Die Prüfungen verwenden reale Express-5-/Express-4-Router und echte lokale HTTP-/TLS-Sockets mit verifizierten Testzertifikaten. Die tatsächliche EEBus-Factory wurde mit lokalen Identitätsdateien, kontrolliertem Datenbankersatz und deaktiviertem Discovery-/SHIP-Listener gestartet, gestoppt und wieder gestartet; ihre Identität blieb erhalten. Das Geräte-Templateverzeichnis wurde im deaktivierten Zustand geprüft. Der positive gemeinsame Bridge-Test setzt Hardware-/EMS-Bereitschaft als Fixture; Host-Weiterleitung, Runtime-Entry, API-Prüfung und Rückkanal sind Produktionscode.

Negative Fälle: fehlende/abgelaufene Sitzung, zurückgezogene Adminrolle, Passwort-Ersteinrichtung, fremde Origin, alte CSRF-Epoche, übergroßes/ungültiges JSON, interne Fehler ohne Geheimnisweitergabe, Lizenz-/Ownershipverlust, konkurrierende Altinstanzen, veraltete Generationen und fehlerhafter Stop.

## Offene Abnahme

Nicht ausgeführt: Zielgeräte-/Hausanlagenabnahme, realer Hardware-Writer, reale EEBus-Gegenstelle/CLS-Box, vollständige Protokollzertifizierung, Last-/Dauerlauf auf dem Gerät mit der berichteten Speicherbelegung. Der Kurznamen-DNS-Eintrag und Port 443 wurden auf der Kundenanlage nicht eingerichtet oder geprüft. Normen-/CRA-Bezüge dokumentieren Zielanforderungen; dieser Vermerk ist keine Konformitätserklärung oder unabhängige Zertifizierung.
