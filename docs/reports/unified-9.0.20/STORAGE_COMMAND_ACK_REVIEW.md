# Speicherbefehle: Auftrag, Quittierung und Messwert – 9.0.20

Stand: 24.11.2026. Enger Nachtrag aus dem Livebefund: 681 W Auftrag für den vollen Speicher, 31 W gemessene Leistung und Kommandostate mit `ack:false`, dennoch als bestätigt markiert.

## Befund und geänderte Bedeutung

`_sfReadbackNumber` in `ui/src-ts/runtime-executables/main.ts` sowie `_verifyStorageCommandDatapoints` in `ems/modules/storage-control.ts` verglichen bislang allein den Zahlen-/Boolwert. Der unmittelbar selbst geschriebene `ack:false`-Wert wurde deshalb als `confirmed` gemeldet. Außerdem konnte ein fehlender oder leerer Zahlenwert durch `Number('')` fälschlich eine Nullvorgabe bestätigen.

Die Rückmeldung trennt jetzt:

| Stufe | Beleg / Bedeutung |
| --- | --- |
| `requested`, `pending-ack` | Der passende Auftrag liegt vor; eine aktuelle Quittierung fehlt. `readback.ok=false`, `pending=true`. |
| `driver-acknowledged` | Passender Wert, `ack:true`, keine schlechte Qualität und ein zur aktuellen Anforderung gehörender Zeitstempel. Nur Adapter-/Treiberquittierung. |
| Separater Geräterücklesewert | Muss aus tatsächlichem Register-/Protokolllesen stammen. Wird durch einen Quittierungsstate nicht ersetzt. |
| Gemessene Speicherleistung | Bleibt eigenständiger Messwert mit vorhandener Frische-/Reaktionsüberwachung. Ein 681-W-Auftrag macht 31 W Istleistung nicht zu 681 W. |

Fehlende, leere und boolesche Werte bestätigen keine numerische Null. Schlechte Qualitätsflags bleiben Fehler. Eine ältere Quittierung vor dem aktuellen Schreibversuch bleibt unbestätigt. Die vorhandenen State-IDs und operativen Rückgabeverträge bleiben erhalten: `writeOk`, `acceptedSollW`, `acceptedDeliveredW`, `commandEffective`, `requestSatisfied` bezeichnen weiterhin die Übergabe im Schreibpfad, nicht eine unabhängig nachgewiesene physische Reaktion. Ergänzende `commandConfirmationLevel`, `commandDpReadbackPending` und Readbackdetails machen diese Grenze explizit; der bisher irreführende Name von `acceptedSollW` wurde angepasst.

## Keine neue Regelstrategie

Ein passender asynchroner Auftrag ist kein unmittelbarer Schreibfehler. Pending wird sofort nach einer Leseprobe zurückgegeben; es werden dafür keine drei Wartezyklen durchlaufen. Idempotenz und die vorhandenen Keepalivefristen bleiben wirksam. Pending allein leert keinen Schreibcache, erzeugt keinen Nullbefehl und deaktiviert Run nicht. Das gilt auch für alternative Sollwertfamilien und den nativen FEMS-NVP-Schreibpfad. Die Freigabe-/Watchdogübergabe bleibt unverändert; ihre Anzeige nennt bei ausstehender Quittierung ausdrücklich „Nullvorgaben angefordert“.

Tatsächliche Werteabweichungen, Qualitätsfehler, verworfene Schreibzugriffe und Freigabeentzug bleiben Fehler. Die vorhandene Safe-Run-Rücknahme bei einer echten Abweichung bleibt getestet. Zeitstempel im Einzelpfad werden am Beginn eines echten Schreibversuchs erfasst: Ein Treiber darf bereits quittiert haben, bevor die Registry-Promise fertig wird. Die kleine Merkliste verwendet die festen internen Befehlsrollen und wächst nicht mit historischen Datenpunkt-IDs nach Umkonfigurationen.

## Nachweise und Grenzen

- Neuer Test `test/eos-storage-command-ack.test.cjs`: zehn Fälle gegen echte Farm-Helper und den echten Einzelregler; Zustandsdatenbank/Quittierung sind kontrollierte Fixtures. Enthalten sind Pending, spätere und veraltete Quittierung, ungültige Qualität, fehlende Nullwerte, Mismatch, Schreibfehler, Freigabeentzug, Keepalive, FEMS-Übergabe, Safe-Run-Verhalten und Erhalt von null in der tatsächlichen Farm-Diagnoseprojektion.
- Zusammen mit tatsächlichen Farmcontroller-/Verteilungsprüfungen: **52 bestanden unter Node 22.23.4 und 24.22.3**, keine Fehler/Skips.
- Vorhandene Prüfer `verify-storage-command-family-readback.js`, `verify-storage-appcenter-output-modes.js`, `verify-fenecon-hybrid-controller.js`: zuletzt alle unter Node 24 bestanden. Ihre operativen Reihenfolge-, Richtungs-, Watchdog- und Mischfarmassertions blieben erhalten. Ack-false-/Raw-only-Fixtures erwarten jetzt bewusst Pending.
- Zwei alte Farmprüfer verwendeten noch den entfernten Standalone-Factoryexport und simulierten die Entfernung des inzwischen erforderlichen Type Detectors. Diese Testfixtures wurden auf die tatsächliche HostedAdapter-Schnittstelle umgestellt. Frühe Fehlläufe und die erfolgreichen korrigierten Läufe sind unverändert als Rohbelege erhalten.
- Zweite Quellprüfung durch den unabhängigen Inbetriebnahmeprüfer: Pendingbehandlung und Cacheerhalt bestätigt; dessen Befund zur irreführenden Neutralisierungsbeschriftung wurde korrigiert.

Die drei genannten `ui/scripts/verify-*.js` sind nach dem dokumentierten Spiegelheader weiterhin Originalquellen für Prüfskripte ohne ausführbares TS-Original. `src-ts/runtime-mirrors/scripts/verify-*.ts` sind daraus erzeugte Parallelspiegel, keine zweite handgepflegte Quelle. Produktquellen wurden ausschließlich unter `runtime-executables` geändert; Laufzeit und Spiegel wurden anschließend erzeugt.

Rohlogs mit Befehlen, tatsächlichen Laufzeiten, Exitcodes und Hashes: `raw/isolation/command-ack-*.log` und zugehörige Receipts, Verzeichnisindex `INDEX.json`. Keine reale Batterie wurde in diesen Tests gesteuert, keine physische Leistungsreaktion bewiesen. Die separate Untersuchung des tatsächlichen gehosteten Ereignis-/Geräteschreibpfades und der herstellerspezifischen Registerrückmeldung bleibt ein eigener Nachweis; dieser Fix allein repariert keine verlorenen State-Abonnements und ist keine alleinige Inbetriebnahmefreigabe.
