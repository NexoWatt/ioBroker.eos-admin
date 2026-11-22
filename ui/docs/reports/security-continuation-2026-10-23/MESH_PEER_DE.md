<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. Nutzung, Modifikation oder Verbreitung ohne ausdrückliche Erlaubnis untersagt. -->
# Mesh-Peer-Feldtest: Transportgrenze 1.0.30

Bezug: NW-MESH-HTTP-01. Datum: 23.10.2026. Verantwortlich: EOS-Entwicklung.
Geprüft wurde der aus 1.0.29 fortgeführte Adapter im lokalen Node.js-Testprozess,
nicht die Hausanlage. Die Lizenzprüfung und vorhandene Lizenzschlüssel bleiben
unverändert. HTTP-/LAN-/Tailscale-Peers und bis zu 20 konfigurierte Gegenstellen
bleiben unterstützt. Änderungen betreffen ausschließlich die manuelle Diagnose.

## Reproduzierter Ausgangsbefund

Die echte Express-Route `/api/mesh/peer/fieldtest` folgte einem HTTP-302-Redirect
und übertrug ihren benutzerdefinierten Peer-Token-Header an einen zweiten Origin.
Der native Loopback-Nachweis verwendete ausschließlich ein zufälliges Testtoken.
Zudem nahm die Route je Handshake-/Statusantwort 2.097.183 Byte an und meldete
bei `probe:false` sogar ungültiges JSON als erfolgreichen Feldtest.

Voraussetzungen: installierte und aktive Mesh-App, Koordinatorrolle `off`, gültige
Installer-/Admin-Sitzung, konfigurierter erreichbarer Peer. Die Weiterleitung
setzt eine entsprechend antwortende oder kompromittierte Gegenstelle voraus;
es wurde kein anonymer Zugriff und keine fremde tatsächliche Ausnutzung belegt.
Die gemeinsamen Regelprotokolle des modernen Mesh-Koordinators sind ein anderer
Transportpfad. Befundpriorität: mittel, da manuell ausgelöste, rollenpflichtige
Diagnose; betroffen sind Tokenvertraulichkeit, Ressourcenverbrauch und
Verlässlichkeit der Diagnose.

## Änderung und erhaltene Funktion

`src-ts/runtime-executables/lib/mesh-peer-http.ts` nutzt ausschließlich native
Node.js-Module. Der Helfer wird tatsächlich strikt ohne `any`/Prüfabschaltung
kompiliert und ohne ESLint-Baseline-Ausnahme geprüft.

- Keine Weiterleitung; HTTP-Fehler werden anhand ihres Status diagnostiziert.
- Eine monotone Deadline von höchstens 5.000 ms pro vollständiger Peer-Sequenz
  umfasst DNS, Verbindung, TLS, Header, Body sowie Handshake, Status und Probe.
  Ein Timeout zerstört Request und Response; Folgeabrufe erhalten kein neues
  Budget. Mehrere Peers behalten ihre getrennten Diagnosebudgets.
- Antworten sind auf 1 MiB begrenzt, sowohl anhand Content-Length als auch beim
  Streamen. Headerlimit 16 KiB, JSON-Tiefe 32, höchstens 20.000 Knoten. Komprimierte
  Antworten werden verworfen; es wird ausdrücklich `identity` angefordert.
- HTTP/HTTPS, Hostnamen, IPv4/IPv6, Tailscale und bestehende Pfadpräfixe bleiben
  möglich. URL-Credentials, Query-Parameter und Fragmente werden abgewiesen.
  HTTPS prüft weiterhin die Gegenstelle; es gibt keinen unsicheren Rückfall.
- Erfolgreiche Handshake-/Status-/ACK-Antworten müssen zum Schema passen. Die
  verwendeten Identitäten, Diagnosetexte und Knotendaten werden typgeprüft;
  numerische Prioritäten bleiben erhalten. Ungültiges JSON wird nie als Erfolg
  behandelt. Kopien verwenden Null-Prototyp-Dictionaries, gefährliche Schlüssel
  werden abgewiesen. Reflektierte eigene Peer-Tokens werden redigiert.
- Unerwartete Transportfehler und negative fachliche HTTP-200-Antworten liefern feste Codes statt fremder Fehlermeldungen/Stackfelder.
  Ein Feldtest läuft je Adapter; weitere Aufrufe erhalten `mesh_fieldtest_busy`.
  Die Sperre wird bei Erfolg und Fehler freigegeben. Die neutrale Probe bleibt
  ohne direkte Hardwarewirkung und mit geplanter Leistung 0 W.

## Ausgeführte Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| `tsc --noEmit -p tsconfig.mesh-peer-http.json` | Exit 0, echte strikte Typprüfung |
| `eslint src-ts/runtime-executables/lib/mesh-peer-http.ts` | Exit 0, keine Ausnahmen für den neuen Helfer |
| `node scripts/verify-mesh-peer-http.cjs` | 28 Gruppen bestanden; native Loopback-HTTP-/HTTPS-Verbindungen und echte Express-Route |
| Bestehende Feldtest-/Peer-Härtungs-/Fail-closed-Prüfer | Vier Skripte bestanden |
| `node scripts/verify-mesh-coordinator-access.cjs` | Rollen und App-Sperren mit Auth an/aus bestanden |
| `node scripts/verify-http-error-boundary.cjs` | Bestehende 23 HTTP-Prüfgruppen bestanden |

Die 28 Gruppen enthalten Redirect ohne zweiten Kontakt, deklarierte und gestreamte
Übergröße, JSON-/Schema-/Knoten-/Prototyp-/Tiefen-/Mengenfehler, nicht endliche Zahlen,
Kompression, HTTP-401 ohne fremden Body, Tokenredaktion, laufenden langsamen Body,
verspätete DNS-Auflösung, geteiltes Budget, tatsächliche Kappung bei fünf Sekunden,
Abweisung eines selbstsignierten HTTPS-Peers, Rechte, neutrale Probe, zwei Peers,
parallelen Aufruf und erfolgreiche Wiederaufnahme nach Fehler. Zwei Nachprüfungen sichern zusätzlich, dass auch langsame interne Bodyserialisierung das gemeinsame Budget verbraucht und negative HTTP-200-Antworten keine freien Remote-Fehler oder Stackfelder übernehmen.
Testschlüssel für HTTPS werden nur temporär erzeugt und gelöscht.

Die Rohbelege heißen `mesh-peer-http-final.log`, `mesh-peer-existing.log`,
`mesh-peer-http-boundary.log`, `mesh-peer-strict.log`, `mesh-peer-eslint-final.log`
und `review-mesh-fieldtest-baseline.json`. Der übergeordnete Releasebericht bindet
sie und die endgültigen Dateihashes an den ausgelieferten Stand. Die produktiven
JavaScript-Dateien werden aus den kanonischen TypeScript-Quellen erzeugt;
der manuell gepflegte Main-Spiegel enthält dieselbe fachliche Korrektur.

## Grenzen und Hausanlagenprüfung

NW-OPEN-01 (TLS/Reverse-Proxy/Firewall der tatsächlichen Anlage) bleibt offen.
HTTP-Peers übertragen ihren Token weiterhin im gewählten Anlagen-/VPN-Transport;
Netzvertrauen und Peer-Ziele müssen vor Ort stimmen. Der Helfer ist keine allgemeine
SSRF-Filterung für vom Administrator konfigurierte interne Gegenstellen und lädt
weder Code noch Konfiguration nach. Modernes Mesh, Regelung und Geräteanbindungen
wurden durch diese Diagnosekorrektur nicht umgebaut.

Vor dem Update Konfiguration sichern und das vorherige Paket für den Rückfall
aufbewahren. Auf der Hausanlage einmal einen bekannten Peer mit `probe:false`,
anschließend die ausdrücklich neutrale Diagnoseprobe aufrufen: erwartete
Knotenmatrix, numerische Prioritäten, Fehlertypen und unveränderte Anlagenfunktion
kontrollieren. Einen ausgeschalteten Peer diagnostizieren; die Anzeige muss nach
seinem Budget einen Timeout melden und ein anschließender erfolgreicher Feldtest
muss wieder möglich sein. Keine Hardwareprüfung, Normvollerfüllung oder allgemeine
Produktivfreigabe wird aus den lokalen Prüfungen abgeleitet.
