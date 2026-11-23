# NexoWatt EOS 9.0.14 – Bestandsübernahme, Geräteimport und Startdiagnose

Stand: 23.11.2026. Paket `iobroker.eos-admin`, vorgesehener Kanal `next`. Dieser Stand bearbeitet die gemeldete Live-Übernahme nach Version 9.0.12. Eine Änderung der Kundenanlage oder eine Veröffentlichung durch diese Arbeit ist nicht Bestandteil dieses Prüfberichts.

## Bestätigter Live-Ablauf

Die bereitgestellten Protokolle zeigen den Start von 9.0.12 mit Node.js 22.23.5 und js-controller 7.2.5. Zunächst fehlte der Vertrauensanker; der Import des Prüfschlüssels und die Lizenzaktivierung erfolgten erst später. Ein danach ausgeführter Adapterneustart ist nicht dokumentiert. Die anschließend aufgerufene Seite `/migration/` zeigt weiterhin `LICENSE_REQUIRED` mit noch nicht gespeicherter Änderung. Der Nutzer bestätigt außerdem, dass die alten Instanzen NexoWatt UI und NexoWatt Devices weiterhin eingeschaltet sind.

Damit ist die ausgebliebene Bestandsprüfung nach später Lizenzaktivierung belegt. Die konkrete Quell-/Zielkonfiguration wurde hier nicht aus der Live-Datenbank gelesen. Weitere Vorprüfungsgründe wie eine bereits gespeicherte Zielkonfiguration lassen sich deshalb nicht ausschließen. Die angezeigte Backup-Version 1.0.38 und die manuelle Importsperre sind für sich kein Nachweis einer erfolgten Übernahme oder eines Datenverlusts.

## Änderungen

1. **Migrationsfreigabe nach später Lizenzaktivierung:** `LICENSE_REQUIRED` sperrt neue operative Laufzeiten und Schreibzugriffe, bis ein vollständiger neuer Start die Vorprüfung mit gültiger Lizenz ausführt. Die Diagnose wechselt bei inzwischen gültiger Lizenz auf `EOS_MIGRATION_RESTART_REQUIRED`. Es erfolgt kein automatischer Neustart und keine nachträgliche Migration in eine bereits an andere Namespaces gebundene Runtime.
2. **Nachvollziehbare Steuerungsfreigabe:** Eine noch gültige Controller-Prüfung mit Migrationssperre wird als `MIGRATION_BLOCKED` statt als abgelaufener Nachweis dargestellt. Es werden ausschließlich begrenzte, validierte Statusfelder weitergegeben. Die synchrone Schreibentscheidung bleibt unverändert.
3. **Devices-Altformat:** Die explizite Bestandsübernahme berücksichtigt gefüllte `devicesJson` auch neben einer leeren `devices`-Standardliste. Widersprüchliche gefüllte Quellen werden abgelehnt; normales bewusstes Leeren heutiger Einstellungen bleibt erhalten.
4. **Manueller Geräteimport:** Die Mutationssperre umfasst die gesamte Übernahme, Stopnachweise werden erneut geprüft und eine bestehende Original-Namespace-Bindung darf nicht durch erneuten manuellen Import verloren gehen. Die Oberfläche erklärt den gespeicherten Deaktivierungszustand und die getrennte Bedeutung der automatischen Migration.
5. **EMS- und Wiederherstellungsdiagnose:** Der tatsächliche Betriebsstart einschließlich Lizenz-, Migrations- und Ownership-Sperren wird lesend angezeigt. Eine gesperrte Wiederherstellung erklärt den Grund, ohne Daten zu speichern oder verdeckte Wiederholungsversuche auszuführen.

Einzelheiten und gezielte Testbelege: [Migration](MIGRATION_REVIEW.md), [Geräteimport](DEVICES_IMPORT_REVIEW.md), [UI-/EMS-Start](UI_STARTUP_REVIEW.md).

## Vollständige Releaseprüfungen

| Prüfung | Ergebnis |
| --- | --- |
| Vollständiges `npm test`, Node.js 22.23.4 | 1326 Tests, 1324 bestanden, 0 fehlgeschlagen, 2 ausgelassen |
| Vollständiges `npm test`, Node.js 24.22.3 | Gleicher Umfang und gleiche Ergebnisse |
| Typprüfung | Konfigurierte Gesamtprüfung auf Node 22/24; neuer Startdiagnose-Helper strikt geprüft |
| Linting | Konfigurierte Gesamtprüfung einschließlich des neuen Helpers bestanden |
| Builds | Backend, Admin-Frontend, Installer, Module und UI-Runtime erfolgreich; Runtimequellen und deutsche Code-Dokumentation synchron |
| Lizenzregression | Echte Keygen-1.0.4-Quelle im gesamten Testlauf verwendet; temporäre Testschlüssel, keine Herstellerschlüssel |
| UI-Geheimnisprüfung | Keine Treffer; zusätzliche Paket-Geheimnisprüfung im Release-Gate |
| UI-Sicherheitsgate | 209 Quellen; 0 neue blockierte Befunde; historische Baseline unverändert |
| npm-Audit Laufzeit | 0 gemeldete Advisories |
| npm-Audit gesamte Entwicklungsumgebung | 14 moderate, 0 hohe/kritische Advisories |
| SBOM | Versionsbezug 9.0.14; Vendoring-Abgleich bestanden |

Die zwei ausgelassenen Fälle benötigen `nginx` beziehungsweise `setfacl`. Die vollständigen Tests verwenden lokale HTTP-/Controller-/Gerätemodelle. Sie bestätigen keine erfolgreiche Übergabe auf der tatsächlichen Liveanlage. Die konkrete Live-Patchversion Node.js 22.23.5 wurde nicht ausgeführt; getestet sind die oben angegebenen Versionen.

Das Sicherheitsgate führt weiterhin 3222 aktuelle Scannerfundstellen: 2952 historische offene und 270 einzeln geprüfte. Elf vorhandene quellgebundene Einträge wurden nach erneuter Prüfung fortgeschrieben; keine Befundbudgets oder historische Baseline wurden gelockert. Einzelheiten: [Sicherheitsdelta](UI_SECURITY_DELTA_REVIEW.md). Dies ist kein vollständiger Sicherheitsnachweis des Gesamtbestands.

Die versionsgebundenen Rohbelege stehen in `raw/INDEX.json`. Nach Abschluss dieser unveränderlichen Quellen werden Repo-ZIP, Paket, frische Extraktion und tatsächliche npm-Verzeichnis-Trockenläufe geprüft. Deren Ergebnisse einschließlich Hashes stehen getrennt in `NexoWatt_EOS_9.0.14_Lieferpruefung.json`; diese abschließenden Paketbelege können nicht selbst in ihrem eigenen unveränderlichen Quellhash enthalten sein.

## Erhaltene Grenzen

Die vorhandenen Altinstanzen bleiben bis zur erfolgreichen vollständigen Vorprüfung unverändert. Nur die kontrollierte Übergabe stoppt die passenden Quellen und wartet auf bestätigtes Prozessende. Alte Namespaces, Datenpunkt-IDs, kundeneigene Zustände, History-Metadaten und verschlüsselte Einstellungen werden nicht pauschal ersetzt. Unbestätigte Stellbefehle werden nicht nachgespielt. Ein blockierter Stand erlaubt keine parallele manuelle Aktivierung eines zweiten Reglers.

Die Schutzbedingungen für deaktivierte alte UI, vorhandene Zielkonfiguration, nicht eindeutige Quellen, fehlende geschützte Einstellungen und ungeklärte Stopps bleiben bestehen. Der Controller 7.2.5 entfernt `protectedNative`-Felder beim Lesen durch einen anderen, nicht privilegierten Adapternamen. Diese tatsächliche Grenze wurde an Originalquellen geprüft; eine Benutzeroption mit Administratorkennung umgeht sie nicht. Es wurde kein ungefilterter Zugriff eingeführt. Betroffene Backup-Zugänge und Schlüssel benötigen einen gesondert geprüften Übergabeweg.

Die Live-EOS-Instanz verwendet laut Log noch Port 8081. 9.0.14 überschreibt diesen gespeicherten Wert nicht. Neue Instanzen verwenden 8188; die gezielte Änderung der bestehenden EOS-Instanz und die getrennte Kontrolle von `admin.0` werden in der [Startanleitung](../../../START_HIER_9.0.14.md) beschrieben. Der Listener bindet exakt den konfigurierten Port und lässt bei einer Kollision den bestehenden Dienst unberührt. Vorhandene Tests hierzu sind `test/eos-unified-listen.test.cjs` und `test/eos-unified-access-recovery.test.cjs`; deren Ergebnis im finalen Stand gehört zu den oben noch einzutragenden Gesamtprüfungen.

Der seit 9.0.13 vorgesehene normale `npm publish`-Weg aus der vollständig kopierten Repository-ZIP bleibt bestehen. Die Vorbereitung entfernt nur bytegenau bekannte obsolete Dateien nach vollständiger Sicherung außerhalb des Repositorys. Integritätsprüfungen und versionsgebundene Testnachweise werden nicht deaktiviert oder beim Publish neu erzeugt. Die Auslieferungsprüfung muss genau den finalen Stand bestätigen.

## Nicht behauptete Nachweise

Die lokale Prüfung ist keine Abnahme der tatsächlichen Kundenanlage. Gerätekommunikation, erhaltene Messwert- und Stellgrößenzuordnungen, Regeltakte, physische Aktorik und reale Wiederherstellung müssen nach der kontrollierten Übergabe an der Anlage geprüft werden. Eine bloße Anzeige `COMMITTED` beweist keine vollständige Hardwarefunktion.

Eine pauschal unterbrechungsfreie Migration, eine bestimmte RAM-Einsparung, eine vollständige Übernahme jedes geschützten Altadaptergeheimnisses oder eine allgemeine Produktivfreigabe werden nicht zugesichert. Die exakte Live-Patchversion Node.js 22.23.5 und native Windows-PowerShell-/NTFS-Ausführung sind nur dann abgedeckt, wenn dies in den endgültigen Ergebnissen ausdrücklich genannt wird. Ein lokaler npm-Trockenlauf bestätigt keine npm-Anmeldung, 2FA oder Uploadberechtigung.

NexoWatt-Anteile bleiben proprietär; vorhandene Drittanbieterrechte bleiben dokumentiert. Test- und Hashnachweise sind keine digitale Herstellersignatur und keine CRA-Konformitätsbescheinigung. Historische offene Sicherheitsbefunde dürfen nicht durch diesen gezielten Fehlerbehebungsstand als erledigt ausgegeben werden.
