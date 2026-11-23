# SmartHome-Aktionsmenüs – gezielte Korrektur für 9.0.13

## Anlass und Ursache

Der vom Nutzer gelieferte Screenshot zeigt das geöffnete Menü „Projektdatei“ an der Unterkante der Kopfkarte abgeschnitten. Die gemeinsame Cockpit-Regel in `ui/www/styles.css` setzt am Element `.nw-smarthome-header` `overflow: hidden`. Das bisherige absolut positionierte Menü befindet sich innerhalb dieses Elements. Ein hoher `z-index` des Menüs allein kann diese Abschneidegrenze nicht überwinden. „Weitere Funktionen“ konnte gleichzeitig offen bleiben.

## Änderung

`ui/www/smarthome-config-workspace.css` hebt die Abschneidegrenze ausschließlich auf der SmartHome-Konfigurationsseite auf. Kopfkarte und Schrittnavigation erhalten nachvollziehbare Ebenen oberhalb des Inhalts; Dialoge und die globale Navigation behalten ihre höheren Ebenen. Die dekorative Kopfkartenfläche übernimmt weiterhin den Randradius.

Die beiden Aktionsmenüs erhalten eine begrenzte Breite und Höhe sowie vertikales Scrollen. Unter 600 CSS-Pixeln öffnen sie im normalen Dokumentfluss; weitere Inhalte rücken nach unten. Geschlossene Menüs bleiben auch gegenüber allgemeinen Grid-Regeln verborgen. Die Menüpunkte und ihre Zielaktionen bleiben erhalten.

Die maßgebliche Quelle `ui/src-ts/runtime-executables/www/smarthome-setup.ts` koordiniert die beiden nativen Details-/Summary-Menüs. Beim Öffnen eines Menüs schließt das andere. Außenklick, Fokuswechsel und Escape schließen offene Menüs. Escape innerhalb des Menüs stellt den Fokus auf dessen Summary zurück. Escape außerhalb des Menüs wird nicht abgefangen, damit bestehende Dialoge ihre eigene Tastaturbedienung behalten. Aktionsklicks werden weder verhindert noch erneut ausgelöst. Mehrfaches Laden des Helpers bindet keine doppelten Listener.

## Sicherheits- und Funktionsumfang

Die Änderung betrifft DOM-Ereignisse und Darstellung. Es entstehen keine zusätzlichen Netzwerkabrufe, Schreibaktionen, Berechtigungen, Abhängigkeiten oder gespeicherten Kundeneinstellungen. Konfigurationsentwürfe, Lizenzprüfung, Datenpunktzuordnung, Alias-Anlage und fachliche Gerätebedienung werden durch die Menükoordination nicht verändert. Native Details-/Summary-Bedienung bleibt erhalten. Das bestehende Freigabe- und Persistenzverhalten der aufgerufenen Aktionen gilt unverändert.

## Automatisierte Prüfung

Der vorhandene Testlauf `ui/test/unified/smarthome-setup-flow.test.cjs` wurde um sechs konkrete Regressionen erweitert:

- Gegenseitiges Schließen bei unverändertem, ungespeichertem Kundenentwurf und ohne API-Aufruf.
- Einmalige Aktionsausführung auch bei Klick auf ein verschachteltes Symbol; kein Verhindern des Ereignisses.
- Native Summary-Bedienung, Klick innerhalb des Menüs sowie Schließen bei Außenklick und Fokuswechsel.
- Escape mit korrekter Fokusrückgabe; kein Abfangen bei Fokus außerhalb des Menüs.
- Keine Listenerverdopplung und weiterhin funktionierendes Schließen eines Einrichtungsdialogs mit Escape.
- Statischer CSS-Vertrag: sichtbarer Overflow des Vorfahren, gestaffelte Ebenen, begrenzte Desktop-Panels und mobile Darstellung im Dokumentfluss.

Die Prüfung verwendet die unveränderten Produktfunktionen mit lokalen DOM-/API-Fixtures. Sie misst keine tatsächliche Browsergeometrie. Der gezielte Lauf enthält einschließlich der vorhandenen Formular-, Entwurfs-, Import- und Erkennungsfälle **33 Tests**. Die endgültigen Node-22-/Node-24-Gesamtläufe, Typ- und Lintprüfungen gehören zu den Rohbelegen dieses Lieferstands; Ergebnisse nicht zusätzlich zu deren Gesamtsummen zählen.

| Gezielte Prüfung | Tatsächliches Ergebnis |
| --- | --- |
| Node.js 22.23.4, `node --test ui/test/unified/smarthome-setup-flow.test.cjs` | 33 bestanden, 0 fehlgeschlagen, 0 ausgelassen |
| Node.js 24.22.3, gleicher Testlauf | 33 bestanden, 0 fehlgeschlagen, 0 ausgelassen |
| `tsc -p ui/tsconfig.smarthome-setup.json` | Erfolgreich, Exitcode 0 |
| Typinformiertes ESLint mit `ui/eslint.smarthome-setup.config.mjs` | Erfolgreich, Exitcode 0 |

## Noch notwendige Sichtprüfung am Zielgerät

Eine echte Browser-, Windows- oder Touchabnahme wurde für diesen Fix nicht durchgeführt. Nach dem Update die Seite neu laden und folgende Punkte prüfen:

1. „Projektdatei“ öffnen: „Neu laden“, „Export“ und „Import“ vollständig sichtbar und erreichbar; kein Abschneiden an der Kopfkarte oder Verdecken durch die Schrittleiste.
2. „Weitere Funktionen“ öffnen: „Projektdatei“ schließt; alle bisherigen Ziele bleiben erreichbar. Danach Außenklick, Tab und Escape ausprobieren.
3. Bei schmalem Fenster beziehungsweise Smartphone die Menüs öffnen: Inhalt rückt nach unten; kein seitlicher Überlauf. Bei starker Vergrößerung bleibt der Menüinhalt scrollbar.
4. Einen ungespeicherten Entwurf anlegen, Menüs wechseln und einen Dialog mit Escape schließen: Der Entwurf bleibt erhalten, bis die vorhandene Speicheraktion bewusst ausgeführt wird.

Die Korrektur und ihre automatisierten Nachweise sind keine allgemeine Produktiv- oder CRA-Freigabe.
