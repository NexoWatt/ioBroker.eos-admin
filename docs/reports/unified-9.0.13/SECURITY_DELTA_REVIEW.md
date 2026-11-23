# Unabhängiger Sicherheits-Deltareview: SmartHome-Aktionsmenüs

Stand: 2026-11-23. Gegenstand ist ausschließlich die Menü-/Darstellungskorrektur aus `SMART_HOME_MENU_REVIEW.md` und die dadurch erforderliche erneute Bewertung der zwei bereits einzeln geprüften Scannerfundstellen in `ui/src-ts/runtime-executables/www/smarthome-setup.ts`.

## Verglichener Lieferstand

Der vollständige Quelltext-Diff wurde gegen `delivery-9.0.12/NexoWatt_EOS_9.0.12_FULL_REPOSITORY.zip` geprüft. Die funktionale TypeScript-Erweiterung besteht aus `bindActionMenus()` und dessen einmaligem Aufruf nach der bereits vorhandenen API-Initialisierung. Die bestehenden Funktionen für Konfigurationsentwürfe, Formulare, Erkennung, API-Antwortgrenzen und Fokuswiederherstellung bleiben byteinhaltlich unverändert; ihre Zeilenpositionen verschieben sich um 32 Zeilen.

| Quelle | SHA-256 der geprüften 9.0.13-Datei |
| --- | --- |
| `ui/src-ts/runtime-executables/www/smarthome-setup.ts` | `c64c4ff4763149b355aeef9b5e155b7598b2bb25fcc884296bd6b9b09b102108` |
| `ui/www/smarthome-config-workspace.css` | `ab2e671666ddbf247223f637c3c6fc0053b41f774744430ef301eca4e151794b` |
| `ui/test/unified/smarthome-setup-flow.test.cjs` | `a01fc0862ef9fa6b9e86f18c770d4bfb0124a23f71639261910839c934aaaffd` |

## Tatsächlicher Daten- und Ereignisfluss

Die neue Funktion liest ausschließlich die beiden festen Details-Menüs `.nw-setup-project-actions` und `.nw-shcfg-more`. Ihre Elemente sind bereits vor dem statischen Scriptaufruf im HTML vorhanden. Die Erweiterung setzt deren lokale `open`-Eigenschaft, prüft DOM-Zugehörigkeit und stellt bei Escape den Fokus auf das zugehörige Summary zurück. Es werden keine fremden HTML-Fragmente, URLs oder dynamischen Codefragmente erzeugt. Die Funktion greift weder auf den Kundenentwurf noch auf Netzwerk-, Speicher-, Datenpunkt-, Alias- oder Berechtigungsfunktionen zu.

Aktionsklicks werden weder erneut ausgelöst noch mit `preventDefault` blockiert. Die bisherigen Listener und damit die vorhandenen Speicher-/Import-/Navigationsgrenzen bleiben maßgeblich. Escape wird nur dann als Menübedienung behandelt, wenn der Fokus tatsächlich in einem offenen Aktionsmenü liegt; andernfalls bleibt die bestehende Dialogbehandlung zuständig. Der vorhandene globale Initialisierungsschutz verhindert doppelte Listener bei erneutem Laden des Helpers. Der gebundene Umfang bleibt auf zwei statische Menüs begrenzt.

Die CSS-Änderungen sind auf `body.nw-page-smarthome-config` begrenzt. Sie lösen die konkrete Abschneidegrenze des Kopfkarten-Vorfahren, erhalten dekorative Rundungen und legen die Menüs unterhalb der bestehenden Dialogebenen an. Geschlossene Panels bleiben verborgen. Breite/Höhe werden begrenzt; kleine Ansichten nutzen Dokumentfluss statt absoluter Positionierung. Es entstehen keine zusätzlichen Ressourcenabrufe oder Interaktionsziele. Die vorhandenen Schutz- und Speicheraktionen werden dadurch nicht umgangen.

## Erneut bewertete Scannerfundstellen

Ein tatsächlicher ESLint-Lauf auf der geänderten Quelle ergibt weiterhin genau zwei Vorkommen von `security/detect-object-injection`. Fingerprints, Anzahl, Regeln und Schweregrad bleiben identisch. Die neue Menüfunktion führt keine neue Fundstelle ein.

| Fingerprint | Stelle 9.0.12 → 9.0.13 | Erneute Bewertung |
| --- | --- | --- |
| `5b387ff0d9799bf9d16e84bb2b8517a61ced46a3135070c4f0c9686bfb29df74` | Zeile 73 → 105, Spalte 108, Anzahl 1 | `types[value]` bleibt ein reiner Lesezugriff auf eine lokale Literalmap nach Stringprüfung und `Object.hasOwn`. Unbekannte Werte erhalten begrenzten Text. Die Darstellung verwendet `textContent`; kein fremdes HTML, keine Mutation und keine Bedienfreigabe. |
| `51b4edb56178c8f6950d3c1312230385342bd72eb32f05de2056a78dffa198d6` | Zeile 206 → 238, Spalte 504, Anzahl 1 | Der Index stammt unverändert aus `findIndex` der aktuellen Formularelemente und wird auf `>= 0` geprüft. Er indiziert nur die lokale neue NodeList desselben Dialogbodys; optionales Chaining schützt bei verkürzter Liste. Die Wirkung beschränkt sich auf Fokuswiederherstellung. |

Der bisherige kommentarlos gedruckte TypeScript-Codehash aus der ZIP wurde reproduziert:

`bbc11bb5f624328debcac56fad3be088908e01771e7e0f1518575265bbda90c7`

Der nach dem tatsächlichen Deltareview ermittelte neue Codehash lautet:

`9cfb59b0b02578ff675abcd866c5f1720d666991a8cecb2cce64ebbe2e39e1b3`

In `ui/docs/security/eslint-reviewed-findings.json` wurden ausschließlich diese zwei Einträge aktualisiert: Zeilenposition, geprüfter Codehash und konkrete Review-/Belegreferenz. Ihre ursprünglichen Begründungen und Fingerprints bleiben erhalten. Die anderen 224 Einträge sind unverändert. Es wurde keine Baseline ergänzt und keine Regel, Typanforderung oder Scannerkonfiguration gelockert.

Die folgenden Dateien sind bytegleich zur 9.0.12-ZIP:

- `ui/docs/security/eslint-legacy-baseline.json`: `c7fd7ea7039fdfff2c3f7e00abcbc00b76f4984c1f612edcf73bddaf62d8a3b9`
- `ui/eslint.config.cjs`: `e26c551cf94d16544dd21426bd53f33ec666b084d751e1e0a3817998dbbcca14`
- `ui/scripts/verify-eslint-security.cjs`: `4648c57c80978bb713ed48abe72bb5aafa4aea4975e14f81841212c4fb184ab1`

## Ausgeführte Prüfung nach der Bewertung

Der unabhängige gezielte Menütestlauf mit Node 24.22.3 enthält 33 Tests einschließlich der sechs neuen Regressionen: **33 bestanden, 0 fehlgeschlagen, 0 übersprungen**. Geprüft werden unveränderter ungespeicherter Entwurf, einmalige Aktionsausführung, native Summary-Bedienung, Außenklick/Fokus, Escape mit Fokusrückgabe, keine Listenerverdopplung und CSS-Verträge. Die vorhandenen Policy-/Negativtests des ESLint-Gates melden **25 sinnvolle Prüfungen bestanden**.

Das vollständige Sicherheitsgate wurde nach der Aktualisierung erfolgreich ausgeführt, Exitcode 0:

| Kennzahl | Ergebnis |
| --- | ---: |
| Geprüfte Quellen | 208 |
| Aktuelle Scannerfundstellen | 3222 |
| Historische offene Fundstellen | 2952 |
| Einzeln bewertete Fundstellen | 270 |
| Neue oder unzulässige Fundstellen | 0 |
| Nicht mehr vorhandene frühere Vorkommen | 108 |

Die Zählung unterscheidet Fundstellen-Vorkommen von deduplizierten Inventareinträgen. Ein erfolgreiches Gate bedeutet, dass keine zusätzliche oder unzulässige Fundstelle hinzugekommen ist. Die 2952 historischen offenen Fundstellen bleiben sichtbar; dies ist ausdrücklich kein sauberer Gesamtsicherheitsbefund.

Rohbelege dieses Reviews: `raw/ui-security-final.json`, `raw/ui-security-final.log`, `raw/security-menu-tests.log`, `raw/security-policy-regression.log` und `raw/smarthome-menu-lint-review.json`.

## Ergebnis und Grenze

Im geprüften Menüdelta wurde kein Sicherheits-Releaseblocker gefunden. Keine TypeScript-Produktänderung war für diesen Review erforderlich. Die Tests verwenden lokale DOM-/API-Fixtures und statische CSS-Prüfungen. Tatsächliche Browsergeometrie, native Windows-/Touchbedienung, Hardware und Kundenanlagen wurden hier nicht geprüft; die Sichtprüfung aus `SMART_HOME_MENU_REVIEW.md` bleibt deshalb als gesonderte Prüfung dokumentiert. Dieser Review ist keine CRA- oder ASVS-Konformitätserklärung.
