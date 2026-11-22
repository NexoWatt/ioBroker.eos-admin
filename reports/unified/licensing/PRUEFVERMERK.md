# Lizenzintegration NWL3 / gemeinsamer EOS-Kern

Prüfstand 22.11.2026, Node.js 24.22.3. Dateihashes und Vertragsherkunft siehe
`evidence.json`. Ergebnis gilt für die folgenden Softwareprüfungen, nicht als
Gesamtfreigabe des Adapters oder CRA-Konformitätserklärung.

## Änderung

- Vorhandenen NWL3-Vertrag und Home/Pro-Politik aus Keygen 1.0.4 übernommen.
  Ed25519 über exakte Präfix-/Payloadbytes; keine privaten Schlüssel oder
  Generator-Laufzeit im Adapter.
- NWL2 unverändert hinsichtlich signierter Adapterliste, Mengen und Zeitregeln.
  Eine NWL2-Lizenz ohne ausdrücklich signiertes `nexowatt-ui` erhält kein neues
  Kernrecht. NWL3-Systemlizenz erlaubt den Kern gemäß Edition.
- Geschützter AES-256-GCM-Speicher akzeptiert beide Formate. Keine erneute Eingabe
  nach Neustart. Fehlgeschlagene Imports erhalten die gültige Lizenz.
- Gemeinsame synchrone Statusprojektion enthält `coreEnabled`, Formatversion und
  Umfang. Sie verhindert Ablauf-/Zeitmanipulations-/Staleverlängerung auch bei
  verzögerter asynchroner Auswertung; keine Dateiarbeit im synchronen Aufruf.
- Der feste externe HTTPS-Origin funktioniert für Lizenzschreiben über lokalen
  Ingress. Origin und Host müssen passen; Forwarded-Header verleihen kein Vertrauen.
- Aktueller EOS-Trustpfad wird bevorzugt; Legacy nur bei fehlendem Pfad, kein
  Fallback bei unsicherer/beschädigter Datei. Ein expliziter Pfad überschreibt
  beide Standardpfade ohne Fallback.

## Ausgeführte Prüfungen

| Prüfung | Ergebnis | Beleg |
| --- | --- | --- |
| `node --test --test-reporter=tap test/eos-license-*.test.cjs` | 90 bestanden, 0 fehlgeschlagen/übersprungen | `license-tests.tap` |
| Original-Keygen 1.0.4: `test/admin-interop.test.cjs`, `test/eos-r16-interop.test.cjs` mit `NEXOWATT_ADMIN_SOURCE`/`NEXOWATT_EOS_VERIFIER` auf diesen Quellstand | 2 bestanden, 0 übersprungen | `license-keygen-interop.tap` |
| ESLint mit Repositorykonfiguration über `eosLicenseCore.js`, `eosLicensePolicy.js`, `eosLicenseService.js`, `eosLicenseHttp.js` | 0 Fehler/Warnungen im Code; npm meldet eine Host-Konfigurationswarnung | `license-eslint.log` |

Die Keygen-Testbezeichnung „Managed16“ stammt aus dem unveränderten Originaltest;
in diesem Lauf zeigte die explizite Verifier-Variable auf den aktuellen
zusammengeführten Adapter. Der Generator wurde außerhalb des Adapterrepositorys
gehalten. Tests erzeugen kurzlebige zufällige Ed25519-Schlüssel im Speicher.

Die Tests prüfen echte Signaturen, Ciphertext und Dateispeicherung, Format-/UUID-/
Zeit-/Scopefehler, unbekannte Schlüssel, unerlaubte Zusatz-Claims, fehlerhafte
Ersetzung, Wiederanlauf, SDK-Freigaben/Mengen/Features/Widerruf und HTTP-
Autorisierungs-/Origin-/Ratenregeln. Die ioBroker-Objekt-/Messageboxgrenze und
Teile des Dateipfad-Angreifermodells werden simuliert. HTTP-Tests hier sind ein
Handlerharness; der vollständige Browser-/Ingress-/Loginablauf ist ein separater
Integrationsnachweis.

## Offene Grenzen

- Produktiver Vertrauensanker und dessen Übereinstimmung mit dem realen
  Herstellertresor werden bei der Gerätebereitstellung geprüft; kein Schlüssel
  wird im öffentlichen ZIP vorgegeben.
- Geräteabhängige sichere Reaktion auf Lizenzverlust und die gemeinsame
  systemweite Mengenzählung müssen gegen echte Konfigurationen abgenommen werden.
- Same-UID-/Root-Manipulation und vollständiger Datenträger-/UUID-Klon bleiben
  außerhalb des lokalen DRM-Nachweises.
- Physische Geräte, Serienfreigabe, Windows-Trust-ACL und unabhängiger
  Penetrationstest wurden in diesem Prüflauf nicht abgenommen.
