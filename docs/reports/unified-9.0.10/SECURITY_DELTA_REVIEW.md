# Sicherheits-Deltareview: NexoWatt EOS 9.0.10

Stand: 23.11.2026. Geprüft wurden die SmartHome-Erweiterungen gegenüber 9.0.9: vollständige Bedienprofile, automatische Erkennung, manuelle Zuordnungen, verknüpfte ioBroker-Aliasse, Zusatzansichten, Geräte-/Raumdarstellung und die zugehörigen API-Grenzen. Dies ist ein quellbezogener Entwicklungs- und Regressionsnachweis, keine vollständige Produktprüfung, unabhängige Zertifizierung oder CRA-Konformitätserklärung.

## Bewertungsmethode und Nachvollziehbarkeit

Die tatsächlichen Runtime- und Adminquellen wurden mit dem unverändert aktivierten UI-Sicherheitsregelsatz inventarisiert. Verwendet wurden Node.js 24.22.3, die UI-Installation von ESLint 10.13.0 und die vom Gate eingebundene UI-TypeScript-Version 5.8.3. Der komplette neue Befundumfang wurde an den konkreten Quellstellen und ihren Datenflüssen nachgelesen. `noInlineConfig`, die verpflichtenden Security-Regeln sowie die Sperre für neue `any`-/Typunterdrückungs- und Parserbefunde bleiben wirksam. Die strikten Geräte-, Alias-, Zusatzansichts- und Layoutmodule wurden zusätzlich in die Typregelgrenze des Gates aufgenommen.

Die historischen Befunde wurden **nicht** als Fehlalarme neu eingestuft. `ui/docs/security/eslint-legacy-baseline.json` bleibt unverändert; SHA-256: `c7fd7ea7039fdfff2c3f7e00abcbc00b76f4984c1f612edcf73bddaf62d8a3b9`. Der vorherige Stand enthielt 2.955 aktuell passende historische Fundstellen. Geänderte oder entfallene Fundstellen werden im neuen Scan als abwesend ausgewiesen und gelten dadurch nicht pauschal als behobene Schwachstellen.

Individuelle Bewertungen stehen in `ui/docs/security/eslint-reviewed-findings.json`. Jede gilt nur für Regel, exakten AST-/Kontext-Fingerprint, Anzahl und den AST-Codehash der gesamten Quelldatei. Sie enthält eine konkrete Begründung und passende Testverweise. Die frühere Bewertung der tatsächlich noch vorhandenen Fundstellen in `main.ts`, `smarthome-import.ts`, `smarthome-config.ts` und `smarthome.ts` wurde erneut geprüft. Obsolete, nicht mehr auftretende individuelle Einträge werden entfernt; sie werden nicht auf neue Fundstellen übertragen. Keine Parser-, Typunterdrückungs-, `any`- oder allgemeinen Dateiausnahmen werden ergänzt.

## Neue heuristische Fundstellen

Die vollständige Einzelzuordnung erfolgt im genannten JSON-Inventar. Inhaltliche Gruppen:

| Bereich | Nachgeprüfte Grenze |
| --- | --- |
| Legacy-Vertrag und Bedienbrücke | Gruppen/Felder stammen aus festen lokalen Schreibpfadlisten. Rückmelde-IDs werden nicht zu neuen Schreibzielen erklärt. Tatsächliche Metadaten und aktuelle Rechte werden vor der Übergabe erneut geprüft. |
| Bedienkatalog und Feld-DTOs | Feste `readId`/`writeId`, `read`/`write`, `min`/`max`/`step` und `ts`/`lc`/`q`; geprüfte Profile und Slots. Enum-Zwischenspeicher hat keinen Prototyp. Die als Timing-Hinweis gemeldete Klimasperre vergleicht eine lokale Objektidentität, kein Geheimnis. |
| Erkennung und Herkunft | Lesender Zugriff auf begrenzte lokale Objektkennungen; Herkunftspfade mit festen Familien und Prototypsperre. Wetter-Regexp entsteht aus escaped Katalogtext plus einem festen, auf drei Ziffern begrenzten Index. |
| Alias-Erstellung | Feste Metadaten-/Pfadlisten, sichere JSON-Kopie, getrennte Lese-/Schreibprüfung, eigene vorhandene Herkunftsfelder und begrenzte Arrayindizes. Sprachkennungen haben höchstens fünf Zeichen und keine unbeschränkte Regex-Wiederholung. |
| Konfigurationseditoren | Feste Richtungs-/Bereichsschlüssel, explizite Prototypsperre, geprüfte Katalogschlüssel und Änderungen ausschließlich im lokalen Entwurf. Asynchrone Ergebnisse verlangen unveränderte IO-/Herkunft und erhalten aktuelle Raum-/Kundeneinstellungen. |
| Zusatzansichten und Layout | Begrenzte Arrayindizes bei Farben, Median und Diagrammen; feste Erzeuger-/Verbraucherlisten; ausschließlich eigene Labelmap-Einträge. Farb-Regexp ist auf sechs/acht Hexzeichen beschränkt. Layout liefert ausschließlich ID-/Reihenfolge-Patches innerhalb derselben Raumgruppe. |

98 neue Vorkommen wurden in 84 exakten Fingerprint-Einträgen bewertet. Mehrere Vorkommen desselben Ausdrucks sind jeweils über ihre Anzahl gebunden. Verteilung der neuen Bewertungen:

| Quelle unter `ui/src-ts/runtime-executables/` | Objektindex-Hinweise | Andere Hinweise |
| --- | ---: | ---: |
| `lib/smarthome-contract.ts` | 6 | 0 |
| `lib/smarthome-custom-contract.ts` | 2 | 0 |
| `lib/smarthome-device-aliases.ts` | 19 | 1 begrenzte Regex |
| `lib/smarthome-device-controls.ts` | 22 | 1 lokale Sperridentität |
| `lib/smarthome-device-detection.ts` | 2 | 1 erzeugte Katalog-Regex |
| `lib/smarthome-device-legacy.ts` | 2 | 0 |
| `lib/smarthome-import.ts` | 2 | 0 |
| `www/smarthome-config.ts` | 4 | 0 |
| `www/smarthome-custom-config.ts` | 16 | 0 |
| `www/smarthome-custom-views.ts` | 8 | 0 |
| `www/smarthome-device-config.ts` | 5 | 0 |
| `www/smarthome-device-controls.ts` | 0 | 1 begrenzte Regex |
| `www/smarthome-layout-editor.ts` | 6 | 0 |

Fünf frühere, nun abwesende individuelle Einträge wurden aus dem aktiven Review-Inventar entfernt: drei alte Cookiezugriffe in `main.ts` und zwei durch den erweiterten Importvertrag ersetzte Ausdrücke in `smarthome-import.ts`. Die entsprechenden neuen Importstellen wurden eigenständig bewertet. Die übrigen vorhandenen Bewertungen bleiben an ihre konkrete Stelle gebunden.

Im Review wurden zwei zusätzliche Robustheitsstellen korrigiert: Labelauflösungen im Editor verwenden nur eigene Map-Einträge; die kanonische Importtyp-Zuordnung verwendet eine `Map`. Geerbte Namen wie `constructor` oder `__proto__` liefern dadurch keine unerwarteten Objekt-/Funktionswerte. Hier wurde kein ausnutzbarer Prototypschreibpfad festgestellt; die Korrekturen vermeiden fehlerhafte Darstellung beziehungsweise Zuordnung bei beschädigten Metadaten.

## Geprüfte Sicherheits- und Funktionsgrenzen

- **Bedienbefehle:** Requests enthalten Geräte-ID, registrierten Feldschlüssel und skalaren Wert; die tatsächliche DP-ID stammt aus der gespeicherten Zuordnung. System-/Geheimnispfade, ungeeignete Rollen, nicht schreibbare Objekte, falsche Typen, Grenzen, Schritte und Enums werden abgewiesen. Jede Aliasstufe wird geprüft; Controller-Konvertierungen werden weder evaluiert noch umgeschrieben.
- **Aktuelle Freigabe:** Die Einbindung verwendet die bestehende EOS-Sitzungs-/CSRF-Grenze. Rolle, `frontend.open`, zentrale SmartHome-Lizenz, Aktivierung, Schreibzuständigkeit und Konfiguration werden vor der Geräteübergabe erneut geprüft. Alias-Erstellung erfordert `mapping.edit`; vor jedem Objektauftrag erfolgt eine erneute Prüfung. Entzug nach Teilanlage liefert vorhandene/unsichere Objektkennungen zur Prüfung zurück.
- **Physische Wirkung:** `accepted` bestätigt nur die Übergabe an ioBroker. Unbekannte, fehlerhafte oder entsprechend konfiguriert veraltete Rückmeldungen werden nicht als bestätigte Nullwerte ausgegeben. Momentary-Boolean sendet ausschließlich `true`; es gibt keinen erfundenen Rücksetzimpuls. Beschattungsschutz bleibt aktiv, auch wenn die Schutzquelle aus einem alten EOS-Feld stammt. Ein gültig zugeordnetes Stopp wird nicht durch eine Bewegungsfreigabe blockiert. Heiz-/Kühlsollwerte behalten ihre Reihenfolgeprüfung.
- **Begrenzte Arbeit:** Höchstens 128 Profilfelder, acht parallele Metadaten-/Statezugriffe je Kontext und 512 Zugriffe je Kontext; begrenzte Strings/DTOs. Commands und Stopps besitzen getrennte Kapazitäten. Schreibzeitüberschreitungen bleiben unbestätigt und werden nicht automatisch wiederholt. Der Controller bietet für bereits übergebene lokale Objekt-/Stateoperationen keinen allgemeinen Abort; ein HTTP-Abbruch ist keine Rücknahme.
- **Alias-Lebenszyklus:** Nur ausdrückliche Auswahl legt Objekte unter dem festen NexoWatt-Aliaszweig an. Quellen und Kollisionen werden vorgeprüft; vorhandene fremde Objekte werden nicht überschrieben. Eigene passende Aliasse sind wiederverwendbar. Bestehende Nutzeraliase und deren Konvertierungen bleiben erhalten. Die Operation schreibt keine Aktorwerte. Teilanlage ist bewusst möglich und wird berichtet; es gibt kein automatisches Löschen oder Wiederholen.
- **Bestandsdaten:** Die Importidentität berücksichtigt mehrere Controls derselben Quelle. Gemeinsame Diagnosedaten bilden keine Geräteidentität. Verwaltete Aliasse behalten die ursprüngliche Quellen-/Controlidentität. Manuelle Änderungen, Räume, Favoriten und Szenen-/Timerbezüge werden nicht ungefragt neu vergeben. Herkunftsbaselines werden bei Aliasumstellung nur geändert, wenn sie noch exakt der ersetzten bisherigen Zuordnung entsprechen.
- **History:** Nur bereits zugeordnete, erneut geprüfte Lesefelder werden abgefragt. Gleichzeitigkeit, Zeitraum, Rückgabemenge und Antwortverarbeitung sind begrenzt. Metadatenauflösung und History-Abfrage haben jeweils ein begrenztes Zeitbudget; dies ist keine Zusage einer einzigen fünfsekündigen Gesamt-HTTP-Deadline. Fehler führen zu lokalem Fehlerstatus statt Prozessabbruch.
- **Webausgabe:** Neue Textausgaben verwenden DOM-Methoden und `textContent`. Markdown-HTML wird nicht ausgeführt; Links/Bilder erlauben nur geprüfte HTTP(S)-/lokale URLs ohne Credentials. Webansichten sind sandboxed ohne `allow-same-origin` und ohne Top-Navigation. Explizit konfigurierte externe Medien/Webansichten können Browseranfragen auslösen; daraus entsteht kein zusätzlicher serverseitiger Abrufdienst. Die lokalen Wetteransichten lesen zugeordnete Datenpunkte und aktivieren keinen Wetteranbieter.

## Ausgeführte Nachweise

| Prüfung | Tatsächliches Ergebnis / Grenze |
| --- | --- |
| Kontrollprofile, Aliasse, Erkennung und Referenz-Parität | 104 Tests jeweils unter Node.js 22.23.4 und 24.22.3 bestanden. Darunter echte TypeDetector-6.2-Fixtures, Alias-Erstellung bis Wiedererkennung, unabhängige Kategorie-/Schreibfeldfixtures und fehlerhafte Rückmeldungen. Gerätezugriffe sind gemockt. |
| Nachprüfung kanonischer Importtypen | 16 Erkennungs-/Importtests nach der `Map`-Korrektur bestanden. |
| Gezielter Sicherheitslauf | 72 Tests unter Node.js 24.22.3 bestanden: lokale HTTP-Routen, Alias-API, Legacy-Brücke, Zusatzansichtsvertrag/-DOM und beide Mappingeditoren. Keine Fehler oder übersprungenen Tests. |
| Layout nach abschließender Fokuskorrektur | 11 Tests unter Node.js 24.22.3 bestanden, einschließlich geerbter Labels, Raumgrenzen, Entwurfskonflikten, Reihenfolgeerhalt und Tastaturfokus. |
| Sicherheitsgate-Regressionsprüfungen | 25 Policy-/Negativprüfungen bestanden, einschließlich Sperren für neue/unerlaubte Befunde. |
| Offizieller Quellen-Sicherheitslauf | Exitcode 0: 206 Quellen, 3.197 aktuelle Fundstellen, davon 2.952 historische offene und 245 individuell bewertete; keine neuen unbewerteten oder verbotenen Befunde. |

Gezielter Lauf:

```sh
node --test ui/test/unified/smarthome-device-api.test.cjs ui/test/unified/smarthome-alias-api.test.cjs ui/test/unified/smarthome-device-legacy.test.cjs ui/test/unified/smarthome-custom-contract.test.cjs ui/test/unified/smarthome-custom-views.test.cjs ui/test/unified/smarthome-device-config.test.cjs ui/test/unified/smarthome-custom-config.test.cjs
node ui/scripts/verify-eslint-security-test.cjs
```

Die Rohprotokolle `security-delta-behavior.log`, `security-layout-regression.log`, `security-policy-regression.log`, `controls-aliases-parity-final-node22.tap`, `controls-aliases-parity-final-node24.log` und `detection-after-map-review.log` werden im zugehörigen Release-Prüfpaket geführt. Softwaretests sind weder eine reale Hardwareabnahme noch ein Nachweis sämtlicher Endgeräte-/Browserabläufe.

Der abschließende offizielle Gate-Lauf wurde auf dem eingefrorenen Quellstand ausgeführt:

```sh
NEXOWATT_LINT_REPORT=/workspace/scratch/741f792566ea/setup-910/ui-security-final.json node ui/scripts/verify-eslint-security.cjs
```

| Messgröße | Ergebnis |
| --- | ---: |
| Geprüfte Quellen | 206 |
| Aktuelle Scannerfundstellen | 3.197 |
| Davon historische offene Fundstellen | 2.952 |
| Davon individuell bewertete aktuelle Fundstellen | 245 |
| Neue unbewertete oder verbotene Fundstellen | 0 |
| Historische, derzeit abwesende Fundstellen | 108 |

Rohdaten: `ui-security-final.json`; Ausgabe: `ui-security-final.log`. Drei zuvor aktive historische Fundstellen sind im neuen Quellstand abwesend; die Baseline wurde dafür nicht verändert. Die 2.952 verbleibenden historischen Fundstellen bleiben offene Scannerhinweise. Darin enthaltene alte Typunterdrückungs-/`any`-Befunde werden weder als neue Ausnahmen akzeptiert noch durch diesen Review freigegeben. Nach dem Gate wurden alle individuell gespeicherten Quelldatei-Codehashes nochmals gegen die Dateien geprüft: keine Abweichung.

## Verbleibende Grenzen

Die historische offene Scannerbasis bleibt sichtbar. Dieser Review ist kein vollständiger Review sämtlicher Bestandsmodule und ersetzt weder Abhängigkeits-/Geheimnisprüfung, Paket-/Buildintegrität noch die gesonderten Releasechecks. Reale Aktoren, Alias-Konvertierungen der konkreten Kundeninstallation, native Touch-Ereignisreihenfolgen, Hardwarelatenz, Dauerbetrieb sowie Update/Rückfall auf Kundenanlagen wurden hier nicht geprüft. Sie benötigen die zugehörige praktische Abnahme. Organisatorische, regulatorische und produktspezifische Konformitätsanforderungen werden durch diesen technischen Deltanachweis nicht vollständig abgedeckt.
