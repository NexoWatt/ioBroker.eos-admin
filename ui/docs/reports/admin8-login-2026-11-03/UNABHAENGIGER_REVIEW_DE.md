# Unabhängiger technischer Review – EMS-Anmeldung 1.0.33

Stand: 03.11.2026. Bezug: `NW-AUTH-ADMIN8-01` bis `NW-AUTH-ADMIN8-03`
im [Auth-Prüfvermerk](AUTH_PRUEFVERMERK_DE.md).

## Ergebnis und Prüfumfang

Die überarbeitete Kontoprüfung und ihre Einbindung in beide Loginrouten wurden
durch eine separate KI-Reviewinstanz überprüft. Nach einer im Review gefundenen
und vor Übergabe behobenen Identitätsabweichung bestehen **16 eigene zusätzliche
Prüffälle**, bei **0 fehlgeschlagenen Fällen und 0 unbehandelten
Promise-Ablehnungen**. Im geprüften Änderungsumfang bleibt kein erkannter
Freigabeblocker offen. Das ist eine interne technische Gegenprüfung, keine
externe Sicherheitsprüfung, Zertifizierung oder allgemeine Produktivfreigabe.

Geprüft wurden die kanonische Quelle
`src-ts/runtime-executables/lib/iobroker-user-auth.ts` und die betroffenen
Authentifizierungs-, Rollen- und Sitzungspfade in
`src-ts/runtime-executables/main.ts`. Die 16 Fälle wurden unabhängig vom
Implementierungstest geschrieben und gegen die im Speicher nach CommonJS
übersetzte TypeScript-Quelle ausgeführt. Die ioBroker-APIs wurden simuliert;
eine echte Controller-/Admin-8-Installation war nicht beteiligt.

Die Quellkommentare wurden anschließend mechanisch um die vom Dokumentgenerator
verlangten Felder „Daten und Wirkung“ und „Bei Änderungen“ ergänzt. Diese
Kommentarfortschreibung ist von einer fachlichen Produktänderung getrennt.
Der unten gebundene Wiederholungslauf liest bereits den ergänzten Kommentarstand.
Der vorher geprüfte Helper-Rohhash lautete
`3827705f612e5ac64d20bb3eac0a8d4a9fabec6a4f165e5db38d16164fe5d3ca`.
Die finale Vollarchivbindung und Paketprüfung erstellt die Releasebearbeitung.

## Fachliche Gegenprüfung

- Die öffentliche Controller-Auflösung `getUserID(rawName)` erhält Vorrang vor
  dem historischen ID-Fallback. Vollständige `system.user.…`-IDs bleiben
  unverändert. Eine fehlgeschlagene oder fehlende Namensauflösung wird nicht
  still auf ein anderes Konto umgebogen; nur `undefined` aktiviert den Fallback.
- Beide Loginrouten verwenden ausschließlich `authentication.user` für Rollen,
  Sitzung und Rückgabe. Ein Anzeigename `admin`, der auf ein Kundenkonto zeigt,
  verleiht keine Adminrolle aus dem Rohtext.
- Der Passwortcallback muss exakt Boolean `true` und dieselbe vollständige
  kanonische Konto-ID liefern. Truthy-Werte, fehlende oder abweichende IDs
  werden verweigert. Fehler aus synchronen und asynchronen API-Aufrufen bleiben
  behandelt.
- Die aktuelle Konto-ID wird vor und nach der Passwortprüfung gelesen. Der
  Passwort-Fingerabdruck muss gleich bleiben; eine Sperre, Objektverwechslung
  oder Passwortänderung verhindert die Anmeldung. Die Passwortprüfung bleibt
  bei ioBroker; SHA-256 dient hier nur dem bestehenden Sitzungswiderruf.
- Ein gemeinsames Budget von höchstens 5.000 ms umfasst Resolver, beide
  Kontolesungen und Passwortprüfung. Späte Resultate erzeugen keine neue
  erfolgreiche Prüfung. Das Budget ist kein Abbruch bereits gestarteter
  ioBroker-Datenbankoperationen.

### Gefundener und geschlossener Reviewbefund

Im ersten Helperentwurf waren kanonische Kontosuffixe mit Rand-Leerzeichen
zulässig. Die bestehende Rollenfunktion trimmt den Suffix. Dadurch konnte ein
synthetischer Alias auf `system.user. admin` oder `system.user.admin ` zunächst
sein eigenes Passwort bestätigen und danach als `admin` in die Rollenauflösung
eingehen. Beide Varianten wurden vor der Korrektur separat reproduziert.

Die Korrektur verlangt `suffix === suffix.trim()` bereits bei der kanonischen
ID-Prüfung. Beide Varianten werden jetzt vor Kontolesung und Passwortprüfung
abgewiesen. Dies ist durch `IR-04` und zusätzlich im Implementierungstest
nachgeprüft. Der Befund betraf den neuen, noch nicht übergebenen Entwurf; er
belegt keine erfolgreiche Ausnutzung einer veröffentlichten Installation.

## Eigene reproduzierbare Prüffälle

Umgebung: Node.js **v24.22.1**, TypeScript **5.8.3**,
Linux-Entwicklungsumgebung. Aufzeichnung: `2026-11-03T21:35:03.040Z`.

```sh
node docs/reports/admin8-login-2026-11-03/unabhaengiger-review-checks.cjs
```

| ID | Prüfung und erwartetes Verhalten | Ergebnis |
| --- | --- | --- |
| `IR-01` | Alias admin ergibt kanonisches Kundenkonto | Bestanden |
| `IR-02` | Kurze ID wird im offiziellen Fallback kleingeschrieben | Bestanden |
| `IR-03` | Vollständige ID bleibt unverändert und umgeht Resolver | Bestanden |
| `IR-04` | Rand-Leerzeichen in kanonischer ID vor Kontolesung abgewiesen | Bestanden |
| `IR-05` | Nur Boolean true plus identische Callback-ID | Bestanden |
| `IR-06` | Fehlende Callback-ID abgewiesen | Bestanden |
| `IR-07` | Passwort-Fingerabdruckwechsel während Prüfung abgewiesen | Bestanden |
| `IR-08` | Kontosperre während Prüfung abgewiesen | Bestanden |
| `IR-09` | Abweichende Objekt-ID abgewiesen | Bestanden |
| `IR-10` | Resolver-Ablehnung sperrt statt Kontofallback | Bestanden |
| `IR-11` | Synchroner API-Fehler abgewiesen | Bestanden |
| `IR-12` | Promise-Ablehnung ohne Callback abgefangen | Bestanden |
| `IR-13` | Resolver-Timeout verhindert nachfolgende Kontolesung | Bestanden |
| `IR-14` | Kontolesung-Timeout verweigert Zugriff | Bestanden |
| `IR-15` | Später erfolgreicher Callback ändert Ablehnung nicht | Bestanden |
| `IR-16` | Späte Promise-Ablehnung nach gültigem Callback bleibt behandelt | Bestanden |

Die verkürzten Timeoutproben verwenden ausschließlich den internen Testparameter
10 ms. Daraus wird keine Echtzeitaussage über die Nutzeranlage abgeleitet.
Der Callbackvertrag bleibt auch bei einer späten Promise-Ablehnung maßgeblich;
der Test verlangt dabei, dass kein unbehandelter Fehler entsteht.

Rohbelege: [Prüfskript](unabhaengiger-review-checks.cjs),
[maschinelle Ergebnisse](unabhaengiger-review-checks.json).
Die Protokolle enthalten nur Fallkennungen, Ergebnisse, Werkzeugversionen und
Quellhashes. Synthetische Passwörter, gespeicherte Passwortfelder und
Fehlerobjekte werden nicht ausgegeben; echte Konten wurden nicht verwendet.

## Gezielte Nachprüfung der fünf bestehenden Main-Lint-Einträge

Die fünf bestehenden `security/detect-object-injection`-Einträge wurden an ihren
unveränderten Zielausdrücken mit dem ursprünglichen 1.0.32-Vollarchiv verglichen.
Alle fünf Ausdrücke sind identisch. Zusätzlich wurden die unmittelbaren
Aufruf-/Schutzbedingungen im aktuellen Quelltext gelesen: feste Partner-App-IDs
und Projektion-State-IDs, lokale Nullprototyp-Maps, Lizenz-/Aktivierungsprüfung,
Frische-/Datentypprüfung sowie Nullprototyp für den Diagnosezähler.

| Aktuelle Main-TS-Zeile | Begrenzter Prüfumfang | Vergleich |
| --- | --- | --- |
| 4991 | Partner-App-ID und lokale Aktivierungs-/Lizenzprüfung | Ausdruck unverändert gegenüber 1.0.32 |
| 5005 | Lokaler Availability-Map-Lesezugriff, Nullprototyp und Frischeprüfung | Ausdruck unverändert gegenüber 1.0.32 |
| 5010 | Lokaler Cache-Lesezugriff, feste Projektion-State-IDs | Ausdruck unverändert gegenüber 1.0.32 |
| 5011 | Lokaler Telemetrie-Map-Lesezugriff, Nullprototyp und fachliche Projektion | Ausdruck unverändert gegenüber 1.0.32 |
| 23109 | Diagnosezähler mit Object.create(null) | Ausdruck unverändert gegenüber 1.0.32 |

Diese begründeten Einzelfallbewertungen sind keine pauschale Prüfung der
vollständigen Hauptdatei. Der zugehörige Codehash wird vom vorhandenen Gate mit
dem TypeScript-AST-Drucker und `removeComments: true` gebildet. Er ist deshalb
von einem SHA-256 der Rohdatei zu unterscheiden:

- AST-Codehash: `356ff0732b52c3e9248e2739600c9ffa7a0cc6f380c4d3424a4e331d24723938`.
- Alle fünf gespeicherten Codehashbindungen stimmen mit diesem Stand überein.
- Der vorhandene Gate-Rohbericht nennt 175 Quellen, 3.067 aktuelle Scannerstellen,
  davon 2.971 offen fortgeführte und 96 individuell bewertete Stellen sowie
  0 neu blockierende Stellen. Diese Zählwerte wurden übernommen und geprüft;
  der vollständige Scannerlauf wurde von dieser Reviewinstanz nicht wiederholt.

Bereinigter Rohbeleg einschließlich ursprünglichem Archivhash,
Ausdrucksvergleich und fünf Einträgen:
[Lint-Altstellenvergleich](unabhaengiger-review-lint-altstellen.json).
Die bereits offenen 2.971 Scannerstellen sind dadurch nicht geschlossen.

## Quell- und Belegbindung

Der Prüflauf bindet die kanonischen TypeScript-Dateien und erfasst zusätzlich
die zu diesem Zeitpunkt vorhandenen JavaScript-/Testartefakte. Die eigenen
Prüffälle führten die TypeScript-Quelle aus; die erfassten JavaScript-Hashes
allein sind keine Ausführungsprüfung dieser Dateien.

| Datei | SHA-256 der Rohdatei beim Prüflauf |
| --- | --- |
| `src-ts/runtime-executables/lib/iobroker-user-auth.ts` | `ecaac7903afe58886b31b245aa5366ac0a5e5d95b62da0878ed3f01fd21b2530` |
| `src-ts/runtime-executables/main.ts` | `4161d78db2566b2f785ec46adab7eec6e9ec1b2f88cc831ee9ad460a8ef2872e` |
| `main.js` | `515039e4d9d63fc1ac710bc674d2226b86d95a8e4749369fcdf4d9f300b1b11b` |
| `lib/iobroker-user-auth.js` | `0738e98ab78f6b81fccb9c42de8b16fa3dc30cdfe560fac2705ea4bb27f5c64b` |
| `scripts/verify-iobroker-user-auth.cjs` | `69e0a6f556b08642707fd3e876717eb64c36d5c8a905a0730a73f71a15a0aafb` |
| `tsconfig.iobroker-user-auth.json` | `20072c772a99c3cdf0d5cf79bbe6d01acc3ff44c615ae70ffd6354baf84aa2e1` |

| Reviewbeleg | SHA-256 |
| --- | --- |
| `unabhaengiger-review-checks.cjs` | `766aeb0669f53a02f3e58a5a36512e576343b90d5ca0d6cc27cacba35c85d217` |
| `unabhaengiger-review-checks.json` | `a137d30dbd8d39d6188dad6fa9756c06d71d9daeb30450f07caa9399357c3e43` |
| `unabhaengiger-review-lint-altstellen.json` | `b6fcafda9cfa44fadb20e4ec0b075a1f685efc4b4aefccb8ec491de89a3971dd` |

Das Review-Prüfskript erhielt nach seinem aufgezeichneten Lauf ausschließlich
den fünfzeiligen proprietären NexoWatt-Copyrightheader. Der Rohbeleg behält
den beim Lauf tatsächlich verwendeten Skripthash; die Tabelle oben nennt den
abschließenden kommentierten Skriptstand. Testlogik und Ergebnis änderten sich
dadurch nicht.

## Offene Grenzen und bestehende Restarbeit

1. Die konkrete vom Nutzer beobachtete Admin-8-Ursache ist ohne dessen aktuelle
   Kontokonfiguration nicht abschließend bestätigt. Der Namens-/ID-Fehler ist
   reproduziert; ein echter Admin-8-/Controller-, Browser- und Hausanlagentest
   bleibt offen.
2. Die nachfolgende Rollen-/Gruppenauflösung sowie bestehende Sitzungsstatus-
   Datenbankaufrufe liegen außerhalb des 5-Sekunden-Kontoprüfungsbudgets. Diese
   lokalen ioBroker-Aufrufe sind nicht abbrechbar und können bei ausbleibender
   Antwort weiter warten. Der Bericht behauptet deshalb keine feste Zeitgrenze
   für den vollständigen HTTP-Login oder jeden Sitzungszugriff.
3. Ein schon gestarteter ioBroker-Aufruf kann nach der Kontoprüfungsdeadline
   intern weiterlaufen. Sein Ergebnis wird ignoriert. Laufzeit-/Speicherverhalten
   eines dauerhaft hängenden echten Datenbankdienstes wurde nicht gemessen.
4. Die bestehende Kontoaktivierungssemantik verweigert ausdrücklich
   `common.enabled === false`; die tatsächliche Passwortfreigabe trifft weiterhin
   der Controller. Eine weitergehende Änderung dieses Altvertrags war nicht Teil
   des Kompatibilitätspatches.
5. Der Folgeaudit nach dem Entwicklungspatch ist im Abschnitt unten eingeordnet.
   Es bleiben 13 moderate Entwicklungsbefunde offen. Keine Auditmeldung ist
   ein Nachweis vollständiger Sicherheit; Ausnutzbarkeit und Laufzeitreichweite
   sind anhand der konkreten Einbindung zu unterscheiden.
6. Alle fortgeführten Scannerstellen und sonstigen bestehenden Sicherheitsbefunde
   bleiben in ihren vorhandenen Registern offen, soweit sie dort nicht mit einem
   separaten Nachweis geschlossen sind. Die fünf oben geprüften Lesezugriffe
   begründen keine allgemeine Normerfüllung.

## Offizielle API-Gegenprüfung

Die API-Verträge wurden anhand des offiziellen Controllerstands v7.2.5 gelesen:

- [checkPassword, Namenscache und getUserID](https://github.com/ioBroker/ioBroker.js-controller/blob/v7.2.5/packages/adapter/src/lib/adapter/adapter.ts#L2086)
- [FORBIDDEN_CHARS](https://github.com/ioBroker/ioBroker.js-controller/blob/v7.2.5/packages/common-db/src/lib/common/tools.ts#L182)
- [Controller-Passwortprüfung](https://github.com/ioBroker/ioBroker.js-controller/blob/v7.2.5/packages/common-db/src/lib/common/password.ts)

Dort ist kein automatisches Umschreiben des Passwort-Hashes während der
Passwortprüfung implementiert. Admins eigener OAuth2-/Sessionfluss und der
lokale EMS-Login sind getrennte Pfade; ein Admin-Update allein belegt keinen
Wechsel des gespeicherten Passwortformats.

## Abschließende Artefaktbindung und Root-Audit-Einordnung

Nach dem obigen Testlauf wurde das generierte `lib/iobroker-user-auth.js`
mit der mechanischen Quellkommentarfortschreibung erneut erzeugt. Die geprüften
kanonischen TypeScript-Dateien blieben unverändert. Die JavaScript-Rohhashänderung
ist deshalb separat dokumentiert; sie wird nicht als neuer Ausführungstest
bezeichnet. Finaler Helper-JavaScript-SHA-256:
`2867554a8747196388487e1523fe0ff510a8f81f52b78ef4b807aa16402b9983`.
Der [abschließende Bindungsbeleg](unabhaengiger-review-finalbindung.json)
erfasst außerdem Paket-/Lockfilehashes und Auditrohdateien. Sein SHA-256 lautet
`7b36315891d5a4a71fd2ad485467f60b04cadb4efbbb59d65ac41c0d09c010be`.

Die ursprünglichen 14 Root-Auditeinträge umfassten drei zugrunde liegende
Advisories und ihre abhängigen Pakete. Sämtliche betroffenen Lockfile-Knoten
waren ausschließlich Entwicklungskomponenten. Der bestätigte Patch
`follow-redirects` 1.16.1 → 1.16.2 wurde durch die Releasebearbeitung umgesetzt;
dieser Reviewer änderte keine Produktabhängigkeit.

| Auditrohdatei | Ergebnis |
| --- | --- |
| `npm-audit-root.json` vor Patch | 14 aggregierte Einträge: 13 moderate, 1 high |
| `npm-audit-root-final.json` nach Patch | 13 moderate, 0 high, 0 critical; sämtliche betroffenen Lockfile-Knoten `dev: true` |
| `npm-audit-production.json` | 0 gemeldete Schwachstellen |
| `npm-audit-admin.json` | 0 gemeldete Schwachstellen |

Die Auditläufe stammen aus der Releasebearbeitung; JSON-Ergebnisse, Hashes und
`dev`-Zuordnung im aktuellen Lockfile wurden separat gelesen und gegengeprüft.
Aus diesen verbleibenden Entwicklungsbefunden ist kein ausnutzbarer
Produktfehler nachgewiesen. Ein vollständiger Sicherheitsnachweis für die
Installation oder Lieferkette folgt daraus nicht.

| Ursächliche Bibliothek | Festgestellter Stand / Risiko | Bewertung und nächster Schritt |
| --- | --- | --- |
| `follow-redirects` | Ursprünglich 1.16.1 über Entwicklungswerkzeug `adapter-dev` und Axios 1.20.0. Das Advisory verlangt eine Cross-Realm-`sensitiveHeaders`-Liste und einen fremden Redirect; der Hersteller nennt Axios 1.20.0 ausdrücklich als nicht reproduzierbar, weil es die Liste normalisiert. | Upstreampatch 1.16.2 ist bestätigt und im Folgeaudit nicht mehr beanstandet. Kein Credential-Leak dieser konkreten Einbindung wurde nachgewiesen. |
| `glob` | 10.5.0 im Entwicklungsbaum; abgebrochene Verzeichnisdurchläufe können weiter I/O/CPU verbrauchen. Advisory-Bereich 9.0.0 bis 14.0.1, behoben ab 14.0.2. | Moderaten Entwicklungsbefund offen halten; Aufruferupdates und Kompatibilität prüfen. Kein pauschaler Major-Override als Nebenänderung des Loginpatches. |
| `minimatch` | 9.0.9 und 10.2.6 in Entwicklungswerkzeugen. Präparierte Muster können CPU-/Speicherverbrauch erhöhen. Registry-Advisory nennt `<11.0.1`; Herstellerbeschreibung belegt konkret 10.2.6 bei `optimizationLevel >= 2`. Version 9.0.9 wurde hier nicht separat reproduziert. | Moderaten Entwicklungsbefund offen halten, verantwortliche Toolchain-Updates prüfen. Keine Behauptung einer reproduzierten Produktausnutzung. |

Primärquellen, gelesen am 03.11.2026:

- [Hersteller-Advisory follow-redirects / GHSA-mrwp-f3q8-3g9p](https://github.com/follow-redirects/follow-redirects/security/advisories/GHSA-mrwp-f3q8-3g9p)
- [Hersteller-Advisory glob / GHSA-3g3m-2fjr-6pw4](https://github.com/isaacs/node-glob/security/advisories/GHSA-3g3m-2fjr-6pw4)
- [Hersteller-Advisory minimatch / GHSA-g3hv-75wg-m249](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249)
- [Registry-Advisory mit minimatch-Bereich <11.0.1](https://github.com/advisories/GHSA-g3hv-75wg-m249)

Empfehlung: die verbleibenden Entwicklungsbefunde im vorhandenen Register mit
Werkzeugupdates nachverfolgen; keine ungeprüften Major-Overrides und kein
`npm audit fix --force`. Der ursprüngliche automatische Vorschlag für
`adapter-dev` wäre ein Downgrade auf 1.4.0 gewesen. Produktionsaudit,
Artefaktintegrität und echter Anlagen-Praxistest bleiben eigene Prüfschritte.
