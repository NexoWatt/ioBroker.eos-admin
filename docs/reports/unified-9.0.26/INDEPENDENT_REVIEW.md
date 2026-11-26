# EOS 9.0.26 – unabhängige Prüfung der Korrekturen

**Erster Prüfsnapshot:** 25.11.2026, 20:51:39 CET. **Laufzeit:** Node.js v24.22.3, isolierte x86_64-Testumgebung. Der Review wurde unabhängig von den Implementierungsaufgaben durchgeführt. Der erste Review erfolgte ohne Produktänderungen. Für die spätere Git-Vollprüfung wurde ausdrücklich die unten beschriebene minimale Ergänzung von Ignore-Regeln und Regressionstest autorisiert; die fachliche Laufzeit blieb unverändert.

## Ergebnis und behobener Befund

Im unten mit SHA-256 festgehaltenen Änderungsstand wurde kein offener Blocker im zunächst geprüften Umfang gefunden. Die anschließende Prüfung des ZIP→Git-Veröffentlichungswegs fand eine weitere Ursache und bestätigte deren Korrektur; siehe Ergänzung unten. Das ist eine zeitpunktbezogene Code- und Testbewertung, keine Freigabe des später gepackten npm-Artefakts oder der Kundenanlage.

Der Review reproduzierte einen zusätzlichen Fehler: Ein initialer `MODULE_NOT_FOUND` beim Laden einer Modulkonfiguration blieb trotz anschließend reparierter Ursache dauerhaft gespeichert; explizites Aktivieren konnte das Modul nicht wieder starten. Die Korrektur lädt die Konfiguration ausschließlich bei ausdrücklichem Aktivieren/Starten erneut. Normale Statusabfragen führen keine Wiederholungen aus. Die Regressionstests prüfen die Wiederherstellung nach einer tatsächlich fehlenden und anschließend bereitgestellten Moduldatei.

Geprüfte Eigenschaften:

- Die kombinierte Aktivierung hält die Prozessfreigabe bis zum bestätigten Stop und vollständigen Konfigurationscommit gesperrt. Gespeicherte Einstellungen und Geheimnisse bleiben erhalten. Ein unbestätigter Stop erlaubt keinen Ersatzprozess.
- Fehlende Konfiguration erhält die neuen Aktivierungsdefaults; ausdrücklich gespeichertes `false` bleibt erhalten. Beim neuen Backup-Modul wird dadurch kein Sicherungszeitplan eingeschaltet.
- Lizenz- und Zuständigkeitsprüfungen bleiben vor dem Prozessstart wirksam. Ein laufender externer OCPP-Adapter wird weder übernommen noch durch einen zweiten integrierten Gerätecontroller ergänzt. Vor dem Wiederanlauf empfangene Stellbefehle werden nicht nachgesendet.
- Dauerhafte Importfehler lösen keine automatische Neustartschleife aus. Irrelevante externe Statusereignisse erhöhen die Generation eines ausgeschalteten OCPP-Moduls nicht.
- Öffentliche HTTPS-Einrichtung und Zertifikatsdownload verwenden feste, lesende Routen mit Origin-Prüfung. `publicRoot()` liefert ausschließlich das öffentliche Stammzertifikat als DER aus der validierten Identität. Private Schlüssel, CSR und Verwaltungsdaten werden darüber nicht bereitgestellt. Die Verwaltungsrouten bleiben geschützt; die Einrichtungsseite verwendet eine restriktive CSP und verlangt den unabhängigen Abgleich des Fingerabdrucks.
- Die festen iOS-Iconpfade liegen im Administrationsprozess und hängen nicht vom laufenden UI-Prozess ab. Das vorhandene Logo wird nicht verändert.

## Eigener Testnachweis

Die gezielten Tests wurden für diesen Bericht erneut mit Rohprotokoll aufgezeichnet. Alle **28 Tests bestanden**, keine fehlgeschlagen, abgebrochen oder übersprungen. Die SHA-256-Werte der erfassten Quellen waren vor und nach dem Lauf identisch.

| Rohprotokoll | Tests | Bestanden | Fehler | Übersprungen |
| --- | ---: | ---: | ---: | ---: |
| [runtime-lifecycle-import-node24.log](raw/independent-review/runtime-lifecycle-import-node24.log) | 27 | 27 | 0 | 0 |
| [public-trust-node24.log](raw/independent-review/public-trust-node24.log) | 1 | 1 | 0 | 0 |

Die 28 Fälle umfassen 14 Runtime-Control-Tests, 11 Startup-/Recovery-Tests, 2 Importdiagnosetests und 1 HTTPS-Vertrauenssetup-Test. Prozessfälle verwenden echte Node-Unterprozesse mit isolierten Testmodulen; die Controller-Datenbank ist eine Testimplementierung. Der HTTPS-Test verwendet einen tatsächlichen TLS-Listener und eine isolierte Test-CA.

Befehle, Zeitstempel sowie Quell- und Protokollhashes stehen im [maschinenlesbaren Nachweis](raw/independent-review/INDEX.json).

## Ergänzung: ZIP→Git verliert drei Modullaufzeiten

**Zusätzlicher Prüfsnapshot:** 25.11.2026, 21:00:19 CET. Der weitere Befund betrifft den ausdrücklich gewünschten Arbeitsweg „ZIP in den Git-Ordner kopieren, hochladen und aus dem Repository installieren“.

Die Regel `**/build` in der bisherigen `.gitignore` schloss sämtliche kompilierten Moduldateien aus. Die Ausnahme `!/build/` galt nur für das Hauptverzeichnis. Bei normalen, noch nicht verfolgten Dateien in `modules/eebus/build`, `modules/backup/build` und `modules/ocpp/build` nahm `git add .` deshalb die benötigten Laufzeiten nicht auf. Die drei vorhandenen `index.js`-Dateien verweisen jeweils auf `./build/index.js`; im daraus erstellten Git-Archiv fehlt dieses Ziel. Die Geräteintegration benötigt diesen kompilierten Einstieg nicht.

Die Korrektur enthält genau die drei benötigten Modulverzeichnisse samt Inhalt ausdrücklich wieder. Andere Buildverzeichnisse und `node_modules` bleiben ausgeschlossen. Der Reviewer änderte keine Produktdatei.

Unabhängige Prüfung mit denselben 47 realen Builddateien und ausschließlich unterschiedlicher Ignore-Regel, jeweils `git init`, `git add .`, `git write-tree`, `git archive`:

| Git-Regel | Builddateien im Archiv | Bytegleich zum Ausgangsstand | Fehlende Moduleinstiege |
| --- | ---: | ---: | --- |
| 9.0.25 | 0/47 | 0/47 | EEBus, Sicherung, OCPP |
| 9.0.26 | 47/47 | 47/47 | Keine |

Der Reviewer prüfte außerdem die tatsächlich ausgelieferten 9.0.25-Archive: Sowohl das vollständige ZIP als auch das npm-TGZ enthalten alle 47 Builddateien bytegleich zum versiegelten 9.0.25-Quellstand. Der nachgewiesene Verlust erfolgt beim Git-Staging, nicht bereits im ursprünglichen Download. Damit ist auch erklärt, warum allein ein Test des vollständigen npm-TGZ diesen Fehler nicht sichtbar machte. Der Befund behauptet nicht, dass ein unvollständiger Git-Stand die vorhandenen npm-Releaseprüfungen erfolgreich passieren kann.

Nachweise:

- [Unabhängiger Git-Vorher-/Nachher-Vergleich](raw/independent-review/git-transport-independent.json).
- [Unabhängiger ZIP-/TGZ-Abgleich einschließlich Artefakthashes](raw/independent-review/baseline925-artifacts-independent.json).
- [Neuer Git-Regressionstest: eigener Node-24-Lauf](raw/independent-review/git-runtime-node24.log), **1/1 bestanden**. Zusammen mit dem ersten Prüflauf sind es **29 bestandene unabhängige Tests**.
- [Ergänzungsindex mit Protokollhashes](raw/independent-review/GIT_ADDENDUM.json).
- Ergänzend geprüft: [Vollständiger 9.0.25-Gitexport und tatsächliche Importversuche des Implementierungsprüfers](installed-package/baseline925-git-export.json). Ergebnis: Geräte laden; die anderen drei Module melden jeweils `Cannot find module './build/index.js'`.

| Ergänzend geprüfte Datei | SHA-256 |
| --- | --- |
| `.gitignore` | `285c0803c6c7c23a459fa3e772caa9570fb1e4c854a1b80d1c73b886f598dab2` |
| `test/eos-unified-git-runtime.test.cjs` | `6f628893563702bf829642d86ed854ce018d03b1fe348f9fe13b04118a85d016` |

## Abschließende Git-Inventarprüfung und SD-Karten-Sicherung

**Prüfsnapshot:** 25.11.2026, 21:04:07 CET. Die Prüfung wurde auf das tatsächliche npm-Dateiinventar erweitert: **3251 Dateien gegen alle anwendbaren Git-Ignore-Regeln**, einschließlich verschachtelter Regeln.

Dabei wurde noch eine echte Laufzeitabhängigkeit gefunden: `modules/backup/upstream/build/lib/sdCard.js`. Sie wird von `modules/backup/build/preflight.js`, `storage.js` und `worker.js` für SD-Karten-Prüfung, Speicherziel und Erkennung geladen. Die allgemeine `**/build`-Regel schloss auch diese Datei weiterhin aus. Nach ausdrücklicher Autorisierung ergänzte der Reviewer genau die Ausnahme für `modules/backup/upstream/build/` samt Inhalt und erweiterte den vorhandenen Git-Regressionstest. Weitere Produktdateien wurden dabei nicht geändert.

Der endgültige gezielte Test prüft nun **48 Modul-Builddateien**, den gewöhnlichen Git-Staging-/Archivweg sowie den tatsächlichen Import des daraus exportierten SD-Kartentreibers. Er ruft ausschließlich dessen Parser mit einer leeren Testinventarliste auf; kein physisches Laufwerk wird angesprochen. Der Test bestand auf **Node 22.23.4 und 24.22.3**. Es handelt sich um die erweiterte Fassung des bereits gezählten Git-Testfalls, nicht um zusätzlich hochgezählte Wiederholungen.

Ergebnis des vollständigen Inventarabgleichs nach der Korrektur: **0 von 3251 geprüften npm-Dateien werden von Git ignoriert.** Dieser Inventarnachweis wurde mit `npm pack --dry-run --ignore-scripts --json` gewonnen; er ist ausschließlich eine Dateilistenprüfung und ersetzt ausdrücklich weder die normalen Release-Hooks noch die finale Paketprüfung.

`ui/build-ts/`, `ui/build-types/` und `ui/build/` sind im geprüften Lieferstand nicht vorhanden. Produktive UI-Laufzeitdateien unter `ui/main.js`, `ui/lib`, `ui/ems` und `ui/www` referenzieren `build-ts` nicht; die Treffer stammen aus temporären Build-/Testspiegel-Skripten. `ui/.npmignore` schließt `build-ts/` ebenfalls aus. Der noch vorhandene Eintrag `ui/build-ts/` in `package.json.files` ist deshalb ein nicht genutzter deklarierter Pfad; er wurde in dieser Reparatur nicht entfernt. `ui/.gitignore` blieb unverändert, und der Regressionstest bestätigt weiterhin den Ausschluss dieser temporären Verzeichnisse.

- [Vollständiger Git-/npm-Abgleich und finale Hashes](raw/independent-review/npm-git-complete-inventory.json).
- [Geprüftes npm-Dateiinventar](raw/independent-review/npm-dry-run-file-inventory.json).
- [Finaler Git-Test unter Node 24](raw/independent-review/git-runtime-complete-node24.log).
- [Finaler Git-Test unter Node 22](raw/independent-review/git-runtime-complete-node22.log).

| Datei im abschließenden Git-Prüfsnapshot | SHA-256 |
| --- | --- |
| `.gitignore` | `6f993ba77a953b96007fb1acdb9d342cefe376ab8b2732405d6ec46ec59745a2` |
| `ui/.gitignore` (unverändert) | `cb1adbee6b5ee7428f3f462b4c83515020d7f86572f2ec8581395ab0ee665fcd` |
| `test/eos-unified-git-runtime.test.cjs` | `4350ef244b91bd9ae6eb234cb5d1687aa30d1e00bfec2e18e653547cd4668fc9` |

## Grenzen

Dieser Review enthält keinen neuen Node-22-Gesamtlauf, keinen vollständigen ioBroker-Controllerlauf, keinen Test auf dem Raspberry Pi, keinen realen Wallbox-/EEBus-Test und keine Installation auf einem iPhone. Er belegt keine RAM-Einsparung auf der Anlage. Der Verlust der drei kompilierten Modullaufzeiten im ZIP→Git-Weg ist inzwischen reproduziert und korrigiert; die konkrete Installation auf der Kundenanlage wurde weiterhin nicht direkt untersucht. Ein erfolgreicher Test des vollständigen npm-Pakets allein hätte diesen Git-Verlust nicht erkannt. Zertifikatsvertrauen und passende IP-/Namenseinträge müssen auf der tatsächlichen Anlage und dem iPhone geprüft werden.

Die folgenden Hashes identifizieren ausschließlich diesen Review-Snapshot. Nachfolgende Änderungen erfordern eine erneute Zuordnung der betroffenen Nachweise; der endgültige Release-Hash entsteht separat.

## SHA-256 der geprüften Quellen und Tests

| Datei | SHA-256 |
| --- | --- |
| `src/lib/eosRuntimeControl.js` | `3f706fb02d3b705a37e157c70dabbc01c2882f40e51a2c3d57f5abff2c04d40c` |
| `src/lib/eosModuleHost.js` | `f620a88ebc047c85619ac4251bc5df9f52ee309262a066a2ffbbebee22ee86fe` |
| `src/lib/eosModuleHttp.js` | `abbd1c7fe2c82f97845007c1d7c299ee45c9eb692c97bb9a1890b72e2691147f` |
| `src/lib/eosModuleProcess.js` | `81eae62debc4b9083527a8b98da3c9a9b8b70a823e248cfaae0229d470e1fd0b` |
| `src/lib/eosModuleProcessProtocol.js` | `f7c866ef884985dcb205a8ea9ec2c14d8793453d46246bd15aab110c60bba196` |
| `src/lib/eosModuleProcessWorker.js` | `43c016ef620ef002a2f760f92fcb1f2d1c0fbf09592a01402b4ad97f4514075d` |
| `src/lib/eosModuleLoad.js` | `123812a80aa10f8b3372a50ec03007a54e244c3ad835bf3eb7daf889fc7da3dd` |
| `src/lib/eosRuntimeHealth.js` | `7b7724eacac3a7c913eb2ee40dceb37329f0d960ffc7b4c0728c85a55e35ab5d` |
| `public/eos-runtime/index.js` | `0034751485647b738a642e5e8205199f939ed10bfe95d0f913cc04bc71d893b2` |
| `src/lib/web.ts` | `6acb5c208b6d99726b20481ed01b818854dc071daec86ccad5fd978703dc38cc` |
| `src/lib/eosTlsHttp.ts` | `85fc7f48cba39536b3438e962cea2a789cb5f8c62ca95961326237cfe361deea` |
| `src/lib/eosTlsManager.ts` | `de6c27e746b3094532a16faa61c0fbe083ccca58d65840b2525faf55f4273038` |
| `public/eos-tls/trust.html` | `3221f32c7cb284fa019c787fee942fdb78f466acb9854fb7095cc970c1c75f3c` |
| `public/eos-tls/trust.css` | `6da8c9537ff339e8d88f423969d15f927d02fcd42389aa9e0de4269e352d6121` |
| `ui/www/login.html` | `122ba1db067792f71ddc95bc8af181ab15469e3a6179c4c01bf9ae54479335b3` |
| `test/eos-runtime-control.test.cjs` | `44167c45c53c9d2427539d5101781524e847b3836799a5df67f584fb699c0acf` |
| `test/eos-module-startup-retry.test.cjs` | `ee4dc1ed46d815ebe1354e6d7dde800eb383e6d5ada3ef3d933b6b475d2cd48d` |
| `test/eos-module-load-diagnostic.test.cjs` | `d6aa84a2518e39668aca1b9f48b11364b08399c826f19a10d6456b4164393c7a` |
| `test/eos-tls-management.test.cjs` | `b015627b0b08e20b819cf899733ca0601e2c4e494e0edbb93e9046f2797fba54` |
