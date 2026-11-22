# Unabhängige Zweitprüfung des Mesh-Peer-HTTP-Fixes

23.10.2026, separater Arbeitsagent vom Implementierer. Geprüft: kanonischer `main.ts`, manuell typisierter Main-Mirror, `src-ts/runtime-executables/lib/mesh-peer-http.ts`, daraus generiertes `lib/mesh-peer-http.js`. Das ist eine interne zweite Codeprüfung, keine externe Zertifizierung oder Hardwarefreigabe.

## Nachvollzogene Schutzgrenzen

Der native Client verwendet eine monotone gemeinsame Deadline für Handshake, Status und neutrale Probe. Der Timer zerstört Request und Response, `agent:false` vermeidet weiterverwendete Verbindungen. DNS/Verbindung/Body teilen dasselbe Budget; Folgeabrufe starten keine neue Frist. Redirects werden vor weiterer Verarbeitung abgewiesen. Der Peer-Token gelangt dadurch nicht über Redirects zu einem zweiten Ziel. URL-Credentials, Query und Fragment sind unzulässig; bestehende lokale Pfadpräfixe bleiben möglich. HTTPS enthält ausdrücklich `rejectUnauthorized:true`.

Content-Length und tatsächlich empfangene Bytes sind begrenzt, ebenso Header. Kompression wird abgewiesen. Erfolgsantworten werden vor Feldtestdiagnose auf Schema und verwendete Daten eingegrenzt und mit nullbasierten Dictionaries kopiert. Fachlich negative Antworten enthalten nach Nachschärfung nur endliche bekannte Codes. Die Feldtestroute besitzt die bestehenden Installer-/Lizenzprüfungen und einen pro Adapter gehaltenen Auftrag, der in `finally` freigegeben wird. Aufeinander folgende Peers behalten ihre einzelnen Budgets. Die neutrale Probe enthält weiterhin null geplante Leistung und keine direkten Hardwarewrites.

Die POST-Feldtestroute einschließlich Singleflight ist zwischen kanonischem Main und manuellem Mirror textidentisch. `tsc -p tsconfig.mesh-peer-http.json --pretty false` wurde unabhängig mit Exit 0 ausgeführt.

## Reproduzierte und behobene Reviewpunkte

1. **Restbudget nach Serialisierung:** Der erste Stand berechnete das Restbudget vor `JSON.stringify`. Ein künstlicher interner `toJSON`-Aufruf mit 80 ms Laufzeit bei 15 ms Budget ließ einen HTTP-Request nach Ablauf zu; anschließend wurde zwar Timeout gemeldet. Die konkrete Route baut kleine interne Bodies, deshalb wurde daraus kein extern ausnutzbarer Angriff abgeleitet. Der Implementierer prüft jetzt unmittelbar vor Request/Timer das verbleibende Budget neu. Nachprüfung: **0 statt 1 HTTP-Requests nach Ablauf**, fester Timeoutcode.
2. **Fachlich negative HTTP-200-Antwort:** Eine künstliche Peerantwort mit `ok:false` und freien `error`-/`stack`-Markern wurde zunächst unverändert weitergereicht. Der Implementierer projiziert solche Antworten jetzt auf bekannte feste Codes bzw. `mesh_peer_rejected`. Nachprüfung: **beide privaten Marker fehlen**. HTTP-Fehlerbodies wurden bereits zuvor verworfen.

Unabhängiger Reproducer: `runtime-independent-mesh-probe.cjs`. Baseline: `runtime-independent-mesh-probe.log`. Erfolgreiche Nachprüfung: `runtime-independent-mesh-probe-fixed.log`. Strict-Rohbeleg: `runtime-independent-mesh-typecheck.log`.

Keine eigenen Produktquellen geändert. Die umfassenden nativen Transport-/Routenregressionen gehören zum Implementierer-/Root-Prüflauf; sie werden hier nicht als selbst ausgeführt ausgewiesen. Der temporäre ENTSOe-Transpilemarkerfehler im parallelen Gesamtbuild wurde an Root/CI zur Korrektur gemeldet und ist kein Mesh-Befund. Die früh negative Antwortprojektion verwirft überflüssige Daten; Tiefen-/Mengenfixtures sollen die zu kopierenden Erfolgsantworten weiterhin prüfen.

## Restgrenzen

Keine allgemeine SSRF-Allowlist für bewusst vom Installer konfigurierte lokale Gegenstellen; unverschlüsseltes HTTP bleibt für das bestehende LAN-/VPN-Profil möglich. Echte VPN-/Firewall-/TLS-Topologie und reale Anlage hier nicht geprüft. Vorliegend wurden Quellcode, tatsächliches lokales HTTP-Verhalten und Typprüfung bewertet, keine pauschale Gesamtsicherheitszusage.
