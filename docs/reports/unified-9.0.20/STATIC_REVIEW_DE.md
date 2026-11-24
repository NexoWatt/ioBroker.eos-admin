# Begrenzte statische Einzelprüfung für EOS 9.0.20

Stand der abschließenden Quellprüfung: 24.11.2026, 19:52 UTC; erste Einzelreviews um 19:13 und 19:30 UTC. Vergleich: versiegelte Quelle 9.0.19 gegen den Arbeitsstand 9.0.20. Die Prüfung umfasst die neun vorhandenen Einzelbewertungen für `ui/src-ts/runtime-executables/main.ts` sowie die zusätzliche Tarif-Frischeänderung im Energie-Wertkonto. Sie ersetzt weder die vollständigen Releaseprüfungen noch die Inbetriebnahme an realen Geräten.

## Ergebnis und Bindung an den geprüften Stand

Die neun vorhandenen Einträge ergeben weiterhin dieselben neun Fingerprints mit insgesamt zehn Fundvorkommen. Die untersuchten Eingabegrenzen, die Herkunft der Schlüssel und die Beschränkung der Operationen sind erhalten geblieben. Es wurde keine neue Ausnahme hinzugefügt und keine bestehende Regel abgeschaltet. Diese Aussage gilt für die unten einzeln aufgeführten Fundstellen; sie ist keine Freigabe aller historischen Scannerfunde.

| Nachweis | Wert |
| --- | --- |
| Quellpfad | `ui/src-ts/runtime-executables/main.ts` |
| SHA-256 der tatsächlich gelesenen Datei | `9239ab952d7881293ab8c14a6f06ebf9e5ae01cbe6b33bf30737e9cc2b8a3197` |
| SHA-256 nach der vom Security-Prüfer verwendeten TypeScript-Code-Normalisierung | `4c35d68d51a13b211897bae9b87ecf9abb960c0a488e0a195e18d20034aee6c8` |
| Bisherige Codebindung in der 9.0.19-Einzelbewertung | `2d9a9d6abbdc4993b6d51fb1e4fa74d9dac80774ffed728816467ea3b21820a0` |
| Scanner | UI-eigenes ESLint 10.13.0, `ui/scripts/verify-eslint-security.cjs` |
| Maschineller Fingerprintvergleich | `raw/main-individual-review-final.json`, 24.11.2026 19:51:57–19:52:01 UTC |

Der Prüfhelfer wurde mit dem ESLint aus dem UI-Projekt geladen. Ein anfänglicher Vergleich mit der im übergeordneten Projekt aufgelösten Version 9.38.0 erzeugte nicht vergleichbare Fingerprints; er wurde nicht als Codefehler oder Freigabenachweis verwendet. Der gültige Nachweis nennt ausdrücklich Version 10.13.0 und bestätigt alle neun Fingerprints. Die vollständige Releaseprüfung muss dieselbe Projektauflösung verwenden.

Die spätere Aktualisierung der Ganzdatei-Codebindung darf nur für die hier erneut geprüften neun Einträge erfolgen und erst nach Abschluss weiterer Änderungen an `main.ts`. Ändert sich der Quelltext nach diesem Bericht nochmals, ist der Delta-Nachtrag erforderlich. Der Bericht selbst verändert `eslint-reviewed-findings.json` nicht. Nach Bestätigung des abschließenden `main.ts`-Freeze wurde der obige Rohhash erneut direkt gegen die Datei geprüft; er stimmt exakt mit dem Scanner-Nachweis überein.

Der abschließende Scannerlauf über die ganze `main.ts` meldet **482 Funde: 472 weiterhin offene historische Funde und zehn individuell bewertete Vorkommen; keine neue blockierende Fundstelle**. 25 inventarisierte historische Vorkommen sind in diesem Dateiscope nicht mehr vorhanden. Daraus folgt keine neue Bewertung der verbleibenden historischen Funde. Der zwischenzeitlich tatsächlich blockierte neue Cachezugriff ist separat in `raw/main-individual-review-before-cache-boundary-fix.json` erhalten; nach der unten erläuterten eigenen Dateneigenschaftsgrenze ist er ohne neue Ausnahme beseitigt.

## Einzeln erneut geprüfte Fundstellen

Die Zeilen beziehen sich auf den oben genannten Arbeitsstand. Die vollständigen Fingerprints sind im maschinellen Nachweis enthalten; die Präfixe in der Tabelle sind eindeutig.

| Fingerprint-Präfix | Regel / Anzahl | Fundstelle | Erneut geprüfte Grenze und Entscheidung |
| --- | --- | --- | --- |
| `52846315efe5cb1f` | Object injection / 2 | Diagnosezähler, Zeile 22772 | `_nwMeshClassifyPeerError` liefert feste Fehlerklassen. Der Akkumulator wird ausdrücklich mit `Object.create(null)` angelegt. Die beiden dynamischen Zugriffe erhöhen ausschließlich diesen lokalen Zähler. Keine Prototyp-Setter oder Objektmutation außerhalb des Zählers. Bisherige Bewertung bleibt für diese Zugriffe gültig. |
| `284be3fe77000b1f` | Object injection / 1 | `_nwPartnerAppActive`, Zeile 4675 | App-ID stammt aus dem validierten Partner-App-Vertrag; `directMarketing` wird ausdrücklich auf `grid` abgebildet. Der Zugriff liest nur die lokale App-Konfiguration, anschließend müssen Installation, Aktivierung und Lizenz passen. Keine Erweiterung auf beliebige vom Partner übertragene Schlüssel. |
| `48c91c7b19c3c39d` | Object injection / 1 | Partner-Ressourcenverfügbarkeit, Zeile 4689 | Die Regelungsmodule führen die Verfügbarkeitsmap mit `Object.create(null)`. Die Ressource kommt aus der freigegebenen Partnerkonfiguration. Nur lesender Zugriff; ein echter Boolean sowie ein endlicher, nicht zukünftiger und höchstens 15 Sekunden alter Zeitstempel sind erforderlich. Farm bleibt vom Partner-Schreibpfad ausgeschlossen. |
| `012aeb1f3bb19074` | Object injection / 1 | Partner-`readState`, Zeile 4694 | Die tatsächlichen Aufrufer im `PartnerRuntime` verwenden feste Bilanz-, PV- und Netzleistungskennungen. Der Callback liest nur den Cache. Partnertext wird nicht als beliebiger Fremd-Datenpunkt an diesen Callback weitergereicht. |
| `a0f055d4076a53ef` | Object injection / 1 | Partner-`readTelemetry`, Zeile 4695 | Telemetriemap wird von den Regelungsmodulen mit `Object.create(null)` geführt. Der Zugriff ist an die freigegebene Ressource gebunden; die nachfolgende Projektion prüft Ressource, Gültigkeit, numerische Grenzen und tatsächliche Messzeitpunkte. Keine neue Schreibberechtigung. |
| `f966fa825d8a063b` | Object injection / 1 | `/api/history`, `queryNumber`, Zeile 18464 | Aufrufe verwenden ausschließlich die festen Namen `from`, `to`, `step`. Akzeptiert werden Zahl oder Zahlenstring; leere/unzulässige Werte werden verworfen. Anschließend begrenzen sichere Ganzzahl-Zeitwerte, aufsteigender Zeitraum, positives Zeitraster und maximal 4096 Ausgabepunkte die Abfrage. Keine dynamische Zuweisung. |
| `3b107b890285ab2c` | Object injection / 1 | `_valueAtHold`, Zeile 18827 | Die Eingangspaare werden zuvor auf endliche Werte normalisiert und sortiert. Binäre Suche mit `low = 0`, exklusiver Obergrenze `high = length`, Schleifenbedingung `low < high` und ganzzahligem Mittelpunkt begrenzt den Leseindex. Keine Erweiterung auf freie Objektpfade. |
| `27297a9d7c7c8eb7` | Unsafe regex / 1 | History-Dezimalprüfung, Zeile 32989 | Verankerte Dezimalgrammatik mit getrennten Ziffern-, Dezimalpunkt- und Exponentsegmenten. Keine überlappend wiederholte Alternativgruppe. Historyantworten werden begrenzt verarbeitet und nicht endliche Ergebnisse verworfen. Die Regex und ihre Eingabeherkunft wurden durch die neuen Historyänderungen nicht erweitert. |
| `fcd35d67be3c6ad4` | Object injection / 1 | Discovery-Fehlerantwort, Zeile 14838 | Lokale feste Fehlercode-Map, dynamischer Lesezugriff ausschließlich nach `Object.hasOwn(errors, code)`. Sonst feste Antwort `EOS_DETECTION_FAILED`. Interne Ausnahmetexte und geerbte Eigenschaften werden nicht in die Antwort übernommen. |

## Geprüfte Änderungen außerhalb dieser neun Fundstellen

`initEmsEngine` verwendet im untersuchten Delta ein einzelnes ausstehendes Initialisierungsversprechen. Vor dem Austausch wird das Ende des vorherigen Motors abgewartet; bei unbestätigtem Stopp wird die alte Referenz nicht stillschweigend aufgegeben. Die zusätzliche `_nwIsEmsReady`-Prüfung verlangt einen aktiven Timer, keine Initfehlermeldung und keinen laufenden Rekonfigurationszustand. Startstatus, Status-API, unmittelbare Regelanforderung und Partnerfreigabe verwenden diese Prüfung. Eine nur noch zur Bereinigung aufbewahrte Engine gilt dadurch nicht als betriebsbereit. Die bestehenden neun Eingabegrenzen werden dadurch nicht erweitert; die Partnerfreigabe wird enger. Laufzeitnachweise für Zeitüberschreitung, Fehler und parallele Neukonfiguration sind im gesonderten `DEVICE_PLAN_REVIEW.md` geführt.

Die neuen History-Schreibprüfungen verwenden `numericMeasurement` und tatsächliche Zeit-/Qualitätsinformationen. Fehlende, leere oder boolesche Werte werden nicht mehr allein durch `Number(...)` in Null umgewandelt. Stale-Farmwerte werden bei der untersuchten Schreibstelle nicht als aktuelle Messung geschrieben. Der neue lokale Leser beschränkt Cachekennungen auf 1–256 zulässige Zeichen, weist Prototypkomponenten ab und liest ausschließlich eigene Dateneigenschaften über Property-Descriptoren. Geerbte Cacheeinträge sowie Getter an Eintrag, Zeitstempel, Messwert und Qualität werden abgewiesen, ohne sie auszuführen. Die ursprüngliche neue dynamische Indexstelle wurde durch diese tatsächliche Begrenzung korrigiert; eine zusätzliche Scanner-Ausnahme wurde nicht angelegt.

Der während der ersten Prüfung gemeldete nachgelagerte Hold-last-Fehler ist im späteren Delta für kanonische periodische Leistungs-/SoC-Reihen korrigiert: Das Fortschreibefenster ist auf das konfigurierte Exportintervall beziehungsweise einen gröberen Abfrage-Bucket begrenzt. Die Ladepunktsumme erfordert jeden konfigurierten Teilnehmer je Zeitpunkt. Die dafür gelesenen Handler-/Frontend-Regressionen prüfen Ausfall, echte Null bei Wiederkehr, abweichende Exportkadenz, unvollständige Summen und getrennte Canvaspfade. Eigene alte Sparse-Mappings und auf Änderung gespeicherte Tarife behalten ihr separates Verhalten. Das ist keine Behauptung sekundengenauer Historie oder einer echten Browser-/Influx-/Hardwareabnahme. Eine Security-Einzelbewertung der neun Scannerfunde ersetzt diese funktionalen Grenzen nicht.

Zusätzlich wurden der gemeinsame serielle Lease-Helper, die finalen RTU-/ASCII-Freigabepfade und deren Einbindung in `ModbusDriver.disconnect()` gelesen. Die letzte Freigabe wartet auf bestätigten Schluss und gibt die exakte Reservierung erst danach frei. Fehlende Bestätigung hält den Anschluss reserviert. Identische Konfigurationen bleiben teilbar; unterschiedliche Konfigurationen/Protokolle konkurrieren über denselben prozesslokalen Pfad. Dies ist weder ein Betriebssystem-Lock noch eine Abdeckung fremder Prozesse oder unterschiedlicher Symlinknamen. Der gesonderte `SERIAL_LIFECYCLE_REVIEW.md` enthält die tatsächlichen gemeinsamen Node-22-/24-Tests; dieser Nachtrag behauptet keinen zusätzlichen physischen RS485-Test.

## Separater Viertelstunden-Tarifbericht

Beim unabhängigen Lesen fiel zusätzlich auf, dass `/api/tariff/report` außerhalb des bereits korrigierten `/api/history` weiterhin fehlende Werte zu Null umwandelte, negative Preise unter −5 EUR/kWh kürzte und den Abfrageumfang nicht begrenzte. Dieser konkrete Pfad wurde an den zuständigen Bearbeiter zurückgegeben und nach dessen Korrektur erneut gelesen.

Der geprüfte Endstand lehnt Objekte/Arrays, unzulässige Kalenderdaten, unsichere Zeitwerte, umgekehrte Zeiträume und Bereiche über 730 Tage vor Datenbankzugriffen ab. Der berechnete Viertelstundenumfang ist zusätzlich begrenzt. Bestehende periodische Viertelstunden werden über einen ganzzahligen Index einer lokalen Map und anschließend über `.at(i)` aus den selbst erzeugten Arrays gelesen. Summen wählen ausschließlich fest benannte Felder über lokale Callbacks. Weder neue freie Objektpfade noch Scanner-Ausnahmen wurden dafür eingeführt.

Fehlende Viertelstunden werden nicht aus einem früheren Viertelstundenwert aufgefüllt. Preise behalten ihr Vorzeichen; Werte und Kosten bleiben bei fehlender Quelle unbekannt. Ein konfigurierter Festpreis darf nur bei deaktiviertem dynamischem Tarif einspringen und wird als solcher ausgewiesen. Ein noch offenes Intervall wird nicht mit einer vollen Viertelstunde als abgeschlossene Bezugsenergie verrechnet. Gesamtwerte erfordern vollständige beteiligte Werte; Coverage-Metadaten zeigen bekannte, fehlende und offene Intervalle. Der zuständige Bearbeiter bestätigte nach dem Freeze 22/22 fokussierte Tarifprüfungen unter Node 22 und Node 24, einschließlich neun neuer Fälle am echten Handler sowie an Frontend/CSV. Die Oberfläche zeigt unbekannte Werte und leere CSV-Felder, die neuen Coverage-Metadaten und offene Viertelstunden an; Null- und Negativpreise bleiben erhalten. Diese Laufzeitergebnisse werden im gesonderten Tarifbericht-Nachweis dokumentiert und sind kein zusätzlicher, hier behaupteter eigener Gesamttest.

## Nachtrag: Farmdiagnose nach dem konkreten 1-%-/98-%-Anlagenhinweis

Die zusätzliche, ausdrücklich beauftragte Farm-Diagnoseänderung wurde vom Bearbeiter dieses Berichts implementiert und anschließend **unabhängig vom zuständigen Inbetriebnahmeprüfer (`audit_commissioning`) im vollständigen Delta gelesen**. Der vorherige Stand bleibt als Vergleichsnachweis erhalten. Die Zweitprüfung bestätigte: Nur Ergebnis-/`lastDispatchJson`-Projektion nach der Allokation wurde geändert; keine Eligibility-, Sollwert-, Verteil- oder Hardware-Schreibregel wurde verändert. Die bereits gültigen neun Security-Eingabegrenzen liegen außerhalb dieses Deltas und bleiben unverändert.

Die Diagnose unterscheidet jetzt vorhandene Statusfähigkeit von der Richtungszulassung des konkreten Auftrags, gibt den wirklich verwendeten Entlade-Floor und die daraus verbleibende Leistung aus, hält fehlenden SoC als unbekannt und ordnet Ergebnisse über die bestehende stabile Dispatcherkennung zu. Ausschlussgründe entstehen ausschließlich aus dem tatsächlich ausgeführten Floorfilter. Die geänderte Summierung betrifft nur den Diagnosewert `lastDispatchJson.availableDischargePowerW`, nicht die vom Regler gelesenen Livezustände. Die neue Berechnung setzt weder neue dynamische Objektpfade noch zusätzliche Scanner-Ausnahmen ein.

Der tatsächliche erzeugte Runtimepfad besteht acht neue Diagnosefälle jeweils unter Node 22.23.4 und 24.22.3; belegt sind unveränderte Writes bei 1 % / 98 %, umgekehrten SoCs/Statusreihen, fehlendem SoC, 0-W-Limit, Entladeverweigerung sowie Laden/Idle. Die vor dem Fix beobachtete grundsätzliche Umverteilung funktionierte bereits. Ein physischer `storage-response-timeout` ist dadurch weder behoben noch ignoriert. Details und Befehle: `FARM_DISPATCH_REVIEW.md`, `raw/farm-dispatch/`. Der aktuelle Gesamtdatei-Scannerlauf oben wurde nach dieser unabhängigen Zweitprüfung wiederholt und bestätigt weiterhin dieselben neun Fingerprints/zehn Vorkommen ohne neue Blocker.

## Energie-Wertkonto: explizit ungültigen Tarif nicht wiederbeleben

Die Änderung in `ui/src-ts/runtime-executables/ems/modules/energy-wallet.ts` berücksichtigt zusätzlich `tarif.currentPriceFresh`. Ein explizites `false` verhindert, dass ein kürzlich geschriebener Budget-, Provider-, History- oder Legacy-Spiegel einen ungültigen dynamischen Tarif wieder als aktuell erscheinen lässt. Das Wertkonto wechselt auf den festen Netzstrompreis und zeigt den Grund an. Preis- und Zeitstempelvalidierung der Kandidaten bleibt bestehen.

Der Schlüssel ist fest codiert und wird ausschließlich lokal gelesen. Die Änderung eröffnet keine zusätzlichen Hardware-Schreibrechte, Netzwerkziele oder Zugänge. Legacymappings ohne dieses Flag bleiben kompatibel; gültige Nullpreise und negative Preise bleiben zulässig. Das heißt zugleich: Eine Legacyquelle ohne Frischeflag wird weiterhin über die bereits vorhandenen Kandidaten-Zeitprüfungen bewertet. Die Änderung ergänzt diese Prüfung, sie ersetzt sie nicht.

Der fokussierte Test wurde unabhängig gegen das vorhandene erzeugte Laufzeitmodul ausgeführt:

| Prüfung | Ergebnis |
| --- | --- |
| `node --test test/eos-customer-tariff-wallet-freshness.test.cjs` | 2 Tests bestanden, 0 fehlgeschlagen, 0 übersprungen |
| Laufzeit | Node.js v24.22.3 |
| Zeitpunkt | 24.11.2026 19:13:39 UTC |
| Nachweise | `raw/wallet-freshness-independent.tap`, `raw/wallet-freshness-independent.result.json` |
| Prüffälle | Explizit ungültige Quelle über sechs Cachepfade mit Null-, negativen und positiven Preisen; gültige Null-/Negativpreise; Legacyquelle ohne Flag |

Dieser kleine Test ist kein erneuter vollständiger Build- oder Hardwaretest. Die Übereinstimmung von TypeScript und ausgelieferten JavaScript-Dateien bleibt Aufgabe der abschließenden Build-/Releaseprüfung.

## Tatsächlich eingesehene Quellen

- 9.0.19-/9.0.20-Diff und betroffene Kontexte in `ui/src-ts/runtime-executables/main.ts`.
- `ui/src-ts/runtime-executables/lib/partner-runtime.ts` einschließlich der tatsächlichen Callbackaufrufe und Telemetrieprojektion.
- `ui/src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts` und `storage-control.ts` für Herkunft und Erstellung der beiden Partner-Maps.
- `ui/src-ts/runtime-executables/ems/modules/energy-wallet.ts` einschließlich Kandidatenwahl, Zahlen-/Zeitprüfung und booleschem Frischeflag.
- `ui/docs/security/eslint-reviewed-findings.json` und `ui/scripts/verify-eslint-security.cjs` einschließlich Fingerprintbildung, Codebindung, Policyprüfung und Behandlung historischer offener Funde.
- `test/eos-customer-tariff-wallet-freshness.test.cjs` und dessen oben dokumentierte Ausführung.
- Neue tatsächliche Handler-/Messwert-/Canvasfälle in `test/eos-history-api-stability.test.cjs`, `eos-history-measurement-integrity.test.cjs` und `eos-history-chart-gaps.test.cjs`.
- `modules/devices/lib/drivers/modbusSerialLease.js`, finale `releaseBus`-/Schließpfade von `modbusRtuBus.js` und `modbusAsciiBus.js` sowie deren Aufrufe in `modbus.js`; zugehöriger serieller Bericht und Testnachweise.

## Grenzen der Aussage

Historische offene Scannerfunde bleiben historische offene Funde. Der Vergleich fügt ihnen keine pauschale Freigabe hinzu. Es werden weder eine vollständige Sicherheitsbereinigung des Legacycodes noch CRA-Konformität, Zertifizierung, Kundeneinsatzfreigabe oder vollständige Hardwareabnahme behauptet. Reale Gerätekommunikation, EMS-Aktorreaktionen, Speicherfarm-Leistungsbilanz, zertifikatsvertrauende Endgeräte, Migration bestehender Kundenstände und längerer Speicherverbrauch sind separat zu prüfen. Die konkreten Inbetriebnahmekriterien stehen in `ANFORDERUNGEN_UND_INBETRIEBNAHME.md`.


## Abschließende Nachprüfung nach Farm-Capability- und ACK-Korrekturen

Maßgeblicher Stand dieser Nachprüfung: 24.11.2026, **20:09:23 UTC**. Er ersetzt die zuvor in diesem Bericht genannten Hashbindungen für `main.ts`. Die neun einzeln begründeten Main-Fingerprints mit insgesamt zehn Vorkommen bleiben exakt erhalten; keine neue Ausnahme und keine zusätzliche Fundstellenmenge wurde zugelassen. Alle neun ursprünglichen Schlüssel-/Array-/Regexgrenzen wurden erneut gegen die zuletzt geänderten Bereiche abgeglichen.

| Datei | SHA-256 Quelltext | SHA-256 normalisierter TypeScript-Code |
| --- | --- | --- |
| `src-ts/runtime-executables/main.ts` | `5d9867b31d26f10b2cbfe36266fee8c789b9da354f406e064f944513d1b7ac09` | `4515a710303934adcfbfc1a4ce2dc5bd36ac61a97fe5b0c147fe5819687c8680` |
| `src-ts/runtime-executables/www/ems-apps.ts` | `16957513881167c7ea26b109d6c49bf5ee9008d776ffd4f2d6f2a3e5a2c1f160` | `c50c265067b5e7842476f0695b4d13dcdc167045ee50c6919e07b6982b59164f` |
| `src-ts/runtime-executables/ems/modules/storage-control.ts` | `2b2fc6d9dc48f7d669636c365bf7645ffa4d9b68c7e706f6df02ebc4a412a1e2` | `3ad17dedda485a7ea39b4f908237a4cbf8cd878cb4694194e3bdff7b8109dc2e` |

Auch die **eine bereits einzeln geprüfte** Fundstelle in `ems-apps.ts` (`ff4d3b090dd8a7735a9c7a9086d7cb0d8d55cf800a4a42c2578b8598c17fc383`) bleibt unverändert: Der ausgewählte Speicherindex wird vor dem Rendern ganzzahlig auf die lokale Liste begrenzt; der Eigenschaftsname ist unverändert das Literal `pvPowerId`. Die neuen Capability-Felder verwenden feste Eigenschaftsnamen und begrenzte Arrayauswahl. Die vorhandene Hashbindung dieser einen Fundstelle muss deshalb ebenso wie die neun Main-Bindungen auf den erneut geprüften Quelltextstand aktualisiert werden. Der Prüfer hat die Ausnahme-Datei nicht verändert.

### Geänderte Pfade tatsächlich gelesen

- `main.ts`: Farm-Normalisierung, numerische Capability-Leser, richtungsbezogene Sperrgründe, native FEMS-Begrenzung vor Zielumrechnung, `_sfReadbackNumber`, `_sfWriteIfChanged`, aggregierte Kommandorückmeldung und `lastDispatch`. Konfigurierte Limits bleiben Obergrenzen; gebundene Gerätefreigaben können sie nur verkleinern. Echte 0 W sperren die betreffende Richtung. Fehlende/ungültige/veraltete gebundene Capability-Werte werden nicht zu unbegrenzter Leistung. Ohne neue Bindung wird keine solche Capability erfunden.
- Aktuelle ACKs erfordern passenden Wert, `ack:true`, zulässige Qualität und aktuellen Zeitstempel. Passende `ack:false`-Aufträge heißen nun ausstehend. Ein übergebener Auftrag wird nicht als gemessene Leistungsreaktion bezeichnet. Die zunächst verbliebene `Number(null)`-Umwandlung in der Readback-Projektion wurde bei dieser unabhängigen Prüfung gemeldet und vor dem abschließenden Scan korrigiert; der zugehörige reale Projektionsfall ist Bestandteil der ACK-Regression.
- `ems-apps.ts`: feste neue Capability-Felder, unveränderte Auswahlgrenze der einzigen bisherigen Einzelfundstelle. `storagefarm-dispatch.ts`: keine Scannerfundstelle; die Anzeige trennt konfiguriertes Limit, Gerätefreigabe und effektives Limit des konkreten Auftrags.
- Die vorausgegangenen History-/Tarifgrenzen und die neun bisherigen Einzelgrenzen werden durch diese Farm-/ACK-Änderungen nicht erweitert. Die Hashprüfung bindet trotzdem die gesamte geänderte Datei neu; eine spätere Quelländerung verlangt erneut Prüfung.

### Gesamter maßgeblicher UI-Quellumfang

Mit der tatsächlichen UI-Installation **ESLint 10.13.0** wurden alle **220** Quellen des bestehenden Sicherheitsgatters geprüft. Ergebnis: **3.200** Scannerfundstellen, davon **2.929 historische offene** und **271 bereits einzeln geprüfte Vorkommen**, **0 neue/gesperrte** Fundstellen; 131 alte Vorkommen sind nicht mehr vorhanden. Während der Prüfung änderte sich keine gescannte Datei. In Main verbleiben 482 Vorkommen (472 historische offene, 10 einzeln geprüft), in `ems-apps.ts` 287 (286 historische offene, eines einzeln geprüft), in `storage-control.ts` sechs historische offene, in `storagefarm-dispatch.ts` keines.

Rohbeleg: `raw/final-ui-independent-review.json`; aktuelle Main-Einzelbindung: `raw/main-individual-review-final.json`; vorheriger Prüfstand bleibt in `raw/main-individual-review-before-capability-ack.json` erhalten. Der Scan nutzt die vorhandenen Regeln und Inventare unverändert. Er beweist keine pauschale Bereinigung historischer Befunde, keine vollständige ASVS-/CRA-Erfüllung und keine physische Inbetriebnahme. Die reguläre Gate-Ausführung nach Aktualisierung ausschließlich der bereits einzeln geprüften Hashbindungen bleibt Teil der abschließenden Releaseprüfung durch den Build-Verantwortlichen.

## Offener Zusatzbefund: historischer Runtime-Mirror-Abgleich

Am 24.11.2026 um 20:19 UTC wurde `node ui/scripts/build-ts-runtime-mirrors.js --check` unabhängig in beiden Quellständen ausgeführt. **Beide Ausführungen scheitern mit Exitcode 1.** Der ältere parallele Baum `src-ts/runtime-mirrors` ist laut Generator kein produktiver Ausführungspfad; einige seiner Dateien enthalten bewusst manuell ergänzte Typverträge und dürfen nicht mit rohen JavaScript-Kopien überschrieben werden.

Für `core-limits` sind die maßgebliche Datei unter `src-ts/runtime-executables`, das erzeugte `ems/modules/core-limits.js` und der ältere manuell typisierte Mirror zwischen 9.0.19 und dem geprüften 9.0.20-Stand jeweils bytegleich. Dieser konkrete Paritätsbefund ist somit nachweislich bereits im Ausgangsstand vorhanden. Daraus folgt **nicht**, dass jeder aktuell gemeldete Mirror-Befund alt wäre: Das ältere Kommando meldet 68 Pfade in 9.0.19 und 69 im aktuellen Stand, davon 65 gemeinsam. Neu in der aktuellen Meldeliste stehen die nichtproduktiven Mirrors `www/history.ts`, `www/live-display.ts`, `www/storagefarm-dispatch.ts` und `www/tariff-report.ts`; drei ältere Meldungen entfallen. Vollständiger Vergleich: `raw/legacy-mirror-debt/diff.json`.

Die offenen Mirror-Abweichungen werden weder pauschal freigegeben noch durch eine Schweregradänderung versteckt. Der Prüfer hat keine manuell typisierten Mirrors überschrieben. Für den tatsächlich ausgeführten Code bleiben der Build und `build-ts-runtime-executables.js --check` verpflichtende, getrennte Nachweise. Die Root-Testkette (`test:unified`, `test:retained`, `test:modules`) ist von diesem historischen Zusatzkommando zu unterscheiden. Eine Aussage wie „alle TypeScript-/Mirror-Prüfungen bestanden“ wäre unzutreffend.

Belege mit exakten Hashes, Exitcodes und Rohprotokollen: `raw/legacy-mirror-debt/receipt.json`, `check-919.log`, `check-920.log`.


## Abschließende Einzelbindung nach direkter InfluxDB-2-Integration

Maßgeblicher Scanzeitraum: **2026-11-24T20:48:55.780Z bis 2026-11-24T20:49:20.413Z**, ESLint **10.13.0** aus dem UI-Projekt. Dieser Nachtrag ersetzt für die folgenden drei Dateien alle früheren Ganzdatei-Hashbindungen in diesem Bericht. Die tatsächliche Quellprüfung und der Scannerlauf erfolgten nach dem Freeze der Main-/Runtimeänderungen. Der Scanner hat während dieses Laufs keine Quelländerung festgestellt. Rohbeleg: `raw/influx-ui-independent-review-final.json`.

| Datei | SHA-256 Quelltext | SHA-256 normalisierter TypeScript-Code | Bestehende Einzelbewertungen |
| --- | --- | --- | --- |
| `src-ts/runtime-executables/main.ts` | `efc8fc5ccd39433f5c812e64c5e94864cfd01da68738e2a1de7810c2e67045e5` | `d3862377b688336a0a047bbb8d7554f018e4b088e05294d3c764090270538254` | 9 |
| `src-ts/runtime-executables/www/ems-apps.ts` | `16957513881167c7ea26b109d6c49bf5ee9008d776ffd4f2d6f2a3e5a2c1f160` | `c50c265067b5e7842476f0695b4d13dcdc167045ee50c6919e07b6982b59164f` | 1 |
| `src-admin-tab/src/lib/adminConnection.ts` | `458718f60454255dd86d43efc909c6dc52bf9c8b12afa5cd512e4f9e6806b243` | `d633da3f7847ffdffcfc7786192947873274e4074c37b54f73cc0eb285b5dc9f` | 1 |


Die neun Main-Fingerprints (zehn Vorkommen) und die eine `ems-apps.ts`-Bewertung wurden erneut gegen dieselben konkret beschriebenen Schlüssel-/Array-/Regexgrenzen geprüft. Weder Herkunft noch Zulässigkeit der Schlüssel oder die Anzahl der Fundstellen wurde erweitert. Der direkte Historytransport führt neue Netzoperationen in getrennten, strikt geprüften Helfern aus. Die neu geprüften API-/Importpfade verwenden feste Historyfelder, vorhandene Sitzungs-/Rollen-/CSRF-Prüfungen und verschlüsselte Tokenpersistenz. Der aktualisierte Historyblock wird beim Backup-Merge atomar behandelt; dadurch erbt eine ungültige fremde Tokenhülle keinen bisherigen Klartexttoken.

Zusätzlich wurde die **eine bereits bestehende** Bewertung in `src-admin-tab/src/lib/adminConnection.ts` erneut gelesen: Fingerprint `59450ebe6a325b04febc0607640f2d4bdfba3f3cac204d14e709a7818272fa34`, ein Vorkommen. `copyJsonValue` schreibt weiterhin ausschließlich in ein neues `Object.create(null)`-Dictionary, sperrt `__proto__`, `prototype` und `constructor` vor dem Schreiben und begrenzt Tiefe/Knotenbudget. Der neue History-Wrapper akzeptiert nur die beiden festen Suffixe leer beziehungsweise `/check` und nutzt den bestehenden gemeinsamen HTTPS-/Same-Origin-/CSRF-/Fristpfad; Mutationen werden nicht automatisch wiederholt. Die Schlüsselgrenze der vorhandenen Einzelbewertung wird dadurch nicht erweitert.

Die separate Fehlergrenze für Ladepunkt- und §14a-Berichte wurde im finalen Delta gelesen: Ungültige/umgekehrte oder mehr als 730 Tage umfassende Zeiträume werden vor I/O abgewiesen. Der §14a-Callback unterscheidet Fehler, Zeitüberschreitung und malformed Response von einem tatsächlich erfolgreich gelieferten leeren Resultat; er fängt Parserfehler im Callback selbst ab. Ein fehlgeschlagener Datenbankzugriff wird dadurch nicht als erfolgreicher leerer Nachweis ausgegeben. Die dazu tatsächlich durch den Integrationsbearbeiter ausgeführten HTTP-Fälle sind in `INFLUX_RUNTIME_INTEGRATION_REVIEW.md` mit Quellhashes und Rohlogs belegt; diese statische Einzelprüfung behauptet keinen zusätzlichen selbst ausgeführten HTTP-Gesamttest.

Der vollständige Fingerprintvergleich umfasst **226 Quelldateien, 3200 Funde, davon 2929 weiterhin historische offene Funde und 271 bereits individuell bewertete Fundvorkommen; 0 neue oder verbotene Funde**. Die zwischenzeitlichen zwei neuen `security/detect-object-injection`-Vorkommen in `influx-config.ts` wurden durch explizite feste Feldprüfungen korrigiert; es wurde keine Ausnahme ergänzt. Die vorher blockierte Decimal-Regex im neuen Transport wurde durch einen begrenzten Zahlenparser ersetzt. Die ursprünglichen unabhängigen Parserreproduktionen und die zusätzliche Nachprüfung sind im Influx-Prüfbericht erhalten.

Die spätere Hashaktualisierung darf ausschließlich die **bestehenden 9 + 1 + 1 Einträge** betreffen. Der vorbereitete Aktualisierer prüft sowohl Roh- als auch normalisierten Codehash gegen diesen maschinellen Nachweis sowie sämtliche Fingerprints und Vorkommenszahlen, bevor er die Codebindung ändert. Ein weiterer Quellwechsel muss erneut geprüft werden. Keine neue Ausnahme, keine Regelabschaltung und keine Freigabe der 2929 historischen Hotspots wurde vorgenommen. Die vom Root ausgeführte abschließende Releaseprüfung muss den tatsächlich ausgelieferten Stand einschließlich neu gebauter Runtime/Installerdateien zusätzlich bestätigen.

Die geprüfte eigene Crypto-/Netzgrenze, der native Transport, die Runtime/API sowie das Formular besitzen eigene Influx-Nachweise. Reale Kundendatenbank, Endgeräte-Pixeltest, Geräteaktorantwort und CRA-/Safety-Gesamtnachweis bleiben gesonderte Abnahmen. Die oben dokumentierten historischen nichtproduktiven Mirrorabweichungen wurden nicht umetikettiert oder pauschal beseitigt.

Der abschließende State-Write-Wrapper wurde nach dem Gesamttesthinweis erneut gelesen: Er reicht Original-Argumentanzahl und Reihenfolge mittels `...args` an die bereits gebundene ioBroker-Methode weiter, bewahrt Rückgabe und Fehlerverhalten und übernimmt nur bestätigte erfolgreiche Writes in den Historian. Die drei Capturepositionen sind feste Indizes. Der letzte Scan und die oben genannte Main-Hashbindung enthalten diese Korrektur. Der native Transport enthält den auf 60.000 Punkte begrenzten Ladepunktvertrag und die serverseitig begrenzte Minmax-Projektion; dadurch wurde keine neue freie Fluxoperation eingeführt.


## PWA-Nachprüfung nach dem abschließenden Influx-Stand

Am 24.11.2026 wurde vor Auslieferung das fehlende Login-/Webapp-Symbol nachbearbeitet. Die unabhängige Grenzprüfung steht in `PWA_ICON_UNABHAENGIGE_PRUEFUNG.md`; die komplette frühere Influx-Evidenz bleibt erhalten. Der finale PWA-Scan endete **21:05:33.063 UTC** mit **226 Quellen, 3200 Vorkommen, 2929 historischen offenen, 271 bereits einzeln bewerteten und 0 neuen/gesperrten Vorkommen**. Während des Scans wurde keine Quelle geändert. Rohbeleg: `raw/pwa-ui-independent-review-final.json`.

Die drei ergänzten Apple-Kompatibilitätspfade sind exakt benannt, nur für GET/HEAD öffentlich und liefern dieselbe feste lokale 180-Pixel-PNG. Sie übernehmen keinen Dateinamen aus dem Request. API-/HTML-/Passwortwechsel-/Lizenzgrenzen bleiben bestehen. Eigene negative Policytests bestehen jeweils 3/3 unter Node22/24. Der tatsächliche HTTPS-Integrationstest wurde unabhängig gelesen und separat vom zuständigen Integrationsverantwortlichen in vier Laufzeit-/Buildkombinationen ausgeführt. Reale iPhone-Darstellung und das Zertifikatsvertrauen auf Kundengeräten bleiben offen.

Maßgebliche neue Ganzdateibindungen (ersetzen für diese beiden Dateien die früheren Hashes):

| Datei | SHA-256 Quelltext | SHA-256 normalisierter Code | Unveränderte vorhandene Bewertungen |
| --- | --- | --- | --- |
| `src-ts/runtime-executables/main.ts` | `11f2616a2f7f2e5066c180db4316c7f0b219b066790e7c4563dab3e1104d3d96` | `a791c0b8135b6a832cda954c6de8b55cc2350c61af81cd507431a02c9ef467a1` | 9 Einträge / 10 Vorkommen |
| `src-ts/runtime-executables/lib/ui-access-policy.ts` | `c3b68fac91389ad1502fd03a889fdeca278c5230f7441c80bd77b767f0f030de` | `7db85cc2c23c5d0ee2022ab3a4066cd327b55b241b452d79f8703af8bc12ecf0` | 2 Einträge / 2 Vorkommen |

Alle neun Main-Fingerprints wurden erneut an ihren unveränderten Eingabegrenzen gelesen. Die beiden Policy-Fingerprints `bac207236eb9140cb983413a9544049a7270c237117aa5556effd396452bd182` und `297e4be4ad7b1276439829954145eb11537cee8a4e9a8ffe44c4998ecd20b78a` betreffen weiterhin ausschließlich die lokale, validierte CA-Dateikonfiguration; keine neuen öffentlichen Dateizugriffe nutzen diese Variable. Der separate, gegen Roh-/Codehash und genaue Counts gesicherte Aktualisierer `setup-920/refresh-pwa-reviewed-hashes.cjs` darf nur diese bestehenden 9+2 Bewertungen neu binden. Er ergänzt keine Ausnahme. `ems-apps.ts` und `adminConnection.ts` bleiben unverändert auf der zuvor geprüften Bindung.
