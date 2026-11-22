# Systemoberfläche der gemeinsamen EOS-Version

Stand: 22.11.2026 · Version: 9.0.0-alpha.1

Die bestehende Admin-8-Systemverwaltung wurde aus ihren TypeScript-/React-Quellen neu gebaut. Sie bleibt Bestandteil desselben Adapters. Der Einstieg erfolgt unter `/system/`; Dashboard (`/`) und Installer (`/installer/`) sind feste Ziele derselben Origin. Die Rollenanzeige leitet keine Administratorrechte mehr allein vom Kontonamen ab. Die serverseitige Berechtigung bleibt maßgeblich.

Die Systemoberfläche verwendet die gemeinsame Cookie-Sitzung. Alte Browser-OAuth-Speichereinträge werden beim Start entfernt. Ein alter Login-Link führt zur zentralen `/login.html`. Abmelden ruft die zentrale Statusprüfung und anschließend den mit CSRF geschützten POST-Endpunkt auf. Eine fehlgeschlagene Abmeldung wird angezeigt und nicht als erfolgreicher Widerruf ausgegeben.

Lizenzverwaltung und Kontoeinstellungen verwenden absolute gemeinsame API-Pfade. Die Lizenzmaske bleibt dieselbe zentrale Lizenzautorität; es gibt keine eigene Admin-Lizenz. Eine bestehende gültige Aktivierung muss beim Öffnen der Systemverwaltung nicht erneut eingegeben werden. Der zentrale Statusparser akzeptiert die vom vorhandenen Prüfkern unterstützten ioBroker-UUID-Varianten.

Die EMS-Diagnose liest den Namespace der tatsächlich verbundenen EOS-Instanz. Sie sucht keinen separaten UI-Adapter mehr und wählt nicht die vermeintlich neueste andere Anlage aus. Die getrennte Admin-PWA-Verknüpfung wurde entfernt; die Installation der Web-App erfolgt über den gemeinsamen Dashboard-Einstieg.

## Ausgeführte Prüfungen

| Prüfung | Ergebnis | Beleg |
| --- | --- | --- |
| Quellenbau einschließlich TypeScript | Bestanden, Admin-Laufzeit in `adminWww/` neu erzeugt | `frontend-build.log`, `adminWww/NEXOWATT_EOS_FRONTEND_MANIFEST.json` |
| Lizenz-URL, UUID-Status und Abmeldung einschließlich Fehlerfällen | 6 Tests bestanden | `frontend-tests.log` |
| Lint der geänderten TypeScript-/React-Dateien | 0 Fehler; 3 bestehende Warnungen | `frontend-lint.log` |
| Syntax geänderter öffentlicher JavaScript-Module | Bestanden | `frontend-validation.json` |
| Erreichbarkeit der gebauten Modulimporte | Bestanden | `frontend-graph.log` |
| Versionsgebundene Cache-Invalidierung öffentlicher Assets | Bestanden | `frontend-public-assets.log` |

Die drei Lint-Warnungen betreffen bestehende React-Hook-Abhängigkeiten in EMS-Übersicht und Lizenzdialog sowie eine bestehende Klassenmethode ohne `this` in der Übersicht. Sie wurden nicht pauschal abgeschaltet. Vite meldet erwartete klassische öffentliche Skripte und große Chunks; diese Dateien werden separat ausgeliefert und durch das Artefaktmanifest erfasst.

Die Prüfungen oben sind Softwareprüfungen. Eine echte ioBroker-Installation, reale Browser-Navigation mit Geräten, Zielhardware-Latenzen und Anlagenregelung sind damit nicht abgenommen. Die vollständige Anmeldung einschließlich MFA, Sitzungssperre, WebSocket-Widerruf sowie der 443→8188-Betrieb müssen in den gemeinsamen Integrationsnachweisen getrennt bewertet werden.
