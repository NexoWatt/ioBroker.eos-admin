# Kunden-Updateoberfläche – unabhängige Prüfung 9.0.21

Stand: 24.11.2026. Geprüft wurde die neue Updateoberfläche mit kontrollierten API-Antworten, ohne tatsächliche Installation und ohne Zugriff auf eine Kundenanlage. Dies ist kein Nachweis einer vollständigen produktiven Updatekette oder einer CRA-Konformität.

## Nachgewiesene Korrekturen

Die Gegenprüfung bezieht sich auf den ursprünglichen neuen 9.0.21-UI-Entwurf (`raw/update-ui/eos-updates-before.ts`), nicht auf eine ausgelieferte 9.0.20-Funktion. Von 14 neuen Prüffällen schlugen dort 11 fehl; drei bestanden. Die korrigierte Fassung besteht alle 14 Fälle.

| Kennung | Befund im ersten Entwurf | Geprüfte Korrektur |
| --- | --- | --- |
| 921-UPD-UI-001 | Nach fehlgeschlagener Anfrage konnten Bedienelemente gesperrt bleiben; allgemeiner Status überschrieb konkrete Fehlermeldungen. | Busy-Zustand wird beendet, Bedienelemente werden neu gesetzt, danach bleibt die spezifische Meldung sichtbar. Prüfung/Wiederholung bleibt eine ausdrückliche Nutzeraktion. |
| 921-UPD-UI-002 | Eine verlorene Startantwort konnte keinen ausreichend eindeutigen offenen Auftrag abbilden. | Sobald der Start-POST wirklich gesendet wird, sperrt ein unbestätigter Auftrag weitere Starts. Es folgen ausschließlich Status-GETs. Erst eine maßgebliche Serverantwort klärt den Zustand. Kein automatischer erneuter Start und keine vorgezogene Anzeige der neuen installierten Version. |
| 921-UPD-UI-003 | Überlappende Sichtbarkeitsereignisse und Seitenwechsel konnten mehrere Abfragen beziehungsweise verspätete Darstellungen erzeugen. | Singleflight, begrenzte Anfragezeit, Abbruch bei `pagehide`, sofortige Timerbereinigung und Generationensperre. `pageshow` setzt ausschließlich die Statusabfrage fort. Ein absichtlich verspäteter alter Testtransport kann eine neue Ansicht nicht überschreiben. |
| 921-UPD-UI-004 | Abgelaufene Sitzung, erforderlicher Passwortwechsel, unvollständiges CSRF und fehlerhafte Metadaten waren nicht vollständig abgedeckt. | Jede Mutation liest eine aktuelle Anmeldung und einen formal gültigen CSRF-Token. Strikte Antwortdekodierung, begrenzte Versions-/Planformate, bekannte Statuswerte, keine HTML-Injektion. Abgelaufene oder widersprüchliche Pläne können nicht gestartet werden. |
| 921-UPD-UI-005 | Der Versionshinweis führte nicht unmittelbar zum neuen Einstellungsbereich. | Hinweis verlinkt `settings.html#updates`, verschwindet nach bestätigtem aktuellem Stand und aktualisiert zugängliche Beschriftung. Vorbereitung, Dialogbestätigung und Start bleiben getrennte Aktionen. |

Bei verlorener Startantwort mit anschließend abgelaufener Sitzung behauptet die Oberfläche ausdrücklich nicht, der frühere Auftrag sei nie gesendet worden. Bei fehlgeschlagener Anmeldung vor dem Start-POST wird dagegen kein Auftrag erzeugt. Fehlertexte aus fremden Antwortkörpern werden nicht dargestellt. Aktualität und installierte Version stammen vom Server; lokale Zielversion und lokaler Plan sind keine Installationsfreigabe.

Die Quelle verwendet ausschließlich die EOS-Update-API und `/api/auth/status`, Same-Origin-Credentials und CSRF. Sie ruft keine Admin-Installations- oder beliebigen Systembefehle auf. Die serverseitige Plan-/Benutzer-/Artefaktprüfung bleibt für jeden Schreibzugriff maßgeblich.

## Ausgeführte Prüfungen

| Prüfung | Node 22.23.4 | Node 24.22.3 |
| --- | --- | --- |
| `node --test test/eos-customer-update-ui.test.cjs` | 14 bestanden | 14 bestanden |
| Striktes `tsc -p ui/tsconfig.eos-updates-ui.json` | bestanden | bestanden |
| Typgestütztes ESLint der neuen UI-Quelle | nicht zusätzlich ausgeführt | bestanden, keine Diagnosen |
| Neuer Test gegen den ersten UI-Entwurf | nicht zusätzlich ausgeführt | 3 bestanden, 11 erwartete Fehler |

Die DOM-Testumgebung führt die tatsächliche TypeScript-Quelle nach Transpilierung aus. Sie verwendet die IDs des echten Einstellungsdokuments, kontrollierte Auth-/Statusantworten, verzögerte Fetch-Antworten, einen eigenen Timerbestand, Seiten-/Sichtbarkeitsereignisse und eine kontrollierte Uhr. Sie prüft fehlgeschlagene Prüfung mit erneut bedienbaren Schaltflächen, getrennte Bestätigung, Doppelklick, verlorene Startantwort, beide Auth-Fehlerphasen, CSRF und Passwortwechsel, Konflikt und Planablauf, Datenvalidierung, sichtbare Hinweise, Abbruch/Neustart und ausbleibendes automatisches Installieren. Der DOM-Doppelgänger verweigert `innerHTML`-Schreibzugriffe.

Die mobile Prüfung ist ausschließlich eine Quell-/Markupprüfung auf begrenzte Dialogbreite/-höhe, Scrollbarkeit, umbrechende Bedienelemente und Live-Statussemantik. Sie ist kein visueller Layoutnachweis.

## Browserprüfung blockiert

Der zusätzliche Playwright-Harness verwendet das echte Einstellungs-HTML, Styles und die tatsächliche UI-Quelle mit ausdrücklich synthetischem Status und sichtbarer Kennzeichnung „PRÜFANSICHT … keine Installation“. Das verfügbare Chromium 156 ließ sich in dieser Umgebung jedoch nicht starten: `socket() failed: Operation not permitted` trat vor dem ersten Fenster auf. Alle neun Browserfälle wurden durch denselben Umgebungsfehler blockiert. Es gibt deshalb **keine Browser-Screenshots und keine bestandene gerenderte Desktop-/Mobilprüfung**. Es wurden keine Schutzmechanismen deaktiviert, um diesen Fehler zu umgehen.

Der nicht bestandene Browserlauf liegt in `raw/update-ui/baseline-ui.log` (historischer Dateiname; kein 9.0.20-Vergleich). Der separat ausführbare Harness `raw/update-ui/browser-preview.test.cjs` ist bewusst kein Bestandteil der regulären Node-Testauswahl, solange keine nutzbare Browserumgebung vorliegt. Zur Wiederholung in einer geeigneten Umgebung: `EOS_UPDATE_UI_ROOT=<Repository> node --test <Harness>`, optional mit `EOS_TEST_CHROMIUM` und `EOS_UPDATE_UI_SCREENSHOT_DIR`. Die Prüfungen verwenden einen lokalen Mockserver, nicht npm oder eine Liveanlage.

## Nachweise und offene Abnahme

Exakte Befehle, Versionen, Laufzeiten, Exitcodes und Loghashes stehen in `raw/update-ui/results.json`; Quellhashes in `raw/update-ui/source-evidence.json`. Die erzeugte Runtime-Datei, Gesamtbuild und die zentrale HTML-/Hash-Navigation werden vom übergeordneten Releaseverfahren erstellt beziehungsweise geprüft.

Offen bleiben die gerenderte Browserabnahme mit schmalem Smartphone-Viewport, die reale Session-/HTTP-Integration, der Backend-Worker samt Neustart und Artefakt-/Konfigurationserhalt sowie die vollständige Controller-Installation. Ein bestandener UI-Mocktest behauptet keine erfolgreiche Installation. Die installierte Versionsanzeige darf erst nach bestätigtem Backendstatus wechseln; die UI führt im Test keine Installation aus.
