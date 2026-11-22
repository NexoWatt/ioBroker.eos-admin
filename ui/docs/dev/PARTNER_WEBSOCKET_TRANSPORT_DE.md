# Partner-WSS-Transport

Stand: 28.10.2026. Implementierung: `src-ts/runtime-executables/lib/partner-websocket.ts`.
Der ausführbare Spiegel wird ausschließlich mit dem vorhandenen Runtime-Build erzeugt.
Dieses Modul schreibt weder ioBroker-States noch Geräte. Fachliche Rechte, Befehls-ID,
Lease, TTL, Datenprojektion und sichere Geräteübergänge bleiben im Partnerdienst und
in der zentralen Speicherregelung verbindlich.

## Lokaler Vertrag

`PartnerWebSocketClient(config, hooks, dependencies?)` bietet `start()`, `stop()` und
`send(text)`. Je Partner wird eine Instanz angelegt. Änderungen an Ziel, Identität,
Geheimnis oder Freigabe beenden die bisherige Instanz; die neue Konfiguration benötigt
eine neue Instanz. `stop()` ist synchron und verwirft alle Transportpuffer.

Die Konfiguration enthält `partnerId`, `endpoint`, die exakt erlaubten Werte
`allowedEndpoint.hostname`, `.port`, `.path` und `credentials.expiresAtMs`. Ein
installationsspezifischer Bearer-Token oder Clientzertifikat mit privatem Schlüssel
wird ausschließlich aus geschützter lokaler Konfiguration geliefert. Für eine eigene
Partner-PKI kann `caPem` deren Vertrauensanker festlegen. Ohne eigene CA gilt der
Node-Vertrauensspeicher mit obligatorischer Namens- und Kettenprüfung. Tokenbeschaffung
über OAuth ist nicht in diesem Transport implementiert; der Aufrufer liefert gültiges
Material und organisiert dessen Rotation. Geheimnisse gelangen nicht in URLs, Status
oder Fehlerausgaben.

Der verpflichtende Hook `isAuthorized()` wird beim Aufbau, vor jeder eingehenden
Nachricht, vor jeder Aussendung und mindestens bei jedem Autorisierungstakt geprüft.
`onMessage(partnerId, text, context)` erhält die lokale Partneridentität, niemals eine
Identitätsbehauptung aus der Nachricht. Der Dienst validiert den Text vollständig.
Nach einem `await` muss er `context.isCurrent()` sowie die fachliche Berechtigung
erneut prüfen. Antworten erfolgen durch `context.send(text)`, damit eine Antwort aus
einer alten Verbindung nicht über eine neue Verbindung gesendet werden kann.
`context.signal` wird bei Abbruch, Widerruf und Wiederverbindung abgebrochen. Ein
bereits laufender fachlicher Handler wird dadurch nicht magisch rückgängig gemacht:
der Dienst muss vor Wirkung erneut prüfen und seine Leases bei Verbindungsverlust
widerrufen. `onState` liefert ausschließlich feste Zustände und Fehlercodes.

## Sicherheitsgrenzen

- Ausschließlich WSS und Unterprotokoll `nexowatt.partner.v1`; keine Redirects, URL-
  Zugangsdaten, Query-Parameter, IP-Literale oder fremden Zielpfade.
- A- und AAAA-Antworten werden geprüft. Gemischte öffentliche/unerlaubte Antworten
  werden vollständig verworfen. Der Verbindungsaufbau verwendet ausschließlich eine
  geprüfte IP; die tatsächliche entfernte Socketadresse muss danach übereinstimmen.
- Private Adressen sind standardmäßig gesperrt. Ein lokales geprüftes VPN-Profil kann
  einzelne private IPs in `privateVpnAddresses` zulassen. Loopback, Link-local und
  bekannte Cloud-Metadatenadressen werden dadurch nicht freigeschaltet.
- TLS-Gegenstellenprüfung bleibt aktiv; TLS mindestens 1.2. Client-/Serverzertifikats-
  und lokale Berechtigungsabläufe beenden auch bestehende Sitzungen. Monotone Fristen
  verhindern die Verlängerung bei rückwärts springender Systemzeit.
- DNS, TCP/TLS und HTTP-Upgrade einschließlich Token-/mTLS-Authentifizierung teilen
  ein Gesamtbudget von höchstens 5.000 ms. Abbruch beendet DNS-Aufträge und Socket.
  Das ist kein Linux-Hartechtzeitversprechen. Die erfolgreiche Verbindung darf
  dauerhaft bestehen. Wiederverbindungen erfolgen asynchron mit begrenztem Backoff.
- Maximale Nachricht: 64 KiB; Kompression aus; höchstens 128 Fragmente/Bufferteile;
  Nachrichten-/Control- und Bytequoten; begrenzte Eingangsqueue und Sendepuffer.
  Binärnachrichten werden verworfen. Keine Offline-Sendequeue und kein automatisches
  Wiederholen fachlicher Befehle.
- Heartbeat prüft nur Verbindungsleben. Er verlängert keine Steuer-Lease und ersetzt
  keine Messwertaktualitätsprüfung. Ausbleibende Pongs führen zum Verbindungsabbruch.
- Fremde Fehler, Serverantworten und Zugangsdaten werden nicht protokolliert. Ein
  Fehler im fachlichen Callback wird als fester `handler_error` isoliert.

## Prüfungen und verbleibender Umfang

Aufruf: `node scripts/verify-partner-websocket.cjs`. Das Script baut nur dieses Modul
in ein temporäres Verzeichnis mit TypeScript strict, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns` und
`noFallthroughCasesInSwitch`. Es verändert keine globalen Runtime-Builds.

Die Prüfungen decken Endpunkt-/Adressvalidierung, DNS-Pinning, Widerruf, verworfene
Queues, verspätete Antworten, synchrone Lifecycle-Änderungen, Handlerfehler, Quoten,
monotone Abläufe und tatsächlichen DNS-Abbruch nach Gesamtdeadline ab. Echte lokale
TLS-Negativtests prüfen unbekannte CA, falschen Hostnamen und Abweichung zwischen
geprüfter und tatsächlicher Socketadresse. Temporäre Testschlüssel werden im Test
erzeugt und danach gelöscht.

Offen bleiben erfolgreicher End-to-End-Test mit tatsächlichem Partnerprofil und mTLS,
reale Partner-DNS-/VPN-Umgebung, Langzeit-/Lastmessungen auf der Zielhardware sowie
Integration mit Widerruf und Rückfall der wirklichen Geräte. Kontrollierte Sockettests
sind keine Partner- oder Hardwarefreigabe. Integrations-, Komponenten- und Release-
nachweise werden im gemeinsamen Änderungsstand geführt.

## Primärquellen

- [ws API und Clientoptionen](https://github.com/websockets/ws/blob/master/doc/ws.md)
- [Node DNS Resolver und cancel](https://nodejs.org/docs/latest-v22.x/api/dns.html)
- [Node TLS-Prüfung und TLSSocket](https://nodejs.org/docs/latest-v22.x/api/tls.html)
- [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455.html)
- [OWASP WebSocket Security](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)

Die Quellen dienen als technische Grundlagen. Die genannten Limits sind lokale
EOS-Entscheidungen und keine Behauptung vollständiger IEC-/OWASP-/CRA-Konformität.
