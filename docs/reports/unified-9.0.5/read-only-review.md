# NexoWatt EOS 9.0.5 – ergänzendes Code-Review

Datum: 22.11.2026. Separater KI-Review der geänderten Hosted-HTTP-Grenze,
History-Verarbeitung und EMS-Datenpunktregistry. Kein externer Audit, keine
Zertifizierung und kein Test am Nutzergerät. Die Implementierung wurde im
Review nicht geändert; konkrete Befunde gingen an die zuständigen Bearbeiter.

## Geprüfte Änderungen

- **EOS-HTTP-QUERY-001:** Die Express-4-Query-Middleware erhält vor ihrem Lauf
  die inneren Request-/Response-Prototypen. Dadurch verhindert der geerbte
  Express-5-Getter nicht mehr ihre Initialisierung. Die aktuelle, gegebenenfalls
  umgeschriebene URL wird durch den vorhandenen Parser verarbeitet. Äußere
  Prototypen und ein vorhandener eigener Query-Deskriptor werden bei Rückgabe,
  Antwortende oder Verbindungsende wiederhergestellt. Lokale Promise-Behandlung
  erhält die vier Argumente von Fehler-Middleware und verändert keine globalen
  Express-Prototypen. Die bestehenden Authentifizierungs-/CSRF-Grenzen bleiben
  in der Routerkette.
- **HISTORY-905-02:** Eingaberaster, Provider-Zeilen, parallele Berechnungen und
  Antwortcache sind begrenzt. Callback-Ausnahmen und abgewiesene Transport-
  Promises werden lokal behandelt. Sämtliche Fallbacks einschließlich des
  zweiten EV-Energiepfads teilen das Zeitbudget; beide EV-Pfade verarbeiten
  höchstens acht Abfragen gleichzeitig. Fehlende führende Messintervalle
  bleiben unbekannt; gemessene Nullwerte bleiben gültige Nullwerte.
- **Preisabfrage:** Der binären Suche geht immer die Normalisierung und
  aufsteigende Sortierung voraus. Die obere Suchgrenze erhält den letzten Wert
  bei identischen Zeitstempeln sowie das Verhalten vor dem ersten Wert.
  Negative endliche Preise bleiben erhalten; bestehende fachliche Preisgrenzen
  wurden durch diese Optimierung nicht geändert.
- **EOS-MEMORY:** Der Wertecache behält nur aktuell referenzierte Mess-, Alias-
  und Verbindungsdaten. Gemeinsame Quellen werden erst mit ihrer letzten
  Zuordnung freigegeben. Verwandte Heartbeat-Ereignisse aktualisieren weiterhin
  ihren Zeitstempel, ohne deren fremde Nutzlast zu behalten.

## Gefundene und nachgebesserte Randfälle

Die erste Cachefassung konnte eine verspätete Datenbankantwort nach dem Wechsel
von Quelle A auf B nachträglich als erfolgreiches Priming von A markieren.
Beim späteren Zurückwechseln auf A hätte dadurch ein benötigtes erneutes Lesen
ausbleiben können. Die finale Fassung verwendet pro aktiver Quelle eine
Generation: nur die weiterhin aktuelle Generation darf einen gelesenen Wert
oder Priming-Status übernehmen. Ein Ereigniszähler verhindert zusätzlich, dass
ein inzwischen eingetroffener Livewert oder eine Löschung durch eine alte
Datenbankantwort ersetzt wird. Dies wurde für Quellen und Verbindungsflags
nachgeprüft.

Der Laufzeiteingang leitet Löschereignisse an die Registry weiter, ohne
wertverarbeitende Schnellregler-, NexoLogic- oder UI-Handler mit `null`
aufzurufen. Der bestehende Stopp- und Lizenzschutz bleibt erhalten. Die
ausgelieferte JavaScript-Fassung wird im zentralen Release-Lauf geprüft.

Im History-Pfad wurden beim Review außerdem das Verschlucken eines Fehlers im
optionalen Energiepfad und die Umwandlung führender unbekannter Rasterwerte in
Null angesprochen. Beide Pfade wurden korrigiert und durch spezifische
Regressionstests abgedeckt.

## Tatsächlich ausgeführte Review-Prüfungen

| Befehl | Ergebnis |
| --- | --- |
| `node --test test/eos-unified-http-router.test.cjs` | 6 bestanden, 0 fehlgeschlagen |
| `node --test test/eos-history-api-stability.test.cjs` | 17 bestanden, 0 fehlgeschlagen |

Die HTTP-Prüfung verwendet reale Express-5-/Express-4-Router und lokale
HTTP-Verbindungen. Die History-Prüfung führt den kanonischen Produktionshandler
mit kontrolliertem Provider und kontrollierter Zeit aus. Der allgemeine
Releasebericht führt die zusätzlichen Build-, Controller-, Lizenz-, Paket- und
Registry-Prüfungen samt Rohbelegen; diese werden hier nicht als eigene erneute
Messung ausgegeben.

## Bestehende Grenzen der Dateninterpretation

Die Aggregation einzelner Ladepunkte addiert weiterhin verfügbare Teilreihen,
auch wenn ein anderer Ladepunkt im Zeitraum keine vollständige Reihe liefert.
Die Tarifdarstellung verwendet weiterhin vorhandene manuelle beziehungsweise
Null-Fallbacks bei fehlender Tarifhistorie. Diese bestehenden Verhaltensweisen
wurden nicht pauschal als vollständige Datenqualitätsprüfung oder als exakte
Abrechnung freigegeben. Die Stabilitätskorrektur und die gezielte Behandlung
führender Messlücken ersetzen keine durchgängige Vollständigkeitskennzeichnung
aller abgeleiteten History-Daten.

In den oben geprüften Änderungen wurde nach den genannten Nachbesserungen kein
weiterer blockierender Fehler festgestellt. Zielgeräte-Dauerlauf, tatsächlicher
Gesamt-RAM-Verbrauch und Anlagenreaktionszeiten bleiben eigene Abnahmepunkte.
