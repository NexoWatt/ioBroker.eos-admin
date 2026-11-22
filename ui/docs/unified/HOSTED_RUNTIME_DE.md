# NexoWatt EOS 9.0.0-alpha.1: integrierte UI

Dieses Verzeichnis ist ein internes Modul des proprietären `iobroker.eos-admin`. Es ist kein separat installierbarer oder veröffentlichbarer Adapter. `ui/package.json` ist privat; veröffentlicht wird ausschließlich das geprüfte Paket im Repository-Stamm.

## Laufzeit und Daten

`createHostedRuntime(owner, bridge)` aus `ui/main.js` läuft im selben Prozess wie der einzige EOS-Adapter. Es erzeugt weder eine Adapter-Core-Instanz noch einen eigenen HTTP-Listener. Der bestehende Owner stellt Datenbankzugriff, Timer, Log und kontrollierte Geräteschreibzugriffe bereit. EMS, SmartHome und vorhandene UI-Assets bleiben integriert.

| Vertrag | Bedeutung |
| --- | --- |
| `start()` / `stop()` | Einmaliger Start und idempotentes Beenden |
| `handle(req,res,next)` | Express-Router auf dem zentralen HTTP-Server |
| `onStateChange` / `onMessage` | Weiterleitung aus dem einzigen Adapter-Lifecycle; unbekannte Message-Kommandos liefern `false` |
| `status()` | `unlicensed`, `blocked`, `starting`, `ready` oder `degraded`; EMS-Fehler bleiben erkennbar |
| `revokeSessions()` | Schließt bestehende UI-SSE-Verbindungen |
| `bridge.resolveAccess(req)` | Zentrale Identität, Rollen, Capability-Menge und CSRF-/Credential-Bindung |
| `bridge.getLicense()` | Nur öffentliche, zentral verifizierte Lizenzansicht |
| `bridge.canWrite()` | Aktuelle Ownership vor jedem fremden State-Schreibzugriff |
| `bridge.originAllowed(req)` | Transport/Host und browsergerechte Origin-Prüfung |
| `bridge.machineRequestAllowed(req)` | Eng begrenzte tokenauthentifizierte Maschinenrouten ohne Browser-Metadaten |

Neue Datenpunkte verwenden den Namespace des Owners, beispielsweise `eos-admin.0`. Native UI-Einstellungen liegen unter `system.adapter.eos-admin.0.native.eosUi`. Historische interne Self-Instance-Schreibzugriffe werden in diesen Unterbaum übersetzt; sie dürfen Port, Authentifizierung, TLS oder die Instanzidentität nicht ersetzen. Die Migration vorhandener `nexowatt-ui.*` Daten und der Ausschluss paralleler Aktor-Owner erfolgen durch den zentralen Migrations-/Ownership-Dienst.

## Zugang und Lizenz

Dashboard `/`, Installer `/installer/`, Systemverwaltung `/system/` und Aktivierung `/nexowatt/license` teilen eine Origin und die zentrale Sitzung. Eine erfolgreiche Erstanmeldung führt abhängig vom zentralen Status zuerst zur Passwortänderung oder zur einmaligen Aktivierung. Die UI besitzt keinen zweiten Passwortspeicher, Session-Aussteller oder Lizenzverifizierer. Der ehemalige eingebettete HMAC-Verifizierer wurde entfernt.

Eine initial ungültige Lizenz oder fehlende Ownership startet ausschließlich die geschützte Shell. Nach gültiger Aktivierung startet die Regelung beim nächsten Zugriff genau einmal. Alle UI-Anfragen aktualisieren die zentrale Lizenzansicht; HTTP-Schreibzugriffe benötigen außerdem die aktuelle Sitzung, Capability, Origin und CSRF-Bindung. SSE-Zugriffe werden erneut geprüft; Credential-Wechsel und Rechteverlust beenden die Verbindung. Installer erhalten keine implizite Simulationserlaubnis.

Bereits in Betrieb genommene Regelpfade behalten bei einem vorübergehenden Ausfall der Lizenzansicht ausschließlich den letzten validierten, eingefrorenen Grant-/Limit-Snapshot. Dadurch werden Geräte nicht ungeprüft auf null oder Stopp gesetzt. Diese Alpha trennt noch nicht jeden autonomen Optimierungsauftrag von Schutz-/Regelaufgaben: Bereits konfigurierte, zuvor erlaubte Automatiken können weiterlaufen. Neue HTTP-Konfiguration oder Aktivierung benötigt die frische gültige zentrale Lizenz. Dies ist keine Zusicherung vollständiger Ablauf-/Widerrufsabschaltung. Siehe zentrale Dokumentation `docs/unified/LICENSING_RUNTIME_LIMITS.md` im Repository-Stamm.

Der Service Worker entfernt alte NexoWatt-Caches und meldet sich ab. Es gibt keine Offline-Auslieferung geschützter Seiten oder API-Daten.

## Nachweise und Grenzen

Die ausführbare kanonische Quelle liegt unter `src-ts/runtime-executables/`; `node scripts/build-ts-runtime-executables.js` erzeugt die JavaScript-Dateien. Der Installer wird aus `src-admin-tab` gebaut.

`npm run test:unified` prüft die echte Hosted-Fassade, Auth-/Origin-Grenzen, Namespace-Konfiguration, zentrale Feature-/Limit-Bindung und Startup mit controllerähnlicher Datenbank-Fixture. Ein injizierter EMS-Startfehler muss als `degraded` sichtbar bleiben. Die HTTP-Fixture verwendet ausdrücklich bestätigte Test-Sitzungen; sie ersetzt keinen realen OAuth-Nachweis.

Zusätzlich wurden 208 NVP-/Dynamic-Grid-Tests und 20 erhaltene Lade-/OCPP-/Speicher-/Zero-Export-Regressionsskripte ausgeführt. Ergebnisse liegen unter `reports/unified/`. Diese Nachweise ersetzen weder Tests an realer Hardware noch die installationsbezogene elektrische Freigabe, Last-/Zeitmessung oder die CRA-Konformitätsbewertung des Gesamtprodukts.
