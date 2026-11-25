# Anmeldung bei pausierter UI/EMS-Laufzeit

Stand: 25.11.2026, Recovery-Arbeitsstand 9.0.25. Dieser Befund wurde bei der abschließenden Prüfung der neuen Prozesssteuerung entdeckt und vor Auslieferung korrigiert.

## Befund und Korrektur

Die Runtime-Verwaltung und der OAuth-Login liefen bereits im Adminprozess. Die bestehende `/login.html` und ihre Assets wurden jedoch an den UI-Child weitergereicht. Bei bewusst pausiertem UI/EMS-Child war somit die Passwortmaske für einen frischen Browser beziehungsweise nach Sitzungsablauf nicht erreichbar. Der bisherige Runtime-Redirect enthielt außerdem weder Admin-Anmeldeabsicht noch den Rücksprung in die Runtime-Verwaltung.

Der Parent bedient nun die unveränderte bestehende Loginseite und ausschließlich ihre festen Login-/PWA-/Icon-Dateien. Es wird kein beliebiger Dateipfad und kein neues statisches Verzeichnis geöffnet. Die bestehenden Originprüfungen, `no-store`, `nosniff`, Framing-, Referrer-, Permissions- und CSP-Header werden auch auf diesem Weg gesetzt. Die Anmeldung nutzt unverändert den bestehenden OAuth-Issuer, dieselben geschützten Cookies und dieselbe revokebare Sitzungsverwaltung. Die UI wird zum Anzeigen der Anmeldung nicht gestartet.

Eine anonyme oder Kiosk-Anfrage an `/runtime/` führt nach `/login.html?admin=1&returnTo=%2Fruntime%2F`. `admin=1` verhindert die automatische Kiosk-Rückkehr; der feste Rücksprung wird in der Login-Quelle ausschließlich für die bestätigte Adminrolle zugelassen. Andere administrative Seiten und APIs behalten ihre bestehenden Zugangsregeln. Der Login-Frontend-Testbericht dokumentiert den ergänzenden Browserablauf und die Rollen-/Rücksprungprüfungen.

## Tatsächlich ausgeführte Integration

Die neue Regression in `test/eos-unified-listen.test.cjs` verwendet die tatsächliche `Web.mountUnifiedRuntime`-Montage, HTTPS mit geprüftem Testzertifikat, den gebündelten OAuth-Issuer, die echte EOS-SessionSecurity, frische Cookies und einen echten UI-Unterprozess. Die Controller-Datenbank und Passwortprüfung sind synthetisch. Weil kein produktiver Controller installiert ist, wird ausschließlich dessen Dateisystemlocator im Test ersetzt; UI, EMS und Owner-IPC bleiben echter Produktcode.

| Fall | Node 22.23.4 | Node 24.22.3 |
| --- | ---: | ---: |
| Persistiert pausierte UI ohne PID: anonymer Runtime-Aufruf, Login/Assets, Passwortanmeldung, Runtime/API und autorisiertes Aktivieren mit neuem Child | bestanden | bestanden |
| Hängender Runtime-Konfigurationsread: fünf Sekunden Deadline, danach Login/Assets/Passwortanmeldung und Runtime-Diagnose erreichbar; keine Startfreigabe | bestanden | bestanden |

Beide Läufe: 2/2, keine Fehler oder übersprungenen Fälle. Fremde Origin und anonyme Runtime-API sind in beiden Fällen abgewiesen. Die Login-/CSS-/JS-/PWA-Dateien sind beim fehlenden UI-PID erreichbar und tragen die Sicherheits-/Cacheheader.

```sh
node --test --test-name-pattern='parent login remains usable' test/eos-unified-listen.test.cjs
```

Rohprotokolle und Hashes dieser Backend-/Teständerung liegen unter `raw/runtime-login-recovery/`. Die bestehende Runtime-Health-Regression erwartet jetzt den expliziten Admin-Return-Redirect. Vollständige Browserprüfung, übrige HTTP-/Auth-Regression und finaler Releasebuild werden zusätzlich durch die Releaseprüfung ausgeführt.

## Grenzen

Die Tests belegen die Erreichbarkeit und Anmeldung des Admin-Recoverywegs bei gestoppter UI und fehlender Runtime-Konfigurationsantwort. Sie sind kein Test eines realen Kundensystems, elektrischer Abschaltwirkungen oder sämtlicher denkbarer Controllerfehler. Eine fehlerhafte Runtime-Konfiguration wird durch den Login nicht umgangen; der konkrete Blockadecode bleibt sichtbar und die Startfreigabe gesperrt.
