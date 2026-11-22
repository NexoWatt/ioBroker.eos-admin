# Gezielte Zweitprüfung der WWW-Proxyänderungen

Prüfdatum: 03.11.2026. Gegenstand: NexoWatt UI 1.0.35 gegenüber dem vollständigen Quellstand 1.0.34. Die Prüfung erfolgte durch einen getrennten KI-Arbeitslauf vom WWW-Implementierungsarbeitslauf; sie ist keine externe Sicherheitsprüfung oder Zertifizierung. Die endgültigen Roh- und kommentarfreien AST-Hashes aller 25 betroffenen kanonischen WWW-Dateien stehen in `www-frontend-review-evidence.json` neben diesem Bericht.

## Ergebnis

Die abschließend geprüften Änderungen lassen die bestehenden Rollen-, Sitzungs- und URL-Sicherheitsprüfungen bestehen. Das neue Hilfsmodul ordnet bekannte lokale Runtime-Routen dem validierten Instanzpfad zu. Fremde Ursprünge erhalten dadurch keine EOS-Zugangsdaten; Protokoll, Ursprung und eingebettete URL-Zugangsdaten werden vor der Umleitung geprüft. Öffentliche Pfadsegmente, Instanznummer, Segmentanzahl und Präfixlänge sind begrenzt. Mehrere kanonische Proxy-Namensräume werden nicht stillschweigend einer Instanz zugeordnet.

Die Änderungen an Authentifizierung und Navigation verwenden für die bisherige Seitenerkennung den Runtime-Pfad ohne Proxy-Präfix. Die bestehenden Capability-Prüfungen und die Entscheidung zwischen normalen und strikten Auth-Endpunkten bleiben erhalten. Admin-Rücksprünge verwenden im Proxybetrieb die aus dem tatsächlichen Pfad ermittelte Instanz und denselben Ursprung. Der Bootstrap muss weiterhin vor den übrigen Auth-/App-Skripten geladen werden; die zugehörige serverseitige HTML-Integration wird separat geprüft.

Die SmartHome-Sinks verwenden weiter `nwSafeWebUrl`; der bestehende iframe-Sandboxschutz ohne `allow-same-origin` bleibt erhalten. Die neuen Template-URLs für feste Bild-/Navigationspfade erhalten ausschließlich ein streng begrenztes Präfix ohne HTML-Attributtrennzeichen. Export-Blob-URLs und externe Geräteadressen bleiben vom Mapper unverändert. Die Fetch-Weiterleitung bewahrt Request-Optionen und explizite Init-Optionen; sie verleiht keine Rolle und ersetzt keine serverseitige Autorisierung.

## Erkannte und nachgeprüfte Korrekturen

1. Ein öffentlicher Pfad mit einem weiteren `proxy/nexowatt-ui.N`-Segmentpaar konnte zwischen Browser und Backend unterschiedlich gedeutet werden. Die beteiligten Helfer lehnen diesen mehrdeutigen Fall jetzt ab. Der Admin-Transport weist auch einen solchen Namensraum vor einem bekannten Admin-Iframepfad zurück und sendet dabei keine Anmeldung.
2. Eine automatisch umgestellte Navigation in `app.ts` mischte `??` mit einem nicht geklammerten `||`. Der Fallback ist jetzt ausdrücklich geklammert. Die daraus erzeugte JavaScript-Quelle wurde zusätzlich mit dem nativen Parser geprüft.
3. Zwei Zuweisungen an `state.action` in `logic.ts` waren irrtümlich wie Formular-URLs umgestellt worden. Diese beiden Simulationszustandszuweisungen entsprechen wieder unverändert 1.0.34 und hängen nicht vom URL-Helfer ab.

Nach diesen Korrekturen wurde der endgültige Quellstand erneut geprüft. Es verbleibt aus diesem begrenzten Änderungsreview kein offener konkreter Befund.

## Tatsächlich ausgeführte Prüfungen

Umgebung: Node.js 24.22.1, TypeScript 5.8.3, ESLint 10.13.0. Es wurden keine Kundenpasswörter und keine Anlagenzugänge benötigt.

- Alle 25 geänderten beziehungsweise neuen kanonischen WWW-TypeScript-Dateien wurden mit derselben ESLint-Konfiguration geprüft wie ihre vorhandenen 1.0.34-Gegenstücke. Ergebnis: vorher und nachher je 1.043 historische Scannerbefunde, keine neue oder in der Häufigkeit erhöhte Fundstellenkennung. Die Fingerprints wurden mit der tatsächlichen Funktion `fingerprintMessages` aus `scripts/verify-eslint-security.cjs` gebildet.
- Keine der 83 vorhandenen Einzelbewertungen in `docs/security/eslint-reviewed-findings.json` betrifft eine WWW-Datei. Daher ist für diese Dateien keine Neubindung vorhandener Reviewed-AST-Hashes nötig; insbesondere wurden keine historischen Scannerbefunde zu geprüften Ausnahmen umdeklariert.
- 16 gezielt ausgewählte Schutzfunktionen sind als kommentarfreier Funktions-AST exakt gleich geblieben: 14 Auth-/Capability-/Sitzungsfunktionen in `auth.ts`, `allowed` in `admin-guard.ts` und `nwSafeWebUrl` in `smarthome.ts`. Namen und einzelne Hashes stehen im JSON-Beleg. Der Session-Storage-/Query-Schalter von `admin-guard` bleibt dabei ein Navigationsschutz; die echten Rechte werden durch EOS-Endpunkte und die bestehende Auth-Schicht erzwungen.
- Die mit TypeScript auf ES2022 erzeugten JavaScript-Inhalte aller 25 Dateien wurden mit `node:vm.Script` ohne Ausführung vollständig geparst: bestanden.
- Die tatsächlich geänderten Quellzeilen wurden einschließlich EventSource, iframe-Navigation, Exportlinks, Template-Attributen, Auth-Seitenerkennung und Admin-Rücksprung gelesen. Die 1.043 historischen Scannerbefunde sind damit nicht insgesamt als sicher bewertet.

Der JSON-Beleg enthält die alten und neuen vollständigen Dateihashes sowie die geprüften Schutzfunktionen. Sein SHA-256 lautet `1b660b122ae2108c1ca9033752418e22c2c7531e55e2162185f50def24907b5a`.

Die ergänzenden ausführbaren Frontend-Vertragstests, realen HTTPS-/Originalproxy-Prüfungen und vollständigen Build-/Releaseprüfungen werden in den jeweils zugehörigen Berichten dieses Lieferstands ausgewiesen. Dieses Review allein bestätigt weder vollständige ASVS-/CRA-Erfüllung noch einen Praxistest auf einer Kundenanlage.
