# NexoWatt EOS 9.0.0-alpha.1 – Prüf- und Lieferbericht

Stand: 22.11.2026 · Änderung EOS-MERGE-001 · Hersteller/Produktverantwortung: NexoWatt / Dominique Manteufel.

## Ergebnis und Lieferumfang

EOS-Admin 8.0.2 und NexoWatt UI 1.0.38 sind in einem installierbaren Adapter zusammengeführt. Der Produktname lautet **NexoWatt EOS**. Der technische Paketname `iobroker.eos-admin` und der Namespace `eos-admin.N` bleiben für bestehende Systemverträge erhalten. Die Hauptversion 9 kennzeichnet die neue gemeinsame Architektur.

Eine Instanz besitzt den Adapter-Lifecycle, HTTP-Server, Benutzer-/Sitzungsdienst und Lizenzdienst. Die UI-/EMS-Funktionen werden intern gehostet; ein zweiter laufender `nexowatt-ui`-Adapter ist nicht vorgesehen. Dashboard `/`, Installer `/installer/` und Systemverwaltung `/system/` verwenden dieselbe Anmeldung und serverseitige Rollenprüfung. Benutzerrechte und Produktlizenz sind voneinander unabhängig.

**Einmalige Aktivierung:** Nach erster Anmeldung und erforderlichem Erstpasswortwechsel wird die zentrale EOS-Lizenz eingetragen. Admin und UI verwenden anschließend dieselbe verschlüsselt gespeicherte Freigabe, auch nach Neustart. Im UI ist keine zweite Lizenzeingabe erforderlich. Der gültige Umfang folgt dem Ausstellervertrag; das Paket enthält weder voraktivierten Vollzugang noch Kundenlizenzen oder private Ausstellerschlüssel. Die NWL3-Prüfung wurde mit dem tatsächlichen Keygen 1.0.4 abgeglichen. Das Ausstellerwerkzeug wird nicht mitgeliefert.

NexoWatt-Anteile sind proprietär. Übernommene MIT- und andere Drittanbieterrechte bleiben erhalten. Ein öffentliches ungescoptes npm-Paket ist herunterladbar; eine kostenpflichtige Nutzungsfreigabe macht seine Dateien nicht vertraulich.

## Tatsächlich ausgeführte Prüfungen

Umgebung: Linux-Entwicklungscontainer, nicht privilegierter Benutzer (UID 1000), Node.js 24.22.3, npm 11.19.1. Die folgenden Ergebnisse gelten für Softwareprüfungen in dieser Umgebung, nicht für eine reale Kundenanlage. Einzelne Teilprüfungen überschneiden sich; die Zahlen dürfen nicht als disjunkte Gesamtsumme addiert werden.

| Prüfung | Ergebnis / Umfang | Beleg im Repository |
| --- | --- | --- |
| Backendbuild und TypeScript | Bestanden; gemeinsame Host-Typen und Backend gebaut | `reports/unified/root/backend-build.log`, `typecheck.log` |
| Fokussiertes Lint der neuen Grenzen | Bestanden, 0 Fehler | `reports/unified/root/lint-unified.log` |
| `npm test` | 144 Unified-/Lizenz-/Ownership-/HTTP-Tests plus 48 beibehaltene Sitzungs-, Upload- und Authentisierungsregressionen; alle bestanden | `reports/unified/root/npm-test.log` |
| Unveränderte offizielle ioBroker-Metadatenschemas | 3 Tests bestanden, in den 144 enthalten | `test/eos-unified-metadata.test.cjs` |
| Zentrale Lizenzsuite | 90 bestanden: Signatur/Schema, Truststore, Zeit-/Systembindung, Speicherung, HTTP und SDK | `reports/unified/licensing/license-tests.tap` |
| Originaler NWL3-Aussteller → Dienst → SDK | 2 bestanden mit temporären Testschlüsseln | `reports/unified/licensing/license-keygen-interop.tap` |
| Neue Feature- und Microgrid-Grenzen | 3 Feature-/HTTP- und 4 Mesh-Lizenztests bestanden; erlaubte und verweigerte Operationen | `reports/unified/licensing/feature-grants.tap`, `mesh-license-review.json` |
| Eingebettete UI-Laufzeit | 17 Tests bestanden, in den 144 enthalten; kein zweiter Listener, Schreibsperren, Lizenzstart, Status/SSE, Rollen und Featuregrenzen | `ui/reports/unified/hosted-runtime.log`, `para14a-lifecycle.log` |
| Tatsächliches `onReady` mit synthetischen Objekten | EMS initialisiert; 837 States, 2244 Objekte, 11 registrierte Timer. Injektierter EMS-Initialisierungsfehler führt zu explizitem degraded-Status | `ui/reports/unified/full-startup-mock.json`, `full-startup-test.log` |
| NVP/Dynamischer Netzanschluss | 208 Tests bestanden | `ui/reports/unified/nvp-dynamic-grid.log` |
| Erhaltene EMS-/Ladefälle | 20 Prüfskripte bestanden, u. a. OCPP, Auto/PV, günstige Netzladung, Nulleinspeisung und Heizstab | `ui/reports/unified/ems-regressions.json` und zugehörige Logs |
| Microgrid-Bestand | 20 Koordinator-, 4 Lifecycle-, 14 Trafo-, 7 Admin- und 12 Netz-Prüfgruppen bestanden; synthetische Gegenstellen | `reports/unified/licensing/`, `docs/unified/LICENSING_RUNTIME_LIMITS.md` |
| NexoLogic-Bestand | Lifecycle-/Aktuatorregressionen bestanden | `reports/unified/licensing/` |
| Systemfrontend | TypeScript/Vite-Build bestanden; 6 Tests bestanden; Assetgraph/Cacheprüfung bestanden; 0 Lintfehler, 3 bestehende Warnungen | `docs/reports/unified-9.0.0-alpha.1/FRONTEND.md` |
| Installerfrontend | TypeScript/Vite-Build bestanden | `ui/admin/react/`, `ui/docs/unified/HOSTED_RUNTIME_DE.md` |
| Installiertes npm-Paket mit ioBroker-Controller | 5 bestanden mit installiertem Tarball und Controller 7.2.5: Start, Login-Assets, Zugriffsschutz, zentrale Aktivierungsweiterleitung, CSRF/Logout. Netzwerk-Auflistung durch explizite Loopback-Testfixture ersetzt | `reports/unified/root/controller-integration.log` |
| Abhängigkeiten | Laufzeitbaum 0 bekannte Auditbefunde; Adminfrontend 0; Installer 0; Backend-Entwicklungsbaum 14 moderate, 0 hohe/kritische | `reports/unified/root/npm-*-audit*.json` |
| Gezielte Geheimnisprüfung | Kein tatsächlicher Treffer; 2 historische/Dateinamen-Fehlalarme geprüft. Historischer NW1-HMAC-Schlüssel entfernt. Keine Garantie für beliebige Geheimnisformate | `reports/unified/root/targeted-secret-scan.json`; Veröffentlichungsgate |
| Paket / Integrität | Abschließender readonly Releasecheck, npm-Packprüfung und `npm publish --dry-run --tag next` bestanden; Quell-/Laufzeitdateien mit SHA-256 gebunden | `release-manifests/unified/files.json`; externe Lieferprüfsummen |

Die ausführbaren UI-Quellen unter `ui/src-ts/runtime-executables/**` und ihre generierten JavaScript-Dateien sind synchronisiert. Historische Unterlagen und alte Tests im vollständigen Quellbaum wurden beibehalten; ihre früheren Freigaben gelten nicht automatisch für Version 9. Der aktuelle Einstieg ist das Wurzel-`package.json`, nicht ein separates Publish des internen UI-Moduls.

### Einordnung des installierten Tests

Das Paket wurde über npm installiert und vom offiziellen `@iobroker/testing`-Harness mit echten ioBroker-Objekt-/State-Datenbanken und Controllerkomponenten 7.2.5 gestartet. Der isolierte Executor verweigert `os.networkInterfaces()`; ausschließlich die Netzwerkinventarliste wurde über `test/fixtures/loopback-network.cjs` durch Loopback mit synthetischer MAC ersetzt. TCP, HTTP, Adapterprozess, Cookie-Sitzung und Datenbankzugriffe sind tatsächlich ausgeführt. Reproduktion in dieser eingeschränkten Umgebung: `EOS_TEST_NETWORK_FIXTURE=loopback NODE_OPTIONS="--require $PWD/test/fixtures/loopback-network.cjs" npm run test:integration`. Auf normalen Testhosts wird `npm run test:integration` ohne Fixture verwendet.

Der Test prüft den unaktivierten Zustand ohne echten Aussteller-Truststore; positive Aktivierung/Neustartpersistenz sind durch die gesonderten Dienst-/Ausstellerprüfungen abgedeckt, nicht durch diese installierte Testinstanz. Im Harness fehlen ein aktiver Host-Heartbeat und nutzbare externe Repositories; entsprechende Diagnosewarnungen sind erwartet. Der beim ersten installierten Lauf gefundene §14a-Stopbefund wurde korrigiert: Stop vor Initialisierung bereinigt Ressourcen ohne undefinierte Diagnose-States; wiederholter Stop schreibt nicht erneut. Zwei gezielte Tests und die bestehende §14a-EEBUS-Regressionssuite bestehen. Der installierte Test wurde anschließend erneut ausgeführt.

## Bewusste Grenzen und offene Abnahme

| ID | Befund / Auswirkung | Erforderlicher nächster Schritt |
| --- | --- | --- |
| EOS-A01 | **Alpha, keine Serien- oder CRA-Konformitätsfreigabe.** Die Integration besitzt Prüfbelege; vollständiger ASVS-/IEC-/Herstellerprozessnachweis fehlt. | Unabhängige Sicherheitsprüfung, Herstellerentscheidung, Produktgrenze, Support- und Meldeprozess vervollständigen. |
| EOS-A02 | Admin und EMS laufen im selben Node-Prozess. 50-ms-Lademanagement- bzw. 100-ms-Regelungsziele wurden nicht auf Zielhardware gemessen. | Last-, Eventloop-, Geräteausfall-, Wiederanlauf- und Anlagenabnahme auf Pi/IPC. |
| EOS-A03 | HTTPS ohne Port erfolgt über separaten TLS-Eingang 443 → Loopback 8188. npm richtet weder Zertifikat noch Rootdienst automatisch ein. `nginx -t` und echte 443-/Browserprüfung hier nicht ausgeführt. | Mitgelieferte feste Ingressvorlage rendern, auf Zielgerät validieren, Zertifikatsvertrauen und IPv4/IPv6 prüfen. |
| EOS-A04 | TOTP-Challenge und Passkeys sind nicht implementiert. Vorhandene TOTP-/fehlerhafte externe Auth-Konfiguration wird sicher abgelehnt; kein Passwort-Umgehungsweg. | Unterstützten MFA-Flow implementieren und abnehmen, bevor solche Konten freigegeben werden. |
| EOS-A05 | Logout widerruft derzeit global alle parallelen Sitzungen, einschließlich Socket/SSE. | Mehrnutzerverhalten berücksichtigen; Einzel-Sitzungswiderruf später separat implementieren. |
| EOS-A06 | Migrationswerkzeug erstellt aus einem exportierten Backup einen prüfbaren Offlineplan. Keine unbeaufsichtigte Live-Migration; alte Regler werden nicht automatisch gestoppt. | Backup/Restore, State-/Objektzuordnung, externe Referenzen und tatsächlichen Stopp des Altprozesses vor Übernahme prüfen. |
| EOS-A07 / LIC-RUNTIME-01 | Bereits konfigurierte Automatik kann bei Lizenzverlust mit zuletzt tatsächlich validierten, eingefrorenen Grenzen weiterlaufen. Nicht jeder neue wirtschaftliche Auftrag ist getrennt von Schutzfunktionen. | Auftragsgrenzen und gerätespezifisches Ablauf-/Downgradeverhalten vervollständigen; Einzelheiten in `LICENSING_RUNTIME_LIMITS.md`. |
| EOS-A08 | 14 moderate Auditbefunde im Entwicklungsbaum; Laufzeit und beide Frontendbäume ohne bekannte Auditbefunde. | Betroffene Buildwerkzeuge kontrolliert aktualisieren; keine Entwicklungsserver auf Kundengeräten; Details in `DEVELOPMENT_FINDINGS.md`. |
| EOS-A09 | Altbestand teilweise nur schwach typisiert; 3 bestehende Frontendlintwarnungen. Nicht produktiver historischer `runtime-mirrors`-Main-Prüfpfad ist noch nicht semantisch auf die Zusammenführung übertragen; Versuch endete Exit 1. | Spiegel fachlich migrieren, Typ-/Lintschulden schrittweise schließen. Keine Hash-only-Freigabe oder vollständige Altbestandstypprüfung behauptet. |
| EOS-A10 | Der öffentliche Truststore muss mit dem tatsächlichen Aussteller-Schlüssel auf dem Gerät provisioniert sein. Eine bestehende Lizenzdatei allein schafft keinen Vertrauensanker. | Öffentliche Ausstellerdaten nach `LICENSING.md` administrativ installieren; niemals den privaten Schlüssel auf Kundenhardware kopieren. |

Für die Hardware-/Betriebsabnahme ist NexoWatt zuständig; diese Punkte sind vor allgemeiner Produktionsfreigabe zu schließen oder fachlich belastbar zu behandeln. Bereits eingerichtete unabhängige Geräteschutzfunktionen werden durch die Lizenz-/Softwareprüfung nicht ersetzt. Weiterführende Bedrohungen, CRA-Anwendbarkeit und aktuelle Primärquellen: `SECURITY_CRA.md`, `SOURCES.md` und `COMMISSIONING.md`.

## Bereitstellung und Verwendung

Das Repository-ZIP enthält Quellen, generierte Laufzeit, Frontends, Lockfiles, Tests, Deploymentvorlage, Migrationsplaner, vier CycloneDX-SBOMs und die aktuellen Belege. Abhängigkeiten (`node_modules`), temporäre Buildkopien, Git-Verwaltungsdaten und verschachtelte Paketarchive sind nicht enthalten. Das separate npm-Tarball enthält das installierbare Paket gemäß geprüfter Dateiliste.

Der Integritätsnachweis ist ein Hashverzeichnis und **keine digitale Herstellersignatur**. Er prüft den vollständigen Repositorystand vor Packaging/Publish; er ist nicht als Quellprüfung eines allein installierten npm-Tarballs gedacht. Bei Änderungen zuerst bauen und prüfen, danach bewusst neu versiegeln. Publish darf ungeprüfte Änderungen nicht automatisch versiegeln.

Es wurde nichts nach Git oder npm veröffentlicht und kein Kundengerät verändert. Vorgesehen ist zunächst `next`, nicht `latest`. Die tatsächliche Berechtigung am npm-Paket und die Verfügbarkeit der Version müssen im eigenen Konto geprüft werden. Installations- und Veröffentlichungsanleitung: `INSTALL_PUBLISH.md`.
