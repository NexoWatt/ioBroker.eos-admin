# Vertiefte Prüfung der Sicherheits- und Verfügbarkeitsgrenzen

Stand: 24.11.2026. Referenz: unveränderter Quellstand 9.0.20. Gegenstand ist der
Arbeitsstand für 9.0.21; dieser Einzelbericht ist keine Produktionsfreigabe oder
Bescheinigung vollständiger CRA-/IEC-/ASVS-Konformität.

## 921-SEC-001 – unbegrenzte Warteschlange vor der Uploadzulassung

**Priorität:** P2, Verfügbarkeit. **Zuordnung:** CWE-400 / CWE-770, STRIDE Denial
of Service. **Betroffen:** 9.0.20, `src/lib/eosUploadGuard.js`, `acquire()` und
`createUploadMiddleware()`. Beide Uploadrouten in `src/lib/web.ts` verwenden
vorher den Admin-/Service-, Sitzungs-, Pflichtpasswort- und Origin-Schutz.
Es handelt sich nicht um einen nachgewiesenen anonymen Zugang oder Rechtegewinn.

**Reproduktion:** Ein hängender Dateisystemaufruf bei der Zulassung eines
authentifizierten Uploads hält die gemeinsame Serialisierung auf. Dreißig weitere
Anfragen konnten sich zusätzlich zu den ersten beiden dahinter einreihen. Das
Limit von zwei aktiven Uploads wurde erst nach Dateisystemarbeit geprüft; auch
die Gesamtfrist startete erst danach. Dadurch blieben beliebig viele Anfragen
mit ihren Callbacks und Request-Referenzen außerhalb beider Grenzen. Ein
gestörtes temporäres Dateisystem genügt; ein gezielter Missbrauch setzt den
Zugang zu den administrativen Uploadrouten voraus.

Der neue Test wurde vor der Korrektur direkt gegen die unveränderte
9.0.20-Helperdatei ausgeführt: **1 bestanden, 2 fehlgeschlagen**. Die Fehler sind
fehlende sofortige `503`-Antworten auf Überlast und null registrierte Gesamtfristen
während blockierter Zulassung. Der dritte Fall bestätigt das bereits vorhandene
Verhalten beim später bemerkten Clientabbruch.

**Korrektur:** Höchstens zwei aktive **einschließlich noch in Zulassung befindliche**
Uploads pro Prozess. Zusätzliche Arbeit wird vor Aufnahme in die serielle Kette
abgewiesen. Die unveränderte Gesamtfrist von 60 Sekunden umfasst nun bereits
Zulassung, Parser und Speicherung. Clientabbruch, Fristende und Antwortabschluss
entfernen ihre Listener. Eine nicht abbrechbare Dateisystemoperation behält ihren
Platz bis zum wirklichen Abschluss. Verspätete Ergebnisse dürfen keinen Parser
starten; entstandene temporäre Verzeichnisse werden über denselben
Aufräumpfad zurückgenommen. Bestehende Größen-, Pool-, Platz-, Eigentümer-,
Symlink- und Dateirechtegrenzen bleiben bestehen.

**Restgrenze:** Zwei dauerhaft hängende Dateisystemoperationen sperren weitere
Uploads bis zum tatsächlichen Abschluss beziehungsweise geordneten Neustart.
Die Korrektur begrenzt deren Anzahl, sie macht einen nicht abbrechbaren
Dateisystemaufruf nicht abbrechbar. Für OS-weite Ressourcenbegrenzung bleibt die
Deployment-/Dienstkonfiguration verantwortlich. Kein Livegerät wurde verändert.

## Ausgeführte Prüfungen

| Prüfung | Node 22.23.4 | Node 24.22.3 |
| --- | ---: | ---: |
| Neue Zulassungsregression plus bestehende Webressourcenprüfung | 22/22 | 22/22 |
| Sitzung, Idle, HTTP/CSRF, Rollen, Cookie-Isolation, Dateitransfer, Editor-Sitzung | 78/78 | 78/78 |
| Instanzproxy, Koexistenz-Reparaturplan, Update- und News-Isolation | 26/26 | 26/26 |

Alle oben genannten Kandidatenläufe: null Fehler, null übersprungene Tests.
`eslint -c eslint.unified.config.mjs src/lib/eosUploadGuard.js
test/eos-upload-admission.test.cjs` und `tsc -p tsconfig.build.json --noEmit`
enden mit Code 0. Es wurden keine neuen Laufzeitabhängigkeiten ergänzt.

Die Uploadprüfung verwendet echte temporäre Verzeichnisse, kontrollierte
Dateisystemverzögerungen und simulierte Request-/Response-Ereignisse. Der
Cookie-Test verwendet reale parallele HTTPS-Listener und die gebündelten
OAuth-Routen mit einem simulierten Controller und einem portunabhängigen
Cookie-Speicher. Das ist kein vollständiger Echtbetrieb von Standard-Admin und
Backitup. Der Sitzungstest prüft unter anderem Passwort-/Gruppenwiderruf,
verspätete Authentifizierungen, zehn Minuten monotone Inaktivitätszeit, stille
SSE-Verbindungen, Socket-Tokenrotation, TOTP-Verweigerung und erschöpfte
Datenbank-/Sitzungsgrenzen. Die Proxyprüfungen verwenden die echte Proxylogik
mit kontrollierten Zielservern und Controllerantworten.

Rohbelege und Quellhashes liegen unter `raw/security-stability/`. Die Baseline ist
über `EOS_SECURITY_TEST_ROOT` ausdrücklich ausgewählt; reguläre Tests lesen
weiter den jeweiligen Kandidaten. `EOS_TEST_RUNTIME=build` unterstützt für die
neue Uploadregression auch den abschließend erzeugten Backendstand. Der gesamte
Releasebuild und dessen Gesamtprüfung werden im gemeinsamen Releasebericht
nachgewiesen; dieser Bericht behauptet diese nicht vorweg.

## Zusätzlich eingesehene Grenzen

- `src/lib/eosSessionSecurity.js`: Token-/Familienbindung, sofortiger beobachteter
  Widerruf, begrenzte Datenbankarbeit, Socketpublikation und stille SSE-Lebensdauer.
- `src/lib/eosUnifiedBoundary.js`, `src/lib/eosRequestSecurity.ts` und die
  Routeneinbindung in `src/lib/web.ts`: Host-/Origin- und CSRF-Bindung,
  Login-/Logoutpfade, sichere Trennung von Browser- und Maschinenaufrufen.
- `src/lib/eosCookieNamespace.js`, `src/lib/instanceProxy.ts`: keine Übernahme
  oder Löschung generischer Standard-Admin-Cookies; keine Weiterleitung von
  Admin-/EOS-Credentials an proxierte Adapter; begrenzte Proxy-Lebensdauer.
- `src/lib/eosFileTransferSecurity.js`: Identitätsweitergabe an die Dateidatenbank,
  Pfadprüfung, Größen-/Zeitgrenzen und keine aktive Darstellung fremder Dateien.
- `src/lib/eosAutoUpdate.ts` und der Socket-Guard in `src/main.ts`: unveränderte
  Quarantäne unbeaufsichtigter Installationen, keine eigenmächtige Änderung
  gemeinsamer ioBroker-Repository-/Update-Richtlinien, rohe Hostkommandos nur
  nach bestehender Service-/Admin- und Controller-ACL-Prüfung.
- Bestehende Berichte `docs/security/SESSION_REVOCATION_2026-09-30.md`,
  `docs/security/FILE_DELIVERY_2026-10-25.md` und
  `docs/reports/unified-9.0.20/STATIC_REVIEW_DE.md` wurden als Vorbefunde
  berücksichtigt. Historische Aussagen sind nach Datum und Geltungsbereich
  einzuordnen; dieser Bericht ersetzt keine Gesamtdokumentation.

## Offene Grenzen und Verantwortung

Die vorhandenen 2.929 historischen offenen Scannerbefunde wurden durch diese
Prüfung weder pauschal freigegeben noch geschlossen. Es wird kein neuer
Gesamt-Scannerlauf behauptet. Der Einzelbefund 921-SEC-001 ist durch die Änderung
und fokussierte Gegenprüfung adressiert; die abschließende Artefaktbindung und
Integrationsfreigabe liegen bei Release/Hersteller.

Standard-Admin, EOS und andere ioBroker-Adapter teilen weiterhin Controller,
Objektdatenbank und das Betriebssystem-Dienstkonto. Cookie-/Rollen-/Routentrennung
ist keine OS-Sandbox. Bereits gestartete Controlleroperationen lassen sich bei
anschließendem Rechtewiderruf nicht atomar zurückrollen. Verpasste
Sicherheitsereignisse werden auf Sockets zusätzlich über den vorhandenen
Fünf-Sekunden-Wächter geprüft; normale beobachtete Änderungen sperren sofort.
Die Dateidatenbank liefert weiterhin komplette Buffer: Vor-/Nachprüfungen
ersetzen keine garantierte Streamingallokation im Controller.

Echte Mehrgeräte-/Langzeitprüfungen, komplette Standard-Admin-/Backitup-Koexistenz,
physische Aktorrückmeldungen, Betriebssystemquoten und der produktbezogene
CRA-Nachweis bleiben gesonderte Prüf- beziehungsweise Herstelleraufgaben.
