# Partneroberflächen: Änderung und Prüfvermerk

Stand: Änderung für 1.0.32 auf unveränderter Ausgangsbasis 1.0.31; 28.10.2026.
Die abschließende Build-/Artefaktbindung erfolgt im gemeinsamen Liefernachweis.

## Umsetzung

Die neue eigenständige App **Arbitrage · Speicherhandel** erscheint im EMS
App-Center. Sie bietet Profile für Haushalt und reinen Speicherhandel. Weder PV,
Wallbox, Bilanz noch dynamischer Netzanschluss sind für den Einzelspeicherpfad
vorausgesetzt. Die vorhandene lokale Einzelspeicherregelung muss allerdings
korrekt eingerichtet und aktiv sein; Arbitrage gibt Anforderungen an diesen
zentralen Regler und ist kein paralleler Geräteschreiber.

Bilanz erhält ihre Partnerfreigaben im Bilanz-Reiter. Die bestehende PV-/EVU-Seite
enthält den Einstieg für Direktvermarktung. Beide Ansichten verwenden dieselbe
lokale geschützte React-/Partner-API, zeigen aber ihre eigenen fachlichen Rechte.
Die Bilanzoberfläche bietet ausschließlich `balance.read` an. Es gibt dort keinen
Arbitrage-Appschalter und keine Speichersteuerfreigabe.

Ein Partnerprofil wird gemeinsam genutzt. Verbindung einschalten ist keine
Aussage über aktive Gerätewirkung. Das Formular bietet WSS-Adresse ohne
Zugangsdaten sowie die Referenz einer geschützten `NEXOWATT_PARTNER_`-
Umgebungsvariable; der tatsächliche Token wird nicht an den Browser geliefert.
Freigaben sind je App und Ressource ausdrücklich auszuwählen und beginnen ohne
Rechte. Die globale Widerrufsschaltfläche beschreibt vor dem Ausführen, dass
alle Daten-/Steuerfreigaben und die gemeinsame Verbindung betroffen sind.

## Einrichtung und Abnahme an der Anlage

1. Die vorhandene lokale Speicherregelung und ihre Schutzgrenzen prüfen. Für den
   Einzelspeicher die Kennung `single` wählen. Alternativ eine tatsächlich
   konfigurierte dynamische Speichergruppenkennung verwenden. Die bestehende
   Speicherfarm (`farm`) ist in diesem Stand nicht für Partnersteuerung
   freigegeben; die Installateurfreigabe ist im Formular dafür gesperrt.
2. In Arbitrage die Handelsgrenzen in W, die SoC-Reserve in Prozent und die
   Gültigkeit einer Anforderung von 1 bis 60 Sekunden festlegen. Netzladung und
   Einspeisung sind getrennte ausdrückliche Freigaben und standardmäßig aus.
3. Die Installateurfreigabe erst setzen, nachdem Messwerte, Anschlussgrenzen,
   Gerätegrenzen und sicherer Regelpfad an der konkreten Anlage geprüft wurden.
   Das Kontrollkästchen führt keine Anlagenabnahme aus. Beim Wechsel der
   Ressourcenkennung setzt die UI diese Freigabe zurück.
4. Partnerverbindung und benötigte Ressourcenrechte einrichten. Bilanz und
   Direktvermarktung verwenden in Version 1 die Anlagenkennung `site`.
5. **Freigaben prüfen** erzeugt eine Vorschau der erlaubten Nutzung und zeigt
   konkrete Validierungsfehler. Sie sendet keine Gerätebefehle und stellt keine
   tatsächliche Übertragung von Messwerten dar.
6. Nach dem Speichern den bestätigten Betriebsstatus prüfen. Der Text
   „Partnerkanal bereit“ bestätigt weder die Freigabe jeder einzelnen Ressource
   noch eine gesendete, angewandte oder gemessene Speicherleistung.
7. Offline-/Wiederverbindungs-, Ablauf-, SoC-/Netzgrenzen- und Widerrufsfälle
   nach den gemeinsamen Inbetriebnahmeunterlagen mit der echten Hardware prüfen.

## Sicherheitswirkung

- Installer-/Admin-Routenschutz ergänzt die serverseitige Prüfung.
- Laufzeitvalidierung von Antworten, Zahlen, Booleans, Strukturgrößen und
  unbekanntem JSON erfolgt vor Anzeige/Weiterverwendung.
- Fehlende oder ältere Betriebsbestätigung wird sichtbar; ein unbekannter
  Status wird nicht als aktive Steuerung dargestellt.
- Entwürfe und gespeicherter Betriebsstand bleiben getrennt. Gleichzeitige
  Änderungen werden über Versionskonflikte erkannt; ein 409 erhält den Entwurf
  und sperrt Speichern bis zum ausdrücklichen Neuladen.
- Die Anwendung wiederholt Mutationen nach Netzwerkfehler oder Timeout nicht.
  Bei unklarem Ergebnis verlangt das Formular erneutes Lesen des Serverstands.
  Chromium kann einen POST bei Socket-Abbruch vor den HTTP-Headern auf
  Transportebene wiederholen; im Browsertest wurden drei Serverkontakte bei
  genau einem JavaScript-Aufruf beobachtet. Serverseitige CAS-Prüfung bleibt
  deshalb unverzichtbar und verhindert erneute Übernahme nach einem Commit.
- Das gemeinsame 5-Sekunden-Budget bricht den tatsächlichen HTTP-Auftrag
  einschließlich Antwortkörper ab. Neue eingebettete Routen bleiben am
  tatsächlichen Runtime-Port und verwenden die EOS-Sitzung.
- Nachrichten zwischen Fachformular und Host prüfen Origin und konkretes
  iframe-Fenster. Sie ändern keinen Gesamtentwurf. Der Host sperrt einen
  veralteten Gesamtspeichervorgang nach neuer Partnerrevision.

## Tatsächlich ausgeführte Prüfungen

| Prüfung | Umgebung / Ergebnis | Beleg |
| --- | --- | --- |
| `npm run typecheck --prefix src-admin-tab` | Node.js v24.22.1; bestanden einschließlich Build-Tools-Typen | Gemeinsames Buildprotokoll |
| `node scripts/verify-partner-ui.cjs` | 9 Prüfgruppen bestanden; echte UI- und Backend-Verträge mit lokalen Transportantworten | [ui-contract.log](ui-contract.log) |
| `node scripts/verify-admin-connection-boundaries.cjs` | 9 bestehende Prüfgruppen bestanden | Abschlussprotokoll der Gesamttests |
| `node scripts/verify-admin-type-boundaries.cjs` | 12 bestehende Prüfgruppen bestanden | Abschlussprotokoll der Gesamttests |
| `node scripts/verify-partner-ui-browser.cjs` mit `NEXOWATT_CHROMIUM_EXECUTABLE` | Chromium 153.0.8010.0, 10 Prüfgruppen bestanden; Desktop 1440×1000 und Mobil 390×844 | [Browserbericht](ui-browser-report.json), [Rohprotokoll](ui-browser.log) |

Die Browserprüfung wurde durch `scripts/verify-partner-ui-browser.cjs` mit
lokaler Mock-API ausgeführt. Der JSON-Bericht bindet Screenshots und Ergebnisse
an die tatsächlich geladenen gebauten JS-/CSS-Dateien. Die drei PNGs wurden
zusätzlich visuell auf Lesbarkeit, Kartenabstände und mobile Breite geprüft.
Der Standard-CDN-Download des Browserbinaries war in der Umgebung nicht
verfügbar; ersatzweise wurde `@sparticuz/chromium` 153.0.0 ausschließlich außerhalb
des Produktrepositorys als Prüfwerkzeug installiert. Die mitgelieferte
Software-Grafikdarstellung behebt Screenshot-Artefakte des serverlosen Browsers.
Produktquellen, Abhängigkeiten und CSS wurden dafür nicht verändert.

Desktop (1440 × 1000), Mobilansicht und mobile Einrichtung (je 390 × 844) wurden lokal visuell geprüft. Der Lieferumfang enthält Ergebnis und Hashbezug dieser Prüfung; die lokal erzeugten Browserbilder werden nicht mitgeliefert.

Echte Händlerverbindungen, produktive
ioBroker-Instanz, Gerätewirkung und Anlagenabnahme sind durch diese lokalen
Vertrags-/Browserprüfungen nicht nachgewiesen.
