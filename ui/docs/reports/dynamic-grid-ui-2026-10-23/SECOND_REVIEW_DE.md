# Zweiter KI-Review – EMS-Darstellung und Datenpunktauswahl 1.0.28

Datum: 23.10.2026. Ausgangsstand: 1.0.27,
Commit `c70ce7237e2307798acad8222f87d6d4868d863b`.
Geprüft wurde der eingefrorene Änderungsstand für 1.0.28 mit synchronisiertem
App-Center-JavaScript und gebauter React-Anwendung.

Dieser zweite KI-Arbeitsstrang hat die Produktänderungen nicht selbst
implementiert. Seine Quellprüfung, eigenen Tests und Bildprüfung sind keine
externe Zertifizierung, vollständige Sicherheitsprüfung oder Anlagenabnahme.

## Ergebnis

Im geprüften Umfang wurde nach den gezielten Nachbesserungen kein offener
blockierender Produktbefund festgestellt. Die eingebettete Ansicht nutzt die
verfügbare Kachelbreite und das gemeinsame EMS-Stylesheet. Die Datenpunktauswahl
ändert ausschließlich den lokalen Entwurf und bleibt an Fenster, Auftrag,
Formularrevision und Sperrstatus gebunden. M0 bleibt schreibgeschützt mit seiner
Quelle aus „Allgemein“.

Die Regelberechnung, Gerätewriter, Backend-Schreibverträge und Lizenzarchitektur
wurden durch diesen UI-Patch nicht verändert. Diese Aussage ersetzt keine erneute
Prüfung aller vorhandenen Runtimefunktionen. Die abschließenden allgemeinen
Releaseprüfungen werden im [Prüfvermerk](PRUEFVERMERK_DE.md) dokumentiert.

## Quellprüfung und Vergleich

Verglichen wurden die vorhandenen App-Center-Formulare und ihr Datenpunktdialog
mit `DynamicGridPage`, `DpField`, `dataPointPicker`, `EmbeddedEmsFrame`,
`PageShell`, `ProtectedRuntimeRoute` und dem Parent-Code in `ems-apps.ts`.

| Prüfpunkt | Festgestellter Stand |
| --- | --- |
| Gemeinsame Darstellung | Der explizite Embedded-Pfad entfernt nur den zusätzlichen inneren Seitenrahmen. Andere Seiten behalten ihren bisherigen `PageShell`. Die eingebettete App lädt `/static/styles.css` und verwendet dieselben Karten-, Eingabe- und Buttonklassen wie das App-Center. |
| Größe und Lebenszyklus | Der ResizeObserver misst den Inhaltsknoten statt der iframe-Viewporthöhe. Der Parent akzeptiert nur eine begrenzte ganzzahlige Höhe von seinem aktuellen iframe mit exakt passendem Ursprung. Observer, CSS-Link, Listener und Framescheduling werden beim Unmount entfernt. |
| Berechtigungen | Die vorhandene Prüfung von Installer-/Admin-Rolle und Capability bleibt vor dem Rendern fachlicher Inhalte bestehen. Die Discovery-Endpunkte `/api/object/tree` und `/api/smarthome/dpsearch` behalten ihre serverseitige `mapping.edit`-Prüfung. |
| Auftragsbindung | Parent und Client prüfen den exakten Ursprung, das konkrete aktuelle iframe beziehungsweise Popup/Opener-Fenster und die Request-ID. Der Client verwendet eine zufällige ID pro Auftrag. Ein fremder Auftrag kann weder eine Auswahl übernehmen noch den aktuellen Dialog abbrechen. |
| Asynchrone Antworten | Öffnen/Schließen wechselt die Dialoggeneration. Baum-, Such- und Zeilen-Callbacks prüfen ihre Generation; Such- und Baumantworten zusätzlich ihren aktuellen Request. Ein alter Callback wird auch dann verworfen, wenn dieselbe State-ID in einem neuen Dialog vorkommt. |
| Erlaubte Auswahl | Nur syntaktisch begrenzte State-IDs aus den aktuellen Discovery-Ergebnissen können gewählt werden; Ordner und nicht gelistete IDs werden verworfen. Texte gelangen über `textContent` beziehungsweise React-Textausgabe in die Oberfläche. Die Anzeige „Schreib-Datenpunkt“ ist keine Schreibfreigabe; die vorhandene Backendprüfung beim Übernehmen bleibt erforderlich. |
| Sperren und Entwurf | `DpFieldContext` trägt Formularrevision und `blocked`. Busy und veralteter Stand sperren Öffnen und Ergebnisübernahme. Revision-, Feldwert- und Zeilenwechsel sowie Unmount brechen den Auftrag ab. Auswahl und manuelle Eingabe benutzen denselben `onChange`-/Dirty-Pfad. |
| Wirkung | Die Bridge ruft keine Schreib- oder Speicher-API auf. Sie nutzt ausschließlich den bestehenden Discovery-Dialog. Ein tatsächlich gespeicherter Entwurf läuft weiter durch den bisherigen versionsgebundenen Save-Vertrag. |
| Bestehende Bedienung | Der bisherige Parent-Inputpfad setzt weiterhin die vollständige ID und löst sein `change`-Ereignis aus. Parent-Save/Import und Gesamtstandübernahme schließen einen offenen Dialog; die spätere Auswahl wird nicht mehr angewendet. |

Im Review erkannte und anschließend nachgeprüfte Zwischenbefunde:

- Die Initialisierung der Parent-Bridge stand zunächst im Reloadhandler. Sie
  wurde in den erfolgreichen rollenberechtigten Startpfad verschoben.
- Ein reiner Revisionsstring brach einen bereits offenen Picker beim Stalewerden
  ab, verhinderte aber keinen neuen Auftrag bei bereits veraltetem Formular.
  Der explizite `blocked`-Vertrag prüft nun beide Grenzen.
- Der Abschluss eines alten Requests konnte den Pending-Zustand eines neueren
  Requests zurücksetzen. Die Bereinigung ist jetzt an den aktuellen Controller
  gebunden; Abbruch setzt den lokalen Zustand gesondert zurück.

## Eigene Tests und Bildprüfung

Der zweite Reviewer hat nach dem Produktfreeze unter Linux mit Node.js
`v24.19.0` folgenden Befehl selbst ausgeführt:

```text
node --test test/frontend-nvp-topology.cjs test/frontend-dynamic-grid-version.cjs test/frontend-ems-navigation.cjs test/dynamic-grid-dp-picker.test.cjs
```

Ergebnis: **47 fachliche Checks bestanden**: 10 Formularchecks, 25 Versions- und
Abbruchchecks, 6 Navigations-/Rahmenchecks sowie 6 Bridge-/Clienttests. Der
Node-Testläufer zählt die drei separat zusammenfassenden Frontenddateien und die
sechs Einzeltests als neun bestandene Testeinträge.

Die Bridgeprüfungen testen insbesondere fremde Origin/Source/Request-ID,
fehlende Rollenfreigabe, Ordner und injizierte IDs, den bestehenden Parentpfad,
verspätete Baum- und Suchantworten, alte Rowcallbacks, Cancel, Mutationssperre,
Abort, Popup-Schließen und Timer-/Listenerbereinigung. React-Unmount und
Zeilenrevision wurden zusätzlich am konkreten Cleanup-/Ergebniscode geprüft;
ein eigener interaktiver Row-Remove-/Unmount-Browserfall wird nicht behauptet.

Die vorhandenen Desktop- und Mobilscreenshots bei 1440 und 390 Pixeln wurden
vom zweiten Reviewer selbst geöffnet und visuell beurteilt: gemeinsamer
Seitenkopf, durchgängiger EMS-Stil, verfügbare Formularbreite sowie sichtbare
Betriebs- und Dirty-Hinweise. Die Aussage bezieht sich auf diese Bilder und wird
nicht auf ungeprüfte Browser oder sämtliche Formularzustände verallgemeinert.

## Geprüfte Browsernachweise aus dem weiteren Arbeitsstrang

Der zweite Reviewer hat die Testquelle und den abschließenden PASS-Eintrag in
[browser-real-ui.log](browser-real-ui.log) geprüft. Dieser Browserlauf wurde vom
zuständigen Testarbeitsstrang ausgeführt, nicht vom zweiten Reviewer wiederholt.
Er verwendet Chromium, ausgeliefertes App-Center/React, echte Express-Routen und
die zentrale Installer-Persistenz mit lokalen ioBroker-Fixtures.

**12 Abläufe bestanden**, darunter:

- Bestehender Speicher-DP-Dialog, gemeinsame Darstellung und M0-Schreibschutz.
- Echte Baum-/Suchauswahl für M1, Speicherleistung, SoC, Sollwert, Rücklesung,
  Verfügbarkeit, Arbitrage und PV; sichtbare Picker für Split-/Limit-/Watchdog-
  und optionale Schaltfelder.
- Leere Suche und Abbruch ohne Entwurfsverlust; künstlich verzögerte echte
  Objekt-DB-Antwort nach Wechsel in einen anderen Picker.
- Kein POST während der Auswahl; anschließender expliziter Save mit originalem
  CAS-Token speichert die gewählten IDs als weiterhin inaktiven Entwurf.
- Echte konkurrierende Speicherung: der offene Dialog wird abgebrochen, lokale
  Eingaben bleiben erhalten, DP-Auswahl und Save sind bei veraltetem Stand
  gesperrt.
- Eigenständige Ansicht auf dem Adapter-Ursprung mit demselben Picker als Popup.
- Echte HTTP-403-Antworten für Kundenzugriff auf Discovery und geschützte
  Dynamic-Grid-Seite; keine zusätzliche Frontendfreigabe.

Die gemessene Innenbreite entspricht bei 1440/1920/390 Pixeln den verfügbaren
Rahmenbreiten von rund 1321/1404/330 Pixeln. In den geprüften Zuständen lagen
weder horizontaler Formularüberlauf noch eine zusätzliche innere Scrollfläche
vor, auch mit erweitertem Mobilformular. Die Rohwerte stehen im Browserlog.
Frühere FAIL-Einträge wegen Testselektoren, bereits deaktivierter Startnavigation,
unvollständiger PV-Fixture und der Erwartung eines React-Gates statt der realen
serverseitigen 403-Seite bleiben als Zwischenstände sichtbar; sie werden nicht
als bestandene Prüfungen gewertet.

Der ergänzende tatsächliche Save-/Import-Browserlauf ist ebenfalls mit sechs
bestandenen Abläufen in [browser-real-save.log](browser-real-save.log) belegt.

Weitere vorhandene Belege: [picker-bridge.log](picker-bridge.log),
[frontend-form.log](frontend-form.log),
[frontend-version.log](frontend-version.log) und
[frontend-navigation.log](frontend-navigation.log).

## Grenzen

Keine reale Gerätekommunikation, keine Hausanlagenprüfung und kein Live-Update.
Der UI-Test ersetzt ioBroker-Objekte, Übergabehaken und EMS-Neustart durch lokale
Fixtures. Die eigenständige Popup-Bedienung ist für den Adapter-Ursprung geprüft;
ein manuell auf einem anderen ioBroker-Admin-Ursprung geöffneter Hashpfad ist
nicht Bestandteil dieses Browsernachweises. Die allgemeine vorbestehende
Reload-Beobachtung aus dem [vorherigen Zweitreview](../dynamic-grid-save-2026-10-23/SECOND_REVIEW_DE.md)
wird durch diesen Patch nicht als behoben ausgegeben.

## Bindung an den geprüften Stand

SHA-256 nach Produktfreeze:

| Datei | SHA-256 |
| --- | --- |
| `src-ts/runtime-executables/www/ems-apps.ts` | `d64fb15846ec8f3b1b1cb223ab654115c8116446e989186d5570634e252983ee` |
| `src-admin-tab/src/App.tsx` | `988049c1202b421d7347712b7d8255449e0e3d9ece76845aa8efa29c7eeb3f88` |
| `src-admin-tab/src/components/EmbeddedEmsFrame.tsx` | `78e0d86bdbe9900186515b12b16f6dfb395d20d84829e66436b42af71fb3c8f9` |
| `src-admin-tab/src/components/DpField.tsx` | `920628139c43f332cb85f4cf1522396397fd116978f7031cf2ba4fd6bca6a8de` |
| `src-admin-tab/src/lib/dataPointPicker.ts` | `2f241328fd6ca27fecd282f2c7d30c0cb48b338e34c3ca5afc4c98546742dcc5` |
| `src-admin-tab/src/pages/DynamicGridPage.tsx` | `9f3f89f9a61f85f31d840bf1fc31748e8355d0b5592cc88f89a1195e4ddadcc9` |
| `src-admin-tab/src/pages/PageShell.tsx` | `d4fd48966b9917dd95c840fc43636e4d7b8b9d29edaf5588087af20872f1de71` |
| `src-admin-tab/src/pages/ProtectedRuntimeRoute.tsx` | `7881c8fa714c787e223f0fe69ec6a3e9468d2e0e60d08280ff780b91da0cdda1` |
| `src-admin-tab/src/styles.css` | `f88b85fb781383c60b8f43d59d031fc5525b6bc461cee0fa9f2957cdeb789db4` |
| `www/ems-apps.js` | `e87b31b9e2f6c2076f93697f483bb185d0d62a376ab49363e067404ba5386187` |
| `admin/react/assets/index-DPu0nhp3.js` | `f3fc3de6be2f44f0923b63213496f4c130340b5d597f0e8b4bcb049edf6f57d9` |
| `admin/react/assets/index-CtlHz4Eh.css` | `020442987282c0d809452e46ad6277fe0eb6cf20041ede680331a445dd191b86` |
