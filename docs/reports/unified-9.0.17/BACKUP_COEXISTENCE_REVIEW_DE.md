# Standard-Backitup und integrierte EOS-Sicherung: Abgrenzung und Wiederherstellung

Stand: 24.11.2026. Ausgangspunkt: ausgelieferter Quellstand 9.0.16; Regressionen und Nachweis für 9.0.17. Dieser Bericht beschreibt eine Codeprüfung und lokale Softwaretests, keinen Test auf der Kundenanlage.

## Anlass und Sollverhalten

Nach Installation von EOS meldet der Betreiber fehlende Icons im Standard-ioBroker-Admin und eine nicht nutzbare Backitup-Oberfläche, auch nach Entfernen von EOS. Im Screenshot läuft `backitup.0`; daraus lässt sich weder der Erfolg eines Sicherungsauftrags noch die Fehlerursache der Oberfläche ableiten.

Standard-Admin und Standard-Backitup müssen parallel weiterarbeiten. Ihre Einstellungen, Aktivierung, gespeicherten Sicherungen und Historie dürfen durch EOS-Start, Update oder Migration nicht überschrieben werden.

## Befund und Abgrenzung

| Bereich | Geprüfter Befund im Ausgangsstand | Bedeutung |
| --- | --- | --- |
| Automatische Bestandsübernahme | `src/lib/eosLegacyMigration.js` kennt für Sicherungen ausschließlich `nexowatt-backup`; Instanznamen werden exakt geprüft. | `backitup.0` ist keine EOS-Migrationsquelle. |
| Modulhost | `src/lib/eosModuleHost.js` verwendet ebenfalls `nexowatt-backup`. `src/lib/web.ts` legt den Modul-Datenordner unter dem eigenen Instanzordner an. | Die eigene Sicherung arbeitet unter `eos-admin.N/modules/backup`; übernommene NexoWatt-Datenpunkte können ihre bisherige Namensbasis behalten. |
| Standardarchive | `modules/backup/src/legacy.ts` liest `/opt/iobroker/backups` beziehungsweise den entsprechenden Installationspfad. Import erzeugt eine verschlüsselte Kopie im EOS-Archivordner und prüft sie. | Der Import entfernt oder ersetzt das Original nicht. |
| Verzeichnisse und Aufräumen | `modules/backup/src/index.ts` räumt eigene Arbeitsordner und eigene Archive auf. `files.ts` erzeugt private Verzeichnisse und prüft deren Rechte. | Kein pauschales Umsetzen von Rechten oder Aufräumen im Standard-Backitup-Verzeichnis gefunden. |
| Fremde Objekt-ACLs | In 9.0.16 schreibt `src/main.ts` über `ensureLegacyBackupVisibleOnlyToAdmins` restriktive ACLs auf `system.adapter.backitup` und dessen Instanzen. | Dies ist ein konkreter, persistenter Eingriff außerhalb des Backup-Moduls. Er gehört zur Korrektur der gemeinsamen Administration. |
| Browseranmeldung | Gemeinsame Cookie-Namen werden in der separaten Authentifizierungsprüfung bearbeitet. | Browserzustand kann einen Oberflächenausfall auch nach Entfernen des Adapters erklären. Das ist separat von einer fehlgeschlagenen Sicherung zu prüfen. |

Im eigentlichen Backup-Modul ergab diese Prüfung keinen Anlass für eine Funktionsänderung. Es wird keine zusätzliche Migration von Standard-Backitup eingeführt.

## Ausgeführte Regressionen

Umgebung: Linux, Node.js 24.22.3, lokale Objekt-/State-Fixtures; keine Verbindung zur Anlage.

```sh
node --test --test-reporter=tap test/eos-module-legacy-migration.test.cjs test/eos-module-import-recovery.test.cjs test/eos-module-host.test.cjs
```

Ergebnis: **66 bestanden, 0 fehlgeschlagen, 0 übersprungen**. Rohbeleg: `backup-coexistence-migration.tap` im selben Berichtsordner.

Zwei ergänzte Regressionen prüfen das beauftragte Parallelverhalten:

1. Aktive und deaktivierte Standard-Backitup-Instanzen allein lösen keine EOS-Migration und keine Objektänderung aus. Konfiguration und Aktivierungszustand bleiben gleich.
2. Bei einer tatsächlichen Übernahme eines alten NexoWatt-Devices-Adapters bleiben Standard-Backitup-Konfiguration, ACL, Historienobjekt, Historienwert und Alive-State unverändert. Es entsteht kein EOS-Backup-Ziel aus Standard-Backitup.

Zusätzlich wurden die vorhandenen Worker-, Datei- und Lebenszyklustests ausgeführt:

```sh
node --test --test-reporter=tap modules/backup/test/hosted.test.cjs modules/backup/test/files.test.cjs modules/backup/test/lifecycle.test.cjs
```

Ergebnis: **24 bestanden, 0 fehlgeschlagen, 0 übersprungen**. Rohbeleg: `backup-coexistence-worker.tap` im selben Berichtsordner. Dieser Lauf verwendet echte lokale Kindprozesse und temporäre Dateien, aber ein Controller-Testprogramm statt einer realen ioBroker-Installation. Geprüft wurden insbesondere:

- Sicherung mit eigenem Arbeitsordner, verschlüsselte Archivdateien und EOS-Profil;
- Import eines bestehenden Standardarchivs mit byteweise unverändertem Original;
- Erhalt vorhandener Zieldateien bei doppeltem Schreiben, Fehlern und unzulässigen Pfaden;
- Ausschluss rekursiver Einbeziehung von Archiven über fremde `dataFolder`-Pfade;
- geordnetes Stoppen von Timern und Kindprozessen sowie Widerruf der Betriebsfreigabe;
- unveränderte unbekannte Kundeneinstellungen bei der eigenen NexoWatt-Backup-Migration.

Der letzte Punkt betrifft `nexowatt-backup`; er erweitert die Migrationsquellen nicht um Standard-Backitup. Browser-Cookie-Koexistenz und globale ACL-Korrektur haben eigene Regressionen im Hauptnachweis der Version.

## Schonende Diagnose und Wiederherstellung auf der Anlage

1. Den Standard-Admin über seine eigene Adresse zunächst in einem neuen privaten Browserfenster öffnen und dort neu anmelden. Icons, Backitup-Eintrag und dessen Konfiguration prüfen. Damit wird alter Browser-Sitzungszustand vom Serverzustand getrennt; gespeicherte Anlagenkonfigurationen werden nicht verändert.
2. Wenn es dort funktioniert, den Befund als Sitzungs-/Browserproblem behandeln. Kein Rückspielen eines alten Anlagenbackups und kein Neuinitialisieren von Backitup zur Behebung von Cookies vornehmen. Eine erneute Anmeldung nach dem korrigierten EOS-Update ist vorgesehen.
3. Wenn auch die frische Anmeldung scheitert, HTTP-Fehler und Backitup-Protokoll getrennt prüfen. Ein fehlendes Icon ist kein Nachweis gelöschter Sicherungen. Nur bereinigte Fehlercodes/Logs weitergeben; keine vollständigen `native`-Konfigurationen mit Zugangsdaten veröffentlichen.
4. Vor serverseitiger ACL-Reparatur einen geschützten Vorher-Snapshot anlegen. Nur nachweislich von EOS verwaltete ACLs mit gültig gespeichertem Vorher-Wert und unverändertem EOS-Istwert gezielt zurücknehmen. Geänderte ACLs, fehlende Sicherungsmetadaten oder unlesbare Werte bleiben unverändert und werden zur Prüfung gemeldet. Kein pauschales Rechte-Reset.
5. Nach wiederhergestelltem Zugriff den vorhandenen Sicherungsplan, Ziele und Aufbewahrung kontrollieren. Einen bewusst ausgelösten Standard-Backitup-Testauftrag anhand seines eigenen Ergebnisses beurteilen; vorhandene Archive erhalten. Das reine Öffnen der Oberfläche ersetzt diesen Nachweis nicht.

Die konkrete ACL-Reparatur und Cookie-Isolation werden im Hauptnachweis dieser Version geführt. Dieser Bericht autorisiert keine Rücksetzung oder Wiederherstellung auf der Kundenanlage.

## Diagnose ohne installierten EOS-Adapter

`tools/eos-coexistence-recovery.cjs` ist ein eigenständiges Node.js-Werkzeug ohne Zusatzpakete. Es lässt sich aus dem entpackten Repository starten; der EOS-Adapter muss dafür weder installiert sein noch laufen. Die vorhandene ioBroker-Installation mit ihrem Controller wird ausschließlich über fest vorgegebene `object get`-Abfragen gelesen.

```sh
node tools/eos-coexistence-recovery.cjs --check --iobroker-dir /opt/iobroker
```

Optional schreibt `--output /absoluter/neuer/pfad/eos-diagnose.json` zusätzlich einen neuen Bericht mit privaten Dateirechten. Vorhandene Dateien werden nicht überschrieben. Standardmäßig werden Admin und Backitup einschließlich Instanz 0 sowie wenige betroffene Systemobjekte geprüft. Bekannte weitere Instanzen können beispielsweise mit `--object system.adapter.backitup.2` ergänzt werden; ein vollständiges Instanzinventar wird nicht behauptet.

Der Bericht enthält keine vollständigen Adapterkonfigurationen, Passwörter, Lizenzcodes oder Tokens. Nur bei gültiger gespeicherter Vorher-ACL und exakt passender historischer EOS-ACL erscheint `REVIEW_PRIOR_ACL_RESTORE` mit einem bedingten Prüfvorschlag. Das ist noch keine Reparaturfreigabe: Getrennte Eigenschaftsabfragen bilden keinen atomaren Objekt-Snapshot. Andere Gruppen, zwischenzeitliche Änderungen, fehlende Vorher-Werte und beschädigte Metadaten führen ausschließlich zu einem Hinweis. Der Bericht ist auch kein vollständiger Vorher-Snapshot für spätere Änderungen.

`administratorFilePermissions` zeigt nur bekannte boolesche Dateirechte. `REVIEW_FILE_CAPABILITIES_NO_PREIMAGE` bedeutet, dass ausgeschaltete Rechte gefunden wurden und ihre Berechtigung geprüft werden muss. Ohne gesicherten ursprünglichen Gruppenstand wird daraus kein neues Rechteprofil erzeugt.

Ein `--apply`-Modus wird bewusst nicht angeboten. Die geprüfte Controller-CLI liest bei Eigenschaftsänderungen das Objekt und schreibt es anschließend zurück, ohne eine atomare Vergleichsbedingung. Ein automatischer Reparaturbefehl könnte deshalb zeitgleiche Administratoränderungen überschreiben. Das Werkzeug lehnt `--apply` vor jedem Controller-Aufruf ab. Normale EOS-Starts rufen das Werkzeug nicht auf und ändern dadurch keine Fremdobjekte.

Offizielle Quellprüfung vom 24.11.2026:

- [js-controller 7.2.5: Objekt-CLI](https://github.com/ioBroker/ioBroker.js-controller/blob/v7.2.5/packages/cli/src/lib/cli/cliObjects.ts), Blob `bd3fcdfcf2fc09378e844c70222761ca411d40e9`: `get` unterstützt eine einzelne Eigenschaft; `set` besitzt im geprüften Ablauf keine Vergleichsbedingung.
- [js-controller 7.2.5: Ausgabeformat](https://github.com/ioBroker/ioBroker.js-controller/blob/v7.2.5/packages/cli/src/lib/cli/cliTools.ts): Objekte werden als JSON, gespeicherte JSON-Zeichenketten unverändert ausgegeben.

Eigene Werkzeugprüfung:

```sh
node --test --test-reporter=tap test/eos-coexistence-recovery.test.cjs
./node_modules/.bin/eslint -c eslint.unified.config.mjs tools/eos-coexistence-recovery.cjs test/eos-coexistence-recovery.test.cjs
```

**11 Tests bestanden, 0 fehlgeschlagen; Lint bestanden.** Rohbelege: `coexistence-recovery.tap` und `coexistence-recovery-lint.log`. Der Test führt die eigenständige CLI mit einem echten lokalen Kindprozess und einem kontrollierten Controller-Testprogramm aus; er bestätigt ausschließlich lesende Argumente, unveränderte Fixture-Konfiguration, private Berichtsausgabe, Ablehnung von `--apply`, fehlenden/ungültigen Vorher-Daten und veränderten Ist-ACLs. Die echte Anlagen-Datenbank wurde nicht geöffnet.

## Offene Praxisprüfung

Die Anlage muss noch bestätigen: Standard-Admin vor und nach EOS-Anmeldung erreichbar, Icons sichtbar, Backitup-Konfiguration lesbar, bestehende Sicherungsziele und Zeitpläne unverändert sowie erfolgreicher bewusst gestarteter Sicherungsauftrag. Keine allgemeine Produktionsfreigabe oder CRA-Konformität wird aus diesen lokalen Tests abgeleitet.
