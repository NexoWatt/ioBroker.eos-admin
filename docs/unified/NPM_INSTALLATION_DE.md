# npm-Installation und Skriptfreigaben

Prüfstand: 23.11.2026. Bezug: EOS 9.0.8; gemeldete Kundeninstallation mit npm 11.19.1.

`Process exited with code 0` bestätigt eine erfolgreiche Paketinstallation. Es
bestätigt weder alle Gerätefunktionen noch, dass jedes native Installationsskript
ausgeführt wurde. Die sichtbaren Hinweise haben unterschiedliche Ursachen.

## Veralteter Cron-Parser

EOS 9.0.7 bezog `cron-parser@4.9.0` über `node-schedule@2.1.1`. Auch der am
23.11.2026 abgefragte neueste `node-schedule@2.1.2` verlangte noch `^4.2.0`.
Deshalb wird nicht lediglich die Warnung ausgeblendet oder ein inkompatibler
Major-Override eingesetzt.

EOS 9.0.8 verwendet für seine zwei Backup-Zeitpläne einen kleinen typisierten
Timer mit dem direkt eingebundenen `cron-parser@5.10.6`. Die alte Parser-Version,
`node-schedule`, `long-timeout` und `sorted-array-functions` entfallen aus diesem
Abhängigkeitszweig. Die alte Upstream-Paketbeschreibung im Quellenarchiv bleibt
als Herkunftsnachweis unverändert; sie ist kein installierter Abhängigkeitsbaum.

Bestehende fünf-/sechsstellige Cron-Ausdrücke, lokale Systemzeitzone und die
bisherige Bedeutung von `EveryXDays` (Schrittweite im Kalendertagfeld, kein
rollierender Stundenabstand) bleiben erhalten. Ein Timer je Plan wird beim
Stoppen gelöscht. Nach einer langen Prozesspause oder einem Vorwärtssprung der
Uhr wird ein überfälliges Backup einmal ausgelöst; verpasste Termine werden
nicht als Auftragsflut nachgeholt. Aktive ungültige Cron-Pläne werden bereits
beim Vorprüfen der Konfiguration abgelehnt. Inaktive kundenspezifische Einstellungen
werden nicht gelöscht.

Nachweise: 63 Backup-Tests bestanden, einschließlich 11 neuer Kalender-/DST-,
Uhrsprung-, Fehler-, Abbruch- und Vorprüfungsfälle sowie eines automatischen
Backups mit echtem Timer und Kindprozess. Die Kalender-Sollwerte wurden vor
Entfernung des alten Parsers mit `cron-parser@4.9.0` bestimmt. Strikte
TypeScript-Prüfung und typinformiertes ESLint bestanden. `npm audit --omit=dev`
meldete für diesen Arbeitsstand 0 bekannte Befunde; dies ist kein vollständiger
Sicherheitsnachweis. Keine Prüfung an einer Kundenanlage erfolgte.

## Hinweise zu Installationsskripten

`allowScripts` gehört zum npm-Projekt, in dem ioBroker installiert ist, gewöhnlich
`/opt/iobroker/package.json`. Eine Freigabe im untergeordneten EOS-Adapter kann
die Hostentscheidung nicht ersetzen. EOS verändert diese übergeordnete Policy
nicht automatisch.

Die folgenden exakt gemeldeten Paketversionen wurden im isolierten
Controller-Testbaum gelesen; dies beweist nicht die Integrität der Dateien auf
dem Kundengerät:

| Paketversion | Ursprung und Skriptwirkung |
| --- | --- |
| `@serialport/bindings-cpp@12.0.1` | Direkte Serialport-12-Anbindung; vorhandenes natives Binary prüfen oder per node-gyp bauen. |
| `@serialport/bindings-cpp@13.0.0` | Optionale Serialport-13-Anbindung von modbus-serial; natives Binary prüfen oder bauen. |
| `cpu-features@0.0.10` | Optionale SSH-Abhängigkeit der Docker-Verwaltung; lokale Compiler-/CPU-Funktionsprüfung und Build. |
| `diskusage@1.2.0` | Controller-Datenbank-Peerabhängigkeit; nativer Build zur Dateisystembelegung. |
| `esbuild@0.11.23` | Im geprüften Baum Entwicklungstestwerkzeug von `@iobroker/testing`; lädt/installiert ein passendes Plattformbinary und prüft dessen Version. Kein EOS-Regelungsmodul. |
| `iobroker.js-controller@7.2.5` | npm-Versionsprüfung und `iobroker.js setup first`; kann Controller-Objekte und Installationsdateien einrichten. Kein pauschales erneutes Rebuild ausführen. |
| `protobufjs@7.6.6` | Versionsschema-Hinweis für Abhängigkeiten; das gelesene Postinstall-Skript führt keinen Download aus. |
| `ssh2@1.17.0` | Optionale native Crypto-Bindings für die Docker-Verwaltung bauen. |
| `unix-dgram@2.0.6` | Optionaler nativer Unix-Datagramm-Build für Controller-Syslog. |

`node-gyp` kann passende Node-Header benötigen. Das Prüfen dieser Einstiegsskripte
ist keine vollständige Quellcodeprüfung ihrer gesamten Compiler- und
Abhängigkeitskette. Native Module bleiben für die jeweilige Zielarchitektur zu prüfen.

Nach Prüfung genau dieses installierten Paketstands lässt sich die Entscheidung
versionsgenau im ioBroker-Projekt hinterlegen. Das folgende Kommando aktiviert
nur deren Freigabe für künftige Installations-/Rebuild-Vorgänge. Es startet weder
Installationsskripte noch den Adapter neu:

```sh
cd /opt/iobroker
npm install-scripts approve --allow-scripts-pin \
  '@serialport/bindings-cpp@13.0.0' \
  '@serialport/bindings-cpp@12.0.1' \
  'cpu-features@0.0.10' \
  'diskusage@1.2.0' \
  'esbuild@0.11.23' \
  'iobroker.js-controller@7.2.5' \
  'protobufjs@7.6.6' \
  'ssh2@1.17.0' \
  'unix-dgram@2.0.6'
npm install-scripts ls
```

Nur mit dem berechtigten ioBroker-Verwaltungskonto ausführen. Bei abweichenden
Versionen wird nicht blind auf einen Paketnamen ohne Versionsgrenze oder `--all`
ausgewichen. Eine spätere neue Version erfordert eine erneute Prüfung. Die
Skriptfreigabe macht ein altes Entwicklungswerkzeug nicht zu einer aktuellen
Bibliothek; esbuild 0.11.23 bleibt eine dokumentierte Einschränkung des
vorhandenen Testwerkzeugs. Ein geprüftes fertiges npm-Tarball benötigt die
EOS-Entwicklungsabhängigkeiten nicht zum Betrieb.

Die Kommandoform wurde mit npm 11.19.1 und den neun passenden Versionen im
isolierten Controller-Testbaum als `--dry-run --json` geprüft. Im npm-Quellcode
`lib/utils/allow-scripts-cmd.js` wurde nachvollzogen: `approve` schreibt die
Policy, führt keine Lifecycle-Skripte aus und unterstützt exakte Versionsargumente.
Bestehende gleichnamige pauschale Freigaben können dabei durch Versionsfreigaben
ersetzt werden. Ein `npm rebuild` aller Pakete oder eine automatische Freigabe
beliebiger weiterer Skripte ist nicht Teil dieser Änderung.

## Git-Integritätshinweis

`skipping integrity check for git dependency` betrifft den Installationsweg aus
Git. Ein Commit-Hash legt den Quellstand fest, ist aber kein npm-Tarball mit
Registry-Integritätsprüfung. Der Hinweis lässt sich nicht seriös durch Ändern
einer Versionsnummer im Adapter beheben. Für die Auslieferung das geprüfte
Release-Tarball mit passender SHA-256-Prüfsumme oder das zugehörige
Registry-Paket verwenden; die eigene Release-/Signaturprüfung bleibt erforderlich.

## Quellen

- [npm: install-scripts](https://docs.npmjs.com/cli/v11/commands/npm-install-scripts/)
- [cron-parser: offizielles Repository und API](https://github.com/harrisiirak/cron-parser)
- Registryabfragen am 23.11.2026: `npm view node-schedule@latest version dependencies time.modified --json`; `npm view cron-parser@latest version deprecated --json`; `npm view cron-parser@5.10.6 engines dependencies dist.integrity --json`.
- `cron-parser@5.10.6` Registry-Integrität: `sha512-kpoxgQyveO1l29nw+FWdvmotyV7eOSzGHQpxiXOEZIDOjqO1iR6kfgJ0PVHTuV26uBemKq3ppzma7dHFAG7viw==`.
