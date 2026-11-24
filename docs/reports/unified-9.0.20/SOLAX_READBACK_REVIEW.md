# SolaX Moduskontext und BMS-Grenzen – 9.0.20

Stand: 24.11.2026. Lokaler, noch nicht produktiv installierter Prüfstand. Dieser Bericht bestätigt Softwarepfade mit kontrollierten TCP-Antworten, keine erfolgreiche Leistungsregelung am Kundengerät.

## Anlass und bestätigter Fehler

Der Livebefund zeigt einen an SolaX verteilten Entladesollwert und fehlende Leistungsreaktion. Die Sollwertverteilung ist davon getrennt zu bewerten. Die Geräteabbildung las den FC3-Wert aus Registern 417–418 bisher ohne den zugehörigen Steuerungsmodus. Diese Wörter besitzen bei anderen VPP-Modi eine andere Bedeutung. Ein kontrollierter Moduswechsel von 4 auf 8 erzeugte vor der Korrektur einen vermeintlichen Leistungsrücklesewert von 32.768.001 W.

Eine weitere unabhängige Prüfung fand: Ein gemeinsamer Poll allein reicht nicht. Bei isolierten Datapunktabfragen, kleiner maximaler Gruppengröße oder adaptiver Aufteilung können Modus und Ziel aus verschiedenen Antworten und verschiedenen Gerätebetriebsarten stammen. Das ist jetzt ausdrücklich ausgeschlossen.

## Umsetzung

- Nur das exakt geprüfte SolaX-Profil erhält einen zusätzlichen Lesekontext für `r.powerSetpointReadbackW`. Die Definition prüft auch den unveränderten Modus-Datenpunkt einschließlich seines Quellbeschreibers.
- Der Modbus-Treiber merkt im privaten WeakMap für jedes Ergebnissnapshot, welche dekodierten Werte aus derselben tatsächlich empfangenen Registerantwort stammen. Die Messwertstruktur erhält keine zusätzlichen aufzählbaren Eigenschaften; Kopien und gespeicherte Werte enthalten keinen solchen Nachweis.
- Ein numerischer Rücklesewert setzt Modus **4** und Zielwert in derselben Antwort voraus. Andere Modi, einzelne Werte ohne passenden Kontext, null/NaN/Strings, Diagnosecaches und getrennte Antworten ergeben **unbekannt/null**. Ein Schreib-ACK des Roh-Datenpunkts erzeugt weiterhin keinen semantischen Geräterücklesewert.
- Ein fachfremder schneller Poll erneuert dessen Zeitstempel nicht. Ablauf nach dem vorhandenen langsamen Intervall plus zehn Sekunden, Verbindungsverlust und Stopp entwerten den Kontext. Es gibt keinen zusätzlichen Timer.
- Eine Generation verhindert spätes Zurückschreiben alter Polls nach dem Stopp. Bereits eingereichte Rücklesewert-Schreibvorgänge werden vor der abschließenden Entwertung abgewartet.
- Die beiden vorhandenen numerischen BMS-Leistungsgrenzen `r.allowedChargePower` und `r.allowedDischargePower` gehören zur Messwertfrische. Konstante Werte erneuern ihren Zeitstempel ausschließlich anhand tatsächlich gelesener Quellen. Null, fehlende Antworten und ausgelassene optionale Gruppen erfinden keine Messung.
- Nur die bereits zugeordneten Lesequellen dieser zwei Grenzen werden in den vorhandenen schnellen Poll aufgenommen. Standard-SolaX liest dadurch zusätzlich eine zusammenhängende FC4-Gruppe **162–165** pro schnellem Zyklus. Die bestehende optionale Fehlerbehandlung, Rückfragepause, Autorisierungsprüfung, langsame Gesamtkarte, Timerzahl sowie die Priorität konfigurierter Intervalle bleiben erhalten. Bei adaptiven Fehlerrückfragen gelten weiterhin die bestehenden begrenzten Einzelabfragen. Tatsächliche Zyklusdauer hängt weiterhin von Antwortzeiten und der vorhandenen Befehlsabstandsregel ab.

Steueradressen, Mode4-Schreibblock, Vorzeichen, Betriebsarten, Freigaben, Passwörter, Leistungsgrenzen und Kundenkonfigurationen werden nicht umgeschrieben. Die automatische EMS-Anbindung berücksichtigt langsam konfigurierte Pollintervalle separat; dieser Bericht ersetzt ihre Prüfung nicht.

## Nachweise

`modules/devices/test/solaxReadbackContext.test.js` enthält 13 gezielte Tests mit echten lokalen TCP-Verbindungen bzw. ausdrücklich kontrollierter Zeit-/Scheduler-Simulation:

- AliasV1 → Geräte-Schreibwarteschlange → ModbusTCP: +600 W, −600 W und 0 W ergeben die bestehenden vollständigen Mode4-Blöcke. Entzogene Laufzeitberechtigung verhindert weitere Pakete und erfolgreiche Quittierung.
- Tatsächliche Messwerte: Batteriesignum, 98 % SoC und eine gültige BMS-Grenze von 0 W bleiben erhalten.
- Reale Mode4-Antwort wird von optimistischer Schreibquittierung getrennt; Wechsel auf Mode8 wird unbekannt.
- Isolierte, adaptive und durch `maxReadRegs` getrennte Antworten dürfen alten Modus4 und neue Mode8-Wörter nicht kombinieren. Dabei entstehen keine zusätzlichen Steuerpakete.
- Vollständige Cachekopie, fehlender/ungültiger Kontext, Ablauf, Verbindungsverlust, Stopp sowie zwei gezielte Stop/DB-Schreib-Interleavings.
- 75 Sekunden simulierte Zeit mit echten lokalen TCP-Abfragen: unveränderte 5.000/9.566-W-Grenzen bleiben frisch; optionale Fehler, ausgelassene Gruppen und fachfremde Messungen erneuern sie nicht.
- Produktionsscheduler mit kontrollierter Transportseite: bestehender 1-s-Befehlstakt und 3-s-Schnellpoll bleiben erhalten; die schnelle Menge wächst nur um die zwei Grenzen, die vollständige Karte wird nicht beschleunigt.

Zusammen mit Aliasvertrag, Semantic-/Freshness-, Liveness-, Modbus-Leseintegritäts-, Autorisierungs- und Verbindungslebenszyklusregressionen: **85/85 bestanden auf Node.js 22.23.4 und 24.22.3**. Exakte Befehle, Zeitpunkte und Log-Hashes stehen in `raw/solax-readback-node22.json` und `raw/solax-readback-node24.json`; die vollständigen Ausgaben liegen daneben. Die gezielte strenge JS-Typprüfung und ESLint der kleinen geänderten Hilfsmodule/Tests bestehen; die großen bestehenden Runtime-/Treiberdateien wurden zusätzlich auf Syntax geprüft. Die unabhängige Gegenprüfung ist separat dokumentiert.

## Herstellervertrag und Grenze des Nachweises

SolaX-Herstellerdokument *Modbus Communication Protocol V001.02*, 10.02.2026, Abschnitt „New VPP mode“, beschreibt den Mode4-Block ab 0xA0, positiven Entlade-/negativen Ladesollwert und modusabhängige Rückleseregister ab 0x1A0. Register 0xA3 ist dort `WaitTimeout`; die mögliche Folgewirkung gehört zum Gerätevertrag und wird nicht automatisch umkonfiguriert. Die Hersteller-Knowledge-Base zeigt außerdem eine ältere Registervariante. Ein akzeptiertes Modbus-Schreiben bestätigt deshalb allein weder das passende Firmwareprofil noch die tatsächliche Leistung.

Quellen: [SolaX-Protokoll, Spiegel des Hersteller-PDF](https://community.symcon.de/uploads/short-url/ecxNpsZsby8yDD7kHPxv4Gz6ENS.pdf), [SolaX Knowledge Base](https://kb.solaxpower.com/it/solution/detail/40289fdf9279482a01927a1743c40230), [SolaX modellspezifische Unterstützung](https://kb.solaxpower.com/cs/solution/detail/8280808199c7ef100199c81cbb49026e). Herstellerautorschaft und Drittanbieter-Hosting des PDFs sind getrennt ausgewiesen.

Exaktes SolaX-Modell und ARM/DSP-Firmware der Kundenanlage sind nicht bestätigt. Keine Hardware-Schreibprobe wurde durchgeführt. Für die echte Inbetriebnahme sind die anlagenspezifischen Leistungsreaktionen und Grenzen weiterhin zu prüfen. Die parallele Korrektur der fehlenden Hosted-Geräte-Subscriptions ist ein eigenständiger Befund; dieser Bericht behauptet nicht, Moduskontext sei die alleinige Ursache des Liveausfalls.
