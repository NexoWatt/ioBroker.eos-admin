# Unabhängige Prüfung: SolaX Mode4-Rücklesewert

Prüfumfang: `deviceRuntime.js`, `deviceAliasSemantics.js`, `device-alias-semantics-v1.json`, zugehörige Tests sowie die tatsächlich verwendeten Aufrufer und Modbus-Lesegruppen. Vergleichsstand vor der Änderung: `audit-920/device-farm/before-mode-fix/`. Dies ist eine Code- und Simulationsevidenz, kein SolaX-Hardwaretest und keine Produktionsfreigabe.

## Vertrauensgrenze

Der additive Datenpunkt `aliases.v1.r.powerSetpointReadbackW` darf nur einen tatsächlich zurückgelesenen Sollwert in Watt darstellen. Die SolaX-Holdingregister ab 416 haben modusabhängige Bedeutungen. Die numerische Interpretation des Zielwortes allein reicht deshalb nicht. Der gültige Kontext muss Mode4 sein und zum selben Lesevorgang gehören. Ein erfolgreicher ioBroker-Schreibauftrag, ein Modbus-Schreibtelegramm oder der letzte im Speicher gemerkte Befehl beweist weder diesen Rücklesewert noch eine physische Batteriereaktion.

## Bereits unabhängig nachvollzogene Eigenschaften

- Nur der verifizierte SolaX-Bindingeintrag fordert den zusätzlichen Lesekontext. FENECON, andere Geräteprofile und bestehende Leistungs-/SoC-Aliasse bekommen keine neue Modusbedingung.
- Der Descriptor-Abgleich prüft den Modus-Datenpunkt einschließlich Typ, Schreib-/Leseflag und exakter Quelle. Ein gleich benanntes angepasstes Fremdprofil erhält dadurch keine ungeprüfte Semantik.
- `_ackWrittenValue` lässt `deviceReadOnly`-Aliasse aus. Der optimistische Schreib-Ack des Rohdatenpunkts wird nicht als tatsächlicher Sollwert-Rücklesewert übernommen.
- Ein fehlender, ungültiger oder fremder Modus und ein ungültiger Zielwert bleiben unbekannt (`null`). Echte Null bleibt ein gültiger Messwert; der Wert einer Lade-/Entladebegrenzung von 0 W wird nicht zu „unbegrenzt“ geändert.
- Unverwandte schnelle Abfragen und Diagnose-/Cache-Snapshots erneuern den Timestamp des qualifizierten Rücklesewerts nicht. Die Zusatzmetadaten bauen keine neuen Schreibrechte auf und senden keine neuen Hardwarebefehle.
- Der reguläre SolaX-Leseplan enthält Mode4-Kontext und Zielwert gemeinsam im langsamen FC3-Block 416..420. Das allein beweist jedoch noch nicht den Fehler-/Splitpfad; siehe Befund unten.

## Zusätzliche Befunde der unabhängigen Prüfung

### Stop während einer laufenden Alias-Aktualisierung

Eine vorher gestartete `_updateAliases`-Verarbeitung kann an einer früheren Datenbankoperation warten und nach `stop()` fortlaufen. Die erste Fassung mit bloßer Nullsetzung beim Stop war deshalb als Grenze unzureichend. Der zuständige Implementierer ergänzte eine eigene Generation für qualifizierte Aliasse und das Abwarten bereits abgesendeter qualifizierter Datenbankwrites vor abschließender Invalidation. Eine unabhängige Pause→Stop→Fortsetzung-Probe lässt den Rücklesewert nun bei `null`. Beide Reihenfolgen sind nun geprüft: Pause vor dem qualifizierten Alias sowie bereits abgesendeter, verspätet abgeschlossener Datenbankwrite. Bestätigter Stop wartet auf letzteren und invalidiert danach; die alte Operation stellt keine numerische Rückmeldung wieder her.

### Modus und Ziel aus getrennten Antworten

Die erste Fassung prüfte nur zwei Felder im selben zusammengefassten Poll-Ergebnis. Der Modbus-Treiber kann durch adaptive Fehlerbehandlung oder `isolateReadDatapoints` daraus getrennte Antworten machen. Unabhängig reproduziert: FC3 416/1 liefert Mode4; FC3 417/2 liefert bereits eine Mode8-Wortbelegung `[1,500]`; die ursprüngliche Zusatzlogik erzeugte daraus fälschlich 32.768.001 W. Das ist eine echte Grenze der ersten Implementierung, kein bewiesener Ablauf auf der Kundenanlage. Die Korrektur versieht jeden tatsächlichen Register-Reply intern mit einer eigenen Herkunftskennung in einer WeakMap, gebunden an das konkrete Ergebnisobjekt. Nur gleiche Kennungen qualifizieren Mode4 und Ziel. Adaptive Aufteilung, isolierte Reads und kleinere Gruppen bleiben deshalb unbekannt. Eine kopierte oder serialisierte Werteablage übernimmt keinen Herkunftsnachweis. Im unveränderten unabhängigen Repro ist das Ergebnis jetzt `null`; ein regulärer gemeinsamer Reply bleibt numerisch verfügbar.

## Abschlussstatus

**Unabhängige, begrenzte Codeprüfung abgeschlossen.** Beide gemeldeten Zusatzbefunde sind korrigiert und nachgeprüft. 24/24 fokussierte Tests bestanden unabhängig unter Node.js 22.23.4 sowie 24.22.3, jeweils ohne Fehler oder Skip. Die strikte Alias-Typprüfung und das bestehende enge Sicherheitslint für Aliassemantik, Freshness und den neuen Herkunftshelfer sind erfolgreich. Exakte Quellhashes, Kommandos und Rohprotokolle: `raw/independent-solax/review-receipt.json` und die dort genannten Logs. Das ist keine pauschale Aussage über alle historischen Runtime-/Treiberbefunde.

Die zusätzliche Prüfung der numerischen BMS-Grenzen zeigt: Die schon zugeordneten, rein lesbaren Quellen für `allowedChargePower` und `allowedDischargePower` werden in die bestehende schnelle Leseauswahl aufgenommen. Im SolaX-Fall bleibt deren Takt 3 Sekunden; der vollständige Registerplan wird nicht auf diesen Takt beschleunigt. Dadurch wird der schnelle Leseumfang um diese Quellen erweitert, ohne neue Timer oder Registerschreibvorgänge. Ein echter unveränderter Wert erneuert seine Frische; ein fehlgeschlagener, übersprungener oder unverwandter Read tut das nicht. Echte 0 W bleiben eine BMS-Sperre.

Der getrennte Mode4-Zielrücklesewert bleibt im regulären langsamen Plan (SolaX 60 Sekunden). Er wird nicht als physische Leistungsreaktion ausgegeben. Die Farm-Response-Prüfung verwendet schnelle tatsächliche Leistungswerte. Farm-Regelung, BMS-Grenzen, Lizenzprüfung und Schreibberechtigungen werden nicht umgangen. Der gemeldete physische Fall `storage-response-timeout` ist durch diese Code-/Loopbacktests nicht als auf der Kundenhardware behoben nachgewiesen; dafür bleiben reale aktuelle Rückmeldungen und der Inbetriebnahmetest erforderlich.
