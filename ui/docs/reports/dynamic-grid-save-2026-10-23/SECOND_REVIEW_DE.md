# Zweiter KI-Review – App-Center-Speichern 1.0.27

Datum: 23.10.2026. Ausgangscommit: `0314b28aafa875ad411e81a66d6f344d23c02900`.
Geprüft wurde der noch nicht eingecheckte Änderungsstand für Version 1.0.27 nach
Synchronisation der Laufzeitdateien und Erstellung des React-Builds.

Dieser Review wurde von einem zweiten KI-Arbeitsstrang durchgeführt, der die
hier geprüften Produktänderungen nicht implementiert hat. Er ist keine externe
Sicherheitsprüfung, Zertifizierung, Herstellerfreigabe oder Anlagenabnahme.

## Ergebnis und Umfang

Die Korrektur behebt den nachgewiesenen Vertragsfehler beim ersten Speichern der
App-Installation: App-Center und Backup-Import senden nun den Versionswert des
tatsächlich geladenen Gesamtstands. Fehlende oder veraltete Schreibversionen
werden weiterhin vom Backend abgewiesen. Im abgegrenzten Dynamic-Grid-Save- und
Importumfang wurde nach der Nachbesserung kein offener blockierender Befund
festgestellt. Der unten genannte allgemeine Reload-Randfall bleibt ausdrücklich
offen und gehört nicht zu dieser Aussage.

Geprüfte Produktbereiche:

- `src-ts/runtime-executables/lib/dynamic-grid-config-api.ts`: lesende
  Versionsnormalisierung, CAS-Prüfung, App-Center-/Import-Vertrag und zentrale
  Persistenzgrenze.
- `src-ts/runtime-executables/main.ts`: gemeinsame Leseantworten sowie globale
  Speicher- und Importaufrufe.
- `src-ts/runtime-executables/www/ems-apps.ts`: Save-/Import-Payload,
  geladener und beobachteter Versionsstand, iframe-Nachrichten, Antwortübernahme
  und Eingabesperre während Save/Import.
- `src-admin-tab/src/pages/DynamicGridPage.tsx`: eigener Save-Vertrag,
  Versionsbeobachtung, Pollantworten und Entwurfserhalt.
- Zugehörige API-, HTTP- und Browserprüfungen sowie deren vorliegende Rohbelege.

Die M0-/M1-Regelberechnung, Gerätewriter, Eigentumsübergabe und Lizenzarchitektur
wurden in diesem Patch nicht verändert. Deren bisherige gesamte Abnahme wird
durch diesen begrenzten Review nicht wiederholt oder ersetzt.

## Befunde und Nachprüfung

| Kennung | Befund | Geprüfte Abhilfe / Stand |
| --- | --- | --- |
| DGS-REV-01 | Der globale App-Center-Payload enthielt beim Installationsschalter keinen `expectedDynamicGridConfigVersion`. | Der Payload verwendet die Version aus dem geladenen Gesamtstand. Erste Installation mit Version 1 erzeugt den inaktiven Vertrag mit Version 2. Kein automatischer Ersatz einer fehlenden erwarteten Version im Backend. Geschlossen. |
| DGS-REV-02 | Der Backup-Import hatte denselben fehlenden expliziten CAS-Token. Eine historische Versionszahl im Backup ist nicht die aktuelle Serverversion. | Import sendet den geladenen aktuellen Token separat. Geprüft: Backup-Inhaltsversion 1 mit erwartetem aktuellem Stand 5 erzeugt Version 6; Wiederholung mit veraltetem Token wird abgewiesen. Geschlossen. |
| DGS-REV-03 | Alte gespeicherte Objekte ohne gültiges Versionsfeld konnten in Leseantworten vom intern verwendeten Anfangswert abweichen. | Beide Lesewege normalisieren nur die Antwortkopie auf Version 1. Tests belegen, dass Laden weder Runtimekonfiguration noch gespeicherten Entwurf migriert. Geschlossen. |
| DGS-REV-04 | Ein Save im eingebetteten Formular konnte den Gesamtstand des Parents veralten lassen; die Gegenrichtung betraf den Kindentwurf. | Nachrichten erhöhen nur die beobachtete Version. Sie ersetzen weder Entwurf noch geladenen CAS-Token. Beide Richtungen prüfen Origin und den konkreten Absender; bekannte veraltete Entwürfe verlangen bewusstes Neuladen. Ohne Nachricht bleibt die serverseitige CAS-Prüfung wirksam. Geschlossen. |
| DGS-REV-05 | Eine ältere Antwort konnte neuere App-/Statusanzeigen zurücksetzen; neue Parent-Eingaben während Save/Import konnten nach Rückkehr überschrieben werden. | Ältere Dynamic-Grid-Versionen werden vor UI-Übernahme verworfen. Parent-Save/Import sperrt den Inhaltsbereich mit `inert` und gibt ihn in `finally` wieder frei; das Kindformular ist während eigener Aktionen gesperrt. Quellprüfung abgeschlossen; gezielt künstlich verzögerte Antwortreihenfolgen wurden in diesem Review nicht automatisiert ausgeführt. |

Der bestehende serverseitige Schutz wurde nicht abgeschwächt: gemeinsame
Speichersperre, Installer-Berechtigung, fachliche Aktivierungsprüfung und
kontrollierte Übergabe bleiben bestehen. Die Erstinstallation setzt
`installed=true`, `enabled=false`; ein unvollständiger Entwurf wird dadurch nicht
aktiv. Der Konflikt führt weder zu einem automatischen Neuladen des Tokens noch
zu einem automatischen Wiederholungsversuch mit alten Formularwerten.

Die neuen Lesehilfen enthalten keine Änderung an Lizenzkonstanten oder
Lizenzzuordnungen. Der bestehende Home-/Pro-Zugang und die bisherige
Speicherlizenzbegrenzung werden weiterverwendet; dies ist keine erneute Prüfung
des gesamten Lizenzverfahrens.

## Tatsächlich geprüfte Nachweise

Umgebung des eigenen fokussierten Wiederholungslaufs: Linux,
Node.js `v24.19.0`, lokaler Repositorystand nach Laufzeitsynchronisation.

```text
node --test test/dynamic-grid-config-api.test.cjs test/dynamic-grid-config-http.test.cjs
20 Tests, 20 bestanden, 0 fehlgeschlagen
```

Dieser Befehl wurde im zweiten Review selbst ausgeführt. Er umfasst unter anderem
fehlende/alte Lesestände, erste globale Installation, getrennte Backup- und
CAS-Version, echte veraltete Änderungen, konkurrierende Speicherpfade,
Berechtigungen, atomare Aktivierung, Übergabeprüfung und das bestehende
Speicherlizenzlimit. Die HTTP-Prüfungen verwenden die erzeugte Laufzeit mit
Express und zentralem Persistenzpfad; ioBroker und Geräte sind simuliert.

Ein vorheriger Zwischenlauf ergab 19/20, weil der HTTP-Harness noch die nicht
synchronisierte Laufzeitdatei verwendete. Erst der nach Synchronisation
ausgeführte 20/20-Lauf ist der abschließende Nachweis.

Zusätzlich wurden die Testquellen und bereits ausgeführten Rohbelege aus dem
Implementierungsarbeitsstrang geprüft; diese Browserläufe wurden vom zweiten
Reviewer nicht erneut ausgeführt:

- [backend-http.log](backend-http.log): weiterer abschließender 20/20-Lauf.
- [browser-real-save.log](browser-real-save.log): abschließender PASS für sechs
  Abläufe mit ausgeliefertem App-Center, gebautem React, echten Express-Routen und
  zentraler Persistenz. Enthalten sind Erstinstallation, unveränderter erneuter
  Save, Kind-/Parent-Wechsel mit Entwurfserhalt, echte konkurrierende Änderung
  mit HTTP 409 und Dateiimport. Frühere FAIL-Einträge bleiben als Zwischenstände
  sichtbar; sie werden nicht als bestandene Prüfungen gewertet.
- [browser-navigation.log](browser-navigation.log): neun bestandene
  Navigations-/Zugriffsprüfungen mit lokalen API-Fixtures.
- [browser-form.log](browser-form.log): fünfzehn bestandene Formularszenarien mit
  lokalen API-Fixtures.

## Verbleibende Beobachtung und Grenzen

**DGS-OBS-01 – allgemeines explizites Neuladen:** `loadConfig()` besitzt außerhalb
des gesperrten Importablaufs weiterhin keine allgemeine Eingabe- oder
Request-Revisionssperre. Nach einem ausdrücklich ausgelösten Reload könnten neu
eingegebene Werte von dessen verspäteter Antwort überschrieben werden. Bei
Änderungen außerhalb der Dynamic-Grid-Signatur muss sich die Dynamic-Grid-Version
nicht erhöhen; der neue Versionsvergleich schützt diesen allgemeinen Fall daher
nicht. Die Beobachtung stammt aus der Quellprüfung, wurde nicht als Browserfall
reproduziert und wird nicht als behoben ausgegeben. Der leitende Arbeitsstrang
hat entschieden, diesen vorbestehenden allgemeinen UI-Randfall getrennt zu
behandeln und den vorliegenden CAS-Patch nicht dafür auszuweiten. Eine spätere
gezielte Änderung sollte Reload, Folgeeingabe und konkurrierenden Save mit
verzögerten Antworten prüfen.

Es wurde keine reale Anlage angesprochen, kein Live-Gerät aktualisiert und kein
Geräte-Feldtest durchgeführt. Übergabehaken und EMS-Neustart sind im Browser-HTTP-
Test Fixtures. Die Ergebnisse belegen den geprüften Softwarevertrag, keine reale
Gerätewirkung. Vollständige Releaseprüfungen und Freigabeentscheidungen werden im
[Änderungs- und Prüfvermerk](PRUEFVERMERK_DE.md) getrennt dokumentiert.

## Bindung an den geprüften Stand

SHA-256 zum Abschluss der Quellprüfung:

| Datei | SHA-256 |
| --- | --- |
| `src-ts/runtime-executables/lib/dynamic-grid-config-api.ts` | `cad8ceb06e94e917e09db439127b9bc6c1cd2669f0289d0c36b78cdf72a6fac6` |
| `src-ts/runtime-executables/main.ts` | `4fc06443b826de3e9192fdb93775344768cf8691b52acde7e6677129089f6a7f` |
| `src-ts/runtime-executables/www/ems-apps.ts` | `e0b4a8fc3a657f84b978f568664dded9e5758164be83699a270644667bbe6562` |
| `src-admin-tab/src/pages/DynamicGridPage.tsx` | `721e012c9e1ac4b9d49601dc2d50195faba47e925759f7d19136cfac1e693ead` |
| `main.js` | `da7ac8c3e6dc3bf8d5da7eb52a17bac4ee5585c177016f6b509c840057cc765b` |
| `www/ems-apps.js` | `baf4a7f7836a53493e02c620261f0f3b5aad055a9291359b0a4c32d05155232a` |
| `admin/react/assets/index-C2FHbrz4.js` | `11d0abe88c61502b46a9348a1ef56635cdb90a90969d94feac6a6d28f8318df5` |
