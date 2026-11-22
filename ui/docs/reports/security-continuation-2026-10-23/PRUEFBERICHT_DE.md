<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. Nutzung, Modifikation oder Verbreitung ohne ausdrückliche Erlaubnis untersagt. -->
# NexoWatt UI 1.0.30 – Sicherheitsfortsetzung und Funktionsnachweis

Prüfdatum: 23.10.2026. Gegenstand: bestehender ioBroker-Adapter, keine separate
EOS-Laufzeit und keine Gesamtfreigabe des Zielsystems. Nutzerauftrag: Sicherheit
verbessern und die bestehenden Funktionen erhalten. Bestehende ioBroker-
Abhängigkeiten und historische NW1-Feldtestlizenzen bleiben gemäß bereits
getroffener Nutzerentscheidung erhalten; neue Laufzeitabhängigkeiten werden
nicht hinzugefügt.

## Ausgangspunkt und Umfang

Das unveränderte vollständige Eingangspaket 1.0.29 trägt SHA-256
`73714ad0975c6d1ae6a16f4a8fe8df354d04b075e915be72a35b53362f38a1ed`.
Der neue Stand wird getrennt als 1.0.30 paketiert. Historische Nachweise bleiben
als historische Ergebnisse erhalten. Es wurden keine Liveanlage, Cloudkonten,
Geräte-Sollwerte oder bestehenden Lizenzschlüssel verändert.

## Änderungen und Sicherheitsgrenzen

| Bereich | Ergebnis / Grenze |
|---|---|
| Mesh-Peer-Feldtest | Reproduzierter fremder Zweitkontakt mit Token nach HTTP-302; zusätzlich 2.097.183 Byte Antwort und ungültiges JSON ohne hinreichende Abweisung. Gezielte Transportkorrektur mit Redirect-Sperre, begrenztem Body, Schema-/Strukturprüfung, echter Abbruchfrist und Singleflight. |
| ENTSOe-Tarifdaten | Quadratisch laufende Suche bei vielen unvollständigen XML-Starttags reproduziert; durch begrenzten vorwärtslaufenden nativen Parser ersetzt. Mehrere Perioden, Namespaces und negative Preise bleiben im Regressionstest. |
| Admin-TypeScript | Gesamte React-Adminquelle wird mit strict, noImplicitAny, strictNullChecks, useUnknownInCatchVariables und ohne noCheck geprüft; keine expliziten any-Typen. Native Vertragsprüfungen für API, ioBroker-Callbacks, postMessage und Paarungsimport. |
| Konfigurations-APIs | NVP und Dynamic Grid mit geprüften unbekannten Eingaben, typisierten CAS-/Cache-/Hookverträgen; keine fachliche Änderung an Gerätegrenzen, Freigaben oder Lizenzlogik. |
| Automatisches Linting | ESLint, typescript-eslint und Security-Plugin als reine Entwicklungswerkzeuge. Fingerprint-Baseline ausschließlich aus unverändertem 1.0.29; neue Fundstellen benötigen Korrektur oder konkrete dokumentierte Prüfung. Kein pauschales Unterdrücken aller Altbefunde. |
| Proprietäre Header | Eigene JS-/TS-Quellen und erzeugte Spiegel über gemeinsamen Generator-/Prüfvertrag. Ausgeschlossene Fremdbundles und Drittanbieterhinweise werden nicht umdeklariert; JSON/HTML/CSS/Binärdateien fallen nicht unter diese JS-/TS-Kopfprüfung. |
| Bedienung / Daten | Leere Zahlenfelder bleiben beim Bearbeiten zulässig; Backend entscheidet weiterhin über Speichern und aktive Freigaben. Archivexport bewahrt Zusatzfelder und verhindert rückwärtslaufende/stehende Seitennavigation. |
| Abhängigkeiten | Die Runtime-Lockfilebäume bleiben gegenüber 1.0.29 exakt bei 78 Root- und 9 Adminpaketen, ohne Versionsänderung. Keine neuen Runtimepakete. Buildwerkzeuge sind nicht Node-Standardbibliothek; die bereits vereinbarte ioBroker-Kompatibilitätsausnahme bleibt ausdrücklich bestehen. |

`strict` ist ein Compilerprüfmodus und kein Sicherheitsnachweis für Daten zur
Laufzeit. Die alten Runtimequellen außerhalb der neu geprüften Module enthalten
weiterhin Typausnahmen. Kein vollständiger ASVS-L2-Nachweis, kein neuer
Zertifizierungs- oder Garantieanspruch. Ein ESLint-Hotspot ist nicht automatisch
eine ausnutzbare Schwachstelle.

## Ausgeführte Prüfungen

Umgebung: Node 24.19.0, TypeScript 5.8.3, Chromium 153. Die Browserläufe
verwenden synthetische Daten und temporäre Adapterzustände, keine Feldgeräte.

| Prüfung | Ergebnis |
|---|---|
| Gesamte Adminquelle und Vite-Konfiguration | Echter Strict-Compilerlauf bestanden; 17 Admin-Quelldateien plus Buildkonfiguration |
| Abschaltschutz für strikte Compilerprüfungen | 23 positive/negative Fälle; neun Strict-Unteroptionen, exakte Dateiabdeckung, Typunterdrückungen und any-Verbot |
| Admin-Grenzen | 12 DTO-, 9 Connection-/Callback- und 7 Mesh-Vertragsgruppen bestanden |
| Bestehende native Frontendprüfungen | 92 Fälle bestanden, darunter Router, Datenpunktauswahl, Navigation und Entwurfsversionen |
| Echte Browserbedienung | UI 12, Speichern/CAS 6, NVP 15 und Navigation 9 Szenarien/Checks bestanden; zusätzlich Home-AppCenter und mobile Historie |
| NVP-/Dynamic-Grid-Konfigurationsgrenzen | 10 neue Grenztests und 35 bestehende API-/HTTP-Fälle bestanden; unabhängiger Originalvergleich mit 44 Fällen ohne unerwartete Verhaltensänderung |
| Mesh-Peer-Transport und tatsächliche Express-Route | 28 Gruppen bestanden, darunter Redirect ohne Zweitkontakt, Größenlimits, echte Abbrüche, TLS-Prüfung, Rollen, neutrale Probe, Mehrpeer und Wiederaufnahme |
| ENTSOe-Tarifdaten | 19 neue Parserprüfungen und 23 bestehende Tarifprüfungen bestanden; zusätzlich 18 unabhängige Datensätze gegen 1.0.29 verglichen |
| Lizenzheader und Generatoren | 18 Prüfgruppen bestanden; 772 eigene Quellen und 701 generierte Dateien ohne Lücke im definierten JS-/TS-Scope |
| Header-Migration | 732 Köpfe ergänzt; 771 dabei geprüfte Quellkörper/Tokens unverändert; neun manuelle Spiegel separat auf unveränderte ausführbare Tokens geprüft |
| ESLint-Sicherheitsgate | 25 Policytests bestanden; 165 Quellen, 3.019 Hinweise: 2.971 historisch offen und 48 konkret geprüft, keine neuen/verbotenen Fundstellen |
| Abhängigkeitsaudit | Root und Admin jeweils 0 bekannte Schwachstellen; Aussage bezieht sich auf die gelockten Bäume und den Ausführungszeitpunkt |
| Vollständiger integrierter Lauf, finaler Build und Paketprüfung | Bestanden: test:all Exit 0 in 202,98 s; finaler TypeScript-Build, docs:check, publish:check, Paket-Laufzeitstart und npm-Pack-Trockenlauf jeweils Exit 0 |

Die ursprünglichen Compilerkonfigurationen erbten bereits NodeNext. Der ältere
Projektcheck verlangt diese Angaben zusätzlich ausdrücklich in jeder Root-
Konfiguration; beide neuen Konfigurationen wurden entsprechend ergänzt. Der
vollständige Browserlauf benötigt hier die bekannte Chromium-Datei und
`FONTCONFIG_PATH=/etc/fonts`. Die Releaseprüfung verlangte wie bisher höchstens
sieben ioBroker-News-Einträge; die Historie bleibt vollständig im Changelog.
Diese gestoppten Vorläufe werden nicht als bestandene Gesamtläufe gezählt.

Reproduzierbare Prüfpfade: `npm run test:all`, `npm run build:ts`,
`npm run test:security-standards`, `npm run docs:check`, `npm run publish:check`,
`npm run test:package-runtime-start-smoke` und
`npm pack --dry-run --json --ignore-scripts`. Browserpfade sind
Umgebungsparameter; das Produkt benötigt keine neue Browserabhängigkeit.

Detailnachweise: [Mesh-Transport](MESH_PEER_DE.md),
[unabhängige Laufzeitprüfung](INDEPENDENT_RUNTIME_REVIEW_DE.md),
[ESLint und ENTSOe](ESLINT_PRUEFNACHWEIS_DE.md) und
[Header-/Budgetmigration](../../security/PROPRIETAERE_QUELLHEADER_DE.md).
Die vollständigen Ergebnislogs liegen unter `evidence/`; maßgeblich sind
`final-validation-results.json` und `test-all-complete.log`.
Die frische Repository-Kopie und das Überkopieren über ein älteres Paket
bestehen die vollständige Publish-Prüfkette ohne Entwicklungsabhängigkeiten.
Alte Bundles wurden dabei gesichert und aktuelle Assets bytegleich erhalten.
Die neue Admin-Testprüfung verwendet den regulären, exakt gelockten
TypeScript-Devtoolimport; ein vorheriger verschachtelter Installationspfad
wurde bei der Paketprüfung erkannt und korrigiert. Danach wurde der
vollständige Gesamtlauf erneut erfolgreich ausgeführt.
Ein nicht ausgeführter Remote- oder Anlagentest wird nicht als bestanden dargestellt.

## Verbleibende Arbeit

NW-TS-01/02: vollständige Migration des Runtime-Altbestands weiter offen.
Die neue No-Check-Erkennung berücksichtigt tatsächliche führende TypeScript-
Direktiven auch hinter Lizenz- und Transpilierkommentaren. Der unveränderte
1.0.29-ZIP-Abgleich weist 73 betroffene Runtimequellen nach; der alte Budgetcheck
zählte nur 60. Diese Messkorrektur ist keine neu eingeführte Typausnahme.
Der begrenzte Zeilenzuwachs für die konkret geprüften Sicherheitskorrekturen
wird im Header-/Budgetnachweis einzeln ausgewiesen.
NW-PROC-04: CodeQL-Workflow vorhanden, erfolgreicher Remote-Lauf und Branchschutz
nicht in dieser Umgebung nachgewiesen. NW-OPEN-01: tatsächlicher TLS-/Proxy-/
Firewallbetrieb des Anlagenhosts bleibt offen. NW-SECRET-01: historischer
symmetrischer NW1-Vertrag bleibt bewusst kompatibel und darf nicht als geheimes
Authentifizierungsverfahren betrachtet werden. Keine automatische Lizenzmigration.

Die bestehenden lokal gespeicherten und vom Installer bearbeitbaren
Konfigurationen bleiben funktionsfähig. Eine ausschließlich eingefrorene
Gesamtkonfiguration oder vollständige Abhängigkeitsfreiheit wird nicht behauptet.

Die generische Admin-Antwortprüfung begrenzt Struktur und Knotenzahl erst nach
`Response.json()`. Ein vorgelagertes generisches HTTP-Byte-Limit ist dort noch
nicht vorhanden. Die neue 1-MiB-Transportgrenze gilt ausdrücklich für den
Mesh-Peer-Feldtest, nicht für sämtliche Adapter- oder Browser-APIs.

Softwaretests ersetzen keine Hardwareprüfung. Reale ioBroker-/js-controller-
Version, angeschlossene Geräte, Datenpunktvorzeichen, Antwortzeiten, Neustart,
Netzausfall, unabhängige Watchdogs sowie Backup-/Restore-/Rollbackabläufe müssen
auf der Zielanlage geprüft werden. Status bleibt `review`,
`productionApproved: false`.

## Maßstäbe und Quellen

- [OWASP ASVS](https://asvs.owasp.org/) und [Primärquelle](https://github.com/OWASP/ASVS)
- [TypeScript strict](https://www.typescriptlang.org/tsconfig/strict.html)
- [Compilergrenze noCheck](https://www.typescriptlang.org/tsconfig/noCheck.html)
- Technische Primärnachweise: Quellcode, echte Transport-/Browser-/Regressionstests
  und unveränderte Ausgangsdateien; kein Scannerergebnis ersetzt die Prüfung
  einer konkreten Angriffs- und Vertrauensgrenze.
