# EOS 9.0.24 – integrierte OCPP-Verwaltung

Stand: 25.11.2026. Lokaler Implementierungs- und Prüfvermerk für Verwaltungsoberfläche, HTTP-Zugriff und Prozessdiagnose. Keine Freigabe einer Kundenanlage oder eines bestimmten Ladegeräts.

## Bedienung

Die EOS-Administration und die vorhandenen Modulnavigationen führen zu `/modules/ocpp/`. Die Seite zeigt den gespeicherten WebSocket-Port, die daraus abgeleitete Verbindungsadresse, den bestätigten Prozesszustand/PID, die Modulversion und Stationsdiagnosen. Stationskennung, Protokoll, Verbindung, Messwertaktualität und Prozessfreigabe kommen aus dem gehosteten OCPP-Modul. Wichtige native Datenpunkte sind aufklappbar. OCPP-RPCs und Ladebefehle werden durch diese Verwaltungsseite nicht angeboten.

Die Konfiguration enthält die unterstützten nativen OCPP-Felder. Neue Konfigurationen sind standardmäßig deaktiviert. Veraltete Kompatibilitätswerte (`createTechnicalAliases`, `createPublicAliases`, `cleanupLegacyObjects`, `zeroLimitBehavior`) werden nicht als neue Bedienoption angeboten, aber beim Speichern vollständig erhalten. Zahlenbereiche entsprechen dem Modulvalidator; gültige importierte Werte werden nicht auf die engeren Eingabebereiche der früheren Adapter-JSON-Oberfläche reduziert. Eine Speicherung verwendet die Revision des tatsächlich geladenen Entwurfs. Konflikte überschreiben weder gespeicherte Konfiguration noch lokale Eingaben.

Für eine manuelle Übernahme muss das integrierte Zielmodul deaktiviert und bestätigt gestoppt sein. Die bisherige `ocpp21.N`-Instanz wird zuerst ebenfalls deaktiviert und vollständig gestoppt. Die Oberfläche verwendet die serverseitig ausgewiesene Importberechtigung und erklärt eine Sperre. Nach bestätigtem Import bleibt die Konfiguration deaktiviert; ihre alten Datenpunktnamen bleiben erhalten. Erst nach Prüfung von Port, Stationszuordnung und elektrischen Grenzen wird das Modul ausdrücklich aktiviert. Bereits übernommene Namespaces können nicht über diese Schaltfläche erneut ersetzt werden. Die produktive Übernahmeprüfung und Persistenz liegen im Modulhost, nicht im Browser.

Die sichtbare Seite aktualisiert den Status nach jeweils fünf Sekunden, ohne lokale Eingaben zu ersetzen. Es gibt höchstens eine automatische GET-Abfrage gleichzeitig, mit einer Frist von 15 Sekunden. Versteckte Seiten brechen die Statusabfrage ab und entfernen den Timer; bei Rückkehr erfolgt eine unmittelbare Abfrage. Fehlende HTTP- oder Child-Statusbestätigung entfernt zuvor grüne Stationsanzeigen. Berechtigungsverlust deaktiviert Schreibaktionen und stoppt automatische Abfragen.

## Zugriff und Prozessdiagnose

HTML, Skript, Styles, Feldschema und API verwenden die vorhandenen EOS-Guards: frische Anmeldung, Adminrolle, Erstanmeldungsregel und Originprüfung. PUT und Import benötigen das sitzungsgebundene CSRF-Token; PUT zusätzlich die Konfigurationsrevision. HTML liefert eine Same-Origin-CSP und `nosniff`; Antworten sind `no-store`. Der Browser setzt Stationsdaten ausschließlich als Text. Der OCPP-Modulpfad besitzt keinen generischen `/command`-HTTP-Endpunkt.

`/runtime/` zeigt nun zusätzlich den gehosteten OCPP-Child. Eine bestätigte gestoppte externe Instanz mit demselben übernommenen Namespace wird nicht als weiterer Prozess gezählt. Eine tatsächlich laufende oder unbestätigte externe Instanz bleibt sichtbar, damit eine mögliche Doppelzuständigkeit nicht verborgen wird. Externe PIDs werden weiterhin ausschließlich aus bestätigten Controller-Zuständen gelesen. Fehler bei der externen Inventarisierung ersetzen den gehosteten OCPP-Prozessstatus nicht. Diagnoseantworten enthalten keine Konfiguration, Lizenz oder rohen Fehlertexte.

## Nachweise und Grenzen

| Prüfung | Tatsächlicher Umfang |
| --- | --- |
| HTTP/Runtime/Admin-Regressionsgruppe | 38 Tests auf Node 22 und Node 24; feste Assets, Anmeldung/Rollen, Origin, CSRF, Revision/409, Legacyimport, Namespaceprojektion, Secretfilter, begrenzte Inventarisierung und unveränderte bestehende Modul-/Editorzugriffe |
| OCPP-Browserprüfung | Echtes Chromium 158; Produktions-HTML/CSS/JS/Feldschema und HTTP-Routen; Desktop 1440 px, Mobil 390 px; echte Session und CSRF; keine JavaScript-Ausnahme/Seitenüberbreite |
| Bearbeitung und Lebenszyklus | Reale Fünfsekundentimer, erhaltene Entwürfe und verdeckte Altwerte, ungültiger Port/Protokoll/Kennung, 409-Konflikt, gesperrter Import bis Deaktivierung, deaktivierter Import mit erhaltenen IDs, HTTP-/Child-Statusverlust, Pollabbruch und Wiederaufnahme, Rechteverlust |
| Prozessdiagnose im Browser | Sieben getrennte Karten im Prüffall: Admin, UI/EMS, Devices, EEBus, Backup, gehostetes OCPP und eine externe OCPP-Instanz; bestehende Fehler-/Hidden-/BFcache-Prüfungen weiterhin erfolgreich |
| Codequalität | Strikte Typprüfung `tsconfig.eos-ocpp-admin.json` und `tsconfig.eos-runtime-health.json`; ESLint über Produktcode und neue Tests; `git diff --check` |

Rohnachweise: `raw/current/ocpp-admin-http-node22.txt`, `ocpp-admin-http-node24.txt`, `ocpp-admin-browser.json`, `ocpp-admin-browser-node22.json` und `runtime-health-browser.json`. Browserberichte enthalten SHA-256 der geprüften Produktdateien. Node-Warnungen zur Testfunktion `stripTypeScriptTypes` und zum Proxy-Agent sind in den zugehörigen Stderr-Dateien abgelegt.

Die OCPP-Browserprüfung verwendet simulierte Modulpersistenz, Statuswerte und einen simulierten Legacyimport hinter den tatsächlichen HTTP- und Sessiongrenzen. Sie ersetzt keine Modulhost-, Migrations-, Prozess- oder OCPP-Protokollintegration; diese Nachweise sind separat zu führen. Sichtbarkeits- und BFcache-Ereignisse werden gezielt ausgelöst. Kein physisches Ladegerät, Produktionscontroller oder tatsächlicher Energiefluss wurde durch diesen Oberflächentest bestätigt. Das Idle-Skript wird in diesem Browserfixture ausgeblendet; dessen Rechte- und Ablaufprüfung bleibt Gegenstand der bestehenden Sessionregression.
