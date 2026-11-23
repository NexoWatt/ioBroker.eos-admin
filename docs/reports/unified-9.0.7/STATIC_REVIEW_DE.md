# Statische Einzelprüfung 9.0.7

Stand: 23.11.2026. Codeprüfung und ausführbare Scannerbefunde sind keine unabhängige Zertifizierung und kein vollständiger Schwachstellennachweis.

## Übernommene Review-Verweise

Der bisherige UI-Prüflauf enthielt noch Quellhashes aus UI 1.0.38, obwohl diese Dateien bereits im ausgelieferten gemeinsamen Adapter 9.0.6 geändert waren. Der aktuelle Code wurde erneut geprüft. Der Vergleich von `src-admin-tab/src/lib/adminConnection.ts` mit dem unveränderten 9.0.6-Lieferarchiv zeigt keine neue Änderung in 9.0.7. `copyJsonValue` schreibt ausschließlich nach Prototypschlüsselsperre in ein neu angelegtes Dictionary ohne Prototyp, mit Tiefen- und Knotenbudget. Der Scannerhinweis bleibt als begründeter Einzelreview erhalten.

Die weiterhin vorhandenen einzeln geprüften Diagnose- und Partner-Lesezugriffe in `main.ts` verwenden lokale Dictionaries ohne Prototyp oder feste interne Zustandsprojektionen. Alte separate Cookie-Zugriffe sind nach der Zusammenführung teilweise nicht mehr vorhanden; ihre historischen Einträge sind keine aktuellen Freigaben für andere Fundstellen. Die neuen Cache- und Namespaceänderungen erweitern diese Eingabewege nicht.

## Weitere einzeln geprüfte History-Hinweise

- `queryNumber`: ausschließlich lesender Zugriff mit den fest kodierten Namen `from`, `to`, `step`; Parameter können den Eigenschaftsnamen nicht bestimmen. Zahlen, Bereich, Zeitspanne und Raster werden vor History-Aufträgen validiert. Tests: `test/eos-history-api-stability.test.cjs` einschließlich ungültiger und mehrfacher Parameter.
- `_valueAtHold`: der Arrayindex entsteht ausschließlich aus ganzzahligen Grenzen der binären Suche, liegt vor dem Zugriff innerhalb der Arraylänge, und liest bereits normalisierte, sortierte Zahlenpaare. Keine frei gelieferten Eigenschaftsnamen und keine Objektmutation. Vorhandene History-/Preisreihen-Regression bleibt maßgeblich.
- `_nwNormalizeHistoryResult`: das verankerte Dezimalmuster trennt Ziffern, Dezimalpunkt und Exponent. Trotz verschachtelter optionaler Gruppen gibt es keine überlappende wiederholte Alternative: Punkt und Exponent können nicht Teil eines Ziffernblocks sein. Die Alternativen beginnen mit Ziffer bzw. Punkt. Ungültige Werte sowie nicht endliche Zahlen werden verworfen; der Scannerhinweis ist ein Prüfansatz, kein nachgewiesener exponentieller Laufzeitpfad.
- `year-report.ts / loadYears`: beide Eigenschaftszugriffe verwenden denselben vor `await` inkrementierten ganzzahligen Index innerhalb der auf zehn Jahre begrenzten Liste. Die Ergebnismenge ist ein neu angelegtes Array; kein Eingabestring wird zum Schreibschlüssel. Der vorhandene Test führt den tatsächlichen Quellblock aus und prüft zwei parallele Anfragen, alle zehn Jahre und deren Reihenfolge.

## Zusätzlich behobener Lizenz-Grenzfall

Die Featureprüfung verlangt jetzt eine eigene, explizit mit `true` belegte Editionseigenschaft. Geerbte Namen wie `constructor` und `__proto__` können keine Featurefreigabe mehr liefern. Die Featureantwort wird aus den tatsächlichen eigenen Einträgen erzeugt. Regression: `ui/test/unified/feature-grants.test.cjs`.

Die historischen offenen Scannerhinweise werden weiter separat inventarisiert. Eine erfolgreiche Regressionsprüfung bedeutet ausdrücklich nicht, dass dieser umfangreiche Altbestand frei von Sicherheitsbefunden ist. Der abschließende Lauf und seine tatsächlichen Anzahlen werden im Gesamtprüfbericht angegeben.
