# Geheimnisse vor npm-Upload und vollständiger ZIP-Auslieferung

Stand: 29.09.2026, NexoWatt UI 1.0.22. Ergänzung zur CRA-Nachprüfung nach der
ausdrücklichen Vorgabe, private Serverdateien getrennt zu liefern.

## Befund und Zweck

Die zusätzliche Inhaltsprüfung fand einen fest eingebauten HMAC-Schlüssel für
die bestehende Lizenzvalidierung. Betroffen waren drei Verwendungen in
`main.js` und jeweils die kanonische TypeScript-Quelle und der Runtime-Spiegel.
Der bisherige SMTP-/Token-Scanner erfasste diese generische Schlüsselkonstante
nicht. Der Wert wird weder hier noch in Tests, Diagnosen oder Beispielen
wiedergegeben. Eine Änderung des bestehenden Wertes würde bestehende Lizenzen
betreffen; seine private Bereitstellung ist getrennt von einer Schlüsselrotation
zu behandeln.

`main.js` gehört zur npm-Dateiliste. Deshalb reicht es nicht, nur auffällig
benannte Konfigurationsdateien aus dem Archiv zu entfernen. Die Prüfung muss
auch eingebettete Schlüssel in veröffentlichtem Quellcode erfassen.

## Ergänzte Veröffentlichungssperren

`scripts/check-repository-secrets.cjs` blockiert zusätzlich:

- Nichtleere String- und statische Template-Literale als direktes zweites
  Argument des HMAC-Konstruktors (`literal-hmac-key`).
- Nichtleere Literalzuweisungen an Secret-, HMAC-Key-, Signing-Key- und
  License-Key-Variablen in einem Modul mit HMAC-Aufruf; einfache
  TypeScript-Typangaben sind eingeschlossen (`literal-hmac-secret`).
- Private ENV-Dateien wie `license.env`, `server.env` und deren Umgebungsvarianten
  sowie Dateien unter `private-server-installation/`.
- Eindeutige ENV-Zuweisungen mit großgeschriebenem Secret-, Token-, Passwort-,
  Private-Key- oder API-Key-Suffix, auch in anders benannten Dateien
  (`secret-environment-value`).

Leere Werte und vollständige dynamische ENV-/Konfigurationsbezüge bleiben
zulässig. Beispiel-/Vorlagendateien mit `.example` oder `.template` sind nur
vom Dateinamenverbot ausgenommen; ihr Inhalt wird weiterhin geprüft. Bestehende
SMTP-, Tokenformat-, Private-Key-, Installationsdaten- und Altbundle-Regeln sowie
die Prüfung des tatsächlichen Git-Index bleiben erhalten. Es gibt keine
Ausnahme für Produktdateien oder Testverzeichnisse. Meldungen enthalten nur
Pfad, Zeile und Regelkennung.

## Tatsächlich durchgeführte Prüfungen

Die Fixture- und isolierten Integrationsteile von
`scripts/verify-stable-1.0.10-secret-guard.cjs` wurden unter Node.js 24.19.0/Linux
ausgeführt und endeten mit Exit 0. Enthalten waren:

- Direkte HMAC-Literale mit drei Anführungsarten, benannte Schlüssel,
  TypeScript-Zuweisungen, leere und dynamische Werte.
- Private ENV-Dateinamen, harmlose Vorlagen und nichtleere Werte in Vorlagen,
  ENV-Zuweisungen außerhalb privater Dateien sowie Leerzeilen/Kommentare.
- Bestehende SMTP-, Tokenformat- und Dateipfad-Fixtures.
- Echte temporäre Git-Repositories: Ein zuvor gestagter HMAC-Schlüssel wurde
  trotz bereinigter Arbeitskopie vom Commit-Hook abgewiesen.
- Echte Artefakt-Prüfprozesse: HMAC- und SMTP-Fixtures blockierten vor dem Lesen
  der Release-Metadaten; die Zufallswerte erschienen nicht in Diagnosen.

Alle Geheimnis-Fixtures entstehen mit kryptografischen Zufallswerten erst zur
Laufzeit. Temporäre Testdateien werden anschließend entfernt. Die isolierten
Prüfungen umfassen ausdrücklich nicht die abschließende Prüfung des zeitgleich
überarbeiteten Produktbaums. Deren Ergebnisse und die endgültigen Paket-/ZIP-
Prüfungen gehören zu den abschließenden Release-Rohprotokollen.

## Weitere Sichtung und Grenzen

Bei der ergänzenden Sichtung vor der Lizenzmigration wurden keine vorhandenen
privaten ENV-/npmrc-/Schlüssel-/Keystore- oder Kundensicherungsdateien gefunden.
In zehn SBOM-Dateien wurden 1299 HTTP(S)-URL-Vorkommen geprüft: kein Passwort in
einer URL und keine Token-/Signaturquery. Ein öffentlicher VCS-Verweis des
Drittpakets `formdata-polyfill` enthält seinen GitHub-Repository-Eigentümer als
Benutzernamen, ohne Passwort; das ist kein privater Serverzugang. Andere
Stichsuchtreffer waren Laufzeitinterpolationen oder negative Testfixtures.

Der Scanner ist eine gezielte Textprüfung, keine vollständige Datenfluss- oder
Entropieanalyse. Aliasaufrufe, kodierte oder zusammengesetzte Geheimnisse,
unbekannte Tokenformate und Daten in Binärdateien benötigen weiterhin Review.
Die HMAC-Variablenregel verwendet den Dateikontext, nicht den Nachweis einer
tatsächlichen Variablenverwendung. Null Treffer bedeuten keine Garantie, dass
ein beliebiges Geheimnis ausgeschlossen ist.

Private Serverlieferungen müssen außerhalb des öffentlichen Repositorys und
seiner ZIP-Auswahl bleiben. Der vollständige öffentliche Lieferstand und das
tatsächlich gepackte npm-Artefakt sind nach der letzten Änderung erneut zu
prüfen. Die Lizenzmigration und die private Serverbereitstellung werden
gesondert dokumentiert; dieser Scanner erzeugt oder verteilt keine Schlüssel.
