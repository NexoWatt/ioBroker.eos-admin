# Prozesssteuerung – Backend und Lebenszyklus

Stand: 25.11.2026, Recovery-Arbeitsstand 9.0.25. Ergänzt wurden die Bedienfreigaben für die fünf vorhandenen Prozesse UI/EMS, Devices, EEBUS, Backup und OCPP. Der Adminprozess bleibt erreichbar und ist kein steuerbares Ziel; externe OCPP-Adapter bleiben reine Anzeigen.

## Umsetzung und Funktionserhaltung

- Ohne gespeicherten Runtime-Datensatz sind alle fünf Prozessfreigaben `true`, ohne Schreibzugriff beim Initiallesen. Tatsächlicher Start benötigt weiterhin die vorhandene Modulkonfiguration, Lizenz, Migration und eindeutige Ownership. Ein freigegebener, aber unkonfigurierter OCPP-Server bindet keinen Port.
- Ein Bedien-Stopp wird getrennt von Modulprofilen im geschützten verschlüsselten Datensatz `eos-admin.N.modules.runtime.configuration` gespeichert und bleibt nach neuem Host-/Service-Lebenszyklus bestehen. Modulkonfigurationsänderungen heben ihn nicht auf.
- Aktivieren und Neustarten speichern zunächst eine Abschaltung. Erst nach bestätigtem Prozessende, abgeschlossenen angenommenen Schreibvorgängen und Subscription-Bereinigung wird die neue Freigabe gespeichert und gestartet. Ein Stopfehler hält die Freigabe dauerhaft aus; für den betroffenen laufenden Admin-Lebenszyklus bleiben weitere Starts gesperrt.
- UI-Pause ist vom endgültigen Adapter-Shutdown getrennt. Sie beendet den UI-/EMS-Child, lässt Admin und Prozesssteuerung erreichbar und kann nach abgeschlossenem Drain einen neuen Child erzeugen. Normale Startup-Callbacks oder ein Crash-Retry dürfen eine bewusste Pause nicht aufheben. Endgültiges Stop bleibt endgültig.
- Der neue Controlservice führt keinen periodischen Poll und keinen weiteren Worker ein. Er hält eine feste Liste von fünf IDs, eine Initialisierungs-Promise und höchstens einen angenommenen Bedienauftrag. Ein hängender Initialread endet nach maximal fünf Sekunden mit sichtbarem Fehler und gesperrter Freigabe; eine späte Antwort aktiviert nichts.
- `close()` sperrt neue Aufträge sofort und wartet im regulären Owner-Unload auf bereits angenommene Aufträge. Die vorhandene äußere ioBroker-Unloadfrist ist unverändert; ein erzwungenes Prozessende ist keine Bestätigung der physischen Gerätezustände.

## HTTP-Vertrag und Berechtigungen

`GET /api/eos/runtime` enthält den CSRF-Token und je internem Child die erlaubten Aktionen, gespeicherte Freigabe, Revision, Bearbeitungsstatus und einen begrenzten Fehlercode. `POST /api/eos/runtime/:id/control` akzeptiert ausschließlich `{action, expectedRevision}` mit `enable`, `disable` oder `restart` und bestätigt die Auftragsannahme mit HTTP 202. Der anschließende GET liefert den tatsächlichen Zustand; Annahme ist keine Behauptung eines erfolgreichen Starts.

Adminrolle, Erstlogin, Same-Origin und CSRF werden vor und erneut direkt nach dem JSON-Parser geprüft. Dadurch kann ein langsamer Body einen zwischenzeitlichen Rollen-/Session-/CSRF-Widerruf nicht überbrücken. Eine feste Zielmenge, globale Revisionsprüfung und höchstens ein laufender Auftrag verhindern freie Prozessbefehle und konkurrierende Steuervorgänge. Ein Browserabbruch hebt die Auftragsperre nicht auf. Startgates werden nicht durch UI-Bedienung ersetzt; normale Startblockaden verhindern keinen autorisierten Stop.

## Nachweise

| Prüfung | Node 22.23.4 | Node 24.22.3 |
| --- | ---: | ---: |
| Service/Store, unabhängiger HTTP-/Transaktionsreview, echte Devices-/OCPP-Children und UI-Children | 36/36 | 36/36 |
| Fehlgeschlagen / übersprungen | 0 / 0 | 0 / 0 |

Befehl je Node-Binary im Repository:

```sh
node --test test/eos-runtime-control.test.cjs \
  test/eos-runtime-controls-review.test.cjs \
  test/eos-runtime-control-processes.test.cjs \
  test/eos-ui-process.test.cjs
```

Enthalten sind alle fünf Defaultfreigaben ohne Writes, persistierter Stop und bestätigter Restart, Lizenz-/Ownership-/Migrationsblockaden, deaktivierte Modulkonfiguration, Speicherfehler und stale Revision, unbekannte Prozess-IDs, Initialread-Timeout mit später Auflösung, geänderte ACL, Close während Stop und Commit, Slow-body-Rechtewiderruf, reale neue PID/Generation, unveränderte Nachbarprozesse/Verbindungen und verworfene alte OCPP-Kommandos im nativen und übernommenen Namensraum.

Die UI-Fälle prüfen einen gehaltenen angenommenen Controllerwrite sowie eine während der Initialisierung verspätete Subscription-Akquisition: Pause/Resume bleiben bis zum echten Abschluss gesperrt; danach existiert genau die Subscription des neuen Childs. Rohprotokolle und Hashliste der geprüften Produkt-/Testdateien liegen in `raw/runtime-control-backend/`. Die separat berichteten 5er-/9er-/Browserläufe überschneiden sich mit diesen Tests und dürfen nicht als zusätzliche unterschiedliche Fälle aufsummiert werden.

Zusätzlich erfolgreich ausgeführt:

```sh
node node_modules/typescript/bin/tsc -p tsconfig.eos-runtime-control.json --pretty false
node node_modules/typescript/bin/tsc -p tsconfig.eos-runtime-health.json --pretty false
node node_modules/typescript/bin/tsc -p tsconfig.ui-process.json --pretty false
node node_modules/typescript/bin/tsc -p tsconfig.build.json --noEmit --pretty false
node node_modules/eslint/bin/eslint.js -c eslint.unified.config.mjs \
  src/lib/eosRuntimeControl.js src/lib/eosModuleHost.js \
  src/lib/eosModuleHttp.js src/lib/eosModuleConfigStore.js test/eos-runtime-control.test.cjs
node node_modules/eslint/bin/eslint.js -c eslint.runtime-health.config.mjs src/lib/eosRuntimeHealth.js
node node_modules/eslint/bin/eslint.js -c eslint.config.mjs src/lib/eosUiProcess.ts src/lib/web.ts src/main.ts
```

Der neue Controlservice wird tatsächlich mit `checkJs`, Strict, `noUncheckedIndexedAccess` und `exactOptionalPropertyTypes` geprüft. Der bereits vorhandene `eosModuleConfigStore.js` bleibt wie vorher im Backendprofil mit `checkJs:false`; seine neue Deklaration beschreibt die konsumierte Grenze und stellt keinen Nachweis einer vollständigen Strict-Typprüfung dieser bestehenden JS-Implementierung dar. Im Store selbst wurde nur die erlaubte feste ID `runtime` ergänzt. Ausführbare Lintregeln und die vorhandenen CAS-/ACL-/Decrypt-Regressionen bleiben erhalten; die neuen Servicefälle nutzen den echten Store mit synthetischer Datenbank.

## Grenzen

Die Prozess- und HTTP-Verbindungen sind echt, die Controllerdatenbank und OCPP-Gegenstellen sind isolierte Fixtures. Die genannten Läufe bedienen keine Kundenanlage, physische Wallbox, EEBUS-Geräte oder Raspberry-Pi-Hardware. Elektrische Abschaltwirkung, Verhalten nach Netzausfall, realer Controller-Neustart und Dauerbetrieb benötigen die Anlagenprüfung. Es wurde keine RAM-Ersparnis gemessen und keine pauschale Ausfallsicherheitsgarantie abgeleitet. Vollständige Releasebuilds, übrige Regression und Paket-/Publish-Prüfung sind separat nachzuweisen.
