# MEMORY-REGISTRY-001 – fremde States im EMS-Wertcache

Stand: 22.11.2026, NexoWatt EOS 9.0.5. Status: Komponentenfehler reproduziert und korrigiert; RAM auf Dominiques Anlage weiterhin offen.

## Befund und Änderung

Der gemeinsame Host empfängt für die Systemverwaltung auch ioBroker-State-Ereignisse außerhalb der EMS-Konfiguration. Die bisherige `DatapointRegistry.handleStateChange` speicherte jedes dieser Ereignisse dauerhaft im eigenen `cacheByObjectId`. Damit konnte zusätzlich zu den benötigten Admin-Daten ein fremder, mit der Anzahl beobachteter State-IDs wachsender Wertcache entstehen.

Die Registry hält jetzt nur Werte aktuell konfigurierter Messquellen, Alias-IDs und Verbindungsindikatoren. Referenzzählung erhält gemeinsam verwendete Quellen, bis die letzte Zuordnung wechselt. Für Geräte-Heartbeats genügen Zeitstempel; fremde Geschwisterwerte werden nicht gespeichert. Es gibt keine pauschale Obergrenze, die aktive konfigurierte Messwerte verdrängt, und keine geänderten Heap-Limits oder abgeschalteten Funktionen.

Bei einer neuen oder zurückkehrenden Zuordnung erfolgt weiterhin das Einlesen aus der States-Datenbank. Mapping-Generationen und Ereigniszähler verhindern, dass verspätete Antworten nach A→B→A, nach einem aktuellen Messwert oder nach einer Löschung alte Werte wiederherstellen. Ein Löschereignis wird in der tatsächlichen gehosteten `onStateChange`-Funktion an den EMS-Cache weitergegeben; andere Wertverarbeiter erhalten weiterhin keine Null-States. Synchrone Zahlen-/Rohwertabfragen, Einheitenumrechnung, Ursprungszeitstempel und getrennte Heartbeat-/Connected-Semantik bleiben erhalten.

Die für ioBroker-Admin benötigte Objektliste wurde nicht pauschal gekürzt. Der gehostete UI-Adapter verwendet denselben Hostzugang; diese Untersuchung hat keinen zweiten Controllerprozess nachgewiesen.

## Kontrollierte Messung

Isolierter Node.js-Prozess, Version 24.22.3; 256 konfigurierte Quellen und anschließend 50.000 unzugeordnete State-Ereignisse. Davon 90 % Zahlen und 10 % eindeutige Textwerte von je 2.048 Byte. `process.memoryUsage()` wurde nach expliziter Garbage Collection vor und nach dem Ereignisstrom gelesen. Es wurden keine Heap-Dumps, produktiven Daten oder Schlüssel erhoben.

| Kennzahl | Ausgangsquelle vor Patch | Gebaute Runtime 9.0.5 |
| --- | ---: | ---: |
| Verbleibende Wertcache-Einträge | 50.256 | 256 |
| Zusätzlicher Heap, Byte | 20.604.160 | 40.672 |
| Zusätzlicher Heap, MiB | 19,650 | 0,039 |
| Zusätzlicher Prozess-RSS, Byte | 51.699.712 | 12.746.752 |
| Zusätzlicher Prozess-RSS, MiB | 49,305 | 12,156 |
| Letzter konfigurierter Messwert | 255 | 255 |

Ein MiB entspricht 1.048.576 Byte. RSS enthält unter anderem reservierte Laufzeit-/Allocator-Seiten; es ist kein Maß allein für lebende Cachewerte. Ein einzelner Komponentenlauf ist kein Dauerlauf oder vollständiges Prozessprofil. Diese Messung erklärt weder die gesamten gemeldeten ungefähr 750 MB auf der Anlage noch beweist sie einen Speichermangel als Ursache des History-Absturzes. Für dessen HTTP-Grenzfehler gelten die getrennten History-/Express-Nachweise.

Rohdaten:

- [Ausgangsmessung](datapoint-cache-memory-before.json)
- [Abschließende Messung der gebauten Runtime](datapoint-cache-memory-after.json)
- [Zusätzliche Messung der finalen kanonischen Quelle](datapoint-cache-memory-after-source.json)

Quellbindung SHA-256:

- Ausgangsquelle vor Patch: `d711fe89c9b9717d90270b051ab5368d96a9d887da6eb47caea7e59587af8b40`
- Finale kanonische Registry: `862669409b5b427e3bcd9a53137db81d3008375b8c1e8e555900a84db8d1fef4`
- Gemessene gebaute Registry: `63aeba3f3cfc4a58773f8bbdcd5780924994fb270d7e4bf7f3487b18f70d2efb`

Erneuter Komponentenlauf aus dem Repository:

```sh
node --expose-gc ui/test/unified/profile-datapoint-cache.cjs
```

Das optionale erste Argument bezeichnet eine vorhandene Vergleichsmoduldatei. `--expose-gc` gilt ausschließlich für dieses isolierte Messprogramm, nicht als neue Adapter-Startoption.

## Nachweise und Grenzen

Die Regression umfasst fremde State-Fluten, aktive Werte, Alias-/Einheitenumrechnung, getrennte Messwert-/Heartbeat-Frische, Connected-Flags, gemeinsam genutzte Quellen, Umkonfiguration und erneutes Einlesen, nachträgliche Registrierung, sofortige Subscription-Ereignisse, Löschung/Wiederkehr sowie verspätete Quell- und Connected-DB-Antworten. Die tatsächliche gehostete Eingangsverarbeitung wird separat geprüft.

- [Ausgangsquelle: 11 Tests, 10 erwartete Fehler, 1 bestanden](datapoint-cache-before.tap). Diese Fehler zeigen den bisherigen Ressourcen-/Zeitordnungszustand; sie sind keine fehlgeschlagenen Freigabetests des korrigierten Stands.
- [Finale kanonische Registry: 11/11 bestanden](datapoint-cache-after-source.tap).
- [Gebaute Runtime einschließlich gehostetem Löschereignis: 12/12 bestanden](datapoint-cache-after-runtime.tap).

```sh
node --test ui/test/unified/datapoint-cache.test.cjs ui/test/unified/datapoint-cache-ingress.test.cjs
```

Ergänzende EMS-Regressionen, Gesamtbuild und Auslieferungsprüfung werden im [Release-Prüfbericht](PRUEFBERICHT.md) dokumentiert. Ein mehrstündiger Messvergleich auf der tatsächlichen Anlage mit unveränderter Konfiguration, Start-/Ruhezustand und History-Nutzung steht aus. Aus diesen Komponentenprüfungen wird keine allgemeine Anlagen- oder Produktionsfreigabe abgeleitet.
