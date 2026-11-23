# RAM-Prüfung und Cache-Korrektur 9.0.7

Stand: 23.11.2026. Ausgangspunkt: ausgeliefertes EOS 9.0.6. Nutzerbericht: rund 630 MB RSS, zuvor rund 750 MB. Kein Zugriff auf den laufenden Kundenrechner; diese Werte sind nicht selbst gemessen. Die nachfolgende Messung betrifft einen isolierten Cache, nicht den gesamten Adapter.

## Befund EOS-MEM-907-01

Die SmartHome-Geräteerkennung hielt nach ihrem ersten Aufruf eine zusätzliche vollständige Kopie aller ioBroker-Objekte im Speicher. Die vorgesehene Gültigkeitsdauer von 30 Sekunden wurde erst beim nächsten Aufruf geprüft. Bei inaktiver Seite blieb die Kopie unbegrenzt erhalten. Gleichzeitig eintreffende Anfragen konnten mehrere vollständige Datenbankabrufe auslösen. Auch die bereits auf vier Antworten begrenzte History-Antwortablage hielt abgelaufene Antworten bis zum nächsten Aufruf fest.

Der allgemeine Admin-Objektbestand wird bereits zwischen Admin und Socket geteilt. Diesen notwendigen Bestand oder bestehende Geräte-/Regeldaten zu entfernen, wäre kein funktionsgleicher Fix. Das Laden der ausführbaren Module allein zeigte in einem isolierten Ladeprofil rund 83 MB RSS; daraus lässt sich die Ursache der vom Nutzer gemeldeten Gesamtbelegung nicht eindeutig bestimmen.

## Änderung und Funktionserhalt

- Neue streng typisierte Hilfsdatei `ui/src-ts/runtime-executables/lib/ephemeral-cache.ts`: zeitbegrenzte Lesecaches mit tatsächlicher Freigabe im Leerlauf. Die Ablaufuhr ist monoton; höchstens vier History-Antworten, eine Erkennungsantwort und ein Objekt-Snapshot bleiben gleichzeitig zwischengespeichert.
- Unveränderte fachliche Gültigkeitsfenster: History fünf Sekunden, Geräteerkennung 30 Sekunden. Ein Zugriff verlängert das Fenster nicht. Laufende Geräteerkennung erhält ihre vollständigen Objekte weiter, auch wenn die Cache-Referenz zwischenzeitlich abläuft.
- Gleichzeitige Snapshot-Anfragen teilen einen laufenden Datenbankabruf. Ein ausdrücklich angeforderter neuer Abruf ersetzt die vorherige Cache-Kopie; Fehler lassen einen späteren Wiederholungsversuch zu.
- Beim Stop werden Cache-Timer und Referenzen entfernt. Verspätete Antworten dürfen die beendete Laufzeit nicht wieder befüllen.
- Bestehende Speicherdiagnose um reine Zähler ergänzt: History-Antworten, Erkennungsergebnisse sowie Snapshot vorhanden/lädt. Keine Objektinhalte, Zugangsdaten oder Kundendaten werden dafür protokolliert.
- Keine Änderung der EMS-Taktzeiten, Messwerte, Prioritäten, Datenpunkt-IDs, Schaltwege, History-Auflösung, Regelgrenzen oder Lizenz-/Zugriffsprüfung. Kein erzwungenes Garbage-Collecting im Produktbetrieb; kein RAM-Limit, das Funktionen abschaltet.

## Ausgeführte Prüfungen

Linux x64, Node.js 24.22.3. Automatisierte, synthetische Tests; keine Hardwareprüfung.

| Prüfung | Ergebnis / Beleg |
| --- | --- |
| Neun Cache-/Lebenszyklustests einschließlich tatsächlichem Produktions-Wrapper, Ablauf ohne Folgeabruf, parallelem Abruf, Fehlerwiederholung und Stop | Bestanden; `memory-history-tests.tap` |
| 17 bestehende History-Regressionen einschließlich Jahresbericht, 200 Ladepunkten, Timeouts, Fehlerantworten und begrenzter Parallelität | Bestanden; zusammen 26/26 Tests |
| Strenge TypeScript-Prüfung des neuen Helfers | Bestanden; `memory-types.log` |
| ESLint des neuen Helfers | Bestanden; `memory-lint.log`; keine globalen Regelabschaltungen |
| Isolierter Heap-Vergleich gegen die unveränderte 9.0.6-Quellfunktion, drei unabhängige Prozesse je Stand | `memory-cache-benchmark.json` |

Benchmark: 25.000 synthetische Objektdefinitionen mit vollständigem Metadateninhalt, ein Datenbankabruf, anschließend 1.000 Cache-Zugriffe, 30 Sekunden simulierte monotone Leerlaufzeit und explizite Garbage Collection ausschließlich im Test. Median des zusätzlichen, danach noch gehaltenen Heaps: vorher **49.189.632 Byte**, danach **41.992 Byte**. Differenz **49.147.640 Byte (46,9 MiB)**. Während aktiver Nutzung bleibt der volle Inhalt erhalten. In beiden Varianten blieb es bei einem Datenbankabruf für die Cache-Zugriffe. Gemessene mittlere Cache-Abfrage im jeweiligen Medianprozess: vorher ca. 0,0012 ms, danach ca. 0,0017 ms. Diese Mikromessung belegt keine Echtzeitgarantie und keine Beschleunigung der Gesamtanlage.

Reproduktion:

```sh
node --test test/eos-ephemeral-cache.test.cjs test/eos-history-api-stability.test.cjs
node_modules/.bin/tsc -p ui/tsconfig.ephemeral-cache.json
node tools/eos-memory-cache-benchmark.cjs --baseline /pfad/zur/9.0.6/ui/src-ts/runtime-executables/main.ts
```

Die unveränderte Baseline stammt aus dem bereits gelieferten 9.0.6-Repository. Das Benchmarkwerkzeug benötigt diesen Pfad bewusst als Eingabe und erzeugt keine angebliche alte Implementierung aus der neuen. Endgültige Quell-/Buildhashes werden mit dem Gesamtlieferstand versiegelt.

Der übergreifende UI-Sicherheits-Lintlauf wurde nach Einzelprüfung der geänderten Stellen erneut ausgeführt: 187 Quelldateien, 3.097 inventarisierte Hinweise, davon 2.955 historisch offen und 142 einzeln bewertet; keine neuen blockierenden Hinweise. Dies ist kein mängelfreier Gesamtscan. Einzelbewertung und Regressionstest des zusätzlich behobenen Feature-Lookups stehen in `STATIC_REVIEW_DE.md`.

## Offener Anlagenvergleich

**EOS-MEM-907-02: Gesamter RSS-Verbrauch noch nicht auf Zielhardware vermessen.** V8 kann freigegebenen Heap für spätere Arbeit behalten; ein entfernter Cache muss deshalb die ioBroker-RSS-Anzeige nicht sofort im selben Umfang senken. Die obige Differenz darf nicht von den gemeldeten 630 MB abgezogen und als künftiger Gesamtbedarf zugesagt werden.

Für den Feldvergleich gleiche Anlage, gleiche Browserseiten und gleiche Geräteanzahl verwenden. Vorher/nachher nach zehn Minuten stabilen Betriebs RSS, Heap und CPU erfassen; anschließend History und SmartHome-Geräteerkennung öffnen und schließen. Nach mindestens 60 Sekunden die Werte nochmals erfassen. Lade-/Speicherregelung und Datenaktualität parallel beobachten. Bei weiter steigendem Heap ist ein geschütztes, bereinigtes Profil der tatsächlichen Anlage erforderlich; rohe Heap-Snapshots können Geheimnisse enthalten und gehören nicht ins Repository.

Freigabestatus dieses Teilumfangs: automatisiert geprüfter Teststand. Hersteller-/Kundenfreigabe und reale RAM-/Latenzmessung bleiben getrennte Nachweise. Verantwortlich für den Anlagenvergleich: NexoWatt.
