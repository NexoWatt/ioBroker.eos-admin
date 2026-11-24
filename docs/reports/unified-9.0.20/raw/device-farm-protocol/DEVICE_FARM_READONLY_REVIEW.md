# Nachprüfung SolaX/FENECON-Gerätepfad zur Speicherfarm

24.11.2026. Nur lesende Prüfung des Kandidaten `source-920/iobroker.eos-admin`; keine Änderung im Produktcode, keine Kundengeräte und keine Anlagenkonfiguration angefasst.

## Anlass und Ergebnis

Gemeldeter Zustand: zwei frische Speicher, FENECON 1 % und SolaX 98 %, arithmetischer Farm-SoC 49,5 %, rund 600 W Netzbezug, beide Speicher 0 W. Die reine Online-/SoC-Anzeige belegt Messfähigkeit, nicht die Freigabe bzw. physische Annahme eines Stellbefehls.

Im Gerätepfad wurde kein Fehler reproduziert, der den SolaX-Sollwert bei korrekter Farmentscheidung in 0 umwandelt oder einen zusätzlichen Software-Modusschalter voraussetzt. Ein tatsächlicher AliasV1-Aufruf wurde über die echte Geräte-Schreibwarteschlange, den Hosted-Treiberschutz, den echten ModbusDriver und `modbus-serial` zu einer lokalen TCP-Protokollgegenstelle geführt. Positive, negative und Null-Sollwerte kommen mit richtiger Vorzeichenkodierung und vollständigem Mode-4-Block an. Die Gegenstelle ist simuliert; Firmwarefreigabe, BMS-Limits und Leistungsreaktion am realen Wechselrichter sind damit ausdrücklich nicht nachgewiesen.

## Nachgewiesener Verlauf

| Stufe | Befund / Quellort |
| --- | --- |
| Farmplan | `src/lib/eosDeviceEmsPlan.js:401`: `ctrl.powerSetpointW` wird bei SolaX als schreibbare W-Zuordnung gewählt. |
| Alias | `modules/devices/lib/deviceRuntime.js:2243`: Alias → `sET_ACTIVE_POWER`. Positive Werte sind Entladen; die Lade-Hilfszuordnung bildet positive Ladeanforderung auf negative Werte ab. |
| Schreibwarteschlange | `deviceRuntime.js:7892`, `:7928`, `:7707`: Konvertierung, Einreihung, echte Treiberübergabe. |
| Betriebsmodus | `modules/devices/lib/drivers/modbus.js:4017`, `:4094`: Profildefinierter Unlock, dann atomarer FC16-Block ab Register 160 mit Mode 4. Kein separater manueller External-Control-Schalter ist für diesen Codepfad erforderlich. |
| Messrichtung | Profil `ess.solax.SolaXHybridX1X3Ess`, FC4 Register 56/57, `invert: true`: rohe −600 W werden zu +600 W kanonischer Entladung. |
| Schutz | Entzug der Hosted-Berechtigung vor dem nächsten Schreibversuch verhindert zusätzliche TCP-Schreibpakete und eine Erfolgsquittierung. |

Empfangene lokale FC16-Blöcke:

| Alias-Sollwert | Adresse | Registerfolge |
| --- | --- | --- |
| +600 W | 160 | `4, 600, 0, 600, 160` |
| −600 W | 160 | `4, 64936, 65535, 600, 160` |
| 0 W | 160 | `4, 0, 0, 600, 160` |

Der erste Schreibzugriff ist der profildefinierte FC6-Unlock. Die Zahlen in den Mode-4-Blöcken sind Sollwert, Ausführungsdauer und Folgeverhalten gemäß vorhandenem Profil; es wurden keine Grenzwerte oder Berechtigungen umgangen.

## Tatsächliche Abdeckungslücke: numerische BMS-Leistungsfreigaben

Der SolaX liest `aLLOWED_CHARGE_POWER` (FC4 162/163) und `aLLOWED_DISCHARGE_POWER` (FC4 164/165). `deviceRuntime.js:2214` erzeugt daraus `aliases.v1.r.allowedChargePower` und `.allowedDischargePower`. Ein real über TCP gelesener Wert **0** bleibt als 0 erhalten.

Der Farmplan bindet dagegen derzeit nur boolesche `r.allowCharge` / `r.allowDischarge` (`eosDeviceEmsPlan.js:392`). Diese booleschen Aliasnamen werden bei SolaX mangels entsprechender Roh-DPs nicht erzeugt (`deviceRuntime.js:2185`). Der Farm-Laufzeitleser verarbeitet als Leistungsgrenzen lediglich statische `row.maxChargeW` / `row.maxDischargeW` (`ui/src-ts/runtime-executables/main.ts:6963`). Die numerischen dynamischen SolaX-BMS-Freigaben begrenzen den Software-Allocator derzeit nicht.

Das ist eine Integrationslücke, aber kein Beweis für die aktuelle vollständige Nullregelung: ein nicht gelesener Wert kann nicht beide Software-Sollwerte auf 0 setzen. Ein realer SolaX kann einen vom BMS nicht erlaubten Sollwert selbstverständlich selbst ablehnen. Eine eventuelle Ergänzung muss Einheiten, aktuelle Messung, gültige Nullwerte, statische Obergrenzen und jeden Speicher getrennt behandeln. Null darf nicht als „fehlt“ interpretiert, veraltete Freigabe nicht blind weiterverwendet und eine Mitgliedersperre nicht automatisch auf alle anderen Speicher übertragen werden.

## Ausgeführte Tests

`solax-control-chain.test.cjs` liegt neben diesem Bericht, außerhalb des versiegelten Produktstands.

- Node.js **24.22.3**: 3/3 bestanden, Exitcode 0.
- Node.js **22.23.4**: 3/3 bestanden, Exitcode 0.
- Test 1: tatsächlicher Runtime-/Treiberpfad und lokale TCP-Pakete für +600, −600, 0 W; Berechtigungsverlust ohne weiteres Paket/Erfolgsquittierung.
- Test 2: tatsächlicher TCP-Lesepfad, 98 % SoC, positive Entladeleistung und gültige numerische BMS-Grenze 0; keine erfundene boolesche Freigabe.

Aufruf: `node --test audit-920/device-farm/solax-control-chain.test.cjs`; zusätzlich mit `/workspace/scratch/741f792566ea/node22-runtime/package/bin/node`.

Für die konkrete Anlage bleiben entscheidend: Farm-Sollwert und Sperrgrund je Mitglied, SolaX-Sollwert-Readback, echte verfügbare Entladeleistung und tatsächliche Geräte-Leistungsantwort. Diese Werte liegen in diesem Teilauftrag nicht vom Kundengerät vor.


## Ergänzung: tatsächlicher Readback und Protokollgeneration

Der dritte TCP-Test bestätigt: ein quittierter 700-W-Befehl schreibt den rohen RW-Datenpunkt `sET_ACTIVE_POWER` optimistisch auf 700. Der zusätzliche Alias `aliases.v1.r.powerSetpointReadbackW` bleibt bis zum echten Lesen unverändert; eine Gegenstellenantwort von 600 W ergibt dort 600 W. Deshalb den rohen RW-Datenpunkt nicht als Gerätebestätigung behandeln.

Bestätigte Diagnoselücke: Beim tatsächlich gelesenen Modus 8 interpretiert die bestehende mode-unabhängige Definition dieselben Register weiterhin als Mode-4-Leistung. Simulierte Register `1, 500` ergeben dann fälschlich 32768001 W. Readback ist folglich nur zusammen mit gleichzeitig bestätigtem Modus 4 aussagekräftig. Hier wurde noch kein Produktcode geändert.

### Primärquellen und Abgrenzung

- SolaX-Herstellerdokument **MODBUS Communication protocols V001.02, 10.02.2026**, [öffentliche Spiegelkopie](https://community.symcon.de/uploads/short-url/ecxNpsZsby8yDD7kHPxv4Gz6ENS.pdf): Abschnitt 3.5.8, gedruckte Seiten 61, 66–67 (PDF-Seiten 67, 72–73). Neues Mode-4-Layout: FC16 ab A0, Sollwert A1/A2; positive Werte entladen. FC3 1A1/1A2 liefern den Sollwert im Modus 4. A3 bezeichnet WaitTimeout, A4 das Folgeverhalten. Der Codewert 600 ist dadurch nicht als Fehler belegt; die vorhandene Benennung „ExecDuration“ ist ungenau. Die Registerüberschrift nennt nur A0–A2, die fortgesetzte Tabelle führt aber A3/A4 zusätzlich auf.
- Dasselbe Herstellerdokument, gedruckte Seite 33: FC4 A2/A3 und A4/A5 liefern erlaubte Lade-/Entladeleistung in W. Gedruckte Seite 74 nennt einen persistenten Exit-Idle-Schalter; daraus folgt keine Berechtigung, dessen Einstellung automatisch zu ändern.
- [Offizielle SolaX-VPP-Anleitung](https://kb.solaxpower.com/it/solution/detail/40289fdf9279482a01927a1743c40230): ältere Mode-4-Adressen 7C, 89/8A; gleicher Sollwertvorzeichenvertrag. Dokumentierter Unlock und lesbarer Lockstatus FC4 54. Nicht jedes Modell unterstützt alle Modi. Der Suchindex liefert den Inhalt; direkter Seitenabruf antwortete während der Prüfung mit HTTP500.

Die Herstellerunterlagen bestätigen somit die Semantik des vorhandenen neuen Protokollpfads, aber nicht die Protokollgeneration/Firmware des Kundengeräts. Kein Vorzeichenwechsel, kein Adressfallback, kein Ein-/Ausschalten persistenter Geräteoptionen wurde vorgenommen.
