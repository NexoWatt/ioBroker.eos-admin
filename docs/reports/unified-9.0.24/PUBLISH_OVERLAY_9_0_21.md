# Publish-Abbruch durch erhaltenes 9.0.21-Frontend

Stand: 25.11.2026, EOS 9.0.24. Gemeldeter Fehler beim Überkopieren unter Windows: `EOS_PUBLISH_EXTRA_UNKNOWN adminWww/assets/hostInit-BNFIx0-f.js` im vorhandenen npm-Vorbereitungsschritt.

## Ursache und Änderung

Der Altdateikatalog endete bei Stand 9.0.19. Die gemeldete Datei ist ein unverändertes, versiegeltes Frontend-Asset aus dem tatsächlich vorhandenen gelieferten Archiv `NexoWatt_EOS_9.0.21_FULL_REPOSITORY.zip`. Alle 359 Admin-Dateien und drei kompilierten Installer-Assets dieses Archivs wurden einzeln mit dessen Dateiversiegelung verglichen. Dabei fehlten insgesamt 31 konkrete Hash-Zuordnungen im aktuellen Katalog; diese wurden ergänzt. Dadurch folgt nach dem gemeldeten Asset nicht lediglich der nächste bekannte Rest desselben Lieferstands. Zusätzlich wurden die ebenfalls tatsächlich gelieferten und versiegelten Archive 9.0.22 und 9.0.23 geprüft (je 362 Frontend-Dateien) und weitere 10 beziehungsweise 28 fehlende Hash-Zuordnungen ergänzt. Insgesamt enthält die Änderung 69 zusätzliche belegte Hash-Zuordnungen; die Archiv- und Manifestprüfsummen dieser beiden Lieferstände stehen in `raw/publish-overlay-provenance-922-923.json`.

| Beleg | SHA-256 |
| --- | --- |
| Originales 9.0.21-Archiv | `2e6379843392fbf682670fe05039459fea93c3f702d956cc7edb3e0415d89c7a` |
| Originale `files.json`-Versiegelung | `feb1d213fe699a635457f7be609b7a40816ffe26c094b419be27d6a7d47efa3f` |
| Gemeldetes Asset, 6.199 Byte | `f536222133dab1acf78d72aebdbfc75d163db120b4253248171dfa99bf6887c1` |

Die Lösch-/Vorbereitungslogik in `tools/eos-prepare-publish.cjs` bleibt unverändert. Nur katalogisierte, unveränderte, vom aktuellen Build nicht referenzierte Altdateien werden zuerst außerhalb des Repositorys gesichert und anschließend aus dem zu veröffentlichenden Baum entfernt. Unbekannte oder veränderte Dateien stoppen weiterhin die gesamte Vorbereitung ohne Bereinigung. Aktuelle versiegelte Dateien werden weder gelöscht noch neu versiegelt. Ein Überkopieren bekannter älterer Builds erfordert dadurch keinen manuellen Leerordner-Workaround.

## Prüfung

Die originale gemeldete Datei liegt unverändert als Regression-Fixture unter `test/fixtures/publish-overlay-9.0.21/hostInit-BNFIx0-f.js.fixture`. Drei neue Tests verwenden den tatsächlich ausgelieferten Katalog und diese Originalbytes: erfolgreiche Sicherung/Entfernung inklusive wiederholtem No-op; Ablehnung veränderter Bytes unter exakt demselben Namen ohne Sicherungs-/Löschmutation; Erhalt der Datei, falls sie zum aktuellen versiegelten Stand gehört.

`test/eos-publish-prepare.test.cjs` und `test/eos-publish-prepare-security.test.cjs`: jeweils 44/44 erfolgreich, keine Skips, unter Node.js 22.23.4 und 24.22.3 auf Linux. Pfade mit Leerzeichen, portable Pfadvalidierung, Unveränderlichkeit der aktuellen Versiegelung und bestehende Abbruch-/Rollback-Fälle sind enthalten. Ein nativer Windows-npm-Publish wurde hier nicht ausgeführt; die endgültige Paketversiegelung und der vollständige Release-Lauf erfolgen durch den Releaseprozess.

Rohbelege: `raw/publish-overlay-node22.tap`, `raw/publish-overlay-node24.tap`, `raw/publish-overlay-provenance.json`, `raw/publish-overlay-provenance-922-923.json`. Es wurden keine Kundendateien, Geheimnisse oder Produktivverzeichnisse bereinigt.
