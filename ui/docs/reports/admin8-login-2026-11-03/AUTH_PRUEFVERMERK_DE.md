# Kontozuordnung bei EMS-Anmeldung – Prüfvermerk vom 03.11.2026

## Anlass und Geltungsbereich

Gemeldet wurde für NexoWatt UI 1.0.32 nach Installation von ioBroker Admin 8
die Ablehnung von Benutzer/Passwort bei der EMS-Anmeldung. Die konkrete
Kontokonfiguration und Anmeldung auf der Nutzeranlage wurden hier nicht geprüft.
Die nachstehenden Codebefunde sind reproduziert; ihre Übereinstimmung mit der
individuellen Fehlerursache bleibt durch den Praxistest zu bestätigen.

Dieser Vermerk behandelt das neue Modul
`src-ts/runtime-executables/lib/iobroker-user-auth.ts`, seine strikte Typprüfung
`tsconfig.iobroker-user-auth.json` und
`scripts/verify-iobroker-user-auth.cjs`. HTTP-Einbindung, Rollenprüfung und
Paket-/Releaseprüfung sind zusätzliche Prüfungen des Gesamtlieferstands.

## Befunde und Änderung

| Kennung | Befund im Ausgangsstand | Änderung / Nachweis |
| --- | --- | --- |
| NW-AUTH-ADMIN8-01 | Die Anmeldung konstruierte `system.user.` + Rohname und verlangte schon vor `checkPassword` einen Passwort-Fingerabdruck. Anzeigenamen, Großschreibung und vollständige Konto-IDs konnten deshalb mit HTTP 401 enden, ohne die ioBroker-Passwortprüfung zu erreichen. | Öffentliche `getUserID`-Auflösung vor dem historischen ID-Fallback. Vollständige IDs werden direkt verwendet. Konto, Passwortprüfung, Ergebnis und nachfolgende Rollen müssen dieselbe kanonische Identität verwenden. |
| NW-AUTH-ADMIN8-02 | Der Passwortwrapper wandelte beliebige Callbackwerte mit `!!ok` in einen Erfolg um. Synthetische `Error`-/Objekt-/Stringwerte wurden als erfolgreiche Anmeldung akzeptiert. Dies ist ein reproduzierter Robustheitsfehler an einer internen API-Grenze, kein Nachweis, dass ioBroker solche Werte regulär liefert. | Nur `result === true` und eine exakt passende vollständige Callback-Konto-ID sind erfolgreich. Fehler, falsche Identitäten und fehlende Rückgabewerte verweigern den Zugriff. |
| NW-AUTH-ADMIN8-03 | Namensauflösung und Kontolesen benötigen ebenso eine Zeitgrenze; ein Timeout darf nachträglich keine Prüfung/Sitzung erzeugen. | Gemeinsames Budget von höchstens 5.000 ms für Auflösung, beide Kontolesungen und Passwortprüfung. Nach Ablauf keine weiteren Schritte; späte Callbacks und Promise-Ablehnungen werden abgefangen. |

Die Aliasauflösung besitzt ausdrücklich Vorrang vor der Namensnormalisierung:
Wenn der Anzeigename `admin` zum Konto `system.user.kunde` gehört, lautet das
erfolgreiche Ergebnis `user: kunde`. Der Rohname darf niemals Adminrechte
verleihen. Alias-IDs mit führendem oder abschließendem Leerraum im Kontosuffix
werden abgewiesen, damit nachgelagertes Trimmen nicht zu einer anderen Identität
führt. Großbuchstaben und Punkte in bestehenden vollständigen IDs bleiben
erhalten.

Der Controller führt die Passwortprüfung weiterhin selbst durch. SHA-256 des
gespeicherten Passwortfelds dient ausschließlich der bestehenden Kontobindung
und dem Sitzungswiderruf. Kontosperre, Löschung, geänderte Objekt-ID und geänderter
Passwort-Fingerabdruck verhindern die Anmeldung. Ein fehlender/defekter
Namensresolver darf nicht auf ein möglicherweise anderes Konto zurückfallen;
nur sein reguläres Ergebnis `undefined` aktiviert den offiziellen historischen
Fallback. Ohne Resolver bleibt eine explizite vollständige Konto-ID prüfbar.

Die ioBroker-Aufrufe besitzen keine Abbruchfunktion. Ein bereits begonnener
Aufruf kann daher intern weiterlaufen; sein verspätetes Ergebnis bewirkt weder
Authentifizierung noch weitere Prüfschritte. Nachfolgende Rollen-/Gruppenlesungen
des HTTP-Handlers liegen außerhalb des Zeitbudgets dieses Kontoprüfungsmoduls.

## Durchgeführte Prüfungen

Umgebung: Linux-Entwicklungsumgebung, Node.js **v24.22.1**, 03.11.2026.
Der Test prüft zunächst den vollständigen strikten TypeScript-Vertrag und führt
anschließend die kanonische TypeScript-Quelle im Speicher aus. Die ioBroker-APIs
und Konten sind synthetisch; es wurden keine echten Passwörter, Konten oder
Geräte verändert. Testpasswörter werden für jeden Test zufällig erzeugt und
nicht ausgegeben.

```sh
node node_modules/typescript/bin/tsc --project tsconfig.iobroker-user-auth.json
node scripts/verify-iobroker-user-auth.cjs
```

Ergebnis: **beide Befehle erfolgreich; 16 Testgruppen bestanden**.
Rohbeleg: [iobroker-user-auth.log](iobroker-user-auth.log).

| Prüfbereich | Soll / beobachtetes Ergebnis |
| --- | --- |
| Kurze ID, Großschreibung, Anzeigename, vollständige ID | Gleiches kanonisches Konto; beide Kontolesungen und Passwortcallback verwenden seine vollständige ID. |
| Alias `admin` zeigt auf Kundenkonto | Kundenidentität wird zurückgegeben; Passwort des echten Admin-Kontos wird für diesen Alias abgewiesen. |
| Offizieller ID-Fallback | Unicode und zulässige Sonderzeichen erhalten; Leerraum/Punkte normalisiert; bestehende vollständige IDs unverändert. |
| Resolver fehlt, wirft oder liefert ungültigen Typ/ID | Geschlossene Ablehnung ohne Passwortprüfung; nur `undefined` ermöglicht den Fallback. |
| Führender/abschließender Leerraum in aufgelöster Konto-ID | Ablehnung vor Objekt- und Passwortprüfung. |
| Eingabegrenzen | Echte Strings, Benutzername höchstens 128 Zeichen, Passwort 1–1.024 Zeichen; Passwort unverändert einschließlich Leerraum. |
| Kontoprüfung | Exakte `_id`, Typ `user`, nicht explizit gesperrtes Konto und nichtleeres Passwortfeld erforderlich. |
| Callbackvertrag | Nur Boolean `true` und exakt passende vollständige ID; Truthy-Objekte, falsche/fehlende IDs und mehrfache widersprüchliche Rückrufe verweigern bzw. ändern das abgeschlossene Ergebnis nicht. |
| Gleichzeitige Kontoveränderung | Passwortänderung, Sperre, Löschung und ID-Wechsel während der Prüfung ergeben keine Sitzung. |
| Sitzungsfingerabdruck | Bestehende SHA-256-Semantik erhalten; Änderung/Sperre/Löschung werden erkennbar. |
| API-Ausnahmen und Promise-Ablehnungen | Geschlossene Ablehnung; keine unbehandelte Promise-Ablehnung, auch bei spätem Fehler nach Callback oder Timeout. |
| Deadline in allen Phasen | Ablauf bei Resolver, erster Kontolesung, Passwortcallback und zweiter Kontolesung verweigert die Anmeldung. Späte Ergebnisse starten keine nächste Prüfung. |
| Gemeinsames Budget | Teilverzögerungen summieren sich zum einen Budget; keine neue volle Frist pro Phase. |

## Bindung an den geprüften Modulstand

| Datei | SHA-256 |
| --- | --- |
| `src-ts/runtime-executables/lib/iobroker-user-auth.ts` | `3827705f612e5ac64d20bb3eac0a8d4a9fabec6a4f165e5db38d16164fe5d3ca` |
| `tsconfig.iobroker-user-auth.json` | `20072c772a99c3cdf0d5cf79bbe6d01acc3ff44c615ae70ffd6354baf84aa2e1` |
| `scripts/verify-iobroker-user-auth.cjs` | `69e0a6f556b08642707fd3e876717eb64c36d5c8a905a0730a73f71a15a0aafb` |
| `iobroker-user-auth.log` | `6dc2c6d9ff052fb249167ceed83d5219f749d8b79477113bca57245123e9704e` |

Eine erneute Änderung dieser Dateien verlangt passende Nachprüfung und
Aktualisierung der Bindung. Der Vermerk ersetzt keine Integritätsprüfung des
vollständigen ausgelieferten Pakets.

## Primärquellen und Kompatibilitätsgrenzen

Die externe API-Gegenprüfung erfolgte am offiziellen js-controller-Stand
**v7.2.5**; die konkrete installierte Controller-Version der Nutzeranlage ist
nicht aus dem Fehlerbild ableitbar.

- [Adapter-API: checkPassword und getUserID](https://github.com/ioBroker/ioBroker.js-controller/blob/v7.2.5/packages/adapter/src/lib/adapter/adapter.ts#L2086): Boolean-Ergebnis plus kanonische Konto-ID im Callback; öffentliche `getUserID`-Namensauflösung; Vorrang von `common.name`, danach historischer ID-Fallback.
- [Offizielle Zeichenregel FORBIDDEN_CHARS](https://github.com/ioBroker/ioBroker.js-controller/blob/v7.2.5/packages/common-db/src/lib/common/tools.ts#L182): Grundlage des Fallbacks; sofern verfügbar wird die öffentliche Adapterkonstante verwendet.
- [Controller-Passwortprüfung](https://github.com/ioBroker/ioBroker.js-controller/blob/v7.2.5/packages/common-db/src/lib/common/password.ts): Passwortprüfung bleibt beim Controller. Ein automatischer Hashwechsel während der Prüfung wurde in diesem Stand nicht festgestellt; die synthetische Hashwechselprobe dient der Race-Regression.
- [Controller-Änderungsverlauf](https://github.com/ioBroker/ioBroker.js-controller/blob/master/CHANGELOG.md): `getUserID` seit 3.2.16, lokalisierte Anzeigenamen seit 7.0.7. Das Modul lässt die Namensauflösung beim Controller und bildet dessen Sprachwahl nicht selbst nach.

## Offener Praxistest und Übergabe

Vor dem Update Konfiguration sichern und den vorherigen Lieferstand für einen
Rückfall bereithalten. Auf der betroffenen Installation Controller-/Admin-/UI-
Version und den tatsächlich verwendeten Benutzernamen festhalten, ohne Passwort
oder Passwort-Hash weiterzugeben.

1. Als vorhandener Installer/Admin mit korrektem Passwort anmelden. Kurze ID,
   tatsächlichen Anzeigenamen und vollständige `system.user.…`-ID prüfen.
2. EMS-Zugriff, erneutes Laden und Abmelden prüfen. Nach Abmeldung muss der
   geschützte Bereich erneut gesperrt sein; falsches Passwort bleibt abgewiesen.
3. Mit einem Kundenkonto sicherstellen, dass keine Installer-/Adminrechte
   entstehen, auch wenn sein Anzeigename einer privilegierten Kurz-ID entspricht.
4. Falls weiter „Benutzer oder Passwort falsch“ erscheint, Kontostatus,
   tatsächliche Konto-ID und Controller-Passwortprüfung gezielt prüfen. Die
   reproduzierte Namensinkompatibilität beweist nicht allein die Nutzerursache.

Noch nicht ausgeführt: echter Admin-8-/js-controller-Integrationstest, Browser-
und Hausanlagentest. Dieser Vermerk bestätigt die genannten Modulprüfungen und
keine allgemeine Produktivfreigabe, unabhängige Sicherheitszertifizierung oder
vollständige Normerfüllung. Verantwortlich für Gesamtpaketprüfung und nächsten
Praxistest bleiben die jeweilige Releasebearbeitung und der Anlagenbetreiber.
