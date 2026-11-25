# EOS 9.0.24 – Kiosk-Backend

Der Dashboard-Kiosk ist standardmäßig deaktiviert. Eine ausdrücklich angemeldete Admin-Sitzung kann ihn über `GET /api/eos/kiosk` lesen und mit `PUT /api/eos/kiosk` ändern. Der Schreibvertrag lautet `{enabled: boolean, revision: number}`; Origin, CSRF, aktuelle Admin-Berechtigung und Revision werden geprüft. Die Konfiguration liegt außerhalb des Adapterinstanzobjekts unter `eos-admin.N.kiosk.configuration` mit Admin-ACL `0x600`.

Beim Einschalten werden bestehende normale Sitzungen widerrufen. Der anonyme Kiosk erhält eine eigene signierte HttpOnly-/SameSite-Strict-Capability ohne ioBroker-Benutzerkonto. Seine einzige Capability ist `frontend.open`. `?admin=1` unterdrückt den anonymen Ersatz bei Status- und Idle-Abfragen. Eine echte Anmeldung verwendet weiterhin die vorhandene OAuth-/Passwortdatenbank und das normale zehnminütige Inaktivitätslimit.

Der Kiosk besitzt kein Inaktivitätslimit. Seine Betriebsbedienung ist durch eine Routenliste und bei `/api/set` zusätzlich durch validierte Scope-/Key-/Wert-Kombinationen begrenzt. Die Liste wurde mit den tatsächlichen Payloads in `www/app.ts`, `www/evcs.ts` und `www/smarthome.ts` abgeglichen: Ladepunktfreigabe, Regelung, PV-/Auto-/Boost-Modi, Speicherhilfe, Ladeziel, Phasenmodus, konfigurierte Energiefluss-Schnellsteuerungen sowie konfigurierte SmartHome-Bedienung. Installationsparameter, Sicherungs-/Stromgrenzen, beliebige Datenpunkte und technische Einstellungen bleiben gesperrt. Bestehende Fachlogik prüft weiter Gerätekonfiguration, Lizenz, Bereitschaft und Sollwertgrenzen.

Die normale Kundenprojektion redigiert `/config` und `/api/state`; der Kiosk erhält keine Installer-Projektion. Das Abschalten rotiert die Capability-Signatur und beendet offene Kiosk-Streams sowie UI-Requests. Bereits gebootstrapte Request-Objekte werden ebenfalls gegen die neue Signatur geprüft. Benutzer-/Passwortinitialisierung und Lizenz werden beim anonymen Zugriff erneut geprüft. Öffentliche Stationslinks behalten ihre getrennte, bestehende Tokenprüfung und erhalten keine globale Sitzung.

## Verifikation

- `test/eos-kiosk-http.test.cjs`: 4 echte HTTP-Fälle mit realem Web-Router, UnifiedSessions, SessionSecurity und gepinntem OAuth-Modell; explizite Inprozess-UI-Testnaht für den simulierten Controller. Enthalten sind echter HTTP-Passwortlogin mit falschem/richtigem Passwort, alte Admin-/Refresh-Sitzung, 30 Tage simulierte Kiosk-Dauer, technische API-Sperren, CSRF/Origin, Konfigurations-Secrets, Abschalten sowie Lizenz-/Erstpasswortgrenzen.
- `test/eos-kiosk-process.test.cjs`: 4 Fälle für Signaturrotation, Request-/Stream-Widerruf, negative Eingaben, tatsächliche Dashboard-Payloads und einen echten UI-Kindprozess mit produktivem `ui/main.js`. Ein konfigurierter Stationslink liefert ohne Cookies vor und nach Kiosk-Abschaltung HTTP 200; gefälschte Rollen-/Prozessheader öffnen keinen Installerzugriff.
- `test/eos-kiosk-independent-review.test.cjs`: 3 zusätzliche unabhängige HTTP-/Widerrufstests, einschließlich verzögerter Kontoprüfung während Abschaltung.
- Alle 11 Fälle unter Node.js 22 und 24 bestanden. Bestehende Idle-/Unified-Boundary-Suite einschließlich der neuen HTTP-Fälle: 23/23 bestanden. TypeScript-Prüfung und ESLint für `eosKiosk.ts`, `web.ts`, `eosUnifiedBoundary.js` bestanden.

Die Tests verwenden einen simulierten Controller und lokale HTTP-/Prozessgrenzen. Sie sind kein Hardware- oder mehrwöchiger Anlagen-Dauerlauf. Paketbuild, vollständige Gesamtsuiten und Browsernachweis werden separat im Release geprüft.
