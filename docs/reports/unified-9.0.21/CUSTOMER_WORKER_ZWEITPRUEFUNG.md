# Zweitprüfung des begrenzten EOS-Updateworkers

**Prüfkennung:** 921-SEC-WORKER-REVIEW. **Stand:** 24.11.2026.
Dies ist eine getrennte Code- und Fehlerfallprüfung des neuen Updateworkers,
keine unabhängige Zertifizierung, Gesamtfreigabe oder CRA-Konformitätsaussage.
Der prüfende Agent hat den Worker nicht implementiert. Produktivcode und seine
bestehenden Tests wurden durch diese Zweitprüfung nicht verändert.

## Gegenstand und Ergebnis

Geprüft wurden `src/lib/eosCustomerUpdateWorker.ts` und
`test/eos-customer-update-worker.test.cjs`. Im untersuchten Umfang wurde kein
zusätzlicher reproduzierbarer Fehler des Workers festgestellt. Die bestehende
Suite und fünf zusätzlich geschriebene Gegenproben bestanden jeweils auf
Node.js 22.23.4 und 24.22.3. Das ist ein begrenzter positiver Prüfstand; die
nachstehenden offenen Integrations- und Vertrauensgrenzen bleiben bestehen.

| Datei | SHA-256 des geprüften Quellstands |
| --- | --- |
| `src/lib/eosCustomerUpdateWorker.ts` | `c1b0df8a310449973290ea4fe2bff1d4babea6ae51aace59f4fb3f0657cb7b91` |
| `test/eos-customer-update-worker.test.cjs` | `4c40e877ecc33d0da95284da7b18a12ccf3c6b4e76b6be9f021b4e2aac6682e0` |

## Eingesehene Grenzen

| Grenze | Quellbezug und Bewertung |
| --- | --- |
| Ziel und Auftrag | `parseEosCustomerUpdateJob`, ab Zeile 73: feste EOS-Namensräume, genau eine zuvor freigegebene Instanz, höhere stabile Version im selben Major, feste Paket-/Controlleridentitäten, begrenztes Dateimanifest und Hashbindung. Die dienstseitige Authentisierung des Auftrags bleibt Voraussetzung. |
| Dateien und Speicher | `privateDirectory`, `regularFile`, `readJson`, `hashFile`, ab Zeile 167: privates Auftragsverzeichnis, keine letzten Symlinkkomponenten/Hardlinks, begrenzter JSON-Puffer, begrenzte Archiv-/Snapshot-/Hashgrößen. `currentCodeImage`, ab Zeile 273, begrenzt Verzeichnistiefe, Einträge, Dateianzahl und Gesamtgröße. |
| Befehle und Abbruch | `command`, ab Zeile 325: feste Node-Programmausführung und Argumentlisten ohne Shell; isolierte Prozessgruppe; begrenzte Ausgaben; monotone Fristen; SIGTERM/SIGKILL-Eskalation. Ausgaben werden nicht als Fehlertext oder Token in den Ergebnisbeleg übernommen. |
| Doppelstart und Dauerhaftigkeit | `runEosCustomerUpdateWorker`, ab Zeile 478: exklusiver `worker.claim`, keine automatische Wiederholung; Ergebnis wird über private temporäre Datei, Dateisynchronisierung, Umbenennung und Verzeichnissynchronisierung geschrieben. Eine bereits belegte Aufgabe führt zu keinem neuen CLI-Aufruf. |
| Stop, Installation, Start | Ab Zeile 535: Paket-, Controller-, Archiv- und Snapshotprüfung vor dem Stop; tatsächliches `alive=false` vor der lokalen TGZ-Installation; Paketidentität und Manifestprüfung nach Installation; tatsächliches `alive=true` vor Erfolg. Ein CLI-Exitcode 0 allein gilt nicht als erfolgreiche Installation. |
| Fehler vor Installation | Ab Zeile 594: Wiederherstellung ausschließlich der zuvor eingeschalteten eigenen Instanz, wenn noch keine Installation begonnen hat und Identität sowie erfasste alte Programmdateien unverändert sind. Dies bleibt ein fehlgeschlagenes Update mit gesondertem Wiederherstellungsergebnis. |
| Fehler nach Installationsbeginn | Keine automatische Wiederholung, kein blinder Rückfall und keine Erfolgsmeldung; unsicherer Zustand im Ergebnisbeleg. Ein späterer Startfehler ist ebenfalls kein Erfolgsnachweis. |

## Tatsächlich ausgeführte Prüfungen

Die Tests verwenden echte temporäre Dateien, echte Node-Kindprozesse und reale
Linux-Prozessgruppen. Der ioBroker-CLI-Teil ist eine kontrollierte Testattrappe.
Sie beweisen weder einen echten Controller-Paketwechsel noch Gerätefunktion.

| Prüfung | Node 22.23.4 | Node 24.22.3 |
| --- | ---: | ---: |
| Bestehende Worker-Suite | 12/12 | 12/12 |
| Zusätzlich verfasste Gegenproben | 5/5 | 5/5 |

Alle vier Läufe endeten mit Code 0, null Fehlern und null übersprungenen Tests.
Die zusätzlichen Gegenproben prüfen:

1. Zwei gleichzeitig gestartete Worker desselben Auftrags installieren genau einmal.
2. Ein bestehender Claim verhindert Wiederholung und lässt den bisherigen Ergebnisbeleg unverändert.
3. Mehr als 2 MiB CLI-Ausgabe brechen vor der Installation ab; der Testinhalt erscheint nicht im Ergebnisbeleg.
4. Zu große, dünn belegte Archiv- und Snapshotdateien werden vor dem Stop abgewiesen.
5. Ein echtes Betriebssystem-SIGTERM an den kopierten, eigenständig gestarteten Worker beendet laufende Installations-Nachkommen und hinterlässt `uncertain` ohne anschließenden Start.

Die bestehende Suite prüft zusätzlich unter anderem falsche Identitäten und
Pfade, manipulierte Dateien, unbestätigte Stop-/Startzustände, vorgetäuschten
Installationserfolg, geänderte Zieldateien, Timeout mit laufendem Nachkommen,
Abbruchsignal, Symlinks, private Dateirechte sowie Wiederherstellung nach einem
vor der Installation injizierten Speicherfehler. Geänderter alter Code wird
dabei nicht wieder gestartet.

Ausführungsbefehle vom Repositoryverzeichnis:

```sh
node --test test/eos-customer-update-worker.test.cjs
/workspace/scratch/741f792566ea/node22-runtime/package/bin/node --test test/eos-customer-update-worker.test.cjs
node --test /workspace/scratch/741f792566ea/audit-921/security/worker-independent/independent-worker-probes.cjs
/workspace/scratch/741f792566ea/node22-runtime/package/bin/node --test /workspace/scratch/741f792566ea/audit-921/security/worker-independent/independent-worker-probes.cjs
```

Rohbelege, zusätzliche Probe und maschinenlesbarer Beleg mit Quell-/Loghashes:
`/workspace/scratch/741f792566ea/audit-921/security/worker-independent/`.
Die Läufe erfolgten unter Linux mit UID/GID 1000, ohne effektive Capabilities und
mit `NoNewPrivs=1`. Das dokumentiert diesen Prüfprozess, keine vollständige
Prüfung aller Rechte, Dienste oder Sockets einer späteren Kundeninstallation.

## Offene Grenzen und nächste Nachweise

- Der reale Ablauf mit js-controller 7.2.5 und dem endgültigen lokalen
  Release-TGZ wird im übergeordneten Integrationstest nachgewiesen. Er wurde
  durch diese Zweitprüfung nicht ausgeführt. Andere Controller, Plattformen und
  mehrere EOS-Instanzen sind nicht durch diese Prüfung freigegeben.
- Authentisierung, erneute Rollenprüfung, CSRF, Registry-Signaturprüfung,
  Archivprüfung, Konfigurationssicherung und die erneute Konfigurationsprüfung
  nach dem Neustart liegen in vorgeschalteten beziehungsweise nachgeschalteten
  Komponenten. Sie wurden hier nicht unabhängig vollständig geprüft.
- Einzelne Dateisystem-Metadaten-, Open-, Rename- und fsync-Aufrufe sind auf
  Betriebssystemebene nicht hart abbrechbar. Der monotone Gesamtetat und die
  Stream-/Prozessfristen sind kein garantierter Wallclock-Abbruch eines hängenden
  Dateisystems. Dauerhafter Speicherausfall kann auch den abschließenden Beleg
  verhindern; ein vorhandener Claim darf deshalb nicht automatisch entfernt
  oder wieder ausgeführt werden.
- Der private Auftragsbereich schützt gegen andere Benutzer, nicht gegen
  kompromittierte Prozesse mit derselben ioBroker-Dienstkennung. Der lokale
  Controller und sein Code sowie die Übergabe des bereits autorisierten Jobs
  gehören zur vorausgesetzten Vertrauenszone. Es entsteht keine OS-Sandbox.
- Die Hashkontrolle bindet die EOS-Paketdateien. Sie prüft nicht sämtliche von
  npm installierten Abhängigkeiten oder deren Lifecycle-Nebenwirkungen.
  `node_modules` ist auch aus dem Vorher-/Nachherbild für eine sichere
  Wiederaufnahme vor Installationsbeginn ausdrücklich ausgenommen. Der
  übergeordnete Lieferketten- und Abhängigkeitsnachweis bleibt erforderlich.
- `alive=true` bedeutet, dass die Instanz als laufend beobachtet wurde; daraus
  folgen weder korrekte EMS-Regelung, erhaltene gesamte Konfiguration,
  gesunde Hardwareverbindungen noch ein physischer Sicherheitsnachweis.

Die Gesamtfreigabe, der endgültige Artefaktbezug, ein kontrollierter Gerätetest
und die produktbezogene Herstellerentscheidung bleiben beim übergeordneten
Releaseverfahren.
