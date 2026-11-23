# Modulkonfiguration und Sitzungsstabilität – 9.0.7

Stand: 23.11.2026. Ausgangsstand: ausgeliefertes Repository 9.0.6.

## Bestätigte Ursache

`EosModuleHost.save` schrieb die verschlüsselte Gerätekonfiguration in
`system.adapter.eos-admin.0.native.eosModules`. Der ioBroker-Controller 7.2.5
beendet einen laufenden Adapter bei Änderungen seines Instanzobjekts und startet
ihn anschließend erneut. Das wurde im tatsächlich installierten Controllercode
(`build/esm/main.js`, Objektänderungsbehandlung, Zeilen 603–666) geprüft.
Die neue Adapterlaufzeit verwirft alte Sitzungscapabilities absichtlich. Dadurch
konnte die anschließende Statusabfrage im Geräteeditor „Sitzung abgelaufen“ melden.
Dies ist ein Integrationsfehler des bisherigen Speicherwegs, kein Anlass zur
Abschwächung der Sitzungssicherheit.

## Änderung und Funktionserhalt

- Modulkonfigurationen werden außerhalb des Instanzobjekts gespeichert:
  `eos-admin.N.modules.<modul>.configuration`, Objekttyp `config`.
  Der Controller muss dafür keinen Adapterprozess neu starten.
- Der komplette Konfigurationsumschlag einschließlich Migrationsmetadaten ist
  verschlüsselt. Objekt-ACL: Eigentümer `system.user.admin`, Gruppe
  `system.group.administrator`, Berechtigung `0x600`. Gerätegeheimnisse werden
  weiterhin ausschließlich maskiert an die Oberfläche geliefert.
- Bestehende 9.0.6-Konfigurationen bleiben als Lese-Fallback erhalten, bis eine
  eigene Konfiguration gespeichert wurde. Ein beschädigter neuer Datensatz fällt
  nicht still auf ältere Werte zurück.
- Revisionsvergleich, begrenzte gleichzeitige Schreibzugriffe und Rücklesen des
  geschriebenen Datensatzes erkennen Konflikte. Die ioBroker-Objektschnittstelle
  bietet hier keine allgemeine datenbankübergreifende Compare-and-Swap-Garantie;
  ein privilegierter externer Schreiber ist kein unterstützter paralleler Editor.
- Vor Schreibaktionen lädt der Geräteeditor den aktuellen CSRF-Nachweis, ohne
  die bearbeiteten Geräte zu ersetzen. Eine Anmeldung in einem anderen Tab ist
  dadurch mit einem anschließend ausdrücklich ausgelösten Speichern vereinbar.
- Bei tatsächlichem Sitzungsablauf bleiben Änderungen im geöffneten Formular.
  Ein Link öffnet die Anmeldung in einem neuen Tab. Fehlgeschlagene Mutationen
  werden nicht automatisch wiederholt.
- Derselbe authentifizierte Modulrahmen liefert die gemeinsame Gestaltung und
  die neue Backup-Oberfläche. Backup-Downloads werden als Stream übertragen:
  höchstens zwei gleichzeitig, mit Größenkontrolle, Abbruchbehandlung und
  30-Minuten-Frist. Dateien werden nicht vollständig in den RAM geladen.

## Nachweis

Umgebung: Node.js 24.22.3, Linux-Entwicklungsumgebung. Ausgeführt:

```text
node --test test/eos-module-config-store.test.cjs test/eos-module-editor-session.test.cjs test/eos-module-http.test.cjs
node_modules/.bin/eslint -c eslint.unified.config.mjs src/lib/eosModuleHttp.js
node_modules/.bin/eslint -c eslint.config.mjs src/lib/eosModuleConfigStore.js
```

Ergebnis: 18 Tests bestanden; beide Lintprüfungen bestanden. Rohbelege:
`module-session-tests.log`, `module-http-lint.log`, `module-config-lint.log`.
Die Tests prüfen verschlüsselte Persistenz und Neuladen, Altkonfiguration,
beschädigte Daten, Revisionskonflikte, parallele Schreibversuche,
Schreibfehler, Formularerhalt, CSRF-Rotation, unterbundene automatische
Wiederholungen und echte HTTP-Routen einschließlich Backup-Download mit
Sitzungs-/Rollenprüfung, begrenzter Anzahl langsamer Übertragungen, Abbruch
durch den Client und abweichender Dateigröße.

Die Editorprüfung führt das ausgelieferte Browserskript mit einem kleinen
DOM-Modell aus; sie ist kein visueller Browsernachweis. Die HTTP-Tests verwenden
einen echten Express-Listener mit einer kontrollierten Authentifizierungsgrenze.
Der zusätzliche Test mit echtem ioBroker-Controller und erhaltenem OAuth-Cookie
wird im übergeordneten Integrationsbericht dieses Lieferstands ausgewiesen.
Anwendergerät und physischer FENECON-Speicher waren hier nicht erreichbar.

## Betriebsprüfung

Auf der Testanlage ein Gerät bearbeiten und speichern, anschließend ohne neue
Anmeldung Dashboard und Geräteübersicht öffnen. Der EOS-Prozess soll dabei
dieselbe PID behalten; nur das betroffene Gerätemodul darf seine Konfiguration
neu übernehmen. Danach einen geplanten Adapterneustart durchführen und die
gespeicherten Werte sowie Gerätekommunikation kontrollieren. Bei einem echten
Adapterneustart bleibt erneute Anmeldung eine beabsichtigte Sicherheitsgrenze.
