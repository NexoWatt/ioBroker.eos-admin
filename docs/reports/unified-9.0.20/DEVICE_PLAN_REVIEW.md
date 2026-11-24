# Vertiefte Inbetriebnahme-Prüfung 9.0.20

Stand: 24.11.2026. Ausgangspunkt ist der unveränderte Lieferstand 9.0.19. Die folgenden drei zusätzlichen Fehler wurden reproduziert und gezielt behoben. Das ist eine Software-/Integrationsprüfung; keine Abnahme echter Kundenhardware.

## Befunde und Korrekturen

| Kennung | Auslöser und Fehler in 9.0.19 | Korrektur in 9.0.20 |
| --- | --- | --- |
| EOS-920-COM-01 | Eine vorherige manuelle, noch nicht zugeordnete oder konfliktbehaftete Gerätezeile stellte einen geklonten Konfigurationsstand wieder her. Die spätere Profilwechsel-Sperre nutzte alte Objektreferenzen: Status `ACTIVATION_PROFILE_CHANGED`, aber die zurückgegebene betroffene Steuerzeile blieb aktiv. | Sicherheitsprüfung löst die Steuerzeilen jeweils aus dem aktuellen Konfigurationsstand auf. EVCS, Einzelspeicher und Farm bleiben bei unbestätigtem Profilwechsel inaktiv. Namen, Limits und Zuordnungen werden erhalten. Die vorhandene zusätzliche Profilwechsel-Zulassungsprüfung vor dem Geräte-Speichern bleibt bestehen. |
| EOS-920-COM-02 | Nach erfolgreich gespeicherter Aktivierung, aber fehlgeschlagener Laufzeitübernahme blieb `_nwDeviceEmsApplyPending` gesetzt. Der Geräte-Zuordnungsdienst behandelte `EOS_EMS_APPLY_FAILED` und `EOS_EMS_CONFIG_WAIT_TIMEOUT` als endgültige Fehler und plante keinen Wiederholungsversuch. Ohne weiteren Bedienvorgang konnte die EMS-Laufzeit angehalten bleiben. | Ausschließlich diese bekannten Fehler nach Speicherung dürfen den bestehenden begrenzten Wiederholungsweg nutzen: 1/2/5/10/15/30 Sekunden. Die gespeicherte Anfrage wird nicht erneut verbraucht; bei unverändertem Plan wird nur die ausstehende Laufzeitübernahme beendet. Unklare Speicherfehler, unbekannte Fehler und bestätigte Modul-Stoppfehler werden nicht neu klassifiziert. Lizenz, Ownership, Revision und alter Engine-Stopp bleiben Voraussetzungen jedes Versuchs. |
| EOS-920-COM-03 | Beim teilweise fehlgeschlagenen Engine-Start rief der Fehlerpfad nur synchron `stop()` auf und verwarf die Engine-Referenz. Der echte Modulmanager hatte zu diesem Zeitpunkt noch asynchrone Stopp-Promises. Ein direkt folgender Start erzeugte bereits eine neue Engine. | Auch dieser Fehlerpfad wartet auf `stopForReconfigure()` mit dessen bestehender begrenzter Deadline. Bei nicht bestätigtem Abschluss bleiben alte Engine und ursprünglicher Startfehler erhalten. Ein normaler oder erzwungener neuer Start muss erst diese Engine vollständig beenden. Gleichzeitige Initialisierungsaufrufe teilen denselben laufenden Vorgang. Bereitschaft setzt einen laufenden Scheduler ohne Startfehler, Reconfiguration-Sperre oder Shutdown voraus; eine bloß erhaltene Referenz reicht weder für Status noch Steuerungszulassung. |

Eine Änderung des Geräteprofils ist insbesondere bei wiederhergestellten oder direkt geänderten Konfigurationen relevant; die zusätzliche bereits vorhandene Geräte-HTTP-Zulassungsprüfung begrenzt den normalen UI-Auslöser des ersten Fehlers. Der Planer muss dennoch für jeden gültigen Eingang selbst konsistent sein.

Die Gegenprüfung der ersten Lifecycle-Korrektur deckte eine Folgewirkung im noch nicht ausgelieferten 9.0.20-Zwischenstand auf: `onReady` meldete die absichtlich erhaltene, gesperrte Engine fälschlich als betriebsbereit. Dieser Zwischenstand ist separat belegt, nicht als Fehlerreproduktion gegen 9.0.19 bezeichnet. Die abschließende Korrektur verwendet dieselbe Bereitschaftsprüfung für Startabschluss, HTTP-Diagnose, Hoststatus, Partnerfreigabe und Sofortzyklen. Ein nachträglich fehlgeschlagener Neustart setzt einen vorher bereiten Status auf `degraded`; nur eine erfolgreiche Wiederaufnahme hebt genau diesen EMS-Startfehler wieder auf. Andere Startblockaden bleiben erhalten.

## Tatsächlich ausgeführte Nachweise

- Drei externe Reproduktionen gegen unverändertes 9.0.19 fehlgeschlagen wie erwartet; Rohbelege sind beigefügt. Keine Ergebnisumdeutung: Diese Fehlerlogs gehören zum Ausgangsstand.
- 9 neue Reihenfolge-/Rollback-Tests für EVCS, Einzel- und Farmspeicher.
- 3 neue Wiederholungsprüfungen: echte Installer-Persistenz mit anschließendem Retry, verbrauchte Aktivierung bleibt einmalig, unverändertes Speichern wird nicht wiederholt; Höchstzahl und Ausschluss unklarer Speicherfehler.
- 3 neue Engine-Fehlerfallprüfungen mit echter Engine und echtem Modulmanager: verzögerter Stopp, abgewiesener Stopp, begrenzter Timeout und anschließende sichere Wiederaufnahme. Der Timeouttest verkürzt ausschließlich das Testbudget auf 20 ms; der Produktpfad behält 5.000 ms.
- 3 zusätzliche Bereitschaftsregressionen: vollständiger `onReady`-Ablauf mit real abgewiesenem Modul-Cleanup, HTTP-/Sofortzyklus-Zulassung und Status des echten TLS-/Hosted-Wrappers. Nachgewiesen sind auch Wiederaufnahme nach Cleanup und Erhalt fremder Startblockaden.
- Insgesamt **141/141 fokussierte Tests unter Node.js 22.23.4 und 24.22.3**, keine Fehler oder ausgelassenen Fälle in diesem Teillauf. Darin 18 neue Fälle sowie bestehende Planner-, Service-, Aktivierungs-, Persistenz-, Reconfiguration-, vollständige Start-, Status- und TLS-/Host-Regressionsprüfungen.
- Strikte Typprüfung des Geräte-EMS-Vertrags und gezieltes ESLint der beiden geänderten JS-Dateien bestanden. Die zentrale `main.ts` gehört zum bestehenden transpilierten Runtime-Bestand; die übergeordneten Typ-/Build-/Security-Prüfungen werden im Gesamtbericht ausgewiesen, keine vollständige strikte Typabdeckung dieses Bestands behauptet.

Die Testdatenbanken, Lizenzantworten und Geräteinventare sind isolierte Fixtures. Der Engine-/Modulmanager-Lifecycle, der Zuordnungsdienst, die Konfigurationspersistenz und Wiederholungsplanung sind die echten Produktimplementierungen. Es wurden keine realen Aktorbefehle auf einer Kundenanlage gesendet.

## Abdeckung und verbleibende Grenzen

Diese Korrekturen erweitern keine Geräte- oder Reglerrolle. Die in `../unified-9.0.19/EMS_KATEGORIEN_ABDECKUNG.md` dokumentierte Abgrenzung bleibt gültig: automatische Basiskonfiguration für passende NVP-, EVCS- und Speicher-/Farmfunktionen; spezifische PV-Abregelungs-, Thermik-/SG-Ready-/IO-Projektionen sind nicht allein durch das Vorhandensein einer Gerätekategorie vollständig eingerichtet. Kein vorhandener manueller Sollwert, Kundenlimit oder App-Schalter wird zur Fehlerbehebung pauschal ersetzt.

Die Rohlogs und deren Hashes stehen in `raw/commissioning-evidence.json`. Die Vorher-Reproduktionen referenzieren den damaligen isolierten Quellpfad und sind historische Belege; die neuen und erweiterten Repository-Tests sind die wiederholbaren Prüffälle für den aktuellen Stand.
