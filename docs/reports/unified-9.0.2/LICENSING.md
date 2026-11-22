# Lizenzimport und Wiederherstellung – Prüfvermerk 9.0.2

Stand: 22.11.2026. Prüfung unter Linux, Node.js v24.22.3; lokaler Softwaretest,
keine Abnahme auf der Hausanlage und keine Konformitätsbescheinigung.

## Änderung und Vertrauensgrenze

`src/lib/eosLicenseTrust.js` autorisiert öffentliche Ed25519-Schlüssel unabhängig
vom hochgeladenen Inhalt. Zulässig sind exakt passende Aussteller-ID und
SHA-256 über kanonisches SPKI-DER aus freigegebenen Release-Metadaten oder dem
aktuell gültigen, weiterhin nur gelesenen OS-Trust. Die Release-Metadaten allein
aktivieren weder Trust noch eine Lizenz. Ohne OS-Trust ist zunächst ein bewusster
Administratorimport erforderlich; anschließend bleibt die signierte, zur
System-UUID passende Lizenz notwendig.

Der vom Hersteller bereitgestellte öffentliche Schlüssel ist freigegeben:

- Aussteller: `nexowattEOS-3cb665e3fc6f4085a04b8db3e692cac5`
- SHA-256 SPKI-DER: `a485fd6e28195a0a0e458b304e95025c0bd516d97f3cb1443beb78ed9cfe4856`

Default-OS-Trust und bewusst importierte Release-Schlüssel sind unabhängige
Autoritäten. Ein explizites `NEXOWATT_LICENSE_TRUST_FILE` begrenzt dagegen die
gesamte zulässige Menge auf genau diesen OS-Trust. Ein ungültiger vorhandener
OS-Trust oder dieselbe Aussteller-ID mit anderem Schlüssel sperrt die Prüfung.
Lokale Kopien heben diese Sperre nicht auf. Entfernte OS-only-Schlüssel werden
nicht aus dem Cache weiter akzeptiert. Ein Release-Schlüssel wird durch Entfernung
seines Release-Pins oder eine einschränkende OS-Override-Policy entzogen; bloßes
Löschen der Default-OS-Datei entzieht einen Release-Pin nicht.

Importierte öffentliche Schlüssel liegen atomar im privaten Instanzspeicher
`licensing/imported-public-keys.json`. Import und effektiver Trust sind auf
32 Schlüssel und 32 KiB begrenzt; der reine Zulassungskatalog darf bis zu
64 Einträge enthalten, damit 32 bestehende OS-Schlüssel neben unbenutzten
Release-Pins weiter funktionieren. Jede Lizenzprüfung autorisiert die lokale
Datei erneut gegen die aktuelle OS- und Release-Policy. Unbekannte, kollidierende,
private oder ungültige Uploads ersetzen keine gültige Konfiguration.

Der Service bietet `trustStatus()`, `importTrust(keys)`, `recheckTrust()` und
`exportTrust()`. Statusantworten enthalten ausschließlich öffentliche IDs,
Fingerprints, Quellen und Diagnosecodes. Der gesonderte Export enthält nur den
effektiven öffentlichen Prüfschlüsselsatz. Fehlerhafte Speicherinitialisierung
darf keine alte READY-Antwort oder veralteten Export liefern. Recheck und Import
setzen weder die Uhrfehlersperre noch den Zeit-Höchststand zurück und starten
keinen zweiten Timer. NWL2/NWL3-Prüfung und verschlüsselte Lizenz bleiben erhalten.

Die neue Core-Speicheroption wird gesondert geprüft: begrenzte Runtime-Verzeichnisse
dürfen Rechte der Dienst-UID und primären Dienst-GID unterstützen; private
Lizenzdateien und der letzte Verzeichnisknoten bleiben geschützt. Keine
Rechteänderung am Host und kein Root-Aufruf aus der Webanwendung. Der offizielle
[ioBroker-Installer](https://github.com/ioBroker/ioBroker/blob/master/installer_library.sh)
setzt in `fix_dir_permissions` selbst Gruppen-ACLs im Installationsverzeichnis;
Quellenabgleich am 22.11.2026.

## Tatsächlich ausgeführte Prüfungen

| Befehl / Umfang | Ergebnis | Beleg |
| --- | --- | --- |
| `node --test --test-reporter=tap test/eos-license*.test.cjs` | 143 Tests: 141 bestanden, 0 Fehler, 2 übersprungen | `licensing-tests.tap` |
| Derselbe echte HTTPS-Test mit `NEXOWATT_KEYGEN_SOURCE` auf den geprüften Original-Keygen 1.0.4 | 5 bestanden, 0 Fehler, 0 übersprungen; der zuvor fehlende Keygen-Pfad ist damit aufgelöst | `licensing-https-keygen.tap` |
| `npx tsc --noEmit --pretty false` | Exit 0; neues Trust-Modul zusätzlich mit `// @ts-check` und JSDoc typisiert | `licensing-typecheck.log` |
| ESLint über `eosLicenseService.js` und `eosLicenseTrust.js` | Exit 0, keine Codewarnungen/-fehler | `licensing-eslint.log` |
| `node --check` über beide Backenddateien und die neuen Importtests | Exit 0 | Ausgeführter Syntaxcheck |

Die neuen 14 Importtests prüfen unter anderem fehlenden Trust ohne automatische
Aktivierung, kanonischen Import, Neustart, ungültige und unbekannte Uploads,
OS-Override, Widerruf, Entzug des letzten Pins, 32 bestehende OS-Schlüssel,
Schreibfehler, bestehende Lizenz bei Fehlerimport, Uhrfehlersperre sowie
sofortige Cache-Sperre bei beobachteten Autoritätsfehlern. Der echte HTTPS-Test
verwendet den Original-Keygen mit ausschließlich temporären Testausstellern und
prüft Import, Aktivierung und Neustart im dienstbenutzereigenen Runtime-Verzeichnis
mit `2775`. Private Testschlüssel sind nicht als Konstanten oder Ausgaben abgelegt.

Die allgemeine Projekt-TypeScript-Konfiguration prüft nicht pauschal sämtlichen
historischen JavaScript-Code mit `checkJs`; daraus wird keine vollständige
Typprüfung der gesamten Altcodebasis abgeleitet. npm meldet in den Prüfprotokollen
eine Host-Konfigurationswarnung zu `http-proxy`, keinen Codefehler.

## Grenzen und Wiederherstellung

Der verbleibende übersprungene ACL-Test benötigt `setfacl`, das in dieser
Prüfumgebung fehlt. Die echten POSIX-Modus-/UID-/GID-Prüfungen sind davon getrennt;
eine Prüfung vererbter Installer-ACLs auf dem Zielsystem bleibt offen.

Die Wiederherstellung ist bewusst nicht destruktiv. Eine beschädigte oder unsicher
berechtigte lokale Trust-Datei, ein beschädigter verschlüsselter Lizenzspeicher
oder eine lokale Kopie inzwischen entzogener OS-only-Schlüssel wird nicht still
gelöscht oder überschrieben. In diesen Fällen sind Diagnose und gezielte
Wiederherstellung erforderlich; Recheck prüft anschließend erneut. Der Import
erzeugt keinen Ersatz für einen verlorenen `storage.key` und verändert keine
Geräte-UUID. Für einen zusätzlichen Cache-Reset besteht in diesem Stand keine
Webaktion. Physische Gerätefunktionen wurden durch diese Tests nicht abgenommen.

## Eingefrorener Quellstand

| Datei | SHA-256 |
| --- | --- |
| `src/lib/eosLicenseService.js` | `952dbb84513ed8086f5ea43507c0b7e82dc7f17485f5ba48d58de6a556631387` |
| `src/lib/eosLicenseTrust.js` | `90ee3232373bec8f4f6ecac4539accb0a50b54a5b65fd977b5e4da7302e4da3a` |
| `test/eos-license-trust-import.test.cjs` | `016dfa0e997dcce62f5ec52f4e83ba41eeea2a33a9246b2fd03cfec985cbeb28` |

HTTP-Routen, Frontend, Core-Dateihärtung, Gesamtbuild und Paketfreigabe werden in
den zugehörigen weiteren 9.0.2-Nachweisen behandelt. Eine Produktions- oder
CRA-Konformitätsfreigabe wird mit diesem Prüfvermerk nicht erklärt.
