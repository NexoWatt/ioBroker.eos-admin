# Netzwerk- und SMTP-Sicherheitsprüfung vom 29.09.2026

## Gegenstand und Nachweisgrenze

Geprüft wurde der hochgeladene vollständige Quellstand NexoWatt UI 1.0.21 und die
hieraus überarbeitete Fassung. Betroffen sind der eigene Mesh-Koordinator
(`mesh-coordinator-contract`, `mesh-coordinator-protocol`, `mesh-coordinator`) und
`notification-mail`; die separat geführten Zählerarchive wurden durch bestehende
Regressionen einbezogen. Maßgebliche Quellen liegen unter
`src-ts/runtime-executables/lib/`. Die konkreten Quell-/Artefakthashes stehen in
[den lokalen Prüflogs](../reports/cra-network/security-source.log) und im
abschließenden Release-Nachweis. Versionsnummer des Gesamtlieferstands siehe
`package.json`.

Dies ist eine Quellprüfung mit gezielten lokalen Laufzeittests, kein unabhängiger
Penetrationstest, keine Hardwareabnahme und keine Erklärung vollständiger
CRA-/Normkonformität. Anforderungen: serverseitige Authentifizierung,
Wiederholungsschutz, begrenzte Ressourcen, verifizierter Transport und dauerhafte
sichere Speicherung. Der genaue normative Anforderungssatz wird im übergeordneten
CRA-Nachweis geführt.

## Befunde und Maßnahmen

| Kennung | Komponente / Ausgangsstand | Nachgewiesenes Problem und Voraussetzung | Maßnahme / Test | Status |
| --- | --- | --- | --- | --- |
| NW-CRA-NET-001 | Mesh-Koordinator, 1.0.21, Protokoll v1 | Wiederholung eines zuvor gültig signierten Hello setzt im Master die Sequenz von 20 auf 0 und `NORMAL` auf `SYNCING`; erneutes Abspielen konnte außerdem die Knotenquote verbrauchen. Angreifer benötigt einen aufgezeichneten gültigen Request und Zugang zum Mesh-Port. Folge: unnötiger Rückfall/Verfügbarkeitsverlust; keine nachgewiesene Überschreitung physischer Grenzen. Priorität hoch. | Explizites Protokoll v2: Hello erzeugt nur ein kurzlebiges, an Master-Epoche/Knoten/Boot/Hello-Sequenz/Zeit gebundenes Challenge. Erst ein dazu passend signierter Exchange aktiviert die Sitzung. Alte Hello-Sequenzen und wiederholte Request-IDs abweisen; keine Quote für abgewiesene Protokollpakete. NET-01 bis NET-05. | Behoben, lokale Nachprüfung bestanden; Verbundupgrade/HW-Abnahme offen. |
| NW-CRA-NET-002 | Mesh-HTTP-Transport, 1.0.21 | HTTP-Freigabe für `.ts.net`/`localhost` prüfte nur den Namen. Manipulierte Namensauflösung konnte diesen auf ein Fremdnetz zeigen lassen. HMAC schützt Integrität, verschlüsselt die übertragenen Messdaten aber nicht. Priorität mittel. | Tatsächliche IPv4-/IPv6-Ziele jeder neuen HTTP-DNS-Auflösung gegen Loopback/Tailscale-Adressraum prüfen und genau diese Adressen dem Socket übergeben. Gemischte erlaubte/verbotene Antworten vollständig ablehnen. HTTPS verlangt explizit TLS ≥1.2 und Zertifikatsprüfung. NET-06 bis NET-09. | Behoben im geprüften Transport; Routing/Tailnet-Konfiguration vor Ort weiterhin zu prüfen. |
| NW-CRA-NET-003 | SMTP-Konfigurations-/Ledger-Ablage, 1.0.21 | Vorhersagbare Tempdatei wurde ohne exklusives Erstellen geöffnet. Ein vorher angelegter Symlink im Instanzverzeichnis konnte eine andere, für den Adapter beschreibbare Datei überschreiben. Dafür ist bereits lokaler Schreibzugriff auf das Verzeichnis nötig; zusätzliche Härtung, kein unprivilegierter Fernzugriff nachgewiesen. Priorität niedrig. | Zufälliger Tempname, `wx`, Rechte 0600, Datei-fsync vor Rename, POSIX-Verzeichnis-fsync, Aufräumen bei Fehler. Versand-Ledger bleibt vor SMTP zu speichern. NET-10/11. | Behoben, lokaler Symlink-/Fehlertest bestanden. |

Die [Reproduktion am unveränderten ZIP](../reports/cra-network/baseline-reproduction.log)
enthält Originaldateihashes, den tatsächlichen Hello-Zustandswechsel und die
Überschreibung einer ausschließlich synthetischen Datei. Es wurden keine
Kunden-/Anlagendaten verwendet.

## Protokoll v2 und Update bestehender Mesh-Verbünde

**Master und sämtliche Slaves gemeinsam auf den neuen Lieferstand aktualisieren.**
Das Maschinenprotokoll heißt jetzt `nexowatt.mesh-coordinator.v2`. Alte v1-Peers
werden nicht still akzeptiert; gemischte Verbünde erreichen keinen normalen
Regelbetrieb. Ein alter Master kann nur seine bisherige allgemeine HTTP-403-Meldung
liefern. Ein neuer Master meldet dem authentifizierten inkompatiblen Peer
`incompatible_peer_schema`; der neue Client zeigt den gemeinsamen Updatebedarf.

1. Vor dem Wartungsfenster aktive Rückfallwerte, geräteseitige Watchdogs,
   physische Netzgrenzen und Auswirkungen der Rückfallphase mit dem Betreiber
   bestätigen. Bereits aktive Schutzkonfiguration nicht aus der App löschen.
2. Alle Instanzdaten einschließlich Systemschlüssel, Mesh-Paarungen und
   Zählerarchive zusammen sichern. Originalpaket für einen koordinierten Rückfall
   aller Peers bereithalten; einzelne alte Peers ergeben keinen freigegebenen
   Mischbetrieb.
3. Master und alle Slaves im geplanten Fenster aktualisieren. Während der
   Unterbrechung wirken die vorhandenen geprüften Rückfälle; diese Änderung
   führt keine neue pauschale Anlagenabschaltung ein und erteilt keine
   Ersatzfreigabe.
4. Netzwerkverbindung und Zertifikate/DNS prüfen. `.ts.net` muss tatsächlich auf
   Tailscale-Adressen auflösen; fremde LAN-/öffentliche Ziele benötigen HTTPS.
5. Nach Update aller Peers neue Synchronisation, `VERIFIED`-Rückmeldungen,
   konfigurierte Erholungszyklen und Rampen prüfen. Paarungsschlüssel und
   Leistungsgrenzen werden durch das Protokollupdate nicht neu erzeugt.
6. Reale Kommunikationsunterbrechung, Wiederverbindung, Master-/Slave-Neustart
   und die tatsächliche Einhaltung der Fallbackwerte je Gerätepfad dokumentieren,
   bevor der Standortbetrieb freigegeben wird.

Hello verändert keine Reservierungen und legt keinen Boot still. Ein altes Hello
kann nach Master-Neustart höchstens eine neue Challenge-Antwort auslösen; alte
signierte Exchanges passen nicht zur neuen Master-Epoche und zum privaten
Challenge-Schlüssel. Neue Sitzungen werden nur innerhalb der konfigurierten
`leaseMs` seit Challenge-Ausgabe aktiviert. Laufende Requests bleiben durch
Sitzung, Boot, Revision und steigende Sequenzen gebunden; der Slave übernimmt
weiterhin keine verspätete Antwort und beginnt Leases beim Anfragestart.

## Durchgeführte Prüfungen

Umgebung: isolierter Linux-Container, Node.js 24.19.0, 29.09.2026. Die initialen
`*-source.log`-Läufe nutzten einen lokalen Loader für die vier geänderten
kanonischen Quellen; andere Abhängigkeiten blieben die vorhandenen Runtime-Dateien.
Nach dem Gesamtbuild wurden die identische Suite ohne `--source` und alle unten
aufgeführten Regressionen gegen die **gelieferten JS-Artefakte** erneut ausgeführt
und bestanden (Läufe ab 20:12 UTC, 29.09.2026).

| Befehl | Soll / beobachtetes Ergebnis |
| --- | --- |
| `node scripts/verify-cra-network.cjs --source` und `node scripts/verify-cra-network.cjs` | 12 Gruppen bestanden: Replay/Quoten, gleiche/neue Boots, Master-Neustart, vertauschte/veraltete/manipulierte Nachrichten, Altversionen, DNS-Wechsel, echter Loopback-HTTP-Kanal, Größen/Timeouts, TLS-Optionen, SMTP-Atomspeicherung und Geheimnisfilterung. |
| `node scripts/verify-mesh-coordinator.cjs` zunächst mit Source-Loader, danach Runtime | 20 bestehende Gruppen bestanden; 99 parallele HTTP-Clients, Rückfall/Reservierungen, Writer, 250-ms-Profil und Konfigurationsverlust. Keine Schwächung vorhandener Tests. |
| `node scripts/verify-mesh-transformer-accounting.cjs` zunächst mit Source-Loader, danach Runtime | 14 Gruppen bestanden; Trafo-/Hausverteilung, Null-/Ausfallgrenzen, Archiv-Nachlieferung, Dubletten, Neustart und Abrechnungssperren. |
| `node scripts/verify-mesh-app-lifecycle.cjs` zunächst mit Source-Loader, danach Runtime | 4 bestehende Lebenszyklusgruppen bestanden. |
| `node scripts/verify-stable-1.0.7-notifications.cjs` zunächst mit Source-Loader, danach Runtime | Bestehende Policy-, Verschlüsselungs- und lokale SMTP-Annahme-/Ablehnungsprüfung bestanden. |

Rohbelege der finalen Runtime: [12 Sicherheitsgruppen und Artefakthashes](../reports/cra-network/security-runtime.log),
[Mesh: 20 Gruppen](../reports/cra-network/mesh-coordinator-runtime.log),
[Archiv: 14 Gruppen](../reports/cra-network/mesh-accounting-runtime.log),
[App-Lebenszyklus: 4 Gruppen](../reports/cra-network/mesh-lifecycle-runtime.log),
[Benachrichtigungen](../reports/cra-network/notification-runtime.log).
Die entsprechenden `*-source.log` liegen im gleichen Verzeichnis und halten
zusätzlich die frühere Quellprüfung fest.
Keine reale E-Mail wurde versandt. Die produktive TLS-Konfiguration wurde über
Optionen geprüft; kein echter SMTP-Provider und kein reales Tailnet wurden getestet.

## Verbleibende Grenzen und Verantwortung

- TLS-/Tailnet-Routing, getrennte ACLs, Geräte-Watchdogs, wirksame Fallbackwerte,
  WAN-Latenz und Update im echten Verbund: Integrator/Betreiber, vor Feldfreigabe.
  Zugehörigkeit zum IP-Adressraum beweist allein keine tatsächlich verschlüsselte
  Route. DNS-Ausfall bleibt ein Kommunikationsfehler mit bestehendem Rückfall.
- HMAC authentifiziert den eingerichteten Peer. Ein kompromittierter Slave mit
  seinem Schlüssel kann falsche eigene Telemetrie signieren; Netzgrenzen,
  Mastermessung und Reservierungen bleiben nötig. Eine kompromittierte gemeinsame
  ioBroker-Laufzeit wird durch Mesh oder SMTP-Verschlüsselung nicht isoliert.
- Volumetrische Netzwerkangriffe/Überlast oberhalb der begrenzten Nachrichten und
  Knotenquoten sind hier nicht als abgewehrt nachgewiesen; Routing/ACLs und
  übergreifende Webservergrenzen bleiben separate Schutzschichten.
- Zählerarchivgrenzen gelten je Haus; Gesamtdatenträger, Sicherungen und
  Wiederherstellung bleiben Betriebsaufgaben. Reale Hardware-/Stromausfalltests
  der neuen Dateisynchronisation wurden nicht ausgeführt.
- Releaseverantwortliche: NexoWatt. Endgültige technische Freigabe erst mit
  Gesamtprüfbericht, dokumentierten offenen Punkten und der tatsächlichen
  Standortabnahme. Dieser Bericht erteilt keine selbstständige Produktionsfreigabe.
