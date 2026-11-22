# Sicherheitsprüfung und Anpassung – NexoWatt UI 1.0.22

Prüf-/Änderungsdatum: 29.09.2026. Auftrag: aktuelles vollständiges Repository
1.0.21 nach der persönlichen EOS-Sicherheitsvorgabe prüfen und anpassen.
**Status: Sicherheits-Prüfstand, keine Produktivfreigabe und keine CRA-Konformitätserklärung.**

## Prüfgegenstand und Ergebnisgrenze

Geprüft und bearbeitet wurden der Adapterkern, Browser-/Adminoberfläche,
Mesh-/SMTP-/Tarifkommunikation, Build-/Releasewerkzeuge und die aus den Lockdateien
installierten Abhängigkeiten. Die Prüfung verbindet konkrete Befunde mit
Korrekturen, reproduzierbaren Tests und den gelieferten Quell-/Dateihashes.

Nicht vorgelegt waren ein komplettes Geräteimage, der tatsächlich installierte
ioBroker-/js-controller-/Drittadapterbestand und reale Aktoren. Daher werden weder
deren Sicherheitsstatus noch Elektro-/Anlagensicherheit oder vollständige Normerfüllung
bescheinigt. Die zusätzliche interne Quellcodeprüfung ist keine unabhängige Zertifizierung.

## Wesentliche Änderungen

- Zehn API-/Anmeldethemen korrigiert: technische Rechte, Scope-Validierung,
  Kontowiderruf, sichere Defaultpolicy, Ressourcenlimits, Browser-Origin,
  rekursiver Konfigurationsschutz, Sollwertgrenzen und Stationszugangsschutz.
- HTML-/URL-Ausgabe, Iframe-Rechte und API-Offlinecache korrigiert. Neue
  Stationsdisplay-Token besitzen 128 kryptografische Bits; Alt-Token werden
  sichtbar zur bewussten Rotation vorgesehen.
- Mesh-Protokoll v2 mit Challenge-/Replay-Schutz, tatsächlicher DNS-Zielprüfung,
  begrenzten Antworten und explizitem TLS-Mindestniveau. SMTP speichert mit
  zufälligen exklusiven Tempdateien. Tariftransport begrenzt Datenmengen/Zeit,
  fordert TLS für Geheimnisse und folgt keinen Redirects.
- Express-/Parserpakete aktualisiert, ungenutzte Testbibliothek entfernt und
  React Router gezielt auf 7.18.4 migriert. Geheimnissuche erweitert.
- CRA-Akte, verständliches Befundregister, tatsächliche Buildinventare/SBOM und
  Prüfbelege ergänzt. GitHub-CI liegt als Konfiguration vor; kein Remote-Repository
  wurde neu eingerichtet, keine Software veröffentlicht und keine Anlage verändert.

Einzelfälle mit Angriffsbedingungen und stabilen Kennungen:
[BEFUNDREGISTER_DE.md](../../security/BEFUNDREGISTER_DE.md).

## Umgebung und Verfahren

Linux x64, Node.js 24.19.0, npm 11.9.0, TypeScript 5.8.3; später zusätzlich
Chromium 153.0.8010.0 als getrenntes Testwerkzeug. Chromium ist keine neue
Produktabhängigkeit. Detaillierte Umgebung: `environment.json`.

Reale lokale TCP-/HTTP-Server prüfen Transport- und API-Verhalten. ioBroker-Konten,
Zustände, Geräteaktionen, einzelne TLS-/SMTP-/Providergegenstellen sind kontrollierte
Testdoubles. Browserprüfungen betreffen Chromium/DOM und bestehende AppCenter-/UI-
Regressionsfälle. Hardware, produktive SMTP-/Tarifanbieter, Tailnet, echte
Zertifikate und Wiederherstellung wurden nicht als bestanden gewertet.

### Ausführungsübersicht

Die abschließenden Befehle und Exitcodes werden in `final-validation-index.json`
zusammengeführt. Zu jedem Eintrag gehört das gleichnamige vollständige `.log`.
Der vollständige Schlusslauf `npm run test:all` bestand am 29.09.2026 von 20:25:18 bis 20:27:47 UTC (148,9 Sekunden, Exit 0). Der danach ausgeführte Build und die Paketprüfungen bestanden ebenfalls; die 78.630 Bytes Gesamttestausgabe liegen vollständig vor.

| Bereich | Tatsächlicher Nachweis |
| --- | --- |
| Installation und Abhängigkeitsprüfung | Beide Lockfileinstallationen erfolgreich; endgültiges npm-Audit für Root gesamt, Root Laufzeit und Admin jeweils Exit 0 / 0 Meldungen. |
| Gezielt neue Sicherheitstests | 19 API-/Authfälle, 12 Netzwerkgruppen, 42 Frontendfälle, 11 Tarifgruppen, 6 HTTP-/Parserfälle und 36 Router-/Zugriffsfälle; außerdem Freigabesperre und Geheimnisscanner geprüft. |
| Tatsächlicher Browser | AppCenter-Sitzungs-/Lizenztest und Frontend-HTML-Sinks in Chromium erfolgreich; konkrete Kundenwidgets bleiben Integrationstest. |
| Mesh-Regressionsnachweise | 20 Mesh-, 14 Accounting-, 4 Lifecyclegruppen und SMTP-Regression; Loopback/Fixtures, keine physische Traforegelung. |
| Gesamtprüfkette / Build / Paket | `npm run test:all`, `npm run build:ts`, `npm run publish:check`, `npm run test:package-runtime-start-smoke` und `npm pack --dry-run --json --ignore-scripts`: sämtlich Exit 0. Paket-Smoke prüfte 231 JS/MJS-Dateien und relative Startpfade. |

0 Audit-Meldungen bedeutet keine bekannte Meldung der abgefragten Advisory-Datenbank
für den geprüften Baum. Es ist weder Vollständigkeitsgarantie noch Gerätefreigabe.
Quellcodeprüfung und Sicherheitstests decken konkrete Risiken ab; ein vollständiger
externer SAST-/DAST-/Penetrationstest oder eine ASVS-L2-Zertifizierung fand nicht statt.

## Zwischenfehler und Nachprüfung

Zwischenstände bleiben erhalten und werden nicht als final bestanden ausgegeben:

1. Der erste Gesamtversuch wurde nach einer weiteren Mesh-Änderung durch die
   Dokumentations-/Artefaktkonsistenzprüfung gestoppt. Quellen, Spiegel und
   Dokumentation wurden anschließend zusammengeführt.
2. Manuell typisierte Spiegel hatten trotz fachlich übernommener Änderungen alte
   Originalhashes. Nach Abgleich wurden sie aktualisiert; der Sync meldet solche
   Zwischenstände künftig ausdrücklich als Fehler und überschreibt keine Typisierung.
3. Der vollständige Lauf stoppte zunächst mangels Chromium. Ein Browser wurde als
   separates Testwerkzeug bereitgestellt und die betreffenden Prüfungen ausgeführt.
4. Ein älterer Speicherlizenztest extrahiert HTTP-Handler isoliert und kannte den
   neuen Tokenprüf-Helfer nicht. Der Fixture-Kontext wurde mit dem echten Helfer
   ergänzt; die fachlichen Lizenzgrenzen bleiben unverändert geprüft.
5. Die anfängliche dateibasierte Mitschrift einzelner Langläufe war in dieser
   Arbeitsumgebung unvollständig. Endgültige Läufe erfassen stdout/stderr vollständig
   im Prozessspeicher und schreiben erst nach Abschluss die Rohdatei. Unvollständige
   Zwischenlogs werden nicht als alleiniger Erfolgsnachweis verwendet.

## Komponenten, Hashes und Ablage

- `release-manifests/sbom-index.json`: sieben SBOM-Ansichten; Lockfileinventar,
  tatsächlich installierter Buildbaum, Produktions-Abhängigkeiten und tatsächlich
  im Admin-JavaScript gebundene Pakete werden getrennt ausgewiesen.
- `release-manifests/admin-bundle-components.json`: aus dem realen Rollup-Modulgraph
  erhobene Herkunft und Hashbindung des fertigen Admin-Bundles.
- `scripts/release-artifact-manifest.json`: unveränderliche veröffentlichbare
  Paketdateien. Manuelle Versiegelung nach Änderung/Prüfung; kein automatischer
  Neubau oder Neuversiegeln innerhalb von npm publish.
- `release-manifests/repository-payload-sha256.json`: abschließende SHA-256-Liste
  der gelieferten Repository-Dateien (ausgenommen dieses Selbstverzeichnis).
- `source-change-index.json`: Änderungsliste gegenüber der Original-ZIP,
  Quell-/Runtime-Dateien mit alten und neuen Hashes; generierte Nachweise gesondert.

Das vollständige Quellpaket enthält die alten historischen Releaseberichte weiterhin.
Ihre damaligen Freigabesätze gelten ausschließlich für den genannten früheren Stand.
Die verbindliche Remote-Quellablage, Branchschutz/MFA und gesicherte
Langzeitaufbewahrung sind organisatorisch noch nachzuweisen.

## Freigabehindernisse und sichere Weiterarbeit

`release-manifests/release-status.json` enthält `productionApproved: false`.
Im ursprünglichen Prüfstand vom 29.09.2026 war die normale Publish-Kette an
`release:approval` gekoppelt; `release-not-approved` wurde als erwartete Sperre
geprüft. Die damaligen Rohprotokolle bleiben historische Nachweise dieses Ablaufs.
Die anschließende Korrektur trennt den npm-Upload von der Produktivfreigabe:
Die normale `prepublishOnly`-Kette enthält `release:approval` nicht mehr.
Der gesonderte Befehl `release:production-check` prüft weiterhin erst die
Produktivfreigabe und dann `release:check`. Eine Freigabe wurde dadurch nicht
erteilt. Maßgeblich für den korrigierten Ablauf und seine Nachtests ist der
[ergänzende Prüfbericht](NPM_UPLOAD_SBOM_KORREKTUR_DE.md).

Der Nutzer hat den Test auf seinem eigenen Livesystem ausdrücklich vorgesehen.
Die offene Produkt-/Serienfreigabe wird nicht als zusätzliche technische Sperre
für diesen Eigentest verwendet. Dieser Bericht behauptet keine Durchführung oder
bestandene Abnahme solcher Hardwaretests.

Vor Übernahme in eine Feldanlage: vollständige Sicherung und Restoretest, vorhandene
Konten prüfen, Policies auf angemessene Anmeldung umstellen, alte Displaytokens
bewusst ersetzen, TLS-/Backendsegmentierung prüfen und Master/Slaves gemeinsam
auf Mesh v2 aktualisieren. Lokale Netz-/Geräte- und Rückfallgrenzen mit echter
Hardware in Diagnosebetrieb prüfen. Nächste Herstelleraufgaben betreffen
Gesamtsysteminventar, Support-/Meldeprozess, unabhängige Prüfung und das konkrete
Konformitätsverfahren; Einzelheiten in [CRA-Akte](../../cra/README.md) und Befundregister.
