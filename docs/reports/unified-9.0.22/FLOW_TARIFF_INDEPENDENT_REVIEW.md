# Zusätzliche Quellprüfung Energiefluss und Tarif

Stand: 25.11.2026. Diese Gegenprüfung betrifft die neu geänderten Energiefluss-/Tarifpfade; keine unabhängige Zertifizierung und keine Anlagenabnahme.

## Nachverfolgte Reviewpunkte

| Punkt | Befund und abschließender Stand |
| --- | --- |
| Tarifstatus-Qualität | Frischer JSON-Inhalt mit ioBroker `q=64` zeigte zunächst weiterhin „Speicher lädt“. Reproduziert; korrigiert durch Qualitätsprüfung sowie äußeren und inneren Snapshotzeitstempel. |
| Dauerhafte PV-Reserve | Einzelne `tarifPvBlock`-States werden nur bei Änderung geschrieben. Reine Altersprüfung blendet eine dauerhaft aktive Sperre aus. Korrigiert: frischer atomarer Speicher-Policy-Snapshot wird als `pvReserve` im Tarifstatus übergeben; keine Reglerentscheidung geändert. |
| Zusätzliche Erzeugung | Frontenddiagnose benötigt denselben deduplizierten Umfang wie Backend. Die neue kanonische `derived.core.production.extraW`-Größe wird bevorzugt; explizites `null` fällt nicht auf Einzelwerte zurück. |
| Vorzeichenvertrag Verbraucher | Keine neue V2G-/Nettoverbraucherkonvention eingeführt. Bestehende EV-/Verbraucher-Betragskonvention für Gebäudeaufteilung bleibt erhalten; import/export und charge/discharge werden am jeweiligen Zweig netto angezeigt. |
| Abgeleitete PV-Zustände | Gegenprüfung verlangte identisches `null`-/Beobachtungszeit-Verhalten in ioBroker-States und API-Cache sowie Erhalt von Qualität und Originalzeitstempel im Auto-PV-Cache. Umsetzung und Tests werden im Backendbericht nachgewiesen. |
| Schutzgrenzen | Geprüfte Frontend-/Tarifänderungen ändern keine Anschluss-, SOC-, Geräte-, §14a- oder Lizenzgrenzen. Der Tarif-Namespace-Fix verwendet den tatsächlichen Laufzeitnamespace; explizite Konfiguration bleibt vorrangig. |

## Ergänzender Nullwertfehler in der Speicherregelung

Die neue unbekannt-Markierung der Gebäudeleistung muss auch von den Verbrauchern korrekt behandelt werden. In `storage-control.ts` wandelte `readCacheNumber` nach leerem Helferergebnis einen Cachewert `null` erneut mit `Number(null)` in 0 W um. Dadurch konnte der Fenecon-Lastpfad eine erfundene Null als erste gültige Quelle wählen, statt die echte nächste Messung oder den bestehenden NVP-/Batterie-Fallback zu verwenden. Der direkte Cachefallback des unabhängigen PV-/Last-Feed-forward besaß denselben Fehler; Boolean- und Leerwerte konnten ebenfalls als Messung gelten.

Die drei engen Änderungen verwenden die bereits vorhandene Funktion `strictFiniteNumber`. Gültige numerische Werte einschließlich echter 0 bleiben erhalten. Messquellenpriorität, Fallbackformel, Netzladenfreigaben und Schutzlimits bleiben unverändert. Keine neue Abhängigkeit.

Geänderte Quelle: `ui/src-ts/runtime-executables/ems/modules/storage-control.ts`.
SHA-256 der geprüften Quelle: `3267de75713412a0052817f258d707f19195cd213c23c5e11ebfc8b2989eb816`.
Die auslieferbare JavaScript-Datei wird durch den gemeinsamen abschließenden Runtime-Sync erzeugt und dessen Gleichstand geprüft.

## Fokussierter Nachweis

`node --test test/eos-storage-nullable-flow.test.cjs`: **4/4 bestanden**, 0 ausgelassen, Node.js 24.22.3. Prüft reale aus der Quelle extrahierte Cache-/Fenecon-/Feed-forward-Funktionen; keine Hardwarebefehle. Dieselben neuen Tests gegen die Git-Ausgangsquelle schlagen erwartungsgemäß fehl (Exit 1), womit die Regression vor der Korrektur belegt ist.

- `raw/backup-followup/storage-nullable-flow.tap`: korrigierter Stand.
- `raw/backup-followup/storage-nullable-before.tap`: reproduzierter Ausgangsfehler.

Vorhandene breitere Regelungstests und das abschließende Runtime-Artefakt werden durch den zentralen Releaseprüflauf bewertet. Diese Notiz erklärt keinen fremden Testlauf nachträglich als selbst ausgeführt. Reale Gerätewirkung, Messpunktzuordnung auf Dominiques Anlage und Dauerbetrieb bleiben gesonderte Abnahmen.
