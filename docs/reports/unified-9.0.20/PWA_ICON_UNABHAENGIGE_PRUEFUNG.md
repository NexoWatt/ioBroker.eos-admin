# Unabhängige Nachprüfung: Login- und iPhone-Webapp-Symbol

**Stand:** 24.11.2026, EOS 9.0.20, vor Auslieferung. **Prüfumfang:** Quelltext, exakte öffentliche Bildpfade, vorhandene Rechte-/Sitzungsgrenzen und negative Request-Policy-Tests. Keine produktive Quelle wurde durch diesen Prüfer geändert.

## Ausgangslage und tatsächliche Änderung

Die ursprüngliche Loginseite enthielt bereits eine Root-Manifestverknüpfung, Apple-Metadaten und ein öffentlich erreichbares Symbol. Ein konkreter Safari-/Zertifikatsfehler auf dem Endgerät wurde damit nicht reproduziert. Der bisherige Apple-Metadateneintrag verwies auf das 1024-Pixel-Original. Der neue Stand verwendet das bereits vorhandene 180-Pixel-Symbol mit passenden Größenangaben und einem aus dessen Inhalt abgeleiteten Cache-Schlüssel. Das originale 1024-Pixel-Symbol und dessen Root-Kompatibilitätspfad bleiben unverändert. Das Loginformular zeigt zusätzlich das vorhandene 192-Pixel-Emblem, unabhängig vom zugeschnittenen Rahmen der großen Wortmarke.

`src-admin/build-tools/eos-public-assets.mjs` ergänzt nur die feste vorhandene 180-Pixel-Datei in seiner Liste rootbezogener Webapp-Assets. Skriptpfade und die geschützte Systemkonsole werden nicht allgemein auf den Rootpfad umgeschrieben. Manifestidentität, Startadresse und Scope ändern sich nicht.

## Geprüfte Zugriffsgrenzen

| Pfad / Mechanismus | Prüfung und Ergebnis |
| --- | --- |
| `/assets/icons/nexowatt-180.png` und Loginbilder | Vorhandener öffentlicher Programmassetpfad; keine Konfiguration oder Anlagenwerte. |
| `/apple-touch-icon-precomposed.png` | Neuer exakt benannter GET-/HEAD-Bildpfad. |
| `/apple-touch-icon-180x180.png` | Neuer exakt benannter GET-/HEAD-Bildpfad. |
| `/apple-touch-icon-180x180-precomposed.png` | Neuer exakt benannter GET-/HEAD-Bildpfad. |
| Alle drei neuen Aliase | Derselbe feste `sendFile`-Pfad auf `www/assets/icons/nexowatt-180.png`; kein Parameter, Requestpfad oder fremder Dateiname wird zusammengesetzt. |
| `Web.mountUnifiedRuntime` | Nur diese drei Namen zur vorhandenen Bootstrapliste ergänzt. Passwortwechsel- und Lizenzprüfung der übrigen Seiten und APIs bleiben bestehen. |
| `isPublicUiRequest` | Exakte Namen in `PUBLIC_PAGES`; nur GET/HEAD. Mutationen erhalten dadurch keine Freigabe. API-/HTML-/Konfigurationsgrenzen bleiben unverändert. |
| Proxy-/Systemkontext | `isUnifiedRequest`, explizite `/system/`-Markierung und bestehende Proxygrenzen gelesen; Referrer allein macht ein öffentliches Rootbild nicht zum geschützten Systemasset. |
| Service Worker | Kein Fetch-Handler und kein Offlinecache für geschützte Seiten/API-Antworten. Der vorhandene Worker entfernt nur benannte Legacycaches und meldet sich anschließend ab. |

Es wurde kein neuer öffentlicher Verzeichniszugang, Dateiauflistungsweg, API-Zugriff, Maschinenbefehl, zusätzlicher Listener oder Passwort-/Lizenzbypass eingeführt. Die PWA-Korrektur verändert weder ioBroker Admin noch Geräte-/EMS-Konfigurationen.

## Unabhängig ausgeführte Tests

`raw/pwa-independent/policy-boundaries.test.cjs` wurde gegen die kanonische TypeScript-Policy unter **Node 22.23.4 und Node 24.22.3** ausgeführt: jeweils **3 Tests bestanden**, keine Fehler oder übersprungenen Tests.

- Alle drei Namen sind für GET/HEAD öffentlich; POST, PUT, PATCH, DELETE, OPTIONS und TRACE sind nicht öffentlich.
- Ähnliche Namen, zusätzliche Suffixe, HTML-Endungen, ungültige Prozentkodierung und normalisierte Traversalpfade zu API/Konfiguration bleiben gesperrt.
- Die Bilder, das Manifest und der Worker erhalten keine unabhängige Maschinenbefehlsfreigabe.

Exakte Befehle, Laufzeiten, Quell- und Protokollhashes: `raw/pwa-independent/policy-receipt.json` sowie die beiden TAP-Dateien. Das Testprogramm liegt als nachvollziehbarer Rohbeleg daneben.

Zusätzlich wurde der neu angelegte tatsächliche HTTPS-Integrationstest `test/eos-pwa-anonymous-https.test.cjs` unabhängig gelesen. Er verwendet den EOS-TLS-Erzeuger und den tatsächlichen Owner-/Runtime-Mount mit einer eigens erzeugten, im Client ausdrücklich geprüften Fixture-CA. Geprüft werden Loginbilder, Manifesticons, Apple-Aliase, MIME/Größe, HEAD sowie die anonyme API-/HTML-Sperre. Controlleridentität und Datenbank sind Fixtures. Der Integrationsverantwortliche bestätigt vier grüne Läufe (Node22/24 jeweils Source-/Build-Webpfad), einschließlich Bildzugriff bei ausstehender Aktivierung beziehungsweise Passwortwechsel und fortbestehender API-Sperre mit 402/403. Belege: `PWA_ANONYMOUS_HTTPS_REVIEW.md` und `raw/pwa-https/evidence.json`. Diese Läufe werden hier als separat ausgeführte Integrationsevidenz genannt, nicht als eigene zusätzliche Hardware- oder iPhone-Prüfung.

## Exakte Scannerbindung nach Source-Freeze

Gesamtscan abgeschlossen **2026-11-24T21:05:33.063Z** mit der tatsächlichen UI-Installation **ESLint 10.13.0**. Ergebnis: **226 Quellen, 3200 Fundvorkommen, davon 2929 historische offene und 271 bereits einzeln bewertete; 0 neue/gesperrte, 0 während des Scans geänderte Quellen**. Rohbeleg: `raw/pwa-ui-independent-review-final.json`.

| Datei | SHA-256 Quelltext | SHA-256 normalisierter Code | Vorhandene Einzelbewertungen |
| --- | --- | --- | --- |
| `src-ts/runtime-executables/main.ts` | `11f2616a2f7f2e5066c180db4316c7f0b219b066790e7c4563dab3e1104d3d96` | `a791c0b8135b6a832cda954c6de8b55cc2350c61af81cd507431a02c9ef467a1` | 9 Einträge / 10 Vorkommen |
| `src-ts/runtime-executables/lib/ui-access-policy.ts` | `c3b68fac91389ad1502fd03a889fdeca278c5230f7441c80bd77b767f0f030de` | `7db85cc2c23c5d0ee2022ab3a4066cd327b55b241b452d79f8703af8bc12ecf0` | 2 Einträge / 2 Vorkommen |

Die neun Main-Grenzen wurden erneut gelesen: bestehende Null-Prototyp-Diagnosemap, Partnerapp-/Ressourcen-/State-Schlüssel, feste History-Abfragenamen, begrenzte binäre Arrayauswahl, Dezimalparser und eigene Discovery-Fehlerzuordnung. Alle bisherigen Fingerprints und Vorkommenszahlen sind unverändert.

In `ui-access-policy.ts` betrifft die bestehende Einzelbewertung ausschließlich zwei lokale CA-Dateizugriffe: `bac207236eb9140cb983413a9544049a7270c237117aa5556effd396452bd182` (`statSync`) und `297e4be4ad7b1276439829954145eb11537cee8a4e9a8ffe44c4998ecd20b78a` (`readFileSync`). Deren Quelle bleibt die lokale `eosCaFile`-Konfiguration, kein HTTP-Parameter. Absoluter Pfad, reguläre Datei, Statgröße bis 65536 Bytes, Zertifikatmarker und Private-Key-Ausschluss bleiben bestehen. Die Bytes werden ausschließlich als TLS-CA mit `rejectUnauthorized:true` genutzt und nicht ausgegeben oder geschrieben. Die neuen öffentlichen Bildnamen erweitern diese Grenzen nicht.

Die frühere Influx-Evidenz bleibt unverändert erhalten. Der separate Aktualisierer `setup-920/refresh-pwa-reviewed-hashes.cjs` darf ausschließlich diese **bereits vorhandenen 9 + 2 Einträge** an den aktuellen Hash binden. Er verlangt passende Roh-/Codehashes, identische Fingerprints und Counts sowie den blockerfreien, stabilen Scan. Er fügt keine Bewertung hinzu. Die unveränderten `ems-apps.ts`-/`adminConnection.ts`-Bindungen bleiben auf ihrem zuvor geprüften Stand.

Die außerhalb des UI-Scanners gelesene Datei `src/lib/web.ts` hat SHA-256 `9393ac6d33a18b7682cfce865dee6dc26cc9b3950f2c03fa8ed13e5d6c9807ab`. Ihr regulärer Build-/Typ-/Lintnachweis bleibt Teil der Abschlusskette.

## Verbleibende reale Abnahme

Mit einem tatsächlichen iPhone die korrekte EOS-HTTPS-Adresse zunächst abgemeldet öffnen, beide Loginlogos prüfen, „Zum Home-Bildschirm“ hinzufügen und den erneuten Start einschließlich Anmeldung prüfen. Eine vorhandene Installation kann ein zuvor gespeichertes Symbol behalten; sie ist gesondert zu vergleichen. Endgeräteseitiges Zertifikatsvertrauen, Darstellung durch eine konkrete iOS-Version und Apple-Symbolcache wurden hier nicht physisch getestet. Die Bildkorrektur ersetzt keine vertrauenswürdige TLS-Konfiguration oder öffentliche Zertifikatsausstellung.

Historische offene Scannerfunde bleiben offen. Dieser Nachtrag ist keine vollständige Sicherheitsbereinigung, CRA-/ASVS-Zertifizierung oder pauschale Freigabe der Kundenanlage.
