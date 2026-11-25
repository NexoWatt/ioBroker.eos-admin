# Energiefluss und Tarifstatus – Browserprüfung 9.0.22

Stand: 25.11.2026. Geprüft wurden das ausgelieferte Dashboard-HTML und CSS sowie die tatsächlichen kanonischen Renderfunktionen und Anzeigehelfer in Chromium. Anmeldung, Seitenbootstrap, Transport und Anlagenwerte wurden durch feste lokale Prüfdaten ersetzt. Die Prüfung steuert keine Geräte und belegt keine reale Tarifregelung oder Anlagenbilanz.

## Ergebnis

14 von 14 Szenarien bestanden, jeweils Desktop (1440 × 1000) und Mobilansicht (390 × 844):

- Kohärente Bilanz: 2,5 kW PV + 3,8 kW Netzbezug + 2,8 kW Speicherentladung = 6,8 kW Laden + 2,3 kW Gebäude.
- Die Werte des gemeldeten Fehlerbilds ergeben eine sichtbare Bilanzabweichung von 3,9 kW; ein direkt gemessener Gebäudewert wird nicht zur Verschleierung geändert.
- Eine veraltete oder mit Qualitätsfehler `q=64` gemeldete Ladeleistung bleibt unbekannt. Die davon abhängige Gebäudeaufteilung wird nicht als echte Null angezeigt.
- Echte 80 W bleiben als gerundete 0,1 kW sichtbar; echte 0 W und 0 % SoC bleiben Nullwerte.
- Der aktivierte dynamische Tarifstatus erscheint unter dem Energiefluss. Ohne frischen Reglerstatus bleibt ein sichtbarer Wartehinweis.
- Ein Verbindungsabbruch entfernt die vorherige Ladebehauptung sofort.

Keine Browser-Ausnahme und kein externer Netzwerkaufruf. Der Tariftext blieb innerhalb der Energieflusskarte und auf Mobilgeräten zweizeilig lesbar; kein horizontaler Seitenüberlauf. Desktop- und Mobil-Screenshots wurden intern visuell geprüft und sind kein Bestandteil der Auslieferung.

## Reproduktion und Belege

```sh
EOS_CHROMIUM_PATH=/pfad/zu/chromium node test/eos-energyflow-browser-smoke.cjs
```

Voraussetzungen: vorhandene Entwicklungsabhängigkeiten einschließlich Puppeteer und TypeScript sowie ein kompatibles Chromium. Ausgeführt als unprivilegierter Benutzer mit Node.js 24.22.3 und HeadlessChrome 158.0.8127.0. Der Browser wird nur für die lokale Testseite mit separatem temporären Profil gestartet; keine Kundenanmeldung wird übernommen.

Rohbeleg: `raw/current/energyflow-browser.json`, inklusive Laufzeit, Szenarien, Layoutmaßen und SHA-256 der geprüften Produktquellen. `raw/current/energyflow-browser.stderr` ist leer. Die kanonischen TypeScript-Anzeigehelfer werden im Test in JavaScript übersetzt. Der gesonderte Runtime-Synchronisationsnachweis stellt den Zusammenhang zum ausgelieferten JavaScript her.

Offen bleiben die echte Verbindung vom Kundengerät, Aktualisierungsereignisse über den produktiven Transport, die Zuordnung der Zähler auf der Anlage und die physische Tarif-/Speicher-/Wallboxwirkung. Diese Browserprüfung ist eine Anzeigeprüfung mit simulierten Daten und keine Serienfreigabe.

## Ergänzung: tatsächlicher 5-Sekunden-Anzeigetakt

`test/eos-energyflow-cadence-browser.cjs` führt den tatsächlichen Schedulingblock aus `app.ts` mit echten Chromium-Timern aus. Während eines gut zehnsekündigen SSE-Burst-Szenarios werden wiederholt jeweils drei Anzeigewünsche in 25-ms-Abständen ausgelöst. Die Prüfung bestätigt genau drei Renderzyklen: sofort, nach fünf Sekunden und nach zehn Sekunden. Jeder Zyklus übernimmt den zuletzt gepufferten Wert, ohne seinen ursprünglichen Messzeitstempel zu verändern. Ein absichtlicher Sprung der Kalenderuhr um eine Stunde zurück verändert den Anzeigetakt nicht.

Zusätzlich wurden die Lifecycle-Ereignisse für einen unsichtbaren Tab und die Rückkehr aus dem Seitencache simuliert: alle drei UI-Timer werden beim Pausieren abgeräumt, versteckte Seiten rendern nicht, Rückkehr zeigt sofort genau einen aktuellen Stand. Die Dokument-Sichtbarkeit wird für diesen Test explizit simuliert; es ist keine Messung der Betriebssystem-Hintergrunddrosselung.

Rohbeleg: `raw/current/energyflow-cadence-browser.json`, Fehlerausgabe leer. Dieser Nachweis betrifft ausschließlich den Browser-Anzeigetakt; Backend-Messung und EMS-Regelgeschwindigkeit sind davon unabhängig.

```sh
EOS_CHROMIUM_PATH=/pfad/zu/chromium node test/eos-energyflow-cadence-browser.cjs
```
